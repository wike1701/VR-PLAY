// El TikTok de un juego, de principio a fin: graba la partida (lib/grabar.mjs; en VR, con plano de
// espectador), pone voz al guion (lib/guion.mjs, Kokoro), reparte los planos al ritmo de la voz,
// monta con Remotion (remotion/AnuncioVR.jsx, con uno de los 4 ganchos), mezcla voz, juego y música
// y deja el vídeo, la publicación y el informe en salida/juegos/<id>/. Versiones: <id>-<idioma>.mp4
// (todo), -sin-musica (voz y juego) y -sin-voz (juego y música).
import fs from 'node:fs';
import path from 'node:path';
import { CARPETA, RAIZ, SALIDA, TRABAJO, crear, duracion, ff, log, juegosDelCatalogo, marcador, textosJuego } from './comun.mjs';
import { estrategiaDe } from './estrategias.mjs';
import { elegirMomentos } from './momentos.mjs';
import { AJUSTES_VOZ, REPASO_PRO, conEnfasis, guionDe, lineaDeTiempo, locutar, repasoDeVoz, sinMarcas } from './guion.mjs';
import { lineaDeEdicion } from './edicion.mjs';
import { golpes } from './bruto.mjs';
import { elegirGancho, elegirPersona } from '../remotion/ganchos/index.js';
import { publicacion, textosVideo, DOMINIO } from './textos.mjs';
import { comprobarVideo, mosaico } from './comprobar.mjs';
import { renderizar } from './render.mjs';

// Frases cortas para los subtítulos: los controles táctiles y la descripción, partida por frases
function frasesDe(juego) {
  const trozos = [juego.controlesTactil || juego.controlesEscritorio, ...juego.descripcion.split(/(?<=[.!?:;])\s+/)]
    .flatMap((f) => (f.length > 60 ? f.split(/(?<=,)\s+/) : [f]))
    .map((f) => f.replace(/[.:;,]$/, '').trim())
    .filter((f) => f.length > 3);
  return trozos.map((f) => f.charAt(0).toUpperCase() + f.slice(1));
}

// Una pista de musica/ (siempre la misma para el mismo juego, para que no cambie al repetir)
export function pistaPara(id) {
  const carpeta = path.join(CARPETA, 'musica');
  const pistas = fs.existsSync(carpeta) ? fs.readdirSync(carpeta).filter((n) => /\.(mp3|ogg|wav|m4a)$/i.test(n)).sort() : [];
  if (!pistas.length) return null;
  const h = [...id].reduce((n, c) => (n * 31 + c.charCodeAt(0)) >>> 0, 7);
  return path.join(carpeta, pistas[h % pistas.length]);
}

// A -14 LUFS (lo que piden TikTok, Reels y Shorts). El sonido de los juegos tiene golpes muy
// fuertes y el resto bajo, así que se sube con ganancia medida y un limitador que recorta los picos
// (loudnorm solo no llega sin saturar). Se mide, se prueba y se corrige hasta acertar.
const LIMITADOR = 'alimiter=limit=0.84:attack=4:release=60:level=false';
async function sonoridad(audio, filtro) {
  const { errores } = await ff(['-i', audio, '-af', `${filtro},ebur128=framelog=quiet`, '-f', 'null', '-']);
  return parseFloat(/I:\s+(-?[\d.]+) LUFS/.exec(errores.slice(errores.lastIndexOf('Summary')))[1]);
}
async function normalizar(montaje, audio, salida) {
  let ganancia = -14 - (await sonoridad(audio, 'anull'));
  for (let i = 0; i < 4; i++) {
    const error = -14 - (await sonoridad(audio, `volume=${ganancia.toFixed(2)}dB,${LIMITADOR}`));
    if (Math.abs(error) < 0.5) break;
    ganancia += error * 1.5; // el limitador se come parte de la subida
  }
  await ff(['-i', montaje, '-i', audio, '-map', '0:v', '-map', '1:a', '-c:v', 'copy', '-af', `volume=${ganancia.toFixed(2)}dB,${LIMITADOR}`,
    '-ar', '48000', '-c:a', 'aac', '-b:a', '192k', '-shortest', '-movflags', '+faststart', salida]);
}

// Sin música: solo el sonido del juego (también lo usa lib/editar.mjs para dejar los clips a -14 LUFS)
export async function soloSonidoJuego(montaje, salida) {
  const audio = salida.replace(/\.mp4$/, '.wav');
  await ff(['-i', montaje, '-vn', '-ac', '2', '-ar', '48000', audio]);
  try { await normalizar(montaje, audio, salida); } finally { fs.rmSync(audio, { force: true }); }
}

