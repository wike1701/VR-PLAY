// Fábrica de vídeos de VR Play (solo en local, no publica nada). Guía: herramientas/videos/GUIA.md
//   node herramientas/videos/fabrica.mjs comprobar
//   node herramientas/videos/fabrica.mjs juego <id> [<id>…] | --todos [--pruebas] | --nuevos
//   node herramientas/videos/fabrica.mjs editar <video> [--clips clips.json] [--encuadre 0.5] [--encajar]
//   node herramientas/videos/fabrica.mjs bruto <partida en bruto> [--solo-trocear] [--juegos id,id] [--nombre n]
//   node herramientas/videos/fabrica.mjs voz-prueba <id>   (muestras de entonación para elegir)
//   node herramientas/videos/fabrica.mjs formato anuncio|top|reto|duelo|foro [<id>…]   (vídeos de varios juegos)
//   node herramientas/videos/fabrica.mjs lote [--juegos 2]   (los vídeos de la semana y su parrilla)
//   node herramientas/videos/fabrica.mjs probar-bot <id> [--modo vr|raton] [--segundos 12]   (¿juega bien el bot?)
// Opciones: --idioma es|en (por defecto los dos), --sin-grabar (monta con la grabación ya hecha),
//   --modo vr|raton (cómo se graba; por defecto vr), --gancho web|persona|impacto|reto (fuerza el
//   gancho), --voz natural|kokoro (natural = Chatterbox; por defecto, si está), --sin-voz,
//   --estilo pro (edición gaming viral: cortes al ritmo, impactos, rampas; remotion/EdicionPro.jsx)
import fs from 'node:fs';
import path from 'node:path';
import { SALIDA, TRABAJO, crear, log, juegosDelCatalogo } from './lib/comun.mjs';
import { estrategiaDe } from './lib/estrategias.mjs';

