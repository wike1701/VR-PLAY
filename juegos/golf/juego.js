// CAMPO DE PRÁCTICAS
// Un campo de prácticas de golf a media tarde. Tienes 10 bolas: cada tiro tiene una
// bandera de objetivo (a 20, 35, 50 o 65 metros) y algo de viento de lado. Cuanto más
// cerca de la bandera se para la bola, más puntos (hasta 30), y si entra en el hoyo,
// 80.
// En VR llevas el driver en la mano: haz el swing y golpea la bola del tee; la fuerza y
// la dirección del palo deciden el tiro. Sin gafas, apunta con el ratón (o el dedo),
// mantén pulsado y suelta cuando la barra de fuerza marque la distancia de la bandera.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código.
export async function precargar() {}

const BOLAS = 10;
const R_BOLA = 0.03;
const TEE = new THREE.Vector3(0, 0.05, -0.45);
const G = 9.8;
const ANGULO = 0.4;                  // ángulo de salida (rad, unos 23°)
const LARGO_PALO = 1.0;
// Greens: posición, radio del green y radio en el que se puntúa
const GREENS = [
  { x: -4, z: -20, r: 3.5 },
  { x: 6, z: -35, r: 4.5 },
  { x: -7, z: -50, r: 5.5 },
  { x: 4, z: -65, r: 6.5 },
];
const PERIODO_FUERZA = 1.8;          // ida y vuelta de la barra de fuerza (ratón)
const N_ESTELA = 28;

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (r) => ctx.recurso(r);

  ctx.fondo(0x8ec9f0, {
    cenit: 0x4f8fd0, horizonte: 0xf6d9b0, nubes: 0.5, sol: [0.5, 0.35, -0.6], niebla: [45, 150],
    paisaje: { tipo: 'colinas', color: 0x5d8a4e, radio: 110 },
  });
  ctx.sueloBase(false);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.65, 0.45), new THREE.Vector3(0, 0.2, -30));

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

  // ─── El campo ──────────────────────────────────────────────────────────
  // Calle con franjas de corte
  const texCalle = R(ctx.texturaCanvas((g, tam) => {
    for (let i = 0; i < 16; i++) {
      g.fillStyle = i % 2 ? '#5f9c45' : '#6aab4c';
      g.fillRect(0, (i * tam) / 16, tam, tam / 16);
    }
    g.globalAlpha = 0.08;
    for (let i = 0; i < 900; i++) {
      g.fillStyle = Math.random() < 0.5 ? '#2d5a22' : '#a8d47a';
      g.fillRect(Math.random() * tam, Math.random() * tam, 2, 2);
    }
    g.globalAlpha = 1;
  }, { tam: 256, repetir: [4, 10] }));
  const calle = new THREE.Mesh(R(new THREE.PlaneGeometry(60, 160)), R(new THREE.MeshLambertMaterial({ map: texCalle })));
  calle.rotation.x = -Math.PI / 2;
  calle.position.z = -60;
  raiz.add(calle);
  const rough = new THREE.Mesh(
    R(new THREE.PlaneGeometry(300, 300)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.cesped(0x4a7a36, { tam: 256, repetir: [60, 60], semilla: 301 })) })),
  );
  rough.rotation.x = -Math.PI / 2;
  rough.position.y = -0.02;
  raiz.add(rough);

  // Greens con anillos de distancia (la zona que puntúa)
  const texGreen = R(ctx.texturaCanvas((g, tam) => {
    const c = tam / 2;
    g.fillStyle = '#5f9c45';
    g.fillRect(0, 0, tam, tam);
    const anillos = ['#7cc35a', '#86cc63', '#93d66e', '#a2e07c'];
    anillos.forEach((color, i) => {
      g.fillStyle = color;
      g.beginPath();
      g.arc(c, c, c * (1 - i * 0.22), 0, Math.PI * 2);
      g.fill();
    });
    g.strokeStyle = 'rgba(255,255,255,0.55)';
    g.lineWidth = tam * 0.008;
    for (let i = 1; i < 4; i++) {
      g.beginPath();
      g.arc(c, c, c * (1 - i * 0.22), 0, Math.PI * 2);
      g.stroke();
    }
  }, { tam: 256 }));
  const matGreen = R(new THREE.MeshLambertMaterial({ map: texGreen, transparent: true, alphaTest: 0.5 }));
  const geoAnilloObjetivo = R(new THREE.RingGeometry(0.94, 1, 48).rotateX(-Math.PI / 2));
  const matObjetivo = R(new THREE.MeshBasicMaterial({ color: 0xff6a3d, transparent: true, opacity: 0.85, depthWrite: false, toneMapped: false }));
  const geoMastil = R(new THREE.CylinderGeometry(0.035, 0.035, 3.2, 6).translate(0, 1.6, 0));
  const matMastil = R(new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }));
  const geoBandera = R(new THREE.PlaneGeometry(1.3, 0.85, 4, 1).translate(0.65, 2.75, 0));
  const matBanderaActiva = R(new THREE.MeshBasicMaterial({ color: 0xff6a3d, side: THREE.DoubleSide, toneMapped: false }));
  const matBanderaQuieta = R(new THREE.MeshLambertMaterial({ color: 0xffe08a, side: THREE.DoubleSide }));
  const geoHoyo = R(new THREE.CircleGeometry(0.16, 16).rotateX(-Math.PI / 2));
  const matHoyo = R(new THREE.MeshBasicMaterial({ color: 0x1a1a14 }));
  for (const gr of GREENS) {
    gr.zona = gr.r * 2.2;
    const disco = new THREE.Mesh(R(new THREE.CircleGeometry(gr.zona, 40).rotateX(-Math.PI / 2)), matGreen);
    disco.position.set(gr.x, 0.01, gr.z);
    raiz.add(disco);
    const hoyo = new THREE.Mesh(geoHoyo, matHoyo);
    hoyo.position.set(gr.x, 0.015, gr.z);
    raiz.add(hoyo);
    const mastil = new THREE.Mesh(geoMastil, matMastil);
    mastil.position.set(gr.x, 0, gr.z);
    raiz.add(mastil);
    gr.bandera = new THREE.Mesh(geoBandera, matBanderaQuieta);
    gr.bandera.position.set(gr.x, 0, gr.z);
    raiz.add(gr.bandera);
    gr.anillo = new THREE.Mesh(geoAnilloObjetivo, matObjetivo);
    gr.anillo.position.set(gr.x, 0.03, gr.z);
    gr.anillo.scale.setScalar(gr.zona);
    gr.anillo.visible = false;
    raiz.add(gr.anillo);
  }
  // Carteles de distancia a la izquierda (solo números)
  const carteles = [];
  for (const d of [20, 35, 50, 65]) {
    const tex = R(ctx.texturaCanvas((g, tam) => {
      g.fillStyle = '#f4efe2';
      g.fillRect(0, 0, tam, tam);
      g.fillStyle = '#2f5a2a';
      g.fillRect(tam * 0.05, tam * 0.05, tam * 0.9, tam * 0.9);
      g.fillStyle = '#ffffff';
      g.font = `bold ${tam * 0.5}px sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(d), tam / 2, tam * 0.54);
    }, { tam: 128 }));
    const c = new THREE.Mesh(R(new THREE.PlaneGeometry(1.6, 1.6)), R(new THREE.MeshLambertMaterial({ map: tex })));
    c.position.set(-16, 2.2, -d);
    c.rotation.y = 0.5;
    raiz.add(c);
    carteles.push(c);
  }
  const postesCarteles = new THREE.Mesh(fusionar([20, 35, 50, 65].map((d) => colocar(new THREE.BoxGeometry(0.12, 1.4, 0.12), -16, 0.7, -d))), R(new THREE.MeshLambertMaterial({ color: 0x6b4a33 })));
  raiz.add(postesCarteles);
  // Árboles a los lados y al fondo
  const lugares = [];
  for (let i = 0; i < 9; i++) {
    lugares.push({ x: -24 - (i % 2) * 4, z: -8 - i * 11, escala: 1.4 + (i % 3) * 0.25 });
    lugares.push({ x: 24 + (i % 2) * 5, z: -12 - i * 11, escala: 1.3 + ((i + 1) % 3) * 0.25 });
  }
  for (let i = 0; i < 7; i++) lugares.push({ x: -30 + i * 10, z: -115 - (i % 2) * 6, escala: 1.8 });
  raiz.add(ctx.arboles(lugares, { tipo: 'frondoso', semilla: 31 }));

  // ─── Puesto de tiro: alfombrilla, separadores y cesta de bolas ─────────
  const alfombra = new THREE.Mesh(
    R(new THREE.BoxGeometry(1.6, 0.03, 1.6)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.cesped(0x3f8a3a, { tam: 128, repetir: [3, 3], semilla: 302 })) })),
  );
  alfombra.position.set(0, 0.015, -0.3);
  raiz.add(alfombra);
  const matCaseta = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.madera(0xb07a48, { semilla: 303 })) }));
  const caseta = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(0.08, 2.5, 0.08), -1.1, 1.25, -1.0),
    colocar(new THREE.BoxGeometry(0.08, 2.5, 0.08), 1.1, 1.25, -1.0),
    colocar(new THREE.BoxGeometry(0.08, 2.5, 0.08), -1.1, 1.25, 1.2),
    colocar(new THREE.BoxGeometry(0.08, 2.5, 0.08), 1.1, 1.25, 1.2),
    colocar(new THREE.BoxGeometry(2.5, 0.08, 2.5), 0, 2.54, 0.1),
    colocar(new THREE.BoxGeometry(0.04, 1.0, 2.2), -1.1, 0.5, 0.1),
    colocar(new THREE.BoxGeometry(0.04, 1.0, 2.2), 1.1, 0.5, 0.1),
  ]), matCaseta);
  raiz.add(caseta);
  const cesta = new THREE.Mesh(
    R(new THREE.CylinderGeometry(0.17, 0.13, 0.22, 16, 1, true)),
    R(new THREE.MeshLambertMaterial({ color: 0x2a6fb2, side: THREE.DoubleSide })),
  );
  cesta.position.set(0.75, 0.11, 0.1);
  raiz.add(cesta);
  const geoBola = R(new THREE.SphereGeometry(R_BOLA, 16, 12));
  const matBola = R(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 }));
  const bolasCesta = new THREE.InstancedMesh(geoBola, matBola, BOLAS);
  for (let i = 0; i < BOLAS; i++) {
    const a = i * 2.4;
    const rr = 0.04 + (i % 3) * 0.035;
    bolasCesta.setMatrixAt(i, matrizTmp.makeTranslation(0.75 + Math.cos(a) * rr, 0.19 + Math.floor(i / 5) * 0.04, 0.1 + Math.sin(a) * rr));
  }
  raiz.add(bolasCesta);
  const sombraCesta = ctx.crearSombra({ radio: 0.25, opacidad: 0.4 });
  sombraCesta.position.set(0.75, 0.035, 0.1);
  raiz.add(sombraCesta);
  // Tee
  const tee = new THREE.Mesh(R(new THREE.CylinderGeometry(0.012, 0.004, 0.05, 8)), R(new THREE.MeshLambertMaterial({ color: 0xff6a3d })));
  tee.position.set(TEE.x, 0.045, TEE.z);
  raiz.add(tee);

  // ─── La bola en juego ──────────────────────────────────────────────────
  const bola = new THREE.Mesh(geoBola, matBola);
  raiz.add(bola);
  const sombraBola = ctx.crearSombra({ radio: 0.05, opacidad: 0.45 });
  raiz.add(sombraBola);
  // Estela del vuelo
  const posEstela = new Float32Array(N_ESTELA * 3);
  const geoEstela = R(new THREE.BufferGeometry());
  geoEstela.setAttribute('position', new THREE.BufferAttribute(posEstela, 3));
  const estela = new THREE.Line(geoEstela, R(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })));
  estela.frustumCulled = false;
  estela.visible = false;
  raiz.add(estela);
  // Señal de dónde apunta el ratón
  const mira = new THREE.Mesh(R(new THREE.RingGeometry(0.6, 0.8, 32).rotateX(-Math.PI / 2)), R(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6, depthWrite: false })));
  mira.visible = false;
  raiz.add(mira);

  // ─── El driver ─────────────────────────────────────────────────────────
  const matVarilla = R(new THREE.MeshStandardMaterial({ color: 0xc9ced4, roughness: 0.3, metalness: 0.85 }));
  const matPuno = R(new THREE.MeshLambertMaterial({ color: 0x1c1c22 }));
  const matCabeza = R(new THREE.MeshStandardMaterial({ color: 0x2a2f3a, roughness: 0.25, metalness: 0.6 }));
  const geoPuno = R(new THREE.CylinderGeometry(0.016, 0.013, 0.26, 10).rotateX(Math.PI / 2).translate(0, 0, -0.05));
  const geoVarilla = R(new THREE.CylinderGeometry(0.006, 0.01, LARGO_PALO - 0.15, 8).rotateX(Math.PI / 2).translate(0, 0, -0.18 - (LARGO_PALO - 0.15) / 2));
  // Cabeza del driver: una esfera aplastada con la cara plana y una franja coral
  const geoCabeza = R(new THREE.SphereGeometry(0.06, 16, 10).scale(1.1, 0.55, 0.85).translate(0.045, 0, -LARGO_PALO));
  const geoFranja = R(new THREE.BoxGeometry(0.1, 0.012, 0.004).translate(0.045, 0.02, -LARGO_PALO + 0.05));
  function crearPalo() {
    const p = new THREE.Group();
    p.add(new THREE.Mesh(geoPuno, matPuno), new THREE.Mesh(geoVarilla, matVarilla), new THREE.Mesh(geoCabeza, matCabeza), new THREE.Mesh(geoFranja, matObjetivo));
    return p;
  }
  const CABEZA = new THREE.Vector3(0.045, 0, -LARGO_PALO);
  const palosVR = ctx.manos.map((mano) => {
    const p = crearPalo();
    p.visible = false;
    ctx.adjuntarAMano(mano, p);
    return p;
  });
  // Sin gafas, el palo descansa junto a la bola
  const paloRaton = crearPalo();
  paloRaton.position.set(0.3, 0.95, -0.25);
  paloRaton.rotation.set(-1.25, 0.25, 0);
  raiz.add(paloRaton);

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.2, alto: 0.36 });
  marcador.mesh.position.set(0, 2.05, -1.6);
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  // fase: 'intro' | 'listo' | 'vuelo' | 'rodando' | 'resultado' | 'fin'
  let fase = 'intro';
  let reloj = 3;
  let tiro = 0;
  let puntos = 0;
  let record = ctx.leer('record', 0);
  let objetivo = GREENS[0];
  let viento = 0;
  let fuerza = 0;
  let cargando = false;
  let tiempoCarga = 0;
  let aviso = '';
  let tiempoAviso = 0;
  let manoPalo = null;
  let enfriar = 0;
  let botado = false;
  let nEstela = 0;
  let tiempoEstela = 0;
  const orden = [];
  const vel = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const camPos = new THREE.Vector3();
  const cabezaAntes = new THREE.Vector3();
  const cabezaAhora = new THREE.Vector3();
  const velCabeza = new THREE.Vector3();
  const planoSuelo = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
  let hayCabezaAntes = false;

  function barajar() {
    orden.length = 0;
    for (let i = 0; i < BOLAS; i++) orden.push(i % GREENS.length);
    for (let i = orden.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [orden[i], orden[j]] = [orden[j], orden[i]];
    }
  }

  function prepararTiro() {
    fase = 'listo';
    objetivo = GREENS[orden[tiro]];
    viento = Math.round((Math.random() * 2 - 1) * 4 * Math.min(1, 0.3 + tiro * 0.12));
    for (const gr of GREENS) {
      gr.anillo.visible = gr === objetivo;
      gr.bandera.material = gr === objetivo ? matBanderaActiva : matBanderaQuieta;
    }
    bola.position.copy(TEE);
    bola.scale.setScalar(1);
    bola.visible = true;
    vel.set(0, 0, 0);
    estela.visible = false;
    enfriar = 0.8;
    cargando = false;
    fuerza = 0;
    bolasCesta.count = BOLAS - tiro - 1;
  }

  function empezarPartida() {
    tiro = 0;
    puntos = 0;
    barajar();
    prepararTiro();
  }

  function terminar() {
    fase = 'fin';
    reloj = 7;
    ctx.sonido('fin');
    ctx.puntuacion(puntos); // a la clasificación (juegos/marcadores.js)
    if (puntos > record) {
      record = puntos;
      ctx.guardar('record', record);
    }
  }

  function golpear(velocidad, mano) {
    vel.copy(velocidad);
    fase = 'vuelo';
    botado = false;
    nEstela = 0;
    tiempoEstela = 0;
    estela.visible = true;
    const fuerte = vel.length() > 22;
    ctx.efectos.impacto(fuerte ? 'medio' : 'pequeño', { pos: TEE, mano, color: 0xffffff, sonido: 'driver' });
  }

  // Distancia en metros a la bandera del objetivo
  function distanciaBandera() {
    return Math.hypot(bola.position.x - objetivo.x, bola.position.z - objetivo.z);
  }
  function distanciaObjetivo() {
    return Math.hypot(objetivo.x - TEE.x, objetivo.z - TEE.z);
  }

  // Un texto que se ve aunque la bola esté lejos: se pone entre la cámara y la bola
  function textoLejano(contenido, color, tam) {
    ctx.camara.getWorldPosition(camPos);
    tmp2.copy(bola.position).sub(camPos);
    const d = tmp2.length();
    tmp2.multiplyScalar(Math.min(1, 7 / Math.max(d, 0.01))).add(camPos);
    tmp2.y += 0.4;
    ctx.efectos.texto(tmp2, contenido, { color, tam, vida: 1.4 });
  }

  function resolver(enHoyo) {
    fase = 'resultado';
    reloj = 2.2;
    const d = distanciaBandera();
    let gana = 0;
    if (enHoyo) {
      gana = 80;
      aviso = ctx.t('hoyo', { n: gana });
      textoLejano(`+${gana}`, '#ff6a3d', 2.2);
      ctx.efectos.impacto('grande', { pos: bola.position, color: 0xff6a3d, sonido: 'ovacion' });
      ctx.efectos.estallido(bola.position, { color: 0xff6a3d, cantidad: 30 });
    } else if (d < objetivo.zona) {
      gana = Math.max(1, Math.round(30 * (1 - d / objetivo.zona)));
      aviso = ctx.t('cerca', { m: d.toFixed(1), n: gana });
      const nivel = gana >= 20 ? 'grande' : gana >= 10 ? 'medio' : 'pequeño';
      textoLejano(`+${gana}`, gana >= 20 ? '#ff6a3d' : '#ffe08a', gana >= 20 ? 1.9 : 1.4);
      ctx.efectos.impacto(nivel, { pos: bola.position, color: 0xffe08a, sonido: gana >= 20 ? 'hoyo' : 'punto' });
    } else {
      aviso = ctx.t('lejos', { m: d.toFixed(0) });
      textoLejano('0', '#9aa4ad', 1.2);
      ctx.sonido('fallo');
    }
    puntos += gana;
    tiempoAviso = 2.2;
  }

  // ─── Entrada ───────────────────────────────────────────────────────────
  function entradaVR(dt) {
    for (const m of ctx.manos) if (m.activa && m.gatilloPulsado) manoPalo = m;
    if (!manoPalo || !manoPalo.activa) manoPalo = ctx.manos.find((m) => m.activa) || null;
    palosVR.forEach((p, k) => { p.visible = ctx.manos[k] === manoPalo; });
    paloRaton.visible = false;
    mira.visible = false;
    if (!manoPalo) {
      hayCabezaAntes = false;
      return;
    }
    manoPalo.grip.localToWorld(cabezaAhora.copy(CABEZA));
    if (!hayCabezaAntes) {
      cabezaAntes.copy(cabezaAhora);
      hayCabezaAntes = true;
      return;
    }
    velCabeza.copy(cabezaAhora).sub(cabezaAntes).divideScalar(Math.max(dt, 1e-3));
    if (fase === 'listo' && enfriar <= 0) {
      // ¿El recorrido de la cabeza en este fotograma pasa junto a la bola?
      tmp.copy(cabezaAhora).sub(cabezaAntes);
      const largo = tmp.lengthSq();
      let u = largo > 1e-8 ? tmp2.copy(bola.position).sub(cabezaAntes).dot(tmp) / largo : 0;
      u = Math.min(1, Math.max(0, u));
      tmp2.copy(cabezaAntes).addScaledVector(tmp, u);
      const rapidez = velCabeza.length();
      // Solo cuenta el golpe hacia el campo (no la subida del palo hacia atrás)
      tmp.set(velCabeza.x, 0, velCabeza.z);
      const haciaDelante = tmp.z < -0.3 * Math.abs(tmp.x);
      if (tmp2.distanceTo(bola.position) < 0.08 && rapidez > 1.5 && haciaDelante) {
        // Dirección horizontal del palo, con un poco de ayuda hacia el objetivo
        tmp.normalize();
        tmp2.set(objetivo.x - TEE.x, 0, objetivo.z - TEE.z).normalize();
        tmp.lerp(tmp2, 0.2).normalize();
        const s = Math.min(36, rapidez * 2.7);
        tmp.multiplyScalar(s * Math.cos(ANGULO));
        tmp.y = s * Math.sin(ANGULO);
        golpear(tmp, manoPalo);
      }
    }
    cabezaAntes.copy(cabezaAhora);
  }

  function entradaRaton(dt) {
    palosVR.forEach((p) => { p.visible = false; });
    paloRaton.visible = true;
    hayCabezaAntes = false;
    const apunta = ctx.raton.dentro !== false && ctx.raton.rayo.ray.intersectPlane(planoSuelo, tmp);
    mira.visible = fase === 'listo' && !!apunta;
    if (apunta) mira.position.set(tmp.x, 0.04, tmp.z);
    if (fase !== 'listo' || enfriar > 0) return;
    if (ctx.raton.pulsado && apunta && !cargando) {
      cargando = true;
      tiempoCarga = 0;
    }
    if (cargando) {
      tiempoCarga += dt;
      fuerza = 0.5 - 0.5 * Math.cos((tiempoCarga / PERIODO_FUERZA) * Math.PI * 2);
      paloRaton.rotation.z = -fuerza * 1.2;
      if (!ctx.raton.pulsado) {
        cargando = false;
        paloRaton.rotation.z = 0.5;
        // Distancia de vuelo según la fuerza; la bola rueda un poco después
        const vuelo = (8 + fuerza * 62) * 0.9;
        const s = Math.sqrt((vuelo * G) / Math.sin(2 * ANGULO));
        tmp2.set(mira.position.x - TEE.x, 0, mira.position.z - TEE.z);
        if (tmp2.z > -1) tmp2.set(0, 0, -1);
        tmp2.normalize().multiplyScalar(s * Math.cos(ANGULO));
        tmp2.y = s * Math.sin(ANGULO);
        golpear(tmp2, null);
      }
    } else {
      paloRaton.rotation.z *= 0.9;
    }
  }

  // ─── Vuelo de la bola ──────────────────────────────────────────────────
  function moverBola(dt) {
    const p = bola.position;
    if (fase === 'vuelo') {
      vel.y -= G * dt;
      vel.x += viento * 0.3 * dt;
      p.addScaledVector(vel, dt);
      if (p.y <= R_BOLA) {
        p.y = R_BOLA;
        // ¿Ha caído directamente en el hoyo?
        if (distanciaBandera() < 0.25) {
          resolver(true);
          bola.visible = false;
          return;
        }
        if (!botado) {
          ctx.sonido('bote');
          ctx.efectos.estallido(p, { color: 0xd8f0c0, cantidad: 6 });
        }
        botado = true;
        vel.y = -vel.y * 0.28;
        vel.x *= 0.45;
        vel.z *= 0.45;
        if (vel.y < 0.4) {
          vel.y = 0;
          fase = 'rodando';
        }
      }
      // Estela
      tiempoEstela -= dt;
      if (tiempoEstela <= 0) {
        tiempoEstela = 0.06;
        if (nEstela < N_ESTELA) nEstela++;
        posEstela.copyWithin(3, 0, (N_ESTELA - 1) * 3);
        posEstela[0] = p.x;
        posEstela[1] = p.y;
        posEstela[2] = p.z;
        for (let i = nEstela; i < N_ESTELA; i++) {
          posEstela[i * 3] = p.x;
          posEstela[i * 3 + 1] = p.y;
          posEstela[i * 3 + 2] = p.z;
        }
        geoEstela.attributes.position.needsUpdate = true;
      }
    } else if (fase === 'rodando') {
      const v = Math.hypot(vel.x, vel.z);
      const frena = 5 * dt;
      if (v <= frena) {
        vel.set(0, 0, 0);
        resolver(false);
      } else {
        vel.x *= (v - frena) / v;
        vel.z *= (v - frena) / v;
        p.x += vel.x * dt;
        p.z += vel.z * dt;
        if (distanciaBandera() < 0.16 && v < 4) {
          resolver(true);
          bola.visible = false;
        }
      }
    }
    // Más grande cuanto más lejos, para que se vea
    ctx.camara.getWorldPosition(camPos);
    bola.scale.setScalar(Math.max(1, camPos.distanceTo(p) / 4));
    sombraBola.visible = bola.visible;
    if (bola.visible) {
      ctx.colocarSombra(sombraBola, p, 0.025);
      sombraBola.scale.multiplyScalar(Math.min(bola.scale.x, 4));
    }
    // Si se va muy lejos, se da por perdida
    if ((fase === 'vuelo' || fase === 'rodando') && (p.z < -140 || Math.abs(p.x) > 60 || p.z > 6)) resolver(false);
  }

  function actualizarMarcador() {
    if (fase === 'intro') {
      const intro = ctx.enVR() ? ctx.t('intro') : ctx.t(ctx.tactil ? 'introTactil' : 'introRaton');
      marcador.escribir([
        { texto: ctx.t('titulo'), tam: 1.3, color: '#ff8a65' },
        { texto: intro, tam: 0.72 },
      ]);
    } else if (fase === 'fin') {
      marcador.escribir([
        { texto: ctx.t('partida.finPuntos', { n: puntos }), tam: 1.3, color: '#ff8a65' },
        { texto: ctx.t('partida.recordNuevaPartida', { record, n: Math.max(1, Math.ceil(reloj)) }), tam: 0.72 },
      ]);
    } else {
      const flecha = viento === 0 ? '·' : viento < 0 ? '←'.repeat(Math.min(3, Math.ceil(-viento / 1.4))) : '→'.repeat(Math.min(3, Math.ceil(viento / 1.4)));
      let linea;
      if (tiempoAviso > 0) linea = aviso;
      else if (cargando) {
        const llenas = Math.round(fuerza * 10);
        linea = ctx.t('fuerza', { barra: '▮'.repeat(llenas) + '▯'.repeat(10 - llenas), m: Math.round(8 + fuerza * 62) });
      } else linea = ctx.t('objetivo', { m: Math.round(distanciaObjetivo()), viento: flecha, v: Math.abs(viento) });
      marcador.escribir([
        { texto: ctx.t('marcador', { bola: Math.min(BOLAS, tiro + 1), total: BOLAS, puntos }), tam: 1.1 },
        { texto: linea, tam: 0.8, color: tiempoAviso > 0 ? '#ffe08a' : cargando ? '#ff8a65' : '#cfd8dc' },
      ]);
    }
  }

  // ─── Bucle ─────────────────────────────────────────────────────────────
  function actualizar(dt, t) {
    reloj -= dt;
    tiempoAviso -= dt;
    enfriar -= dt;
    if ((fase === 'intro' || fase === 'fin') && reloj <= 0) empezarPartida();
    ctx.bloquearCambio(fase === 'vuelo' || fase === 'rodando');

    if (ctx.enVR()) entradaVR(dt);
    else entradaRaton(dt);

    if (fase === 'vuelo' || fase === 'rodando') moverBola(dt);
    else if (fase === 'listo') {
      bola.scale.setScalar(1);
      ctx.colocarSombra(sombraBola, bola.position, 0.032);
    }
    if (fase === 'resultado' && reloj <= 0) {
      tiro += 1;
      if (tiro >= BOLAS) terminar();
      else prepararTiro();
    }

    // Banderas al viento y anillo del objetivo que late
    for (const gr of GREENS) {
      gr.bandera.rotation.y = (viento >= 0 ? 0 : Math.PI) + Math.sin(t * 2.2 + gr.x) * 0.15;
    }
    objetivo.anillo.material.opacity = 0.6 + Math.sin(t * 4) * 0.25;
    mira.material.opacity = cargando ? 0.9 : 0.55;

    actualizarMarcador();
  }

  bola.position.copy(TEE);
  ctx.colocarSombra(sombraBola, bola.position, 0.032);
  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      ctx.bloquearCambio(false);
    },
  };
}
