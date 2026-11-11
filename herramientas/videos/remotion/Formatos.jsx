// Formatos de varios juegos (1080×1920, 30 fps): anuncio, top, reto, duelo y foro. La línea de
// tiempo (el «plan») la hace lib/formatos.mjs con partidas ya grabadas; aquí solo se dibuja:
//   escenas  lo que se ve, una detrás de otra: clip (un trozo de partida), ranking (puesto del top),
//            duelo (dos juegos en pantalla partida), foro (la sugerencia que pidió el juego),
//            rafaga (fotos rápidas de varios juegos) y cierre (logo y vrplaygame.com)
//   textos   rótulos grandes encima (el gancho y las frases), con palabras en caja de color
//   efectos  sonidos en un instante (whoosh en los cortes, golpe en los rótulos)
//   musica   la pista de fondo (se baja sola al final)
// Todos los tiempos (en, dura, desde) en segundos. Rutas de vídeo y sonido relativas a trabajo/.
import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, OffthreadVideo, Sequence, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { archivo, COLORES, FUENTE, Logo, contorno, useFuente } from './Marca.jsx';
import { ZONA } from './Subtitulos.jsx';
import { Cierre } from './TikTokJuego.jsx';

export const FPS = 30;

function Clip({ video, desde, velocidad = 1, posicion = '50% 50%' }) {
  const { fps } = useVideoConfig();
  return (
    <OffthreadVideo src={archivo(video)} startFrom={Math.round(desde * fps)} playbackRate={velocidad} muted
      style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: posicion }} />
  );
}

// Entrada con golpe de zoom que se asienta y un temblor corto: cada corte se nota
function Entrada({ children, fuerza = 0.12 }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  return (
    <AbsoluteFill style={{
      scale: interpolate(f, [0, 0.25 * fps], [1 + fuerza, 1], { extrapolateRight: 'clamp' }) + f / fps * 0.025,
      translate: `${Math.sin(f * 2.1) * Math.max(0, 8 - f) * 1.5}px ${Math.cos(f * 1.7) * Math.max(0, 8 - f) * 1.5}px`,
    }}>
      {children}
    </AbsoluteFill>
  );
}

// Destello blanco de los primeros fotogramas de un corte
function Destello({ fuerza = 0.55 }) {
  const f = useCurrentFrame();
  return <AbsoluteFill style={{ background: '#fff', opacity: interpolate(f, [0, 4], [fuerza, 0], { extrapolateRight: 'clamp' }) }} />;
}

// Viñeta y degradado arriba: el texto se lee sobre cualquier juego
const Sombra = () => (
  <AbsoluteFill style={{
    background: 'radial-gradient(ellipse at 50% 55%, rgba(0,0,0,0) 45%, rgba(0,0,0,0.5) 100%), linear-gradient(180deg, rgba(10,10,18,0.55) 0%, rgba(10,10,18,0) 45%)',
  }} />
);

// La etiqueta con el nombre del juego
function Chip({ texto, y = 1330 }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - 2, fps, config: { damping: 13 } });
  return (
    <div style={{ position: 'absolute', top: y, left: 0, right: 0, display: 'flex', justifyContent: 'center', opacity: Math.min(1, s * 1.4), translate: `0px ${(1 - s) * 50}px` }}>
      <div style={{
        fontFamily: FUENTE, fontWeight: 800, fontSize: 58, color: '#fff', padding: '18px 44px', borderRadius: 999,
        background: 'rgba(20,21,28,0.78)', border: `5px solid ${COLORES.naranja}`, letterSpacing: '-0.01em',
      }}>{texto}</div>
    </div>
  );
}

// ─── Escenas ───────────────────────────────────────────────────────────
function EscenaClip({ e }) {
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Entrada fuerza={e.golpe === false ? 0.04 : 0.14}><Clip video={e.video} desde={e.desde} velocidad={e.velocidad} /></Entrada>
      <Sombra />
      {e.oscuro && <AbsoluteFill style={{ background: 'rgba(8,8,14,0.72)' }} />}
      {e.chip && <Chip texto={e.chip} />}
      {e.golpe !== false && <Destello fuerza={e.destello ?? 0.5} />}
    </AbsoluteFill>
  );
}

