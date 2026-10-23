# Fábrica de vídeos de VR Play

Hace en local, gratis y sin publicar nada:

1. **El TikTok de cada juego** (vertical 9:16, 15-45 s, en español e inglés): un jugador automático juega una partida de verdad **en VR** (unas Quest 3 simuladas), y se graba a la vez lo que ven las gafas y un plano de espectador con un avatar. Se monta con un gancho de 3 s que no es el juego, voz en off, varios planos (gafas, espectador, pantalla partida, cámara lenta, zoom de golpe), subtítulos palabra a palabra, puntuación, música y «Juega gratis en vrplaygame.com».
2. **Tus partidas grabadas en las gafas**: una grabación con varios juegos seguidos se trocea por juegos y sale un TikTok por juego, con el mismo montaje que el punto 1 (es lo que mejor queda: el jugador automático no juega como una persona).
3. **Tus grabaciones en bruto, editadas**: quita silencios, muletillas y tomas repetidas, y saca clips verticales con subtítulos palabra a palabra.

Todo sale en `salida/` (no va a git) con su texto de publicación y hashtags, **para que lo revises y lo subas tú**.

Los comandos se lanzan desde la raíz del repositorio.

## Comandos

```bash
node herramientas/videos/fabrica.mjs comprobar                 # qué está instalado y qué falta
node herramientas/videos/fabrica.mjs juego topos               # un juego (o varios: juego topos fruta)
node herramientas/videos/fabrica.mjs juego --todos             # todos los publicados (--pruebas: también los de pruebas)
node herramientas/videos/fabrica.mjs juego --nuevos            # solo los que aún no tienen vídeo
node herramientas/videos/fabrica.mjs bruto partida.mp4 --solo-trocear   # partida en bruto → tramos para clasificar
node herramientas/videos/fabrica.mjs bruto partida.mp4                  # un TikTok por juego de la partida
node herramientas/videos/fabrica.mjs bruto partida.mp4 --juegos pingpong --estilo pro   # con la edición pro
node herramientas/videos/fabrica.mjs voz-prueba pingpong       # muestras de entonación para elegir la voz
node herramientas/videos/fabrica.mjs editar mi-grabacion.mp4   # vídeo en bruto → limpio + clips
```

Opciones:

- `--idioma es` o `--idioma en`: solo ese idioma (por defecto, los dos).
- `--sin-grabar` (en `juego`): vuelve a montar con la partida ya grabada, para retocar sin jugarla otra vez (por ejemplo, después de cambiar el guion).
- `--modo raton` (en `juego`): graba como en la web con ratón, sin VR ni plano de espectador. Por defecto es `vr`; los juegos que el jugador automático aún no sabe jugar en VR se graban con ratón solos.
- `--gancho web|persona|impacto|reto` (en `juego`): fuerza ese gancho. Si no, cada juego tiene siempre el mismo y van alternando por el orden del catálogo.
- `--sin-voz` (en `juego`): sin voz en off.
- `--voz kokoro` (en `juego`): la voz de Kokoro en vez de Chatterbox (más rápida, más robótica).
- `--nombre partida-1` (en `bruto`): el nombre de la carpeta de salida (por defecto, el del archivo). `--juegos pingpong,patos`: solo esos. En `bruto` el idioma por defecto es solo `es` y el gancho, `impacto`.
- `--estilo pro` (en `juego` y `bruto`): la edición «gaming viral» (ver «Edición pro»). Sale como `<id>-es-pro.mp4`, sin pisar el vídeo normal.
- `--clips clips.json` (en `editar`): los clips que quieres, en segundos del vídeo limpio: `[{"desde": 12.3, "hasta": 40.1}]`. Los tiempos de cada frase están en `transcripcion.txt`.
- `--encuadre 0.3` (en `editar`): qué parte de un vídeo horizontal se queda al recortarlo a vertical (0 = izquierda, 0.5 = centro, 1 = derecha).
- `--encajar` (en `editar`): no recorta; pone el vídeo entero en el centro sobre una copia difuminada (mejor para grabaciones de pantalla o de partidas).

