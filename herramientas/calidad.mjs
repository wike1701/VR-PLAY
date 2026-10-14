// Comprueba que los juegos cumplen el estándar de calidad y rendimiento (docs/CALIDAD.md) y que
// sus portadas siguen el estándar de portadas (docs/PORTADAS.md). Revisa el código de cada
// juegos/<id>/juego.js y su miniatura.svg. Lo que mide en ejecución (llamadas de dibujo,
// triángulos) se comprueba aparte, con vrPlay.dibujado() en el navegador.
//
//   ERROR (hay que arreglarlo):
//     - sombras reales (castShadow / receiveShadow) o luces nuevas (PointLight, SpotLight, RectAreaLight)
//     - setTimeout, setInterval o addEventListener dentro del juego
//     - el juego no da respuesta con sonido (ctx.sonido) ni con vibración (ctx.vibrar)
//     - no llama a ctx.puntuacion (lo comprueba también marcadores.mjs)
//     - portada (miniatura.svg): falta, no es de 400×400, pesa más de 16 KB o lleva texto,
//       imágenes, enlaces, scripts o filtros (en el móvil se dibujan 22 a la vez)
//   AVISO (revisarlo):
//     - "new THREE.Vector3(…)" y parecidos dentro de las funciones de cada fotograma
//       (actualizar, mover…, simular…): crean basura y en el Quest dan tirones
//     - más de 6 materiales MeshStandardMaterial/MeshPhysicalMaterial distintos
//     - texturas de 1024 px o más
//     - el juego no usa el kit de efectos de la shell (ctx.efectos) en ningún momento
//     - cambia la niebla a mano (ctx.escena.fog) en vez de ctx.fondo(color, { niebla })
//     - árboles hechos con un cono suelto en vez del kit (ctx.arboles / ctx.geometriaArbol)
//     - portada sin el coral de la marca (#ff6a3d) o sin viñeta
// Uso: node herramientas/calidad.mjs [id …] [--avisos]   (sin --avisos solo enseña los errores y el resumen)
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const verAvisos = args.includes('--avisos');
const elegidos = args.filter((a) => !a.startsWith('--'));
const catalogo = fs.readFileSync(path.join(RAIZ, 'juegos/catalogo.js'), 'utf8');
const ids = [...catalogo.matchAll(/\{\s*id:\s*'([a-z0-9_-]+)'/g)].map((m) => m[1]).filter((id) => !elegidos.length || elegidos.includes(id));

// Funciones que se ejecutan en cada fotograma (por su nombre)
const DE_CADA_FOTOGRAMA = /^(actualizar|mover|simular|paso|dirigir|comprobar|chocar|predecir|colocar|seguir|animar|manos|raton|golpes|cortes|pistolas|fisica|vuelo|bucle)/i;
const CREA_BASURA = /new THREE\.(Vector2|Vector3|Vector4|Quaternion|Euler|Matrix3|Matrix4|Color|Box3|Sphere|Ray|Plane|Line3|Raycaster)\(/;

function analizar(id) {
  const archivo = path.join(RAIZ, 'juegos', id, 'juego.js');
  const texto = fs.readFileSync(archivo, 'utf8');
  const errores = [];
  const avisos = [];

  if (/\.(castShadow|receiveShadow)\s*=\s*true/.test(texto)) errores.push('usa sombras reales (castShadow/receiveShadow): usa ctx.crearSombra');
  if (/new THREE\.(PointLight|SpotLight|RectAreaLight)\(/.test(texto)) errores.push('crea luces nuevas: la shell ya pone las luces; usa emissive o MeshBasicMaterial para lo que brilla');
  if (/\b(setTimeout|setInterval)\s*\(/.test(texto)) errores.push('usa setTimeout/setInterval: usa el tiempo de actualizar(dt)');
  if (/\baddEventListener\s*\(/.test(texto)) errores.push('usa addEventListener: usa ctx.raton y ctx.manos');
  if (!/ctx\.sonido\(/.test(texto) && !/ctx\.efectos\.impacto\(/.test(texto)) errores.push('no tiene sonidos (ctx.sonido o ctx.efectos.impacto)');
  if (!/ctx\.vibrar\(/.test(texto) && !/ctx\.efectos\.impacto\(/.test(texto)) errores.push('no hace vibrar los mandos (ctx.vibrar o ctx.efectos.impacto)');
  if (!/ctx\.puntuacion\(/.test(texto)) errores.push('no llama a ctx.puntuacion(valor) al terminar la partida');

  const caros = (texto.match(/new THREE\.(MeshStandardMaterial|MeshPhysicalMaterial)\(/g) || []).length;
  if (caros > 6) avisos.push(`${caros} materiales MeshStandard/Physical: déjalos para los protagonistas pequeños (el resto, MeshLambertMaterial)`);
  for (const m of texto.matchAll(/tam:\s*(\d{4,})/g)) avisos.push(`textura de ${m[1]} px: con 512 suele bastar`);
  if (!/ctx\.efectos\./.test(texto)) avisos.push('no usa ctx.efectos (estallidos, puntos que saltan, impactos): ver docs/CALIDAD.md');
  if (/ctx\.escena\.fog/.test(texto)) avisos.push('cambia la niebla a mano: usa ctx.fondo(color, { niebla: [cerca, lejos] }) (la shell la restaura sola)');
  if (/(copa|arbol|pino)[A-Za-z]*\s*=.*ConeGeometry/i.test(texto)) avisos.push('árboles de cono suelto: usa ctx.arboles(lista, { tipo }) o ctx.geometriaArbol(tipo)');

  // Portada
  const svg = path.join(RAIZ, 'juegos', id, 'miniatura.svg');
  if (!fs.existsSync(svg)) errores.push('no tiene portada (juegos/<id>/miniatura.svg): ver docs/PORTADAS.md');
  else {
    const p = fs.readFileSync(svg, 'utf8');
    const kb = Buffer.byteLength(p) / 1024;
    if (!/viewBox="0 0 400 400"/.test(p)) errores.push('portada: el viewBox tiene que ser "0 0 400 400"');
    if (kb > 16) errores.push(`portada: pesa ${kb.toFixed(1)} KB (máximo 16)`);
    if (/<(text|image|script|foreignObject|filter)\b/.test(p) || /href="(https?:|data:)/.test(p)) errores.push('portada: sin textos, imágenes, scripts, filtros ni enlaces (ver docs/PORTADAS.md)');
    if (!/#ff6a3d/i.test(p)) avisos.push('portada: falta el coral de la marca (#ff6a3d) en la acción (estela, chispa o impacto)');
    if (!/id="vineta"/.test(p)) avisos.push('portada: falta la viñeta oscura de los bordes (id="vineta")');
  }

  // Objetos nuevos en las funciones de cada fotograma (siguiendo las llaves para saber en qué función estamos)
  const pila = [];
  let pendiente = null;
  const basura = [];
  texto.split('\n').forEach((linea, n) => {
    const sinTexto = linea.replace(/(['"`])(?:\\.|(?!\1).)*\1/g, '""').replace(/\/\/.*$/, '');
    const f = sinTexto.match(/function\s+([A-Za-z_$][\w$]*)\s*\(/) || sinTexto.match(/^\s*([A-Za-z_$][\w$]*)\s*\([^)]*\)\s*\{/);
    if (f && !/^(if|for|while|switch|catch)$/.test(f[1])) pendiente = f[1];
    const dentro = pila.some((nombre) => nombre && DE_CADA_FOTOGRAMA.test(nombre));
    if (dentro && CREA_BASURA.test(sinTexto)) basura.push(n + 1);
    for (const c of sinTexto) {
      if (c === '{') { pila.push(pendiente); pendiente = null; }
      else if (c === '}') pila.pop();
    }
  });
  if (basura.length) avisos.push(`crea objetos de three.js en funciones de cada fotograma (líneas ${basura.slice(0, 8).join(', ')}${basura.length > 8 ? '…' : ''}): reutiliza vectores creados fuera`);

  return { id, errores, avisos };
}

const resultados = ids.map(analizar);
let total = 0;
for (const r of resultados) {
  const lineas = [...r.errores.map((e) => `  ✘ ${e}`), ...(verAvisos ? r.avisos.map((a) => `  · ${a}`) : [])];
  total += r.errores.length;
  if (lineas.length) console.log(`${r.id}\n${lineas.join('\n')}`);
}
const conAvisos = resultados.filter((r) => r.avisos.length).length;
if (total) {
  console.error(`\nCalidad: ${total} errores en ${resultados.filter((r) => r.errores.length).length} juegos.`);
  process.exit(1);
}
console.log(`Calidad correcta: ${resultados.length} juegos sin errores${conAvisos ? ` (${conAvisos} con avisos: node herramientas/calidad.mjs --avisos)` : ''}.`);
