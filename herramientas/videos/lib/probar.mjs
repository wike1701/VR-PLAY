// Prueba rápida del jugador automático de un juego (probar-bot): graba unos segundos a media
// resolución con el reloj virtual y deja una hoja de contactos para ver de un vistazo si juega bien.
//   node herramientas/videos/fabrica.mjs probar-bot <id> [--modo vr|raton] [--segundos 12]
// Sale en trabajo/pruebas/<id>-<modo>/: partida.mp4, espectador.mp4 (VR), grabacion.json y hoja.jpg
// (arriba, 6 fotogramas de las gafas o la pantalla; abajo, 6 del espectador).
import fs from 'node:fs';
import path from 'node:path';
import { TRABAJO, crear, ff, log } from './comun.mjs';
import { estrategiaDe } from './estrategias.mjs';
import { grabarPartida } from './grabar.mjs';
import { arrancarServidor } from './servidor.mjs';

export async function probarBot({ id, modo = 'vr', segundos = 12, idioma = 'es' }) {
  process.env.VRPLAY_ESCALA ??= '0.5';
  process.env.VRPLAY_SEGUNDOS = String(segundos);
  const carpeta = crear(path.join(TRABAJO, 'pruebas', `${id}-${modo}`));
  const estrategia = { ...estrategiaDe(id), segundos };
  const servidor = await arrancarServidor();
  let datos;
  try {
    datos = await grabarPartida({ urlBase: servidor.url, id, idioma, estrategia, carpeta, modo, reloj: 'virtual' });
  } finally {
    servidor.cerrar();
  }
  const fila = (video, salida) => ff(['-i', video, '-vf', `fps=6/${segundos},scale=180:320,tile=6x1`, '-frames:v', '1', salida]);
  const partes = [path.join(carpeta, 'fila-partida.jpg')];
  await fila(path.join(carpeta, 'partida.mp4'), partes[0]);
  if (fs.existsSync(path.join(carpeta, 'espectador.mp4')) && datos.modo === 'vr') {
    partes.push(path.join(carpeta, 'fila-espectador.jpg'));
    await fila(path.join(carpeta, 'espectador.mp4'), partes[1]);
  }
  const hoja = path.join(carpeta, 'hoja.jpg');
  if (partes.length > 1) await ff(['-i', partes[0], '-i', partes[1], '-filter_complex', 'vstack', hoja]);
  else fs.copyFileSync(partes[0], hoja);
  partes.forEach((p) => fs.rmSync(p, { force: true }));
  const impactos = datos.eventos.filter((e) => e.tipo === 'impacto');
  const puntuacion = datos.eventos.find((e) => e.tipo === 'puntuacion');
  const resumen = {
    id, modo: datos.modo, segundos: +datos.duracion.toFixed(1), impactos: impactos.length,
    primerImpacto: impactos[0]?.t ?? null, clics: datos.clics, objetivosVistos: datos.maxObjetivos,
    puntuacion: puntuacion ? puntuacion.texto ?? puntuacion.valor : null, errores: datos.errores, hoja,
  };
  fs.writeFileSync(path.join(carpeta, 'resumen.json'), JSON.stringify(resumen, null, 2));
  log(`${id} (${datos.modo}): ${resumen.impactos} impactos en ${resumen.segundos} s, ${resumen.clics} clics, ${resumen.objetivosVistos} objetivos vistos` +
    (resumen.puntuacion !== null ? `, puntuación ${resumen.puntuacion}` : '') + (datos.errores.length ? ` · errores: ${datos.errores.join(' | ')}` : '') + `\n  hoja: ${path.relative(process.cwd(), hoja)}`);
  return resumen;
}
