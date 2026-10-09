// APLASTA TOPOS
// Los topos asoman de los agujeros de una mesa. Se golpean con el martillo
// (VR) o haciendo clic encima (escritorio). Rondas de 60 segundos.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const DURACION = 60;
const ALTURA_MESA = 0.8;
const SUPERFICIE = ALTURA_MESA + 0.02;  // altura del césped
const Y_ARRIBA = SUPERFICIE;            // base del topo cuando asoma
const Y_ESCONDIDO = SUPERFICIE - 0.23;  // base del topo escondido dentro de la mesa
const ALTURA_CABEZA = 0.15;             // centro de la cabeza respecto a la base
const CABEZA_MARTILLO = -0.32;          // posición de la cabeza del martillo delante del puño
const VELOCIDAD_GOLPE = 0.7;            // m/s mínimos para que cuente el golpe

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  // Atardecer de verbena: cielo morado y anaranjado en el horizonte
  ctx.fondo(0x15241b, { cenit: 0x101a3a, horizonte: 0x6b4a6a, suelo: 0x1c2a1c });
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.5, 0.45), new THREE.Vector3(0, 0.85, -0.7));

  // ─── Jardín ────────────────────────────────────────────────────────────
  ctx.sueloBase(false);
  const suelo = new THREE.Mesh(
    R(new THREE.PlaneGeometry(40, 40)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.cesped(0x3f7a35, { tam: 512, repetir: [16, 16], semilla: 11 })) })),
  );
  suelo.rotation.x = -Math.PI / 2;
  raiz.add(suelo);

  // ─── Caseta de feria ───────────────────────────────────────────────────
  // Pared del fondo con rayas verticales rojas y crema
  const texRayas = R(ctx.texturaCanvas((g, tam, azar) => {
    const franjas = 8;
    for (let i = 0; i < franjas; i++) {
      g.fillStyle = i % 2 ? '#eadcbc' : '#a8323a';
      g.fillRect((i * tam) / franjas, 0, tam / franjas, tam);
    }
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = `rgba(0,0,0,${azar() * 0.05})`;
      g.fillRect(azar() * tam, azar() * tam, 2, 2);
    }
  }, { repetir: [2, 1], semilla: 4 }));
  const matRayas = R(new THREE.MeshLambertMaterial({ map: texRayas }));
  const pared = new THREE.Mesh(R(new THREE.PlaneGeometry(3, 2.6)), matRayas);
  pared.position.set(0, 1.3, -1.7);
  raiz.add(pared);
  // Zócalo de madera en la parte baja de la pared
  const zocalo = new THREE.Mesh(
    R(new THREE.PlaneGeometry(3, 0.9)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tablas(0x6d4630, { tablas: 6, repetir: [2, 1], semilla: 13 })) })),
  );
  zocalo.position.set(0, 0.45, -1.69);
  raiz.add(zocalo);
  // Laterales de lona, solo en el fondo para no encajonar al jugador
  const geoLateral = R(new THREE.PlaneGeometry(0.9, 2.6));
  const uvLateral = geoLateral.attributes.uv;
  for (let i = 0; i < uvLateral.count; i++) uvLateral.setX(i, uvLateral.getX(i) * 0.3); // mismas rayas que la pared
  for (const lado of [-1, 1]) {
    const lateral = new THREE.Mesh(geoLateral, matRayas);
    lateral.position.set(lado * 1.5, 1.3, -1.25);
    lateral.rotation.y = -lado * Math.PI / 2;
    raiz.add(lateral);
  }
  // Toldo con flecos: un plano inclinado sobre la caseta
  const texToldo = R(ctx.texturaCanvas((g, tam) => {
    const franjas = 10;
    for (let i = 0; i < franjas; i++) {
      g.fillStyle = i % 2 ? '#fff4dc' : '#d93a2b';
      g.fillRect((i * tam) / franjas, 0, tam / franjas, tam);
    }
    g.fillStyle = 'rgba(0,0,0,0.12)';
    g.fillRect(0, tam * 0.94, tam, tam * 0.06);
  }, { semilla: 2 }));
  const toldo = new THREE.Mesh(R(new THREE.PlaneGeometry(3.1, 1.75)), R(new THREE.MeshLambertMaterial({ map: texToldo, side: THREE.DoubleSide })));
  toldo.position.set(0, 2.45, -0.85);
  toldo.rotation.x = -Math.PI / 2 + 0.32;
  raiz.add(toldo);
  // Postes de madera pintada
  const matPoste = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.madera(0xe0b04a, { tam: 128, repetir: [1, 3], semilla: 8 })) }));
  const geoPoste = R(new THREE.CylinderGeometry(0.045, 0.05, 2.2, 10));
  for (const lado of [-1, 1]) {
    const poste = new THREE.Mesh(geoPoste, matPoste);
    poste.position.set(lado * 1.45, 1.1, -0.02);
    raiz.add(poste);
  }
  // Guirnalda de bombillas bajo el toldo (una sola llamada de dibujo)
  const bombillas = new THREE.InstancedMesh(
    R(new THREE.SphereGeometry(0.025, 8, 6)),
    R(new THREE.MeshBasicMaterial({ color: 0xffe2a0 })),
    15,
  );
  const matriz = new THREE.Matrix4();
  for (let i = 0; i < 15; i++) {
    const f = i / 14;
    matriz.makeTranslation(-1.4 + f * 2.8, 2.08 - Math.sin(f * Math.PI) * 0.12, -0.08);
    bombillas.setMatrixAt(i, matriz);
  }
  raiz.add(bombillas);
  // Cable de la guirnalda
  const cable = new THREE.Mesh(
    R(new THREE.TubeGeometry(new THREE.QuadraticBezierCurve3(
      new THREE.Vector3(-1.45, 2.12, -0.08), new THREE.Vector3(0, 1.84, -0.08), new THREE.Vector3(1.45, 2.12, -0.08),
    ), 20, 0.004, 4)),
    R(new THREE.MeshBasicMaterial({ color: 0x2a2a2a })),
  );
  raiz.add(cable);
  // Setos alrededor del jardín (instanciados)
  const setos = new THREE.InstancedMesh(
    R(new THREE.IcosahedronGeometry(0.6, 1)),
    R(new THREE.MeshLambertMaterial({ color: 0x2e5e2a })),
    16,
  );
  const escala = new THREE.Vector3();
  const giro = new THREE.Quaternion();
  const pos = new THREE.Vector3();
  for (let i = 0; i < 16; i++) {
    const angulo = (i / 16) * Math.PI * 2;
    const radio = 4.2 + (i % 3) * 0.4;
    pos.set(Math.cos(angulo) * radio, 0.35, Math.sin(angulo) * radio - 0.8);
    escala.set(1.3 + (i % 2) * 0.4, 0.9 + (i % 3) * 0.2, 1.1);
    giro.setFromAxisAngle(THREE.Object3D.DEFAULT_UP, -angulo);
    setos.setMatrixAt(i, matriz.compose(pos, giro, escala));
  }
  raiz.add(setos);

  // ─── Mesa y agujeros ───────────────────────────────────────────────────
  // Mesa de tablas pintadas de rojo
  const matMesa = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tablas(0xb8432f, { tablas: 6, semilla: 6 })) }));
  const mesa = new THREE.Mesh(R(new THREE.BoxGeometry(0.95, ALTURA_MESA, 0.75)), matMesa);
  mesa.position.set(0, ALTURA_MESA / 2, -0.58);
  // Césped de la mesa con los agujeros pintados en la textura (ahorra una malla por agujero)
  const texMesa = R(ctx.texturaCanvas((g, tam) => {
    // Césped de grano fino: el mosaico de la shell repetido 2×2
    const base = ctx.texturas.cesped(0x66bb6a, { tam: tam / 2, semilla: 3 });
    for (const [x, y] of [[0, 0], [1, 0], [0, 1], [1, 1]]) g.drawImage(base.image, (x * tam) / 2, (y * tam) / 2);
    base.dispose();
    // Coordenadas en metros: el centro de la mesa en el centro del canvas, el fondo arriba
    g.setTransform(tam / 0.97, 0, 0, tam / 0.77, tam / 2, tam / 2);
    for (const z of [-0.24, 0, 0.24]) {
      for (const x of [-0.27, 0, 0.27]) {
        // Montículo de tierra alrededor
        const tierra = g.createRadialGradient(x, z, 0.07, x, z, 0.1);
        tierra.addColorStop(0, 'rgba(92,62,38,1)');
        tierra.addColorStop(0.5, 'rgba(110,78,48,0.85)');
        tierra.addColorStop(1, 'rgba(110,78,48,0)');
        g.fillStyle = tierra;
        g.beginPath();
        g.arc(x, z, 0.1, 0, Math.PI * 2);
        g.fill();
        // Agujero oscuro, más negro en el centro
        const hueco = g.createRadialGradient(x, z - 0.01, 0, x, z, 0.075);
        hueco.addColorStop(0, '#050302');
        hueco.addColorStop(0.75, '#1b120e');
        hueco.addColorStop(1, '#3a2618');
        g.fillStyle = hueco;
        g.beginPath();
        g.arc(x, z, 0.075, 0, Math.PI * 2);
        g.fill();
      }
    }
  }, { tam: 512 }));
  const cesped = new THREE.Mesh(R(new THREE.BoxGeometry(0.97, 0.02, 0.77)), R(new THREE.MeshLambertMaterial({ map: texMesa })));
  cesped.position.set(0, ALTURA_MESA + 0.01, -0.58);
  raiz.add(mesa, cesped);
  // Marco amarillo alrededor del césped
  const matMarco = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.madera(0xf2b632, { tam: 128, repetir: [2, 1], semilla: 12 })) }));
  for (const [ancho, fondo, x, z] of [[1.03, 0.03, 0, -0.58 - 0.4], [1.03, 0.03, 0, -0.58 + 0.4], [0.03, 0.77, -0.5, -0.58], [0.03, 0.77, 0.5, -0.58]]) {
    const liston = new THREE.Mesh(R(new THREE.BoxGeometry(ancho, 0.05, fondo)), matMarco);
    liston.position.set(x, SUPERFICIE - 0.005, z);
    raiz.add(liston);
  }
  // Sombra de la mesa sobre el césped
  const sombraMesa = ctx.crearSombra({ radio: 0.75, opacidad: 0.5 });
  sombraMesa.scale.set(1.6, 1, 1.35);
  sombraMesa.position.set(0, 0.004, -0.58);
  raiz.add(sombraMesa);

  // ─── Topos ─────────────────────────────────────────────────────────────
  const geoCuerpo = R(new THREE.CylinderGeometry(0.055, 0.06, 0.14, 18));
  const geoCabeza = R(new THREE.SphereGeometry(0.062, 20, 14));
  const geoOjo = R(new THREE.SphereGeometry(0.009, 8, 6));
  const geoNariz = R(new THREE.SphereGeometry(0.015, 10, 8));
  const geoDientes = R(new THREE.BoxGeometry(0.022, 0.014, 0.006));
  // Pelaje con un moteado suave
  const matTopo = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.grano(0x8a5d45, { tam: 128, repetir: [2, 1], semilla: 21, contraste: 0.14, cantidad: 900 })) }));
  // El dorado es metálico de verdad: refleja el cielo
  const matDorado = R(new THREE.MeshStandardMaterial({ color: 0xffc400, emissive: 0x3a2200, metalness: 0.85, roughness: 0.3 }));
  const matOjo = R(new THREE.MeshStandardMaterial({ color: 0x111111, roughness: 0.15 }));
  const matNariz = R(new THREE.MeshLambertMaterial({ color: 0xf48fb1 }));
  const matDientes = R(new THREE.MeshLambertMaterial({ color: 0xfffbea }));
  const geoEstrella = R(new THREE.OctahedronGeometry(0.018));
  const matEstrella = R(new THREE.MeshBasicMaterial({ color: 0xffeb3b }));

  const topos = [];
  for (const z of [-0.34, -0.58, -0.82]) {
    for (const x of [-0.27, 0, 0.27]) {
      const grupo = new THREE.Group();
      const cuerpo = new THREE.Mesh(geoCuerpo, matTopo);
      cuerpo.position.y = 0.07;
      const cabeza = new THREE.Mesh(geoCabeza, matTopo);
      cabeza.position.y = ALTURA_CABEZA;
      const nariz = new THREE.Mesh(geoNariz, matNariz);
      nariz.position.set(0, ALTURA_CABEZA, 0.06);
      const dientes = new THREE.Mesh(geoDientes, matDientes);
      dientes.position.set(0, ALTURA_CABEZA - 0.026, 0.055);
      grupo.add(cuerpo, cabeza, nariz, dientes);
      for (const lado of [-1, 1]) {
        const ojo = new THREE.Mesh(geoOjo, matOjo);
        ojo.position.set(lado * 0.024, ALTURA_CABEZA + 0.022, 0.052);
        grupo.add(ojo);
      }
      grupo.position.set(x, Y_ESCONDIDO, z);
      grupo.visible = false; // escondido dentro de la mesa: no hace falta dibujarlo
      raiz.add(grupo);

      // Sombra de mancha en el borde del agujero cuando asoma
      // (algo desplazada hacia el lado contrario a la luz para que asome fuera del agujero)
      const sombra = ctx.crearSombra({ radio: 0.095, opacidad: 0.6 });
      sombra.position.set(x - 0.025, SUPERFICIE + 0.003, z - 0.02);
      sombra.visible = false;
      raiz.add(sombra);

      const topo = { grupo, cuerpo, cabeza, sombra, estado: 'abajo', t: 0, tiempoArriba: 0, dorado: false };
      cuerpo.userData.topo = topo;
      cabeza.userData.topo = topo;
      topos.push(topo);
    }
  }
  const mallasGolpeables = topos.flatMap((t) => [t.cuerpo, t.cabeza]);

  // ─── Martillos ─────────────────────────────────────────────────────────
  // Mango de madera barnizada, empuñadura de goma y cabeza de plástico rojo brillante
  // con topes amarillos. Geometrías y materiales compartidos por los tres martillos.
  const geoMango = R(new THREE.CylinderGeometry(0.015, 0.018, 0.34, 14));
  const geoPuno = R(new THREE.CylinderGeometry(0.02, 0.02, 0.11, 14));
  const geoCabezaMartillo = R(new THREE.CylinderGeometry(0.05, 0.05, 0.13, 24));
  const geoTope = R(new THREE.CylinderGeometry(0.053, 0.053, 0.02, 24));
  const matMango = R(new THREE.MeshStandardMaterial({ map: R(ctx.texturas.madera(0xd9b98a, { tam: 128, repetir: [1, 1], semilla: 14 })), roughness: 0.45 }));
  const matPuno = R(new THREE.MeshStandardMaterial({ color: 0x263238, roughness: 0.85 }));
  const matCabezaMartillo = R(new THREE.MeshStandardMaterial({ color: 0xe53935, roughness: 0.28 }));
  const matTope = R(new THREE.MeshStandardMaterial({ color: 0xffca28, roughness: 0.35 }));
  function crearMartillo() {
    const martillo = new THREE.Group();
    const mango = new THREE.Mesh(geoMango, matMango);
    mango.rotation.x = Math.PI / 2;
    mango.position.z = (0.04 + CABEZA_MARTILLO) / 2;
    const puno = new THREE.Mesh(geoPuno, matPuno);
    puno.rotation.x = Math.PI / 2;
    puno.position.z = -0.005;
    const cabeza = new THREE.Mesh(geoCabezaMartillo, matCabezaMartillo);
    cabeza.position.z = CABEZA_MARTILLO; // el eje del cilindro (Y) queda perpendicular al mango
    martillo.add(mango, puno, cabeza);
    for (const lado of [-1, 1]) {
      const tope = new THREE.Mesh(geoTope, matTope);
      tope.position.y = lado * 0.065;
      cabeza.add(tope);
    }
    return martillo;
  }

  const martillos = ctx.manos.map((mano) => ({
    mano,
    objeto: ctx.adjuntarAMano(mano, crearMartillo()),
    cabeza: new THREE.Vector3(),
    cabezaAnterior: new THREE.Vector3(),
    listo: false,
  }));

  // Martillo que sigue al ratón en modo escritorio
  const pivote = new THREE.Group();
  pivote.add(crearMartillo());
  raiz.add(pivote);
  const planoGolpe = new THREE.Plane(new THREE.Vector3(0, 1, 0), -(Y_ARRIBA + ALTURA_CABEZA));
  const puntoRaton = new THREE.Vector3(0, Y_ARRIBA + ALTURA_CABEZA, -0.58);
  let golpeRaton = 0; // tiempo restante de la animación del golpe

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.0, alto: 0.28 });
  marcador.mesh.position.set(0, 1.38, -1.1);
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  const particulas = [];
  let puntos = 0;
  let record = ctx.leer('record', 0);
  let estado = 'intro'; // 'intro' | 'jugando' | 'fin'
  let reloj = 2.5;
  let tiempoRestante = DURACION;
  let proximoTopo = 0;

  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();

  function actualizarMarcador() {
    if (estado === 'intro') {
      marcador.escribir([
        { texto: 'APLASTA TOPOS', tam: 1.3, color: '#c5e1a5' },
        { texto: '¡Golpea los topos antes de que se escondan!', tam: 0.75 },
      ]);
    } else if (estado === 'fin') {
      marcador.escribir([
        { texto: `¡Tiempo! ${puntos} puntos`, tam: 1.3, color: '#c5e1a5' },
        { texto: `Récord: ${record} · nueva ronda en ${Math.ceil(reloj)}`, tam: 0.75 },
      ]);
    } else {
      marcador.escribir([
        { texto: `Puntos: ${puntos}   ·   ${Math.ceil(tiempoRestante)} s`, tam: 1.3 },
        { texto: `Récord: ${record}   ·   los dorados valen 3`, tam: 0.75, color: '#fff59d' },
      ]);
    }
  }

  function sacarTopo(progreso) {
    const libres = topos.filter((t) => t.estado === 'abajo');
    if (libres.length === 0) return;
    const topo = libres[Math.floor(Math.random() * libres.length)];
    topo.estado = 'subiendo';
    topo.t = 0;
    topo.dorado = Math.random() < 0.12;
    const material = topo.dorado ? matDorado : matTopo;
    topo.cuerpo.material = material;
    topo.cabeza.material = material;
    topo.tiempoArriba = 1.3 - progreso * 0.55 + Math.random() * 0.25;
    topo.grupo.scale.set(1, 1, 1);
  }

  function golpear(topo, mano) {
    if (topo.estado !== 'subiendo' && topo.estado !== 'arriba') return;
    topo.estado = 'golpeado';
    topo.t = 0;
    puntos += topo.dorado ? 3 : 1;
    ctx.sonido('golpe');
    ctx.sonido('punto');
    if (mano) ctx.vibrar(mano, 0.9, 70);
    topo.cabeza.getWorldPosition(tmp);
    for (let i = 0; i < 7; i++) {
      const estrella = new THREE.Mesh(geoEstrella, matEstrella);
      estrella.position.copy(tmp);
      const angulo = (i / 7) * Math.PI * 2;
      const vel = new THREE.Vector3(Math.cos(angulo) * 0.6, 1.2 + Math.random() * 0.5, Math.sin(angulo) * 0.6);
      raiz.add(estrella);
      particulas.push({ malla: estrella, vel, vida: 0.6 });
    }
  }

  function actualizarTopo(topo, dt) {
    topo.t += dt;
    const g = topo.grupo;
    switch (topo.estado) {
      case 'subiendo': {
        const f = Math.min(1, topo.t / 0.15);
        g.position.y = Y_ESCONDIDO + (Y_ARRIBA - Y_ESCONDIDO) * (1 - (1 - f) * (1 - f));
        if (f >= 1) { topo.estado = 'arriba'; topo.t = 0; }
        break;
      }
      case 'arriba':
        g.position.y = Y_ARRIBA;
        if (topo.t >= topo.tiempoArriba || estado !== 'jugando') { topo.estado = 'bajando'; topo.t = 0; }
        break;
      case 'golpeado':
        g.scale.y = Math.max(0.45, 1 - topo.t * 6);
        if (topo.t >= 0.3) { topo.estado = 'bajando'; topo.t = 0; }
        break;
      case 'bajando': {
        const f = Math.min(1, topo.t / 0.15);
        g.position.y = Y_ARRIBA + (Y_ESCONDIDO - Y_ARRIBA) * f;
        if (f >= 1) { topo.estado = 'abajo'; g.scale.set(1, 1, 1); }
        break;
      }
      default:
        g.position.y = Y_ESCONDIDO;
    }
    // Solo se dibuja cuando asoma; la sombra se intensifica a medida que sale
    const fuera = (g.position.y - Y_ESCONDIDO) / (Y_ARRIBA - Y_ESCONDIDO);
    g.visible = topo.estado !== 'abajo';
    topo.sombra.visible = g.visible && fuera > 0.05;
    topo.sombra.material.opacity = 0.6 * fuera;
  }

  // ─── Golpes con los mandos VR ──────────────────────────────────────────
  function golpesVR(dt) {
    for (const m of martillos) {
      if (!m.mano.activa) {
        m.listo = false;
        continue;
      }
      m.mano.grip.localToWorld(m.cabeza.set(0, 0, CABEZA_MARTILLO));
      if (m.listo && m.cabeza.distanceTo(m.cabezaAnterior) / dt > VELOCIDAD_GOLPE) {
        for (const topo of topos) {
          if (topo.estado !== 'subiendo' && topo.estado !== 'arriba') continue;
          topo.cabeza.getWorldPosition(tmp);
          const medio = tmp2.copy(m.cabeza).lerp(m.cabezaAnterior, 0.5);
          if (m.cabeza.distanceTo(tmp) < 0.12 || medio.distanceTo(tmp) < 0.12) golpear(topo, m.mano);
        }
      }
      m.cabezaAnterior.copy(m.cabeza);
      m.listo = true;
    }
  }

  // ─── Golpes con el ratón ───────────────────────────────────────────────
  function golpesRaton(dt) {
    const raton = ctx.raton;
    pivote.visible = raton.dentro;
    if (raton.rayo.ray.intersectPlane(planoGolpe, tmp)) puntoRaton.copy(tmp);

    if (raton.clic) {
      golpeRaton = 0.16;
      const visibles = mallasGolpeables.filter((m) => ['subiendo', 'arriba'].includes(m.userData.topo.estado));
      const choque = raton.rayo.intersectObjects(visibles, false)[0];
      if (choque) golpear(choque.object.userData.topo, null);
    }
    golpeRaton = Math.max(0, golpeRaton - dt);

    // Animación: la cabeza del martillo baja hasta el punto y vuelve a subir
    const bajada = golpeRaton > 0.1 ? (0.16 - golpeRaton) / 0.06 : golpeRaton / 0.1;
    const objetivo = tmp2.copy(puntoRaton);
    objetivo.y += 0.13 * (1 - bajada);
    pivote.position.set(puntoRaton.x, puntoRaton.y + 0.2, puntoRaton.z + 0.26);
    // Queremos que el -Z del martillo apunte al objetivo: miramos al punto opuesto
    pivote.lookAt(tmp.copy(pivote.position).multiplyScalar(2).sub(objetivo));
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function actualizar(dt) {
    reloj -= dt;
    if (estado === 'intro' && reloj <= 0) {
      estado = 'jugando';
      tiempoRestante = DURACION;
      proximoTopo = 0.3;
    } else if (estado === 'jugando') {
      tiempoRestante -= dt;
      const progreso = 1 - tiempoRestante / DURACION;
      proximoTopo -= dt;
      const maxArriba = 1 + Math.floor(progreso * 2.5);
      const arriba = topos.filter((t) => t.estado !== 'abajo').length;
      if (proximoTopo <= 0 && arriba < maxArriba) {
        sacarTopo(progreso);
        proximoTopo = 0.95 - progreso * 0.5 + Math.random() * 0.2;
      }
      if (tiempoRestante <= 0) {
        estado = 'fin';
        reloj = 5;
        if (puntos > record) {
          record = puntos;
          ctx.guardar('record', record);
        }
        ctx.sonido('fin');
      }
    } else if (estado === 'fin' && reloj <= 0) {
      estado = 'jugando';
      puntos = 0;
      tiempoRestante = DURACION;
      proximoTopo = 0.5;
    }

    for (const topo of topos) actualizarTopo(topo, dt);

    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      p.vida -= dt;
      p.vel.y -= 4 * dt;
      p.malla.position.addScaledVector(p.vel, dt);
      p.malla.rotation.y += 8 * dt;
      p.malla.scale.setScalar(Math.max(0.01, p.vida / 0.6));
      if (p.vida <= 0) {
        raiz.remove(p.malla);
        particulas.splice(i, 1);
      }
    }

    if (ctx.enVR()) {
      pivote.visible = false;
      golpesVR(dt);
    } else {
      golpesRaton(dt);
    }

    actualizarMarcador();
  }

  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      particulas.length = 0;
    },
  };
}
