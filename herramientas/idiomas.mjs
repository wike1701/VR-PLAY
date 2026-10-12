// Comprueba los textos de los idiomas (idiomas/*.js) contra el original en español:
//   - que no falte ni sobre ninguna clave, y que cada texto sea del mismo tipo (texto, plural o lista);
//   - que los datos entre llaves ({n}, {juego}…) sean los mismos que en español;
//   - que las claves que usan los juegos (ctx.t('…')) existan;
//   - que idiomas/detectar.js e idiomas/idiomas.js tengan la misma lista de idiomas
//     y que cada idioma tenga su texto legal (idiomas/legal/<código>.html).
// Uso: node herramientas/idiomas.mjs
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const CARPETA = path.join(RAIZ, 'idiomas');
const errores = [];
const avisos = [];

const cargar = async (codigo) => (await import(pathToFileURL(path.join(CARPETA, `${codigo}.js`)).href)).default;
const tipo = (v) => (Array.isArray(v) ? 'lista' : typeof v === 'string' ? 'texto' : v && typeof v === 'object' && 'other' in v ? 'plural' : 'grupo');
const datos = (s) => [...s.matchAll(/\{(\w+)\}/g)].map((m) => m[1]).sort().join(',');

// Lista de idiomas: la de idiomas.js (con nombres) y la de detectar.js tienen que coincidir
const codigosModulo = [...fs.readFileSync(path.join(CARPETA, 'idiomas.js'), 'utf8').matchAll(/codigo: '([a-z]+)'/g)].map((m) => m[1]);
const listaDetectar = fs.readFileSync(path.join(CARPETA, 'detectar.js'), 'utf8').match(/CODIGOS = \[([^\]]*)\]/);
const codigosDetectar = listaDetectar ? [...listaDetectar[1].matchAll(/'([a-z]+)'/g)].map((m) => m[1]) : [];
if (codigosModulo.join() !== codigosDetectar.join()) {
  errores.push(`La lista de idiomas no coincide: idiomas.js [${codigosModulo}] y detectar.js [${codigosDetectar}]`);
}

const original = await cargar('es');

function comparar(codigo, base, otro, ruta = '') {
  for (const [clave, valor] of Object.entries(base)) {
    const donde = ruta ? `${ruta}.${clave}` : clave;
    if (!(clave in otro)) {
      errores.push(`${codigo}: falta "${donde}"`);
      continue;
    }
    const v = otro[clave];
    if (tipo(valor) !== tipo(v)) {
      // Un plural en español puede ser un texto fijo en idiomas sin plural (ja, ko, zh) y al revés
      const plurales = new Set([tipo(valor), tipo(v)]);
      if (!(plurales.has('plural') && plurales.has('texto'))) {
        errores.push(`${codigo}: "${donde}" es ${tipo(v)} y en español es ${tipo(valor)}`);
        continue;
      }
    }
    if (tipo(valor) === 'grupo') {
      comparar(codigo, valor, v, donde);
    } else if (tipo(valor) !== 'lista') {
      const enEs = tipo(valor) === 'plural' ? datos(valor.other) : datos(valor);
      const formas = tipo(v) === 'plural' ? Object.entries(v) : [['texto', v]];
      for (const [forma, texto] of formas) {
        if (typeof texto !== 'string') errores.push(`${codigo}: "${donde}.${forma}" no es un texto`);
        else if (datos(texto) !== enEs && !(forma === 'one' && datos(texto) === enEs.split(',').filter((d) => d !== 'n').join(','))) {
          errores.push(`${codigo}: "${donde}"${formas.length > 1 ? ` (${forma})` : ''} usa {${datos(texto)}} y en español {${enEs}}`);
        }
      }
    } else if (donde.endsWith('.etiquetas') && v.length < 15) {
      avisos.push(`${codigo}: "${donde}" solo tiene ${v.length} etiquetas`);
    }
  }
  for (const clave of Object.keys(otro)) {
    if (!(clave in base)) errores.push(`${codigo}: sobra "${ruta ? `${ruta}.${clave}` : clave}" (no está en español)`);
  }
}

for (const codigo of codigosModulo.filter((c) => c !== 'es')) {
  if (!fs.existsSync(path.join(CARPETA, `${codigo}.js`))) {
    errores.push(`Falta el archivo idiomas/${codigo}.js`);
    continue;
  }
  comparar(codigo, original, await cargar(codigo));
  if (!fs.existsSync(path.join(CARPETA, 'legal', `${codigo}.html`))) errores.push(`Falta el texto legal idiomas/legal/${codigo}.html`);
}

// Claves que usan los juegos: ctx.t('clave') → juegos.<id>.juego.clave (o partida.clave)
const buscar = (clave) => clave.split('.').reduce((v, parte) => (v && typeof v === 'object' ? v[parte] : undefined), original);
for (const id of fs.readdirSync(path.join(RAIZ, 'juegos'))) {
  const archivo = path.join(RAIZ, 'juegos', id, 'juego.js');
  if (!fs.existsSync(archivo)) continue;
  const codigo = fs.readFileSync(archivo, 'utf8');
  if (!buscar(`juegos.${id}`)) errores.push(`es: falta la sección "juegos.${id}"`);
  // Las claves entre comillas que van dentro de ctx.t(…), también en ctx.t(cond ? 'a' : 'b')
  // (no las de las comparaciones, como estado === 'jugando')
  for (const llamada of codigo.matchAll(/ctx\.t\(([^()]*(?:\([^()]*\)[^()]*)*)\)/g)) {
    for (const [, clave] of llamada[1].matchAll(/(?:^|[?:]\s*)'([A-Za-z.]+)'/g)) {
      const completa = clave.startsWith('partida.') ? clave : `juegos.${id}.juego.${clave}`;
      if (buscar(completa) === undefined) errores.push(`${id}/juego.js usa "${clave}" y no existe "${completa}" en es.js`);
    }
  }
}

for (const a of avisos) console.log(`aviso: ${a}`);
if (errores.length) {
  for (const e of errores) console.log(`ERROR: ${e}`);
  console.log(`\n${errores.length} errores.`);
  process.exit(1);
}
console.log(`Idiomas correctos: ${codigosModulo.join(', ')}.`);
