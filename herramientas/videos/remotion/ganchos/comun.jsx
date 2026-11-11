// Piezas que comparten los ganchos: fondo animado de la marca, el POV de la partida, los efectos de
// sonido (efectos/, ver efectos/LEEME.md) y los pocos textos fijos, en ES y EN como lib/textos.mjs.
import React from 'react';
import { AbsoluteFill, Audio, interpolate, OffthreadVideo, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { archivo, COLORES, FUENTE, contorno } from '../Marca.jsx';
import { ZONA } from '../Subtitulos.jsx';

export const DURACION_GANCHO = 90; // 3 s a 30 fps

const TEXTOS = {
  es: { queVe: 'Esto es lo que ve 👇', quePasa: '¿Qué pasa ahora?' },
  en: { queVe: "This is what they see 👇", quePasa: 'What happens next?' },
};
export const textoFijo = (idioma, clave) => (TEXTOS[idioma] || TEXTOS.en)[clave];

// Un efecto de sonido que suena en el fotograma `en` (nombre de efectos/, sin extensión)
export function Efecto({ nombre, en = 0, volumen = 1 }) {
  return (
    <Sequence from={en} durationInFrames={45} layout="none">
      <Audio src={archivo(`efectos/${nombre}.ogg`)} volume={volumen} />
    </Sequence>
  );
}

// Fondo oscuro con manchas naranja y roja que se mueven y rayas diagonales que avanzan
export function FondoMarca({ intensidad = 1 }) {
  const f = useCurrentFrame();
  const a = f / 30;
  const x1 = 30 + Math.sin(a * 1.3) * 18;
  const y1 = 28 + Math.cos(a * 0.9) * 10;
  const x2 = 70 + Math.cos(a * 1.1) * 18;
  const y2 = 72 + Math.sin(a * 1.4) * 10;
  return (
    <AbsoluteFill style={{
      background: `radial-gradient(circle at ${x1}% ${y1}%, ${COLORES.naranja}${Math.round(0x88 * intensidad).toString(16).padStart(2, '0')} 0, transparent 45%),
        radial-gradient(circle at ${x2}% ${y2}%, ${COLORES.rojo}${Math.round(0x99 * intensidad).toString(16).padStart(2, '0')} 0, transparent 50%), ${COLORES.oscuro}`,
    }}>
      <AbsoluteFill style={{
        opacity: 0.07 * intensidad,
        backgroundImage: `repeating-linear-gradient(-30deg, #fff 0 40px, transparent 40px 120px)`,
        backgroundPosition: `${f * 6}px 0`,
      }} />
    </AbsoluteFill>
  );
}

// La partida grabada desde el segundo `desde`; `velocidad` < 1 es cámara lenta
export function Pov({ video, desde = 0, velocidad = 1, volumen = 0.7, estilo }) {
  const { fps } = useVideoConfig();
  return (
    <OffthreadVideo
      src={archivo(video)} startFrom={Math.round(desde * fps)} playbackRate={velocidad} volume={volumen}
      style={{ width: '100%', height: '100%', objectFit: 'cover', ...estilo }}
    />
  );
}

// Texto grande del gancho, arriba y en la zona segura
export function TextoGrande({ texto, top = 300, tam = 112, estilo }) {
  return (
    <div style={{
      position: 'absolute', left: ZONA.izquierda, right: ZONA.izquierda, top, textAlign: 'center',
      fontFamily: FUENTE, fontWeight: 900, fontSize: tam, lineHeight: 1.04, color: '#fff', letterSpacing: '-0.02em',
      ...contorno(16), ...estilo,
    }}>
      {texto}
    </div>
  );
}

// Destello blanco que empieza en el fotograma `en` y se apaga en `largo` fotogramas
export function Flash({ en, largo = 7 }) {
  const f = useCurrentFrame();
  const o = interpolate(f, [en, en + 1, en + largo], [0, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return o > 0 ? <AbsoluteFill style={{ background: '#fff', opacity: o }} /> : null;
}
