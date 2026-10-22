// POST  /api/denuncias { tipo, id, motivo, detalle } → cualquiera denuncia una sugerencia o un comentario
// GET   /api/denuncias → las denuncias sin revisar, agrupadas por contenido (solo administrador)
// PATCH /api/denuncias { tipo, id } → da por revisadas todas las denuncias de ese contenido (solo administrador)
import { json, error, leerJson, texto, huellaIp, superaLimite, esAdmin, idValido, sinBaseDeDatos } from './comun.js';

const MOTIVOS = ['spam', 'ofensivo', 'datos_personales', 'ilegal', 'otro'];
const TABLAS = { sugerencia: ['sugerencias', 'oculta'], comentario: ['comentarios', 'oculto'] };

export async function onRequestPost({ request, env }) {
  const falta = sinBaseDeDatos(env);
  if (falta) return falta;
  const datos = await leerJson(request);
  const id = idValido(datos?.id);
  const detalle = texto(datos?.detalle, 500);
  if (!datos || !TABLAS[datos.tipo] || !id || !MOTIVOS.includes(datos.motivo) || detalle === null) {
    return error('Datos no válidos.', 400, 'datos');
  }
  const [tabla, oculto] = TABLAS[datos.tipo];
  const existe = await env.DB.prepare(`SELECT 1 FROM ${tabla} WHERE id = ? AND ${oculto} = 0`).bind(id).first();
  if (!existe) return error('No encontrado.', 404, 'no_encontrado');

  const ip = await huellaIp(request, env);
  if (await superaLimite(env, 'denuncias', ip)) return error('Has enviado muchas denuncias seguidas. Prueba dentro de un rato.', 429, 'limite_denuncias');
  // La misma conexión solo cuenta una vez por contenido (si repite, no pasa nada)
  await env.DB.prepare('INSERT OR IGNORE INTO denuncias (tipo, objeto_id, motivo, detalle, ip) VALUES (?, ?, ?, ?, ?)')
    .bind(datos.tipo, id, datos.motivo, detalle, ip).run();
  return json({ ok: true });
}

export async function onRequestGet({ request, env }) {
  const falta = sinBaseDeDatos(env);
  if (falta) return falta;
  if (!(await esAdmin(request, env))) return error('No autorizado.', 401);
  const { results } = await env.DB.prepare(
    `SELECT d.tipo, d.objeto_id AS id, COUNT(*) AS veces, GROUP_CONCAT(d.motivo) AS motivos,
       GROUP_CONCAT(NULLIF(d.detalle, ''), ' · ') AS detalles, MAX(d.creada) AS ultima,
       COALESCE(s.titulo, cs.titulo) AS titulo, COALESCE(s.id, c.sugerencia_id) AS sugerencia_id,
       COALESCE(s.descripcion, c.texto) AS texto, COALESCE(s.autor, c.autor) AS autor, COALESCE(s.oculta, c.oculto) AS oculto
     FROM denuncias d
     LEFT JOIN sugerencias s ON d.tipo = 'sugerencia' AND s.id = d.objeto_id
     LEFT JOIN comentarios c ON d.tipo = 'comentario' AND c.id = d.objeto_id
     LEFT JOIN sugerencias cs ON cs.id = c.sugerencia_id
     WHERE d.revisada = 0
     GROUP BY d.tipo, d.objeto_id
     ORDER BY veces DESC, ultima DESC
     LIMIT 200`,
  ).all();
  return json({ denuncias: results });
}

export async function onRequestPatch({ request, env }) {
  const falta = sinBaseDeDatos(env);
  if (falta) return falta;
  if (!(await esAdmin(request, env))) return error('No autorizado.', 401);
  const datos = await leerJson(request);
  const id = idValido(datos?.id);
  if (!datos || !TABLAS[datos.tipo] || !id) return error('Datos no válidos.');
  await env.DB.prepare('UPDATE denuncias SET revisada = 1 WHERE tipo = ? AND objeto_id = ?').bind(datos.tipo, id).run();
  return json({ ok: true });
}
