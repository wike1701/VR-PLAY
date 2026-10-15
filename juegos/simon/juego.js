// SIMÓN DE COLORES
// Una consola redonda con cuatro teclas de colores en un salón recreativo. La máquina
// enciende una secuencia de colores con su nota; repítela en el mismo orden. Cada vez
// que la aciertas entera se alarga un color y va un poco más rápida. Un error (o
// tardar demasiado) termina la partida. Cada tecla bien pulsada vale 1 punto.
// En VR llevas una baqueta en cada mano y golpeas las teclas; sin gafas, haz clic o toca.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const CONSOLA = new THREE.Vector3(0, 0.98, -0.5);   // centro de la cara de la consola
const INCLINACION = 0.62;                           // hacia el jugador (rad)
const R_CONSOLA = 0.38;
const R_DENTRO = 0.1;                               // radios de las teclas
const R_FUERA = 0.33;
const ALTO_TECLA = 0.026;
const HUECO = THREE.MathUtils.degToRad(3.5);        // separación entre teclas
const LARGO_BAQUETA = 0.3;
const R_CABEZA = 0.026;
const ESPERA_TECLA = 4;                             // segundos para pulsar la siguiente tecla
// Teclas en el orden clásico: verde (arriba izquierda), rojo, amarillo y azul, con sus notas
const TECLAS = [
  { color: 0x1fbf4f, claro: 0x8dffb0, desde: 90, sonido: 'simon0' },
  { color: 0xd8282f, claro: 0xff9a9a, desde: 0, sonido: 'simon1' },
  { color: 0xf0c419, claro: 0xfff1a0, desde: 180, sonido: 'simon2' },
  { color: 0x2462d6, claro: 0x9cc0ff, desde: 270, sonido: 'simon3' },
];

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  // Salón recreativo de noche: oscuro, con neones
  ctx.fondo(0x140c24, { cenit: 0x0a0614, horizonte: 0x23143a, suelo: 0x0d0818, niebla: [8, 18] });
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.58, 0.42), new THREE.Vector3(0, 1.02, -0.75));

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

  // ─── Salón recreativo ──────────────────────────────────────────────────
  ctx.sueloBase(false);
  // Moqueta de recreativa: fondo oscuro con formas de colores
  const texMoqueta = R(ctx.texturaCanvas((g, tam, azar) => {
    g.fillStyle = '#120a22';
    g.fillRect(0, 0, tam, tam);
    const colores = ['#ff3d7f', '#2ee6d6', '#ffd23f', '#7a5cff'];
    for (let i = 0; i < 40; i++) {
      g.strokeStyle = colores[i % 4];
      g.globalAlpha = 0.22 + azar() * 0.22;
      g.lineWidth = 1.5 + azar() * 1.5;
      const x = azar() * tam;
      const y = azar() * tam;
      const r = 4 + azar() * 10;
      g.beginPath();
      if (i % 3 === 0) g.arc(x, y, r, 0, Math.PI * 2);
      else if (i % 3 === 1) { g.moveTo(x - r, y); g.lineTo(x, y - r); g.lineTo(x + r, y); }
      else { g.moveTo(x - r, y - r / 2); g.quadraticCurveTo(x, y + r, x + r, y - r / 2); }
      g.stroke();
    }
    g.globalAlpha = 1;
  }, { tam: 256, repetir: [14, 14], semilla: 31 }));
  const suelo = new THREE.Mesh(R(new THREE.PlaneGeometry(10, 10)), R(new THREE.MeshLambertMaterial({ map: texMoqueta })));
  suelo.rotation.x = -Math.PI / 2;
  raiz.add(suelo);
  // Paredes y techo oscuros
  const matPared = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tela(0x221836, { repetir: [6, 3], semilla: 32 })) }));
  const paredes = new THREE.Mesh(
    fusionar([
      colocar(new THREE.PlaneGeometry(10, 3.2), 0, 1.6, -3.4),
      colocar(new THREE.PlaneGeometry(8, 3.2), -3.4, 1.6, 0.6, 0, Math.PI / 2),
      colocar(new THREE.PlaneGeometry(8, 3.2), 3.4, 1.6, 0.6, 0, -Math.PI / 2),
      colocar(new THREE.PlaneGeometry(10, 8), 0, 3.2, 0.6, Math.PI / 2),
    ]),
    matPared,
  );
  raiz.add(paredes);
  // Tubos de neón en las paredes (brillan solos)
  const neones = [
    [0xff3d7f, [[0, 2.6, -3.38, 6.4, 0.04, 0.04]]],
    [0x2ee6d6, [[0, 2.45, -3.38, 6.4, 0.04, 0.04], [-3.38, 2.5, 0.2, 0.04, 0.04, 6.4], [3.38, 2.5, 0.2, 0.04, 0.04, 6.4]]],
  ];
  for (const [color, piezas] of neones) {
    const malla = new THREE.Mesh(
      fusionar(piezas.map(([x, y, z, ax, ay, az]) => colocar(new THREE.BoxGeometry(ax, ay, az), x, y, z))),
      R(new THREE.MeshBasicMaterial({ color, toneMapped: false })),
    );
    raiz.add(malla);
  }
  // Máquinas recreativas a lo largo de las paredes: mueble, pantalla encendida y cartel
  const PUESTOS = [];
  for (let i = 0; i < 6; i++) PUESTOS.push([-2.5 + i, -3.0, 0]);
  for (let i = 0; i < 3; i++) PUESTOS.push([-3.0, -1.6 + i * 1.1, Math.PI / 2], [3.0, -1.6 + i * 1.1, -Math.PI / 2]);
  const geoMueble = R(fusionar([
    colocar(new THREE.BoxGeometry(0.7, 1.15, 0.7), 0, 0.575, 0),
    colocar(new THREE.BoxGeometry(0.7, 0.55, 0.45), 0, 1.4, -0.12, -0.25),
    colocar(new THREE.BoxGeometry(0.72, 0.22, 0.55), 0, 1.78, -0.05),
    colocar(new THREE.BoxGeometry(0.66, 0.1, 0.3), 0, 1.08, 0.38, 0.35),
  ]));
  const geoPantalla = R(colocar(new THREE.PlaneGeometry(0.52, 0.4), 0, 1.42, 0.112, -0.25));
  const geoCartelMaquina = R(colocar(new THREE.PlaneGeometry(0.62, 0.15), 0, 1.78, 0.226));
  const muebles = new THREE.InstancedMesh(geoMueble, R(new THREE.MeshLambertMaterial({ emissive: 0x0c0818 })), PUESTOS.length);
  const pantallas = new THREE.InstancedMesh(geoPantalla, R(new THREE.MeshBasicMaterial({ toneMapped: false })), PUESTOS.length);
  const carteles = new THREE.InstancedMesh(geoCartelMaquina, R(new THREE.MeshBasicMaterial({ toneMapped: false })), PUESTOS.length);
  const COLORES_PANTALLA = [0x3a7bff, 0xff4f9a, 0x34e29b, 0xffb238, 0x9a6bff, 0x2ee6d6];
  const COLORES_MUEBLE = [0x3b2a6e, 0x6e2440, 0x1f4a6e, 0x2c2c3a];
  const colorTmp = new THREE.Color();
  const giroTmp = new THREE.Quaternion();
  const escalaUno = new THREE.Vector3(1, 1, 1);
  const posTmp = new THREE.Vector3();
  PUESTOS.forEach(([x, z, giro], i) => {
    matrizTmp.compose(posTmp.set(x, 0, z), giroTmp.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, giro), escalaUno);
    muebles.setMatrixAt(i, matrizTmp);
    pantallas.setMatrixAt(i, matrizTmp);
    carteles.setMatrixAt(i, matrizTmp);
    pantallas.setColorAt(i, colorTmp.set(COLORES_PANTALLA[i % COLORES_PANTALLA.length]).multiplyScalar(0.75));
    carteles.setColorAt(i, colorTmp.set(COLORES_PANTALLA[(i + 3) % COLORES_PANTALLA.length]));
    muebles.setColorAt(i, colorTmp.set(COLORES_MUEBLE[i % COLORES_MUEBLE.length]));
  });
  raiz.add(muebles, pantallas, carteles);
  const sombrasMaquinas = PUESTOS.map(([x, z]) => {
    const s = ctx.crearSombra({ radio: 0.55, opacidad: 0.45 });
    s.position.set(x, 0.004, z);
    return s;
  });
  raiz.add(...sombrasMaquinas);

  // ─── Consola ───────────────────────────────────────────────────────────
  // Pedestal de la consola
  const matCarcasa = R(new THREE.MeshPhongMaterial({ color: 0x23232a, shininess: 60, specular: 0x444455 }));
  const pedestal = new THREE.Mesh(
    fusionar([
      colocar(new THREE.CylinderGeometry(0.07, 0.09, CONSOLA.y - 0.12, 20), CONSOLA.x, (CONSOLA.y - 0.12) / 2, CONSOLA.z),
      colocar(new THREE.CylinderGeometry(0.3, 0.34, 0.05, 32), CONSOLA.x, 0.025, CONSOLA.z),
    ]),
    matCarcasa,
  );
  raiz.add(pedestal);
  const sombraPedestal = ctx.crearSombra({ radio: 0.45, opacidad: 0.5 });
  sombraPedestal.position.set(CONSOLA.x, 0.004, CONSOLA.z);
  raiz.add(sombraPedestal);

  // La cara de la consola mira hacia +Y en su espacio; el grupo se inclina hacia el jugador
  const consola = new THREE.Group();
  consola.position.copy(CONSOLA);
  consola.rotation.x = INCLINACION;
  raiz.add(consola);
  const carcasa = new THREE.Mesh(
    fusionar([
      colocar(new THREE.CylinderGeometry(R_CONSOLA, R_CONSOLA - 0.02, 0.08, 48), 0, -0.04, 0),
      colocar(new THREE.TorusGeometry(R_CONSOLA - 0.004, 0.012, 8, 48), 0, 0, 0, Math.PI / 2),
      colocar(new THREE.CylinderGeometry(R_DENTRO - 0.012, R_DENTRO - 0.012, 0.05, 32), 0, 0.02, 0),
    ]),
    matCarcasa,
  );
  consola.add(carcasa);
  // Centro: un disco plateado con un aro coral
  const centro = new THREE.Mesh(R(new THREE.CircleGeometry(R_DENTRO - 0.03, 32)), R(new THREE.MeshPhongMaterial({ color: 0xc9ccd6, shininess: 90 })));
  centro.rotation.x = -Math.PI / 2;
  centro.position.y = 0.0455;
  const aroCentro = new THREE.Mesh(R(new THREE.RingGeometry(R_DENTRO - 0.03, R_DENTRO - 0.018, 32)), R(new THREE.MeshBasicMaterial({ color: 0xff6a3d, toneMapped: false })));
  aroCentro.rotation.x = -Math.PI / 2;
  aroCentro.position.y = 0.046;
  consola.add(centro, aroCentro);

  // Teclas: un sector de corona extruido con bisel, cada una de su color
  const teclas = TECLAS.map((def, i) => {
    const a0 = THREE.MathUtils.degToRad(def.desde) + HUECO;
    const a1 = THREE.MathUtils.degToRad(def.desde + 90) - HUECO;
    const forma = new THREE.Shape();
    forma.absarc(0, 0, R_FUERA, a0, a1, false);
    forma.absarc(0, 0, R_DENTRO, a1, a0, true);
    forma.closePath();
    const geo = R(new THREE.ExtrudeGeometry(forma, {
      depth: ALTO_TECLA - 0.008, bevelEnabled: true, bevelThickness: 0.006, bevelSize: 0.006, bevelSegments: 3, curveSegments: 24,
    }));
    // La forma está en XY (con +Y hacia el fondo) y se extruye en +Z: se tumba para que suba en +Y
    geo.rotateX(-Math.PI / 2);
    // Apagada, el color es oscuro; al encenderse brilla con su tono claro
    const material = R(new THREE.MeshStandardMaterial({ color: new THREE.Color(def.color).multiplyScalar(0.45), emissive: def.claro, emissiveIntensity: 0.04, roughness: 0.3, metalness: 0.05 }));
    const malla = new THREE.Mesh(geo, material);
    malla.position.y = 0.006;
    malla.userData.tecla = i;
    consola.add(malla);
    // Centro de la tecla (para los efectos)
    const am = (a0 + a1) / 2;
    const rm = (R_DENTRO + R_FUERA) / 2;
    return { ...def, malla, material, luz: 0, pulsada: 0, centro: new THREE.Vector3(Math.cos(am) * rm, ALTO_TECLA + 0.02, -Math.sin(am) * rm) };
  });
  const mallasTeclas = teclas.map((t) => t.malla);

  // ─── Baquetas ──────────────────────────────────────────────────────────
  // Mango de madera con empuñadura de goma y cabeza de fieltro coral (a lo largo de -Z)
  const geoMango = R(colocar(new THREE.CylinderGeometry(0.007, 0.009, LARGO_BAQUETA, 12), 0, 0, -LARGO_BAQUETA / 2 + 0.04, -Math.PI / 2));
  const geoEmpunadura = R(colocar(new THREE.CylinderGeometry(0.012, 0.012, 0.09, 14), 0, 0, 0.0, -Math.PI / 2));
  const geoCabeza = R(new THREE.SphereGeometry(R_CABEZA, 18, 12));
  const matMango = R(new THREE.MeshStandardMaterial({ map: R(ctx.texturas.madera(0xd8b07a, { tam: 128, semilla: 33 })), roughness: 0.5 }));
  const matCabeza = R(new THREE.MeshStandardMaterial({ color: 0xff6a3d, roughness: 0.85 }));
  function crearBaqueta() {
    const baqueta = new THREE.Group();
    const empunadura = new THREE.Mesh(geoEmpunadura, matCarcasa);
    const mango = new THREE.Mesh(geoMango, matMango);
    const cabeza = new THREE.Mesh(geoCabeza, matCabeza);
    cabeza.position.z = -LARGO_BAQUETA + 0.04;
    baqueta.add(empunadura, mango, cabeza);
    return baqueta;
  }
  // En la mano, la baqueta sale del puño hacia arriba, a lo largo del mando (-Z del agarre),
  // como la katana de Corta Fruta o el matamoscas: así se golpea de arriba abajo
  const PUNTA_EN_MANO = new THREE.Vector3(0, 0, -(LARGO_BAQUETA - 0.04) - 0.02);
  const baquetas = ctx.manos.map((mano) => {
    const objeto = crearBaqueta();
    objeto.position.set(0, 0, -0.02);
    ctx.adjuntarAMano(mano, objeto);
    return { mano, punta: new THREE.Vector3(), listo: false };
  });

  // Baqueta del ratón: flota sobre la tecla apuntada y golpea al hacer clic
  const baquetaRaton = crearBaqueta();
  raiz.add(baquetaRaton);
  const planoConsola = new THREE.Plane();
  const normalConsola = new THREE.Vector3(0, Math.cos(INCLINACION), Math.sin(INCLINACION));
  planoConsola.setFromNormalAndCoplanarPoint(normalConsola, new THREE.Vector3().copy(CONSOLA).addScaledVector(normalConsola, ALTO_TECLA + R_CABEZA));
  const puntoRaton = new THREE.Vector3().copy(CONSOLA);
  let golpeRaton = 0;

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.0, alto: 0.3 });
  marcador.mesh.position.set(0, 1.5, -1.3);
  marcador.mesh.rotation.x = -0.1;
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'muestra' | 'turno' | 'bien' | 'fin'
  let reloj = 3;
  const secuencia = [];
  let paso = 0;           // posición dentro de la secuencia (al mostrarla y al repetirla)
  let encendida = false;  // durante la muestra: tecla encendida o pausa entre teclas
  let puntos = 0;
  let record = ctx.leer('record', 0);
  let espera = ESPERA_TECLA;
  let parpadeo = 0;       // al fallar, todas las teclas parpadean

  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();

  const tiempoEncendida = () => Math.max(0.2, 0.45 - secuencia.length * 0.014);
  const tiempoApagada = () => tiempoEncendida() * 0.45;

  function actualizarMarcador() {
    if (estado === 'intro') {
      const intro = ctx.enVR() ? ctx.t('intro') : ctx.t(ctx.tactil ? 'introTactil' : 'introRaton');
      marcador.escribir([
        { texto: ctx.t('titulo'), tam: 1.3, color: '#b39dff' },
        { texto: intro, tam: 0.72 },
      ]);
    } else if (estado === 'fin') {
      marcador.escribir([
        { texto: ctx.t('partida.finPuntos', { n: puntos }), tam: 1.3, color: '#b39dff' },
        { texto: ctx.t('partida.recordNuevaPartida', { record, n: Math.max(1, Math.ceil(reloj)) }), tam: 0.72 },
      ]);
    } else {
      const linea = estado === 'turno' ? ctx.t('tuTurno') : estado === 'bien' ? ctx.t('bien') : ctx.t('mira');
      marcador.escribir([
        { texto: ctx.t('marcador', { nivel: secuencia.length, puntos }), tam: 1.2 },
        { texto: linea, tam: 0.8, color: estado === 'turno' ? '#8dffb0' : '#ffe0b2' },
      ]);
    }
  }

  // Enciende una tecla con su nota
  function encender(i, fuerza = 1) {
    const t = teclas[i];
    t.luz = fuerza;
    ctx.sonido(t.sonido);
  }

  function nuevaRonda() {
    secuencia.push(Math.floor(Math.random() * 4));
    estado = 'muestra';
    paso = 0;
    encendida = false;
    reloj = 0.6;
  }

  function empezarPartida() {
    secuencia.length = 0;
    puntos = 0;
    nuevaRonda();
  }

  function terminar() {
    estado = 'fin';
    reloj = 5;
    parpadeo = 0.9;
    ctx.sonido('zumbador');
    ctx.puntuacion(puntos); // a la clasificación (juegos/marcadores.js)
    if (puntos > record) {
      record = puntos;
      ctx.guardar('record', record);
    }
  }

  // El jugador pulsa la tecla i
  function pulsar(i, mano) {
    const t = teclas[i];
    t.pulsada = 0.12;
    if (estado !== 'turno') {
      // Fuera de su turno solo suena, para que se note que la tecla responde
      encender(i, 0.6);
      ctx.vibrar(mano, 0.2, 20);
      return;
    }
    consola.localToWorld(tmp.copy(t.centro));
    if (i !== secuencia[paso]) {
      t.luz = 1;
      ctx.vibrar(mano, 0.8, 220);
      terminar();
      return;
    }
    t.luz = 1;
    puntos += 1;
    paso += 1;
    espera = ESPERA_TECLA;
    ctx.efectos.impacto('pequeño', { pos: tmp, mano, color: t.claro, sonido: t.sonido });
    ctx.efectos.texto(tmp, '+1', { color: '#ffffff', tam: 0.8 });
    if (paso >= secuencia.length) {
      // Secuencia completa: celebración proporcional (cada 5 niveles, más grande)
      estado = 'bien';
      reloj = 0.9;
      const hito = secuencia.length % 5 === 0;
      consola.localToWorld(tmp2.set(0, 0.12, 0));
      ctx.efectos.impacto(hito ? 'grande' : 'medio', { pos: tmp2, mano, color: hito ? 0xffd54f : 0xb39dff, sonido: 'punto' });
      ctx.efectos.texto(tmp2, ctx.t('nivel', { n: secuencia.length }), { color: hito ? '#ffd54f' : '#e1d6ff', tam: hito ? 1.3 : 1 });
    }
  }

  // ─── Baquetas VR ───────────────────────────────────────────────────────
  function golpesVR() {
    consola.updateMatrixWorld();
    const techo = ALTO_TECLA + 0.006 + R_CABEZA; // altura de la cabeza al tocar la tecla
    for (const b of baquetas) {
      if (!b.mano.activa) {
        b.listo = false;
        continue;
      }
      b.mano.grip.localToWorld(b.punta.copy(PUNTA_EN_MANO));
      consola.worldToLocal(tmp.copy(b.punta));
      // Se rearma al levantar la baqueta por encima de las teclas
      if (tmp.y > techo + 0.025) {
        b.listo = true;
        continue;
      }
      if (!b.listo || tmp.y < techo - 0.08) continue;
      const r = Math.hypot(tmp.x, tmp.z);
      if (r < R_DENTRO - 0.01 || r > R_FUERA + 0.015) continue;
      // Ángulo en el plano de la forma (con +Y hacia el fondo de la consola)
      let a = THREE.MathUtils.radToDeg(Math.atan2(-tmp.z, tmp.x));
      if (a < 0) a += 360;
      const i = teclas.findIndex((t) => a >= t.desde && a < t.desde + 90);
      if (i < 0) continue;
      b.listo = false;
      pulsar(i, b.mano);
    }
  }

  // ─── Ratón y pantalla táctil ───────────────────────────────────────────
  function raton(dt) {
    const r = ctx.raton;
    baquetaRaton.visible = r.dentro || ctx.tactil;
    if (r.rayo.ray.intersectPlane(planoConsola, tmp)) puntoRaton.copy(tmp);
    if (r.clic) {
      golpeRaton = 0.16;
      const choque = r.rayo.intersectObjects(mallasTeclas, false)[0];
      if (choque) pulsar(choque.object.userData.tecla, null);
    }
    golpeRaton = Math.max(0, golpeRaton - dt);
    // La cabeza baja hasta la tecla y vuelve a subir; el mango apunta hacia el jugador
    const bajada = golpeRaton > 0.1 ? (0.16 - golpeRaton) / 0.06 : golpeRaton / 0.1;
    const elevacion = 0.08 * (1 - bajada);
    tmp.copy(puntoRaton).addScaledVector(normalConsola, elevacion); // cabeza
    tmp2.set(puntoRaton.x * 0.6 + 0.12, puntoRaton.y + 0.22 + elevacion, puntoRaton.z + 0.2); // mano
    baquetaRaton.position.copy(tmp).sub(tmp2).setLength(LARGO_BAQUETA - 0.04).negate().add(tmp);
    baquetaRaton.lookAt(tmp2.copy(baquetaRaton.position).multiplyScalar(2).sub(tmp));
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function actualizar(dt) {
    reloj -= dt;
    if (estado === 'intro' && reloj <= 0) {
      empezarPartida();
    } else if (estado === 'muestra' && reloj <= 0) {
      if (encendida) {
        encendida = false;
        paso += 1;
        if (paso >= secuencia.length) {
          estado = 'turno';
          paso = 0;
          espera = ESPERA_TECLA;
        } else {
          reloj = tiempoApagada();
        }
      } else {
        encendida = true;
        encender(secuencia[paso]);
        reloj = tiempoEncendida();
      }
    } else if (estado === 'turno') {
      espera -= dt;
      if (espera <= 0) {
        ctx.vibrar(baquetas.find((b) => b.mano.activa)?.mano || null, 0.8, 220);
        terminar();
      }
    } else if (estado === 'bien' && reloj <= 0) {
      nuevaRonda();
    } else if (estado === 'fin' && reloj <= 0) {
      empezarPartida();
    }

    // Luz y hundimiento de cada tecla
    parpadeo = Math.max(0, parpadeo - dt);
    const todas = parpadeo > 0 && Math.floor(parpadeo * 7) % 2 === 0;
    for (const t of teclas) {
      // Durante la muestra la tecla se queda encendida mientras dura su nota
      const mostrando = estado === 'muestra' && encendida && secuencia[paso] === teclas.indexOf(t);
      if (!mostrando) t.luz = Math.max(0, t.luz - dt * 5);
      const luz = todas ? 0.8 : t.luz;
      t.material.emissiveIntensity = 0.04 + luz * 1.1;
      t.pulsada = Math.max(0, t.pulsada - dt);
      t.malla.position.y = 0.006 - (t.pulsada > 0 || mostrando ? 0.008 : 0);
    }

    if (ctx.enVR()) {
      baquetaRaton.visible = false;
      golpesVR();
    } else {
      raton(dt);
    }
    actualizarMarcador();
  }

  actualizarMarcador();

  return {
    actualizar,
    liberar() {},
  };
}
