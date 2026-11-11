// Entrada de Remotion: las composiciones de la fábrica. Los datos llegan como inputProps desde
// lib/montar.mjs y lib/editar.mjs; para verlas en el navegador: npm run estudio (en herramientas/videos).
import React from 'react';
import { Composition, registerRoot } from 'remotion';
import { TikTokJuego, duracionTikTok, FPS } from './TikTokJuego.jsx';
import { ClipHablado } from './ClipHablado.jsx';
import { AnuncioVR } from './AnuncioVR.jsx';
import { EdicionPro } from './EdicionPro.jsx';
import { Ganchos, PRUEBA_GANCHOS } from './ganchos/Ganchos.jsx';

const VACIO_JUEGO = { video: 'vacio.mp4', trozos: [{ tipo: 'gancho', desde: 0, hasta: 3 }], textos: { gancho: '', titulo: '', frases: [] }, miniatura: 'marca/favicon.svg', rastro: [], clics: [], impactos: [] };
const VACIO_ANUNCIO = { video: 'vacio.mp4', espectador: null, miniatura: 'marca/favicon.svg', gancho: { tipo: 'impacto', texto: '' }, escenas: [{ plano: 'cierre', en: 0, dura: 4 }], subtitulos: [], impactos: [], textos: {}, duracion: 4 };
const VACIO_PRO = { video: 'vacio.mp4', espectador: null, miniatura: 'marca/favicon.svg', planos: [{ tipo: 'cierre', en: 0, dura: 4, transicion: 'destello' }], rotulos: [], impactos: [], fotos: {}, textos: {}, duracion: 4 };
const VACIO_CLIP = { video: 'vacio.mp4', desde: 0, hasta: 5, palabras: [] };

function Raiz() {
  return (
    <>
      <Composition
        id="TikTokJuego" component={TikTokJuego} width={1080} height={1920} fps={FPS} durationInFrames={90}
        defaultProps={VACIO_JUEGO}
        calculateMetadata={({ props }) => ({ durationInFrames: duracionTikTok(props) })}
      />
      <Composition
        id="AnuncioVR" component={AnuncioVR} width={1080} height={1920} fps={30} durationInFrames={120}
        defaultProps={VACIO_ANUNCIO}
        calculateMetadata={({ props }) => ({ durationInFrames: Math.round(props.duracion * 30) })}
      />
      <Composition
        id="EdicionPro" component={EdicionPro} width={1080} height={1920} fps={30} durationInFrames={120}
        defaultProps={VACIO_PRO}
        calculateMetadata={({ props }) => ({ durationInFrames: Math.round(props.duracion * 30) })}
      />
      <Composition
        id="ClipHablado" component={ClipHablado} width={1080} height={1920} fps={30} durationInFrames={150}
        defaultProps={VACIO_CLIP}
        calculateMetadata={({ props }) => ({ durationInFrames: Math.max(1, Math.round((props.hasta - props.desde) * 30)) })}
      />
      <Composition
        id="Ganchos" component={Ganchos} width={1080} height={1920} fps={30} durationInFrames={360}
        defaultProps={PRUEBA_GANCHOS}
      />
    </>
  );
}

registerRoot(Raiz);
