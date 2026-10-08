// GALERÍA DE TIRO
// Muñecos de cartón se levantan por el campo. Dispara a los rojos (los de la
// diana) y no a los azules. Pistola en cada mano (VR) o clic con el ratón.
// Rondas de 60 segundos.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const DURACION = 60;
const ALCANCE = 25;
const CADENCIA = 0.18;        // segundos mínimos entre disparos de una misma pistola
const CANON = -0.2;           // punta del cañón delante del puño
const PUNTOS_CUERPO = 1;
const PUNTOS_CABEZA = 3;
const CASTIGO_INOCENTE = 3;
// Huecos donde se levantan los muñecos: [x, z]
const HUECOS = [
  [0.3, -4], [-2.2, -4.6], [2.4, -5], [0, -6.2], [-3.6, -7],
  [3.3, -7.4], [-1.3, -8.4], [1.6, -9], [-5, -9.6], [5.2, -9.2],
];

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  ctx.fondo(0x1b2230);
  const vistaPos = new THREE.Vector3(0, 1.6, 0.4);
  ctx.vistaEscritorio(vistaPos, new THREE.Vector3(0, 1.3, -6));

  // ─── Muñecos ───────────────────────────────────────────────────────────
  // Cada muñeco es un recorte de cartón con bisagra en la base: tumbado hacia
  // atrás (escondido) o de pie (activo).
  const geoBase = R(new THREE.BoxGeometry(0.7, 0.08, 0.3));
  const geoPoste = R(new THREE.BoxGeometry(0.08, 0.35, 0.04));
  const geoCuerpo = R(new THREE.BoxGeometry(0.55, 0.85, 0.04));
  const geoCabeza = R(new THREE.CylinderGeometry(0.17, 0.17, 0.04, 24));
  geoCabeza.rotateX(Math.PI / 2);
  const geoAro = R(new THREE.CircleGeometry(0.17, 24));
  const geoAroMedio = R(new THREE.CircleGeometry(0.11, 24));
  const geoCentro = R(new THREE.CircleGeometry(0.05, 16));
  const geoOjo = R(new THREE.CircleGeometry(0.025, 10));
  const geoAntifaz = R(new THREE.PlaneGeometry(0.3, 0.07));
  const geoSonrisa = R(new THREE.RingGeometry(0.06, 0.08, 16, 1, Math.PI * 1.15, Math.PI * 0.7));
  const geoChispa = R(new THREE.TetrahedronGeometry(0.03));

  const matBase = R(new THREE.MeshLambertMaterial({ color: 0x3e4658 }));
  const matPoste = R(new THREE.MeshLambertMaterial({ color: 0x8d6e63 }));
  const matMalo = R(new THREE.MeshLambertMaterial({ color: 0xd84315 }));
  const matBueno = R(new THREE.MeshLambertMaterial({ color: 0x42a5f5 }));
  const matPiel = R(new THREE.MeshLambertMaterial({ color: 0xffcc80 }));
  const matBlanco = R(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const matRojo = R(new THREE.MeshBasicMaterial({ color: 0xc62828 }));
  const matNegro = R(new THREE.MeshBasicMaterial({ color: 0x111111 }));
  const matChispa = R(new THREE.MeshBasicMaterial({ color: 0xffe082 }));

  function anadir(padre, geo, mat, x, y, z) {
    const m = new THREE.Mesh(geo, mat);
    m.position.set(x, y, z);
    padre.add(m);
    return m;
  }

  const munecos = HUECOS.map(([x, z]) => {
    const exterior = new THREE.Group();
    exterior.position.set(x, 0, z);
    exterior.lookAt(0, 0, 0); // +Z mira al jugador
    raiz.add(exterior);
    anadir(exterior, geoBase, matBase, 0, 0.04, 0);

    const carril = new THREE.Group(); // se desplaza a los lados en los muñecos que se mueven
    exterior.add(carril);
    const bisagra = new THREE.Group();
    bisagra.position.y = 0.08;
    carril.add(bisagra);

    anadir(bisagra, geoPoste, matPoste, 0, 0.175, 0);
    const cuerpo = anadir(bisagra, geoCuerpo, matMalo, 0, 0.775, 0);
    const cabeza = anadir(bisagra, geoCabeza, matPiel, 0, 1.38, 0);

    // Cara y diana del malo
    const malo = new THREE.Group();
    anadir(malo, geoAro, matBlanco, 0, 0.8, 0.026);
    anadir(malo, geoAroMedio, matRojo, 0, 0.8, 0.031);
    anadir(malo, geoCentro, matBlanco, 0, 0.8, 0.036);
    const antifaz = anadir(malo, geoAntifaz, matNegro, 0, 1.41, 0.026);
    // Cara del inocente
    const bueno = new THREE.Group();
    const cara = [
      anadir(bueno, geoOjo, matNegro, -0.06, 1.42, 0.026),
      anadir(bueno, geoOjo, matNegro, 0.06, 1.42, 0.026),
      anadir(bueno, geoSonrisa, matNegro, 0, 1.38, 0.026),
    ];
    bisagra.add(malo, bueno);
    const piezasCabeza = new Set([cabeza, antifaz, ...cara]);

    const muneco = {
      carril, bisagra, cuerpo, malo, bueno,
      estado: 'abajo', t: 0, tiempoArriba: 0,
      inocente: false, mueve: false, fase: 0,
      mallas: [],
    };
    bisagra.traverse((o) => {
      if (!o.isMesh) return;
      o.userData.muneco = muneco;
      o.userData.cabeza = piezasCabeza.has(o);
      muneco.mallas.push(o);
    });
    bisagra.rotation.x = -Math.PI / 2;
    return muneco;
  });

  // ─── Pistolas ──────────────────────────────────────────────────────────
  const geoLaser = R(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]));
  const matLaser = R(new THREE.LineBasicMaterial({ color: 0x69f0ae, transparent: true, opacity: 0.55 }));
  const matLaserRojo = R(new THREE.LineBasicMaterial({ color: 0xff5252, transparent: true, opacity: 0.8 }));
  const geoFogonazo = R(new THREE.SphereGeometry(0.04, 8, 6));
  const matFogonazo = R(new THREE.MeshBasicMaterial({ color: 0xffd54f }));

  function crearPistola() {
    const arma = new THREE.Group();
    const metal = new THREE.MeshLambertMaterial({ color: 0x37474f });
    const canon = new THREE.Mesh(new THREE.BoxGeometry(0.035, 0.05, 0.2), metal);
    canon.position.set(0, 0.03, -0.08);
    const empunadura = new THREE.Mesh(new THREE.BoxGeometry(0.03, 0.1, 0.045), new THREE.MeshLambertMaterial({ color: 0x5d4037 }));
    empunadura.position.set(0, -0.02, 0.0);
    empunadura.rotation.x = -0.25;
    const laser = new THREE.Line(geoLaser, matLaser);
    laser.position.set(0, 0.03, CANON);
    const fogonazo = new THREE.Mesh(geoFogonazo, matFogonazo);
    fogonazo.position.set(0, 0.03, CANON - 0.02);
    fogonazo.visible = false;
    arma.add(canon, empunadura, laser, fogonazo);
    return { arma, laser, fogonazo };
  }

  const pistolas = ctx.manos.map((mano) => {
    const p = crearPistola();
    ctx.adjuntarAMano(mano, p.arma);
    return { ...p, mano, espera: 0, retroceso: 0, flash: 0 };
  });

  // Pistola que apunta al ratón en modo escritorio
  const pistolaRaton = crearPistola();
  pistolaRaton.laser.visible = false;
  const pivote = new THREE.Group();
  pivote.add(pistolaRaton.arma);
  pivote.position.copy(vistaPos).add(new THREE.Vector3(0.2, -0.22, -0.45));
  raiz.add(pivote);
  let retrocesoRaton = 0;
  let flashRaton = 0;

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.8, alto: 0.48 });
  marcador.mesh.position.set(0, 3, -6.5);
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  const particulas = [];
  const rayo = new THREE.Raycaster();
  rayo.far = ALCANCE;
  let puntos = 0;
  let record = ctx.leer('record', 0);
  let estado = 'intro'; // 'intro' | 'jugando' | 'fin'
  let reloj = 3;
  let tiempoRestante = DURACION;
  let proximoMuneco = 0;
  let disparos = 0;
  let aciertos = 0;
  let mensaje = '';
  let tiempoMensaje = 0;

  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();

  function actualizarMarcador() {
    if (estado === 'intro') {
      marcador.escribir([
        { texto: 'GALERÍA DE TIRO', tam: 1.3, color: '#ffab91' },
        { texto: 'Dispara a los rojos con diana · ¡a los azules no!', tam: 0.75 },
      ]);
    } else if (estado === 'fin') {
      const punteria = disparos ? Math.round((aciertos / disparos) * 100) : 0;
      marcador.escribir([
        { texto: `¡Tiempo! ${puntos} puntos`, tam: 1.3, color: '#ffab91' },
        { texto: `Puntería ${punteria}% · Récord: ${record} · otra en ${Math.ceil(reloj)}`, tam: 0.75 },
      ]);
    } else {
      marcador.escribir([
        { texto: `Puntos: ${puntos}   ·   ${Math.ceil(tiempoRestante)} s`, tam: 1.3 },
        tiempoMensaje > 0
          ? { texto: mensaje, tam: 0.75, color: '#fff59d' }
          : { texto: `Récord: ${record}   ·   cabeza +${PUNTOS_CABEZA}   ·   azules −${CASTIGO_INOCENTE}`, tam: 0.75, color: '#ffab91' },
      ]);
    }
  }

  function avisar(texto) {
    mensaje = texto;
    tiempoMensaje = 1;
  }

  function levantarMuneco(progreso) {
    const libres = munecos.filter((m) => m.estado === 'abajo');
    if (libres.length === 0) return;
    const m = libres[Math.floor(Math.random() * libres.length)];
    m.estado = 'subiendo';
    m.t = 0;
    m.inocente = Math.random() < 0.22;
    m.mueve = progreso > 0.35 && Math.random() < 0.35;
    m.fase = Math.random() * Math.PI * 2;
    m.tiempoArriba = 2.2 - progreso * 1.0 + Math.random() * 0.5;
    m.cuerpo.material = m.inocente ? matBueno : matMalo;
    m.malo.visible = !m.inocente;
    m.bueno.visible = m.inocente;
  }

  const activo = (m) => m.estado === 'subiendo' || m.estado === 'arriba';

  function mallasActivas() {
    const lista = [];
    for (const m of munecos) if (activo(m)) lista.push(...m.mallas);
    return lista;
  }

  // Lanza el rayo y devuelve el primer impacto contra un muñeco activo
  function apuntar(origen, direccion, mallas) {
    rayo.set(origen, direccion);
    return rayo.intersectObjects(mallas, false)[0] || null;
  }

  function disparar(choque, mano) {
    disparos += 1;
    ctx.sonido('disparo');
    if (mano) ctx.vibrar(mano, 0.6, 40);
    if (!choque || estado !== 'jugando') return;

    const m = choque.object.userData.muneco;
    const cabeza = choque.object.userData.cabeza;
    m.estado = 'cayendo';
    m.t = 0;
    chispas(choque.point);
    if (m.inocente) {
      puntos = Math.max(0, puntos - CASTIGO_INOCENTE);
      avisar(`¡Era inocente! −${CASTIGO_INOCENTE}`);
      ctx.sonido('fallo');
      ctx.destello(0x1e88e5, 0.45);
    } else {
      aciertos += 1;
      puntos += cabeza ? PUNTOS_CABEZA : PUNTOS_CUERPO;
      if (cabeza) avisar(`¡A la cabeza! +${PUNTOS_CABEZA}`);
      ctx.sonido('golpe');
      ctx.sonido('punto');
    }
  }

  function chispas(punto) {
    for (let i = 0; i < 8; i++) {
      const c = new THREE.Mesh(geoChispa, matChispa);
      c.position.copy(punto);
      const vel = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).multiplyScalar(3);
      raiz.add(c);
      particulas.push({ malla: c, vel, vida: 0.5 });
    }
  }

  function actualizarMuneco(m, dt, t) {
    m.t += dt;
    const b = m.bisagra;
    switch (m.estado) {
      case 'subiendo': {
        const f = Math.min(1, m.t / 0.25);
        b.rotation.x = -Math.PI / 2 * (1 - f) * (1 - f);
        if (f >= 1) { m.estado = 'arriba'; m.t = 0; }
        break;
      }
      case 'arriba':
        b.rotation.x = 0;
        if (m.t >= m.tiempoArriba || estado !== 'jugando') { m.estado = 'bajando'; m.t = 0; }
        break;
      case 'cayendo': {
        // Cae de golpe hacia atrás, con un pequeño rebote
        const f = Math.min(1, m.t / 0.3);
        b.rotation.x = -Math.PI / 2 * f * f + Math.sin(f * Math.PI) * 0.1;
        if (f >= 1) { m.estado = 'abajo'; m.t = 0; }
        break;
      }
      case 'bajando': {
        const f = Math.min(1, m.t / 0.4);
        b.rotation.x = -Math.PI / 2 * f;
        if (f >= 1) { m.estado = 'abajo'; m.t = 0; }
        break;
      }
      default:
        b.rotation.x = -Math.PI / 2;
    }
    m.carril.position.x = m.mueve && m.estado !== 'abajo' ? Math.sin(t * 2.2 + m.fase) * 0.9 : 0;
  }

  // ─── Pistolas VR ───────────────────────────────────────────────────────
  function pistolasVR(dt, mallas) {
    for (const p of pistolas) {
      p.espera = Math.max(0, p.espera - dt);
      p.retroceso = Math.max(0, p.retroceso - dt * 6);
      p.flash -= dt;
      p.fogonazo.visible = p.flash > 0;
      p.arma.rotation.x = p.retroceso * 0.5;
      if (!p.mano.activa) continue;

      const origen = p.mano.grip.localToWorld(tmp.set(0, 0.03, CANON));
      const direccion = tmp2.set(0, 0, -1).transformDirection(p.mano.grip.matrixWorld);
      const choque = apuntar(origen, direccion, mallas);
      p.laser.scale.z = choque ? choque.distance : ALCANCE;
      p.laser.material = choque && !choque.object.userData.muneco.inocente ? matLaserRojo : matLaser;

      if (p.mano.gatilloPulsado && p.espera <= 0) {
        p.espera = CADENCIA;
        p.retroceso = 1;
        p.flash = 0.05;
        disparar(choque, p.mano);
      }
    }
  }

  // ─── Disparos con el ratón ─────────────────────────────────────────────
  function disparosRaton(dt, mallas) {
    const raton = ctx.raton;
    pivote.visible = raton.dentro;
    // La pistola mira hacia donde apunta el ratón
    const objetivo = raton.rayo.ray.at(10, tmp);
    pivote.lookAt(tmp2.copy(pivote.position).multiplyScalar(2).sub(objetivo));

    retrocesoRaton = Math.max(0, retrocesoRaton - dt * 6);
    flashRaton -= dt;
    pistolaRaton.arma.rotation.x = retrocesoRaton * 0.5;
    pistolaRaton.fogonazo.visible = flashRaton > 0;

    if (raton.clic) {
      retrocesoRaton = 1;
      flashRaton = 0.05;
      disparar(raton.rayo.intersectObjects(mallas, false)[0] || null, null);
    }
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function empezar() {
    estado = 'jugando';
    puntos = 0;
    disparos = 0;
    aciertos = 0;
    tiempoRestante = DURACION;
    proximoMuneco = 0.4;
  }

  function actualizar(dt, t) {
    reloj -= dt;
    tiempoMensaje -= dt;

    if (estado === 'intro' && reloj <= 0) {
      empezar();
    } else if (estado === 'jugando') {
      tiempoRestante -= dt;
      const progreso = 1 - tiempoRestante / DURACION;
      proximoMuneco -= dt;
      const maxArriba = 2 + Math.floor(progreso * 2.5);
      if (proximoMuneco <= 0 && munecos.filter(activo).length < maxArriba) {
        levantarMuneco(progreso);
        proximoMuneco = 1.0 - progreso * 0.5 + Math.random() * 0.3;
      }
      if (tiempoRestante <= 0) {
        estado = 'fin';
        reloj = 6;
        if (puntos > record) {
          record = puntos;
          ctx.guardar('record', record);
        }
        ctx.sonido('fin');
      }
    } else if (estado === 'fin' && reloj <= 0) {
      empezar();
    }

    for (const m of munecos) actualizarMuneco(m, dt, t);
    raiz.updateMatrixWorld();

    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      p.vida -= dt;
      p.vel.y -= 6 * dt;
      p.malla.position.addScaledVector(p.vel, dt);
      p.malla.scale.setScalar(Math.max(0.01, p.vida / 0.5));
      if (p.vida <= 0) {
        raiz.remove(p.malla);
        particulas.splice(i, 1);
      }
    }

    const mallas = mallasActivas();
    if (ctx.enVR()) {
      pivote.visible = false;
      pistolasVR(dt, mallas);
    } else {
      disparosRaton(dt, mallas);
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
