// ATRAPA HUEVOS
// Un gallinero en una granja. Las gallinas del estante ponen huevos que caen: cógelos con
// las cestas antes de que se rompan contra el suelo. Antes de soltar uno, la gallina se
// agita y cacarea, así que se ve venir. El huevo dorado vale 5 y el podrido no hay que
// cogerlo. Cada huevo roto o podrido cogido quita una vida (hay 3). Cada vez más rápido.
// 1 punto por huevo y 5 el dorado.
// En VR llevas una cesta colgando de cada mano; sin gafas, la cesta sigue al ratón o al dedo.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código.
export async function precargar() {}

const ESTANTE_Y = 1.86;          // altura a la que están las gallinas
const ESTANTE_Z = -0.8;
const GALLINAS_X = [-0.72, -0.36, 0, 0.36, 0.72];
const R_CESTA = 0.13;            // radio de la boca de la cesta
const BAJO_MANO = 0.15;          // la cesta cuelga por debajo de la mano
const N_HUEVOS = 10;
const N_MANCHAS = 6;
const VIDAS = 3;

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (r) => ctx.recurso(r);

  ctx.fondo(0x9fd3f0, {
    nubes: 0.5, sol: [-0.5, 0.5, -0.7], niebla: [25, 90],
    paisaje: { tipo: 'colinas', color: 0x6f9a52, radio: 70 },
  });
  ctx.sueloBase(false);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.4, 1.15), new THREE.Vector3(0, 1.45, -0.8));

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

  // ─── La granja ─────────────────────────────────────────────────────────
  const suelo = new THREE.Mesh(
    R(new THREE.PlaneGeometry(60, 60)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.cesped(0x6aa84f, { repetir: [30, 30], semilla: 51 })) })),
  );
  suelo.rotation.x = -Math.PI / 2;
  raiz.add(suelo);
  // Paja bajo el estante (donde caen los huevos)
  const paja = new THREE.Mesh(
    R(new THREE.CircleGeometry(1.3, 32)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.grano(0xd9b65a, { repetir: [3, 3], semilla: 52 })) })),
  );
  paja.rotation.x = -Math.PI / 2;
  paja.position.set(0, 0.004, -0.5);
  raiz.add(paja);
  // Gallinero: pared de tablas, tejadillo y estante con nidos
  const matTablas = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tablas(0xb0703e, { tablas: 10, semilla: 53 })) }));
  const pared = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(2.6, 2.6, 0.08), 0, 1.3, ESTANTE_Z - 0.32),
    colocar(new THREE.BoxGeometry(2.0, 0.05, 0.42), 0, ESTANTE_Y - 0.05, ESTANTE_Z - 0.1),
    colocar(new THREE.BoxGeometry(0.08, ESTANTE_Y, 0.08), -0.98, ESTANTE_Y / 2 - 0.05, ESTANTE_Z + 0.06),
    colocar(new THREE.BoxGeometry(0.08, ESTANTE_Y, 0.08), 0.98, ESTANTE_Y / 2 - 0.05, ESTANTE_Z + 0.06),
    ...GALLINAS_X.flatMap((x) => [
      colocar(new THREE.BoxGeometry(0.3, 0.03, 0.34), x, ESTANTE_Y - 0.01, ESTANTE_Z - 0.1),
      colocar(new THREE.BoxGeometry(0.02, 0.22, 0.34), x - 0.16, ESTANTE_Y + 0.08, ESTANTE_Z - 0.1),
    ]),
    colocar(new THREE.BoxGeometry(0.02, 0.22, 0.34), 0.88, ESTANTE_Y + 0.08, ESTANTE_Z - 0.1),
  ]), matTablas);
  raiz.add(pared);
  const tejado = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(2.9, 0.06, 1.0), 0, 2.72, ESTANTE_Z - 0.05, 0.35),
  ]), R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tablas(0x9a3b2c, { tablas: 14, semilla: 54 })) })));
  raiz.add(tejado);
  // Nidos de paja (uno por gallina)
  const geoNido = R(new THREE.TorusGeometry(0.1, 0.045, 8, 18));
  geoNido.rotateX(Math.PI / 2);
  const nidos = new THREE.InstancedMesh(geoNido, R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.grano(0xd9b65a, { tam: 128, semilla: 55 })) })), GALLINAS_X.length);
  GALLINAS_X.forEach((x, i) => nidos.setMatrixAt(i, matrizTmp.makeTranslation(x, ESTANTE_Y + 0.03, ESTANTE_Z - 0.08)));
  raiz.add(nidos);
  // Balas de paja, valla y árboles
  const balas = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(0.9, 0.45, 0.5), -1.6, 0.225, -0.6, 0, 0.3),
    colocar(new THREE.BoxGeometry(0.9, 0.45, 0.5), -1.75, 0.675, -0.7, 0, 0.2),
    colocar(new THREE.BoxGeometry(0.9, 0.45, 0.5), 1.7, 0.225, -0.4, 0, -0.4),
  ]), R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.grano(0xd8b45c, { repetir: [2, 1], semilla: 56 })) })));
  raiz.add(balas);
  const vallaGeos = [];
  for (let i = -6; i <= 6; i++) vallaGeos.push(colocar(new THREE.BoxGeometry(0.08, 0.9, 0.08), i * 0.9, 0.45, -4.5));
  vallaGeos.push(colocar(new THREE.BoxGeometry(11, 0.1, 0.04), 0, 0.7, -4.5), colocar(new THREE.BoxGeometry(11, 0.1, 0.04), 0, 0.35, -4.5));
  raiz.add(new THREE.Mesh(fusionar(vallaGeos), R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.madera(0xd6c3a0, { semilla: 57 })) }))));
  raiz.add(ctx.arboles([{ x: -5, z: -7, escala: 1.3 }, { x: 4.5, z: -8 }, { x: 7, z: -3, escala: 1.1 }, { x: -7, z: -2 }, { x: 2, z: -12, escala: 1.4 }], { tipo: 'frondoso' }));
  for (const [x, z, r] of [[-1.6, -0.6, 0.6], [1.7, -0.4, 0.5]]) {
    const s = ctx.crearSombra({ radio: r, opacidad: 0.4 });
    s.position.set(x, 0.006, z);
    raiz.add(s);
  }

  // ─── Gallinas ──────────────────────────────────────────────────────────
  const geoCuerpo = R(fusionar([
    colocar(new THREE.SphereGeometry(0.1, 16, 12), 0, 0.09, 0),
    colocar(new THREE.SphereGeometry(0.058, 14, 10), 0, 0.2, 0.07),
    colocar(new THREE.ConeGeometry(0.06, 0.12, 10), 0, 0.17, -0.11, -0.9),
    colocar(new THREE.SphereGeometry(0.05, 10, 8), 0.085, 0.1, -0.01),
    colocar(new THREE.SphereGeometry(0.05, 10, 8), -0.085, 0.1, -0.01),
  ]));
  const geoCresta = R(fusionar([
    colocar(new THREE.SphereGeometry(0.018, 8, 6), 0, 0.262, 0.07),
    colocar(new THREE.SphereGeometry(0.016, 8, 6), 0, 0.258, 0.042),
    colocar(new THREE.SphereGeometry(0.015, 8, 6), 0, 0.255, 0.097),
    colocar(new THREE.SphereGeometry(0.014, 8, 6), 0, 0.165, 0.123),
  ]));
  const geoPico = R(fusionar([
    colocar(new THREE.ConeGeometry(0.016, 0.04, 8), 0, 0.2, 0.135, Math.PI / 2),
    colocar(new THREE.SphereGeometry(0.008, 6, 6), 0.026, 0.215, 0.115),
    colocar(new THREE.SphereGeometry(0.008, 6, 6), -0.026, 0.215, 0.115),
  ]));
  const matPluma = R(new THREE.MeshLambertMaterial({ color: 0xf6f1e6 }));
  const matPlumaMarron = R(new THREE.MeshLambertMaterial({ color: 0xb8692e }));
  const matCresta = R(new THREE.MeshLambertMaterial({ color: 0xd82a2a }));
  const matPico = R(new THREE.MeshLambertMaterial({ color: 0xf2a22c }));
  const gallinas = GALLINAS_X.map((x, i) => {
    const g = new THREE.Group();
    g.add(new THREE.Mesh(geoCuerpo, i % 2 ? matPlumaMarron : matPluma), new THREE.Mesh(geoCresta, matCresta), new THREE.Mesh(geoPico, matPico));
    g.position.set(x, ESTANTE_Y + 0.02, ESTANTE_Z - 0.08);
    g.rotation.y = (Math.random() - 0.5) * 0.4;
    raiz.add(g);
    return { grupo: g, x, aviso: 0, tipo: 'normal', giroBase: g.rotation.y };
  });

  // ─── Huevos ────────────────────────────────────────────────────────────
  const perfilHuevo = [];
  for (let i = 0; i <= 12; i++) {
    const a = (i / 12) * Math.PI;
    const r = Math.sin(a) * 0.032 * (1 - 0.18 * Math.cos(a));
    perfilHuevo.push(new THREE.Vector2(Math.max(0.0001, r), -Math.cos(a) * 0.043));
  }
  const geoHuevo = R(new THREE.LatheGeometry(perfilHuevo, 18));
  const MATS = {
    normal: R(new THREE.MeshStandardMaterial({ color: 0xf7ecd9, roughness: 0.55 })),
    dorado: R(new THREE.MeshStandardMaterial({ color: 0xffc83a, roughness: 0.25, metalness: 0.7, emissive: 0x6a4400, emissiveIntensity: 0.5 })),
    podrido: R(new THREE.MeshStandardMaterial({ color: 0x7d8a3a, roughness: 0.9, emissive: 0x1c2400 })),
  };
  const huevos = Array.from({ length: N_HUEVOS }, () => {
    const malla = new THREE.Mesh(geoHuevo, MATS.normal);
    malla.visible = false;
    raiz.add(malla);
    const sombra = ctx.crearSombra({ radio: 0.05, opacidad: 0.35 });
    sombra.visible = false;
    raiz.add(sombra);
    return { malla, sombra, activo: false, tipo: 'normal', vel: new THREE.Vector3(), antes: new THREE.Vector3(), giro: 0 };
  });
  // Manchas de huevo roto en el suelo
  const texMancha = R(ctx.texturaCanvas((g, tam) => {
    g.clearRect(0, 0, tam, tam);
    g.fillStyle = 'rgba(255,255,240,0.92)';
    g.beginPath();
    for (let i = 0; i <= 14; i++) {
      const a = (i / 14) * Math.PI * 2;
      const r = tam * (0.32 + 0.12 * Math.sin(i * 2.7));
      g.lineTo(tam / 2 + Math.cos(a) * r, tam / 2 + Math.sin(a) * r);
    }
    g.fill();
    g.fillStyle = '#ffb21e';
    g.beginPath();
    g.arc(tam / 2, tam / 2, tam * 0.14, 0, Math.PI * 2);
    g.fill();
  }, { tam: 128 }));
  const geoMancha = R(new THREE.PlaneGeometry(0.2, 0.2));
  geoMancha.rotateX(-Math.PI / 2);
  const manchas = Array.from({ length: N_MANCHAS }, () => {
    const m = new THREE.Mesh(geoMancha, R(new THREE.MeshBasicMaterial({ map: texMancha, transparent: true, depthWrite: false })));
    m.visible = false;
    raiz.add(m);
    return { malla: m, vida: 0 };
  });
  let siguienteMancha = 0;

  // ─── Cestas ────────────────────────────────────────────────────────────
  const texMimbre = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#8a5a2b';
    g.fillRect(0, 0, tam, tam);
    const paso = tam / 8;
    for (let y = 0; y < 8; y++) {
      for (let x = 0; x < 8; x++) {
        const encima = (x + y) % 2 === 0;
        g.fillStyle = encima ? '#c99556' : '#a8723c';
        g.beginPath();
        g.ellipse(x * paso + paso / 2, y * paso + paso / 2, paso * 0.48, paso * 0.32, 0, 0, Math.PI * 2);
        g.fill();
      }
    }
  }, { tam: 128, repetir: [4, 2] }));
  const perfilCesta = [
    new THREE.Vector2(0.0001, -0.07), new THREE.Vector2(0.085, -0.07), new THREE.Vector2(0.105, -0.05),
    new THREE.Vector2(0.12, 0.0), new THREE.Vector2(R_CESTA, 0.05), new THREE.Vector2(R_CESTA + 0.012, 0.058),
    new THREE.Vector2(R_CESTA - 0.006, 0.062), new THREE.Vector2(0.11, 0.0), new THREE.Vector2(0.09, -0.055), new THREE.Vector2(0.0001, -0.058),
  ];
  const geoCesta = R(new THREE.LatheGeometry(perfilCesta, 24));
  const matCesta = R(new THREE.MeshStandardMaterial({ map: texMimbre, roughness: 0.85, side: THREE.DoubleSide }));
  const geoAsa = R(new THREE.TorusGeometry(R_CESTA - 0.01, 0.009, 8, 24, Math.PI));
  const geoBorde = R(new THREE.TorusGeometry(R_CESTA + 0.004, 0.011, 8, 28));
  geoBorde.rotateX(Math.PI / 2);
  const matBorde = R(new THREE.MeshStandardMaterial({ color: 0x6b4220, roughness: 0.8 }));
  const geoPanuelo = R(new THREE.CircleGeometry(R_CESTA - 0.02, 20));
  geoPanuelo.rotateX(-Math.PI / 2);
  const matPanuelo = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, tam, tam);
    g.fillStyle = '#ff6a3d';
    for (let i = 0; i < 8; i += 2) {
      g.fillRect(i * tam / 8, 0, tam / 8, tam);
      g.fillRect(0, i * tam / 8, tam, tam / 8);
    }
  }, { tam: 64 })) }));
  function crearCesta() {
    const g = new THREE.Group();
    const cuerpo = new THREE.Mesh(geoCesta, matCesta);
    const borde = new THREE.Mesh(geoBorde, matBorde);
    borde.position.y = 0.058;
    const asa = new THREE.Mesh(geoAsa, matBorde);
    asa.position.y = 0.058;
    const panuelo = new THREE.Mesh(geoPanuelo, matPanuelo);
    panuelo.position.y = -0.045;
    g.add(cuerpo, borde, asa, panuelo);
    raiz.add(g);
    const sombra = ctx.crearSombra({ radio: 0.14, opacidad: 0.3 });
    raiz.add(sombra);
    return { grupo: g, sombra, centro: new THREE.Vector3(), balanceo: 0, velX: 0, antesX: 0 };
  }
  const cestas = ctx.manos.map((mano) => ({ mano, ...crearCesta() }));
  const cestaRaton = crearCesta();

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.0, alto: 0.3 });
  marcador.mesh.position.set(0, 2.22, ESTANTE_Z - 0.15);
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'juego' | 'fin'
  let reloj = 3;
  let puntos = 0;
  let vidas = VIDAS;
  let record = ctx.leer('record', 0);
  let tiempoJuego = 0;
  let proximo = 1.5;
  let aviso = '';
  let tiempoAviso = 0;
  const tmp = new THREE.Vector3();
  const Z_CAIDA = -0.55; // los huevos caen más o menos a esta distancia (la cesta del ratón va aquí)
  const plano = new THREE.Plane(new THREE.Vector3(0, 0, 1), -Z_CAIDA);

  const gravedad = () => 3.2 + Math.min(3.2, tiempoJuego * 0.035);
  const intervalo = () => Math.max(0.5, 1.5 - tiempoJuego * 0.012);

  function empezar() {
    puntos = 0;
    vidas = VIDAS;
    tiempoJuego = 0;
    proximo = 1.2;
    estado = 'juego';
    for (const h of huevos) {
      h.activo = false;
      h.malla.visible = h.sombra.visible = false;
    }
  }

  function terminar() {
    estado = 'fin';
    reloj = 5;
    ctx.sonido('fallo');
    ctx.puntuacion(puntos); // a la clasificación (juegos/marcadores.js)
    if (puntos > record) {
      record = puntos;
      ctx.guardar('record', record);
    }
  }

  function perderVida(pos, mano, texto) {
    vidas -= 1;
    aviso = texto;
    tiempoAviso = 1.3;
    ctx.efectos.impacto('grande', { pos, mano, color: 0x9a8a3a, sonido: 'podrido' });
    if (vidas <= 0) terminar();
  }

  // Una gallina se prepara para poner (se agita un momento antes)
  function anunciar() {
    const libres = gallinas.filter((g) => g.aviso <= 0);
    if (!libres.length) return;
    const g = libres[Math.floor(Math.random() * libres.length)];
    const r = Math.random();
    g.tipo = r < 0.08 ? 'dorado' : r < 0.08 + Math.min(0.18, tiempoJuego * 0.004) ? 'podrido' : 'normal';
    g.aviso = 0.75;
    ctx.sonido('cuac');
  }

  function poner(g) {
    const h = huevos.find((x) => !x.activo);
    if (!h) return;
    h.activo = true;
    h.tipo = g.tipo;
    h.malla.material = MATS[g.tipo];
    h.malla.visible = h.sombra.visible = true;
    h.malla.position.set(g.x, ESTANTE_Y + 0.02, ESTANTE_Z + 0.08);
    h.malla.rotation.set(0, 0, 0);
    h.vel.set((Math.random() - 0.5) * 0.12, 0.3, 0.18 + Math.random() * 0.06);
    h.giro = (Math.random() - 0.5) * 6;
    h.antes.copy(h.malla.position);
  }

  function romper(h) {
    h.activo = false;
    h.malla.visible = h.sombra.visible = false;
    const m = manchas[siguienteMancha];
    siguienteMancha = (siguienteMancha + 1) % N_MANCHAS;
    m.malla.position.set(h.malla.position.x, 0.008 + siguienteMancha * 0.001, h.malla.position.z);
    m.malla.rotation.y = Math.random() * 6;
    m.malla.visible = true;
    m.malla.material.opacity = 1;
    m.vida = 4;
    tmp.set(h.malla.position.x, 0.05, h.malla.position.z);
    if (h.tipo === 'podrido') {
      // Dejar caer el podrido está bien
      ctx.efectos.estallido(tmp, { color: 0x7d8a3a, cantidad: 8 });
      ctx.sonido('plaf');
      return;
    }
    ctx.sonido('cubo');
    perderVida(tmp, null, ctx.t('roto'));
  }

  // ¿Ha entrado el huevo por la boca de la cesta en este fotograma?
  function atrapado(h, c) {
    const boca = c.centro.y + 0.05;
    const p = h.malla.position;
    if (!(h.antes.y >= boca - 0.01 && p.y < boca + 0.02 && p.y > c.centro.y - 0.08)) return false;
    return Math.hypot(p.x - c.centro.x, p.z - c.centro.z) < R_CESTA + 0.012;
  }

  function coger(h, cesta, mano) {
    h.activo = false;
    h.malla.visible = h.sombra.visible = false;
    cesta.balanceo = 1;
    tmp.copy(cesta.centro);
    tmp.y += 0.08;
    if (h.tipo === 'podrido') {
      perderVida(tmp, mano, ctx.t('podrido'));
      return;
    }
    const suma = h.tipo === 'dorado' ? 5 : 1;
    puntos += suma;
    if (suma > 1) {
      ctx.efectos.impacto('medio', { pos: tmp, mano, color: 0xffc83a, sonido: 'anillo' });
      ctx.efectos.texto(tmp, '+5', { color: '#ffd54f', tam: 1.2 });
    } else {
      ctx.efectos.impacto('pequeño', { pos: tmp, mano, color: 0xfff3d6, sonido: 'recepcion' });
      ctx.efectos.texto(tmp, '+1', { color: '#ffffff', tam: 0.8 });
    }
    if (puntos > 0 && puntos % 25 < suma) {
      aviso = ctx.t('racha', { n: puntos - (puntos % 25) });
      tiempoAviso = 1.3;
    }
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
        { texto: ctx.t('partida.finPuntos', { n: puntos }), tam: 1.3, color: '#ffd27a' },
        { texto: ctx.t('partida.recordNuevaPartida', { record, n: Math.max(1, Math.ceil(reloj)) }), tam: 0.72 },
      ]);
    } else {
      marcador.escribir([
        { texto: ctx.t('marcador', { puntos, vidas: '♥'.repeat(vidas) + '♡'.repeat(VIDAS - vidas) }), tam: 1.2 },
        { texto: tiempoAviso > 0 ? aviso : ctx.t('partida.record', { record }), tam: 0.8, color: tiempoAviso > 0 ? '#ffe08a' : '#cfd8dc' },
      ]);
    }
  }

  // Coloca una cesta colgando de un punto (siempre derecha, con un balanceo que se apaga)
  function colocarCesta(c, x, y, z, dt) {
    c.velX = (x - c.antesX) / Math.max(dt, 1e-3);
    c.antesX = x;
    c.centro.set(x, y, z);
    c.grupo.position.copy(c.centro);
    c.balanceo = Math.max(0, c.balanceo - dt * 3);
    c.grupo.rotation.z = THREE.MathUtils.clamp(-c.velX * 0.05, -0.3, 0.3) + Math.sin(c.balanceo * 12) * c.balanceo * 0.15;
    c.grupo.position.y -= Math.sin(c.balanceo * 9) * c.balanceo * 0.015;
    ctx.colocarSombra(c.sombra, c.centro, 0.006);
  }

  // ─── Bucle ─────────────────────────────────────────────────────────────
  function actualizar(dt, t) {
    reloj -= dt;
    tiempoAviso -= dt;
    if ((estado === 'intro' || estado === 'fin') && reloj <= 0) empezar();

    // Cestas
    const vr = ctx.enVR();
    for (const c of cestas) {
      c.grupo.visible = c.sombra.visible = vr && c.mano.activa;
      if (c.grupo.visible) colocarCesta(c, c.mano.posicion.x, c.mano.posicion.y - BAJO_MANO, c.mano.posicion.z, dt);
    }
    cestaRaton.grupo.visible = cestaRaton.sombra.visible = !vr && (ctx.raton.dentro || ctx.tactil);
    if (!vr && ctx.raton.rayo.ray.intersectPlane(plano, tmp)) {
      colocarCesta(cestaRaton, THREE.MathUtils.clamp(tmp.x, -0.95, 0.95), THREE.MathUtils.clamp(tmp.y, 0.45, 1.6), Z_CAIDA, dt);
    }

    if (estado === 'juego') {
      tiempoJuego += dt;
      proximo -= dt;
      if (proximo <= 0) {
        anunciar();
        proximo = intervalo() * (0.7 + Math.random() * 0.6);
      }
    }

    // Gallinas: se agitan antes de poner
    for (const g of gallinas) {
      if (g.aviso > 0) {
        g.aviso -= dt;
        g.grupo.rotation.z = Math.sin(t * 40) * 0.12;
        g.grupo.position.y = ESTANTE_Y + 0.02 + Math.abs(Math.sin(t * 20)) * 0.02;
        if (g.aviso <= 0 && estado === 'juego') poner(g);
      } else {
        g.grupo.rotation.z = 0;
        g.grupo.position.y = ESTANTE_Y + 0.02;
        g.grupo.rotation.y = g.giroBase + Math.sin(t * 0.7 + g.x * 5) * 0.25;
      }
    }

    // Huevos que caen
    const gr = gravedad();
    for (const h of huevos) {
      if (!h.activo) continue;
      h.antes.copy(h.malla.position);
      h.vel.y -= gr * dt;
      h.malla.position.addScaledVector(h.vel, dt);
      h.malla.rotation.x += h.giro * dt;
      ctx.colocarSombra(h.sombra, h.malla.position, 0.006);
      let cogido = false;
      if (h.vel.y < 0) {
        if (vr) {
          for (const c of cestas) {
            if (c.grupo.visible && atrapado(h, c)) {
              coger(h, c, c.mano);
              cogido = true;
              break;
            }
          }
        } else if (cestaRaton.grupo.visible && atrapado(h, cestaRaton)) {
          coger(h, cestaRaton, null);
          cogido = true;
        }
      }
      if (!cogido && h.malla.position.y < 0.035) romper(h);
    }

    // Manchas que se secan
    for (const m of manchas) {
      if (m.vida <= 0) continue;
      m.vida -= dt;
      m.malla.material.opacity = Math.min(1, m.vida);
      if (m.vida <= 0) m.malla.visible = false;
    }
    actualizarMarcador();
  }

  actualizarMarcador();

  return {
    actualizar,
    liberar() {},
  };
}
