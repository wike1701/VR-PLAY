// Entrar con Google (OAuth 2.0 / OpenID Connect).
//   GET /api/cuenta/google?volver=/foro.html  → lleva a Google para elegir la cuenta
//   GET /api/cuenta/google?code=…&state=…      → Google vuelve aquí; se inicia la sesión y se va a entrar.html
// Necesita los secretos GOOGLE_CLIENT_ID y GOOGLE_CLIENT_SECRET. En Google Cloud, la dirección de
// vuelta autorizada es https://vrplaygame.com/api/cuenta/google.
// Solo se pide el correo (scopes openid y email): ni el nombre ni la foto.
import { leerCookie, cookie, aleatorio, entrarConCorreo, volverValido } from './sesion.js';

const COOKIE_ESTADO = '__Host-vrplay_google';

function redirigir(destino, ...cookies) {
  const respuesta = new Response(null, { status: 302, headers: { location: destino, 'cache-control': 'no-store' } });
  for (const c of cookies) respuesta.headers.append('set-cookie', c);
  return respuesta;
}

// Lee el contenido de un JWT. No hace falta comprobar la firma porque llega directamente
// de Google por HTTPS (OpenID Connect Core, 3.1.3.7).
function contenidoJwt(jwt) {
  const parte = String(jwt).split('.')[1] || '';
  const base64 = parte.replace(/-/g, '+').replace(/_/g, '/');
  const bytes = Uint8Array.from(atob(base64 + '='.repeat((4 - (base64.length % 4)) % 4)), (c) => c.charCodeAt(0));
  return JSON.parse(new TextDecoder().decode(bytes));
}

export async function entrarConGoogle({ request, env }) {
  const url = new URL(request.url);
  if (!env.GOOGLE_CLIENT_ID || !env.GOOGLE_CLIENT_SECRET) return redirigir('/entrar.html?error=google');
  const vuelta = `${url.origin}/api/cuenta/google`;

  // 1. Ida: a Google, con un "estado" aleatorio que se guarda en una cookie para comprobarlo a la vuelta
  if (!url.searchParams.has('code') && !url.searchParams.has('error')) {
    const estado = aleatorio(16);
    const volver = volverValido(url.searchParams.get('volver'));
    const destino = new URL('https://accounts.google.com/o/oauth2/v2/auth');
    destino.search = new URLSearchParams({
      client_id: env.GOOGLE_CLIENT_ID,
      redirect_uri: vuelta,
      response_type: 'code',
      scope: 'openid email',
      state: estado,
      prompt: 'select_account',
    });
    return redirigir(destino.href, cookie(COOKIE_ESTADO, `${estado}~${encodeURIComponent(volver)}`, 600));
  }

  // 2. Vuelta
  const borrarEstado = cookie(COOKIE_ESTADO, '', 0);
  const fallo = () => redirigir('/entrar.html?error=google', borrarEstado);
  const [estado, volverCodificado = ''] = (leerCookie(request, COOKIE_ESTADO) || '').split('~');
  if (!estado || url.searchParams.get('state') !== estado || url.searchParams.has('error')) return fallo();
  let volver = '/';
  try { volver = volverValido(decodeURIComponent(volverCodificado)); } catch { /* se queda en la portada */ }

  let datos;
  try {
    const respuesta = await fetch('https://oauth2.googleapis.com/token', {
      method: 'POST',
      headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code: url.searchParams.get('code'),
        client_id: env.GOOGLE_CLIENT_ID,
        client_secret: env.GOOGLE_CLIENT_SECRET,
        redirect_uri: vuelta,
        grant_type: 'authorization_code',
      }),
    });
    if (!respuesta.ok) throw new Error(`Google respondió ${respuesta.status}: ${(await respuesta.text()).slice(0, 300)}`);
    datos = contenidoJwt((await respuesta.json()).id_token);
  } catch (e) {
    console.error('Error al entrar con Google', e);
    return fallo();
  }

  const valido = datos.aud === env.GOOGLE_CLIENT_ID
    && ['https://accounts.google.com', 'accounts.google.com'].includes(datos.iss)
    && datos.exp * 1000 > Date.now()
    && datos.email_verified === true
    && typeof datos.email === 'string' && typeof datos.sub === 'string';
  if (!valido) return fallo();

  const { cookie: sesion } = await entrarConCorreo(env, request, datos.email.trim().toLowerCase(), datos.sub);
  return redirigir(`/entrar.html?listo=1&volver=${encodeURIComponent(volver)}`, sesion, borrarEstado);
}
