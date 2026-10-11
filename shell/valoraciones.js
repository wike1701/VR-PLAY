// Favoritos y "me gusta" de los juegos. Lo usan el menú de pausa (shell) y el catálogo.
// - Favoritos: solo en este navegador (localStorage).
// - Me gusta: se cuentan en el servidor (servidor/juegos-me-gusta.js) con el mismo
//   identificador anónimo del navegador que el foro, y se recuerdan aquí también para
//   saber cuáles has marcado (y para que funcione sin conexión o en local).

const CLAVE_FAVORITOS = 'vrplay:favoritos';
const CLAVE_ME_GUSTA = 'vrplay:megusta';

function leerLista(clave) {
  try {
    const v = JSON.parse(localStorage.getItem(clave) || '[]');
    return new Set(Array.isArray(v) ? v : []);
  } catch {
    return new Set();
  }
}
function guardarLista(clave, conjunto) {
  try { localStorage.setItem(clave, JSON.stringify([...conjunto])); } catch { /* sin almacenamiento */ }
}

function votante() {
  try {
    let v = localStorage.getItem('vrplay:votante');
    if (!v) {
      v = crypto.randomUUID();
      localStorage.setItem('vrplay:votante', v);
    }
    return v;
  } catch {
    return '';
  }
}

export const favoritos = () => leerLista(CLAVE_FAVORITOS);
export const esFavorito = (id) => leerLista(CLAVE_FAVORITOS).has(id);
export function alternarFavorito(id) {
  const lista = leerLista(CLAVE_FAVORITOS);
  if (lista.has(id)) lista.delete(id);
  else lista.add(id);
  guardarLista(CLAVE_FAVORITOS, lista);
  return lista.has(id);
}

export const meGustaMios = () => leerLista(CLAVE_ME_GUSTA);
export const leGusta = (id) => leerLista(CLAVE_ME_GUSTA).has(id);

// Pone o quita el "me gusta". Devuelve { meGusta, total } (total = null si no hay servidor).
export async function alternarMeGusta(id) {
  const lista = leerLista(CLAVE_ME_GUSTA);
  let meGusta = !lista.has(id);
  let total = null;
  const quien = votante();
  if (quien) {
    try {
      const r = await fetch(`/api/juegos/${encodeURIComponent(id)}/me-gusta`, {
        method: 'POST',
        headers: { 'content-type': 'application/json' },
        body: JSON.stringify({ votante: quien }),
      });
      if (r.ok) ({ meGusta, total } = await r.json());
    } catch { /* sin servidor: solo se guarda aquí */ }
  }
  if (meGusta) lista.add(id);
  else lista.delete(id);
  guardarLista(CLAVE_ME_GUSTA, lista);
  return { meGusta, total };
}

// Recuento de "me gusta" de todos los juegos: { topos: 3, … } (vacío si no hay servidor)
export async function totalesMeGusta() {
  try {
    const r = await fetch('/api/juegos/me-gusta');
    if (!r.ok) return {};
    return (await r.json()).totales || {};
  } catch {
    return {};
  }
}
