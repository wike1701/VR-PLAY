// Gancho «persona» (3 s): un vídeo de archivo de alguien con gafas VR (medios/personas/) y, en el
// segundo 1,8, un flash que corta a lo que se ve dentro: la partida. El texto describe lo que se ve,
// nunca dice que esa persona juegue a VR Play ni lo recomiende (licencia de Pexels, medios/LEEME.md).
import React from 'react';
import { AbsoluteFill, interpolate, OffthreadVideo, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { archivo, FUENTE, contorno, useFuente } from '../Marca.jsx';
import { Efecto, Flash, Pov, TextoGrande, textoFijo } from './comun.jsx';

const CORTE = 54; // 1,8 s

export function GanchoPersona({ texto, video, desde = 0, videoPersona, desdePersona = 1, idioma = 'es' }) {
  useFuente();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const acercar = interpolate(f, [0, CORTE], [1.02, 1.12], { extrapolateRight: 'clamp' });
  const entradaPov = interpolate(f, [CORTE, CORTE + 10], [1.18, 1.04], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const etiqueta = interpolate(f, [18, 26, CORTE - 4, CORTE], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });

  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#000' }}>
      <Sequence durationInFrames={CORTE} layout="absolute-fill">
        <AbsoluteFill style={{ transform: `scale(${acercar})` }}>
          <OffthreadVideo src={archivo(videoPersona)} startFrom={Math.round(desdePersona * fps)} muted
            style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
        </AbsoluteFill>
        <AbsoluteFill style={{ background: 'linear-gradient(180deg, rgba(20,21,28,0.55) 0, transparent 35%, transparent 70%, rgba(20,21,28,0.5) 100%)' }} />
      </Sequence>
      <Sequence from={CORTE} layout="absolute-fill">
        <AbsoluteFill style={{ transform: `scale(${entradaPov})` }}>
          <Pov video={video} desde={desde} />
        </AbsoluteFill>
      </Sequence>
      <TextoGrande texto={texto} top={280} tam={108} />
      <div style={{
        position: 'absolute', left: 70, right: 170, top: 1260, textAlign: 'center', opacity: etiqueta,
        transform: `translateY(${(1 - etiqueta) * 30}px)`,
        fontFamily: FUENTE, fontWeight: 800, fontSize: 70, color: '#fff', ...contorno(12),
      }}>
        {textoFijo(idioma, 'queVe')}
      </div>
      <Flash en={CORTE} />
      <Efecto nombre="whoosh" en={CORTE - 8} volumen={0.7} />
      <Efecto nombre="glitch" en={CORTE} volumen={0.8} />
    </AbsoluteFill>
  );
}
