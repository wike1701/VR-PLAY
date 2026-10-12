// ─────────────────────────────────────────────────────────────────────────
// IDIOMAS DE VR PLAY
// Cada idioma tiene su archivo de textos (idiomas/es.js, idiomas/en.js…) con las
// mismas claves. El español es el idioma original: si a otro idioma le falta un
// texto, sale en español (y la consola avisa). `node herramientas/idiomas.mjs`
// comprueba que no falte ninguno.
//
// El idioma lo decide idiomas/detectar.js en el <head> de cada página (y lo deja
// en <html lang>). Aquí se cargan sus textos y se traduce el HTML marcado con:
//   data-i18n="clave"                 -> textContent
//   data-i18n-html="clave"            -> innerHTML (solo textos nuestros, nunca del foro)
//   data-i18n-attr="placeholder:clave; aria-label:otra"
//
// Uso en el código:  t('inicio.titulo'), t('partida.record', { n: 12 })
//   - {nombre} se sustituye por vars.nombre.
//   - Un texto puede ser { one: '…', other: '…' } (plurales): se elige con vars.n
//     según las reglas de cada idioma (Intl.PluralRules).
// ─────────────────────────────────────────────────────────────────────────

export const IDIOMAS = [
  { codigo: 'es', nombre: 'Español' },
  { codigo: 'en', nombre: 'English' },
  { codigo: 'fr', nombre: 'Français' },
  { codigo: 'de', nombre: 'Deutsch' },
  { codigo: 'it', nombre: 'Italiano' },
  { codigo: 'pt', nombre: 'Português' },
  { codigo: 'ja', nombre: '日本語' },
  { codigo: 'ko', nombre: '한국어' },
  { codigo: 'zh', nombre: '简体中文' },
];
export const ORIGINAL = 'es';
const CLAVE = 'vrplay:idioma';

const html = document.documentElement;
export const idioma = IDIOMAS.some((i) => i.codigo === html.lang) ? html.lang : ORIGINAL;
html.lang = idioma;

async function cargar(codigo) {
  try {
    return (await import(`./${codigo}.js`)).default;
  } catch (e) {
    console.error(`No se pudieron cargar los textos en "${codigo}"`, e);
    return {};
  }
}

const [textos, original] = await Promise.all([cargar(idioma), idioma === ORIGINAL ? null : cargar(ORIGINAL)]);
const fuentes = original ? [textos, original] : [textos];
const plurales = new Intl.PluralRules(idioma);
const avisados = new Set();

function buscar(objeto, clave) {
  let v = objeto;
  for (const parte of clave.split('.')) {
    if (v === null || typeof v !== 'object') return undefined;
    v = v[parte];
  }
  return v;
}

function valor(clave) {
  for (const fuente of fuentes) {
    const v = buscar(fuente, clave);
    if (v !== undefined) {
      if (fuente !== textos && !avisados.has(clave)) {
        avisados.add(clave);
        console.warn(`Falta el texto "${clave}" en "${idioma}": se usa el español`);
      }
      return v;
    }
  }
  return undefined;
}

const esPlural = (v) => v !== null && typeof v === 'object' && !Array.isArray(v) && 'other' in v;

export function existe(clave) {
  return valor(clave) !== undefined;
}

// Texto traducido. Las listas (por ejemplo, las etiquetas) se devuelven tal cual.
export function t(clave, vars = {}) {
  let v = valor(clave);
  if (v === undefined) {
    if (!avisados.has(clave)) {
      avisados.add(clave);
      console.warn(`Falta el texto "${clave}"`);
    }
    return clave;
  }
  if (esPlural(v)) v = v[plurales.select(Number(vars.n) || 0)] ?? v.other;
  if (typeof v !== 'string') return v;
  return v.replace(/\{(\w+)\}/g, (marca, nombre) => (nombre in vars ? String(vars[nombre]) : marca));
}

// El mismo texto en el idioma original (para datos que se guardan en español, como el tipo de juego del foro)
export function tOriginal(clave) {
  return buscar(original || textos, clave);
}

// Fechas y tiempos relativos ("hace 3 h") con el formato de cada idioma
const relativo = new Intl.RelativeTimeFormat(idioma, { numeric: 'auto' });
export function hace(milisegundos) {
  const s = Math.max(0, (Date.now() - milisegundos) / 1000);
  if (s < 60) return relativo.format(0, 'second');
  if (s < 3600) return relativo.format(-Math.floor(s / 60), 'minute');
  if (s < 86400) return relativo.format(-Math.floor(s / 3600), 'hour');
  if (s < 86400 * 30) return relativo.format(-Math.floor(s / 86400), 'day');
  return new Date(milisegundos).toLocaleDateString(idioma, { day: 'numeric', month: 'short', year: 'numeric' });
}

// Traduce el HTML marcado con data-i18n, data-i18n-html y data-i18n-attr
export function traducirPagina(raiz = document) {
  for (const nodo of raiz.querySelectorAll('[data-i18n]')) nodo.textContent = t(nodo.dataset.i18n);
  for (const nodo of raiz.querySelectorAll('[data-i18n-html]')) nodo.innerHTML = t(nodo.dataset.i18nHtml);
  for (const nodo of raiz.querySelectorAll('[data-i18n-attr]')) {
    for (const par of nodo.dataset.i18nAttr.split(';')) {
      const [atributo, clave] = par.split(':').map((s) => s.trim());
      if (atributo && clave) nodo.setAttribute(atributo, t(clave));
    }
  }
}

// Cambia de idioma: se guarda la elección y se recarga la página (sin ?lang=, que ya no hace falta)
export function elegirIdioma(codigo) {
  try { localStorage.setItem(CLAVE, codigo); } catch (e) { /* sin almacenamiento: vale para esta visita */ }
  const url = new URL(location.href);
  url.searchParams.set('lang', codigo); // por si no hay almacenamiento
  try {
    if (localStorage.getItem(CLAVE) === codigo) url.searchParams.delete('lang');
  } catch (e) { /* se queda en la dirección */ }
  if (url.href === location.href) location.reload();
  else location.href = url.href;
}

// Desplegable de idiomas para la cabecera de las páginas
export function selectorIdioma() {
  const select = document.createElement('select');
  select.className = 'selector-idioma';
  select.setAttribute('aria-label', t('comun.idioma'));
  select.title = t('comun.idioma');
  for (const { codigo, nombre } of IDIOMAS) {
    const opcion = new Option(nombre, codigo, codigo === idioma, codigo === idioma);
    opcion.lang = codigo;
    select.append(opcion);
  }
  select.addEventListener('change', () => elegirIdioma(select.value));
  return select;
}

// Enseña la página (idiomas/detectar.js la oculta mientras se traduce)
export function mostrarPagina() {
  html.classList.remove('traduciendo');
}

// Al cargarse: traduce el HTML de la página, monta los selectores (<span data-selector-idioma>) y la enseña.
// Una página que aún tiene que traducir algo más (legal.html) lleva data-i18n-esperar en un elemento
// y llama ella a mostrarPagina() cuando termina.
traducirPagina();
for (const hueco of document.querySelectorAll('[data-selector-idioma]')) hueco.replaceWith(selectorIdioma());
if (!document.querySelector('[data-i18n-esperar]')) mostrarPagina();
