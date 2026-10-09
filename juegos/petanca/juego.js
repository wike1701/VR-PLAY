// PETANCA
// Partida contra la máquina con las reglas de siempre: 3 bolas cada uno, tira
// quien no tiene el punto y, al acabar la mano, puntúa quien está más cerca del
// boliche (1 punto por cada bola mejor que la mejor del rival). Gana quien llega a 7.
// En VR coges la bola del soporte y la lanzas con el brazo; sin gafas haces clic
// donde quieres que caiga (después rueda un poco).
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const PUNTOS_VICTORIA = 7;
const BOLAS = 3;
const G = 9.8;
const R_BOLA = 0.045;         // algo más grandes que las reales para verlas bien en VR
const R_BOLICHE = 0.022;
const MASA_BOLA = 1;
const MASA_BOLICHE = 0.2;
const ANCHO = 4;              // pista: de Z_DELANTE a Z_FONDO, de -ANCHO/2 a ANCHO/2
const Z_DELANTE = -0.6;
const Z_FONDO = -12.5;
const ALTO_BORDE = 0.1;
const IMPACTO = 0.35;         // velocidad horizontal que conserva la bola al caer en la grava
const ROZAMIENTO = 0.5;       // frenado al rodar por la grava
const REBOTE_BOLAS = 0.7;     // las bolas de acero rebotan bastante entre sí
const ANGULO = THREE.MathUtils.degToRad(45);
const FUERZA_VR = 1.1;
const FALLO_MAQUINA = 1.6;    // cuánto falla la máquina (1 = como al principio; más alto = más fácil ganarla)
const ALCANCE_AGARRE = 0.22;
const ORIGEN = new THREE.Vector3(0.2, 1.0, -0.35);     // desde donde se lanza con ratón y la máquina
const SOPORTE = new THREE.Vector3(0.25, 0.95, -0.28);  // donde espera tu bola en VR

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  ctx.fondo(0x9cc9e6);
  const niebla = ctx.escena.fog;
  const nieblaOriginal = { near: niebla.near, far: niebla.far };
  niebla.near = 16;
  niebla.far = 40;
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.75, 0.9), new THREE.Vector3(0, 0, -7));

  // ─── Suelo: césped alrededor de la pista ───────────────────────────────
  ctx.sueloBase(false);
  const texCesped = R(ctx.texturas.cesped(0x5d9a45, { tam: 512, repetir: [26, 26], semilla: 7 }));
  const cesped = new THREE.Mesh(R(new THREE.PlaneGeometry(72, 72)), R(new THREE.MeshLambertMaterial({ map: texCesped })));
  cesped.rotation.x = -Math.PI / 2;
  cesped.position.z = -6;
  raiz.add(cesped);

  // ─── Pista ─────────────────────────────────────────────────────────────
  const largo = Z_DELANTE - Z_FONDO;
  // Grava en textura (antes eran cientos de piedrecitas sueltas): cada mosaico mide 1 m
  const texGrava = R(ctx.texturas.grano(0xcdb38b, {
    tam: 512, repetir: [ANCHO, largo], semilla: 3, cantidad: 14000, tamMin: 1, tamMax: 3.2, contraste: 0.26,
  }));
  const grava = new THREE.Mesh(R(new THREE.PlaneGeometry(ANCHO, largo)), R(new THREE.MeshLambertMaterial({
    map: texGrava, polygonOffset: true, polygonOffsetFactor: -1, polygonOffsetUnits: -1,
  })));
  grava.rotation.x = -Math.PI / 2;
  grava.position.set(0, 0.004, (Z_DELANTE + Z_FONDO) / 2);
  raiz.add(grava);
  // Bordes de tablón: la veta va a lo largo de cada tablón
  const matMadera = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.madera(0x8d6e63, { repetir: [3, 1], semilla: 5 })) }));
  const matBordeLargo = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.madera(0x8d6e63, { repetir: [9, 1], semilla: 5 })) }));
  const bordes = [
    [ANCHO + 0.2, 0, Z_FONDO - 0.05, false],
    [ANCHO + 0.2, 0, Z_DELANTE + 0.05, false],
    [largo, -ANCHO / 2 - 0.05, (Z_DELANTE + Z_FONDO) / 2, true],
    [largo, ANCHO / 2 + 0.05, (Z_DELANTE + Z_FONDO) / 2, true],
  ];
  for (const [longitud, x, z, lateral] of bordes) {
    const b = new THREE.Mesh(R(new THREE.BoxGeometry(longitud, ALTO_BORDE, 0.1)), lateral ? matBordeLargo : matMadera);
    if (lateral) b.rotation.y = Math.PI / 2;
    b.position.set(x, ALTO_BORDE / 2, z);
    raiz.add(b);
  }
  // Círculo de lanzamiento
  const circulo = new THREE.Mesh(R(new THREE.RingGeometry(0.22, 0.25, 32)), R(new THREE.MeshBasicMaterial({ color: 0xff7043 })));
  circulo.rotation.x = -Math.PI / 2;
  circulo.position.y = 0.006;
  raiz.add(circulo);

  // ─── Árboles de fondo (instanciados: pocas llamadas de dibujo) ─────────
  const pinos = [[-4, -6], [4.2, -9], [-3.8, -12], [3.6, -3.5], [-4.4, -2], [0.5, -15], [-2, -15.5], [3, -14],
    [-6.5, -9], [6.8, -6], [-7, -14.5], [6.5, -13], [5.5, -17.5], [-5, -18]];
  const redondos = [[-5.6, -4.5], [5.8, -2.2], [-2.6, -18.5], [2.4, -18], [7.5, -10], [-7.8, -7]];
  const matriz = new THREE.Matrix4();
  const posI = new THREE.Vector3();
  const escI = new THREE.Vector3();
  const giroI = new THREE.Quaternion();
  const colorI = new THREE.Color();
  const instanciar = (geo, mat, lista, colocar, colorear = false) => {
    const malla = new THREE.InstancedMesh(geo, mat, lista.length);
    lista.forEach(([x, z], i) => {
      const s = 0.85 + ((i * 37) % 10) / 25;
      colocar(x, z, s);
      matriz.compose(posI, giroI.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, i * 1.7), escI);
      malla.setMatrixAt(i, matriz);
      // Cada copa con un verde algo distinto
      if (colorear) malla.setColorAt(i, colorI.setHSL(0.26 + ((i * 13) % 7) / 100, 0.5, 0.15 + ((i * 7) % 5) / 80));
    });
    raiz.add(malla);
  };
  const matTronco = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.madera(0x6d4c41, { tam: 128, repetir: [1, 2], semilla: 9 })) }));
  const matCopa = R(new THREE.MeshLambertMaterial({ color: 0xffffff }));
  const geoTronco = R(new THREE.CylinderGeometry(0.1, 0.15, 1, 7).translate(0, 0.5, 0));
  const todos = [...pinos, ...redondos];
  instanciar(geoTronco, matTronco, todos, (x, z, s) => { posI.set(x, 0, z); escI.set(s, 0.9 * s, s); });
  // Pinos: dos pisos de copa
  instanciar(R(new THREE.ConeGeometry(0.95, 1.9, 10).translate(0, 0.95, 0)), matCopa, pinos, (x, z, s) => { posI.set(x, 0.7 * s, z); escI.setScalar(s); }, true);
  instanciar(R(new THREE.ConeGeometry(0.7, 1.5, 10).translate(0, 0.75, 0)), matCopa, pinos, (x, z, s) => { posI.set(x, 1.8 * s, z); escI.setScalar(s); }, true);
  // Árboles de hoja: copa redondeada
  instanciar(R(new THREE.IcosahedronGeometry(1, 1)), matCopa, redondos, (x, z, s) => { posI.set(x, 1.9 * s, z); escI.set(1.1 * s, s, 1.1 * s); }, true);
  // Manchas de sombra bajo los árboles
  // (geometría y degradado de las sombras de la shell; el material es nuestro)
  const sombraArbol = ctx.crearSombra({ opacidad: 0.4 });
  R(sombraArbol.material);
  instanciar(sombraArbol.geometry, sombraArbol.material, todos, (x, z, s) => { posI.set(x, 0.006, z); escI.set(2.6 * s, 1, 2.6 * s); });

  // ─── Bolas ─────────────────────────────────────────────────────────────
  // Acero pulido (tuyas) y bronce (máquina): reflejan el cielo gracias al entorno de la shell
  const geoBola = R(new THREE.SphereGeometry(R_BOLA, 28, 18));
  const geoEstria = R(new THREE.TorusGeometry(R_BOLA * 1.003, 0.0025, 4, 32));
  const geoBoliche = R(new THREE.SphereGeometry(R_BOLICHE, 18, 12));
  const materiales = {
    jugador: R(new THREE.MeshStandardMaterial({ color: 0xd4dae2, metalness: 0.9, roughness: 0.28 })),
    maquina: R(new THREE.MeshStandardMaterial({ color: 0xc27a45, metalness: 0.85, roughness: 0.32 })),
  };
  const matEstria = R(new THREE.MeshStandardMaterial({ color: 0x2b3238, metalness: 0.6, roughness: 0.6 }));
  // Boliche de madera barnizada
  const matBoliche = R(new THREE.MeshStandardMaterial({ color: 0xffb300, emissive: 0x2a1a00, roughness: 0.4 }));

  // Sombras de mancha: una por cuerpo en la pista (6 bolas + boliche, y una de reserva)
  const sombras = [];
  for (let i = 0; i < BOLAS * 2 + 2; i++) {
    const s = ctx.crearSombra({ radio: R_BOLA * 1.1, opacidad: 0.55 });
    s.visible = false;
    raiz.add(s);
    sombras.push(s);
  }
  function colocarSombras() {
    for (let i = 0; i < sombras.length; i++) {
      const s = sombras[i];
      const c = cuerpos[i];
      if (!c) {
        s.visible = false;
        continue;
      }
      s.userData.radio = c.r * 1.1;
      ctx.colocarSombra(s, c.malla.position, 0.004);
    }
  }

  function crearBola(equipo) {
    const malla = new THREE.Mesh(geoBola, materiales[equipo]);
    for (const giro of [0, Math.PI / 2]) {
      const e = new THREE.Mesh(geoEstria, matEstria);
      e.rotation.y = giro;
      malla.add(e);
    }
    return malla;
  }

  const cuerpos = []; // bolas en la pista y el boliche: { malla, vel, r, masa, equipo }
  function anadirCuerpo(malla, equipo, vel) {
    const c = { malla, vel: vel.clone(), r: equipo === 'boliche' ? R_BOLICHE : R_BOLA, masa: equipo === 'boliche' ? MASA_BOLICHE : MASA_BOLA, equipo };
    raiz.add(malla);
    cuerpos.push(c);
    return c;
  }

  // Anillo en el suelo bajo la bola que tiene el punto
  const anilloPunto = new THREE.Mesh(R(new THREE.RingGeometry(0.065, 0.085, 28)), R(new THREE.MeshBasicMaterial({ color: 0x00e5ff })));
  anilloPunto.rotation.x = -Math.PI / 2;
  anilloPunto.position.y = 0.008;
  anilloPunto.visible = false;
  raiz.add(anilloPunto);

  // Marca de dónde caerá la bola (ratón)
  const mira = new THREE.Mesh(R(new THREE.RingGeometry(0.07, 0.1, 24)), R(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.8 })));
  mira.rotation.x = -Math.PI / 2;
  mira.position.y = 0.01;
  raiz.add(mira);
  const suelo = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // ─── Manos VR ──────────────────────────────────────────────────────────
  const geoMano = R(new THREE.SphereGeometry(0.045, 12, 8));
  geoMano.scale(1, 0.6, 1.3);
  const matMano = R(new THREE.MeshLambertMaterial({ color: 0xffcc80 }));
  const manos = ctx.manos.map((mano) => {
    ctx.adjuntarAMano(mano, new THREE.Mesh(geoMano, matMano));
    return { mano, historial: [], apretonAntes: false };
  });
  let bolaSoporte = null;   // bola esperando en el soporte (VR)
  let manoConBola = null;
  const soporte = new THREE.Mesh(R(new THREE.CylinderGeometry(0.05, 0.07, 0.05, 20)), R(new THREE.MeshStandardMaterial({ color: 0x546e7a, metalness: 0.5, roughness: 0.45 })));
  soporte.position.copy(SOPORTE).y -= R_BOLA + 0.025;
  raiz.add(soporte);

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.7, alto: 0.6 });
  raiz.add(marcador.mesh);
  // A un lado de la pista; en una pantalla vertical (móvil) no cabría: allí va centrado encima
  let marcadorVertical = null;
  function colocarMarcador() {
    const vertical = !ctx.enVR() && window.innerWidth < window.innerHeight;
    if (vertical === marcadorVertical) return;
    marcadorVertical = vertical;
    if (vertical) marcador.mesh.position.set(0, 2.1, -5);
    else marcador.mesh.position.set(-2.5, 1.5, -4);
    marcador.mesh.lookAt(0, vertical ? 1.75 : 1.5, 0);
  }
  colocarMarcador();

  // ─── Estado ────────────────────────────────────────────────────────────
  // 'intro' | 'jugador' | 'maquina' | 'rodando' | 'finMano' | 'finPartida'
  let estado = 'intro';
  let reloj = 3;
  const tanteo = { jugador: 0, maquina: 0 };
  const quedan = { jugador: BOLAS, maquina: BOLAS };
  let empieza = 'jugador';
  let boliche = null;
  let lanzada = null;       // último cuerpo lanzado
  let tiempoRodando = 0;
  let linea2 = '';
  let color2 = '#ffffff';
  let ganadas = ctx.leer('ganadas', 0);

  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const normal = new THREE.Vector3();

  const nombre = (equipo) => (equipo === 'jugador' ? 'ti' : 'la máquina');
  const distanciaBoliche = (c) => Math.hypot(c.malla.position.x - boliche.malla.position.x, c.malla.position.z - boliche.malla.position.z);

  function actualizarMarcador() {
    const lineas = [{ texto: `Tú ${tanteo.jugador}  –  ${tanteo.maquina} Máquina`, tam: 1.3 }];
    if (estado === 'intro') {
      lineas[0] = { texto: 'PETANCA', tam: 1.3, color: '#ffcc80' };
      lineas.push({ texto: `Acerca tus bolas al boliche · gana quien llegue a ${PUNTOS_VICTORIA}`, tam: 0.7 });
    } else if (estado === 'jugador') {
      lineas.push({ texto: linea2 || (ctx.enVR() ? 'Te toca: coge la bola y lánzala' : (ctx.tactil ? 'Te toca: toca donde quieres que caiga' : 'Te toca: haz clic donde quieres que caiga')), tam: 0.75, color: color2 });
    } else {
      lineas.push({ texto: linea2, tam: 0.75, color: color2 });
    }
    lineas.push({ texto: `Bolas: tú ${quedan.jugador} · máquina ${quedan.maquina}   ·   Partidas ganadas: ${ganadas}`, tam: 0.6, color: '#ffcc80' });
    marcador.escribir(lineas);
  }

  function decir(texto, color = '#ffffff') {
    linea2 = texto;
    color2 = color;
  }

  // ─── Manos (rondas) ────────────────────────────────────────────────────
  function nuevaMano() {
    for (const c of cuerpos) raiz.remove(c.malla);
    cuerpos.length = 0;
    quedan.jugador = BOLAS;
    quedan.maquina = BOLAS;
    const pos = new THREE.Vector3((Math.random() - 0.5) * 2, R_BOLICHE, -5.5 - Math.random() * 3);
    const malla = new THREE.Mesh(geoBoliche, matBoliche);
    malla.position.copy(pos);
    boliche = anadirCuerpo(malla, 'boliche', new THREE.Vector3());
    anilloPunto.visible = false;
    darTurno(empieza);
  }

  function darTurno(equipo) {
    estado = equipo;
    reloj = 1.4;
    if (equipo === 'maquina') decir('Tira la máquina…', '#ffab91');
    else decir('');
  }

  // Bola de cada equipo más cercana al boliche
  function masCercanas() {
    const mejor = { jugador: null, maquina: null };
    for (const c of cuerpos) {
      if (c.equipo === 'boliche') continue;
      const d = distanciaBoliche(c);
      if (!mejor[c.equipo] || d < mejor[c.equipo].d) mejor[c.equipo] = { c, d };
    }
    return mejor;
  }

  // Al pararse todo: quién tiene el punto y a quién le toca
  function trasLanzamiento() {
    const mejor = masCercanas();
    let punto = null;
    if (mejor.jugador && (!mejor.maquina || mejor.jugador.d < mejor.maquina.d)) punto = 'jugador';
    else if (mejor.maquina) punto = 'maquina';

    if (punto) {
      const c = mejor[punto].c;
      anilloPunto.visible = true;
      anilloPunto.position.set(c.malla.position.x, 0.008, c.malla.position.z);
      anilloPunto.material.color.setHex(punto === 'jugador' ? 0x00e5ff : 0xff7043);
    }

    if (quedan.jugador === 0 && quedan.maquina === 0) {
      puntuarMano(mejor);
      return;
    }
    // Tira quien NO tiene el punto; si ya no le quedan bolas, tira el otro
    let siguiente = punto === 'jugador' ? 'maquina' : 'jugador';
    if (quedan[siguiente] === 0) siguiente = siguiente === 'jugador' ? 'maquina' : 'jugador';
    darTurno(siguiente);
    if (punto) {
      const cm = Math.round(mejor[punto].d * 100);
      decir(`Punto para ${nombre(punto)} (a ${cm} cm)${siguiente === 'jugador' ? ' · te toca' : ' · tira la máquina'}`,
        punto === 'jugador' ? '#80deea' : '#ffab91');
    }
  }

  function puntuarMano(mejor) {
    const ganador = !mejor.maquina || (mejor.jugador && mejor.jugador.d < mejor.maquina.d) ? 'jugador' : 'maquina';
    const rival = ganador === 'jugador' ? 'maquina' : 'jugador';
    const limite = mejor[rival] ? mejor[rival].d : Infinity;
    const puntos = cuerpos.filter((c) => c.equipo === ganador && distanciaBoliche(c) < limite).length;
    tanteo[ganador] += puntos;
    empieza = ganador;
    if (ganador === 'jugador') {
      ctx.sonido('punto');
      for (const m of ctx.manos) ctx.vibrar(m, 0.4, 80);
    } else {
      ctx.sonido('fallo');
    }

    if (tanteo[ganador] >= PUNTOS_VICTORIA) {
      estado = 'finPartida';
      reloj = 7;
      if (ganador === 'jugador') {
        ganadas += 1;
        ctx.guardar('ganadas', ganadas);
        decir('¡HAS GANADO LA PARTIDA!', '#b9f6ca');
      } else {
        decir('Gana la máquina. ¡La próxima es tuya!', '#ff8a80');
      }
      ctx.sonido('fin');
    } else {
      estado = 'finMano';
      reloj = 3.5;
      decir(`${ganador === 'jugador' ? 'Te llevas' : 'La máquina se lleva'} ${puntos} punto${puntos > 1 ? 's' : ''}`,
        ganador === 'jugador' ? '#b9f6ca' : '#ff8a80');
    }
  }

  // ─── Lanzamientos ──────────────────────────────────────────────────────
  // Velocidad para que una bola salga de "origen" y caiga en "destino" con el ángulo dado
  function velocidadPara(origen, destino, angulo = ANGULO) {
    const dx = destino.x - origen.x;
    const dz = destino.z - origen.z;
    const d = Math.hypot(dx, dz);
    const dy = destino.y - origen.y;
    const c = Math.cos(angulo);
    const denominador = 2 * c * c * (d * Math.tan(angulo) - dy);
    const v = denominador > 0 ? Math.sqrt((G * d * d) / denominador) : 3;
    return new THREE.Vector3((dx / d) * v * c, v * Math.sin(angulo), (dz / d) * v * c);
  }

  // Lo que rueda una bola tras caer en "destino" (sin choques)
  function rodadura(destino) {
    const v = velocidadPara(ORIGEN, destino);
    const horizontal = Math.hypot(v.x, v.z) * IMPACTO;
    return (horizontal * horizontal) / (2 * ROZAMIENTO * G);
  }

  // Error aproximadamente normal
  const azar = (sigma) => (Math.random() + Math.random() + Math.random() - 1.5) * sigma * 1.4;

  function lanzar(equipo, malla, vel) {
    quedan[equipo] -= 1;
    lanzada = anadirCuerpo(malla, equipo, vel);
    estado = 'rodando';
    tiempoRodando = 0;
    anilloPunto.visible = false;
  }

  function lanzarMaquina() {
    const J = boliche.malla.position;
    const mejor = masCercanas();
    let caida;
    const tirar = mejor.jugador && (!mejor.maquina || mejor.jugador.d < mejor.maquina.d) && mejor.jugador.d < 0.25 && Math.random() < 0.3;
    if (tirar) {
      // "Tirar": intenta caer encima de tu bola para sacarla
      const b = mejor.jugador.c.malla.position;
      caida = new THREE.Vector3(b.x + azar(0.15 * FALLO_MAQUINA), R_BOLA, b.z + azar(0.15 * FALLO_MAQUINA));
      decir('¡La máquina tira a tu bola!', '#ffab91');
    } else {
      // "Arrimar": cae antes del boliche lo que calcula que va a rodar
      const objetivo = new THREE.Vector3(J.x, R_BOLA, J.z + 0.04);
      const dir = tmp.set(objetivo.x - ORIGEN.x, 0, objetivo.z - ORIGEN.z).normalize();
      caida = objetivo.clone();
      for (let i = 0; i < 4; i++) caida.copy(objetivo).addScaledVector(dir, -rodadura(caida));
      caida.x += azar(0.2 * FALLO_MAQUINA);
      caida.z += azar(0.25 * FALLO_MAQUINA);
    }
    const malla = crearBola('maquina');
    malla.position.copy(ORIGEN);
    lanzar('maquina', malla, velocidadPara(ORIGEN, caida));
  }

  // ─── Física ────────────────────────────────────────────────────────────
  function simular(dt) {
    const pasos = 6;
    const h = dt / pasos;
    for (let paso = 0; paso < pasos; paso++) {
      for (const c of cuerpos) {
        const p = c.malla.position;
        const v = c.vel;
        const enSuelo = p.y <= c.r + 0.001 && v.y <= 0;
        if (!enSuelo) v.y -= G * h;
        p.addScaledVector(v, h);

        // Suelo de grava
        if (p.y < c.r) {
          p.y = c.r;
          if (v.y < -1.5) {
            // Al caer desde lo alto la grava frena mucho la bola
            v.x *= IMPACTO;
            v.z *= IMPACTO;
            v.y *= -0.15;
            ctx.sonido('grava');
          } else {
            v.y = 0;
          }
        }
        if (p.y <= c.r + 0.001 && v.y <= 0) {
          const s = Math.hypot(v.x, v.z);
          const nueva = Math.max(0, s - ROZAMIENTO * G * h);
          if (s > 0) {
            v.x *= nueva / s;
            v.z *= nueva / s;
          }
        }

        // Bordes de madera (solo si la bola va baja)
        if (p.y < ALTO_BORDE + c.r) {
          const lx = ANCHO / 2 - c.r;
          if (p.x < -lx) { p.x = -lx; v.x = Math.abs(v.x) * 0.4; }
          if (p.x > lx) { p.x = lx; v.x = -Math.abs(v.x) * 0.4; }
          if (p.z < Z_FONDO + c.r) { p.z = Z_FONDO + c.r; v.z = Math.abs(v.z) * 0.4; }
          if (p.z > Z_DELANTE - c.r && p.y < c.r + 0.01) { p.z = Z_DELANTE - c.r; v.z = -Math.abs(v.z) * 0.4; }
        }

        c.malla.rotation.x += (v.z * h) / c.r;
        c.malla.rotation.z -= (v.x * h) / c.r;
      }

      // Choques entre bolas
      for (let i = 0; i < cuerpos.length; i++) {
        for (let j = i + 1; j < cuerpos.length; j++) {
          const a = cuerpos[i];
          const b = cuerpos[j];
          normal.subVectors(b.malla.position, a.malla.position);
          const d = normal.length();
          const minimo = a.r + b.r;
          if (d >= minimo || d < 1e-6) continue;
          normal.divideScalar(d);
          const total = a.masa + b.masa;
          const solape = minimo - d;
          a.malla.position.addScaledVector(normal, (-solape * b.masa) / total);
          b.malla.position.addScaledVector(normal, (solape * a.masa) / total);
          const relativa = tmp2.subVectors(b.vel, a.vel).dot(normal);
          if (relativa < 0) {
            const impulso = (-(1 + REBOTE_BOLAS) * relativa) / (1 / a.masa + 1 / b.masa);
            a.vel.addScaledVector(normal, -impulso / a.masa);
            b.vel.addScaledVector(normal, impulso / b.masa);
            if (relativa < -0.3) ctx.sonido('clac');
          }
        }
      }
    }
  }

  function todoQuieto() {
    return cuerpos.every((c) => Math.hypot(c.vel.x, c.vel.z) < 0.01 && c.malla.position.y <= c.r + 0.002 && Math.abs(c.vel.y) < 0.05);
  }

  // ─── Turno del jugador: VR ─────────────────────────────────────────────
  function velocidadMano(m) {
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
    const miTurno = estado === 'jugador' && quedan.jugador > 0;
    if (miTurno && !bolaSoporte && !manoConBola) {
      bolaSoporte = crearBola('jugador');
      bolaSoporte.position.copy(SOPORTE);
      raiz.add(bolaSoporte);
    }
    for (const m of manos) {
      const mano = m.mano;
      if (!mano.activa) {
        m.historial.length = 0;
        if (manoConBola === m) {
          // Si se pierde el mando con la bola en la mano, vuelve al soporte
          bolaSoporte.position.copy(SOPORTE);
          manoConBola = null;
        }
        continue;
      }
      m.historial.push({ pos: mano.posicion.clone(), dt });
      if (m.historial.length > 12) m.historial.shift();
      const apretonPulsado = mano.apreton && !m.apretonAntes;
      m.apretonAntes = mano.apreton;

      if (miTurno && bolaSoporte && !manoConBola && (mano.gatilloPulsado || apretonPulsado) &&
          mano.posicion.distanceTo(bolaSoporte.position) < ALCANCE_AGARRE) {
        manoConBola = m;
        ctx.vibrar(mano, 0.3, 30);
      }
      if (manoConBola === m) {
        mano.grip.localToWorld(bolaSoporte.position.set(0, -0.02, -0.07));
        if (!mano.gatillo && !mano.apreton) {
          const malla = bolaSoporte;
          bolaSoporte = null;
          manoConBola = null;
          lanzar('jugador', malla, velocidadMano(m).multiplyScalar(FUERZA_VR));
        }
      }
    }
  }

  // ─── Turno del jugador: ratón ──────────────────────────────────────────
  function raton() {
    const miTurno = estado === 'jugador' && quedan.jugador > 0;
    const r = ctx.raton;
    const punto = r.rayo.ray.intersectPlane(suelo, tmp);
    const valido = miTurno && punto && punto.z < Z_DELANTE - 0.3 && punto.z > Z_FONDO && Math.abs(punto.x) < ANCHO / 2;
    mira.visible = !!valido && r.dentro;
    if (!valido) return;
    mira.position.set(punto.x, 0.01, punto.z);
    if (r.clic) {
      // Cae donde has hecho clic, con un pequeño error que crece con la distancia
      const d = Math.hypot(punto.x - ORIGEN.x, punto.z - ORIGEN.z);
      const caida = new THREE.Vector3(punto.x + azar(0.025 * d), R_BOLA, punto.z + azar(0.03 * d));
      const malla = crearBola('jugador');
      malla.position.copy(ORIGEN);
      lanzar('jugador', malla, velocidadPara(ORIGEN, caida));
    }
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function empezarPartida() {
    tanteo.jugador = 0;
    tanteo.maquina = 0;
    empieza = 'jugador';
    nuevaMano();
  }

  function actualizar(dt) {
    colocarMarcador();
    reloj -= dt;
    const vr = ctx.enVR();

    switch (estado) {
      case 'intro':
        if (reloj <= 0) empezarPartida();
        break;
      case 'maquina':
        if (reloj <= 0) lanzarMaquina();
        break;
      case 'rodando':
        tiempoRodando += dt;
        if (tiempoRodando > 0.6 && (todoQuieto() || tiempoRodando > 12)) {
          for (const c of cuerpos) c.vel.set(0, 0, 0);
          // En VR, si la bola no pasa la línea (se te cae), se repite el lanzamiento
          if (lanzada.equipo === 'jugador' && lanzada.malla.position.z > Z_DELANTE - 0.4) {
            raiz.remove(lanzada.malla);
            cuerpos.splice(cuerpos.indexOf(lanzada), 1);
            quedan.jugador += 1;
            darTurno('jugador');
            decir('La bola no ha pasado la línea: repite', '#fff59d');
          } else {
            trasLanzamiento();
          }
        }
        break;
      case 'finMano':
        if (reloj <= 0) nuevaMano();
        break;
      case 'finPartida':
        if (reloj <= 0) empezarPartida();
        break;
    }

    if (estado === 'rodando') simular(dt);

    if (vr) {
      mira.visible = false;
      manosVR(dt);
    } else {
      if (bolaSoporte) {
        raiz.remove(bolaSoporte);
        bolaSoporte = null;
        manoConBola = null;
      }
      raton();
    }
    soporte.visible = vr;

    colocarSombras();
    actualizarMarcador();
  }

  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      niebla.near = nieblaOriginal.near;
      niebla.far = nieblaOriginal.far;
      cuerpos.length = 0;
    },
  };
}
