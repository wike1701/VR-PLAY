// CARRERAS
// 3 vueltas a un circuito con rectas largas y curvas cerradas contra 5
// monoplazas de la máquina. Vas sentado bajo, como en un Fórmula 1: el coche
// se queda quieto y es el circuito el que se mueve a tu alrededor (así funciona
// igual con gafas y sin ellas).
// Los neumáticos tienen un límite de agarre: si entras en una curva demasiado
// rápido el coche no gira lo que le pides, derrapa y se va hacia fuera. Hay que
// frenar antes de las curvas cerradas.
// En VR giras un volante "invisible" con las dos manos (como si lo agarraras),
// aceleras con el gatillo derecho y frenas con el izquierdo. Con ratón o con el
// dedo: a los lados para girar, mantén pulsado para acelerar y suelta para frenar.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const VUELTAS = 3;
const ANCHO_PISTA = 12;
const N = 900;                 // puntos del trazado
const VELOCIDAD_MAX = 55;      // m/s (unos 200 km/h)
const VELOCIDAD_HIERBA = 14;
const ACELERACION = 11;        // a baja velocidad; se reduce al acercarse a la máxima
const FRENADA = 22;            // VR: gatillo izquierdo
const FRENADA_RATON = 12;      // ratón o dedo: al soltar
const RETENCION = 3;           // sin acelerar ni frenar
const AGARRE = 15;             // m/s² de aceleración lateral antes de derrapar
const BATALLA = 3;             // distancia entre ejes (radio de giro)
const GIRO_MAX = 0.4;          // ángulo máximo de las ruedas
const GIRO_VOLANTE = 1.6;      // radianes de volante para girar del todo
const OJOS = 0.85;             // altura de los ojos: sentado bajo, como en un monoplaza
const DISTANCIA_CHOQUE = 2.2;
const MARCHAS = 6;
// Máquina: agarre algo menor que el tuyo (en las curvas se les puede ganar) y frenada
const AGARRE_MAQUINA = 13.5;
const FRENADA_MAQUINA = 16;
const ACELERACION_MAQUINA = 9;
// Trazado del circuito (x, z): la salida está en el primer punto, mirando hacia el segundo.
// Recta larga, horquilla, curvas enlazadas, otra horquilla, eses y recta de atrás.
const TRAZADO = [
  [0, 0], [0, -150], [0, -290], [15, -330], [45, -342], [72, -325], [80, -290],
  [80, -210], [100, -170], [140, -155], [185, -170], [220, -190], [250, -175], [255, -140],
  [230, -115], [180, -95], [140, -70], [125, -30], [135, 10], [160, 45], [165, 85],
  [145, 115], [110, 120], [40, 120], [-20, 115], [-45, 95], [-48, 60], [-30, 35], [-8, 20],
];

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  ctx.fondo(0x87c6ef);
  const niebla = ctx.escena.fog;
  const nieblaOriginal = { near: niebla.near, far: niebla.far };
  niebla.near = 70;
  niebla.far = 260;
  ctx.sueloBase(false);
  ctx.vistaEscritorio(new THREE.Vector3(0, OJOS, 0.05), new THREE.Vector3(0, 0.55, -12));

  // "conjunto" sube o baja según la altura real de tus ojos; dentro van la cabina
  // (fija) y el mundo (que se mueve al revés que el coche)
  const conjunto = new THREE.Group();
  raiz.add(conjunto);
  const mundo = new THREE.Group();
  mundo.matrixAutoUpdate = false;
  conjunto.add(mundo);

  const escalarUV = (geo, u, v = u) => {
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
    return geo;
  };
  // Fusiona piezas [geometría, x, y, z] en una sola geometría (una llamada de dibujo)
  const fusionar = (piezas) => {
    const datos = { position: [], normal: [], uv: [] };
    for (const [geo, x, y, z] of piezas) {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      g.translate(x, y, z);
      for (const nombre in datos) datos[nombre].push(...g.attributes[nombre].array);
      g.dispose();
      geo.dispose();
    }
    const resultado = new THREE.BufferGeometry();
    for (const nombre in datos) resultado.setAttribute(nombre, new THREE.Float32BufferAttribute(datos[nombre], nombre === 'uv' ? 2 : 3));
    return R(resultado);
  };
  const caja = (x, y, z) => new THREE.BoxGeometry(x, y, z);
  const rueda = (radio, ancho) => new THREE.CylinderGeometry(radio, radio, ancho, 16).rotateZ(Math.PI / 2);

  // ─── Trazado ───────────────────────────────────────────────────────────
  const curva = new THREE.CatmullRomCurve3(TRAZADO.map(([x, z]) => new THREE.Vector3(x, 0, z)), true, 'centripetal');
  const puntos = curva.getSpacedPoints(N).slice(0, N);
  const LONGITUD = curva.getLength();
  const TRAMO = LONGITUD / N;
  const tangentes = [];
  const derechas = [];
  for (let i = 0; i < N; i++) {
    const t = new THREE.Vector3().subVectors(puntos[(i + 1) % N], puntos[(i - 1 + N) % N]).normalize();
    tangentes.push(t);
    derechas.push(new THREE.Vector3(-t.z, 0, t.x));
  }
  const rumboDe = (t) => Math.atan2(-t.x, -t.z);

  // Velocidad de la máquina en cada punto: lo que permite la curva y, hacia atrás,
  // lo que hace falta para llegar frenando a la siguiente curva
  const perfil = tangentes.map((t, i) => {
    const a = tangentes[(i - 4 + N) % N];
    const b = tangentes[(i + 4) % N];
    const angulo = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
    const radio = angulo > 1e-4 ? (8 * TRAMO) / angulo : 1e4;
    return Math.min(VELOCIDAD_MAX * 0.97, Math.sqrt(AGARRE_MAQUINA * radio));
  });
  for (let vuelta = 0; vuelta < 2; vuelta++) {
    for (let i = N - 1; i >= 0; i--) {
      const siguiente = perfil[(i + 1) % N];
      perfil[i] = Math.min(perfil[i], Math.sqrt(siguiente * siguiente + 2 * FRENADA_MAQUINA * TRAMO));
    }
  }

  // Cinta a lo largo del trazado entre dos distancias laterales al centro
  function cinta(desde, hasta, metrosPorV, y) {
    const posiciones = [];
    const uvs = [];
    const indices = [];
    for (let i = 0; i <= N; i++) {
      const p = puntos[i % N];
      const d = derechas[i % N];
      posiciones.push(p.x + d.x * desde, y, p.z + d.z * desde, p.x + d.x * hasta, y, p.z + d.z * hasta);
      const v = (i * TRAMO) / metrosPorV;
      uvs.push(0, v, 1, v);
      if (i < N) {
        const k = i * 2;
        indices.push(k, k + 2, k + 1, k + 1, k + 2, k + 3);
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3));
    geo.setAttribute('uv', new THREE.Float32BufferAttribute(uvs, 2));
    geo.setIndex(indices);
    geo.computeVertexNormals();
    // Que la cara de arriba mire hacia arriba (según el sentido del trazado)
    if (geo.attributes.normal.getY(0) < 0) {
      geo.setIndex(indices.map((_, j) => indices[j - (j % 3) + [0, 2, 1][j % 3]]));
      geo.computeVertexNormals();
    }
    return R(geo);
  }

  // Asfalto con las líneas blancas de los bordes
  const texAsfalto = R(ctx.texturaCanvas((g, tam, azar) => {
    g.fillStyle = '#45484d';
    g.fillRect(0, 0, tam, tam);
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = azar() < 0.5 ? `rgba(255,255,255,${azar() * 0.08})` : `rgba(0,0,0,${azar() * 0.15})`;
      g.fillRect(azar() * tam, azar() * tam, 1.5, 1.5);
    }
    g.fillStyle = 'rgba(255,255,255,0.75)';
    g.fillRect(tam * 0.02, 0, tam * 0.012, tam);
    g.fillRect(tam * 0.966, 0, tam * 0.012, tam);
  }, { tam: 256, semilla: 17 }));
  mundo.add(new THREE.Mesh(cinta(-ANCHO_PISTA / 2, ANCHO_PISTA / 2, 10, 0.02), R(new THREE.MeshLambertMaterial({ map: texAsfalto }))));
  // Pianos rojos y blancos a los lados
  const texPiano = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#e53935';
    g.fillRect(0, 0, tam, tam / 2);
    g.fillStyle = '#fafafa';
    g.fillRect(0, tam / 2, tam, tam / 2);
  }, { tam: 32 }));
  const matPiano = R(new THREE.MeshLambertMaterial({ map: texPiano }));
  mundo.add(new THREE.Mesh(cinta(ANCHO_PISTA / 2, ANCHO_PISTA / 2 + 1, 2, 0.025), matPiano));
  mundo.add(new THREE.Mesh(cinta(-ANCHO_PISTA / 2 - 1, -ANCHO_PISTA / 2, 2, 0.025), matPiano));
  // Césped
  const cesped = new THREE.Mesh(escalarUV(R(new THREE.PlaneGeometry(900, 900).rotateX(-Math.PI / 2)), 900 / 8), R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.cesped(0x5aa83f, { semilla: 3 })) })));
  cesped.position.set(100, 0, -110);
  mundo.add(cesped);
  // Línea de salida a cuadros
  const texCuadros = R(ctx.texturaCanvas((g, tam) => {
    const c = tam / 8;
    for (let i = 0; i < 8; i++) for (let k = 0; k < 2; k++) {
      g.fillStyle = (i + k) % 2 ? '#111' : '#fff';
      g.fillRect(i * c, k * (tam / 2), c, tam / 2);
    }
  }, { tam: 128 }));
  const meta = new THREE.Mesh(R(new THREE.PlaneGeometry(ANCHO_PISTA, 1.4).rotateX(-Math.PI / 2)), R(new THREE.MeshLambertMaterial({ map: texCuadros })));
  meta.position.copy(puntos[0]).setY(0.03);
  meta.rotation.y = rumboDe(tangentes[0]);
  mundo.add(meta);
  // Arco de meta y grada
  const matArco = R(new THREE.MeshLambertMaterial({ color: 0x263238 }));
  const geoPilar = R(caja(0.5, 6, 0.5));
  for (const s of [-1, 1]) {
    const pilar = new THREE.Mesh(geoPilar, matArco);
    pilar.position.copy(puntos[0]).addScaledVector(derechas[0], s * (ANCHO_PISTA / 2 + 1.5)).setY(3);
    mundo.add(pilar);
  }
  const travesano = new THREE.Mesh(R(caja(ANCHO_PISTA + 3.5, 1, 0.5)), R(new THREE.MeshLambertMaterial({ color: 0x7c5cff })));
  travesano.position.copy(puntos[0]).setY(6);
  travesano.rotation.y = rumboDe(tangentes[0]);
  mundo.add(travesano);
  const grada = new THREE.Mesh(R(caja(4, 3, 60)), R(new THREE.MeshLambertMaterial({ color: 0x546e7a })));
  grada.position.copy(puntos[N - 20]).addScaledVector(derechas[N - 20], -(ANCHO_PISTA / 2 + 9)).setY(1.5);
  grada.rotation.y = rumboDe(tangentes[N - 20]);
  mundo.add(grada);

  // Árboles fuera de la pista (instanciados: dos llamadas)
  const geoCopa = R(new THREE.ConeGeometry(2.4, 7, 8).translate(0, 5.5, 0));
  const geoTroncoArbol = R(new THREE.CylinderGeometry(0.3, 0.4, 2, 6).translate(0, 1, 0));
  const lugares = [];
  let semilla = 7;
  const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
  while (lugares.length < 220) {
    const x = -110 + azar() * 430;
    const z = -420 + azar() * 600;
    let lejos = true;
    for (let i = 0; i < N; i += 6) {
      if ((puntos[i].x - x) ** 2 + (puntos[i].z - z) ** 2 < 18 * 18) {
        lejos = false;
        break;
      }
    }
    if (lejos) lugares.push([x, z, 0.7 + azar() * 0.8]);
  }
  const copas = new THREE.InstancedMesh(geoCopa, R(new THREE.MeshLambertMaterial({ color: 0x2e6b30 })), lugares.length);
  const troncos = new THREE.InstancedMesh(geoTroncoArbol, R(new THREE.MeshLambertMaterial({ color: 0x6d4c41 })), lugares.length);
  const m4 = new THREE.Matrix4();
  lugares.forEach(([x, z, s], i) => {
    m4.makeScale(s, s, s).setPosition(x, 0, z);
    copas.setMatrixAt(i, m4);
    troncos.setMatrixAt(i, m4);
  });
  mundo.add(copas, troncos);

  // ─── Monoplazas de la máquina ──────────────────────────────────────────
  // Construidos mirando a -Z: morro largo, pontones, ruedas al aire y alerones.
  const geoCuerpoRival = fusionar([
    [caja(0.34, 0.22, 2.0), 0, 0.32, -1.6],    // morro
    [caja(0.8, 0.42, 1.9), 0, 0.42, 0.05],     // habitáculo
    [caja(0.5, 0.34, 1.4), -0.6, 0.33, 0.35],  // pontones
    [caja(0.5, 0.34, 1.4), 0.6, 0.33, 0.35],
    [caja(0.55, 0.5, 1.2), 0, 0.55, 1.15],     // tapa del motor
    [caja(1.7, 0.05, 0.42), 0, 0.12, -2.55],   // alerón delantero
    [caja(1.0, 0.08, 0.36), 0, 0.98, 2.0],     // alerón trasero
    [caja(0.04, 0.5, 0.45), -0.5, 0.75, 2.0],  // derivas del alerón
    [caja(0.04, 0.5, 0.45), 0.5, 0.75, 2.0],
  ]);
  const geoRuedasRival = fusionar([
    [rueda(0.33, 0.3), -0.8, 0.33, -1.6], [rueda(0.33, 0.3), 0.8, 0.33, -1.6],
    [rueda(0.37, 0.4), -0.82, 0.37, 1.45], [rueda(0.37, 0.4), 0.82, 0.37, 1.45],
  ]);
  const geoCasco = R(new THREE.SphereGeometry(0.15, 12, 8).translate(0, 0.78, 0.05));
  const matRueda = R(new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  const matCasco = R(new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.3 }));
  const rivales = [0x1e88e5, 0xfdd835, 0x43a047, 0xff6d00, 0x8e24aa].map((color, i) => {
    const coche = new THREE.Group();
    coche.add(
      new THREE.Mesh(geoCuerpoRival, R(new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.3 }))),
      new THREE.Mesh(geoRuedasRival, matRueda),
      new THREE.Mesh(geoCasco, matCasco),
    );
    mundo.add(coche);
    const sombra = ctx.crearSombra({ radio: 1.4, opacidad: 0.5 });
    sombra.scale.set(2.1, 1, 5);
    mundo.add(sombra);
    // Cada uno con su nivel: el mejor casi exprime el perfil, el peor va algo más lento
    return { coche, sombra, s: 0, v: 0, carril: 0, base: 0, habilidad: 1 - i * 0.025, fase: i * 1.7, x: 0, z: 0 };
  });

  // ─── Cabina de Fórmula 1 ───────────────────────────────────────────────
  const cabina = new THREE.Group();
  conjunto.add(cabina);
  const matCarroceria = R(new THREE.MeshLambertMaterial({ color: 0xd32f2f }));
  const matInterior = R(new THREE.MeshLambertMaterial({ color: 0x2b2b2b }));
  cabina.add(new THREE.Mesh(fusionar([
    [caja(0.36, 0.22, 2.3), 0, 0.36, -1.75],   // morro
    [caja(1.8, 0.05, 0.45), 0, 0.12, -3.0],    // alerón delantero
    [caja(0.05, 0.22, 0.5), -0.9, 0.2, -3.0],  // derivas del alerón
    [caja(0.05, 0.22, 0.5), 0.9, 0.2, -3.0],
    [caja(0.12, 0.3, 1.3), -0.42, 0.45, -0.15], // laterales del habitáculo
    [caja(0.12, 0.3, 1.3), 0.42, 0.45, -0.15],
    [caja(0.55, 0.34, 1.4), -0.72, 0.3, 0.35],  // pontones
    [caja(0.55, 0.34, 1.4), 0.72, 0.3, 0.35],
  ]), matCarroceria));
  // Ruedas delanteras al aire: giran con la velocidad y con el volante
  const ruedasDelanteras = [-1, 1].map((s) => {
    const soporte = new THREE.Group();
    soporte.position.set(s * 0.82, 0.33, -2.05);
    const r = new THREE.Mesh(R(rueda(0.33, 0.3)), matRueda);
    soporte.add(r);
    cabina.add(soporte);
    return { soporte, r };
  });
  // Brazos de suspensión (de la carrocería a las ruedas)
  cabina.add(new THREE.Mesh(fusionar([
    [caja(0.62, 0.03, 0.05), -0.5, 0.36, -2.05], [caja(0.62, 0.03, 0.05), 0.5, 0.36, -2.05],
  ]), matInterior));
  // Volante rectangular de F1
  const soporteVolante = new THREE.Group();
  soporteVolante.position.set(0, 0.6, -0.4);
  soporteVolante.rotation.x = -0.35;
  const volante = new THREE.Group();
  volante.add(new THREE.Mesh(fusionar([
    [caja(0.24, 0.12, 0.04), 0, 0, 0],         // cuerpo
    [caja(0.045, 0.16, 0.05), -0.14, -0.01, 0], // empuñaduras
    [caja(0.045, 0.16, 0.05), 0.14, -0.01, 0],
  ]), matInterior));
  const luces = new THREE.Mesh(R(caja(0.16, 0.02, 0.01)), R(new THREE.MeshBasicMaterial({ color: 0x00e676 })));
  luces.position.set(0, 0.045, 0.021);
  volante.add(luces);
  soporteVolante.add(volante);
  cabina.add(soporteVolante);
  // Pantalla sobre el morro, mirando al piloto (por encima del volante en la vista)
  const pantalla = ctx.crearPanel({ ancho: 0.6, alto: 0.2, resolucion: 384 });
  pantalla.mesh.position.set(0, 0.53, -1.05);
  pantalla.mesh.rotation.x = -0.95;
  cabina.add(pantalla.mesh);
  // Cartel grande (semáforo y llegada)
  const cartel = ctx.crearPanel({ ancho: 2.4, alto: 0.7 });
  cartel.mesh.position.set(0, 2, -7);
  cabina.add(cartel.mesh);
  // Motor (la shell lo para al cambiar de juego)
  const motor = ctx.sonidoContinuo('motor');

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'salida'; // 'salida' | 'carrera' | 'fin'
  let reloj = 4;
  let tiempoCarrera = 0;
  let x = 0;
  let z = 0;
  let rumbo = 0;
  let v = 0;
  let indice = 0;
  let vueltas = 0;
  let mitad = false;
  let enHierba = false;
  let derrape = 0;             // cuánto te pasas del agarre (0 = nada)
  let esperaDerrape = 0;
  let enfriamientoChoque = 0;
  let giroVolante = 0;
  let puesto = rivales.length + 1;
  let puestoFinal = 0;
  let alturaOjos = null;
  let mejorTiempo = ctx.leer('mejorTiempo', 0);
  let victorias = ctx.leer('victorias', 0);
  let segundoAnterior = 5;

  const matrizCoche = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const EJE_Y = new THREE.Vector3(0, 1, 0);
  const tmp = new THREE.Vector3();
  const unidad = new THREE.Vector3(1, 1, 1);

  const formatoTiempo = (s) => `${Math.floor(s / 60)}:${(s % 60).toFixed(1).padStart(4, '0')}`;

  function colocarEnParrilla() {
    // Parrilla de dos en fondo; tú sales el último, por la derecha
    const salidaJugador = N - 27;
    const p = puntos[salidaJugador];
    x = p.x + derechas[salidaJugador].x * 2.5;
    z = p.z + derechas[salidaJugador].z * 2.5;
    rumbo = rumboDe(tangentes[salidaJugador]);
    v = 0;
    indice = salidaJugador;
    vueltas = 0;
    mitad = false;
    tiempoCarrera = 0;
    puestoFinal = 0;
    [[N - 6, -2.5], [N - 11, 2.5], [N - 16, -2.5], [N - 21, 2.5], [N - 26, -2.5]].forEach(([s, carril], i) => {
      const r = rivales[i];
      r.s = s;
      r.v = 0;
      r.base = carril;
      r.carril = carril;
    });
  }

  // Progreso en "puntos del trazado" desde la línea de salida (para ordenar la carrera)
  const progresoJugador = () => vueltas * N + indice - (!mitad && indice > N / 2 ? N : 0);
  const progresoRival = (r) => r.s - N;

  // ─── Controles ─────────────────────────────────────────────────────────
  function controles() {
    let direccion = 0;
    let acelerar = false;
    let frenar = 0;
    if (ctx.enVR()) {
      const activas = ctx.manos.filter((m) => m.activa);
      const izquierda = activas.find((m) => m.lado === 'left') || ctx.manos[0];
      const derecha = activas.find((m) => m.lado === 'right') || ctx.manos[1];
      if (izquierda.activa && derecha.activa) {
        // Volante invisible: la inclinación de la línea entre las dos manos
        const d = tmp.subVectors(derecha.posicion, izquierda.posicion);
        giroVolante = Math.atan2(d.y, Math.max(0.05, Math.hypot(d.x, d.z)));
      } else if (activas.length === 1) {
        giroVolante = -THREE.MathUtils.clamp(activas[0].posicion.x / 0.25, -1, 1) * GIRO_VOLANTE;
      }
      direccion = THREE.MathUtils.clamp(-giroVolante / GIRO_VOLANTE, -1, 1);
      acelerar = derecha.activa && (derecha.gatillo || derecha.apreton);
      frenar = izquierda.activa && (izquierda.gatillo || izquierda.apreton) ? FRENADA : 0;
    } else {
      direccion = THREE.MathUtils.clamp(ctx.raton.ndc.x * 1.4, -1, 1);
      giroVolante = -direccion * GIRO_VOLANTE;
      acelerar = ctx.raton.pulsado;
      frenar = acelerar ? 0 : FRENADA_RATON;
    }
    volante.rotation.z = giroVolante;
    return { direccion, acelerar, frenar };
  }

  // ─── Física del coche ──────────────────────────────────────────────────
  function moverJugador(dt, mando) {
    if (estado !== 'carrera') {
      mando.acelerar = false;
      mando.frenar = estado === 'fin' ? FRENADA_RATON : 0;
    }
    if (mando.acelerar) v += ACELERACION * (1 - v / (VELOCIDAD_MAX * 1.04)) * dt;
    else if (!mando.frenar) v -= RETENCION * dt;
    v -= mando.frenar * dt;
    if (enHierba && v > VELOCIDAD_HIERBA) v = Math.max(VELOCIDAD_HIERBA, v - 25 * dt);

    // Giro con límite de agarre: si la curva pide más aceleración lateral de la que
    // aguantan los neumáticos, el coche gira solo hasta ese límite (se abre) y derrapa
    const giro = mando.direccion * GIRO_MAX * (1 - 0.55 * (v / VELOCIDAD_MAX));
    let giroPorSegundo = (v / BATALLA) * Math.tan(giro);
    const lateral = v * Math.abs(giroPorSegundo);
    derrape = lateral > AGARRE ? (lateral - AGARRE) / AGARRE : 0;
    if (derrape > 0) {
      giroPorSegundo = Math.sign(giroPorSegundo) * (AGARRE / Math.max(v, 1));
      v -= derrape * 6 * dt; // los neumáticos arrastran y frenan
    }
    v = THREE.MathUtils.clamp(v, 0, VELOCIDAD_MAX);
    rumbo -= giroPorSegundo * dt;
    x += -Math.sin(rumbo) * v * dt;
    z += -Math.cos(rumbo) * v * dt;

    // Punto del trazado más cercano (buscando cerca del anterior)
    let mejor = indice;
    let mejorD = Infinity;
    for (let k = -20; k <= 20; k++) {
      const i = (indice + k + N) % N;
      const d = (puntos[i].x - x) ** 2 + (puntos[i].z - z) ** 2;
      if (d < mejorD) {
        mejorD = d;
        mejor = i;
      }
    }
    // Vueltas: hay que pasar por la mitad del circuito antes de cruzar la meta
    if (mejor > N * 0.45 && mejor < N * 0.55) mitad = true;
    if (indice > N * 0.8 && mejor < N * 0.2 && mitad) {
      vueltas += 1;
      mitad = false;
      if (vueltas < VUELTAS && estado === 'carrera') ctx.sonido('punto');
    }
    indice = mejor;
    const lateralPista = (x - puntos[indice].x) * derechas[indice].x + (z - puntos[indice].z) * derechas[indice].z;
    enHierba = Math.abs(lateralPista) > ANCHO_PISTA / 2 + 1;
    // No dejar que te alejes demasiado del circuito
    const limite = ANCHO_PISTA / 2 + 15;
    if (Math.abs(lateralPista) > limite) {
      const sobra = lateralPista - Math.sign(lateralPista) * limite;
      x -= derechas[indice].x * sobra;
      z -= derechas[indice].z * sobra;
    }
  }

  function moverRivales(dt, t) {
    const miProgreso = progresoJugador();
    for (const r of rivales) {
      const i = Math.floor(r.s) % N;
      let objetivo = perfil[(i + 3) % N] * r.habilidad;
      // Siempre cerca de ti: si se quedan muy atrás aprietan, si se escapan aflojan
      const diferencia = progresoRival(r) - miProgreso;
      if (diferencia < -250) objetivo *= 1.25;
      else if (diferencia < -80) objetivo *= 1.1;
      else if (diferencia > 200) objetivo *= 0.85;
      else if (diferencia > 80) objetivo *= 0.94;
      if (estado === 'salida') objetivo = 0;
      if (estado === 'fin' && progresoRival(r) >= VUELTAS * N) objetivo = 10;
      r.v += THREE.MathUtils.clamp(objetivo - r.v, -FRENADA_MAQUINA * 1.3 * dt, ACELERACION_MAQUINA * dt);
      r.s += (r.v * dt) / TRAMO;
      r.carril = r.base + Math.sin(t * 0.3 + r.fase) * 1.5;

      const a = Math.floor(r.s) % N;
      const b = (a + 1) % N;
      const f = r.s - Math.floor(r.s);
      r.x = THREE.MathUtils.lerp(puntos[a].x, puntos[b].x, f) + derechas[a].x * r.carril;
      r.z = THREE.MathUtils.lerp(puntos[a].z, puntos[b].z, f) + derechas[a].z * r.carril;
      r.coche.position.set(r.x, 0, r.z);
      r.coche.rotation.y = rumboDe(tangentes[a]);
      r.sombra.position.set(r.x, 0.03, r.z);
      r.sombra.rotation.y = r.coche.rotation.y;

      // Choque con tu coche: te empuja y te frena
      const dx = x - r.x;
      const dz = z - r.z;
      const d = Math.hypot(dx, dz);
      if (d < DISTANCIA_CHOQUE && d > 1e-3) {
        x = r.x + (dx / d) * DISTANCIA_CHOQUE;
        z = r.z + (dz / d) * DISTANCIA_CHOQUE;
        if (enfriamientoChoque <= 0) {
          v *= 0.75;
          enfriamientoChoque = 0.6;
          ctx.sonido('golpe');
          for (const m of ctx.manos) ctx.vibrar(m, 0.8, 120);
        }
      }
    }
    puesto = 1 + rivales.filter((r) => progresoRival(r) > miProgreso).length;
  }

  // ─── Pantallas ─────────────────────────────────────────────────────────
  function actualizarPantallas() {
    const total = rivales.length + 1;
    pantalla.escribir([
      { texto: `${Math.round(v * 3.6)} km/h`, tam: 1.2 },
      { texto: `Vuelta ${Math.min(VUELTAS, vueltas + 1)}/${VUELTAS} · ${puesto}º de ${total} · ${formatoTiempo(tiempoCarrera)}`, tam: 0.8, color: '#ffcc80' },
    ]);
    if (estado === 'salida') {
      const n = Math.ceil(reloj - 1);
      cartel.escribir([
        { texto: n > 0 ? String(n) : '¡YA!', tam: 1.4, color: n > 0 ? '#ff5252' : '#69f0ae' },
        { texto: ctx.enVR() ? 'Volante con las dos manos · gatillo derecho acelera, izquierdo frena' : (ctx.tactil ? 'Mantén el dedo para acelerar, suéltalo para frenar y muévelo para girar' : 'Mantén pulsado para acelerar, suelta para frenar · mueve el ratón para girar'), tam: 0.6 },
      ]);
      cartel.mesh.visible = true;
    } else if (estado === 'fin') {
      cartel.escribir([
        { texto: puestoFinal === 1 ? '¡HAS GANADO!' : `Has llegado ${puestoFinal}º`, tam: 1.3, color: puestoFinal === 1 ? '#69f0ae' : '#ffcc80' },
        { texto: `Tiempo ${formatoTiempo(tiempoCarrera)} · mejor ${mejorTiempo ? formatoTiempo(mejorTiempo) : '—'} · victorias ${victorias}`, tam: 0.6 },
      ]);
      cartel.mesh.visible = true;
    } else if (reloj > -0.5) {
      cartel.escribir([{ texto: '¡YA!', tam: 1.4, color: '#69f0ae' }, { texto: ' ', tam: 0.6 }]);
      cartel.mesh.visible = true; // un momento tras la salida
    } else {
      cartel.mesh.visible = false;
    }
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function actualizar(dt, t) {
    reloj -= dt;
    enfriamientoChoque -= dt;

    // Altura de los ojos: la cabina se ajusta a lo alto que estés (de pie o sentado)
    if (ctx.enVR()) {
      ctx.camara.getWorldPosition(tmp);
      alturaOjos = alturaOjos === null ? tmp.y : THREE.MathUtils.lerp(alturaOjos, tmp.y, Math.min(1, dt * 0.4));
      conjunto.position.y = alturaOjos - OJOS;
    } else {
      alturaOjos = null;
      conjunto.position.y = 0;
    }

    const mando = controles();
    if (estado === 'salida') {
      const segundo = Math.ceil(reloj - 1);
      if (segundo !== segundoAnterior && segundo > 0) {
        segundoAnterior = segundo;
        ctx.sonido('tic');
      }
      if (reloj <= 1) {
        estado = 'carrera';
        ctx.sonido('boton');
      }
    } else if (estado === 'carrera') {
      tiempoCarrera += dt;
      if (vueltas >= VUELTAS) {
        estado = 'fin';
        reloj = 9;
        puestoFinal = puesto;
        if (!mejorTiempo || tiempoCarrera < mejorTiempo) {
          mejorTiempo = tiempoCarrera;
          ctx.guardar('mejorTiempo', mejorTiempo);
        }
        if (puestoFinal === 1) {
          victorias += 1;
          ctx.guardar('victorias', victorias);
          ctx.sonido('ovacion');
        }
        ctx.sonido('fin');
      }
    } else if (estado === 'fin' && reloj <= 0) {
      colocarEnParrilla();
      estado = 'salida';
      reloj = 4;
      segundoAnterior = 5;
    }

    moverJugador(dt, mando);
    moverRivales(dt, t);

    // El mundo se mueve al revés que tu coche
    quat.setFromAxisAngle(EJE_Y, rumbo);
    matrizCoche.compose(tmp.set(x, 0, z), quat, unidad);
    mundo.matrix.copy(matrizCoche).invert();
    mundo.matrixWorldNeedsUpdate = true;

    // Ruedas delanteras: giran con la velocidad y se orientan con el volante
    for (const rd of ruedasDelanteras) {
      rd.r.rotation.x -= (v * dt) / 0.33;
      rd.soporte.rotation.y = -mando.direccion * GIRO_MAX;
    }
    // Vibración del motor y de la hierba; al derrapar, chirrido y temblor en las manos
    cabina.position.y = Math.sin(t * 40) * 0.002 * (v / VELOCIDAD_MAX) + (enHierba && v > 3 ? Math.sin(t * 25) * 0.012 : 0);
    esperaDerrape -= dt;
    if (derrape > 0.05 && v > 8 && esperaDerrape <= 0) {
      esperaDerrape = 0.18;
      ctx.sonido('derrape');
      for (const m of ctx.manos) ctx.vibrar(m, Math.min(1, 0.3 + derrape), 60);
    }
    if (enHierba && v > 5 && ctx.enVR() && Math.sin(t * 25) > 0.95) for (const m of ctx.manos) ctx.vibrar(m, 0.2, 20);

    // Motor con 6 marchas: sube de vueltas y baja al cambiar de marcha
    const marcha = Math.min(MARCHAS - 1, Math.floor((v / VELOCIDAD_MAX) * MARCHAS));
    const dentroMarcha = (v / VELOCIDAD_MAX) * MARCHAS - marcha;
    motor.ajustar(0.3 + dentroMarcha * 0.7 * (v > 0.5 ? 1 : 0), 0.15);
    // Luces del volante: se encienden al acercarse al cambio de marcha
    luces.scale.x = Math.max(0.05, dentroMarcha);
    luces.material.color.setHex(dentroMarcha > 0.85 ? 0xff1744 : 0x00e676);

    actualizarPantallas();
  }

  colocarEnParrilla();
  actualizarPantallas();

  return {
    actualizar,
    liberar() {
      motor.parar();
      niebla.near = nieblaOriginal.near;
      niebla.far = nieblaOriginal.far;
    },
  };
}
