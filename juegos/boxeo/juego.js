// SACO DE BOXEO
// Gimnasio de boxeo con un saco colgado delante. En el saco se encienden dianas:
// dales un puñetazo antes de que se apaguen. Las doradas valen 3, encadenar aciertos
// sube el multiplicador (hasta ×4) y un directo potente suma 1 más. Si una diana se
// apaga sin golpearla, se pierde la racha. Asaltos de 60 segundos.
// En VR llevas un guante en cada mano; sin gafas, haz clic o toca la diana.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const DURACION = 60;
const ANCLAJE = new THREE.Vector3(0, 2.4, -0.64); // donde cuelga la cadena del saco
const LARGO = 1.1;               // del anclaje al centro del saco
const R_SACO = 0.18;
const ALTO_SACO = 1.0;
const R_GUANTE = 0.07;
const VEL_GOLPE = 1.0;           // m/s mínimos hacia el saco para que cuente el puñetazo
const VEL_POTENTE = 3.2;         // y para que sea un directo potente
const R_DIANA = 0.068;
const ALCANCE_DIANA = 0.1;       // distancia del golpe al centro de la diana para acertarla
const MAX_DIANAS = 3;
const POR_MULTIPLICADOR = 6;     // aciertos seguidos para subir el multiplicador
const MAX_MULTIPLICADOR = 4;
// Dificultad a lo largo del asalto (0 al empezar, 1 al final)
const VIDA_INICIO = 1.7;
const VIDA_FINAL = 0.8;
const CADENCIA_INICIO = 0.95;
const CADENCIA_FINAL = 0.38;
const PRUEBA_DORADA = 0.12;
// Ratón: guantes delante de la cámara y cuánto dura el puñetazo
const REPOSO_RATON = [new THREE.Vector3(-0.21, 1.27, 0.08), new THREE.Vector3(0.21, 1.27, 0.08)];
const T_PUNO = 0.2;

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  // Gimnasio de barrio por la tarde: luz cálida por los ventanales
  ctx.fondo(0x3a3330, { cenit: 0x221d1b, horizonte: 0x4a3f38, suelo: 0x2a2420, niebla: [10, 22] });
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.55, 0.5), new THREE.Vector3(0, 1.3, ANCLAJE.z));

  const matrizTmp = new THREE.Matrix4();
  const eulerTmp = new THREE.Euler();
  function colocar(geo, x, y, z, rx = 0, ry = 0, rz = 0) {
    matrizTmp.makeRotationFromEuler(eulerTmp.set(rx, ry, rz)).setPosition(x, y, z);
    return geo.applyMatrix4(matrizTmp);
  }
  // Fusiona varias geometrías (position/normal/uv) en una: una sola llamada de dibujo
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

  // ─── Gimnasio ──────────────────────────────────────────────────────────
  ctx.sueloBase(false);
  // Suelo de tarima y, en la zona del saco, una plancha de goma
  const suelo = new THREE.Mesh(
    R(new THREE.PlaneGeometry(10, 10)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tablas(0x9a6a40, { tablas: 8, repetir: [5, 5], tam: 512, semilla: 21 })) })),
  );
  suelo.rotation.x = -Math.PI / 2;
  const goma = new THREE.Mesh(
    R(new THREE.PlaneGeometry(1.8, 2.2)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.grano(0x2b2d30, { repetir: [2, 2], semilla: 22, contraste: 0.1, cantidad: 2400 })) })),
  );
  goma.rotation.x = -Math.PI / 2;
  goma.position.set(0, 0.004, -0.5);
  raiz.add(suelo, goma);
  // Paredes de ladrillo pintado con un zócalo rojo
  const texPared = R(ctx.texturas.ladrillos(0xd8d0c0, 0xa8a090, { filas: 12, columnas: 4, repetir: [3, 1.5], tam: 512, semilla: 23 }));
  const matPared = R(new THREE.MeshLambertMaterial({ map: texPared }));
  const paredes = new THREE.Mesh(
    fusionar([
      colocar(new THREE.PlaneGeometry(10, 4), 0, 2, -3.2),
      colocar(new THREE.PlaneGeometry(8, 4), -3.6, 2, 0.8, 0, Math.PI / 2),
      colocar(new THREE.PlaneGeometry(8, 4), 3.6, 2, 0.8, 0, -Math.PI / 2),
    ]),
    matPared,
  );
  const zocalo = new THREE.Mesh(
    fusionar([
      colocar(new THREE.PlaneGeometry(10, 0.9), 0, 0.45, -3.19),
      colocar(new THREE.PlaneGeometry(8, 0.9), -3.59, 0.45, 0.8, 0, Math.PI / 2),
      colocar(new THREE.PlaneGeometry(8, 0.9), 3.59, 0.45, 0.8, 0, -Math.PI / 2),
    ]),
    R(new THREE.MeshLambertMaterial({ color: 0x9e2a2a })),
  );
  raiz.add(paredes, zocalo);
  // Ventanales altos con la luz de la tarde (brillan solos, sin luces nuevas)
  const texVentana = R(ctx.texturaCanvas((g, tam) => {
    const d = g.createLinearGradient(0, 0, 0, tam);
    d.addColorStop(0, '#ffe2a8');
    d.addColorStop(1, '#f2a65a');
    g.fillStyle = d;
    g.fillRect(0, 0, tam, tam);
    g.fillStyle = '#2a2420';
    const barra = tam * 0.04;
    g.fillRect(0, 0, tam, barra);
    g.fillRect(0, tam - barra, tam, barra);
    g.fillRect(0, 0, barra, tam);
    g.fillRect(tam - barra, 0, barra, tam);
    g.fillRect(tam / 2 - barra / 2, 0, barra, tam);
    g.fillRect(0, tam / 2 - barra / 2, tam, barra);
  }, { tam: 128 }));
  const ventanas = new THREE.Mesh(
    fusionar([-2.4, -0.8, 0.8, 2.4].map((x) => colocar(new THREE.PlaneGeometry(1.1, 0.9), x, 2.9, -3.18))),
    R(new THREE.MeshBasicMaterial({ map: texVentana, toneMapped: false })),
  );
  raiz.add(ventanas);
  // Techo y viga de la que cuelga el saco
  const matViga = R(new THREE.MeshLambertMaterial({ color: 0x2f3236 }));
  const techo = new THREE.Mesh(R(new THREE.PlaneGeometry(10, 10)), R(new THREE.MeshLambertMaterial({ color: 0x3a3634 })));
  techo.rotation.x = Math.PI / 2;
  techo.position.y = 3.6;
  const viga = new THREE.Mesh(
    fusionar([
      colocar(new THREE.BoxGeometry(7.2, 0.24, 0.16), 0, 3.48, ANCLAJE.z),
      colocar(new THREE.BoxGeometry(0.06, 1.0, 0.06), 0, ANCLAJE.y + 0.5, ANCLAJE.z),
    ]),
    matViga,
  );
  raiz.add(techo, viga);
  // Lámparas industriales del techo
  const geoLampara = R(new THREE.CylinderGeometry(0.08, 0.28, 0.2, 20, 1, true));
  const geoBombilla = R(new THREE.SphereGeometry(0.07, 10, 8));
  const matLampara = R(new THREE.MeshLambertMaterial({ color: 0x2d4a3a, side: THREE.DoubleSide }));
  const matBombilla = R(new THREE.MeshBasicMaterial({ color: 0xfff1cc, toneMapped: false }));
  for (const [x, z] of [[-2, -1.6], [2, -1.6], [-2, 1.2], [2, 1.2]]) {
    const pantalla = new THREE.Mesh(geoLampara, matLampara);
    pantalla.position.set(x, 3.2, z);
    const bombilla = new THREE.Mesh(geoBombilla, matBombilla);
    bombilla.position.set(x, 3.12, z);
    raiz.add(pantalla, bombilla);
  }

  // Cuadrilátero al fondo a la izquierda: lona, postes de las esquinas y cuerdas
  const ring = new THREE.Group();
  ring.position.set(-2.1, 0, -2.0);
  ring.rotation.y = 0.35;
  const lona = new THREE.Mesh(
    R(new THREE.BoxGeometry(2.6, 0.5, 2.6)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tela(0x1f4f8a, { repetir: [2, 2], semilla: 24 })) })),
  );
  lona.position.y = 0.25;
  ring.add(lona);
  const piezasPostes = [];
  const piezasCuerdas = [];
  for (const [x, z] of [[-1.25, -1.25], [1.25, -1.25], [1.25, 1.25], [-1.25, 1.25]]) {
    piezasPostes.push(colocar(new THREE.CylinderGeometry(0.05, 0.05, 1.3, 10), x, 1.15, z));
  }
  for (const altura of [0.85, 1.15, 1.45]) {
    piezasCuerdas.push(
      colocar(new THREE.CylinderGeometry(0.018, 0.018, 2.5, 6), 0, altura, -1.25, 0, 0, Math.PI / 2),
      colocar(new THREE.CylinderGeometry(0.018, 0.018, 2.5, 6), 0, altura, 1.25, 0, 0, Math.PI / 2),
      colocar(new THREE.CylinderGeometry(0.018, 0.018, 2.5, 6), -1.25, altura, 0, Math.PI / 2),
      colocar(new THREE.CylinderGeometry(0.018, 0.018, 2.5, 6), 1.25, altura, 0, Math.PI / 2),
    );
  }
  ring.add(
    new THREE.Mesh(fusionar(piezasPostes), R(new THREE.MeshLambertMaterial({ color: 0xc62828 }))),
    new THREE.Mesh(fusionar(piezasCuerdas), R(new THREE.MeshLambertMaterial({ color: 0xf2f2f2 }))),
  );
  const sombraRing = ctx.crearSombra({ radio: 1.9, opacidad: 0.45 });
  sombraRing.position.y = 0.003;
  ring.add(sombraRing);
  raiz.add(ring);

  // Banco con mancuernas a la derecha y carteles de combates en la pared
  const matBanco = R(new THREE.MeshLambertMaterial({ color: 0x1d1d1f }));
  const banco = new THREE.Mesh(
    fusionar([
      colocar(new THREE.BoxGeometry(0.4, 0.08, 1.4), 2.6, 0.45, -1.4),
      colocar(new THREE.BoxGeometry(0.06, 0.45, 0.06), 2.6, 0.22, -2.0),
      colocar(new THREE.BoxGeometry(0.06, 0.45, 0.06), 2.6, 0.22, -0.8),
      colocar(new THREE.CylinderGeometry(0.02, 0.02, 0.36, 8), 2.6, 0.52, -1.0, 0, 0, Math.PI / 2),
      colocar(new THREE.CylinderGeometry(0.06, 0.06, 0.07, 12), 2.45, 0.52, -1.0, 0, 0, Math.PI / 2),
      colocar(new THREE.CylinderGeometry(0.06, 0.06, 0.07, 12), 2.75, 0.52, -1.0, 0, 0, Math.PI / 2),
    ]),
    matBanco,
  );
  const sombraBanco = ctx.crearSombra({ radio: 0.6, opacidad: 0.4 });
  sombraBanco.scale.set(0.6, 1, 1.5);
  sombraBanco.position.set(2.6, 0.003, -1.4);
  raiz.add(banco, sombraBanco);
  const texCartel = R(ctx.texturaCanvas((g, tam) => {
    // Dos carteles en la misma textura (mitad izquierda y derecha): dos guantes que chocan
    for (const [x0, fondo, guante] of [[0, '#f2c14e', '#b71c1c'], [tam / 2, '#e8e4da', '#1e4fa0']]) {
      g.fillStyle = fondo;
      g.fillRect(x0, 0, tam / 2, tam);
      g.fillStyle = '#1c1c1c';
      g.fillRect(x0 + tam * 0.04, tam * 0.06, tam * 0.42, tam * 0.1);
      g.fillRect(x0 + tam * 0.04, tam * 0.82, tam * 0.42, tam * 0.06);
      g.fillStyle = guante;
      g.beginPath();
      g.ellipse(x0 + tam * 0.17, tam * 0.48, tam * 0.1, tam * 0.13, -0.4, 0, Math.PI * 2);
      g.ellipse(x0 + tam * 0.33, tam * 0.48, tam * 0.1, tam * 0.13, 0.4, 0, Math.PI * 2);
      g.fill();
      g.fillStyle = '#ff6a3d';
      g.beginPath();
      g.arc(x0 + tam * 0.25, tam * 0.4, tam * 0.04, 0, Math.PI * 2);
      g.fill();
    }
  }, { tam: 256 }));
  const geoCartel1 = new THREE.PlaneGeometry(0.7, 1.0);
  const geoCartel2 = new THREE.PlaneGeometry(0.7, 1.0);
  for (const [geo, u0] of [[geoCartel1, 0], [geoCartel2, 0.5]]) {
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, u0 + uv.getX(i) * 0.5);
  }
  const carteles = new THREE.Mesh(
    fusionar([colocar(geoCartel1, 1.4, 1.75, -3.17), colocar(geoCartel2, 2.3, 1.75, -3.17), colocar(new THREE.PlaneGeometry(0.7, 1.0).translate(0, 0, 0), 3.58, 1.75, -0.6, 0, -Math.PI / 2)]),
    R(new THREE.MeshLambertMaterial({ map: texCartel })),
  );
  raiz.add(carteles);

  // ─── Saco ──────────────────────────────────────────────────────────────
  // Péndulo: el grupo gira en el anclaje y el saco cuelga LARGO metros por debajo
  const pendulo = new THREE.Group();
  pendulo.position.copy(ANCLAJE);
  raiz.add(pendulo);
  const saco = new THREE.Group();
  saco.position.y = -LARGO;
  pendulo.add(saco);
  // Cuero rojo con franjas negras arriba y abajo y costuras verticales
  const texCuero = R(ctx.texturaCanvas((g, tam, azar) => {
    g.fillStyle = '#a82424';
    g.fillRect(0, 0, tam, tam);
    for (let i = 0; i < 1600; i++) {
      g.fillStyle = azar() < 0.5 ? `rgba(255,255,255,${azar() * 0.05})` : `rgba(0,0,0,${azar() * 0.12})`;
      g.fillRect(azar() * tam, azar() * tam, 2, 2);
    }
    g.fillStyle = '#151515';
    g.fillRect(0, 0, tam, tam * 0.13);
    g.fillRect(0, tam * 0.87, tam, tam * 0.13);
    g.fillRect(0, tam * 0.44, tam, tam * 0.03);
    g.strokeStyle = 'rgba(0,0,0,0.35)';
    g.lineWidth = 2;
    for (let i = 0; i < 6; i++) {
      const x = (i + 0.5) * (tam / 6);
      g.setLineDash([5, 4]);
      g.beginPath();
      g.moveTo(x, tam * 0.13);
      g.lineTo(x, tam * 0.87);
      g.stroke();
    }
  }, { tam: 256, semilla: 25 }));
  const perfil = [];
  const mitad = ALTO_SACO / 2;
  perfil.push(new THREE.Vector2(0, -mitad));
  for (let i = 0; i <= 6; i++) {
    const a = (i / 6) * (Math.PI / 2);
    perfil.push(new THREE.Vector2(Math.sin(a) * R_SACO, -mitad + 0.05 - Math.cos(a) * 0.05));
  }
  for (let i = 6; i >= 0; i--) {
    const a = (i / 6) * (Math.PI / 2);
    perfil.push(new THREE.Vector2(Math.sin(a) * R_SACO, mitad - 0.05 + Math.cos(a) * 0.05));
  }
  perfil.push(new THREE.Vector2(0, mitad));
  // Transparente desde el principio (con opacidad 1 se ve igual): así puede desvanecerse en VR
  // cuando tapa el cartel sin tener que recompilar el material
  const matSaco = R(new THREE.MeshPhongMaterial({ map: texCuero, shininess: 55, specular: 0x5a4040, transparent: true }));
  const cuerpoSaco = new THREE.Mesh(R(new THREE.LatheGeometry(perfil, 40)), matSaco);
  saco.add(cuerpoSaco);
  // Cadenas: cuatro desde el aro del saco hasta el anclaje (una malla con eslabones)
  const piezasCadena = [];
  const arriba = new THREE.Vector3(0, LARGO, 0);
  const giroEslabon = new THREE.Quaternion();
  for (let k = 0; k < 4; k++) {
    const a = (k / 4) * Math.PI * 2 + Math.PI / 4;
    const base = new THREE.Vector3(Math.cos(a) * R_SACO * 0.8, mitad, Math.sin(a) * R_SACO * 0.8);
    // Cada eslabón, alargado e inclinado en la dirección de la cadena
    giroEslabon.setFromUnitVectors(THREE.Object3D.DEFAULT_UP, arriba.clone().sub(base).normalize());
    const eslabones = 12;
    for (let i = 0; i < eslabones; i++) {
      const p = base.clone().lerp(arriba, (i + 0.5) / eslabones);
      const eslabon = new THREE.TorusGeometry(0.014, 0.004, 4, 8);
      eslabon.scale(1, 1.6, 1);
      eslabon.rotateY(i % 2 ? Math.PI / 2 : 0);
      eslabon.applyQuaternion(giroEslabon);
      piezasCadena.push(eslabon.translate(p.x, p.y, p.z));
    }
  }
  const cadenas = new THREE.Mesh(fusionar(piezasCadena), R(new THREE.MeshStandardMaterial({ color: 0xb0b4b8, metalness: 0.8, roughness: 0.35 })));
  saco.add(cadenas);
  const sombraSaco = ctx.crearSombra({ radio: 0.32, opacidad: 0.5 });
  raiz.add(sombraSaco);

  // ─── Dianas del saco ───────────────────────────────────────────────────
  // Un disco curvado como la superficie del saco, con su centro en el origen: así crece y
  // encoge sobre el sitio sin despegarse del cuero
  function discoCurvo(radio, rSuperficie) {
    const geo = new THREE.CircleGeometry(radio, 28);
    const p = geo.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const a = p.getX(i) / rSuperficie;
      p.setXYZ(i, Math.sin(a) * rSuperficie, p.getY(i), Math.cos(a) * rSuperficie - rSuperficie);
    }
    geo.computeVertexNormals();
    return R(geo);
  }
  const R_SUPERFICIE = R_SACO + 0.005;
  const geoDiana = discoCurvo(R_DIANA, R_SUPERFICIE);
  const geoCerco = discoCurvo(R_DIANA * 1.2, R_SUPERFICIE - 0.002);
  const texDiana = R(ctx.texturaCanvas((g, tam) => {
    const c = tam / 2;
    g.clearRect(0, 0, tam, tam);
    const d = g.createRadialGradient(c, c, 0, c, c, c);
    d.addColorStop(0, '#ffffff');
    d.addColorStop(0.25, '#ffffff');
    d.addColorStop(0.3, '#ffffff00');
    d.addColorStop(0.55, '#ffffff00');
    d.addColorStop(0.6, '#ffffff');
    d.addColorStop(0.8, '#ffffff');
    d.addColorStop(1, '#ffffff00');
    g.fillStyle = d;
    g.fillRect(0, 0, tam, tam);
  }, { tam: 128 }));
  texDiana.wrapS = texDiana.wrapT = THREE.ClampToEdgeWrapping;
  const matNormal = R(new THREE.MeshBasicMaterial({ color: 0xffb74d, map: texDiana, transparent: true, depthWrite: false, toneMapped: false }));
  const matDorada = R(new THREE.MeshBasicMaterial({ color: 0xffe066, map: texDiana, transparent: true, depthWrite: false, toneMapped: false }));
  // Cerco oscuro detrás de la diana para que destaque sobre el cuero
  const matCerco = R(new THREE.MeshBasicMaterial({ color: 0x120a08, transparent: true, opacity: 0.55, depthWrite: false }));
  const dianas = [];
  for (let i = 0; i < MAX_DIANAS; i++) {
    // giro: lo coloca alrededor del saco; cara: en la superficie, es lo que crece y encoge
    const grupo = new THREE.Group();
    const cara = new THREE.Group();
    cara.position.z = R_SUPERFICIE;
    const cerco = new THREE.Mesh(geoCerco, matCerco);
    cerco.renderOrder = 1;
    const disco = new THREE.Mesh(geoDiana, matNormal);
    disco.renderOrder = 2;
    cara.add(cerco, disco);
    grupo.add(cara);
    grupo.visible = false;
    saco.add(grupo);
    // pos: posición en la superficie (coordenadas del saco), para comprobar los golpes
    dianas.push({ grupo, cara, disco, activa: false, vida: 0, duracion: 1, dorada: false, angulo: 0, altura: 0, pos: new THREE.Vector3() });
  }

  // ─── Guantes ───────────────────────────────────────────────────────────
  // Puño acolchado, pulgar, puño de la muñeca y cinta blanca. Los nudillos miran a -Z.
  const geoPuno = R(new THREE.SphereGeometry(1, 22, 16));
  const geoPulgar = R(new THREE.CapsuleGeometry(0.019, 0.045, 4, 10));
  const geoMuneca = R(new THREE.CylinderGeometry(0.042, 0.047, 0.075, 18));
  const geoCinta = R(new THREE.CylinderGeometry(0.0435, 0.0435, 0.022, 18));
  const matGuante = R(new THREE.MeshStandardMaterial({ color: 0xc62828, roughness: 0.38, metalness: 0.05 }));
  const matCinta = R(new THREE.MeshStandardMaterial({ color: 0xf4f1ea, roughness: 0.7 }));
  function crearGuante(lado) {
    const guante = new THREE.Group();
    const puno = new THREE.Mesh(geoPuno, matGuante);
    puno.scale.set(0.064, 0.058, 0.08);
    puno.position.z = -0.05;
    const pulgar = new THREE.Mesh(geoPulgar, matGuante);
    pulgar.position.set(-lado * 0.052, 0.006, -0.045);
    pulgar.rotation.set(Math.PI / 2, 0, 0.35 * lado);
    const muneca = new THREE.Mesh(geoMuneca, matGuante);
    muneca.rotation.x = Math.PI / 2;
    muneca.position.z = 0.055;
    const cinta = new THREE.Mesh(geoCinta, matCinta);
    cinta.rotation.x = Math.PI / 2;
    cinta.position.z = 0.06;
    guante.add(puno, pulgar, muneca, cinta);
    return guante;
  }
  const guantes = ctx.manos.map((mano, i) => {
    const objeto = crearGuante(i === 0 ? -1 : 1);
    // El puño queda delante del mando, con los nudillos hacia delante
    objeto.position.set(0, -0.01, 0.01);
    objeto.rotation.x = -0.35;
    ctx.adjuntarAMano(mano, objeto);
    return {
      mano, objeto, lado: null, centro: new THREE.Vector3(), anterior: new THREE.Vector3(), vel: new THREE.Vector3(),
      listo: false, dentro: false,
    };
  });
  const CENTRO_PUNO = new THREE.Vector3(0, -0.01 - 0.017, -0.037); // centro del puño en el espacio del mando

  // Guantes del ratón: uno a cada lado; golpean por turnos
  const guantesRaton = REPOSO_RATON.map((reposo, i) => {
    const objeto = crearGuante(i === 0 ? -1 : 1);
    objeto.position.copy(reposo);
    raiz.add(objeto);
    return { objeto, reposo, t: 0, objetivo: new THREE.Vector3() };
  });
  let turnoRaton = 0;

  // ─── Marcador ──────────────────────────────────────────────────────────
  // Que el saco (y su balanceo) nunca tape la puntuación ni la explicación:
  // - en VR, a la derecha y por encima del saco, de cara a los ojos; si aun así el saco se pone
  //   delante (al moverte o al balancearse), el saco se vuelve semitransparente (ver transparentarSaco);
  // - con ratón, a la derecha y por encima del saco;
  // - con el móvil en vertical no cabe a un lado: abajo, sobre la lona.
  const marcador = ctx.crearPanel({ ancho: 0.72, alto: 0.24 });
  raiz.add(marcador.mesh);
  let modoMarcador = null;
  function colocarMarcador() {
    const modo = ctx.enVR() ? 'vr' : ctx.camara.aspect < 1 ? 'vertical' : 'pantalla';
    if (modo === modoMarcador) return;
    modoMarcador = modo;
    if (modo === 'vr') {
      marcador.mesh.position.set(0.75, 1.86, -0.9);
      marcador.mesh.rotation.set(0, 0, 0);
      marcador.mesh.lookAt(0, 1.6, 0); // de cara a los ojos
      marcador.mesh.scale.setScalar(1);
    } else if (modo === 'vertical') {
      marcador.mesh.position.set(0, 0.62, -0.3);
      marcador.mesh.rotation.set(-0.75, 0, 0);
      marcador.mesh.scale.setScalar(1);
    } else {
      marcador.mesh.position.set(0.8, 1.84, -0.92);
      marcador.mesh.rotation.set(0, -0.6, 0);
      marcador.mesh.scale.setScalar(1);
    }
  }
  colocarMarcador();

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'jugando' | 'fin'
  let reloj = 3;
  let tiempoRestante = DURACION;
  let puntos = 0;
  let record = ctx.leer('record', 0);
  let racha = 0;
  let proxima = 0;
  let aviso = '';
  let avisoTiempo = 0;
  // Balanceo del saco (ángulos del péndulo y su velocidad)
  const giro = { x: 0, z: 0, vx: 0, vz: 0 };

  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const radial = new THREE.Vector3();

  const multiplicador = () => Math.min(MAX_MULTIPLICADOR, 1 + Math.floor(racha / POR_MULTIPLICADOR));

  function avisar(texto) {
    aviso = texto;
    avisoTiempo = 1.3;
  }

  function actualizarMarcador() {
    if (estado === 'intro') {
      const intro = ctx.enVR() ? ctx.t('intro') : ctx.t(ctx.tactil ? 'introTactil' : 'introRaton');
      marcador.escribir([
        { texto: ctx.t('titulo'), tam: 1.3, color: '#ffab91' },
        { texto: intro, tam: 0.72 },
      ]);
    } else if (estado === 'fin') {
      marcador.escribir([
        { texto: ctx.t('partida.tiempoPuntos', { n: puntos }), tam: 1.3, color: '#ffab91' },
        { texto: ctx.t('partida.recordNuevaRonda', { record, n: Math.max(1, Math.ceil(reloj)) }), tam: 0.72 },
      ]);
    } else {
      marcador.escribir([
        { texto: ctx.t('partida.puntosTiempo', { puntos, s: Math.ceil(tiempoRestante) }), tam: 1.25 },
        avisoTiempo > 0
          ? { texto: aviso, tam: 0.8, color: '#ffcc80' }
          : { texto: ctx.t('racha', { x: multiplicador(), record }), tam: 0.72, color: '#ffe0b2' },
      ]);
    }
  }

  function encenderDiana(progreso) {
    const libre = dianas.find((d) => !d.activa);
    if (!libre) return;
    // Un sitio de la cara delantera que no pise a otra diana encendida
    for (let intento = 0; intento < 8; intento++) {
      libre.angulo = THREE.MathUtils.degToRad(-50 + Math.random() * 100);
      libre.altura = -0.3 + Math.random() * 0.62;
      libre.pos.set(Math.sin(libre.angulo) * R_SACO, libre.altura, Math.cos(libre.angulo) * R_SACO);
      if (dianas.every((d) => d === libre || !d.activa || d.pos.distanceTo(libre.pos) > 0.2)) break;
    }
    libre.activa = true;
    libre.vida = 0;
    libre.duracion = THREE.MathUtils.lerp(VIDA_INICIO, VIDA_FINAL, progreso);
    libre.dorada = Math.random() < PRUEBA_DORADA;
    libre.disco.material = libre.dorada ? matDorada : matNormal;
    libre.grupo.rotation.y = libre.angulo;
    libre.grupo.position.y = libre.altura;
    libre.grupo.visible = true;
    ctx.sonido('tic');
  }

  function animarDianas(dt) {
    for (const d of dianas) {
      if (!d.activa) continue;
      d.vida += dt;
      const f = d.vida / d.duracion;
      // Aparece con un pequeño rebote, se encoge mientras se agota y parpadea al final
      const entrada = Math.min(1, d.vida / 0.12);
      const rebote = 1 + Math.sin(entrada * Math.PI) * 0.25;
      d.cara.scale.setScalar(Math.max(0.01, entrada * rebote * (1 - f * 0.35)));
      d.disco.visible = f < 0.75 || Math.floor(d.vida * 14) % 2 === 0;
      if (f >= 1) {
        d.activa = false;
        d.grupo.visible = false;
        if (estado === 'jugando') {
          if (racha >= POR_MULTIPLICADOR) avisar(ctx.t('rachaPerdida'));
          racha = 0;
          ctx.sonido('fallo');
        }
      }
    }
  }

  // Puñetazo en un punto del saco (coordenadas del saco). fuerza: velocidad hacia el saco (m/s)
  function golpe(local, fuerza, mano) {
    // El saco se balancea hacia donde se le empuja
    tmp2.set(-local.x, 0, -local.z).normalize();
    const empuje = Math.min(fuerza, 5) * 0.09;
    giro.vx -= tmp2.z * empuje;
    giro.vz += tmp2.x * empuje;

    let acierto = null;
    let mejor = ALCANCE_DIANA;
    for (const d of dianas) {
      if (!d.activa) continue;
      const dist = d.pos.distanceTo(local);
      if (dist < mejor) {
        mejor = dist;
        acierto = d;
      }
    }
    saco.localToWorld(tmp.copy(local));
    if (!acierto || estado !== 'jugando') {
      // Golpe al cuero: suena y vibra, pero no puntúa
      ctx.sonido('saco');
      ctx.vibrar(mano, 0.35, 35);
      return;
    }
    acierto.activa = false;
    acierto.grupo.visible = false;
    racha += 1;
    const potente = fuerza >= VEL_POTENTE;
    const valor = (acierto.dorada ? 3 : 1) * multiplicador() + (potente ? 1 : 0);
    puntos += valor;
    const nivel = acierto.dorada || potente ? 'medio' : 'pequeño';
    ctx.efectos.impacto(nivel, { pos: tmp, mano, color: acierto.dorada ? 0xffd54f : 0xff6a3d, sonido: 'saco' });
    ctx.efectos.texto(tmp, `+${valor}`, { color: acierto.dorada ? '#ffd54f' : '#ffffff', tam: nivel === 'medio' ? 1.2 : 1 });
    if (racha % POR_MULTIPLICADOR === 0 && multiplicador() > 1 && racha / POR_MULTIPLICADOR < MAX_MULTIPLICADOR) {
      avisar(ctx.t('multiplicador', { x: multiplicador() }));
      ctx.sonido('punto');
    } else if (potente) {
      avisar(ctx.t('potente'));
    }
  }

  // ─── Puñetazos con los mandos VR ───────────────────────────────────────
  function golpesVR(dt) {
    saco.updateMatrixWorld();
    for (const g of guantes) {
      if (!g.mano.activa) {
        g.listo = false;
        continue;
      }
      g.mano.grip.localToWorld(g.centro.copy(CENTRO_PUNO));
      if (!g.listo) {
        g.anterior.copy(g.centro);
        g.listo = true;
        continue;
      }
      g.vel.subVectors(g.centro, g.anterior).divideScalar(Math.max(dt, 1e-3));
      g.anterior.copy(g.centro);
      saco.worldToLocal(tmp.copy(g.centro));
      const d = Math.hypot(tmp.x, tmp.z);
      const tocando = d < R_SACO + R_GUANTE && Math.abs(tmp.y) < ALTO_SACO / 2;
      if (tocando && !g.dentro) {
        // Velocidad hacia el eje del saco (aproximada sin el pequeño balanceo)
        radial.set(tmp.x / d, 0, tmp.z / d);
        const fuerza = -g.vel.dot(radial);
        if (fuerza >= VEL_GOLPE) {
          tmp.set(radial.x * R_SACO, tmp.y, radial.z * R_SACO);
          golpe(tmp, fuerza, g.mano);
        }
        g.dentro = true;
      } else if (!tocando && d > R_SACO + R_GUANTE + 0.03) {
        g.dentro = false;
      }
    }
  }

  // ─── Puñetazos con el ratón ────────────────────────────────────────────
  function golpesRaton(dt) {
    const r = ctx.raton;
    if (r.clic) {
      const choque = r.rayo.intersectObject(cuerpoSaco, false)[0];
      const g = guantesRaton[turnoRaton];
      turnoRaton = 1 - turnoRaton;
      g.t = T_PUNO;
      if (choque) {
        g.objetivo.copy(choque.point);
        saco.worldToLocal(tmp.copy(choque.point));
        const d = Math.hypot(tmp.x, tmp.z) || 1;
        tmp.set((tmp.x / d) * R_SACO, tmp.y, (tmp.z / d) * R_SACO);
        golpe(tmp, 2.4, null);
      } else {
        r.rayo.ray.at(0.7, g.objetivo);
      }
    }
    // Animación: el guante va al punto y vuelve
    for (const g of guantesRaton) {
      g.t = Math.max(0, g.t - dt);
      const f = g.t > 0 ? Math.sin((1 - g.t / T_PUNO) * Math.PI) : 0;
      g.objeto.position.lerpVectors(g.reposo, g.objetivo, f * 0.92);
      // Los nudillos (-Z) miran al punto del golpe o, en reposo, al saco
      const mira = f > 0 ? g.objetivo : tmp2.set(g.reposo.x * 0.4, 1.75, ANCLAJE.z);
      g.objeto.lookAt(tmp.copy(g.objeto.position).multiplyScalar(2).sub(mira));
    }
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  // En VR, si el saco queda entre los ojos y el cartel, se desvanece un momento para leerlo.
  // Se comparan, vistos desde los ojos (en ángulos), el contorno del saco y el del cartel.
  const centroSaco = new THREE.Vector3();
  const esquina = new THREE.Vector3();
  const ESQUINAS = [[-0.5, -0.5], [0.5, -0.5], [-0.5, 0.5], [0.5, 0.5]];
  const matrizVista = new THREE.Matrix4();
  let opacidadSaco = 1;
  function tapaElCartel() {
    const camara = ctx.camara;
    camara.updateMatrixWorld();
    const vista = matrizVista.copy(camara.matrixWorld).invert();
    // Saco: centro en el espacio de la cámara y su tamaño aparente
    cuerpoSaco.getWorldPosition(centroSaco).applyMatrix4(vista);
    if (centroSaco.z > -0.05) return false; // detrás de la cabeza
    const dSaco = -centroSaco.z;
    const sx = Math.atan2(centroSaco.x, dSaco);
    const sy = Math.atan2(centroSaco.y, dSaco);
    const anchoSaco = Math.atan2(R_SACO, dSaco);
    const altoSaco = Math.atan2(ALTO_SACO / 2, dSaco);
    // Cartel: sus cuatro esquinas
    let x0 = Infinity, x1 = -Infinity, y0 = Infinity, y1 = -Infinity, dCartel = 0;
    const geo = marcador.mesh.geometry.parameters;
    for (const [u, v] of ESQUINAS) {
      esquina.set(u * geo.width, v * geo.height, 0);
      marcador.mesh.localToWorld(esquina).applyMatrix4(vista);
      if (esquina.z > -0.05) return false;
      const d = -esquina.z;
      x0 = Math.min(x0, Math.atan2(esquina.x, d)); x1 = Math.max(x1, Math.atan2(esquina.x, d));
      y0 = Math.min(y0, Math.atan2(esquina.y, d)); y1 = Math.max(y1, Math.atan2(esquina.y, d));
      dCartel = Math.max(dCartel, d);
    }
    const solapa = sx + anchoSaco > x0 && sx - anchoSaco < x1 && sy + altoSaco > y0 && sy - altoSaco < y1;
    return solapa && dSaco - R_SACO < dCartel;
  }
  function transparentarSaco(dt) {
    const tapa = ctx.enVR() && tapaElCartel();
    opacidadSaco += ((tapa ? 0.3 : 1) - opacidadSaco) * Math.min(1, dt * 8);
    matSaco.opacity = opacidadSaco;
    matSaco.depthWrite = opacidadSaco > 0.95; // semitransparente, que deje ver lo de detrás
  }

  function actualizar(dt) {
    colocarMarcador();
    transparentarSaco(dt);
    reloj -= dt;
    avisoTiempo -= dt;
    if (estado === 'intro' && reloj <= 0) {
      estado = 'jugando';
      tiempoRestante = DURACION;
      proxima = 0.4;
      ctx.sonido('campana');
    } else if (estado === 'jugando') {
      tiempoRestante -= dt;
      const progreso = 1 - tiempoRestante / DURACION;
      proxima -= dt;
      const maxActivas = 1 + Math.floor(progreso * MAX_DIANAS * 0.99);
      const activas = dianas.filter((d) => d.activa).length;
      if (proxima <= 0 && activas < maxActivas) {
        encenderDiana(progreso);
        proxima = THREE.MathUtils.lerp(CADENCIA_INICIO, CADENCIA_FINAL, progreso) * (0.8 + Math.random() * 0.4);
      }
      if (tiempoRestante <= 0) {
        estado = 'fin';
        reloj = 5;
        ctx.puntuacion(puntos); // a la clasificación (juegos/marcadores.js)
        if (puntos > record) {
          record = puntos;
          ctx.guardar('record', record);
        }
        ctx.sonido('campana');
        for (const d of dianas) {
          d.activa = false;
          d.grupo.visible = false;
        }
      }
    } else if (estado === 'fin' && reloj <= 0) {
      estado = 'jugando';
      puntos = 0;
      racha = 0;
      tiempoRestante = DURACION;
      proxima = 0.6;
      ctx.sonido('campana');
    }

    animarDianas(dt);

    // Péndulo amortiguado: vuelve solo al reposo
    const w2 = 9.8 / LARGO;
    giro.vx += (-w2 * giro.x - 1.6 * giro.vx) * dt;
    giro.vz += (-w2 * giro.z - 1.6 * giro.vz) * dt;
    giro.x = THREE.MathUtils.clamp(giro.x + giro.vx * dt, -0.18, 0.18);
    giro.z = THREE.MathUtils.clamp(giro.z + giro.vz * dt, -0.18, 0.18);
    pendulo.rotation.set(giro.x, 0, giro.z);
    saco.getWorldPosition(tmp);
    sombraSaco.position.set(tmp.x, 0.004, tmp.z);

    if (ctx.enVR()) {
      for (const g of guantesRaton) g.objeto.visible = false;
      golpesVR(dt);
    } else {
      for (const g of guantesRaton) g.objeto.visible = true;
      golpesRaton(dt);
    }
    actualizarMarcador();
  }

  actualizarMarcador();

  return {
    actualizar,
    liberar() {},
  };
}
