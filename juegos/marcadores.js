// Cómo se puntúa cada juego en la clasificación (ver «Clasificaciones» en el README).
// TODO juego nuevo tiene que tener aquí su marcador y llamar a ctx.puntuacion(valor) al terminar
// cada partida (lo comprueba `node herramientas/marcadores.mjs`). Lo decide quien hace el juego: lo
// que mejor mida lo bien que se ha jugado y que no dependa solo de las horas jugadas.
//
//   orden          'mayor' (más es mejor) o 'menor' (menos es mejor: tiempos, golpes)
//   unidad         'puntos' | 'tiempo' (segundos, con décimas) | 'golpes' | 'diferencia' (al ganar a
//                  la máquina: tus puntos menos los suyos; solo se envía si ganas)
//   min, max       los valores posibles de una partida (contra trampas: el servidor rechaza lo demás)
//   maxPorSegundo  en los juegos sin final fijo (sobrevivir), el máximo según lo que ha durado la partida
//   minSegundos    lo mínimo que puede durar una partida, desde que se abre el juego o termina la anterior
// En los de tiempo, además, el tiempo no puede ser mayor que lo que ha durado la partida de verdad.
//
// Este archivo no importa nada: lo usan también el servidor (servidor/clasificacion.js) y las herramientas.
export const MARCADORES = {
  fruta: { orden: 'mayor', unidad: 'puntos', min: 0, max: 100000, maxPorSegundo: 6, minSegundos: 3 },
  topos: { orden: 'mayor', unidad: 'puntos', min: 0, max: 600, minSegundos: 50 },
  flechas: { orden: 'mayor', unidad: 'puntos', min: 0, max: 100000, maxPorSegundo: 3, minSegundos: 3 },
  tiro: { orden: 'mayor', unidad: 'puntos', min: -200, max: 400, minSegundos: 50 },
  patos: { orden: 'mayor', unidad: 'puntos', min: 0, max: 400, minSegundos: 50 },
  baloncesto: { orden: 'mayor', unidad: 'puntos', min: 0, max: 300, minSegundos: 50 },
  portero: { orden: 'mayor', unidad: 'puntos', min: 0, max: 10, minSegundos: 20 },
  petanca: { orden: 'mayor', unidad: 'diferencia', min: 1, max: 13, minSegundos: 30 },
  beisbol: { orden: 'mayor', unidad: 'puntos', min: 0, max: 40, minSegundos: 20 },
  pingpong: { orden: 'mayor', unidad: 'diferencia', min: 2, max: 11, minSegundos: 30 },
  bolos: { orden: 'mayor', unidad: 'puntos', min: 0, max: 300, minSegundos: 30 },
  badminton: { orden: 'mayor', unidad: 'diferencia', min: 2, max: 11, minSegundos: 30 },
  carreras: { orden: 'menor', unidad: 'tiempo', min: 10, max: 3600, minSegundos: 10 },
  obstaculos: { orden: 'mayor', unidad: 'puntos', min: 0, max: 10000000, maxPorSegundo: 150, minSegundos: 3 },
  voleibol: { orden: 'mayor', unidad: 'diferencia', min: 2, max: 11, minSegundos: 30 },
  pulso: { orden: 'mayor', unidad: 'puntos', min: 0, max: 1900, minSegundos: 20 },
  piloto: { orden: 'mayor', unidad: 'puntos', min: 0, max: 5000, minSegundos: 60 },
  minigolf: { orden: 'menor', unidad: 'golpes', min: 9, max: 200, minSegundos: 40 },
  globos: { orden: 'mayor', unidad: 'puntos', min: 0, max: 600, minSegundos: 50 },
  tirapichon: { orden: 'mayor', unidad: 'puntos', min: 0, max: 36, minSegundos: 10 },
  mosquitos: { orden: 'mayor', unidad: 'puntos', min: 0, max: 100000, maxPorSegundo: 3, minSegundos: 3 },
  // Slot: el circuito cambia en cada carrera, así que no se comparan tiempos sino puntos (1000 = la carrera perfecta)
  // Picnic: 1 punto la mosca posada, 2 al vuelo y el doble la moscarda; sin final fijo (hasta perder los 5 platos)
  picnic: { orden: 'mayor', unidad: 'puntos', min: 0, max: 100000, maxPorSegundo: 5, minSegundos: 5 },
  slot: { orden: 'mayor', unidad: 'puntos', min: 0, max: 1300, minSegundos: 10 },
};

// ¿Es «a» mejor que «b» en este juego?
export const mejorQue = (marcador, a, b) => (marcador.orden === 'menor' ? a < b : a > b);
