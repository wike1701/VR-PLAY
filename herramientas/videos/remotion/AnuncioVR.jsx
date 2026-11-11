// Anuncio de un juego (1080×1920, 30 fps) con varios planos, al ritmo de la voz en off:
//   gancho (0-3 s, remotion/ganchos/), y luego una escena por frase del guion con su plano:
//   pov (las gafas), espectador (alguien jugando, con avatar), partida (pantalla partida: espectador
//   arriba y gafas abajo), lenta (cámara lenta del mejor golpe) y zoom (golpes de zoom en cada
//   acierto); el final con la puntuación y la tarjeta de cierre. Subtítulos palabra a palabra.
// La línea de tiempo la hace lib/guion.mjs; la voz y la música se mezclan después (lib/montar.mjs).
import React from 'react';
import { AbsoluteFill, Audio, interpolate, OffthreadVideo, Sequence, useCurrentFrame, useVideoConfig } from 'remotion';
import { archivo, COLORES, FUENTE, Logo, useFuente } from './Marca.jsx';
import { PalabraAPalabra, ZONA, agruparPalabras } from './Subtitulos.jsx';
import { Cierre, Puntuacion, Titulo } from './TikTokJuego.jsx';
import { Gancho } from './ganchos/Gancho.jsx';
import { Efecto, Flash } from './ganchos/comun.jsx';

export const FPS = 30;
const fotogramas = (s) => Math.round(s * FPS);

// La partida (o el espectador) desde el segundo `desde`
function Video({ src, desde, velocidad = 1, volumen = 1, posicion = '50% 50%' }) {
  return (
    <OffthreadVideo src={archivo(src)} startFrom={fotogramas(desde)} playbackRate={velocidad} volume={volumen} muted={volumen === 0}
      style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: posicion }} />
  );
}

// Zoom de golpe en cada acierto: salta y vuelve en ~0,3 s
function golpeDeZoom(impactos, t, fuerza) {
  let z = 0;
  for (const i of impactos) {
    if (t >= i && t < i + 0.4) z = Math.max(z, fuerza * Math.exp(-(t - i) * 9));
  }
  return z;
}

