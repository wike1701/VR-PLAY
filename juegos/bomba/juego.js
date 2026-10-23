// ¡QUE NO EXPLOTE!
// Una bomba encima de la mesa de un búnker, con su cuenta atrás y varios módulos, cada uno con su pista:
//   · Cables: la pantallita dice en qué orden se cortan (los demás no se tocan).
//   · Botones: hay que pulsar el botón del color de la luz, tres veces seguidas (la luz cambia).
//   · Palancas: arriba las que tienen la luz encendida y abajo las demás.
//   · Rueda: se gira hasta que la flecha señala el color de la pantallita.
// Cada bomba se genera al azar. Un error resta segundos y, al segundo error, salta una trampa: el reloj
// va más rápido. Una partida son 3 bombas, cada una más difícil (2, 3 y 4 módulos); si una explota, se
// acaba. Los puntos: 100 por módulo, 5 por segundo que sobra y 20 menos por error.
//
// En VR: usas las manos libres (acercas la punta y aprietas el gatillo para pulsar o mover una palanca);
// solo cuando hay cables por cortar coges los alicates de la mesa. La rueda se coge con el gatillo y se gira con la muñeca. Con ratón o en el móvil:
// tocas cada pieza; cada toque en la rueda la gira un paso.
import * as THREE from 'three';

// Todo se genera con código: no hay nada que descargar.
export async function precargar() {}

const MESA_Y = 0.86;
const BOMBA_Z = -0.42;
const INCLINACION = 0.38;        // la tapa de la bomba se inclina hacia el jugador
const TAPA_Y = 0.1;              // altura de la tapa (en la bomba)
const RANURAS = [[-0.14, 0.1], [0.14, 0.1], [-0.14, -0.06], [0.14, -0.06]]; // x, z de cada módulo
const BOMBAS = [{ modulos: 2, tiempo: 35 }, { modulos: 3, tiempo: 45 }, { modulos: 4, tiempo: 55 }];
const CASTIGO = 6;               // segundos que quita un error
const R_TOCAR = 0.035;           // distancia de la punta de los alicates para tocar una pieza (VR)
const TIPOS = ['cables', 'botones', 'palancas', 'rueda'];

// Colores de los cables y botones, y los 8 de la rueda
const COLORES = { rojo: 0xe53935, azul: 0x1e88e5, amarillo: 0xfdd835, verde: 0x43a047, blanco: 0xf5f5f5, negro: 0x2b2b2b };
const NOMBRES_CABLE = ['rojo', 'azul', 'amarillo', 'verde', 'blanco', 'negro'];
const COLORES_BOTON = [0xe53935, 0x1e88e5, 0xfdd835, 0x43a047];
const COLORES_RUEDA = [0xe53935, 0xff9800, 0xfdd835, 0x43a047, 0x00bcd4, 0x1e88e5, 0x8e24aa, 0xf5f5f5];

