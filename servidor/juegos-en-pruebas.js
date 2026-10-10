// GET /api/juegos-en-pruebas → { juegos: ['minigolf', …] }
// Juegos que aún no se publican: están enlazados a una sugerencia que no está
// terminada (nueva, en estudio o en desarrollo). El catálogo y la rotación
// aleatoria los esconden hasta que la sugerencia pasa a "hecha". Un juego que ya
// salió por otra sugerencia (hecha o existe) no se esconde aunque tenga una mejora
// en desarrollo.
import { json, sinBaseDeDatos } from './comun.js';

export async function onRequestGet({ env }) {
  const falta = sinBaseDeDatos(env);
  if (falta) return falta;
  const { results } = await env.DB.prepare(
    `SELECT juego FROM sugerencias WHERE juego != '' GROUP BY juego
     HAVING SUM(estado IN ('hecha', 'existe')) = 0 AND SUM(estado IN ('nueva', 'estudio', 'desarrollo')) > 0`,
  ).all();
  return json({ juegos: results.map((f) => f.juego) });
}
