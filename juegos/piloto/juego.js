// PILOTO ESTELAR
// Shooter sobre raíles en el espacio, al estilo de los clásicos, en primera persona: vas en
// la cabina y el espacio viene hacia ti. Pasa por los anillos dorados (recargan el escudo),
// esquiva los asteroides y los disparos, derriba los cazas y, al final, la nave nodriza.
// En VR se pilota con una palanca virtual: aprieta el botón lateral para agarrarla donde
// tengas la mano y mueve la mano (a la derecha, la nave va a la derecha; arriba, sube). Al
// soltarla vuelve al centro. También vale el joystick de cualquier mando. El gatillo dispara
// a donde miras.
// Con ratón o con el dedo, la nave va hacia donde apuntas y dispara hacia ahí.
//
// Coordenadas: la lógica del juego va en el "espacio" (la nave en posNave, con z = 0). Todo lo
// del espacio cuelga de un grupo que se desplaza para que la nave quede siempre en la cabina,
// alrededor del jugador: así la cabina no se mueve nunca y la vista no gira ni se ladea.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const VELOCIDAD = 28;            // m/s a los que el espacio viene hacia la nave
const Z_NAVE = 0;                // la nave (y el jugador) están en z = 0 del espacio
const CAJA = { x: 2.4, yMin: -1.2, yMax: 1.2 }; // por donde se puede mover la nave
const Y_CENTRO = 0;
const Z_APARICION = -150;
const VEL_NAVE = 2.6;            // m/s máximos de la nave
// Palanca virtual: se mueve con la posición de la mano (no con su ángulo), desde donde se agarró
const RECORRIDO_PALANCA = 0.12;  // metros de mano para ir a tope
const ZONA_MUERTA_PALANCA = 0.012;
const ZONA_MUERTA_JOYSTICK = 0.15;
const RESPUESTA = 9;             // lo rápido que la nave alcanza la velocidad pedida
const ALTURA_OJOS = 0.32;        // los ojos quedan esta altura por encima del centro de la cabina
const RADIO_NAVE = 0.6;
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
  // Sin gafas, la cámara va en la cabina (centro de la cabina a 1,2 m, ver centroCabina)
  // (un poco detrás de los ojos: sin gafas el campo de visión es más estrecho)
  if (ctx.tactil) ctx.vistaEscritorio(new THREE.Vector3(0, 1.2 + 0.55, 0.75), new THREE.Vector3(0, 1.35, -30));
  else ctx.vistaEscritorio(new THREE.Vector3(0, 1.2 + 0.45, 0.45), new THREE.Vector3(0, 1.38, -30));
  // El espacio es profundo: la cámara ve más lejos y la niebla está lejos mientras dura el juego
  const camaraLejos = ctx.camara.far;
  ctx.camara.far = 600;
  ctx.camara.updateProjectionMatrix();
  const niebla = ctx.escena.fog;
  const nieblaOriginal = { near: niebla.near, far: niebla.far };
  niebla.near = 70;
  niebla.far = 150;

  // Todo lo del espacio va en este grupo (ver el comentario de arriba)
  const mundo = new THREE.Group();
  raiz.add(mundo);

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
  mundo.add(estrellas);

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
  mundo.add(planeta);

  // ─── Cabina (primera persona) ─────────────────────────────────────────
  // Su origen es el centro de la cabina; los ojos del jugador quedan ALTURA_OJOS por encima.
  // Construida mirando a -Z (hacia donde vuela).
  const posNave = new THREE.Vector3(0, Y_CENTRO, Z_NAVE); // la nave en el espacio
  let viva = true;
  const cabina = new THREE.Group();
  const centroCabina = new THREE.Vector3(0, 1.2, 0);       // dónde está la cabina en la sala
  const matBlanco = R(new THREE.MeshStandardMaterial({ color: 0xe8ecf2, metalness: 0.5, roughness: 0.35 }));
  const matAzul = R(new THREE.MeshStandardMaterial({ color: 0x1e88e5, metalness: 0.4, roughness: 0.3 }));
  const matPanel = R(new THREE.MeshStandardMaterial({ color: 0x263238, metalness: 0.6, roughness: 0.5 }));
  const matGris = R(new THREE.MeshStandardMaterial({ color: 0x78909c, metalness: 0.8, roughness: 0.3 }));
  const salpicadero = new THREE.Mesh(R(new THREE.BoxGeometry(1.0, 0.12, 0.32)), matPanel);
  salpicadero.position.set(0, -0.02, -0.52);
  salpicadero.rotation.x = 0.45;
  const marco = new THREE.Mesh(R(new THREE.TorusGeometry(0.55, 0.016, 6, 32, Math.PI)), matPanel);
  marco.position.set(0, 0.05, -0.62);
  const morro = new THREE.Mesh(R(new THREE.ConeGeometry(0.3, 1.6, 8).rotateX(-Math.PI / 2)), matBlanco);
  morro.position.set(0, -0.22, -1.35);
  morro.scale.y = 0.6;
  cabina.add(salpicadero, marco, morro);
  const geoLateral = R(new THREE.BoxGeometry(0.06, 0.2, 1.1));
  const geoAla = R(new THREE.BoxGeometry(1.5, 0.035, 0.55));
  const geoAleta = R(new THREE.BoxGeometry(0.04, 0.45, 0.4));
  const geoCanon = R(new THREE.CylinderGeometry(0.03, 0.03, 0.6, 8).rotateX(Math.PI / 2));
  const canones = [];
  for (const s of [-1, 1]) {
    const lateral = new THREE.Mesh(geoLateral, matPanel);
    lateral.position.set(s * 0.5, -0.12, -0.25);
    const ala = new THREE.Mesh(geoAla, matBlanco);
    ala.position.set(s * 1.15, -0.32, 0.05);
    ala.rotation.z = -s * 0.12;
    const aleta = new THREE.Mesh(geoAleta, matAzul);
    aleta.position.set(s * 1.9, -0.2, 0.08);
    aleta.rotation.z = s * 0.2;
    const canon = new THREE.Mesh(geoCanon, matGris);
    canon.position.set(s * 1.85, -0.42, -0.35);
    cabina.add(lateral, ala, aleta, canon);
    canones.push(new THREE.Vector3(s * 1.85, -0.42, -0.68)); // boca del cañón, respecto a la nave
  }
  raiz.add(cabina);

  // Palanca: cuando la agarras aparece bajo tu mano; si no, en su sitio, a la derecha del salpicadero
  const palanca = new THREE.Group();
  const matPomo = R(new THREE.MeshStandardMaterial({ color: 0xd32f2f, roughness: 0.5 }));
  const basePalanca = new THREE.Mesh(R(new THREE.CylinderGeometry(0.05, 0.06, 0.025, 16)), matPanel);
  const varaPalanca = new THREE.Mesh(R(new THREE.CylinderGeometry(0.012, 0.014, 1, 8).translate(0, 0.5, 0)), matGris);
  const pomoPalanca = new THREE.Mesh(R(new THREE.SphereGeometry(0.032, 14, 10)), matPomo);
  palanca.add(basePalanca, varaPalanca, pomoPalanca);
  raiz.add(palanca);
  const SITIO_PALANCA = new THREE.Vector3(0.3, -0.12, -0.32); // base de la palanca en la cabina
  const ALTO_PALANCA = 0.15;

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
  mundo.add(mallaAsteroides);
  const asteroides = Array.from({ length: MAX_ASTEROIDES }, () => ({
    activo: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), rot: new THREE.Euler(), giro: new THREE.Vector3(), escala: new THREE.Vector3(), radio: 1, vida: 1, grande: false,
  }));

  // ─── Láseres, disparos enemigos y partículas (instanciados) ───────────
  const MAX_LASERES = 40;
  const mallaLaseres = new THREE.InstancedMesh(R(new THREE.BoxGeometry(0.035, 0.035, 1.4)), R(new THREE.MeshBasicMaterial({ color: 0x69f0ae, fog: false })), MAX_LASERES);
  mallaLaseres.frustumCulled = false;
  mallaLaseres.count = 0;
  mundo.add(mallaLaseres);
  const laseres = Array.from({ length: MAX_LASERES }, () => ({ activo: false, pos: new THREE.Vector3(), prev: new THREE.Vector3(), vel: new THREE.Vector3(), vida: 0 }));

  const MAX_BALAS = 40;
  const mallaBalas = new THREE.InstancedMesh(R(new THREE.SphereGeometry(0.13, 10, 8)), R(new THREE.MeshBasicMaterial({ color: 0xff6e40, fog: false })), MAX_BALAS);
  mallaBalas.frustumCulled = false;
  mallaBalas.count = 0;
  mundo.add(mallaBalas);
  const balas = Array.from({ length: MAX_BALAS }, () => ({ activo: false, pos: new THREE.Vector3(), prev: new THREE.Vector3(), vel: new THREE.Vector3(), vida: 0 }));

  const MAX_PARTICULAS = 180;
  const mallaParticulas = new THREE.InstancedMesh(R(new THREE.BoxGeometry(1, 1, 1)), R(new THREE.MeshBasicMaterial({ color: 0xffffff, fog: false })), MAX_PARTICULAS);
  mallaParticulas.frustumCulled = false;
  mundo.add(mallaParticulas);
  const particulas = Array.from({ length: MAX_PARTICULAS }, () => ({ activo: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), vida: 0, vidaInicial: 1, tam: 0.1, color: new THREE.Color() }));
  for (let i = 0; i < MAX_PARTICULAS; i++) mallaParticulas.setColorAt(i, new THREE.Color(1, 1, 1));
  mallaParticulas.count = 0;

  const geoDestello = R(new THREE.SphereGeometry(1, 16, 12));
  const destellos = Array.from({ length: 8 }, () => {
    const malla = new THREE.Mesh(geoDestello, R(new THREE.MeshBasicMaterial({ color: 0xffd180, transparent: true, opacity: 0, blending: THREE.AdditiveBlending, depthWrite: false, fog: false })));
    malla.visible = false;
    mundo.add(malla);
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
    mundo.add(malla);
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
    mundo.add(grupo);
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
    mundo.add(jefe.grupo);
  }

  // ─── Marcador ──────────────────────────────────────────────────────────
  // Pantalla del salpicadero (durante el vuelo) y cartel grande delante (al empezar y al acabar)
  const marcador = ctx.crearPanel({ ancho: 0.46, alto: 0.13, borde: 'rgba(0, 229, 255, 0.8)' });
  // A la izquierda del salpicadero, inclinada y girada hacia el jugador
  marcador.mesh.position.set(-0.3, 0.04, -0.46);
  // Que mire a los ojos (sin ladearse): eje Z del panel hacia los ojos, con el "arriba" vertical
  marcador.mesh.quaternion.setFromRotationMatrix(new THREE.Matrix4().lookAt(new THREE.Vector3(0, ALTURA_OJOS, 0), marcador.mesh.position, new THREE.Vector3(0, 1, 0)));
  cabina.add(marcador.mesh);
  const cartel = ctx.crearPanel({ ancho: 2.4, alto: 0.62 });
  cartel.mesh.position.set(0, 0.85, -3.6);
  cabina.add(cartel.mesh);

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
  const apretonAntes = [false, false];
  let manoPalanca = null;     // la mano que tiene agarrada la palanca
  const anclaPalanca = new THREE.Vector3(); // dónde estaba la mano al agarrarla
  const mando = new THREE.Vector2();        // lo que pide el jugador: x e y entre -1 y 1
  const velNave = new THREE.Vector2();
  const propulsor = ctx.sonidoContinuo('propulsor');

  const cabeza = new THREE.Vector3();
  const cabezaSala = new THREE.Vector3();
  const mirada = new THREE.Vector3();
  const objetivo = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const tmp3 = new THREE.Vector3();
  const q = new THREE.Quaternion();
  const m4 = new THREE.Matrix4();
  const eje = new THREE.Vector3(0, 0, -1);
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
    tmp.copy(posNave);
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
      explosion(tmp.copy(posNave).add(tmp3.set(0, 0, -1.5)), 2.2, 0xff6d00);
      ctx.destello(0xff6d00, 0.6);
      viva = false;
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
  // Palanca virtual (agarrar con el botón lateral y mover la mano) y joysticks. Se suman.
  const desvio = new THREE.Vector3();
  function leerMandos() {
    mando.set(0, 0);
    ctx.manos.forEach((m, i) => {
      const agarra = m.activa && m.apreton;
      if (agarra && !apretonAntes[i]) {
        manoPalanca = m;
        anclaPalanca.copy(m.posicion);
        ctx.vibrar(m, 0.35, 40);
      }
      if (!agarra && manoPalanca === m) manoPalanca = null;
      apretonAntes[i] = agarra;
    });
    if (manoPalanca) {
      // La cabina no gira, así que los ejes de la sala son los de la nave
      desvio.subVectors(manoPalanca.posicion, anclaPalanca);
      const largo = Math.hypot(desvio.x, desvio.y);
      if (largo > ZONA_MUERTA_PALANCA) {
        const fuerza = Math.min(1, (largo - ZONA_MUERTA_PALANCA) / (RECORRIDO_PALANCA - ZONA_MUERTA_PALANCA)) ** 1.2;
        mando.set(desvio.x / largo, desvio.y / largo).multiplyScalar(fuerza);
      }
    }
    // Joysticks (en los mandos del Quest son los ejes 2 y 3)
    for (const m of ctx.manos) {
      const ejes = m.activa ? m.fuente?.gamepad?.axes : null;
      if (!ejes || ejes.length < 4) continue;
      const x = ejes[2];
      const y = -ejes[3];
      const largo = Math.hypot(x, y);
      if (largo > ZONA_MUERTA_JOYSTICK) {
        const fuerza = Math.min(1, (largo - ZONA_MUERTA_JOYSTICK) / (1 - ZONA_MUERTA_JOYSTICK));
        mando.x += (x / largo) * fuerza;
        mando.y += (y / largo) * fuerza;
      }
    }
    if (mando.length() > 1) mando.normalize();
  }

  // Coloca la cabina alrededor de la cabeza del jugador (de pie o sentado)
  function colocarCabina() {
    ctx.camara.getWorldPosition(tmp);
    centroCabina.set(tmp.x, tmp.y - ALTURA_OJOS, tmp.z);
  }

  const velPedida = new THREE.Vector2();
  function pilotar(dt) {
    const pilotando = viva && (estado === 'mision' || estado === 'jefe');
    if (ctx.enVR()) {
      if (estado === 'intro' || estado === 'cuenta') colocarCabina();
      leerMandos();
    } else {
      // Sin gafas: la nave va hacia donde apunta el puntero (respecto al centro de la pantalla)
      const raton = ctx.raton;
      const eje = (n) => {
        const a = Math.abs(n);
        return a < 0.08 ? 0 : Math.sign(n) * Math.min(1, (a - 0.08) / 0.5);
      };
      if (raton.dentro && (!ctx.tactil || raton.pulsado)) mando.set(eje(raton.ndc.x), eje(raton.ndc.y));
      else mando.set(0, 0);
    }
    // La nave acelera y frena con suavidad hacia la velocidad pedida
    velPedida.copy(mando).multiplyScalar(pilotando ? VEL_NAVE : 0);
    velNave.lerp(velPedida, 1 - Math.exp(-RESPUESTA * dt));
    posNave.x = THREE.MathUtils.clamp(posNave.x + velNave.x * dt, -CAJA.x, CAJA.x);
    posNave.y = THREE.MathUtils.clamp(posNave.y + velNave.y * dt, CAJA.yMin, CAJA.yMax);
    // La cabina se queda quieta en la sala; lo que se mueve es el espacio
    cabina.position.copy(centroCabina);
    mundo.position.subVectors(centroCabina, posNave);
    colocarPalanca();
  }

  // La palanca se ve bajo la mano que la agarra, inclinada hacia ella; si no, en su sitio,
  // inclinada según lo que pidan el joystick o el ratón
  const puntaPalanca = new THREE.Vector3();
  const ARRIBA = new THREE.Vector3(0, 1, 0);
  function colocarPalanca() {
    if (manoPalanca) {
      palanca.position.copy(anclaPalanca).y -= ALTO_PALANCA;
      puntaPalanca.copy(manoPalanca.posicion);
    } else {
      palanca.position.copy(centroCabina).add(SITIO_PALANCA);
      puntaPalanca.copy(palanca.position).add(tmp.set(mando.x * 0.06, ALTO_PALANCA, -mando.y * 0.06));
    }
    // Vara de la base a la punta (en coordenadas de la palanca)
    tmp.subVectors(puntaPalanca, palanca.position);
    const largo = Math.max(0.05, tmp.length());
    varaPalanca.scale.set(1, largo, 1);
    varaPalanca.quaternion.setFromUnitVectors(ARRIBA, tmp.normalize());
    pomoPalanca.position.copy(tmp).multiplyScalar(largo);
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
    cabezaSala.copy(cabeza);
    cabeza.sub(mundo.position); // de la sala al espacio
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
      const t = bloqueado.pos.distanceTo(posNave) / VEL_LASER;
      objetivo.copy(bloqueado.pos).addScaledVector(bloqueado.vel, t);
      reticula.position.copy(bloqueado.pos).add(mundo.position);
      reticula.scale.setScalar(Math.max(1, cabezaSala.distanceTo(reticula.position) / 15));
      matReticula.color.setHex(0xff5252);
    } else {
      objetivo.copy(cabeza).addScaledVector(mirada, 90);
      reticula.position.copy(cabezaSala).addScaledVector(mirada, 15);
      reticula.scale.setScalar(1);
      matReticula.color.setHex(0x76ff03);
    }
    reticula.lookAt(cabezaSala);
    reticula.visible = (estado === 'mision' || estado === 'jefe' || estado === 'cuenta') && viva && (ctx.enVR() || ctx.raton.dentro);
  }

  function quiereDisparar() {
    if (ctx.enVR()) return ctx.manos.some((m) => m.activa && m.gatillo);
    return ctx.raton.pulsado;
  }

  function disparar() {
    const l = libre(laseres);
    if (!l) return;
    l.pos.copy(posNave).add(canones[alaDisparo]);
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
    viva = true;
    posNave.set(0, Y_CENTRO, Z_NAVE);
    estado = 'cuenta';
    reloj = 3;
  }

  function actualizarMarcador() {
    // Pantalla del salpicadero: siempre los datos del vuelo
    const barra = '▮'.repeat(Math.round(escudo / 10)) + '▯'.repeat(10 - Math.round(escudo / 10));
    const segunda = estado === 'jefe'
      ? { texto: `Nodriza ${'▮'.repeat(Math.ceil((jefe.vida / VIDA_JEFE) * 10)).padEnd(10, '▯')} · ${Math.max(0, Math.ceil(TIEMPO_JEFE - jefe.tiempo))} s`, tam: 0.8, color: '#ff8a80' }
      : { texto: `Nodriza en ${Math.max(0, Math.ceil(DURACION_MISION - tiempoMision))} s · Récord ${record}`, tam: 0.8, color: '#ffe082' };
    marcador.escribir([
      { texto: `${puntos} puntos`, tam: 1.2 },
      { texto: `Escudo ${barra}`, tam: 0.8, color: escudo <= 30 ? '#ff8a80' : '#80deea' },
      segunda,
    ]);

    // Cartel grande delante: instrucciones y resultado
    cartel.mesh.visible = estado === 'intro' || estado === 'cuenta' || estado === 'final' || estado === 'fin';
    if (estado === 'intro') {
      cartel.escribir([
        { texto: 'PILOTO ESTELAR', tam: 1.2, color: '#80d8ff' },
        { texto: ctx.enVR() ? 'Botón lateral: agarras la palanca · mueve la mano hacia donde quieras ir · suelta y se centra' : (ctx.tactil ? 'Mantén el dedo hacia donde quieras ir: la nave va y dispara' : 'Apunta con el ratón hacia donde quieras ir · mantén el clic para disparar'), tam: 0.7 },
        { texto: ctx.enVR() ? 'También vale el joystick · gatillo: disparas a donde miras' : `Anillos dorados: escudo y puntos · Récord: ${record}`, tam: 0.7, color: '#ffe082' },
      ]);
    } else if (estado === 'cuenta') {
      cartel.escribir([
        { texto: `${Math.ceil(reloj)}`, tam: 1.2, color: '#80d8ff' },
        { texto: ctx.enVR() ? 'Agarra la palanca con el botón lateral y mueve la mano' : '¡Prepárate!', tam: 0.7 },
        { texto: ctx.enVR() ? 'Anillos dorados: escudo y puntos' : `Récord: ${record}`, tam: 0.7, color: '#ffe082' },
      ]);
    } else if (estado === 'fin' || estado === 'final') {
      cartel.escribir([
        { texto: `${mensajeFinal} · ${puntos} puntos`, tam: 1.2, color: colorFinal },
        { texto: `Anillos ${anillosPasados} · Derribos ${derribos}${escudo > 0 && colorFinal === '#b9f6ca' ? ` · Escudo +${escudo * 5}` : ''}`, tam: 0.7 },
        { texto: estado === 'fin' ? `Récord: ${record} · nueva misión en ${Math.ceil(reloj)}` : ' ', tam: 0.7, color: '#ffe082' },
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
    if ((estado === 'mision' || estado === 'jefe') && viva && quiereDisparar() && enfriamiento <= 0) {
      disparar();
      enfriamiento = CADENCIA;
    }

    propulsor.ajustar(0.4 + Math.min(1, velNave.length() / VEL_NAVE) * 0.6, estado === 'intro' || !viva ? 0 : 0.07);

    // Estrellas
    const pe = geoEstrellas.attributes.position;
    for (let i = 0; i < N_ESTRELLAS; i++) {
      let z = pe.getZ(i) + VELOCIDAD * 0.5 * dt;
      if (z > -40) z -= 300; // dan la vuelta antes de pasar cerca de la cámara
      pe.setZ(i, z);
    }
    pe.needsUpdate = true;
    planeta.rotation.y += dt * 0.01;

    const naveViva = viva && (estado === 'mision' || estado === 'jefe');

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
        if (distanciaSegmento(tmp3.copy(tmp2), a.pos, posNave) < a.radio + RADIO_NAVE) {
          a.activo = false;
          explosion(a.pos, 1, 0xbcaaa4);
          danar(a.grande ? 30 : 20);
        }
      }
      if (a.pos.z > Z_NAVE + 6) a.activo = false;
    }

    // Anillos
    for (const a of anillos) {
      if (!a.activo) continue;
      a.prevZ = a.pos.z;
      a.pos.z += VELOCIDAD * dt;
      if (naveViva && !a.pasado && a.prevZ < Z_NAVE && a.pos.z >= Z_NAVE) {
        const d = Math.hypot(posNave.x - a.pos.x, posNave.y - a.pos.y);
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
      if (naveViva && tmp2.z < Z_NAVE + 0.8 && c.pos.z > Z_NAVE - 1.5 && distanciaSegmento(tmp3.copy(tmp2), c.pos, posNave) < c.radio + RADIO_NAVE) {
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
      if (naveViva && distanciaSegmento(b.prev, b.pos, posNave) < RADIO_NAVE + 0.1) {
        b.activo = false;
        explosion(b.pos, 0.4, 0xff6e40);
        danar(10);
        continue;
      }
      if (b.vida <= 0 || b.pos.z > Z_NAVE + 3) b.activo = false;
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
      // Los que pasan cerca de la cabina se encogen al llegar, para no atravesar al jugador
      const lateral = Math.hypot(a.pos.x - posNave.x, a.pos.y - posNave.y);
      const f = lateral < a.radio + 1.2 ? THREE.MathUtils.clamp((Z_NAVE - a.pos.z) / 1.8, 0, 1) : 1;
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
