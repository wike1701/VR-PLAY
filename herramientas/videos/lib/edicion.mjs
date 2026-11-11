// Línea de tiempo de la edición pro (--estilo pro, remotion/EdicionPro.jsx), estilo gaming viral:
//   - planos cortos (0,6-1,5 s) que cortan en los pulsos de la música,
//   - frames de impacto en los golpes grandes (congelado, destello, temblor, RGB separado y pegatina),
//   - rampa de velocidad (normal → lenta → rápida) o rebobinado en la frase que lo pida en el guion,
//   - gancho que empieza ya en el golpe más fuerte, y texto cinético con la palabra *clave* en color.
// Guion (guiones/<id>.json): frases { texto, plano, enfasis?, golpe?, efecto?: 'rampa' | 'rebobinado', pegatina? }
import { leer, mejorGolpe, palabrasDe, sinMarcas } from './guion.mjs';
import { mejorVentana } from './momentos.mjs';

const CORTO = 0.6; // s: el plano más corto
const LARGO = 1.5; // s: el más largo
const CONGELADO = 0.17; // s: lo que se para la imagen en un golpe (5 fotogramas)
const LENTA = 1 / 3; // velocidad de la rampa
const TRANSICIONES = ['barrido', 'zoom', 'glitch', 'barrido', 'destello', 'zoom'];
const VARIAR = { pov: 'zoom', zoom: 'espectador', espectador: 'pov', partida: 'pov' };

// Cortes entre a y b: en el pulso de la música más cercano a ~1 s, sin planos fuera de 0,6-1,5 s
export function partir(a, b, pulsos) {
  const cortes = [a];
  let c = a;
  while (b - c > LARGO) {
    const tope = Math.min(c + LARGO, b - CORTO);
    const cerca = pulsos.filter((p) => p >= c + CORTO && p <= tope).sort((x, y) => Math.abs(x - c - 1) - Math.abs(y - c - 1))[0];
    c = cerca ?? Math.min(c + 1, tope);
    cortes.push(c);
  }
  return cortes.map((d, i) => ({ en: d, dura: (cortes[i + 1] ?? b) - d }));
}

// Las palabras de una línea con su tiempo y si son la *clave*, en grupos de 1 a 3 (la clave va sola)
export function gruposDe(texto, en, dura) {
  const tiempos = palabrasDe(texto, en, dura);
  let dentro = false;
  const claves = texto.split(/\s+/).filter((w) => sinMarcas(w)).map((w) => {
    const antes = dentro;
    for (const c of w) if (c === '*') dentro = !dentro;
    return antes || w.includes('*');
  });
  const grupos = [];
  tiempos.forEach((p, i) => {
    const g = grupos[grupos.length - 1];
    const clave = !!claves[i];
    const anterior = g?.palabras[g.palabras.length - 1];
    const nuevo = !g || clave || anterior.clave || g.palabras.length >= 3 || g.palabras.reduce((s, x) => s + x.texto.length, 0) + p.texto.length > 14 || /[.!?…,]$/.test(anterior.texto);
    if (nuevo) grupos.push({ en: p.desde, palabras: [] });
    grupos[grupos.length - 1].palabras.push({ texto: p.texto, clave });
  });
  grupos.forEach((g, i) => (g.dura = +((grupos[i + 1]?.en ?? en + dura + 0.15) - g.en).toFixed(3)));
  return grupos;
}

/**
 * @param guion  de guionDe (con *claves*)
 * @param voz    de locutar, o null
 * @param datos  grabacion.json
 * @param espectador  si hay plano de espectador
 * @param pulsos  segundos de los golpes de la música (cortes al ritmo)
 * @param tempo   lo que se acelera la voz al mezclar (atempo), para medir bien las frases
 * @param pegatinas  textos de reacción (lib/textos.mjs)
 */
