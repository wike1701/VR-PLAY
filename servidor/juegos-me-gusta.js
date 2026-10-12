// "Me gusta" y partidas de los juegos.
//   GET  /api/juegos/estadisticas                → { juegos: { topos: { meGusta: 3, partidas: 120 }, … } }
//   GET  /api/juegos/me-gusta                     → { totales: { topos: 3, … } } (la de antes, por si hay páginas viejas en caché)
//   POST /api/juegos/:id/me-gusta { votante }    → pone o quita el de este navegador → { meGusta, total }
//   POST /api/juegos/:id/partida                  → cuenta una partida (la shell la envía a los 15 s de juego) → { partidas }
// "votante" es el mismo identificador anónimo del navegador que usa el foro. Con la sesión
// iniciada, el "me gusta" es de la cuenta (el mismo en todos sus dispositivos).
// Los totales se guardan ya contados en juegos_estadisticas: así la portada lee una fila por
// juego aunque haya millones de "me gusta" y de partidas.
import es from '../idiomas/es.js';
import { json, error, leerJson, huellaIp, huellaVotante, superaLimite, sinBaseDeDatos } from './comun.js';
import { usuarioActual, votanteCuenta } from './sesion.js';

// Solo juegos que existen (los que tienen textos en el idioma original)
const idJuego = (valor) => (typeof valor === 'string' && /^[a-z0-9_-]{1,40}$/.test(valor) && Object.hasOwn(es.juegos, valor) ? valor : null);

const MINUTOS_ENTRE_PARTIDAS = 10; // la misma conexión cuenta como mucho una partida por juego cada 10 minutos

export async function estadisticas({ env }) {
  const falta = sinBaseDeDatos(env);
  if (falta) return falta;
  const { results } = await env.DB.prepare('SELECT juego, me_gusta, partidas FROM juegos_estadisticas').all();
  return json({ juegos: Object.fromEntries(results.map((f) => [f.juego, { meGusta: f.me_gusta, partidas: f.partidas }])) });
}

export async function onRequestGet({ env }) {
  const falta = sinBaseDeDatos(env);
  if (falta) return falta;
  const { results } = await env.DB.prepare('SELECT juego, me_gusta FROM juegos_estadisticas WHERE me_gusta > 0').all();
  return json({ totales: Object.fromEntries(results.map((f) => [f.juego, f.me_gusta])) });
}

// Vuelve a contar los "me gusta" de un juego (solo los suyos: usa el índice de la tabla)
export const recontarMeGusta = (env, juego) => env.DB.prepare(
  `INSERT INTO juegos_estadisticas (juego, me_gusta) VALUES (?, (SELECT COUNT(*) FROM juegos_me_gusta WHERE juego = ?))
   ON CONFLICT (juego) DO UPDATE SET me_gusta = excluded.me_gusta RETURNING me_gusta`,
).bind(juego, juego);

export async function onRequestPost({ request, params, env }) {
  const falta = sinBaseDeDatos(env);
  if (falta) return falta;
  const juego = idJuego(params.id);
  if (!juego) return error('Juego no encontrado.', 404, 'juego_no_encontrado');
  const datos = await leerJson(request);
  if (!datos || typeof datos.votante !== 'string' || datos.votante.length < 8 || datos.votante.length > 64) {
    return error('Datos no válidos.', 400, 'datos');
  }

  const usuario = await usuarioActual(request, env);
  const votante = usuario ? await votanteCuenta(usuario, env) : await huellaVotante(datos.votante, env);
  const ip = await huellaIp(request, env);
  const yaLeGusta = await env.DB.prepare('SELECT 1 FROM juegos_me_gusta WHERE juego = ? AND votante = ?').bind(juego, votante).first();
  if (!yaLeGusta && (await superaLimite(env, 'juegos_me_gusta', ip))) return error('Demasiados "me gusta" seguidos. Prueba dentro de un rato.', 429, 'limite_me_gusta');

  const cambio = yaLeGusta
    ? env.DB.prepare('DELETE FROM juegos_me_gusta WHERE juego = ? AND votante = ?').bind(juego, votante)
    : env.DB.prepare('INSERT OR IGNORE INTO juegos_me_gusta (juego, votante, ip) VALUES (?, ?, ?)').bind(juego, votante, ip);
  const resultados = await env.DB.batch([cambio, recontarMeGusta(env, juego)]);
  return json({ meGusta: !yaLeGusta, total: resultados[1].results[0].me_gusta });
}

export async function partida({ request, params, env }) {
  const falta = sinBaseDeDatos(env);
  if (falta) return falta;
  const juego = idJuego(params.id);
  if (!juego) return error('Juego no encontrado.', 404, 'juego_no_encontrado');
  const ip = await huellaIp(request, env);

  const [reciente, enLaHora] = await env.DB.batch([
    env.DB.prepare(`SELECT 1 FROM partidas_recientes WHERE ip = ? AND juego = ? AND creada > datetime('now', '-${MINUTOS_ENTRE_PARTIDAS} minutes')`).bind(ip, juego),
    env.DB.prepare("SELECT COUNT(*) AS n FROM partidas_recientes WHERE ip = ? AND creada > datetime('now', '-1 hour')").bind(ip),
  ]);
  // Repetida o demasiadas seguidas: no se cuenta, pero no es un error para quien juega
  if (reciente.results.length || enLaHora.results[0].n >= 60) {
    const fila = await env.DB.prepare('SELECT partidas FROM juegos_estadisticas WHERE juego = ?').bind(juego).first();
    return json({ partidas: fila?.partidas || 0, contada: false });
  }

  const consultas = [
    env.DB.prepare('INSERT INTO partidas_recientes (ip, juego) VALUES (?, ?)').bind(ip, juego),
    env.DB.prepare(`INSERT INTO juegos_estadisticas (juego, partidas) VALUES (?, 1)
      ON CONFLICT (juego) DO UPDATE SET partidas = partidas + 1 RETURNING partidas`).bind(juego),
  ];
  // De vez en cuando se borran las marcas viejas (solo sirven para no contar dos veces)
  if (Math.random() < 0.02) consultas.push(env.DB.prepare("DELETE FROM partidas_recientes WHERE creada < datetime('now', '-2 hours')"));
  const resultados = await env.DB.batch(consultas);
  return json({ partidas: resultados[1].results[0].partidas, contada: true });
}
