# VR Play

Web de juegos VR que se juegan en el navegador. Mientras juegas puedes pasar al siguiente juego sin salir de la realidad virtual.

## Estructura

Resumen de los archivos. Las normas de dónde va cada cosa nueva están en [`docs/ESTRUCTURA.md`](docs/ESTRUCTURA.md), y se comprueban con `node herramientas/estructura.mjs`.

```
index.html              Portada: pestañas «Para ti» (el catálogo) y «Seguidos» (lo que hacen los jugadores que sigues)
foro.html               Foro de sugerencias (hilos, me gusta, comentarios)
admin.html              Panel de administración del foro y de las cuentas (pide la clave ADMIN_TOKEN)
entrar.html             Entrar en la cuenta: con Google o con un enlace y un código por correo; la primera vez, el alias
cuenta.html             Ajustes de la cuenta: alias, avatar, privacidad, avisos, sesiones, descargar mis datos y borrar la cuenta
clasificacion.html      Clasificación de cada juego (clasificacion.html#topos o #topos/mes): el top 100 y tu puesto
perfil.html             Perfil de una cuenta (perfil.html#alias): seguir, seguidores, sus juegos e ideas; en el tuyo, ajustes, «me gusta» y guardados
estilos/base.css        Sistema de diseño: colores, fuentes (Geist) y logo de todas las páginas
estilos/cuenta.css      Estilos de entrar.html, cuenta.html, perfil.html y clasificacion.html
wrangler.jsonc          Configuración del Worker de Cloudflare (web + API del foro + base de datos)
.assetsignore           Archivos del repositorio que no se publican
servidor/               API del foro y de las cuentas: solo atiende /api/* (index.js reparte las rutas)
bd/esquema.sql          Tablas de la base de datos del foro y de las cuentas (Cloudflare D1)
herramientas/foro.mjs   Leer y moderar el foro desde la terminal
herramientas/idiomas.mjs  Comprobar que todos los idiomas tienen los mismos textos
herramientas/marcadores.mjs  Comprobar que todos los juegos tienen clasificación
herramientas/estructura.mjs  Comprobar la estructura: juegos completos, raíz limpia y ninguna ruta rota
herramientas/calidad.mjs  Comprobar el estándar de calidad y rendimiento de cada juego (docs/CALIDAD.md)
docs/                   ESTRUCTURA.md (dónde va cada cosa), PERFILES.md (cuentas) y LANZAMIENTO.md (lista de lanzamiento)
.claude/skills/         Skills de Claude Code del proyecto (ver su README)
CLAUDE.md               Cómo trabaja Claude Code en este proyecto (foro → juego nuevo)
favicon.svg             Icono de la pestaña del navegador
manifest.webmanifest    Datos para instalar la web como app (pantalla completa en el móvil)
iconos/                 Iconos PNG de la app (Android e iPhone)
play.html               Página de juego (la "shell" VR)
legal.html              Aviso legal, privacidad, cookies y contacto (el original, en español)
idiomas/
  detectar.js           Decide el idioma de la página (va en el <head> de cada página)
  idiomas.js            Carga los textos del idioma, t('clave'), selector de idioma y traducción del HTML
  es.js, en.js, …       Todos los textos de la web y de los juegos, un archivo por idioma (es.js es el original)
  legal/<código>.html   El texto legal traducido
shell/
  shell.js              Renderizador, sesión VR, carga/precarga y cambio de juegos
  boton-cambio.js       Botones virtuales detrás de los hombros (derecho: siguiente juego; izquierdo: pausa)
  menu-pausa.js         Menú de pausa flotante en VR
  catalogo-vr.js        Catálogo en 3D dentro de la VR («Volver al catálogo» sin quitarse las gafas)
  valoraciones.js       Favoritos (en el navegador y en la cuenta) y "me gusta" de los juegos (en el servidor)
  cuenta.js             Sesión de la cuenta en el navegador: botón «Entrar» o avatar, avatar generado y sincronización
  utilidades.js         Paneles de texto 3D y liberación de memoria
  graficos.js           Kit gráfico: cielo, reflejos, texturas generadas y sombras
  efectos.js            Sensación de juego (ctx.efectos): partículas, números que saltan, micro-pausa y sacudida
  paisaje.js            Horizonte lejano (montes, ciudad…) y árboles instanciados (ctx.fondo({ paisaje }), ctx.arboles)
  sonido.js             Efectos de sonido sintetizados
  pantalla-completa.js  Pantalla completa en el móvil y botones flotantes
  clasificacion.js      Clasificaciones en el navegador (formato de cada unidad, enviar resultados)
  en-pruebas.js         Qué juegos están en pruebas (no salen en el catálogo ni en la rotación)
juegos/
  marcadores.js         Cómo puntúa cada juego en la clasificación (orden, unidad y límites contra trampas)
  catalogo.js           Lista de juegos con su género (sus textos y etiquetas están en idiomas/; el botón "siguiente" los recorre en orden aleatorio, sin repetir)
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
  pulso/juego.js        Pulso Firme
  piloto/juego.js       Piloto Estelar
  minigolf/juego.js     Minigolf
  globos/juego.js       Pincha Globos
  mosquitos/juego.js    Matamosquitos
  tirapichon/juego.js   Tirapichón
  slot/juego.js         Circuito Slot
  picnic/juego.js       Picnic Matamoscas
  dardos/juego.js       Dardos
  boxeo/juego.js        Saco de Boxeo
  simon/juego.js        Simón de Colores
  balanceo/juego.js     Balanceo
  cazafantasmas/juego.js  Cazafantasmas
  malabares/juego.js    Malabares
  airhockey/juego.js    Air Hockey
  cinta/juego.js        Cinta Mecánica
  bar/juego.js          Last Call: Bar Loco (en pruebas)
  bomba/juego.js        ¡Que no explote! (en pruebas)
  fusion/juego.js       Fusión de Frutas
  balonmano/juego.js    Penaltis de Balonmano
  canoa/juego.js        Canoa
  torre/juego.js        Torre de Bloques (en pruebas)
  huevos/juego.js       Atrapa Huevos (en pruebas)
  latas/juego.js        Tumba Latas (en pruebas)
  aros/juego.js         Lanza Aros (en pruebas)
  laberinto/juego.js    Laberinto (en pruebas)
```

