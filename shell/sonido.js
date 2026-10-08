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

function ruido(duracion, frecuencia, volumen = 0.3, q = 1) {
  if (!bufferRuido) {
    bufferRuido = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const datos = bufferRuido.getChannelData(0);
    for (let i = 0; i < datos.length; i++) datos[i] = Math.random() * 2 - 1;
  }
  const t0 = ac.currentTime;
  const fuente = ac.createBufferSource();
  fuente.buffer = bufferRuido;
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
  red: () => ruido(0.3, 4200, 0.25, 0.7),
  patada: () => { tono(110, 45, 0.12, 'sine', 0.5); ruido(0.06, 900, 0.35); },
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
