// APLASTA TOPOS
// Los topos asoman de los agujeros de una mesa. Se golpean con el martillo
// (VR) o haciendo clic encima (escritorio). Rondas de 60 segundos.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const DURACION = 60;
const ALTURA_MESA = 0.8;
const SUPERFICIE = ALTURA_MESA + 0.02;  // altura del césped
const Y_ARRIBA = SUPERFICIE;            // base del topo cuando asoma
const Y_ESCONDIDO = SUPERFICIE - 0.23;  // base del topo escondido dentro de la mesa
const ALTURA_CABEZA = 0.15;             // centro de la cabeza respecto a la base
const CABEZA_MARTILLO = -0.32;          // posición de la cabeza del martillo delante del puño
const VELOCIDAD_GOLPE = 0.7;            // m/s mínimos para que cuente el golpe

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  ctx.fondo(0x15241b);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.5, 0.45), new THREE.Vector3(0, 0.85, -0.7));

  // ─── Mesa y agujeros ───────────────────────────────────────────────────
  const mesa = new THREE.Mesh(R(new THREE.BoxGeometry(0.95, ALTURA_MESA, 0.75)), R(new THREE.MeshLambertMaterial({ color: 0x8d6e63 })));
  mesa.position.set(0, ALTURA_MESA / 2, -0.58);
  const cesped = new THREE.Mesh(R(new THREE.BoxGeometry(0.97, 0.02, 0.77)), R(new THREE.MeshLambertMaterial({ color: 0x66bb6a })));
  cesped.position.set(0, ALTURA_MESA + 0.01, -0.58);
  raiz.add(mesa, cesped);

  const geoAgujero = R(new THREE.CircleGeometry(0.075, 24));
  const matAgujero = R(new THREE.MeshBasicMaterial({ color: 0x1b120e }));

  // ─── Topos ─────────────────────────────────────────────────────────────
  const geoCuerpo = R(new THREE.CylinderGeometry(0.055, 0.06, 0.14, 14));
  const geoCabeza = R(new THREE.SphereGeometry(0.062, 16, 12));
  const geoOjo = R(new THREE.SphereGeometry(0.009, 6, 4));
  const geoNariz = R(new THREE.SphereGeometry(0.015, 8, 6));
  const matTopo = R(new THREE.MeshLambertMaterial({ color: 0x795548 }));
  const matDorado = R(new THREE.MeshLambertMaterial({ color: 0xffc400, emissive: 0x553300 }));
  const matOjo = R(new THREE.MeshBasicMaterial({ color: 0x111111 }));
  const matNariz = R(new THREE.MeshLambertMaterial({ color: 0xf48fb1 }));
  const geoEstrella = R(new THREE.OctahedronGeometry(0.018));
  const matEstrella = R(new THREE.MeshBasicMaterial({ color: 0xffeb3b }));

  const topos = [];
  for (const z of [-0.34, -0.58, -0.82]) {
    for (const x of [-0.27, 0, 0.27]) {
      const agujero = new THREE.Mesh(geoAgujero, matAgujero);
      agujero.rotation.x = -Math.PI / 2;
      agujero.position.set(x, SUPERFICIE + 0.001, z);
      raiz.add(agujero);

      const grupo = new THREE.Group();
      const cuerpo = new THREE.Mesh(geoCuerpo, matTopo);
      cuerpo.position.y = 0.07;
      const cabeza = new THREE.Mesh(geoCabeza, matTopo);
      cabeza.position.y = ALTURA_CABEZA;
      const nariz = new THREE.Mesh(geoNariz, matNariz);
      nariz.position.set(0, ALTURA_CABEZA, 0.06);
      grupo.add(cuerpo, cabeza, nariz);
      for (const lado of [-1, 1]) {
        const ojo = new THREE.Mesh(geoOjo, matOjo);
        ojo.position.set(lado * 0.024, ALTURA_CABEZA + 0.022, 0.052);
        grupo.add(ojo);
      }
      grupo.position.set(x, Y_ESCONDIDO, z);
      raiz.add(grupo);

      const topo = { grupo, cuerpo, cabeza, estado: 'abajo', t: 0, tiempoArriba: 0, dorado: false };
      cuerpo.userData.topo = topo;
      cabeza.userData.topo = topo;
      topos.push(topo);
    }
  }
  const mallasGolpeables = topos.flatMap((t) => [t.cuerpo, t.cabeza]);

  // ─── Martillos ─────────────────────────────────────────────────────────
  function crearMartillo() {
    const martillo = new THREE.Group();
    const mango = new THREE.Mesh(new THREE.CylinderGeometry(0.015, 0.018, 0.34, 10), new THREE.MeshLambertMaterial({ color: 0xbcaaa4 }));
    mango.rotation.x = Math.PI / 2;
    mango.position.z = (0.04 + CABEZA_MARTILLO) / 2;
    const cabeza = new THREE.Mesh(new THREE.CylinderGeometry(0.05, 0.05, 0.13, 16), new THREE.MeshLambertMaterial({ color: 0xe53935 }));
    cabeza.position.z = CABEZA_MARTILLO; // el eje del cilindro (Y) queda perpendicular al mango
    martillo.add(mango, cabeza);
    return martillo;
  }

  const martillos = ctx.manos.map((mano) => ({
    mano,
    objeto: ctx.adjuntarAMano(mano, crearMartillo()),
    cabeza: new THREE.Vector3(),
    cabezaAnterior: new THREE.Vector3(),
    listo: false,
  }));

  // Martillo que sigue al ratón en modo escritorio
  const pivote = new THREE.Group();
  pivote.add(crearMartillo());
  raiz.add(pivote);
  const planoGolpe = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(Y_ARRIBA + ALTURA_CABEZA));
  const puntoRaton = new THREE.Vector3(0, Y_ARRIBA + ALTURA_CABEZA, -0.58);
  let golpeRaton = 0; // tiempo restante de la animación del golpe

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.0, alto: 0.28 });
  marcador.mesh.position.set(0, 1.38, -1.1);
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  const particulas = [];
  let puntos = 0;
  let record = ctx.leer('record', 0);
  let estado = 'intro'; // 'intro' | 'jugando' | 'fin'
  let reloj = 2.5;
  let tiempoRestante = DURACION;
  let proximoTopo = 0;

  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();

  function actualizarMarcador() {
    if (estado === 'intro') {
      marcador.escribir([
        { texto: 'APLASTA TOPOS', tam: 1.3, color: '#c5e1a5' },
        { texto: '¡Golpea los topos antes de que se escondan!', tam: 0.75 },
      ]);
    } else if (estado === 'fin') {
      marcador.escribir([
        { texto: `¡Tiempo! ${puntos} puntos`, tam: 1.3, color: '#c5e1a5' },
        { texto: `Récord: ${record} · nueva ronda en ${Math.ceil(reloj)}`, tam: 0.75 },
      ]);
    } else {
      marcador.escribir([
        { texto: `Puntos: ${puntos}   ·   ${Math.ceil(tiempoRestante)} s`, tam: 1.3 },
        { texto: `Récord: ${record}   ·   los dorados valen 3`, tam: 0.75, color: '#fff59d' },
      ]);
    }
  }

  function sacarTopo(progreso) {
    const libres = topos.filter((t) => t.estado === 'abajo');
    if (libres.length === 0) return;
    const topo = libres[Math.floor(Math.random() * libres.length)];
    topo.estado = 'subiendo';
    topo.t = 0;
    topo.dorado = Math.random() < 0.12;
    const material = topo.dorado ? matDorado : matTopo;
    topo.cuerpo.material = material;
    topo.cabeza.material = material;
    topo.tiempoArriba = 1.3 - progreso * 0.55 + Math.random() * 0.25;
    topo.grupo.scale.set(1, 1, 1);
  }

  function golpear(topo, mano) {
    if (topo.estado !== 'subiendo' && topo.estado !== 'arriba') return;
    topo.estado = 'golpeado';
    topo.t = 0;
    puntos += topo.dorado ? 3 : 1;
    ctx.sonido('golpe');
    ctx.sonido('punto');
    if (mano) ctx.vibrar(mano, 0.9, 70);
    topo.cabeza.getWorldPosition(tmp);
    for (let i = 0; i < 7; i++) {
      const estrella = new THREE.Mesh(geoEstrella, matEstrella);
      estrella.position.copy(tmp);
      const angulo = (i / 7) * Math.PI * 2;
      const vel = new THREE.Vector3(Math.cos(angulo) * 0.6, 1.2 + Math.random() * 0.5, Math.sin(angulo) * 0.6);
      raiz.add(estrella);
      particulas.push({ malla: estrella, vel, vida: 0.6 });
    }
  }

  function actualizarTopo(topo, dt) {
    topo.t += dt;
    const g = topo.grupo;
    switch (topo.estado) {
      case 'subiendo': {
        const f = Math.min(1, topo.t / 0.15);
        g.position.y = Y_ESCONDIDO + (Y_ARRIBA - Y_ESCONDIDO) * (1 - (1 - f) * (1 - f));
        if (f >= 1) { topo.estado = 'arriba'; topo.t = 0; }
        break;
      }
      case 'arriba':
        g.position.y = Y_ARRIBA;
        if (topo.t >= topo.tiempoArriba || estado !== 'jugando') { topo.estado = 'bajando'; topo.t = 0; }
        break;
      case 'golpeado':
        g.scale.y = Math.max(0.45, 1 - topo.t * 6);
        if (topo.t >= 0.3) { topo.estado = 'bajando'; topo.t = 0; }
        break;
      case 'bajando': {
        const f = Math.min(1, topo.t / 0.15);
        g.position.y = Y_ARRIBA + (Y_ESCONDIDO - Y_ARRIBA) * f;
        if (f >= 1) { topo.estado = 'abajo'; g.scale.set(1, 1, 1); }
        break;
      }
      default:
        g.position.y = Y_ESCONDIDO;
    }
  }

  // ─── Golpes con los mandos VR ──────────────────────────────────────────
  function golpesVR(dt) {
    for (const m of martillos) {
      if (!m.mano.activa) {
        m.listo = false;
        continue;
      }
      m.mano.grip.localToWorld(m.cabeza.set(0, 0, CABEZA_MARTILLO));
      if (m.listo && m.cabeza.distanceTo(m.cabezaAnterior) / dt > VELOCIDAD_GOLPE) {
        for (const topo of topos) {
          if (topo.estado !== 'subiendo' && topo.estado !== 'arriba') continue;
          topo.cabeza.getWorldPosition(tmp);
          const medio = tmp2.copy(m.cabeza).lerp(m.cabezaAnterior, 0.5);
          if (m.cabeza.distanceTo(tmp) < 0.12 || medio.distanceTo(tmp) < 0.12) golpear(topo, m.mano);
        }
      }
      m.cabezaAnterior.copy(m.cabeza);
      m.listo = true;
    }
  }

  // ─── Golpes con el ratón ───────────────────────────────────────────────
  function golpesRaton(dt) {
    const raton = ctx.raton;
    pivote.visible = raton.dentro;
    if (raton.rayo.ray.intersectPlane(planoGolpe, tmp)) puntoRaton.copy(tmp);

    if (raton.clic) {
      golpeRaton = 0.16;
      const visibles = mallasGolpeables.filter((m) => ['subiendo', 'arriba'].includes(m.userData.topo.estado));
      const choque = raton.rayo.intersectObjects(visibles, false)[0];
      if (choque) golpear(choque.object.userData.topo, null);
    }
    golpeRaton = Math.max(0, golpeRaton - dt);

    // Animación: la cabeza del martillo baja hasta el punto y vuelve a subir
    const bajada = golpeRaton > 0.1 ? (0.16 - golpeRaton) / 0.06 : golpeRaton / 0.1;
    const objetivo = tmp2.copy(puntoRaton);
    objetivo.y += 0.13 * (1 - bajada);
    pivote.position.set(puntoRaton.x, puntoRaton.y + 0.2, puntoRaton.z + 0.26);
    // Queremos que el -Z del martillo apunte al objetivo: miramos al punto opuesto
    pivote.lookAt(tmp.copy(pivote.position).multiplyScalar(2).sub(objetivo));
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function actualizar(dt) {
    reloj -= dt;
    if (estado === 'intro' && reloj <= 0) {
      estado = 'jugando';
      tiempoRestante = DURACION;
      proximoTopo = 0.3;
    } else if (estado === 'jugando') {
      tiempoRestante -= dt;
      const progreso = 1 - tiempoRestante / DURACION;
      proximoTopo -= dt;
      const maxArriba = 1 + Math.floor(progreso * 2.5);
      const arriba = topos.filter((t) => t.estado !== 'abajo').length;
      if (proximoTopo <= 0 && arriba < maxArriba) {
        sacarTopo(progreso);
        proximoTopo = 0.95 - progreso * 0.5 + Math.random() * 0.2;
      }
      if (tiempoRestante <= 0) {
        estado = 'fin';
        reloj = 5;
        if (puntos > record) {
          record = puntos;
          ctx.guardar('record', record);
        }
        ctx.sonido('fin');
      }
    } else if (estado === 'fin' && reloj <= 0) {
      estado = 'jugando';
      puntos = 0;
      tiempoRestante = DURACION;
      proximoTopo = 0.5;
    }

    for (const topo of topos) actualizarTopo(topo, dt);

    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      p.vida -= dt;
      p.vel.y -= 4 * dt;
      p.malla.position.addScaledVector(p.vel, dt);
      p.malla.rotation.y += 8 * dt;
      p.malla.scale.setScalar(Math.max(0.01, p.vida / 0.6));
      if (p.vida <= 0) {
        raiz.remove(p.malla);
        particulas.splice(i, 1);
      }
    }

    if (ctx.enVR()) {
      pivote.visible = false;
      golpesVR(dt);
    } else {
      golpesRaton(dt);
    }

    actualizarMarcador();
  }

  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      particulas.length = 0;
    },
  };
}
