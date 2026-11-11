// Recursos de reserva: si faltan los efectos de efectos/ o no hay música en musica/ (no van a git:
// en la nube o en GitHub Actions no están), se generan aquí con FFmpeg y con código, gratis y sin
// licencias de terceros. En tu ordenador, con los archivos de los LEEME, no se usa nada de esto.
import fs from 'node:fs';
import path from 'node:path';
import { CARPETA, ff, log } from './comun.mjs';

// Cada efecto, como fuente de audio de FFmpeg (aevalsrc: t es el tiempo en segundos)
const EFECTOS = {
  'golpe.ogg': ['aevalsrc=exprs=(sin(2*PI*(55+140*exp(-t/0.04))*t)*exp(-t/0.22)+0.5*(random(0)*2-1)*exp(-t/0.03))*0.9:d=0.6', 'lowpass=f=3000'],
  'golpe-metal.ogg': ['aevalsrc=exprs=(sin(2*PI*180*t)+0.7*sin(2*PI*463*t)+0.5*sin(2*PI*1127*t)+0.3*sin(2*PI*2311*t))*exp(-t/0.18)*0.35+0.4*(random(0)*2-1)*exp(-t/0.02):d=0.8', 'highpass=f=90'],
  'cristal.ogg': ['aevalsrc=exprs=((random(0)*2-1)*exp(-t/0.12)*0.6+0.3*sin(2*PI*3100*t)*exp(-t/0.25)+0.25*sin(2*PI*4700*(t+0.03))*exp(-t/0.18)+0.2*sin(2*PI*6200*t)*exp(-t/0.1)):d=0.9', 'highpass=f=1200'],
  'tecla.ogg': ['aevalsrc=exprs=(random(0)*2-1)*exp(-t/0.006)*0.9+0.3*sin(2*PI*2400*t)*exp(-t/0.01):d=0.06', 'highpass=f=800'],
  'intro.ogg': ['aevalsrc=exprs=0.45*(sin(2*PI*880*t)*lt(t\\,0.09)+sin(2*PI*1318*t)*gte(t\\,0.09))*exp(-mod(t\\,0.09)/0.12)*lt(t\\,0.3):d=0.32', 'afade=t=out:st=0.25:d=0.07'],
  'tic.ogg': ['aevalsrc=exprs=0.6*sin(2*PI*1600*t)*exp(-t/0.02):d=0.08', 'highpass=f=300'],
  'glitch.ogg': ['aevalsrc=exprs=0.5*sgn(sin(2*PI*(220+1800*floor(mod(t*40\\,4)))*t))*(random(0)*0.6+0.4)*lt(mod(t\\,0.05)\\,0.035):d=0.35', 'acrusher=bits=6:mode=log:aa=0.5,afade=t=out:st=0.25:d=0.1'],
  'aparecer.ogg': ['aevalsrc=exprs=0.4*sin(2*PI*(300*t+1800*t*t))*sin(PI*t/0.3):d=0.3', 'highpass=f=150'],
  'whoosh.ogg': ['anoisesrc=c=pink:d=0.55:a=0.6', 'bandpass=f=1400:width_type=o:w=2.5,afade=t=in:d=0.35:curve=exp,afade=t=out:st=0.35:d=0.2,volume=3'],
};

export async function efectosDeReserva() {
  const carpeta = path.join(CARPETA, 'efectos');
  const faltan = Object.keys(EFECTOS).filter((n) => !fs.existsSync(path.join(carpeta, n)));
  for (const nombre of faltan) {
    const [fuente, filtro] = EFECTOS[nombre];
    await ff(['-f', 'lavfi', '-i', fuente, '-af', filtro, '-ar', '44100', '-ac', '1', '-c:a', 'libvorbis', '-q:a', '5', path.join(carpeta, nombre)]);
  }
  if (faltan.length) log(`efectos generados (faltaban): ${faltan.join(', ')}`);
}

// ─── Música generada ─────────────────────────────────────────────────────
// Electrónica sencilla y enérgica (bombo, palmas, platillos, bajo y un arpegio), un compás de 4
// tiempos que se repite en bucle sin cortes. Tres estilos para que no suenen todos los vídeos igual.
const FRECUENCIA = 44100;
export const ESTILOS = {
  arcade: { bpm: 128, raiz: 55, progresion: [0, 0, -4, -2], arpegio: [0, 7, 12, 7, 15, 12, 7, 3] },
  accion: { bpm: 140, raiz: 49, progresion: [0, 3, -2, 5], arpegio: [0, 12, 7, 12, 10, 12, 7, 5] },
  chill: { bpm: 105, raiz: 58.27, progresion: [0, -3, -7, -5], arpegio: [0, 4, 7, 11, 12, 11, 7, 4] },
};

