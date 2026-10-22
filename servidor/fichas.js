// Fichas de los juegos y mapa del sitio, para los buscadores.
//   GET /juego/:id            → la ficha del juego en HTML (?lang=xx para cada idioma)
//   GET /sitemap.xml          → todas las páginas públicas en los 9 idiomas
//   GET /llms.txt             → qué es la web y qué juegos tiene, en texto sencillo para las IA
//                               (ChatGPT, Perplexity, Claude…); en inglés, o en otro idioma con ?lang=xx
// Los juegos se abren con play.html#id, y lo que va detrás de # no lo lee Google: sin estas
// fichas, los juegos no existen para los buscadores. El HTML sale ya escrito desde aquí (no
// lo pinta JavaScript en el navegador) para que cualquier buscador o red social lo lea.
// Los juegos en pruebas (los ocultos de juegosOcultos) no tienen ficha ni salen en el mapa ni en llms.txt.
import es from '../idiomas/es.js';
import en from '../idiomas/en.js';
import fr from '../idiomas/fr.js';
import de from '../idiomas/de.js';
import it from '../idiomas/it.js';
import pt from '../idiomas/pt.js';
import ja from '../idiomas/ja.js';
import ko from '../idiomas/ko.js';
import zh from '../idiomas/zh.js';
import { juegosOcultos } from './juegos-en-pruebas.js';

const TEXTOS = { es, en, fr, de, it, pt, ja, ko, zh };
const IDIOMAS = Object.keys(TEXTOS);
const DOMINIO = 'https://vrplaygame.com';
const ETIQUETAS_VISIBLES = 12;
const JUEGOS_RELACIONADOS = 6;
// Páginas sueltas del mapa del sitio (todas aceptan ?lang=)
const PAGINAS = ['/', '/foro', '/clasificacion', '/legal'];

const escapar = (s) => String(s ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
const valido = (codigo) => (Object.hasOwn(TEXTOS, codigo) ? codigo : null);

// Texto de un idioma (con el español si le falta), con {datos} y plurales { one, other } como en idiomas/idiomas.js
function traductor(idioma) {
  const plurales = new Intl.PluralRules(idioma);
  const buscar = (objeto, clave) => clave.split('.').reduce((v, parte) => (v && typeof v === 'object' ? v[parte] : undefined), objeto);
  return (clave, datos = {}) => {
    let v = buscar(TEXTOS[idioma], clave) ?? buscar(es, clave);
    if (v && typeof v === 'object' && !Array.isArray(v) && 'other' in v) v = v[plurales.select(datos.n ?? 0)] ?? v.other;
    if (typeof v !== 'string') return v;
    return v.replace(/\{(\w+)\}/g, (marca, nombre) => (nombre in datos ? String(datos[nombre]) : marca));
  };
}

// La lista de juegos sale de juegos/catalogo.js, que es un módulo del navegador (traduce con
// idiomas/idiomas.js) y no se puede importar aquí: se leen sus líneas { id: 'x', genero: 'y', … }.
// Solo cambia al desplegar, y cada despliegue empieza con el Worker vacío, así que se lee una vez.
let catalogo = null;
async function leerCatalogo(env, url) {
  if (catalogo) return catalogo;
  const respuesta = await env.ASSETS.fetch(new URL('/juegos/catalogo.js', url));
  const codigo = await respuesta.text();
  const lista = [];
  for (const [, id, resto] of codigo.matchAll(/\{\s*id:\s*'([a-z0-9_-]+)'([^}]*)\}/g)) {
    const campo = (nombre) => resto.match(new RegExp(`${nombre}:\\s*'([^']+)'`))?.[1];
    if (!Object.hasOwn(es.juegos, id)) continue; // sin textos no hay ficha
    lista.push({
      id,
      genero: campo('genero') || 'otro',
      miniatura: `/${campo('miniatura') || `juegos/${id}/miniatura.svg`}`,
      pruebas: /pruebas:\s*true/.test(resto),
    });
  }
  catalogo = lista;
  return lista;
}

// Juegos que se pueden enseñar: los del catálogo menos los que están en pruebas
async function juegosPublicos(env, url) {
  const [lista, ocultos] = await Promise.all([leerCatalogo(env, url), juegosOcultos(env)]);
  const enPruebas = new Set(ocultos);
  return lista.filter((j) => !j.pruebas && !enPruebas.has(j.id));
}

