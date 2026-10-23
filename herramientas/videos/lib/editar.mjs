// Vídeo en bruto → vídeo limpio y clips verticales con subtítulos.
//  1. Transcribe con faster-whisper (transcribir.py), con el tiempo de cada palabra.
//  2. Decide los cortes: silencios largos, muletillas («eh», «em», «o sea»…) y tomas repetidas (si
//     una frase se empieza y se vuelve a decir justo después, se queda la última). Salen en cortes.json:
//     si lo retocas y pones "manual": true, la próxima vez se usa tal cual.
//  3. FFmpeg aplica los cortes con fundidos cortos de sonido (sin chasquidos) → limpio.mp4.
//  4. Elige los mejores trozos de 15-60 s que empiezan y acaban en frase completa (o los de --clips)
//     y los monta en vertical con remotion/ClipHablado.jsx.
// Todo sale en salida/editados/<nombre>/.
import fs from 'node:fs';
import path from 'node:path';
import { CARPETA, PYTHON, SALIDA, TRABAJO, crear, duracion, ejecutar, ff, ffmpeg, log } from './comun.mjs';
import { borradorClip } from './textos.mjs';
import { comprobarVideo, mosaico } from './comprobar.mjs';
import { renderizar } from './render.mjs';
import { soloSonidoJuego as normalizarSonido } from './montar.mjs';

const AIRE = 0.12; // lo que se deja antes y después de cada palabra
const HUECO = 0.4; // silencios más largos que esto se acortan
const MULETILLAS = {
  es: ['eh', 'ehh', 'ehm', 'em', 'emm', 'mm', 'mmm', 'hm', 'hmm', 'ah', 'este', 'o sea', 'osea', 'bueno pues', 'pues eso'],
  en: ['uh', 'uhh', 'um', 'umm', 'erm', 'er', 'ah', 'hm', 'hmm', 'mm', 'mmm', 'you know', 'i mean', 'like'],
};
// «este», «like», «bueno pues»… solo son muletilla si van sueltos entre pausas o comas (no «este juego»)
const DUDOSAS = new Set(['este', 'like', 'you know', 'i mean', 'bueno pues', 'pues eso', 'o sea', 'osea']);

const normal = (texto) => texto.toLowerCase().normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/[^\p{L}\p{N} ]/gu, '').trim();
const finDeFrase = (texto) => /[.!?…]$/.test(texto);

// ─── 1. Transcripción ──────────────────────────────────────────────────
async function transcribir(audio, salida, idioma) {
  if (!fs.existsSync(PYTHON)) throw new Error('Falta Whisper: mira «Instalación» en GUIA.md (node fabrica.mjs comprobar)');
  const r = await ejecutar(PYTHON, ['-X', 'utf8', path.join(CARPETA, 'transcribir.py'), audio, salida, ...(idioma ? ['--idioma', idioma] : [])]);
  log(`transcripción: ${r.salida.trim()}`);
  return JSON.parse(fs.readFileSync(salida, 'utf8'));
}

