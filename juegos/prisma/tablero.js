// PRISMA: la lógica del tablero, sin nada de three.js (se prueba sola en Node).
// El tablero es una cuadrícula de ancho × alto casillas: i crece hacia la derecha (+x) y j hacia el
// fondo (−z). Las direcciones van de 0 a 3: 0 = derecha, 1 = fondo, 2 = izquierda, 3 = hacia ti.
// Los espejos tienen 4 posturas (o), de 45° en 45°: 0 «—», 1 «/», 2 «|», 3 «\». Un rayo que va en la
// dirección d sale de un espejo en la dirección (o − d) mód 4: los inclinados lo tuercen, y los
// rectos lo dejan pasar (si va a lo largo) o lo devuelven por donde ha venido.
// Piezas: emisor (lanza un rayo blanco), espejo (lo giras tú), prisma (un rayo blanco se abre en uno
// rojo hacia su izquierda y uno azul hacia su derecha; uno de color lo atraviesa), filtro (tiñe un
// rayo blanco de su color, deja pasar el suyo y para los demás), cristal (se enciende con un rayo de su
// color) y muro (para el rayo).

export const DI = [1, 0, -1, 0];
export const DJ = [0, 1, 0, -1];
export const COLORES = ['blanco', 'rojo', 'verde', 'azul'];

export function crearTablero(ancho, alto) {
  return { ancho, alto, celdas: new Array(ancho * alto).fill(null) };
}

export const celda = (t, i, j) => (i >= 0 && j >= 0 && i < t.ancho && j < t.alto ? t.celdas[j * t.ancho + i] : undefined);

export const salidaEspejo = (o, d) => (((o - d) % 4) + 4) % 4;

// Sigue los rayos de todos los emisores. Devuelve los tramos (de centro a centro de casilla, en
// coordenadas de casilla, con su color) y qué cristales quedan encendidos.
// «tramos» se rellena en el array que se pasa (para no crear objetos en cada fotograma).
export function trazar(t, tramos = [], encendidos = new Set()) {
  tramos.length = 0;
  encendidos.clear();
  const vistos = new Set();
  const cola = [];
  t.celdas.forEach((p, k) => {
    if (p && p.tipo === 'emisor') cola.push([k % t.ancho, Math.floor(k / t.ancho), p.dir, 'blanco']);
  });
  let pasos = 0;
  while (cola.length && pasos < 2000) {
    let [i, j, d, c] = cola.shift();
    let i0 = i;
    let j0 = j;
    for (;;) {
      if (++pasos > 2000) break;
      const ni = i + DI[d];
      const nj = j + DJ[d];
      const clave = ((nj * t.ancho + ni) * 4 + d) * 4 + COLORES.indexOf(c);
      const p = celda(t, ni, nj);
      if (p === undefined) {
        // Se sale del tablero: llega hasta el borde
        tramos.push({ i0, j0, i1: i + DI[d] * 0.5, j1: j + DJ[d] * 0.5, color: c });
        break;
      }
      if (vistos.has(clave)) {
        tramos.push({ i0, j0, i1: ni, j1: nj, color: c });
        break;
      }
      vistos.add(clave);
      i = ni;
      j = nj;
      if (!p) continue;
      if (p.tipo === 'muro' || p.tipo === 'emisor') {
        tramos.push({ i0, j0, i1: i - DI[d] * 0.5, j1: j - DJ[d] * 0.5, color: c });
        break;
      }
      if (p.tipo === 'cristal') {
        tramos.push({ i0, j0, i1: i, j1: j, color: c });
        if (p.color === c) encendidos.add(j * t.ancho + i);
        break;
      }
      if (p.tipo === 'espejo') {
        const d2 = salidaEspejo(p.o, d);
        if (d2 === d) continue;
        tramos.push({ i0, j0, i1: i, j1: j, color: c });
        i0 = i;
        j0 = j;
        d = d2;
        continue;
      }
      if (p.tipo === 'prisma') {
        if (c !== 'blanco') continue;
        tramos.push({ i0, j0, i1: i, j1: j, color: c });
        cola.push([i, j, (d + 1) % 4, 'rojo'], [i, j, (d + 3) % 4, 'azul']);
        break;
      }
      if (p.tipo === 'filtro') {
        if (c !== 'blanco' && c !== p.color) {
          tramos.push({ i0, j0, i1: i, j1: j, color: c });
          break;
        }
        if (c === p.color) continue;
        tramos.push({ i0, j0, i1: i, j1: j, color: c });
        i0 = i;
        j0 = j;
        c = p.color;
      }
    }
  }
  return { tramos, encendidos };
}