three.js se carga desde la CDN de jsDelivr (versión fija 0.160.0) mediante el `importmap` de `play.html`.

## Cómo funciona el cambio de juego

- `play.html` crea el renderizador y la sesión VR **una sola vez**.
- Cada juego es un módulo que la shell monta y desmonta en la misma escena. Al cambiar, la sesión VR sigue abierta.
- Mientras juegas, la shell descarga en segundo plano el siguiente juego de la lista. Así el cambio es casi instantáneo.
- En VR, el botón flota detrás de tu hombro derecho, con un halo que late. Al empezar cada juego aparece unos segundos en la vista una flecha que señala dónde está (solo entonces, para que no moleste mientras juegas). Es grande y, al llevar la mano hacia atrás, el mando vibra cada vez más rápido cuanto más cerca estás. Se activa al dejar la mano **exactamente un segundo** encima: mientras tanto, delante de los ojos gira una rueda de carga que se completa con el nombre de la acción debajo (el botón está detrás y no se ve). Si sacas la mano antes, la carga vuelve a cero. Hay que sacar la mano para volver a usarlo, así que un golpe accidental no cambia de juego dos veces.
- Sin gafas: botón «Siguiente juego» o tecla **N**.
- **Catálogo dentro de la VR.** Con las gafas puestas, «Volver al catálogo» del menú de pausa no sale de la realidad virtual: se cierra el juego y aparece delante una pared curva con los mismos juegos públicos que la portada (portada, título, género, partidas, «me gusta» y ★ favoritos), los filtros por género y por favoritos y páginas de 8. Se apunta con el mando y se aprieta el gatillo (la palanca, a los lados, pasa de página); al apuntar una tarjeta sale abajo su descripción y sus etiquetas. Debajo hay «⟲ Volver a …» (el juego que dejaste) y «✕ Salir de la realidad virtual», que lleva a la portada de la web. Sin gafas, «Volver al catálogo» sigue llevando a la portada. Está en `shell/catalogo-vr.js`: cada tarjeta es un plano con su dibujo en un canvas (unas 27 llamadas de dibujo en total).
- **Volver al juego anterior.** La shell recuerda los juegos por los que has pasado (los últimos 20). Si has pasado uno sin querer o te ha gustado y quieres volver: en VR, desde el menú de pausa («⟲ Volver a …»); sin gafas, con el botón «⟲ Juego anterior» (sale en cuanto hay uno), la tecla **B** o el menú de pausa. Volver no apunta el juego en el historial, así que se puede ir hacia atrás varios seguidos.
- **Pausa.** En VR hay un botón gemelo del de cambio de juego, de color verde azulado, detrás del hombro **izquierdo**. Funciona exactamente igual, con su halo, su flecha guía al empezar y la vibración que te guía, pero solo con la mano **izquierda**. El de cambio de juego solo responde a la mano **derecha**. Sin gafas, usa el botón ⏸ o la tecla **Esc** (o **P**). El juego se congela, porque la shell deja de llamar a `actualizar()`, y los motores se silencian. Aparece un menú con: Continuar, ⟲ Volver a *el juego anterior* (si has pasado por otro antes), ♥ Me gusta, ★ Guardar en favoritos y Volver al catálogo. En VR se elige apuntando con el mando y apretando el gatillo, o tocando el botón con la mano. Los juegos no tienen que hacer nada para tenerlo.
- **Favoritos y me gusta.** Los favoritos se guardan en el navegador y salen en el catálogo como filtro «★ Favoritos» y con una ★ en la tarjeta. Los «me gusta» se cuentan en el servidor (`/api/juegos/:id/me-gusta`, tabla `juegos_me_gusta`, que el Worker crea solo) y salen como ♥ en la miniatura.
- **Partidas.** La shell cuenta una partida cuando llevas 15 segundos jugando a un juego, sin contar la pausa (`/api/juegos/:id/partida`). La misma conexión cuenta como mucho una por juego cada 10 minutos y 60 por hora. Salen como ▶ en la miniatura, con números cortos (12,3 mil). Los totales de partidas y «me gusta» se guardan ya contados en `juegos_estadisticas` (`/api/juegos/estadisticas`), así que la portada lee una fila por juego aunque haya millones.
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
2. En Cloudflare (Workers & Pages), crea un Worker conectado a ese repositorio. Se despliega con `npx wrangler deploy` según `wrangler.jsonc`: la web son los archivos de la raíz y `servidor/` atiende la API del foro.
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
  // ctx.bloquearCambio(bool) -> mientras sea true no se puede pasar de juego (balón cogido); se reinicia al cambiar
  // ctx.adjuntarAMano(mano, objeto), ctx.recurso(geometriaOMaterial)
  // ctx.crearPanel(...), ctx.sonido(nombre), ctx.vibrar(mano, fuerza, ms)
  // ctx.sonidoContinuo('motor') -> { ajustar(valor 0-1, volumen), parar() } (la shell lo para al salir)
  // ctx.fondo(color), ctx.vistaEscritorio(pos, objetivo), ctx.guardar/leer(clave)
  // ctx.texturas.cesped/madera/tablas/grano/ladrillos/tela(...), ctx.texturaCanvas(...)
  // ctx.crearSombra({ radio }), ctx.colocarSombra(sombra, posicion, ySuelo), ctx.sueloBase(visible)
  // ctx.t('clave', { n: 3 }) -> texto en el idioma del jugador (ver «Idiomas»). Nunca escribas textos a mano.
  // ctx.efectos.impacto(nivel, { pos, mano, color, sonido }) -> respuesta a un acierto o golpe: 'pequeño', 'medio' o 'grande'
  // ctx.efectos.texto(pos, '+3', { color, tam }), ctx.efectos.estallido(pos, { color, cantidad }) (ver docs/CALIDAD.md)
  // ctx.fondo(color, { nubes, estrellas, luna, sol, niebla: [cerca, lejos], paisaje: { tipo, color } })
  // ctx.arboles(lista, { tipo: 'pino' | 'frondoso' | 'palmera' }) -> grupo, ctx.geometriaArbol(tipo), ctx.orientarFondo(giro)
  // ctx.puntuacion(valor) -> OBLIGATORIO al terminar cada partida, con su resultado (ver «Clasificaciones»)
  return {
    actualizar(dt, t) { /* se llama en cada fotograma */ },
    liberar() { /* limpia lo que no esté en ctx.raiz */ },
  };
}
```

2. Añade su portada cuadrada (`juegos/<id>/miniatura.svg`) siguiendo [`docs/PORTADAS.md`](docs/PORTADAS.md), para que sea de la misma familia que las demás. `node herramientas/calidad.mjs` comprueba lo técnico.
3. Añade la entrada en `juegos/catalogo.js` con su género (una clave de `generos` en los idiomas: `arcade`, `deportes`, `disparos`…):

```js
{ id: 'patos', genero: 'disparos' },
```

4. **Clasificación (obligatoria).** Todo juego tiene puntuación y clasificación. Decide qué mide mejor lo bien que se ha jugado y ponlo en `juegos/marcadores.js` (ver «Clasificaciones»). Después llama a `ctx.puntuacion(valor)` al terminar **cada** partida, también si no es récord. Compruébalo con `node herramientas/marcadores.mjs`.
5. Añade sus textos en **cada** archivo de `idiomas/`, en `juegos.<id>`: los del catálogo, **con sus etiquetas** (ver abajo), y en `juego` los que salen dentro del juego. Después comprueba que no falte ninguno con `node herramientas/idiomas.mjs`.

```js
patos: {
  titulo: 'Caza de Patos',
  descripcion: '…',
  controlesVR: '…',
  controlesEscritorio: '…',
  controlesTactil: '…',
  etiquetas: ['disparos', 'disparar', 'arco', 'flechas', 'puntería', 'patos', 'caza', …],
  juego: {
    titulo: 'CAZA DE PATOS',
    dorado: '¡Pato dorado! +5',
    fin: { one: '¡Fin! {n} punto', other: '¡Fin! {n} puntos' },
  },
},
```

### Etiquetas y búsqueda por `#`