// ─── 2. Cortes ─────────────────────────────────────────────────────────
// Las palabras que se quitan, con su motivo
function marcarQuitadas(palabras, idioma) {
  const lista = MULETILLAS[idioma] || [...MULETILLAS.es, ...MULETILLAS.en];
  const quitar = new Array(palabras.length).fill(null);
  // Muletillas (de una o dos palabras)
  for (let i = 0; i < palabras.length; i++) {
    for (const largo of [2, 1]) {
      const trozo = palabras.slice(i, i + largo);
      if (trozo.length < largo) continue;
      const texto = normal(trozo.map((p) => p.texto).join(' '));
      if (!lista.includes(texto)) continue;
      if (DUDOSAS.has(texto)) {
        const antes = palabras[i - 1];
        const despues = palabras[i + largo];
        const sueltaAntes = !antes || /[,.!?…]$/.test(antes.texto) || trozo[0].desde - antes.hasta > 0.25;
        const sueltaDespues = !despues || /[,.!?…]$/.test(trozo[largo - 1].texto) || despues.desde - trozo[largo - 1].hasta > 0.25;
        if (!(sueltaAntes && sueltaDespues)) continue;
      }
      for (let k = i; k < i + largo; k++) quitar[k] = 'muletilla';
      i += largo - 1;
      break;
    }
  }
  // Palabras repetidas seguidas por un tropiezo («se juega se juega…»): fuera la primera vez
  for (let i = 0; i < palabras.length; i++) {
    for (const n of [4, 3, 2, 1]) {
      const a = palabras.slice(i, i + n).map((p) => normal(p.texto));
      const b = palabras.slice(i + n, i + 2 * n).map((p) => normal(p.texto));
      if (b.length === n && a.join(' ') === b.join(' ') && a.join('').length > 2 && !quitar[i]) {
        for (let k = i; k < i + n; k++) quitar[k] = 'repetición';
        break;
      }
    }
  }
  // Tomas repetidas: una frase que empieza igual que la siguiente (3 palabras o más) y poco antes
  const frases = trocearFrases(palabras.map((p, i) => ({ ...p, i })));
  for (let f = 0; f < frases.length - 1; f++) {
    const a = frases[f].filter((p) => !quitar[p.i]).map((p) => normal(p.texto));
    for (const siguiente of frases.slice(f + 1, f + 3)) {
      const b = siguiente.filter((p) => !quitar[p.i]).map((p) => normal(p.texto));
      let iguales = 0;
      while (iguales < a.length && iguales < b.length && a[iguales] === b[iguales]) iguales++;
      const cerca = siguiente[0].desde - frases[f][frases[f].length - 1].hasta < 8;
      if (cerca && iguales >= Math.min(3, a.length) && iguales >= 2) {
        for (const p of frases[f]) quitar[p.i] ||= 'toma repetida';
        break;
      }
    }
  }
  return quitar;
}

// Frases: hasta un punto, o hasta una pausa larga
function trocearFrases(palabras) {
  const frases = [];
  let actual = [];
  for (const p of palabras) {
    if (actual.length && p.desde - actual[actual.length - 1].hasta > 1.2) {
      frases.push(actual);
      actual = [];
    }
    actual.push(p);
    if (finDeFrase(p.texto)) {
      frases.push(actual);
      actual = [];
    }
  }
  if (actual.length) frases.push(actual);
  return frases.filter((f) => f.length);
}

// Silencios según FFmpeg (más fiable que los tiempos de Whisper para los bordes)
async function silencios(audio) {
  const { errores } = await ff(['-i', audio, '-af', `silencedetect=noise=-35dB:d=${HUECO}`, '-f', 'null', '-']);
  const lista = [];
  for (const m of errores.matchAll(/silence_start: ([\d.]+)[\s\S]*?silence_end: ([\d.]+)/g)) lista.push([+m[1], +m[2]]);
  return lista;
}

// Tramos que se quedan: cada palabra con su aire; se unen si el hueco entre palabras es corto, y luego
// se quitan los silencios largos que hayan quedado dentro
function tramosQueQuedan(palabras, quitar, silenciosLargos, total) {
  const tramos = [];
  palabras.forEach((p, i) => {
    if (quitar[i]) return;
    const desde = Math.max(0, p.desde - AIRE);
    const hasta = Math.min(total, p.hasta + AIRE);
    const ultimo = tramos[tramos.length - 1];
    const anterior = palabras.slice(0, i).reverse().find((_, k) => !quitar[i - 1 - k]);
    const seguidas = ultimo && anterior && !quitar[i - 1] && p.desde - anterior.hasta <= HUECO;
    if (ultimo && (seguidas || desde <= ultimo[1])) ultimo[1] = Math.max(ultimo[1], hasta);
    else tramos.push([desde, hasta]);
  });
  // Recortar los silencios largos de dentro de los tramos
  let resultado = tramos;
  for (const [s, e] of silenciosLargos) {
    const a = s + AIRE;
    const b = e - AIRE;
    if (b - a < 0.15) continue;
    resultado = resultado.flatMap(([x, y]) => (b <= x || a >= y ? [[x, y]] : [[x, a], [b, y]].filter(([u, v]) => v - u > 0.08)));
  }
  return resultado.map(([a, b]) => [+a.toFixed(3), +b.toFixed(3)]);
}

