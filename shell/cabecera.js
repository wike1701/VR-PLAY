// Navegación común de las páginas públicas (index, foro, clasificacion, perfil, cuenta, entrar, legal y 404).
// Cada página pone en su cabecera un hueco y, en su <script type="module">, importa este archivo antes que
// nada (así el hueco del botón de la cuenta ya existe cuando la página llama a montarBotonCuenta()):
//
//   <nav class="nav-web" data-nav="foro"></nav>        (juegos, clasificacion, foro, perfil, cuenta, entrar o vacío)
//
// Pinta Juegos, Clasificación, Sugerencias, el botón «Entrar» o el avatar (shell/cuenta.js, que decide si
// se ven las cuentas) y el selector de idioma, con aria-current en la página actual. Los estilos están en
// estilos/base.css (.nav-web). En pantallas estrechas solo se ven los iconos (con su etiqueta accesible).
// Además registra el service worker (sw.js, para abrir la web sin conexión) y ajusta el <link rel="canonical">
// al idioma cuando la dirección lleva ?lang=.
import { t, idioma, selectorIdioma, IDIOMAS } from '../idiomas/idiomas.js';
import { montarBotonCuenta, estadoCuenta, cuentasVisibles } from './cuenta.js';

// La raíz de la web, sacada de este archivo: los enlaces valen también desde el 404 de /a/b/c
const RAIZ = new URL('../', import.meta.url);
const ruta = (archivo) => new URL(archivo, RAIZ).pathname;

const ICONOS = {
  juegos: '<rect x="2.5" y="6" width="19" height="12" rx="5"/><path d="M7.5 10v4M5.5 12h4"/><circle cx="15.5" cy="11" r=".6" fill="currentColor"/><circle cx="17.5" cy="13" r=".6" fill="currentColor"/>',
  clasificacion: '<path d="M8 4h8v5a4 4 0 0 1-8 0V4Z"/><path d="M8 6H5a3 3 0 0 0 3 4M16 6h3a3 3 0 0 1-3 4M12 13v4M8.5 20h7M10 17h4"/>',
  foro: '<path d="M9 18h6M10 21h4"/><path d="M12 3a6 6 0 0 0-3.5 10.9c.4.3.5.7.5 1.1v.5h6V15c0-.4.2-.8.5-1.1A6 6 0 0 0 12 3Z"/>',
  cuenta: '<circle cx="12" cy="8.5" r="3.8"/><path d="M4.5 20a7.5 7.5 0 0 1 15 0"/>',
  idioma: '<circle cx="12" cy="12" r="9"/><path d="M3 12h18M12 3c2.5 2.7 3.8 5.7 3.8 9s-1.3 6.3-3.8 9c-2.5-2.7-3.8-5.7-3.8-9S9.5 5.7 12 3Z"/>',
};
function icono(nombre) {
  const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  svg.setAttribute('viewBox', '0 0 24 24');
  svg.setAttribute('aria-hidden', 'true');
  svg.classList.add('nav-icono');
  svg.innerHTML = ICONOS[nombre];
  return svg;
}
const texto = (contenido) => Object.assign(document.createElement('span'), { className: 'nav-texto', textContent: contenido });

function enlace(id, href, clave, actual) {
  const a = document.createElement('a');
  a.className = 'nav-enlace';
  a.href = href;
  a.title = t(clave);
  if (id === actual) a.setAttribute('aria-current', 'page');
  a.append(icono(id), texto(t(clave)));
  return a;
}

// Selector de idioma: en el móvil se ve como un globo con el código («ES») y el desplegable encima, invisible
function idiomaCompacto() {
  const caja = Object.assign(document.createElement('span'), { className: 'nav-idioma' });
  const codigo = Object.assign(document.createElement('span'), { className: 'nav-idioma-codigo' });
  codigo.setAttribute('aria-hidden', 'true');
  codigo.append(icono('idioma'), (IDIOMAS.find((i) => i.codigo === idioma)?.codigo || idioma).toUpperCase());
  caja.append(selectorIdioma(), codigo);
  return caja;
}

