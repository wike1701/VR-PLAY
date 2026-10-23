// Clip vertical (1080×1920) de una grabación hablada ya limpia: subtítulos palabra a palabra y logo.
// palabras: [{ texto, desde, hasta }] en segundos desde el principio del clip.
// modo «recorte»: llena la pantalla recortando los lados (encuadre 0 = izquierda, 0,5 = centro, 1 = derecha).
// modo «encajar»: el vídeo entero en el centro, sobre una copia suya difuminada (partidas, pantallas).
import React from 'react';
import { AbsoluteFill, OffthreadVideo } from 'remotion';
import { archivo, Logo, useFuente } from './Marca.jsx';
import { agruparPalabras, PalabraAPalabra, ZONA } from './Subtitulos.jsx';

export function ClipHablado({ video, desde, hasta, palabras = [], modo = 'recorte', encuadre = 0.5, vertical = false }) {
  useFuente();
  const comun = { src: archivo(video), startFrom: Math.round(desde * 30), endAt: Math.round(hasta * 30) };
  return (
    <AbsoluteFill style={{ background: '#000' }}>
      {modo === 'encajar' && !vertical ? (
        <>
          <AbsoluteFill style={{ filter: 'blur(40px) brightness(0.55)', transform: 'scale(1.2)' }}>
            <OffthreadVideo {...comun} muted style={{ width: '100%', height: '100%', objectFit: 'cover' }} />
          </AbsoluteFill>
          <AbsoluteFill style={{ justifyContent: 'center' }}>
            <OffthreadVideo {...comun} style={{ width: '100%', objectFit: 'contain' }} />
          </AbsoluteFill>
        </>
      ) : (
        <OffthreadVideo {...comun} style={{ width: '100%', height: '100%', objectFit: 'cover', objectPosition: `${encuadre * 100}% 50%` }} />
      )}
      <PalabraAPalabra grupos={agruparPalabras(palabras)} y={modo === 'encajar' && !vertical ? 1380 : 1150} />
      <div style={{ position: 'absolute', top: ZONA.arriba - 90, left: ZONA.izquierda, opacity: 0.85 }}><Logo alto={48} /></div>
    </AbsoluteFill>
  );
}
