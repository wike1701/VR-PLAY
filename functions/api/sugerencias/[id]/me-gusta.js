// POST /api/sugerencias/:id/me-gusta { votante } → pone o quita el "me gusta" de este navegador.
// "votante" es un identificador anónimo que foro.html guarda en el navegador.
import { json, error, leerJson, huellaIp, huellaVotante, superaLimite, idValido, sinBaseDeDatos } from '../../_comun.js';

export async function onRequestPost({ request, params, env }) {
  const falta = sinBaseDeDatos(env);
  if (falta) return falta;
  const id = idValido(params.id);
  if (!id) return error('Sugerencia no encontrada.', 404);
  const datos = await leerJson(request);
  if (!datos || typeof datos.votante !== 'string' || datos.votante.length < 8 || datos.votante.length > 64) {
    return error('Datos no válidos.');
  }
  const sugerencia = await env.DB.prepare('SELECT id FROM sugerencias WHERE id = ? AND oculta = 0').bind(id).first();
  if (!sugerencia) return error('Sugerencia no encontrada.', 404);

  const votante = await huellaVotante(datos.votante, env);
  const ip = await huellaIp(request, env);
  const yaLeGusta = await env.DB.prepare('SELECT 1 FROM me_gusta WHERE sugerencia_id = ? AND votante = ?').bind(id, votante).first();
  if (!yaLeGusta && (await superaLimite(env, 'me_gusta', ip))) return error('Demasiados "me gusta" seguidos. Prueba dentro de un rato.', 429);

  const recuento = env.DB.prepare(
    'UPDATE sugerencias SET me_gusta = (SELECT COUNT(*) FROM me_gusta WHERE sugerencia_id = ?) WHERE id = ? RETURNING me_gusta',
  ).bind(id, id);
  const cambio = yaLeGusta
    ? env.DB.prepare('DELETE FROM me_gusta WHERE sugerencia_id = ? AND votante = ?').bind(id, votante)
    : env.DB.prepare('INSERT OR IGNORE INTO me_gusta (sugerencia_id, votante, ip) VALUES (?, ?, ?)').bind(id, votante, ip);
  const resultados = await env.DB.batch([cambio, recuento]);
  return json({ meGusta: !yaLeGusta, total: resultados[1].results[0].me_gusta });
}
