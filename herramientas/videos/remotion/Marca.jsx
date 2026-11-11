// Marca de VR Play en los vídeos: la fuente Geist de la web, los colores y el logo.
// Todas las rutas son relativas a trabajo/, que lib/render.mjs sirve en local (inputProps.base): así
// Remotion no copia las grabaciones en cada paquete. trabajo/marca/ lo copia de la web lib/render.mjs.
import React from 'react';
import { continueRender, delayRender, getInputProps, Img, staticFile } from 'remotion';

export const archivo = (ruta) => {
  const base = getInputProps().base;
  return base ? `${base}/${ruta.split('/').map(encodeURIComponent).join('/')}` : staticFile(ruta);
};

export const COLORES = { naranja: '#ff8a62', rojo: '#f0452a', oscuro: '#14151c', claro: '#fff6f1' };
export const FUENTE = 'Geist, system-ui, sans-serif';

// Cargar Geist antes del primer fotograma
let cargada = null;
export function useFuente() {
  if (!cargada && typeof document !== 'undefined') {
    const espera = delayRender('Fuente Geist');
    const fuente = new FontFace('Geist', `url(${archivo('marca/Geist-Variable.woff2')}) format('woff2')`, { weight: '100 900' });
    cargada = fuente.load().then((f) => { document.fonts.add(f); continueRender(espera); }, () => continueRender(espera));
  }
}

// Texto grande con contorno, legible sobre cualquier fondo de juego
export const contorno = (grosor = 10, color = COLORES.oscuro) => ({
  WebkitTextStroke: `${grosor}px ${color}`,
  paintOrder: 'stroke fill',
  textShadow: `0 ${grosor / 2}px ${grosor * 2}px rgba(0,0,0,0.45)`,
});

export function Logo({ alto = 64, conNombre = true, color = '#fff' }) {
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: alto * 0.3 }}>
      <Img src={archivo('marca/favicon.svg')} style={{ height: alto, width: alto }} />
      {conNombre && <span style={{ fontFamily: FUENTE, fontWeight: 800, fontSize: alto * 0.62, color, letterSpacing: '-0.02em' }}>VR Play</span>}
    </div>
  );
}