const azar = (a, b) => a + Math.random() * (b - a);
const entero = (n) => Math.floor(Math.random() * n);
const suave = (s) => 1 - Math.pow(1 - s, 3);
const rebote = (s) => 1 + 2.2 * Math.pow(s - 1, 3) + 1.2 * Math.pow(s - 1, 2);
const css = (hex) => `#${hex.toString(16).padStart(6, '0')}`;
function barajar(lista) {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = entero(i + 1);
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

// Junta varias geometrías en una (menos llamadas de dibujo). Con «colores», un color por pieza.
function fusionar(geometrias, colores = null) {
  const partes = geometrias.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = partes.reduce((n, g) => n + g.attributes.position.count, 0);
  const resultado = new THREE.BufferGeometry();
  for (const nombre of colores ? ['position', 'normal'] : ['position', 'normal', 'uv']) {
    const tam = partes[0].attributes[nombre].itemSize;
    const datos = new Float32Array(total * tam);
    let o = 0;
    for (const g of partes) {
      datos.set(g.attributes[nombre].array, o);
      o += g.attributes[nombre].array.length;
    }
    resultado.setAttribute(nombre, new THREE.BufferAttribute(datos, tam));
  }
  if (colores) {
    const datos = new Float32Array(total * 3);
    const c = new THREE.Color();
    let o = 0;
    partes.forEach((g, i) => {
      c.set(colores[i]);
      for (let v = 0; v < g.attributes.position.count; v++, o += 3) datos.set([c.r, c.g, c.b], o);
    });
    resultado.setAttribute('color', new THREE.BufferAttribute(datos, 3));
  }
  for (const g of new Set([...geometrias, ...partes])) g.dispose();
  return resultado;
}

// Pantallita con su canvas (se redibuja solo cuando cambia)
function crearPantalla(ctx, ancho, alto, px = 128) {
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = Math.round((px * alto) / ancho);
  const tex = ctx.recurso(new THREE.CanvasTexture(canvas));
  tex.colorSpace = THREE.SRGBColorSpace;
  const malla = new THREE.Mesh(ctx.recurso(new THREE.PlaneGeometry(ancho, alto).rotateX(-Math.PI / 2)), ctx.recurso(new THREE.MeshBasicMaterial({ map: tex, toneMapped: false })));
  return { malla, g: canvas.getContext('2d'), w: canvas.width, h: canvas.height, tex };
}

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  // ─── El búnker ─────────────────────────────────────────────────────────
  ctx.fondo(0x23282b, { cenit: 0x111416, horizonte: 0x2b3134, suelo: 0x1a1d1f, niebla: [5, 13] });
  ctx.sueloBase(false);
  const VISTAS = {
    horizontal: [new THREE.Vector3(0, 1.42, 0.06), new THREE.Vector3(0, 0.93, -0.5)],
    vertical: [new THREE.Vector3(0, 1.45, 0.0), new THREE.Vector3(0, 0.92, -0.48)],
  };
  let vistaVertical = null;
  function colocarVista() {
    const vertical = ctx.camara.aspect < 1;
    if (vertical === vistaVertical) return;
    vistaVertical = vertical;
    ctx.vistaEscritorio(...VISTAS[vertical ? 'vertical' : 'horizontal']);
  }
  colocarVista();

  // Suelo de hormigón, paredes de bloques y techo
  const texSuelo = R(ctx.texturas.grano(0x5d6266, { tam: 512, repetir: [6, 6], semilla: 401, cantidad: 2200, contraste: 0.2 }));
  raiz.add(new THREE.Mesh(R(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2).translate(0, 0, -1.5)), R(new THREE.MeshLambertMaterial({ map: texSuelo }))));
  const texBloques = R(ctx.texturas.ladrillos(0x6e7377, 0x4a4e52, { tam: 512, filas: 6, columnas: 3, repetir: [5, 3], semilla: 402 }));
  raiz.add(new THREE.Mesh(R(fusionar([
    new THREE.PlaneGeometry(8, 3.4).translate(0, 1.7, -2.6),
    new THREE.PlaneGeometry(8, 3.4).rotateY(Math.PI / 2).translate(-2.6, 1.7, -0.5),
    new THREE.PlaneGeometry(8, 3.4).rotateY(-Math.PI / 2).translate(2.6, 1.7, -0.5),
    new THREE.PlaneGeometry(8, 3.4).rotateY(Math.PI).translate(0, 1.7, 2.2),
  ])), R(new THREE.MeshLambertMaterial({ map: texBloques }))));
  const techo = [new THREE.PlaneGeometry(8, 8).rotateX(Math.PI / 2).translate(0, 3.4, -0.5)];
  // Tuberías por la pared del fondo y la lámpara de jaula del techo
  for (const [y, r] of [[2.7, 0.07], [2.95, 0.045]]) techo.push(new THREE.CylinderGeometry(r, r, 6, 10).rotateZ(Math.PI / 2).translate(0, y, -2.5));
  techo.push(new THREE.CylinderGeometry(0.01, 0.01, 1.1, 4).translate(0, 2.85, -0.45));
  techo.push(new THREE.ConeGeometry(0.22, 0.14, 16, 1, true).translate(0, 2.25, -0.45));
  raiz.add(new THREE.Mesh(R(fusionar(techo)), R(new THREE.MeshLambertMaterial({ color: 0x3a4044, side: THREE.DoubleSide }))));
  raiz.add(new THREE.Mesh(R(new THREE.SphereGeometry(0.07, 12, 8).translate(0, 2.17, -0.45)), R(new THREE.MeshBasicMaterial({ color: 0xfff1c4, toneMapped: false }))));

  // Franjas de peligro (pared y canto de la mesa) y un panel de herramientas en la pared
  const texFranjas = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#1d1d1d';
    g.fillRect(0, 0, tam, tam);
    g.fillStyle = '#f9c80e';
    for (let i = -tam; i < tam * 2; i += tam / 4) {
      g.beginPath();
      g.moveTo(i, 0);
      g.lineTo(i + tam / 8, 0);
      g.lineTo(i + tam / 8 + tam, tam);
      g.lineTo(i + tam, tam);
      g.closePath();
      g.fill();
    }
  }, { tam: 128, repetir: [1, 1], semilla: 403 }));
  texFranjas.repeat.set(14, 1);
  const matFranjas = R(new THREE.MeshLambertMaterial({ map: texFranjas }));
  raiz.add(new THREE.Mesh(R(fusionar([
    new THREE.PlaneGeometry(5.2, 0.16).translate(0, 0.25, -2.59),
    new THREE.PlaneGeometry(1.4, 0.05).translate(0, MESA_Y - 0.035, 0.001 - 0.05),
  ])), matFranjas));
  const texTablero = R(ctx.texturaCanvas((g, tam) => {
    // Tablero perforado con las siluetas de las herramientas colgadas
    g.fillStyle = '#b38b5d';
    g.fillRect(0, 0, tam, tam);
    g.fillStyle = 'rgba(60,40,20,0.55)';
    for (let x = 8; x < tam; x += 16) for (let y = 8; y < tam; y += 16) g.fillRect(x, y, 3, 3);
    g.fillStyle = '#2f3438';
    g.fillRect(tam * 0.12, tam * 0.2, tam * 0.06, tam * 0.5);
    g.fillRect(tam * 0.06, tam * 0.16, tam * 0.18, tam * 0.08);
    g.beginPath();
    g.arc(tam * 0.45, tam * 0.32, tam * 0.1, 0, Math.PI * 2);
    g.fill();
    g.fillRect(tam * 0.43, tam * 0.4, tam * 0.04, tam * 0.36);
    g.fillStyle = '#c62828';
    g.fillRect(tam * 0.68, tam * 0.45, tam * 0.05, tam * 0.3);
    g.fillRect(tam * 0.78, tam * 0.45, tam * 0.05, tam * 0.3);
    g.fillStyle = '#2f3438';
    g.fillRect(tam * 0.69, tam * 0.22, tam * 0.13, tam * 0.24);
  }, { tam: 256, semilla: 404 }));
  raiz.add(new THREE.Mesh(R(new THREE.PlaneGeometry(1.5, 0.9).translate(-0.9, 1.65, -2.58)), R(new THREE.MeshLambertMaterial({ map: texTablero }))));
  // Cartel de peligro (un triángulo amarillo con una bomba dibujada)
  const texCartel = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#3a4044';
    g.fillRect(0, 0, tam, tam);
    g.fillStyle = '#f9c80e';
    g.beginPath();
    g.moveTo(tam / 2, tam * 0.08);
    g.lineTo(tam * 0.94, tam * 0.9);
    g.lineTo(tam * 0.06, tam * 0.9);
    g.closePath();
    g.fill();
    g.fillStyle = '#1d1d1d';
    g.beginPath();
    g.arc(tam / 2, tam * 0.62, tam * 0.16, 0, Math.PI * 2);
    g.fill();
    g.fillRect(tam * 0.47, tam * 0.36, tam * 0.06, tam * 0.12);
    g.fillStyle = '#ff6a3d';
    g.beginPath();
    g.arc(tam * 0.56, tam * 0.33, tam * 0.05, 0, Math.PI * 2);
    g.fill();
  }, { tam: 128, semilla: 405 }));
  raiz.add(new THREE.Mesh(R(new THREE.PlaneGeometry(0.6, 0.6).translate(0.95, 1.75, -2.58)), R(new THREE.MeshLambertMaterial({ map: texCartel }))));
  // Estanterías con cajas de munición
  const metal = [];
  const cajas = [];
  for (const x of [1.6, -1.9]) {
    for (const y of [0.4, 1.0, 1.6]) {
      metal.push(new THREE.BoxGeometry(1.0, 0.04, 0.45).translate(x, y, -2.3));
      for (let k = 0; k < 3; k++) cajas.push(new THREE.BoxGeometry(0.26, 0.2 + ((k + y * 3) % 2) * 0.06, 0.32).translate(x - 0.32 + k * 0.32, y + 0.12, -2.3));
    }
    for (const dx of [-0.48, 0.48]) metal.push(new THREE.BoxGeometry(0.04, 1.8, 0.04).translate(x + dx, 0.9, -2.3));
  }
  // Patas de la mesa
  for (const x of [-0.65, 0.65]) for (const z of [-0.05, -0.85]) metal.push(new THREE.BoxGeometry(0.05, MESA_Y - 0.04, 0.05).translate(x, (MESA_Y - 0.04) / 2, z));
  raiz.add(new THREE.Mesh(R(fusionar(metal)), R(new THREE.MeshLambertMaterial({ color: 0x4a5258 }))));
  raiz.add(new THREE.Mesh(R(fusionar(cajas)), R(new THREE.MeshLambertMaterial({ color: 0x556b2f }))));
  // Mesa de trabajo
  const texMesa = R(ctx.texturas.madera(0x7a5a3a, { tam: 512, repetir: [2, 1], semilla: 406 }));
  raiz.add(new THREE.Mesh(R(new THREE.BoxGeometry(1.4, 0.04, 0.9).translate(0, MESA_Y - 0.02, -0.45)), R(new THREE.MeshLambertMaterial({ map: texMesa }))));

  // ─── La bomba ──────────────────────────────────────────────────────────
  const bomba = new THREE.Group();
  bomba.position.set(0, MESA_Y, BOMBA_Z);
  bomba.rotation.x = INCLINACION;
  raiz.add(bomba);
  const sombraBomba = ctx.crearSombra({ radio: 0.42, opacidad: 0.5 });
  ctx.colocarSombra(sombraBomba, bomba.position, MESA_Y);
  raiz.add(sombraBomba);
  // Caja metálica con remaches, cartuchos de dinamita detrás y el bloque del reloj
  const caja = [
    new THREE.BoxGeometry(0.62, TAPA_Y, 0.42).translate(0, TAPA_Y / 2, 0.02),
    new THREE.BoxGeometry(0.64, 0.012, 0.44).translate(0, TAPA_Y - 0.006, 0.02),
    new THREE.BoxGeometry(0.3, 0.1, 0.07).translate(0, TAPA_Y + 0.05, -0.17),
  ];
  for (const [x, z] of [[-0.3, -0.18], [0.3, -0.18], [-0.3, 0.22], [0.3, 0.22]]) caja.push(new THREE.SphereGeometry(0.009, 8, 6).translate(x, TAPA_Y + 0.002, z));
  bomba.add(new THREE.Mesh(R(fusionar(caja)), R(new THREE.MeshLambertMaterial({ color: 0x5f666d }))));
  // Tres cartuchos de dinamita atados con cinta detrás de la caja
  const dinamita = [];
  const coloresDinamita = [];
  for (const [y, z] of [[0.028, -0.222], [0.028, -0.276], [0.074, -0.249]]) {
    dinamita.push(new THREE.CylinderGeometry(0.026, 0.026, 0.34, 14).rotateZ(Math.PI / 2).translate(0, y, z));
    coloresDinamita.push(0xc62828);
  }
  for (const x of [-0.11, 0.11]) {
    dinamita.push(new THREE.TorusGeometry(0.056, 0.007, 6, 18).rotateY(Math.PI / 2).translate(x, 0.045, -0.249));
    coloresDinamita.push(0x2b2b2b);
  }
  // Cables sueltos que salen de la dinamita hacia el reloj
  for (const [x, c] of [[-0.05, 0xe53935], [0.0, 0x1e88e5], [0.05, 0xfdd835]]) {
    const curva = new THREE.CatmullRomCurve3([new THREE.Vector3(x, 0.08, -0.25), new THREE.Vector3(x * 1.4, 0.2, -0.24), new THREE.Vector3(x, 0.18, -0.2)]);
    dinamita.push(new THREE.TubeGeometry(curva, 12, 0.004, 5, false));
    coloresDinamita.push(c);
  }
  bomba.add(new THREE.Mesh(R(fusionar(dinamita, coloresDinamita)), R(new THREE.MeshLambertMaterial({ vertexColors: true }))));

  // Reloj: pantalla roja de segmentos (canvas) en el bloque de atrás, de cara al jugador
  const reloj = crearPantalla(ctx, 0.26, 0.08, 256);
  reloj.malla.rotation.x = Math.PI / 2;
  reloj.malla.position.set(0, TAPA_Y + 0.05, -0.1345);
  bomba.add(reloj.malla);
  let relojTexto = '';
  function dibujarReloj(texto, color) {
    const clave = texto + color;
    if (clave === relojTexto) return;
    relojTexto = clave;
    const { g, w, h } = reloj;
    g.fillStyle = '#120404';
    g.fillRect(0, 0, w, h);
    g.font = `bold ${Math.round(h * 0.86)}px monospace`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    g.fillStyle = 'rgba(255,40,40,0.12)';
    g.fillText('88:88', w / 2, h * 0.54);
    g.fillStyle = color;
    g.fillText(texto, w / 2, h * 0.54);
    reloj.tex.needsUpdate = true;
  }
  // Luz que parpadea al ritmo del reloj
  const matPiloto = R(new THREE.MeshBasicMaterial({ color: 0xff1744, toneMapped: false }));
  const piloto = new THREE.Mesh(R(new THREE.SphereGeometry(0.012, 10, 8)), matPiloto);
  piloto.position.set(0.12, TAPA_Y + 0.1, -0.16);
  bomba.add(piloto);

  // ─── Módulos ───────────────────────────────────────────────────────────
  // Cada módulo vive en un grupo que se coloca en una ranura de la tapa. Cada pieza que se toca guarda
  // en userData.pieza a qué módulo pertenece y cuál es.
  const piezas = [];
  const matPlaca = R(new THREE.MeshLambertMaterial({ color: 0x2d3238 }));
  const geoPlaca = R(fusionar([
    new THREE.BoxGeometry(0.25, 0.012, 0.145).translate(0, 0.006, 0),
    new THREE.BoxGeometry(0.255, 0.006, 0.15).translate(0, 0.001, 0),
  ]));
  const geoLed = R(new THREE.SphereGeometry(0.008, 10, 8));
  const geoLedPeq = R(new THREE.SphereGeometry(0.006, 8, 6));
  const COLOR_LED_ROJO = 0x7a1010;
  const COLOR_LED_VERDE = 0x39ff6a;
  function crearModulo(tipo) {
    const grupo = new THREE.Group();
    grupo.add(new THREE.Mesh(geoPlaca, matPlaca));
    const led = new THREE.Mesh(geoLed, R(new THREE.MeshBasicMaterial({ color: COLOR_LED_ROJO, toneMapped: false })));
    led.position.set(0.108, 0.014, -0.058);
    grupo.add(led);
    grupo.visible = false;
    bomba.add(grupo);
    return { tipo, grupo, led, activo: false, resuelto: false, brillo: 0 };
  }
  const pieza = (malla, modulo, indice, punto) => {
    malla.userData.pieza = { modulo, indice, punto }; // punto: dónde se toca, en el grupo del módulo
    piezas.push(malla);
    return malla;
  };
  const matInvisible = R(new THREE.MeshBasicMaterial({ visible: false }));
  const matMetal = R(new THREE.MeshStandardMaterial({ color: 0xa8b0b7, metalness: 0.85, roughness: 0.32 })); // regletas y bases de las palancas

  // Cables: 4 cables entre dos regletas y la pantallita con el orden
  const cables = crearModulo('cables');
  {
    const regletas = [];
    for (const x of [-0.035, 0.1]) regletas.push(new THREE.BoxGeometry(0.02, 0.018, 0.12).translate(x, 0.021, 0));
    for (let i = 0; i < 4; i++) for (const x of [-0.035, 0.1]) regletas.push(new THREE.CylinderGeometry(0.005, 0.005, 0.006, 8).translate(x, 0.032, -0.042 + i * 0.028));
    cables.grupo.add(new THREE.Mesh(R(fusionar(regletas)), matMetal));
    const curvaCable = (z, desde, hasta, caida = 0) => new THREE.CatmullRomCurve3([
      new THREE.Vector3(desde, 0.03, z), new THREE.Vector3(desde + (hasta - desde) * 0.5, 0.05 - caida, z + caida * 0.3), new THREE.Vector3(hasta, 0.03 - caida * 1.4, z + caida * 0.4),
    ]);
    const geoEntero = [];
    const geoCortado = [];
    for (let i = 0; i < 4; i++) {
      const z = -0.042 + i * 0.028;
      geoEntero.push(R(new THREE.TubeGeometry(curvaCable(z, -0.035, 0.1), 16, 0.0045, 6, false)));
      geoCortado.push(R(fusionar([
        new THREE.TubeGeometry(curvaCable(z, -0.035, 0.022, 0.012), 10, 0.0045, 6, false),
        new THREE.TubeGeometry(curvaCable(z, 0.1, 0.044, 0.012), 10, 0.0045, 6, false),
        new THREE.CylinderGeometry(0.0022, 0.0022, 0.008, 5).rotateZ(Math.PI / 2).translate(0.025, 0.014, z + 0.005),
        new THREE.CylinderGeometry(0.0022, 0.0022, 0.008, 5).rotateZ(Math.PI / 2).translate(0.041, 0.014, z + 0.005),
      ])));
    }
    const matsCable = NOMBRES_CABLE.map((n) => R(new THREE.MeshLambertMaterial({ color: COLORES[n] })));
    const geoZona = R(new THREE.BoxGeometry(0.11, 0.04, 0.024).translate(0.032, 0.04, 0));
    cables.hilos = [0, 1, 2, 3].map((i) => {
      const malla = new THREE.Mesh(geoEntero[i], matsCable[0]);
      cables.grupo.add(malla);
      const zona = new THREE.Mesh(geoZona, matInvisible);
      zona.position.z = -0.042 + i * 0.028;
      cables.grupo.add(zona);
      pieza(zona, cables, i, new THREE.Vector3(0.032, 0.05, -0.042 + i * 0.028));
      return { malla, color: 0, cortado: false };
    });
    cables.matsCable = matsCable;
    cables.geoEntero = geoEntero;
    cables.geoCortado = geoCortado;
    cables.pantalla = crearPantalla(ctx, 0.06, 0.11, 96);
    cables.pantalla.malla.position.set(-0.085, 0.0125, 0.005);
    cables.grupo.add(cables.pantalla.malla);
  }

  // Botones: 4 botones de colores, la luz que dice cuál pulsar y 3 luces de progreso
  const botones = crearModulo('botones');
  {
    const base = [];
    for (let i = 0; i < 4; i++) base.push(new THREE.CylinderGeometry(0.023, 0.025, 0.01, 18).translate(-0.078 + i * 0.052, 0.017, 0.022));
    base.push(new THREE.CylinderGeometry(0.02, 0.022, 0.012, 16).translate(-0.06, 0.018, -0.04));
    botones.grupo.add(new THREE.Mesh(R(fusionar(base)), R(new THREE.MeshLambertMaterial({ color: 0x181b1e }))));
    const geoBoton = R(new THREE.CylinderGeometry(0.018, 0.019, 0.014, 20).translate(0, 0.007, 0));
    botones.teclas = COLORES_BOTON.map((color, i) => {
      const malla = new THREE.Mesh(geoBoton, R(new THREE.MeshStandardMaterial({ color, roughness: 0.35, metalness: 0.05, emissive: color, emissiveIntensity: 0.12 })));
      malla.position.set(-0.078 + i * 0.052, 0.022, 0.022);
      botones.grupo.add(malla);
      pieza(malla, botones, i, new THREE.Vector3(-0.078 + i * 0.052, 0.035, 0.022));
      return { malla, color, hundido: 0 };
    });
    botones.luz = new THREE.Mesh(R(new THREE.SphereGeometry(0.016, 14, 10)), R(new THREE.MeshBasicMaterial({ color: 0x333333, toneMapped: false })));
    botones.luz.position.set(-0.06, 0.028, -0.04);
    botones.grupo.add(botones.luz);
    botones.progreso = [0, 1, 2].map((i) => {
      const l = new THREE.Mesh(geoLedPeq, R(new THREE.MeshBasicMaterial({ color: 0x333333, toneMapped: false })));
      l.position.set(0.0 + i * 0.026, 0.016, -0.045);
      botones.grupo.add(l);
      return l;
    });
  }

  // Palancas: 4 interruptores de palanca con su luz de lo que piden
  const palancas = crearModulo('palancas');
  {
    const base = [];
    for (let i = 0; i < 4; i++) {
      base.push(new THREE.BoxGeometry(0.03, 0.008, 0.05).translate(-0.078 + i * 0.052, 0.016, 0.02));
      base.push(new THREE.CylinderGeometry(0.009, 0.009, 0.026, 10).rotateZ(Math.PI / 2).translate(-0.078 + i * 0.052, 0.022, 0.02));
    }
    palancas.grupo.add(new THREE.Mesh(R(fusionar(base)), matMetal));
    const geoPalanca = R(fusionar([
      new THREE.CylinderGeometry(0.004, 0.005, 0.05, 8).translate(0, 0.025, 0),
      new THREE.SphereGeometry(0.009, 10, 8).translate(0, 0.052, 0),
    ]));
    const matPalanca = R(new THREE.MeshStandardMaterial({ color: 0xe0e4e8, metalness: 0.9, roughness: 0.2 }));
    palancas.interruptores = [0, 1, 2, 3].map((i) => {
      const eje = new THREE.Group();
      eje.position.set(-0.078 + i * 0.052, 0.022, 0.02);
      const malla = new THREE.Mesh(geoPalanca, matPalanca);
      eje.add(malla);
      palancas.grupo.add(eje);
      const zona = new THREE.Mesh(R(new THREE.BoxGeometry(0.036, 0.05, 0.06).translate(0, 0.02, 0)), matInvisible);
      eje.add(zona);
      pieza(zona, palancas, i, new THREE.Vector3(-0.078 + i * 0.052, 0.05, 0.02));
      const luz = new THREE.Mesh(geoLed, R(new THREE.MeshBasicMaterial({ color: 0x333333, toneMapped: false })));
      luz.position.set(-0.078 + i * 0.052, 0.014, -0.04);
      palancas.grupo.add(luz);
      return { eje, luz, arriba: false, objetivo: false, angulo: 0 };
    });
  }

  // Rueda: un mando giratorio con flecha, 8 marcas de colores alrededor y la pantallita con el color
  const rueda = crearModulo('rueda');
  {
    const marcas = [];
    for (let i = 0; i < 8; i++) {
      const a = (i / 8) * Math.PI * 2;
      marcas.push(new THREE.CylinderGeometry(0.009, 0.009, 0.004, 10).translate(0.03 + Math.sin(a) * 0.052, 0.014, Math.cos(a) * -0.052));
    }
    rueda.grupo.add(new THREE.Mesh(R(fusionar(marcas, COLORES_RUEDA)), R(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }))));
    const perfil = [[0.001, 0], [0.034, 0], [0.036, 0.004], [0.036, 0.016], [0.03, 0.026], [0.001, 0.026]].map(([x, y]) => new THREE.Vector2(x, y));
    rueda.mando = new THREE.Group();
    rueda.mando.position.set(0.03, 0.012, 0);
    rueda.mando.add(new THREE.Mesh(R(fusionar([
      new THREE.LatheGeometry(perfil, 24),
      ...Array.from({ length: 16 }, (_, i) => new THREE.BoxGeometry(0.004, 0.012, 0.004).translate(Math.sin((i / 16) * Math.PI * 2) * 0.036, 0.009, Math.cos((i / 16) * Math.PI * 2) * 0.036)),
    ])), R(new THREE.MeshStandardMaterial({ color: 0x24282c, metalness: 0.4, roughness: 0.5 }))));
    // Flecha en la cara del mando (señala hacia z negativo cuando el giro es 0)
    const flecha = new THREE.Shape();
    flecha.moveTo(0, -0.032);
    flecha.lineTo(0.009, -0.012);
    flecha.lineTo(0.004, -0.012);
    flecha.lineTo(0.004, 0.012);
    flecha.lineTo(-0.004, 0.012);
    flecha.lineTo(-0.004, -0.012);
    flecha.lineTo(-0.009, -0.012);
    flecha.closePath();
    rueda.mando.add(new THREE.Mesh(R(new THREE.ShapeGeometry(flecha).rotateX(Math.PI / 2).translate(0, 0.0265, 0)), R(new THREE.MeshBasicMaterial({ color: 0xff6a3d, toneMapped: false, side: THREE.DoubleSide }))));
    rueda.grupo.add(rueda.mando);
    const zona = new THREE.Mesh(R(new THREE.CylinderGeometry(0.045, 0.045, 0.04, 12).translate(0, 0.02, 0)), matInvisible);
    rueda.mando.add(zona);
    pieza(zona, rueda, 0, new THREE.Vector3(0.03, 0.04, 0));
    rueda.pantalla = crearPantalla(ctx, 0.06, 0.06, 96);
    rueda.pantalla.malla.position.set(-0.075, 0.0125, 0.0);
    rueda.grupo.add(rueda.pantalla.malla);
    rueda.paso = 0;          // posición de la flecha (0-7)
    rueda.angulo = 0;        // ángulo que se ve (con animación)
    rueda.objetivo = 0;
  }
  const modulos = { cables, botones, palancas, rueda };

  // ─── Pistas de cada módulo ─────────────────────────────────────────────
  function prepararCables() {
    const colores = barajar([...NOMBRES_CABLE.keys()]).slice(0, 4);
    cables.hilos.forEach((h, i) => {
      h.color = colores[i];
      h.cortado = false;
      h.malla.geometry = cables.geoEntero[i];
      h.malla.material = cables.matsCable[colores[i]];
    });
    // Cuántos se cortan: 2 en la primera bomba, 3 después
    const n = bomba.indice === 0 ? 2 : 3;
    cables.orden = barajar([0, 1, 2, 3]).slice(0, n);
    cables.paso = 0;
    dibujarPantallaCables();
  }
  function dibujarPantallaCables() {
    const { g, w, h } = cables.pantalla;
    g.fillStyle = '#0d1a12';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#3cff8a';
    g.lineWidth = 3;
    g.strokeRect(3, 3, w - 6, h - 6);
    const n = cables.orden.length;
    cables.orden.forEach((hilo, k) => {
      const y = h * (0.2 + (k * 0.62) / Math.max(1, n - 1));
      const hecho = k < cables.paso;
      g.fillStyle = hecho ? '#1f3b2a' : '#3cff8a';
      g.font = `bold ${Math.round(w * 0.28)}px sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(String(k + 1), w * 0.24, y);
      g.fillStyle = css(COLORES[NOMBRES_CABLE[cables.hilos[hilo].color]]);
      g.globalAlpha = hecho ? 0.25 : 1;
      g.beginPath();
      g.roundRect(w * 0.44, y - h * 0.08, w * 0.44, h * 0.16, h * 0.06);
      g.fill();
      g.strokeStyle = '#ffffff';
      g.lineWidth = 2;
      g.stroke();
      g.globalAlpha = 1;
    });
    cables.pantalla.tex.needsUpdate = true;
  }

  function prepararBotones() {
    botones.secuencia = [entero(4), entero(4), entero(4)];
    botones.paso = 0;
    botones.progreso.forEach((l) => l.material.color.setHex(0x333333));
    botones.luz.material.color.setHex(COLORES_BOTON[botones.secuencia[0]]);
  }

  function prepararPalancas() {
    for (const p of palancas.interruptores) {
      p.objetivo = Math.random() < 0.5;
      p.arriba = Math.random() < 0.5;
      p.luz.material.color.setHex(p.objetivo ? 0xffd54f : 0x333333);
    }
    // Que al menos dos estén mal al empezar
    const mal = palancas.interruptores.filter((p) => p.arriba !== p.objetivo).length;
    if (mal < 2) for (const i of barajar([0, 1, 2, 3]).slice(0, 2)) palancas.interruptores[i].arriba = !palancas.interruptores[i].objetivo;
    for (const p of palancas.interruptores) p.angulo = p.arriba ? -0.8 : 0.8;
  }

  function prepararRueda() {
    rueda.paso = entero(8);
    rueda.objetivo = (rueda.paso + 2 + entero(5)) % 8;
    rueda.angulo = -rueda.paso * (Math.PI / 4);
    rueda.mando.rotation.y = rueda.angulo;
    const { g, w, h } = rueda.pantalla;
    g.fillStyle = '#0d1a12';
    g.fillRect(0, 0, w, h);
    g.strokeStyle = '#3cff8a';
    g.lineWidth = 3;
    g.strokeRect(3, 3, w - 6, h - 6);
    g.fillStyle = css(COLORES_RUEDA[rueda.objetivo]);
    g.beginPath();
    g.arc(w / 2, h / 2, w * 0.3, 0, Math.PI * 2);
    g.fill();
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    g.stroke();
    rueda.pantalla.tex.needsUpdate = true;
  }
  const PREPARAR = { cables: prepararCables, botones: prepararBotones, palancas: prepararPalancas, rueda: prepararRueda };

  // ─── Alicates en cada mano (VR) ────────────────────────────────────────
  // Dos mitades que giran sobre el eje: mango de goma roja y boca de acero que se cierra con el gatillo
  const geoMango = R(fusionar([
    new THREE.CapsuleGeometry(0.009, 0.075, 4, 8).rotateX(Math.PI / 2).rotateY(0.12).translate(0.012, 0, 0.055),
    new THREE.SphereGeometry(0.0095, 8, 6).translate(0.017, 0, 0.1),
  ]));
  const bocaForma = new THREE.Shape();
  bocaForma.moveTo(0, 0);
  bocaForma.lineTo(0.004, -0.045);
  bocaForma.lineTo(0.0, -0.062);
  bocaForma.lineTo(-0.004, -0.045);
  bocaForma.lineTo(-0.006, 0.0);
  bocaForma.closePath();
  const geoBoca = R(fusionar([
    new THREE.ExtrudeGeometry(bocaForma, { depth: 0.008, bevelEnabled: false }).rotateX(Math.PI / 2).translate(0.003, 0.004, 0),
    new THREE.BoxGeometry(0.008, 0.008, 0.018).translate(0.006, 0, 0.012),
  ]));
  const matMango = R(new THREE.MeshLambertMaterial({ color: 0xc62828 }));
  const matAcero = R(new THREE.MeshStandardMaterial({ color: 0xc9d1d8, metalness: 0.9, roughness: 0.25 }));
  const geoEje = R(new THREE.CylinderGeometry(0.007, 0.007, 0.018, 12));
  function crearAlicates() {
    const alicates = new THREE.Group();
    const mitades = [1, -1].map((lado) => {
      const m = new THREE.Group();
      m.add(new THREE.Mesh(geoMango, matMango), new THREE.Mesh(geoBoca, matAcero));
      m.scale.x = lado;
      alicates.add(m);
      return m;
    });
    alicates.add(new THREE.Mesh(geoEje, matAcero));
    return { alicates, mitades };
  }
  const matPiel = R(new THREE.MeshLambertMaterial({ color: 0xe0b08c }));
  const geoPalma = R(new THREE.BoxGeometry(0.07, 0.025, 0.08).translate(0, 0, 0.01));
  const geoDedo = R(new THREE.CapsuleGeometry(0.009, 0.06, 4, 8).rotateX(Math.PI / 2).translate(0, -0.01, -0.06));
  const geoPunta = R(new THREE.SphereGeometry(0.008, 12, 8).translate(0, -0.01, -0.092));
  const manos = ctx.manos.map((mano) => {
    const { alicates, mitades } = crearAlicates();
    alicates.position.set(0, -0.01, -0.03);
    alicates.visible = false;
    ctx.adjuntarAMano(mano, alicates);
    // Mano visible: palma y dedo con una punta que se ilumina al tener una pieza al alcance
    const matPunta = R(new THREE.MeshBasicMaterial({ color: 0xffffff }));
    const dedo = new THREE.Group();
    dedo.add(new THREE.Mesh(geoPalma, matPiel), new THREE.Mesh(geoDedo, matPiel), new THREE.Mesh(geoPunta, matPunta));
    ctx.adjuntarAMano(mano, dedo);
    return { mano, dedo, matPunta, alicates, mitades, tiene: false, punta: new THREE.Vector3(), agarre: null, ruedaInicial: 0, quat: new THREE.Quaternion(), quatInicial: new THREE.Quaternion() };
  });

  // Los alicates descansan sobre la mesa: se cogen con el gatillo cuando toca cortar cables y vuelven solos
  const alicatesMesa = crearAlicates().alicates;
  alicatesMesa.position.set(0.45, MESA_Y + 0.012, BOMBA_Z + 0.12);
  alicatesMesa.rotation.set(0, 0.5, 0);
  alicatesMesa.visible = false;
  raiz.add(alicatesMesa);
  const R_COGER = 0.1;

  // ─── Marcador ──────────────────────────────────────────────────────────
  const panel = ctx.crearPanel({ ancho: 0.82, alto: 0.22 });
  panel.mesh.position.set(0, 1.13, -0.9);
  panel.mesh.rotation.x = -0.25;
  raiz.add(panel.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'bomba' | 'desactivada' | 'explota' | 'fin'
  let espera = 3;
  let tiempo = 0;
  let puntos = 0;
  let restante = 0;
  let errores = 0;
  let erroresPartida = 0;
  let velocidad = 1;
  let segundoAnterior = 0;
  let aparicion = 1;
  let victoria = false;
  let aviso = null;
  let ayuda = 0;
  let record = ctx.leer('record', 0);
  bomba.indice = 0;
  let activos = [];
  const tmp = new THREE.Vector3();
  const eje = new THREE.Vector3();
  const inversa = new THREE.Quaternion();
  const relativa = new THREE.Quaternion();

  function avisar(texto, color, duracion = 1.5) { aviso = { texto, color, tiempo: duracion }; }

  const AYUDAS = { cables: 'ayudaCables', botones: 'ayudaBotones', palancas: 'ayudaPalancas', rueda: 'ayudaRueda' };
  function escribirMarcador() {
    let lineas;
    if (estado === 'intro') {
      lineas = [{ texto: ctx.t('titulo'), tam: 1.15, color: '#ffca28' },
        { texto: ctx.t(ctx.enVR() ? 'introVR' : ctx.tactil ? 'introTactil' : 'introRaton'), tam: 0.6, color: '#fff3e0' }];
    } else if (estado === 'fin') {
      lineas = [{ texto: ctx.t(victoria ? 'victoria' : 'fin', { n: puntos }), tam: 1.05, color: victoria ? '#69f0ae' : '#ff8a65' },
        { texto: ctx.t('partida.recordNuevaPartida', { record, n: Math.ceil(espera) }), tam: 0.62 }];
    } else {
      const pendientes = activos.filter((m) => !m.resuelto);
      const tipo = pendientes.length ? pendientes[Math.floor(ayuda / 3.5) % pendientes.length].tipo : null;
      lineas = [{ texto: ctx.t('marcador', { b: bomba.indice + 1, total: BOMBAS.length, n: puntos }), tam: 1.0, color: '#ffffff' },
        aviso ? { texto: aviso.texto, tam: 0.66, color: aviso.color }
          : { texto: tipo && estado === 'bomba' ? ctx.t(AYUDAS[tipo]) : '', tam: 0.58, color: '#ffe082' }];
    }
    panel.escribir(lineas);
  }

  // ─── Bombas ────────────────────────────────────────────────────────────
  function armarBomba(indice) {
    bomba.indice = indice;
    const datos = BOMBAS[indice];
    // La primera, siempre cables y botones; luego, al azar
    const tipos = indice === 0 ? ['cables', 'botones'] : barajar([...TIPOS]).slice(0, datos.modulos);
    const ranuras = barajar([0, 1, 2, 3]);
    for (const m of Object.values(modulos)) {
      m.grupo.visible = false;
      m.activo = false;
    }
    activos = tipos.map((tipo, k) => {
      const m = modulos[tipo];
      m.activo = true;
      m.resuelto = false;
      m.brillo = 0;
      m.led.material.color.setHex(COLOR_LED_ROJO);
      const [x, z] = RANURAS[ranuras[k]];
      m.grupo.position.set(x, TAPA_Y, z);
      m.grupo.visible = true;
      PREPARAR[tipo]();
      return m;
    });
    // Tapas ciegas en las ranuras vacías
    tapas.forEach((tapa, i) => {
      tapa.visible = !activos.some((m) => m.grupo.position.x === RANURAS[i][0] && m.grupo.position.z === RANURAS[i][1]);
    });
    restante = datos.tiempo;
    errores = 0;
    velocidad = 1;
    segundoAnterior = Math.ceil(restante);
    aparicion = 0;
    bomba.visible = true;
    estado = 'bomba';
    ayuda = 0;
    ctx.sonido('clac');
  }
  const geoTapa = R(fusionar([
    new THREE.BoxGeometry(0.25, 0.008, 0.145).translate(0, 0.004, 0),
    ...[[-0.11, -0.06], [0.11, -0.06], [-0.11, 0.06], [0.11, 0.06]].map(([x, z]) => new THREE.CylinderGeometry(0.005, 0.005, 0.004, 8).translate(x, 0.009, z)),
  ]));
  const matTapa = R(new THREE.MeshLambertMaterial({ color: 0x41474d }));
  const tapas = RANURAS.map(([x, z]) => {
    const t = new THREE.Mesh(geoTapa, matTapa);
    t.position.set(x, TAPA_Y, z);
    bomba.add(t);
    return t;
  });

  function moduloResuelto(m, mano) {
    m.resuelto = true;
    m.brillo = 1;
    m.led.material.color.setHex(COLOR_LED_VERDE);
    m.grupo.localToWorld(tmp.set(0, 0.04, 0));
    ctx.efectos.impacto('medio', { pos: tmp, mano, color: COLOR_LED_VERDE, sonido: 'punto' });
    ctx.efectos.texto(tmp, '+100', { color: '#b9f6ca', tam: 0.9 });
    if (activos.every((x) => x.resuelto)) desactivada(mano);
    else avisar(ctx.t('modulo'), '#b9f6ca', 1.2);
  }

  function error(m, mano) {
    errores++;
    erroresPartida++;
    restante = Math.max(0.5, restante - CASTIGO);
    ctx.sonido('zumbador');
    ctx.destello(0xff1744, 0.25);
    if (mano) ctx.vibrar(mano, 0.9, 180);
    else for (const x of ctx.manos) ctx.vibrar(x, 0.6, 150);
    m.grupo.localToWorld(tmp.set(0, 0.06, 0));
    ctx.efectos.texto(tmp, `-${CASTIGO} s`, { color: '#ff5252', tam: 1.1 });
    if (errores === 2) {
      velocidad = 1.6;
      avisar(ctx.t('trampa'), '#ff5252', 2.2);
      ctx.sonido('calambre');
    } else avisar(ctx.t('error', { n: CASTIGO }), '#ff8a80', 1.5);
  }

  function desactivada(mano) {
    const n = activos.length;
    const total = Math.max(50, n * 100 + Math.floor(restante) * 5 - errores * 20);
    // Los 100 por módulo ya se han enseñado al resolver cada uno; aquí sale el total de la bomba
    puntos += total;
    estado = 'desactivada';
    espera = 2.4;
    bomba.localToWorld(tmp.set(0, 0.3, -0.1));
    ctx.efectos.impacto('grande', { pos: tmp, mano, color: 0x69f0ae, sonido: 'ovacion' });
    ctx.efectos.texto(tmp, `+${total}`, { color: '#69f0ae', tam: 1.6 });
    avisar(ctx.t('desactivada', { n: total }), '#69f0ae', 2.4);
    matPiloto.color.setHex(0x39ff6a);
    if (puntos > record && record > 0 && puntos - total <= record) avisar(ctx.t('partida.nuevoRecord'), '#ffd54f', 2.4);
  }

  function explotar() {
    estado = 'explota';
    espera = 1.6;
    bomba.localToWorld(tmp.set(0, 0.15, 0));
    ctx.efectos.impacto('grande', { pos: tmp, color: 0xff6a3d, sonido: 'explosion' });
    ctx.efectos.estallido(tmp, { color: 0xffb74d, cantidad: 40, fuerza: 3.5, tam: 0.04, vida: 0.9 });
    ctx.efectos.estallido(tmp, { color: 0x424242, cantidad: 24, fuerza: 2, tam: 0.05, vida: 1.2, gravedad: -1 });
    ctx.destello(0xffe0b2, 0.9);
    ctx.sonido('bomba');
    for (const m of ctx.manos) ctx.vibrar(m, 1, 400);
    bomba.visible = false;
  }

  function terminar(gana) {
    estado = 'fin';
    espera = 6;
    victoria = gana;
    ctx.puntuacion(puntos); // a la clasificación (juegos/marcadores.js): puntos de las bombas desactivadas
    if (puntos > record) {
      record = puntos;
      ctx.guardar('record', record);
    }
    ctx.sonido('fin');
  }

  function empezarPartida() {
    puntos = 0;
    erroresPartida = 0;
    aviso = null;
    for (const m of manos) m.agarre = null;
    armarBomba(0);
  }

  // ─── Acciones sobre las piezas (iguales con ratón y en VR) ────────────
  function tocarPieza(datos, mano) {
    const m = datos.modulo;
    if (estado !== 'bomba' || !m.activo || m.resuelto || aparicion < 1) return; // nada mientras la bomba aparece
    if (m.tipo === 'cables') {
      const h = cables.hilos[datos.indice];
      if (h.cortado) return;
      h.cortado = true;
      h.malla.geometry = cables.geoCortado[datos.indice];
      m.grupo.localToWorld(tmp.copy(datos.punto));
      ctx.efectos.estallido(tmp, { color: 0xffe082, cantidad: 6, fuerza: 1.2, tam: 0.01 });
      ctx.sonido('clac');
      if (cables.orden[cables.paso] === datos.indice) {
        cables.paso++;
        dibujarPantallaCables();
        if (cables.paso >= cables.orden.length) moduloResuelto(m, mano);
        else ctx.efectos.impacto('pequeño', { pos: tmp, mano, color: 0xb9f6ca });
      } else error(m, mano);
    } else if (m.tipo === 'botones') {
      const b = botones.teclas[datos.indice];
      b.hundido = 1;
      m.grupo.localToWorld(tmp.copy(datos.punto));
      if (botones.secuencia[botones.paso] === datos.indice) {
        botones.progreso[botones.paso].material.color.setHex(COLOR_LED_VERDE);
        botones.paso++;
        if (botones.paso >= 3) {
          botones.luz.material.color.setHex(0x333333);
          moduloResuelto(m, mano);
        } else {
          ctx.efectos.impacto('pequeño', { pos: tmp, mano, color: b.color, sonido: 'boton' });
          // La luz se apaga un momento y cambia de color
          botones.luz.material.color.setHex(0x333333);
          botones.cambio = 0.25;
        }
      } else error(m, mano);
    } else if (m.tipo === 'palancas') {
      const p = palancas.interruptores[datos.indice];
      p.arriba = !p.arriba;
      ctx.sonido('toc');
      if (mano) ctx.vibrar(mano, 0.3, 30);
      if (palancas.interruptores.every((x) => x.arriba === x.objetivo)) moduloResuelto(m, mano);
    } else if (m.tipo === 'rueda' && !mano) {
      // Con ratón, cada toque la gira un paso (en VR se coge y se gira con la muñeca)
      rueda.paso = (rueda.paso + 1) % 8;
      ctx.sonido('tic');
      if (rueda.paso === rueda.objetivo) {
        rueda.comprobar = 0.35;
      }
    }
  }

  // ─── Ratón y móvil ─────────────────────────────────────────────────────
  function piezaBajoPuntero() {
    for (const p of piezas) p.updateMatrixWorld();
    const choques = ctx.raton.rayo.intersectObjects(piezas, false);
    for (const c of choques) {
      const d = c.object.userData.pieza;
      if (d.modulo.activo && d.modulo.grupo.visible) return d;
    }
    return null;
  }
  function actualizarRaton() {
    if (estado !== 'bomba' || !ctx.raton.clic) return;
    const d = piezaBajoPuntero();
    if (d) tocarPieza(d, null);
  }

  // ─── VR ────────────────────────────────────────────────────────────────
  function actualizarVR(dt) {
    // Los alicates están en la mesa: solo se ven con cables por cortar y, si no los lleva una mano, vuelven a la mesa
    const hayCables = estado === 'bomba' && cables.activo && !cables.resuelto;
    if (!hayCables) manos.forEach((m) => { m.tiene = false; });
    alicatesMesa.visible = hayCables && !manos.some((m) => m.tiene);
    manos.forEach((m) => {
      m.alicates.visible = m.tiene;
      m.dedo.visible = m.mano.activa && !m.tiene;
      m.matPunta.color.setHex(0xffffff);
      const cerrado = m.mano.gatillo ? 0 : 0.22;
      m.mitades[0].rotation.y = cerrado;
      m.mitades[1].rotation.y = -cerrado;
      if (!m.mano.activa) {
        m.agarre = null;
        return;
      }
      // Punta de los alicates
      m.mano.grip.localToWorld(m.punta.set(0, -0.01, -0.092));
      m.mano.grip.getWorldQuaternion(m.quat);
      if (m.agarre) {
        girarRueda(m);
        if (!m.mano.gatillo) soltarRueda(m);
        return;
      }
      if (estado !== 'bomba' || aparicion < 1) return;
      const pulsa = m.mano.gatilloPulsado;
      // Coger los alicates de la mesa
      if (pulsa && alicatesMesa.visible &&!m.tiene && m.punta.distanceTo(alicatesMesa.position) < R_COGER) {
        m.tiene = true;
        alicatesMesa.visible = false;
        ctx.vibrar(m.mano, 0.4, 40);
        ctx.sonido('clac');
        return;
      }
      // La pieza más cercana a la punta
      let mejor = null;
      let distancia = R_TOCAR;
      for (const p of piezas) {
        const d = p.userData.pieza;
        if (!d.modulo.activo || d.modulo.resuelto) continue;
        if (d.modulo.tipo === 'cables' && !m.tiene) continue; // los cables solo se cortan con los alicates
        d.modulo.grupo.localToWorld(tmp.copy(d.punto));
        const dist = tmp.distanceTo(m.punta);
        const limite = d.modulo.tipo === 'rueda' ? R_TOCAR + 0.02 : R_TOCAR;
        if (dist < limite && (!mejor || dist < distancia)) {
          mejor = d;
          distancia = dist;
        }
      }
      if (!mejor) return;
      m.matPunta.color.setHex(0x69f0ae); // pieza al alcance
      if (!pulsa) return;
      if (mejor.modulo.tipo === 'rueda') {
        m.agarre = rueda;
        m.quatInicial.copy(m.quat);
        m.ruedaInicial = rueda.angulo;
        ctx.vibrar(m.mano, 0.3, 30);
        ctx.sonido('tic');
      } else tocarPieza(mejor, m.mano);
    });
  }

  // Cuánto ha girado la muñeca alrededor de la normal de la tapa desde que se cogió la rueda
  // (la parte de «giro» de la rotación relativa del mando)
  function girarRueda(m) {
    relativa.copy(m.quat).multiply(inversa.copy(m.quatInicial).invert());
    eje.set(0, 1, 0).applyQuaternion(bomba.quaternion);
    let d = 2 * Math.atan2(relativa.x * eje.x + relativa.y * eje.y + relativa.z * eje.z, relativa.w);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    rueda.angulo = m.ruedaInicial + d;
    const paso = ((Math.round(-rueda.angulo / (Math.PI / 4)) % 8) + 8) % 8;
    if (paso !== rueda.paso) {
      rueda.paso = paso;
      ctx.sonido('tic');
      ctx.vibrar(m.mano, paso === rueda.objetivo ? 0.6 : 0.15, 20);
    }
  }
  function soltarRueda(m) {
    m.agarre = null;
    if (estado === 'bomba' && rueda.activo && !rueda.resuelto && rueda.paso === rueda.objetivo) moduloResuelto(rueda, m.mano);
  }

  // ─── Animaciones de las piezas ─────────────────────────────────────────
  function animarPiezas(dt) {
    for (const b of botones.teclas) {
      b.hundido = Math.max(0, b.hundido - dt * 6);
      b.malla.position.y = 0.022 - b.hundido * 0.007;
    }
    if (botones.cambio > 0) {
      botones.cambio -= dt;
      if (botones.cambio <= 0 && !botones.resuelto) botones.luz.material.color.setHex(COLORES_BOTON[botones.secuencia[botones.paso]]);
    }
    for (const p of palancas.interruptores) {
      const objetivo = p.arriba ? -0.8 : 0.8;
      p.angulo += (objetivo - p.angulo) * Math.min(1, dt * 22);
      p.eje.rotation.x = p.angulo;
    }
    // La rueda: con ratón, gira suave hasta su paso; en VR la mueve la mano y al soltarla encaja
    if (!manos.some((m) => m.agarre)) {
      const objetivo = -rueda.paso * (Math.PI / 4);
      let d = objetivo - rueda.angulo;
      while (d > Math.PI) d -= Math.PI * 2;
      while (d < -Math.PI) d += Math.PI * 2;
      rueda.angulo += d * Math.min(1, dt * 16);
    }
    rueda.mando.rotation.y = rueda.angulo;
    if (rueda.comprobar > 0) {
      rueda.comprobar -= dt;
      if (rueda.comprobar <= 0 && estado === 'bomba' && rueda.activo && !rueda.resuelto && rueda.paso === rueda.objetivo) moduloResuelto(rueda, null);
    }
    // Brillo y salto del módulo recién resuelto
    for (const m of Object.values(modulos)) {
      m.brillo = Math.max(0, m.brillo - dt * 2.5);
      m.grupo.scale.setScalar(1 + Math.sin(m.brillo * Math.PI) * 0.06);
    }
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function actualizar(dt) {
    tiempo += dt;
    ayuda += dt;
    if (aviso && (aviso.tiempo -= dt) <= 0) aviso = null;
    if (estado === 'intro') {
      espera -= dt;
      dibujarReloj('--:--', '#ff3d3d');
      if (espera <= 0) empezarPartida();
    } else if (estado === 'bomba') {
      restante -= dt * velocidad;
      const s = Math.ceil(restante);
      if (s !== segundoAnterior) {
        segundoAnterior = s;
        ctx.sonido('tic');
        if (s <= 5) for (const m of ctx.manos) ctx.vibrar(m, 0.2, 30);
      }
      if (restante <= 0) {
        restante = 0;
        explotar();
      }
      const seg = Math.max(0, restante);
      dibujarReloj(`${String(Math.floor(seg / 60)).padStart(2, '0')}:${String(Math.floor(seg % 60)).padStart(2, '0')}`, seg <= 10 ? '#ff5252' : '#ff3d3d');
      matPiloto.color.setHex(Math.floor(tiempo * (seg <= 10 ? 6 : 2)) % 2 ? 0xff1744 : 0x3a0808);
    } else if (estado === 'desactivada') {
      espera -= dt;
      if (espera <= 0) {
        if (bomba.indice + 1 < BOMBAS.length) {
          armarBomba(bomba.indice + 1);
          avisar(ctx.t('siguiente'), '#ffe082', 2);
        } else terminar(true);
      }
    } else if (estado === 'explota') {
      espera -= dt;
      if (espera <= 0) terminar(false);
    } else if (estado === 'fin') {
      espera -= dt;
      if (espera <= 0) {
        bomba.visible = true;
        empezarPartida();
      }
    }
    // La bomba nueva aparece con un pequeño rebote
    aparicion = Math.min(1, aparicion + dt / 0.45);
    bomba.scale.setScalar(Math.max(0.01, rebote(aparicion)));
    sombraBomba.visible = bomba.visible;

    if (ctx.enVR()) actualizarVR(dt);
    else {
      colocarVista();
      actualizarRaton();
    }
    animarPiezas(dt);
    escribirMarcador();
  }

  escribirMarcador();

  return {
    actualizar,
    liberar() {
      // La shell retira lo que hay en la escena y en las manos y los recursos registrados.
      piezas.length = 0;
    },
  };
}
