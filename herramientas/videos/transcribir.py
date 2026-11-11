"""Transcribe un audio con faster-whisper y deja un JSON con el tiempo de cada palabra.

Uso: python transcribir.py <audio.wav (16 kHz, mono)> <salida.json> [--idioma es|en] [--modelo large-v3-turbo]

Lo usa lib/editar.mjs. Va en la GPU (CUDA, float16) y, si no puede, en la CPU (int8): más lento,
mismo resultado. El initial_prompt lleva muletillas para que Whisper las escriba en vez de saltárselas
(así se pueden cortar).
"""
import argparse
import glob
import json
import os
import sys
import wave

import numpy as np

# En Windows, las DLL de CUDA de los paquetes nvidia-cublas-cu12 / nvidia-cudnn-cu12 no se encuentran
# solas: se añaden al PATH antes de cargar CTranslate2
for carpeta in glob.glob(os.path.join(sys.prefix, "Lib", "site-packages", "nvidia", "*", "bin")):
    os.add_dll_directory(carpeta)
    os.environ["PATH"] = carpeta + os.pathsep + os.environ["PATH"]

from faster_whisper import WhisperModel  # noqa: E402

MULETILLAS = {
    "es": "Eh, em, mmm... o sea, este, bueno, pues eso. Vale, eh, ¿sabes?",
    "en": "Um, uh, hmm... like, you know, I mean, so, uh, okay.",
}


def cargar(modelo):
    try:
        return WhisperModel(modelo, device="cuda", compute_type="float16"), "cuda"
    except Exception as e:  # sin GPU o sin las bibliotecas de CUDA
        print(f"GPU no disponible ({e}); se usa la CPU", file=sys.stderr)
        return WhisperModel(modelo, device="cpu", compute_type="int8"), "cpu"


def leer_wav(ruta):
    """El WAV de 16 kHz mono que prepara lib/editar.mjs, sin pasar por PyAV (hay versiones que no casan)."""
    with wave.open(ruta, "rb") as w:
        if w.getframerate() != 16000 or w.getnchannels() != 1 or w.getsampwidth() != 2:
            raise ValueError("Hace falta WAV de 16 kHz, mono y 16 bits")
        return np.frombuffer(w.readframes(w.getnframes()), dtype=np.int16).astype(np.float32) / 32768.0


def transcribir(modelo, audio, idioma):
    segmentos, info = modelo.transcribe(
        leer_wav(audio),
        language=idioma,
        word_timestamps=True,
        vad_filter=False,  # los silencios los corta lib/editar.mjs; aquí interesa no perder palabras
        condition_on_previous_text=False,  # que no «limpie» las repeticiones de una toma a otra
        initial_prompt=MULETILLAS.get(idioma or "es"),
        beam_size=5,
    )
    frases = []
    for s in segmentos:
        palabras = [
            {"texto": p.word.strip(), "desde": round(p.start, 3), "hasta": round(p.end, 3), "prob": round(p.probability, 3)}
            for p in (s.words or [])
            if p.word.strip()
        ]
        if palabras:
            frases.append({"texto": s.text.strip(), "desde": round(s.start, 3), "hasta": round(s.end, 3), "palabras": palabras})
    return {"idioma": info.language, "duracion": round(info.duration, 3), "frases": frases}


def principal():
    p = argparse.ArgumentParser()
    p.add_argument("audio")
    p.add_argument("salida")
    p.add_argument("--idioma", default=None)
    p.add_argument("--modelo", default="large-v3-turbo")
    a = p.parse_args()
    modelo, dispositivo = cargar(a.modelo)
    try:
        resultado = transcribir(modelo, a.audio, a.idioma)
    except RuntimeError as e:  # CUDA carga pero falla al usarla (faltan cuBLAS/cuDNN)
        if dispositivo != "cuda":
            raise
        print(f"Falló en la GPU ({e}); se repite en la CPU", file=sys.stderr)
        modelo, dispositivo = WhisperModel(a.modelo, device="cpu", compute_type="int8"), "cpu"
        resultado = transcribir(modelo, a.audio, a.idioma)
    resultado["dispositivo"] = dispositivo
    with open(a.salida, "w", encoding="utf-8") as f:
        json.dump(resultado, f, ensure_ascii=False, indent=1)
    print(f"{len(resultado['frases'])} frases, idioma {resultado['idioma']}, {dispositivo}")


if __name__ == "__main__":
    principal()
