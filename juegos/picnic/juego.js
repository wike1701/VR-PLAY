// PICNIC MATAMOSCAS
// Mesa de picnic en un jardín, con cinco platos de comida. Las moscas llegan volando, dan unas vueltas
// sobre un plato y se posan: si una se queda más de 1 segundo en la comida, ese plato se pudre. Cada
// plato es una vida y la partida acaba cuando se pudren todos. Aplastar una mosca posada vale 1 punto
// y cazarla al vuelo, 2; la moscarda verde vale el doble. Cada vez llegan más moscas y más rápidas.
// En VR: un matamoscas en cada mano (hay que darles con un golpe rápido). Con ratón o en el móvil:
// clic o toque sobre la mosca, y el matamoscas baja de golpe.
// (Sugerencia #6 del foro.)
import * as THREE from 'three';

// Todo se genera con código: no hay nada que descargar.
export async function precargar() {}

const ALTURA_MESA = 0.74;
const SUPERFICIE = 0.78;            // altura del mantel
const Y_PLATO = SUPERFICIE + 0.007; // donde se apoya la comida
const MESA = { x: 0.78, z: [-1.03, -0.17], centro: -0.6 }; // medio ancho y fondo del mantel
const TIEMPO_PUDRIR = 1.0;          // segundos que aguanta la comida con una mosca encima
const MAX_MOSCAS = 12;              // las que puede haber a la vez como mucho (se reutilizan)
const DIFICULTAD_MAX = 150;         // segundos hasta llegar a la dificultad máxima
const NIVEL_SEGUNDOS = 30;          // cada 30 s, aviso de que llegan más
const VELOCIDAD_GOLPE_VR = 0.9;     // m/s mínimos de la paleta para aplastar
const RADIO_PALETA = 0.078;         // alcance alrededor del centro de la paleta
const CENTRO_PALETA = -0.375;       // centro de la paleta delante del puño
const RADIO_RATON = 0.075;          // alcance del golpe con el ratón (en horizontal)
const ESCALA = 3;                   // moscas de unos 3 cm: grandes para que se lean en VR y con ratón
const AZUL = 0x29b6f6;
const AMARILLO = 0xffca28;
const COLOR_FRESCO = new THREE.Color(0xffffff);
const COLOR_PODRIDO = new THREE.Color(0x6d7d38);
const COLOR_AVISO = new THREE.Color(0xffd54f);
const COLOR_PELIGRO = new THREE.Color(0xff3d00);

const azar = (a, b) => a + Math.random() * (b - a);

// Pinta una geometría de un color (atributo de color por vértice) y le quita las UV
function pintar(geometria, hex) {
  const g = geometria.index ? geometria.toNonIndexed() : geometria;
  if (g !== geometria) geometria.dispose();
  g.deleteAttribute('uv');
  const c = new THREE.Color(hex);
  const colores = new Float32Array(g.attributes.position.count * 3);
  for (let i = 0; i < colores.length; i += 3) colores.set([c.r, c.g, c.b], i);
  g.setAttribute('color', new THREE.BufferAttribute(colores, 3));
  return g;
}

