// Service worker de VR Play: guarda la estructura de la web para poder abrirla sin conexión.
// Lo registra shell/cabecera.js con alcance «/» (la raíz). Si no hay nada guardado, la página falla
// como siempre (no hay página «sin conexión»).
//
// - HTML, JavaScript, CSS y JSON: primero la red (así nadie se queda con una versión vieja rota) y,
//   si no hay conexión, lo último que se guardó. Los juegos (juegos/<id>/juego.js) se guardan al jugarlos.
// - Imágenes, iconos, miniaturas y fuentes: lo guardado al momento y se actualiza por detrás
//   («stale-while-revalidate»).
// - three.js de jsDelivr (versión fija, no cambia nunca): lo guardado y, si no está, la red.
// - Nunca se guarda /api/*, /juego/* (las fichas, que genera el servidor), el sitemap, llms.txt,
//   admin.html ni nada que no sea GET.
// Para tirar todo lo guardado (por ejemplo, si cambia esta lógica), sube VERSION: en «activate» se
// borran las cachés de versiones anteriores.
const VERSION = 'v1';
const CACHE = `vrplay-web-${VERSION}`;
const CACHE_CDN = `vrplay-cdn-${VERSION}`;
const CDN_THREE = 'https://cdn.jsdelivr.net/npm/three@0.160.0/';

// Lo mínimo para abrir la portada sin conexión. Si alguno falta, se sigue con el resto.
const BASICO = [
  './', 'index.html', 'manifest.webmanifest', 'favicon.svg',
  'estilos/base.css', 'estilos/cuenta.css',
  'estilos/fuentes/Geist-Variable.woff2', 'estilos/fuentes/GeistMono-Variable.woff2',
  'idiomas/detectar.js', 'idiomas/idiomas.js', 'idiomas/es.js',
  'juegos/catalogo.js', 'juegos/marcadores.js',
  'shell/cabecera.js', 'shell/cuenta.js', 'shell/valoraciones.js', 'shell/en-pruebas.js', 'shell/clasificacion.js',
  'iconos/icono-192.png',
];

const RAIZ = new URL('./', self.location).pathname;
const NO_GUARDAR = [/^api\//, /^juego\//, /^cdn-cgi\//, /^sitemap\.xml$/, /^llms\.txt$/, /^admin(\.html)?$/];

// ¿Qué hacer con esta petición? null: que la atienda el navegador sin pasar por aquí
function estrategia(peticion) {
  if (peticion.method !== 'GET' || peticion.headers.has('range')) return null;
  const url = new URL(peticion.url);
  if (url.href.startsWith(CDN_THREE)) return 'cdn';
  if (url.origin !== self.location.origin || !url.pathname.startsWith(RAIZ)) return null;
  const ruta = url.pathname.slice(RAIZ.length);
  if (NO_GUARDAR.some((patron) => patron.test(ruta))) return null;
  if (peticion.mode === 'navigate' || /\.(html|js|mjs|css|json|webmanifest)$/.test(ruta) || ruta === '') return 'red';
  if (/\.(svg|png|jpe?g|webp|gif|ico|woff2?)$/.test(ruta)) return 'guardado';
  return null;
}

// Una respuesta que llegó tras una redirección no vale para responder a una navegación: se copia limpia
async function paraGuardar(respuesta) {
  if (!respuesta.redirected) return respuesta;
  return new Response(await respuesta.blob(), { status: respuesta.status, statusText: respuesta.statusText, headers: respuesta.headers });
}
const guardable = (r) => r && r.ok && (r.type === 'basic' || r.type === 'cors' || r.type === 'default');

async function guardar(nombre, peticion, respuesta) {
  if (!guardable(respuesta)) return;
  try {
    const cache = await caches.open(nombre);
    await cache.put(peticion, await paraGuardar(respuesta));
  } catch { /* sin espacio: no pasa nada */ }
}

async function buscarGuardado(peticion) {
  // Las direcciones con ?lang=, ?q=… son la misma página: si no está esa exacta, vale la que haya
  return (await caches.match(peticion)) || (peticion.mode === 'navigate' ? caches.match(peticion, { ignoreSearch: true }) : undefined);
}

async function primeroRed(evento) {
  const peticion = evento.request;
  try {
    const respuesta = await fetch(peticion);
    evento.waitUntil(guardar(CACHE, peticion, respuesta.clone()));
    return respuesta;
  } catch (error) {
    const guardada = await buscarGuardado(peticion);
    if (guardada) return guardada;
    throw error;
  }
}

async function primeroGuardado(evento, nombre) {
  const peticion = evento.request;
  const guardada = await caches.match(peticion);
  const deRed = fetch(peticion).then((respuesta) => {
    // Lo de la CDN es inmutable: si ya estaba, no hace falta volver a pedirlo
    if (nombre === CACHE || !guardada) evento.waitUntil(guardar(nombre, peticion, respuesta.clone()));
    return respuesta;
  });
  if (guardada) {
    if (nombre === CACHE) evento.waitUntil(deRed.catch(() => {}));
    return guardada;
  }
  return deRed;
}

self.addEventListener('install', (evento) => {
  evento.waitUntil((async () => {
    const cache = await caches.open(CACHE);
    await Promise.all(BASICO.map((ruta) => fetch(ruta, { cache: 'no-cache' })
      .then(async (r) => (guardable(r) ? cache.put(ruta, await paraGuardar(r)) : null))
      .catch(() => null)));
    await self.skipWaiting();
  })());
});

self.addEventListener('activate', (evento) => {
  evento.waitUntil((async () => {
    const nombres = await caches.keys();
    await Promise.all(nombres.filter((n) => n.startsWith('vrplay-') && n !== CACHE && n !== CACHE_CDN).map((n) => caches.delete(n)));
    await self.clients.claim();
  })());
});

self.addEventListener('fetch', (evento) => {
  const tipo = estrategia(evento.request);
  if (tipo === 'red') evento.respondWith(primeroRed(evento));
  else if (tipo === 'guardado') evento.respondWith(primeroGuardado(evento, CACHE));
  else if (tipo === 'cdn') evento.respondWith(primeroGuardado(evento, CACHE_CDN));
});

// La página avisa de lo que cargó antes de que este service worker la controlara (la primera visita):
// se guarda lo que cumpla las mismas reglas, para que la próxima vez se abra sin conexión.
self.addEventListener('message', (evento) => {
  const { tipo, pagina, urls } = evento.data || {};
  if (tipo !== 'guardar' || !Array.isArray(urls)) return;
  evento.waitUntil((async () => {
    for (const url of [pagina, ...urls].filter((u) => typeof u === 'string').slice(0, 300)) {
      let peticion;
      try { peticion = new Request(url); } catch { continue; }
      // La propia página cuenta como HTML aunque su dirección no acabe en .html (/foro)
      const clase = url === pagina && new URL(url).origin === self.location.origin ? 'red' : estrategia(peticion);
      if (!clase || NO_GUARDAR.some((p) => p.test(new URL(url).pathname.slice(RAIZ.length)))) continue;
      const nombre = clase === 'cdn' ? CACHE_CDN : CACHE;
      if (await caches.match(peticion)) continue;
      try { await guardar(nombre, peticion, await fetch(peticion)); } catch { /* sin conexión: otra vez será */ }
    }
  })());
});
