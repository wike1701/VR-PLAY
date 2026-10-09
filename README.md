# VR Play

Web de juegos VR que se juegan en el navegador. Mientras juegas puedes pasar al siguiente juego sin salir de la realidad virtual.

## Estructura

```
index.html              Catálogo con la cuadrícula de juegos
favicon.svg             Icono de la pestaña del navegador
manifest.webmanifest    Datos para instalar la web como app (pantalla completa en el móvil)
iconos/                 Iconos PNG de la app (Android e iPhone)
play.html               Página de juego (la "shell" VR)
shell/
  shell.js              Renderizador, sesión VR, carga/precarga y cambio de juegos
  boton-cambio.js       Botón virtual detrás del hombro derecho
  utilidades.js         Paneles de texto 3D y liberación de memoria
  graficos.js           Kit gráfico: cielo, reflejos, texturas generadas y sombras
  sonido.js             Efectos de sonido sintetizados
  pantalla-completa.js  Pantalla completa en el móvil y botones flotantes
juegos/
  catalogo.js           Lista de juegos con sus etiquetas para buscar por # (el botón "siguiente" los recorre en orden aleatorio, sin repetir)
  fruta/juego.js        Corta Fruta
  topos/juego.js        Aplasta Topos
  flechas/juego.js      Esquiva Flechas
  tiro/juego.js         Galería de Tiro
  patos/juego.js        Caza de Patos
  baloncesto/juego.js   Tiro a Canasta
  portero/juego.js      Para Penaltis
  petanca/juego.js      Petanca
  beisbol/juego.js      Batea Bolas
  pingpong/juego.js     Ping Pong
  bolos/juego.js        Bolos
  badminton/juego.js    Bádminton
  voleibol/juego.js     Vóley Playa
  carreras/juego.js     Carreras
  obstaculos/juego.js   Ruta de Obstáculos
```

three.js se carga desde la CDN de jsDelivr (versión fija 0.160.0) mediante el `importmap` de `play.html`.

## Cómo funciona el cambio de juego

- `play.html` crea el renderizador y la sesión VR **una sola vez**.
- Cada juego es un módulo que la shell monta y desmonta en la misma escena. Al cambiar, la sesión VR sigue abierta.
- Mientras juegas, la shell descarga en segundo plano el siguiente juego de la lista. Así el cambio es casi instantáneo.
- En VR, el botón flota detrás de tu hombro derecho, con un halo que late. Al empezar cada juego (y al llevar la mano hacia la cabeza) aparece en la vista una flecha que señala dónde está. Es grande y, al llevar la mano hacia atrás, el mando vibra cada vez más rápido cuanto más cerca estás. Se activa al dejar la mano medio segundo encima o al apretar el gatillo tocándolo. Hay que sacar la mano para volver a usarlo, así que un golpe accidental no cambia de juego dos veces.
- Sin gafas: botón «Siguiente juego» o tecla **N**.
- En el móvil se juega con el dedo, también en vertical: la shell abre el campo de visión para que quepa lo importante a lo ancho, y cada juego del catálogo tiene su texto `controlesTactil`. En los juegos, `ctx.tactil` indica si la pantalla es táctil (para decir «toca» en vez de «haz clic»).
- Pantalla completa en el móvil: en Android el primer toque en el juego la activa (o el botón ⛶); solo quedan el juego y dos botones flotantes (⏭ siguiente, ✕ salir). En iPhone Safari no lo permite: hay que usar Compartir → «Añadir a pantalla de inicio», y desde ese icono se abre sin barras.

## Probarlo en tu ordenador

Los módulos JavaScript necesitan un servidor; no funcionan abriendo el archivo con doble clic. Desde esta carpeta:

```
python -m http.server 8000
```

Abre `http://localhost:8000` y juega con el ratón.

## Probarlo en Meta Quest

La VR solo funciona con HTTPS, así que lo más sencillo es publicarlo:

1. Sube la carpeta a un repositorio de GitHub.
2. En Cloudflare Pages, crea un proyecto conectado a ese repositorio. No hace falta comando de compilación y el directorio de salida es la raíz (`/`).
3. Abre la dirección `https://…pages.dev` en el navegador del Quest, entra en un juego y pulsa **Entrar en VR**.

## Añadir un juego nuevo

1. Crea `juegos/<id>/juego.js` con dos funciones:

```js
import * as THREE from 'three';

// Opcional: descarga texturas, modelos o sonidos SIN añadirlos a la escena.
export async function precargar() {}

export function iniciar(ctx) {
  // ctx.raiz           -> grupo donde se añade todo el juego
  // ctx.manos          -> mandos: { grip, activa, gatillo, gatilloPulsado, posicion }
  // ctx.raton          -> ratón en modo escritorio: { rayo, clic, velocidadPx, ... }
  // ctx.enVR()         -> true si se está jugando con gafas
  // ctx.adjuntarAMano(mano, objeto), ctx.recurso(geometriaOMaterial)
  // ctx.crearPanel(...), ctx.sonido(nombre), ctx.vibrar(mano, fuerza, ms)
  // ctx.fondo(color), ctx.vistaEscritorio(pos, objetivo), ctx.guardar/leer(clave)
  // ctx.texturas.cesped/madera/tablas/grano/ladrillos/tela(...), ctx.texturaCanvas(...)
  // ctx.crearSombra({ radio }), ctx.colocarSombra(sombra, posicion, ySuelo), ctx.sueloBase(visible)
  return {
    actualizar(dt, t) { /* se llama en cada fotograma */ },
    liberar() { /* limpia lo que no esté en ctx.raiz */ },
  };
}
```

2. Añade una miniatura cuadrada (`juegos/<id>/miniatura.svg`, `.png` o `.jpg`).
3. Añade la entrada en `juegos/catalogo.js`, **con sus etiquetas** (ver abajo).

```js
{
  id: 'patos',
  titulo: 'Caza de Patos',
  genero: 'Disparos',
  etiquetas: ['disparos', 'disparar', 'arco', 'flechas', 'puntería', 'patos', 'caza'],
  descripcion: '…',
  controlesVR: '…',
  controlesEscritorio: '…',
  controlesTactil: '…',
  miniatura: 'juegos/patos/miniatura.svg',
  modulo: 'juegos/patos/juego.js',
},
```

### Etiquetas y búsqueda por `#`

En el buscador del catálogo se puede escribir `#etiqueta` para ver los juegos de ese tipo. Por ejemplo, `#disparos` o `#disparar` muestran Galería de Tiro y Caza de Patos.

- Cada juego necesita un campo `etiquetas` en `catalogo.js`. Si no lo tiene, solo se encontrará por título, descripción y género.
- Pon las palabras en minúsculas y sin `#`. Incluye el sustantivo y el verbo (`disparos`, `disparar`), el arma u objeto (`arco`, `pistola`) y el tipo de juego (`puntería`, `reflejos`, `esquivar`).
- Las tildes dan igual al buscar (`#punteria` encuentra `puntería`). Una etiqueta se encuentra también por su principio: `#dispar` encuentra `disparos` y `disparar`.
- El género cuenta como una etiqueta más.
- Se pueden combinar palabras y todas tienen que coincidir. Por ejemplo, `#disparos arco` muestra solo Caza de Patos.
- Pon **entre 30 y 50 etiquetas por juego**. Añade sinónimos, singular y plural, objetos y animales que aparecen, sensaciones (`intenso`, `fácil`), público (`niños`, `familia`) y nombres en inglés que la gente pueda buscar (`shooter`, `dodge`).
- Las **6 primeras** se muestran en la tarjeta del catálogo y el resto solo sirven para buscar. Pon delante las más representativas.
- Reutiliza las etiquetas que ya existen para que los juegos parecidos salgan juntos.

Reglas para que el cambio sea fluido: todo lo visible va dentro de `ctx.raiz` o en las manos con `ctx.adjuntarAMano`. Las geometrías y los materiales compartidos se registran con `ctx.recurso()`. No uses `setTimeout` ni listeners propios, sino el tiempo de `actualizar`. Así la shell puede liberar todo al cambiar y la memoria del Quest no crece.

## Calidad gráfica y rendimiento

El objetivo es que todos los juegos se vean al mismo nivel sin bajar de los fotogramas del Quest. La shell ya pone tone mapping, un cielo con degradado (`ctx.fondo(color)`) y un mapa de entorno sacado de ese cielo, así que los `MeshStandardMaterial` tienen reflejos sin coste extra. El estándar para cada juego:

- **Suelos y superficies grandes con textura** generada por código (`ctx.texturas.*`, registradas con `ctx.recurso()`). Si el juego tiene su propio suelo, oculta el de la shell con `ctx.sueloBase(false)`.
- **Sombras de mancha** (`ctx.crearSombra`) bajo los objetos que se mueven o flotan. Nunca sombras reales (`castShadow`): en las gafas son caras.
- **`MeshStandardMaterial` solo para los protagonistas pequeños** (balones, bolas, bates, armas…). El resto en `MeshLambertMaterial`.
- **Pocas llamadas de dibujo.** Cada malla se dibuja dos veces en VR (una por ojo). Muchos objetos iguales → una textura, `InstancedMesh` o geometría fusionada. Mide con `vrPlay.dibujado()` en la consola: intenta no pasar de ~100 llamadas ni de 60.000 triángulos.
- Nada de luces puntuales nuevas, postprocesado ni grandes superficies transparentes superpuestas. No crees objetos dentro de `actualizar`.

## Anuncios

Los anuncios van en el catálogo (`index.html`, donde está «Espacio publicitario») y, si quieres, en la barra de `play.html`. Nunca dentro de la escena VR.
