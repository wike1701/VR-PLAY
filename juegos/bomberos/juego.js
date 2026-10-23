// BOMBEROS
// Una calle de noche, junto al camión de bomberos. En las ventanas del edificio de
// enfrente salen fuegos: apágalos con la manguera antes de que el edificio se queme.
// Un fuego que dura mucho crece y salta a la ventana de al lado. Cada ventana encendida
// va quemando el edificio; si llega al 100 %, se acaba. 10 puntos por fuego apagado y 5
// más si estaba pequeño. Cada vez hay más fuegos.
// Para que no sea tan fácil: a veces se asoma un vecino a una ventana (¡no lo mojes, restas
// puntos!) y hay bombonas de gas en llamas que explotan si tardas en apagarlas.
// En VR llevas la boquilla en la mano: apunta y mantén el gatillo. Sin gafas, mantén
// pulsado el ratón (o el dedo) donde quieras echar el agua.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código.
export async function precargar() {}

const FACHADA_Z = -6;
const COLUMNAS = [-2.4, -0.8, 0.8, 2.4];
const FILAS = [1.6, 3.3, 5.0];
const ANCHO_VENTANA = 1.0;
const ALTO_VENTANA = 1.2;
const N_GOTAS = 90;
const VEL_AGUA = 13;
const CHORRO = 45;               // gotas por segundo
const G = 9.8;
const TIEMPO_BOMBONA = 6;        // segundos hasta que explota una bombona
const BOQUILLA_RATON = new THREE.Vector3(0.25, 1.2, -0.2);

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (r) => ctx.recurso(r);

  ctx.fondo(0x1c2442, {
    cenit: 0x0a0f22, horizonte: 0x3a2a3a, estrellas: 0.7, luna: true, sol: [-0.5, 0.45, -0.75], niebla: [18, 60],
    paisaje: { tipo: 'ciudad', color: 0x1e2436, radio: 60 },
  });
  ctx.sueloBase(false);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.6, 1.2), new THREE.Vector3(0, 3.0, -6));

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

  // ─── La calle ──────────────────────────────────────────────────────────
  const asfalto = new THREE.Mesh(
    R(new THREE.PlaneGeometry(40, 40)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.grano(0x3a3a40, { repetir: [20, 20], semilla: 111 })) })),
  );
  asfalto.rotation.x = -Math.PI / 2;
  raiz.add(asfalto);
  const acera = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(14, 0.15, 1.8), 0, 0.075, FACHADA_Z + 0.9),
  ]), R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.ladrillos(0x9a948a, 0x6a645c, { filas: 4, columnas: 16, repetir: [4, 1], semilla: 112 })) })));
  raiz.add(acera);
  // Líneas de la calzada
  const lineas = new THREE.Mesh(fusionar(Array.from({ length: 6 }, (_, i) => colocar(new THREE.PlaneGeometry(1.4, 0.12), -7 + i * 2.8, 0.005, -2.6, -Math.PI / 2))),
    R(new THREE.MeshLambertMaterial({ color: 0xe6e2d6 })));
  raiz.add(lineas);
  // El edificio: fachada de ladrillo con ventanas
  const texFachada = R(ctx.texturas.ladrillos(0x8d4b3a, 0x5a3a30, { filas: 24, columnas: 10, repetir: [3, 3], semilla: 113 }));
  const edificio = new THREE.Mesh(R(new THREE.BoxGeometry(7.4, 6.6, 3)), R(new THREE.MeshLambertMaterial({ map: texFachada })));
  edificio.position.set(0, 3.3, FACHADA_Z - 1.5);
  raiz.add(edificio);
  const cornisa = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(7.8, 0.3, 0.4), 0, 6.6, FACHADA_Z),
    ...FILAS.map((y) => colocar(new THREE.BoxGeometry(7.4, 0.08, 0.25), 0, y - ALTO_VENTANA / 2 - 0.08, FACHADA_Z + 0.08)),
    ...FILAS.flatMap((y) => COLUMNAS.flatMap((x) => [
      colocar(new THREE.BoxGeometry(ANCHO_VENTANA + 0.16, 0.08, 0.12), x, y + ALTO_VENTANA / 2 + 0.04, FACHADA_Z + 0.04),
      colocar(new THREE.BoxGeometry(0.08, ALTO_VENTANA, 0.12), x - ANCHO_VENTANA / 2 - 0.04, y, FACHADA_Z + 0.04),
      colocar(new THREE.BoxGeometry(0.08, ALTO_VENTANA, 0.12), x + ANCHO_VENTANA / 2 + 0.04, y, FACHADA_Z + 0.04),
      colocar(new THREE.BoxGeometry(0.05, ALTO_VENTANA, 0.06), x, y, FACHADA_Z + 0.02),
    ])),
  ]), R(new THREE.MeshLambertMaterial({ color: 0xd8cfc0 })));
  raiz.add(cornisa);
  // Edificios vecinos
  const vecinos = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(5, 8.5, 4), -6.4, 4.25, FACHADA_Z - 2),
    colocar(new THREE.BoxGeometry(5, 5.2, 4), 6.4, 2.6, FACHADA_Z - 2),
  ]), R(new THREE.MeshLambertMaterial({ map: R(ctx.texturaCanvas((g, tam, azar) => {
    g.fillStyle = '#3e4658';
    g.fillRect(0, 0, tam, tam);
    for (let y = 0; y < 6; y++) {
      for (let x = 0; x < 4; x++) {
        g.fillStyle = azar() < 0.35 ? '#f2d38a' : '#1c2232';
        g.fillRect(x * tam / 4 + 10, y * tam / 6 + 8, tam / 4 - 20, tam / 6 - 16);
      }
    }
  }, { tam: 256, repetir: [1, 1], semilla: 114 })) })));
  raiz.add(vecinos);
  // Camión de bomberos a la izquierda del jugador
  const matRojo = R(new THREE.MeshLambertMaterial({ color: 0xc8202a }));
  const camion = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(2.2, 1.6, 6.5), -3.4, 1.1, 1.0),
    colocar(new THREE.BoxGeometry(2.2, 0.5, 6.5), -3.4, 0.35, 1.0),
    colocar(new THREE.BoxGeometry(0.3, 0.3, 5.5), -3.4, 2.05, 1.2),
  ]), matRojo);
  raiz.add(camion);
  const detalles = new THREE.Mesh(fusionar([
    ...[[-2.8, -1.0], [-2.8, 3.0], [-4.0, -1.0], [-4.0, 3.0]].map(([x, z]) => colocar(new THREE.CylinderGeometry(0.42, 0.42, 0.3, 16), x - (x > -3.4 ? -0.5 : 0.5) * 0, 0.42, z, 0, 0, Math.PI / 2)),
    colocar(new THREE.BoxGeometry(0.05, 0.08, 6.0), -2.28, 1.4, 1.0),
    colocar(new THREE.BoxGeometry(0.05, 0.08, 6.0), -2.28, 0.9, 1.0),
  ]), R(new THREE.MeshLambertMaterial({ color: 0x1c1c22 })));
  raiz.add(detalles);
  const rotativos = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(0.25, 0.14, 0.25), -2.8, 1.98, -2.0),
    colocar(new THREE.BoxGeometry(0.25, 0.14, 0.25), -4.0, 1.98, -2.0),
  ]), R(new THREE.MeshBasicMaterial({ color: 0x3a8cff, toneMapped: false })));
  raiz.add(rotativos);
  const sombraCamion = ctx.crearSombra({ radio: 3.6, opacidad: 0.5 });
  sombraCamion.scale.set(0.45, 1, 1);
  sombraCamion.position.set(-3.4, 0.006, 1.0);
  raiz.add(sombraCamion);
  // Farolas
  const farolas = new THREE.Mesh(fusionar([
    colocar(new THREE.CylinderGeometry(0.06, 0.08, 4, 8), 4.2, 2, -3.5),
    colocar(new THREE.BoxGeometry(0.8, 0.08, 0.08), 3.85, 4, -3.5),
  ]), R(new THREE.MeshLambertMaterial({ color: 0x2a2e36 })));
  raiz.add(farolas);
  const bombilla = new THREE.Mesh(R(new THREE.SphereGeometry(0.12, 12, 8)), R(new THREE.MeshBasicMaterial({ color: 0xffe2a8, toneMapped: false })));
  bombilla.position.set(3.5, 3.9, -3.5);
  raiz.add(bombilla);

  // ─── Ventanas y fuegos ─────────────────────────────────────────────────
  const texVidrio = R(ctx.texturaCanvas((g, tam) => {
    const deg = g.createLinearGradient(0, 0, 0, tam);
    deg.addColorStop(0, '#2a3450');
    deg.addColorStop(1, '#0e1220');
    g.fillStyle = deg;
    g.fillRect(0, 0, tam, tam);
    g.fillStyle = 'rgba(255,255,255,0.08)';
    g.beginPath();
    g.moveTo(0, tam * 0.7);
    g.lineTo(tam * 0.6, 0);
    g.lineTo(tam, 0);
    g.lineTo(0, tam);
    g.fill();
  }, { tam: 64 }));
  const geoVidrio = R(new THREE.PlaneGeometry(ANCHO_VENTANA, ALTO_VENTANA));
  // Llama: tres conos que se retuercen (opacos y sin luz)
  const geoLlama = R(new THREE.ConeGeometry(0.22, 0.8, 8, 3, true));
  geoLlama.translate(0, 0.4, 0);
  const matLlamaFuera = R(new THREE.MeshBasicMaterial({ color: 0xff5a1f, toneMapped: false, side: THREE.DoubleSide }));
  const matLlamaDentro = R(new THREE.MeshBasicMaterial({ color: 0xffd23f, toneMapped: false, side: THREE.DoubleSide }));
  // Vecino asomado: cabeza, cuerpo y brazos
  const matPiel = R(new THREE.MeshLambertMaterial({ color: 0xe0b48c }));
  const matRopa = R(new THREE.MeshLambertMaterial({ color: 0x4a7fc4 }));
  const geoCabeza = R(new THREE.SphereGeometry(0.11, 12, 10));
  const geoTorso = R(new THREE.BoxGeometry(0.34, 0.4, 0.16));
  const geoBrazo = R(new THREE.BoxGeometry(0.07, 0.34, 0.07));
  geoBrazo.translate(0, 0.17, 0);
  function crearVecino() {
    const g = new THREE.Group();
    const torso = new THREE.Mesh(geoTorso, matRopa);
    torso.position.y = 0.2;
    const cabeza = new THREE.Mesh(geoCabeza, matPiel);
    cabeza.position.y = 0.52;
    const brazoI = new THREE.Mesh(geoBrazo, matPiel);
    brazoI.position.set(-0.22, 0.3, 0);
    const brazoD = new THREE.Mesh(geoBrazo, matPiel);
    brazoD.position.set(0.22, 0.3, 0);
    g.add(torso, cabeza, brazoI, brazoD);
    g.visible = false;
    return { g, brazoI, brazoD };
  }
  // Bombona de gas en llamas
  const matBombona = R(new THREE.MeshLambertMaterial({ color: 0x3c8a4a }));
  const geoBombona = R(new THREE.CylinderGeometry(0.13, 0.13, 0.5, 12));
  const matLlamaGas = R(new THREE.MeshBasicMaterial({ color: 0x4ad8ff, toneMapped: false, side: THREE.DoubleSide }));
  const ventanas = [];
  for (const y of FILAS) {
    for (const x of COLUMNAS) {
      const vidrio = new THREE.Mesh(geoVidrio, R(new THREE.MeshBasicMaterial({ map: texVidrio, color: 0xffffff })));
      vidrio.position.set(x, y, FACHADA_Z + 0.01);
      raiz.add(vidrio);
      const fuego = new THREE.Group();
      fuego.position.set(x, y - ALTO_VENTANA / 2 + 0.05, FACHADA_Z + 0.15);
      const llamas = [];
      for (let k = 0; k < 3; k++) {
        const l = new THREE.Mesh(geoLlama, k === 1 ? matLlamaDentro : matLlamaFuera);
        l.position.x = (k - 1) * 0.22;
        l.scale.setScalar(k === 1 ? 0.8 : 1);
        if (k === 1) l.position.z = 0.06;
        fuego.add(l);
        llamas.push(l);
      }
      const bombona = new THREE.Mesh(geoBombona, matBombona);
      bombona.position.set(0.3, 0.25, -0.05);
      bombona.visible = false;
      fuego.add(bombona);
      fuego.visible = false;
      raiz.add(fuego);
      const vecino = crearVecino();
      vecino.g.position.set(x, y - ALTO_VENTANA / 2 + 0.1, FACHADA_Z + 0.1);
      raiz.add(vecino.g);
      ventanas.push({ x, y, vidrio, fuego, llamas, bombona, gas: false, mecha: 0, vecino, tVecino: 0, ardiendo: false, vida: 0, tam: 0, tiempo: 0, vecinas: [] });
    }
  }
  ventanas.forEach((v, i) => {
    const c = i % COLUMNAS.length;
    const f = Math.floor(i / COLUMNAS.length);
    if (c > 0) v.vecinas.push(i - 1);
    if (c < COLUMNAS.length - 1) v.vecinas.push(i + 1);
    if (f > 0) v.vecinas.push(i - COLUMNAS.length);
    if (f < FILAS.length - 1) v.vecinas.push(i + COLUMNAS.length);
  });
  // Humo: bolas grises que suben (instancias)
  const N_HUMO = 36;
  const humo = new THREE.InstancedMesh(R(new THREE.IcosahedronGeometry(0.3, 1)), R(new THREE.MeshLambertMaterial({ color: 0x3a3a40, flatShading: true })), N_HUMO);
  humo.frustumCulled = false;
  raiz.add(humo);
  const bolasHumo = Array.from({ length: N_HUMO }, () => ({ pos: new THREE.Vector3(0, -10, 0), vida: 0, tam: 0 }));
  let siguienteHumo = 0;

  // ─── Agua ──────────────────────────────────────────────────────────────
  const gotas = new THREE.InstancedMesh(R(new THREE.SphereGeometry(0.045, 6, 5)), R(new THREE.MeshBasicMaterial({ color: 0xbfe6ff, toneMapped: false })), N_GOTAS);
  gotas.frustumCulled = false;
  raiz.add(gotas);
  const listaGotas = Array.from({ length: N_GOTAS }, () => ({ activa: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), vida: 0 }));
  let siguienteGota = 0;
  let acumulado = 0;

  // ─── Boquilla de la manguera ───────────────────────────────────────────
  const perfilBoquilla = [
    [0.0001, 0.0], [0.024, 0.0], [0.026, 0.02], [0.022, 0.05], [0.03, 0.06], [0.03, 0.1], [0.02, 0.12],
    [0.014, 0.2], [0.011, 0.22], [0.0001, 0.22],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geoBoquilla = R(new THREE.LatheGeometry(perfilBoquilla, 18));
  geoBoquilla.rotateX(-Math.PI / 2); // a lo largo de -Z
  const matLaton = R(new THREE.MeshStandardMaterial({ color: 0xd9a441, roughness: 0.25, metalness: 0.9 }));
  const geoMango = R(new THREE.CylinderGeometry(0.018, 0.02, 0.11, 12));
  geoMango.translate(0, -0.06, 0.03);
  const matGoma = R(new THREE.MeshStandardMaterial({ color: 0x1c1c22, roughness: 0.9 }));
  const geoManguera = R(new THREE.TubeGeometry(new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, 0, 0.02), new THREE.Vector3(0, -0.02, 0.12), new THREE.Vector3(0, -0.15, 0.22), new THREE.Vector3(0.02, -0.45, 0.24),
  ]), 16, 0.026, 8));
  const matManguera = R(new THREE.MeshStandardMaterial({ color: 0xc8202a, roughness: 0.7 }));
  const geoPalanca = R(new THREE.BoxGeometry(0.012, 0.05, 0.06));
  function crearBoquilla() {
    const g = new THREE.Group();
    const cuerpo = new THREE.Mesh(geoBoquilla, matLaton);
    const mango = new THREE.Mesh(geoMango, matGoma);
    const manguera = new THREE.Mesh(geoManguera, matManguera);
    const palanca = new THREE.Mesh(geoPalanca, matLaton);
    palanca.position.set(0, 0.035, -0.06);
    g.add(cuerpo, mango, manguera, palanca);
    return { g, palanca };
  }
  const boquillas = ctx.manos.map((mano) => {
    const b = crearBoquilla();
    ctx.adjuntarAMano(mano, b.g);
    return { mano, ...b };
  });
  const boquillaRaton = crearBoquilla();
  boquillaRaton.g.position.copy(BOQUILLA_RATON);
  raiz.add(boquillaRaton.g);
  const SALIDA = new THREE.Vector3(0, 0, -0.23);

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.2, alto: 0.34 });
  marcador.mesh.position.set(1.6, 2.4, -3.2);
  marcador.mesh.rotation.y = -0.25;
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'juego' | 'fin'
  let reloj = 3;
  let puntos = 0;
  let apagados = 0;
  let danio = 0;
  let record = ctx.leer('record', 0);
  let tiempoJuego = 0;
  let proximo = 1;
  let proximoVecino = 6;
  let aviso = '';
  let tiempoAviso = 0;
  let salpicadura = 0;
  let sonidoAgua = 0;
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const escTmp = new THREE.Vector3();
  const qUno = new THREE.Quaternion();
  const ocultar = new THREE.Matrix4().makeScale(0, 0, 0);
  const planoFachada = new THREE.Plane(new THREE.Vector3(0, 0, 1), -FACHADA_Z);

  function encender(v, gas = false) {
    v.ardiendo = true;
    v.tam = 0.35;
    v.vida = gas ? 1.4 : 1;
    v.tiempo = 0;
    v.gas = gas;
    v.mecha = TIEMPO_BOMBONA;
    v.bombona.visible = gas;
    matBombona.color.setHex(0x3c8a4a);
    v.llamas.forEach((l, k) => { l.material = gas ? matLlamaGas : k === 1 ? matLlamaDentro : matLlamaFuera; });
    v.tVecino = 0;
    v.vecino.g.visible = false;
    v.fuego.visible = true;
    ctx.sonido('explosion');
  }

  function empezarPartida() {
    for (const v of ventanas) {
      v.ardiendo = false;
      v.fuego.visible = false;
      v.vidrio.material.color.setHex(0xffffff);
      v.gas = false;
      v.tVecino = 0;
      v.vecino.g.visible = false;
    }
    proximoVecino = 6;
    puntos = 0;
    apagados = 0;
    danio = 0;
    tiempoJuego = 0;
    proximo = 1;
    estado = 'juego';
  }

  function terminar() {
    estado = 'fin';
    reloj = 6;
    ctx.sonido('derrumbe');
    ctx.puntuacion(puntos); // a la clasificación (juegos/marcadores.js)
    if (puntos > record) {
      record = puntos;
      ctx.guardar('record', record);
    }
  }

  function apagar(v, mano) {
    v.ardiendo = false;
    v.fuego.visible = false;
    const rapido = v.tam < 0.6;
    const suma = (rapido ? 15 : 10) + (v.gas ? 15 : 0);
    v.gas = false;
    puntos += suma;
    apagados += 1;
    tmp.set(v.x, v.y + 0.3, FACHADA_Z + 0.4);
    ctx.efectos.impacto(rapido ? 'medio' : 'pequeño', { pos: tmp, mano, color: 0xbfe6ff, sonido: 'vapor' });
    ctx.efectos.texto(tmp, `+${suma}`, { color: rapido ? '#ffe08a' : '#ffffff', tam: 1.4 });
    // Una nube de humo blanco al apagarse
    for (let k = 0; k < 4; k++) soltarHumo(v.x + (k - 1.5) * 0.2, v.y, 0.5);
    if (apagados % 10 === 0) {
      aviso = ctx.t('racha', { n: apagados });
      tiempoAviso = 1.5;
    }
  }

  function mojarVecino(v, mano) {
    if (estado === 'juego') puntos = Math.max(0, puntos - 10);
    v.tVecino = 0;
    v.vecino.g.visible = false;
    ctx.vibrar(mano, 0.5, 80);
    ctx.sonido('fallo');
    tmp.set(v.x, v.y + 0.3, FACHADA_Z + 0.4);
    ctx.efectos.texto(tmp, '-10', { color: '#ff8a65', tam: 1.4 });
    aviso = ctx.t('vecino', { n: -10 });
    tiempoAviso = 1.5;
  }

  function explotar(v) {
    v.ardiendo = false;
    v.gas = false;
    v.fuego.visible = false;
    ctx.sonido('derrumbe');
    ctx.efectos.estallido(tmp.set(v.x, v.y, FACHADA_Z + 0.4), { color: 0xffa040, cantidad: 24 });
    danio += 12;
    for (let k = 0; k < 6; k++) soltarHumo(v.x + (k - 2.5) * 0.15, v.y, 0.9);
    for (const i of v.vecinas) if (!ventanas[i].ardiendo) encender(ventanas[i]);
    aviso = ctx.t('explota');
    tiempoAviso = 1.8;
  }

  function soltarHumo(x, y, tam) {
    const b = bolasHumo[siguienteHumo];
    siguienteHumo = (siguienteHumo + 1) % N_HUMO;
    b.pos.set(x, y + 0.4, FACHADA_Z + 0.3);
    b.vida = 1;
    b.tam = tam;
  }

  function actualizarMarcador() {
    if (estado === 'intro') {
      const intro = ctx.enVR() ? ctx.t('intro') : ctx.t(ctx.tactil ? 'introTactil' : 'introRaton');
      marcador.escribir([
        { texto: ctx.t('titulo'), tam: 1.3, color: '#ff8a65' },
        { texto: intro, tam: 0.7 },
      ]);
    } else if (estado === 'fin') {
      marcador.escribir([
        { texto: ctx.t('fin', { n: puntos, fuegos: apagados }), tam: 1.1, color: '#ff8a65' },
        { texto: ctx.t('partida.recordNuevaPartida', { record, n: Math.max(1, Math.ceil(reloj)) }), tam: 0.72 },
      ]);
    } else {
      const llenas = Math.round(danio / 10);
      marcador.escribir([
        { texto: ctx.t('partida.puntosN', { n: puntos }), tam: 1.2 },
        { texto: tiempoAviso > 0 ? aviso : ctx.t('edificio', { barra: '▮'.repeat(llenas) + '▯'.repeat(10 - llenas) }), tam: 0.8, color: tiempoAviso > 0 ? '#ffe08a' : danio > 70 ? '#ff8a65' : '#cfd8dc' },
      ]);
    }
  }

  // Suelta las gotas del chorro desde una boquilla
  function echarAgua(origen, direccion, dt) {
    acumulado += dt * CHORRO;
    while (acumulado >= 1) {
      acumulado -= 1;
      const g = listaGotas[siguienteGota];
      siguienteGota = (siguienteGota + 1) % N_GOTAS;
      g.activa = true;
      g.vida = 1.6;
      g.pos.copy(origen).addScaledVector(direccion, Math.random() * 0.2);
      g.vel.copy(direccion).multiplyScalar(VEL_AGUA * (0.95 + Math.random() * 0.1));
      g.vel.x += (Math.random() - 0.5) * 0.5;
      g.vel.y += (Math.random() - 0.5) * 0.5;
    }
    sonidoAgua -= dt;
    if (sonidoAgua <= 0) {
      ctx.sonido('chorro');
      sonidoAgua = 0.18;
    }
  }

  function moverGotas(dt, mano) {
    for (let i = 0; i < N_GOTAS; i++) {
      const g = listaGotas[i];
      if (!g.activa) {
        gotas.setMatrixAt(i, ocultar);
        continue;
      }
      g.vida -= dt;
      const zAntes = g.pos.z;
      g.vel.y -= G * dt;
      g.pos.addScaledVector(g.vel, dt);
      if (zAntes > FACHADA_Z + 0.1 && g.pos.z <= FACHADA_Z + 0.1) {
        g.activa = false;
        // ¿En qué ventana ha dado?
        for (const v of ventanas) {
          if (!v.ardiendo && v.tVecino <= 0) continue;
          if (Math.abs(g.pos.x - v.x) < ANCHO_VENTANA / 2 + 0.15 && Math.abs(g.pos.y - v.y) < ALTO_VENTANA / 2 + 0.2) {
            if (!v.ardiendo) {
              mojarVecino(v, mano);
              break;
            }
            v.vida -= 0.04 / v.tam;
            ctx.vibrar(mano, 0.12, 15);
            if (v.vida <= 0) apagar(v, mano);
            break;
          }
        }
        salpicadura -= 1;
        if (salpicadura <= 0) {
          tmp.set(g.pos.x, g.pos.y, FACHADA_Z + 0.2);
          ctx.efectos.estallido(tmp, { color: 0xbfe6ff, cantidad: 3 });
          salpicadura = 8;
        }
      }
      if (g.pos.y < 0 || g.vida <= 0) g.activa = false;
      matrizTmp.compose(g.pos, qUno, escTmp.setScalar(1));
      gotas.setMatrixAt(i, g.activa ? matrizTmp : ocultar);
    }
    gotas.instanceMatrix.needsUpdate = true;
  }

  // ─── Bucle ─────────────────────────────────────────────────────────────
  function actualizar(dt, t) {
    reloj -= dt;
    tiempoAviso -= dt;
    if ((estado === 'intro' || estado === 'fin') && reloj <= 0) empezarPartida();

    // Manguera
    let manoAgua = null;
    if (ctx.enVR()) {
      boquillaRaton.g.visible = false;
      for (const b of boquillas) {
        b.palanca.rotation.x = b.mano.gatillo ? 0.5 : 0;
        if (!b.mano.activa || !b.mano.gatillo) continue;
        b.mano.grip.localToWorld(tmp.copy(SALIDA));
        b.mano.grip.localToWorld(tmp2.set(0, 0, -1)).sub(b.mano.posicion).normalize();
        echarAgua(tmp, tmp2, dt);
        manoAgua = b.mano;
        ctx.vibrar(b.mano, 0.08, 20);
      }
    } else {
      boquillaRaton.g.visible = true;
      // Apunta con compensación de la caída del agua
      if (ctx.raton.rayo.ray.intersectPlane(planoFachada, tmp)) {
        const d = tmp.distanceTo(BOQUILLA_RATON);
        const tVuelo = d / VEL_AGUA;
        tmp.y += 0.5 * G * tVuelo * tVuelo;
        tmp2.copy(BOQUILLA_RATON).multiplyScalar(2).sub(tmp);
        boquillaRaton.g.lookAt(tmp2);
      }
      boquillaRaton.palanca.rotation.x = ctx.raton.pulsado ? 0.5 : 0;
      if (ctx.raton.pulsado) {
        boquillaRaton.g.updateMatrixWorld();
        boquillaRaton.g.localToWorld(tmp.copy(SALIDA));
        boquillaRaton.g.localToWorld(tmp2.set(0, 0, -1)).sub(boquillaRaton.g.position).normalize();
        echarAgua(tmp, tmp2, dt);
      }
    }
    moverGotas(dt, manoAgua);

    // Fuegos
    if (estado === 'juego') {
      tiempoJuego += dt;
      proximo -= dt;
      if (proximo <= 0) {
        const libres = ventanas.filter((v) => !v.ardiendo);
        if (libres.length) {
          const gas = tiempoJuego > 20 && Math.random() < 0.2;
          encender(libres[Math.floor(Math.random() * libres.length)], gas);
          if (gas) {
            aviso = ctx.t('bombona');
            tiempoAviso = 1.5;
          }
        }
        proximo = Math.max(0.9, 3.6 - tiempoJuego * 0.045) * (0.7 + Math.random() * 0.6);
      }
      // Un vecino se asoma a una ventana sin fuego
      proximoVecino -= dt;
      if (proximoVecino <= 0) {
        const quietas = ventanas.filter((v) => !v.ardiendo && v.tVecino <= 0);
        if (quietas.length) {
          const v = quietas[Math.floor(Math.random() * quietas.length)];
          v.tVecino = 3.5;
          v.vecino.g.visible = true;
        }
        proximoVecino = 5 + Math.random() * 5;
      }
    }
    for (const v of ventanas) {
      if (v.tVecino <= 0) continue;
      v.tVecino -= dt;
      v.vecino.brazoI.rotation.z = 2.6 + Math.sin(t * 9) * 0.4;
      v.vecino.brazoD.rotation.z = -2.6 - Math.sin(t * 9 + 1) * 0.4;
      if (v.tVecino <= 0) v.vecino.g.visible = false;
    }
    let ardiendo = 0;
    for (const v of ventanas) {
      if (!v.ardiendo) {
        v.vidrio.material.color.lerp(tmp.set(1, 1, 1), Math.min(1, dt * 2));
        continue;
      }
      ardiendo += 1;
      v.tiempo += dt;
      v.tam = Math.min(1.25, v.tam + dt * 0.06);
      // Las llamas bailan y crecen
      v.llamas.forEach((l, k) => {
        const s = v.tam * (k === 1 ? 0.8 : 1) * (0.85 + Math.sin(t * (9 + k * 3) + v.x * 4) * 0.15);
        l.scale.set(s, s * (1 + Math.sin(t * 13 + k) * 0.18), s);
        l.rotation.y = t * (2 + k);
      });
      v.vidrio.material.color.setRGB(2.2, 1.0 + Math.sin(t * 17 + v.y) * 0.15, 0.35);
      if (estado === 'juego') {
        danio += dt * 0.9 * v.tam;
        if (v.gas) {
          v.mecha -= dt;
          // Parpadea cada vez más rápido antes de explotar
          v.bombona.material.color.setHex(Math.sin(t * (6 + (TIEMPO_BOMBONA - v.mecha) * 4)) > 0 ? 0x3c8a4a : 0xff3a3a);
          if (v.mecha <= 0) {
            explotar(v);
            continue;
          }
        }
        // Un fuego grande salta a la ventana de al lado
        if (v.tam >= 1.2 && Math.random() < dt * 0.25) {
          const libres = v.vecinas.filter((k) => !ventanas[k].ardiendo);
          if (libres.length) {
            encender(ventanas[libres[Math.floor(Math.random() * libres.length)]]);
            aviso = ctx.t('propaga');
            tiempoAviso = 1.2;
          }
        }
        if (Math.random() < dt * 2.5) soltarHumo(v.x + (Math.random() - 0.5) * 0.6, v.y, 0.6 + v.tam * 0.5);
      }
    }
    if (estado === 'juego' && danio >= 100) {
      danio = 100;
      terminar();
    }
    if (estado === 'fin') {
      for (const v of ventanas) if (v.ardiendo && Math.random() < dt * 0.6) soltarHumo(v.x, v.y, 1);
    }
    // Humo
    for (let i = 0; i < N_HUMO; i++) {
      const b = bolasHumo[i];
      if (b.vida > 0) {
        b.vida -= dt * 0.35;
        b.pos.y += dt * 0.9;
        b.pos.z += dt * 0.15;
        b.pos.x += Math.sin(t + i) * dt * 0.2;
      }
      const s = b.vida > 0 ? b.tam * (1.6 - b.vida) : 0;
      matrizTmp.compose(b.pos, qUno, escTmp.setScalar(s));
      humo.setMatrixAt(i, matrizTmp);
    }
    humo.instanceMatrix.needsUpdate = true;
    rotativos.material.color.setHex(Math.sin(t * 8) > 0 ? 0x3a8cff : 0xff3a3a);
    void ardiendo;
    actualizarMarcador();
  }

  for (let i = 0; i < N_GOTAS; i++) gotas.setMatrixAt(i, ocultar);
  actualizarMarcador();

  return {
    actualizar,
    liberar() {},
  };
}
