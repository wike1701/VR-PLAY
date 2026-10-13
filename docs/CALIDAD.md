# Estándar de calidad de los juegos

Lo que tiene que cumplir **todo** juego de VR Play, el de hoy y los que se hagan después (también los
que haga la rutina diaria a partir del foro). Sale de las skills del proyecto: `game-feel` (sensación de
juego), `game-ui-ux` (marcadores y avisos) y las de three.js (rendimiento), adaptadas a la realidad
virtual en el navegador del Meta Quest.

Se comprueba con:

```
node herramientas/calidad.mjs            # errores (bloquean); --avisos para ver también lo mejorable
node herramientas/marcadores.mjs         # clasificación
node herramientas/idiomas.mjs            # textos en los 9 idiomas
```

y, en el navegador, con `vrPlay.dibujado()` en la consola durante una partida.

## 1. Rendimiento (el Quest tiene que ir a 72 fps sin tirones)

| Medida | Límite | Ideal |
|---|---|---|
| Llamadas de dibujo (`vrPlay.dibujado().calls`) | **100** | menos de 50 |
| Triángulos (`.triangles`) | **60.000** | menos de 25.000 |
| Texturas generadas | 512 px | 256 px si es un detalle |
| Materiales `MeshStandardMaterial` | 6 | solo los protagonistas pequeños |

- **Cada malla se dibuja dos veces en VR** (una por ojo). Muchos objetos iguales → `InstancedMesh` o una
  geometría fusionada. El decorado quieto, fusionado en pocas mallas.
- **Nada de sombras reales** (`castShadow`), luces nuevas (`PointLight`, `SpotLight`), postprocesado ni
  superficies grandes transparentes una encima de otra. Para lo que brilla: `emissive` o `MeshBasicMaterial`.
  Para las sombras: `ctx.crearSombra()`.
- **Nada de crear objetos mientras se juega.** Ni `new THREE.Vector3()` en `actualizar` ni mallas nuevas en
  cada acierto: se crean al empezar y se reutilizan (vectores auxiliares, bolsas de objetos). Crear basura en
  cada fotograma hace que el Quest pare a limpiar memoria y se nota como un tirón.
- **Todo dentro de `ctx.raiz`** o en las manos con `ctx.adjuntarAMano`, y lo compartido registrado con
  `ctx.recurso()`: así la shell lo libera todo al cambiar de juego.
- **Sin `setTimeout`, `setInterval` ni `addEventListener`**: el tiempo sale de `actualizar(dt, t)`.
- La shell **compila los materiales al montar el juego** (con la pantalla en negro), así que no hace falta
  nada más para evitar los tirones del primer segundo.

## 2. Sensación de juego (cada acción importante se siente)

Un buen acierto no es un sonido suelto: son **varias respuestas pequeñas a la vez** que duran muy poco y
vuelven al reposo. La shell las da hechas en `ctx.efectos`:

```js
ctx.efectos.impacto('medio', { pos: punto, mano, color: 0xffd54f, sonido: 'golpe' });
ctx.efectos.texto(punto, '+3', { color: '#ffd54f' });
ctx.efectos.estallido(punto, { color: 0xff4060, cantidad: 12 });
```

| Nivel | Cuándo | Qué hace |
|---|---|---|
| `pequeño` | Tocar, rozar, coger algo, un acierto normal y repetido | Vibración suave, unas pocas partículas |
| `medio` | Un acierto bueno: punto, diana, golpe limpio | Vibración, partículas, micro-pausa de 35 ms, sacudida leve (solo ratón) |
| `grande` | Lo excepcional: pleno, récord, eliminar al jefe, perder una vida | Vibración fuerte, explosión de partículas, micro-pausa de 80 ms, sacudida (solo ratón) |

Reglas:

- **Todo lo que da puntos** lleva `impacto` (al menos `pequeño`) y, si suma puntos, `texto` con lo que suma.
- **Proporción**: lo normal es `pequeño`; `grande` solo para lo excepcional. Si todo es grande, nada lo parece.
- **En VR la cámara nunca se mueve sola** (marea): la sacudida solo existe con ratón; en VR la cambia la vibración.
  Con el sistema en «reducir movimiento» no hay sacudida ni micro-pausa.
- **Fallar también se siente**, pero distinto: sonido `fallo`, vibración corta y sin partículas de celebración.
- **Movimiento con curva, nunca lineal**: lo que aparece, rebota un poco al llegar (sobrepaso); lo que se va,
  frena al final.
- **Respuesta inmediata**: el efecto sale en el mismo fotograma de la acción. Nada de esperar a la física.

## 3. Marcadores y textos en pantalla (de `game-ui-ux`)

- **Un panel de marcador** con la puntuación grande y, debajo y más pequeño, la información secundaria
  (tiempo, vidas, récord). Con `ctx.crearPanel()`, que ya usa la tipografía y los colores de la web.
- **Que no tape el juego**: arriba o a un lado, nunca entre el jugador y lo que tiene que mirar.
- **Legible en VR**: a 1–3 m del jugador, texto de al menos 5 cm de alto, y de cara al jugador.
- **Al empezar**: el título del juego y una sola frase de cómo se juega (en VR y con ratón, distinta si hace falta).
- **Al terminar**: el resultado grande, el récord y que la nueva partida empieza sola en unos segundos.
- **Todos los textos con `ctx.t()`** (en los 9 idiomas); nada de texto a mano.

## 4. Aspecto (de las skills de three.js y el README)

- Suelo y superficies grandes **con textura generada** (`ctx.texturas.*`), no colores planos.
- Cielo con `ctx.fondo(color)` (la shell pone luz y reflejos a juego) y un decorado que dé sensación de lugar
  (una feria, una playa, una bolera…), aunque sea con pocas piezas.
- `MeshLambertMaterial` para casi todo y `MeshStandardMaterial` para los protagonistas pequeños (bolas, armas,
  frutas), que así brillan con los reflejos de la shell.
- Sombras de mancha bajo todo lo que se mueve o flota.

## 5. Antes de subir un juego

1. `node herramientas/calidad.mjs` sin errores (y revisar `--avisos`).
2. `node herramientas/marcadores.mjs` y `node herramientas/idiomas.mjs` correctos.
3. Una partida en el navegador: `vrPlay.dibujado()` dentro de los límites de la tabla de arriba.
4. Una partida con ratón y otra simulando VR, sin errores en la consola.
5. Decir claramente lo que no se ha probado con las gafas.
