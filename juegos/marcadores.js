// Cómo se puntúa cada juego en la clasificación (ver «Clasificaciones» en el README).
// TODO juego nuevo tiene que tener aquí su marcador y llamar a ctx.puntuacion(valor) al terminar
// cada partida (lo comprueba `node herramientas/marcadores.mjs`). Lo decide quien hace el juego: lo
// que mejor mida lo bien que se ha jugado y que no dependa solo de las horas jugadas.
//
//   orden          'mayor' (más es mejor) o 'menor' (menos es mejor: tiempos, golpes)
//   unidad         'puntos' | 'tiempo' (segundos, con décimas) | 'golpes' | 'diferencia' (al ganar a
//                  la máquina: tus puntos menos los suyos; solo se envía si ganas) | 'recepciones' | 'metros'
//   min, max       los valores posibles de una partida (contra trampas: el servidor rechaza lo demás).
//                  Tiene que ser el máximo alcanzable de verdad (mira cómo puntúa su juego.js), con poco margen
//   maxPorSegundo  ritmo máximo (opcional): el servidor rechaza más de maxPorSegundo × segundos que ha durado
//                  la partida (+10). Obligatorio en los juegos sin final fijo (sobrevivir), y en ellos max no
//                  pasa de maxPorSegundo × SEGUNDOS_PARTIDA (lo comprueba herramientas/marcadores.mjs)
//   minSegundos    lo mínimo que puede durar una partida, desde que se abre el juego o termina la anterior
// En los de tiempo, además, el tiempo no puede ser mayor que lo que ha durado la partida de verdad.
//
// Este archivo no importa nada: lo usan también el servidor (servidor/clasificacion.js) y las herramientas.

// Una partida abierta caduca a los 90 minutos: el resultado de una más larga no cuenta
export const SEGUNDOS_PARTIDA = 90 * 60;

