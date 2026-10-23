// Edición pro de un juego (1080×1920, 30 fps), estilo gaming viral. La línea de tiempo la hace
// lib/edicion.mjs; la voz y la música se mezclan después (lib/montar.mjs, --estilo pro).
//   planos: pov, zoom, espectador, partida, congelado (frame de impacto), lenta (rampa), rebobinado y cierre
//   entradas: barrido (con desenfoque de movimiento), zoom, glitch (RGB separado), destello (con light leak) y corte
//   encima: color más vivo, viñeta y grano; pegatinas en los golpes y texto cinético con la *clave* en color
// Todo con CSS y filtros SVG (nada de WebGL): el render va igual de rápido que AnuncioVR.
import React from 'react';
import { AbsoluteFill, Audio, Img, interpolate, OffthreadVideo, Sequence, spring, useCurrentFrame, useVideoConfig } from 'remotion';
import { archivo, COLORES, FUENTE, Logo, contorno, useFuente } from './Marca.jsx';
import { ZONA } from './Subtitulos.jsx';
import { Cierre } from './TikTokJuego.jsx';
import { Efecto, Flash } from './ganchos/comun.jsx';

const FPS = 30;
const fot = (s) => Math.round(s * FPS);
const COLOR = 'contrast(1.12) saturate(1.3) brightness(1.04)';
const SONIDO = { barrido: ['whoosh', 0.5], zoom: ['whoosh', 0.4], glitch: ['glitch', 0.45], destello: ['aparecer', 0.5] };

// Pseudoaleatorio estable por fotograma (el temblor y el glitch salen igual en cada render)
const ruido = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// Zoom de golpe en cada acierto de la partida: salta y vuelve en ~0,3 s
function golpeDeZoom(impactos, t, fuerza) {
  let z = 0;
  for (const i of impactos) if (t >= i && t < i + 0.4) z = Math.max(z, fuerza * Math.exp(-(t - i) * 9));
  return z;
}

// Filtro SVG que separa el rojo y el azul `dx` px (aberración cromática); con `blur`, desenfoque horizontal
function Filtros({ id, dx = 0, blur = 0 }) {
  return (
    <svg width="0" height="0" style={{ position: 'absolute' }}>
      <filter id={`rgb-${id}`} x="-5%" y="-5%" width="110%" height="110%" colorInterpolationFilters="sRGB">
        <feColorMatrix in="SourceGraphic" type="matrix" values="1 0 0 0 0  0 0 0 0 0  0 0 0 0 0  0 0 0 1 0" result="r" />
        <feOffset in="r" dx={dx} dy={0} result="r2" />
        <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 1 0 0 0  0 0 0 0 0  0 0 0 1 0" result="g" />
        <feColorMatrix in="SourceGraphic" type="matrix" values="0 0 0 0 0  0 0 0 0 0  0 0 1 0 0  0 0 0 1 0" result="b" />
        <feOffset in="b" dx={-dx} dy={0} result="b2" />
        <feBlend in="r2" in2="g" mode="screen" result="rg" />
        <feBlend in="rg" in2="b2" mode="screen" />
      </filter>
      <filter id={`barrido-${id}`} x="-10%" y="0" width="120%" height="100%">
        <feGaussianBlur stdDeviation={`${blur} 0`} />
      </filter>
    </svg>
  );
}

function Video({ src, desde = 0, velocidad = 1, volumen = 1, posicion = '50% 50%' }) {
  return (
    <OffthreadVideo src={archivo(src)} startFrom={fot(desde)} playbackRate={velocidad} volume={volumen} muted={volumen === 0}
      style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: posicion, filter: COLOR }} />
  );
}

