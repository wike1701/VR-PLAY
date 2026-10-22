// XILÓFONO
// Un xilófono de colores en el escenario de un parque al atardecer. Por una rampa llegan
// fichas de luz, cada una por el carril de una tecla: golpea esa tecla justo cuando la ficha
// llega y suena su nota, así que eres tú quien toca la canción (si fallas, la nota no suena).
// Como Piano Tiles, es infinito: al acabar una canción empieza otra sola, cada vez más
// rápida. «¡Perfecto!» vale 3 y «Bien» 1, multiplicado por la racha (hasta x4), y cada
// canción completada da un premio y devuelve una vida. Tres notas perdidas y se acaba.
// En VR llevas una baqueta en cada mano; sin gafas, haz clic (o toca) en la tecla o su carril.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código.
export async function precargar() {}

const VIDAS = 3;
const PERFECTO = 0.075;   // ventana de «¡Perfecto!» (s)
const BIEN = 0.16;        // ventana de «Bien» (s)
const N = 8;              // teclas: do, re, mi, fa, sol, la, si y do agudo
const PASO = 0.105;       // distancia entre teclas (m)
const ANCHO_TECLA = 0.088;
const GROSOR_TECLA = 0.022;
const LARGO_RAMPA = 3.0;
const SUBIDA_RAMPA = 0.36; // la rampa sube hacia el fondo, como una pista de luz
const N_FICHAS = 48;
const LARGO_FICHA = 0.24;
const LARGO_BAQUETA = 0.34;
const R_CABEZA = 0.021;
// Colores de xilófono de juguete, de grave a agudo
const COLORES = [0xff4f5e, 0xff8a3d, 0xffd23f, 0x7ed957, 0x2ee6d6, 0x3d8bff, 0x9b6bff, 0xff6ec7];
const LETRAS = 'cdefgabC'; // en las partituras de abajo: c = do … b = si, C = do agudo; r = silencio

// Canciones de dominio público que caben en una octava de do mayor. Cada nota: letra y
// duración en pulsos (1 si no se pone). La primera es la más fácil; las demás van al azar.
const CANCIONES = [
  { id: 'estrellita', bpm: 96, partitura: 'c c g g a a g2 f f e e d d c2 g g f f e e d2 g g f f e e d2 c c g g a a g2 f f e e d d c2' },
  { id: 'corderito', bpm: 104, partitura: 'e d c d e e e2 d d d2 e g g2 e d c d e e e e d d e d c4' },
  { id: 'alegria', bpm: 104, partitura: 'e e f g g f e d c c d e e1.5 d0.5 d2 e e f g g f e d c c d e d1.5 c0.5 c2' },
  { id: 'pollitos', bpm: 104, partitura: 'c d e f g2 g2 a a a a g4 a a a a g4 f f f f e2 e2 d d d d c4' },
  { id: 'londres', bpm: 108, partitura: 'g1.5 a0.5 g f e f g2 d e f2 e f g2 g1.5 a0.5 g f e f g2 d2 g2 e c2' },
  { id: 'rema', bpm: 100, partitura: 'c1.5 c1.5 c d0.5 e1.5 e d0.5 e f0.5 g3 C0.5 C0.5 C0.5 g0.5 g0.5 g0.5 e0.5 e0.5 e0.5 c0.5 c0.5 c0.5 g f0.5 e d0.5 c3' },
  { id: 'cascabeles', bpm: 116, partitura: 'e e e2 e e e2 e g c1.5 d0.5 e4 f f f1.5 f0.5 f e e e0.5 e0.5 e d d e d2 g2 e e e2 e e e2 e g c1.5 d0.5 e4 f f f f f e e e0.5 e0.5 g g f d c4' },
  { id: 'susana', bpm: 112, partitura: 'c0.5 d0.5 e g g1.5 a0.5 g e c1.5 d0.5 e e d c d3 c0.5 d0.5 e g g1.5 a0.5 g e c1.5 d0.5 e e d d c3 f2 a2 a2 a1.5 g0.5 g g e c d3 c0.5 d0.5 e g g1.5 a0.5 g e c1.5 d0.5 e e d d c3' },
  { id: 'granja', bpm: 112, partitura: 'g g g d e e d2 b b a a g3 d g g g d e e d2 b b a a g4' },
];
// Lo que acelera cada canción completada y lo poco que llega a tardar una ficha
const ACELERA = 0.07;
const MAX_ACELERA = 2.0;
const LLEGADA_INICIAL = 2.3;
const LLEGADA_MINIMA = 1.05;
const PREMIO_MAXIMO = 15; // el premio de cada canción (10 × su número) deja de crecer en la 15.ª

