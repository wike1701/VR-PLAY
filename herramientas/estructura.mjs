// Comprueba que la estructura del proyecto sigue las normas de docs/ESTRUCTURA.md:
//   - cada juego de juegos/catalogo.js tiene su carpeta con juego.js y su miniatura, y no sobran carpetas;
//   - en juegos/ solo hay carpetas de juegos y los datos compartidos (catalogo.js, marcadores.js);
//   - en la raíz solo hay lo previsto (páginas, configuración y documentos principales);
//   - todas las rutas locales de los import, src y href de las páginas y del código existen
//     (así, al mover un archivo, no queda ningún enlace roto).
// Uso: node herramientas/estructura.mjs
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const errores = [];
const relativa = (p) => path.relative(RAIZ, p).split(path.sep).join('/');

// ─── Juegos ──────────────────────────────────────────────────────────────
const catalogo = fs.readFileSync(path.join(RAIZ, 'juegos/catalogo.js'), 'utf8');
const juegos = [...catalogo.matchAll(/\{\s*id:\s*'([a-z0-9_-]+)'([^}]*)\}/g)].map((m) => ({
  id: m[1],
  miniatura: (m[2].match(/miniatura:\s*'([^']+)'/) || [])[1] || `juegos/${m[1]}/miniatura.svg`,
}));
const DATOS_JUEGOS = ['catalogo.js', 'marcadores.js'];
for (const { id, miniatura } of juegos) {
  if (!fs.existsSync(path.join(RAIZ, 'juegos', id, 'juego.js'))) errores.push(`juegos/${id}/juego.js no existe (está en el catálogo)`);
  if (!fs.existsSync(path.join(RAIZ, miniatura))) errores.push(`${miniatura} no existe (miniatura de ${id})`);
}
for (const nombre of fs.readdirSync(path.join(RAIZ, 'juegos'))) {
  const ruta = path.join(RAIZ, 'juegos', nombre);
  if (fs.statSync(ruta).isDirectory()) {
    if (!juegos.some((j) => j.id === nombre)) errores.push(`juegos/${nombre}/ no está en juegos/catalogo.js (¿falta añadirlo o sobra la carpeta?)`);
  } else if (!DATOS_JUEGOS.includes(nombre)) {
    errores.push(`juegos/${nombre}: en juegos/ solo van carpetas de juegos y ${DATOS_JUEGOS.join(', ')} (el código del navegador va en shell/)`);
  }
}

// ─── Raíz ────────────────────────────────────────────────────────────────
// Las páginas van en la raíz porque su dirección es pública (enlaces, Google, buscadores).
const PERMITIDOS_RAIZ = new Set([
  '.assetsignore', '.gitignore', '.git', '.github', '.claude', '.wrangler', '.dev.vars', 'node_modules',
  'README.md', 'CLAUDE.md', 'wrangler.jsonc', 'favicon.svg', 'manifest.webmanifest',
  'bd', 'docs', 'estilos', 'herramientas', 'iconos', 'idiomas', 'juegos', 'servidor', 'shell',
]);
for (const nombre of fs.readdirSync(RAIZ)) {
  if (PERMITIDOS_RAIZ.has(nombre) || nombre.endsWith('.html')) continue;
  errores.push(`${nombre}: no se esperaba en la raíz (documentos en docs/, estilos en estilos/, código en shell/ o servidor/; si es nuevo y va aquí, añádelo a PERMITIDOS_RAIZ)`);
}

// ─── Rutas locales ───────────────────────────────────────────────────────
const IGNORAR = new Set(['.git', '.claude', '.wrangler', 'node_modules']);
function archivos(carpeta, lista = []) {
  for (const nombre of fs.readdirSync(carpeta)) {
    if (IGNORAR.has(nombre)) continue;
    const ruta = path.join(carpeta, nombre);
    if (fs.statSync(ruta).isDirectory()) archivos(ruta, lista);
    else if (/\.(html|js|mjs|css|webmanifest)$/.test(nombre)) lista.push(ruta);
  }
  return lista;
}
const PATRONES = [
  /\bimport\s+(?:[\w*{}\s,]+\s+from\s+)?['"](\.{1,2}\/[^'"]+)['"]/g,  // import … from './x.js'
  /\bimport\(\s*['"](\.{1,2}\/[^'"]+)['"]\s*\)/g,                     // import('./x.js')
  /\b(?:src|href)=["']([^"'#?:]+\.(?:js|css|svg|png|jpg|webmanifest|html))["']/g, // src="x.js", href="estilos/x.css"
];
// Los textos legales traducidos se insertan dentro de legal.html: sus enlaces se leen desde la raíz
const baseDe = (archivo) => (relativa(archivo).startsWith('idiomas/legal/') ? RAIZ : path.dirname(archivo));
let comprobadas = 0;
for (const archivo of archivos(RAIZ)) {
  if (archivo === fileURLToPath(import.meta.url)) continue; // sus comentarios tienen rutas de ejemplo
  const texto = fs.readFileSync(archivo, 'utf8');
  for (const patron of PATRONES) {
    for (const m of texto.matchAll(patron)) {
      const destino = m[1];
      if (/^(https?:)?\/\//.test(destino) || destino.startsWith('/') || destino.includes('${')) continue;
      comprobadas += 1;
      if (!fs.existsSync(path.resolve(baseDe(archivo), destino))) errores.push(`${relativa(archivo)}: «${destino}» no existe`);
    }
  }
}

if (errores.length) {
  console.error('Estructura con problemas:\n' + errores.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}
console.log(`Estructura correcta: ${juegos.length} juegos completos y ${comprobadas} rutas locales que existen.`);