// Lo que se ve en un plano (sin la entrada)
function Contenido({ p, props, f }) {
  const { video, espectador, lenta, rebobinado, fotos, impactos } = props;
  const t = (p.desde ?? 0) + (f / FPS) * (p.velocidad ?? 1);
  const largo = Math.max(1, fot(p.dura));
  if (p.tipo === 'espectador') {
    return (
      <>
        <Video src={espectador} desde={p.desde} volumen={0} />
        <Audio src={archivo(video)} startFrom={fot(p.desde)} />
      </>
    );
  }
  if (p.tipo === 'partida') {
    return (
      <>
        <div style={{ position: 'absolute', top: 0, left: 0, width: 1080, height: 958, overflow: 'hidden' }}>
          <Video src={espectador} desde={p.desde} volumen={0} posicion="50% 48%" />
        </div>
        <div style={{ position: 'absolute', top: 962, left: 0, width: 1080, height: 958, overflow: 'hidden' }}>
          <Video src={video} desde={p.desde} posicion="50% 52%" />
        </div>
        <div style={{ position: 'absolute', top: 956, left: 0, width: 1080, height: 8, background: `linear-gradient(90deg, ${COLORES.naranja}, ${COLORES.rojo})` }} />
      </>
    );
  }
  if (p.tipo === 'congelado') {
    // Frame de impacto: la imagen parada, con zoom de golpe que se asienta y temblor fuerte
    const z = interpolate(f, [0, largo], [1.28, 1.16]);
    const m = 34 * (1 - f / largo);
    return (
      <AbsoluteFill style={{ transform: `scale(${z}) translate(${(ruido(f) - 0.5) * m}px, ${(ruido(f + 9) - 0.5) * m}px) rotate(${(ruido(f + 3) - 0.5) * 2.5}deg)`, filter: `url(#rgb-${p.i})` }}>
        <Img src={archivo(fotos[String(p.foto)])} style={{ width: '100%', height: '100%', objectFit: 'cover', filter: `${COLOR} contrast(1.15)` }} />
      </AbsoluteFill>
    );
  }
  if (p.tipo === 'lenta' || p.tipo === 'rebobinado') {
    const empuje = interpolate(f, [0, largo], [1.06, p.tipo === 'lenta' ? 1.22 : 1.12]);
    const golpe = p.golpeEn != null ? golpeDeZoom([p.golpeEn], f / FPS, 0.12) : 0;
    return (
      <AbsoluteFill style={{ transform: `scale(${empuje + golpe})`, filter: p.tipo === 'rebobinado' ? `url(#rgb-${p.i})` : undefined }}>
        <Video src={p.tipo === 'lenta' ? lenta : rebobinado} volumen={0} />
      </AbsoluteFill>
    );
  }
  // pov y zoom: las gafas; el zoom se va acercando y pega un salto (con temblor) en cada acierto
  const zoom = p.tipo === 'zoom';
  const base = zoom ? interpolate(f, [0, largo], [1.1, 1.26]) : interpolate(f, [0, largo], [1, 1.05]);
  const golpe = golpeDeZoom(impactos, t, zoom ? 0.15 : 0.06);
  const temblor = golpe > 0.03 ? (ruido(f) - 0.5) * golpe * 220 : 0;
  return (
    <AbsoluteFill style={{ transform: `scale(${base + golpe}) translate(${temblor}px, ${temblor * 0.5}px)` }}>
      <Video src={video} desde={p.desde} velocidad={p.velocidad ?? 1} />
    </AbsoluteFill>
  );
}

// Un plano con su entrada: barrido, zoom, glitch, destello o corte seco con un pequeño golpe de zoom
function Plano({ p, props }) {
  const f = useCurrentFrame();
  const e = p.transicion;
  const k = interpolate(f, [0, e === 'corte' ? 3 : 6], [1, 0], { extrapolateRight: 'clamp' }); // 1 → 0 en la entrada
  const suave = k * k;
  let transform = '';
  let filtro;
  let dx = 0;
  let blur = 0;
  if (e === 'barrido') {
    transform = `translateX(${suave * 42 * (p.i % 2 ? -1 : 1)}%)`;
    blur = suave * 70;
    filtro = `url(#barrido-${p.i})`;
  } else if (e === 'zoom') {
    transform = `scale(${1 + suave * 0.55})`;
    filtro = `blur(${suave * 14}px)`;
  } else if (e === 'corte') {
    transform = `scale(${1 + suave * 0.07})`;
  } else if (e === 'glitch') {
    dx = Math.round(k * 34);
    transform = `translateX(${(ruido(f + p.i) - 0.5) * k * 80}px)`;
    filtro = `url(#rgb-${p.i})`;
  }
  // Los congelados y el rebobinado llevan siempre la aberración cromática; el congelado, bien fuerte
  if (p.tipo === 'congelado') dx = Math.max(dx, Math.round(interpolate(f, [0, fot(p.dura)], [26, 10])));
  if (p.tipo === 'rebobinado') dx = Math.max(dx, 12 + Math.round(ruido(f) * 10));
  const son = SONIDO[e];
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      <Filtros id={p.i} dx={dx} blur={blur} />
      <AbsoluteFill style={{ transform, filter: filtro }}>
        {p.tipo === 'cierre' ? <Cierre textos={props.textos} miniatura={props.miniatura} /> : <Contenido p={p} props={props} f={f} />}
      </AbsoluteFill>
      {e === 'glitch' && k > 0 && <Rayas f={f} fuerza={k} />}
      {p.tipo === 'rebobinado' && <Rebobinado f={f} texto={props.textos.otraVez} />}
      {son && <Efecto nombre={son[0]} volumen={son[1]} />}
      {p.tipo === 'congelado' && <><Efecto nombre="golpe" volumen={1} /><Efecto nombre="golpe-metal" volumen={0.35} /></>}
      {p.tipo === 'lenta' && <Efecto nombre="golpe" en={fot(p.golpeEn)} volumen={1} />}
      {p.tipo === 'rebobinado' && <Efecto nombre="glitch" volumen={0.7} />}
    </AbsoluteFill>
  );
}

