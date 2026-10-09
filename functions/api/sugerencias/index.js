// GET  /api/sugerencias?orden=votos|recientes|actividad&estado=…   → lista
// POST /api/sugerencias { titulo, descripcion, manos, accion, tipo, autor, captcha } → crea una
import {
  CAMPOS, ESTADOS, json, error, leerJson, texto, huellaIp, huellaVotante, esAdmin,
  superaLimite, captchaValido, nombreReservado, sinBaseDeDatos,
} from '../_comun.js';

const ORDENES = {
  votos: 'me_gusta DESC, actividad DESC',
  recientes: 'creada DESC',
  actividad: 'actividad DESC',
};

export async function onRequestGet({ request, env }) {
  const falta = sinBaseDeDatos(env);
  if (falta) return falta;
  const url = new URL(request.url);
  const orden = ORDENES[url.searchParams.get('orden')] || ORDENES.votos;
  const estado = url.searchParams.get('estado');
  // El administrador puede pedir también las ocultas (?ocultas=1)
  const verOcultas = url.searchParams.get('ocultas') === '1' && (await esAdmin(request, env));

  const condiciones = [];
  const valores = [];
  if (!verOcultas) condiciones.push('oculta = 0');
  if (estado && ESTADOS.includes(estado)) {
    condiciones.push('estado = ?');
    valores.push(estado);
  }
  const donde = condiciones.length ? `WHERE ${condiciones.join(' AND ')}` : '';
  const { results } = await env.DB.prepare(`SELECT ${CAMPOS} FROM sugerencias ${donde} ORDER BY ${orden} LIMIT 300`)
    .bind(...valores).all();

  // Qué sugerencias le gustan ya a este navegador
  let meGusta = [];
  const votante = request.headers.get('x-votante');
  if (votante && votante.length <= 64) {
    const filas = await env.DB.prepare('SELECT sugerencia_id FROM me_gusta WHERE votante = ?')
      .bind(await huellaVotante(votante, env)).all();
    meGusta = filas.results.map((f) => f.sugerencia_id);
  }
  return json({ sugerencias: results, meGusta });
}

export async function onRequestPost({ request, env }) {
  const falta = sinBaseDeDatos(env);
  if (falta) return falta;
  const datos = await leerJson(request);
  if (!datos) return error('Datos no válidos.');

  const titulo = texto(datos.titulo, 80, 4);
  const descripcion = texto(datos.descripcion, 2000, 20);
  const manos = texto(datos.manos, 80);
  const accion = texto(datos.accion, 80);
  const tipo = texto(datos.tipo, 40);
  const autor = texto(datos.autor, 40) || 'Anónimo';
  if (titulo === null) return error('El título debe tener entre 4 y 80 caracteres.');
  if (descripcion === null) return error('La descripción debe tener entre 20 y 2000 caracteres.');
  if (manos === null || accion === null || tipo === null || autor === null) return error('Algún campo es demasiado largo.');

  const admin = await esAdmin(request, env);
  if (!admin && nombreReservado(autor)) return error('Ese nombre está reservado. Elige otro.');
  if (!admin && !(await captchaValido(request, env, datos.captcha))) return error('No se ha podido comprobar que no eres un robot. Inténtalo de nuevo.', 403);

  const ip = await huellaIp(request, env);
  if (!admin && (await superaLimite(env, 'sugerencias', ip))) return error('Has enviado muchas sugerencias seguidas. Prueba dentro de un rato.', 429);

  const fila = await env.DB.prepare(
    'INSERT INTO sugerencias (titulo, descripcion, manos, accion, tipo, autor, ip) VALUES (?, ?, ?, ?, ?, ?, ?) RETURNING id',
  ).bind(titulo, descripcion, manos, accion, tipo, autor, ip).first();
  return json({ id: fila.id }, 201);
}
