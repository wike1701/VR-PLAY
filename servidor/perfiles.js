// Perfiles públicos (ver PERFILES.md, punto 6).
//   GET /api/perfiles?q=raf   → { perfiles: [{ alias, avatar, ideas }] } (buscador de la portada, como mucho 12)
//   GET /api/perfiles/:alias  → { perfil: { alias, avatar, creada, ideas, meGusta, juegos: [...], enMarcha: [...] } }
// Solo sale lo público: el alias, el avatar, la fecha de alta y sus sugerencias del foro que no estén
// ocultas ni descartadas. Nunca el correo, el año de nacimiento, sus favoritos ni los «me gusta» que ha dado.
// Las cuentas suspendidas o sin alias no salen.
import { json, error } from './comun.js';
import { claveAlias } from './sesion.js';

const VISIBLES = "oculta = 0 AND estado != 'descartada'";

export async function onRequestGet({ request, env, params }) {
  if (!env.DB) return error('Las cuentas no están disponibles ahora mismo.', 503, 'no_disponible');
  return params.id ? perfil(env, params.id) : buscar(env, new URL(request.url).searchParams.get('q'));
}

async function buscar(env, q) {
  const clave = claveAlias(String(q || '').replace(/^@/, '').trim().slice(0, 20)).replace(/[%\\]/g, '');
  if (clave.length < 1) return json({ perfiles: [] });
  const { results } = await env.DB.prepare(
    `SELECT alias, avatar, (SELECT COUNT(*) FROM sugerencias s WHERE s.usuario_id = u.id AND ${VISIBLES}) AS ideas
     FROM usuarios u WHERE alias IS NOT NULL AND suspendido = 0 AND alias_clave LIKE ?
     ORDER BY alias_clave LIKE ? DESC, ideas DESC, alias_clave LIMIT 12`,
  ).bind(`%${clave}%`, `${clave}%`).all();
  return json({ perfiles: results });
}

async function perfil(env, valor) {
  let alias;
  try { alias = decodeURIComponent(valor); } catch { alias = ''; }
  const u = alias && await env.DB.prepare('SELECT id, alias, avatar, creada FROM usuarios WHERE alias_clave = ? AND alias IS NOT NULL AND suspendido = 0')
    .bind(claveAlias(alias.replace(/^@/, ''))).first();
  if (!u) return error('No existe ninguna cuenta con ese alias.', 404, 'perfil_no_encontrado');

  const [sugerencias, comentarios] = await env.DB.batch([
    env.DB.prepare(`SELECT id, titulo, estado, juego, me_gusta, creada FROM sugerencias WHERE usuario_id = ? AND ${VISIBLES} ORDER BY actividad DESC`).bind(u.id),
    env.DB.prepare('SELECT COUNT(*) AS n FROM comentarios WHERE usuario_id = ? AND oculto = 0').bind(u.id),
  ]);
  const lista = sugerencias.results;
  return json({
    perfil: {
      alias: u.alias,
      avatar: u.avatar,
      creada: u.creada,
      ideas: lista.length,
      meGusta: lista.reduce((suma, s) => suma + s.me_gusta, 0),
      comentarios: comentarios.results[0].n,
      // Juegos hechos a partir de sus ideas, e ideas que aún no son un juego
      juegos: lista.filter((s) => s.estado === 'hecha' && s.juego),
      enMarcha: lista.filter((s) => ['nueva', 'estudio', 'desarrollo'].includes(s.estado)),
    },
  });
}