// Bandas horizontales desplazadas (glitch)
function Rayas({ f, fuerza }) {
  return (
    <AbsoluteFill>
      {[0, 1, 2, 3].map((n) => (
        <div key={n} style={{
          position: 'absolute', left: 0, right: 0, top: `${ruido(f * 4 + n) * 92}%`, height: 20 + ruido(f + n * 7) * 70,
          background: n % 2 ? 'rgba(255,138,98,0.35)' : 'rgba(80,220,255,0.3)', mixBlendMode: 'screen', transform: `translateX(${(ruido(f + n) - 0.5) * 160 * fuerza}px)`,
        }} />
      ))}
    </AbsoluteFill>
  );
}

// Rótulo y líneas de VHS mientras se rebobina
function Rebobinado({ f, texto }) {
  return (
    <AbsoluteFill>
      <AbsoluteFill style={{ backgroundImage: 'repeating-linear-gradient(0deg, rgba(0,0,0,0.28) 0 3px, transparent 3px 7px)', backgroundPosition: `0 ${f * 9}px` }} />
      <div style={{
        position: 'absolute', top: ZONA.arriba + 40, left: ZONA.izquierda, fontFamily: FUENTE, fontWeight: 900, fontSize: 76, color: '#fff',
        letterSpacing: '0.02em', ...contorno(10), opacity: f % 8 < 6 ? 1 : 0.4,
      }}>◀◀ {texto}</div>
    </AbsoluteFill>
  );
}

// Light leak: manchas cálidas que cruzan la imagen (fusión «screen»), en los destellos y los golpes
function LuzFugada({ largo = 16, lado = 1 }) {
  const f = useCurrentFrame();
  const o = interpolate(f, [0, 3, largo], [0, 0.85, 0], { extrapolateRight: 'clamp' });
  const x = interpolate(f, [0, largo], [lado > 0 ? 10 : 90, lado > 0 ? 75 : 25]);
  return (
    <AbsoluteFill style={{
      mixBlendMode: 'screen', opacity: o,
      background: `radial-gradient(ellipse 60% 45% at ${x}% 30%, rgba(255,160,90,0.95), transparent 70%), radial-gradient(ellipse 50% 40% at ${100 - x}% 75%, rgba(240,69,42,0.8), transparent 70%)`,
    }} />
  );
}

// Pegatina de reacción sobre un golpe: entra con bote y giro, y se va
function Pegatina({ texto, lado }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 8, stiffness: 220 } });
  const salida = interpolate(f, [18, 24], [1, 0], { extrapolateLeft: 'clamp', extrapolateRight: 'clamp' });
  return (
    <div style={{
      position: 'absolute', top: 470, left: lado > 0 ? 470 : ZONA.izquierda + 20, transform: `scale(${s * salida}) rotate(${lado * 9 - (1 - s) * 30 * lado}deg)`,
      fontFamily: FUENTE, fontWeight: 900, fontSize: 118, color: '#fff', padding: '8px 40px', borderRadius: 28, letterSpacing: '-0.02em',
      background: `linear-gradient(135deg, ${COLORES.naranja}, ${COLORES.rojo})`, boxShadow: '0 12px 0 #14151c, 0 20px 50px rgba(0,0,0,0.5)', ...contorno(8),
    }}>{texto}</div>
  );
}