// Junta varias geometrías en una (menos llamadas de dibujo)
function fusionar(geometrias, nombres = ['position', 'normal', 'uv']) {
  const partes = geometrias.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = partes.reduce((n, g) => n + g.attributes.position.count, 0);
  const resultado = new THREE.BufferGeometry();
  for (const nombre of nombres) {
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
const fusionarColores = (geometrias) => fusionar(geometrias, ['position', 'normal', 'color']);

// Cuña (porción de tarta, queso o sandía): sector de cilindro centrado en su centro de masas
// (ref: el radio de la capa de fuera, para que todas las capas compartan la punta)
function cuna(radio, alto, angulo, segmentos = 12, ref = radio) {
  const g = new THREE.CylinderGeometry(radio, radio, alto, segmentos, 1, false, -angulo / 2, angulo);
  const centro = (4 * ref * Math.sin(angulo / 2)) / (3 * angulo);
  return g.translate(0, alto / 2, -centro);
}

// ─── Comidas ───────────────────────────────────────────────────────────
// Cada una devuelve su geometría (con colores) apoyada en y = 0, y la altura y el radio de la zona
// de encima donde se posan las moscas.
function crearBocadillo() {
  const forma = new THREE.Shape();
  const l = 0.13;
  forma.moveTo(-l / 2, -l * 0.29);
  forma.lineTo(l / 2, -l * 0.29);
  forma.lineTo(0, l * 0.58);
  forma.closePath();
  const capa = (grosor, escala) => new THREE.ExtrudeGeometry(forma, {
    depth: grosor, bevelEnabled: true, bevelThickness: 0.002, bevelSize: 0.004 * escala, bevelSegments: 1, curveSegments: 2,
  }).scale(escala, escala, 1).rotateX(-Math.PI / 2);
  const partes = [
    pintar(capa(0.012, 1).translate(0, 0.002, 0), 0xd9a55b),       // pan de abajo
    pintar(capa(0.003, 1.08).translate(0, 0.016, 0), 0x6abf3a),    // lechuga (asoma por los bordes)
    pintar(capa(0.004, 1.0).translate(0, 0.021, 0), 0xe53935),     // tomate
    pintar(capa(0.003, 1.04).translate(0, 0.027, 0), 0xffc93c),    // queso
    pintar(capa(0.013, 1).translate(0, 0.032, 0), 0xe0b06a),       // pan de arriba
  ];
  return { geo: fusionarColores(partes).rotateY(0.4), alto: 0.049, radio: 0.035 };
}

function crearSandia() {
  const angulo = 1.15;
  const partes = [
    pintar(cuna(0.13, 0.02, angulo, 16), 0x2e7d32),                       // corteza
    pintar(cuna(0.122, 0.024, angulo, 16, 0.13), 0xf1f8e9),               // blanco
    pintar(cuna(0.115, 0.028, angulo, 16, 0.13), 0xef3b4f),               // pulpa
  ];
  // Pepitas
  for (let i = 0; i < 9; i++) {
    const r = 0.03 + (i % 3) * 0.022;
    const a = ((i % 5) / 4 - 0.5) * angulo * 0.7;
    partes.push(pintar(new THREE.SphereGeometry(0.0035, 5, 4).scale(0.7, 0.5, 1.2)
      .translate(Math.sin(a) * r, 0.028, Math.cos(a) * r - 0.06), 0x1b1b1b));
  }
  return { geo: fusionarColores(partes).rotateY(-0.5), alto: 0.029, radio: 0.04 };
}

function crearTarta() {
  const angulo = 0.95;
  const partes = [
    pintar(cuna(0.11, 0.022, angulo, 12, 0.11), 0xf2d29b),                          // bizcocho
    pintar(cuna(0.112, 0.008, angulo, 12, 0.11).translate(0, 0.022, 0), 0xfff4e6),  // nata
    pintar(cuna(0.11, 0.022, angulo, 12, 0.11).translate(0, 0.03, 0), 0xe9c287),    // bizcocho
    pintar(cuna(0.114, 0.008, angulo, 12, 0.11).translate(0, 0.052, 0), 0xf48fb1),  // cobertura rosa
    pintar(new THREE.SphereGeometry(0.014, 10, 8).scale(1, 1.2, 1).translate(0, 0.072, -0.01), 0xe53935), // fresa
    pintar(new THREE.ConeGeometry(0.009, 0.008, 6).translate(0, 0.088, -0.01), 0x43a047),
  ];
  return { geo: fusionarColores(partes).rotateY(2.6), alto: 0.06, radio: 0.03 };
}

function crearQueso() {
  const partes = [pintar(cuna(0.1, 0.05, 0.9), 0xffcc4d)];
  // Agujeros: manchas más oscuras que asoman por encima y por los lados
  for (const [x, y, z, r] of [[0.012, 0.05, -0.01, 0.009], [-0.015, 0.05, 0.02, 0.006], [0.0, 0.05, -0.04, 0.007],
    [0.03, 0.025, 0.01, 0.007], [-0.032, 0.03, 0.0, 0.006], [0.0, 0.02, 0.035, 0.008]]) {
    partes.push(pintar(new THREE.SphereGeometry(r, 8, 6).scale(1, 0.35, 1).translate(x, y, z), 0xd9a21b));
  }
  return { geo: fusionarColores(partes).rotateY(1.1), alto: 0.051, radio: 0.025 };
}

function crearUvas() {
  const partes = [];
  // Racimo tumbado: más ancho cerca del tallo
  let i = 0;
  for (let fila = 0; fila < 5; fila++) {
    const n = 4 - Math.floor(fila / 2);
    for (let k = 0; k < n; k++) {
      const x = (k - (n - 1) / 2) * 0.029 + (fila % 2) * 0.006;
      const z = -0.045 + fila * 0.024;
      const y = 0.016 + (k % 2) * 0.004 + (fila < 2 ? 0.006 : 0);
      partes.push(pintar(new THREE.SphereGeometry(0.0165, 10, 8).translate(x, y, z), i++ % 3 ? 0x6a3d9a : 0x8650b8));
    }
  }
  // Segunda capa encima
  for (const [x, z] of [[-0.014, -0.03], [0.014, -0.03], [0, -0.008], [-0.012, 0.014], [0.012, 0.014]]) {
    partes.push(pintar(new THREE.SphereGeometry(0.0165, 10, 8).translate(x, 0.042, z), 0x7b47ab));
  }
  partes.push(pintar(new THREE.CylinderGeometry(0.003, 0.004, 0.05, 5).rotateX(1.2).translate(0, 0.04, -0.075), 0x6d4c2f));
  return { geo: fusionarColores(partes).rotateY(-0.7), alto: 0.058, radio: 0.025 };
}

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  // Mediodía de verano en un prado con colinas
  ctx.fondo(0x8ec9f0, { nubes: 0.45, sol: [0.5, 0.6, -0.6], niebla: [18, 60], paisaje: { tipo: 'colinas', color: 0x5b8a4a } });
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.42, 0.25), new THREE.Vector3(0, 0.78, -0.62));

  // ─── Prado ─────────────────────────────────────────────────────────────
  ctx.sueloBase(false);
  const suelo = new THREE.Mesh(
    R(new THREE.PlaneGeometry(40, 40).rotateX(-Math.PI / 2)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.cesped(0x5d9b3f, { tam: 512, repetir: [18, 18], semilla: 91 })) })),
  );
  raiz.add(suelo);
  raiz.add(ctx.arboles([
    { x: -4.5, z: -6, escala: 1.2 }, { x: 3.8, z: -7.5, escala: 1.4 }, { x: 7, z: -4, escala: 1.1 },
    { x: -8, z: -3, escala: 1.3 }, { x: -2, z: -11, escala: 1.6 }, { x: 10, z: -10, escala: 1.5 },
    { x: -11, z: -9, escala: 1.4 }, { x: 6.5, z: 3, escala: 1.2 }, { x: -6.5, z: 4, escala: 1.1 },
  ], { tipo: 'frondoso' }));
  // Setos con flores a lo lejos (una llamada de dibujo)
  const setos = new THREE.InstancedMesh(
    R(new THREE.IcosahedronGeometry(0.55, 1)),
    R(new THREE.MeshLambertMaterial({ color: 0x3f7a35, flatShading: true })),
    14,
  );
  const matriz = new THREE.Matrix4();
  const giro = new THREE.Quaternion();
  const escala = new THREE.Vector3();
  const pos = new THREE.Vector3();
  for (let i = 0; i < 14; i++) {
    const a = -1.25 + (i / 13) * 2.5;
    pos.set(Math.sin(a) * 5.2, 0.3, -Math.cos(a) * 5.2 - 0.6);
    escala.set(1.4 + (i % 2) * 0.4, 0.8 + (i % 3) * 0.2, 1.1);
    giro.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, a);
    setos.setMatrixAt(i, matriz.compose(pos, giro, escala));
  }
  raiz.add(setos);

  // ─── Mesa de picnic ────────────────────────────────────────────────────
  // Patas en A, travesaño y banco del otro lado, todo de madera en una sola malla
  const piezas = [];
  for (const x of [-0.62, 0.62]) {
    for (const lado of [-1, 1]) {
      piezas.push(new THREE.BoxGeometry(0.06, 0.86, 0.035).rotateX(lado * 0.5).translate(x, 0.37, MESA.centro));
    }
    piezas.push(new THREE.BoxGeometry(0.06, 0.05, 1.3).translate(x, 0.42, MESA.centro - 0.12)); // apoyo del banco
  }
  piezas.push(new THREE.BoxGeometry(1.3, 0.05, 0.05).translate(0, 0.3, MESA.centro));            // travesaño
  piezas.push(new THREE.BoxGeometry(1.52, 0.035, 0.84).translate(0, ALTURA_MESA, MESA.centro));  // tablero
  piezas.push(new THREE.BoxGeometry(1.5, 0.04, 0.26).translate(0, 0.46, MESA.centro - 0.68));     // banco
  const madera = new THREE.Mesh(
    R(fusionar(piezas)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.madera(0x9a6a40, { tam: 256, repetir: [2, 1], semilla: 92 })) })),
  );
  raiz.add(madera);
  // Mantel de cuadros vichy rojos que cae por los bordes
  const texMantel = R(ctx.texturaCanvas((g, tam, azarTex) => {
    g.fillStyle = '#fbf7f0';
    g.fillRect(0, 0, tam, tam);
    const n = 8;
    const c = tam / n;
    g.fillStyle = 'rgba(205,45,45,0.55)';
    for (let i = 0; i < n; i += 2) {
      g.fillRect(i * c, 0, c, tam);
      g.fillRect(0, i * c, tam, c);
    }
    // Trama de la tela
    for (let i = 0; i < 1600; i++) {
      g.fillStyle = `rgba(0,0,0,${azarTex() * 0.05})`;
      g.fillRect(azarTex() * tam, azarTex() * tam, 2, 1);
    }
  }, { tam: 256, repetir: [6, 3.3], semilla: 93 }));
  const mantel = new THREE.Mesh(
    R(new THREE.BoxGeometry(MESA.x * 2, 0.1, MESA.z[1] - MESA.z[0])),
    R(new THREE.MeshLambertMaterial({ map: texMantel })),
  );
  mantel.position.set(0, SUPERFICIE - 0.05, MESA.centro);
  raiz.add(mantel);
  const sombraMesa = ctx.crearSombra({ radio: 0.8, opacidad: 0.45 });
  sombraMesa.scale.set(2.0, 1, 1.5);
  sombraMesa.position.set(0.1, 0.004, MESA.centro - 0.15);
  raiz.add(sombraMesa);

  // Cesta de mimbre con su asa y jarra de limonada en las esquinas del fondo
  const texMimbre = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#8a5a2b';
    g.fillRect(0, 0, tam, tam);
    const n = 8;
    const c = tam / n;
    for (let f = 0; f < n; f++) {
      for (let k = 0; k < n; k++) {
        const claro = (f + k) % 2 === 0;
        const grad = g.createLinearGradient(k * c, f * c, k * c + (claro ? c : 0), f * c + (claro ? 0 : c));
        grad.addColorStop(0, '#b98446');
        grad.addColorStop(0.5, '#d9a865');
        grad.addColorStop(1, '#9a6a35');
        g.fillStyle = grad;
        g.fillRect(k * c + 1, f * c + 1, c - 2, c - 2);
      }
    }
  }, { tam: 128, repetir: [6, 2], semilla: 94 }));
  const cesta = new THREE.Mesh(
    R(fusionar([
      new THREE.LatheGeometry([new THREE.Vector2(0, 0), new THREE.Vector2(0.07, 0), new THREE.Vector2(0.085, 0.09), new THREE.Vector2(0.08, 0.095)], 16),
      new THREE.TorusGeometry(0.075, 0.007, 6, 16, Math.PI).translate(0, 0.09, 0),
    ])),
    R(new THREE.MeshLambertMaterial({ map: texMimbre, side: THREE.DoubleSide })),
  );
  cesta.position.set(0.62, SUPERFICIE, -0.93);
  cesta.rotation.y = 0.5;
  const jarra = new THREE.Mesh(
    R(fusionar([
      new THREE.LatheGeometry([
        new THREE.Vector2(0, 0), new THREE.Vector2(0.045, 0), new THREE.Vector2(0.055, 0.04), new THREE.Vector2(0.05, 0.11),
        new THREE.Vector2(0.038, 0.15), new THREE.Vector2(0.042, 0.165), new THREE.Vector2(0.036, 0.165),
      ], 16),
      new THREE.TorusGeometry(0.035, 0.007, 6, 12, Math.PI).rotateZ(-Math.PI / 2).translate(0.05, 0.085, 0),
    ])),
    R(new THREE.MeshPhongMaterial({ color: 0xffe66b, emissive: 0x332a00, shininess: 80 })),
  );
  jarra.position.set(-0.64, SUPERFICIE, -0.92);
  raiz.add(cesta, jarra);
  for (const [x, z, r] of [[0.62, -0.93, 0.1], [-0.64, -0.92, 0.07]]) {
    const s = ctx.crearSombra({ radio: r, opacidad: 0.4 });
    s.position.set(x + 0.02, SUPERFICIE + 0.002, z - 0.01);
    raiz.add(s);
  }

  // ─── Platos y comida ───────────────────────────────────────────────────
  const POSICIONES = [[-0.42, -0.76], [0, -0.78], [0.42, -0.76], [-0.21, -0.44], [0.21, -0.44]];
  const perfilPlato = [[0, 0], [0.075, 0], [0.08, 0.003], [0.108, 0.013], [0.117, 0.017], [0.114, 0.019], [0.105, 0.016], [0.078, 0.007], [0, 0.007]]
    .map(([x, y]) => new THREE.Vector2(x, y));
  const platosGeo = POSICIONES.map(([x, z]) => new THREE.LatheGeometry(perfilPlato, 24).translate(x, SUPERFICIE, z));
  raiz.add(new THREE.Mesh(R(fusionar(platosGeo)), R(new THREE.MeshPhongMaterial({ color: 0xf7f4ee, shininess: 60, specular: 0x555555 }))));

  const geoAro = R(new THREE.RingGeometry(0.122, 0.136, 32).rotateX(-Math.PI / 2));
  const comidas = [crearBocadillo(), crearSandia(), crearTarta(), crearQueso(), crearUvas()];
  const platos = comidas.map((comida, i) => {
    const [x, z] = POSICIONES[i];
    const mat = R(new THREE.MeshLambertMaterial({ vertexColors: true }));
    const malla = new THREE.Mesh(R(comida.geo), mat);
    malla.position.set(x, Y_PLATO, z);
    const aroMat = R(new THREE.MeshBasicMaterial({ color: 0xffd54f, transparent: true, depthWrite: false, toneMapped: false }));
    const aro = new THREE.Mesh(geoAro, aroMat);
    aro.position.set(x, SUPERFICIE + 0.003, z);
    aro.visible = false;
    raiz.add(malla, aro);
    return {
      malla, mat, aro, aroMat, x, z,
      arriba: Y_PLATO + comida.alto, radio: comida.radio,
      centro: new THREE.Vector3(x, Y_PLATO + comida.alto, z),
      podrido: false, progreso: 0, anim: 1, hedor: 0, apuntadas: 0,
    };
  });

  // ─── Moscas ────────────────────────────────────────────────────────────
  // Todas en dos mallas instanciadas (cuerpos y alas): dos llamadas de dibujo para todas.
  // Cuerpo mirando hacia +Z: tórax, abdomen, cabeza con los ojos rojos y seis patas.
  const partesMosca = [
    pintar(new THREE.SphereGeometry(0.0034, 10, 8).scale(1, 0.9, 1.1), 0x9a9aa2),                         // tórax
    pintar(new THREE.SphereGeometry(0.0036, 10, 8).scale(1, 0.75, 1.45).translate(0, -0.0003, -0.0055), 0x8a8a92), // abdomen
    pintar(new THREE.SphereGeometry(0.0025, 8, 6).translate(0, 0.0003, 0.0043), 0x6a6a70),               // cabeza
    pintar(new THREE.SphereGeometry(0.0017, 8, 6).translate(0.0017, 0.0008, 0.0047), 0xc62828),          // ojos
    pintar(new THREE.SphereGeometry(0.0017, 8, 6).translate(-0.0017, 0.0008, 0.0047), 0xc62828),
  ];
  for (const lado of [-1, 1]) {
    for (const z of [0.0022, 0, -0.0022]) {
      partesMosca.push(pintar(new THREE.CylinderGeometry(0.00035, 0.0004, 0.0065, 3)
        .rotateZ(lado * 0.9).rotateY(lado * z * 120).translate(lado * 0.0035, -0.0028, z), 0x202024));
    }
  }
  const geoMosca = R(fusionarColores(partesMosca));
  const moscasCuerpo = new THREE.InstancedMesh(geoMosca, R(new THREE.MeshLambertMaterial({ vertexColors: true })), MAX_MOSCAS);
  const geoAlas = R(fusionar([
    new THREE.CircleGeometry(1, 12).scale(0.0026, 0.0058, 1).rotateX(-Math.PI / 2).rotateY(0.5).translate(0.0028, 0.0028, -0.004),
    new THREE.CircleGeometry(1, 12).scale(0.0026, 0.0058, 1).rotateX(-Math.PI / 2).rotateY(-0.5).translate(-0.0028, 0.0028, -0.004),
  ], ['position', 'normal']));
  const moscasAlas = new THREE.InstancedMesh(geoAlas, R(new THREE.MeshBasicMaterial({
    color: 0xdfe8f2, transparent: true, opacity: 0.55, side: THREE.DoubleSide, depthWrite: false,
  })), MAX_MOSCAS);
  // Sombras de mancha, también instanciadas (con el material de las sombras de la shell)
  const sombraBase = ctx.crearSombra({ opacidad: 0.4 });
  R(sombraBase.material);
  const moscasSombra = new THREE.InstancedMesh(R(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), sombraBase.material, MAX_MOSCAS);
  moscasSombra.renderOrder = -1;
  for (const malla of [moscasCuerpo, moscasAlas, moscasSombra]) {
    malla.frustumCulled = false; // se mueven por toda la escena
    malla.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    raiz.add(malla);
  }
  const TINTE_NORMAL = new THREE.Color(0x56565c);
  const TINTE_MOSCARDA = new THREE.Color(0x35d46a);
  for (let i = 0; i < MAX_MOSCAS; i++) moscasCuerpo.setColorAt(i, TINTE_NORMAL);

  const moscas = [];
  for (let i = 0; i < MAX_MOSCAS; i++) {
    moscas.push({
      i,
      estado: 'libre', // 'libre' | 'llega' | 'ronda' | 'baja' | 'posada' | 'aplastada' | 'huye'
      pos: new THREE.Vector3(),
      vel: new THREE.Vector3(),
      destino: new THREE.Vector3(),
      plato: null,
      tiempo: 0, fase: 0, velocidad: 0, rumbo: 0, posada: 0, angulo: 0, cae: false, moscarda: false,
    });
  }

  // ─── Matamoscas ────────────────────────────────────────────────────────
  // Mango torneado con empuñadura de goma acanalada y anilla para colgarlo; paleta con marco y rejilla.
  // Las geometrías se comparten; cada color tiene su plástico.
  const texRejilla = R(ctx.texturaCanvas((g, tam) => {
    g.clearRect(0, 0, tam, tam);
    g.fillStyle = 'rgba(255,255,255,1)';
    for (let i = 0; i <= 12; i++) {
      g.fillRect((i / 12) * tam - 2, 0, 4, tam);
      g.fillRect(0, (i / 12) * tam - 2, tam, 4);
    }
    // Rombos de refuerzo en las esquinas de la rejilla
    for (let i = 1; i < 12; i += 2) {
      for (let k = 1; k < 12; k += 2) {
        g.beginPath();
        g.arc((i / 12) * tam, (k / 12) * tam, 3, 0, Math.PI * 2);
        g.fill();
      }
    }
  }, { tam: 128, semilla: 95 }));
  const ANCHO_PALETA = 0.112;
  const LARGO_PALETA = 0.13;
  const formaMarco = new THREE.Shape();
  const redondeado = (forma, w, h, r) => {
    forma.moveTo(-w / 2 + r, -h / 2);
    forma.lineTo(w / 2 - r, -h / 2);
    forma.quadraticCurveTo(w / 2, -h / 2, w / 2, -h / 2 + r);
    forma.lineTo(w / 2, h / 2 - r);
    forma.quadraticCurveTo(w / 2, h / 2, w / 2 - r, h / 2);
    forma.lineTo(-w / 2 + r, h / 2);
    forma.quadraticCurveTo(-w / 2, h / 2, -w / 2, h / 2 - r);
    forma.lineTo(-w / 2, -h / 2 + r);
    forma.quadraticCurveTo(-w / 2, -h / 2, -w / 2 + r, -h / 2);
    return forma;
  };
  redondeado(formaMarco, ANCHO_PALETA, LARGO_PALETA, 0.024);
  formaMarco.holes.push(redondeado(new THREE.Path(), ANCHO_PALETA - 0.012, LARGO_PALETA - 0.012, 0.019));
  // Perfil del mango: anilla al final, empuñadura gruesa y varilla que se estrecha hasta la paleta
  const perfilMango = [[0, 0], [0.008, 0.001], [0.0115, 0.008], [0.012, 0.13], [0.009, 0.15], [0.006, 0.175],
    [0.0055, 0.33], [0.0065, 0.36], [0.003, 0.37], [0, 0.37]].map(([r, y]) => new THREE.Vector2(r, y));
  const perfilGoma = [];
  for (let k = 0; k <= 22; k++) perfilGoma.push(new THREE.Vector2(k % 2 ? 0.0132 : 0.0124, 0.015 + k * 0.005));
  const ORIGEN_MANGO = 0.06; // el extremo del mango sobresale un poco por detrás del puño
  const aMango = (g) => g.rotateX(-Math.PI / 2).translate(0, 0, ORIGEN_MANGO);
  const geoPlastico = R(fusionar([
    aMango(new THREE.LatheGeometry(perfilMango, 12)),
    new THREE.TorusGeometry(0.0085, 0.0022, 6, 14).rotateY(Math.PI / 2).translate(0, 0, ORIGEN_MANGO + 0.007), // anilla
    new THREE.BoxGeometry(0.018, 0.0045, 0.035).translate(0, 0, CENTRO_PALETA + LARGO_PALETA / 2 + 0.012), // lengüeta
    new THREE.ExtrudeGeometry(formaMarco, { depth: 0.0045, bevelEnabled: false, curveSegments: 4 })
      .rotateX(-Math.PI / 2).translate(0, -0.00225, CENTRO_PALETA),                                    // marco
  ]));
  const geoGoma = R(aMango(new THREE.LatheGeometry(perfilGoma, 12)));
  const geoRejilla = R(new THREE.PlaneGeometry(ANCHO_PALETA - 0.008, LARGO_PALETA - 0.008).rotateX(-Math.PI / 2).translate(0, 0, CENTRO_PALETA));
  const matGoma = R(new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.85 }));
  const materialesMatamoscas = (color) => ({
    plastico: R(new THREE.MeshStandardMaterial({ color, roughness: 0.38, metalness: 0.05 })),
    rejilla: R(new THREE.MeshStandardMaterial({ color, map: texRejilla, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5 })),
  });
  const plasticos = { [AZUL]: materialesMatamoscas(AZUL), [AMARILLO]: materialesMatamoscas(AMARILLO) };
  function crearMatamoscas(color) {
    const objeto = new THREE.Group();
    const m = plasticos[color];
    objeto.add(new THREE.Mesh(geoPlastico, m.plastico), new THREE.Mesh(geoGoma, matGoma), new THREE.Mesh(geoRejilla, m.rejilla));
    return objeto;
  }
  const palas = ctx.manos.map((mano, i) => ({
    mano,
    objeto: ctx.adjuntarAMano(mano, crearMatamoscas(i === 0 ? AZUL : AMARILLO)),
    centro: new THREE.Vector3(),
    anterior: new THREE.Vector3(),
    lista: false,
  }));

  // El del ratón: la paleta sobre el cursor, plana encima de la mesa y el mango hacia ti
  const pivote = new THREE.Group();
  const palaRaton = crearMatamoscas(AMARILLO);
  palaRaton.position.z = -CENTRO_PALETA; // el centro de la paleta en el pivote
  pivote.add(palaRaton);
  pivote.rotation.order = 'YXZ';
  raiz.add(pivote);
  const sombraPala = ctx.crearSombra({ radio: 0.07, opacidad: 0.35 });
  raiz.add(sombraPala);
  const planoMesa = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(SUPERFICIE + 0.03));
  const puntoRaton = new THREE.Vector3(0, SUPERFICIE + 0.03, -0.6);
  let golpeRaton = 0; // segundos que quedan de la animación del golpe

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.2, alto: 0.3 });
  // Detrás de la mesa y algo inclinado hacia arriba: se lee mirando la comida y no tapa nada
  marcador.mesh.position.set(0, 1.12, -1.32);
  marcador.mesh.rotation.x = -0.3;
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  const zumbido = ctx.sonidoContinuo('mosca');
  let puntos = 0;
  let record = ctx.leer('record', 0);
  let estado = 'intro'; // 'intro' | 'jugando' | 'fin'
  let reloj = 3;
  let tiempoJugado = 0;
  let proximo = 0;
  let aviso = null; // { texto, color, tiempo }
  let tiempo = 0;

  const cabeza = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const segmento = new THREE.Line3();
  const escalaV = new THREE.Vector3();
  const ejeY = new THREE.Vector3(0, 1, 0);
  const ejeZ = new THREE.Vector3(0, 0, 1);
  const giroZ = new THREE.Quaternion();

  const dificultad = () => Math.min(1, tiempoJugado / DIFICULTAD_MAX);
  const nivel = () => 1 + Math.floor(tiempoJugado / NIVEL_SEGUNDOS);
  const vivas = (m) => m.estado === 'llega' || m.estado === 'ronda' || m.estado === 'baja' || m.estado === 'posada';
  const platosSanos = () => platos.reduce((n, p) => n + (p.podrido ? 0 : 1), 0);
  const sobreMesa = (p) => Math.abs(p.x) < MESA.x && p.z > MESA.z[0] && p.z < MESA.z[1];

  function actualizarMarcador() {
    const lineas = estado === 'intro'
      ? [{ texto: ctx.t('titulo'), tam: 1.2, color: '#ffe082' }, { texto: ctx.t('intro'), tam: 0.72 }]
      : estado === 'fin'
        ? [{ texto: ctx.t('fin', { n: puntos }), tam: 1.2, color: '#ffe082' }, { texto: ctx.t('partida.recordNuevaPartida', { record, n: Math.ceil(reloj) }), tam: 0.75 }]
        : [{ texto: ctx.t('marcador', { n: puntos }), tam: 1.3 },
          aviso ? { texto: aviso.texto, tam: 0.8, color: aviso.color }
            : { texto: ctx.t('platos', { n: platosSanos(), record }), tam: 0.78, color: '#c5e1a5' }];
    marcador.escribir(lineas);
  }
  const avisar = (texto, color, duracion = 1.3) => { aviso = { texto, color, tiempo: duracion }; };

  // El plato sano al que van menos moscas (si hay empate, uno cualquiera)
  function elegirPlato() {
    let mejor = null;
    for (const p of platos) {
      if (p.podrido) continue;
      if (!mejor || p.apuntadas < mejor.apuntadas || (p.apuntadas === mejor.apuntadas && Math.random() < 0.5)) mejor = p;
    }
    return mejor;
  }

  function apuntar(m, plato) {
    if (m.plato) m.plato.apuntadas--;
    m.plato = plato;
    if (plato) plato.apuntadas++;
  }

  function soltarMosca() {
    const m = moscas.find((x) => x.estado === 'libre');
    const plato = elegirPlato();
    if (!m || !plato) return;
    const d = dificultad();
    // Llega desde el jardín, por delante o por los lados (nunca por detrás)
    const a = azar(-1.4, 1.4);
    const r = azar(2.0, 2.6);
    m.pos.set(Math.sin(a) * r, azar(0.95, 1.7), MESA.centro - Math.cos(a) * r);
    m.vel.set(0, 0, 0);
    m.moscarda = tiempoJugado > 20 && Math.random() < 0.13;
    m.velocidad = azar(0.45, 0.6) * (1 + d) * (m.moscarda ? 1.25 : 1);
    m.fase = Math.random() * 100;
    m.cae = false;
    moscasCuerpo.setColorAt(m.i, m.moscarda ? TINTE_MOSCARDA : TINTE_NORMAL);
    moscasCuerpo.instanceColor.needsUpdate = true;
    apuntar(m, plato);
    irAlPlato(m);
  }

  function irAlPlato(m) {
    m.estado = 'llega';
    m.destino.set(m.plato.x + azar(-0.05, 0.05), m.plato.arriba + azar(0.12, 0.2), m.plato.z + azar(-0.05, 0.05));
  }

  function retirar(m) {
    apuntar(m, null);
    m.estado = 'libre';
  }

  function huir(m) {
    apuntar(m, null);
    m.estado = 'huye';
    m.tiempo = 1.4;
    m.vel.set(azar(-0.6, 0.6), 1.2, azar(-0.8, -0.2));
  }

  // Vuelo con quiebros: se dirige al destino con giros rápidos y pequeñas sacudidas
  function volar(m, destino, velocidad, firmeza, dt) {
    tmp.subVectors(destino, m.pos);
    const distancia = tmp.length();
    tmp.normalize().multiplyScalar(Math.min(velocidad, distancia * 4 + 0.05));
    m.vel.lerp(tmp, 1 - Math.exp(-dt * firmeza));
    m.fase += dt;
    const temblor = 0.5 * velocidad;
    m.vel.x += Math.sin(m.fase * 13.1) * temblor * dt * 6;
    m.vel.y += Math.sin(m.fase * 10.3 + 1.3) * temblor * dt * 4;
    m.vel.z += Math.cos(m.fase * 8.7) * temblor * dt * 6;
    m.pos.addScaledVector(m.vel, dt);
    if (m.vel.x * m.vel.x + m.vel.z * m.vel.z > 1e-4) m.rumbo = Math.atan2(m.vel.x, m.vel.z);
    return distancia;
  }

  function aplastar(m, mano) {
    if (!vivas(m)) return;
    const alVuelo = m.estado !== 'posada';
    const valor = (alVuelo ? 2 : 1) * (m.moscarda ? 2 : 1);
    apuntar(m, null);
    m.estado = 'aplastada';
    m.tiempo = 1.1;
    m.cae = alVuelo;
    m.vel.set(0, alVuelo ? 0.3 : 0, 0);
    m.angulo = azar(-0.6, 0.6);
    if (estado !== 'jugando') return;
    puntos += valor;
    const nivelImpacto = alVuelo && m.moscarda ? 'grande' : alVuelo || m.moscarda ? 'medio' : 'pequeño';
    ctx.efectos.impacto(nivelImpacto, { pos: m.pos, mano, color: m.moscarda ? 0x76ff03 : 0xffe082, sonido: 'plaf' });
    ctx.efectos.texto(tmp2.copy(m.pos).setY(m.pos.y + 0.05), `+${valor}`, {
      color: m.moscarda ? '#b2ff59' : alVuelo ? '#ffe082' : '#ffffff', tam: valor >= 4 ? 1.3 : valor >= 2 ? 1.1 : 0.9,
    });
    if (m.moscarda) avisar(ctx.t('moscarda'), '#b2ff59');
    else if (alVuelo) avisar(ctx.t('alVuelo'), '#ffe082', 0.9);
  }

  function pudrir(plato) {
    plato.podrido = true;
    plato.anim = 0;
    plato.progreso = 0;
    plato.aro.visible = false;
    ctx.sonido('podrido');
    ctx.destello(0x7c8f2a, 0.35);
    for (const mano of ctx.manos) ctx.vibrar(mano, 0.9, 160);
    ctx.efectos.estallido(plato.centro, { color: 0x9ccc65, cantidad: 16, fuerza: 0.7, gravedad: -1.2, vida: 0.9, tam: 0.014 });
    // Las moscas de ese plato se van a otro
    for (const m of moscas) {
      if (m.plato !== plato || !vivas(m)) continue;
      const otro = elegirPlato();
      if (otro) { apuntar(m, otro); irAlPlato(m); } else huir(m);
    }
    if (platosSanos() === 0) terminar();
    else avisar(ctx.t('podrido'), '#dce775', 1.6);
  }

  function terminar() {
    estado = 'fin';
    reloj = 6;
    aviso = null;
    ctx.puntuacion(puntos); // a la clasificación (juegos/marcadores.js)
    if (puntos > record) {
      record = puntos;
      ctx.guardar('record', record);
    }
    ctx.sonido('fin');
    for (const m of moscas) if (vivas(m)) huir(m);
  }

  function empezar() {
    estado = 'jugando';
    puntos = 0;
    tiempoJugado = 0;
    proximo = 0.8;
    aviso = null;
    // Comida recién servida: los platos podridos se cambian por otros con un pequeño salto
    for (const p of platos) {
      if (p.podrido) p.anim = 0;
      p.podrido = false;
      p.progreso = 0;
    }
  }

  // ─── Golpes con los mandos ─────────────────────────────────────────────
  function golpesVR(dt) {
    for (const pala of palas) {
      if (!pala.mano.activa) {
        pala.lista = false;
        continue;
      }
      pala.mano.grip.localToWorld(pala.centro.set(0, 0, CENTRO_PALETA));
      if (pala.lista && pala.centro.distanceTo(pala.anterior) / dt > VELOCIDAD_GOLPE_VR) {
        // Todo el recorrido de la paleta en este fotograma, para no "atravesar" moscas en golpes rápidos
        segmento.set(pala.anterior, pala.centro);
        let acierto = false;
        for (const m of moscas) {
          if (!vivas(m)) continue;
          segmento.closestPointToPoint(m.pos, true, tmp);
          if (tmp.distanceTo(m.pos) < RADIO_PALETA) {
            aplastar(m, pala.mano);
            acierto = true;
          }
        }
        // Golpe en el mantel sin mosca: un golpe seco, distinto del acierto
        if (!acierto && pala.anterior.y > SUPERFICIE + 0.01 && pala.centro.y <= SUPERFICIE + 0.01 && sobreMesa(pala.centro)) {
          ctx.sonido('toc');
          ctx.vibrar(pala.mano, 0.3, 25);
        }
      }
      pala.anterior.copy(pala.centro);
      pala.lista = true;
    }
  }

  // ─── Golpes con el ratón o el dedo ─────────────────────────────────────
  function golpesRaton(dt) {
    const raton = ctx.raton;
    pivote.visible = raton.dentro || ctx.tactil;
    const rayo = raton.rayo.ray;
    if (rayo.intersectPlane(planoMesa, tmp)) {
      puntoRaton.set(THREE.MathUtils.clamp(tmp.x, -0.8, 0.8), tmp.y, THREE.MathUtils.clamp(tmp.z, -1.1, -0.15));
    }
    if (raton.clic) {
      golpeRaton = 0.16;
      ctx.sonido('zas');
      // Acierta si la mosca está bajo la paleta tal como se ve: se corta el rayo a la altura de cada mosca
      let acierto = false;
      for (const m of moscas) {
        if (!vivas(m) || Math.abs(rayo.direction.y) < 1e-3) continue;
        const d = (m.pos.y - rayo.origin.y) / rayo.direction.y;
        if (d <= 0) continue;
        rayo.at(d, tmp);
        if (Math.hypot(tmp.x - m.pos.x, tmp.z - m.pos.z) < RADIO_RATON) {
          aplastar(m, null);
          acierto = true;
        }
      }
      if (!acierto) ctx.sonido('toc');
    }
    golpeRaton = Math.max(0, golpeRaton - dt);
    // La paleta baja de golpe hasta el mantel y vuelve a subir despacio
    const bajada = golpeRaton > 0.11 ? (0.16 - golpeRaton) / 0.05 : golpeRaton / 0.11;
    pivote.position.set(puntoRaton.x, puntoRaton.y + 0.1 * (1 - bajada) - 0.022 * bajada, puntoRaton.z);
    // El mango hacia la cámara y hacia arriba; al golpear, casi plana
    pivote.rotation.y = Math.atan2(cabeza.x - puntoRaton.x, cabeza.z - puntoRaton.z);
    pivote.rotation.x = -(0.45 - 0.35 * bajada);
    ctx.colocarSombra(sombraPala, pivote.position, SUPERFICIE);
    sombraPala.visible = pivote.visible;
  }

  // ─── Dibujo de las moscas ──────────────────────────────────────────────
  function colocarMosca(m) {
    if (m.estado === 'libre') {
      escalaV.set(0, 0, 0);
      matriz.compose(m.pos, giro.identity(), escalaV);
      moscasCuerpo.setMatrixAt(m.i, matriz);
      moscasAlas.setMatrixAt(m.i, matriz);
      moscasSombra.setMatrixAt(m.i, matriz);
      return;
    }
    const s = ESCALA * (m.moscarda ? 1.25 : 1);
    giro.setFromAxisAngle(ejeY, m.rumbo);
    if (m.estado === 'aplastada') {
      giro.multiply(giroZ.setFromAxisAngle(ejeZ, m.angulo));
      const f = Math.min(1, m.tiempo / 0.3); // al final encoge y desaparece
      escalaV.set(s * 1.5 * f, s * 0.3 * f, s * 1.3 * f);
    } else {
      escalaV.setScalar(s);
    }
    matriz.compose(m.pos, giro, escalaV);
    moscasCuerpo.setMatrixAt(m.i, matriz);
    // Alas: aleteo muy rápido en vuelo (se ve como un borrón); quietas y plegadas al posarse
    const volando = m.estado !== 'posada' && m.estado !== 'aplastada';
    if (volando) escalaV.x *= 0.35 + Math.abs(Math.sin(tiempo * 90 + m.fase * 7)) * 0.9;
    else if (m.estado === 'posada') escalaV.x *= 0.6;
    matriz.compose(m.pos, giro, escalaV);
    moscasAlas.setMatrixAt(m.i, matriz);
    // Sombra en el mantel (o en la comida si está posada) o en la hierba
    const ySuelo = m.estado === 'posada' || (m.estado === 'aplastada' && !m.cae) ? m.pos.y - 0.004
      : sobreMesa(m.pos) ? SUPERFICIE + 0.003 : 0.004;
    const altura = Math.max(0, m.pos.y - ySuelo);
    tmp.set(m.pos.x, ySuelo, m.pos.z);
    escalaV.setScalar(0.022 * (m.moscarda ? 1.25 : 1) * (1 + altura * 1.5) * (m.estado === 'aplastada' ? 0 : 1));
    matriz.compose(tmp, giro.identity(), escalaV);
    moscasSombra.setMatrixAt(m.i, matriz);
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function actualizar(dt) {
    tiempo += dt;
    reloj -= dt;
    ctx.camara.getWorldPosition(cabeza);
    if ((estado === 'intro' || estado === 'fin') && reloj <= 0) empezar();

    if (estado === 'jugando') {
      const nivelAntes = nivel();
      tiempoJugado += dt;
      if (nivel() > nivelAntes) {
        avisar(ctx.t('masMoscas'), '#ffe082', 2);
        ctx.sonido('punto');
      }
      // Cada vez llegan más seguidas y caben más a la vez
      const d = dificultad();
      proximo -= dt;
      let activas = 0;
      for (const m of moscas) if (vivas(m)) activas++;
      if (proximo <= 0 && activas < Math.round(2 + d * 8)) {
        soltarMosca();
        if (Math.random() < d * 0.35) soltarMosca(); // a veces, de dos en dos
        proximo = (2.4 - d * 1.7) * azar(0.75, 1.25);
      }
    }
    if (aviso && (aviso.tiempo -= dt) <= 0) aviso = null;

    // Moscas
    const d = dificultad();
    let cercania = 0;
    let enVuelo = 0;
    for (const p of platos) p.progreso = 0;
    for (const m of moscas) {
      if (m.estado === 'llega') {
        if (volar(m, m.destino, m.velocidad, 3, dt) < 0.05) {
          m.estado = 'ronda';
          m.tiempo = azar(0.8, 1.4) * (1 - d * 0.6);
          m.angulo = Math.atan2(m.pos.x - m.plato.x, m.pos.z - m.plato.z);
        }
      } else if (m.estado === 'ronda') {
        // Vueltas sobre el plato antes de posarse: el aviso para el jugador
        m.angulo += dt * (4 + m.velocidad * 3);
        m.destino.set(
          m.plato.x + Math.sin(m.angulo) * 0.07,
          m.plato.arriba + 0.1 + Math.sin(m.angulo * 1.7) * 0.03,
          m.plato.z + Math.cos(m.angulo) * 0.07,
        );
        volar(m, m.destino, m.velocidad * 1.2, 8, dt);
        m.tiempo -= dt;
        if (m.tiempo <= 0) {
          m.estado = 'baja';
          const a = Math.random() * Math.PI * 2;
          const r = Math.sqrt(Math.random()) * m.plato.radio;
          m.destino.set(m.plato.x + Math.cos(a) * r, m.plato.arriba + 0.008, m.plato.z + Math.sin(a) * r);
        }
      } else if (m.estado === 'baja') {
        if (volar(m, m.destino, m.velocidad * 0.7, 10, dt) < 0.012) {
          m.estado = 'posada';
          m.posada = 0;
          m.pos.copy(m.destino);
          m.vel.set(0, 0, 0);
        }
      } else if (m.estado === 'posada') {
        // Se frota las patas y gira un poco en el sitio
        m.fase += dt;
        m.rumbo += Math.sin(m.fase * 3.1) * dt * 1.5;
        if (estado === 'jugando') {
          m.posada += dt;
          m.plato.progreso = Math.max(m.plato.progreso, m.posada / TIEMPO_PUDRIR);
          if (m.posada >= TIEMPO_PUDRIR) pudrir(m.plato);
        }
      } else if (m.estado === 'aplastada') {
        if (m.cae) {
          m.vel.y -= 9 * dt;
          m.pos.addScaledVector(m.vel, dt);
          const ySuelo = sobreMesa(m.pos) ? SUPERFICIE + 0.002 : 0.002;
          if (m.pos.y <= ySuelo) { m.pos.y = ySuelo; m.vel.set(0, 0, 0); }
        }
        m.tiempo -= dt;
        if (m.tiempo <= 0) retirar(m);
      } else if (m.estado === 'huye') {
        m.pos.addScaledVector(m.vel, dt);
        m.tiempo -= dt;
        if (m.tiempo <= 0) retirar(m);
      }
      if (vivas(m) || m.estado === 'huye') {
        if (m.estado !== 'posada') enVuelo++;
        cercania = Math.max(cercania, 1 - Math.min(1, m.pos.distanceTo(cabeza) / 2));
      }
      colocarMosca(m);
    }
    moscasCuerpo.instanceMatrix.needsUpdate = true;
    moscasAlas.instanceMatrix.needsUpdate = true;
    moscasSombra.instanceMatrix.needsUpdate = true;
    // El zumbido sube con las moscas que vuelan y con la más cercana
    zumbido.ajustar(cercania, enVuelo ? Math.min(0.16, 0.025 + enVuelo * 0.012 + cercania * cercania * 0.08) : 0);

    // Platos: aviso de que se pudre (aro y color), los podridos echan peste y los nuevos salen con un salto
    for (const p of platos) {
      p.anim = Math.min(1, p.anim + dt / 0.45);
      if (p.podrido) {
        p.mat.color.copy(COLOR_FRESCO).lerp(COLOR_PODRIDO, p.anim);
        p.malla.scale.set(1 + p.anim * 0.06, 1 - p.anim * 0.3, 1 + p.anim * 0.06);
        p.hedor -= dt;
        if (p.hedor <= 0) {
          p.hedor = azar(0.35, 0.6);
          ctx.efectos.estallido(p.centro, { color: 0x9ccc65, cantidad: 2, fuerza: 0.22, gravedad: -0.9, vida: 1.1, tam: 0.012 });
        }
        p.aro.visible = false;
      } else {
        // Al servir: crece con un rebote (sobrepasa un poco y vuelve)
        const f = p.anim;
        const rebote = 1 + 2.2 * Math.pow(f - 1, 3) + 1.2 * Math.pow(f - 1, 2);
        const avisoPodrido = Math.min(1, p.progreso);
        p.malla.scale.setScalar(rebote * (1 + Math.sin(tiempo * 40) * 0.025 * avisoPodrido));
        p.mat.color.copy(COLOR_FRESCO).lerp(COLOR_PODRIDO, avisoPodrido * 0.55);
        p.aro.visible = avisoPodrido > 0;
        if (p.aro.visible) {
          p.aroMat.color.copy(COLOR_AVISO).lerp(COLOR_PELIGRO, avisoPodrido);
          p.aroMat.opacity = 0.45 + avisoPodrido * 0.5;
          p.aro.scale.setScalar(1 + Math.sin(tiempo * 22) * 0.04 * avisoPodrido);
        }
      }
    }

    if (ctx.enVR()) {
      pivote.visible = false;
      sombraPala.visible = false;
      golpesVR(dt);
    } else {
      golpesRaton(dt);
    }
    actualizarMarcador();
  }

  for (const m of moscas) colocarMosca(m);
  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      // La shell retira lo que hay en la escena y en las manos, los recursos registrados y el zumbido.
      moscas.length = 0;
      platos.length = 0;
    },
  };
}