function Escena({ e, video, espectador, impactos, textos }) {
  const f = useCurrentFrame();
  const { fps } = useVideoConfig();
  const t = e.desde + (f / fps) * (e.velocidad ?? 1); // segundo de la partida
  // Entrada: un poco de zoom que se asienta (el corte se nota y da ritmo)
  const entrada = interpolate(f, [0, 7], [1.08, 1], { extrapolateRight: 'clamp' });
  let contenido;
  if (e.plano === 'espectador') {
    contenido = (
      <>
        <Video src={espectador} desde={e.desde} volumen={0} />
        {/* El sonido de la partida, aunque no se vea */}
        <Audio src={archivo(video)} startFrom={fotogramas(e.desde)} />
      </>
    );
  } else if (e.plano === 'partida') {
    contenido = (
      <>
        <div style={{ position: 'absolute', top: 0, left: 0, width: 1080, height: 958, overflow: 'hidden' }}>
          <Video src={espectador} desde={e.desde} volumen={0} posicion="50% 48%" />
        </div>
        <div style={{ position: 'absolute', top: 962, left: 0, width: 1080, height: 958, overflow: 'hidden' }}>
          <Video src={video} desde={e.desde} posicion="50% 52%" />
        </div>
        <div style={{ position: 'absolute', top: 956, left: 0, width: 1080, height: 8, background: `linear-gradient(90deg, ${COLORES.naranja}, ${COLORES.rojo})` }} />
      </>
    );
  } else if (e.plano === 'lenta') {
    const empuje = interpolate(f, [0, e.dura * fps], [1.05, 1.18]);
    contenido = (
      <>
        <AbsoluteFill style={{ transform: `scale(${empuje})` }}>
          <Video src={video} desde={e.desde} velocidad={e.velocidad} volumen={0} />
        </AbsoluteFill>
        <AbsoluteFill style={{ background: 'radial-gradient(ellipse at center, transparent 45%, rgba(0,0,0,0.55) 100%)' }} />
        <div style={{ position: 'absolute', top: ZONA.arriba + 30, left: 0, right: 0, display: 'flex', justifyContent: 'center' }}>
          <div style={{
            fontFamily: FUENTE, fontWeight: 900, fontSize: 52, color: '#fff', padding: '10px 30px', borderRadius: 999,
            background: 'rgba(20,21,28,0.75)', border: `4px solid ${COLORES.naranja}`, letterSpacing: '0.04em', textTransform: 'uppercase',
            opacity: interpolate(f, [0, 6], [0, 1], { extrapolateRight: 'clamp' }),
          }}>
            {textos.lenta} ×{Math.round(1 / e.velocidad * 10) / 10}
          </div>
        </div>
      </>
    );
  } else {
    // pov, zoom y final: las gafas; el zoom va acercándose y pega un salto en cada acierto
    const zoom = e.plano === 'zoom';
    const base = zoom ? interpolate(f, [0, e.dura * fps], [1.1, 1.28]) : 1;
    const golpe = golpeDeZoom(impactos, t, zoom ? 0.16 : 0.03);
    const temblor = zoom && golpe > 0.04 ? Math.sin(f * 2.3) * golpe * 60 : 0;
    contenido = (
      <AbsoluteFill style={{ transform: `scale(${base + golpe}) translate(${temblor}px, ${temblor * 0.6}px)` }}>
        <Video src={video} desde={e.desde} />
      </AbsoluteFill>
    );
  }
  return (
    <AbsoluteFill style={{ background: '#000', overflow: 'hidden' }}>
      <AbsoluteFill style={{ transform: `scale(${entrada})` }}>{contenido}</AbsoluteFill>
      {e.plano === 'final' && e.puntuacionEn != null && textos.puntuacion && (
        <Sequence from={fotogramas(e.puntuacionEn)}>
          <Puntuacion etiqueta={textos.puntuacionEtiqueta} texto={textos.puntuacion} />
        </Sequence>
      )}
    </AbsoluteFill>
  );
}

export function AnuncioVR({ video, espectador, miniatura, gancho, escenas, subtitulos, impactos, textos }) {
  useFuente();
  const grupos = agruparPalabras(subtitulos, { maxPalabras: 3, maxLetras: 16 });
  const cierre = escenas.find((e) => e.plano === 'cierre');
  const primera = escenas.find((e) => e.plano !== 'gancho');
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {escenas.map((e, i) => (
        <Sequence key={i} from={fotogramas(e.en)} durationInFrames={fotogramas(e.dura)}>
          {e.plano === 'gancho' ? (
            <Gancho {...gancho} video={video} desde={e.desde} miniatura={miniatura} />
          ) : e.plano === 'cierre' ? (
            <Cierre textos={textos} miniatura={miniatura} />
          ) : (
            <Escena e={e} video={video} espectador={espectador} impactos={impactos} textos={textos} />
          )}
          {/* Cada corte, con un whoosh; a la cámara lenta y al cierre se entra con un destello */}
          {i > 0 && <Efecto nombre="whoosh" volumen={0.45} />}
          {(e.plano === 'lenta' || e.plano === 'cierre') && <Flash en={0} largo={6} />}
        </Sequence>
      ))}
      {primera && (
        <Sequence from={fotogramas(primera.en)} durationInFrames={fotogramas(2.6)}>
          <Titulo texto={textos.titulo} />
        </Sequence>
      )}
      {primera && cierre && (
        <Sequence from={fotogramas(primera.en)} durationInFrames={fotogramas(cierre.en - primera.en)}>
          <div style={{ position: 'absolute', top: ZONA.arriba - 90, left: ZONA.izquierda, opacity: 0.9 }}><Logo alto={52} /></div>
        </Sequence>
      )}
      <PalabraAPalabra grupos={grupos} y={1180} tam={92} />
    </AbsoluteFill>
  );
}
