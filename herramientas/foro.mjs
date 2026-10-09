#!/usr/bin/env node
// Herramienta para leer y moderar el foro de sugerencias desde la terminal.
// La usa Claude Code para "mira el foro e implementa una sugerencia" (ver CLAUDE.md).
//
//   node herramientas/foro.mjs listar [--estado nueva] [--orden votos|recientes|actividad] [--ocultas]
//   node herramientas/foro.mjs ver <id>
//   node herramientas/foro.mjs estado <id> <nueva|estudio|desarrollo|hecha|existe|descartada> [--juego <id-del-catálogo>]
//   node herramientas/foro.mjs responder <id> "texto"  [--archivo respuesta.txt] [--sin-anclar]
//   node herramientas/foro.mjs ocultar <id> | mostrar <id>
//   node herramientas/foro.mjs ocultar-comentario <id> | mostrar-comentario <id>
//
// Variables de entorno:
//   FORO_URL    dirección de la web (por defecto, la de herramientas/foro.json)
//   FORO_TOKEN  la clave ADMIN_TOKEN del proyecto de Cloudflare. Solo hace falta para
//               cambiar estados, responder como VR Play y moderar. Nunca va en el repositorio.
import { readFileSync } from 'node:fs';

const ESTADOS = ['nueva', 'estudio', 'desarrollo', 'hecha', 'existe', 'descartada'];

function configuracion() {
  let url = process.env.FORO_URL;
  if (!url) {
    try {
      url = JSON.parse(readFileSync(new URL('./foro.json', import.meta.url), 'utf8')).url;
    } catch { /* sin archivo */ }
  }
  if (!url) salir('Falta la dirección del foro: define FORO_URL o pon "url" en herramientas/foro.json.');
  return { url: url.replace(/\/+$/, ''), token: process.env.FORO_TOKEN || '' };
}

function salir(mensaje) {
  console.error(mensaje);
  process.exit(1);
}

const { url, token } = configuracion();

async function api(ruta, { metodo = 'GET', datos, admin = false } = {}) {
  if (admin && !token) salir('Esta acción necesita la clave de administrador en la variable FORO_TOKEN.');
  const cabeceras = { 'content-type': 'application/json' };
  if (token) cabeceras.authorization = `Bearer ${token}`;
  let respuesta;
  try {
    respuesta = await fetch(`${url}/api${ruta}`, { method: metodo, headers: cabeceras, body: datos ? JSON.stringify(datos) : undefined });
  } catch (e) {
    salir(`No se puede conectar con ${url}: ${e.message}`);
  }
  let cuerpo = null;
  try { cuerpo = await respuesta.json(); } catch { /* sin JSON */ }
  if (!respuesta.ok) salir(`Error ${respuesta.status}: ${cuerpo?.error || 'respuesta inesperada (¿está desplegado el foro?)'}`);
  return cuerpo;
}

// Argumentos: posicionales y --opciones
const argumentos = process.argv.slice(2);
const opciones = {};
const posicionales = [];
for (let i = 0; i < argumentos.length; i++) {
  const a = argumentos[i];
  if (a.startsWith('--')) {
    const siguiente = argumentos[i + 1];
    if (siguiente !== undefined && !siguiente.startsWith('--')) {
      opciones[a.slice(2)] = siguiente;
      i++;
    } else {
      opciones[a.slice(2)] = true;
    }
  } else {
    posicionales.push(a);
  }
}
const [orden, ...resto] = posicionales;

function pedirId(valor) {
  const id = Number(valor);
  if (!Number.isInteger(id) || id <= 0) salir('Indica el número de la sugerencia o del comentario.');
  return id;
}

const linea = (s) => `#${s.id} [${s.estado}${s.juego ? ` → ${s.juego}` : ''}]${s.oculta ? ' (OCULTA)' : ''} ♥ ${s.me_gusta} · ${s.comentarios} com · ${s.titulo}`
  + `\n    ${[s.tipo, s.manos && `manos: ${s.manos}`, s.accion && `acción: ${s.accion}`].filter(Boolean).join(' · ') || '(sin ficha)'} · ${s.autor} · ${s.creada} UTC`;

switch (orden) {
  case 'listar': {
    const params = new URLSearchParams({ orden: opciones.orden || 'votos' });
    if (opciones.estado) params.set('estado', opciones.estado);
    if (opciones.ocultas) params.set('ocultas', '1');
    const { sugerencias } = await api(`/sugerencias?${params}`);
    if (!sugerencias.length) console.log('No hay sugerencias.');
    for (const s of sugerencias) console.log(linea(s));
    break;
  }
  case 'ver': {
    const { sugerencia: s, comentarios } = await api(`/sugerencias/${pedirId(resto[0])}`);
    console.log(linea(s));
    console.log(`\n${s.descripcion}\n`);
    console.log(`Comentarios (${comentarios.length}):`);
    for (const c of comentarios) {
      const marcas = [c.oficial && 'OFICIAL', c.anclado && 'ANCLADO', c.oculto && 'OCULTO'].filter(Boolean).join(', ');
      console.log(`  - [c${c.id}] ${c.autor}${marcas ? ` (${marcas})` : ''} · ${c.creada} UTC\n    ${c.texto.replace(/\n/g, '\n    ')}`);
    }
    break;
  }
  case 'estado': {
    const id = pedirId(resto[0]);
    const estado = resto[1];
    if (!ESTADOS.includes(estado)) salir(`Estado no válido. Usa: ${ESTADOS.join(', ')}.`);
    const datos = { estado };
    if (opciones.juego !== undefined) datos.juego = opciones.juego === true ? '' : opciones.juego;
    const { sugerencia } = await api(`/sugerencias/${id}`, { metodo: 'PATCH', datos, admin: true });
    console.log(linea(sugerencia));
    break;
  }
  case 'responder': {
    const id = pedirId(resto[0]);
    const texto = opciones.archivo ? readFileSync(opciones.archivo, 'utf8') : resto.slice(1).join(' ');
    if (!texto.trim()) salir('Escribe el texto de la respuesta (o usa --archivo).');
    const { id: comentario } = await api(`/sugerencias/${id}/comentarios`, {
      metodo: 'POST', datos: { texto, anclar: !opciones['sin-anclar'] }, admin: true,
    });
    console.log(`Respuesta oficial publicada (c${comentario})${opciones['sin-anclar'] ? '' : ' y anclada'} en la sugerencia #${id}.`);
    break;
  }
  case 'ocultar':
  case 'mostrar': {
    const { sugerencia } = await api(`/sugerencias/${pedirId(resto[0])}`, { metodo: 'PATCH', datos: { oculta: orden === 'ocultar' }, admin: true });
    console.log(linea(sugerencia));
    break;
  }
  case 'ocultar-comentario':
  case 'mostrar-comentario': {
    const id = pedirId(resto[0]);
    await api(`/comentarios/${id}`, { metodo: 'PATCH', datos: { oculto: orden === 'ocultar-comentario' }, admin: true });
    console.log(`Comentario c${id} ${orden === 'ocultar-comentario' ? 'oculto' : 'visible'}.`);
    break;
  }
  default:
    console.log(readFileSync(new URL(import.meta.url), 'utf8').split('\n').slice(1, 18).map((l) => l.replace(/^\/\/ ?/, '')).join('\n'));
}
