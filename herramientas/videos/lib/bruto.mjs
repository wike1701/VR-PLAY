// Vídeos a partir de una partida en bruto grabada en las gafas (varios juegos seguidos, en horizontal):
//   1. la pasa a 30 fps constantes (las grabaciones de las Quest van a frecuencia variable),
//   2. la trocea por los fundidos a negro y los cambios de escena, y deja segmentos.json y una hoja
//      (segmentos.jpg, una fila por tramo) para poner a cada tramo el id del juego (o null),
//   3. de cada tramo con juego hace partida.mp4 (vertical, recortada) y espectador.mp4 (la imagen
//      entera sobre una copia difuminada), y un grabacion.json con los golpes sacados del sonido,
//   4. y lo monta igual que un juego grabado por la fábrica (lib/montar.mjs).
import fs from 'node:fs';
import path from 'node:path';
import { spawn } from 'node:child_process';
import { SALIDA, TRABAJO, crear, duracion, ff, ffmpeg, juegosDelCatalogo, log } from './comun.mjs';

const FPS = 30;
const MINIMO = 12; // segundos: un tramo más corto no da para un vídeo

// Lo que sale de ffmpeg como datos (audio o imagen en crudo), en un Buffer
function crudo(args) {
  return new Promise((resolver, rechazar) => {
    const p = spawn(ffmpeg().ffmpeg, ['-hide_banner', '-v', 'error', ...args, '-'], { windowsHide: true });
    const trozos = [];
    let errores = '';
    p.stdout.on('data', (d) => trozos.push(d));
    p.stderr.on('data', (d) => (errores += d));
    p.on('error', rechazar);
    p.on('close', (c) => (c ? rechazar(new Error(errores.slice(-500))) : resolver(Buffer.concat(trozos))));
  });
}

async function normalizar(video, fuente) {
  if (fs.existsSync(fuente) && fs.statSync(fuente).mtimeMs > fs.statSync(video).mtimeMs) return;
  log('pasando la grabación a 30 fps constantes…');
  await ff(['-i', video, '-vf', `fps=${FPS},scale=1920:1080:flags=lanczos,setsar=1`, '-c:v', 'libx264', '-preset', 'fast', '-crf', '17',
    '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', fuente]);
}

// Los cortes: fundidos a negro (blackdetect) y cambios de escena fuertes (scdet)
async function detectarTramos(fuente) {
  const total = await duracion(fuente);
  const { errores } = await ff(['-i', fuente, '-an', '-vf', 'scale=320:-2,blackdetect=d=0.2:pix_th=0.08,scdet=threshold=22', '-f', 'null', '-']);
  const negros = [...errores.matchAll(/black_start:([\d.]+) black_end:([\d.]+)/g)].map((m) => [+m[1], +m[2]]);
  const escenas = [...errores.matchAll(/lavfi\.scd\.time:\s*([\d.]+)/g)].map((m) => +m[1]);
  // Cada negro es un hueco; cada cambio de escena, un corte de ancho cero
  const huecos = [...negros, ...escenas.map((t) => [t, t])].sort((a, b) => a[0] - b[0]);
  const tramos = [];
  let desde = 0;
  for (const [a, b] of huecos) {
    if (a - desde >= 2) tramos.push({ desde: +desde.toFixed(2), hasta: +a.toFixed(2) });
    desde = Math.max(desde, b);
  }
  if (total - desde >= 2) tramos.push({ desde: +desde.toFixed(2), hasta: +total.toFixed(2) });
  return tramos;
}

