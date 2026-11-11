// CIRCUITO SLOT
// Una pista de coches de slot sobre una mesa, vista desde arriba como en casa:
// estás de pie al borde de la mesa con el mando en la mano. Los coches van
// guiados por la ranura, así que solo controlas la velocidad. Si entras en una
// curva demasiado rápido, el coche derrapa y sale volando de la pista; al rato
// vuelve a su carril, parado. Carrera de 5 vueltas contra un rival en el otro carril.
// El circuito se genera al azar en cada carrera, con subidas y bajadas sobre pilares:
// en las subidas el coche pierde velocidad y en las bajadas gana. Como cada circuito es
// distinto, la puntuación compara tu tiempo con el de la carrera perfecta de ese circuito.
// En VR el gatillo es analógico, como el del mando de verdad: cuanto más aprietas,
// más corre. Con ratón o con el dedo: mantén pulsado para acelerar y suelta para frenar.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const VUELTAS = 5;
const Y_MESA = 0.8;
const Z_MESA = -1.25;          // centro de la mesa (el jugador está en z = 0)
const ANCHO_PISTA = 0.24;
const SEPARACION = 0.05;       // de la línea central a cada ranura
const N = 1200;                // puntos del trazado
// Circuito al azar: límites de la línea central sobre la mesa (x, z respecto a su centro)
const LIMITE_X = 1.26;
const LIMITE_Z = 0.56;
const RADIO_MIN = 0.17;        // la curva más cerrada que se puede tomar (el de reserva tiene 0,19)
const SEPARACION_MIN = 0.33;   // distancia mínima entre dos tramos distintos (sin tocarse)
const ALTURA_MAX = 0.16;       // lo más alto que sube la pista sobre la mesa
const G_PENDIENTE = 5;         // cuánto frenan las subidas y empujan las bajadas (m/s²)
// Trazado de reserva (el de siempre), por si no sale ninguno al azar: recta de meta delante
// del jugador, horquilla a la derecha, curvas enlazadas al fondo y curva larga a la izquierda.
const TRAZADO = [
  [-0.6, 0.52], [0.4, 0.52], [0.95, 0.48], [1.22, 0.12], [1.08, -0.33], [0.65, -0.5],
  [0.25, -0.3], [-0.15, -0.2], [-0.55, -0.45], [-1.0, -0.5], [-1.24, -0.1], [-1.05, 0.38],
];
// Física del coche (metros y segundos, a escala de la pista)
const VELOCIDAD_MAX = 2.9;
const ACELERACION = 7;
const FRENO_MOTOR = 6;         // al soltar el mando el motor frena
const AGARRE = 6;              // aceleración lateral que aguantan el imán y las ruedas
const LIMITE_DERRAPE = 0.35;
const TIEMPO_FUERA = 1.6;      // lo que tarda en volver a la pista
// Rival
const FRENO_PREVISTO = 4.5;

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  ctx.fondo(0x30384a);
  // Sin gafas, de pie junto a la mesa. Con la pantalla en vertical (móvil) la mesa no
  // cabe a lo ancho: entonces se ve más desde arriba, como asomado sobre la pista.
  let vistaVertical = null;
  function ajustarVista() {
    const vertical = ctx.camara.aspect < 1;
    if (vertical === vistaVertical) return;
    vistaVertical = vertical;
    ctx.vistaEscritorio(
      vertical ? new THREE.Vector3(0, 3.1, -0.3) : new THREE.Vector3(0, 1.75, 0.3),
      new THREE.Vector3(0, Y_MESA, Z_MESA + (vertical ? 0 : 0.05)),
    );
  }
  ajustarVista();

  // Junta varias geometrías ya colocadas en una sola (una llamada de dibujo).
  function fusionar(geos) {
    const partes = geos.map((g) => (g.index ? g.toNonIndexed() : g));
    const total = partes.reduce((n, g) => n + g.attributes.position.count, 0);
    const res = new THREE.BufferGeometry();
    for (const nombre of ['position', 'normal', 'uv']) {
      const tam = partes[0].attributes[nombre].itemSize;
      const datos = new Float32Array(total * tam);
      let o = 0;
      for (const g of partes) {
        datos.set(g.attributes[nombre].array, o);
        o += g.attributes[nombre].array.length;
      }
      res.setAttribute(nombre, new THREE.BufferAttribute(datos, tam));
    }
    for (const g of [...geos, ...partes]) g.dispose();
    return res;
  }

  // ─── Trazado al azar ───────────────────────────────────────────────────
  // Se parte de un óvalo (recta de meta delante del jugador, curva a la derecha, recta del fondo y
  // curva a la izquierda), con cada extremo de un radio y un largo distintos. Después se le hacen de
  // 1 a 3 entrantes o salientes suaves fuera de la recta de meta (a veces dos seguidos de signo
  // contrario: una curva en S). Se comprueba que cabe en la mesa, que todas las curvas se pueden
  // tomar y que dos tramos no se tocan; si no, se prueba otro.
  const ANCHO_MESA = 2.95;
  const FONDO_MESA = 1.55;
  function ovaloAlAzar() {
    const rd = 0.4 + Math.random() * 0.1;
    const ri = 0.4 + Math.random() * 0.1;
    const xd = LIMITE_X - rd - Math.random() * 0.25;
    const xi = -(LIMITE_X - ri - Math.random() * 0.25);
    const zf = Math.min(rd, ri); // la recta de meta
    const puntos = [];
    const tramo = (n, f) => { for (let i = 0; i < n; i++) puntos.push(f(i / n)); };
    tramo(80, (u) => new THREE.Vector3(xi + (xd - xi) * u, 0, zf));
    tramo(60, (u) => {
      const a = Math.PI / 2 - Math.PI * u;
      return new THREE.Vector3(xd + rd * Math.cos(a), 0, zf - rd + rd * Math.sin(a));
    });
    tramo(80, (u) => new THREE.Vector3(xd + (xi - xd) * u, 0, zf - 2 * rd + (2 * rd - 2 * ri) * u));
    tramo(60, (u) => {
      const a = -Math.PI / 2 - Math.PI * u;
      return new THREE.Vector3(xi + ri * Math.cos(a), 0, zf - ri + ri * Math.sin(a));
    });
    return { puntos, recta: xd - xi };
  }
  function trazadoAlAzar() {
    const { puntos, recta } = ovaloAlAzar();
    const curva = new THREE.CatmullRomCurve3(puntos, true, 'centripetal');
    const c = curva.getSpacedPoints(N).slice(0, N);
    const largo = curva.getLength();
    const finRecta = recta / largo; // la recta de meta va de u = 0 a u = finRecta
    const bultos = [];
    const n = 1 + Math.floor(Math.random() * 3);
    for (let k = 0; k < n; k++) {
      const w = (0.4 + Math.random() * 0.5) / largo;
      const u = finRecta + w + Math.random() * (1 - finRecta - 2 * w);
      const a = Math.random() < 0.75 ? -(0.15 + Math.random() * 0.35) : 0.05 + Math.random() * 0.1;
      bultos.push({ u, a, w });
      if (Math.random() < 0.3 && u + 2 * w < 1 - w) bultos.push({ u: u + 1.6 * w, a: -a * 0.8, w });
    }
    const t = new THREE.Vector3();
    const control = [];
    for (let i = 0; i < N; i += 10) {
      const u = i / N;
      let desvio = 0;
      for (const b of bultos) {
        const d = Math.abs(u - b.u);
        if (d < b.w) desvio += (b.a * (Math.cos((Math.PI * d) / b.w) + 1)) / 2;
      }
      t.subVectors(c[(i + 1) % N], c[(i - 1 + N) % N]).normalize();
      control.push(new THREE.Vector3(c[i].x - t.z * desvio, 0, c[i].z + t.x * desvio + Z_MESA));
    }
    return lineaCentral(control);
  }
  const lineaCentral = (control) => new THREE.CatmullRomCurve3(control, true, 'centripetal').getSpacedPoints(N).slice(0, N);

  // ¿Cabe en la mesa, se pueden tomar todas las curvas y no se tocan dos tramos?
  function trazadoValido(c) {
    for (let i = 0; i < N; i++) {
      if (Math.abs(c[i].x) > LIMITE_X || Math.abs(c[i].z - Z_MESA) > LIMITE_Z) return false;
      const a = c[(i - 4 + N) % N];
      const b = c[i];
      const d = c[(i + 4) % N];
      const abx = b.x - a.x;
      const abz = b.z - a.z;
      const bcx = d.x - b.x;
      const bcz = d.z - b.z;
      const k = Math.atan2(abx * bcz - abz * bcx, abx * bcx + abz * bcz) / ((Math.hypot(abx, abz) + Math.hypot(bcx, bcz)) / 2);
      if (Math.abs(k) > 1 / RADIO_MIN) return false;
    }
    const M = 200; // muestras (cada 6 puntos)
    for (let i = 0; i < M; i++) {
      for (let j = i + 25; j < M; j++) {
        if (M - j + i <= 25) continue; // vecinos al dar la vuelta
        const p = c[i * 6];
        const q = c[j * 6];
        if ((p.x - q.x) ** 2 + (p.z - q.z) ** 2 < SEPARACION_MIN ** 2) return false;
      }
    }
    return true;
  }

  // Alturas: una o dos subidas con forma de colina, lejos de la recta de meta (que va a ras de mesa)
  function alturasAlAzar() {
    const colinas = [];
    const n = Math.random() < 0.55 ? 2 : 1;
    for (let i = 0; i < n; i++) {
      const ancho = 0.1 + Math.random() * 0.1;               // fracción de la vuelta a cada lado
      const zona = n === 2 ? [0.15 + i * 0.37, 0.48 + i * 0.37] : [0.15, 0.85];
      colinas.push({
        centro: zona[0] + ancho + Math.random() * Math.max(0, zona[1] - zona[0] - 2 * ancho),
        ancho,
        alto: 0.06 + Math.random() * (ALTURA_MAX - 0.06),
      });
    }
    return (u) => colinas.reduce((h, c) => {
      const d = Math.abs(u - c.centro);
      return d < c.ancho ? Math.max(h, (c.alto * (Math.cos((Math.PI * d) / c.ancho) + 1)) / 2) : h;
    }, 0);
  }

  // Línea central del circuito de esta carrera, con las alturas en y (sobre la mesa)
  function nuevoCentro() {
    let c = null;
    for (let intento = 0; intento < 200 && !c; intento++) {
      const prueba = trazadoAlAzar();
      if (trazadoValido(prueba)) c = prueba;
    }
    c ||= lineaCentral(TRAZADO.map(([x, z]) => new THREE.Vector3(x, 0, z + Z_MESA)));
    const altura = alturasAlAzar();
    c.forEach((punto, i) => { punto.y = altura(i / N); });
    return c;
  }

  let centro = [];
  let tangentes = [];
  let normales = [];

  function crearCarril(desvio) {
    const puntos = centro.map((p, i) => p.clone().addScaledVector(normales[i], desvio));
    const acumulado = new Float32Array(N + 1);
    for (let i = 0; i < N; i++) acumulado[i + 1] = acumulado[i] + puntos[i].distanceTo(puntos[(i + 1) % N]);
    const largo = acumulado[N];
    // Curvatura con signo (positiva si gira hacia la normal) y velocidad máxima en cada punto
    const curvatura = new Float32Array(N);
    const maxima = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = puntos[(i - 4 + N) % N];
      const b = puntos[i];
      const c = puntos[(i + 4) % N];
      const ab = b.clone().sub(a);
      const bc = c.clone().sub(b);
      const angulo = Math.atan2(ab.x * bc.z - ab.z * bc.x, ab.dot(bc));
      curvatura[i] = angulo / ((ab.length() + bc.length()) / 2);
      maxima[i] = Math.min(VELOCIDAD_MAX, Math.sqrt(AGARRE / Math.max(1e-4, Math.abs(curvatura[i]))));
    }
    // Perfil de velocidad para la máquina: frena a tiempo antes de cada curva
    const perfil = Float32Array.from(maxima);
    for (let vuelta = 0; vuelta < 2; vuelta++) {
      for (let i = N - 1; i >= 0; i--) {
        const j = (i + 1) % N;
        const ds = acumulado[i + 1] - acumulado[i];
        perfil[i] = Math.min(perfil[i], Math.sqrt(perfil[j] * perfil[j] + 2 * FRENO_PREVISTO * ds));
      }
    }
    return { desvio, puntos, acumulado, largo, curvatura, maxima, perfil };
  }
  let carriles = [];

  // Índice del punto del carril a la distancia s (búsqueda binaria)
  function indice(carril, s) {
    const a = carril.acumulado;
    let lo = 0;
    let hi = N;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (a[m] <= s) lo = m; else hi = m;
    }
    return lo;
  }
  function posicion(carril, s, destino, direccion) {
    s = ((s % carril.largo) + carril.largo) % carril.largo;
    const i = indice(carril, s);
    const j = (i + 1) % N;
    const f = (s - carril.acumulado[i]) / Math.max(1e-6, carril.acumulado[i + 1] - carril.acumulado[i]);
    destino.lerpVectors(carril.puntos[i], carril.puntos[j], f);
    if (direccion) direccion.subVectors(carril.puntos[j], carril.puntos[i]).normalize();
    return i;
  }

  // ─── Habitación y mesa ─────────────────────────────────────────────────
  ctx.sueloBase(false);
  const suelo = new THREE.Mesh(
    R(new THREE.PlaneGeometry(8, 8).rotateX(-Math.PI / 2)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tablas(0xa0714a, { tablas: 8, repetir: [4, 4], semilla: 31 })) })),
  );
  suelo.position.z = -1.5;
  raiz.add(suelo);

  // Cuarto de juegos: paredes de ladrillo pintado (una malla), zócalo, un póster de
  // bandera a cuadros y una lámpara colgante sobre la mesa
  const paredes = new THREE.Mesh(
    R(fusionar([
      new THREE.PlaneGeometry(8, 4.2).translate(0, 2.1, -4.4),
      new THREE.PlaneGeometry(8, 4.2).rotateY(Math.PI / 2).translate(-3.6, 2.1, -0.4),
      new THREE.PlaneGeometry(8, 4.2).rotateY(-Math.PI / 2).translate(3.6, 2.1, -0.4),
    ])),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.ladrillos(0x8e9aaf, 0x6f7a8c, { filas: 12, columnas: 4, repetir: [5, 2], semilla: 33 })) })),
  );
  raiz.add(paredes);
  const zocalo = new THREE.Mesh(
    R(fusionar([
      new THREE.BoxGeometry(7.2, 0.14, 0.03).translate(0, 0.07, -4.38),
      new THREE.BoxGeometry(0.03, 0.14, 8).translate(-3.58, 0.07, -0.4),
      new THREE.BoxGeometry(0.03, 0.14, 8).translate(3.58, 0.07, -0.4),
    ])),
    R(new THREE.MeshLambertMaterial({ color: 0x3e2a1c })),
  );
  raiz.add(zocalo);
  const texPoster = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#111';
    g.fillRect(0, 0, tam, tam);
    const n = 8;
    const c = tam / n;
    for (let i = 0; i < n; i++) for (let k = 0; k < n; k++) {
      g.fillStyle = (i + k) % 2 ? '#f2f2f2' : '#151515';
      g.fillRect(i * c + c * 0.08 * Math.sin(k), k * c, c, c);
    }
    g.strokeStyle = '#ff6a3d';
    g.lineWidth = tam * 0.04;
    g.strokeRect(tam * 0.02, tam * 0.02, tam * 0.96, tam * 0.96);
  }, { tam: 128, semilla: 34 }));
  const poster = new THREE.Mesh(R(new THREE.PlaneGeometry(1.1, 0.8)), R(new THREE.MeshLambertMaterial({ map: texPoster })));
  poster.position.set(-1.4, 1.85, -4.37);
  raiz.add(poster);
  const pantalla = new THREE.Mesh(R(new THREE.CylinderGeometry(0.12, 0.42, 0.28, 18, 1, true)), R(new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.4, metalness: 0.5, side: THREE.DoubleSide })));
  pantalla.position.set(0, 3.4, Z_MESA); // por encima de la cámara del móvil en vertical (3,1 m)
  const bombilla = new THREE.Mesh(R(new THREE.CircleGeometry(0.4, 18).rotateX(Math.PI / 2)), R(new THREE.MeshBasicMaterial({ color: 0xfff3d6, toneMapped: false })));
  bombilla.position.set(0, 3.27, Z_MESA);
  const cableLampara = new THREE.Mesh(R(new THREE.CylinderGeometry(0.006, 0.006, 0.8, 4)), R(new THREE.MeshBasicMaterial({ color: 0x111111 })));
  cableLampara.position.set(0, 3.93, Z_MESA);
  raiz.add(pantalla, bombilla, cableLampara);

  const mesa = new THREE.Mesh(
    R(fusionar([
      new THREE.BoxGeometry(ANCHO_MESA + 0.08, 0.05, FONDO_MESA + 0.08).translate(0, Y_MESA - 0.035, Z_MESA),
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => new THREE.BoxGeometry(0.07, Y_MESA - 0.06, 0.07)
        .translate(sx * (ANCHO_MESA / 2 - 0.08), (Y_MESA - 0.06) / 2, Z_MESA + sz * (FONDO_MESA / 2 - 0.08))),
    ])),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.madera(0x6d4426, { semilla: 32 })) })),
  );
  raiz.add(mesa);
  // Tablero verde (como el césped de las maquetas)
  const tablero = new THREE.Mesh(
    R(new THREE.PlaneGeometry(ANCHO_MESA, FONDO_MESA).rotateX(-Math.PI / 2)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.cesped(0x3f8f3a, { repetir: [3, 2], semilla: 33 })) })),
  );
  tablero.position.set(0, Y_MESA - 0.009, Z_MESA);
  raiz.add(tablero);

  // ─── Pista: cinta de asfalto con las dos ranuras y bordes a rayas ──────
  // Construye una cinta a lo largo del trazado entre dos desvíos de la línea central,
  // a la altura de cada punto (y es lo que sube o baja respecto a la superficie de la pista).
  function cinta(desde, hasta, y, metrosPorRepeticion) {
    const pos = [];
    const uv = [];
    let recorrido = 0;
    const p = (i) => centro[i % N];
    const n = (i) => normales[i % N];
    for (let i = 0; i < N; i++) {
      const largo = p(i).distanceTo(p(i + 1));
      const v0 = recorrido / metrosPorRepeticion;
      const v1 = (recorrido + largo) / metrosPorRepeticion;
      recorrido += largo;
      const a0 = p(i).clone().addScaledVector(n(i), desde);
      const b0 = p(i).clone().addScaledVector(n(i), hasta);
      const a1 = p(i + 1).clone().addScaledVector(n(i + 1), desde);
      const b1 = p(i + 1).clone().addScaledVector(n(i + 1), hasta);
      // Dos triángulos mirando hacia arriba
      for (const [q, u, v] of [[a0, 0, v0], [a1, 0, v1], [b0, 1, v0], [b0, 1, v0], [a1, 0, v1], [b1, 1, v1]]) {
        pos.push(q.x, Y_MESA + q.y + y, q.z);
        uv.push(u, v);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    // Que todas las caras miren hacia arriba
    const nor = g.attributes.normal;
    for (let i = 0; i < nor.count; i++) nor.setXYZ(i, 0, 1, 0);
    return g;
  }

  // Canto de la pista: una tira vertical bajo cada borde (se ve en los tramos elevados)
  function faldon(desvio) {
    const pos = [];
    const p = (i) => centro[i % N];
    const n = (i) => normales[i % N];
    const abajo = 0.016;
    for (let i = 0; i < N; i++) {
      const a = p(i).clone().addScaledVector(n(i), desvio);
      const b = p(i + 1).clone().addScaledVector(n(i + 1), desvio);
      const ya = Y_MESA + a.y;
      const yb = Y_MESA + b.y;
      pos.push(a.x, ya, a.z, a.x, ya - abajo, a.z, b.x, yb, b.z, b.x, yb, b.z, a.x, ya - abajo, a.z, b.x, yb - abajo, b.z);
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(new Float32Array((pos.length / 3) * 2), 2));
    g.computeVertexNormals();
    return g;
  }

  const texPista = R(ctx.texturaCanvas((g, tam, azar) => {
    g.fillStyle = '#3b3e44';
    g.fillRect(0, 0, tam, tam);
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = azar() < 0.5 ? `rgba(255,255,255,${azar() * 0.06})` : `rgba(0,0,0,${azar() * 0.12})`;
      g.fillRect(azar() * tam, azar() * tam, 1 + azar() * 2, 1 + azar() * 2);
    }
    // Junta entre piezas de pista
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, 0, tam, 2);
    // Las dos ranuras con sus raíles de metal
    for (const u of [0.5 - SEPARACION / ANCHO_PISTA, 0.5 + SEPARACION / ANCHO_PISTA]) {
      const x = u * tam;
      g.fillStyle = '#c9cdd2';
      g.fillRect(x - tam * 0.032, 0, tam * 0.016, tam);
      g.fillRect(x + tam * 0.016, 0, tam * 0.016, tam);
      g.fillStyle = '#0a0a0a';
      g.fillRect(x - tam * 0.016, 0, tam * 0.032, tam);
    }
    // Línea blanca en los bordes
    g.fillStyle = '#e8e8e8';
    g.fillRect(tam * 0.03, 0, tam * 0.025, tam);
    g.fillRect(tam * 0.945, 0, tam * 0.025, tam);
  }, { semilla: 34 }));
  texPista.wrapS = THREE.ClampToEdgeWrapping;
  texPista.wrapT = THREE.RepeatWrapping;
  // Las mallas de la pista cambian de geometría en cada carrera (ver construirCircuito)
  const pista = new THREE.Mesh(new THREE.BufferGeometry(), R(new THREE.MeshLambertMaterial({ map: texPista })));
  raiz.add(pista);

  const texBorde = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#e53935';
    g.fillRect(0, 0, tam, tam / 2);
    g.fillStyle = '#f5f5f5';
    g.fillRect(0, tam / 2, tam, tam / 2);
  }, { tam: 64, semilla: 35 }));
  texBorde.wrapT = THREE.RepeatWrapping;
  const bordes = new THREE.Mesh(new THREE.BufferGeometry(), R(new THREE.MeshLambertMaterial({ map: texBorde })));
  const faldones = new THREE.Mesh(new THREE.BufferGeometry(), R(new THREE.MeshLambertMaterial({ color: 0x2b2d31, side: THREE.DoubleSide })));
  raiz.add(bordes, faldones);

  // Línea de meta a cuadros en el punto 0
  const texMeta = R(ctx.texturaCanvas((g, tam) => {
    const c = tam / 8;
    for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? '#111111' : '#f5f5f5';
      g.fillRect(i * c, j * (tam / 2), c, tam / 2);
    }
  }, { tam: 128, semilla: 36 }));
  const meta = new THREE.Mesh(R(new THREE.PlaneGeometry(ANCHO_PISTA, 0.035).rotateX(-Math.PI / 2)), R(new THREE.MeshLambertMaterial({ map: texMeta })));
  raiz.add(meta);

  // Pórtico de salida con el semáforo (tres luces en una malla instanciada)
  const portico = new THREE.Mesh(
    R(fusionar([
      new THREE.BoxGeometry(0.02, 0.22, 0.02).translate(0, 0.11, ANCHO_PISTA / 2 + 0.06),
      new THREE.BoxGeometry(0.02, 0.22, 0.02).translate(0, 0.11, -ANCHO_PISTA / 2 - 0.06),
      new THREE.BoxGeometry(0.03, 0.05, ANCHO_PISTA + 0.16).translate(0, 0.23, 0),
    ])),
    R(new THREE.MeshLambertMaterial({ color: 0x78909c })),
  );
  raiz.add(portico);
  const luces = new THREE.InstancedMesh(R(new THREE.SphereGeometry(0.014, 10, 8)), R(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })), 3);
  const auxObj = new THREE.Object3D();
  const auxColor = new THREE.Color();
  for (let i = 0; i < 3; i++) {
    auxObj.position.set(0.02, 0.23, (i - 1) * 0.045);
    auxObj.updateMatrix();
    luces.setMatrixAt(i, auxObj.matrix);
    luces.setColorAt(i, auxColor.setHex(0x331111));
  }
  portico.add(luces);
  function semaforo(encendidas, verde) {
    for (let i = 0; i < 3; i++) luces.setColorAt(i, auxColor.setHex(verde ? 0x00e676 : i < encendidas ? 0xff1744 : 0x331111));
    luces.instanceColor.needsUpdate = true;
  }

  // ─── Decorado de la maqueta: árboles, neumáticos y una grada ──────────
  // Se colocan solo en sitios del tablero lejos de la pista.
  function lejosDePista(x, z, margen, dentroDeLaMesa = true) {
    for (let i = 0; i < N; i += 6) {
      const p = centro[i];
      if ((p.x - x) ** 2 + (p.z - z) ** 2 < (ANCHO_PISTA / 2 + 0.035 + margen) ** 2) return false;
    }
    return !dentroDeLaMesa || (Math.abs(x) < ANCHO_MESA / 2 - margen && Math.abs(z - Z_MESA) < FONDO_MESA / 2 - margen);
  }
  const MAX_ARBOLES = 18;
  const MAX_NEUMATICOS = 60;
  const MAX_PILARES = 160;
  // Pinos de maqueta: los del kit de la shell a escala 1:25
  const pinoMaqueta = ctx.geometriaArbol('pino');
  const troncos = new THREE.InstancedMesh(R(pinoMaqueta.tronco.scale(0.04, 0.04, 0.04)), R(new THREE.MeshLambertMaterial({ color: pinoMaqueta.madera, flatShading: true })), MAX_ARBOLES);
  const copas = new THREE.InstancedMesh(R(pinoMaqueta.copa.scale(0.04, 0.04, 0.04)), R(new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true })), MAX_ARBOLES);
  for (let i = 0; i < MAX_ARBOLES; i++) copas.setColorAt(i, auxColor.setHex([0x2e7d32, 0x388e3c, 0x1b5e20, 0x558b2f][i % 4]));
  const neumaticos = new THREE.InstancedMesh(R(new THREE.TorusGeometry(0.016, 0.008, 6, 10).rotateX(Math.PI / 2)), R(new THREE.MeshLambertMaterial({ color: 0x1c1c1c })), MAX_NEUMATICOS * 2);
  // Pilares bajo los tramos elevados
  const pilares = new THREE.InstancedMesh(R(new THREE.BoxGeometry(1, 1, 1)), R(new THREE.MeshLambertMaterial({ color: 0xcfd8dc })), MAX_PILARES);
  for (const m of [troncos, copas, neumaticos, pilares]) m.count = 0;
  raiz.add(troncos, copas, neumaticos, pilares);

  // Grada con público al fondo de la mesa (gradas escalonadas en una malla)
  const texPublico = R(ctx.texturaCanvas((g, tam, az) => {
    g.fillStyle = '#9e9e9e';
    g.fillRect(0, 0, tam, tam);
    const colores = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#fb8c00', '#8e24aa', '#f5f5f5'];
    for (let i = 0; i < 260; i++) {
      g.fillStyle = colores[Math.floor(az() * colores.length)];
      g.beginPath();
      g.arc(az() * tam, az() * tam, tam * 0.018, 0, Math.PI * 2);
      g.fill();
    }
  }, { semilla: 37 }));
  const grada = new THREE.Mesh(
    R(fusionar([0, 1, 2].map((e) => new THREE.BoxGeometry(0.9, 0.035 * (e + 1), 0.06).translate(0, 0.0175 * (e + 1), -e * 0.06)))),
    R(new THREE.MeshLambertMaterial({ map: texPublico })),
  );
  raiz.add(grada);

  // ─── Construir el circuito de esta carrera ─────────────────────────────
  let tiempoIdeal = 0;      // la carrera perfecta en este circuito (para la puntuación)
  let carreras = 0;         // cuántos circuitos van (desde el segundo se avisa de que es nuevo)
  function reemplazar(malla, geometria) {
    malla.geometry.dispose();
    malla.geometry = geometria;
  }
  function construirCircuito() {
    centro = nuevoCentro();
    tangentes = centro.map((p, i) => centro[(i + 1) % N].clone().sub(centro[(i - 1 + N) % N]).normalize());
    // Normal hacia la izquierda de la marcha (en la recta de meta, hacia el jugador)
    normales = tangentes.map((t) => new THREE.Vector3(-t.z, 0, t.x).normalize());
    carriles = [crearCarril(SEPARACION), crearCarril(-SEPARACION)];
    jugador.carril = carriles[0];
    rival.carril = carriles[1];

    reemplazar(pista, cinta(ANCHO_PISTA / 2, -ANCHO_PISTA / 2, 0, 0.35));
    reemplazar(bordes, fusionar([
      cinta(ANCHO_PISTA / 2 + 0.035, ANCHO_PISTA / 2, -0.002, 0.1),
      cinta(-ANCHO_PISTA / 2, -ANCHO_PISTA / 2 - 0.035, -0.002, 0.1),
    ]));
    reemplazar(faldones, fusionar([faldon(ANCHO_PISTA / 2 + 0.035), faldon(-ANCHO_PISTA / 2 - 0.035)]));

    // Meta y pórtico de salida en el punto 0 (siempre a ras de mesa)
    meta.position.copy(centro[0]).setY(Y_MESA + centro[0].y + 0.001);
    meta.rotation.y = Math.atan2(-tangentes[0].x, -tangentes[0].z);
    portico.position.copy(centro[0]).setY(Y_MESA + centro[0].y);
    portico.rotation.y = Math.atan2(normales[0].x, normales[0].z); // su eje Z cruza la pista

    // Pilares cada ~20 cm donde la pista está levantada
    let n = 0;
    let recorrido = 0;
    for (let i = 0; i < N && n < MAX_PILARES; i++) {
      recorrido += centro[i].distanceTo(centro[(i + 1) % N]);
      const h = centro[i].y;
      if (h < 0.02 || recorrido < 0.2) continue;
      recorrido = 0;
      auxObj.position.set(centro[i].x, Y_MESA + (h - 0.016) / 2, centro[i].z);
      auxObj.rotation.set(0, Math.atan2(-normales[i].z, normales[i].x), 0);
      auxObj.scale.set(ANCHO_PISTA + 0.06, h - 0.016, 0.02);
      auxObj.updateMatrix();
      pilares.setMatrixAt(n++, auxObj.matrix);
    }
    pilares.count = n;
    pilares.instanceMatrix.needsUpdate = true;
    auxObj.rotation.set(0, 0, 0);

    // Árboles lejos de la pista (más al fondo, para no tapar)
    const sitiosArbol = [];
    for (let intento = 0; intento < 400 && sitiosArbol.length < MAX_ARBOLES; intento++) {
      const x = (Math.random() - 0.5) * ANCHO_MESA;
      const z = Z_MESA + (Math.random() - 0.5) * FONDO_MESA;
      if (z > Z_MESA + 0.2 && Math.random() < 0.7) continue;
      if (lejosDePista(x, z, 0.07) && sitiosArbol.every(([a, b]) => (a - x) ** 2 + (b - z) ** 2 > 0.025)) sitiosArbol.push([x, z, 0.7 + Math.random() * 0.6]);
    }
    sitiosArbol.forEach(([x, z, e], i) => {
      auxObj.position.set(x, Y_MESA, z);
      auxObj.scale.setScalar(e);
      auxObj.updateMatrix();
      troncos.setMatrixAt(i, auxObj.matrix);
      copas.setMatrixAt(i, auxObj.matrix);
    });
    troncos.count = copas.count = sitiosArbol.length;
    troncos.instanceMatrix.needsUpdate = true;
    copas.instanceMatrix.needsUpdate = true;

    // Pilas de neumáticos por fuera de las curvas cerradas que van a ras de mesa
    let m = 0;
    for (let i = 0; i < N && m < MAX_NEUMATICOS; i += 25) {
      const k = carriles[0].curvatura[i];
      if (Math.abs(k) < 3 || centro[i].y > 0.01) continue;
      const p = centro[i].clone().addScaledVector(normales[i], -Math.sign(k) * (ANCHO_PISTA / 2 + 0.07));
      if (!lejosDePista(p.x, p.z, 0.02)) continue;
      for (let a = 0; a < 2; a++) {
        auxObj.position.set(p.x, Y_MESA + 0.008 + a * 0.016, p.z);
        auxObj.scale.setScalar(1);
        auxObj.updateMatrix();
        neumaticos.setMatrixAt(m * 2 + a, auxObj.matrix);
      }
      m++;
    }
    neumaticos.count = m * 2;
    neumaticos.instanceMatrix.needsUpdate = true;

    // La grada, al fondo, donde no pise la pista (si no cabe en ningún sitio, no sale)
    grada.visible = false;
    const zGrada = Z_MESA - FONDO_MESA / 2 + 0.17;
    for (const x of [0.05, -0.55, 0.65, -0.95, 1.0].sort(() => Math.random() - 0.5)) {
      const libre = [-0.45, 0, 0.45].every((dx) => [0, -0.12].every((dz) => lejosDePista(x + dx, zGrada + dz, 0.02, false)));
      if (libre && Math.abs(x) + 0.45 < ANCHO_MESA / 2) {
        grada.position.set(x, Y_MESA, zGrada);
        grada.visible = true;
        break;
      }
    }

    tiempoIdeal = calcularTiempoIdeal();
    recordVuelta = 0; // la vuelta rápida es de este circuito
    carreras++;
  }

  // La carrera perfecta: acelera a tope desde parado y frena justo lo necesario antes de cada
  // curva (el perfil de la máquina), durante todas las vueltas. Sirve para puntuar en circuitos distintos.
  function calcularTiempoIdeal() {
    const carril = carriles[0];
    let v = 0;
    let t = 0;
    for (let vuelta = 0; vuelta < VUELTAS; vuelta++) {
      for (let i = 0; i < N; i++) {
        const ds = carril.acumulado[i + 1] - carril.acumulado[i];
        const tope = carril.perfil[(i + 1) % N];
        const v2 = Math.min(tope, Math.sqrt(v * v + 2 * ACELERACION * (1 - v / VELOCIDAD_MAX) * ds));
        t += ds / Math.max(0.05, (v + v2) / 2);
        v = v2;
      }
    }
    return t;
  }
  // Puntos de una carrera: 1000 si iguala la carrera perfecta
  const puntosDe = (tiempo) => Math.round((1000 * tiempoIdeal) / Math.max(1, tiempo));

  // ─── Coches ────────────────────────────────────────────────────────────
  // Monoplaza a escala 1:32 (unos 16 cm). El morro mira a -Z.
  const geoCarroceria = R(fusionar([
    new THREE.BoxGeometry(0.036, 0.018, 0.13).translate(0, 0.022, 0),        // chasis
    new THREE.BoxGeometry(0.062, 0.015, 0.05).translate(0, 0.019, 0.012),    // pontones
    new THREE.BoxGeometry(0.022, 0.012, 0.045).translate(0, 0.018, -0.08),   // morro
    new THREE.BoxGeometry(0.072, 0.004, 0.018).translate(0, 0.01, -0.095),   // alerón delantero
    new THREE.BoxGeometry(0.062, 0.004, 0.02).translate(0, 0.05, 0.068),     // alerón trasero
    new THREE.BoxGeometry(0.004, 0.026, 0.012).translate(-0.02, 0.036, 0.068),
    new THREE.BoxGeometry(0.004, 0.026, 0.012).translate(0.02, 0.036, 0.068),
    new THREE.SphereGeometry(0.011, 10, 8).translate(0, 0.036, 0.0),         // casco
  ]));
  const geoRuedas = R(fusionar([
    ...[-1, 1].map((l) => new THREE.CylinderGeometry(0.013, 0.013, 0.014, 12).rotateZ(Math.PI / 2).translate(l * 0.036, 0.013, -0.052)),
    ...[-1, 1].map((l) => new THREE.CylinderGeometry(0.015, 0.015, 0.019, 12).rotateZ(Math.PI / 2).translate(l * 0.037, 0.015, 0.05)),
  ]));
  const matRuedas = R(new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0, roughness: 0.8 }));

  function crearCoche(color, carril) {
    const grupo = new THREE.Group();
    grupo.rotation.order = 'YXZ'; // primero hacia dónde va y luego la cuesta
    const cuerpo = new THREE.Mesh(geoCarroceria, R(new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.35 })));
    grupo.add(cuerpo, new THREE.Mesh(geoRuedas, matRuedas));
    raiz.add(grupo);
    const sombra = ctx.crearSombra({ radio: 0.07, opacidad: 0.4 });
    raiz.add(sombra);
    return {
      grupo, sombra, carril,
      s: 0, v: 0, acel: 0, vueltas: 0, derrape: 0, cola: 0,
      estado: 'pista', tFuera: 0, aparece: 1, acelRaton: 0,
      vel: new THREE.Vector3(), giro: 0, yFuera: Y_MESA,
      tiempoVuelta: 0, mejorVuelta: 0, tiempoFinal: 0,
      factor: 0.93, sonidoDerrape: 0, pendiente: 0,
    };
  }
  const jugador = crearCoche(0xe53935, null); // los carriles los pone construirCircuito
  const rival = crearCoche(0x1e63d6, null);
  const coches = [jugador, rival];

  // ─── Mando de slot (en la mano, en VR) ─────────────────────────────────
  const geoMando = R(fusionar([
    new THREE.CylinderGeometry(0.019, 0.017, 0.11, 10).scale(1, 1, 1.2).translate(0, -0.045, 0.006), // empuñadura redondeada
    new THREE.BoxGeometry(0.04, 0.035, 0.07).translate(0, 0.02, -0.005),     // cabeza
    new THREE.CylinderGeometry(0.02, 0.02, 0.04, 10).rotateZ(Math.PI / 2).translate(0, 0.02, -0.04), // morro redondo
    new THREE.TorusGeometry(0.03, 0.0035, 6, 12, Math.PI * 0.9).rotateY(Math.PI / 2).translate(0, -0.015, -0.01), // guarda del gatillo
    new THREE.CylinderGeometry(0.008, 0.008, 0.02, 8).translate(0, -0.11, 0.008), // salida del cable
  ]));
  const matMando = R(new THREE.MeshStandardMaterial({ color: 0x263238, metalness: 0.15, roughness: 0.45 }));
  // Botón de "turbo" encima, del color del gatillo
  const geoBoton = R(new THREE.CylinderGeometry(0.008, 0.008, 0.006, 10).translate(0, 0.04, 0.012));
  const geoGatillo = R(new THREE.BoxGeometry(0.014, 0.05, 0.016).translate(0, -0.025, 0));
  const matGatillo = R(new THREE.MeshStandardMaterial({ color: 0xe53935, metalness: 0.1, roughness: 0.4 }));
  function crearMando() {
    const mando = new THREE.Group();
    const gatillo = new THREE.Mesh(geoGatillo, matGatillo);
    gatillo.position.set(0, 0.0, -0.035);
    mando.add(new THREE.Mesh(geoMando, matMando), gatillo, new THREE.Mesh(geoBoton, matGatillo));
    return { mando, gatillo };
  }
  const mandoVR = crearMando();
  const soporte = new THREE.Group();
  soporte.rotation.x = -Math.PI / 2;
  soporte.add(mandoVR.mando);
  soporte.visible = false;
  let manoMando = null;
  let ladoMando = 'right';
  // Cable del mando a la mesa
  const PUNTOS_CABLE = 10;
  const geoCable = R(new THREE.BufferGeometry());
  geoCable.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PUNTOS_CABLE * 3), 3));
  const cable = new THREE.Line(geoCable, R(new THREE.LineBasicMaterial({ color: 0x111111 })));
  cable.frustumCulled = false;
  cable.visible = false;
  raiz.add(cable);
  const enchufe = new THREE.Vector3(0.35, Y_MESA, Z_MESA + FONDO_MESA / 2);


  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.3, alto: 0.4 });
  marcador.mesh.position.set(0, Y_MESA + 0.45, Z_MESA - FONDO_MESA / 2 - 0.05);
  marcador.mesh.rotation.x = -0.25;
  raiz.add(marcador.mesh);

  const motorJugador = ctx.sonidoContinuo('electrico');
  const motorRival = ctx.sonidoContinuo('electrico');

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'salida' | 'carrera' | 'fin'
  let reloj = 3;
  let tiempoCarrera = 0;
  let record = ctx.leer('puntos', 0);           // mejor puntuación (el tiempo depende del circuito)
  let recordVuelta = 0;                         // vuelta más rápida de este circuito
  let puntosCarrera = 0;
  let ganada = false;
  let nuevoRecord = false;
  let mensaje = '';
  let tiempoMensaje = 0;
  let colorMensaje = '#fff59d';
  let cuentaAnterior = 0;
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const segundos = (s) => `${s.toFixed(2)} s`;

  function avisar(texto, color = '#fff59d', duracion = 1.5) {
    mensaje = texto;
    colorMensaje = color;
    tiempoMensaje = duracion;
  }

  function colocarEnSalida() {
    for (const c of coches) {
      c.s = 0;
      c.v = 0;
      c.acel = 0;
      c.vueltas = 0;
      c.derrape = 0;
      c.cola = 0;
      c.estado = 'pista';
      c.tiempoVuelta = 0;
      c.mejorVuelta = 0;
      c.tiempoFinal = 0;
      c.grupo.visible = true;
      c.grupo.scale.setScalar(1);
      c.aparece = 1;
    }
    rival.factor = nuevoFactorRival();
    tiempoCarrera = 0;
    ganada = false;
    nuevoRecord = false;
  }

  // La máquina va a un ritmo distinto en cada vuelta; a veces se pasa de frenada
  function nuevoFactorRival() {
    return Math.random() < 0.15 ? 1.2 : 0.74 + Math.random() * 0.1;
  }

  // ─── Física de un coche ────────────────────────────────────────────────
  function moverCoche(c, dt) {
    if (c.estado === 'fuera') {
      c.tFuera += dt;
      c.vel.multiplyScalar(Math.max(0, 1 - 2.2 * dt));
      const p = c.grupo.position;
      p.addScaledVector(c.vel, dt);
      // Fuera de la mesa, se cae al suelo
      const encimaDeLaMesa = Math.abs(p.x) < ANCHO_MESA / 2 + 0.04 && Math.abs(p.z - Z_MESA) < FONDO_MESA / 2 + 0.04;
      const suelo = encimaDeLaMesa && c.yFuera >= Y_MESA - 0.01 ? Y_MESA : 0;
      if (p.y > suelo) {
        c.yFuera = p.y;
        c.vel.y -= 9.8 * dt;
      } else {
        p.y = suelo;
        c.vel.y = 0;
      }
      c.yFuera = p.y;
      c.giro *= Math.max(0, 1 - 1.5 * dt);
      c.grupo.rotation.y += c.giro * dt;
      ctx.colocarSombra(c.sombra, p, suelo);
      if (c.tFuera > TIEMPO_FUERA) {
        // Vuelve a su carril, parado, en el mismo sitio
        c.estado = 'pista';
        c.v = 0;
        c.derrape = 0;
        c.cola = 0;
        c.aparece = 0;
      }
      return;
    }

    const a = ACELERACION * c.acel * (1 - c.v / VELOCIDAD_MAX) - FRENO_MOTOR * (1 - c.acel) * Math.min(1, c.v / 0.3) - 0.25 * c.v
      - G_PENDIENTE * c.pendiente; // cuesta arriba frena, cuesta abajo empuja
    c.v = Math.max(0, c.v + a * dt);
    c.s += c.v * dt;
    if (estado === 'carrera' || estado === 'fin') c.tiempoVuelta += dt;
    if (c.s >= c.carril.largo) {
      c.s -= c.carril.largo;
      c.vueltas += 1;
      completarVuelta(c);
    }

    const i = posicion(c.carril, c.s, c.grupo.position, dir);
    const k = c.carril.curvatura[i];
    const exceso = (c.v * c.v * Math.abs(k)) / AGARRE;
    if (exceso > 1) c.derrape += (exceso - 1) * dt * 5;
    else c.derrape = Math.max(0, c.derrape - dt * 2);
    // La cola se va hacia fuera al acercarse al límite
    const colaObjetivo = -Math.sign(k) * Math.min(0.55, Math.max(0, exceso - 0.75) * 0.9 + c.derrape);
    c.cola += (colaObjetivo - c.cola) * Math.min(1, dt * 12);

    c.grupo.position.y += Y_MESA; // la altura del carril va respecto a la mesa
    c.pendiente = THREE.MathUtils.clamp(dir.y, -0.9, 0.9);
    c.grupo.rotation.set(Math.asin(c.pendiente), Math.atan2(-dir.x, -dir.z) + c.cola, 0);
    if (c.aparece < 1) {
      c.aparece = Math.min(1, c.aparece + dt * 4);
      c.grupo.scale.setScalar(0.4 + 0.6 * c.aparece);
    }
    ctx.colocarSombra(c.sombra, c.grupo.position, Y_MESA);

    c.sonidoDerrape -= dt;
    if (exceso > 0.92 && c.v > 0.5 && c.sonidoDerrape <= 0) {
      if (c === jugador) ctx.sonido('derrape');
      c.sonidoDerrape = 0.25;
    }

    if (c.derrape > LIMITE_DERRAPE) salirse(c, k, i);
  }

  function salirse(c, k, i) {
    c.estado = 'fuera';
    c.tFuera = 0;
    const fuera = normales[i].clone().multiplyScalar(-Math.sign(k));
    c.vel.copy(dir).multiplyScalar(c.v * 0.85).addScaledVector(fuera, c.v * 0.55);
    c.vel.y = 0.6 + c.v * 0.25;
    c.giro = -Math.sign(k) * (8 + Math.random() * 6);
    c.yFuera = c.grupo.position.y;
    c.grupo.rotation.x = 0;
    c.pendiente = 0;
    c.v = 0;
    if (c === jugador) {
      ctx.sonido('golpe');
      avisar(ctx.t('fuera'), '#ff8a80');
      for (const m of ctx.manos) if (m.activa) ctx.vibrar(m, 0.9, 120);
      ctx.efectos.impacto('grande');
    } else {
      avisar(ctx.t('rivalFuera'), '#b9f6ca');
      rival.factor = 0.74 + Math.random() * 0.1;
    }
  }

  function completarVuelta(c) {
    const t = c.tiempoVuelta;
    c.tiempoVuelta = 0;
    if (!c.mejorVuelta || t < c.mejorVuelta) c.mejorVuelta = t;
    if (c === rival) {
      rival.factor = nuevoFactorRival();
      if (c.vueltas >= VUELTAS && !c.tiempoFinal) c.tiempoFinal = tiempoCarrera;
      return;
    }
    if (estado !== 'carrera') return;
    if (!recordVuelta || t < recordVuelta) {
      recordVuelta = t;
      avisar(ctx.t('vueltaRapida', { tiempo: segundos(t) }), '#b9f6ca');
      ctx.efectos.impacto('medio');
      ctx.sonido('anillo');
    } else {
      ctx.sonido('punto');
    }
    if (c.vueltas >= VUELTAS) terminar();
  }

  function terminar() {
    estado = 'fin';
    reloj = 8;
    jugador.tiempoFinal = tiempoCarrera;
    ganada = !rival.tiempoFinal;
    puntosCarrera = puntosDe(tiempoCarrera);
    ctx.puntuacion(puntosCarrera); // puntos según la carrera perfecta de este circuito (juegos/marcadores.js)
    if (puntosCarrera > record) {
      record = puntosCarrera;
      nuevoRecord = true;
      ctx.guardar('puntos', record);
    }
    ctx.sonido(ganada ? 'ovacion' : 'fin');
  }

  // ─── Mandos ────────────────────────────────────────────────────────────
  // Devuelve cuánto se aprieta el acelerador (0 a 1)
  function leerMando(dt) {
    if (ctx.enVR()) {
      const activas = ctx.manos.filter((m) => m.activa);
      const valor = (m) => {
        const b = m.fuente?.gamepad?.buttons?.[0];
        return b ? Math.max(b.value || 0, b.pressed ? 0.05 : 0) : 0;
      };
      // El mando va en la última mano que ha apretado el gatillo
      for (const m of activas) if (m.gatilloPulsado && m.lado && m.lado !== ladoMando) ladoMando = m.lado;
      const mano = activas.find((m) => m.lado === ladoMando) || activas[0] || null;
      if (mano !== manoMando) {
        if (soporte.parent) soporte.parent.remove(soporte);
        if (mano) ctx.adjuntarAMano(mano, soporte);
        manoMando = mano;
      }
      soporte.visible = !!mano;
      cable.visible = !!mano;
      if (!mano) return 0;
      const v = valor(mano);
      mandoVR.gatillo.position.z = -0.035 + v * 0.018;
      // Cable colgando entre el mando y la mesa
      soporte.updateMatrixWorld();
      const desde = mandoVR.mando.localToWorld(tmp.set(0, -0.1, 0.005));
      const pos = geoCable.attributes.position;
      for (let i = 0; i < PUNTOS_CABLE; i++) {
        const f = i / (PUNTOS_CABLE - 1);
        tmp2.lerpVectors(desde, enchufe, f);
        tmp2.y -= Math.sin(f * Math.PI) * 0.25;
        pos.setXYZ(i, tmp2.x, tmp2.y, tmp2.z);
      }
      pos.needsUpdate = true;
      if (v > 0.05 && jugador.estado === 'pista') ctx.vibrar(mano, 0.05 + jugador.v / VELOCIDAD_MAX * 0.12, 20);
      return v;
    }
    soporte.visible = false;
    cable.visible = false;
    // Ratón o dedo: pulsado acelera (sube y baja suave, como un gatillo)
    const objetivo = ctx.raton.pulsado ? 1 : 0;
    jugador.acelRaton += (objetivo - jugador.acelRaton) * Math.min(1, dt * 10);
    return jugador.acelRaton;
  }

  function pilotarRival() {
    if (rival.estado !== 'pista') return 0;
    const i = indice(rival.carril, rival.s);
    // Mira un poco por delante, como haría alguien que conoce la pista
    const j = (i + 12) % N;
    const objetivo = Math.min(rival.carril.perfil[i], rival.carril.perfil[j]) * rival.factor;
    return rival.v < objetivo ? 1 : 0;
  }

  // ─── Marcador ──────────────────────────────────────────────────────────
  function actualizarMarcador() {
    const recordTexto = ctx.t('reglas', { record: record ? ctx.t('partida.puntosN', { n: record }) : '—', vuelta: recordVuelta ? segundos(recordVuelta) : '—' });
    if (estado === 'intro') {
      marcador.escribir([
        { texto: ctx.t('titulo'), tam: 1.2, color: '#ffcc80' },
        { texto: ctx.t(ctx.enVR() ? 'introVR' : ctx.tactil ? 'introTactil' : 'introRaton'), tam: 0.62 },
        { texto: recordTexto, tam: 0.62, color: '#ffcc80' },
      ]);
    } else if (estado === 'salida') {
      const n = Math.ceil(reloj);
      marcador.escribir([
        { texto: String(n), tam: 1.5, color: '#ff5252' },
        carreras > 1
          ? { texto: ctx.t('circuitoNuevo'), tam: 0.7, color: '#b9f6ca' }
          : { texto: ctx.t(ctx.enVR() ? 'introVR' : ctx.tactil ? 'introTactil' : 'introRaton'), tam: 0.62 },
        { texto: recordTexto, tam: 0.62, color: '#ffcc80' },
      ]);
    } else if (estado === 'carrera') {
      const progreso = (c) => c.vueltas + c.s / c.carril.largo;
      const delante = progreso(jugador) >= progreso(rival);
      marcador.escribir([
        { texto: ctx.t('pantalla', { vuelta: Math.min(VUELTAS, jugador.vueltas + 1), vueltas: VUELTAS, tiempo: segundos(tiempoCarrera) }), tam: 1.1 },
        tiempoMensaje > 0
          ? { texto: mensaje, tam: 0.75, color: colorMensaje }
          : tiempoCarrera < 1
            ? { texto: ctx.t('ya'), tam: 0.9, color: '#69f0ae' }
            : { texto: ctx.t(delante ? 'delante' : 'detras'), tam: 0.75, color: delante ? '#b9f6ca' : '#ffab91' },
        { texto: recordTexto, tam: 0.62, color: '#ffcc80' },
      ]);
    } else {
      marcador.escribir([
        { texto: ganada ? ctx.t('hasGanado') : ctx.t('hasPerdido'), tam: 1.2, color: ganada ? '#69f0ae' : '#ffcc80' },
        { texto: ctx.t('resumen', { tiempo: segundos(jugador.tiempoFinal), puntos: ctx.t('partida.puntosN', { n: puntosCarrera }) }), tam: 0.7, color: '#ffffff' },
        nuevoRecord
          ? { texto: ctx.t('partida.nuevoRecord'), tam: 0.62, color: '#fff59d' }
          : { texto: ctx.t('otra', { n: Math.max(1, Math.ceil(reloj)) }), tam: 0.62, color: '#ffcc80' },
      ]);
    }
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  construirCircuito();
  colocarEnSalida();
  semaforo(0, false);

  function actualizar(dt) {
    if (!ctx.enVR()) ajustarVista();
    reloj -= dt;
    tiempoMensaje -= dt;
    let acelJugador = leerMando(dt);

    if (estado === 'intro' && reloj <= 0) {
      estado = 'salida';
      reloj = 3;
      cuentaAnterior = 4;
    } else if (estado === 'salida') {
      const n = Math.ceil(reloj);
      if (n !== cuentaAnterior && n > 0) {
        cuentaAnterior = n;
        semaforo(4 - n, false);
        ctx.sonido('tic');
      }
      if (reloj <= 0) {
        estado = 'carrera';
        semaforo(3, true);
        ctx.sonido('anillo');
      }
    } else if (estado === 'carrera') {
      tiempoCarrera += dt;
    } else if (estado === 'fin' && reloj <= 0) {
      construirCircuito(); // cada carrera, un circuito distinto
      colocarEnSalida();
      semaforo(0, false);
      estado = 'salida';
      reloj = 3;
      cuentaAnterior = 4;
    }

    // Antes de la salida y tras la meta los coches no corren (el rival acaba su vuelta)
    if (estado !== 'carrera') acelJugador = 0;
    jugador.acel = acelJugador;
    rival.acel = estado === 'carrera' || (estado === 'fin' && rival.vueltas < VUELTAS) ? pilotarRival() : 0;
    for (const c of coches) moverCoche(c, dt);

    motorJugador.ajustar(Math.min(1, jugador.v / VELOCIDAD_MAX * 0.8 + jugador.acel * 0.2), jugador.estado === 'pista' ? 0.1 + jugador.acel * 0.06 : 0);
    motorRival.ajustar(Math.min(1, rival.v / VELOCIDAD_MAX), rival.estado === 'pista' ? 0.04 + rival.v / VELOCIDAD_MAX * 0.04 : 0);

    actualizarMarcador();
  }

  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      // Las geometrías de la pista no están registradas con ctx.recurso: cambian en cada carrera
      for (const malla of [pista, bordes, faldones]) malla.geometry.dispose();
      pilares.dispose();
      luces.dispose();
      troncos.dispose();
      copas.dispose();
      neumaticos.dispose();
    },
  };
}
