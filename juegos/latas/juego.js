// TUMBA LATAS
// La caseta de feria de toda la vida, de noche: una pirámide de latas en un estante y
// tres pelotas para tirarlas. 5 rondas, cada una más difícil (más latas, más lejos y, en
// la última, el estante se mueve). 1 punto por lata que cae del estante; tirarlas todas
// da 5 más y otros 5 por cada pelota que sobra.
// En VR coges una pelota de la bandeja con el gatillo y la lanzas soltándolo. Sin gafas,
// haz clic (o toca) donde quieras tirar.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código.
export async function precargar() {}

const R_LATA = 0.055;
const ALTO_LATA = 0.18;
const R_BOLA = 0.036;
const G = 9.8;
const ESTANTE_Y = 1.0;            // altura de la tabla del estante
const BOLAS_RONDA = 3;
// Rondas: filas de la pirámide (de abajo arriba), distancia y si el estante se mueve
const RONDAS = [
  { filas: [3, 2, 1], z: -2.6, mueve: 0 },
  { filas: [3, 2, 1], z: -3.1, mueve: 0 },
  { filas: [4, 3, 2, 1], z: -2.9, mueve: 0 },
  { filas: [4, 3, 2, 1], z: -3.3, mueve: 0 },
  { filas: [4, 3, 2, 1], z: -3.1, mueve: 0.35 },
];
const MAX_LATAS = 10;
const BANDEJA = new THREE.Vector3(0.32, 0.97, -0.42);   // bandeja de pelotas en el mostrador
const MANO_RATON = new THREE.Vector3(0.22, 1.32, -0.25); // desde donde lanza el ratón

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (r) => ctx.recurso(r);

  ctx.fondo(0x1a1f3c, {
    cenit: 0x0b0d22, horizonte: 0x2e2a52, estrellas: 0.8, luna: true, sol: [-0.4, 0.5, -0.8], niebla: [14, 45],
    paisaje: { tipo: 'colinas', color: 0x1d2440, radio: 50 },
  });
  ctx.sueloBase(false);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.5, -0.1), new THREE.Vector3(0, 1.15, -3));

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

  // ─── La caseta ─────────────────────────────────────────────────────────
  const suelo = new THREE.Mesh(
    R(new THREE.PlaneGeometry(40, 40)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tablas(0x6b4a33, { tablas: 40, repetir: [1, 1], semilla: 61 })) })),
  );
  suelo.rotation.x = -Math.PI / 2;
  raiz.add(suelo);
  // Toldo a rayas rojas y blancas
  const texRayas = R(ctx.texturaCanvas((g, tam) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#f4efe6' : '#d6283a';
      g.fillRect((i * tam) / 8, 0, tam / 8, tam);
    }
  }, { tam: 128, repetir: [3, 1] }));
  const matRayas = R(new THREE.MeshLambertMaterial({ map: texRayas, side: THREE.DoubleSide }));
  const toldo = new THREE.Mesh(fusionar([
    colocar(new THREE.PlaneGeometry(3.2, 1.2), 0, 2.55, -1.0, -1.2),
    colocar(new THREE.PlaneGeometry(3.2, 3.6), 0, 2.85, -2.8, -Math.PI / 2 + 0.05),
    colocar(new THREE.PlaneGeometry(3.6, 2.9), -1.6, 1.45, -2.6, 0, Math.PI / 2),
    colocar(new THREE.PlaneGeometry(3.6, 2.9), 1.6, 1.45, -2.6, 0, -Math.PI / 2),
  ]), matRayas);
  raiz.add(toldo);
  // Fondo de la caseta: telón
  const telon = new THREE.Mesh(
    R(new THREE.PlaneGeometry(3.2, 2.9)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tela(0x3a1a4a, { repetir: [4, 3], semilla: 62 })) })),
  );
  telon.position.set(0, 1.45, -4.3);
  raiz.add(telon);
  // Mostrador delante del jugador y postes
  const matMadera = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.madera(0xa86a3a, { semilla: 63 })) }));
  const mostrador = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(3.0, 0.06, 0.4), 0, 0.92, -0.45),
    colocar(new THREE.BoxGeometry(3.0, 0.9, 0.05), 0, 0.45, -0.62),
    colocar(new THREE.BoxGeometry(0.1, 2.6, 0.1), -1.55, 1.3, -0.62),
    colocar(new THREE.BoxGeometry(0.1, 2.6, 0.1), 1.55, 1.3, -0.62),
  ]), matMadera);
  raiz.add(mostrador);
  // Frontal del mostrador pintado
  const frontal = new THREE.Mesh(
    R(new THREE.PlaneGeometry(3.0, 0.8)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturaCanvas((g, tam) => {
      g.fillStyle = '#1f6fb2';
      g.fillRect(0, 0, tam, tam);
      g.fillStyle = '#ffd23f';
      for (let i = 0; i < 12; i++) {
        g.beginPath();
        g.arc((i + 0.5) * tam / 12, tam * 0.5, tam * 0.03, 0, Math.PI * 2);
        g.fill();
      }
      g.fillStyle = '#ff6a3d';
      g.fillRect(0, tam * 0.08, tam, tam * 0.06);
      g.fillRect(0, tam * 0.86, tam, tam * 0.06);
    }, { tam: 256 })) })),
  );
  frontal.position.set(0, 0.48, -0.59);
  raiz.add(frontal);
  // Bandeja de pelotas
  const bandeja = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(0.3, 0.02, 0.16), BANDEJA.x, BANDEJA.y - 0.035, BANDEJA.z),
    colocar(new THREE.BoxGeometry(0.3, 0.04, 0.015), BANDEJA.x, BANDEJA.y - 0.02, BANDEJA.z - 0.08),
    colocar(new THREE.BoxGeometry(0.3, 0.04, 0.015), BANDEJA.x, BANDEJA.y - 0.02, BANDEJA.z + 0.08),
  ]), R(new THREE.MeshLambertMaterial({ color: 0x3a2a1c })));
  raiz.add(bandeja);
  // Guirnalda de bombillas
  const N_BOMBILLAS = 26;
  const bombillas = new THREE.InstancedMesh(R(new THREE.SphereGeometry(0.035, 10, 8)), R(new THREE.MeshBasicMaterial({ toneMapped: false })), N_BOMBILLAS);
  const COLORES_BOMBILLA = [0xffd23f, 0xff6a3d, 0x7ef0ff, 0xff7ad9];
  const colorTmp = new THREE.Color();
  for (let i = 0; i < N_BOMBILLAS; i++) {
    const u = i / (N_BOMBILLAS - 1);
    const x = -1.5 + u * 3;
    bombillas.setMatrixAt(i, matrizTmp.makeTranslation(x, 2.08 - Math.sin(u * Math.PI * 3) ** 2 * 0.12, -0.7));
    bombillas.setColorAt(i, colorTmp.set(COLORES_BOMBILLA[i % 4]));
  }
  raiz.add(bombillas);
  // Casetas vecinas a los lados (solo la silueta con su toldo)
  const vecinas = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(2.6, 2.6, 2.6), -4.2, 1.3, -2.2),
    colocar(new THREE.BoxGeometry(2.6, 2.6, 2.6), 4.2, 1.3, -2.4),
    colocar(new THREE.ConeGeometry(2.0, 1.0, 4), -4.2, 3.1, -2.2, 0, Math.PI / 4),
    colocar(new THREE.ConeGeometry(2.0, 1.0, 4), 4.2, 3.1, -2.4, 0, Math.PI / 4),
  ]), matRayas);
  raiz.add(vecinas);

  // ─── Estante (se puede mover en la última ronda) ───────────────────────
  const estante = new THREE.Group();
  raiz.add(estante);
  const tablaEstante = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(1.0, 0.04, 0.4), 0, ESTANTE_Y - 0.02, 0),
    colocar(new THREE.BoxGeometry(0.06, ESTANTE_Y - 0.04, 0.06), -0.38, (ESTANTE_Y - 0.04) / 2, 0),
    colocar(new THREE.BoxGeometry(0.06, ESTANTE_Y - 0.04, 0.06), 0.38, (ESTANTE_Y - 0.04) / 2, 0),
  ]), matMadera);
  estante.add(tablaEstante);
  const sombraEstante = ctx.crearSombra({ radio: 0.5, opacidad: 0.45 });
  sombraEstante.position.y = 0.006;
  estante.add(sombraEstante);

  // ─── Latas (una InstancedMesh: etiqueta y tapas) ───────────────────────
  const texEtiqueta = R(ctx.texturaCanvas((g, tam) => {
    const colores = ['#e53935', '#1e88e5', '#43a047', '#fdd835'];
    for (let i = 0; i < 4; i++) {
      g.fillStyle = colores[i];
      g.fillRect((i * tam) / 4, 0, tam / 4, tam);
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc((i + 0.5) * tam / 4, tam * 0.5, tam * 0.07, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#d0d4d8';
    g.fillRect(0, 0, tam, tam * 0.1);
    g.fillRect(0, tam * 0.9, tam, tam * 0.1);
  }, { tam: 256 }));
  const geoLata = R(new THREE.CylinderGeometry(R_LATA, R_LATA, ALTO_LATA, 20, 1));
  const matEtiqueta = R(new THREE.MeshStandardMaterial({ map: texEtiqueta, roughness: 0.35, metalness: 0.45 }));
  const matTapa = R(new THREE.MeshStandardMaterial({ color: 0xc9ced4, roughness: 0.25, metalness: 0.9 }));
  const mallaLatas = new THREE.InstancedMesh(geoLata, [matEtiqueta, matTapa, matTapa], MAX_LATAS);
  mallaLatas.frustumCulled = false;
  raiz.add(mallaLatas);
  const latas = Array.from({ length: MAX_LATAS }, (_, i) => ({
    i,
    activa: false,
    de_pie: true,
    caida: false,         // ya ha contado
    local: new THREE.Vector3(), // posición en el estante (de pie)
    apoyos: [],           // índices de las latas en las que se apoya
    pos: new THREE.Vector3(),
    vel: new THREE.Vector3(),
    giro: new THREE.Quaternion(),
    velGiro: new THREE.Vector3(),
    quieta: 0,
  }));
  const sombrasLatas = latas.map(() => {
    const s = ctx.crearSombra({ radio: 0.06, opacidad: 0.35 });
    s.visible = false;
    raiz.add(s);
    return s;
  });

  // ─── Pelotas ───────────────────────────────────────────────────────────
  const texPelota = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#f6f3ea';
    g.fillRect(0, 0, tam, tam);
    g.strokeStyle = '#ff6a3d';
    g.lineWidth = tam * 0.035;
    for (const d of [0, tam / 2]) {
      g.beginPath();
      for (let x = 0; x <= tam / 2; x += 2) g.lineTo(d + x, tam * 0.5 + Math.sin((x / (tam / 2)) * Math.PI * 2) * tam * 0.22);
      g.stroke();
    }
  }, { tam: 128 }));
  const geoBola = R(new THREE.SphereGeometry(R_BOLA, 20, 14));
  const matBola = R(new THREE.MeshStandardMaterial({ map: texPelota, roughness: 0.6 }));
  const bolas = Array.from({ length: BOLAS_RONDA }, (_, i) => {
    const malla = new THREE.Mesh(geoBola, matBola);
    raiz.add(malla);
    const sombra = ctx.crearSombra({ radio: 0.05, opacidad: 0.35 });
    raiz.add(sombra);
    return { i, malla, sombra, estado: 'bandeja', mano: null, vel: new THREE.Vector3(), vida: 0, choco: false };
  });

  // Historial de posiciones de cada mano para la velocidad del lanzamiento
  const historiales = ctx.manos.map(() => ({ pos: Array.from({ length: 8 }, () => new THREE.Vector3()), dt: new Array(8).fill(0.016), n: 0 }));

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.1, alto: 0.32 });
  marcador.mesh.position.set(0, 2.3, -2.2);
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'ronda' | 'entreRondas' | 'fin'
  let reloj = 3;
  let ronda = 0;
  let puntos = 0;
  let record = ctx.leer('record', 0);
  let tiradas = 0;
  let nLatas = 0;
  let caidasRonda = 0;
  let tiempoEstante = 0;
  let aviso = '';
  let tiempoAviso = 0;
  let esperaFinRonda = 0;
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const qTmp = new THREE.Quaternion();
  const escUno = new THREE.Vector3(1, 1, 1);
  const planoApunte = new THREE.Plane(new THREE.Vector3(0, 0, 1), 3);

  function montarRonda() {
    const def = RONDAS[ronda];
    estante.position.set(0, 0, def.z);
    planoApunte.constant = -def.z;
    tiempoEstante = 0;
    let k = 0;
    const filaIndices = [];
    def.filas.forEach((n, fila) => {
      const indices = [];
      for (let j = 0; j < n; j++) {
        const l = latas[k];
        l.activa = true;
        l.de_pie = true;
        l.caida = false;
        l.local.set((j - (n - 1) / 2) * (R_LATA * 2 + 0.004), ESTANTE_Y + ALTO_LATA / 2 + fila * (ALTO_LATA + 0.002), 0);
        l.apoyos = fila === 0 ? [] : [filaIndices[fila - 1][j], filaIndices[fila - 1][j + 1]];
        l.giro.identity();
        l.vel.set(0, 0, 0);
        l.quieta = 0;
        indices.push(k);
        k++;
      }
      filaIndices.push(indices);
    });
    nLatas = k;
    for (let i = k; i < MAX_LATAS; i++) latas[i].activa = false;
    mallaLatas.count = nLatas;
    caidasRonda = 0;
    tiradas = 0;
    esperaFinRonda = 0;
    for (const b of bolas) ponerEnBandeja(b);
    estado = 'ronda';
    aviso = ctx.t('ronda', { n: ronda + 1, total: RONDAS.length });
    tiempoAviso = 1.8;
  }

  function ponerEnBandeja(b) {
    b.estado = 'bandeja';
    b.mano = null;
    b.malla.visible = true;
    b.malla.position.set(BANDEJA.x - 0.09 + b.i * 0.09, BANDEJA.y, BANDEJA.z);
    b.sombra.visible = false;
  }

  function empezarPartida() {
    ronda = 0;
    puntos = 0;
    montarRonda();
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

  function lanzar(b, vel) {
    b.estado = 'vuelo';
    b.mano = null;
    b.vel.copy(vel);
    b.vida = 4;
    b.choco = false;
    b.sombra.visible = true;
    tiradas += 1;
    ctx.sonido('zas');
  }

  // Una lata de pie pasa a moverse
  function soltarLata(l, vel) {
    l.de_pie = false;
    l.vel.copy(vel);
    l.velGiro.set((Math.random() - 0.5) * 14 + vel.z * 6, (Math.random() - 0.5) * 6, (Math.random() - 0.5) * 14 - vel.x * 6);
  }

  function golpearLata(l, origen, velOrigen, mano) {
    tmp.copy(velOrigen).multiplyScalar(0.55);
    tmp.y += 1.2 + Math.random() * 0.8;
    tmp.x += (l.pos.x - origen.x) * 8;
    soltarLata(l, tmp);
    ctx.efectos.impacto('pequeño', { pos: l.pos, mano, color: 0xffd23f, sonido: 'lata' });
  }

  // ¿Choca una esfera (bola o lata en vuelo) con una lata de pie?
  function chocaConDePie(p, radio, l) {
    const dy = p.y - l.pos.y;
    if (Math.abs(dy) > ALTO_LATA / 2 + radio) return false;
    return Math.hypot(p.x - l.pos.x, p.z - l.pos.z) < R_LATA + radio;
  }

  function contarCaida(l) {
    if (l.caida) return;
    l.caida = true;
    caidasRonda += 1;
    puntos += 1;
    tmp2.copy(l.pos);
    tmp2.y = Math.max(tmp2.y, ESTANTE_Y) + 0.15;
    ctx.efectos.texto(tmp2, '+1', { color: '#ffd23f', tam: 1 });
    if (caidasRonda === nLatas) {
      // ¡Todas! Bonificación por las pelotas que sobran
      const sobran = BOLAS_RONDA - tiradas;
      const extra = 5 + sobran * 5;
      puntos += extra;
      tmp2.set(estante.position.x, ESTANTE_Y + 0.5, estante.position.z);
      ctx.efectos.impacto(sobran > 0 ? 'grande' : 'medio', { pos: tmp2, color: 0xff6a3d, sonido: 'ovacion' });
      ctx.efectos.texto(tmp2, `+${extra}`, { color: '#ff6a3d', tam: 1.5 });
      aviso = sobran > 0 ? ctx.t('pleno', { n: extra }) : ctx.t('todas', { n: extra });
      tiempoAviso = 2;
      esperaFinRonda = Math.max(esperaFinRonda, 1.8);
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
        { texto: ctx.t('partida.finPuntos', { n: puntos }), tam: 1.3, color: '#ffd23f' },
        { texto: ctx.t('partida.recordNuevaPartida', { record, n: Math.max(1, Math.ceil(reloj)) }), tam: 0.72 },
      ]);
    } else {
      marcador.escribir([
        { texto: ctx.t('marcador', { ronda: ronda + 1, total: RONDAS.length, puntos }), tam: 1.15 },
        { texto: tiempoAviso > 0 ? aviso : ctx.t('pelotas', { n: BOLAS_RONDA - tiradas }), tam: 0.8, color: tiempoAviso > 0 ? '#ffe08a' : '#cfd8dc' },
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
      const cogida = bolas.find((b) => b.mano === mano);
      if (cogida) {
        if (!mano.gatillo) {
          // Velocidad media de los últimos fotogramas
          const atras = (h.n + 8 - 4) % 8;
          let tiempo = 0;
          for (let j = 0; j < 4; j++) tiempo += h.dt[(h.n + 8 - j) % 8];
          tmp.copy(h.pos[h.n]).sub(h.pos[atras]).divideScalar(Math.max(tiempo, 1e-3)).multiplyScalar(1.15);
          lanzar(cogida, tmp);
          ctx.vibrar(mano, 0.3, 30);
        }
        return;
      }
      if (mano.gatilloPulsado && estado === 'ronda') {
        let mejor = null;
        let dist = 0.14;
        for (const b of bolas) {
          if (b.estado !== 'bandeja') continue;
          const d = b.malla.position.distanceTo(mano.posicion);
          if (d < dist) {
            dist = d;
            mejor = b;
          }
        }
        if (mejor) {
          mejor.estado = 'mano';
          mejor.mano = mano;
          ctx.vibrar(mano, 0.25, 25);
          ctx.sonido('recepcion');
        }
      }
    });
    for (const b of bolas) {
      if (b.estado === 'mano') {
        b.mano.grip.localToWorld(b.malla.position.set(0, -0.01, -0.05));
      }
    }
  }

  function entradaRaton() {
    if (!ctx.raton.clic || estado !== 'ronda') return;
    const b = bolas.find((x) => x.estado === 'bandeja');
    if (!b) return;
    if (!ctx.raton.rayo.ray.intersectPlane(planoApunte, tmp)) return;
    // Tiro parabólico desde la mano hasta el punto apuntado
    b.malla.position.copy(MANO_RATON);
    tmp2.copy(tmp).sub(MANO_RATON);
    const t = Math.hypot(tmp2.x, tmp2.z) / 9;
    tmp2.divideScalar(t);
    tmp2.y += 0.5 * G * t;
    lanzar(b, tmp2);
  }

  // ─── Física ────────────────────────────────────────────────────────────
  function moverBolas(dt) {
    for (const b of bolas) {
      if (b.estado !== 'vuelo') continue;
      b.vida -= dt;
      b.vel.y -= G * dt;
      b.malla.position.addScaledVector(b.vel, dt);
      b.malla.rotation.x -= b.vel.z * dt * 10;
      const p = b.malla.position;
      // Latas de pie y en vuelo
      for (let i = 0; i < nLatas; i++) {
        const l = latas[i];
        if (l.de_pie) {
          if (chocaConDePie(p, R_BOLA, l)) {
            golpearLata(l, p, b.vel, null);
            b.vel.multiplyScalar(0.55);
            b.vel.z = Math.abs(b.vel.z) * (b.vel.z < 0 ? -1 : 1);
            if (!b.choco) ctx.vibrar(ctx.manos[0], 0.2, 20);
            b.choco = true;
          }
        } else if (l.pos.distanceTo(p) < R_LATA + R_BOLA) {
          tmp.copy(l.pos).sub(p).normalize();
          l.vel.addScaledVector(tmp, 1.2);
        }
      }
      // Estante, telón y suelo
      const ex = estante.position.x;
      const ez = estante.position.z;
      if (p.y < ESTANTE_Y + R_BOLA && p.y > ESTANTE_Y - 0.06 && Math.abs(p.x - ex) < 0.5 && Math.abs(p.z - ez) < 0.2 && b.vel.y < 0) {
        p.y = ESTANTE_Y + R_BOLA;
        b.vel.y *= -0.4;
        b.vel.x *= 0.7;
        b.vel.z *= 0.7;
        ctx.sonido('bote');
      }
      if (p.z < -4.25) {
        p.z = -4.25;
        b.vel.z *= -0.2;
      }
      if (p.y < R_BOLA) {
        p.y = R_BOLA;
        b.vel.y *= -0.35;
        b.vel.x *= 0.7;
        b.vel.z *= 0.7;
      }
      ctx.colocarSombra(b.sombra, p, 0.006);
      if (b.vida <= 0 || p.z > 1) {
        b.estado = 'usada';
        b.malla.visible = b.sombra.visible = false;
      }
    }
  }

  function moverLatas(dt) {
    const ex = estante.position.x;
    const ez = estante.position.z;
    for (let i = 0; i < nLatas; i++) {
      const l = latas[i];
      if (l.de_pie) {
        l.pos.set(ex + l.local.x, l.local.y, ez + l.local.z);
        // Si falta un apoyo, se cae
        if (l.apoyos.some((k) => !latas[k].de_pie)) {
          tmp.set((Math.random() - 0.5) * 0.6, 0.3, -0.4 - Math.random() * 0.5);
          soltarLata(l, tmp);
        }
        continue;
      }
      l.vel.y -= G * dt;
      l.pos.addScaledVector(l.vel, dt);
      qTmp.setFromEuler(eulerTmp.set(l.velGiro.x * dt, l.velGiro.y * dt, l.velGiro.z * dt));
      l.giro.premultiply(qTmp);
      // Choca con latas de pie
      for (let j = 0; j < nLatas; j++) {
        const o = latas[j];
        if (o === l || !o.de_pie) continue;
        if (chocaConDePie(l.pos, R_LATA * 0.9, o) && l.vel.lengthSq() > 0.3) {
          golpearLata(o, l.pos, l.vel, null);
          l.vel.multiplyScalar(0.6);
        }
      }
      // Tabla del estante
      if (l.pos.y < ESTANTE_Y + R_LATA && l.pos.y > ESTANTE_Y - 0.08 && Math.abs(l.pos.x - ex) < 0.5 && Math.abs(l.pos.z - ez) < 0.2 && l.vel.y < 0) {
        l.pos.y = ESTANTE_Y + R_LATA;
        l.vel.y *= -0.3;
        l.vel.x *= 0.8;
        l.vel.z *= 0.8;
        l.velGiro.multiplyScalar(0.7);
      }
      if (l.pos.z < -4.25) {
        l.pos.z = -4.25;
        l.vel.z *= -0.3;
      }
      if (l.pos.y < R_LATA) {
        if (l.vel.y < -1.2) ctx.sonido('lataSuelo');
        l.pos.y = R_LATA;
        l.vel.y *= -0.3;
        l.vel.x *= 0.85;
        l.vel.z *= 0.85;
        l.velGiro.multiplyScalar(0.8);
      }
      if (l.pos.y < ESTANTE_Y - 0.1) contarCaida(l);
      l.quieta = l.vel.lengthSq() < 0.02 ? l.quieta + dt : 0;
    }
  }

  function dibujarLatas() {
    for (let i = 0; i < nLatas; i++) {
      const l = latas[i];
      matrizTmp.compose(l.pos, l.de_pie ? qTmp.identity() : l.giro, escUno);
      mallaLatas.setMatrixAt(i, matrizTmp);
      const s = sombrasLatas[i];
      s.visible = !l.de_pie;
      if (s.visible) ctx.colocarSombra(s, l.pos, l.pos.y > ESTANTE_Y - 0.1 && Math.abs(l.pos.x - estante.position.x) < 0.5 ? ESTANTE_Y + 0.003 : 0.006);
    }
    for (let i = nLatas; i < MAX_LATAS; i++) sombrasLatas[i].visible = false;
    mallaLatas.instanceMatrix.needsUpdate = true;
  }

  // ─── Bucle ─────────────────────────────────────────────────────────────
  function actualizar(dt, t) {
    reloj -= dt;
    tiempoAviso -= dt;
    if ((estado === 'intro' || estado === 'fin') && reloj <= 0) empezarPartida();

    if (ctx.enVR()) entradaVR(dt);
    else entradaRaton();

    // Estante que se mueve en la última ronda
    const def = RONDAS[ronda];
    if (estado === 'ronda' && def.mueve) {
      tiempoEstante += dt;
      estante.position.x = Math.sin(tiempoEstante * 0.9) * def.mueve;
    } else if (estado !== 'entreRondas') {
      estante.position.x *= 0.9;
    }

    moverBolas(dt);
    moverLatas(dt);
    dibujarLatas();

    // Brillo de la guirnalda
    bombillas.rotation.y = 0;
    bombillas.position.y = Math.sin(t * 1.3) * 0.004;

    if (estado === 'ronda') {
      const quedanBolas = bolas.some((b) => b.estado === 'bandeja' || b.estado === 'mano' || b.estado === 'vuelo');
      const todas = caidasRonda === nLatas;
      if (todas || !quedanBolas) {
        esperaFinRonda = Math.max(esperaFinRonda, 1.2);
        estado = 'entreRondas';
        reloj = esperaFinRonda;
        if (!todas) {
          aviso = ctx.t('quedan', { n: nLatas - caidasRonda });
          tiempoAviso = 1.6;
          ctx.sonido('fallo');
        }
        for (const b of bolas) if (b.estado === 'bandeja') b.malla.visible = false;
      }
    } else if (estado === 'entreRondas' && reloj <= 0) {
      ronda += 1;
      if (ronda >= RONDAS.length) {
        ronda = RONDAS.length - 1;
        terminar();
      } else {
        montarRonda();
      }
    }
    actualizarMarcador();
  }

  for (let i = 0; i < MAX_LATAS; i++) latas[i].activa = false;
  mallaLatas.count = 0;
  for (const b of bolas) ponerEnBandeja(b);
  actualizarMarcador();

  return {
    actualizar,
    liberar() {},
  };
}
