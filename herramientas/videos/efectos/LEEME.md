# Efectos de sonido de los vídeos

Los usan los ganchos de `remotion/ganchos/`. Los `.ogg` no van a git: si faltan, vuelve a bajar los packs y copia estos archivos con el mismo nombre.

| Archivo | Para qué | Origen |
|---|---|---|
| `golpe.ogg` | golpe del texto de impacto | Kenney, Impact Sounds: `impactPunch_heavy_000.ogg` |
| `golpe-metal.ogg` | golpe seco (fin de la cuenta atrás) | Kenney, Impact Sounds: `impactMetal_heavy_001.ogg` |
| `cristal.ogg` | la portada que se rompe | Kenney, Impact Sounds: `impactGlass_heavy_000.ogg` |
| `tecla.ogg` | cada letra que se escribe | Kenney, Interface Sounds: `switch_002.ogg` |
| `intro.ogg` | la tecla Intro | Kenney, Interface Sounds: `confirmation_001.ogg` |
| `tic.ogg` | cada número de la cuenta atrás | Kenney, Interface Sounds: `tick_001.ogg` |
| `glitch.ogg` | el flash del corte | Kenney, Interface Sounds: `glitch_001.ogg` |
| `aparecer.ogg` | algo que entra en pantalla | Kenney, Interface Sounds: `maximize_006.ogg` |
| `whoosh.ogg` | transiciones | Hecho en local con FFmpeg (ruido rosa filtrado), sin licencia de terceros |

Packs (bajados el 23-10-2026):

- Impact Sounds 1.0: https://kenney.nl/assets/impact-sounds
- Interface Sounds: https://kenney.nl/assets/interface-sounds

Licencia: **Creative Commons Zero (CC0)**, http://creativecommons.org/publicdomain/zero/1.0/. Se pueden usar en proyectos comerciales y no hace falta citar a Kenney (se agradece, pero no es obligatorio).

`whoosh.ogg` se rehace con:

```bash
ffmpeg -f lavfi -i "anoisesrc=c=pink:d=0.55:a=0.6" -af "bandpass=f=1400:width_type=o:w=2.5,afade=t=in:d=0.35:curve=exp,afade=t=out:st=0.35:d=0.2,volume=3" -ar 44100 -c:a libvorbis whoosh.ogg
```
