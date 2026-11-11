// Gancho «reto» (3 s), en pantalla partida: arriba el texto y una cuenta atrás 3-2-1; abajo el momento
// tenso de la partida (desde el segundo `desde`) a cámara lenta, que se congela al llegar a 0 con
// «¿Qué pasa ahora?». La respuesta la da el plano siguiente del vídeo.
import React from 'react';
import { AbsoluteFill, Freeze, interpolate, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { COLORES, FUENTE, contorno, useFuente } from '../Marca.jsx';
import { Efecto, Flash, FondoMarca, Pov, TextoGrande, textoFijo } from './comun.jsx';

const POR_NUMERO = 24;
const CONGELA = POR_NUMERO * 3; // 72: después del «1»
const VELOCIDAD = 0.5;
const MITAD = 860; // alto de la parte de arriba

function Numero({ f, fps }) {
  const i = Math.floor(f / POR_NUMERO);
  if (i > 2) return null;
  const local = f - i * POR_NUMERO;
  const s = spring({ frame: local, fps, config: { damping: 9, stiffness: 260 } });
  const sale = interpolate(local, [POR_NUMERO - 5, POR_NUMERO], [1, 0], { extrapolateLeft: 'clamp' });
  return (
    <div style={{
      position: 'absolute', left: 0, right: 0, top: 400, textAlign: 'center', fontFamily: FUENTE, fontWeight: 900,
      fontSize: 380, lineHeight: 1, color: i === 2 ? COLORES.naranja : '#fff', opacity: sale,
      transform: `scale(${(0.4 + s * 0.6) * (1 + (1 - sale) * 0.4)})`, ...contorno(18),
    }}>
      {3 - i}
    </div>
  );
}

export function GanchoReto({ texto, video, desde = 0, idioma = 'es' }) {
  useFuente();
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const congelado = f >= CONGELA;
  const pregunta = spring({ frame: f - CONGELA, fps, config: { damping: 11, stiffness: 240 } });
  const acercar = congelado ? 1.04 + pregunta * 0.06 : interpolate(f, [0, CONGELA], [1, 1.04]);
  // Barra de progreso de la cuenta atrás, en el borde entre las dos mitades
  const progreso = Math.min(1, f / CONGELA);

  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: COLORES.oscuro }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: 0, height: MITAD, overflow: 'hidden' }}>
        <FondoMarca />
        <TextoGrande texto={texto} top={190} tam={84} />
        <Numero f={f} fps={fps} />
      </div>
      <div style={{ position: 'absolute', left: 0, right: 0, top: MITAD, bottom: 0, overflow: 'hidden' }}>
        <AbsoluteFill style={{ transform: `scale(${acercar})`, filter: congelado ? 'saturate(0.55) contrast(1.1)' : 'none' }}>
          <Freeze frame={CONGELA} active={congelado}>
            <Pov video={video} desde={desde} velocidad={VELOCIDAD} volumen={congelado ? 0 : 0.5} />
          </Freeze>
        </AbsoluteFill>
        {congelado && <AbsoluteFill style={{ background: 'rgba(20,21,28,0.35)' }} />}
      </div>
      <div style={{ position: 'absolute', left: 0, top: MITAD - 8, height: 16, width: `${progreso * 100}%`, background: COLORES.naranja, boxShadow: `0 0 30px ${COLORES.rojo}` }} />
      {congelado && (
        <div style={{
          position: 'absolute', left: 70, right: 70, top: MITAD + 360, textAlign: 'center', fontFamily: FUENTE, fontWeight: 900,
          fontSize: 120, lineHeight: 1.04, color: '#fff', letterSpacing: '-0.02em',
          transform: `scale(${0.5 + pregunta * 0.5}) rotate(${(1 - pregunta) * -6}deg)`, ...contorno(16),
        }}>
          {textoFijo(idioma, 'quePasa')}
        </div>
      )}
      <Flash en={CONGELA} largo={6} />
      {[0, 1, 2].map((i) => <Efecto key={i} nombre="tic" en={i * POR_NUMERO} />)}
      <Efecto nombre="golpe-metal" en={CONGELA} />
    </AbsoluteFill>
  );
}
