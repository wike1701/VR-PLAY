// GALERÍA DE TIRO
// Muñecos de cartón se levantan por el campo. Dispara a los rojos (los de la
// diana) y no a los azules. Pistola en cada mano (VR) o clic con el ratón.
// Rondas de 60 segundos.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const DURACION = 60;
const ALCANCE = 25;
const CADENCIA = 0.18;        // segundos mínimos entre disparos de una misma pistola
const CANON = -0.2;           // punta del cañón delante del puño
const PUNTOS_CUERPO = 1;
const PUNTOS_CABEZA = 3;
const CASTIGO_INOCENTE = 3;
// Huecos donde se levantan los muñecos: [x, z]
const HUECOS = [
  [0.3, -4], [-2.2, -4.6], [2.4, -5], [0, -6.2], [-3.6, -7],
  [3.3, -7.4], [-1.3, -8.4], [1.6, -9], [-5, -9.6], [5.2, -9.2],
];

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  ctx.fondo(0x1b2230);
  const vistaPos = new THREE.Vector3(0, 1.6, 0.4);
  ctx.vistaEscritorio(vistaPos, new THREE.Vector3(0, 1.3, -6));

  // ─── Utilidades de geometría ───────────────────────────────────────────
  // Junta varias geometrías ya colocadas en una sola (una llamada de dibujo).
  function fusionar(geos) {
    const partes = geos.map((g) => (g.index ? g.toNonIndexed() : g));
    const total = partes.reduce((n, g) => n + g.attributes.position.count, 0);
    const res = new THREE.BufferGeometry();
    for (const nombre of ['position', 'normal', 'uv']) {
      const tam = partes[0].attributes[nombre].itemSize;
      const datos = new Float32Array(total * tam);
      let o = 0;
      for (const g of partes) {
        datos.set(g.attributes[nombre].array, o);
        o += g.attributes[nombre].array.length;
      }
      res.setAttribute(nombre, new THREE.BufferAttribute(datos, tam));
    }
    for (const g of [...geos, ...partes]) g.dispose();
    return res;
  }
  // Recalcula las coordenadas de textura vértice a vértice: fn(x, y, z, nz) -> [u, v]
  function mapearUV(geo, fn) {
    const pos = geo.attributes.position;
    const nor = geo.attributes.normal;
    const uv = geo.attributes.uv;
    for (let i = 0; i < pos.count; i++) {
      const [u, v] = fn(pos.getX(i), pos.getY(i), pos.getZ(i), nor.getZ(i));
      uv.setXY(i, u, v);
    }
    return geo;
  }

  // ─── Decorado: barraca de feria ────────────────────────────────────────
  ctx.sueloBase(false);
  const texSuelo = R(ctx.texturas.grano(0x6e5a44, { tam: 512, repetir: [8, 7], cantidad: 5000, contraste: 0.22, semilla: 3 }));
  const suelo = new THREE.Mesh(
    R(new THREE.PlaneGeometry(16, 14).rotateX(-Math.PI / 2)),
    R(new THREE.MeshLambertMaterial({ map: texSuelo })),
  );
  suelo.position.set(0, 0, -4);
  raiz.add(suelo);

  // Lona a rayas rojas y crema al fondo y a los lados (una sola malla)
  const texLona = R(ctx.texturaCanvas((g, tam, azar) => {
    for (let i = 0; i < 2; i++) {
      g.fillStyle = i ? '#efe2c4' : '#b3261e';
      g.fillRect((i * tam) / 2, 0, tam / 2, tam);
    }
    // Pliegues suaves y trama de tela
    for (let x = 0; x < tam; x += 2) {
      g.fillStyle = `rgba(0,0,0,${0.12 * (0.5 + 0.5 * Math.cos((x / tam) * Math.PI * 4))})`;
      g.fillRect(x, 0, 2, tam);
    }
    for (let i = 0; i < 1500; i++) {
      g.fillStyle = azar() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.08)';
      g.fillRect(azar() * tam, azar() * tam, 1, 1 + azar() * 2);
    }
    // Faldón oscuro abajo
    const grad = g.createLinearGradient(0, tam * 0.75, 0, tam);
    grad.addColorStop(0, 'rgba(0,0,0,0)');
    grad.addColorStop(1, 'rgba(0,0,0,0.45)');
    g.fillStyle = grad;
    g.fillRect(0, 0, tam, tam);
  }, { semilla: 5 }));
  const ALTO_LONA = 4.2;
  const FONDO_LONA = -10.8;
  const ANCHO_LONA = 16;
  const piezasLona = [];
  const lonaFondo = new THREE.PlaneGeometry(ANCHO_LONA, ALTO_LONA).translate(0, ALTO_LONA / 2, FONDO_LONA);
  piezasLona.push([lonaFondo, ANCHO_LONA]);
  for (const lado of [-1, 1]) {
    const largo = 12;
    const g = new THREE.PlaneGeometry(largo, ALTO_LONA)
      .rotateY(-lado * Math.PI / 2)
      .translate(lado * ANCHO_LONA / 2, ALTO_LONA / 2, FONDO_LONA + largo / 2);
    piezasLona.push([g, largo]);
  }
  // Una franja (roja + crema) cada 1,6 m
  for (const [g, ancho] of piezasLona) {
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * ancho / 1.6);
  }
  const lona = new THREE.Mesh(
    R(fusionar(piezasLona.map(([g]) => g))),
    R(new THREE.MeshLambertMaterial({ map: texLona })),
  );
  raiz.add(lona);

  // Guirnalda de bombillas por el borde superior de la lona (una sola malla instanciada)
  const posBombillas = [];
  for (let x = -ANCHO_LONA / 2; x <= ANCHO_LONA / 2 + 0.01; x += 0.5) posBombillas.push([x, ALTO_LONA - 0.15, FONDO_LONA + 0.05]);
  for (const lado of [-1, 1]) {
    for (let z = FONDO_LONA + 0.5; z <= 1; z += 0.6) posBombillas.push([lado * (ANCHO_LONA / 2 - 0.05), ALTO_LONA - 0.15, z]);
  }
  const bombillas = new THREE.InstancedMesh(
    R(new THREE.SphereGeometry(0.075, 8, 6)),
    R(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })),
    posBombillas.length,
  );
  const coloresBombilla = [0xffd54f, 0xff7043, 0xfff3c4, 0x80deea, 0xff8a80];
  const auxObj = new THREE.Object3D();
  const auxColor = new THREE.Color();
  posBombillas.forEach(([x, y, z], i) => {
    auxObj.position.set(x, y, z);
    auxObj.updateMatrix();
    bombillas.setMatrixAt(i, auxObj.matrix);
    bombillas.setColorAt(i, auxColor.setHex(coloresBombilla[i % coloresBombilla.length]));
  });
  raiz.add(bombillas);

  // Mostrador de madera delante del jugador (cuerpo + tablero en una malla)
  const texMostrador = R(ctx.texturas.tablas(0x7a4a2a, { tablas: 6, repetir: [2, 1], semilla: 8 }));
  const mostrador = new THREE.Mesh(
    R(fusionar([
      new THREE.BoxGeometry(3.4, 0.74, 0.4).translate(0, 0.37, -1.35),
      new THREE.BoxGeometry(3.6, 0.06, 0.58).translate(0, 0.77, -1.3),
    ])),
    R(new THREE.MeshLambertMaterial({ map: texMostrador })),
  );
  raiz.add(mostrador);

  // ─── Muñecos ───────────────────────────────────────────────────────────
  // Cada muñeco es un recorte de cartón con bisagra en la base: tumbado hacia
  // atrás (escondido) o de pie (activo). Para gastar pocas llamadas de dibujo,
  // el cuerpo y el poste son una sola malla, y la diana y la cara van pintadas
  // en la textura (en lugar de piezas sueltas).
  const ANCHO_CUERPO = 0.55;
  const ALTO_CUERPO = 0.85;
  const Y_CUERPO = 0.775;
  const Y_DIANA = 0.8;
  const RADIO_CABEZA = 0.17;
  // Puntos de la textura para las caras que no llevan dibujo
  const UV_BORDE = [0.5, 0.99];
  const UV_POSTE = [0.03, 0.03];

  const geoCuerpo = R(fusionar([
    mapearUV(new THREE.BoxGeometry(ANCHO_CUERPO, ALTO_CUERPO, 0.04).toNonIndexed().translate(0, Y_CUERPO, 0),
      (x, y, z, nz) => (nz > 0.9 ? [x / ANCHO_CUERPO + 0.5, (y - Y_CUERPO) / ALTO_CUERPO + 0.5] : UV_BORDE)),
    mapearUV(new THREE.BoxGeometry(0.08, 0.35, 0.04).toNonIndexed().translate(0, 0.175, 0), () => UV_POSTE),
  ]));
  const geoCabeza = R(mapearUV(
    new THREE.CylinderGeometry(RADIO_CABEZA, RADIO_CABEZA, 0.04, 24).rotateX(Math.PI / 2).toNonIndexed(),
    (x, y, z, nz) => (nz > 0.9 ? [x / (RADIO_CABEZA * 2) + 0.5, y / (RADIO_CABEZA * 2) + 0.5] : [0.5, 0.01]),
  ));
  const geoBase = R(new THREE.BoxGeometry(0.7, 0.08, 0.3));
  const geoChispa = R(new THREE.TetrahedronGeometry(0.03));

  // Cartón pintado: color, grano, borde oscuro y el poste de madera en una esquina
  function pintarCarton(g, tam, azar, color) {
    g.fillStyle = color;
    g.fillRect(0, 0, tam, tam);
    for (let i = 0; i < 1400; i++) {
      g.fillStyle = azar() < 0.5 ? `rgba(255,255,255,${azar() * 0.07})` : `rgba(0,0,0,${azar() * 0.1})`;
      g.fillRect(azar() * tam, azar() * tam, 1 + azar() * 2, 1 + azar() * 2);
    }
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = tam * 0.04;
    g.strokeRect(0, 0, tam, tam);
    g.fillStyle = '#7b5a43';
    g.fillRect(0, tam * 0.92, tam * 0.08, tam * 0.08);
  }
  const texCuerpoMalo = R(ctx.texturaCanvas((g, tam, azar) => {
    pintarCarton(g, tam, azar, '#d84315');
    // Diana: en la textura el cuerpo se estira, así que los aros son elipses
    const cx = tam / 2;
    const cy = tam * (0.5 - (Y_DIANA - Y_CUERPO) / ALTO_CUERPO);
    const sx = tam / ANCHO_CUERPO;
    const sy = tam / ALTO_CUERPO;
    const aros = [[0.17, '#fafafa'], [0.135, '#c62828'], [0.1, '#fafafa'], [0.065, '#c62828'], [0.03, '#fafafa']];
    for (const [r, color] of aros) {
      g.beginPath();
      g.ellipse(cx, cy, r * sx, r * sy, 0, 0, Math.PI * 2);
      g.fillStyle = color;
      g.fill();
      g.lineWidth = 1.5;
      g.strokeStyle = 'rgba(40,0,0,0.6)';
      g.stroke();
    }
  }, { semilla: 11 }));
  const texCuerpoBueno = R(ctx.texturaCanvas((g, tam, azar) => {
    pintarCarton(g, tam, azar, '#42a5f5');
    // Un corazón blanco en el pecho: "a mí no"
    const cx = tam / 2;
    const cy = tam * 0.47;
    const s = tam * 0.0042;
    g.fillStyle = '#ffffff';
    g.beginPath();
    g.moveTo(cx, cy + 22 * s);
    g.bezierCurveTo(cx - 36 * s, cy - 2 * s, cx - 18 * s, cy - 26 * s, cx, cy - 10 * s);
    g.bezierCurveTo(cx + 18 * s, cy - 26 * s, cx + 36 * s, cy - 2 * s, cx, cy + 22 * s);
    g.fill();
  }, { semilla: 12 }));

  // Caras: el disco de la cabeza ocupa toda la textura (1 m = tam / 0.34 px)
  function pintarCabeza(g, tam, azar, dibujarCara) {
    g.fillStyle = '#f0b878';
    g.fillRect(0, 0, tam, tam);
    const grad = g.createRadialGradient(tam * 0.45, tam * 0.4, 0, tam / 2, tam / 2, tam / 2);
    grad.addColorStop(0, '#ffdcae');
    grad.addColorStop(0.85, '#ffc98a');
    grad.addColorStop(1, '#d9995a');
    g.fillStyle = grad;
    g.beginPath();
    g.arc(tam / 2, tam / 2, tam / 2, 0, Math.PI * 2);
    g.fill();
    const esc = tam / (RADIO_CABEZA * 2);
    dibujarCara((x) => tam / 2 + x * esc, (y) => tam / 2 - y * esc, esc);
  }
  const texCabezaMalo = R(ctx.texturaCanvas((g, tam, azar) => pintarCabeza(g, tam, azar, (px, py, esc) => {
    // Antifaz de bandido con ojos
    g.fillStyle = '#151515';
    g.beginPath();
    g.roundRect(px(-0.15), py(0.065), 0.3 * esc, 0.07 * esc, 0.03 * esc);
    g.fill();
    for (const x of [-0.06, 0.06]) {
      g.fillStyle = '#ffffff';
      g.beginPath();
      g.arc(px(x), py(0.03), 0.022 * esc, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#111111';
      g.beginPath();
      g.arc(px(x), py(0.028), 0.011 * esc, 0, Math.PI * 2);
      g.fill();
    }
    // Boca torcida y bigote
    g.strokeStyle = '#3a1d10';
    g.lineWidth = 0.012 * esc;
    g.lineCap = 'round';
    g.beginPath();
    g.moveTo(px(-0.055), py(-0.075));
    g.lineTo(px(0.05), py(-0.085));
    g.stroke();
    g.fillStyle = '#3a1d10';
    g.beginPath();
    g.ellipse(px(-0.035), py(-0.045), 0.04 * esc, 0.012 * esc, 0.2, 0, Math.PI * 2);
    g.ellipse(px(0.035), py(-0.045), 0.04 * esc, 0.012 * esc, -0.2, 0, Math.PI * 2);
    g.fill();
  }), { semilla: 13 }));
  const texCabezaBueno = R(ctx.texturaCanvas((g, tam, azar) => pintarCabeza(g, tam, azar, (px, py, esc) => {
    g.fillStyle = 'rgba(255,110,110,0.35)';
    for (const x of [-0.095, 0.095]) {
      g.beginPath();
      g.arc(px(x), py(-0.02), 0.03 * esc, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#111111';
    for (const x of [-0.06, 0.06]) {
      g.beginPath();
      g.arc(px(x), py(0.04), 0.025 * esc, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = '#111111';
    g.lineWidth = 0.02 * esc;
    g.lineCap = 'round';
    g.beginPath();
    g.arc(px(0), py(0), 0.07 * esc, Math.PI * 0.2, Math.PI * 0.8);
    g.stroke();
  }), { semilla: 14 }));

  // Un poco de brillo propio para que el cartón se lea bien en la penumbra
  const materialCarton = (map) => R(new THREE.MeshLambertMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: 0.22 }));
  const matCuerpoMalo = materialCarton(texCuerpoMalo);
  const matCuerpoBueno = materialCarton(texCuerpoBueno);
  const matCabezaMalo = materialCarton(texCabezaMalo);
  const matCabezaBueno = materialCarton(texCabezaBueno);
  const matBase = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.madera(0x4a3a30, { semilla: 9 })) }));
  const matChispa = R(new THREE.MeshBasicMaterial({ color: 0xffe082 }));

  // Las bases no se mueven: todas en una malla instanciada
  const bases = new THREE.InstancedMesh(geoBase, matBase, HUECOS.length);
  raiz.add(bases);
  const matrizBase = new THREE.Matrix4().makeTranslation(0, 0.04, 0);

  const munecos = HUECOS.map(([x, z], i) => {
    const exterior = new THREE.Group();
    exterior.position.set(x, 0, z);
    exterior.lookAt(0, 0, 0); // +Z mira al jugador
    raiz.add(exterior);
    exterior.updateMatrix();
    bases.setMatrixAt(i, auxObj.matrix.multiplyMatrices(exterior.matrix, matrizBase));

    const carril = new THREE.Group(); // se desplaza a los lados en los muñecos que se mueven
    exterior.add(carril);
    const bisagra = new THREE.Group();
    bisagra.position.y = 0.08;
    carril.add(bisagra);

    const cuerpo = new THREE.Mesh(geoCuerpo, matCuerpoMalo);
    const cabeza = new THREE.Mesh(geoCabeza, matCabezaMalo);
    cabeza.position.y = 1.38;
    bisagra.add(cuerpo, cabeza);

    const muneco = {
      carril, bisagra, cuerpo, cabeza,
      estado: 'abajo', t: 0, tiempoArriba: 0,
      inocente: false, mueve: false, fase: 0,
      mallas: [cuerpo, cabeza],
    };
    for (const o of muneco.mallas) {
      o.userData.muneco = muneco;
      o.userData.cabeza = o === cabeza;
    }
    bisagra.rotation.x = -Math.PI / 2;
    return muneco;
  });
  bases.instanceMatrix.needsUpdate = true;

  // ─── Pistolas ──────────────────────────────────────────────────────────
  const geoLaser = R(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]));
  const matLaser = R(new THREE.LineBasicMaterial({ color: 0x69f0ae, transparent: true, opacity: 0.55 }));
  const matLaserRojo = R(new THREE.LineBasicMaterial({ color: 0xff5252, transparent: true, opacity: 0.8 }));
  const geoFogonazo = R(new THREE.SphereGeometry(0.04, 8, 6));
  const matFogonazo = R(new THREE.MeshBasicMaterial({ color: 0xffd54f }));
  // Metal pavonado y cachas de madera, compartidos por las tres pistolas
  const geoArmazon = R(fusionar([
    new THREE.BoxGeometry(0.035, 0.05, 0.2).translate(0, 0.03, -0.08),
    new THREE.CylinderGeometry(0.011, 0.011, 0.03, 12).rotateX(Math.PI / 2).translate(0, 0.035, -0.19),
    new THREE.BoxGeometry(0.006, 0.012, 0.012).translate(0, 0.061, -0.17),
    new THREE.BoxGeometry(0.012, 0.035, 0.035).translate(0, -0.005, -0.045),
  ]));
  const matMetal = R(new THREE.MeshStandardMaterial({ color: 0x3a4148, metalness: 0.85, roughness: 0.32 }));
  const geoEmpunadura = R(new THREE.BoxGeometry(0.03, 0.1, 0.045));
  const matEmpunadura = R(new THREE.MeshStandardMaterial({ color: 0x6d4330, metalness: 0, roughness: 0.6 }));

  function crearPistola() {
    const arma = new THREE.Group();
    const armazon = new THREE.Mesh(geoArmazon, matMetal);
    const empunadura = new THREE.Mesh(geoEmpunadura, matEmpunadura);
    empunadura.position.set(0, -0.02, 0.0);
    empunadura.rotation.x = -0.25;
    const laser = new THREE.Line(geoLaser, matLaser);
    laser.position.set(0, 0.03, CANON);
    const fogonazo = new THREE.Mesh(geoFogonazo, matFogonazo);
    fogonazo.position.set(0, 0.03, CANON - 0.02);
    fogonazo.visible = false;
    arma.add(armazon, empunadura, laser, fogonazo);
    return { arma, laser, fogonazo };
  }

  const pistolas = ctx.manos.map((mano) => {
    const p = crearPistola();
    ctx.adjuntarAMano(mano, p.arma);
    return { ...p, mano, espera: 0, retroceso: 0, flash: 0 };
  });

  // Pistola que apunta al ratón en modo escritorio
  const pistolaRaton = crearPistola();
  pistolaRaton.laser.visible = false;
  const pivote = new THREE.Group();
  pivote.add(pistolaRaton.arma);
  pivote.position.copy(vistaPos).add(new THREE.Vector3(0.2, -0.22, -0.45));
  raiz.add(pivote);
  let retrocesoRaton = 0;
  let flashRaton = 0;

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.8, alto: 0.48 });
  marcador.mesh.position.set(0, 3, -6.5);
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  const particulas = [];
  const rayo = new THREE.Raycaster();
  rayo.far = ALCANCE;
  let puntos = 0;
  let record = ctx.leer('record', 0);
  let estado = 'intro'; // 'intro' | 'jugando' | 'fin'
  let reloj = 3;
  let tiempoRestante = DURACION;
  let proximoMuneco = 0;
  let disparos = 0;
  let aciertos = 0;
  let mensaje = '';
  let tiempoMensaje = 0;

  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();

  function actualizarMarcador() {
    if (estado === 'intro') {
      marcador.escribir([
        { texto: 'GALERÍA DE TIRO', tam: 1.3, color: '#ffab91' },
        { texto: 'Dispara a los rojos con diana · ¡a los azules no!', tam: 0.75 },
      ]);
    } else if (estado === 'fin') {
      const punteria = disparos ? Math.round((aciertos / disparos) * 100) : 0;
      marcador.escribir([
        { texto: `¡Tiempo! ${puntos} puntos`, tam: 1.3, color: '#ffab91' },
        { texto: `Puntería ${punteria}% · Récord: ${record} · otra en ${Math.ceil(reloj)}`, tam: 0.75 },
      ]);
    } else {
      marcador.escribir([
        { texto: `Puntos: ${puntos}   ·   ${Math.ceil(tiempoRestante)} s`, tam: 1.3 },
        tiempoMensaje > 0
          ? { texto: mensaje, tam: 0.75, color: '#fff59d' }
          : { texto: `Récord: ${record}   ·   cabeza +${PUNTOS_CABEZA}   ·   azules −${CASTIGO_INOCENTE}`, tam: 0.75, color: '#ffab91' },
      ]);
    }
  }

  function avisar(texto) {
    mensaje = texto;
    tiempoMensaje = 1;
  }

  function levantarMuneco(progreso) {
    const libres = munecos.filter((m) => m.estado === 'abajo');
    if (libres.length === 0) return;
    const m = libres[Math.floor(Math.random() * libres.length)];
    m.estado = 'subiendo';
    m.t = 0;
    m.inocente = Math.random() < 0.22;
    m.mueve = progreso > 0.35 && Math.random() < 0.35;
    m.fase = Math.random() * Math.PI * 2;
    m.tiempoArriba = 2.2 - progreso * 1.0 + Math.random() * 0.5;
    m.cuerpo.material = m.inocente ? matCuerpoBueno : matCuerpoMalo;
    m.cabeza.material = m.inocente ? matCabezaBueno : matCabezaMalo;
  }

  const activo = (m) => m.estado === 'subiendo' || m.estado === 'arriba';

  function mallasActivas() {
    const lista = [];
    for (const m of munecos) if (activo(m)) lista.push(...m.mallas);
    return lista;
  }

  // Lanza el rayo y devuelve el primer impacto contra un muñeco activo
  function apuntar(origen, direccion, mallas) {
    rayo.set(origen, direccion);
    return rayo.intersectObjects(mallas, false)[0] || null;
  }

  function disparar(choque, mano) {
    disparos += 1;
    ctx.sonido('disparo');
    if (mano) ctx.vibrar(mano, 0.6, 40);
    if (!choque || estado !== 'jugando') return;

    const m = choque.object.userData.muneco;
    const cabeza = choque.object.userData.cabeza;
    m.estado = 'cayendo';
    m.t = 0;
    chispas(choque.point);
    if (m.inocente) {
      puntos = Math.max(0, puntos - CASTIGO_INOCENTE);
      avisar(`¡Era inocente! −${CASTIGO_INOCENTE}`);
      ctx.sonido('fallo');
      ctx.destello(0x1e88e5, 0.45);
    } else {
      aciertos += 1;
      puntos += cabeza ? PUNTOS_CABEZA : PUNTOS_CUERPO;
      if (cabeza) avisar(`¡A la cabeza! +${PUNTOS_CABEZA}`);
      ctx.sonido('golpe');
      ctx.sonido('punto');
    }
  }

  function chispas(punto) {
    for (let i = 0; i < 8; i++) {
      const c = new THREE.Mesh(geoChispa, matChispa);
      c.position.copy(punto);
      const vel = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8 + 0.2, Math.random() - 0.5).multiplyScalar(3);
      raiz.add(c);
      particulas.push({ malla: c, vel, vida: 0.5 });
    }
  }

  function actualizarMuneco(m, dt, t) {
    m.t += dt;
    const b = m.bisagra;
    switch (m.estado) {
      case 'subiendo': {
        const f = Math.min(1, m.t / 0.25);
        b.rotation.x = -Math.PI / 2 * (1 - f) * (1 - f);
        if (f >= 1) { m.estado = 'arriba'; m.t = 0; }
        break;
      }
      case 'arriba':
        b.rotation.x = 0;
        if (m.t >= m.tiempoArriba || estado !== 'jugando') { m.estado = 'bajando'; m.t = 0; }
        break;
      case 'cayendo': {
        // Cae de golpe hacia atrás, con un pequeño rebote
        const f = Math.min(1, m.t / 0.3);
        b.rotation.x = -Math.PI / 2 * f * f + Math.sin(f * Math.PI) * 0.1;
        if (f >= 1) { m.estado = 'abajo'; m.t = 0; }
        break;
      }
      case 'bajando': {
        const f = Math.min(1, m.t / 0.4);
        b.rotation.x = -Math.PI / 2 * f;
        if (f >= 1) { m.estado = 'abajo'; m.t = 0; }
        break;
      }
      default:
        b.rotation.x = -Math.PI / 2;
    }
    m.carril.position.x = m.mueve && m.estado !== 'abajo' ? Math.sin(t * 2.2 + m.fase) * 0.9 : 0;
  }

  // ─── Pistolas VR ───────────────────────────────────────────────────────
  function pistolasVR(dt, mallas) {
    for (const p of pistolas) {
      p.espera = Math.max(0, p.espera - dt);
      p.retroceso = Math.max(0, p.retroceso - dt * 6);
      p.flash -= dt;
      p.fogonazo.visible = p.flash > 0;
      p.arma.rotation.x = p.retroceso * 0.5;
      if (!p.mano.activa) continue;

      const origen = p.mano.grip.localToWorld(tmp.set(0, 0.03, CANON));
      const direccion = tmp2.set(0, 0, -1).transformDirection(p.mano.grip.matrixWorld);
      const choque = apuntar(origen, direccion, mallas);
      p.laser.scale.z = choque ? choque.distance : ALCANCE;
      p.laser.material = choque && !choque.object.userData.muneco.inocente ? matLaserRojo : matLaser;

      if (p.mano.gatilloPulsado && p.espera <= 0) {
        p.espera = CADENCIA;
        p.retroceso = 1;
        p.flash = 0.05;
        disparar(choque, p.mano);
      }
    }
  }

  // ─── Disparos con el ratón ─────────────────────────────────────────────
  function disparosRaton(dt, mallas) {
    const raton = ctx.raton;
    pivote.visible = raton.dentro;
    // La pistola mira hacia donde apunta el ratón
    const objetivo = raton.rayo.ray.at(10, tmp);
    pivote.lookAt(tmp2.copy(pivote.position).multiplyScalar(2).sub(objetivo));

    retrocesoRaton = Math.max(0, retrocesoRaton - dt * 6);
    flashRaton -= dt;
    pistolaRaton.arma.rotation.x = retrocesoRaton * 0.5;
    pistolaRaton.fogonazo.visible = flashRaton > 0;

    if (raton.clic) {
      retrocesoRaton = 1;
      flashRaton = 0.05;
      disparar(raton.rayo.intersectObjects(mallas, false)[0] || null, null);
    }
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function empezar() {
    estado = 'jugando';
    puntos = 0;
    disparos = 0;
    aciertos = 0;
    tiempoRestante = DURACION;
    proximoMuneco = 0.4;
  }

  function actualizar(dt, t) {
    reloj -= dt;
    tiempoMensaje -= dt;

    if (estado === 'intro' && reloj <= 0) {
      empezar();
    } else if (estado === 'jugando') {
      tiempoRestante -= dt;
      const progreso = 1 - tiempoRestante / DURACION;
      proximoMuneco -= dt;
      const maxArriba = 2 + Math.floor(progreso * 2.5);
      if (proximoMuneco <= 0 && munecos.filter(activo).length < maxArriba) {
        levantarMuneco(progreso);
        proximoMuneco = 1.0 - progreso * 0.5 + Math.random() * 0.3;
      }
      if (tiempoRestante <= 0) {
        estado = 'fin';
        reloj = 6;
        if (puntos > record) {
          record = puntos;
          ctx.guardar('record', record);
        }
        ctx.sonido('fin');
      }
    } else if (estado === 'fin' && reloj <= 0) {
      empezar();
    }

    for (const m of munecos) actualizarMuneco(m, dt, t);
    raiz.updateMatrixWorld();

    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      p.vida -= dt;
      p.vel.y -= 6 * dt;
      p.malla.position.addScaledVector(p.vel, dt);
      p.malla.scale.setScalar(Math.max(0.01, p.vida / 0.5));
      if (p.vida <= 0) {
        raiz.remove(p.malla);
        particulas.splice(i, 1);
      }
    }

    const mallas = mallasActivas();
    if (ctx.enVR()) {
      pivote.visible = false;
      pistolasVR(dt, mallas);
    } else {
      disparosRaton(dt, mallas);
    }

    actualizarMarcador();
  }

  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      particulas.length = 0;
      bases.dispose();
      bombillas.dispose();
    },
  };
}
