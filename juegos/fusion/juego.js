// FUSIÓN DE FRUTAS
// En un puesto de mercado hay una caja de madera abierta por arriba. Se suelta una fruta desde arriba
// y cae dentro; cuando dos frutas iguales se tocan se funden en la siguiente, más grande:
// cereza → fresa → uva → naranja → manzana → pomelo → melón → sandía. Dos sandías se funden en un
// estallido de puntos. Las fusiones seguidas (menos de ~1 s entre una y otra) multiplican los puntos.
// Si una fruta se queda por encima de la línea roja más de 2,5 s, la caja rebosa y se acaba; si no,
// la partida dura 150 s. Lo que cuenta para la clasificación son los puntos.
//
// Física propia en 2D (círculos con gravedad, rebote y rozamiento) dentro de un plano frente al jugador.
// En VR: cada mano lleva la siguiente fruta; el sitio por donde caerá lo marca una guía sobre la caja,
// a la altura (en horizontal) de tu mano. Gatillo para soltarla.
// Con ratón: se mueve la guía con el puntero y un clic la suelta. En el móvil: se arrastra el dedo y la
// fruta cae al levantarlo.
import * as THREE from 'three';

// Todo se genera con código: no hay nada que descargar.
export async function precargar() {}

// ─── Ajustes ─────────────────────────────────────────────────────────────
const ZP = -0.8;                    // plano donde viven las frutas
const ANCHO = 0.64;                 // anchura interior de la caja
const XMIN = -ANCHO / 2;
const XMAX = ANCHO / 2;
const SUELO = 0.8;                  // fondo interior de la caja
const LINEA = SUELO + 0.6;          // línea roja de peligro
const SPAWN = LINEA + 0.1;          // altura desde la que cae la fruta
const ALTO_PARED = 0.76;
const DURACION = 150;               // segundos de partida
const TOLERANCIA = 2.5;             // segundos por encima de la línea antes de rebosar
const RECARGA = 0.5;                // segundos hasta poder soltar otra fruta
const VENTANA_COMBO = 1.1;          // segundos entre fusiones para que cuenten como combo
const COMBO_MAX = 6;
const GRAVEDAD = 6;
const REBOTE = 0.12;
const PASO = 1 / 120;               // paso fijo de la física
const MAX_PASOS = 4;
const MAX_FRUTAS = 64;
const MAX_PARES = 24;

// cereza, fresa, uva, naranja, manzana, pomelo, melón, sandía
const RADIOS = [0.026, 0.034, 0.043, 0.054, 0.067, 0.082, 0.1, 0.122];
const PUNTOS = [0, 2, 4, 8, 14, 22, 34, 50]; // al crear cada fruta
const PUNTOS_SANDIAS = 100;                    // dos sandías que se funden
const COLORES = [0xd81b3c, 0xf2415a, 0x8e4fc0, 0xff9a2e, 0xe0303f, 0xf7b84a, 0xc8e27d, 0x58b45a];
const PESOS_SUELTA = [0.4, 0.3, 0.2, 0.1];     // probabilidad de soltar cereza, fresa, uva o naranja

const azar = (a, b) => a + Math.random() * (b - a);
const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
// Sobrepaso al aparecer (easeOutBack)
const rebote = (p) => {
  const x = p - 1;
  return 1 + 2.70158 * x * x * x + 1.70158 * x * x;
};

// Junta geometrías con colores por vértice en una sola
function unir(geometrias) {
  const partes = geometrias.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = partes.reduce((n, g) => n + g.attributes.position.count, 0);
  const resultado = new THREE.BufferGeometry();
  for (const nombre of ['position', 'normal', 'color']) {
    const tam = partes[0].attributes[nombre].itemSize;
    const datos = new Float32Array(total * tam);
    let o = 0;
    for (const g of partes) {
      datos.set(g.attributes[nombre].array, o);
      o += g.attributes[nombre].array.length;
    }
    resultado.setAttribute(nombre, new THREE.BufferAttribute(datos, tam));
  }
  for (const g of new Set([...geometrias, ...partes])) g.dispose();
  return resultado;
}

// Colorea una geometría: «color» es un número o una función (x, y, z) → número hexadecimal
function pintar(geo, color) {
  const pos = geo.attributes.position;
  const datos = new Float32Array(pos.count * 3);
  const c = new THREE.Color();
  for (let i = 0; i < pos.count; i++) {
    c.setHex(typeof color === 'function' ? color(pos.getX(i), pos.getY(i), pos.getZ(i)) : color);
    datos.set([c.r, c.g, c.b], i * 3);
  }
  geo.setAttribute('color', new THREE.BufferAttribute(datos, 3));
  return geo;
}

// Esfera (o elipsoide) de radio r, pintada
function esfera(r, color, sx = 1, sy = 1, sz = 1, seg = 18) {
  return pintar(new THREE.SphereGeometry(r, seg, Math.round(seg * 0.7)).scale(sx, sy, sz), color);
}

