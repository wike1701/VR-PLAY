// "Me gusta" de los juegos (desde el menú de pausa).
//   GET  /api/juegos/me-gusta                     → { totales: { topos: 3, … } }
//   POST /api/juegos/:id/me-gusta { votante }    → pone o quita el de este navegador → { meGusta, total }
// "votante" es el mismo identificador anónimo del navegador que usa el foro. Con la sesión
// iniciada, el "me gusta" es de la cuenta (el mismo en todos sus dispositivos).
import { json, error, leerJson, huellaIp, huellaVotante, superaLimite, sinBaseDeDatos } from './comun.js';
import { usuarioActual, votanteCuenta } from './sesion.js';

// La tabla se crea sola la primera vez (también está en bd/esquema.sql)
let tablaLista = null;
function prepararTabla(env) {
  tablaLista ||= env.DB.batch([
    env.DB.prepare(`CREATE TABLE IF NOT EXISTS juegos_me_gusta (
      juego TEXT NOT NULL, votante TEXT NOT NULL, ip TEXT NOT NULL DEFAULT '',
      creada TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (juego, votante))`),
    env.DB.prepare('CREATE INDEX IF NOT EXISTS juegos_me_gusta_ip ON juegos_me_gusta (ip, creada)'),
  ]).catch((e) => {
    tablaLista = null;
    throw e;
  });
  return tablaLista;
}

const idJuego = (valor) => (typeof valor === 'string' && /^[a-z0-9_-]{1,40}$/.test(valor) ? valor : null);

export async function onRequestGet({ env }) {
  const falta = sinBaseDeDatos(env);
  if (falta) return falta;
  await prepararTabla(env);
  const { results } = await env.DB.prepare('SELECT juego, COUNT(*) AS n FROM juegos_me_gusta GROUP BY juego').all();
  return json({ totales: Object.fromEntries(results.map((f) => [f.juego, f.n])) });
}

export async function onRequestPost({ request, params, env }) {
  const falta = sinBaseDeDatos(env);
  if (falta) return falta;
  const juego = idJuego(params.id);
  if (!juego) return error('Juego no encontrado.', 404, 'juego_no_encontrado');
  const datos = await leerJson(request);
  if (!datos || typeof datos.votante !== 'string' || datos.votante.length < 8 || datos.votante.length > 64) {
    return error('Datos no válidos.', 400, 'datos');
  }
  await prepararTabla(env);

  const usuario = await usuarioActual(request, env);
  const votante = usuario ? await votanteCuenta(usuario, env) : await huellaVotante(datos.votante, env);
  const ip = await huellaIp(request, env);
  const yaLeGusta = await env.DB.prepare('SELECT 1 FROM juegos_me_gusta WHERE juego = ? AND votante = ?').bind(juego, votante).first();
  if (!yaLeGusta && (await superaLimite(env, 'juegos_me_gusta', ip))) return error('Demasiados "me gusta" seguidos. Prueba dentro de un rato.', 429, 'limite_me_gusta');

  const cambio = yaLeGusta
    ? env.DB.prepare('DELETE FROM juegos_me_gusta WHERE juego = ? AND votante = ?').bind(juego, votante)
    : env.DB.prepare('INSERT OR IGNORE INTO juegos_me_gusta (juego, votante, ip) VALUES (?, ?, ?)').bind(juego, votante, ip);
  const recuento = env.DB.prepare('SELECT COUNT(*) AS n FROM juegos_me_gusta WHERE juego = ?').bind(juego);
  const resultados = await env.DB.batch([cambio, recuento]);
  return json({ meGusta: !yaLeGusta, total: resultados[1].results[0].n });
}
