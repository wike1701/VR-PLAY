// DEFENSA DEL CASTILLO
// Estás en lo alto de la muralla de un castillo al atardecer. Por tres caminos del valle avanzan
// oleadas de enemigos hacia el puente levadizo: soldados (1 pedrada), escuderos (2: la primera
// les rompe el escudo) y arietes (3). Los derribas con un tirachinas. Cada enemigo que llega al
// puente golpea la puerta (el ariete, el doble); con 5 golpes, cae el castillo. Las oleadas son
// cada vez más numerosas y rápidas, sin final. De vez en cuando cruza el cielo un globo con un
// cofre: si le das, consigues un poder temporal (piedras de fuego, disparo triple, cámara
// lenta, roca gigante) o se repara la puerta.
// En VR: el tirachinas va en una mano; con la otra coges la goma (gatillo), estiras y sueltas.
// Sin gafas: mantén pulsado, apunta al suelo y suelta.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código.
export async function precargar() {}

const G = 9.8;
const SUELO = -4;              // el valle, 4 m por debajo del adarve
const Z_PUENTE = -8.6;         // a donde llegan los enemigos (el principio del puente levadizo)
const Z_SALIDA = -52;
const VIDAS = 5;
const N_ENEMIGOS = 14;         // como mucho a la vez en el camino
const N_PIEDRAS = 24;
const N_PUNTOS = 26;           // puntos de la trayectoria que se ve al estirar
const ESTIRON_MAX = 0.55;      // m que se puede estirar la goma
const ESCALA_TIRACHINAS = 1.5; // el tirachinas, más grande que uno de verdad para que se vea bien
const VELOCIDAD_RATON = 24;    // m/s del disparo con ratón
const DURACION_PODER = 10;
const ESCALA = 1.45;           // los enemigos, algo grandes para verlos bien desde arriba
// Tipos de enemigo: vida, velocidad (m/s), puntos, golpes a la puerta y tamaño para acertarles
const TIPOS = {
  soldado: { vida: 1, velocidad: 1.7, puntos: 10, dano: 1, radio: 0.55, alto: 2.5 },
  escudero: { vida: 2, velocidad: 1.4, puntos: 20, dano: 1, radio: 0.6, alto: 2.5 },
  ariete: { vida: 3, velocidad: 0.9, puntos: 40, dano: 2, radio: 1.3, alto: 2.6 },
};
const PODERES = ['fuego', 'triple', 'lento', 'roca', 'puerta'];
const COLOR_PODER = { fuego: 0xff6a3d, triple: 0xffd23f, lento: 0x3d8bff, roca: 0xb36bff, puerta: 0x6dff7a };
const CLAVE_PODER = { fuego: 'poderes.fuego', triple: 'poderes.triple', lento: 'poderes.lento', roca: 'poderes.roca', puerta: 'poderes.puerta' };

