// Lista de juegos de la web.
// Para añadir uno nuevo: crea su carpeta en /juegos con un juego.js y añádelo aquí.
// El orden de esta lista es el orden en que el botón de cambio pasa de un juego a otro.
export const JUEGOS = [
  {
    id: 'fruta',
    titulo: 'Corta Fruta',
    genero: 'Arcade',
    descripcion: 'Corta con tus espadas la fruta que salta y esquiva las bombas.',
    controlesVR: 'Una espada en cada mano: corta la fruta con un movimiento rápido.',
    controlesEscritorio: 'Desliza el ratón rápido por encima de la fruta para cortarla.',
    miniatura: 'juegos/fruta/miniatura.svg',
    modulo: 'juegos/fruta/juego.js',
  },
  {
    id: 'topos',
    titulo: 'Aplasta Topos',
    genero: 'Reflejos',
    descripcion: 'Golpea los topos con el martillo antes de que se escondan. Rondas de 60 segundos.',
    controlesVR: 'Un martillo en cada mano: golpea al topo cuando asome.',
    controlesEscritorio: 'Haz clic sobre el topo para aplastarlo.',
    miniatura: 'juegos/topos/miniatura.svg',
    modulo: 'juegos/topos/juego.js',
  },
];
