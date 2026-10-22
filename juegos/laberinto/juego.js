// LABERINTO
// El laberinto de madera de toda la vida, en la mesa de una cabaña: inclina el tablero
// para llevar la bola de acero hasta el agujero de salida (el del aro coral) sin que caiga
// por los otros. Tienes 2 minutos para hacer todos los laberintos que puedas; cada uno es
// nuevo y algo más grande que el anterior. Cada laberinto vale 100 puntos y hasta 60 más
// si lo haces rápido. Si la bola cae por un agujero, vuelve a la salida.
// En VR, aprieta el gatillo y gira la mano para inclinar el tablero (al soltar se queda
// como está). Sin gafas, el tablero se inclina hacia donde está el ratón o el dedo.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código.
export async function precargar() {}

const TABLERO = new THREE.Vector3(0, 0.98, -0.48);
const LADO_TABLERO = 0.5;
const R_BOLA = 0.0125;
const R_AGUJERO = 0.0155;
const GROSOR = 0.008;           // grosor de las paredes
const ALTO_PARED = 0.022;
const MAX_INCLINACION = 0.2;    // rad
const DURACION = 120;
const TAMANOS = [4, 5, 5, 6, 6, 7, 7, 8];
const MAX_PAREDES = 2 * 9 * 10;
const MAX_AGUJEROS = 16;

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (r) => ctx.recurso(r);

  ctx.fondo(0x6f8fa8, { cenit: 0x3c5770, horizonte: 0xa9c1d0, nubes: 0.4 });
  ctx.sueloBase(false);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.62, 0.02), new THREE.Vector3(0, 0.98, -0.5));

  const matrizTmp = new THREE.Matrix4();
  const eulerTmp = new THREE.Euler();
  function colocar(geo, x, y, z, rx = 0, ry = 0, rz = 0) {
    matrizTmp.makeRotationFromEuler(eulerTmp.set(rx, ry, rz)).setPosition(x, y, z);
    return geo.applyMatrix4(matrizTmp);
  }
  function fusionar(geos) {
    let nv = 0;
    let ni = 0;
    for (const g of geos) {
      nv += g.attributes.position.count;
      ni += g.index ? g.index.count : g.attributes.position.count;
    }
    const pos = new Float32Array(nv * 3);
    const nor = new Float32Array(nv * 3);
    const uv = new Float32Array(nv * 2);
    const indices = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let ov = 0;
    let oi = 0;
    for (const g of geos) {
      const n = g.attributes.position.count;
      pos.set(g.attributes.position.array, ov * 3);
      nor.set(g.attributes.normal.array, ov * 3);
      uv.set(g.attributes.uv.array, ov * 2);
      if (g.index) for (let i = 0; i < g.index.count; i++) indices[oi++] = g.index.array[i] + ov;
      else for (let i = 0; i < n; i++) indices[oi++] = ov + i;
      ov += n;
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    return R(geo);
  }

  // ─── La cabaña ─────────────────────────────────────────────────────────
  const suelo = new THREE.Mesh(
    R(new THREE.PlaneGeometry(8, 8)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tablas(0x8a5a36, { tablas: 12, repetir: [3, 3], semilla: 81 })) })),
  );
  suelo.rotation.x = -Math.PI / 2;
  raiz.add(suelo);
  const matPared = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tablas(0xb98a5a, { tablas: 10, repetir: [3, 1], semilla: 82 })), side: THREE.DoubleSide }));
  const paredes = new THREE.Mesh(fusionar([
    colocar(new THREE.PlaneGeometry(6, 3), 0, 1.5, -2.4),
    colocar(new THREE.PlaneGeometry(6, 3), -2.4, 1.5, 0.4, 0, Math.PI / 2),
    colocar(new THREE.PlaneGeometry(6, 3), 2.4, 1.5, 0.4, 0, -Math.PI / 2),
    colocar(new THREE.PlaneGeometry(6, 6), 0, 3, 0.4, Math.PI / 2),
  ]), matPared);
  raiz.add(paredes);
  // Ventana con el cielo de fondo: un hueco con marco (el cielo se ve detrás)
  const marco = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(1.5, 0.08, 0.1), 0.9, 2.3, -2.38),
    colocar(new THREE.BoxGeometry(1.5, 0.08, 0.1), 0.9, 1.3, -2.38),
    colocar(new THREE.BoxGeometry(0.08, 1.0, 0.1), 0.19, 1.8, -2.38),
    colocar(new THREE.BoxGeometry(0.08, 1.0, 0.1), 1.61, 1.8, -2.38),
    colocar(new THREE.BoxGeometry(0.05, 1.0, 0.06), 0.9, 1.8, -2.38),
  ]), R(new THREE.MeshLambertMaterial({ color: 0x5a3a22 })));
  raiz.add(marco);
  const vista = new THREE.Mesh(R(new THREE.PlaneGeometry(1.4, 0.95)), R(new THREE.MeshBasicMaterial({ map: R(ctx.texturaCanvas((g, tam) => {
    const deg = g.createLinearGradient(0, 0, 0, tam);
    deg.addColorStop(0, '#8fc4ea');
    deg.addColorStop(1, '#dfeef6');
    g.fillStyle = deg;
    g.fillRect(0, 0, tam, tam);
    g.fillStyle = '#5c7f5a';
    g.beginPath();
    g.moveTo(0, tam * 0.7);
    for (let x = 0; x <= tam; x += 8) g.lineTo(x, tam * (0.62 + 0.08 * Math.sin(x * 0.05)));
    g.lineTo(tam, tam);
    g.lineTo(0, tam);
    g.fill();
    g.fillStyle = '#2f5a3a';
    for (let i = 0; i < 9; i++) {
      const x = (i + 0.3) * tam / 9;
      g.beginPath();
      g.moveTo(x, tam * 0.5);
      g.lineTo(x - 10, tam * 0.75);
      g.lineTo(x + 10, tam * 0.75);
      g.fill();
    }
  }, { tam: 256 })) })));
  vista.position.set(0.9, 1.8, -2.39);
  raiz.add(vista);
  // Estantería con libros y una lámpara
  const libros = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(1.0, 0.04, 0.3), -1.4, 1.2, -2.2),
    colocar(new THREE.BoxGeometry(1.0, 0.04, 0.3), -1.4, 1.65, -2.2),
    ...Array.from({ length: 9 }, (_, i) => colocar(new THREE.BoxGeometry(0.06, 0.24 + (i % 3) * 0.03, 0.2), -1.8 + i * 0.09, 1.34 + (i % 3) * 0.015, -2.2)),
    ...Array.from({ length: 7 }, (_, i) => colocar(new THREE.BoxGeometry(0.07, 0.22 + (i % 2) * 0.04, 0.2), -1.75 + i * 0.1, 1.79, -2.2)),
  ]), R(new THREE.MeshLambertMaterial({ map: R(ctx.texturaCanvas((g, tam) => {
    const c = ['#a63d40', '#3d6aa6', '#e0b24a', '#4a8a5a', '#7a4aa6'];
    for (let i = 0; i < 10; i++) {
      g.fillStyle = c[i % 5];
      g.fillRect(0, (i * tam) / 10, tam, tam / 10);
    }
  }, { tam: 64 })) })));
  raiz.add(libros);
  const lampara = new THREE.Mesh(R(new THREE.SphereGeometry(0.12, 16, 12)), R(new THREE.MeshBasicMaterial({ color: 0xffe2a8, toneMapped: false })));
  lampara.position.set(0, 2.6, -1.0);
  raiz.add(lampara);
  const cable = new THREE.Mesh(R(new THREE.CylinderGeometry(0.006, 0.006, 0.4, 6)), R(new THREE.MeshLambertMaterial({ color: 0x222222 })));
  cable.position.set(0, 2.85, -1.0);
  raiz.add(cable);
  // Mesa
  const matMesa = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.madera(0x7a4a2a, { semilla: 83 })) }));
  const mesa = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(1.2, 0.05, 0.8), 0, 0.82, -0.5),
    ...[[-0.55, -0.85], [0.55, -0.85], [-0.55, -0.15], [0.55, -0.15]].map(([x, z]) => colocar(new THREE.BoxGeometry(0.06, 0.8, 0.06), x, 0.4, z)),
  ]), matMesa);
  raiz.add(mesa);
  const sombraMesa = ctx.crearSombra({ radio: 0.8, opacidad: 0.4 });
  sombraMesa.position.set(0, 0.006, -0.5);
  raiz.add(sombraMesa);
  // Soporte del tablero sobre la mesa
  const soporte = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(LADO_TABLERO + 0.1, 0.08, 0.04), 0, 0.885, TABLERO.z - LADO_TABLERO / 2 - 0.03),
    colocar(new THREE.BoxGeometry(LADO_TABLERO + 0.1, 0.08, 0.04), 0, 0.885, TABLERO.z + LADO_TABLERO / 2 + 0.03),
    colocar(new THREE.BoxGeometry(0.04, 0.08, LADO_TABLERO + 0.1), -LADO_TABLERO / 2 - 0.05, 0.885, TABLERO.z),
    colocar(new THREE.BoxGeometry(0.04, 0.08, LADO_TABLERO + 0.1), LADO_TABLERO / 2 + 0.05, 0.885, TABLERO.z),
  ]), matMesa);
  raiz.add(soporte);

  // ─── Tablero (se inclina) ──────────────────────────────────────────────
  const tablero = new THREE.Group();
  tablero.position.copy(TABLERO);
  raiz.add(tablero);
  const texTablero = R(ctx.texturas.madera(0xe0c08a, { semilla: 84 }));
  const base = new THREE.Mesh(R(new THREE.BoxGeometry(LADO_TABLERO, 0.016, LADO_TABLERO)), R(new THREE.MeshLambertMaterial({ map: texTablero })));
  base.position.y = -0.008;
  tablero.add(base);
  const matMarco = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.madera(0x8a5530, { semilla: 85 })) }));
  const marcoTablero = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(LADO_TABLERO + 0.04, 0.035, 0.02), 0, 0.0, -LADO_TABLERO / 2 - 0.01),
    colocar(new THREE.BoxGeometry(LADO_TABLERO + 0.04, 0.035, 0.02), 0, 0.0, LADO_TABLERO / 2 + 0.01),
    colocar(new THREE.BoxGeometry(0.02, 0.035, LADO_TABLERO), -LADO_TABLERO / 2 - 0.01, 0.0, 0),
    colocar(new THREE.BoxGeometry(0.02, 0.035, LADO_TABLERO), LADO_TABLERO / 2 + 0.01, 0.0, 0),
  ]), matMarco);
  tablero.add(marcoTablero);
  // Pomos a los lados (giran con la inclinación, como en el juego de verdad)
  const geoPomo = R(fusionar([
    colocar(new THREE.CylinderGeometry(0.006, 0.006, 0.05, 10), 0, 0, 0, 0, 0, Math.PI / 2),
    colocar(new THREE.CylinderGeometry(0.028, 0.028, 0.02, 20), 0.032, 0, 0, 0, 0, Math.PI / 2),
  ]));
  const matPomo = R(new THREE.MeshStandardMaterial({ color: 0x6a3a1c, roughness: 0.5 }));
  const pomoX = new THREE.Mesh(geoPomo, matPomo);
  pomoX.position.set(LADO_TABLERO / 2 + 0.07, 0.885, TABLERO.z);
  const pomoZ = new THREE.Mesh(geoPomo, matPomo);
  pomoZ.rotation.y = -Math.PI / 2;
  pomoZ.position.set(0, 0.885, TABLERO.z + LADO_TABLERO / 2 + 0.07);
  raiz.add(pomoX, pomoZ);

  // Paredes del laberinto (instancias de una caja unidad)
  const paredesLab = new THREE.InstancedMesh(R(new THREE.BoxGeometry(1, 1, 1)), R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.madera(0x9a6034, { tam: 128, semilla: 86 })) })), MAX_PAREDES);
  paredesLab.count = 0;
  paredesLab.frustumCulled = false;
  tablero.add(paredesLab);
  // Agujeros: disco oscuro con un aro metálico
  const geoAgujero = R(new THREE.CircleGeometry(R_AGUJERO, 20));
  geoAgujero.rotateX(-Math.PI / 2);
  const agujerosMalla = new THREE.InstancedMesh(geoAgujero, R(new THREE.MeshBasicMaterial({ color: 0x120a06 })), MAX_AGUJEROS);
  agujerosMalla.count = 0;
  agujerosMalla.frustumCulled = false;
  tablero.add(agujerosMalla);
  const geoAroAgujero = R(new THREE.RingGeometry(R_AGUJERO, R_AGUJERO + 0.003, 20));
  geoAroAgujero.rotateX(-Math.PI / 2);
  const arosAgujeros = new THREE.InstancedMesh(geoAroAgujero, R(new THREE.MeshLambertMaterial({ color: 0x8a8f96 })), MAX_AGUJEROS);
  arosAgujeros.count = 0;
  arosAgujeros.frustumCulled = false;
  tablero.add(arosAgujeros);
  // Meta: agujero con aro coral que brilla
  const meta = new THREE.Group();
  const metaFondo = new THREE.Mesh(geoAgujero, R(new THREE.MeshBasicMaterial({ color: 0x120a06 })));
  const metaAro = new THREE.Mesh(R(new THREE.RingGeometry(R_AGUJERO + 0.001, R_AGUJERO + 0.007, 24)), R(new THREE.MeshBasicMaterial({ color: 0xff6a3d, toneMapped: false })));
  metaAro.rotation.x = -Math.PI / 2;
  meta.add(metaFondo, metaAro);
  meta.position.y = 0.0006;
  tablero.add(meta);
  // Línea de salida: un aro verde
  const salida = new THREE.Mesh(R(new THREE.RingGeometry(0.014, 0.018, 20)), R(new THREE.MeshBasicMaterial({ color: 0x4fd18b, toneMapped: false })));
  salida.rotation.x = -Math.PI / 2;
  salida.position.y = 0.0006;
  tablero.add(salida);
  // Bola de acero
  const bola = new THREE.Mesh(R(new THREE.SphereGeometry(R_BOLA, 20, 14)), R(new THREE.MeshStandardMaterial({ color: 0xdfe4ea, roughness: 0.12, metalness: 1 })));
  tablero.add(bola);
  const sombraBola = ctx.crearSombra({ radio: 0.018, opacidad: 0.45 });
  tablero.add(sombraBola);

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 0.9, alto: 0.27 });
  marcador.mesh.position.set(0, 1.42, -0.95);
  marcador.mesh.rotation.x = -0.25;
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'juego' | 'cae' | 'meta' | 'fin'
  let reloj = 3;
  let restante = DURACION;
  let puntos = 0;
  let nivel = 0;
  let record = ctx.leer('record', 0);
  let tiempoNivel = 0;
  let caidas = 0;
  let aviso = '';
  let tiempoAviso = 0;
  let n = 4;               // celdas por lado
  let celda = 0.1;
  const segmentos = [];    // [ax, az, bx, bz] de cada pared
  const agujeros = [];     // [x, z]
  const bolaPos = new THREE.Vector2();
  const bolaVel = new THREE.Vector2();
  const inicio = new THREE.Vector2();
  const fin = new THREE.Vector2();
  let ultimoChoque = 0;
  // Inclinación (objetivo y actual)
  const incl = new THREE.Vector2();
  const inclObjetivo = new THREE.Vector2();
  // Agarre en VR
  let manoAgarre = null;
  const qInicio = new THREE.Quaternion();
  const qTmp = new THREE.Quaternion();
  const inclInicio = new THREE.Vector2();
  const tmp = new THREE.Vector3();
  const escTmp = new THREE.Vector3();
  const qUno = new THREE.Quaternion();

  const aLocal = (i, j, destino) => destino.set((i + 0.5) * celda - LADO_TABLERO / 2, (j + 0.5) * celda - LADO_TABLERO / 2);

  // Genera un laberinto perfecto (backtracking) y coloca los agujeros
  function generar() {
    n = TAMANOS[Math.min(nivel, TAMANOS.length - 1)];
    celda = LADO_TABLERO / n;
    // muros[i][j] = { e: pared al este, s: pared al sur }
    const visitado = Array.from({ length: n }, () => new Array(n).fill(false));
    const este = Array.from({ length: n }, () => new Array(n).fill(true));
    const sur = Array.from({ length: n }, () => new Array(n).fill(true));
    const pila = [[0, n - 1]];
    visitado[0][n - 1] = true;
    while (pila.length) {
      const [i, j] = pila[pila.length - 1];
      const vecinos = [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]].filter(([a, b]) => a >= 0 && b >= 0 && a < n && b < n && !visitado[a][b]);
      if (!vecinos.length) {
        pila.pop();
        continue;
      }
      const [a, b] = vecinos[Math.floor(Math.random() * vecinos.length)];
      if (a > i) este[i][j] = false;
      else if (a < i) este[a][b] = false;
      else if (b > j) sur[i][j] = false;
      else sur[a][b] = false;
      visitado[a][b] = true;
      pila.push([a, b]);
    }
    // Segmentos (bordes incluidos); j crece hacia el jugador (+z)
    segmentos.length = 0;
    const L = LADO_TABLERO / 2;
    segmentos.push([-L, -L, L, -L], [-L, L, L, L], [-L, -L, -L, L], [L, -L, L, L]);
    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        const x0 = i * celda - L;
        const z0 = j * celda - L;
        if (i < n - 1 && este[i][j]) segmentos.push([x0 + celda, z0, x0 + celda, z0 + celda]);
        if (j < n - 1 && sur[i][j]) segmentos.push([x0, z0 + celda, x0 + celda, z0 + celda]);
      }
    }
    segmentos.forEach(([ax, az, bx, bz], k) => {
      const largo = Math.hypot(bx - ax, bz - az) + GROSOR;
      escTmp.set(ax === bx ? GROSOR : largo, ALTO_PARED, az === bz ? GROSOR : largo);
      matrizTmp.compose(tmp.set((ax + bx) / 2, ALTO_PARED / 2, (az + bz) / 2), qUno, escTmp);
      paredesLab.setMatrixAt(k, matrizTmp);
    });
    paredesLab.count = segmentos.length;
    paredesLab.instanceMatrix.needsUpdate = true;

    // Salida (abajo a la izquierda, cerca del jugador) y meta (arriba a la derecha)
    aLocal(0, n - 1, inicio);
    aLocal(n - 1, 0, fin);
    // Camino de la solución (BFS) para no tapar el paso con agujeros
    const abierto = (i, j, a, b) => {
      if (a === i + 1) return !este[i][j];
      if (a === i - 1) return !este[a][b];
      if (b === j + 1) return !sur[i][j];
      return !sur[a][b];
    };
    const previo = new Map();
    const cola = [[0, n - 1]];
    previo.set(`0,${n - 1}`, null);
    while (cola.length) {
      const [i, j] = cola.shift();
      if (i === n - 1 && j === 0) break;
      for (const [a, b] of [[i + 1, j], [i - 1, j], [i, j + 1], [i, j - 1]]) {
        if (a < 0 || b < 0 || a >= n || b >= n || previo.has(`${a},${b}`) || !abierto(i, j, a, b)) continue;
        previo.set(`${a},${b}`, [i, j]);
        cola.push([a, b]);
      }
    }
    const camino = new Set();
    let paso = [n - 1, 0];
    const lista = [];
    while (paso) {
      camino.add(`${paso[0]},${paso[1]}`);
      lista.unshift(paso);
      paso = previo.get(`${paso[0]},${paso[1]}`);
    }
    // Agujeros: en celdas fuera del camino (centro) y en las esquinas exteriores de las curvas
    agujeros.length = 0;
    const p = new THREE.Vector2();
    const fuera = [];
    for (let i = 0; i < n; i++) for (let j = 0; j < n; j++) if (!camino.has(`${i},${j}`)) fuera.push([i, j]);
    fuera.sort(() => Math.random() - 0.5);
    const nFuera = Math.min(fuera.length, 2 + nivel);
    for (let k = 0; k < nFuera; k++) {
      aLocal(fuera[k][0], fuera[k][1], p);
      agujeros.push([p.x, p.y]);
    }
    for (let k = 1; k < lista.length - 1 && agujeros.length < MAX_AGUJEROS; k++) {
      const [a0, b0] = lista[k - 1];
      const [a1, b1] = lista[k];
      const [a2, b2] = lista[k + 1];
      const dx = a2 - a0;
      const dz = b2 - b0;
      if (dx === 0 || dz === 0 || Math.random() < 0.4) continue; // solo curvas, y no todas
      // La esquina exterior de la curva: la contraria a los lados por donde se entra y se sale
      const ex = (a1 - a0) - (a2 - a1);
      const ez = (b1 - b0) - (b2 - b1);
      const desv = celda / 2 - GROSOR / 2 - R_AGUJERO - 0.002;
      if (desv < 0.012) continue;
      aLocal(a1, b1, p);
      agujeros.push([p.x + ex * desv, p.y + ez * desv]);
    }
    agujeros.forEach(([x, z], k) => {
      matrizTmp.makeTranslation(x, 0.0005, z);
      agujerosMalla.setMatrixAt(k, matrizTmp);
      arosAgujeros.setMatrixAt(k, matrizTmp);
    });
    agujerosMalla.count = arosAgujeros.count = agujeros.length;
    agujerosMalla.instanceMatrix.needsUpdate = true;
    arosAgujeros.instanceMatrix.needsUpdate = true;
    meta.position.set(fin.x, 0.0006, fin.y);
    salida.position.set(inicio.x, 0.0006, inicio.y);
    ponerBola();
    tiempoNivel = 0;
  }

  function ponerBola() {
    bolaPos.copy(inicio);
    bolaVel.set(0, 0);
    bola.scale.setScalar(1);
  }

  function empezarPartida() {
    puntos = 0;
    nivel = 0;
    caidas = 0;
    restante = DURACION;
    estado = 'juego';
    generar();
  }

  function terminar() {
    estado = 'fin';
    reloj = 6;
    ctx.sonido('fin');
    ctx.puntuacion(puntos); // a la clasificación (juegos/marcadores.js)
    if (puntos > record) {
      record = puntos;
      ctx.guardar('record', record);
    }
  }

  function actualizarMarcador() {
    if (estado === 'intro') {
      const intro = ctx.enVR() ? ctx.t('intro') : ctx.t(ctx.tactil ? 'introTactil' : 'introRaton');
      marcador.escribir([
        { texto: ctx.t('titulo'), tam: 1.3, color: '#ffd27a' },
        { texto: intro, tam: 0.72 },
      ]);
    } else if (estado === 'fin') {
      marcador.escribir([
        { texto: ctx.t('fin', { n: puntos, laberintos: nivel }), tam: 1.1, color: '#ffd27a' },
        { texto: ctx.t('partida.recordNuevaPartida', { record, n: Math.max(1, Math.ceil(reloj)) }), tam: 0.72 },
      ]);
    } else {
      marcador.escribir([
        { texto: ctx.t('partida.puntosTiempo', { puntos, s: Math.max(0, Math.ceil(restante)) }), tam: 1.15 },
        { texto: tiempoAviso > 0 ? aviso : ctx.t('nivel', { n: nivel + 1 }), tam: 0.8, color: tiempoAviso > 0 ? '#ffe08a' : '#cfd8dc' },
      ]);
    }
  }

  // ─── Entrada: inclinar el tablero ──────────────────────────────────────
  function entrada() {
    if (ctx.enVR()) {
      if (manoAgarre && (!manoAgarre.gatillo || !manoAgarre.activa)) manoAgarre = null;
      if (!manoAgarre) {
        const m = ctx.manos.find((x) => x.activa && x.gatilloPulsado);
        if (m) {
          manoAgarre = m;
          m.grip.getWorldQuaternion(qInicio).invert();
          inclInicio.copy(inclObjetivo);
          ctx.vibrar(m, 0.2, 25);
        }
      }
      if (manoAgarre) {
        // Giro de la mano desde que se agarró: cabeceo (x) y alabeo (z)
        manoAgarre.grip.getWorldQuaternion(qTmp);
        qTmp.premultiply(qInicio);
        eulerTmp.setFromQuaternion(qTmp, 'YXZ');
        inclObjetivo.set(inclInicio.x + eulerTmp.x, inclInicio.y + eulerTmp.z);
      }
    } else {
      // El ratón (o el dedo) respecto al centro del tablero en pantalla
      tmp.copy(TABLERO).project(ctx.camara);
      const dx = THREE.MathUtils.clamp((ctx.raton.ndc.x - tmp.x) * 2.2, -1, 1);
      const dy = THREE.MathUtils.clamp((ctx.raton.ndc.y - tmp.y) * 2.2, -1, 1);
      const activo = ctx.raton.dentro || ctx.tactil;
      inclObjetivo.set(activo ? -dy * MAX_INCLINACION : 0, activo ? -dx * MAX_INCLINACION : 0);
    }
    inclObjetivo.x = THREE.MathUtils.clamp(inclObjetivo.x, -MAX_INCLINACION, MAX_INCLINACION);
    inclObjetivo.y = THREE.MathUtils.clamp(inclObjetivo.y, -MAX_INCLINACION, MAX_INCLINACION);
  }

  // ─── Física de la bola ─────────────────────────────────────────────────
  function simular(dt) {
    const pasos = 4;
    const h = dt / pasos;
    const g = 9.8 * 5 / 7; // bola que rueda
    for (let s = 0; s < pasos; s++) {
      bolaVel.x += -Math.sin(incl.y) * g * h;
      bolaVel.y += Math.sin(incl.x) * g * h;
      bolaVel.multiplyScalar(1 - 0.6 * h);
      bolaPos.addScaledVector(bolaVel, h);
      // Paredes: empujar fuera del segmento más cercano
      for (const [ax, az, bx, bz] of segmentos) {
        const vx = bx - ax;
        const vz = bz - az;
        const t = THREE.MathUtils.clamp(((bolaPos.x - ax) * vx + (bolaPos.y - az) * vz) / (vx * vx + vz * vz), 0, 1);
        const cx = ax + vx * t;
        const cz = az + vz * t;
        const dx = bolaPos.x - cx;
        const dz = bolaPos.y - cz;
        const d = Math.hypot(dx, dz);
        const minimo = R_BOLA + GROSOR / 2;
        if (d < minimo && d > 1e-6) {
          const nx = dx / d;
          const nz = dz / d;
          bolaPos.x = cx + nx * minimo;
          bolaPos.y = cz + nz * minimo;
          const vn = bolaVel.x * nx + bolaVel.y * nz;
          if (vn < 0) {
            bolaVel.x -= 1.4 * vn * nx;
            bolaVel.y -= 1.4 * vn * nz;
            if (vn < -0.12 && ultimoChoque <= 0) {
              ctx.sonido('madera');
              ctx.vibrar(manoAgarre, Math.min(0.5, -vn), 20);
              ultimoChoque = 0.08;
            }
          }
        }
      }
    }
  }

  function comprobarAgujeros() {
    if (bolaPos.distanceTo(fin) < R_AGUJERO * 0.8) {
      estado = 'meta';
      reloj = 1.1;
      const extra = Math.max(0, Math.round(60 - tiempoNivel * 2));
      const suma = 100 + extra;
      puntos += suma;
      tablero.localToWorld(tmp.set(fin.x, 0.05, fin.y));
      ctx.efectos.impacto(extra > 30 ? 'grande' : 'medio', { pos: tmp, mano: manoAgarre, color: 0xff6a3d, sonido: 'hoyo' });
      ctx.efectos.texto(tmp, `+${suma}`, { color: '#ffd27a', tam: 1.3 });
      aviso = ctx.t('conseguido');
      tiempoAviso = 1.1;
      return;
    }
    for (const [x, z] of agujeros) {
      if (Math.hypot(bolaPos.x - x, bolaPos.y - z) < R_AGUJERO * 0.85) {
        estado = 'cae';
        reloj = 0.7;
        caidas += 1;
        bolaPos.set(x, z);
        ctx.sonido('agujero');
        ctx.sonido('fallo');
        ctx.vibrar(manoAgarre, 0.6, 120);
        aviso = ctx.t('caida');
        tiempoAviso = 1.2;
        return;
      }
    }
  }

  // ─── Bucle ─────────────────────────────────────────────────────────────
  function actualizar(dt, t) {
    reloj -= dt;
    tiempoAviso -= dt;
    ultimoChoque -= dt;
    if ((estado === 'intro' || estado === 'fin') && reloj <= 0) empezarPartida();

    entrada();
    incl.lerp(inclObjetivo, Math.min(1, dt * 10));
    tablero.rotation.set(incl.x, 0, incl.y);
    pomoX.rotation.x = incl.x * 6;
    pomoZ.rotation.z = incl.y * 6;

    if (estado === 'juego' || estado === 'cae' || estado === 'meta') {
      restante -= dt;
      tiempoNivel += dt;
      if (restante <= 0) {
        terminar();
      }
    }
    if (estado === 'juego') {
      simular(dt);
      comprobarAgujeros();
    } else if (estado === 'cae') {
      bola.scale.setScalar(Math.max(0.01, reloj / 0.7));
      if (reloj <= 0) {
        ponerBola();
        estado = 'juego';
      }
    } else if (estado === 'meta') {
      bolaPos.lerp(fin, Math.min(1, dt * 8));
      bola.scale.setScalar(Math.max(0.01, reloj / 1.1));
      if (reloj <= 0) {
        nivel += 1;
        estado = 'juego';
        generar();
      }
    }
    const hundida = estado === 'cae' || estado === 'meta' ? (1 - bola.scale.x) * 0.02 : 0;
    bola.position.set(bolaPos.x, R_BOLA - hundida, bolaPos.y);
    bola.rotation.x += bolaVel.y * dt / R_BOLA;
    bola.rotation.z -= bolaVel.x * dt / R_BOLA;
    sombraBola.position.set(bolaPos.x + 0.004, 0.0008, bolaPos.y + 0.004);
    sombraBola.visible = estado === 'juego';
    metaAro.material.color.setHSL(0.04, 1, 0.55 + Math.sin(t * 5) * 0.1);
    actualizarMarcador();
  }

  // Un laberinto de muestra para la pantalla de inicio
  generar();
  actualizarMarcador();

  return {
    actualizar,
    liberar() {},
  };
}
