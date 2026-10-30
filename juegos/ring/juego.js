// COMBATE DE BOXEO
// Un ring de noche, con focos y público en penumbra, contra un robot de sparring que te ataca.
// Cada golpe del robot se avisa un instante antes: el guante y los ojos se encienden y suena una
// carga. Apunta a donde estaba tu cabeza al empezar el aviso: si la mueves a tiempo, lo esquivas;
// si pones un guante delante de la cara, lo bloqueas. Tras un golpe esquivado o bloqueado, el
// robot queda abierto un momento y se le encienden el mentón y el pecho: es el momento de
// contraatacar (encadenar golpes multiplica el daño). Cada combate ganado trae un robot nuevo, más
// rápido, con combos y fintas. Sin final fijo: se acaba cuando tu vida llega a cero.
// Sin gafas: mantén pulsado para subir la guardia y haz clic en el robot para pegar.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código.
export async function precargar() {}

const VIDA_JUGADOR = 100;
const Z_ROBOT = -0.85;          // a la distancia de un buen jab
const BRAZO = 0.34;             // largo de cada tramo del brazo del robot
const R_GUANTE = 0.07;
const VEL_GOLPE = 1.2;          // m/s mínimos del guante hacia el robot para que cuente
const ESQUIVA = 0.2;            // m que hay que apartar la cabeza del punto al que va el golpe
const BLOQUEO = 0.17;           // m de un guante al punto del golpe para bloquearlo
const COLORES_ROBOT = [0x3d8bff, 0xff7a2e, 0x6dff7a, 0xb36bff, 0xffd23f, 0xff3d6e];
// Golpes del robot: de dónde sale el guante (preparación, en el espacio del robot) y daño
const ATAQUES = {
  jab: { prepara: [0.18, 1.5, -0.05], dano: 10 },
  gancho: { prepara: [0.48, 1.48, 0.02], dano: 14 },
  uppercut: { prepara: [0.16, 1.0, 0.15], dano: 16 },
};
const T_GOLPE = 0.13;           // lo que tarda el guante en llegar una vez lanzado

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (r) => ctx.recurso(r);

  ctx.fondo(0x0c0d14, { cenit: 0x05060a, horizonte: 0x151826, suelo: 0x08090e, niebla: [9, 24] });
  ctx.sueloBase(false);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.62, 0.32), new THREE.Vector3(0, 1.45, Z_ROBOT));

  const matrizTmp = new THREE.Matrix4();
  const eulerTmp = new THREE.Euler();
  const colorTmp = new THREE.Color();
  const arriba = new THREE.Vector3(0, 1, 0);
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
  const caja = (w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) => colocar(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz);
  const luzSumada = (opciones = {}) => R(new THREE.MeshBasicMaterial({ transparent: true, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, ...opciones }));

  // ─── Pabellón y ring ───────────────────────────────────────────────────
  const CX = 0;
  const CZ = -0.55;               // centro del ring
  const MEDIO = 2.4;              // medio lado del ring
  // Degradado redondo (para charcos de luz y halos)
  const texRedonda = R(ctx.texturaCanvas((g, tam) => {
    const grad = g.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.5, 'rgba(255,255,255,0.45)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, tam, tam);
  }, { tam: 128 }));
  // Lona: tela azul con la estrella del centro, las esquinas roja y azul y marcas de uso
  const texLona = R(ctx.texturaCanvas((g, tam, azar) => {
    g.fillStyle = '#24508f';
    g.fillRect(0, 0, tam, tam);
    for (let i = 0; i < 3000; i++) {
      g.fillStyle = azar() < 0.5 ? `rgba(255,255,255,${azar() * 0.05})` : `rgba(0,0,0,${azar() * 0.07})`;
      g.fillRect(azar() * tam, azar() * tam, 3, 1);
    }
    // Rozaduras de las zapatillas, más hacia el centro
    for (let i = 0; i < 40; i++) {
      const a = azar() * Math.PI * 2;
      const r = azar() * tam * 0.3;
      g.fillStyle = `rgba(10,20,45,${0.05 + azar() * 0.08})`;
      g.beginPath();
      g.ellipse(tam / 2 + Math.cos(a) * r, tam / 2 + Math.sin(a) * r, 10 + azar() * 40, 4 + azar() * 10, azar() * 3, 0, Math.PI * 2);
      g.fill();
    }
    // Esquinas: roja al fondo a la izquierda, azul delante a la derecha
    for (const [x, y, c] of [[0, 0, '#c62828'], [tam, tam, '#2a4ac8']]) {
      g.fillStyle = c;
      g.beginPath();
      g.moveTo(x, y);
      g.lineTo(Math.abs(x - tam * 0.16), y);
      g.lineTo(x, Math.abs(y - tam * 0.16));
      g.fill();
    }
    g.strokeStyle = 'rgba(8,18,40,0.55)';
    g.lineWidth = tam * 0.04;
    g.strokeRect(0, 0, tam, tam);
    // Emblema del centro: dos aros y una estrella
    g.strokeStyle = 'rgba(255,255,255,0.4)';
    g.lineWidth = 7;
    g.beginPath(); g.arc(tam / 2, tam / 2, tam * 0.2, 0, Math.PI * 2); g.stroke();
    g.lineWidth = 3;
    g.beginPath(); g.arc(tam / 2, tam / 2, tam * 0.17, 0, Math.PI * 2); g.stroke();
    g.fillStyle = 'rgba(255,210,63,0.45)';
    g.beginPath();
    for (let k = 0; k < 10; k++) {
      const r = k % 2 ? tam * 0.045 : tam * 0.11;
      const a = (k / 10) * Math.PI * 2 - Math.PI / 2;
      g.lineTo(tam / 2 + Math.cos(a) * r, tam / 2 + Math.sin(a) * r);
    }
    g.fill();
  }, { tam: 512 }));
  const lona = new THREE.Mesh(R(new THREE.PlaneGeometry(MEDIO * 2, MEDIO * 2)), R(new THREE.MeshLambertMaterial({ map: texLona })));
  lona.rotation.x = -Math.PI / 2;
  lona.position.set(CX, 0, CZ);
  raiz.add(lona);
  // Faldón del ring (su tapa, por debajo de la lona: si estuvieran a la misma altura, parpadearían)
  const texFaldon = R(ctx.texturaCanvas((g, tam) => {
    const grad = g.createLinearGradient(0, 0, 0, tam);
    grad.addColorStop(0, '#1d3a7a');
    grad.addColorStop(1, '#0a1430');
    g.fillStyle = grad;
    g.fillRect(0, 0, tam, tam);
    g.fillStyle = '#f2f2f2';
    g.fillRect(0, tam * 0.08, tam, tam * 0.025);
    g.fillStyle = '#c62828';
    g.fillRect(0, tam * 0.12, tam, tam * 0.02);
    g.fillStyle = 'rgba(255,255,255,0.75)';
    for (let k = 0; k < 4; k++) {
      const cx = tam * (0.125 + k * 0.25);
      const cy = tam * 0.45;
      g.beginPath();
      for (let p = 0; p < 10; p++) {
        const r = p % 2 ? tam * 0.025 : tam * 0.06;
        const a = (p / 10) * Math.PI * 2 - Math.PI / 2;
        g.lineTo(cx + Math.cos(a) * r, cy + Math.sin(a) * r);
      }
      g.fill();
    }
  }, { tam: 256, repetir: [3, 1] }));
  raiz.add(new THREE.Mesh(R(colocar(new THREE.BoxGeometry(MEDIO * 2 + 0.3, 1, MEDIO * 2 + 0.3), CX, -0.508, CZ)), R(new THREE.MeshLambertMaterial({ map: texFaldon }))));
  // Suelo del pabellón, más claro alrededor del ring
  const texSuelo = R(ctx.texturaCanvas((g, tam) => {
    const grad = g.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
    grad.addColorStop(0, '#2a2c38');
    grad.addColorStop(0.35, '#15161e');
    grad.addColorStop(1, '#07080c');
    g.fillStyle = grad;
    g.fillRect(0, 0, tam, tam);
  }, { tam: 256 }));
  const sueloPabellon = new THREE.Mesh(R(new THREE.PlaneGeometry(26, 26)), R(new THREE.MeshLambertMaterial({ map: texSuelo })));
  sueloPabellon.rotation.x = -Math.PI / 2;
  sueloPabellon.position.set(CX, -1, CZ);
  raiz.add(sueloPabellon);
  // Gradas escalonadas alrededor (un torno con el perfil de los escalones)
  const perfil = [new THREE.Vector2(13, 2.6), new THREE.Vector2(13, -1)];
  for (let fila = 5; fila >= 0; fila--) {
    const r = 5 + fila * 0.9;
    const y = -1 + (fila + 1) * 0.45;
    perfil.push(new THREE.Vector2(r + 0.9, y), new THREE.Vector2(r, y));
    perfil.push(new THREE.Vector2(r, y - 0.45));
  }
  perfil.reverse();
  const gradas = new THREE.Mesh(R(new THREE.LatheGeometry(perfil, 56)), R(new THREE.MeshLambertMaterial({ color: 0x191a24, side: THREE.DoubleSide })));
  gradas.position.set(CX, 0, CZ);
  raiz.add(gradas);
  // Vallas de LED alrededor de la pista (la textura corre)
  const texLed = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#05060c';
    g.fillRect(0, 0, tam * 4, tam);
    const colores = ['#ff3d3d', '#ffd23f', '#3d8bff', '#ff6a3d'];
    for (let k = 0; k < 8; k++) {
      const x0 = (k * tam) / 2;
      const grad = g.createLinearGradient(x0, 0, x0 + tam / 2, 0);
      grad.addColorStop(0, colores[k % 4]);
      grad.addColorStop(1, '#05060c');
      g.fillStyle = grad;
      g.fillRect(x0, tam * 0.2, tam / 2, tam * 0.6);
      g.fillStyle = 'rgba(255,255,255,0.85)';
      for (let p = 0; p < 3; p++) {
        g.beginPath();
        g.moveTo(x0 + tam * (0.1 + p * 0.1), tam * 0.3);
        g.lineTo(x0 + tam * (0.16 + p * 0.1), tam * 0.5);
        g.lineTo(x0 + tam * (0.1 + p * 0.1), tam * 0.7);
        g.lineTo(x0 + tam * (0.13 + p * 0.1), tam * 0.5);
        g.fill();
      }
    }
  }, { tam: 64, repetir: [6, 1] }));
  const vallas = new THREE.Mesh(R(new THREE.CylinderGeometry(4.7, 4.7, 0.5, 56, 1, true)), R(new THREE.MeshBasicMaterial({ map: texLed, toneMapped: false, side: THREE.DoubleSide })));
  vallas.position.set(CX, -0.72, CZ);
  raiz.add(vallas);
  // Público: cuerpos y cabezas instanciados en las gradas; levantan los brazos con los golpes
  const N_PUBLICO = 220;
  const cuerposPublico = new THREE.InstancedMesh(R(colocar(new THREE.CylinderGeometry(0.15, 0.2, 0.55, 6, 1, true), 0, 0.27, 0)), R(new THREE.MeshLambertMaterial({ color: 0xffffff })), N_PUBLICO);
  const cabezasPublico = new THREE.InstancedMesh(R(new THREE.SphereGeometry(0.11, 6, 4)), R(new THREE.MeshLambertMaterial({ color: 0xffffff })), N_PUBLICO);
  const brazosPublico = new THREE.InstancedMesh(fusionar([
    colocar(new THREE.CylinderGeometry(0.035, 0.035, 0.45, 4, 1, true), -0.2, 0.68, 0, 0, 0, 0.35),
    colocar(new THREE.CylinderGeometry(0.035, 0.035, 0.45, 4, 1, true), 0.2, 0.68, 0, 0, 0, -0.35),
  ]), R(new THREE.MeshLambertMaterial({ color: 0xffffff })), N_PUBLICO);
  const datosPublico = [];
  for (let i = 0; i < N_PUBLICO; i++) {
    const fila = i % 6;
    const k = Math.floor(i / 6);
    const a = ((k + (fila % 2) * 0.5) / (N_PUBLICO / 6)) * Math.PI * 2;
    const r = 5.45 + fila * 0.9;
    const x = CX + Math.cos(a) * r;
    const z = CZ + Math.sin(a) * r;
    const camiseta = colorTmp.setHSL(((i * 37) % 100) / 100, 0.4, 0.035 + ((i * 13) % 9) * 0.008);
    if ((i * 7) % 11 === 0) camiseta.setHex(0xd8d8d8).multiplyScalar(0.12);
    cuerposPublico.setColorAt(i, camiseta);
    brazosPublico.setColorAt(i, camiseta);
    cabezasPublico.setColorAt(i, colorTmp.setHSL(0.07, 0.35, 0.06 + ((i * 17) % 7) * 0.01));
    datosPublico.push({ x, y: -1 + fila * 0.45 + 0.45, z, giro: Math.atan2(CX - x, CZ - z), fase: (i * 1.7) % 6.3, ganas: ((i * 29) % 10) / 10, arriba: 0 });
  }
  cuerposPublico.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  cabezasPublico.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  brazosPublico.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  raiz.add(cuerposPublico, cabezasPublico, brazosPublico);
  let emocion = 0.3;              // el público se anima con los golpes y el KO
  const N_FLASH = 14;
  const flashes = new THREE.InstancedMesh(R(new THREE.SphereGeometry(0.06, 6, 4)), luzSumada(), N_FLASH);
  const estadoFlash = Array.from({ length: N_FLASH }, () => ({ vida: 0, x: 0, y: 0, z: 0 }));
  for (let i = 0; i < N_FLASH; i++) flashes.setColorAt(i, colorTmp.set(0x000000));
  flashes.frustumCulled = false;
  raiz.add(flashes);
  // Postes cromados, almohadillas de las esquinas, cuerdas y escalera de la esquina azul
  const esquinas = [[-MEDIO, -MEDIO], [MEDIO, -MEDIO], [MEDIO, MEDIO], [-MEDIO, MEDIO]];
  const piezasRing = [];
  const coloresRing = [];
  const pieza = (geo, color) => { piezasRing.push(geo); coloresRing.push(color); };
  esquinas.forEach(([x, z], i) => {
    pieza(colocar(new THREE.CylinderGeometry(0.05, 0.06, 1.5, 12), CX + x, 0.75, CZ + z), 0xc8ccd8);
    pieza(colocar(new THREE.SphereGeometry(0.065, 12, 8), CX + x, 1.5, CZ + z), 0xc8ccd8);
    pieza(colocar(new THREE.CylinderGeometry(0.11, 0.11, 1.0, 14), CX + x * 0.975, 0.85, CZ + z * 0.975), i === 0 ? 0xc62828 : i === 2 ? 0x2a4ac8 : 0xe8e8e8);
  });
  const coloresCuerda = [0xc62828, 0xf2f2f2, 0x2a4ac8];
  [0.45, 0.85, 1.25].forEach((y, k) => {
    for (let i = 0; i < 4; i++) {
      const [ax, az] = esquinas[i];
      const [bx, bz] = esquinas[(i + 1) % 4];
      const l = Math.hypot(bx - ax, bz - az);
      pieza(colocar(new THREE.CylinderGeometry(0.022, 0.022, l, 10), CX + (ax + bx) / 2, y, CZ + (az + bz) / 2, ax === bx ? Math.PI / 2 : 0, 0, ax === bx ? 0 : Math.PI / 2), coloresCuerda[k]);
      // Fundas que unen las cuerdas en medio de cada lado
      pieza(colocar(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 8), CX + (ax + bx) / 2, 0.85, CZ + (az + bz) / 2), 0xe8e8e8);
    }
  });
  for (let p = 0; p < 3; p++) pieza(caja(0.7, 0.3, 0.3, CX + MEDIO - 0.6, -1 + 0.15 + p * 0.3, CZ + MEDIO + 0.6 - p * 0.28), 0x30343e);
  raiz.add(new THREE.Mesh(fusionar(piezasRing, coloresRing), R(new THREE.MeshStandardMaterial({ vertexColors: true, roughness: 0.35, metalness: 0.4 }))));
  // Estructura de focos sobre el ring, con el videomarcador colgando en medio
  const focos = [[-1.2, -1.6], [1.2, -1.6], [-1.2, 0.6], [1.2, 0.6]];
  const ESTRUCTURA = 2.1;
  const piezasTecho = [];
  for (const s of [-1, 1]) {
    piezasTecho.push(caja(ESTRUCTURA * 2 + 0.2, 0.14, 0.14, CX, 4.4, CZ + s * ESTRUCTURA), caja(0.14, 0.14, ESTRUCTURA * 2 + 0.2, CX + s * ESTRUCTURA, 4.4, CZ));
    piezasTecho.push(caja(0.02, 3, 0.02, CX + s * ESTRUCTURA, 5.9, CZ + s * ESTRUCTURA));
  }
  for (const [x, z] of focos) piezasTecho.push(colocar(new THREE.CylinderGeometry(0.16, 0.2, 0.28, 14), CX + x, 4.2, CZ + z), caja(0.06, 0.25, 0.06, CX + x, 4.35, CZ + z));
  piezasTecho.push(caja(0.04, 1.2, 0.04, CX, 5.6, CZ));
  raiz.add(new THREE.Mesh(fusionar(piezasTecho), R(new THREE.MeshLambertMaterial({ color: 0x22242c }))));
  raiz.add(new THREE.Mesh(fusionar(focos.map(([x, z]) => colocar(new THREE.CircleGeometry(0.15, 14).rotateX(Math.PI / 2), CX + x, 4.059, CZ + z))), R(new THREE.MeshBasicMaterial({ color: 0xfff6e0, toneMapped: false }))));
  const texPantalla = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#05060c';
    g.fillRect(0, 0, tam, tam);
    const grad = g.createLinearGradient(0, 0, 0, tam);
    grad.addColorStop(0, '#1a2a6a');
    grad.addColorStop(1, '#4a0e1e');
    g.fillStyle = grad;
    g.fillRect(tam * 0.05, tam * 0.08, tam * 0.9, tam * 0.84);
    // Dos guantes que chocan
    for (const [x, c] of [[0.36, '#c62828'], [0.64, '#2a4ac8']]) {
      g.fillStyle = c;
      g.beginPath(); g.arc(tam * x, tam * 0.5, tam * 0.15, 0, Math.PI * 2); g.fill();
      g.fillStyle = '#f2f2f2';
      g.fillRect(tam * (x - 0.07), tam * 0.64, tam * 0.14, tam * 0.08);
    }
    g.strokeStyle = '#ffd23f';
    g.lineWidth = tam * 0.02;
    g.beginPath();
    for (let k = 0; k < 8; k++) {
      const a = (k / 8) * Math.PI * 2;
      g.moveTo(tam / 2 + Math.cos(a) * tam * 0.06, tam * 0.32 + Math.sin(a) * tam * 0.06);
      g.lineTo(tam / 2 + Math.cos(a) * tam * 0.11, tam * 0.32 + Math.sin(a) * tam * 0.11);
    }
    g.stroke();
  }, { tam: 256 }));
  const pantalla = new THREE.Mesh(R(new THREE.BoxGeometry(1.5, 0.85, 1.5)), R(new THREE.MeshBasicMaterial({ map: texPantalla, toneMapped: false })));
  pantalla.position.set(CX, 4.95, CZ);
  raiz.add(pantalla);
  // Conos de luz de los focos, sus charcos en la lona y polvo flotando en ellos
  const conos = new THREE.InstancedMesh(R(new THREE.ConeGeometry(1.3, 4.1, 24, 1, true)), luzSumada({ side: THREE.DoubleSide }), focos.length);
  const charcos = new THREE.InstancedMesh(R(new THREE.PlaneGeometry(2.4, 2.4).rotateX(-Math.PI / 2)), luzSumada({ map: texRedonda, polygonOffset: true, polygonOffsetFactor: -2 }), focos.length);
  focos.forEach(([x, z], i) => {
    conos.setMatrixAt(i, matrizTmp.makeTranslation(CX + x * 0.85, 2.05, CZ + z * 0.85));
    conos.setColorAt(i, colorTmp.set(0x14130f));
    charcos.setMatrixAt(i, matrizTmp.makeTranslation(CX + x * 0.7, 0.004, CZ + z * 0.7));
    charcos.setColorAt(i, colorTmp.set(0x2a2518));
  });
  raiz.add(conos, charcos);
  const N_POLVO = 70;
  const polvo = new THREE.InstancedMesh(R(new THREE.SphereGeometry(0.007, 4, 3)), luzSumada({ color: 0x8a8070 }), N_POLVO);
  polvo.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  polvo.frustumCulled = false;
  const datosPolvo = Array.from({ length: N_POLVO }, (_, i) => {
    const [x, z] = focos[i % focos.length];
    return { x: CX + x * 0.8 + Math.sin(i * 7.1) * 0.6, y: 0.5 + ((i * 0.37) % 3.4), z: CZ + z * 0.8 + Math.cos(i * 3.3) * 0.6, fase: i };
  });
  raiz.add(polvo);

  // ─── Robot de sparring ─────────────────────────────────────────────────
  const robot = new THREE.Group();
  robot.position.set(0, 0, Z_ROBOT);
  raiz.add(robot);
  const cuerpo = new THREE.Group(); // lo que se inclina al recibir o al caer
  robot.add(cuerpo);
  // Chapa con juntas de paneles, remaches y arañazos (blanca: el color lo pone el material)
  const texChapa = R(ctx.texturaCanvas((g, tam, azar) => {
    g.fillStyle = '#f0f0f0';
    g.fillRect(0, 0, tam, tam);
    for (let i = 0; i < 400; i++) {
      g.fillStyle = `rgba(0,0,0,${azar() * 0.05})`;
      g.fillRect(azar() * tam, azar() * tam, 1 + azar() * 6, 1);
    }
    g.strokeStyle = 'rgba(30,30,40,0.55)';
    g.lineWidth = 3;
    for (let k = 1; k < 4; k++) {
      g.beginPath(); g.moveTo(0, (k * tam) / 4); g.lineTo(tam, (k * tam) / 4); g.stroke();
    }
    for (let k = 0; k < 8; k++) {
      const x = ((k + 0.5) * tam) / 8;
      const fila = k % 4;
      g.beginPath(); g.moveTo(x, (fila * tam) / 4); g.lineTo(x, ((fila + 1) * tam) / 4); g.stroke();
    }
    g.fillStyle = 'rgba(40,40,50,0.6)';
    for (let k = 0; k < 4; k++) {
      for (let i = 0; i < 16; i++) {
        g.beginPath(); g.arc(((i + 0.5) * tam) / 16, (k * tam) / 4 + 8, 2.2, 0, Math.PI * 2); g.fill();
      }
    }
    g.strokeStyle = 'rgba(255,255,255,0.5)';
    g.lineWidth = 1;
    for (let i = 0; i < 25; i++) {
      const x = azar() * tam;
      const y = azar() * tam;
      g.beginPath(); g.moveTo(x, y); g.lineTo(x + (azar() - 0.5) * 30, y + (azar() - 0.5) * 8); g.stroke();
    }
  }, { tam: 512 }));
  const matChapa = R(new THREE.MeshStandardMaterial({ color: COLORES_ROBOT[0], map: texChapa, roughness: 0.32, metalness: 0.55 }));
  const matOscuro = R(new THREE.MeshStandardMaterial({ color: 0x22252e, roughness: 0.45, metalness: 0.75 }));
  // Visera, reactor del pecho y luces: se encienden del color del aviso
  const matOjos = R(new THREE.MeshBasicMaterial({ color: 0x7fe8ff, toneMapped: false }));
  const matHalo = luzSumada({ color: 0x7fe8ff, opacity: 0.45 });
  const matOro = R(new THREE.MeshLambertMaterial({ color: 0xd4a020, emissive: 0x3a2a00 }));
  // El cuerpo interior (oscuro) es lo que se golpea; el blindaje va por encima
  const torso = new THREE.Mesh(R(new THREE.CapsuleGeometry(0.2, 0.32, 6, 14).scale(1.05, 1, 0.72)), matOscuro);
  torso.position.set(0, 1.2, 0);
  torso.name = 'torso';
  const blindaje = new THREE.Mesh(fusionar([
    colocar(new THREE.SphereGeometry(1, 20, 14).scale(0.25, 0.19, 0.13), 0, 1.33, 0.07),       // peto
    caja(0.17, 0.05, 0.06, 0, 1.09, 0.12), caja(0.16, 0.05, 0.06, 0, 1.025, 0.115), caja(0.15, 0.05, 0.06, 0, 0.96, 0.11), // abdominales
    colocar(new THREE.SphereGeometry(1, 16, 12).scale(0.13, 0.1, 0.12), -0.27, 1.46, 0),     // hombreras
    colocar(new THREE.SphereGeometry(1, 16, 12).scale(0.13, 0.1, 0.12), 0.27, 1.46, 0),
    colocar(new THREE.SphereGeometry(1, 12, 10).scale(0.075, 0.07, 0.07), -0.13, 0.5, 0.04), // rodilleras
    colocar(new THREE.SphereGeometry(1, 12, 10).scale(0.075, 0.07, 0.07), 0.13, 0.5, 0.1),
    caja(0.12, 0.26, 0.06, -0.135, 0.26, -0.0, 0.08), caja(0.12, 0.26, 0.06, 0.135, 0.26, 0.15, -0.06), // espinilleras
    caja(0.12, 0.3, 0.07, -0.12, 0.72, -0.01, 0.15, 0, 0.05), caja(0.12, 0.3, 0.07, 0.12, 0.72, 0.11, -0.12, 0, -0.05), // muslos
  ]), matChapa);
  const cadera = new THREE.Mesh(fusionar([
    colocar(new THREE.CylinderGeometry(0.18, 0.2, 0.16, 16), 0, 0.92, 0),
    colocar(new THREE.CapsuleGeometry(0.07, 0.62, 4, 10), -0.13, 0.48, -0.06, 0.15, 0, 0.05),   // piernas
    colocar(new THREE.CapsuleGeometry(0.07, 0.62, 4, 10), 0.13, 0.48, 0.08, -0.12, 0, -0.05),
    caja(0.14, 0.08, 0.27, -0.15, 0.04, -0.09), caja(0.14, 0.08, 0.27, 0.15, 0.04, 0.13),       // botas
    colocar(new THREE.CylinderGeometry(0.06, 0.065, 0.1, 12), 0, 1.47, 0),                      // cuello
    colocar(new THREE.CylinderGeometry(0.205, 0.215, 0.06, 18), 0, 0.99, 0),                    // cinturón
  ]), matOscuro);
  const hebilla = new THREE.Mesh(R(colocar(new THREE.BoxGeometry(0.13, 0.08, 0.02), 0, 0.99, 0.205)), matOro);
  const reactor = new THREE.Mesh(R(colocar(new THREE.CircleGeometry(0.04, 20), 0, 1.33, 0.202)), matOjos);
  const haloReactor = new THREE.Mesh(R(colocar(new THREE.PlaneGeometry(0.22, 0.22), 0, 1.33, 0.21)), luzSumada({ map: texRedonda, color: 0x7fe8ff, opacity: 0.6 }));
  const cabeza = new THREE.Group();
  cabeza.position.set(0, 1.62, 0.02);
  const craneo = new THREE.Mesh(R(new THREE.SphereGeometry(0.135, 22, 16).scale(1, 1.05, 1)), matChapa);
  craneo.name = 'cabeza';
  const casco = new THREE.Mesh(fusionar([
    caja(0.03, 0.06, 0.24, 0, 0.13, -0.01),                                                       // cresta
    colocar(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 16), -0.137, 0, 0, 0, 0, Math.PI / 2), // orejas
    colocar(new THREE.CylinderGeometry(0.045, 0.045, 0.03, 16), 0.137, 0, 0, 0, 0, Math.PI / 2),
    caja(0.16, 0.06, 0.06, 0, -0.085, 0.09),                                                      // mandíbula
    caja(0.008, 0.12, 0.008, 0.14, 0.1, -0.02),                                                   // antena
  ]), matOscuro);
  const visera = new THREE.Mesh(R(new THREE.CylinderGeometry(0.131, 0.131, 0.045, 22, 1, true, -1.15, 2.3)), matOjos);
  visera.position.set(0, 0.018, 0.008);
  const haloVisera = new THREE.Mesh(R(new THREE.CylinderGeometry(0.145, 0.145, 0.085, 22, 1, true, -1.2, 2.4)), matHalo);
  haloVisera.position.copy(visera.position);
  const ojos = new THREE.Mesh(fusionar([caja(0.035, 0.014, 0.01, -0.045, 0.018, 0.133), caja(0.035, 0.014, 0.01, 0.045, 0.018, 0.133)]), R(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })));
  cabeza.add(craneo, casco, visera, haloVisera, ojos);
  cuerpo.add(torso, blindaje, cadera, hebilla, reactor, haloReactor, cabeza);
  // Puntos débiles (se encienden cuando el robot queda abierto)
  const matDebil = luzSumada({ color: 0xffd23f });
  const debilCabeza = new THREE.Mesh(R(new THREE.TorusGeometry(0.06, 0.008, 6, 24)), matDebil);
  debilCabeza.position.set(0, -0.08, 0.135);
  cabeza.add(debilCabeza);
  const debilPecho = new THREE.Mesh(R(new THREE.TorusGeometry(0.075, 0.009, 6, 24)), matDebil);
  debilPecho.position.set(0, 1.27, 0.215);
  cuerpo.add(debilPecho);
  // Brazos: dos tramos (cilindros), el codo y el guante; se colocan en cada fotograma
  const geoTramo = R(new THREE.CylinderGeometry(0.045, 0.04, 1, 12));
  geoTramo.translate(0, 0.5, 0);
  const geoCodo = R(new THREE.SphereGeometry(0.055, 12, 8));
  // Guante: puño, pulgar y puño de tela blanco (+z hacia donde pega; se escala al tamaño del guante)
  const geoGuanteRobot = fusionar([
    new THREE.SphereGeometry(1, 20, 14).scale(1, 0.95, 1.12),
    colocar(new THREE.CapsuleGeometry(0.3, 0.6, 4, 10), -0.8, 0.15, 0.25, 0.4, 0, 0.3),
    colocar(new THREE.CylinderGeometry(0.72, 0.68, 0.7, 18), 0, -0.05, -1.05, Math.PI / 2),
    colocar(new THREE.CylinderGeometry(0.735, 0.735, 0.18, 18), 0, -0.05, -0.9, Math.PI / 2),
  ], [0xc62828, 0xc62828, 0xc62828, 0xf2f2f2]);
  const brazos = [-1, 1].map((lado) => {
    const brazo = new THREE.Mesh(geoTramo, matOscuro);
    const antebrazo = new THREE.Mesh(geoTramo, matChapa);
    const codoMalla = new THREE.Mesh(geoCodo, matOscuro);
    const matGuante = R(new THREE.MeshStandardMaterial({ color: 0xffffff, vertexColors: true, roughness: 0.36, emissive: 0xff3a1a, emissiveIntensity: 0 }));
    const guante = new THREE.Mesh(geoGuanteRobot, matGuante);
    guante.scale.set(0.075, 0.07, 0.085);
    cuerpo.add(brazo, antebrazo, codoMalla, guante);
    return {
      lado, brazo, antebrazo, codoMalla, guante, matGuante,
      hombro: new THREE.Vector3(lado * 0.25, 1.42, 0),
      pos: new THREE.Vector3(lado * 0.12, 1.55, 0.3), // guante (espacio del robot)
      desde: new THREE.Vector3(), hacia: new THREE.Vector3(), codo: new THREE.Vector3(),
    };
  });
  const sombraRobot = ctx.crearSombra({ radio: 0.4, opacidad: 0.5 });
  raiz.add(sombraRobot);
  // Barra de vida del robot, sobre su cabeza
  const barraRobot = new THREE.Group();
  const fondoBarra = new THREE.Mesh(R(new THREE.PlaneGeometry(0.5, 0.045)), R(new THREE.MeshBasicMaterial({ color: 0x14141a, transparent: true, opacity: 0.8 })));
  const geoRelleno = R(new THREE.PlaneGeometry(0.48, 0.03));
  geoRelleno.translate(0.24, 0, 0);
  const matRellenoRobot = R(new THREE.MeshBasicMaterial({ color: 0xff3d3d, toneMapped: false }));
  const rellenoRobot = new THREE.Mesh(geoRelleno, matRellenoRobot);
  rellenoRobot.position.set(-0.24, 0, 0.002);
  barraRobot.add(fondoBarra, rellenoRobot);
  raiz.add(barraRobot);

  // ─── Guantes del jugador ───────────────────────────────────────────────
  const geoPuno = R(new THREE.SphereGeometry(1, 22, 16));
  const geoPulgar = R(new THREE.CapsuleGeometry(0.019, 0.045, 4, 10));
  const geoMuneca = R(new THREE.CylinderGeometry(0.042, 0.047, 0.075, 18));
  const geoCinta = R(new THREE.CylinderGeometry(0.0435, 0.0435, 0.022, 18));
  const matGuante = R(new THREE.MeshStandardMaterial({ color: 0xd8d8de, roughness: 0.38, metalness: 0.05 }));
  const matCinta = R(new THREE.MeshLambertMaterial({ color: 0x2a4ac8 }));
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
  const CENTRO_PUNO = new THREE.Vector3(0, -0.027, -0.037);
  const guantes = ctx.manos.map((mano, i) => {
    const objeto = crearGuante(i === 0 ? -1 : 1);
    objeto.position.set(0, -0.01, 0.01);
    objeto.rotation.x = -0.35;
    ctx.adjuntarAMano(mano, objeto);
    return { mano, objeto, centro: new THREE.Vector3(), anterior: new THREE.Vector3(), vel: new THREE.Vector3(), listo: false, dentro: false };
  });
  // Ratón: dos guantes delante de la cámara
  const REPOSO_RATON = [new THREE.Vector3(-0.2, 1.36, 0.0), new THREE.Vector3(0.2, 1.36, 0.0)];
  const GUARDIA_RATON = [new THREE.Vector3(-0.07, 1.55, -0.05), new THREE.Vector3(0.07, 1.55, -0.05)];
  const guantesRaton = REPOSO_RATON.map((reposo, i) => {
    const objeto = crearGuante(i === 0 ? -1 : 1);
    objeto.position.copy(reposo);
    raiz.add(objeto);
    return { objeto, reposo, guardia: GUARDIA_RATON[i], t: 0, objetivo: new THREE.Vector3(), subida: 0 };
  });
  let turnoRaton = 0;
  let pulsadoDesde = 0;

  // ─── Paneles ───────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 0.95, alto: 0.36 });
  marcador.mesh.position.set(-1.25, 1.85, -1.4);
  marcador.mesh.rotation.y = 0.55;
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'presentacion'; // 'presentacion' | 'combate' | 'ko' | 'fin'
  let reloj = 3;
  let puntos = 0;
  let vida = VIDA_JUGADOR;
  let combate = 1;
  let vidaRobot = 100;
  let vidaRobotMax = 100;
  let record = ctx.leer('record', 0);
  let nuevoRecord = false;
  let mensaje = '';
  let colorMensaje = '#ffffff';
  let tiempoMensaje = 0;
  let tiempo = 0;
  // Lo que hace el robot ahora: 'guardia' | 'prepara' | 'golpe' | 'vuelve' | 'abierto'
  let accion = 'guardia';
  let tAccion = 1.5;
  let ataque = null;              // { tipo, brazo, objetivo (mundo), finta }
  let cola = [];                  // golpes que quedan del combo
  let racha = 0;                  // golpes seguidos encajados al robot mientras está abierto
  let sinDano = true;             // el combate, sin recibir golpes
  let retroceso = 0;              // el robot se echa atrás al recibir
  let caida = 0;                  // KO: el robot cae de espaldas
  const cabezaJugador = new THREE.Vector3();
  const objetivo = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const tmp3 = new THREE.Vector3();
  const radial = new THREE.Vector3();

  // Lo que cambia con cada combate: más rápido, combos y fintas
  const preparacion = () => Math.max(0.3, 0.75 - (combate - 1) * 0.06);
  const pausaEntreGolpes = () => Math.max(0.45, 1.6 - (combate - 1) * 0.15);
  const tiempoAbierto = () => Math.max(0.8, 1.5 - (combate - 1) * 0.08);

  function decir(texto, color = '#ffffff', duracion = 1.2) {
    mensaje = texto;
    colorMensaje = color;
    tiempoMensaje = duracion;
  }

  function presentarRobot() {
    estado = 'presentacion';
    reloj = 2.6;
    vidaRobotMax = 100 + (combate - 1) * 25;
    vidaRobot = vidaRobotMax;
    matChapa.color.setHex(COLORES_ROBOT[(combate - 1) % COLORES_ROBOT.length]);
    accion = 'guardia';
    tAccion = 1.4;
    cola = [];
    caida = 0;
    sinDano = true;
    cuerpo.rotation.set(0, 0, 0);
    decir(ctx.t('combate', { n: combate }), '#ffd23f', 2.6);
  }

  function empezarPartida() {
    puntos = 0;
    vida = VIDA_JUGADOR;
    combate = 1;
    nuevoRecord = false;
    presentarRobot();
  }

  // ─── El robot decide qué hacer ─────────────────────────────────────────
  function planearAtaques() {
    const tipos = combate >= 3 ? ['jab', 'jab', 'gancho', 'uppercut'] : combate >= 2 ? ['jab', 'jab', 'gancho'] : ['jab'];
    const largo = combate >= 5 ? 1 + Math.floor(Math.random() * 3) : combate >= 2 ? 1 + Math.floor(Math.random() * 2) : 1;
    cola = [];
    for (let i = 0; i < largo; i++) {
      cola.push({
        tipo: tipos[Math.floor(Math.random() * tipos.length)],
        brazo: Math.random() < 0.5 ? 0 : 1,
        finta: combate >= 4 && i === 0 && largo > 1 && Math.random() < 0.3,
      });
    }
  }

  function siguienteAtaque() {
    ataque = cola.shift();
    accion = 'prepara';
    tAccion = preparacion() * (ataque.tipo === 'jab' ? 1 : 1.15);
    // Apunta a donde está tu cabeza ahora (y un poco por delante, a la cara)
    objetivo.copy(cabezaJugador);
    ataque.objetivo = objetivo; // solo hay un golpe a la vez: siempre el mismo vector
    ctx.sonido('carga');
  }

  // El golpe llega: ¿esquivado, bloqueado o te da?
  function resolverGolpe() {
    const destino = ataque.objetivo;
    const dano = ATAQUES[ataque.tipo].dano + (combate - 1) * 1.5;
    let bloqueado = false;
    if (ctx.enVR()) {
      for (const g of guantes) if (g.mano.activa && g.centro.distanceTo(destino) < BLOQUEO) bloqueado = true;
    } else {
      bloqueado = guardiaRaton();
    }
    const esquivado = ctx.enVR() && cabezaJugador.distanceTo(destino) > ESQUIVA;
    if (esquivado) {
      decir(ctx.t('esquivado'), '#7fe8ff', 0.8);
      ctx.sonido('zas');
      puntos += 5;
      abrirRobot();
    } else if (bloqueado) {
      decir(ctx.t('bloqueado'), '#cfd8dc', 0.8);
      ctx.sonido('bloqueo');
      for (const m of ctx.manos) ctx.vibrar(m, 0.35, 50);
      vida = Math.max(0, vida - (1 + combate)); // el bloqueo para casi todo, pero cada vez se cuela algo más
      abrirRobot();
    } else {
      // Te da
      vida = Math.max(0, vida - dano);
      sinDano = false;
      racha = 0;
      decir(ctx.t('teDan'), '#ff8a80', 0.9);
      ctx.sonido('teDan');
      ctx.destello(0xff2a2a, 0.3);
      for (const m of ctx.manos) ctx.vibrar(m, 0.9, 140);
      if (vida <= 0) return terminar();
      // Sigue con el combo (si lo hay) sin quedar abierto
      accion = 'vuelve';
      tAccion = 0.35;
      return;
    }
  }

  function abrirRobot() {
    // Si quedan golpes en el combo, solo una pausa corta; si no, queda abierto
    if (cola.length) {
      accion = 'vuelve';
      tAccion = 0.3;
    } else {
      accion = 'abierto';
      tAccion = tiempoAbierto();
      racha = 0;
    }
  }

  function terminar() {
    estado = 'fin';
    reloj = 7;
    decir(ctx.t('fin'), '#ff8a80', 7);
    ctx.sonido('campana');
    ctx.puntuacion(puntos); // a la clasificación (juegos/marcadores.js)
    if (puntos > record) {
      record = puntos;
      nuevoRecord = puntos > 0;
      ctx.guardar('record', record);
    }
    if (nuevoRecord) {
      tmp.set(0, 1.8, -1.5);
      ctx.efectos.impacto('grande', { pos: tmp, color: 0xffd23f, sonido: 'ovacion' });
    }
  }

  // ─── Tus golpes ────────────────────────────────────────────────────────
  // donde: 'cabeza' o 'torso'; punto: en el mundo; fuerza: m/s
  function pegar(donde, punto, fuerza, mano) {
    if (estado !== 'combate' || caida > 0) return;
    const abierto = accion === 'abierto';
    // En guardia, la cabeza la tapan sus guantes: casi no hace daño
    if (!abierto && donde === 'cabeza' && (accion === 'guardia' || accion === 'prepara')) {
      ctx.sonido('bloqueo');
      ctx.efectos.impacto('pequeño', { pos: punto, mano, color: 0x9aa0a8 });
      return;
    }
    let dano = (donde === 'cabeza' ? 8 : 5) * (abierto ? 1 : 0.4);
    // Crítico: en el punto débil encendido
    let critico = false;
    if (abierto) {
      const debil = donde === 'cabeza' ? debilCabeza : debilPecho;
      debil.getWorldPosition(tmp);
      if (tmp.distanceTo(punto) < 0.06) {
        critico = true;
        dano *= 1.5;
      }
      racha += 1;
      dano *= Math.min(2, 1 + (racha - 1) * 0.25);
    }
    dano *= Math.min(1.4, 0.8 + fuerza * 0.12);
    dano = Math.round(dano);
    vidaRobot = Math.max(0, vidaRobot - dano);
    puntos += dano;
    retroceso = Math.min(1, retroceso + (donde === 'cabeza' ? 0.6 : 0.35));
    tmp2.copy(punto);
    ctx.efectos.impacto(critico ? 'medio' : 'pequeño', { pos: punto, mano, color: critico ? 0xffd23f : 0xff7a2e, sonido: critico ? 'critico' : 'golpeRobot' });
    ctx.efectos.texto(tmp2, critico ? `+${dano}!` : `+${dano}`, { color: critico ? '#ffd23f' : '#ffffff', tam: critico ? 1.1 : 0.8 });
    if (critico) decir(ctx.t('critico'), '#ffd23f', 0.8);
    emocion = Math.min(1, emocion + (critico ? 0.35 : 0.15));
    if (vidaRobot <= 0) ko();
  }

  function ko() {
    caida = 0.001;
    estado = 'ko';
    reloj = 3.5;
    const bonus = 50 * combate + (sinDano ? 100 : 0);
    puntos += bonus;
    tmp.set(0, 1.9, Z_ROBOT);
    ctx.efectos.impacto('grande', { pos: tmp, color: 0xffd23f, sonido: 'campana' });
    ctx.efectos.texto(tmp, `+${bonus}`, { color: '#ffd23f', tam: 1.4, vida: 1.5 });
    decir(sinDano ? ctx.t('koPerfecto') : ctx.t('ko'), '#ffd23f', 3.5);
    ctx.sonido('ovacion');
    emocion = 1;
  }

  // VR: el guante entra en la cabeza o el torso del robot con velocidad
  function golpesVR(dt) {
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
      // ¿Toca la cabeza o el torso?
      craneo.getWorldPosition(tmp);
      let donde = null;
      if (g.centro.distanceTo(tmp) < 0.14 + R_GUANTE) donde = 'cabeza';
      else {
        torso.getWorldPosition(tmp);
        const dy = g.centro.y - tmp.y;
        if (Math.abs(dy) < 0.32 && Math.hypot(g.centro.x - tmp.x, g.centro.z - tmp.z) < 0.22 + R_GUANTE) donde = 'torso';
      }
      if (donde && !g.dentro) {
        radial.subVectors(tmp, g.centro).normalize();
        const fuerza = g.vel.dot(radial);
        if (fuerza >= VEL_GOLPE) {
          tmp3.copy(g.centro).addScaledVector(radial, R_GUANTE);
          pegar(donde, tmp3, fuerza, g.mano);
        }
        g.dentro = true;
      } else if (!donde) {
        g.dentro = false;
      }
    }
  }

  // Ratón: mantener pulsado sube la guardia; un clic pega donde señalas
  const objetivosRaton = [craneo, torso];
  function guardiaRaton() {
    return ctx.raton.pulsado && tiempo - pulsadoDesde > 0.15;
  }
  function golpesRaton(dt) {
    const r = ctx.raton;
    if (r.clic) {
      pulsadoDesde = tiempo;
      const choque = r.rayo.intersectObjects(objetivosRaton, false)[0];
      const g = guantesRaton[turnoRaton];
      turnoRaton = 1 - turnoRaton;
      g.t = 0.2;
      if (choque) {
        g.objetivo.copy(choque.point);
        pegar(choque.object.name, choque.point, 3, null);
      } else {
        r.rayo.ray.at(0.6, g.objetivo);
      }
    }
    const guardia = guardiaRaton();
    for (const g of guantesRaton) {
      g.t = Math.max(0, g.t - dt);
      g.subida += ((guardia ? 1 : 0) - g.subida) * Math.min(1, dt * 14);
      const f = g.t > 0 ? Math.sin((1 - g.t / 0.2) * Math.PI) : 0;
      tmp.lerpVectors(g.reposo, g.guardia, g.subida);
      g.objeto.position.lerpVectors(tmp, g.objetivo, f * 0.9);
      const mira = f > 0 ? g.objetivo : tmp2.set(g.objeto.position.x * 0.3, 1.5, Z_ROBOT);
      g.objeto.lookAt(tmp.copy(g.objeto.position).multiplyScalar(2).sub(mira));
    }
  }

  // ─── Animación del robot ───────────────────────────────────────────────
  // Coloca un tramo (cilindro de altura 1 con la base en 0) entre dos puntos
  function tramo(mesh, a, b) {
    mesh.position.copy(a);
    tmp3.subVectors(b, a);
    const l = tmp3.length();
    mesh.scale.set(1, Math.max(0.001, l), 1);
    mesh.quaternion.setFromUnitVectors(arriba, tmp3.divideScalar(l || 1));
  }
  // Brazo con codo: el codo sale hacia fuera y hacia abajo
  function colocarBrazo(b) {
    const s = b.hombro;
    const g = b.pos;
    const d = s.distanceTo(g);
    tmp.addVectors(s, g).multiplyScalar(0.5);
    const doblez = d < BRAZO * 2 ? Math.sqrt(BRAZO * BRAZO - (d / 2) ** 2) : 0;
    tmp2.set(b.lado * 0.7, -1, -0.2);
    tmp3.subVectors(g, s).normalize();
    tmp2.addScaledVector(tmp3, -tmp2.dot(tmp3)).normalize();
    b.codo.copy(tmp).addScaledVector(tmp2, doblez);
    tramo(b.brazo, s, b.codo);
    tramo(b.antebrazo, b.codo, g);
    b.codoMalla.position.copy(b.codo);
    b.guante.position.copy(g);
    b.guante.lookAt(tmp.copy(g).sub(b.codo).add(g).applyMatrix4(cuerpo.matrixWorld));
  }

  // Posición de reposo de cada guante según lo que hace el robot
  function poseGuante(b, i, salida) {
    const t = tiempo;
    if (accion === 'abierto' || estado === 'ko') return salida.set(b.lado * 0.3, 1.12 + Math.sin(t * 3 + i) * 0.02, 0.18);
    return salida.set(b.lado * 0.12, 1.55 + Math.sin(t * 2.2 + i * 1.7) * 0.015, 0.3);
  }

  function animarRobot(dt) {
    // Mira hacia ti y se coloca a su distancia (tú no te mueves: es él quien se mueve)
    tmp.set(cabezaJugador.x, 0, cabezaJugador.z);
    const ang = Math.atan2(tmp.x - robot.position.x, tmp.z - robot.position.z);
    robot.rotation.y += (ang - robot.rotation.y) * Math.min(1, dt * 3);
    const dist = Math.hypot(tmp.x - robot.position.x, tmp.z - robot.position.z);
    const quiere = -Z_ROBOT;
    if (Math.abs(dist - quiere) > 0.05 && estado !== 'ko') {
      robot.position.x += ((tmp.x - robot.position.x) / dist) * (dist - quiere) * Math.min(1, dt * 1.5);
      robot.position.z += ((tmp.z - robot.position.z) / dist) * (dist - quiere) * Math.min(1, dt * 1.5);
    }
    // Balanceo de boxeador, retroceso al recibir y caída al KO
    retroceso = Math.max(0, retroceso - dt * 3);
    if (caida > 0) caida = Math.min(1, caida + dt * 1.6);
    const balanceo = estado === 'ko' ? 0 : Math.sin(tiempo * 2.6) * 0.04;
    cuerpo.position.set(balanceo, Math.abs(Math.sin(tiempo * 2.6)) * 0.015, -retroceso * 0.08);
    cuerpo.rotation.x = -retroceso * 0.25 - (caida > 0 ? caida * caida * 1.45 : 0);
    cuerpo.rotation.z = balanceo * 0.8;
    cabeza.rotation.x = -retroceso * 0.3;
    cuerpo.updateMatrixWorld(true);
    // Guantes
    brazos.forEach((b, i) => {
      let quiereIr = poseGuante(b, i, tmp);
      let rapidez = 10;
      let brillo = 0;
      if (ataque && ataque.brazo === i && estado === 'combate') {
        const def = ATAQUES[ataque.tipo];
        if (accion === 'prepara') {
          quiereIr = tmp.set(def.prepara[0] * b.lado, def.prepara[1], def.prepara[2]);
          rapidez = 7;
          brillo = 1 - tAccion / preparacion();
        } else if (accion === 'golpe') {
          // Al objetivo (pasado al espacio del robot), parando a la cara
          cuerpo.worldToLocal(tmp.copy(ataque.objetivo));
          tmp2.subVectors(tmp, b.hombro).normalize();
          quiereIr = tmp.addScaledVector(tmp2, -0.08);
          rapidez = 30;
          brillo = 1;
        }
      }
      b.pos.lerp(quiereIr, Math.min(1, dt * rapidez));
      b.matGuante.emissiveIntensity = brillo * 1.4;
      colocarBrazo(b);
    });
    // Ojos: azules en guardia, rojos al preparar, amarillos abiertos
    matOjos.color.setHex(estado === 'ko' ? 0x333333 : accion === 'prepara' || accion === 'golpe' ? 0xff3a2a : accion === 'abierto' ? 0xffd23f : 0x7fe8ff);
    matHalo.color.copy(matOjos.color);
    haloReactor.material.color.copy(matOjos.color);
    matHalo.opacity = accion === 'prepara' ? 0.5 + Math.sin(tiempo * 30) * 0.3 : 0.4;
    const abierto = accion === 'abierto' && estado === 'combate';
    debilCabeza.visible = abierto;
    debilPecho.visible = abierto;
    if (abierto) matDebil.opacity = 0.6 + Math.sin(tiempo * 12) * 0.35;
    // Barra de vida y sombra
    barraRobot.position.set(robot.position.x, 1.93, robot.position.z);
    barraRobot.lookAt(cabezaJugador);
    rellenoRobot.scale.x = Math.max(0.001, vidaRobot / vidaRobotMax);
    ctx.colocarSombra(sombraRobot, robot.position, 0.002);
  }

  // ─── Bucle ─────────────────────────────────────────────────────────────
  function actualizar(dt) {
    tiempo += dt;
    tiempoMensaje -= dt;
    reloj -= dt;
    ctx.camara.getWorldPosition(cabezaJugador);
    if (estado === 'presentacion' && reloj <= 0) {
      estado = 'combate';
      ctx.sonido('campana');
    }
    if (estado === 'ko' && reloj <= 0) {
      combate += 1;
      vida = Math.min(VIDA_JUGADOR, vida + 30); // se recupera un poco entre combates
      presentarRobot();
    }
    if (estado === 'fin' && reloj <= 0) empezarPartida();

    if (estado === 'combate') {
      tAccion -= dt;
      if (accion === 'guardia' && tAccion <= 0) {
        planearAtaques();
        siguienteAtaque();
      } else if (accion === 'prepara' && tAccion <= 0) {
        if (ataque.finta) {
          // Finta: amaga y vuelve, y enseguida el golpe de verdad
          accion = 'vuelve';
          tAccion = 0.2;
        } else {
          accion = 'golpe';
          tAccion = T_GOLPE;
          ctx.sonido('zas');
        }
      } else if (accion === 'golpe' && tAccion <= 0) {
        resolverGolpe();
      } else if (accion === 'vuelve' && tAccion <= 0) {
        if (cola.length) siguienteAtaque();
        else {
          accion = 'guardia';
          tAccion = pausaEntreGolpes() * (0.7 + Math.random() * 0.6);
        }
      } else if (accion === 'abierto' && tAccion <= 0) {
        accion = 'guardia';
        tAccion = pausaEntreGolpes() * (0.7 + Math.random() * 0.6);
      }
    }
    if (ctx.enVR()) {
      for (const g of guantesRaton) g.objeto.visible = false;
      golpesVR(dt);
    } else {
      for (const g of guantesRaton) g.objeto.visible = true;
      golpesRaton(dt);
    }
    animarRobot(dt);
    animarPublico(dt);
    actualizarMarcador();
  }

  function animarPublico(dt) {
    for (let i = 0; i < N_FLASH; i++) {
      const f = estadoFlash[i];
      f.vida -= dt * 6;
      if (f.vida <= 0 && Math.random() < dt * (estado === 'ko' ? 3 : 0.25)) {
        const a = Math.random() * Math.PI * 2;
        const r = 5.4 + Math.random() * 3.4;
        f.x = CX + Math.cos(a) * r;
        f.z = CZ + Math.sin(a) * r;
        f.y = -0.2 + Math.random() * 2;
        f.vida = 1;
      }
      const v = Math.max(0, f.vida);
      matrizTmp.makeScale(v + 0.001, v + 0.001, v + 0.001).setPosition(f.x, f.y, f.z);
      flashes.setMatrixAt(i, matrizTmp);
      flashes.setColorAt(i, colorTmp.setScalar(v));
    }
    flashes.instanceMatrix.needsUpdate = true;
    flashes.instanceColor.needsUpdate = true;
    // El público bota y levanta los brazos según lo animado que esté
    emocion = Math.max(estado === 'ko' ? 0.8 : 0.25, emocion - dt * 0.12);
    for (let i = 0; i < N_PUBLICO; i++) {
      const p = datosPublico[i];
      const quiere = emocion > 0.35 + p.ganas * 0.6 ? 1 : 0;
      p.arriba += (quiere - p.arriba) * Math.min(1, dt * 5);
      const bote = Math.max(0, Math.sin(tiempo * (5 + p.ganas * 3) + p.fase)) * 0.08 * emocion * (0.4 + p.ganas);
      matrizTmp.makeRotationY(p.giro).setPosition(p.x, p.y + bote, p.z);
      cuerposPublico.setMatrixAt(i, matrizTmp);
      matrizTmp.setPosition(p.x, p.y + bote + 0.68, p.z);
      cabezasPublico.setMatrixAt(i, matrizTmp);
      const s = 0.001 + p.arriba;
      matrizTmp.makeRotationY(p.giro).scale(radial.set(s, s, s)).setPosition(p.x, p.y + bote, p.z);
      brazosPublico.setMatrixAt(i, matrizTmp);
    }
    cuerposPublico.instanceMatrix.needsUpdate = true;
    cabezasPublico.instanceMatrix.needsUpdate = true;
    brazosPublico.instanceMatrix.needsUpdate = true;
    for (let i = 0; i < N_POLVO; i++) {
      const p = datosPolvo[i];
      p.y += dt * 0.04;
      if (p.y > 3.9) p.y = 0.3;
      matrizTmp.makeTranslation(p.x + Math.sin(tiempo * 0.3 + p.fase) * 0.15, p.y, p.z + Math.cos(tiempo * 0.25 + p.fase) * 0.15);
      polvo.setMatrixAt(i, matrizTmp);
    }
    polvo.instanceMatrix.needsUpdate = true;
    texLed.offset.x = (tiempo * 0.05) % 1;
  }

  function actualizarMarcador() {
    const barra = (v, max) => '█'.repeat(Math.round((v / max) * 10)) + '░'.repeat(10 - Math.round((v / max) * 10));
    if (estado === 'fin') {
      marcador.escribir([
        { texto: ctx.t('partida.finPuntos', { n: puntos }), tam: 1.1, color: '#ffd23f' },
        { texto: ctx.t('resumen', { n: combate - 1 }), tam: 0.62 },
        { texto: nuevoRecord ? ctx.t('partida.nuevoRecord') : ctx.t('partida.recordNuevaPartida', { record, n: Math.max(1, Math.ceil(reloj)) }), tam: 0.56, color: nuevoRecord ? '#ffd23f' : '#cfd8dc' },
      ]);
      return;
    }
    const ayuda = ctx.enVR() ? ctx.t('intro') : ctx.t(ctx.tactil ? 'introTactil' : 'introRaton');
    marcador.escribir([
      { texto: ctx.t('marcador', { puntos }), tam: 1.05 },
      { texto: ctx.t('tuVida', { barra: barra(vida, VIDA_JUGADOR) }), tam: 0.62, color: vida > 30 ? '#b9f6ca' : '#ff8a80' },
      tiempoMensaje > 0 ? { texto: mensaje, tam: 0.66, color: colorMensaje } : { texto: estado === 'presentacion' ? ayuda : ctx.t('estado', { n: combate }), tam: 0.56, color: '#cfd8dc' },
    ]);
  }

  empezarPartida();
  actualizarMarcador();

  return {
    actualizar,
    liberar() {},
  };
}
