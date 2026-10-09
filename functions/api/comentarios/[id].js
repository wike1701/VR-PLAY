// PATCH /api/comentarios/:id { oculto, anclado } → moderación, solo administrador
import { json, error, leerJson, esAdmin, idValido, sinBaseDeDatos } from '../_comun.js';

export async function onRequestPatch({ request, params, env }) {
  const falta = sinBaseDeDatos(env);
  if (falta) return falta;
  if (!(await esAdmin(request, env))) return error('No autorizado.', 401);
  const id = idValido(params.id);
  if (!id) return error('Comentario no encontrado.', 404);
  const datos = await leerJson(request);
  if (!datos) return error('Datos no válidos.');

  const comentario = await env.DB.prepare('SELECT id, sugerencia_id FROM comentarios WHERE id = ?').bind(id).first();
  if (!comentario) return error('Comentario no encontrado.', 404);
  const hilo = comentario.sugerencia_id;

  const consultas = [];
  if (datos.anclado !== undefined) {
    // Solo hay un comentario anclado por hilo
    if (datos.anclado) consultas.push(env.DB.prepare('UPDATE comentarios SET anclado = 0 WHERE sugerencia_id = ?').bind(hilo));
    consultas.push(env.DB.prepare('UPDATE comentarios SET anclado = ? WHERE id = ?').bind(datos.anclado ? 1 : 0, id));
  }
  if (datos.oculto !== undefined) {
    consultas.push(env.DB.prepare('UPDATE comentarios SET oculto = ? WHERE id = ?').bind(datos.oculto ? 1 : 0, id));
  }
  if (!consultas.length) return error('No hay nada que cambiar.');
  consultas.push(env.DB.prepare(
    'UPDATE sugerencias SET comentarios = (SELECT COUNT(*) FROM comentarios WHERE sugerencia_id = ? AND oculto = 0) WHERE id = ?',
  ).bind(hilo, hilo));
  await env.DB.batch(consultas);
  return json({ ok: true });
}
