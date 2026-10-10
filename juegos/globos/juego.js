// PINCHA GLOBOS
// Caseta de feria con un tablero de corcho lleno de globos. En VR coges un dardo
// del mostrador (gatillo o botón lateral) y lo lanzas con el brazo. Sin gafas:
// haz clic o toca el globo y el dardo va hacia él. Los globos del tablero valen 1,
// los que cruzan por delante y los que suben flotando valen 2 y los dorados, 5.
// Rondas de 60 segundos.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const DURACION = 60;
const G = 6;                  // gravedad de los dardos (más suave que la real: se lanzan sin peso)
const TABLERO_Z = -3.2;       // cara del corcho
const TABLERO_ABAJO = 0.75;
const TABLERO_ARRIBA = 2.62;
const PARED_X = 1.9;          // paredes laterales de la caseta
const CASETA_FRENTE = -0.8;   // donde empiezan las paredes y el toldo
const TECHO = 3.4;
const RX = 0.13;              // radios del globo (horizontal y vertical)
const RY = 0.16;
const LARGO_PUNTA = 0.135;    // del centro del dardo a la punta
const ALCANCE_AGARRE = 0.22;
const FUERZA_VR = 1.25;       // los lanzamientos en VR suelen quedarse cortos
const AYUDA = 0.55;           // cuánto se corrige un buen lanzamiento en VR hacia el globo
const ANGULO_AYUDA = THREE.MathUtils.degToRad(14);
const V_RATON = 10;           // velocidad del dardo con ratón
const RECARGA_RATON = 0.35;
const MAX_CLAVADOS = 8;
// Bandeja de dardos en VR (uno para cada mano) y la "mano" del ratón
const PUESTOS_VR = [new THREE.Vector3(-0.22, 1.0, -0.55), new THREE.Vector3(0.22, 1.0, -0.55)];
const MANO_RATON = new THREE.Vector3(0.2, 1.38, 0.15);
// Globos: rejilla del tablero, carriles que cruzan y zona por la que suben
const COLUMNAS = 7;
const FILAS = 4;
const CARRILES = [{ y: 1.28, z: -2.55 }, { y: 2.12, z: -2.55 }];
const POR_CARRIL = 3;
const MAX_SUBEN = 3;
const SUBEN_Z = -2.85;
const COLORES = [0xe53935, 0x1e88e5, 0x43a047, 0xfdd835, 0x8e24aa, 0xfb8c00, 0xec407a, 0x00acc1];
const DORADO = 0xffc107;
const MENOS_Z = new THREE.Vector3(0, 0, -1);

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  ctx.fondo(0x1b1440);
  // Noche de feria: alejamos la niebla para que se vea la noria del fondo
  const niebla = ctx.escena.fog;
  const nieblaOriginal = { near: niebla.near, far: niebla.far };
  niebla.near = 14;
  niebla.far = 45;
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.6, 0.6), new THREE.Vector3(0, 1.55, TABLERO_Z));

  // ─── Utilidades de geometría ───────────────────────────────────────────
  const matrizTmp = new THREE.Matrix4();
  const eulerTmp = new THREE.Euler();
  function colocar(geo, x, y, z, rx = 0, ry = 0, rz = 0) {
    matrizTmp.makeRotationFromEuler(eulerTmp.set(rx, ry, rz)).setPosition(x, y, z);
    return geo.applyMatrix4(matrizTmp);
  }
  // Pinta una geometría de un color (atributo de color por vértice)
  function pintar(geo, color) {
    const c = new THREE.Color(color);
    const n = geo.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  }
  // Fusiona varias geometrías (position/normal/uv y color si lo tienen) en una:
  // una sola llamada de dibujo.
  function fusionar(geos) {
    const conColor = geos.every((g) => g.attributes.color);
    let nv = 0;
    let ni = 0;
    for (const g of geos) {
      nv += g.attributes.position.count;
      ni += g.index ? g.index.count : g.attributes.position.count;
    }
    const pos = new Float32Array(nv * 3);
    const nor = new Float32Array(nv * 3);
    const uv = new Float32Array(nv * 2);
    const col = conColor ? new Float32Array(nv * 3) : null;
    const indices = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let ov = 0;
    let oi = 0;
    for (const g of geos) {
      const n = g.attributes.position.count;
      pos.set(g.attributes.position.array, ov * 3);
      nor.set(g.attributes.normal.array, ov * 3);
      uv.set(g.attributes.uv.array, ov * 2);
      if (col) col.set(g.attributes.color.array, ov * 3);
      if (g.index) for (let i = 0; i < g.index.count; i++) indices[oi++] = g.index.array[i] + ov;
      else for (let i = 0; i < n; i++) indices[oi++] = ov + i;
      ov += n;
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    return R(geo);
  }

  // ─── Feria: suelo y noria del fondo ────────────────────────────────────
  ctx.sueloBase(false);
  const texCesped = R(ctx.texturas.cesped(0x3e7d3a, { repetir: [24, 24], tam: 256, semilla: 4 }));
  const suelo = new THREE.Mesh(R(new THREE.PlaneGeometry(60, 60)), R(new THREE.MeshLambertMaterial({ map: texCesped })));
  suelo.rotation.x = -Math.PI / 2;
  raiz.add(suelo);
  // Camino de tierra delante de la caseta
  const texTierra = R(ctx.texturas.grano(0x8a6a48, { repetir: [3, 6], tam: 256, semilla: 9 }));
  const camino = new THREE.Mesh(R(new THREE.PlaneGeometry(5, 10)), R(new THREE.MeshLambertMaterial({ map: texTierra })));
  camino.rotation.x = -Math.PI / 2;
  camino.position.set(0, 0.004, 2);
  raiz.add(camino);

  // Noria: aro, radios y cabinas en una malla que gira despacio
  const noria = new THREE.Group();
  noria.position.set(-11, 8.5, -22);
  const piezasNoria = [colocar(new THREE.TorusGeometry(7, 0.12, 6, 48), 0, 0, 0), colocar(new THREE.TorusGeometry(6.6, 0.07, 6, 48), 0, 0, 0)];
  for (let i = 0; i < 12; i++) {
    const a = (i / 12) * Math.PI * 2;
    piezasNoria.push(
      colocar(new THREE.BoxGeometry(0.08, 7, 0.08), Math.cos(a) * 3.5, Math.sin(a) * 3.5, 0, 0, 0, a - Math.PI / 2),
      colocar(new THREE.BoxGeometry(0.7, 0.6, 0.6), Math.cos(a) * 7, Math.sin(a) * 7 - 0.45, 0),
    );
  }
  const ruedaNoria = new THREE.Mesh(fusionar(piezasNoria), R(new THREE.MeshLambertMaterial({ color: 0x4a3f7a, emissive: 0x1a1240 })));
  noria.add(ruedaNoria);
  const pataNoria = new THREE.Mesh(
    fusionar([
      colocar(new THREE.BoxGeometry(0.25, 10, 0.25), -2.5, -4, 0.6, 0, 0, -0.27),
      colocar(new THREE.BoxGeometry(0.25, 10, 0.25), 2.5, -4, 0.6, 0, 0, 0.27),
    ]),
    R(new THREE.MeshLambertMaterial({ color: 0x3a3360 })),
  );
  noria.add(pataNoria);
  raiz.add(noria);

  // ─── Caseta ────────────────────────────────────────────────────────────
  // Madera pintada: paredes, panel bajo el tablero, marco y mostrador (una malla)
  const texMadera = R(ctx.texturas.madera(0xb07a4a, { tam: 256, semilla: 6 }));
  const fondoCaseta = TABLERO_Z - 0.1;
  const largoPared = CASETA_FRENTE - fondoCaseta;
  const madera = new THREE.Mesh(
    fusionar([
      // Paredes laterales
      colocar(new THREE.BoxGeometry(0.08, TECHO, largoPared), -PARED_X - 0.04, TECHO / 2, (fondoCaseta + CASETA_FRENTE) / 2),
      colocar(new THREE.BoxGeometry(0.08, TECHO, largoPared), PARED_X + 0.04, TECHO / 2, (fondoCaseta + CASETA_FRENTE) / 2),
      // Pared del fondo (tras el corcho)
      colocar(new THREE.BoxGeometry(PARED_X * 2, TECHO, 0.08), 0, TECHO / 2, fondoCaseta - 0.04),
      // Marco del tablero
      colocar(new THREE.BoxGeometry(3.5, 0.1, 0.08), 0, TABLERO_ARRIBA + 0.05, TABLERO_Z + 0.02),
      colocar(new THREE.BoxGeometry(3.5, 0.1, 0.08), 0, TABLERO_ABAJO - 0.05, TABLERO_Z + 0.02),
      colocar(new THREE.BoxGeometry(0.1, TABLERO_ARRIBA - TABLERO_ABAJO + 0.2, 0.08), -1.75, (TABLERO_ABAJO + TABLERO_ARRIBA) / 2, TABLERO_Z + 0.02),
      colocar(new THREE.BoxGeometry(0.1, TABLERO_ARRIBA - TABLERO_ABAJO + 0.2, 0.08), 1.75, (TABLERO_ABAJO + TABLERO_ARRIBA) / 2, TABLERO_Z + 0.02),
      // Mostrador con su tablero
      colocar(new THREE.BoxGeometry(PARED_X * 2 + 0.16, 0.9, 0.36), 0, 0.45, -0.65),
      colocar(new THREE.BoxGeometry(PARED_X * 2 + 0.3, 0.06, 0.48), 0, 0.93, -0.64),
    ]),
    R(new THREE.MeshLambertMaterial({ map: texMadera })),
  );
  raiz.add(madera);

  // Corcho del tablero
  const texCorcho = R(ctx.texturaCanvas((g, tam, azar) => {
    g.fillStyle = '#b98a57';
    g.fillRect(0, 0, tam, tam);
    for (let i = 0; i < 5000; i++) {
      const v = azar();
      g.fillStyle = v < 0.5 ? `rgba(90,55,25,${azar() * 0.35})` : `rgba(240,200,150,${azar() * 0.3})`;
      const r = 0.6 + azar() * 1.8;
      g.beginPath();
      g.arc(azar() * tam, azar() * tam, r, 0, Math.PI * 2);
      g.fill();
    }
  }, { tam: 256, repetir: [3, 2], semilla: 13 }));
  const corcho = new THREE.Mesh(
    R(new THREE.PlaneGeometry(3.4, TABLERO_ARRIBA - TABLERO_ABAJO)),
    R(new THREE.MeshLambertMaterial({ map: texCorcho })),
  );
  corcho.position.set(0, (TABLERO_ABAJO + TABLERO_ARRIBA) / 2, TABLERO_Z);
  raiz.add(corcho);

  // Toldo de rayas: techo y faldón delantero festoneado (alphaTest, sin transparencias)
  const texToldo = R(ctx.texturaCanvas((g, tam) => {
    const franjas = 8;
    for (let i = 0; i < franjas; i++) {
      g.fillStyle = i % 2 ? '#f4f1ea' : '#d32f2f';
      g.fillRect((i * tam) / franjas, 0, tam / franjas, tam);
    }
  }, { tam: 128, repetir: [3, 1] }));
  const texFaldon = R(ctx.texturaCanvas((g, tam) => {
    const franjas = 8;
    const ancho = tam / franjas;
    for (let i = 0; i < franjas; i++) {
      g.fillStyle = i % 2 ? '#f4f1ea' : '#d32f2f';
      g.fillRect(i * ancho, 0, ancho, tam * 0.7);
      g.beginPath();
      g.arc(i * ancho + ancho / 2, tam * 0.7, ancho / 2, 0, Math.PI);
      g.fill();
    }
    g.fillStyle = '#ffd54f';
    g.fillRect(0, tam * 0.08, tam, tam * 0.06);
  }, { tam: 256, repetir: [3, 1] }));
  const matToldo = R(new THREE.MeshLambertMaterial({ map: texToldo, side: THREE.DoubleSide }));
  const techo = new THREE.Mesh(R(new THREE.PlaneGeometry(PARED_X * 2 + 0.2, largoPared + 0.3)), matToldo);
  techo.rotation.x = Math.PI / 2;
  techo.position.set(0, TECHO, (fondoCaseta + CASETA_FRENTE) / 2 + 0.15);
  raiz.add(techo);
  const faldon = new THREE.Mesh(
    R(new THREE.PlaneGeometry(PARED_X * 2 + 0.2, 0.55)),
    R(new THREE.MeshLambertMaterial({ map: texFaldon, side: THREE.DoubleSide, alphaTest: 0.5, transparent: false })),
  );
  faldon.position.set(0, TECHO - 0.27, CASETA_FRENTE + 0.02);
  raiz.add(faldon);

  // Guirnalda de bombillas bajo el faldón (parpadean por turnos)
  const NUM_BOMBILLAS = 17;
  const bombillas = new THREE.InstancedMesh(
    R(new THREE.SphereGeometry(0.03, 8, 6)),
    R(new THREE.MeshBasicMaterial({ color: 0xffffff })),
    NUM_BOMBILLAS,
  );
  const coloresBombilla = [new THREE.Color(0xffe082), new THREE.Color(0xff8a65), new THREE.Color(0x80deea)];
  const apagada = new THREE.Color(0x5a4a30);
  const objTmp = new THREE.Object3D();
  for (let i = 0; i < NUM_BOMBILLAS; i++) {
    const u = i / (NUM_BOMBILLAS - 1);
    const x = -PARED_X + u * PARED_X * 2;
    const comba = Math.sin(((u * 4) % 1) * Math.PI) * 0.08;
    objTmp.position.set(x, TECHO - 0.6 - comba, CASETA_FRENTE + 0.05);
    objTmp.updateMatrix();
    bombillas.setMatrixAt(i, objTmp.matrix);
    bombillas.setColorAt(i, coloresBombilla[i % 3]);
  }
  raiz.add(bombillas);

  // Soportes de la bandeja de dardos (VR)
  const bandeja = new THREE.Mesh(
    fusionar(PUESTOS_VR.map((p) => colocar(new THREE.BoxGeometry(0.1, 0.04, 0.22), p.x, 0.98, p.z))),
    R(new THREE.MeshLambertMaterial({ color: 0x37474f })),
  );
  raiz.add(bandeja);

  // ─── Globos (una sola malla instanciada) ───────────────────────────────
  const geoGlobo = fusionar([
    new THREE.SphereGeometry(1, 20, 14).scale(RX, RY, RX),
    colocar(new THREE.ConeGeometry(0.022, 0.035, 8), 0, -RY - 0.012, 0),
  ]);
  const matGlobo = R(new THREE.MeshStandardMaterial({ roughness: 0.28, metalness: 0.05 }));
  const globos = [];
  // Rejilla del tablero
  for (let f = 0; f < FILAS; f++) {
    for (let c = 0; c < COLUMNAS; c++) {
      globos.push({ tipo: 'fijo', base: new THREE.Vector3(-1.38 + c * 0.46, 1.0 + f * 0.47, TABLERO_Z + RX + 0.02) });
    }
  }
  for (let k = 0; k < CARRILES.length; k++) {
    for (let i = 0; i < POR_CARRIL; i++) globos.push({ tipo: 'cruza', carril: k });
  }
  for (let i = 0; i < MAX_SUBEN; i++) globos.push({ tipo: 'sube' });
  for (const g of globos) {
    Object.assign(g, {
      vivo: false, espera: 0, inflado: 0, valor: 1, dorado: false,
      pos: new THREE.Vector3(), vel: new THREE.Vector3(), fase: Math.random() * 10, color: new THREE.Color(),
    });
  }
  const instGlobos = new THREE.InstancedMesh(geoGlobo, matGlobo, globos.length);
  instGlobos.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  instGlobos.frustumCulled = false;
  for (let i = 0; i < globos.length; i++) instGlobos.setColorAt(i, globos[i].color);
  raiz.add(instGlobos);

  // Cuerdas de los globos (segmentos que se recalculan cada fotograma)
  const posCuerdas = new Float32Array(globos.length * 2 * 3 * 2); // dos tramos por globo
  const geoCuerdas = R(new THREE.BufferGeometry());
  geoCuerdas.setAttribute('position', new THREE.BufferAttribute(posCuerdas, 3).setUsage(THREE.DynamicDrawUsage));
  const cuerdas = new THREE.LineSegments(geoCuerdas, R(new THREE.LineBasicMaterial({ color: 0xeeeeee })));
  cuerdas.frustumCulled = false;
  raiz.add(cuerdas);

  // Sombras de mancha de los globos que se mueven y de los dardos en vuelo
  const sombras = Array.from({ length: 10 }, () => {
    const s = ctx.crearSombra({ radio: 0.12, opacidad: 0.4 });
    s.visible = false;
    raiz.add(s);
    return s;
  });

  // Trozos de goma al reventar (instanciados)
  const MAX_TROZOS = 64;
  const trozos = new THREE.InstancedMesh(
    R(new THREE.PlaneGeometry(0.06, 0.045)),
    R(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide })),
    MAX_TROZOS,
  );
  trozos.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  trozos.frustumCulled = false;
  const datosTrozos = Array.from({ length: MAX_TROZOS }, () => ({
    vida: 0, pos: new THREE.Vector3(), vel: new THREE.Vector3(), giro: new THREE.Euler(), vgiro: new THREE.Vector3(),
  }));
  for (let i = 0; i < MAX_TROZOS; i++) trozos.setColorAt(i, apagada);
  raiz.add(trozos);
  let siguienteTrozo = 0;

  // ─── Dardos ────────────────────────────────────────────────────────────
  // Apuntan hacia -Z: punta metálica, cuerpo, varilla y aletas de color.
  function geoDardo(colorAletas) {
    const aleta1 = new THREE.PlaneGeometry(0.06, 0.045);
    aleta1.rotateY(Math.PI / 2);
    const aleta2 = aleta1.clone().rotateZ(Math.PI / 2);
    return fusionar([
      pintar(colocar(new THREE.ConeGeometry(0.006, 0.05, 8), 0, 0, -0.11, -Math.PI / 2), 0xdfe3e6),
      pintar(colocar(new THREE.CylinderGeometry(0.008, 0.006, 0.07, 10), 0, 0, -0.05, -Math.PI / 2), 0x8d6e63),
      pintar(colocar(new THREE.CylinderGeometry(0.0035, 0.0035, 0.08, 6), 0, 0, 0.02, -Math.PI / 2), 0x263238),
      pintar(aleta1.translate(0, 0, 0.055), colorAletas),
      pintar(aleta2.translate(0, 0, 0.055), colorAletas),
    ]);
  }
  const geosDardo = [0xe53935, 0x1e88e5, 0x43a047, 0xfdd835].map(geoDardo);
  const matDardo = R(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.45, roughness: 0.4, side: THREE.DoubleSide }));
  let colorDardo = 0;
  function crearDardo() {
    const malla = new THREE.Mesh(geosDardo[colorDardo++ % geosDardo.length], matDardo);
    raiz.add(malla);
    return malla;
  }

  const enVuelo = [];   // { malla, vel, vida, reventados }
  const clavados = [];  // mallas clavadas en la caseta o en el suelo

  const puestos = PUESTOS_VR.map((pos) => ({ pos, dardo: null, recarga: 0 }));

  // Manos visibles en VR
  const geoMano = R(new THREE.SphereGeometry(0.045, 12, 8));
  geoMano.scale(1, 0.6, 1.3);
  const matMano = R(new THREE.MeshLambertMaterial({ color: 0xffcc80 }));
  const manos = ctx.manos.map((mano) => {
    ctx.adjuntarAMano(mano, new THREE.Mesh(geoMano, matMano));
    return { mano, dardo: null, historial: [], apretonAntes: false };
  });

  // Dardo preparado en la "mano" del ratón
  const dardoRaton = new THREE.Mesh(geosDardo[0], matDardo);
  dardoRaton.position.copy(MANO_RATON);
  raiz.add(dardoRaton);
  let recargaRaton = 0;

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.6, alto: 0.4 });
  marcador.mesh.position.set(0, TABLERO_ARRIBA + 0.36, TABLERO_Z + 0.03);
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let puntos = 0;
  let reventados = 0;
  let lanzamientos = 0;
  let aciertos = 0;
  let record = ctx.leer('record', 0);
  let estado = 'intro'; // 'intro' | 'jugando' | 'fin'
  let reloj = 3;
  let tiempoRestante = DURACION;
  let mensaje = '';
  let tiempoMensaje = 0;
  let esperaSube = 2;

  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const punta = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const quatTmp = new THREE.Quaternion();

  function actualizarMarcador() {
    if (estado === 'intro') {
      marcador.escribir([
        { texto: 'PINCHA GLOBOS', tam: 1.3, color: '#ffab40' },
        {
          texto: ctx.enVR()
            ? 'Coge un dardo del mostrador y lánzalo'
            : ctx.tactil ? 'Toca un globo para lanzarle un dardo' : 'Haz clic en un globo para lanzarle un dardo',
          tam: 0.7,
        },
      ]);
    } else if (estado === 'fin') {
      const punteria = lanzamientos ? Math.round((aciertos / lanzamientos) * 100) : 0;
      marcador.escribir([
        { texto: `¡Tiempo! ${puntos} puntos`, tam: 1.3, color: '#ffab40' },
        { texto: `${reventados} globos · puntería ${punteria}% · Récord: ${record} · otra en ${Math.ceil(reloj)}`, tam: 0.7 },
      ]);
    } else {
      marcador.escribir([
        { texto: `Puntos: ${puntos}   ·   ${Math.ceil(tiempoRestante)} s`, tam: 1.3 },
        tiempoMensaje > 0
          ? { texto: mensaje, tam: 0.7, color: '#fff59d' }
          : { texto: `Récord: ${record}   ·   se mueven +2   ·   dorado +5`, tam: 0.7, color: '#ffab40' },
      ]);
    }
  }

  function avisar(texto) {
    mensaje = texto;
    tiempoMensaje = 1.3;
  }

  // ─── Globos: aparecer, moverse y reventar ──────────────────────────────
  function colorAlAzar(g) {
    g.color.set(COLORES[Math.floor(Math.random() * COLORES.length)]);
  }

  function nacer(g) {
    g.vivo = true;
    g.inflado = 0;
    g.dorado = false;
    colorAlAzar(g);
    if (g.tipo === 'fijo') {
      g.valor = 1;
      g.pos.copy(g.base);
      g.vel.set(0, 0, 0);
    } else if (g.tipo === 'cruza') {
      const carril = CARRILES[g.carril];
      const sentido = g.carril % 2 ? -1 : 1;
      g.valor = 2;
      g.pos.set(-sentido * (PARED_X + 0.3), carril.y, carril.z);
      g.vel.set(sentido * (0.55 + Math.random() * 0.5), 0, 0);
      g.inflado = 1;
    } else {
      g.dorado = Math.random() < 0.4;
      g.valor = g.dorado ? 5 : 2;
      if (g.dorado) g.color.set(DORADO);
      g.pos.set((Math.random() * 2 - 1) * 1.35, 0.55, SUBEN_Z);
      g.vel.set(0, 0.4 + Math.random() * 0.25 + (g.dorado ? 0.15 : 0), 0);
    }
  }

  function preparar() {
    for (const g of globos) {
      g.vivo = false;
      g.espera = 0;
      if (g.tipo === 'fijo') {
        // Tablero casi lleno al empezar
        if (Math.random() < 0.85) {
          nacer(g);
          g.inflado = 1;
        } else g.espera = 1 + Math.random() * 2;
      } else if (g.tipo === 'cruza') {
        // Repartidos a lo largo del carril, cada uno a su velocidad
        nacer(g);
        const i = globos.filter((o) => o.tipo === 'cruza' && o.carril === g.carril).indexOf(g);
        g.pos.x = -PARED_X + ((i + Math.random() * 0.5) / POR_CARRIL) * PARED_X * 2;
      }
    }
    esperaSube = 2;
  }

  function reventar(g, dardo) {
    g.vivo = false;
    g.espera = g.tipo === 'fijo' ? 2 + Math.random() * 2 : g.tipo === 'cruza' ? 1 + Math.random() * 1.5 : 0;
    ctx.sonido('globo');
    // Trozos de goma
    for (let k = 0; k < 8; k++) {
      const d = datosTrozos[siguienteTrozo];
      trozos.setColorAt(siguienteTrozo, g.color);
      siguienteTrozo = (siguienteTrozo + 1) % MAX_TROZOS;
      d.vida = 0.55 + Math.random() * 0.25;
      d.pos.copy(g.pos);
      d.vel.set(Math.random() * 2 - 1, Math.random() * 2 - 0.6, Math.random() * 2 - 1).normalize().multiplyScalar(1.2 + Math.random() * 1.6);
      d.giro.set(Math.random() * 6, Math.random() * 6, 0);
      d.vgiro.set(Math.random() * 20 - 10, Math.random() * 20 - 10, Math.random() * 20 - 10);
    }
    trozos.instanceColor.needsUpdate = true;
    if (estado !== 'jugando') return;
    reventados += 1;
    let valor = g.valor;
    if (dardo) {
      dardo.reventados += 1;
      if (dardo.reventados === 1) aciertos += 1;
      if (dardo.reventados >= 2) valor += 2;
    }
    puntos += valor;
    ctx.sonido('punto');
    for (const m of ctx.manos) ctx.vibrar(m, 0.35, 50);
    if (dardo && dardo.reventados >= 2) avisar(`¡${dardo.reventados} de un dardo! +${valor}`);
    else if (g.dorado) avisar(`¡Dorado! +${valor}`);
    else if (g.tipo !== 'fijo') avisar(`¡En movimiento! +${valor}`);
    else avisar(`+${valor}`);
  }

  function moverGlobos(dt, t) {
    esperaSube -= dt;
    for (const g of globos) {
      if (!g.vivo) {
        if (g.tipo === 'sube') continue;
        g.espera -= dt;
        if (g.espera <= 0) nacer(g);
        continue;
      }
      g.inflado = Math.min(1, g.inflado + dt * 3);
      if (g.tipo === 'fijo') {
        // Se mecen un poco sobre su chincheta
        g.pos.x = g.base.x + Math.sin(t * 1.3 + g.fase) * 0.012;
        g.pos.y = g.base.y + Math.sin(t * 1.7 + g.fase) * 0.008;
      } else if (g.tipo === 'cruza') {
        g.pos.x += g.vel.x * dt;
        g.pos.y = CARRILES[g.carril].y + Math.sin(t * 2 + g.fase) * 0.05;
        // Al salir por un lado vuelve a entrar por el otro (escondido tras las paredes)
        if (Math.abs(g.pos.x) > PARED_X + 0.35) nacer(g);
      } else {
        g.pos.y += g.vel.y * dt;
        g.pos.x += Math.sin(t * 1.4 + g.fase) * 0.12 * dt;
        if (g.pos.y > TECHO - 0.15) g.vivo = false; // se pierde bajo el toldo
      }
    }
    // De vez en cuando sube un globo desde abajo
    if (esperaSube <= 0) {
      esperaSube = 2.5 + Math.random() * 2.5;
      const libre = globos.find((g) => g.tipo === 'sube' && !g.vivo);
      if (libre) nacer(libre);
    }
  }

  function punto(c, x, y, z) {
    posCuerdas[c] = x;
    posCuerdas[c + 1] = y;
    posCuerdas[c + 2] = z;
    return c + 3;
  }

  function dibujarGlobos(t) {
    let c = 0;
    for (let i = 0; i < globos.length; i++) {
      const g = globos[i];
      const e = g.vivo ? 0.05 + 0.95 * g.inflado : 0;
      objTmp.position.copy(g.pos);
      objTmp.rotation.set(0, 0, Math.sin(t * 1.5 + g.fase) * 0.08);
      objTmp.scale.setScalar(Math.max(e, 1e-4));
      objTmp.updateMatrix();
      instGlobos.setMatrixAt(i, objTmp.matrix);
      instGlobos.setColorAt(i, g.color);
      // Cuerda: del nudo hacia abajo (en el tablero, hasta la chincheta)
      const x0 = g.pos.x;
      const y0 = g.pos.y - (RY + 0.03) * e;
      const z0 = g.pos.z;
      let x1 = x0;
      let y1 = y0;
      let z1 = z0;
      let x2 = x0;
      let y2 = y0;
      let z2 = z0;
      if (g.vivo) {
        if (g.tipo === 'fijo') {
          x1 = (x0 + g.base.x) / 2;
          y1 = y0 - 0.06;
          z1 = (z0 + TABLERO_Z) / 2;
          x2 = g.base.x;
          y2 = g.base.y - RY - 0.1;
          z2 = TABLERO_Z + 0.005;
        } else {
          const vaiven = Math.sin(t * 3 + g.fase) * 0.03;
          x1 = x0 + vaiven - g.vel.x * 0.04;
          y1 = y0 - 0.15;
          x2 = x0 - vaiven - g.vel.x * 0.1;
          y2 = y0 - 0.32;
        }
      }
      c = punto(c, x0, y0, z0);
      c = punto(c, x1, y1, z1);
      c = punto(c, x1, y1, z1);
      c = punto(c, x2, y2, z2);
    }
    instGlobos.instanceMatrix.needsUpdate = true;
    instGlobos.instanceColor.needsUpdate = true;
    geoCuerdas.attributes.position.needsUpdate = true;
  }

  function moverTrozos(dt) {
    for (let i = 0; i < MAX_TROZOS; i++) {
      const d = datosTrozos[i];
      if (d.vida > 0) {
        d.vida -= dt;
        d.vel.y -= 5 * dt;
        d.vel.multiplyScalar(1 - 2 * dt);
        d.pos.addScaledVector(d.vel, dt);
        d.giro.x += d.vgiro.x * dt;
        d.giro.y += d.vgiro.y * dt;
        d.giro.z += d.vgiro.z * dt;
      }
      objTmp.position.copy(d.pos);
      objTmp.rotation.copy(d.giro);
      objTmp.scale.setScalar(d.vida > 0 ? Math.min(1, d.vida * 3) : 1e-4);
      objTmp.updateMatrix();
      trozos.setMatrixAt(i, objTmp.matrix);
    }
    trozos.instanceMatrix.needsUpdate = true;
  }

  // ─── Vuelo de los dardos ───────────────────────────────────────────────
  function lanzar(malla, vel) {
    if (estado === 'jugando') lanzamientos += 1;
    ctx.sonido('zas');
    enVuelo.push({ malla, vel: vel.clone(), vida: 4, reventados: 0 });
  }

  function clavar(d, sonido) {
    d.malla.quaternion.setFromUnitVectors(MENOS_Z, dir);
    if (sonido) ctx.sonido('dardo');
    clavados.push(d.malla);
    while (clavados.length > MAX_CLAVADOS) raiz.remove(clavados.shift());
  }

  // Devuelve true si el dardo ha dejado de volar
  function moverDardo(d, dt) {
    const pos = d.malla.position;
    const pasos = Math.max(1, Math.ceil((d.vel.length() * dt) / 0.03));
    const h = dt / pasos;
    for (let i = 0; i < pasos; i++) {
      d.vel.y -= G * h;
      pos.addScaledVector(d.vel, h);
      dir.copy(d.vel).normalize();
      punta.copy(pos).addScaledVector(dir, LARGO_PUNTA);

      // Globos
      for (const g of globos) {
        if (!g.vivo || g.inflado < 0.5) continue;
        const dx = (punta.x - g.pos.x) / RX;
        const dy = (punta.y - g.pos.y) / RY;
        const dz = (punta.z - g.pos.z) / RX;
        if (dx * dx + dy * dy + dz * dz < 1.1) {
          reventar(g, d);
          d.vel.multiplyScalar(0.92);
        }
      }

      // Caseta: corcho y pared del fondo, paredes laterales y toldo
      const dentro = punta.z < CASETA_FRENTE && punta.z > fondoCaseta - 0.2;
      if (punta.z <= TABLERO_Z && Math.abs(punta.x) < PARED_X) {
        // La punta queda hundida 1,5 cm en el corcho
        if (dir.z < -0.05) pos.addScaledVector(dir, (TABLERO_Z - 0.015 - punta.z) / dir.z);
        clavar(d, true);
        return true;
      }
      if (dentro && (Math.abs(punta.x) >= PARED_X || punta.y >= TECHO)) {
        clavar(d, true);
        return true;
      }
      // Mostrador y suelo
      const enMostrador = punta.y <= 0.96 && punta.z < -0.4 && punta.z > -0.88 && Math.abs(punta.x) < PARED_X + 0.15;
      if (enMostrador || punta.y <= 0.01) {
        clavar(d, false);
        return true;
      }
    }
    d.malla.quaternion.setFromUnitVectors(MENOS_Z, dir);
    d.vida -= dt;
    if (d.vida <= 0) {
      raiz.remove(d.malla);
      return true;
    }
    return false;
  }

  // Velocidad para que un dardo lanzado desde "origen" pase por "objetivo" en un tiempo t
  function velocidadHacia(origen, objetivo, t, salida) {
    return salida.subVectors(objetivo, origen).divideScalar(t).setY((objetivo.y - origen.y) / t + 0.5 * G * t);
  }

  // Dónde estará un globo dentro de t segundos (para apuntar a los que se mueven)
  function posicionFutura(g, t, salida) {
    salida.copy(g.pos).addScaledVector(g.vel, t);
    if (g.tipo === 'cruza') salida.y = CARRILES[g.carril].y;
    return salida;
  }

  // Corrige un buen lanzamiento VR hacia el globo al que se apuntaba
  function ayudar(origen, vel) {
    const rapidez = vel.length();
    if (rapidez < 2) return vel;
    let mejor = null;
    let mejorAngulo = ANGULO_AYUDA;
    const ideal = new THREE.Vector3();
    const objetivo = new THREE.Vector3();
    for (const g of globos) {
      if (!g.vivo || g.inflado < 0.5) continue;
      const t = g.pos.distanceTo(origen) / rapidez;
      velocidadHacia(origen, posicionFutura(g, t, objetivo), t, tmp2);
      const angulo = tmp2.angleTo(vel);
      if (angulo < mejorAngulo) {
        mejorAngulo = angulo;
        mejor = g;
        ideal.copy(tmp2);
      }
    }
    if (mejor) vel.lerp(ideal, AYUDA);
    return vel;
  }

  // ─── Bandeja (VR) ──────────────────────────────────────────────────────
  function actualizarPuestos(dt) {
    const vr = ctx.enVR();
    for (const p of puestos) {
      if (!vr) {
        if (p.dardo) {
          raiz.remove(p.dardo);
          p.dardo = null;
        }
        continue;
      }
      if (!p.dardo) {
        p.recarga -= dt;
        if (p.recarga <= 0) {
          p.dardo = crearDardo();
          p.dardo.position.copy(p.pos);
          p.dardo.rotation.set(0.12, 0, 0);
        }
      }
    }
  }

  // ─── Manos VR ──────────────────────────────────────────────────────────
  function velocidadMano(m) {
    // Media de los últimos ~80 ms para que el lanzamiento no dependa de un solo fotograma
    const h = m.historial;
    let tiempo = 0;
    let i = h.length - 1;
    while (i > 0 && tiempo < 0.08) {
      tiempo += h[i].dt;
      i--;
    }
    if (tiempo <= 0) return new THREE.Vector3();
    return h[h.length - 1].pos.clone().sub(h[i].pos).divideScalar(tiempo);
  }

  function manosVR(dt) {
    for (const m of manos) {
      const mano = m.mano;
      if (!mano.activa) {
        if (m.dardo) {
          raiz.remove(m.dardo);
          m.dardo = null;
        }
        m.historial.length = 0;
        continue;
      }
      m.historial.push({ pos: mano.posicion.clone(), dt });
      if (m.historial.length > 12) m.historial.shift();

      const apretonPulsado = mano.apreton && !m.apretonAntes;
      m.apretonAntes = mano.apreton;

      if (!m.dardo && (mano.gatilloPulsado || apretonPulsado)) {
        let mejor = null;
        let distancia = ALCANCE_AGARRE;
        for (const p of puestos) {
          if (!p.dardo) continue;
          const d = p.dardo.position.distanceTo(mano.posicion);
          if (d < distancia) {
            distancia = d;
            mejor = p;
          }
        }
        if (mejor) {
          m.dardo = mejor.dardo;
          mejor.dardo = null;
          mejor.recarga = 0.3;
          ctx.vibrar(mano, 0.3, 30);
        }
      }

      if (m.dardo) {
        // El dardo apunta hacia delante del mando
        mano.grip.localToWorld(m.dardo.position.set(0, -0.01, -0.06));
        mano.grip.getWorldQuaternion(quatTmp);
        m.dardo.quaternion.copy(quatTmp);
        if (!mano.gatillo && !mano.apreton) {
          const vel = velocidadMano(m).multiplyScalar(FUERZA_VR);
          lanzar(m.dardo, ayudar(m.dardo.position, vel));
          m.dardo = null;
        }
      }
    }
  }

  // ─── Ratón y pantalla táctil ───────────────────────────────────────────
  // Primer globo que atraviesa el rayo (aproximado como esfera)
  function globoBajoRayo(rayo) {
    let mejor = null;
    let distancia = Infinity;
    for (const g of globos) {
      if (!g.vivo || g.inflado < 0.5) continue;
      const d = rayo.distanceSqToPoint(g.pos);
      if (d < RY * RY * 1.1) {
        const lejos = tmp.subVectors(g.pos, rayo.origin).dot(rayo.direction);
        if (lejos > 0 && lejos < distancia) {
          distancia = lejos;
          mejor = g;
        }
      }
    }
    return mejor;
  }

  const objetivoRaton = new THREE.Vector3();
  function raton(dt) {
    const r = ctx.raton;
    const rayo = r.rayo.ray;
    recargaRaton -= dt;
    dardoRaton.visible = true;
    dardoRaton.scale.setScalar(recargaRaton > 0 ? 1e-4 : Math.min(1, -recargaRaton * 6));

    // A dónde apunta: el globo bajo el cursor o el punto del tablero
    const g = globoBajoRayo(rayo);
    if (g) {
      const t = g.pos.distanceTo(MANO_RATON) / V_RATON;
      posicionFutura(g, t, objetivoRaton);
    } else if (rayo.direction.z < -0.05) {
      rayo.at((TABLERO_Z - rayo.origin.z) / rayo.direction.z, objetivoRaton);
    } else {
      rayo.at(6, objetivoRaton);
    }
    dir.subVectors(objetivoRaton, MANO_RATON).normalize();
    dardoRaton.quaternion.setFromUnitVectors(MENOS_Z, dir);

    if (r.clic && recargaRaton <= 0) {
      const t = objetivoRaton.distanceTo(MANO_RATON) / V_RATON;
      const malla = crearDardo();
      malla.position.copy(MANO_RATON);
      malla.quaternion.copy(dardoRaton.quaternion);
      lanzar(malla, velocidadHacia(MANO_RATON, objetivoRaton, t, tmp2));
      recargaRaton = RECARGA_RATON;
    }
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function empezar() {
    estado = 'jugando';
    puntos = 0;
    reventados = 0;
    lanzamientos = 0;
    aciertos = 0;
    tiempoRestante = DURACION;
    for (const m of clavados) raiz.remove(m);
    clavados.length = 0;
    preparar();
  }

  function actualizar(dt, t) {
    reloj -= dt;
    tiempoMensaje -= dt;

    if (estado === 'intro' && reloj <= 0) {
      empezar();
    } else if (estado === 'jugando') {
      tiempoRestante -= dt;
      if (tiempoRestante <= 0) {
        estado = 'fin';
        reloj = 6;
        if (puntos > record) {
          record = puntos;
          ctx.guardar('record', record);
        }
        ctx.sonido('fin');
      }
    } else if (estado === 'fin' && reloj <= 0) {
      empezar();
    }

    actualizarPuestos(dt);
    if (ctx.enVR()) {
      dardoRaton.visible = false;
      manosVR(dt);
    } else {
      raton(dt);
    }

    moverGlobos(dt, t);
    for (let i = enVuelo.length - 1; i >= 0; i--) {
      if (moverDardo(enVuelo[i], dt)) enVuelo.splice(i, 1);
    }
    dibujarGlobos(t);
    moverTrozos(dt);

    // Bombillas que se encienden por turnos
    const turno = Math.floor(t * 3) % 3;
    for (let i = 0; i < NUM_BOMBILLAS; i++) bombillas.setColorAt(i, i % 3 === turno ? apagada : coloresBombilla[i % 3]);
    bombillas.instanceColor.needsUpdate = true;
    ruedaNoria.rotation.z = t * 0.08;

    colocarSombras();
    actualizarMarcador();
  }

  // ─── Sombras ───────────────────────────────────────────────────────────
  function colocarSombras() {
    let n = 0;
    for (const g of globos) {
      if (n >= sombras.length) break;
      if (g.vivo && g.tipo !== 'fijo') ctx.colocarSombra(sombras[n++], g.pos, 0);
    }
    for (const d of enVuelo) {
      if (n >= sombras.length) break;
      ctx.colocarSombra(sombras[n++], d.malla.position, 0);
    }
    for (let i = n; i < sombras.length; i++) sombras[i].visible = false;
  }

  preparar();
  dibujarGlobos(0);
  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      niebla.near = nieblaOriginal.near;
      niebla.far = nieblaOriginal.far;
      enVuelo.length = 0;
      clavados.length = 0;
    },
  };
}
