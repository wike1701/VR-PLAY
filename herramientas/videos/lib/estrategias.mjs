// Cómo juega el bot (lib/bot.js) a cada juego, según sus controlesEscritorio de idiomas/es.js.
// Modos:
//   clic      apunta a lo que se mueve o acaba de aparecer y hace clic (topos, patos, mosquitos…)
//   seguir    lleva el puntero a la bola u objeto más rápido, sin clic (porteros, palas, cestas)
//   barrer    lo atraviesa rápido sin pulsar (cortar fruta)
//   mantener  pulsa y suelta con los tiempos de «pulsar» y «esperar» (fuerza, acelerar, lanzar)
//   pendiente necesita lógica propia (puzles, ritmo, esquivar): --todos lo salta avisando
// Ajustes comunes: segundos (lo máximo que se graba; para antes si el juego da su puntuación),
// reposo [x, y] (dónde espera el puntero, en fracciones de la pantalla), clicLibre (cada cuántos
// segundos hace un clic aunque no vea nada: para empezar o reiniciar partidas), cadencia,
// rigidez (lo rápido que mueve la mano), evitarOscuros (no tocar objetos casi negros: bombas).
// «probado: true» = revisado con un vídeo de verdad. Al ajustar un juego, márcalo.
// vr: cómo juega lib/bot-vr.js con unas gafas simuladas (el modo por defecto de la fábrica):
//   { modo: golpear|barrer|seguir|lanzar, mirar [x,y,z] (a dónde mira la cabeza), alcance, alto,
//     hondo, gatillo, rigidez…, espectador: { pos, mira, fov } (la cámara del plano de espectador) }
//   Si no lo pone, sale del modo de ratón (clic → golpear, seguir, barrer, mantener con
//   apuntarObjetivo → golpear); sin modo VR (puzles, ritmo, «mantener» de fuerza) se graba con ratón.
const BASE = { segundos: 75, clicLibre: 0 };

