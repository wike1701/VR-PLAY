// CARRERAS
// 3 vueltas a un circuito contra 3 coches de la máquina. Vas sentado en la
// cabina: el coche se queda quieto y es el circuito el que se mueve a tu
// alrededor (así funciona igual con gafas y sin ellas).
// En VR giras un volante "invisible" con las dos manos (como si lo agarraras),
// aceleras con el gatillo derecho y frenas con el izquierdo. Con ratón o con
// el dedo: a los lados para girar y mantén pulsado para acelerar.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const VUELTAS = 3;
const ANCHO_PISTA = 10;
const N = 500;                 // puntos del trazado
const VELOCIDAD_MAX = 30;      // m/s (108 km/h)
const VELOCIDAD_HIERBA = 10;
const ACELERACION = 7;
const FRENADA = 16;
const BATALLA = 2.6;           // distancia entre ejes (radio de giro)
const GIRO_MAX = 0.45;         // ángulo máximo de las ruedas
const GIRO_VOLANTE = 1.6;      // radianes de volante para girar del todo
const ACELERACION_LATERAL = 9; // los coches de la máquina frenan para no pasarse de esto en las curvas
const OJOS = 1.15;             // altura de los ojos en la cabina
const DISTANCIA_CHOQUE = 2.1;
// Trazado del circuito (x, z): la salida está en el primer punto, mirando hacia el segundo
const TRAZADO = [
  [0, 0], [0, -60], [12, -95], [45, -112], [85, -100], [105, -65], [95, -28], [68, -12],
  [58, 18], [72, 52], [58, 84], [22, 96], [-12, 82], [-26, 50], [-16, 22],
];

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  ctx.fondo(0x87c6ef);
  const niebla = ctx.escena.fog;
  const nieblaOriginal = { near: niebla.near, far: niebla.far };
  niebla.near = 50;
  niebla.far = 180;
  ctx.sueloBase(false);
  ctx.vistaEscritorio(new THREE.Vector3(0, OJOS, 0.1), new THREE.Vector3(0, 0.9, -10));

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
  // Velocidad máxima en cada punto según lo cerrada que es la curva
  const limites = tangentes.map((t, i) => {
    const a = tangentes[(i - 3 + N) % N];
    const b = tangentes[(i + 3) % N];
    const angulo = Math.acos(THREE.MathUtils.clamp(a.dot(b), -1, 1));
    const radio = angulo > 1e-4 ? (6 * TRAMO) / angulo : 1e4;
    return Math.min(VELOCIDAD_MAX, Math.sqrt(ACELERACION_LATERAL * radio));
  });
  const rumboDe = (t) => Math.atan2(-t.x, -t.z);

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

  // Asfalto con línea discontinua en el centro
  const texAsfalto = R(ctx.texturaCanvas((g, tam, azar) => {
    g.fillStyle = '#4a4d52';
    g.fillRect(0, 0, tam, tam);
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = azar() < 0.5 ? `rgba(255,255,255,${azar() * 0.08})` : `rgba(0,0,0,${azar() * 0.15})`;
      g.fillRect(azar() * tam, azar() * tam, 1.5, 1.5);
    }
    g.fillStyle = 'rgba(255,255,255,0.85)';
    g.fillRect(tam * 0.49, 0, tam * 0.02, tam * 0.5);
    g.fillStyle = 'rgba(255,255,255,0.7)';
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
  mundo.add(new THREE.Mesh(cinta(ANCHO_PISTA / 2, ANCHO_PISTA / 2 + 0.9, 2, 0.025), matPiano));
  mundo.add(new THREE.Mesh(cinta(-ANCHO_PISTA / 2 - 0.9, -ANCHO_PISTA / 2, 2, 0.025), matPiano));
  // Césped
  const cesped = new THREE.Mesh(escalarUV(R(new THREE.PlaneGeometry(500, 500).rotateX(-Math.PI / 2)), 500 / 8), R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.cesped(0x5aa83f, { semilla: 3 })) })));
  cesped.position.set(40, 0, -10);
  mundo.add(cesped);
  // Línea de salida a cuadros
  const texCuadros = R(ctx.texturaCanvas((g, tam) => {
    const c = tam / 8;
    for (let i = 0; i < 8; i++) for (let k = 0; k < 2; k++) {
      g.fillStyle = (i + k) % 2 ? '#111' : '#fff';
      g.fillRect(i * c, k * (tam / 2), c, tam / 2);
    }
  }, { tam: 128 }));
  const meta = new THREE.Mesh(R(new THREE.PlaneGeometry(ANCHO_PISTA, 1.2).rotateX(-Math.PI / 2)), R(new THREE.MeshLambertMaterial({ map: texCuadros })));
  meta.position.copy(puntos[0]).setY(0.03);
  meta.rotation.y = rumboDe(tangentes[0]);
  mundo.add(meta);
  // Arco de meta y grada
  const matArco = R(new THREE.MeshLambertMaterial({ color: 0x263238 }));
  const geoPilar = R(new THREE.BoxGeometry(0.5, 6, 0.5));
  for (const s of [-1, 1]) {
    const pilar = new THREE.Mesh(geoPilar, matArco);
    pilar.position.copy(puntos[0]).addScaledVector(derechas[0], s * (ANCHO_PISTA / 2 + 1.5)).setY(3);
    mundo.add(pilar);
  }
  const travesano = new THREE.Mesh(R(new THREE.BoxGeometry(ANCHO_PISTA + 3.5, 1, 0.5)), R(new THREE.MeshLambertMaterial({ color: 0x7c5cff })));
  travesano.position.copy(puntos[0]).setY(6);
  travesano.rotation.y = rumboDe(tangentes[0]);
  mundo.add(travesano);
  const grada = new THREE.Mesh(R(new THREE.BoxGeometry(4, 3, 30)), R(new THREE.MeshLambertMaterial({ color: 0x546e7a })));
  grada.position.copy(puntos[0]).addScaledVector(derechas[0], -(ANCHO_PISTA / 2 + 8)).setY(1.5);
  grada.rotation.y = rumboDe(tangentes[0]);
  mundo.add(grada);

  // Árboles fuera de la pista (instanciados: dos llamadas)
  const geoCopa = R(new THREE.ConeGeometry(2.2, 6, 8).translate(0, 5, 0));
  const geoTroncoArbol = R(new THREE.CylinderGeometry(0.3, 0.4, 2, 6).translate(0, 1, 0));
  const lugares = [];
  let semilla = 7;
  const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
  while (lugares.length < 140) {
    const x = -80 + azar() * 240;
    const z = -170 + azar() * 310;
    let lejos = true;
    for (let i = 0; i < N; i += 4) {
      if ((puntos[i].x - x) ** 2 + (puntos[i].z - z) ** 2 < 14 * 14) {
        lejos = false;
        break;
      }
    }
    if (lejos) lugares.push([x, z, 0.7 + azar() * 0.7]);
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

  // ─── Coches de la máquina ──────────────────────────────────────────────
  // Una geometría fusionada para las 4 ruedas
  const fusionar = (piezas) => {
    const datos = { position: [], normal: [], uv: [] };
    for (const [geo, matriz] of piezas) {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      g.applyMatrix4(matriz);
      for (const nombre in datos) datos[nombre].push(...g.attributes[nombre].array);
      g.dispose();
    }
    const resultado = new THREE.BufferGeometry();
    for (const nombre in datos) resultado.setAttribute(nombre, new THREE.Float32BufferAttribute(datos[nombre], nombre === 'uv' ? 2 : 3));
    return R(resultado);
  };
  const geoRueda = new THREE.CylinderGeometry(0.36, 0.36, 0.3, 14).rotateZ(Math.PI / 2);
  const geoRuedas = fusionar([[-0.85, -1.35], [0.85, -1.35], [-0.85, 1.35], [0.85, 1.35]].map(([x, z]) => [geoRueda, new THREE.Matrix4().setPosition(x, 0.36, z)]));
  geoRueda.dispose();
  const geoCarroceria = R(new THREE.BoxGeometry(1.8, 0.55, 4.2).translate(0, 0.6, 0));
  const geoHabitaculo = R(new THREE.BoxGeometry(1.5, 0.5, 1.9).translate(0, 1.12, 0.35));
  const matRueda = R(new THREE.MeshLambertMaterial({ color: 0x1a1a1a }));
  const matCristal = R(new THREE.MeshStandardMaterial({ color: 0x223344, roughness: 0.1, metalness: 0.4 }));
  const rivales = [0x1e88e5, 0xfdd835, 0x43a047].map((color, i) => {
    const coche = new THREE.Group();
    coche.add(
      new THREE.Mesh(geoCarroceria, R(new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.3 }))),
      new THREE.Mesh(geoHabitaculo, matCristal),
      new THREE.Mesh(geoRuedas, matRueda),
    );
    mundo.add(coche);
    const sombra = ctx.crearSombra({ radio: 1.6, opacidad: 0.5 });
    sombra.scale.set(2.2, 1, 4.6);
    mundo.add(sombra);
    return { coche, sombra, s: 0, v: 0, carril: 0, base: 0, maxima: VELOCIDAD_MAX * (0.86 + i * 0.04), fase: i * 2, x: 0, z: 0 };
  });

  // ─── Cabina ────────────────────────────────────────────────────────────
  const cabina = new THREE.Group();
  conjunto.add(cabina);
  const matCarroceria = R(new THREE.MeshLambertMaterial({ color: 0xd32f2f }));
  const matInterior = R(new THREE.MeshLambertMaterial({ color: 0x2b2b2b }));
  const capo = new THREE.Mesh(R(new THREE.BoxGeometry(1.7, 0.3, 1.9)), matCarroceria);
  capo.position.set(0, 0.62, -1.65);
  const salpicadero = new THREE.Mesh(R(new THREE.BoxGeometry(1.6, 0.25, 0.35)), matInterior);
  salpicadero.position.set(0, 0.82, -0.62);
  const lados = new THREE.InstancedMesh(R(new THREE.BoxGeometry(0.12, 0.45, 2.6)), matCarroceria, 2);
  [-1, 1].forEach((s, i) => lados.setMatrixAt(i, new THREE.Matrix4().setPosition(s * 0.82, 0.6, -0.2)));
  cabina.add(capo, salpicadero, lados); // descapotable: sin parabrisas que tape la vista
  // Volante (inclinado hacia ti)
  const soporteVolante = new THREE.Group();
  soporteVolante.position.set(0, 0.92, -0.42);
  soporteVolante.rotation.x = -0.45;
  const volante = new THREE.Group();
  volante.add(
    new THREE.Mesh(R(new THREE.TorusGeometry(0.17, 0.018, 8, 32)), matInterior),
    new THREE.Mesh(R(new THREE.BoxGeometry(0.32, 0.03, 0.02)), matInterior),
    new THREE.Mesh(R(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 12).rotateX(Math.PI / 2)), matCarroceria),
  );
  soporteVolante.add(volante);
  cabina.add(soporteVolante);
  // Pantalla del salpicadero
  const pantalla = ctx.crearPanel({ ancho: 0.46, alto: 0.15, resolucion: 384 });
  pantalla.mesh.position.set(0.5, 0.99, -0.62); // a la derecha del volante, para que no la tape
  pantalla.mesh.rotation.set(-0.5, -0.35, 0, 'YXZ');
  cabina.add(pantalla.mesh);
  // Cartel grande (semáforo y llegada)
  const cartel = ctx.crearPanel({ ancho: 2.4, alto: 0.7 });
  cartel.mesh.position.set(0, 2.3, -7);
  cabina.add(cartel.mesh);

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
  let enfriamientoChoque = 0;
  let giroVolante = 0;
  let puesto = 4;
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
    // Tú sales el último, por la derecha
    const salidaJugador = N - 14;
    const p = puntos[salidaJugador];
    x = p.x + derechas[salidaJugador].x * 2.2;
    z = p.z + derechas[salidaJugador].z * 2.2;
    rumbo = rumboDe(tangentes[salidaJugador]);
    v = 0;
    indice = salidaJugador;
    vueltas = 0;
    mitad = false;
    tiempoCarrera = 0;
    puestoFinal = 0;
    [[N - 14, -2.2], [N - 7, 2.2], [N - 7, -2.2]].forEach(([s, carril], i) => {
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
    let frenar = false;
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
      frenar = izquierda.activa && (izquierda.gatillo || izquierda.apreton);
    } else {
      direccion = THREE.MathUtils.clamp(ctx.raton.ndc.x * 1.4, -1, 1);
      giroVolante = -direccion * GIRO_VOLANTE;
      acelerar = ctx.raton.pulsado;
    }
    volante.rotation.z = giroVolante;
    return { direccion, acelerar, frenar };
  }

  // ─── Física del coche ──────────────────────────────────────────────────
  function moverJugador(dt, mando) {
    if (estado !== 'carrera') {
      mando.acelerar = false;
      mando.frenar = estado === 'fin';
    }
    const maxima = enHierba ? VELOCIDAD_HIERBA : VELOCIDAD_MAX;
    if (mando.acelerar) v += ACELERACION * (1 - v / (VELOCIDAD_MAX * 1.05)) * dt;
    else v -= 2 * dt;
    if (mando.frenar) v -= FRENADA * dt;
    if (v > maxima) v = Math.max(maxima, v - 14 * dt);
    v = Math.max(0, v);

    const giro = mando.direccion * GIRO_MAX * (1 - 0.45 * (v / VELOCIDAD_MAX));
    rumbo -= (v / BATALLA) * Math.tan(giro) * dt;
    x += -Math.sin(rumbo) * v * dt;
    z += -Math.cos(rumbo) * v * dt;

    // Punto del trazado más cercano (buscando cerca del anterior)
    let mejor = indice;
    let mejorD = Infinity;
    for (let k = -15; k <= 15; k++) {
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
    const lateral = (x - puntos[indice].x) * derechas[indice].x + (z - puntos[indice].z) * derechas[indice].z;
    enHierba = Math.abs(lateral) > ANCHO_PISTA / 2 + 0.9;
    // No dejar que te alejes demasiado del circuito
    const limite = ANCHO_PISTA / 2 + 12;
    if (Math.abs(lateral) > limite) {
      const sobra = lateral - Math.sign(lateral) * limite;
      x -= derechas[indice].x * sobra;
      z -= derechas[indice].z * sobra;
    }
  }

  function moverRivales(dt, t) {
    const miProgreso = progresoJugador();
    for (const r of rivales) {
      const i = Math.floor(r.s) % N;
      let objetivo = Math.min(r.maxima, limites[(i + 12) % N], limites[(i + 6) % N]);
      // Si se escapan mucho, aflojan; si se quedan atrás, aprietan
      const diferencia = progresoRival(r) - miProgreso;
      if (diferencia > 50) objetivo *= 0.9;
      else if (diferencia < -50) objetivo *= 1.08;
      if (estado === 'salida') objetivo = 0;
      if (estado === 'fin' && progresoRival(r) >= VUELTAS * N) objetivo = 8;
      r.v += THREE.MathUtils.clamp(objetivo - r.v, -12 * dt, 6 * dt);
      r.s += (r.v * dt) / TRAMO;
      r.carril = r.base + Math.sin(t * 0.25 + r.fase) * 1.2;

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
          v *= 0.7;
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
    const kmh = Math.round(v * 3.6);
    pantalla.escribir([
      { texto: `${kmh} km/h`, tam: 1.2 },
      { texto: `Vuelta ${Math.min(VUELTAS, vueltas + 1)}/${VUELTAS} · ${puesto}º · ${formatoTiempo(tiempoCarrera)}`, tam: 0.8, color: '#ffcc80' },
    ]);
    if (estado === 'salida') {
      const n = Math.ceil(reloj - 1);
      cartel.escribir([
        { texto: n > 0 ? String(n) : '¡YA!', tam: 1.4, color: n > 0 ? '#ff5252' : '#69f0ae' },
        { texto: ctx.enVR() ? 'Volante con las dos manos · gatillo derecho acelera, izquierdo frena' : (ctx.tactil ? 'Mantén el dedo para acelerar y muévelo a los lados para girar' : 'Mantén pulsado para acelerar · mueve el ratón para girar'), tam: 0.6 },
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
    // Un poco de vibración del motor y al ir por la hierba
    cabina.position.y = Math.sin(t * 40) * 0.002 * (v / VELOCIDAD_MAX) + (enHierba && v > 3 ? Math.sin(t * 25) * 0.01 : 0);
    if (enHierba && v > 5 && ctx.enVR() && Math.sin(t * 25) > 0.95) for (const m of ctx.manos) ctx.vibrar(m, 0.2, 20);

    actualizarPantallas();
  }

  colocarEnParrilla();
  actualizarPantallas();

  return {
    actualizar,
    liberar() {
      niebla.near = nieblaOriginal.near;
      niebla.far = nieblaOriginal.far;
    },
  };
}
