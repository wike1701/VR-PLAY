// FUTBOLÍN
// El futbolín de toda la vida en un bar de barrio, contra la máquina. Estás de pie en el lateral
// del futbolín, con las porterías a tu izquierda y a tu derecha: juegas con los rojos y atacas
// hacia la derecha. La mano izquierda lleva tu portero y tu defensa; la derecha, tus
// centrocampistas y tus delanteros. Acercar o alejar la mano desliza las barras; girar la muñeca
// hace que los muñecos chuten (cuanto más rápido giras, más fuerte). Partidos a 5 goles: cada
// partido ganado trae una máquina más rápida, y la racha acaba al perder uno. Cada gol tuyo vale
// 100 puntos por el número de máquina y cada partido ganado, 500 por máquina más.
// Sin gafas: mueve el ratón (o el dedo) arriba y abajo para mover las barras (el muñeco más cercano
// de cada una se pone a su altura) y haz clic para chutar.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código.
export async function precargar() {}

// ─── Medidas del futbolín ─────────────────────────────────────────────────
const MESA_Y = 0.82;            // altura del campo
const X_FONDO = 0.6;            // las porterías, en x = ±0.6
const Z_CERCA = -0.42;          // banda de tu lado
const Z_LEJOS = -1.06;          // banda del otro lado
const Z_CENTRO = (Z_CERCA + Z_LEJOS) / 2;
const MEDIA_PORTERIA = 0.1;
const RB = 0.018;               // radio de la bola
const ALTO_BARRA = 0.075;       // las barras, por encima del campo
const PIE = 0.075;              // del eje de la barra a la punta del pie
const GOLES = 5;
const PASO = 1 / 240;
// Barras de izquierda a derecha: equipo (0 = tú, rojo; 1 = la máquina, azul), muñecos y recorrido
const BARRAS = [
  { x: -0.525, equipo: 0, munecos: [0], recorrido: 0.17 },
  { x: -0.375, equipo: 0, munecos: [-0.12, 0.12], recorrido: 0.13 },
  { x: -0.225, equipo: 1, munecos: [-0.2, 0, 0.2], recorrido: 0.1 },
  { x: -0.075, equipo: 0, munecos: [-0.24, -0.12, 0, 0.12, 0.24], recorrido: 0.06 },
  { x: 0.075, equipo: 1, munecos: [-0.24, -0.12, 0, 0.12, 0.24], recorrido: 0.06 },
  { x: 0.225, equipo: 0, munecos: [-0.2, 0, 0.2], recorrido: 0.1 },
  { x: 0.375, equipo: 1, munecos: [-0.12, 0.12], recorrido: 0.13 },
  { x: 0.525, equipo: 1, munecos: [0], recorrido: 0.17 },
];
const MANO_IZQ = [0, 1];        // tus barras de la mano izquierda
const MANO_DER = [3, 5];        // y las de la derecha
const TUYAS = [0, 1, 3, 5];
const Z_PUNO = 0.18;            // las empuñaduras, a esta distancia de cada banda

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (r) => ctx.recurso(r);

  ctx.fondo(0x3a2a20, { cenit: 0x1c140f, horizonte: 0x4a3626, suelo: 0x2a1e16, niebla: [8, 20] });
  ctx.sueloBase(false);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.72, 0.02), new THREE.Vector3(0, MESA_Y + 0.06, Z_CENTRO - 0.1));

  const matrizTmp = new THREE.Matrix4();
  const tmpMatriz = new THREE.Matrix4();
  const eulerTmp = new THREE.Euler();
  const colorTmp = new THREE.Color();
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
  const caja = (w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) => colocar(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz);

  // ─── Bar de barrio ─────────────────────────────────────────────────────
  const texBaldosas = R(ctx.texturaCanvas((g, tam) => {
    const n = 8;
    for (let y = 0; y < n; y++) {
      for (let x = 0; x < n; x++) {
        g.fillStyle = (x + y) % 2 ? '#c8b89a' : '#8a5a3a';
        g.fillRect((x * tam) / n, (y * tam) / n, tam / n, tam / n);
      }
    }
    g.strokeStyle = 'rgba(40,30,20,0.4)';
    for (let i = 0; i <= n; i++) {
      g.beginPath(); g.moveTo((i * tam) / n, 0); g.lineTo((i * tam) / n, tam); g.stroke();
      g.beginPath(); g.moveTo(0, (i * tam) / n); g.lineTo(tam, (i * tam) / n); g.stroke();
    }
  }, { tam: 256, repetir: [6, 6] }));
  const suelo = new THREE.Mesh(R(new THREE.PlaneGeometry(10, 10)), R(new THREE.MeshLambertMaterial({ map: texBaldosas })));
  suelo.rotation.x = -Math.PI / 2;
  suelo.position.z = -1.5;
  raiz.add(suelo);
  // Paredes: azulejo abajo y pintura arriba
  const texAzulejo = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#e8e2d4';
    g.fillRect(0, 0, tam, tam);
    g.fillStyle = '#2a6a8a';
    for (let i = 0; i < 4; i++) for (let j = 0; j < 4; j++) {
      g.beginPath();
      g.arc(tam / 8 + (i * tam) / 4, tam / 8 + (j * tam) / 4, tam / 20, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = 'rgba(80,80,80,0.35)';
    for (let i = 0; i <= 4; i++) {
      g.beginPath(); g.moveTo((i * tam) / 4, 0); g.lineTo((i * tam) / 4, tam); g.stroke();
      g.beginPath(); g.moveTo(0, (i * tam) / 4); g.lineTo(tam, (i * tam) / 4); g.stroke();
    }
  }, { tam: 256, repetir: [10, 2] }));
  const matAzulejo = R(new THREE.MeshLambertMaterial({ map: texAzulejo }));
  raiz.add(new THREE.Mesh(fusionar([caja(9, 1.2, 0.1, 0, 0.6, -4.2), caja(0.1, 1.2, 8, -3.6, 0.6, -0.5), caja(0.1, 1.2, 8, 3.6, 0.6, -0.5)]), matAzulejo));
  raiz.add(new THREE.Mesh(fusionar([caja(9, 2.2, 0.1, 0, 2.3, -4.2), caja(0.1, 2.2, 8, -3.6, 2.3, -0.5), caja(0.1, 2.2, 8, 3.6, 2.3, -0.5)]), R(new THREE.MeshLambertMaterial({ color: 0xd9c48a }))));
  // Barra del bar, taburetes, estantería con botellas y la tele
  const piezasBar = [];
  const coloresBar = [];
  const pieza = (geo, color) => { piezasBar.push(geo); coloresBar.push(color); };
  pieza(caja(4.2, 1.05, 0.6, 0.6, 0.525, -3.4), 0x6a3a1e);
  pieza(caja(4.3, 0.06, 0.7, 0.6, 1.08, -3.4), 0x3a2414);
  for (let i = 0; i < 5; i++) {
    const x = -1 + i * 0.8;
    pieza(colocar(new THREE.CylinderGeometry(0.18, 0.18, 0.06, 14), x, 0.75, -2.9), 0xb02a2a);
    pieza(colocar(new THREE.CylinderGeometry(0.025, 0.04, 0.72, 8), x, 0.36, -2.9), 0x8a8a90);
  }
  for (let k = 0; k < 2; k++) {
    pieza(caja(3.6, 0.04, 0.25, 0.6, 1.6 + k * 0.45, -4.05), 0x5a3a24);
    for (let i = 0; i < 12; i++) {
      const tono = [0x2a6a2a, 0x8a2a1a, 0xc8a050, 0x2a3a6a, 0xe8e0c8, 0x6a1a3a][(i + k * 3) % 6];
      pieza(colocar(new THREE.CylinderGeometry(0.035, 0.04, 0.26, 8), -1 + i * 0.29, 1.75 + k * 0.45, -4.05), tono);
    }
  }
  pieza(caja(1.1, 0.68, 0.12, -2.2, 2.3, -4.1), 0x1a1a1e);
  raiz.add(new THREE.Mesh(fusionar(piezasBar, coloresBar), R(new THREE.MeshLambertMaterial({ vertexColors: true }))));
  const texTele = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#2f8a3a';
    g.fillRect(0, 0, tam, tam);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    g.strokeRect(10, 10, tam - 20, tam - 20);
    g.beginPath(); g.moveTo(tam / 2, 10); g.lineTo(tam / 2, tam - 10); g.stroke();
    g.beginPath(); g.arc(tam / 2, tam / 2, tam / 8, 0, Math.PI * 2); g.stroke();
  }, { tam: 128 }));
  const tele = new THREE.Mesh(R(new THREE.PlaneGeometry(1.0, 0.58)), R(new THREE.MeshBasicMaterial({ map: texTele, toneMapped: false })));
  tele.position.set(-2.2, 2.3, -4.035);
  raiz.add(tele);
  // Lámpara sobre el futbolín
  raiz.add(new THREE.Mesh(fusionar([colocar(new THREE.ConeGeometry(0.3, 0.2, 18, 1, true), 0, 2.0, Z_CENTRO), caja(0.01, 0.8, 0.01, 0, 2.5, Z_CENTRO)]), R(new THREE.MeshLambertMaterial({ color: 0x2a5a3a, side: THREE.DoubleSide }))));
  const bombilla = new THREE.Mesh(R(new THREE.SphereGeometry(0.06, 12, 8)), R(new THREE.MeshBasicMaterial({ color: 0xfff0c8, toneMapped: false })));
  bombilla.position.set(0, 1.92, Z_CENTRO);
  raiz.add(bombilla);

  // ─── Futbolín ──────────────────────────────────────────────────────────
  const texCampo = R(ctx.texturaCanvas((g, tam) => {
    // El campo a lo largo (x) en horizontal
    g.fillStyle = '#2f8a3a';
    g.fillRect(0, 0, tam, tam);
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.05)';
      g.fillRect((i * tam) / 8, 0, tam / 8, tam);
    }
    g.strokeStyle = '#f2f2f2';
    g.lineWidth = 4;
    g.strokeRect(6, 6, tam - 12, tam - 12);
    g.beginPath(); g.moveTo(tam / 2, 6); g.lineTo(tam / 2, tam - 6); g.stroke();
    g.beginPath(); g.arc(tam / 2, tam / 2, tam * 0.12, 0, Math.PI * 2); g.stroke();
    g.strokeRect(6, tam * 0.3, tam * 0.1, tam * 0.4);
    g.strokeRect(tam - 6 - tam * 0.1, tam * 0.3, tam * 0.1, tam * 0.4);
  }, { tam: 256 }));
  const campo = new THREE.Mesh(R(new THREE.PlaneGeometry(X_FONDO * 2, Z_CERCA - Z_LEJOS)), R(new THREE.MeshLambertMaterial({ map: texCampo })));
  campo.rotation.x = -Math.PI / 2;
  campo.position.set(0, MESA_Y, Z_CENTRO);
  raiz.add(campo);
  const matMueble = R(new THREE.MeshStandardMaterial({ map: R(ctx.texturas.madera(0x7a4524, { tam: 256, semilla: 241 })), roughness: 0.4 }));
  const ancho = Z_CERCA - Z_LEJOS;
  const mueble = [
    caja(X_FONDO * 2 + 0.2, 0.35, ancho + 0.2, 0, MESA_Y - 0.18, Z_CENTRO),                // cajón
    caja(X_FONDO * 2 + 0.2, 0.14, 0.05, 0, MESA_Y + 0.05, Z_CERCA + 0.025),                   // bandas
    caja(X_FONDO * 2 + 0.2, 0.14, 0.05, 0, MESA_Y + 0.05, Z_LEJOS - 0.025),
    // Los fondos, con el hueco de la portería
    caja(0.05, 0.14, ancho / 2 - MEDIA_PORTERIA, -X_FONDO - 0.025, MESA_Y + 0.05, Z_CERCA - (ancho / 2 - MEDIA_PORTERIA) / 2),
    caja(0.05, 0.14, ancho / 2 - MEDIA_PORTERIA, -X_FONDO - 0.025, MESA_Y + 0.05, Z_LEJOS + (ancho / 2 - MEDIA_PORTERIA) / 2),
    caja(0.05, 0.14, ancho / 2 - MEDIA_PORTERIA, X_FONDO + 0.025, MESA_Y + 0.05, Z_CERCA - (ancho / 2 - MEDIA_PORTERIA) / 2),
    caja(0.05, 0.14, ancho / 2 - MEDIA_PORTERIA, X_FONDO + 0.025, MESA_Y + 0.05, Z_LEJOS + (ancho / 2 - MEDIA_PORTERIA) / 2),
    caja(0.05, 0.05, MEDIA_PORTERIA * 2 + 0.04, -X_FONDO - 0.025, MESA_Y + 0.095, Z_CENTRO),   // larguero
    caja(0.05, 0.05, MEDIA_PORTERIA * 2 + 0.04, X_FONDO + 0.025, MESA_Y + 0.095, Z_CENTRO),
  ];
  for (const x of [-0.6, 0.6]) for (const z of [Z_CERCA - 0.05, Z_LEJOS + 0.05]) mueble.push(caja(0.08, MESA_Y - 0.35, 0.08, x, (MESA_Y - 0.35) / 2, z));
  raiz.add(new THREE.Mesh(fusionar(mueble), matMueble));
  // El hueco de cada portería (negro) y los marcadores de cuentas encima
  raiz.add(new THREE.Mesh(fusionar([caja(0.02, 0.07, MEDIA_PORTERIA * 2, -X_FONDO - 0.03, MESA_Y + 0.035, Z_CENTRO), caja(0.02, 0.07, MEDIA_PORTERIA * 2, X_FONDO + 0.03, MESA_Y + 0.035, Z_CENTRO)]), R(new THREE.MeshBasicMaterial({ color: 0x050403 }))));
  const sombraMesa = ctx.crearSombra({ radio: 0.9, opacidad: 0.5 });
  sombraMesa.position.set(0, 0.01, Z_CENTRO);
  raiz.add(sombraMesa);
  // Cuentas del marcador: 5 por equipo en un alambre, sobre cada fondo
  const geoCuenta = R(new THREE.SphereGeometry(0.018, 10, 8));
  const cuentas = new THREE.InstancedMesh(geoCuenta, R(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.3 })), GOLES * 2);
  raiz.add(cuentas);
  raiz.add(new THREE.Mesh(fusionar([
    colocar(new THREE.CylinderGeometry(0.003, 0.003, 0.36, 6), -0.3, MESA_Y + 0.17, Z_LEJOS - 0.02, 0, 0, Math.PI / 2),
    colocar(new THREE.CylinderGeometry(0.003, 0.003, 0.36, 6), 0.3, MESA_Y + 0.17, Z_LEJOS - 0.02, 0, 0, Math.PI / 2),
  ]), R(new THREE.MeshBasicMaterial({ color: 0x888888 }))));

  // Barras (cromadas) y empuñaduras
  const geoBarra = R(new THREE.CylinderGeometry(0.008, 0.008, Z_CERCA - Z_LEJOS + 0.26, 10).rotateX(Math.PI / 2));
  const barrasMalla = new THREE.InstancedMesh(geoBarra, R(new THREE.MeshStandardMaterial({ color: 0xd9dee5, roughness: 0.15, metalness: 1 })), BARRAS.length);
  barrasMalla.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  raiz.add(barrasMalla);
  const geoPuno = R(new THREE.CylinderGeometry(0.02, 0.018, 0.12, 12).rotateX(Math.PI / 2));
  const punos = new THREE.InstancedMesh(geoPuno, R(new THREE.MeshLambertMaterial({ color: 0x1a1a1e })), BARRAS.length);
  punos.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  raiz.add(punos);
  // Muñecos: cabeza, pelo y bigote, camiseta, pantalón y pie, en una malla instanciada por equipo
  function geoMuneco(camiseta, pantalon) {
    return fusionar([
      colocar(new THREE.SphereGeometry(0.017, 10, 8), 0, 0.045, 0),                          // cabeza
      colocar(new THREE.SphereGeometry(0.0175, 10, 6, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.048, 0), // pelo
      caja(0.016, 0.004, 0.004, 0.012, 0.039, 0),                                            // bigote
      caja(0.026, 0.05, 0.036, 0, 0.004, 0),                                                 // camiseta
      caja(0.024, 0.03, 0.03, 0, -0.035, 0),                                                 // pantalón
      caja(0.02, 0.03, 0.026, 0, -0.06, 0),                                                  // pierna
      caja(0.03, 0.012, 0.026, 0.005, -PIE + 0.006, 0),                                      // pie
    ], [0xe0b088, 0x1a1210, 0x1a1210, camiseta, pantalon, 0xe0b088, 0x1a1a1e]);
  }
  const equipos = [geoMuneco(0xc62828, 0xf2f2f2), geoMuneco(0x1f5fd1, 0xf2f2f2)].map((geo, e) => {
    const n = BARRAS.filter((b) => b.equipo === e).reduce((a, b) => a + b.munecos.length, 0);
    const m = new THREE.InstancedMesh(geo, R(new THREE.MeshLambertMaterial({ vertexColors: true })), n);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    raiz.add(m);
    return m;
  });
  // Estado de cada barra: desplazamiento (z), giro (φ) y sus velocidades
  const barras = BARRAS.map((b) => ({ ...b, s: 0, sAntes: 0, vs: 0, phi: 0, phiAntes: 0, w: 0, objetivoS: 0, objetivoPhi: 0, chute: 0, cruce: 0 }));

  // Bola
  const bola = new THREE.Mesh(R(new THREE.SphereGeometry(RB, 16, 12)), R(new THREE.MeshStandardMaterial({ color: 0xf2f2e8, roughness: 0.35 })));
  raiz.add(bola);
  const sombraBola = ctx.crearSombra({ radio: RB * 1.4, opacidad: 0.5 });
  raiz.add(sombraBola);
  const b = { x: 0, z: Z_CENTRO, vx: 0, vz: 0 };

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 0.95, alto: 0.34 });
  marcador.mesh.position.set(0, 1.17, Z_LEJOS - 0.3);
  marcador.mesh.rotation.x = -0.25;
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'saque'; // 'saque' | 'juego' | 'gol' | 'fin'
  let reloj = 1.5;
  let goles = [0, 0];
  let nivel = 1;
  let puntos = 0;
  let mensaje = '';
  let colorMensaje = '#ffffff';
  let tiempoMensaje = 0;
  let quieta = 0;          // segundos con la bola casi parada (bola muerta)
  let atasco = 0;          // segundos sin que la bola avance ni retroceda
  let xAtasco = 0;
  let tiempo = 0;
  let acumulado = 0;
  let primerGolpe = true;
  const tmp = new THREE.Vector3();
  const manoPos = new THREE.Vector3();
  const ejeMano = new THREE.Vector3();
  const planoMesa = new THREE.Plane(new THREE.Vector3(0, 1, 0), -MESA_Y);

  function decir(texto, color = '#ffffff', duracion = 1.4) {
    mensaje = texto;
    colorMensaje = color;
    tiempoMensaje = duracion;
  }

  function sacar() {
    estado = 'saque';
    reloj = 1.2;
    b.x = 0;
    b.z = Z_CENTRO;
    b.vx = 0;
    b.vz = 0;
    quieta = 0;
    atasco = 0;
    xAtasco = 0;
  }

  function empezarPartido() {
    goles = [0, 0];
    decir(ctx.t('partidoN', { n: nivel }), '#ffd23f', 2);
    sacar();
  }

  function gol(equipo) {
    goles[equipo] += 1;
    estado = 'gol';
    reloj = 2;
    tmp.set(equipo === 0 ? X_FONDO : -X_FONDO, MESA_Y + 0.1, Z_CENTRO);
    if (equipo === 0) {
      puntos += 100 * nivel;
      ctx.efectos.impacto('grande', { pos: tmp, color: 0xffd23f, sonido: 'gol' });
      ctx.efectos.texto(tmp, ctx.t('golTuyo'), { color: '#ffd23f', tam: 1.3 });
      decir(ctx.t('golTuyo'), '#ffd23f');
    } else {
      ctx.sonido('fallo');
      ctx.efectos.estallido(tmp, { color: 0x1f5fd1, cantidad: 10 });
      decir(ctx.t('golMaquina'), '#ff8a80');
    }
    if (goles[0] >= GOLES || goles[1] >= GOLES) {
      estado = 'fin';
      reloj = 5;
      if (goles[0] > goles[1]) {
        puntos += 500 * nivel;
        decir(ctx.t('partida.hasGanado'), '#b9f6ca', 5);
        ctx.sonido('ovacion');
        nivel += 1;
      } else {
        // Se acaba la racha: se apuntan los puntos y se vuelve a la primera máquina
        ctx.puntuacion(puntos);
        decir(ctx.t('partida.ganaMaquina'), '#ff8a80', 5);
        puntos = 0;
        nivel = 1;
      }
    }
  }

  // ─── Física de la bola ─────────────────────────────────────────────────
  // Pie de un muñeco: un taco en el plano del campo, que solo toca la bola si la barra no está levantada
  function chocarPies(h) {
    for (const barra of barras) {
      if (Math.abs(Math.sin(barra.phi)) > 0.8 || Math.cos(barra.phi) < 0) continue; // pie levantado
      const px = barra.x + PIE * Math.sin(barra.phi);
      const vpx = PIE * barra.w * Math.cos(barra.phi); // velocidad del pie por el giro
      for (const mz of barra.munecos) {
        const pz = Z_CENTRO + mz + barra.s;
        // Caja del pie (medio ancho 0.014 en x y 0.015 en z) contra la bola
        const cx = Math.max(px - 0.014, Math.min(px + 0.014, b.x));
        const cz = Math.max(pz - 0.015, Math.min(pz + 0.015, b.z));
        const dx = b.x - cx;
        const dz = b.z - cz;
        const d2 = dx * dx + dz * dz;
        if (d2 < RB * RB) {
          const d = Math.sqrt(d2) || 1e-6;
          const nx = d2 > 1e-12 ? dx / d : Math.sign(b.x - px) || 1;
          const nz = d2 > 1e-12 ? dz / d : 0;
          b.x = cx + nx * RB;
          b.z = cz + nz * RB;
          const rvx = b.vx - vpx;
          const rvz = b.vz - barra.vs;
          const vn = rvx * nx + rvz * nz;
          if (vn < 0) {
            b.vx -= 1.55 * vn * nx;
            b.vz -= 1.55 * vn * nz;
            // Un golpe de lado (la barra que se desliza) también la saca algo hacia delante o atrás
            if (Math.abs(nz) > Math.abs(nx)) b.vx += (Math.random() - 0.5) * 0.3;
            // Un chute de verdad: la bola sale con la velocidad del pie
            // (y si la barra se desliza a la vez, sale cruzada)
            if (Math.abs(vpx) > 0.6 && Math.sign(vpx) === Math.sign(nx || vpx)) {
              b.vx = vpx * 1.1 + b.vx * 0.2;
              b.vz += barra.vs * 0.6;
            }
            const v = Math.hypot(b.vx, b.vz);
            if (v > 4.2) { b.vx *= 4.2 / v; b.vz *= 4.2 / v; }
            if (-vn > 0.4) golpeBola(barra, -vn);
          }
        }
      }
    }
  }

  function golpeBola(barra, fuerza) {
    tmp.set(b.x, MESA_Y + RB, b.z);
    if (barra.equipo === 0) {
      ctx.efectos.impacto(fuerza > 2 ? 'medio' : 'pequeño', { pos: tmp, color: 0xffffff, sonido: 'toc' });
      primerGolpe = false;
    } else {
      ctx.sonido('toc');
    }
  }

  function moverBola(h) {
    const v = Math.hypot(b.vx, b.vz);
    if (v > 0) {
      const nueva = Math.max(0, v - (0.03 + 0.12 * v) * h);
      b.vx *= nueva / v;
      b.vz *= nueva / v;
    }
    b.x += b.vx * h;
    b.z += b.vz * h;
    // Bandas
    if (b.z > Z_CERCA - RB) { b.z = Z_CERCA - RB; b.vz = -Math.abs(b.vz) * 0.8; if (Math.abs(b.vz) > 0.4) ctx.sonido('banda'); }
    if (b.z < Z_LEJOS + RB) { b.z = Z_LEJOS + RB; b.vz = Math.abs(b.vz) * 0.8; if (Math.abs(b.vz) > 0.4) ctx.sonido('banda'); }
    // Fondos: gol si entra por la portería; si no, rebota
    const enPorteria = Math.abs(b.z - Z_CENTRO) < MEDIA_PORTERIA - RB * 0.5;
    if (b.x > X_FONDO - RB) {
      if (enPorteria) return gol(0);
      b.x = X_FONDO - RB;
      b.vx = -Math.abs(b.vx) * 0.8;
      if (Math.abs(b.vx) > 0.4) ctx.sonido('banda');
    }
    if (b.x < -X_FONDO + RB) {
      if (enPorteria) return gol(1);
      b.x = -X_FONDO + RB;
      b.vx = Math.abs(b.vx) * 0.8;
      if (Math.abs(b.vx) > 0.4) ctx.sonido('banda');
    }
    chocarPies(h);
  }

  // ─── Tus barras ────────────────────────────────────────────────────────
  // VR: acercar o alejar la mano desliza; girar la muñeca gira la barra
  function manosVR() {
    for (const mano of ctx.manos) {
      if (!mano.activa) continue;
      const izquierda = mano.lado === 'left' || (mano.lado !== 'right' && mano.indice === 0);
      mano.grip.getWorldPosition(manoPos);
      // Giro de la muñeca: cuánto se inclina el eje X del mando
      ejeMano.set(1, 0, 0).transformDirection(mano.grip.matrixWorld);
      const giro = Math.atan2(ejeMano.y, Math.hypot(ejeMano.x, ejeMano.z));
      // La mano lleva la empuñadura: acercarla saca la barra hacia ti
      const s = manoPos.z - (Z_CERCA + Z_PUNO);
      for (const i of izquierda ? MANO_IZQ : MANO_DER) {
        barras[i].objetivoS = s;
        barras[i].objetivoPhi = Math.max(-1.6, Math.min(1.6, giro * 1.4));
      }
    }
  }

  // Ratón y dedo: arriba y abajo mueve todas tus barras (el muñeco más cercano de cada una se pone
  // a la altura del puntero); un clic chuta con todas
  let chuteRaton = 0;
  function raton(dt) {
    const r = ctx.raton;
    if (r.rayo.ray.intersectPlane(planoMesa, tmp)) {
      const z = Math.max(Z_LEJOS + RB, Math.min(Z_CERCA - RB, tmp.z)) - Z_CENTRO;
      for (const i of TUYAS) barras[i].objetivoS = z - munecoCercano(barras[i], z);
    }
    if (r.clic) chuteRaton = 0.2;
    chuteRaton = Math.max(0, chuteRaton - dt);
    // Chute: el pie sale hacia delante (+x) y vuelve
    const phi = chuteRaton > 0.08 ? 1.3 : 0;
    for (const i of TUYAS) barras[i].objetivoPhi = phi;
  }
  // El muñeco de la barra que puede llegar a z (relativa al centro) con menos recorrido
  function munecoCercano(barra, z) {
    let mejor = barra.munecos[0];
    for (const mz of barra.munecos) if (Math.abs(z - mz) < Math.abs(z - mejor)) mejor = mz;
    return mejor;
  }

  // ─── La máquina ────────────────────────────────────────────────────────
  function maquina(dt) {
    const rapidez = 0.35 + nivel * 0.1;      // m/s que desliza sus barras
    const reaccion = Math.max(0.03, 0.1 - nivel * 0.01);
    for (const barra of barras) {
      if (barra.equipo !== 1) continue;
      // Pone el muñeco más cercano a la altura de la bola (con algo de retraso y error)
      let mejor = 0;
      let dist = Infinity;
      for (const mz of barra.munecos) {
        const d = Math.abs(Z_CENTRO + mz - (b.z + b.vz * reaccion));
        if (d < dist) { dist = d; mejor = mz; }
      }
      const quiere = b.z + b.vz * reaccion - (Z_CENTRO + mejor) + Math.sin(tiempo * 1.7 + barra.x * 9) * 0.02 * Math.max(0, 5 - nivel);
      const delante = barra.x - b.x;
      // (el portero no persigue una bola que se le ha colado detrás: la metería él mismo)
      const paso = Math.max(-rapidez * dt, Math.min(rapidez * dt, quiere - barra.objetivoS));
      if (barra.munecos.length > 1 || delante > -0.01) barra.objetivoS += paso;
      // Chuta (hacia la izquierda, −x) si la bola está justo delante de un pie suyo
      if (barra.chute <= 0 && delante > 0.005 && delante < 0.06 && Math.abs(b.z - (Z_CENTRO + mejor + barra.s)) < 0.03 && estado === 'juego') {
        barra.chute = 0.3;
        barra.cruce = (Math.random() < 0.5 ? -1 : 1) * Math.min(0.06, 0.01 * nivel + 0.02);
      }
      if (barra.chute > 0) {
        barra.chute -= dt;
        // Pie adelante de golpe y arriba un momento (al volver despacio ya no se lleva la bola)
        barra.objetivoPhi = -1.3;
        if (barra.chute > 0.18) barra.objetivoS += (barra.cruce * dt) / 0.04;
      } else if (delante < 0 && delante > -0.05 && barra.munecos.length > 1) {
        // La bola, justo detrás de sus muñecos (menos el portero): levanta los pies para dejarla pasar
        // hacia su campo
        barra.objetivoPhi = -1.3;
      } else barra.objetivoPhi = 0;
    }
  }

  // Las barras van hacia su objetivo (sin pasar de su recorrido) y se guardan sus velocidades
  function moverBarras(dt) {
    for (const barra of barras) {
      barra.sAntes = barra.s;
      barra.phiAntes = barra.phi;
      const s = Math.max(-barra.recorrido, Math.min(barra.recorrido, barra.objetivoS));
      barra.s += (s - barra.s) * Math.min(1, dt * (barra.equipo === 0 ? 30 : 18));
      // Los de la máquina chutan más fuerte en cada partido, pero vuelven despacio a su sitio
      const rapidezGiro = barra.equipo === 0 ? 35 : Math.abs(barra.objetivoPhi) < Math.abs(barra.phi) ? 6 : Math.min(40, 12 + nivel * 4);
      barra.phi += (barra.objetivoPhi - barra.phi) * Math.min(1, dt * rapidezGiro);
      barra.vs = (barra.s - barra.sAntes) / Math.max(dt, 1e-3);
      barra.w = (barra.phi - barra.phiAntes) / Math.max(dt, 1e-3);
    }
  }

  // ─── Dibujo ────────────────────────────────────────────────────────────
  function dibujar() {
    const cont = [0, 0];
    for (let i = 0; i < barras.length; i++) {
      const barra = barras[i];
      const y = MESA_Y + ALTO_BARRA;
      matrizTmp.makeRotationZ(barra.phi).setPosition(barra.x, y, Z_CENTRO + barra.s);
      barrasMalla.setMatrixAt(i, matrizTmp);
      // La empuñadura sale por tu lado (tus barras) o por el otro (las de la máquina)
      const zPuno = barra.equipo === 0 ? Z_CERCA + Z_PUNO : Z_LEJOS - Z_PUNO;
      matrizTmp.makeRotationZ(barra.phi).setPosition(barra.x, y, zPuno + barra.s);
      punos.setMatrixAt(i, matrizTmp);
      for (const mz of barra.munecos) {
        // Los de la máquina miran hacia el otro lado
        matrizTmp.makeRotationZ(barra.phi);
        if (barra.equipo === 1) matrizTmp.multiply(tmpMatriz.makeRotationY(Math.PI));
        matrizTmp.setPosition(barra.x, y, Z_CENTRO + mz + barra.s);
        equipos[barra.equipo].setMatrixAt(cont[barra.equipo]++, matrizTmp);
      }
    }
    barrasMalla.instanceMatrix.needsUpdate = true;
    punos.instanceMatrix.needsUpdate = true;
    for (const e of equipos) e.instanceMatrix.needsUpdate = true;
    bola.position.set(b.x, MESA_Y + RB, b.z);
    ctx.colocarSombra(sombraBola, bola.position, MESA_Y + 0.001);
    // Cuentas: las de cada equipo, a su lado del alambre según sus goles
    for (let e = 0; e < 2; e++) {
      for (let k = 0; k < GOLES; k++) {
        const marcado = k < goles[e];
        const base = e === 0 ? -0.46 : 0.14;
        const x = base + k * 0.04 + (marcado ? 0.12 : 0);
        matrizTmp.makeTranslation(x, MESA_Y + 0.17, Z_LEJOS - 0.02);
        cuentas.setMatrixAt(e * GOLES + k, matrizTmp);
        cuentas.setColorAt(e * GOLES + k, colorTmp.set(e === 0 ? 0xc62828 : 0x1f5fd1));
      }
    }
    cuentas.instanceMatrix.needsUpdate = true;
    cuentas.instanceColor.needsUpdate = true;
  }

  function actualizarMarcador() {
    const lineas = [{ texto: ctx.t('partida.tanteo', { jugador: goles[0], maquina: goles[1] }), tam: 1.15, color: '#ffffff' }];
    if (tiempoMensaje > 0) lineas.push({ texto: mensaje, tam: 0.72, color: colorMensaje });
    else if (primerGolpe) lineas.push({ texto: ctx.enVR() ? ctx.t('intro') : ctx.t(ctx.tactil ? 'introTactil' : 'introRaton'), tam: 0.6 });
    else lineas.push({ texto: ctx.t('estado', { n: nivel, puntos }), tam: 0.62, color: '#cfd8dc' });
    marcador.escribir(lineas);
  }

  // ─── Bucle ─────────────────────────────────────────────────────────────
  function actualizar(dt) {
    tiempo += dt;
    tiempoMensaje -= dt;
    reloj -= dt;
    if (estado === 'saque' && reloj <= 0) {
      // La bola cae por el centro con un empujoncito hacia un lado
      estado = 'juego';
      b.vx = (Math.random() < 0.5 ? -1 : 1) * (0.15 + Math.random() * 0.2);
      b.vz = (Math.random() - 0.5) * 0.4;
      ctx.sonido('bote');
    }
    if (estado === 'gol' && reloj <= 0) sacar();
    if (estado === 'fin' && reloj <= 0) empezarPartido();
    if (ctx.enVR()) manosVR();
    else raton(dt);
    maquina(dt);
    moverBarras(dt);
    if (estado === 'juego') {
      acumulado += Math.min(dt, 0.05);
      while (acumulado >= PASO && estado === 'juego') {
        moverBola(PASO);
        acumulado -= PASO;
      }
      // Bola muerta: si se queda parada donde nadie llega, se vuelve a sacar
      if (Math.hypot(b.vx, b.vz) < 0.04) quieta += dt;
      else quieta = 0;
      // Y si no avanza ni retrocede (atrapada entre muñecos), también
      if (Math.abs(b.x - xAtasco) > 0.05) {
        xAtasco = b.x;
        atasco = 0;
      } else atasco += dt;
      if (quieta > 1.5 || atasco > 5) {
        decir(ctx.t('bolaMuerta'), '#cfd8dc', 1.2);
        sacar();
      }
    }
    dibujar();
    actualizarMarcador();
  }

  empezarPartido();
  actualizarMarcador();

  return {
    actualizar,
    liberar() {},
  };
}
