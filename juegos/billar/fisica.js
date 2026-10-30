// Física y generador de mesas del Billar de Trucos. No usa three.js: así la misma física sirve
// para jugar, para comprobar que cada mesa tiene solución y para las simulaciones de prueba.
//
// Todo pasa en el plano de la mesa (x a la derecha, z hacia el fondo en negativo) y la altura «y»
// de cada bola sobre el paño (0 = rodando; más = en el aire tras una rampa).

export const R = 0.028;              // radio de las bolas (m)
export const MARCA = { x: 0, z: -0.55 }; // de donde sale siempre la blanca
export const ABANICO = (70 * Math.PI) / 180; // se puede tirar hasta 70° a cada lado
export const POTENCIA_MIN = 0.5;     // m/s
export const POTENCIA_MAX = 6.5;
const G = 9.8;
const REBOTE_BANDA = 0.78;
const REBOTE_BOLA = 0.95;
const PASO = 1 / 240;

// ─── Utilidades ───────────────────────────────────────────────────────────
// Generador de números aleatorios con semilla (cada mesa se puede repetir igual)
export function aleatorio(semilla) {
  let s = semilla >>> 0;
  return () => {
    s = (s + 0x6d2b79f5) >>> 0;
    let t = s;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function dentroPoligono(x, z, pol) {
  let dentro = false;
  for (let i = 0, j = pol.length - 1; i < pol.length; j = i++) {
    const [xi, zi] = pol[i];
    const [xj, zj] = pol[j];
    if ((zi > z) !== (zj > z) && x < ((xj - xi) * (z - zi)) / (zj - zi) + xi) dentro = !dentro;
  }
  return dentro;
}

// Se cortan los segmentos p→q y a→b (en el plano)?
function cruza(px, pz, qx, qz, ax, az, bx, bz) {
  const d = (qx - px) * (bz - az) - (qz - pz) * (bx - ax);
  if (Math.abs(d) < 1e-12) return false;
  const u = ((ax - px) * (bz - az) - (az - pz) * (bx - ax)) / d;
  const v = ((ax - px) * (qz - pz) - (az - pz) * (qx - px)) / d;
  return u >= 0 && u <= 1 && v >= 0 && v <= 1;
}

// Extremos de una pared en el instante t (las móviles se desplazan de lado a lado)
function extremos(p, t, salida) {
  let ox = 0;
  let oz = 0;
  if (p.movil) {
    const s = Math.sin(t * p.movil.vel + p.movil.fase) * p.movil.amp;
    ox = p.movil.dx * s;
    oz = p.movil.dz * s;
  }
  salida[0] = p.ax + ox;
  salida[1] = p.az + oz;
  salida[2] = p.bx + ox;
  salida[3] = p.bz + oz;
  return salida;
}

// ─── Un paso de la física ─────────────────────────────────────────────────
const ext = [0, 0, 0, 0];
// ev(tipo, a, b, c): 'tronera' (bola, tronera), 'aro' (bola, aro), 'banda' (bola, rapidez),
// 'choque' (bola, bola, rapidez), 'rebotador' (bola, poste), 'salto' (bola), 'fuera' (bola)
export function paso(mesa, bolas, t, h, ev) {
  for (let i = 0; i < bolas.length; i++) {
    const b = bolas[i];
    if (!b.activa) continue;
    const px = b.x;
    const pz = b.z;
    // En el aire: cae; al tocar el paño, rebota un poco y sigue rodando
    if (b.y > 0 || b.vy > 0) {
      b.vy -= G * h;
      b.y += b.vy * h;
      if (b.y <= 0) {
        b.y = 0;
        b.vy = b.vy < -0.6 ? -b.vy * 0.3 : 0;
        if (!dentroPoligono(b.x, b.z, mesa.poligono)) {
          b.activa = false;
          ev && ev('fuera', i);
          continue;
        }
      }
    } else {
      // Rodando: rozamiento del paño (algo constante y algo según la rapidez)
      const v = Math.hypot(b.vx, b.vz);
      if (v > 0) {
        const nueva = Math.max(0, v - (mesa.rozamiento + 0.11 * v) * h);
        b.vx *= nueva / v;
        b.vz *= nueva / v;
      }
    }
    b.x += b.vx * h;
    b.z += b.vz * h;
    // Rampas: si entra rodando en la dirección de la rampa, salta
    if (b.y === 0) {
      for (const r of mesa.rampas) {
        const lx = b.x - r.x;
        const lz = b.z - r.z;
        const a = lx * r.dx + lz * r.dz;
        const c = lx * -r.dz + lz * r.dx;
        if (a > -r.largo / 2 && a < r.largo / 2 && Math.abs(c) < r.ancho / 2) {
          const vd = b.vx * r.dx + b.vz * r.dz;
          if (vd > 0.6 && a > 0) {
            b.vy = vd * 0.5;
            b.y = 0.0005;
            ev && ev('salto', i);
          }
        }
      }
    }
    // Troneras
    if (b.y < 0.01) {
      for (let k = 0; k < mesa.troneras.length; k++) {
        const tr = mesa.troneras[k];
        if ((b.x - tr.x) ** 2 + (b.z - tr.z) ** 2 < tr.r * tr.r) {
          b.activa = false;
          ev && ev('tronera', i, k);
          break;
        }
      }
      if (!b.activa) continue;
    }
    // Aros: la bola cruza la línea entre sus dos postes
    for (let k = 0; k < mesa.aros.length; k++) {
      const a = mesa.aros[k];
      if (b.y < 0.08 && cruza(px, pz, b.x, b.z, a.ax, a.az, a.bx, a.bz)) ev && ev('aro', i, k);
    }
    // Paredes (bandas, muros y barreras bajas que se pueden saltar)
    for (const p of mesa.paredes) {
      if (b.y > p.alto) continue;
      const [ax, az, bx, bz] = extremos(p, t, ext);
      const ex = bx - ax;
      const ez = bz - az;
      const l2 = ex * ex + ez * ez;
      let u = ((b.x - ax) * ex + (b.z - az) * ez) / l2;
      u = u < 0 ? 0 : u > 1 ? 1 : u;
      const cx = ax + ex * u;
      const cz = az + ez * u;
      const dx = b.x - cx;
      const dz = b.z - cz;
      const d2 = dx * dx + dz * dz;
      if (d2 < R * R && d2 > 1e-12) {
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const nz = dz / d;
        const vn = b.vx * nx + b.vz * nz;
        b.x = cx + nx * R;
        b.z = cz + nz * R;
        if (vn < 0) {
          b.vx -= (1 + REBOTE_BANDA) * vn * nx;
          b.vz -= (1 + REBOTE_BANDA) * vn * nz;
          b.vx *= 0.98;
          b.vz *= 0.98;
          if (-vn > 0.15) ev && ev('banda', i, -vn);
        }
      }
    }
    // Postes y rebotadores
    for (let k = 0; k < mesa.postes.length; k++) {
      const q = mesa.postes[k];
      if (b.y > q.alto) continue;
      const dx = b.x - q.x;
      const dz = b.z - q.z;
      const min = q.r + R;
      const d2 = dx * dx + dz * dz;
      if (d2 < min * min && d2 > 1e-12) {
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const nz = dz / d;
        const vn = b.vx * nx + b.vz * nz;
        b.x = q.x + nx * min;
        b.z = q.z + nz * min;
        if (vn < 0) {
          // El rebotador devuelve la bola con fuerza (como en un pinball)
          const sale = q.rebotador ? Math.max(-vn * 1.05, 1.6) : -vn * REBOTE_BANDA;
          b.vx += (-vn + sale) * nx;
          b.vz += (-vn + sale) * nz;
          ev && ev(q.rebotador ? 'rebotador' : 'banda', i, q.rebotador ? k : -vn);
        }
      }
    }
    // Se ha salido de la mesa (por un hueco o por encima de una banda): a la tronera más cercana o fuera
    if (b.y === 0 && !dentroPoligono(b.x, b.z, mesa.poligono)) {
      let cerca = -1;
      let mejor = 0.16;
      for (let k = 0; k < mesa.troneras.length; k++) {
        const d = Math.hypot(b.x - mesa.troneras[k].x, b.z - mesa.troneras[k].z);
        if (d < mejor) {
          mejor = d;
          cerca = k;
        }
      }
      b.activa = false;
      if (cerca >= 0) ev && ev('tronera', i, cerca);
      else ev && ev('fuera', i);
    }
  }
  // Choques entre bolas (a la misma altura)
  for (let i = 0; i < bolas.length; i++) {
    const a = bolas[i];
    if (!a.activa) continue;
    for (let j = i + 1; j < bolas.length; j++) {
      const b = bolas[j];
      if (!b.activa || Math.abs(a.y - b.y) > R) continue;
      const dx = b.x - a.x;
      const dz = b.z - a.z;
      const d2 = dx * dx + dz * dz;
      if (d2 < 4 * R * R && d2 > 1e-12) {
        const d = Math.sqrt(d2);
        const nx = dx / d;
        const nz = dz / d;
        const solape = 2 * R - d;
        a.x -= nx * solape * 0.5;
        a.z -= nz * solape * 0.5;
        b.x += nx * solape * 0.5;
        b.z += nz * solape * 0.5;
        const vr = (a.vx - b.vx) * nx + (a.vz - b.vz) * nz;
        if (vr > 0) {
          const imp = ((1 + REBOTE_BOLA) / 2) * vr;
          a.vx -= imp * nx;
          a.vz -= imp * nz;
          b.vx += imp * nx;
          b.vz += imp * nz;
          ev && ev('choque', i, j, vr);
        }
      }
    }
  }
}

export function enReposo(bolas) {
  for (const b of bolas) {
    if (!b.activa) continue;
    if (b.y > 0 || b.vy !== 0 || b.vx * b.vx + b.vz * b.vz > 0.0004) return false;
  }
  return true;
}

// Para del todo las bolas casi quietas (para que no se arrastren eternamente)
export function frenar(bolas) {
  for (const b of bolas) {
    if (b.activa && b.y === 0 && b.vx * b.vx + b.vz * b.vz < 0.0004) {
      b.vx = 0;
      b.vz = 0;
    }
  }
}

// Tras cada tiro, la blanca vuelve a la marca y se apartan las bolas que estén encima
export function devolverBlanca(bolas) {
  const blanca = bolas[0];
  Object.assign(blanca, { x: MARCA.x, z: MARCA.z, y: 0, vx: 0, vy: 0, vz: 0, activa: true });
  for (let i = 1; i < bolas.length; i++) {
    const b = bolas[i];
    if (!b.activa) continue;
    if (Math.hypot(b.x - MARCA.x, b.z - MARCA.z) < 0.12) {
      b.z = MARCA.z - 0.14;
      b.x = MARCA.x + (b.x - MARCA.x) * 0.5;
    }
  }
}

// La física de un tiro en pasos fijos: frenar y mirar si todo está quieto cada 24 pasos (igual en
// el juego y en la comprobación, para que un tiro dé siempre el mismo resultado)
export const PASOS_FRENADO = 24;

// Velocidad de la blanca para un tiro (ángulo respecto al fondo de la mesa y potencia en m/s)
export function velocidadTiro(angulo, potencia) {
  return { vx: Math.sin(angulo) * potencia, vz: -Math.cos(angulo) * potencia };
}

// ─── Retos ────────────────────────────────────────────────────────────────
// Un tiro simulado: devuelve lo que ha pasado (qué bolas han entrado y dónde, qué aros se han cruzado)
export function simularTiro(mesa, bolas, angulo, potencia, t0 = 0, maximo = 8, reto = null) {
  const copia = bolas.map((b) => ({ ...b }));
  const v = velocidadTiro(angulo, potencia);
  copia[0].vx = v.vx;
  copia[0].vz = v.vz;
  const res = { entradas: [], aros: [], fuera: [], bolas: copia };
  const ev = (tipo, a, b) => {
    if (tipo === 'tronera') res.entradas.push([a, b]);
    else if (tipo === 'aro' && a === 0) res.aros.push(b);
    else if (tipo === 'fuera') res.fuera.push(a);
  };
  let t = t0;
  for (let k = 0; k < maximo / PASO; k++) {
    paso(mesa, copia, t, PASO, ev);
    t += PASO;
    if ((k + 1) % PASOS_FRENADO === 0) {
      frenar(copia);
      if (enReposo(copia)) break;
      if (reto && cumple(reto, res, bolas)) break; // ya se sabe que vale
    }
  }
  return res;
}

// ¿Cumple este tiro el reto (sin meter una negra)?
export function cumple(reto, res, bolas) {
  for (const [bola] of res.entradas) if (bolas[bola].tipo === 'negra') return false;
  if (reto.tipo === 'aro') return res.aros.includes(reto.aro);
  if (reto.tipo === 'meter') return res.entradas.some(([bola, tr]) => bola === reto.bola && (reto.tronera < 0 || tr === reto.tronera));
  if (reto.tipo === 'truco') return res.aros.includes(reto.aro) && res.entradas.some(([bola]) => bola === reto.bola);
  return false;
}

// Ángulo de tiro (desde la marca) hacia un punto de la mesa
const anguloHacia = (x, z) => Math.atan2(x - MARCA.x, -(z - MARCA.z));

// Tiros que tienen sentido para un reto, como haría un jugador: a la «bola fantasma» para
// mandar la bola a cada tronera, o al centro del aro
function candidatos(mesa, bolas, reto) {
  const lista = [];
  const aBola = (b, troneras) => {
    for (const k of troneras) {
      const t = mesa.troneras[k];
      const l = Math.hypot(t.x - b.x, t.z - b.z);
      const gx = b.x - ((t.x - b.x) / l) * 2 * R;
      const gz = b.z - ((t.z - b.z) / l) * 2 * R;
      for (const d of [0, -0.4, 0.4, -0.9, 0.9]) for (const p of [2.4, 3.6, 5]) lista.push([anguloHacia(gx, gz) + (d * Math.PI) / 180, p]);
    }
  };
  const todas = mesa.troneras.map((_, k) => k);
  if (reto.tipo === 'meter') aBola(bolas[reto.bola], reto.tronera >= 0 ? [reto.tronera] : todas);
  if (reto.tipo === 'aro' || reto.tipo === 'truco') {
    const a = mesa.aros[reto.aro];
    for (const d of [0, -1, 1, -2, 2]) for (const p of [1.4, 2.4, 3.6, 5]) lista.push([anguloHacia((a.ax + a.bx) / 2, (a.az + a.bz) / 2) + (d * Math.PI) / 180, p]);
  }
  return lista.filter(([ang]) => Math.abs(ang) <= ABANICO);
}

// Busca un tiro que cumpla el reto (null si no hay). Es un generador: cada «yield» es un tiro
// simulado, para poder repartir la búsqueda entre fotogramas y que el juego no se pare.
export function* buscarTiroPorPartes(mesa, bolas, reto) {
  if ((reto.tipo === 'meter' || reto.tipo === 'truco') && !bolas[reto.bola].activa) return null;
  for (const [angulo, potencia] of candidatos(mesa, bolas, reto)) {
    if (cumple(reto, simularTiro(mesa, bolas, angulo, potencia, 0, 8, reto), bolas)) return { angulo, potencia };
    yield;
  }
  // Barrido del abanico (tiros a la banda, rebotadores, rampas…)
  for (let g = -69; g <= 69; g += 3) {
    for (const potencia of [1.6, 3, 4.6]) {
      const angulo = (g * Math.PI) / 180;
      if (cumple(reto, simularTiro(mesa, bolas, angulo, potencia, 0, 8, reto), bolas)) return { angulo, potencia };
      yield;
    }
  }
  return null;
}

// Lo mismo de una vez (para las pruebas)
export function buscarTiro(mesa, bolas, reto) {
  const it = buscarTiroPorPartes(mesa, bolas, reto);
  for (;;) {
    const r = it.next();
    if (r.done) return r.value;
  }
}

// ─── Generador de mesas ───────────────────────────────────────────────────
// Colores de las bolas de reto (sus nombres están en los idiomas: colores.<nombre>)
export const COLORES = [
  { nombre: 'roja', color: 0xd7263d },
  { nombre: 'amarilla', color: 0xf4c430 },
  { nombre: 'azul', color: 0x1f5fd1 },
  { nombre: 'verde', color: 0x1e9e5a },
  { nombre: 'morada', color: 0x7b3fbf },
  { nombre: 'naranja', color: 0xf07a1a },
];

// Forma de la mesa: polígono (sentido antihorario visto desde arriba) y troneras
function formaMesa(tipo, rnd) {
  const Z0 = -0.3; // borde de tu lado
  let ancho = 1.27;
  let largo = 2.3;
  if (tipo === 'larga') { ancho = 0.95 + rnd() * 0.15; largo = 2.8 + rnd() * 0.3; }
  if (tipo === 'ancha') { ancho = 1.7 + rnd() * 0.2; largo = 1.9 + rnd() * 0.2; }
  const x = ancho / 2;
  const zf = Z0 - largo;
  let pol;
  let troneras;
  if (tipo === 'octogono') {
    const c = 0.35;
    pol = [[-x, Z0], [x, Z0], [x, zf + c], [x - c, zf], [-x + c, zf], [-x, zf + c]];
    troneras = [[x - c / 2, zf + c / 2], [-x + c / 2, zf + c / 2], [0, zf], [x, (Z0 + zf) / 2], [-x, (Z0 + zf) / 2]];
  } else {
    pol = [[-x, Z0], [x, Z0], [x, zf], [-x, zf]];
    troneras = [[-x, Z0], [x, Z0], [x, (Z0 + zf) / 2], [-x, (Z0 + zf) / 2], [x, zf], [-x, zf]];
  }
  return { pol, troneras, ancho, largo, Z0, zf };
}

// Bandas: los lados del polígono, recortados donde hay troneras
function bandas(pol, troneras) {
  const paredes = [];
  for (let i = 0; i < pol.length; i++) {
    const [ax, az] = pol[i];
    const [bx, bz] = pol[(i + 1) % pol.length];
    const l = Math.hypot(bx - ax, bz - az);
    const ux = (bx - ax) / l;
    const uz = (bz - az) / l;
    // Huecos en el lado (troneras en los extremos o en medio)
    const cortes = [];
    for (const t of troneras) {
      const s = (t.x - ax) * ux + (t.z - az) * uz;
      const dist = Math.abs((t.x - ax) * -uz + (t.z - az) * ux);
      if (dist < 0.08 && s > -0.1 && s < l + 0.1) cortes.push([s - 0.075, s + 0.075]);
    }
    cortes.sort((a, b) => a[0] - b[0]);
    let desde = 0;
    for (const [c0, c1] of cortes) {
      if (c0 > desde + 0.02) paredes.push({ ax: ax + ux * desde, az: az + uz * desde, bx: ax + ux * c0, bz: az + uz * c0, alto: 0.05, tipo: 'banda' });
      desde = Math.max(desde, c1);
    }
    if (l > desde + 0.02) paredes.push({ ax: ax + ux * desde, az: az + uz * desde, bx, bz, alto: 0.05, tipo: 'banda' });
  }
  return paredes;
}

// Una mesa para el nivel n (1, 2, 3…), siempre igual para la misma semilla
export function generarMesa(n, semilla) {
  const rnd = aleatorio(semilla);
  const al = (a, b) => a + rnd() * (b - a);
  const elige = (lista) => lista[Math.floor(rnd() * lista.length)];

  // Nivel 1: billar de toda la vida, para que se entienda la mecánica
  const tipoMesa = n <= 2 ? 'clasica' : elige(n < 6 ? ['clasica', 'larga', 'ancha'] : ['clasica', 'larga', 'ancha', 'octogono', 'octogono']);
  const f = formaMesa(tipoMesa, rnd);
  const troneras = f.troneras.map(([x, z]) => ({ x, z, r: 0.06 }));
  // Las troneras de tu lado se quitan a partir del nivel 3 (así la blanca no se cuela sin querer)
  if (n >= 3) for (let i = troneras.length - 1; i >= 0; i--) if (troneras[i].z > f.Z0 - 0.05) troneras.splice(i, 1);
  const mesa = {
    tipo: tipoMesa,
    poligono: f.pol,
    troneras,
    paredes: bandas(f.pol, troneras),
    postes: [],
    aros: [],
    rampas: [],
    rozamiento: n >= 9 && rnd() < 0.3 ? 0.12 : 0.28, // a veces, paño rápido (casi hielo)
    zLejos: f.zf,
    ancho: f.ancho,
  };
  const bolas = [{ x: MARCA.x, y: 0, z: MARCA.z, vx: 0, vy: 0, vz: 0, vy0: 0, activa: true, tipo: 'blanca', color: -1 }];
  const ocupados = [[MARCA.x, MARCA.z, 0.35]];
  const libre = (x, z, r) => {
    if (!dentroPoligono(x, z, f.pol)) return false;
    for (const [a, b, s] of ocupados) if (Math.hypot(x - a, z - b) < r + s) return false;
    for (const t of troneras) if (Math.hypot(x - t.x, z - t.z) < r + 0.12) return false;
    for (const p of mesa.paredes) {
      const ex = p.bx - p.ax;
      const ez = p.bz - p.az;
      const u = Math.max(0, Math.min(1, ((x - p.ax) * ex + (z - p.az) * ez) / (ex * ex + ez * ez)));
      if (Math.hypot(x - (p.ax + ex * u), z - (p.az + ez * u)) < r + 0.05) return false;
    }
    return true;
  };
  const sitio = (r, zMin = f.zf + 0.1, zMax = f.Z0 - 0.5) => {
    for (let k = 0; k < 200; k++) {
      const x = al(-f.ancho / 2 + 0.1, f.ancho / 2 - 0.1);
      const z = al(zMin, zMax);
      if (libre(x, z, r)) {
        ocupados.push([x, z, r]);
        return [x, z];
      }
    }
    return null;
  };

  const retos = [];
  let coloresLibres = [0, 1, 2, 3, 4, 5].sort(() => rnd() - 0.5);
  const ponerBola = (tipo, zMin, zMax) => {
    const s = sitio(R * 2.5, zMin, zMax);
    if (!s) return -1;
    const color = tipo === 'color' ? coloresLibres.pop() : -1;
    bolas.push({ x: s[0], y: 0, z: s[1], vx: 0, vy: 0, vz: 0, activa: true, tipo, color });
    return bolas.length - 1;
  };

  if (n === 1) {
    // Tres bolas en triángulo hacia el fondo: mete dos
    const zc = f.Z0 - f.largo * 0.62;
    const pos = [[0, zc], [-R * 1.05, zc - R * 1.82], [R * 1.05, zc - R * 1.82]];
    for (const [x, z] of pos) {
      bolas.push({ x, y: 0, z, vx: 0, vy: 0, vz: 0, activa: true, tipo: 'color', color: coloresLibres.pop() });
      ocupados.push([x, z, R * 2]);
    }
    retos.push({ tipo: 'meter', bola: 1, tronera: -1 }, { tipo: 'meter', bola: 2, tronera: -1 });
    return { mesa, bolas, retos, tiros: 5 };
  }

  // Elementos según el nivel
  const nAros = n >= 2 ? (n === 2 ? 1 : Math.floor(al(0, n >= 6 ? 2.6 : 1.8))) : 0;
  const nRebotadores = n >= 3 ? Math.floor(al(n === 3 ? 1 : 0, Math.min(4, 1 + n / 3))) : 0;
  const nPostes = n >= 4 ? Math.floor(al(0, Math.min(4, n / 3))) : 0;
  const nNegras = n >= 4 ? Math.floor(al(n === 4 ? 1 : 0, Math.min(3, 1 + n / 5))) : 0;
  const conRampa = n >= 5 && (n === 5 || rnd() < 0.5);
  const nMuros = n >= 6 ? Math.floor(al(0, 2.4)) : 0;
  const conMovil = n >= 8 && rnd() < 0.55;

  // Rampa con una barrera baja detrás: hay que saltarla
  if (conRampa) {
    const z = al(f.zf + f.largo * 0.45, f.Z0 - 0.75);
    const x = al(-f.ancho / 2 + 0.3, f.ancho / 2 - 0.3);
    const giro = al(-0.35, 0.35);
    const dx = Math.sin(giro);
    const dz = -Math.cos(giro);
    mesa.rampas.push({ x, z, dx, dz, largo: 0.16, ancho: 0.2 });
    ocupados.push([x, z, 0.16]);
    // Barrera perpendicular, algo más allá
    const bx = x + dx * 0.32;
    const bz = z + dz * 0.32;
    mesa.paredes.push({ ax: bx - dz * 0.22, az: bz + dx * 0.22, bx: bx + dz * 0.22, bz: bz - dx * 0.22, alto: 0.035, tipo: 'barrera' });
    ocupados.push([bx, bz, 0.2]);
  }
  // Muros de madera dentro de la mesa
  for (let k = 0; k < nMuros; k++) {
    const s = sitio(0.18, f.zf + 0.3, f.Z0 - 0.7);
    if (!s) continue;
    const giro = al(0, Math.PI);
    const l = al(0.18, 0.32);
    mesa.paredes.push({ ax: s[0] - Math.cos(giro) * l, az: s[1] - Math.sin(giro) * l, bx: s[0] + Math.cos(giro) * l, bz: s[1] + Math.sin(giro) * l, alto: 0.06, tipo: 'muro' });
  }
  // Barrera que se mueve de lado a lado
  if (conMovil) {
    const s = sitio(0.25, f.zf + 0.4, f.Z0 - 0.8);
    if (s) {
      mesa.paredes.push({ ax: s[0] - 0.14, az: s[1], bx: s[0] + 0.14, bz: s[1], alto: 0.06, tipo: 'movil', movil: { amp: al(0.12, 0.22), vel: al(1.2, 2.2), fase: al(0, 6), dx: 1, dz: 0 } });
    }
  }
  for (let k = 0; k < nRebotadores; k++) {
    const s = sitio(0.06, f.zf + 0.2, f.Z0 - 0.6);
    if (s) mesa.postes.push({ x: s[0], z: s[1], r: 0.04, alto: 0.06, rebotador: true });
  }
  for (let k = 0; k < nPostes; k++) {
    const s = sitio(0.04, f.zf + 0.2, f.Z0 - 0.6);
    if (s) mesa.postes.push({ x: s[0], z: s[1], r: 0.018, alto: 0.07, rebotador: false });
  }
  // Aros: una puerta entre dos postes, que la blanca tiene que cruzar
  for (let k = 0; k < nAros; k++) {
    const s = sitio(0.14, f.zf + 0.3, f.Z0 - 0.6);
    if (!s) continue;
    const giro = al(-0.6, 0.6);
    const media = al(0.07, 0.1) - Math.min(0.02, n * 0.002); // cada vez más estrechos
    const ax = s[0] - Math.cos(giro) * media;
    const az = s[1] - Math.sin(giro) * media;
    const bx = s[0] + Math.cos(giro) * media;
    const bz = s[1] + Math.sin(giro) * media;
    mesa.aros.push({ ax, az, bx, bz, alto: 0.1 });
    mesa.postes.push({ x: ax, z: az, r: 0.012, alto: 0.1, rebotador: false, aro: true }, { x: bx, z: bz, r: 0.012, alto: 0.1, rebotador: false, aro: true });
    retos.push({ tipo: 'aro', aro: mesa.aros.length - 1 });
  }
  // Bolas de reto y negras
  let nColores = Math.max(1, Math.min(3, Math.floor(al(1, 2 + n / 5))) - (retos.length > 1 ? 1 : 0));
  if (n >= 5 && retos.length + nColores < 2) nColores = 2 - retos.length; // desde el nivel 5, al menos 2 retos
  for (let k = 0; k < nColores; k++) {
    const b = ponerBola('color');
    if (b < 0) continue;
    // A veces hay que meterla en una tronera concreta (la que brilla)
    const concreta = n >= 3 && rnd() < Math.min(0.6, 0.15 + n * 0.04) ? Math.floor(rnd() * troneras.length) : -1;
    retos.push({ tipo: 'meter', bola: b, tronera: concreta });
  }
  for (let k = 0; k < nNegras; k++) ponerBola('negra');
  // Un truco: pasar por un aro y meter una bola en el mismo tiro
  if (n >= 7 && mesa.aros.length && rnd() < 0.35) {
    const metida = retos.find((r) => r.tipo === 'meter');
    const aro = retos.find((r) => r.tipo === 'aro');
    if (metida && aro) {
      retos.splice(retos.indexOf(metida), 1);
      retos.splice(retos.indexOf(aro), 1);
      retos.push({ tipo: 'truco', aro: aro.aro, bola: metida.bola });
    }
  }
  if (!retos.length) return null;
  // Tiros: uno por reto y alguno de sobra (cada vez menos)
  const sobra = n < 4 ? 2 : n < 9 ? 1 : rnd() < 0.5 ? 1 : 0;
  return { mesa, bolas, retos, tiros: retos.length + sobra };
}

// ¿Se puede completar la mesa entera? Se juega como un jugador: busca un tiro para algún reto
// pendiente, lo simula (con todo lo que mueve), devuelve la blanca a la marca y sigue, sin pasar del
// número de tiros. Generador: cada «yield» es un tiro simulado.
export function* resolverPorPartes(m) {
  let bolas = m.bolas.map((b) => ({ ...b }));
  const hechos = m.retos.map(() => false);
  for (let tiro = 0; tiro < m.tiros; tiro++) {
    let jugada = null;
    for (let k = 0; k < m.retos.length && !jugada; k++) {
      if (hechos[k]) continue;
      const t = yield* buscarTiroPorPartes(m.mesa, bolas, m.retos[k]);
      if (t) jugada = t;
    }
    if (!jugada) return false;
    const res = simularTiro(m.mesa, bolas, jugada.angulo, jugada.potencia);
    m.retos.forEach((r, k) => {
      if (!hechos[k] && cumple(r, res, bolas)) hechos[k] = true;
    });
    if (hechos.every(Boolean)) return true;
    bolas = res.bolas;
    devolverBlanca(bolas);
  }
  return false;
}

// Genera una mesa que se puede completar. Generador (cada «yield» es un tiro simulado); devuelve la
// mesa con su semilla.
export function* mesaConSolucionPorPartes(n, semillaBase) {
  for (let intento = 0; intento < 30; intento++) {
    const semilla = semillaBase + intento * 7919;
    const m = generarMesa(n, semilla);
    yield;
    if (!m) continue;
    if (n === 1) return { ...m, semilla };
    if (yield* resolverPorPartes(m)) return { ...m, semilla };
  }
  return { ...generarMesa(1, semillaBase), semilla: semillaBase }; // por si acaso, la mesa fácil
}

export function mesaConSolucion(n, semillaBase) {
  const it = mesaConSolucionPorPartes(n, semillaBase);
  for (;;) {
    const r = it.next();
    if (r.done) return r.value;
  }
}