En el buscador del catálogo se puede escribir `#etiqueta` para ver los juegos de ese tipo. Por ejemplo, `#disparos` o `#disparar` muestran Galería de Tiro y Caza de Patos.

- Cada juego necesita su lista `etiquetas` en cada idioma (`idiomas/<código>.js`, en `juegos.<id>`). El buscador usa las del idioma de la página más las originales en español.
- Pon las palabras en minúsculas y sin `#`. Incluye el sustantivo y el verbo (`disparos`, `disparar`), el arma u objeto (`arco`, `pistola`) y el tipo de juego (`puntería`, `reflejos`, `esquivar`).
- Las tildes dan igual al buscar (`#punteria` encuentra `puntería`). Una etiqueta se encuentra también por su principio: `#dispar` encuentra `disparos` y `disparar`.
- El género cuenta como una etiqueta más.
- Se pueden combinar palabras y todas tienen que coincidir. Por ejemplo, `#disparos arco` muestra solo Caza de Patos.
- En español pon **entre 30 y 50 etiquetas por juego**. Añade sinónimos, singular y plural, objetos y animales que aparecen, sensaciones (`intenso`, `fácil`), público (`niños`, `familia`) y nombres en inglés que la gente pueda buscar (`shooter`, `dodge`). En los demás idiomas, **entre 20 y 30**, con las palabras que buscaría alguien de ese idioma (no traducciones literales: en inglés, `shooting`; en japonés, `シューティング`).
- Las **6 primeras** se muestran en la tarjeta del catálogo y el resto solo sirven para buscar. Pon delante las más representativas.
- Reutiliza las etiquetas que ya existen para que los juegos parecidos salgan juntos.

