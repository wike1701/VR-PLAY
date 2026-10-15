// BALANCEO
// Número de circo: llevas una escoba del revés en equilibrio sobre la palma de la mano, en el centro de
// la pista, y los cañones de alrededor te disparan cubitos de colores. Hay que moverse bajo la escoba
// para que no se caiga y, a la vez, apartarla de los cubos. Cada cubo esquivado vale 1 punto (3 si pasa
// rozando) y cada 15 segundos seguidos en equilibrio, 5 más. Con 3 golpes o si se cae la escoba, se
// acaba la partida. Cada vez la escoba pesa más (cae más deprisa) y llegan más cubos y más rápidos.
// En VR: la escoba va de pie sobre la mano (en 3D). Con ratón o en el móvil: la mano sigue al cursor o
// al dedo a izquierda y derecha, y la escoba solo se inclina hacia los lados.
// (Sugerencia #8 del foro.)
import * as THREE from 'three';

// Todo se genera con código: no hay nada que descargar.
export async function precargar() {}

const LARGO = 1.0;                  // de la mano al centro del cepillo (donde está el peso)
const INICIO_CEPILLO = 0.8;         // donde empieza el cepillo, contado desde la mano
const FIN_CEPILLO = 1.16;
const RADIO_MANGO = 0.018;
const RADIO_CEPILLO = 0.075;
const ANGULO_CAIDA = Math.cos(THREE.MathUtils.degToRad(55)); // más inclinada que esto, se cae
const GRAVEDAD_INICIO = 2.7;        // "gravedad" de la escoba (m/s²): más baja que la real para que se pueda jugar
const GRAVEDAD_MAX = 5.2;
const DIFICULTAD_MAX = 120;         // segundos hasta la dificultad máxima
const NIVEL_SEGUNDOS = 30;          // cada 30 s, aviso de que llegan más cubos
const PREMIO_SEGUNDOS = 15;         // cada 15 s seguidos en equilibrio, 5 puntos
const VIDAS = 3;
const MAX_CUBOS = 10;
const LADO_CUBO = 0.13;
const RADIO_CUBO = LADO_CUBO * 0.62;
const POR_LOS_PELOS = 0.2;          // si el cubo pasa a menos de esto de la escoba, vale 3
const GRAVEDAD_CUBOS = 3;           // los cubos hacen una curva suave
const RADIO_CANONES = 5;
const Z_RATON = -0.9;               // con ratón, la mano se mueve en este plano
const Y_RATON = 1.05;
const COLORES_CUBOS = [0xff5252, 0xffca28, 0x40c4ff, 0x69f0ae, 0xe040fb, 0xff9100];

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

// Cubo de juguete con las aristas redondeadas
function cuboRedondeado(lado, radio) {
  const g = new THREE.BoxGeometry(lado, lado, lado, 4, 4, 4);
  const pos = g.attributes.position;
  const nor = g.attributes.normal;
  const mitad = lado / 2 - radio;
  const v = new THREE.Vector3();
  const dentro = new THREE.Vector3();
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    dentro.set(THREE.MathUtils.clamp(v.x, -mitad, mitad), THREE.MathUtils.clamp(v.y, -mitad, mitad), THREE.MathUtils.clamp(v.z, -mitad, mitad));
    v.sub(dentro);
    if (v.lengthSq() > 1e-10) {
      v.normalize();
      nor.setXYZ(i, v.x, v.y, v.z);
      v.multiplyScalar(radio).add(dentro);
      pos.setXYZ(i, v.x, v.y, v.z);
    }
  }
  return g;
}

