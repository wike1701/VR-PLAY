# Jugadas a medida

Cuando los modos generales del bot (`golpear`, `barrer`, `seguir`, `lanzar` en VR; `clic`, `seguir`,
`barrer`, `mantener` con ratón, en `lib/estrategias.mjs`) no saben jugar bien un juego, se le escribe
aquí su jugada: `lib/jugadas/<id>.js`. `lib/grabar.mjs` la carga sola en la página si existe y los bots
(`lib/bot-vr.js` y `lib/bot.js`) la llaman en cada fotograma en lugar de su modo.

El archivo es un script de página (no un módulo) que define `window.__jugada`:

```js
// Jugada de <juego>: qué hace y por qué
window.__jugada = {
  // Gafas simuladas: se llama en cada fotograma (ahora en ms, dt en s)
  vr(api, ahora, dt) {
    const [izq, der] = api.manos;
    der.meta.set(0.2, 1.2, -0.5);   // a dónde va la punta de la herramienta (el muelle la lleva)
    der.gatillo = 1;                 // 0 o 1 (coger, disparar)
    der.rigidez = 400;               // opcional: lo rápido que va la mano (por defecto cfg.rigidez o 160)
    api.cabeza.mira.set(0, 1.2, -1); // opcional: a dónde mira (si no, sigue a la acción)
  },
  // Ratón: se llama en cada fotograma
  raton(api, ahora, dt) {
    api.mover(api.W / 2, api.H * 0.5, dt, 200); // lleva el puntero con un muelle (rigidez)
    // api.clic(), api.pulsar(), api.soltar(); api.p tiene { x, y, vx, vy, pulsado }
  },
};
```

Con una sola de las dos funciones basta: el modo que falte usa el general de `estrategias.mjs`.

## Qué hay en `api`

Común:

- `fab`: `window.__fabrica` (`escena`, `camara`, `renderer`, `manos`, `eventos`).
- `THREE`: las clases de three.js (`THREE.Vector3`…).
- `raiz()`: el grupo del juego en la escena (`juego-<id>`).
- `buscar(filtro)`: las mallas visibles del juego que cumplen `filtro(malla)`, como `[{ malla, p }]`
  (`p`, su posición en el mundo). Sirve para encontrar la bola, las dianas, los botones…, por
  geometría, color, tamaño o `userData`, mirando el `juego.js`.
- `candidatos()`: lo que vería el modo general (objetos pequeños que se mueven).
- `cfg`: la estrategia del juego (`lib/estrategias.mjs`), con su campo `vr` en VR.
- `bot`: `window.__bot` (`clics` cuenta los golpes o clics para el informe).

En VR:

- `manos`: `[izquierda, derecha]`, cada una con `meta` (Vector3, a dónde va la punta), `punta` (dónde
  está), `vel`, `gatillo`, `rigidez`, `reposo` (Vector3), `estado` y `signo` (-1 izquierda, 1 derecha).
  La «punta» es el extremo de lo que lleva el mando (martillo, raqueta, espada) o la propia mano.
- `cabeza`: `{ pos, mira }` (Vector3). La cabeza está a `ALTURA` (1,6 m) y mira hacia -Z.
- `V3`, `Quat`: Vector3 y Quaternion.

Con ratón:

- `p`: el puntero `{ x, y, vx, vy, pulsado }` en píxeles; `W`, `H`: el tamaño de la pantalla.
- `mover(x, y, dt, rigidez)`, `clic()`, `pulsar()`, `soltar()`.
- `aPantalla(vector3)`: `{ x, y, delante }`, dónde se ve un punto del mundo.

## Probar

```bash
node herramientas/videos/fabrica.mjs probar-bot <id> --segundos 12            # en VR
node herramientas/videos/fabrica.mjs probar-bot <id> --modo raton --segundos 12
```

Graba a media resolución con el reloj virtual (~1-2 min) y deja `trabajo/pruebas/<id>-<modo>/hoja.jpg`
(arriba las gafas, abajo el espectador) y `resumen.json` (impactos, clics, puntuación, errores).
Una buena jugada: golpes desde los primeros segundos, muchos impactos, movimientos de brazo
naturales (sin saltos) y que la partida no se pierda enseguida. Cuando esté bien, pon
`probado: true` en su línea de `lib/estrategias.mjs`.
