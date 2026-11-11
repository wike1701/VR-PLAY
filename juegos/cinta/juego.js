// CINTA MECÁNICA
// Un almacén con una cinta transportadora delante que pasa de izquierda a derecha. Llegan objetos
// (fruta, latas, botellas y cajas de cuatro colores) y hay que echar cada uno en su cubo según la regla:
// al principio por color y, más adelante, por tipo. La regla cambia cada cierto tiempo, con un aviso
// grande y una cuenta atrás de unos segundos antes. Si un objeto llega al final de la cinta, se cae al suelo o va al cubo equivocado, es un fallo;
// con 3 fallos se acaba. La cinta acelera poco a poco y los objetos llegan más seguidos.
//
// En VR: coges el objeto con el gatillo y lo sueltas dentro del cubo o lo lanzas (con algo de ayuda a la
// puntería). Con ratón o en el móvil: tocas el objeto y luego el cubo, o lo arrastras hasta el cubo.
import * as THREE from 'three';

// Todo se genera con código: no hay nada que descargar.
export async function precargar() {}

const VIDAS = 3;
const MAX_OBJETOS = 12;
const CINTA_Y = 0.92;           // altura de la cinta
const CINTA_Z = -0.72;          // centro de la cinta
const CINTA_ANCHO = 0.36;
const CINTA_INICIO = -1.55;     // salen del túnel aquí
const CINTA_FIN = 1.45;         // aquí caen al cajón de rechazo
const BORDE_CUBO = 0.62;        // altura del borde de los cubos
const R_CUBO = 0.16;            // radio de la boca
const CUBOS_X = [-0.66, -0.22, 0.22, 0.66];
const CUBOS_Z = -0.24;
const DURACION_REGLA = 28;      // segundos que dura cada regla
const AVISO_PREVIO = 6;         // segundos de cuenta atrás antes de cada cambio de regla
const CARTELES_Y = 1.26;        // tablero de carteles, al otro lado de la cinta y de cara al jugador
const CARTELES_Z = -1.0;
const R_COGER = 0.13;           // distancia de la mano para coger un objeto (VR)
const GRAVEDAD = 9.8;
const HISTORIAL = 8;

// Los 4 colores (y el de cada cubo) y los 4 tipos de objeto
const COLORES = [0xe53935, 0x1e88e5, 0xfdd835, 0x43a047];
const TIPOS = ['fruta', 'lata', 'botella', 'caja'];

const azar = (a, b) => a + Math.random() * (b - a);
const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

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

