"""Pone voz a las frases de un guion con Kokoro y deja un WAV por frase.

Uso: python locutar.py <frases.json> <carpeta de salida> [--voz ef_dora] [--velocidad 1.0]

<frases.json> es {"idioma": "es"|"en", "frases": ["texto", …]}. En la carpeta deja frase-01.wav,
frase-02.wav… (24 kHz, mono, 16 bits) y voz.json con el texto, el archivo y la duración de cada uno.
Después, transcribir.py saca los tiempos de cada palabra (para los subtítulos palabra a palabra).
Voces: ef_dora en español y af_heart en inglés. Va en la GPU (CUDA) y, si no puede, en la CPU: con
82M de parámetros, la CPU también va sobrada para un guion. El español necesita espeak-ng: lo trae
el paquete espeakng-loader, que se instala con kokoro.
"""
import argparse
import json
import os
import re
import sys
import warnings

os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")  # Windows sin modo desarrollador
warnings.filterwarnings("ignore", category=UserWarning)  # avisos de torch (dropout, weight_norm)
warnings.filterwarnings("ignore", category=FutureWarning)

import numpy as np  # noqa: E402
import soundfile as sf  # noqa: E402
import torch  # noqa: E402
from kokoro import KPipeline  # noqa: E402

MUESTREO = 24000
# Código de idioma de Kokoro y voz por defecto
IDIOMAS = {"es": ("e", "ef_dora"), "en": ("a", "af_heart")}
SILENCIO = 0.12  # segundos que se dejan al final de cada frase para que no corte en seco
# Cómo se dice lo que Kokoro lee mal (solo cambia el audio, no el texto del guion).
# En español, «VR Play» sale «uve erre plai»
PRONUNCIACION = {"es": [(re.compile(r"\bVR Play\b"), "uve erre plei"), (re.compile(r"\bVR\b"), "uve erre")]}


def cargar(idioma, dispositivo):
    codigo = IDIOMAS[idioma][0]
    return KPipeline(lang_code=codigo, repo_id="hexgrad/Kokoro-82M", device=dispositivo)


def locutar(tuberia, texto, voz, velocidad, idioma):
    """Kokoro parte el texto largo en trozos: se juntan en un solo audio."""
    for patron, dicho in PRONUNCIACION.get(idioma, []):
        texto = patron.sub(dicho, texto)
    trozos = [r.audio.detach().cpu().numpy() for r in tuberia(texto, voice=voz, speed=velocidad) if r.audio is not None]
    if not trozos:
        raise ValueError(f"Kokoro no ha generado audio para: {texto!r}")
    return np.concatenate(trozos + [np.zeros(int(MUESTREO * SILENCIO), dtype=np.float32)])


def principal():
    p = argparse.ArgumentParser()
    p.add_argument("entrada")
    p.add_argument("salida")
    p.add_argument("--voz", default=None)
    p.add_argument("--velocidad", type=float, default=1.0)
    a = p.parse_args()
    with open(a.entrada, encoding="utf-8") as f:
        datos = json.load(f)
    idioma = datos.get("idioma", "es")
    if idioma not in IDIOMAS:
        sys.exit(f"Idioma {idioma!r} sin voz: usa {', '.join(IDIOMAS)}")
    voz = a.voz or IDIOMAS[idioma][1]
    frases = [fr if isinstance(fr, str) else fr["texto"] for fr in datos["frases"]]
    os.makedirs(a.salida, exist_ok=True)

    dispositivo = "cuda" if torch.cuda.is_available() else "cpu"
    if dispositivo == "cpu":
        print("GPU no disponible; se usa la CPU", file=sys.stderr)
    tuberia = cargar(idioma, dispositivo)
    resultado = []
    for i, texto in enumerate(frases, 1):
        try:
            audio = locutar(tuberia, texto, voz, a.velocidad, idioma)
        except RuntimeError as e:  # CUDA carga pero falla al usarla (p. ej., una GPU que torch no reconoce)
            if dispositivo != "cuda":
                raise
            print(f"Falló en la GPU ({e}); se repite en la CPU", file=sys.stderr)
            dispositivo = "cpu"
            tuberia = cargar(idioma, dispositivo)
            audio = locutar(tuberia, texto, voz, a.velocidad, idioma)
        archivo = f"frase-{i:02d}.wav"
        sf.write(os.path.join(a.salida, archivo), audio, MUESTREO, subtype="PCM_16")
        resultado.append({"texto": texto, "archivo": archivo, "duracion": round(len(audio) / MUESTREO, 3)})

    total = round(sum(r["duracion"] for r in resultado), 2)
    with open(os.path.join(a.salida, "voz.json"), "w", encoding="utf-8") as f:
        json.dump({"idioma": idioma, "voz": voz, "muestreo": MUESTREO, "dispositivo": dispositivo, "duracion": total, "frases": resultado},
                  f, ensure_ascii=False, indent=1)
    print(f"{len(resultado)} frases, {total} s, voz {voz}, {dispositivo}")


if __name__ == "__main__":
    principal()
