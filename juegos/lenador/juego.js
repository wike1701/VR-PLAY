// LEÑADOR
// Un árbol enorme delante de ti, en un claro del bosque al atardecer, con ramas a la izquierda y
// a la derecha. Llevas un hacha en cada mano: cortar con la izquierda es cortar desde la
// izquierda, y con la derecha desde la derecha. Cada hachazo se lleva el trozo de abajo y el
// árbol baja un trozo. Si golpeas del lado en el que hay una rama a tu altura, la rama te da
// y se acaba (una rama más arriba no hace nada hasta que la golpeas). La barra de tiempo se vacía sola y
// cada hachazo la rellena un poco, pero cada vez se vacía más deprisa. Sin final fijo.
// Sin gafas: clic (o toque) en la mitad izquierda o derecha de la pantalla.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código.
export async function precargar() {}

const ALTO_TROZO = 0.4;      // cada trozo del tronco
const R_TRONCO = 0.17;
const Z_TRONCO = -0.6;
const Y_CORTE = 1.0;         // centro del trozo de abajo, el que se corta (a la altura del pecho)
const N_PILA = 12;           // trozos a la vista (el árbol sube hasta casi 6 m)
const N_VUELO = 3;           // trozos cortados que salen volando a la vez
const LARGO_RAMA = 0.7;
const VELOCIDAD_HACHAZO = 1.0; // m/s mínimos de la cabeza del hacha para que cuente
const NIVEL = 25;            // cada 25 hachazos, un nivel más

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (r) => ctx.recurso(r);

  ctx.fondo(0xf2b27a, {
    cenit: 0x5a7fc0, horizonte: 0xffc58f, nubes: 0.35, sol: [-0.4, 0.15, -1], niebla: [20, 75],
    paisaje: { tipo: 'montes', color: 0x4f6b55, radio: 75 },
  });
  ctx.sueloBase(false);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.65, 1.5), new THREE.Vector3(0, 1.45, -0.6)); // de lejos: que quepan las ramas

  const matrizTmp = new THREE.Matrix4();
  const eulerTmp = new THREE.Euler();
  const colorTmp = new THREE.Color();
  function colocar(geo, x, y, z, rx = 0, ry = 0, rz = 0) {
    matrizTmp.makeRotationFromEuler(eulerTmp.set(rx, ry, rz)).setPosition(x, y, z);
    return geo.applyMatrix4(matrizTmp);
  }
  // Une varias geometrías en una (una sola llamada de dibujo). Con «colores», una por pieza.
  function fusionar(geos, colores = null) {
    let nv = 0;
    let ni = 0;
    for (const g of geos) {
      nv += g.attributes.position.count;
      ni += g.index ? g.index.count : g.attributes.position.count;
    }
    const pos = new Float32Array(nv * 3);
    const nor = new Float32Array(nv * 3);
    const uv = new Float32Array(nv * 2);
    const col = colores ? new Float32Array(nv * 3) : null;
    const indices = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let ov = 0;
    let oi = 0;
    geos.forEach((g, k) => {
      const n = g.attributes.position.count;
      pos.set(g.attributes.position.array, ov * 3);
      nor.set(g.attributes.normal.array, ov * 3);
      if (g.attributes.uv) uv.set(g.attributes.uv.array, ov * 2);
      if (col) {
        colorTmp.set(colores[k]);
        for (let i = 0; i < n; i++) col.set([colorTmp.r, colorTmp.g, colorTmp.b], (ov + i) * 3);
      }
      if (g.index) for (let i = 0; i < g.index.count; i++) indices[oi++] = g.index.array[i] + ov;
      else for (let i = 0; i < n; i++) indices[oi++] = ov + i;
      ov += n;
      g.dispose();
    });
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    return R(geo);
  }
  // Lleva las coordenadas de textura de una geometría a una parte de la textura (atlas)
  function aParte(geo, u0, ancho) {
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + uv.getX(i) * ancho);
    return geo;
  }

  // ─── Claro del bosque ──────────────────────────────────────────────────
  const cesped = new THREE.Mesh(
    R(new THREE.CircleGeometry(60, 40)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.cesped(0x5d8a3e, { tam: 512, repetir: [28, 28], semilla: 201 })) })),
  );
  cesped.rotation.x = -Math.PI / 2;
  raiz.add(cesped);
  // Tierra pisada y serrín alrededor del árbol
  const tierra = new THREE.Mesh(R(new THREE.CircleGeometry(1.4, 32)), R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.grano(0x8a6a48, { tam: 256, repetir: [3, 3], semilla: 202 })) })));
  tierra.rotation.x = -Math.PI / 2;
  tierra.position.set(0, 0.005, Z_TRONCO + 0.2);
  raiz.add(tierra);
  raiz.add(ctx.arboles([
    { x: -3.5, z: -4, escala: 1.3 }, { x: 3.2, z: -4.5, escala: 1.5 }, { x: -6, z: -1, escala: 1.4 },
    { x: 6, z: -2, escala: 1.6 }, { x: -2, z: -8, escala: 1.7 }, { x: 2.5, z: -9, escala: 1.4 },
    { x: -8, z: -7, escala: 1.8 }, { x: 8, z: -8, escala: 1.6 }, { x: -5, z: 5, escala: 1.4 },
    { x: 5, z: 5, escala: 1.5 }, { x: 0, z: 7, escala: 1.6 }, { x: -10, z: 2, escala: 1.7 }, { x: 10, z: 1, escala: 1.5 },
  ], { tipo: 'pino', semilla: 20 }));
  raiz.add(ctx.arboles([
    { x: -4.5, z: -6.5, escala: 1.2 }, { x: 4.6, z: -6, escala: 1.1 }, { x: -7, z: -3.5, escala: 1.3 }, { x: 7.5, z: -4.5, escala: 1.2 },
  ], { tipo: 'frondoso', semilla: 21 }));
  // Pila de troncos cortados y un tocón con un hacha clavada, a los lados
  const texCorteza = R(ctx.texturaCanvas((g, tam, azar) => {
    // Izquierda: corteza; derecha: anillos del corte
    const mitad = tam / 2;
    g.fillStyle = '#5a3a24';
    g.fillRect(0, 0, mitad, tam);
    for (let i = 0; i < 70; i++) {
      const x = azar() * mitad;
      g.fillStyle = azar() < 0.5 ? 'rgba(30, 16, 8, 0.55)' : 'rgba(150, 110, 70, 0.35)';
      g.fillRect(x, 0, 1.5 + azar() * 3, tam);
    }
    for (let i = 0; i < 40; i++) {
      g.fillStyle = 'rgba(25, 12, 6, 0.5)';
      g.fillRect(azar() * mitad, azar() * tam, 4 + azar() * 8, 2);
    }
    g.fillStyle = '#e8c48c';
    g.fillRect(mitad, 0, mitad, tam);
    const cx = mitad + mitad / 2;
    const cy = tam / 2;
    for (let r = mitad / 2; r > 2; r -= 5 + azar() * 4) {
      g.strokeStyle = `rgba(150, 95, 50, ${0.35 + azar() * 0.3})`;
      g.lineWidth = 1.5;
      g.beginPath();
      g.arc(cx, cy, r, 0, Math.PI * 2);
      g.stroke();
    }
    g.strokeStyle = '#5a3a24';
    g.lineWidth = 6;
    g.beginPath();
    g.arc(cx, cy, mitad / 2 - 3, 0, Math.PI * 2);
    g.stroke();
  }, { tam: 256, semilla: 203 }));
  const matMadera = R(new THREE.MeshLambertMaterial({ map: texCorteza }));
  // Un tronco cerrado con la corteza en el lateral y los anillos en las tapas
  function geoTronco(radio, largo, segmentos = 16) {
    const lado = aParte(new THREE.CylinderGeometry(radio, radio, largo, segmentos, 1, true), 0, 0.5);
    const arriba = aParte(new THREE.CircleGeometry(radio, segmentos), 0.5, 0.5);
    arriba.rotateX(-Math.PI / 2);
    arriba.translate(0, largo / 2, 0);
    const abajo = aParte(new THREE.CircleGeometry(radio, segmentos), 0.5, 0.5);
    abajo.rotateX(Math.PI / 2);
    abajo.translate(0, -largo / 2, 0);
    return [lado, arriba, abajo];
  }
  const decorado = [];
  const troncosPila = [[0, 0.16], [0.34, 0.16], [0.68, 0.16], [0.17, 0.44], [0.51, 0.44], [0.34, 0.72]];
  for (const [x, y] of troncosPila) {
    for (const g of geoTronco(0.15, 1.6, 12)) decorado.push(colocar(g, 2.2 + x, y, -1.6, 0, 0.3, Math.PI / 2));
  }
  for (const g of geoTronco(0.3, 0.5, 18)) decorado.push(colocar(g, -1.8, 0.25, -1.4));
  raiz.add(new THREE.Mesh(fusionar(decorado), matMadera));
  const sombraDecorado = ctx.crearSombra({ radio: 1.0, opacidad: 0.4 });
  sombraDecorado.position.set(2.5, 0.01, -1.6);
  raiz.add(sombraDecorado);

  // ─── Hachas ────────────────────────────────────────────────────────────
  // Mango torneado hacia delante (-Z) y la cabeza de acero en la punta, con el filo hacia dentro
  const LARGO_MANGO = 0.5;
  const perfilMango = [
    [0.0001, 0], [0.017, 0.004], [0.019, 0.03], [0.016, 0.1], [0.014, 0.25], [0.016, 0.4], [0.018, LARGO_MANGO - 0.01], [0.0001, LARGO_MANGO],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geoMango = R(new THREE.LatheGeometry(perfilMango, 12));
  geoMango.rotateX(-Math.PI / 2);
  geoMango.translate(0, 0, 0.08);
  const formaHoja = new THREE.Shape();
  formaHoja.moveTo(-0.02, -0.03);
  formaHoja.lineTo(0.05, -0.035);
  formaHoja.quadraticCurveTo(0.1, -0.06, 0.12, -0.075);
  formaHoja.quadraticCurveTo(0.135, 0, 0.12, 0.075);
  formaHoja.quadraticCurveTo(0.1, 0.06, 0.05, 0.035);
  formaHoja.lineTo(-0.02, 0.03);
  formaHoja.lineTo(-0.045, 0.02);
  formaHoja.lineTo(-0.045, -0.02);
  formaHoja.closePath();
  const geoHoja = R(new THREE.ExtrudeGeometry(formaHoja, { depth: 0.022, bevelEnabled: true, bevelSize: 0.004, bevelThickness: 0.004, bevelSegments: 2, curveSegments: 8 }));
  geoHoja.translate(0, 0, -0.011);
  // La hoja, plana en horizontal: su alto va a lo largo del mango (Z) y el filo apunta a +X,
  // hacia un lado, que es el que golpea el tronco al dar el hachazo de lado
  geoHoja.rotateX(Math.PI / 2);
  const geoFilo = R(new THREE.BoxGeometry(0.006, 0.02, 0.15));
  const matMango = R(new THREE.MeshStandardMaterial({ map: R(ctx.texturas.madera(0xc8955a, { tam: 128, semilla: 204 })), roughness: 0.55 }));
  const matAcero = R(new THREE.MeshStandardMaterial({ color: 0x6d7480, roughness: 0.35, metalness: 0.9 }));
  const matFilo = R(new THREE.MeshStandardMaterial({ color: 0xe8edf2, roughness: 0.15, metalness: 1 }));
  const matPuno = R(new THREE.MeshLambertMaterial({ color: 0xc62828 }));
  const geoPuno = R(new THREE.CylinderGeometry(0.021, 0.021, 0.09, 12).rotateX(Math.PI / 2));
  const CABEZA_EN_MANO = new THREE.Vector3(0, 0, 0.08 - LARGO_MANGO + 0.03);
  // lado: -1 hacha de la mano izquierda (el filo mira a la derecha, hacia el árbol), 1 la derecha
  function crearHacha(lado) {
    const g = new THREE.Group();
    const mango = new THREE.Mesh(geoMango, matMango);
    const puno = new THREE.Mesh(geoPuno, matPuno);
    puno.position.z = 0.03;
    const cabeza = new THREE.Group();
    cabeza.position.copy(CABEZA_EN_MANO);
    const hoja = new THREE.Mesh(geoHoja, matAcero);
    const filo = new THREE.Mesh(geoFilo, matFilo);
    filo.position.x = 0.125;
    cabeza.add(hoja, filo);
    cabeza.rotation.y = lado < 0 ? 0 : Math.PI; // filo hacia dentro
    g.add(mango, puno, cabeza);
    return g;
  }
  const hachas = ctx.manos.map((mano) => {
    // El lado se sabe al conectar el mando; mientras, se supone por el orden
    const objeto = crearHacha(mano.indice === 0 ? -1 : 1);
    objeto.rotation.x = -0.35;
    ctx.adjuntarAMano(mano, objeto);
    return { mano, objeto, cabeza: new THREE.Vector3(), anterior: new THREE.Vector3(), armada: true, lado: 0, colocada: 0 };
  });
  // Ratón: un hacha que da el golpe desde el lado elegido
  const hachaRaton = crearHacha(-1);
  raiz.add(hachaRaton);
  let golpeRaton = 0;
  let ladoRaton = -1;

  // ─── Tronco ────────────────────────────────────────────────────────────
  // El tocón (fijo) y los trozos que se cortan: cada trozo es su tronco y, si la tiene, su rama
  const tocon = new THREE.Mesh(fusionar([
    ...geoTronco(R_TRONCO + 0.01, Y_CORTE - ALTO_TROZO / 2, 18).map((g) => g.translate(0, (Y_CORTE - ALTO_TROZO / 2) / 2, 0)),
    ...[0, 1.3, 2.6, 3.9, 5.2].map((a) => colocar(aParte(new THREE.ConeGeometry(0.07, 0.5, 6), 0, 0.5), Math.cos(a) * 0.24, 0.08, Math.sin(a) * 0.24, 0, -a, Math.PI / 2 - 0.35)),
  ]), matMadera);
  tocon.position.set(0, 0, Z_TRONCO);
  raiz.add(tocon);
  const sombraArbol = ctx.crearSombra({ radio: 0.55, opacidad: 0.55 });
  sombraArbol.position.set(0, 0.012, Z_TRONCO);
  raiz.add(sombraArbol);
  const geoTrozo = fusionar(geoTronco(R_TRONCO, ALTO_TROZO, 18));
  // Rama hacia +X con su ramaje de hojas (madera y hojas en una malla con colores por pieza)
  const piezasRama = [
    new THREE.CylinderGeometry(0.035, 0.06, LARGO_RAMA, 8).rotateZ(Math.PI / 2).translate(LARGO_RAMA / 2 + R_TRONCO - 0.03, 0, 0),
    new THREE.CylinderGeometry(0.018, 0.028, 0.28, 6).rotateZ(-0.7).translate(R_TRONCO + 0.35, 0.1, 0.02),
  ];
  const coloresRama = [0x5a3a24, 0x5a3a24];
  for (const [x, y, z, r, c] of [[0.85, 0.05, 0, 0.17, 0x3f7a35], [0.66, 0.12, 0.09, 0.13, 0x4f8f3a], [0.98, -0.02, -0.08, 0.12, 0x356b2e], [0.56, 0.22, -0.04, 0.1, 0x5ba043]]) {
    piezasRama.push(new THREE.IcosahedronGeometry(r, 0).translate(x, y, z));
    coloresRama.push(c);
  }
  const geoRama = fusionar(piezasRama, coloresRama);
  const matRama = R(new THREE.MeshLambertMaterial({ vertexColors: true, flatShading: true }));
  const trozos = Array.from({ length: N_PILA + N_VUELO }, () => {
    const grupo = new THREE.Group();
    const tronco = new THREE.Mesh(geoTrozo, matMadera);
    const rama = new THREE.Mesh(geoRama, matRama);
    grupo.add(tronco, rama);
    raiz.add(grupo);
    return { grupo, rama, lado: 0, vel: new THREE.Vector3(), giro: new THREE.Vector3(), vida: 0 };
  });
  const pila = trozos.slice(0, N_PILA);  // de abajo arriba
  const libres = trozos.slice(N_PILA);   // los que no están en la pila ni volando
  const volando = [];
  function ponerRama(t, lado) {
    t.lado = lado;
    t.rama.visible = lado !== 0;
    t.rama.rotation.set(0, lado < 0 ? Math.PI : 0, 0); // hacia -X es la misma rama girada
  }

  // ─── Barra de tiempo y marcador ────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 0.95, alto: 0.34 });
  marcador.mesh.position.set(-0.95, 1.7, -1.0);
  marcador.mesh.rotation.y = 0.5;
  raiz.add(marcador.mesh);
  const barra = new THREE.Group();
  barra.position.set(-0.95, 1.46, -1.0);
  barra.rotation.y = 0.5;
  const fondoBarra = new THREE.Mesh(R(new THREE.PlaneGeometry(0.8, 0.06)), R(new THREE.MeshBasicMaterial({ color: 0x1a1410, transparent: true, opacity: 0.8 })));
  const geoRelleno = R(new THREE.PlaneGeometry(0.78, 0.042));
  geoRelleno.translate(0.39, 0, 0);
  const matRelleno = R(new THREE.MeshBasicMaterial({ color: 0x6dff7a, toneMapped: false }));
  const relleno = new THREE.Mesh(geoRelleno, matRelleno);
  relleno.position.set(-0.39, 0, 0.002);
  barra.add(fondoBarra, relleno);
  raiz.add(barra);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'espera'; // 'espera' (el primer hachazo empieza) | 'juego' | 'fin'
  let reloj = 0;
  let puntos = 0;
  let tiempoBarra = 1;   // 0..1
  let record = ctx.leer('record', 0);
  let nuevoRecord = false;
  let mensaje = '';
  let colorMensaje = '#ffffff';
  let tiempoMensaje = 0;
  let bajada = 0;        // lo que le falta a la pila por bajar (animación)
  let temblor = 0;
  let ultimaRama = 0;
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const centroTronco = new THREE.Vector3(0, Y_CORTE, Z_TRONCO);

  const nivel = () => 1 + Math.floor(puntos / NIVEL);
  // Cuánto se vacía la barra por segundo y cuánto rellena cada hachazo: al principio hace falta
  // un hachazo por segundo para mantenerla; a los 100 puntos, unos 2,5; como mucho, 3,75
  const vaciado = () => Math.min(0.3, 0.08 + puntos * 0.0012);
  const RELLENO = 0.08;

  // La rama de un trozo nuevo: nunca una rama a un lado justo encima de otra al otro lado
  // (no habría lado bueno). Con el nivel salen más ramas y más seguidas.
  function nuevaRama() {
    const pRama = Math.min(0.75, 0.42 + puntos * 0.002);
    const pSeguida = Math.min(0.4, puntos * 0.003);
    let lado = 0;
    if (ultimaRama !== 0) lado = Math.random() < pSeguida ? ultimaRama : 0;
    else if (Math.random() < pRama) lado = Math.random() < 0.5 ? -1 : 1;
    ultimaRama = lado;
    return lado;
  }

  function montarArbol() {
    ultimaRama = 0;
    while (volando.length) libres.push(volando.pop().t);
    for (const t of libres) t.grupo.visible = false;
    pila.forEach((t, i) => {
      t.grupo.visible = true;
      t.grupo.rotation.set(0, 0, 0);
      ponerRama(t, i < 2 ? 0 : nuevaRama());
    });
    bajada = 0;
    colocarPila();
  }

  function colocarPila() {
    for (let i = 0; i < N_PILA; i++) {
      const t = pila[i].grupo;
      t.position.set(0, Y_CORTE + i * ALTO_TROZO + bajada, Z_TRONCO);
      t.rotation.set(0, 0, temblor > 0 ? Math.sin(temblor * 60) * temblor * 0.02 * (i + 1) / N_PILA : 0);
    }
  }

  function empezar() {
    estado = 'juego';
    puntos = 0;
    tiempoBarra = 1;
    nuevoRecord = false;
  }

  function terminar(clave, lado) {
    if (estado === 'fin') return;
    estado = 'fin';
    reloj = 4;
    mensaje = ctx.t(clave);
    colorMensaje = '#ff8a80';
    tiempoMensaje = 4;
    temblor = 0.6;
    if (lado) {
      // La rama te da: golpe seco, vibración fuerte en esa mano y destello rojo
      tmp.set(lado * (R_TRONCO + 0.4), Y_CORTE + 0.05, Z_TRONCO + 0.1);
      ctx.efectos.estallido(tmp, { color: 0x4f8f3a, cantidad: 16 });
      ctx.sonido('rama');
      for (const h of hachas) if (h.lado === lado) ctx.vibrar(h.mano, 1, 200);
    }
    ctx.sonido('fallo');
    ctx.destello(0xff2a2a, 0.2);
    ctx.puntuacion(puntos); // a la clasificación (juegos/marcadores.js)
    if (puntos > record) {
      record = puntos;
      nuevoRecord = puntos > 0;
      ctx.guardar('record', record);
    }
    if (nuevoRecord) ctx.efectos.impacto('grande', { pos: centroTronco, color: 0xffd23f, sonido: 'ovacion' });
  }

  // Un hachazo desde un lado (-1 izquierda, 1 derecha)
  function hachazo(lado, mano) {
    if (estado === 'fin') return;
    if (estado === 'espera') empezar();
    // Solo muere quien golpea por el lado de la rama del trozo que corta (a su altura);
    // una rama que baja por encima no hace daño hasta que se golpea
    const golpeada = pila[0].lado === lado;
    // El trozo de abajo sale volando hacia el otro lado y la pila baja
    const t = pila.shift();
    // Si se corta muy deprisa no quedan trozos libres: se reutiliza el que lleva más tiempo volando
    if (!libres.length) libres.push(volando.shift().t);
    const libre = libres.pop();
    volando.push({ t });
    t.vida = 1.2;
    t.vel.set(-lado * (2.2 + Math.random()), 1.2 + Math.random() * 0.6, -0.6 - Math.random() * 0.8);
    t.giro.set(Math.random() * 6 - 3, Math.random() * 4 - 2, -lado * (6 + Math.random() * 4));
    ponerRama(libre, nuevaRama());
    libre.grupo.visible = true;
    libre.grupo.rotation.set(0, 0, 0);
    pila.push(libre);
    bajada = ALTO_TROZO;
    colocarPila();
    tmp.set(lado * R_TRONCO, Y_CORTE, Z_TRONCO + 0.05);
    ctx.sonido('hachazo');
    if (golpeada) {
      terminar('rama', lado);
      return;
    }
    puntos += 1;
    tiempoBarra = Math.min(1, tiempoBarra + RELLENO);
    const hito = puntos % NIVEL === 0;
    ctx.efectos.impacto(hito ? 'medio' : 'pequeño', { pos: tmp, mano, color: 0xd9a066 });
    ctx.efectos.estallido(tmp, { color: 0xe8c48c, cantidad: 8, fuerza: 1.6, tam: 0.014 });
    ctx.efectos.texto(tmp2.set(lado * (R_TRONCO + 0.15), Y_CORTE + 0.2, Z_TRONCO + 0.1), '+1', { color: '#ffffff', tam: 0.7 });
    if (hito) {
      mensaje = ctx.t('nivel', { n: nivel() });
      colorMensaje = '#ffd23f';
      tiempoMensaje = 1.6;
      ctx.sonido('hoyo');
    }
  }

  // ─── VR: la cabeza del hacha entra en el tronco a la altura del corte ──
  function hachasVR(dt) {
    for (const h of hachas) {
      if (!h.mano.activa) continue;
      // Qué mano es cuál: la del mando si se sabe; si no, por el orden
      const lado = h.mano.lado === 'left' ? -1 : h.mano.lado === 'right' ? 1 : h.mano.indice === 0 ? -1 : 1;
      if (lado !== h.colocada) {
        h.colocada = lado;
        h.objeto.children[2].rotation.y = lado < 0 ? 0 : Math.PI; // el filo siempre hacia el árbol
      }
      h.lado = lado;
      h.anterior.copy(h.cabeza);
      h.objeto.localToWorld(h.cabeza.copy(CABEZA_EN_MANO));
      const rapidez = dt > 0 ? h.cabeza.distanceTo(h.anterior) / dt : 0;
      const distancia = Math.hypot(h.cabeza.x, h.cabeza.z - Z_TRONCO);
      const alturaBuena = h.cabeza.y > Y_CORTE - ALTO_TROZO / 2 - 0.1 && h.cabeza.y < Y_CORTE + ALTO_TROZO / 2 + 0.1;
      if (distancia > R_TRONCO + 0.16) h.armada = true;
      else if (distancia < R_TRONCO + 0.05 && h.armada) {
        h.armada = false;
        if (alturaBuena && rapidez > VELOCIDAD_HACHAZO) hachazo(lado, h.mano);
        else ctx.vibrar(h.mano, 0.15, 20); // roce sin fuerza o fuera de la altura del corte
      }
    }
  }

  // ─── Ratón y pantalla táctil: la mitad de la pantalla elige el lado ────
  function raton(dt) {
    const r = ctx.raton;
    if (r.clic) {
      ladoRaton = r.ndc.x < 0 ? -1 : 1;
      golpeRaton = 0.18;
      hachaRaton.children[2].rotation.y = ladoRaton < 0 ? 0 : Math.PI;
      hachazo(ladoRaton, null);
    }
    golpeRaton = Math.max(0, golpeRaton - dt);
    // El hacha espera a un lado y, al golpear, barre hasta el tronco
    const u = golpeRaton > 0 ? Math.sin((1 - golpeRaton / 0.18) * Math.PI) : 0;
    const lado = ladoRaton;
    hachaRaton.visible = estado !== 'fin' || golpeRaton > 0;
    tmp.set(lado * (0.55 - u * 0.3), Y_CORTE - 0.05, Z_TRONCO + 0.5 - u * 0.25);
    hachaRaton.position.copy(tmp);
    hachaRaton.rotation.set(-0.1, lado * 0.25 * (1 - u), 0); // casi recta, con el filo hacia el tronco
  }

  function actualizarMarcador() {
    if (estado === 'fin') {
      marcador.escribir([
        { texto: ctx.t('partida.finPuntos', { n: puntos }), tam: 1.15, color: '#ffd23f' },
        { texto: mensaje, tam: 0.66, color: colorMensaje },
        { texto: nuevoRecord ? ctx.t('partida.nuevoRecord') : ctx.t('partida.record', { record }), tam: 0.58, color: nuevoRecord ? '#ffd23f' : '#cfd8dc' },
      ]);
      return;
    }
    if (estado === 'espera') {
      const intro = ctx.enVR() ? ctx.t('intro') : ctx.t(ctx.tactil ? 'introTactil' : 'introRaton');
      marcador.escribir([
        { texto: ctx.t('titulo'), tam: 1.2, color: '#ffd23f' },
        { texto: intro, tam: 0.6 },
        { texto: ctx.t('partida.record', { record }), tam: 0.56, color: '#cfd8dc' },
      ]);
      return;
    }
    marcador.escribir([
      { texto: ctx.t('marcador', { puntos }), tam: 1.2 },
      tiempoMensaje > 0
        ? { texto: mensaje, tam: 0.74, color: colorMensaje }
        : { texto: ctx.t('estado', { n: nivel() }), tam: 0.74, color: '#cfd8dc' },
    ]);
  }

  // ─── Bucle ─────────────────────────────────────────────────────────────
  let tiempo = 0;
  function actualizar(dt) {
    tiempo += dt;
    tiempoMensaje -= dt;
    if (estado === 'juego') {
      tiempoBarra -= vaciado() * dt;
      if (tiempoBarra <= 0) {
        tiempoBarra = 0;
        terminar('tiempo', 0);
      }
    } else if (estado === 'fin') {
      reloj -= dt;
      if (reloj <= 0) {
        estado = 'espera';
        tiempoBarra = 1;
        montarArbol();
      }
    }
    if (ctx.enVR()) {
      hachaRaton.visible = false;
      hachasVR(dt);
    } else {
      raton(dt);
    }
    animar(dt);
    actualizarMarcador();
  }

  function animar(dt) {
    // La pila baja con un pequeño rebote
    if (bajada !== 0) {
      bajada = Math.max(0, bajada - dt * 4.5);
    }
    temblor = Math.max(0, temblor - dt);
    colocarPila();
    // Trozos cortados volando
    for (let i = volando.length - 1; i >= 0; i--) {
      const { t } = volando[i];
      t.vida -= dt;
      t.vel.y -= 9.8 * dt;
      t.grupo.position.addScaledVector(t.vel, dt);
      t.grupo.rotation.x += t.giro.x * dt;
      t.grupo.rotation.y += t.giro.y * dt;
      t.grupo.rotation.z += t.giro.z * dt;
      if (t.grupo.position.y < ALTO_TROZO / 2) {
        t.grupo.position.y = ALTO_TROZO / 2;
        t.vel.multiplyScalar(0.4);
        t.vel.y = Math.abs(t.vel.y) * 0.5;
        t.giro.multiplyScalar(0.5);
      }
      if (t.vida <= 0) {
        t.grupo.visible = false;
        libres.push(t);
        volando.splice(i, 1);
      }
    }
    // Barra de tiempo: verde, amarilla y roja, y late cuando queda poco
    relleno.scale.x = Math.max(0.001, tiempoBarra);
    colorTmp.set(tiempoBarra > 0.5 ? 0x6dff7a : tiempoBarra > 0.25 ? 0xffd23f : 0xff3d3d);
    if (tiempoBarra <= 0.25 && estado === 'juego') colorTmp.multiplyScalar(0.7 + 0.3 * Math.sin(tiempo * 20));
    matRelleno.color.copy(colorTmp);
  }

  montarArbol();
  actualizarMarcador();

  return {
    actualizar,
    liberar() {},
  };
}