function EscenaRanking({ e }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const numero = spring({ frame: f, fps, config: { damping: 9, stiffness: 160 } });
  const tarjeta = spring({ frame: f - 0.2 * fps, fps, config: { damping: 14 } });
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Entrada><Clip video={e.video} desde={e.desde} /></Entrada>
      <Sombra />
      <div style={{
        position: 'absolute', top: ZONA.arriba + 30, left: ZONA.izquierda, fontFamily: FUENTE, fontWeight: 900, fontSize: 300, lineHeight: 1,
        color: COLORES.naranja, scale: numero, rotate: `${(1 - numero) * -25}deg`, ...contorno(16), letterSpacing: '-0.05em',
      }}>#{e.puesto}</div>
      <div style={{ position: 'absolute', top: ZONA.arriba + 360, left: ZONA.izquierda, right: ZONA.derecha, translate: `${(1 - tarjeta) * -700}px 0px` }}>
        <div style={{ fontFamily: FUENTE, fontWeight: 900, fontSize: 96, color: '#fff', lineHeight: 1.02, letterSpacing: '-0.02em', ...contorno(12) }}>{e.titulo}</div>
        {e.dato && <div style={{ fontFamily: FUENTE, fontWeight: 700, fontSize: 52, color: COLORES.claro, marginTop: 18, ...contorno(8) }}>{e.dato}</div>}
      </div>
      <Destello />
    </AbsoluteFill>
  );
}

function EscenaDuelo({ e }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const vs = spring({ frame: f - 0.3 * fps, fps, config: { damping: 8, stiffness: 200 } });
  const mitad = (lado, i) => (
    <div style={{ position: 'absolute', left: 0, width: 1080, top: i ? 962 : 0, height: 958, overflow: 'hidden' }}>
      <Clip video={lado.video} desde={lado.desde} />
      <div style={{
        position: 'absolute', [i ? 'bottom' : 'top']: i ? 560 : ZONA.arriba - 40, left: 0, right: 0, textAlign: 'center',
        fontFamily: FUENTE, fontWeight: 900, fontSize: 76, color: '#fff', ...contorno(12),
      }}>{i ? '2️⃣' : '1️⃣'} {lado.titulo}</div>
    </div>
  );
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {mitad(e.a, 0)}
      {mitad(e.b, 1)}
      <div style={{ position: 'absolute', top: 954, left: 0, width: 1080, height: 12, background: `linear-gradient(90deg, ${COLORES.naranja}, ${COLORES.rojo})` }} />
      <div style={{
        position: 'absolute', top: 960 - 110, left: 540 - 110, width: 220, height: 220, borderRadius: 999, display: 'flex', alignItems: 'center', justifyContent: 'center',
        background: `linear-gradient(135deg, ${COLORES.naranja}, ${COLORES.rojo})`, fontFamily: FUENTE, fontWeight: 900, fontSize: 100, color: '#fff',
        scale: vs, rotate: `${(1 - vs) * 180}deg`, boxShadow: '0 10px 60px rgba(0,0,0,0.6)',
      }}>VS</div>
    </AbsoluteFill>
  );
}

// La sugerencia del foro, como una tarjeta del foro de la web
function EscenaForo({ e }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 13 } });
  const corazon = 1 + Math.max(0, Math.sin((f / fps) * Math.PI * 3)) * 0.15;
  return (
    <AbsoluteFill style={{ background: `radial-gradient(circle at 50% 35%, #2a2c3a 0%, ${COLORES.oscuro} 70%)`, alignItems: 'center', fontFamily: FUENTE }}>
      {e.video && <AbsoluteFill style={{ opacity: 0.35, filter: 'blur(18px)' }}><Clip video={e.video} desde={e.desde} /></AbsoluteFill>}
      <div style={{ marginTop: ZONA.arriba + 20 }}><Logo alto={80} /></div>
      <div style={{ marginTop: 40, fontWeight: 800, fontSize: 58, color: COLORES.claro, opacity: s }}>{e.etiqueta}</div>
      <div style={{
        marginTop: 40, width: 860, padding: '54px 56px', borderRadius: 40, background: '#fff', color: COLORES.oscuro,
        boxShadow: '0 30px 80px rgba(0,0,0,0.55)', scale: s, rotate: `${(1 - s) * 6 - 1.5}deg`,
      }}>
        <div style={{ fontWeight: 900, fontSize: 82, lineHeight: 1.05, letterSpacing: '-0.02em' }}>«{e.titulo}»</div>
        {e.descripcion && <div style={{ fontWeight: 500, fontSize: 40, lineHeight: 1.25, marginTop: 24, opacity: 0.75 }}>{e.descripcion}</div>}
        <div style={{ display: 'flex', gap: 30, marginTop: 34, fontWeight: 800, fontSize: 50, color: COLORES.rojo }}>
          <span style={{ scale: corazon }}>♥ {e.meGusta}</span>
          {e.estado && <span style={{ marginLeft: 'auto', padding: '6px 26px', borderRadius: 999, background: '#e6f7ea', color: '#1b7f3b', fontSize: 42 }}>✓ {e.estado}</span>}
        </div>
      </div>
    </AbsoluteFill>
  );
}

