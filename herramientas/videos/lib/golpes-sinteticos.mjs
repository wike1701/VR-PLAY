// Sonido de una partida grabada con el reloj virtual (sin el audio del juego): un golpe sintetizado
// en cada impacto, más fuerte cuanto mayor es su nivel. Devuelve un WAV (48 kHz, estéreo, 16 bits).
const FRECUENCIA = 48000;

function golpe(nivel, semilla) {
  const largo = Math.round(FRECUENCIA * 0.32);
  const s = new Float32Array(largo);
  let azar = semilla * 9301 + 49297;
  const ruido = () => ((azar = (azar * 9301 + 49297) % 233280) / 233280) * 2 - 1;
  const grave = 70 + 40 * Math.min(1, nivel);
  let fase = 0;
  for (let i = 0; i < largo; i++) {
    const t = i / FRECUENCIA;
    fase += (2 * Math.PI * (grave + 220 * Math.exp(-t / 0.025))) / FRECUENCIA;
    const cuerpo = Math.sin(fase) * Math.exp(-t / 0.09);
    const chasquido = ruido() * Math.exp(-t / 0.012);
    s[i] = (cuerpo * 0.8 + chasquido * 0.45) * (0.35 + 0.5 * Math.min(1, nivel));
  }
  return s;
}

export function pistaDeGolpes(eventos, segundos) {
  const muestras = Math.ceil(segundos * FRECUENCIA);
  const mezcla = new Float32Array(muestras);
  eventos.filter((e) => e.tipo === 'impacto' && e.t >= 0).forEach((e, n) => {
    const g = golpe(e.nivel ?? 0.6, n + 1);
    const desde = Math.round(e.t * FRECUENCIA);
    for (let i = 0; i < g.length && desde + i < muestras; i++) mezcla[desde + i] += g[i];
  });
  const datos = Buffer.alloc(44 + muestras * 4);
  datos.write('RIFF', 0); datos.writeUInt32LE(36 + muestras * 4, 4); datos.write('WAVE', 8);
  datos.write('fmt ', 12); datos.writeUInt32LE(16, 16); datos.writeUInt16LE(1, 20); datos.writeUInt16LE(2, 22);
  datos.writeUInt32LE(FRECUENCIA, 24); datos.writeUInt32LE(FRECUENCIA * 4, 28); datos.writeUInt16LE(4, 32); datos.writeUInt16LE(16, 34);
  datos.write('data', 36); datos.writeUInt32LE(muestras * 4, 40);
  for (let i = 0; i < muestras; i++) {
    const v = Math.round(Math.tanh(mezcla[i]) * 32767 * 0.9);
    datos.writeInt16LE(v, 44 + i * 4);
    datos.writeInt16LE(v, 46 + i * 4);
  }
  return datos;
}
