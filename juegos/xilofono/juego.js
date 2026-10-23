// XILÓFONO
// Ocho teclas de cristal de neón flotan delante de ti, sobre una plataforma en un mundo de
// luz (suelo de cuadrícula que corre hacia ti, sol de neón en el horizonte, arcos de luz que
// laten con el ritmo). Por ocho carriles de luz llegan notas brillantes, cada una del color
// de su tecla: golpea la tecla justo cuando su nota llega a la línea y suena, así que eres
// tú quien toca la canción (si fallas, esa nota no suena). Es infinito: al acabar una
// canción empieza otra sola, cada vez más rápida. «¡Perfecto!» vale 3 y «Bien» 1,
// multiplicado por la racha (hasta x4), y cada canción completada da un premio y devuelve
// una vida. Tres notas perdidas y se acaba.
// En VR llevas una baqueta de luz en cada mano; sin gafas, haz clic (o toca) en la tecla o su carril.
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
const LARGO_PISTA = 8;    // las notas vienen de lejos, como en los juegos de ritmo de VR
const SUBIDA_PISTA = 1.2; // y bajan un poco hasta las teclas
const N_FICHAS = 48;
const LARGO_FICHA = 0.2;
const LARGO_BAQUETA = 0.34;
const R_CABEZA = 0.021;
const N_ARCOS = 8;
const N_RAYOS = 10;
const N_MOTAS = 180;
// Un color de neón por tecla, de grave a agudo
const COLORES = [0xff3d6e, 0xff7a2e, 0xffd23f, 0x6dff7a, 0x2ee6d6, 0x3d8bff, 0x9b6bff, 0xff5ce1];
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
// Lo que acelera cada canción completada y lo poco que llega a tardar una nota
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

  ctx.fondo(0x14082e, {
    cenit: 0x04020c, horizonte: 0x4a1270, suelo: 0x06030f, estrellas: 0.9, niebla: [14, 70],
    paisaje: { tipo: 'ciudad', color: 0x1a0d33, radio: 72 },
  });
  ctx.sueloBase(false);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.5, 0.38), new THREE.Vector3(0, 1.0, -1.6));

  const matrizTmp = new THREE.Matrix4();
  const eulerTmp = new THREE.Euler();
  const colorTmp = new THREE.Color();
  const blanco = new THREE.Color(0xffffff);
  const rojo = new THREE.Color(0xff2a3a);
  const negro = new THREE.Color(0x000000);
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
  function rectanguloRedondo(ancho, alto, radio, hueco = 0) {
    const forma = (an, al, r) => {
      const s = new THREE.Path();
      const x = -an / 2;
      const y = -al / 2;
      s.moveTo(x + r, y);
      s.lineTo(x + an - r, y);
      s.quadraticCurveTo(x + an, y, x + an, y + r);
      s.lineTo(x + an, y + al - r);
      s.quadraticCurveTo(x + an, y + al, x + an - r, y + al);
      s.lineTo(x + r, y + al);
      s.quadraticCurveTo(x, y + al, x, y + al - r);
      s.lineTo(x, y + r);
      s.quadraticCurveTo(x, y, x + r, y);
      return s;
    };
    const s = new THREE.Shape(forma(ancho, alto, radio).getPoints(4));
    if (hueco > 0) s.holes.push(forma(ancho - hueco * 2, alto - hueco * 2, Math.max(0.002, radio - hueco)));
    return s;
  }
  // Brillo suave (para halos y reflejos de luz): blanco en el centro y transparente en el borde
  const texBrillo = R(ctx.texturaCanvas((g, tam) => {
    const grad = g.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.35, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, tam, tam);
  }, { tam: 128 }));
  // Material de luz que se suma (los neones): con el color de instancia en negro no se ve
  const luzSumada = (opciones = {}) => R(new THREE.MeshBasicMaterial({
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, ...opciones,
  }));

  // ─── Mundo de neón ─────────────────────────────────────────────────────
  // Suelo de cuadrícula que corre hacia el jugador (da sensación de viaje)
  const texCuadricula = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#05030c';
    g.fillRect(0, 0, tam, tam);
    g.strokeStyle = '#b13cff';
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, tam - 3, tam - 3);
    g.strokeStyle = 'rgba(46, 230, 214, 0.35)';
    g.lineWidth = 1.5;
    g.beginPath();
    g.moveTo(tam / 2, 0); g.lineTo(tam / 2, tam);
    g.moveTo(0, tam / 2); g.lineTo(tam, tam / 2);
    g.stroke();
  }, { tam: 256, repetir: [40, 40], semilla: 181 }));
  const suelo = new THREE.Mesh(
    R(new THREE.PlaneGeometry(80, 80)),
    R(new THREE.MeshBasicMaterial({ map: texCuadricula, color: 0x8a7aa8 })),
  );
  suelo.rotation.x = -Math.PI / 2;
  raiz.add(suelo);
  // Sol de neón en el horizonte, partido en franjas, detrás de la ciudad
  const texSol = R(ctx.texturaCanvas((g, tam) => {
    const grad = g.createLinearGradient(0, 0, 0, tam);
    grad.addColorStop(0, '#ffe36e');
    grad.addColorStop(0.5, '#ff6a3d');
    grad.addColorStop(1, '#d1209a');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(tam / 2, tam / 2, tam / 2 - 2, 0, Math.PI * 2);
    g.fill();
    g.globalCompositeOperation = 'destination-out';
    for (let i = 0; i < 7; i++) {
      const y = tam * (0.55 + i * 0.065);
      g.fillRect(0, y, tam, 3 + i * 1.6);
    }
  }, { tam: 256 }));
  const sol = new THREE.Mesh(R(new THREE.PlaneGeometry(34, 34)), R(new THREE.MeshBasicMaterial({ map: texSol, transparent: true, depthWrite: false, fog: false, toneMapped: false })));
  sol.position.set(0, 9, -88);
  raiz.add(sol);
  // Plataforma hexagonal donde está el jugador, con borde de neón
  const plataforma = new THREE.Mesh(
    R(new THREE.CylinderGeometry(1.25, 1.35, 0.08, 6)),
    R(new THREE.MeshStandardMaterial({ color: 0x15122a, roughness: 0.25, metalness: 0.8 })),
  );
  plataforma.position.set(0, 0.04, -0.2);
  plataforma.rotation.y = Math.PI / 6;
  raiz.add(plataforma);
  const bordePlataforma = new THREE.Mesh(R(new THREE.TorusGeometry(1.3, 0.012, 6, 6)), R(new THREE.MeshBasicMaterial({ color: 0x2ee6d6, toneMapped: false })));
  bordePlataforma.rotation.set(Math.PI / 2, 0, Math.PI / 6);
  bordePlataforma.position.set(0, 0.085, -0.2);
  raiz.add(bordePlataforma);
  // Motas de luz que vienen hacia ti (una sola llamada de dibujo)
  const posMotas = new Float32Array(N_MOTAS * 3);
  for (let i = 0; i < N_MOTAS; i++) {
    posMotas[i * 3] = (Math.random() - 0.5) * 14;
    posMotas[i * 3 + 1] = 0.2 + Math.random() * 5;
    posMotas[i * 3 + 2] = -30 + Math.random() * 32;
  }
  const geoMotas = R(new THREE.BufferGeometry());
  geoMotas.setAttribute('position', new THREE.BufferAttribute(posMotas, 3));
  const motas = new THREE.Points(geoMotas, R(new THREE.PointsMaterial({ color: 0xbfa8ff, size: 0.035, transparent: true, opacity: 0.8, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false })));
  motas.frustumCulled = false;
  raiz.add(motas);
  // Rayos de luz a los lados, que se encienden con el pulso
  const rayos = new THREE.InstancedMesh(R(new THREE.CylinderGeometry(0.02, 0.02, 14, 6, 1, true)), luzSumada(), N_RAYOS);
  const coloresRayos = [];
  for (let i = 0; i < N_RAYOS; i++) {
    const lado = i % 2 ? 1 : -1;
    const fila = Math.floor(i / 2);
    matrizTmp.makeRotationFromEuler(eulerTmp.set(0.12 * fila - 0.25, 0, lado * (0.35 + fila * 0.08))).setPosition(lado * (4.5 + fila * 1.2), 5, -6 - fila * 4.5);
    rayos.setMatrixAt(i, matrizTmp);
    coloresRayos.push(new THREE.Color(i % 4 < 2 ? 0x2ee6d6 : 0xff3dd0));
    rayos.setColorAt(i, negro);
  }
  raiz.add(rayos);

  // ─── Teclas flotantes ──────────────────────────────────────────────────
  const xilofono = new THREE.Group();
  xilofono.position.set(0, 0.88, -0.42);
  raiz.add(xilofono);
  const X = (i) => (i - (N - 1) / 2) * PASO;
  const LARGOS = Array.from({ length: N }, (_, i) => 0.3 - i * 0.013); // las graves, más largas
  const ARRIBA = GROSOR_TECLA; // altura de la cara de arriba de las teclas sobre el grupo
  // Cada tecla: un bloque de cristal oscuro de su color, que se enciende al golpearlo
  const geoTecla = R(new THREE.ExtrudeGeometry(rectanguloRedondo(ANCHO_TECLA, GROSOR_TECLA, 0.007), { depth: 1, bevelEnabled: false, curveSegments: 3 }));
  geoTecla.translate(0, GROSOR_TECLA / 2, -0.5);
  // Borde de neón alrededor de la cara de arriba
  const geoBorde = R(new THREE.ShapeGeometry(rectanguloRedondo(ANCHO_TECLA + 0.008, 1, 0.01, 0.006)));
  geoBorde.rotateX(-Math.PI / 2);
  const teclas = COLORES.map((color, i) => {
    // Phong: el brillo de cristal sin el coste de MeshStandardMaterial (son 8 materiales)
    const material = R(new THREE.MeshPhongMaterial({
      color: new THREE.Color(color).multiplyScalar(0.35), specular: 0x9a9ab0, shininess: 90,
      emissive: color, emissiveIntensity: 0.25,
    }));
    const malla = new THREE.Mesh(geoTecla, material);
    malla.scale.z = LARGOS[i];
    malla.position.x = X(i);
    malla.userData.tecla = i;
    const borde = new THREE.Mesh(geoBorde, R(new THREE.MeshBasicMaterial({ color, toneMapped: false })));
    borde.scale.z = LARGOS[i] + 0.008;
    borde.position.set(X(i), ARRIBA + 0.0015, 0);
    xilofono.add(malla, borde);
    return { malla, material, borde, color: new THREE.Color(color), luz: 0, golpe: 0, error: 0 };
  });
  // Halo bajo cada tecla (el «motor» que la hace flotar) y columna de luz al golpearla
  const geoHalo = R(new THREE.PlaneGeometry(1, 1));
  geoHalo.rotateX(-Math.PI / 2);
  const halos = new THREE.InstancedMesh(geoHalo, luzSumada({ map: texBrillo }), N);
  const geoColumna = R(new THREE.CylinderGeometry(0.035, 0.05, 0.7, 10, 1, true));
  geoColumna.translate(0, 0.35, 0);
  const columnas = new THREE.InstancedMesh(geoColumna, luzSumada({ side: THREE.DoubleSide }), N);
  for (let i = 0; i < N; i++) {
    matrizTmp.makeScale(0.2, 1, LARGOS[i] + 0.12).setPosition(X(i), -0.06, 0);
    halos.setMatrixAt(i, matrizTmp);
    matrizTmp.makeScale(1, 1, 1).setPosition(X(i), ARRIBA, 0);
    columnas.setMatrixAt(i, matrizTmp);
    columnas.setColorAt(i, negro);
    halos.setColorAt(i, negro);
  }
  xilofono.add(halos, columnas);
  const sombraTeclas = ctx.crearSombra({ radio: 0.6, opacidad: 0.5 });
  sombraTeclas.position.set(0, 0.09, -0.42);
  sombraTeclas.scale.set(1, 1, 0.45);
  raiz.add(sombraTeclas);

  // ─── Carriles de luz por los que llegan las notas ──────────────────────
  // El grupo «pista» empieza en el borde lejano de las teclas y su eje -Z sube hacia el fondo.
  const pista = new THREE.Group();
  pista.position.set(0, ARRIBA + 0.004, -LARGOS[0] / 2 - 0.012);
  pista.rotation.x = Math.atan(SUBIDA_PISTA / LARGO_PISTA);
  xilofono.add(pista);
  const anchoPista = N * PASO;
  // Cristal oscuro bajo los carriles (solo se ve un poco) y que recibe los clics del ratón
  const texPista = R(ctx.texturaCanvas((g, tam) => {
    const grad = g.createLinearGradient(0, 0, 0, tam);
    grad.addColorStop(0, 'rgba(20, 8, 40, 0.0)');
    grad.addColorStop(0.3, 'rgba(20, 8, 40, 0.55)');
    grad.addColorStop(1, 'rgba(20, 8, 40, 0.75)');
    g.fillStyle = grad;
    g.fillRect(0, 0, tam, tam);
  }, { tam: 64 }));
  const cristal = new THREE.Mesh(R(new THREE.PlaneGeometry(anchoPista, LARGO_PISTA)), R(new THREE.MeshBasicMaterial({ map: texPista, transparent: true, depthWrite: false })));
  cristal.rotation.x = -Math.PI / 2;
  cristal.position.z = -LARGO_PISTA / 2;
  pista.add(cristal);
  // Líneas de neón: una tenue en el centro de cada carril y separadores blancos
  const lineas = [];
  const coloresLineas = [];
  for (let i = 0; i < N; i++) {
    lineas.push(colocar(new THREE.BoxGeometry(0.006, 0.002, LARGO_PISTA), X(i), 0.002, -LARGO_PISTA / 2));
    coloresLineas.push(new THREE.Color(COLORES[i]).multiplyScalar(0.55));
  }
  for (let i = 0; i <= N; i++) {
    lineas.push(colocar(new THREE.BoxGeometry(i % N === 0 ? 0.012 : 0.003, 0.002, LARGO_PISTA), X(i) - PASO / 2, 0.002, -LARGO_PISTA / 2));
    coloresLineas.push(new THREE.Color(i % N === 0 ? 0x2ee6d6 : 0x6a5a90));
  }
  pista.add(new THREE.Mesh(fusionar(lineas, coloresLineas), R(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }))));
  // La línea de golpe, que late con el pulso
  const matLinea = R(new THREE.MeshBasicMaterial({ color: 0xff6a3d, toneMapped: false }));
  const linea = new THREE.Mesh(R(new THREE.BoxGeometry(anchoPista + 0.06, 0.006, 0.012)), matLinea);
  linea.position.set(0, 0.004, -0.006);
  pista.add(linea);
  // Arcos de luz alrededor de los carriles, como un túnel que late con el ritmo
  const geoArco = R(new THREE.TorusGeometry(0.85, 0.012, 4, 4));
  geoArco.rotateZ(Math.PI / 4); // un cuadrado con la base plana
  const arcos = new THREE.InstancedMesh(geoArco, luzSumada(), N_ARCOS);
  const distArco = (k) => 1.4 + k * ((LARGO_PISTA - 1.4) / (N_ARCOS - 1));
  pista.add(arcos);

  // Notas: bloques de neón del color de su tecla, con su reflejo en el cristal
  const geoFicha = R(new THREE.ExtrudeGeometry(rectanguloRedondo(PASO * 0.82, LARGO_FICHA, 0.02), { depth: 0.024, bevelEnabled: false, curveSegments: 4 }));
  geoFicha.rotateX(-Math.PI / 2); // tumbada sobre el carril, de grosor hacia arriba
  geoFicha.translate(0, 0.003, -LARGO_FICHA / 2); // su borde cercano es el que marca el momento del golpe
  const fichas = new THREE.InstancedMesh(geoFicha, R(new THREE.MeshBasicMaterial({ toneMapped: false })), N_FICHAS);
  const geoReflejo = R(new THREE.PlaneGeometry(PASO * 2.2, LARGO_FICHA * 2.2));
  geoReflejo.rotateX(-Math.PI / 2);
  geoReflejo.translate(0, 0.001, -LARGO_FICHA / 2);
  const reflejos = new THREE.InstancedMesh(geoReflejo, luzSumada({ map: texBrillo }), N_FICHAS);
  for (const malla of [fichas, reflejos]) {
    malla.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    malla.setColorAt(0, negro);
    malla.instanceColor.setUsage(THREE.DynamicDrawUsage);
    malla.frustumCulled = false;
    malla.count = 0;
    pista.add(malla);
  }
  const ocultaFicha = new THREE.Matrix4().makeScale(0, 0, 0);
  const fichasLibres = []; // índices de notas sin usar
  for (let i = N_FICHAS - 1; i >= 0; i--) fichasLibres.push(i);

  // ─── Baquetas de luz: mango de metal con anillo de neón y cabeza brillante ─
  const perfilMango = [
    [0.0001, 0], [0.009, 0.002], [0.0098, 0.012], [0.0092, 0.07], [0.0072, 0.085], [0.0055, 0.2], [0.005, LARGO_BAQUETA - 0.012], [0.0001, LARGO_BAQUETA - 0.01],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geoMango = R(new THREE.LatheGeometry(perfilMango, 14));
  geoMango.rotateX(-Math.PI / 2);
  geoMango.translate(0, 0, 0.07);
  const geoCabeza = R(new THREE.SphereGeometry(R_CABEZA, 16, 12));
  const geoAnillo = R(new THREE.TorusGeometry(0.0105, 0.0022, 6, 18));
  const geoHaloCabeza = R(new THREE.PlaneGeometry(0.11, 0.11));
  const matMango = R(new THREE.MeshStandardMaterial({ color: 0x2a2d3c, roughness: 0.25, metalness: 0.9 }));
  const CABEZA_EN_MANO = new THREE.Vector3(0, 0, 0.07 - LARGO_BAQUETA + 0.01 - R_CABEZA * 0.6);
  function crearBaqueta(color) {
    const g = new THREE.Group();
    const mango = new THREE.Mesh(geoMango, matMango);
    const cabeza = new THREE.Mesh(geoCabeza, R(new THREE.MeshBasicMaterial({ color: new THREE.Color(color).lerp(new THREE.Color(0xffffff), 0.25), toneMapped: false })));
    cabeza.position.copy(CABEZA_EN_MANO);
    const matNeon = R(new THREE.MeshBasicMaterial({ color, toneMapped: false }));
    const anillos = [0.0, 0.055].map((z) => {
      const a = new THREE.Mesh(geoAnillo, matNeon);
      a.position.z = z;
      return a;
    });
    // Halo de la cabeza: siempre de cara a quien mira (se orienta en cada fotograma)
    const halo = new THREE.Mesh(geoHaloCabeza, luzSumada({ map: texBrillo, color, opacity: 0.6 }));
    halo.position.copy(CABEZA_EN_MANO);
    g.add(mango, cabeza, ...anillos, halo);
    return { grupo: g, halo };
  }
  const COLOR_MANO = [0x2ee6d6, 0xff6a3d];
  const baquetas = ctx.manos.map((mano, k) => {
    const { grupo, halo } = crearBaqueta(COLOR_MANO[k % 2]);
    grupo.rotation.x = -0.55; // un poco hacia abajo, como se cogen
    ctx.adjuntarAMano(mano, grupo);
    return { mano, objeto: grupo, halo, cabeza: new THREE.Vector3(), anterior: new THREE.Vector3(), armada: true, velocidad: 0 };
  });
  const baquetaRaton = crearBaqueta(0xff6a3d);
  raiz.add(baquetaRaton.grupo);
  let golpeRaton = 0;
  let teclaRaton = 3;

  // ─── Paneles: marcador a un lado y cartel de la canción al fondo ───────
  const marcador = ctx.crearPanel({ ancho: 0.95, alto: 0.34 });
  marcador.mesh.position.set(-1.05, 1.62, -1.35);
  marcador.mesh.rotation.y = 0.45;
  raiz.add(marcador.mesh);
  const cartel = ctx.crearPanel({ ancho: 2.6, alto: 0.52 });
  cartel.mesh.position.set(0, 3.0, -6.2);
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
  let pulsoArcos = 0;
  let fiesta = 0;      // al completar una canción, todo se enciende un momento
  let alarma = 0;      // al perder una nota, los arcos se ponen rojos
  let velocidad = 3;   // a lo que corre el suelo (m/s), según lo rápido que llegan las notas
  let bolsa = [];
  const notas = [];     // { t, tecla, llegada, hecha, ficha }
  const pulsos = [];    // { t, fuerte }
  const canciones = []; // { id, n, inicio, ultima, fin, llegada, completada }
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const camaraPos = new THREE.Vector3();

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
    canciones.push({ id: p.id, n, inicio, ultima, fin: inicio + p.pulsos * pulso, llegada, completada: false });
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
      tmp.set(0, 1.0, -0.6);
      ctx.efectos.impacto('grande', { pos: tmp, color: 0xffd23f, sonido: 'ovacion' });
      fiesta = 1.5;
    } else {
      ctx.sonido('zumbador');
    }
    for (const n of notas) soltarFicha(n);
    cartel.mesh.visible = true;
  }

  // ─── Notas en la pista ─────────────────────────────────────────────────
  function soltarFicha(nota) {
    if (nota.ficha < 0) return;
    fichas.setMatrixAt(nota.ficha, ocultaFicha);
    reflejos.setMatrixAt(nota.ficha, ocultaFicha);
    fichasLibres.push(nota.ficha);
    nota.ficha = -1;
  }

  function perderNota(nota) {
    nota.hecha = true;
    soltarFicha(nota);
    teclas[nota.tecla].error = 1;
    vidas -= 1;
    aviso = racha >= 10 ? ctx.t('rachaRota') : ctx.t('notaPerdida');
    colorAviso = '#ff8a80';
    tiempoAviso = 1.0;
    racha = 0;
    alarma = 1;
    // Fallar se nota distinto: sin partículas de celebración, un zumbido y un tirón en las dos manos
    ctx.sonido('fallo');
    for (const m of ctx.manos) ctx.vibrar(m, 0.5, 90);
    ctx.destello(0xff2a2a, 0.18);
    if (vidas <= 0) terminar();
  }

  // Golpe en una tecla en el instante «tiempo» (suena siempre: es un instrumento)
  function golpear(i, mano, fuerza = 1) {
    const tecla = teclas[i];
    tecla.golpe = 0.12;
    tecla.luz = Math.max(tecla.luz, 0.5);
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
    tecla.luz = perfecto ? 1.3 : 1;
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
    fiesta = 1.5;
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
    // El cartel del fondo anuncia cada canción mientras llegan sus primeras notas
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
  const objetivos = [cristal, ...teclas.map((k) => k.malla)];
  function raton(dt) {
    baquetaRaton.grupo.visible = ctx.raton.dentro || ctx.tactil;
    const choque = ctx.raton.rayo.intersectObjects(objetivos, false)[0];
    if (choque) {
      let i = choque.object.userData.tecla;
      if (i === undefined) {
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
    const grupo = baquetaRaton.grupo;
    tmp2.set(tmp.x + 0.1, tmp.y + 0.16, tmp.z + 0.26);
    grupo.position.copy(tmp2);
    grupo.lookAt(tmp2.multiplyScalar(2).sub(tmp));
    // Y se coloca para que sea la cabeza (no el centro del grupo) la que queda sobre la tecla
    tmp2.copy(CABEZA_EN_MANO).applyQuaternion(grupo.quaternion);
    grupo.position.copy(tmp).sub(tmp2);
  }

  // ─── Bucle ─────────────────────────────────────────────────────────────
  function actualizar(dt, t) {
    reloj -= dt;
    tiempoAviso -= dt;
    if ((estado === 'intro' || estado === 'fin') && reloj <= 0) empezarPartida();

    if (estado === 'juego') {
      tiempo += dt;
      // Pulso de fondo (un toque seco) y la línea de golpe y los arcos que laten con él
      while (siguientePulso < pulsos.length && pulsos[siguientePulso].t <= tiempo) {
        const fuerte = pulsos[siguientePulso].fuerte;
        ctx.sonido(fuerte ? 'xiloPulsoFuerte' : 'xiloPulso');
        pulsoLinea = fuerte ? 1 : 0.6;
        pulsoArcos = fuerte ? 1 : 0.55;
        siguientePulso++;
      }
      // Notas que aparecen, se acercan y se pasan
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
          matrizTmp.makeScale(escala, escala, escala).setPosition(X(n.tecla), 0, -u * LARGO_PISTA);
          fichas.setMatrixAt(n.ficha, matrizTmp);
          reflejos.setMatrixAt(n.ficha, matrizTmp);
          const cerca = falta < BIEN ? 0.45 : 0;
          fichas.setColorAt(n.ficha, colorTmp.set(COLORES[n.tecla]).lerp(blanco, cerca));
          reflejos.setColorAt(n.ficha, colorTmp.set(COLORES[n.tecla]).multiplyScalar(0.5 + cerca));
        }
        velocidad = LARGO_PISTA / n.llegada;
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
      for (const malla of [fichas, reflejos]) {
        malla.count = N_FICHAS;
        malla.instanceMatrix.needsUpdate = true;
        malla.instanceColor.needsUpdate = true;
      }
    } else {
      fichas.count = 0;
      reflejos.count = 0;
      velocidad += (1.5 - velocidad) * Math.min(1, dt);
    }

    if (ctx.enVR()) {
      baquetaRaton.grupo.visible = false;
      baquetasVR(dt);
    } else {
      raton(dt);
    }
    animarMundo(dt, t);
    actualizarMarcador();
  }

  // Las teclas, los arcos, los rayos, el suelo y las motas: todo late y se mueve con la música
  function animarMundo(dt, t) {
    pulsoLinea = Math.max(0, pulsoLinea - dt * 4);
    pulsoArcos = Math.max(0, pulsoArcos - dt * 3);
    fiesta = Math.max(0, fiesta - dt);
    alarma = Math.max(0, alarma - dt * 2);
    // Teclas: flotan un poco, se encienden y bajan al golpearlas
    xilofono.position.y = 0.88 + Math.sin(t * 1.3) * 0.003;
    for (let i = 0; i < N; i++) {
      const k = teclas[i];
      k.luz = Math.max(0, k.luz - dt * 3.5);
      k.golpe = Math.max(0, k.golpe - dt);
      k.error = Math.max(0, k.error - dt * 2.5);
      const bajada = k.golpe > 0 ? Math.sin((k.golpe / 0.12) * Math.PI) * 0.005 : 0;
      k.malla.position.y = -bajada;
      k.borde.position.y = ARRIBA + 0.0015 - bajada;
      k.material.emissive.copy(k.color).lerp(blanco, k.luz * 0.4).lerp(rojo, k.error);
      k.material.emissiveIntensity = 0.25 + k.luz * 1.6 + k.error * 1.2 + fiesta * 0.4;
      halos.setColorAt(i, colorTmp.copy(k.color).multiplyScalar(0.35 + k.luz * 0.9 + pulsoLinea * 0.15));
      columnas.setColorAt(i, colorTmp.copy(k.color).multiplyScalar(Math.min(1, k.luz) * 0.8));
      matrizTmp.makeScale(1, 0.3 + Math.min(1, k.luz) * 1.2, 1).setPosition(X(i), ARRIBA, 0);
      columnas.setMatrixAt(i, matrizTmp);
    }
    halos.instanceColor.needsUpdate = true;
    columnas.instanceColor.needsUpdate = true;
    columnas.instanceMatrix.needsUpdate = true;
    // Arcos del túnel: laten con el pulso, giran despacio y se ponen rojos al fallar
    for (let k = 0; k < N_ARCOS; k++) {
      const escala = 1 + pulsoArcos * 0.06 * (1 - k / N_ARCOS) + fiesta * 0.08;
      matrizTmp.makeRotationZ(Math.sin(t * 0.4 + k * 0.6) * 0.08).scale(tmp.set(escala, escala, 1)).setPosition(0, 0.62, -distArco(k));
      arcos.setMatrixAt(k, matrizTmp);
      colorTmp.set(k % 2 ? 0xff3dd0 : 0x2ee6d6).lerp(blanco, fiesta * 0.5).lerp(rojo, alarma);
      arcos.setColorAt(k, colorTmp.multiplyScalar(0.35 + pulsoArcos * 0.65 + fiesta * 0.5));
    }
    arcos.instanceMatrix.needsUpdate = true;
    arcos.instanceColor.needsUpdate = true;
    // Rayos a los lados: se encienden con los pulsos fuertes y del todo al completar una canción
    for (let i = 0; i < N_RAYOS; i++) {
      const v = Math.max(fiesta, pulsoArcos > 0.9 ? 0.7 : pulsoArcos * 0.25);
      rayos.setColorAt(i, colorTmp.copy(coloresRayos[i]).multiplyScalar(v));
    }
    rayos.instanceColor.needsUpdate = true;
    // Línea de golpe
    linea.scale.y = 1 + pulsoLinea * 1.5;
    matLinea.color.setHex(0xff6a3d).lerp(blanco, pulsoLinea * 0.5);
    // El suelo y las motas corren hacia el jugador, más deprisa cuanto más rápida es la canción
    texCuadricula.offset.y = (texCuadricula.offset.y + dt * velocidad * 0.12) % 1; // cada casilla mide 2 m
    const atr = geoMotas.attributes.position;
    for (let i = 0; i < N_MOTAS; i++) {
      let z = atr.array[i * 3 + 2] + dt * velocidad * 1.5;
      if (z > 2) z -= 32;
      atr.array[i * 3 + 2] = z;
    }
    atr.needsUpdate = true;
    // Los halos de las cabezas de las baquetas miran siempre a la cámara
    ctx.camara.getWorldPosition(camaraPos);
    for (const b of baquetas) b.halo.lookAt(camaraPos);
    baquetaRaton.halo.lookAt(camaraPos);
  }

  for (let i = 0; i < N_FICHAS; i++) {
    fichas.setMatrixAt(i, ocultaFicha);
    reflejos.setMatrixAt(i, ocultaFicha);
  }
  actualizarMarcador();

  return {
    actualizar,
    liberar() {},
  };
}