Reglas para que el cambio sea fluido: todo lo visible va dentro de `ctx.raiz` o en las manos con `ctx.adjuntarAMano`. Las geometrías y los materiales compartidos se registran con `ctx.recurso()`. No uses `setTimeout` ni listeners propios, sino el tiempo de `actualizar`. Así la shell puede liberar todo al cambiar y la memoria del Quest no crece.

## Idiomas

La web está en 9 idiomas: español (el original), inglés, francés, alemán, italiano, portugués, japonés, coreano y chino simplificado. Todo se traduce: las páginas, los juegos (paneles, marcadores, carteles), el foro, los errores del servidor y el texto legal. Lo que escribe la gente en el foro se queda tal cual.

- **Qué idioma se ve.** `idiomas/detectar.js` decide antes de pintar la página, por este orden: `?lang=xx` en la dirección, el idioma elegido antes (se guarda en el navegador), el idioma del navegador y, si no es ninguno de los 9, inglés. La página queda en `<html lang="…">` y, mientras se traduce, oculta para que no se vea un instante en español.
- **Cambiar de idioma.** Con el desplegable de la cabecera (catálogo, foro y legal). La elección se recuerda. Cualquier página admite `?lang=xx` para enlazarla en un idioma concreto, y las cabeceras llevan `hreflang` para los buscadores.
- **Los textos** están en `idiomas/<código>.js`, todos con las mismas claves que `idiomas/es.js`. En el código se piden con `t('clave', datos)` (`import { t } from './idiomas/idiomas.js'`); en el HTML, con `data-i18n="clave"`, `data-i18n-attr="placeholder:clave"` o `data-i18n-html`. En los juegos, con `ctx.t('clave')`, que busca en `juegos.<id>.juego`; las claves `partida.…` son textos compartidos (`partida.record`, `partida.tanteo`…).
  - `{n}`, `{juego}`… se sustituyen por los datos: `ctx.t('fin', { n: puntos })`.
  - Los plurales se escriben `{ one: '{n} punto', other: '{n} puntos' }` y se elige la forma con el dato `n`. En japonés, coreano y chino basta un texto.
  - Nada de unir trozos de frase en el código (`'Punto para ' + nombre`): cada idioma ordena la frase a su manera. Escribe la frase entera con sus datos.