// Imagen para compartir: la del juego si existe (iconos/juegos/<id>.jpg, ver
// herramientas/portadas-compartir.mjs) o la general. Las redes sociales no aceptan SVG.
const imagenes = new Map();
async function imagenCompartir(env, url, id) {
  if (!imagenes.has(id)) {
    const ruta = `/iconos/juegos/${id}.jpg`;
    const respuesta = await env.ASSETS.fetch(new Request(new URL(ruta, url), { method: 'HEAD' }));
    imagenes.set(id, respuesta.ok ? ruta : '/iconos/compartir.jpg');
  }
  return imagenes.get(id);
}

// Sin ?lang=, el idioma del navegador (y si no es ninguno de los nuestros, inglés), como idiomas/detectar.js
function idiomaDelNavegador(request) {
  for (const parte of (request.headers.get('accept-language') || '').split(',')) {
    const codigo = valido(parte.trim().split(/[-;]/)[0].toLowerCase());
    if (codigo) return codigo;
  }
  return 'en';
}

const conIdioma = (ruta, idioma) => `${DOMINIO}${ruta}${idioma ? `?lang=${idioma}` : ''}`;
const alternativas = (ruta) => [
  ...IDIOMAS.map((codigo) => `<link rel="alternate" hreflang="${codigo}" href="${conIdioma(ruta, codigo)}">`),
  `<link rel="alternate" hreflang="x-default" href="${conIdioma(ruta)}">`,
].join('\n');

const cabecerasHtml = {
  'content-type': 'text/html; charset=utf-8',
  'cache-control': 'public, max-age=300',
  vary: 'Accept-Language',
};

