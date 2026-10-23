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
  putt: () => { tono(950, 600, 0.05, 'sine', 0.32); ruido(0.03, 2400, 0.18, 1.5); },
  hoyo: () => { tono(620, 300, 0.08, 'triangle', 0.3); tono(520, 260, 0.08, 'triangle', 0.25, 0.09); tono(880, 1320, 0.14, 'sine', 0.15, 0.25); },
  globo: () => { ruido(0.1, 2400, 0.75, 0.6); tono(620, 160, 0.07, 'square', 0.16); },
  dardo: () => { tono(320, 130, 0.05, 'triangle', 0.32); ruido(0.04, 1600, 0.22, 1.2); },
  plaf: () => { ruido(0.09, 1700, 0.65, 0.7); tono(240, 80, 0.09, 'triangle', 0.4); }, // matamoscas
  picadura: () => { tono(1500, 2700, 0.1, 'sawtooth', 0.07); tono(330, 170, 0.28, 'square', 0.12, 0.08); },
  podrido: () => { tono(260, 90, 0.35, 'sawtooth', 0.14); ruido(0.3, 500, 0.35, 0.8); tono(180, 120, 0.25, 'square', 0.08, 0.12); }, // comida podrida (Picnic Matamoscas)
  saco: () => { tono(105, 48, 0.16, 'sine', 0.6); ruido(0.09, 520, 0.5, 0.7); }, // puñetazo al saco (Saco de Boxeo)
  campana: () => { // campana del ring: dos toques
    for (const r of [0, 0.32]) {
      tono(1480, 1460, 1.1, 'sine', 0.22, r);
      tono(2960, 2920, 0.7, 'sine', 0.07, r);
      tono(740, 735, 0.9, 'triangle', 0.08, r);
    }
  },
  // Simón de Colores: las cuatro notas de la consola clásica y el zumbido del error
  simon0: () => { tono(415, 415, 0.38, 'triangle', 0.32); tono(830, 830, 0.22, 'sine', 0.06); },
  simon1: () => { tono(310, 310, 0.38, 'triangle', 0.32); tono(620, 620, 0.22, 'sine', 0.06); },
  simon2: () => { tono(252, 252, 0.38, 'triangle', 0.34); tono(504, 504, 0.22, 'sine', 0.06); },
  simon3: () => { tono(209, 209, 0.38, 'triangle', 0.36); tono(418, 418, 0.22, 'sine', 0.06); },
  zumbador: () => { tono(90, 88, 0.7, 'square', 0.16); tono(42, 40, 0.7, 'sawtooth', 0.14); },
  silbato: () => { tono(2100, 2150, 0.18, 'square', 0.08); tono(2100, 2150, 0.35, 'square', 0.08, 0.22); },
  // Balanceo: el cañón de circo que lanza los cubos, el cubo que golpea la escoba y la escoba que cae
  canon: () => { ruido(0.2, 480, 0.55, 0.7); tono(210, 70, 0.16, 'sine', 0.4); tono(900, 500, 0.05, 'triangle', 0.08); },
  cubo: () => { tono(760, 320, 0.09, 'square', 0.16); ruido(0.07, 2300, 0.45, 1); tono(160, 90, 0.12, 'sine', 0.3); },
  caida: () => { tono(170, 55, 0.35, 'sine', 0.5); ruido(0.25, 700, 0.45, 0.6); tono(1300, 900, 0.05, 'triangle', 0.1, 0.08); },
  // Cazafantasmas: el fantasma que aparece, el que se deshace con la luz y el susto final
  aparicion: () => { ruido(0.55, 900, 0.18, 2.5); tono(260, 520, 0.5, 'sine', 0.06); },
  desvanecer: () => { tono(620, 1480, 0.28, 'sine', 0.16); tono(930, 2200, 0.24, 'triangle', 0.07, 0.06); ruido(0.3, 5200, 0.16, 1.5); },
  susto: () => { tono(1300, 380, 0.7, 'sawtooth', 0.16); tono(1390, 410, 0.7, 'square', 0.08); ruido(0.6, 1800, 0.5, 0.6); tono(70, 40, 0.6, 'sine', 0.5); },
  // Malabares: la bola en la mano, la que cae al suelo (golpe sordo) y la cadena que se rompe
  recepcion: () => { ruido(0.06, 1100, 0.4, 0.9); tono(300, 190, 0.07, 'sine', 0.25); },
  plof: () => { tono(110, 48, 0.24, 'sine', 0.55); ruido(0.14, 260, 0.45, 0.7); },
  cadenaRota: () => { tono(2200, 1900, 0.09, 'triangle', 0.1); tono(1700, 1500, 0.09, 'triangle', 0.08, 0.09); tono(1350, 1200, 0.12, 'triangle', 0.07, 0.19); },
  // Air Hockey: el disco contra la banda y la musiquilla de gol
  banda: () => { tono(1300, 900, 0.035, 'triangle', 0.16); ruido(0.03, 2600, 0.12, 1.4); },
  gol: () => { tono(660, 660, 0.09, 'square', 0.1); tono(880, 880, 0.09, 'square', 0.1, 0.1); tono(1320, 1320, 0.22, 'square', 0.1, 0.2); },
  // Last Call: el licor que cae en el vaso, el hielo, la coctelera, el vaso por la barra, la caja y el vaso roto
  verter: () => { ruido(0.32, 900, 0.3, 2.2); tono(420, 640, 0.3, 'sine', 0.05); },
  hielo: () => { tono(2900, 2600, 0.05, 'triangle', 0.14); tono(3600, 3300, 0.04, 'sine', 0.1, 0.05); },
  coctelera: () => { ruido(0.07, 3800, 0.35, 1.5); tono(2400, 2100, 0.03, 'triangle', 0.08); },
  deslizar: () => ruido(0.45, 1400, 0.16, 0.6),
  caja: () => { tono(1320, 1320, 0.07, 'square', 0.08); tono(1760, 1760, 0.3, 'triangle', 0.16, 0.07); ruido(0.08, 4000, 0.15, 1); },
  cristal: () => { ruido(0.25, 5200, 0.55, 0.9); tono(3100, 2400, 0.12, 'triangle', 0.12); tono(4200, 3600, 0.09, 'sine', 0.08, 0.04); },
  // Canoa: la pala que entra en el agua
  remo: () => { tono(240, 150, 0.09, 'sine', 0.12); ruido(0.14, 900, 0.14, 1.1); }, // entrada suave de la pala
  // Tumba Latas: la lata que sale volando y la que rebota en el suelo
  lata: () => { tono(1900, 1250, 0.09, 'triangle', 0.22); tono(3100, 2500, 0.06, 'sine', 0.1); ruido(0.08, 4200, 0.3, 1.4); },
  lataSuelo: () => { tono(900, 700, 0.05, 'triangle', 0.12); ruido(0.05, 3000, 0.16, 1.2); },
  // Lanza Aros: el aro que entra en la botella
  aro: () => { tono(2400, 2350, 0.25, 'sine', 0.14); tono(3600, 3550, 0.18, 'sine', 0.06, 0.02); ruido(0.05, 5000, 0.15, 1.5); },
  // Laberinto: la bola que choca con la pared de madera y la que cae en un agujero
  madera: () => { tono(520, 300, 0.05, 'triangle', 0.18); ruido(0.04, 1200, 0.2, 1.5); },
  agujero: () => { tono(400, 120, 0.35, 'sine', 0.28); ruido(0.2, 500, 0.25, 0.8); },
  // Tambores: los cuatro tambores de la batería (de agudo a grave) y el pulso del ritmo
  tambor0: () => { tono(420, 280, 0.14, 'sine', 0.42); ruido(0.05, 2400, 0.25, 1.2); },
  tambor1: () => { ruido(0.16, 3200, 0.42, 0.7); tono(240, 180, 0.08, 'triangle', 0.25); }, // caja
  tambor2: () => { tono(200, 130, 0.24, 'sine', 0.48); ruido(0.05, 1500, 0.2, 1.2); },
  tambor3: () => { tono(110, 50, 0.34, 'sine', 0.6); ruido(0.04, 700, 0.25, 1); }, // bombo
  pulso: () => { tono(1600, 1600, 0.03, 'sine', 0.06); },
  bajo: () => { tono(82, 80, 0.22, 'triangle', 0.22); },
  // Pesca: el corcho que cae al agua, el pez que muerde y el carrete
  chapuzon: () => { ruido(0.25, 1200, 0.35, 0.8); tono(400, 160, 0.12, 'sine', 0.2); },
  picada: () => { ruido(0.12, 900, 0.5, 1); tono(260, 120, 0.1, 'sine', 0.35); },
  carrete: () => { tono(2600, 2600, 0.02, 'square', 0.04); },
  // Bomberos: el chorro de la manguera, el vapor al apagar un fuego y el derrumbe de una ventana
  chorro: () => { ruido(0.2, 2200, 0.07, 0.9); },
  vapor: () => { ruido(0.4, 4200, 0.3, 1.2); tono(700, 300, 0.2, 'sine', 0.06); },
  derrumbe: () => { ruido(0.7, 320, 0.7, 0.5); tono(110, 45, 0.5, 'sawtooth', 0.2); },
  // Campo de prácticas: el golpe seco del driver
  driver: () => { tono(1900, 900, 0.06, 'triangle', 0.35); ruido(0.08, 3800, 0.55, 1.2); tono(260, 120, 0.08, 'sine', 0.25); },
  // Piñata: el palo contra el cartón y el papel que se rasga al romperse
  carton: () => { tono(150, 70, 0.12, 'triangle', 0.45); ruido(0.1, 1300, 0.5, 0.8); },
  rasgar: () => { ruido(0.45, 2600, 0.6, 0.7); tono(220, 70, 0.3, 'sawtooth', 0.15); },
  // Tortitas: la masa que chisporrotea en la sartén
  chisporroteo: () => { ruido(0.5, 5200, 0.12, 0.9); ruido(0.3, 2600, 0.06, 1.5); },
  // Bolas de nieve: el golpe blando de una bola que se deshace
  nieve: () => { ruido(0.16, 900, 0.55, 0.6); tono(180, 90, 0.08, 'sine', 0.25); },
  // Mazo de feria: el disco que sube silbando por la torre
  subida: () => { tono(300, 1400, 0.6, 'triangle', 0.1); ruido(0.4, 2400, 0.08, 1.2); },
  // Xilófono: el golpe de la baqueta en la madera y el pulso de fondo (un taco de madera).
  // Las ocho teclas (xilo0 … xilo7, de do a do agudo) se añaden debajo.
  xiloPulso: () => { tono(1900, 1700, 0.025, 'triangle', 0.07); },
  xiloPulsoFuerte: () => { tono(1500, 1300, 0.035, 'triangle', 0.1); tono(95, 70, 0.08, 'sine', 0.18); },
  // Frontón: la diana que aparece en la pared (dos notas que suben)
  dianaAparece: () => { tono(880, 1320, 0.09, 'triangle', 0.14); tono(1320, 1760, 0.12, 'sine', 0.1, 0.08); },
  // Leñador: el hacha que se clava en la madera y la rama que te da
  hachazo: () => { tono(190, 85, 0.1, 'triangle', 0.45); ruido(0.07, 1300, 0.5, 0.9); tono(900, 600, 0.03, 'square', 0.06); },
  rama: () => { ruido(0.3, 2600, 0.5, 0.6); tono(140, 50, 0.3, 'sine', 0.5); ruido(0.2, 500, 0.4, 0.8); },
  fin: () => {
    tono(523, 523, 0.15, 'triangle', 0.3);
    tono(659, 659, 0.15, 'triangle', 0.3, 0.15);
    tono(784, 784, 0.3, 'triangle', 0.3, 0.3);
  },
};

