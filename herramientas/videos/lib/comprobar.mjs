// Comprobaciones con código (sin mirar el vídeo): qué está instalado, y si un vídeo terminado
// tiene el tamaño, la duración, el sonido y la imagen bien. Para revisar a ojo, un solo mosaico
// JPEG pequeño por vídeo (4 fotogramas en fila, 800 px de ancho).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { CARPETA, PYTHON, PYTHON_VOZ, duracion, ejecutar, ff, ffmpeg } from './comun.mjs';

const require = createRequire(import.meta.url);

export async function comprobarInstalacion() {
  const filas = [];
  const fila = (ok, que, detalle) => filas.push(`${ok ? '✓' : '✗'} ${que.padEnd(22)} ${detalle}`);
  try {
    const { salida } = await ejecutar(ffmpeg().ffmpeg, ['-version']);
    fila(true, 'FFmpeg', salida.split('\n')[0].split(' ').slice(0, 3).join(' '));
  } catch (e) { fila(false, 'FFmpeg', e.message); }
  for (const paquete of ['remotion', '@remotion/renderer', '@remotion/bundler', 'playwright']) {
    try {
      fila(true, paquete, require(`${paquete}/package.json`).version);
    } catch { fila(false, paquete, 'falta: npm install (en herramientas/videos)'); }
  }
  try {
    const { chromium } = require('playwright');
    const { abrirNavegador } = await import('./grabar.mjs');
    const navegador = await abrirNavegador(chromium);
    fila(true, 'Navegador', `${navegador.browserType().name()} ${navegador.version()}`);
    await navegador.close();
  } catch (e) { fila(false, 'Navegador', e.message.split('\n')[0]); }
  if (fs.existsSync(PYTHON)) {
    // Igual que transcribir.py: añade las DLL de CUDA de los paquetes nvidia-* y comprueba que carga cuBLAS
    const prueba = [
      'import glob, os, sys, ctypes, faster_whisper, ctranslate2',
      '[os.add_dll_directory(c) for c in glob.glob(os.path.join(sys.prefix, "Lib", "site-packages", "nvidia", "*", "bin"))] if os.name == "nt" else None',
      'gpu = ctranslate2.get_cuda_device_count()',
      'exec("try:\\n ctypes.CDLL(\\"cublas64_12.dll\\" if os.name == \\"nt\\" else \\"libcublas.so.12\\")\\nexcept OSError:\\n gpu = 0")',
      'print(faster_whisper.__version__, gpu)',
    ].join('\n');
    const r = await ejecutar(PYTHON, ['-c', prueba], { falloSiError: false });
    const [version, gpus] = r.salida.trim().split(' ');
    fila(r.codigo === 0, 'faster-whisper', r.codigo === 0 ? `${version} (${+gpus ? 'con GPU' : 'sin GPU: irá en CPU, más lento'})` : 'falta: pip install faster-whisper en .venv');
    // La voz en off (locutar.py): Kokoro con torch, y espeak-ng para el español (lo trae espeakng-loader)
    const voz = await ejecutar(PYTHON, ['-c', [
      'import importlib.metadata as m, torch, kokoro, soundfile',
      'print(m.version("kokoro"), torch.cuda.is_available())',
    ].join('\n')], { falloSiError: false });
    const [kokoro, cuda] = voz.salida.trim().split(' ');
    fila(voz.codigo === 0, 'Kokoro', voz.codigo === 0 ? `${kokoro} (${cuda === 'True' ? 'con GPU' : 'sin GPU: irá en CPU'})` : 'falta: pip install kokoro soundfile en .venv (ver GUIA.md)');
    const espeak = await ejecutar(PYTHON, ['-c', [
      'import espeakng_loader, phonemizer.backend.espeak.wrapper as w',
      'w.EspeakWrapper.set_library(espeakng_loader.get_library_path())',
      'w.EspeakWrapper.set_data_path(espeakng_loader.get_data_path())',
      'print(".".join(map(str, w.EspeakWrapper().version)))',
    ].join('\n')], { falloSiError: false });
    fila(espeak.codigo === 0, 'espeak-ng', espeak.codigo === 0 ? `${espeak.salida.trim()} (de espeakng-loader)` : 'falta: viene con kokoro (pip install kokoro); si no, el MSI de github.com/espeak-ng');
  } else {
    fila(false, 'faster-whisper', `falta el entorno ${path.relative(process.cwd(), PYTHON)} (ver GUIA.md)`);
    fila(false, 'Kokoro', 'falta el entorno .venv (ver GUIA.md)');
  }
  // La voz natural (locutar_natural.py): Chatterbox en su propio entorno .venv-voz
  if (fs.existsSync(PYTHON_VOZ)) {
    const r = await ejecutar(PYTHON_VOZ, ['-c', [
      'import importlib.metadata as m, torch, chatterbox.mtl_tts',
      'print(m.version("chatterbox-tts"), torch.cuda.is_available())',
    ].join('\n')], { falloSiError: false });
    const [version, cuda] = r.salida.trim().split(' ');
    fila(r.codigo === 0, 'Chatterbox', r.codigo === 0 ? `${version} (${cuda === 'True' ? 'con GPU' : 'sin GPU: irá muy lento'})` : 'falla al cargar en .venv-voz (ver GUIA.md)');
  } else fila(true, 'Chatterbox', 'no instalado (opcional: voz más natural; sin él, Kokoro; ver GUIA.md)');
  const pistas = fs.existsSync(path.join(CARPETA, 'musica')) ? fs.readdirSync(path.join(CARPETA, 'musica')).filter((n) => /\.(mp3|ogg|wav|m4a)$/i.test(n)) : [];
  fila(true, 'Música', pistas.length ? `${pistas.length} pistas en musica/` : 'ninguna (opcional: los vídeos salen con el sonido del juego; ver musica/LEEME.md)');
  console.log(filas.join('\n'));
  if (filas.some((f) => f.startsWith('✗'))) process.exitCode = 1;
}

