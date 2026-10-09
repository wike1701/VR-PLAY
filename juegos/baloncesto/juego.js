// TIRO A CANASTA
// Tiros libres sin moverte del sitio. En VR coges un balón de los soportes que
// tienes delante (gatillo o botón lateral) y lo lanzas con el brazo. Sin gafas:
// apunta con el ratón, mantén pulsado y suelta cuando la barra de fuerza esté
// en la marca verde. Rondas de 60 segundos.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const DURACION = 60;
const G = 9.8;
const RADIO_BALON = 0.12;
const ARO = new THREE.Vector3(0, 3.05, -3.4);   // centro del aro (altura reglamentaria, algo más cerca que un tiro libre real)
const RADIO_ARO = 0.23;
const GROSOR_ARO = 0.012;
const TABLERO_Z = ARO.z - RADIO_ARO - 0.15;     // cara delantera del tablero
const TABLERO_ANCHO = 1.8;
const TABLERO_ABAJO = 2.9;
const TABLERO_ARRIBA = 3.95;
const ALCANCE_AGARRE = 0.22;
const FUERZA_VR = 1.1;        // los lanzamientos en VR suelen quedarse cortos
const AYUDA = 0.35;           // cuánto se corrige un buen lanzamiento en VR hacia la canasta (0 = nada)
const V_MIN = 5.5;            // fuerza mínima y máxima del lanzamiento con ratón
const V_MAX = 10.5;
const ANGULO_RATON = THREE.MathUtils.degToRad(52);
// Soportes de balones: dos en VR (uno para cada mano) y uno para el ratón
const PUESTOS_VR = [new THREE.Vector3(-0.28, 1.0, -0.35), new THREE.Vector3(0.28, 1.0, -0.35)];
const PUESTO_RATON = new THREE.Vector3(0, 1.3, -0.35);

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  ctx.fondo(0x1f1a2e);
  // Pabellón cerrado: alejamos la niebla para que se vean las paredes y las gradas
  const niebla = ctx.escena.fog;
  const nieblaOriginal = { near: niebla.near, far: niebla.far };
  niebla.near = 11;
  niebla.far = 30;
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.6, 0.7), new THREE.Vector3(0, 2.6, ARO.z));

  // ─── Utilidades de geometría ───────────────────────────────────────────
  // Coloca una geometría en su sitio (rotación y posición "horneadas").
  const matrizTmp = new THREE.Matrix4();
  const eulerTmp = new THREE.Euler();
  function colocar(geo, x, y, z, rx = 0, ry = 0, rz = 0) {
    matrizTmp.makeRotationFromEuler(eulerTmp.set(rx, ry, rz)).setPosition(x, y, z);
    return geo.applyMatrix4(matrizTmp);
  }
  // UV a partir de la posición en el mundo (1 unidad de UV = "metros" metros), para
  // que la textura tenga la misma escala en todas las piezas.
  function uvMundo(geo, ejeU, ejeV, metros = 1) {
    const p = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, ejeU(p, i) / metros, ejeV(p, i) / metros);
    return geo;
  }
  const menosZ = (p, i) => -p.getZ(i);
  const masX = (p, i) => p.getX(i);
  const masY = (p, i) => p.getY(i);
  // Fusiona varias geometrías (position/normal/uv) en una: una sola llamada de dibujo.
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

  // ─── Pabellón ──────────────────────────────────────────────────────────
  ctx.sueloBase(false);
  const SALA_X = 9;          // paredes laterales en ±9 m
  const SALA_FONDO = -9.5;   // pared del fondo (detrás de la canasta)
  const SALA_FRENTE = 4.5;   // pared detrás del jugador
  const SALA_ALTO = 7;
  const LINEA_FONDO = ARO.z - 1.1;  // línea de fondo pintada
  const LIBRE_Z = -0.15;     // línea de tiro libre

  // Parquet: tablas de ~12 cm a lo largo de la pista (hacia la canasta)
  const texParquet = R(ctx.texturas.tablas(0xc8935a, { tablas: 8, tam: 512, semilla: 7 }));
  const geoParquet = colocar(new THREE.PlaneGeometry(SALA_X * 2, SALA_FRENTE - SALA_FONDO), 0, 0.003, (SALA_FRENTE + SALA_FONDO) / 2, -Math.PI / 2);
  raiz.add(new THREE.Mesh(uvMundo(R(geoParquet), menosZ, masX), R(new THREE.MeshLambertMaterial({ map: texParquet }))));
  // Zona pintada sobre la misma madera (se siguen viendo las tablas)
  const geoZona = colocar(new THREE.PlaneGeometry(3.6, LIBRE_Z - LINEA_FONDO), 0, 0.005, (LINEA_FONDO + LIBRE_Z) / 2, -Math.PI / 2);
  raiz.add(new THREE.Mesh(uvMundo(R(geoZona), menosZ, masX), R(new THREE.MeshLambertMaterial({ map: texParquet, color: 0xd8707a }))));

  // Líneas de la pista, todas en una malla
  const GROSOR_LINEA = 0.05;
  const linea = (ancho, largo, x, z) => colocar(new THREE.PlaneGeometry(ancho, largo), x, 0.007, z, -Math.PI / 2);
  const anguloTriple = Math.acos(6.6 / 6.75);
  const zTriple = ARO.z + 6.75 * Math.sin(anguloTriple);
  const lineas = new THREE.Mesh(
    fusionar([
      linea(3.6, GROSOR_LINEA, 0, LIBRE_Z),                                             // tiro libre
      linea(GROSOR_LINEA, LIBRE_Z - LINEA_FONDO, -1.8, (LINEA_FONDO + LIBRE_Z) / 2),   // lados de la zona
      linea(GROSOR_LINEA, LIBRE_Z - LINEA_FONDO, 1.8, (LINEA_FONDO + LIBRE_Z) / 2),
      linea(SALA_X * 2, GROSOR_LINEA, 0, LINEA_FONDO),                                 // fondo
      linea(GROSOR_LINEA, zTriple - LINEA_FONDO, -6.6, (zTriple + LINEA_FONDO) / 2),   // triple
      linea(GROSOR_LINEA, zTriple - LINEA_FONDO, 6.6, (zTriple + LINEA_FONDO) / 2),
      colocar(new THREE.RingGeometry(1.8 - GROSOR_LINEA / 2, 1.8 + GROSOR_LINEA / 2, 40, 1, Math.PI, Math.PI), 0, 0.007, LIBRE_Z, -Math.PI / 2),
      colocar(new THREE.RingGeometry(6.75 - GROSOR_LINEA / 2, 6.75 + GROSOR_LINEA / 2, 72, 1, Math.PI + anguloTriple, Math.PI - 2 * anguloTriple), ARO.x, 0.007, ARO.z, -Math.PI / 2),
    ]),
    R(new THREE.MeshBasicMaterial({ color: 0xf2f2f2 })),
  );
  raiz.add(lineas);

  // Paredes: bloque pintado con un zócalo de color (una sola malla)
  const texPared = R(ctx.texturaCanvas((g, tam, azar) => {
    const filas = 32;
    const columnas = 8;
    const fila = tam / filas;
    const col = tam / columnas;
    g.fillStyle = '#3a3646';
    g.fillRect(0, 0, tam, tam);
    for (let f = 0; f < filas; f++) {
      const desfase = f % 2 ? col / 2 : 0;
      for (let k = -1; k <= columnas; k++) {
        const v = 108 + azar() * 16;
        g.fillStyle = `rgb(${v + 4},${v},${v + 16})`;
        g.fillRect(k * col + desfase + 1, f * fila + 1, col - 2, fila - 1.5);
      }
    }
    // Zócalo de 1,2 m (abajo del canvas = suelo) con una franja naranja
    const zocalo = tam * (1.2 / SALA_ALTO);
    g.fillStyle = '#2a4aa8';
    g.fillRect(0, tam - zocalo, tam, zocalo);
    g.fillStyle = '#ff7a2a';
    g.fillRect(0, tam - zocalo - 4, tam, 4);
  }, { tam: 256, semilla: 3 }));
  const largoSala = SALA_FRENTE - SALA_FONDO;
  const centroZ = (SALA_FRENTE + SALA_FONDO) / 2;
  const alturaPared = (p, i) => p.getY(i) * (3 / SALA_ALTO); // la V cubre toda la altura
  const paredes = new THREE.Mesh(
    fusionar([
      uvMundo(colocar(new THREE.PlaneGeometry(SALA_X * 2, SALA_ALTO), 0, SALA_ALTO / 2, SALA_FONDO), masX, alturaPared, 3),
      uvMundo(colocar(new THREE.PlaneGeometry(SALA_X * 2, SALA_ALTO), 0, SALA_ALTO / 2, SALA_FRENTE, 0, Math.PI), masX, alturaPared, 3),
      uvMundo(colocar(new THREE.PlaneGeometry(largoSala, SALA_ALTO), -SALA_X, SALA_ALTO / 2, centroZ, 0, Math.PI / 2), menosZ, alturaPared, 3),
      uvMundo(colocar(new THREE.PlaneGeometry(largoSala, SALA_ALTO), SALA_X, SALA_ALTO / 2, centroZ, 0, -Math.PI / 2), menosZ, alturaPared, 3),
    ]),
    R(new THREE.MeshLambertMaterial({ map: texPared })),
  );
  raiz.add(paredes);

  // Gradas (cuatro asientos cada 2 m): arriba de la textura, el piso con los asientos
  // vistos desde arriba; abajo, la contrahuella con los respaldos que se ven desde la pista.
  const texGradas = R(ctx.texturaCanvas((g, tam, azar) => {
    g.fillStyle = '#6e6a76';
    g.fillRect(0, 0, tam, tam);
    for (let i = 0; i < 700; i++) {
      g.fillStyle = `rgba(0,0,0,${azar() * 0.18})`;
      g.fillRect(azar() * tam, azar() * tam, 2, 2);
    }
    const asiento = tam / 4;
    for (let k = 0; k < 4; k++) {
      const x = k * asiento + asiento * 0.1;
      const ancho = asiento * 0.8;
      const tono = 0.85 + azar() * 0.2;
      const claro = `rgb(${Math.round(55 * tono)},${Math.round(120 * tono)},${Math.round(240 * tono)})`;
      const oscuro = `rgb(${Math.round(30 * tono)},${Math.round(75 * tono)},${Math.round(170 * tono)})`;
      g.fillStyle = claro;
      g.fillRect(x, tam * 0.08, ancho, tam * 0.32);              // asiento
      g.fillStyle = oscuro;
      g.fillRect(x, tam * 0.36, ancho, tam * 0.06);              // borde del asiento
      g.fillRect(x, tam * 0.08, ancho, tam * 0.07);              // respaldo
      g.fillStyle = claro;
      g.fillRect(x, tam * 0.52, ancho, tam * 0.26);              // respaldo visto de frente
      g.fillStyle = oscuro;
      g.fillRect(x, tam * 0.74, ancho, tam * 0.04);
    }
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, tam / 2 - 2, tam, 2);
  }, { tam: 256, semilla: 5 }));
  // Filas de gradas en un marco local (a lo largo de X, subiendo hacia -Z), luego giradas
  function filasGradas(largo, filas, fondoFila, altoFila, rotY, x, z) {
    const piezas = [];
    for (let i = 0; i < filas; i++) {
      const piso = new THREE.PlaneGeometry(largo, fondoFila);
      const contra = new THREE.PlaneGeometry(largo, altoFila);
      for (const [geo, v0] of [[piso, 0.5], [contra, 0]]) {
        const uv = geo.attributes.uv;
        for (let k = 0; k < uv.count; k++) uv.setXY(k, (uv.getX(k) * largo) / 2, v0 + uv.getY(k) * 0.5);
      }
      colocar(piso, 0, (i + 1) * altoFila, -(i + 0.5) * fondoFila, -Math.PI / 2);
      colocar(contra, 0, (i + 0.5) * altoFila, -i * fondoFila);
      piezas.push(colocar(piso, x, 0, z, 0, rotY), colocar(contra, x, 0, z, 0, rotY));
    }
    return piezas;
  }
  const INICIO_GRADAS = -7.0;
  const gradas = new THREE.Mesh(
    fusionar([
      ...filasGradas(SALA_X * 2, 5, 0.5, 0.45, 0, 0, INICIO_GRADAS),
      ...filasGradas(SALA_FRENTE - INICIO_GRADAS, 3, 0.45, 0.4, -Math.PI / 2, 7.65, (INICIO_GRADAS + SALA_FRENTE) / 2),
      ...filasGradas(SALA_FRENTE - INICIO_GRADAS, 3, 0.45, 0.4, Math.PI / 2, -7.65, (INICIO_GRADAS + SALA_FRENTE) / 2),
    ]),
    R(new THREE.MeshLambertMaterial({ map: texGradas })),
  );
  raiz.add(gradas);

  // Focos del techo (sin luces reales: solo paneles que brillan)
  const focos = [];
  for (const x of [-4.5, 0, 4.5]) {
    for (const z of [-6, -1.5, 3]) focos.push(colocar(new THREE.PlaneGeometry(1.4, 0.5), x, SALA_ALTO - 0.2, z, Math.PI / 2));
  }
  raiz.add(new THREE.Mesh(fusionar(focos), R(new THREE.MeshBasicMaterial({ color: 0xfff1d0 }))));

  // ─── Canasta ───────────────────────────────────────────────────────────
  const matGris = R(new THREE.MeshLambertMaterial({ color: 0x546e7a }));
  // Tablero blanco con el borde y el cuadro pintados en la textura (antes eran 4 mallas)
  const texTablero = R(ctx.texturaCanvas((g, tam) => {
    const alto = TABLERO_ARRIBA - TABLERO_ABAJO;
    const px = (x) => ((x + TABLERO_ANCHO / 2) / TABLERO_ANCHO) * tam;
    const py = (y) => (1 - (y - TABLERO_ABAJO) / alto) * tam;
    g.fillStyle = '#f4f4f2';
    g.fillRect(0, 0, tam, tam);
    g.strokeStyle = '#d23c18';
    g.lineWidth = tam * 0.03;
    g.strokeRect(g.lineWidth / 2, g.lineWidth / 2, tam - g.lineWidth, tam - g.lineWidth);
    // Cuadro de tiro encima del aro (mismas medidas que las antiguas tiras)
    g.lineWidth = (0.04 / alto) * tam;
    g.strokeRect(px(-0.275), py(3.48), px(0.275) - px(-0.275), py(3.05) - py(3.48));
  }, { tam: 256 }));
  texTablero.wrapS = texTablero.wrapT = THREE.ClampToEdgeWrapping;
  const tablero = new THREE.Mesh(
    R(new THREE.BoxGeometry(TABLERO_ANCHO, TABLERO_ARRIBA - TABLERO_ABAJO, 0.04)),
    R(new THREE.MeshLambertMaterial({ map: texTablero })),
  );
  tablero.position.set(0, (TABLERO_ABAJO + TABLERO_ARRIBA) / 2, TABLERO_Z - 0.02);
  raiz.add(tablero);
  // Aro metálico con su soporte (una malla)
  const aro = new THREE.Mesh(
    fusionar([
      colocar(new THREE.TorusGeometry(RADIO_ARO, GROSOR_ARO, 10, 48), ARO.x, ARO.y, ARO.z, Math.PI / 2),
      colocar(new THREE.BoxGeometry(0.06, 0.03, 0.15), 0, ARO.y, TABLERO_Z + 0.075),
    ]),
    R(new THREE.MeshStandardMaterial({ color: 0xff4a12, emissive: 0x2a0800, metalness: 0.55, roughness: 0.3 })),
  );
  raiz.add(aro);
  const red = new THREE.Mesh(
    R(new THREE.CylinderGeometry(RADIO_ARO, 0.15, 0.4, 16, 3, true)),
    R(new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.8 })),
  );
  red.position.set(ARO.x, ARO.y - 0.2, ARO.z);
  raiz.add(red);

  // ─── Balones ───────────────────────────────────────────────────────────
  const geoBalon = R(new THREE.SphereGeometry(RADIO_BALON, 32, 20));
  // Cuero con granito y las tres costuras pintadas (antes eran tres toros por balón)
  const texBalon = R(ctx.texturaCanvas((g, tam, azar) => {
    g.fillStyle = '#e8681c';
    g.fillRect(0, 0, tam, tam);
    for (let i = 0; i < 9000; i++) {
      g.fillStyle = azar() < 0.55 ? `rgba(80,20,0,${azar() * 0.22})` : `rgba(255,200,150,${azar() * 0.14})`;
      g.fillRect(azar() * tam, azar() * tam, 1.5, 1.5);
    }
    g.fillStyle = '#2b1a10';
    const anchoU = tam * 0.011;   // la textura cubre 360° en U y 180° en V
    const anchoV = tam * 0.022;
    g.fillRect(0, tam / 2 - anchoV / 2, tam, anchoV);
    for (const u of [0, 0.25, 0.5, 0.75, 1]) g.fillRect(u * tam - anchoU / 2, 0, anchoU, tam);
  }, { tam: 512, semilla: 11 }));
  const matBalon = R(new THREE.MeshStandardMaterial({ map: texBalon, roughness: 0.72, metalness: 0 }));

  function crearBalon() {
    return new THREE.Mesh(geoBalon, matBalon);
  }

  const puestos = [
    ...PUESTOS_VR.map((pos) => ({ pos, vr: true })),
    { pos: PUESTO_RATON, vr: false },
  ].map((p) => ({ ...p, balon: null, recarga: 0 }));

  // Poste, brazo, base y los soportes de balones VR: una sola malla gris
  const piezasGris = [
    colocar(new THREE.CylinderGeometry(0.08, 0.1, TABLERO_ABAJO + 0.4, 12), 0, (TABLERO_ABAJO + 0.4) / 2, TABLERO_Z - 0.9),
    colocar(new THREE.BoxGeometry(0.1, 0.1, 0.9), 0, TABLERO_ABAJO + 0.3, TABLERO_Z - 0.45),
    colocar(new THREE.BoxGeometry(0.7, 0.22, 1.0), 0, 0.11, TABLERO_Z - 1.0),
  ];
  for (const p of puestos) {
    if (!p.vr) continue;
    const y = p.pos.y - RADIO_BALON - 0.03;
    piezasGris.push(
      colocar(new THREE.CylinderGeometry(0.06, 0.08, 0.06, 16), p.pos.x, y, p.pos.z),
      colocar(new THREE.CylinderGeometry(0.012, 0.012, y - 0.03, 6), p.pos.x, (y - 0.03) / 2, p.pos.z),
      colocar(new THREE.CylinderGeometry(0.1, 0.1, 0.015, 16), p.pos.x, 0.0075, p.pos.z),
    );
  }
  raiz.add(new THREE.Mesh(fusionar(piezasGris), matGris));
  const sombraPoste = ctx.crearSombra({ radio: 0.75, opacidad: 0.5 });
  ctx.colocarSombra(sombraPoste, new THREE.Vector3(0, 0, TABLERO_Z - 0.95), 0);
  raiz.add(sombraPoste);

  // Sombras de mancha de los balones (se reparten entre los balones cada fotograma)
  const sombrasBalon = Array.from({ length: 6 }, () => {
    const s = ctx.crearSombra({ radio: 0.14, opacidad: 0.55 });
    s.visible = false;
    raiz.add(s);
    return s;
  });

  // Manos visibles en VR
  const geoMano = R(new THREE.SphereGeometry(0.045, 12, 8));
  geoMano.scale(1, 0.6, 1.3);
  const matMano = R(new THREE.MeshLambertMaterial({ color: 0xffcc80 }));
  const manos = ctx.manos.map((mano) => {
    ctx.adjuntarAMano(mano, new THREE.Mesh(geoMano, matMano));
    return { mano, balon: null, historial: [], apretonAntes: false };
  });

  // ─── Barra de fuerza (ratón) ───────────────────────────────────────────
  const barra = new THREE.Group();
  barra.position.set(0.3, 1.12, -0.5);
  const fondoBarra = new THREE.Mesh(R(new THREE.BoxGeometry(0.035, 0.4, 0.01)), R(new THREE.MeshBasicMaterial({ color: 0x222233 })));
  fondoBarra.position.y = 0.2;
  const geoRelleno = R(new THREE.BoxGeometry(0.025, 0.4, 0.012));
  geoRelleno.translate(0, 0.2, 0);
  const relleno = new THREE.Mesh(geoRelleno, R(new THREE.MeshBasicMaterial({ color: 0xff9800 })));
  const marca = new THREE.Mesh(R(new THREE.BoxGeometry(0.05, 0.012, 0.014)), R(new THREE.MeshBasicMaterial({ color: 0x00e676 })));
  barra.add(fondoBarra, relleno, marca);
  raiz.add(barra);
  let cargando = false;
  let faseCarga = 0;

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.6, alto: 0.44 });
  marcador.mesh.position.set(0, 4.45, TABLERO_Z);
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  const enVuelo = [];
  let puntos = 0;
  let canastas = 0;
  let lanzamientos = 0;
  let racha = 0;
  let record = ctx.leer('record', 0);
  let estado = 'intro'; // 'intro' | 'jugando' | 'fin'
  let reloj = 3;
  let tiempoRestante = DURACION;
  let mensaje = '';
  let tiempoMensaje = 0;
  let meneoRed = 0;

  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const anterior = new THREE.Vector3();

  function actualizarMarcador() {
    if (estado === 'intro') {
      marcador.escribir([
        { texto: 'TIRO A CANASTA', tam: 1.3, color: '#ffab40' },
        {
          texto: ctx.enVR() ? 'Coge un balón con el gatillo y lánzalo' : 'Mantén pulsado y suelta en la marca verde',
          tam: 0.7,
        },
      ]);
    } else if (estado === 'fin') {
      marcador.escribir([
        { texto: `¡Tiempo! ${puntos} puntos`, tam: 1.3, color: '#ffab40' },
        { texto: `${canastas} de ${lanzamientos} · Récord: ${record} · otra en ${Math.ceil(reloj)}`, tam: 0.7 },
      ]);
    } else {
      marcador.escribir([
        { texto: `Puntos: ${puntos}   ·   ${Math.ceil(tiempoRestante)} s`, tam: 1.3 },
        tiempoMensaje > 0
          ? { texto: mensaje, tam: 0.7, color: '#fff59d' }
          : { texto: `Récord: ${record}   ·   limpia +3   ·   racha x2`, tam: 0.7, color: '#ffab40' },
      ]);
    }
  }

  function avisar(texto) {
    mensaje = texto;
    tiempoMensaje = 1.4;
  }

  // ─── Lanzar ────────────────────────────────────────────────────────────
  function lanzar(balon, velocidad) {
    lanzamientos += 1;
    enVuelo.push({ malla: balon, vel: velocidad.clone(), vida: 6, toco: false, anotado: false });
  }

  // Corrige un poco un buen lanzamiento VR para que entre (lanzar en VR sin peso es difícil)
  function ayudar(origen, vel) {
    const horizontal = Math.hypot(vel.x, vel.z);
    const dx = ARO.x - origen.x;
    const dz = ARO.z - origen.z;
    const distancia = Math.hypot(dx, dz);
    if (horizontal < 0.5 || distancia < 0.5) return vel;
    const angulo = Math.acos(THREE.MathUtils.clamp((vel.x * dx + vel.z * dz) / (horizontal * distancia), -1, 1));
    const t = distancia / horizontal;
    const ideal = tmp2.set(dx / t, (ARO.y - origen.y) / t + 0.5 * G * t, dz / t);
    if (angulo < THREE.MathUtils.degToRad(20) && t > 0.3 && t < 2.5 && Math.abs(ideal.y - vel.y) < 3) {
      vel.lerp(ideal, AYUDA);
    }
    return vel;
  }

  // ─── Física ────────────────────────────────────────────────────────────
  function moverBalon(b, dt) {
    const pos = b.malla.position;
    const pasos = Math.max(1, Math.ceil((b.vel.length() * dt) / 0.03));
    const h = dt / pasos;
    for (let i = 0; i < pasos; i++) {
      anterior.copy(pos);
      b.vel.y -= G * h;
      pos.addScaledVector(b.vel, h);

      // Tablero
      if (b.vel.z < 0 && pos.z - RADIO_BALON < TABLERO_Z && pos.z > TABLERO_Z - 0.15 &&
          Math.abs(pos.x) < TABLERO_ANCHO / 2 && pos.y > TABLERO_ABAJO && pos.y < TABLERO_ARRIBA) {
        pos.z = TABLERO_Z + RADIO_BALON;
        b.vel.z *= -0.6;
        b.toco = true;
        ctx.sonido('bote');
      }

      // Aro: punto más cercano de la circunferencia del aro
      tmp.set(pos.x - ARO.x, 0, pos.z - ARO.z);
      if (tmp.lengthSq() < 1e-8) tmp.set(1, 0, 0);
      tmp.normalize().multiplyScalar(RADIO_ARO).add(ARO);
      const normal = tmp2.subVectors(pos, tmp);
      const distancia = normal.length();
      const minimo = RADIO_BALON + GROSOR_ARO;
      if (distancia < minimo && distancia > 1e-6) {
        normal.divideScalar(distancia);
        pos.copy(tmp).addScaledVector(normal, minimo);
        const vn = b.vel.dot(normal);
        if (vn < 0) {
          b.vel.addScaledVector(normal, -1.55 * vn).multiplyScalar(0.9);
          if (!b.toco || vn < -1) ctx.sonido('golpe');
          b.toco = true;
        }
      }

      // ¿Ha entrado? Cruza el plano del aro hacia abajo por dentro
      if (!b.anotado && anterior.y >= ARO.y && pos.y < ARO.y && b.vel.y < 0 &&
          Math.hypot(pos.x - ARO.x, pos.z - ARO.z) < RADIO_ARO - RADIO_BALON * 0.3) {
        b.anotado = true;
        b.vel.x *= 0.4;
        b.vel.z *= 0.4;
        canasta(b);
      }

      // Suelo
      if (pos.y < RADIO_BALON) {
        pos.y = RADIO_BALON;
        if (b.vel.y < 0) {
          if (b.vel.y < -1.2) ctx.sonido('bote');
          b.vel.y *= -0.62;
          b.vel.x *= 0.85;
          b.vel.z *= 0.85;
        }
      }
    }
    b.malla.rotation.x -= b.vel.z * dt * 4;
    b.malla.rotation.z += b.vel.x * dt * 4;
  }

  function canasta(b) {
    meneoRed = 1;
    ctx.sonido('red');
    if (estado !== 'jugando') return;
    canastas += 1;
    racha += 1;
    let valor = b.toco ? 2 : 3;
    if (racha >= 3) valor *= 2;
    puntos += valor;
    ctx.sonido('punto');
    for (const m of ctx.manos) ctx.vibrar(m, 0.4, 60);
    if (racha >= 3) avisar(`¡En racha! ${racha} seguidas · +${valor}`);
    else if (!b.toco) avisar(`¡Limpia! +${valor}`);
    else avisar(`¡Canasta! +${valor}`);
  }

  // ─── Soportes de balones ───────────────────────────────────────────────
  function actualizarPuestos(dt) {
    const vr = ctx.enVR();
    for (const p of puestos) {
      if (p.vr !== vr) {
        if (p.balon) {
          raiz.remove(p.balon);
          p.balon = null;
        }
        continue;
      }
      if (!p.balon) {
        p.recarga -= dt;
        if (p.recarga <= 0) {
          p.balon = crearBalon();
          p.balon.position.copy(p.pos);
          raiz.add(p.balon);
        }
      }
    }
  }

  function tomarDePuesto(puesto) {
    const balon = puesto.balon;
    puesto.balon = null;
    puesto.recarga = 0.4;
    return balon;
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
        if (m.balon) {
          raiz.remove(m.balon);
          m.balon = null;
        }
        m.historial.length = 0;
        continue;
      }
      m.historial.push({ pos: mano.posicion.clone(), dt });
      if (m.historial.length > 12) m.historial.shift();

      const apretonPulsado = mano.apreton && !m.apretonAntes;
      m.apretonAntes = mano.apreton;

      if (!m.balon && (mano.gatilloPulsado || apretonPulsado)) {
        let mejor = null;
        let distancia = ALCANCE_AGARRE;
        for (const p of puestos) {
          if (!p.balon || !p.vr) continue;
          const d = p.balon.position.distanceTo(mano.posicion);
          if (d < distancia) {
            distancia = d;
            mejor = p;
          }
        }
        if (mejor) {
          m.balon = tomarDePuesto(mejor);
          ctx.vibrar(mano, 0.3, 30);
        }
      }

      if (m.balon) {
        mano.grip.localToWorld(m.balon.position.set(0, -0.02, -0.07));
        if (!mano.gatillo && !mano.apreton) {
          const vel = velocidadMano(m).multiplyScalar(FUERZA_VR);
          lanzar(m.balon, ayudar(m.balon.position, vel));
          m.balon = null;
        }
      }
    }
  }

  // ─── Ratón ─────────────────────────────────────────────────────────────
  function velocidadIdeal(origen) {
    const d = Math.hypot(ARO.x - origen.x, ARO.z - origen.z);
    const dy = ARO.y - origen.y;
    const c = Math.cos(ANGULO_RATON);
    const denominador = 2 * c * c * (d * Math.tan(ANGULO_RATON) - dy);
    return denominador > 0 ? Math.sqrt((G * d * d) / denominador) : V_MAX;
  }

  function raton(dt) {
    const puesto = puestos.find((p) => !p.vr);
    const r = ctx.raton;
    barra.visible = true;
    const ideal = (velocidadIdeal(PUESTO_RATON) - V_MIN) / (V_MAX - V_MIN);
    marca.position.y = THREE.MathUtils.clamp(ideal, 0, 1) * 0.4;

    if (r.clic && puesto.balon) {
      cargando = true;
      faseCarga = 0;
    }
    let carga = 0;
    if (cargando) {
      faseCarga += dt * 1.1;
      carga = 1 - Math.abs((faseCarga % 2) - 1); // sube y baja
      if (!r.pulsado) {
        cargando = false;
        if (puesto.balon) {
          // Dirección horizontal hacia donde apunta el ratón, con un ángulo fijo de tiro
          const dir = r.rayo.ray.direction;
          const horizontal = tmp.set(dir.x, 0, dir.z).normalize();
          const v = V_MIN + carga * (V_MAX - V_MIN);
          const vel = horizontal.multiplyScalar(v * Math.cos(ANGULO_RATON));
          vel.y = v * Math.sin(ANGULO_RATON);
          lanzar(tomarDePuesto(puesto), vel);
        }
        carga = 0;
      }
    }
    relleno.scale.y = Math.max(0.001, carga);
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function empezar() {
    estado = 'jugando';
    puntos = 0;
    canastas = 0;
    lanzamientos = 0;
    racha = 0;
    tiempoRestante = DURACION;
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
      barra.visible = false;
      cargando = false;
      manosVR(dt);
    } else {
      raton(dt);
    }

    for (let i = enVuelo.length - 1; i >= 0; i--) {
      const b = enVuelo[i];
      moverBalon(b, dt);
      b.vida -= dt;
      if (b.vida <= 0) {
        // Si no entró, se rompe la racha
        if (!b.anotado && estado === 'jugando') racha = 0;
        raiz.remove(b.malla);
        enVuelo.splice(i, 1);
      } else if (!b.anotado && b.malla.position.y < 1 && b.vel.y < 0 && b.malla.position.z < -1) {
        // Ya ha caído sin entrar: fallo (la racha se pierde una sola vez)
        if (!b.fallado && estado === 'jugando') racha = 0;
        b.fallado = true;
      }
    }

    // La red se menea al entrar el balón
    meneoRed = Math.max(0, meneoRed - dt * 2.5);
    red.scale.set(1 - meneoRed * 0.15, 1 + Math.sin(t * 30) * meneoRed * 0.15, 1 - meneoRed * 0.15);

    colocarSombras();
    actualizarMarcador();
  }

  // ─── Sombras de los balones ────────────────────────────────────────────
  let sombrasUsadas = 0;
  function sombraDe(malla) {
    if (sombrasUsadas < sombrasBalon.length) ctx.colocarSombra(sombrasBalon[sombrasUsadas++], malla.position, 0);
  }
  function colocarSombras() {
    sombrasUsadas = 0;
    for (const p of puestos) if (p.balon) sombraDe(p.balon);
    for (const m of manos) if (m.balon) sombraDe(m.balon);
    for (const b of enVuelo) sombraDe(b.malla);
    for (let i = sombrasUsadas; i < sombrasBalon.length; i++) sombrasBalon[i].visible = false;
  }

  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      niebla.near = nieblaOriginal.near;
      niebla.far = nieblaOriginal.far;
      enVuelo.length = 0;
    },
  };
}
