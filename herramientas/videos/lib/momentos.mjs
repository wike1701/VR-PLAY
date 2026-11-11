// Elige los trozos de la partida que van al vídeo, con el registro de grabacion.json:
//   gancho (3 s, el momento con más y mayores aciertos), momentos (3-4 trozos de ~4 s, en orden)
//   y final (los últimos segundos hasta que el juego enseña la puntuación).
// Cada trozo es { desde, hasta } en segundos de partida.mp4.
export const PESO = { pequeño: 1, medio: 2, grande: 3 };

// Lo «emocionante» que es cada instante: aciertos (con su intensidad) y, menos, clics y cortes
export function intensidad(eventos, t0, t1) {
  let total = 0;
  for (const e of eventos) {
    if (e.t < t0 || e.t >= t1) continue;
    if (e.tipo === 'impacto') total += PESO[e.nivel] ?? 1;
    else if (e.tipo === 'clic') total += 0.1;
  }
  return total;
}

export function mejorVentana(eventos, largo, inicio, fin, ocupados) {
  let mejor = null;
  for (let t = inicio; t + largo <= fin; t += 0.25) {
    if (ocupados.some((o) => t < o.hasta + 0.5 && t + largo > o.desde - 0.5)) continue;
    const valor = intensidad(eventos, t, t + largo);
    if (!mejor || valor > mejor.valor) mejor = { desde: t, hasta: t + largo, valor };
  }
  return mejor;
}

export function elegirMomentos({ eventos, duracion }, { gancho = 3, largo = 4, cuantos = 4 } = {}) {
  const punt = eventos.find((e) => e.tipo === 'puntuacion') || null;
  // Lo jugable: tras el arranque y antes del cartel de fin de partida
  const inicio = 1.5;
  const finJuego = punt ? punt.t : duracion - 0.5;
  const final = punt
    ? { desde: Math.max(inicio, punt.t - 2.5), hasta: Math.min(duracion - 0.1, punt.t + 2.5) }
    : { desde: duracion - 4, hasta: duracion - 0.1 };
  const ocupados = [final];
  // El gancho: la ventana más intensa, que acabe justo después de un acierto
  const g = mejorVentana(eventos, gancho, inicio, final.desde, ocupados);
  if (!g) throw new Error('La partida es demasiado corta para hacer un vídeo');
  ocupados.push(g);
  const momentos = [];
  for (let i = 0; i < cuantos; i++) {
    const m = mejorVentana(eventos, largo, inicio, Math.min(finJuego, final.desde), ocupados);
    if (!m || (m.valor === 0 && momentos.length >= 2)) break;
    momentos.push(m);
    ocupados.push(m);
  }
  momentos.sort((a, b) => a.desde - b.desde);
  const quitarValor = ({ desde, hasta }) => ({ desde: +desde.toFixed(2), hasta: +hasta.toFixed(2) });
  return {
    gancho: quitarValor(g),
    momentos: momentos.map(quitarValor),
    final: quitarValor(final),
    puntuacion: punt ? { valor: punt.valor, texto: punt.texto } : null,
    aciertos: eventos.filter((e) => e.tipo === 'impacto').length,
  };
}
