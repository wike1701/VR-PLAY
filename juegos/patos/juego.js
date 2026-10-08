// CAZA DE PATOS (con arco)
// Los patos cruzan el cielo sobre el estanque. En VR sujetas el arco con una
// mano, agarras la cuerda con la otra (gatillo), tensas y sueltas. Sin gafas:
// mantén pulsado el ratón para tensar y suelta para disparar.
// Rondas de 60 segundos.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const DURACION = 60;
const GRAVEDAD = 4;           // más suave que la real para que sea divertido
const LARGO_FLECHA = 0.75;
const CUERDA_Z = 0.09;        // la cuerda en reposo, por detrás del puño del arco
const ALCANCE_AGARRE = 0.25;  // distancia a la cuerda para poder agarrarla
const TENSION_MAX = 0.6;      // metros de tensado para la potencia máxima
const RADIO_PATO = 0.38;
const LIMITE_X = 20;

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  ctx.fondo(0x8ec5e8);
  // Los patos vuelan lejos: alejamos la niebla mientras dura este juego
  const niebla = ctx.escena.fog;
  const nieblaOriginal = { near: niebla.near, far: niebla.far };
  niebla.near = 22;
  niebla.far = 50;

  const vistaPos = new THREE.Vector3(0, 1.6, 0.4);
  ctx.vistaEscritorio(vistaPos, new THREE.Vector3(0, 3, -12));

  // ─── Estanque y juncos ─────────────────────────────────────────────────
  const agua = new THREE.Mesh(R(new THREE.PlaneGeometry(60, 34)), R(new THREE.MeshLambertMaterial({ color: 0x3a7ca5 })));
  agua.rotation.x = -Math.PI / 2;
  agua.position.set(0, 0.004, -21);
  raiz.add(agua);
  const geoJunco = R(new THREE.CylinderGeometry(0.02, 0.03, 1, 5));
  geoJunco.translate(0, 0.5, 0);
  const matJunco = R(new THREE.MeshLambertMaterial({ color: 0x558b2f }));
  for (let i = 0; i < 70; i++) {
    const junco = new THREE.Mesh(geoJunco, matJunco);
    junco.position.set((Math.random() - 0.5) * 30, 0, -4 - Math.random() * 1.2);
    junco.scale.y = 0.6 + Math.random() * 0.9;
    junco.rotation.z = (Math.random() - 0.5) * 0.3;
    raiz.add(junco);
  }

  // ─── Patos ─────────────────────────────────────────────────────────────
  // Se construyen mirando a +Z y se orientan con lookAt hacia donde vuelan.
  const geoCuerpo = R(new THREE.SphereGeometry(0.2, 14, 10));
  geoCuerpo.scale(0.85, 0.75, 1.3);
  const geoCabeza = R(new THREE.SphereGeometry(0.11, 12, 8));
  const geoPico = R(new THREE.ConeGeometry(0.04, 0.12, 8));
  geoPico.rotateX(Math.PI / 2);
  const geoOjo = R(new THREE.SphereGeometry(0.018, 6, 4));
  const geoAla = R(new THREE.BoxGeometry(0.34, 0.025, 0.2));
  geoAla.translate(0.17, 0, 0);
  const geoPluma = R(new THREE.PlaneGeometry(0.06, 0.03));

  const matPato = R(new THREE.MeshLambertMaterial({ color: 0x8d6e63 }));
  const matDorado = R(new THREE.MeshLambertMaterial({ color: 0xffc400, emissive: 0x553300 }));
  const matCuello = R(new THREE.MeshLambertMaterial({ color: 0x2e7d32 }));
  const matPico = R(new THREE.MeshLambertMaterial({ color: 0xffa000 }));
  const matOjo = R(new THREE.MeshBasicMaterial({ color: 0x111111 }));
  const matAla = R(new THREE.MeshLambertMaterial({ color: 0x6d4c41 }));
  const matPluma = R(new THREE.MeshBasicMaterial({ color: 0xfafafa, side: THREE.DoubleSide }));

  function crearPato(dorado) {
    const grupo = new THREE.Group();
    const material = dorado ? matDorado : matPato;
    grupo.add(new THREE.Mesh(geoCuerpo, material));
    const cabeza = new THREE.Mesh(geoCabeza, dorado ? matDorado : matCuello);
    cabeza.position.set(0, 0.14, 0.26);
    const pico = new THREE.Mesh(geoPico, matPico);
    pico.position.set(0, 0.12, 0.39);
    grupo.add(cabeza, pico);
    for (const lado of [-1, 1]) {
      const ojo = new THREE.Mesh(geoOjo, matOjo);
      ojo.position.set(lado * 0.07, 0.18, 0.32);
      grupo.add(ojo);
    }
    const alas = [-1, 1].map((lado) => {
      const ala = new THREE.Mesh(geoAla, dorado ? matDorado : matAla);
      ala.position.set(lado * 0.1, 0.06, 0);
      ala.scale.x = lado; // el ala izquierda es la derecha reflejada
      grupo.add(ala);
      return ala;
    });
    return { grupo, alas };
  }

  // ─── Arco ──────────────────────────────────────────────────────────────
  // En el espacio del mando: -Z hacia delante, las palas del arco arriba y abajo.
  const curvaArco = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.5, CUERDA_Z),
    new THREE.Vector3(0, -0.28, -0.02),
    new THREE.Vector3(0, 0, -0.05),
    new THREE.Vector3(0, 0.28, -0.02),
    new THREE.Vector3(0, 0.5, CUERDA_Z),
  ]);
  const geoArco = R(new THREE.TubeGeometry(curvaArco, 24, 0.016, 6));
  const geoPuno = R(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 8));
  const matArco = R(new THREE.MeshLambertMaterial({ color: 0x795548 }));
  const matPuno = R(new THREE.MeshLambertMaterial({ color: 0x3e2723 }));
  const matCuerda = R(new THREE.LineBasicMaterial({ color: 0xf5f5f5 }));

  const geoAsta = R(new THREE.CylinderGeometry(0.01, 0.01, LARGO_FLECHA, 6));
  geoAsta.rotateX(Math.PI / 2);
  const geoPunta = R(new THREE.ConeGeometry(0.025, 0.1, 8));
  geoPunta.rotateX(Math.PI / 2);
  const geoTimon = R(new THREE.PlaneGeometry(0.12, 0.05));
  geoTimon.rotateY(Math.PI / 2);
  const matAsta = R(new THREE.MeshLambertMaterial({ color: 0xd7b98e }));
  const matPunta = R(new THREE.MeshLambertMaterial({ color: 0xb0bec5, emissive: 0x263238 }));
  const matTimon = R(new THREE.MeshBasicMaterial({ color: 0xe53935, side: THREE.DoubleSide }));

  // Flecha construida apuntando a +Z, centrada en su mitad
  function crearFlecha() {
    const g = new THREE.Group();
    const punta = new THREE.Mesh(geoPunta, matPunta);
    punta.position.z = LARGO_FLECHA / 2 + 0.04;
    g.add(new THREE.Mesh(geoAsta, matAsta), punta);
    for (const giro of [0, Math.PI / 2]) {
      const timon = new THREE.Mesh(geoTimon, matTimon);
      timon.rotation.z = giro;
      timon.position.z = -LARGO_FLECHA / 2 + 0.07;
      g.add(timon);
    }
    return g;
  }

  function crearArco() {
    const arco = new THREE.Group();
    arco.add(new THREE.Mesh(geoArco, matArco), new THREE.Mesh(geoPuno, matPuno));
    const puntos = new Float32Array([0, 0.5, CUERDA_Z, 0, 0, CUERDA_Z, 0, -0.5, CUERDA_Z]);
    const geoCuerda = new THREE.BufferGeometry();
    geoCuerda.setAttribute('position', new THREE.BufferAttribute(puntos, 3));
    const cuerda = new THREE.Line(geoCuerda, matCuerda);
    cuerda.frustumCulled = false;
    arco.add(cuerda);
    // Mueve el centro de la cuerda (coordenadas locales del arco)
    const tensar = (x, y, z) => {
      puntos[3] = x; puntos[4] = y; puntos[5] = z;
      geoCuerda.attributes.position.needsUpdate = true;
    };
    return { arco, tensar };
  }

  // Un arco en cada mano; solo se ve el de la mano que sujeta el arco
  const arcos = ctx.manos.map((mano) => {
    const a = crearArco();
    ctx.adjuntarAMano(mano, a.arco);
    return { ...a, mano };
  });
  let indiceArco = null;       // qué mano lleva el arco (se decide al conocer los mandos)
  let tensando = false;        // la otra mano tiene agarrada la cuerda
  let apretonAntes = false;
  let ultimaVibracion = 0;
  const flechaCargada = crearFlecha();
  flechaCargada.visible = false;
  raiz.add(flechaCargada);

  // Arco del modo escritorio, delante de la cámara
  const arcoRaton = crearArco();
  arcoRaton.arco.scale.setScalar(0.55);
  const flechaRaton = crearFlecha();
  flechaRaton.rotation.y = Math.PI; // dentro del arco, apuntando a -Z
  arcoRaton.arco.add(flechaRaton);
  const pivote = new THREE.Group();
  pivote.add(arcoRaton.arco);
  pivote.position.copy(vistaPos).add(new THREE.Vector3(0.05, -0.3, -0.7));
  raiz.add(pivote);
  let cargaRaton = 0;
  let tensandoRaton = false;

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.3, alto: 0.36 });
  marcador.mesh.position.set(0, 0.95, -2.6);
  marcador.mesh.rotation.x = -0.35;
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  const patos = [];
  const flechas = [];
  const particulas = [];
  let puntos = 0;
  let record = ctx.leer('record', 0);
  let estado = 'intro'; // 'intro' | 'jugando' | 'fin'
  let reloj = 3;
  let tiempoRestante = DURACION;
  let proximoPato = 0;
  let disparos = 0;
  let aciertos = 0;
  let mensaje = '';
  let tiempoMensaje = 0;

  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const tmp3 = new THREE.Vector3();
  const tramo = new THREE.Line3();

  function actualizarMarcador() {
    if (estado === 'intro') {
      marcador.escribir([
        { texto: 'CAZA DE PATOS', tam: 1.3, color: '#ffe082' },
        {
          texto: ctx.enVR() ? 'Agarra la cuerda con el gatillo, tensa y suelta' : 'Mantén pulsado para tensar y suelta para disparar',
          tam: 0.7,
        },
      ]);
    } else if (estado === 'fin') {
      const punteria = disparos ? Math.round((aciertos / disparos) * 100) : 0;
      marcador.escribir([
        { texto: `¡Tiempo! ${puntos} puntos`, tam: 1.3, color: '#ffe082' },
        { texto: `Puntería ${punteria}% · Récord: ${record} · otra en ${Math.ceil(reloj)}`, tam: 0.7 },
      ]);
    } else {
      marcador.escribir([
        { texto: `Puntos: ${puntos}   ·   ${Math.ceil(tiempoRestante)} s`, tam: 1.3 },
        tiempoMensaje > 0
          ? { texto: mensaje, tam: 0.7, color: '#fff59d' }
          : { texto: `Récord: ${record}   ·   dorados +5   ·   lejanos +1`, tam: 0.7, color: '#ffe082' },
      ]);
    }
  }

  function avisar(texto) {
    mensaje = texto;
    tiempoMensaje = 1.2;
  }

  // ─── Patos ─────────────────────────────────────────────────────────────
  function soltarPato(progreso) {
    const dorado = Math.random() < 0.1;
    const { grupo, alas } = crearPato(dorado);
    const sentido = Math.random() < 0.5 ? 1 : -1;
    const z = -8 - Math.random() * 12;
    grupo.position.set(-sentido * LIMITE_X, 2.5 + Math.random() * 4, z);
    const rapidez = (2.2 + progreso * 2.5 + Math.random() * 1.2) * (dorado ? 1.6 : 1);
    const vel = new THREE.Vector3(sentido * rapidez, 0, (Math.random() - 0.5) * 0.8);
    raiz.add(grupo);
    patos.push({ grupo, alas, vel, dorado, cayendo: false, fase: Math.random() * 10, altura: grupo.position.y });
    if (Math.random() < 0.5) ctx.sonido('cuac');
  }

  function cazar(pato) {
    pato.cayendo = true;
    pato.vel.multiplyScalar(0.3);
    pato.vel.y = 1.5;
    aciertos += 1;
    const lejos = -pato.grupo.position.z > 15;
    const valor = pato.dorado ? 5 : 1 + (lejos ? 1 : 0);
    puntos += valor;
    if (pato.dorado) avisar('¡Pato dorado! +5');
    else if (lejos) avisar('¡Tiro lejano! +2');
    ctx.sonido('golpe');
    ctx.sonido('cuac');
    ctx.sonido('punto');
    for (let i = 0; i < 12; i++) {
      const p = new THREE.Mesh(geoPluma, matPluma);
      p.position.copy(pato.grupo.position);
      const vel = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.6, Math.random() - 0.5).multiplyScalar(3);
      raiz.add(p);
      particulas.push({ malla: p, vel, vida: 1.2, giro: (Math.random() - 0.5) * 12 });
    }
  }

  function actualizarPatos(dt, t) {
    for (let i = patos.length - 1; i >= 0; i--) {
      const p = patos[i];
      const g = p.grupo;
      if (p.cayendo) {
        p.vel.y -= 9.8 * dt;
        g.position.addScaledVector(p.vel, dt);
        g.rotation.x += 6 * dt;
        g.rotation.z += 4 * dt;
        if (g.position.y < 0) quitarPato(i);
        continue;
      }
      g.position.addScaledVector(p.vel, dt);
      g.position.y = p.altura + Math.sin(t * 1.5 + p.fase) * 0.3;
      g.lookAt(tmp.copy(g.position).add(p.vel));
      const aleteo = Math.sin(t * 14 + p.fase) * 0.7;
      p.alas[0].rotation.z = -aleteo;
      p.alas[1].rotation.z = aleteo;
      if (Math.abs(g.position.x) > LIMITE_X + 1) quitarPato(i);
    }
  }

  function quitarPato(i) {
    raiz.remove(patos[i].grupo);
    patos.splice(i, 1);
  }

  // ─── Flechas ───────────────────────────────────────────────────────────
  function lanzarFlecha(origen, direccion, rapidez) {
    disparos += 1;
    const malla = crearFlecha();
    malla.position.copy(origen).addScaledVector(direccion, LARGO_FLECHA / 2);
    malla.lookAt(tmp.copy(malla.position).add(direccion));
    raiz.add(malla);
    flechas.push({
      malla,
      vel: direccion.clone().multiplyScalar(rapidez),
      punta: malla.position.clone().addScaledVector(direccion, LARGO_FLECHA / 2 + 0.08),
      anterior: new THREE.Vector3(),
      clavada: 0,
    });
    ctx.sonido('arco');
  }

  function actualizarFlechas(dt) {
    for (let i = flechas.length - 1; i >= 0; i--) {
      const f = flechas[i];
      if (f.clavada > 0) {
        f.clavada -= dt;
        if (f.clavada <= 0) quitarFlecha(i);
        continue;
      }
      f.vel.y -= GRAVEDAD * dt;
      f.anterior.copy(f.punta);
      f.punta.addScaledVector(f.vel, dt);
      f.malla.position.addScaledVector(f.vel, dt);
      f.malla.lookAt(tmp.copy(f.malla.position).add(f.vel));

      // ¿Ha atravesado algún pato en este fotograma?
      tramo.set(f.anterior, f.punta);
      let acerto = false;
      for (const p of patos) {
        if (p.cayendo) continue;
        if (tramo.closestPointToPoint(p.grupo.position, true, tmp2).distanceTo(p.grupo.position) < RADIO_PATO) {
          if (estado === 'jugando') cazar(p);
          acerto = true;
          break;
        }
      }
      if (acerto) {
        quitarFlecha(i);
      } else if (f.punta.y <= 0.02) {
        f.clavada = 2; // se queda clavada en el suelo o en el agua
      } else if (f.malla.position.lengthSq() > 60 * 60) {
        quitarFlecha(i);
      }
    }
  }

  function quitarFlecha(i) {
    raiz.remove(flechas[i].malla);
    flechas.splice(i, 1);
  }

  // ─── Arco con los mandos VR ────────────────────────────────────────────
  function arcoVR(dt) {
    const activas = ctx.manos.filter((m) => m.activa);
    // Por defecto el arco va en la mano izquierda (o en la primera que aparezca)
    if (indiceArco === null || !ctx.manos[indiceArco].activa) {
      const izquierda = activas.find((m) => m.lado === 'left') || activas[0];
      if (izquierda) indiceArco = izquierda.indice;
    }
    const arco = indiceArco === null ? null : arcos.find((a) => a.mano.indice === indiceArco);
    for (const a of arcos) a.arco.visible = a === arco;
    if (!arco) {
      flechaCargada.visible = false;
      return;
    }
    const manoCuerda = ctx.manos.find((m) => m !== arco.mano && m.activa);

    // El botón de agarre de la mano libre cambia el arco de mano (para zurdos)
    const apreton = !!manoCuerda?.apreton;
    if (apreton && !apretonAntes && !tensando) {
      indiceArco = manoCuerda.indice;
      apretonAntes = apreton;
      return;
    }
    apretonAntes = apreton;

    const reposo = arco.arco.localToWorld(tmp.set(0, 0, CUERDA_Z));
    const reposoMundo = tmp3.copy(reposo);
    if (!tensando && manoCuerda?.gatilloPulsado && manoCuerda.posicion.distanceTo(reposoMundo) < ALCANCE_AGARRE) {
      tensando = true;
      ctx.sonido('tic');
    }

    if (tensando && manoCuerda) {
      const tension = Math.min(TENSION_MAX, manoCuerda.posicion.distanceTo(reposoMundo));
      const fuerza = tension / TENSION_MAX;
      // La cuerda va hasta la mano (en coordenadas del arco)
      const local = arco.arco.worldToLocal(tmp.copy(manoCuerda.posicion));
      arco.tensar(local.x, local.y, local.z);

      // La flecha va de la mano hacia el puño del arco
      const puno = arco.arco.localToWorld(tmp2.set(0, 0, 0));
      const direccion = puno.sub(manoCuerda.posicion).normalize();
      flechaCargada.visible = true;
      flechaCargada.position.copy(manoCuerda.posicion).addScaledVector(direccion, LARGO_FLECHA / 2);
      flechaCargada.lookAt(tmp.copy(flechaCargada.position).add(direccion));

      ultimaVibracion -= dt;
      if (ultimaVibracion <= 0) {
        ctx.vibrar(manoCuerda, 0.05 + fuerza * 0.3, 20);
        ultimaVibracion = 0.08;
      }

      if (!manoCuerda.gatillo) {
        tensando = false;
        flechaCargada.visible = false;
        arco.tensar(0, 0, CUERDA_Z);
        if (fuerza > 0.2) {
          lanzarFlecha(manoCuerda.posicion, direccion, 10 + fuerza * 30);
          ctx.vibrar(arco.mano, 0.8, 60);
        }
      }
    } else {
      tensando = false;
      flechaCargada.visible = false;
      arco.tensar(0, 0, CUERDA_Z);
    }
  }

  // ─── Arco con el ratón ─────────────────────────────────────────────────
  function arcoRatonActualizar(dt) {
    const raton = ctx.raton;
    pivote.visible = raton.dentro || tensandoRaton;
    const objetivo = raton.rayo.ray.at(20, tmp);
    pivote.lookAt(tmp2.copy(pivote.position).multiplyScalar(2).sub(objetivo));

    if (raton.clic) tensandoRaton = true;
    if (tensandoRaton) cargaRaton = Math.min(1, cargaRaton + dt / 0.7);

    if (tensandoRaton && !raton.pulsado) {
      if (cargaRaton > 0.15) {
        const direccion = raton.rayo.ray.direction.clone();
        lanzarFlecha(tmp3.copy(raton.rayo.ray.origin).addScaledVector(direccion, 0.4), direccion, 12 + cargaRaton * 26);
      }
      tensandoRaton = false;
      cargaRaton = 0;
    }

    // Cuerda y flecha según la carga (coordenadas locales del arco)
    const zCuerda = CUERDA_Z + cargaRaton * 0.35;
    arcoRaton.tensar(0, 0, zCuerda);
    flechaRaton.visible = tensandoRaton;
    flechaRaton.position.z = zCuerda - LARGO_FLECHA / 2;
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function empezar() {
    estado = 'jugando';
    puntos = 0;
    disparos = 0;
    aciertos = 0;
    tiempoRestante = DURACION;
    proximoPato = 0.3;
  }

  function actualizar(dt, t) {
    reloj -= dt;
    tiempoMensaje -= dt;

    if (estado === 'intro' && reloj <= 0) {
      empezar();
    } else if (estado === 'jugando') {
      tiempoRestante -= dt;
      const progreso = 1 - tiempoRestante / DURACION;
      proximoPato -= dt;
      const maxPatos = 2 + Math.floor(progreso * 3.5);
      if (proximoPato <= 0 && patos.filter((p) => !p.cayendo).length < maxPatos) {
        soltarPato(progreso);
        proximoPato = 1.5 - progreso * 0.8 + Math.random() * 0.5;
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

    actualizarPatos(dt, t);
    actualizarFlechas(dt);

    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      p.vida -= dt;
      p.vel.y -= 2 * dt;
      p.vel.multiplyScalar(1 - dt * 1.5);
      p.malla.position.addScaledVector(p.vel, dt);
      p.malla.rotation.x += p.giro * dt;
      p.malla.rotation.y += p.giro * dt;
      if (p.vida <= 0) {
        raiz.remove(p.malla);
        particulas.splice(i, 1);
      }
    }

    if (ctx.enVR()) {
      pivote.visible = false;
      arcoVR(dt);
    } else {
      for (const a of arcos) a.arco.visible = false;
      flechaCargada.visible = false;
      tensando = false;
      arcoRatonActualizar(dt);
    }

    actualizarMarcador();
  }

  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      niebla.near = nieblaOriginal.near;
      niebla.far = nieblaOriginal.far;
      patos.length = 0;
      flechas.length = 0;
      particulas.length = 0;
    },
  };
}
