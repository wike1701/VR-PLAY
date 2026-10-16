// FUSIÓN DE FRUTAS
// En un puesto de mercado hay un cajón de madera de verdad, abierto por arriba. Se suelta una fruta sobre
// la boca del cajón y cae dentro; cuando dos frutas iguales se tocan se funden en la siguiente, más grande:
// cereza → fresa → uva → naranja → manzana → pomelo → melón → sandía. Dos sandías se funden en un
// estallido de puntos. Las fusiones seguidas (menos de ~1 s entre una y otra) multiplican los puntos.
// Si una fruta se queda por encima de la línea roja más de 2,5 s, el cajón rebosa y se acaba; si no,
// la partida dura 150 s. Lo que cuenta para la clasificación son los puntos.
//
// Todo es en 3D: las frutas son esferas que chocan, ruedan y se amontonan por todo el cajón, y se elige
// el punto de caída a lo ancho y a lo hondo. Una guía baja desde la fruta hasta un aro que marca dónde
// quedará apoyada (encima del montón), para calcular bien la profundidad.
// En VR: la fruta va en la mano y se suelta con el gatillo justo donde está la mano (encima del cajón).
// Con ratón: se apunta sobre la boca del cajón y un clic la suelta. En el móvil: se arrastra el dedo y la
// fruta cae al levantarlo.
import * as THREE from 'three';

// Todo se genera con código: no hay nada que descargar.
export async function precargar() {}