function generarPista({ bpm, raiz, progresion, arpegio }, compases = 16, semilla = 1) {
  const negra = 60 / bpm;
  const total = Math.round(compases * 4 * negra * FRECUENCIA);
  const izq = new Float32Array(total);
  const der = new Float32Array(total);
  let azar = semilla;
  const ruido = () => ((azar = (azar * 16807) % 2147483647) / 2147483647) * 2 - 1;
  const poner = (inicio, largo, f, pan = 0) => {
    const desde = Math.round(inicio * FRECUENCIA);
    const n = Math.round(largo * FRECUENCIA);
    for (let i = 0; i < n; i++) {
      const j = (desde + i) % total; // en bucle: lo que se sale vuelve al principio
      const v = f(i / FRECUENCIA);
      izq[j] += v * (1 - Math.max(0, pan));
      der[j] += v * (1 + Math.min(0, pan));
    }
  };
  let faseBajo = 0;
  for (let b = 0; b < compases * 4; b++) {
    const t = b * negra;
    const acorde = raiz * 2 ** (progresion[Math.floor(b / 4) % progresion.length] / 12);
    // Bombo
    let fase = 0;
    poner(t, 0.4, (s) => { fase += (2 * Math.PI * (45 + 120 * Math.exp(-s / 0.035))) / FRECUENCIA; return Math.sin(fase) * Math.exp(-s / 0.14) * 0.9; });
    // Palmas en el 2 y el 4
    if (b % 2 === 1) poner(t, 0.2, (s) => ruido() * Math.exp(-s / 0.05) * 0.35 * (s < 0.012 || s > 0.02 ? 1 : 0.4), 0.1);
    // Platillos a corcheas
    for (let h = 0; h < 2; h++) poner(t + h * negra / 2, 0.06, (s) => (ruido() - ruido()) * Math.exp(-s / (h ? 0.03 : 0.012)) * 0.12, -0.3);
    // Bajo a contratiempo (el bombo respira)
    poner(t + negra / 2, negra / 2, (s) => { faseBajo += (2 * Math.PI * acorde) / FRECUENCIA; return Math.tanh(Math.sin(faseBajo) * 2.2) * Math.min(1, s / 0.004) * Math.exp(-s / 0.18) * 0.32; });
    // Arpegio
    for (let k = 0; k < 2; k++) {
      const nota = acorde * 4 * 2 ** (arpegio[(b * 2 + k) % arpegio.length] / 12);
      poner(t + (k * negra) / 2, negra / 2, (s) => {
        const onda = ((s * nota) % 1) * 2 - 1 + 0.5 * (((s * nota * 1.005) % 1) * 2 - 1);
        return onda * Math.min(1, s / 0.006) * Math.exp(-s / 0.11) * 0.06;
      }, k ? 0.35 : -0.35);
    }
  }
  const datos = Buffer.alloc(44 + total * 4);
  datos.write('RIFF', 0); datos.writeUInt32LE(36 + total * 4, 4); datos.write('WAVE', 8);
  datos.write('fmt ', 12); datos.writeUInt32LE(16, 16); datos.writeUInt16LE(1, 20); datos.writeUInt16LE(2, 22);
  datos.writeUInt32LE(FRECUENCIA, 24); datos.writeUInt32LE(FRECUENCIA * 4, 28); datos.writeUInt16LE(4, 32); datos.writeUInt16LE(16, 34);
  datos.write('data', 36); datos.writeUInt32LE(total * 4, 40);
  for (let i = 0; i < total; i++) {
    datos.writeInt16LE(Math.round(Math.tanh(izq[i] * 0.9) * 30000), 44 + i * 4);
    datos.writeInt16LE(Math.round(Math.tanh(der[i] * 0.9) * 30000), 46 + i * 4);
  }
  return datos;
}

// Si musica/ no tiene ninguna pista, deja ahí las tres generadas (musica/generada-<estilo>.wav)
export function musicaDeReserva() {
  const carpeta = path.join(CARPETA, 'musica');
  const hay = fs.readdirSync(carpeta).some((n) => /\.(mp3|ogg|wav|m4a)$/i.test(n));
  if (hay) return;
  Object.entries(ESTILOS).forEach(([nombre, estilo], i) => fs.writeFileSync(path.join(carpeta, `generada-${nombre}.wav`), generarPista(estilo, 16, i + 3)));
  log(`sin música en musica/: generadas ${Object.keys(ESTILOS).map((n) => `generada-${n}.wav`).join(', ')}`);
}

export async function recursosDeReserva() {
  await efectosDeReserva();
  musicaDeReserva();
}