// Una fila por tramo con 4 fotogramas (200 px cada uno: 800 px de ancho), para clasificarlos de un vistazo
async function hoja(fuente, tramos, salida) {
  const filas = [];
  const dir = crear(path.join(path.dirname(salida), 'hoja'));
  for (const [i, t] of tramos.entries()) {
    const fila = path.join(dir, `fila-${String(i + 1).padStart(2, '0')}.jpg`);
    const momentos = [0.15, 0.4, 0.65, 0.9].map((p) => t.desde + (t.hasta - t.desde) * p);
    const entradas = momentos.flatMap((m) => ['-ss', m.toFixed(2), '-i', fuente]);
    const escalas = momentos.map((_, k) => `[${k}:v]scale=200:112,setsar=1[v${k}]`).join(';');
    await ff([...entradas, '-filter_complex', `${escalas};[v0][v1][v2][v3]hstack=4`, '-frames:v', '1', '-q:v', '4', fila]);
    filas.push(fila);
  }
  const entradas = filas.flatMap((f) => ['-i', f]);
  await ff([...entradas, '-filter_complex', `${filas.map((_, k) => `[${k}:v]`).join('')}vstack=${filas.length}`, '-frames:v', '1', '-q:v', '5', salida]);
  fs.rmSync(dir, { recursive: true, force: true });
}

// Los golpes, del sonido: subidas bruscas de volumen (ventanas de 25 ms) sobre lo que sonaba justo antes
export async function golpes(archivo) {
  const muestreo = 8000;
  const pcm = await crudo(['-i', archivo, '-vn', '-ac', '1', '-ar', String(muestreo), '-f', 's16le']);
  const ventana = muestreo / 40;
  const env = [];
  for (let i = 0; i + ventana * 2 <= pcm.length / 2; i += ventana) {
    let s = 0;
    for (let k = 0; k < ventana; k++) { const v = pcm.readInt16LE((i + k) * 2) / 32768; s += v * v; }
    env.push(Math.sqrt(s / ventana));
  }
  const ordenado = [...env].sort((a, b) => a - b);
  const suelo = Math.max(ordenado[Math.floor(ordenado.length * 0.3)] || 0, 0.004);
  const eventos = [];
  let ultimo = -1;
  for (let i = 4; i < env.length; i++) {
    const antes = env.slice(Math.max(0, i - 40), i - 1).reduce((a, b) => a + b, 0) / Math.min(39, i - 1);
    const razon = env[i] / Math.max(antes, suelo);
    const t = i / 40;
    if (razon > 2.2 && env[i] > suelo * 2.5 && t - ultimo > 0.25) {
      eventos.push({ t: +t.toFixed(3), tipo: 'impacto', nivel: razon > 5 ? 'grande' : razon > 3.2 ? 'medio' : 'pequeño' });
      ultimo = t;
    }
  }
  return eventos;
}

// De un tramo, los dos vídeos verticales (1080×1920) que usa AnuncioVR: partida (recorte) y espectador (entero)
async function prepararTramo(fuente, s, carpeta) {
  const largo = s.hasta - s.desde;
  const corte = ['-ss', s.desde.toFixed(3), '-t', largo.toFixed(3), '-i', fuente];
  const x = `(iw-ih*9/16)*${s.encuadre ?? 0.5}`;
  await ff([...corte, '-vf', `crop=ih*9/16:ih:${x}:0,scale=1080:1920:flags=lanczos,setsar=1,fps=${FPS}`,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '18', '-pix_fmt', 'yuv420p', '-c:a', 'aac', '-b:a', '192k', path.join(carpeta, 'partida.mp4')]);
  await ff([...corte, '-an', '-filter_complex',
    `[0:v]split[a][b];[a]scale=-2:1920,crop=1080:1920,gblur=sigma=40,eq=brightness=-0.12[fondo];[b]scale=1080:-2:flags=lanczos[frente];` +
    `[fondo][frente]overlay=0:(H-h)/2,setsar=1,fps=${FPS}`,
    '-c:v', 'libx264', '-preset', 'fast', '-crf', '20', '-pix_fmt', 'yuv420p', path.join(carpeta, 'espectador.mp4')]);
  const eventos = await golpes(path.join(carpeta, 'partida.mp4'));
  const datos = { modo: 'bruto', fps: FPS, duracion: +largo.toFixed(2), eventos, fuente: { desde: s.desde, hasta: s.hasta } };
  fs.writeFileSync(path.join(carpeta, 'grabacion.json'), JSON.stringify(datos));
  return datos;
}