Un juego tarda unos 4-5 minutos por idioma (graba hasta 75 s de partida, le pone voz y la monta).

## Qué sale

**`salida/juegos/<id>/`**

- `<id>-es.mp4`, `<id>-en.mp4`: los vídeos (voz, juego y música). También `-sin-musica` (voz y juego, para poner un sonido de moda en TikTok) y `-sin-voz` (juego y música).
- `publicacion-es.txt`, `publicacion-en.txt`: texto, enlace a la ficha del juego y hashtags.
- `revision-es.jpg`, `revision-en.jpg`: 6 fotogramas para ver de un vistazo el gancho y los planos.
- `informe.json`: duración, volumen, gancho, planos con sus tiempos, aciertos del jugador automático, puntuación y avisos.

## Guiones, voz y ganchos

- **Guion**: `guiones/<id>.json` (va a git), en ES y EN: `gancho` (la frase de los 3 primeros segundos), `frases` (4-6 frases cortas, cada una con su `plano`: `pov`, `espectador`, `partida`, `lenta` o `zoom`) y `cierre`. Cada frase es una escena que dura lo que tarda la voz en decirla; las largas se parten en dos planos. Si un juego no tiene guion, se hace uno con su descripción (y sale un aviso).
- **Voz**: Chatterbox Multilingual (Resemble AI, MIT), en local (`locutar_natural.py`), que suena natural. Después, Whisper la repasa (`repasar_voz.py`): si al final de una frase se ha inventado palabras, las corta, y avisa de las frases que no se entienden. Si Chatterbox no está instalado, o con `--voz kokoro`, sale con Kokoro (`locutar.py`: `ef_dora` en español y `af_heart` en inglés), que es más rápido pero más robótico. Para cambiar la voz de Chatterbox, pon un audio limpio de unos 10 s de la voz que quieras (con permiso de quien habla) en `medios/voces/es.wav` o `en.wav`. Mientras habla, el juego y la música bajan solos.
- **Ganchos** (`remotion/ganchos/`): `web` (se escribe vrplaygame.com en un navegador), `persona` (alguien con gafas, de `medios/personas/`, y corta a lo que ve), `impacto` (texto grande que entra de golpe sobre la portada que se rompe) y `reto` (cuenta atrás y la partida a cámara lenta que se congela antes del golpe; la respuesta es el plano siguiente).
- **Efectos de sonido**: `efectos/` (CC0, ver su `LEEME.md`).
- **Marcas del guion** (las usan las dos ediciones): `*palabra*` es la palabra clave (sale en grande y en color; el asterisco no se lee), `"enfasis": 0.4-1.0` en el gancho o en una frase cambia lo expresiva que la dice la voz, y `"golpe": true` hace que la frase caiga sobre un golpe de la partida.

## Edición pro (`--estilo pro`)

Montaje de estilo gaming viral (`lib/edicion.mjs` hace la línea de tiempo y `remotion/EdicionPro.jsx` la dibuja):

- **Ritmo**: planos de 0,6 a 1,5 s que cortan en los golpes de la música, con transiciones que van rotando (barrido con desenfoque, zoom, glitch y destello) y su whoosh.
- **Gancho** sin intro: empieza en el golpe más fuerte de la partida con el texto gigante.
- **Impactos**: en las frases con `golpe` la imagen se congela 5 fotogramas con destello, RGB separado, temblor, pegatina («¡ZAS!», «¡TOMA!»…, en `lib/textos.mjs`) y golpe grave.
- **Efectos por frase** (en el guion): `"efecto": "rampa"` (normal → cámara lenta interpolada con ffmpeg → rápida, sobre un golpe) o `"efecto": "rebobinado"` (congelado, hacia atrás al doble con aspecto VHS y otra vez con zoom). `"pegatina": "¡GOL!"` cambia la pegatina de esa frase.
- **Texto cinético**: 1-3 palabras a la vez con bote; la `*clave*` va sola, más grande, en naranja y con temblor.
- **Imagen**: color más vivo, viñeta, grano y light leaks.
- **Voz**: Chatterbox con más expresión y menos guía, 5 tomas por frase (se queda la más expresiva) y, al mezclar, compresión, más presencia y un poco más rápida y aguda (`AJUSTES_VOZ.pro` y `REPASO_PRO` en `lib/guion.mjs`). `node fabrica.mjs voz-prueba <id>` saca el gancho y dos frases con varios ajustes en `salida/pruebas-voz/<id>/` para comparar (`PRUEBAS_VOZ`).

