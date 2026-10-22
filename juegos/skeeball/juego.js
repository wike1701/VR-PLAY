// SKEE-BALL
// La máquina de skee-ball de un paseo marítimo al atardecer. Tienes 9 bolas: hazlas rodar
// por la pista para que salten en la rampa y caigan en los aros. Cuanto más pequeño el
// aro, más vale (10, 20, 30, 40 y 50), y los dos agujeros de las esquinas, 100.
// En VR coge una bola con el gatillo y hazla rodar soltándolo con un movimiento hacia
// delante. Sin gafas, apunta con el ratón (o el dedo) a lo largo de la pista, mantén
// pulsado y suelta cuando la barra marque la fuerza.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código.
export async function precargar() {}

const BOLAS = 9;
const R_BOLA = 0.045;
const G = 9.8;
// Pista: de z0 a z1, subiendo de y0 a y1
const PISTA = { z0: -0.45, z1: -2.9, y0: 0.78, y1: 1.02, ancho: 0.5 };
const RAMPA = 0.18;                  // largo de la rampa del final
const LABIO = { z: PISTA.z1 - RAMPA, y: PISTA.y1 + 0.1 };
const INCLINA_DIANA = 0.3;           // la diana sube hacia el fondo
const FONDO_DIANA = 1.15;            // largo de la diana desde el labio
const CENTRO = 0.6;                  // centro de los aros, desde el labio
const AROS = [
  { r: 0.08, valor: 50 },
  { r: 0.17, valor: 40 },
  { r: 0.26, valor: 30 },
  { r: 0.36, valor: 20 },
];
const ESQUINAS = [{ x: -0.36, d: 1.0 }, { x: 0.36, d: 1.0 }];
const R_ESQUINA = 0.065;
const PERIODO_FUERZA = 1.5;

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (r) => ctx.recurso(r);

  ctx.fondo(0xf0a070, {
    cenit: 0x3a3a78, horizonte: 0xffb070, sol: [0.2, 0.08, -0.9], estrellas: 0.2, niebla: [25, 90],
    paisaje: { tipo: 'colinas', color: 0x5a4a6a, radio: 70 },
  });
  ctx.sueloBase(false);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.62, 0.35), new THREE.Vector3(0, 1.0, -3.2));

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

  const largoPista = Math.abs(PISTA.z1 - PISTA.z0);
  const pendiente = (PISTA.y1 - PISTA.y0) / largoPista;
  const anguloPista = Math.atan(pendiente);
  function alturaPista(z) {
    return PISTA.y0 + (PISTA.z0 - z) * pendiente;
  }
  function alturaDiana(z) {
    return LABIO.y - 0.12 + (LABIO.z - z) * INCLINA_DIANA;
  }

  // ─── El paseo marítimo ─────────────────────────────────────────────────
  const suelo = new THREE.Mesh(
    R(new THREE.PlaneGeometry(40, 40)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tablas(0x9a7050, { tablas: 40, repetir: [1, 1], semilla: 701 })) })),
  );
  suelo.rotation.x = -Math.PI / 2;
  raiz.add(suelo);
  // El mar al fondo
  const mar = new THREE.Mesh(R(new THREE.PlaneGeometry(200, 80)), R(new THREE.MeshLambertMaterial({ color: 0x3a5a8a })));
  mar.rotation.x = -Math.PI / 2;
  mar.position.set(0, -0.3, -60);
  raiz.add(mar);
  // Barandilla del paseo
  const matBlanco = R(new THREE.MeshLambertMaterial({ color: 0xf2efe8 }));
  const geosBaranda = [colocar(new THREE.BoxGeometry(20, 0.06, 0.06), 0, 1.0, -9)];
  for (let i = 0; i < 21; i++) geosBaranda.push(colocar(new THREE.BoxGeometry(0.05, 1.0, 0.05), -10 + i, 0.5, -9));
  raiz.add(new THREE.Mesh(fusionar(geosBaranda), matBlanco));
  // Máquinas vecinas (cajas de colores a los lados)
  const vecinas = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(0.8, 2.0, 3.0), -1.9, 1.0, -2.6),
    colocar(new THREE.BoxGeometry(0.8, 2.0, 3.0), 1.9, 1.0, -2.6),
    colocar(new THREE.BoxGeometry(0.8, 2.0, 3.0), -3.1, 1.0, -2.6),
    colocar(new THREE.BoxGeometry(0.8, 2.0, 3.0), 3.1, 1.0, -2.6),
  ]), R(new THREE.MeshLambertMaterial({ map: R(ctx.texturaCanvas((g, tam) => {
    const colores = ['#2a6fb2', '#d6283a', '#3fbf6a', '#8a5ad6'];
    for (let i = 0; i < 4; i++) {
      g.fillStyle = colores[i];
      g.fillRect(0, (i * tam) / 4, tam, tam / 4);
      g.fillStyle = '#ffd23f';
      g.fillRect(0, (i * tam) / 4, tam, tam / 40);
    }
  }, { tam: 64 })) })));
  raiz.add(vecinas);
  // Guirnalda de bombillas sobre la máquina
  const N_BOMBILLAS = 22;
  const bombillas = new THREE.InstancedMesh(R(new THREE.SphereGeometry(0.03, 8, 6)), R(new THREE.MeshBasicMaterial({ toneMapped: false })), N_BOMBILLAS);
  const colorTmp = new THREE.Color();
  for (let i = 0; i < N_BOMBILLAS; i++) {
    const u = i / (N_BOMBILLAS - 1);
    bombillas.setMatrixAt(i, matrizTmp.makeTranslation(-3 + u * 6, 2.6 - Math.sin(u * Math.PI) * 0.3, -1.0));
    bombillas.setColorAt(i, colorTmp.set([0xffd23f, 0xff6a3d, 0x7ef0ff, 0xff7ad9][i % 4]));
  }
  raiz.add(bombillas);

  // ─── La máquina ────────────────────────────────────────────────────────
  const matMadera = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.madera(0xc8945a, { semilla: 702 })) }));
  const pista = new THREE.Mesh(R(new THREE.PlaneGeometry(PISTA.ancho, largoPista / Math.cos(anguloPista))), matMadera);
  pista.rotation.x = -Math.PI / 2 + anguloPista;
  pista.position.set(0, (PISTA.y0 + PISTA.y1) / 2, (PISTA.z0 + PISTA.z1) / 2);
  raiz.add(pista);
  // Rampa (una cuña) y laterales
  const matMueble = R(new THREE.MeshLambertMaterial({ color: 0x1f3a7a }));
  const rampa = new THREE.Mesh(R(new THREE.CylinderGeometry(0.2, 0.2, PISTA.ancho, 16, 1, false, 0, Math.PI / 2).rotateZ(Math.PI / 2).rotateY(Math.PI)), matMadera);
  rampa.position.set(0, PISTA.y1 + 0.1 - 0.2, PISTA.z1);
  raiz.add(rampa);
  const yMedio = (PISTA.y0 + PISTA.y1) / 2;
  const laterales = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(0.06, 0.2, largoPista + 1.6), -PISTA.ancho / 2 - 0.03, yMedio + 0.05, (PISTA.z0 + PISTA.z1) / 2 - 0.8, anguloPista),
    colocar(new THREE.BoxGeometry(0.06, 0.2, largoPista + 1.6), PISTA.ancho / 2 + 0.03, yMedio + 0.05, (PISTA.z0 + PISTA.z1) / 2 - 0.8, anguloPista),
    colocar(new THREE.BoxGeometry(PISTA.ancho + 0.12, PISTA.y0 - 0.02, largoPista), 0, (PISTA.y0 - 0.02) / 2, (PISTA.z0 + PISTA.z1) / 2),
    // Caja de la diana y panel de atrás
    colocar(new THREE.BoxGeometry(1.1, 1.2, 1.3), 0, 0.6, LABIO.z - 0.65),
    colocar(new THREE.BoxGeometry(1.1, 1.5, 0.1), 0, LABIO.y + 0.55, LABIO.z - FONDO_DIANA - 0.08),
    colocar(new THREE.BoxGeometry(0.08, 0.9, 1.3), -0.55, LABIO.y + 0.25, LABIO.z - 0.65),
    colocar(new THREE.BoxGeometry(0.08, 0.9, 1.3), 0.55, LABIO.y + 0.25, LABIO.z - 0.65),
    // Bandeja de bolas delante
    colocar(new THREE.BoxGeometry(PISTA.ancho + 0.12, 0.05, 0.25), 0, PISTA.y0 - 0.12, PISTA.z0 + 0.1),
  ]), matMueble);
  raiz.add(laterales);
  const sombraMaquina = ctx.crearSombra({ radio: 1.6, opacidad: 0.45 });
  sombraMaquina.scale.set(0.9, 1, 2.6);
  sombraMaquina.position.set(0, 0.005, -2.0);
  raiz.add(sombraMaquina);
  // Diana: aros concéntricos y los dos agujeros de 100
  const texDiana = R(ctx.texturaCanvas((g, tam) => {
    const ancho = 1.0;
    const escala = tam / ancho;
    const cx = tam / 2;
    const cy = tam - CENTRO * escala * (tam / (FONDO_DIANA * escala));
    g.fillStyle = '#1f3a7a';
    g.fillRect(0, 0, tam, tam);
    const colores = ['#ffd23f', '#3fbf6a', '#2fb6d8', '#e8457a'];
    const sy = tam / FONDO_DIANA;
    const sx = tam / ancho;
    // Del aro grande al pequeño
    for (let i = AROS.length - 1; i >= 0; i--) {
      g.fillStyle = colores[i];
      g.beginPath();
      g.ellipse(cx, cy, AROS[i].r * sx, AROS[i].r * sy, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#10142a';
      g.beginPath();
      g.ellipse(cx, cy, (AROS[i].r - 0.03) * sx, (AROS[i].r - 0.03) * sy, 0, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#ff6a3d';
    for (const e of ESQUINAS) {
      g.beginPath();
      g.ellipse(cx + e.x * sx, tam - e.d * sy, R_ESQUINA * sx, R_ESQUINA * sy, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#10142a';
      g.beginPath();
      g.ellipse(cx + e.x * sx, tam - e.d * sy, (R_ESQUINA - 0.02) * sx, (R_ESQUINA - 0.02) * sy, 0, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ff6a3d';
    }
    // Números de cada aro
    g.fillStyle = '#ffffff';
    g.font = `bold ${tam * 0.045}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    AROS.forEach((a, i) => g.fillText(String(a.valor), cx, i === 0 ? cy : cy - (a.r - 0.015) * sy));
    for (const e of ESQUINAS) g.fillText('100', cx + e.x * sx, tam - (e.d + R_ESQUINA + 0.04) * sy);
  }, { tam: 512 }));
  const inclinacion = Math.atan(INCLINA_DIANA);
  const diana = new THREE.Mesh(R(new THREE.PlaneGeometry(1.0, FONDO_DIANA / Math.cos(inclinacion))), R(new THREE.MeshLambertMaterial({ map: texDiana })));
  diana.rotation.x = -Math.PI / 2 + inclinacion;
  diana.position.set(0, alturaDiana(LABIO.z - FONDO_DIANA / 2), LABIO.z - FONDO_DIANA / 2);
  raiz.add(diana);
  // Red protectora por encima (líneas)
  const puntosRed = [];
  for (let i = 0; i <= 8; i++) {
    const x = -0.55 + i * (1.1 / 8);
    puntosRed.push(x, LABIO.y + 0.9, LABIO.z, x, LABIO.y + 0.9, LABIO.z - FONDO_DIANA);
  }
  for (let i = 0; i <= 6; i++) {
    const z = LABIO.z - i * (FONDO_DIANA / 6);
    puntosRed.push(-0.55, LABIO.y + 0.9, z, 0.55, LABIO.y + 0.9, z);
  }
  const geoRed = R(new THREE.BufferGeometry());
  geoRed.setAttribute('position', new THREE.Float32BufferAttribute(puntosRed, 3));
  raiz.add(new THREE.LineSegments(geoRed, R(new THREE.LineBasicMaterial({ color: 0xc8d0e0, transparent: true, opacity: 0.5 }))));
  // Letrero luminoso con los puntos de la tirada (los dígitos en el marcador del juego)
  const letrero = new THREE.Mesh(R(new THREE.BoxGeometry(1.0, 0.08, 0.04)), R(new THREE.MeshBasicMaterial({ color: 0xff6a3d, toneMapped: false })));
  letrero.position.set(0, LABIO.y + 1.32, LABIO.z - FONDO_DIANA - 0.02);
  raiz.add(letrero);

  // ─── Bolas ─────────────────────────────────────────────────────────────
  const geoBola = R(new THREE.SphereGeometry(R_BOLA, 18, 12));
  const matBola = R(new THREE.MeshStandardMaterial({ map: R(ctx.texturas.madera(0x8a5a34, { semilla: 703 })), roughness: 0.5 }));
  const bolasBandeja = new THREE.InstancedMesh(geoBola, matBola, BOLAS);
  for (let i = 0; i < BOLAS; i++) {
    bolasBandeja.setMatrixAt(i, matrizTmp.makeTranslation(-0.2 + (i % 5) * 0.1, PISTA.y0 - 0.05 + Math.floor(i / 5) * 0.06, PISTA.z0 + 0.12 - Math.floor(i / 5) * 0.03));
  }
  raiz.add(bolasBandeja);
  const bola = new THREE.Mesh(geoBola, matBola);
  bola.visible = false;
  raiz.add(bola);
  const sombraBola = ctx.crearSombra({ radio: 0.05, opacidad: 0.45 });
  sombraBola.visible = false;
  raiz.add(sombraBola);
  // Barra de fuerza del ratón: un rail que se llena a lo largo de la pista
  const barra = new THREE.Mesh(R(new THREE.BoxGeometry(0.03, 0.01, 1).translate(0, 0, -0.5)), R(new THREE.MeshBasicMaterial({ color: 0xff6a3d, toneMapped: false })));
  barra.visible = false;
  raiz.add(barra);
  const mira = new THREE.Mesh(R(new THREE.RingGeometry(0.03, 0.045, 20).rotateX(-Math.PI / 2)), R(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7, depthWrite: false })));
  mira.visible = false;
  raiz.add(mira);

  // Historial de posiciones de cada mano para la velocidad del lanzamiento
  const historiales = ctx.manos.map(() => ({ pos: Array.from({ length: 8 }, () => new THREE.Vector3()), dt: new Array(8).fill(0.016), n: 0 }));

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.0, alto: 0.3 });
  marcador.mesh.position.set(0, LABIO.y + 1.08, LABIO.z - FONDO_DIANA - 0.03);
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'juego' | 'fin'
  // fase de la bola: 'lista' | 'mano' | 'pista' | 'vuelo' | 'cayendo' | 'fuera'
  let fase = 'lista';
  let reloj = 3;
  let tiradas = 0;
  let puntos = 0;
  let record = ctx.leer('record', 0);
  let aviso = '';
  let tiempoAviso = 0;
  let espera = 0;
  let manoBola = null;
  let cargando = false;
  let tiempoCarga = 0;
  let fuerza = 0;
  let rodar = 0;
  const vel = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const caida = new THREE.Vector3();
  const planoPista = new THREE.Plane(new THREE.Vector3(0, 1, 0), -PISTA.y0);

  function empezarPartida() {
    estado = 'juego';
    tiradas = 0;
    puntos = 0;
    bolasBandeja.count = BOLAS;
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

  function nuevaBola() {
    fase = 'lista';
    bola.visible = false;
    sombraBola.visible = false;
  }

  function soltarEnPista(velocidad) {
    tiradas += 1;
    bolasBandeja.count = BOLAS - tiradas;
    vel.copy(velocidad);
    fase = 'pista';
    bola.visible = true;
    ctx.sonido('deslizar');
  }

  // La bola cae en un agujero (o al fondo): cuenta los puntos
  function anotar(valor, pos) {
    fase = 'cayendo';
    espera = 0.9;
    caida.copy(pos);
    puntos += valor;
    tmp.copy(pos);
    tmp.y += 0.25;
    if (valor >= 100) {
      ctx.efectos.impacto('grande', { pos, color: 0xff6a3d, sonido: 'ovacion' });
      ctx.efectos.texto(tmp, `+${valor}`, { color: '#ff6a3d', tam: 1.8 });
      aviso = ctx.t('cien');
    } else if (valor >= 40) {
      ctx.efectos.impacto('medio', { pos, color: 0xffd23f, sonido: 'caja' });
      ctx.efectos.texto(tmp, `+${valor}`, { color: '#ffd23f', tam: 1.4 });
      aviso = ctx.t('aro', { n: valor });
    } else if (valor > 0) {
      ctx.efectos.impacto('pequeño', { pos, color: 0xffffff, sonido: 'punto' });
      ctx.efectos.texto(tmp, `+${valor}`, { color: '#ffffff', tam: 1.1 });
      aviso = ctx.t('aro', { n: valor });
    } else {
      ctx.sonido('fallo');
      ctx.efectos.texto(tmp, '0', { color: '#9aa4ad', tam: 1 });
      aviso = ctx.t('corta');
    }
    tiempoAviso = 1.4;
    ctx.sonido('bote');
  }

  // ¿En qué aro cae? d = distancia desde el labio a lo largo de la diana
  function valorEn(x, d) {
    for (const e of ESQUINAS) if (Math.hypot(x - e.x, d - e.d) < R_ESQUINA) return 100;
    const r = Math.hypot(x, d - CENTRO);
    for (const a of AROS) if (r < a.r) return a.valor;
    return 10;
  }

  // ─── Entrada ───────────────────────────────────────────────────────────
  function entradaVR(dt) {
    barra.visible = false;
    mira.visible = false;
    ctx.manos.forEach((mano, k) => {
      const h = historiales[k];
      h.n = (h.n + 1) % 8;
      h.pos[h.n].copy(mano.posicion);
      h.dt[h.n] = dt;
      if (!mano.activa) return;
      if (fase === 'mano' && manoBola === mano) {
        mano.grip.localToWorld(bola.position.set(0, -0.01, -0.05));
        if (!mano.gatillo) {
          const atras = (h.n + 8 - 4) % 8;
          let tiempo = 0;
          for (let j = 0; j < 4; j++) tiempo += h.dt[(h.n + 8 - j) % 8];
          tmp.copy(h.pos[h.n]).sub(h.pos[atras]).divideScalar(Math.max(tiempo, 1e-3)).multiplyScalar(1.2);
          manoBola = null;
          if (-tmp.z < 0.6) {
            // Sin impulso hacia delante: la bola vuelve a la bandeja
            fase = 'lista';
            bola.visible = false;
            return;
          }
          soltarEnPista(tmp);
          ctx.vibrar(mano, 0.25, 25);
        }
        return;
      }
      if (mano.gatilloPulsado && estado === 'juego' && fase === 'lista' && tiradas < BOLAS) {
        fase = 'mano';
        manoBola = mano;
        bola.visible = true;
        mano.grip.localToWorld(bola.position.set(0, -0.01, -0.05));
        ctx.vibrar(mano, 0.2, 20);
        ctx.sonido('recepcion');
      }
    });
  }

  function entradaRaton(dt) {
    const apunta = ctx.raton.rayo.ray.intersectPlane(planoPista, tmp);
    const x = apunta ? Math.max(-0.2, Math.min(0.2, tmp.x)) : 0;
    const listo = estado === 'juego' && fase === 'lista' && tiradas < BOLAS;
    mira.visible = listo;
    mira.position.set(x, alturaPista(PISTA.z1 + 0.6) + 0.005, PISTA.z1 + 0.6);
    barra.visible = listo && cargando;
    if (!listo) {
      cargando = false;
      return;
    }
    bola.visible = true;
    bola.position.set(0, PISTA.y0 + R_BOLA + 0.05, PISTA.z0 + 0.05);
    if (ctx.raton.pulsado && !cargando) {
      cargando = true;
      tiempoCarga = 0;
    }
    if (cargando) {
      tiempoCarga += dt;
      fuerza = 0.5 - 0.5 * Math.cos((tiempoCarga / PERIODO_FUERZA) * Math.PI * 2);
      barra.position.set(PISTA.ancho / 2 + 0.07, alturaPista(PISTA.z0) + 0.16, PISTA.z0);
      barra.rotation.x = anguloPista;
      barra.scale.z = 0.05 + fuerza * (largoPista - 0.05);
      if (!ctx.raton.pulsado) {
        cargando = false;
        // De 2.8 a 5.2 m/s: de quedarse corta a pasarse
        const v = 2.8 + fuerza * 2.4;
        tmp2.set(mira.position.x - bola.position.x, 0, mira.position.z - bola.position.z).normalize().multiplyScalar(v);
        soltarEnPista(tmp2);
      }
    }
  }

  // ─── Física de la bola ─────────────────────────────────────────────────
  function moverBola(dt) {
    const p = bola.position;
    if (fase === 'pista') {
      const suelo = alturaPista(p.z) + R_BOLA;
      if (p.y > suelo + 0.002) {
        // Aún en el aire (lanzada desde la mano)
        vel.y -= G * dt;
        p.addScaledVector(vel, dt);
        if (p.y <= suelo) {
          p.y = suelo;
          if (vel.y < -1) ctx.sonido('bote');
          vel.y = 0;
        }
      } else {
        // Rodando: la pendiente y el rozamiento la frenan
        vel.y = 0;
        const v = Math.hypot(vel.x, vel.z);
        const frena = (0.6 + G * Math.sin(anguloPista)) * dt;
        if (vel.z < 0) {
          const nueva = Math.max(0, v - frena);
          vel.x *= v > 0 ? nueva / v : 0;
          vel.z *= v > 0 ? nueva / v : 0;
          if (nueva === 0) vel.z = 0.01;
        } else {
          // Vuelve rodando hacia atrás
          vel.z += G * Math.sin(anguloPista) * dt;
          vel.x *= 0.98;
        }
        p.x += vel.x * dt;
        p.z += vel.z * dt;
        p.y = alturaPista(p.z) + R_BOLA;
        rodar -= dt;
        if (rodar <= 0) {
          rodar = 0.12;
          ctx.sonido('grava');
        }
      }
      bola.rotation.x += (vel.z / R_BOLA) * dt;
      // Laterales
      const borde = PISTA.ancho / 2 - R_BOLA;
      if (Math.abs(p.x) > borde) {
        p.x = Math.sign(p.x) * borde;
        vel.x = -vel.x * 0.5;
        ctx.sonido('toc');
      }
      // Llega a la rampa: salta
      if (p.z <= PISTA.z1) {
        const v = Math.max(0.5, -vel.z);
        vel.set(vel.x, v * 0.6, -v * 0.8);
        p.set(p.x, LABIO.y + R_BOLA, LABIO.z);
        fase = 'vuelo';
        ctx.sonido('golpe');
      }
      // Se queda corta y vuelve
      if (p.z > PISTA.z0 + 0.1 && vel.z > 0) {
        fase = 'fuera';
        anotar(0, p);
      }
    } else if (fase === 'vuelo') {
      vel.y -= G * dt;
      p.addScaledVector(vel, dt);
      const d = LABIO.z - p.z;
      // Choca con el panel del fondo y cae al 10
      if (d >= FONDO_DIANA - R_BOLA) {
        p.z = LABIO.z - FONDO_DIANA + R_BOLA;
        vel.z = -vel.z * 0.3;
        vel.x *= 0.5;
        ctx.sonido('golpe');
      }
      if (Math.abs(p.x) > 0.5 - R_BOLA) {
        p.x = Math.sign(p.x) * (0.5 - R_BOLA);
        vel.x = -vel.x * 0.4;
      }
      if (p.y <= alturaDiana(p.z) + R_BOLA * 0.5 && vel.y < 0) {
        const dd = Math.min(FONDO_DIANA, Math.max(0, LABIO.z - p.z));
        anotar(valorEn(p.x, dd), p);
      }
    } else if (fase === 'cayendo') {
      // Se cuela por el agujero
      p.y -= dt * 0.4;
      bola.scale.setScalar(Math.max(0.01, espera / 0.9));
    }
    sombraBola.visible = bola.visible && fase !== 'cayendo';
    if (sombraBola.visible) ctx.colocarSombra(sombraBola, p, fase === 'vuelo' ? alturaDiana(p.z) : alturaPista(p.z) + 0.004);
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
        { texto: ctx.t('marcador', { puntos, bolas: BOLAS - tiradas }), tam: 1.15 },
        { texto: tiempoAviso > 0 ? aviso : ctx.t(ctx.enVR() ? 'consejoVR' : 'consejoRaton'), tam: 0.78, color: tiempoAviso > 0 ? '#ffe08a' : '#cfd8dc' },
      ]);
    }
  }

  // ─── Bucle ─────────────────────────────────────────────────────────────
  function actualizar(dt, t) {
    reloj -= dt;
    tiempoAviso -= dt;
    if ((estado === 'intro' || estado === 'fin') && reloj <= 0) empezarPartida();

    if (ctx.enVR()) entradaVR(dt);
    else entradaRaton(dt);
    moverBola(dt);
    if (fase === 'cayendo' || fase === 'fuera') {
      espera -= dt;
      if (espera <= 0) {
        bola.scale.setScalar(1);
        if (tiradas >= BOLAS) {
          bola.visible = false;
          if (estado === 'juego') terminar();
          fase = 'lista';
        } else {
          nuevaBola();
        }
      }
    }
    ctx.bloquearCambio(fase === 'pista' || fase === 'vuelo');
    letrero.material.color.setHSL(0.04 + Math.sin(t * 3) * 0.02, 1, 0.55);
    actualizarMarcador();
  }

  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      ctx.bloquearCambio(false);
    },
  };
}
