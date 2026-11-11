// TORRE DE BLOQUES
// Una obra en lo alto de la ciudad: subes en el montacargas mientras levantas una torre.
// Un bloque se desliza de lado a lado por encima de la torre; suéltalo para que caiga
// justo encima del anterior. Lo que sobresale se corta y cae, así que cada fallo deja
// la torre más estrecha. Si el bloque no toca la torre, se acaba. Un bloque clavado
// («¡Perfecto!») no se corta, y cuatro seguidos lo hacen crecer un poco.
// 1 punto por bloque y 1 más si es perfecto.
// En VR llevas el mando de la grúa: gatillo para soltar. Sin gafas, clic o toque.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código.
export async function precargar() {}

const TORRE = new THREE.Vector3(0, 0, -0.78);   // centro de la torre (x, z)
const ALTO = 0.07;                                // alto de cada bloque
const LADO = 0.3;                                 // lado del bloque inicial
const ARRIBA = 1.02;                              // altura (respecto al jugador) a la que se mantiene la cima
const RECORRIDO = 0.46;                           // el bloque va de -RECORRIDO a +RECORRIDO
const PERFECTO = 0.008;                           // margen para clavarlo (m)
const MAX_BLOQUES = 160;
const N_CAIDAS = 8;

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (r) => ctx.recurso(r);

  ctx.fondo(0x8fc4ea, {
    nubes: 0.55, sol: [0.6, 0.45, -0.7], niebla: [30, 120],
    paisaje: { tipo: 'ciudad', color: 0x5b6f86, radio: 90 },
  });
  ctx.sueloBase(false);
  ctx.vistaEscritorio(new THREE.Vector3(0.3, 1.5, 0.15), new THREE.Vector3(0, 1.08, -0.78));

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

  // ─── El mundo (baja mientras el montacargas sube) ──────────────────────
  const mundo = new THREE.Group();
  raiz.add(mundo);
  // Solar de la obra: tierra y grava
  const suelo = new THREE.Mesh(
    R(new THREE.PlaneGeometry(80, 80)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.grano(0x9a8a72, { repetir: [40, 40], semilla: 41 })) })),
  );
  suelo.rotation.x = -Math.PI / 2;
  suelo.position.y = -0.02;
  mundo.add(suelo);
  // Edificios alrededor con ventanas
  const texVentanas = R(ctx.texturaCanvas((g, tam, azar) => {
    g.fillStyle = '#d9d2c5';
    g.fillRect(0, 0, tam, tam);
    for (let fy = 0; fy < 8; fy++) {
      for (let fx = 0; fx < 4; fx++) {
        g.fillStyle = azar() < 0.3 ? '#f4d58a' : '#5a7896';
        g.fillRect(fx * (tam / 4) + 8, fy * (tam / 8) + 6, tam / 4 - 16, tam / 8 - 12);
      }
    }
  }, { tam: 256, repetir: [1, 1], semilla: 42 }));
  const EDIFICIOS = [
    [-9, -14, 5, 18, 5], [-2, -20, 6, 26, 6], [7, -15, 5, 14, 5], [13, -6, 5, 22, 5], [-14, -4, 5, 12, 6],
    [-12, 9, 6, 16, 5], [11, 10, 5, 19, 6], [2, 16, 7, 11, 5],
  ];
  const geosEdificios = EDIFICIOS.map(([x, z, an, al, fo]) => {
    const g = new THREE.BoxGeometry(an, al, fo);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * an / 4, uv.getY(i) * al / 6);
    return colocar(g, x, al / 2, z);
  });
  const texEdif = texVentanas;
  texEdif.wrapS = texEdif.wrapT = THREE.RepeatWrapping;
  mundo.add(new THREE.Mesh(fusionar(geosEdificios), R(new THREE.MeshLambertMaterial({ map: texEdif }))));
  // Grúa amarilla detrás de la torre
  const grua = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(0.6, 16, 0.6), 4, 8, -9),
    colocar(new THREE.BoxGeometry(14, 0.5, 0.5), 1, 16.2, -9),
    colocar(new THREE.BoxGeometry(2, 1.2, 1.2), 7.2, 15.4, -9),
    colocar(new THREE.BoxGeometry(0.06, 6, 0.06), -4, 13, -9),
    colocar(new THREE.BoxGeometry(1.2, 0.3, 1.2), 4, 0.15, -9),
  ]), R(new THREE.MeshLambertMaterial({ color: 0xf2b632 })));
  mundo.add(grua);
  // Vallas, sacos y palés de la obra
  const obra = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(6, 1, 0.05), 0, 0.5, -4),
    colocar(new THREE.BoxGeometry(0.05, 1, 6), -3, 0.5, -1),
    colocar(new THREE.BoxGeometry(0.05, 1, 6), 3, 0.5, -1),
    colocar(new THREE.BoxGeometry(1.1, 0.14, 0.9), -2, 0.07, -3),
    colocar(new THREE.BoxGeometry(1.1, 0.14, 0.9), 2.1, 0.07, -2.8),
    colocar(new THREE.BoxGeometry(0.9, 0.5, 0.7), 2.1, 0.39, -2.8),
  ]), R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tablas(0xb9915c, { tablas: 6, semilla: 43 })) })));
  mundo.add(obra);
  mundo.add(ctx.arboles([{ x: -6, z: 5 }, { x: 6, z: 4, escala: 1.2 }, { x: -7, z: -6, escala: 0.9 }, { x: 8, z: -3 }], { tipo: 'frondoso' }));

  // Cimiento de hormigón de la torre
  const BASE = ARRIBA - 0.02;
  const cimiento = new THREE.Mesh(
    R(new THREE.BoxGeometry(LADO + 0.1, BASE, LADO + 0.1)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.grano(0x9c9c98, { repetir: [1, 3], semilla: 44 })) })),
  );
  cimiento.position.set(TORRE.x, BASE / 2, TORRE.z);
  mundo.add(cimiento);
  const sombraCimiento = ctx.crearSombra({ radio: 0.4, opacidad: 0.5 });
  sombraCimiento.position.set(TORRE.x, 0, TORRE.z);
  mundo.add(sombraCimiento);

  // ─── El montacargas (va con el jugador) ────────────────────────────────
  const texChapa = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#6b7079';
    g.fillRect(0, 0, tam, tam);
    g.strokeStyle = '#8a909a';
    g.lineWidth = 3;
    for (let i = -tam; i < tam * 2; i += 16) {
      g.beginPath(); g.moveTo(i, 0); g.lineTo(i + 8, 8); g.stroke();
      g.beginPath(); g.moveTo(i + 8, 16); g.lineTo(i, 24); g.stroke();
    }
  }, { tam: 128, repetir: [4, 4], semilla: 45 }));
  const plataforma = new THREE.Mesh(
    fusionar([colocar(new THREE.BoxGeometry(1.7, 0.08, 1.4), 0, -0.04, 0.25)]),
    R(new THREE.MeshLambertMaterial({ map: texChapa })),
  );
  raiz.add(plataforma);
  const barandilla = new THREE.Mesh(fusionar([
    colocar(new THREE.CylinderGeometry(0.02, 0.02, 1.7, 8), 0, 0.82, -0.45, 0, 0, Math.PI / 2),
    colocar(new THREE.CylinderGeometry(0.02, 0.02, 1.7, 8), 0, 1.05, 0.95, 0, 0, Math.PI / 2),
    colocar(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 8), -0.85, 1.05, 0.25, Math.PI / 2),
    colocar(new THREE.CylinderGeometry(0.02, 0.02, 1.4, 8), 0.85, 1.05, 0.25, Math.PI / 2),
    ...[[-0.85, -0.45], [0.85, -0.45], [-0.85, 0.95], [0.85, 0.95]].map(([x, z]) => colocar(new THREE.CylinderGeometry(0.025, 0.025, 1.05, 8), x, 0.525, z)),
    colocar(new THREE.BoxGeometry(1.7, 0.12, 0.02), 0, 0.06, -0.45),
  ]), R(new THREE.MeshLambertMaterial({ color: 0xf2b632 })));
  raiz.add(barandilla);
  // Bajo la plataforma, una mancha oscura para que no parezca que flota
  const bajos = new THREE.Mesh(R(new THREE.BoxGeometry(1.66, 0.25, 1.36)), R(new THREE.MeshLambertMaterial({ color: 0x3b3f46 })));
  bajos.position.set(0, -0.2, 0.25);
  raiz.add(bajos);

  // ─── Bloques ───────────────────────────────────────────────────────────
  const geoBloque = R(new THREE.BoxGeometry(1, 1, 1));
  // Bloque liso con el canto más claro, para que cada pieza se lea en la torre
  const texBloque = R(ctx.texturaCanvas((g, tam, azar) => {
    g.fillStyle = '#e9e9e9';
    g.fillRect(0, 0, tam, tam);
    for (let i = 0; i < 260; i++) {
      g.fillStyle = azar() < 0.5 ? 'rgba(255,255,255,0.18)' : 'rgba(0,0,0,0.05)';
      g.fillRect(azar() * tam, azar() * tam, 2, 2);
    }
    g.strokeStyle = '#ffffff';
    g.lineWidth = tam * 0.07;
    g.strokeRect(0, 0, tam, tam);
  }, { tam: 128, repetir: [1, 1], semilla: 46 }));
  const matBloque = R(new THREE.MeshLambertMaterial({ map: texBloque }));
  const torre = new THREE.InstancedMesh(geoBloque, matBloque, MAX_BLOQUES);
  torre.frustumCulled = false;
  // Los colores por bloque se crean ya (así el material se compila con ellos al montar el juego)
  for (let i = 0; i < MAX_BLOQUES; i++) torre.setColorAt(i, new THREE.Color(0xffffff));
  torre.count = 0;
  mundo.add(torre);
  const matMovil = R(new THREE.MeshStandardMaterial({ map: texBloque, roughness: 0.6, emissive: 0x000000 }));
  const movil = new THREE.Mesh(geoBloque, matMovil);
  mundo.add(movil);
  const sombraMovil = ctx.crearSombra({ radio: 0.22, opacidad: 0.35 });
  mundo.add(sombraMovil);
  // Trozos que se cortan y caen
  const caidas = Array.from({ length: N_CAIDAS }, () => {
    const malla = new THREE.Mesh(geoBloque, R(new THREE.MeshLambertMaterial({ map: texBloque })));
    malla.visible = false;
    mundo.add(malla);
    return { malla, vel: new THREE.Vector3(), giro: new THREE.Vector3(), vida: 0 };
  });
  let siguienteCaida = 0;

  // ─── Mando de la grúa (en cada mano) ───────────────────────────────────
  const matCuerpo = R(new THREE.MeshStandardMaterial({ color: 0xf2b632, roughness: 0.45 }));
  const matGoma = R(new THREE.MeshStandardMaterial({ color: 0x2a2c31, roughness: 0.9 }));
  const matBoton = R(new THREE.MeshStandardMaterial({ color: 0xff6a3d, roughness: 0.35, emissive: 0xff6a3d, emissiveIntensity: 0.15 }));
  const geoCuerpo = R(new THREE.CapsuleGeometry(0.028, 0.1, 6, 14));
  const geoAgarre = R(new THREE.CapsuleGeometry(0.03, 0.05, 6, 14));
  const geoBoton = R(new THREE.CylinderGeometry(0.017, 0.019, 0.016, 20));
  const geoAntena = R(fusionar([
    colocar(new THREE.CylinderGeometry(0.003, 0.004, 0.09, 8), 0, 0.045, 0),
    colocar(new THREE.SphereGeometry(0.008, 10, 8), 0, 0.093, 0),
  ]));
  const mandos = ctx.manos.map((mano) => {
    const g = new THREE.Group();
    const cuerpo = new THREE.Mesh(geoCuerpo, matCuerpo);
    cuerpo.rotation.x = -Math.PI / 2;
    cuerpo.position.set(0, 0.0, -0.06);
    cuerpo.scale.set(1.15, 1, 0.75);
    const agarre = new THREE.Mesh(geoAgarre, matGoma);
    agarre.rotation.x = -Math.PI / 2;
    agarre.position.set(0, -0.006, 0.0);
    const boton = new THREE.Mesh(geoBoton, matBoton);
    boton.position.set(0, 0.026, -0.085);
    const antena = new THREE.Mesh(geoAntena, matGoma);
    antena.position.set(0.016, 0.012, -0.125);
    antena.rotation.x = -0.5;
    g.add(cuerpo, agarre, boton, antena);
    ctx.adjuntarAMano(mano, g);
    return { mano, boton, hundido: 0 };
  });

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.0, alto: 0.3 });
  marcador.mesh.position.set(0, 1.4, -1.7);
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  // Cada bloque: centro (x, z) y tamaño (ancho en x, fondo en z)
  const pila = [];
  const actualB = { x: 0, z: 0, ax: LADO, az: LADO, eje: 'x', fase: 0 };
  let estado = 'intro'; // 'intro' | 'juego' | 'fin'
  let reloj = 3;
  let puntos = 0;
  let record = ctx.leer('record', 0);
  let racha = 0;
  let subida = 0;           // lo que ha bajado el mundo
  let subidaObjetivo = 0;
  let velocidad = 0.55;     // m/s del bloque que se desliza
  let rebote = 0;           // pequeño rebote del bloque recién puesto
  let aviso = '';
  let tiempoAviso = 0;

  const colorTmp = new THREE.Color();
  const posTmp = new THREE.Vector3();
  const escTmp = new THREE.Vector3();
  const quatUno = new THREE.Quaternion();
  const punto = new THREE.Vector3();

  const colorDe = (n, destino) => destino.setHSL((0.02 + n * 0.035) % 1, 0.62, 0.58);
  const yDe = (n) => BASE + ALTO / 2 + n * ALTO;

  function ponerEnTorre(i) {
    const b = pila[i];
    matrizTmp.compose(posTmp.set(TORRE.x + b.x, yDe(i), TORRE.z + b.z), quatUno, escTmp.set(b.ax, ALTO, b.az));
    torre.setMatrixAt(i, matrizTmp);
    torre.setColorAt(i, colorDe(i, colorTmp));
    torre.count = Math.max(torre.count, i + 1);
    torre.instanceMatrix.needsUpdate = true;
    if (torre.instanceColor) torre.instanceColor.needsUpdate = true;
  }

  function nuevoBloque() {
    const arriba = pila[pila.length - 1];
    actualB.ax = arriba.ax;
    actualB.az = arriba.az;
    actualB.eje = pila.length % 2 ? 'x' : 'z';
    actualB.fase = Math.random() < 0.5 ? -Math.PI / 2 : Math.PI / 2; // empieza en un extremo
    actualB.x = arriba.x;
    actualB.z = arriba.z;
    matMovil.color.copy(colorDe(pila.length, colorTmp));
    movil.visible = true;
  }

  function empezarPartida() {
    pila.length = 0;
    torre.count = 0;
    pila.push({ x: 0, z: 0, ax: LADO, az: LADO });
    ponerEnTorre(0);
    puntos = 0;
    racha = 0;
    velocidad = 0.55;
    subidaObjetivo = 0;
    estado = 'juego';
    nuevoBloque();
  }

  function soltarTrozo(x, z, ax, az, y, empuje) {
    const c = caidas[siguienteCaida];
    siguienteCaida = (siguienteCaida + 1) % N_CAIDAS;
    c.malla.position.set(TORRE.x + x, y, TORRE.z + z);
    c.malla.scale.set(ax, ALTO, az);
    c.malla.rotation.set(0, 0, 0);
    c.malla.material.color.copy(matMovil.color);
    c.malla.visible = true;
    c.vel.set(empuje.x, 0.2, empuje.z);
    c.giro.set(empuje.z * 6, 0, -empuje.x * 6);
    c.vida = 3;
  }

  function terminar() {
    estado = 'fin';
    reloj = 5;
    movil.visible = false;
    ctx.sonido('caida');
    ctx.vibrar(ctx.manos[0], 0.7, 200);
    ctx.vibrar(ctx.manos[1], 0.7, 200);
    ctx.puntuacion(puntos); // a la clasificación (juegos/marcadores.js)
    if (puntos > record) {
      record = puntos;
      ctx.guardar('record', record);
    }
  }

  function mostrarAviso(texto) {
    aviso = texto;
    tiempoAviso = 1.2;
  }

  // Suelta el bloque que se desliza
  function soltar(mano) {
    if (estado !== 'juego') return;
    const abajo = pila[pila.length - 1];
    const eje = actualB.eje;
    const lado = eje === 'x' ? 'ax' : 'az';
    const delta = actualB[eje] - abajo[eje];
    const solape = abajo[lado] - Math.abs(delta);
    const y = yDe(pila.length);
    punto.set(TORRE.x + actualB.x, y + ALTO / 2 - subida, TORRE.z + actualB.z);
    if (solape <= 0) {
      // No toca la torre: cae entero
      soltarTrozo(actualB.x, actualB.z, actualB.ax, actualB.az, y, posTmp.set(eje === 'x' ? Math.sign(delta) * 0.3 : 0, 0, eje === 'z' ? Math.sign(delta) * 0.3 : 0));
      mostrarAviso(ctx.t('fuera'));
      terminar();
      return;
    }
    const nuevo = { x: actualB.x, z: actualB.z, ax: actualB.ax, az: actualB.az };
    let perfecto = false;
    if (Math.abs(delta) <= PERFECTO) {
      perfecto = true;
      nuevo[eje] = abajo[eje];
      racha += 1;
      // Cuatro perfectos seguidos: el bloque crece un poco (sin pasar del tamaño inicial)
      if (racha >= 4) {
        nuevo.ax = Math.min(LADO, nuevo.ax + 0.012);
        nuevo.az = Math.min(LADO, nuevo.az + 0.012);
      }
    } else {
      racha = 0;
      nuevo[lado] = solape;
      nuevo[eje] = abajo[eje] + delta / 2;
      // El trozo que sobresale, al otro lado
      const s = Math.sign(delta);
      const corte = Math.abs(delta);
      const tx = eje === 'x' ? nuevo.x + s * (solape / 2 + corte / 2) : actualB.x;
      const tz = eje === 'z' ? nuevo.z + s * (solape / 2 + corte / 2) : actualB.z;
      soltarTrozo(tx, tz, eje === 'x' ? corte : actualB.ax, eje === 'z' ? corte : actualB.az, y, posTmp.set(eje === 'x' ? s * 0.25 : 0, 0, eje === 'z' ? s * 0.25 : 0));
    }
    pila.push(nuevo);
    ponerEnTorre(pila.length - 1);
    const suma = perfecto ? 2 : 1;
    puntos += suma;
    rebote = 1;
    velocidad = Math.min(1.5, velocidad + 0.022);
    subidaObjetivo = Math.max(0, (pila.length - 1) * ALTO - 0.02);
    if (perfecto) {
      const grande = racha > 0 && racha % 5 === 0;
      ctx.efectos.impacto(grande ? 'grande' : 'medio', { pos: punto, mano, color: 0xffe08a, sonido: 'anillo' });
      ctx.efectos.texto(punto, `+${suma}`, { color: '#ffe08a', tam: 1.1 });
      mostrarAviso(racha >= 2 ? ctx.t('perfectoRacha', { n: racha }) : ctx.t('perfecto'));
    } else {
      ctx.efectos.impacto('pequeño', { pos: punto, mano, color: matMovil.color.getHex(), sonido: 'toc' });
      ctx.efectos.texto(punto, '+1', { color: '#ffffff', tam: 0.8 });
      if (solape < 0.06) mostrarAviso(ctx.t('estrecho'));
    }
    nuevoBloque();
  }

  function actualizarMarcador() {
    if (estado === 'intro') {
      const intro = ctx.enVR() ? ctx.t('intro') : ctx.t(ctx.tactil ? 'introTactil' : 'introRaton');
      marcador.escribir([
        { texto: ctx.t('titulo'), tam: 1.3, color: '#ffd27a' },
        { texto: intro, tam: 0.72 },
      ]);
    } else if (estado === 'fin') {
      marcador.escribir([
        { texto: ctx.t('fin', { n: pila.length - 1, puntos }), tam: 1.15, color: '#ffd27a' },
        { texto: ctx.t('partida.recordNuevaPartida', { record, n: Math.max(1, Math.ceil(reloj)) }), tam: 0.72 },
      ]);
    } else {
      marcador.escribir([
        { texto: ctx.t('marcador', { n: pila.length - 1, puntos }), tam: 1.2 },
        { texto: tiempoAviso > 0 ? aviso : ctx.t('partida.record', { record }), tam: 0.8, color: tiempoAviso > 0 ? '#ffe08a' : '#cfd8dc' },
      ]);
    }
  }

  // ─── Bucle ─────────────────────────────────────────────────────────────
  function actualizar(dt) {
    reloj -= dt;
    tiempoAviso -= dt;
    if (estado === 'intro' && reloj <= 0) empezarPartida();
    else if (estado === 'fin' && reloj <= 0) empezarPartida();

    // Entrada: gatillo de cualquier mano, clic o toque
    let quien = null;
    let pulsa = false;
    if (ctx.enVR()) {
      for (const m of mandos) {
        if (m.mano.gatilloPulsado) {
          pulsa = true;
          quien = m.mano;
          m.hundido = 0.12;
        }
      }
    } else if (ctx.raton.clic) {
      pulsa = true;
    }
    for (const m of mandos) {
      m.hundido = Math.max(0, m.hundido - dt);
      m.boton.position.y = m.hundido > 0 ? 0.019 : 0.026;
    }
    if (pulsa) soltar(quien);

    // El bloque se desliza de un lado a otro, cada vez más rápido
    if (estado === 'juego') {
      const abajo = pila[pila.length - 1];
      actualB.fase += dt * velocidad / RECORRIDO * 1.6;
      const desp = Math.sin(actualB.fase) * RECORRIDO;
      actualB.x = actualB.eje === 'x' ? abajo.x + desp : abajo.x;
      actualB.z = actualB.eje === 'z' ? abajo.z + desp : abajo.z;
      const y = yDe(pila.length) + 0.012;
      movil.position.set(TORRE.x + actualB.x, y, TORRE.z + actualB.z);
      movil.scale.set(actualB.ax, ALTO, actualB.az);
      sombraMovil.position.set(movil.position.x, yDe(pila.length - 1) + ALTO / 2 + 0.002, movil.position.z);
      sombraMovil.scale.setScalar(Math.max(actualB.ax, actualB.az) / 0.3);
      sombraMovil.visible = true;
      // Brillo suave para que destaque
      matMovil.emissive.copy(matMovil.color).multiplyScalar(0.12 + 0.06 * Math.sin(actualB.fase * 2));
    } else {
      sombraMovil.visible = false;
    }

    // El último bloque puesto rebota un poco (sobrepaso)
    if (rebote > 0 && pila.length > 1) {
      rebote = Math.max(0, rebote - dt * 4);
      const i = pila.length - 1;
      const b = pila[i];
      const s = 1 + Math.sin(rebote * Math.PI) * 0.06;
      matrizTmp.compose(posTmp.set(TORRE.x + b.x, yDe(i), TORRE.z + b.z), quatUno, escTmp.set(b.ax * s, ALTO / s, b.az * s));
      torre.setMatrixAt(i, matrizTmp);
      torre.instanceMatrix.needsUpdate = true;
    }

    // El montacargas sube suave (el mundo baja)
    subida += (subidaObjetivo - subida) * Math.min(1, dt * 2.5);
    if (estado === 'fin' && reloj < 1.2) subidaObjetivo = 0; // vuelve abajo para la siguiente
    mundo.position.y = -subida;

    // Trozos que caen
    for (const c of caidas) {
      if (c.vida <= 0) continue;
      c.vida -= dt;
      c.vel.y -= 9.8 * dt;
      c.malla.position.addScaledVector(c.vel, dt);
      c.malla.rotation.x += c.giro.x * dt;
      c.malla.rotation.z += c.giro.z * dt;
      if (c.vida <= 0 || c.malla.position.y < -2) {
        c.vida = 0;
        c.malla.visible = false;
      }
    }
    actualizarMarcador();
  }

  movil.visible = false;
  actualizarMarcador();

  return {
    actualizar,
    liberar() {},
  };
}
