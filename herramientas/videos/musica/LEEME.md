# Música de los vídeos

Pon aquí pistas **sin derechos** (`.mp3`, `.ogg`, `.wav` o `.m4a`). La fábrica elige una por juego (siempre la misma para el mismo juego), la pone por debajo del sonido del juego, la baja sola en cada golpe y la apaga al final. Si no hay ninguna, los vídeos salen solo con el sonido del juego.

Con música, cada vídeo sale además en versión `-sin-musica`, por si en TikTok prefieres ponerle un sonido de moda (ayuda al alcance).

Los archivos de audio **no van a git** (`.gitignore`): apunta aquí de dónde sale cada uno y su licencia.

## Solo música con licencia que lo permita

- **CC0 / dominio público** (sin atribución): lo más cómodo.
- **CC BY**: vale, pero hay que poner el crédito en el texto de cada publicación.
- Nada con «NC» (no comercial) ni «ND», ni música de TikTok descargada.

Fuentes CC0 de confianza: [OpenGameArt](https://opengameart.org) (filtra por licencia CC0, tipo «Music») y los packs de [Kenney](https://kenney.nl/assets/category:Audio).

## Pistas que hay

| Archivo | Título y autor | Origen | Licencia |
|---|---|---|---|
| `junkala-nivel-1.mp3` | «Level 1», Juhani Junkala | [5 Chiptunes (Action)](https://opengameart.org/content/5-chiptunes-action), OpenGameArt | CC0 |
| `junkala-nivel-2.mp3` | «Level 2», Juhani Junkala | ídem | CC0 |
| `junkala-nivel-3.mp3` | «Level 3», Juhani Junkala | ídem | CC0 |
| `junkala-final.mp3` | «Ending», Juhani Junkala | ídem | CC0 |

Del mismo pack se ha dejado fuera «Title Screen» (11 s: en un vídeo de 30 s se nota que se repite). Para volver a tenerlas: descarga el .zip de la página de arriba y pasa los WAV a MP3 con `ffmpeg -i "… Level 1.wav" -q:a 2 junkala-nivel-1.mp3`.
