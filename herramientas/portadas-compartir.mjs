// Imágenes JPEG para compartir los juegos en redes sociales y mensajería (WhatsApp, X, Facebook…),
// que no aceptan SVG. Salen de las portadas (juegos/<id>/miniatura.svg):
//   iconos/juegos/<id>.jpg   1200×630, la portada del juego sobre su propio fondo difuminado
//   iconos/compartir.jpg     1200×630, la imagen general de la web (varias portadas y el logo)
// Las usa la ficha de cada juego (servidor/fichas.js): si un juego aún no tiene su PNG, se
// comparte con la general, así que no rompe nada olvidarlo, pero conviene generarlo.
//
// Uso:  node herramientas/portadas-compartir.mjs            (solo los juegos que no tienen PNG)
//       node herramientas/portadas-compartir.mjs --todas    (las vuelve a hacer todas)
//       node herramientas/portadas-compartir.mjs topos      (solo esos juegos)
// Necesita Playwright con Chromium: npm install -g playwright && npx playwright install chromium
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CARPETA = path.join(RAIZ, 'iconos/juegos');
const ANCHO = 1200;
const ALTO = 630;

function cargarPlaywright() {
  const require = createRequire(import.meta.url);
  const rutas = [RAIZ];
  try { rutas.push(execSync('npm root -g', { encoding: 'utf8' }).trim()); } catch { /* sin npm */ }
  try {
    return require(require.resolve('playwright', { paths: rutas }));
  } catch {
    console.error('Falta Playwright. Instálalo con: npm install -g playwright && npx playwright install chromium');
    process.exit(1);
  }
}

// Los juegos del catálogo, como los lee servidor/fichas.js
const catalogo = fs.readFileSync(path.join(RAIZ, 'juegos/catalogo.js'), 'utf8');
const juegos = [...catalogo.matchAll(/\{\s*id:\s*'([a-z0-9_-]+)'([^}]*)\}/g)].map(([, id, resto]) => ({
  id,
  miniatura: resto.match(/miniatura:\s*'([^']+)'/)?.[1] || `juegos/${id}/miniatura.svg`,
}));

const argumentos = process.argv.slice(2);
const todas = argumentos.includes('--todas');
const elegidos = argumentos.filter((a) => !a.startsWith('--'));
const pendientes = juegos.filter(({ id }) => (elegidos.length ? elegidos.includes(id) : todas || !fs.existsSync(path.join(CARPETA, `${id}.jpg`))));
const general = path.join(RAIZ, 'iconos/compartir.jpg');
if (!pendientes.length && fs.existsSync(general) && !todas) {
  console.log('Todos los juegos tienen su imagen para compartir.');
  process.exit(0);
}

const datosUrl = (archivo) => `data:image/svg+xml;base64,${fs.readFileSync(path.join(RAIZ, archivo)).toString('base64')}`;
const LOGO = '<div class="logo">VR<span>·</span>Play</div>';
const ESTILO = `
  * { margin: 0; box-sizing: border-box; }
  body { width: ${ANCHO}px; height: ${ALTO}px; overflow: hidden; background: #0a0b10; font-family: system-ui, sans-serif; position: relative; }
  .fondo { position: absolute; inset: -60px; background-size: cover; background-position: center; filter: blur(40px) brightness(.45) saturate(1.2); }
  .portada { position: absolute; top: 45px; left: ${(ANCHO - 540) / 2}px; width: 540px; height: 540px; border-radius: 36px; box-shadow: 0 30px 80px rgba(0,0,0,.6); }
  .logo { position: absolute; right: 40px; bottom: 28px; color: #f4f5f8; font-weight: 800; font-size: 44px; letter-spacing: -.04em; text-shadow: 0 4px 20px rgba(0,0,0,.6); }
  .logo span { color: #ff6a3d; }
  .muro { position: absolute; inset: -40px; display: grid; grid-template-columns: repeat(6, 1fr); gap: 18px; transform: rotate(-8deg) scale(1.15); filter: brightness(.38); }
  .muro img { width: 100%; aspect-ratio: 1; border-radius: 20px; }
  .centro { position: absolute; inset: 0; display: grid; place-items: center; }
  .centro .logo { position: static; font-size: 150px; }
`;

const { chromium } = cargarPlaywright();
const navegador = await chromium.launch(process.env.CHROMIUM ? { executablePath: process.env.CHROMIUM } : {});
const pagina = await navegador.newPage({ viewport: { width: ANCHO, height: ALTO } });

async function guardar(html, destino) {
  await pagina.setContent(`<!DOCTYPE html><html><head><meta charset="utf-8"><style>${ESTILO}</style></head><body>${html}</body></html>`);
  await pagina.evaluate(() => Promise.all([...document.images].map((i) => i.decode().catch(() => {}))));
  await pagina.screenshot({ path: destino, type: 'jpeg', quality: 82 });
  console.log(`✔ ${path.relative(RAIZ, destino)}`);
}

fs.mkdirSync(CARPETA, { recursive: true });
for (const { id, miniatura } of pendientes) {
  const imagen = datosUrl(miniatura);
  await guardar(`<div class="fondo" style="background-image:url('${imagen}')"></div><img class="portada" src="${imagen}">${LOGO}`, path.join(CARPETA, `${id}.jpg`));
}
if (todas || !fs.existsSync(general)) {
  const muro = Array.from({ length: 30 }, (_, i) => `<img src="${datosUrl(juegos[i % juegos.length].miniatura)}">`).join('');
  await guardar(`<div class="muro">${muro}</div><div class="centro">${LOGO}</div>`, general);
}
await navegador.close();
