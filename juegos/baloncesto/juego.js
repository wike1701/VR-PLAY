// TIRO A CANASTA
// Tiros libres sin moverte del sitio. En VR coges un balón de los soportes que
// tienes delante (gatillo o botón lateral) y lo lanzas con el brazo. Sin gafas:
// apunta con el ratón, mantén pulsado y suelta cuando la barra de fuerza esté
// en la marca verde. Rondas de 60 segundos.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const DURACION = 60;
const G = 9.8;
const RADIO_BALON = 0.12;
const ARO = new THREE.Vector3(0, 3.05, -4.2);   // centro del aro (altura reglamentaria)
const RADIO_ARO = 0.23;
const GROSOR_ARO = 0.012;
const TABLERO_Z = ARO.z - RADIO_ARO - 0.15;     // cara delantera del tablero
const TABLERO_ANCHO = 1.8;
const TABLERO_ABAJO = 2.9;
const TABLERO_ARRIBA = 3.95;
const ALCANCE_AGARRE = 0.22;
const FUERZA_VR = 1.1;        // los lanzamientos en VR suelen quedarse cortos
const AYUDA = 0.35;           // cuánto se corrige un buen lanzamiento en VR hacia la canasta (0 = nada)
const V_MIN = 5.5;            // fuerza mínima y máxima del lanzamiento con ratón
const V_MAX = 10.5;
const ANGULO_RATON = THREE.MathUtils.degToRad(52);
// Soportes de balones: dos en VR (uno para cada mano) y uno para el ratón
const PUESTOS_VR = [new THREE.Vector3(-0.28, 1.0, -0.35), new THREE.Vector3(0.28, 1.0, -0.35)];
const PUESTO_RATON = new THREE.Vector3(0, 1.3, -0.35);

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  ctx.fondo(0x1f1a2e);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.6, 0.7), new THREE.Vector3(0, 2.6, -4.2));

  // ─── Pista ─────────────────────────────────────────────────────────────
  const parquet = new THREE.Mesh(R(new THREE.PlaneGeometry(9, 9)), R(new THREE.MeshLambertMaterial({ color: 0xc8935a })));
  parquet.rotation.x = -Math.PI / 2;
  parquet.position.set(0, 0.003, -3);
  raiz.add(parquet);
  const zona = new THREE.Mesh(R(new THREE.PlaneGeometry(3.6, 4.6)), R(new THREE.MeshLambertMaterial({ color: 0xa4462e })));
  zona.rotation.x = -Math.PI / 2;
  zona.position.set(0, 0.005, ARO.z + 0.6 + 1.6);
  raiz.add(zona);
  const linea = new THREE.Mesh(R(new THREE.PlaneGeometry(3.6, 0.05)), R(new THREE.MeshBasicMaterial({ color: 0xffffff })));
  linea.rotation.x = -Math.PI / 2;
  linea.position.set(0, 0.007, -0.15);
  raiz.add(linea);

  // ─── Canasta ───────────────────────────────────────────────────────────
  const matBlanco = R(new THREE.MeshLambertMaterial({ color: 0xf5f5f5 }));
  const matNaranja = R(new THREE.MeshLambertMaterial({ color: 0xff5722, emissive: 0x3a1000 }));
  const matGris = R(new THREE.MeshLambertMaterial({ color: 0x546e7a }));
  const tablero = new THREE.Mesh(R(new THREE.BoxGeometry(TABLERO_ANCHO, TABLERO_ARRIBA - TABLERO_ABAJO, 0.04)), matBlanco);
  tablero.position.set(0, (TABLERO_ABAJO + TABLERO_ARRIBA) / 2, TABLERO_Z - 0.02);
  raiz.add(tablero);
  // Cuadro pintado encima del aro
  const geoTira = R(new THREE.PlaneGeometry(0.59, 0.04));
  const geoTiraV = R(new THREE.PlaneGeometry(0.04, 0.45));
  for (const [geo, x, y] of [[geoTira, 0, 3.05], [geoTira, 0, 3.48], [geoTiraV, -0.275, 3.265], [geoTiraV, 0.275, 3.265]]) {
    const tira = new THREE.Mesh(geo, matNaranja);
    tira.position.set(x, y, TABLERO_Z + 0.001);
    raiz.add(tira);
  }
  const aro = new THREE.Mesh(R(new THREE.TorusGeometry(RADIO_ARO, GROSOR_ARO, 8, 32)), matNaranja);
  aro.rotation.x = Math.PI / 2;
  aro.position.copy(ARO);
  raiz.add(aro);
  const soporteAro = new THREE.Mesh(R(new THREE.BoxGeometry(0.06, 0.03, 0.15)), matNaranja);
  soporteAro.position.set(0, ARO.y, TABLERO_Z + 0.075);
  raiz.add(soporteAro);
  const red = new THREE.Mesh(
    R(new THREE.CylinderGeometry(RADIO_ARO, 0.15, 0.4, 16, 3, true)),
    R(new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.8 })),
  );
  red.position.set(ARO.x, ARO.y - 0.2, ARO.z);
  raiz.add(red);
  const poste = new THREE.Mesh(R(new THREE.CylinderGeometry(0.08, 0.1, TABLERO_ABAJO + 0.4, 12)), matGris);
  poste.position.set(0, (TABLERO_ABAJO + 0.4) / 2, TABLERO_Z - 0.9);
  const brazo = new THREE.Mesh(R(new THREE.BoxGeometry(0.1, 0.1, 0.9)), matGris);
  brazo.position.set(0, TABLERO_ABAJO + 0.3, TABLERO_Z - 0.45);
  raiz.add(poste, brazo);

  // ─── Balones ───────────────────────────────────────────────────────────
  const geoBalon = R(new THREE.SphereGeometry(RADIO_BALON, 20, 14));
  const matBalon = R(new THREE.MeshLambertMaterial({ color: 0xe8681c }));
  const geoCostura = R(new THREE.TorusGeometry(RADIO_BALON * 1.005, 0.004, 4, 32));
  const matCostura = R(new THREE.MeshBasicMaterial({ color: 0x2b1a10 }));
  const geoSoporte = R(new THREE.CylinderGeometry(0.06, 0.08, 0.06, 16));

  function crearBalon() {
    const balon = new THREE.Mesh(geoBalon, matBalon);
    for (const [rx, ry] of [[0, 0], [Math.PI / 2, 0], [0, Math.PI / 2]]) {
      const c = new THREE.Mesh(geoCostura, matCostura);
      c.rotation.set(rx, ry, 0);
      balon.add(c);
    }
    return balon;
  }

  const puestos = [
    ...PUESTOS_VR.map((pos) => ({ pos, vr: true })),
    { pos: PUESTO_RATON, vr: false },
  ].map((p) => ({ ...p, balon: null, recarga: 0 }));
  for (const p of puestos) {
    if (!p.vr) continue;
    const soporte = new THREE.Mesh(geoSoporte, matGris);
    soporte.position.copy(p.pos).y -= RADIO_BALON + 0.03;
    raiz.add(soporte);
  }

  // Manos visibles en VR
  const geoMano = R(new THREE.SphereGeometry(0.045, 12, 8));
  geoMano.scale(1, 0.6, 1.3);
  const matMano = R(new THREE.MeshLambertMaterial({ color: 0xffcc80 }));
  const manos = ctx.manos.map((mano) => {
    ctx.adjuntarAMano(mano, new THREE.Mesh(geoMano, matMano));
    return { mano, balon: null, historial: [], apretonAntes: false };
  });

  // ─── Barra de fuerza (ratón) ───────────────────────────────────────────
  const barra = new THREE.Group();
  barra.position.set(0.3, 1.12, -0.5);
  const fondoBarra = new THREE.Mesh(R(new THREE.BoxGeometry(0.035, 0.4, 0.01)), R(new THREE.MeshBasicMaterial({ color: 0x222233 })));
  fondoBarra.position.y = 0.2;
  const geoRelleno = R(new THREE.BoxGeometry(0.025, 0.4, 0.012));
  geoRelleno.translate(0, 0.2, 0);
  const relleno = new THREE.Mesh(geoRelleno, R(new THREE.MeshBasicMaterial({ color: 0xff9800 })));
  const marca = new THREE.Mesh(R(new THREE.BoxGeometry(0.05, 0.012, 0.014)), R(new THREE.MeshBasicMaterial({ color: 0x00e676 })));
  barra.add(fondoBarra, relleno, marca);
  raiz.add(barra);
  let cargando = false;
  let faseCarga = 0;

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.6, alto: 0.44 });
  marcador.mesh.position.set(0, 4.45, TABLERO_Z);
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  const enVuelo = [];
  let puntos = 0;
  let canastas = 0;
  let lanzamientos = 0;
  let racha = 0;
  let record = ctx.leer('record', 0);
  let estado = 'intro'; // 'intro' | 'jugando' | 'fin'
  let reloj = 3;
  let tiempoRestante = DURACION;
  let mensaje = '';
  let tiempoMensaje = 0;
  let meneoRed = 0;

  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const anterior = new THREE.Vector3();

  function actualizarMarcador() {
    if (estado === 'intro') {
      marcador.escribir([
        { texto: 'TIRO A CANASTA', tam: 1.3, color: '#ffab40' },
        {
          texto: ctx.enVR() ? 'Coge un balón con el gatillo y lánzalo' : 'Mantén pulsado y suelta en la marca verde',
          tam: 0.7,
        },
      ]);
    } else if (estado === 'fin') {
      marcador.escribir([
        { texto: `¡Tiempo! ${puntos} puntos`, tam: 1.3, color: '#ffab40' },
        { texto: `${canastas} de ${lanzamientos} · Récord: ${record} · otra en ${Math.ceil(reloj)}`, tam: 0.7 },
      ]);
    } else {
      marcador.escribir([
        { texto: `Puntos: ${puntos}   ·   ${Math.ceil(tiempoRestante)} s`, tam: 1.3 },
        tiempoMensaje > 0
          ? { texto: mensaje, tam: 0.7, color: '#fff59d' }
          : { texto: `Récord: ${record}   ·   limpia +3   ·   racha x2`, tam: 0.7, color: '#ffab40' },
      ]);
    }
  }

  function avisar(texto) {
    mensaje = texto;
    tiempoMensaje = 1.4;
  }

  // ─── Lanzar ────────────────────────────────────────────────────────────
  function lanzar(balon, velocidad) {
    lanzamientos += 1;
    enVuelo.push({ malla: balon, vel: velocidad.clone(), vida: 6, toco: false, anotado: false });
  }

  // Corrige un poco un buen lanzamiento VR para que entre (lanzar en VR sin peso es difícil)
  function ayudar(origen, vel) {
    const horizontal = Math.hypot(vel.x, vel.z);
    const dx = ARO.x - origen.x;
    const dz = ARO.z - origen.z;
    const distancia = Math.hypot(dx, dz);
    if (horizontal < 0.5 || distancia < 0.5) return vel;
    const angulo = Math.acos(THREE.MathUtils.clamp((vel.x * dx + vel.z * dz) / (horizontal * distancia), -1, 1));
    const t = distancia / horizontal;
    const ideal = tmp2.set(dx / t, (ARO.y - origen.y) / t + 0.5 * G * t, dz / t);
    if (angulo < THREE.MathUtils.degToRad(20) && t > 0.3 && t < 2.5 && Math.abs(ideal.y - vel.y) < 3) {
      vel.lerp(ideal, AYUDA);
    }
    return vel;
  }

  // ─── Física ────────────────────────────────────────────────────────────
  function moverBalon(b, dt) {
    const pos = b.malla.position;
    const pasos = Math.max(1, Math.ceil((b.vel.length() * dt) / 0.03));
    const h = dt / pasos;
    for (let i = 0; i < pasos; i++) {
      anterior.copy(pos);
      b.vel.y -= G * h;
      pos.addScaledVector(b.vel, h);

      // Tablero
      if (b.vel.z < 0 && pos.z - RADIO_BALON < TABLERO_Z && pos.z > TABLERO_Z - 0.15 &&
          Math.abs(pos.x) < TABLERO_ANCHO / 2 && pos.y > TABLERO_ABAJO && pos.y < TABLERO_ARRIBA) {
        pos.z = TABLERO_Z + RADIO_BALON;
        b.vel.z *= -0.6;
        b.toco = true;
        ctx.sonido('bote');
      }

      // Aro: punto más cercano de la circunferencia del aro
      tmp.set(pos.x - ARO.x, 0, pos.z - ARO.z);
      if (tmp.lengthSq() < 1e-8) tmp.set(1, 0, 0);
      tmp.normalize().multiplyScalar(RADIO_ARO).add(ARO);
      const normal = tmp2.subVectors(pos, tmp);
      const distancia = normal.length();
      const minimo = RADIO_BALON + GROSOR_ARO;
      if (distancia < minimo && distancia > 1e-6) {
        normal.divideScalar(distancia);
        pos.copy(tmp).addScaledVector(normal, minimo);
        const vn = b.vel.dot(normal);
        if (vn < 0) {
          b.vel.addScaledVector(normal, -1.55 * vn).multiplyScalar(0.9);
          if (!b.toco || vn < -1) ctx.sonido('golpe');
          b.toco = true;
        }
      }

      // ¿Ha entrado? Cruza el plano del aro hacia abajo por dentro
      if (!b.anotado && anterior.y >= ARO.y && pos.y < ARO.y && b.vel.y < 0 &&
          Math.hypot(pos.x - ARO.x, pos.z - ARO.z) < RADIO_ARO - RADIO_BALON * 0.3) {
        b.anotado = true;
        b.vel.x *= 0.4;
        b.vel.z *= 0.4;
        canasta(b);
      }

      // Suelo
      if (pos.y < RADIO_BALON) {
        pos.y = RADIO_BALON;
        if (b.vel.y < 0) {
          if (b.vel.y < -1.2) ctx.sonido('bote');
          b.vel.y *= -0.62;
          b.vel.x *= 0.85;
          b.vel.z *= 0.85;
        }
      }
    }
    b.malla.rotation.x -= b.vel.z * dt * 4;
    b.malla.rotation.z += b.vel.x * dt * 4;
  }

  function canasta(b) {
    meneoRed = 1;
    ctx.sonido('red');
    if (estado !== 'jugando') return;
    canastas += 1;
    racha += 1;
    let valor = b.toco ? 2 : 3;
    if (racha >= 3) valor *= 2;
    puntos += valor;
    ctx.sonido('punto');
    for (const m of ctx.manos) ctx.vibrar(m, 0.4, 60);
    if (racha >= 3) avisar(`¡En racha! ${racha} seguidas · +${valor}`);
    else if (!b.toco) avisar(`¡Limpia! +${valor}`);
    else avisar(`¡Canasta! +${valor}`);
  }

  // ─── Soportes de balones ───────────────────────────────────────────────
  function actualizarPuestos(dt) {
    const vr = ctx.enVR();
    for (const p of puestos) {
      if (p.vr !== vr) {
        if (p.balon) {
          raiz.remove(p.balon);
          p.balon = null;
        }
        continue;
      }
      if (!p.balon) {
        p.recarga -= dt;
        if (p.recarga <= 0) {
          p.balon = crearBalon();
          p.balon.position.copy(p.pos);
          raiz.add(p.balon);
        }
      }
    }
  }

  function tomarDePuesto(puesto) {
    const balon = puesto.balon;
    puesto.balon = null;
    puesto.recarga = 0.4;
    return balon;
  }

  // ─── Manos VR ──────────────────────────────────────────────────────────
  function velocidadMano(m) {
    // Media de los últimos ~80 ms para que el lanzamiento no dependa de un solo fotograma
    const h = m.historial;
    let tiempo = 0;
    let i = h.length - 1;
    while (i > 0 && tiempo < 0.08) {
      tiempo += h[i].dt;
      i--;
    }
    if (tiempo <= 0) return new THREE.Vector3();
    return h[h.length - 1].pos.clone().sub(h[i].pos).divideScalar(tiempo);
  }

  function manosVR(dt) {
    for (const m of manos) {
      const mano = m.mano;
      if (!mano.activa) {
        if (m.balon) {
          raiz.remove(m.balon);
          m.balon = null;
        }
        m.historial.length = 0;
        continue;
      }
      m.historial.push({ pos: mano.posicion.clone(), dt });
      if (m.historial.length > 12) m.historial.shift();

      const apretonPulsado = mano.apreton && !m.apretonAntes;
      m.apretonAntes = mano.apreton;

      if (!m.balon && (mano.gatilloPulsado || apretonPulsado)) {
        let mejor = null;
        let distancia = ALCANCE_AGARRE;
        for (const p of puestos) {
          if (!p.balon || !p.vr) continue;
          const d = p.balon.position.distanceTo(mano.posicion);
          if (d < distancia) {
            distancia = d;
            mejor = p;
          }
        }
        if (mejor) {
          m.balon = tomarDePuesto(mejor);
          ctx.vibrar(mano, 0.3, 30);
        }
      }

      if (m.balon) {
        mano.grip.localToWorld(m.balon.position.set(0, -0.02, -0.07));
        if (!mano.gatillo && !mano.apreton) {
          const vel = velocidadMano(m).multiplyScalar(FUERZA_VR);
          lanzar(m.balon, ayudar(m.balon.position, vel));
          m.balon = null;
        }
      }
    }
  }

  // ─── Ratón ─────────────────────────────────────────────────────────────
  function velocidadIdeal(origen) {
    const d = Math.hypot(ARO.x - origen.x, ARO.z - origen.z);
    const dy = ARO.y - origen.y;
    const c = Math.cos(ANGULO_RATON);
    const denominador = 2 * c * c * (d * Math.tan(ANGULO_RATON) - dy);
    return denominador > 0 ? Math.sqrt((G * d * d) / denominador) : V_MAX;
  }

  function raton(dt) {
    const puesto = puestos.find((p) => !p.vr);
    const r = ctx.raton;
    barra.visible = true;
    const ideal = (velocidadIdeal(PUESTO_RATON) - V_MIN) / (V_MAX - V_MIN);
    marca.position.y = THREE.MathUtils.clamp(ideal, 0, 1) * 0.4;

    if (r.clic && puesto.balon) {
      cargando = true;
      faseCarga = 0;
    }
    let carga = 0;
    if (cargando) {
      faseCarga += dt * 1.1;
      carga = 1 - Math.abs((faseCarga % 2) - 1); // sube y baja
      if (!r.pulsado) {
        cargando = false;
        if (puesto.balon) {
          // Dirección horizontal hacia donde apunta el ratón, con un ángulo fijo de tiro
          const dir = r.rayo.ray.direction;
          const horizontal = tmp.set(dir.x, 0, dir.z).normalize();
          const v = V_MIN + carga * (V_MAX - V_MIN);
          const vel = horizontal.multiplyScalar(v * Math.cos(ANGULO_RATON));
          vel.y = v * Math.sin(ANGULO_RATON);
          lanzar(tomarDePuesto(puesto), vel);
        }
        carga = 0;
      }
    }
    relleno.scale.y = Math.max(0.001, carga);
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function empezar() {
    estado = 'jugando';
    puntos = 0;
    canastas = 0;
    lanzamientos = 0;
    racha = 0;
    tiempoRestante = DURACION;
  }

  function actualizar(dt, t) {
    reloj -= dt;
    tiempoMensaje -= dt;

    if (estado === 'intro' && reloj <= 0) {
      empezar();
    } else if (estado === 'jugando') {
      tiempoRestante -= dt;
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

    actualizarPuestos(dt);
    if (ctx.enVR()) {
      barra.visible = false;
      cargando = false;
      manosVR(dt);
    } else {
      raton(dt);
    }

    for (let i = enVuelo.length - 1; i >= 0; i--) {
      const b = enVuelo[i];
      moverBalon(b, dt);
      b.vida -= dt;
      if (b.vida <= 0) {
        // Si no entró, se rompe la racha
        if (!b.anotado && estado === 'jugando') racha = 0;
        raiz.remove(b.malla);
        enVuelo.splice(i, 1);
      } else if (!b.anotado && b.malla.position.y < 1 && b.vel.y < 0 && b.malla.position.z < -1) {
        // Ya ha caído sin entrar: fallo (la racha se pierde una sola vez)
        if (!b.fallado && estado === 'jugando') racha = 0;
        b.fallado = true;
      }
    }

    // La red se menea al entrar el balón
    meneoRed = Math.max(0, meneoRed - dt * 2.5);
    red.scale.set(1 - meneoRed * 0.15, 1 + Math.sin(t * 30) * meneoRed * 0.15, 1 - meneoRed * 0.15);

    actualizarMarcador();
  }

  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      enVuelo.length = 0;
    },
  };
}
