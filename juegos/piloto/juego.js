// PILOTO ESTELAR
// Shooter sobre raíles en el espacio, al estilo de los clásicos: tu nave vuela delante
// de ti y el espacio viene hacia ella. Pasa por los anillos dorados (recargan el escudo),
// esquiva los asteroides y los disparos, derriba los cazas y, al final, la nave nodriza.
// En VR la nave se pilota inclinando los mandos (como una palanca: arriba sube, abajo baja,
// girarlos la lleva a los lados) y se dispara con el gatillo a donde miras.
// Con ratón o con el dedo, la nave sigue al puntero y dispara hacia él.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const VELOCIDAD = 28;            // m/s a los que el espacio viene hacia la nave
const Z_NAVE = -2.6;             // la nave vuela a esta distancia delante del jugador
const CAJA = { x: 1.5, yMin: 0.75, yMax: 2.15 }; // por donde se puede mover la nave
const Y_CENTRO = (CAJA.yMin + CAJA.yMax) / 2;
const Z_APARICION = -150;
const VEL_NAVE = 2.4;            // m/s máximos de la nave
const INCLINACION_MUERTA = THREE.MathUtils.degToRad(5);
const INCLINACION_MAXIMA = THREE.MathUtils.degToRad(30);
const RADIO_NAVE = 0.35;
const VEL_LASER = 130;
const CADENCIA = 0.13;           // segundos entre disparos
const ASISTENCIA = THREE.MathUtils.degToRad(4.5); // ayuda a apuntar: blancos a menos de este ángulo
const DURACION_MISION = 75;      // segundos de oleadas antes de la nave nodriza
const TIEMPO_JEFE = 45;          // si no la derribas en este tiempo, se escapa
const VIDA_JEFE = 30;
const PUNTOS = { anillo: 50, caza: 100, asteroide: 20, asteroideGrande: 50, jefe: 1000 };

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);
  const azar = (a, b) => a + Math.random() * (b - a);

  ctx.fondo(0x070a1c, { cenit: new THREE.Color(0x020309), horizonte: new THREE.Color(0x0d1233), suelo: new THREE.Color(0x020309) });
  ctx.sueloBase(false);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.8, 0.7), new THREE.Vector3(0, 1.45, -25));
  // El espacio es profundo: la cámara ve más lejos y la niebla está lejos mientras dura el juego
  const camaraLejos = ctx.camara.far;
  ctx.camara.far = 600;
  ctx.camara.updateProjectionMatrix();
  const niebla = ctx.escena.fog;
  const nieblaOriginal = { near: niebla.near, far: niebla.far };
  niebla.near = 70;
  niebla.far = 150;

  // ─── Espacio: estrellas y un planeta ───────────────────────────────────
  const N_ESTRELLAS = 700;
  const geoEstrellas = R(new THREE.BufferGeometry());
  const posEstrellas = new Float32Array(N_ESTRELLAS * 3);
  for (let i = 0; i < N_ESTRELLAS; i++) {
    // Lejos de la zona de juego para que no pasen por delante de la cara
    let x;
    let y;
    do {
      x = azar(-160, 160);
      y = azar(-110, 120);
    } while (Math.abs(x) < 12 && Math.abs(y - Y_CENTRO) < 9);
    posEstrellas.set([x, y, azar(-340, -40)], i * 3);
  }
  geoEstrellas.setAttribute('position', new THREE.BufferAttribute(posEstrellas, 3));
  const estrellas = new THREE.Points(geoEstrellas, R(new THREE.PointsMaterial({ color: 0xdfe8ff, size: 0.9, sizeAttenuation: true, fog: false })));
  estrellas.frustumCulled = false;
  raiz.add(estrellas);

  const texPlaneta = R(ctx.texturaCanvas((g, tam, al) => {
    const grad = g.createLinearGradient(0, 0, 0, tam);
    grad.addColorStop(0, '#6a4cc2');
    grad.addColorStop(0.5, '#d9825b');
    grad.addColorStop(1, '#3b2a73');
    g.fillStyle = grad;
    g.fillRect(0, 0, tam, tam);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(255,255,255,${al() * 0.12})`;
      g.fillRect(0, al() * tam, tam, 2 + al() * 8);
    }
  }, { tam: 256, semilla: 5 }));
  const planeta = new THREE.Mesh(R(new THREE.SphereGeometry(50, 32, 20)), R(new THREE.MeshBasicMaterial({ map: texPlaneta, fog: false })));
  planeta.position.set(-170, 105, -460);
  planeta.rotation.z = 0.35;
  raiz.add(planeta);

  // ─── Nave del jugador ──────────────────────────────────────────────────
  // Construida mirando a -Z (hacia donde vuela)
  const nave = new THREE.Group();
  const matBlanco = R(new THREE.MeshStandardMaterial({ color: 0xe8ecf2, metalness: 0.5, roughness: 0.35 }));
  const matAzul = R(new THREE.MeshStandardMaterial({ color: 0x1e88e5, metalness: 0.4, roughness: 0.3 }));
  const matCabina = R(new THREE.MeshStandardMaterial({ color: 0x80deea, metalness: 0.2, roughness: 0.05, emissive: 0x0b3d4a }));
  const fuselaje = new THREE.Mesh(R(new THREE.ConeGeometry(0.11, 0.75, 6).rotateX(-Math.PI / 2)), matBlanco);
  const cabina = new THREE.Mesh(R(new THREE.SphereGeometry(0.07, 12, 8)), matCabina);
  cabina.scale.set(1, 0.7, 1.8);
  cabina.position.set(0, 0.06, 0.05);
  nave.add(fuselaje, cabina);
  const geoAla = R(new THREE.BoxGeometry(0.42, 0.018, 0.24));
  const geoAleta = R(new THREE.BoxGeometry(0.018, 0.2, 0.16));
  const puntasAla = [];
  for (const s of [-1, 1]) {
    const ala = new THREE.Mesh(geoAla, matBlanco);
    ala.position.set(s * 0.26, -0.02, 0.12);
    ala.rotation.z = s * 0.18;
    ala.rotation.y = s * 0.25;
    const aleta = new THREE.Mesh(geoAleta, matAzul);
    aleta.position.set(s * 0.46, 0.06, 0.16);
    aleta.rotation.z = -s * 0.25;
    nave.add(ala, aleta);
    puntasAla.push(new THREE.Vector3(s * 0.44, 0.02, -0.02));
  }
  const matLlama = R(new THREE.MeshBasicMaterial({ color: 0x4fc3f7, transparent: true, opacity: 0.85, blending: THREE.AdditiveBlending, depthWrite: false }));
  const llama = new THREE.Mesh(R(new THREE.ConeGeometry(0.06, 0.35, 8).rotateX(Math.PI / 2).translate(0, 0, 0.55)), matLlama);
  nave.add(llama);
  nave.position.set(0, Y_CENTRO, Z_NAVE);
  raiz.add(nave);

  // ─── Retícula (donde miras / donde está el ratón) ──────────────────────
  const matReticula = R(new THREE.MeshBasicMaterial({ color: 0x76ff03, transparent: true, opacity: 0.85, depthTest: false, fog: false }));
  const reticula = new THREE.Mesh(R(new THREE.RingGeometry(0.22, 0.28, 32)), matReticula);
  reticula.renderOrder = 10;
  const cruz = new THREE.Mesh(R(new THREE.RingGeometry(0.03, 0.06, 12)), matReticula);
  reticula.add(cruz);
  raiz.add(reticula);

  // ─── Asteroides (todos en una malla instanciada) ───────────────────────
  // Roca: icosaedro con los vértices desplazados (el mismo desplazamiento para
  // los vértices repetidos, para que no se abra)
  const geoRoca = R(new THREE.IcosahedronGeometry(1, 1));
  {
    const pos = geoRoca.attributes.position;
    const desplazamientos = new Map();
    for (let i = 0; i < pos.count; i++) {
      const clave = `${pos.getX(i).toFixed(3)},${pos.getY(i).toFixed(3)},${pos.getZ(i).toFixed(3)}`;
      if (!desplazamientos.has(clave)) desplazamientos.set(clave, 0.75 + Math.random() * 0.4);
      const f = desplazamientos.get(clave);
      pos.setXYZ(i, pos.getX(i) * f, pos.getY(i) * f, pos.getZ(i) * f);
    }
    geoRoca.computeVertexNormals();
  }
  const MAX_ASTEROIDES = 60;
  const mallaAsteroides = new THREE.InstancedMesh(geoRoca, R(new THREE.MeshStandardMaterial({ color: 0x8d7b6a, roughness: 0.95, flatShading: true })), MAX_ASTEROIDES);
  mallaAsteroides.frustumCulled = false;
  mallaAsteroides.count = 0;
  raiz.add(mallaAsteroides);
  const asteroides = Array.from({ length: MAX_ASTEROIDES }, () => ({
    activo: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Euler(), giro: new THREE.Vector3(), escala: new THREE.Vector3(), radio: 1, vida: 1, grande: false,
  }));

  // ─── Láseres, disparos enemigos y partículas (instanciados) ───────────
  const MAX_LASERES = 40;
  const mallaLaseres = new THREE.InstancedMesh(R(new THREE.BoxGeometry(0.035, 0.035, 1.4)), R(new THREE.MeshBasicMaterial({ color: 0x69f0ae, fog: false })), MAX_LASERES);
  mallaLaseres.frustumCulled = false;
  mallaLaseres.count = 0;
  raiz.add(mallaLaseres);
  const laseres = Array.from({ length: MAX_LASERES }, () => ({ activo: false, pos: new THREE.Vector3(), prev: new THREE.Vector3(), vel: new THREE.Vector3(), vida: 0 }));

  const MAX_BALAS = 40;
  const mallaBalas = new THREE.InstancedMesh(R(new THREE.SphereGeometry(0.13, 10, 8)), R(new THREE.MeshBasicMaterial({ color: 0xff6e40, fog: false })), MAX_BALAS);
  mallaBalas.frustumCulled = false;
  mallaBalas.count = 0;
  raiz.add(mallaBalas);
  const balas = Array.from({ length: MAX_BALAS }, () => ({ activo: false, pos: new THREE.Vector3(), prev: new THREE.Vector3(), vel: new THREE.Vector3(), vida: 0 }));

  const MAX_PARTICULAS = 180;
  const mallaParticulas = new THREE.InstancedMesh(R(new THREE.BoxGeometry(1, 1, 1)), R(new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false })), MAX_PARTICULAS);
  mallaParticulas.frustumCulled = false;
  raiz.add(mallaParticulas);
  const particulas = Array.from({ length: MAX_PARTICULAS }, () => ({ activo: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), vida: 0, vidaInicial: 1, tam: 0.1, color: new THREE.Color() }));
  for (let i = 0; i < MAX_PARTICULAS; i++) mallaParticulas.setColorAt(i, new THREE.Color(1, 1, 1));
  mallaParticulas.count = 0;

  const geoDestello = R(new THREE.SphereGeometry(1, 16, 12));
  const destellos = Array.from({ length: 8 }, () => {
    const malla = new THREE.Mesh(geoDestello, R(new THREE.MeshBasicMaterial({ color: 0xffd180, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
    malla.visible = false;
    raiz.add(malla);
    return { malla, vida: 0, vidaInicial: 1, tam: 1 };
  });

  // ─── Anillos ───────────────────────────────────────────────────────────
  const RADIO_ANILLO = 0.9;
  const geoAnillo = R(new THREE.TorusGeometry(RADIO_ANILLO, 0.07, 10, 40));
  const matAnillo = R(new THREE.MeshStandardMaterial({ color: 0xffc400, emissive: 0x6a4a00, metalness: 0.8, roughness: 0.25 }));
  const matAnilloPasado = R(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.5 }));
  const anillos = Array.from({ length: 12 }, () => {
    const malla = new THREE.Mesh(geoAnillo, matAnillo);
    malla.visible = false;
    raiz.add(malla);
    return { activo: false, malla, pos: new THREE.Vector3(), prevZ: 0, pasado: false };
  });

  // ─── Cazas enemigos ────────────────────────────────────────────────────
  const matCaza = R(new THREE.MeshStandardMaterial({ color: 0x8e2b2b, metalness: 0.5, roughness: 0.45 }));
  const matCazaOscuro = R(new THREE.MeshStandardMaterial({ color: 0x37323a, metalness: 0.6, roughness: 0.4 }));
  const matOjo = R(new THREE.MeshBasicMaterial({ color: 0xff1744 }));
  const geoCuerpoCaza = R(new THREE.OctahedronGeometry(0.4, 0).scale(1, 0.45, 1.5));
  const geoAlaCaza = R(new THREE.BoxGeometry(1.5, 0.05, 0.4));
  const geoOjo = R(new THREE.SphereGeometry(0.1, 8, 6));
  const cazas = Array.from({ length: 8 }, () => {
    // Construido mirando a +Z (hacia el jugador)
    const grupo = new THREE.Group();
    const cuerpo = new THREE.Mesh(geoCuerpoCaza, matCaza);
    const ala = new THREE.Mesh(geoAlaCaza, matCazaOscuro);
    ala.position.z = -0.15;
    const ojo = new THREE.Mesh(geoOjo, matOjo);
    ojo.position.set(0, 0.08, 0.45);
    grupo.add(cuerpo, ala, ojo);
    grupo.visible = false;
    raiz.add(grupo);
    return { activo: false, grupo, pos: new THREE.Vector3(), vel: new THREE.Vector3(), base: new THREE.Vector3(), fase: 0, vida: 1, proximoDisparo: 0, saliendo: false, radio: 0.75 };
  });

  // ─── Nave nodriza ──────────────────────────────────────────────────────
  const jefe = { activo: false, grupo: new THREE.Group(), pos: new THREE.Vector3(), vel: new THREE.Vector3(), vida: VIDA_JEFE, tiempo: 0, proximoDisparo: 0, radio: 2.6, escapando: false, golpe: 0 };
  {
    const matCasco = R(new THREE.MeshStandardMaterial({ color: 0x455a64, metalness: 0.7, roughness: 0.4 }));
    const casco = new THREE.Mesh(R(new THREE.BoxGeometry(4.2, 0.9, 3.2)), matCasco);
    const proa = new THREE.Mesh(R(new THREE.ConeGeometry(1.2, 2, 4).rotateX(Math.PI / 2).rotateZ(Math.PI / 4)), matCazaOscuro);
    proa.scale.set(1.6, 0.6, 1);
    proa.position.z = 2.4;
    const alas = new THREE.Mesh(R(new THREE.BoxGeometry(8.5, 0.25, 1.8)), matCaza);
    alas.position.z = -0.4;
    const nucleo = new THREE.Mesh(R(new THREE.SphereGeometry(0.65, 20, 14)), R(new THREE.MeshStandardMaterial({ color: 0xff1744, emissive: 0xff1744, emissiveIntensity: 1 })));
    nucleo.position.set(0, -0.35, 1.6);
    const geoCanon = R(new THREE.CylinderGeometry(0.12, 0.15, 1.2, 8).rotateX(Math.PI / 2));
    for (const s of [-1, 1]) {
      const canon = new THREE.Mesh(geoCanon, matCasco);
      canon.position.set(s * 3, -0.1, 0.6);
      jefe.grupo.add(canon);
    }
    jefe.grupo.add(casco, proa, alas, nucleo);
    jefe.nucleo = nucleo;
    jefe.grupo.visible = false;
    raiz.add(jefe.grupo);
  }

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 3.2, alto: 0.76 });
  marcador.mesh.position.set(0, 3.2, -6.5);
  marcador.mesh.rotation.x = 0.12;
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'cuenta' | 'mision' | 'jefe' | 'final' | 'fin'
  let reloj = 4;
  let tiempoMision = 0;
  let puntos = 0;
  let escudo = 100;
  let record = ctx.leer('record', 0);
  let anillosPasados = 0;
  let derribos = 0;
  let invulnerable = 0;
  let enfriamiento = 0;
  let alaDisparo = 0;
  let proximoPatron = 1;
  let patronesHechos = 0;
  let mensajeFinal = '';
  let colorFinal = '#ffffff';
  let neutro = null;          // inclinación de los mandos en reposo (se calibra al empezar)
  const apretonAntes = [false, false];
  const velNave = new THREE.Vector2();
  const propulsor = ctx.sonidoContinuo('propulsor');

  const cabeza = new THREE.Vector3();
  const mirada = new THREE.Vector3();
  const objetivo = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const tmp3 = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const m4 = new THREE.Matrix4();
  const eje = new THREE.Vector3(0, 0, -1);
  const destinoRaton = new THREE.Vector3(0, Y_CENTRO, Z_NAVE);
  const planoNave = new THREE.Plane(new THREE.Vector3(0, 0, 1), -Z_NAVE);
  let bloqueado = null; // blanco al que ayuda a apuntar

  // ─── Utilidades ────────────────────────────────────────────────────────
  // Distancia de p al segmento ab (con sus propios vectores: a, b y p pueden ser los temporales)
  const segAB = new THREE.Vector3();
  const segAP = new THREE.Vector3();
  function distanciaSegmento(a, b, p) {
    segAB.subVectors(b, a);
    const largo2 = segAB.lengthSq();
    let t = largo2 > 0 ? segAP.subVectors(p, a).dot(segAB) / largo2 : 0;
    t = Math.max(0, Math.min(1, t));
    return segAP.copy(a).addScaledVector(segAB, t).distanceTo(p);
  }
  const libre = (lista) => lista.find((o) => !o.activo);

  const colorExplosion = new THREE.Color();
  const amarillo = new THREE.Color(0xfff59d);
  function explosion(pos, tam = 1, color = 0xffab40) {
    const c = colorExplosion.setHex(color);
    let n = Math.round(14 * tam);
    for (const p of particulas) {
      if (n <= 0) break;
      if (p.activo) continue;
      p.activo = true;
      p.pos.copy(pos);
      p.vel.set(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).normalize().multiplyScalar(azar(3, 9) * tam);
      p.vel.z += VELOCIDAD * 0.6;
      p.vidaInicial = p.vida = azar(0.4, 0.9);
      p.tam = azar(0.05, 0.16) * tam;
      p.color.copy(c).lerp(amarillo, Math.random() * 0.6);
      n--;
    }
    const d = destellos.find((x) => x.vida <= 0) || destellos[0];
    d.malla.position.copy(pos);
    d.vidaInicial = d.vida = 0.35;
    d.tam = 1.2 * tam;
    d.malla.visible = true;
    ctx.sonido('explosion');
  }

  // ─── Oleadas ───────────────────────────────────────────────────────────
  function patronAnillos() {
    const n = 4 + Math.floor(Math.random() * 3);
    const x0 = azar(-0.8, 0.8);
    const y0 = azar(CAJA.yMin + 0.3, CAJA.yMax - 0.3);
    const ax = azar(0.4, 1.1) * (Math.random() < 0.5 ? -1 : 1);
    const ay = azar(0.2, 0.5);
    const fase = azar(0, Math.PI * 2);
    for (let i = 0; i < n; i++) {
      const a = libre(anillos);
      if (!a) break;
      a.activo = true;
      a.pasado = false;
      a.pos.set(
        THREE.MathUtils.clamp(x0 + ax * Math.sin(i * 0.8 + fase), -CAJA.x + 0.2, CAJA.x - 0.2),
        THREE.MathUtils.clamp(y0 + ay * Math.sin(i * 1.1), CAJA.yMin + 0.15, CAJA.yMax - 0.15),
        Z_APARICION - i * 16,
      );
      a.prevZ = a.pos.z;
      a.malla.material = matAnillo;
      a.malla.visible = true;
    }
  }

  function patronAsteroides(d) {
    const n = 5 + Math.floor(d * 9);
    for (let i = 0; i < n; i++) {
      const a = libre(asteroides);
      if (!a) break;
      a.activo = true;
      a.grande = Math.random() < 0.25;
      const s = a.grande ? azar(1.3, 2) : azar(0.45, 0.9);
      a.escala.set(s * azar(0.8, 1.2), s * azar(0.7, 1.1), s * azar(0.8, 1.2));
      a.radio = s * 0.92;
      a.vida = a.grande ? 3 : 1;
      // Un tercio en la zona de la nave, para obligar a esquivar o disparar
      if (Math.random() < 0.35) a.pos.set(azar(-CAJA.x, CAJA.x), azar(CAJA.yMin, CAJA.yMax), 0);
      else a.pos.set(azar(-5, 5), Y_CENTRO + azar(-3, 3), 0);
      a.pos.z = Z_APARICION - Math.random() * 45;
      a.vel.set(azar(-0.4, 0.4), azar(-0.3, 0.3), VELOCIDAD + azar(0, 6));
      a.rot.set(azar(0, 6), azar(0, 6), azar(0, 6));
      a.giro.set(azar(-1, 1), azar(-1, 1), azar(-1, 1));
    }
  }

  function patronEscuadron(d) {
    const n = 3 + Math.floor(d * 3);
    const cx = azar(-1, 1);
    const cy = azar(CAJA.yMin + 0.3, CAJA.yMax + 0.4);
    for (let i = 0; i < n; i++) {
      const c = libre(cazas);
      if (!c) break;
      const k = Math.ceil(i / 2) * (i % 2 ? 1 : -1); // formación en V
      c.activo = true;
      c.saliendo = false;
      c.vida = d > 0.6 ? 2 : 1;
      c.base.set(cx + k * 1.3, cy + Math.abs(k) * 0.35, 0);
      c.pos.set(c.base.x, c.base.y, Z_APARICION - Math.abs(k) * 6);
      c.vel.set(0, 0, 11 + d * 5);
      c.fase = azar(0, Math.PI * 2);
      c.proximoDisparo = azar(0.5, 2);
      c.grupo.visible = true;
    }
  }

  function lanzarPatron() {
    const d = Math.min(1, tiempoMision / DURACION_MISION);
    // Los tres primeros, en orden, para aprender; luego al azar
    const orden = ['anillos', 'asteroides', 'escuadron'];
    let tipo = orden[patronesHechos];
    if (!tipo) {
      const r = Math.random();
      tipo = r < 0.28 ? 'anillos' : r < 0.62 ? 'asteroides' : 'escuadron';
    }
    if (tipo === 'anillos') patronAnillos();
    else if (tipo === 'asteroides') patronAsteroides(d);
    else patronEscuadron(d);
    patronesHechos++;
    proximoPatron = 3.4 - 1.6 * d + azar(0, 0.6);
  }

  function aparecerJefe() {
    jefe.activo = true;
    jefe.escapando = false;
    jefe.vida = VIDA_JEFE;
    jefe.tiempo = 0;
    jefe.proximoDisparo = 3;
    jefe.pos.set(0, Y_CENTRO + 1.2, -175);
    jefe.grupo.visible = true;
    jefe.grupo.rotation.set(0, 0, 0);
  }

  function dispararEnemigo(origen, velocidad, desvio = 0) {
    const b = libre(balas);
    if (!b) return;
    b.activo = true;
    b.pos.copy(origen);
    b.prev.copy(origen);
    // Apunta a la nave (con un poco de margen para que se pueda esquivar)
    tmp.copy(nave.position);
    tmp.x += desvio;
    b.vel.subVectors(tmp, origen).normalize().multiplyScalar(velocidad);
    b.vida = 6;
    ctx.sonido('laserEnemigo');
  }

  // ─── Daño y puntos ─────────────────────────────────────────────────────
  function danar(cantidad) {
    if (invulnerable > 0 || estado === 'final' || estado === 'fin') return;
    escudo = Math.max(0, escudo - cantidad);
    invulnerable = 1;
    ctx.sonido('impacto');
    ctx.destello(0xff1744, 0.35);
    for (const m of ctx.manos) if (m.activa) ctx.vibrar(m, 0.9, 200);
    if (escudo <= 0) {
      explosion(nave.position, 2.2, 0xff6d00);
      nave.visible = false;
      terminarMision('Nave derribada', '#ff8a80', false);
    }
  }

  // Los puntos solo cuentan durante la misión (no los de láseres que siguen en el aire al acabar)
  const sumar = (n) => {
    if (estado === 'mision' || estado === 'jefe') puntos += n;
  };

  function terminarMision(texto, color, cumplida) {
    mensajeFinal = texto;
    colorFinal = color;
    if (cumplida) puntos += escudo * 5; // bonificación por el escudo que queda
    estado = 'final';
    reloj = 2.5;
  }

  // ─── Pilotaje ──────────────────────────────────────────────────────────
  // Inclinación media de los mandos: cabeceo (arriba/abajo) y alabeo (girarlos a los lados)
  const adelante = new THREE.Vector3();
  const derecha = new THREE.Vector3();
  function inclinacionMandos() {
    let cabeceo = 0;
    let alabeo = 0;
    let n = 0;
    for (const m of ctx.manos) {
      if (!m.activa) continue;
      m.grip.getWorldQuaternion(q);
      adelante.set(0, 0, -1).applyQuaternion(q);
      derecha.set(1, 0, 0).applyQuaternion(q);
      cabeceo += Math.asin(THREE.MathUtils.clamp(adelante.y, -1, 1));
      alabeo += -Math.asin(THREE.MathUtils.clamp(derecha.y, -1, 1));
      n++;
    }
    return n ? { cabeceo: cabeceo / n, alabeo: alabeo / n } : null;
  }
  // Inclinación → velocidad: zona muerta pequeña y a tope con 30°
  function curva(angulo) {
    const a = Math.abs(angulo);
    if (a < INCLINACION_MUERTA) return 0;
    return Math.sign(angulo) * Math.min(1, (a - INCLINACION_MUERTA) / (INCLINACION_MAXIMA - INCLINACION_MUERTA)) ** 1.3;
  }

  function pilotar(dt) {
    const vivo = nave.visible && (estado === 'mision' || estado === 'jefe' || estado === 'cuenta');
    if (ctx.enVR()) {
      const inc = inclinacionMandos();
      // El botón lateral vuelve a fijar el centro
      ctx.manos.forEach((m, i) => {
        if (m.activa && m.apreton && !apretonAntes[i] && inc) {
          neutro = inc;
          ctx.sonido('tic');
        }
        apretonAntes[i] = m.activa && m.apreton;
      });
      if (inc && !neutro && estado !== 'cuenta') neutro = inc; // mandos conectados más tarde
      if (inc && neutro && vivo && estado !== 'cuenta') {
        velNave.set(curva(inc.alabeo - neutro.alabeo), curva(inc.cabeceo - neutro.cabeceo)).multiplyScalar(VEL_NAVE);
      } else {
        velNave.multiplyScalar(0.85);
      }
      nave.position.x += velNave.x * dt;
      nave.position.y += velNave.y * dt;
    } else {
      // La nave va hacia el puntero con velocidad limitada
      const raton = ctx.raton;
      if (raton.dentro && raton.rayo.ray.intersectPlane(planoNave, tmp)) destinoRaton.copy(tmp);
      const paso = tmp.subVectors(destinoRaton, nave.position);
      paso.z = 0;
      const maximo = VEL_NAVE * 1.5 * dt;
      if (paso.length() > maximo) paso.setLength(maximo);
      if (!vivo) paso.set(0, 0, 0);
      velNave.set(paso.x / dt, paso.y / dt);
      nave.position.add(paso);
    }
    nave.position.x = THREE.MathUtils.clamp(nave.position.x, -CAJA.x, CAJA.x);
    nave.position.y = THREE.MathUtils.clamp(nave.position.y, CAJA.yMin, CAJA.yMax);
    // La nave se inclina al moverse
    nave.rotation.z = THREE.MathUtils.lerp(nave.rotation.z, -velNave.x * 0.28, Math.min(1, dt * 8));
    nave.rotation.x = THREE.MathUtils.lerp(nave.rotation.x, velNave.y * 0.18, Math.min(1, dt * 8));
  }

  // ─── Apuntar y disparar ────────────────────────────────────────────────
  function apuntar() {
    if (ctx.enVR()) {
      ctx.camara.getWorldPosition(cabeza);
      ctx.camara.getWorldDirection(mirada);
    } else {
      cabeza.copy(ctx.raton.rayo.ray.origin);
      mirada.copy(ctx.raton.rayo.ray.direction);
    }
    // Ayuda a apuntar: el blanco más cercano a la línea de la mirada
    bloqueado = null;
    let mejor = ASISTENCIA;
    const probar = (obj, pos, vel) => {
      if (pos.z > Z_NAVE - 4 || pos.z < Z_APARICION + 20) return;
      tmp.subVectors(pos, cabeza);
      const angulo = tmp.angleTo(mirada);
      if (angulo < mejor) {
        mejor = angulo;
        bloqueado = { obj, pos, vel };
      }
    };
    for (const c of cazas) if (c.activo && !c.saliendo) probar(c, c.pos, c.vel);
    for (const a of asteroides) if (a.activo) probar(a, a.pos, a.vel);
    if (jefe.activo && !jefe.escapando) probar(jefe, jefe.pos, jefe.vel);

    if (bloqueado) {
      // Adelantamos el tiro según lo que tarde en llegar el láser
      const t = bloqueado.pos.distanceTo(nave.position) / VEL_LASER;
      objetivo.copy(bloqueado.pos).addScaledVector(bloqueado.vel, t);
      reticula.position.copy(bloqueado.pos);
      reticula.scale.setScalar(Math.max(1, cabeza.distanceTo(bloqueado.pos) / 15));
      matReticula.color.setHex(0xff5252);
    } else {
      objetivo.copy(cabeza).addScaledVector(mirada, 90);
      reticula.position.copy(cabeza).addScaledVector(mirada, 15);
      reticula.scale.setScalar(1);
      matReticula.color.setHex(0x76ff03);
    }
    reticula.lookAt(cabeza);
    reticula.visible = (estado === 'mision' || estado === 'jefe' || estado === 'cuenta') && (ctx.enVR() || ctx.raton.dentro);
  }

  function quiereDisparar() {
    if (ctx.enVR()) return ctx.manos.some((m) => m.activa && m.gatillo);
    return ctx.raton.pulsado;
  }

  function disparar() {
    const l = libre(laseres);
    if (!l) return;
    nave.updateMatrixWorld(true);
    nave.localToWorld(l.pos.copy(puntasAla[alaDisparo]));
    alaDisparo = 1 - alaDisparo;
    l.prev.copy(l.pos);
    l.vel.subVectors(objetivo, l.pos).normalize().multiplyScalar(VEL_LASER);
    l.vida = 1.3;
    l.activo = true;
    ctx.sonido('laser');
  }

  // ¿Ha tocado el láser al blanco en este fotograma? (en el sistema del blanco, que también se mueve)
  function laserToca(l, pos, vel, radio, dt) {
    tmp.copy(l.prev).sub(pos).addScaledVector(vel, dt); // inicio relativo al blanco de antes
    tmp.add(pos);
    return distanciaSegmento(tmp, l.pos, pos) < radio;
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function reiniciar() {
    for (const lista of [asteroides, laseres, balas, anillos, cazas]) for (const o of lista) o.activo = false;
    for (const a of anillos) a.malla.visible = false;
    for (const c of cazas) c.grupo.visible = false;
    jefe.activo = false;
    jefe.grupo.visible = false;
    puntos = 0;
    escudo = 100;
    anillosPasados = 0;
    derribos = 0;
    tiempoMision = 0;
    patronesHechos = 0;
    proximoPatron = 1;
    invulnerable = 0;
    nave.visible = true;
    nave.position.set(0, Y_CENTRO, Z_NAVE);
    destinoRaton.copy(nave.position);
    estado = 'cuenta';
    reloj = 3;
  }

  function actualizarMarcador() {
    const barra = '▮'.repeat(Math.round(escudo / 10)) + '▯'.repeat(10 - Math.round(escudo / 10));
    const linea = { texto: `Escudo ${barra}   ·   Anillos ${anillosPasados}   ·   Derribos ${derribos}`, tam: 0.7, color: escudo <= 30 ? '#ff8a80' : '#b3e5fc' };
    if (estado === 'intro') {
      marcador.escribir([
        { texto: 'PILOTO ESTELAR', tam: 1.2, color: '#80d8ff' },
        { texto: ctx.enVR() ? 'Inclina los mandos para pilotar · gatillo: dispara a donde miras' : (ctx.tactil ? 'Arrastra el dedo: la nave lo sigue y dispara' : 'Mueve el ratón para pilotar · mantén el clic para disparar'), tam: 0.7 },
        { texto: `Anillos dorados: escudo y puntos · Récord: ${record}`, tam: 0.7, color: '#ffe082' },
      ]);
    } else if (estado === 'cuenta') {
      marcador.escribir([
        { texto: `${Math.ceil(reloj)}`, tam: 1.2, color: '#80d8ff' },
        { texto: ctx.enVR() ? 'Sujeta los mandos rectos y relajados: esa será la posición de reposo' : '¡Prepárate!', tam: 0.7 },
        { texto: ctx.enVR() ? 'El botón lateral vuelve a fijar el reposo cuando quieras' : `Récord: ${record}`, tam: 0.7, color: '#ffe082' },
      ]);
    } else if (estado === 'fin' || estado === 'final') {
      marcador.escribir([
        { texto: `${mensajeFinal} · ${puntos} puntos`, tam: 1.2, color: colorFinal },
        { texto: `Anillos ${anillosPasados} · Derribos ${derribos}${escudo > 0 && colorFinal === '#b9f6ca' ? ` · Escudo +${escudo * 5}` : ''}`, tam: 0.7 },
        { texto: estado === 'fin' ? `Récord: ${record} · nueva misión en ${Math.ceil(reloj)}` : ' ', tam: 0.7, color: '#ffe082' },
      ]);
    } else if (estado === 'jefe') {
      const vida = '▮'.repeat(Math.ceil((jefe.vida / VIDA_JEFE) * 10)).padEnd(10, '▯');
      marcador.escribir([
        { texto: `${puntos} puntos`, tam: 1.2 },
        { texto: `¡Nave nodriza! ${vida}   ·   se escapa en ${Math.max(0, Math.ceil(TIEMPO_JEFE - jefe.tiempo))} s`, tam: 0.7, color: '#ff8a80' },
        linea,
      ]);
    } else {
      marcador.escribir([
        { texto: `${puntos} puntos`, tam: 1.2 },
        { texto: `Récord: ${record}   ·   nave nodriza en ${Math.max(0, Math.ceil(DURACION_MISION - tiempoMision))} s`, tam: 0.7, color: '#ffe082' },
        linea,
      ]);
    }
  }

  function actualizar(dt, t) {
    reloj -= dt;
    invulnerable = Math.max(0, invulnerable - dt);
    enfriamiento -= dt;

    switch (estado) {
      case 'intro':
        if (reloj <= 0) reiniciar();
        break;
      case 'cuenta':
        if (reloj <= 0) {
          neutro = inclinacionMandos(); // posición de reposo de los mandos
          estado = 'mision';
        }
        break;
      case 'mision':
        tiempoMision += dt;
        proximoPatron -= dt;
        if (proximoPatron <= 0) lanzarPatron();
        if (tiempoMision >= DURACION_MISION) {
          estado = 'jefe';
          aparecerJefe();
        }
        break;
      case 'jefe':
        // Mientras dura, algún asteroide suelto
        proximoPatron -= dt;
        if (proximoPatron <= 0) {
          patronAsteroides(0.2);
          proximoPatron = 6;
        }
        break;
      case 'final':
        if (reloj <= 0) {
          estado = 'fin';
          reloj = 8;
          if (puntos > record) {
            record = puntos;
            ctx.guardar('record', record);
          }
          ctx.sonido('fin');
        }
        break;
      case 'fin':
        if (reloj <= 0) reiniciar();
        break;
    }

    pilotar(dt);
    apuntar();
    if ((estado === 'mision' || estado === 'jefe') && nave.visible && quiereDisparar() && enfriamiento <= 0) {
      disparar();
      enfriamiento = CADENCIA;
    }

    // Nave: llama del motor y parpadeo si acaba de recibir un golpe
    llama.scale.set(1, 1, 0.8 + Math.random() * 0.5);
    nave.children.forEach((h) => { h.visible = invulnerable <= 0 || Math.sin(t * 40) > 0; });
    propulsor.ajustar(0.4 + Math.min(1, velNave.length() / VEL_NAVE) * 0.6, estado === 'intro' || !nave.visible ? 0 : 0.07);

    // Estrellas
    const pe = geoEstrellas.attributes.position;
    for (let i = 0; i < N_ESTRELLAS; i++) {
      let z = pe.getZ(i) + VELOCIDAD * 0.5 * dt;
      if (z > -40) z -= 300; // dan la vuelta antes de pasar cerca de la cámara
      pe.setZ(i, z);
    }
    pe.needsUpdate = true;
    planeta.rotation.y += dt * 0.01;

    const naveViva = nave.visible && (estado === 'mision' || estado === 'jefe');

    // Láseres
    for (const l of laseres) {
      if (!l.activo) continue;
      l.prev.copy(l.pos);
      l.pos.addScaledVector(l.vel, dt);
      l.vida -= dt;
      if (l.vida <= 0) {
        l.activo = false;
        continue;
      }
      for (const c of cazas) {
        if (!c.activo || !laserToca(l, c.pos, c.vel, c.radio, dt)) continue;
        l.activo = false;
        c.vida--;
        if (c.vida <= 0) {
          c.activo = false;
          c.grupo.visible = false;
          sumar(PUNTOS.caza);
          derribos++;
          explosion(c.pos, 1.2);
        } else {
          explosion(c.pos, 0.4, 0xffffff);
        }
        break;
      }
      if (!l.activo) continue;
      for (const a of asteroides) {
        if (!a.activo || !laserToca(l, a.pos, a.vel, a.radio, dt)) continue;
        l.activo = false;
        a.vida--;
        if (a.vida <= 0) {
          a.activo = false;
          sumar(a.grande ? PUNTOS.asteroideGrande : PUNTOS.asteroide);
          explosion(a.pos, a.grande ? 1.6 : 0.9, 0xbcaaa4);
        } else {
          explosion(l.pos, 0.3, 0xffffff);
        }
        break;
      }
      if (!l.activo) continue;
      if (jefe.activo && !jefe.escapando && laserToca(l, jefe.pos, jefe.vel, jefe.radio, dt)) {
        l.activo = false;
        jefe.vida--;
        jefe.golpe = 0.15;
        explosion(l.pos, 0.35, 0xffffff);
        if (jefe.vida <= 0) {
          jefe.activo = false;
          sumar(PUNTOS.jefe);
          derribos++;
          for (let k = 0; k < 4; k++) explosion(tmp.copy(jefe.pos).add(new THREE.Vector3(azar(-3, 3), azar(-0.6, 0.6), azar(-1, 1))), 2.2, k % 2 ? 0xff6d00 : 0xffd740);
          jefe.grupo.visible = false;
          ctx.destello(0xffd740, 0.4);
          terminarMision('¡Misión cumplida!', '#b9f6ca', true);
        }
      }
    }

    // Asteroides
    for (const a of asteroides) {
      if (!a.activo) continue;
      tmp2.copy(a.pos);
      a.pos.addScaledVector(a.vel, dt);
      a.rot.x += a.giro.x * dt;
      a.rot.y += a.giro.y * dt;
      if (naveViva && tmp2.z < Z_NAVE + a.radio && a.pos.z > Z_NAVE - a.radio - 0.5) {
        if (distanciaSegmento(tmp3.copy(tmp2), a.pos, nave.position) < a.radio + RADIO_NAVE) {
          a.activo = false;
          explosion(a.pos, 1, 0xbcaaa4);
          danar(a.grande ? 30 : 20);
        }
      }
      if (a.pos.z > Z_NAVE + 1.4) a.activo = false;
    }

    // Anillos
    for (const a of anillos) {
      if (!a.activo) continue;
      a.prevZ = a.pos.z;
      a.pos.z += VELOCIDAD * dt;
      if (naveViva && !a.pasado && a.prevZ < Z_NAVE && a.pos.z >= Z_NAVE) {
        const d = Math.hypot(nave.position.x - a.pos.x, nave.position.y - a.pos.y);
        if (d < RADIO_ANILLO - 0.15) {
          a.pasado = true;
          anillosPasados++;
          sumar(PUNTOS.anillo);
          escudo = Math.min(100, escudo + 10);
          a.malla.material = matAnilloPasado;
          ctx.sonido('anillo');
          for (const m of ctx.manos) if (m.activa) ctx.vibrar(m, 0.3, 50);
        }
      }
      a.malla.position.copy(a.pos);
      if (a.pasado) a.malla.scale.setScalar(1 + (a.pos.z - Z_NAVE) * 0.4);
      else a.malla.scale.setScalar(1);
      a.malla.rotation.z += dt * 0.6;
      if (a.pos.z > Z_NAVE + 1.2) {
        a.activo = false;
        a.malla.visible = false;
      }
    }

    // Cazas
    const dif = Math.min(1, tiempoMision / DURACION_MISION);
    for (const c of cazas) {
      if (!c.activo) continue;
      c.fase += dt;
      tmp2.copy(c.pos);
      if (!c.saliendo) {
        c.pos.z += c.vel.z * dt;
        c.pos.x = c.base.x + 1.1 * Math.sin(c.fase * 1.3);
        c.pos.y = c.base.y + 0.5 * Math.sin(c.fase * 1.7);
        // Disparan mientras están delante
        c.proximoDisparo -= dt;
        if (naveViva && c.pos.z > -95 && c.pos.z < -22 && c.proximoDisparo <= 0) {
          dispararEnemigo(c.pos, 24 + dif * 10, azar(-0.4, 0.4));
          c.proximoDisparo = azar(1.6, 3) - dif * 0.8;
        }
        // Al acercarse, se apartan y pasan de largo
        if (c.pos.z > -20) {
          c.saliendo = true;
          c.vel.set(Math.sign(c.pos.x || 1) * 7, 2.5, 38);
        }
      } else {
        c.pos.addScaledVector(c.vel, dt);
      }
      // Velocidad real (para la ayuda a apuntar y los choques)
      if (dt > 0) c.vel.copy(tmp3.subVectors(c.pos, tmp2).divideScalar(dt));
      c.grupo.position.copy(c.pos);
      c.grupo.rotation.z = -Math.cos(c.fase * 1.3) * 0.5;
      if (naveViva && tmp2.z < Z_NAVE + 0.8 && c.pos.z > Z_NAVE - 1.5 && distanciaSegmento(tmp3.copy(tmp2), c.pos, nave.position) < c.radio + RADIO_NAVE) {
        c.activo = false;
        c.grupo.visible = false;
        explosion(c.pos, 1.2);
        danar(20);
      }
      if (c.pos.z > Z_NAVE + 2 || Math.abs(c.pos.x) > 25) {
        c.activo = false;
        c.grupo.visible = false;
      }
    }

    // Nave nodriza
    if (jefe.activo) {
      jefe.tiempo += dt;
      tmp2.copy(jefe.pos);
      if (jefe.escapando) {
        jefe.pos.z -= 45 * dt;
        jefe.pos.y += 4 * dt;
        if (jefe.pos.z < -220) {
          jefe.activo = false;
          jefe.grupo.visible = false;
        }
      } else {
        // Llega y se queda delante, moviéndose de lado a lado
        const zDestino = -55;
        jefe.pos.z += (zDestino - jefe.pos.z) * Math.min(1, dt * 0.8);
        jefe.pos.x = 2.6 * Math.sin(jefe.tiempo * 0.5);
        jefe.pos.y = Y_CENTRO + 1.2 + 0.8 * Math.sin(jefe.tiempo * 0.7);
        jefe.proximoDisparo -= dt;
        if (naveViva && jefe.pos.z > -90 && jefe.proximoDisparo <= 0) {
          for (const s of [-1, 0, 1]) dispararEnemigo(tmp.copy(jefe.pos).add(tmp3.set(s * 3, -0.1, 1.2)), 22, s * 0.9);
          jefe.proximoDisparo = 1.5;
        }
        if (jefe.tiempo > TIEMPO_JEFE && estado === 'jefe') {
          jefe.escapando = true;
          terminarMision('La nave nodriza se ha escapado', '#ffe082', false);
        }
      }
      if (dt > 0) jefe.vel.subVectors(jefe.pos, tmp2).divideScalar(dt);
      jefe.grupo.position.copy(jefe.pos);
      jefe.grupo.rotation.z = -Math.cos(jefe.tiempo * 0.5) * 0.12;
      jefe.golpe = Math.max(0, jefe.golpe - dt);
      jefe.nucleo.material.emissiveIntensity = 0.6 + 0.4 * Math.sin(t * 6) + (jefe.golpe > 0 ? 2 : 0);
    }

    // Disparos enemigos
    for (const b of balas) {
      if (!b.activo) continue;
      b.prev.copy(b.pos);
      b.pos.addScaledVector(b.vel, dt);
      b.vida -= dt;
      if (naveViva && distanciaSegmento(b.prev, b.pos, nave.position) < RADIO_NAVE + 0.1) {
        b.activo = false;
        explosion(b.pos, 0.4, 0xff6e40);
        danar(10);
        continue;
      }
      if (b.vida <= 0 || b.pos.z > Z_NAVE + 2) b.activo = false;
    }

    // Partículas y destellos
    for (const p of particulas) {
      if (!p.activo) continue;
      p.vida -= dt;
      p.pos.addScaledVector(p.vel, dt);
      if (p.vida <= 0 || p.pos.z > Z_NAVE + 1.5) p.activo = false;
    }
    for (const d of destellos) {
      if (d.vida <= 0) continue;
      d.vida -= dt;
      const f = 1 - Math.max(0, d.vida) / d.vidaInicial;
      d.malla.scale.setScalar(d.tam * (0.4 + f * 1.6));
      d.malla.material.opacity = 0.9 * (1 - f);
      d.malla.position.z += VELOCIDAD * 0.4 * dt;
      if (d.vida <= 0) d.malla.visible = false;
    }

    pintarInstancias();
    actualizarMarcador();
  }

  // Copia a las mallas instanciadas los objetos activos (los inactivos no se dibujan)
  const escalaTmp = new THREE.Vector3();
  function pintarInstancias() {
    let n = 0;
    for (const a of asteroides) {
      if (!a.activo) continue;
      // Al pasar la nave se encogen, para no atravesar la cara del jugador
      const f = THREE.MathUtils.clamp((Z_NAVE + 1.4 - a.pos.z) / 1.4, 0, 1);
      m4.compose(a.pos, q.setFromEuler(a.rot), escalaTmp.copy(a.escala).multiplyScalar(f));
      mallaAsteroides.setMatrixAt(n++, m4);
    }
    mallaAsteroides.count = n;
    mallaAsteroides.instanceMatrix.needsUpdate = true;

    n = 0;
    for (const l of laseres) {
      if (!l.activo) continue;
      q.setFromUnitVectors(eje, tmp.copy(l.vel).normalize());
      m4.compose(l.pos, q, escalaTmp.set(1, 1, 1));
      mallaLaseres.setMatrixAt(n++, m4);
    }
    mallaLaseres.count = n;
    mallaLaseres.instanceMatrix.needsUpdate = true;

    n = 0;
    q.identity();
    for (const b of balas) {
      if (!b.activo) continue;
      m4.compose(b.pos, q, escalaTmp.set(1, 1, 1));
      mallaBalas.setMatrixAt(n++, m4);
    }
    mallaBalas.count = n;
    mallaBalas.instanceMatrix.needsUpdate = true;

    n = 0;
    for (const p of particulas) {
      if (!p.activo) continue;
      const s = p.tam * (p.vida / p.vidaInicial);
      m4.compose(p.pos, q, escalaTmp.set(s, s, s));
      mallaParticulas.setMatrixAt(n, m4);
      mallaParticulas.setColorAt(n, p.color);
      n++;
    }
    mallaParticulas.count = n;
    mallaParticulas.instanceMatrix.needsUpdate = true;
    if (mallaParticulas.instanceColor) mallaParticulas.instanceColor.needsUpdate = true;
  }

  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      propulsor.parar();
      ctx.camara.far = camaraLejos;
      ctx.camara.updateProjectionMatrix();
      niebla.near = nieblaOriginal.near;
      niebla.far = nieblaOriginal.far;
    },
  };
}
