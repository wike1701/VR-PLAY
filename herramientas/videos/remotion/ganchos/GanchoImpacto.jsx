// Gancho «impacto» (3 s): el texto cae enorme y de golpe (escala y sacudida) sobre el fondo animado de
// la marca, y la portada del juego (miniatura.svg) se rompe en trozos que salen volando.
import React from 'react';
import { AbsoluteFill, Img, interpolate, random, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { archivo, useFuente } from '../Marca.jsx';
import { Efecto, Flash, FondoMarca, TextoGrande } from './comun.jsx';

const GOLPE = 9; // el texto llega
const ROMPE = 11; // la portada se rompe
const LADO = 640; // tamaño de la portada en pantalla
const TROZOS = 5; // 5×5
const CENTRO_Y = 1280;

function Trozo({ miniatura, fila, col, f, fps }) {
  const lado = LADO / TROZOS;
  const semilla = `trozo-${fila}-${col}`;
  const dx = (col + 0.5) / TROZOS - 0.5 + (random(semilla + 'x') - 0.5) * 0.3;
  const dy = (fila + 0.5) / TROZOS - 0.5 + (random(semilla + 'y') - 0.5) * 0.3;
  const t = Math.max(0, (f - ROMPE) / fps);
  const v = 520 + random(semilla + 'v') * 520;
  const largo = Math.hypot(dx, dy) || 1;
  const x = (dx / largo) * v * t;
  const y = (dy / largo) * v * t - 420 * t + 0.5 * 1500 * t * t;
  const giro = (random(semilla + 'g') - 0.5) * 420 * t;
  const opacidad = interpolate(t, [1.3, 2.1], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{
      position: 'absolute', left: col * lado, top: fila * lado, width: lado, height: lado, overflow: 'hidden', opacity: opacidad,
      transform: `translate(${x}px, ${y}px) rotate(${giro}deg) scale(${1 - Math.min(t, 2) * 0.15})`,
      boxShadow: t > 0 ? '0 10px 30px rgba(0,0,0,0.4)' : 'none',
    }}>
      <Img src={archivo(miniatura)} style={{ position: 'absolute', left: -col * lado, top: -fila * lado, width: LADO, height: LADO }} />
    </div>
  );
}

export function GanchoImpacto({ texto, miniatura }) {
  useFuente();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const llega = spring({ frame: f - GOLPE, fps, config: { damping: 14, stiffness: 420, mass: 0.6 } });
  const escala = f < GOLPE ? 0 : 3.2 - llega * 2.2 + interpolate(f, [GOLPE + 15, 90], [0, 0.07], { extrapolateLeft: 'clamp' });
  const fuerza = interpolate(f, [GOLPE, GOLPE + 18], [46, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  const sx = (random(`sx${f}`) - 0.5) * 2 * fuerza;
  const sy = (random(`sy${f}`) - 0.5) * 2 * fuerza;
  const tiembla = f < ROMPE ? Math.sin(f * 2.2) * f * 0.6 : 0; // la portada tiembla justo antes
  const aparece = spring({ frame: f, fps, config: { damping: 12, stiffness: 200 } });

  return (
    <AbsoluteFill style={{ overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `translate(${sx}px, ${sy}px) scale(1.06)` }}>
        <FondoMarca intensidad={f >= GOLPE && f < GOLPE + 6 ? 1.6 : 1} />
        <div style={{
          position: 'absolute', left: (1080 - LADO) / 2, top: CENTRO_Y - LADO / 2, width: LADO, height: LADO,
          transform: `rotate(${tiembla}deg) scale(${0.6 + aparece * 0.4})`,
        }}>
          {f < ROMPE
            ? <Img src={archivo(miniatura)} style={{ width: LADO, height: LADO, borderRadius: 40, boxShadow: '0 30px 80px rgba(0,0,0,0.5)' }} />
            : Array.from({ length: TROZOS * TROZOS }, (_, i) => (
              <Trozo key={i} miniatura={miniatura} fila={Math.floor(i / TROZOS)} col={i % TROZOS} f={f} fps={fps} />
            ))}
        </div>
        <TextoGrande texto={texto} top={520} tam={150} estilo={{ transform: `scale(${escala})`, opacity: f < GOLPE ? 0 : 1 }} />
      </AbsoluteFill>
      <Flash en={GOLPE} largo={5} />
      <Efecto nombre="whoosh" en={0} volumen={0.6} />
      <Efecto nombre="golpe" en={GOLPE} />
      <Efecto nombre="cristal" en={ROMPE} volumen={0.9} />
    </AbsoluteFill>
  );
}
