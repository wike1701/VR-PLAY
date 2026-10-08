// PARA PENALTIS
// Eres el portero. Un jugador chuta 10 penaltis por tanda: páralos con los
// guantes (o con el cuerpo) en VR, o moviendo los guantes con el ratón.
// La portería es más pequeña que la real para que llegues sin tirarte al suelo.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const PENALTIS = 10;
const G = 9.8;
const ANCHO = 3.2;            // portería reducida (la real mide 7,32 × 2,44)
const ALTO = 2.0;
const LINEA_GOL = 0.5;        // la línea de gol queda medio metro detrás del jugador
const FONDO_RED = 1.6;
const PUNTO_PENALTI = new THREE.Vector3(0, 0.11, -11);
const RADIO_BALON = 0.11;
const RADIO_GUANTE = 0.12;
const RADIO_CABEZA = 0.13;
const RADIO_TORSO = 0.18;
const PLANO_RATON = -0.3;     // en modo escritorio los guantes se mueven en este plano
const VELOCIDAD_RATON = 7;    // m/s máximos de los guantes con ratón (si no, sería demasiado fácil)

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  ctx.fondo(0x86b8e0);
  // El lanzador está lejos: alejamos la niebla mientras dura este juego
  const niebla = ctx.escena.fog;
  const nieblaOriginal = { near: niebla.near, far: niebla.far };
  niebla.near = 25;
  niebla.far = 60;
  const vistaPos = new THREE.Vector3(0, 1.25, 1.1);
  ctx.vistaEscritorio(vistaPos, new THREE.Vector3(0, 0.9, -11));

  // ─── Campo y portería ──────────────────────────────────────────────────
  const cesped = new THREE.Mesh(R(new THREE.PlaneGeometry(30, 30)), R(new THREE.MeshLambertMaterial({ color: 0x4caf50 })));
  cesped.rotation.x = -Math.PI / 2;
  cesped.position.set(0, 0.003, -9);
  raiz.add(cesped);
  const matCal = R(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  const lineas = [
    [ANCHO + 6, 0.08, 0, LINEA_GOL],      // línea de gol
    [ANCHO + 6, 0.08, 0, -5.5],           // área
    [0.08, 6, -(ANCHO / 2 + 3), -2.5],
    [0.08, 6, ANCHO / 2 + 3, -2.5],
  ];
  for (const [ancho, largo, x, z] of lineas) {
    const l = new THREE.Mesh(R(new THREE.PlaneGeometry(ancho, largo)), matCal);
    l.rotation.x = -Math.PI / 2;
    l.position.set(x, 0.006, z);
    raiz.add(l);
  }
  const punto = new THREE.Mesh(R(new THREE.CircleGeometry(0.12, 16)), matCal);
  punto.rotation.x = -Math.PI / 2;
  punto.position.set(PUNTO_PENALTI.x, 0.006, PUNTO_PENALTI.z);
  raiz.add(punto);

  const matPoste = R(new THREE.MeshLambertMaterial({ color: 0xffffff }));
  const geoPoste = R(new THREE.CylinderGeometry(0.05, 0.05, ALTO, 12));
  for (const x of [-ANCHO / 2, ANCHO / 2]) {
    const poste = new THREE.Mesh(geoPoste, matPoste);
    poste.position.set(x, ALTO / 2, LINEA_GOL);
    raiz.add(poste);
  }
  const larguero = new THREE.Mesh(R(new THREE.CylinderGeometry(0.05, 0.05, ANCHO + 0.1, 12)), matPoste);
  larguero.rotation.z = Math.PI / 2;
  larguero.position.set(0, ALTO, LINEA_GOL);
  raiz.add(larguero);
  const matRed = R(new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.35 }));
  const redFondo = new THREE.Mesh(R(new THREE.PlaneGeometry(ANCHO, ALTO, 16, 10)), matRed);
  redFondo.position.set(0, ALTO / 2, LINEA_GOL + FONDO_RED);
  const redTecho = new THREE.Mesh(R(new THREE.PlaneGeometry(ANCHO, FONDO_RED, 16, 8)), matRed);
  redTecho.rotation.x = Math.PI / 2;
  redTecho.position.set(0, ALTO, LINEA_GOL + FONDO_RED / 2);
  raiz.add(redFondo, redTecho);
  for (const x of [-ANCHO / 2, ANCHO / 2]) {
    const lado = new THREE.Mesh(R(new THREE.PlaneGeometry(FONDO_RED, ALTO, 8, 10)), matRed);
    lado.rotation.y = Math.PI / 2;
    lado.position.set(x, ALTO / 2, LINEA_GOL + FONDO_RED / 2);
    raiz.add(lado);
  }

  // ─── Balón ─────────────────────────────────────────────────────────────
  const balon = new THREE.Mesh(R(new THREE.IcosahedronGeometry(RADIO_BALON, 1)), R(new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true })));
  const geoParche = R(new THREE.IcosahedronGeometry(RADIO_BALON * 1.01, 0));
  const parches = new THREE.Mesh(geoParche, R(new THREE.MeshBasicMaterial({ color: 0x222222, wireframe: true })));
  balon.add(parches);
  raiz.add(balon);

  // ─── Lanzador ──────────────────────────────────────────────────────────
  // Construido mirando a +Z (hacia el portero)
  const lanzador = new THREE.Group();
  const matCamiseta = R(new THREE.MeshLambertMaterial({ color: 0xd32f2f }));
  const matPantalon = R(new THREE.MeshLambertMaterial({ color: 0xffffff }));
  const matPiel = R(new THREE.MeshLambertMaterial({ color: 0xffcc80 }));
  const geoPierna = R(new THREE.BoxGeometry(0.13, 0.85, 0.13));
  geoPierna.translate(0, -0.425, 0);
  const torso = new THREE.Mesh(R(new THREE.BoxGeometry(0.42, 0.6, 0.24)), matCamiseta);
  torso.position.y = 1.2;
  const cabeza = new THREE.Mesh(R(new THREE.SphereGeometry(0.12, 12, 10)), matPiel);
  cabeza.position.y = 1.65;
  lanzador.add(torso, cabeza);
  const piernas = [-1, 1].map((lado) => {
    const pierna = new THREE.Mesh(geoPierna, matPantalon);
    pierna.position.set(lado * 0.11, 0.88, 0);
    lanzador.add(pierna);
    return pierna;
  });
  raiz.add(lanzador);
  const SALIDA_LANZADOR = new THREE.Vector3(-1.3, 0, -13.4);
  const LLEGADA_LANZADOR = new THREE.Vector3(-0.32, 0, -11.45);

  // ─── Guantes ───────────────────────────────────────────────────────────
  const geoPalma = R(new THREE.BoxGeometry(0.13, 0.16, 0.05));
  const geoPulgar = R(new THREE.BoxGeometry(0.04, 0.08, 0.04));
  const matGuante = R(new THREE.MeshLambertMaterial({ color: 0x76ff03 }));
  const matPuno = R(new THREE.MeshLambertMaterial({ color: 0x212121 }));
  const geoPuno = R(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 10));

  function crearGuante(lado) {
    const g = new THREE.Group();
    // Palma mirando hacia delante (-Z), dedos hacia arriba
    const palma = new THREE.Mesh(geoPalma, matGuante);
    palma.position.set(0, 0.03, -0.06);
    const pulgar = new THREE.Mesh(geoPulgar, matGuante);
    pulgar.position.set(-lado * 0.08, 0.0, -0.06);
    pulgar.rotation.z = lado * 0.5;
    const puno = new THREE.Mesh(geoPuno, matPuno);
    puno.position.set(0, -0.07, -0.06);
    g.add(palma, pulgar, puno);
    return g;
  }

  const guantesVR = ctx.manos.map((mano, i) => {
    // Si aún no se sabe qué mando es cuál, el primero es el izquierdo
    const lado = mano.lado ? (mano.lado === 'left' ? -1 : 1) : (i === 0 ? -1 : 1);
    return { mano, objeto: ctx.adjuntarAMano(mano, crearGuante(lado)), pos: new THREE.Vector3() };
  });

  // Guantes del modo escritorio (siguen al ratón)
  const parRaton = new THREE.Group();
  for (const lado of [-1, 1]) {
    const g = crearGuante(lado);
    g.position.x = lado * 0.11;
    g.position.z = 0.06;
    parRaton.add(g);
  }
  parRaton.position.set(0, 1, PLANO_RATON);
  raiz.add(parRaton);
  const planoRaton = new THREE.Plane(new THREE.Vector3(0, 0, 1), -PLANO_RATON);
  const destinoRaton = new THREE.Vector3(0, 1, PLANO_RATON);

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 3.4, alto: 0.92 });
  marcador.mesh.position.set(0, 3.4, -13);
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'espera' | 'carrera' | 'vuelo' | 'resultado' | 'fin'
  let reloj = 3.5;
  let tiro = 0;                 // penalti actual (0..9)
  let resultados = [];          // 'parada' | 'gol' | 'fuera'
  let record = ctx.leer('record', 0);
  let mensaje = '';
  let colorMensaje = '#ffffff';
  const vel = new THREE.Vector3();
  const efecto = new THREE.Vector3(); // aceleración lateral (balón con efecto)
  let resuelto = null;          // resultado del tiro en curso
  let vidaBalon = 0;

  const cabezaJugador = new THREE.Vector3();
  const torso1 = new THREE.Vector3();
  const torso2 = new THREE.Vector3();
  const segmentoTorso = new THREE.Line3();
  const anterior = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();

  const paradas = () => resultados.filter((r) => r === 'parada').length;

  function actualizarMarcador() {
    const fila = Array.from({ length: PENALTIS }, (_, i) =>
      i < resultados.length ? { gol: '✘', parada: '✔', fuera: '○' }[resultados[i]] : '·').join(' ');
    if (estado === 'intro') {
      marcador.escribir([
        { texto: 'PARA PENALTIS', tam: 1.3, color: '#b9f6ca' },
        { texto: ctx.enVR() ? 'Para el balón con los guantes o con el cuerpo' : 'Mueve los guantes con el ratón', tam: 0.7 },
        { texto: `${PENALTIS} penaltis por tanda · Récord: ${record} paradas`, tam: 0.7, color: '#b9f6ca' },
      ]);
    } else if (estado === 'fin') {
      marcador.escribir([
        { texto: `${paradas()} paradas de ${PENALTIS}`, tam: 1.3, color: '#b9f6ca' },
        { texto: fila, tam: 0.8 },
        { texto: `Récord: ${record} · otra tanda en ${Math.ceil(reloj)}`, tam: 0.7 },
      ]);
    } else {
      marcador.escribir([
        estado === 'resultado'
          ? { texto: mensaje, tam: 1.3, color: colorMensaje }
          : { texto: `Penalti ${tiro + 1} de ${PENALTIS}`, tam: 1.3 },
        { texto: fila, tam: 0.8 },
        { texto: `Paradas: ${paradas()}   ·   Récord: ${record}`, tam: 0.7, color: '#b9f6ca' },
      ]);
    }
  }

  // ─── Penaltis ──────────────────────────────────────────────────────────
  function prepararTiro() {
    estado = 'espera';
    reloj = 1.4;
    balon.position.copy(PUNTO_PENALTI);
    balon.rotation.set(0, 0, 0);
    vel.set(0, 0, 0);
    lanzador.position.copy(SALIDA_LANZADOR);
    lanzador.lookAt(PUNTO_PENALTI.x, 0, PUNTO_PENALTI.z);
    for (const p of piernas) p.rotation.x = 0;
    resuelto = null;
  }

  function chutar() {
    const progreso = tiro / (PENALTIS - 1);
    // A dónde va: cada vez más a las esquinas, y alguno se va fuera
    let x;
    let y;
    if (Math.random() < 0.08) {
      x = (Math.random() < 0.5 ? -1 : 1) * (ANCHO / 2 + 0.3 + Math.random() * 0.4);
      y = 0.3 + Math.random() * 1.6;
    } else {
      const lado = Math.random() < 0.5 ? -1 : 1;
      const esquina = Math.min(1, 0.3 + progreso * 0.7);
      x = lado * (Math.random() * (1 - esquina) + esquina) * (ANCHO / 2 - 0.25);
      y = 0.2 + Math.random() * (ALTO - 0.45);
    }
    const objetivo = tmp.set(x, y, LINEA_GOL);
    const rapidez = 10 + progreso * 7 + Math.random() * 2;
    const t = objetivo.distanceTo(PUNTO_PENALTI) / rapidez;
    // Efecto lateral a partir del cuarto penalti
    efecto.set(tiro >= 3 && Math.random() < 0.5 ? (Math.random() - 0.5) * 8 : 0, -G, 0);
    // p = p0 + v·t + ½·a·t²  →  v = (p − p0 − ½·a·t²) / t
    vel.copy(objetivo).sub(PUNTO_PENALTI).addScaledVector(efecto, -0.5 * t * t).divideScalar(t);
    estado = 'vuelo';
    vidaBalon = 3;
    ctx.sonido('patada');
  }

  function terminarTiro(resultado, texto, color) {
    resuelto = resultado;
    resultados.push(resultado);
    mensaje = texto;
    colorMensaje = color;
    estado = 'resultado';
    reloj = 1.6;
    if (resultado === 'gol') {
      ctx.sonido('fallo');
      ctx.destello(0xff1744, 0.35);
    } else if (resultado === 'parada') {
      ctx.sonido('punto');
    }
  }

  // ─── Posición del cuerpo y de los guantes ──────────────────────────────
  function actualizarPortero(dt) {
    if (ctx.enVR()) {
      parRaton.visible = false;
      ctx.camara.getWorldPosition(cabezaJugador);
      torso1.set(cabezaJugador.x, cabezaJugador.y - 0.28, cabezaJugador.z + 0.03);
      torso2.set(cabezaJugador.x, Math.max(0.35, cabezaJugador.y - 0.85), cabezaJugador.z + 0.03);
      segmentoTorso.set(torso2, torso1);
      for (const g of guantesVR) g.mano.grip.localToWorld(g.pos.set(0, 0.03, -0.06));
    } else {
      parRaton.visible = ctx.raton.dentro;
      if (ctx.raton.rayo.ray.intersectPlane(planoRaton, tmp)) {
        destinoRaton.set(THREE.MathUtils.clamp(tmp.x, -ANCHO / 2 - 0.3, ANCHO / 2 + 0.3), THREE.MathUtils.clamp(tmp.y, 0.1, ALTO + 0.2), PLANO_RATON);
      }
      // Los guantes van hacia el ratón con velocidad limitada
      const paso = tmp2.subVectors(destinoRaton, parRaton.position);
      const maximo = VELOCIDAD_RATON * dt;
      if (paso.length() > maximo) paso.setLength(maximo);
      parRaton.position.add(paso);
    }
  }

  // ¿Toca el balón algo del portero en este punto? Devuelve la normal del rebote o null.
  function contacto(punto) {
    if (ctx.enVR()) {
      for (const g of guantesVR) {
        if (g.mano.activa && punto.distanceTo(g.pos) < RADIO_GUANTE + RADIO_BALON) {
          ctx.vibrar(g.mano, 1, 150);
          return { normal: tmp2.subVectors(punto, g.pos).normalize(), texto: '¡PARADÓN!' };
        }
      }
      if (punto.distanceTo(cabezaJugador) < RADIO_CABEZA + RADIO_BALON) {
        return { normal: tmp2.subVectors(punto, cabezaJugador).normalize(), texto: '¡De cabeza!' };
      }
      const cercano = segmentoTorso.closestPointToPoint(punto, true, tmp2);
      if (cercano.distanceTo(punto) < RADIO_TORSO + RADIO_BALON) {
        for (const g of guantesVR) ctx.vibrar(g.mano, 0.6, 120);
        return { normal: tmp2.subVectors(punto, cercano).normalize(), texto: '¡Con el cuerpo!' };
      }
      return null;
    }
    // Con ratón el par de guantes es algo más grande: se mueve en un plano y no hay cuerpo
    if (parRaton.visible && punto.distanceTo(parRaton.position) < RADIO_GUANTE * 1.6 + RADIO_BALON) {
      return { normal: tmp2.subVectors(punto, parRaton.position).normalize(), texto: '¡PARADÓN!' };
    }
    return null;
  }

  function moverBalon(dt) {
    const pos = balon.position;
    const pasos = Math.max(1, Math.ceil((vel.length() * dt) / 0.04));
    const h = dt / pasos;
    for (let i = 0; i < pasos; i++) {
      anterior.copy(pos);
      vel.addScaledVector(efecto, h);
      pos.addScaledVector(vel, h);

      if (!resuelto) {
        const toque = contacto(pos);
        if (toque) {
          const vn = vel.dot(toque.normal);
          if (vn < 0) vel.addScaledVector(toque.normal, -1.5 * vn);
          vel.multiplyScalar(0.55);
          vel.z = Math.min(vel.z, -2); // despejado hacia el campo
          efecto.set(0, -G, 0);
          terminarTiro('parada', toque.texto, '#b9f6ca');
        } else if (anterior.z < LINEA_GOL && pos.z >= LINEA_GOL) {
          const dentro = Math.abs(pos.x) < ANCHO / 2 - RADIO_BALON && pos.y < ALTO - RADIO_BALON;
          if (dentro) terminarTiro('gol', '¡GOL!', '#ff8a80');
          else terminarTiro('fuera', '¡Fuera!', '#fff59d');
          efecto.set(0, -G, 0);
        }
      }

      // La red frena el balón
      if (resuelto === 'gol' && pos.z > LINEA_GOL + FONDO_RED - RADIO_BALON) {
        pos.z = LINEA_GOL + FONDO_RED - RADIO_BALON;
        vel.z *= -0.15;
        vel.x *= 0.3;
      }
      // Suelo
      if (pos.y < RADIO_BALON) {
        pos.y = RADIO_BALON;
        if (vel.y < 0) vel.y *= -0.5;
        vel.x *= 0.98;
        vel.z *= 0.98;
      }
    }
    balon.rotation.x += vel.z * dt * 5;
    balon.rotation.z -= vel.x * dt * 5;
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function empezarTanda() {
    tiro = 0;
    resultados = [];
    prepararTiro();
  }

  function actualizar(dt, t) {
    reloj -= dt;
    actualizarPortero(dt);

    switch (estado) {
      case 'intro':
        if (reloj <= 0) empezarTanda();
        break;
      case 'espera':
        if (reloj <= 0) {
          estado = 'carrera';
          reloj = 1.1;
          ctx.sonido('silbato');
        }
        break;
      case 'carrera': {
        // Carrerilla hacia el balón y patada
        const f = 1 - Math.max(0, reloj) / 1.1;
        lanzador.position.lerpVectors(SALIDA_LANZADOR, LLEGADA_LANZADOR, Math.min(1, f / 0.85));
        if (f < 0.85) {
          piernas[0].rotation.x = Math.sin(t * 14) * 0.7;
          piernas[1].rotation.x = -Math.sin(t * 14) * 0.7;
        } else {
          piernas[0].rotation.x = 0;
          piernas[1].rotation.x = -1.2 * ((f - 0.85) / 0.15); // la pierna derecha chuta
        }
        if (reloj <= 0) chutar();
        break;
      }
      case 'vuelo':
        vidaBalon -= dt;
        if (vidaBalon <= 0 && !resuelto) terminarTiro('fuera', '¡Fuera!', '#fff59d');
        break;
      case 'resultado':
        if (reloj <= 0) {
          tiro += 1;
          if (tiro >= PENALTIS) {
            estado = 'fin';
            reloj = 7;
            if (paradas() > record) {
              record = paradas();
              ctx.guardar('record', record);
            }
            ctx.sonido('fin');
          } else {
            prepararTiro();
          }
        }
        break;
      case 'fin':
        if (reloj <= 0) empezarTanda();
        break;
    }

    if (estado === 'vuelo' || estado === 'resultado') moverBalon(dt);
    if (estado === 'resultado' && piernas[1].rotation.x < 0) piernas[1].rotation.x = Math.min(0, piernas[1].rotation.x + dt * 3);

    actualizarMarcador();
  }

  prepararTiro();
  estado = 'intro';
  reloj = 3.5;
  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      niebla.near = nieblaOriginal.near;
      niebla.far = nieblaOriginal.far;
    },
  };
}
