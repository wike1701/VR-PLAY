// TOQUES CON PALA
// Una playa a mediodía, con sombrilla y palmeras. Llevas una pala de playa y una pelota:
// dale toques hacia arriba sin que caiga a la arena. Cada toque vale 1 punto, y cada 10
// seguidos vale uno más (hasta 5). Si la pelota pasa por la estrella que flota, 10 más.
// Tienes 3 pelotas: cuando caen las tres, se acaba.
// En VR llevas la pala en la mano: pon la cara hacia arriba y golpea. Sin gafas, la pala
// sigue al ratón (o al dedo) y la pelota rebota sola; haz clic justo al tocar para darle
// más fuerte (un remate vale 1 punto más).
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código.
export async function precargar() {}

const VIDAS = 3;
const R_BOLA = 0.04;
const G = 7.5;                       // un poco menos que la real: la pelota de playa flota
const R_PALA = 0.12;
const GROSOR_PALA = 0.014;
const REBOTE = 0.72;
const FUERZA_PALA = 0.75;
const CENTRO_JUEGO = new THREE.Vector3(0, 1.0, -0.45);
const ALTURA_RATON = 1.0;
const PASOS = 4;
const CENTRO_HOJA = new THREE.Vector3(0, 0.01, -0.17);

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (r) => ctx.recurso(r);

  ctx.fondo(0x8fd3f5, {
    cenit: 0x3f8fd8, horizonte: 0xd8f0f8, nubes: 0.35, sol: [0.4, 0.8, -0.4], niebla: [30, 90],
    paisaje: { tipo: 'colinas', color: 0x6a9a7a, radio: 80 },
  });
  ctx.sueloBase(false);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.75, 0.75), new THREE.Vector3(0, 1.3, -0.6));

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

  // ─── La playa ──────────────────────────────────────────────────────────
  const arena = new THREE.Mesh(
    R(new THREE.PlaneGeometry(60, 40)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.grano(0xe6c890, { cantidad: 2600, tamMin: 0.5, tamMax: 1.6, contraste: 0.16, repetir: [24, 16], semilla: 801 })) })),
  );
  arena.rotation.x = -Math.PI / 2;
  arena.position.z = -8;
  raiz.add(arena);
  const mar = new THREE.Mesh(R(new THREE.PlaneGeometry(200, 80)), R(new THREE.MeshLambertMaterial({ color: 0x1f84c4 })));
  mar.rotation.x = -Math.PI / 2;
  mar.position.set(0, -0.05, -66);
  raiz.add(mar);
  const espuma = new THREE.Mesh(R(new THREE.PlaneGeometry(200, 1.0)), R(new THREE.MeshBasicMaterial({ color: 0xf2f7f7 })));
  espuma.rotation.x = -Math.PI / 2;
  espuma.position.set(0, 0.003, -27.6);
  raiz.add(espuma);
  raiz.add(ctx.arboles([
    { x: -5, z: -6, escala: 1.2 }, { x: -7.5, z: -10 }, { x: 6, z: -8, escala: 1.3 }, { x: 9, z: -4 }, { x: -9, z: -3, escala: 0.9 },
  ], { tipo: 'palmera', semilla: 81 }));
  // Sombrilla, toalla y nevera
  const sombrilla = new THREE.Group();
  const texSombrilla = R(ctx.texturaCanvas((g, tam) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#f4efe6' : '#ff6a3d';
      g.fillRect((i * tam) / 8, 0, tam / 8, tam);
    }
  }, { tam: 128 }));
  const tela = new THREE.Mesh(R(new THREE.ConeGeometry(1.3, 0.45, 16, 1, true)), R(new THREE.MeshLambertMaterial({ map: texSombrilla, side: THREE.DoubleSide })));
  tela.position.y = 2.2;
  const palo = new THREE.Mesh(R(new THREE.CylinderGeometry(0.025, 0.025, 2.4, 8)), R(new THREE.MeshLambertMaterial({ color: 0xf2efe8 })));
  palo.position.y = 1.2;
  sombrilla.add(tela, palo);
  sombrilla.position.set(-2.2, 0, -2.2);
  sombrilla.rotation.z = 0.08;
  raiz.add(sombrilla);
  const sombraSombrilla = ctx.crearSombra({ radio: 1.4, opacidad: 0.35 });
  sombraSombrilla.position.set(-2.3, 0.005, -2.2);
  raiz.add(sombraSombrilla);
  const toalla = new THREE.Mesh(R(new THREE.PlaneGeometry(0.8, 1.7)), R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tela(0x2fb6d8, { repetir: [2, 4], semilla: 802 })) })));
  toalla.rotation.x = -Math.PI / 2;
  toalla.rotation.z = 0.3;
  toalla.position.set(-2.0, 0.006, -2.4);
  raiz.add(toalla);
  const nevera = new THREE.Mesh(R(new THREE.BoxGeometry(0.45, 0.35, 0.3)), R(new THREE.MeshLambertMaterial({ color: 0x2a6fb2 })));
  nevera.position.set(1.6, 0.175, -1.8);
  nevera.rotation.y = -0.4;
  raiz.add(nevera);
  const sombraNevera = ctx.crearSombra({ radio: 0.35, opacidad: 0.4 });
  sombraNevera.position.set(1.6, 0.005, -1.8);
  raiz.add(sombraNevera);

  // ─── La pala de playa ──────────────────────────────────────────────────
  // Mango en el puño y la hoja hacia delante (-Z); las caras miran a los lados (±X)
  const matPala = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.madera(0xd7a86e, { semilla: 803 })) }));
  const matCanto = R(new THREE.MeshLambertMaterial({ color: 0xff6a3d }));
  const geoHoja = R(new THREE.CylinderGeometry(R_PALA, R_PALA, GROSOR_PALA, 28).rotateZ(Math.PI / 2).translate(CENTRO_HOJA.x, CENTRO_HOJA.y, CENTRO_HOJA.z));
  const geoCanto = R(new THREE.TorusGeometry(R_PALA, 0.008, 6, 32).rotateY(Math.PI / 2).translate(CENTRO_HOJA.x, CENTRO_HOJA.y, CENTRO_HOJA.z));
  const geoMango = R(new THREE.BoxGeometry(0.022, 0.032, 0.12).translate(0, 0, -0.01));
  function crearPala() {
    const p = new THREE.Group();
    p.add(new THREE.Mesh(geoHoja, matPala), new THREE.Mesh(geoCanto, matCanto), new THREE.Mesh(geoMango, matCanto));
    return p;
  }
  const palasVR = ctx.manos.map((mano) => ({
    mano,
    objeto: ctx.adjuntarAMano(mano, crearPala()),
    centro: new THREE.Vector3(),
    centroAntes: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    normalAntes: new THREE.Vector3(),
    lista: false,
  }));
  // Sin gafas: la pala va tumbada (cara hacia arriba) y sigue al ratón
  const palaRaton = crearPala();
  palaRaton.rotation.set(0, 0, Math.PI / 2);
  raiz.add(palaRaton);
  const datosRaton = { centro: new THREE.Vector3(), centroAntes: new THREE.Vector3(), lista: false };
  const sombraPala = ctx.crearSombra({ radio: 0.14, opacidad: 0.35 });
  raiz.add(sombraPala);

  // ─── Pelota y estrella ─────────────────────────────────────────────────
  const texPelota = R(ctx.texturaCanvas((g, tam) => {
    const colores = ['#ffd23f', '#ffffff', '#2fb6d8', '#ffffff', '#e8457a', '#ffffff'];
    for (let i = 0; i < 6; i++) {
      g.fillStyle = colores[i];
      g.fillRect((i * tam) / 6, 0, tam / 6, tam);
    }
  }, { tam: 128 }));
  const bola = new THREE.Mesh(R(new THREE.SphereGeometry(R_BOLA, 20, 14)), R(new THREE.MeshStandardMaterial({ map: texPelota, roughness: 0.4 })));
  raiz.add(bola);
  const sombraBola = ctx.crearSombra({ radio: 0.06, opacidad: 0.45 });
  raiz.add(sombraBola);
  // Estrella de cinco puntas
  const forma = new THREE.Shape();
  for (let i = 0; i < 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.045 : 0.1;
    if (i === 0) forma.moveTo(Math.cos(a) * r, Math.sin(a) * r);
    else forma.lineTo(Math.cos(a) * r, Math.sin(a) * r);
  }
  const estrella = new THREE.Mesh(
    R(new THREE.ExtrudeGeometry(forma, { depth: 0.025, bevelEnabled: true, bevelSize: 0.008, bevelThickness: 0.008, bevelSegments: 1 }).center()),
    R(new THREE.MeshStandardMaterial({ color: 0xffd23f, emissive: 0xff8a2a, emissiveIntensity: 0.4, roughness: 0.3, metalness: 0.3 })),
  );
  raiz.add(estrella);
  const halo = new THREE.Mesh(R(new THREE.RingGeometry(0.13, 0.15, 32)), R(new THREE.MeshBasicMaterial({ color: 0xff6a3d, transparent: true, opacity: 0.6, depthWrite: false, toneMapped: false })));
  raiz.add(halo);

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.0, alto: 0.3 });
  marcador.mesh.position.set(0.9, 1.9, -1.6);
  marcador.mesh.rotation.y = -0.4;
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'juego' | 'fin'
  // fase de la pelota: 'cae' (llega desde arriba) | 'juego' | 'perdida'
  let fase = 'cae';
  let reloj = 3;
  let puntos = 0;
  let record = ctx.leer('record', 0);
  let vidas = VIDAS;
  let racha = 0;
  let mejorRacha = 0;
  let espera = 0;
  let aviso = '';
  let tiempoAviso = 0;
  let enfriar = 0;
  let clicReciente = 0;
  let indicePala = null;
  const vel = new THREE.Vector3();
  const posEstrella = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const relativa = new THREE.Vector3();
  const velPala = new THREE.Vector3();
  const ejeX = new THREE.Vector3(1, 0, 0);
  const planoRaton = new THREE.Plane(new THREE.Vector3(0, 1, 0), -ALTURA_RATON);

  function moverEstrella() {
    posEstrella.set((Math.random() - 0.5) * 0.7, 1.75 + Math.random() * 0.45, CENTRO_JUEGO.z - 0.15 + (Math.random() - 0.5) * 0.3);
  }

  function nuevaBola() {
    fase = 'cae';
    bola.visible = true;
    bola.position.set(CENTRO_JUEGO.x, 2.2, CENTRO_JUEGO.z);
    vel.set(0, -0.5, 0);
    racha = 0;
  }

  function empezarPartida() {
    estado = 'juego';
    puntos = 0;
    vidas = VIDAS;
    mejorRacha = 0;
    moverEstrella();
    nuevaBola();
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

  // Ayuda suave: la pelota vuelve hacia la zona de juego y sube lo bastante
  function ayudar() {
    vel.x = vel.x * 0.5 + (CENTRO_JUEGO.x - bola.position.x) * 1.2;
    vel.z = vel.z * 0.5 + (CENTRO_JUEGO.z - bola.position.z) * 1.2;
    const h = Math.hypot(vel.x, vel.z);
    if (h > 1.2) {
      vel.x *= 1.2 / h;
      vel.z *= 1.2 / h;
    }
    if (vel.y > 0.5) vel.y = Math.min(5.5, Math.max(vel.y, 2.6));
  }

  function toque(mano, remate) {
    if (enfriar > 0) return;
    enfriar = 0.15;
    if (fase === 'cae') fase = 'juego';
    if (estado !== 'juego') return;
    racha += 1;
    mejorRacha = Math.max(mejorRacha, racha);
    const valor = Math.min(5, 1 + Math.floor((racha - 1) / 10)) + (remate ? 1 : 0);
    puntos += valor;
    const grande = racha % 10 === 0;
    ctx.efectos.impacto(grande || remate ? 'medio' : 'pequeño', { pos: bola.position, mano, color: 0xffd23f, sonido: 'pong' });
    tmp.copy(bola.position);
    tmp.y += 0.12;
    ctx.efectos.texto(tmp, `+${valor}`, { color: grande || remate ? '#ff6a3d' : '#ffffff', tam: grande ? 1.3 : 0.9 });
    if (grande) {
      aviso = ctx.t('racha', { n: racha });
      tiempoAviso = 1.5;
    } else if (remate) {
      aviso = ctx.t('remate');
      tiempoAviso = 0.8;
    }
  }

  // ─── Palas ─────────────────────────────────────────────────────────────
  function situarPalas(dt) {
    if (ctx.enVR()) {
      palaRaton.visible = false;
      datosRaton.lista = false;
      for (const p of palasVR) if (p.mano.activa && p.mano.gatilloPulsado) indicePala = p;
      if (!indicePala || !indicePala.mano.activa) indicePala = palasVR.find((p) => p.mano.activa) || null;
      for (const p of palasVR) {
        p.objeto.visible = p === indicePala;
        if (!p.mano.activa) {
          p.lista = false;
          continue;
        }
        p.centroAntes.copy(p.centro);
        p.normalAntes.copy(p.normal);
        p.mano.grip.localToWorld(p.centro.copy(CENTRO_HOJA));
        p.mano.grip.getWorldQuaternion(qTmp);
        p.normal.copy(ejeX).applyQuaternion(qTmp);
        if (!p.lista) {
          p.centroAntes.copy(p.centro);
          p.normalAntes.copy(p.normal);
          p.lista = true;
        }
      }
      if (indicePala) ctx.colocarSombra(sombraPala, indicePala.centro, 0.005);
      return;
    }
    for (const p of palasVR) {
      p.objeto.visible = false;
      p.lista = false;
    }
    palaRaton.visible = true;
    if (ctx.raton.rayo.ray.intersectPlane(planoRaton, tmp)) {
      tmp.x = Math.max(-0.55, Math.min(0.55, tmp.x));
      tmp.z = Math.max(-0.85, Math.min(-0.15, tmp.z));
      datosRaton.centroAntes.copy(datosRaton.centro);
      datosRaton.centro.lerp(tmp, datosRaton.lista ? Math.min(1, dt * 18) : 1);
      datosRaton.lista = true;
    }
    // La hoja tumbada: el centro de la hoja queda donde apunta el ratón
    palaRaton.position.set(datosRaton.centro.x + CENTRO_HOJA.y, ALTURA_RATON, datosRaton.centro.z - CENTRO_HOJA.z);
    ctx.colocarSombra(sombraPala, datosRaton.centro, 0.005);
  }
  const qTmp = new THREE.Quaternion();

  // Choque con la pala de VR, con la pala interpolada entre fotogramas
  function chocarPalaVR(p, f, h) {
    const centro = tmp.lerpVectors(p.centroAntes, p.centro, f);
    const normal = tmp2.lerpVectors(p.normalAntes, p.normal, f).normalize();
    const d = relativa.subVectors(bola.position, centro).dot(normal);
    const enPlano = relativa.addScaledVector(normal, -d).length();
    if (enPlano > R_PALA + R_BOLA * 0.5 || Math.abs(d) > R_BOLA + GROSOR_PALA / 2) return false;
    velPala.subVectors(p.centro, p.centroAntes).divideScalar(Math.max(h, 1e-4)).multiplyScalar(FUERZA_PALA);
    relativa.subVectors(vel, velPala);
    const vn = relativa.dot(normal);
    if (vn * Math.sign(d || 1) >= 0) return false; // ya se aleja de la pala
    vel.copy(velPala).add(relativa.addScaledVector(normal, -(1 + REBOTE) * vn));
    bola.position.copy(centro).addScaledVector(normal, Math.sign(d || 1) * (R_BOLA + GROSOR_PALA / 2 + 0.002));
    const fuerte = velPala.length() > 2.2;
    ayudar();
    toque(p.mano, false);
    if (fuerte) ctx.vibrar(p.mano, 0.6, 40);
    return true;
  }

  // Con ratón: rebota sola al bajar sobre la pala
  function chocarPalaRaton() {
    if (!datosRaton.lista || vel.y >= 0) return false;
    const c = datosRaton.centro;
    const dy = bola.position.y - (ALTURA_RATON + GROSOR_PALA / 2);
    if (dy > R_BOLA || dy < -R_BOLA * 2) return false;
    const dx = bola.position.x - c.x;
    const dz = bola.position.z - c.z;
    if (Math.hypot(dx, dz) > R_PALA + R_BOLA * 0.5) return false;
    const remate = clicReciente > 0;
    clicReciente = 0;
    vel.set(dx * 7, remate ? 4.6 : 3.4, dz * 7);
    bola.position.y = ALTURA_RATON + GROSOR_PALA / 2 + R_BOLA + 0.002;
    ayudar();
    toque(null, remate);
    return true;
  }

  // ─── Física ────────────────────────────────────────────────────────────
  function moverBola(dt) {
    if (fase === 'perdida') return;
    const h = dt / PASOS;
    for (let k = 1; k <= PASOS; k++) {
      vel.y -= G * h;
      // La pelota que cae desde arriba al principio va más despacio
      if (fase === 'cae') vel.y = Math.max(vel.y, -2.2);
      bola.position.addScaledVector(vel, h);
      if (ctx.enVR()) {
        if (indicePala && indicePala.lista && chocarPalaVR(indicePala, k / PASOS, dt)) break;
      } else if (chocarPalaRaton()) break;
    }
    bola.rotation.x += vel.z * dt * 8;
    bola.rotation.z -= vel.x * dt * 8;
    // ¿Pasa por la estrella?
    if (estado === 'juego' && bola.position.distanceTo(posEstrella) < 0.14) {
      puntos += 10;
      ctx.efectos.impacto('grande', { pos: posEstrella, color: 0xff6a3d, sonido: 'anillo' });
      ctx.efectos.estallido(posEstrella, { color: 0xffd23f, cantidad: 24 });
      tmp.copy(posEstrella);
      tmp.y += 0.15;
      ctx.efectos.texto(tmp, '+10', { color: '#ff6a3d', tam: 1.5 });
      aviso = ctx.t('estrella');
      tiempoAviso = 1.2;
      moverEstrella();
    }
    // Al suelo
    if (bola.position.y < R_BOLA) {
      bola.position.y = R_BOLA;
      fase = 'perdida';
      espera = 1.2;
      ctx.efectos.estallido(bola.position, { color: 0xe6c890, cantidad: 10 });
      ctx.sonido('plof');
      if (estado === 'juego') {
        vidas -= 1;
        ctx.sonido('fallo');
        aviso = racha >= 5 ? ctx.t('cae', { n: racha }) : ctx.t('caeSin');
        tiempoAviso = 1.6;
        if (vidas <= 0) terminar();
      }
    }
    ctx.colocarSombra(sombraBola, bola.position, 0.005);
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
        { texto: ctx.t('fin', { n: puntos, racha: mejorRacha }), tam: 1.1, color: '#ff8a65' },
        { texto: ctx.t('partida.recordNuevaPartida', { record, n: Math.max(1, Math.ceil(reloj)) }), tam: 0.72 },
      ]);
    } else {
      marcador.escribir([
        { texto: ctx.t('marcador', { puntos, vidas: '●'.repeat(vidas) + '○'.repeat(VIDAS - vidas) }), tam: 1.15 },
        { texto: tiempoAviso > 0 ? aviso : ctx.t('toques', { n: racha }), tam: 0.8, color: tiempoAviso > 0 ? '#ffe08a' : '#cfd8dc' },
      ]);
    }
  }

  // ─── Bucle ─────────────────────────────────────────────────────────────
  function actualizar(dt, t) {
    reloj -= dt;
    tiempoAviso -= dt;
    enfriar -= dt;
    clicReciente -= dt;
    if (ctx.raton.clic) clicReciente = 0.18;
    if ((estado === 'intro' || estado === 'fin') && reloj <= 0) empezarPartida();

    situarPalas(dt);
    moverBola(dt);
    if (fase === 'perdida') {
      espera -= dt;
      if (espera <= 0 && (estado === 'juego' || estado === 'intro')) nuevaBola();
    }
    // La pelota de la intro rebota sola en la pala para enseñar el juego
    if (estado === 'intro' && fase === 'perdida') nuevaBola();

    estrella.visible = halo.visible = estado === 'juego';
    estrella.position.copy(posEstrella);
    estrella.position.y += Math.sin(t * 2) * 0.03;
    estrella.rotation.y = t * 1.5;
    halo.position.copy(estrella.position);
    halo.lookAt(ctx.camara.getWorldPosition(tmp));
    halo.scale.setScalar(1 + Math.sin(t * 5) * 0.08);
    ctx.bloquearCambio(estado === 'juego' && fase === 'juego');
    actualizarMarcador();
  }

  datosRaton.centro.copy(CENTRO_JUEGO);
  nuevaBola();
  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      ctx.bloquearCambio(false);
    },
  };
}
