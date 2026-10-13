// Cuenta de usuario en el navegador (ver docs/PERFILES.md y servidor/cuenta.js).
// - estadoCuenta(): la sesión actual ({ visibles, google, usuario }), pedida una sola vez por página.
// - montarBotonCuenta(): el botón «Entrar» o el avatar con el alias en la cabecera (lleva a tu perfil).
// - botonSeguir(): el botón «Seguir» / «Siguiendo» de un perfil.
// - avatar(): el avatar generado a partir del alias.
// - Al entrar, los favoritos y los «me gusta» del navegador pasan a la cuenta, y desde entonces la
//   copia del navegador se actualiza con la de la cuenta (así sale igual en todos tus dispositivos).
//
// Mientras se prueban, las cuentas solo se ven con ?perfiles=1 en la dirección (se recuerda en
// el navegador; ?perfiles=0 lo quita) o si el servidor tiene CUENTAS = "1" (wrangler.jsonc).
import { t, existe } from '../idiomas/idiomas.js';

const CLAVE_PRUEBA = 'vrplay:perfiles';
const CLAVE_CUENTA = 'vrplay:cuenta';        // id de la cuenta con la que se ha entrado en este navegador
const CLAVE_FUSIONADA = 'vrplay:fusionada';  // id de la cuenta a la que ya se pasó lo de este navegador

function leer(clave) {
  try { return localStorage.getItem(clave); } catch { return null; }
}
function escribir(clave, valor) {
  try {
    if (valor === null) localStorage.removeItem(clave);
    else localStorage.setItem(clave, valor);
  } catch { /* sin almacenamiento */ }
}

const prueba = new URLSearchParams(location.search).get('perfiles');
if (prueba === '1') escribir(CLAVE_PRUEBA, '1');
if (prueba === '0') escribir(CLAVE_PRUEBA, null);

// ─── Llamadas a la API ──────────────────────────────────────────────────
// Lanza un Error con el mensaje ya traducido (cuenta.errores.<código> o foro.errores.<código>).
// La ruta es relativa a /api/cuenta salvo que empiece por /api/.
export async function apiCuenta(ruta, { method = 'GET', datos } = {}) {
  let respuesta;
  try {
    respuesta = await fetch(ruta.startsWith('/api/') ? ruta : `/api/cuenta${ruta}`, {
      method,
      headers: datos ? { 'content-type': 'application/json' } : {},
      body: datos ? JSON.stringify(datos) : undefined,
    });
  } catch {
    throw Object.assign(new Error(t('cuenta.errores.no_disponible')), { codigo: 'no_disponible' });
  }
  let cuerpo = null;
  try { cuerpo = await respuesta.json(); } catch { /* sin JSON */ }
  if (!respuesta.ok || !cuerpo) {
    const codigo = cuerpo?.codigo || (respuesta.status === 404 ? 'no_disponible' : 'servidor');
    const clave = [`cuenta.errores.${codigo}`, `foro.errores.${codigo}`].find(existe);
    const mensaje = clave ? t(clave, { ...cuerpo, fecha: cuerpo?.fecha ? fecha(cuerpo.fecha) : '' }) : (cuerpo?.error || t('cuenta.errores.servidor'));
    throw Object.assign(new Error(mensaje), { codigo, estado: respuesta.status });
  }
  return cuerpo;
}

export const fecha = (valor) => new Date(valor.includes('T') ? valor : valor.replace(' ', 'T') + 'Z')
  .toLocaleDateString(document.documentElement.lang, { day: 'numeric', month: 'long', year: 'numeric' });

// ─── Estado de la sesión ────────────────────────────────────────────────
let pedido = null;
export function estadoCuenta({ recargar = false } = {}) {
  if (!pedido || recargar) {
    pedido = apiCuenta('').catch(() => ({ visibles: false, google: false, usuario: null, sinServidor: true }))
      .then((estado) => {
        if (estado.usuario) recordarCuenta(estado.usuario);
        else if (!estado.sinServidor) olvidarCuenta();
        return estado;
      });
  }
  return pedido;
}

// ¿Se enseña el botón «Entrar»? Siempre si ya hay sesión.
export const cuentasVisibles = (estado) => !!(estado.usuario || estado.visibles || leer(CLAVE_PRUEBA) === '1');

// Guarda en el navegador la copia de los favoritos y «me gusta» de la cuenta
function recordarCuenta(usuario) {
  escribir(CLAVE_CUENTA, String(usuario.id));
  if (leer(CLAVE_FUSIONADA) !== String(usuario.id)) return; // aún no se ha pasado lo del navegador
  escribir('vrplay:favoritos', JSON.stringify(usuario.favoritos));
  escribir('vrplay:megusta', JSON.stringify(usuario.meGusta));
}

// Al cerrar sesión, el navegador se queda con su copia y se sigue jugando como invitado
export function olvidarCuenta() {
  escribir(CLAVE_CUENTA, null);
  escribir(CLAVE_FUSIONADA, null);
}