// Con música: suena por debajo del juego, se agacha sola con los golpes (sidechain) y se apaga al final
async function conMusica(montaje, pista, duracion, salida) {
  const audio = salida.replace(/\.mp4$/, '.wav');
  const filtro = [
    `[1:a]aloop=loop=-1:size=2e9,atrim=0:${duracion.toFixed(2)},aformat=channel_layouts=stereo:sample_rates=48000,volume=0.32,afade=t=in:d=0.4,afade=t=out:st=${(duracion - 1.5).toFixed(2)}:d=1.5[m]`,
    '[0:a]aformat=channel_layouts=stereo:sample_rates=48000,asplit=2[j][clave]',
    '[m][clave]sidechaincompress=threshold=0.04:ratio=6:attack=15:release=350[md]',
    '[j][md]amix=inputs=2:normalize=0[a]',
  ].join(';');
  await ff(['-i', montaje, '-i', pista, '-filter_complex', filtro, '-map', '[a]', '-t', duracion.toFixed(2), audio]);
  try { await normalizar(montaje, audio, salida); } finally { fs.rmSync(audio, { force: true }); }
}

// La pista de voz: cada frase en su sitio de la línea de tiempo
async function pistaDeVoz(voz, habla, duracion, salida, repaso = null) {
  const entradas = habla.flatMap((h) => ['-i', path.join(voz.dir, voz.frases[h.linea].archivo)]);
  const filtro = habla.map((h, i) => `[${i}:a]${repaso ? repaso + ',' : ''}aformat=sample_rates=48000:channel_layouts=stereo,adelay=${Math.round(h.en * 1000)}:all=1[v${i}]`).join(';') +
    ';' + habla.map((_, i) => `[v${i}]`).join('') + `amix=inputs=${habla.length}:normalize=0,apad=whole_dur=${duracion.toFixed(2)}[a]`;
  await ff([...entradas, '-filter_complex', filtro, '-map', '[a]', '-t', duracion.toFixed(2), salida]);
}

// Voz encima; el juego y la música se agachan mientras habla (sidechain). Sin pista: solo voz y juego
async function conVoz(montaje, vozWav, pista, duracion, salida) {
  const audio = salida.replace(/\.mp4$/, '.wav');
  const partes = [
    '[1:a]aformat=channel_layouts=stereo:sample_rates=48000,volume=1.9,asplit=3[voz][c1][c2]',
    '[0:a]aformat=channel_layouts=stereo:sample_rates=48000,volume=0.8[j]',
    '[j][c1]sidechaincompress=threshold=0.03:ratio=5:attack=20:release=300[jd]',
  ];
  if (pista) {
    partes.push(
      `[2:a]aloop=loop=-1:size=2e9,atrim=0:${duracion.toFixed(2)},aformat=channel_layouts=stereo:sample_rates=48000,volume=0.3,afade=t=in:d=0.4,afade=t=out:st=${(duracion - 1.5).toFixed(2)}:d=1.5[m]`,
      '[m][c2]sidechaincompress=threshold=0.02:ratio=8:attack=20:release=400[md]',
      '[jd][md][voz]amix=inputs=3:normalize=0[a]',
    );
  } else {
    partes.push('[c2]anullsink', '[jd][voz]amix=inputs=2:normalize=0[a]');
  }
  await ff(['-i', montaje, '-i', vozWav, ...(pista ? ['-i', pista] : []), '-filter_complex', partes.join(';'), '-map', '[a]', '-t', duracion.toFixed(2), audio]);
  try { await normalizar(montaje, audio, salida); } finally { fs.rmSync(audio, { force: true }); }
}

// Edición pro: los clips que la composición no puede hacer sola (la cámara lenta interpolada, el
// rebobinado y las fotos de los congelados), con ffmpeg, en la carpeta de trabajo
async function prepararEdicion(linea, trabajo, rel) {
  const partida = path.join(trabajo, 'partida.mp4');
  const extra = {};
  const { rampa, rebobinado } = linea.extras;
  if (rampa) {
    await ff(['-ss', String(rampa.desde), '-t', String(rampa.largo), '-i', partida, '-an', '-vf',
      `minterpolate=fps=${30 * rampa.factor}:mi_mode=mci:mc_mode=aobmc:vsbmc=1,setpts=${rampa.factor}*PTS,fps=30`,
      '-c:v', 'libx264', '-preset', 'fast', '-crf', '17', '-pix_fmt', 'yuv420p', path.join(trabajo, 'lenta.mp4')]);
    extra.lenta = rel('lenta.mp4');
  }
  if (rebobinado) {
    await ff(['-ss', String(rebobinado.desde), '-t', String(rebobinado.largo), '-i', partida, '-an', '-vf',
      `reverse,setpts=PTS/${rebobinado.factor},fps=30`, '-c:v', 'libx264', '-preset', 'fast', '-crf', '17', '-pix_fmt', 'yuv420p', path.join(trabajo, 'rebobinado.mp4')]);
    extra.rebobinado = rel('rebobinado.mp4');
  }
  extra.fotos = {};
  for (const p of linea.planos.filter((x) => x.tipo === 'congelado')) {
    const nombre = `foto-${p.foto}.jpg`;
    await ff(['-ss', String(p.foto), '-i', partida, '-frames:v', '1', '-q:v', '2', path.join(trabajo, nombre)]);
    extra.fotos[String(p.foto)] = rel(nombre);
  }
  return extra;
}

