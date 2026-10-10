// Efectos de sonido sintetizados con Web Audio: no hay archivos que descargar.
let ac = null;
let maestro = null;
let bufferRuido = null;

// El navegador solo deja arrancar el audio tras un gesto del usuario (clic, entrar en VR...).
export function activarAudio() {
  try {
    if (!ac) {
      const AC = window.AudioContext || window.webkitAudioContext;
      if (!AC) return;
      ac = new AC();
      maestro = ac.createGain();
      maestro.gain.value = 0.5;
      maestro.connect(ac.destination);
    }
    if (ac.state === 'suspended') ac.resume();
  } catch (e) {
    console.warn('Audio no disponible', e);
  }
}

function tono(f1, f2, duracion, tipo = 'sine', volumen = 0.3, retraso = 0) {
  const t0 = ac.currentTime + retraso;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = tipo;
  osc.frequency.setValueAtTime(f1, t0);
  osc.frequency.exponentialRampToValueAtTime(f2, t0 + duracion);
  g.gain.setValueAtTime(volumen, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duracion);
  osc.connect(g).connect(maestro);
  osc.start(t0);
  osc.stop(t0 + duracion + 0.02);
}

function obtenerRuido() {
  if (!bufferRuido) {
    bufferRuido = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const datos = bufferRuido.getChannelData(0);
    for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
  }
  return bufferRuido;
}

function ruido(duracion, frecuencia, volumen = 0.3, q = 1) {
  const t0 = ac.currentTime;
  const fuente = ac.createBufferSource();
  fuente.buffer = obtenerRuido();
  const filtro = ac.createBiquadFilter();
  filtro.type = 'bandpass';
  filtro.frequency.value = frecuencia;
  filtro.Q.value = q;
  const g = ac.createGain();
  g.gain.setValueAtTime(volumen, t0);
  g.gain.exponentialRampToValueAtTime(0.001, t0 + duracion);
  fuente.connect(filtro).connect(g).connect(maestro);
  fuente.start(t0);
  fuente.stop(t0 + duracion + 0.02);
}

const SONIDOS = {
  corte: () => { ruido(0.15, 3200, 0.5, 0.8); tono(900, 300, 0.12, 'triangle', 0.12); },
  bomba: () => { ruido(0.6, 180, 0.9, 0.5); tono(120, 40, 0.5, 'sawtooth', 0.3); },
  golpe: () => { tono(180, 60, 0.15, 'square', 0.3); ruido(0.08, 1500, 0.3); },
  punto: () => tono(880, 1320, 0.12, 'sine', 0.2),
  fallo: () => tono(320, 140, 0.3, 'sawtooth', 0.15),
  boton: () => { tono(660, 660, 0.08, 'sine', 0.3); tono(990, 990, 0.12, 'sine', 0.3, 0.08); },
  tic: () => tono(1200, 1200, 0.04, 'sine', 0.15),
  disparo: () => { ruido(0.14, 1100, 0.7, 0.6); tono(240, 60, 0.12, 'square', 0.22); },
  arco: () => { tono(160, 80, 0.18, 'triangle', 0.3); ruido(0.22, 2600, 0.25, 1.5); },
  cuac: () => { tono(520, 360, 0.11, 'sawtooth', 0.12); tono(500, 340, 0.13, 'sawtooth', 0.12, 0.14); },
  bote: () => tono(140, 70, 0.09, 'sine', 0.35),
  toc: () => { tono(1700, 1100, 0.045, 'sine', 0.4); ruido(0.03, 3000, 0.2, 1.2); },
  pong: () => tono(1050, 800, 0.05, 'sine', 0.28),
  clac: () => { tono(2600, 2200, 0.08, 'triangle', 0.25); tono(3900, 3500, 0.05, 'sine', 0.12); },
  grava: () => ruido(0.12, 600, 0.3, 0.8),
  derrape: () => ruido(0.22, 2900, 0.16, 5),
  red: () => ruido(0.3, 4200, 0.25, 0.7),
  patada: () => { tono(110, 45, 0.12, 'sine', 0.5); ruido(0.06, 900, 0.35); },
  bate: () => { tono(1500, 700, 0.07, 'triangle', 0.4); ruido(0.09, 2800, 0.7, 0.9); tono(220, 90, 0.1, 'sine', 0.35); },
  zas: () => ruido(0.18, 900, 0.25, 0.9),
  ovacion: () => { ruido(1.4, 1400, 0.35, 0.35); ruido(1.2, 700, 0.25, 0.5); },
  calambre: () => { tono(95, 80, 0.45, 'sawtooth', 0.35); tono(190, 160, 0.45, 'square', 0.12); ruido(0.35, 3500, 0.45, 0.6); },
  laser: () => { tono(1800, 420, 0.11, 'square', 0.07); tono(2400, 900, 0.08, 'sine', 0.06); },
  laserEnemigo: () => tono(520, 180, 0.16, 'sawtooth', 0.07),
  explosion: () => { ruido(0.5, 260, 0.7, 0.6); tono(140, 40, 0.4, 'sawtooth', 0.22); },
  impacto: () => { ruido(0.3, 700, 0.6, 0.7); tono(160, 60, 0.25, 'square', 0.25); },
  anillo: () => { tono(880, 1760, 0.14, 'sine', 0.18); tono(1320, 2640, 0.16, 'sine', 0.12, 0.07); },
  silbato: () => { tono(2100, 2150, 0.18, 'square', 0.08); tono(2100, 2150, 0.35, 'square', 0.08, 0.22); },
  fin: () => {
    tono(523, 523, 0.15, 'triangle', 0.3);
    tono(659, 659, 0.15, 'triangle', 0.3, 0.15);
    tono(784, 784, 0.3, 'triangle', 0.3, 0.3);
  },
};

