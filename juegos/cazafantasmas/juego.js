// CAZAFANTASMAS
// Salón de una casa encantada, de noche y a oscuras: solo entra la luz de la luna por la ventana y
// alguna vela. Los fantasmas aparecen a tu alrededor y se acercan flotando. Casi no se ven, pero se
// oyen: el lamento del más cercano suena por su lado y más fuerte cuanto más cerca está. Al darles con
// la luz de la linterna se iluminan, tiemblan, se frenan y al cabo de un momento se deshacen. Cuanto más
// lejos los pares, más puntos. Cada vez salen más, más rápidos y más difíciles de ver (los de sombra
// casi no brillan). La partida acaba cuando uno te alcanza.
// En VR: una linterna en cada mano y los fantasmas llegan por todos lados (hay que girarse). Con ratón
// o en el móvil: llegan por delante y la linterna apunta al cursor o al dedo.
// (Sugerencia #9 del foro.)
import * as THREE from 'three';

// Todo se genera con código: no hay nada que descargar.
export async function precargar() {}

const SALA = 7;                     // la sala va de -7 a 7 m en X y en Z
const ALTO_SALA = 3.6;
const MAX_FANTASMAS = 8;
const DIFICULTAD_MAX = 150;         // segundos hasta la dificultad máxima
const NIVEL_SEGUNDOS = 30;          // cada 30 s, aviso de que vienen más
const RADIO_APARICION = 6;
const ALCANCE = 0.5;                // a esta distancia (en horizontal) el fantasma te atrapa
const TAM_HAZ = 0.75;                // el haz, al 75 % de su tamaño original (como la linterna)
const APERTURA = THREE.MathUtils.degToRad(15 * TAM_HAZ); // medio ángulo del haz de la linterna
const LARGO_HAZ = 13 * TAM_HAZ;     // alcance de la luz (los fantasmas aparecen a 6 m: siguen a tiro)
const FUERZA_LINTERNA = 38;         // lo que ilumina la linterna las paredes y los muebles
const AZAR_TIPOS = [
  // color, tamaño, velocidad (m/s), segundos de luz para deshacerlo, puntos, brillo en la oscuridad
  { id: 'normal', color: 0xdfe9ff, escala: 1, velocidad: 0.55, vida: 0.8, puntos: 10, brillo: 0.22, zigzag: 0.4 },
  { id: 'rapido', color: 0xa6ffcf, escala: 0.75, velocidad: 1.0, vida: 0.5, puntos: 15, brillo: 0.16, zigzag: 1.0 },
  { id: 'grande', color: 0xd9b3ff, escala: 1.45, velocidad: 0.38, vida: 1.6, puntos: 25, brillo: 0.26, zigzag: 0.2 },
  { id: 'sombra', color: 0x9aa0c8, escala: 1, velocidad: 0.62, vida: 0.8, puntos: 20, brillo: 0.04, zigzag: 0.6 },
];

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
const caja = (w, h, d, x, y, z, color) => pintar(new THREE.BoxGeometry(w, h, d).translate(x, y, z), color);

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  // Noche cerrada: la niebla oscura se traga el fondo de la sala
  ctx.fondo(0x0b0d1c, { niebla: [5, 19] });
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.6, 0.6), new THREE.Vector3(0, 1.45, -5));
  ctx.sueloBase(false);

  // ─── Luz de las linternas ──────────────────────────────────────────────
  // No hay luces nuevas (son caras en el Quest): los materiales de la sala calculan ellos mismos el
  // cono de cada linterna, con dos datos por linterna (dónde está y hacia dónde apunta).
  const luz = {
    uLinPos: { value: [new THREE.Vector3(), new THREE.Vector3()] },
    uLinDir: { value: [new THREE.Vector3(0, 0, -1), new THREE.Vector3(0, 0, -1)] },
    uLinOn: { value: [0, 0] },
    uLinCos: { value: new THREE.Vector2(Math.cos(APERTURA * 1.15), Math.cos(APERTURA * 0.55)) },
    uLinFuerza: { value: FUERZA_LINTERNA },
  };
  function conLinterna(material) {
    material.onBeforeCompile = (shader) => {
      Object.assign(shader.uniforms, luz);
      shader.vertexShader = shader.vertexShader
        .replace('#include <common>', '#include <common>\nvarying vec3 vPosLin;\nvarying vec3 vNorLin;')
        .replace('#include <project_vertex>', `#include <project_vertex>
          vec4 posLin = vec4(transformed, 1.0);
          vec3 norLin = objectNormal;
          #ifdef USE_INSTANCING
            posLin = instanceMatrix * posLin;
            norLin = mat3(instanceMatrix) * norLin;
          #endif
          vPosLin = (modelMatrix * posLin).xyz;
          vNorLin = normalize(mat3(modelMatrix) * norLin);`);
      shader.fragmentShader = shader.fragmentShader
        .replace('#include <common>', `#include <common>
          varying vec3 vPosLin;
          varying vec3 vNorLin;
          uniform vec3 uLinPos[2];
          uniform vec3 uLinDir[2];
          uniform float uLinOn[2];
          uniform vec2 uLinCos;
          uniform float uLinFuerza;`)
        .replace('#include <opaque_fragment>', `{
            vec3 n = normalize(vNorLin);
            float suma = 0.0;
            for (int i = 0; i < 2; i++) {
              vec3 d = vPosLin - uLinPos[i];
              float dist = length(d);
              vec3 dn = d / max(dist, 0.001);
              float cono = smoothstep(uLinCos.x, uLinCos.y, dot(dn, uLinDir[i]));
              float aten = 1.0 / (1.0 + dist * dist * 0.04);
              suma += cono * aten * (0.25 + 0.75 * abs(dot(n, dn))) * uLinOn[i];
            }
            outgoingLight += diffuseColor.rgb * suma * uLinFuerza * vec3(1.0, 0.93, 0.8);
          }
          #include <opaque_fragment>`);
    };
    material.customProgramCacheKey = () => 'linterna';
    return material;
  }

  // ─── Salón encantado ───────────────────────────────────────────────────
  // Suelo de tablas y alfombra raída
  const suelo = new THREE.Mesh(
    R(new THREE.PlaneGeometry(SALA * 2, SALA * 2).rotateX(-Math.PI / 2)),
    R(conLinterna(new THREE.MeshLambertMaterial({ color: 0x4a4048, map: R(ctx.texturas.tablas(0x8a6446, { tam: 512, repetir: [5, 5], semilla: 71 })) }))),
  );
  raiz.add(suelo);
  const texAlfombra = R(ctx.texturaCanvas((g, tam, azarTex) => {
    g.fillStyle = '#6e1e2a';
    g.fillRect(0, 0, tam, tam);
    g.strokeStyle = '#c99a4a';
    g.lineWidth = tam * 0.025;
    g.strokeRect(tam * 0.06, tam * 0.06, tam * 0.88, tam * 0.88);
    g.lineWidth = tam * 0.012;
    g.strokeRect(tam * 0.12, tam * 0.12, tam * 0.76, tam * 0.76);
    g.beginPath();
    g.ellipse(tam / 2, tam / 2, tam * 0.22, tam * 0.16, 0, 0, Math.PI * 2);
    g.stroke();
    // Desgastada y con agujeros
    for (let i = 0; i < 700; i++) {
      g.fillStyle = `rgba(20,10,10,${azarTex() * 0.25})`;
      g.fillRect(azarTex() * tam, azarTex() * tam, 3, 2);
    }
  }, { tam: 256, semilla: 72 }));
  const alfombra = new THREE.Mesh(
    R(new THREE.PlaneGeometry(4.2, 3.2).rotateX(-Math.PI / 2)),
    R(conLinterna(new THREE.MeshLambertMaterial({ color: 0x5a5058, map: texAlfombra }))),
  );
  alfombra.position.set(0, 0.006, -0.6);
  raiz.add(alfombra);
  // Papel pintado de rayas con flores, con manchas de humedad
  const texPared = R(ctx.texturaCanvas((g, tam, azarTex) => {
    g.fillStyle = '#5f6b52';
    g.fillRect(0, 0, tam, tam);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? 'rgba(30,40,25,0.35)' : 'rgba(200,190,140,0.08)';
      g.fillRect((i * tam) / 8, 0, tam / 8, tam);
    }
    g.fillStyle = 'rgba(210,190,120,0.22)';
    for (let k = 0; k < 4; k++) {
      for (let f = 0; f < 4; f++) {
        const x = ((k + 0.5) * tam) / 4;
        const y = ((f + (k % 2) * 0.5 + 0.25) * tam) / 4;
        for (let p = 0; p < 5; p++) {
          const a = (p / 5) * Math.PI * 2;
          g.beginPath();
          g.ellipse(x + Math.cos(a) * 9, y + Math.sin(a) * 9, 7, 4, a, 0, Math.PI * 2);
          g.fill();
        }
      }
    }
    for (let i = 0; i < 6; i++) {
      const grad = g.createRadialGradient(azarTex() * tam, azarTex() * tam, 0, azarTex() * tam, azarTex() * tam, tam * 0.3);
      grad.addColorStop(0, 'rgba(20,15,5,0.3)');
      grad.addColorStop(1, 'rgba(20,15,5,0)');
      g.fillStyle = grad;
      g.fillRect(0, 0, tam, tam);
    }
  }, { tam: 256, repetir: [7, 2], semilla: 73 }));
  const paredes = new THREE.Mesh(
    R(new THREE.BoxGeometry(SALA * 2, ALTO_SALA + 0.04, SALA * 2).translate(0, ALTO_SALA / 2 - 0.02, 0)), // la cara de abajo queda bajo el suelo
    R(conLinterna(new THREE.MeshLambertMaterial({ color: 0x3e4048, map: texPared, side: THREE.BackSide }))),
  );
  raiz.add(paredes);

  // Muebles y decorado en una sola malla (todos con la luz de la linterna)
  const muebles = [];
  // Zócalo y vigas del techo
  for (const [x, z, w, d] of [[0, -SALA + 0.03, SALA * 2, 0.06], [0, SALA - 0.03, SALA * 2, 0.06], [-SALA + 0.03, 0, 0.06, SALA * 2], [SALA - 0.03, 0, 0.06, SALA * 2]]) {
    muebles.push(caja(w, 0.22, d, x, 0.11, z, 0x3a2418));
  }
  for (let i = -2; i <= 2; i++) muebles.push(caja(0.25, 0.22, SALA * 2, i * 2.8, ALTO_SALA - 0.11, 0, 0x2e1c12));
  // Chimenea de piedra en la pared izquierda, con su repisa y tres velas
  muebles.push(
    caja(0.5, 1.25, 2.2, -SALA + 0.25, 0.62, -1.2, 0x6b6560),
    caja(0.65, 0.1, 2.5, -SALA + 0.32, 1.3, -1.2, 0x4a3022),
    caja(0.3, 2.3, 1.2, -SALA + 0.15, 2.45, -1.2, 0x5d5853),
    caja(0.04, 0.75, 1.3, -SALA + 0.5, 0.42, -1.2, 0x120c0a), // hueco del fuego
  );
  const velas = [[-SALA + 0.32, -2.1], [-SALA + 0.32, -1.25], [-SALA + 0.32, -0.35]];
  for (const [x, z] of velas) muebles.push(pintar(new THREE.CylinderGeometry(0.03, 0.032, 0.22, 10).translate(x, 1.46, z), 0xe8dcc0));
  // Reloj de pie en la pared derecha
  muebles.push(
    caja(0.42, 2.1, 0.32, SALA - 0.2, 1.05, -2.6, 0x4a2a18),
    caja(0.5, 0.12, 0.4, SALA - 0.2, 2.16, -2.6, 0x3a2014),
    pintar(new THREE.CylinderGeometry(0.15, 0.15, 0.02, 20).rotateZ(Math.PI / 2).translate(SALA - 0.38, 1.75, -2.6), 0xd8cfb0),
    pintar(new THREE.CylinderGeometry(0.06, 0.06, 0.02, 14).rotateZ(Math.PI / 2).translate(SALA - 0.38, 0.95, -2.6), 0xb08a3a), // péndulo
  );
  // Librería al fondo a la izquierda
  muebles.push(caja(1.8, 2.4, 0.4, -4.4, 1.2, -SALA + 0.2, 0x3a2416));
  const coloresLibros = [0x7a2a2a, 0x2a4a6a, 0x5a5a2a, 0x3a2a5a, 0x6a4a2a];
  for (let fila = 0; fila < 4; fila++) {
    let x = -5.2;
    let i = fila;
    while (x < -3.65) {
      const ancho = 0.05 + ((i * 37) % 5) * 0.012;
      const alto = 0.34 + ((i * 13) % 4) * 0.03;
      muebles.push(caja(ancho, alto, 0.26, x + ancho / 2, 0.35 + fila * 0.55 + alto / 2, -SALA + 0.33, coloresLibros[i % 5]));
      x += ancho + 0.008;
      i++;
    }
  }
  // Sillón y sofá tapados con sábanas (formas blandas, casi blancas: parecen fantasmas a oscuras)
  const sabana = 0xb8b4aa;
  muebles.push(
    pintar(new THREE.SphereGeometry(0.6, 14, 10).scale(1, 0.75, 0.9).translate(3.8, 0.45, -4.4), sabana),
    pintar(new THREE.SphereGeometry(0.42, 12, 8).scale(1.2, 1.1, 0.5).translate(3.8, 0.95, -4.85), sabana),
    pintar(new THREE.CylinderGeometry(0.75, 0.85, 0.5, 14, 1, true).scale(1, 1, 0.8).translate(3.8, 0.25, -4.4), sabana),
    pintar(new THREE.SphereGeometry(1, 16, 10).scale(1.5, 0.45, 0.6).translate(-2.5, 0.42, 4.8), sabana),
    pintar(new THREE.SphereGeometry(1, 14, 8).scale(1.5, 0.55, 0.25).translate(-2.5, 0.85, 5.3), sabana),
  );
  // Mesita con un candelabro y cuadros en las paredes (marcos dorados y lienzos oscuros)
  muebles.push(
    pintar(new THREE.CylinderGeometry(0.35, 0.35, 0.05, 16).translate(2.6, 0.72, 2.8), 0x3a2014),
    pintar(new THREE.CylinderGeometry(0.04, 0.06, 0.7, 8).translate(2.6, 0.36, 2.8), 0x3a2014),
    pintar(new THREE.LatheGeometry([[0, 0], [0.08, 0], [0.03, 0.05], [0.02, 0.3], [0.05, 0.32], [0, 0.33]].map(([r, y]) => new THREE.Vector2(r, y)), 10)
      .translate(2.6, 0.745, 2.8), 0x8a7a50),
  );
  for (const [x, y, z, w, h, giro, lienzo] of [
    [3, 2.0, -SALA + 0.04, 0.9, 1.15, 0, 0x2a2420], [-1.2, 2.1, -SALA + 0.04, 0.7, 0.9, 0, 0x22283a],
    [SALA - 0.04, 2.0, 1.4, 0.8, 1.0, -Math.PI / 2, 0x30222a], [-SALA + 0.04, 2.0, 2.6, 0.9, 0.7, Math.PI / 2, 0x26302a],
  ]) {
    const marco = new THREE.BoxGeometry(w + 0.14, h + 0.14, 0.06);
    const tela = new THREE.BoxGeometry(w, h, 0.07);
    muebles.push(pintar(marco.rotateY(giro).translate(x, y, z), 0x9a7a30), pintar(tela.rotateY(giro).translate(x, y, z), lienzo));
  }
  // Ventana al fondo: marco y cortinas raídas
  muebles.push(
    caja(2.2, 0.12, 0.2, 1.0, 0.95, -SALA + 0.08, 0x3a2418),
    caja(2.2, 0.12, 0.2, 1.0, 2.75, -SALA + 0.08, 0x3a2418),
    caja(0.12, 1.9, 0.2, -0.05, 1.85, -SALA + 0.08, 0x3a2418),
    caja(0.12, 1.9, 0.2, 2.05, 1.85, -SALA + 0.08, 0x3a2418),
  );
  for (const lado of [-1, 1]) {
    const cortina = new THREE.PlaneGeometry(0.7, 2.6, 6, 1);
    const pos = cortina.attributes.position;
    for (let i = 0; i < pos.count; i++) pos.setZ(i, Math.sin(pos.getX(i) * 18) * 0.05);
    cortina.computeVertexNormals();
    muebles.push(pintar(cortina.translate(1.0 + lado * 1.35, 1.75, -SALA + 0.2), 0x5a1820));
  }
  // Lámpara de araña apagada en el centro del techo
  muebles.push(pintar(new THREE.CylinderGeometry(0.012, 0.012, 0.7, 4).translate(0, ALTO_SALA - 0.35, -1.5), 0x2a2a2a));
  muebles.push(pintar(new THREE.TorusGeometry(0.45, 0.025, 6, 24).rotateX(Math.PI / 2).translate(0, ALTO_SALA - 0.75, -1.5), 0x6a5a3a));
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    muebles.push(pintar(new THREE.CylinderGeometry(0.02, 0.02, 0.12, 6).translate(Math.cos(a) * 0.45, ALTO_SALA - 0.69, -1.5 + Math.sin(a) * 0.45), 0xd8cfb0));
  }
  raiz.add(new THREE.Mesh(R(fusionarColores(muebles)), R(conLinterna(new THREE.MeshLambertMaterial({ vertexColors: true, color: 0x606060, side: THREE.DoubleSide })))));
  // Sombras de mancha bajo los muebles
  for (const [x, z, r] of [[3.8, -4.4, 0.9], [-2.5, 4.9, 1.4], [2.6, 2.8, 0.45], [SALA - 0.2, -2.6, 0.35], [-SALA + 0.3, -1.2, 0.9]]) {
    const s = ctx.crearSombra({ radio: r, opacidad: 0.5 });
    s.position.set(x, 0.01, z);
    raiz.add(s);
  }

  // Llamas de las velas y del candelabro (lo único que brilla de verdad, además de la luna)
  const llamas = [];
  for (const [x, z] of velas) llamas.push(new THREE.SphereGeometry(0.022, 8, 6).scale(1, 2, 1).translate(x, 1.62, z));
  llamas.push(new THREE.SphereGeometry(0.022, 8, 6).scale(1, 2, 1).translate(2.6, 1.13, 2.8));
  const matLlamas = R(new THREE.MeshBasicMaterial({ color: 0xffb347, toneMapped: false }));
  const mallaLlamas = new THREE.Mesh(R(fusionar(llamas)), matLlamas);
  raiz.add(mallaLlamas);
  // Ascuas en la chimenea
  const ascuas = new THREE.Mesh(
    R(fusionar([0, 1, 2, 3, 4].map((i) => new THREE.SphereGeometry(0.08 + (i % 2) * 0.03, 6, 4).scale(1.4, 0.5, 1)
      .translate(-SALA + 0.6, 0.06, -1.6 + i * 0.2)))),
    R(new THREE.MeshBasicMaterial({ color: 0xff5a1f, toneMapped: false })),
  );
  raiz.add(ascuas);

  // Ventana con la luna llena y ramas secas al otro lado del cristal
  const texVentana = R(ctx.texturaCanvas((g, tam) => {
    const cielo = g.createLinearGradient(0, 0, 0, tam);
    cielo.addColorStop(0, '#0c1636');
    cielo.addColorStop(1, '#3a4f86');
    g.fillStyle = cielo;
    g.fillRect(0, 0, tam, tam);
    const halo = g.createRadialGradient(tam * 0.66, tam * 0.3, 0, tam * 0.66, tam * 0.3, tam * 0.35);
    halo.addColorStop(0, 'rgba(220,230,255,0.55)');
    halo.addColorStop(1, 'rgba(220,230,255,0)');
    g.fillStyle = halo;
    g.fillRect(0, 0, tam, tam);
    g.fillStyle = '#f1f3ff';
    g.beginPath();
    g.arc(tam * 0.66, tam * 0.3, tam * 0.11, 0, Math.PI * 2);
    g.fill();
    // Ramas
    g.strokeStyle = '#05060c';
    g.lineCap = 'round';
    const rama = (x, y, a, largo, grosor) => {
      if (grosor < 1) return;
      const x2 = x + Math.cos(a) * largo;
      const y2 = y + Math.sin(a) * largo;
      g.lineWidth = grosor;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(x2, y2);
      g.stroke();
      rama(x2, y2, a - 0.45, largo * 0.72, grosor * 0.65);
      rama(x2, y2, a + 0.38, largo * 0.68, grosor * 0.6);
    };
    rama(0, tam * 0.95, -0.7, tam * 0.3, 9);
    // Parteluz: la cruz de la ventana
    g.fillStyle = '#1a120c';
    g.fillRect(tam * 0.48, 0, tam * 0.04, tam);
    g.fillRect(0, tam * 0.48, tam, tam * 0.04);
  }, { tam: 256, semilla: 74 }));
  const cristal = new THREE.Mesh(R(new THREE.PlaneGeometry(2.0, 1.7)), R(new THREE.MeshBasicMaterial({ map: texVentana, toneMapped: false })));
  cristal.position.set(1.0, 1.85, -SALA + 0.02);
  raiz.add(cristal);
  // La luz de la luna en el suelo, con la forma de la ventana
  const texLunaSuelo = R(ctx.texturaCanvas((g, tam) => {
    g.clearRect(0, 0, tam, tam);
    const grad = g.createLinearGradient(0, 0, 0, tam);
    grad.addColorStop(0, 'rgba(150,175,255,0.42)');
    grad.addColorStop(1, 'rgba(150,175,255,0.04)');
    g.fillStyle = grad;
    for (const [x, y] of [[0.08, 0.06], [0.54, 0.06], [0.08, 0.53], [0.54, 0.53]]) g.fillRect(x * tam, y * tam, tam * 0.38, tam * 0.41);
  }, { tam: 128, semilla: 75 }));
  const lunaSuelo = new THREE.Mesh(
    R(new THREE.PlaneGeometry(2.0, 3.0).rotateX(-Math.PI / 2)),
    R(new THREE.MeshBasicMaterial({ map: texLunaSuelo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })),
  );
  lunaSuelo.position.set(0.7, 0.012, -SALA + 2.2);
  raiz.add(lunaSuelo);

  // ─── Linternas ─────────────────────────────────────────────────────────
  // Linterna de metal con la cabeza ancha, aro cromado, empuñadura de goma con estrías, botón naranja
  // y cordón. Apunta hacia -Z; el haz es un cono de luz suave que se ve en el aire.
  const perfilCuerpo = [[0, 0.0], [0.016, 0.0], [0.018, 0.006], [0.018, 0.12], [0.02, 0.135], [0.032, 0.17], [0.034, 0.2], [0.03, 0.2]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const ATRAS = 0.07; // la cola sobresale por detrás del puño
  const aLinterna = (g) => g.rotateX(-Math.PI / 2).translate(0, 0, ATRAS);
  const geoCuerpo = R(aLinterna(new THREE.LatheGeometry(perfilCuerpo, 16)));
  const perfilGoma = [];
  for (let k = 0; k <= 16; k++) perfilGoma.push(new THREE.Vector2(k % 2 ? 0.0198 : 0.0188, 0.012 + k * 0.006));
  const geoGoma = R(fusionar([
    aLinterna(new THREE.LatheGeometry(perfilGoma, 14)),
    new THREE.TorusGeometry(0.008, 0.0025, 5, 10).rotateY(Math.PI / 2).translate(0, -0.014, ATRAS - 0.004), // anilla del cordón
  ], ['position', 'normal']));
  const geoAro = R(new THREE.TorusGeometry(0.033, 0.005, 8, 20).translate(0, 0, ATRAS - 0.2));
  const geoBoton = R(new THREE.BoxGeometry(0.012, 0.008, 0.02).translate(0, 0.02, ATRAS - 0.09));
  const geoLente = R(new THREE.CircleGeometry(0.029, 18).translate(0, 0, ATRAS - 0.201));
  const matMetal = R(new THREE.MeshStandardMaterial({ color: 0x2c3440, metalness: 0.7, roughness: 0.35 }));
  const matGoma = R(new THREE.MeshStandardMaterial({ color: 0x15171b, roughness: 0.9 }));
  const matCromo = R(new THREE.MeshStandardMaterial({ color: 0xdfe4ea, metalness: 1, roughness: 0.18 }));
  const matBoton = R(new THREE.MeshStandardMaterial({ color: 0xff6a3d, roughness: 0.4 }));
  const matLente = R(new THREE.MeshBasicMaterial({ color: 0xfff4d6, toneMapped: false }));
  // Haz: cono abierto con un degradado que se apaga a lo lejos
  const texHaz = R(ctx.texturaCanvas((g, tam) => {
    const grad = g.createLinearGradient(0, 0, 0, tam);
    grad.addColorStop(0, 'rgba(255,240,200,0.9)'); // junto a la linterna
    grad.addColorStop(0.25, 'rgba(255,240,200,0.35)');
    grad.addColorStop(1, 'rgba(255,240,200,0)');
    g.clearRect(0, 0, tam, tam);
    g.fillStyle = grad;
    g.fillRect(0, 0, tam, tam);
  }, { tam: 64, semilla: 76 }));
  const geoHaz = R(new THREE.ConeGeometry(Math.tan(APERTURA) * LARGO_HAZ * 0.45, LARGO_HAZ * 0.45, 24, 1, true)
    .translate(0, -LARGO_HAZ * 0.225, 0).rotateX(Math.PI / 2).translate(0, 0, ATRAS - 0.2));
  const matHaz = R(new THREE.MeshBasicMaterial({
    map: texHaz, transparent: true, opacity: 0.16, depthWrite: false, side: THREE.DoubleSide, blending: THREE.AdditiveBlending, fog: false,
  }));
  // La linterna se ve al TAM_LINTERNA de su tamaño modelado (más manejable en la mano); el haz
  // y lo que ilumina no cambian, solo arrancan de la lente en su nuevo sitio
  const TAM_LINTERNA = 0.75;
  function crearLinterna() {
    const g = new THREE.Group();
    const cuerpo = new THREE.Group();
    cuerpo.scale.setScalar(TAM_LINTERNA);
    cuerpo.add(new THREE.Mesh(geoCuerpo, matMetal), new THREE.Mesh(geoGoma, matGoma), new THREE.Mesh(geoAro, matCromo),
      new THREE.Mesh(geoBoton, matBoton), new THREE.Mesh(geoLente, matLente));
    const haz = new THREE.Mesh(geoHaz, matHaz);
    haz.position.z = (ATRAS - 0.2) * (TAM_LINTERNA - 1); // el haz sale de la lente
    haz.renderOrder = 2;
    g.add(cuerpo, haz);
    return g;
  }
  const linternas = ctx.manos.map((mano) => ({ mano, objeto: ctx.adjuntarAMano(mano, crearLinterna()) }));
  // Con ratón: la linterna abajo a la derecha de la vista, apuntando al cursor
  const linternaRaton = crearLinterna();
  linternaRaton.scale.setScalar(1.1);
  raiz.add(linternaRaton);
  const LENTE = new THREE.Vector3(0, 0, (ATRAS - 0.2) * TAM_LINTERNA);

  // ─── Fantasmas ─────────────────────────────────────────────────────────
  // Sábana con capucha redonda, bajo ondulado y bracitos estirados hacia ti (miran hacia +Z)
  const perfilFantasma = [[0.001, 0.62], [0.11, 0.6], [0.19, 0.53], [0.23, 0.42], [0.24, 0.28], [0.25, 0.1], [0.29, -0.12], [0.35, -0.3], [0.36, -0.34]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const sabanaGeo = new THREE.LatheGeometry(perfilFantasma, 24);
  {
    const pos = sabanaGeo.attributes.position;
    for (let i = 0; i < pos.count; i++) {
      const y = pos.getY(i);
      if (y < -0.1) {
        const a = Math.atan2(pos.getX(i), pos.getZ(i));
        pos.setY(i, y + Math.sin(a * 7) * 0.06 * ((-0.1 - y) / 0.24));
      }
    }
    sabanaGeo.computeVertexNormals();
  }
  const geoFantasma = R(fusionar([
    sabanaGeo,
    new THREE.CapsuleGeometry(0.055, 0.16, 4, 8).rotateX(Math.PI / 2 - 0.5).translate(-0.2, 0.16, 0.14),
    new THREE.CapsuleGeometry(0.055, 0.16, 4, 8).rotateX(Math.PI / 2 - 0.5).translate(0.2, 0.16, 0.14),
  ], ['position', 'normal']));
  const geoCara = R(fusionar([
    new THREE.SphereGeometry(0.045, 10, 8).scale(0.8, 1.25, 0.4).translate(-0.075, 0.42, 0.205),
    new THREE.SphereGeometry(0.045, 10, 8).scale(0.8, 1.25, 0.4).translate(0.075, 0.42, 0.205),
    new THREE.SphereGeometry(0.05, 10, 8).scale(0.9, 1.15, 0.4).translate(0, 0.27, 0.225), // boca abierta: «¡uuuh!»
  ], ['position', 'normal']));
  const fantasmas = [];
  for (let i = 0; i < MAX_FANTASMAS; i++) {
    const matCuerpo = R(new THREE.MeshLambertMaterial({ color: 0xffffff, emissive: 0x000000, transparent: true, opacity: 0.5, side: THREE.DoubleSide, depthWrite: false, fog: false }));
    const matCara = R(new THREE.MeshBasicMaterial({ color: 0x0d0714, transparent: true, opacity: 0.5, fog: false }));
    const grupo = new THREE.Group();
    const cuerpo = new THREE.Mesh(geoFantasma, matCuerpo);
    const cara = new THREE.Mesh(geoCara, matCara);
    cuerpo.renderOrder = 3;
    grupo.add(cuerpo, cara);
    grupo.visible = false;
    raiz.add(grupo);
    fantasmas.push({
      grupo, cuerpo, matCuerpo, matCara,
      estado: 'libre', // 'libre' | 'aparece' | 'acecha' | 'deshace' | 'ataca' | 'huye'
      tipo: AZAR_TIPOS[0], pos: new THREE.Vector3(), vel: new THREE.Vector3(),
      carga: 0, iluminado: 0, tiempo: 0, fase: 0, velocidad: 0, aparicion: 0, vibra: 0, luz: 0,
    });
  }
  const colorTmp = new THREE.Color();
  const BLANCO_CALIDO = new THREE.Color(0xfff4d6);

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.4, alto: 0.36 });
  marcador.mesh.position.set(-1.6, 2.55, -4.2);
  marcador.mesh.rotation.y = 0.25;
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  const lamento = ctx.sonidoContinuo('fantasma');
  let puntos = 0;
  let record = ctx.leer('record', 0);
  let estado = 'intro'; // 'intro' | 'jugando' | 'fin'
  let reloj = 2.5;
  let tiempoJugado = 0;
  let proximo = 0;
  let aviso = null;
  let tiempo = 0;

  const cabeza = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const mira = new THREE.Vector3();
  const lateral = new THREE.Vector3();
  const ejeY = new THREE.Vector3(0, 1, 0);
  const haces = [0, 1].map(() => ({ origen: new THREE.Vector3(), dir: new THREE.Vector3(0, 0, -1), on: false, mano: null }));

  const dificultad = () => Math.min(1, tiempoJugado / DIFICULTAD_MAX);
  const nivel = () => 1 + Math.floor(tiempoJugado / NIVEL_SEGUNDOS);
  const vivo = (f) => f.estado === 'aparece' || f.estado === 'acecha';
  const avisar = (texto, color, duracion = 1.3) => { aviso = { texto, color, tiempo: duracion }; };

  function actualizarMarcador() {
    const lineas = estado === 'intro'
      ? [{ texto: ctx.t('titulo'), tam: 1.2, color: '#b9f6ca' },
        { texto: ctx.t(ctx.enVR() ? 'introVR' : ctx.tactil ? 'introTactil' : 'intro'), tam: 0.7 }]
      : estado === 'fin'
        ? [{ texto: ctx.t('fin', { n: puntos }), tam: 1.2, color: '#b9f6ca' },
          { texto: ctx.t('partida.recordNuevaPartida', { record, n: Math.ceil(reloj) }), tam: 0.75 }]
        : [{ texto: ctx.t('marcador', { n: puntos }), tam: 1.3 },
          aviso ? { texto: aviso.texto, tam: 0.8, color: aviso.color }
            : { texto: ctx.t('estado', { s: Math.floor(tiempoJugado), record }), tam: 0.75, color: '#b0bec5' }];
    marcador.escribir(lineas);
  }

  // Ancho de la vista con ratón (para que los fantasmas salgan donde se ven)
  function medioAnchoVista() {
    const v = THREE.MathUtils.degToRad(ctx.camara.fov / 2);
    return Math.atan(Math.tan(v) * ctx.camara.aspect);
  }

  function elegirTipo() {
    const d = dificultad();
    const r = Math.random();
    if (tiempoJugado > 60 && r < 0.12 + d * 0.15) return AZAR_TIPOS[3];
    if (tiempoJugado > 35 && r < 0.35) return AZAR_TIPOS[2];
    if (tiempoJugado > 15 && r < 0.6) return AZAR_TIPOS[1];
    return AZAR_TIPOS[0];
  }

  function soltarFantasma() {
    const f = fantasmas.find((x) => x.estado === 'libre');
    if (!f) return;
    const d = dificultad();
    // En VR, cada vez más por los lados y por detrás; con ratón, dentro de la vista
    let rumbo;
    if (ctx.enVR()) {
      ctx.camara.getWorldDirection(mira);
      const delante = Math.atan2(mira.x, -mira.z);
      const abanico = Math.min(Math.PI, 1.1 + tiempoJugado / 40);
      rumbo = delante + azar(-abanico, abanico);
    } else {
      const m = medioAnchoVista() * 0.8;
      rumbo = azar(-m, m);
    }
    f.tipo = elegirTipo();
    f.pos.set(cabeza.x + Math.sin(rumbo) * RADIO_APARICION, azar(1.1, 2.0), cabeza.z - Math.cos(rumbo) * RADIO_APARICION);
    f.pos.x = THREE.MathUtils.clamp(f.pos.x, -SALA + 0.6, SALA - 0.6);
    f.pos.z = THREE.MathUtils.clamp(f.pos.z, -SALA + 0.6, SALA - 0.6);
    f.vel.set(0, 0, 0);
    f.velocidad = f.tipo.velocidad * (1 + d * 0.8) * azar(0.9, 1.1);
    f.estado = 'aparece';
    f.tiempo = 0;
    f.carga = 0;
    f.iluminado = 0;
    f.luz = 0;
    f.fase = Math.random() * 100;
    f.aparicion = 0;
    f.grupo.visible = true;
    f.grupo.scale.setScalar(f.tipo.escala);
    ctx.sonido('aparicion');
  }

  function deshacer(f, mano) {
    const dist = Math.hypot(f.pos.x - cabeza.x, f.pos.z - cabeza.z);
    const extra = dist > 4 ? 10 : dist > 2.5 ? 5 : 0;
    const valor = f.tipo.puntos + extra;
    f.estado = 'deshace';
    f.tiempo = 0;
    puntos += valor;
    const nivelImpacto = f.tipo.id === 'normal' && !extra ? 'pequeño' : 'medio';
    ctx.efectos.impacto(nivelImpacto, { pos: f.pos, mano, color: f.tipo.color, sonido: 'desvanecer' });
    ctx.efectos.estallido(f.pos, { color: f.tipo.color, cantidad: 14, fuerza: 1.1, gravedad: -1.5, vida: 0.8, tam: 0.03 });
    ctx.efectos.texto(tmp.copy(f.pos).setY(f.pos.y + 0.6 * f.tipo.escala), `+${valor}`, {
      color: extra ? '#ffe082' : '#e0f7fa', tam: valor >= 25 ? 1.3 : valor >= 15 ? 1.1 : 0.95,
    });
    if (extra >= 10) avisar(ctx.t('lejos'), '#ffe082', 1.1);
    else if (f.tipo.id === 'grande') avisar(ctx.t('grande'), '#e1bee7', 1.1);
  }

  function atrapado(f) {
    estado = 'fin';
    reloj = 6;
    aviso = null;
    f.estado = 'ataca';
    f.tiempo = 0;
    ctx.puntuacion(puntos); // a la clasificación (juegos/marcadores.js)
    if (puntos > record) {
      record = puntos;
      ctx.guardar('record', record);
    }
    ctx.sonido('susto');
    ctx.destello(0xe8f0ff, 0.7);
    for (const mano of ctx.manos) ctx.vibrar(mano, 1, 300);
    for (const otro of fantasmas) {
      if (otro !== f && vivo(otro)) { otro.estado = 'huye'; otro.tiempo = 0; }
    }
  }

  function empezar() {
    estado = 'jugando';
    puntos = 0;
    tiempoJugado = 0;
    proximo = 0.4; // el primero sale casi enseguida
    aviso = null;
    for (const f of fantasmas) { f.estado = 'libre'; f.grupo.visible = false; }
  }

  // ─── Haces de luz ──────────────────────────────────────────────────────
  function apuntarLinternas() {
    if (ctx.enVR()) {
      linternaRaton.visible = false;
      for (let i = 0; i < 2; i++) {
        const { mano, objeto } = linternas[i];
        const h = haces[i];
        h.on = mano.activa;
        h.mano = mano;
        objeto.visible = mano.activa;
        if (!h.on) continue;
        objeto.localToWorld(h.origen.copy(LENTE));
        h.dir.set(0, 0, -1).transformDirection(objeto.matrixWorld);
      }
    } else {
      // La linterna, abajo a la derecha delante de la cámara, apunta a donde señala el cursor
      const rayo = ctx.raton.rayo.ray;
      tmp.set(0.2, -0.22, -0.45).applyQuaternion(ctx.camara.quaternion).add(cabeza);
      linternaRaton.position.copy(tmp);
      tmp2.copy(rayo.direction).multiplyScalar(8).add(rayo.origin);
      linternaRaton.lookAt(tmp2);
      linternaRaton.rotateY(Math.PI); // lookAt apunta +Z; la linterna mira hacia -Z
      linternaRaton.visible = true;
      linternaRaton.updateMatrixWorld(true);
      linternaRaton.localToWorld(haces[0].origen.copy(LENTE));
      haces[0].dir.subVectors(tmp2, haces[0].origen).normalize();
      haces[0].on = true;
      haces[0].mano = null;
      haces[1].on = false;
    }
    for (let i = 0; i < 2; i++) {
      luz.uLinPos.value[i].copy(haces[i].origen);
      luz.uLinDir.value[i].copy(haces[i].dir);
      luz.uLinOn.value[i] = haces[i].on ? 1 : 0;
    }
  }

  // ¿Le da la luz? (el haz tiene un ángulo, y el fantasma, su tamaño)
  let luzN = 0;
  let luzMano = null;
  function luzSobre(f) {
    luzN = 0;
    luzMano = null;
    if (estado !== 'jugando') return;
    for (const h of haces) {
      if (!h.on) continue;
      tmp.copy(f.pos).y += 0.2 * f.tipo.escala;
      tmp.sub(h.origen);
      const dist = tmp.length();
      if (dist > LARGO_HAZ || dist < 0.05) continue;
      const angulo = Math.acos(THREE.MathUtils.clamp(tmp.dot(h.dir) / dist, -1, 1));
      if (angulo < APERTURA + Math.atan((0.3 * f.tipo.escala) / dist)) {
        luzN++;
        luzMano = h.mano;
      }
    }
  }

  // ─── Movimiento de los fantasmas ───────────────────────────────────────
  function moverFantasmas(dt) {
    let masCerca = null;
    let distCerca = Infinity;
    for (const f of fantasmas) {
      if (f.estado === 'libre') continue;
      f.tiempo += dt;
      f.fase += dt;
      const t = f.tipo;
      let brillo = t.brillo;
      let opacidad = 1;
      let temblor = 0;
      if (f.estado === 'aparece' || f.estado === 'acecha') {
        if (f.estado === 'aparece') {
          f.aparicion = Math.min(1, f.tiempo / 0.6);
          if (f.aparicion >= 1) f.estado = 'acecha';
        }
        luzSobre(f);
        const n = luzN;
        const mano = luzMano;
        f.iluminado = n;
        // Hacia tu cabeza, en zigzag, cada vez más derecho
        tmp.set(cabeza.x - f.pos.x, 0, cabeza.z - f.pos.z);
        const dist = tmp.length();
        tmp.divideScalar(Math.max(dist, 0.001));
        lateral.set(-tmp.z, 0, tmp.x);
        const zig = Math.sin(f.fase * (1.3 + t.zigzag)) * t.zigzag * Math.min(1, dist / 3);
        // Con la luz encima casi no avanza, tiembla y se va cargando hasta deshacerse
        const freno = n ? 0.12 : 1;
        tmp2.copy(tmp).multiplyScalar(f.velocidad * freno).addScaledVector(lateral, zig * f.velocidad * freno);
        tmp2.y = (cabeza.y - 0.35 - f.pos.y) * 0.6 + Math.sin(f.fase * 2.1) * 0.15;
        f.vel.lerp(tmp2, 1 - Math.exp(-dt * 3));
        f.pos.addScaledVector(f.vel, dt);
        if (n) {
          f.carga += dt * (n > 1 ? 1.6 : 1);
          f.vibra -= dt;
          if (f.vibra <= 0 && mano) {
            ctx.vibrar(mano, 0.25, 30);
            f.vibra = 0.12;
          }
          temblor = 0.04;
          brillo = 0.9 + Math.sin(tiempo * 40) * 0.1;
          if (f.carga >= t.vida && estado === 'jugando') deshacer(f, mano);
        } else {
          f.carga = Math.max(0, f.carga - dt * 0.5);
        }
        if (f.estado === 'aparece' || f.estado === 'acecha') {
          opacidad = f.aparicion;
          if (dist < ALCANCE && estado === 'jugando') atrapado(f);
          else if (!n && dist < distCerca) {
            distCerca = dist;
            masCerca = f;
          }
        }
      }
      if (f.estado === 'deshace') {
        // Sube girando, se estira y se desvanece
        const k = Math.min(1, f.tiempo / 0.6);
        f.pos.y += dt * 1.2;
        f.grupo.rotation.y += dt * 12;
        f.grupo.scale.set(t.escala * (1 - k * 0.7), t.escala * (1 + k * 0.8), t.escala * (1 - k * 0.7));
        brillo = 1.2;
        opacidad = 1 - k;
        if (k >= 1) { f.estado = 'libre'; f.grupo.visible = false; continue; }
      } else if (f.estado === 'ataca') {
        // Se lanza a tu cara (el susto)
        const k = Math.min(1, f.tiempo / 0.35);
        ctx.camara.getWorldDirection(mira);
        tmp.copy(cabeza).addScaledVector(mira, 0.45);
        f.pos.lerp(tmp, k);
        f.grupo.scale.setScalar(t.escala * (1 + k * 0.6));
        brillo = 0.8;
        opacidad = f.tiempo < 0.9 ? 1 : Math.max(0, 1 - (f.tiempo - 0.9) / 0.5);
        if (f.tiempo > 1.4) { f.estado = 'libre'; f.grupo.visible = false; continue; }
      } else if (f.estado === 'huye') {
        // Se van atravesando las paredes
        tmp.set(f.pos.x - cabeza.x, 0, f.pos.z - cabeza.z).normalize();
        f.pos.addScaledVector(tmp, dt * 2.5);
        f.pos.y += dt * 0.5;
        opacidad = Math.max(0, 1 - f.tiempo / 1.2);
        if (f.tiempo > 1.2) { f.estado = 'libre'; f.grupo.visible = false; continue; }
      }
      // Sin la luz de una linterna encima no se ven nada (solo se oyen): se encienden en 0,1 s al
      // entrar en el haz y se apagan en 0,25 s al salir. Al deshacerse y al atacarte sí se ven.
      if (f.estado === 'aparece' || f.estado === 'acecha' || f.estado === 'huye') {
        const objetivo = f.iluminado && f.estado !== 'huye' ? 1 : 0;
        f.luz += (objetivo - f.luz) * Math.min(1, dt * (objetivo ? 10 : 4));
        opacidad *= f.luz;
      } else f.luz = 1;
      f.grupo.visible = opacidad > 0.01;
      if (!f.grupo.visible) continue;
      // Dibujo: mira hacia ti, flota, ondea y brilla según la luz
      f.grupo.position.copy(f.pos);
      f.grupo.position.x += Math.sin(tiempo * 61) * temblor;
      f.grupo.position.y += Math.sin(f.fase * 2.6) * 0.05;
      if (f.estado !== 'deshace') {
        f.grupo.rotation.y = Math.atan2(cabeza.x - f.pos.x, cabeza.z - f.pos.z);
        if (f.estado !== 'ataca') {
          const ola = Math.sin(f.fase * 3.3) * 0.04;
          f.grupo.scale.set(t.escala * (1 + ola), t.escala * (1 - ola * 0.6), t.escala * (1 + ola));
        }
      }
      f.cuerpo.rotation.z = Math.sin(f.fase * 1.7) * 0.08;
      colorTmp.set(t.color);
      if (f.iluminado) colorTmp.lerp(BLANCO_CALIDO, 0.4);
      f.matCuerpo.color.copy(colorTmp);
      f.matCuerpo.emissive.copy(colorTmp).multiplyScalar(brillo);
      f.matCuerpo.opacity = opacidad * Math.min(0.92, 0.12 + brillo * 0.85);
      f.matCara.opacity = opacidad * Math.min(1, 0.15 + brillo);
    }
    // El lamento del más cercano que no está a la luz: por su lado y más fuerte cuanto más cerca
    if (masCerca && estado === 'jugando') {
      tmp.copy(masCerca.pos);
      ctx.camara.worldToLocal(tmp);
      const lado = THREE.MathUtils.clamp(tmp.x / Math.max(0.3, Math.hypot(tmp.x, tmp.z)), -1, 1);
      const cerca = 1 - Math.min(1, distCerca / (RADIO_APARICION + 1));
      lamento.ajustar(0.5 + lado * 0.5, 0.03 + cerca * cerca * 0.22 * (tmp.z > 0 ? 0.8 : 1));
    } else {
      lamento.ajustar(0.5, 0);
    }
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
        avisar(ctx.t('masFantasmas'), '#b9f6ca', 2);
        ctx.sonido('aparicion');
      }
      // Cada vez salen más seguidos y caben más a la vez
      const d = dificultad();
      proximo -= dt;
      let activos = 0;
      for (const f of fantasmas) if (vivo(f)) activos++;
      if (proximo <= 0 && activos < Math.round(2 + d * 6)) {
        soltarFantasma();
        proximo = (2.2 - d * 1.4) * azar(0.8, 1.2); // de 2,2 s al empezar a 0,8 s al final
      }
    }
    if (aviso && (aviso.tiempo -= dt) <= 0) aviso = null;

    apuntarLinternas();
    moverFantasmas(dt);

    // Las velas y las ascuas tiemblan
    matLlamas.color.setRGB(1, 0.62 + Math.sin(tiempo * 13) * 0.08 + Math.sin(tiempo * 23.7) * 0.05, 0.22);
    ascuas.material.color.setRGB(1, 0.33 + Math.sin(tiempo * 3.1) * 0.06 + Math.sin(tiempo * 7.3) * 0.04, 0.1);
    actualizarMarcador();
  }

  apuntarLinternas();
  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      // La shell retira lo que hay en la escena y en las manos, los recursos registrados y el lamento.
      fantasmas.length = 0;
    },
  };
}
