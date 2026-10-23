// Renderiza las composiciones de remotion/ con la API de Node de Remotion: empaqueta una vez por
// ejecución y sirve trabajo/ en local para que los vídeos no se copien al paquete.
import fs from 'node:fs';
import path from 'node:path';
import { CARPETA, RAIZ, TRABAJO, crear } from './comun.mjs';
import { servirCarpeta } from './servidor.mjs';

let preparado = null;

// trabajo/marca/: fuente y logo de la web
function copiarMarca() {
  const marca = crear(path.join(TRABAJO, 'marca'));
  fs.copyFileSync(path.join(RAIZ, 'estilos/fuentes/Geist-Variable.woff2'), path.join(marca, 'Geist-Variable.woff2'));
  fs.copyFileSync(path.join(RAIZ, 'favicon.svg'), path.join(marca, 'favicon.svg'));
}

// El Chrome instalado, si lo hay (si no, Remotion descarga su Chrome Headless Shell la primera vez)
function chromeInstalado() {
  const rutas = [
    path.join(process.env.PROGRAMFILES || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env['PROGRAMFILES(X86)'] || '', 'Google/Chrome/Application/chrome.exe'),
    path.join(process.env.LOCALAPPDATA || '', 'Google/Chrome/Application/chrome.exe'),
  ];
  return rutas.find((r) => fs.existsSync(r)) || null;
}

// Con el Chrome instalado, en su modo sin ventana nuevo; sin él, el Chrome Headless Shell de Remotion
const navegador = () => (chromeInstalado() ? { browserExecutable: chromeInstalado(), chromeMode: 'chrome-for-testing' } : {});

// trabajo/efectos/ y trabajo/medios/: sonidos y vídeos de archivo de los ganchos (solo lo que falte)
function copiarMedios() {
  for (const carpeta of ['efectos', 'medios']) {
    const origen = path.join(CARPETA, carpeta);
    if (!fs.existsSync(origen)) continue;
    fs.cpSync(origen, path.join(TRABAJO, carpeta), {
      recursive: true,
      filter: (o) => !o.endsWith('.md'),
      force: false,
    });
  }
}

async function preparar() {
  copiarMarca();
  copiarMedios();
  const { bundle } = await import('@remotion/bundler');
  const vacia = crear(path.join(TRABAJO, '.publico-vacio'));
  const [serveUrl, archivos] = await Promise.all([
    bundle({ entryPoint: path.join(CARPETA, 'remotion/index.jsx'), publicDir: vacia }),
    servirCarpeta(TRABAJO),
  ]);
  return { serveUrl, archivos };
}

export async function renderizar(composicion, props, salida) {
  preparado ??= preparar();
  const { serveUrl, archivos } = await preparado;
  const { selectComposition, renderMedia } = await import('@remotion/renderer');
  const inputProps = { ...props, base: archivos.url };
  const comun = { serveUrl, inputProps, ...navegador(), logLevel: 'error' };
  const composition = await selectComposition({ ...comun, id: composicion });
  let ultimo = -1;
  await renderMedia({
    ...comun, composition, codec: 'h264', crf: 17, audioBitrate: '192k', outputLocation: salida,
    onProgress: ({ progress }) => {
      const p = Math.floor(progress * 4);
      if (p > ultimo) { ultimo = p; process.stdout.write(p < 4 ? `  render ${p * 25}%\r` : '                \r'); }
    },
  });
  return salida;
}

export async function cerrarRender() {
  if (!preparado) return;
  (await preparado).archivos.cerrar();
  preparado = null;
}