// ─── Ajustes ─────────────────────────────────────────────────────────────
const ZC = -0.52;                   // centro del cajón (cerca, para mirar dentro desde arriba)
const MEDIO = 0.17;                 // media anchura interior (el cajón es cuadrado)
const XMIN = -MEDIO;
const XMAX = MEDIO;
const ZMIN = ZC - MEDIO;
const ZMAX = ZC + MEDIO;
const SUELO = 0.56;                 // fondo interior del cajón
const ALTO_PARED = 0.42;
const BORDE = SUELO + ALTO_PARED;   // boca del cajón
const LINEA = BORDE - 0.05;         // línea roja de peligro
const SPAWN = BORDE + 0.1;          // altura desde la que cae la fruta con ratón
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
  // Casi desde arriba, para ver el interior del cajón por encima de la pared de delante
  const VISTAS = {
    horizontal: [new THREE.Vector3(0, 1.95, -0.1), new THREE.Vector3(0, 0.76, ZC)],
    vertical: [new THREE.Vector3(0, 2.2, 0.02), new THREE.Vector3(0, 0.74, ZC)],
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

  // Mesa baja con mantel de cuadros, donde descansa el cajón
  const texMantel = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#f7f1e3';
    g.fillRect(0, 0, tam, tam);
    g.fillStyle = 'rgba(214,64,58,0.55)';
    for (let i = 0; i < 4; i++) {
      g.fillRect(i * tam / 4 + tam / 8, 0, tam / 8, tam);
      g.fillRect(0, i * tam / 4 + tam / 8, tam, tam / 8);
    }
  }, { tam: 256, semilla: 504 }));
  const MESA_Y = SUELO - 0.045;   // el fondo del cajón descansa sobre la mesa
  const mesaZ = ZC - 0.05;
  const planoMantel = (ancho, alto, ux, uy) => {
    const g = new THREE.PlaneGeometry(ancho, alto);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * ux, uv.getY(i) * uy);
    return g;
  };
  const MESA_ANCHO = 1.7;
  const MESA_FONDO = 0.8;
  const mantel = [
    planoMantel(MESA_ANCHO, MESA_FONDO, MESA_ANCHO / 0.2, MESA_FONDO / 0.2).rotateX(-Math.PI / 2).translate(0, MESA_Y, mesaZ),
    planoMantel(MESA_ANCHO, MESA_Y, MESA_ANCHO / 0.2, MESA_Y / 0.2).translate(0, MESA_Y / 2, mesaZ + MESA_FONDO / 2),
    planoMantel(MESA_FONDO, MESA_Y, MESA_FONDO / 0.2, MESA_Y / 0.2).rotateY(Math.PI / 2).translate(MESA_ANCHO / 2, MESA_Y / 2, mesaZ),
    planoMantel(MESA_FONDO, MESA_Y, MESA_FONDO / 0.2, MESA_Y / 0.2).rotateY(-Math.PI / 2).translate(-MESA_ANCHO / 2, MESA_Y / 2, mesaZ),
  ];
  raiz.add(new THREE.Mesh(R(fusionarSimple(mantel)), R(new THREE.MeshLambertMaterial({ map: texMantel, side: THREE.DoubleSide }))));

  // Postes del toldo, estantes del fondo y el cajón: madera
  const texMadera = R(ctx.texturas.madera(0x9a6b3f, { tam: 512, repetir: [1, 1], semilla: 505 }));
  const matMadera = R(new THREE.MeshLambertMaterial({ map: texMadera }));
  const maderas = [];
  for (const x of [-bx, bx]) maderas.push(new THREE.CylinderGeometry(0.045, 0.05, 2.35, 8).translate(x, 1.175, -0.4));
  for (const x of [-1.2, 1.2]) maderas.push(new THREE.BoxGeometry(0.95, 0.04, 0.3).translate(x, 1.12, -1.8));
  raiz.add(new THREE.Mesh(R(fusionarSimple(maderas)), matMadera));

  // El cajón: fondo de tablas, cuatro paredes de listones con huecos (se ve el interior entre ellos),
  // postes en las esquinas y un remate en la boca
  const texListon = R(ctx.texturas.tablas(0xd9a768, { tam: 256, tablas: 1, repetir: [1, 1], semilla: 506 }));
  const listones = [];
  const G = 0.018; // grosor de la madera
  const LISTONES = 4;
  const altoListon = ALTO_PARED / LISTONES - 0.028;
  listones.push(new THREE.BoxGeometry(MEDIO * 2 + G * 2, G, MEDIO * 2 + G * 2).translate(0, SUELO - G / 2, ZC));
  for (let k = 0; k < LISTONES; k++) {
    const y = SUELO + (k + 0.5) * (ALTO_PARED / LISTONES) + 0.006;
    for (const lado of [-1, 1]) {
      listones.push(new THREE.BoxGeometry(MEDIO * 2 + G * 2, altoListon, G).translate(0, y, ZC + lado * (MEDIO + G / 2)));
      listones.push(new THREE.BoxGeometry(G, altoListon, MEDIO * 2).translate(lado * (MEDIO + G / 2), y, ZC));
    }
  }
  raiz.add(new THREE.Mesh(R(fusionarSimple(listones)), R(new THREE.MeshLambertMaterial({ map: texListon }))));
  const postes = [];
  for (const sx of [-1, 1]) {
    for (const sz of [-1, 1]) postes.push(new THREE.BoxGeometry(0.036, ALTO_PARED + 0.02, 0.036).translate(sx * (MEDIO + 0.018), SUELO + ALTO_PARED / 2, ZC + sz * (MEDIO + 0.018)));
  }
  for (const lado of [-1, 1]) {
    postes.push(new THREE.BoxGeometry(MEDIO * 2 + 0.07, 0.02, 0.036).translate(0, BORDE + 0.01, ZC + lado * (MEDIO + 0.018)));
    postes.push(new THREE.BoxGeometry(0.036, 0.02, MEDIO * 2).translate(lado * (MEDIO + 0.018), BORDE + 0.01, ZC));
  }
  raiz.add(new THREE.Mesh(R(fusionarSimple(postes)), matMadera));
  const sombraCajon = ctx.crearSombra({ radio: 0.42, opacidad: 0.35 });
  ctx.colocarSombra(sombraCajon, new THREE.Vector3(0, MESA_Y, ZC), MESA_Y + 0.002);
  raiz.add(sombraCajon);

  // Línea roja de peligro, por dentro de las cuatro paredes, justo bajo la boca
  const matLinea = R(new THREE.MeshBasicMaterial({ color: 0xff5a4a, transparent: true, opacity: 0.6, toneMapped: false, depthWrite: false, side: THREE.DoubleSide }));
  const tiraLinea = [];
  for (const lado of [-1, 1]) {
    tiraLinea.push(new THREE.PlaneGeometry(MEDIO * 2, 0.012).translate(0, LINEA, ZC + lado * (MEDIO - 0.001)));
    tiraLinea.push(new THREE.PlaneGeometry(MEDIO * 2, 0.012).rotateY(Math.PI / 2).translate(lado * (MEDIO - 0.001), LINEA, ZC));
  }
  raiz.add(new THREE.Mesh(R(fusionarSimple(tiraLinea)), matLinea));

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

  // Cadena de fusión sobre la mesa, delante del cajón: se ve qué sigue a qué
  const ESCALA_CADENA = 0.5;
  const cadenaFrutas = RADIOS.map((r, nivel) => {
    const m = fruta(nivel, ESCALA_CADENA);
    m.position.set(-0.42 + nivel * 0.12, MESA_Y + r * ESCALA_CADENA, ZC + 0.33);
    m.rotation.set(0.25, 0.5, 0);
    raiz.add(m);
    return m;
  });

  // ─── Marcador ──────────────────────────────────────────────────────────
  // El marcador, detrás del cajón; «Siguiente», a la derecha. Inclinados hacia atrás para leerlos
  // desde arriba y girados hacia el jugador (sin ladearse)
  const orientar = (malla, x, z, inclinacion) => malla.rotation.set(-inclinacion, Math.atan2(-x, -z), 0, 'YXZ');
  const panel = ctx.crearPanel({ ancho: 0.42, alto: 0.2 });
  panel.mesh.position.set(0, 1.2, ZC - MEDIO - 0.16);
  orientar(panel.mesh, 0, ZC - MEDIO - 0.16, 0.55);
  raiz.add(panel.mesh);

  const panelSiguiente = ctx.crearPanel({ ancho: 0.24, alto: 0.075 });
  panelSiguiente.mesh.position.set(0.36, 1.12, ZC);
  orientar(panelSiguiente.mesh, 0.36, ZC, 0.55);
  raiz.add(panelSiguiente.mesh);
  panelSiguiente.escribir([{ texto: ctx.t('siguiente'), tam: 1, color: '#ffe0a8' }]);
  const frutaSiguiente = fruta(0);
  frutaSiguiente.position.set(0.36, 1.0, ZC + 0.03);
  raiz.add(frutaSiguiente);

  const panelTitulo = ctx.crearPanel({ ancho: 1.1, alto: 0.2 });
  panelTitulo.mesh.position.set(0, 2.0, -1.93);
  raiz.add(panelTitulo.mesh);
  panelTitulo.escribir([{ texto: ctx.t('titulo'), tam: 1, color: '#ffd54f' }]);

  // ─── Guías de caída (una por mano; la 0 también sirve para el ratón) ────
  // Una línea vertical desde la fruta hasta un aro donde quedará apoyada (encima del montón)
  const matGuia = R(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, toneMapped: false }));
  const geoGuia = R(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -1, 0)]));
  const geoAro = R(new THREE.TorusGeometry(1, 0.06, 6, 28).rotateX(Math.PI / 2));
  const matAro = R(new THREE.MeshBasicMaterial({ color: 0xff6a3d, transparent: true, opacity: 0.85, toneMapped: false, depthWrite: false }));
  const guias = [0, 1].map(() => {
    const linea1 = new THREE.LineSegments(geoGuia, matGuia);
    const aro = new THREE.Mesh(geoAro, matAro);
    const fantasma = fruta(0);
    linea1.visible = aro.visible = fantasma.visible = false;
    raiz.add(linea1, aro, fantasma);
    return { linea: linea1, aro, fantasma, x: 0, y: SPAWN, z: ZC };
  });

  // Fruta en la mano (VR)
  const manos = ctx.manos.map((mano, i) => {
    const m = fruta(0);
    m.position.set(0, -0.01, -0.075);
    ctx.adjuntarAMano(mano, m);
    return { mano, fruta: m, guia: guias[Math.min(i, 1)], punto: new THREE.Vector3() };
  });

  // ─── Estado ────────────────────────────────────────────────────────────
  const pool = [];
  for (let i = 0; i < MAX_FRUTAS; i++) {
    pool.push({
      vivo: false, nivel: 0, r: 0, x: 0, y: 0, z: 0, vx: 0, vy: 0, vz: 0, edad: 0, pop: 1, contacto: false, fusion: false,
      giro: new THREE.Quaternion(),
    });
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
  const apuntado = new THREE.Vector3(0, SPAWN, ZC); // último punto apuntado con el ratón o el dedo
  const pos = new THREE.Vector3();
  const quat = new THREE.Quaternion();
  const escala = new THREE.Vector3();
  const eje = new THREE.Vector3();
  const matriz = new THREE.Matrix4();
  const centro = new THREE.Vector3(0, SUELO + 0.3, ZC);
  const planoBoca = new THREE.Plane(new THREE.Vector3(0, 1, 0), -SPAWN);

  function avisar(texto, color, duracion = 1.6) { aviso = { texto, color, tiempo: duracion }; }

  function nivelAlAzar() {
    let p = Math.random();
    for (let i = 0; i < PESOS_SUELTA.length; i++) {
      p -= PESOS_SUELTA[i];
      if (p <= 0) return i;
    }
    return 0;
  }

  function nuevaFruta(nivel, x, y, z) {
    let f = null;
    for (const q of pool) {
      if (!q.vivo) {
        f = q;
        break;
      }
    }
    if (!f) return null;
    f.vivo = true;
    f.nivel = nivel;
    f.r = RADIOS[nivel];
    f.x = x;
    f.y = y;
    f.z = z;
    f.vx = 0;
    f.vy = 0;
    f.vz = 0;
    f.giro.setFromAxisAngle(eje.set(0, 1, 0), azar(0, Math.PI * 2));
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
    const vz = (a.vz + b.vz) / 2;
    const ma = a.r * a.r * a.r;
    const mb = b.r * b.r * b.r;
    const mx = (a.x * ma + b.x * mb) / (ma + mb);
    const my = (a.y * ma + b.y * mb) / (ma + mb);
    const mz = (a.z * ma + b.z * mb) / (ma + mb);
    quat.copy(a.giro);
    // Ambas desaparecen
    a.vivo = false;
    b.vivo = false;
    pos.set(mx, my, mz);
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
    // La fruta nueva es más grande: que no atraviese las paredes
    const r = RADIOS[nuevo];
    const f = nuevaFruta(nuevo, limitar(mx, XMIN + r, XMAX - r), Math.max(my, SUELO + r), limitar(mz, ZMIN + r, ZMAX - r));
    if (!f) return;
    f.vx = vx;
    f.vy = vy + 0.2;
    f.vz = vz;
    f.giro.copy(quat);
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

  // ─── Física en 3D: esferas dentro del cajón ────────────────────────────
  function simular(h) {
    for (const f of pool) {
      if (!f.vivo) continue;
      f.vy -= GRAVEDAD * h;
      const roce = 1 - (f.contacto ? 3 : 0.5) * h; // más freno apoyada, para que el montón se asiente
      f.vx = limitar(f.vx * roce, -4, 4);
      f.vy = limitar(f.vy * roce, -4, 4);
      f.vz = limitar(f.vz * roce, -4, 4);
      f.x += f.vx * h;
      f.y += f.vy * h;
      f.z += f.vz * h;
      f.edad += h;
      f.contacto = false;
    }
    numPares = 0;
    for (let iter = 0; iter < 3; iter++) {
      // Paredes y fondo
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
        if (f.z - f.r < ZMIN) {
          f.z = ZMIN + f.r;
          if (f.vz < 0) f.vz = -f.vz * REBOTE;
          f.contacto = true;
        } else if (f.z + f.r > ZMAX) {
          f.z = ZMAX - f.r;
          if (f.vz > 0) f.vz = -f.vz * REBOTE;
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
          f.vz *= 1 - 5 * h;
          f.contacto = true;
        }
      }
      // Frutas entre sí
      for (let i = 0; i < MAX_FRUTAS; i++) {
        const a = pool[i];
        if (!a.vivo) continue;
        for (let j = i + 1; j < MAX_FRUTAS; j++) {
          const b = pool[j];
          if (!b.vivo) continue;
          const dx = b.x - a.x;
          const dy = b.y - a.y;
          const dz = b.z - a.z;
          const suma = a.r + b.r;
          const d2 = dx * dx + dy * dy + dz * dz;
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
          const nz = dz / d;
          const ma = a.r * a.r * a.r;
          const mb = b.r * b.r * b.r;
          const mover = (suma - d) / (ma + mb);
          a.x -= nx * mover * mb;
          a.y -= ny * mover * mb;
          a.z -= nz * mover * mb;
          b.x += nx * mover * ma;
          b.y += ny * mover * ma;
          b.z += nz * mover * ma;
          a.contacto = b.contacto = true;
          const rvx = b.vx - a.vx;
          const rvy = b.vy - a.vy;
          const rvz = b.vz - a.vz;
          const vn = rvx * nx + rvy * ny + rvz * nz;
          if (vn < 0) {
            const inv = 1 / ma + 1 / mb;
            const jn = (-(1 + REBOTE) * vn) / inv;
            a.vx -= (jn * nx) / ma;
            a.vy -= (jn * ny) / ma;
            a.vz -= (jn * nz) / ma;
            b.vx += (jn * nx) / mb;
            b.vy += (jn * ny) / mb;
            b.vz += (jn * nz) / mb;
            // Rozamiento entre frutas (contra el deslizamiento tangencial)
            const tx = rvx - vn * nx;
            const ty = rvy - vn * ny;
            const tz = rvz - vn * nz;
            const vt = Math.sqrt(tx * tx + ty * ty + tz * tz);
            if (vt > 1e-6) {
              const jt = Math.min(vt / inv, 0.3 * jn) / vt;
              a.vx += (jt * tx) / ma;
              a.vy += (jt * ty) / ma;
              a.vz += (jt * tz) / ma;
              b.vx -= (jt * tx) / mb;
              b.vy -= (jt * ty) / mb;
              b.vz -= (jt * tz) / mb;
            }
          }
        }
      }
    }
    // Que ningún empujón entre frutas deje una fuera de las paredes hasta el paso siguiente
    for (const f of pool) {
      if (!f.vivo) continue;
      f.x = limitar(f.x, XMIN + f.r, XMAX - f.r);
      f.z = limitar(f.z, ZMIN + f.r, ZMAX - f.r);
      if (f.y < SUELO + f.r) f.y = SUELO + f.r;
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

  // Suelta la fruta actual en (x, y, z), siempre dentro de la boca del cajón y por encima de él
  function soltar(x, y, z, mano) {
    if (estado !== 'jugando' || recarga > 0) return;
    const r = RADIOS[actual];
    const f = nuevaFruta(actual, limitar(x, XMIN + r, XMAX - r), Math.max(y, BORDE + r), limitar(z, ZMIN + r, ZMAX - r));
    if (!f) return;
    f.vy = -0.4;
    actual = siguiente;
    siguiente = nivelAlAzar();
    recarga = RECARGA;
    ctx.sonido('tic');
    if (mano) ctx.vibrar(mano, 0.3, 40);
  }

  // ─── Entrada ───────────────────────────────────────────────────────────
  // Altura a la que quedará apoyada una fruta de radio r soltada en (x, z): encima del montón
  function alturaApoyo(x, z, r) {
    let y = SUELO + r;
    for (const f of pool) {
      if (!f.vivo) continue;
      const dx = f.x - x;
      const dz = f.z - z;
      const s = f.r + r;
      const d2 = dx * dx + dz * dz;
      if (d2 < s * s) y = Math.max(y, f.y + Math.sqrt(s * s - d2));
    }
    return y;
  }

  // Coloca la guía: la fruta fantasma (con ratón), la línea y el aro de apoyo
  function colocarGuia(guia, x, y, z, conFantasma) {
    const r = RADIOS[actual];
    guia.x = limitar(x, XMIN + r, XMAX - r);
    guia.z = limitar(z, ZMIN + r, ZMAX - r);
    guia.y = Math.max(y, BORDE + r);
    const apoyo = alturaApoyo(guia.x, guia.z, r);
    guia.fantasma.visible = conFantasma;
    guia.fantasma.position.set(guia.x, guia.y, guia.z);
    guia.linea.visible = true;
    guia.linea.position.set(guia.x, guia.y, guia.z);
    guia.linea.scale.y = Math.max(0.001, guia.y - apoyo);
    guia.aro.visible = true;
    guia.aro.position.set(guia.x, apoyo - r * 0.55, guia.z);
    guia.aro.scale.setScalar(r * 0.85);
  }
  function ocultarGuia(guia) {
    guia.fantasma.visible = guia.linea.visible = guia.aro.visible = false;
  }

  function leerEntrada() {
    const listo = estado === 'jugando' && recarga <= 0;
    if (ctx.enVR()) {
      for (const m of manos) {
        const visible = m.mano.activa && listo;
        m.fruta.visible = visible;
        if (!visible) {
          ocultarGuia(m.guia);
          continue;
        }
        // La fruta cae desde donde está la mano (dentro de la boca del cajón)
        m.fruta.getWorldPosition(m.punto);
        colocarGuia(m.guia, m.punto.x, m.punto.y, m.punto.z, false);
        if (m.mano.gatilloPulsado) soltar(m.guia.x, m.guia.y, m.guia.z, m.mano);
      }
      return;
    }
    ocultarGuia(guias[1]);
    const guia = guias[0];
    if (!listo) {
      ocultarGuia(guia);
      return;
    }
    // Se apunta sobre la boca del cajón (en x y en z)
    if (ctx.raton.rayo.ray.intersectPlane(planoBoca, pos)) apuntado.copy(pos);
    colocarGuia(guia, apuntado.x, SPAWN, apuntado.z, true);
    if (ctx.tactil) {
      // En el móvil, la fruta cae al levantar el dedo
      if (punteroAnterior && !ctx.raton.pulsado) soltar(guia.x, guia.y, guia.z, null);
      punteroAnterior = ctx.raton.pulsado;
    } else if (ctx.raton.clic) soltar(guia.x, guia.y, guia.z, null);
  }

  // ─── Dibujo de las frutas ──────────────────────────────────────────────
  function dibujarFrutas(dt) {
    for (let nivel = 0; nivel < instancias.length; nivel++) {
      let n = 0;
      for (const f of pool) {
        if (!f.vivo || f.nivel !== nivel) continue;
        pos.set(f.x, f.y, f.z);
        escala.setScalar(Math.max(0.01, rebote(f.pop)));
        matriz.compose(pos, f.giro, escala);
        instancias[nivel].setMatrixAt(n++, matriz);
      }
      instancias[nivel].count = n;
      instancias[nivel].instanceMatrix.needsUpdate = true;
    }
    for (const f of pool) {
      if (!f.vivo) continue;
      f.pop = Math.min(1, f.pop + dt / 0.4);
      // Rueda al moverse apoyada: gira sobre el eje perpendicular a su avance
      const v = Math.hypot(f.vx, f.vz);
      if (f.contacto && v > 0.01) {
        eje.set(f.vz / v, 0, -f.vx / v);
        quat.setFromAxisAngle(eje, (v / f.r) * dt);
        f.giro.premultiply(quat);
      }
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
    matLinea.opacity = peligro > 0 ? 0.95 : 0.6;

    if (!ctx.enVR()) colocarVista();
    mostrarSiguientes();
    leerEntrada();
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