// Pasa un tiempo del vídeo en bruto al vídeo limpio. Si cae en un trozo quitado (Whisper suele empezar
// la palabra que va tras una pausa dentro del silencio), se lleva al principio del tramo siguiente
// (o al final del anterior, si es el final de una palabra); null si no queda ningún tramo.
function aLimpio(t, tramos, haciaDelante = true) {
  let acumulado = 0;
  let finAnterior = null;
  for (const [a, b] of tramos) {
    if (t >= a && t <= b) return acumulado + (t - a);
    if (t < a) return haciaDelante ? acumulado : finAnterior;
    acumulado += b - a;
    finAnterior = acumulado;
  }
  return haciaDelante ? null : finAnterior;
}

// ─── 3. Aplicar los cortes ─────────────────────────────────────────────
async function aplicarCortes(video, tramos, salida, conVideo) {
  const f = 0.015; // fundido de sonido en cada corte
  const partes = tramos.map(([a, b], i) => {
    const audio = `[0:a]atrim=${a}:${b},asetpts=PTS-STARTPTS,afade=t=in:d=${f},afade=t=out:st=${(b - a - f).toFixed(3)}:d=${f}[a${i}]`;
    return conVideo ? `[0:v]trim=${a}:${b},setpts=PTS-STARTPTS[v${i}];${audio}` : audio;
  });
  const entradas = tramos.map((_, i) => (conVideo ? `[v${i}][a${i}]` : `[a${i}]`)).join('');
  const filtro = `${partes.join(';')};${entradas}concat=n=${tramos.length}:v=${conVideo ? 1 : 0}:a=1${conVideo ? '[v][a]' : '[a]'}`;
  const guion = salida + '.filtro.txt';
  fs.writeFileSync(guion, filtro); // con muchos cortes no cabe en la línea de órdenes de Windows
  try {
    await ff(['-i', video, '-/filter_complex', guion, ...(conVideo ? ['-map', '[v]'] : []), '-map', '[a]',
      ...(conVideo ? ['-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p'] : []),
      '-c:a', 'aac', '-b:a', '192k', '-movflags', '+faststart', salida]);
  } finally { fs.rmSync(guion, { force: true }); }
}

// ─── 4. Clips ──────────────────────────────────────────────────────────
// Volumen momentáneo (LUFS) cada 0,1 s, para premiar los trozos con más energía
async function volumenes(archivo) {
  const { errores } = await ff(['-i', archivo, '-af', 'ebur128=framelog=verbose', '-f', 'null', '-']);
  return [...errores.matchAll(/t:\s*([\d.]+)\s+TARGET.*?M:\s*(-?[\d.]+|-inf)/g)].map((m) => [+m[1], m[2] === '-inf' ? -70 : +m[2]]);
}

function elegirClips(frases, vol, cuantos = 3, { min = 15, max = 60, ideal = 30 } = {}) {
  const candidatos = [];
  for (let i = 0; i < frases.length; i++) {
    for (let j = i; j < frases.length; j++) {
      const desde = Math.max(0, frases[i][0].desde - AIRE);
      const hasta = frases[j][frases[j].length - 1].hasta + 0.3;
      const largo = hasta - desde;
      if (largo > max) break;
      if (largo < min) continue;
      const palabras = frases.slice(i, j + 1).flat().length;
      const v = vol.filter(([t]) => t >= desde && t <= hasta).map(([, m]) => m);
      const energia = v.length ? v.reduce((a, b) => a + b, 0) / v.length : -40;
      const puntos = palabras / largo + 0.04 * (energia + 40) - Math.abs(largo - ideal) / 40;
      candidatos.push({ desde: +desde.toFixed(2), hasta: +hasta.toFixed(2), puntos, frases: [i, j] });
    }
  }
  candidatos.sort((a, b) => b.puntos - a.puntos);
  const elegidos = [];
  for (const c of candidatos) {
    if (elegidos.length >= cuantos) break;
    if (elegidos.every((e) => c.hasta <= e.desde || c.desde >= e.hasta)) elegidos.push(c);
  }
  // Si el vídeo es corto y no hay ningún trozo de 15 s, se saca entero como único clip
  if (!elegidos.length && frases.length) elegidos.push({ desde: 0, hasta: frases.at(-1).at(-1).hasta + 0.3, frases: [0, frases.length - 1] });
  return elegidos.sort((a, b) => a.desde - b.desde);
}

