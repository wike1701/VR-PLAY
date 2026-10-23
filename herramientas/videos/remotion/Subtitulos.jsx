// Subtítulos grandes: una frase entera que entra con un pequeño salto (vídeos de juegos) o palabra
// a palabra con la palabra que suena resaltada (vídeos hablados). Siempre en la zona segura de
// TikTok/Reels/Shorts: ni arriba (pestañas), ni abajo (texto de la publicación), ni a la derecha (botones).
import React from 'react';
import { interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORES, FUENTE, contorno } from './Marca.jsx';

export const ZONA = { izquierda: 70, derecha: 170, arriba: 250, abajo: 520 }; // márgenes en px (1080×1920)

export function Frase({ texto, y = 1220, tam = 76, color = '#fff' }) {
  const fotograma = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: fotograma, fps, config: { damping: 12, stiffness: 180 } });
  return (
    <div style={{
      position: 'absolute', left: ZONA.izquierda, right: ZONA.derecha, top: y, textAlign: 'center',
      fontFamily: FUENTE, fontWeight: 800, fontSize: tam, lineHeight: 1.12, color, letterSpacing: '-0.01em',
      transform: `translateY(${(1 - s) * 40}px) scale(${0.9 + s * 0.1})`, opacity: Math.min(1, s * 1.5), ...contorno(12),
    }}>
      {texto}
    </div>
  );
}

// palabras: [{ texto, desde, hasta }] en segundos desde el principio del clip
export function agruparPalabras(palabras, { maxPalabras = 3, maxLetras = 16 } = {}) {
  const grupos = [];
  let actual = [];
  for (const p of palabras) {
    const largo = actual.reduce((n, x) => n + x.texto.length + 1, 0) + p.texto.length;
    const pausa = actual.length && p.desde - actual[actual.length - 1].hasta > 0.35;
    if (actual.length && (actual.length >= maxPalabras || largo > maxLetras || pausa || /[.!?…]$/.test(actual[actual.length - 1].texto))) {
      grupos.push(actual);
      actual = [];
    }
    actual.push(p);
  }
  if (actual.length) grupos.push(actual);
  return grupos.map((g, i) => ({
    palabras: g,
    desde: g[0].desde,
    // Se queda en pantalla hasta que empieza el siguiente grupo (sin parpadeos entre medias)
    hasta: Math.max(g[g.length - 1].hasta, Math.min(grupos[i + 1]?.[0].desde ?? Infinity, g[g.length - 1].hasta + 0.6)),
  }));
}

export function PalabraAPalabra({ grupos, y = 1150, tam = 96 }) {
  const fotograma = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = fotograma / fps;
  const grupo = grupos.find((g) => t >= g.desde && t < g.hasta);
  if (!grupo) return null;
  const entrada = spring({ frame: Math.round((t - grupo.desde) * fps), fps, config: { damping: 14, stiffness: 220 } });
  return (
    <div style={{
      position: 'absolute', left: ZONA.izquierda, right: ZONA.derecha - 60, top: y, textAlign: 'center',
      fontFamily: FUENTE, fontWeight: 850, fontSize: tam, lineHeight: 1.1, textTransform: 'uppercase',
      transform: `scale(${0.85 + entrada * 0.15})`,
    }}>
      {grupo.palabras.map((p, i) => {
        const activa = t >= p.desde && t < (grupo.palabras[i + 1]?.desde ?? grupo.hasta);
        const salto = activa ? interpolate(t - p.desde, [0, 0.08, 0.2], [1, 1.12, 1.06], { extrapolateRight: 'clamp' }) : 1;
        return (
          <span key={i} style={{
            display: 'inline-block', margin: '0 0.12em', color: activa ? COLORES.naranja : '#fff',
            transform: `scale(${salto})`, ...contorno(14),
          }}>
            {p.texto}
          </span>
        );
      })}
    </div>
  );
}
