// Utilidades comunes de la fábrica de vídeos: rutas, FFmpeg, ejecutar programas y leer los
// datos de la web (catálogo, textos de los juegos y marcadores) sin duplicarlos.
import fs from 'node:fs';
import path from 'node:path';
import { spawn, execSync } from 'node:child_process';
import { fileURLToPath, pathToFileURL } from 'node:url';

export const CARPETA = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const RAIZ = path.resolve(CARPETA, '../..'); // la raíz del repositorio (la web)
export const SALIDA = path.join(CARPETA, 'salida');
export const TRABAJO = path.join(CARPETA, 'trabajo'); // archivos intermedios (también la carpeta pública de Remotion)
const python = (entorno) => path.join(CARPETA, entorno, process.platform === 'win32' ? 'Scripts/python.exe' : 'bin/python');
export const PYTHON = python('.venv');
// La voz natural (Chatterbox, locutar_natural.py) va en otro entorno: necesita otra versión de torch
export const PYTHON_VOZ = python('.venv-voz');

export const crear = (carpeta) => (fs.mkdirSync(carpeta, { recursive: true }), carpeta);
export const log = (...partes) => console.log('·', ...partes);

// FFmpeg: el del PATH o, si winget aún no ha refrescado el PATH de esta terminal, el de su carpeta
let rutasFfmpeg = null;
export function ffmpeg() {
  if (rutasFfmpeg) return rutasFfmpeg;
  let carpeta = null;
  try {
    const encontrado = execSync(process.platform === 'win32' ? 'where ffmpeg' : 'which ffmpeg', { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    carpeta = path.dirname(encontrado.split(/\r?\n/)[0].trim());
  } catch {
    const base = path.join(process.env.LOCALAPPDATA || '', 'Microsoft/WinGet/Packages');
    const paquete = fs.existsSync(base) && fs.readdirSync(base).find((n) => n.startsWith('Gyan.FFmpeg'));
    if (paquete) {
      const dentro = fs.readdirSync(path.join(base, paquete)).find((n) => n.startsWith('ffmpeg-'));
      if (dentro) carpeta = path.join(base, paquete, dentro, 'bin');
    }
  }
  if (!carpeta) throw new Error('Falta FFmpeg. Instálalo con: winget install Gyan.FFmpeg');
  const exe = process.platform === 'win32' ? '.exe' : '';
  rutasFfmpeg = { ffmpeg: path.join(carpeta, 'ffmpeg' + exe), ffprobe: path.join(carpeta, 'ffprobe' + exe) };
  return rutasFfmpeg;
}

// Ejecuta un programa y devuelve { codigo, salida, errores }. Con falloSiError lanza si no acaba bien.
export function ejecutar(programa, argumentos, { falloSiError = true, entrada = null } = {}) {
  return new Promise((resolver, rechazar) => {
    const proceso = spawn(programa, argumentos, { windowsHide: true });
    let salida = '';
    let errores = '';
    proceso.stdout.on('data', (d) => (salida += d));
    proceso.stderr.on('data', (d) => (errores += d));
    if (entrada) proceso.stdin.end(entrada);
    proceso.on('error', rechazar);
    proceso.on('close', (codigo) => {
      if (codigo !== 0 && falloSiError) {
        rechazar(new Error(`${path.basename(programa)} terminó con código ${codigo}:\n${errores.split('\n').slice(-12).join('\n')}`));
      } else resolver({ codigo, salida, errores });
    });
  });
}

export const ff = (args, opciones) => ejecutar(ffmpeg().ffmpeg, ['-hide_banner', '-y', ...args], opciones);

export async function duracion(archivo) {
  const { salida } = await ejecutar(ffmpeg().ffprobe, ['-v', 'error', '-show_entries', 'format=duration', '-of', 'csv=p=0', archivo]);
  return parseFloat(salida);
}

// ─── Datos de la web ────────────────────────────────────────────────────
// La lista de juegos, como la leen servidor/fichas.js y herramientas/portadas-compartir.mjs
export function juegosDelCatalogo() {
  const catalogo = fs.readFileSync(path.join(RAIZ, 'juegos/catalogo.js'), 'utf8');
  return [...catalogo.matchAll(/\{\s*id:\s*'([a-z0-9_-]+)'([^}]*)\}/g)].map(([, id, resto]) => ({
    id,
    genero: resto.match(/genero:\s*'([^']+)'/)?.[1] || '',
    pruebas: /pruebas:\s*true/.test(resto),
    miniatura: resto.match(/miniatura:\s*'([^']+)'/)?.[1] || `juegos/${id}/miniatura.svg`,
  }));
}

const textos = {};
export async function textosDe(idioma) {
  textos[idioma] ??= (await import(pathToFileURL(path.join(RAIZ, `idiomas/${idioma}.js`)).href)).default;
  return textos[idioma];
}

// Los textos de un juego en un idioma: titulo, descripcion, controles…, etiquetas y el género traducido
export async function textosJuego(id, idioma) {
  const todo = await textosDe(idioma);
  const juego = todo.juegos?.[id];
  if (!juego) throw new Error(`No hay textos de juegos.${id} en idiomas/${idioma}.js`);
  const genero = juegosDelCatalogo().find((j) => j.id === id)?.genero;
  return { ...juego, genero: todo.generos?.[genero] || genero };
}

export async function marcador(id) {
  const { MARCADORES } = await import(pathToFileURL(path.join(RAIZ, 'juegos/marcadores.js')).href);
  return MARCADORES[id] || null;
}
