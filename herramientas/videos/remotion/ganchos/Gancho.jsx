// Los 4 ganchos de 0 a 3 s (90 fotogramas, 1080×1920). Todos reciben { texto, video, desde,
// miniatura, idioma } con rutas relativas a trabajo/; «persona» usa además videoPersona.
import React from 'react';
import { GanchoWeb } from './GanchoWeb.jsx';
import { GanchoPersona } from './GanchoPersona.jsx';
import { GanchoImpacto } from './GanchoImpacto.jsx';
import { GanchoReto } from './GanchoReto.jsx';

export { DURACION_GANCHO } from './comun.jsx';
export { GanchoWeb, GanchoPersona, GanchoImpacto, GanchoReto };

export const COMPONENTES = { web: GanchoWeb, persona: GanchoPersona, impacto: GanchoImpacto, reto: GanchoReto };

export function Gancho({ tipo, ...props }) {
  const Componente = COMPONENTES[tipo] || GanchoImpacto;
  return <Componente {...props} />;
}
