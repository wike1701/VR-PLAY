// VÓLEY PLAYA
// Uno contra uno contra la máquina, a 11 puntos (ganando por 2); saca quien
// ganó el último punto. Cada lado devuelve el balón de un solo toque.
// En VR golpeas el balón con las manos (con una ayuda suave hacia el campo
// rival); con ratón o con el dedo mueves las manos y devuelven solas.
// La red es más baja que la real y la máquina te lo manda a tu alcance.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const PUNTOS_SET = 11;
const G = 9.8;
const ROZAMIENTO = 0.012;
const R_BALON = 0.105;
const R_MANO = 0.1;
const Z_RED = -3;
const ALTO_RED = 2.0;          // la reglamentaria es 2,24 (mujeres) o 2,43 (hombres)
const BANDA_RED = 1.0;
const MEDIO_ANCHO = 3;
const Z_FONDO_JUGADOR = 1.5;
const Z_FONDO_MAQUINA = Z_RED - 4.5;
const REBOTE_MANO = 0.6;
const AYUDA = 0.75;
const Z_RATON = -0.4;
const R_CONTACTO_RATON = 0.32;
const VELOCIDAD_MAQUINA = 3.4;
const FALLOS_MAQUINA = 0.07;

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  ctx.fondo(0x8fd3f5);
  const niebla = ctx.escena.fog;
  const nieblaOriginal = { near: niebla.near, far: niebla.far };
  niebla.near = 25;
  niebla.far = 70;
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.8, 1.6), new THREE.Vector3(0, 1.5, -5));

  // ─── Playa ─────────────────────────────────────────────────────────────
  ctx.sueloBase(false);
  const escalarUV = (geo, u, v = u) => {
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
    return geo;
  };
  const arena = new THREE.Mesh(
    escalarUV(R(new THREE.PlaneGeometry(40, 30).rotateX(-Math.PI / 2)), 40 / 2.5, 30 / 2.5),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.grano(0xe6c890, { cantidad: 2600, tamMin: 0.5, tamMax: 1.6, contraste: 0.16, semilla: 13 })) })),
  );
  arena.position.set(0, 0, -5);
  raiz.add(arena);
  const mar = new THREE.Mesh(R(new THREE.PlaneGeometry(200, 80).rotateX(-Math.PI / 2)), R(new THREE.MeshStandardMaterial({ color: 0x1f84c4, roughness: 0.15, metalness: 0.1 })));
  mar.position.set(0, -0.05, -60);
  raiz.add(mar);
  const orilla = new THREE.Mesh(R(new THREE.PlaneGeometry(200, 1.2).rotateX(-Math.PI / 2)), R(new THREE.MeshBasicMaterial({ color: 0xf2f7f7 })));
  orilla.position.set(0, 0.002, -20.2);
  raiz.add(orilla);

  // Líneas de la pista (cintas) en una malla instanciada
  const geoCinta = R(new THREE.BoxGeometry(1, 0.012, 1));
  const cintas = new THREE.InstancedMesh(geoCinta, R(new THREE.MeshLambertMaterial({ color: 0x1565c0 })), 5);
  const largo = Z_FONDO_JUGADOR - Z_FONDO_MAQUINA;
  const centroZ = (Z_FONDO_JUGADOR + Z_FONDO_MAQUINA) / 2;
  const cinta = (i, x, z, sx, sz) => cintas.setMatrixAt(i, new THREE.Matrix4().compose(new THREE.Vector3(x, 0.006, z), new THREE.Quaternion(), new THREE.Vector3(sx, 1, sz)));
  cinta(0, -MEDIO_ANCHO, centroZ, 0.06, largo);
  cinta(1, MEDIO_ANCHO, centroZ, 0.06, largo);
  cinta(2, 0, Z_FONDO_JUGADOR, MEDIO_ANCHO * 2, 0.06);
  cinta(3, 0, Z_FONDO_MAQUINA, MEDIO_ANCHO * 2, 0.06);
  cinta(4, 0, Z_RED, MEDIO_ANCHO * 2, 0.06);
  raiz.add(cintas);

  // Red y postes
  const anchoRed = MEDIO_ANCHO * 2 + 0.6;
  const texRed = R(ctx.texturaCanvas((g, tam) => {
    g.clearRect(0, 0, tam, tam);
    g.strokeStyle = 'rgba(20,20,20,0.85)';
    g.lineWidth = 2;
    for (let i = 0; i <= tam; i += 10) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, tam); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(tam, i); g.stroke();
    }
    g.fillStyle = '#1565c0';
    g.fillRect(0, 0, tam, tam * 0.08);
  }, { tam: 128, repetir: [anchoRed / BANDA_RED, 1] }));
  const red = new THREE.Mesh(R(new THREE.PlaneGeometry(anchoRed, BANDA_RED)), R(new THREE.MeshBasicMaterial({ map: texRed, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide })));
  red.position.set(0, ALTO_RED - BANDA_RED / 2, Z_RED);
  raiz.add(red);
  const postes = new THREE.InstancedMesh(R(new THREE.CylinderGeometry(0.05, 0.05, ALTO_RED + 0.1, 10)), R(new THREE.MeshLambertMaterial({ color: 0xeeeeee })), 2);
  [-1, 1].forEach((s, i) => postes.setMatrixAt(i, new THREE.Matrix4().setPosition(s * anchoRed / 2, (ALTO_RED + 0.1) / 2, Z_RED)));
  raiz.add(postes);

  // Palmeras: troncos y hojas instanciados (dos llamadas de dibujo)
  const geoTronco = R(new THREE.CylinderGeometry(0.12, 0.2, 5, 7).translate(0, 2.5, 0));
  const geoHoja = R(new THREE.ConeGeometry(0.5, 2.6, 4).rotateZ(Math.PI / 2).translate(1.2, 0, 0).scale(1, 0.25, 1));
  const lugares = [[-8.5, -3], [8.5, -4], [-9, -11], [10, -13], [-5, -16], [10, 3], [-12, 4]];
  const troncos = new THREE.InstancedMesh(geoTronco, R(new THREE.MeshLambertMaterial({ color: 0x8d6e4a })), lugares.length);
  const hojas = new THREE.InstancedMesh(geoHoja, R(new THREE.MeshLambertMaterial({ color: 0x3f8f3a })), lugares.length * 6);
  const m4 = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  lugares.forEach(([x, z], i) => {
    const inclinacion = (i % 2 ? 1 : -1) * 0.12;
    troncos.setMatrixAt(i, m4.compose(new THREE.Vector3(x, 0, z), q.setFromEuler(new THREE.Euler(0, 0, inclinacion)), new THREE.Vector3(1, 1, 1)));
    for (let k = 0; k < 6; k++) {
      const giro = (k / 6) * Math.PI * 2 + i;
      hojas.setMatrixAt(i * 6 + k, m4.compose(
        new THREE.Vector3(x - Math.sin(inclinacion) * 5, 5, z),
        q.setFromEuler(new THREE.Euler(0, giro, -0.35)),
        new THREE.Vector3(1, 1, 1),
      ));
    }
  });
  raiz.add(troncos, hojas);

  // ─── Balón ─────────────────────────────────────────────────────────────
  const texBalon = R(ctx.texturaCanvas((g, tam) => {
    const colores = ['#ffd600', '#1e63c6', '#fafafa', '#ffd600', '#1e63c6', '#fafafa'];
    colores.forEach((c, i) => {
      g.fillStyle = c;
      g.fillRect(0, (i * tam) / colores.length, tam, tam / colores.length + 1);
    });
    g.strokeStyle = 'rgba(0,0,0,0.25)';
    g.lineWidth = 2;
    for (let i = 1; i < colores.length; i++) {
      g.beginPath(); g.moveTo(0, (i * tam) / colores.length); g.lineTo(tam, (i * tam) / colores.length); g.stroke();
    }
  }, { tam: 128 }));
  const balon = new THREE.Mesh(R(new THREE.SphereGeometry(R_BALON, 24, 16)), R(new THREE.MeshStandardMaterial({ map: texBalon, roughness: 0.45 })));
  raiz.add(balon);
  const sombraBalon = ctx.crearSombra({ radio: 0.14, opacidad: 0.5 });
  raiz.add(sombraBalon);
  const pos = balon.position;
  const vel = new THREE.Vector3();
  const anterior = new THREE.Vector3();

  // ─── Manos ─────────────────────────────────────────────────────────────
  // Al sujetar el mando, la mano real queda de canto: la palma mira hacia dentro
  // (hacia la otra mano), los dedos hacia delante y el pulgar arriba. El modelo
  // se construye igual, en el espacio del mando (-Z delante, +Y arriba), y se
  // fusiona en una sola geometría por mano (una llamada de dibujo cada una).
  const fusionar = (piezas) => {
    const datos = { position: [], normal: [], uv: [] };
    for (const [geo, matriz] of piezas) {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      g.applyMatrix4(matriz);
      for (const nombre in datos) datos[nombre].push(...g.attributes[nombre].array);
      g.dispose();
      geo.dispose();
    }
    const resultado = new THREE.BufferGeometry();
    for (const nombre in datos) resultado.setAttribute(nombre, new THREE.Float32BufferAttribute(datos[nombre], nombre === 'uv' ? 2 : 3));
    return R(resultado);
  };
  // lado: -1 izquierda, 1 derecha. La palma mira hacia "dentro" (-lado en X).
  function geometriaMano(lado) {
    const dentro = -lado;
    const pieza = (geo, x, y, z, rx = 0, ry = 0) =>
      [geo, new THREE.Matrix4().compose(new THREE.Vector3(x, y, z), new THREE.Quaternion().setFromEuler(new THREE.Euler(rx, ry, 0, 'YXZ')), new THREE.Vector3(1, 1, 1))];
    // Dedo: cápsula a lo largo de Z que empieza en el nudillo y va hacia delante.
    // Un giro en Y de -dentro lleva la punta hacia el lado de la palma.
    const dedo = (largo, radio) => new THREE.CapsuleGeometry(radio, largo, 3, 8).rotateX(Math.PI / 2).translate(0, 0, -largo / 2);
    return fusionar([
      pieza(new THREE.BoxGeometry(0.03, 0.082, 0.085), 0, 0, -0.005),                // palma
      pieza(new THREE.CapsuleGeometry(0.024, 0.02, 3, 10).rotateX(Math.PI / 2), 0, -0.004, 0.05), // muñeca
      pieza(dedo(0.05, 0.0095), dentro * 0.004, 0.029, -0.05, 0, -dentro * 0.12),  // índice
      pieza(dedo(0.056, 0.0095), dentro * 0.004, 0.009, -0.05, 0, -dentro * 0.12), // corazón
      pieza(dedo(0.051, 0.009), dentro * 0.004, -0.011, -0.05, 0, -dentro * 0.12), // anular
      pieza(dedo(0.042, 0.0085), dentro * 0.004, -0.03, -0.045, 0, -dentro * 0.12), // meñique
      pieza(dedo(0.042, 0.011), dentro * 0.014, 0.04, -0.01, 0.55, -dentro * 0.5),  // pulgar, arriba y hacia dentro
    ]);
  }
  const geoManos = { izquierda: geometriaMano(-1), derecha: geometriaMano(1) };
  const matMano = R(new THREE.MeshLambertMaterial({ color: 0xffcc80 }));
  const OFFSET_MANO = new THREE.Vector3(0, 0, -0.035); // centro de la zona que golpea (palma y dedos)
  const manosVR = ctx.manos.map((mano) => {
    // Se crean las dos versiones y se enseña la que toca cuando se sabe qué mando es
    const izquierda = ctx.adjuntarAMano(mano, new THREE.Mesh(geoManos.izquierda, matMano));
    const derecha = ctx.adjuntarAMano(mano, new THREE.Mesh(geoManos.derecha, matMano));
    return { mano, izquierda, derecha, centro: new THREE.Vector3(), centroAntes: new THREE.Vector3(), lista: false };
  });

  // Ratón / dedo: un par de manos juntas, palmas enfrentadas y dedos hacia arriba, que siguen al puntero
  const parRaton = new THREE.Group();
  for (const s of [-1, 1]) {
    const m = new THREE.Mesh(s < 0 ? geoManos.izquierda : geoManos.derecha, matMano);
    m.position.x = s * 0.06;
    m.rotation.x = 0.9;
    parRaton.add(m);
  }
  parRaton.position.set(0, 1.4, Z_RATON);
  raiz.add(parRaton);
  const planoRaton = new THREE.Plane(new THREE.Vector3(0, 0, 1), -Z_RATON);
  const velRaton = new THREE.Vector3();

  // ─── Rival ─────────────────────────────────────────────────────────────
  const rival = new THREE.Group();
  const torso = new THREE.Mesh(R(new THREE.BoxGeometry(0.42, 0.6, 0.24)), R(new THREE.MeshLambertMaterial({ color: 0xe53935 })));
  torso.position.y = 1.25;
  const matPiel = R(new THREE.MeshLambertMaterial({ color: 0xd9a066 }));
  const cabeza = new THREE.Mesh(R(new THREE.SphereGeometry(0.12, 12, 10)), matPiel);
  cabeza.position.y = 1.7;
  const piernas = new THREE.Mesh(R(new THREE.BoxGeometry(0.34, 0.95, 0.18)), matPiel);
  piernas.position.y = 0.475;
  const brazos = new THREE.Mesh(R(new THREE.BoxGeometry(0.62, 0.09, 0.09)), matPiel);
  brazos.position.set(0, 1.45, 0.05);
  rival.add(torso, cabeza, piernas, brazos);
  rival.position.set(0, 0, Z_RED - 2.5);
  raiz.add(rival);
  const sombraRival = ctx.crearSombra({ radio: 0.4, opacidad: 0.45 });
  raiz.add(sombraRival);
  const destinoRival = new THREE.Vector3(0, 0, Z_RED - 2.5);
  let saltoRival = 0;

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 2.6, alto: 0.7 });
  marcador.mesh.position.set(0, 3.6, Z_FONDO_MAQUINA - 1);
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'saque' | 'vivo' | 'punto' | 'fin'
  let reloj = 3;
  const tanteo = { jugador: 0, maquina: 0 };
  let sacador = 'jugador';
  let golpeador = null;
  let enfriamiento = 0;
  let golpesSeguidos = 0;
  let tiempoVivo = 0;
  let mensaje = '';
  let colorMensaje = '#ffffff';
  let ganadas = ctx.leer('ganadas', 0);

  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const relativa = new THREE.Vector3();
  const velMano = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const simPos = new THREE.Vector3();
  const simVel = new THREE.Vector3();

  const otro = (q) => (q === 'jugador' ? 'maquina' : 'jugador');
  const dentro = (p) => Math.abs(p.x) <= MEDIO_ANCHO + R_BALON && p.z <= Z_FONDO_JUGADOR + R_BALON && p.z >= Z_FONDO_MAQUINA - R_BALON;

  function actualizarMarcador() {
    const lineas = [{ texto: `Tú ${tanteo.jugador}  –  ${tanteo.maquina} Máquina`, tam: 1.3 }];
    if (estado === 'intro') {
      lineas[0] = { texto: 'VÓLEY PLAYA', tam: 1.3, color: '#ffe082' };
      lineas.push({
        texto: ctx.enVR() ? 'Golpea el balón con las manos hacia el otro campo'
          : ctx.tactil ? 'Arrastra el dedo para colocar las manos' : 'Coloca las manos con el ratón',
        tam: 0.7,
      });
    } else if (estado === 'saque') {
      lineas.push(sacador === 'jugador'
        ? { texto: 'Tu saque: golpea el balón', tam: 0.75, color: '#80deea' }
        : { texto: 'Saca la máquina…', tam: 0.75, color: '#ffab91' });
    } else if (estado === 'vivo') {
      lineas.push({ texto: golpesSeguidos > 2 ? `Peloteo: ${golpesSeguidos} toques` : ' ', tam: 0.75, color: '#fff59d' });
    } else {
      lineas.push({ texto: mensaje, tam: 0.75, color: colorMensaje });
    }
    lineas.push({ texto: `A ${PUNTOS_SET} · partidos ganados: ${ganadas}`, tam: 0.6, color: '#ffe082' });
    marcador.escribir(lineas);
  }

  // ─── Vuelo del balón ───────────────────────────────────────────────────
  function paso(p, v, h) {
    const s = v.length();
    v.y -= G * h;
    v.addScaledVector(v, -ROZAMIENTO * s * h);
    p.addScaledVector(v, h);
  }

  function simular(origen, velocidad) {
    simPos.copy(origen);
    simVel.copy(velocidad);
    let pasaRed = true;
    for (let i = 0; i < 600; i++) {
      const zAntes = simPos.z;
      paso(simPos, simVel, 0.01);
      if ((zAntes - Z_RED) * (simPos.z - Z_RED) <= 0 && simPos.y < ALTO_RED + R_BALON + 0.15) pasaRed = false;
      if (simPos.y <= R_BALON) break;
    }
    return { distancia: Math.hypot(simPos.x - origen.x, simPos.z - origen.z), pasaRed };
  }

  // Velocidad para caer en "destino" saliendo con ese ángulo (lo sube si no pasa la red)
  function lanzamiento(origen, destino, angulo) {
    const dx = destino.x - origen.x;
    const dz = destino.z - origen.z;
    const objetivo = Math.hypot(dx, dz);
    const v = new THREE.Vector3();
    for (let intento = 0; intento < 8; intento++) {
      let bajo = 1;
      let alto = 30;
      let pasaRed = true;
      for (let i = 0; i < 18; i++) {
        const s = (bajo + alto) / 2;
        v.set((dx / objetivo) * s * Math.cos(angulo), s * Math.sin(angulo), (dz / objetivo) * s * Math.cos(angulo));
        const r = simular(origen, v);
        pasaRed = r.pasaRed;
        if (r.distancia < objetivo) bajo = s;
        else alto = s;
      }
      if (pasaRed) break;
      angulo = Math.min(1.35, angulo + 0.12);
    }
    return v;
  }

  function predecir(altura) {
    simPos.copy(pos);
    simVel.copy(vel);
    for (let i = 0; i < 400; i++) {
      paso(simPos, simVel, 0.01);
      if (simVel.y < 0 && simPos.y <= altura) return simPos;
    }
    return null;
  }

  // ─── Reglas ────────────────────────────────────────────────────────────
  function prepararSaque() {
    estado = 'saque';
    reloj = sacador === 'maquina' ? 1.4 : 0;
    golpeador = null;
    golpesSeguidos = 0;
    tiempoVivo = 0;
    vel.set(0, 0, 0);
    if (sacador === 'jugador') pos.set(0.15, 1.35, -0.45);
    else pos.set(rival.position.x, 1.9, rival.position.z + 0.35);
  }

  function puntoPara(quien, texto) {
    if (estado !== 'vivo') return;
    tanteo[quien] += 1;
    mensaje = texto;
    colorMensaje = quien === 'jugador' ? '#b9f6ca' : '#ff8a80';
    ctx.sonido(quien === 'jugador' ? 'punto' : 'fallo');
    if (quien === 'jugador') for (const m of ctx.manos) ctx.vibrar(m, 0.4, 60);
    sacador = quien;
    const j = tanteo.jugador;
    const m = tanteo.maquina;
    if ((j >= PUNTOS_SET || m >= PUNTOS_SET) && Math.abs(j - m) >= 2) {
      estado = 'fin';
      reloj = 7;
      if (j > m) {
        ganadas += 1;
        ctx.guardar('ganadas', ganadas);
        mensaje = '¡HAS GANADO EL PARTIDO!';
        ctx.sonido('ovacion');
      } else {
        mensaje = 'Gana la máquina. ¡A por la revancha!';
      }
      ctx.sonido('fin');
      return;
    }
    estado = 'punto';
    reloj = 1.6;
  }

  function golpe(quien) {
    if (enfriamiento > 0) return false;
    if (estado === 'saque') {
      if (quien !== sacador) return false;
      estado = 'vivo';
    } else if (estado !== 'vivo' || golpeador === quien) {
      return false;
    }
    golpeador = quien;
    golpesSeguidos += 1;
    enfriamiento = 0.25;
    ctx.sonido('bote');
    return true;
  }

  function tocaSuelo() {
    ctx.sonido('grava');
    if (dentro(pos)) {
      const lado = pos.z > Z_RED ? 'jugador' : 'maquina';
      puntoPara(otro(lado), lado === 'jugador' ? 'Ha caído en tu campo' : '¡Punto!');
    } else {
      puntoPara(otro(golpeador), golpeador === 'jugador' ? 'Fuera' : '¡Fuera! Punto para ti');
    }
  }

  // ─── Manos VR ──────────────────────────────────────────────────────────
  function manosVRActualizar() {
    const activas = [];
    for (const m of manosVR) {
      // Mano izquierda o derecha según el mando (si aún no se sabe, el primero es el izquierdo)
      const esIzquierda = m.mano.lado ? m.mano.lado === 'left' : m.mano.indice === 0;
      m.izquierda.visible = esIzquierda;
      m.derecha.visible = !esIzquierda;
      if (!m.mano.activa) {
        m.lista = false;
        continue;
      }
      m.centroAntes.copy(m.centro);
      m.mano.grip.localToWorld(m.centro.copy(OFFSET_MANO));
      if (!m.lista) {
        m.centroAntes.copy(m.centro);
        m.lista = true;
      }
      activas.push(m);
    }
    return activas;
  }

  function chocarMano(m, f, dt) {
    const centro = tmp.lerpVectors(m.centroAntes, m.centro, f);
    normal.subVectors(pos, centro);
    const d = normal.length();
    if (d > R_BALON + R_MANO || d < 1e-6) return false;
    normal.divideScalar(d);
    velMano.subVectors(m.centro, m.centroAntes).divideScalar(Math.max(dt, 1e-4));
    relativa.subVectors(vel, velMano);
    const vn = relativa.dot(normal);
    if (vn >= 0) return false;
    if (!golpe('jugador')) return false;
    vel.copy(velMano).add(relativa.addScaledVector(normal, -(1 + REBOTE_MANO) * vn));
    pos.copy(centro).addScaledVector(normal, R_BALON + R_MANO + 0.005);
    ayudar();
    ctx.vibrar(m.mano, 0.6, 50);
    return true;
  }

  // Corrige un poco el golpe para que vaya alto y caiga en el campo rival
  function ayudar() {
    if (vel.z > -0.3 && vel.y < 2) return; // lo ha tirado hacia atrás o hacia abajo: sin ayuda
    const angulo = THREE.MathUtils.clamp(Math.atan2(vel.y, Math.max(0.1, Math.hypot(vel.x, vel.z))), 0.5, 1.25);
    const destino = new THREE.Vector3(
      THREE.MathUtils.clamp(pos.x + vel.x * 0.6, -MEDIO_ANCHO + 0.4, MEDIO_ANCHO - 0.4),
      0,
      THREE.MathUtils.clamp(Z_RED - 0.8 - Math.max(0, -vel.z) * 0.35, Z_FONDO_MAQUINA + 0.5, Z_RED - 0.8),
    );
    vel.lerp(lanzamiento(pos, destino, angulo), AYUDA);
  }

  // ─── Manos con ratón ───────────────────────────────────────────────────
  function manosRaton(dt) {
    const r = ctx.raton;
    parRaton.visible = r.dentro || ctx.tactil;
    if (r.rayo.ray.intersectPlane(planoRaton, tmp)) {
      tmp.x = THREE.MathUtils.clamp(tmp.x, -MEDIO_ANCHO, MEDIO_ANCHO);
      tmp.y = THREE.MathUtils.clamp(tmp.y, 0.4, 2.8);
      velRaton.subVectors(tmp, parRaton.position).divideScalar(Math.max(dt, 1e-3));
      parRaton.position.lerp(tmp, Math.min(1, dt * 25));
    }
    const cerca = Math.hypot(pos.x - parRaton.position.x, pos.y - parRaton.position.y) < R_CONTACTO_RATON &&
      Math.abs(pos.z - Z_RATON) < 0.35;
    const viene = estado === 'saque' ? sacador === 'jugador' : vel.z > 0;
    if (cerca && viene && golpe('jugador')) {
      // La dirección depende de dónde da en las manos; moverlas rápido es remate (más tenso)
      const desvio = (pos.x - parRaton.position.x) / R_CONTACTO_RATON;
      const remate = THREE.MathUtils.clamp(r.velocidadPx / 2500, 0, 1);
      const destino = new THREE.Vector3(
        THREE.MathUtils.clamp(desvio * 2 + velRaton.x * 0.2, -MEDIO_ANCHO + 0.3, MEDIO_ANCHO - 0.3),
        0,
        remate > 0.5 ? Z_RED - 1 - Math.random() * 1.5 : Z_RED - 1.5 - Math.random() * 2.5,
      );
      pos.z = Math.min(pos.z, Z_RATON - 0.05);
      vel.copy(lanzamiento(pos, destino, remate > 0.5 ? 0.45 : 0.95));
    }
  }

  // ─── Máquina ───────────────────────────────────────────────────────────
  function maquina(dt) {
    let destino = null;
    if (estado === 'vivo' && golpeador === 'jugador' && vel.z < 0) destino = predecir(1.5);
    if (destino) destinoRival.set(THREE.MathUtils.clamp(destino.x, -MEDIO_ANCHO - 0.5, MEDIO_ANCHO + 0.5), 0, THREE.MathUtils.clamp(destino.z - 0.25, Z_FONDO_MAQUINA - 0.5, Z_RED - 0.4));
    else if (estado !== 'saque') destinoRival.set(0, 0, Z_RED - 2.5);
    const mover = tmp2.subVectors(destinoRival, rival.position).setY(0);
    const maximo = VELOCIDAD_MAQUINA * dt;
    if (mover.length() > maximo) mover.setLength(maximo);
    rival.position.add(mover);
    saltoRival = Math.max(0, saltoRival - dt * 2.5);
    rival.position.y = Math.sin(saltoRival * Math.PI) * 0.35;
    brazos.position.y = 1.45 + saltoRival * 0.4;
    ctx.colocarSombra(sombraRival, tmp.set(rival.position.x, 0, rival.position.z), 0);

    const devolver = () => {
      saltoRival = 1;
      const falla = Math.random() < FALLOS_MAQUINA;
      const destinoGolpe = new THREE.Vector3(
        falla ? (Math.random() < 0.5 ? -1 : 1) * (MEDIO_ANCHO + 0.6) : (Math.random() - 0.5) * 1.6,
        0,
        falla ? Z_FONDO_JUGADOR + 0.8 : 0.1 + Math.random() * 0.6,
      );
      vel.copy(lanzamiento(pos, destinoGolpe, Math.random() < 0.7 ? 1.0 : 0.7));
    };

    if (estado === 'saque' && sacador === 'maquina' && reloj <= 0 && golpe('maquina')) {
      devolver();
      return;
    }
    if (estado === 'vivo' && golpeador === 'jugador' && pos.z < Z_RED && pos.y > 0.6 && pos.y < 2.8 &&
        Math.hypot(pos.x - rival.position.x, pos.z - rival.position.z) < 0.7 && golpe('maquina')) {
      devolver();
    }
  }

  // ─── Física del balón ──────────────────────────────────────────────────
  function moverBalon(dt, manos) {
    let rapidez = vel.length();
    for (const m of manos) rapidez = Math.max(rapidez, m.centro.distanceTo(m.centroAntes) / dt);
    const pasos = Math.min(24, Math.max(1, Math.ceil((rapidez * dt) / 0.02)));
    const h = dt / pasos;
    for (let i = 1; i <= pasos; i++) {
      anterior.copy(pos);
      paso(pos, vel, h);
      if ((anterior.z - Z_RED) * (pos.z - Z_RED) <= 0 && pos.y < ALTO_RED + R_BALON && pos.y > ALTO_RED - BANDA_RED && Math.abs(pos.x) < anchoRed / 2) {
        pos.z = Z_RED + Math.sign(anterior.z - Z_RED) * (R_BALON + 0.01);
        vel.set(vel.x * 0.3, Math.min(vel.y, 0.5), -vel.z * 0.15);
        ctx.sonido('zas');
      }
      let golpeado = false;
      for (const m of manos) if (chocarMano(m, i / pasos, dt)) golpeado = true;
      if (golpeado) continue;
      if (pos.y <= R_BALON) {
        pos.y = R_BALON;
        vel.set(0, 0, 0);
        tocaSuelo();
        break;
      }
    }
    balon.rotation.x += vel.z * dt * 3;
    balon.rotation.z -= vel.x * dt * 3;
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function empezarPartido() {
    tanteo.jugador = 0;
    tanteo.maquina = 0;
    sacador = 'jugador';
    prepararSaque();
  }

  function actualizar(dt, t) {
    reloj -= dt;
    enfriamiento = Math.max(0, enfriamiento - dt);
    const vr = ctx.enVR();
    let manos = [];
    if (vr) {
      parRaton.visible = false;
      manos = manosVRActualizar();
    } else {
      manosRaton(dt);
    }

    switch (estado) {
      case 'intro':
        if (reloj <= 0) empezarPartido();
        break;
      case 'saque':
        if (sacador === 'jugador') {
          pos.y = 1.35 + Math.sin(t * 3) * 0.04;
          for (const m of manos) {
            const pasos = Math.min(24, Math.max(1, Math.ceil(m.centro.distanceTo(m.centroAntes) / 0.02)));
            let golpeado = false;
            for (let i = 1; i <= pasos && !golpeado; i++) golpeado = chocarMano(m, i / pasos, dt);
            if (golpeado) break;
          }
        } else {
          pos.set(rival.position.x, 1.9, rival.position.z + 0.35);
        }
        break;
      case 'vivo':
        tiempoVivo += dt;
        if (tiempoVivo > 15) tocaSuelo();
        break;
      case 'punto':
        if (reloj <= 0) prepararSaque();
        break;
      case 'fin':
        if (reloj <= 0) empezarPartido();
        break;
    }

    maquina(dt);
    if (estado === 'vivo') moverBalon(dt, manos);
    ctx.colocarSombra(sombraBalon, pos, 0);
    actualizarMarcador();
  }

  prepararSaque();
  estado = 'intro';
  reloj = 3;
  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      niebla.near = nieblaOriginal.near;
      niebla.far = nieblaOriginal.far;
    },
  };
}
