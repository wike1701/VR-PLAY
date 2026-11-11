// El guion de cada vídeo y su línea de tiempo, que manda la voz en off:
//   guionDe       el guion del juego (guiones/<id>.json) o, si no hay, uno hecho con plantillas.
//   locutar       pone voz a sus líneas con Chatterbox (locutar_natural.py, más natural) o, si no está
//                 instalado o se pide --voz kokoro, con Kokoro (locutar.py); se reutiliza si el texto no cambia.
//   lineaDeTiempo reparte los planos: gancho (3 s), una escena por frase, que dura lo que la frase
//                 (las largas se parten en dos planos), el final con la puntuación y el cierre. A cada
//                 escena le busca un trozo libre de la partida (lib/momentos.mjs) que pegue con su plano.
// Todos los tiempos, en segundos: `en` y `dura` del vídeo final, `desde` de partida.mp4.
import fs from 'node:fs';
import path from 'node:path';
import { createHash } from 'node:crypto';
import { CARPETA, PYTHON, PYTHON_VOZ, ejecutar, log } from './comun.mjs';
import { PESO, mejorVentana } from './momentos.mjs';
import { gancho as ganchoPlantilla, textosVideo } from './textos.mjs';

export const FPS = 30;
export const GANCHO = 3;
const PLANOS = ['espectador', 'pov', 'partida', 'lenta', 'zoom'];
const LENTA = 0.35; // velocidad de la cámara lenta
// Plano con el que se completa una escena larga partida en dos
const OTRO = { pov: 'espectador', espectador: 'pov', partida: 'zoom', zoom: 'espectador', lenta: 'pov' };

// { gancho, frases: [{ texto, plano }], cierre, propio } en el idioma pedido
export function guionDe(id, idioma, { juego, unidad, puntuacion, frases }) {
  const archivo = path.join(CARPETA, 'guiones', `${id}.json`);
  const g = fs.existsSync(archivo) ? JSON.parse(fs.readFileSync(archivo, 'utf8'))[idioma] : null;
  if (g?.frases?.length) return { ...g, propio: true };
  // Sin guion: el gancho de siempre, las frases de la descripción y la llamada a jugar
  const t = textosVideo(idioma);
  return {
    gancho: ganchoPlantilla(idioma, unidad, puntuacion),
    frases: frases.slice(0, 5).map((texto, i) => ({ texto, plano: PLANOS[i % PLANOS.length] })),
    cierre: `${t.juegaGratis} VR Play`,
    propio: false,
    titulo: juego.titulo,
  };
}

// La palabra clave de una frase va entre *asteriscos* (la edición pro la pinta en color); fuera, no se ve
export const sinMarcas = (texto) => texto.replace(/\*/g, '');

// Los ajustes de Chatterbox (locutar_natural.py): los de siempre y los de la edición pro, con más
// énfasis (más expresión, menos guía: habla con más subidas y bajadas) y 5 tomas para quedarse con la más viva
export const AJUSTES_VOZ = {
  normal: { expresion: 0.5, guia: 0.5, temperatura: 0.7, tomas: 1 },
  pro: { expresion: 0.95, guia: 0.3, temperatura: 0.85, tomas: 5 },
};
// El "enfasis" de los guiones está pensado para una expresión de 0,85: se escala a la de los ajustes
export const conEnfasis = (texto, enfasis, ajustes) => ({ texto, ...(enfasis ? { enfasis: +(enfasis * ajustes.expresion / 0.85).toFixed(3) } : {}) });
// El repaso de la voz pro al mezclar (repasoDeVoz): más rápida y un poco más aguda («chispa rápida»)
export const REPASO_PRO = { tempo: 1.14, tono: 1.03 };

