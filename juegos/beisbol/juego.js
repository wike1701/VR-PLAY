// BATEA BOLAS
// El lanzador te tira 10 bolas por ronda: batéalas lo más lejos posible.
// En VR el bate va en una mano (el gatillo de la otra lo cambia de mano);
// con ratón se elige la altura del bate y se batea con un clic.
// El campo es más pequeño que uno real para que los home runs sean posibles.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const LANZAMIENTOS = 10;
const G = 9.8;
const DISTANCIA_LANZADOR = 14;  // del montículo al bateador (la real es 18,4 m)
const LADO_DIAMANTE = 20;       // distancia entre bases (la real es 27,4 m)
const RADIO_VALLA = 55;         // distancia a la valla del fondo
const ALTO_VALLA = 2.5;
const RED_TRASERA = 4;          // red detrás del bateador
const DESVIO = 0.6;             // la bola pasa a esta distancia del jugador, por el lado del bate
const RADIO_BOLA = 0.045;       // algo más grande que la real (0,037) para verla bien
const INICIO_BATE = -0.15;      // parte del bate que golpea, medida desde el puño
const PUNTA_BATE = -0.82;
const CHOQUE_VR = 0.04;         // grosor del bate para el choque (con un poco de margen)
const CHOQUE_RATON = 0.07;      // con ratón hay más margen: solo se elige la altura
const REBOTE = 0.55;            // cuánto rebota la bola en el bate
const VELOCIDAD_MAXIMA = 55;    // m/s de salida como mucho
const ANGULO_BUENO = 45;        // la bola es buena si sale a menos de 45° del centro
// Distancias (hasta el primer bote) para cada tipo de golpe
const ELIMINADO = 8;
const DOBLE = 22;
const TRIPLE = 38;
// Bateo con ratón: el bate gira alrededor de un punto junto al jugador
const GIRO_INICIO = THREE.MathUtils.degToRad(-60);  // bate atrás, a la derecha
const GIRO_FIN = THREE.MathUtils.degToRad(240);     // bate atrás, a la izquierda
const DURACION_GIRO = 0.35;
const RADIO_MANOS_RATON = 0.25;

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  ctx.fondo(0x8ec9f0);
  // La valla está lejos: alejamos la niebla mientras dura este juego
  const niebla = ctx.escena.fog;
  const nieblaOriginal = { near: niebla.near, far: niebla.far };
  niebla.near = 45;
  niebla.far = 170;
  ctx.vistaEscritorio(new THREE.Vector3(-0.35, 1.5, 2.3), new THREE.Vector3(0.3, 1.1, -DISTANCIA_LANZADOR));

  // ─── Campo ─────────────────────────────────────────────────────────────
  const plano = (geo, mat, x, y, z, giro = 0) => {
    const m = new THREE.Mesh(geo, mat);
    m.rotation.set(-Math.PI / 2, 0, giro);
    m.position.set(x, y, z);
    raiz.add(m);
    return m;
  };
  const matCesped = R(new THREE.MeshLambertMaterial({ color: 0x4caf50 }));
  const matTierra = R(new THREE.MeshLambertMaterial({ color: 0xc68a4e }));
  const matCal = R(new THREE.MeshBasicMaterial({ color: 0xffffff }));
  plano(R(new THREE.PlaneGeometry(300, 300)), matCesped, 0, 0.003, -60);

  // Diamante: la base de casa está en el origen
  const centroDiamante = LADO_DIAMANTE / Math.SQRT2;
  plano(R(new THREE.PlaneGeometry(LADO_DIAMANTE + 5, LADO_DIAMANTE + 5)), matTierra, 0, 0.005, -centroDiamante, Math.PI / 4);
  plano(R(new THREE.PlaneGeometry(LADO_DIAMANTE - 3, LADO_DIAMANTE - 3)), R(new THREE.MeshLambertMaterial({ color: 0x43a047 })), 0, 0.007, -centroDiamante, Math.PI / 4);
  plano(R(new THREE.CircleGeometry(3, 24)), matTierra, 0, 0.008, 0);
  const geoBase = R(new THREE.BoxGeometry(0.4, 0.06, 0.4));
  for (const [x, z] of [[centroDiamante, -centroDiamante], [0, -2 * centroDiamante], [-centroDiamante, -centroDiamante]]) {
    const base = new THREE.Mesh(geoBase, matCal);
    base.position.set(x, 0.03, z);
    base.rotation.y = Math.PI / 4;
    raiz.add(base);
  }
  const casa = new THREE.Mesh(R(new THREE.BoxGeometry(0.43, 0.02, 0.43)), matCal);
  casa.position.y = 0.012;
  raiz.add(casa);

  // Líneas de falta, de casa a la valla
  const geoLinea = R(new THREE.PlaneGeometry(0.1, RADIO_VALLA));
  for (const s of [-1, 1]) {
    const angulo = THREE.MathUtils.degToRad(ANGULO_BUENO);
    plano(geoLinea, matCal, s * Math.sin(angulo) * RADIO_VALLA / 2, 0.01, -Math.cos(angulo) * RADIO_VALLA / 2, -s * angulo);
  }

  // Montículo
  const monticulo = new THREE.Mesh(R(new THREE.CylinderGeometry(2.4, 2.8, 0.25, 24)), matTierra);
  monticulo.position.set(0, 0.125, -DISTANCIA_LANZADOR);
  raiz.add(monticulo);

  // Valla, gradas y postes de falta
  const matValla = R(new THREE.MeshLambertMaterial({ color: 0x1b5e20 }));
  const matBorde = R(new THREE.MeshLambertMaterial({ color: 0xffd600 }));
  const matGradas = [0x37474f, 0x455a64, 0x546e7a].map((c) => R(new THREE.MeshLambertMaterial({ color: c })));
  const PASO = 4;
  const ancho = (radio) => 2 * radio * Math.sin(THREE.MathUtils.degToRad(PASO / 2)) + 0.15;
  const geoValla = R(new THREE.BoxGeometry(ancho(RADIO_VALLA), ALTO_VALLA, 0.3));
  const geoBorde = R(new THREE.BoxGeometry(ancho(RADIO_VALLA), 0.12, 0.34));
  const gradas = [1, 2, 3].map((fila) => ({
    radio: RADIO_VALLA + fila * 4,
    alto: fila * 3,
    geo: R(new THREE.BoxGeometry(ancho(RADIO_VALLA + fila * 4), fila * 3, 4)),
    mat: matGradas[fila - 1],
  }));
  for (let grados = -52; grados <= 52; grados += PASO) {
    const a = THREE.MathUtils.degToRad(grados);
    const colocar = (malla, radio, y) => {
      malla.position.set(radio * Math.sin(a), y, -radio * Math.cos(a));
      malla.rotation.y = -a;
      raiz.add(malla);
    };
    colocar(new THREE.Mesh(geoValla, matValla), RADIO_VALLA, ALTO_VALLA / 2);
    colocar(new THREE.Mesh(geoBorde, matBorde), RADIO_VALLA, ALTO_VALLA);
    for (const g of gradas) colocar(new THREE.Mesh(g.geo, g.mat), g.radio, g.alto / 2);
  }
  const geoPoste = R(new THREE.CylinderGeometry(0.15, 0.15, 12, 10));
  for (const s of [-1, 1]) {
    const a = THREE.MathUtils.degToRad(ANGULO_BUENO);
    const poste = new THREE.Mesh(geoPoste, matBorde);
    poste.position.set(s * Math.sin(a) * RADIO_VALLA, 6, -Math.cos(a) * RADIO_VALLA);
    raiz.add(poste);
  }

  // Red detrás del bateador
  const red = new THREE.Mesh(R(new THREE.PlaneGeometry(14, 6, 28, 12)), R(new THREE.MeshBasicMaterial({ color: 0x263238, wireframe: true, transparent: true, opacity: 0.5 })));
  red.position.set(0, 3, RED_TRASERA + 0.05);
  raiz.add(red);

  // Zona de strike (por donde pasa la bola)
  const geoZona = R(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(-0.225, 0.6, 0), new THREE.Vector3(0.225, 0.6, 0),
    new THREE.Vector3(0.225, 1.3, 0), new THREE.Vector3(-0.225, 1.3, 0),
  ]));
  const zona = new THREE.LineLoop(geoZona, R(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.45 })));
  raiz.add(zona);

  // ─── Bola, estela y marca de caída ─────────────────────────────────────
  const bola = new THREE.Mesh(R(new THREE.SphereGeometry(RADIO_BOLA, 14, 10)), R(new THREE.MeshBasicMaterial({ color: 0xfafafa })));
  const costura = new THREE.Mesh(R(new THREE.TorusGeometry(RADIO_BOLA * 0.75, 0.004, 4, 16)), R(new THREE.MeshBasicMaterial({ color: 0xd32f2f })));
  costura.rotation.x = 0.6;
  bola.add(costura);
  raiz.add(bola);

  const MAX_ESTELA = 40;
  const geoEstela = R(new THREE.BufferGeometry());
  geoEstela.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_ESTELA * 3), 3));
  const estela = new THREE.Line(geoEstela, R(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })));
  estela.frustumCulled = false;
  raiz.add(estela);
  const puntosEstela = [];

  const matMarca = R(new THREE.MeshBasicMaterial({ color: 0xffd740, side: THREE.DoubleSide }));
  const marca = plano(R(new THREE.RingGeometry(0.6, 0.9, 24)), matMarca, 0, 0.03, 0);
  marca.visible = false;

  // ─── Lanzador ──────────────────────────────────────────────────────────
  // Construido mirando a +Z (hacia el bateador); su brazo derecho queda en -X
  const lanzador = new THREE.Group();
  const matCamiseta = R(new THREE.MeshLambertMaterial({ color: 0x1565c0 }));
  const matPantalon = R(new THREE.MeshLambertMaterial({ color: 0xeeeeee }));
  const matPiel = R(new THREE.MeshLambertMaterial({ color: 0xffcc80 }));
  const geoPierna = R(new THREE.BoxGeometry(0.13, 0.85, 0.13));
  geoPierna.translate(0, -0.425, 0);
  const geoBrazo = R(new THREE.BoxGeometry(0.09, 0.6, 0.09));
  geoBrazo.translate(0, -0.3, 0);
  const torso = new THREE.Mesh(R(new THREE.BoxGeometry(0.42, 0.6, 0.24)), matCamiseta);
  torso.position.y = 1.2;
  const cabeza = new THREE.Mesh(R(new THREE.SphereGeometry(0.12, 12, 10)), matPiel);
  cabeza.position.y = 1.65;
  const gorra = new THREE.Mesh(R(new THREE.CylinderGeometry(0.125, 0.125, 0.07, 12)), matCamiseta);
  gorra.position.y = 1.74;
  const visera = new THREE.Mesh(R(new THREE.BoxGeometry(0.2, 0.02, 0.12)), matCamiseta);
  visera.position.set(0, 1.72, 0.14);
  lanzador.add(torso, cabeza, gorra, visera);
  for (const s of [-1, 1]) {
    const pierna = new THREE.Mesh(geoPierna, matPantalon);
    pierna.position.set(s * 0.11, 0.88, 0);
    lanzador.add(pierna);
  }
  const brazoQuieto = new THREE.Mesh(geoBrazo, matCamiseta);
  brazoQuieto.position.set(0.27, 1.45, 0);
  brazoQuieto.rotation.x = -0.5;
  const guante = new THREE.Mesh(R(new THREE.BoxGeometry(0.14, 0.16, 0.08)), R(new THREE.MeshLambertMaterial({ color: 0x6d4c41 })));
  guante.position.y = -0.62;
  brazoQuieto.add(guante);
  const brazo = new THREE.Mesh(geoBrazo, matCamiseta);
  brazo.position.set(-0.27, 1.45, 0);
  lanzador.add(brazoQuieto, brazo);
  lanzador.position.set(0, 0.25, -DISTANCIA_LANZADOR);
  raiz.add(lanzador);

  // Ángulo del brazo durante el lanzamiento (0 = colgando; π = hacia arriba)
  const SUELTA = 0.75; // segundos desde que empieza el gesto hasta que suelta la bola
  function anguloBrazo(t) {
    if (t < 0.55) return (t / 0.55) * Math.PI;
    if (t < SUELTA) return Math.PI * (1 + 0.3 * (t - 0.55) / (SUELTA - 0.55));
    if (t < 1) return Math.PI * (1.3 + 0.45 * (t - SUELTA) / (1 - SUELTA));
    return Math.PI * (1.75 + 0.25 * Math.min(1, (t - 1) / 0.4));
  }

  // ─── Bates ─────────────────────────────────────────────────────────────
  // Puño en el origen y el bate hacia delante (-Z), como las espadas de Corta Fruta
  const geoBate = R(new THREE.CylinderGeometry(0.033, 0.014, 0.84, 14));
  geoBate.rotateX(-Math.PI / 2);
  geoBate.translate(0, 0, -0.35);
  const geoPomo = R(new THREE.CylinderGeometry(0.022, 0.022, 0.02, 12));
  geoPomo.rotateX(-Math.PI / 2);
  geoPomo.translate(0, 0, 0.075);
  const geoCinta = R(new THREE.CylinderGeometry(0.017, 0.016, 0.16, 12));
  geoCinta.rotateX(-Math.PI / 2);
  const matMadera = R(new THREE.MeshLambertMaterial({ color: 0xd2a565 }));
  const matCinta = R(new THREE.MeshLambertMaterial({ color: 0x212121 }));

  function crearBate() {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geoBate, matMadera), new THREE.Mesh(geoPomo, matCinta), new THREE.Mesh(geoCinta, matCinta));
    return g;
  }

  const batesVR = ctx.manos.map((mano) => ({ mano, objeto: ctx.adjuntarAMano(mano, crearBate()) }));
  let ladoBate = 'right';

  // Bate del modo escritorio: gira alrededor de un punto junto al jugador
  const brazoRaton = new THREE.Group();
  const bateRaton = crearBate();
  bateRaton.position.z = -RADIO_MANOS_RATON;
  brazoRaton.add(bateRaton);
  raiz.add(brazoRaton);
  const barra = new THREE.Mesh(R(new THREE.BoxGeometry(0.5, 0.012, 0.012)), R(new THREE.MeshBasicMaterial({ color: 0xffd740 })));
  raiz.add(barra);
  const planoZona = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
  let alturaRaton = 0.95;
  const giro = { fase: 'listo', t: 0 }; // 'listo' | 'golpe' | 'final' | 'vuelta'

  // Posición del bate en este fotograma y en el anterior (para el choque y su velocidad)
  const bate = {
    inicio: new THREE.Vector3(), punta: new THREE.Vector3(),
    inicioAnterior: new THREE.Vector3(), puntaAnterior: new THREE.Vector3(),
    mano: null, radio: CHOQUE_VR, activo: false, lista: false,
  };
  let lado = 1; // 1 = bate en la derecha (la bola pasa por la derecha), -1 = izquierda

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 4.4, alto: 1.15 });
  marcador.mesh.position.set(0, 4.6, -18);
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'espera' | 'lanzamiento' | 'vuelo' | 'resultado' | 'fin'
  let reloj = 3.5;
  let turno = 0;        // lanzamiento actual (0..9)
  let resultados = [];  // { puntos, simbolo }
  let record = ctx.leer('record', 0);
  let mensaje = '';
  let colorMensaje = '#ffffff';
  let tBrazo = -1;      // tiempo del gesto del lanzador (-1 = quieto)
  let bateada = false;
  let resuelto = false;
  let vidaBola = 0;
  const vel = new THREE.Vector3();
  const efecto = new THREE.Vector3(); // aceleración (gravedad y, a veces, curva)

  const anterior = new THREE.Vector3();
  const velBate = new THREE.Vector3();
  const normal = new THREE.Vector3();
  const cercano = new THREE.Vector3();
  const a = new THREE.Vector3();
  const b = new THREE.Vector3();
  const segmento = new THREE.Line3();
  const tmp = new THREE.Vector3();

  const puntos = () => resultados.reduce((suma, r) => suma + r.puntos, 0);

  function actualizarMarcador() {
    const fila = Array.from({ length: LANZAMIENTOS }, (_, i) => (i < resultados.length ? resultados[i].simbolo : '·')).join(' ');
    if (estado === 'intro') {
      marcador.escribir([
        { texto: 'BATEA BOLAS', tam: 1.3, color: '#ffd740' },
        { texto: ctx.enVR() ? 'Batea con fuerza · el gatillo de la otra mano cambia el bate de mano' : 'Elige la altura con el ratón y haz clic para batear', tam: 0.7 },
        { texto: `${LANZAMIENTOS} lanzamientos · Récord: ${record} puntos`, tam: 0.7, color: '#ffe57f' },
      ]);
    } else if (estado === 'fin') {
      marcador.escribir([
        { texto: `¡Fin! ${puntos()} puntos`, tam: 1.3, color: '#ffd740' },
        { texto: fila, tam: 0.8 },
        { texto: `Récord: ${record} · otra ronda en ${Math.ceil(reloj)}`, tam: 0.7 },
      ]);
    } else {
      marcador.escribir([
        estado === 'resultado'
          ? { texto: mensaje, tam: 1.3, color: colorMensaje }
          : { texto: `Lanzamiento ${turno + 1} de ${LANZAMIENTOS}`, tam: 1.3 },
        { texto: fila, tam: 0.8 },
        { texto: `Puntos: ${puntos()}   ·   Récord: ${record}   ·   ★ home run = 4`, tam: 0.7, color: '#ffe57f' },
      ]);
    }
  }

  // ─── Lanzamientos ──────────────────────────────────────────────────────
  function bolaEnLaMano() {
    brazo.rotation.x = tBrazo >= 0 ? anguloBrazo(tBrazo) : 0;
    lanzador.updateMatrixWorld(true);
    brazo.localToWorld(bola.position.set(0, -0.64, 0));
  }

  function prepararLanzamiento() {
    estado = 'espera';
    reloj = 1.3;
    tBrazo = -1;
    bolaEnLaMano();
    bola.scale.setScalar(1);
    vel.set(0, 0, 0);
    bateada = false;
    resuelto = false;
    puntosEstela.length = 0;
    estela.visible = false;
    marca.visible = false;
  }

  function lanzar() {
    const progreso = turno / (LANZAMIENTOS - 1);
    const objetivo = tmp.set(lado * DESVIO + (Math.random() - 0.5) * 0.3, 0.7 + Math.random() * 0.55, 0);
    let rapidez = 16 + progreso * 8 + Math.random() * 2;
    if (turno >= 3 && Math.random() < 0.2) rapidez *= 0.7; // bola lenta para despistar
    const t = objetivo.distanceTo(bola.position) / rapidez;
    // Bolas con curva a partir del cuarto lanzamiento
    const curva = turno >= 3 && Math.random() < 0.4 ? (Math.random() < 0.5 ? -1 : 1) * (3 + Math.random() * 3) : 0;
    efecto.set(curva, -G, 0);
    // p = p0 + v·t + ½·a·t²  →  v = (p − p0 − ½·a·t²) / t
    vel.copy(objetivo).sub(bola.position).addScaledVector(efecto, -0.5 * t * t).divideScalar(t);
    estado = 'vuelo';
    vidaBola = 10;
    ctx.sonido('zas');
  }

  function terminar(puntosGolpe, simbolo, texto, color) {
    resuelto = true;
    resultados.push({ puntos: puntosGolpe, simbolo });
    mensaje = texto;
    colorMensaje = color;
    estado = 'resultado';
    reloj = puntosGolpe === 4 ? 3 : 2.2;
    if (puntosGolpe === 4) {
      ctx.sonido('ovacion');
      ctx.destello(0xffd740, 0.3);
      if (bate.mano) ctx.vibrar(bate.mano, 1, 300);
    } else if (puntosGolpe > 0) {
      ctx.sonido('punto');
    } else {
      ctx.sonido('fallo');
    }
  }

  // Primer bote de una bola bateada (o golpe contra la valla)
  function resolverCaida(contraLaValla) {
    const distancia = Math.hypot(bola.position.x, bola.position.z);
    const angulo = THREE.MathUtils.radToDeg(Math.atan2(bola.position.x, -bola.position.z));
    const buena = bola.position.z < 0 && Math.abs(angulo) <= ANGULO_BUENO;
    const m = Math.round(distancia);
    if (!buena) {
      terminar(0, '✘', '¡Falta!', '#fff59d');
      return;
    }
    marca.position.set(bola.position.x, 0.03, bola.position.z);
    marca.scale.setScalar(Math.max(1, distancia / 12));
    marca.visible = true;
    if (contraLaValla) terminar(3, '3', '¡Triple! Contra la valla', '#b9f6ca');
    else if (distancia < ELIMINADO) terminar(0, '✘', `Eliminado · ${m} m`, '#ffcc80');
    else if (distancia < DOBLE) terminar(1, '1', `Sencillo · ${m} m`, '#ffffff');
    else if (distancia < TRIPLE) terminar(2, '2', `¡Doble! · ${m} m`, '#b9f6ca');
    else terminar(3, '3', `¡Triple! · ${m} m`, '#b9f6ca');
  }

  // ─── Bate: posición en este fotograma ──────────────────────────────────
  function actualizarBate(dt) {
    let golpeando;
    if (ctx.enVR()) {
      brazoRaton.visible = false;
      barra.visible = false;
      const activas = ctx.manos.filter((m) => m.activa);
      for (const m of activas) {
        if (m.gatilloPulsado && (m.lado === 'left' || m.lado === 'right') && m.lado !== ladoBate) {
          ladoBate = m.lado;
          ctx.sonido('tic');
        }
      }
      const mano = activas.find((m) => m.lado === ladoBate) || activas[0] || null;
      for (const bv of batesVR) bv.objeto.visible = bv.mano === mano;
      lado = (mano ? mano.lado : ladoBate) === 'left' ? -1 : 1;
      if (!mano) {
        bate.activo = false;
        bate.lista = false;
        bate.mano = null;
        return;
      }
      if (mano !== bate.mano) bate.lista = false;
      bate.mano = mano;
      bate.radio = CHOQUE_VR;
      mano.grip.localToWorld(bate.inicio.set(0, 0, INICIO_BATE));
      mano.grip.localToWorld(bate.punta.set(0, 0, PUNTA_BATE));
      golpeando = true; // en VR el bate siempre puede golpear
    } else {
      lado = 1;
      bate.mano = null;
      bate.radio = CHOQUE_RATON;
      const raton = ctx.raton;
      if (raton.dentro && giro.fase === 'listo' && raton.rayo.ray.intersectPlane(planoZona, tmp)) {
        alturaRaton = THREE.MathUtils.clamp(tmp.y, 0.45, 1.5);
      }
      if (raton.clic && giro.fase === 'listo') {
        giro.fase = 'golpe';
        giro.t = 0;
        ctx.sonido('zas');
      }
      golpeando = giro.fase === 'golpe';
      giro.t += dt;
      let angulo = GIRO_INICIO;
      if (giro.fase === 'golpe') {
        const f = Math.min(1, giro.t / DURACION_GIRO);
        angulo = THREE.MathUtils.lerp(GIRO_INICIO, GIRO_FIN, f);
        if (f >= 1) { giro.fase = 'final'; giro.t = 0; }
      } else if (giro.fase === 'final') {
        angulo = GIRO_FIN;
        if (giro.t > 0.25) { giro.fase = 'vuelta'; giro.t = 0; }
      } else if (giro.fase === 'vuelta') {
        const f = Math.min(1, giro.t / 0.35);
        angulo = THREE.MathUtils.lerp(GIRO_FIN, GIRO_INICIO, f);
        if (f >= 1) giro.fase = 'listo';
      }
      brazoRaton.visible = true;
      brazoRaton.position.set(lado * (DESVIO - 0.7), alturaRaton, 0.1);
      brazoRaton.rotation.y = lado * (angulo - Math.PI / 2);
      brazoRaton.updateMatrixWorld(true);
      bateRaton.localToWorld(bate.inicio.set(0, 0, INICIO_BATE));
      bateRaton.localToWorld(bate.punta.set(0, 0, PUNTA_BATE));
      barra.visible = raton.dentro;
      barra.position.set(lado * DESVIO, alturaRaton, 0);
    }
    bate.activo = golpeando && bate.lista;
    if (!bate.lista) {
      bate.inicioAnterior.copy(bate.inicio);
      bate.puntaAnterior.copy(bate.punta);
      bate.lista = true;
    }
  }

  // ¿Toca la bola el bate en este subpaso? f = fracción del fotograma (0..1)
  function comprobarBate(f, dt) {
    const pos = bola.position;
    a.lerpVectors(bate.inicioAnterior, bate.inicio, f);
    b.lerpVectors(bate.puntaAnterior, bate.punta, f);
    segmento.set(a, b);
    const s = segmento.closestPointToPointParameter(pos, true);
    segmento.at(s, cercano);
    const radio = bate.radio + RADIO_BOLA;
    if (cercano.distanceTo(pos) >= radio) return;

    // Velocidad del bate en el punto de contacto
    velBate.subVectors(bate.inicio, bate.inicioAnterior).multiplyScalar(1 - s)
      .addScaledVector(tmp.subVectors(bate.punta, bate.puntaAnterior), s)
      .divideScalar(Math.max(dt, 1e-3));
    normal.subVectors(pos, cercano);
    if (normal.lengthSq() < 1e-10) normal.set(0, 0, -1);
    normal.normalize();
    const vn = tmp.subVectors(vel, velBate).dot(normal);
    if (vn >= 0) return; // ya se separan
    // Rebote contra el bate: solo cambia la velocidad en la dirección del golpe
    vel.addScaledVector(normal, -(1 + REBOTE) * vn);
    if (vel.length() > VELOCIDAD_MAXIMA) vel.setLength(VELOCIDAD_MAXIMA);
    pos.copy(cercano).addScaledVector(normal, radio + 0.002);
    efecto.set(0, -G, 0);
    bateada = true;
    estela.visible = true;
    ctx.sonido('bate');
    if (bate.mano) ctx.vibrar(bate.mano, 1, 120);
  }

  function moverBola(dt) {
    const pos = bola.position;
    const movBate = bate.activo && !bateada ? bate.punta.distanceTo(bate.puntaAnterior) : 0;
    const pasos = Math.min(80, Math.max(1, Math.ceil(Math.max(vel.length() * dt, movBate) / 0.03)));
    const h = dt / pasos;
    for (let i = 1; i <= pasos; i++) {
      anterior.copy(pos);
      vel.addScaledVector(efecto, h);
      pos.addScaledVector(vel, h);

      if (!bateada) {
        if (bate.activo) comprobarBate(i / pasos, dt);
        if (!bateada && !resuelto && pos.z > 0.8) terminar(0, '✘', '¡Strike!', '#ff8a80');
      }

      if (bateada) {
        // Valla del fondo
        const d = Math.hypot(pos.x, pos.z);
        const dAnterior = Math.hypot(anterior.x, anterior.z);
        const grados = THREE.MathUtils.radToDeg(Math.atan2(pos.x, -pos.z));
        if (dAnterior < RADIO_VALLA && d >= RADIO_VALLA && pos.z < 0 && Math.abs(grados) <= 52) {
          if (pos.y > ALTO_VALLA) {
            if (!resuelto) {
              marca.visible = false;
              terminar(4, '★', '¡HOME RUN!', '#ffd740');
            }
          } else {
            tmp.set(pos.x / d, 0, pos.z / d);
            const radial = vel.dot(tmp);
            if (radial > 0) vel.addScaledVector(tmp, -1.3 * radial);
            pos.x = tmp.x * (RADIO_VALLA - 0.05);
            pos.z = tmp.z * (RADIO_VALLA - 0.05);
            if (!resuelto) resolverCaida(true);
          }
        }
      }

      // Red trasera
      if (pos.z > RED_TRASERA) {
        pos.z = RED_TRASERA;
        vel.z *= -0.1;
        vel.x *= 0.3;
        if (bateada && !resuelto) terminar(0, '✘', '¡Falta!', '#fff59d');
      }
      // Suelo
      if (pos.y < RADIO_BOLA) {
        pos.y = RADIO_BOLA;
        if (vel.y < 0) {
          if (vel.y < -1) {
            vel.x *= 0.75;
            vel.z *= 0.75;
          }
          vel.y *= -0.4;
        }
        vel.x *= Math.max(0, 1 - 2 * h);
        vel.z *= Math.max(0, 1 - 2 * h);
        if (bateada && !resuelto) resolverCaida(false);
      }
    }
    bola.rotation.x += vel.length() * dt * 8;

    if (bateada) {
      // Lejos, la bola crece un poco para no perderla de vista
      bola.scale.setScalar(THREE.MathUtils.clamp(Math.hypot(pos.x, pos.z) / 7, 1, 8));
      puntosEstela.push(pos.clone());
      if (puntosEstela.length > MAX_ESTELA) puntosEstela.shift();
      const atributo = geoEstela.attributes.position;
      puntosEstela.forEach((p, i) => atributo.setXYZ(i, p.x, p.y, p.z));
      atributo.needsUpdate = true;
      geoEstela.setDrawRange(0, puntosEstela.length);
    }
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function empezarRonda() {
    turno = 0;
    resultados = [];
    prepararLanzamiento();
  }

  function actualizar(dt) {
    reloj -= dt;
    actualizarBate(dt);
    zona.position.x = lado * DESVIO;
    casa.position.x = lado * DESVIO;

    if (tBrazo >= 0) {
      tBrazo += dt;
      if (tBrazo > 1.4) tBrazo = -1;
    }
    brazo.rotation.x = tBrazo >= 0 ? anguloBrazo(tBrazo) : 0;

    switch (estado) {
      case 'intro':
        if (reloj <= 0) empezarRonda();
        break;
      case 'espera':
        if (reloj <= 0) {
          estado = 'lanzamiento';
          tBrazo = 0;
        }
        break;
      case 'lanzamiento':
        bolaEnLaMano();
        if (tBrazo >= SUELTA) lanzar();
        break;
      case 'vuelo':
        vidaBola -= dt;
        if (vidaBola <= 0 && !resuelto) {
          if (bateada) terminar(0, '✘', 'Eliminado', '#ffcc80');
          else terminar(0, '✘', '¡Strike!', '#ff8a80');
        }
        break;
      case 'resultado':
        if (reloj <= 0) {
          turno += 1;
          if (turno >= LANZAMIENTOS) {
            estado = 'fin';
            reloj = 7;
            if (puntos() > record) {
              record = puntos();
              ctx.guardar('record', record);
            }
            ctx.sonido('fin');
          } else {
            prepararLanzamiento();
          }
        }
        break;
      case 'fin':
        if (reloj <= 0) empezarRonda();
        break;
    }

    if (estado === 'vuelo' || estado === 'resultado') moverBola(dt);

    bate.inicioAnterior.copy(bate.inicio);
    bate.puntaAnterior.copy(bate.punta);
    actualizarMarcador();
  }

  prepararLanzamiento();
  estado = 'intro';
  reloj = 3.5;
  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      niebla.near = nieblaOriginal.near;
      niebla.far = nieblaOriginal.far;
      puntosEstela.length = 0;
    },
  };
}