export async function hacerBruto({ video, nombre = null, soloTrocear = false, juegos = null, idiomas = ['es'], gancho = 'impacto', sinVoz = false, motorVoz = 'natural', estilo = null }) {
  nombre ||= path.basename(video, path.extname(video)).replace(/[^\w-]+/g, '-').slice(0, 24);
  const trabajo = crear(path.join(TRABAJO, 'bruto', nombre));
  const destino = crear(path.join(SALIDA, 'bruto', nombre));
  const fuente = path.join(trabajo, 'fuente.mp4');
  await normalizar(video, fuente);

  const archivoSeg = path.join(destino, 'segmentos.json');
  let seg = fs.existsSync(archivoSeg) ? JSON.parse(fs.readFileSync(archivoSeg, 'utf8')) : null;
  if (!seg?.manual) {
    const tramos = await detectarTramos(fuente);
    seg = { manual: false, nota: 'Pon el id del juego (juegos/catalogo.js) en cada tramo, o null para saltarlo; ajusta desde/hasta y encuadre (0 izquierda, 0.5 centro, 1 derecha) y pon "manual": true',
      tramos: tramos.map((t, i) => ({ n: i + 1, id: null, ...t, encuadre: 0.5 })) };
    fs.writeFileSync(archivoSeg, JSON.stringify(seg, null, 1));
    await hoja(fuente, seg.tramos, path.join(destino, 'segmentos.jpg'));
    log(`${seg.tramos.length} tramos en ${path.relative(process.cwd(), archivoSeg)} (la hoja, una fila por tramo: segmentos.jpg)`);
  }
  const ids = new Set(juegosDelCatalogo().map((j) => j.id));
  for (const t of seg.tramos) if (t.id && !ids.has(t.id)) throw new Error(`tramo ${t.n}: no existe el juego «${t.id}»`);
  let elegidos = seg.tramos.filter((t) => t.id && t.hasta - t.desde >= MINIMO && (!juegos || juegos.includes(t.id)));
  if (soloTrocear || !elegidos.length) {
    if (!elegidos.length) log('ningún tramo tiene juego: rellena los id en segmentos.json, pon "manual": true y vuelve a lanzarlo');
    return seg;
  }

  const { hacerVideoJuego } = await import('./montar.mjs');
  const vistos = {};
  const informe = { video, nombre, videos: [] };
  for (const t of elegidos) {
    // Si un juego sale dos veces en la grabación, el segundo es <id>-2
    vistos[t.id] = (vistos[t.id] || 0) + 1;
    const clave = vistos[t.id] > 1 ? `${t.id}-${vistos[t.id]}` : t.id;
    try {
      const base = crear(path.join(trabajo, clave));
      const firma = JSON.stringify([t.desde, t.hasta, t.encuadre ?? 0.5]);
      const previa = path.join(base, 'tramo.json');
      if (!fs.existsSync(previa) || fs.readFileSync(previa, 'utf8') !== firma) {
        await prepararTramo(fuente, t, base);
        fs.writeFileSync(previa, firma);
      }
      for (const idioma of idiomas) {
        const carpeta = crear(path.join(base, idioma));
        for (const f of ['partida.mp4', 'espectador.mp4', 'grabacion.json']) fs.copyFileSync(path.join(base, f), path.join(carpeta, f));
      }
      const r = await hacerVideoJuego({ id: t.id, idiomas, sinGrabar: true, gancho, sinVoz, motorVoz, estilo,
        carpetaTrabajo: (idioma) => path.join(base, idioma), destino: crear(path.join(destino, clave)) });
      informe.videos.push({ clave, tramo: t, ...r });
    } catch (e) {
      console.error(`✗ ${clave}: ${e.message}`);
      informe.videos.push({ clave, tramo: t, error: e.message });
    }
  }
  informe.fecha = new Date().toISOString();
  // Si solo se rehacen unos juegos (--juegos), los demás del informe anterior se quedan
  const anterior = path.join(destino, 'informe.json');
  if (juegos && fs.existsSync(anterior)) {
    const hechos = new Set(informe.videos.map((v) => v.clave));
    informe.videos = [...JSON.parse(fs.readFileSync(anterior, 'utf8')).videos.filter((v) => !hechos.has(v.clave)), ...informe.videos];
  }
  fs.writeFileSync(anterior, JSON.stringify(informe, null, 2));
  return informe;
}