// Rabito curvo (tallo): un cilindro fino inclinado sobre la parte de arriba
function tallo(r, largo, grosor, color, inclinacion = 0.35) {
  const g = new THREE.CylinderGeometry(grosor * 0.75, grosor, largo, 6).translate(0, largo / 2, 0);
  g.rotateZ(-inclinacion);
  return pintar(g.translate(0, r, 0), color);
}

// Hoja: una elipsoide plana inclinada
function hoja(r, tam, x, y, giro, color = 0x4caf50) {
  const g = new THREE.SphereGeometry(tam, 8, 6).scale(1.5, 0.28, 0.8);
  g.rotateZ(giro);
  return pintar(g.translate(x, y, 0), color);
}

// Geometría de cada fruta (radio real en metros, con su forma y detalles); lleva color por vértice
function construirFruta(nivel) {
  const r = RADIOS[nivel];
  const verde = 0x4f8f2f;
  switch (nivel) {
    case 0: // cereza: roja y brillante con su rabito
      return unir([esfera(r, (x, y) => (y > r * 0.35 ? 0xa80f2d : 0xd81b3c), 1, 0.96, 1),
        tallo(r * 0.92, r * 1.7, r * 0.07, verde, 0.5), hoja(r, r * 0.4, r * 0.75, r * 2.5, 0.5)]);
    case 1: // fresa: algo más alta, con cáliz verde
      return unir([esfera(r, (x, y) => (y < -r * 0.4 ? 0xd62f4b : 0xf2415a), 0.95, 1.08, 0.95),
        esfera(r * 0.58, verde, 1, 0.3, 1, 10).translate(0, r * 1.02, 0),
        pintar(new THREE.ConeGeometry(r * 0.22, r * 0.4, 5).translate(0, r * 1.25, 0), verde)]);
    case 2: // uva
      return unir([esfera(r, (x, y) => (y > r * 0.3 ? 0x9a60cc : 0x6d3a9a)),
        tallo(r * 0.95, r * 0.45, r * 0.07, 0x6b4a2b, 0.3), hoja(r, r * 0.3, r * 0.4, r * 1.2, 0.3)]);
    case 3: // naranja
      return unir([esfera(r, (x, y) => (y > 0 ? 0xffa43a : 0xf0821a)),
        esfera(r * 0.22, verde, 1, 0.45, 1, 8).translate(0, r * 0.98, 0)]);
    case 4: // manzana
      return unir([esfera(r, (x, y, z) => (y > r * 0.2 && z > 0 ? 0xf2514f : 0xd22c3a), 1, 0.93, 1),
        tallo(r * 0.82, r * 0.55, r * 0.06, 0x6d4a2b, 0.2), hoja(r, r * 0.3, r * 0.34, r * 1.25, 0.4)]);
    case 5: // pomelo: amarillo arriba, rosado abajo
      return unir([esfera(r, (x, y) => (y > -r * 0.2 ? 0xfbc65a : 0xf29a6a), 1, 0.98, 1, 20),
        esfera(r * 0.18, 0xc9a24a, 1, 0.5, 1, 8).translate(0, r * 0.97, 0)]);
    case 6: // melón: rayas claras
      return unir([esfera(r, (x, y, z) => (Math.sin(Math.atan2(x, z) * 8) > 0.35 ? 0xe0efa6 : 0xb4d672), 1, 1, 1, 20),
        tallo(r * 0.97, r * 0.3, r * 0.05, 0x6d4a2b, 0.1)]);
    default: // sandía: rayas oscuras
      return unir([esfera(r, (x, y, z) => (Math.sin(Math.atan2(x, z) * 7) > 0.2 ? 0x2c7a3a : 0x6fc85f), 1.05, 0.95, 1, 20),
        tallo(r * 0.93, r * 0.28, r * 0.045, 0x6d4a2b, 0.2)]);
  }
}

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  // ─── Decorado: un puesto de mercado al aire libre, por la mañana ───────
  ctx.fondo(0xa8dcf5, { nubes: 0.45, sol: [0.5, 0.55, -0.7], niebla: [14, 45], paisaje: { tipo: 'colinas', color: 0x6f9f7a, radio: 60 } });
  ctx.sueloBase(false);
  const VISTAS = {
    horizontal: [new THREE.Vector3(0, 1.33, 0.5), new THREE.Vector3(0, 1.17, ZP)],
    vertical: [new THREE.Vector3(0, 1.35, 1.0), new THREE.Vector3(0, 1.17, ZP)],
  };
  let vistaVertical = null;
  function colocarVista() {
    const vertical = ctx.camara.aspect < 1;
    if (vertical === vistaVertical) return;
    vistaVertical = vertical;
    ctx.vistaEscritorio(...VISTAS[vertical ? 'vertical' : 'horizontal']);
  }
  colocarVista();

  // Adoquines
  raiz.add(new THREE.Mesh(
    R(new THREE.PlaneGeometry(24, 24).rotateX(-Math.PI / 2)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.ladrillos(0x9a9288, 0x6b645c, { tam: 512, filas: 10, columnas: 6, repetir: [10, 10], semilla: 501 })) })),
  ));

  // Pared de tablas del puesto, al fondo
  const texPared = R(ctx.texturas.tablas(0xb98d5c, { tam: 512, tablas: 8, repetir: [3, 1], semilla: 502 }));
  raiz.add(new THREE.Mesh(R(new THREE.PlaneGeometry(6.4, 3.4).translate(0, 1.7, -1.95)), R(new THREE.MeshLambertMaterial({ map: texPared }))));

  // Toldo a rayas rojas y blancas, con volante colgando por delante
  const texToldo = R(ctx.texturaCanvas((g, tam) => {
    for (let i = 0; i < 10; i++) {
      g.fillStyle = i % 2 ? '#f5efe0' : '#d6403a';
      g.fillRect((i / 10) * tam, 0, tam / 10 + 1, tam);
    }
  }, { tam: 256, semilla: 503 }));
  texToldo.wrapS = THREE.RepeatWrapping;
  const toldo = new THREE.BufferGeometry();
  const bx = 1.9;
  toldo.setAttribute('position', new THREE.Float32BufferAttribute([
    -bx, 2.75, -1.95, bx, 2.75, -1.95, bx, 2.32, -0.35, -bx, 2.32, -0.35, // techo en pendiente
    -bx, 2.32, -0.35, bx, 2.32, -0.35, bx, 2.12, -0.33, -bx, 2.12, -0.33, // volante
  ], 3));
  toldo.setAttribute('uv', new THREE.Float32BufferAttribute([0, 1, 1, 1, 1, 0, 0, 0, 0, 1, 1, 1, 1, 0, 0, 0], 2));
  toldo.setIndex([0, 3, 2, 0, 2, 1, 4, 7, 6, 4, 6, 5]);
  toldo.computeVertexNormals();
  raiz.add(new THREE.Mesh(R(toldo), R(new THREE.MeshLambertMaterial({ map: texToldo, side: THREE.DoubleSide }))));

  // Mantel de cuadros sobre la mesa (techo y tres lados)
  const texMantel = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#f7f1e3';
    g.fillRect(0, 0, tam, tam);
    g.fillStyle = 'rgba(214,64,58,0.55)';
    for (let i = 0; i < 4; i++) {
      g.fillRect(i * tam / 4 + tam / 8, 0, tam / 8, tam);
      g.fillRect(0, i * tam / 4 + tam / 8, tam, tam / 8);
    }
  }, { tam: 256, semilla: 504 }));
  const MESA_Y = SUELO - 0.06;    // la tabla de la caja descansa sobre la mesa
  const mesaZ = ZP + 0.05;
  const planoMantel = (ancho, alto, ux, uy) => {
    const g = new THREE.PlaneGeometry(ancho, alto);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ux, uv.getY(i) * uy);
    return g;
  };
  const MESA_ANCHO = 1.7;
  const MESA_FONDO = 0.9;
  const mantel = [
    planoMantel(MESA_ANCHO, MESA_FONDO, MESA_ANCHO / 0.2, MESA_FONDO / 0.2).rotateX(-Math.PI / 2).translate(0, MESA_Y, mesaZ),
    planoMantel(MESA_ANCHO, MESA_Y, MESA_ANCHO / 0.2, MESA_Y / 0.2).translate(0, MESA_Y / 2, mesaZ + MESA_FONDO / 2),
    planoMantel(MESA_FONDO, MESA_Y, MESA_FONDO / 0.2, MESA_Y / 0.2).rotateY(Math.PI / 2).translate(MESA_ANCHO / 2, MESA_Y / 2, mesaZ),
    planoMantel(MESA_FONDO, MESA_Y, MESA_FONDO / 0.2, MESA_Y / 0.2).rotateY(-Math.PI / 2).translate(-MESA_ANCHO / 2, MESA_Y / 2, mesaZ),
  ];
  const geoMantel = R(fusionarSimple(mantel));
  raiz.add(new THREE.Mesh(geoMantel, R(new THREE.MeshLambertMaterial({ map: texMantel, side: THREE.DoubleSide }))));

  // Postes del toldo, estantes del fondo y la caja: madera
  const texMadera = R(ctx.texturas.madera(0x9a6b3f, { tam: 512, repetir: [1, 1], semilla: 505 }));
  const matMadera = R(new THREE.MeshLambertMaterial({ map: texMadera }));
  const maderas = [];
  for (const x of [-bx, bx]) maderas.push(new THREE.CylinderGeometry(0.045, 0.05, 2.35, 8).translate(x, 1.175, -0.4));
  for (const x of [-1.2, 1.2]) maderas.push(new THREE.BoxGeometry(0.95, 0.04, 0.3).translate(x, 1.12, -1.8));
  raiz.add(new THREE.Mesh(R(fusionarSimple(maderas)), matMadera));

  // La caja: base, dos paredes con su remate y el tablón del fondo
  const caja = [
    new THREE.BoxGeometry(ANCHO + 0.1, 0.05, 0.34).translate(0, SUELO - 0.025, ZP),
    new THREE.BoxGeometry(0.05, ALTO_PARED + 0.05, 0.34).translate(XMIN - 0.025, SUELO + ALTO_PARED / 2 - 0.025, ZP),
    new THREE.BoxGeometry(0.05, ALTO_PARED + 0.05, 0.34).translate(XMAX + 0.025, SUELO + ALTO_PARED / 2 - 0.025, ZP),
    new THREE.BoxGeometry(0.075, 0.03, 0.375).translate(XMIN - 0.025, SUELO + ALTO_PARED + 0.015, ZP),
    new THREE.BoxGeometry(0.075, 0.03, 0.375).translate(XMAX + 0.025, SUELO + ALTO_PARED + 0.015, ZP),
  ];
  raiz.add(new THREE.Mesh(R(fusionarSimple(caja)), matMadera));
  const texFondo = R(ctx.texturas.tablas(0xd9a768, { tam: 512, tablas: 6, repetir: [1, 1], semilla: 506 }));
  raiz.add(new THREE.Mesh(
    R(new THREE.PlaneGeometry(ANCHO + 0.1, ALTO_PARED + 0.05).translate(0, SUELO + ALTO_PARED / 2 - 0.025, ZP - 0.17)),
    R(new THREE.MeshLambertMaterial({ map: texFondo })),
  ));

  // Línea roja de peligro, en el borde abierto de la caja
  const matLinea = R(new THREE.MeshBasicMaterial({ color: 0xff5a4a, transparent: true, opacity: 0.55, toneMapped: false, depthWrite: false }));
  const linea = new THREE.Mesh(R(new THREE.PlaneGeometry(ANCHO, 0.012).translate(0, LINEA, ZP + 0.17)), matLinea);
  raiz.add(linea);

  raiz.add(ctx.arboles([
    { x: -4.5, z: -4.5, escala: 1.4 }, { x: 5, z: -5, escala: 1.5 }, { x: -7, z: -1, escala: 1.3 },
    { x: 7.5, z: -1.5, escala: 1.4 }, { x: 0, z: -9, escala: 1.7 }, { x: -9, z: -8, escala: 1.6 },
  ], { tipo: 'frondoso', semilla: 21 }));

  // ─── Frutas: geometría de cada nivel, instancias y copias sueltas ──────
  const geoFruta = RADIOS.map((_, nivel) => R(construirFruta(nivel)));
  const matFruta = R(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.42, metalness: 0 }));
  const instancias = geoFruta.map((geo) => {
    const m = new THREE.InstancedMesh(geo, matFruta, MAX_FRUTAS);
    m.count = 0;
    m.frustumCulled = false;
    raiz.add(m);
    return m;
  });
  const fruta = (nivel, escala = 1) => {
    const m = new THREE.Mesh(geoFruta[nivel], matFruta);
    m.scale.setScalar(escala);
    return m;
  };

  // Fruta de adorno en los estantes del fondo
  for (const [nivel, x, y] of [[7, -1.35, 1.14 + RADIOS[7] * 0.95], [6, -1.0, 1.14 + RADIOS[6]], [3, 1.0, 1.14 + RADIOS[3]],
    [4, 1.25, 1.14 + RADIOS[4]], [5, 1.5, 1.14 + RADIOS[5]]]) {
    const m = fruta(nivel);
    m.position.set(x, y, -1.8);
    m.rotation.y = x * 2;
    raiz.add(m);
  }

  // Cadena de fusión sobre la mesa, de la cereza a la sandía: se ve qué sigue a qué
  const ESCALA_CADENA = 0.5;
  const cadenaFrutas = RADIOS.map((r, nivel) => {
    const m = fruta(nivel, ESCALA_CADENA);
    m.position.set(-0.4 + nivel * 0.115, MESA_Y + r * ESCALA_CADENA, ZP + 0.36);
    m.rotation.set(0.25, 0.5, 0);
    raiz.add(m);
    return m;
  });

  // ─── Marcador ──────────────────────────────────────────────────────────
  const panel = ctx.crearPanel({ ancho: 0.62, alto: 0.3 });
  panel.mesh.position.set(-0.7, 1.4, ZP);
  panel.mesh.rotation.y = Math.atan2(0.7, -ZP);
  raiz.add(panel.mesh);

  const panelSiguiente = ctx.crearPanel({ ancho: 0.34, alto: 0.1 });
  panelSiguiente.mesh.position.set(0.66, 1.32, ZP);
  panelSiguiente.mesh.rotation.y = Math.atan2(-0.66, -ZP);
  raiz.add(panelSiguiente.mesh);
  panelSiguiente.escribir([{ texto: ctx.t('siguiente'), tam: 1, color: '#ffe0a8' }]);
  const frutaSiguiente = fruta(0);
  frutaSiguiente.position.set(0.66, 1.18, ZP);
  raiz.add(frutaSiguiente);

  const panelTitulo = ctx.crearPanel({ ancho: 1.1, alto: 0.2 });
  panelTitulo.mesh.position.set(0, 2.0, -1.93);
  raiz.add(panelTitulo.mesh);
  panelTitulo.escribir([{ texto: ctx.t('titulo'), tam: 1, color: '#ffd54f' }]);

  // ─── Guías de caída (una por mano; la 0 también sirve para el ratón) ────
  const matGuia = R(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45, toneMapped: false }));
  const geoGuia = R(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1, 0)]));
  const guias = [0, 1].map(() => {
    const grupo = new THREE.Group();
    const linea1 = new THREE.LineSegments(geoGuia, matGuia);
    linea1.scale.y = SPAWN - SUELO;
    const fantasma = fruta(0);
    grupo.add(linea1, fantasma);
    grupo.position.set(0, SPAWN, ZP);
    grupo.visible = false;
    raiz.add(grupo);
    return { grupo, fantasma, x: 0 };
  });

  // Fruta en la mano (VR)
  const manos = ctx.manos.map((mano, i) => {
    const m = fruta(0);
    m.position.set(0, -0.01, -0.075);
    ctx.adjuntarAMano(mano, m);
    return { mano, fruta: m, guia: guias[Math.min(i, 1)] };
  });

  // ─── Estado ────────────────────────────────────────────────────────────
  const pool = [];
  for (let i = 0; i < MAX_FRUTAS; i++) {
    pool.push({ vivo: false, nivel: 0, r: 0, x: 0, y: 0, vx: 0, vy: 0, ang: 0, vang: 0, edad: 0, pop: 1, contacto: false, fusion: false });
  }
  const pares = new Int16Array(MAX_PARES * 2);
  let numPares = 0;
  let estado = 'intro';        // 'intro' | 'jugando' | 'fin'
  let espera = 2.8;
  let tiempo = 0;
  let acumulado = 0;
  let puntos = 0;
  let restante = DURACION;
  let peligro = 0;
  let enPeligro = false;
  let actual = 0;
  let siguiente = 0;
  let recarga = 0;
  let cadena = 0;
  let ultimaFusion = -10;
  let vistaSiguiente = -1;
  let rebosa = false;
  let aviso = null;
  let record = ctx.leer('record', 0);
  let sonidoBote = 0;
  let punteroAnterior = false;
  let xRaton = 0;
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const escala = new THREE.Vector3();
  const ejeZ = new THREE.Vector3(0, 0, 1);
  const matriz = new THREE.Matrix4();
  const centro = new THREE.Vector3(0, SUELO + 0.3, ZP);

  function avisar(texto, color, duracion = 1.6) { aviso = { texto, color, tiempo: duracion }; }

  function nivelAlAzar() {
    let p = Math.random();
    for (let i = 0; i < PESOS_SUELTA.length; i++) {
      p -= PESOS_SUELTA[i];
      if (p <= 0) return i;
    }
    return 0;
  }

  function nuevaFruta(nivel, x, y) {
    const f = pool.find((q) => !q.vivo);
    if (!f) return null;
    f.vivo = true;
    f.nivel = nivel;
    f.r = RADIOS[nivel];
    f.x = x;
    f.y = y;
    f.vx = 0;
    f.vy = 0;
    f.ang = azar(-0.4, 0.4);
    f.vang = 0;
    f.edad = 0;
    f.pop = 1;
    f.contacto = false;
    f.fusion = false;
    return f;
  }

  function marcador() {
    let lineas;
    if (estado === 'intro') {
      lineas = [{ texto: ctx.t('titulo'), tam: 1.1, color: '#ffd54f' },
        { texto: ctx.t(ctx.enVR() ? 'introVR' : ctx.tactil ? 'introTactil' : 'introRaton'), tam: 0.55, color: '#fff3e0' }];
    } else if (estado === 'fin') {
      lineas = [{ texto: rebosa ? ctx.t('fin', { n: puntos }) : ctx.t('partida.tiempoPuntos', { n: puntos }), tam: 0.95, color: rebosa ? '#ff8a65' : '#ffd54f' },
        { texto: ctx.t('partida.recordNuevaPartida', { record, n: Math.ceil(espera) }), tam: 0.55 }];
    } else {
      lineas = [{ texto: ctx.t('partida.puntosTiempo', { puntos, s: Math.ceil(restante) }), tam: 0.95, color: '#ffffff' },
        aviso ? { texto: aviso.texto, tam: 0.6, color: aviso.color } : { texto: ctx.t('partida.record', { record }), tam: 0.55, color: '#bdbdbd' }];
    }
    panel.escribir(lineas);
  }

  // ─── Fusiones ──────────────────────────────────────────────────────────
  function fusionar(a, b) {
    const k = ctx.manos[0];
    const total = a.nivel;
    // Se leen antes de liberar las dos: la fruta nueva puede ocupar el hueco de una de ellas
    const vx = (a.vx + b.vx) / 2;
    const vy = (a.vy + b.vy) / 2;
    const ang = (a.ang + b.ang) / 2;
    // Ambas desaparecen
    a.vivo = false;
    b.vivo = false;
    const mx = (a.x * a.r * a.r + b.x * b.r * b.r) / (a.r * a.r + b.r * b.r);
    const my = (a.y * a.r * a.r + b.y * b.r * b.r) / (a.r * a.r + b.r * b.r);
    pos.set(mx, my, ZP + 0.05);
    cadena = tiempo - ultimaFusion < VENTANA_COMBO ? Math.min(cadena + 1, COMBO_MAX) : 1;
    ultimaFusion = tiempo;
    const mult = cadena;
    const color = COLORES[total];
    if (total >= RADIOS.length - 1) {
      // Dos sandías: estallido
      const ganado = PUNTOS_SANDIAS * mult;
      puntos += ganado;
      ctx.efectos.impacto('grande', { pos, mano: k, color, sonido: 'ovacion' });
      ctx.efectos.estallido(pos, { color: 0xff6a8a, cantidad: 36, fuerza: 3, tam: 0.03, vida: 0.9 });
      ctx.efectos.estallido(pos, { color: 0x6fc85f, cantidad: 24, fuerza: 2.4, tam: 0.03, vida: 0.8 });
      ctx.efectos.texto(pos, `+${ganado}`, { color: '#ffd54f', tam: 1.8 });
      avisar(ctx.t('gigante', { n: ganado }), '#ffd54f', 2.4);
      for (const m of ctx.manos) ctx.vibrar(m, 0.9, 200);
      return;
    }
    const nuevo = total + 1;
    const f = nuevaFruta(nuevo, mx, my);
    if (!f) return;
    f.vx = vx;
    f.vy = vy + 0.2;
    f.ang = ang;
    f.pop = 0.3;
    f.edad = 0.5;
    const ganado = PUNTOS[nuevo] * mult;
    puntos += ganado;
    const nivelImpacto = nuevo >= 6 ? 'grande' : nuevo >= 4 ? 'medio' : 'pequeño';
    ctx.efectos.impacto(nivelImpacto, { pos, mano: k, color: COLORES[nuevo], sonido: nuevo >= 4 ? 'punto' : 'boton' });
    ctx.efectos.estallido(pos, { color: COLORES[nuevo], cantidad: 6 + nuevo * 3, fuerza: 1.4 + nuevo * 0.2, tam: 0.014 + nuevo * 0.002, vida: 0.6 });
    ctx.efectos.texto(pos, `+${ganado}`, { color: mult > 1 ? '#ffd54f' : '#ffffff', tam: 0.6 + nuevo * 0.12 });
    if (mult > 1) avisar(ctx.t('combo', { n: mult }), '#ffd54f', 1.3);
    if (puntos > record && record > 0 && puntos - ganado <= record) avisar(ctx.t('partida.nuevoRecord'), '#ffd54f', 2.2);
  }

  // ─── Física ────────────────────────────────────────────────────────────
  function simular(h) {
    for (const f of pool) {
      if (!f.vivo) continue;
      f.vy -= GRAVEDAD * h;
      const roce = 1 - (f.contacto ? 3 : 0.5) * h; // más freno apoyada, para que el montón se asiente
      f.vx *= roce;
      f.vy *= roce;
      f.vx = limitar(f.vx, -4, 4);
      f.vy = limitar(f.vy, -4, 4);
      f.x += f.vx * h;
      f.y += f.vy * h;
      f.edad += h;
      f.contacto = false;
    }
    numPares = 0;
    for (let iter = 0; iter < 3; iter++) {
      for (const f of pool) {
        if (!f.vivo) continue;
        if (f.x - f.r < XMIN) {
          f.x = XMIN + f.r;
          if (f.vx < 0) f.vx = -f.vx * REBOTE;
          f.contacto = true;
        } else if (f.x + f.r > XMAX) {
          f.x = XMAX - f.r;
          if (f.vx > 0) f.vx = -f.vx * REBOTE;
          f.contacto = true;
        }
        if (f.y - f.r < SUELO) {
          f.y = SUELO + f.r;
          if (f.vy < 0) {
            if (-f.vy > 1.2 && sonidoBote <= 0) {
              sonidoBote = 0.08;
              ctx.sonido('bote');
            }
            f.vy = -f.vy * REBOTE;
          }
          f.vx *= 1 - 5 * h;
          f.contacto = true;
        }
      }
      for (let i = 0; i < MAX_FRUTAS; i++) {
        const a = pool[i];
        if (!a.vivo) continue;
        for (let j = i + 1; j < MAX_FRUTAS; j++) {
          const b = pool[j];
          if (!b.vivo) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const suma = a.r + b.r;
          const d2 = dx * dx + dy * dy;
          if (d2 >= suma * suma) continue;
          const d = Math.sqrt(d2) || 1e-5;
          if (a.nivel === b.nivel) {
            // Dos frutas iguales no rebotan: se funden
            if (!a.fusion && !b.fusion && numPares < MAX_PARES) {
              a.fusion = b.fusion = true;
              pares[numPares * 2] = i;
              pares[numPares * 2 + 1] = j;
              numPares++;
            }
            continue;
          }
          const nx = dx / d;
          const ny = dy / d;
          const ma = a.r * a.r;
          const mb = b.r * b.r;
          const mover = (suma - d) / (ma + mb);
          a.x -= nx * mover * mb;
          a.y -= ny * mover * mb;
          b.x += nx * mover * ma;
          b.y += ny * mover * ma;
          a.contacto = b.contacto = true;
          const vn = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
          if (vn < 0) {
            const inv = 1 / ma + 1 / mb;
            const jn = (-(1 + REBOTE) * vn) / inv;
            a.vx -= (jn * nx) / ma;
            a.vy -= (jn * ny) / ma;
            b.vx += (jn * nx) / mb;
            b.vy += (jn * ny) / mb;
            // Rozamiento entre frutas
            const tx = -ny;
            const ty = nx;
            const vt = (b.vx - a.vx) * tx + (b.vy - a.vy) * ty;
            const jt = limitar(-vt / inv, -0.3 * jn, 0.3 * jn);
            a.vx -= (jt * tx) / ma;
            a.vy -= (jt * ty) / ma;
            b.vx += (jt * tx) / mb;
            b.vy += (jt * ty) / mb;
          }
        }
      }
    }
    for (let p = 0; p < numPares; p++) {
      const a = pool[pares[p * 2]];
      const b = pool[pares[p * 2 + 1]];
      if (a.vivo && b.vivo) fusionar(a, b);
    }
  }

  // ─── Estados ───────────────────────────────────────────────────────────
  function empezarPartida() {
    for (const f of pool) f.vivo = false;
    puntos = 0;
    restante = DURACION;
    peligro = 0;
    enPeligro = false;
    cadena = 0;
    ultimaFusion = -10;
    rebosa = false;
    aviso = null;
    actual = nivelAlAzar();
    siguiente = nivelAlAzar();
    recarga = 0.3;
    estado = 'jugando';
    ctx.sonido('clac');
  }

  function terminar(porRebose) {
    estado = 'fin';
    espera = 6;
    rebosa = porRebose;
    ctx.puntuacion(puntos); // a la clasificación (juegos/marcadores.js): los puntos de las fusiones
    if (puntos > record) {
      record = puntos;
      ctx.guardar('record', record);
    }
    ctx.efectos.impacto(porRebose ? 'grande' : 'medio', { pos: centro, color: porRebose ? 0xff6a3d : 0xffd54f, sonido: porRebose ? 'caida' : 'fin' });
    if (porRebose) for (const m of ctx.manos) ctx.vibrar(m, 0.8, 250);
  }

  function soltar(x, mano) {
    if (estado !== 'jugando' || recarga > 0) return;
    const r = RADIOS[actual];
    const f = nuevaFruta(actual, limitar(x, XMIN + r, XMAX - r), SPAWN);
    if (!f) return;
    f.vy = -0.4;
    actual = siguiente;
    siguiente = nivelAlAzar();
    recarga = RECARGA;
    ctx.sonido('tic');
    if (mano) ctx.vibrar(mano, 0.3, 40);
  }

  // ─── Entrada ───────────────────────────────────────────────────────────
  function xDelPuntero() {
    const rayo = ctx.raton.rayo.ray;
    if (rayo.direction.z < -1e-4) xRaton = rayo.origin.x + rayo.direction.x * ((ZP - rayo.origin.z) / rayo.direction.z);
    return xRaton;
  }

  function colocarGuia(guia, x) {
    const r = RADIOS[actual];
    guia.x = limitar(x, XMIN + r, XMAX - r);
    guia.grupo.position.x = guia.x;
  }

  function leerEntrada() {
    const listo = estado === 'jugando' && recarga <= 0;
    if (ctx.enVR()) {
      for (const m of manos) {
        const visible = m.mano.activa && listo;
        m.fruta.visible = visible;
        m.guia.grupo.visible = visible;
        if (!m.mano.activa) continue;
        if (visible) colocarGuia(m.guia, m.mano.posicion.x);
        if (visible && m.mano.gatilloPulsado) soltar(m.guia.x, m.mano);
      }
      return;
    }
    const guia = guias[0];
    guia.grupo.visible = listo;
    colocarGuia(guia, xDelPuntero());
    if (ctx.tactil) {
      // En el móvil, la fruta cae al levantar el dedo
      if (punteroAnterior && !ctx.raton.pulsado) soltar(guia.x, null);
      punteroAnterior = ctx.raton.pulsado;
    } else if (ctx.raton.clic) soltar(guia.x, null);
  }

  // ─── Dibujo de las frutas ──────────────────────────────────────────────
  function dibujarFrutas(dt) {
    for (let nivel = 0; nivel < instancias.length; nivel++) {
      let n = 0;
      for (const f of pool) {
        if (!f.vivo || f.nivel !== nivel) continue;
        pos.set(f.x, f.y, ZP);
        quat.setFromAxisAngle(ejeZ, f.ang);
        escala.setScalar(Math.max(0.01, rebote(f.pop)));
        matriz.compose(pos, quat, escala);
        instancias[nivel].setMatrixAt(n++, matriz);
      }
      instancias[nivel].count = n;
      instancias[nivel].instanceMatrix.needsUpdate = true;
    }
    for (const f of pool) {
      if (!f.vivo) continue;
      f.pop = Math.min(1, f.pop + dt / 0.4);
      if (f.contacto) f.vang += (-(f.vx / f.r) * 0.6 - f.vang) * Math.min(1, dt * 10);
      else f.vang *= 1 - Math.min(1, dt * 0.5);
      f.ang += f.vang * dt;
    }
  }

  // Cambia la fruta que se ve en las manos, las guías y el panel de «siguiente»
  function mostrarSiguientes() {
    const clave = actual * 10 + siguiente;
    if (clave === vistaSiguiente) return;
    vistaSiguiente = clave;
    for (const m of manos) m.fruta.geometry = geoFruta[actual];
    for (const g of guias) g.fantasma.geometry = geoFruta[actual];
    frutaSiguiente.geometry = geoFruta[siguiente];
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function actualizar(dt, t) {
    tiempo += dt;
    sonidoBote -= dt;
    if (aviso && (aviso.tiempo -= dt) <= 0) aviso = null;

    if (estado === 'intro') {
      espera -= dt;
      if (espera <= 0) empezarPartida();
    } else if (estado === 'jugando') {
      restante -= dt;
      recarga -= dt;
      if (restante <= 0) {
        restante = 0;
        terminar(false);
      }
    } else {
      espera -= dt;
      if (espera <= 0) empezarPartida();
    }

    // Física a paso fijo
    acumulado = Math.min(acumulado + dt, PASO * MAX_PASOS);
    while (acumulado >= PASO) {
      acumulado -= PASO;
      simular(PASO);
    }

    // ¿Se desborda? Una fruta ya asentada por encima de la línea
    if (estado === 'jugando') {
      let encima = false;
      for (const f of pool) {
        if (f.vivo && f.edad > 1.2 && f.y + f.r > LINEA && Math.abs(f.vy) < 0.3) {
          encima = true;
          break;
        }
      }
      if (encima) {
        peligro += dt;
        if (!enPeligro) {
          enPeligro = true;
          ctx.sonido('fallo');
          avisar(ctx.t('peligro'), '#ff8a65', TOLERANCIA);
          for (const m of ctx.manos) ctx.vibrar(m, 0.5, 120);
        }
        if (peligro >= TOLERANCIA) terminar(true);
      } else {
        peligro = Math.max(0, peligro - dt * 2);
        if (peligro === 0 && enPeligro) {
          enPeligro = false;
          if (aviso && aviso.color === '#ff8a65') aviso = null;
        }
      }
    }
    matLinea.color.setHex(peligro > 0 && Math.floor(t * 8) % 2 ? 0xffffff : 0xff5a4a);
    matLinea.opacity = peligro > 0 ? 0.9 : 0.55;

    if (!ctx.enVR()) colocarVista();
    leerEntrada();
    mostrarSiguientes();
    dibujarFrutas(dt);
    frutaSiguiente.rotation.y += dt * 1.2;
    for (let i = 0; i < cadenaFrutas.length; i++) cadenaFrutas[i].rotation.y += dt * 0.6;
    marcador();
  }

  marcador();

  return {
    actualizar,
    liberar() {
      // La shell retira lo que hay en la escena y en las manos y los recursos registrados.
      for (const m of instancias) m.dispose();
    },
  };
}

// Junta geometrías sencillas (con uv) en una sola
function fusionarSimple(geometrias) {
  const partes = geometrias.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = partes.reduce((n, g) => n + g.attributes.position.count, 0);
  const resultado = new THREE.BufferGeometry();
  for (const nombre of ['position', 'normal', 'uv']) {
    const tam = partes[0].attributes[nombre].itemSize;
    const datos = new Float32Array(total * tam);
    let o = 0;
    for (const g of partes) {
      datos.set(g.attributes[nombre].array, o);
      o += g.attributes[nombre].array.length;
    }
    resultado.setAttribute(nombre, new THREE.BufferAttribute(datos, tam));
  }
  for (const g of new Set([...geometrias, ...partes])) g.dispose();
  return resultado;
}
