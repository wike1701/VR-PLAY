// El lote de la semana (lote): decide solo qué vídeos tocan, los hace y deja una parrilla para
// publicarlos (sin publicar nada):
//   - los juegos publicados que aún no tienen su TikTok (como mucho --juegos, 2 por defecto; primero
//     los que el bot juega bien, «probado» en lib/estrategias.mjs)
//   - el anuncio de la web (cada semana con otro gancho y otros juegos)
//   - un formato que va rotando cada semana: top, reto, duelo y foro
// Sale en salida/lote-<fecha>/PARRILLA.md (qué subir cada día, con su texto) y lote.json. Los vídeos
// se quedan en salida/juegos/ y salida/formatos/, como siempre.
import fs from 'node:fs';
import path from 'node:path';
import { SALIDA, crear, juegosDelCatalogo, log } from './comun.mjs';
import { estrategiaDe } from './estrategias.mjs';

const ROTACION = ['top', 'reto', 'duelo', 'foro'];
const DIAS = { es: ['lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado', 'domingo'] };

export async function hacerLote({ idiomas, maxJuegos = 2, sinVoz = false, motorVoz = 'natural', modo = 'vr' }) {
  const semana = Math.floor(Date.now() / (7 * 864e5));
  const fecha = new Date().toISOString().slice(0, 10);
  const destino = crear(path.join(SALIDA, `lote-${fecha}`));
  const hechos = [];
  const fallos = [];

  // 1. Juegos nuevos sin vídeo
  const sinVideo = juegosDelCatalogo()
    .filter((j) => !j.pruebas && estrategiaDe(j.id).modo !== 'pendiente')
    .filter((j) => !fs.existsSync(path.join(SALIDA, 'juegos', j.id, `${j.id}-${idiomas[0]}.mp4`)))
    .sort((a, b) => Number(estrategiaDe(b.id).probado) - Number(estrategiaDe(a.id).probado))
    .map((j) => j.id);
  // Cada semana empieza más adelante en la lista: en GitHub Actions salida/ llega vacía y, si no,
  // siempre saldrían los mismos
  const giro = sinVideo.length ? (semana * maxJuegos) % sinVideo.length : 0;
  const nuevos = sinVideo.slice(giro).concat(sinVideo.slice(0, giro)).slice(0, maxJuegos);
  if (nuevos.length) {
    const { hacerVideoJuego } = await import('./montar.mjs');
    const { arrancarServidor } = await import('./servidor.mjs');
    const servidor = await arrancarServidor();
    try {
      for (const id of nuevos) {
        try {
          await hacerVideoJuego({ id, idiomas, urlBase: servidor.url, modo, sinVoz, motorVoz });
          hechos.push({ tipo: 'juego', id, carpeta: path.join(SALIDA, 'juegos', id), archivo: (idioma) => `${id}-${idioma}.mp4` });
        } catch (e) {
          fallos.push(`${id}: ${e.message.split('\n')[0]}`);
        }
      }
    } finally {
      servidor.cerrar();
    }
  }

  // 2. Formatos: el anuncio y el de la semana
  const { hacerFormato } = await import('./formatos.mjs');
  for (const formato of ['anuncio', ROTACION[semana % ROTACION.length]]) {
    try {
      const videos = await hacerFormato({ formato, idiomas, semilla: semana });
      const carpeta = path.dirname(videos[0]);
      const base = path.basename(videos[0]).replace(`-${idiomas[0]}.mp4`, '');
      hechos.push({ tipo: formato, id: base, carpeta, archivo: (idioma) => `${base}-${idioma}.mp4` });
    } catch (e) {
      fallos.push(`${formato}: ${e.message.split('\n')[0]}`);
    }
  }

  // 3. La parrilla: un vídeo al día, a las 19:00 (la franja con más visitas en TikTok y Reels en España)
  const dias = DIAS.es;
  const lineas = [
    `# Parrilla de la semana del ${fecha}`,
    '',
    'Un vídeo al día, sobre las 19:00. Revisa cada vídeo antes de subirlo (la hoja `revision-<idioma>.jpg` de su carpeta lo enseña de un vistazo).',
    'El texto de la publicación y los hashtags están en `publicacion-<idioma>.txt`, al lado del vídeo.',
    'Para que Claude lo suba por ti: «sube el vídeo del lunes a TikTok» (con las cuentas conectadas en vidIQ; te enseña el borrador antes de publicar).',
    '',
    '| Día | Vídeo | Carpeta |',
    '|---|---|---|',
  ];
  hechos.forEach((h, i) => {
    const rel = path.relative(path.join(SALIDA, '..'), h.carpeta);
    lineas.push(`| ${dias[i % 7]} | ${h.tipo === 'juego' ? `TikTok de ${h.id}` : h.tipo} (${idiomas.map((x) => h.archivo(x)).join(', ')}) | \`${rel}\` |`);
  });
  if (fallos.length) lineas.push('', '## No se han podido hacer', '', ...fallos.map((f) => `- ${f}`));
  fs.writeFileSync(path.join(destino, 'PARRILLA.md'), lineas.join('\n') + '\n');
  fs.writeFileSync(path.join(destino, 'lote.json'), JSON.stringify({
    fecha, idiomas, videos: hechos.map((h) => ({ tipo: h.tipo, id: h.id, carpeta: path.relative(SALIDA, h.carpeta), archivos: idiomas.map((x) => h.archivo(x)) })), fallos,
  }, null, 2));
  log(`lote: ${hechos.length} vídeos${fallos.length ? `, ${fallos.length} fallos` : ''} · ${path.relative(process.cwd(), path.join(destino, 'PARRILLA.md'))}`);
  if (fallos.length) process.exitCode = 1;
  return { destino, hechos, fallos };
}
