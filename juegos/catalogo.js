// Lista de juegos de la web.
// Para añadir uno nuevo: crea su carpeta en /juegos con un juego.js y añádelo aquí.
// El botón de cambio recorre todos los juegos en orden aleatorio, sin repetir hasta completar la vuelta.
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
  {
    id: 'flechas',
    titulo: 'Esquiva Flechas',
    genero: 'Acción',
    descripcion: 'Las torres te disparan flechas: agáchate y apártate para que no te den. Tienes 3 vidas.',
    controlesVR: 'Mueve el cuerpo: agáchate o da un paso a un lado cuando una torre brille en rojo.',
    controlesEscritorio: 'Mueve el ratón a los lados para apartarte y hacia abajo para agacharte.',
    miniatura: 'juegos/flechas/miniatura.svg',
    modulo: 'juegos/flechas/juego.js',
  },
  {
    id: 'tiro',
    titulo: 'Galería de Tiro',
    genero: 'Disparos',
    descripcion: 'Se levantan muñecos por el campo: dispara a los rojos y respeta a los azules. Rondas de 60 segundos.',
    controlesVR: 'Una pistola en cada mano: apunta con el láser y aprieta el gatillo.',
    controlesEscritorio: 'Apunta con el ratón y haz clic para disparar.',
    miniatura: 'juegos/tiro/miniatura.svg',
    modulo: 'juegos/tiro/juego.js',
  },
];
