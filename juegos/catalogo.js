// Lista de juegos de la web.
// Para añadir uno nuevo: crea su carpeta en /juegos con un juego.js, añádelo aquí y pon sus
// textos (título, descripción, controles, etiquetas y los textos del juego) en cada archivo de
// idiomas/ (en la sección juegos.<id>). Los textos de aquí abajo ya llegan traducidos.
// "genero" es una clave de la sección generos de los idiomas (arcade, deportes...).
// La miniatura es juegos/<id>/miniatura.svg salvo que se indique otra (miniatura: 'juegos/<id>/miniatura.png').
// El botón de cambio recorre todos los juegos en orden aleatorio, sin repetir hasta completar la vuelta.
import { t, tOriginal } from '../idiomas/idiomas.js';

const LISTA = [
  { id: 'fruta', genero: 'arcade' },
  { id: 'topos', genero: 'reflejos' },
  { id: 'flechas', genero: 'accion' },
  { id: 'tiro', genero: 'disparos' },
  { id: 'patos', genero: 'disparos' },
  { id: 'baloncesto', genero: 'deportes' },
  { id: 'portero', genero: 'deportes' },
  { id: 'petanca', genero: 'deportes' },
  { id: 'beisbol', genero: 'deportes' },
  { id: 'pingpong', genero: 'deportes' },
  { id: 'bolos', genero: 'deportes' },
  { id: 'badminton', genero: 'deportes' },
  { id: 'carreras', genero: 'conduccion' },
  { id: 'obstaculos', genero: 'conduccion' },
  { id: 'voleibol', genero: 'deportes' },
  { id: 'pulso', genero: 'habilidad' },
  { id: 'piloto', genero: 'disparos' },
  { id: 'minigolf', genero: 'deportes' },
  { id: 'globos', genero: 'arcade' },
  { id: 'tirapichon', genero: 'disparos' },
  { id: 'mosquitos', genero: 'reflejos' },
  { id: 'slot', genero: 'conduccion' },
  { id: 'picnic', genero: 'reflejos' },
  { id: 'dardos', genero: 'deportes' },
  { id: 'boxeo', genero: 'reflejos' },
  { id: 'simon', genero: 'puzle' },
  { id: 'balanceo', genero: 'habilidad' },
  { id: 'cazafantasmas', genero: 'reflejos' },
  { id: 'malabares', genero: 'habilidad' },
  { id: 'airhockey', genero: 'deportes' },
  { id: 'cinta', genero: 'reflejos' },
];

// Cada juego, con sus textos en el idioma de la página:
//   titulo, genero, descripcion, controlesVR, controlesEscritorio, controlesTactil
//   etiquetas  -> las del idioma (las 6 primeras se ven en la tarjeta del catálogo)
//   busqueda   -> las del idioma más las originales en español (para el buscador por #)
//   generoId   -> la clave del género (arcade, deportes...), igual en todos los idiomas
export const JUEGOS = LISTA.map(({ id, genero, miniatura = `juegos/${id}/miniatura.svg` }) => {
  const texto = (campo) => t(`juegos.${id}.${campo}`);
  const etiquetas = texto('etiquetas');
  return {
    id,
    generoId: genero,
    genero: t(`generos.${genero}`),
    titulo: texto('titulo'),
    descripcion: texto('descripcion'),
    controlesVR: texto('controlesVR'),
    controlesEscritorio: texto('controlesEscritorio'),
    controlesTactil: texto('controlesTactil'),
    etiquetas,
    busqueda: [...new Set([...etiquetas, ...(tOriginal(`juegos.${id}.etiquetas`) || [])])],
    miniatura,
    modulo: `juegos/${id}/juego.js`,
  };
});