export function resuelto(t, encendidos) {
  let n = 0;
  for (const p of t.celdas) if (p && p.tipo === 'cristal') n++;
  return n > 0 && encendidos.size === n;
}

// Generador de números pseudoaleatorios con semilla (mulberry32)
export function azar(semilla) {
  let a = semilla >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let x = a;
    x = Math.imul(x ^ (x >>> 15), x | 1);
    x ^= x + Math.imul(x ^ (x >>> 7), x | 61);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

// Cómo es la sala número n
export function dificultad(n) {
  return {
    ancho: n <= 1 ? 5 : n <= 3 ? 6 : 7,
    alto: n <= 1 ? 4 : n <= 4 ? 5 : 6,
    giros: Math.min(8, 2 + Math.floor(n / 2)),     // espejos de la solución
    prisma: n >= 3,
    filtro: n >= 5,
    dosEmisores: n >= 8,
    senuelos: Math.min(5, Math.floor((n - 1) / 2)), // espejos que no hacen falta
    muros: Math.min(6, Math.floor(n / 2)),
  };
}

// Construye una sala con solución: lanza el rayo desde un emisor del borde, lo hace avanzar y
// pone en el camino los espejos (en la postura buena), prismas y filtros, y un cristal al final de
// cada rayo. Después añade señuelos y muros fuera del camino y desordena los espejos.
export function generar(n, semilla) {
  const rnd = azar(semilla);
  const ent = (a, b) => a + Math.floor(rnd() * (b - a + 1));
  const cfg = dificultad(n);
  for (let intento = 0; intento < 400; intento++) {
    const t = crearTablero(cfg.ancho, cfg.alto);
    const camino = new Set();          // casillas por las que pasa la solución (no se ponen piezas)
    const poner = (i, j, p) => { t.celdas[j * t.ancho + i] = p; camino.add(j * t.ancho + i); };
    const libre = (i, j) => celda(t, i, j) === null && !camino.has(j * t.ancho + i);
    const ramas = [];
    let fallo = false;
    const emisores = cfg.dosEmisores ? 2 : 1;
    for (let e = 0; e < emisores && !fallo; e++) {
      // Un emisor en un borde, mirando hacia dentro
      let i = 0;
      let j = 0;
      let d = 0;
      for (let k = 0; k < 30; k++) {
        const lado = ent(0, 3);
        if (lado === 0) { i = 0; j = ent(0, t.alto - 1); d = 0; }
        if (lado === 1) { i = t.ancho - 1; j = ent(0, t.alto - 1); d = 2; }
        if (lado === 2) { i = ent(0, t.ancho - 1); j = 0; d = 1; }
        if (lado === 3) { i = ent(0, t.ancho - 1); j = t.alto - 1; d = 3; }
        if (libre(i, j) && libre(i + DI[d], j + DJ[d])) break;
      }
      if (!libre(i, j)) { fallo = true; break; }
      poner(i, j, { tipo: 'emisor', dir: d });
      const giros = Math.max(1, Math.round(cfg.giros / emisores));
      ramas.push({ i, j, d, c: 'blanco', giros, prisma: cfg.prisma && e === 0, filtro: cfg.filtro && e === 0 });
    }
    let cristales = 0;
    while (ramas.length && !fallo) {
      const r = ramas.pop();
      // Avanza de 1 a 3 casillas por casillas vacías (puede cruzar otros rayos)
      const largo = ent(1, 3);
      let usada = false;
      for (let s = 0; s < largo; s++) {
        const ni = r.i + DI[r.d];
        const nj = r.j + DJ[r.d];
        const p = celda(t, ni, nj);
        if (p !== null) { fallo = s === 0; break; }
        r.i = ni;
        r.j = nj;
        usada = camino.has(nj * t.ancho + ni);
        camino.add(nj * t.ancho + ni);
      }
      // La pieza no puede ir en una casilla por la que ya pasa otro rayo
      if (fallo || usada) { fallo = true; break; }
      const opciones = [];
      if (r.giros > 0) {
        opciones.push('espejo', 'espejo', 'espejo');
        if (r.prisma && r.c === 'blanco') opciones.push('prisma', 'prisma');
        if (r.filtro && r.c === 'blanco') opciones.push('filtro');
      } else opciones.push('cristal');
      const tipo = opciones[ent(0, opciones.length - 1)];
      if (tipo === 'espejo') {
        const d2 = (r.d + (rnd() < 0.5 ? 1 : 3)) % 4;
        const o = (d2 + r.d) % 4;
        poner(r.i, r.j, { tipo: 'espejo', o, solucion: o });
        r.d = d2;
        r.giros -= 1;
        ramas.push(r);
      } else if (tipo === 'prisma') {
        poner(r.i, r.j, { tipo: 'prisma' });
        const resto = r.giros - 1;
        ramas.push({ i: r.i, j: r.j, d: (r.d + 1) % 4, c: 'rojo', giros: Math.ceil(resto / 2), prisma: false, filtro: false });
        ramas.push({ i: r.i, j: r.j, d: (r.d + 3) % 4, c: 'azul', giros: Math.floor(resto / 2), prisma: false, filtro: false });
      } else if (tipo === 'filtro') {
        const color = COLORES[ent(1, 3)];
        poner(r.i, r.j, { tipo: 'filtro', color });
        r.c = color;
        r.filtro = false;
        r.prisma = false;
        ramas.push(r);
      } else {
        poner(r.i, r.j, { tipo: 'cristal', color: r.c });
        cristales++;
      }
    }
    if (fallo || cristales === 0) continue;
    // Con los espejos bien puestos, se encienden todos los cristales
    const { encendidos } = trazar(t);
    if (!resuelto(t, encendidos)) continue;
    // Señuelos y muros, fuera del camino de la solución
    const vacias = [];
    for (let j = 0; j < t.alto; j++) for (let i = 0; i < t.ancho; i++) if (libre(i, j)) vacias.push([i, j]);
    for (let k = vacias.length - 1; k > 0; k--) {
      const m = Math.floor(rnd() * (k + 1));
      [vacias[k], vacias[m]] = [vacias[m], vacias[k]];
    }
    let v = 0;
    for (let s = 0; s < cfg.senuelos && v < vacias.length; s++, v++) {
      const [i, j] = vacias[v];
      t.celdas[j * t.ancho + i] = { tipo: 'espejo', o: ent(0, 3), solucion: -1 };
    }
    for (let s = 0; s < cfg.muros && v < vacias.length; s++, v++) {
      const [i, j] = vacias[v];
      t.celdas[j * t.ancho + i] = { tipo: 'muro' };
    }
    // Desordena los espejos de la solución hasta que la sala no esté resuelta
    const espejos = t.celdas.filter((p) => p && p.tipo === 'espejo' && p.solucion >= 0);
    let desordenado = false;
    for (let k = 0; k < 40 && !desordenado; k++) {
      for (const p of espejos) p.o = (p.solucion + ent(1, 3)) % 4;
      desordenado = !resuelto(t, trazar(t).encendidos);
    }
    if (!desordenado) continue;
    return t;
  }
  return null;
}