// Xilófono (do5 a do6): la nota se apaga rápido como la madera, con su armónico de 3× (el de
// las teclas de xilófono, que suena brillante), un toque de 4× y el chasquido de la baqueta.
[523.25, 587.33, 659.25, 698.46, 783.99, 880, 987.77, 1046.5].forEach((f, i) => {
  SONIDOS['xilo' + i] = () => {
    tono(f, f, 0.55, 'sine', 0.36);
    tono(f * 3, f * 3, 0.12, 'sine', 0.09);
    tono(f * 4.1, f * 4.1, 0.05, 'sine', 0.04);
    ruido(0.025, 3800, 0.16, 1.2);
  };
});

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
  // Zumbido de mosquito (Matamosquitos): dos sierras agudas un poco desafinadas (el batido de las alas)
  // con vibrato. Sube de tono, de brillo y de volumen cuanto más cerca está el mosquito más cercano.
  // Río (Canoa): rumor de agua; «valor» abre el filtro (más corriente, rápidos) y sube el volumen
  rio() {
    const salida = ac.createGain();
    salida.gain.value = 0;
    const fuente = ac.createBufferSource();
    fuente.buffer = obtenerRuido();
    fuente.loop = true;
    const filtro = ac.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.Q.value = 0.7;
    filtro.frequency.value = 500;
    const ondas = ac.createGain();
    ondas.gain.value = 0.8;
    const lfo = ac.createOscillator();
    lfo.frequency.value = 0.35;
    const profundidad = ac.createGain();
    profundidad.gain.value = 0.2;
    lfo.connect(profundidad).connect(ondas.gain);
    fuente.connect(filtro).connect(ondas).connect(salida).connect(maestro);
    fuente.start();
    lfo.start();
    return {
      ajustar(valor, volumen) {
        const t = ac.currentTime;
        filtro.frequency.setTargetAtTime(420 + valor * 1800, t, 0.2);
        lfo.frequency.setTargetAtTime(0.3 + valor * 1.2, t, 0.2);
        salida.gain.setTargetAtTime(volumen, t, 0.2);
      },
      parar() {
        const t = ac.currentTime;
        salida.gain.setTargetAtTime(0, t, 0.05);
        fuente.stop(t + 0.3);
        lfo.stop(t + 0.3);
      },
    };
  },
  // Palada (Canoa): el agua que arrastra la pala; sube con la fuerza de la palada
  palada() {
    const salida = ac.createGain();
    salida.gain.value = 0;
    const fuente = ac.createBufferSource();
    fuente.buffer = obtenerRuido();
    fuente.loop = true;
    const filtro = ac.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.Q.value = 0.9;
    filtro.frequency.value = 600;
    fuente.connect(filtro).connect(salida).connect(maestro);
    fuente.start();
    return {
      ajustar(valor, volumen) {
        const t = ac.currentTime;
        filtro.frequency.setTargetAtTime(450 + valor * 900, t, 0.06);
        salida.gain.setTargetAtTime(volumen, t, 0.06);
      },
      parar() {
        const t = ac.currentTime;
        salida.gain.setTargetAtTime(0, t, 0.05);
        fuente.stop(t + 0.3);
      },
    };
  },
  mosquito() {
    const salida = ac.createGain();
    salida.gain.value = 0;
    const filtro = ac.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.Q.value = 1.2;
    filtro.frequency.value = 1200;
    const o1 = ac.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.value = 560;
    const o2 = ac.createOscillator();
    o2.type = 'sawtooth';
    o2.frequency.value = 572;
    const g2 = ac.createGain();
    g2.gain.value = 0.6;
    const vibrato = ac.createOscillator();
    vibrato.frequency.value = 6.5;
    const profundidad = ac.createGain();
    profundidad.gain.value = 16;
    vibrato.connect(profundidad);
    profundidad.connect(o1.frequency);
    profundidad.connect(o2.frequency);
    o1.connect(filtro);
    o2.connect(g2).connect(filtro);
    filtro.connect(salida).connect(maestro);
    for (const o of [o1, o2, vibrato]) o.start();
    return {
      ajustar(valor, volumen) {
        const t = ac.currentTime;
        const f = 520 + valor * 170;
        o1.frequency.setTargetAtTime(f, t, 0.05);
        o2.frequency.setTargetAtTime(f * 1.021, t, 0.05);
        filtro.frequency.setTargetAtTime(900 + valor * 1600, t, 0.05);
        salida.gain.setTargetAtTime(volumen, t, 0.05);
      },
      parar() {
        const t = ac.currentTime;
        salida.gain.setTargetAtTime(0, t, 0.05);
        for (const o of [o1, o2, vibrato]) o.stop(t + 0.3);
      },
    };
  },
  // Zumbido de mosca (Picnic Matamoscas): más grave y más áspero que el del mosquito, con un temblor lento.
  // Sube de tono y de volumen cuantas más moscas vuelan y cuanto más cerca está la más cercana.
  mosca() {
    const salida = ac.createGain();
    salida.gain.value = 0;
    const filtro = ac.createBiquadFilter();
    filtro.type = 'bandpass';
    filtro.Q.value = 0.9;
    filtro.frequency.value = 700;
    const o1 = ac.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.value = 190;
    const o2 = ac.createOscillator();
    o2.type = 'square';
    o2.frequency.value = 196;
    const g2 = ac.createGain();
    g2.gain.value = 0.35;
    const vibrato = ac.createOscillator();
    vibrato.frequency.value = 4.2;
    const profundidad = ac.createGain();
    profundidad.gain.value = 9;
    vibrato.connect(profundidad);
    profundidad.connect(o1.frequency);
    profundidad.connect(o2.frequency);
    o1.connect(filtro);
    o2.connect(g2).connect(filtro);
    filtro.connect(salida).connect(maestro);
    for (const o of [o1, o2, vibrato]) o.start();
    return {
      ajustar(valor, volumen) {
        const t = ac.currentTime;
        const f = 185 + valor * 60;
        o1.frequency.setTargetAtTime(f, t, 0.05);
        o2.frequency.setTargetAtTime(f * 1.03, t, 0.05);
        filtro.frequency.setTargetAtTime(600 + valor * 900, t, 0.05);
        salida.gain.setTargetAtTime(volumen, t, 0.05);
      },
      parar() {
        const t = ac.currentTime;
        salida.gain.setTargetAtTime(0, t, 0.05);
        for (const o of [o1, o2, vibrato]) o.stop(t + 0.3);
      },
    };
  },
  // Lamento de fantasma (Cazafantasmas): un «uuuh» que sube y baja despacio, con su aliento de ruido.
  // Aquí «valor» es de dónde viene (0 = izquierda, 0,5 = delante, 1 = derecha) y el volumen, lo cerca que está.
  fantasma() {
    const salida = ac.createGain();
    salida.gain.value = 0;
    const panorama = ac.createStereoPanner ? ac.createStereoPanner() : null;
    const filtro = ac.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.frequency.value = 900;
    const o1 = ac.createOscillator();
    o1.type = 'sine';
    o1.frequency.value = 300;
    const o2 = ac.createOscillator();
    o2.type = 'triangle';
    o2.frequency.value = 452;
    const g2 = ac.createGain();
    g2.gain.value = 0.25;
    const vibrato = ac.createOscillator();
    vibrato.frequency.value = 5.2;
    const profundidad = ac.createGain();
    profundidad.gain.value = 7;
    const ola = ac.createOscillator(); // el lamento que sube y baja
    ola.frequency.value = 0.35;
    const alto = ac.createGain();
    alto.gain.value = 55;
    vibrato.connect(profundidad);
    ola.connect(alto);
    for (const o of [o1, o2]) {
      profundidad.connect(o.frequency);
      alto.connect(o.frequency);
    }
    const aliento = ac.createBufferSource();
    aliento.buffer = obtenerRuido();
    aliento.loop = true;
    const filtroRuido = ac.createBiquadFilter();
    filtroRuido.type = 'bandpass';
    filtroRuido.frequency.value = 1100;
    filtroRuido.Q.value = 0.8;
    const gRuido = ac.createGain();
    gRuido.gain.value = 0.18;
    o1.connect(filtro);
    o2.connect(g2).connect(filtro);
    aliento.connect(filtroRuido).connect(gRuido).connect(filtro);
    if (panorama) filtro.connect(salida).connect(panorama).connect(maestro);
    else filtro.connect(salida).connect(maestro);
    for (const o of [o1, o2, vibrato, ola, aliento]) o.start();
    return {
      ajustar(valor, volumen) {
        const t = ac.currentTime;
        if (panorama) panorama.pan.setTargetAtTime(valor * 2 - 1, t, 0.06);
        filtro.frequency.setTargetAtTime(600 + volumen * 4000, t, 0.1);
        salida.gain.setTargetAtTime(volumen, t, 0.08);
      },
      parar() {
        const t = ac.currentTime;
        salida.gain.setTargetAtTime(0, t, 0.05);
        for (const o of [o1, o2, vibrato, ola, aliento]) o.stop(t + 0.3);
      },
    };
  },
  // Motor eléctrico de coche de slot (Circuito Slot): un silbido agudo que sube con
  // la velocidad, con el roce de las escobillas (ruido) y el de la guía en la ranura.
  electrico() {
    const salida = ac.createGain();
    salida.gain.value = 0;
    const filtro = ac.createBiquadFilter();
    filtro.type = 'lowpass';
    filtro.Q.value = 4;
    filtro.frequency.value = 800;
    const o1 = ac.createOscillator();
    o1.type = 'sawtooth';
    o1.frequency.value = 180;
    const o2 = ac.createOscillator();
    o2.type = 'square';
    o2.frequency.value = 362;
    const g2 = ac.createGain();
    g2.gain.value = 0.25;
    const escobillas = ac.createBufferSource();
    escobillas.buffer = obtenerRuido();
    escobillas.loop = true;
    const filtroRuido = ac.createBiquadFilter();
    filtroRuido.type = 'highpass';
    filtroRuido.frequency.value = 3000;
    const gRuido = ac.createGain();
    gRuido.gain.value = 0;
    o1.connect(filtro);
    o2.connect(g2).connect(filtro);
    escobillas.connect(filtroRuido).connect(gRuido).connect(salida);
    filtro.connect(salida).connect(maestro);
    o1.start();
    o2.start();
    escobillas.start();
    return {
      ajustar(valor, volumen) {
        const t = ac.currentTime;
        const f = 160 + valor * 950;
        o1.frequency.setTargetAtTime(f, t, 0.06);
        o2.frequency.setTargetAtTime(f * 2.01, t, 0.06);
        filtro.frequency.setTargetAtTime(500 + valor * 3000, t, 0.06);
        gRuido.gain.setTargetAtTime(0.08 + valor * 0.25, t, 0.06);
        salida.gain.setTargetAtTime(volumen, t, 0.06);
      },
      parar() {
        const t = ac.currentTime;
        salida.gain.setTargetAtTime(0, t, 0.05);
        o1.stop(t + 0.3);
        o2.stop(t + 0.3);
        escobillas.stop(t + 0.3);
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