- **Si falta un texto** en un idioma, sale en español y la consola avisa. `node herramientas/idiomas.mjs` comprueba que todos los idiomas tienen las mismas claves y los mismos datos `{…}`, y que las claves que usan los juegos existen. Pásalo siempre después de tocar textos.
- **El foro** guarda el tipo de juego en español y lo traduce al enseñarlo. El servidor responde los errores con un `codigo` (`foro.errores.<codigo>`) para que la página los enseñe traducidos.
- **El texto legal** original es `legal.html`. Las traducciones están en `idiomas/legal/<código>.html` y avisan de que prevalece el español. Si cambias algo del texto legal (o rellenas los datos pendientes), cámbialo también en ellas.
- **Añadir un idioma:** su archivo `idiomas/<código>.js` (copia `en.js` y tradúcelo), su texto legal, el código en `IDIOMAS` (`idiomas.js`) y en `CODIGOS` (`detectar.js`), y los `hreflang` de las cabeceras de `index.html`, `foro.html` y `legal.html`.
- `admin.html` y `herramientas/` siguen solo en español: son para el administrador.

## Clasificaciones

Cada juego tiene su clasificación: la **de siempre** y la **del mes**, con el top 100 y tu puesto. Solo salen las cuentas con la sesión iniciada. Sin cuenta, el récord se sigue guardando en el navegador, como siempre.

- **Todo juego tiene que tener puntuación y clasificación**, también los que se hagan en el futuro. Lo decide quien hace el juego (normalmente, la IA): la medida que mejor diga lo bien que se ha jugado y que no dependa solo de las horas jugadas. Ejemplos actuales:
  - **Puntos** (más es mejor): la mayoría.
  - **Tiempo** (menos es mejor): Carreras, el tiempo de la carrera.
  - **Puntos de una carrera** (Circuito Slot): como el circuito cambia en cada carrera, no se comparan tiempos; se dan 1000 puntos por igualar la carrera perfecta de ese circuito (acelerar a tope y frenar justo antes de cada curva) y menos cuanto más se tarda.
  - **Golpes** (menos es mejor): Minigolf, el total de los 9 hoyos.
  - **Diferencia** (más es mejor): los juegos contra la máquina (Ping Pong, Bádminton, Vóley Playa, Petanca). Al ganar, tus puntos menos los suyos, así que un 11-3 da +8. Si pierdes, no se envía nada.
- **En `juegos/marcadores.js`** va el marcador de cada juego: `orden` (`mayor`/`menor`), `unidad` (`puntos`, `tiempo`, `golpes`, `diferencia`), `min` y `max` posibles, `minSegundos` (lo mínimo que dura una partida) y, en los juegos sin final fijo, `maxPorSegundo`. El servidor y el navegador usan el mismo archivo. Una unidad nueva necesita su formato en `shell/clasificacion.js` y su frase en `clasificacion.criterio` de los idiomas.
- **En el juego**, `ctx.puntuacion(valor)` al terminar cada partida. La shell abre la partida en el servidor al montar el juego y al terminar cada una, envía el resultado y enseña el puesto («🏆 ¡Nuevo récord! Puesto 3»). En VR sale en el panel de avisos; con ratón o en el móvil, arriba de la pantalla. Sin cuenta, invita una vez a entrar.
- **Contra trampas.** Los resultados los calcula el navegador, así que no se pueden impedir del todo, pero sí hacerlo poco rentable. El servidor solo acepta un resultado de una partida que abrió él, que haya durado al menos `minSegundos` y que esté dentro de `min`/`max`. En los juegos de tiempo, además, el tiempo no puede ser mayor que lo que ha durado la partida. Hay un límite de 300 partidas por hora. En `admin.html` (pestaña «Usuarios») se pueden borrar los récords de una cuenta y sacarla de las clasificaciones.
- **Dónde se ve**: en el menú de pausa (las 5 primeras y tu puesto, también en VR), en `clasificacion.html#juego` (enlace «🏆 Clasificaciones» en la portada), en el perfil (récords y puesto en cada juego) y en la pestaña «Seguidos» («@ana ha conseguido 12.400 puntos en Topos»). Cada cuenta puede no salir en las listas públicas desde los ajustes de privacidad.
- **Tablas**: `records` (el mejor de cada cuenta en cada juego), `records_mes` y `partidas_abiertas`. Las rutas son `/api/clasificacion/:juego` (y `/empezar`).
- **Comprobarlo**: `node herramientas/marcadores.mjs`.

## Calidad gráfica y rendimiento

**El estándar completo está en [`docs/CALIDAD.md`](docs/CALIDAD.md)** (rendimiento, sensación de juego, HUD, aspecto y lista antes de subir) y el de las portadas en [`docs/PORTADAS.md`](docs/PORTADAS.md) y se comprueba con `node herramientas/calidad.mjs` (`--avisos` para ver también las recomendaciones). Ningún juego se sube con errores.

El objetivo es que todos los juegos se vean al mismo nivel sin bajar de los fotogramas del Quest. La shell ya pone tone mapping, un cielo con degradado (`ctx.fondo(color)`) y un mapa de entorno sacado de ese cielo, así que los `MeshStandardMaterial` tienen reflejos sin coste extra. El estándar para cada juego:

