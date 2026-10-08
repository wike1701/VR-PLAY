# VR Play

Web de juegos VR que se juegan en el navegador. Mientras juegas puedes pasar al siguiente juego sin salir de la realidad virtual.

## Estructura

```
index.html              Catálogo con la cuadrícula de juegos
play.html               Página de juego (la "shell" VR)
shell/
  shell.js              Renderizador, sesión VR, carga/precarga y cambio de juegos
  boton-cambio.js       Botón virtual detrás del hombro derecho
  utilidades.js         Paneles de texto 3D y liberación de memoria
  sonido.js             Efectos de sonido sintetizados
juegos/
  catalogo.js           Lista de juegos (el orden es el orden del botón "siguiente")
  fruta/juego.js        Corta Fruta
  topos/juego.js        Aplasta Topos
  flechas/juego.js      Esquiva Flechas
  tiro/juego.js         Galería de Tiro
```

three.js se carga desde la CDN de jsDelivr (versión fija 0.160.0) mediante el `importmap` de `play.html`.

## Cómo funciona el cambio de juego

- `play.html` crea el renderizador y la sesión VR **una sola vez**.
- Cada juego es un módulo que la shell monta y desmonta en la misma escena. Al cambiar, la sesión VR sigue abierta.
- Mientras juegas, la shell descarga en segundo plano el siguiente juego de la lista. Así el cambio es casi instantáneo.
- En VR, el botón flota detrás de tu hombro derecho. Se activa al dejar la mano medio segundo encima o al apretar el gatillo tocándolo. Hay que sacar la mano para volver a usarlo, así que un golpe accidental no cambia de juego dos veces.
- Sin gafas: botón «Siguiente juego» o tecla **N**.

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
  return {
    actualizar(dt, t) { /* se llama en cada fotograma */ },
    liberar() { /* limpia lo que no esté en ctx.raiz */ },
  };
}
```

2. Añade una miniatura cuadrada (`juegos/<id>/miniatura.svg`, `.png` o `.jpg`).
3. Añade la entrada en `juegos/catalogo.js`.

Reglas para que el cambio sea fluido: todo lo visible va dentro de `ctx.raiz` o en las manos con `ctx.adjuntarAMano`. Las geometrías y los materiales compartidos se registran con `ctx.recurso()`. No uses `setTimeout` ni listeners propios, sino el tiempo de `actualizar`. Así la shell puede liberar todo al cambiar y la memoria del Quest no crece.

## Anuncios

Los anuncios van en el catálogo (`index.html`, donde está «Espacio publicitario») y, si quieres, en la barra de `play.html`. Nunca dentro de la escena VR.
