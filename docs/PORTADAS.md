# Estándar de portadas de los juegos

Cada juego tiene su portada en `juegos/<id>/miniatura.svg`. Sale en el catálogo, en el muro de la
portada, en los perfiles y en la clasificación, siempre en cuadrado y casi siempre pequeña (de 110 a
220 px). Todas juntas tienen que parecer **una familia**: el mismo estilo, la misma luz y la misma firma
de color, aunque cada juego tenga su ambiente.

Está hecho siguiendo la skill `create-game-assets` (dirección de arte, una portada de muestra aprobada y
luego la familia). La **portada de muestra** con la que se comparan las demás es la de Corta Fruta
(`juegos/fruta/miniatura.svg`). Una portada nueva se coloca a su lado y tiene que parecer del mismo juego
de cartas.

`node herramientas/calidad.mjs` comprueba lo técnico (tamaño, peso, nada prohibido, viñeta y coral).
Lo demás se revisa a ojo, con la portada a 400, 200 y 110 px junto a las otras.

## Dirección de arte

| Eje | Regla |
|---|---|
| **Protagonista** | Lo que se coge o a lo que se apunta (la katana y la fruta, el martillo y el topo, los guantes y el balón). Grande: entre el 55 y el 65 % del cuadro. Mejor en diagonal que recto. |
| **Momento** | Siempre el instante de la acción: el corte, el golpe, la parada, el pleno. No el objeto quieto. |
| **Forma** | Formas redondeadas y limpias, sin contornos. Siluetas que se reconocen en negro a 110 px. |
| **Volumen** | Cada objeto con tres valores: base, sombra y brillo. Degradados de arriba a la izquierda (claro) a abajo a la derecha (oscuro) y una elipse blanca suave de brillo. |
| **Luz** | Siempre desde arriba a la izquierda. Un **foco** (degradado radial claro) detrás del protagonista y una **sombra de contacto** (elipse oscura difuminada) debajo de lo que toca el suelo. |
| **Fondo** | El ambiente del juego (cielo, pabellón, feria, espacio…) en dos o tres planos sencillos: cielo o pared, horizonte (montes, gradas, muralla) y suelo. Más apagado que el protagonista. |
| **Color** | Cada juego con la paleta de su escenario. **El coral de la marca `#ff6a3d` solo para la acción**: estelas, chispas, impactos, trayectorias. Es la firma común de todas. Sin negro puro (`#05060a` como mucho). |
| **Acción** | Una estela, trayectoria o estallido coral que diga qué se hace en el juego (cortar, golpear, lanzar, esquivar). |
| **Viñeta** | Un degradado radial que oscurece los bordes (`id="vineta"`, del 0 % al 50-60 %). Une la familia y centra la mirada. |
| **Detalle** | Como mucho tres focos de atención. Nada de detalles de menos de 3 px (a 110 px desaparecen). |

**Prohibido**: textos y números, logotipos, estrellas o pegatinas de adorno, contornos negros, imágenes
incrustadas, filtros (`<filter>`, desenfoques), enlaces y scripts.

## Formato técnico

- SVG con `viewBox="0 0 400 400"`, sin `width`/`height` fijos (la página lo escala).
- **Máximo 16 KB** (en el móvil se dibujan muchas a la vez). Las de ahora pesan entre 3 y 5,5 KB.
- Solo formas y degradados (`linearGradient`, `radialGradient`, `clipPath`, `pattern` sencillo).
- Los `id` de los degradados se pueden repetir entre portadas: cada SVG se carga como imagen aparte.
- Colores en hexadecimal; el coral siempre `#ff6a3d`.

## Esqueleto

Toda portada empieza con esta estructura (en este orden de capas):

```svg
<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 400 400">
  <defs>
    <linearGradient id="fondo" x1="0" y1="0" x2="0" y2="1">…</linearGradient>   <!-- cielo o pared -->
    <radialGradient id="foco" cx="0.5" cy="0.45" r="0.5">                        <!-- luz detrás del protagonista -->
      <stop offset="0" stop-color="#fff1d6" stop-opacity="0.5"/>
      <stop offset="1" stop-color="#fff1d6" stop-opacity="0"/>
    </radialGradient>
    <radialGradient id="sombra">…</radialGradient>                                <!-- sombra de contacto -->
    <radialGradient id="vineta" cx="0.5" cy="0.45" r="0.75">
      <stop offset="0.62" stop-color="#05060a" stop-opacity="0"/>
      <stop offset="1" stop-color="#05060a" stop-opacity="0.6"/>
    </radialGradient>
  </defs>
  <rect width="400" height="400" fill="url(#fondo)"/>   <!-- 1. fondo -->
  …                                                      <!-- 2. horizonte y suelo -->
  <rect width="400" height="400" fill="url(#foco)"/>    <!-- 3. foco -->
  …                                                      <!-- 4. sombra, acción coral y protagonista -->
  <rect width="400" height="400" fill="url(#vineta)"/>  <!-- 5. viñeta, siempre la última -->
</svg>
```

## Antes de darla por buena

1. `node herramientas/calidad.mjs <id> --avisos` sin errores ni avisos de portada.
2. Verla a **400, 200 y 110 px** sobre el fondo de la web (`#0a0b10`): a 110 px se tiene que saber de qué
   juego es sin leer el título.
3. Verla **junto a las demás** en la cuadrícula del catálogo: misma luz, misma viñeta, mismo tamaño de
   protagonista. Si destaca por ser de otro estilo (más plana, más recargada, otra luz), no vale.
4. Que el protagonista coincida con lo que se ve en el juego (el mismo objeto en la mano, los mismos colores).
