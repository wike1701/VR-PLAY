// LAST CALL: BAR LOCO
// Estás detrás de la barra de un bar de noche. Al otro lado se sientan clientes un poco locos, cada uno
// con su pedido en un bocadillo: las medidas de cada botella (por colores), si lleva hielo y si va
// agitado en la coctelera. Preparas la bebida en el vaso y se la mandas por la barra al cliente que la
// ha pedido. Cuanto antes, más propina. Si se la das a otro, se enfada; si el vaso se cae de la barra,
// se rompe; si un cliente espera demasiado, se va. Algunos cambian de idea a mitad y de vez en cuando
// llega un pedido especial (dorado) que vale el doble. El turno dura 1 minuto.
//
// En VR: coges las botellas con el gatillo y las inclinas sobre el vaso para servir (cada chorro largo,
// una medida); coges un hielo del cubo y lo sueltas en el vaso; coges el vaso y lo agitas con fuerza
// para mezclarlo en la coctelera; y lo empujas por la barra hacia el cliente (o lo dejas delante de él).
// Para vaciarlo, dale la vuelta. Con ratón o en el móvil: tocas cada botella (una medida), el hielo, la
// coctelera y luego al cliente; el fregadero vacía el vaso.
import * as THREE from 'three';

// Todo se genera con código: no hay nada que descargar.
export async function precargar() {}

const DURACION = 60;           // segundos del turno
const BARRA_Y = 1.0;           // altura de la barra
const BARRA_Z0 = -0.1;         // borde del lado del camarero
const BARRA_Z1 = -0.84;        // borde del lado de los clientes
const ENTREGA_Z = -0.7;        // donde se deja la bebida delante de cada cliente
const VASO_X = 0;              // posición del vaso que se prepara
const VASO_Z = -0.34;
const ALTO_VASO = 0.13;
const R_VASO = 0.04;
const MAX_MEDIDAS = 4;
const BOTELLAS_X = [-0.7, -0.55, -0.4, -0.25];
const BOTELLAS_Z = -0.22;
const HIELO_POS = new THREE.Vector3(0.3, BARRA_Y, -0.26);
const COCTELERA_POS = new THREE.Vector3(0.5, BARRA_Y, -0.24);
const FREGADERO_POS = new THREE.Vector3(0.72, BARRA_Y, -0.3);
const ASIENTOS_X = [-0.75, 0, 0.75];
const CLIENTE_Z = -1.18;
const TIEMPO_MEDIDA = 0.5;     // segundos de chorro por medida (VR)
const TIEMPO_AGITAR = 0.8;     // segundos agitando fuerte (VR)
const R_COGER = 0.12;
const HISTORIAL = 8;

// Las 4 botellas: granadina, curaçao, menta y ron
const LICORES = [0xe53935, 0x1e88e5, 0x7cb342, 0xffa000];
// Clientes: camisas, pieles y sombreros
const CAMISAS = [0x8e24aa, 0x00897b, 0xf4511e, 0x3949ab, 0xc0ca33, 0xd81b60];
const PIELES = [0xf1c27d, 0xe0ac69, 0xc68642, 0x8d5524, 0xffdbac];
const SOMBREROS = [0xff6a3d, 0x212121, 0xfdd835, 0x43a047, 0x6d4c41];

const azar = (a, b) => a + Math.random() * (b - a);
const entero = (n) => Math.floor(Math.random() * n);
const suave = (s) => 1 - Math.pow(1 - s, 3);
// Llega con un pequeño rebote (sobrepaso) al final
const rebote = (s) => 1 + 2.2 * Math.pow(s - 1, 3) + 1.2 * Math.pow(s - 1, 2);

// Junta varias geometrías en una (menos llamadas de dibujo). Con «colores», un color por pieza.
function fusionar(geometrias, colores = null) {
  const partes = geometrias.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = partes.reduce((n, g) => n + g.attributes.position.count, 0);
  const resultado = new THREE.BufferGeometry();
  for (const nombre of colores ? ['position', 'normal'] : ['position', 'normal', 'uv']) {
    const tam = partes[0].attributes[nombre].itemSize;
    const datos = new Float32Array(total * tam);
    let o = 0;
    for (const g of partes) {
      datos.set(g.attributes[nombre].array, o);
      o += g.attributes[nombre].array.length;
    }
    resultado.setAttribute(nombre, new THREE.BufferAttribute(datos, tam));
  }
  if (colores) {
    const datos = new Float32Array(total * 3);
    const c = new THREE.Color();
    let o = 0;
    partes.forEach((g, i) => {
      c.set(colores[i]);
      for (let v = 0; v < g.attributes.position.count; v++, o += 3) datos.set([c.r, c.g, c.b], o);
    });
    resultado.setAttribute('color', new THREE.BufferAttribute(datos, 3));
  }
  for (const g of new Set([...geometrias, ...partes])) g.dispose();
  return resultado;
}

const perfil = (puntos) => puntos.map(([x, y]) => new THREE.Vector2(x, y));

// Botella de licor con su etiqueta y el pico vertedor de metal (la base en y = 0, el pico en y = 0.3)
function geometriaBotella(color) {
  const vidrio = new THREE.Color(color).multiplyScalar(0.75).getHex();
  return fusionar([
    new THREE.LatheGeometry(perfil([[0.001, 0], [0.034, 0], [0.037, 0.01], [0.037, 0.17], [0.03, 0.2], [0.014, 0.235], [0.013, 0.262], [0.001, 0.262]]), 20),
    new THREE.CylinderGeometry(0.0375, 0.0375, 0.07, 20, 1, true).translate(0, 0.095, 0),
    new THREE.CylinderGeometry(0.0377, 0.0377, 0.012, 20, 1, true).translate(0, 0.095, 0),
    new THREE.CylinderGeometry(0.0145, 0.0145, 0.016, 12).translate(0, 0.262, 0),
    new THREE.CylinderGeometry(0.004, 0.006, 0.045, 8).rotateZ(-0.35).translate(0.006, 0.288, 0),
  ], [vidrio, 0xf3ead2, color, 0xb0bec5, 0xcfd8dc]);
}

