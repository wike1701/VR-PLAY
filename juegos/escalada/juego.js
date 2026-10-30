// ESCALADA CONTRA LA LAVA
// Una pared de roca volcánica en un cañón al atardecer, y abajo, un río de lava que sube. Agarra las
// presas y tira hacia abajo para subir, mano tras mano: la pared solo se mueve lo que tiran tus manos
// (1:1), nunca sola, así que no marea. Si sueltas las dos manos te caes, y si la lava te alcanza,
// también. Cuanto más alto, más separadas están las presas y más deprisa sube la lava; además salen
// presas que se desmoronan (agrietadas, rojizas), que resbalan (azuladas, húmedas) y que se mueven.
// Puntúan los metros subidos.
// Sin gafas: haz clic (o toca) en una presa a tu alcance para subir hasta ella.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código.
export async function precargar() {}

const PARED_Z = -0.45;          // la pared, delante de ti
const PRESA_Z = PARED_Z + 0.04;
const ALCANCE_MANO = 0.15;      // a qué distancia de la mano se agarra una presa
const ALCANCE_RATON = 1.0;      // con ratón, hasta dónde llegas desde la presa en la que estás
const VEL_RATON = 1.1;          // y a qué velocidad subes (m/s), como escalando con las manos
const ANCLA = new THREE.Vector3(0, 1.75, PRESA_Z); // con ratón, donde queda la presa que agarras
const LAVA_INICIO = -3;
const MAX_PRESAS = 90;          // presas dibujadas a la vez (por tipo)
const TIPOS = ['normal', 'quebradiza', 'resbaladiza', 'movil'];

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (r) => ctx.recurso(r);

  ctx.fondo(0xff8a4a, {
    cenit: 0x2a1236, horizonte: 0xff9a4a, suelo: 0x2a0e08, niebla: [20, 90],
    sol: [0.3, 0.08, -1], paisaje: { tipo: 'montes', color: 0x3a1a20, radio: 120 },
  });
  ctx.sueloBase(false);
  ctx.vistaEscritorio(new THREE.Vector3(0.95, 1.45, 1.5), new THREE.Vector3(0, 1.95, PARED_Z));

  const matriz = new THREE.Matrix4();
  const cuaternion = new THREE.Quaternion();
  const escala = new THREE.Vector3();
  const posicion = new THREE.Vector3();
  const euler = new THREE.Euler();
  const color = new THREE.Color();
  function colocar(geo, x, y, z, rx = 0, ry = 0, rz = 0) {
    matriz.makeRotationFromEuler(euler.set(rx, ry, rz)).setPosition(x, y, z);
    return geo.applyMatrix4(matriz);
  }
  // Une geometrías del mismo material en una sola (una llamada de dibujo)
  function fusionarSimple(geos) {
    let nv = 0;
    let ni = 0;
    for (const g of geos) { nv += g.attributes.position.count; ni += g.index.count; }
    const pos = new Float32Array(nv * 3);
    const nor = new Float32Array(nv * 3);
    const uv = new Float32Array(nv * 2);
    const indices = new Uint32Array(ni);
    let ov = 0;
    let oi = 0;
    for (const g of geos) {
      pos.set(g.attributes.position.array, ov * 3);
      nor.set(g.attributes.normal.array, ov * 3);
      uv.set(g.attributes.uv.array, ov * 2);
      for (let i = 0; i < g.index.count; i++) indices[oi++] = g.index.array[i] + ov;
      ov += g.attributes.position.count;
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    return R(geo);
  }
  const luzSumada = (opciones = {}) => R(new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, ...opciones }));

  // Todo lo que sube y baja cuando escalas va en «mundo»; tú te quedas quieto en «raiz»
  const mundo = new THREE.Group();
  raiz.add(mundo);

  // ─── Cañón ─────────────────────────────────────────────────────────────
  function texturaRoca(semilla, base, vetas) {
    return R(ctx.texturaCanvas((g, tam) => {
      let s = semilla;
      const azar = () => ((s = (s * 16807) % 2147483647) / 2147483647);
      g.fillStyle = base;
      g.fillRect(0, 0, tam, tam);
      // Manchas de roca
      for (let i = 0; i < 260; i++) {
        const x = azar() * tam;
        const y = azar() * tam;
        const r = 4 + azar() * 26;
        g.fillStyle = `rgba(${azar() < 0.5 ? '0,0,0' : '120,90,80'},${0.05 + azar() * 0.12})`;
        g.beginPath();
        g.ellipse(x, y, r, r * (0.4 + azar() * 0.6), azar() * 3, 0, Math.PI * 2);
        g.fill();
      }
      // Grietas
      g.lineWidth = 1.5;
      for (let i = 0; i < 26; i++) {
        let x = azar() * tam;
        let y = azar() * tam;
        g.strokeStyle = `rgba(10,5,5,${0.4 + azar() * 0.4})`;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 6; k++) {
          x += (azar() - 0.5) * 30;
          y += azar() * 24;
          g.lineTo(x, y);
        }
        g.stroke();
      }
      // Vetas de brasa
      g.strokeStyle = vetas;
      g.lineWidth = 2;
      for (let i = 0; i < 5; i++) {
        let x = azar() * tam;
        let y = azar() * tam;
        g.beginPath();
        g.moveTo(x, y);
        for (let k = 0; k < 5; k++) {
          x += (azar() - 0.5) * 40;
          y += 10 + azar() * 20;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    }, { tam: 512, repetir: [1, 1], semilla }));
  }
  const ALTO_PARED = 640;
  // La aguja de roca por la que subes, en medio del cañón
  const ANCHO_AGUJA = 4.6;
  const texPared = texturaRoca(911, '#4a362e', 'rgba(255,110,40,0.4)');
  texPared.repeat.set(ANCHO_AGUJA / 2, ALTO_PARED / 2);
  const pared = new THREE.Mesh(R(new THREE.BoxGeometry(ANCHO_AGUJA, ALTO_PARED, 3)), R(new THREE.MeshStandardMaterial({ map: texPared, roughness: 0.95, metalness: 0 })));
  pared.position.set(0, ALTO_PARED / 2 - 20, PARED_Z - 1.5);
  mundo.add(pared);
  // Otras agujas más lejos, por el cañón (las montañas del horizonte las pone ctx.fondo)
  const texLados = texturaRoca(313, '#5a3626', 'rgba(255,120,50,0.2)');
  texLados.repeat.set(2, ALTO_PARED / 8);
  const agujas = [];
  for (const [x, z, a] of [[-7, -9, 3], [8, -14, 4], [-14, -20, 5], [3.5, -26, 6], [16, -6, 3.5]]) {
    agujas.push(colocar(new THREE.CylinderGeometry(a * 0.45, a * 0.6, ALTO_PARED, 7), x, ALTO_PARED / 2 - 40, z));
  }
  mundo.add(new THREE.Mesh(fusionarSimple(agujas), R(new THREE.MeshLambertMaterial({ map: texLados }))));
  // Repisa de salida, donde empiezas de pie
  const repisa = new THREE.Mesh(R(colocar(new THREE.CylinderGeometry(1.6, 1.3, 1.2, 9, 1), 0, -0.6, 0.15)), R(new THREE.MeshLambertMaterial({ map: R(texturaRoca(77, '#4a3630', 'rgba(255,120,50,0.15)')) })));
  mundo.add(repisa);

  // ─── Lava ──────────────────────────────────────────────────────────────
  const texLava = R(ctx.texturaCanvas((g, tam) => {
    const grad = g.createLinearGradient(0, 0, tam, tam);
    grad.addColorStop(0, '#ff5a10');
    grad.addColorStop(1, '#ff9a20');
    g.fillStyle = grad;
    g.fillRect(0, 0, tam, tam);
    let s = 51;
    const azar = () => ((s = (s * 16807) % 2147483647) / 2147483647);
    for (let i = 0; i < 90; i++) {
      g.fillStyle = azar() < 0.55 ? `rgba(60,10,0,${0.4 + azar() * 0.4})` : `rgba(255,230,120,${0.3 + azar() * 0.5})`;
      g.beginPath();
      g.ellipse(azar() * tam, azar() * tam, 6 + azar() * 30, 4 + azar() * 16, azar() * 3, 0, Math.PI * 2);
      g.fill();
    }
  }, { tam: 256, repetir: [10, 10], semilla: 5 }));
  const lava = new THREE.Mesh(R(new THREE.PlaneGeometry(40, 40)), R(new THREE.MeshBasicMaterial({ map: texLava, toneMapped: false })));
  lava.rotation.x = -Math.PI / 2;
  mundo.add(lava);
  // Resplandor de la lava sobre la pared
  const texResplandor = R(ctx.texturaCanvas((g, tam) => {
    const grad = g.createLinearGradient(0, tam, 0, 0);
    // (transparente también abajo, para que no se cuele un borde al repetirse)
    grad.addColorStop(0, 'rgba(255,110,30,0)');
    grad.addColorStop(0.08, 'rgba(255,110,30,0.9)');
    grad.addColorStop(0.45, 'rgba(255,80,20,0.3)');
    grad.addColorStop(1, 'rgba(255,60,10,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, tam, tam);
  }, { tam: 64 }));
  const resplandor = new THREE.Mesh(R(new THREE.PlaneGeometry(8, 5)), luzSumada({ map: texResplandor }));
  resplandor.position.z = PARED_Z + 0.01;
  mundo.add(resplandor);
  // Chispas que suben de la lava
  const CHISPAS = 50;
  const chispas = new THREE.InstancedMesh(R(new THREE.SphereGeometry(0.015, 6, 4)), luzSumada({ color: 0xffa040 }), CHISPAS);
  chispas.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  chispas.frustumCulled = false;
  mundo.add(chispas);
  const datosChispas = Array.from({ length: CHISPAS }, () => ({ x: 0, y: 0, z: 0, v: 0, vida: 0 }));

  // ─── Presas ────────────────────────────────────────────────────────────
  const geoPresa = R(new THREE.DodecahedronGeometry(0.05, 0).scale(1.35, 0.8, 0.75));
  const materiales = {
    normal: new THREE.MeshStandardMaterial({ color: 0xc89060, roughness: 0.9 }),
    quebradiza: new THREE.MeshStandardMaterial({ color: 0xa04a30, roughness: 1, flatShading: true }),
    resbaladiza: new THREE.MeshStandardMaterial({ color: 0x6aa8d8, roughness: 0.15, metalness: 0.3 }),
    movil: new THREE.MeshStandardMaterial({ color: 0xe8c040, roughness: 0.6 }),
  };
  const mallas = {};
  for (const tipo of TIPOS) {
    const m = new THREE.InstancedMesh(geoPresa, R(materiales[tipo]), MAX_PRESAS);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.count = 0;
    mundo.add(m);
    mallas[tipo] = m;
  }
  // Raíles de las presas móviles y brillo de las presas a tu alcance
  const rieles = new THREE.InstancedMesh(R(new THREE.BoxGeometry(1, 0.02, 0.01)), R(new THREE.MeshBasicMaterial({ color: 0x2a1a12 })), 30);
  rieles.frustumCulled = false;
  rieles.count = 0;
  mundo.add(rieles);
  const halos = new THREE.InstancedMesh(R(new THREE.SphereGeometry(0.085, 12, 8)), luzSumada({ opacity: 0.5 }), 16);
  halos.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  halos.frustumCulled = false;
  halos.count = 0;
  mundo.add(halos);

  // Con ratón, dos guantes enseñan de qué presas cuelgas
  const guantes = [0, 1].map(() => {
    const g = new THREE.Mesh(R(new THREE.SphereGeometry(0.045, 12, 8).scale(1, 0.8, 0.7)), R(new THREE.MeshLambertMaterial({ color: 0x2a6ad8 })));
    g.visible = false;
    mundo.add(g);
    return g;
  });

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 0.54, alto: 0.34 });
  marcador.mesh.position.set(-0.55, 2.2, -0.36);
  marcador.mesh.rotation.y = 0.25;
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let presas = [];
  let semilla = 1;
  let cadena = { x: 0, y: 0.7, centro: 0 };
  let estado = 'listo';    // 'listo' (en la repisa) | 'subiendo' | 'muerte' | 'fin'
  let tEstado = 0;
  let causa = 'caida';
  let nivelLava = LAVA_INICIO;
  let tSubiendo = 0;
  let maxAltura = 0;
  let ultimaAltura = 0;
  let sinManos = 0;
  let hito = 10;
  let record = ctx.leer('record', 0);
  let primeraVez = true;
  const desplaz = new THREE.Vector3();   // posición de «mundo» (x e y)
  const agarres = [0, 1].map(() => ({ presa: null, d: new THREE.Vector3(), pos: new THREE.Vector3(), orden: 0, apretonAntes: false }));
  let ordenAgarre = 0;
  let anclaRaton = null;   // la presa de la que cuelgas con ratón
  let subiendoRaton = false;
  let anclaAnterior = null;
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();

  const altura = () => -desplaz.y;
  function azar() {
    semilla = (semilla * 16807) % 2147483647;
    return semilla / 2147483647;
  }
  // Posición actual de una presa en «mundo» (las móviles van y vienen)
  function posPresa(p, t, salida) {
    return salida.set(p.tipo === 'movil' ? p.x + Math.sin(t * p.vel + p.fase) * p.amplitud : p.x, p.y, PRESA_Z);
  }

  function tipoPara(y) {
    const r = azar();
    const q = y > 6 ? Math.min(0.28, (y - 6) * 0.012) : 0;
    const s = y > 14 ? Math.min(0.2, (y - 14) * 0.01) : 0;
    const m = y > 22 ? Math.min(0.2, (y - 22) * 0.01) : 0;
    if (r < q) return 'quebradiza';
    if (r < q + s) return 'resbaladiza';
    if (r < q + s + m) return 'movil';
    return 'normal';
  }
  function nuevaPresa(x, y, tipo) {
    presas.push({ x, y, tipo, estado: 'ok', t: 0, caida: 0, giro: 0, fase: azar() * 6, vel: 0.8 + azar() * 0.6, amplitud: 0.15 + azar() * 0.1 });
  }
  // Sube la cadena de presas (siempre al alcance una de otra) con presas de más alrededor
  function generarHasta(yMax) {
    while (cadena.y < yMax) {
      const dureza = Math.min(1, cadena.y / 60);
      const hueco = (0.32 + dureza * 0.3) * (0.85 + azar() * 0.3);
      let dx = (azar() * 2 - 1) * (0.3 + dureza * 0.3);
      if (Math.hypot(dx, hueco) > 0.85) dx = Math.sign(dx) * Math.sqrt(Math.max(0, 0.85 ** 2 - hueco ** 2));
      const nx = Math.max(cadena.centro - 0.8, Math.min(cadena.centro + 0.8, cadena.x + dx));
      cadena.y += hueco;
      cadena.x = nx;
      // En la cadena, las móviles no (para no quedarse sin presa al alcance)
      let tipo = tipoPara(cadena.y);
      if (tipo === 'movil') tipo = 'normal';
      nuevaPresa(nx, cadena.y, tipo);
      if (azar() < 0.9 - dureza * 0.5) {
        const lado = azar() < 0.5 ? -1 : 1;
        nuevaPresa(Math.max(-2, Math.min(2, nx + lado * (0.35 + azar() * 0.35))), cadena.y + (azar() - 0.5) * 0.3, tipoPara(cadena.y));
      }
      cadena.centro = Math.max(-0.9, Math.min(0.9, cadena.centro + (azar() - 0.5) * 0.25));
    }
  }

  function prepararSubida() {
    semilla = Math.floor(Math.random() * 2147483646) + 1;
    presas = [];
    cadena = { x: 0, y: 0.75, centro: 0 };
    // Primeras presas, fáciles, al alcance desde la repisa
    nuevaPresa(-0.25, 1.15, 'normal');
    nuevaPresa(0.28, 1.35, 'normal');
    nuevaPresa(-0.05, 1.7, 'normal');
    cadena.y = 1.7;
    cadena.x = -0.05;
    generarHasta(12);
    desplaz.set(0, 0, 0);
    nivelLava = LAVA_INICIO;
    tSubiendo = 0;
    maxAltura = 0;
    sinManos = 0;
    hito = 10;
    for (const a of agarres) a.presa = null;
    anclaRaton = null;
    subiendoRaton = false;
    anclaAnterior = null;
    estado = 'listo';
  }

  function morir(motivo) {
    if (estado !== 'subiendo') return;
    estado = 'muerte';
    tEstado = 0;
    causa = motivo;
    ctx.sonido(motivo === 'lava' ? 'vapor' : 'caida');
    for (const mano of ctx.manos) if (mano.activa) ctx.vibrar(mano, 0.8, 250);
  }

  // ─── Agarrar y soltar ──────────────────────────────────────────────────
  function agarrar(presa, t) {
    if (estado === 'listo' || estado === 'fin') {
      estado = 'subiendo';
      primeraVez = false;
    }
    if (presa.tipo === 'quebradiza' && presa.estado === 'ok') {
      presa.estado = 'temblando';
      presa.t = 0;
      ctx.sonido('grava');
    }
    if (presa.tipo === 'resbaladiza' && presa.estado === 'ok') presa.t = 0;
    posPresa(presa, t, tmp2);
    tmp2.add(desplaz);
    ctx.efectos.impacto('pequeño', { pos: tmp2, color: 0xffd0a0, sonido: 'toc' });
  }
  // Una presa deja de servir: suelta las manos que la tenían
  function perderPresa(presa) {
    for (let n = 0; n < 2; n++) {
      if (agarres[n].presa === presa) {
        agarres[n].presa = null;
        if (ctx.manos[n]) ctx.vibrar(ctx.manos[n], 0.7, 160);
      }
    }
    if (anclaRaton === presa) {
      anclaRaton = null;
      if (!ctx.enVR()) morir('caida');
    }
  }

  // VR: la mano que agarra la última manda; el mundo se mueve para que la presa siga en tu mano
  function manosVR(dt, t) {
    let mando = null;
    ctx.manos.forEach((mano, n) => {
      if (n > 1) return;
      const a = agarres[n];
      const aprieta = mano.activa && (mano.gatillo || mano.apreton);
      const empieza = mano.activa && (mano.gatilloPulsado || (mano.apreton && !a.apretonAntes));
      a.apretonAntes = mano.activa && mano.apreton;
      if (!mano.activa) { a.presa = null; return; }
      mano.grip.getWorldPosition(tmp);
      raiz.worldToLocal(tmp);
      if (!aprieta) a.presa = null;
      if (empieza && !a.presa && estado !== 'muerte') {
        // La presa más cercana a la mano
        let mejor = null;
        let dist = ALCANCE_MANO;
        for (const p of presas) {
          if (p.estado === 'rota' || p.estado === 'cayendo' || Math.abs(p.y + desplaz.y - tmp.y) > 0.3) continue;
          const d = posPresa(p, t, tmp2).add(desplaz).distanceTo(tmp);
          if (d < dist) { dist = d; mejor = p; }
        }
        if (mejor) {
          a.presa = mejor;
          a.orden = ++ordenAgarre;
          a.d.copy(tmp).sub(posPresa(mejor, t, tmp2)).sub(desplaz);
          ctx.vibrar(mano, 0.4, 40);
          agarrar(mejor, t);
        }
      }
      if (a.presa && (!mando || a.orden > mando.orden)) mando = a;
      // Guarda dónde está la mano para mover el mundo después
      if (a.presa) a.pos.copy(tmp);
    });
    if (mando) {
      // desplaz = mano − presa − d (solo en x e y)
      posPresa(mando.presa, t, tmp2);
      desplaz.x = mando.pos.x - tmp2.x - mando.d.x;
      desplaz.y = Math.min(0, mando.pos.y - tmp2.y - mando.d.y);
      // Las otras manos que siguen agarradas se ajustan para no dar tirones al cambiar de mando
      for (const a of agarres) {
        if (a.presa && a !== mando) a.d.copy(a.pos).sub(posPresa(a.presa, t, tmp2)).sub(desplaz);
      }
      sinManos = 0;
    } else if (estado === 'subiendo') {
      sinManos += dt;
      if (sinManos > 0.7 && altura() > 0.3) morir('caida');
    }
  }

  // Ratón y dedo: clic en una presa a tu alcance para subir hasta ella
  function raton(dt, t) {
    const r = ctx.raton;
    let mejor = null;
    if (estado !== 'muerte') {
      let dist = 0.08 ** 2;
      for (const p of presas) {
        if (p.estado === 'rota' || p.estado === 'cayendo') continue;
        posPresa(p, t, tmp2).add(desplaz);
        if (Math.abs(tmp2.y - ANCLA.y) > 1.6) continue;
        const d = r.rayo.ray.distanceSqToPoint(tmp2);
        if (d < dist && alcanzable(tmp2)) { dist = d; mejor = p; }
      }
    }
    // No se puede saltar a otra presa hasta llegar a la que ya has agarrado
    if (r.clic && mejor && mejor !== anclaRaton && !subiendoRaton) {
      anclaAnterior = anclaRaton;
      anclaRaton = mejor;
      agarrar(mejor, t);
    }
    if (anclaRaton) {
      // El mundo se desliza hasta dejar la presa en tus manos
      posPresa(anclaRaton, t, tmp2);
      tmp.set(ANCLA.x - tmp2.x, Math.min(0, ANCLA.y - tmp2.y), 0);
      tmp.sub(desplaz);
      const d = tmp.length();
      subiendoRaton = d > 0.12;
      if (d > 1e-4) desplaz.addScaledVector(tmp, Math.min(d, dt * Math.min(VEL_RATON, d * 8)) / d);
    }
  }
  function alcanzable(pos) {
    if (!anclaRaton) return pos.y < ANCLA.y + ALCANCE_RATON * 0.7 && Math.abs(pos.x) < 0.9;
    return pos.distanceTo(ANCLA) <= ALCANCE_RATON;
  }

  // ─── Presas que se rompen o resbalan ───────────────────────────────────
  function presasPeligrosas(dt) {
    const agarrada = (p) => agarres[0].presa === p || agarres[1].presa === p || anclaRaton === p;
    for (const p of presas) {
      if (p.estado === 'temblando') {
        p.t += dt;
        if (p.t > Math.max(0.9, 1.5 - altura() * 0.006)) {
          p.estado = 'cayendo';
          p.caida = 0;
          ctx.sonido('derrumbe');
          posPresa(p, 0, tmp).add(desplaz);
          ctx.efectos.estallido(tmp, { color: 0x6a3a2a, cantidad: 8 });
          perderPresa(p);
        }
      } else if (p.estado === 'cayendo') {
        p.caida += dt;
        p.y -= dt * p.caida * 9.8;
        p.giro += dt * 6;
        if (p.caida > 2) p.estado = 'rota';
      } else if (p.tipo === 'resbaladiza' && agarrada(p)) {
        p.t += dt;
        if (p.t > 1.3) {
          p.t = 0;
          ctx.sonido('deslizar');
          perderPresa(p);
        }
      }
    }
  }

  // ─── Dibujo ────────────────────────────────────────────────────────────
  const cuentas = { normal: 0, quebradiza: 0, resbaladiza: 0, movil: 0 };
  function dibujar(dt, t) {
    mundo.position.set(desplaz.x, desplaz.y, 0);
    const h = altura();
    for (const tipo of TIPOS) cuentas[tipo] = 0;
    let nRieles = 0;
    let nHalos = 0;
    for (const p of presas) {
      if (p.estado === 'rota' || p.y < h - 4 || p.y > h + 7) continue;
      const malla = mallas[p.tipo];
      if (cuentas[p.tipo] >= MAX_PRESAS) continue;
      posPresa(p, t, posicion);
      if (p.estado === 'temblando') posicion.x += Math.sin(t * 60) * 0.006;
      euler.set(p.giro, (p.fase - 3) * 0.3, p.fase + p.giro);
      cuaternion.setFromEuler(euler);
      malla.setMatrixAt(cuentas[p.tipo]++, matriz.compose(posicion, cuaternion, escala.set(1, 1, 1)));
      if (p.tipo === 'movil' && nRieles < 30) {
        rieles.setMatrixAt(nRieles++, matriz.compose(tmp.set(p.x, p.y, PARED_Z + 0.005), cuaternion.identity(), escala.set(p.amplitud * 2 + 0.12, 1, 1)));
      }
      // Brillo: presas que puedes agarrar ahora mismo
      if (nHalos < 16 && p.estado !== 'cayendo' && puedeAgarrar(p, t)) {
        posPresa(p, t, posicion);
        halos.setMatrixAt(nHalos, matriz.compose(posicion, cuaternion.identity(), escala.set(1, 1, 1)));
        color.setHex(p.tipo === 'quebradiza' ? 0xff6a3d : p.tipo === 'resbaladiza' ? 0x6ad0ff : 0xffe0a0).multiplyScalar(0.5 + Math.sin(t * 5) * 0.15);
        halos.setColorAt(nHalos++, color);
      }
    }
    for (const tipo of TIPOS) {
      mallas[tipo].count = cuentas[tipo];
      mallas[tipo].instanceMatrix.needsUpdate = true;
    }
    rieles.count = nRieles;
    rieles.instanceMatrix.needsUpdate = true;
    halos.count = nHalos;
    halos.instanceMatrix.needsUpdate = true;
    if (halos.instanceColor) halos.instanceColor.needsUpdate = true;
    // Lava, su resplandor y las chispas
    lava.position.y = nivelLava;
    texLava.offset.set(t * 0.01, t * 0.006);
    resplandor.position.y = nivelLava + 2.4;
    for (let k = 0; k < CHISPAS; k++) {
      const c = datosChispas[k];
      c.vida -= dt;
      c.y += c.v * dt;
      if (c.vida <= 0) {
        c.x = -desplaz.x + (Math.random() - 0.5) * 6;
        c.z = PARED_Z + 0.1 + Math.random() * 2.5;
        c.y = nivelLava;
        c.v = 0.4 + Math.random() * 0.8;
        c.vida = 1.5 + Math.random() * 2.5;
      }
      const s = Math.min(1, c.vida);
      chispas.setMatrixAt(k, matriz.compose(posicion.set(c.x + Math.sin(t * 2 + k) * 0.1, c.y, c.z), cuaternion.identity(), escala.set(s, s, s)));
    }
    chispas.instanceMatrix.needsUpdate = true;
    // Guantes (solo con ratón): en la presa de la que cuelgas y en la anterior, si sigue ahí
    const vr = ctx.enVR();
    guantes[0].visible = !vr && !!anclaRaton;
    guantes[1].visible = !vr && !!anclaAnterior && anclaAnterior.estado !== 'cayendo' && anclaAnterior.estado !== 'rota' && subiendoRaton;
    if (guantes[0].visible) posPresa(anclaRaton, t, guantes[0].position).z += 0.045;
    if (guantes[1].visible) posPresa(anclaAnterior, t, guantes[1].position).z += 0.045;
  }
  const manoTmp = new THREE.Vector3();
  function puedeAgarrar(p, t) {
    if (ctx.enVR()) {
      for (const mano of ctx.manos) {
        if (!mano.activa) continue;
        mano.grip.getWorldPosition(manoTmp);
        raiz.worldToLocal(manoTmp);
        if (posPresa(p, t, tmp2).add(desplaz).distanceTo(manoTmp) < ALCANCE_MANO) return true;
      }
      return false;
    }
    if (p === anclaRaton) return false;
    return alcanzable(posPresa(p, t, tmp2).add(desplaz));
  }

  function actualizarMarcador() {
    const lineas = [{ texto: ctx.t('altura', { n: Math.floor(estado === 'fin' ? ultimaAltura : altura()) }), tam: 1.25, color: '#ffe0b0' }];
    if (estado === 'fin') {
      lineas.push({ texto: ctx.t(causa === 'lava' ? 'teAlcanza' : 'teCaes'), tam: 0.6, color: '#ff8a80' });
      lineas.push({ texto: ctx.enVR() ? ctx.t('intro') : ctx.t(ctx.tactil ? 'introTactil' : 'introRaton'), tam: 0.5 });
    } else if (estado === 'listo' && primeraVez) {
      lineas.push({ texto: ctx.enVR() ? ctx.t('intro') : ctx.t(ctx.tactil ? 'introTactil' : 'introRaton'), tam: 0.52 });
    } else {
      const distancia = altura() - nivelLava;
      lineas.push({ texto: ctx.t('lava', { n: Math.max(0, distancia).toFixed(1) }), tam: 0.6, color: distancia < 2 ? '#ff6a3d' : '#ffb080' });
    }
    lineas.push({ texto: ctx.t('record', { n: Math.floor(record) }), tam: 0.5, color: '#cfd8dc' });
    marcador.escribir(lineas);
  }

  // ─── Bucle ─────────────────────────────────────────────────────────────
  let avisoCalor = 0;
  function actualizar(dt, t) {
    if (ctx.enVR()) manosVR(dt, t);
    else raton(dt, t);
    presasPeligrosas(dt);
    const h = altura();
    if (estado === 'subiendo') {
      tSubiendo += dt;
      maxAltura = Math.max(maxAltura, h);
      generarHasta(h + 9);
      // La lava sube cada vez más deprisa, y si se queda muy atrás, te alcanza antes
      const distancia = h - nivelLava;
      const velocidad = Math.min(1.2, 0.06 + tSubiendo * 0.004) + Math.max(0, distancia - 6) * 0.25;
      nivelLava += velocidad * dt;
      if (nivelLava >= h - 0.1) morir('lava');
      if (h > hito) {
        posicion.set(-0.3, 1.9, PARED_Z + 0.1);
        ctx.efectos.texto(posicion, hito + ' m', { color: '#ffe0b0', tam: 1.2 });
        ctx.sonido('campana');
        hito += 10;
      }
      // Calor: destellos rojizos cuando la lava está cerca
      avisoCalor -= dt;
      if (distancia < 2 && avisoCalor <= 0) {
        ctx.destello(0xff3a00, 0.12 + (2 - distancia) * 0.08);
        avisoCalor = 0.6;
      }
    }
    if (estado === 'muerte') {
      // Fundido a negro (o a rojo, si es la lava) y vuelta a la repisa
      tEstado += dt;
      ctx.destello(causa === 'lava' ? 0x3a0800 : 0x000000, Math.min(1, tEstado / 0.6));
      if (tEstado > 0.8) {
        ultimaAltura = maxAltura;
        if (maxAltura > record) {
          record = maxAltura;
          ctx.guardar('record', record);
        }
        ctx.puntuacion(Math.floor(maxAltura)); // metros subidos (juegos/marcadores.js)
        prepararSubida();
        estado = 'fin';
      }
    }
    dibujar(dt, t);
    actualizarMarcador();
  }

  prepararSubida();
  actualizarMarcador();

  return {
    actualizar,
    liberar() {},
  };
}
