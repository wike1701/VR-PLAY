// TikTok de un juego (1080×1920, 30 fps): gancho (0-3 s), mejores momentos con subtítulos y el
// toque del jugador dibujado, el final de la partida con la puntuación y una tarjeta de cierre.
// Los datos (trozos, textos, rastro del puntero) los prepara lib/montar.mjs.
import React from 'react';
import { AbsoluteFill, Img, interpolate, OffthreadVideo, Sequence, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { archivo, COLORES, FUENTE, Logo, contorno, useFuente } from './Marca.jsx';
import { Frase, ZONA } from './Subtitulos.jsx';

export const FPS = 30;
export const CIERRE = 4; // segundos de la tarjeta final

export function duracionTikTok({ trozos }) {
  return Math.round((trozos.reduce((n, t) => n + t.hasta - t.desde, 0) + CIERRE) * FPS);
}

// La posición del puntero en el segundo t de la partida (rastro: [[t, x, y, pulsado]] ordenado)
function punteroEn(rastro, t) {
  let a = 0;
  let b = rastro.length - 1;
  if (b < 0) return null;
  while (a < b) {
    const m = (a + b) >> 1;
    if (rastro[m][0] < t) a = m + 1; else b = m;
  }
  return rastro[a];
}

function Toque({ rastro, clics, t }) {
  const p = punteroEn(rastro, t);
  if (!p) return null;
  const [, x, y, pulsado] = p;
  const ondas = clics.filter((c) => t >= c.t && t < c.t + 0.45);
  return (
    <>
      {ondas.map((c, i) => {
        const k = (t - c.t) / 0.45;
        return <div key={i} style={{
          position: 'absolute', left: c.x * 1080, top: c.y * 1920, width: 60 + k * 120, height: 60 + k * 120,
          transform: 'translate(-50%,-50%)', borderRadius: '50%', border: `${8 * (1 - k) + 2}px solid #fff`, opacity: 1 - k,
        }} />;
      })}
      <div style={{
        position: 'absolute', left: x * 1080, top: y * 1920, width: pulsado ? 50 : 58, height: pulsado ? 50 : 58,
        transform: 'translate(-50%,-50%)', borderRadius: '50%', background: pulsado ? 'rgba(255,255,255,0.85)' : 'rgba(255,255,255,0.35)',
        border: '5px solid #fff', boxShadow: '0 0 0 3px rgba(20,21,28,0.5), 0 6px 18px rgba(0,0,0,0.4)',
      }} />
    </>
  );
}

// Un trozo de la partida, con un pequeño zoom al entrar (el corte se nota y da ritmo)
function Trozo({ video, trozo, rastro, clics, impactos, children }) {
  const fotograma = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = trozo.desde + fotograma / fps;
  const entrada = interpolate(fotograma, [0, 8], [1.07, 1], { extrapolateRight: 'clamp' });
  const golpe = impactos.some((i) => t >= i && t < i + 0.12) ? 1.015 : 1;
  return (
    <AbsoluteFill style={{ overflow: 'hidden', background: '#000' }}>
      <AbsoluteFill style={{ transform: `scale(${entrada * golpe * (trozo.tipo === 'gancho' ? 1.04 : 1)})` }}>
        <OffthreadVideo src={archivo(video)} startFrom={Math.round(trozo.desde * fps)} endAt={Math.round(trozo.hasta * fps)} />
        <Toque rastro={rastro} clics={clics} t={t} />
      </AbsoluteFill>
      {children}
    </AbsoluteFill>
  );
}

function Gancho({ texto }) {
  const fotograma = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: fotograma, fps, config: { damping: 10, stiffness: 160 } });
  return (
    <div style={{
      position: 'absolute', left: ZONA.izquierda, right: ZONA.izquierda, top: 300, textAlign: 'center',
      fontFamily: FUENTE, fontWeight: 900, fontSize: 112, lineHeight: 1.04, color: '#fff', letterSpacing: '-0.02em',
      transform: `scale(${0.6 + s * 0.4}) rotate(${(1 - s) * -4}deg)`, ...contorno(16),
    }}>
      {texto}
    </div>
  );
}

export function Titulo({ texto }) {
  const fotograma = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: fotograma, fps, config: { damping: 14 } });
  const salida = interpolate(fotograma, [2.4 * fps, 2.8 * fps], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{ position: 'absolute', top: ZONA.arriba + 40, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: salida }}>
      <div style={{
        fontFamily: FUENTE, fontWeight: 900, fontSize: 84, color: '#fff', padding: '18px 44px', borderRadius: 999,
        background: `linear-gradient(135deg, ${COLORES.naranja}, ${COLORES.rojo})`, boxShadow: '0 12px 40px rgba(240,69,42,0.45)',
        transform: `translateY(${(1 - s) * -80}px)`, letterSpacing: '-0.02em', maxWidth: 1080 - 2 * ZONA.izquierda, textAlign: 'center',
      }}>
        {texto}
      </div>
    </div>
  );
}

export function Puntuacion({ etiqueta, texto }) {
  const fotograma = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: fotograma, fps, config: { damping: 9, stiffness: 140 } });
  return (
    <div style={{ position: 'absolute', top: 640, left: ZONA.izquierda, right: ZONA.izquierda, textAlign: 'center', fontFamily: FUENTE, transform: `scale(${s})` }}>
      <div style={{ fontWeight: 800, fontSize: 64, color: '#fff', ...contorno(10) }}>{etiqueta}</div>
      <div style={{ fontWeight: 900, fontSize: 150, color: COLORES.naranja, letterSpacing: '-0.03em', ...contorno(16) }}>{texto}</div>
    </div>
  );
}