const args = process.argv.slice(2);
const orden = args[0];
const opcion = (nombre) => {
  const i = args.indexOf('--' + nombre);
  return i < 0 ? null : args[i + 1] && !args[i + 1].startsWith('--') ? args[i + 1] : true;
};
const sueltos = args.slice(1).filter((a, i, l) => !a.startsWith('--') && !(l[i - 1]?.startsWith('--') && ['idioma', 'clips', 'encuadre', 'modo', 'gancho', 'voz', 'juegos', 'nombre', 'estilo', 'segundos', 'reloj'].includes(l[i - 1].slice(2))));
// --idioma es | es,en,fr | todos (los 9 de la web). Por defecto, es y en.
const TODOS_IDIOMAS = ['es', 'en', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh'];
const idiomas = opcion('idioma') === 'todos' ? TODOS_IDIOMAS : typeof opcion('idioma') === 'string' ? opcion('idioma').split(',') : ['es', 'en'];

async function ordenJuego() {
  const catalogo = juegosDelCatalogo();
  let ids;
  if (opcion('todos') || opcion('nuevos')) {
    ids = catalogo.filter((j) => opcion('pruebas') || !j.pruebas).map((j) => j.id);
    if (opcion('nuevos')) ids = ids.filter((id) => !idiomas.every((x) => fs.existsSync(path.join(SALIDA, 'juegos', id, `${id}-${x}.mp4`))));
    const pendientes = ids.filter((id) => estrategiaDe(id).modo === 'pendiente');
    if (pendientes.length) log(`sin jugador automático todavía (se saltan): ${pendientes.join(', ')}`);
    ids = ids.filter((id) => !pendientes.includes(id));
  } else ids = sueltos;
  if (!ids.length) throw new Error('Di qué juego: juego <id>, juego --todos o juego --nuevos');
  for (const id of ids) if (!catalogo.some((j) => j.id === id)) throw new Error(`No existe el juego «${id}» en juegos/catalogo.js`);

  const { hacerVideoJuego } = await import('./lib/montar.mjs');
  const { arrancarServidor } = await import('./lib/servidor.mjs');
  const servidor = opcion('sin-grabar') ? null : await arrancarServidor();
  const fallos = [];
  try {
    for (const id of ids) {
      try {
        await hacerVideoJuego({
          id, idiomas, urlBase: servidor?.url, sinGrabar: !!opcion('sin-grabar'),
          modo: opcion('modo') === 'raton' ? 'raton' : 'vr', gancho: typeof opcion('gancho') === 'string' ? opcion('gancho') : null, sinVoz: !!opcion('sin-voz'), motorVoz: opcion('voz') === 'kokoro' ? 'kokoro' : 'natural',
          estilo: opcion('estilo') === 'pro' ? 'pro' : null,
        });
      } catch (e) {
        fallos.push(id);
        console.error(`✗ ${id}: ${e.message}`);
      }
    }
  } finally {
    servidor?.cerrar();
    await (await import('./lib/render.mjs')).cerrarRender();
  }
  log(`${ids.length - fallos.length}/${ids.length} juegos hechos en ${path.relative(process.cwd(), path.join(SALIDA, 'juegos'))}` + (fallos.length ? ` (fallaron: ${fallos.join(', ')})` : ''));
  if (fallos.length) process.exitCode = 1;
}

async function ordenEditar() {
  const video = sueltos[0];
  if (!video || !fs.existsSync(video)) throw new Error('Di qué vídeo: editar <ruta del vídeo>');
  const { editarVideo } = await import('./lib/editar.mjs');
  try {
    await editarVideo({
      video: path.resolve(video),
      idioma: opcion('idioma') || null,
      clips: opcion('clips') ? JSON.parse(fs.readFileSync(opcion('clips'), 'utf8')) : null,
      encuadre: opcion('encuadre') ? parseFloat(opcion('encuadre')) : null,
      encajar: !!opcion('encajar'),
    });
  } finally {
    await (await import('./lib/render.mjs')).cerrarRender();
  }
}

async function ordenBruto() {
  const video = sueltos[0];
  if (!video || !fs.existsSync(video)) throw new Error('Di qué vídeo: bruto <ruta de la partida en bruto>');
  const { hacerBruto } = await import('./lib/bruto.mjs');
  try {
    await hacerBruto({
      video: path.resolve(video), nombre: typeof opcion('nombre') === 'string' ? opcion('nombre') : null,
      soloTrocear: !!opcion('solo-trocear'), juegos: typeof opcion('juegos') === 'string' ? opcion('juegos').split(',') : null,
      idiomas: opcion('idioma') ? [opcion('idioma')] : ['es'], gancho: typeof opcion('gancho') === 'string' ? opcion('gancho') : 'impacto',
      sinVoz: !!opcion('sin-voz'), motorVoz: opcion('voz') === 'kokoro' ? 'kokoro' : 'natural',
      estilo: opcion('estilo') === 'pro' ? 'pro' : null,
    });
  } finally {
    await (await import('./lib/render.mjs')).cerrarRender();
  }
}

async function ordenVozPrueba() {
  const id = sueltos[0];
  if (!id) throw new Error('Di qué juego: voz-prueba <id>');
  const { pruebaDeVoz } = await import('./lib/guion.mjs');
  const idioma = opcion('idioma') || 'es';
  const destino = crear(path.join(SALIDA, 'pruebas-voz', id));
  for (const m of await pruebaDeVoz(id, idioma, destino)) log(`${m.nombre}: ${path.relative(process.cwd(), m.salida)} (expresividad ${m.expresividad.join(' / ')})`);
}

async function ordenFormato() {
  const formato = sueltos[0];
  const { hacerFormato, FORMATOS } = await import('./lib/formatos.mjs');
  if (!formato) throw new Error(`Di qué formato: formato ${FORMATOS.join('|')} [<id>…]`);
  try {
    await hacerFormato({ formato, idiomas, juegos: sueltos.slice(1), sinGrabar: !!opcion('sin-grabar') });
  } finally {
    await (await import('./lib/render.mjs')).cerrarRender();
  }
}

async function ordenLote() {
  const { hacerLote } = await import('./lib/lote.mjs');
  try {
    await hacerLote({ idiomas, maxJuegos: +(opcion('juegos') || 2), sinVoz: !!opcion('sin-voz'), motorVoz: opcion('voz') === 'kokoro' ? 'kokoro' : 'natural', modo: opcion('modo') === 'raton' ? 'raton' : 'vr' });
  } finally {
    await (await import('./lib/render.mjs')).cerrarRender();
  }
}

async function ordenProbarBot() {
  const id = sueltos[0];
  if (!id) throw new Error('Di qué juego: probar-bot <id>');
  const { probarBot } = await import('./lib/probar.mjs');
  await probarBot({ id, modo: opcion('modo') === 'raton' ? 'raton' : 'vr', segundos: +(opcion('segundos') || 12), idioma: opcion('idioma') || 'es' });
}

async function principal() {
  crear(TRABAJO);
  if (orden === 'comprobar') return (await import('./lib/comprobar.mjs')).comprobarInstalacion();
  // Efectos y música de reserva si faltan (en la nube); antes de elegir la música de cada vídeo
  if (['juego', 'bruto', 'editar', 'formato', 'lote'].includes(orden)) await (await import('./lib/recursos.mjs')).recursosDeReserva();
  if (orden === 'juego') return ordenJuego();
  if (orden === 'editar') return ordenEditar();
  if (orden === 'bruto') return ordenBruto();
  if (orden === 'voz-prueba') return ordenVozPrueba();
  if (orden === 'probar-bot') return ordenProbarBot();
  if (orden === 'formato') return ordenFormato();
  if (orden === 'lote') return ordenLote();
  console.log(fs.readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(0, 10).join('\n').replace(/^\/\/ ?/gm, ''));
}

principal().catch((e) => {
  console.error('✗', e.message);
  process.exitCode = 1;
});
