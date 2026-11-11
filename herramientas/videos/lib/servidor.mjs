// Servidor estático local de la web para grabar partidas. Sirve el repositorio tal cual, salvo
// shell/shell.js, al que añade (solo aquí, la web publicada no cambia) unos enganches para la
// grabación: window.__fabrica con la escena, la cámara y un registro de impactos y puntuaciones.
// /api/* responde vacío: las grabaciones no cuentan partidas ni van a ninguna clasificación.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { RAIZ } from './comun.mjs';

const require = createRequire(import.meta.url);
// three.js: el de node_modules (la misma versión que el importmap de la web) en vez del de jsDelivr,
// para grabar sin depender de la CDN (en la nube puede estar bloqueada) y sin esperas de red
const CDN_THREE = 'https://cdn.jsdelivr.net/npm/three@0.160.0/build/three.module.js';
const THREE_LOCAL = '/__fabrica/three.module.js';

const TIPOS = {
  '.html': 'text/html; charset=utf-8', '.js': 'text/javascript; charset=utf-8', '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8', '.svg': 'image/svg+xml', '.png': 'image/png', '.jpg': 'image/jpeg',
  '.json': 'application/json', '.woff2': 'font/woff2', '.webmanifest': 'application/manifest+json',
  '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav', '.glb': 'model/gltf-binary',
};

// [buscar, sustituir]: si alguno no se encuentra, la shell ha cambiado y hay que actualizarlo aquí
const ENGANCHES = [
  [
    'window.vrPlay = {',
    `window.__fabrica = { THREE, escena, camara, renderer, manos, eventos: [], reiniciar: () => cambiarA(indiceActual) };
{
  const impactoOriginal = efectos.api.impacto;
  efectos.api.impacto = (nivel, opciones) => {
    window.__fabrica.eventos.push({ tipo: 'impacto', nivel, t: performance.now() });
    return impactoOriginal(nivel, opciones);
  };
}
window.vrPlay = {`,
  ],
  [
    'puntuacion(valor) {\n      if (!Number.isFinite(valor)) return;',
    `puntuacion(valor) {
      if (!Number.isFinite(valor)) return;
      window.__fabrica?.eventos.push({ tipo: 'puntuacion', valor, texto: formatearValor(idJuego, valor), t: performance.now() });`,
  ],
];

// En los vídeos no salen las instrucciones de 5 s del principio ni las flechas que señalan los botones
// de los hombros: tapan el juego y el vídeo ya pone sus propios títulos
ENGANCHES.push(['introRestante = SEGUNDOS_INTRO;', 'introRestante = 0;']);
const ENGANCHES_BOTONES = [['const TIEMPO_AYUDA = 6;', 'const TIEMPO_AYUDA = 0;']];

function conEnganches(archivo, enganches) {
  let codigo = fs.readFileSync(path.join(RAIZ, archivo), 'utf8').replace(/\r\n/g, '\n');
  for (const [buscar, poner] of enganches) {
    if (!codigo.includes(buscar)) throw new Error(`${archivo} ha cambiado: no encuentro «${buscar.split('\n')[0]}» (actualiza los enganches en lib/servidor.mjs)`);
    codigo = codigo.replace(buscar, poner);
  }
  return codigo;
}

export function arrancarServidor() {
  const enganchados = {
    '/shell/shell.js': conEnganches('shell/shell.js', ENGANCHES),
    '/shell/boton-cambio.js': conEnganches('shell/boton-cambio.js', ENGANCHES_BOTONES),
  };
  const servidor = http.createServer((pet, res) => {
    const ruta = decodeURIComponent(new URL(pet.url, 'http://x').pathname);
    if (ruta.startsWith('/api/')) {
      res.writeHead(200, { 'content-type': 'application/json' });
      return res.end(ruta.includes('en-pruebas') ? '{"juegos":[]}' : '{}');
    }
    if (ruta === THREE_LOCAL) {
      res.writeHead(200, { 'content-type': TIPOS['.js'] });
      return fs.createReadStream(path.join(path.dirname(require.resolve('three')), 'three.module.js')).pipe(res);
    }
    if (ruta.endsWith('.html') && fs.existsSync(path.join(RAIZ, ruta))) {
      res.writeHead(200, { 'content-type': TIPOS['.html'] });
      return res.end(fs.readFileSync(path.join(RAIZ, ruta), 'utf8').replaceAll(CDN_THREE, THREE_LOCAL));
    }
    if (enganchados[ruta]) {
      res.writeHead(200, { 'content-type': TIPOS['.js'] });
      return res.end(enganchados[ruta]);
    }
    const archivo = path.join(RAIZ, ruta === '/' ? 'index.html' : ruta);
    if (!archivo.startsWith(RAIZ) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
      res.writeHead(404);
      return res.end();
    }
    res.writeHead(200, { 'content-type': TIPOS[path.extname(archivo)] || 'application/octet-stream' });
    fs.createReadStream(archivo).pipe(res);
  });
  return new Promise((resolver) => {
    servidor.listen(0, '127.0.0.1', () => {
      resolver({ url: `http://127.0.0.1:${servidor.address().port}`, cerrar: () => servidor.close() });
    });
  });
}

// Una carpeta tal cual (trabajo/, para que Remotion lea las grabaciones sin copiarlas), con rangos
export function servirCarpeta(carpeta) {
  const servidor = http.createServer((pet, res) => {
    const archivo = path.join(carpeta, decodeURIComponent(new URL(pet.url, 'http://x').pathname));
    if (!archivo.startsWith(carpeta) || !fs.existsSync(archivo) || fs.statSync(archivo).isDirectory()) {
      res.writeHead(404);
      return res.end();
    }
    const tamano = fs.statSync(archivo).size;
    const cabeceras = { 'content-type': TIPOS[path.extname(archivo)] || (archivo.endsWith('.mp4') ? 'video/mp4' : 'application/octet-stream'), 'accept-ranges': 'bytes', 'access-control-allow-origin': '*' };
    const rango = /bytes=(\d*)-(\d*)/.exec(pet.headers.range || '');
    if (rango) {
      const inicio = rango[1] ? +rango[1] : 0;
      const fin = rango[2] ? +rango[2] : tamano - 1;
      res.writeHead(206, { ...cabeceras, 'content-range': `bytes ${inicio}-${fin}/${tamano}`, 'content-length': fin - inicio + 1 });
      return fs.createReadStream(archivo, { start: inicio, end: fin }).pipe(res);
    }
    res.writeHead(200, { ...cabeceras, 'content-length': tamano });
    fs.createReadStream(archivo).pipe(res);
  });
  return new Promise((resolver) => {
    servidor.listen(0, '127.0.0.1', () => resolver({ url: `http://127.0.0.1:${servidor.address().port}`, cerrar: () => servidor.close() }));
  });
}
