// LANZA AROS
// Verbena de verano en la plaza del pueblo, al atardecer. En una caja de madera hay 16
// botellas; lanza los 10 aros para que entren por el cuello de una. Las de la fila de
// delante valen 1, las siguientes 2, 3 y 4 las del fondo, y la dorada (cambia de sitio
// en cada partida) vale 5. Si el aro da en el cuello rebota.
// En VR coges un aro del poste con el gatillo y lo lanzas soltándolo. Sin gafas, haz clic
// (o toca) en la botella a la que quieres tirar; el pulso tiembla un poco.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código.
export async function precargar() {}

const N_AROS = 10;
const R_ARO = 0.05;   // aros más chicos: la boca libre baja de unos 6 a unos 3 cm
const TUBO_ARO = 0.009;
const R_CUELLO = 0.014;
const ALTO_BOTELLA = 0.27;
const CAJA = new THREE.Vector3(0, 0.36, -1.75);   // centro de la base de las botellas
const SEP = 0.2;                                    // separación entre botellas
const POSTE = new THREE.Vector3(-0.32, 0.95, -0.4);
const MANO_RATON = new THREE.Vector3(0.2, 1.3, -0.2);
const G = 9.8;

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (r) => ctx.recurso(r);

  ctx.fondo(0xf0a46a, {
    cenit: 0x4a5fa8, horizonte: 0xffb37a, nubes: 0.35, sol: [0.2, 0.12, -1], niebla: [20, 70],
    paisaje: { tipo: 'colinas', color: 0x5d6a52, radio: 60 },
  });
  ctx.sueloBase(false);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.45, 0.25), new THREE.Vector3(0, 0.55, -1.7));

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

  // ─── La plaza ──────────────────────────────────────────────────────────
  const suelo = new THREE.Mesh(
    R(new THREE.PlaneGeometry(50, 50)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.ladrillos(0xb98a62, 0x8c6a50, { filas: 8, columnas: 8, repetir: [20, 20], semilla: 71 })) })),
  );
  suelo.rotation.x = -Math.PI / 2;
  raiz.add(suelo);
  // Fachadas de casas encaladas alrededor de la plaza
  const texFachada = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#f1e7d6';
    g.fillRect(0, 0, tam, tam);
    for (let fy = 0; fy < 2; fy++) {
      for (let fx = 0; fx < 3; fx++) {
        const x = fx * (tam / 3) + tam / 12;
        const y = fy * (tam / 2) + tam / 8;
        g.fillStyle = '#2f5d8a';
        g.fillRect(x - 4, y - 4, tam / 6 + 8, tam / 4 + 8);
        g.fillStyle = fy === 1 && fx === 1 ? '#6b3b22' : '#f6c96a';
        g.fillRect(x, y, tam / 6, tam / 4);
      }
    }
    g.fillStyle = '#c8b9a2';
    g.fillRect(0, tam * 0.94, tam, tam * 0.06);
  }, { tam: 256, repetir: [1, 1] }));
  texFachada.wrapS = THREE.RepeatWrapping;
  const CASAS = [[-5, -8, 0, 7, 6], [3, -9, 0, 8, 7], [-9, -1, Math.PI / 2, 8, 6], [9, -2, -Math.PI / 2, 9, 8], [0, 7, Math.PI, 12, 6]];
  raiz.add(new THREE.Mesh(fusionar(CASAS.map(([x, z, giro, ancho, alto]) => {
    const g = new THREE.BoxGeometry(ancho, alto, 4);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * ancho / 4);
    return colocar(g, x, alto / 2, z, 0, giro);
  })), R(new THREE.MeshLambertMaterial({ map: texFachada }))));
  // Tejados
  raiz.add(new THREE.Mesh(fusionar(CASAS.map(([x, z, giro, ancho, alto]) => colocar(new THREE.BoxGeometry(ancho + 0.4, 0.3, 4.4), x, alto + 0.15, z, 0, giro))),
    R(new THREE.MeshLambertMaterial({ color: 0xb4532e }))));
  raiz.add(ctx.arboles([{ x: -3.5, z: -4.5 }, { x: 3.8, z: -4.2, escala: 1.1 }, { x: -5, z: 2.5, escala: 0.9 }, { x: 5, z: 2 }], { tipo: 'frondoso' }));
  // Guirnaldas de bombillas cruzando la plaza
  const N_BOMB = 40;
  const bombillas = new THREE.InstancedMesh(R(new THREE.SphereGeometry(0.04, 8, 6)), R(new THREE.MeshBasicMaterial({ toneMapped: false })), N_BOMB);
  const colorTmp = new THREE.Color();
  for (let i = 0; i < N_BOMB; i++) {
    const cable = i < N_BOMB / 2 ? 0 : 1;
    const u = (i % (N_BOMB / 2)) / (N_BOMB / 2 - 1);
    const x = -4 + u * 8;
    const z = cable ? -3.6 : -1.2;
    bombillas.setMatrixAt(i, matrizTmp.makeTranslation(x, 3.2 - Math.sin(u * Math.PI) * 0.6, z + (cable ? 0 : u * 0.6)));
    bombillas.setColorAt(i, colorTmp.set([0xffd23f, 0xff6a3d, 0x7ef0ff, 0xff7ad9, 0x9bff7a][i % 5]));
  }
  raiz.add(bombillas);

  // ─── Puesto: mesa, caja y botellas ─────────────────────────────────────
  const matMadera = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tablas(0xa8743f, { tablas: 6, semilla: 72 })) }));
  const caja = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(0.95, 0.04, 0.95), CAJA.x, CAJA.y - 0.02, CAJA.z),
    colocar(new THREE.BoxGeometry(0.95, 0.12, 0.03), CAJA.x, CAJA.y + 0.04, CAJA.z + 0.46),
    colocar(new THREE.BoxGeometry(0.95, 0.12, 0.03), CAJA.x, CAJA.y + 0.04, CAJA.z - 0.46),
    colocar(new THREE.BoxGeometry(0.03, 0.12, 0.95), CAJA.x - 0.46, CAJA.y + 0.04, CAJA.z),
    colocar(new THREE.BoxGeometry(0.03, 0.12, 0.95), CAJA.x + 0.46, CAJA.y + 0.04, CAJA.z),
    ...[[-0.42, -0.42], [0.42, -0.42], [-0.42, 0.42], [0.42, 0.42]].map(([x, z]) => colocar(new THREE.BoxGeometry(0.06, CAJA.y - 0.04, 0.06), CAJA.x + x, (CAJA.y - 0.04) / 2, CAJA.z + z)),
    // Mostrador delante del jugador con el poste de los aros
    colocar(new THREE.BoxGeometry(1.6, 0.05, 0.3), 0, 0.88, -0.45),
    colocar(new THREE.BoxGeometry(1.6, 0.86, 0.04), 0, 0.43, -0.6),
  ]), matMadera);
  raiz.add(caja);
  const sombraCaja = ctx.crearSombra({ radio: 0.75, opacidad: 0.45 });
  sombraCaja.position.set(CAJA.x, 0.006, CAJA.z);
  raiz.add(sombraCaja);
  const poste = new THREE.Mesh(fusionar([
    colocar(new THREE.CylinderGeometry(0.012, 0.012, 0.2, 10), POSTE.x, POSTE.y + 0.03, POSTE.z),
    colocar(new THREE.CylinderGeometry(0.05, 0.06, 0.02, 16), POSTE.x, 0.915, POSTE.z),
  ]), R(new THREE.MeshLambertMaterial({ color: 0x5a3a20 })));
  raiz.add(poste);

  // Botella torneada (vidrio opaco brillante; el color va por instancia)
  const perfil = [
    [0.0001, 0], [0.034, 0], [0.038, 0.01], [0.038, 0.14], [0.032, 0.17], [0.02, 0.2], [R_CUELLO, 0.215],
    [R_CUELLO, 0.255], [R_CUELLO + 0.004, 0.258], [R_CUELLO + 0.004, ALTO_BOTELLA], [0.0001, ALTO_BOTELLA],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geoBotella = R(new THREE.LatheGeometry(perfil, 16));
  const matBotella = R(new THREE.MeshStandardMaterial({ roughness: 0.12, metalness: 0.2 }));
  const botellas = [];
  for (let f = 0; f < 4; f++) {
    for (let c = 0; c < 4; c++) {
      botellas.push({ x: CAJA.x + (c - 1.5) * SEP, z: CAJA.z + (1.5 - f) * SEP, valor: f + 1, aros: 0 });
    }
  }
  const mallaBotellas = new THREE.InstancedMesh(geoBotella, matBotella, botellas.length);
  const COLORES_FILA = [0x2e8b57, 0x8b5a2b, 0x2a6fb0, 0x8a2be2];
  botellas.forEach((b, i) => {
    mallaBotellas.setMatrixAt(i, matrizTmp.makeTranslation(b.x, CAJA.y, b.z));
    mallaBotellas.setColorAt(i, colorTmp.set(COLORES_FILA[b.valor - 1]));
  });
  raiz.add(mallaBotellas);
  // Carteles con el valor de cada fila (puntos de colores en el lateral de la caja)
  const marcas = new THREE.InstancedMesh(R(new THREE.SphereGeometry(0.018, 8, 6)), R(new THREE.MeshBasicMaterial({ toneMapped: false })), 10);
  let m = 0;
  for (let f = 0; f < 4; f++) {
    for (let k = 0; k <= f; k++) {
      marcas.setMatrixAt(m, matrizTmp.makeTranslation(CAJA.x - 0.49, CAJA.y + 0.04, CAJA.z + (1.5 - f) * SEP + (k - f / 2) * 0.04));
      marcas.setColorAt(m, colorTmp.set(COLORES_FILA[f]).multiplyScalar(1.6));
      m++;
    }
  }
  raiz.add(marcas);
  let dorada = 0;

  // ─── Aros ──────────────────────────────────────────────────────────────
  const geoAro = R(new THREE.TorusGeometry(R_ARO, TUBO_ARO, 10, 36));
  geoAro.rotateX(Math.PI / 2); // tumbado (horizontal)
  const COLORES_ARO = [0xff6a3d, 0xffd23f, 0x2ee6d6, 0xff7ad9, 0x9bff7a];
  const matsAro = COLORES_ARO.map((c) => R(new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, emissive: c, emissiveIntensity: 0.12 })));
  const aros = Array.from({ length: N_AROS }, (_, i) => {
    const malla = new THREE.Mesh(geoAro, matsAro[i % matsAro.length]);
    raiz.add(malla);
    const sombra = ctx.crearSombra({ radio: 0.09, opacidad: 0.3 });
    sombra.visible = false;
    raiz.add(sombra);
    return { i, malla, sombra, estado: 'poste', mano: null, vel: new THREE.Vector3(), giro: 0, balanceo: 0, vida: 0, botella: null, bajar: 0 };
  });

  const historiales = ctx.manos.map(() => ({ pos: Array.from({ length: 8 }, () => new THREE.Vector3()), dt: new Array(8).fill(0.016), n: 0 }));

  // Manos visibles: así se ve el aro que cogen
  const geoMano = R(new THREE.SphereGeometry(0.045, 12, 8));
  geoMano.scale(1, 0.6, 1.3);
  const matMano = R(new THREE.MeshLambertMaterial({ color: 0xffcc80 }));
  for (const mano of ctx.manos) ctx.adjuntarAMano(mano, new THREE.Mesh(geoMano, matMano));

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.0, alto: 0.3 });
  marcador.mesh.position.set(0, 1.45, -2.55);
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'juego' | 'fin'
  let reloj = 3;
  let puntos = 0;
  let lanzados = 0;
  let encestados = 0;
  let record = ctx.leer('record', 0);
  let espera = 0;
  let aviso = '';
  let tiempoAviso = 0;
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const planoApunte = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(CAJA.y + ALTO_BOTELLA));

  function enPoste(a) {
    a.estado = 'poste';
    a.mano = null;
    a.botella = null;
    a.malla.visible = true;
    a.malla.position.set(POSTE.x, 0.93 + (N_AROS - 1 - a.i) * 0.019, POSTE.z);
    a.malla.rotation.set(0, 0, 0);
    a.sombra.visible = false;
  }

  function empezarPartida() {
    puntos = 0;
    lanzados = 0;
    encestados = 0;
    espera = 0;
    for (const a of aros) enPoste(a);
    for (const b of botellas) b.aros = 0;
    // La dorada, en una botella al azar de las dos filas de atrás
    mallaBotellas.setColorAt(dorada, colorTmp.set(COLORES_FILA[botellas[dorada].valor - 1]));
    dorada = 8 + Math.floor(Math.random() * 8);
    mallaBotellas.setColorAt(dorada, colorTmp.set(0xffc83a));
    mallaBotellas.instanceColor.needsUpdate = true;
    estado = 'juego';
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

  function lanzar(a, vel) {
    a.estado = 'vuelo';
    a.mano = null;
    a.vel.copy(vel);
    a.giro = 6 + Math.random() * 4;
    a.balanceo = 0.05 + Math.random() * 0.12;
    a.vida = 4;
    a.sombra.visible = true;
    lanzados += 1;
    ctx.sonido('zas');
  }

  function valorDe(i) {
    return i === dorada ? 5 : botellas[i].valor;
  }

  function encestar(a, i) {
    const b = botellas[i];
    a.estado = 'bajando';
    a.botella = i;
    a.malla.position.x = b.x;
    a.malla.position.z = b.z;
    a.bajar = CAJA.y + 0.215 - b.aros * 0.02;
    b.aros += 1;
    encestados += 1;
    const valor = valorDe(i);
    puntos += valor;
    tmp.set(b.x, CAJA.y + ALTO_BOTELLA + 0.08, b.z);
    const nivel = valor >= 5 ? 'grande' : valor >= 3 ? 'medio' : 'pequeño';
    ctx.efectos.impacto(nivel, { pos: tmp, color: i === dorada ? 0xffc83a : COLORES_FILA[b.valor - 1], sonido: 'aro' });
    ctx.efectos.texto(tmp, `+${valor}`, { color: i === dorada ? '#ffd54f' : '#ffffff', tam: valor >= 3 ? 1.2 : 0.9 });
    if (i === dorada) {
      aviso = ctx.t('dorada');
      tiempoAviso = 1.6;
    }
  }

  function actualizarMarcador() {
    if (estado === 'intro') {
      const intro = ctx.enVR() ? ctx.t('intro') : ctx.t(ctx.tactil ? 'introTactil' : 'introRaton');
      marcador.escribir([
        { texto: ctx.t('titulo'), tam: 1.3, color: '#ffd23f' },
        { texto: intro, tam: 0.72 },
      ]);
    } else if (estado === 'fin') {
      marcador.escribir([
        { texto: ctx.t('fin', { n: puntos, aros: encestados, total: N_AROS }), tam: 1.1, color: '#ffd23f' },
        { texto: ctx.t('partida.recordNuevaPartida', { record, n: Math.max(1, Math.ceil(reloj)) }), tam: 0.72 },
      ]);
    } else {
      marcador.escribir([
        { texto: ctx.t('marcador', { puntos, n: N_AROS - lanzados }), tam: 1.15 },
        { texto: tiempoAviso > 0 ? aviso : ctx.t('partida.record', { record }), tam: 0.8, color: tiempoAviso > 0 ? '#ffe08a' : '#cfd8dc' },
      ]);
    }
  }

  // ─── Entrada ───────────────────────────────────────────────────────────
  function entradaVR(dt) {
    ctx.manos.forEach((mano, k) => {
      const h = historiales[k];
      h.n = (h.n + 1) % 8;
      h.pos[h.n].copy(mano.posicion);
      h.dt[h.n] = dt;
      if (!mano.activa) return;
      const cogido = aros.find((a) => a.mano === mano);
      if (cogido) {
        if (!mano.gatillo) {
          const atras = (h.n + 8 - 4) % 8;
          let tiempo = 0;
          for (let j = 0; j < 4; j++) tiempo += h.dt[(h.n + 8 - j) % 8];
          tmp.copy(h.pos[h.n]).sub(h.pos[atras]).divideScalar(Math.max(tiempo, 1e-3)).multiplyScalar(1.1);
          lanzar(cogido, tmp);
          ctx.vibrar(mano, 0.3, 30);
        }
        return;
      }
      if (mano.gatilloPulsado && estado === 'juego') {
        // El de arriba del poste, si la mano está cerca
        const arriba = aros.filter((a) => a.estado === 'poste').sort((x, y) => y.malla.position.y - x.malla.position.y)[0];
        if (arriba && arriba.malla.position.distanceTo(mano.posicion) < 0.2) {
          arriba.estado = 'mano';
          arriba.mano = mano;
          ctx.vibrar(mano, 0.25, 25);
          ctx.sonido('recepcion');
        }
      }
    });
    for (const a of aros) {
      if (a.estado !== 'mano') continue;
      a.mano.grip.localToWorld(a.malla.position.set(0, 0, -0.09));
      a.malla.rotation.set(0, 0, 0);
    }
  }

  function entradaRaton() {
    if (!ctx.raton.clic || estado !== 'juego') return;
    const a = aros.find((x) => x.estado === 'poste');
    if (!a) return;
    if (!ctx.raton.rayo.ray.intersectPlane(planoApunte, tmp)) return;
    // El pulso tiembla un poco: unos centímetros al azar
    const ang = Math.random() * Math.PI * 2;
    const err = Math.random() * 0.055;
    tmp.x += Math.cos(ang) * err;
    tmp.z += Math.sin(ang) * err;
    a.malla.position.copy(MANO_RATON);
    tmp2.copy(tmp).sub(MANO_RATON);
    const t = 0.55 + Math.hypot(tmp2.x, tmp2.z) * 0.12;
    tmp2.divideScalar(t);
    tmp2.y += 0.5 * G * t;
    lanzar(a, tmp2);
  }

  // ─── Física de los aros ────────────────────────────────────────────────
  function moverAros(dt, t) {
    const techo = CAJA.y + ALTO_BOTELLA;
    for (const a of aros) {
      if (a.estado === 'bajando') {
        // Baja por el cuello girando hasta quedarse
        a.malla.position.y += (a.bajar - a.malla.position.y) * Math.min(1, dt * 10);
        a.malla.rotation.y += dt * 4;
        a.malla.rotation.x *= 0.85;
        if (Math.abs(a.malla.position.y - a.bajar) < 0.002) a.estado = 'quieto';
        continue;
      }
      if (a.estado !== 'vuelo') continue;
      a.vida -= dt;
      const p = a.malla.position;
      const yAntes = p.y;
      a.vel.y -= G * dt;
      p.addScaledVector(a.vel, dt);
      a.malla.rotation.y += a.giro * dt;
      a.malla.rotation.x = Math.sin(t * 9 + a.i) * a.balanceo;
      ctx.colocarSombra(a.sombra, p, Math.abs(p.x - CAJA.x) < 0.48 && Math.abs(p.z - CAJA.z) < 0.48 ? CAJA.y + 0.003 : 0.006);
      // Al cruzar la altura de las bocas, ¿entra en alguna?
      if (a.vel.y < 0 && yAntes >= techo && p.y < techo) {
        for (let i = 0; i < botellas.length; i++) {
          const b = botellas[i];
          const d = Math.hypot(p.x - b.x, p.z - b.z);
          if (d < R_ARO - R_CUELLO - TUBO_ARO * 0.5) {
            encestar(a, i);
            break;
          }
          if (d < R_ARO + R_CUELLO + TUBO_ARO) {
            // Da en el cuello y rebota hacia fuera
            tmp.set(p.x - b.x, 0, p.z - b.z).normalize();
            if (d > R_ARO) tmp.negate();
            a.vel.set(tmp.x * 0.9, 0.9, tmp.z * 0.9);
            a.balanceo = 0.5;
            ctx.sonido('clac');
            break;
          }
        }
        if (a.estado !== 'vuelo') continue;
      }
      // Cae dentro de la caja o al suelo
      const dentroCaja = Math.abs(p.x - CAJA.x) < 0.46 && Math.abs(p.z - CAJA.z) < 0.46;
      const suelo = dentroCaja ? CAJA.y + 0.01 : 0.01;
      if (p.y < suelo) {
        p.y = suelo;
        a.estado = 'quieto';
        a.malla.rotation.x = 0;
        // Fallo: sonido distinto y sin celebración
        ctx.sonido('fallo');
        tmp.copy(p);
        tmp.y += 0.1;
        ctx.efectos.texto(tmp, ctx.t('fuera'), { color: '#cfd8dc', tam: 0.7 });
        continue;
      }
      if (a.vida <= 0) {
        a.estado = 'quieto';
        a.malla.visible = a.sombra.visible = false;
      }
    }
  }

  // ─── Bucle ─────────────────────────────────────────────────────────────
  function actualizar(dt, t) {
    reloj -= dt;
    tiempoAviso -= dt;
    if ((estado === 'intro' || estado === 'fin') && reloj <= 0) empezarPartida();

    if (ctx.enVR()) entradaVR(dt);
    else entradaRaton();
    moverAros(dt, t);

    // Cuando se han lanzado todos y ya no queda ninguno en el aire, se acaba
    if (estado === 'juego' && lanzados >= N_AROS && !aros.some((a) => a.estado === 'vuelo' || a.estado === 'mano' || a.estado === 'bajando')) {
      espera += dt;
      if (espera > 1) terminar();
    }
    actualizarMarcador();
  }

  for (const a of aros) enPoste(a);
  actualizarMarcador();

  return {
    actualizar,
    liberar() {},
  };
}