export function sonido(nombre) {
  if (!ac || ac.state !== 'running') return;
  try {
    SONIDOS[nombre]?.();
  } catch (e) {
    /* un sonido que falla no debe parar el juego */
  }
}

// ─── Sonidos continuos ───────────────────────────────────────────────────
// Para sonidos que duran todo el juego (un motor...). Devuelve un control con
// ajustar(valor de 0 a 1, volumen) y parar(). Los nodos de audio se crean al
// primer ajuste con el audio ya activo (el navegador lo exige tras un gesto).
// La shell para todos los de un juego al cambiar de juego.
const CONTINUOS = {
  // Motor: dos osciladores desafinados y un subgrave, con un filtro que se abre
  // al acelerar y un temblor como el de los pistones.
  motor() {
    const salida = ac.createGain();
    salida.gain.value = 0;
    const filtro = ac.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.Q.value = 3;
    const temblor = ac.createGain();
    temblor.gain.value = 0.7;
    const lfo = ac.createOscillator();
    const profundidad = ac.createGain();
    profundidad.gain.value = 0.3;
    lfo.connect(profundidad).connect(temblor.gain);
    const oscs = [['sawtooth', 1, 0.5], ['sawtooth', 1.012, 0.35], ['square', 0.5, 0.4]].map(([tipo, factor, nivel]) => {
      const o = ac.createOscillator();
      o.type = tipo;
      const g = ac.createGain();
      g.gain.value = nivel;
      o.connect(g).connect(filtro);
      return { o, factor };
    });
    filtro.connect(temblor).connect(salida).connect(maestro);
    for (const { o } of oscs) o.start();
    lfo.start();
    return {
      ajustar(valor, volumen) {
        const t = ac.currentTime;
        const base = 38 + valor * 120; // ralentí ~38 Hz, a tope ~160 Hz
        for (const { o, factor } of oscs) o.frequency.setTargetAtTime(base * factor, t, 0.08);
        lfo.frequency.setTargetAtTime(base / 2, t, 0.08);
        filtro.frequency.setTargetAtTime(250 + valor * 1400, t, 0.1);
        salida.gain.setTargetAtTime(volumen, t, 0.1);
      },
      parar() {
        const t = ac.currentTime;
        salida.gain.setTargetAtTime(0, t, 0.05);
        for (const { o } of oscs) o.stop(t + 0.3);
        lfo.stop(t + 0.3);
      },
    };
  },
  // Propulsor de nave (Piloto Estelar): ruido grave filtrado que se abre con la potencia
  propulsor() {
    const salida = ac.createGain();
    salida.gain.value = 0;
    const fuente = ac.createBufferSource();
    fuente.buffer = obtenerRuido();
    fuente.loop = true;
    const filtro = ac.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.Q.value = 1.5;
    filtro.frequency.value = 300;
    const tonoBase = ac.createOscillator();
    tonoBase.type = 'triangle';
    tonoBase.frequency.value = 55;
    const gTono = ac.createGain();
    gTono.gain.value = 0.25;
    fuente.connect(filtro).connect(salida);
    tonoBase.connect(gTono).connect(salida);
    salida.connect(maestro);
    fuente.start();
    tonoBase.start();
    return {
      ajustar(valor, volumen) {
        const t = ac.currentTime;
        filtro.frequency.setTargetAtTime(250 + valor * 900, t, 0.1);
        tonoBase.frequency.setTargetAtTime(50 + valor * 25, t, 0.1);
        salida.gain.setTargetAtTime(volumen, t, 0.1);
      },
      parar() {
        const t = ac.currentTime;
        salida.gain.setTargetAtTime(0, t, 0.05);
        fuente.stop(t + 0.3);
        tonoBase.stop(t + 0.3);
      },
    };
  },
  // Zumbido eléctrico (Pulso Firme): red de 100 Hz con su armónico. El filtro se abre
  // y sube de tono cuanto mayor es el valor (más cerca del cable).
  zumbido() {
    const salida = ac.createGain();
    salida.gain.value = 0;
    const filtro = ac.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.Q.value = 2;
    filtro.frequency.value = 300;
    const o1 = ac.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.value = 100;
    const o2 = ac.createOscillator();
    o2.type = 'square';
    o2.frequency.value = 200;
    const g2 = ac.createGain();
    g2.gain.value = 0.3;
    o1.connect(filtro);
    o2.connect(g2).connect(filtro);
    filtro.connect(salida).connect(maestro);
    o1.start();
    o2.start();
    return {
      ajustar(valor, volumen) {
        const t = ac.currentTime;
        filtro.frequency.setTargetAtTime(300 + valor * 1500, t, 0.05);
        salida.gain.setTargetAtTime(volumen, t, 0.05);
      },
      parar() {
        const t = ac.currentTime;
        salida.gain.setTargetAtTime(0, t, 0.05);
        o1.stop(t + 0.3);
        o2.stop(t + 0.3);
      },
    };
  },
};

export function sonidoContinuo(nombre) {
  let nodos = null;
  let parado = false;
  return {
    ajustar(valor = 0, volumen = 0.15) {
      if (parado || !ac || ac.state !== 'running') return;
      try {
        if (!nodos) nodos = CONTINUOS[nombre]?.();
        nodos?.ajustar(Math.min(1, Math.max(0, valor)), volumen);
      } catch (e) {
        /* un sonido que falla no debe parar el juego */
      }
    },
    parar() {
      parado = true;
      try {
        nodos?.parar();
      } catch (e) {
        /* ya estaba parado */
      }
      nodos = null;
    },
  };
}
