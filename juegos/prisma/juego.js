// PRISMA
// Un puzle de rayos en una sala de cristal a oscuras. Sobre una mesa de cristal hay un emisor que
// lanza un láser, espejos que puedes girar, prismas que abren un rayo blanco en uno rojo y uno azul,
// filtros que lo tiñen y cristales que se encienden cuando les llega un rayo de su color. Gira los
// espejos hasta encender todos los cristales y pasas a la sala siguiente, cada vez más grande y con
// más piezas. Tienes 3 minutos en el reloj y cada sala superada te devuelve algo de tiempo (cada vez
// menos: de 1 minuto a medio).
// Cada sala vale 100 puntos por su número.
// En VR: apunta (o acerca la mano) a un espejo, aprieta el gatillo y gira la muñeca como una llave;
// un toque corto lo gira 45°. Sin gafas: clic (o toque) en un espejo para girarlo 45°.
// La lógica del tablero (rayos y generador de salas con solución) está en tablero.js.
import * as THREE from 'three';
import { generar, trazar, resuelto } from './tablero.js';

// Sin archivos externos: todo se genera con código.
export async function precargar() {}

const MESA_Y = 0.92;           // altura de la mesa
const CELDA = 0.13;            // lado de cada casilla
const Z_TABLERO = -0.72;       // centro del tablero
const Y_RAYO = MESA_Y + 0.045; // los rayos van a esta altura
const TIEMPO = 180;            // segundos del reloj (y su máximo)
const PREMIO = (sala) => Math.max(30, 70 - sala * 3); // segundos que devuelve cada sala
const CAP = 42;                // casillas como mucho (7 × 6)
const COLOR = { blanco: 0xeaf6ff, rojo: 0xff3a4a, verde: 0x3aff7a, azul: 0x3a8aff };

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (r) => ctx.recurso(r);

  ctx.fondo(0x0a0618, { cenit: 0x020108, horizonte: 0x2a0e4a, suelo: 0x05030c, estrellas: 0.8, niebla: [10, 50] });
  ctx.sueloBase(false);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.48, -0.08), new THREE.Vector3(0, MESA_Y, Z_TABLERO - 0.06));

  const matriz = new THREE.Matrix4();
  const cuaternion = new THREE.Quaternion();
  const escala = new THREE.Vector3();
  const posicion = new THREE.Vector3();
  const euler = new THREE.Euler();
  const color = new THREE.Color();
  const EJE_Y = new THREE.Vector3(0, 1, 0);
  function colocar(geo, x, y, z, rx = 0, ry = 0, rz = 0) {
    matriz.makeRotationFromEuler(euler.set(rx, ry, rz)).setPosition(x, y, z);
    return geo.applyMatrix4(matriz);
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
        color.set(colores[k]);
        for (let i = 0; i < n; i++) col.set([color.r, color.g, color.b], (ov + i) * 3);
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
  const luzSumada = (opciones = {}) => R(new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, ...opciones }));
  function instancias(geo, material, n) {
    const m = new THREE.InstancedMesh(geo, material, n);
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.count = 0;
    m.frustumCulled = false;
    raiz.add(m);
    return m;
  }

  // ─── Sala de cristal ───────────────────────────────────────────────────
  const texSuelo = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#07060f';
    g.fillRect(0, 0, tam, tam);
    g.strokeStyle = 'rgba(80,200,255,0.22)';
    g.lineWidth = 3;
    g.strokeRect(1.5, 1.5, tam - 3, tam - 3);
    g.strokeStyle = 'rgba(160,90,255,0.1)';
    g.lineWidth = 1;
    g.beginPath(); g.moveTo(tam / 2, 0); g.lineTo(tam / 2, tam); g.moveTo(0, tam / 2); g.lineTo(tam, tam / 2); g.stroke();
  }, { tam: 128, repetir: [14, 14] }));
  const suelo = new THREE.Mesh(R(new THREE.PlaneGeometry(14, 14)), R(new THREE.MeshLambertMaterial({ map: texSuelo })));
  suelo.rotation.x = -Math.PI / 2;
  raiz.add(suelo);
  // Paredes de cristal en octógono, con aristas de neón
  const paneles = [];
  const aristas = [];
  const coloresAristas = [];
  const RADIO = 3.2;
  const LADO = 2 * RADIO * Math.tan(Math.PI / 8);
  for (let k = 0; k < 8; k++) {
    const a = (k / 8) * Math.PI * 2 + Math.PI / 8;
    const x = Math.sin(a) * RADIO;
    const z = Math.cos(a) * RADIO - 0.4;
    paneles.push(caja(LADO, 3.2, 0.03, x, 1.6, z, 0, a));
    const tono = k % 2 ? 0x46e0ff : 0xc04aff;
    aristas.push(caja(LADO, 0.025, 0.025, x, 0.02, z, 0, a), caja(LADO, 0.025, 0.025, x, 3.2, z, 0, a));
    coloresAristas.push(tono, tono);
    const b = a + Math.PI / 8;
    const r2 = RADIO / Math.cos(Math.PI / 8);
    aristas.push(caja(0.03, 3.2, 0.03, Math.sin(b) * r2, 1.6, Math.cos(b) * r2 - 0.4));
    coloresAristas.push(0x7a6aff);
  }
  raiz.add(new THREE.Mesh(fusionar(paneles), R(new THREE.MeshStandardMaterial({ color: 0x8a7aff, transparent: true, opacity: 0.16, roughness: 0.05, metalness: 0.4, depthWrite: false }))));
  raiz.add(new THREE.Mesh(fusionar(aristas, coloresAristas), R(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }))));
  // Prismas de adorno flotando por la sala
  const ADORNOS = 12;
  const adornos = instancias(R(new THREE.CylinderGeometry(0.12, 0.12, 0.3, 3)), luzSumada({ color: 0x6a5aff, opacity: 0.35 }), ADORNOS);
  adornos.count = ADORNOS;
  const datosAdornos = Array.from({ length: ADORNOS }, (_, k) => {
    const a = (k / ADORNOS) * Math.PI * 2;
    const r = 1.9 + (k % 3) * 0.35;
    return { x: Math.sin(a) * r, z: Math.cos(a) * r - 0.4, y: 1.2 + ((k * 7) % 5) * 0.35, fase: k * 1.3 };
  });

  // ─── Mesa y tablero ────────────────────────────────────────────────────
  raiz.add(new THREE.Mesh(fusionar([
    colocar(new THREE.CylinderGeometry(0.09, 0.16, MESA_Y - 0.03, 20), 0, (MESA_Y - 0.03) / 2, Z_TABLERO),
    colocar(new THREE.CylinderGeometry(0.3, 0.34, 0.03, 28), 0, 0.015, Z_TABLERO),
  ]), R(new THREE.MeshLambertMaterial({ color: 0x1a1430 }))));
  raiz.add(new THREE.Mesh(fusionar([
    colocar(new THREE.TorusGeometry(0.1, 0.008, 6, 28), 0, MESA_Y - 0.12, Z_TABLERO, Math.PI / 2),
    colocar(new THREE.TorusGeometry(0.33, 0.008, 6, 36), 0, 0.035, Z_TABLERO, Math.PI / 2),
  ]), luzSumada({ color: 0x46e0ff, opacity: 0.9 })));
  const losa = new THREE.Mesh(R(new THREE.BoxGeometry(1, 0.03, 1)), R(new THREE.MeshStandardMaterial({ color: 0x120c26, roughness: 0.6, metalness: 0.1, transparent: true, opacity: 0.92 })));
  losa.position.set(0, MESA_Y - 0.015, Z_TABLERO);
  raiz.add(losa);
  const texRejilla = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#000000';
    g.fillRect(0, 0, tam, tam);
    g.strokeStyle = 'rgba(70,170,255,0.55)';
    g.lineWidth = 3;
    g.beginPath();
    g.roundRect(6, 6, tam - 12, tam - 12, 10);
    g.stroke();
    g.fillStyle = 'rgba(120,90,255,0.6)';
    g.beginPath(); g.arc(tam / 2, tam / 2, 2.5, 0, Math.PI * 2); g.fill();
  }, { tam: 64, repetir: [7, 6] }));
  const rejilla = new THREE.Mesh(R(new THREE.PlaneGeometry(1, 1)), luzSumada({ map: texRejilla, opacity: 0.8 }));
  rejilla.rotation.x = -Math.PI / 2;
  rejilla.position.set(0, MESA_Y + 0.001, Z_TABLERO);
  raiz.add(rejilla);
  const marco = instancias(R(new THREE.BoxGeometry(1, 1, 1)), luzSumada({ color: 0x46e0ff }), 4);
  marco.count = 4;

  // ─── Piezas (una malla instanciada por tipo) ───────────────────────────
  const espejos = instancias(fusionar([
    colocar(new THREE.CylinderGeometry(0.046, 0.052, 0.016, 20), 0, 0.008, 0),
    caja(0.11, 0.07, 0.01, 0, 0.051, 0),
    caja(0.008, 0.078, 0.016, 0.058, 0.055, 0),
    caja(0.008, 0.078, 0.016, -0.058, 0.055, 0),
  ], [0x1a1430, 0xd8f2ff, 0x7a6aff, 0x7a6aff]), R(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.7, roughness: 0.12 })), CAP);
  const emisores = instancias(fusionar([
    caja(0.085, 0.06, 0.07, -0.005, 0.03, 0),
    colocar(new THREE.CylinderGeometry(0.018, 0.022, 0.03, 14), 0.048, Y_RAYO - MESA_Y, 0, 0, 0, Math.PI / 2),
    caja(0.09, 0.008, 0.075, -0.005, 0.064, 0),
  ], [0x2a2440, 0xffffff, 0x46e0ff]), R(new THREE.MeshLambertMaterial({ vertexColors: true, emissive: 0x111122 })), 4);
  const cristales = instancias(R(new THREE.OctahedronGeometry(0.034, 0).scale(1, 1.5, 1)), R(new THREE.MeshBasicMaterial({ toneMapped: false })), 8);
  const auras = instancias(R(new THREE.SphereGeometry(0.07, 14, 10)), luzSumada({ opacity: 0.45 }), 8);
  const prismas = instancias(R(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 3).translate(0, 0.04, 0)), R(new THREE.MeshStandardMaterial({ color: 0xe8f0ff, transparent: true, opacity: 0.55, roughness: 0.05, metalness: 0.2 })), 6);
  const nucleos = instancias(R(new THREE.CylinderGeometry(0.022, 0.022, 0.06, 3).translate(0, 0.04, 0)), luzSumada({ opacity: 0.9 }), 6);
  const filtros = instancias(R(new THREE.BoxGeometry(0.085, 0.07, 0.085).translate(0, 0.035, 0)), luzSumada({ opacity: 0.5 }), 6);
  const muros = instancias(R(new THREE.BoxGeometry(0.11, 0.09, 0.11).translate(0, 0.045, 0)), R(new THREE.MeshStandardMaterial({ color: 0x1a1626, roughness: 0.4, metalness: 0.5 })), CAP);
  // Rayos: un núcleo fino y un halo más ancho, más chispas donde acaban
  const MAX_TRAMOS = 90;
  const geoRayo = R(new THREE.BoxGeometry(1, 1, 1));
  const nucleosRayo = instancias(geoRayo, luzSumada(), MAX_TRAMOS);
  const halosRayo = instancias(geoRayo, luzSumada({ opacity: 0.35 }), MAX_TRAMOS);
  const chispas = instancias(R(new THREE.SphereGeometry(0.014, 10, 8)), luzSumada(), MAX_TRAMOS);
  // Señal de la casilla apuntada (ratón, mano izquierda, mano derecha) y punteros de las manos
  const anillos = [0, 1, 2].map(() => {
    const m = new THREE.Mesh(R(new THREE.RingGeometry(0.056, 0.066, 28).rotateX(-Math.PI / 2)), luzSumada({ color: 0x46e0ff }));
    m.visible = false;
    raiz.add(m);
    return m;
  });
  const punteros = [0, 1].map(() => {
    const m = new THREE.Mesh(R(new THREE.CylinderGeometry(0.0025, 0.0025, 1, 6).translate(0, 0.5, 0)), luzSumada({ color: 0x46e0ff, opacity: 0.6 }));
    m.visible = false;
    raiz.add(m);
    return m;
  });

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 0.6, alto: 0.3 });
  marcador.mesh.position.set(0, 1.15, Z_TABLERO - 0.62);
  marcador.mesh.rotation.x = -0.15;
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let sala = 1;
  let puntos = 0;
  let reloj = TIEMPO;
  let estado = 'jugando'; // 'jugando' | 'superada' | 'fin'
  let tEstado = 0;
  let empezado = false;    // el reloj no corre hasta el primer giro
  let semilla = Math.floor(Math.random() * 1e9);
  let tablero = null;
  let piezas = [];         // { k, i, j, p, ang, objetivo } por casilla ocupada
  const tramos = [];
  const encendidos = new Set();
  const encendidosAntes = new Set();
  let sucio = true;
  let mensaje = '';
  let colorMensaje = '#ffffff';
  let tiempoMensaje = 0;
  let segundoAviso = 0;
  let aparicion = 0;       // 0 → 1 al montar una sala; 1 → 0 al quitarla
  // Lo que lleva cada mano agarrado (se reutiliza: no se crean objetos al jugar)
  const agarres = [0, 1].map(() => ({ pieza: null, eje: new THREE.Vector3(), ref: new THREE.Vector3(), giro: 0, anterior: 0, pasos: 0, angInicio: 0, tiempo: 0 }));
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const tmp3 = new THREE.Vector3();
  const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(MESA_Y + 0.04));
  const rayo = new THREE.Ray();

  const cx = (i) => (i - (tablero.ancho - 1) / 2) * CELDA;
  const cz = (j) => Z_TABLERO + ((tablero.alto - 1) / 2 - j) * CELDA;

  function decir(texto, c = '#ffffff', duracion = 1.6) {
    mensaje = texto;
    colorMensaje = c;
    tiempoMensaje = duracion;
  }

  function montarSala() {
    tablero = null;
    for (let intento = 0; intento < 20 && !tablero; intento++) tablero = generar(sala, semilla + sala * 7919 + intento * 104729);
    piezas = [];
    tablero.celdas.forEach((p, k) => {
      if (!p) return;
      const ang = p.tipo === 'espejo' ? (p.o * Math.PI) / 4 : p.tipo === 'emisor' ? (p.dir * Math.PI) / 2 : 0;
      piezas.push({ k, i: k % tablero.ancho, j: Math.floor(k / tablero.ancho), p, ang, objetivo: ang });
    });
    const w = tablero.ancho * CELDA;
    const h = tablero.alto * CELDA;
    losa.scale.set(w + 0.08, 1, h + 0.08);
    rejilla.scale.set(w, h, 1);
    texRejilla.repeat.set(tablero.ancho, tablero.alto);
    // Marco de neón alrededor
    const bordes = [[0, Z_TABLERO - h / 2 - 0.035, w + 0.08, 0.006], [0, Z_TABLERO + h / 2 + 0.035, w + 0.08, 0.006], [-w / 2 - 0.035, Z_TABLERO, 0.006, h + 0.08], [w / 2 + 0.035, Z_TABLERO, 0.006, h + 0.08]];
    bordes.forEach(([x, z, sx, sz], n) => {
      marco.setMatrixAt(n, matriz.compose(posicion.set(x, MESA_Y + 0.002, z), cuaternion.identity(), escala.set(sx, 0.006, sz)));
    });
    marco.instanceMatrix.needsUpdate = true;
    encendidosAntes.clear();
    agarres[0].pieza = null;
    agarres[1].pieza = null;
    sucio = true;
    aparicion = 0;
    estado = 'jugando';
  }

  function nuevaPartida() {
    sala = 1;
    puntos = 0;
    reloj = TIEMPO;
    empezado = false;
    semilla = Math.floor(Math.random() * 1e9);
    montarSala();
  }

  // Gira un espejo un número de pasos de 45° (positivo: en contra de las agujas, visto desde arriba)
  function girar(pieza, pasos) {
    pieza.p.o = (((pieza.p.o + pasos) % 4) + 4) % 4;
    sucio = true;
    if (!empezado) empezado = true;
  }

  const piezaEn = (i, j) => {
    if (!tablero || i < 0 || j < 0 || i >= tablero.ancho || j >= tablero.alto) return null;
    const k = j * tablero.ancho + i;
    for (const pz of piezas) if (pz.k === k) return pz;
    return null;
  };
  // Casilla bajo un punto del plano del tablero
  function casillaDe(punto, salida) {
    const i = Math.round(punto.x / CELDA + (tablero.ancho - 1) / 2);
    const j = Math.round((tablero.alto - 1) / 2 - (punto.z - Z_TABLERO) / CELDA);
    salida.i = i;
    salida.j = j;
    return i >= 0 && j >= 0 && i < tablero.ancho && j < tablero.alto;
  }

  // ─── Rayos ─────────────────────────────────────────────────────────────
  function comprobarRayos() {
    trazar(tablero, tramos, encendidos);
    let n = 0;
    for (const t of tramos) {
      if (n >= MAX_TRAMOS) break;
      const x0 = cx(t.i0);
      const z0 = cz(t.j0);
      const x1 = cx(t.i1);
      const z1 = cz(t.j1);
      const largo = Math.hypot(x1 - x0, z1 - z0);
      cuaternion.setFromAxisAngle(EJE_Y, Math.atan2(-(z1 - z0), x1 - x0));
      posicion.set((x0 + x1) / 2, Y_RAYO, (z0 + z1) / 2);
      nucleosRayo.setMatrixAt(n, matriz.compose(posicion, cuaternion, escala.set(largo + 0.006, 0.006, 0.006)));
      halosRayo.setMatrixAt(n, matriz.compose(posicion, cuaternion, escala.set(largo + 0.02, 0.022, 0.022)));
      color.setHex(COLOR[t.color]);
      nucleosRayo.setColorAt(n, color);
      halosRayo.setColorAt(n, color);
      chispas.setMatrixAt(n, matriz.compose(posicion.set(x1, Y_RAYO, z1), cuaternion.identity(), escala.set(1, 1, 1)));
      chispas.setColorAt(n, color);
      n++;
    }
    for (const m of [nucleosRayo, halosRayo, chispas]) {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    // Cristales que se acaban de encender
    let nota = 0;
    for (const k of encendidos) {
      if (!encendidosAntes.has(k)) {
        posicion.set(cx(k % tablero.ancho), MESA_Y + 0.06, cz(Math.floor(k / tablero.ancho)));
        ctx.efectos.impacto('pequeño', { pos: posicion, color: COLOR[tablero.celdas[k].color], sonido: 'xilo' + ((encendidosAntes.size + nota + 2) % 8) });
        nota++;
      }
    }
    encendidosAntes.clear();
    for (const k of encendidos) encendidosAntes.add(k);
    if (estado === 'jugando' && resuelto(tablero, encendidos)) superarSala();
  }

  function superarSala() {
    estado = 'superada';
    tEstado = 0;
    const premio = 100 * sala;
    puntos += premio;
    const antes = reloj;
    reloj = Math.min(TIEMPO, reloj + PREMIO(sala));
    posicion.set(0, MESA_Y + 0.25, Z_TABLERO);
    ctx.efectos.impacto('grande', { pos: posicion, color: 0x9fe8ff, sonido: 'poder' });
    ctx.efectos.texto(posicion, '+' + premio, { color: '#9fe8ff', tam: 1.3 });
    decir(ctx.t('superada', { s: Math.round(reloj - antes) }), '#b9f6ca', 2);
    for (const k of encendidos) {
      posicion.set(cx(k % tablero.ancho), MESA_Y + 0.06, cz(Math.floor(k / tablero.ancho)));
      ctx.efectos.estallido(posicion, { color: COLOR[tablero.celdas[k].color], cantidad: 10 });
    }
    for (const mano of ctx.manos) if (mano.activa) ctx.vibrar(mano, 0.6, 120);
  }

  // ─── Dibujo de las piezas ──────────────────────────────────────────────
  function dibujarPiezas(dt, t) {
    const cuenta = { espejo: 0, emisor: 0, cristal: 0, prisma: 0, filtro: 0, muro: 0 };
    const e = aparicion < 1 ? 1 - (1 - aparicion) ** 3 : 1;
    for (const pz of piezas) {
      const { p } = pz;
      const x = cx(pz.i);
      const z = cz(pz.j);
      const y = MESA_Y + (1 - e) * 0.25;
      if (p.tipo === 'espejo') {
        pz.ang += (pz.objetivo - pz.ang) * Math.min(1, dt * 16);
        cuaternion.setFromAxisAngle(EJE_Y, pz.ang);
        espejos.setMatrixAt(cuenta.espejo++, matriz.compose(posicion.set(x, y, z), cuaternion, escala.set(e, e, e)));
      } else if (p.tipo === 'emisor') {
        cuaternion.setFromAxisAngle(EJE_Y, pz.ang);
        emisores.setMatrixAt(cuenta.emisor++, matriz.compose(posicion.set(x, y, z), cuaternion, escala.set(e, e, e)));
      } else if (p.tipo === 'cristal') {
        const k = cuenta.cristal++;
        const encendido = encendidos.has(pz.k);
        const brillo = encendido ? 1 + Math.sin(t * 6 + pz.k) * 0.15 : 0.4;
        cuaternion.setFromAxisAngle(EJE_Y, t * (encendido ? 2.5 : 0.6) + pz.k);
        const s = e * (encendido ? 1.1 : 1);
        cristales.setMatrixAt(k, matriz.compose(posicion.set(x, y + 0.055 + Math.sin(t * 2 + pz.k) * 0.006, z), cuaternion, escala.set(s, s, s)));
        color.setHex(COLOR[p.color]).multiplyScalar(brillo);
        cristales.setColorAt(k, color);
        const a = encendido ? e * (1 + Math.sin(t * 6 + pz.k) * 0.12) : e * 0.6;
        auras.setMatrixAt(k, matriz.compose(posicion, cuaternion, escala.set(a, a, a)));
        color.setHex(COLOR[p.color]).multiplyScalar(encendido ? 0.7 : 0.08);
        auras.setColorAt(k, color);
      } else if (p.tipo === 'prisma') {
        const k = cuenta.prisma++;
        cuaternion.setFromAxisAngle(EJE_Y, t * 0.8 + pz.k);
        prismas.setMatrixAt(k, matriz.compose(posicion.set(x, y, z), cuaternion, escala.set(e, e, e)));
        nucleos.setMatrixAt(k, matriz);
        color.setHSL((t * 0.15 + pz.k * 0.1) % 1, 0.9, 0.5);
        nucleos.setColorAt(k, color);
      } else if (p.tipo === 'filtro') {
        const k = cuenta.filtro++;
        filtros.setMatrixAt(k, matriz.compose(posicion.set(x, y, z), cuaternion.identity(), escala.set(e, e, e)));
        color.setHex(COLOR[p.color]).multiplyScalar(0.55);
        filtros.setColorAt(k, color);
      } else {
        muros.setMatrixAt(cuenta.muro++, matriz.compose(posicion.set(x, y, z), cuaternion.identity(), escala.set(e, e, e)));
      }
    }
    for (const [m, n] of [[espejos, cuenta.espejo], [emisores, cuenta.emisor], [cristales, cuenta.cristal], [auras, cuenta.cristal], [prismas, cuenta.prisma], [nucleos, cuenta.prisma], [filtros, cuenta.filtro], [muros, cuenta.muro]]) {
      m.count = n;
      m.instanceMatrix.needsUpdate = true;
      if (m.instanceColor) m.instanceColor.needsUpdate = true;
    }
    // Los prismas de adorno
    for (let k = 0; k < ADORNOS; k++) {
      const d = datosAdornos[k];
      euler.set(t * 0.3 + d.fase, t * 0.2 + d.fase, 0);
      cuaternion.setFromEuler(euler);
      adornos.setMatrixAt(k, matriz.compose(posicion.set(d.x, d.y + Math.sin(t * 0.7 + d.fase) * 0.12, d.z), cuaternion, escala.set(1, 1, 1)));
    }
    adornos.instanceMatrix.needsUpdate = true;
  }

  // ─── Ratón y dedo: clic en un espejo para girarlo 45° ──────────────────
  const casillaRaton = { i: 0, j: 0 };
  function raton() {
    const r = ctx.raton;
    anillos[0].visible = false;
    if (!r.dentro && !ctx.tactil) return;
    if (!r.rayo.ray.intersectPlane(plano, tmp) || !casillaDe(tmp, casillaRaton)) return;
    const pz = piezaEn(casillaRaton.i, casillaRaton.j);
    if (!pz || pz.p.tipo !== 'espejo') return;
    if (!ctx.tactil) {
      anillos[0].visible = true;
      anillos[0].position.set(cx(pz.i), MESA_Y + 0.004, cz(pz.j));
    }
    if (r.clic && estado === 'jugando') {
      girar(pz, 1);
      pz.objetivo += Math.PI / 4;
      ctx.sonido('clac');
    }
  }

  // ─── VR: apunta o acerca la mano, aprieta y gira la muñeca ─────────────
  const casillaMano = { i: 0, j: 0 };
  function manos(dt) {
    ctx.manos.forEach((mano, n) => {
      const anillo = anillos[1 + Math.min(n, 1)];
      const puntero = punteros[Math.min(n, 1)];
      anillo.visible = false;
      puntero.visible = false;
      if (!mano.activa || n > 1) return;
      const agarre = agarres[n].pieza ? agarres[n] : null;
      mano.grip.getWorldPosition(tmp);
      tmp2.set(0, 0, -1).transformDirection(mano.grip.matrixWorld);
      let pz = null;
      if (agarre) pz = agarre.pieza;
      else {
        // Primero lo que hay justo debajo de la mano; si no, a donde apunta
        const cerca = tmp.y > MESA_Y - 0.02 && tmp.y < MESA_Y + 0.22 && casillaDe(tmp, casillaMano) ? piezaEn(casillaMano.i, casillaMano.j) : null;
        if (cerca && cerca.p.tipo === 'espejo') pz = cerca;
        else {
          rayo.set(tmp, tmp2);
          if (rayo.intersectPlane(plano, tmp3) && casillaDe(tmp3, casillaMano)) {
            const apuntada = piezaEn(casillaMano.i, casillaMano.j);
            if (apuntada && apuntada.p.tipo === 'espejo') pz = apuntada;
            puntero.visible = true;
            puntero.position.copy(tmp);
            puntero.quaternion.setFromUnitVectors(EJE_Y, tmp2);
            puntero.scale.set(1, tmp.distanceTo(tmp3), 1);
          }
        }
      }
      if (!pz || estado !== 'jugando') {
        if (agarre && !mano.gatillo) agarre.pieza = null;
        return;
      }
      anillo.visible = true;
      anillo.position.set(cx(pz.i), MESA_Y + 0.004, cz(pz.j));
      anillo.material.color.setHex(agarre ? 0xff4aff : 0x46e0ff);
      // Ejes del mando: X (a la derecha) y el eje de giro (hacia delante, fijo desde que se aprieta)
      tmp3.set(1, 0, 0).transformDirection(mano.grip.matrixWorld);
      if (mano.gatilloPulsado && !agarre && agarres[1 - n].pieza !== pz) {
        const nuevo = agarres[n];
        nuevo.pieza = pz;
        nuevo.eje.copy(tmp2);
        nuevo.ref.copy(tmp3).projectOnPlane(tmp2).normalize();
        nuevo.giro = 0;
        nuevo.anterior = 0;
        nuevo.pasos = 0;
        nuevo.angInicio = pz.objetivo;
        nuevo.tiempo = 0;
        ctx.vibrar(mano, 0.25, 20);
        return;
      }
      if (!agarre) return;
      agarre.tiempo += dt;
      if (mano.gatillo) {
        // Ángulo girado alrededor del eje de cuando se apretó (acumulado, sin saltos de ±180°)
        tmp3.projectOnPlane(agarre.eje);
        if (tmp3.lengthSq() > 1e-6) {
          tmp3.normalize();
          const a = Math.atan2(tmp.crossVectors(agarre.ref, tmp3).dot(agarre.eje), agarre.ref.dot(tmp3));
          let d = a - agarre.anterior;
          if (d > Math.PI) d -= Math.PI * 2;
          if (d < -Math.PI) d += Math.PI * 2;
          agarre.giro += d;
          agarre.anterior = a;
        }
        // Girar la muñeca a la derecha gira el espejo a la derecha (visto desde arriba)
        pz.objetivo = agarre.angInicio - agarre.giro;
        const pasos = Math.round(-agarre.giro / (Math.PI / 4));
        if (pasos !== agarre.pasos) {
          girar(pz, pasos - agarre.pasos);
          agarre.pasos = pasos;
          ctx.sonido('clac');
          ctx.vibrar(mano, 0.35, 25);
        }
      } else {
        // Al soltar: un toque corto gira 45°; si no, encaja en la postura más cercana
        if (agarre.pasos === 0 && Math.abs(agarre.giro) < 0.2 && agarre.tiempo < 0.45) {
          girar(pz, 1);
          agarre.pasos = 1;
          ctx.sonido('clac');
        }
        pz.objetivo = agarre.angInicio + (agarre.pasos * Math.PI) / 4;
        agarre.pieza = null;
      }
    });
  }

  function actualizarMarcador() {
    const s = Math.max(0, Math.ceil(reloj));
    const lineas = [
      { texto: ctx.t('sala', { n: sala }) + '  ·  ' + ctx.t('puntos', { n: puntos }), tam: 0.62, color: '#cfd8dc' },
      { texto: Math.floor(s / 60) + ':' + String(s % 60).padStart(2, '0'), tam: 1.5, color: estado === 'fin' || s <= 20 ? '#ff8a80' : '#9fe8ff' },
    ];
    if (tiempoMensaje > 0) lineas.push({ texto: mensaje, tam: 0.62, color: colorMensaje });
    else if (!empezado) lineas.push({ texto: ctx.enVR() ? ctx.t('intro') : ctx.t(ctx.tactil ? 'introTactil' : 'introRaton'), tam: 0.5 });
    marcador.escribir(lineas);
  }

  // ─── Bucle ─────────────────────────────────────────────────────────────
  function actualizar(dt, t) {
    tiempoMensaje -= dt;
    aparicion = Math.min(1, aparicion + dt / 0.45);
    if (estado === 'jugando' && empezado) {
      reloj -= dt;
      const s = Math.ceil(reloj);
      if (s <= 10 && s > 0 && s !== segundoAviso) {
        segundoAviso = s;
        ctx.sonido('tic');
      }
      if (reloj <= 0) {
        reloj = 0;
        estado = 'fin';
        tEstado = 0;
        ctx.sonido('zumbador');
        ctx.puntuacion(puntos);
        decir(ctx.t('finTiempo'), '#ff8a80', 6);
      }
    }
    if (estado === 'superada') {
      tEstado += dt;
      // Al cabo de un momento las piezas se van y llega la sala siguiente
      if (tEstado > 1.4) aparicion = Math.max(0, 1 - (tEstado - 1.4) / 0.35) - 1e-3;
      if (tEstado > 1.8) {
        sala += 1;
        montarSala();
      }
    }
    if (estado === 'fin') {
      tEstado += dt;
      if (tEstado > 6) nuevaPartida();
    }
    if (ctx.enVR()) {
      anillos[0].visible = false;
      manos(dt);
    } else {
      for (const p of punteros) p.visible = false;
      anillos[1].visible = false;
      anillos[2].visible = false;
      raton();
    }
    if (sucio) {
      sucio = false;
      comprobarRayos();
    }
    dibujarPiezas(dt, t);
    actualizarMarcador();
  }

  nuevaPartida();
  actualizarMarcador();

  return {
    actualizar,
    liberar() {},
  };
}