export const MARCADORES = {
  fruta: { orden: 'mayor', unidad: 'puntos', min: 0, max: 32400, maxPorSegundo: 6, minSegundos: 3 },
  // Topos: 60 s; salen unos 100 como mucho (uno cada 1 a 0,32 s), 1 punto y 3 el dorado (12 %)
  topos: { orden: 'mayor', unidad: 'puntos', min: 0, max: 200, minSegundos: 50 },
  flechas: { orden: 'mayor', unidad: 'puntos', min: 0, max: 16200, maxPorSegundo: 3, minSegundos: 3 },
  // Tiro: 60 s; unos 84 muñecos como mucho, 3 a la cabeza (los inocentes restan, pero nunca baja de 0)
  tiro: { orden: 'mayor', unidad: 'puntos', min: 0, max: 260, minSegundos: 50 },
  // Patos: 60 s; unos 58 patos, 2 los lejanos y 5 el dorado (10 %)
  patos: { orden: 'mayor', unidad: 'puntos', min: 0, max: 180, minSegundos: 50 },
  // Canasta: 60 s; 3 limpia, 2 si toca, el doble con racha (6 como mucho por tiro, uno por segundo)
  baloncesto: { orden: 'mayor', unidad: 'puntos', min: 0, max: 300, minSegundos: 50 },
  portero: { orden: 'mayor', unidad: 'puntos', min: 0, max: 10, minSegundos: 20 },
  // Petanca: a 7, y una mano da 3 puntos como mucho (de 6-0 a 9-0)
  petanca: { orden: 'mayor', unidad: 'diferencia', min: 1, max: 9, minSegundos: 30 },
  beisbol: { orden: 'mayor', unidad: 'puntos', min: 0, max: 40, minSegundos: 20 },
  pingpong: { orden: 'mayor', unidad: 'diferencia', min: 2, max: 11, minSegundos: 30 },
  // Bolos: la partida perfecta son 12 tiros, y cada uno tarda unos segundos en rodar y recoger los bolos
  bolos: { orden: 'mayor', unidad: 'puntos', min: 0, max: 300, maxPorSegundo: 7, minSegundos: 30 },
  badminton: { orden: 'mayor', unidad: 'diferencia', min: 2, max: 11, minSegundos: 30 },
  // Carreras: 3 vueltas a un circuito de unos 1.400 m, a 55 m/s como mucho (77 s sin frenar nunca)
  carreras: { orden: 'menor', unidad: 'tiempo', min: 70, max: 1800, minSegundos: 70 },
  obstaculos: { orden: 'mayor', unidad: 'puntos', min: 0, max: 810000, maxPorSegundo: 150, minSegundos: 3 },
  voleibol: { orden: 'mayor', unidad: 'diferencia', min: 2, max: 11, minSegundos: 30 },
  // Pulso: 10 cables; 100 por cable más 2 por segundo que sobra de 45 (ninguno se hace en menos de unos segundos)
  pulso: { orden: 'mayor', unidad: 'puntos', min: 0, max: 1850, minSegundos: 20 },
  piloto: { orden: 'mayor', unidad: 'puntos', min: 0, max: 5000, minSegundos: 60 },
  // Minigolf: 9 hoyos de par 2 a 6; como mucho par + 4 golpes por hoyo
  minigolf: { orden: 'menor', unidad: 'golpes', min: 9, max: 90, minSegundos: 40 },
  // Globos: 60 s; los dardos salen cada 0,35 s con ratón (unos 170) y valen de 1 a 5 (+2 si revientan dos)
  globos: { orden: 'mayor', unidad: 'puntos', min: 0, max: 500, minSegundos: 50 },
  tirapichon: { orden: 'mayor', unidad: 'puntos', min: 0, max: 36, minSegundos: 10 },
  mosquitos: { orden: 'mayor', unidad: 'puntos', min: 0, max: 16200, maxPorSegundo: 3, minSegundos: 3 },
  // Slot: el circuito cambia en cada carrera, así que no se comparan tiempos sino puntos (1000 = la carrera perfecta)
  // Picnic: 1 punto la mosca posada, 2 al vuelo y el doble la moscarda; sin final fijo (hasta que se pudren 3 platos)
  picnic: { orden: 'mayor', unidad: 'puntos', min: 0, max: 27000, maxPorSegundo: 5, minSegundos: 5 },
  slot: { orden: 'mayor', unidad: 'puntos', min: 0, max: 1150, minSegundos: 10 },
  // Dardos: 5 rondas de 3 dardos, como mucho 60 cada uno (triple 20); cada dardo tarda al menos 0,35 s
  dardos: { orden: 'mayor', unidad: 'puntos', min: 0, max: 900, maxPorSegundo: 40, minSegundos: 15 },
  // Saco de Boxeo: 1 por diana (3 la dorada) × multiplicador de racha (hasta ×4), +1 si el golpe es potente.
  // En 60 s se encienden unas 100 dianas como mucho (una cada 0,95 a 0,38 s): unos 6 puntos por diana
  boxeo: { orden: 'mayor', unidad: 'puntos', min: 0, max: 700, minSegundos: 50 },
  // Simón de Colores: 1 punto por tecla bien pulsada; sin final fijo (hasta el primer error)
  simon: { orden: 'mayor', unidad: 'puntos', min: 0, max: 5000, maxPorSegundo: 3, minSegundos: 3 },
  // Balanceo: 1 punto por cubo esquivado (3 si pasa rozando) y 5 cada 15 s en equilibrio; sin final fijo (hasta que se cae)
  balanceo: { orden: 'mayor', unidad: 'puntos', min: 0, max: 43200, maxPorSegundo: 8, minSegundos: 3 },
  // Cazafantasmas: de 10 a 25 puntos por fantasma, +5 o +10 si se deshace lejos; sin final fijo (hasta que uno te alcanza)
  cazafantasmas: { orden: 'mayor', unidad: 'puntos', min: 0, max: 200000, maxPorSegundo: 45, minSegundos: 5 },
  // Malabares: la cadena de recepciones seguidas más larga (como mucho unas 3 por segundo con 5 bolas)
  malabares: { orden: 'mayor', unidad: 'recepciones', min: 0, max: 5000, maxPorSegundo: 4, minSegundos: 5 },
  // Air Hockey: partido a 7 goles; solo cuenta si ganas, con la diferencia (de 7-6 a 7-0)
  airhockey: { orden: 'mayor', unidad: 'diferencia', min: 1, max: 7, minSegundos: 20 },
  // Cinta Mecánica: 1 punto por objeto bien clasificado; sale uno cada 0,9 s como mucho (hasta 3 fallos)
  cinta: { orden: 'mayor', unidad: 'puntos', min: 0, max: 8100, maxPorSegundo: 1.5, minSegundos: 5 },
  // Canoa: metros recorridos río abajo hasta volcar 3 veces (la canoa no pasa de ~9 m/s)
  canoa: { orden: 'mayor', unidad: 'metros', min: 0, max: 54000, maxPorSegundo: 10, minSegundos: 5 },
  // Last Call: turno de 60 s; cada bebida da de 3 a 10 puntos (con la propina), el doble si es especial (15 %).
  // Cada bebida lleva unos segundos (servir 0,5 s por medida, agitar…): unas 25 bebidas como mucho
  bar: { orden: 'mayor', unidad: 'puntos', min: 0, max: 350, minSegundos: 55 },
  // ¡Que no explote!: 3 bombas (2, 3 y 4 módulos, con 35, 45 y 55 s); por bomba, 100 por módulo + 5 por segundo
  // que sobra - 20 por error. Sin tardar nada saldrían 1.575: cada módulo necesita al menos un par de segundos
  bomba: { orden: 'mayor', unidad: 'puntos', min: 0, max: 1550, minSegundos: 12 },
  // Fusión de Frutas (cajón en 3D): 150 s; puntos por cada fruta creada (2 a 50) por el combo (hasta x6).
  // En las simulaciones salen de 1.200 a 3.300; margen para los combos largos
  fusion: { orden: 'mayor', unidad: 'puntos', min: 0, max: 6000, maxPorSegundo: 60, minSegundos: 25 },
  // Penaltis de Balonmano: 10 lanzamientos; gol 10 (+5 a la escuadra), el doble desde el tercer gol seguido.
  // El máximo es 15 + 15 + 8 × 30 = 270; cada lanzamiento tarda al menos unos 3 s con el silbato y la pausa
  balonmano: { orden: 'mayor', unidad: 'puntos', min: 0, max: 270, minSegundos: 25 },
  // Torre de Bloques: 1 punto por bloque y 2 si es perfecto; sin final fijo (hasta que uno no toca la torre)
  torre: { orden: 'mayor', unidad: 'puntos', min: 0, max: 5000, maxPorSegundo: 6, minSegundos: 3 },
  // Atrapa Huevos: 1 punto por huevo y 5 el dorado; sin final fijo (hasta romper 3 o coger 3 podridos)
  huevos: { orden: 'mayor', unidad: 'puntos', min: 0, max: 32400, maxPorSegundo: 6, minSegundos: 3 },
  // Tumba Latas: 5 rondas; 1 por lata (42 en total) y por ronda 5 por tirarlas todas + 5 por pelota que sobra (como mucho 15)
  latas: { orden: 'mayor', unidad: 'puntos', min: 0, max: 120, minSegundos: 20 },
  // Lanza Aros: 10 aros; cada uno vale de 1 a 4 según la fila de la botella y 5 la dorada
  aros: { orden: 'mayor', unidad: 'puntos', min: 0, max: 50, minSegundos: 10 },
  // Laberinto: 2 minutos; 100 por laberinto + hasta 60 por rapidez (como mucho unos 10 laberintos, cada vez más grandes)
  laberinto: { orden: 'mayor', unidad: 'puntos', min: 0, max: 2000, minSegundos: 110 },
  // Tambores: canción de 75 s; perfecto 3 y bien 1, por la racha (hasta x4). 220 notas como mucho: con
  // todas perfectas y la canción más densa salen unos 2.490
  tambores: { orden: 'mayor', unidad: 'puntos', min: 0, max: 2550, minSegundos: 70 },
  // Bomberos: 10-15 puntos por fuego, sin límite de tiempo (acaba cuando se quema el edificio)
  bomberos: { orden: 'mayor', unidad: 'puntos', min: 0, max: 64800, maxPorSegundo: 12, minSegundos: 5 },
  // Tortitas: hasta 15 puntos por vuelta y 10 por tortita servida, en 75 s. Cada cara tarda 5,5 s en hacerse
  // (unas 6 tortitas, 40 puntos cada una); dando vueltas sin parar a una cruda, 6 por vuelta de ~1 s
  tortitas: { orden: 'mayor', unidad: 'puntos', min: 0, max: 500, maxPorSegundo: 15, minSegundos: 70 },
  // Bolas de nieve: 10-15 puntos por acierto, sin tiempo (acaba al recibir tres bolas)
  nieve: { orden: 'mayor', unidad: 'puntos', min: 0, max: 81000, maxPorSegundo: 15, minSegundos: 5 },
  // Skee-Ball: 9 bolas, de 10 a 100 puntos cada una (cada bola tarda unos segundos en subir la rampa)
  skeeball: { orden: 'mayor', unidad: 'puntos', min: 0, max: 900, maxPorSegundo: 40, minSegundos: 15 },
  // Toques con pala: 1-6 puntos por toque y 10 por estrella, sin tiempo (acaba al caer tres pelotas)
  toques: { orden: 'mayor', unidad: 'puntos', min: 0, max: 81000, maxPorSegundo: 15, minSegundos: 3 },
  // Mazo de feria: 10 golpes, hasta 135 puntos cada uno (altura, franja dorada o campana)
  // Xilófono: perfecto 3 y bien 1 por la racha (hasta x4), y 10 × el número de la canción al completarla
  // (como mucho 150); sin final fijo (hasta perder 3 notas). Simulando partidas perfectas sale de 28 puntos/s
  // a los 5 minutos a 43 en una hora, cuando ya va a la velocidad máxima
  xilofono: { orden: 'mayor', unidad: 'puntos', min: 0, max: 324000, maxPorSegundo: 60, minSegundos: 5 },
  // Frontón de Ping Pong: 1 punto por golpe dentro de la zona de la pared y +5 por diana; sin final fijo
  // (hasta que la bola sale, no llega, bota dos veces o se escapa)
  fronton: { orden: 'mayor', unidad: 'puntos', min: 0, max: 21600, maxPorSegundo: 4, minSegundos: 3 },
  // Leñador: 1 punto por hachazo; sin final fijo (hasta que te da una rama o se acaba la barra de tiempo).
  // La barra obliga a ir cada vez más deprisa (hasta unos 3,75 hachazos por segundo); con ratón o dos dedos se puede ir mucho más rápido
  lenador: { orden: 'mayor', unidad: 'puntos', min: 0, max: 75600, maxPorSegundo: 14, minSegundos: 2 },
  // Defensa del Castillo: 10/20/40 puntos por soldado/escudero/ariete (+5 desde lejos) y 15 por globo;
  // sin final fijo (hasta que la puerta recibe 5 golpes). Los enemigos salen como mucho cada 0,4 s
  castillo: { orden: 'mayor', unidad: 'puntos', min: 0, max: 324000, maxPorSegundo: 60, minSegundos: 10 },
  // Billar de Trucos: 25 por reto cumplido y, por mesa superada, 100 + 60 por tiro de sobra (+150 si todo de un
  // tiro); sin final fijo (hasta perder 3 vidas). Cada mesa necesita al menos unos segundos
  billar: { orden: 'mayor', unidad: 'puntos', min: 0, max: 540000, maxPorSegundo: 100, minSegundos: 10 },
  // Combate de Boxeo: daño hecho al robot (de 2 a ~24 por golpe), +5 por esquivar y, por K.O., 50 × el número de
  // combate (+100 si no te ha dado); sin final fijo (hasta que tu vida llega a 0)
  ring: { orden: 'mayor', unidad: 'puntos', min: 0, max: 324000, maxPorSegundo: 60, minSegundos: 8 },
  // Futbolín: 100 × el número de máquina por gol tuyo y 500 × la máquina por partido ganado; la racha acaba
  // al perder un partido (a 5 goles, así que dura al menos unos segundos)
  futbolin: { orden: 'mayor', unidad: 'puntos', min: 0, max: 1000000, maxPorSegundo: 300, minSegundos: 20 },
  // Prisma: 100 × el número de sala por sala superada; sin final fijo (hasta que se acaba el reloj, que empieza
  // con 3 minutos y recupera de 1 minuto a medio por sala). Cada sala necesita al menos unos segundos
  prisma: { orden: 'mayor', unidad: 'puntos', min: 0, max: 1000000, maxPorSegundo: 250, minSegundos: 5 },
  // Escalada contra la Lava: metros subidos hasta caer o hasta que te alcanza la lava (con ratón se sube como
  // mucho ~1 m por clic y la pared tarda un momento en llegar; con las manos, bastante menos)
  escalada: { orden: 'mayor', unidad: 'metros', min: 0, max: 21600, maxPorSegundo: 4, minSegundos: 3 },
};

// ¿Es «a» mejor que «b» en este juego?
export const mejorQue = (marcador, a, b) => (marcador.orden === 'menor' ? a < b : a > b);
