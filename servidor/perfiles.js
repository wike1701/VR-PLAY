// Perfiles públicos y seguir a otros jugadores (ver PERFILES.md, puntos 6 y 13).
//   GET  /api/perfiles?q=raf                 → { perfiles: [{ alias, avatar, ideas }] } (buscador de la portada, como mucho 12)
//   GET  /api/perfiles/:alias                → { perfil: { alias, avatar, creada, ideas, meGusta, comentarios,
//                                                 seguidores, seguidos, listasOcultas, loSigues, esMio, juegos, enMarcha } }
//   POST /api/perfiles/:alias/seguir { seguir } → sigue o deja de seguir (con la sesión iniciada)
//   GET  /api/perfiles/:alias/seguidores     → { perfiles: [...] }, salvo que tenga las listas ocultas
//   GET  /api/perfiles/:alias/seguidos       → igual, a quién sigue
//   GET  /api/feed                           → actividad de los que sigues, y jugadores para seguir
// Solo sale lo público: el alias, el avatar, la fecha de alta, sus sugerencias del foro que no estén ocultas
// ni descartadas, y cuántos seguidores y seguidos tiene. Nunca el correo, el año de nacimiento, sus favoritos
// ni los «me gusta» que ha dado. Las cuentas suspendidas o sin alias no salen.
import { json, error, leerJson } from './comun.js';
import { claveAlias, usuarioActual } from './sesion.js';

const VISIBLES = "oculta = 0 AND estado != 'descartada'";
const LIMITE_SEGUIR = { dia: 50, total: 1000 };

// ¿Oculta a quién sigue y quién le sigue? Si no lo ha elegido, sí cuando es menor de 18 años (D12)
export function listasOcultas(u) {
  if (u.listas_ocultas !== null && u.listas_ocultas !== undefined) return !!u.listas_ocultas;
  return !!u.anio_nacimiento && new Date().getUTCFullYear() - u.anio_nacimiento < 18;
}

async function cuentaDe(env, valor) {
  let alias;
  try { alias = decodeURIComponent(valor); } catch { return null; }
  if (!alias) return null;
  return env.DB.prepare('SELECT id, alias, avatar, creada, anio_nacimiento, listas_ocultas FROM usuarios WHERE alias_clave = ? AND alias IS NOT NULL AND suspendido = 0')
    .bind(claveAlias(alias.replace(/^@/, ''))).first();
}
const noExiste = () => error('No existe ninguna cuenta con ese alias.', 404, 'perfil_no_encontrado');

export async function atender({ request, env, params }) {
  if (!env.DB) return error('Las cuentas no están disponibles ahora mismo.', 503, 'no_disponible');
  const { id, sub } = params;
  if (request.method === 'GET' && !id) return buscar(env, new URL(request.url).searchParams.get('q'));
  if (request.method === 'GET' && !sub) return perfil(request, env, id);
  if (request.method === 'GET' && (sub === 'seguidores' || sub === 'seguidos')) return lista(request, env, id, sub);
  if (request.method === 'POST' && sub === 'seguir') return seguir(request, env, id);
  return error('Método no permitido.', 405);
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

async function perfil(request, env, valor) {
  const u = await cuentaDe(env, valor);
  if (!u) return noExiste();
  const yo = await usuarioActual(request, env);

  const [sugerencias, comentarios, numeros, loSigo] = await env.DB.batch([
    env.DB.prepare(`SELECT id, titulo, estado, juego, me_gusta, creada FROM sugerencias WHERE usuario_id = ? AND ${VISIBLES} ORDER BY actividad DESC`).bind(u.id),
    env.DB.prepare('SELECT COUNT(*) AS n FROM comentarios WHERE usuario_id = ? AND oculto = 0').bind(u.id),
    env.DB.prepare(`SELECT (SELECT COUNT(*) FROM seguidores f JOIN usuarios x ON x.id = f.seguidor_id WHERE f.seguido_id = ? AND x.suspendido = 0) AS seguidores,
      (SELECT COUNT(*) FROM seguidores f JOIN usuarios x ON x.id = f.seguido_id WHERE f.seguidor_id = ? AND x.suspendido = 0) AS seguidos`).bind(u.id, u.id),
    env.DB.prepare('SELECT 1 AS si FROM seguidores WHERE seguidor_id = ? AND seguido_id = ?').bind(yo?.id || 0, u.id),
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
      seguidores: numeros.results[0].seguidores,
      seguidos: numeros.results[0].seguidos,
      listasOcultas: listasOcultas(u),
      loSigues: loSigo.results.length > 0,
      esMio: yo?.id === u.id,
      // Juegos hechos a partir de sus ideas, e ideas que aún no son un juego
      juegos: lista.filter((s) => s.estado === 'hecha' && s.juego),
      enMarcha: lista.filter((s) => ['nueva', 'estudio', 'desarrollo'].includes(s.estado)),
    },
  });
}

// Seguidores o seguidos de una cuenta (lo más reciente primero, como mucho 200)
async function lista(request, env, valor, cual) {
  const u = await cuentaDe(env, valor);
  if (!u) return noExiste();
  const yo = await usuarioActual(request, env);
  if (listasOcultas(u) && yo?.id !== u.id) return error('Esta cuenta no muestra sus listas.', 403, 'listas_ocultas');
  const [mia, otra] = cual === 'seguidores' ? ['seguido_id', 'seguidor_id'] : ['seguidor_id', 'seguido_id'];
  const { results } = await env.DB.prepare(
    `SELECT x.alias, x.avatar FROM seguidores f JOIN usuarios x ON x.id = f.${otra}
     WHERE f.${mia} = ? AND x.alias IS NOT NULL AND x.suspendido = 0 ORDER BY f.creada DESC LIMIT 200`,
  ).bind(u.id).all();
  return json({ perfiles: results });
}

