// ESQUIVA FLECHAS
// Unas torres disparan flechas hacia tu cabeza. En VR te agachas o te apartas
// con el cuerpo; sin gafas mueves el ratón para desplazarte (abajo = agacharse).
// Tienes 3 vidas y la dificultad sube con el tiempo.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const VIDAS = 3;
const DISTANCIA_TORRES = 11;
const ANGULOS_TORRES = [-50, -25, 0, 25, 50];
const TIEMPO_CARGA = 0.8;     // aviso (bola roja) antes de cada disparo
const RADIO_CABEZA = 0.13;
const RADIO_TORSO = 0.16;
const CASI = 0.38;            // distancia a la cabeza que cuenta como "¡por los pelos!"
const INVULNERABLE = 1.2;     // segundos sin recibir daño tras un impacto
const LARGO_FLECHA = 0.75;
const GRAVEDAD = 1.2;          // las flechas caen un poco para que el vuelo parezca real

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  ctx.fondo(0x1d1626);

  // ─── Zona del jugador ──────────────────────────────────────────────────
  const zona = new THREE.Mesh(R(new THREE.RingGeometry(0.75, 0.82, 48)), R(new THREE.MeshBasicMaterial({ color: 0xffb74d })));
  zona.rotation.x = -Math.PI / 2;
  zona.position.y = 0.005;
  raiz.add(zona);

  // ─── Torres ────────────────────────────────────────────────────────────
  const geoTorre = R(new THREE.CylinderGeometry(0.45, 0.6, 2.4, 10));
  const geoAlmena = R(new THREE.BoxGeometry(0.22, 0.25, 0.22));
  const matTorre = R(new THREE.MeshLambertMaterial({ color: 0x5d4e6d }));
  const geoCarga = R(new THREE.SphereGeometry(0.14, 16, 12));
  const matCarga = R(new THREE.MeshBasicMaterial({ color: 0xff5252, transparent: true, opacity: 0.85 }));

  const torres = ANGULOS_TORRES.map((grados) => {
    const a = THREE.MathUtils.degToRad(grados);
    const x = Math.sin(a) * DISTANCIA_TORRES;
    const z = -Math.cos(a) * DISTANCIA_TORRES;
    const torre = new THREE.Mesh(geoTorre, matTorre);
    torre.position.set(x, 1.2, z);
    raiz.add(torre);
    for (let i = 0; i < 6; i++) {
      const almena = new THREE.Mesh(geoAlmena, matTorre);
      const b = (i / 6) * Math.PI * 2;
      almena.position.set(x + Math.cos(b) * 0.4, 2.5, z + Math.sin(b) * 0.4);
      raiz.add(almena);
    }
    // La flecha sale de un punto delante de la torre, hacia el jugador
    const salida = new THREE.Vector3(x, 0, z).multiplyScalar((DISTANCIA_TORRES - 0.8) / DISTANCIA_TORRES);
    const carga = new THREE.Mesh(geoCarga, matCarga);
    carga.visible = false;
    raiz.add(carga);
    return { salida, carga, cargando: false, t: 0, apuntaTorso: false };
  });

  // ─── Flechas ───────────────────────────────────────────────────────────
  // Se construyen apuntando a +Z para poder orientarlas con lookAt.
  const geoAsta = R(new THREE.CylinderGeometry(0.012, 0.012, LARGO_FLECHA, 6));
  geoAsta.rotateX(Math.PI / 2);
  const geoPunta = R(new THREE.ConeGeometry(0.035, 0.12, 8));
  geoPunta.rotateX(Math.PI / 2);
  const geoPluma = R(new THREE.PlaneGeometry(0.14, 0.07));
  geoPluma.rotateY(Math.PI / 2);
  const matAsta = R(new THREE.MeshLambertMaterial({ color: 0xd7b98e }));
  const matPunta = R(new THREE.MeshLambertMaterial({ color: 0xb0bec5, emissive: 0x263238 }));
  const matPluma = R(new THREE.MeshBasicMaterial({ color: 0xff7043, side: THREE.DoubleSide }));

  function crearFlecha() {
    const g = new THREE.Group();
    const asta = new THREE.Mesh(geoAsta, matAsta);
    const punta = new THREE.Mesh(geoPunta, matPunta);
    punta.position.z = LARGO_FLECHA / 2 + 0.05;
    g.add(asta, punta);
    for (const giro of [0, Math.PI / 2]) {
      const pluma = new THREE.Mesh(geoPluma, matPluma);
      pluma.rotation.z = giro;
      pluma.position.z = -LARGO_FLECHA / 2 + 0.06;
      g.add(pluma);
    }
    return g;
  }

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.6, alto: 0.42 });
  marcador.mesh.position.set(0, 3.1, -5);
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  const flechas = [];
  let puntos = 0;
  let vidas = VIDAS;
  let record = ctx.leer('record', 0);
  let estado = 'intro'; // 'intro' | 'jugando' | 'fin'
  let reloj = 3;
  let tiempoJuego = 0;
  let proximoDisparo = 0;
  let invulnerable = 0;
  let mensaje = '';
  let tiempoMensaje = 0;

  const cabeza = new THREE.Vector3(0, 1.55, 0);
  const torsoArriba = new THREE.Vector3();
  const torsoAbajo = new THREE.Vector3();
  const vistaPos = new THREE.Vector3(0, 1.55, 0);
  const vistaObjetivo = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const segmento = new THREE.Line3();

  function actualizarMarcador() {
    if (estado === 'intro') {
      marcador.escribir([
        { texto: 'ESQUIVA FLECHAS', tam: 1.3, color: '#ffcc80' },
        { texto: 'Cuando una torre brille en rojo, ¡apártate o agáchate!', tam: 0.75 },
      ]);
    } else if (estado === 'fin') {
      marcador.escribir([
        { texto: `¡Te dieron! ${puntos} puntos`, tam: 1.3, color: '#ffcc80' },
        { texto: `Récord: ${record} · nueva ronda en ${Math.ceil(reloj)}`, tam: 0.75 },
      ]);
    } else {
      const corazones = '♥'.repeat(vidas) + '♡'.repeat(VIDAS - vidas);
      marcador.escribir([
        { texto: `Puntos: ${puntos}   ·   ${corazones}`, tam: 1.3 },
        tiempoMensaje > 0
          ? { texto: mensaje, tam: 0.75, color: '#fff59d' }
          : { texto: `Récord: ${record}   ·   ${Math.floor(tiempoJuego)} s`, tam: 0.75, color: '#ffcc80' },
      ]);
    }
  }

  function avisar(texto) {
    mensaje = texto;
    tiempoMensaje = 1.2;
  }

  // ─── Posición del jugador ──────────────────────────────────────────────
  function actualizarJugador(dt) {
    if (ctx.enVR()) {
      ctx.camara.getWorldPosition(cabeza);
    } else {
      // Ratón: izquierda/derecha para apartarse, abajo para agacharse
      const { ndc } = ctx.raton;
      const x = THREE.MathUtils.clamp(ndc.x, -1, 1) * 0.8;
      const y = 1.55 + THREE.MathUtils.clamp(ndc.y, -1, 1) * (ndc.y < 0 ? 0.6 : 0.25);
      vistaPos.lerp(tmp.set(x, y, 0), Math.min(1, dt * 12));
      vistaObjetivo.set(vistaPos.x * 0.3, 1.45, -6);
      ctx.vistaEscritorio(vistaPos, vistaObjetivo);
      cabeza.copy(vistaPos);
    }
    // Torso aproximado: un segmento vertical debajo de la cabeza
    torsoArriba.set(cabeza.x, cabeza.y - 0.28, cabeza.z + 0.03);
    torsoAbajo.set(cabeza.x, Math.max(0.35, cabeza.y - 0.85), cabeza.z + 0.03);
    segmento.set(torsoAbajo, torsoArriba);
  }

  // ─── Disparos ──────────────────────────────────────────────────────────
  function cargarTorre(progreso) {
    const libres = torres.filter((t) => !t.cargando);
    if (libres.length === 0) return;
    const torre = libres[Math.floor(Math.random() * libres.length)];
    torre.cargando = true;
    torre.t = 0;
    torre.apuntaTorso = Math.random() < 0.15 + progreso * 0.25;
    torre.salida.y = 0.9 + Math.random() * 1.4;
    torre.carga.position.copy(torre.salida);
    torre.carga.visible = true;
    ctx.sonido('tic');
  }

  function disparar(torre, progreso) {
    torre.cargando = false;
    torre.carga.visible = false;
    // Apunta a donde está el jugador ahora, con un poco de error
    const objetivo = tmp.copy(cabeza);
    if (torre.apuntaTorso) objetivo.y -= 0.45;
    objetivo.x += (Math.random() - 0.5) * 0.15;
    objetivo.y += (Math.random() - 0.5) * 0.1;
    const velocidad = 7 + progreso * 7 + Math.random() * 1.5;
    // Apunta un poco más alto para compensar la caída durante el vuelo
    const vuelo = objetivo.distanceTo(torre.salida) / velocidad;
    objetivo.y += 0.5 * GRAVEDAD * vuelo * vuelo;
    const dir = objetivo.sub(torre.salida).normalize();

    const malla = crearFlecha();
    malla.position.copy(torre.salida);
    malla.lookAt(tmp2.copy(torre.salida).add(dir));
    raiz.add(malla);
    flechas.push({
      malla,
      vel: dir.clone().multiplyScalar(velocidad),
      punta: torre.salida.clone().addScaledVector(dir, LARGO_FLECHA / 2 + 0.1),
      anterior: new THREE.Vector3(),
      minimo: Infinity,   // distancia mínima a la cabeza
      pasada: false,
      clavada: 0,         // > 0 mientras queda clavada en el suelo
    });
    ctx.sonido('corte');
  }

  function recibirImpacto(flecha) {
    flecha.pasada = true; // ya no puede dar puntos
    if (invulnerable > 0) return;
    vidas -= 1;
    invulnerable = INVULNERABLE;
    ctx.destello(0xff1744, 0.6);
    ctx.sonido('golpe');
    ctx.sonido('fallo');
    for (const mano of ctx.manos) ctx.vibrar(mano, 1, 200);
    flecha.clavada = 1.5;
    flecha.malla.visible = false;
    if (vidas <= 0) terminar();
  }

  function terminar() {
    estado = 'fin';
    reloj = 5;
    for (const t of torres) {
      t.cargando = false;
      t.carga.visible = false;
    }
    if (puntos > record) {
      record = puntos;
      ctx.guardar('record', record);
    }
    ctx.sonido('fin');
  }

  function empezar() {
    estado = 'jugando';
    puntos = 0;
    vidas = VIDAS;
    tiempoJuego = 0;
    proximoDisparo = 0.5;
    invulnerable = 0;
  }

  // ─── Movimiento y choques ──────────────────────────────────────────────
  function actualizarFlechas(dt) {
    for (let i = flechas.length - 1; i >= 0; i--) {
      const f = flechas[i];
      if (f.clavada > 0) {
        f.clavada -= dt;
        if (f.clavada <= 0) quitar(i);
        continue;
      }

      f.vel.y -= GRAVEDAD * dt;
      f.anterior.copy(f.punta);
      f.punta.addScaledVector(f.vel, dt);
      f.malla.position.addScaledVector(f.vel, dt);
      f.malla.lookAt(tmp.copy(f.malla.position).add(f.vel));

      // Recorremos el tramo del fotograma en pasos cortos para no atravesar al jugador
      if (estado === 'jugando' && !f.pasada) {
        const pasos = Math.max(1, Math.ceil(f.anterior.distanceTo(f.punta) / 0.04));
        for (let p = 1; p <= pasos; p++) {
          tmp.lerpVectors(f.anterior, f.punta, p / pasos);
          const dCabeza = tmp.distanceTo(cabeza);
          f.minimo = Math.min(f.minimo, dCabeza);
          if (dCabeza < RADIO_CABEZA || segmento.closestPointToPoint(tmp, true, tmp2).distanceTo(tmp) < RADIO_TORSO) {
            recibirImpacto(f);
            break;
          }
        }
        // Ha pasado de largo: punto (y extra si fue por los pelos)
        if (!f.pasada && tmp.subVectors(f.punta, cabeza).dot(f.vel) > 0.3 * f.vel.length()) {
          f.pasada = true;
          puntos += 1;
          if (f.minimo < CASI) {
            puntos += 1;
            avisar('¡Por los pelos! +2');
            ctx.sonido('punto');
            for (const mano of ctx.manos) ctx.vibrar(mano, 0.3, 40);
          }
        }
      }

      // Se clava en el suelo o se pierde a lo lejos
      if (f.punta.y <= 0.01) {
        f.clavada = 2;
      } else if (f.malla.position.lengthSq() > 400) {
        quitar(i);
      }
    }
  }

  function quitar(i) {
    raiz.remove(flechas[i].malla);
    flechas.splice(i, 1);
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function actualizar(dt, t) {
    actualizarJugador(dt);
    reloj -= dt;
    invulnerable = Math.max(0, invulnerable - dt);
    tiempoMensaje -= dt;

    if (estado === 'intro' && reloj <= 0) {
      empezar();
    } else if (estado === 'jugando') {
      tiempoJuego += dt;
      const progreso = Math.min(1, tiempoJuego / 90);
      proximoDisparo -= dt;
      const maxCargando = 1 + Math.floor(progreso * 2.5);
      if (proximoDisparo <= 0 && torres.filter((x) => x.cargando).length < maxCargando) {
        cargarTorre(progreso);
        proximoDisparo = 1.6 - progreso * 1.0 + Math.random() * 0.4;
      }
      for (const torre of torres) {
        if (!torre.cargando) continue;
        torre.t += dt;
        const f = torre.t / TIEMPO_CARGA;
        torre.carga.scale.setScalar(0.3 + f * 0.9 + Math.sin(t * 30) * 0.08);
        if (f >= 1) disparar(torre, progreso);
      }
    } else if (estado === 'fin' && reloj <= 0) {
      empezar();
    }

    actualizarFlechas(dt);

    // La zona parpadea mientras eres invulnerable
    zona.visible = invulnerable <= 0 || Math.sin(t * 25) > 0;

    actualizarMarcador();
  }

  actualizarJugador(1);
  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      flechas.length = 0;
    },
  };
}