export async function ficha({ request, env, params }) {
  const url = new URL(request.url);
  const elegido = valido(url.searchParams.get('lang'));
  const idioma = elegido || idiomaDelNavegador(request);
  const t = traductor(idioma);
  const publicos = await juegosPublicos(env, url);
  const juego = publicos.find((j) => j.id === params.id);
  if (!juego) return noEncontrado(t, idioma);

  const textos = (id, campo) => t(`juegos.${id}.${campo}`);
  const titulo = textos(juego.id, 'titulo');
  const descripcion = textos(juego.id, 'descripcion');
  const genero = t(`generos.${juego.genero}`);
  const ruta = `/juego/${juego.id}`;
  const direccion = conIdioma(ruta, elegido);
  const imagen = `${DOMINIO}${await imagenCompartir(env, url, juego.id)}`;
  const lang = elegido ? `?lang=${elegido}` : '';
  const jugar = `/play${lang}#${juego.id}`;

  // Partidas y "me gusta" (si la base de datos no responde, la ficha sale igual sin ellos)
  let cifras = null;
  if (env.DB) {
    cifras = await env.DB.prepare('SELECT me_gusta, partidas FROM juegos_estadisticas WHERE juego = ?').bind(juego.id).first().catch(() => null);
  }
  const corto = new Intl.NumberFormat(idioma, { notation: 'compact', maximumFractionDigits: 1 });
  const estadisticas = cifras
    ? [
      cifras.partidas ? `<span>▶ ${escapar(t('inicio.partidasN', { n: cifras.partidas }).replace(String(cifras.partidas), corto.format(cifras.partidas)))}</span>` : '',
      cifras.me_gusta ? `<span>♥ ${escapar(t('inicio.meGustaN', { n: cifras.me_gusta }).replace(String(cifras.me_gusta), corto.format(cifras.me_gusta)))}</span>` : '',
    ].join('')
    : '';

  // Otros juegos: primero los del mismo género, luego el resto, en el orden del catálogo
  const otros = publicos.filter((j) => j.id !== juego.id);
  const relacionados = [...otros.filter((j) => j.genero === juego.genero), ...otros.filter((j) => j.genero !== juego.genero)].slice(0, JUEGOS_RELACIONADOS);

  const todasEtiquetas = textos(juego.id, 'etiquetas') || [];
  const etiquetas = todasEtiquetas.slice(0, ETIQUETAS_VISIBLES);
  // Frases claras que los buscadores y las IA puedan citar tal cual, y preguntas frecuentes
  const datosTexto = { juego: titulo, genero };
  const resumen = t('ficha.resumen', datosTexto);
  const resumenWeb = t('ficha.resumenWeb', { n: publicos.length });
  const preguntas = ['Gratis', 'Gafas', 'Quest', 'Descargar', 'Clasificacion']
    .map((p) => [t(`ficha.p${p}`, datosTexto), t(`ficha.r${p}`, datosTexto)]);
  // Datos estructurados de schema.org: el juego, sus preguntas frecuentes y las migas
  const datosEstructurados = {
    '@context': 'https://schema.org',
    '@graph': [
      {
        '@type': 'VideoGame',
        name: titulo,
        description: descripcion,
        abstract: resumen,
        url: direccion,
        image: imagen,
        genre: genero,
        keywords: todasEtiquetas.join(', '),
        inLanguage: idioma,
        gamePlatform: ['Web browser', 'Meta Quest', 'PC', 'Mobile'],
        applicationCategory: 'Game',
        operatingSystem: 'Any',
        playMode: 'SinglePlayer',
        isAccessibleForFree: true,
        offers: { '@type': 'Offer', price: '0', priceCurrency: 'EUR' },
        potentialAction: { '@type': 'PlayAction', target: `${DOMINIO}${jugar}` },
        ...(cifras?.partidas ? { interactionStatistic: { '@type': 'InteractionCounter', interactionType: 'https://schema.org/PlayAction', userInteractionCount: cifras.partidas } } : {}),
        publisher: { '@type': 'Organization', name: 'VR Play', url: DOMINIO },
        isPartOf: { '@type': 'WebSite', name: 'VR Play', url: DOMINIO },
      },
      {
        '@type': 'FAQPage',
        inLanguage: idioma,
        mainEntity: preguntas.map(([pregunta, respuesta]) => ({ '@type': 'Question', name: pregunta, acceptedAnswer: { '@type': 'Answer', text: respuesta } })),
      },
      {
        '@type': 'BreadcrumbList',
        itemListElement: [
          { '@type': 'ListItem', position: 1, name: t('comun.juegos'), item: conIdioma('/', elegido) },
          { '@type': 'ListItem', position: 2, name: titulo, item: direccion },
        ],
      },
    ],
  };
  const tituloPagina = t('ficha.tituloPagina', { juego: titulo });
  const metaDescripcion = `${descripcion} ${t('ficha.metaCola')}`;

  const html = `<!DOCTYPE html>
<html lang="${idioma}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover">
<title>${escapar(tituloPagina)}</title>
<meta name="description" content="${escapar(metaDescripcion)}">
<link rel="canonical" href="${direccion}">
${alternativas(ruta)}
<meta property="og:type" content="website">
<meta property="og:site_name" content="VR Play">
<meta property="og:title" content="${escapar(titulo)} · VR Play">
<meta property="og:description" content="${escapar(metaDescripcion)}">
<meta property="og:url" content="${direccion}">
<meta property="og:image" content="${imagen}">
<meta property="og:locale" content="${idioma}">
<meta name="twitter:card" content="summary_large_image">
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="manifest" href="/manifest.webmanifest">
<link rel="apple-touch-icon" href="/iconos/apple-touch-icon.png">
<meta name="theme-color" content="#0a0b10">
<link rel="preload" href="/estilos/fuentes/Geist-Variable.woff2" as="font" type="font/woff2" crossorigin>
<link rel="stylesheet" href="/estilos/base.css">
<script type="application/ld+json">${JSON.stringify(datosEstructurados).replace(/</g, '\\u003c')}</script>
<script>
  // Quien ya eligió otro idioma en la web ve la ficha en ese idioma; un enlace con ?lang= cuenta como elección
  (function () {
    try {
      var clave = 'vrplay:idioma', enLaUrl = new URLSearchParams(location.search).get('lang');
      if (enLaUrl) localStorage.setItem(clave, enLaUrl);
      else {
        var guardado = localStorage.getItem(clave);
        if (guardado && guardado !== document.documentElement.lang && ${JSON.stringify(IDIOMAS)}.indexOf(guardado) >= 0) location.replace('?lang=' + guardado);
      }
    } catch (e) { /* sin almacenamiento */ }
  })();
</script>
<style>
  * { box-sizing: border-box; }
  body { margin: 0; background: var(--bg); color: var(--fg); line-height: 1.55; }
  a { color: inherit; }
  .contenedor { width: min(1080px, 100%); margin: 0 auto; padding: 0 16px; }
  header { border-bottom: 1px solid var(--line-suave); }
  .cabecera { display: flex; align-items: center; gap: 16px; min-height: 64px; }
  .logo { font-size: 1.4rem; text-decoration: none; }
  .cabecera nav { margin-left: auto; display: flex; gap: 16px; font-size: .95rem; }
  .cabecera nav a { color: var(--muted); text-decoration: none; }
  .cabecera nav a:hover { color: var(--fg); }
  .ficha { display: grid; grid-template-columns: minmax(0, 380px) minmax(0, 1fr); gap: 40px; padding: 40px 0 24px; align-items: start; }
  .portada { width: 100%; height: auto; aspect-ratio: 1; border-radius: var(--radio); background: var(--surface-2); box-shadow: var(--sombra); display: block; }
  .migas { font-size: .9rem; color: var(--muted); margin: 0 0 8px; }
  .migas a { color: var(--muted); }
  h1 { font-size: clamp(2rem, 5vw, 3.2rem); line-height: 1.05; margin: 0 0 12px; }
  .sello { display: inline-block; padding: 4px 10px; border-radius: 999px; background: var(--accent-tinta); color: var(--accent-2); font-size: .85rem; font-weight: 600; }
  .cifras { display: flex; flex-wrap: wrap; gap: 8px 18px; margin: 14px 0 0; color: var(--muted); font-family: var(--font-mono); font-size: .9rem; }
  .descripcion { font-size: 1.15rem; margin: 20px 0; max-width: 60ch; }
  .jugar { display: inline-flex; align-items: center; gap: 10px; padding: 16px 32px; border-radius: 999px; background: var(--accent); color: var(--sobre-accent); font-weight: 800; font-size: 1.15rem; text-decoration: none; box-shadow: var(--sombra-accent); }
  .jugar:hover { background: var(--accent-claro); }
  .nota { color: var(--muted); font-size: .92rem; margin: 12px 0 0; max-width: 60ch; }
  h2 { font-size: 1.35rem; margin: 40px 0 14px; }
  .controles { display: grid; grid-template-columns: repeat(auto-fit, minmax(220px, 1fr)); gap: 12px; margin: 0; padding: 0; list-style: none; }
  .controles li { background: var(--surface); border: 1px solid var(--line-suave); border-radius: var(--radio-chico); padding: 14px 16px; }
  .controles strong { display: block; margin-bottom: 4px; }
  .etiquetas { display: flex; flex-wrap: wrap; gap: 8px; margin: 0; padding: 0; list-style: none; }
  .etiquetas li { padding: 4px 10px; border-radius: 999px; border: 1px solid var(--line); color: var(--muted); font-size: .88rem; }
  .enlace-clasificacion { display: inline-block; margin-top: 18px; color: var(--accent-2); }
  .sobre p { max-width: 70ch; margin: 0 0 12px; }
  .preguntas { margin: 0; max-width: 70ch; }
  .preguntas dt { font-weight: 700; margin-top: 16px; }
  .preguntas dd { margin: 4px 0 0; color: var(--muted); }
  .otros { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 16px; margin: 0; padding: 0; list-style: none; }
  .otros a { display: block; text-decoration: none; }
  .otros img { width: 100%; height: auto; aspect-ratio: 1; border-radius: var(--radio-chico); background: var(--surface-2); display: block; }
  .otros span { display: block; margin-top: 6px; font-weight: 600; }
  .otros small { color: var(--muted); }
  .ver-todos { display: inline-block; margin-top: 20px; color: var(--accent-2); }
  footer { margin-top: 56px; border-top: 1px solid var(--line-suave); padding: 24px 0 40px; color: var(--muted); font-size: .9rem; }
  footer nav { display: flex; flex-wrap: wrap; gap: 8px 16px; }
  footer a { color: var(--muted); }
  .idiomas { margin-top: 14px; }
  @media (max-width: 720px) {
    .ficha { grid-template-columns: 1fr; gap: 24px; padding-top: 24px; }
    .portada { max-width: 320px; }
    .cabecera nav { display: none; }
    .jugar { width: 100%; justify-content: center; }
  }
</style>
</head>
<body>
<header>
  <div class="contenedor cabecera">
    <a class="logo" href="/${lang}">VR<span>·</span>Play</a>
    <nav>
      <a href="/${lang}">${escapar(t('comun.juegos'))}</a>
      <a href="/clasificacion${lang}">${escapar(t('clasificacion.titulos'))}</a>
      <a href="/foro${lang}">${escapar(t('comun.sugerencias'))}</a>
    </nav>
  </div>
</header>
<main class="contenedor">
  <article class="ficha">
    <img class="portada" src="${juego.miniatura}" alt="${escapar(titulo)}" width="400" height="400">
    <div>
      <p class="migas"><a href="/${lang}">${escapar(t('comun.juegos'))}</a> › ${escapar(genero)}</p>
      <h1>${escapar(titulo)}</h1>
      <span class="sello">${escapar(t('inicio.etiquetaHero'))} · ${escapar(t('inicio.dispositivos'))}</span>
      ${estadisticas ? `<p class="cifras">${estadisticas}</p>` : ''}
      <p class="descripcion">${escapar(descripcion)}</p>
      <a class="jugar" href="${jugar}">▶ ${escapar(t('ficha.jugarGratis'))}</a>
      <p class="nota">${escapar(t('ficha.sinDescargas'))}</p>

      <h2>${escapar(t('inicio.comoSeJuega'))}</h2>
      <ul class="controles">
        <li><strong>${escapar(t('ficha.conGafas'))}</strong>${escapar(textos(juego.id, 'controlesVR'))}</li>
        <li><strong>${escapar(t('ficha.conRaton'))}</strong>${escapar(textos(juego.id, 'controlesEscritorio'))}</li>
        <li><strong>${escapar(t('ficha.enMovil'))}</strong>${escapar(textos(juego.id, 'controlesTactil'))}</li>
      </ul>
      <a class="enlace-clasificacion" href="/clasificacion${lang}#${juego.id}">🏆 ${escapar(t('clasificacion.verCompleta'))}</a>

      <section class="sobre">
        <h2>${escapar(t('ficha.sobre', datosTexto))}</h2>
        <p>${escapar(resumen)}</p>
        <p>${escapar(t('ficha.partidas'))}</p>
        <p>${escapar(resumenWeb)}</p>
      </section>

      <h2>${escapar(t('ficha.preguntas'))}</h2>
      <dl class="preguntas">
        ${preguntas.map(([pregunta, respuesta]) => `<dt>${escapar(pregunta)}</dt><dd>${escapar(respuesta)}</dd>`).join('\n        ')}
      </dl>

      ${etiquetas.length ? `<h2>${escapar(t('ficha.etiquetas'))}</h2>
      <ul class="etiquetas">${etiquetas.map((e) => `<li>#${escapar(e)}</li>`).join('')}</ul>` : ''}
    </div>
  </article>

  <section>
    <h2>${escapar(t('ficha.masJuegos'))}</h2>
    <ul class="otros">
      ${relacionados.map((j) => `<li><a href="/juego/${j.id}${lang}"><img src="${j.miniatura}" alt="" width="400" height="400" loading="lazy"><span>${escapar(textos(j.id, 'titulo'))}</span><small>${escapar(t(`generos.${j.genero}`))}</small></a></li>`).join('\n      ')}
    </ul>
    <a class="ver-todos" href="/${lang}">${escapar(t('inicio.todosLosJuegos'))} →</a>
  </section>
</main>
<footer>
  <div class="contenedor">
    <nav>
      <a href="/foro${lang}">${escapar(t('comun.sugerirJuego'))}</a>
      <a href="/legal${lang}#privacidad">${escapar(t('comun.privacidad'))}</a>
      <a href="/legal${lang}#cookies">${escapar(t('comun.cookies'))}</a>
      <a href="/legal${lang}#contacto">${escapar(t('comun.contacto'))}</a>
      <a href="/legal${lang}#aviso-legal">${escapar(t('comun.avisoLegal'))}</a>
    </nav>
    <nav class="idiomas" aria-label="${escapar(t('comun.idioma'))}">
      ${IDIOMAS.map((codigo) => `<a href="${ruta}?lang=${codigo}" hreflang="${codigo}" lang="${codigo}"${codigo === idioma ? ' aria-current="true"' : ''}>${escapar(NOMBRES[codigo])}</a>`).join('\n      ')}
    </nav>
    <p>© 2026 VR Play</p>
  </div>
</footer>
</body>
</html>`;
  return new Response(html, { headers: cabecerasHtml });
}

