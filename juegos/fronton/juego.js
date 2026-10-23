// FRONTÓN DE PING PONG
// Media mesa de ping pong delante de una pared de LED en un pabellón de noche. Golpea la
// bola contra la pared: cada golpe que da dentro de la zona marcada vale 1 punto y la pared
// te la devuelve, cada vez más rápida, más abierta y, en los niveles altos, con efecto.
// De vez en cuando aparece una diana en la pared durante unos segundos: darle vale +5.
// Pierdes si la bola sale de la zona, si no llega a la pared, si bota dos veces en tu lado
// o si se te escapa. Sin final fijo: la partida es tan larga como aguantes.
// En VR la pala va en la mano derecha (el gatillo de la otra mano la cambia de mano);
// sin gafas, la pala sigue al ratón o al dedo y golpea sola cuando llega la bola.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código.
export async function precargar() {}

const G = 9.8;
const MESA_Y = 0.76;
const ANCHO = 1.525;
const Z_CERCA = -0.35;                 // borde de tu lado de la mesa
const Z_PARED = Z_CERCA - 1.37;        // la pared está donde estaría la red… al fondo de media mesa
const ALTO_ZONA = 1.15;                // altura de la zona buena de la pared, sobre la mesa
const R_BOLA = 0.022;
const REBOTE_MESA = 0.88;
const REBOTE_PALA = 0.65;
const FUERZA_PALA = 0.7;               // parte de la velocidad de la pala que pasa a la bola
const R_PALA = 0.08;
const GROSOR_PALA = 0.012;
const AYUDA = 0.6;                     // cuánto se corrige un golpe VR hacia la zona de la pared
const Z_PALA_RATON = Z_CERCA + 0.2;    // plano en el que se mueve la pala con ratón
const R_CONTACTO_RATON = 0.15;
const GOLPES_NIVEL = 10;               // cada 10 golpes, un nivel más
const N_ESTELA = 12;
const N_ONDAS = 4;
const N_PUNTOS_DIANA = 16;             // el reloj de la diana: puntos que se apagan
// Colores de la pared en cada nivel (luego vuelven a empezar)
const COLORES_NIVEL = [0x2ee6d6, 0x6dff7a, 0xffd23f, 0xff7a2e, 0xff3dd0, 0x9b6bff];

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (r) => ctx.recurso(r);

  ctx.fondo(0x0b0d1c, { cenit: 0x05060e, horizonte: 0x141832, suelo: 0x07080f, niebla: [10, 26] });
  ctx.sueloBase(false);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.48, 0.8), new THREE.Vector3(0, 1.15, -1.9));

  const matrizTmp = new THREE.Matrix4();
  const eulerTmp = new THREE.Euler();
  const colorTmp = new THREE.Color();
  const negro = new THREE.Color(0x000000);
  const blanco = new THREE.Color(0xffffff);
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
  // Luz que se suma (neones, ondas, estela): con el color de instancia en negro no se ve
  const luzSumada = (opciones = {}) => R(new THREE.MeshBasicMaterial({
    transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, ...opciones,
  }));
  const texBrillo = R(ctx.texturaCanvas((g, tam) => {
    const grad = g.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.4)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, tam, tam);
  }, { tam: 128 }));

  // ─── Pabellón de noche ─────────────────────────────────────────────────
  const suelo = new THREE.Mesh(
    R(new THREE.PlaneGeometry(16, 16)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tablas(0x3a2a22, { tablas: 24, repetir: [3, 3], semilla: 191 })) })),
  );
  suelo.rotation.x = -Math.PI / 2;
  suelo.position.z = -2;
  raiz.add(suelo);
  // Moqueta azul de la zona de juego, con su línea de neón
  const moqueta = new THREE.Mesh(R(new THREE.PlaneGeometry(3.4, 3.6)), R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.grano(0x1c2a5a, { tam: 256, repetir: [3, 3], semilla: 192 })) })));
  moqueta.rotation.x = -Math.PI / 2;
  moqueta.position.set(0, 0.004, -1.0);
  raiz.add(moqueta);
  // Paredes del pabellón con paneles y gradas al fondo y a los lados
  const piezasSala = [];
  piezasSala.push(colocar(new THREE.BoxGeometry(16, 6, 0.2), 0, 3, -9));
  piezasSala.push(colocar(new THREE.BoxGeometry(0.2, 6, 16), -8, 3, -2));
  piezasSala.push(colocar(new THREE.BoxGeometry(0.2, 6, 16), 8, 3, -2));
  for (let k = 0; k < 4; k++) {
    piezasSala.push(colocar(new THREE.BoxGeometry(12, 0.45, 0.8), 0, 0.225 + k * 0.45, -5.2 - k * 0.8));
    piezasSala.push(colocar(new THREE.BoxGeometry(0.8, 0.45, 7), -4.4 - k * 0.8, 0.225 + k * 0.45, -1.5));
    piezasSala.push(colocar(new THREE.BoxGeometry(0.8, 0.45, 7), 4.4 + k * 0.8, 0.225 + k * 0.45, -1.5));
  }
  raiz.add(new THREE.Mesh(fusionar(piezasSala), R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.grano(0x22263a, { tam: 256, repetir: [8, 4], semilla: 193 })) }))));
  // Asientos de colores en las gradas (una malla con colores por pieza)
  const asientos = [];
  const coloresAsientos = [];
  const tonosAsientos = [0x2ee6d6, 0xff3dd0, 0xffd23f, 0x3d8bff];
  for (let k = 0; k < 4; k++) {
    for (let i = 0; i < 20; i++) {
      asientos.push(colocar(new THREE.BoxGeometry(0.34, 0.12, 0.3), -5.4 + i * 0.57, 0.5 + k * 0.45, -5.1 - k * 0.8));
      coloresAsientos.push(tonosAsientos[(i + k) % 4]);
    }
    for (let i = 0; i < 10; i++) {
      for (const lado of [-1, 1]) {
        asientos.push(colocar(new THREE.BoxGeometry(0.3, 0.12, 0.34), lado * (4.3 + k * 0.8), 0.5 + k * 0.45, -4.5 + i * 0.62));
        coloresAsientos.push(tonosAsientos[(i + k + 1) % 4]);
      }
    }
  }
  raiz.add(new THREE.Mesh(fusionar(asientos, coloresAsientos), R(new THREE.MeshLambertMaterial({ vertexColors: true }))));
  // Pantallas de LED corridas delante de las gradas: la textura avanza (luces en movimiento)
  const texLed = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#05060e';
    g.fillRect(0, 0, tam, tam);
    const colores = ['#2ee6d6', '#ff3dd0', '#ffd23f', '#3d8bff'];
    for (let i = 0; i < 16; i++) {
      g.fillStyle = colores[i % 4];
      g.globalAlpha = 0.85;
      g.beginPath();
      g.moveTo(i * tam / 16, tam);
      g.lineTo(i * tam / 16 + tam / 32, 0);
      g.lineTo(i * tam / 16 + tam / 16, 0);
      g.lineTo(i * tam / 16 + tam / 32, tam);
      g.fill();
    }
    g.globalAlpha = 1;
  }, { tam: 256, repetir: [6, 1] }));
  const led = new THREE.Mesh(fusionar([
    colocar(new THREE.PlaneGeometry(12, 0.35), 0, 0.5, -4.79),
    colocar(new THREE.PlaneGeometry(7, 0.35), -3.99, 0.5, -1.5, 0, Math.PI / 2, 0),
    colocar(new THREE.PlaneGeometry(7, 0.35), 3.99, 0.5, -1.5, 0, -Math.PI / 2, 0),
  ]), R(new THREE.MeshBasicMaterial({ map: texLed, toneMapped: false })));
  raiz.add(led);
  // Focos del techo (solo la lente encendida) y tiras de luz en las paredes
  const N_FOCOS = 8;
  const focos = new THREE.InstancedMesh(R(new THREE.CylinderGeometry(0.22, 0.28, 0.12, 16)), R(new THREE.MeshBasicMaterial({ color: 0xfff4e0, toneMapped: false })), N_FOCOS);
  for (let i = 0; i < N_FOCOS; i++) {
    matrizTmp.makeTranslation(-3 + (i % 4) * 2, 5.4, -1 - Math.floor(i / 4) * 3.5);
    focos.setMatrixAt(i, matrizTmp);
  }
  raiz.add(focos);
  const tiras = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(16, 0.05, 0.05), 0, 3.2, -8.85),
    colocar(new THREE.BoxGeometry(0.05, 0.05, 16), -7.85, 3.2, -2),
    colocar(new THREE.BoxGeometry(0.05, 0.05, 16), 7.85, 3.2, -2),
  ]), R(new THREE.MeshBasicMaterial({ color: 0x7a5cff, toneMapped: false })));
  raiz.add(tiras);
  // Cono de luz suave bajo cada foco central (planos que se suman, sin luces reales)
  const conos = new THREE.InstancedMesh(R(new THREE.ConeGeometry(1.1, 4.6, 20, 1, true)), luzSumada({ side: THREE.DoubleSide, opacity: 0.6 }), 2);
  for (let i = 0; i < 2; i++) {
    matrizTmp.makeTranslation(-1 + i * 2, 3.1, -1);
    conos.setMatrixAt(i, matrizTmp);
    conos.setColorAt(i, colorTmp.set(0x0c0f1c));
  }
  raiz.add(conos);

  // ─── Mesa (media) ──────────────────────────────────────────────────────
  const largoMesa = Z_CERCA - Z_PARED;
  const texMesa = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#123a7a';
    g.fillRect(0, 0, tam, tam);
    g.fillStyle = 'rgba(255,255,255,0.05)';
    for (let i = 0; i < 400; i++) g.fillRect((i * 37) % tam, (i * 53) % tam, 2, 2);
    g.fillStyle = '#f2f4f8';
    const borde = tam * 0.02;
    g.fillRect(0, 0, tam, borde);
    g.fillRect(0, tam - borde, tam, borde);
    g.fillRect(0, 0, borde, tam);
    g.fillRect(tam - borde, 0, borde, tam);
    g.fillRect(tam / 2 - borde / 4, 0, borde / 2, tam);
  }, { tam: 256 }));
  const mesa = new THREE.Mesh(R(new THREE.BoxGeometry(ANCHO, 0.03, largoMesa)), R(new THREE.MeshStandardMaterial({ map: texMesa, roughness: 0.45, metalness: 0 })));
  mesa.position.set(0, MESA_Y - 0.015, (Z_CERCA + Z_PARED) / 2);
  raiz.add(mesa);
  const patas = [];
  for (const x of [-ANCHO / 2 + 0.12, ANCHO / 2 - 0.12]) {
    for (const z of [Z_CERCA - 0.15, Z_PARED + 0.15]) patas.push(colocar(new THREE.BoxGeometry(0.05, MESA_Y - 0.03, 0.05), x, (MESA_Y - 0.03) / 2, z));
  }
  patas.push(colocar(new THREE.BoxGeometry(ANCHO - 0.2, 0.04, 0.04), 0, 0.3, (Z_CERCA + Z_PARED) / 2));
  raiz.add(new THREE.Mesh(fusionar(patas), R(new THREE.MeshLambertMaterial({ color: 0x1a1c24 }))));
  // Borde de neón de la mesa (de tu lado)
  const neonMesa = new THREE.Mesh(R(new THREE.BoxGeometry(ANCHO + 0.01, 0.008, 0.008)), R(new THREE.MeshBasicMaterial({ color: 0xff6a3d, toneMapped: false })));
  neonMesa.position.set(0, MESA_Y - 0.03, Z_CERCA + 0.005);
  raiz.add(neonMesa);
  const sombraMesa = ctx.crearSombra({ radio: 1.0, opacidad: 0.5 });
  sombraMesa.position.set(0, 0.01, (Z_CERCA + Z_PARED) / 2);
  sombraMesa.scale.set(0.9, 1, 0.8);
  raiz.add(sombraMesa);

  // ─── Pared de LED ──────────────────────────────────────────────────────
  // Cuadrícula fina de LED que se ilumina con el color del nivel
  const texPared = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#0a0c18';
    g.fillRect(0, 0, tam, tam);
    g.fillStyle = '#ffffff';
    const paso = tam / 16;
    for (let y = 0; y < 16; y++) {
      for (let x = 0; x < 16; x++) {
        g.globalAlpha = 0.12 + ((x * 7 + y * 3) % 5) * 0.03;
        g.fillRect(x * paso + paso * 0.3, y * paso + paso * 0.3, paso * 0.4, paso * 0.4);
      }
    }
    g.globalAlpha = 1;
  }, { tam: 256, repetir: [5, 4] }));
  const ANCHO_PARED = 2.6;
  const ALTO_PARED = 2.3;
  const matPared = R(new THREE.MeshLambertMaterial({ color: 0x1a1d30, emissive: 0xffffff, emissiveMap: texPared, emissiveIntensity: 0.5 }));
  const pared = new THREE.Mesh(R(new THREE.BoxGeometry(ANCHO_PARED, ALTO_PARED, 0.08)), matPared);
  pared.position.set(0, MESA_Y - 0.05 + ALTO_PARED / 2, Z_PARED - 0.04);
  raiz.add(pared);
  const pieza = (w, h, d, x, y, z) => colocar(new THREE.BoxGeometry(w, h, d), x, y, z);
  raiz.add(new THREE.Mesh(fusionar([
    pieza(0.1, MESA_Y + ALTO_PARED, 0.14, -ANCHO_PARED / 2 - 0.05, (MESA_Y + ALTO_PARED) / 2, Z_PARED - 0.04),
    pieza(0.1, MESA_Y + ALTO_PARED, 0.14, ANCHO_PARED / 2 + 0.05, (MESA_Y + ALTO_PARED) / 2, Z_PARED - 0.04),
    pieza(0.12, 0.05, 0.6, -ANCHO_PARED / 2 - 0.05, 0.025, Z_PARED - 0.1),
    pieza(0.12, 0.05, 0.6, ANCHO_PARED / 2 + 0.05, 0.025, Z_PARED - 0.1),
  ]), R(new THREE.MeshStandardMaterial({ color: 0x3a3f52, roughness: 0.3, metalness: 0.9 }))));
  // Marco de neón de la zona buena: lo que cuenta es dar dentro
  const zonaY0 = MESA_Y;
  const zonaY1 = MESA_Y + ALTO_ZONA;
  const zonaX = ANCHO / 2;
  const grosorMarco = 0.016;
  const marco = new THREE.Mesh(fusionar([
    pieza(ANCHO + grosorMarco, grosorMarco, 0.01, 0, zonaY1, Z_PARED + 0.006),
    pieza(grosorMarco, ALTO_ZONA, 0.01, -zonaX, MESA_Y + ALTO_ZONA / 2, Z_PARED + 0.006),
    pieza(grosorMarco, ALTO_ZONA, 0.01, zonaX, MESA_Y + ALTO_ZONA / 2, Z_PARED + 0.006),
    pieza(ANCHO + grosorMarco, grosorMarco, 0.01, 0, zonaY0 + 0.004, Z_PARED + 0.006),
  ]), R(new THREE.MeshBasicMaterial({ color: COLORES_NIVEL[0], toneMapped: false })));
  raiz.add(marco);
  // Resplandor del marco sobre la pared (un plano que se suma)
  const resplandor = new THREE.Mesh(R(new THREE.PlaneGeometry(ANCHO + 0.5, ALTO_ZONA + 0.5)), luzSumada({ map: texBrillo, opacity: 0.35 }));
  resplandor.position.set(0, MESA_Y + ALTO_ZONA / 2, Z_PARED + 0.003);
  raiz.add(resplandor);
  // Ondas de luz donde da la bola en la pared
  const geoOnda = R(new THREE.RingGeometry(0.85, 1, 40));
  const ondas = new THREE.InstancedMesh(geoOnda, luzSumada(), N_ONDAS);
  const estadoOndas = Array.from({ length: N_ONDAS }, () => ({ vida: 0, x: 0, y: 0, color: new THREE.Color(), grande: 1 }));
  let siguienteOnda = 0;
  for (let i = 0; i < N_ONDAS; i++) {
    ondas.setMatrixAt(i, matrizTmp.makeScale(0.001, 0.001, 1));
    ondas.setColorAt(i, negro);
  }
  ondas.frustumCulled = false; // crecen después de crearse
  raiz.add(ondas);

  // ─── Diana temporal ────────────────────────────────────────────────────
  const diana = new THREE.Group();
  diana.visible = false;
  const texDiana = R(ctx.texturaCanvas((g, tam) => {
    const c = tam / 2;
    const anillos = ['#ff3d6e', '#ffffff', '#ff3d6e', '#ffffff', '#ffd23f'];
    anillos.forEach((color, i) => {
      g.fillStyle = color;
      g.beginPath();
      g.arc(c, c, c * (1 - i * 0.19), 0, Math.PI * 2);
      g.fill();
    });
  }, { tam: 128 }));
  const caraDiana = new THREE.Mesh(R(new THREE.CircleGeometry(1, 40)), R(new THREE.MeshBasicMaterial({ map: texDiana, transparent: true, toneMapped: false })));
  const haloDiana = new THREE.Mesh(R(new THREE.PlaneGeometry(3.2, 3.2)), luzSumada({ map: texBrillo, color: 0xff3d6e, opacity: 0.7 }));
  haloDiana.position.z = -0.002;
  // El reloj: puntos alrededor que se van apagando
  const puntosDiana = new THREE.InstancedMesh(R(new THREE.CircleGeometry(0.07, 10)), R(new THREE.MeshBasicMaterial({ color: 0xffd23f, toneMapped: false })), N_PUNTOS_DIANA);
  for (let i = 0; i < N_PUNTOS_DIANA; i++) {
    const a = Math.PI / 2 - (i / N_PUNTOS_DIANA) * Math.PI * 2;
    puntosDiana.setMatrixAt(i, matrizTmp.makeTranslation(Math.cos(a) * 1.28, Math.sin(a) * 1.28, 0.001));
  }
  diana.add(haloDiana, caraDiana, puntosDiana);
  diana.position.z = Z_PARED + 0.008;
  raiz.add(diana);

  // ─── Bola y su estela ──────────────────────────────────────────────────
  const bola = new THREE.Mesh(R(new THREE.SphereGeometry(R_BOLA, 16, 12)), R(new THREE.MeshStandardMaterial({ color: 0xffffff, emissive: 0xff8f3d, emissiveIntensity: 0.35, roughness: 0.35 })));
  bola.name = 'bola';
  raiz.add(bola);
  const sombraBola = ctx.crearSombra({ radio: 0.035, opacidad: 0.6 });
  raiz.add(sombraBola);
  const estela = new THREE.InstancedMesh(R(new THREE.SphereGeometry(R_BOLA, 8, 6)), luzSumada(), N_ESTELA);
  estela.frustumCulled = false;
  const historia = Array.from({ length: N_ESTELA }, () => new THREE.Vector3());
  for (let i = 0; i < N_ESTELA; i++) estela.setColorAt(i, negro);
  raiz.add(estela);
  const vel = new THREE.Vector3();

  // ─── Palas ─────────────────────────────────────────────────────────────
  // Mango en el puño y la hoja hacia delante (-Z); las caras miran a los lados (±X)
  const perfilMango = [[0.0001, 0], [0.014, 0.004], [0.016, 0.03], [0.014, 0.07], [0.018, 0.095], [0.0001, 0.1]].map(([r, y]) => new THREE.Vector2(r, y));
  const geoMango = R(new THREE.LatheGeometry(perfilMango, 12));
  geoMango.rotateX(-Math.PI / 2);
  geoMango.translate(0, 0, 0.03);
  geoMango.scale(1, 1.25, 1);
  const geoGoma = R(new THREE.CylinderGeometry(R_PALA, R_PALA, GROSOR_PALA * 0.3, 32));
  geoGoma.rotateZ(Math.PI / 2);
  const geoMadera = R(new THREE.CylinderGeometry(R_PALA - 0.002, R_PALA - 0.002, GROSOR_PALA * 0.5, 32));
  geoMadera.rotateZ(Math.PI / 2);
  const geoCanto = R(new THREE.TorusGeometry(R_PALA, 0.0025, 6, 32));
  geoCanto.rotateY(Math.PI / 2);
  const matMango = R(new THREE.MeshStandardMaterial({ map: R(ctx.texturas.madera(0xd7a86e, { tam: 128, semilla: 194 })), roughness: 0.55 }));
  const matGomaRoja = R(new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.8 }));
  const matGomaNegra = R(new THREE.MeshLambertMaterial({ color: 0x1b1b1b }));
  const matCanto = R(new THREE.MeshBasicMaterial({ color: 0xff6a3d, toneMapped: false }));
  const CENTRO_HOJA = new THREE.Vector3(0, 0.01, -0.13);

  function crearPala() {
    const pala = new THREE.Group();
    const madera = new THREE.Mesh(geoMadera, matMango);
    const roja = new THREE.Mesh(geoGoma, matGomaRoja);
    roja.position.x = GROSOR_PALA * 0.4;
    const negra = new THREE.Mesh(geoGoma, matGomaNegra);
    negra.position.x = -GROSOR_PALA * 0.4;
    const canto = new THREE.Mesh(geoCanto, matCanto);
    for (const m of [madera, roja, negra, canto]) m.position.add(CENTRO_HOJA);
    const mango = new THREE.Mesh(geoMango, matMango);
    pala.add(madera, roja, negra, canto, mango);
    return pala;
  }

  // VR: una pala en cada mando, pero solo se ve (y golpea) la de la mano que juega
  const palasVR = ctx.manos.map((mano) => ({
    mano,
    objeto: ctx.adjuntarAMano(mano, crearPala()),
    centro: new THREE.Vector3(),
    centroAntes: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    normalAntes: new THREE.Vector3(),
    lista: false,
  }));
  let indicePala = null;

  // Ratón / dedo: la pala se mueve en un plano vertical delante de la mesa
  const palaRaton = crearPala();
  palaRaton.rotation.set(0, Math.PI / 2, 0); // cara hacia la pared
  const pivoteRaton = new THREE.Group();
  pivoteRaton.add(palaRaton);
  palaRaton.position.set(-CENTRO_HOJA.z, -CENTRO_HOJA.y, 0); // el centro de la hoja en el pivote
  pivoteRaton.position.set(0.2, MESA_Y + 0.2, Z_PALA_RATON);
  raiz.add(pivoteRaton);
  const planoRaton = new THREE.Plane(new THREE.Vector3(0, 0, 1), -Z_PALA_RATON);
  const velRaton = new THREE.Vector3();

  // ─── Marcador en lo alto de la pared ───────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.3, alto: 0.36 });
  marcador.mesh.position.set(0, MESA_Y + ALTO_ZONA + 0.24, Z_PARED + 0.02);
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  // 'saque': la bola espera flotando a que la golpees · 'ida': va hacia la pared ·
  // 'vuelta': vuelve hacia ti · 'fin': has perdido (nueva partida en unos segundos)
  let estado = 'saque';
  let reloj = 0;
  let puntos = 0;
  let golpes = 0;
  let dianas = 0;
  let botes = 0;
  let enfriamiento = 0;
  let curva = 0;            // efecto lateral de la bola en la vuelta (m/s²)
  let record = ctx.leer('record', 0);
  let nuevoRecord = false;
  let primeraVez = true;
  let mensaje = '';
  let colorMensaje = '#ffffff';
  let tiempoMensaje = 0;
  let tiempo = 0;
  let destelloPared = 0;
  let pulsoMarco = 0;
  // Diana
  let esperaDiana = 9;
  let vidaDiana = 0;
  let duracionDiana = 7;
  let radioDiana = 0.14;
  let aparicionDiana = 0;
  const colorNivel = new THREE.Color(COLORES_NIVEL[0]);
  const colorObjetivo = new THREE.Color(COLORES_NIVEL[0]);

  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const relativa = new THREE.Vector3();
  const velPala = new THREE.Vector3();
  const anterior = new THREE.Vector3();
  const destino = new THREE.Vector3();
  const salida = new THREE.Vector3();

  const nivel = () => 1 + Math.floor(golpes / GOLPES_NIVEL);
  const sobreMesa = (p) => Math.abs(p.x) <= ANCHO / 2 + R_BOLA * 0.5 && p.z <= Z_CERCA + R_BOLA * 0.5 && p.z >= Z_PARED;

  // ─── Trayectorias ──────────────────────────────────────────────────────
  // Velocidad (en «salida») para ir de «p» a «d» con esa rapidez horizontal
  function trayectoria(p, d, rapidez) {
    const dx = d.x - p.x;
    const dz = d.z - p.z;
    const t = Math.max(0.12, Math.hypot(dx, dz) / rapidez);
    return salida.set(dx / t, (d.y - p.y) / t + 0.5 * G * t, dz / t);
  }

  // Corrige un poco un golpe VR que va hacia la pared para que dé dentro de la zona
  function ayudar(p, v) {
    if (v.z > -0.6) return;
    const t = (Z_PARED + R_BOLA - p.z) / v.z;
    destino.set(p.x + v.x * t, p.y + v.y * t - 0.5 * G * t * t, Z_PARED + R_BOLA);
    destino.x = THREE.MathUtils.clamp(destino.x, -zonaX + 0.1, zonaX - 0.1);
    destino.y = THREE.MathUtils.clamp(destino.y, zonaY0 + 0.12, zonaY1 - 0.12);
    const rapidez = THREE.MathUtils.clamp(Math.hypot(v.x, v.z), 2.6, 8);
    v.lerp(trayectoria(p, destino, rapidez), AYUDA);
  }

  // La pared devuelve la bola: cada vez más rápida, más abierta y, desde el nivel 4, con efecto.
  // Se decide dónde llegará la bola a la altura de la pala (siempre a tu alcance) y de ahí sale
  // dónde bota en la mesa: en línea recta entre la pared y ese punto.
  function devolver(p) {
    const n = golpes;
    const rapidez = Math.min(6.2, 2.6 + n * 0.07);
    const abertura = Math.min(0.55, 0.1 + n * 0.016);
    const xLlegada = THREE.MathUtils.clamp(p.x * 0.25 + (Math.random() * 2 - 1) * abertura, -0.55, 0.55);
    const zBote = Z_CERCA - 0.32 - Math.random() * Math.min(0.35, 0.1 + n * 0.006);
    const f = (zBote - p.z) / (Z_PALA_RATON - p.z);
    destino.set(p.x + (xLlegada - p.x) * f, MESA_Y + R_BOLA, zBote);
    vel.copy(trayectoria(p, destino, rapidez));
    curva = nivel() >= 4 ? (Math.random() * 2 - 1) * Math.min(2.2, (nivel() - 3) * 0.6) : 0;
    // Con efecto, la salida se corrige para que la bola llegue al mismo sitio: el efecto se ve
    // en la curva que hace, no en que acabe lejos
    if (curva) {
      const t = (Z_PALA_RATON - p.z) / vel.z;
      vel.x -= 0.5 * curva * t;
    }
  }

  // ─── Reglas ────────────────────────────────────────────────────────────
  function prepararSaque() {
    estado = 'saque';
    botes = 0;
    curva = 0;
    vel.set(0, 0, 0);
    bola.position.set(0.12, MESA_Y + 0.3, Z_PALA_RATON - 0.06);
    for (const h of historia) h.copy(bola.position);
  }

  function empezarPartida() {
    puntos = 0;
    golpes = 0;
    dianas = 0;
    nuevoRecord = false;
    esperaDiana = 9;
    quitarDiana();
    colorObjetivo.set(COLORES_NIVEL[0]);
    prepararSaque();
  }

  function decir(texto, color, duracion = 1.2) {
    mensaje = texto;
    colorMensaje = color;
    tiempoMensaje = duracion;
  }

  function perder(clave) {
    if (estado === 'fin') return;
    estado = 'fin';
    reloj = 5;
    decir(ctx.t(clave), '#ff8a80', 5);
    ctx.sonido('fallo');
    for (const m of ctx.manos) ctx.vibrar(m, 0.5, 120);
    ctx.destello(0xff2a2a, 0.15);
    quitarDiana();
    ctx.puntuacion(puntos); // a la clasificación (juegos/marcadores.js)
    if (puntos > record) {
      record = puntos;
      nuevoRecord = true;
      ctx.guardar('record', record);
      tmp.set(0, MESA_Y + 0.6, Z_PARED + 0.1);
      ctx.efectos.impacto('grande', { pos: tmp, color: 0xffd23f, sonido: 'ovacion' });
    }
  }

  // El jugador golpea la bola
  function golpe() {
    if (enfriamiento > 0) return false;
    if (estado !== 'saque' && estado !== 'vuelta') return false;
    estado = 'ida';
    primeraVez = false;
    botes = 0;
    curva = 0;
    enfriamiento = 0.15;
    ctx.sonido('toc');
    ctx.efectos.impacto('pequeño', { pos: bola.position, color: 0xffffff });
    return true;
  }

  // La bola llega a la pared: dentro de la zona, punto (y quizá diana); fuera, se acabó
  function tocarPared(p) {
    const dentro = Math.abs(p.x) <= zonaX && p.y >= zonaY0 && p.y <= zonaY1;
    lanzarOnda(p.x, p.y, dentro ? colorNivel : colorTmp.set(0xff2a3a), dentro ? 1 : 1.4);
    if (!dentro) {
      vel.z = Math.abs(vel.z) * 0.6;
      ctx.sonido('banda');
      perder('fuera');
      return;
    }
    golpes += 1;
    let suma = 1;
    if (vidaDiana > 0 && Math.hypot(p.x - diana.position.x, p.y - diana.position.y) <= radioDiana + R_BOLA) {
      suma += 5;
      dianas += 1;
      tmp.copy(diana.position);
      ctx.efectos.impacto('medio', { pos: tmp, color: 0xffd23f, sonido: 'anillo' });
      ctx.efectos.estallido(tmp, { color: 0xff3d6e, cantidad: 18 });
      ctx.efectos.texto(tmp, '+5', { color: '#ffd23f', tam: 1.2 });
      decir(ctx.t('diana'), '#ffd23f');
      lanzarOnda(diana.position.x, diana.position.y, colorTmp.set(0xffd23f), 2.2);
      quitarDiana();
    } else {
      tmp.copy(p);
      ctx.efectos.texto(tmp, '+1', { color: '#ffffff', tam: 0.7 });
    }
    puntos += suma;
    ctx.sonido('banda');
    destelloPared = 1;
    // Subir de nivel
    if (golpes % GOLPES_NIVEL === 0) {
      colorObjetivo.set(COLORES_NIVEL[(nivel() - 1) % COLORES_NIVEL.length]);
      tmp.set(0, MESA_Y + ALTO_ZONA / 2, Z_PARED + 0.1);
      ctx.efectos.impacto('grande', { pos: tmp, color: colorObjetivo.getHex(), sonido: 'hoyo' });
      decir(ctx.t('nivel', { n: nivel() }), '#ffd23f', 1.6);
      pulsoMarco = 1.5;
    }
    estado = 'vuelta';
    botes = 0;
    p.z = Z_PARED + R_BOLA + 0.002;
    devolver(p);
  }

  function bote() {
    ctx.sonido('pong');
    botes += 1;
    if (estado === 'vuelta' && botes >= 2) perder('dosBotes');
    else if (estado === 'ida' && botes >= 2) perder('noLlega');
  }

  function lanzarOnda(x, y, color, grande) {
    const o = estadoOndas[siguienteOnda];
    siguienteOnda = (siguienteOnda + 1) % N_ONDAS;
    o.vida = 1;
    o.x = x;
    o.y = y;
    o.color.copy(color);
    o.grande = grande;
  }

  function ponerDiana() {
    const n = nivel();
    radioDiana = Math.max(0.075, 0.14 - (n - 1) * 0.012);
    duracionDiana = Math.max(4, 7 - (n - 1) * 0.5);
    vidaDiana = duracionDiana;
    aparicionDiana = 0;
    diana.position.x = (Math.random() * 2 - 1) * (zonaX - radioDiana - 0.08);
    diana.position.y = zonaY0 + radioDiana + 0.12 + Math.random() * (ALTO_ZONA - radioDiana * 2 - 0.24);
    diana.visible = true;
    ctx.sonido('dianaAparece');
  }

  function quitarDiana() {
    vidaDiana = 0;
    diana.visible = false;
  }

  // ─── Física de la bola ─────────────────────────────────────────────────
  // Choque bola-pala con la pala interpolada entre el fotograma anterior y este
  function chocarPala(p, f, h) {
    const centro = tmp.lerpVectors(p.centroAntes, p.centro, f);
    const normal = tmp2.lerpVectors(p.normalAntes, p.normal, f).normalize();
    const d = relativa.subVectors(bola.position, centro).dot(normal);
    const enPlano = relativa.addScaledVector(normal, -d).length();
    if (enPlano > R_PALA + R_BOLA * 0.5 || Math.abs(d) > R_BOLA + GROSOR_PALA / 2) return false;
    velPala.subVectors(p.centro, p.centroAntes).divideScalar(Math.max(h, 1e-4)).multiplyScalar(FUERZA_PALA);
    relativa.subVectors(vel, velPala);
    const vn = relativa.dot(normal);
    if (vn * Math.sign(d || 1) >= 0) return false; // ya se aleja de la pala
    if (!golpe()) return false;
    vel.copy(velPala).add(relativa.addScaledVector(normal, -(1 + REBOTE_PALA) * vn));
    bola.position.copy(centro).addScaledVector(normal, Math.sign(d || 1) * (R_BOLA + GROSOR_PALA / 2 + 0.002));
    ayudar(bola.position, vel);
    ctx.vibrar(p.mano, 0.5, 40);
    return true;
  }

  function moverBola(dt, palaVR) {
    if (estado === 'saque') {
      // Flota esperando el saque, con un leve vaivén
      bola.position.y = MESA_Y + 0.3 + Math.sin(tiempo * 3) * 0.015;
      if (palaVR) for (let i = 1; i <= 4; i++) if (chocarPala(palaVR, i / 4, dt)) break;
      return;
    }
    const rapidez = Math.max(vel.length(), palaVR ? palaVR.centro.distanceTo(palaVR.centroAntes) / dt : 0);
    const pasos = Math.min(24, Math.max(1, Math.ceil((rapidez * dt) / 0.012)));
    const h = dt / pasos;
    for (let i = 1; i <= pasos; i++) {
      anterior.copy(bola.position);
      vel.y -= G * h;
      if (estado === 'vuelta') vel.x += curva * h;
      bola.position.addScaledVector(vel, h);
      const p = bola.position;
      // Mesa
      if (vel.y < 0 && p.y < MESA_Y + R_BOLA && anterior.y >= MESA_Y + R_BOLA - 0.01 && sobreMesa(p)) {
        p.y = MESA_Y + R_BOLA;
        vel.y *= -REBOTE_MESA;
        vel.x *= 0.97;
        vel.z *= 0.97;
        bote();
      }
      // Pared
      if (vel.z < 0 && p.z <= Z_PARED + R_BOLA && anterior.z > Z_PARED + R_BOLA - 0.001) {
        if (estado === 'ida') tocarPared(p);
        else {
          p.z = Z_PARED + R_BOLA;
          vel.z = Math.abs(vel.z) * 0.6;
        }
      }
      // Pala VR
      if (palaVR && estado === 'vuelta' && chocarPala(palaVR, i / pasos, h * pasos)) continue;
      // Suelo
      if (p.y < R_BOLA) {
        p.y = R_BOLA;
        vel.y = Math.abs(vel.y) * 0.55;
        vel.x *= 0.8;
        vel.z *= 0.8;
      }
    }
    const p = bola.position;
    if (estado === 'ida' && (p.y < MESA_Y - 0.3 || p.z > Z_CERCA + 0.8)) perder('noLlega');
    if (estado === 'vuelta' && (p.y < MESA_Y - 0.3 || p.z > Z_CERCA + 0.9)) perder('escapa');
  }

  // ─── Jugador ───────────────────────────────────────────────────────────
  function palasVRActualizar() {
    let activa = null;
    let derecha = null;
    let primera = null;
    for (const p of palasVR) {
      if (!p.mano.activa) continue;
      if (!primera) primera = p;
      if (p.mano.lado === 'right') derecha = p;
    }
    if (indicePala === null || !ctx.manos[indicePala].activa) {
      const elegida = derecha || primera;
      indicePala = elegida ? elegida.mano.indice : null;
    }
    // El gatillo de la mano libre cambia la pala de mano (zurdos)
    for (const p of palasVR) {
      if (p.mano.activa && p.mano.indice !== indicePala && p.mano.gatilloPulsado) {
        indicePala = p.mano.indice;
        ctx.vibrar(p.mano, 0.3, 40);
        break;
      }
    }
    for (const p of palasVR) {
      const esta = p.mano.indice === indicePala && p.mano.activa;
      p.objeto.visible = esta;
      if (!esta) {
        p.lista = false;
        continue;
      }
      p.centroAntes.copy(p.centro);
      p.normalAntes.copy(p.normal);
      p.mano.grip.localToWorld(p.centro.copy(CENTRO_HOJA));
      p.normal.set(1, 0, 0).transformDirection(p.mano.grip.matrixWorld);
      if (!p.lista) {
        p.centroAntes.copy(p.centro);
        p.normalAntes.copy(p.normal);
        p.lista = true;
      }
      activa = p;
    }
    return activa;
  }

  function palaRatonActualizar(dt) {
    const r = ctx.raton;
    pivoteRaton.visible = r.dentro || ctx.tactil;
    if (r.rayo.ray.intersectPlane(planoRaton, tmp)) {
      tmp.x = THREE.MathUtils.clamp(tmp.x, -ANCHO / 2 - 0.3, ANCHO / 2 + 0.3);
      tmp.y = THREE.MathUtils.clamp(tmp.y, MESA_Y + 0.02, MESA_Y + 0.9);
      velRaton.subVectors(tmp, pivoteRaton.position).divideScalar(Math.max(dt, 1e-3));
      pivoteRaton.position.lerp(tmp, Math.min(1, dt * 25));
    }
    // Inclinación según hacia dónde se mueve (queda más natural)
    pivoteRaton.rotation.z = THREE.MathUtils.clamp(-velRaton.x * 0.05, -0.5, 0.5);

    // Contacto: la bola llega a la pala (o, en el saque, la tocas con la pala)
    const p = bola.position;
    const cerca = Math.hypot(p.x - pivoteRaton.position.x, p.y - pivoteRaton.position.y) < R_CONTACTO_RATON &&
      Math.abs(p.z - Z_PALA_RATON) < 0.12;
    const viene = estado === 'saque' || (estado === 'vuelta' && vel.z > 0);
    if (cerca && viene && golpe()) {
      // Apuntas con la pala: la bola va hacia donde está la pala, desviada por dónde da en ella
      const desvio = (p.x - pivoteRaton.position.x) / R_CONTACTO_RATON;
      const remate = THREE.MathUtils.clamp(r.velocidadPx / 2500, 0, 1);
      destino.set(
        THREE.MathUtils.clamp(pivoteRaton.position.x * 0.95 + desvio * 0.12, -zonaX + 0.08, zonaX - 0.08),
        zonaY0 + 0.2 + THREE.MathUtils.clamp((pivoteRaton.position.y - MESA_Y) / 0.9, 0, 1) * (ALTO_ZONA - 0.35),
        Z_PARED + R_BOLA,
      );
      p.z = Math.min(p.z, Z_PALA_RATON - 0.03);
      vel.copy(trayectoria(p, destino, 3.6 + remate * 2.4));
    }
  }

  // ─── Marcador ──────────────────────────────────────────────────────────
  function actualizarMarcador() {
    if (estado === 'fin') {
      marcador.escribir([
        { texto: ctx.t('partida.finPuntos', { n: puntos }), tam: 1.15, color: '#ffd23f' },
        { texto: mensaje, tam: 0.66, color: colorMensaje },
        { texto: nuevoRecord ? ctx.t('partida.nuevoRecord') : ctx.t('resumen', { golpes, dianas, record }), tam: 0.58, color: nuevoRecord ? '#ffd23f' : '#cfd8dc' },
      ]);
      return;
    }
    if (primeraVez) {
      const intro = ctx.enVR() ? ctx.t('intro') : ctx.t(ctx.tactil ? 'introTactil' : 'introRaton');
      marcador.escribir([
        { texto: ctx.t('titulo'), tam: 1.2, color: '#ffd23f' },
        { texto: intro, tam: 0.62 },
        { texto: ctx.t('partida.record', { record }), tam: 0.56, color: '#cfd8dc' },
      ]);
      return;
    }
    marcador.escribir([
      { texto: ctx.t('marcador', { puntos }), tam: 1.2 },
      tiempoMensaje > 0
        ? { texto: mensaje, tam: 0.72, color: colorMensaje }
        : { texto: ctx.t(estado === 'saque' ? 'saque' : 'estado', { golpes, n: nivel() }), tam: 0.72, color: '#cfd8dc' },
    ]);
  }

  // ─── Bucle ─────────────────────────────────────────────────────────────
  function actualizar(dt, t) {
    tiempo += dt;
    enfriamiento = Math.max(0, enfriamiento - dt);
    tiempoMensaje -= dt;
    if (estado === 'fin') {
      reloj -= dt;
      if (reloj <= 0) empezarPartida();
    }

    const enVR = ctx.enVR();
    let palaVR = null;
    if (enVR) {
      pivoteRaton.visible = false;
      palaVR = palasVRActualizar();
    } else {
      for (const p of palasVR) p.objeto.visible = false;
      palaRatonActualizar(dt);
    }
    if (estado !== 'fin' || bola.position.y > 0.03) moverBola(dt, palaVR);

    // Diana: aparece de vez en cuando durante el peloteo y se va apagando
    if (estado === 'ida' || estado === 'vuelta') {
      if (vidaDiana > 0) {
        vidaDiana -= dt;
        if (vidaDiana <= 0) quitarDiana();
      } else {
        esperaDiana -= dt;
        if (esperaDiana <= 0) {
          ponerDiana();
          esperaDiana = 8 + Math.random() * 7;
        }
      }
    }
    animar(dt);
    actualizarMarcador();
  }

  // Estela, sombra, ondas, diana, pared y gradas: todo lo que se mueve sin ser el juego
  function animar(dt) {
    // Estela: las últimas posiciones de la bola, cada vez más pequeñas
    for (let i = N_ESTELA - 1; i > 0; i--) historia[i].copy(historia[i - 1]);
    historia[0].copy(bola.position);
    const rapida = Math.min(1, vel.length() / 6);
    for (let i = 0; i < N_ESTELA; i++) {
      const f = 1 - i / N_ESTELA;
      matrizTmp.makeScale(f, f, f).setPosition(historia[i]);
      estela.setMatrixAt(i, matrizTmp);
      estela.setColorAt(i, colorTmp.copy(colorNivel).multiplyScalar(estado === 'saque' ? 0 : f * (0.25 + rapida * 0.55)));
    }
    estela.instanceMatrix.needsUpdate = true;
    estela.instanceColor.needsUpdate = true;
    ctx.colocarSombra(sombraBola, bola.position, sobreMesa(bola.position) ? MESA_Y + 0.002 : 0.01);
    // Ondas en la pared
    for (let i = 0; i < N_ONDAS; i++) {
      const o = estadoOndas[i];
      o.vida = Math.max(0, o.vida - dt * 2.2);
      const r = (0.05 + (1 - o.vida) * 0.3) * o.grande;
      matrizTmp.makeScale(r, r, 1).setPosition(o.x, o.y, Z_PARED + 0.01);
      ondas.setMatrixAt(i, matrizTmp);
      ondas.setColorAt(i, colorTmp.copy(o.color).multiplyScalar(o.vida));
    }
    ondas.instanceMatrix.needsUpdate = true;
    ondas.instanceColor.needsUpdate = true;
    // Diana: entra creciendo con rebote, late, y su reloj de puntos se apaga
    if (vidaDiana > 0) {
      aparicionDiana = Math.min(1, aparicionDiana + dt * 4);
      const entra = aparicionDiana < 1 ? aparicionDiana * (1 + 0.3 * Math.sin(aparicionDiana * Math.PI)) : 1;
      const prisa = vidaDiana < 1.5 ? 8 : 3;
      const late = 1 + Math.sin(tiempo * prisa) * 0.04;
      diana.scale.setScalar(radioDiana * entra * late);
      puntosDiana.count = Math.ceil((vidaDiana / duracionDiana) * N_PUNTOS_DIANA);
    }
    // Pared: el color del nivel entra poco a poco y la cuadrícula brilla en cada golpe
    colorNivel.lerp(colorObjetivo, Math.min(1, dt * 3));
    destelloPared = Math.max(0, destelloPared - dt * 3);
    pulsoMarco = Math.max(0, pulsoMarco - dt);
    marco.material.color.copy(colorNivel).lerp(blanco, destelloPared * 0.4 + Math.max(0, Math.sin(pulsoMarco * 12)) * pulsoMarco * 0.4);
    matPared.emissive.copy(colorNivel);
    matPared.emissiveIntensity = 0.32 + destelloPared * 0.35;
    resplandor.material.color.copy(colorNivel);
    resplandor.material.opacity = 0.25 + destelloPared * 0.25;
    // Las pantallas de las gradas corren más deprisa cuanto más alto el nivel
    texLed.offset.x = (texLed.offset.x + dt * (0.05 + nivel() * 0.03)) % 1;
  }

  prepararSaque();
  actualizarMarcador();

  return {
    actualizar,
    liberar() {},
  };
}
