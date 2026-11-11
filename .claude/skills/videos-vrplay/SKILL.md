---
name: videos-vrplay
description: Hacer, revisar y publicar los vídeos verticales (TikTok, Reels, Shorts) de VR Play con la fábrica de herramientas/videos. Úsala cuando pidan un vídeo, TikTok, anuncio, reel o short de la web o de un juego, el lote de vídeos de la semana, ideas de vídeos, que el bot juegue mejor a un juego en los vídeos, o subir/publicar vídeos en redes.
---

# Vídeos de VR Play

La fábrica está en `herramientas/videos/` y su guía completa es `herramientas/videos/GUIA.md`
(léela por partes si hace falta: comandos, instalación, guiones, bots). Todo es gratis y local;
la fábrica **nunca publica**: deja los vídeos en `herramientas/videos/salida/`.

## 1. Qué vídeo hacer

| Te piden… | Comando (desde la raíz) |
|---|---|
| El TikTok de un juego | `node herramientas/videos/fabrica.mjs juego <id>` (`--estilo pro` para la edición viral) |
| Los de los juegos que aún no tienen | `node herramientas/videos/fabrica.mjs juego --nuevos` |
| Un anuncio de la web | `node herramientas/videos/fabrica.mjs formato anuncio` |
| Ranking, reto de récord, duelo, «lo pediste en el foro» | `formato top` · `formato reto <id>` · `formato duelo <id> <id>` · `formato foro [<id>]` |
| «Los vídeos de esta semana» | `node herramientas/videos/fabrica.mjs lote` (y su `PARRILLA.md`) |
| Montar una grabación de las gafas | `bruto <archivo>` · un vídeo hablado: `editar <archivo>` |

Idiomas: `--idioma es` · `es,en,fr` · `todos` (los 9 de la web). Por defecto, es y en.
Sin GPU (la nube): graba con el reloj virtual solo; cada segundo de partida cuesta ~20-25 s y un
formato tarda ~10-20 min. `--sin-voz` si no está instalada la voz (`fabrica.mjs comprobar`).

## 2. Ideas propias

No esperes a que te lo den todo hecho: si piden «vídeos» sin más, propón 3-5 ideas concretas y
hazlas. Lo que funciona en vídeos cortos de juegos:

- **Gancho en el primer segundo**: texto grande que plantea una tensión (pregunta, reto, algo
  inesperado: «¿Juegos de VR sin descargar nada?», «El récord está en 58. ¿Lo superas?»), sobre la
  imagen más espectacular de la partida, nunca sobre un menú o un logo.
- **Ritmo**: un corte cada 0,6-1,5 s al ritmo de la música, alternando la vista de las gafas y el
  espectador con avatar (se ve que es VR de verdad).
- **Datos reales**: récords (`/api/clasificacion/<id>`), partidas jugadas (`/api/juegos/estadisticas`)
  y el foro (`/api/sugerencias`) dan ganchos creíbles. No enseñes alias ni autores: solo valores
  y títulos.
- **Pide una acción**: comentar (1 o 2, su récord), entrar en la clasificación o pedir un juego en el
  foro. Cierre siempre con vrplaygame.com.
- Nuevas ideas de formato van en `lib/formatos.mjs` (el plan) y `remotion/Formatos.jsx` (el
  dibujo); sus textos en `lib/textos-formatos.mjs`, en los 9 idiomas. Usa la skill `remotion-markup`
  para el código de Remotion.

## 3. Revisar antes de dar un vídeo por bueno

1. La línea de la terminal de cada vídeo: ✓ o ⚠ con avisos (duración, volumen, trozos negros o
   congelados, pocos aciertos).
2. Mira la hoja `revision-<idioma>.jpg` de su carpeta (6 fotogramas, ya pequeña). Una sola vez.
3. Si el bot juega mal (pocos aciertos, brazos raros): `fabrica.mjs probar-bot <id>` (1-2 min) y
   ajusta su línea de `lib/estrategias.mjs` o su jugada en `lib/jugadas/<id>.js`
   (`lib/jugadas/LEEME.md`).

## 4. Tendencias (vidIQ, opcional)

Con el conector de vidIQ (plan gratuito: 150 créditos al mes) se pueden buscar los vídeos de TikTok
e Instagram que más funcionan en el nicho (`vidiq_instagram_tiktok_outlier_search`, 5 créditos)
para copiar estructuras de gancho. Di el coste antes de gastar créditos.

## 5. Publicar (solo con permiso explícito)

Publicar es irreversible y sale a nombre del usuario:

1. `vidiq_social_account_list`. Si no hay cuentas, dile que conecte TikTok, Instagram o YouTube en
   vidIQ (o TikTok en Higgsfield) y para.
2. Prepara el borrador (`vidiq_social_post_draft_create`) con el texto de
   `publicacion-<idioma>.txt` y enséñaselo: vídeo, texto, cuenta y hora.
3. Solo cuando diga que sí a ese borrador: `vidiq_social_post_publish`. Publicar en TikTok,
   Instagram y YouTube no gasta créditos (en X sí).
4. La música de moda de TikTok (biblioteca comercial) se elige al publicar; por eso cada vídeo de
   juego sale también `-sin-musica`.

Nunca publiques un vídeo que no has revisado ni uno que el usuario no ha aprobado.
