# Estándar de calidad de los juegos

Lo que tiene que cumplir **todo** juego de VR Play, el de hoy y los que se hagan después (también los
que haga la rutina diaria a partir del foro). Sale de las skills del proyecto: `game-feel` (sensación de
juego), `game-ui-ux` (marcadores y avisos) y las de three.js (rendimiento), adaptadas a la realidad
virtual en el navegador del Meta Quest, y de `threejs-aaa-graphics-builder` (gráficos). Las portadas
tienen su propio estándar en [`docs/PORTADAS.md`](PORTADAS.md).

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

## 4. Aspecto (de `threejs-aaa-graphics-builder` y las skills de three.js)

La regla de la skill: **primero las formas, luego los materiales, luego la luz y al final los efectos**.
El brillo, la niebla o las partículas no tapan una forma pobre.

### Lo que pone la shell (no hay que hacerlo en cada juego)

- **Luz**: un sol de lado y desde arriba que marca el volumen y una luz de relleno suave del color del cielo.
  Tone mapping ACES y reflejos generados a partir del cielo para los `MeshStandardMaterial`.
- **Cielo** con degradado, **nubes** de día (automáticas) y, si se piden, **estrellas** y **luna**.
- Todo esto sin llamadas de dibujo extra: el cielo es una esfera con una textura pequeña.

### El kit de paisaje (`shell/paisaje.js`), para que ningún escenario quede vacío

```js
// Cielo, niebla y horizonte lejano en una llamada (la shell lo restaura al salir del juego)
ctx.fondo(0x8ec9f0, {
  nubes: 0.5,                 // 0 = despejado, 1 = muy nublado (de día hay 0.45 si no se dice)
  estrellas: 0.8, luna: true, // de noche, solo si el juego está al aire libre
  sol: [0.5, 0.35, -0.8],     // dirección del sol o de la luna (para que se vea en el cuadro)
  niebla: [25, 70],           // de dónde a dónde (por defecto 7-16 m). Nunca ctx.escena.fog a mano.
  paisaje: { tipo: 'montes', color: 0x48685a, radio: 70 }, // montes, colinas, dunas, bosque o ciudad
});
// Árboles: todos los de un juego en 3 llamadas de dibujo (troncos, copas y sombras), con tamaños,
// giros y tonos distintos. Tipos: pino, frondoso, palmera.
raiz.add(ctx.arboles([{ x: 4, z: -9, escala: 1.2 }, [6, -12]], { tipo: 'pino' }));
// Si el juego mueve sus propias instancias (árboles que pasan a los lados), las geometrías del kit:
const { copa, tronco } = ctx.geometriaArbol('frondoso');
// Si el mundo gira alrededor del jugador (coches), el cielo y el horizonte giran con él:
ctx.orientarFondo(-rumbo);
```

### Reglas

- **Lugar, no vacío**: cada juego tiene un sitio reconocible (dojo, feria, estadio, playa, castillo…) en
  tres planos: lo que se toca, lo de alrededor y el fondo lejano (`paisaje`, gradas, paredes). Al aire
  libre, siempre `paisaje` y nubes o estrellas; en interiores, paredes con textura y alguna pieza que
  cuente dónde estás (póster, lámpara, gradas).
- **Suelo y superficies grandes con textura** generada (`ctx.texturas.*`), no colores planos.
- **Los objetos de las manos son protagonistas**: en VR se ven a 30 cm. Nada de cajas y cilindros sueltos:
  silueta de verdad (perfil torneado con `LatheGeometry`, hoja con `ExtrudeGeometry`, dedos con
  `CapsuleGeometry`), dos o tres materiales que se distingan por brillo (metal, madera, goma) y algún detalle
  funcional (empuñadura con textura, guarda, gatillo, cordón). Ejemplos: la katana de Corta Fruta, el bate de
  Batea Bolas, los guantes de Para Penaltis, la pistola de la Galería de Tiro.
- **Que se lea en juego**: lo importante (fruta, blancos, la hoja de la espada) destaca del fondo por forma
  y por brillo, no solo por color. De noche, un `emissive` suave del color de la mano.
- **Materiales por papel**: `MeshStandardMaterial` (con brillo y reflejos) para los protagonistas pequeños;
  `MeshPhongMaterial` (brillo barato) para lo brillante que **ocupa mucha pantalla** (la carrocería y el capó
  de los coches, que se ven desde dentro); `MeshLambertMaterial` con `flatShading` para vegetación y decorado;
  `MeshBasicMaterial` con `toneMapped: false` para lo que brilla (bombillas, luna, neones). Medido: un capó
  con `MeshStandardMaterial` llenando media pantalla costaba más que todo el resto del decorado nuevo.
- **Sombras de mancha** bajo todo lo que se mueve o flota (`ctx.crearSombra`); los árboles del kit ya las llevan.

### Puntuación gráfica (hoja de `threejs-aaa-graphics-builder`)

Antes de dar un juego por terminado, puntúa sus capturas en partida de 0 a 3 (0 provisional, 1 básico,
2 cuidado, 3 de escaparate): dirección de arte, protagonista, obstáculos o rivales, objetos que se usan,
escenario, materiales, luz, efectos, marcador y rendimiento. **El mínimo es 2 en todo**. Fallos que lo
suspenden de golpe: un protagonista que es una caja o un cilindro con brillo, un escenario vacío sin
justificar, la niebla o la oscuridad tapando que falta decorado, o no haber medido el rendimiento.

## 5. Antes de subir un juego

1. `node herramientas/calidad.mjs` sin errores (y revisar `--avisos`, que también revisan la portada).
2. `node herramientas/marcadores.mjs` y `node herramientas/idiomas.mjs` correctos.
3. Una partida en el navegador: `vrPlay.dibujado()` dentro de los límites de la tabla de arriba.
4. Una partida con ratón y otra simulando VR, sin errores en la consola. En la de VR, mirar **de cerca**
   lo que se lleva en las manos (con los mandos delante de la cara): es lo que más se ve en las gafas.
5. Una captura en partida puntuada con la hoja del apartado 4 (mínimo 2 en todo).
6. La portada según [`docs/PORTADAS.md`](PORTADAS.md), vista junto a las demás.
7. Decir claramente lo que no se ha probado con las gafas.