- **Suelos y superficies grandes con textura** generada por código (`ctx.texturas.*`, registradas con `ctx.recurso()`). Si el juego tiene su propio suelo, oculta el de la shell con `ctx.sueloBase(false)`.
- **Sombras de mancha** (`ctx.crearSombra`) bajo los objetos que se mueven o flotan. Nunca sombras reales (`castShadow`): en las gafas son caras.
- **`MeshStandardMaterial` solo para los protagonistas pequeños** (balones, bolas, bates, armas…). El resto en `MeshLambertMaterial`.
- **Pocas llamadas de dibujo.** Cada malla se dibuja dos veces en VR (una por ojo). Muchos objetos iguales → una textura, `InstancedMesh` o geometría fusionada. Mide con `vrPlay.dibujado()` en la consola: intenta no pasar de ~100 llamadas ni de 60.000 triángulos.
- Nada de luces puntuales nuevas, postprocesado ni grandes superficies transparentes superpuestas. No crees objetos dentro de `actualizar`.

## Encargos de voz (Discord → Claude)

Un bot de Discord (carpeta `voz-a-claude`, **fuera** de este repositorio, junto a `vr-play`) escucha el canal de voz mientras habláis. Cada vez que el usuario dice **«Claude»**, su frase siguiente es un encargo («Claude, haz más fácil el minigolf»): el bot crea un issue en este repositorio con esa frase y las etiquetas `voz` y `claude-implementar`, y avisa en el chat de Discord. Lo demás de la charla no sale del PC. Solo valen los encargos de las voces de `DISCORD_VOCES_PERMITIDAS` (la del usuario).

La etiqueta lanza `.github/workflows/claude-implementar.yml`: Claude Code lee `CLAUDE.md` y programa el encargo en una rama; después el workflow la pone encima de main, pasa las comprobaciones (sintaxis, idiomas, marcadores, estructura y calidad) y, si todo va bien, **la sube a main** (la web se publica sola), cuenta el commit en el issue y lo cierra. Si algo falla, no se sube nada y lo dice en el issue. Los encargos van de uno en uno. En los issues y Pull Requests también se le puede pedir algo con `@claude …` (solo dueños y colaboradores); eso no se sube solo a main.

Para que funcione hace falta, una vez: instalar la app de Claude en el repositorio (`/install-github-app` en Claude Code) y añadir el secreto `ANTHROPIC_API_KEY` (o `CLAUDE_CODE_OAUTH_TOKEN`, de `claude setup-token`, para usar la suscripción; entonces hay que cambiar la línea comentada del workflow). Cómo arrancar el bot: su propio `README.md`.

## Foro de sugerencias

`foro.html` es un foro donde cualquiera, sin cuenta, puede sugerir juegos, darles ♥ y comentar. Las sugerencias se guardan en una base de datos **Cloudflare D1** a través de `servidor/`, el programa del Worker que solo atiende las direcciones `/api/*` (el resto de la web son archivos estáticos).

- Cada sugerencia es un hilo con un **estado**: nueva, en estudio, en desarrollo, hecha, ya existe o descartada.
- Cuando se hace un juego, la respuesta oficial de VR Play queda **anclada** arriba del hilo, con un botón «Jugar». El hilo **sigue abierto** para que la gente opine sobre el juego. Si hay otra respuesta oficial más tarde (por ejemplo, «Actualizado: …»), pasa a ser la anclada y la anterior queda en el historial.
- **Juegos en pruebas.** Un juego enlazado a una sugerencia que aún no está hecha (nueva, en estudio o en desarrollo) no sale en el catálogo ni en la rotación aleatoria, aunque ya esté subido a main. Se juega con su enlace directo (`play.html#id`), por ejemplo desde «▶ Probar» en `admin.html`. Al pasar la sugerencia a «hecha», aparece solo. La lista la da `/api/juegos-en-pruebas`, y si el servidor no responde (en local) no se esconde nada. Un juego ya publicado por otra sugerencia (hecha o ya existe) no se esconde aunque tenga una mejora en desarrollo. Un juego que no viene del foro se deja en pruebas con `pruebas: true` en su línea de `juegos/catalogo.js` (sale en `admin.html` como «Juegos nuevos sin publicar», con su enlace para probarlo; se esconde también en local); para publicarlo, se quita la marca.
- Contra el spam: límites por hora y por IP (solo se guarda un hash de la IP), nombres reservados (nadie puede firmar como «VR Play») y, si se configura, el captcha invisible de Cloudflare (Turnstile).
- La moderación (cambiar estados, responder como VR Play, ocultar) necesita la clave `ADMIN_TOKEN` y se hace con `herramientas/foro.mjs` o desde el navegador en `admin.html`: un panel con las sugerencias por estado (empieza por «en desarrollo»), incluidas las ocultas. La página es pública, pero sin la clave no muestra nada, porque el servidor la comprueba en cada petición. La clave se guarda solo en ese navegador, y solo si marcas «Recordar».

