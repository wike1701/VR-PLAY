// Juegos en pruebas: los enlazados a una sugerencia del foro que aún no está hecha
// (ver servidor/juegos-en-pruebas.js). No salen en el catálogo ni en la rotación
// aleatoria, pero se pueden jugar con su enlace directo (play.html#id), que es lo
// que usa el panel de administración para probarlos.
// Si el servidor no responde (por ejemplo, probando en local) no se esconde nada.
export async function juegosEnPruebas() {
  const control = new AbortController();
  const limite = setTimeout(() => control.abort(), 2500);
  try {
    const r = await fetch('/api/juegos-en-pruebas', { signal: control.signal });
    if (!r.ok) return new Set();
    const { juegos } = await r.json();
    return new Set(Array.isArray(juegos) ? juegos : []);
  } catch {
    return new Set();
  } finally {
    clearTimeout(limite);
  }
}
