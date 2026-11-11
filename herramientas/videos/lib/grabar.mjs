// Graba una partida real de un juego, jugada por un bot. Dos modos:
//   vr     (por defecto) unas Quest 3 simuladas con IWER (node_modules/iwer): la shell entra en VR
//          de verdad y lib/bot-vr.js mueve la cabeza y los mandos. Se graban a la vez dos planos de
//          la misma partida: las gafas (partida.mp4) y un espectador con avatar (espectador.mp4,
//          lib/espectador.js).
//   raton  como en la web con ratón, jugada por lib/bot.js (para los juegos sin modo VR del bot).
// El vídeo sale del propio lienzo (canvas.captureStream + MediaRecorder, mucho más nítido que la
// grabación de Playwright) y el sonido, de una copia de lo que el juego manda a los altavoces.
// Deja en la carpeta de trabajo: partida.mp4 (1080×1920, 30 fps), espectador.mp4 (solo en VR) y grabacion.json (impactos,
// puntuación, clics y rastro del puntero, con los tiempos desde el inicio de la grabación).
import fs from 'node:fs';
import path from 'node:path';
import { createRequire } from 'node:module';
import { spawn } from 'node:child_process';
import { CARPETA, ff, ffmpeg, log, chromiumDelSistema, relojPorDefecto } from './comun.mjs';
import { pistaDeGolpes } from './golpes-sinteticos.mjs';

const require = createRequire(import.meta.url);
export const ANCHO = 1080;
export const ALTO = 1920;

// Antes de que cargue la página: cada AudioContext manda también su salida a una pista grabable
const ENGANCHE_AUDIO = `(() => {
  const Original = window.AudioContext || window.webkitAudioContext;
  if (!Original) return;
  window.AudioContext = class extends Original {
    constructor(...a) {
      super(...a);
      this.__copia = this.createMediaStreamDestination();
      window.__audioGrabable = this.__copia;
    }
  };
  const conectar = AudioNode.prototype.connect;
  AudioNode.prototype.connect = function (destino, ...resto) {
    const r = conectar.call(this, destino, ...resto);
    if (destino instanceof AudioDestinationNode && this.context.__copia) conectar.call(this, this.context.__copia);
    return r;
  };
})();`;

// Unas gafas simuladas antes de que cargue la shell. Chrome ya trae navigator.xr (sin gafas), de
// ahí forceInstall. Una sola imagen en vez de una por ojo.
const GAFAS = `(() => {
  const gafas = new IWER.XRDevice(IWER.metaQuest3);
  gafas.stereoEnabled = false;
  gafas.installRuntime({ forceInstall: true });
  window.__xr = gafas;
})();`;

