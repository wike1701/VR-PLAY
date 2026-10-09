// PING PONG
// Partido contra la máquina a 11 puntos (hay que ganar por 2). El saque cambia
// cada 2 puntos. En VR llevas la pala en la mano derecha y golpeas de verdad
// (con una ayuda suave para que los buenos golpes caigan en la mesa). Con ratón
// o con el dedo mueves la pala y devuelve sola: el ángulo depende de en qué parte
// de la pala da la bola, y si mueves rápido al golpear, rematas.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const PUNTOS_SET = 11;
const G = 9.8;
// Mesa reglamentaria: 2,74 × 1,525 m, a 76 cm del suelo, red de 15,25 cm
const MESA_Y = 0.76;
const ANCHO = 1.525;
const LARGO = 2.74;
const Z_CERCA = -0.35;                 // borde de tu lado
const Z_LEJOS = Z_CERCA - LARGO;       // borde de la máquina
const Z_RED = Z_CERCA - LARGO / 2;
const ALTO_RED = 0.1525;
const R_BOLA = 0.022;                  // un poco más grande que la real (0,02) para verla bien
const REBOTE_MESA = 0.88;
const REBOTE_PALA = 0.85;
const R_PALA = 0.08;
const GROSOR_PALA = 0.012;
const AYUDA = 0.7;                     // cuánto se corrige un golpe VR hacia la mesa (0 = nada)
const Z_MAQUINA = Z_LEJOS - 0.3;       // plano donde golpea la máquina
const VELOCIDAD_MAQUINA = 2.6;         // m/s que mueve la máquina su pala (si no llega, falla)
const FALLOS_MAQUINA = 0.07;           // probabilidad de que la máquina la mande fuera
const Z_PALA_RATON = Z_CERCA + 0.2;    // plano en el que se mueve la pala con ratón
const R_CONTACTO_RATON = 0.15;

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  ctx.fondo(0x1b2338);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.4, 0.95), new THREE.Vector3(0, 0.75, -2.3));

  // ─── Sala ──────────────────────────────────────────────────────────────
  ctx.sueloBase(false);
  const METROS_PARQUET = 3;
  const geoSuelo = R(new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2));
  const uvSuelo = geoSuelo.attributes.uv;
  for (let i = 0; i < uvSuelo.count; i++) uvSuelo.setXY(i, uvSuelo.getX(i) * 14 / METROS_PARQUET, uvSuelo.getY(i) * 14 / METROS_PARQUET);
  const suelo = new THREE.Mesh(geoSuelo, R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tablas(0xb07b4a, { semilla: 9 })) })));
  suelo.position.set(0, 0, -2);
  raiz.add(suelo);
  // Vallas bajas de la pista (una sola malla)
  const geoValla = R(new THREE.BoxGeometry(1, 0.7, 0.04));
  const piezas = [];
  for (let x = -3.5; x <= 3.5; x += 1) piezas.push(new THREE.Matrix4().setPosition(x, 0.35, -6.2));
  for (let z = -5.7; z <= 0.5; z += 1) {
    for (const s of [-1, 1]) piezas.push(new THREE.Matrix4().makeRotationY(Math.PI / 2).setPosition(s * 4, 0.35, z));
  }
  const vallas = new THREE.InstancedMesh(geoValla, R(new THREE.MeshLambertMaterial({ color: 0x1565c0 })), piezas.length);
  piezas.forEach((m, i) => vallas.setMatrixAt(i, m));
  raiz.add(vallas);

  // ─── Mesa ──────────────────────────────────────────────────────────────
  // Tablero azul con las líneas blancas pintadas en la textura (una sola malla)
  const texMesa = R(ctx.texturaCanvas((g, tam, azar) => {
    g.fillStyle = '#1d4f91';
    g.fillRect(0, 0, tam, tam);
    for (let i = 0; i < 900; i++) {
      g.fillStyle = `rgba(255,255,255,${azar() * 0.03})`;
      g.fillRect(azar() * tam, azar() * tam, 2, 2);
    }
    g.fillStyle = '#ffffff';
    const borde = tam * 0.012;
    g.fillRect(0, 0, tam, borde);
    g.fillRect(0, tam - borde, tam, borde);
    g.fillRect(0, 0, borde * 1.8, tam);
    g.fillRect(tam - borde * 1.8, 0, borde * 1.8, tam);
    g.fillRect(tam / 2 - borde * 0.5, 0, borde, tam); // línea central (dobles)
  }, { tam: 512 }));
  const matPatas = R(new THREE.MeshLambertMaterial({ color: 0x37474f }));
  const tablero = new THREE.Mesh(R(new THREE.BoxGeometry(ANCHO, 0.03, LARGO)), [
    matPatas, matPatas,
    R(new THREE.MeshLambertMaterial({ map: texMesa })),
    matPatas, matPatas, matPatas,
  ]);
  tablero.position.set(0, MESA_Y - 0.015, (Z_CERCA + Z_LEJOS) / 2);
  raiz.add(tablero);
  const geoPata = R(new THREE.BoxGeometry(0.06, MESA_Y - 0.03, 0.06));
  const patas = new THREE.InstancedMesh(geoPata, matPatas, 4);
  [[-1, -1], [-1, 1], [1, -1], [1, 1]].forEach(([sx, sz], i) => {
    patas.setMatrixAt(i, new THREE.Matrix4().setPosition(sx * (ANCHO / 2 - 0.15), (MESA_Y - 0.03) / 2, Z_RED + sz * (LARGO / 2 - 0.3)));
  });
  raiz.add(patas);
  const sombraMesa = ctx.crearSombra({ radio: 1.6, opacidad: 0.4 });
  sombraMesa.scale.set(ANCHO * 1.3, 1, LARGO * 1.2);
  sombraMesa.position.set(0, 0.004, Z_RED);
  raiz.add(sombraMesa);

  // Red: malla pintada en una textura con transparencia
  const ANCHO_RED = ANCHO + 0.3;
  const texRed = R(ctx.texturaCanvas((g, tam) => {
    g.clearRect(0, 0, tam, tam);
    g.strokeStyle = 'rgba(20,20,20,0.85)';
    g.lineWidth = 2;
    for (let i = 0; i <= tam; i += 8) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i, tam); g.stroke();
      g.beginPath(); g.moveTo(0, i); g.lineTo(tam, i); g.stroke();
    }
    g.fillStyle = '#f5f5f5';
    g.fillRect(0, 0, tam, tam * 0.12); // cinta blanca de arriba
  }, { tam: 128, repetir: [ANCHO_RED / ALTO_RED / 2, 1] }));
  const red = new THREE.Mesh(R(new THREE.PlaneGeometry(ANCHO_RED, ALTO_RED)), R(new THREE.MeshBasicMaterial({ map: texRed, transparent: true, alphaTest: 0.3, side: THREE.DoubleSide })));
  red.position.set(0, MESA_Y + ALTO_RED / 2, Z_RED);
  raiz.add(red);
  const postes = new THREE.InstancedMesh(R(new THREE.CylinderGeometry(0.012, 0.012, ALTO_RED + 0.02, 8)), matPatas, 2);
  [-1, 1].forEach((s, i) => postes.setMatrixAt(i, new THREE.Matrix4().setPosition(s * ANCHO_RED / 2, MESA_Y + ALTO_RED / 2, Z_RED)));
  raiz.add(postes);

  // ─── Bola ──────────────────────────────────────────────────────────────
  const bola = new THREE.Mesh(R(new THREE.SphereGeometry(R_BOLA, 16, 12)), R(new THREE.MeshStandardMaterial({ color: 0xff8f00, roughness: 0.45, metalness: 0 })));
  raiz.add(bola);
  const sombraBola = ctx.crearSombra({ radio: 0.035, opacidad: 0.6 });
  raiz.add(sombraBola);
  const vel = new THREE.Vector3();

  // ─── Palas ─────────────────────────────────────────────────────────────
  // Mango en el puño y la hoja hacia delante (-Z); las caras miran a los lados (±X)
  const geoHoja = R(new THREE.CylinderGeometry(R_PALA, R_PALA, GROSOR_PALA, 28));
  geoHoja.rotateZ(Math.PI / 2);
  const geoMango = R(new THREE.BoxGeometry(0.024, 0.03, 0.1));
  const texMango = R(ctx.texturas.madera(0xd7a86e, { semilla: 4 }));
  const matMango = R(new THREE.MeshStandardMaterial({ map: texMango, roughness: 0.6, metalness: 0 }));
  const matGomaRoja = R(new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.75, metalness: 0 }));
  const matGomaNegra = R(new THREE.MeshStandardMaterial({ color: 0x1b1b1b, roughness: 0.75, metalness: 0 }));
  const CENTRO_HOJA = new THREE.Vector3(0, 0.01, -0.13);

  function crearPala(goma) {
    const pala = new THREE.Group();
    const hoja = new THREE.Mesh(geoHoja, goma);
    hoja.position.copy(CENTRO_HOJA);
    const mango = new THREE.Mesh(geoMango, matMango);
    mango.position.set(0, 0, -0.02);
    pala.add(hoja, mango);
    return pala;
  }

  // VR: una pala en cada mando, pero solo se ve (y golpea) la de la mano que juega
  const palasVR = ctx.manos.map((mano) => ({
    mano,
    objeto: ctx.adjuntarAMano(mano, crearPala(matGomaRoja)),
    centro: new THREE.Vector3(),
    centroAntes: new THREE.Vector3(),
    normal: new THREE.Vector3(),
    normalAntes: new THREE.Vector3(),
    lista: false,
  }));
  let indicePala = null;

  // Ratón / dedo: la pala se mueve en un plano vertical delante de la mesa
  const palaRaton = crearPala(matGomaRoja);
  palaRaton.rotation.set(0, Math.PI / 2, 0); // cara hacia la mesa
  const pivoteRaton = new THREE.Group();
  pivoteRaton.add(palaRaton);
  palaRaton.position.set(-CENTRO_HOJA.z, -CENTRO_HOJA.y, 0); // el centro de la hoja en el pivote
  pivoteRaton.position.set(0.2, MESA_Y + 0.2, Z_PALA_RATON);
  raiz.add(pivoteRaton);
  const planoRaton = new THREE.Plane(new THREE.Vector3(0, 0, 1), -Z_PALA_RATON);
  const velRaton = new THREE.Vector3();

  // ─── Rival ─────────────────────────────────────────────────────────────
  const rival = new THREE.Group();
  const matCamiseta = R(new THREE.MeshLambertMaterial({ color: 0x2e7d32 }));
  const torso = new THREE.Mesh(R(new THREE.BoxGeometry(0.42, 0.6, 0.24)), matCamiseta);
  torso.position.y = 1.25;
  const cabeza = new THREE.Mesh(R(new THREE.SphereGeometry(0.12, 12, 10)), R(new THREE.MeshLambertMaterial({ color: 0xffcc80 })));
  cabeza.position.y = 1.7;
  const piernas = new THREE.Mesh(R(new THREE.BoxGeometry(0.34, 0.95, 0.18)), R(new THREE.MeshLambertMaterial({ color: 0x263238 })));
  piernas.position.y = 0.475;
  rival.add(torso, cabeza, piernas);
  rival.position.set(0, 0, Z_MAQUINA - 0.55);
  raiz.add(rival);
  const sombraRival = ctx.crearSombra({ radio: 0.4, opacidad: 0.45 });
  raiz.add(sombraRival);
  const palaMaquina = crearPala(matGomaNegra);
  palaMaquina.rotation.y = -Math.PI / 2;
  const pivoteMaquina = new THREE.Group();
  palaMaquina.position.set(CENTRO_HOJA.z, -CENTRO_HOJA.y, 0);
  pivoteMaquina.add(palaMaquina);
  pivoteMaquina.position.set(0, MESA_Y + 0.25, Z_MAQUINA);
  raiz.add(pivoteMaquina);
  const objetivoMaquina = new THREE.Vector3(0, MESA_Y + 0.25, Z_MAQUINA);

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 2.2, alto: 0.62 });
  marcador.mesh.position.set(0, 2.3, Z_LEJOS - 1.6);
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  // 'intro' | 'saque' | 'vivo' | 'punto' | 'fin'
  let estado = 'intro';
  let reloj = 3;
  const tanteo = { jugador: 0, maquina: 0 };
  let sacador = 'jugador';
  let primerSacador = 'jugador';
  let golpeador = null;       // quién dio el último golpe
  let debeBotar = null;       // lado en el que tiene que botar la bola ahora
  let botes = 0;
  let tiempoPunto = 0;
  let enfriamiento = 0;       // evita contar dos veces el mismo golpe
  let golpesSeguidos = 0;
  let mensaje = '';
  let colorMensaje = '#ffffff';
  let ganadas = ctx.leer('ganadas', 0);
  let mejorPeloteo = ctx.leer('peloteo', 0);

  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const anterior = new THREE.Vector3();
  const relativa = new THREE.Vector3();

  const otro = (quien) => (quien === 'jugador' ? 'maquina' : 'jugador');
  const ladoDe = (z) => (z > Z_RED ? 'jugador' : 'maquina');
  const sobreMesa = (p) => Math.abs(p.x) < ANCHO / 2 && p.z < Z_CERCA && p.z > Z_LEJOS;

  function actualizarMarcador() {
    const lineas = [{ texto: `Tú ${tanteo.jugador}  –  ${tanteo.maquina} Máquina`, tam: 1.3 }];
    if (estado === 'intro') {
      lineas[0] = { texto: 'PING PONG', tam: 1.3, color: '#ffcc80' };
      lineas.push({
        texto: ctx.enVR() ? 'Pala en la mano derecha · el gatillo de la otra mano la cambia'
          : ctx.tactil ? 'Arrastra el dedo para mover la pala' : 'Mueve la pala con el ratón',
        tam: 0.7,
      });
    } else if (estado === 'saque' && sacador === 'jugador') {
      lineas.push({ texto: 'Tu saque: golpea la bola hacia el otro lado', tam: 0.75, color: '#80deea' });
    } else if (estado === 'saque') {
      lineas.push({ texto: 'Saca la máquina…', tam: 0.75, color: '#ffab91' });
    } else if (estado === 'vivo') {
      lineas.push({ texto: golpesSeguidos > 2 ? `Peloteo: ${golpesSeguidos} golpes` : ' ', tam: 0.75, color: '#fff59d' });
    } else {
      lineas.push({ texto: mensaje, tam: 0.75, color: colorMensaje });
    }
    lineas.push({ texto: `A ${PUNTOS_SET} · partidas ganadas: ${ganadas} · mejor peloteo: ${mejorPeloteo}`, tam: 0.6, color: '#ffcc80' });
    marcador.escribir(lineas);
  }

  // ─── Trayectorias ──────────────────────────────────────────────────────
  // Velocidad para ir de "p" a "destino" (sobre la mesa) con esa rapidez horizontal,
  // subiendo la bola lo justo para que pase por encima de la red.
  function trayectoria(p, destino, rapidez) {
    const dx = destino.x - p.x;
    const dz = destino.z - p.z;
    const distancia = Math.hypot(dx, dz);
    let t = distancia / rapidez;
    const v = new THREE.Vector3();
    for (let i = 0; i < 10; i++) {
      v.set(dx / t, (destino.y - p.y) / t + 0.5 * G * t, dz / t);
      const tRed = (Z_RED - p.z) / v.z;
      if (tRed <= 0 || tRed >= t) break;
      const yRed = p.y + v.y * tRed - 0.5 * G * tRed * tRed;
      if (yRed > MESA_Y + ALTO_RED + R_BOLA + 0.04) break;
      t *= 1.15; // más despacio y más alta
    }
    return v;
  }

  // Corrige un poco un golpe VR que va hacia el otro lado para que caiga en la mesa
  function ayudar(p, v) {
    if (v.z > -0.8) return v;
    const altura = p.y - (MESA_Y + R_BOLA);
    const t = (v.y + Math.sqrt(Math.max(0, v.y * v.y + 2 * G * altura))) / G;
    const caida = tmp2.set(p.x + v.x * t, MESA_Y + R_BOLA, p.z + v.z * t);
    const destino = new THREE.Vector3(
      THREE.MathUtils.clamp(caida.x, -ANCHO / 2 + 0.12, ANCHO / 2 - 0.12),
      MESA_Y + R_BOLA,
      THREE.MathUtils.clamp(caida.z, Z_LEJOS + 0.15, Z_RED - 0.25),
    );
    const rapidez = THREE.MathUtils.clamp(Math.hypot(v.x, v.z), 3, 9);
    return v.lerp(trayectoria(p, destino, rapidez), AYUDA);
  }

  // Dónde estará la bola cuando llegue al plano z (con botes en la mesa), o null
  const simPos = new THREE.Vector3();
  const simVel = new THREE.Vector3();
  function predecir(z) {
    simPos.copy(bola.position);
    simVel.copy(vel);
    const h = 0.01;
    for (let i = 0; i < 250; i++) {
      simVel.y -= G * h;
      simPos.addScaledVector(simVel, h);
      if (simVel.y < 0 && simPos.y < MESA_Y + R_BOLA && sobreMesa(simPos)) {
        simPos.y = MESA_Y + R_BOLA;
        simVel.y *= -REBOTE_MESA;
      }
      if (simPos.z <= z) return simPos;
      if (simPos.y < 0.3) return null;
    }
    return null;
  }

  // ─── Reglas ────────────────────────────────────────────────────────────
  function prepararSaque() {
    estado = 'saque';
    reloj = sacador === 'maquina' ? 1.3 : 0;
    golpeador = null;
    debeBotar = null;
    botes = 0;
    golpesSeguidos = 0;
    vel.set(0, 0, 0);
    if (sacador === 'jugador') bola.position.set(0.15, MESA_Y + 0.3, Z_PALA_RATON - 0.05);
    else bola.position.set(0, MESA_Y + 0.25, Z_MAQUINA + 0.12);
  }

  function puntoPara(quien, texto) {
    if (estado !== 'vivo') return;
    tanteo[quien] += 1;
    if (golpesSeguidos > mejorPeloteo) {
      mejorPeloteo = golpesSeguidos;
      ctx.guardar('peloteo', mejorPeloteo);
    }
    mensaje = texto;
    colorMensaje = quien === 'jugador' ? '#b9f6ca' : '#ff8a80';
    if (quien === 'jugador') {
      ctx.sonido('punto');
      for (const m of ctx.manos) ctx.vibrar(m, 0.4, 60);
    } else {
      ctx.sonido('fallo');
    }

    const j = tanteo.jugador;
    const m = tanteo.maquina;
    if ((j >= PUNTOS_SET || m >= PUNTOS_SET) && Math.abs(j - m) >= 2) {
      estado = 'fin';
      reloj = 7;
      if (j > m) {
        ganadas += 1;
        ctx.guardar('ganadas', ganadas);
        mensaje = '¡HAS GANADO EL PARTIDO!';
        colorMensaje = '#b9f6ca';
        ctx.sonido('ovacion');
      } else {
        mensaje = 'Gana la máquina. ¡La revancha es tuya!';
        colorMensaje = '#ff8a80';
      }
      ctx.sonido('fin');
      return;
    }
    // El saque cambia cada 2 puntos (y en cada punto a partir de 10-10)
    const total = j + m;
    const turno = total >= 2 * (PUNTOS_SET - 1) ? total : Math.floor(total / 2);
    sacador = turno % 2 === 0 ? primerSacador : otro(primerSacador);
    estado = 'punto';
    reloj = 1.6;
  }

  // Alguien golpea la bola
  function golpe(quien) {
    if (enfriamiento > 0) return false;
    if (estado === 'saque') {
      if (quien !== sacador) return false;
      estado = 'vivo';
    } else if (estado !== 'vivo') {
      return false;
    } else if (debeBotar === quien) {
      if (botes === 0) {
        // Volea: si la bola estaba sobre la mesa es falta; si no, iba fuera
        if (sobreMesa(bola.position)) puntoPara(otro(quien), quien === 'jugador' ? 'Hay que dejarla botar' : '¡La máquina ha voleado!');
        else puntoPara(quien, quien === 'jugador' ? 'Iba fuera: punto para ti' : 'Iba fuera: punto para la máquina');
        return false;
      }
    } else {
      return false; // segundo toque del mismo jugador
    }
    golpeador = quien;
    debeBotar = otro(quien);
    botes = 0;
    golpesSeguidos += 1;
    enfriamiento = 0.15;
    ctx.sonido('toc');
    return true;
  }

  function bote(lado) {
    ctx.sonido('pong');
    if (estado !== 'vivo') return;
    if (lado === debeBotar) {
      botes += 1;
      if (botes >= 2) puntoPara(golpeador, golpeador === 'jugador' ? '¡No ha llegado!' : 'Se te ha escapado');
    } else {
      puntoPara(debeBotar, golpeador === 'jugador' ? 'Ha botado en tu lado' : 'La máquina ha fallado');
    }
  }

  function bolaMuerta() {
    if (estado !== 'vivo') return;
    if (botes === 0) puntoPara(debeBotar, golpeador === 'jugador' ? 'Fuera de la mesa' : '¡Fuera! Punto para ti');
    else puntoPara(golpeador, golpeador === 'jugador' ? '¡Punto!' : 'No llegaste');
  }

  // ─── Física de la bola ─────────────────────────────────────────────────
  // Choque bola-pala con la pala interpolada entre el fotograma anterior y este
  function chocarPala(p, f, h) {
    const centro = tmp.lerpVectors(p.centroAntes, p.centro, f);
    const normal = tmp2.lerpVectors(p.normalAntes, p.normal, f).normalize();
    const d = relativa.subVectors(bola.position, centro).dot(normal);
    const enPlano = relativa.addScaledVector(normal, -d).length();
    if (enPlano > R_PALA + R_BOLA * 0.5 || Math.abs(d) > R_BOLA + GROSOR_PALA / 2) return false;
    const velPala = new THREE.Vector3().subVectors(p.centro, p.centroAntes).divideScalar(Math.max(h, 1e-4));
    relativa.subVectors(vel, velPala);
    const vn = relativa.dot(normal);
    if (vn * Math.sign(d || 1) >= 0) return false; // ya se aleja de la pala
    if (!golpe('jugador')) return false;
    vel.copy(velPala).add(relativa.addScaledVector(normal, -(1 + REBOTE_PALA) * vn));
    bola.position.copy(centro).addScaledVector(normal, Math.sign(d || 1) * (R_BOLA + GROSOR_PALA / 2 + 0.002));
    ayudar(bola.position, vel);
    ctx.vibrar(p.mano, 0.5, 40);
    return true;
  }

  function moverBola(dt, palaVR) {
    const rapidez = Math.max(vel.length(), palaVR ? palaVR.centro.distanceTo(palaVR.centroAntes) / dt : 0);
    const pasos = Math.min(24, Math.max(1, Math.ceil((rapidez * dt) / 0.012)));
    const h = dt / pasos;
    for (let i = 1; i <= pasos; i++) {
      anterior.copy(bola.position);
      vel.y -= G * h;
      bola.position.addScaledVector(vel, h);
      const p = bola.position;

      // Mesa
      if (vel.y < 0 && p.y < MESA_Y + R_BOLA && anterior.y >= MESA_Y + R_BOLA - 0.01 && sobreMesa(p)) {
        p.y = MESA_Y + R_BOLA;
        vel.y *= -REBOTE_MESA;
        vel.x *= 0.97;
        vel.z *= 0.97;
        bote(ladoDe(p.z));
      }
      // Red
      if ((anterior.z - Z_RED) * (p.z - Z_RED) <= 0 && p.y < MESA_Y + ALTO_RED + R_BOLA && p.y > MESA_Y - 0.02 && Math.abs(p.x) < ANCHO_RED / 2) {
        p.z = Z_RED + Math.sign(anterior.z - Z_RED) * (R_BOLA + 0.005);
        vel.z *= -0.25;
        vel.x *= 0.5;
        ctx.sonido('zas');
      }
      // Pala VR
      if (palaVR && chocarPala(palaVR, i / pasos, h * pasos)) continue;
      // Suelo
      if (p.y < R_BOLA) {
        p.y = R_BOLA;
        vel.y = Math.abs(vel.y) * 0.6;
        vel.x *= 0.8;
        vel.z *= 0.8;
      }
    }
    if (bola.position.y < MESA_Y - 0.3) bolaMuerta();
  }

  // ─── Jugador ───────────────────────────────────────────────────────────
  function palasVRActualizar() {
    const activas = palasVR.filter((p) => p.mano.activa);
    if (indicePala === null || !ctx.manos[indicePala].activa) {
      const derecha = activas.find((p) => p.mano.lado === 'right') || activas[0];
      indicePala = derecha ? derecha.mano.indice : null;
    }
    // El gatillo de la mano libre cambia la pala de mano (zurdos)
    const libre = activas.find((p) => p.mano.indice !== indicePala);
    if (libre && libre.mano.gatilloPulsado) {
      indicePala = libre.mano.indice;
      ctx.vibrar(libre.mano, 0.3, 40);
    }
    let activa = null;
    for (const p of palasVR) {
      const esta = p.mano.indice === indicePala && p.mano.activa;
      p.objeto.visible = esta;
      if (!esta) {
        p.lista = false;
        continue;
      }
      p.centroAntes.copy(p.centro);
      p.normalAntes.copy(p.normal);
      p.mano.grip.localToWorld(p.centro.copy(CENTRO_HOJA));
      p.normal.set(1, 0, 0).transformDirection(p.mano.grip.matrixWorld);
      if (!p.lista) {
        p.centroAntes.copy(p.centro);
        p.normalAntes.copy(p.normal);
        p.lista = true;
      }
      activa = p;
    }
    return activa;
  }

  function palaRatonActualizar(dt) {
    const r = ctx.raton;
    pivoteRaton.visible = r.dentro || ctx.tactil;
    if (r.rayo.ray.intersectPlane(planoRaton, tmp)) {
      tmp.x = THREE.MathUtils.clamp(tmp.x, -ANCHO / 2 - 0.3, ANCHO / 2 + 0.3);
      tmp.y = THREE.MathUtils.clamp(tmp.y, MESA_Y + 0.02, MESA_Y + 0.9);
      velRaton.subVectors(tmp, pivoteRaton.position).divideScalar(Math.max(dt, 1e-3));
      pivoteRaton.position.lerp(tmp, Math.min(1, dt * 25));
    }
    // Inclinación según hacia dónde se mueve (queda más natural)
    pivoteRaton.rotation.z = THREE.MathUtils.clamp(-velRaton.x * 0.05, -0.5, 0.5);

    // Contacto: la bola llega a la pala (o, en el saque, tocas la bola con la pala)
    const p = bola.position;
    const cerca = Math.hypot(p.x - pivoteRaton.position.x, p.y - pivoteRaton.position.y) < R_CONTACTO_RATON &&
      Math.abs(p.z - Z_PALA_RATON) < 0.12;
    const viene = estado === 'saque' ? sacador === 'jugador' : vel.z > 0;
    if (cerca && viene && golpe('jugador')) {
      // El ángulo depende de en qué parte de la pala da; moverla rápido es remate
      const desvio = (p.x - pivoteRaton.position.x) / R_CONTACTO_RATON;
      const remate = THREE.MathUtils.clamp(r.velocidadPx / 2500, 0, 1);
      const destino = new THREE.Vector3(
        THREE.MathUtils.clamp(desvio * 0.6 + velRaton.x * 0.08, -ANCHO / 2 + 0.08, ANCHO / 2 - 0.08),
        MESA_Y + R_BOLA,
        Z_LEJOS + 0.25 + Math.random() * 0.8,
      );
      p.z = Math.min(p.z, Z_PALA_RATON - 0.03);
      vel.copy(trayectoria(p, destino, 4.2 + remate * 3.5));
    }
  }

  // ─── Máquina ───────────────────────────────────────────────────────────
  function maquina(dt) {
    // A dónde va: a donde llegará la bola, o al centro si no viene hacia ella
    let destino = null;
    if (estado === 'vivo' && debeBotar === 'maquina' && vel.z < 0) destino = predecir(Z_MAQUINA);
    if (estado === 'saque' && sacador === 'maquina') destino = tmp.copy(bola.position).setZ(Z_MAQUINA);
    if (destino) objetivoMaquina.set(destino.x, Math.max(MESA_Y + 0.05, destino.y), Z_MAQUINA);
    else objetivoMaquina.set(0, MESA_Y + 0.25, Z_MAQUINA);
    const paso = tmp2.subVectors(objetivoMaquina, pivoteMaquina.position);
    const maximo = VELOCIDAD_MAQUINA * dt;
    if (paso.length() > maximo) paso.setLength(maximo);
    pivoteMaquina.position.add(paso);
    rival.position.x = pivoteMaquina.position.x * 0.8 + 0.25;
    ctx.colocarSombra(sombraRival, rival.position, 0);

    // Saque de la máquina
    if (estado === 'saque' && sacador === 'maquina' && reloj <= 0 && golpe('maquina')) {
      const destinoSaque = new THREE.Vector3((Math.random() - 0.5) * 1.1, MESA_Y + R_BOLA, Z_RED + 0.45 + Math.random() * 0.7);
      vel.copy(trayectoria(bola.position, destinoSaque, 3.8 + Math.random() * 0.8));
      return;
    }

    // Devolución: solo si ya ha botado en su lado y la pala llega a la bola
    const p = bola.position;
    if (estado === 'vivo' && debeBotar === 'maquina' && botes === 1 && vel.z < 0 &&
        p.distanceTo(pivoteMaquina.position) < 0.17 && golpe('maquina')) {
      const falla = Math.random() < FALLOS_MAQUINA;
      const destinoGolpe = new THREE.Vector3(
        falla ? (Math.random() < 0.5 ? -1 : 1) * (ANCHO / 2 + 0.25) : (Math.random() - 0.5) * (ANCHO - 0.3),
        MESA_Y + R_BOLA,
        falla ? Z_CERCA + 0.4 : Z_RED + 0.35 + Math.random() * (LARGO / 2 - 0.55),
      );
      const rapidez = 4.2 + Math.min(golpesSeguidos, 12) * 0.12 + Math.random() * 1.2;
      vel.copy(trayectoria(p, destinoGolpe, rapidez));
    }
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function empezarPartido() {
    tanteo.jugador = 0;
    tanteo.maquina = 0;
    primerSacador = primerSacador === 'jugador' ? 'maquina' : 'jugador';
    sacador = primerSacador;
    prepararSaque();
  }

  function actualizar(dt, t) {
    reloj -= dt;
    enfriamiento = Math.max(0, enfriamiento - dt);
    const vr = ctx.enVR();

    let palaVR = null;
    if (vr) {
      pivoteRaton.visible = false;
      palaVR = palasVRActualizar();
    } else {
      for (const p of palasVR) p.objeto.visible = false;
      palaRatonActualizar(dt);
    }

    switch (estado) {
      case 'intro':
        if (reloj <= 0) {
          primerSacador = 'maquina'; // empezarPartido lo alterna: el primer partido sacas tú
          empezarPartido();
        }
        break;
      case 'saque':
        if (sacador === 'jugador') {
          // La bola flota esperando el saque
          bola.position.y = MESA_Y + 0.3 + Math.sin(t * 3) * 0.03;
          if (palaVR) {
            // En pasos cortos para que un golpe rápido no atraviese la bola
            const pasos = Math.min(24, Math.max(1, Math.ceil(palaVR.centro.distanceTo(palaVR.centroAntes) / 0.012)));
            for (let i = 1; i <= pasos; i++) if (chocarPala(palaVR, i / pasos, dt)) break;
          }
        }
        break;
      case 'vivo':
        tiempoPunto += dt;
        if (tiempoPunto > 12) bolaMuerta(); // por si la bola se queda atascada
        break;
      case 'punto':
        if (reloj <= 0) prepararSaque();
        break;
      case 'fin':
        if (reloj <= 0) empezarPartido();
        break;
    }

    maquina(dt);
    if (estado === 'vivo' || estado === 'punto' || estado === 'fin') moverBola(dt, estado === 'vivo' ? palaVR : null);
    if (estado === 'saque') tiempoPunto = 0;

    const ySuelo = sobreMesa(bola.position) && bola.position.y > MESA_Y ? MESA_Y : 0;
    ctx.colocarSombra(sombraBola, bola.position, ySuelo);
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