async function videoEnIdioma({ id, idioma, urlBase, sinGrabar, destino, modo, forzarGancho, sinVoz, motorVoz, carpetaTrabajo, estilo }) {
  const pro = estilo === 'pro';
  const trabajo = crear(carpetaTrabajo ? carpetaTrabajo(idioma) : path.join(TRABAJO, 'juegos', `${id}-${idioma}`));
  const estrategia = estrategiaDe(id);
  if (!sinGrabar) {
    const { grabarPartida } = await import('./grabar.mjs');
    await grabarPartida({ urlBase, id, idioma, estrategia, carpeta: trabajo, modo });
  } else if (!fs.existsSync(path.join(trabajo, 'grabacion.json'))) {
    throw new Error(`--sin-grabar: aún no hay grabación de ${id} en ${idioma}`);
  }
  const datos = JSON.parse(fs.readFileSync(path.join(trabajo, 'grabacion.json'), 'utf8'));
  const m = elegirMomentos(datos);
  const juego = await textosJuego(id, idioma);
  const t = textosVideo(idioma);
  const unidad = (await marcador(id))?.unidad;
  const catalogo = juegosDelCatalogo();
  const conEspectador = fs.existsSync(path.join(trabajo, 'espectador.mp4'));

  // Guion, voz y línea de tiempo
  const guion = guionDe(id, idioma, { juego, unidad, puntuacion: m.puntuacion, frases: frasesDe(juego) });
  const tipoGancho = elegirGancho(id, { orden: catalogo.map((j) => j.id), forzado: forzarGancho });
  const pista = pistaPara(id);
  let voz;
  let linea;
  if (pro) {
    // Con el énfasis de cada frase, y los cortes en los golpes de la música
    const lineas = [[guion.gancho, guion.enfasis], ...guion.frases.map((f) => [f.texto, f.enfasis]), [guion.cierre]].map(([x, e]) => conEnfasis(x, e, AJUSTES_VOZ.pro));
    voz = sinVoz ? null : await locutar(lineas, idioma, trabajo, motorVoz, AJUSTES_VOZ.pro);
    const pulsos = pista ? (await golpes(pista)).filter((e) => e.nivel !== 'pequeño').map((e) => e.t) : [];
    linea = lineaDeEdicion({ guion, voz, datos, espectador: conEspectador, pulsos, tempo: REPASO_PRO.tempo, pegatinas: t.pegatinas });
  } else {
    const lineas = [guion.gancho, ...guion.frases.map((f) => f.texto), guion.cierre].map(sinMarcas);
    voz = sinVoz ? null : await locutar(lineas, idioma, trabajo, motorVoz);
    linea = lineaDeTiempo({ guion, voz, datos, gancho: tipoGancho, espectador: conEspectador });
  }

  const miniatura = catalogo.find((j) => j.id === id).miniatura;
  fs.copyFileSync(path.join(RAIZ, miniatura), path.join(trabajo, 'miniatura' + path.extname(miniatura)));
  const rel = (archivo) => path.relative(TRABAJO, path.join(trabajo, archivo)).split(path.sep).join('/');
  const props = {
    video: rel('partida.mp4'),
    espectador: conEspectador ? rel('espectador.mp4') : null,
    miniatura: rel('miniatura' + path.extname(miniatura)),
    gancho: { tipo: tipoGancho, texto: sinMarcas(guion.gancho), idioma, videoPersona: elegirPersona(id) },
    escenas: linea.escenas,
    subtitulos: linea.subtitulos,
    impactos: datos.eventos.filter((e) => e.tipo === 'impacto').map((e) => e.t),
    textos: {
      titulo: juego.titulo, puntuacion: m.puntuacion?.texto || null, puntuacionEtiqueta: t.puntuacion, lenta: t.lenta,
      juegaGratis: t.juegaGratis, dominio: DOMINIO, ventajas: t.ventajas, otraVez: t.otraVez,
    },
    duracion: linea.duracion,
  };
  if (pro) {
    Object.assign(props, { planos: linea.planos, rotulos: linea.textos, impactos: linea.impactos }, await prepararEdicion(linea, trabajo, rel));
    delete props.escenas;
    delete props.subtitulos;
  }
  const montaje = path.join(trabajo, pro ? 'montaje-pro.mp4' : 'montaje.mp4');
  await renderizar(pro ? 'EdicionPro' : 'AnuncioVR', props, montaje);

  const fin = pro ? '-pro' : '';
  const final = path.join(destino, `${id}-${idioma}${fin}.mp4`);
  const sinMusica = path.join(destino, `${id}-${idioma}${fin}-sin-musica.mp4`);
  const sinVozMp4 = path.join(destino, `${id}-${idioma}${fin}-sin-voz.mp4`);
  const dur = await duracion(montaje);
  for (const f of [sinMusica, sinVozMp4]) fs.rmSync(f, { force: true }); // de una vez anterior
  if (voz) {
    const vozWav = path.join(trabajo, 'voz-montada.wav');
    await pistaDeVoz(voz, linea.habla, dur, vozWav, pro ? repasoDeVoz(REPASO_PRO) : null);
    await conVoz(montaje, vozWav, pista, dur, final);
    if (pista) {
      await conVoz(montaje, vozWav, null, dur, sinMusica);
      await conMusica(montaje, pista, dur, sinVozMp4);
    } else await soloSonidoJuego(montaje, sinVozMp4);
  } else if (pista) {
    await conMusica(montaje, pista, dur, final);
    await soloSonidoJuego(montaje, sinMusica);
  } else {
    await soloSonidoJuego(montaje, final);
  }
  fs.writeFileSync(path.join(destino, `publicacion-${idioma}${fin}.txt`), publicacion({ idioma, id, juego, puntuacion: m.puntuacion }));

  const revision = await comprobarVideo(final);
  await mosaico(final, path.join(destino, `revision-${idioma}${fin}.jpg`));
  const avisos = [...revision.avisos];
  if (m.aciertos < 3 && datos.modo !== 'bruto') avisos.push(`el jugador automático solo acertó ${m.aciertos} veces (revisa lib/estrategias.mjs)`);
  if (!guion.propio) avisos.push(`sin guion en guiones/${id}.json: va con plantillas`);
  if (!conEspectador) avisos.push('grabado sin VR: no hay plano de espectador');
  const planos = pro ? `${linea.planos.length} planos` : linea.escenas.map((e) => e.plano).join(' ');
  log(`${avisos.length ? '⚠' : '✓'} ${path.relative(process.cwd(), final)}: ${revision.duracion} s, ${revision.lufs} LUFS, gancho ${tipoGancho}, ${m.aciertos} aciertos, ${voz ? 'voz' : 'sin voz'}${pista ? ', música ' + path.basename(pista) : ', sin música'} · planos: ${planos}${avisos.length ? ' · ' + avisos.join('; ') : ''}`);
  return {
    idioma, video: path.basename(final), modo: datos.modo ?? 'raton', gancho: tipoGancho, voz: !!voz, musica: pista ? path.basename(pista) : null,
    puntuacion: m.puntuacion, aciertos: m.aciertos, escenas: linea.escenas ?? linea.planos, estilo: estilo || 'normal', fps: datos.fps, gpu: datos.gpu, erroresPagina: datos.errores, ...revision, avisos,
  };
}

// carpetaTrabajo (idioma → carpeta) y destino: para montar una partida que no ha grabado la fábrica (lib/bruto.mjs)
export async function hacerVideoJuego({ id, idiomas, urlBase, sinGrabar, modo = 'vr', gancho: forzarGancho = null, sinVoz = false, motorVoz = 'natural', carpetaTrabajo = null, destino = null, estilo = null }) {
  destino ||= crear(path.join(SALIDA, 'juegos', id));
  const informePrevio = path.join(destino, 'informe.json');
  const informe = fs.existsSync(informePrevio) ? JSON.parse(fs.readFileSync(informePrevio, 'utf8')) : { id, videos: {} };
  informe.estrategia = estrategiaDe(id);
  for (const idioma of idiomas) {
    informe.videos[idioma] = await videoEnIdioma({ id, idioma, urlBase, sinGrabar, destino, modo, forzarGancho, sinVoz, motorVoz, carpetaTrabajo, estilo });
    informe.fecha = new Date().toISOString();
    fs.writeFileSync(informePrevio, JSON.stringify(informe, null, 2));
  }
  return informe;
}
