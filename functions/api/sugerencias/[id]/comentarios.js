// POST /api/sugerencias/:id/comentarios { texto, autor, captcha }
// Si lo envía el administrador, es una respuesta oficial de VR Play y queda anclada
// arriba del hilo (la anterior respuesta anclada pasa al historial). El hilo sigue abierto.
import {
  json, error, leerJson, texto, huellaIp, esAdmin, superaLimite, captchaValido,
  nombreReservado, idValido, sinBaseDeDatos,
} from '../../_comun.js';

export async function onRequestPost({ request, params, env }) {
  const falta = sinBaseDeDatos(env);
  if (falta) return falta;
  const id = idValido(params.id);
  if (!id) return error('Sugerencia no encontrada.', 404);
  const datos = await leerJson(request);
  if (!datos) return error('Datos no válidos.');

  const admin = await esAdmin(request, env);
  const contenido = texto(datos.texto, admin ? 4000 : 1500, 2);
  if (contenido === null) return error(`El comentario debe tener entre 2 y ${admin ? 4000 : 1500} caracteres.`);
  let autor = texto(datos.autor, 40) || 'Anónimo';
  if (autor === null) return error('El nombre es demasiado largo.');

  const sugerencia = await env.DB.prepare('SELECT id, oculta FROM sugerencias WHERE id = ?').bind(id).first();
  if (!sugerencia || (sugerencia.oculta && !admin)) return error('Sugerencia no encontrada.', 404);

  const ip = await huellaIp(request, env);
  if (admin) {
    autor = 'VR Play';
  } else {
    if (nombreReservado(autor)) return error('Ese nombre está reservado. Elige otro.');
    if (!(await captchaValido(request, env, datos.captcha))) return error('No se ha podido comprobar que no eres un robot. Inténtalo de nuevo.', 403);
    if (await superaLimite(env, 'comentarios', ip)) return error('Has escrito muchos comentarios seguidos. Prueba dentro de un rato.', 429);
  }

  // Una respuesta oficial se ancla salvo que se pida lo contrario ({ anclar: false })
  const anclar = admin && datos.anclar !== false;
  const consultas = [];
  if (anclar) consultas.push(env.DB.prepare('UPDATE comentarios SET anclado = 0 WHERE sugerencia_id = ?').bind(id));
  consultas.push(
    env.DB.prepare('INSERT INTO comentarios (sugerencia_id, texto, autor, oficial, anclado, ip) VALUES (?, ?, ?, ?, ?, ?) RETURNING id')
      .bind(id, contenido, autor, admin ? 1 : 0, anclar ? 1 : 0, ip),
    env.DB.prepare(
      "UPDATE sugerencias SET comentarios = (SELECT COUNT(*) FROM comentarios WHERE sugerencia_id = ? AND oculto = 0), actividad = datetime('now') WHERE id = ?",
    ).bind(id, id),
  );
  const resultados = await env.DB.batch(consultas);
  const nuevo = resultados[anclar ? 1 : 0].results[0];
  return json({ id: nuevo.id }, 201);
}