// El Chrome o Edge instalado (modo sin ventana nuevo, con GPU); si no hay, el Chromium de Playwright.
// En Linux sin GPU (la nube, GitHub Actions) se dibuja con SwiftShader, por CPU: ahí conviene
// --reloj virtual (ver grabarPartida).
export async function abrirNavegador(chromium) {
  const windows = process.platform === 'win32';
  const opciones = {
    ignoreDefaultArgs: ['--mute-audio'],
    args: [...(windows ? ['--use-angle=d3d11', '--enable-gpu'] : ['--use-angle=swiftshader', '--enable-unsafe-swiftshader']),
      '--ignore-gpu-blocklist', '--autoplay-policy=no-user-gesture-required', '--disable-background-timer-throttling', '--disable-renderer-backgrounding'],
  };
  let error;
  for (const channel of ['chrome', 'msedge', 'chromium']) {
    try {
      return await chromium.launch({ ...opciones, channel });
    } catch (e) {
      error = e;
    }
  }
  const otro = chromiumDelSistema();
  if (otro) return chromium.launch({ ...opciones, executablePath: otro });
  throw new Error('No se pudo abrir ningún navegador (Chrome, Edge o el Chromium de Playwright): ' + error.message.split('\n')[0]);
}
export async function grabarPartida({ urlBase, id, idioma, estrategia, carpeta, modo = 'vr', reloj = relojPorDefecto() }) {
  const { chromium } = require('playwright');
  if (modo === 'vr' && !estrategia.vr) {
    log(`${id}: el bot aún no sabe jugarlo en VR; se graba con ratón`);
    modo = 'raton';
  }
  const webm = path.join(carpeta, 'partida.webm');
  const webmEsp = path.join(carpeta, 'espectador.webm');
  for (const f of [webm, webmEsp, path.join(carpeta, 'espectador.mp4')]) fs.rmSync(f, { force: true });
  const navegador = await abrirNavegador(chromium);
  try {
    // VRPLAY_ESCALA=0.5 graba a media resolución (para probar un bot deprisa: probar-bot)
    const escala = +(process.env.VRPLAY_ESCALA || 1);
    const contexto = await navegador.newContext({ viewport: { width: Math.round(ANCHO * escala), height: Math.round(ALTO * escala) }, deviceScaleFactor: 1, locale: idioma });
    const pagina = await contexto.newPage();
    const errores = [];
    pagina.on('pageerror', (e) => errores.push(String(e.message || e)));
    let escritura = Promise.resolve();
    await pagina.exposeFunction('__guardarTrozo', (b64) => {
      escritura = escritura.then(() => fs.promises.appendFile(webm, Buffer.from(b64, 'base64')));
      return escritura;
    });
    await pagina.exposeFunction('__guardarTrozoEsp', (b64) => {
      escritura = escritura.then(() => fs.promises.appendFile(webmEsp, Buffer.from(b64, 'base64')));
      return escritura;
    });
    // El reloj virtual va el primero, para que IWER, la shell y los bots usen sus funciones de tiempo
    if (reloj === 'virtual') await pagina.addInitScript({ path: path.join(CARPETA, 'lib/reloj-virtual.js') });
    await pagina.addInitScript(ENGANCHE_AUDIO);
    const jugada = path.join(CARPETA, 'lib/jugadas', id + '.js');
    if (fs.existsSync(jugada)) await pagina.addInitScript({ path: jugada });
    if (modo === 'vr') {
      await pagina.addInitScript({ path: require.resolve('iwer/build/iwer.min.js') });
      await pagina.addInitScript(GAFAS);
      await pagina.addInitScript({ path: path.join(CARPETA, 'lib/bot-vr.js') });
      await pagina.addInitScript({ path: path.join(CARPETA, 'lib/espectador.js') });
    } else {
      await pagina.addInitScript({ path: path.join(CARPETA, 'lib/bot.js') });
    }
    const listo = (juego) => window.__fabrica && window.vrPlay?.juego === juego && !window.vrPlay.cambiando &&
      window.__fabrica.escena.children.some((c) => c.name === 'juego-' + juego);
    await pagina.goto(`${urlBase}/play.html?lang=${idioma}#${id}`);
    await pagina.waitForFunction(listo, id, { timeout: 60000 });
    await pagina.evaluate(() => document.fonts.ready);
    await pagina.waitForTimeout(1200); // que acabe el fundido de entrada

    if (modo === 'vr') {
      // El clic en «Entrar en VR» también activa el sonido. Después se vuelve a empezar la partida
      // (el reloj del juego ya corría) y así se quita el aviso de seguridad: no sale en el vídeo.
      await pagina.waitForFunction(() => !document.getElementById('btn-vr').disabled, null, { timeout: 15000 });
      await pagina.click('#btn-vr');
      await pagina.waitForFunction(() => window.__fabrica.renderer.xr.isPresenting, null, { timeout: 15000 });
      await pagina.waitForTimeout(600);
      await pagina.evaluate(() => window.__fabrica.reiniciar());
      await pagina.waitForFunction(listo, id, { timeout: 60000 });
      await pagina.waitForTimeout(900);
    } else {
      // Un toque para que la shell active el sonido (crea su AudioContext al primer pointerdown)
      await pagina.mouse.move(ANCHO / 2, ALTO * 0.97);
      await pagina.mouse.down();
      await pagina.mouse.up();
      await pagina.waitForTimeout(300);
    }

    if (reloj === 'virtual') return await grabarVirtual({ pagina, id, idioma, estrategia, modo, carpeta, errores });

    const datos = await pagina.evaluate(async ({ estrategia, modo }) => {
      const aBase64 = (b) => {
        let bin = '';
        const bytes = new Uint8Array(b);
        for (let i = 0; i < bytes.length; i += 0x8000) bin += String.fromCharCode.apply(null, bytes.subarray(i, i + 0x8000));
        return btoa(bin);
      };
      const grabadorDe = (pistas, opciones) => {
        const g = new MediaRecorder(new MediaStream(pistas), opciones);
        g.envios = [];
        g.ondataavailable = (e) => { if (e.data.size) g.envios.push(e.data.arrayBuffer().then(aBase64)); };
        return g;
      };
      const lienzo = window.__fabrica.renderer.domElement;
      const pistas = [...lienzo.captureStream(60).getVideoTracks()];
      if (window.__audioGrabable) pistas.push(...window.__audioGrabable.stream.getAudioTracks());
      const grabador = grabadorDe(pistas, { mimeType: 'video/webm;codecs=vp9,opus', videoBitsPerSecond: 24e6, audioBitsPerSecond: 192e3 });
      let grabadorEsp = null;
      if (modo === 'vr') {
        window.__iniciarEspectador(estrategia.vr.espectador);
        grabadorEsp = grabadorDe(window.__espectador.lienzo.captureStream(60).getVideoTracks(), { mimeType: 'video/webm;codecs=vp9', videoBitsPerSecond: 20e6 });
      }
      // Medir los fotogramas por segundo reales del juego
      let fotogramas = 0;
      let midiendo = true;
      const contar = () => { fotogramas++; if (midiendo) requestAnimationFrame(contar); };
      requestAnimationFrame(contar);

      const inicio = performance.now();
      const eventosAntes = window.__fabrica.eventos.length;
      grabador.start(1000);
      grabadorEsp?.start(1000);
      if (modo === 'vr') window.__iniciarBotVR(estrategia.vr);
      else window.__iniciarBot(estrategia);
      const fin = estrategia.segundos * 1000;
      await new Promise((listo) => {
        const mirar = () => {
          const ahora = performance.now() - inicio;
          const punt = window.__fabrica.eventos.slice(eventosAntes).find((e) => e.tipo === 'puntuacion');
          // Al terminar la partida, unos segundos más para ver el resultado
          if (ahora >= fin || (punt && ahora > punt.t - inicio + (estrategia.trasFin ?? 3.5) * 1000)) return listo();
          setTimeout(mirar, 200);
        };
        mirar();
      });
      midiendo = false;
      const parar = (g) => new Promise((r) => { g.onstop = r; g.stop(); });
      await Promise.all([grabador, grabadorEsp].filter(Boolean).map(parar));
      // Enviar en orden, uno a uno
      for (const envio of grabador.envios) await window.__guardarTrozo(await envio);
      for (const envio of grabadorEsp?.envios || []) await window.__guardarTrozoEsp(await envio);
      const duracion = (performance.now() - inicio) / 1000;
      const gl = lienzo.getContext('webgl2') || lienzo.getContext('webgl');
      const ext = gl?.getExtension('WEBGL_debug_renderer_info');
      return {
        modo,
        duracion,
        fpsEspectador: grabadorEsp ? Math.round(window.__espectador.fotogramas / duracion) : null,
        fps: Math.round(fotogramas / duracion),
        gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '?',
        audio: !!window.__audioGrabable,
        eventos: window.__fabrica.eventos.slice(eventosAntes).map((e) => ({ ...e, t: +((e.t - inicio) / 1000).toFixed(3) })),
        rastro: (window.__bot.rastro || []).map(([t, x, y, p]) => [+(t / 1000).toFixed(3), x, y, p]),
        clics: window.__bot.clics,
        maxObjetivos: window.__bot.objetivos,
      };
    }, { estrategia, modo });
    await escritura;
    datos.errores = errores.slice(0, 5);
    // El WebM de MediaRecorder no tiene fotogramas fijos: se pasa a MP4 a 30 fps constantes
    await ff(['-i', webm, '-r', '30', '-c:v', 'libx264', '-preset', 'fast', '-crf', '14', '-pix_fmt', 'yuv420p',
      '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-movflags', '+faststart', path.join(carpeta, 'partida.mp4')]);
    fs.rmSync(webm, { force: true });
    if (fs.existsSync(webmEsp)) {
      await ff(['-i', webmEsp, '-r', '30', '-c:v', 'libx264', '-preset', 'fast', '-crf', '16', '-pix_fmt', 'yuv420p', '-an',
        '-movflags', '+faststart', path.join(carpeta, 'espectador.mp4')]);
      fs.rmSync(webmEsp, { force: true });
    }
    fs.writeFileSync(path.join(carpeta, 'grabacion.json'), JSON.stringify(datos));
    if (/swiftshader/i.test(datos.gpu)) log(`aviso: sin GPU (${datos.fps} fps). Para que salga fluido, graba con --reloj virtual`);
    log(`grabado ${id} (${idioma}, ${modo === 'vr' ? `VR, espectador a ${datos.fpsEspectador} fps` : 'ratón'}):${datos.duracion.toFixed(0)} s, ${datos.fps} fps, ${datos.eventos.filter((e) => e.tipo === 'impacto').length} impactos, ${datos.clics} clics, GPU ${datos.gpu.replace(/ANGLE \(|\)|Direct3D11.*$/g, '').trim()}`);
    return datos;
  } finally {
    await navegador.close();
  }
}

