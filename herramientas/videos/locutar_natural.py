"""Pone voz natural a las frases de un guion con Chatterbox Multilingual (Resemble AI, MIT) y deja un WAV por frase.

Uso: python locutar_natural.py <frases.json> <carpeta de salida> [--referencia voz.wav] [--expresion 0.5] [--tomas 1]

La misma entrada y salida que locutar.py (Kokoro): <frases.json> es {"idioma": "es"|"en", "frases": [...]}
y en la carpeta deja frase-01.wav, frase-02.wav… (24 kHz, mono, 16 bits) y voz.json.
Va en su propio entorno (.venv-voz, ver GUIA.md) porque necesita otra versión de torch que Kokoro.
La voz sale de un audio de referencia de unos 10 s (medios/voces/<idioma>.wav si existe); sin él, la
voz de serie del modelo. --expresion sube la emoción (0,25 sereno; 0,5 normal; 0,8 animado); una frase
puede traer la suya ({"texto", "enfasis"}). Con --tomas N se dicen N veces y se queda la más expresiva
(la que más sube y baja de volumen y de tono). Los *asteriscos* del guion (palabra clave) no se leen.
Va en la GPU: en la CPU también funciona, pero tarda mucho.
"""
import argparse
import json
import os
import re
import sys
import warnings

os.environ.setdefault("HF_HUB_DISABLE_SYMLINKS_WARNING", "1")  # Windows sin modo desarrollador
warnings.filterwarnings("ignore")  # avisos de torch, diffusers y transformers

import numpy as np  # noqa: E402
import soundfile as sf  # noqa: E402
import torch  # noqa: E402
from chatterbox.mtl_tts import ChatterboxMultilingualTTS  # noqa: E402

CARPETA = os.path.dirname(os.path.abspath(__file__))
IDIOMAS = ("es", "en")
SILENCIO = 0.12  # segundos que se dejan al final de cada frase para que no corte en seco
SEMILLA = 7  # la misma semilla da la misma entonación: si el texto no cambia, el audio tampoco
INTENTOS = 6
# Cómo se dice lo que el modelo lee mal (solo cambia el audio, no el texto del guion)
PRONUNCIACION = {"es": [(re.compile(r"\bVR Play\b"), "uve erre plei"), (re.compile(r"\bVR\b"), "uve erre")],
                 "en": [(re.compile(r"\bVR\b"), "V.R.")]}


def recortar(audio, muestreo, umbral=0.01):
    """Quita el silencio del principio y del final (para que los tiempos del montaje cuadren)."""
    voz = np.where(np.abs(audio) > umbral)[0]
    if not len(voz):
        return audio
    margen = int(muestreo * 0.04)
    return audio[max(0, voz[0] - margen): voz[-1] + margen]


def larga(audio, muestreo, texto):
    """A veces el modelo sigue hablando después del texto (palabras inventadas): se nota en que la frase
    dura mucho más de lo que toca por sus letras (unas 14-18 por segundo)."""
    return len(audio) / muestreo > len(texto) / 12 + 0.9


def expresividad(audio, muestreo):
    """Cuánto sube y baja la voz: variación del volumen (ventanas de 25 ms) y del tono (autocorrelación,
    80-400 Hz) en las ventanas con voz. Más alto, más énfasis."""
    n = int(muestreo * 0.025)
    ventanas = [audio[k:k + n] for k in range(0, len(audio) - n, n)]
    rms = np.array([np.sqrt(np.mean(v * v)) for v in ventanas])
    voz = rms > max(rms.max() * 0.15, 1e-4) if len(rms) else rms
    if voz.sum() < 4:
        return 0.0
    volumen = np.std(20 * np.log10(rms[voz] + 1e-6)) / 10
    tonos = []
    for v, hay in zip(ventanas, voz):
        if not hay:
            continue
        c = np.correlate(v, v, "full")[n - 1:]
        lo, hi = int(muestreo / 400), int(muestreo / 80)
        if hi >= len(c) or c[0] <= 0:
            continue
        k = lo + int(np.argmax(c[lo:hi]))
        if c[k] / c[0] > 0.3:
            tonos.append(12 * np.log2(muestreo / k))
    tono = np.std(tonos) / 3 if len(tonos) > 3 else 0.0
    return float(volumen + tono)