// Los mismos nombres que IDIOMAS de idiomas/idiomas.js (cada idioma, en su idioma)
const NOMBRES = { es: 'Español', en: 'English', fr: 'Français', de: 'Deutsch', it: 'Italiano', pt: 'Português', ja: '日本語', ko: '한국어', zh: '简体中文' };

function noEncontrado(t, idioma) {
  const html = `<!DOCTYPE html>
<html lang="${idioma}">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<meta name="robots" content="noindex">
<title>VR Play</title>
<link rel="icon" type="image/svg+xml" href="/favicon.svg">
<link rel="stylesheet" href="/estilos/base.css">
<style>
  body { margin: 0; min-height: 100vh; display: grid; place-items: center; background: var(--bg); color: var(--fg); padding: 16px; text-align: center; }
  a { color: var(--accent-2); }
</style>
</head>
<body>
<main>
  <p>${escapar(t('ficha.noEncontrado'))}</p>
  <p><a href="/">${escapar(t('inicio.todosLosJuegos'))} →</a></p>
</main>
</body>
</html>`;
  return new Response(html, { status: 404, headers: { ...cabecerasHtml, 'cache-control': 'no-store' } });
}

export async function sitemap({ request, env }) {
  const url = new URL(request.url);
  const publicos = await juegosPublicos(env, url);
  const rutas = [...PAGINAS, ...publicos.map((j) => `/juego/${j.id}`)];
  const enlaces = (ruta) => [
    ...IDIOMAS.map((codigo) => `    <xhtml:link rel="alternate" hreflang="${codigo}" href="${escapar(conIdioma(ruta, codigo))}"/>`),
    `    <xhtml:link rel="alternate" hreflang="x-default" href="${escapar(conIdioma(ruta))}"/>`,
  ].join('\n');
  // Una entrada por idioma y por página, cada una con sus alternativas (como pide Google)
  const entradas = rutas.flatMap((ruta) => [null, ...IDIOMAS].map((codigo) => `  <url>
    <loc>${escapar(conIdioma(ruta, codigo))}</loc>
${enlaces(ruta)}
  </url>`));
  const xml = `<?xml version="1.0" encoding="UTF-8"?>
<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9" xmlns:xhtml="http://www.w3.org/1999/xhtml">
${entradas.join('\n')}
</urlset>
`;
  return new Response(xml, { headers: { 'content-type': 'application/xml; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}

// llms.txt (https://llmstxt.org): un resumen en Markdown para que las IA sepan qué es VR Play y
// qué juegos tiene, con el enlace a la ficha de cada uno. Se genera aquí para que nunca incluya
// los juegos en pruebas. Sin ?lang= sale en inglés, el idioma que más leen los rastreadores.
export async function llms({ request, env }) {
  const url = new URL(request.url);
  const idioma = valido(url.searchParams.get('lang')) || 'en';
  const t = traductor(idioma);
  const publicos = await juegosPublicos(env, url);
  const linea = (s) => String(s ?? '').replace(/\s+/g, ' ').trim();
  const enlace = (texto, ruta) => `[${linea(texto).replace(/[[\]]/g, '')}](${conIdioma(ruta, idioma)})`;
  const texto = `# VR Play

> ${linea(t('ficha.resumenWeb', { n: publicos.length }))}

${linea(t('inicio.queEsTexto'))}

## ${linea(t('inicio.comoSeJuega'))}

- ${linea(t('inicio.pasoQuestTitulo'))}: ${linea(t('inicio.pasoQuestTexto'))}
- ${linea(t('inicio.cambiarTitulo'))}: ${linea(t('inicio.cambiarTexto'))}
- ${linea(t('inicio.pasoSinGafasTitulo'))}: ${linea(t('inicio.pasoSinGafasTexto'))}
- ${linea(t('ficha.partidas'))}

## ${linea(t('comun.juegos'))}

${publicos.map((j) => `- ${enlace(t(`juegos.${j.id}.titulo`), `/juego/${j.id}`)} (${linea(t(`generos.${j.genero}`))}): ${linea(t(`juegos.${j.id}.descripcion`))}`).join('\n')}

## ${linea(t('ficha.paginas'))}

- ${enlace(t('inicio.todosLosJuegos'), '/')}
- ${enlace(t('clasificacion.titulos'), '/clasificacion')}
- ${enlace(t('comun.sugerirJuego'), '/foro')}
- ${enlace(t('comun.avisoLegal'), '/legal')}

## ${linea(t('ficha.otrosIdiomas'))}

${IDIOMAS.filter((codigo) => codigo !== idioma).map((codigo) => `- [${NOMBRES[codigo]}](${DOMINIO}/llms.txt?lang=${codigo})`).join('\n')}
`;
  return new Response(texto, { headers: { 'content-type': 'text/plain; charset=utf-8', 'cache-control': 'public, max-age=3600' } });
}
