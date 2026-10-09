// BÁDMINTON
// Partido contra la máquina a 11 puntos (ganando por 2); saca quien ganó el
// último punto. El volante frena mucho en el aire y cae casi en vertical, como
// el de verdad. La pista es más corta que la real y la máquina te lo devuelve
// siempre a tu alcance, para jugar sin moverte del sitio.
// En VR golpeas con la raqueta (con una ayuda suave hacia el campo rival);
// con ratón o con el dedo mueves la raqueta y devuelve sola.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const PUNTOS_SET = 11;
const G = 9.8;
const ROZAMIENTO = 0.22;       // frenado del aire: el volante no pasa de unos 6,7 m/s cayendo
const Z_RED = -2.6;
const ALTO_RED = 1.55;
const MEDIO_ANCHO = 1.7;       // pista de 3,4 m de ancho
const Z_FONDO_JUGADOR = 1.2;
const Z_FONDO_MAQUINA = Z_RED - 3.8;
const R_CABEZA = 0.12;         // cabeza de la raqueta (como un círculo)
const GROSOR_GOLPE = 0.05;
const AYUDA = 0.7;
const Z_RATON = -0.35;         // plano en el que se mueve la raqueta con ratón
const R_CONTACTO_RATON = 0.3;
const VELOCIDAD_MAQUINA = 3.2;
const FALLOS_MAQUINA = 0.07;
const ALTURA_GOLPE_MAQUINA = 1.9;

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  ctx.fondo(0x2a3550);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.7, 1.5), new THREE.Vector3(0, 1.3, -5));

  // ─── Pabellón y pista ──────────────────────────────────────────────────
  ctx.sueloBase(false);
  const escalarUV = (geo, u, v = u) => {
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
    return geo;
  };
  const suelo = new THREE.Mesh(escalarUV(R(new THREE.PlaneGeometry(16, 16).rotateX(-Math.PI / 2)), 16 / 3), R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tablas(0xc99a62, { semilla: 31 })) })));
  suelo.position.set(0, 0, -2.6);
  raiz.add(suelo);
  // Pista verde con las líneas pintadas en la textura (una sola malla)
  const largoPista = Z_FONDO_JUGADOR - Z_FONDO_MAQUINA;
  const texPista = R(ctx.texturaCanvas((g, tam, azar) => {
    g.fillStyle = '#2e7d4f';
    g.fillRect(0, 0, tam, tam);
    for (let i = 0; i < 1500; i++) {
      g.fillStyle = `rgba(255,255,255,${azar() * 0.03})`;
      g.fillRect(azar() * tam, azar() * tam, 2, 2);
    }
    g.fillStyle = '#ffffff';
    const l = tam * 0.008;
    g.fillRect(0, 0, tam, l * 1.4);
    g.fillRect(0, tam - l * 1.4, tam, l * 1.4);
    g.fillRect(0, 0, l, tam);
    g.fillRect(tam - l, 0, l, tam);
    // Líneas de saque corto a 1,2 m de la red y línea central
    const porMetro = tam / largoPista;
    const yRed = (Z_FONDO_JUGADOR - Z_RED) * porMetro; // la v crece hacia el fondo de la máquina
    for (const d of [-1.2, 1.2]) g.fillRect(0, tam - (yRed + d * porMetro) - l / 2, tam, l);
    g.fillRect(tam / 2 - l / 2, 0, l, tam);
  }, { tam: 512 }));
  const pista = new THREE.Mesh(R(new THREE.PlaneGeometry(MEDIO_ANCHO * 2, largoPista).rotateX(-Math.PI / 2)), R(new THREE.MeshLambertMaterial({ map: texPista })));
  pista.position.set(0, 0.003, (Z_FONDO_JUGADOR + Z_FONDO_MAQUINA) / 2);
  raiz.add(pista);
  // Red
  const anchoRed = MEDIO_ANCHO * 2 + 0.4;
  const texRed = R(ctx.texturaCanvas((g, tam) => {
    g.clearRect(0, 0, tam, tam);
    g.strokeStyle = 'rgba(15,15,15,0.85)';
    g.lineWidth = 2;
    for (let i = 0; i <= tam; i += 8) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, tam); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(tam, i); g.stroke();
    }
    g.fillStyle = '#f5f5f5';
    g.fillRect(0, 0, tam, tam * 0.1);
  }, { tam: 128, repetir: [anchoRed / 0.76, 1] }));
  const red = new THREE.Mesh(R(new THREE.PlaneGeometry(anchoRed, 0.76)), R(new THREE.MeshBasicMaterial({ map: texRed, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide })));
  red.position.set(0, ALTO_RED - 0.38, Z_RED);
  raiz.add(red);
  const postes = new THREE.InstancedMesh(R(new THREE.CylinderGeometry(0.025, 0.03, ALTO_RED, 8)), R(new THREE.MeshLambertMaterial({ color: 0x37474f })), 2);
  [-1, 1].forEach((s, i) => postes.setMatrixAt(i, new THREE.Matrix4().setPosition(s * anchoRed / 2, ALTO_RED / 2, Z_RED)));
  raiz.add(postes);
  // Gradas laterales (decorado)
  const gradas = new THREE.InstancedMesh(R(new THREE.BoxGeometry(1.2, 0.5, 9)), R(new THREE.MeshLambertMaterial({ color: 0x3949ab })), 6);
  for (let i = 0; i < 6; i++) {
    const s = i < 3 ? -1 : 1;
    const fila = i % 3;
    gradas.setMatrixAt(i, new THREE.Matrix4().setPosition(s * (4 + fila * 1.2), 0.25 + fila * 0.5, -2.6));
  }
  raiz.add(gradas);

  // ─── Volante ───────────────────────────────────────────────────────────
  // Corcho delante (+Z) y faldón de plumas detrás; se orienta hacia donde vuela
  const volante = new THREE.Group();
  const corcho = new THREE.Mesh(R(new THREE.SphereGeometry(0.014, 12, 8)), R(new THREE.MeshStandardMaterial({ color: 0xfafafa, roughness: 0.6 })));
  const geoFaldon = R(new THREE.CylinderGeometry(0.014, 0.033, 0.06, 14, 1, true));
  geoFaldon.rotateX(Math.PI / 2); // el extremo estrecho, pegado al corcho
  const faldon = new THREE.Mesh(geoFaldon, R(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.8, side: THREE.DoubleSide })));
  faldon.position.z = -0.035;
  volante.add(corcho, faldon);
  raiz.add(volante);
  const sombraVolante = ctx.crearSombra({ radio: 0.05, opacidad: 0.55 });
  raiz.add(sombraVolante);
  const pos = volante.position;
  const vel = new THREE.Vector3();
  const anterior = new THREE.Vector3();

  // ─── Raquetas ──────────────────────────────────────────────────────────
  // Mango en el puño, la cabeza hacia delante (-Z) y las cuerdas mirando a los lados (±X)
  const CENTRO_CABEZA = new THREE.Vector3(0, 0, -0.5);
  const geoAro = R(new THREE.TorusGeometry(R_CABEZA, 0.008, 6, 28));
  geoAro.scale(1, 1.15, 1).rotateY(Math.PI / 2);
  const geoCuerdas = R(new THREE.CircleGeometry(R_CABEZA, 24));
  geoCuerdas.scale(1, 1.15, 1).rotateY(Math.PI / 2);
  const geoVara = R(new THREE.CylinderGeometry(0.006, 0.006, 0.28, 6));
  geoVara.rotateX(Math.PI / 2);
  const geoMango = R(new THREE.CylinderGeometry(0.015, 0.016, 0.16, 10));
  geoMango.rotateX(Math.PI / 2);
  const matAro = R(new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.35, metalness: 0.3 }));
  const matCuerdas = R(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.35, side: THREE.DoubleSide, depthWrite: false }));
  const matMango = R(new THREE.MeshStandardMaterial({ color: 0x212121, roughness: 0.9 }));

  function crearRaqueta(color) {
    const r = new THREE.Group();
    const aro = new THREE.Mesh(geoAro, color || matAro);
    aro.position.copy(CENTRO_CABEZA);
    const cuerdas = new THREE.Mesh(geoCuerdas, matCuerdas);
    cuerdas.position.copy(CENTRO_CABEZA);
    const vara = new THREE.Mesh(geoVara, matAro);
    vara.position.z = -0.24;
    const mango = new THREE.Mesh(geoMango, matMango);
    mango.position.z = -0.02;
    r.add(aro, cuerdas, vara, mango);
    return r;
  }

  const raquetasVR = ctx.manos.map((mano) => ({
    mano,
    objeto: ctx.adjuntarAMano(mano, crearRaqueta()),
    centro: new THREE.Vector3(),
    centroAntes: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    normalAntes: new THREE.Vector3(),
    lista: false,
  }));
  let indiceRaqueta = null;

  // Ratón / dedo: la cabeza de la raqueta sigue al puntero en un plano vertical
  const raquetaRaton = crearRaqueta();
  raquetaRaton.rotation.y = Math.PI / 2;
  raquetaRaton.position.set(-CENTRO_CABEZA.z, -0.05, 0);
  const pivoteRaton = new THREE.Group();
  pivoteRaton.add(raquetaRaton);
  pivoteRaton.position.set(0.3, 1.5, Z_RATON);
  raiz.add(pivoteRaton);
  const planoRaton = new THREE.Plane(new THREE.Vector3(0, 0, 1), -Z_RATON);
  const velRaton = new THREE.Vector3();

  // ─── Rival ─────────────────────────────────────────────────────────────
  const rival = new THREE.Group();
  const matCamiseta = R(new THREE.MeshLambertMaterial({ color: 0xf9a825 }));
  const torso = new THREE.Mesh(R(new THREE.BoxGeometry(0.42, 0.6, 0.24)), matCamiseta);
  torso.position.y = 1.25;
  const cabeza = new THREE.Mesh(R(new THREE.SphereGeometry(0.12, 12, 10)), R(new THREE.MeshLambertMaterial({ color: 0xffcc80 })));
  cabeza.position.y = 1.7;
  const piernas = new THREE.Mesh(R(new THREE.BoxGeometry(0.34, 0.95, 0.18)), R(new THREE.MeshLambertMaterial({ color: 0x263238 })));
  piernas.position.y = 0.475;
  const raquetaRival = crearRaqueta(R(new THREE.MeshStandardMaterial({ color: 0x1e88e5, roughness: 0.35, metalness: 0.3 })));
  raquetaRival.rotation.x = Math.PI / 2 + 0.3; // apuntando hacia arriba
  raquetaRival.position.set(-0.3, 1.35, 0);
  rival.add(torso, cabeza, piernas, raquetaRival);
  rival.position.set(0, 0, Z_RED - 2.3);
  rival.rotation.y = Math.PI;
  raiz.add(rival);
  const sombraRival = ctx.crearSombra({ radio: 0.4, opacidad: 0.45 });
  raiz.add(sombraRival);
  const destinoRival = new THREE.Vector3(0, 0, Z_RED - 2.3);
  let golpeRival = 0; // animación del golpe

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 2.4, alto: 0.66 });
  marcador.mesh.position.set(0, 3.2, Z_FONDO_MAQUINA - 0.5);
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
  const velRaqueta = new THREE.Vector3();
  const simPos = new THREE.Vector3();
  const simVel = new THREE.Vector3();

  const otro = (q) => (q === 'jugador' ? 'maquina' : 'jugador');
  const dentro = (p) => Math.abs(p.x) <= MEDIO_ANCHO && p.z <= Z_FONDO_JUGADOR && p.z >= Z_FONDO_MAQUINA;

  function actualizarMarcador() {
    const lineas = [{ texto: `Tú ${tanteo.jugador}  –  ${tanteo.maquina} Máquina`, tam: 1.3 }];
    if (estado === 'intro') {
      lineas[0] = { texto: 'BÁDMINTON', tam: 1.3, color: '#a5d6a7' };
      lineas.push({
        texto: ctx.enVR() ? 'Raqueta en la mano derecha · el gatillo de la otra mano la cambia'
          : ctx.tactil ? 'Arrastra el dedo para mover la raqueta' : 'Mueve la raqueta con el ratón',
        tam: 0.7,
      });
    } else if (estado === 'saque') {
      lineas.push(sacador === 'jugador'
        ? { texto: 'Tu saque: golpea el volante', tam: 0.75, color: '#80deea' }
        : { texto: 'Saca la máquina…', tam: 0.75, color: '#ffab91' });
    } else if (estado === 'vivo') {
      lineas.push({ texto: golpesSeguidos > 2 ? `Peloteo: ${golpesSeguidos} golpes` : ' ', tam: 0.75, color: '#fff59d' });
    } else {
      lineas.push({ texto: mensaje, tam: 0.75, color: colorMensaje });
    }
    lineas.push({ texto: `A ${PUNTOS_SET} · partidos ganados: ${ganadas}`, tam: 0.6, color: '#a5d6a7' });
    marcador.escribir(lineas);
  }

  // ─── Vuelo del volante ─────────────────────────────────────────────────
  function paso(p, v, h) {
    const s = v.length();
    v.y -= G * h;
    v.addScaledVector(v, -ROZAMIENTO * s * h);
    p.addScaledVector(v, h);
  }

  // Simula un lanzamiento: devuelve la distancia horizontal hasta el suelo y si pasa la red
  function simular(origen, velocidad) {
    simPos.copy(origen);
    simVel.copy(velocidad);
    let pasaRed = true;
    for (let i = 0; i < 600; i++) {
      const zAntes = simPos.z;
      paso(simPos, simVel, 0.01);
      if ((zAntes - Z_RED) * (simPos.z - Z_RED) <= 0 && simPos.y < ALTO_RED + 0.12) pasaRed = false;
      if (simPos.y <= 0) break;
    }
    return { distancia: Math.hypot(simPos.x - origen.x, simPos.z - origen.z), pasaRed };
  }

  // Velocidad para que el volante caiga en "destino" saliendo con el ángulo dado
  // (si no pasa la red, sube el ángulo)
  function lanzamiento(origen, destino, angulo) {
    const dx = destino.x - origen.x;
    const dz = destino.z - origen.z;
    const objetivo = Math.hypot(dx, dz);
    const v = new THREE.Vector3();
    for (let intento = 0; intento < 8; intento++) {
      let bajo = 1;
      let alto = 45;
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
      angulo = Math.min(1.3, angulo + 0.12);
    }
    return v;
  }

  // Dónde estará el volante cuando baje a esa altura (o null)
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
    reloj = sacador === 'maquina' ? 1.3 : 0;
    golpeador = null;
    golpesSeguidos = 0;
    tiempoVivo = 0;
    vel.set(0, 0, 0);
    if (sacador === 'jugador') pos.set(0.2, 1.25, -0.45);
    else pos.set(rival.position.x - 0.2, 1.3, rival.position.z + 0.4);
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
    enfriamiento = 0.2;
    ctx.sonido('toc');
    return true;
  }

  function tocaSuelo() {
    // Si cae dentro, punto para el que NO es de ese lado; si cae fuera, punto contra quien lo golpeó
    if (dentro(pos)) {
      const lado = pos.z > Z_RED ? 'jugador' : 'maquina';
      puntoPara(otro(lado), lado === 'jugador' ? 'Ha caído en tu campo' : '¡Punto!');
    } else {
      puntoPara(otro(golpeador), golpeador === 'jugador' ? 'Fuera' : '¡Fuera! Punto para ti');
    }
  }

  // ─── Raqueta VR ────────────────────────────────────────────────────────
  function raquetasVRActualizar() {
    const activas = raquetasVR.filter((r) => r.mano.activa);
    if (indiceRaqueta === null || !ctx.manos[indiceRaqueta].activa) {
      const derecha = activas.find((r) => r.mano.lado === 'right') || activas[0];
      indiceRaqueta = derecha ? derecha.mano.indice : null;
    }
    const libre = activas.find((r) => r.mano.indice !== indiceRaqueta);
    if (libre && libre.mano.gatilloPulsado) {
      indiceRaqueta = libre.mano.indice;
      ctx.vibrar(libre.mano, 0.3, 40);
    }
    let activa = null;
    for (const r of raquetasVR) {
      const esta = r.mano.indice === indiceRaqueta && r.mano.activa;
      r.objeto.visible = esta;
      if (!esta) {
        r.lista = false;
        continue;
      }
      r.centroAntes.copy(r.centro);
      r.normalAntes.copy(r.normal);
      r.mano.grip.localToWorld(r.centro.copy(CENTRO_CABEZA));
      r.normal.set(1, 0, 0).transformDirection(r.mano.grip.matrixWorld);
      if (!r.lista) {
        r.centroAntes.copy(r.centro);
        r.normalAntes.copy(r.normal);
        r.lista = true;
      }
      activa = r;
    }
    return activa;
  }

  function chocarRaqueta(r, f, dt) {
    const centro = tmp.lerpVectors(r.centroAntes, r.centro, f);
    const normal = tmp2.lerpVectors(r.normalAntes, r.normal, f).normalize();
    const d = relativa.subVectors(pos, centro).dot(normal);
    const enPlano = relativa.addScaledVector(normal, -d).length();
    if (enPlano > R_CABEZA * 1.15 || Math.abs(d) > GROSOR_GOLPE) return false;
    velRaqueta.subVectors(r.centro, r.centroAntes).divideScalar(Math.max(dt, 1e-4));
    relativa.subVectors(vel, velRaqueta);
    const vn = relativa.dot(normal);
    if (vn * Math.sign(d || 1) >= 0) return false;
    if (!golpe('jugador')) return false;
    // El volante sale casi con la velocidad de la raqueta (las cuerdas rebotan mucho)
    vel.copy(velRaqueta).add(relativa.addScaledVector(normal, -1.8 * vn));
    pos.copy(centro).addScaledVector(normal, Math.sign(d || 1) * (GROSOR_GOLPE + 0.005));
    ayudar();
    ctx.vibrar(r.mano, 0.5, 40);
    return true;
  }

  // Corrige un poco el golpe VR para que caiga dentro del campo rival
  function ayudar() {
    if (vel.z > -0.5) return;
    const angulo = THREE.MathUtils.clamp(Math.atan2(vel.y, Math.hypot(vel.x, vel.z)), 0.15, 1.1);
    const r = simular(pos, vel);
    const dir = tmp2.set(vel.x, 0, vel.z).normalize();
    const caida = tmp.copy(pos).addScaledVector(dir, r.distancia);
    const destino = new THREE.Vector3(
      THREE.MathUtils.clamp(caida.x, -MEDIO_ANCHO + 0.25, MEDIO_ANCHO - 0.25),
      0,
      THREE.MathUtils.clamp(caida.z, Z_FONDO_MAQUINA + 0.3, Z_RED - 0.8),
    );
    vel.lerp(lanzamiento(pos, destino, angulo), AYUDA);
  }

  // ─── Raqueta con ratón ─────────────────────────────────────────────────
  function raquetaRatonActualizar(dt) {
    const r = ctx.raton;
    pivoteRaton.visible = r.dentro || ctx.tactil;
    if (r.rayo.ray.intersectPlane(planoRaton, tmp)) {
      tmp.x = THREE.MathUtils.clamp(tmp.x, -MEDIO_ANCHO, MEDIO_ANCHO);
      tmp.y = THREE.MathUtils.clamp(tmp.y, 0.4, 2.7);
      velRaton.subVectors(tmp, pivoteRaton.position).divideScalar(Math.max(dt, 1e-3));
      pivoteRaton.position.lerp(tmp, Math.min(1, dt * 25));
    }
    pivoteRaton.rotation.z = THREE.MathUtils.clamp(-velRaton.x * 0.05, -0.5, 0.5);

    const cerca = Math.hypot(pos.x - pivoteRaton.position.x, pos.y - pivoteRaton.position.y) < R_CONTACTO_RATON &&
      Math.abs(pos.z - Z_RATON) < 0.3;
    const viene = estado === 'saque' ? sacador === 'jugador' : vel.z > 0;
    if (cerca && viene && golpe('jugador')) {
      // Dirección según dónde da en la raqueta; moverla rápido es remate (más plano y fuerte)
      const desvio = (pos.x - pivoteRaton.position.x) / R_CONTACTO_RATON;
      const remate = THREE.MathUtils.clamp(r.velocidadPx / 2500, 0, 1);
      const destino = new THREE.Vector3(
        THREE.MathUtils.clamp(desvio * 1.2 + velRaton.x * 0.15, -MEDIO_ANCHO + 0.2, MEDIO_ANCHO - 0.2),
        0,
        remate > 0.5 ? Z_RED - 1.2 - Math.random() * 1.2 : Z_FONDO_MAQUINA + 0.4 + Math.random() * 1.8,
      );
      pos.z = Math.min(pos.z, Z_RATON - 0.05);
      vel.copy(lanzamiento(pos, destino, remate > 0.5 ? 0.2 : 0.75));
    }
  }

  // ─── Máquina ───────────────────────────────────────────────────────────
  function maquina(dt) {
    let destino = null;
    if (estado === 'vivo' && golpeador === 'jugador' && vel.z < 0) destino = predecir(ALTURA_GOLPE_MAQUINA) || predecir(1.0);
    if (destino) destinoRival.set(THREE.MathUtils.clamp(destino.x + 0.3, -MEDIO_ANCHO - 0.5, MEDIO_ANCHO + 0.5), 0, THREE.MathUtils.clamp(destino.z - 0.3, Z_FONDO_MAQUINA - 0.5, Z_RED - 0.4));
    else if (estado !== 'saque') destinoRival.set(0, 0, Z_RED - 2.3);
    const mover = tmp2.subVectors(destinoRival, rival.position).setY(0);
    const maximo = VELOCIDAD_MAQUINA * dt;
    if (mover.length() > maximo) mover.setLength(maximo);
    rival.position.add(mover);
    ctx.colocarSombra(sombraRival, rival.position, 0);
    golpeRival = Math.max(0, golpeRival - dt * 4);
    raquetaRival.rotation.x = Math.PI / 2 + 0.3 - Math.sin(golpeRival * Math.PI) * 1.2;

    const devolver = () => {
      golpeRival = 1;
      const falla = Math.random() < FALLOS_MAQUINA;
      // Siempre a tu alcance: cae junto a ti, a tu izquierda o derecha
      const destinoGolpe = new THREE.Vector3(
        falla ? (Math.random() < 0.5 ? -1 : 1) * (MEDIO_ANCHO + 0.4) : (Math.random() - 0.5) * 1.4,
        0,
        falla ? Z_FONDO_JUGADOR + 0.6 : 0.15 + Math.random() * 0.6,
      );
      const angulo = Math.random() < 0.6 ? 0.9 : 0.55; // globo o golpe más tenso
      vel.copy(lanzamiento(pos, destinoGolpe, angulo));
    };

    if (estado === 'saque' && sacador === 'maquina' && reloj <= 0 && golpe('maquina')) {
      devolver();
      return;
    }
    if (estado === 'vivo' && golpeador === 'jugador' && pos.z < Z_RED && pos.y > 0.5 && pos.y < 2.7 &&
        Math.hypot(pos.x - (rival.position.x - 0.3), pos.z - rival.position.z) < 0.6 && golpe('maquina')) {
      devolver();
    }
  }

  // ─── Física del volante ────────────────────────────────────────────────
  function moverVolante(dt, raqueta) {
    const rapidez = Math.max(vel.length(), raqueta ? raqueta.centro.distanceTo(raqueta.centroAntes) / dt : 0);
    const pasos = Math.min(24, Math.max(1, Math.ceil((rapidez * dt) / 0.02)));
    const h = dt / pasos;
    for (let i = 1; i <= pasos; i++) {
      anterior.copy(pos);
      paso(pos, vel, h);
      // Red: si la cruza por debajo del borde, se frena y cae
      if ((anterior.z - Z_RED) * (pos.z - Z_RED) <= 0 && pos.y < ALTO_RED && pos.y > ALTO_RED - 0.76 && Math.abs(pos.x) < anchoRed / 2) {
        pos.z = Z_RED + Math.sign(anterior.z - Z_RED) * 0.03;
        vel.set(vel.x * 0.2, Math.min(vel.y, 0), -vel.z * 0.1);
        ctx.sonido('zas');
      }
      if (raqueta && chocarRaqueta(raqueta, i / pasos, dt)) continue;
      if (pos.y <= 0.02) {
        pos.y = 0.02;
        vel.set(0, 0, 0);
        tocaSuelo();
        break;
      }
    }
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
    let raqueta = null;
    if (vr) {
      pivoteRaton.visible = false;
      raqueta = raquetasVRActualizar();
    } else {
      for (const r of raquetasVR) r.objeto.visible = false;
      raquetaRatonActualizar(dt);
    }

    switch (estado) {
      case 'intro':
        if (reloj <= 0) empezarPartido();
        break;
      case 'saque':
        if (sacador === 'jugador') {
          pos.y = 1.25 + Math.sin(t * 3) * 0.03;
          if (raqueta) {
            const pasos = Math.min(24, Math.max(1, Math.ceil(raqueta.centro.distanceTo(raqueta.centroAntes) / 0.02)));
            for (let i = 1; i <= pasos; i++) if (chocarRaqueta(raqueta, i / pasos, dt)) break;
          }
        } else {
          pos.set(rival.position.x - 0.2, 1.3, rival.position.z + 0.4);
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
    if (estado === 'vivo') moverVolante(dt, raqueta);

    // El volante mira hacia donde vuela (el corcho delante)
    if (vel.lengthSq() > 0.01) volante.lookAt(tmp.copy(pos).add(vel));
    else volante.rotation.set(Math.PI / 2, 0, 0); // en reposo, corcho abajo
    ctx.colocarSombra(sombraVolante, pos, 0);
    actualizarMarcador();
  }

  prepararSaque();
  estado = 'intro';
  reloj = 3;
  actualizarMarcador();

  return {
    actualizar,
    liberar() {},
  };
}