export const ESTRATEGIAS = {
  fruta: { modo: 'barrer', probado: true, evitarOscuros: true, largo: 240, cadencia: 0.05, reposo: [0.5, 0.6],
    vr: { modo: 'barrer', evitarOscuros: true, mirar: [0, 1.3, -1.2], alcance: 1.5, punta: [0, 0, -0.6] } },
  topos: { modo: 'clic', probado: true, cadencia: 0.18, rigidez: 220, reposo: [0.5, 0.62],
    vr: { modo: 'golpear', mirar: [0, 0.75, -0.75], alto: 0.22, hondo: 0.12, cadencia: 0.12 } },

  tiro: { modo: 'clic',
    vr: { modo: 'golpear', mirar: [0, 1.3, -6], espectador: { pos: [1.1, 2.0, 1.5], mira: [-0.4, 1.2, -4], fov: 55 } } },
  globos: { modo: 'clic' },
  mosquitos: { modo: 'clic',
    vr: { modo: 'golpear', mirar: [0, 1.4, -1.5], espectador: { pos: [1.2, 1.9, 1.0], mira: [-0.1, 1.3, -1.2], fov: 55 } } },
  picnic: { modo: 'clic' },
  boxeo: { modo: 'clic' },
  nieve: { modo: 'clic' },
  beisbol: { modo: 'clic', cadencia: 0.6 },

  portero: { modo: 'seguir', clicLibre: 4 },
  pingpong: { modo: 'seguir', clicLibre: 4 },
  badminton: { modo: 'seguir', clicLibre: 4 },
  voleibol: { modo: 'seguir', clicLibre: 4 },
  airhockey: { modo: 'seguir', clicLibre: 4 },
  huevos: { modo: 'seguir', clicLibre: 4 },
  toques: { modo: 'seguir', clicLibre: 4 },
  balanceo: { modo: 'seguir', clicLibre: 4 },
  cazafantasmas: { modo: 'seguir', clicLibre: 4 },

  patos: { modo: 'mantener', apuntarObjetivo: true, pulsar: [0.5, 0.9], esperar: [0.3, 0.6] },
  tirapichon: { modo: 'mantener', apuntarObjetivo: true, pulsar: [0.4, 0.8], esperar: [0.5, 1] },
  piloto: { modo: 'mantener', apuntarObjetivo: true, pulsar: [1.5, 3], esperar: [0.2, 0.4] },
  bomberos: { modo: 'mantener', apuntarObjetivo: true, pulsar: [1.5, 2.5], esperar: [0.2, 0.5] },
  baloncesto: { modo: 'mantener', punto: [0.5, 0.4], pulsar: [0.6, 1.1], esperar: [1.5, 2.5],
    vr: { modo: 'lanzar', mirar: [0, 1.9, -3.4], seguirMirada: 0.1, espectador: { pos: [1.3, 2.1, 1.4], mira: [-0.2, 1.8, -2.6], fov: 55 } } },
  balonmano: { modo: 'mantener', punto: [0.5, 0.4], pulsar: [0.6, 1.1], esperar: [1.5, 2.5] },
  skeeball: { modo: 'mantener', punto: [0.5, 0.4], pulsar: [0.5, 1], esperar: [1.5, 2.5] },
  carreras: { modo: 'mantener', pulsar: [2, 4], esperar: [0.3, 0.6], balanceo: 0.15 },
  slot: { modo: 'mantener', pulsar: [1, 2], esperar: [0.4, 0.8] },
  canoa: { modo: 'mantener', pulsar: [1.5, 3], esperar: [0.2, 0.4], balanceo: 0.2 },
  tortitas: { modo: 'mantener', pulsar: [0.4, 0.8], esperar: [2, 3] },
  petanca: { modo: 'mantener', punto: [0.5, 0.45], pulsar: [0.05, 0.1], esperar: [3, 4] },
  bolos: { modo: 'mantener', punto: [0.5, 0.45], pulsar: [0.05, 0.1], esperar: [4, 5],
    vr: { modo: 'lanzar', mirar: [0.05, 0.55, -6], seguirMirada: 0, espectador: { pos: [1.0, 1.9, 1.7], mira: [-0.1, 0.55, -5], fov: 50 } } },
  minigolf: { modo: 'mantener', punto: [0.5, 0.4], pulsar: [0.05, 0.1], esperar: [3, 4] },
  dardos: { modo: 'mantener', punto: [0.5, 0.42], pulsar: [0.05, 0.1], esperar: [1.5, 2.5] },
  latas: { modo: 'mantener', punto: [0.5, 0.45], pulsar: [0.05, 0.1], esperar: [1.5, 2.5] },
  fusion: { modo: 'mantener', punto: [0.5, 0.45], pulsar: [0.05, 0.1], esperar: [1.2, 2] },
  torre: { modo: 'mantener', punto: [0.5, 0.5], pulsar: [0.05, 0.1], esperar: [1.2, 2.2] },
  aros: { modo: 'mantener', punto: [0.5, 0.45], pulsar: [0.4, 0.9], esperar: [1.5, 2.5] },

  flechas: { modo: 'pendiente' },
  obstaculos: { modo: 'pendiente' },
  pulso: { modo: 'pendiente' },
  simon: { modo: 'clic', vr: { modo: 'golpear', mirar: [0, 0.92, -0.5], espectador: { pos: [0.85, 1.7, 0.75], mira: [0, 1.0, -0.45], fov: 50 } } },
  malabares: { modo: 'clic', vr: { modo: 'seguir', mirar: [0, 1.2, -0.7], espectador: { pos: [0.9, 1.75, 1.1], mira: [0, 1.15, -0.4], fov: 55 } } },
  cinta: { modo: 'pendiente' },
  bar: { modo: 'pendiente' },
  bomba: { modo: 'pendiente' },
  laberinto: { modo: 'pendiente' },
  tambores: { modo: 'clic', vr: { modo: 'golpear', mirar: [0, 0.85, -0.9], espectador: { pos: [1.0, 1.7, 0.8], mira: [0, 0.95, -0.6], fov: 50 } } },
};

const VR_DE = { clic: 'golpear', seguir: 'seguir', barrer: 'barrer' };

export function estrategiaDe(id) {
  const e = { ...BASE, modo: 'clic', probado: false, ...ESTRATEGIAS[id] };
  if (!e.vr) {
    const modo = VR_DE[e.modo] || (e.modo === 'mantener' && e.apuntarObjetivo ? 'golpear' : null);
    e.vr = modo ? { modo, gatillo: e.modo === 'mantener', evitarOscuros: e.evitarOscuros } : null;
  }
  return e;
}
