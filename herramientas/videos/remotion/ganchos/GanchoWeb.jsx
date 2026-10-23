// Gancho «web» (3 s): una ventana de navegador en la que se escribe vrplaygame.com letra a letra,
// con la pregunta grande encima. Al pulsar Intro, la ventana crece hasta llenar la pantalla y dentro
// ya se ve la partida (el POV desde el segundo `desde`).
import React from 'react';
import { AbsoluteFill, Easing, interpolate, Sequence, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORES, FUENTE, Logo, useFuente } from '../Marca.jsx';
import { Efecto, FondoMarca, Pov, TextoGrande } from './comun.jsx';

const DIRECCION = 'vrplaygame.com';
const EMPIEZA = 12; // primer fotograma en el que se escribe
const POR_LETRA = 3;
const INTRO = EMPIEZA + DIRECCION.length * POR_LETRA + 6; // 60
const ANCHO = 920;
const BARRA = 120; // alto de la barra del navegador
const CONTENIDO = 960;

export function GanchoWeb({ texto, video, desde = 0 }) {
  useFuente();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const entrada = spring({ frame: f, fps, config: { damping: 13, stiffness: 170 } });
  const letras = Math.max(0, Math.min(DIRECCION.length, Math.floor((f - EMPIEZA) / POR_LETRA) + 1));
  const cursor = f < INTRO && Math.floor(f / 8) % 2 === 0;
  // Al Intro: la ventana crece con aceleración hasta que el contenido tapa toda la pantalla
  const zoom = interpolate(f, [INTRO, INTRO + 16], [1, 2.4], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp', easing: Easing.in(Easing.cubic) });
  const tecla = f >= INTRO && f < INTRO + 4;
  const salidaTexto = interpolate(f, [INTRO, INTRO + 8], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const alto = BARRA + CONTENIDO;
  const top = 1920 - alto - 190;

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <FondoMarca />
      <div style={{
        position: 'absolute', left: (1080 - ANCHO) / 2, top, width: ANCHO, height: alto, borderRadius: 34, overflow: 'hidden',
        background: '#1e2029', boxShadow: '0 40px 90px rgba(0,0,0,0.55), 0 0 0 2px rgba(255,255,255,0.08)',
        transformOrigin: `50% ${((BARRA + CONTENIDO / 2) / alto) * 100}%`,
        transform: `translateY(${(1 - entrada) * 420 + (960 - (top + BARRA + CONTENIDO / 2)) * (zoom - 1) / 1.4}px) scale(${(0.85 + entrada * 0.15) * zoom})`,
      }}>
        {/* Barra: los tres botones y la barra de direcciones */}
        <div style={{ height: BARRA, display: 'flex', alignItems: 'center', gap: 22, padding: '0 30px', background: '#2a2c37' }}>
          <div style={{ display: 'flex', gap: 12 }}>
            {['#ff5f57', '#febc2e', '#28c840'].map((c) => <div key={c} style={{ width: 22, height: 22, borderRadius: 11, background: c }} />)}
          </div>
          <div style={{
            flex: 1, height: 74, borderRadius: 37, background: tecla ? '#3b3e4d' : '#14151c', display: 'flex', alignItems: 'center',
            padding: '0 30px', gap: 16, fontFamily: FUENTE, fontWeight: 600, fontSize: 44, color: '#fff',
            boxShadow: f >= EMPIEZA - 4 && f < INTRO + 2 ? `0 0 0 4px ${COLORES.naranja}` : 'none',
          }}>
            <svg width="30" height="34" viewBox="0 0 30 34"><rect x="3" y="14" width="24" height="18" rx="4" fill="#9aa0b4" /><path d="M8 14V10a7 7 0 0 1 14 0v4" stroke="#9aa0b4" strokeWidth="4" fill="none" /></svg>
            <span>{DIRECCION.slice(0, letras)}<span style={{ opacity: cursor ? 1 : 0, color: COLORES.naranja, marginLeft: 2 }}>|</span></span>
          </div>
        </div>
        {/* Contenido: la página en blanco con el logo y, después del Intro, la partida */}
        <div style={{ position: 'relative', height: CONTENIDO, background: COLORES.oscuro, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
          <div style={{ opacity: 0.35 }}><Logo alto={120} /></div>
          <Sequence from={INTRO} layout="absolute-fill">
            <Pov video={video} desde={desde} />
          </Sequence>
        </div>
      </div>
      <TextoGrande texto={texto} top={230} tam={100} estilo={{
        opacity: salidaTexto, transform: `scale(${0.7 + entrada * 0.3}) translateY(${(1 - salidaTexto) * -60}px)`,
      }} />
      {Array.from({ length: DIRECCION.length }, (_, i) => <Efecto key={i} nombre="tecla" en={EMPIEZA + i * POR_LETRA} volumen={0.45} />)}
      <Efecto nombre="intro" en={INTRO} volumen={0.8} />
      <Efecto nombre="whoosh" en={INTRO + 2} volumen={0.8} />
    </AbsoluteFill>
  );
}