// ─── Grabación fotograma a fotograma (reloj virtual) ─────────────────────
// El tiempo de la página solo avanza 1/30 s por fotograma (lib/reloj-virtual.js) y cada fotograma se
// saca del lienzo y va a FFmpeg. Tarda más que la partida (sin GPU, ~0,3-1 s por fotograma), pero
// sale a 30 fps perfectos en cualquier máquina. El sonido del juego no se puede grabar así: se
// sustituye por golpes sintetizados en los impactos (lib/golpes-sinteticos.mjs).
const FPS = 30;
const SEGUNDOS_VIRTUAL = 40;

function codificador(salida, crf) {
  const proceso = spawn(ffmpeg().ffmpeg, ['-hide_banner', '-loglevel', 'error', '-y', '-f', 'image2pipe', '-framerate', String(FPS), '-c:v', 'mjpeg', '-i', '-',
    '-vf', `scale=${ANCHO}:${ALTO}:flags=lanczos,setsar=1`, '-c:v', 'libx264', '-preset', 'fast', '-crf', String(crf), '-pix_fmt', 'yuv420p', '-r', String(FPS), salida],
  { stdio: ['pipe', 'ignore', 'pipe'], windowsHide: true });
  let errores = '';
  proceso.stderr.on('data', (d) => (errores += d));
  const fin = new Promise((resolver, rechazar) => proceso.on('close', (c) => (c === 0 ? resolver() : rechazar(new Error('FFmpeg: ' + errores.slice(-400))))));
  return {
    async escribir(b64) {
      if (!proceso.stdin.write(Buffer.from(b64, 'base64'))) await new Promise((r) => proceso.stdin.once('drain', r));
    },
    cerrar() { proceso.stdin.end(); return fin; },
  };
}