// La voz de las líneas [gancho, ...frases, cierre] (texto o { texto, enfasis }): { frases: [{ texto,
// archivo, duracion }] } con los WAV en <carpeta>/voz/. Si el texto, el motor y los ajustes no han
// cambiado, no se repite. motor: 'natural' (Chatterbox, si está .venv-voz) o 'kokoro'
export async function locutar(lineas, idioma, carpeta, motor = 'natural', ajustes = AJUSTES_VOZ.normal) {
  const natural = motor !== 'kokoro' && fs.existsSync(PYTHON_VOZ);
  if (motor === 'natural' && !natural) log('sin Chatterbox (.venv-voz): la voz sale con Kokoro (ver GUIA.md)');
  const dir = path.join(carpeta, 'voz');
  // La voz de referencia (medios/voces/<idioma>.wav) también cuenta: si se cambia, se repite la voz
  const referencia = path.join(CARPETA, 'medios', 'voces', `${idioma}.wav`);
  const deReferencia = natural && fs.existsSync(referencia) ? fs.statSync(referencia).mtimeMs : null;
  // Kokoro no sabe de énfasis ni de marcas: solo el texto
  if (!natural) lineas = lineas.map((l) => sinMarcas(typeof l === 'string' ? l : l.texto));
  const huella = createHash('sha1').update(JSON.stringify([idioma, lineas, natural, deReferencia, natural ? ajustes : null])).digest('hex').slice(0, 12);
  const indice = path.join(dir, 'voz.json');
  if (fs.existsSync(indice)) {
    const previo = JSON.parse(fs.readFileSync(indice, 'utf8'));
    if (previo.huella === huella) return { ...previo, dir };
  }
  if (!natural && !fs.existsSync(PYTHON)) throw new Error('Falta Kokoro: mira «Instalación» en GUIA.md (node fabrica.mjs comprobar), o usa --sin-voz');
  fs.rmSync(dir, { recursive: true, force: true });
  fs.mkdirSync(dir, { recursive: true });
  const entrada = path.join(dir, 'frases.json');
  fs.writeFileSync(entrada, JSON.stringify({ idioma, frases: lineas }));
  const opciones = natural ? Object.entries(ajustes).flatMap(([k, v]) => [`--${k}`, String(v)]) : [];
  await ejecutar(natural ? PYTHON_VOZ : PYTHON, ['-X', 'utf8', path.join(CARPETA, natural ? 'locutar_natural.py' : 'locutar.py'), entrada, dir, ...opciones]);
  // Chatterbox a veces se inventa palabras al final de una frase: Whisper las encuentra y se cortan
  if (natural && fs.existsSync(PYTHON)) await ejecutar(PYTHON, ['-X', 'utf8', path.join(CARPETA, 'repasar_voz.py'), dir]);
  const voz = JSON.parse(fs.readFileSync(indice, 'utf8'));
  voz.huella = huella;
  fs.writeFileSync(indice, JSON.stringify(voz));
  return { ...voz, dir };
}

// Duración estimada de una línea sin voz (--sin-voz): unas 14 letras por segundo
export const leer = (texto) => Math.max(1.2, texto.length / 14);

// Tiempos de cada palabra repartidos por letras (la voz habla a ritmo casi constante), con una pausa
// en las comas y los puntos. Para los subtítulos palabra a palabra.
export function palabrasDe(texto, en, dura) {
  const palabras = sinMarcas(texto).split(/\s+/).filter(Boolean);
  const peso = palabras.map((p) => p.length + 1 + (/[,;:]$/.test(p) ? 3 : /[.!?…]$/.test(p) ? 5 : 0));
  const total = peso.reduce((a, b) => a + b, 0);
  let t = en;
  return palabras.map((p, i) => {
    const largo = (dura * peso[i]) / total;
    const r = { texto: p, desde: +t.toFixed(3), hasta: +(t + largo * 0.9).toFixed(3) };
    t += largo;
    return r;
  });
}

// El acierto más fuerte que no esté ya usado (para la cámara lenta y el gancho «reto»)
export function mejorGolpe(eventos, inicio, fin, ocupados, margen = 1.5) {
  let mejor = null;
  for (const e of eventos) {
    if (e.tipo !== 'impacto' || e.t < inicio + margen || e.t > fin - 0.5) continue;
    if (ocupados.some((o) => e.t > o.desde - 1 && e.t < o.hasta + 1)) continue;
    // Mejor si es grande y llegan otros justo después (la escena sigue teniendo acción)
    const valor = (PESO[e.nivel] ?? 1) + eventos.filter((x) => x.tipo === 'impacto' && x.t > e.t && x.t < e.t + 1.5).length * 0.3;
    if (!mejor || valor > mejor.valor) mejor = { t: e.t, valor };
  }
  return mejor?.t ?? null;
}

// Un trozo libre de `largo` segundos de partida; si no queda ninguno libre, el mejor aunque se repita
function trozo(eventos, largo, inicio, fin, ocupados) {
  const v = mejorVentana(eventos, largo, inicio, fin, ocupados) || mejorVentana(eventos, largo, inicio, fin, []);
  if (!v) return { desde: inicio, hasta: inicio + largo };
  ocupados.push(v);
  return { desde: v.desde, hasta: v.hasta };
}

