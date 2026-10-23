// Composición de prueba «Ganchos»: los 4 ganchos seguidos (12 s) con la partida de topos ya grabada
// (trabajo/juegos/topos-es/). Sirve para verlos en el estudio o renderizarlos de una vez.
import React from 'react';
import { AbsoluteFill, Sequence } from 'remotion';
import { DURACION_GANCHO, Gancho } from './Gancho.jsx';
import { PERSONAS, TIPOS } from './index.js';

export const PRUEBA_GANCHOS = {
  video: 'juegos/topos-es/partida.mp4', desde: 20, miniatura: 'juegos/topos-es/miniatura.svg', idioma: 'es',
  videoPersona: PERSONAS[0],
  textos: { web: '¿Realidad virtual… sin descargar nada?', persona: 'Gafas puestas y a por los topos', impacto: 'No vas a pasar de 30', reto: 'Quedan 3 segundos…' },
};

export function Ganchos({ textos, ...props }) {
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {TIPOS.map((tipo, i) => (
        <Sequence key={tipo} from={i * DURACION_GANCHO} durationInFrames={DURACION_GANCHO}>
          <Gancho tipo={tipo} texto={textos[tipo]} {...props} />
        </Sequence>
      ))}
    </AbsoluteFill>
  );
}
