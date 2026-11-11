// Comprueba que todos los juegos tienen clasificación:
//   - que cada juego de juegos/catalogo.js tiene su marcador en juegos/marcadores.js, con los datos bien puestos;
//   - que su juego.js llama a ctx.puntuacion(…) o ctx.partida.terminar(…) (al terminar cada partida);
//   - que no sobran marcadores de juegos que ya no existen.
// Uso: node herramientas/marcadores.mjs
import fs from 'node:fs';
import path from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const { MARCADORES, SEGUNDOS_PARTIDA } = await import(pathToFileURL(path.join(RAIZ, 'juegos/marcadores.js')).href);
const catalogo = fs.readFileSync(path.join(RAIZ, 'juegos/catalogo.js'), 'utf8');
const ids = [...catalogo.matchAll(/\{\s*id:\s*'([a-z0-9_-]+)'/g)].map((m) => m[1]);
const errores = [];
if (!(SEGUNDOS_PARTIDA > 0)) errores.push('juegos/marcadores.js tiene que exportar SEGUNDOS_PARTIDA (lo que dura como mucho una partida abierta)');

const UNIDADES = ['puntos', 'tiempo', 'golpes', 'diferencia', 'recepciones', 'metros'];
for (const id of ids) {
  const m = MARCADORES[id];
  if (!m) {
    errores.push(`${id}: falta su marcador en juegos/marcadores.js`);
    continue;
  }
  if (!['mayor', 'menor'].includes(m.orden)) errores.push(`${id}: "orden" tiene que ser 'mayor' o 'menor'`);
  if (!UNIDADES.includes(m.unidad)) errores.push(`${id}: "unidad" tiene que ser una de ${UNIDADES.join(', ')} (o añade la nueva aquí, en shell/clasificacion.js y en clasificacion.criterio de los idiomas)`);
  if (!Number.isFinite(m.min) || !Number.isFinite(m.max) || m.min >= m.max) errores.push(`${id}: "min" y "max" tienen que ser números y min < max`);
  if (!Number.isFinite(m.minSegundos) || m.minSegundos < 0) errores.push(`${id}: falta "minSegundos"`);
  if (m.maxPorSegundo !== undefined && !(m.maxPorSegundo > 0)) errores.push(`${id}: "maxPorSegundo" tiene que ser mayor que 0`);
  // Con ritmo máximo, un «max» por encima de lo que da la partida más larga no sirve de nada
  const tope = m.maxPorSegundo * SEGUNDOS_PARTIDA + 10;
  if (m.maxPorSegundo > 0 && m.max > tope) errores.push(`${id}: "max" (${m.max}) no se puede alcanzar: con maxPorSegundo ${m.maxPorSegundo} y partidas de ${SEGUNDOS_PARTIDA} s como mucho, bájalo a ${Math.floor(tope)}`);  const archivo = path.join(RAIZ, 'juegos', id, 'juego.js');
  if (fs.existsSync(archivo) && !/ctx\.(puntuacion|partida\.terminar)\(/.test(fs.readFileSync(archivo, 'utf8'))) {
    errores.push(`${id}: su juego.js no llama a ctx.puntuacion(valor) ni a ctx.partida.terminar(valor) al terminar la partida`);
  }
}
for (const id of Object.keys(MARCADORES)) {
  if (!ids.includes(id)) errores.push(`${id}: tiene marcador pero no está en juegos/catalogo.js`);
}

if (errores.length) {
  console.error('Clasificaciones con problemas:\n' + errores.map((e) => `  - ${e}`).join('\n'));
  process.exit(1);
}
console.log(`Clasificaciones correctas: ${ids.length} juegos con marcador y ctx.puntuacion.`);