// Fotos muy rápidas de varios juegos (cada una ~0,15 s)
function EscenaRafaga({ e }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const cada = Math.max(1, Math.round((e.dura / e.fotos.length) * fps));
  const i = Math.min(e.fotos.length - 1, Math.floor(f / cada));
  const foto = e.fotos[i];
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      <Sequence from={i * cada} durationInFrames={cada} layout="none">
        <Entrada fuerza={0.18}><Clip video={foto.video} desde={foto.desde} /></Entrada>
        <Destello fuerza={0.3} />
      </Sequence>
      <Sombra />
    </AbsoluteFill>
  );
}

function Escena({ e, comun }) {
  if (e.tipo === 'ranking') return <EscenaRanking e={e} />;
  if (e.tipo === 'duelo') return <EscenaDuelo e={e} />;
  if (e.tipo === 'foro') return <EscenaForo e={e} />;
  if (e.tipo === 'rafaga') return <EscenaRafaga e={e} />;
  if (e.tipo === 'cierre') return <Cierre textos={{ ...comun.cierre, ...e.textos }} miniatura={e.miniatura || comun.miniatura} />;
  return <EscenaClip e={e} />;
}

// ─── Rótulos ───────────────────────────────────────────────────────────
// Una línea: entra con bote; con «caja» va sobre un rectángulo de color, un poco girado
function Linea({ l, retraso }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f - retraso * fps, fps, config: { damping: 10, stiffness: 190 } });
  if (f < retraso * fps) return null;
  const tam = l.tam || (l.grande ? 124 : 86);
  return (
    <div style={{ display: 'flex', justifyContent: 'center', marginTop: 18, scale: s, opacity: Math.min(1, s * 2) }}>
      <div style={{
        fontFamily: FUENTE, fontWeight: 900, fontSize: tam, lineHeight: 1.05, letterSpacing: '-0.02em', textAlign: 'center',
        color: l.caja ? (l.tinta || '#fff') : '#fff', maxWidth: 1080 - ZONA.izquierda - ZONA.derecha + 60,
        ...(l.caja
          ? { background: l.caja, padding: '10px 34px 16px', borderRadius: 26, rotate: '-2deg', boxShadow: '0 14px 40px rgba(0,0,0,0.45)' }
          : contorno(14)),
      }}>{l.texto}</div>
    </div>
  );
}

function Rotulo({ r }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const salida = interpolate(f, [(r.dura - 0.15) * fps, r.dura * fps], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  // Temblor al entrar cada línea en caja (el «golpe» del gancho)
  const golpes = r.lineas.filter((l) => l.caja).map((l) => l.t);
  const temblor = golpes.reduce((m, t) => Math.max(m, Math.max(0, 1 - Math.abs(f / fps - t) / 0.18)), 0) * 12;
  return (
    <div style={{
      position: 'absolute', top: r.y ?? ZONA.arriba + 170, left: ZONA.izquierda - 30, right: ZONA.derecha - 60, opacity: salida,
      translate: `${Math.sin(f * 3.3) * temblor}px ${Math.cos(f * 2.9) * temblor}px`,
    }}>
      {r.lineas.map((l, i) => <Linea key={i} l={l} retraso={l.t ?? 0} />)}
    </div>
  );
}

// La música baja al final (los 1,5 últimos segundos)
function Musica({ src, duracion, volumen = 0.55 }) {
  const { fps } = useVideoConfig();
  return (
    <Audio src={archivo(src)} loop
      volume={(f) => volumen * interpolate(f, [0, 0.3 * fps, (duracion - 1.5) * fps, duracion * fps], [0, 1, 1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' })} />
  );
}

export function Formato(props) {
  useFuente();
  const { fps } = useVideoConfig();
  const fr = (s) => Math.max(1, Math.round(s * fps));
  return (
    <AbsoluteFill style={{ background: COLORES.oscuro }}>
      {props.escenas.map((e, i) => (
        <Sequence key={'e' + i} from={Math.round(e.en * fps)} durationInFrames={fr(e.dura)} name={`${e.tipo} ${e.chip || e.titulo || ''}`}>
          <Escena e={e} comun={props} />
        </Sequence>
      ))}
      {props.textos.map((r, i) => (
        <Sequence key={'t' + i} from={Math.round(r.en * fps)} durationInFrames={fr(r.dura)} name="rótulo">
          <Rotulo r={r} />
        </Sequence>
      ))}
      {props.musica && <Musica src={props.musica} duracion={props.duracion} />}
      {props.efectos.map((x, i) => (
        <Sequence key={'s' + i} from={Math.round(x.en * fps)} durationInFrames={fr(2)} name="efecto">
          <Audio src={archivo(x.archivo)} volume={x.volumen ?? 0.7} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}

export const VACIO_FORMATO = { duracion: 4, escenas: [{ tipo: 'cierre', en: 0, dura: 4, textos: {} }], textos: [], efectos: [], musica: null, miniatura: 'marca/favicon.svg', cierre: {} };