// Geometría de cada tipo de objeto en un color (con la base en y = 0)
function geometriaObjeto(tipo, color) {
  const piezas = [];
  const colores = [];
  const pieza = (g, c) => { piezas.push(g); colores.push(c); };
  const oscuro = new THREE.Color(color).multiplyScalar(0.7);
  if (tipo === 'fruta') {
    pieza(new THREE.SphereGeometry(0.055, 16, 12).scale(1, 0.9, 1).translate(0, 0.05, 0), color);
    pieza(new THREE.CylinderGeometry(0.004, 0.006, 0.035, 5).rotateZ(0.25).translate(0.003, 0.11, 0), 0x6d4c2f);
    pieza(new THREE.SphereGeometry(0.02, 8, 6).scale(1.3, 0.25, 0.6).rotateZ(-0.4).translate(0.022, 0.112, 0), 0x4caf50);
  } else if (tipo === 'lata') {
    pieza(new THREE.CylinderGeometry(0.038, 0.038, 0.12, 18).translate(0, 0.06, 0), color);
    pieza(new THREE.CylinderGeometry(0.0385, 0.0385, 0.035, 18, 1, true).translate(0, 0.065, 0), 0xf5f5f5);
    pieza(new THREE.TorusGeometry(0.034, 0.004, 5, 18).rotateX(Math.PI / 2).translate(0, 0.12, 0), 0xb0bec5);
    pieza(new THREE.CylinderGeometry(0.034, 0.034, 0.002, 18).translate(0, 0.121, 0), 0xcfd8dc);
    pieza(new THREE.TorusGeometry(0.034, 0.004, 5, 18).rotateX(Math.PI / 2).translate(0, 0.002, 0), 0xb0bec5);
  } else if (tipo === 'botella') {
    const perfil = [[0.001, 0], [0.034, 0], [0.037, 0.012], [0.037, 0.11], [0.03, 0.14], [0.014, 0.168], [0.014, 0.19], [0.001, 0.19]]
      .map(([x, y]) => new THREE.Vector2(x, y));
    pieza(new THREE.LatheGeometry(perfil, 18), color);
    pieza(new THREE.CylinderGeometry(0.0375, 0.0375, 0.045, 18, 1, true).translate(0, 0.06, 0), 0xfafafa);
    pieza(new THREE.CylinderGeometry(0.017, 0.017, 0.018, 12).translate(0, 0.198, 0), oscuro.getHex());
  } else {
    pieza(new THREE.BoxGeometry(0.12, 0.1, 0.1).translate(0, 0.05, 0), color);
    pieza(new THREE.BoxGeometry(0.122, 0.003, 0.028).translate(0, 0.1005, 0), 0xc8a165);
    pieza(new THREE.BoxGeometry(0.028, 0.06, 0.102).translate(0, 0.07, 0), 0xc8a165);
  }
  return fusionar(piezas, colores);
}

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  // ─── Almacén ───────────────────────────────────────────────────────────
  ctx.fondo(0x3a4250, { cenit: 0x232831, horizonte: 0x4a5260, suelo: 0x2a2f38, niebla: [9, 22] });
  ctx.sueloBase(false);
  // Desde detrás de los cubos; con la pantalla en vertical (móvil), más alta y más atrás para que quepan
  const VISTAS = {
    horizontal: [new THREE.Vector3(0, 1.72, 0.78), new THREE.Vector3(0, 0.95, -0.6)],
    vertical: [new THREE.Vector3(0, 2.15, 1.25), new THREE.Vector3(0, 1.0, -0.5)],
  };
  let vistaVertical = null;
  function colocarVista() {
    const vertical = ctx.camara.aspect < 1;
    if (vertical === vistaVertical) return;
    vistaVertical = vertical;
    ctx.vistaEscritorio(...VISTAS[vertical ? 'vertical' : 'horizontal']);
  }
  colocarVista();

  // Suelo de hormigón con las líneas amarillas de seguridad
  const texSuelo = R(ctx.texturaCanvas((g, tam, azarTex) => {
    g.fillStyle = '#7d8189';
    g.fillRect(0, 0, tam, tam);
    for (let i = 0; i < 900; i++) {
      const v = 100 + Math.floor(azarTex() * 50);
      g.fillStyle = `rgba(${v},${v},${v + 4},0.35)`;
      g.fillRect(azarTex() * tam, azarTex() * tam, 2 + azarTex() * 5, 2 + azarTex() * 5);
    }
    g.strokeStyle = 'rgba(40,40,45,0.35)';
    g.lineWidth = 2;
    g.strokeRect(0, 0, tam, tam);
  }, { tam: 512, repetir: [8, 8], semilla: 191 }));
  raiz.add(new THREE.Mesh(R(new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2).translate(0, 0, -2)), R(new THREE.MeshLambertMaterial({ map: texSuelo }))));
  // Franjas de seguridad amarillas y negras (en el suelo, alrededor del puesto)
  const texFranjas = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#1d1d1d';
    g.fillRect(0, 0, tam, tam);
    g.fillStyle = '#f9c80e';
    for (let i = -tam; i < tam * 2; i += tam / 4) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + tam / 8, 0);
      g.lineTo(i + tam / 8 + tam, tam);
      g.lineTo(i + tam, tam);
      g.closePath();
      g.fill();
    }
  }, { tam: 128, repetir: [1, 1], semilla: 192 }));
  texFranjas.repeat.set(12, 1);
  const matFranjas = R(new THREE.MeshLambertMaterial({ map: texFranjas }));
  raiz.add(new THREE.Mesh(R(fusionar([
    new THREE.PlaneGeometry(3.6, 0.08).rotateX(-Math.PI / 2).translate(0, 0.003, 0.45),
    new THREE.PlaneGeometry(3.6, 0.08).rotateX(-Math.PI / 2).translate(0, 0.003, -1.25),
  ])), matFranjas));

  // Paredes de chapa ondulada con ventanas altas, y el techo con vigas
  const texChapa = R(ctx.texturaCanvas((g, tam) => {
    for (let x = 0; x < tam; x++) {
      const v = 120 + Math.round(Math.sin((x / tam) * Math.PI * 16) * 22);
      g.fillStyle = `rgb(${v - 30},${v - 18},${v - 6})`;
      g.fillRect(x, 0, 1, tam);
    }
    g.fillStyle = 'rgba(0,0,0,0.25)';
    g.fillRect(0, tam * 0.97, tam, tam * 0.03);
  }, { tam: 256, repetir: [8, 1], semilla: 193 }));
  raiz.add(new THREE.Mesh(R(fusionar([
    new THREE.PlaneGeometry(14, 6).translate(0, 3, -6),
    new THREE.PlaneGeometry(14, 6).rotateY(Math.PI / 2).translate(-5, 3, -1),
    new THREE.PlaneGeometry(14, 6).rotateY(-Math.PI / 2).translate(5, 3, -1),
    new THREE.PlaneGeometry(14, 6).rotateY(Math.PI).translate(0, 3, 4),
  ])), R(new THREE.MeshLambertMaterial({ map: texChapa }))));
  // Ventanas y lámparas del techo: brillan por sí solas (sin luces)
  const luminosos = [];
  for (let i = 0; i < 5; i++) luminosos.push(new THREE.PlaneGeometry(1.6, 0.7).translate(-4 + i * 2, 4.6, -5.98));
  for (const x of [-2.5, 0, 2.5]) {
    for (const z of [-3.5, -0.5]) luminosos.push(new THREE.CylinderGeometry(0.32, 0.32, 0.02, 16).translate(x, 4.2, z));
  }
  raiz.add(new THREE.Mesh(R(fusionar(luminosos)), R(new THREE.MeshBasicMaterial({ color: 0xf2f6ff }))));
  const vigas = [];
  for (const z of [-5, -3, -1, 1]) vigas.push(new THREE.BoxGeometry(10, 0.25, 0.18).translate(0, 4.6, z));
  for (const x of [-2.5, 0, 2.5]) {
    for (const z of [-3.5, -0.5]) vigas.push(new THREE.ConeGeometry(0.36, 0.22, 16, 1, true).translate(x, 4.32, z));
  }
  // Tuberías a lo largo de la pared del fondo
  for (const [y, r] of [[3.4, 0.08], [3.65, 0.05]]) vigas.push(new THREE.CylinderGeometry(r, r, 10, 10).rotateZ(Math.PI / 2).translate(0, y, -5.9));
  raiz.add(new THREE.Mesh(R(fusionar(vigas)), R(new THREE.MeshLambertMaterial({ color: 0x4f5866 }))));

  // Estanterías con cajas al fondo y a los lados (dos mallas)
  const estantes = [];
  const cajas = [];
  const coloresCajas = [];
  const tonosCaja = [0xb98b55, 0xa77b48, 0xc99a63, 0x8f6a3f];
  for (const [x, z, giro] of [[-2.6, -4.4, 0], [0, -4.4, 0], [2.6, -4.4, 0], [-4.4, -1.6, Math.PI / 2], [4.4, -1.6, -Math.PI / 2]]) {
    const colocar = (g) => g.rotateY(giro).translate(x, 0, z);
    for (const xl of [-1.1, 1.1]) for (const zl of [-0.35, 0.35]) estantes.push(colocar(new THREE.BoxGeometry(0.07, 2.6, 0.07).translate(xl, 1.3, zl)));
    for (const y of [0.15, 1.0, 1.85]) {
      estantes.push(colocar(new THREE.BoxGeometry(2.3, 0.05, 0.8).translate(0, y, 0)));
      for (let k = 0; k < 4; k++) {
        const ancho = 0.35 + ((k * 7 + y * 10) % 3) * 0.08;
        const alto = 0.3 + ((k * 3 + y * 7) % 4) * 0.08;
        cajas.push(colocar(new THREE.BoxGeometry(ancho, alto, 0.55).translate(-0.85 + k * 0.56, y + 0.025 + alto / 2, 0)));
        coloresCajas.push(tonosCaja[(k + Math.round(y * 3)) % 4]);
      }
    }
  }
  raiz.add(new THREE.Mesh(R(fusionar(estantes)), R(new THREE.MeshLambertMaterial({ color: 0x2f6fb0 }))));
  raiz.add(new THREE.Mesh(R(fusionar(cajas, coloresCajas)), R(new THREE.MeshLambertMaterial({ vertexColors: true }))));

  // ─── La cinta ──────────────────────────────────────────────────────────
  const largoCinta = CINTA_FIN - CINTA_INICIO + 0.3;
  const centroCinta = (CINTA_FIN + CINTA_INICIO) / 2;
  // Banda de goma con tacos: se desplaza su textura para que avance
  const texBanda = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#26282d';
    g.fillRect(0, 0, tam, tam);
    g.fillStyle = '#34373e';
    for (let i = 0; i < 8; i++) g.fillRect((i / 8) * tam, 0, tam / 32, tam);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    g.fillRect(0, tam * 0.1, tam, tam * 0.02);
    g.fillRect(0, tam * 0.88, tam, tam * 0.02);
  }, { tam: 128, semilla: 194 }));
  const TAM_TACOS = 0.5; // metros que ocupa una repetición de la textura
  texBanda.repeat.set(largoCinta / TAM_TACOS, 1);
  const banda = new THREE.Mesh(
    R(new THREE.PlaneGeometry(largoCinta, CINTA_ANCHO).rotateX(-Math.PI / 2).translate(centroCinta, CINTA_Y, CINTA_Z)),
    R(new THREE.MeshLambertMaterial({ map: texBanda })),
  );
  raiz.add(banda);
  // Rodillos: asoman por delante de la banda y giran (también con la textura desplazada)
  const texRodillo = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#9aa3ad';
    g.fillRect(0, 0, tam, tam);
    g.fillStyle = '#5d6670';
    for (let i = 0; i < 4; i++) g.fillRect((i / 4) * tam, 0, tam / 10, tam);
    g.fillStyle = 'rgba(255,255,255,0.35)';
    g.fillRect(0, tam * 0.45, tam, tam * 0.06);
  }, { tam: 64, semilla: 195 }));
  const rodillos = [];
  for (let x = CINTA_INICIO - 0.1; x <= CINTA_FIN + 0.12; x += 0.16) {
    rodillos.push(new THREE.CylinderGeometry(0.035, 0.035, CINTA_ANCHO + 0.06, 14).rotateX(Math.PI / 2).translate(x, CINTA_Y - 0.04, CINTA_Z));
  }
  raiz.add(new THREE.Mesh(R(fusionar(rodillos)), R(new THREE.MeshLambertMaterial({ map: texRodillo }))));
  // Bastidor: largueros con franjas de seguridad, patas y el túnel de salida (con cortina de tiras)
  const bastidor = [];
  for (const lado of [-1, 1]) {
    bastidor.push(new THREE.BoxGeometry(largoCinta + 0.1, 0.1, 0.04).translate(centroCinta, CINTA_Y - 0.02, CINTA_Z + lado * (CINTA_ANCHO / 2 + 0.03)));
  }
  raiz.add(new THREE.Mesh(R(fusionar(bastidor)), matFranjas));
  const metal = [];
  for (let x = CINTA_INICIO; x <= CINTA_FIN + 0.1; x += 0.75) {
    for (const lado of [-1, 1]) metal.push(new THREE.BoxGeometry(0.05, CINTA_Y - 0.07, 0.05).translate(x, (CINTA_Y - 0.07) / 2, CINTA_Z + lado * (CINTA_ANCHO / 2 + 0.03)));
  }
  // Túnel del que salen los objetos
  const xTunel = CINTA_INICIO - 0.05;
  metal.push(new THREE.BoxGeometry(0.5, 0.06, CINTA_ANCHO + 0.2).translate(xTunel, CINTA_Y + 0.36, CINTA_Z));
  for (const lado of [-1, 1]) metal.push(new THREE.BoxGeometry(0.5, 0.42, 0.06).translate(xTunel, CINTA_Y + 0.15, CINTA_Z + lado * (CINTA_ANCHO / 2 + 0.07)));
  // Cajón de rechazo al final de la cinta
  const xRechazo = CINTA_FIN + 0.35;
  metal.push(new THREE.BoxGeometry(0.42, 0.04, 0.5).translate(xRechazo, 0.02, CINTA_Z));
  for (const lado of [-1, 1]) {
    metal.push(new THREE.BoxGeometry(0.42, 0.5, 0.03).translate(xRechazo, 0.25, CINTA_Z + lado * 0.25));
    metal.push(new THREE.BoxGeometry(0.03, 0.5, 0.5).translate(xRechazo + lado * 0.21, 0.25, CINTA_Z));
  }
  // Poste de las luces de vidas
  metal.push(new THREE.CylinderGeometry(0.025, 0.025, 1.6, 8).translate(1.25, 0.8, CINTA_Z - 0.35));
  metal.push(new THREE.BoxGeometry(0.1, 0.36, 0.1).translate(1.25, 1.75, CINTA_Z - 0.35));
  raiz.add(new THREE.Mesh(R(fusionar(metal)), R(new THREE.MeshLambertMaterial({ color: 0x5b6573 }))));
  const tiras = [];
  for (let i = 0; i < 6; i++) tiras.push(new THREE.PlaneGeometry(0.055, 0.32).rotateY(Math.PI / 2).translate(xTunel + 0.24, CINTA_Y + 0.17, CINTA_Z - CINTA_ANCHO / 2 + 0.03 + i * 0.062));
  raiz.add(new THREE.Mesh(R(fusionar(tiras)), R(new THREE.MeshLambertMaterial({ color: 0xffb74d, transparent: true, opacity: 0.6, side: THREE.DoubleSide }))));

  // Luces de vidas: verdes mientras quedan, rojas al perderlas
  const geoLuz = R(new THREE.SphereGeometry(0.035, 12, 10));
  const lucesVida = [0, 1, 2].map((i) => {
    const luz = new THREE.Mesh(geoLuz, R(new THREE.MeshBasicMaterial({ color: 0x66ff88 })));
    luz.position.set(1.25, 1.87 - i * 0.11, CINTA_Z - 0.29);
    raiz.add(luz);
    return luz;
  });
  // Luz de aviso al final de la cinta: se pone roja cuando se escapa un objeto
  const avisoFin = new THREE.Mesh(R(new THREE.CylinderGeometry(0.04, 0.04, 0.06, 12)), R(new THREE.MeshBasicMaterial({ color: 0x553322 })));
  avisoFin.position.set(CINTA_FIN + 0.12, CINTA_Y + 0.3, CINTA_Z - CINTA_ANCHO / 2 - 0.05);
  raiz.add(avisoFin);
  let avisoFinTiempo = 0;

  // ─── Cubos ─────────────────────────────────────────────────────────────
  // Cubo de plástico abierto, con su aro (que se ilumina), y su cartel con lo que acepta en el tablero
  // del otro lado de la cinta (a la vista mientras juegas), enmarcado con el color del cubo
  const perfilCubo = [[0.001, 0.01], [0.125, 0.01], [0.13, 0], [R_CUBO, BORDE_CUBO]].map(([x, y]) => new THREE.Vector2(x, y));
  const geoCubo = R(new THREE.LatheGeometry(perfilCubo, 28));
  const geoAro = R(new THREE.TorusGeometry(R_CUBO, 0.012, 6, 28).rotateX(Math.PI / 2).translate(0, BORDE_CUBO, 0));
  const geoCartel = R(new THREE.PlaneGeometry(0.24, 0.24));
  // Atlas de iconos: primera fila, los 4 colores; segunda fila, los 4 tipos
  const texIconos = R(ctx.texturaCanvas((g, tam) => {
    const c = tam / 4;
    g.fillStyle = '#f4f1ea';
    g.fillRect(0, 0, tam, tam);
    for (let i = 0; i < 4; i++) {
      // Colores: una mancha grande
      g.fillStyle = `#${COLORES[i].toString(16).padStart(6, '0')}`;
      g.beginPath();
      g.arc(i * c + c / 2, c / 2, c * 0.36, 0, Math.PI * 2);
      g.fill();
      // Tipos: silueta oscura
      const x = i * c + c / 2;
      const y = c + c / 2;
      g.fillStyle = '#2b2f36';
      g.beginPath();
      if (i === 0) {
        g.arc(x, y + c * 0.06, c * 0.28, 0, Math.PI * 2);
        g.fill();
        g.fillRect(x - c * 0.02, y - c * 0.36, c * 0.04, c * 0.14);
        g.fillStyle = '#4caf50';
        g.beginPath();
        g.ellipse(x + c * 0.1, y - c * 0.28, c * 0.1, c * 0.04, -0.4, 0, Math.PI * 2);
        g.fill();
      } else if (i === 1) {
        g.fillRect(x - c * 0.2, y - c * 0.32, c * 0.4, c * 0.64);
        g.fillStyle = '#f4f1ea';
        g.fillRect(x - c * 0.2, y - c * 0.06, c * 0.4, c * 0.1);
      } else if (i === 2) {
        g.fillRect(x - c * 0.16, y - c * 0.08, c * 0.32, c * 0.42);
        g.beginPath();
        g.moveTo(x - c * 0.16, y - c * 0.08);
        g.lineTo(x - c * 0.07, y - c * 0.24);
        g.lineTo(x + c * 0.07, y - c * 0.24);
        g.lineTo(x + c * 0.16, y - c * 0.08);
        g.fill();
        g.fillRect(x - c * 0.07, y - c * 0.38, c * 0.14, c * 0.15);
      } else {
        g.fillStyle = '#b98b55';
        g.fillRect(x - c * 0.32, y - c * 0.24, c * 0.64, c * 0.5);
        g.fillStyle = '#2b2f36';
        g.lineWidth = c * 0.04;
        g.strokeStyle = '#2b2f36';
        g.strokeRect(x - c * 0.32, y - c * 0.24, c * 0.64, c * 0.5);
        g.fillRect(x - c * 0.06, y - c * 0.24, c * 0.12, c * 0.5);
      }
    }
  }, { tam: 512, semilla: 196 }));
  const cubos = CUBOS_X.map((x, i) => {
    const grupo = new THREE.Group();
    grupo.position.set(x, 0, CUBOS_Z);
    const cuerpo = new THREE.Mesh(geoCubo, R(new THREE.MeshLambertMaterial({ color: COLORES[i], side: THREE.DoubleSide })));
    const matAro = R(new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const aro = new THREE.Mesh(geoAro, matAro);
    const tex = R(texIconos.clone());
    tex.repeat.set(0.25, 0.25);
    const cartel = new THREE.Mesh(geoCartel, R(new THREE.MeshBasicMaterial({ map: tex })));
    cartel.position.set(x, CARTELES_Y, CARTELES_Z + 0.006);
    raiz.add(cartel);
    grupo.add(cuerpo, aro);
    raiz.add(grupo);
    const sombra = ctx.crearSombra({ radio: 0.2, opacidad: 0.4 });
    ctx.colocarSombra(sombra, grupo.position, 0.004);
    raiz.add(sombra);
    return { indice: i, grupo, matAro, tex, acepta: i, brillo: 0, colorBrillo: new THREE.Color(), pos: new THREE.Vector3(x, BORDE_CUBO, CUBOS_Z) };
  });

  // Tablero de los carteles: marcos del color de cada cubo (parpadean antes de un cambio de regla),
  // una viga y dos postes
  const matMarcos = R(new THREE.MeshBasicMaterial({ vertexColors: true }));
  raiz.add(new THREE.Mesh(R(fusionar(CUBOS_X.map((x) => new THREE.PlaneGeometry(0.3, 0.3).translate(x, CARTELES_Y, CARTELES_Z))
    .concat([new THREE.PlaneGeometry(0.06, 0.05).translate(0, -10, 0)]), [...COLORES, 0])), matMarcos));
  raiz.add(new THREE.Mesh(R(fusionar([
    new THREE.BoxGeometry(1.9, 0.05, 0.05).translate(0, CARTELES_Y + 0.18, CARTELES_Z - 0.03),
    new THREE.BoxGeometry(0.04, CARTELES_Y + 0.18, 0.04).translate(-0.95, (CARTELES_Y + 0.18) / 2, CARTELES_Z - 0.03),
    new THREE.BoxGeometry(0.04, CARTELES_Y + 0.18, 0.04).translate(0.95, (CARTELES_Y + 0.18) / 2, CARTELES_Z - 0.03),
    ...CUBOS_X.map((x) => new THREE.BoxGeometry(0.31, 0.31, 0.02).translate(x, CARTELES_Y, CARTELES_Z - 0.012)),
  ])), R(new THREE.MeshLambertMaterial({ color: 0x3c4450 }))));

  // ─── Objetos (un grupo fijo que se reutiliza) ──────────────────────────
  const geos = TIPOS.map((tipo) => COLORES.map((color) => R(geometriaObjeto(tipo, color))));
  const matObjeto = R(new THREE.MeshLambertMaterial({ vertexColors: true }));
  const objetos = Array.from({ length: MAX_OBJETOS }, () => {
    const malla = new THREE.Mesh(geos[0][0], matObjeto);
    malla.visible = false;
    raiz.add(malla);
    const sombra = ctx.crearSombra({ radio: 0.06, opacidad: 0.35 });
    sombra.visible = false;
    raiz.add(sombra);
    return {
      malla, sombra, pos: malla.position, vel: new THREE.Vector3(), giro: new THREE.Vector3(),
      estado: 'libre', // 'libre' | 'cinta' | 'mano' | 'arrastre' | 'vuelo' | 'auto' | 'dentro' | 'suelo'
      tipo: 0, color: 0, mano: -1, tiempo: 0, vida: 0, cubo: -1,
      desde: new THREE.Vector3(), hasta: new THREE.Vector3(), seleccionado: false,
    };
  });
  // Marca del objeto elegido con el ratón
  const marca = new THREE.Mesh(R(new THREE.TorusGeometry(0.085, 0.008, 6, 28).rotateX(Math.PI / 2)), R(new THREE.MeshBasicMaterial({ color: 0xff6a3d })));
  marca.visible = false;
  raiz.add(marca);

  // ─── Manos en VR ───────────────────────────────────────────────────────
  // Una pinza sencilla en cada mano: dos dedos que se cierran al apretar el gatillo
  const matPinza = R(new THREE.MeshLambertMaterial({ color: 0xffb300 }));
  const geoDedo = R(new THREE.BoxGeometry(0.014, 0.014, 0.06).translate(0, 0, -0.03));
  const geoPalma = R(new THREE.BoxGeometry(0.06, 0.03, 0.04));
  const manos = ctx.manos.map((mano) => {
    const pinza = new THREE.Group();
    const palma = new THREE.Mesh(geoPalma, matPinza);
    const dedos = [-1, 1].map((lado) => {
      const dedo = new THREE.Mesh(geoDedo, matPinza);
      dedo.position.set(lado * 0.022, 0, -0.02);
      pinza.add(dedo);
      return dedo;
    });
    pinza.add(palma);
    ctx.adjuntarAMano(mano, pinza);
    return {
      mano, dedos, punto: new THREE.Vector3(), objeto: null,
      posiciones: Array.from({ length: HISTORIAL }, () => new THREE.Vector3()), tiempos: new Float64Array(HISTORIAL).fill(-1), idx: 0,
    };
  });

  // ─── Marcador ──────────────────────────────────────────────────────────
  const panel = ctx.crearPanel({ ancho: 1.3, alto: 0.36 });
  panel.mesh.position.set(0, 1.63, -1.25);
  panel.mesh.rotation.x = 0.1;
  raiz.add(panel.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'juego' | 'fin'
  let reloj = 3;
  let tiempo = 0;
  let tiempoJuego = 0;
  let puntos = 0;
  let racha = 0;
  let vidas = VIDAS;
  let record = ctx.leer('record', 0);
  let regla = 'color'; // 'color' | 'tipo'
  let tiempoRegla = 0;
  let segundoAviso = 0;    // último segundo de la cuenta atrás que ha sonado
  let proximo = 0;
  let desplazamiento = 0;  // metros que ha avanzado la cinta (para la textura)
  let aviso = null;        // { texto, color, tiempo, grande }
  let elegido = null;      // objeto elegido con el ratón
  let arrastre = null;     // objeto que se arrastra con el ratón
  let arrastreDesde = 0;   // cuánto se ha movido el arrastre (para saber si fue un toque)
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const velMano = new THREE.Vector3();
  const planoArrastre = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(CINTA_Y + 0.12));
  const planoCubos = new THREE.Plane(new THREE.Vector3(0, 1, 0), -BORDE_CUBO);

  const velocidadCinta = () => Math.min(0.5, 0.22 + tiempoJuego * 0.0015);
  const intervalo = () => Math.max(0.9, 2.2 - tiempoJuego * 0.008);

  function avisar(texto, color, tiempoAviso = 1.4, grande = false) { aviso = { texto, color, tiempo: tiempoAviso, grande }; }

  function escribirMarcador() {
    const corazones = '♥'.repeat(vidas) + '♡'.repeat(VIDAS - vidas);
    let lineas;
    if (estado === 'intro') {
      lineas = [{ texto: ctx.t('titulo'), tam: 1.25, color: '#f9c80e' },
        { texto: ctx.t(ctx.enVR() ? 'introVR' : ctx.tactil ? 'introTactil' : 'introRaton'), tam: 0.62, color: '#e3f2fd' }];
    } else if (estado === 'fin') {
      lineas = [{ texto: ctx.t('fin', { n: puntos }), tam: 1.15, color: '#f9c80e' },
        { texto: ctx.t('partida.recordNuevaPartida', { record, n: Math.ceil(reloj) }), tam: 0.72 }];
    } else if (aviso && aviso.grande) {
      lineas = [{ texto: aviso.texto, tam: 1.3, color: aviso.color }, { texto: ctx.t(regla === 'color' ? 'reglaColor' : 'reglaTipo'), tam: 0.8, color: '#ffffff' }];
    } else if (segundoAviso > 0) {
      // Cuenta atrás antes del cambio de regla, con la regla que viene
      lineas = [{ texto: ctx.t('marcador', { n: puntos, vidas: corazones }), tam: 1.15, color: '#ffffff' },
        { texto: ctx.t(regla === 'color' ? 'proximaTipo' : 'proximaColor', { n: segundoAviso }), tam: 0.85, color: '#ff8a50' }];
    } else {
      lineas = [{ texto: ctx.t('marcador', { n: puntos, vidas: corazones }), tam: 1.15, color: '#ffffff' },
        aviso ? { texto: aviso.texto, tam: 0.75, color: aviso.color }
          : { texto: ctx.t(regla === 'color' ? 'reglaColor' : 'reglaTipo') + (racha >= 3 ? ` · ${ctx.t('racha', { n: racha })}` : ''), tam: 0.72, color: '#f9c80e' }];
    }
    panel.escribir(lineas);
  }

  // Lo que acepta cada cubo según la regla (y el icono de su cartel)
  function aplicarRegla() {
    // Por tipo, cada vez con los tipos repartidos de otra forma
    const orden = [0, 1, 2, 3];
    if (regla === 'tipo') {
      for (let i = orden.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [orden[i], orden[j]] = [orden[j], orden[i]];
      }
    }
    cubos.forEach((cubo, i) => {
      cubo.acepta = orden[i];
      cubo.tex.offset.set(cubo.acepta * 0.25, regla === 'color' ? 0.75 : 0.5);
    });
  }

  function cambiarRegla() {
    regla = regla === 'color' ? 'tipo' : 'color';
    tiempoRegla = 0;
    aplicarRegla();
    avisar(ctx.t('cambioRegla'), '#ff6a3d', 2.4, true);
    ctx.sonido('campana');
    ctx.destello(0xff6a3d, 0.2);
    for (const cubo of cubos) {
      cubo.brillo = 1;
      cubo.colorBrillo.setHex(0xff6a3d);
    }
  }

  // ─── Objetos ───────────────────────────────────────────────────────────
  function mostrar(o, estadoNuevo) {
    o.estado = estadoNuevo;
    o.malla.visible = true;
    o.sombra.visible = true;
    o.malla.scale.setScalar(1);
    o.malla.rotation.set(0, 0, 0);
    o.mano = -1;
    o.cubo = -1;
    o.seleccionado = false;
  }
  function retirar(o) {
    o.estado = 'libre';
    o.malla.visible = false;
    o.sombra.visible = false;
    o.seleccionado = false;
    if (elegido === o) elegido = null;
    if (arrastre === o) arrastre = null;
  }

  function soltarObjeto() {
    // Sin pisarse con el último que salió
    for (const o of objetos) if (o.estado === 'cinta' && o.pos.x < CINTA_INICIO + 0.24) return false;
    let o = null;
    for (const x of objetos) {
      if (x.estado === 'libre') {
        o = x;
        break;
      }
    }
    if (!o) return false;
    o.tipo = Math.floor(Math.random() * 4);
    o.color = Math.floor(Math.random() * 4);
    o.malla.geometry = geos[o.tipo][o.color];
    mostrar(o, 'cinta');
    o.pos.set(CINTA_INICIO, CINTA_Y, CINTA_Z + azar(-0.06, 0.06));
    o.malla.rotation.y = azar(-0.5, 0.5);
    return true;
  }

  const correcto = (o, cubo) => (regla === 'color' ? o.color : o.tipo) === cubo.acepta;

  // El objeto ha entrado en un cubo
  function clasificar(o, cubo) {
    o.estado = 'dentro';
    o.vida = 0.5;
    o.cubo = cubo.indice;
    o.sombra.visible = false;
    if (estado !== 'juego') return;
    if (correcto(o, cubo)) {
      puntos++;
      racha++;
      const f = Math.min(1, racha / 20);
      const nivel = racha % 10 === 0 ? 'grande' : racha >= 5 ? 'medio' : 'pequeño';
      tmp.copy(cubo.pos).setY(BORDE_CUBO + 0.05);
      ctx.efectos.impacto(nivel, { pos: tmp, mano: o.mano >= 0 ? ctx.manos[o.mano] : null, color: COLORES[cubo.indice], sonido: 'punto' });
      ctx.efectos.texto(tmp.setY(BORDE_CUBO + 0.22), '+1', { color: racha >= 10 ? '#f9c80e' : '#b9f6ca', tam: 0.8 + 0.8 * f });
      if (racha >= 5 && racha % 5 === 0) avisar(ctx.t('racha', { n: racha }), '#f9c80e', 1.2);
      cubo.brillo = 1;
      cubo.colorBrillo.setHex(0xb9f6ca);
      if (puntos > record && record > 0 && puntos === record + 1) avisar(ctx.t('partida.nuevoRecord'), '#f9c80e', 1.6);
    } else {
      cubo.brillo = 1.2;
      cubo.colorBrillo.setHex(0xff1744);
      fallo(ctx.t('cuboEquivocado'), o);
    }
  }

  function fallo(texto, o) {
    if (estado !== 'juego') return;
    vidas--;
    racha = 0;
    ctx.sonido('zumbador');
    ctx.destello(0xff1744, 0.3);
    for (const m of ctx.manos) ctx.vibrar(m, 0.6, 150);
    if (o) ctx.efectos.texto(tmp.copy(o.pos).setY(Math.max(o.pos.y, 0.3) + 0.15), '✕', { color: '#ff5252', tam: 1.3 });
    lucesVida[VIDAS - 1 - vidas].material.color.setHex(0xff1744);
    if (vidas <= 0) terminar();
    else avisar(texto, '#ff8a80', 1.6);
  }

  function terminar() {
    estado = 'fin';
    reloj = 6;
    ctx.puntuacion(puntos); // a la clasificación (juegos/marcadores.js): objetos bien clasificados
    if (puntos > record) {
      record = puntos;
      ctx.guardar('record', record);
    }
    ctx.sonido('fin');
    elegido = null;
    arrastre = null;
  }

  function empezar() {
    estado = 'juego';
    puntos = 0;
    racha = 0;
    vidas = VIDAS;
    tiempoJuego = 0;
    tiempoRegla = 0;
    regla = 'color';
    aplicarRegla();
    proximo = 0.5;
    aviso = null;
    for (const o of objetos) retirar(o);
    for (const m of manos) m.objeto = null;
    for (const luz of lucesVida) luz.material.color.setHex(0x66ff88);
  }

  // ¿En qué cubo cae un punto que está a la altura del borde? (-1 si en ninguno)
  function cuboEn(x, z, margen = 0) {
    for (const cubo of cubos) if (Math.hypot(x - cubo.pos.x, z - cubo.pos.z) < R_CUBO + margen) return cubo.indice;
    return -1;
  }

  // Ayuda a la puntería: si el lanzamiento va cerca de un cubo, lo corrige hacia su centro
  function ayudarLanzamiento(o) {
    const v = o.vel;
    const disc = v.y * v.y + 2 * GRAVEDAD * (o.pos.y - BORDE_CUBO);
    if (disc < 0) return;
    const t = (v.y + Math.sqrt(disc)) / GRAVEDAD;
    if (t < 0.05) return;
    const x = o.pos.x + v.x * t;
    const z = o.pos.z + v.z * t;
    let mejor = null;
    let distancia = 0.35;
    for (const cubo of cubos) {
      const d = Math.hypot(x - cubo.pos.x, z - cubo.pos.z);
      if (d < distancia) {
        mejor = cubo;
        distancia = d;
      }
    }
    if (!mejor) return;
    v.x += ((mejor.pos.x - x) / t) * 0.75;
    v.z += ((mejor.pos.z - z) / t) * 0.75;
  }

  // ─── VR ────────────────────────────────────────────────────────────────
  function actualizarVR(dt) {
    const real = performance.now() / 1000; // tiempo real: la micro-pausa de los efectos no cambia la velocidad
    manos.forEach((m, i) => {
      const cerrada = m.mano.gatillo;
      m.dedos[0].position.x = cerrada ? -0.011 : -0.022;
      m.dedos[1].position.x = cerrada ? 0.011 : 0.022;
      if (!m.mano.activa) {
        if (m.objeto) soltar(m);
        return;
      }
      m.mano.grip.localToWorld(m.punto.set(0, 0, -0.06));
      m.posiciones[m.idx].copy(m.punto);
      m.tiempos[m.idx] = real;
      m.idx = (m.idx + 1) % HISTORIAL;
      if (m.mano.gatilloPulsado && !m.objeto && estado === 'juego') {
        // Coge el objeto más cercano a la pinza
        let elegidoVR = null;
        let distancia = R_COGER;
        for (const o of objetos) {
          if (o.estado !== 'cinta' && o.estado !== 'vuelo') continue;
          const d = tmp.copy(o.pos).setY(o.pos.y + 0.06).distanceTo(m.punto);
          if (d < distancia) {
            elegidoVR = o;
            distancia = d;
          }
        }
        if (elegidoVR) {
          elegidoVR.estado = 'mano';
          elegidoVR.mano = i;
          m.objeto = elegidoVR;
          ctx.vibrar(m.mano, 0.3, 30);
          ctx.sonido('tic');
        }
      }
      if (m.objeto && !cerrada) soltar(m);
      if (m.objeto) m.objeto.pos.copy(m.punto).setY(m.punto.y - 0.06);
    });
  }

  function soltar(m) {
    const o = m.objeto;
    m.objeto = null;
    if (!o || o.estado !== 'mano') return;
    // Velocidad de la mano en los últimos ~70 ms
    const n = HISTORIAL;
    const actual = (m.idx - 1 + n) % n;
    let j = actual;
    for (let i = 1; i < n; i++) {
      const k = (actual - i + n) % n;
      if (m.tiempos[k] < 0) break;
      j = k;
      if (m.tiempos[actual] - m.tiempos[k] >= 0.07) break;
    }
    const dtv = m.tiempos[actual] - m.tiempos[j];
    if (dtv > 0) velMano.subVectors(m.posiciones[actual], m.posiciones[j]).divideScalar(dtv);
    else velMano.set(0, 0, 0);
    if (velMano.length() > 7) velMano.setLength(7);
    o.estado = 'vuelo';
    o.vel.copy(velMano);
    o.giro.set(azar(-6, 6), azar(-6, 6), azar(-6, 6)).multiplyScalar(Math.min(1, velMano.length()));
    if (velMano.length() > 0.6) ayudarLanzamiento(o);
  }

  // ─── Ratón y móvil ─────────────────────────────────────────────────────
  // ¿Qué objeto está bajo el puntero?
  function objetoBajoPuntero() {
    const rayo = ctx.raton.rayo.ray;
    let mejor = null;
    let distancia = Infinity;
    for (const o of objetos) {
      if (o.estado !== 'cinta') continue;
      tmp.copy(o.pos).setY(o.pos.y + 0.06);
      const profundidad = tmp2.subVectors(tmp, rayo.origin).dot(rayo.direction);
      if (profundidad <= 0) continue;
      const d = rayo.distanceToPoint(tmp);
      if (d < 0.05 + 0.025 * profundidad && d < distancia) {
        mejor = o;
        distancia = d;
      }
    }
    return mejor;
  }
  // ¿Qué cubo está bajo el puntero? (la boca o el cuerpo)
  function cuboBajoPuntero() {
    const rayo = ctx.raton.rayo.ray;
    if (rayo.intersectPlane(planoCubos, tmp)) {
      const i = cuboEn(tmp.x, tmp.z, 0.06);
      if (i >= 0) return i;
    }
    for (const cubo of cubos) {
      // Distancia del rayo al eje del cubo, a media altura
      tmp2.copy(cubo.pos).setY(BORDE_CUBO * 0.5);
      if (rayo.distanceToPoint(tmp2) < R_CUBO + 0.02) return cubo.indice;
    }
    return -1;
  }

  // Vuela solo hasta el cubo (en un arco corto)
  function enviarACubo(o, i) {
    o.estado = 'auto';
    o.desde.copy(o.pos);
    o.hasta.copy(cubos[i].pos).setY(BORDE_CUBO + 0.02);
    o.cubo = i;
    o.tiempo = 0;
    o.giro.set(azar(-4, 4), azar(-4, 4), azar(-4, 4));
    o.seleccionado = false;
    if (elegido === o) elegido = null;
    ctx.sonido('zas');
  }

  function actualizarRaton() {
    const r = ctx.raton;
    if (estado !== 'juego') return;
    if (arrastre) {
      if (r.pulsado) {
        if (r.rayo.ray.intersectPlane(planoArrastre, tmp)) {
          arrastreDesde += tmp.distanceTo(arrastre.pos);
          arrastre.pos.copy(tmp).setY(tmp.y - 0.06);
        }
        return;
      }
      // Al soltar: en un cubo, va al cubo; si apenas se ha movido, queda elegido; si no, vuelve a la cinta
      const o = arrastre;
      arrastre = null;
      const i = cuboBajoPuntero();
      if (i >= 0 && arrastreDesde > 0.03) {
        enviarACubo(o, i);
        return;
      }
      o.estado = 'cinta';
      o.pos.y = CINTA_Y;
      o.pos.z = limitar(o.pos.z, CINTA_Z - CINTA_ANCHO / 2 + 0.06, CINTA_Z + CINTA_ANCHO / 2 - 0.06);
      o.pos.x = limitar(o.pos.x, CINTA_INICIO, CINTA_FIN - 0.05);
      if (arrastreDesde <= 0.03) {
        if (elegido) elegido.seleccionado = false;
        elegido = o;
        o.seleccionado = true;
      }
      return;
    }
    if (!r.clic) return;
    const o = objetoBajoPuntero();
    if (o) {
      arrastre = o;
      arrastreDesde = 0;
      o.estado = 'arrastre';
      ctx.sonido('tic');
      return;
    }
    const i = cuboBajoPuntero();
    if (i >= 0 && elegido && elegido.estado === 'cinta') {
      enviarACubo(elegido, i);
      return;
    }
    if (elegido) elegido.seleccionado = false;
    elegido = null;
  }

  // ─── Movimiento de los objetos ─────────────────────────────────────────
  function moverObjetos(dt) {
    const v = velocidadCinta();
    for (const o of objetos) {
      if (o.estado === 'libre') continue;
      if (o.estado === 'cinta') {
        o.pos.x += v * dt;
        if (o.pos.x > CINTA_FIN) {
          // Se cae al cajón de rechazo
          o.estado = 'vuelo';
          o.vel.set(v, 0.2, 0);
          o.giro.set(0, 0, -5);
          if (estado === 'juego') {
            avisoFinTiempo = 1.2;
            fallo(ctx.t('escapado'), o);
          }
          o.cubo = -2; // ya contado
        }
      } else if (o.estado === 'vuelo') {
        o.vel.y -= GRAVEDAD * dt;
        const antesY = o.pos.y;
        o.pos.addScaledVector(o.vel, dt);
        o.malla.rotation.x += o.giro.x * dt;
        o.malla.rotation.y += o.giro.y * dt;
        o.malla.rotation.z += o.giro.z * dt;
        // ¿Ha entrado por la boca de un cubo?
        if (antesY >= BORDE_CUBO && o.pos.y < BORDE_CUBO && o.cubo !== -2) {
          const i = cuboEn(o.pos.x, o.pos.z);
          if (i >= 0) {
            clasificar(o, cubos[i]);
            continue;
          }
        }
        // ¿Ha caído de nuevo en la cinta?
        if (antesY >= CINTA_Y && o.pos.y < CINTA_Y && Math.abs(o.pos.z - CINTA_Z) < CINTA_ANCHO / 2 && o.pos.x > CINTA_INICIO && o.pos.x < CINTA_FIN && o.cubo !== -2) {
          o.estado = 'cinta';
          o.pos.y = CINTA_Y;
          o.malla.rotation.set(0, o.malla.rotation.y, 0);
          ctx.sonido('toc');
          continue;
        }
        if (o.pos.y <= 0) {
          o.pos.y = 0;
          o.estado = 'suelo';
          o.vida = 0.8;
          ctx.sonido('golpe');
          if (o.cubo !== -2) fallo(ctx.t('caido'), o);
        }
      } else if (o.estado === 'auto') {
        o.tiempo += dt;
        const s = Math.min(1, o.tiempo / 0.42);
        o.pos.lerpVectors(o.desde, o.hasta, s);
        o.pos.y += Math.sin(s * Math.PI) * 0.22;
        o.malla.rotation.x += o.giro.x * dt;
        o.malla.rotation.z += o.giro.z * dt;
        if (s >= 1) clasificar(o, cubos[o.cubo]);
      } else if (o.estado === 'dentro') {
        // Cae hasta el fondo del cubo y desaparece
        o.pos.y -= 1.6 * dt;
        o.vida -= dt;
        if (o.vida <= 0) retirar(o);
      } else if (o.estado === 'suelo') {
        o.vida -= dt;
        o.malla.scale.setScalar(Math.max(0.01, Math.min(1, o.vida / 0.3)));
        if (o.vida <= 0) retirar(o);
      }
      if (o.estado === 'libre' || o.estado === 'dentro') continue;
      // La sombra, sobre la cinta o sobre el suelo
      const sobreCinta = Math.abs(o.pos.z - CINTA_Z) < CINTA_ANCHO / 2 && o.pos.x > CINTA_INICIO - 0.2 && o.pos.x < CINTA_FIN && o.pos.y >= CINTA_Y - 0.01;
      ctx.colocarSombra(o.sombra, o.pos, sobreCinta ? CINTA_Y + 0.002 : 0.004);
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
      tiempoRegla += dt;
      // Cuenta atrás: un tic por segundo y los marcos de los carteles parpadeando
      const queda = DURACION_REGLA - tiempoRegla;
      const segundo = queda <= AVISO_PREVIO ? Math.ceil(queda) : 0;
      if (segundo !== segundoAviso && segundo > 0) ctx.sonido('tic');
      segundoAviso = segundo;
      if (tiempoRegla >= DURACION_REGLA) cambiarRegla();
      proximo -= dt;
      if (proximo <= 0 && soltarObjeto()) proximo = intervalo() * azar(0.8, 1.2);
    } else {
      segundoAviso = 0;
    }
    if (aviso && (aviso.tiempo -= dt) <= 0) aviso = null;

    // La cinta y los rodillos avanzan (solo se desplazan las texturas)
    const v = estado === 'juego' ? velocidadCinta() : 0.08;
    desplazamiento += v * dt;
    texBanda.offset.x = -(desplazamiento / TAM_TACOS) % 1;
    texRodillo.offset.x = -(desplazamiento / (Math.PI * 2 * 0.035)) % 1;

    if (ctx.enVR()) {
      marca.visible = false;
      actualizarVR(dt);
    } else {
      colocarVista();
      actualizarRaton();
    }
    moverObjetos(dt);

    // Marca del objeto elegido
    marca.visible = !!elegido && elegido.estado === 'cinta';
    if (marca.visible) marca.position.copy(elegido.pos).setY(CINTA_Y + 0.01);
    // Brillo de los cubos y luz del final de la cinta
    for (const cubo of cubos) {
      cubo.brillo = Math.max(0, cubo.brillo - dt * 1.6);
      cubo.matAro.color.setHex(0xffffff).lerp(cubo.colorBrillo, Math.min(1, cubo.brillo));
      cubo.grupo.scale.setScalar(1 + Math.min(1, cubo.brillo) * 0.06);
    }
    const parpadeo = segundoAviso > 0 && Math.floor(tiempo * 4) % 2 === 0;
    matMarcos.color.setHex(parpadeo ? 0xff8a50 : 0xffffff);
    avisoFinTiempo = Math.max(0, avisoFinTiempo - dt);
    avisoFin.material.color.setHex(avisoFinTiempo > 0 && Math.floor(tiempo * 8) % 2 ? 0xff1744 : 0x553322);
    escribirMarcador();
  }

  aplicarRegla();
  escribirMarcador();

  return {
    actualizar,
    liberar() {
      // La shell retira lo que hay en la escena y en las manos y los recursos registrados.
      objetos.length = 0;
    },
  };
}
