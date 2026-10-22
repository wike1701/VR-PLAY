// MAZO DE FERIA
// El martillo de fuerza de una feria de noche, con la noria girando al fondo. Golpea la
// base con el mazo y el disco sube por la torre: si llega arriba, suena la campana.
// 10 golpes. Cada golpe vale la altura que alcanza (0-100); la campana, 125. En cada
// golpe se ilumina una franja dorada en la torre: si el disco se para justo en ella,
// 50 más. Fuerza y puntería a la vez.
// En VR llevas el mazo en la mano: levántalo y golpea la base con fuerza. Sin gafas,
// mantén pulsado el ratón (o el dedo) y suelta cuando la barra marque la fuerza.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código.
export async function precargar() {}

const GOLPES = 10;
const BASE = new THREE.Vector3(0, 0.82, -0.75);   // centro de la base que se golpea
const ALTO_TORRE = 4.2;
const Y_TORRE = 1.0;                               // dónde empieza la escala
const LARGO_MAZO = 0.75;
const N_LUCES = 24;
const PERIODO_FUERZA = 1.3;
const ANCHO_FRANJA = 0.12;                         // en fracción de la torre

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (r) => ctx.recurso(r);

  ctx.fondo(0x1a1f3c, {
    cenit: 0x0b0d22, horizonte: 0x3a2a52, estrellas: 0.8, luna: true, sol: [0.5, 0.4, -0.7], niebla: [20, 70],
    paisaje: { tipo: 'colinas', color: 0x1d2440, radio: 60 },
  });
  ctx.sueloBase(false);
  ctx.vistaEscritorio(new THREE.Vector3(1.1, 1.9, 3.0), new THREE.Vector3(0, 2.7, -1.1));

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

  // ─── La feria ──────────────────────────────────────────────────────────
  const suelo = new THREE.Mesh(
    R(new THREE.PlaneGeometry(60, 60)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.grano(0x6a5a48, { repetir: [20, 20], semilla: 901 })) })),
  );
  suelo.rotation.x = -Math.PI / 2;
  raiz.add(suelo);
  // Noria al fondo
  const noria = new THREE.Group();
  const matNoria = R(new THREE.MeshBasicMaterial({ color: 0xffd23f, toneMapped: false }));
  const radiosNoria = [];
  for (let i = 0; i < 6; i++) radiosNoria.push(colocar(new THREE.BoxGeometry(0.08, 14, 0.08), 0, 0, 0, 0, 0, (i / 6) * Math.PI));
  const rueda = new THREE.Mesh(fusionar([
    new THREE.TorusGeometry(7, 0.08, 6, 48),
    new THREE.TorusGeometry(6.6, 0.05, 6, 48),
    ...radiosNoria,
  ]), matNoria);
  noria.add(rueda);
  const cabinas = new THREE.InstancedMesh(R(new THREE.BoxGeometry(0.7, 0.6, 0.6)), R(new THREE.MeshLambertMaterial({ emissive: 0x331100 })), 12);
  const colorTmp = new THREE.Color();
  for (let i = 0; i < 12; i++) cabinas.setColorAt(i, colorTmp.set([0xe8457a, 0x2fb6d8, 0x3fbf6a, 0xff6a3d][i % 4]));
  raiz.add(cabinas);
  noria.position.set(-9, 8.5, -24);
  raiz.add(noria);
  const patas = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(0.25, 9.5, 0.25), -10.6, 4.4, -24, 0, 0, -0.18),
    colocar(new THREE.BoxGeometry(0.25, 9.5, 0.25), -7.4, 4.4, -24, 0, 0, 0.18),
  ]), R(new THREE.MeshLambertMaterial({ color: 0x3a3f52 })));
  raiz.add(patas);
  // Casetas con toldos a rayas
  const texRayas = R(ctx.texturaCanvas((g, tam) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#f4efe6' : '#2a6fb2';
      g.fillRect((i * tam) / 8, 0, tam / 8, tam);
    }
  }, { tam: 64, repetir: [2, 1] }));
  const casetas = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(3, 2.4, 2.4), 5.5, 1.2, -9),
    colocar(new THREE.ConeGeometry(2.3, 1.2, 4), 5.5, 3.0, -9, 0, Math.PI / 4),
    colocar(new THREE.BoxGeometry(3, 2.4, 2.4), -5.0, 1.2, -6),
    colocar(new THREE.ConeGeometry(2.3, 1.2, 4), -5.0, 3.0, -6, 0, Math.PI / 4),
    colocar(new THREE.BoxGeometry(3, 2.4, 2.4), 9.5, 1.2, -14),
    colocar(new THREE.ConeGeometry(2.3, 1.2, 4), 9.5, 3.0, -14, 0, Math.PI / 4),
  ]), R(new THREE.MeshLambertMaterial({ map: texRayas })));
  raiz.add(casetas);
  for (const [x, z] of [[5.5, -9], [-5, -6], [9.5, -14]]) {
    const s = ctx.crearSombra({ radio: 2.2, opacidad: 0.4 });
    s.position.set(x, 0.005, z);
    raiz.add(s);
  }

  // ─── La torre ──────────────────────────────────────────────────────────
  const zTorre = BASE.z - 0.35;
  const texEscala = R(ctx.texturaCanvas((g, tam) => {
    // De abajo (verde) a arriba (rojo), con rayas cada décima. La torre es 10 veces más
    // alta que ancha, así que el texto se dibuja aplastado para que se vea bien
    const deg = g.createLinearGradient(0, tam, 0, 0);
    deg.addColorStop(0, '#3fbf6a');
    deg.addColorStop(0.5, '#ffd23f');
    deg.addColorStop(1, '#e53935');
    g.fillStyle = deg;
    g.fillRect(0, 0, tam, tam);
    g.fillStyle = '#10142a';
    for (let i = 1; i < 10; i++) g.fillRect(0, (i * tam) / 10 - 2, tam, 4);
    g.fillStyle = '#ffffff';
    g.font = `bold ${tam * 0.3}px sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let i = 1; i < 10; i++) {
      g.save();
      g.translate(tam / 2, tam - (i * tam) / 10 + tam * 0.05);
      g.scale(1, 0.1);
      g.fillText(String(i * 10), 0, 0);
      g.restore();
    }
  }, { tam: 512 }));
  const escala = new THREE.Mesh(R(new THREE.PlaneGeometry(0.42, ALTO_TORRE)), R(new THREE.MeshBasicMaterial({ map: texEscala, toneMapped: false })));
  escala.position.set(0, Y_TORRE + ALTO_TORRE / 2, zTorre + 0.06);
  raiz.add(escala);
  const matMadera = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.madera(0x8a3a2a, { semilla: 902 })) }));
  const torre = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(0.62, ALTO_TORRE + 0.4, 0.1), 0, Y_TORRE + ALTO_TORRE / 2, zTorre),
    colocar(new THREE.BoxGeometry(0.1, ALTO_TORRE + 0.4, 0.14), -0.33, Y_TORRE + ALTO_TORRE / 2, zTorre + 0.02),
    colocar(new THREE.BoxGeometry(0.1, ALTO_TORRE + 0.4, 0.14), 0.33, Y_TORRE + ALTO_TORRE / 2, zTorre + 0.02),
    colocar(new THREE.BoxGeometry(1.4, 0.12, 0.9), 0, 0.06, BASE.z - 0.1),
    // Pedestal de la base
    colocar(new THREE.CylinderGeometry(0.16, 0.22, BASE.y - 0.12, 12), BASE.x, (BASE.y - 0.12) / 2 + 0.06, BASE.z),
    // Soportes
    colocar(new THREE.BoxGeometry(0.08, 2.0, 0.08), -0.3, 1.0, zTorre - 0.6, 0.5),
    colocar(new THREE.BoxGeometry(0.08, 2.0, 0.08), 0.3, 1.0, zTorre - 0.6, 0.5),
  ]), matMadera);
  raiz.add(torre);
  const sombraTorre = ctx.crearSombra({ radio: 0.9, opacidad: 0.5 });
  sombraTorre.position.set(0, 0.125, BASE.z - 0.1);
  raiz.add(sombraTorre);
  // Base que se golpea (botón rojo) y raíl
  const matMetal = R(new THREE.MeshStandardMaterial({ color: 0xc9ced4, roughness: 0.3, metalness: 0.85 }));
  const base = new THREE.Mesh(R(new THREE.CylinderGeometry(0.15, 0.17, 0.06, 20)), R(new THREE.MeshLambertMaterial({ color: 0xd6283a })));
  base.position.copy(BASE);
  raiz.add(base);
  const rail = new THREE.Mesh(R(new THREE.CylinderGeometry(0.012, 0.012, ALTO_TORRE + 0.3, 6)), matMetal);
  rail.position.set(0, Y_TORRE + ALTO_TORRE / 2, zTorre + 0.12);
  raiz.add(rail);
  // Campana arriba
  const campana = new THREE.Mesh(
    R(new THREE.LatheGeometry([new THREE.Vector2(0, 0.22), new THREE.Vector2(0.06, 0.21), new THREE.Vector2(0.1, 0.12), new THREE.Vector2(0.13, 0.02), new THREE.Vector2(0.15, 0)], 20)),
    R(new THREE.MeshStandardMaterial({ color: 0xf1c040, roughness: 0.25, metalness: 0.9, emissive: 0x000000 })),
  );
  campana.position.set(0, Y_TORRE + ALTO_TORRE + 0.05, zTorre + 0.12);
  raiz.add(campana);
  // Disco que sube
  const disco = new THREE.Mesh(R(new THREE.CylinderGeometry(0.07, 0.07, 0.05, 16).rotateX(Math.PI / 2)), R(new THREE.MeshBasicMaterial({ color: 0xff6a3d, toneMapped: false })));
  raiz.add(disco);
  // Luces a los lados de la torre que se encienden al pasar el disco
  const luces = new THREE.InstancedMesh(R(new THREE.SphereGeometry(0.035, 8, 6)), R(new THREE.MeshBasicMaterial({ toneMapped: false })), N_LUCES * 2);
  for (let i = 0; i < N_LUCES; i++) {
    for (const lado of [0, 1]) {
      luces.setMatrixAt(i * 2 + lado, matrizTmp.makeTranslation(lado ? 0.33 : -0.33, Y_TORRE + ((i + 0.5) / N_LUCES) * ALTO_TORRE, zTorre + 0.1));
      luces.setColorAt(i * 2 + lado, colorTmp.set(0x332a20));
    }
  }
  raiz.add(luces);
  // Franja dorada: la altura a la que hay que dejar el disco
  const franja = new THREE.Mesh(R(new THREE.PlaneGeometry(0.62, 1)), R(new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.45, depthWrite: false, toneMapped: false })));
  franja.scale.y = ANCHO_FRANJA * ALTO_TORRE;
  raiz.add(franja);

  // ─── El mazo ───────────────────────────────────────────────────────────
  const geoMango = R(new THREE.CylinderGeometry(0.018, 0.022, LARGO_MAZO, 10).rotateX(Math.PI / 2).translate(0, 0, -LARGO_MAZO / 2 + 0.1));
  const geoCabeza = R(new THREE.CylinderGeometry(0.075, 0.075, 0.26, 16).rotateZ(Math.PI / 2).translate(0, 0, -LARGO_MAZO + 0.1));
  const geoAros = fusionar([
    colocar(new THREE.TorusGeometry(0.076, 0.008, 6, 20), 0.11, 0, -LARGO_MAZO + 0.1, 0, Math.PI / 2),
    colocar(new THREE.TorusGeometry(0.076, 0.008, 6, 20), -0.11, 0, -LARGO_MAZO + 0.1, 0, Math.PI / 2),
  ]);
  const matMango = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.madera(0xd7a86e, { semilla: 903 })) }));
  const matCabeza = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.madera(0x9a5a2a, { semilla: 904 })) }));
  function crearMazo() {
    const m = new THREE.Group();
    m.add(new THREE.Mesh(geoMango, matMango), new THREE.Mesh(geoCabeza, matCabeza), new THREE.Mesh(geoAros, matMetal));
    return m;
  }
  const CABEZA = new THREE.Vector3(0, 0, -LARGO_MAZO + 0.1);
  const mazosVR = ctx.manos.map((mano) => {
    const m = crearMazo();
    m.visible = false;
    ctx.adjuntarAMano(mano, m);
    return { mano, objeto: m, cabeza: new THREE.Vector3(), antes: new THREE.Vector3(), lista: false };
  });
  // Sin gafas: el mazo gira sobre un pivote al lado de la base
  const pivote = new THREE.Group();
  pivote.position.set(0.2, 1.45, BASE.z + 0.5);
  const mazoRaton = crearMazo();
  mazoRaton.rotation.y = Math.PI;
  mazoRaton.position.set(-0.2, 0, -0.1);
  pivote.add(mazoRaton);
  raiz.add(pivote);

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.1, alto: 0.32 });
  marcador.mesh.position.set(-1.05, 2.0, -1.2);
  marcador.mesh.rotation.y = 0.4;
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'juego' | 'fin'
  // fase del disco: 'listo' | 'sube' | 'baja' | 'resultado'
  let fase = 'listo';
  let reloj = 3;
  let golpes = 0;
  let puntos = 0;
  let record = ctx.leer('record', 0);
  let aviso = '';
  let tiempoAviso = 0;
  let altura = 0;       // fracción de la torre (0-1)
  let velDisco = 0;
  let maxima = 0;
  let franjaY = 0.5;
  let espera = 0;
  let cargando = false;
  let tiempoCarga = 0;
  let fuerza = 0;
  let animGolpe = 0;
  let manoMazo = null;
  let brilloCampana = 0;
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const vel = new THREE.Vector3();

  function nuevaFranja() {
    franjaY = 0.3 + Math.random() * 0.55;
    franja.position.set(0, Y_TORRE + franjaY * ALTO_TORRE, zTorre + 0.075);
  }

  function empezarPartida() {
    estado = 'juego';
    golpes = 0;
    puntos = 0;
    fase = 'listo';
    nuevaFranja();
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

  // Golpe con una fuerza de 0 a 1.1 (más de 1 llega a la campana)
  function golpear(f, mano) {
    if (fase !== 'listo' || estado !== 'juego') return;
    golpes += 1;
    fase = 'sube';
    maxima = 0;
    altura = 0;
    // Velocidad inicial para que el disco llegue a la altura f (en fracción de la torre)
    velDisco = Math.sqrt(2 * 2.2 * Math.max(0.02, f));
    ctx.efectos.impacto(f > 0.7 ? 'grande' : f > 0.35 ? 'medio' : 'pequeño', { pos: BASE, mano, color: 0xff6a3d, sonido: 'saco' });
    ctx.sonido('subida');
  }

  function resolver() {
    fase = 'resultado';
    espera = 1.6;
    const campanazo = maxima >= 1;
    let gana = campanazo ? 125 : Math.round(maxima * 100);
    const enFranja = !campanazo && Math.abs(maxima - franjaY) <= ANCHO_FRANJA / 2;
    if (enFranja) gana += 50;
    puntos += gana;
    tmp.set(0.45, Y_TORRE + Math.min(1, maxima) * ALTO_TORRE, zTorre + 0.2);
    if (campanazo) {
      aviso = ctx.t('campana');
      ctx.efectos.texto(tmp, `+${gana}`, { color: '#ff6a3d', tam: 1.8 });
    } else if (enFranja) {
      aviso = ctx.t('franja', { n: gana });
      ctx.efectos.impacto('medio', { pos: tmp, color: 0xffd23f, sonido: 'caja' });
      ctx.efectos.texto(tmp, `+${gana}`, { color: '#ffd23f', tam: 1.6 });
    } else {
      aviso = ctx.t('altura', { n: Math.round(maxima * 100) });
      ctx.efectos.texto(tmp, `+${gana}`, { color: gana >= 60 ? '#ffe08a' : '#ffffff', tam: 1.1 });
      ctx.sonido(gana >= 30 ? 'punto' : 'fallo');
    }
    tiempoAviso = 1.6;
  }

  // ─── Entrada ───────────────────────────────────────────────────────────
  function entradaVR(dt) {
    pivote.visible = false;
    for (const m of mazosVR) if (m.mano.activa && m.mano.gatilloPulsado) manoMazo = m;
    if (!manoMazo || !manoMazo.mano.activa) manoMazo = mazosVR.find((m) => m.mano.activa) || null;
    for (const m of mazosVR) {
      m.objeto.visible = m === manoMazo;
      if (m !== manoMazo) {
        m.lista = false;
        continue;
      }
      m.mano.grip.localToWorld(m.cabeza.copy(CABEZA));
      if (!m.lista) {
        m.antes.copy(m.cabeza);
        m.lista = true;
        continue;
      }
      vel.copy(m.cabeza).sub(m.antes).divideScalar(Math.max(dt, 1e-3));
      // ¿La cabeza baja y cruza la base en este fotograma?
      const arriba = BASE.y + 0.07;
      // (más de 25 m/s es un salto del seguimiento, no un golpe)
      if (fase === 'listo' && vel.y < -1.5 && vel.y > -25 && m.antes.y >= arriba && m.cabeza.y < arriba + 0.02) {
        const u = (m.antes.y - arriba) / Math.max(1e-4, m.antes.y - m.cabeza.y);
        tmp.copy(m.antes).lerp(m.cabeza, Math.min(1, u));
        if (Math.hypot(tmp.x - BASE.x, tmp.z - BASE.z) < 0.22) {
          // De 2 m/s (nada) a 10 m/s (campana)
          const f = Math.pow(Math.max(0, (-vel.y - 2) / 8), 0.85) * 1.1;
          golpear(f, m.mano);
          ctx.vibrar(m.mano, 0.8, 80);
        }
      }
      m.antes.copy(m.cabeza);
    }
  }

  function entradaRaton(dt) {
    for (const m of mazosVR) {
      m.objeto.visible = false;
      m.lista = false;
    }
    pivote.visible = true;
    animGolpe = Math.max(0, animGolpe - dt * 3);
    const listo = estado === 'juego' && fase === 'listo';
    if (listo && ctx.raton.pulsado && !cargando) {
      cargando = true;
      tiempoCarga = 0;
    }
    if (cargando) {
      tiempoCarga += dt;
      fuerza = (0.5 - 0.5 * Math.cos((tiempoCarga / PERIODO_FUERZA) * Math.PI * 2)) * 1.1;
      // El mazo se levanta mientras carga
      pivote.rotation.x = fuerza * 1.3;
      if (!ctx.raton.pulsado) {
        cargando = false;
        animGolpe = 1;
        golpear(fuerza, null);
      }
    } else {
      pivote.rotation.x = animGolpe > 0.7 ? -0.25 : pivote.rotation.x * 0.85;
    }
  }

  // ─── El disco ──────────────────────────────────────────────────────────
  function moverDisco(dt) {
    if (fase === 'sube') {
      velDisco -= 2.2 * dt;
      altura += velDisco * dt;
      maxima = Math.max(maxima, altura);
      if (altura >= 1) {
        altura = 1;
        maxima = 1;
        velDisco = -0.6;
        fase = 'baja';
        brilloCampana = 1;
        ctx.efectos.impacto('grande', { pos: campana.position, color: 0xffd23f, sonido: 'campana' });
        ctx.sonido('ovacion');
        resolver();
        fase = 'baja';
      } else if (velDisco <= 0) {
        fase = 'baja';
        resolver();
        fase = 'baja';
      }
    } else if (fase === 'baja' || fase === 'resultado') {
      velDisco -= 2.2 * dt;
      altura = Math.max(0, altura + velDisco * dt);
      if (altura <= 0) velDisco = 0;
    }
    disco.position.set(0, Y_TORRE + altura * ALTO_TORRE + 0.03, zTorre + 0.14);
    // Luces: encendidas hasta la altura máxima del golpe
    const hasta = fase === 'listo' ? -1 : maxima;
    for (let i = 0; i < N_LUCES; i++) {
      const u = (i + 0.5) / N_LUCES;
      colorTmp.set(u <= hasta ? (i % 2 ? 0xffd23f : 0xff6a3d) : 0x332a20);
      luces.setColorAt(i * 2, colorTmp);
      luces.setColorAt(i * 2 + 1, colorTmp);
    }
    luces.instanceColor.needsUpdate = true;
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
        { texto: ctx.t('partida.finPuntos', { n: puntos }), tam: 1.3, color: '#ff8a65' },
        { texto: ctx.t('partida.recordNuevaPartida', { record, n: Math.max(1, Math.ceil(reloj)) }), tam: 0.72 },
      ]);
    } else {
      let linea;
      if (tiempoAviso > 0) linea = aviso;
      else if (cargando) {
        const llenas = Math.min(10, Math.round((fuerza / 1.1) * 10));
        linea = ctx.t('fuerza', { barra: '▮'.repeat(llenas) + '▯'.repeat(10 - llenas) });
      } else linea = ctx.t('objetivo', { n: Math.round(franjaY * 100) });
      marcador.escribir([
        { texto: ctx.t('marcador', { golpe: Math.min(GOLPES, golpes + (fase === 'listo' ? 1 : 0)), total: GOLPES, puntos }), tam: 1.15 },
        { texto: linea, tam: 0.8, color: tiempoAviso > 0 ? '#ffe08a' : cargando ? '#ff8a65' : '#cfd8dc' },
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
    moverDisco(dt);
    if (fase === 'baja' || fase === 'resultado') {
      espera -= dt;
      if (espera <= 0 && altura <= 0) {
        if (golpes >= GOLPES) {
          if (estado === 'juego') terminar();
        } else {
          nuevaFranja();
        }
        fase = 'listo';
        maxima = 0;
      }
    }
    // La campana brilla al sonar
    brilloCampana = Math.max(0, brilloCampana - dt * 1.5);
    campana.material.emissive.setRGB(brilloCampana, brilloCampana * 0.7, 0);
    campana.rotation.z = Math.sin(t * 30) * 0.08 * brilloCampana;
    franja.visible = estado === 'juego';
    franja.material.opacity = 0.35 + Math.sin(t * 4) * 0.12;
    // La noria gira despacio
    rueda.rotation.z = t * 0.12;
    for (let i = 0; i < 12; i++) {
      const a = (i / 12) * Math.PI * 2 + t * 0.12;
      cabinas.setMatrixAt(i, matrizTmp.makeTranslation(noria.position.x + Math.cos(a) * 7, noria.position.y + Math.sin(a) * 7 - 0.4, noria.position.z));
    }
    cabinas.instanceMatrix.needsUpdate = true;
    actualizarMarcador();
  }

  nuevaFranja();
  actualizarMarcador();

  return {
    actualizar,
    liberar() {},
  };
}