// Revisa un vídeo terminado: devuelve { ok, avisos, duracion, ancho, alto, audio, lufs, negros, congelados }
export async function comprobarVideo(archivo, { min = 15, max = 45, ancho = 1080, alto = 1920 } = {}) {
  const { salida } = await ejecutar(ffmpeg().ffprobe, ['-v', 'error', '-show_entries', 'stream=codec_type,width,height', '-of', 'json', archivo]);
  const flujos = JSON.parse(salida).streams;
  const v = flujos.find((f) => f.codec_type === 'video');
  const info = { duracion: +(await duracion(archivo)).toFixed(2), ancho: v?.width, alto: v?.height, audio: flujos.some((f) => f.codec_type === 'audio') };
  const { errores } = await ff(['-i', archivo, '-vf', 'blackdetect=d=0.5:pix_th=0.06,freezedetect=n=0.002:d=2.5',
    ...(info.audio ? ['-af', 'ebur128=framelog=quiet'] : []), '-f', 'null', '-'], { falloSiError: false });
  info.negros = (errores.match(/black_start/g) || []).length;
  info.congelados = (errores.match(/freeze_start/g) || []).length;
  info.lufs = info.audio ? parseFloat(/I:\s+(-?[\d.]+) LUFS/.exec(errores.slice(errores.lastIndexOf('Summary')))?.[1]) : null;
  const avisos = [];
  if (info.ancho !== ancho || info.alto !== alto) avisos.push(`tamaño ${info.ancho}×${info.alto} (debería ser ${ancho}×${alto})`);
  if (info.duracion < min || info.duracion > max) avisos.push(`dura ${info.duracion} s (debería estar entre ${min} y ${max})`);
  if (!info.audio) avisos.push('no tiene sonido');
  else if (!(info.lufs > -20 && info.lufs < -10)) avisos.push(`volumen ${info.lufs} LUFS (debería rondar -14)`);
  if (info.negros) avisos.push(`${info.negros} trozo(s) en negro`);
  if (info.congelados) avisos.push(`${info.congelados} trozo(s) con la imagen congelada`);
  return { ok: !avisos.length, avisos, ...info };
}

// Un JPEG de 800 px de ancho con 6 fotogramas (el gancho y luego repartidos), para ver los planos
export async function mosaico(archivo, salida) {
  const d = await duracion(archivo);
  const momentos = [0.06, 0.24, 0.42, 0.6, 0.78, 0.95];
  const entradas = momentos.flatMap((p) => ['-ss', (d * p).toFixed(2), '-i', archivo]);
  const escalas = momentos.map((_, i) => `[${i}:v]scale=134:-2,setsar=1[v${i}]`).join(';');
  await ff([...entradas, '-filter_complex', `${escalas};${momentos.map((_, i) => `[v${i}]`).join('')}hstack=${momentos.length}`, '-frames:v', '1', '-q:v', '5', salida]);
  return salida;
}