### Ponerlo en marcha (una vez)

En el panel de Cloudflare:

1. **Crear la base de datos.** Storage & Databases → D1 → *Create database*, con el nombre `vrplay-foro`.
2. **Crear las tablas.** Abre la base de datos, pestaña *Console*. Pega el contenido de `bd/esquema.sql` y ejecútalo.
3. **Conectarla a la web.** Copia el *Database ID* de la base de datos y el nombre del Worker, y ponlos en `wrangler.jsonc` (`database_id` y `name`). El nombre tiene que ser exactamente el del Worker, o el despliegue fallará. Sube el cambio a main.
4. **Comprobar el despliegue.** En el Worker, *Settings → Build*: el comando de despliegue tiene que ser `npx wrangler deploy`, sin más opciones. Espera a que termine el despliegue de la subida del paso 3.
5. **Clave de administrador.** En el Worker, Settings → *Variables and Secrets* → Add, las dos de tipo *Secret* (los secretos no se borran al desplegar):
   - `ADMIN_TOKEN`: una clave larga y aleatoria de 32 caracteres o más. Guárdala: es la que da permiso para moderar.
   - `SAL`: otro texto aleatorio. Sirve para las huellas de IP.
6. **Captcha (opcional, recomendado si llega spam).** En Turnstile → *Add widget*, con el dominio de la web. Añade `TURNSTILE_SITEKEY` y `TURNSTILE_SECRET`, también como *Secret*.
7. **Comprobarlo.** `https://<tu-web>/api/config` tiene que responder `"activo":true`.

En tu ordenador, para que Claude Code pueda moderar:

- Pon la dirección de la web en `herramientas/foro.json`, por ejemplo `{ "url": "https://vr-play.pages.dev" }`.
- Guarda la clave como variable de entorno de tu usuario. En PowerShell: `[Environment]::SetEnvironmentVariable('FORO_TOKEN', 'la-clave', 'User')`. Después reinicia VS Code. **La clave nunca va en el repositorio.**

### Uso desde la terminal

```
node herramientas/foro.mjs listar                       # por votos; --orden recientes|actividad, --estado nueva
node herramientas/foro.mjs ver 12                       # la sugerencia y todos sus comentarios
node herramientas/foro.mjs estado 12 hecha --juego honda
node herramientas/foro.mjs responder 12 "¡Ya está! …"   # respuesta oficial anclada
node herramientas/foro.mjs ocultar 12                   # o mostrar, ocultar-comentario, mostrar-comentario
```

## Cuentas de usuario

Son opcionales: se juega igual sin cuenta. La especificación completa está en `docs/PERFILES.md`, y el código, en `servidor/cuenta.js` (rutas `/api/cuenta/*`), `servidor/sesion.js`, `servidor/google.js`, `servidor/correo.js`, `shell/cuenta.js`, `entrar.html` y `cuenta.html`.

