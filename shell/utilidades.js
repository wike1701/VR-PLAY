import * as THREE from 'three';

// Libera de la memoria de la GPU todo lo que cuelga de un objeto:
// geometrías, materiales y texturas.
export function liberarObjeto(raiz) {
  raiz.traverse((obj) => liberarRecurso(obj));
}

export function liberarRecurso(obj) {
  if (!obj) return;
  if (obj.isBufferGeometry || obj.isTexture) {
    obj.dispose();
    return;
  }
  if (obj.isMaterial) {
    for (const valor of Object.values(obj)) {
      if (valor && valor.isTexture) valor.dispose();
    }
    obj.dispose();
    return;
  }
  if (obj.geometry) obj.geometry.dispose();
  if (obj.material) {
    const materiales = Array.isArray(obj.material) ? obj.material : [obj.material];
    for (const m of materiales) liberarRecurso(m);
  }
}

// Panel de texto en 3D (un plano con un canvas como textura).
// Sirve para marcadores, avisos y etiquetas dentro de la escena VR.
export function crearPanel({
  ancho = 1,
  alto = 0.3,
  resolucion = 512,
  fondo = 'rgba(12, 14, 28, 0.82)',
  borde = 'rgba(124, 92, 255, 0.9)',
} = {}) {
  const canvas = document.createElement('canvas');
  canvas.width = resolucion;
  canvas.height = Math.round((resolucion * alto) / ancho);
  const g = canvas.getContext('2d');

  const textura = new THREE.CanvasTexture(canvas);
  textura.colorSpace = THREE.SRGBColorSpace;
  const material = new THREE.MeshBasicMaterial({ map: textura, transparent: true, depthWrite: false });
  const mesh = new THREE.Mesh(new THREE.PlaneGeometry(ancho, alto), material);

  let anterior = '';

  // lineas: ['texto', { texto, tam, color }]. "tam" es el alto relativo de la línea.
  function escribir(lineas) {
    const clave = JSON.stringify(lineas);
    if (clave === anterior) return;
    anterior = clave;

    const w = canvas.width;
    const h = canvas.height;
    g.clearRect(0, 0, w, h);

    if (fondo) {
      const r = Math.min(w, h) * 0.18;
      const m = 4;
      g.beginPath();
      g.moveTo(m + r, m);
      g.lineTo(w - m - r, m);
      g.quadraticCurveTo(w - m, m, w - m, m + r);
      g.lineTo(w - m, h - m - r);
      g.quadraticCurveTo(w - m, h - m, w - m - r, h - m);
      g.lineTo(m + r, h - m);
      g.quadraticCurveTo(m, h - m, m, h - m - r);
      g.lineTo(m, m + r);
      g.quadraticCurveTo(m, m, m + r, m);
      g.closePath();
      g.fillStyle = fondo;
      g.fill();
      if (borde) {
        g.lineWidth = 4;
        g.strokeStyle = borde;
        g.stroke();
      }
    }

    const items = lineas.map((l) => (typeof l === 'string' ? { texto: l } : l));
    const total = items.reduce((suma, l) => suma + (l.tam || 1), 0);
    const unidad = (h * 0.84) / total;
    let y = h * 0.08;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (const l of items) {
      const altoLinea = unidad * (l.tam || 1);
      g.font = `${l.peso || 'bold'} ${Math.round(altoLinea * 0.7)}px system-ui, -apple-system, "Segoe UI", Roboto, sans-serif`;
      g.fillStyle = l.color || '#ffffff';
      g.fillText(l.texto, w / 2, y + altoLinea / 2, w * 0.92);
      y += altoLinea;
    }
    textura.needsUpdate = true;
  }

  return { mesh, escribir };
}
