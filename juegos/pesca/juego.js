// PESCA EN EL LAGO
// Un embarcadero de madera en un lago de montaña al amanecer. Lanza el corcho, espera a
// que un pez pique (el corcho se hunde de golpe) y tira para clavarlo. Después recoge el
// sedal, pero cuando el pez tira (el sedal se tensa y salpica) deja de recoger o se rompe.
// Tienes 90 segundos. Cada pez vale 10 puntos por kilo: perca, trucha, carpa, lucio y,
// muy de vez en cuando, la carpa dorada.
// En VR: la caña va en la mano; para lanzar, aprieta el gatillo, echa la caña hacia
// delante y suéltalo. Para clavar, tira de la caña hacia arriba (o gatillo). Para
// recoger, mantén el gatillo. Sin gafas: clic en el agua para lanzar, clic para clavar y
// mantener pulsado para recoger.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código.
export async function precargar() {}

const AGUA_Y = -0.35;
const DURACION = 90;
const LARGO_CANA = 1.5;
const N_PECES = 6;
const VENTANA = 0.9;            // segundos para clavar tras la picada
const ESPECIES = [
  { id: 'perca', kg: [0.6, 1.4], fuerza: 0.6, color: 0x7a8a3a, prob: 0.34 },
  { id: 'trucha', kg: [1.2, 2.8], fuerza: 0.8, color: 0x9aa8b8, prob: 0.3 },
  { id: 'carpa', kg: [2.5, 5.5], fuerza: 1.0, color: 0xa87a3a, prob: 0.2 },
  { id: 'lucio', kg: [4, 9], fuerza: 1.35, color: 0x4a6a3a, prob: 0.12 },
  { id: 'dorada', kg: [8, 12], fuerza: 1.2, color: 0xffc83a, prob: 0.04 },
];

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (r) => ctx.recurso(r);

  ctx.fondo(0xf3c79a, {
    cenit: 0x6f9ccc, horizonte: 0xffd2a8, nubes: 0.4, sol: [0.3, 0.12, -1], niebla: [25, 110],
    paisaje: { tipo: 'montes', color: 0x5a7066, radio: 90 },
  });
  ctx.sueloBase(false);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.6, 0.6), new THREE.Vector3(0, 0.2, -5));

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

  // ─── El lago ───────────────────────────────────────────────────────────
  const texAgua = R(ctx.texturaCanvas((g, tam, azar) => {
    g.fillStyle = '#3c6f86';
    g.fillRect(0, 0, tam, tam);
    for (let i = 0; i < 140; i++) {
      g.strokeStyle = azar() < 0.5 ? 'rgba(255,230,200,0.22)' : 'rgba(20,50,70,0.25)';
      g.lineWidth = 1 + azar() * 2;
      const x = azar() * tam;
      const y = azar() * tam;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 8, y - 3, x + 16 + azar() * 10, y);
      g.stroke();
    }
  }, { tam: 256, repetir: [24, 24], semilla: 101 }));
  const agua = new THREE.Mesh(R(new THREE.PlaneGeometry(120, 120)), R(new THREE.MeshStandardMaterial({ map: texAgua, color: 0xa8d0e0, roughness: 0.15, metalness: 0.3 })));
  agua.rotation.x = -Math.PI / 2;
  agua.position.y = AGUA_Y;
  raiz.add(agua);
  // Orillas con pinos alrededor
  const orilla = new THREE.Mesh(fusionar([
    colocar(new THREE.CylinderGeometry(40, 46, 0.6, 48, 1, true), 0, AGUA_Y, 0),
    colocar(new THREE.RingGeometry(36, 60, 48), 0, AGUA_Y + 0.3, 0, -Math.PI / 2),
  ]), R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.cesped(0x5d8a48, { repetir: [40, 4], semilla: 102 })), side: THREE.DoubleSide })));
  raiz.add(orilla);
  const pinos = [];
  for (let i = 0; i < 46; i++) {
    const a = (i / 46) * Math.PI * 2 + Math.sin(i * 3.1) * 0.05;
    const r = 37 + (i % 3) * 2.5;
    if (Math.sin(a) > 0.6) continue; // detrás del jugador, menos
    pinos.push({ x: Math.cos(a) * r, z: Math.sin(a) * r, escala: 1.6 + (i % 4) * 0.35 });
  }
  const bosque = ctx.arboles(pinos, { tipo: 'pino' });
  bosque.position.y = AGUA_Y + 0.3;
  raiz.add(bosque);
  // Embarcadero
  const matTablas = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tablas(0x9a7048, { tablas: 8, repetir: [1, 3], semilla: 103 })) }));
  const embarcadero = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(1.8, 0.08, 5), 0, -0.04, 1.6),
    ...[[-0.85, -0.85], [0.85, -0.85], [-0.85, 1.5], [0.85, 1.5], [-0.85, 3.8], [0.85, 3.8]].map(([x, z]) => colocar(new THREE.CylinderGeometry(0.07, 0.08, 1.4, 10), x, -0.5, z)),
    colocar(new THREE.BoxGeometry(0.4, 0.3, 0.3), 0.6, 0.15, 0.4),
  ]), matTablas);
  raiz.add(embarcadero);
  // Cubo para los peces y una barca amarrada
  const cubo = new THREE.Mesh(R(new THREE.CylinderGeometry(0.16, 0.13, 0.28, 18, 1, true)), R(new THREE.MeshLambertMaterial({ color: 0x5b7fa8, side: THREE.DoubleSide })));
  cubo.position.set(-0.55, 0.14, 0.2);
  raiz.add(cubo);
  const sombraCubo = ctx.crearSombra({ radio: 0.2, opacidad: 0.4 });
  sombraCubo.position.set(-0.55, 0.004, 0.2);
  raiz.add(sombraCubo);
  const barca = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(1.0, 0.3, 2.6), 2.2, AGUA_Y + 0.1, 2.0),
    colocar(new THREE.BoxGeometry(0.9, 0.05, 0.3), 2.2, AGUA_Y + 0.25, 1.6),
  ]), R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tablas(0xb04a32, { tablas: 4, semilla: 104 })) })));
  raiz.add(barca);
  // Juncos en la orilla cercana
  const juncos = [];
  for (let i = 0; i < 40; i++) juncos.push(colocar(new THREE.CylinderGeometry(0.008, 0.012, 0.9 + (i % 5) * 0.12, 5), -2.5 - (i % 7) * 0.25 + Math.sin(i) * 0.2, AGUA_Y + 0.45, 1 + (i % 9) * 0.35, Math.sin(i * 2) * 0.15, 0, Math.cos(i * 3) * 0.15));
  raiz.add(new THREE.Mesh(fusionar(juncos), R(new THREE.MeshLambertMaterial({ color: 0x6f8a3a, flatShading: true }))));

  // ─── Peces (sombras bajo el agua) ──────────────────────────────────────
  const geoSombraPez = R(new THREE.CircleGeometry(1, 16));
  geoSombraPez.rotateX(-Math.PI / 2);
  geoSombraPez.scale(0.12, 1, 0.35);
  const peces = Array.from({ length: N_PECES }, (_, i) => {
    const m = new THREE.Mesh(geoSombraPez, R(new THREE.MeshBasicMaterial({ color: 0x0c2230, transparent: true, opacity: 0.45, depthWrite: false })));
    m.position.set((Math.random() - 0.5) * 10, AGUA_Y - 0.05, -3 - Math.random() * 8);
    raiz.add(m);
    return { malla: m, rumbo: Math.random() * 6.28, vel: 0.4 + Math.random() * 0.3, objetivo: null, i };
  });
  // Pez que sale del agua al pescarlo
  const perfilPez = [];
  for (let k = 0; k <= 10; k++) {
    const a = (k / 10) * Math.PI;
    perfilPez.push(new THREE.Vector2(Math.max(0.0001, Math.sin(a) * 0.07 * (1 - 0.3 * (k / 10))), -Math.cos(a) * 0.22));
  }
  const geoPez = R(fusionar([
    colocar(new THREE.LatheGeometry(perfilPez, 14), 0, 0, 0, Math.PI / 2),
    colocar(new THREE.ConeGeometry(0.07, 0.12, 4), 0, 0, 0.26, -Math.PI / 2, 0, Math.PI / 4),
    colocar(new THREE.ConeGeometry(0.035, 0.1, 4), 0, 0.07, 0.02, 0, 0, 0),
  ]));
  geoPez.scale(1, 1, 1);
  const matPez = R(new THREE.MeshStandardMaterial({ color: 0x9aa8b8, roughness: 0.3, metalness: 0.4 }));
  const pezSale = new THREE.Mesh(geoPez, matPez);
  pezSale.visible = false;
  raiz.add(pezSale);

  // ─── Caña, corcho y sedal ──────────────────────────────────────────────
  const matCorcho = R(new THREE.MeshStandardMaterial({ color: 0xc89a6a, roughness: 0.9 }));
  const matFibra = R(new THREE.MeshStandardMaterial({ color: 0x1c2a3a, roughness: 0.3, metalness: 0.3 }));
  const matMetal = R(new THREE.MeshStandardMaterial({ color: 0xc9ced4, roughness: 0.25, metalness: 0.9 }));
  const geoMango = R(new THREE.CylinderGeometry(0.016, 0.014, 0.3, 12));
  geoMango.rotateX(-Math.PI / 2);
  const geoVara = R(new THREE.CylinderGeometry(0.003, 0.009, LARGO_CANA - 0.25, 8));
  geoVara.rotateX(-Math.PI / 2);
  const geoCarrete = R(fusionar([
    colocar(new THREE.CylinderGeometry(0.03, 0.03, 0.03, 16), 0, -0.05, 0, 0, 0, Math.PI / 2),
    colocar(new THREE.TorusGeometry(0.03, 0.005, 6, 16), 0.016, -0.05, 0, 0, Math.PI / 2),
    colocar(new THREE.BoxGeometry(0.01, 0.04, 0.01), 0, -0.022, 0),
    colocar(new THREE.CylinderGeometry(0.004, 0.004, 0.04, 6), 0.03, -0.05, 0.015, 0, 0, Math.PI / 2),
  ]));
  const geoAnilla = R(new THREE.TorusGeometry(0.007, 0.0015, 4, 10));
  function crearCana() {
    const cana = new THREE.Group();
    const mango = new THREE.Mesh(geoMango, matCorcho);
    const vara = new THREE.Mesh(geoVara, matFibra);
    vara.position.z = -0.15 - (LARGO_CANA - 0.25) / 2;
    const carrete = new THREE.Mesh(geoCarrete, matMetal);
    carrete.position.z = -0.02;
    cana.add(mango, vara, carrete);
    for (let k = 0; k < 4; k++) {
      const a = new THREE.Mesh(geoAnilla, matMetal);
      a.position.set(0, -0.012, -0.35 - k * 0.27);
      cana.add(a);
    }
    return cana;
  }
  const PUNTA = new THREE.Vector3(0, 0, -0.15 - (LARGO_CANA - 0.25));
  const canasVR = ctx.manos.map((mano) => {
    const c = crearCana();
    c.rotation.x = 0.35; // la caña sale hacia arriba
    c.visible = false;
    ctx.adjuntarAMano(mano, c);
    return c;
  });
  const canaRaton = crearCana();
  canaRaton.position.set(0.28, 1.0, 0.05);
  raiz.add(canaRaton);
  const corcho = new THREE.Group();
  const corchoArriba = new THREE.Mesh(R(new THREE.SphereGeometry(0.035, 14, 10, 0, Math.PI * 2, 0, Math.PI / 2)), R(new THREE.MeshStandardMaterial({ color: 0xff6a3d, roughness: 0.4, emissive: 0xff6a3d, emissiveIntensity: 0.2 })));
  const corchoAbajo = new THREE.Mesh(R(new THREE.SphereGeometry(0.035, 14, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2)), R(new THREE.MeshLambertMaterial({ color: 0xf6f3ea })));
  const antena = new THREE.Mesh(R(new THREE.CylinderGeometry(0.004, 0.004, 0.07, 6)), R(new THREE.MeshBasicMaterial({ color: 0xff6a3d, toneMapped: false })));
  antena.position.y = 0.06;
  corcho.add(corchoArriba, corchoAbajo, antena);
  corcho.visible = false;
  raiz.add(corcho);
  // Sedal: una línea de varios puntos que cuelga
  const N_SEDAL = 12;
  const posSedal = new Float32Array(N_SEDAL * 3);
  const geoSedal = R(new THREE.BufferGeometry());
  geoSedal.setAttribute('position', new THREE.BufferAttribute(posSedal, 3));
  const sedal = new THREE.Line(geoSedal, R(new THREE.LineBasicMaterial({ color: 0xf2f2f2, transparent: true, opacity: 0.8 })));
  sedal.frustumCulled = false;
  sedal.visible = false;
  raiz.add(sedal);
  // Ondas en el agua al caer el corcho y al picar
  const N_ONDAS = 4;
  const ondas = Array.from({ length: N_ONDAS }, () => {
    const m = new THREE.Mesh(R(new THREE.RingGeometry(0.9, 1, 32)), R(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0, depthWrite: false })));
    m.rotation.x = -Math.PI / 2;
    m.visible = false;
    raiz.add(m);
    return { malla: m, vida: 0 };
  });
  let siguienteOnda = 0;

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.1, alto: 0.32 });
  marcador.mesh.position.set(-0.9, 1.7, -1.8);
  marcador.mesh.rotation.y = 0.35;
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  // fase: 'listo' (corcho recogido) | 'lanzando' | 'espera' | 'picada' | 'lucha' | 'sacando'
  let estado = 'intro';
  let fase = 'listo';
  let reloj = 3;
  let restante = DURACION;
  let puntos = 0;
  let capturas = 0;
  let record = ctx.leer('record', 0);
  let aviso = '';
  let tiempoAviso = 0;
  let manoCana = null;           // mano que lleva la caña (VR)
  let cargando = false;          // gatillo apretado preparando el lanzamiento
  let esperaPicada = 0;
  let mordiscos = 0;
  let pezActual = null;
  let especie = null;
  let kilos = 0;
  let tension = 0;
  let distancia = 0;             // del corcho al embarcadero durante la lucha
  let tira = 0;                  // segundos que le quedan al pez tirando
  let descanso = 0;
  let salida = 0;
  let sonidoCarrete = 0;
  const velCorcho = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const puntaMundo = new THREE.Vector3();
  const historial = Array.from({ length: 6 }, () => new THREE.Vector3());
  let nHist = 0;
  const planoAgua = new THREE.Plane(new THREE.Vector3(0, 1, 0), -AGUA_Y);
  const ORIGEN = new THREE.Vector3(0, AGUA_Y, -0.9); // donde acaba el sedal al recoger

  function onda(x, z, fuerza = 1) {
    const o = ondas[siguienteOnda];
    siguienteOnda = (siguienteOnda + 1) % N_ONDAS;
    o.malla.position.set(x, AGUA_Y + 0.005, z);
    o.malla.visible = true;
    o.vida = 1;
    o.malla.userData.fuerza = fuerza;
  }

  function empezarPartida() {
    puntos = 0;
    capturas = 0;
    restante = DURACION;
    recoger();
    estado = 'juego';
  }

  function recoger() {
    fase = 'listo';
    corcho.visible = false;
    sedal.visible = false;
    pezActual = null;
    tension = 0;
    ctx.bloquearCambio(false);
  }

  function terminar() {
    estado = 'fin';
    reloj = 6;
    recoger();
    ctx.sonido('fin');
    ctx.puntuacion(puntos); // a la clasificación (juegos/marcadores.js)
    if (puntos > record) {
      record = puntos;
      ctx.guardar('record', record);
    }
  }

  function lanzar(vel) {
    fase = 'lanzando';
    corcho.visible = true;
    sedal.visible = true;
    corcho.position.copy(puntaMundo);
    velCorcho.copy(vel);
    ctx.sonido('zas');
  }

  function elegirEspecie() {
    let r = Math.random();
    for (const e of ESPECIES) {
      if (r < e.prob) return e;
      r -= e.prob;
    }
    return ESPECIES[0];
  }

  function clavar(mano) {
    fase = 'lucha';
    especie = elegirEspecie();
    kilos = especie.kg[0] + Math.random() * (especie.kg[1] - especie.kg[0]);
    tension = 0.25;
    distancia = Math.hypot(corcho.position.x - ORIGEN.x, corcho.position.z - ORIGEN.z);
    tira = 0.6;
    descanso = 0;
    ctx.bloquearCambio(true);
    ctx.efectos.impacto('medio', { pos: corcho.position, mano, color: 0xffffff, sonido: 'picada' });
    aviso = ctx.t('clavado');
    tiempoAviso = 1.2;
  }

  function sacarPez(mano) {
    fase = 'sacando';
    salida = 1.3;
    pezActual = null;
    const valor = Math.round(kilos * 10);
    puntos += valor;
    capturas += 1;
    pezSale.visible = true;
    matPez.color.setHex(especie.color);
    matPez.emissive.setHex(especie.id === 'dorada' ? 0x6a4400 : 0x000000);
    pezSale.scale.setScalar(0.7 + kilos * 0.09);
    tmp.set(corcho.position.x, 0.4, corcho.position.z);
    const nivel = especie.id === 'dorada' || kilos > 6 ? 'grande' : kilos > 2.5 ? 'medio' : 'pequeño';
    ctx.efectos.impacto(nivel, { pos: tmp, mano, color: especie.color, sonido: 'chapuzon' });
    ctx.efectos.texto(tmp, `+${valor}`, { color: '#ffe08a', tam: nivel === 'grande' ? 1.4 : 1 });
    aviso = ctx.t('pez', { pez: ctx.t(`peces.${especie.id}`), kg: kilos.toFixed(1) });
    tiempoAviso = 2.2;
    corcho.visible = false;
    sedal.visible = false;
    ctx.bloquearCambio(false);
  }

  function perderPez(texto) {
    aviso = texto;
    tiempoAviso = 1.6;
    ctx.sonido('cadenaRota');
    ctx.vibrar(manoCana, 0.7, 180);
    recoger();
  }

  function actualizarMarcador() {
    if (estado === 'intro') {
      const intro = ctx.enVR() ? ctx.t('intro') : ctx.t(ctx.tactil ? 'introTactil' : 'introRaton');
      marcador.escribir([
        { texto: ctx.t('titulo'), tam: 1.3, color: '#ffd27a' },
        { texto: intro, tam: 0.66 },
      ]);
      return;
    }
    if (estado === 'fin') {
      marcador.escribir([
        { texto: ctx.t('fin', { n: puntos, peces: capturas }), tam: 1.1, color: '#ffd27a' },
        { texto: ctx.t('partida.recordNuevaPartida', { record, n: Math.max(1, Math.ceil(reloj)) }), tam: 0.72 },
      ]);
      return;
    }
    let linea;
    let color = '#cfd8dc';
    if (tiempoAviso > 0) {
      linea = aviso;
      color = '#ffe08a';
    } else if (fase === 'lucha') {
      const llenas = Math.round(tension * 10);
      linea = ctx.t('tension', { barra: '▮'.repeat(llenas) + '▯'.repeat(10 - llenas) });
      color = tension > 0.75 ? '#ff8a65' : '#cfd8dc';
    } else if (fase === 'picada') {
      linea = ctx.t(ctx.enVR() ? 'tiraVR' : 'tiraRaton');
      color = '#ffe08a';
    } else if (fase === 'espera') {
      linea = ctx.t('espera');
    } else {
      linea = ctx.t(ctx.enVR() ? 'lanzaVR' : 'lanzaRaton');
    }
    marcador.escribir([
      { texto: ctx.t('partida.puntosTiempo', { puntos, s: Math.max(0, Math.ceil(restante)) }), tam: 1.15 },
      { texto: linea, tam: 0.78, color },
    ]);
  }

  // ─── Entrada ───────────────────────────────────────────────────────────
  function entradaVR(dt) {
    // La caña va en la última mano que ha apretado el gatillo
    for (const m of ctx.manos) if (m.activa && m.gatilloPulsado && fase === 'listo') manoCana = m;
    if (!manoCana || !manoCana.activa) manoCana = ctx.manos.find((m) => m.activa) || null;
    canasVR.forEach((c, k) => { c.visible = ctx.manos[k] === manoCana; });
    canaRaton.visible = false;
    if (!manoCana) return { tirar: false, recogerSedal: false };
    manoCana.grip.localToWorld(puntaMundo.copy(PUNTA).applyEuler(eulerTmp.set(0.35, 0, 0)));
    nHist = (nHist + 1) % historial.length;
    historial[nHist].copy(puntaMundo);
    const atras = historial[(nHist + 1) % historial.length];
    tmp2.copy(puntaMundo).sub(atras).divideScalar(dt * (historial.length - 1));
    let tirar = false;
    if (fase === 'listo' && estado === 'juego') {
      if (manoCana.gatilloPulsado) cargando = true;
      if (cargando && !manoCana.gatillo) {
        cargando = false;
        // Lanza con la velocidad de la punta (hacia delante y arriba)
        tmp.copy(tmp2).multiplyScalar(0.8);
        if (tmp.z > -1.5) tmp.z = -1.5 - Math.random();
        tmp.y = Math.max(tmp.y, 1.5);
        lanzar(tmp.clampLength(0, 10));
      }
    }
    if (fase === 'picada' && (tmp2.y > 1.6 || manoCana.gatilloPulsado)) tirar = true;
    return { tirar, recogerSedal: manoCana.gatillo };
  }

  function entradaRaton() {
    canasVR.forEach((c) => { c.visible = false; });
    canaRaton.visible = true;
    // La caña apunta hacia el corcho (o hacia el ratón si está recogido)
    if (corcho.visible) tmp.copy(corcho.position);
    else if (!ctx.raton.rayo.ray.intersectPlane(planoAgua, tmp)) tmp.set(0, AGUA_Y, -5);
    // La vara va por -Z y lookAt orienta +Z: se mira al punto simétrico. Más tensa, más baja
    tmp2.set(tmp.x * 0.25, Math.max(1.5, 2.3 - tension * 0.8), Math.max(tmp.z * 0.25, -3));
    canaRaton.lookAt(tmp2.multiplyScalar(-1).addScaledVector(canaRaton.position, 2));
    canaRaton.updateMatrixWorld();
    canaRaton.localToWorld(puntaMundo.copy(PUNTA));
    let tirar = false;
    if (ctx.raton.clic && fase === 'listo' && estado === 'juego' && ctx.raton.rayo.ray.intersectPlane(planoAgua, tmp)) {
      // Tiro hacia el punto del agua (como mucho a 12 m)
      tmp.z = Math.min(tmp.z, -2);
      tmp2.copy(tmp).sub(puntaMundo);
      const horizontal = Math.min(12, Math.hypot(tmp2.x, tmp2.z));
      const t = 0.9 + horizontal * 0.04;
      const k = horizontal / Math.max(0.01, Math.hypot(tmp2.x, tmp2.z));
      tmp.set(tmp2.x * k / t, (tmp2.y + 4.9 * t * t) / t, tmp2.z * k / t);
      lanzar(tmp);
    } else if (ctx.raton.clic && fase === 'picada') {
      tirar = true;
    }
    return { tirar, recogerSedal: ctx.raton.pulsado && fase === 'lucha' };
  }

  // ─── Peces que nadan ───────────────────────────────────────────────────
  function moverPeces(dt, t) {
    for (const p of peces) {
      const m = p.malla;
      if (p === pezActual && (fase === 'espera' || fase === 'picada')) {
        // Se acerca al corcho
        tmp.set(corcho.position.x - m.position.x, 0, corcho.position.z + 0.15 - m.position.z);
        const d = tmp.length();
        if (d > 0.05) {
          m.position.addScaledVector(tmp.normalize(), Math.min(d, dt * 0.6));
          m.rotation.y = Math.atan2(tmp.x, tmp.z);
        }
        continue;
      }
      p.rumbo += Math.sin(t * 0.3 + p.i * 2) * dt * 0.6;
      m.position.x += Math.sin(p.rumbo) * p.vel * dt;
      m.position.z += Math.cos(p.rumbo) * p.vel * dt;
      // Se quedan en la zona de pesca (de 2 a 13 m delante)
      if (m.position.z > -2 || m.position.z < -13 || Math.abs(m.position.x) > 7) {
        p.rumbo = Math.atan2(-m.position.x, -7 - m.position.z);
      }
      m.rotation.y = p.rumbo;
    }
  }

  function colocarSedal(t) {
    // De la punta al corcho, con una curva que cuelga menos cuanto más tenso
    const caida = (1 - Math.min(1, tension * 1.3)) * 0.6;
    for (let k = 0; k < N_SEDAL; k++) {
      const u = k / (N_SEDAL - 1);
      tmp.lerpVectors(puntaMundo, corcho.position, u);
      tmp.y -= Math.sin(u * Math.PI) * caida * (fase === 'lanzando' ? 0.2 : 1);
      if (fase === 'lucha' && tira > 0) tmp.x += Math.sin(t * 40 + u * 8) * 0.004 * u;
      posSedal[k * 3] = tmp.x;
      posSedal[k * 3 + 1] = tmp.y;
      posSedal[k * 3 + 2] = tmp.z;
    }
    geoSedal.attributes.position.needsUpdate = true;
  }

  // ─── Bucle ─────────────────────────────────────────────────────────────
  function actualizar(dt, t) {
    reloj -= dt;
    tiempoAviso -= dt;
    if ((estado === 'intro' || estado === 'fin') && reloj <= 0) empezarPartida();
    if (estado === 'juego') {
      restante -= dt;
      if (restante <= 0 && fase !== 'lucha' && fase !== 'sacando') terminar();
      else if (restante <= -15) terminar(); // ni la lucha más larga se alarga más
    }

    const { tirar, recogerSedal } = ctx.enVR() ? entradaVR(dt) : entradaRaton();
    texAgua.offset.set(t * 0.004, t * 0.006);
    moverPeces(dt, t);

    if (fase === 'lanzando') {
      velCorcho.y -= 9.8 * dt;
      corcho.position.addScaledVector(velCorcho, dt);
      if (corcho.position.y <= AGUA_Y) {
        corcho.position.y = AGUA_Y;
        fase = 'espera';
        esperaPicada = 1.5 + Math.random() * 3.5;
        mordiscos = Math.floor(Math.random() * 3);
        pezActual = peces[Math.floor(Math.random() * N_PECES)];
        onda(corcho.position.x, corcho.position.z);
        ctx.sonido('chapuzon');
      }
    } else if (fase === 'espera') {
      esperaPicada -= dt;
      corcho.position.y = AGUA_Y + Math.sin(t * 2.4) * 0.006;
      if (esperaPicada <= 0) {
        if (mordiscos > 0) {
          // Mordisquea: un saltito del corcho
          mordiscos -= 1;
          esperaPicada = 0.6 + Math.random() * 0.9;
          corcho.position.y = AGUA_Y - 0.02;
          onda(corcho.position.x, corcho.position.z, 0.4);
          ctx.sonido('tic');
          ctx.vibrar(manoCana, 0.15, 30);
        } else {
          fase = 'picada';
          esperaPicada = VENTANA;
          onda(corcho.position.x, corcho.position.z, 1.4);
          ctx.sonido('picada');
          ctx.vibrar(manoCana, 0.8, 120);
        }
      }
      if (recogerSedal && ctx.enVR()) recoger();
    } else if (fase === 'picada') {
      esperaPicada -= dt;
      corcho.position.y = AGUA_Y - 0.06 + Math.sin(t * 30) * 0.01;
      if (tirar) clavar(manoCana);
      else if (esperaPicada <= 0) perderPez(ctx.t('escapado'));
    } else if (fase === 'lucha') {
      // El pez alterna tirones y descansos
      if (tira > 0) {
        tira -= dt;
        if (tira <= 0) descanso = 0.8 + Math.random() * 1.6 / especie.fuerza;
      } else {
        descanso -= dt;
        if (descanso <= 0) {
          tira = 0.5 + Math.random() * 1.2 * especie.fuerza;
          ctx.vibrar(manoCana, 0.5, 100);
          onda(corcho.position.x, corcho.position.z, 0.8);
        }
      }
      if (recogerSedal) {
        sonidoCarrete -= dt;
        if (sonidoCarrete <= 0) {
          ctx.sonido('carrete');
          sonidoCarrete = 0.09;
        }
        if (tira > 0) {
          tension += dt * 0.55 * especie.fuerza;
        } else {
          distancia -= dt * 1.6;
          tension = Math.max(0.15, tension - dt * 0.15);
        }
      } else {
        tension = Math.max(0, tension - dt * 0.5);
        if (tira > 0) distancia += dt * 0.9 * especie.fuerza;
      }
      if (tira > 0) ctx.vibrar(manoCana, 0.15 + tension * 0.3, 20);
      // El corcho se acerca o se aleja por la recta hacia el embarcadero
      tmp.set(corcho.position.x - ORIGEN.x, 0, corcho.position.z - ORIGEN.z).normalize();
      corcho.position.set(ORIGEN.x + tmp.x * distancia + (tira > 0 ? Math.sin(t * 7) * 0.15 : 0), AGUA_Y - (tira > 0 ? 0.03 : 0), ORIGEN.z + tmp.z * distancia);
      if (tension >= 1) perderPez(ctx.t('roto'));
      else if (tension <= 0 && tira > 0 && distancia > 14) perderPez(ctx.t('escapado'));
      else if (distancia <= 0.4) sacarPez(manoCana);
    } else if (fase === 'sacando') {
      salida -= dt;
      // El pez salta del agua y cae en el cubo
      const u = 1 - salida / 1.3;
      tmp.copy(ORIGEN);
      pezSale.position.set(THREE.MathUtils.lerp(tmp.x, cubo.position.x, u), AGUA_Y + Math.sin(u * Math.PI) * 1.4 + u * 0.6, THREE.MathUtils.lerp(tmp.z, cubo.position.z, u));
      pezSale.rotation.set(Math.sin(t * 18) * 0.3, t * 3, Math.PI / 2 * u);
      if (salida <= 0) {
        pezSale.visible = false;
        ctx.sonido('plof');
        fase = 'listo';
      }
    }
    if (fase === 'listo') {
      corcho.visible = sedal.visible = false;
    } else if (fase !== 'sacando') {
      colocarSedal(t);
    }
    // Ondas que se abren y se borran
    for (const o of ondas) {
      if (o.vida <= 0) continue;
      o.vida -= dt * 0.9;
      const r = (1 - o.vida) * 0.6 * (o.malla.userData.fuerza || 1) + 0.05;
      o.malla.scale.setScalar(r);
      o.malla.material.opacity = Math.max(0, o.vida) * 0.6;
      if (o.vida <= 0) o.malla.visible = false;
    }
    actualizarMarcador();
  }

  actualizarMarcador();

  return {
    actualizar,
    liberar() {},
  };
}