// Texto cinético: de 1 a 3 palabras a la vez, que entran con bote; la *clave*, más grande, en color y temblando
function Grupo({ g, estilo, n }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const s = spring({ frame: f, fps, config: { damping: 10, stiffness: 260, mass: 0.6 } });
  const gancho = estilo === 'gancho';
  const giro = (n % 2 ? 1 : -1) * (gancho ? 2 : 3.5);
  return (
    <div style={{
      position: 'absolute', left: ZONA.izquierda, right: ZONA.izquierda - 40, top: gancho ? ZONA.arriba + 90 : 1080, textAlign: 'center',
      transform: `scale(${0.35 + s * 0.65}) rotate(${giro * s}deg)`, fontFamily: FUENTE, fontWeight: 900, lineHeight: 1.02, letterSpacing: '-0.03em',
    }}>
      {g.palabras.map((w, i) => {
        const temblor = w.clave ? (ruido(f + i) - 0.5) * 7 : 0;
        return (
          <span key={i} style={{
            display: 'inline-block', margin: '0 14px', fontSize: (gancho ? 132 : 108) * (w.clave ? 1.38 : 1), textTransform: 'uppercase',
            color: w.clave ? (n % 2 ? COLORES.rojo : COLORES.naranja) : '#fff', transform: `translate(${temblor}px, ${-temblor}px)`,
            ...contorno(w.clave ? 18 : 14),
          }}>{w.texto}</span>
        );
      })}
    </div>
  );
}

// Grano de película: ruido SVG que cambia en cada fotograma
function Grano() {
  const f = useCurrentFrame();
  return (
    <AbsoluteFill style={{ opacity: 0.09, mixBlendMode: 'overlay' }}>
      <svg width="1080" height="1920">
        <filter id="grano"><feTurbulence type="fractalNoise" baseFrequency="0.85" numOctaves="2" seed={f % 10} /></filter>
        <rect width="1080" height="1920" filter="url(#grano)" />
      </svg>
    </AbsoluteFill>
  );
}

export function EdicionPro(props) {
  useFuente();
  const { planos, rotulos } = props;
  const lista = planos.map((p, i) => ({ ...p, i }));
  const cierre = lista.find((p) => p.tipo === 'cierre');
  const golpes = lista.filter((p) => p.pegatina);
  const cuerpo = lista.find((p) => p.en > 0 && p.transicion !== 'corte'); // la primera frase, tras el gancho
  let g = 0;
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {lista.map((p) => (
        <Sequence key={p.i} from={fot(p.en)} durationInFrames={Math.max(1, fot(p.en + p.dura) - fot(p.en))}>
          <Plano p={p} props={props} />
          {p.transicion === 'destello' && <Flash en={0} largo={6} />}
        </Sequence>
      ))}
      {/* Viñeta y grano encima de todo menos de los textos */}
      <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, transparent 50%, rgba(0,0,0,0.5) 100%)' }} />
      <Grano />
      {lista.filter((p) => p.transicion === 'destello' || p.transicion === 'zoom' || p.tipo === 'congelado').map((p) => (
        <Sequence key={`luz${p.i}`} from={fot(p.en)} durationInFrames={18}><LuzFugada lado={p.i % 2 ? -1 : 1} /></Sequence>
      ))}
      {golpes.map((p, k) => (
        <Sequence key={`peg${p.i}`} from={fot(p.en + (p.golpeEn ?? 0))} durationInFrames={24}>
          <Flash en={0} largo={4} />
          <Pegatina texto={p.pegatina} lado={k % 2 ? -1 : 1} />
        </Sequence>
      ))}
      {cuerpo && cierre && (
        <Sequence from={fot(cuerpo.en)} durationInFrames={Math.max(1, fot(cierre.en) - fot(cuerpo.en))}>
          <div style={{ position: 'absolute', top: ZONA.arriba - 100, left: ZONA.izquierda, opacity: 0.85 }}><Logo alto={48} /></div>
        </Sequence>
      )}
      {rotulos.flatMap((r) => r.grupos.map((gr) => {
        const n = g++;
        const desde = r.estilo === 'gancho' ? r.en : gr.en;
        const dura = r.estilo === 'gancho' ? r.dura : gr.dura;
        return (
          <Sequence key={`t${n}`} from={fot(desde)} durationInFrames={Math.max(1, fot(dura))}>
            <Grupo g={gr} estilo={r.estilo} n={n} />
          </Sequence>
        );
      }))}
    </AbsoluteFill>
  );
}