**`salida/bruto/<nombre>/`** (partidas grabadas en las gafas)

Pasa la grabación a 30 fps constantes (las de las Quest van a frecuencia variable) y la trocea por los fundidos a negro y los cambios de escena. Mejor el archivo original de las gafas (1920×1080), no el que pasa por WhatsApp.

- `segmentos.json` y `segmentos.jpg` (una fila de 4 fotogramas por tramo): pon a cada tramo el `id` del juego (o `null` para saltarlo), ajusta `desde`/`hasta` para quitar menús, avisos y el marcador final, y `encuadre` (0 izquierda, 0,5 centro, 1 derecha) para el recorte vertical. Pon `"manual": true` para que no se vuelva a calcular. Los tramos de menos de 12 s se saltan.
- `<id>/<id>-es.mp4` (más `-sin-musica` y `-sin-voz`), `publicacion-es.txt`, `revision-es.jpg` e `informe.json`, como en `salida/juegos/`. El plano `pov` es la imagen recortada a vertical y `espectador`, la imagen entera sobre una copia difuminada. Los golpes (para el zoom y la cámara lenta) salen de los picos del sonido del juego.

**`salida/editados/<nombre>/`**

- `limpio.mp4`: la grabación entera sin silencios, muletillas ni tomas repetidas.
- `clip-1.mp4`, `clip-2.mp4`…: los clips verticales con subtítulos.
- `clip-N-publicacion-es.txt` y `-en.txt`: borradores (si el vídeo está en otro idioma, te pide traducir la frase).
- `subtitulos.srt` y `transcripcion.txt`: la transcripción del vídeo limpio, con tiempos.
- `cortes.json`: lo que se ha quitado y por qué. Para ajustarlo a mano, cambia `conservar`, pon `"manual": true` y vuelve a lanzar `editar`.

En la terminal sale una línea por vídeo, con ✓ o con ⚠ y los avisos (duración, tamaño, volumen, trozos en negro o congelados, pocos aciertos, partida sin puntuación).

## El jugador automático

