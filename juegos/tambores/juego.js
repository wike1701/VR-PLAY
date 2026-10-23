// TAMBORES
// Una batería en un escenario de concierto. Por cada carril llegan aros de luz del color
// de un tambor: golpéalo justo cuando el aro llega al parche. La canción dura 75 segundos
// y va subiendo de ritmo. «¡Perfecto!» (muy a tiempo) vale 3 y «Bien» 1, multiplicado
// por la racha (x2 a los 10 seguidos, x3 a los 20 y x4 a los 30). Fallar rompe la racha.
// En VR llevas una baqueta en cada mano; sin gafas, haz clic (o toca) en el tambor.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código.
export async function precargar() {}

const DURACION = 75;
const LLEGADA = 1.9;            // segundos que tarda un aro desde que aparece hasta el parche
const PERFECTO = 0.07;          // ventana de «¡Perfecto!» (s)
const BIEN = 0.15;              // ventana de «Bien» (s)
const LARGO_BAQUETA = 0.36;
const R_PUNTA = 0.016;
const N_AROS = 28;
// Los cuatro tambores: posición del centro del parche, radio, inclinación y color
const TAMBORES = [
  { x: -0.47, y: 0.85, z: -0.4, r: 0.13, giro: 0.36, color: 0x2ee6d6, sonido: 'tambor0' },
  { x: -0.17, y: 0.85, z: -0.4, r: 0.15, giro: 0.36, color: 0xffd23f, sonido: 'tambor1' },
  { x: 0.15, y: 0.85, z: -0.4, r: 0.15, giro: 0.36, color: 0xff6a3d, sonido: 'tambor2' },
  { x: 0.52, y: 0.85, z: -0.4, r: 0.2, giro: 0.36, color: 0xb36bff, sonido: 'tambor3' },
];

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (r) => ctx.recurso(r);

  ctx.fondo(0x120a24, { cenit: 0x070312, horizonte: 0x2a1048, suelo: 0x0c0818, estrellas: 0.6, niebla: [10, 30] });
  ctx.sueloBase(false);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.45, 0.42), new THREE.Vector3(0, 0.95, -1.2));

  const matrizTmp = new THREE.Matrix4();
  const eulerTmp = new THREE.Euler();
  function colocar(geo, x, y, z, rx = 0, ry = 0, rz = 0) {
    matrizTmp.makeRotationFromEuler(eulerTmp.set(rx, ry, rz)).setPosition(x, y, z);
    return geo.applyMatrix4(matrizTmp);
  }
  function fusionar(geos) {
    let nv = 0;
    let ni = 0;
    for (const g of geos) {
      nv += g.attributes.position.count;
      ni += g.index ? g.index.count : g.attributes.position.count;
    }
    const pos = new Float32Array(nv * 3);
    const nor = new Float32Array(nv * 3);
    const uv = new Float32Array(nv * 2);
    const indices = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let ov = 0;
    let oi = 0;
    for (const g of geos) {
      const n = g.attributes.position.count;
      pos.set(g.attributes.position.array, ov * 3);
      nor.set(g.attributes.normal.array, ov * 3);
      uv.set(g.attributes.uv.array, ov * 2);
      if (g.index) for (let i = 0; i < g.index.count; i++) indices[oi++] = g.index.array[i] + ov;
      else for (let i = 0; i < n; i++) indices[oi++] = ov + i;
      ov += n;
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    return R(geo);
  }

  // ─── Escenario ─────────────────────────────────────────────────────────
  const tarima = new THREE.Mesh(
    R(new THREE.PlaneGeometry(10, 8)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tablas(0x3a2c26, { tablas: 16, repetir: [2, 2], semilla: 91 })) })),
  );
  tarima.rotation.x = -Math.PI / 2;
  tarima.position.z = -1;
  raiz.add(tarima);
  // Pantalla de LED al fondo
  const texLed = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#0a0614';
    g.fillRect(0, 0, tam, tam);
    const paso = tam / 32;
    for (let y = 0; y < 32; y++) {
      for (let x = 0; x < 32; x++) {
        const v = Math.sin(x * 0.4 + y * 0.25) * 0.5 + 0.5;
        g.fillStyle = `hsl(${280 + v * 60}, 90%, ${18 + v * 30}%)`;
        g.beginPath();
        g.arc(x * paso + paso / 2, y * paso + paso / 2, paso * 0.36, 0, Math.PI * 2);
        g.fill();
      }
    }
  }, { tam: 256, repetir: [3, 1] }));
  const pantalla = new THREE.Mesh(R(new THREE.PlaneGeometry(9, 3)), R(new THREE.MeshBasicMaterial({ map: texLed, toneMapped: false })));
  pantalla.position.set(0, 2.1, -5);
  raiz.add(pantalla);
  // Altavoces, estructura de focos y tarima de la batería
  const texAltavoz = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#1a1a1e';
    g.fillRect(0, 0, tam, tam);
    for (const [y, r] of [[0.3, 0.2], [0.72, 0.16]]) {
      g.fillStyle = '#2c2c32';
      g.beginPath();
      g.arc(tam / 2, tam * y, tam * r, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#0c0c0e';
      g.beginPath();
      g.arc(tam / 2, tam * y, tam * r * 0.35, 0, Math.PI * 2);
      g.fill();
    }
  }, { tam: 128 }));
  const altavoces = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(0.9, 1.4, 0.7), -3, 0.7, -3.4),
    colocar(new THREE.BoxGeometry(0.9, 1.4, 0.7), 3, 0.7, -3.4),
    colocar(new THREE.BoxGeometry(0.8, 1.1, 0.6), -3, 1.95, -3.4),
    colocar(new THREE.BoxGeometry(0.8, 1.1, 0.6), 3, 1.95, -3.4),
  ]), R(new THREE.MeshLambertMaterial({ map: texAltavoz })));
  raiz.add(altavoces);
  const metalOscuro = R(new THREE.MeshLambertMaterial({ color: 0x3a3a44 }));
  const estructura = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(8, 0.12, 0.12), 0, 3.6, -2),
    colocar(new THREE.BoxGeometry(0.12, 3.6, 0.12), -4, 1.8, -2),
    colocar(new THREE.BoxGeometry(0.12, 3.6, 0.12), 4, 1.8, -2),
    colocar(new THREE.BoxGeometry(2.4, 0.25, 2.0), 0, 0.125, -0.25),
  ]), metalOscuro);
  raiz.add(estructura);
  // Focos (solo la carcasa con la lente encendida)
  const N_FOCOS = 6;
  const focos = new THREE.InstancedMesh(R(new THREE.CylinderGeometry(0.12, 0.16, 0.3, 14)), R(new THREE.MeshBasicMaterial({ toneMapped: false })), N_FOCOS);
  const colorTmp = new THREE.Color();
  for (let i = 0; i < N_FOCOS; i++) {
    matrizTmp.makeRotationFromEuler(eulerTmp.set(0.6, 0, 0)).setPosition(-3 + i * 1.2, 3.4, -2);
    focos.setMatrixAt(i, matrizTmp);
    focos.setColorAt(i, colorTmp.set([0xff6a3d, 0x2ee6d6, 0xffd23f, 0xb36bff][i % 4]));
  }
  raiz.add(focos);

  // ─── Batería ───────────────────────────────────────────────────────────
  const matRiel = R(new THREE.MeshStandardMaterial({ color: 0xd9dee5, roughness: 0.2, metalness: 1 }));
  const geoParche = R(new THREE.CircleGeometry(1, 36));
  geoParche.rotateX(-Math.PI / 2);
  const geoAro = R(new THREE.TorusGeometry(1, 0.06, 8, 40));
  geoAro.rotateX(Math.PI / 2);
  const geoCasco = R(new THREE.CylinderGeometry(1, 1, 1, 36, 1, true));
  const texCasco = R(ctx.texturaCanvas((g, tam, azar) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, tam, tam);
    for (let i = 0; i < 300; i++) {
      g.fillStyle = `rgba(255,255,255,${0.3 + azar() * 0.5})`;
      g.fillRect(azar() * tam, azar() * tam, 2, 2);
      g.fillStyle = `rgba(0,0,0,${azar() * 0.15})`;
      g.fillRect(azar() * tam, azar() * tam, 2, 2);
    }
  }, { tam: 128 }));
  const soportes = [];
  const tambores = TAMBORES.map((def, i) => {
    const grupo = new THREE.Group();
    grupo.position.set(def.x, def.y, def.z);
    grupo.rotation.x = def.giro;
    const alto = def.r * (i === 3 ? 1.6 : 1.1);
    const casco = new THREE.Mesh(geoCasco, R(new THREE.MeshLambertMaterial({ map: texCasco, color: new THREE.Color(def.color).multiplyScalar(0.55), side: THREE.DoubleSide })));
    casco.scale.set(def.r, alto, def.r);
    casco.position.y = -alto / 2;
    const matParche = R(new THREE.MeshLambertMaterial({ color: 0xf2eee6, emissive: def.color, emissiveIntensity: 0 }));
    const parche = new THREE.Mesh(geoParche, matParche);
    parche.scale.setScalar(def.r);
    parche.position.y = 0.002;
    const aroSup = new THREE.Mesh(geoAro, matRiel);
    aroSup.scale.setScalar(def.r);
    const aroInf = new THREE.Mesh(geoAro, matRiel);
    aroInf.scale.setScalar(def.r);
    aroInf.position.y = -alto;
    grupo.add(casco, parche, aroSup, aroInf);
    raiz.add(grupo);
    soportes.push(colocar(new THREE.CylinderGeometry(0.012, 0.012, def.y - 0.25, 8), def.x, (def.y - 0.25) / 2 + 0.25, def.z - 0.05));
    // Carril de luz por donde llegan los aros
    const inicio = new THREE.Vector3(def.x * 2.2, def.y + 1.1, def.z - 3.2);
    const centro = new THREE.Vector3(def.x, def.y, def.z);
    grupo.updateMatrixWorld();
    const normal = new THREE.Vector3(0, 1, 0).applyQuaternion(grupo.quaternion);
    return { ...def, i, grupo, parche, matParche, luz: 0, golpe: 0, inicio, centro, normal, pendientes: [] };
  });
  raiz.add(new THREE.Mesh(fusionar(soportes), matRiel));
  // Carriles: una línea fina que brilla de cada color
  const geoCarril = R(new THREE.CylinderGeometry(0.004, 0.004, 1, 6, 1, true));
  const carriles = tambores.map((tb) => {
    const m = new THREE.Mesh(geoCarril, R(new THREE.MeshBasicMaterial({ color: new THREE.Color(tb.color).multiplyScalar(0.5), toneMapped: false })));
    m.position.copy(tb.inicio).add(tb.centro).multiplyScalar(0.5);
    m.scale.y = tb.inicio.distanceTo(tb.centro);
    m.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), new THREE.Vector3().subVectors(tb.centro, tb.inicio).normalize());
    raiz.add(m);
    return m;
  });
  const banqueta = new THREE.Mesh(fusionar([
    colocar(new THREE.CylinderGeometry(0.18, 0.18, 0.08, 20), 0, 0.55, 0.35),
    colocar(new THREE.CylinderGeometry(0.02, 0.02, 0.3, 8), 0, 0.4, 0.35),
  ]), metalOscuro);
  raiz.add(banqueta);
  const sombraBateria = ctx.crearSombra({ radio: 0.8, opacidad: 0.5 });
  sombraBateria.position.set(0, 0.255, -0.4);
  raiz.add(sombraBateria);

  // ─── Aros de luz que llegan ────────────────────────────────────────────
  const geoNota = R(new THREE.TorusGeometry(1, 0.12, 8, 30));
  geoNota.rotateX(Math.PI / 2);
  const matsNota = tambores.map((tb) => R(new THREE.MeshBasicMaterial({ color: tb.color, toneMapped: false })));
  const notasMalla = Array.from({ length: N_AROS }, () => {
    const m = new THREE.Mesh(geoNota, matsNota[0]);
    m.visible = false;
    raiz.add(m);
    return m;
  });

  // ─── Baquetas ──────────────────────────────────────────────────────────
  const geoBaqueta = R(new THREE.CylinderGeometry(0.0075, 0.0105, LARGO_BAQUETA, 12));
  geoBaqueta.rotateX(-Math.PI / 2);
  geoBaqueta.translate(0, 0, -LARGO_BAQUETA / 2 + 0.06);
  const geoPunta = R(new THREE.SphereGeometry(0.011, 10, 8));
  geoPunta.scale(1, 1, 1.4);
  const geoCinta = R(new THREE.CylinderGeometry(0.0115, 0.0115, 0.08, 12));
  geoCinta.rotateX(-Math.PI / 2);
  const matBaqueta = R(new THREE.MeshStandardMaterial({ map: R(ctx.texturas.madera(0xe6c48c, { tam: 128, semilla: 92 })), roughness: 0.45 }));
  const matCinta = R(new THREE.MeshStandardMaterial({ color: 0xff6a3d, roughness: 0.9 }));
  function crearBaqueta() {
    const g = new THREE.Group();
    const palo = new THREE.Mesh(geoBaqueta, matBaqueta);
    const punta = new THREE.Mesh(geoPunta, matBaqueta);
    punta.position.z = -LARGO_BAQUETA + 0.06;
    const cinta = new THREE.Mesh(geoCinta, matCinta);
    cinta.position.z = 0.02;
    g.add(palo, punta, cinta);
    return g;
  }
  const PUNTA_EN_MANO = new THREE.Vector3(0, 0, -LARGO_BAQUETA + 0.06);
  const baquetas = ctx.manos.map((mano) => {
    const b = crearBaqueta();
    b.rotation.x = -0.5; // un poco hacia abajo, como se cogen
    ctx.adjuntarAMano(mano, b);
    return { mano, objeto: b, punta: new THREE.Vector3(), lado: new Map(), listo: true };
  });
  const baquetaRaton = crearBaqueta();
  raiz.add(baquetaRaton);
  let golpeRaton = 0;
  let tamborRaton = 1;

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.1, alto: 0.32 });
  marcador.mesh.position.set(0, 1.75, -1.9);
  raiz.add(marcador.mesh);

  // ─── Estado y canción ──────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'juego' | 'fin'
  let reloj = 3;
  let tiempo = 0;
  let puntos = 0;
  let racha = 0;
  let mejorRacha = 0;
  let perfectos = 0;
  let record = ctx.leer('record', 0);
  let aviso = '';
  let tiempoAviso = 0;
  let siguienteNota = 0;
  let siguientePulso = 0;
  let pulsoN = 0;
  const notas = []; // { t, tambor, hecha, malla }
  const pulsos = [];
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const tmp3 = new THREE.Vector3();

  const multiplicador = () => Math.min(4, 1 + Math.floor(racha / 10));

  // Patrones de un compás (8 corcheas; -1 = silencio) por dificultad
  const PATRONES = [
    [[3, -1, 1, -1, 3, -1, 1, -1], [3, -1, 2, -1, 3, -1, 2, -1], [0, -1, 1, -1, 2, -1, 3, -1]],
    [[3, -1, 1, 1, 3, -1, 1, -1], [0, -1, 1, -1, 2, 2, 3, -1], [3, 3, 1, -1, 3, -1, 1, 2], [0, 1, 2, -1, 3, -1, 1, -1]],
    [[3, 1, 1, 3, 3, 1, 2, 1], [0, 0, 1, 1, 2, 2, 3, 3], [3, 1, 0, 1, 3, 2, 1, 0], [1, 1, 2, 1, 3, 1, 0, 2]],
  ];
  function componer() {
    notas.length = 0;
    pulsos.length = 0;
    let t = 2.2;
    let compas = 0;
    while (t < DURACION - 1) {
      const progreso = t / DURACION;
      const bpm = 92 + progreso * 46;
      const corchea = 60 / bpm / 2;
      const nivel = progreso < 0.3 ? 0 : progreso < 0.65 ? 1 : 2;
      const patron = PATRONES[nivel][Math.floor(Math.random() * PATRONES[nivel].length)];
      for (let k = 0; k < 8; k++) {
        if (k % 2 === 0) pulsos.push({ t, fuerte: k === 0 });
        if (patron[k] >= 0) notas.push({ t, tambor: patron[k], hecha: false, malla: null });
        t += corchea;
      }
      compas++;
    }
    void compas;
  }

  function empezarPartida() {
    componer();
    for (const tb of tambores) tb.pendientes.length = 0;
    for (const m of notasMalla) m.visible = false;
    tiempo = 0;
    puntos = 0;
    racha = 0;
    mejorRacha = 0;
    perfectos = 0;
    siguienteNota = 0;
    siguientePulso = 0;
    pulsoN = 0;
    estado = 'juego';
  }

  function terminar() {
    estado = 'fin';
    reloj = 7;
    ctx.sonido('ovacion');
    ctx.puntuacion(puntos); // a la clasificación (juegos/marcadores.js)
    if (puntos > record) {
      record = puntos;
      ctx.guardar('record', record);
    }
    for (const m of notasMalla) m.visible = false;
  }

  function soltarMalla(nota) {
    if (nota.malla) nota.malla.visible = false;
    nota.malla = null;
  }

  function fallo(nota) {
    nota.hecha = true;
    soltarMalla(nota);
    if (racha >= 10) {
      aviso = ctx.t('rachaRota');
      tiempoAviso = 1.0;
    }
    // Solo suena el fallo si se rompe una racha que valía la pena (si no, sería un pitido continuo)
    if (racha >= 5) ctx.sonido('fallo');
    racha = 0;
  }

  // Golpe en un tambor en el instante «tiempo»
  function golpear(i, mano, fuerza = 1) {
    const tb = tambores[i];
    tb.golpe = 0.12;
    tb.luz = Math.max(tb.luz, 0.5);
    ctx.sonido(tb.sonido);
    if (estado !== 'juego') {
      ctx.vibrar(mano, 0.2 * fuerza, 20);
      return;
    }
    // La nota pendiente de ese tambor más cercana en el tiempo
    let mejor = null;
    let dif = BIEN;
    for (let k = siguienteNota; k < notas.length; k++) {
      const n = notas[k];
      if (n.t - tiempo > BIEN) break;
      if (n.hecha || n.tambor !== i) continue;
      const d = Math.abs(n.t - tiempo);
      if (d <= dif) {
        dif = d;
        mejor = n;
      }
    }
    tmp.copy(tb.centro).addScaledVector(tb.normal, 0.06);
    if (!mejor) {
      // Golpe sin nota: rompe la racha, pero sin quitar puntos
      if (racha > 0) racha = 0;
      ctx.vibrar(mano, 0.15, 20);
      return;
    }
    mejor.hecha = true;
    soltarMalla(mejor);
    racha += 1;
    mejorRacha = Math.max(mejorRacha, racha);
    const perfecto = dif <= PERFECTO;
    if (perfecto) perfectos += 1;
    const suma = (perfecto ? 3 : 1) * multiplicador();
    puntos += suma;
    tb.luz = 1;
    const hito = racha > 0 && racha % 10 === 0 && racha <= 30;
    ctx.efectos.impacto(hito ? 'grande' : perfecto ? 'medio' : 'pequeño', { pos: tmp, mano, color: tb.color });
    ctx.efectos.texto(tmp, perfecto ? `+${suma}` : `+${suma}`, { color: perfecto ? '#ffe08a' : '#ffffff', tam: perfecto ? 1 : 0.75 });
    aviso = hito ? ctx.t('multiplicador', { n: multiplicador() }) : perfecto ? ctx.t('perfecto') : ctx.t('bien');
    tiempoAviso = hito ? 1.2 : 0.5;
  }

  function actualizarMarcador() {
    if (estado === 'intro') {
      const intro = ctx.enVR() ? ctx.t('intro') : ctx.t(ctx.tactil ? 'introTactil' : 'introRaton');
      marcador.escribir([
        { texto: ctx.t('titulo'), tam: 1.3, color: '#ffd23f' },
        { texto: intro, tam: 0.72 },
      ]);
    } else if (estado === 'fin') {
      marcador.escribir([
        { texto: ctx.t('partida.finPuntos', { n: puntos }), tam: 1.25, color: '#ffd23f' },
        { texto: ctx.t('resumen', { racha: mejorRacha, perfectos, record, n: Math.max(1, Math.ceil(reloj)) }), tam: 0.66 },
      ]);
    } else {
      marcador.escribir([
        { texto: ctx.t('marcador', { puntos, x: multiplicador() }), tam: 1.15 },
        { texto: tiempoAviso > 0 ? aviso : ctx.t('racha', { n: racha, s: Math.max(0, Math.ceil(DURACION - tiempo)) }), tam: 0.8, color: tiempoAviso > 0 ? '#ffe08a' : '#cfd8dc' },
      ]);
    }
  }

  // ─── Golpes con las baquetas (VR) ──────────────────────────────────────
  function baquetasVR() {
    for (const b of baquetas) {
      if (!b.mano.activa) { b.previa = null; continue; }
      // La punta real de la baqueta (la que se ve), no la del mando
      b.objeto.updateWorldMatrix(true, false);
      b.objeto.localToWorld(b.punta.copy(PUNTA_EN_MANO));
      for (const tb of tambores) {
        // Altura de la punta sobre el plano del parche
        tmp.copy(b.punta).sub(tb.centro);
        const altura = tmp.dot(tb.normal) - R_PUNTA;
        const antes = b.lado.get(tb.i) ?? 1;
        if (altura > 0.02) {
          b.lado.set(tb.i, 1);
        } else if (altura < 0 && antes === 1 && b.previa) {
          // Se mira dónde cruzó el plano entre dos fotogramas, para no fallar con golpes rápidos
          const alturaPrevia = tmp3.copy(b.previa).sub(tb.centro).dot(tb.normal) - R_PUNTA;
          const k = alturaPrevia > altura ? Math.min(1, Math.max(0, alturaPrevia / (alturaPrevia - altura))) : 1;
          tmp2.copy(b.previa).lerp(b.punta, k).sub(tb.centro);
          tmp2.addScaledVector(tb.normal, -tmp2.dot(tb.normal));
          // Solo cuenta si cruza sobre el parche o su aro (r × 1,06)
          if (tmp2.length() < tb.r * 1.06) {
            b.lado.set(tb.i, -1);
            golpear(tb.i, b.mano);
          } else if (altura < -0.08) b.lado.set(tb.i, -1);
        }
      }
      (b.previa ??= new THREE.Vector3()).copy(b.punta);
    }
  }

  // ─── Ratón y pantalla táctil ───────────────────────────────────────────
  const parches = tambores.map((tb) => tb.parche);
  function raton(dt) {
    baquetaRaton.visible = ctx.raton.dentro || ctx.tactil;
    const choque = ctx.raton.rayo.intersectObjects(parches, false)[0];
    if (choque) tamborRaton = parches.indexOf(choque.object);
    if (ctx.raton.clic && choque) {
      golpear(tamborRaton, null);
      golpeRaton = 0.14;
    }
    golpeRaton = Math.max(0, golpeRaton - dt);
    // La baqueta flota sobre el tambor apuntado y baja al golpear
    const tb = tambores[tamborRaton];
    const bajada = golpeRaton > 0.08 ? (0.14 - golpeRaton) / 0.06 : golpeRaton / 0.08;
    tmp.copy(tb.centro).addScaledVector(tb.normal, 0.012 + 0.09 * (1 - bajada));
    tmp2.set(tmp.x + 0.12, tmp.y + 0.2, tmp.z + 0.28);
    baquetaRaton.position.copy(tmp2);
    baquetaRaton.lookAt(tmp2.multiplyScalar(2).sub(tmp));
    baquetaRaton.position.addScaledVector(tmp.sub(baquetaRaton.position).normalize(), -0.06);
  }

  // ─── Bucle ─────────────────────────────────────────────────────────────
  function actualizar(dt, t) {
    reloj -= dt;
    tiempoAviso -= dt;
    if ((estado === 'intro' || estado === 'fin') && reloj <= 0) empezarPartida();

    if (estado === 'juego') {
      tiempo += dt;
      // Pulso de fondo
      while (siguientePulso < pulsos.length && pulsos[siguientePulso].t <= tiempo) {
        ctx.sonido(pulsos[siguientePulso].fuerte ? 'bajo' : 'pulso');
        siguientePulso++;
        pulsoN++;
      }
      // Notas que aparecen, se acercan y se pasan
      for (let k = siguienteNota; k < notas.length; k++) {
        const n = notas[k];
        const falta = n.t - tiempo;
        if (falta > LLEGADA) break;
        if (n.hecha) continue;
        if (falta < -BIEN) {
          fallo(n);
          continue;
        }
        if (!n.malla) {
          n.malla = notasMalla.find((m) => !m.visible) || null;
          if (n.malla) {
            n.malla.visible = true;
            n.malla.material = matsNota[n.tambor];
          }
        }
        if (n.malla) {
          const tb = tambores[n.tambor];
          const u = 1 - falta / LLEGADA;
          n.malla.position.lerpVectors(tb.inicio, tb.centro, Math.min(1, u));
          n.malla.quaternion.copy(tb.grupo.quaternion);
          n.malla.scale.setScalar(tb.r * (0.55 + 0.45 * u));
        }
      }
      while (siguienteNota < notas.length && notas[siguienteNota].hecha) siguienteNota++;
      if (tiempo >= DURACION) terminar();
    }

    if (ctx.enVR()) {
      baquetaRaton.visible = false;
      baquetasVR();
    } else {
      raton(dt);
    }

    // Parches que se iluminan y botan
    for (const tb of tambores) {
      tb.luz = Math.max(0, tb.luz - dt * 4);
      tb.golpe = Math.max(0, tb.golpe - dt);
      tb.matParche.emissiveIntensity = tb.luz * 1.2;
      tb.parche.position.y = 0.002 - (tb.golpe > 0 ? 0.004 : 0);
    }
    // Los focos laten con el pulso
    focos.position.y = Math.sin(t * 2) * 0.01;
    for (let i = 0; i < carriles.length; i++) carriles[i].material.color.setHex(tambores[i].color).multiplyScalar(0.35 + tambores[i].luz * 0.65);
    actualizarMarcador();
  }

  componer();
  actualizarMarcador();

  return {
    actualizar,
    liberar() {},
  };
}