async function grabarVirtual({ pagina, id, idioma, estrategia, modo, carpeta, errores }) {
  const mudo = path.join(carpeta, 'partida-mudo.mp4');
  const juego = codificador(mudo, 14);
  const esp = modo === 'vr' ? codificador(path.join(carpeta, 'espectador.mp4'), 16) : null;
  const inicio = Date.now();
  await pagina.evaluate(({ estrategia, modo, escala }) => {
    window.__reloj.activar();
    window.__grab = { inicio: performance.now(), eventosAntes: window.__fabrica.eventos.length };
    // El espectador, a 720×1280 (FFmpeg lo escala): es el plano secundario y así va más rápido
    if (modo === 'vr') window.__iniciarEspectador({ ...estrategia.vr.espectador, ancho: Math.round(720 * escala), alto: Math.round(1280 * escala) });
    if (modo === 'vr') window.__iniciarBotVR(estrategia.vr);
    else window.__iniciarBot(estrategia);
  }, { estrategia, modo, escala: +(process.env.VRPLAY_ESCALA || 1) });
  // Sin GPU cada segundo de partida cuesta ~20-25 s: se graban como mucho SEGUNDOS_VIRTUAL (el vídeo
  // usa 15-45 s de los mejores momentos)
  const fin = Math.min(estrategia.segundos, +(process.env.VRPLAY_SEGUNDOS || SEGUNDOS_VIRTUAL)) * 1000;
  const trasFin = (estrategia.trasFin ?? 3.5) * 1000;
  let cuadros = 0;
  const inicioBucle = Date.now();
  for (;;) {
    const f = await pagina.evaluate((dt) => {
      window.__reloj.paso(dt);
      const g = window.__grab;
      const punt = window.__fabrica.eventos.slice(g.eventosAntes).find((e) => e.tipo === 'puntuacion');
      const sacar = (lienzo, calidad) => lienzo.toDataURL('image/jpeg', calidad).slice(23);
      return {
        juego: sacar(window.__fabrica.renderer.domElement, 0.94),
        esp: window.__espectador ? sacar(window.__espectador.lienzo, 0.92) : null,
        ahora: performance.now() - g.inicio,
        punt: punt ? punt.t - g.inicio : null,
      };
    }, 1 / FPS);
    await juego.escribir(f.juego);
    if (esp && f.esp) await esp.escribir(f.esp);
    cuadros++;
    if (cuadros % (FPS * 5) === 0) process.stdout.write(`  grabando ${id}: ${(f.ahora / 1000).toFixed(0)} s de partida\r`);
    if (f.ahora >= fin || (f.punt !== null && f.ahora > f.punt + trasFin)) break;
  }
  await Promise.all([juego.cerrar(), esp?.cerrar()]);
  const datos = await pagina.evaluate(() => {
    const g = window.__grab;
    const lienzo = window.__fabrica.renderer.domElement;
    const gl = lienzo.getContext('webgl2') || lienzo.getContext('webgl');
    const ext = gl?.getExtension('WEBGL_debug_renderer_info');
    return {
      eventos: window.__fabrica.eventos.slice(g.eventosAntes).map((e) => ({ ...e, t: +((e.t - g.inicio) / 1000).toFixed(3) })),
      rastro: (window.__bot.rastro || []).map(([t, x, y, p]) => [+(t / 1000).toFixed(3), x, y, p]),
      clics: window.__bot.clics,
      maxObjetivos: window.__bot.objetivos,
      gpu: ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '?',
    };
  });
  const duracion = cuadros / FPS;
  Object.assign(datos, { modo, reloj: 'virtual', duracion, fps: FPS, fpsEspectador: esp ? FPS : null, audio: false, errores: errores.slice(0, 5) });
  // El sonido: golpes sintetizados en cada impacto, para que el montaje tenga dónde apoyarse
  const wav = path.join(carpeta, 'golpes.wav');
  fs.writeFileSync(wav, pistaDeGolpes(datos.eventos, duracion));
  await ff(['-i', mudo, '-i', wav, '-c:v', 'copy', '-c:a', 'aac', '-b:a', '192k', '-ar', '48000', '-shortest', '-movflags', '+faststart', path.join(carpeta, 'partida.mp4')]);
  fs.rmSync(mudo, { force: true });
  fs.rmSync(wav, { force: true });
  fs.writeFileSync(path.join(carpeta, 'grabacion.json'), JSON.stringify(datos));
  const minutos = ((Date.now() - inicio) / 60000).toFixed(1);
  datos.segundosPorFotograma = +((Date.now() - inicioBucle) / 1000 / cuadros).toFixed(2);
  log(`grabado ${id} (${idioma}, ${modo === 'vr' ? 'VR con espectador' : 'ratón'}, reloj virtual): ${duracion.toFixed(0)} s en ${minutos} min (${datos.segundosPorFotograma} s por fotograma), ${datos.eventos.filter((e) => e.tipo === 'impacto').length} impactos, ${datos.clics} clics`);
  return datos;
}
