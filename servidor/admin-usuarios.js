// Moderación de cuentas (pestaña «Usuarios» de admin.html). Solo administrador.
//   GET   /api/admin/usuarios?q=rafa  → busca por alias o correo (las 100 más recientes si no hay q)
//   PATCH /api/admin/usuarios/:id { alias, suspendido, avatar: true, vetadoClasificaciones, borrarRecords: true }
//         alias: fuerza un cambio de alias (por ejemplo, si es ofensivo); no cuenta para el límite de 30 días
//         suspendido: puede seguir jugando, pero no publicar en el foro
//         avatar: genera otro avatar
//         vetadoClasificaciones: lo saca de las clasificaciones (sus récords no salen)
//         borrarRecords: borra todos sus récords (de siempre y del mes)
import { json, error, leerJson, esAdmin, idValido } from './comun.js';
import { problemaAlias, claveAlias, aliasLibre, semillaAvatar } from './sesion.js';

const CAMPOS = `id, correo, alias, avatar, anio_nacimiento, suspendido, COALESCE(vetado_clasificaciones, 0) AS vetado, google_id IS NOT NULL AS google, creada, ultimo_acceso,
  (SELECT COUNT(*) FROM records r WHERE r.usuario_id = usuarios.id) AS records,
  (SELECT COUNT(*) FROM sesiones s WHERE s.usuario_id = usuarios.id AND s.caduca > datetime('now')) AS sesiones,
  (SELECT COUNT(*) FROM sugerencias g WHERE g.usuario_id = usuarios.id) AS sugerencias,
  (SELECT COUNT(*) FROM comentarios c WHERE c.usuario_id = usuarios.id) AS comentarios`;

export async function onRequestGet({ request, env }) {
  if (!(await esAdmin(request, env))) return error('No autorizado.', 401);
  const q = (new URL(request.url).searchParams.get('q') || '').trim().toLowerCase().slice(0, 60);
  const consulta = q
    ? env.DB.prepare(`SELECT ${CAMPOS} FROM usuarios WHERE alias_clave LIKE ? OR correo LIKE ? ORDER BY creada DESC LIMIT 100`)
      .bind(`%${claveAlias(q)}%`, `%${q}%`)
    : env.DB.prepare(`SELECT ${CAMPOS} FROM usuarios ORDER BY creada DESC LIMIT 100`);
  const [{ results }, total] = await Promise.all([
    consulta.all(),
    env.DB.prepare('SELECT COUNT(*) AS n FROM usuarios').first(),
  ]);
  return json({ usuarios: results, total: total.n });
}

export async function onRequestPatch({ request, params, env }) {
  if (!(await esAdmin(request, env))) return error('No autorizado.', 401);
  const id = idValido(params.id);
  const u = id && (await env.DB.prepare('SELECT * FROM usuarios WHERE id = ?').bind(id).first());
  if (!u) return error('Usuario no encontrado.', 404);
  const datos = await leerJson(request);
  if (!datos) return error('Datos no válidos.');

  const consultas = [];
  if (datos.alias !== undefined) {
    const alias = String(datos.alias).trim().normalize('NFC');
    const problema = problemaAlias(alias);
    if (problema) return error(`El alias no vale (${problema}).`);
    const clave = claveAlias(alias);
    if (clave !== u.alias_clave && !(await aliasLibre(env, clave, u.id))) return error('Ese alias ya lo tiene otra persona.');
    consultas.push(
      env.DB.prepare('UPDATE usuarios SET alias = ?, alias_clave = ? WHERE id = ?').bind(alias, clave, id),
      env.DB.prepare('UPDATE sugerencias SET autor = ? WHERE usuario_id = ?').bind(alias, id),
      env.DB.prepare('UPDATE comentarios SET autor = ? WHERE usuario_id = ?').bind(alias, id),
    );
  }
  if (datos.suspendido !== undefined) {
    consultas.push(env.DB.prepare('UPDATE usuarios SET suspendido = ? WHERE id = ?').bind(datos.suspendido ? 1 : 0, id));
  }
  if (datos.avatar) consultas.push(env.DB.prepare('UPDATE usuarios SET avatar = ? WHERE id = ?').bind(semillaAvatar(), id));
  if (datos.vetadoClasificaciones !== undefined) {
    consultas.push(env.DB.prepare('UPDATE usuarios SET vetado_clasificaciones = ? WHERE id = ?').bind(datos.vetadoClasificaciones ? 1 : 0, id));
  }
  if (datos.borrarRecords) {
    consultas.push(
      env.DB.prepare('DELETE FROM records WHERE usuario_id = ?').bind(id),
      env.DB.prepare('DELETE FROM records_mes WHERE usuario_id = ?').bind(id),
    );
  }
  if (!consultas.length) return error('No hay nada que cambiar.');
  await env.DB.batch(consultas);
  return json({ usuario: await env.DB.prepare(`SELECT ${CAMPOS} FROM usuarios WHERE id = ?`).bind(id).first() });
}