def una_toma(modelo, texto, idioma, referencia, a, expresion, semilla):
    """Una toma; si sale demasiado larga, se repite con otra semilla y se queda la más corta."""
    mejor = None
    for intento in range(INTENTOS):
        torch.manual_seed(semilla + intento)
        onda = modelo.generate(texto, language_id=idioma, audio_prompt_path=referencia,
                               exaggeration=expresion, cfg_weight=a.guia, temperature=a.temperatura)
        audio = recortar(onda.squeeze().detach().cpu().numpy().astype(np.float32), modelo.sr)
        if mejor is None or len(audio) < len(mejor):
            mejor = audio
        if not larga(audio, modelo.sr, texto):
            return audio, intento + 1, True
    return mejor, INTENTOS, False


def generar(modelo, texto, idioma, referencia, a, i, expresion):
    """La frase: --tomas tomas buenas (que no se alargan) y se queda la más expresiva."""
    tomas = []
    for k in range(max(1, a.tomas)):
        audio, intentos, buena = una_toma(modelo, texto, idioma, referencia, a, expresion, SEMILLA + i * 100 + k * 17)
        tomas.append((buena, expresividad(audio, modelo.sr), audio, intentos))
    buenas = [t for t in tomas if t[0]] or tomas
    if not any(t[0] for t in tomas):
        print(f"Aviso: «{texto}» sigue saliendo larga tras {INTENTOS} intentos", file=sys.stderr)
    _, puntos, audio, intentos = max(buenas, key=lambda t: t[1])
    return audio, intentos, puntos


def principal():
    p = argparse.ArgumentParser()
    p.add_argument("entrada")
    p.add_argument("salida")
    p.add_argument("--referencia", default=None)
    p.add_argument("--expresion", type=float, default=0.5)
    p.add_argument("--guia", type=float, default=0.5)  # cfg: más bajo, habla más pausado
    p.add_argument("--temperatura", type=float, default=0.7)
    p.add_argument("--tomas", type=int, default=1)
    a = p.parse_args()
    with open(a.entrada, encoding="utf-8") as f:
        datos = json.load(f)
    idioma = datos.get("idioma", "es")
    if idioma not in IDIOMAS:
        sys.exit(f"Idioma {idioma!r} sin voz: usa {', '.join(IDIOMAS)}")
    frases = [fr if isinstance(fr, dict) else {"texto": fr} for fr in datos["frases"]]
    referencia = a.referencia or os.path.join(CARPETA, "medios", "voces", f"{idioma}.wav")
    referencia = referencia if os.path.exists(referencia) else None
    os.makedirs(a.salida, exist_ok=True)

    dispositivo = "cuda" if torch.cuda.is_available() else "cpu"
    if dispositivo == "cpu":
        print("GPU no disponible; se usa la CPU (va lento)", file=sys.stderr)
    modelo = ChatterboxMultilingualTTS.from_pretrained(device=dispositivo)
    muestreo = modelo.sr
    resultado = []
    for i, fr in enumerate(frases, 1):
        texto = fr["texto"]
        dicho = texto.replace("*", "")
        for patron, cambio in PRONUNCIACION.get(idioma, []):
            dicho = patron.sub(cambio, dicho)
        expresion = fr.get("enfasis") or a.expresion
        audio, intentos, puntos = generar(modelo, dicho, idioma, referencia, a, i, expresion)
        if intentos > 1:
            print(f"frase {i}: {intentos} intentos", file=sys.stderr)
        audio = np.concatenate([audio, np.zeros(int(muestreo * SILENCIO), dtype=np.float32)])
        archivo = f"frase-{i:02d}.wav"
        sf.write(os.path.join(a.salida, archivo), audio, muestreo, subtype="PCM_16")
        resultado.append({"texto": texto, "archivo": archivo, "duracion": round(len(audio) / muestreo, 3),
                          "expresion": expresion, "expresividad": round(puntos, 3)})

    total = round(sum(r["duracion"] for r in resultado), 2)
    voz = "chatterbox" + (f":{os.path.basename(referencia)}" if referencia else "")
    with open(os.path.join(a.salida, "voz.json"), "w", encoding="utf-8") as f:
        json.dump({"idioma": idioma, "voz": voz, "muestreo": muestreo, "dispositivo": dispositivo, "duracion": total, "frases": resultado},
                  f, ensure_ascii=False, indent=1)
    print(f"{len(resultado)} frases, {total} s, voz {voz}, {dispositivo}")


if __name__ == "__main__":
    principal()