// ─── Textos de salida ──────────────────────────────────────────────────
const reloj = (s, coma = ',') => {
  const ms = Math.round(s * 1000);
  const p = (n, l = 2) => String(n).padStart(l, '0');
  return `${p(Math.floor(ms / 3600000))}:${p(Math.floor(ms / 60000) % 60)}:${p(Math.floor(ms / 1000) % 60)}${coma}${p(ms % 1000, 3)}`;
};
function srt(frases) {
  return frases.map((f, i) => `${i + 1}\n${reloj(f[0].desde)} --> ${reloj(f.at(-1).hasta)}\n${textoFrase(f)}\n`).join('\n');
}
// Con mayúscula al principio (si se quitó una muletilla del principio, «eh, es perfecto» → «Es perfecto»)
const textoFrase = (f) => f.map((p) => p.texto).join(' ').replace(/^\p{Ll}/u, (c) => c.toUpperCase());

// ─── Todo junto ────────────────────────────────────────────────────────
export async function editarVideo({ video, idioma = null, clips = null, encuadre = null, encajar = false }) {
  const nombre = path.basename(video, path.extname(video)).replace(/[^\p{L}\p{N}_-]+/gu, '-');
  const trabajo = crear(path.join(TRABAJO, 'editados', nombre));
  const destino = crear(path.join(SALIDA, 'editados', nombre));
  const { salida: info } = await ejecutar(ffmpeg().ffprobe, ['-v', 'error', '-show_entries', 'stream=codec_type,width,height', '-of', 'json', video]);
  const flujos = JSON.parse(info).streams;
  const v = flujos.find((f) => f.codec_type === 'video');
  if (!flujos.some((f) => f.codec_type === 'audio')) throw new Error('El vídeo no tiene sonido: no hay nada que transcribir');
  const total = await duracion(video);

  // 1. Transcripción (se reutiliza si el vídeo no ha cambiado)
  const audio = path.join(trabajo, 'audio.wav');
  const json = path.join(trabajo, 'transcripcion.json');
  const firma = `${fs.statSync(video).size}-${fs.statSync(video).mtimeMs}-${idioma || 'auto'}`;
  let t = fs.existsSync(json) ? JSON.parse(fs.readFileSync(json, 'utf8')) : null;
  if (t?.firma !== firma) {
    await ff(['-i', video, '-vn', '-ac', '1', '-ar', '16000', audio]);
    t = await transcribir(audio, json, idioma);
    t.firma = firma;
    fs.writeFileSync(json, JSON.stringify(t, null, 1));
  } else log('transcripción: reutilizada');
  const lengua = idioma || t.idioma;
  const palabras = t.frases.flatMap((f) => f.palabras);
  if (!palabras.length) throw new Error('Whisper no ha entendido ninguna palabra');

  // 2. Cortes (o los de cortes.json si los has retocado a mano)
  const archivoCortes = path.join(destino, 'cortes.json');
  const previo = fs.existsSync(archivoCortes) ? JSON.parse(fs.readFileSync(archivoCortes, 'utf8')) : null;
  let tramos;
  let quitar;
  if (previo?.manual) {
    tramos = previo.conservar;
    quitar = palabras.map((p) => (tramos.some(([a, b]) => p.desde >= a - 0.05 && p.hasta <= b + 0.05) ? null : 'a mano'));
    log('cortes: los de cortes.json (manual)');
  } else {
    quitar = marcarQuitadas(palabras, lengua);
    if (!fs.existsSync(audio)) await ff(['-i', video, '-vn', '-ac', '1', '-ar', '16000', audio]);
    tramos = tramosQueQuedan(palabras, quitar, await silencios(audio), total);
    const quitado = [];
    palabras.forEach((p, i) => {
      if (!quitar[i]) return;
      const ultimo = quitado.at(-1);
      if (ultimo && ultimo.motivo === quitar[i] && p.desde - ultimo.hasta < 0.6) {
        ultimo.hasta = p.hasta;
        ultimo.texto += ' ' + p.texto;
      } else quitado.push({ desde: p.desde, hasta: p.hasta, motivo: quitar[i], texto: p.texto });
    });
    fs.writeFileSync(archivoCortes, JSON.stringify({
      _leeme: 'Tramos del vídeo en bruto que se quedan (segundos). Para ajustarlos a mano, edita «conservar», pon "manual": true y vuelve a lanzar editar.',
      manual: false, conservar: tramos, quitado,
    }, null, 1));
  }
  if (!tramos.length) throw new Error('Los cortes no dejan nada del vídeo');

  // 3. Vídeo limpio
  const limpio = path.join(trabajo, 'limpio.mp4');
  await aplicarCortes(video, tramos, limpio, !!v);
  fs.copyFileSync(limpio, path.join(destino, 'limpio.mp4'));
  const duracionLimpio = await duracion(limpio);

  // Las palabras que quedan, con sus tiempos en el vídeo limpio
  const quedan = palabras
    .map((p, i) => (quitar[i] ? null : { texto: p.texto, desde: aLimpio(p.desde, tramos), hasta: aLimpio(p.hasta, tramos, false) }))
    .filter((p) => p && p.desde !== null)
    .map((p) => ({ ...p, hasta: Math.max(p.hasta ?? 0, p.desde + 0.1) }));
  const frases = trocearFrases(quedan);
  fs.writeFileSync(path.join(destino, 'subtitulos.srt'), srt(frases));
  fs.writeFileSync(path.join(destino, 'transcripcion.txt'),
    `# ${nombre}: ${total.toFixed(1)} s en bruto → ${duracionLimpio.toFixed(1)} s limpio (idioma ${lengua})\n` +
    '# Tiempos del vídeo limpio. Para elegir los clips a mano: clips.json = [{"desde": 12.3, "hasta": 40.1}, …]\n\n' +
    frases.map((f) => `[${f[0].desde.toFixed(1)}-${f.at(-1).hasta.toFixed(1)}] ${textoFrase(f)}`).join('\n') + '\n');

  // 4. Clips verticales
  const elegidos = !v ? [] : clips || elegirClips(frases, await volumenes(limpio));
  if (!v) log('el archivo no tiene imagen: solo salen limpio.mp4 y los subtítulos');
  const vertical = v ? v.height > v.width : true;
  const modo = encajar ? 'encajar' : 'recorte';
  const resumen = [];
  for (const [n, c] of elegidos.entries()) {
    const archivoClip = path.join(destino, `clip-${n + 1}.mp4`);
    const enClip = quedan.filter((p) => p.desde >= c.desde - 0.05 && p.hasta <= c.hasta + 0.05)
      .map((p) => ({ texto: p.texto, desde: +(p.desde - c.desde).toFixed(3), hasta: +(p.hasta - c.desde).toFixed(3) }));
    const montaje = path.join(trabajo, `clip-${n + 1}-montaje.mp4`);
    await renderizar('ClipHablado', {
      video: path.relative(TRABAJO, limpio).split(path.sep).join('/'),
      desde: c.desde, hasta: c.hasta, palabras: enClip, modo, encuadre: encuadre ?? 0.5, vertical,
    }, montaje);
    await normalizarSonido(montaje, archivoClip);
    const revision = await comprobarVideo(archivoClip, { min: Math.min(15, c.hasta - c.desde - 0.5), max: 61 });
    await mosaico(archivoClip, path.join(destino, `clip-${n + 1}-revision.jpg`));
    const frase = textoFrase(frases.find((f) => f[0].desde >= c.desde - 0.2) || frases[0]);
    for (const x of ['es', 'en']) {
      fs.writeFileSync(path.join(destino, `clip-${n + 1}-publicacion-${x}.txt`), borradorClip({ idioma: x, frase, idiomaVideo: lengua }));
    }
    resumen.push({ clip: path.basename(archivoClip), desde: c.desde, hasta: c.hasta, ...revision });
    log(`${revision.avisos.length ? '⚠' : '✓'} ${path.relative(process.cwd(), archivoClip)}: ${revision.duracion} s, ${revision.lufs} LUFS${revision.avisos.length ? ' · ' + revision.avisos.join('; ') : ''}`);
  }
  const informe = {
    video, idioma: lengua, dispositivo: t.dispositivo, bruto: +total.toFixed(2), limpio: +duracionLimpio.toFixed(2),
    cortes: tramos.length, quitado: Object.fromEntries(['muletilla', 'repetición', 'toma repetida', 'a mano'].map((m) => [m, quitar.filter((q) => q === m).length])),
    clips: resumen, fecha: new Date().toISOString(),
  };
  fs.writeFileSync(path.join(destino, 'informe.json'), JSON.stringify(informe, null, 2));
  log(`${nombre}: ${informe.bruto} s → ${informe.limpio} s limpio, ${resumen.length} clip(s) en ${path.relative(process.cwd(), destino)}`);
  return informe;
}
