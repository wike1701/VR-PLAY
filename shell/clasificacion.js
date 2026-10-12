// Clasificaciones en el navegador (ver servidor/clasificacion.js y juegos/marcadores.js).
// - formatearValor(juego, valor): «1.234 puntos», «1:23.45», «31 golpes», «+8».
// - pedirClasificacion(juego, { periodo, limite }): el top y tu puesto.
// - abrirPartida / enviarPuntuacion: lo usa la shell para ctx.puntuacion(valor).
import { t, idioma } from '../idiomas/idiomas.js';
import { MARCADORES } from '../juegos/marcadores.js';

const numero = new Intl.NumberFormat(idioma);
const decimas = (enteros) => new Intl.NumberFormat(idioma, { minimumIntegerDigits: enteros, minimumFractionDigits: 2, maximumFractionDigits: 2 });

export function formatearValor(juego, valor) {
  const m = MARCADORES[juego];
  if (!m || valor === null || valor === undefined) return '';
  if (m.unidad === 'tiempo') {
    // 41,24 s · 1:05,30 (con el separador decimal de cada idioma)
    const min = Math.floor(valor / 60);
    const seg = valor - min * 60;
    return min ? `${min}:${decimas(2).format(seg)}` : `${decimas(1).format(seg)} s`;
  }
  if (m.unidad === 'diferencia') return `+${numero.format(valor)}`;
  return t(`clasificacion.unidades.${m.unidad}`, { n: valor, cifra: numero.format(valor) });
}

export async function pedirClasificacion(juego, { periodo = 'siempre', limite = 100 } = {}) {
  try {
    const r = await fetch(`/api/clasificacion/${encodeURIComponent(juego)}?periodo=${periodo}&limite=${limite}`);
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}

// ¿Hay sesión en este navegador? (lo apunta shell/cuenta.js al cargar el catálogo, el foro o entrar)
export function hayCuenta() {
  try { return !!localStorage.getItem('vrplay:cuenta'); } catch { return false; }
}

// Abre una partida en el servidor (solo con sesión). Devuelve una promesa con el token, o null.
export function abrirPartida(juego) {
  if (!hayCuenta() || !MARCADORES[juego]) return null;
  return fetch(`/api/clasificacion/${encodeURIComponent(juego)}/empezar`, { method: 'POST' })
    .then((r) => (r.ok ? r.json() : null))
    .then((d) => d?.partida || null)
    .catch(() => null);
}

// Envía el resultado de una partida. Devuelve { guardada, nuevoRecord, puesto, … }, { sinCuenta: true } o null.
export async function enviarPuntuacion(juego, partida, valor) {
  const token = await partida;
  if (!token) return hayCuenta() ? null : { sinCuenta: true };
  try {
    const r = await fetch(`/api/clasificacion/${encodeURIComponent(juego)}`, {
      method: 'POST',
      headers: { 'content-type': 'application/json' },
      body: JSON.stringify({ partida: token, valor }),
    });
    return r.ok ? await r.json() : null;
  } catch {
    return null;
  }
}