// Vaso de tubo de cristal grueso (la base en y = 0)
function geometriaVaso() {
  return new THREE.LatheGeometry(perfil([[0.001, 0], [0.034, 0], [0.036, 0.004], [0.036, 0.012], [0.031, 0.013], [0.031, 0.002],
    [0.03, 0.012], [0.036, 0.016], [R_VASO, ALTO_VASO], [R_VASO - 0.003, ALTO_VASO], [0.034, 0.016], [0.001, 0.016]]), 24);
}

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  // ─── El bar ────────────────────────────────────────────────────────────
  ctx.fondo(0x2a1a22, { cenit: 0x140c12, horizonte: 0x3a2228, suelo: 0x1c1216, niebla: [6, 15] });
  ctx.sueloBase(false);
  const VISTAS = {
    horizontal: [new THREE.Vector3(0, 1.76, 0.7), new THREE.Vector3(0, 1.4, -0.95)],
    vertical: [new THREE.Vector3(0, 2.05, 1.3), new THREE.Vector3(0, 1.3, -0.8)],
  };
  let vistaVertical = null;
  function colocarVista() {
    const vertical = ctx.camara.aspect < 1;
    if (vertical === vistaVertical) return;
    vistaVertical = vertical;
    ctx.vistaEscritorio(...VISTAS[vertical ? 'vertical' : 'horizontal']);
  }
  colocarVista();

  // Suelo de tablas oscuras y paredes de ladrillo
  const texSuelo = R(ctx.texturas.tablas(0x5a3a26, { tam: 512, repetir: [5, 5], semilla: 301 }));
  raiz.add(new THREE.Mesh(R(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2).translate(0, 0, -1.5)), R(new THREE.MeshLambertMaterial({ map: texSuelo }))));
  const texLadrillo = R(ctx.texturas.ladrillos(0x7a3b2e, 0x3d2a24, { tam: 512, repetir: [6, 3], semilla: 302 }));
  raiz.add(new THREE.Mesh(R(fusionar([
    new THREE.PlaneGeometry(9, 4).translate(0, 2, -3.4),
    new THREE.PlaneGeometry(9, 4).rotateY(Math.PI / 2).translate(-3.2, 2, -1),
    new THREE.PlaneGeometry(9, 4).rotateY(-Math.PI / 2).translate(3.2, 2, -1),
    new THREE.PlaneGeometry(9, 4).rotateY(Math.PI).translate(0, 2, 2.4),
  ])), R(new THREE.MeshLambertMaterial({ map: texLadrillo }))));
  // Techo con vigas
  const techo = [new THREE.PlaneGeometry(9, 9).rotateX(Math.PI / 2).translate(0, 3.4, -1)];
  for (const z of [-2.6, -1.4, -0.2, 1]) techo.push(new THREE.BoxGeometry(7, 0.18, 0.16).translate(0, 3.3, z));
  raiz.add(new THREE.Mesh(R(fusionar(techo)), R(new THREE.MeshLambertMaterial({ color: 0x2b1d17 }))));

  // Estanterías del fondo llenas de botellas, con un espejo detrás
  const texMadera = R(ctx.texturas.madera(0x6b4128, { tam: 256, repetir: [3, 1], semilla: 303 }));
  const matMadera = R(new THREE.MeshLambertMaterial({ map: texMadera }));
  const estantes = [];
  for (const y of [1.25, 1.75, 2.25]) estantes.push(new THREE.BoxGeometry(3.6, 0.05, 0.3).translate(0, y, -3.22));
  for (const x of [-1.8, 1.8]) estantes.push(new THREE.BoxGeometry(0.08, 1.6, 0.32).translate(x, 1.65, -3.22));
  estantes.push(new THREE.BoxGeometry(3.8, 0.9, 0.5).translate(0, 0.45, -3.15)); // mueble bajo
  raiz.add(new THREE.Mesh(R(fusionar(estantes)), matMadera));
  raiz.add(new THREE.Mesh(R(new THREE.PlaneGeometry(3.5, 1.5).translate(0, 1.72, -3.38)), R(new THREE.MeshLambertMaterial({ color: 0x40505e, emissive: 0x141a20 }))));
  const decorado = [];
  const coloresDecorado = [];
  const tonos = [0x8d2a1f, 0x2e7d32, 0x5d4037, 0x1565c0, 0xf9a825, 0xad1457, 0x00838f, 0xe0e0e0];
  let k = 0;
  for (const y of [1.275, 1.775, 2.275]) {
    for (let x = -1.65; x <= 1.65; x += 0.17 + ((k * 7) % 3) * 0.02) {
      const alto = 0.22 + ((k * 5) % 4) * 0.035;
      const ancho = 0.032 + ((k * 3) % 3) * 0.006;
      const g = new THREE.LatheGeometry(perfil([[0.001, 0], [ancho, 0], [ancho, alto * 0.62], [ancho * 0.4, alto * 0.8], [ancho * 0.36, alto], [0.001, alto]]), 8);
      decorado.push(g.translate(x, y, -3.2 + ((k * 13) % 5) * 0.02));
      coloresDecorado.push(tonos[(k * 5 + 3) % tonos.length]);
      k++;
    }
  }
  raiz.add(new THREE.Mesh(R(fusionar(decorado, coloresDecorado)), R(new THREE.MeshLambertMaterial({ vertexColors: true }))));

  // Letrero de neón: una copa de cóctel con su aceituna (brilla por sí sola, sin luces)
  const neon = [];
  const tubo = (curva, r = 0.018) => neon.push(new THREE.TubeGeometry(curva, 24, r, 6, false));
  const lineaNeon = (a, b) => tubo(new THREE.LineCurve3(new THREE.Vector3(...a), new THREE.Vector3(...b)));
  lineaNeon([-0.42, 3.0, -3.3], [0.42, 3.0, -3.3]);
  lineaNeon([-0.42, 3.0, -3.3], [0, 2.62, -3.3]);
  lineaNeon([0.42, 3.0, -3.3], [0, 2.62, -3.3]);
  lineaNeon([0, 2.62, -3.3], [0, 2.4, -3.3]);
  lineaNeon([-0.18, 2.4, -3.3], [0.18, 2.4, -3.3]);
  lineaNeon([0.12, 2.86, -3.3], [0.4, 3.18, -3.3]);
  raiz.add(new THREE.Mesh(R(fusionar(neon)), R(new THREE.MeshBasicMaterial({ color: 0xff6a3d, toneMapped: false }))));
  const aceituna = new THREE.Mesh(R(new THREE.TorusGeometry(0.06, 0.016, 6, 18).translate(0.1, 2.84, -3.3)), R(new THREE.MeshBasicMaterial({ color: 0x9cff57, toneMapped: false })));
  raiz.add(aceituna);

  // La barra: encimera de madera barnizada, frente de paneles y reposapiés de latón
  const texEncimera = R(ctx.texturas.madera(0x4a2a17, { tam: 512, repetir: [4, 1], semilla: 304 }));
  raiz.add(new THREE.Mesh(R(new THREE.BoxGeometry(2.6, 0.05, BARRA_Z0 - BARRA_Z1 + 0.06).translate(0, BARRA_Y - 0.025, (BARRA_Z0 + BARRA_Z1) / 2)),
    R(new THREE.MeshPhongMaterial({ map: texEncimera, shininess: 60, specular: 0x332211 }))));
  const frente = [new THREE.BoxGeometry(2.5, BARRA_Y - 0.05, 0.06).translate(0, (BARRA_Y - 0.05) / 2, BARRA_Z1 + 0.06)];
  for (let x = -1.05; x <= 1.06; x += 0.35) frente.push(new THREE.BoxGeometry(0.28, 0.6, 0.02).translate(x, 0.5, BARRA_Z1 + 0.025));
  frente.push(new THREE.BoxGeometry(2.5, BARRA_Y - 0.05, 0.05).translate(0, (BARRA_Y - 0.05) / 2, BARRA_Z0 - 0.06));
  raiz.add(new THREE.Mesh(R(fusionar(frente)), matMadera));
  const laton = [new THREE.CylinderGeometry(0.02, 0.02, 2.5, 10).rotateZ(Math.PI / 2).translate(0, 0.22, BARRA_Z1 - 0.12)];
  for (let x = -1.1; x <= 1.11; x += 0.55) laton.push(new THREE.CylinderGeometry(0.012, 0.012, 0.14, 6).rotateX(Math.PI / 2).translate(x, 0.22, BARRA_Z1 - 0.05));
  // Taburetes: pie cromado y asiento rojo
  const asientos = [];
  for (const x of ASIENTOS_X) {
    laton.push(new THREE.CylinderGeometry(0.025, 0.025, 0.72, 10).translate(x, 0.36, CLIENTE_Z));
    laton.push(new THREE.CylinderGeometry(0.2, 0.22, 0.03, 18).translate(x, 0.015, CLIENTE_Z));
    laton.push(new THREE.TorusGeometry(0.16, 0.012, 6, 18).rotateX(Math.PI / 2).translate(x, 0.32, CLIENTE_Z));
    asientos.push(new THREE.CylinderGeometry(0.2, 0.18, 0.08, 20).translate(x, 0.76, CLIENTE_Z));
  }
  raiz.add(new THREE.Mesh(R(fusionar(laton)), R(new THREE.MeshLambertMaterial({ color: 0xc9a227 }))));
  raiz.add(new THREE.Mesh(R(fusionar(asientos)), R(new THREE.MeshLambertMaterial({ color: 0xb71c1c }))));

  // Lámparas colgantes sobre la barra
  const lamparas = [];
  const bombillas = [];
  for (const x of [-0.9, 0, 0.9]) {
    lamparas.push(new THREE.CylinderGeometry(0.006, 0.006, 1.1, 4).translate(x, 2.85, -0.7));
    lamparas.push(new THREE.ConeGeometry(0.16, 0.16, 18, 1, true).translate(x, 2.24, -0.7));
    bombillas.push(new THREE.SphereGeometry(0.055, 12, 8).translate(x, 2.17, -0.7));
  }
  raiz.add(new THREE.Mesh(R(fusionar(lamparas)), R(new THREE.MeshLambertMaterial({ color: 0x1b3a2f, side: THREE.DoubleSide }))));
  raiz.add(new THREE.Mesh(R(fusionar(bombillas)), R(new THREE.MeshBasicMaterial({ color: 0xffe0a0, toneMapped: false }))));

  // Puesto del camarero: alfombrilla de goma, cubo de hielo, fregadero y raíl de las botellas
  const puesto = [
    new THREE.BoxGeometry(0.2, 0.006, 0.16).translate(VASO_X, BARRA_Y + 0.003, VASO_Z),
    new THREE.BoxGeometry(0.66, 0.012, 0.11).translate(-0.475, BARRA_Y + 0.006, BOTELLAS_Z),
  ];
  raiz.add(new THREE.Mesh(R(fusionar(puesto)), R(new THREE.MeshLambertMaterial({ color: 0x1f1f22 }))));
  const metal = [
    new THREE.LatheGeometry(perfil([[0.001, 0], [0.075, 0], [0.095, 0.11], [0.1, 0.11], [0.1, 0.118], [0.001, 0.118]]), 22).translate(HIELO_POS.x, BARRA_Y, HIELO_POS.z),
    new THREE.TorusGeometry(0.1, 0.008, 6, 22).rotateX(Math.PI / 2).translate(HIELO_POS.x, BARRA_Y + 0.118, HIELO_POS.z),
    new THREE.BoxGeometry(0.2, 0.012, 0.2).translate(FREGADERO_POS.x, BARRA_Y + 0.004, FREGADERO_POS.z),
    new THREE.CylinderGeometry(0.01, 0.01, 0.2, 8).translate(FREGADERO_POS.x + 0.12, BARRA_Y + 0.1, FREGADERO_POS.z - 0.09),
    new THREE.CylinderGeometry(0.009, 0.009, 0.12, 8).rotateZ(Math.PI / 2).translate(FREGADERO_POS.x + 0.07, BARRA_Y + 0.2, FREGADERO_POS.z - 0.09),
    new THREE.CylinderGeometry(0.009, 0.007, 0.04, 8).translate(FREGADERO_POS.x + 0.015, BARRA_Y + 0.18, FREGADERO_POS.z - 0.09),
  ];
  raiz.add(new THREE.Mesh(R(fusionar(metal)), R(new THREE.MeshStandardMaterial({ color: 0xc5ccd3, metalness: 0.85, roughness: 0.3 }))));
  // Agua oscura del fregadero y los hielos del cubo
  raiz.add(new THREE.Mesh(R(new THREE.PlaneGeometry(0.17, 0.17).rotateX(-Math.PI / 2).translate(FREGADERO_POS.x, BARRA_Y + 0.011, FREGADERO_POS.z)), R(new THREE.MeshLambertMaterial({ color: 0x23323d }))));
  const hielos = [];
  for (let i = 0; i < 14; i++) {
    const a = i * 2.4;
    const r = 0.025 + (i % 3) * 0.022;
    hielos.push(new THREE.BoxGeometry(0.03, 0.03, 0.03).rotateX(a).rotateY(a * 1.3).translate(HIELO_POS.x + Math.cos(a) * r, BARRA_Y + 0.105 + (i % 2) * 0.012, HIELO_POS.z + Math.sin(a) * r));
  }
  const matHielo = R(new THREE.MeshStandardMaterial({ color: 0xd8f3ff, roughness: 0.1, metalness: 0, emissive: 0x16303a }));
  raiz.add(new THREE.Mesh(R(fusionar(hielos)), matHielo));

  // ─── Botellas ──────────────────────────────────────────────────────────
  const matBotella = R(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.18, metalness: 0.1 }));
  const botellas = LICORES.map((color, i) => {
    const malla = new THREE.Mesh(R(geometriaBotella(color)), matBotella);
    const casa = new THREE.Vector3(BOTELLAS_X[i], BARRA_Y + 0.012, BOTELLAS_Z);
    malla.position.copy(casa);
    raiz.add(malla);
    return {
      indice: i, color, malla, casa, mano: -1, chorro: 0,
      estado: 'raíl', // 'raíl' | 'mano' | 'vuelta' | 'servir' (animación con ratón)
      t: 0, desde: new THREE.Vector3(), desdeQ: new THREE.Quaternion(),
    };
  });

  // Chorro de licor (uno basta: se sirve de una botella cada vez en cada mano)
  const matChorro = [0, 1].map(() => R(new THREE.MeshBasicMaterial({ color: 0xffffff })));
  const geoChorro = R(new THREE.CylinderGeometry(0.005, 0.0065, 1, 6).translate(0, -0.5, 0));
  const chorros = matChorro.map((m) => {
    const c = new THREE.Mesh(geoChorro, m);
    c.visible = false;
    raiz.add(c);
    return c;
  });

  // ─── Vasos (una bolsa de 3: uno en el puesto y los que van por la barra) ─
  const geoVaso = R(geometriaVaso());
  const matVaso = R(new THREE.MeshStandardMaterial({ color: 0xe8f6ff, roughness: 0.05, metalness: 0.1, transparent: true, opacity: 0.38, depthWrite: false, side: THREE.DoubleSide }));
  const ALTO_CAPA = (ALTO_VASO - 0.03) / MAX_MEDIDAS;
  const geoCapa = R(new THREE.CylinderGeometry(R_VASO - 0.005, R_VASO - 0.006, ALTO_CAPA, 20).translate(0, ALTO_CAPA / 2, 0));
  const geoEspuma = R(new THREE.CylinderGeometry(R_VASO - 0.004, R_VASO - 0.005, 0.01, 20).translate(0, 0.005, 0));
  const geoCubito = R(new THREE.BoxGeometry(0.03, 0.03, 0.03));
  const matEspuma = R(new THREE.MeshLambertMaterial({ color: 0xfff8e7 }));
  const vasos = [0, 1, 2].map(() => {
    const grupo = new THREE.Group();
    const cristal = new THREE.Mesh(geoVaso, matVaso);
    cristal.renderOrder = 2;
    const capas = Array.from({ length: MAX_MEDIDAS }, (_, i) => {
      const capa = new THREE.Mesh(geoCapa, R(new THREE.MeshLambertMaterial({ color: 0xffffff })));
      capa.position.y = 0.016 + i * ALTO_CAPA;
      capa.visible = false;
      grupo.add(capa);
      return capa;
    });
    const espuma = new THREE.Mesh(geoEspuma, matEspuma);
    espuma.visible = false;
    const cubito = new THREE.Mesh(geoCubito, matHielo);
    cubito.visible = false;
    cubito.rotation.set(0.4, 0.7, 0.2);
    grupo.add(espuma, cubito, cristal);
    grupo.visible = false;
    raiz.add(grupo);
    const sombra = ctx.crearSombra({ radio: 0.055, opacidad: 0.4 });
    sombra.visible = false;
    raiz.add(sombra);
    return {
      grupo, capas, espuma, cubito, sombra, medidas: [], hielo: false, agitado: false, agitar: 0,
      estado: 'libre', // 'libre' | 'puesto' | 'mano' | 'vuelta' | 'barra' (deslizándose) | 'cae' | 'entregado' | 'aparece'
      t: 0, dur: 1, mano: -1, cliente: -1, desde: new THREE.Vector3(), hasta: new THREE.Vector3(), vel: new THREE.Vector3(),
    };
  });
  let vasoPuesto = null; // el vaso que se está preparando (en el puesto o en la mano)

  // Coctelera (la tapa metálica que se pone encima del vaso para agitar)
  const coctelera = new THREE.Mesh(
    R(new THREE.LatheGeometry(perfil([[0.046, 0], [0.05, 0.01], [0.044, 0.1], [0.032, 0.16], [0.03, 0.17], [0.001, 0.17]]), 22)),
    R(new THREE.MeshStandardMaterial({ color: 0xd6dde3, metalness: 0.9, roughness: 0.22 })),
  );
  coctelera.position.copy(COCTELERA_POS);
  raiz.add(coctelera);
  let cocteleraEstado = 'mesa'; // 'mesa' | 'vaso' (encima del vaso) | 'volver'
  let cocteleraT = 0;
  const cocteleraDesde = new THREE.Vector3();

  // Cubito que se lleva en la mano (VR) o que salta al vaso (ratón)
  const cubitoSuelto = new THREE.Mesh(geoCubito, matHielo);
  cubitoSuelto.visible = false;
  raiz.add(cubitoSuelto);
  let cubitoEstado = 'nada'; // 'nada' | 'mano' | 'salto' | 'cae'
  let cubitoMano = -1;
  let cubitoT = 0;
  const cubitoDesde = new THREE.Vector3();

  // ─── Clientes ──────────────────────────────────────────────────────────
  // Cuerpo con brazos apoyados en la barra, cabeza, cara (ojos saltones y nariz) y un sombrero loco
  const geoCuerpo = R(fusionar([
    new THREE.CapsuleGeometry(0.17, 0.2, 6, 14).scale(1, 1, 0.75).translate(0, 0.2, 0),
    new THREE.CapsuleGeometry(0.045, 0.28, 4, 8).rotateX(Math.PI / 2 - 0.25).translate(-0.17, 0.27, 0.2),
    new THREE.CapsuleGeometry(0.045, 0.28, 4, 8).rotateX(Math.PI / 2 - 0.25).translate(0.17, 0.27, 0.2),
  ]));
  const geoCabeza = R(fusionar([
    new THREE.SphereGeometry(0.13, 18, 14).scale(1, 1.08, 1),
    new THREE.SphereGeometry(0.03, 8, 6).translate(-0.128, 0, 0),
    new THREE.SphereGeometry(0.03, 8, 6).translate(0.128, 0, 0),
  ]));
  // Manos apoyadas en la barra
  const geoManosCliente = R(fusionar([
    new THREE.SphereGeometry(0.04, 10, 8).scale(1, 0.7, 1.2).translate(-0.17, 0.21, 0.36),
    new THREE.SphereGeometry(0.04, 10, 8).scale(1, 0.7, 1.2).translate(0.17, 0.21, 0.36),
  ]));
  const geoCara = R(fusionar([
    new THREE.SphereGeometry(0.038, 12, 10).translate(-0.045, 0.03, 0.105),
    new THREE.SphereGeometry(0.038, 12, 10).translate(0.045, 0.03, 0.105),
    new THREE.SphereGeometry(0.018, 8, 6).translate(-0.042, 0.03, 0.14),
    new THREE.SphereGeometry(0.018, 8, 6).translate(0.048, 0.03, 0.14),
    new THREE.SphereGeometry(0.026, 10, 8).scale(1, 0.85, 1.1).translate(0, -0.02, 0.13),
    new THREE.TorusGeometry(0.035, 0.008, 6, 12, Math.PI).rotateZ(Math.PI).translate(0, -0.06, 0.112),
  ], [0xffffff, 0xffffff, 0x1b1b1b, 0x1b1b1b, 0xe57373, 0x5d2b2b]));
  const geosSombrero = [
    // Gorro de fiesta, chistera y tupé
    fusionar([new THREE.ConeGeometry(0.08, 0.2, 16).translate(0, 0.18, 0), new THREE.SphereGeometry(0.025, 8, 6).translate(0, 0.29, 0)]),
    fusionar([new THREE.CylinderGeometry(0.085, 0.085, 0.16, 18).translate(0, 0.19, 0), new THREE.CylinderGeometry(0.14, 0.14, 0.012, 20).translate(0, 0.11, 0)]),
    fusionar([new THREE.SphereGeometry(0.12, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2).scale(1.1, 0.7, 1.15).translate(0, 0.04, -0.01), new THREE.SphereGeometry(0.06, 10, 8).scale(1.4, 0.8, 1.6).translate(0, 0.11, 0.07)]),
  ].map(R);
  const matCara = R(new THREE.MeshLambertMaterial({ vertexColors: true }));
  const geoBocadillo = R(new THREE.PlaneGeometry(0.34, 0.34));
  const geoBarra = R(new THREE.PlaneGeometry(0.3, 0.035));
  const clientes = ASIENTOS_X.map((x, i) => {
    const grupo = new THREE.Group();
    grupo.position.set(x, 0.8, CLIENTE_Z);
    const matCuerpo = R(new THREE.MeshLambertMaterial({ color: CAMISAS[i] }));
    const matPiel = R(new THREE.MeshLambertMaterial({ color: PIELES[i] }));
    const matSombrero = R(new THREE.MeshLambertMaterial({ color: SOMBREROS[i] }));
    const cuerpo = new THREE.Mesh(geoCuerpo, matCuerpo);
    const cabeza = new THREE.Group();
    cabeza.position.set(0, 0.53, 0);
    const piel = new THREE.Mesh(geoCabeza, matPiel);
    const cara = new THREE.Mesh(geoCara, matCara);
    const sombrero = new THREE.Mesh(geosSombrero[i], matSombrero);
    cabeza.add(piel, cara, sombrero);
    grupo.add(cuerpo, new THREE.Mesh(geoManosCliente, matPiel), cabeza);
    grupo.visible = false;
    raiz.add(grupo);
    // Bocadillo con el pedido (un canvas por cliente, se dibuja solo cuando cambia)
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 256;
    const tex = R(new THREE.CanvasTexture(canvas));
    tex.colorSpace = THREE.SRGBColorSpace;
    const bocadillo = new THREE.Mesh(geoBocadillo, R(new THREE.MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false, toneMapped: false })));
    bocadillo.position.set(x, 1.82, CLIENTE_Z + 0.05);
    bocadillo.visible = false;
    raiz.add(bocadillo);
    // Barra de paciencia debajo del bocadillo (fondo oscuro y relleno de color)
    const fondoBarra = new THREE.Mesh(geoBarra, R(new THREE.MeshBasicMaterial({ color: 0x1a1a1a, toneMapped: false })));
    fondoBarra.position.set(x, 1.62, CLIENTE_Z + 0.05);
    const relleno = new THREE.Mesh(R(new THREE.PlaneGeometry(0.29, 0.025).translate(0.145, 0, 0)), R(new THREE.MeshBasicMaterial({ color: 0x66ff88, toneMapped: false })));
    relleno.position.set(x - 0.145, 1.62, CLIENTE_Z + 0.052);
    fondoBarra.visible = relleno.visible = false;
    raiz.add(fondoBarra, relleno);
    const sombra = ctx.crearSombra({ radio: 0.25, opacidad: 0.35 });
    ctx.colocarSombra(sombra, grupo.position.clone().setY(0), 0.004);
    raiz.add(sombra);
    return {
      indice: i, x, grupo, cabeza, cuerpo, matCuerpo, matPiel, matSombrero, sombrero, canvas, tex, bocadillo, fondoBarra, relleno,
      estado: 'vacio', // 'vacio' | 'llega' | 'espera' | 'feliz' | 'enfadado' | 'se va'
      t: 0, espera: azar(0.3, 1.5), pedido: null, paciencia: 1, pacienciaMax: 1, especial: false, cambiara: -1,
      piel: new THREE.Color(PIELES[i]), sacudida: 0,
    };
  });
  const colorEnfado = new THREE.Color(0xff3b30);

  // Dibuja el pedido: un vaso con las medidas de colores, el hielo y la coctelera
  function dibujarPedido(c) {
    const g = c.canvas.getContext('2d');
    const p = c.pedido;
    g.clearRect(0, 0, 256, 256);
    // Bocadillo (dorado si es especial) con su pico hacia el cliente
    g.fillStyle = c.especial ? '#ffd54f' : '#fbf6ec';
    g.strokeStyle = c.especial ? '#ff6a3d' : '#2b2f36';
    g.lineWidth = 8;
    g.beginPath();
    g.roundRect(14, 10, 228, 196, 40);
    g.moveTo(110, 204);
    g.lineTo(128, 246);
    g.lineTo(150, 204);
    g.fill();
    g.stroke();
    g.fillStyle = c.especial ? '#ffd54f' : '#fbf6ec';
    g.fillRect(112, 196, 36, 14);
    // Vaso con las medidas apiladas (mezcladas si va agitado)
    const vx = 40;
    const vy = 40;
    const ancho = 78;
    const alto = 140;
    const medida = alto / MAX_MEDIDAS;
    const n = p.medidas.length;
    if (p.agitado) {
      const mezcla = mezclar(p.medidas);
      g.fillStyle = `#${mezcla.getHexString()}`;
      g.fillRect(vx + 6, vy + alto - n * medida, ancho - 12, n * medida - 6);
      // Las medidas que lleva, en puntos de su color, encima de la mezcla
      p.medidas.forEach((m, j) => {
        g.fillStyle = `#${new THREE.Color(LICORES[m]).getHexString()}`;
        g.beginPath();
        g.arc(vx + 20 + (j % 2) * 38, vy + alto - n * medida + 18 + Math.floor(j / 2) * 30, 13, 0, Math.PI * 2);
        g.fill();
        g.strokeStyle = '#ffffff';
        g.lineWidth = 3;
        g.stroke();
      });
    } else {
      const ordenadas = [...p.medidas].sort();
      ordenadas.forEach((m, j) => {
        g.fillStyle = `#${new THREE.Color(LICORES[m]).getHexString()}`;
        g.fillRect(vx + 6, vy + alto - (j + 1) * medida, ancho - 12, medida - 4);
      });
    }
    if (p.hielo) {
      g.fillStyle = 'rgba(220,245,255,0.95)';
      g.strokeStyle = '#4fc3f7';
      g.lineWidth = 4;
      g.save();
      g.translate(vx + ancho / 2, vy + 26);
      g.rotate(0.35);
      g.fillRect(-15, -15, 30, 30);
      g.strokeRect(-15, -15, 30, 30);
      g.restore();
    }
    g.strokeStyle = '#2b2f36';
    g.lineWidth = 6;
    g.beginPath();
    g.moveTo(vx, vy);
    g.lineTo(vx + 4, vy + alto);
    g.lineTo(vx + ancho - 4, vy + alto);
    g.lineTo(vx + ancho, vy);
    g.stroke();
    // Iconos a la derecha: hielo y coctelera (tachados si no van)
    const icono = (y, activo, dibujo) => {
      g.globalAlpha = activo ? 1 : 0.22;
      dibujo(178, y);
      g.globalAlpha = 1;
    };
    icono(70, p.hielo, (x, y) => {
      g.fillStyle = '#b3e5fc';
      g.strokeStyle = '#0288d1';
      g.lineWidth = 4;
      g.fillRect(x - 24, y - 24, 48, 48);
      g.strokeRect(x - 24, y - 24, 48, 48);
      g.fillStyle = '#ffffff';
      g.fillRect(x - 16, y - 16, 14, 8);
    });
    icono(150, p.agitado, (x, y) => {
      g.fillStyle = '#90a4ae';
      g.beginPath();
      g.moveTo(x - 22, y + 30);
      g.lineTo(x - 16, y - 18);
      g.lineTo(x - 8, y - 30);
      g.lineTo(x + 8, y - 30);
      g.lineTo(x + 16, y - 18);
      g.lineTo(x + 22, y + 30);
      g.closePath();
      g.fill();
      g.fillStyle = '#cfd8dc';
      g.fillRect(x - 12, y - 12, 6, 34);
      if (p.agitado) {
        g.strokeStyle = '#ff6a3d';
        g.lineWidth = 5;
        for (const lado of [-1, 1]) {
          g.beginPath();
          g.arc(x + lado * 6, y, 36, lado < 0 ? Math.PI * 0.8 : -Math.PI * 0.2, lado < 0 ? Math.PI * 1.2 : Math.PI * 0.2);
          g.stroke();
        }
      }
    });
    c.tex.needsUpdate = true;
  }

  const colorMezcla = new THREE.Color();
  const colorAux = new THREE.Color();
  function mezclar(medidas) {
    colorMezcla.setRGB(0, 0, 0);
    for (const m of medidas) {
      colorAux.setHex(LICORES[m]);
      colorMezcla.r += colorAux.r / medidas.length;
      colorMezcla.g += colorAux.g / medidas.length;
      colorMezcla.b += colorAux.b / medidas.length;
    }
    return colorMezcla;
  }

  // ─── Manos en VR: guantes de camarero ──────────────────────────────────
  const geoGuante = R(fusionar([
    new THREE.BoxGeometry(0.07, 0.025, 0.08).translate(0, -0.012, 0.02),
    ...[-0.025, -0.008, 0.009, 0.026].map((x, j) => new THREE.CapsuleGeometry(0.009, 0.035 - Math.abs(j - 1.5) * 0.004, 3, 6).rotateX(Math.PI / 2 - 0.9).translate(x, -0.03, -0.03)),
    new THREE.CapsuleGeometry(0.01, 0.03, 3, 6).rotateZ(1.1).translate(-0.045, -0.015, 0.0),
    new THREE.CylinderGeometry(0.042, 0.04, 0.03, 12).rotateX(Math.PI / 2).translate(0, -0.012, 0.075),
  ]));
  const matGuante = R(new THREE.MeshLambertMaterial({ color: 0xf5f5f5 }));
  const manos = ctx.manos.map((mano) => {
    const guante = new THREE.Mesh(geoGuante, matGuante);
    ctx.adjuntarAMano(mano, guante);
    return {
      mano, guante, punto: new THREE.Vector3(), quat: new THREE.Quaternion(), objeto: null, tipo: null,
      posiciones: Array.from({ length: HISTORIAL }, () => new THREE.Vector3()), tiempos: new Float64Array(HISTORIAL).fill(-1), idx: 0,
      vel: new THREE.Vector3(), velAntes: new THREE.Vector3(),
    };
  });

  // ─── Marcador ──────────────────────────────────────────────────────────
  const panel = ctx.crearPanel({ ancho: 1.1, alto: 0.29 });
  panel.mesh.position.set(0, 2.24, -1.6);
  panel.mesh.rotation.x = 0.18;
  raiz.add(panel.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'juego' | 'fin'
  let reloj = 3;
  let tiempo = 0;
  let tiempoJuego = 0;
  let puntos = 0;
  let atendidos = 0;
  let segundoTic = 0;
  let record = ctx.leer('record', 0);
  let aviso = null; // { texto, color, tiempo }
  let accion = null; // animación de ratón en marcha: { tipo, t, dur, objeto }
  let hover = null;
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const arriba = new THREE.Vector3();
  const qAux = new THREE.Quaternion();
  const qVertical = new THREE.Quaternion();
  const ejeX = new THREE.Vector3(1, 0, 0);
  const ejeZ = new THREE.Vector3(0, 0, 1);
  const clicables = [];

  function avisar(texto, color, duracion = 1.4) { aviso = { texto, color, tiempo: duracion }; }

  function escribirMarcador() {
    let lineas;
    if (estado === 'intro') {
      lineas = [{ texto: ctx.t('titulo'), tam: 1.15, color: '#ffb74d' },
        { texto: ctx.t(ctx.enVR() ? 'introVR' : ctx.tactil ? 'introTactil' : 'introRaton'), tam: 0.6, color: '#fff3e0' }];
    } else if (estado === 'fin') {
      lineas = [{ texto: ctx.t('fin', { n: puntos }), tam: 1.1, color: '#ffb74d' },
        { texto: `${ctx.t('atendidos', { n: atendidos })} · ${ctx.t('partida.recordNuevaPartida', { record, n: Math.ceil(reloj) })}`, tam: 0.56 }];
    } else {
      const queda = Math.max(0, Math.ceil(DURACION - tiempoJuego));
      lineas = [{ texto: ctx.t('marcador', { n: puntos, s: queda }), tam: 1.1, color: queda <= 10 ? '#ff8a65' : '#ffffff' },
        aviso ? { texto: aviso.texto, tam: 0.7, color: aviso.color } : { texto: ctx.t('atendidos', { n: atendidos }), tam: 0.62, color: '#ffcc80' }];
    }
    panel.escribir(lineas);
  }

  // ─── Vasos ─────────────────────────────────────────────────────────────
  function pintarVaso(v) {
    const mezcla = v.agitado && v.medidas.length ? mezclar(v.medidas) : null;
    v.capas.forEach((capa, i) => {
      capa.visible = i < v.medidas.length;
      if (capa.visible) capa.material.color.copy(mezcla || colorAux.setHex(LICORES[v.medidas[i]]));
    });
    v.espuma.visible = v.agitado && v.medidas.length > 0;
    v.espuma.position.y = 0.016 + v.medidas.length * ALTO_CAPA;
    v.cubito.visible = v.hielo;
    v.cubito.position.y = Math.max(0.03, 0.016 + v.medidas.length * ALTO_CAPA - 0.008);
  }

  function vaciar(v) {
    v.medidas.length = 0;
    v.hielo = false;
    v.agitado = false;
    v.agitar = 0;
    pintarVaso(v);
  }

  // Un vaso nuevo aparece en el puesto (con un pequeño rebote)
  function nuevoVaso() {
    if (vasoPuesto) return;
    const v = vasos.find((x) => x.estado === 'libre');
    if (!v) return;
    vaciar(v);
    v.estado = 'aparece';
    v.t = 0;
    v.grupo.visible = true;
    v.sombra.visible = true;
    v.grupo.position.set(VASO_X, BARRA_Y + 0.006, VASO_Z);
    v.grupo.quaternion.identity();
    v.grupo.scale.setScalar(0.01);
    vasoPuesto = v;
  }

  function anadirMedida(v, licor, mano) {
    if (v.medidas.length >= MAX_MEDIDAS) {
      avisar(ctx.t('lleno'), '#ff8a80', 1);
      ctx.sonido('fallo');
      if (mano) ctx.vibrar(mano, 0.4, 60);
      return false;
    }
    v.medidas.push(licor);
    if (v.agitado) v.agitado = false; // se ha añadido algo después de agitar: hay que volver a agitar
    pintarVaso(v);
    tmp.copy(v.grupo.position).setY(v.grupo.position.y + ALTO_VASO + 0.03);
    ctx.efectos.impacto('pequeño', { pos: tmp, mano, color: LICORES[licor], sonido: 'verter' });
    return true;
  }

  function anadirHielo(v, mano) {
    if (v.hielo) {
      ctx.sonido('hielo');
      return;
    }
    v.hielo = true;
    pintarVaso(v);
    tmp.copy(v.grupo.position).setY(v.grupo.position.y + ALTO_VASO);
    ctx.efectos.impacto('pequeño', { pos: tmp, mano, color: 0xd8f3ff, sonido: 'hielo' });
  }

  function terminarAgitado(v, mano) {
    v.agitado = true;
    v.agitar = 0;
    pintarVaso(v);
    tmp.copy(v.grupo.position).setY(v.grupo.position.y + ALTO_VASO + 0.05);
    ctx.efectos.impacto('pequeño', { pos: tmp, mano, color: mezclar(v.medidas).getHex(), sonido: 'clac' });
    ctx.efectos.texto(tmp, ctx.t('agitado'), { color: '#e1f5fe', tam: 0.7 });
    devolverCoctelera();
  }

  function ponerCocteleraEnVaso() {
    if (cocteleraEstado === 'vaso') return;
    cocteleraEstado = 'vaso';
    ctx.sonido('toc');
  }
  function devolverCoctelera() {
    if (cocteleraEstado !== 'vaso') return;
    cocteleraEstado = 'volver';
    cocteleraT = 0;
    cocteleraDesde.copy(coctelera.position);
  }

  // El vaso llega al cliente: ¿es lo que ha pedido?
  function entregar(v, c, mano = null) {
    v.estado = 'entregado';
    v.t = 0;
    v.cliente = c.indice;
    if (vasoPuesto === v) vasoPuesto = null;
    tmp.set(c.x, 1.55, CLIENTE_Z + 0.15);
    if (estado !== 'juego' || c.estado !== 'espera') {
      // Nadie esperando: se queda en la barra y se recoge
      return;
    }
    if (iguales(v, c.pedido)) {
      const p = c.pedido;
      const base = 2 + p.medidas.length + (p.hielo ? 1 : 0) + (p.agitado ? 1 : 0);
      const propina = Math.ceil(3 * Math.max(0, c.paciencia / c.pacienciaMax));
      const total = (base + propina) * (c.especial ? 2 : 1);
      puntos += total;
      atendidos++;
      ctx.efectos.impacto(c.especial ? 'grande' : 'medio', { pos: tmp, mano, color: c.especial ? 0xffd54f : 0x81c784, sonido: 'caja' });
      ctx.efectos.texto(tmp, `+${total}`, { color: c.especial ? '#ffd54f' : '#b9f6ca', tam: c.especial ? 1.5 : 1.1 });
      if (propina > 0) {
        tmp2.copy(tmp).setY(tmp.y - 0.25);
        ctx.efectos.estallido(tmp2, { color: 0xffd54f, cantidad: 4 + propina * 3, fuerza: 1.4 });
        avisar(ctx.t('propina', { n: propina * (c.especial ? 2 : 1) }), '#ffd54f', 1.1);
      }
      if (puntos > record && record > 0 && puntos - total <= record) avisar(ctx.t('partida.nuevoRecord'), '#ffd54f', 1.6);
      c.estado = 'feliz';
      c.t = 0;
      ocultarPedido(c);
    } else {
      // Se ha equivocado de cliente o de bebida: se enfada y la devuelve
      puntos = Math.max(0, puntos - 3);
      c.paciencia = Math.max(0.1, c.paciencia - c.pacienciaMax * 0.25);
      c.sacudida = 0.6;
      v.estado = 'cae';
      v.t = 0;
      v.vel.set(azar(-0.4, 0.4), 1.2, 0.8);
      fallo(ctx.t('equivocado'), tmp, '-3');
    }
  }

  function iguales(v, p) {
    if (!v.medidas.length || v.hielo !== p.hielo || v.agitado !== p.agitado || v.medidas.length !== p.medidas.length) return false;
    const a = [...v.medidas].sort().join();
    const b = [...p.medidas].sort().join();
    return a === b;
  }

  function fallo(texto, pos, numero = null) {
    ctx.sonido('fallo');
    ctx.destello(0xff1744, 0.18);
    for (const m of ctx.manos) ctx.vibrar(m, 0.6, 120);
    if (pos && numero) ctx.efectos.texto(pos, numero, { color: '#ff5252', tam: 1.1 });
    avisar(texto, '#ff8a80', 1.5);
  }

  // ─── Clientes ──────────────────────────────────────────────────────────
  function crearPedido() {
    // Al principio, pedidos cortos; luego, más medidas y coctelera
    const dificultad = Math.min(1, tiempoJuego / 45);
    const n = Math.min(3, 1 + entero(2 + Math.round(dificultad)));
    const medidas = [];
    for (let i = 0; i < n; i++) medidas.push(entero(LICORES.length));
    return { medidas, hielo: Math.random() < 0.5, agitado: tiempoJuego > 12 && n > 1 && Math.random() < 0.3 + dificultad * 0.3 };
  }

  function llegaCliente(c) {
    c.estado = 'llega';
    c.t = 0;
    c.pedido = crearPedido();
    c.especial = tiempoJuego > 8 && Math.random() < 0.15;
    c.pacienciaMax = Math.max(11, 20 - tiempoJuego * 0.12) + c.pedido.medidas.length * 2 + (c.pedido.agitado ? 3 : 0);
    c.paciencia = c.pacienciaMax;
    c.cambiara = !c.especial && Math.random() < 0.25 ? azar(0.45, 0.65) : -1;
    // Aspecto distinto cada vez
    c.matCuerpo.color.setHex(CAMISAS[entero(CAMISAS.length)]);
    c.piel.setHex(PIELES[entero(PIELES.length)]);
    c.matPiel.color.copy(c.piel);
    c.sombrero.geometry = geosSombrero[entero(geosSombrero.length)];
    c.matSombrero.color.setHex(c.especial ? 0xffd54f : SOMBREROS[entero(SOMBREROS.length)]);
    c.grupo.visible = true;
    c.grupo.scale.setScalar(1);
    dibujarPedido(c);
    ctx.sonido('tic');
  }

  function ocultarPedido(c) {
    c.bocadillo.visible = c.fondoBarra.visible = c.relleno.visible = false;
  }

  function actualizarClientes(dt) {
    const abiertos = estado !== 'juego' ? 0 : tiempoJuego < 10 ? 2 : 3;
    for (const c of clientes) {
      c.t += dt;
      const g = c.grupo;
      const asiento = c.indice === 1 || abiertos === 3 || c.indice === 0;
      if (c.estado === 'vacio') {
        g.visible = false;
        if (estado === 'juego' && asiento && (abiertos === 3 || c.indice !== 2)) {
          c.espera -= dt;
          if (c.espera <= 0) llegaCliente(c);
        }
        continue;
      }
      if (c.estado === 'llega') {
        // Aparece desde abajo, con rebote
        const s = Math.min(1, c.t / 0.45);
        g.position.y = 0.8 - 0.6 * (1 - rebote(s));
        g.scale.setScalar(0.5 + 0.5 * rebote(s));
        if (s >= 1) {
          c.estado = 'espera';
          c.t = 0;
          c.bocadillo.visible = c.fondoBarra.visible = c.relleno.visible = true;
        }
      } else if (c.estado === 'espera') {
        if (estado === 'juego') c.paciencia -= dt;
        const f = Math.max(0, c.paciencia / c.pacienciaMax);
        c.relleno.scale.x = Math.max(0.001, f);
        c.relleno.material.color.setHSL(0.33 * f, 0.9, 0.55);
        // Se pone rojo y tiembla cuando se le acaba la paciencia
        c.matPiel.color.copy(c.piel).lerp(colorEnfado, Math.max(0, 0.6 - f) * 1.2);
        const nervios = f < 0.3 ? 0.02 : 0;
        g.position.y = 0.8 + Math.abs(Math.sin(c.t * (f < 0.3 ? 14 : 3))) * (0.012 + nervios);
        c.cabeza.rotation.z = Math.sin(c.t * 2 + c.indice) * 0.08 + (c.sacudida > 0 ? Math.sin(c.t * 40) * 0.25 * c.sacudida : 0);
        c.sacudida = Math.max(0, c.sacudida - dt);
        c.bocadillo.position.y = 1.82 + Math.sin(c.t * 2.5 + c.indice) * 0.01;
        c.bocadillo.scale.setScalar(c.sacudida > 0.3 ? 1.08 : 1);
        // Cambia de idea a mitad de la espera
        if (c.cambiara > 0 && f < 1 - c.cambiara) {
          c.cambiara = -1;
          c.pedido = crearPedido();
          c.paciencia = Math.min(c.pacienciaMax, c.paciencia + 5);
          c.sacudida = 0.8;
          dibujarPedido(c);
          tmp.set(c.x, 2.0, CLIENTE_Z + 0.1);
          ctx.efectos.texto(tmp, '?!', { color: '#ffcc80', tam: 1.2 });
          ctx.sonido('cuac');
          avisar(ctx.t('cambio'), '#ffcc80', 1.6);
        }
        if (c.paciencia <= 0) {
          c.estado = 'enfadado';
          c.t = 0;
          ocultarPedido(c);
          puntos = Math.max(0, puntos - 2);
          tmp.set(c.x, 1.6, CLIENTE_Z);
          fallo(ctx.t('enfadado'), tmp, '-2');
        }
      } else if (c.estado === 'feliz') {
        // Salta de alegría, bebe y se va
        g.position.y = 0.8 + Math.abs(Math.sin(c.t * 9)) * 0.08 * Math.max(0, 1 - c.t);
        c.matPiel.color.copy(c.piel);
        c.cabeza.rotation.z = Math.sin(c.t * 12) * 0.12;
        if (c.t > 1.3) {
          c.estado = 'se va';
          c.t = 0;
        }
      } else if (c.estado === 'enfadado') {
        c.cabeza.rotation.z = Math.sin(c.t * 30) * 0.2;
        if (c.t > 0.8) {
          c.estado = 'se va';
          c.t = 0;
        }
      } else if (c.estado === 'se va') {
        const s = Math.min(1, c.t / 0.4);
        g.position.y = 0.8 - 0.7 * suave(s);
        g.scale.setScalar(1 - 0.6 * s);
        if (s >= 1) {
          c.estado = 'vacio';
          c.espera = azar(0.6, 2.2);
          g.visible = false;
          c.matPiel.color.copy(c.piel);
        }
      }
    }
  }

  // ─── Movimiento de vasos, coctelera y cubito ───────────────────────────
  function moverVasos(dt) {
    for (const v of vasos) {
      if (v.estado === 'libre') continue;
      v.t += dt;
      const p = v.grupo.position;
      if (v.estado === 'aparece') {
        const s = Math.min(1, v.t / 0.3);
        v.grupo.scale.setScalar(Math.max(0.01, rebote(s)));
        if (s >= 1) {
          v.grupo.scale.setScalar(1);
          v.estado = 'puesto';
        }
      } else if (v.estado === 'vuelta') {
        // Vuelve solo al puesto
        const s = Math.min(1, v.t / 0.3);
        p.lerpVectors(v.desde, tmp.set(VASO_X, BARRA_Y + 0.006, VASO_Z), suave(s));
        v.grupo.quaternion.slerp(qVertical, Math.min(1, dt * 12));
        if (s >= 1) {
          v.grupo.quaternion.identity();
          v.estado = 'puesto';
        }
      } else if (v.estado === 'barra') {
        // Se desliza por la barra hacia el cliente (con frenada al final)
        const s = Math.min(1, v.t / v.dur);
        p.lerpVectors(v.desde, v.hasta, suave(s));
        v.grupo.rotation.y += dt * 4 * (1 - s);
        if (s >= 1) {
          if (v.cliente >= 0) entregar(v, clientes[v.cliente]);
          else {
            // No había nadie: se cae por el otro lado de la barra y se rompe
            v.estado = 'cae';
            v.t = 0;
            v.vel.set(0, 0.5, -1.2);
          }
        }
      } else if (v.estado === 'entregado') {
        // El cliente se lo lleva a la boca (o se queda en la barra si nadie esperaba)
        const c = clientes[v.cliente];
        if (c.estado === 'feliz') {
          const s = Math.min(1, v.t / 0.5);
          p.lerpVectors(v.hasta.set(c.x, BARRA_Y + 0.006, ENTREGA_Z), tmp.set(c.x, 1.25, CLIENTE_Z + 0.2), suave(s));
          if (v.t > 1.1) v.grupo.scale.setScalar(Math.max(0.01, 1 - (v.t - 1.1) * 4));
          if (v.t > 1.35) retirarVaso(v);
        } else if (v.t > 0.9) retirarVaso(v);
      } else if (v.estado === 'cae') {
        v.vel.y -= 9.8 * dt;
        p.addScaledVector(v.vel, dt);
        v.grupo.rotation.x += dt * 6;
        if (p.y < 0.02) {
          tmp.copy(p).setY(0.05);
          ctx.efectos.estallido(tmp, { color: 0xe8f6ff, cantidad: 12, fuerza: 1.6 });
          ctx.sonido('cristal');
          retirarVaso(v);
        }
      }
      if (v.grupo.visible) {
        const sobreBarra = p.z < BARRA_Z0 && p.z > BARRA_Z1 && Math.abs(p.x) < 1.3 && p.y >= BARRA_Y - 0.01;
        ctx.colocarSombra(v.sombra, p, sobreBarra ? BARRA_Y + 0.002 : 0.004);
      }
    }
    if (estado === 'juego' && !vasoPuesto) nuevoVaso();
  }

  function retirarVaso(v) {
    v.estado = 'libre';
    v.grupo.visible = false;
    v.sombra.visible = false;
    v.grupo.scale.setScalar(1);
    v.grupo.rotation.set(0, 0, 0);
    if (vasoPuesto === v) vasoPuesto = null;
  }

  // Manda el vaso por la barra hacia un cliente (o hacia el hueco donde no hay nadie)
  function lanzarVaso(v, indiceCliente, x) {
    v.estado = 'barra';
    v.t = 0;
    v.cliente = indiceCliente;
    v.desde.copy(v.grupo.position).setY(BARRA_Y + 0.006);
    v.grupo.position.y = BARRA_Y + 0.006;
    v.grupo.quaternion.identity();
    v.hasta.set(indiceCliente >= 0 ? clientes[indiceCliente].x : x, BARRA_Y + 0.006, indiceCliente >= 0 ? ENTREGA_Z : BARRA_Z1 - 0.02);
    v.dur = 0.35 + v.desde.distanceTo(v.hasta) * 0.5; // duración del deslizamiento
    if (vasoPuesto === v) vasoPuesto = null;
    if (cocteleraEstado === 'vaso') devolverCoctelera();
    ctx.sonido('deslizar');
  }

  function moverCoctelera(dt) {
    if (cocteleraEstado === 'vaso' && vasoPuesto) {
      // Encima del vaso (boca abajo), siguiéndolo
      const v = vasoPuesto;
      coctelera.quaternion.copy(v.grupo.quaternion).multiply(qAux.setFromAxisAngle(ejeX, Math.PI));
      tmp.set(0, ALTO_VASO + 0.15, 0).applyQuaternion(v.grupo.quaternion);
      coctelera.position.copy(v.grupo.position).add(tmp);
    } else if (cocteleraEstado === 'vaso') {
      devolverCoctelera();
    } else if (cocteleraEstado === 'volver') {
      cocteleraT += dt;
      const s = Math.min(1, cocteleraT / 0.3);
      coctelera.position.lerpVectors(cocteleraDesde, COCTELERA_POS, suave(s));
      coctelera.position.y += Math.sin(s * Math.PI) * 0.08;
      coctelera.quaternion.slerp(qVertical, Math.min(1, dt * 14));
      if (s >= 1) {
        coctelera.quaternion.identity();
        coctelera.position.copy(COCTELERA_POS);
        cocteleraEstado = 'mesa';
      }
    }
  }

  function moverCubito(dt) {
    if (cubitoEstado === 'nada') {
      cubitoSuelto.visible = false;
      return;
    }
    cubitoSuelto.visible = true;
    cubitoT += dt;
    cubitoSuelto.rotation.x += dt * 5;
    cubitoSuelto.rotation.y += dt * 3;
    if (cubitoEstado === 'mano') {
      cubitoSuelto.position.copy(manos[cubitoMano].punto);
    } else if (cubitoEstado === 'salto') {
      // Del cubo al vaso, en un arco
      const v = vasoPuesto;
      const s = Math.min(1, cubitoT / 0.28);
      if (!v) {
        cubitoEstado = 'nada';
        return;
      }
      tmp.copy(v.grupo.position).setY(v.grupo.position.y + ALTO_VASO * 0.6);
      cubitoSuelto.position.lerpVectors(cubitoDesde, tmp, s);
      cubitoSuelto.position.y += Math.sin(s * Math.PI) * 0.12;
      if (s >= 1) {
        cubitoEstado = 'nada';
        anadirHielo(v, null);
      }
    } else if (cubitoEstado === 'cae') {
      // Se ha soltado sobre el vaso (VR): cae dentro; si no, se derrite en la barra
      cubitoSuelto.position.y -= dt * 1.4;
      const v = vasoPuesto;
      if (v && Math.hypot(cubitoSuelto.position.x - v.grupo.position.x, cubitoSuelto.position.z - v.grupo.position.z) < R_VASO + 0.02
        && cubitoSuelto.position.y < v.grupo.position.y + ALTO_VASO) {
        cubitoEstado = 'nada';
        anadirHielo(v, null);
      } else if (cubitoSuelto.position.y < BARRA_Y + 0.015 || cubitoT > 1) {
        cubitoEstado = 'nada';
        ctx.sonido('tic');
      }
    }
  }

  // ─── Ratón y móvil ─────────────────────────────────────────────────────
  // Cada objeto que se puede tocar lleva en userData qué es
  // Zonas de toque invisibles algo más grandes que el objeto (mejor con el dedo) y quietas en su
  // sitio: una botella que aún vuelve al raíl se puede tocar otra vez
  const matInvisible = R(new THREE.MeshBasicMaterial({ visible: false }));
  const zona = (geo, pos, datos) => {
    const m = new THREE.Mesh(geo, matInvisible);
    m.position.copy(pos);
    m.userData.clic = datos;
    raiz.add(m);
    clicables.push(m);
    return m;
  };
  const geoZonaBotella = R(new THREE.CylinderGeometry(0.065, 0.065, 0.32, 10).translate(0, 0.15, 0));
  for (const b of botellas) zona(geoZonaBotella, b.casa, { tipo: 'botella', b });
  zona(R(new THREE.CylinderGeometry(0.12, 0.12, 0.22, 10).translate(0, 0.1, 0)), HIELO_POS, { tipo: 'hielo' });
  zona(R(new THREE.CylinderGeometry(0.08, 0.08, 0.26, 10).translate(0, 0.12, 0)), COCTELERA_POS, { tipo: 'coctelera' });
  zona(R(new THREE.BoxGeometry(0.24, 0.12, 0.24).translate(0, 0.05, 0)), FREGADERO_POS, { tipo: 'fregadero' });
  const geoZonaCliente = R(new THREE.BoxGeometry(0.5, 0.95, 0.5).translate(0, 0.45, 0));
  const geoZonaBocadillo = R(new THREE.BoxGeometry(0.36, 0.36, 0.05));
  const geoZonaEntrega = R(new THREE.BoxGeometry(0.4, 0.2, 0.3).translate(0, 0.1, 0));
  for (const c of clientes) {
    zona(geoZonaCliente, tmp.set(c.x, 0.8, CLIENTE_Z), { tipo: 'cliente', c });
    zona(geoZonaBocadillo, c.bocadillo.position, { tipo: 'cliente', c });
    zona(geoZonaEntrega, tmp.set(c.x, BARRA_Y, ENTREGA_Z - 0.05), { tipo: 'cliente', c });
  }

  function bajoPuntero() {
    const r = ctx.raton.rayo;
    for (const m of clicables) m.updateMatrixWorld();
    const choques = r.intersectObjects(clicables, false);
    for (const choque of choques) {
      const datos = choque.object.userData.clic;
      if (datos.tipo === 'botella' && datos.b.estado === 'mano') continue;
      if (datos.tipo === 'cliente' && !datos.c.grupo.visible) continue;
      return datos;
    }
    return null;
  }

  // Termina al instante la animación de ratón en marcha (para que un toque nuevo no espere)
  function cerrarAccion() {
    if (!accion) return;
    const a = accion;
    accion = null;
    if (a.tipo === 'botella') {
      a.b.estado = 'vuelta';
      a.b.t = 0;
      a.b.desde.copy(a.b.malla.position);
      a.b.desdeQ.copy(a.b.malla.quaternion);
      chorros[0].visible = false;
      if (!a.hecho && vasoPuesto) anadirMedida(vasoPuesto, a.b.indice, null);
    } else if (a.tipo === 'agitar') {
      if (vasoPuesto) {
        vasoPuesto.grupo.position.set(VASO_X, BARRA_Y + 0.006, VASO_Z);
        vasoPuesto.grupo.quaternion.identity();
        terminarAgitado(vasoPuesto, null);
      } else devolverCoctelera();
    }
  }

  function tocar(datos) {
    const v = vasoPuesto && vasoPuesto.estado === 'puesto' ? vasoPuesto : null;
    if (datos.tipo === 'botella') {
      if (!v) return;
      if (v.medidas.length >= MAX_MEDIDAS) {
        anadirMedida(v, datos.b.indice, null);
        return;
      }
      cerrarAccion();
      const b = datos.b;
      b.estado = 'servir';
      b.t = 0;
      b.desde.copy(b.malla.position);
      accion = { tipo: 'botella', b, t: 0, dur: 0.55, hecho: false };
      ctx.sonido('tic');
    } else if (datos.tipo === 'hielo') {
      if (!v) return;
      if (v.hielo) {
        ctx.sonido('hielo');
        return;
      }
      cubitoEstado = 'salto';
      cubitoT = 0;
      cubitoDesde.copy(HIELO_POS).setY(BARRA_Y + 0.13);
      ctx.sonido('tic');
    } else if (datos.tipo === 'coctelera') {
      if (!v || cocteleraEstado !== 'mesa') return;
      if (!v.medidas.length) {
        avisar(ctx.t('vacio'), '#ff8a80', 1.1);
        ctx.sonido('fallo');
        return;
      }
      if (v.agitado) return;
      cerrarAccion();
      ponerCocteleraEnVaso();
      accion = { tipo: 'agitar', t: 0, dur: 0.75 };
    } else if (datos.tipo === 'fregadero') {
      if (!v || (!v.medidas.length && !v.hielo)) return;
      cerrarAccion();
      vaciar(v);
      tmp.copy(FREGADERO_POS).setY(BARRA_Y + 0.05);
      ctx.efectos.estallido(tmp, { color: 0x90caf9, cantidad: 8, fuerza: 1 });
      ctx.sonido('verter');
    } else if (datos.tipo === 'cliente') {
      const c = datos.c;
      if (!v || c.estado !== 'espera') return;
      if (!v.medidas.length) {
        avisar(ctx.t('vacio'), '#ff8a80', 1.1);
        ctx.sonido('fallo');
        return;
      }
      cerrarAccion();
      lanzarVaso(v, c.indice, c.x);
    }
  }

  function actualizarRaton(dt) {
    const r = ctx.raton;
    if (estado === 'juego' && r.clic) {
      const datos = bajoPuntero();
      if (datos) tocar(datos);
    }
    // Lo que hay bajo el puntero se resalta un poco (solo con ratón)
    if (!ctx.tactil && r.dentro && estado === 'juego') hover = bajoPuntero();
    else hover = null;
    for (const b of botellas) {
      const objetivo = hover && hover.tipo === 'botella' && hover.b === b ? 1.08 : 1;
      if (b.estado === 'raíl') b.malla.scale.setScalar(b.malla.scale.x + (objetivo - b.malla.scale.x) * Math.min(1, dt * 14));
    }
    // Animaciones de ratón
    if (!accion) return;
    accion.t += dt;
    const s = Math.min(1, accion.t / accion.dur);
    const v = vasoPuesto;
    if (accion.tipo === 'botella') {
      // La botella sube, se inclina sobre el vaso, sirve y vuelve
      const b = accion.b;
      const ida = Math.min(1, s / 0.3);
      // Inclinada 2,2 rad, el pico (a 0,3 m de la base) queda justo encima del vaso
      tmp.set(VASO_X - 0.24, BARRA_Y + 0.37, VASO_Z);
      b.malla.position.lerpVectors(b.desde, tmp, suave(ida));
      const inclinacion = -2.2 * suave(Math.min(1, s / 0.35));
      b.malla.quaternion.setFromAxisAngle(ejeZ, inclinacion);
      if (s > 0.35 && v) {
        // Chorro desde el pico hasta el vaso
        b.malla.localToWorld(tmp.set(0, 0.3, 0));
        colocarChorro(chorros[0], tmp, v.grupo.position.y + 0.016 + v.medidas.length * ALTO_CAPA, b.color);
        if (!accion.hecho && s > 0.6) {
          accion.hecho = true;
          anadirMedida(v, b.indice, null);
        }
      }
      if (s >= 1) cerrarAccion();
    } else if (accion.tipo === 'agitar') {
      if (v) {
        // El vaso con la coctelera encima se agita arriba y abajo
        const fase = Math.sin(accion.t * 34);
        v.grupo.position.set(VASO_X, BARRA_Y + 0.006 + Math.max(0, Math.sin(s * Math.PI)) * 0.12 + fase * 0.03, VASO_Z);
        v.grupo.quaternion.setFromAxisAngle(ejeZ, fase * 0.25 * Math.sin(s * Math.PI));
        if (Math.floor(accion.t * 8) !== Math.floor((accion.t - dt) * 8)) ctx.sonido('coctelera');
      }
      if (s >= 1) cerrarAccion();
    }
  }

  function colocarChorro(chorro, pico, yLiquido, color) {
    chorro.visible = true;
    chorro.material.color.setHex(color);
    chorro.position.copy(pico);
    chorro.scale.set(1, Math.max(0.01, pico.y - yLiquido), 1);
    chorro.quaternion.identity();
  }

  // ─── VR ────────────────────────────────────────────────────────────────
  function actualizarVR(dt) {
    const real = performance.now() / 1000;
    manos.forEach((m, i) => {
      chorros[i].visible = false;
      if (!m.mano.activa) {
        if (m.objeto) soltar(m, i);
        return;
      }
      m.mano.grip.localToWorld(m.punto.set(0, -0.02, -0.04));
      m.mano.grip.getWorldQuaternion(m.quat);
      m.posiciones[m.idx].copy(m.punto);
      m.tiempos[m.idx] = real;
      m.idx = (m.idx + 1) % HISTORIAL;
      velocidadMano(m, 0.06);
      if (m.mano.gatilloPulsado && !m.objeto && estado === 'juego') coger(m, i);
      if (m.objeto && !m.mano.gatillo) soltar(m, i);
      if (!m.objeto) return;
      if (m.tipo === 'botella') sujetarBotella(m, i, dt);
      else if (m.tipo === 'vaso') sujetarVaso(m, i, dt);
    });
  }

  // Coge lo que haya más cerca del guante: una botella, el vaso o un hielo del cubo
  function coger(m, i) {
    let mejor = null;
    let distancia = R_COGER;
    for (const b of botellas) {
      if (b.estado !== 'raíl' && b.estado !== 'vuelta') continue;
      tmp.set(0, 0.12, 0).applyQuaternion(b.malla.quaternion);
      const d = tmp.add(b.malla.position).distanceTo(m.punto);
      if (d < distancia) {
        distancia = d;
        mejor = { tipo: 'botella', objeto: b };
      }
    }
    const v = vasoPuesto;
    if (v && (v.estado === 'puesto' || v.estado === 'aparece')) {
      const d = tmp.copy(v.grupo.position).setY(v.grupo.position.y + ALTO_VASO * 0.5).distanceTo(m.punto);
      if (d < distancia) {
        distancia = d;
        mejor = { tipo: 'vaso', objeto: v };
      }
    }
    if (cubitoEstado === 'nada' && tmp.copy(HIELO_POS).setY(BARRA_Y + 0.1).distanceTo(m.punto) < Math.max(distancia, 0.13)) {
      mejor = { tipo: 'hielo', objeto: null };
    }
    if (!mejor) return;
    m.tipo = mejor.tipo;
    m.objeto = mejor.objeto || true;
    if (mejor.tipo === 'botella') {
      mejor.objeto.estado = 'mano';
      mejor.objeto.mano = i;
      mejor.objeto.chorro = 0;
    } else if (mejor.tipo === 'vaso') {
      mejor.objeto.estado = 'mano';
      mejor.objeto.grupo.scale.setScalar(1);
      mejor.objeto.agitar = 0;
    } else {
      cubitoEstado = 'mano';
      cubitoMano = i;
      cubitoT = 0;
      ctx.sonido('hielo');
    }
    ctx.vibrar(m.mano, 0.3, 30);
    if (mejor.tipo !== 'hielo') ctx.sonido('tic');
  }

  // Botella en la mano: su eje sigue al mando; inclinada sobre el vaso, sirve
  function sujetarBotella(m, i, dt) {
    const b = m.objeto;
    b.malla.quaternion.copy(m.quat);
    tmp.set(0, -0.11, 0).applyQuaternion(b.malla.quaternion);
    b.malla.position.copy(m.punto).add(tmp);
    arriba.set(0, 1, 0).applyQuaternion(b.malla.quaternion);
    if (arriba.y > 0.4) {
      b.chorro = 0;
      return;
    }
    // Sirviendo: el chorro cae desde el pico
    b.malla.localToWorld(tmp.set(0, 0.3, 0));
    const v = vasoPuesto && vasoPuesto.estado === 'puesto' ? vasoPuesto : null;
    const dentro = v && Math.hypot(tmp.x - v.grupo.position.x, tmp.z - v.grupo.position.z) < R_VASO + 0.025 && tmp.y > v.grupo.position.y + ALTO_VASO - 0.02;
    const yFondo = dentro ? v.grupo.position.y + 0.016 + v.medidas.length * ALTO_CAPA : BARRA_Y + 0.005;
    colocarChorro(chorros[i], tmp, yFondo, b.color);
    if (Math.floor(tiempo * 7) !== Math.floor((tiempo - dt) * 7)) ctx.vibrar(m.mano, 0.12, 20);
    if (!dentro) return;
    b.chorro += dt;
    if (b.chorro >= TIEMPO_MEDIDA) {
      b.chorro = -0.25; // una pausa corta entre medida y medida, para que dé tiempo a parar
      anadirMedida(v, b.indice, m.mano);
    }
  }

  // Vaso en la mano: boca abajo se vacía; agitándolo fuerte se mezcla en la coctelera
  function sujetarVaso(m, i, dt) {
    const v = m.objeto;
    v.grupo.quaternion.copy(m.quat);
    tmp.set(0, -0.06, 0).applyQuaternion(v.grupo.quaternion);
    v.grupo.position.copy(m.punto).add(tmp);
    arriba.set(0, 1, 0).applyQuaternion(v.grupo.quaternion);
    if (arriba.y < -0.2 && (v.medidas.length || v.hielo)) {
      vaciar(v);
      ctx.sonido('verter');
      tmp.copy(v.grupo.position);
      ctx.efectos.estallido(tmp, { color: 0x90caf9, cantidad: 8, fuerza: 1 });
      devolverCoctelera();
      return;
    }
    if (!v.medidas.length || v.agitado || arriba.y < 0.3) return;
    const rapidez = m.vel.length();
    if (rapidez > 0.9) {
      if (v.agitar === 0) ponerCocteleraEnVaso();
      v.agitar += dt;
      if (Math.floor(v.agitar * 7) !== Math.floor((v.agitar - dt) * 7)) {
        ctx.sonido('coctelera');
        ctx.vibrar(m.mano, 0.35, 25);
      }
      if (v.agitar >= TIEMPO_AGITAR) terminarAgitado(v, m.mano);
    } else if (v.agitar > 0) {
      v.agitar = Math.max(0.001, v.agitar - dt * 0.3);
    }
  }

  function soltar(m, i) {
    const tipo = m.tipo;
    const objeto = m.objeto;
    m.objeto = null;
    m.tipo = null;
    chorros[i].visible = false;
    if (tipo === 'botella') {
      objeto.estado = 'vuelta';
      objeto.t = 0;
      objeto.desde.copy(objeto.malla.position);
      objeto.desdeQ.copy(objeto.malla.quaternion);
      objeto.mano = -1;
    } else if (tipo === 'hielo') {
      cubitoEstado = 'cae';
      cubitoT = 0;
    } else if (tipo === 'vaso') {
      soltarVaso(objeto, m);
    }
  }

  // Al soltar el vaso: empujado hacia delante, va por la barra al cliente al que apunta; dejado delante
  // de un cliente, es para él; en cualquier otro sitio, vuelve al puesto
  function soltarVaso(v, m) {
    v.grupo.quaternion.identity();
    const vel = m.vel;
    if (estado !== 'juego') {
      volverAlPuesto(v);
      return;
    }
    if (vel.z < -0.45 && Math.hypot(vel.x, vel.z) > 0.6) {
      // ¿A qué altura de la barra llegaría? Con ayuda: el cliente más cercano a esa línea
      const t = (ENTREGA_Z - v.grupo.position.z) / vel.z;
      const x = v.grupo.position.x + vel.x * Math.max(0, t);
      let mejor = -1;
      let distancia = 0.4;
      for (const c of clientes) {
        const d = Math.abs(c.x - x);
        if (c.grupo.visible && d < distancia) {
          distancia = d;
          mejor = c.indice;
        }
      }
      lanzarVaso(v, mejor, Math.max(-1.1, Math.min(1.1, x)));
      return;
    }
    if (m.punto.z < ENTREGA_Z + 0.16) {
      for (const c of clientes) {
        if (c.grupo.visible && Math.abs(c.x - m.punto.x) < 0.28) {
          v.grupo.position.y = BARRA_Y + 0.006;
          if (vasoPuesto === v) vasoPuesto = null;
          if (cocteleraEstado === 'vaso') devolverCoctelera();
          v.hasta.set(c.x, BARRA_Y + 0.006, ENTREGA_Z);
          entregar(v, c, m.mano);
          return;
        }
      }
    }
    volverAlPuesto(v);
  }

  function volverAlPuesto(v) {
    v.estado = 'vuelta';
    v.t = 0;
    v.desde.copy(v.grupo.position);
    if (cocteleraEstado === 'vaso' && !v.agitado && v.agitar > 0) devolverCoctelera();
  }

  // Velocidad del guante en los últimos ~segundos (para empujar el vaso y para agitarlo)
  function velocidadMano(m, ventana) {
    const n = HISTORIAL;
    const actual = (m.idx - 1 + n) % n;
    let j = actual;
    for (let i = 1; i < n; i++) {
      const k = (actual - i + n) % n;
      if (m.tiempos[k] < 0) break;
      j = k;
      if (m.tiempos[actual] - m.tiempos[k] >= ventana) break;
    }
    const dtv = m.tiempos[actual] - m.tiempos[j];
    if (dtv > 0) m.vel.subVectors(m.posiciones[actual], m.posiciones[j]).divideScalar(dtv);
    else m.vel.set(0, 0, 0);
  }

  // Las botellas que se han soltado vuelven a su sitio del raíl
  function moverBotellas(dt) {
    for (const b of botellas) {
      if (b.estado !== 'vuelta') continue;
      b.t += dt;
      const s = Math.min(1, b.t / 0.28);
      b.malla.position.lerpVectors(b.desde, b.casa, suave(s));
      b.malla.quaternion.slerpQuaternions(b.desdeQ, qVertical, suave(s));
      if (s >= 1) {
        b.estado = 'raíl';
        b.malla.position.copy(b.casa);
        b.malla.quaternion.identity();
        ctx.sonido('toc');
      }
    }
  }

  // ─── Partida ───────────────────────────────────────────────────────────
  function empezar() {
    estado = 'juego';
    puntos = 0;
    atendidos = 0;
    tiempoJuego = 0;
    segundoTic = 0;
    aviso = null;
    cerrarAccion();
    for (const v of vasos) retirarVaso(v);
    vasoPuesto = null;
    for (const c of clientes) {
      c.estado = 'vacio';
      c.espera = c.indice === 1 ? 0.2 : azar(0.8, 1.6);
      c.grupo.visible = false;
      ocultarPedido(c);
    }
    nuevoVaso();
    ctx.sonido('campana');
  }

  function terminar() {
    estado = 'fin';
    reloj = 6;
    cerrarAccion();
    ctx.puntuacion(puntos); // a la clasificación (juegos/marcadores.js): puntos del turno
    if (puntos > record) {
      record = puntos;
      ctx.guardar('record', record);
    }
    ctx.sonido('fin');
    tmp.set(0, 1.9, -1.2);
    ctx.efectos.impacto(puntos >= record && puntos > 0 ? 'grande' : 'medio', { pos: tmp, color: 0xffb74d });
    for (const c of clientes) {
      if (c.estado === 'espera' || c.estado === 'llega') {
        c.estado = 'se va';
        c.t = 0;
        ocultarPedido(c);
      }
    }
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function actualizar(dt) {
    tiempo += dt;
    reloj -= dt;
    if (estado === 'intro' && reloj <= 0) empezar();
    else if (estado === 'fin' && reloj <= 0) empezar();
    if (estado === 'juego') {
      tiempoJuego += dt;
      const queda = Math.ceil(DURACION - tiempoJuego);
      if (queda <= 10 && queda !== segundoTic && queda > 0) {
        segundoTic = queda;
        ctx.sonido('tic');
      }
      if (tiempoJuego >= DURACION) terminar();
    }
    if (aviso && (aviso.tiempo -= dt) <= 0) aviso = null;

    if (ctx.enVR()) {
      actualizarVR(dt);
    } else {
      colocarVista();
      actualizarRaton(dt);
    }
    moverBotellas(dt);
    moverVasos(dt);
    moverCoctelera(dt);
    moverCubito(dt);
    actualizarClientes(dt);
    // El neón parpadea de vez en cuando, como los de verdad
    aceituna.visible = Math.sin(tiempo * 1.7) > -0.92 || Math.sin(tiempo * 31) > 0;
    escribirMarcador();
  }

  escribirMarcador();

  return {
    actualizar,
    liberar() {
      // La shell retira lo que hay en la escena y en las manos y los recursos registrados.
      clicables.length = 0;
    },
  };
}
