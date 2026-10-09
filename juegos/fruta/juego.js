// CORTA FRUTA
// La fruta salta delante del jugador; se corta con un movimiento rápido de espada
// (VR) o deslizando el ratón por encima (escritorio). Las bombas quitan una vida.
import * as THREE from 'three';

// Este juego no descarga archivos: todo se genera con código. Si usara texturas,
// modelos o sonidos, aquí se descargarían SIN añadir nada a la escena, para que la
// shell pueda precargarlo mientras juegas a otro juego.
export async function precargar() {}

const GRAVEDAD = 4.5;          // más suave que la real, para que dé tiempo a cortar
const VIDAS = 3;
const VELOCIDAD_CORTE_VR = 1.2;  // m/s mínimos en la punta de la espada
const VELOCIDAD_CORTE_RATON = 450; // píxeles/s mínimos con el ratón
const INICIO_HOJA = -0.08;     // la hoja va de -0,08 a -0,8 m por delante del puño
const PUNTA_HOJA = -0.8;

const TIPOS = [
  { color: 0x2e7d32, interior: 0xff4060, radio: 0.13 },  // sandía
  { color: 0xff9100, interior: 0xffcc80, radio: 0.095 }, // naranja
  { color: 0xd50000, interior: 0xfff1c1, radio: 0.09 },  // manzana
  { color: 0xffea00, interior: 0xfffde7, radio: 0.085 }, // limón
  { color: 0x6d4c41, interior: 0x9ccc65, radio: 0.08 },  // kiwi
];

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);
  const EJE_Y = new THREE.Vector3(0, 1, 0);

  ctx.fondo(0x1b1530);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.6, 0.4), new THREE.Vector3(0, 1.4, -1.8));

  // ─── Decorado: dojo de noche ───────────────────────────────────────────
  ctx.sueloBase(false);
  // Tarima de madera oscura (tablas de ~15 cm)
  const suelo = new THREE.Mesh(
    R(new THREE.PlaneGeometry(14, 14).rotateX(-Math.PI / 2)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tablas(0x6b4a33, { tablas: 8, tam: 512, repetir: [12, 12], semilla: 31 })) })),
  );
  suelo.position.z = -1;
  raiz.add(suelo);

  // Tatami: paja trenzada con ribete oscuro
  const texTatami = R(ctx.texturaCanvas((g, tam, azar) => {
    g.fillStyle = '#b5a46a';
    g.fillRect(0, 0, tam, tam);
    for (let y = 0; y < tam; y += 2) {
      g.fillStyle = `rgba(${azar() < 0.5 ? '255,250,210' : '60,50,10'},${0.05 + azar() * 0.1})`;
      g.fillRect(0, y, tam, 1);
    }
    for (let i = 0; i < 600; i++) {
      g.fillStyle = 'rgba(80,70,20,0.12)';
      g.fillRect(azar() * tam, azar() * tam, 2 + azar() * 6, 1);
    }
    const borde = tam * 0.045;
    g.fillStyle = '#26301f';
    g.fillRect(0, 0, tam, borde);
    g.fillRect(0, tam - borde, tam, borde);
    g.fillStyle = 'rgba(200,180,120,0.35)';
    g.fillRect(0, borde * 0.45, tam, 1);
    g.fillRect(0, tam - borde * 0.55, tam, 1);
  }, { semilla: 32 }));
  const alfombra = new THREE.Mesh(R(new THREE.PlaneGeometry(2.4, 1.8)), R(new THREE.MeshLambertMaterial({ map: texTatami })));
  alfombra.rotation.x = -Math.PI / 2;
  alfombra.position.set(0, 0.004, -0.4);
  raiz.add(alfombra);

  // Pared de papel de arroz (shoji) iluminada desde detrás, con su celosía
  const texShoji = R(ctx.texturaCanvas((g, tam, azar) => {
    g.fillStyle = '#d9c296';
    g.fillRect(0, 0, tam, tam);
    // Fibras del papel
    for (let i = 0; i < 700; i++) {
      g.fillStyle = azar() < 0.5 ? `rgba(255,245,215,${azar() * 0.12})` : `rgba(120,90,40,${azar() * 0.08})`;
      g.fillRect(azar() * tam, azar() * tam, 1 + azar() * 10, 1);
    }
    // Listones: 3 columnas x 4 filas por baldosa
    g.fillStyle = '#3b2616';
    const liston = tam * 0.025;
    for (let i = 0; i < 3; i++) g.fillRect((i * tam) / 3 - liston / 2, 0, liston, tam);
    for (let i = 0; i < 4; i++) g.fillRect(0, (i * tam) / 4 - liston / 2, tam, liston);
  }, { repetir: [6, 2.5], semilla: 33 }));
  const pared = new THREE.Mesh(
    R(new THREE.PlaneGeometry(7, 3.5)),
    R(new THREE.MeshLambertMaterial({ map: texShoji, emissive: 0xffffff, emissiveMap: texShoji, emissiveIntensity: 0.2 })),
  );
  pared.position.set(0, 1.75, -3.4);
  raiz.add(pared);

  // Pilares y vigas de madera delante del papel (una sola malla)
  const piezasMarco = [
    new THREE.BoxGeometry(7, 0.22, 0.16).translate(0, 3.3, -3.32),
    new THREE.BoxGeometry(7, 0.3, 0.1).translate(0, 0.15, -3.34),
  ];
  for (const x of [-3.3, -1.15, 1.15, 3.3]) piezasMarco.push(new THREE.BoxGeometry(0.18, 3.5, 0.18).translate(x, 1.75, -3.3));
  const partes = piezasMarco.map((g) => g.toNonIndexed());
  const total = partes.reduce((n, g) => n + g.attributes.position.count, 0);
  const geoMarco = R(new THREE.BufferGeometry());
  for (const nombre of ['position', 'normal', 'uv']) {
    const tam = partes[0].attributes[nombre].itemSize;
    const datos = new Float32Array(total * tam);
    let o = 0;
    for (const g of partes) {
      datos.set(g.attributes[nombre].array, o);
      o += g.attributes[nombre].array.length;
    }
    geoMarco.setAttribute(nombre, new THREE.BufferAttribute(datos, tam));
  }
  for (const g of [...piezasMarco, ...partes]) g.dispose();
  const marco = new THREE.Mesh(geoMarco, R(new THREE.MeshLambertMaterial({ color: 0x3a2417 })));
  raiz.add(marco);

  // Farolillos de papel rojo con varillas y tapas negras (pintadas en la textura)
  const geoFarol = R(new THREE.SphereGeometry(0.16, 16, 12));
  geoFarol.scale(1, 1.3, 1);
  const texFarol = R(ctx.texturaCanvas((g, tam) => {
    const grad = g.createLinearGradient(0, 0, 0, tam);
    grad.addColorStop(0, '#ff8a50');
    grad.addColorStop(0.5, '#ffb070');
    grad.addColorStop(1, '#ff8a50');
    g.fillStyle = grad;
    g.fillRect(0, 0, tam, tam);
    g.fillStyle = 'rgba(90,20,0,0.35)';
    for (let i = 1; i < 9; i++) g.fillRect(0, (i * tam) / 9 - 1, tam, 2);
    g.fillStyle = '#1a1210';
    g.fillRect(0, 0, tam, tam * 0.12);
    g.fillRect(0, tam * 0.88, tam, tam * 0.12);
  }, { tam: 128, semilla: 35 }));
  const matFarol = R(new THREE.MeshLambertMaterial({ color: 0xff5a3a, map: texFarol, emissive: 0xff3a10, emissiveMap: texFarol, emissiveIntensity: 1 }));
  for (const x of [-2.2, 2.2]) {
    const farol = new THREE.Mesh(geoFarol, matFarol);
    farol.position.set(x, 2.55, -3.0);
    raiz.add(farol);
  }

  // ─── Recursos compartidos ──────────────────────────────────────────────
  const geoFruta = TIPOS.map((t) => R(new THREE.SphereGeometry(t.radio, 24, 16)));
  const geoMitad = TIPOS.map((t) => R(new THREE.SphereGeometry(t.radio, 20, 8, 0, Math.PI * 2, 0, Math.PI / 2)));
  const geoCara = TIPOS.map((t) => R(new THREE.CircleGeometry(t.radio * 0.97, 20)));
  // Piel con un poco de brillo (la fruta es la protagonista)
  const RUGOSIDAD = [0.4, 0.55, 0.3, 0.45, 0.85];
  const matPiel = TIPOS.map((t, i) => R(new THREE.MeshStandardMaterial({ color: t.color, roughness: RUGOSIDAD[i], metalness: 0 })));
  const matInterior = TIPOS.map((t) => R(new THREE.MeshLambertMaterial({ color: t.interior, side: THREE.DoubleSide })));
  const matGota = TIPOS.map((t) => R(new THREE.MeshBasicMaterial({ color: t.interior })));
  const geoGota = R(new THREE.SphereGeometry(0.015, 6, 4));

  const geoBomba = R(new THREE.SphereGeometry(0.1, 18, 12));
  const matBomba = R(new THREE.MeshStandardMaterial({ color: 0x26262b, roughness: 0.35, metalness: 0.6, emissive: 0x000000 }));
  const geoMecha = R(new THREE.CylinderGeometry(0.012, 0.012, 0.07, 6));
  const matMecha = R(new THREE.MeshLambertMaterial({ color: 0xa1887f }));
  const geoChispa = R(new THREE.SphereGeometry(0.022, 6, 4));
  const matChispa = R(new THREE.MeshBasicMaterial({ color: 0xffab00 }));
  const matHumo = R(new THREE.MeshBasicMaterial({ color: 0x424242 }));

  // Sombras de mancha para la fruta en el aire (se reutilizan)
  const Y_TATAMI = 0.005;
  const sombrasLibres = [];
  for (let i = 0; i < 8; i++) {
    const s = ctx.crearSombra({ radio: 0.12, opacidad: 0.5 });
    s.visible = false;
    raiz.add(s);
    sombrasLibres.push(s);
  }

  // ─── Espadas (una en cada mano) ────────────────────────────────────────
  // Katana: mango forrado, guarda dorada y hoja de acero con un reflejo del color de la mano
  function crearEspada(colorHoja) {
    const espada = new THREE.Group();
    const mango = new THREE.Mesh(new THREE.CylinderGeometry(0.017, 0.02, 0.15, 10), new THREE.MeshStandardMaterial({ color: 0x2b1d1a, roughness: 0.8 }));
    mango.rotation.x = Math.PI / 2;
    mango.position.z = 0.03;
    const guarda = new THREE.Mesh(new THREE.CylinderGeometry(0.045, 0.045, 0.012, 16).rotateX(Math.PI / 2), new THREE.MeshStandardMaterial({ color: 0xc9a227, metalness: 1, roughness: 0.35 }));
    guarda.position.z = -0.05;
    const largo = PUNTA_HOJA - INICIO_HOJA;
    const hoja = new THREE.Mesh(new THREE.BoxGeometry(0.012, 0.045, Math.abs(largo)), new THREE.MeshStandardMaterial({
      color: 0xe3e9ef, metalness: 0.9, roughness: 0.22, emissive: colorHoja, emissiveIntensity: 0.35,
    }));
    hoja.position.z = INICIO_HOJA + largo / 2;
    espada.add(mango, guarda, hoja);
    return espada;
  }

  const espadas = ctx.manos.map((mano, i) => ({
    mano,
    objeto: ctx.adjuntarAMano(mano, crearEspada(i === 0 ? 0x80d8ff : 0xff80ab)),
    inicio: new THREE.Vector3(),
    punta: new THREE.Vector3(),
    inicioAnterior: new THREE.Vector3(),
    puntaAnterior: new THREE.Vector3(),
    lista: false,
  }));

  // ─── Cursor y estela para el ratón ─────────────────────────────────────
  const cursor = new THREE.Mesh(R(new THREE.SphereGeometry(0.018, 10, 8)), R(new THREE.MeshBasicMaterial({ color: 0xffffff })));
  raiz.add(cursor);
  const MAX_ESTELA = 10;
  const geoEstela = R(new THREE.BufferGeometry());
  geoEstela.setAttribute('position', new THREE.BufferAttribute(new Float32Array(MAX_ESTELA * 3), 3));
  const estela = new THREE.Line(geoEstela, R(new THREE.LineBasicMaterial({ color: 0xffffff })));
  estela.frustumCulled = false;
  raiz.add(estela);
  const puntosEstela = [];
  let vidaEstela = 0;

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.3, alto: 0.32 });
  marcador.mesh.position.set(0, 2.35, -2.2);
  marcador.mesh.rotation.x = 0.2;
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  const objetos = []; // fruta y bombas en el aire
  const piezas = [];  // mitades, gotas y humo
  let puntos = 0;
  let vidas = VIDAS;
  let record = ctx.leer('record', 0);
  let estado = 'intro'; // 'intro' | 'jugando' | 'fin'
  let reloj = 2.5;      // cuenta atrás del estado actual
  let tiempoJugado = 0;
  let proximoLanzamiento = 0;

  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const tmp3 = new THREE.Vector3();
  const segmento = new THREE.Line3();

  function actualizarMarcador() {
    if (estado === 'intro') {
      marcador.escribir([
        { texto: 'CORTA FRUTA', tam: 1.3, color: '#ffd180' },
        { texto: 'Corta la fruta · evita las bombas', tam: 0.8 },
      ]);
    } else if (estado === 'fin') {
      marcador.escribir([
        { texto: `¡Fin! ${puntos} puntos`, tam: 1.3, color: '#ffd180' },
        { texto: `Récord: ${record} · nueva partida en ${Math.ceil(reloj)}`, tam: 0.8 },
      ]);
    } else {
      marcador.escribir([
        { texto: `Puntos: ${puntos}`, tam: 1.3 },
        { texto: `Vidas: ${'●'.repeat(vidas)}${'○'.repeat(VIDAS - vidas)}   Récord: ${record}`, tam: 0.8, color: '#ffd6e0' },
      ]);
    }
  }

  function crearObjeto(esBomba) {
    const x = (Math.random() * 2 - 1) * 0.6;
    let malla;
    let radio;
    let tipo = -1;
    let colision;
    if (esBomba) {
      malla = new THREE.Group();
      colision = new THREE.Mesh(geoBomba, matBomba);
      const mecha = new THREE.Mesh(geoMecha, matMecha);
      mecha.position.y = 0.11;
      const chispa = new THREE.Mesh(geoChispa, matChispa);
      chispa.position.y = 0.15;
      malla.add(colision, mecha, chispa);
      radio = 0.1;
    } else {
      tipo = Math.floor(Math.random() * TIPOS.length);
      malla = new THREE.Mesh(geoFruta[tipo], matPiel[tipo]);
      colision = malla;
      radio = TIPOS[tipo].radio;
    }
    malla.position.set(x, 0.15, -1.1 - Math.random() * 0.3);
    malla.rotation.set(Math.random() * 3, Math.random() * 3, 0);
    raiz.add(malla);
    const objeto = {
      malla, colision, radio, tipo,
      sombra: sombrasLibres.pop() || null,
      bomba: esBomba,
      cortado: false,
      vel: new THREE.Vector3(-x * 0.35 + (Math.random() * 2 - 1) * 0.25, 3.4 + Math.random() * 0.7, 0.1),
      giro: new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(4),
    };
    colision.userData.objeto = objeto;
    objetos.push(objeto);
  }

  function lanzar() {
    const progreso = Math.min(1, tiempoJugado / 90);
    let cantidad = 1;
    if (Math.random() < 0.25 + progreso * 0.4) cantidad++;
    if (Math.random() < progreso * 0.35) cantidad++;
    for (let i = 0; i < cantidad; i++) {
      crearObjeto(tiempoJugado > 8 && Math.random() < 0.15);
    }
    proximoLanzamiento = 1.5 - progreso * 0.6 + Math.random() * 0.4;
  }

  function quitar(objeto) {
    const i = objetos.indexOf(objeto);
    if (i >= 0) objetos.splice(i, 1);
    raiz.remove(objeto.malla);
    if (objeto.sombra) {
      objeto.sombra.visible = false;
      sombrasLibres.push(objeto.sombra);
      objeto.sombra = null;
    }
  }

  function agregarPieza(malla, vel, vida, giro = null, encoger = false) {
    raiz.add(malla);
    piezas.push({ malla, vel, vida, vidaInicial: vida, giro, encoger });
  }

  function perderVida() {
    if (estado !== 'jugando') return;
    vidas--;
    if (vidas <= 0) {
      estado = 'fin';
      reloj = 4;
      if (puntos > record) {
        record = puntos;
        ctx.guardar('record', record);
      }
      ctx.sonido('fin');
    }
  }

  // normal: dirección perpendicular al plano de corte
  function cortar(objeto, normal, mano) {
    if (objeto.cortado) return;
    objeto.cortado = true;
    quitar(objeto);
    const centro = objeto.malla.position;

    if (objeto.bomba) {
      ctx.sonido('bomba');
      ctx.destello(0xff3d00, 0.55);
      if (mano) ctx.vibrar(mano, 1, 250);
      for (let i = 0; i < 14; i++) {
        const humo = new THREE.Mesh(geoGota, i % 2 ? matHumo : matChispa);
        humo.scale.setScalar(2 + Math.random() * 2);
        humo.position.copy(centro);
        const vel = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.2, Math.random() - 0.5).normalize().multiplyScalar(1.5 + Math.random());
        agregarPieza(humo, vel, 0.6, null, true);
      }
      perderVida();
      return;
    }

    if (estado === 'jugando') puntos++;
    ctx.sonido('corte');
    if (mano) ctx.vibrar(mano, 0.6, 40);

    // Dos mitades que se separan a lo largo de la normal del corte
    for (const signo of [1, -1]) {
      const mitad = new THREE.Group();
      const piel = new THREE.Mesh(geoMitad[objeto.tipo], matPiel[objeto.tipo]);
      const cara = new THREE.Mesh(geoCara[objeto.tipo], matInterior[objeto.tipo]);
      cara.rotation.x = Math.PI / 2;
      mitad.add(piel, cara);
      const dir = normal.clone().multiplyScalar(signo);
      mitad.position.copy(centro).addScaledVector(dir, 0.01);
      mitad.quaternion.setFromUnitVectors(EJE_Y, dir);
      const vel = objeto.vel.clone().multiplyScalar(0.5).addScaledVector(dir, 1.2);
      const giro = new THREE.Vector3(Math.random() - 0.5, Math.random() - 0.5, Math.random() - 0.5).multiplyScalar(6);
      agregarPieza(mitad, vel, 3, giro);
    }
    // Zumo
    for (let i = 0; i < 8; i++) {
      const gota = new THREE.Mesh(geoGota, matGota[objeto.tipo]);
      gota.position.copy(centro);
      const vel = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.6, Math.random() - 0.5).normalize().multiplyScalar(1 + Math.random() * 1.5);
      agregarPieza(gota, vel, 0.7, null, true);
    }
  }

  function normalDeCorte(direccionHoja, movimiento) {
    const n = tmp3.crossVectors(direccionHoja, movimiento);
    if (n.lengthSq() < 1e-8) return new THREE.Vector3(1, 0, 0);
    return n.normalize().clone();
  }

  // ─── Cortes con los mandos VR ──────────────────────────────────────────
  function comprobarSegmento(a, b, espada) {
    segmento.set(a, b);
    for (const objeto of objetos.slice()) {
      if (objeto.cortado) continue;
      segmento.closestPointToPoint(objeto.malla.position, true, tmp);
      if (tmp.distanceTo(objeto.malla.position) < objeto.radio + 0.03) {
        const movimiento = tmp2.subVectors(espada.punta, espada.puntaAnterior);
        const direccion = new THREE.Vector3().subVectors(espada.punta, espada.inicio);
        cortar(objeto, normalDeCorte(direccion, movimiento), espada.mano);
      }
    }
  }

  function cortesVR(dt) {
    for (const espada of espadas) {
      if (!espada.mano.activa) {
        espada.lista = false;
        continue;
      }
      espada.mano.grip.localToWorld(espada.inicio.set(0, 0, INICIO_HOJA));
      espada.mano.grip.localToWorld(espada.punta.set(0, 0, PUNTA_HOJA));
      if (espada.lista) {
        const velocidad = espada.punta.distanceTo(espada.puntaAnterior) / dt;
        if (velocidad > VELOCIDAD_CORTE_VR) {
          comprobarSegmento(espada.inicio, espada.punta, espada);
          // Posición intermedia, para no "atravesar" fruta en golpes muy rápidos
          const a = espada.inicio.clone().lerp(espada.inicioAnterior, 0.5);
          const b = espada.punta.clone().lerp(espada.puntaAnterior, 0.5);
          comprobarSegmento(a, b, espada);
        }
      }
      espada.inicioAnterior.copy(espada.inicio);
      espada.puntaAnterior.copy(espada.punta);
      espada.lista = true;
    }
  }

  // ─── Cortes con el ratón ───────────────────────────────────────────────
  const rayoAux = new THREE.Raycaster();
  const ndcAux = new THREE.Vector2();

  function cortesRaton(dt) {
    const raton = ctx.raton;
    const visible = raton.dentro;
    cursor.visible = visible;
    raton.rayo.ray.at(1.55, cursor.position);

    puntosEstela.push(cursor.position.clone());
    if (puntosEstela.length > MAX_ESTELA) puntosEstela.shift();
    vidaEstela = raton.velocidadPx > 300 ? 0.12 : Math.max(0, vidaEstela - dt);
    estela.visible = visible && vidaEstela > 0;
    const pos = geoEstela.attributes.position;
    puntosEstela.forEach((p, i) => pos.setXYZ(i, p.x, p.y, p.z));
    pos.needsUpdate = true;
    geoEstela.setDrawRange(0, puntosEstela.length);

    if (!visible || raton.velocidadPx < VELOCIDAD_CORTE_RATON || objetos.length === 0) return;

    // Dirección del movimiento en el mundo, para orientar el corte
    const derecha = tmp.setFromMatrixColumn(ctx.camara.matrixWorld, 0);
    const arriba = tmp2.setFromMatrixColumn(ctx.camara.matrixWorld, 1);
    const movimiento = new THREE.Vector3().addScaledVector(derecha, raton.mov.x).addScaledVector(arriba, -raton.mov.y);
    const normal = normalDeCorte(raton.rayo.ray.direction, movimiento);

    // Muestreamos varios rayos entre la posición anterior y la actual del ratón
    const colisiones = objetos.filter((o) => !o.cortado).map((o) => o.colision);
    for (let paso = 0; paso <= 3; paso++) {
      ndcAux.lerpVectors(raton.ndcAnterior, raton.ndc, paso / 3);
      rayoAux.setFromCamera(ndcAux, ctx.camara);
      for (const choque of rayoAux.intersectObjects(colisiones, false)) {
        const objeto = choque.object.userData.objeto;
        if (objeto && !objeto.cortado) cortar(objeto, normal, null);
      }
    }
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function actualizar(dt) {
    reloj -= dt;
    if (estado === 'intro' && reloj <= 0) {
      estado = 'jugando';
      proximoLanzamiento = 0.3;
    } else if (estado === 'fin' && reloj <= 0) {
      estado = 'jugando';
      puntos = 0;
      vidas = VIDAS;
      tiempoJugado = 0;
      proximoLanzamiento = 1;
    }

    if (estado === 'jugando') {
      tiempoJugado += dt;
      proximoLanzamiento -= dt;
      if (proximoLanzamiento <= 0) lanzar();
    }

    // Fruta y bombas en el aire
    const parpadeo = Math.sin(performance.now() / 90) > 0;
    matBomba.emissive.setHex(parpadeo ? 0x5a0000 : 0x000000);
    for (const objeto of objetos.slice()) {
      objeto.vel.y -= GRAVEDAD * dt;
      objeto.malla.position.addScaledVector(objeto.vel, dt);
      objeto.malla.rotation.x += objeto.giro.x * dt;
      objeto.malla.rotation.y += objeto.giro.y * dt;
      if (objeto.sombra) ctx.colocarSombra(objeto.sombra, objeto.malla.position, Y_TATAMI);
      if (objeto.malla.position.y < -0.2 && objeto.vel.y < 0) {
        quitar(objeto);
        if (!objeto.bomba && estado === 'jugando') {
          ctx.sonido('fallo');
          perderVida();
        }
      }
    }

    // Trozos y partículas
    for (let i = piezas.length - 1; i >= 0; i--) {
      const p = piezas[i];
      p.vida -= dt;
      p.vel.y -= GRAVEDAD * 1.6 * dt;
      p.malla.position.addScaledVector(p.vel, dt);
      if (p.giro) {
        p.malla.rotation.x += p.giro.x * dt;
        p.malla.rotation.z += p.giro.z * dt;
      }
      if (p.encoger) p.malla.scale.multiplyScalar(Math.pow(0.02, dt / p.vidaInicial));
      if (p.vida <= 0 || p.malla.position.y < -0.3) {
        raiz.remove(p.malla);
        piezas.splice(i, 1);
      }
    }

    if (ctx.enVR()) {
      cursor.visible = false;
      estela.visible = false;
      cortesVR(dt);
    } else {
      cortesRaton(dt);
    }

    actualizarMarcador();
  }

  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      // La shell retira y libera todo lo que hay en la escena y en las manos,
      // además de los recursos registrados con ctx.recurso(). Aquí no queda nada más.
      objetos.length = 0;
      piezas.length = 0;
    },
  };
}