/**
 * @param guion   de guionDe
 * @param voz     de locutar, o null (sin voz: los tiempos se estiman)
 * @param datos   grabacion.json
 * @param gancho  tipo de gancho (web, persona, impacto, reto)
 * @param espectador  si hay plano de espectador (solo en las grabaciones en VR)
 */
export function lineaDeTiempo({ guion, voz, datos, gancho, espectador }) {
  const { eventos, duracion } = datos;
  const lineas = [guion.gancho, ...guion.frases.map((f) => f.texto), guion.cierre];
  const durVoz = (i) => voz?.frases[i]?.duracion ?? leer(lineas[i]);
  const punt = eventos.find((e) => e.tipo === 'puntuacion') || null;
  const inicio = 1.5;
  const fin = punt ? punt.t : duracion - 0.3;
  const ocupados = [];
  const habla = []; // { linea, en, dura, subtitulos }

  // Gancho: en «reto» se congela justo antes de un golpe (cámara lenta a 0,5: 1,2 s de partida) y la
  // primera escena empieza con ese golpe, que es la respuesta
  let desdeGancho;
  let respuesta = null;
  if (gancho === 'reto') {
    const t = mejorGolpe(eventos, inicio, fin, ocupados);
    desdeGancho = t != null ? Math.max(0, t - 1.25) : inicio;
    if (t != null) {
      respuesta = t - 0.2;
      ocupados.push({ desde: desdeGancho, hasta: t + 0.5 });
    }
  } else {
    desdeGancho = trozo(eventos, GANCHO, inicio, fin, ocupados).desde;
  }
  const escenas = [{ plano: 'gancho', en: 0, dura: GANCHO, desde: +desdeGancho.toFixed(2) }];
  habla.push({ linea: 0, en: 0.25, dura: durVoz(0), subtitulos: false });

  // Una escena por frase: lo que dura la voz y un respiro; como mínimo 1,8 s
  let t = GANCHO;
  guion.frases.forEach((f, i) => {
    const dv = durVoz(i + 1);
    const dura = Math.max(1.8, dv + 0.35);
    let plano = PLANOS.includes(f.plano) ? f.plano : 'pov';
    if (!espectador && (plano === 'espectador' || plano === 'partida')) plano = i % 2 ? 'zoom' : 'pov';
    // Las largas, en dos planos (más cortes = más ritmo); la cámara lenta no se parte
    const partes = dura > 3.4 && plano !== 'lenta' ? [plano, espectador || OTRO[plano] !== 'espectador' ? OTRO[plano] : 'zoom'] : [plano];
    // Dos planos iguales seguidos no se notan como corte: se da la vuelta a la pareja
    // (y a una escena sola que repite el de la anterior se le pone el otro plano)
    const anterior = escenas[escenas.length - 1].plano;
    if (partes.length === 2 && anterior === partes[0]) partes.reverse();
    else if (partes.length === 1 && anterior === plano && plano !== 'lenta') {
      partes[0] = espectador || OTRO[plano] !== 'espectador' ? OTRO[plano] : 'zoom';
    }
    let local = t;
    partes.forEach((p, k) => {
      const d = dura / partes.length;
      const e = { plano: p, en: +local.toFixed(3), dura: +d.toFixed(3) };
      if (p === 'lenta') {
        const golpe = mejorGolpe(eventos, inicio, fin, ocupados, 0.6);
        const largo = d * LENTA;
        const desde = golpe != null ? golpe - largo * 0.4 : trozo(eventos, largo, inicio, fin, ocupados).desde;
        if (golpe != null) ocupados.push({ desde, hasta: desde + largo });
        Object.assign(e, { desde: +Math.max(0, desde).toFixed(2), velocidad: LENTA });
      } else if (respuesta != null && escenas.length === 1) {
        e.desde = +respuesta.toFixed(2);
        ocupados.push({ desde: respuesta, hasta: respuesta + d });
      } else {
        e.desde = +trozo(eventos, d, inicio, fin, ocupados).desde.toFixed(2);
      }
      escenas.push(e);
      local += d;
    });
    habla.push({ linea: i + 1, en: t + 0.12, dura: dv, subtitulos: true });
    t += dura;
  });

  // Las escenas a velocidad normal, en el orden de la partida (el marcador del juego siempre sube)
  const normales = escenas.filter((e) => e.plano !== 'gancho' && e.plano !== 'lenta' && !(respuesta != null && e === escenas[1]));
  const desdes = normales.map((e) => e.desde).sort((a, b) => a - b);
  normales.forEach((e, i) => (e.desde = desdes[i]));

  // Final con la puntuación del juego (si la partida llegó a darla)
  if (punt) {
    const desde = Math.max(inicio, punt.t - 1.2);
    escenas.push({ plano: 'final', en: +t.toFixed(3), dura: 3, desde: +desde.toFixed(2), puntuacionEn: +(punt.t - desde).toFixed(2) });
    t += 3;
  }
  const durCierre = Math.max(4, durVoz(lineas.length - 1) + 1);
  escenas.push({ plano: 'cierre', en: +t.toFixed(3), dura: +durCierre.toFixed(3) });
  habla.push({ linea: lineas.length - 1, en: t + 0.35, dura: durVoz(lineas.length - 1), subtitulos: false });
  t += durCierre;

  const subtitulos = habla.filter((h) => h.subtitulos).flatMap((h) => palabrasDe(lineas[h.linea], h.en, h.dura));
  return { escenas, habla, subtitulos, duracion: +t.toFixed(3), lineas };
}