// «Entrar» lleva un icono para que en el móvil quepa sin el texto; el avatar ya hace de icono
function ajustarBotonCuenta(actual) {
  for (const a of document.querySelectorAll('.nav-web .boton-cuenta')) {
    if (!a.querySelector('.avatar') && !a.querySelector('.nav-icono')) {
      a.replaceChildren(icono('cuenta'), Object.assign(document.createElement('span'), { className: 'texto', textContent: a.textContent }));
    }
    // Con el texto oculto en el móvil (algunas páginas lo quitan con display: none), la etiqueta va aparte
    if (!a.hasAttribute('aria-label')) a.setAttribute('aria-label', a.textContent.trim());
    const propio = actual === 'cuenta' || actual === 'entrar'
      || (actual === 'perfil' && a.hash && decodeURIComponent(a.hash.slice(1)) === decodeURIComponent(location.hash.slice(1).split('/')[0]));
    if (propio) a.setAttribute('aria-current', 'page');
    else a.removeAttribute('aria-current');
  }
}

function montar(nav) {
  const actual = nav.dataset.nav || '';
  nav.setAttribute('aria-label', t('comun.secciones'));
  const clasificacion = enlace('clasificacion', ruta('clasificacion.html'), 'clasificacion.titulos', actual);
  clasificacion.hidden = actual !== 'clasificacion'; // sale cuando se ven las cuentas (sus listas son de cuentas)
  const hueco = document.createElement('span');
  hueco.dataset.cuenta = '';
  nav.replaceChildren(
    enlace('juegos', ruta('index.html'), 'comun.juegos', actual),
    clasificacion,
    enlace('foro', ruta('foro.html'), 'comun.sugerencias', actual),
    hueco,
    idiomaCompacto(),
  );
  return clasificacion;
}

const navs = [...document.querySelectorAll('nav[data-nav]')];
const clasificaciones = navs.map(montar);
const actual = navs[0]?.dataset.nav || '';
if (navs.length) {
  if (actual === 'entrar') {
    // En la propia página de entrar no se pide la sesión otra vez: «Entrar» es la página actual
    for (const hueco of document.querySelectorAll('.nav-web [data-cuenta]')) {
      const a = Object.assign(document.createElement('a'), { className: 'boton-cuenta', href: location.pathname + location.search, textContent: t('cuenta.entrar') });
      hueco.replaceWith(a);
    }
    ajustarBotonCuenta(actual);
  } else {
    montarBotonCuenta().then(() => ajustarBotonCuenta(actual));
    if (actual === 'perfil') window.addEventListener('hashchange', () => ajustarBotonCuenta(actual));
  }
  estadoCuenta().then((estado) => {
    if (cuentasVisibles(estado) || actual === 'entrar') for (const c of clasificaciones) c.hidden = false;
  });
}

// Con ?lang= en la dirección, la dirección canónica es la de ese idioma (como los hreflang)
const canonica = document.querySelector('link[rel="canonical"]');
if (canonica && new URLSearchParams(location.search).has('lang')) {
  const url = new URL(canonica.href);
  url.searchParams.set('lang', idioma);
  canonica.href = url.href;
}

// Service worker: guarda la estructura de la web para abrirla sin conexión (ver sw.js)
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  const registrar = () => navigator.serviceWorker.register(ruta('sw.js'), { scope: RAIZ.pathname })
    .then(() => navigator.serviceWorker.ready)
    // Lo que esta página cargó antes de que el service worker la controlara (la primera visita), para guardarlo
    .then((registro) => registro.active?.postMessage({
      tipo: 'guardar',
      pagina: location.href.split('#')[0],
      urls: performance.getEntriesByType('resource').map((r) => r.name),
    }))
    .catch((e) => console.warn('Sin service worker:', e.message));
  // Después de cargar la página, para no quitarle red a lo primero que se ve
  if (document.readyState === 'complete') registrar();
  else addEventListener('load', registrar, { once: true });
}