Cada juego tiene su forma de jugar en `lib/estrategias.mjs`. En VR (`lib/bot-vr.js`) mueve la cabeza y los dos mandos de unas gafas simuladas con [IWER](https://github.com/meta-quest/immersive-web-emulation-runtime) y usa el campo `vr` de la estrategia (`golpear`, `seguir`, `barrer`); los juegos sin `vr` se graban con ratón (`lib/bot.js`):

| Modo | Qué hace | Juegos |
|---|---|---|
| `clic` | apunta y hace clic | topos, globos… |
| `seguir` | lleva el puntero a la bola | portero, pingpong… |
| `barrer` | corta deprisa a través de la fruta y esquiva las bombas | fruta |
| `mantener` | pulsa, espera y suelta | baloncesto, golf… |

Probados de verdad: **topos** y **fruta** (también en VR). Los de puzle o ritmo (simon, bomba, tambores…) están como `pendiente`, y `--todos` los salta avisando.

Si un juego sale con pocos aciertos, ajusta su línea en `lib/estrategias.mjs` (cadencia, rigidez, `reposo`…) y prueba con `juego <id> --idioma es`.

Para un juego nuevo no hay que tocar nada más: el título, los textos y la portada salen de `juegos/catalogo.js` e `idiomas/`. Si no tiene línea, se juega en modo `clic`.

## Instalación (una vez)

Todo es gratuito y en local.

1. **FFmpeg**: `winget install Gyan.FFmpeg`. La fábrica lo encuentra aunque no esté en el PATH.
2. **Remotion y Playwright**: `npm install` dentro de `herramientas/videos/`. Graba y monta con tu Google Chrome (o Edge).
3. **Whisper** (para `editar` y para repasar la voz) **y Kokoro** (la voz de reserva): en `herramientas/videos/` ejecuta
   ```bash
   py -3.12 -m venv .venv
   ```
   ```bash
   .venv/Scripts/python -m pip install faster-whisper nvidia-cublas-cu12 nvidia-cudnn-cu12
   ```
   ```bash
   .venv/Scripts/python -m pip install kokoro soundfile
   ```
   Los modelos (`large-v3-turbo`, ~1,6 GB, y Kokoro-82M, ~330 MB) se descargan solos la primera vez. Con la GPU NVIDIA va en segundos; sin ella, en la CPU (más lento). El español de Kokoro necesita espeak-ng, que viene con `kokoro`.

   **Voz natural (Chatterbox, opcional pero recomendada)**: va en otro entorno, `.venv-voz`, porque fija una versión de torch que no va con las GPU nuevas (RTX 50). Con [uv](https://docs.astral.sh/uv/):
   ```bash
   uv venv .venv-voz --python 3.12
   ```
   ```bash
   uv pip install --python .venv-voz/Scripts/python.exe torch torchaudio --index-url https://download.pytorch.org/whl/cu128
   ```
   ```bash
   uv pip install --python .venv-voz/Scripts/python.exe --no-deps chatterbox-tts==0.1.7
   ```
   ```bash
   uv pip install --python .venv-voz/Scripts/python.exe "transformers==5.2.0" "diffusers==0.29.0" "librosa==0.11.0" "numpy<2" "safetensors==0.5.3" "conformer==0.3.2" s3tokenizer resemble-perth pyloudnorm omegaconf pykakasi soundfile
   ```
   El modelo (`ResembleAI/chatterbox`, ~3 GB) se descarga solo la primera vez. Con la GPU tarda unos 15-20 s por vídeo; en la CPU, mucho más. Chatterbox marca su audio con una marca de agua inaudible (Perth) que indica que es voz generada.
4. **Música** (opcional): ver [`musica/LEEME.md`](musica/LEEME.md).
5. **Efectos y vídeos de los ganchos** (no van a git): ver [`efectos/LEEME.md`](efectos/LEEME.md) y [`medios/LEEME.md`](medios/LEEME.md).

Después, `node herramientas/videos/fabrica.mjs comprobar` tiene que salir todo con ✓.

## Archivos

- `fabrica.mjs`: los comandos.
- `lib/`:
  - `grabar.mjs`, `servidor.mjs`, `bot.js`, `bot-vr.js`, `espectador.js`: grabar una partida (en VR, también el plano de espectador con el avatar). El servidor local engancha la shell solo en la grabación; la web publicada no cambia.
  - `momentos.mjs`: los mejores momentos.
  - `guion.mjs`: el guion, la voz y la línea de tiempo de los planos.
  - `montar.mjs`: el TikTok y la mezcla de voz, juego y música.
  - `editar.mjs`: el editor.
  - `bruto.mjs`: trocear y montar una partida grabada en las gafas.
  - `textos.mjs`: ganchos, llamadas a jugar y hashtags en ES/EN.
  - `comprobar.mjs`: las comprobaciones.
- `remotion/`: el diseño de los vídeos (`AnuncioVR.jsx`, los ganchos en `ganchos/`, `ClipHablado.jsx`; `TikTokJuego.jsx` es el diseño anterior, del que se reutilizan el título, la puntuación y el cierre).
- `guiones/`: un guion por juego.
- `transcribir.py`: Whisper. `locutar_natural.py`: Chatterbox (la voz), y `repasar_voz.py` la revisa con Whisper. `locutar.py`: Kokoro (la voz de reserva).
- `trabajo/`: archivos intermedios. Se puede borrar entera.
