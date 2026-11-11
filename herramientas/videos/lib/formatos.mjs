// Formatos de varios juegos, con partidas ya grabadas (trabajo/juegos/<id>-<idioma>/) y datos
// reales de la web (vrplaygame.com/api: partidas jugadas, récords y el foro):
//   anuncio  15 s: gancho, 8 cortes de juegos al ritmo con frases, ráfaga y cierre
//   top      ~21 s: los 5 juegos más jugados, del 5 al 1 (con suspense antes del 1)
//   reto     ~15 s: «el récord de <juego> está en X, ¿lo superas?» (récord de la clasificación)
//   duelo    ~14 s: dos juegos en pantalla partida, «¿cuál juegas primero? comenta 1 o 2»
//   foro     ~16 s: la sugerencia del foro que se convirtió en el juego, y el juego
// Si falta la partida de un juego, se graba (con --sin-grabar no: se salta ese juego).
// Sale en salida/formatos/<formato>[-<id>]/: <nombre>-<idioma>.mp4 y publicacion-<idioma>.txt.
import fs from 'node:fs';
import path from 'node:path';
import { RAIZ, SALIDA, TRABAJO, crear, duracion, ff, juegosDelCatalogo, log, textosDe, textosJuego } from './comun.mjs';
import { estrategiaDe } from './estrategias.mjs';
import { intensidad, mejorVentana } from './momentos.mjs';
import { DOMINIO, textosVideo } from './textos.mjs';
import { textosFormato } from './textos-formatos.mjs';
import { normalizar, pistaPara } from './montar.mjs';
import { renderizar } from './render.mjs';

const API = 'https://vrplaygame.com/api';
export const FORMATOS = ['anuncio', 'top', 'reto', 'duelo', 'foro'];