// Tres caminos que bajan al puente: por la izquierda (0), por el centro (1) y por la derecha (2).
// Todos acaban en el puente; las curvas se cierran al llegar.
const VIAS = [
  { x0: -24, z0: -34, ondas: 5.5, fase: 0.6 },
  { x0: 0, z0: Z_SALIDA, ondas: 7.5, fase: 0 },
  { x0: 24, z0: -40, ondas: 6.2, fase: 2.1 },
];
function camino(u, salida, via = 1) {
  const v = VIAS[via];
  const resto = 1 - u;
  const z = v.z0 + (Z_PUENTE - v.z0) * u;
  let x = v.x0 * Math.pow(resto, 1.6) + Math.sin(u * v.ondas + v.fase) * 3 * resto * resto;
  if (via === 1) x = Math.sin(u * 7.5) * 6 * resto * resto + Math.sin(u * 2.3 + 1) * 1.5 * resto;
  return salida.set(x, SUELO, z);
}
// Lo que mide cada camino (para que todos los enemigos anden a la misma velocidad)
const LARGO_VIA = VIAS.map((_, via) => {
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  let largo = 0;
  camino(0, a, via);
  for (let i = 1; i <= 100; i++) {
    camino(i / 100, b, via);
    largo += a.distanceTo(b);
    a.copy(b);
  }
  return largo;
});

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (r) => ctx.recurso(r);

  ctx.fondo(0xf0a070, {
    cenit: 0x3e5a9a, horizonte: 0xffb27a, nubes: 0.45, sol: [0.45, 0.12, -1], niebla: [28, 95],
    paisaje: { tipo: 'montes', color: 0x51625a, radio: 85 },
  });
  ctx.sueloBase(false);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.75, 0.6), new THREE.Vector3(0, -3.2, -18));

  const matrizTmp = new THREE.Matrix4();
  const eulerTmp = new THREE.Euler();
  const colorTmp = new THREE.Color();
  const arriba = new THREE.Vector3(0, 1, 0);
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
  const caja = (w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) => colocar(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz);
  const cilindro = (r1, r2, h, x, y, z, rx = 0, ry = 0, rz = 0, seg = 10) => colocar(new THREE.CylinderGeometry(r1, r2, h, seg), x, y, z, rx, ry, rz);
  const bola = (r, x, y, z, seg = 10) => colocar(new THREE.SphereGeometry(r, seg, Math.max(6, seg - 2)), x, y, z);

  // ─── Valle ─────────────────────────────────────────────────────────────
  const valle = new THREE.Mesh(
    R(new THREE.PlaneGeometry(170, 170)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.cesped(0x5f8a42, { tam: 512, repetir: [60, 60], semilla: 211 })) })),
  );
  valle.rotation.x = -Math.PI / 2;
  valle.position.set(0, SUELO, -40);
  raiz.add(valle);
  // Caminos de tierra: una cinta por cada camino, todas en una sola malla
  const puntosCamino = 60;
  const posCamino = [];
  const uvCamino = [];
  const indCamino = [];
  const muestrasCamino = []; // puntos de los caminos, para no poner árboles encima
  const p0 = new THREE.Vector3();
  const p1 = new THREE.Vector3();
  for (let via = 0; via < VIAS.length; via++) {
    const base = posCamino.length / 3;
    // El tramo final es común a los tres: los laterales se pintan solo hasta que se juntan
    const hasta = via === 1 ? 1 : 0.9;
    for (let i = 0; i <= puntosCamino; i++) {
      const u = (i / puntosCamino) * hasta;
      camino(u, p0, via);
      camino(Math.min(1, u + 0.01), p1, via);
      muestrasCamino.push(p0.x, p0.z);
      const dx = p1.x - p0.x;
      const dz = p1.z - p0.z;
      const l = Math.hypot(dx, dz) || 1;
      const ancho = 1.5;
      const y = SUELO + 0.02 + via * 0.003; // sin parpadeos donde se cruzan
      posCamino.push(p0.x - (dz / l) * ancho, y, p0.z + (dx / l) * ancho, p0.x + (dz / l) * ancho, y, p0.z - (dx / l) * ancho);
      uvCamino.push(0, u * 14, 1, u * 14);
      const k = base + i * 2;
      if (i < puntosCamino) indCamino.push(k, k + 1, k + 2, k + 1, k + 3, k + 2);
    }
  }
  const lejosDelCamino = (x, z, margen) => {
    for (let i = 0; i < muestrasCamino.length; i += 2) {
      if (Math.hypot(muestrasCamino[i] - x, muestrasCamino[i + 1] - z) < margen) return false;
    }
    return true;
  };
  const geoCamino = R(new THREE.BufferGeometry());
  geoCamino.setAttribute('position', new THREE.Float32BufferAttribute(posCamino, 3));
  geoCamino.setAttribute('uv', new THREE.Float32BufferAttribute(uvCamino, 2));
  geoCamino.setIndex(indCamino);
  geoCamino.computeVertexNormals();
  raiz.add(new THREE.Mesh(geoCamino, R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.grano(0x9a7650, { tam: 256, semilla: 212 })), side: THREE.DoubleSide }))));
  // Foso con agua y el puente levadizo bajado
  const agua = new THREE.Mesh(R(new THREE.PlaneGeometry(40, 7.2)), R(new THREE.MeshStandardMaterial({ color: 0x2c5a6a, roughness: 0.15, metalness: 0.3 })));
  agua.rotation.x = -Math.PI / 2;
  agua.position.set(0, SUELO - 0.25, -4.7);
  raiz.add(agua);
  const texTablas = R(ctx.texturas.tablas(0x8a6240, { tablas: 10, repetir: [1, 2], semilla: 213 }));
  const puente = new THREE.Mesh(fusionar([
    caja(2.6, 0.18, 7.4, 0, SUELO - 0.05, -4.9),
    caja(0.12, 0.25, 7.4, -1.3, SUELO + 0.1, -4.9),
    caja(0.12, 0.25, 7.4, 1.3, SUELO + 0.1, -4.9),
  ]), R(new THREE.MeshLambertMaterial({ map: texTablas })));
  raiz.add(puente);
  // Árboles por el valle, dejando libres los caminos
  const listaArboles = [];
  for (let i = 0; i < 90 && listaArboles.length < 30; i++) {
    const x = ((i * 37) % 70) - 35 + ((i * 13) % 7) * 0.5;
    const z = -12 - ((i * 23) % 44);
    if (lejosDelCamino(x, z, 3.5)) listaArboles.push({ x, z, escala: 1.3 + ((i * 5) % 6) * 0.12 });
  }
  const bosque = ctx.arboles(listaArboles, { tipo: 'pino', semilla: 23 });
  bosque.position.y = SUELO;
  raiz.add(bosque);
  const frondosos = ctx.arboles([{ x: -14, z: -20 }, { x: 15, z: -26 }, { x: -11, z: -38 }, { x: 12, z: -44 }, { x: -18, z: -12 }, { x: 19, z: -14 }].filter((a) => lejosDelCamino(a.x, a.z, 3.5)), { tipo: 'frondoso', semilla: 24 });
  frondosos.position.y = SUELO;
  raiz.add(frondosos);

  // ─── Castillo: adarve, almenas, torres y antorchas ─────────────────────
  const matPiedra = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.ladrillos(0x9a8f80, 0x6a6258, { filas: 6, columnas: 3, repetir: [8, 2], semilla: 214 })) }));
  const muralla = [
    caja(26, 4, 1.4, 0, -2, -0.4),                // muro hasta el valle
    caja(26, 0.2, 3.6, 0, -0.1, 0.7),             // suelo del adarve
    caja(26, 0.85, 0.35, 0, 0.425, -0.95),        // parapeto
    caja(26, 0.7, 0.3, 0, 0.35, 2.4),             // pretil de atrás
  ];
  for (let i = -10; i <= 10; i++) {
    if (Math.abs(i) < 2) continue; // un hueco ancho delante de ti para ver el valle
    muralla.push(caja(0.7, 0.55, 0.38, i * 1.2, 1.12, -0.95));
  }
  for (const x of [-7.5, 7.5]) {
    muralla.push(cilindro(1.8, 1.9, 8, x, 0, -0.4, 0, 0, 0, 16));
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      muralla.push(caja(0.6, 0.5, 0.4, x + Math.cos(a) * 1.65, 4.25, -0.4 + Math.sin(a) * 1.65, 0, -a, 0));
    }
  }
  raiz.add(new THREE.Mesh(fusionar(muralla), matPiedra));
  const tejados = new THREE.Mesh(fusionar([
    colocar(new THREE.ConeGeometry(2.2, 2.6, 16), -7.5, 5.8, -0.4),
    colocar(new THREE.ConeGeometry(2.2, 2.6, 16), 7.5, 5.8, -0.4),
  ]), R(new THREE.MeshLambertMaterial({ color: 0x7a2a2a })));
  raiz.add(tejados);
  // Estandartes en las torres
  const estandartes = new THREE.Mesh(fusionar([
    caja(0.04, 1.6, 0.04, -7.5, 7.9, -0.4), caja(0.04, 1.6, 0.04, 7.5, 7.9, -0.4),
    caja(0.7, 0.45, 0.02, -7.15, 8.4, -0.4), caja(0.7, 0.45, 0.02, 7.85, 8.4, -0.4),
  ], [0x3a2a1a, 0x3a2a1a, 0xffd23f, 0xffd23f]), R(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide })));
  raiz.add(estandartes);
  // Antorchas en el parapeto: palo y llama que tiembla
  const antorchas = [-2.4, 2.4, -6, 6];
  raiz.add(new THREE.Mesh(fusionar(antorchas.map((x) => caja(0.05, 0.45, 0.05, x, 1.0, -0.7))), R(new THREE.MeshLambertMaterial({ color: 0x3a2414 }))));
  const llamas = new THREE.InstancedMesh(R(new THREE.ConeGeometry(0.07, 0.2, 8)), R(new THREE.MeshBasicMaterial({ color: 0xffa040, toneMapped: false })), antorchas.length);
  raiz.add(llamas);

  // ─── Enemigos ──────────────────────────────────────────────────────────
  // Cada uno mira a +Z (hacia el castillo), con los pies en y = 0
  function geoSoldado(tunica, arma) {
    const piezas = [
      caja(0.16, 0.8, 0.18, -0.1, 0.4, 0), caja(0.16, 0.8, 0.18, 0.1, 0.4, 0),
      caja(0.48, 0.62, 0.3, 0, 1.1, 0), caja(0.5, 0.08, 0.32, 0, 0.83, 0),
      caja(0.13, 0.56, 0.15, -0.31, 1.1, 0.02, 0.3), caja(0.13, 0.56, 0.15, 0.31, 1.1, 0.02, 0.3),
      bola(0.15, 0, 1.56, 0), colocar(new THREE.SphereGeometry(0.17, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0, 1.6, 0),
      colocar(new THREE.ConeGeometry(0.05, 0.22, 6), 0, 1.84, -0.02),
    ];
    const colores = [0x3a2a20, 0x3a2a20, tunica, 0x2a1a10, tunica, tunica, 0xd9a77a, 0x8a909a, tunica];
    if (arma === 'lanza') {
      piezas.push(cilindro(0.022, 0.022, 2.1, 0.36, 1.25, 0.15, 0.25), colocar(new THREE.ConeGeometry(0.05, 0.2, 6), 0.36, 2.29, 0.42, 0.25));
      colores.push(0x6a4a2a, 0xc8ccd2);
    } else {
      piezas.push(caja(0.05, 0.7, 0.03, 0.36, 1.25, 0.25, 0.4), caja(0.18, 0.04, 0.05, 0.36, 0.92, 0.12, 0.4));
      colores.push(0xc8ccd2, 0x5a3a1a);
    }
    return fusionar(piezas, colores);
  }
  const geos = {
    soldado: geoSoldado(0x9a2030, 'lanza'),
    escudero: geoSoldado(0x2a4a9a, 'espada'),
    ariete: fusionar([
      caja(1.2, 0.22, 2.6, 0, 0.62, 0),
      cilindro(0.34, 0.34, 0.14, -0.68, 0.34, 0.85, 0, 0, Math.PI / 2, 12), cilindro(0.34, 0.34, 0.14, 0.68, 0.34, 0.85, 0, 0, Math.PI / 2, 12),
      cilindro(0.34, 0.34, 0.14, -0.68, 0.34, -0.85, 0, 0, Math.PI / 2, 12), cilindro(0.34, 0.34, 0.14, 0.68, 0.34, -0.85, 0, 0, Math.PI / 2, 12),
      caja(0.12, 1.1, 0.12, -0.55, 1.25, 1.1), caja(0.12, 1.1, 0.12, 0.55, 1.25, 1.1), caja(0.12, 1.1, 0.12, -0.55, 1.25, -1.1), caja(0.12, 1.1, 0.12, 0.55, 1.25, -1.1),
      caja(0.8, 0.08, 2.8, -0.36, 1.95, 0, 0, 0, 0.6), caja(0.8, 0.08, 2.8, 0.36, 1.95, 0, 0, 0, -0.6),
      cilindro(0.17, 0.17, 3.0, 0, 1.05, 0.3, Math.PI / 2, 0, 0, 10),
      cilindro(0.22, 0.17, 0.35, 0, 1.05, 1.95, Math.PI / 2, 0, 0, 10),
    ], [0x5a3a24, 0x2a2018, 0x2a2018, 0x2a2018, 0x2a2018, 0x6a4a2a, 0x6a4a2a, 0x6a4a2a, 0x6a4a2a, 0x7a4a2a, 0x7a4a2a, 0x8a6a44, 0x4a4f58]),
  };
  const geoEscudo = fusionar([
    cilindro(0.36, 0.36, 0.06, 0, 1.08, 0.24, Math.PI / 2, 0, 0, 16),
    colocar(new THREE.TorusGeometry(0.36, 0.025, 6, 20), 0, 1.08, 0.27),
    bola(0.07, 0, 1.08, 0.28, 8),
  ], [0x8a5a30, 0x9aa0a8, 0xffd23f]);
  const enemigos = Array.from({ length: N_ENEMIGOS }, () => {
    const grupo = new THREE.Group();
    const material = R(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0xffffff, emissiveIntensity: 0 }));
    const mallas = {
      soldado: new THREE.Mesh(geos.soldado, material),
      escudero: new THREE.Mesh(geos.escudero, material),
      ariete: new THREE.Mesh(geos.ariete, material),
    };
    const escudo = new THREE.Mesh(geoEscudo, material);
    mallas.escudero.add(escudo);
    for (const m of Object.values(mallas)) grupo.add(m);
    grupo.scale.setScalar(ESCALA);
    grupo.visible = false;
    raiz.add(grupo);
    const sombra = ctx.crearSombra({ radio: 0.5, opacidad: 0.4 });
    sombra.visible = false;
    raiz.add(sombra);
    return { grupo, material, mallas, escudo, sombra, vivo: false, cayendo: 0, tipo: 'soldado', vida: 1, u: 0, via: 1, golpe: 0, fase: Math.random() * 6 };
  });

  // ─── Globo con cofre (los poderes) ─────────────────────────────────────
  const globo = new THREE.Group();
  const matGlobo = R(new THREE.MeshLambertMaterial({ color: 0xff6a3d, emissive: 0xff6a3d, emissiveIntensity: 0.25 }));
  const tela = new THREE.Mesh(R(new THREE.SphereGeometry(0.7, 16, 12).scale(1, 1.2, 1)), matGlobo);
  const cuerdas = new THREE.Mesh(fusionar([cilindro(0.01, 0.01, 0.9, -0.2, -1.15, 0, 0, 0, 0.2, 4), cilindro(0.01, 0.01, 0.9, 0.2, -1.15, 0, 0, 0, -0.2, 4)]), R(new THREE.MeshBasicMaterial({ color: 0x3a2a1a })));
  const cofre = new THREE.Mesh(fusionar([caja(0.55, 0.35, 0.38, 0, -1.75, 0), caja(0.58, 0.06, 0.4, 0, -1.6, 0), caja(0.08, 0.12, 0.05, 0, -1.68, 0.21)], [0x7a4a24, 0xd4a53a, 0xd4a53a]), R(new THREE.MeshLambertMaterial({ vertexColors: true })));
  globo.add(tela, cuerdas, cofre);
  globo.name = 'globo';
  globo.visible = false;
  raiz.add(globo);
  let esperaGlobo = 18;
  let tipoGlobo = 'fuego';
  const velGlobo = new THREE.Vector3();

  // ─── Piedras y trayectoria ─────────────────────────────────────────────
  const piedras = new THREE.InstancedMesh(R(new THREE.DodecahedronGeometry(0.07, 0)), R(new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x000000 })), N_PIEDRAS);
  piedras.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  piedras.setColorAt(0, colorTmp.set(0x8a8478));
  piedras.frustumCulled = false;
  raiz.add(piedras);
  const estadoPiedras = Array.from({ length: N_PIEDRAS }, () => ({ activa: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), giro: 0, roca: false, fuego: false, atravesados: 0, tocados: new Set(), estela: 0 }));
  const ocultar = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < N_PIEDRAS; i++) piedras.setMatrixAt(i, ocultar);
  const trayectoria = new THREE.InstancedMesh(R(new THREE.SphereGeometry(0.035, 6, 4)), R(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75, toneMapped: false })), N_PUNTOS);
  trayectoria.frustumCulled = false;
  trayectoria.count = 0;
  raiz.add(trayectoria);
  const diana = new THREE.Mesh(R(new THREE.RingGeometry(0.5, 0.7, 24).rotateX(-Math.PI / 2)), R(new THREE.MeshBasicMaterial({ color: 0xff6a3d, transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false })));
  diana.visible = false;
  raiz.add(diana);

  // ─── Tirachinas ────────────────────────────────────────────────────────
  // Mango hacia abajo, horquilla hacia arriba; el centro de la horquilla es de donde sale la piedra
  const texMadera = R(ctx.texturas.madera(0x9a6a3a, { tam: 128, semilla: 215 }));
  const matHorquilla = R(new THREE.MeshStandardMaterial({ map: texMadera, roughness: 0.6 }));
  const matCuero = R(new THREE.MeshStandardMaterial({ color: 0x6a3a1e, roughness: 0.9 }));
  const geoHorquilla = fusionar([
    cilindro(0.016, 0.019, 0.14, 0, -0.05, 0, 0, 0, 0, 10),
    cilindro(0.013, 0.016, 0.12, -0.035, 0.065, 0, 0, 0, 0.55, 10),
    cilindro(0.013, 0.016, 0.12, 0.035, 0.065, 0, 0, 0, -0.55, 10),
    cilindro(0.012, 0.013, 0.07, -0.07, 0.14, 0, 0, 0, 0.1, 10),
    cilindro(0.012, 0.013, 0.07, 0.07, 0.14, 0, 0, 0, -0.1, 10),
  ]);
  const geoPuno = R(new THREE.CylinderGeometry(0.021, 0.021, 0.08, 12));
  geoPuno.translate(0, -0.07, 0);
  const PUNTA_IZQ = new THREE.Vector3(-0.075, 0.17, 0);
  const PUNTA_DER = new THREE.Vector3(0.075, 0.17, 0);
  const CENTRO_HORQUILLA = new THREE.Vector3(0, 0.16, 0);
  function crearHorquilla() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geoHorquilla, matHorquilla), new THREE.Mesh(geoPuno, matCuero));
    return g;
  }
  const horquillas = ctx.manos.map((mano) => {
    const g = crearHorquilla();
    g.rotation.x = -0.2;
    g.scale.setScalar(ESCALA_TIRACHINAS);
    ctx.adjuntarAMano(mano, g);
    return g;
  });
  const horquillaRaton = crearHorquilla();
  horquillaRaton.scale.setScalar(ESCALA_TIRACHINAS);
  raiz.add(horquillaRaton);
  // Gomas (dos tiras) y la badana con la piedra
  const geoGoma = R(new THREE.CylinderGeometry(0.0045, 0.0045, 1, 6));
  geoGoma.translate(0, 0.5, 0);
  const matGoma = R(new THREE.MeshLambertMaterial({ color: 0xc8a050, emissive: 0x000000 }));
  const gomas = [new THREE.Mesh(geoGoma, matGoma), new THREE.Mesh(geoGoma, matGoma)];
  for (const g of gomas) raiz.add(g);
  const badana = new THREE.Mesh(R(new THREE.BoxGeometry(0.07, 0.04, 0.03)), matCuero);
  raiz.add(badana);
  const piedraCargada = new THREE.Mesh(piedras.geometry, R(new THREE.MeshLambertMaterial({ color: 0x8a8478, emissive: 0x000000 })));
  raiz.add(piedraCargada);
  let manoHorquilla = 0;      // índice de la mano con el tirachinas
  let tirando = -1;           // índice de la mano que estira (-1: ninguna)
  let pasoVibracion = 0;

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.1, alto: 0.36 });
  marcador.mesh.position.set(-1.05, 1.72, -1.35);
  marcador.mesh.rotation.y = 0.45;
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'descanso' | 'oleada' | 'fin'
  let reloj = 5;
  let puntos = 0;
  let vidas = VIDAS;
  let oleada = 0;
  let porSalir = 0;          // enemigos de la oleada que faltan por salir
  let esperaSalida = 0;
  let record = ctx.leer('record', 0);
  let nuevoRecord = false;
  let mensaje = '';
  let colorMensaje = '#ffffff';
  let tiempoMensaje = 0;
  let poder = null;          // 'fuego' | 'triple' | 'lento' | 'roca'
  let restoPoder = 0;
  let temblorPuente = 0;
  let tiempo = 0;
  let ratonAntes = false;
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const tmp3 = new THREE.Vector3();
  const centro = new THREE.Vector3();
  const badanaPos = new THREE.Vector3();
  const velDisparo = new THREE.Vector3();
  const objetivo = new THREE.Vector3();
  const sim = new THREE.Vector3();
  const simVel = new THREE.Vector3();

  function decir(texto, color, duracion = 1.6) {
    mensaje = texto;
    colorMensaje = color;
    tiempoMensaje = duracion;
  }

  function empezarPartida() {
    puntos = 0;
    vidas = VIDAS;
    oleada = 0;
    nuevoRecord = false;
    poder = null;
    esperaGlobo = 18;
    globo.visible = false;
    for (const e of enemigos) quitarEnemigo(e);
    siguienteOleada();
  }

  function siguienteOleada() {
    oleada += 1;
    porSalir = Math.min(40, 4 + oleada * 2);
    esperaSalida = 0;
    estado = 'descanso';
    reloj = 3.5;
    decir(ctx.t('oleada', { n: oleada }), '#ffd23f', 3);
    ctx.sonido('cuerno');
  }

  // Más rápidos con cada oleada; con el poder de cámara lenta, la mitad
  const ritmo = () => Math.min(2.6, 1 + (oleada - 1) * 0.07) * (poder === 'lento' ? 0.5 : 1);

  function sacarEnemigo() {
    const e = enemigos.find((k) => !k.vivo && k.cayendo <= 0);
    if (!e) return false;
    const r = Math.random();
    const pEscudero = oleada >= 2 ? Math.min(0.35, 0.12 + oleada * 0.03) : 0;
    const pAriete = oleada >= 3 ? Math.min(0.18, 0.04 + oleada * 0.015) : 0;
    e.tipo = r < pAriete ? 'ariete' : r < pAriete + pEscudero ? 'escudero' : 'soldado';
    e.vida = TIPOS[e.tipo].vida;
    e.u = 0;
    e.via = Math.floor(Math.random() * VIAS.length);
    e.vivo = true;
    e.cayendo = 0;
    e.golpe = 0;
    for (const [tipo, m] of Object.entries(e.mallas)) m.visible = tipo === e.tipo;
    e.escudo.visible = true;
    e.grupo.visible = true;
    e.grupo.rotation.set(0, 0, 0);
    e.sombra.visible = true;
    e.sombra.userData.radio = e.tipo === 'ariete' ? 1.5 : 0.6;
    return true;
  }

  function quitarEnemigo(e) {
    e.vivo = false;
    e.cayendo = 0;
    e.grupo.visible = false;
    e.sombra.visible = false;
  }

  // Un enemigo recibe «dano» golpes en «punto»
  function herir(e, dano, punto) {
    if (!e.vivo) return;
    e.vida -= dano;
    e.golpe = 0.15;
    if (e.vida > 0) {
      if (e.tipo === 'escudero' && e.escudo.visible) {
        e.escudo.visible = false;
        ctx.efectos.estallido(punto, { color: 0x8a5a30, cantidad: 10 });
        ctx.sonido('madera');
      } else {
        ctx.sonido('pedrada');
      }
      ctx.efectos.impacto('pequeño', { pos: punto, color: 0xffffff });
      return;
    }
    // Derribado: cae hacia atrás y se hunde; puntos (y extra si estaba lejos)
    e.vivo = false;
    e.cayendo = 1.4;
    const t = TIPOS[e.tipo];
    const lejos = -e.grupo.position.z > 30;
    const suma = t.puntos + (lejos ? 5 : 0);
    puntos += suma;
    tmp3.copy(e.grupo.position).y += 2.6;
    ctx.efectos.impacto(e.tipo === 'ariete' ? 'medio' : 'pequeño', { pos: punto, color: 0xd9b27a, sonido: 'derribo' });
    ctx.efectos.estallido(punto, { color: 0xb09878, cantidad: 12 });
    ctx.efectos.texto(tmp3, `+${suma}`, { color: lejos ? '#ffd23f' : '#ffffff', tam: 1.6 });
    if (lejos) decir(ctx.t('lejos'), '#ffd23f', 1.2);
  }

  // Llega al puente: golpe a la puerta
  function alPuente(e) {
    const dano = TIPOS[e.tipo].dano;
    quitarEnemigo(e);
    if (estado === 'fin') return; // el castillo ya ha caído
    vidas = Math.max(0, vidas - dano);
    temblorPuente = 0.6;
    decir(ctx.t('puerta'), '#ff8a80', 1.4);
    ctx.sonido('derrumbe');
    ctx.destello(0xff2a2a, 0.15);
    for (const m of ctx.manos) ctx.vibrar(m, 0.7, 150);
    if (vidas <= 0) terminar();
  }

  function terminar() {
    estado = 'fin';
    reloj = 7;
    decir(ctx.t('fin'), '#ff8a80', 7);
    ctx.sonido('fallo');
    ctx.puntuacion(puntos); // a la clasificación (juegos/marcadores.js)
    if (puntos > record) {
      record = puntos;
      nuevoRecord = puntos > 0;
      ctx.guardar('record', record);
    }
    if (nuevoRecord) {
      tmp.set(0, 1.2, -2);
      ctx.efectos.impacto('grande', { pos: tmp, color: 0xffd23f, sonido: 'ovacion' });
    }
    poder = null;
    globo.visible = false;
  }

  // ─── Disparos ──────────────────────────────────────────────────────────
  function lanzar(origen, vel) {
    const tiros = poder === 'triple' ? [-0.09, 0, 0.09] : [0];
    for (const giro of tiros) {
      const p = estadoPiedras.find((k) => !k.activa);
      if (!p) return;
      p.activa = true;
      p.pos.copy(origen);
      p.vel.copy(vel).applyAxisAngle(arriba, giro);
      p.roca = poder === 'roca';
      p.fuego = poder === 'fuego';
      p.atravesados = 0;
      p.tocados.clear();
      p.giro = Math.random() * 6;
    }
    ctx.sonido('tirachinas');
  }

  function explotar(punto) {
    ctx.efectos.impacto('medio', { pos: punto, color: 0xff6a3d, sonido: 'explosion' });
    ctx.efectos.estallido(punto, { color: 0xffb040, cantidad: 26, fuerza: 4 });
    for (const e of enemigos) {
      if (!e.vivo) continue;
      if (Math.hypot(e.grupo.position.x - punto.x, e.grupo.position.z - punto.z) < 3.2) herir(e, 2, tmp2.copy(e.grupo.position).setY(SUELO + 1.2));
    }
  }

  function moverPiedras(dt) {
    for (let i = 0; i < N_PIEDRAS; i++) {
      const p = estadoPiedras[i];
      if (!p.activa) continue;
      for (let paso = 0; paso < 3 && p.activa; paso++) {
        const h = dt / 3;
        p.vel.y -= G * h;
        p.pos.addScaledVector(p.vel, h);
        const radio = p.roca ? 0.3 : 0.12;
        // Enemigos
        for (const e of enemigos) {
          if (!e.vivo || p.tocados.has(e)) continue;
          const t = TIPOS[e.tipo];
          const dx = p.pos.x - e.grupo.position.x;
          const dz = p.pos.z - e.grupo.position.z;
          const dy = p.pos.y - e.grupo.position.y;
          if (dx * dx + dz * dz < (t.radio + radio) ** 2 && dy > -0.2 && dy < t.alto + radio) {
            p.tocados.add(e);
            if (p.fuego) {
              explotar(p.pos);
              p.activa = false;
            } else {
              herir(e, p.roca ? 3 : 1, p.pos);
              p.atravesados += 1;
              if (!p.roca || p.atravesados >= 3) p.activa = false;
            }
            break;
          }
        }
        // Globo
        if (p.activa && globo.visible && p.pos.distanceTo(globo.position) < 0.85 + radio) {
          p.activa = false;
          romperGlobo();
        }
        // Suelo, agua o muy lejos
        if (p.activa && (p.pos.y < SUELO + 0.05 || p.pos.z < -110 || Math.abs(p.pos.x) > 80)) {
          p.activa = false;
          if (p.pos.y < SUELO + 0.5) {
            p.pos.y = SUELO + 0.05;
            if (p.fuego) explotar(p.pos);
            else {
              ctx.efectos.estallido(p.pos, { color: 0x9a8a70, cantidad: 6, fuerza: 1.2 });
              if (p.pos.z > -20) ctx.sonido('grava');
            }
          }
        }
      }
      if (p.activa) {
        p.giro += dt * 8;
        const s = p.roca ? 3 : 1;
        matrizTmp.makeRotationFromEuler(eulerTmp.set(p.giro, p.giro * 0.7, 0)).scale(tmp.set(s, s, s)).setPosition(p.pos);
        piedras.setMatrixAt(i, matrizTmp);
        piedras.setColorAt(i, colorTmp.set(p.fuego ? 0xff7a2e : p.roca ? 0xb36bff : 0x8a8478));
        // Estela de chispas de las piedras de fuego
        if (p.fuego && (p.estela -= dt) <= 0) {
          p.estela = 0.05;
          ctx.efectos.estallido(p.pos, { color: 0xffa040, cantidad: 1, fuerza: 0.3, tam: 0.05, vida: 0.35, gravedad: 0 });
        }
      } else {
        piedras.setMatrixAt(i, ocultar);
      }
    }
    piedras.instanceMatrix.needsUpdate = true;
    piedras.instanceColor.needsUpdate = true;
  }

  // Dibuja la trayectoria que seguiría una piedra (y el aro donde caería)
  function dibujarTrayectoria(origen, vel) {
    sim.copy(origen);
    simVel.copy(vel);
    let n = 0;
    for (let k = 0; k < 120 && n < N_PUNTOS; k++) {
      const h = 0.025;
      simVel.y -= G * h;
      sim.addScaledVector(simVel, h);
      if (k % 4 === 0) {
        matrizTmp.makeTranslation(sim.x, sim.y, sim.z);
        trayectoria.setMatrixAt(n++, matrizTmp);
      }
      if (sim.y < SUELO) break;
    }
    trayectoria.count = n;
    trayectoria.instanceMatrix.needsUpdate = true;
    // Dónde cae (continuando la simulación hasta el suelo)
    for (let k = 0; k < 400 && sim.y > SUELO; k++) {
      simVel.y -= G * 0.025;
      sim.addScaledVector(simVel, 0.025);
    }
    diana.visible = sim.y <= SUELO + 0.5;
    diana.position.set(sim.x, SUELO + 0.05, sim.z);
  }

  // ─── Poderes ───────────────────────────────────────────────────────────
  function sacarGlobo() {
    tipoGlobo = PODERES[Math.floor(Math.random() * PODERES.length)];
    if (tipoGlobo === 'puerta' && vidas >= VIDAS) tipoGlobo = 'triple';
    matGlobo.color.setHex(COLOR_PODER[tipoGlobo]);
    matGlobo.emissive.setHex(COLOR_PODER[tipoGlobo]);
    const lado = Math.random() < 0.5 ? -1 : 1;
    globo.position.set(lado * 26, 3 + Math.random() * 3.5, -14 - Math.random() * 14);
    velGlobo.set(-lado * (3 + Math.random() * 1.5), 0, 0);
    globo.visible = true;
  }

  function romperGlobo() {
    globo.visible = false;
    tmp.copy(globo.position);
    ctx.efectos.impacto('grande', { pos: tmp, color: COLOR_PODER[tipoGlobo], sonido: 'globo' });
    ctx.efectos.estallido(tmp, { color: COLOR_PODER[tipoGlobo], cantidad: 24 });
    ctx.efectos.texto(tmp, '+15', { color: '#ffd23f', tam: 1.6 });
    puntos += 15;
    ctx.sonido('poder');
    if (tipoGlobo === 'puerta') {
      vidas = Math.min(VIDAS, vidas + 1);
      decir(ctx.t(CLAVE_PODER.puerta), '#6dff7a', 2);
      return;
    }
    poder = tipoGlobo;
    restoPoder = DURACION_PODER;
    decir(ctx.t(CLAVE_PODER[poder]), '#' + colorTmp.set(COLOR_PODER[poder]).getHexString(), 2);
  }

  // ─── VR: una mano lleva el tirachinas y la otra estira la goma ─────────
  function tirachinasVR(dt) {
    const mh = ctx.manos[manoHorquilla];
    const otra = ctx.manos[1 - manoHorquilla];
    for (let i = 0; i < horquillas.length; i++) horquillas[i].visible = i === manoHorquilla && ctx.manos[i].activa;
    const h = horquillas[manoHorquilla];
    h.localToWorld(centro.copy(CENTRO_HORQUILLA));
    // El gatillo de la mano del tirachinas lo cambia de mano (zurdos), si no se está estirando
    if (tirando < 0 && mh.gatilloPulsado && otra.activa) {
      manoHorquilla = 1 - manoHorquilla;
      ctx.vibrar(otra, 0.3, 40);
      return;
    }
    if (tirando < 0) {
      badanaPos.copy(centro);
      otra.grip.getWorldPosition(tmp);
      if (otra.gatilloPulsado && tmp.distanceTo(centro) < 0.22 && estado !== 'fin') {
        tirando = otra.indice;
        pasoVibracion = 0;
        ctx.vibrar(otra, 0.3, 30);
      }
    }
    if (tirando >= 0) {
      const m = ctx.manos[tirando];
      m.grip.getWorldPosition(tmp);
      const estiron = Math.min(ESTIRON_MAX, tmp.distanceTo(centro));
      badanaPos.copy(tmp).sub(centro).setLength(estiron).add(centro);
      // Vibra un poco cada 10 cm de goma estirada
      const paso = Math.floor(estiron / 0.1);
      if (paso > pasoVibracion) {
        pasoVibracion = paso;
        ctx.vibrar(m, 0.12 + paso * 0.05, 15);
      }
      velDisparo.copy(centro).sub(badanaPos).setLength(8 + 26 * (estiron / ESTIRON_MAX));
      if (estiron > 0.06) dibujarTrayectoria(centro, velDisparo);
      else {
        trayectoria.count = 0;
        diana.visible = false;
      }
      if (!m.gatillo) {
        tirando = -1;
        trayectoria.count = 0;
        diana.visible = false;
        if (estiron > 0.08 && estado !== 'fin') {
          lanzar(centro, velDisparo);
          ctx.vibrar(m, 0.6, 40);
          ctx.vibrar(mh, 0.4, 40);
        }
      }
    }
    pintarGomas(h, h.visible);
  }

  // ─── Ratón: mantener pulsado, apuntar al suelo y soltar ────────────────
  const planoSuelo = new THREE.Plane(new THREE.Vector3(0, 1, 0), -SUELO);
  let carga = 0;
  function tirachinasRaton(dt) {
    const r = ctx.raton;
    horquillaRaton.visible = true;
    centro.set(0.22, 1.25, -0.35);
    horquillaRaton.position.set(0.22, 1.25 - CENTRO_HORQUILLA.y * ESCALA_TIRACHINAS, -0.35);
    // A lo que señales: el globo, el suelo o, si apuntas al cielo, un punto del aire a 30 m
    const rayo = r.rayo.ray;
    if (globo.visible && rayo.distanceSqToPoint(globo.position) < 1.2) objetivo.copy(globo.position);
    else if (!rayo.intersectPlane(planoSuelo, objetivo) || objetivo.distanceTo(centro) > 70) rayo.at(30, objetivo);
    if (objetivo.z > Z_PUENTE + 0.5 && objetivo.y < SUELO + 1) objetivo.z = Z_PUENTE + 0.5;
    const apunta = objetivo.z < centro.z - 1;
    if (apunta) horquillaRaton.rotation.set(0, Math.atan2(-(objetivo.x - centro.x), -(objetivo.z - centro.z)), 0);
    if (r.pulsado && estado !== 'fin') {
      carga = Math.min(1, carga + dt * 3);
      if (apunta) {
        velocidadHacia(centro, objetivo, VELOCIDAD_RATON, velDisparo);
        dibujarTrayectoria(centro, velDisparo);
      }
      badanaPos.copy(centro).addScaledVector(tmp.copy(velDisparo).normalize(), -0.3 * carga);
    } else {
      if (ratonAntes && carga > 0.15 && apunta && estado !== 'fin') {
        velocidadHacia(centro, objetivo, VELOCIDAD_RATON, velDisparo);
        lanzar(centro, velDisparo);
      }
      carga = 0;
      badanaPos.copy(centro);
      trayectoria.count = 0;
      diana.visible = false;
    }
    ratonAntes = r.pulsado;
    pintarGomas(horquillaRaton, true);
  }

  // Velocidad para ir de «a» a «b» con esa rapidez (tiro bajo; si no llega, a 45°)
  function velocidadHacia(a, b, v, salida) {
    const dx = b.x - a.x;
    const dz = b.z - a.z;
    const d = Math.hypot(dx, dz);
    const h = b.y - a.y;
    const disc = v ** 4 - G * (G * d * d + 2 * h * v * v);
    const ang = disc >= 0 ? Math.atan((v * v - Math.sqrt(disc)) / (G * d)) : Math.PI / 4;
    return salida.set((dx / d) * Math.cos(ang) * v, Math.sin(ang) * v, (dz / d) * Math.cos(ang) * v);
  }

  function pintarGomas(horquilla, visible) {
    for (const g of gomas) g.visible = visible;
    badana.visible = visible;
    piedraCargada.visible = visible && estado !== 'fin';
    if (!visible) return;
    const puntas = [PUNTA_IZQ, PUNTA_DER];
    for (let i = 0; i < 2; i++) {
      horquilla.localToWorld(tmp.copy(puntas[i]));
      tmp2.subVectors(badanaPos, tmp);
      gomas[i].position.copy(tmp);
      gomas[i].scale.set(1, Math.max(0.001, tmp2.length()), 1);
      gomas[i].quaternion.setFromUnitVectors(arriba, tmp2.normalize());
    }
    badana.position.copy(badanaPos);
    horquilla.getWorldQuaternion(badana.quaternion);
    piedraCargada.position.copy(badanaPos);
    const s = poder === 'roca' ? 2 : 1;
    piedraCargada.scale.setScalar(s * 0.7); // la de la goma, algo más pequeña que la horquilla
    piedraCargada.material.color.setHex(poder === 'fuego' ? 0xff7a2e : poder === 'roca' ? 0xb36bff : 0x8a8478);
    // Con un poder activo, la goma brilla de su color
    matGoma.emissive.setHex(poder ? COLOR_PODER[poder] : 0x000000);
  }

  // ─── Marcador ──────────────────────────────────────────────────────────
  function actualizarMarcador() {
    const corazones = '♥'.repeat(vidas) + '♡'.repeat(VIDAS - vidas);
    if (estado === 'intro') {
      const intro = ctx.enVR() ? ctx.t('intro') : ctx.t(ctx.tactil ? 'introTactil' : 'introRaton');
      marcador.escribir([
        { texto: ctx.t('titulo'), tam: 1.05, color: '#ffd23f' },
        { texto: intro, tam: 0.6 },
        { texto: ctx.t('partida.record', { record }), tam: 0.54, color: '#cfd8dc' },
      ]);
      return;
    }
    if (estado === 'fin') {
      marcador.escribir([
        { texto: ctx.t('partida.finPuntos', { n: puntos }), tam: 1.1, color: '#ffd23f' },
        { texto: mensaje, tam: 0.62, color: colorMensaje },
        { texto: nuevoRecord ? ctx.t('partida.nuevoRecord') : ctx.t('resumen', { n: oleada, record }), tam: 0.56, color: nuevoRecord ? '#ffd23f' : '#cfd8dc' },
      ]);
      return;
    }
    let linea;
    if (tiempoMensaje > 0) linea = { texto: mensaje, tam: 0.7, color: colorMensaje };
    else if (poder) linea = { texto: ctx.t('poderActivo', { nombre: ctx.t(CLAVE_PODER[poder]), s: Math.ceil(restoPoder) }), tam: 0.7, color: '#' + colorTmp.set(COLOR_PODER[poder]).getHexString() };
    else linea = { texto: ctx.t('estado', { n: oleada, vidas: corazones }), tam: 0.7, color: '#cfd8dc' };
    marcador.escribir([{ texto: ctx.t('marcador', { puntos }), tam: 1.15 }, linea]);
  }

  // ─── Bucle ─────────────────────────────────────────────────────────────
  function actualizar(dt) {
    tiempo += dt;
    tiempoMensaje -= dt;
    reloj -= dt;
    if (estado === 'intro' && reloj <= 0) empezarPartida();
    if (estado === 'fin' && reloj <= 0) {
      estado = 'intro';
      reloj = 4;
      for (const e of enemigos) quitarEnemigo(e);
    }
    if (estado === 'descanso' && reloj <= 0) estado = 'oleada';
    if (estado === 'oleada') {
      // Salida de enemigos, cada vez más seguidos
      esperaSalida -= dt;
      if (porSalir > 0 && esperaSalida <= 0 && sacarEnemigo()) {
        porSalir -= 1;
        esperaSalida = Math.max(0.4, 2.4 - oleada * 0.1) * (0.7 + Math.random() * 0.6);
      }
      // Oleada terminada: no queda nadie por salir ni en el camino
      if (porSalir <= 0 && !enemigos.some((e) => e.vivo)) siguienteOleada();
      // Globos con poderes
      if (!globo.visible) {
        esperaGlobo -= dt;
        if (esperaGlobo <= 0) {
          sacarGlobo();
          esperaGlobo = Math.max(12, 24 - oleada) + Math.random() * 8;
        }
      }
    }
    if (poder) {
      restoPoder -= dt;
      if (restoPoder <= 0) {
        decir(ctx.t('poderAcaba'), '#cfd8dc', 1.2);
        poder = null;
      }
    }
    moverEnemigos(dt);
    moverPiedras(dt);
    if (ctx.enVR()) {
      horquillaRaton.visible = false;
      tirachinasVR(dt);
    } else {
      for (const h of horquillas) h.visible = false;
      tirachinasRaton(dt);
    }
    animar(dt);
    actualizarMarcador();
  }

  function moverEnemigos(dt) {
    for (const e of enemigos) {
      if (e.vivo) {
        e.u += (TIPOS[e.tipo].velocidad * ritmo() * dt) / LARGO_VIA[e.via];
        if (e.u >= 1) {
          alPuente(e);
          continue;
        }
        camino(e.u, e.grupo.position, e.via);
        camino(Math.min(1, e.u + 0.01), tmp, e.via);
        e.grupo.rotation.y = Math.atan2(tmp.x - e.grupo.position.x, tmp.z - e.grupo.position.z);
        // Andar: un saltito y un balanceo (el ariete solo se mece)
        const paso = tiempo * (e.tipo === 'ariete' ? 3 : 7) * ritmo() + e.fase;
        e.grupo.position.y += Math.abs(Math.sin(paso)) * (e.tipo === 'ariete' ? 0.02 : 0.07);
        e.grupo.rotation.z = Math.sin(paso) * (e.tipo === 'ariete' ? 0.015 : 0.06);
      } else if (e.cayendo > 0) {
        // Cae de espaldas y se hunde
        e.cayendo -= dt;
        const t = 1.4 - e.cayendo;
        e.grupo.rotation.x = -Math.min(1, t / 0.35) * (e.tipo === 'ariete' ? 0.3 : 1.5);
        if (t > 0.6) e.grupo.position.y -= dt * 1.4;
        if (e.cayendo <= 0) quitarEnemigo(e);
      }
      if (e.grupo.visible) {
        e.golpe = Math.max(0, e.golpe - dt);
        e.material.emissiveIntensity = e.golpe > 0 ? 0.6 : 0;
        ctx.colocarSombra(e.sombra, e.grupo.position, SUELO + 0.03);
      }
    }
  }

  function animar(dt) {
    // Globo: cruza el cielo meciéndose
    if (globo.visible) {
      globo.position.addScaledVector(velGlobo, dt);
      globo.position.y += Math.sin(tiempo * 1.6) * dt * 0.4;
      globo.rotation.z = Math.sin(tiempo * 1.3) * 0.08;
      if (Math.abs(globo.position.x) > 28) globo.visible = false;
    }
    // Llamas de las antorchas
    for (let i = 0; i < antorchas.length; i++) {
      const s = 1 + Math.sin(tiempo * 13 + i * 2) * 0.15 + Math.sin(tiempo * 7.3 + i) * 0.1;
      matrizTmp.makeScale(1, s, 1).setPosition(antorchas[i], 1.3 + s * 0.05, -0.7);
      llamas.setMatrixAt(i, matrizTmp);
    }
    llamas.instanceMatrix.needsUpdate = true;
    // El puente tiembla al recibir un golpe
    temblorPuente = Math.max(0, temblorPuente - dt);
    puente.position.x = temblorPuente > 0 ? Math.sin(tiempo * 60) * temblorPuente * 0.08 : 0;
  }

  actualizarMarcador();

  return {
    actualizar,
    liberar() {},
  };
}