// Pasa a la cuenta los favoritos y «me gusta» de este navegador (una vez por cuenta y navegador)
export async function fusionarNavegador(usuario) {
  if (!usuario?.alias || leer(CLAVE_FUSIONADA) === String(usuario.id)) return usuario;
  let favoritos = [];
  try { favoritos = JSON.parse(leer('vrplay:favoritos') || '[]'); } catch { /* lista vacía */ }
  const { usuario: actualizado } = await apiCuenta('/fusionar', {
    method: 'POST',
    datos: { votante: leer('vrplay:votante') || '', favoritos: Array.isArray(favoritos) ? favoritos : [] },
  });
  escribir(CLAVE_FUSIONADA, String(actualizado.id));
  recordarCuenta(actualizado);
  return actualizado;
}

// ─── Avatar ─────────────────────────────────────────────────────────────
// Se genera a partir del alias y de un número al azar (la «semilla» que guarda el servidor):
// un color, una forma y la inicial. Devuelve un elemento <svg>.
function hash(texto) {
  let h = 2166136261;
  for (const c of texto) h = Math.imul(h ^ c.codePointAt(0), 16777619) >>> 0;
  return h;
}
const FORMAS = [
  '<circle cx="20" cy="20" r="19"/>',
  '<rect x="1" y="1" width="38" height="38" rx="11"/>',
  '<path d="M20 1 36.5 10.5v19L20 39 3.5 29.5v-19Z"/>',
  '<path d="M20 1 39 20 20 39 1 20Z"/>',
];
export function avatar(alias, semilla = 0, tam = 32) {
  const h = hash(`${alias || '?'}:${semilla}`);
  const tono = h % 360;
  const tono2 = (tono + 40 + ((h >>> 9) % 100)) % 360;
  const id = `av${h.toString(36)}`;
  const inicial = [...(alias || '?')][0].toUpperCase();
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 40 40');
  svg.setAttribute('width', tam);
  svg.setAttribute('height', tam);
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('avatar');
  svg.innerHTML = `<defs><linearGradient id="${id}" x1="0" y1="0" x2="1" y2="1">
    <stop offset="0" stop-color="hsl(${tono} 85% 62%)"/><stop offset="1" stop-color="hsl(${tono2} 75% 42%)"/></linearGradient></defs>
    <g fill="url(#${id})">${FORMAS[(h >>> 5) % FORMAS.length]}</g>
    <text x="20" y="21" text-anchor="middle" dominant-baseline="central" fill="#fff" font-size="19" font-weight="700"
      font-family="system-ui, -apple-system, 'Segoe UI', sans-serif"></text>`;
  svg.querySelector('text').textContent = inicial;
  return svg;
}

// ─── Botón de la cabecera ───────────────────────────────────────────────
// Sustituye cada <span data-cuenta></span> por «Entrar» o por el avatar y el alias (enlace a «Mi cuenta»).
export async function montarBotonCuenta() {
  const huecos = [...document.querySelectorAll('[data-cuenta]')];
  if (!huecos.length) return null;
  const estado = await estadoCuenta();
  let usuario = estado.usuario;
  if (usuario?.alias) usuario = await fusionarNavegador(usuario).catch(() => usuario);
  for (const hueco of huecos) {
    if (!cuentasVisibles(estado)) {
      hueco.remove();
      continue;
    }
    const a = document.createElement('a');
    a.className = 'boton-cuenta';
    if (usuario?.alias) {
      a.href = `perfil.html#${encodeURIComponent(usuario.alias)}`;
      a.title = t('cuenta.miPerfil');
      a.append(avatar(usuario.alias, usuario.avatar, 26), Object.assign(document.createElement('span'), { className: 'texto', textContent: usuario.alias }));
    } else {
      a.href = `entrar.html?volver=${encodeURIComponent(location.pathname + location.search + location.hash)}`;
      a.textContent = t('cuenta.entrar');
    }
    hueco.replaceWith(a);
  }
  return { ...estado, usuario };
}

// ─── Seguir ─────────────────────────────────────────────────────────────
// Botón «Seguir» / «Siguiendo» (al pasar por encima: «Dejar de seguir»). Sin sesión, lleva a entrar.
// alCambiar({ loSigues, seguidores }) se llama después de cada cambio.
export function botonSeguir(alias, loSigues, { conSesion = true, alCambiar = () => {}, mini = false } = {}) {
  if (!conSesion) {
    const a = document.createElement('a');
    a.className = `boton${mini ? ' mini' : ''}`;
    a.href = `entrar.html?volver=${encodeURIComponent(location.pathname + location.search + location.hash)}`;
    a.textContent = t('perfil.seguir');
    return a;
  }
  const boton = document.createElement('button');
  boton.type = 'button';
  const pintar = () => {
    boton.className = `boton${mini ? ' mini' : ''}${loSigues ? ' secundario siguiendo' : ''}`;
    boton.textContent = loSigues ? t('perfil.siguiendo') : t('perfil.seguir');
    boton.setAttribute('aria-pressed', String(loSigues));
  };
  boton.addEventListener('mouseenter', () => { if (loSigues) boton.textContent = t('perfil.dejarDeSeguir'); });
  boton.addEventListener('mouseleave', pintar);
  boton.addEventListener('click', async () => {
    boton.disabled = true;
    try {
      const r = await apiCuenta(`/api/perfiles/${encodeURIComponent(alias)}/seguir`, { method: 'POST', datos: { seguir: !loSigues } });
      loSigues = r.loSigues;
      pintar();
      alCambiar(r);
    } catch (error) {
      boton.title = error.message;
      alert(error.message);
    } finally {
      boton.disabled = false;
    }
  });
  pintar();
  return boton;
}
