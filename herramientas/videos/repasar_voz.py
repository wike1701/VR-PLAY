"""Repasa con Whisper la voz que deja locutar_natural.py y corta lo que sobra al final de cada frase.

Uso: python repasar_voz.py <carpeta de la voz>   (la de voz.json; va en .venv, con faster-whisper)

Chatterbox a veces sigue hablando después del texto y se inventa palabras. Whisper transcribe cada
frase con el tiempo de cada palabra: si después de la última palabra del guion hay más, se corta ahí
y se actualiza la duración en voz.json. Las frases que no se entienden bien se avisan (con lo que ha
oído Whisper) para revisarlas a mano.
"""
import glob
import json
import os
import re
import sys
import unicodedata

for carpeta in glob.glob(os.path.join(sys.prefix, "Lib", "site-packages", "nvidia", "*", "bin")):
    os.add_dll_directory(carpeta)
    os.environ["PATH"] = carpeta + os.pathsep + os.environ["PATH"]

import numpy as np  # noqa: E402
import soundfile as sf  # noqa: E402
from faster_whisper import WhisperModel  # noqa: E402

MARGEN = 0.12  # segundos que se dejan tras la última palabra
SILENCIO = 0.12  # el mismo silencio final que pone locutar_natural.py
NUMEROS = {"es": {"sesenta": "60", "treinta": "30", "cien": "100"}, "en": {"sixty": "60", "thirty": "30", "hundred": "100"}}


def palabras(texto, idioma="es"):
    texto = unicodedata.normalize("NFD", texto.lower())
    texto = "".join(c for c in texto if unicodedata.category(c) != "Mn")
    lista = re.findall(r"[a-z0-9]+", texto)
    return [NUMEROS.get(idioma, {}).get(p, p) for p in lista]


def parecida(a, b):
    """Dos palabras se dan por iguales si comparten casi todas las letras (Whisper oye «dale» por «dales»)."""
    if a == b:
        return True
    if min(len(a), len(b)) < 3:
        return False
    comunes = sum(1 for x, y in zip(a, b) if x == y)
    return comunes >= min(len(a), len(b)) - 1


def cargar():
    try:
        return WhisperModel("large-v3-turbo", device="cuda", compute_type="float16")
    except Exception as e:
        print(f"GPU no disponible ({e}); se usa la CPU", file=sys.stderr)
        return WhisperModel("small", device="cpu", compute_type="int8")


def a16k(audio, muestreo):
    return np.interp(np.arange(0, len(audio), muestreo / 16000), np.arange(len(audio)), audio).astype(np.float32)


def principal():
    dir_voz = sys.argv[1]
    indice = os.path.join(dir_voz, "voz.json")
    with open(indice, encoding="utf-8") as f:
        voz = json.load(f)
    idioma = voz["idioma"]
    modelo = cargar()
    cortadas, dudosas = 0, []
    for fr in voz["frases"]:
        ruta = os.path.join(dir_voz, fr["archivo"])
        audio, muestreo = sf.read(ruta, dtype="float32")
        segmentos, _ = modelo.transcribe(a16k(audio, muestreo), language=idioma, word_timestamps=True,
                                         condition_on_previous_text=False)
        oidas = [(p, w.end) for s in segmentos for w in (s.words or []) for p in palabras(w.word, idioma)]
        esperadas = palabras(fr["texto"], idioma)
        # Dónde acaba la última palabra del guion: se busca empezando por el final del guion
        fin = None
        for k in range(len(oidas) - 1, -1, -1):
            if esperadas and parecida(oidas[k][0], esperadas[-1]) and k >= len(esperadas) // 2:
                fin = (k, oidas[k][1])
                break
        sobra = len(oidas) - 1 - fin[0] if fin else 0
        if fin and sobra > 0:
            corte = min(len(audio), int((fin[1] + MARGEN) * muestreo))
            audio = np.concatenate([audio[:corte], np.zeros(int(muestreo * SILENCIO), dtype=np.float32)])
            sf.write(ruta, audio, muestreo, subtype="PCM_16")
            fr["duracion"] = round(len(audio) / muestreo, 3)
            cortadas += 1
        aciertos = sum(1 for p in esperadas if any(parecida(p, o) for o, _ in oidas))
        if not fin or aciertos < len(esperadas) * 0.75:
            dudosas.append(f"«{fr['texto']}» → «{' '.join(o for o, _ in oidas)}»")
    voz["duracion"] = round(sum(fr["duracion"] for fr in voz["frases"]), 2)
    with open(indice, "w", encoding="utf-8") as f:
        json.dump(voz, f, ensure_ascii=False, indent=1)
    for d in dudosas:
        print(f"Aviso: se entiende mal {d}", file=sys.stderr)
    print(f"repasadas {len(voz['frases'])} frases: {cortadas} recortadas, {len(dudosas)} dudosas")


if __name__ == "__main__":
    principal()