- **Entrar.** Con Google o con el correo. Al correo llega un enlace y un código de 6 cifras. Los dos caducan en 15 minutos y solo sirven una vez. El código sirve para entrar en un dispositivo distinto del que lee el correo, por ejemplo, en las gafas. No hay contraseñas. Si el correo coincide, Google y el enlace llevan a la misma cuenta.
- **La primera vez** se elige el alias, se escribe el año de nacimiento (hay que tener 14 años o más; si no, la cuenta se borra en el acto) y se aceptan el aviso legal y la privacidad.
- **Alias.** De 3 a 20 letras, números, `_` y `.`. Es único sin distinguir mayúsculas, tildes ni `_` y `.` (`Rafa`, `rafá` y `ra_fa` son el mismo). Hay alias reservados (VR Play, admin, moderador…) y una lista corta de palabras ofensivas. Se puede cambiar una vez cada 30 días, y el antiguo queda bloqueado 30 días.
- **Sesión.** Va en una cookie `HttpOnly`, `Secure` y `SameSite=Lax`, que dura 90 días y se renueva al usarla. En la base de datos solo se guarda su hash. Las peticiones que cambian algo solo se aceptan desde la propia web (cabecera `Origin`).
- **Lo del navegador pasa a la cuenta** al entrar: favoritos y «me gusta». Desde entonces, los «me gusta» son de la cuenta (el mismo en todos los dispositivos) y los favoritos se guardan en los dos sitios.
- **Foro.** Con cuenta, se firma con el alias y sale una ✔. Sin cuenta nadie puede firmar con el alias de otra persona. El alias y la ✔ enlazan a su perfil.
- **Buscar jugadores.** En el buscador de la portada, `@alias` busca cuentas en vez de juegos (`/api/perfiles?q=`). No distingue mayúsculas ni tildes, y salen primero las que empiezan así y las que tienen más ideas.
- **Perfil público** (`perfil.html#alias`, `/api/perfiles/:alias`): avatar, alias, fecha de alta, números (seguidores, seguidos, ideas, «me gusta» recibidos, comentarios), los juegos hechos a partir de sus ideas y sus ideas en marcha. Nunca sale el correo, el año de nacimiento, sus favoritos ni las sugerencias ocultas o descartadas. Las cuentas suspendidas no salen ni en el buscador ni en su perfil.
- **Tu perfil.** El botón de la cuenta de la cabecera lleva a tu perfil. Desde ahí se entra a los ajustes (`cuenta.html`). En tu perfil salen también tus juegos con «me gusta» y tus guardados, pero solo los ves tú: vienen de tu sesión, no del perfil público.
- **Seguir** (tabla `seguidores`, `POST /api/perfiles/:alias/seguir`). En un solo sentido, sin tener que aceptar. Como mucho, 50 al día y 1000 en total. Los números de seguidores y seguidos son públicos. Las listas (`perfil.html#alias/seguidores` y `/seguidos`) también, salvo que la cuenta las oculte en los ajustes. Las de los menores de 18 años están ocultas por defecto.
- **Pestaña «Seguidos»** de la portada (`/api/feed`): las ideas nuevas, los comentarios y las ideas convertidas en juego de los jugadores que sigues, de lo más reciente a lo más antiguo, y jugadores que puedes seguir. «Para ti» es el catálogo de siempre. La pestaña elegida se recuerda en el navegador.
- **«¡Crea tu juego!»**: el botón destacado de la cabecera y el de la portada llevan al formulario del foro (`foro.html#/nueva`).
- **«Mi cuenta»** (`cuenta.html`): cambiar el alias, otro avatar, avisos por correo, dispositivos con la sesión abierta, descargar todos los datos (JSON) y borrar la cuenta. Al borrarla, sus sugerencias y comentarios quedan como «Usuario eliminado».
- **Moderación.** En `admin.html`, pestaña «Usuarios»: buscar por alias o correo, forzar un alias, otro avatar y suspender (puede jugar, pero no publicar en el foro).
- **Tablas.** `usuarios`, `sesiones`, `enlaces_acceso`, `alias_bloqueados`, `favoritos` y `seguidores`, y la columna `usuario_id` en `sugerencias` y `comentarios`. El Worker las crea solas la primera vez (`servidor/bd.js`), así que no hay que ejecutar nada en la base de datos.

**Configuración en Cloudflare** (Settings → Variables and Secrets, como *Secret*):

- `RESEND_API_KEY`: la clave de [Resend](https://resend.com), con el dominio `vrplaygame.com` verificado. Los correos salen de `no-reply@vrplaygame.com`, y las respuestas van a `contact@vrplaygame.com`.
- `GOOGLE_CLIENT_ID` y `GOOGLE_CLIENT_SECRET`: el cliente OAuth de Google Cloud, con la dirección de vuelta `https://vrplaygame.com/api/cuenta/google`. Si faltan, no sale el botón de Google.

**Publicarlas.** `CUENTAS` en `wrangler.jsonc` (`vars`) decide si se ve el botón «Entrar». Con `"0"` solo lo ve quien abre la web con `?perfiles=1`, que se recuerda en ese navegador (`?perfiles=0` lo quita): sirve para probarlas en producción antes de enseñarlas. Para publicarlas, cambia el valor a `"1"` y súbelo a main. Quien ya ha entrado ve siempre su avatar.

**Aún no están hechos** (ver `docs/LANZAMIENTO.md`): récords en la cuenta y clasificaciones, récords e insignias en el perfil, «Idea de @alias», bloquear cuentas, avisos de nuevos seguidores, recomendaciones en «Para ti», y vincular las gafas desde el menú de pausa en VR (de momento, en las gafas se entra en `entrar.html` con el código del correo).

### Probar el foro en local

`python -m http.server` solo sirve archivos, así que el foro y las cuentas dirán que no están disponibles. Para probarlos con su API hace falta `wrangler` (las herramientas de Cloudflare). La base de datos local es una copia vacía en `.wrangler/`, y las claves de prueba van en un archivo `.dev.vars` (`ADMIN_TOKEN=...`, `RESEND_API_KEY=...`). Las dos cosas están en `.gitignore`. Las cookies de sesión necesitan HTTPS, pero los navegadores las aceptan también en `http://localhost`.

```
npx wrangler d1 execute vrplay-foro --local --file bd/esquema.sql
npx wrangler dev
```