async function seguir(request, env, valor) {
  const yo = await usuarioActual(request, env);
  if (!yo) return error('Tienes que entrar en tu cuenta.', 401, 'sin_sesion');
  if (!yo.alias) return error('Elige tu alias antes de seguir a nadie.', 403, 'sin_alias');
  const u = await cuentaDe(env, valor);
  if (!u) return noExiste();
  if (u.id === yo.id) return error('No puedes seguirte a ti mismo.', 400, 'seguir_a_ti');
  const datos = await leerJson(request);
  const quiere = datos?.seguir !== false;

  if (quiere) {
    const yaLoSigo = await env.DB.prepare('SELECT 1 FROM seguidores WHERE seguidor_id = ? AND seguido_id = ?').bind(yo.id, u.id).first();
    if (!yaLoSigo) {
      const [hoy, total] = await env.DB.batch([
        env.DB.prepare("SELECT COUNT(*) AS n FROM seguidores WHERE seguidor_id = ? AND creada > datetime('now', '-1 day')").bind(yo.id),
        env.DB.prepare('SELECT COUNT(*) AS n FROM seguidores WHERE seguidor_id = ?').bind(yo.id),
      ]);
      if (total.results[0].n >= LIMITE_SEGUIR.total) return error('Ya sigues al máximo de jugadores.', 429, 'seguir_limite');
      if (hoy.results[0].n >= LIMITE_SEGUIR.dia) return error('Has seguido a muchos jugadores hoy. Prueba mañana.', 429, 'seguir_limite_dia');
      await env.DB.prepare('INSERT OR IGNORE INTO seguidores (seguidor_id, seguido_id) VALUES (?, ?)').bind(yo.id, u.id).run();
    }
  } else {
    await env.DB.prepare('DELETE FROM seguidores WHERE seguidor_id = ? AND seguido_id = ?').bind(yo.id, u.id).run();
  }
  const fila = await env.DB.prepare('SELECT COUNT(*) AS n FROM seguidores f JOIN usuarios x ON x.id = f.seguidor_id WHERE f.seguido_id = ? AND x.suspendido = 0').bind(u.id).first();
  return json({ loSigues: quiere, seguidores: fila.n });
}

// ─── Pestaña «Seguidos» de la portada ───────────────────────────────────
// Lo público que han hecho los que sigues, de lo más reciente a lo más antiguo: ideas nuevas,
// comentarios e ideas convertidas en juego. Si no sigue a nadie (o hay poco), jugadores para seguir.
export async function feed({ request, env }) {
  if (!env.DB) return error('Las cuentas no están disponibles ahora mismo.', 503, 'no_disponible');
  const yo = await usuarioActual(request, env);
  if (!yo) return error('Tienes que entrar en tu cuenta.', 401, 'sin_sesion');

  const deQuienSigo = `SELECT seguido_id FROM seguidores WHERE seguidor_id = ${Number(yo.id)}`;
  const [actividad, sigo, sugeridos] = await env.DB.batch([
    env.DB.prepare(`
      SELECT * FROM (
        SELECT 'idea' AS tipo, s.id, s.titulo, s.estado, s.juego, s.me_gusta, NULL AS texto, s.creada AS fecha, u.alias, u.avatar
          FROM sugerencias s JOIN usuarios u ON u.id = s.usuario_id
          WHERE s.usuario_id IN (${deQuienSigo}) AND s.oculta = 0 AND s.estado != 'descartada' AND u.suspendido = 0
        UNION ALL
        SELECT 'juego', s.id, s.titulo, s.estado, s.juego, s.me_gusta, NULL, s.actividad, u.alias, u.avatar
          FROM sugerencias s JOIN usuarios u ON u.id = s.usuario_id
          WHERE s.usuario_id IN (${deQuienSigo}) AND s.oculta = 0 AND s.estado = 'hecha' AND s.juego != '' AND u.suspendido = 0
        UNION ALL
        SELECT 'comentario', s.id, s.titulo, s.estado, s.juego, s.me_gusta, c.texto, c.creada, u.alias, u.avatar
          FROM comentarios c JOIN sugerencias s ON s.id = c.sugerencia_id JOIN usuarios u ON u.id = c.usuario_id
          WHERE c.usuario_id IN (${deQuienSigo}) AND c.oculto = 0 AND s.oculta = 0 AND u.suspendido = 0
      ) ORDER BY fecha DESC LIMIT 60`),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM seguidores WHERE seguidor_id = ?`).bind(yo.id),
    // Jugadores para seguir: los que tienen más seguidores e ideas, salvo uno mismo y los que ya sigue
    env.DB.prepare(`
      SELECT u.alias, u.avatar,
        (SELECT COUNT(*) FROM sugerencias s WHERE s.usuario_id = u.id AND ${VISIBLES}) AS ideas,
        (SELECT COUNT(*) FROM seguidores f WHERE f.seguido_id = u.id) AS seguidores
      FROM usuarios u
      WHERE u.alias IS NOT NULL AND u.suspendido = 0 AND u.id != ? AND u.id NOT IN (${deQuienSigo})
      ORDER BY seguidores + ideas DESC, u.creada DESC LIMIT 6`).bind(yo.id),
  ]);
  return json({
    sigues: sigo.results[0].n,
    actividad: actividad.results.map((a) => ({ ...a, texto: a.texto ? a.texto.slice(0, 200) : null })),
    sugeridos: sugeridos.results,
  });
}