// Repaso de la voz al mezclar (edición pro): quita graves sobrantes, comprime para que suene
// cercana y con pegada, realza la presencia (~3 kHz) y la acelera un poco. `rapido` además la sube
// medio tono (más brillante y con más chispa, sin que suene a dibujo animado)
export function repasoDeVoz({ tempo = 1.08, tono = 1 } = {}) {
  const cadena = ['highpass=f=90', 'acompressor=threshold=0.06:ratio=4:attack=4:release=60:makeup=2.5',
    'equalizer=f=3200:t=q:w=1.2:g=5', 'equalizer=f=200:t=q:w=1:g=1.5'];
  if (tono !== 1) cadena.push('aresample=24000', `asetrate=${Math.round(24000 * tono)}`, 'aresample=24000');
  cadena.push(`atempo=${(tempo / tono).toFixed(4)}`, 'alimiter=limit=0.95');
  return cadena.join(',');
}

// Muestras para elegir la entonación (fabrica.mjs voz-prueba <id>): el gancho y dos frases del guion
// con varios ajustes (y su repaso), cada uno en un WAV seguido, en salida/pruebas-voz/<id>/
export const PRUEBAS_VOZ = {
  energico: { ajustes: { expresion: 0.85, guia: 0.3, temperatura: 0.8, tomas: 3 }, repaso: { tempo: 1.08 } },
  chispa: { ajustes: AJUSTES_VOZ.pro, repaso: { tempo: 1.08 } },
  'chispa-rapida': { ajustes: AJUSTES_VOZ.pro, repaso: REPASO_PRO },
};
export async function pruebaDeVoz(id, idioma, destino) {
  const g = JSON.parse(fs.readFileSync(path.join(CARPETA, 'guiones', `${id}.json`), 'utf8'))[idioma];
  if (!g) throw new Error(`guiones/${id}.json no tiene guion en ${idioma}`);
  const lineas = [{ texto: g.gancho, enfasis: g.enfasis }, ...g.frases.filter((f) => f.golpe).slice(0, 2)];
  const salidas = [];
  for (const [nombre, { ajustes: base, repaso }] of Object.entries(PRUEBAS_VOZ)) {
    // Las que comparten ajustes comparten voz (solo cambia el repaso)
    const carpeta = path.join(destino, nombre === 'chispa-rapida' ? 'chispa' : nombre);
    // El énfasis de cada frase manda sobre el del ajuste, con la misma proporción
    const escaladas = lineas.map((l) => conEnfasis(l.texto, l.enfasis, base));
    const voz = await locutar(escaladas, idioma, carpeta, 'natural', base);
    const { ff } = await import('./comun.mjs');
    const salida = path.join(destino, `${id}-${idioma}-${nombre}.wav`);
    const entradas = voz.frases.flatMap((f) => ['-i', path.join(voz.dir, f.archivo)]);
    const filtro = voz.frases.map((_, i) => `[${i}:a]${repasoDeVoz(repaso)},apad=pad_dur=0.4[p${i}]`).join(';') + ';' + voz.frases.map((_, i) => `[p${i}]`).join('') + `concat=n=${voz.frases.length}:v=0:a=1[a]`;
    await ff([...entradas, '-filter_complex', filtro, '-map', '[a]', salida]);
    salidas.push({ nombre, salida, expresividad: voz.frases.map((f) => f.expresividad) });
  }
  return salidas;
}