export function Cierre({ textos, miniatura }) {
  const fotograma = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = (retraso) => spring({ frame: fotograma - retraso * fps, fps, config: { damping: 13 } });
  const latido = 1 + Math.sin((fotograma / fps) * Math.PI * 2) * 0.025;
  return (
    <AbsoluteFill style={{
      background: `radial-gradient(circle at 50% 30%, #2a2c3a 0%, ${COLORES.oscuro} 65%)`, fontFamily: FUENTE, color: '#fff',
      alignItems: 'center', paddingTop: ZONA.arriba,
    }}>
      <div style={{ transform: `scale(${s(0)})`, marginTop: 30 }}><Logo alto={96} /></div>
      <Img src={archivo(miniatura)} style={{
        width: 640, height: 640 * 0.5625, objectFit: 'cover', borderRadius: 36, marginTop: 70,
        boxShadow: '0 24px 70px rgba(0,0,0,0.6)', transform: `scale(${s(0.15)}) rotate(-2deg)`,
      }} />
      <div style={{ fontWeight: 900, fontSize: 92, marginTop: 60, letterSpacing: '-0.02em', textAlign: 'center', padding: '0 80px', transform: `scale(${s(0.3)})` }}>{textos.titulo}</div>
      {textos.puntuacion && (
        <div style={{ fontWeight: 700, fontSize: 52, marginTop: 14, opacity: 0.85, transform: `scale(${s(0.4)})` }}>{textos.puntuacionEtiqueta}: {textos.puntuacion}</div>
      )}
      <div style={{ fontWeight: 700, fontSize: 54, marginTop: 70, opacity: s(0.55) }}>{textos.juegaGratis}</div>
      <div style={{
        fontWeight: 900, fontSize: 88, marginTop: 14, padding: '20px 54px', borderRadius: 999, letterSpacing: '-0.02em',
        background: `linear-gradient(135deg, ${COLORES.naranja}, ${COLORES.rojo})`, transform: `scale(${s(0.6) * latido})`,
        boxShadow: '0 14px 50px rgba(240,69,42,0.5)',
      }}>{textos.dominio}</div>
      <div style={{ fontWeight: 600, fontSize: 44, marginTop: 40, opacity: s(0.8) * 0.85, textAlign: 'center', padding: '0 90px' }}>{textos.ventajas}</div>
    </AbsoluteFill>
  );
}

// Reparte las frases entre los momentos, como mucho una nueva cada ~2 s
function frasesDeMomentos(trozos, frases, fps) {
  const lista = [];
  let inicio = 0;
  let i = 0;
  for (const tr of trozos) {
    const largo = tr.hasta - tr.desde;
    if (tr.tipo === 'momento' && i < frases.length) {
      const n = Math.min(Math.max(1, Math.floor(largo / 2)), frases.length - i);
      const paso = largo / n;
      for (let k = 0; k < n; k++) lista.push({ texto: frases[i++], desde: Math.round((inicio + k * paso) * fps), largo: Math.round(paso * fps) });
    }
    inicio += largo;
  }
  return lista;
}

export function TikTokJuego({ video, trozos, textos, miniatura, rastro, clics, impactos, puntuacionT }) {
  useFuente();
  const { fps } = useVideoConfig();
  let inicio = 0;
  const secuencias = trozos.map((tr) => {
    const desde = Math.round(inicio * fps);
    inicio += tr.hasta - tr.desde;
    return { tr, desde, largo: Math.round((tr.hasta - tr.desde) * fps) };
  });
  const primerMomento = secuencias.find((s) => s.tr.tipo === 'momento');
  const final = secuencias.find((s) => s.tr.tipo === 'final');
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {secuencias.map(({ tr, desde, largo }, i) => (
        <Sequence key={i} from={desde} durationInFrames={largo}>
          <Trozo video={video} trozo={tr} rastro={rastro} clics={clics} impactos={impactos}>
            {tr.tipo === 'gancho' && <Gancho texto={textos.gancho} />}
          </Trozo>
        </Sequence>
      ))}
      {primerMomento && (
        <Sequence from={primerMomento.desde} durationInFrames={Math.round(3 * fps)}>
          <Titulo texto={textos.titulo} />
        </Sequence>
      )}
      {frasesDeMomentos(trozos, textos.frases, fps).map((f, i) => (
        <Sequence key={'f' + i} from={f.desde} durationInFrames={f.largo}>
          <Frase texto={f.texto} />
        </Sequence>
      ))}
      {final && textos.puntuacion && puntuacionT != null && (
        <Sequence from={final.desde + Math.max(0, Math.round((puntuacionT - final.tr.desde) * fps))} durationInFrames={final.largo}>
          <Puntuacion etiqueta={textos.puntuacionEtiqueta} texto={textos.puntuacion} />
        </Sequence>
      )}
      <Sequence from={Math.round(inicio * fps)} durationInFrames={CIERRE * fps}>
        <Cierre textos={textos} miniatura={miniatura} />
      </Sequence>
      <Sequence durationInFrames={Math.round(inicio * fps)}>
        <div style={{ position: 'absolute', top: ZONA.arriba - 90, left: ZONA.izquierda, opacity: 0.9 }}><Logo alto={52} /></div>
      </Sequence>
    </AbsoluteFill>
  );
}
