// TORTITAS AL VUELO
// Una cocina con la ventana abierta a la mañana. Llevas una sartén con una tortita: la
// cara de abajo se va dorando y hay que darle la vuelta lanzándola al aire y cogiéndola
// otra vez con la sartén. Cuando las dos caras están hechas, va sola al plato y llega
// otra. 75 segundos. Vuelta en su punto: 10 puntos (5 si está un poco cruda o pasada,
// 1 si está cruda) y 5 más si da dos vueltas; cada tortita servida, 10. Si se te cae o
// se quema, la pierdes.
// En VR llevas la sartén en la mano: dale un golpe hacia arriba y recógela. Sin gafas,
// la sartén sigue al ratón (o al dedo): mantén pulsado y suelta para lanzarla (cuanto
// más tiempo, más alto) y ponte debajo para cogerla.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código.
export async function precargar() {}

const DURACION = 75;
const R_TORTITA = 0.085;
const GROSOR = 0.012;
const R_SARTEN = 0.13;
const G = 9.8;
const COCCION = 1 / 5.5;             // cuánto se hace la cara de abajo por segundo
const PUNTO = [0.7, 1.1];            // en su punto
const QUEMADA = 1.65;
const CENTRO_SARTEN = new THREE.Vector3(0, 0.015, -0.3); // en la mano
const ALTURA_RATON = 1.0;
const N_PILA = 16;
const PLATO = new THREE.Vector3(-0.48, 0.93, -0.5);
const COLOR_CRUDA = new THREE.Color(0xf3e3b5);
const COLOR_DORADA = new THREE.Color(0xd2913a);
const COLOR_QUEMADA = new THREE.Color(0x3a2412);

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (r) => ctx.recurso(r);

  ctx.fondo(0xa8d4f0, {
    cenit: 0x6aa8e0, horizonte: 0xfff0d0, nubes: 0.5, sol: [0.4, 0.5, -0.7], niebla: [25, 80],
    paisaje: { tipo: 'colinas', color: 0x6f9a58, radio: 60 },
  });
  ctx.sueloBase(false);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.55, 0.25), new THREE.Vector3(0, 1.05, -0.5));

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

  // ─── La cocina ─────────────────────────────────────────────────────────
  const suelo = new THREE.Mesh(
    R(new THREE.PlaneGeometry(8, 8)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.ladrillos(0xd9d2c4, 0xb8ae9c, { filas: 8, columnas: 8, repetir: [4, 4], semilla: 501 })) })),
  );
  suelo.rotation.x = -Math.PI / 2;
  raiz.add(suelo);
  // Pared con azulejos y una ventana grande (el cielo se ve por el hueco)
  const matAzulejo = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.ladrillos(0xf4f1ea, 0xc8c4bc, { filas: 10, columnas: 10, repetir: [2, 1], semilla: 502 })) }));
  const pared = new THREE.Mesh(fusionar([
    colocar(new THREE.PlaneGeometry(6, 1.2), 0, 0.6 + 0.9, -1.2),
    colocar(new THREE.PlaneGeometry(2.2, 1.4), -1.9, 2.0, -1.2),
    colocar(new THREE.PlaneGeometry(2.2, 1.4), 1.9, 2.0, -1.2),
    colocar(new THREE.PlaneGeometry(6, 0.6), 0, 3.0, -1.2),
    colocar(new THREE.PlaneGeometry(6, 3.3), -3, 1.65, 1.0, 0, Math.PI / 2),
    colocar(new THREE.PlaneGeometry(6, 3.3), 3, 1.65, 1.0, 0, -Math.PI / 2),
  ]), matAzulejo);
  raiz.add(pared);
  // Marco de la ventana
  const matMarco = R(new THREE.MeshLambertMaterial({ color: 0x2f6f8f }));
  const marco = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(1.7, 0.06, 0.08), 0, 2.71, -1.2),
    colocar(new THREE.BoxGeometry(1.7, 0.06, 0.12), 0, 1.31, -1.18),
    colocar(new THREE.BoxGeometry(0.06, 1.4, 0.08), -0.8, 2.0, -1.2),
    colocar(new THREE.BoxGeometry(0.06, 1.4, 0.08), 0.8, 2.0, -1.2),
    colocar(new THREE.BoxGeometry(0.04, 1.4, 0.05), 0, 2.0, -1.2),
  ]), matMarco);
  raiz.add(marco);
  // Árboles al otro lado de la ventana
  raiz.add(ctx.arboles([{ x: -2.5, z: -7, escala: 1.4 }, { x: 1.8, z: -9, escala: 1.6 }, { x: 5, z: -6 }, { x: -6, z: -10, escala: 1.5 }], { tipo: 'frondoso', semilla: 51 }));
  const jardin = new THREE.Mesh(
    R(new THREE.PlaneGeometry(40, 30)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.cesped(0x5d9a46, { tam: 256, repetir: [10, 8], semilla: 503 })) })),
  );
  jardin.rotation.x = -Math.PI / 2;
  jardin.position.set(0, -0.01, -16);
  raiz.add(jardin);
  // Encimera con la cocina
  const matMadera = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.madera(0xb07a48, { semilla: 504 })) }));
  const muebles = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(3.0, 0.86, 0.6), 0, 0.43, -0.85),
  ]), matMadera);
  raiz.add(muebles);
  const encimera = new THREE.Mesh(R(new THREE.BoxGeometry(3.1, 0.05, 0.66)), R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.grano(0x8a8a86, { semilla: 505 })) })));
  encimera.position.set(0, 0.885, -0.85);
  raiz.add(encimera);
  const fogon = new THREE.Mesh(R(new THREE.BoxGeometry(0.62, 0.02, 0.5)), R(new THREE.MeshStandardMaterial({ color: 0x1c1c20, roughness: 0.3, metalness: 0.5 })));
  fogon.position.set(0.05, 0.92, -0.78);
  raiz.add(fogon);
  // Llama azul del fuego
  const llama = new THREE.Mesh(R(new THREE.TorusGeometry(0.075, 0.012, 6, 24).rotateX(Math.PI / 2)), R(new THREE.MeshBasicMaterial({ color: 0x4fa8ff, transparent: true, opacity: 0.85, toneMapped: false })));
  llama.position.set(0.05, 0.94, -0.78);
  raiz.add(llama);
  // Plato y la pila de tortitas servidas
  const plato = new THREE.Mesh(R(new THREE.CylinderGeometry(0.13, 0.1, 0.02, 24)), R(new THREE.MeshLambertMaterial({ color: 0xf6f6f2 })));
  plato.position.copy(PLATO);
  raiz.add(plato);
  const sombraPlato = ctx.crearSombra({ radio: 0.16, opacidad: 0.4 });
  sombraPlato.position.set(PLATO.x, 0.912, PLATO.z);
  raiz.add(sombraPlato);
  const geoTortita = R(new THREE.CylinderGeometry(R_TORTITA, R_TORTITA * 0.97, GROSOR, 24));
  const pila = new THREE.InstancedMesh(geoTortita, R(new THREE.MeshLambertMaterial({ color: COLOR_DORADA })), N_PILA);
  pila.count = 0;
  raiz.add(pila);
  // Tarro de miel y botella de leche para ambientar
  const tarro = new THREE.Mesh(R(new THREE.CylinderGeometry(0.05, 0.05, 0.11, 16)), R(new THREE.MeshLambertMaterial({ color: 0xf2a72e, transparent: true, opacity: 0.85 })));
  tarro.position.set(-0.75, 0.965, -0.75);
  raiz.add(tarro);
  const botella = new THREE.Mesh(fusionar([
    colocar(new THREE.CylinderGeometry(0.045, 0.045, 0.18, 14), 0.7, 1.0, -0.85),
    colocar(new THREE.CylinderGeometry(0.02, 0.045, 0.06, 14), 0.7, 1.12, -0.85),
  ]), R(new THREE.MeshLambertMaterial({ color: 0xfafafa })));
  raiz.add(botella);

  // Decoración: más vida en la cocina
  const lamb = (color) => R(new THREE.MeshLambertMaterial({ color }));
  // Alfombra con borde delante de la encimera
  const alfombra = new THREE.Mesh(fusionar([
    colocar(new THREE.PlaneGeometry(2.2, 1.0).rotateX(-Math.PI / 2), 0, 0.004, 0.0),
  ]), lamb(0xb8473a));
  const bordeAlfombra = new THREE.Mesh(fusionar([
    colocar(new THREE.PlaneGeometry(1.9, 0.7).rotateX(-Math.PI / 2), 0, 0.006, 0.0),
  ]), lamb(0xf1d9a0));
  const centroAlfombra = new THREE.Mesh(fusionar([
    colocar(new THREE.PlaneGeometry(1.7, 0.5).rotateX(-Math.PI / 2), 0, 0.008, 0.0),
  ]), lamb(0x3f7f8c));
  raiz.add(alfombra, bordeAlfombra, centroAlfombra);
  // Cortinas a los lados de la ventana, con su barra
  const cortinas = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(0.3, 1.5, 0.05), -1.0, 2.0, -1.12),
    colocar(new THREE.BoxGeometry(0.3, 1.5, 0.05), 1.0, 2.0, -1.12),
  ]), lamb(0xe9b44c));
  const barra = new THREE.Mesh(fusionar([
    colocar(new THREE.CylinderGeometry(0.012, 0.012, 2.3, 8), 0, 2.78, -1.1, 0, 0, Math.PI / 2),
    colocar(new THREE.SphereGeometry(0.03, 8, 6), -1.15, 2.78, -1.1),
    colocar(new THREE.SphereGeometry(0.03, 8, 6), 1.15, 2.78, -1.1),
  ]), R(new THREE.MeshStandardMaterial({ color: 0x6b4a2a, roughness: 0.5, metalness: 0.3 })));
  raiz.add(cortinas, barra);
  // Banderines de colores sobre la ventana
  const colBanderin = [0xe5533d, 0xf2c13a, 0x4fa86b, 0x4a8fd4];
  for (let k = 0; k < colBanderin.length; k++) {
    const gs = [];
    for (let i = k; i < 14; i += colBanderin.length) {
      const x = -1.3 + i * (2.6 / 13);
      gs.push(colocar(new THREE.CircleGeometry(0.075, 3), x, 3.06 - 0.1 * Math.sin((i / 13) * Math.PI), -1.19, 0, 0, Math.PI / 2));
    }
    raiz.add(new THREE.Mesh(fusionar(gs), R(new THREE.MeshLambertMaterial({ color: colBanderin[k], side: THREE.DoubleSide }))));
  }
  // Baldas de madera con tarros de colores
  const baldas = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(1.3, 0.04, 0.2), -1.95, 1.7, -1.1),
    colocar(new THREE.BoxGeometry(1.3, 0.04, 0.2), 1.95, 1.7, -1.1),
    colocar(new THREE.BoxGeometry(1.3, 0.04, 0.2), -1.95, 2.25, -1.1),
    colocar(new THREE.BoxGeometry(1.3, 0.04, 0.2), 1.95, 2.25, -1.1),
  ]), matMadera);
  raiz.add(baldas);
  const coloresTarro = [0xd9523c, 0x5a9e5f, 0xf0c64a, 0x4a86c8, 0xb06ac0];
  for (let i = 0; i < 10; i++) {
    const lado = i < 5 ? -1 : 1;
    const x = lado * 1.95 + ((i % 5) - 2) * 0.26;
    const alto = 0.12 + ((i * 7) % 3) * 0.03;
    const y = 1.72 + (i % 2 ? 0.55 : 0);
    const tarroDec = new THREE.Mesh(fusionar([
      colocar(new THREE.CylinderGeometry(0.06, 0.06, alto, 14), x, y + alto / 2, -1.1),
    ]), R(new THREE.MeshLambertMaterial({ color: coloresTarro[(i * 3) % 5], transparent: true, opacity: 0.9 })));
    const tapa = new THREE.Mesh(fusionar([
      colocar(new THREE.CylinderGeometry(0.063, 0.063, 0.025, 14), x, y + alto + 0.012, -1.1),
    ]), lamb(0xf2efe6));
    raiz.add(tarroDec, tapa);
  }
  // Reloj de pared
  const relojPared = new THREE.Mesh(fusionar([
    colocar(new THREE.CylinderGeometry(0.18, 0.18, 0.04, 28), -1.95, 3.0, -1.18, Math.PI / 2),
  ]), lamb(0xfaf6ea));
  const relojAros = new THREE.Mesh(fusionar([
    colocar(new THREE.TorusGeometry(0.18, 0.018, 8, 28), -1.95, 3.0, -1.16),
    colocar(new THREE.BoxGeometry(0.012, 0.1, 0.01), -1.95, 3.045, -1.15),
    colocar(new THREE.BoxGeometry(0.012, 0.07, 0.01), -1.92, 3.0, -1.15, 0, 0, -Math.PI / 2.4),
  ]), lamb(0x2a2a2e));
  raiz.add(relojPared, relojAros);
  // Barra de utensilios colgados sobre la encimera
  const utensilios = new THREE.Mesh(fusionar([
    colocar(new THREE.CylinderGeometry(0.01, 0.01, 1.0, 8), 1.5, 1.45, -1.16, 0, 0, Math.PI / 2),
    colocar(new THREE.CylinderGeometry(0.008, 0.008, 0.28, 8), 1.15, 1.3, -1.16),
    colocar(new THREE.CylinderGeometry(0.008, 0.008, 0.26, 8), 1.35, 1.31, -1.16),
    colocar(new THREE.CylinderGeometry(0.008, 0.008, 0.3, 8), 1.6, 1.29, -1.16),
    colocar(new THREE.SphereGeometry(0.05, 10, 8), 1.15, 1.12, -1.16),
    colocar(new THREE.BoxGeometry(0.09, 0.1, 0.012), 1.35, 1.12, -1.16),
    colocar(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 14), 1.6, 1.1, -1.16, Math.PI / 2),
  ]), R(new THREE.MeshStandardMaterial({ color: 0xc9ccd0, roughness: 0.35, metalness: 0.8 })));
  raiz.add(utensilios);
  // Maceta en el alféizar
  const maceta = new THREE.Mesh(fusionar([
    colocar(new THREE.CylinderGeometry(0.065, 0.045, 0.09, 14), -0.4, 1.385, -1.12),
  ]), lamb(0xc4623c));
  const hojas = new THREE.Mesh(fusionar([
    colocar(new THREE.SphereGeometry(0.07, 10, 8), -0.4, 1.5, -1.12),
    colocar(new THREE.SphereGeometry(0.05, 10, 8), -0.45, 1.56, -1.1),
    colocar(new THREE.SphereGeometry(0.05, 10, 8), -0.34, 1.55, -1.13),
  ]), lamb(0x4e9a46));
  raiz.add(maceta, hojas);
  // Frutero con fruta en la encimera
  const frutero = new THREE.Mesh(fusionar([
    colocar(new THREE.CylinderGeometry(0.13, 0.08, 0.06, 20), 1.2, 0.935, -0.9),
  ]), lamb(0xe8e1d2));
  raiz.add(frutero);
  const frutas = [[0xe0452f, -0.05, 0.0], [0xf2a73a, 0.05, 0.02], [0xe0452f, 0.0, -0.06], [0x9bc34a, 0.02, 0.07]];
  for (const [color, dx, dz] of frutas) {
    const fruta = new THREE.Mesh(R(new THREE.SphereGeometry(0.045, 12, 10)), lamb(color));
    fruta.position.set(1.2 + dx, 0.99, -0.9 + dz);
    raiz.add(fruta);
  }
  // Tetera y bote de utensilios junto al fogón
  const tetera = new THREE.Mesh(fusionar([
    colocar(new THREE.SphereGeometry(0.07, 14, 10), 0.4, 0.99, -0.95),
    colocar(new THREE.CylinderGeometry(0.012, 0.02, 0.07, 8), 0.47, 1.0, -0.95, 0, 0, -0.9),
    colocar(new THREE.SphereGeometry(0.018, 8, 6), 0.4, 1.065, -0.95),
  ]), R(new THREE.MeshStandardMaterial({ color: 0x3f8fb0, roughness: 0.3, metalness: 0.4 })));
  raiz.add(tetera);
  // Taburete de madera a un lado
  const taburete = new THREE.Mesh(fusionar([
    colocar(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 16), -1.9, 0.5, -0.2),
    colocar(new THREE.CylinderGeometry(0.02, 0.02, 0.48, 6), -2.02, 0.24, -0.1, 0.1, 0, 0.1),
    colocar(new THREE.CylinderGeometry(0.02, 0.02, 0.48, 6), -1.78, 0.24, -0.1, 0.1, 0, -0.1),
    colocar(new THREE.CylinderGeometry(0.02, 0.02, 0.48, 6), -1.9, 0.24, -0.32, -0.1, 0, 0),
  ]), matMadera);
  raiz.add(taburete);

  // ─── La sartén ─────────────────────────────────────────────────────────
  const matHierro = R(new THREE.MeshStandardMaterial({ color: 0x2a2a2e, roughness: 0.45, metalness: 0.7 }));
  const matMango = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.madera(0x5a3a22, { semilla: 506 })) }));
  const perfil = [
    new THREE.Vector2(0, 0), new THREE.Vector2(R_SARTEN, 0), new THREE.Vector2(R_SARTEN + 0.012, 0.035),
    new THREE.Vector2(R_SARTEN + 0.006, 0.037), new THREE.Vector2(R_SARTEN - 0.004, 0.006), new THREE.Vector2(0, 0.006),
  ];
  const geoSarten = R(new THREE.LatheGeometry(perfil, 28).translate(CENTRO_SARTEN.x, CENTRO_SARTEN.y - 0.008, CENTRO_SARTEN.z));
  const geoMangoSarten = R(fusionar([
    colocar(new THREE.CylinderGeometry(0.014, 0.017, 0.17, 10), 0, 0.01, -0.04, Math.PI / 2 + 0.12),
  ]));
  const geoUnion = R(new THREE.BoxGeometry(0.03, 0.012, 0.06).translate(0, 0.02, CENTRO_SARTEN.z + R_SARTEN + 0.01));
  function crearSarten() {
    const s = new THREE.Group();
    s.add(new THREE.Mesh(geoSarten, matHierro), new THREE.Mesh(geoMangoSarten, matMango), new THREE.Mesh(geoUnion, matHierro));
    return s;
  }
  const sartenesVR = ctx.manos.map((mano) => {
    const s = crearSarten();
    s.visible = false;
    ctx.adjuntarAMano(mano, s);
    return s;
  });
  // Sin gafas: la sartén va por encima del fuego siguiendo al ratón
  const sartenRaton = crearSarten();
  raiz.add(sartenRaton);
  const sombraSarten = ctx.crearSombra({ radio: 0.17, opacidad: 0.35 });
  raiz.add(sombraSarten);

  // ─── La tortita ────────────────────────────────────────────────────────
  // Cada cara con su material, que se va dorando
  const matCaraA = R(new THREE.MeshLambertMaterial({ color: COLOR_CRUDA }));
  const matCaraB = R(new THREE.MeshLambertMaterial({ color: COLOR_CRUDA }));
  const matCanto = R(new THREE.MeshLambertMaterial({ color: 0xe8c98a }));
  const tortita = new THREE.Mesh(geoTortita, [matCanto, matCaraA, matCaraB]); // grupos: canto, arriba (A), abajo (B)
  raiz.add(tortita);
  const sombraTortita = ctx.crearSombra({ radio: 0.1, opacidad: 0.4 });
  raiz.add(sombraTortita);

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.0, alto: 0.32 });
  marcador.mesh.position.set(0.72, 1.32, -1.0);
  marcador.mesh.rotation.y = -0.35;
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'juego' | 'fin'
  // fase de la tortita: 'sarten' | 'aire' | 'servida' | 'perdida'
  let fase = 'sarten';
  let reloj = 3;
  let tiempo = 0;
  let puntos = 0;
  let record = ctx.leer('record', 0);
  let servidas = 0;
  let espera = 0;
  let aviso = '';
  let tiempoAviso = 0;
  let manoSarten = null;
  let cargando = false;
  let carga = 0;
  let chisporroteo = 0;
  // Cocción de las dos caras (A arriba al empezar) y si ya están hechas
  const coccion = [0, 0];
  const hecha = [false, false];
  let abajo = 1;                       // qué cara toca la sartén (0 = A, 1 = B)
  let girada = false;                  // la tortita está boca abajo respecto a la geometría
  const vel = new THREE.Vector3();
  const ejeGiro = new THREE.Vector3(1, 0, 0);
  let angulo = 0;
  let velAngular = 0;
  let vueltas = 1;
  let altoAntes = 1;
  const qSalida = new THREE.Quaternion();
  const qGiro = new THREE.Quaternion();
  const qVuelta = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), Math.PI);
  const centroSarten = new THREE.Vector3();
  const centroAntes = new THREE.Vector3();
  const velSarten = new THREE.Vector3();
  let velSubidaAntes = 0;
  const normalSarten = new THREE.Vector3();
  const qSarten = new THREE.Quaternion();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const arriba = new THREE.Vector3(0, 1, 0);
  const planoRaton = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ALTURA_RATON);
  let hayAntes = false;

  function nuevaTortita() {
    fase = 'sarten';
    coccion[0] = coccion[1] = 0;
    hecha[0] = hecha[1] = false;
    abajo = 1;
    girada = false;
    pintarCaras();
    tortita.visible = true;
    ctx.sonido('verter');
  }

  function empezarPartida() {
    estado = 'juego';
    tiempo = DURACION;
    puntos = 0;
    servidas = 0;
    pila.count = 0;
    nuevaTortita();
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

  function colorCoccion(c, destino) {
    if (c < 1) destino.copy(COLOR_CRUDA).lerp(COLOR_DORADA, Math.min(1, c));
    else destino.copy(COLOR_DORADA).lerp(COLOR_QUEMADA, Math.min(1, (c - 1) / (QUEMADA - 1)));
  }
  // La cara A es la de arriba de la geometría; si está girada, se ve abajo
  function pintarCaras() {
    colorCoccion(coccion[0], matCaraA.color);
    colorCoccion(coccion[1], matCaraB.color);
  }

  // Lanza la tortita desde la sartén
  function lanzar(velocidad, eje, mano) {
    fase = 'aire';
    vel.copy(velocidad);
    ejeGiro.copy(eje).normalize();
    angulo = 0;
    // Una vuelta (media rotación) o, si se lanza fuerte, dos y media: el giro se ajusta
    // para que llegue justo al caer a la misma altura
    vueltas = velocidad.y >= 3.0 ? 3 : 1;
    velAngular = (vueltas * Math.PI) / ((2 * Math.max(velocidad.y, 0.8)) / G);
    altoAntes = 1;
    qSalida.copy(tortita.quaternion);
    // La cara que estaba abajo se juzga al despegar
    const c = coccion[abajo];
    let gana;
    let texto;
    let color;
    if (c >= PUNTO[0] && c <= PUNTO[1]) {
      gana = 10;
      texto = ctx.t('enSuPunto');
      color = '#ff6a3d';
    } else if (c >= 0.5 && c < PUNTO[0]) {
      gana = 5;
      texto = ctx.t('pocoHecha');
      color = '#ffe08a';
    } else if (c > PUNTO[1]) {
      gana = 5;
      texto = ctx.t('pasada');
      color = '#ffe08a';
    } else {
      gana = 1;
      texto = ctx.t('cruda');
      color = '#ffffff';
    }
    lanzamiento.gana = gana;
    lanzamiento.texto = texto;
    lanzamiento.color = color;
    lanzamiento.cara = abajo;
    ctx.vibrar(mano, 0.25, 25);
    ctx.sonido('zas');
  }
  const lanzamiento = { gana: 0, texto: '', color: '#ffffff', cara: 0 };

  function recoger(mano) {
    // Medias vueltas que ha dado
    const medias = Math.round(angulo / Math.PI);
    ctx.sonido('chisporroteo');
    tmp.copy(tortita.position);
    tmp.y += 0.15;
    if (medias % 2 === 1) {
      // Ha caído del otro lado: cuenta la vuelta
      girada = !girada;
      const cara = lanzamiento.cara;
      if (lanzamiento.gana >= 5) hecha[cara] = true;
      abajo = 1 - abajo;
      let gana = lanzamiento.gana;
      const doble = medias >= 3;
      if (doble) gana += 5;
      puntos += gana;
      ctx.efectos.impacto(gana >= 10 ? 'medio' : 'pequeño', { pos: tortita.position, mano, color: 0xffd23f, sonido: gana >= 10 ? 'punto' : null });
      ctx.efectos.texto(tmp, `+${gana}`, { color: lanzamiento.color, tam: gana >= 10 ? 1.3 : 1 });
      aviso = doble ? ctx.t('doble') : lanzamiento.texto;
      tiempoAviso = 1.3;
    } else {
      // Ha vuelto igual: no hay vuelta (o ha dado una entera)
      ctx.efectos.texto(tmp, medias === 0 ? ctx.t('sinVuelta') : ctx.t('entera'), { color: '#cfd8dc', tam: 0.8 });
    }
    fase = 'sarten';
    if (hecha[0] && hecha[1]) {
      espera = 0.7;
      fase = 'servir';
    }
  }

  function perder(motivo) {
    fase = 'perdida';
    espera = 1.3;
    aviso = motivo;
    tiempoAviso = 1.5;
    ctx.efectos.impacto('pequeño', { pos: tortita.position, color: 0x8a8a8a, sonido: 'fallo' });
  }

  function servir() {
    const extra = 10;
    puntos += extra;
    servidas += 1;
    if (pila.count < N_PILA) {
      matrizTmp.makeRotationY(Math.random() * 3).setPosition(PLATO.x + (Math.random() - 0.5) * 0.01, PLATO.y + 0.016 + pila.count * GROSOR, PLATO.z + (Math.random() - 0.5) * 0.01);
      pila.setMatrixAt(pila.count, matrizTmp);
      pila.count += 1;
      pila.instanceMatrix.needsUpdate = true;
    }
    tmp.set(PLATO.x, PLATO.y + 0.05 + pila.count * GROSOR, PLATO.z);
    ctx.efectos.impacto('grande', { pos: tmp, color: 0xff6a3d, sonido: 'caja' });
    tmp.y += 0.15;
    ctx.efectos.texto(tmp, `+${extra}`, { color: '#ff6a3d', tam: 1.5 });
    aviso = ctx.t('servida', { n: servidas });
    tiempoAviso = 1.4;
    tortita.visible = false;
    fase = 'perdida';
    espera = 0.6;
  }

  // ─── Sartén: dónde está y cómo se mueve ────────────────────────────────
  function situarSarten(dt) {
    if (ctx.enVR()) {
      for (const m of ctx.manos) if (m.activa && m.gatilloPulsado) manoSarten = m;
      if (!manoSarten || !manoSarten.activa) manoSarten = ctx.manos.find((m) => m.activa) || null;
      sartenesVR.forEach((s, k) => { s.visible = ctx.manos[k] === manoSarten; });
      sartenRaton.visible = false;
      if (!manoSarten) {
        hayAntes = false;
        return false;
      }
      manoSarten.grip.localToWorld(centroSarten.copy(CENTRO_SARTEN));
      manoSarten.grip.getWorldQuaternion(qSarten);
    } else {
      sartenesVR.forEach((s) => { s.visible = false; });
      sartenRaton.visible = true;
      if (ctx.raton.rayo.ray.intersectPlane(planoRaton, tmp)) {
        tmp.x = Math.max(-0.4, Math.min(0.45, tmp.x));
        tmp.z = Math.max(-0.75, Math.min(-0.3, tmp.z));
        // La sartén se mueve rápido pero no al instante
        tmp2.set(tmp.x, ALTURA_RATON, tmp.z);
        sartenRaton.position.lerp(tmp2.sub(CENTRO_SARTEN), Math.min(1, dt * 14));
      }
      sartenRaton.rotation.set(0, 0, 0);
      // Al soltar, la sartén da un golpe hacia arriba
      sartenRaton.position.y = ALTURA_RATON - CENTRO_SARTEN.y + (cargando ? -carga * 0.08 : 0);
      sartenRaton.updateMatrixWorld();
      sartenRaton.localToWorld(centroSarten.copy(CENTRO_SARTEN));
      qSarten.identity();
    }
    normalSarten.copy(arriba).applyQuaternion(qSarten);
    if (!hayAntes) {
      centroAntes.copy(centroSarten);
      hayAntes = true;
    }
    velSarten.copy(centroSarten).sub(centroAntes).divideScalar(Math.max(dt, 1e-3));
    centroAntes.copy(centroSarten);
    ctx.colocarSombra(sombraSarten, centroSarten, 0.912);
    return true;
  }

  // ─── Entrada ───────────────────────────────────────────────────────────
  function entrada() {
    if (estado !== 'juego' || fase !== 'sarten') {
      velSubidaAntes = velSarten.y;
      return;
    }
    if (ctx.enVR()) {
      // Golpe hacia arriba: se suelta cuando la sartén empieza a frenar
      if (normalSarten.y > 0.6 && velSubidaAntes > 1.4 && velSarten.y < velSubidaAntes) {
        tmp.set(1, 0, 0).applyQuaternion(qSarten);
        tmp2.copy(velSarten);
        tmp2.y = velSubidaAntes;
        lanzar(tmp2, tmp, manoSarten);
      }
      velSubidaAntes = velSarten.y;
      return;
    }
    if (ctx.raton.pulsado && !cargando) {
      cargando = true;
      carga = 0;
    }
    if (cargando && ctx.raton.pulsado) carga = Math.min(1, carga + 1 / 60 * 1.6);
    if (cargando && !ctx.raton.pulsado) {
      cargando = false;
      tmp2.set((Math.random() - 0.5) * 0.5, carga < 0.6 ? 2.3 + carga * 0.8 : 3.1 + (carga - 0.6) * 1.2, -0.05 - Math.random() * 0.15);
      lanzar(tmp2, tmp.set(1, 0, 0), null);
      carga = 0;
    }
  }

  // ─── La tortita, en la sartén o en el aire ─────────────────────────────
  function moverTortita(dt) {
    if (fase === 'sarten' || fase === 'servir') {
      // Pegada a la sartén, con un poco de baile
      tortita.position.copy(centroSarten).addScaledVector(normalSarten, 0.004 + GROSOR / 2);
      tortita.quaternion.copy(qSarten);
      if (girada) tortita.quaternion.multiply(qVuelta);
      if (estado === 'juego' && fase === 'sarten') {
        coccion[abajo] += COCCION * dt;
        pintarCaras();
        chisporroteo -= dt;
        if (chisporroteo <= 0) {
          chisporroteo = 1.4;
          ctx.sonido('chisporroteo');
        }
        if (coccion[abajo] >= QUEMADA) {
          ctx.efectos.estallido(tortita.position, { color: 0x555555, cantidad: 14 });
          perder(ctx.t('quemada'));
        }
      }
      // Si la sartén se inclina mucho, la tortita se cae
      if (normalSarten.y < 0.15 && fase === 'sarten') {
        fase = 'aire';
        vel.copy(velSarten);
        velAngular = 2;
        angulo = 0;
        altoAntes = 1;
        qSalida.copy(tortita.quaternion);
        lanzamiento.gana = 0;
      }
    } else if (fase === 'aire') {
      vel.y -= G * dt;
      tortita.position.addScaledVector(vel, dt);
      angulo += velAngular * dt;
      qGiro.setFromAxisAngle(ejeGiro, angulo);
      tortita.quaternion.copy(qGiro).multiply(qSalida);
      // ¿Cae dentro de la sartén?
      if (vel.y < 0) {
        tmp.copy(tortita.position).sub(centroSarten);
        const alto = tmp.dot(normalSarten);
        const lado = tmp.addScaledVector(normalSarten, -alto).length();
        // Vale si está a la altura de la sartén o si la ha cruzado en este fotograma
        const cruza = altoAntes > 0.03 && alto <= 0.03 && alto > -0.12;
        if ((cruza || (alto < 0.04 && alto > -0.05)) && lado < R_SARTEN + 0.01 && normalSarten.y > 0.5) {
          recoger(manoSarten);
          return;
        }
        altoAntes = alto;
      }
      // Al suelo o a la encimera
      const sueloY = Math.abs(tortita.position.x) < 1.5 && tortita.position.z < -0.55 && tortita.position.z > -1.18 ? 0.92 : 0.01;
      if (tortita.position.y < sueloY) {
        tortita.position.y = sueloY;
        ctx.sonido('plof');
        perder(ctx.t('alSuelo'));
      }
    }
  }

  function actualizarMarcador() {
    if (estado === 'intro') {
      const intro = ctx.enVR() ? ctx.t('intro') : ctx.t(ctx.tactil ? 'introTactil' : 'introRaton');
      marcador.escribir([
        { texto: ctx.t('titulo'), tam: 1.3, color: '#ff8a65' },
        { texto: intro, tam: 0.72 },
      ]);
    } else if (estado === 'fin') {
      marcador.escribir([
        { texto: ctx.t('fin', { n: puntos, servidas }), tam: 1.1, color: '#ff8a65' },
        { texto: ctx.t('partida.recordNuevaPartida', { record, n: Math.max(1, Math.ceil(reloj)) }), tam: 0.72 },
      ]);
    } else {
      const c = coccion[abajo];
      const llenas = Math.min(10, Math.round((c / QUEMADA) * 10));
      const enPunto = c >= PUNTO[0] && c <= PUNTO[1];
      marcador.escribir([
        { texto: ctx.t('partida.puntosTiempo', { puntos, s: Math.max(0, Math.ceil(tiempo)) }), tam: 1.15 },
        {
          texto: tiempoAviso > 0 ? aviso : ctx.t(enPunto ? 'yaEsta' : 'abajo', { barra: '▮'.repeat(llenas) + '▯'.repeat(10 - llenas) }),
          tam: 0.8,
          color: tiempoAviso > 0 ? '#ffe08a' : enPunto ? '#ff8a65' : c > PUNTO[1] ? '#ff5252' : '#cfd8dc',
        },
      ]);
    }
  }

  // ─── Bucle ─────────────────────────────────────────────────────────────
  function actualizar(dt, t) {
    reloj -= dt;
    tiempoAviso -= dt;
    if ((estado === 'intro' || estado === 'fin') && reloj <= 0) empezarPartida();
    if (estado === 'juego') {
      tiempo -= dt;
      if (tiempo <= 0) {
        tiempo = 0;
        terminar();
      }
    }
    situarSarten(dt);
    entrada();
    moverTortita(dt);
    if (fase === 'servir' || fase === 'perdida') {
      espera -= dt;
      if (espera <= 0) {
        if (fase === 'servir') servir();
        else if (estado === 'juego' || estado === 'intro') nuevaTortita();
      }
    }
    ctx.bloquearCambio(fase === 'aire');
    sombraTortita.visible = tortita.visible;
    if (tortita.visible) ctx.colocarSombra(sombraTortita, tortita.position, fase === 'aire' ? 0.912 : centroSarten.y + 0.003);
    llama.scale.setScalar(1 + Math.sin(t * 23) * 0.04);
    actualizarMarcador();
  }

  nuevaTortita();
  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      ctx.bloquearCambio(false);
    },
  };
}
