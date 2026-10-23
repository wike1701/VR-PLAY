// Qué gancho lleva cada juego. JavaScript puro (sin JSX) para que lo puedan importar tanto Remotion
// como los scripts de Node (lib/montar.mjs). Los componentes están en Gancho.jsx.
export const TIPOS = ['web', 'persona', 'impacto', 'reto'];

// Vídeos de archivo del gancho «persona», relativos a trabajo/ (ver medios/LEEME.md)
export const PERSONAS = ['7236940', '7236766', '7774618', '7241006', '7774740', '7942934', '7774616', '7240655']
  .map((n) => `medios/personas/pexels-${n}.mp4`);

// Número fijo a partir del id (FNV-1a): el mismo juego da siempre lo mismo
function huella(texto) {
  let h = 0x811c9dc5;
  for (const c of texto) h = Math.imul(h ^ c.codePointAt(0), 0x01000193) >>> 0;
  return h;
}

// El tipo de gancho de un juego: siempre el mismo para el mismo id.
// - `orden`: los ids en el orden del catálogo. Con él, los tipos van rotando juego a juego (web,
//   persona, impacto, reto, web…), así que dos juegos seguidos nunca repiten. Un juego nuevo al final
//   del catálogo no cambia el de los demás.
// - Sin `orden` (o si el id no está), sale de una huella del id: fijo, pero no tan repartido.
// - `forzado` (el --gancho de fabrica.mjs) manda si es un tipo válido.
export function elegirGancho(id, { orden = [], forzado } = {}) {
  if (TIPOS.includes(forzado)) return forzado;
  const i = orden.indexOf(id);
  return TIPOS[(i >= 0 ? i : huella(String(id))) % TIPOS.length];
}

// El vídeo de persona de un juego, también fijo (con otra semilla para que no vaya atado al tipo)
export const elegirPersona = (id) => PERSONAS[huella(`persona:${id}`) % PERSONAS.length];
