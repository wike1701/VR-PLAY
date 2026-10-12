// Utilidades compartidas por la API del foro (las rutas están en servidor/index.js).
import { esAliasDeCuenta } from './sesion.js';
//
// El Worker recibe:
//   DB                 base de datos D1 con bd/esquema.sql (se conecta en wrangler.jsonc)
// Y, en el panel de Cloudflare (Settings → Variables and Secrets):
//   ADMIN_TOKEN        clave para moderar y publicar respuestas oficiales (secreto, 16+ caracteres)
//   SAL                texto aleatorio para las huellas de IP (secreto, opcional)
//   TURNSTILE_SITEKEY  y TURNSTILE_SECRET: captcha de Cloudflare contra el spam (opcionales)
//   RESEND_API_KEY     envío de los correos para entrar en la cuenta (secreto)
//   GOOGLE_CLIENT_ID   y GOOGLE_CLIENT_SECRET: entrar con Google (secretos)
// Y en wrangler.jsonc (vars): CUENTAS = "1" enseña el botón «Entrar» a todo el mundo

// Columnas públicas de una sugerencia (con_cuenta: la firmó alguien con la sesión iniciada)
export const CAMPOS = 'id, titulo, descripcion, manos, accion, tipo, autor, estado, juego, me_gusta, comentarios, oculta, creada, actividad, usuario_id IS NOT NULL AS con_cuenta';

export const ESTADOS = ['nueva', 'estudio', 'desarrollo', 'hecha', 'existe', 'descartada'];

// Límites por IP y por hora, para frenar el spam
export const LIMITES = { sugerencias: 5, comentarios: 20, me_gusta: 120, juegos_me_gusta: 120 };

export function json(datos, estado = 200) {
  return new Response(JSON.stringify(datos), {
    status: estado,
    headers: { 'content-type': 'application/json; charset=utf-8', 'cache-control': 'no-store' },
  });
}

// El mensaje va en español; el código (opcional) sirve para que la web lo enseñe traducido
// (foro.errores.<código> en idiomas/). Los datos extra (por ejemplo { max }) se usan en el texto.
export const error = (mensaje, estado = 400, codigo = null, extra = {}) =>
  json({ error: mensaje, ...(codigo ? { codigo, ...extra } : {}) }, estado);

export async function leerJson(request) {
  try {
    const datos = await request.json();
    return datos && typeof datos === 'object' ? datos : null;
  } catch {
    return null;
  }
}

// Texto limpio: sin espacios sobrantes ni caracteres de control (salvo saltos de línea).
// Devuelve null si no cumple la longitud.
export function texto(valor, max, min = 0) {
  if (valor === undefined || valor === null) valor = '';
  if (typeof valor !== 'string') return null;
  const limpio = valor.replace(/\r\n?/g, '\n').replace(/[\u0000-\u0009\u000b-\u001f\u007f]/g, '').replace(/\n{3,}/g, '\n\n').trim();
  if (limpio.length < min || limpio.length > max) return null;
  return limpio;
}

export async function sha256(cadena) {
  const datos = new TextEncoder().encode(cadena);
  const hash = await crypto.subtle.digest('SHA-256', datos);
  return [...new Uint8Array(hash)].map((b) => b.toString(16).padStart(2, '0')).join('');
}

// Huella de la IP: no guardamos la IP, solo un hash para poder limitar el spam
export async function huellaIp(request, env) {
  const ip = request.headers.get('cf-connecting-ip') || 'local';
  return (await sha256(`${env.SAL || 'vrplay'}:${ip}`)).slice(0, 32);
}

export async function huellaVotante(id, env) {
  return (await sha256(`${env.SAL || 'vrplay'}:votante:${id}`)).slice(0, 32);
}

export async function esAdmin(request, env) {
  const clave = env.ADMIN_TOKEN;
  const cabecera = request.headers.get('authorization') || '';
  if (!clave || clave.length < 16 || !cabecera.startsWith('Bearer ')) return false;
  // Comparamos los hashes para que el tiempo de respuesta no dé pistas sobre la clave
  return (await sha256(cabecera.slice(7))) === (await sha256(clave));
}

// ¿Ha superado esta IP el límite de la última hora en la tabla dada?
export async function superaLimite(env, tabla, ip) {
  const fila = await env.DB.prepare(`SELECT COUNT(*) AS n FROM ${tabla} WHERE ip = ? AND creada > datetime('now', '-1 hour')`)
    .bind(ip).first();
  return (fila?.n || 0) >= LIMITES[tabla];
}

// Captcha de Cloudflare: solo se comprueba si está configurado
export async function captchaValido(request, env, token) {
  if (!env.TURNSTILE_SECRET) return true;
  if (typeof token !== 'string' || !token) return false;
  const formulario = new FormData();
  formulario.append('secret', env.TURNSTILE_SECRET);
  formulario.append('response', token);
  const ip = request.headers.get('cf-connecting-ip');
  if (ip) formulario.append('remoteip', ip);
  try {
    const respuesta = await fetch('https://challenges.cloudflare.com/turnstile/v0/siteverify', { method: 'POST', body: formulario });
    return !!(await respuesta.json()).success;
  } catch {
    return false;
  }
}

// El nombre del equipo solo lo usan las respuestas oficiales
export function nombreReservado(nombre) {
  return /vr\s*[·.\-_ ]?\s*play/i.test(nombre) || /^admin/i.test(nombre);
}

export function idValido(valor) {
  const id = Number(valor);
  return Number.isInteger(id) && id > 0 ? id : null;
}

// Quién firma en el foro. Con la sesión iniciada, su alias (y no se puede cambiar); sin ella, el nombre
// que escriba, salvo que sea el alias de una cuenta. Devuelve { autor, usuarioId } o { problema: Response }.
export async function firmante(env, usuario, escrito) {
  if (usuario) {
    if (!usuario.alias) return { problema: error('Elige tu alias antes de publicar.', 403, 'sin_alias') };
    if (usuario.suspendido) return { problema: error('Tu cuenta no puede publicar en el foro.', 403, 'suspendido') };
    return { autor: usuario.alias, usuarioId: usuario.id };
  }
  if (await esAliasDeCuenta(env, escrito)) {
    return { problema: error('Ese nombre es el alias de una cuenta. Entra en ella o elige otro.', 400, 'nombre_de_cuenta') };
  }
  return { autor: escrito, usuarioId: null };
}

export function sinBaseDeDatos(env) {
  return env.DB ? null : error('El foro no está configurado: falta la base de datos D1 (DB).', 503, 'no_disponible');
}