// Distancia (al cuadrado) entre dos segmentos p1-q1 y p2-q2. Deja en "fraccion" dónde cae en el segundo.
const d1 = new THREE.Vector3();
const d2 = new THREE.Vector3();
const rr = new THREE.Vector3();
const c1 = new THREE.Vector3();
const c2 = new THREE.Vector3();
let fraccion = 0;
function distanciaSegmentos(p1, q1, p2, q2) {
  d1.subVectors(q1, p1);
  d2.subVectors(q2, p2);
  rr.subVectors(p1, p2);
  const a = d1.dot(d1);
  const e = d2.dot(d2);
  const f = d2.dot(rr);
  let s = 0;
  let t = 0;
  const limitar = (x) => Math.min(1, Math.max(0, x));
  if (a < 1e-9 && e < 1e-9) {
    s = t = 0;
  } else if (a < 1e-9) {
    t = limitar(f / e);
  } else {
    const c = d1.dot(rr);
    if (e < 1e-9) {
      s = limitar(-c / a);
    } else {
      const b = d1.dot(d2);
      const den = a * e - b * b;
      s = den > 1e-9 ? limitar((b * f - c * e) / den) : 0;
      t = (b * s + f) / e;
      if (t < 0) { t = 0; s = limitar(-c / a); } else if (t > 1) { t = 1; s = limitar((b - c) / a); }
    }
  }
  c1.copy(p1).addScaledVector(d1, s);
  c2.copy(p2).addScaledVector(d2, t);
  fraccion = t;
  return c1.distanceToSquared(c2);
}

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  // Dentro de la carpa del circo, con los focos encendidos
  ctx.fondo(0x2a1830, { niebla: [14, 40] });
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.55, 1.25), new THREE.Vector3(0, 1.5, -0.9));
  ctx.sueloBase(false);

  // ─── Carpa ─────────────────────────────────────────────────────────────
  // Serrín en el suelo
  const suelo = new THREE.Mesh(
    R(new THREE.CircleGeometry(10.5, 48).rotateX(-Math.PI / 2)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.grano(0xc9a46a, { tam: 512, repetir: [10, 10], semilla: 81, cantidad: 1600 })) })),
  );
  raiz.add(suelo);
  // Lona a rayas rojas y crema: la pared y el techo cónico
  const texLona = R(ctx.texturaCanvas((g, tam, azarTex) => {
    const n = 4;
    for (let i = 0; i < n * 2; i++) {
      g.fillStyle = i % 2 ? '#f3e3c3' : '#c62f3a';
      g.fillRect((i * tam) / (n * 2), 0, tam / (n * 2) + 1, tam);
    }
    // Pliegues y costuras de la tela
    for (let i = 0; i < n * 2; i++) {
      const x = (i * tam) / (n * 2);
      const grad = g.createLinearGradient(x, 0, x + tam / (n * 2), 0);
      grad.addColorStop(0, 'rgba(0,0,0,0.18)');
      grad.addColorStop(0.5, 'rgba(255,255,255,0.06)');
      grad.addColorStop(1, 'rgba(0,0,0,0.12)');
      g.fillStyle = grad;
      g.fillRect(x, 0, tam / (n * 2), tam);
    }
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(0,0,0,${azarTex() * 0.05})`;
      g.fillRect(azarTex() * tam, azarTex() * tam, 2, 1);
    }
  }, { tam: 256, repetir: [12, 1], semilla: 82 }));
  const matLona = R(new THREE.MeshLambertMaterial({ map: texLona, side: THREE.BackSide }));
  raiz.add(new THREE.Mesh(R(new THREE.CylinderGeometry(10.5, 10.5, 4.6, 48, 1, true).translate(0, 2.3, 0)), matLona));
  raiz.add(new THREE.Mesh(R(new THREE.ConeGeometry(10.5, 6.5, 48, 1, true).translate(0, 4.6 + 3.25, 0)), matLona));
  // Mástiles a los lados, pista con su bordillo y gradas
  const madera = R(ctx.texturas.madera(0x7a4a2a, { tam: 256, repetir: [1, 3], semilla: 83 }));
  const piezasMadera = [];
  for (const x of [-2.6, 2.6]) piezasMadera.push(new THREE.CylinderGeometry(0.11, 0.14, 9.2, 12).translate(x, 4.6, 1.5));
  // Gradas: tres escalones en arco alrededor de la pista, con un hueco detrás para la entrada
  const perfilGradas = [[7.2, 0], [7.2, 0.42], [7.95, 0.42], [7.95, 0.84], [8.7, 0.84], [8.7, 1.26], [9.45, 1.26], [9.45, 1.7], [10.4, 1.7]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  piezasMadera.push(new THREE.LatheGeometry(perfilGradas, 48, Math.PI * 0.1, Math.PI * 1.8));
  raiz.add(new THREE.Mesh(R(fusionar(piezasMadera)), R(new THREE.MeshLambertMaterial({ map: madera, side: THREE.DoubleSide }))));
  // Cojines de colores en cada escalón de las gradas
  const cojines = [];
  for (let k = 0; k < 3; k++) {
    const r = 7.42 + k * 0.75;
    for (let i = 0; i < 36; i++) {
      const a = Math.PI * 0.12 + ((i + 0.5) / 36) * Math.PI * 1.76;
      cojines.push(pintar(new THREE.BoxGeometry(0.62, 0.08, 0.36).rotateY(a).translate(Math.sin(a) * r, 0.46 + k * 0.42, Math.cos(a) * r),
        [0xd32f2f, 0x1e5aa8, 0xf2c14e][(i + k) % 3]));
    }
  }
  raiz.add(new THREE.Mesh(R(fusionarColores(cojines)), R(new THREE.MeshLambertMaterial({ vertexColors: true }))));
  // Bordillo de la pista: rojo con una banda dorada
  const perfilBordillo = [[6.3, 0], [6.3, 0.38], [6.36, 0.42], [6.62, 0.42], [6.62, 0]].map(([x, y]) => new THREE.Vector2(x, y));
  const bordillo = pintar(new THREE.LatheGeometry(perfilBordillo, 64), 0xb3202c);
  const banda = pintar(new THREE.CylinderGeometry(6.29, 6.29, 0.08, 64, 1, true).translate(0, 0.24, 0), 0xf2c14e);
  raiz.add(new THREE.Mesh(R(fusionarColores([bordillo, banda])), R(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }))));
  // Estrella de colores en el centro de la pista, donde estás tú
  const estrella = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2;
    const r = i % 2 ? 0.5 : 1.15;
    if (i === 0) estrella.moveTo(Math.sin(a) * r, Math.cos(a) * r);
    else estrella.lineTo(Math.sin(a) * r, Math.cos(a) * r);
  }
  const alfombra = new THREE.Mesh(
    R(fusionarColores([
      pintar(new THREE.CircleGeometry(1.5, 40).rotateX(-Math.PI / 2).translate(0, 0.004, 0), 0x2a3f8f),
      pintar(new THREE.ShapeGeometry(estrella).rotateX(-Math.PI / 2).translate(0, 0.008, 0), 0xf2c14e),
    ])),
    R(new THREE.MeshLambertMaterial({ vertexColors: true })),
  );
  raiz.add(alfombra);
  // Banderines de colores desde lo alto de los mástiles hasta la pared (una malla)
  const banderines = [];
  const coloresBanderin = [0xff5252, 0xffca28, 0x40c4ff, 0x69f0ae, 0xe040fb];
  const p0 = new THREE.Vector3();
  const p1 = new THREE.Vector3();
  const pp = new THREE.Vector3();
  let nColor = 0;
  for (const x of [-2.6, 2.6]) {
    for (let k = 0; k < 7; k++) {
      const a = (k / 7) * Math.PI * 2 + (x > 0 ? 0.3 : 0.75);
      p0.set(x, 8.9, 1.5);
      p1.set(Math.sin(a) * 10.3, 4.5, Math.cos(a) * 10.3);
      const n = 12;
      for (let i = 1; i < n; i++) {
        const t = i / n;
        pp.lerpVectors(p0, p1, t);
        pp.y -= Math.sin(t * Math.PI) * 0.9; // la cuerda cuelga
        const tri = new THREE.BufferGeometry();
        const ancho = 0.22;
        const dx = (p1.x - p0.x) / Math.hypot(p1.x - p0.x, p1.z - p0.z);
        const dz = (p1.z - p0.z) / Math.hypot(p1.x - p0.x, p1.z - p0.z);
        tri.setAttribute('position', new THREE.Float32BufferAttribute([
          pp.x - dx * ancho / 2, pp.y, pp.z - dz * ancho / 2,
          pp.x + dx * ancho / 2, pp.y, pp.z + dz * ancho / 2,
          pp.x, pp.y - 0.3, pp.z,
        ], 3));
        tri.computeVertexNormals();
        banderines.push(pintar(tri, coloresBanderin[nColor++ % coloresBanderin.length]));
      }
    }
  }
  raiz.add(new THREE.Mesh(R(fusionarColores(banderines)), R(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }))));
  // Guirnalda de bombillas por todo el borde de la carpa
  const bombillas = [];
  for (let i = 0; i < 64; i++) {
    const a = (i / 64) * Math.PI * 2;
    bombillas.push(new THREE.SphereGeometry(0.06, 6, 4).translate(Math.sin(a) * 10.2, 4.35 + Math.sin(i * 0.5) * 0.04, Math.cos(a) * 10.2));
  }
  raiz.add(new THREE.Mesh(R(fusionar(bombillas)), R(new THREE.MeshBasicMaterial({ color: 0xffe7a3, toneMapped: false }))));
  // Círculo de luz del foco sobre la pista
  const texFoco = R(ctx.texturaCanvas((g, tam) => {
    const grad = g.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
    grad.addColorStop(0, 'rgba(255,240,200,0.55)');
    grad.addColorStop(0.7, 'rgba(255,240,200,0.25)');
    grad.addColorStop(1, 'rgba(255,240,200,0)');
    g.clearRect(0, 0, tam, tam);
    g.fillStyle = grad;
    g.fillRect(0, 0, tam, tam);
  }, { tam: 128, semilla: 84 }));
  const focoSuelo = new THREE.Mesh(
    R(new THREE.CircleGeometry(2.6, 32).rotateX(-Math.PI / 2)),
    R(new THREE.MeshBasicMaterial({ map: texFoco, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })),
  );
  focoSuelo.position.y = 0.012;
  raiz.add(focoSuelo);

  // ─── Cañones de circo ──────────────────────────────────────────────────
  // Cañón rojo con aros dorados sobre una cureña azul con dos ruedas de radios. El tubo apunta a +Z.
  const perfilTubo = [[0, -0.42], [0.1, -0.42], [0.13, -0.38], [0.13, -0.3], [0.11, -0.28], [0.1, 0.3], [0.125, 0.33],
    [0.125, 0.4], [0.085, 0.4], [0.085, 0.36], [0, 0.36]].map(([r, y]) => new THREE.Vector2(r, y));
  const tubo = [
    pintar(new THREE.LatheGeometry(perfilTubo, 20).rotateX(Math.PI / 2), 0xd32f2f),
    pintar(new THREE.TorusGeometry(0.108, 0.014, 6, 20).translate(0, 0, 0.1), 0xf2c14e),
    pintar(new THREE.TorusGeometry(0.12, 0.014, 6, 20).translate(0, 0, -0.25), 0xf2c14e),
    pintar(new THREE.CircleGeometry(0.085, 16).translate(0, 0, 0.37), 0x1a1014), // boca
    pintar(new THREE.SphereGeometry(0.06, 10, 8).translate(0, 0, -0.46), 0xf2c14e),
  ];
  const geoTubo = R(fusionarColores(tubo));
  const cureña = [pintar(new THREE.BoxGeometry(0.3, 0.14, 0.62).translate(0, 0.3, -0.05), 0x1e5aa8)];
  for (const lado of [-1, 1]) {
    cureña.push(pintar(new THREE.TorusGeometry(0.26, 0.03, 6, 20).rotateY(Math.PI / 2).translate(lado * 0.2, 0.28, 0), 0xf2c14e));
    for (let k = 0; k < 6; k++) {
      cureña.push(pintar(new THREE.BoxGeometry(0.02, 0.5, 0.025).rotateX((k / 6) * Math.PI).translate(lado * 0.2, 0.28, 0), 0xb3202c));
    }
    cureña.push(pintar(new THREE.CylinderGeometry(0.05, 0.05, 0.05, 10).rotateZ(Math.PI / 2).translate(lado * 0.2, 0.28, 0), 0xf2c14e));
  }
  const geoCureña = R(fusionarColores(cureña));
  const matCanon = R(new THREE.MeshLambertMaterial({ vertexColors: true }));
  const ANGULOS_VR = [-70, -35, 0, 35, 70];
  const canones = ANGULOS_VR.map((grados) => {
    const a = THREE.MathUtils.degToRad(grados);
    const grupo = new THREE.Group();
    grupo.position.set(Math.sin(a) * RADIO_CANONES, 0, -Math.cos(a) * RADIO_CANONES);
    grupo.rotation.y = Math.atan2(-grupo.position.x, -grupo.position.z);
    const tuboM = new THREE.Mesh(geoTubo, matCanon);
    tuboM.position.set(0, 0.52, 0);
    tuboM.rotation.x = -0.32; // apunta hacia arriba
    grupo.add(new THREE.Mesh(geoCureña, matCanon), tuboM);
    raiz.add(grupo);
    const sombra = ctx.crearSombra({ radio: 0.45, opacidad: 0.4 });
    sombra.position.set(grupo.position.x, 0.01, grupo.position.z);
    raiz.add(sombra);
    return { grupo, tubo: tuboM, retroceso: 0, boca: new THREE.Vector3(), grados };
  });
  for (const c of canones) {
    c.grupo.updateMatrixWorld(true);
    c.tubo.localToWorld(c.boca.set(0, 0, 0.42));
  }

  // ─── Escoba ────────────────────────────────────────────────────────────
  // Del revés: el mango apoyado en la mano y el cepillo arriba (y = 0 es la punta que toca la mano)
  const perfilMango = [[0, 0], [0.012, 0.002], [0.016, 0.012], [0.016, 0.03], [RADIO_MANGO, 0.04],
    [RADIO_MANGO, INICIO_CEPILLO - 0.03], [0.02, INICIO_CEPILLO - 0.03], [0.02, INICIO_CEPILLO], [0, INICIO_CEPILLO]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const geoMango = R(new THREE.LatheGeometry(perfilMango, 14));
  const matMango = R(new THREE.MeshStandardMaterial({ map: R(ctx.texturas.madera(0xb07a45, { tam: 128, repetir: [1, 4], semilla: 85 })), roughness: 0.55 }));
  // Virola de metal y cepillo de paja (trapecio con grosor), atado con hilo rojo
  const geoVirola = R(new THREE.CylinderGeometry(0.03, 0.024, 0.07, 14).translate(0, INICIO_CEPILLO + 0.02, 0));
  const matVirola = R(new THREE.MeshStandardMaterial({ color: 0xc9ced6, metalness: 0.85, roughness: 0.3 }));
  const formaCepillo = new THREE.Shape();
  formaCepillo.moveTo(-0.045, 0);
  formaCepillo.lineTo(0.045, 0);
  formaCepillo.quadraticCurveTo(0.13, 0.15, 0.15, FIN_CEPILLO - INICIO_CEPILLO - 0.04);
  formaCepillo.lineTo(-0.15, FIN_CEPILLO - INICIO_CEPILLO - 0.04);
  formaCepillo.quadraticCurveTo(-0.13, 0.15, -0.045, 0);
  const geoCepillo = R(new THREE.ExtrudeGeometry(formaCepillo, {
    depth: 0.04, bevelEnabled: true, bevelThickness: 0.012, bevelSize: 0.01, bevelSegments: 2, curveSegments: 6,
  }).translate(0, INICIO_CEPILLO + 0.05, -0.02));
  // UV de la paja: las fibras van a lo largo
  {
    const pos = geoCepillo.attributes.position;
    const uv = geoCepillo.attributes.uv;
    for (let i = 0; i < pos.count; i++) uv.setXY(i, pos.getX(i) * 4 + 0.5, (pos.getY(i) - INICIO_CEPILLO) * 2);
  }
  const texPaja = R(ctx.texturaCanvas((g, tam, azarTex) => {
    g.fillStyle = '#d9b25c';
    g.fillRect(0, 0, tam, tam);
    for (let i = 0; i < 260; i++) {
      const x = azarTex() * tam;
      g.strokeStyle = azarTex() < 0.5 ? `rgba(120,80,20,${0.2 + azarTex() * 0.3})` : `rgba(255,240,170,${0.2 + azarTex() * 0.3})`;
      g.lineWidth = 1 + azarTex() * 1.5;
      g.beginPath();
      g.moveTo(x, 0);
      g.lineTo(x + (azarTex() - 0.5) * 6, tam);
      g.stroke();
    }
    // Dos costuras rojas atando la paja
    g.fillStyle = '#b3202c';
    g.fillRect(0, tam * 0.16, tam, tam * 0.035);
    g.fillRect(0, tam * 0.3, tam, tam * 0.035);
  }, { tam: 128, semilla: 86 }));
  const matCepillo = R(new THREE.MeshStandardMaterial({ map: texPaja, roughness: 0.9, emissive: 0x000000 }));
  const escoba = new THREE.Group();
  escoba.add(new THREE.Mesh(geoMango, matMango), new THREE.Mesh(geoVirola, matVirola), new THREE.Mesh(geoCepillo, matCepillo));
  raiz.add(escoba);
  const sombraEscoba = ctx.crearSombra({ radio: 0.16, opacidad: 0.4 });
  raiz.add(sombraEscoba);

  // ─── Guantes de payaso ─────────────────────────────────────────────────
  // Palma hacia arriba (+Y), dedos hacia delante (-Z): la escoba se apoya en el centro de la palma.
  const geoGuante = R(fusionar([
    new THREE.SphereGeometry(0.05, 16, 10).scale(1, 0.38, 1.1).translate(0, 0, 0.005),
    ...[-0.03, -0.01, 0.01, 0.03].map((x, i) => new THREE.CapsuleGeometry(0.0115, 0.045 - Math.abs(i - 1.5) * 0.006, 4, 8)
      .rotateX(Math.PI / 2 - 0.25).translate(x, 0.008, -0.075 + Math.abs(i - 1.5) * 0.004)),
    new THREE.CapsuleGeometry(0.013, 0.035, 4, 8).rotateZ(Math.PI / 2).rotateY(0.6).translate(-0.06, 0.004, -0.01), // pulgar
  ], ['position', 'normal']));
  const geoPuño = R(new THREE.LatheGeometry([[0.042, 0], [0.056, 0.004], [0.06, 0.03], [0.054, 0.05], [0.042, 0.05]]
    .map(([r, y]) => new THREE.Vector2(r, y)), 16).rotateX(Math.PI / 2).translate(0, 0, 0.045));
  const geoCosturas = R(fusionar([-0.016, 0, 0.016].map((x) => new THREE.BoxGeometry(0.004, 0.003, 0.05).translate(x, -0.018, 0.0)), ['position', 'normal']));
  const matGuante = R(new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.6 }));
  const matPuño = R(new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.5 }));
  const matCostura = R(new THREE.MeshLambertMaterial({ color: 0x3a3a3a }));
  function crearGuante() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geoGuante, matGuante), new THREE.Mesh(geoPuño, matPuño), new THREE.Mesh(geoCosturas, matCostura));
    return g;
  }
  // En VR, palma arriba sobre el mando
  const OFFSET_PALMA = new THREE.Vector3(0, 0.035, 0.0);
  const guantes = ctx.manos.map((mano) => {
    const g = crearGuante();
    g.position.copy(OFFSET_PALMA);
    return ctx.adjuntarAMano(mano, g);
  });
  // Con ratón: la mano en el aire, siguiendo al cursor
  const guanteRaton = crearGuante();
  guanteRaton.scale.setScalar(1.6);
  guanteRaton.rotation.y = Math.PI; // los dedos hacia ti: la palma se ve desde delante
  raiz.add(guanteRaton);

  // ─── Cubos ─────────────────────────────────────────────────────────────
  const geoCubo = R(cuboRedondeado(LADO_CUBO, 0.022));
  const cubosMalla = new THREE.InstancedMesh(geoCubo, R(new THREE.MeshStandardMaterial({ roughness: 0.35, metalness: 0.0 })), MAX_CUBOS);
  const sombraBase = ctx.crearSombra({ opacidad: 0.35 });
  R(sombraBase.material);
  const cubosSombra = new THREE.InstancedMesh(R(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)), sombraBase.material, MAX_CUBOS);
  cubosSombra.renderOrder = -1;
  for (const malla of [cubosMalla, cubosSombra]) {
    malla.frustumCulled = false;
    malla.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    raiz.add(malla);
  }
  const colorTmp = new THREE.Color();
  const cubos = [];
  for (let i = 0; i < MAX_CUBOS; i++) {
    cubosMalla.setColorAt(i, colorTmp.set(COLORES_CUBOS[i % COLORES_CUBOS.length]));
    cubos.push({
      i, estado: 'libre', // 'libre' | 'vuela' | 'rebota' | 'esfuma'
      pos: new THREE.Vector3(), anterior: new THREE.Vector3(), vel: new THREE.Vector3(),
      giro: new THREE.Quaternion(), eje: new THREE.Vector3(0, 1, 0), vgiro: 0,
      objetivo: new THREE.Vector3(), cerca: Infinity, tiempo: 0, color: COLORES_CUBOS[i % COLORES_CUBOS.length],
    });
  }

  // ─── Marcador ──────────────────────────────────────────────────────────
  // Alto, por encima del cepillo (no lo tapa ni con la escoba derecha)
  const marcador = ctx.crearPanel({ ancho: 1.9, alto: 0.48 });
  marcador.mesh.position.set(0, 3.5, -3.6);
  marcador.mesh.rotation.x = 0.3;
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let puntos = 0;
  let record = ctx.leer('record', 0);
  let estado = 'intro'; // 'intro' | 'jugando' | 'cae' | 'fin'
  let reloj = 3.5;
  let tiempoJugado = 0;
  let enEquilibrio = 0; // segundos seguidos sin golpes
  let vidas = VIDAS;
  let proximo = 0;
  let aviso = null;
  let tiempo = 0;
  let manoPalo = null; // la mano que lleva la escoba en VR

  const base = new THREE.Vector3(0, Y_RATON, Z_RATON); // punta del mango, sobre la mano
  const baseAnterior = new THREE.Vector3().copy(base);
  const baseVel = new THREE.Vector3();
  const punta = new THREE.Vector3(0, Y_RATON + LARGO, Z_RATON); // centro del cepillo
  const puntaVel = new THREE.Vector3();
  const objetivoRaton = new THREE.Vector3(0, Y_RATON, Z_RATON);
  const planoRaton = new THREE.Plane(new THREE.Vector3(0, 0, 1), -Z_RATON);
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const inicioCepillo = new THREE.Vector3();
  const finCepillo = new THREE.Vector3();
  const finMango = new THREE.Vector3();
  const subidaBase = new THREE.Vector3();
  const matriz = new THREE.Matrix4();
  const escalaV = new THREE.Vector3();
  const giroQ = new THREE.Quaternion();
  const ejeY = new THREE.Vector3(0, 1, 0);
  const cero = new THREE.Vector3();
  const cabeza = new THREE.Vector3();

  const dificultad = () => Math.min(1, tiempoJugado / DIFICULTAD_MAX);
  const nivel = () => 1 + Math.floor(tiempoJugado / NIVEL_SEGUNDOS);
  const gravedad = () => GRAVEDAD_INICIO + (GRAVEDAD_MAX - GRAVEDAD_INICIO) * dificultad();
  const avisar = (texto, color, duracion = 1.3) => { aviso = { texto, color, tiempo: duracion }; };

  function actualizarMarcador() {
    const lineas = estado === 'intro'
      ? [{ texto: ctx.t('titulo'), tam: 1.2, color: '#ffe082' },
        { texto: reloj < 2 ? ctx.t('preparado', { n: Math.ceil(reloj) }) : ctx.t(ctx.enVR() ? 'introVR' : ctx.tactil ? 'introTactil' : 'intro'), tam: 0.72 }]
      : estado === 'fin' || estado === 'cae'
        ? [{ texto: estado === 'cae' ? ctx.t('caida') : ctx.t('fin', { n: puntos }), tam: 1.2, color: estado === 'cae' ? '#ff8a80' : '#ffe082' },
          { texto: ctx.t('partida.recordNuevaPartida', { record, n: Math.max(0, Math.ceil(reloj + (estado === 'cae' ? 5 : 0))) }), tam: 0.75 }]
        : [{ texto: ctx.t('marcador', { n: puntos }), tam: 1.3 },
          aviso ? { texto: aviso.texto, tam: 0.8, color: aviso.color }
            : { texto: ctx.t('estado', { vidas, s: Math.floor(tiempoJugado), record }), tam: 0.75, color: '#c5e1a5' }];
    marcador.escribir(lineas);
  }

  // ─── La mano ───────────────────────────────────────────────────────────
  function elegirMano() {
    const activas = ctx.manos.filter((m) => m.activa);
    // En la cuenta atrás, el gatillo de una mano pasa la escoba a esa mano
    if (estado === 'intro') for (const m of activas) if (m.gatilloPulsado) manoPalo = m;
    if (!manoPalo || !manoPalo.activa) manoPalo = activas.find((m) => m.lado === 'right') || activas[0] || null;
  }

  // Lleva la base (la punta del mango) a donde está la mano en este fotograma
  function moverBase(dt) {
    baseAnterior.copy(base);
    if (ctx.enVR()) {
      elegirMano();
      guanteRaton.visible = false;
      for (let i = 0; i < guantes.length; i++) guantes[i].visible = ctx.manos[i].activa;
      if (manoPalo) manoPalo.grip.localToWorld(base.copy(OFFSET_PALMA)).y += 0.012;
    } else {
      const raton = ctx.raton;
      if (raton.rayo.ray.intersectPlane(planoRaton, tmp)) objetivoRaton.x = THREE.MathUtils.clamp(tmp.x, -1.8, 1.8);
      // La mano sigue al cursor con un poco de inercia (sin saltos imposibles)
      const k = 1 - Math.exp(-dt * 22);
      base.x += THREE.MathUtils.clamp((objetivoRaton.x - base.x) * k, -7 * dt, 7 * dt);
      base.y = Y_RATON;
      base.z = Z_RATON;
      guanteRaton.visible = true;
      guanteRaton.position.set(base.x, base.y - 0.03, base.z);
    }
    baseVel.subVectors(base, baseAnterior).divideScalar(Math.max(dt, 1e-3));
  }

  // ─── Física de la escoba ───────────────────────────────────────────────
  // Péndulo invertido: el peso está en el cepillo y la escoba mide siempre lo mismo. Se integra el
  // cepillo con la gravedad y luego se devuelve a su distancia de la mano (así, mover la mano debajo
  // la endereza, como en la realidad). Con ratón, la escoba solo se inclina a los lados.
  function simularEscoba(dt) {
    const pasos = 4;
    const h = dt / pasos;
    const g = gravedad();
    const plano = !ctx.enVR();
    for (let p = 1; p <= pasos; p++) {
      subidaBase.lerpVectors(baseAnterior, base, p / pasos);
      tmp2.copy(punta);
      puntaVel.y -= g * h;
      puntaVel.multiplyScalar(Math.exp(-h * 0.5));
      punta.addScaledVector(puntaVel, h);
      if (plano) punta.z = subidaBase.z;
      tmp.subVectors(punta, subidaBase);
      if (tmp.lengthSq() < 1e-8) tmp.set(0, 1, 0);
      punta.copy(subidaBase).addScaledVector(tmp.normalize(), LARGO);
      puntaVel.subVectors(punta, tmp2).divideScalar(h);
    }
    if (puntaVel.lengthSq() > 64) puntaVel.setLength(8);
  }

  // Al caer: la escoba se suelta de la mano y cae al suelo (dos puntos unidos por el palo)
  const caidaBaseVel = new THREE.Vector3();
  function simularCaida(dt) {
    const pasos = 4;
    const h = dt / pasos;
    for (let p = 0; p < pasos; p++) {
      const b0 = tmp2.copy(base);
      const t0x = punta.x;
      const t0y = punta.y;
      const t0z = punta.z;
      caidaBaseVel.y -= 9.8 * h;
      puntaVel.y -= 9.8 * h;
      base.addScaledVector(caidaBaseVel, h);
      punta.addScaledVector(puntaVel, h);
      // Suelo con roce
      tocarSuelo(base, caidaBaseVel);
      tocarSuelo(punta, puntaVel);
      // Largo fijo
      tmp.subVectors(punta, base);
      const l = tmp.length() || 1;
      tmp.multiplyScalar((l - LARGO) / l / 2);
      base.add(tmp);
      punta.sub(tmp);
      caidaBaseVel.subVectors(base, b0).divideScalar(h);
      puntaVel.set((punta.x - t0x) / h, (punta.y - t0y) / h, (punta.z - t0z) / h);
      // Roce con el suelo: se para enseguida en vez de resbalar
      if (base.y < 0.035) { caidaBaseVel.x *= 0.9; caidaBaseVel.z *= 0.9; }
      if (punta.y < 0.035) { puntaVel.x *= 0.9; puntaVel.z *= 0.9; }
    }
  }

  function tocarSuelo(q, v) {
    if (q.y >= 0.03) return;
    q.y = 0.03;
    v.y = Math.abs(v.y) * 0.25;
    v.x *= 0.7;
    v.z *= 0.7;
  }

  function colocarEscoba() {
    dir.subVectors(punta, base).normalize();
    escoba.position.copy(base);
    escoba.quaternion.setFromUnitVectors(ejeY, dir);
    // Puntos del mango y del cepillo para los choques
    finMango.copy(base).addScaledVector(dir, INICIO_CEPILLO);
    inicioCepillo.copy(finMango);
    finCepillo.copy(base).addScaledVector(dir, FIN_CEPILLO);
    // Aviso de que se cae: el cepillo se pone rojo
    const peligro = THREE.MathUtils.clamp((0.92 - dir.y) / (0.92 - ANGULO_CAIDA), 0, 1);
    matCepillo.emissive.setRGB(peligro * 0.55, 0, 0);
    tmp.copy(base).addScaledVector(dir, LARGO);
    ctx.colocarSombra(sombraEscoba, tmp, 0);
  }

  // ─── Cubos ─────────────────────────────────────────────────────────────
  function disparar() {
    const cubo = cubos.find((c) => c.estado === 'libre');
    if (!cubo) return;
    const elegibles = ctx.enVR() ? canones : canones.filter((c) => Math.abs(c.grados) < 50);
    const canon = elegibles[Math.floor(Math.random() * elegibles.length)];
    const d = dificultad();
    // Apunta a un punto de la escoba (o cerca: algunos pasan de largo solos)
    dir.subVectors(punta, base).normalize();
    cubo.objetivo.copy(base).addScaledVector(dir, azar(0.35, FIN_CEPILLO));
    if (ctx.enVR()) {
      cubo.objetivo.x += azar(-0.3, 0.3);
      cubo.objetivo.z += azar(-0.15, 0.15);
    } else {
      cubo.objetivo.x += azar(-0.35, 0.35);
      cubo.objetivo.z = Z_RATON;
    }
    cubo.objetivo.y += azar(-0.1, 0.15);
    cubo.pos.copy(canon.boca);
    cubo.anterior.copy(cubo.pos);
    const velocidad = azar(2.3, 2.9) * (1 + d * 0.75);
    const tVuelo = cubo.pos.distanceTo(cubo.objetivo) / velocidad;
    // Tiro parabólico que pasa por el objetivo
    cubo.vel.subVectors(cubo.objetivo, cubo.pos).divideScalar(tVuelo);
    cubo.vel.y += 0.5 * GRAVEDAD_CUBOS * tVuelo;
    cubo.estado = 'vuela';
    cubo.cerca = Infinity;
    cubo.tiempo = 0;
    cubo.eje.set(azar(-1, 1), azar(-1, 1), azar(-1, 1)).normalize();
    cubo.vgiro = azar(4, 9);
    canon.retroceso = 1;
    ctx.sonido('canon');
    ctx.efectos.estallido(canon.boca, { color: 0xfff3d6, cantidad: 8, fuerza: 0.9, gravedad: -0.5, vida: 0.5, tam: 0.03 });
  }

  function golpe(cubo) {
    cubo.estado = 'rebota';
    cubo.tiempo = 1.2;
    // Empuja la escoba hacia donde iba el cubo (más cuanto más arriba le da)
    tmp.copy(cubo.vel).multiplyScalar(0.1 + 0.2 * fraccion);
    if (!ctx.enVR()) tmp.z = 0;
    puntaVel.add(tmp);
    cubo.vel.multiplyScalar(-0.35);
    cubo.vel.y = 1.6;
    cubo.vgiro *= 2;
    vidas--;
    enEquilibrio = 0;
    ctx.sonido('cubo');
    ctx.destello(0xff1744, 0.25);
    if (manoPalo && ctx.enVR()) ctx.vibrar(manoPalo, 0.9, 140);
    if (vidas <= 0) caer();
    else avisar(ctx.t('golpe', { n: vidas }), '#ff8a80', 1.6);
  }

  function esquivado(cubo) {
    cubo.estado = 'esfuma';
    cubo.tiempo = 0.25;
    if (estado !== 'jugando') return;
    const rozando = cubo.cerca < POR_LOS_PELOS;
    const valor = rozando ? 3 : 1;
    puntos += valor;
    tmp.copy(base).addScaledVector(dir.subVectors(punta, base).normalize(), FIN_CEPILLO + 0.12);
    ctx.efectos.impacto(rozando ? 'medio' : 'pequeño', { pos: cubo.pos, mano: ctx.enVR() ? manoPalo : null, color: cubo.color, sonido: 'punto' });
    ctx.efectos.texto(tmp, `+${valor}`, { color: rozando ? '#ffe082' : '#ffffff', tam: rozando ? 1.15 : 0.9 });
    if (rozando) avisar(ctx.t('porLosPelos'), '#ffe082', 0.9);
  }

  function moverCubos(dt) {
    let cuantos = 0;
    for (const c of cubos) {
      if (c.estado === 'libre') {
        escalaV.set(0, 0, 0);
        matriz.compose(c.pos, c.giro, escalaV);
        cubosMalla.setMatrixAt(c.i, matriz);
        cubosSombra.setMatrixAt(c.i, matriz);
        continue;
      }
      cuantos++;
      c.anterior.copy(c.pos);
      c.vel.y -= (c.estado === 'rebota' ? 9.8 : GRAVEDAD_CUBOS) * dt;
      c.pos.addScaledVector(c.vel, dt);
      c.giro.multiply(giroQ.setFromAxisAngle(c.eje, c.vgiro * dt));
      c.tiempo += dt;
      let escala = 1;
      if (c.estado === 'vuela') {
        // Choque con el mango y con el cepillo (todo el recorrido de este fotograma)
        if (estado === 'jugando') {
          const dMango = distanciaSegmentos(c.anterior, c.pos, base, finMango);
          const fMango = fraccion * (INICIO_CEPILLO / FIN_CEPILLO);
          const dCepillo = distanciaSegmentos(c.anterior, c.pos, inicioCepillo, finCepillo);
          const fCepillo = (INICIO_CEPILLO + fraccion * (FIN_CEPILLO - INICIO_CEPILLO)) / FIN_CEPILLO;
          const dist = Math.min(Math.sqrt(dMango) - RADIO_MANGO, Math.sqrt(dCepillo) - RADIO_CEPILLO);
          c.cerca = Math.min(c.cerca, dist);
          if (Math.sqrt(dMango) < RADIO_CUBO + RADIO_MANGO) {
            fraccion = fMango;
            golpe(c);
          } else if (Math.sqrt(dCepillo) < RADIO_CUBO + RADIO_CEPILLO) {
            fraccion = fCepillo;
            golpe(c);
          }
        }
        // Ya ha pasado la escoba: se esfuma (y no llega a darte en la cara)
        if (c.estado === 'vuela' && tmp.subVectors(c.pos, c.objetivo).dot(c.vel) > 0 && c.pos.distanceTo(c.objetivo) > 0.35) {
          if (estado === 'jugando') esquivado(c);
          else { c.estado = 'esfuma'; c.tiempo = 0.25; }
        }
        if (c.tiempo > 6) c.estado = 'libre';
      } else if (c.estado === 'esfuma') {
        c.tiempo -= 2 * dt; // (sumado arriba) le quedan 0,25 s
        escala = Math.max(0, c.tiempo / 0.25);
        if (escala <= 0) c.estado = 'libre';
      } else if (c.estado === 'rebota') {
        c.tiempo -= 2 * dt;
        if (c.pos.y < LADO_CUBO / 2) {
          c.pos.y = LADO_CUBO / 2;
          c.vel.y = Math.abs(c.vel.y) * 0.35;
          c.vel.x *= 0.6;
          c.vel.z *= 0.6;
          c.vgiro *= 0.6;
        }
        escala = Math.min(1, c.tiempo / 0.3);
        if (c.tiempo <= 0) c.estado = 'libre';
      }
      escalaV.setScalar(Math.max(0, escala));
      matriz.compose(c.pos, c.giro, escalaV);
      cubosMalla.setMatrixAt(c.i, matriz);
      tmp.set(c.pos.x, 0.006, c.pos.z);
      escalaV.setScalar(0.2 * Math.max(0, escala) * (1 + c.pos.y * 0.3));
      matriz.compose(tmp, giroQ.identity(), escalaV);
      cubosSombra.setMatrixAt(c.i, matriz);
    }
    cubosMalla.instanceMatrix.needsUpdate = true;
    cubosSombra.instanceMatrix.needsUpdate = true;
    return cuantos;
  }

  // ─── Partida ───────────────────────────────────────────────────────────
  function empezar() {
    estado = 'jugando';
    puntos = 0;
    vidas = VIDAS;
    tiempoJugado = 0;
    enEquilibrio = 0;
    proximo = 1.6;
    aviso = null;
    // Un empujoncito para que no empiece perfectamente quieta
    puntaVel.set(azar(-0.12, 0.12), 0, ctx.enVR() ? azar(-0.08, 0.08) : 0);
    ctx.sonido('silbato');
  }

  function caer() {
    if (estado !== 'jugando') return;
    estado = 'cae';
    reloj = 1.4;
    caidaBaseVel.copy(baseVel).multiplyScalar(0.5);
    if (caidaBaseVel.lengthSq() > 9) caidaBaseVel.setLength(3);
    ctx.sonido('fallo');
    if (manoPalo && ctx.enVR()) ctx.vibrar(manoPalo, 1, 220);
    ctx.puntuacion(puntos); // a la clasificación (juegos/marcadores.js)
    if (puntos > record) {
      record = puntos;
      ctx.guardar('record', record);
    }
  }

  function preparar() {
    estado = 'intro';
    reloj = 3.5;
    aviso = null;
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function actualizar(dt) {
    tiempo += dt;
    reloj -= dt;
    ctx.camara.getWorldPosition(cabeza);

    if (estado !== 'cae' && estado !== 'fin') moverBase(dt);
    else if (!ctx.enVR()) guanteRaton.visible = true;

    if (estado === 'intro') {
      // La escoba se coloca derecha sobre la mano mientras dura la cuenta atrás
      punta.copy(base).y += LARGO;
      puntaVel.set(0, 0, 0);
      if (reloj <= 0) empezar();
    } else if (estado === 'jugando') {
      simularEscoba(dt);
      tiempoJugado += dt;
      const nivelAntes = nivel();
      const premioAntes = Math.floor(enEquilibrio / PREMIO_SEGUNDOS);
      enEquilibrio += dt;
      if (Math.floor(enEquilibrio / PREMIO_SEGUNDOS) > premioAntes) {
        puntos += 5;
        tmp.copy(punta).y += 0.25;
        ctx.efectos.impacto('medio', { pos: tmp, mano: ctx.enVR() ? manoPalo : null, color: 0xffe082, sonido: 'anillo' });
        ctx.efectos.texto(tmp, '+5', { color: '#ffe082', tam: 1.2 });
        avisar(ctx.t('segundos', { n: Math.round(enEquilibrio) }), '#ffe082', 1.6);
      }
      if (nivel() > nivelAntes) {
        avisar(ctx.t('masCubos'), '#80d8ff', 2);
        ctx.sonido('tic');
      }
      // Cada vez disparan más seguido y, a veces, dos cañones a la vez
      const d = dificultad();
      proximo -= dt;
      if (proximo <= 0) {
        disparar();
        if (Math.random() < d * 0.3) disparar();
        proximo = (2.3 - d * 1.5) * azar(0.8, 1.2);
      }
      dir.subVectors(punta, base).normalize();
      if (dir.y < ANGULO_CAIDA) caer();
    } else if (estado === 'cae') {
      simularCaida(dt);
      if (reloj <= 0) {
        estado = 'fin';
        reloj = 5;
        ctx.sonido('caida');
        ctx.sonido('fin');
      }
    } else if (estado === 'fin') {
      simularCaida(dt);
      if (reloj <= 0) preparar();
    }
    if (aviso && (aviso.tiempo -= dt) <= 0) aviso = null;

    colocarEscoba();
    moverCubos(dt);

    // Retroceso de los cañones al disparar (con rebote al volver)
    for (const c of canones) {
      c.retroceso = Math.max(0, c.retroceso - dt * 3.5);
      const r = c.retroceso;
      c.tubo.position.z = -0.12 * Math.sin(r * Math.PI) * r;
      c.tubo.scale.setScalar(1 + 0.08 * r * r);
    }
    actualizarMarcador();
  }

  for (const c of cubos) {
    matriz.compose(c.pos, c.giro, cero);
    cubosMalla.setMatrixAt(c.i, matriz);
    cubosSombra.setMatrixAt(c.i, matriz);
  }
  colocarEscoba();
  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      // La shell retira lo que hay en la escena y en las manos y los recursos registrados.
      cubos.length = 0;
    },
  };
}