export function lineaDeEdicion({ guion, voz, datos, espectador, pulsos = [], tempo = 1, pegatinas = ['!'] }) {
  const { eventos, duracion } = datos;
  const lineas = [guion.gancho, ...guion.frases.map((f) => f.texto), guion.cierre];
  const durVoz = (i) => (voz?.frases[i]?.duracion ?? leer(sinMarcas(lineas[i]))) / tempo;
  const inicio = datos.modo === 'bruto' ? 0.3 : 1.5;
  const fin = duracion - 0.2;
  const ocupados = [];
  const planos = [];
  const textos = [];
  const habla = [];
  const extras = {}; // clips que prepara montar.mjs con ffmpeg: rampa (lenta) y rebobinado
  let n = 0; // para ir rotando transiciones y pegatinas
  const transicion = () => TRANSICIONES[n++ % TRANSICIONES.length];
  const pegatina = (f) => f?.pegatina || pegatinas[n % pegatinas.length];

  // Un golpe grande, con 0,75 s de partida antes: mejor lejos de lo ya usado; si no, uno que no se
  // haya usado ya como golpe; y si tampoco, el mejor que haya
  const usados = [];
  const golpe = () => {
    const t = mejorGolpe(eventos, inicio, fin, ocupados, 0.75) ?? mejorGolpe(eventos, inicio, fin, usados, 0.75) ?? mejorGolpe(eventos, inicio, fin, [], 0.75);
    if (t != null) { ocupados.push({ desde: t - 0.8, hasta: t + 0.8 }); usados.push({ desde: t, hasta: t }); }
    return t;
  };
  // Un trozo de partida de `largo` segundos, el más movido que quede libre
  const trozo = (largo) => {
    const v = mejorVentana(eventos, largo, inicio, fin, ocupados) || mejorVentana(eventos, largo, inicio, fin, []);
    if (v) ocupados.push(v);
    return v ? v.desde : inicio;
  };
  // Plano con frame de impacto en el golpe t: hasta el golpe, congelado y sigue desde el golpe
  const conImpacto = (p, t, f) => {
    const adelanto = Math.min(0.45, Math.max(0.2, p.dura - CONGELADO - 0.3));
    planos.push({ ...p, dura: adelanto, desde: Math.max(0, t - adelanto), fijo: true });
    planos.push({ tipo: 'congelado', en: p.en + adelanto, dura: CONGELADO, foto: t, pegatina: pegatina(f), transicion: 'corte' });
    planos.push({ tipo: p.tipo === 'espectador' ? 'zoom' : p.tipo, en: p.en + adelanto + CONGELADO, dura: p.dura - adelanto - CONGELADO, desde: t, fijo: true, transicion: 'corte' });
  };

  // Gancho: el golpe más fuerte con el texto gigante; sin intro
  const dg = Math.max(1.6, durVoz(0) + 0.35);
  const tg = golpe();
  if (tg != null) conImpacto({ tipo: 'pov', en: 0, dura: dg, transicion: 'ninguna' }, tg, null);
  else planos.push({ tipo: 'pov', en: 0, dura: dg, desde: trozo(dg), transicion: 'ninguna' });
  habla.push({ linea: 0, en: 0.06, dura: durVoz(0) });
  textos.push({ estilo: 'gancho', en: 0.04, dura: dg - 0.04, grupos: [{ en: 0.04, dura: dg - 0.04, palabras: gruposDe(lineas[0], 0, 1).flatMap((g) => g.palabras) }] });

  let t = dg;
  guion.frases.forEach((f, i) => {
    const dv = durVoz(i + 1);
    const dura = Math.max(1.1, dv + 0.25, f.efecto === 'rampa' ? 2.5 : f.efecto === 'rebobinado' ? 2.6 : 0);
    let tipo = ['pov', 'zoom', 'espectador', 'partida'].includes(f.plano) ? f.plano : 'pov';
    if (!espectador && (tipo === 'espectador' || tipo === 'partida')) tipo = i % 2 ? 'zoom' : 'pov';
    const entrada = transicion();

    if (f.efecto === 'rampa' && (tg != null)) {
      // Normal hasta el golpe, lenta (clip preparado con minterpolate) y rápida para salir
      const h = golpe();
      const pre = 0.4;
      const lenta = 0.42 / LENTA; // 0,42 s de partida a 1/3
      extras.rampa = { desde: +(h - 0.06).toFixed(3), largo: 0.42, factor: 1 / LENTA };
      planos.push({ tipo: 'pov', en: t, dura: pre, desde: h - pre, fijo: true, transicion: entrada });
      planos.push({ tipo: 'lenta', en: t + pre, dura: lenta, golpeEn: 0.06 / LENTA, pegatina: pegatina(f), transicion: 'corte' });
      planos.push({ tipo: 'zoom', en: t + pre + lenta, dura: dura - pre - lenta, desde: h + 0.36, velocidad: 1.6, fijo: true, transicion: 'barrido' });
    } else if (f.efecto === 'rebobinado' && (tg != null)) {
      // El golpe, congelado, rebobinado (hacia atrás al doble) y otra vez con zoom
      const h = golpe();
      const pre = 0.7;
      const atras = pre / 2;
      extras.rebobinado = { desde: +(h - pre).toFixed(3), largo: pre, factor: 2 };
      planos.push({ tipo: 'pov', en: t, dura: pre, desde: h - pre, fijo: true, transicion: entrada });
      planos.push({ tipo: 'congelado', en: t + pre, dura: 0.25, foto: h, pegatina: pegatina(f), transicion: 'corte' });
      planos.push({ tipo: 'rebobinado', en: t + pre + 0.25, dura: atras, transicion: 'glitch' });
      planos.push({ tipo: 'zoom', en: t + pre + 0.25 + atras, dura: dura - pre - 0.25 - atras, desde: h - pre, fijo: true, repeticion: true, transicion: 'corte' });
    } else {
      partir(t, t + dura, pulsos).forEach((s, k) => {
        const p = { tipo: k === 0 ? tipo : VARIAR[planos[planos.length - 1].tipo] || 'pov', en: s.en, dura: s.dura, transicion: k === 0 ? entrada : 'corte' };
        if (!espectador && (p.tipo === 'espectador' || p.tipo === 'partida')) p.tipo = 'zoom';
        if (f.golpe && k === 0 && s.dura >= 0.8) {
          const h = golpe();
          if (h != null) return conImpacto(p, h, f);
        }
        planos.push({ ...p, desde: trozo(s.dura) });
      });
    }
    habla.push({ linea: i + 1, en: t + 0.05, dura: dv });
    textos.push({ estilo: 'frase', en: t + 0.05, dura: dura - 0.05, grupos: gruposDe(lineas[i + 1], t + 0.05, dv) });
    t += dura;
  });

  // Los planos sueltos, en el orden de la partida (lo que pasa en el juego va hacia delante)
  const sueltos = planos.filter((p) => p.desde != null && !p.fijo);
  const desdes = sueltos.map((p) => p.desde).sort((a, b) => a - b);
  sueltos.forEach((p, i) => (p.desde = +Math.min(desdes[i], fin - p.dura).toFixed(3)));

  // Cierre: tarjeta de VR Play con su frase
  const dc = Math.max(3.4, durVoz(lineas.length - 1) + 0.9);
  planos.push({ tipo: 'cierre', en: t, dura: dc, transicion: 'destello' });
  habla.push({ linea: lineas.length - 1, en: t + 0.3, dura: durVoz(lineas.length - 1) });
  t += dc;

  for (const p of planos) for (const k of ['en', 'dura', 'desde']) if (p[k] != null) p[k] = +p[k].toFixed(3);
  // Golpes de la partida (para el zoom de golpe en cada acierto)
  const impactos = eventos.filter((e) => e.tipo === 'impacto' && e.nivel !== 'pequeño').map((e) => e.t);
  return { planos, textos, habla, impactos, extras, duracion: +t.toFixed(3), lineas };
}
