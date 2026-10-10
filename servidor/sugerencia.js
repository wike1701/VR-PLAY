// GET   /api/sugerencias/:id → la sugerencia con sus comentarios (el anclado primero)
// PATCH /api/sugerencias/:id { estado, juego, oculta } → solo administrador
import { CAMPOS, ESTADOS, json, error, leerJson, texto, huellaVotante, esAdmin, idValido, sinBaseDeDatos } from './comun.js';

export async function onRequestGet({ request, params, env }) {
  const falta = sinBaseDeDatos(env);
  if (falta) return falta;
  const id = idValido(params.id);
  if (!id) return error('Sugerencia no encontrada.', 404);
  const admin = await esAdmin(request, env);

  const sugerencia = await env.DB.prepare(`SELECT ${CAMPOS} FROM sugerencias WHERE id = ?`).bind(id).first();
  if (!sugerencia || (sugerencia.oculta && !admin)) return error('Sugerencia no encontrada.', 404);

  const { results: comentarios } = await env.DB.prepare(
    `SELECT id, texto, autor, oficial, anclado, oculto, creada FROM comentarios
     WHERE sugerencia_id = ? ${admin ? '' : 'AND oculto = 0'} ORDER BY creada ASC, id ASC`,
  ).bind(id).all();

  let meGusta = false;
  const votante = request.headers.get('x-votante');
  if (votante && votante.length <= 64) {
    meGusta = !!(await env.DB.prepare('SELECT 1 FROM me_gusta WHERE sugerencia_id = ? AND votante = ?')
      .bind(id, await huellaVotante(votante, env)).first());
  }
  return json({ sugerencia, comentarios, meGusta });
}

export async function onRequestPatch({ request, params, env }) {
  const falta = sinBaseDeDatos(env);
  if (falta) return falta;
  if (!(await esAdmin(request, env))) return error('No autorizado.', 401);
  const id = idValido(params.id);
  if (!id) return error('Sugerencia no encontrada.', 404);
  const datos = await leerJson(request);
  if (!datos) return error('Datos no válidos.');

  const cambios = [];
  const valores = [];
  if (datos.estado !== undefined) {
    if (!ESTADOS.includes(datos.estado)) return error(`Estado no válido. Usa: ${ESTADOS.join(', ')}.`);
    cambios.push('estado = ?');
    valores.push(datos.estado);
  }
  if (datos.juego !== undefined) {
    const juego = texto(datos.juego, 40);
    if (juego === null || !/^[a-z0-9_-]*$/.test(juego)) return error('El juego debe ser un id del catálogo (minúsculas, números, - o _).');
    cambios.push('juego = ?');
    valores.push(juego);
  }
  if (datos.oculta !== undefined) {
    cambios.push('oculta = ?');
    valores.push(datos.oculta ? 1 : 0);
  }
  if (!cambios.length) return error('No hay nada que cambiar.');
  cambios.push("actividad = datetime('now')");

  const fila = await env.DB.prepare(`UPDATE sugerencias SET ${cambios.join(', ')} WHERE id = ? RETURNING ${CAMPOS}`)
    .bind(...valores, id).first();
  if (!fila) return error('Sugerencia no encontrada.', 404);
  return json({ sugerencia: fila });
}