function leerPartitura(texto) {
  const notas = [];
  let pulso = 0;
  for (const marca of texto.trim().split(/\s+/)) {
    const duracion = marca.length > 1 ? Number(marca.slice(1)) : 1;
    if (marca[0] !== 'r') notas.push({ pulso, tecla: LETRAS.indexOf(marca[0]) });
    pulso += duracion;
  }
  return { notas, pulsos: pulso };
}
const PARTITURAS = CANCIONES.map((c) => ({ ...c, ...leerPartitura(c.partitura) }));

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (r) => ctx.recurso(r);

  ctx.fondo(0xf6b98a, {
    cenit: 0x5f86c4, horizonte: 0xffcf9e, nubes: 0.4, sol: [0.35, 0.14, -1], niebla: [22, 80],
    paisaje: { tipo: 'colinas', color: 0x58744f, radio: 75 },
  });
  ctx.sueloBase(false);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.5, 0.38), new THREE.Vector3(0, 0.95, -1.5));

  const matrizTmp = new THREE.Matrix4();
  const eulerTmp = new THREE.Euler();
  const colorTmp = new THREE.Color();
  const blanco = new THREE.Color(0xffffff);
  const rojo = new THREE.Color(0xff2a2a);
  function colocar(geo, x, y, z, rx = 0, ry = 0, rz = 0) {
    matrizTmp.makeRotationFromEuler(eulerTmp.set(rx, ry, rz)).setPosition(x, y, z);
    return geo.applyMatrix4(matrizTmp);
  }
  // Une varias geometrías en una (una sola llamada de dibujo). Con «colores», una por pieza.
  function fusionar(geos, colores = null) {
    let nv = 0;
    let ni = 0;
    for (const g of geos) {
      nv += g.attributes.position.count;
      ni += g.index ? g.index.count : g.attributes.position.count;
    }
    const pos = new Float32Array(nv * 3);
    const nor = new Float32Array(nv * 3);
    const uv = new Float32Array(nv * 2);
    const col = colores ? new Float32Array(nv * 3) : null;
    const indices = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let ov = 0;
    let oi = 0;
    geos.forEach((g, k) => {
      const n = g.attributes.position.count;
      pos.set(g.attributes.position.array, ov * 3);
      nor.set(g.attributes.normal.array, ov * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, ov * 2);
      if (col) {
        colorTmp.set(colores[k]);
        for (let i = 0; i < n; i++) col.set([colorTmp.r, colorTmp.g, colorTmp.b], (ov + i) * 3);
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) indices[oi++] = g.index.array[i] + ov;
      else for (let i = 0; i < n; i++) indices[oi++] = ov + i;
      ov += n;
      g.dispose();
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    return R(geo);
  }
  function rectanguloRedondo(ancho, alto, radio) {
    const s = new THREE.Shape();
    const x = -ancho / 2;
    const y = -alto / 2;
    s.moveTo(x + radio, y);
    s.lineTo(x + ancho - radio, y);
    s.quadraticCurveTo(x + ancho, y, x + ancho, y + radio);
    s.lineTo(x + ancho, y + alto - radio);
    s.quadraticCurveTo(x + ancho, y + alto, x + ancho - radio, y + alto);
    s.lineTo(x + radio, y + alto);
    s.quadraticCurveTo(x, y + alto, x, y + alto - radio);
    s.lineTo(x, y + radio);
    s.quadraticCurveTo(x, y, x + radio, y);
    return s;
  }

  // ─── Escenario: un templete de música en un parque ─────────────────────
  const cesped = new THREE.Mesh(
    R(new THREE.CircleGeometry(60, 40)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.cesped(0x5b8a45, { tam: 512, repetir: [26, 26], semilla: 171 })) })),
  );
  cesped.rotation.x = -Math.PI / 2;
  raiz.add(cesped);
  // Tarima redonda de tablas con su escalón
  const matTablas = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tablas(0xb07a4a, { tablas: 14, repetir: [2, 2], semilla: 172 })) }));
  const tarima = new THREE.Mesh(fusionar([
    colocar(new THREE.CylinderGeometry(3.4, 3.4, 0.12, 40), 0, 0.06, -1.2),
    colocar(new THREE.CylinderGeometry(3.7, 3.7, 0.06, 40), 0, 0.03, -1.2),
  ]), matTablas);
  raiz.add(tarima);
  // Concha acústica al fondo: media cúpula con franjas
  const texConcha = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#f3e6cf';
    g.fillRect(0, 0, tam, tam);
    for (let i = 0; i < 12; i++) {
      g.fillStyle = i % 2 ? '#e8d3b0' : '#f7ecd8';
      g.fillRect((i * tam) / 12, 0, tam / 12, tam);
    }
    g.fillStyle = 'rgba(120, 70, 40, 0.18)';
    for (let i = 0; i <= 12; i++) g.fillRect((i * tam) / 12 - 1, 0, 2, tam);
  }, { tam: 256 }));
  const geoConcha = R(new THREE.SphereGeometry(4.2, 28, 12, Math.PI, Math.PI, 0, Math.PI / 2));
  const concha = new THREE.Mesh(geoConcha, R(new THREE.MeshLambertMaterial({ map: texConcha, side: THREE.DoubleSide })));
  concha.position.set(0, 0.12, -4.6);
  concha.scale.set(1, 1.05, 0.75);
  raiz.add(concha);
  // Columnas, barandilla y farolas del templete (madera pintada, fusionadas)
  const piezasMadera = [];
  for (const lado of [-1, 1]) {
    for (const z of [0.6, -1.2]) {
      piezasMadera.push(colocar(new THREE.CylinderGeometry(0.07, 0.08, 2.9, 12), lado * 3.1, 1.57, z));
      piezasMadera.push(colocar(new THREE.CylinderGeometry(0.12, 0.12, 0.12, 12), lado * 3.1, 3.04, z));
    }
    piezasMadera.push(colocar(new THREE.BoxGeometry(0.06, 0.06, 1.9), lado * 3.15, 0.95, -0.3));
    piezasMadera.push(colocar(new THREE.BoxGeometry(0.06, 0.06, 1.9), lado * 3.15, 0.55, -0.3));
    for (let k = 0; k < 7; k++) piezasMadera.push(colocar(new THREE.BoxGeometry(0.03, 0.42, 0.03), lado * 3.15, 0.74, 0.6 - k * 0.3));
  }
  raiz.add(new THREE.Mesh(fusionar(piezasMadera), R(new THREE.MeshLambertMaterial({ color: 0xf0ebe0 }))));
  // Guirnaldas de bombillas de columna a columna (una malla con colores por vértice)
  const bombillas = [];
  const coloresBombillas = [];
  const puntosCable = [];
  const tramos = [[[-3.1, 2.95, 0.6], [3.1, 2.95, 0.6]], [[-3.1, 2.95, -1.2], [3.1, 2.95, -1.2]], [[-3.1, 2.95, 0.6], [-3.1, 2.95, -1.2]], [[3.1, 2.95, 0.6], [3.1, 2.95, -1.2]]];
  tramos.forEach(([a, b], k) => {
    let anterior = null;
    for (let i = 0; i <= 14; i++) {
      const u = i / 14;
      const x = a[0] + (b[0] - a[0]) * u;
      const z = a[2] + (b[2] - a[2]) * u;
      const y = a[1] - Math.sin(u * Math.PI) * 0.35;
      const punto = new THREE.Vector3(x, y, z);
      if (anterior) puntosCable.push(anterior, punto);
      if (i > 0 && i < 14) {
        bombillas.push(colocar(new THREE.SphereGeometry(0.035, 8, 6), x, y - 0.05, z));
        coloresBombillas.push(COLORES[(i + k * 3) % COLORES.length]);
      }
      anterior = punto;
    }
  });
  raiz.add(new THREE.LineSegments(R(new THREE.BufferGeometry().setFromPoints(puntosCable)), R(new THREE.LineBasicMaterial({ color: 0x3a2c26 }))));
  raiz.add(new THREE.Mesh(fusionar(bombillas, coloresBombillas), R(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }))));
  raiz.add(ctx.arboles([
    { x: -7, z: -9, escala: 1.5 }, { x: 7.5, z: -10, escala: 1.7 }, { x: -11, z: -2, escala: 1.3 },
    { x: 11, z: -3, escala: 1.4 }, { x: -9, z: 6, escala: 1.4 }, { x: 9, z: 7, escala: 1.5 },
    { x: 0, z: 11, escala: 1.6 }, { x: -14, z: -12, escala: 1.8 }, { x: 15, z: -13, escala: 1.6 },
  ], { tipo: 'frondoso', semilla: 17 }));

  // ─── Xilófono ──────────────────────────────────────────────────────────
  const xilofono = new THREE.Group();
  xilofono.position.set(0, 0.86, -0.42);
  raiz.add(xilofono);
  const X = (i) => (i - (N - 1) / 2) * PASO;
  const LARGOS = Array.from({ length: N }, (_, i) => 0.3 - i * 0.013); // las graves, más largas
  const ARRIBA = GROSOR_TECLA; // altura de la cara de arriba de las teclas sobre el grupo
  // Teclas: una malla instanciada (una llamada de dibujo para las 8) con veta de madera lacada
  const geoTecla = R(new THREE.ExtrudeGeometry(rectanguloRedondo(ANCHO_TECLA, GROSOR_TECLA, 0.007), { depth: 1, bevelEnabled: false, curveSegments: 3 }));
  geoTecla.translate(0, GROSOR_TECLA / 2, -0.5);
  const texTecla = R(ctx.texturas.madera(0xf2f2f2, { tam: 256, semilla: 173 }));
  texTecla.center.set(0.5, 0.5);
  texTecla.rotation = Math.PI / 2; // la veta a lo largo de la tecla
  const teclas = new THREE.InstancedMesh(geoTecla, R(new THREE.MeshStandardMaterial({ map: texTecla, roughness: 0.32, metalness: 0 })), N);
  teclas.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  const estadoTeclas = Array.from({ length: N }, (_, i) => ({ luz: 0, golpe: 0, error: 0, color: new THREE.Color(COLORES[i]) }));
  function pintarTeclas() {
    for (let i = 0; i < N; i++) {
      const e = estadoTeclas[i];
      const bajada = e.golpe > 0 ? Math.sin((e.golpe / 0.12) * Math.PI) * 0.005 : 0;
      matrizTmp.makeScale(1, 1, LARGOS[i]).setPosition(X(i), -bajada, 0);
      teclas.setMatrixAt(i, matrizTmp);
      colorTmp.copy(e.color).lerp(blanco, e.luz * 0.55).lerp(rojo, e.error);
      teclas.setColorAt(i, colorTmp);
    }
    teclas.instanceMatrix.needsUpdate = true;
    teclas.instanceColor.needsUpdate = true;
  }
  pintarTeclas();
  xilofono.add(teclas);
  // Marco: dos largueros que se cierran hacia las agudas, con fieltro, clavijas y patas en X
  const piezasMarco = [];
  const piezasFieltro = [];
  const piezasClavijas = [];
  const xIzq = X(0) - PASO * 0.7;
  const xDer = X(N - 1) + PASO * 0.7;
  for (const lado of [-1, 1]) {
    const zIzq = lado * LARGOS[0] * 0.28;
    const zDer = lado * LARGOS[N - 1] * 0.28;
    const largo = Math.hypot(xDer - xIzq, zDer - zIzq);
    const giro = -Math.atan2(zDer - zIzq, xDer - xIzq);
    piezasMarco.push(colocar(new THREE.BoxGeometry(largo, 0.03, 0.03), (xIzq + xDer) / 2, -0.016, (zIzq + zDer) / 2, 0, giro, 0));
    piezasFieltro.push(colocar(new THREE.BoxGeometry(largo, 0.004, 0.022), (xIzq + xDer) / 2, -0.001, (zIzq + zDer) / 2, 0, giro, 0));
    for (let i = 0; i <= N; i++) {
      const x = X(i) - PASO / 2;
      const z = lado * (0.3 - (i - 0.5) * 0.013) * 0.28;
      piezasClavijas.push(colocar(new THREE.CylinderGeometry(0.0035, 0.0035, 0.03, 6), x, 0.01, z));
    }
  }
  // Travesaños y patas
  piezasMarco.push(colocar(new THREE.BoxGeometry(0.03, 0.03, LARGOS[0] * 0.56 + 0.03), xIzq, -0.016, 0));
  piezasMarco.push(colocar(new THREE.BoxGeometry(0.03, 0.03, LARGOS[N - 1] * 0.56 + 0.03), xDer, -0.016, 0));
  for (const x of [xIzq + 0.03, xDer - 0.03]) {
    piezasMarco.push(colocar(new THREE.CylinderGeometry(0.012, 0.014, 1.0, 8), x, -0.43, 0, 0.32, 0, 0));
    piezasMarco.push(colocar(new THREE.CylinderGeometry(0.012, 0.014, 1.0, 8), x, -0.43, 0, -0.32, 0, 0));
  }
  piezasMarco.push(colocar(new THREE.CylinderGeometry(0.01, 0.01, xDer - xIzq - 0.06, 8), 0, -0.6, 0, 0, 0, Math.PI / 2));
  xilofono.add(new THREE.Mesh(fusionar(piezasMarco), R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.madera(0x6b3f24, { tam: 128, semilla: 174 })) }))));
  xilofono.add(new THREE.Mesh(fusionar(piezasFieltro), R(new THREE.MeshLambertMaterial({ color: 0xa32a2a }))));
  xilofono.add(new THREE.Mesh(fusionar(piezasClavijas), R(new THREE.MeshStandardMaterial({ color: 0xd8b25a, roughness: 0.3, metalness: 1 }))));
  const sombraXilofono = ctx.crearSombra({ radio: 0.62, opacidad: 0.45 });
  sombraXilofono.position.set(0, 0.125, -0.42);
  sombraXilofono.scale.set(1, 1, 0.5);
  raiz.add(sombraXilofono);

  // ─── Rampa de luz por la que llegan las fichas ─────────────────────────
  // El grupo «pista» empieza en el borde lejano de las teclas y su eje -Z sube hacia el fondo.
  const pista = new THREE.Group();
  pista.position.set(0, ARRIBA + 0.004, -LARGOS[0] / 2 - 0.012);
  pista.rotation.x = Math.atan(SUBIDA_RAMPA / LARGO_RAMPA);
  xilofono.add(pista);
  const anchoPista = N * PASO;
  const texPista = R(ctx.texturaCanvas((g, tam) => {
    const alto = tam;
    const grad = g.createLinearGradient(0, 0, 0, alto);
    grad.addColorStop(0, '#2a1f3d');
    grad.addColorStop(1, '#141020');
    g.fillStyle = grad;
    g.fillRect(0, 0, tam, alto);
    for (let i = 0; i < N; i++) {
      const c = new THREE.Color(COLORES[i]);
      const x0 = (i / N) * tam;
      const gc = g.createLinearGradient(0, 0, 0, alto);
      gc.addColorStop(0, `rgba(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0},0.05)`);
      gc.addColorStop(1, `rgba(${c.r * 255 | 0},${c.g * 255 | 0},${c.b * 255 | 0},0.28)`);
      g.fillStyle = gc;
      g.fillRect(x0 + 3, 0, tam / N - 6, alto);
      g.fillStyle = 'rgba(255, 240, 220, 0.35)';
      g.fillRect(x0 - 1, 0, 2, alto);
    }
    g.fillRect(tam - 2, 0, 2, alto);
  }, { tam: 256 }));
  const rampa = new THREE.Mesh(R(new THREE.PlaneGeometry(anchoPista, LARGO_RAMPA)), R(new THREE.MeshBasicMaterial({ map: texPista })));
  rampa.rotation.x = -Math.PI / 2;
  rampa.position.z = -LARGO_RAMPA / 2;
  pista.add(rampa);
  // Bordes de la rampa y la línea de golpe (donde hay que dar), que late con el pulso
  const bordes = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(0.02, 0.025, LARGO_RAMPA), -anchoPista / 2 - 0.01, 0.006, -LARGO_RAMPA / 2),
    colocar(new THREE.BoxGeometry(0.02, 0.025, LARGO_RAMPA), anchoPista / 2 + 0.01, 0.006, -LARGO_RAMPA / 2),
    colocar(new THREE.BoxGeometry(anchoPista + 0.04, 0.4, 0.03), 0, -0.2, -LARGO_RAMPA - 0.015),
  ]), R(new THREE.MeshLambertMaterial({ color: 0x3a2f4a })));
  pista.add(bordes);
  const matLinea = R(new THREE.MeshBasicMaterial({ color: 0xff6a3d, toneMapped: false }));
  const linea = new THREE.Mesh(R(new THREE.BoxGeometry(anchoPista + 0.04, 0.008, 0.012)), matLinea);
  linea.position.set(0, 0.004, -0.006);
  pista.add(linea);
  // Patas de la rampa hasta la tarima
  const patasRampa = [];
  for (const x of [-anchoPista / 2, anchoPista / 2]) {
    for (const d of [1.2, 2.6]) {
      const y = 0.86 + ARRIBA + (d / LARGO_RAMPA) * SUBIDA_RAMPA;
      patasRampa.push(colocar(new THREE.CylinderGeometry(0.012, 0.012, y - 0.12, 6), x, (y + 0.12) / 2, -0.42 - LARGOS[0] / 2 - d));
    }
  }
  raiz.add(new THREE.Mesh(fusionar(patasRampa), R(new THREE.MeshLambertMaterial({ color: 0x2b2433 }))));

  // Fichas: una malla instanciada con el color de su tecla
  const geoFicha = R(new THREE.ExtrudeGeometry(rectanguloRedondo(PASO * 0.86, LARGO_FICHA, 0.02), { depth: 0.02, bevelEnabled: false, curveSegments: 4 }));
  geoFicha.rotateX(-Math.PI / 2); // tumbada sobre la rampa, de grosor hacia arriba
  geoFicha.translate(0, 0.002, -LARGO_FICHA / 2); // su borde cercano es el que marca el momento del golpe
  const fichas = new THREE.InstancedMesh(geoFicha, R(new THREE.MeshBasicMaterial({ toneMapped: false })), N_FICHAS);
  fichas.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  fichas.setColorAt(0, colorTmp.set(0xffffff));
  fichas.instanceColor.setUsage(THREE.DynamicDrawUsage);
  fichas.frustumCulled = false;
  fichas.count = 0;
  pista.add(fichas);
  const ocultaFicha = new THREE.Matrix4().makeScale(0, 0, 0);
  const fichasLibres = []; // índices de fichas sin usar
  for (let i = N_FICHAS - 1; i >= 0; i--) fichasLibres.push(i);

  // ─── Baquetas de xilófono: mango de ratán y cabeza de hilo ─────────────
  const perfilMango = [
    [0.0001, 0], [0.0085, 0.002], [0.0095, 0.012], [0.0085, 0.03], [0.0068, 0.05], [0.0055, 0.2], [0.005, LARGO_BAQUETA - 0.012], [0.0001, LARGO_BAQUETA - 0.01],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geoMango = R(new THREE.LatheGeometry(perfilMango, 12));
  geoMango.rotateX(-Math.PI / 2);
  geoMango.translate(0, 0, 0.07);
  const geoCabeza = R(new THREE.SphereGeometry(R_CABEZA, 16, 12));
  const geoTope = R(new THREE.CylinderGeometry(0.0105, 0.0095, 0.022, 12));
  geoTope.rotateX(-Math.PI / 2);
  const texHilo = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#ff6a3d';
    g.fillRect(0, 0, tam, tam);
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = i % 2 ? 'rgba(120, 20, 0, 0.35)' : 'rgba(255, 220, 190, 0.35)';
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(0, (i * tam) / 40);
      g.lineTo(tam, (i * tam) / 40 + 6);
      g.stroke();
    }
  }, { tam: 128 }));
  const matMango = R(new THREE.MeshStandardMaterial({ map: R(ctx.texturas.madera(0xe2c08a, { tam: 128, semilla: 175 })), roughness: 0.5 }));
  const matCabeza = R(new THREE.MeshStandardMaterial({ map: texHilo, roughness: 0.95, emissive: 0x3a1000 }));
  const matTope = R(new THREE.MeshLambertMaterial({ color: 0x2a2a30 }));
  const CABEZA_EN_MANO = new THREE.Vector3(0, 0, 0.07 - LARGO_BAQUETA + 0.01 - R_CABEZA * 0.6);
  function crearBaqueta() {
    const g = new THREE.Group();
    const mango = new THREE.Mesh(geoMango, matMango);
    const cabeza = new THREE.Mesh(geoCabeza, matCabeza);
    cabeza.position.copy(CABEZA_EN_MANO);
    const tope = new THREE.Mesh(geoTope, matTope);
    tope.position.z = 0.075;
    g.add(mango, cabeza, tope);
    return g;
  }
  const baquetas = ctx.manos.map((mano) => {
    const b = crearBaqueta();
    b.rotation.x = -0.55; // un poco hacia abajo, como se cogen
    ctx.adjuntarAMano(mano, b);
    return { mano, objeto: b, cabeza: new THREE.Vector3(), anterior: new THREE.Vector3(), armada: true, velocidad: 0 };
  });
  const baquetaRaton = crearBaqueta();
  raiz.add(baquetaRaton);
  let golpeRaton = 0;
  let teclaRaton = 3;

  // ─── Paneles: marcador a un lado y cartel de la canción al fondo ───────
  const marcador = ctx.crearPanel({ ancho: 0.95, alto: 0.34 });
  marcador.mesh.position.set(-1.05, 1.62, -1.35);
  marcador.mesh.rotation.y = 0.45;
  raiz.add(marcador.mesh);
  const cartel = ctx.crearPanel({ ancho: 2.1, alto: 0.42 });
  cartel.mesh.position.set(0, 2.2, -3.6);
  raiz.add(cartel.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'juego' | 'fin'
  let reloj = 3.5;
  let tiempo = 0;
  let puntos = 0;
  let vidas = VIDAS;
  let racha = 0;
  let mejorRacha = 0;
  let completadas = 0;
  let record = ctx.leer('record', 0);
  let nuevoRecord = false;
  let aviso = '';
  let colorAviso = '#ffe08a';
  let tiempoAviso = 0;
  let siguienteNota = 0;
  let siguientePulso = 0;
  let pulsoLinea = 0;
  let bolsa = [];
  const notas = [];     // { t, tecla, llegada, hecha, ficha }
  const pulsos = [];    // { t, fuerte }
  const canciones = []; // { id, n, inicio, ultima, fin, llegada, completada, anunciada }
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();

  const multiplicador = () => Math.min(4, 1 + Math.floor(racha / 10));

  function siguienteCancion(n) {
    if (n === 0) return PARTITURAS[0];
    if (!bolsa.length) {
      bolsa = PARTITURAS.slice(1);
      for (let i = bolsa.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [bolsa[i], bolsa[j]] = [bolsa[j], bolsa[i]];
      }
    }
    return bolsa.pop();
  }

  // Pone en la pista la canción número n, empezando (con 4 pulsos de cuenta) en «desde»
  function programar(n, desde) {
    const p = siguienteCancion(n);
    const factor = Math.min(MAX_ACELERA, 1 + n * ACELERA);
    const pulso = 60 / (p.bpm * factor);
    const llegada = Math.max(LLEGADA_MINIMA, LLEGADA_INICIAL - n * 0.11);
    const cuenta = Math.max(4 * pulso, 1.4);
    const inicio = desde + cuenta;
    for (let k = 4; k >= 1; k--) pulsos.push({ t: inicio - k * pulso, fuerte: k === 4 });
    for (let k = 0; k < p.pulsos; k++) pulsos.push({ t: inicio + k * pulso, fuerte: k % 4 === 0 });
    for (const nota of p.notas) notas.push({ t: inicio + nota.pulso * pulso, tecla: nota.tecla, llegada, hecha: false, ficha: -1 });
    const ultima = inicio + p.notas[p.notas.length - 1].pulso * pulso;
    canciones.push({ id: p.id, n, inicio, ultima, fin: inicio + p.pulsos * pulso, llegada, completada: false, anunciada: false });
  }

  function empezarPartida() {
    notas.length = 0;
    pulsos.length = 0;
    canciones.length = 0;
    bolsa = [];
    fichasLibres.length = 0;
    for (let i = N_FICHAS - 1; i >= 0; i--) fichasLibres.push(i);
    tiempo = 0;
    puntos = 0;
    vidas = VIDAS;
    racha = 0;
    mejorRacha = 0;
    completadas = 0;
    nuevoRecord = false;
    siguienteNota = 0;
    siguientePulso = 0;
    tiempoAviso = 0;
    programar(0, 0.6);
    programar(1, canciones[0].fin);
    estado = 'juego';
  }

  function terminar() {
    estado = 'fin';
    reloj = 8;
    ctx.puntuacion(puntos); // a la clasificación (juegos/marcadores.js)
    if (puntos > record) {
      record = puntos;
      nuevoRecord = puntos > 0;
      ctx.guardar('record', record);
    }
    if (nuevoRecord) {
      tmp.set(0, 0.95, -0.6);
      ctx.efectos.impacto('grande', { pos: tmp, color: 0xffd23f, sonido: 'ovacion' });
    } else {
      ctx.sonido('zumbador');
    }
    for (const n of notas) soltarFicha(n);
    cartel.mesh.visible = true;
  }

  // ─── Fichas en la pista ────────────────────────────────────────────────
  function soltarFicha(nota) {
    if (nota.ficha < 0) return;
    fichas.setMatrixAt(nota.ficha, ocultaFicha);
    fichasLibres.push(nota.ficha);
    nota.ficha = -1;
  }

  function perderNota(nota) {
    nota.hecha = true;
    soltarFicha(nota);
    const e = estadoTeclas[nota.tecla];
    e.error = 1;
    vidas -= 1;
    if (racha >= 10) {
      aviso = ctx.t('rachaRota');
    } else {
      aviso = ctx.t('notaPerdida');
    }
    colorAviso = '#ff8a80';
    tiempoAviso = 1.0;
    racha = 0;
    // Fallar se nota distinto: sin partículas de celebración, un zumbido y un tirón en las dos manos
    ctx.sonido('fallo');
    for (const m of ctx.manos) ctx.vibrar(m, 0.5, 90);
    ctx.destello(0xff2a2a, 0.18);
    if (vidas <= 0) terminar();
  }

  // Golpe en una tecla en el instante «tiempo» (suena siempre: es un instrumento)
  function golpear(i, mano, fuerza = 1) {
    const e = estadoTeclas[i];
    e.golpe = 0.12;
    e.luz = Math.max(e.luz, 0.45);
    ctx.sonido('xilo' + i);
    if (estado !== 'juego') {
      ctx.vibrar(mano, 0.15 + 0.2 * fuerza, 25);
      return;
    }
    // La nota pendiente de esa tecla más cercana en el tiempo
    let mejor = null;
    let dif = BIEN;
    for (let k = siguienteNota; k < notas.length; k++) {
      const n = notas[k];
      if (n.t - tiempo > BIEN) break;
      if (n.hecha || n.tecla !== i) continue;
      const d = Math.abs(n.t - tiempo);
      if (d <= dif) {
        dif = d;
        mejor = n;
      }
    }
    tmp.set(X(i), ARRIBA + 0.03, 0);
    xilofono.localToWorld(tmp);
    if (!mejor) {
      // Golpe sin nota: rompe la racha (para que aporrear todas no valga), pero no quita vidas
      racha = 0;
      ctx.vibrar(mano, 0.12, 20);
      return;
    }
    mejor.hecha = true;
    soltarFicha(mejor);
    racha += 1;
    mejorRacha = Math.max(mejorRacha, racha);
    const perfecto = dif <= PERFECTO;
    const suma = (perfecto ? 3 : 1) * multiplicador();
    puntos += suma;
    e.luz = 1;
    const hito = racha % 10 === 0 && racha <= 30;
    ctx.efectos.impacto(hito ? 'medio' : 'pequeño', { pos: tmp, mano, color: COLORES[i] });
    ctx.efectos.texto(tmp, `+${suma}`, { color: perfecto ? '#ffe08a' : '#ffffff', tam: perfecto ? 0.95 : 0.7 });
    aviso = hito ? ctx.t('multiplicador', { n: multiplicador() }) : perfecto ? ctx.t('perfecto') : ctx.t('bien');
    colorAviso = '#ffe08a';
    tiempoAviso = hito ? 1.2 : 0.45;
  }

  function cancionCompletada(c) {
    c.completada = true;
    completadas += 1;
    const premio = 10 * Math.min(c.n + 1, PREMIO_MAXIMO);
    puntos += premio;
    const vidaExtra = vidas < VIDAS;
    if (vidaExtra) vidas += 1;
    tmp.set(0, ARRIBA + 0.12, -0.25);
    xilofono.localToWorld(tmp);
    ctx.efectos.impacto('grande', { pos: tmp, color: 0xffd23f, sonido: 'fin' });
    ctx.efectos.texto(tmp, `+${premio}`, { color: '#ffd23f', tam: 1.3, vida: 1.3 });
    aviso = ctx.t(vidaExtra ? 'completadaVida' : 'completada', { n: premio });
    colorAviso = '#ffd23f';
    tiempoAviso = 2.2;
  }

  function actualizarMarcador() {
    if (estado === 'intro') {
      const intro = ctx.enVR() ? ctx.t('intro') : ctx.t(ctx.tactil ? 'introTactil' : 'introRaton');
      marcador.escribir([
        { texto: ctx.t('titulo'), tam: 1.25, color: '#ffd23f' },
        { texto: intro, tam: 0.62 },
      ]);
      cartel.escribir([{ texto: ctx.t('titulo'), tam: 1.3, color: '#ffd23f' }, { texto: ctx.t('subtitulo'), tam: 0.7 }]);
      return;
    }
    if (estado === 'fin') {
      marcador.escribir([
        { texto: ctx.t('partida.finPuntos', { n: puntos }), tam: 1.2, color: '#ffd23f' },
        { texto: ctx.t('resumen', { n: completadas, racha: mejorRacha }), tam: 0.62 },
        { texto: ctx.t('partida.recordNuevaPartida', { record, n: Math.max(1, Math.ceil(reloj)) }), tam: 0.56, color: '#cfd8dc' },
      ]);
      cartel.escribir([{ texto: nuevoRecord ? ctx.t('partida.nuevoRecord') : ctx.t('finPartida'), tam: 1.2, color: nuevoRecord ? '#ffd23f' : '#ff8a80' }]);
      return;
    }
    const corazones = '♥'.repeat(Math.max(0, vidas)) + '♡'.repeat(VIDAS - Math.max(0, vidas));
    marcador.escribir([
      { texto: ctx.t('marcador', { puntos, x: multiplicador() }), tam: 1.1 },
      tiempoAviso > 0
        ? { texto: aviso, tam: 0.78, color: colorAviso }
        : { texto: ctx.t('estado', { n: racha, vidas: corazones }), tam: 0.78, color: '#cfd8dc' },
    ]);
    // El cartel del fondo anuncia cada canción mientras llegan sus primeras fichas
    let c = null;
    for (const k of canciones) {
      if (!k.completada && tiempo < k.ultima + BIEN) {
        c = k;
        break;
      }
    }
    if (c && tiempo > c.inicio - c.llegada - 1.2 && tiempo < c.inicio + 2.5) {
      cartel.mesh.visible = true;
      cartel.escribir([
        { texto: ctx.t('numero', { n: c.n + 1 }), tam: 0.62, color: '#cfd8dc' },
        { texto: ctx.t('cancion', { nombre: ctx.t('canciones.' + c.id) }), tam: 1.15, color: '#ffffff' },
      ]);
    } else {
      cartel.mesh.visible = false;
    }
  }

  // ─── Golpes con las baquetas (VR) ──────────────────────────────────────
  function baquetasVR(dt) {
    for (const b of baquetas) {
      if (!b.mano.activa) continue;
      b.anterior.copy(b.cabeza);
      b.objeto.localToWorld(b.cabeza.copy(CABEZA_EN_MANO)); // con la inclinación de la baqueta en la mano
      // Velocidad hacia abajo de la cabeza (para la fuerza del golpe)
      b.velocidad = dt > 0 ? (b.anterior.y - b.cabeza.y) / dt : 0;
      xilofono.worldToLocal(tmp.copy(b.cabeza));
      const altura = tmp.y - R_CABEZA - ARRIBA;
      const i = Math.round(tmp.x / PASO + (N - 1) / 2);
      const dentro = i >= 0 && i < N && Math.abs(tmp.x - X(i)) < ANCHO_TECLA / 2 + 0.012 && Math.abs(tmp.z) < LARGOS[i] / 2 + 0.01;
      if (altura > 0.012) b.armada = true;
      else if (altura < 0) {
        // Solo cuenta si la cabeza baja desde arriba sobre una tecla (no si llega por debajo o de lado)
        if (b.armada && dentro && altura > -0.06) golpear(i, b.mano, Math.min(1, Math.max(0, b.velocidad) / 2.5));
        b.armada = false;
      }
    }
  }

  // ─── Ratón y pantalla táctil: la tecla o su carril ─────────────────────
  const objetivos = [teclas, rampa];
  function raton(dt) {
    baquetaRaton.visible = ctx.raton.dentro || ctx.tactil;
    const choque = ctx.raton.rayo.intersectObjects(objetivos, false)[0];
    if (choque) {
      let i;
      if (choque.object === teclas) i = choque.instanceId;
      else {
        xilofono.worldToLocal(tmp.copy(choque.point));
        i = Math.round(tmp.x / PASO + (N - 1) / 2);
      }
      if (i >= 0 && i < N) teclaRaton = i;
    }
    if (ctx.raton.clic && choque) {
      golpear(teclaRaton, null);
      golpeRaton = 0.14;
    }
    golpeRaton = Math.max(0, golpeRaton - dt);
    // La baqueta flota sobre la tecla apuntada y baja al golpear
    const bajada = golpeRaton > 0.08 ? (0.14 - golpeRaton) / 0.06 : golpeRaton / 0.08;
    tmp.set(X(teclaRaton), ARRIBA + R_CABEZA + 0.002 + 0.08 * (1 - bajada), 0.02);
    xilofono.localToWorld(tmp);
    // El mango sube hacia el jugador: el eje -Z de la baqueta apunta a la tecla
    tmp2.set(tmp.x + 0.1, tmp.y + 0.16, tmp.z + 0.26);
    baquetaRaton.position.copy(tmp2);
    baquetaRaton.lookAt(tmp2.multiplyScalar(2).sub(tmp));
    // Y se coloca para que sea la cabeza (no el centro del grupo) la que queda sobre la tecla
    tmp2.copy(CABEZA_EN_MANO).applyQuaternion(baquetaRaton.quaternion);
    baquetaRaton.position.copy(tmp).sub(tmp2);
  }

  // ─── Bucle ─────────────────────────────────────────────────────────────
  function actualizar(dt, t) {
    reloj -= dt;
    tiempoAviso -= dt;
    if ((estado === 'intro' || estado === 'fin') && reloj <= 0) empezarPartida();

    if (estado === 'juego') {
      tiempo += dt;
      // Pulso de fondo (un toque de madera) y la línea de golpe que late con él
      while (siguientePulso < pulsos.length && pulsos[siguientePulso].t <= tiempo) {
        ctx.sonido(pulsos[siguientePulso].fuerte ? 'xiloPulsoFuerte' : 'xiloPulso');
        pulsoLinea = pulsos[siguientePulso].fuerte ? 1 : 0.6;
        siguientePulso++;
      }
      // Fichas que aparecen, se acercan y se pasan
      for (let k = siguienteNota; k < notas.length && estado === 'juego'; k++) {
        const n = notas[k];
        const falta = n.t - tiempo;
        if (falta > n.llegada) break;
        if (n.hecha) continue;
        if (falta < -BIEN) {
          perderNota(n);
          continue;
        }
        if (n.ficha < 0 && fichasLibres.length) n.ficha = fichasLibres.pop();
        if (n.ficha >= 0) {
          // Entra creciendo con un pequeño rebote y se desliza hasta la línea de golpe
          const u = Math.max(0, falta) / n.llegada;
          const entra = Math.min(1, (1 - u) / 0.08);
          const escala = entra < 1 ? entra * (1 + 0.25 * Math.sin(entra * Math.PI)) : 1;
          matrizTmp.makeScale(escala, escala, escala).setPosition(X(n.tecla), 0, -u * LARGO_RAMPA);
          fichas.setMatrixAt(n.ficha, matrizTmp);
          fichas.setColorAt(n.ficha, colorTmp.set(COLORES[n.tecla]).lerp(blanco, falta < BIEN ? 0.35 : 0));
        }
      }
      while (siguienteNota < notas.length && notas[siguienteNota].hecha) siguienteNota++;
      if (estado === 'juego') {
        // Canciones: al pasar su última nota con vidas, completada; y siempre una más en la cola
        for (const c of canciones) if (!c.completada && tiempo > c.ultima + BIEN) cancionCompletada(c);
        const ultima = canciones[canciones.length - 1];
        if (tiempo > ultima.inicio) programar(ultima.n + 1, ultima.fin);
        // Lo ya pasado sale de las listas de vez en cuando (no en cada fotograma)
        if (siguienteNota > 120) {
          notas.splice(0, siguienteNota);
          siguienteNota = 0;
        }
        if (siguientePulso > 200) {
          pulsos.splice(0, siguientePulso);
          siguientePulso = 0;
        }
        if (canciones.length > 4) canciones.shift();
      }
      fichas.count = N_FICHAS;
      fichas.instanceMatrix.needsUpdate = true;
      fichas.instanceColor.needsUpdate = true;
    } else {
      fichas.count = 0;
    }

    if (ctx.enVR()) {
      baquetaRaton.visible = false;
      baquetasVR(dt);
    } else {
      raton(dt);
    }

    // Teclas que se iluminan y bajan un poco al golpearlas
    for (const e of estadoTeclas) {
      e.luz = Math.max(0, e.luz - dt * 3.5);
      e.golpe = Math.max(0, e.golpe - dt);
      e.error = Math.max(0, e.error - dt * 2.5);
    }
    pintarTeclas();
    pulsoLinea = Math.max(0, pulsoLinea - dt * 4);
    linea.scale.y = 1 + pulsoLinea * 1.5;
    matLinea.color.setHex(0xff6a3d).lerp(blanco, pulsoLinea * 0.5);
    rampa.material.color.setScalar(0.85 + pulsoLinea * 0.15 + Math.sin(t * 0.8) * 0.02);
    actualizarMarcador();
  }

  for (let i = 0; i < N_FICHAS; i++) fichas.setMatrixAt(i, ocultaFicha);
  actualizarMarcador();

  return {
    actualizar,
    liberar() {},
  };
}