async function api(ruta) {
  try {
    const r = await fetch(API + ruta, { signal: AbortSignal.timeout(10000) });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

const rellenar = (x, datos) => (typeof x === 'string' ? x.replace(/\{(\w+)\}/g, (_, k) => datos[k] ?? '') : { ...x, texto: rellenar(x.texto, datos) });
// Líneas de rótulo con su retraso: la primera enseguida y las demás cada `paso` segundos
const lineas = (lista, datos, paso = 0.42) => lista.map((l, i) => {
  const x = rellenar(l, datos);
  // Las líneas largas, más pequeñas para que no se salgan por los lados
  const tam = [...(typeof x === 'string' ? x : x.texto)].length > 15 ? (typeof x === 'string' ? 68 : 96) : undefined;
  return typeof x === 'string' ? { texto: x, t: i * paso, tam } : { texto: x.texto, caja: x.caja ? COLOR_CAJA[i % COLOR_CAJA.length] : null, tinta: '#fff', grande: true, t: i * paso, tam };
});
const COLOR_CAJA = ['#f0452a', '#ff8a62', '#7c4dff'];

// ─── Partidas ────────────────────────────────────────────────────────────
// La grabación de un juego: la del idioma pedido o, si no hay, la de otro (el juego se ve igual
// salvo los rótulos de dentro del juego)
function grabacionDe(id, idioma) {
  const carpetas = [idioma, 'es', 'en', ...fs.readdirSync(path.join(TRABAJO, 'juegos')).filter((n) => n.startsWith(id + '-')).map((n) => n.slice(id.length + 1))];
  for (const x of carpetas) {
    const rel = `juegos/${id}-${x}`;
    const dir = path.join(TRABAJO, rel);
    if (!fs.existsSync(path.join(dir, 'partida.mp4')) || !fs.existsSync(path.join(dir, 'grabacion.json'))) continue;
    const datos = JSON.parse(fs.readFileSync(path.join(dir, 'grabacion.json'), 'utf8'));
    return { id, rel, datos, espectador: fs.existsSync(path.join(dir, 'espectador.mp4')) ? `${rel}/espectador.mp4` : null, video: `${rel}/partida.mp4` };
  }
  return null;
}

// Graba las partidas que falten (una vez, en el primer idioma). Devuelve las que hay.
async function grabaciones(ids, idioma, { sinGrabar }) {
  crear(path.join(TRABAJO, 'juegos'));
  const faltan = ids.filter((id) => !grabacionDe(id, idioma));
  if (faltan.length && !sinGrabar) {
    const { grabarPartida } = await import('./grabar.mjs');
    const { arrancarServidor } = await import('./servidor.mjs');
    const servidor = await arrancarServidor();
    try {
      for (const id of faltan) {
        const carpeta = crear(path.join(TRABAJO, 'juegos', `${id}-${idioma}`));
        try {
          await grabarPartida({ urlBase: servidor.url, id, idioma, estrategia: estrategiaDe(id), carpeta });
        } catch (e) {
          log(`no se pudo grabar ${id}: ${e.message.split('\n')[0]}`);
        }
      }
    } finally {
      servidor.cerrar();
    }
  }
  return ids.map((id) => grabacionDe(id, idioma)).filter(Boolean);
}

// El trozo más emocionante de una partida, de `largo` segundos
function tramo(g, largo) {
  const fin = g.datos.duracion - 0.3;
  const v = mejorVentana(g.datos.eventos, largo, Math.min(1.5, Math.max(0, fin - largo)), fin, []);
  return v ? +v.desde.toFixed(2) : 0;
}
const viveza = (g) => intensidad(g.datos.eventos, 0, 1e9) / Math.max(1, g.datos.duracion);

// Los juegos publicados (sin los de pruebas), con los que el bot juega bien primero
function publicados() {
  return juegosDelCatalogo().filter((j) => !j.pruebas && estrategiaDe(j.id).modo !== 'pendiente').map((j) => j.id);
}
const totalJuegos = () => Math.floor(juegosDelCatalogo().filter((j) => !j.pruebas).length / 5) * 5;

async function titulo(id, idioma) {
  return (await textosJuego(id, idioma)).titulo;
}

// El récord en el formato de la web («58 puntos», «1:05,30»), sin el alias de quien lo tiene
async function formatearRecord(id, valor, idioma, unidad) {
  if (unidad === 'tiempo') {
    const min = Math.floor(valor / 60);
    const seg = (valor - min * 60).toLocaleString(idioma, { minimumFractionDigits: 2, maximumFractionDigits: 2 });
    return min ? `${min}:${seg.padStart(5, '0')}` : `${seg} s`;
  }
  if (unidad === 'diferencia') return `+${valor}`;
  const plantilla = (await textosDe(idioma)).clasificacion?.unidades?.[unidad];
  const cifra = valor.toLocaleString(idioma);
  const texto = typeof plantilla === 'object' ? plantilla[new Intl.PluralRules(idioma).select(valor)] ?? plantilla.other : plantilla;
  return texto ? texto.replace('{n}', valor).replace('{cifra}', cifra) : cifra;
}

// ─── Planes ──────────────────────────────────────────────────────────────
function cierre(en, dura, titulo, miniatura) {
  return { tipo: 'cierre', en, dura, textos: { titulo }, miniatura };
}

async function planAnuncio({ idioma, juegos, semilla }) {
  const t = textosFormato(idioma);
  const n = totalJuegos();
  const gs = juegos.slice().sort((a, b) => viveza(b) - viveza(a));
  const escenas = [];
  const textos = [];
  const efectos = [];
  const principal = gs[0];
  escenas.push({ tipo: 'clip', en: 0, dura: 2, video: principal.video, desde: tramo(principal, 2), golpe: false });
  const gancho = t.anuncio.ganchos[semilla % t.anuncio.ganchos.length];
  textos.push({ en: 0, dura: 2, lineas: lineas(gancho, { n }, 0.45) });
  gancho.forEach((l, i) => typeof l !== 'string' && efectos.push({ en: i * 0.45, archivo: 'efectos/golpe.ogg', volumen: 0.6 }));
  // 8 cortes de 1 s: cada juego en su mejor momento, alternando gafas y espectador
  const cortes = gs.slice(0, 8);
  while (cortes.length < 8) cortes.push(gs[cortes.length % gs.length]);
  for (let i = 0; i < 8; i++) {
    const g = cortes[i];
    const espectador = i % 3 === 1 && g.espectador;
    escenas.push({ tipo: 'clip', en: 2 + i, dura: 1, video: espectador || g.video, desde: tramo(g, 1), chip: await titulo(g.id, idioma) });
    efectos.push({ en: 2 + i - 0.12, archivo: 'efectos/whoosh.ogg', volumen: 0.45 });
  }
  t.anuncio.frases.forEach((f, i) => textos.push({ en: 2 + i * 2, dura: i === 3 ? 3 : 2, lineas: lineas(f, { n }, 0.38) }));
  const resto = gs.slice(8).concat(gs).slice(0, 6);
  escenas.push({ tipo: 'rafaga', en: 10, dura: 1, fotos: resto.map((g) => ({ video: g.video, desde: tramo(g, 0.4) })) });
  escenas.push(cierre(11, 4, rellenar(t.anuncio.titulo, { n }), null));
  efectos.push({ en: 11, archivo: 'efectos/golpe.ogg', volumen: 0.8 });
  return { duracion: 15, escenas, textos, efectos, publicacion: rellenar(t.anuncio.publicacion, { n }), nombre: 'anuncio' };
}

async function planTop({ idioma, juegos, partidas }) {
  const t = textosFormato(idioma);
  const top = juegos.slice(0, 5); // ya vienen ordenados de más a menos jugado
  const escenas = [];
  const textos = [];
  const efectos = [];
  escenas.push({ tipo: 'rafaga', en: 0, dura: 2.5, fotos: top.concat(top).map((g) => ({ video: g.video, desde: tramo(g, 0.3) })) });
  textos.push({ en: 0, dura: 2.5, lineas: lineas(t.top.gancho, {}, 0.45) });
  let en = 2.5;
  for (let puesto = top.length; puesto >= 1; puesto--) {
    const g = top[puesto - 1];
    if (puesto === 1) {
      textos.push({ en, dura: 1.4, y: 760, lineas: lineas(t.top.suspense, {}, 0.5) });
      escenas.push({ tipo: 'clip', en, dura: 1.4, video: g.video, desde: tramo(g, 1.4), golpe: false, oscuro: true });
      efectos.push({ en: en + 0.5, archivo: 'efectos/tic.ogg', volumen: 0.7 });
      en += 1.4;
    }
    const dura = puesto === 1 ? 3.4 : 2.6;
    escenas.push({ tipo: 'ranking', en, dura, puesto, titulo: await titulo(g.id, idioma), video: g.video, desde: tramo(g, dura), dato: partidas[g.id] ? rellenar(t.top.dato, { n: partidas[g.id] }) : null });
    efectos.push({ en: en - 0.1, archivo: puesto === 1 ? 'efectos/golpe.ogg' : 'efectos/whoosh.ogg', volumen: 0.6 });
    en += dura;
  }
  escenas.push(cierre(en, 3.5, t.top.titulo, null));
  return { duracion: +(en + 3.5).toFixed(2), escenas, textos, efectos, publicacion: t.top.publicacion, nombre: 'top' };
}

async function planReto({ idioma, g, record }) {
  const t = textosFormato(idioma);
  const juego = await titulo(g.id, idioma);
  const escenas = [];
  const textos = [];
  const efectos = [];
  const datos = { juego, valor: record };
  escenas.push({ tipo: 'clip', en: 0, dura: 3, video: g.video, desde: tramo(g, 3), golpe: false });
  textos.push({ en: 0, dura: 3, lineas: lineas(record ? t.reto.gancho : t.reto.sinRecord, datos, 0.5) });
  efectos.push({ en: 0.5, archivo: 'efectos/golpe.ogg', volumen: 0.6 });
  const a = tramo(g, 3.5);
  escenas.push({ tipo: 'clip', en: 3, dura: 3.5, video: g.video, desde: a });
  escenas.push({ tipo: 'clip', en: 6.5, dura: 3, video: g.espectador || g.video, desde: a + 3.5 < g.datos.duracion - 3 ? a + 3.5 : Math.max(0, a - 3) });
  if (record) textos.push({ en: 3.2, dura: 3.3, lineas: lineas(t.reto.pregunta, datos) });
  textos.push({ en: 9.5, dura: 2.5, lineas: lineas(t.reto.final, datos) });
  escenas.push({ tipo: 'clip', en: 9.5, dura: 2.5, video: g.video, desde: tramo(g, 2.5), golpe: false });
  escenas.push(cierre(12, 3.5, juego, g.miniatura));
  [3, 6.5, 9.5].forEach((x) => efectos.push({ en: x - 0.12, archivo: 'efectos/whoosh.ogg', volumen: 0.45 }));
  const publicacion = rellenar(record ? t.reto.publicacion : t.reto.publicacionSinRecord, datos);
  return { duracion: 15.5, escenas, textos, efectos, publicacion, nombre: `reto-${g.id}` };
}

async function planDuelo({ idioma, a, b }) {
  const t = textosFormato(idioma);
  const [ta, tb] = [await titulo(a.id, idioma), await titulo(b.id, idioma)];
  const escenas = [{ tipo: 'duelo', en: 0, dura: 11, a: { video: a.video, titulo: ta, desde: tramo(a, 11) }, b: { video: b.video, titulo: tb, desde: tramo(b, 11) } }];
  const textos = [
    { en: 0.2, dura: 4.5, y: 330, lineas: lineas(t.duelo.gancho, {}, 0.45) },
    { en: 6, dura: 5, y: 330, lineas: lineas(t.duelo.comenta, {}, 0.45) },
  ];
  escenas.push(cierre(11, 3.5, `${ta} · ${tb}`, null));
  const efectos = [{ en: 0.5, archivo: 'efectos/golpe.ogg', volumen: 0.6 }, { en: 6.4, archivo: 'efectos/aparecer.ogg', volumen: 0.6 }, { en: 11, archivo: 'efectos/whoosh.ogg', volumen: 0.5 }];
  return { duracion: 14.5, escenas, textos, efectos, publicacion: rellenar(t.duelo.publicacion, { a: ta, b: tb }), nombre: `duelo-${a.id}-${b.id}` };
}

async function planForo({ idioma, g, sugerencia }) {
  const t = textosFormato(idioma);
  const juego = await titulo(g.id, idioma);
  const escenas = [{ tipo: 'foro', en: 0, dura: 3.4, etiqueta: t.foro.etiqueta, titulo: sugerencia.titulo, meGusta: sugerencia.me_gusta, estado: t.foro.estado, video: g.video, desde: tramo(g, 3.4) }];
  const textos = [{ en: 3.4, dura: 2.4, lineas: lineas(t.foro.hecho, {}, 0.45) }];
  const efectos = [{ en: 0.2, archivo: 'efectos/aparecer.ogg', volumen: 0.6 }, { en: 3.4, archivo: 'efectos/golpe.ogg', volumen: 0.7 }];
  let en = 3.4;
  const desde = tramo(g, 7);
  for (const [i, dura] of [2.4, 2.2, 2.2].entries()) {
    escenas.push({ tipo: 'clip', en, dura, video: i === 1 && g.espectador ? g.espectador : g.video, desde: desde + i * 2.3, chip: i === 0 ? null : juego });
    if (i) efectos.push({ en: en - 0.12, archivo: 'efectos/whoosh.ogg', volumen: 0.45 });
    en += dura;
  }
  textos.push({ en: en - 2.2, dura: 2.2, lineas: lineas(t.foro.pide, {}, 0.45) });
  escenas.push(cierre(en, 3.5, juego, g.miniatura));
  return { duracion: +(en + 3.5).toFixed(2), escenas, textos, efectos, publicacion: rellenar(t.foro.publicacion, { juego }), nombre: `foro-${g.id}` };
}

// ─── Montar ──────────────────────────────────────────────────────────────
async function montar(plan, idioma, destino) {
  const t = textosFormato(idioma);
  const v = textosVideo(idioma);
  // Música: la de musica/ (o la generada), elegida por el nombre del vídeo para que no cambie
  const pista = pistaPara(plan.nombre);
  let musica = null;
  if (pista) {
    const copia = path.join(crear(path.join(TRABAJO, 'musica')), path.basename(pista));
    if (!fs.existsSync(copia)) fs.copyFileSync(pista, copia);
    musica = `musica/${path.basename(pista)}`;
  }
  // Las miniaturas, copiadas a trabajo/ para que Remotion las lea
  const minis = crear(path.join(TRABAJO, 'miniaturas'));
  for (const e of plan.escenas) {
    if (e.tipo !== 'cierre') continue;
    const id = e.miniatura;
    const origen = id ? juegosDelCatalogo().find((j) => j.id === id)?.miniatura : 'favicon.svg';
    const nombre = (id || 'vrplay') + path.extname(origen);
    fs.copyFileSync(path.join(RAIZ, origen), path.join(minis, nombre));
    e.miniatura = `miniaturas/${nombre}`;
  }
  const props = {
    ...plan, musica, miniatura: 'marca/favicon.svg',
    cierre: { juegaGratis: v.juegaGratis, dominio: DOMINIO, ventajas: v.ventajas },
  };
  const crudo = path.join(destino, `${plan.nombre}-${idioma}-crudo.mp4`);
  await renderizar('Formato', props, crudo);
  const audio = crudo.replace(/\.mp4$/, '.wav');
  await ff(['-i', crudo, '-vn', '-ac', '2', '-ar', '48000', audio]);
  const final = path.join(destino, `${plan.nombre}-${idioma}.mp4`);
  await normalizar(crudo, audio, final);
  fs.rmSync(crudo, { force: true });
  fs.rmSync(audio, { force: true });
  const enlace = `https://${DOMINIO}/?lang=${idioma}`;
  fs.writeFileSync(path.join(destino, `publicacion-${idioma}.txt`), `${rellenar(plan.publicacion, { enlace })}\n\n${t.hashtags.join(' ')}\n`);
  // Hoja de revisión: 6 fotogramas
  await ff(['-i', final, '-vf', `fps=6/${plan.duracion},scale=270:480,tile=6x1`, '-frames:v', '1', path.join(destino, `revision-${idioma}.jpg`)]);
  log(`✓ ${path.relative(process.cwd(), final)}: ${(await duracion(final)).toFixed(1)} s`);
  return final;
}

// formato: anuncio | top | reto | duelo | foro. juegos: ids (reto y foro: uno; duelo: dos; los
// demás: los que se usan, si no se dan se eligen solos)
export async function hacerFormato({ formato, idiomas, juegos: elegidos = [], sinGrabar = false, semilla = Math.floor(Date.now() / 864e5) }) {
  if (!FORMATOS.includes(formato)) throw new Error(`Formato «${formato}» desconocido: ${FORMATOS.join(', ')}`);
  const primero = idiomas[0];
  const estadisticas = (await api('/juegos/estadisticas'))?.juegos || {};
  const partidas = Object.fromEntries(Object.entries(estadisticas).map(([id, e]) => [id, e.partidas || 0]));
  const lista = publicados();
  // Los más jugados primero (y, a igualdad, en el orden del catálogo)
  const masJugados = lista.slice().sort((a, b) => (partidas[b] || 0) - (partidas[a] || 0));
  const giro = (arr, n) => arr.slice(n % arr.length).concat(arr.slice(0, n % arr.length));
  let ids;
  let extra = {};
  if (formato === 'anuncio') ids = elegidos.length ? elegidos : giro(lista.filter((id) => estrategiaDe(id).probado).concat(masJugados.slice(0, 10)).filter((x, i, a) => a.indexOf(x) === i), semilla).slice(0, 12);
  else if (formato === 'top') ids = elegidos.length ? elegidos : masJugados.slice(0, 5);
  else if (formato === 'reto') ids = [elegidos[0] || giro(masJugados.slice(0, 15), semilla)[0]];
  else if (formato === 'duelo') ids = elegidos.length >= 2 ? elegidos.slice(0, 2) : giro(masJugados.slice(0, 12), semilla).slice(0, 2);
  else if (formato === 'foro') {
    const foro = (await api('/sugerencias?orden=votos'))?.sugerencias || [];
    const hechas = foro.filter((s) => s.estado === 'hecha' && s.juego && !s.oculta && lista.includes(s.juego));
    const sugerencia = elegidos[0] ? hechas.find((s) => s.juego === elegidos[0]) : giro(hechas, semilla)[0];
    if (!sugerencia) throw new Error('No hay ninguna sugerencia del foro hecha con su juego publicado' + (elegidos[0] ? ` para «${elegidos[0]}»` : ''));
    ids = [sugerencia.juego];
    extra = { sugerencia };
  }
  const gs = await grabaciones(ids, primero, { sinGrabar });
  if (!gs.length) throw new Error('No hay partidas grabadas para este formato (quita --sin-grabar para grabarlas)');
  if (formato === 'duelo' && gs.length < 2) throw new Error('El duelo necesita dos partidas');
  const carpeta = crear(path.join(SALIDA, 'formatos', formato === 'anuncio' || formato === 'top' ? formato : `${formato}-${gs.map((g) => g.id).join('-')}`));
  let record = null;
  if (formato === 'reto') {
    const clasif = await api(`/clasificacion/${gs[0].id}`);
    record = clasif?.top?.[0] ? { valor: clasif.top[0].valor, unidad: clasif.unidad } : null;
  }
  const hechos = [];
  for (const idioma of idiomas) {
    gs.forEach((g) => (g.miniatura = g.id));
    let plan;
    if (formato === 'anuncio') plan = await planAnuncio({ idioma, juegos: gs, semilla });
    else if (formato === 'top') plan = await planTop({ idioma, juegos: gs, partidas });
    else if (formato === 'reto') plan = await planReto({ idioma, g: gs[0], record: record ? await formatearRecord(gs[0].id, record.valor, idioma, record.unidad) : null });
    else if (formato === 'duelo') plan = await planDuelo({ idioma, a: gs[0], b: gs[1] });
    else plan = await planForo({ idioma, g: gs[0], sugerencia: extra.sugerencia });
    hechos.push(await montar(plan, idioma, carpeta));
  }
  return hechos;
}
