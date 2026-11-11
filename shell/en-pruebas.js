// Juegos en pruebas: los enlazados a una sugerencia del foro que aún no está hecha
// (ver servidor/juegos-en-pruebas.js) y los marcados con "pruebas: true" en
// juegos/catalogo.js. No salen en el catálogo ni en la rotación aleatoria, pero se
// pueden jugar con su enlace directo (play.html#id), que es lo que usa el panel de
// administración para probarlos.
// Si el servidor no responde (por ejemplo, probando en local) solo se esconden los marcados.
import { JUEGOS } from '../juegos/catalogo.js';

export async function juegosEnPruebas() {
  const marcados = JUEGOS.filter((j) => j.pruebas).map((j) => j.id);
  const control = new AbortController();
  const limite = setTimeout(() => control.abort(), 2500);
  try {
    const r = await fetch('/api/juegos-en-pruebas', { signal: control.signal });
    if (!r.ok) return new Set(marcados);
    const { juegos } = await r.json();
    return new Set([...marcados, ...(Array.isArray(juegos) ? juegos : [])]);
  } catch {
    return new Set(marcados);
  } finally {
    clearTimeout(limite);
  }
}
