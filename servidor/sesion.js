// Sesiones de las cuentas de usuario (ver docs/PERFILES.md).
// - La sesión va en una cookie HttpOnly, Secure y SameSite=Lax con un token aleatorio. En la base de
//   datos solo se guarda su hash, así que una copia de la base de datos no sirve para entrar.
// - Dura 90 días y se renueva al usarla.
// - Las peticiones que cambian algo solo aceptan la cookie si vienen de la propia web (cabecera Origin).
import { sha256, huellaVotante } from './comun.js';

export const COOKIE = '__Host-vrplay_sesion';
const DIAS_SESION = 90;

// Texto aleatorio para tokens (base64url, 32 bytes)
export function aleatorio(bytes = 32) {
  const datos = crypto.getRandomValues(new Uint8Array(bytes));
  return btoa(String.fromCharCode(...datos)).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

export const hashToken = (token, env) => sha256(`${env.SAL || 'vrplay'}:token:${token}`);

export function leerCookie(request, nombre) {
  const cabecera = request.headers.get('cookie') || '';
  for (const parte of cabecera.split(';')) {
    const i = parte.indexOf('=');
    if (i > 0 && parte.slice(0, i).trim() === nombre) return parte.slice(i + 1).trim();
  }
  return null;
}

export function cookie(nombre, valor, segundos) {
  return `${nombre}=${valor}; Path=/; Max-Age=${segundos}; HttpOnly; Secure; SameSite=Lax`;
}
export const cookieSesion = (token) => cookie(COOKIE, token, DIAS_SESION * 86400);
export const borrarCookieSesion = () => cookie(COOKIE, '', 0);

// ¿La petición viene de la propia web? Los navegadores mandan Origin en todo POST/PATCH/DELETE.
export function mismoOrigen(request) {
  return request.headers.get('origin') === new URL(request.url).origin;
}

// Nombre corto del dispositivo, para la lista de sesiones de «Mi cuenta»
function dispositivo(request) {
  const ua = request.headers.get('user-agent') || '';
  const sistema = /OculusBrowser|Quest/i.test(ua) ? 'Meta Quest'
    : /iPhone|iPad/i.test(ua) ? 'iPhone / iPad'
      : /Android/i.test(ua) ? 'Android'
        : /Windows/i.test(ua) ? 'Windows'
          : /Mac OS/i.test(ua) ? 'Mac'
            : /Linux|CrOS/i.test(ua) ? 'Linux' : '';
  const navegador = /OculusBrowser/i.test(ua) ? 'Meta Quest Browser'
    : /Edg\//.test(ua) ? 'Edge'
      : /Firefox\//.test(ua) ? 'Firefox'
        : /SamsungBrowser/.test(ua) ? 'Samsung Internet'
          : /Chrome\//.test(ua) ? 'Chrome'
            : /Safari\//.test(ua) ? 'Safari' : '';
  return [navegador, sistema].filter(Boolean).join(' · ').slice(0, 60);
}

// «volver»: a qué página ir después de entrar. Solo direcciones de esta web.
export function volverValido(valor) {
  return typeof valor === 'string' && /^\/(?!\/)[^\s\\]{0,300}$/.test(valor) ? valor : '/';
}

// Crea una sesión y devuelve la cabecera Set-Cookie
export async function crearSesion(env, request, usuarioId) {
  const token = aleatorio();
  await env.DB.batch([
    env.DB.prepare(`INSERT INTO sesiones (usuario_id, token, dispositivo, caduca) VALUES (?, ?, ?, datetime('now', '+${DIAS_SESION} days'))`)
      .bind(usuarioId, await hashToken(token, env), dispositivo(request)),
    env.DB.prepare("UPDATE usuarios SET ultimo_acceso = datetime('now') WHERE id = ?").bind(usuarioId),
    // Limpieza: sesiones y enlaces caducados
    env.DB.prepare("DELETE FROM sesiones WHERE caduca < datetime('now')"),
    env.DB.prepare("DELETE FROM enlaces_acceso WHERE caduca < datetime('now')"),
  ]);
  return cookieSesion(token);
}

// El usuario de la sesión de esta petición, o null. Devuelve también sesion_id.
// En peticiones que cambian algo, solo si vienen de la propia web.
export async function usuarioActual(request, env) {
  if (!env.DB) return null;
  const token = leerCookie(request, COOKIE);
  if (!token || token.length > 100) return null;
  if (!['GET', 'HEAD'].includes(request.method) && !mismoOrigen(request)) return null;
  const fila = await env.DB.prepare(
    `SELECT u.*, s.id AS sesion_id, s.usada AS sesion_usada FROM sesiones s JOIN usuarios u ON u.id = s.usuario_id
     WHERE s.token = ? AND s.caduca > datetime('now')`,
  ).bind(await hashToken(token, env)).first();
  if (!fila) return null;
  // Se renueva como mucho una vez al día
  if (Date.parse(fila.sesion_usada.replace(' ', 'T') + 'Z') < Date.now() - 86400000) {
    await env.DB.batch([
      env.DB.prepare(`UPDATE sesiones SET usada = datetime('now'), caduca = datetime('now', '+${DIAS_SESION} days') WHERE id = ?`).bind(fila.sesion_id),
      env.DB.prepare("UPDATE usuarios SET ultimo_acceso = datetime('now') WHERE id = ?").bind(fila.id),
    ]);
  }
  return fila;
}

// Con cuenta, los «me gusta» van a nombre de la cuenta (en todos sus dispositivos) y no del navegador
export const votanteCuenta = (usuario, env) => huellaVotante(`cuenta:${usuario.id}`, env);

// ─── Alias ────────────────────────────────────────────────────────────────
// De 3 a 20 caracteres: letras (de cualquier idioma), números, «_» y «.». Sin espacios.
const FORMATO_ALIAS = /^[\p{L}\p{N}_.]{3,20}$/u;

// Clave para comprobar que es único: sin mayúsculas ni tildes, y con los caracteres que se
// confunden unificados (Rafa = rafa = rafá = R4fa no; pero ra_fa = rafa y 0 = o, 1 = l = i)
export function claveAlias(alias) {
  return alias.normalize('NFKD').replace(/\p{M}/gu, '').toLowerCase()
    .replace(/[_.]/g, '').replace(/0/g, 'o').replace(/[1i]/g, 'l');
}

// Alias reservados: los que empiezan así (para que nadie se haga pasar por la web) y los exactos
const PREFIJOS_RESERVADOS = [
  'vrplay', 'admin', 'moderador', 'moderator', 'soporte', 'support', 'oficial', 'official', 'staff',
].map(claveAlias);
const RESERVADOS = [
  'administrador', 'mod', 'equipo', 'team', 'root', 'sistema', 'system', 'anonimo', 'anonymous',
  'usuarioeliminado', 'deleteduser', 'null', 'undefined', 'cuenta', 'perfil',
].map(claveAlias);

// Palabras ofensivas. Lista corta a propósito (el resto lo modera el administrador): las primeras no
// pueden aparecer en ningún sitio del alias; las cortas solo se rechazan si son el alias entero, para
// no bloquear palabras normales que las contienen (computadora, Penélope…).
const OFENSIVAS = [
  'gilipollas', 'maricon', 'subnormal', 'mierda', 'cabron', 'zorra', 'follar', 'nazi', 'hitler', 'fuck', 'shit',
  'bitch', 'cunt', 'nigger', 'nigga', 'faggot', 'retard', 'whore', 'porn', 'penis', 'vagina',
].map(claveAlias);
const OFENSIVAS_EXACTAS = ['puta', 'puto', 'polla', 'pene', 'sexo', 'sex', 'coño', 'culo', 'ass'].map(claveAlias);

// Devuelve el código de error (cuenta.errores.<código>) o null si vale
export function problemaAlias(alias) {
  if (typeof alias !== 'string' || !FORMATO_ALIAS.test(alias)) return 'alias_formato';
  const clave = claveAlias(alias);
  if (PREFIJOS_RESERVADOS.some((r) => clave.startsWith(r)) || RESERVADOS.includes(clave)) return 'alias_reservado';
  if (OFENSIVAS.some((o) => clave.includes(o)) || OFENSIVAS_EXACTAS.includes(clave)) return 'alias_ofensivo';
  return null;
}

// ¿Está libre? (sin contar al propio usuario)
export async function aliasLibre(env, clave, usuarioId = 0) {
  const ocupado = await env.DB.prepare('SELECT 1 FROM usuarios WHERE alias_clave = ? AND id != ?').bind(clave, usuarioId).first();
  if (ocupado) return false;
  const bloqueado = await env.DB.prepare("SELECT 1 FROM alias_bloqueados WHERE alias_clave = ? AND hasta > datetime('now')").bind(clave).first();
  return !bloqueado;
}

// ¿Este nombre (escrito en el foro sin cuenta) es el alias de alguien?
export async function esAliasDeCuenta(env, nombre) {
  if (!nombre) return false;
  return !!(await env.DB.prepare('SELECT 1 FROM usuarios WHERE alias_clave = ?').bind(claveAlias(nombre)).first());
}

export const semillaAvatar = () => crypto.getRandomValues(new Uint32Array(1))[0] % 1000000;

// Busca la cuenta de ese correo o la crea, e inicia la sesión
export async function entrarConCorreo(env, request, correo, googleId = null) {
  let u = null;
  if (googleId) u = await env.DB.prepare('SELECT * FROM usuarios WHERE google_id = ?').bind(googleId).first();
  u ||= await env.DB.prepare('SELECT * FROM usuarios WHERE correo = ?').bind(correo).first();
  if (!u) {
    u = await env.DB.prepare('INSERT INTO usuarios (correo, google_id, avatar) VALUES (?, ?, ?) RETURNING *')
      .bind(correo, googleId, semillaAvatar()).first();
  } else if (googleId && !u.google_id) {
    await env.DB.prepare('UPDATE usuarios SET google_id = ? WHERE id = ?').bind(googleId, u.id).run();
  }
  return { usuario: u, cookie: await crearSesion(env, request, u.id) };
}
