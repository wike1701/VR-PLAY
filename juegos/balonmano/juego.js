// PENALTIS DE BALONMANO
// Tanda de 10 lanzamientos de siete metros contra un portero que se tira a por el balón.
// En VR coges el balón del soporte con el gatillo (o el botón lateral) y lo lanzas con el
// brazo. Sin gafas: apunta con el ratón, mantén pulsado y suelta cuando la barra de
// fuerza esté en la marca verde (si te pasas o te quedas corto, el balón se desvía).
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const PENALTIS = 10;
const G = 9.8;
const RADIO_BALON = 0.1;
const GZ = -7;                       // línea de gol: el penalti se tira a siete metros
const ZK = GZ + 0.35;                // plano del portero
const MITAD = 1.5;                   // portería de 3 × 2 m
const ALTO = 2;
const POSTE = 0.04;
const FONDO_RED = 0.9;
const ALCANCE_AGARRE = 0.24;
const RAPIDEZ = 1.35;                // el balón sale más rápido y el portero reacciona igual de más rápido
const FUERZA_VR = 2 * RAPIDEZ;       // multiplica la velocidad de la mano (sin peso, el balón salía flojo)
const RAPIDEZ_MIN_VR = 11;           // un lanzamiento VR decidido nunca sale más lento que esto (m/s)
const AYUDA = 0.5;                   // cuánto se corrige un buen lanzamiento VR hacia la portería
const PUESTO_VR = new THREE.Vector3(0, 1.0, -0.35);
const PUESTO_RATON = new THREE.Vector3(0, 1.3, -0.35);
const PODER_IDEAL = 0.75;            // marca verde de la barra de fuerza
const ALCANCE_X = 0.5;               // alcance del portero (brazos y cuerpo), en x e y
const ALCANCE_Y = 0.6;
const VALOR_GOL = 10;
const VALOR_ESCUADRA = 5;

const suave = (x) => x * x * (3 - 2 * x);

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  // Pabellón cerrado: alejamos la niebla para que se vean las paredes y las gradas
  ctx.fondo(0x1c2236, { niebla: [14, 38] });
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.75, 0.9), new THREE.Vector3(0, 1.45, GZ));

  // ─── Utilidades de geometría ───────────────────────────────────────────
  const matrizTmp = new THREE.Matrix4();
  const eulerTmp = new THREE.Euler();
  function colocar(geo, x, y, z, rx = 0, ry = 0, rz = 0) {
    matrizTmp.makeRotationFromEuler(eulerTmp.set(rx, ry, rz)).setPosition(x, y, z);
    return geo.applyMatrix4(matrizTmp);
  }
  // UV a partir de la posición en el mundo (1 unidad de UV = «metros» metros)
  function uvMundo(geo, ejeU, ejeV, metros = 1) {
    const p = geo.attributes.position;
    const uv = geo.attributes.uv;
    for (let i = 0; i < p.count; i++) uv.setXY(i, ejeU(p, i) / metros, ejeV(p, i) / metros);
    return geo;
  }
  const menosZ = (p, i) => -p.getZ(i);
  const masX = (p, i) => p.getX(i);
  const masY = (p, i) => p.getY(i);
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

  // ─── Pabellón ──────────────────────────────────────────────────────────
  ctx.sueloBase(false);
  const SALA_X = 9;
  const SALA_FONDO = -11;
  const SALA_FRENTE = 4.5;
  const SALA_ALTO = 7;
  const largoSala = SALA_FRENTE - SALA_FONDO;
  const centroZ = (SALA_FRENTE + SALA_FONDO) / 2;

  // Parquet con la zona de portería (6 m) pintada de azul sobre la misma madera
  const texParquet = R(ctx.texturas.tablas(0xc8935a, { tablas: 8, tam: 512, semilla: 4 }));
  raiz.add(new THREE.Mesh(
    uvMundo(R(colocar(new THREE.PlaneGeometry(SALA_X * 2, largoSala), 0, 0.003, centroZ, -Math.PI / 2)), menosZ, masX),
    R(new THREE.MeshLambertMaterial({ map: texParquet })),
  ));
  const zona = fusionar([
    colocar(new THREE.PlaneGeometry(MITAD * 2, 6), 0, 0.005, GZ + 3, -Math.PI / 2),
    colocar(new THREE.CircleGeometry(6, 28, Math.PI, Math.PI / 2), -MITAD, 0.005, GZ, -Math.PI / 2),
    colocar(new THREE.CircleGeometry(6, 28, Math.PI * 1.5, Math.PI / 2), MITAD, 0.005, GZ, -Math.PI / 2),
  ]);
  raiz.add(new THREE.Mesh(uvMundo(zona, menosZ, masX), R(new THREE.MeshLambertMaterial({ map: texParquet, color: 0x6fa6e8 }))));

  // Líneas: gol, área de 6 m y la marca de los 7 m
  const GROSOR = 0.05;
  const plano = (ancho, largo, x, z) => colocar(new THREE.PlaneGeometry(ancho, largo), x, 0.007, z, -Math.PI / 2);
  raiz.add(new THREE.Mesh(
    fusionar([
      plano(SALA_X * 2, GROSOR, 0, GZ),
      plano(MITAD * 2, GROSOR, 0, GZ + 6),
      colocar(new THREE.RingGeometry(6 - GROSOR / 2, 6 + GROSOR / 2, 28, 1, Math.PI, Math.PI / 2), -MITAD, 0.007, GZ, -Math.PI / 2),
      colocar(new THREE.RingGeometry(6 - GROSOR / 2, 6 + GROSOR / 2, 28, 1, Math.PI * 1.5, Math.PI / 2), MITAD, 0.007, GZ, -Math.PI / 2),
      plano(1, GROSOR * 1.4, 0, GZ + 7.12),
    ]),
    R(new THREE.MeshBasicMaterial({ color: 0xf4f4f4 })),
  ));

  // Paredes con zócalo
  const texPared = R(ctx.texturaCanvas((g, tam, azar) => {
    g.fillStyle = '#36384a';
    g.fillRect(0, 0, tam, tam);
    for (let i = 0; i < 600; i++) {
      g.fillStyle = `rgba(${azar() < 0.5 ? '255,255,255' : '0,0,0'},${azar() * 0.07})`;
      g.fillRect(azar() * tam, azar() * tam, 3, 3);
    }
    const zocalo = tam * (1.2 / SALA_ALTO);
    g.fillStyle = '#1f3a86';
    g.fillRect(0, tam - zocalo, tam, zocalo);
    g.fillStyle = '#ff7a2a';
    g.fillRect(0, tam - zocalo - 4, tam, 4);
  }, { tam: 256, semilla: 6 }));
  const alturaPared = (p, i) => p.getY(i) * (3 / SALA_ALTO);
  raiz.add(new THREE.Mesh(
    fusionar([
      uvMundo(colocar(new THREE.PlaneGeometry(SALA_X * 2, SALA_ALTO), 0, SALA_ALTO / 2, SALA_FONDO), masX, alturaPared, 3),
      uvMundo(colocar(new THREE.PlaneGeometry(SALA_X * 2, SALA_ALTO), 0, SALA_ALTO / 2, SALA_FRENTE, 0, Math.PI), masX, alturaPared, 3),
      uvMundo(colocar(new THREE.PlaneGeometry(largoSala, SALA_ALTO), -SALA_X, SALA_ALTO / 2, centroZ, 0, Math.PI / 2), menosZ, alturaPared, 3),
      uvMundo(colocar(new THREE.PlaneGeometry(largoSala, SALA_ALTO), SALA_X, SALA_ALTO / 2, centroZ, 0, -Math.PI / 2), menosZ, alturaPared, 3),
    ]),
    R(new THREE.MeshLambertMaterial({ map: texPared })),
  ));

  // Gradas (asientos pintados) detrás de la portería; el público de 3D se coloca encima
  const texGradas = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#5c586a';
    g.fillRect(0, 0, tam, tam);
    const asiento = tam / 4;
    for (let k = 0; k < 4; k++) {
      const x = k * asiento + asiento * 0.1;
      const ancho = asiento * 0.8;
      g.fillStyle = '#3b66d0';
      g.fillRect(x, tam * 0.08, ancho, tam * 0.3);                // asiento visto desde arriba
      // Contrahuella: respaldo y, casi siempre, una persona sentada
      g.fillStyle = '#2a4aa0';
      g.fillRect(x, tam * 0.52, ancho, tam * 0.26);
    }
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, tam / 2 - 2, tam, 2);
  }, { tam: 256, semilla: 8 }));
  function filasGradas(largo, filas, fondoFila, altoFila, rotY, x, z) {
    const piezas = [];
    for (let i = 0; i < filas; i++) {
      const piso = new THREE.PlaneGeometry(largo, fondoFila);
      const contra = new THREE.PlaneGeometry(largo, altoFila);
      for (const [geo, v0] of [[piso, 0.5], [contra, 0]]) {
        const uv = geo.attributes.uv;
        for (let k = 0; k < uv.count; k++) uv.setXY(k, (uv.getX(k) * largo) / 2, v0 + uv.getY(k) * 0.5);
      }
      colocar(piso, 0, (i + 1) * altoFila, -(i + 0.5) * fondoFila, -Math.PI / 2);
      colocar(contra, 0, (i + 0.5) * altoFila, -i * fondoFila);
      piezas.push(colocar(piso, x, 0, z, 0, rotY), colocar(contra, x, 0, z, 0, rotY));
    }
    return piezas;
  }
  raiz.add(new THREE.Mesh(
    fusionar([
      ...filasGradas(SALA_X * 2, 5, 0.45, 0.45, 0, 0, -8.7),
      ...filasGradas(11, 3, 0.45, 0.4, -Math.PI / 2, 7.65, -3),
      ...filasGradas(11, 3, 0.45, 0.4, Math.PI / 2, -7.65, -3),
    ]),
    R(new THREE.MeshLambertMaterial({ map: texGradas })),
  ));

  // Público: espectadores sentados (cuerpo, cabeza y dos brazos) en tres mallas instanciadas.
  // Se mueven un poco siempre y se levantan a celebrar cuando entra un gol.
  const CAMISETAS = [0xe5483a, 0xf4f4f4, 0x2f6fe0, 0xffd23f, 0x3ccf7a, 0xff9d3a, 0x8a4fd8];
  const PIELES = [0xf2c9a0, 0xe0ac7c, 0xc68642, 0x8d5524, 0xffdbb4];
  const sitios = [];                                  // { base, fase, ... } uno por espectador
  function llenarGradas(largo, filas, fondoFila, altoFila, rotY, x, z) {
    const giro = new THREE.Matrix4().makeRotationY(rotY).setPosition(x, 0, z);
    for (let i = 0; i < filas; i++) {
      for (let lx = -largo / 2 + 0.25; lx < largo / 2; lx += 0.5) {
        if (Math.random() < 0.12) continue;           // algún asiento vacío
        const local = new THREE.Matrix4().makeTranslation(lx, (i + 1) * altoFila, -(i + 0.5) * fondoFila);
        sitios.push({
          base: giro.clone().multiply(local),
          fase: Math.random() * 6.28,
          ganas: 0.6 + Math.random() * 0.6,           // unos celebran más que otros
          camiseta: CAMISETAS[Math.floor(Math.random() * CAMISETAS.length)],
          piel: PIELES[Math.floor(Math.random() * PIELES.length)],
        });
      }
    }
  }
  llenarGradas(SALA_X * 2, 5, 0.45, 0.45, 0, 0, -8.7);
  llenarGradas(11, 3, 0.45, 0.4, -Math.PI / 2, 7.65, -3);
  llenarGradas(11, 3, 0.45, 0.4, Math.PI / 2, -7.65, -3);

  const brazoGeo = R(colocar(new THREE.BoxGeometry(0.07, 0.3, 0.07), 0, -0.15, 0));   // pivota desde el hombro
  const mallaCuerpos = new THREE.InstancedMesh(R(colocar(new THREE.BoxGeometry(0.3, 0.34, 0.2), 0, 0.17, 0)), R(new THREE.MeshLambertMaterial()), sitios.length);
  const mallaCabezas = new THREE.InstancedMesh(R(new THREE.SphereGeometry(0.095, 8, 6)), R(new THREE.MeshLambertMaterial()), sitios.length);
  const mallaBrazos = new THREE.InstancedMesh(brazoGeo, R(new THREE.MeshLambertMaterial()), sitios.length * 2);
  const color = new THREE.Color();
  sitios.forEach((s, i) => {
    mallaCuerpos.setColorAt(i, color.setHex(s.camiseta));
    mallaCabezas.setColorAt(i, color.setHex(s.piel));
    mallaBrazos.setColorAt(i * 2, color.setHex(s.camiseta));
    mallaBrazos.setColorAt(i * 2 + 1, color.setHex(s.camiseta));
  });
  for (const m of [mallaCuerpos, mallaCabezas, mallaBrazos]) {
    m.frustumCulled = false;
    raiz.add(m);
  }
  let ovacion = 0;                                    // 1 = todo el público en pie, baja sola
  const pieza = new THREE.Object3D();
  const matPieza = new THREE.Matrix4();

  function moverPublico(dt, t) {
    ovacion = Math.max(0, ovacion - dt * 0.4);
    const fuerza = Math.min(1, ovacion * 1.5);
    for (let i = 0; i < sitios.length; i++) {
      const s = sitios[i];
      const salto = ovacion > 0 ? Math.abs(Math.sin(t * 8 + s.fase)) * 0.14 * fuerza * s.ganas : 0;
      const respiro = Math.sin(t * 1.6 + s.fase) * 0.008;
      const alto = salto + respiro;
      // Cuerpo
      pieza.position.set(0, alto, 0);
      pieza.rotation.set(0, 0, Math.sin(t * 1.1 + s.fase) * 0.03);
      pieza.updateMatrix();
      mallaCuerpos.setMatrixAt(i, matPieza.multiplyMatrices(s.base, pieza.matrix));
      // Cabeza
      pieza.position.set(0, 0.45 + alto, 0);
      pieza.rotation.set(0, Math.sin(t * 0.7 + s.fase * 2) * 0.5 * (1 - fuerza), 0);
      pieza.updateMatrix();
      mallaCabezas.setMatrixAt(i, matPieza.multiplyMatrices(s.base, pieza.matrix));
      // Brazos: caídos en reposo y arriba al celebrar
      const alza = fuerza * s.ganas * (Math.PI * 0.85 + Math.sin(t * 10 + s.fase) * 0.25);
      for (const lado of [-1, 1]) {
        pieza.position.set(lado * 0.19, 0.3 + alto, 0);
        pieza.rotation.set(0, 0, lado * (0.08 + Math.min(alza, Math.PI * 0.95)));
        pieza.updateMatrix();
        mallaBrazos.setMatrixAt(i * 2 + (lado > 0 ? 1 : 0), matPieza.multiplyMatrices(s.base, pieza.matrix));
      }
    }
    mallaCuerpos.instanceMatrix.needsUpdate = true;
    mallaCabezas.instanceMatrix.needsUpdate = true;
    mallaBrazos.instanceMatrix.needsUpdate = true;
  }
  moverPublico(0, 0);

  // Vallas publicitarias detrás de la portería (solo franjas de color, sin texto)
  const texVallas = R(ctx.texturaCanvas((g, tam, azar) => {
    const colores = ['#e5483a', '#2f6fe0', '#ffd23f', '#f4f4f4', '#3ccf7a'];
    const n = 8;
    for (let k = 0; k < n; k++) {
      g.fillStyle = colores[Math.floor(azar() * colores.length)];
      g.fillRect((k * tam) / n, 0, tam / n, tam);
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect((k * tam) / n + 4, tam * 0.3, tam / n - 8, tam * 0.4);
    }
  }, { tam: 256, semilla: 12 }));
  const vallas = colocar(new THREE.PlaneGeometry(SALA_X * 2 - 0.5, 0.9), 0, 0.45, -8.45);
  const uvV = vallas.attributes.uv;
  for (let i = 0; i < uvV.count; i++) uvV.setXY(i, uvV.getX(i) * 3, uvV.getY(i));
  raiz.add(new THREE.Mesh(R(vallas), R(new THREE.MeshLambertMaterial({ map: texVallas }))));

  // Focos del techo (paneles que brillan, sin luces)
  const focos = [];
  for (const x of [-4.5, 0, 4.5]) for (const z of [-8, -3.5, 1]) focos.push(colocar(new THREE.PlaneGeometry(1.4, 0.5), x, SALA_ALTO - 0.2, z, Math.PI / 2));
  raiz.add(new THREE.Mesh(fusionar(focos), R(new THREE.MeshBasicMaterial({ color: 0xfff1d0 }))));

  // ─── Portería ──────────────────────────────────────────────────────────
  const rayas = [];
  const blancos = [];
  const palo = (largo, x, y, z, rx, ry, rz) => {
    const n = Math.round(largo / 0.4);
    for (let i = 0; i < n; i++) {
      const trozo = largo / n;
      const centro = -largo / 2 + trozo * (i + 0.5);
      const geo = new THREE.CylinderGeometry(POSTE + 0.002, POSTE + 0.002, trozo, 10);
      colocar(geo, 0, centro, 0);                    // a lo largo del eje Y local
      colocar(geo, x, y, z, rx, ry, rz);
      (i % 2 ? blancos : rayas).push(geo);
    }
  };
  palo(ALTO, -MITAD, ALTO / 2, GZ, 0, 0, 0);
  palo(ALTO, MITAD, ALTO / 2, GZ, 0, 0, 0);
  palo(MITAD * 2, 0, ALTO, GZ, 0, 0, Math.PI / 2);
  const barraFina = (ancho, alto, largo, x, y, z) => blancos.push(colocar(new THREE.BoxGeometry(ancho, alto, largo), x, y, z));
  for (const lado of [-1, 1]) {
    barraFina(0.05, 0.05, FONDO_RED, lado * MITAD, ALTO, GZ - FONDO_RED / 2);   // arriba atrás
    barraFina(0.05, 0.05, FONDO_RED, lado * MITAD, 0.03, GZ - FONDO_RED / 2);   // abajo atrás
  }
  barraFina(MITAD * 2, 0.05, 0.05, 0, ALTO, GZ - FONDO_RED);
  barraFina(MITAD * 2, 0.05, 0.05, 0, 0.03, GZ - FONDO_RED);
  const matPorteria = R(new THREE.MeshLambertMaterial({ color: 0xf6f6f6 }));
  raiz.add(new THREE.Mesh(fusionar(blancos), matPorteria));
  raiz.add(new THREE.Mesh(fusionar(rayas), R(new THREE.MeshLambertMaterial({ color: 0xd8321f }))));

  // Red: una rejilla pintada con recorte (sin transparencia, sin ordenar)
  const texRed = R(ctx.texturaCanvas((g, tam) => {
    g.clearRect(0, 0, tam, tam);
    g.strokeStyle = '#ffffff';
    g.lineWidth = 3;
    g.beginPath();
    g.moveTo(0, 0); g.lineTo(0, tam);
    g.moveTo(0, 0); g.lineTo(tam, 0);
    g.stroke();
  }, { tam: 64 }));
  const red = new THREE.Mesh(
    fusionar([
      uvMundo(colocar(new THREE.PlaneGeometry(MITAD * 2, ALTO), 0, ALTO / 2, GZ - FONDO_RED), masX, masY, 0.1),
      uvMundo(colocar(new THREE.PlaneGeometry(FONDO_RED, ALTO), -MITAD, ALTO / 2, GZ - FONDO_RED / 2, 0, Math.PI / 2), menosZ, masY, 0.1),
      uvMundo(colocar(new THREE.PlaneGeometry(FONDO_RED, ALTO), MITAD, ALTO / 2, GZ - FONDO_RED / 2, 0, Math.PI / 2), menosZ, masY, 0.1),
      uvMundo(colocar(new THREE.PlaneGeometry(MITAD * 2, FONDO_RED), 0, ALTO, GZ - FONDO_RED / 2, Math.PI / 2), masX, menosZ, 0.1),
    ]),
    R(new THREE.MeshBasicMaterial({ map: texRed, alphaTest: 0.4, side: THREE.DoubleSide })),
  );
  raiz.add(red);

  // ─── Portero ───────────────────────────────────────────────────────────
  const matCamiseta = R(new THREE.MeshLambertMaterial({ color: 0xf4c20d }));
  const matPantalon = R(new THREE.MeshLambertMaterial({ color: 0x1b2540 }));
  const matPiel = R(new THREE.MeshLambertMaterial({ color: 0xf0b894 }));
  const matGuante = R(new THREE.MeshLambertMaterial({ color: 0xff6a3d }));
  const portero = new THREE.Group();
  portero.position.set(0, 0, ZK);
  const torso = new THREE.Mesh(R(colocar(new THREE.CapsuleGeometry(0.2, 0.42, 4, 12), 0, 1.25, 0)), matCamiseta);
  const piernas = new THREE.Mesh(
    fusionar([
      colocar(new THREE.CylinderGeometry(0.2, 0.2, 0.28, 14), 0, 0.82, 0),
      colocar(new THREE.CylinderGeometry(0.075, 0.065, 0.72, 10), -0.1, 0.4, 0),
      colocar(new THREE.CylinderGeometry(0.075, 0.065, 0.72, 10), 0.1, 0.4, 0),
      colocar(new THREE.BoxGeometry(0.12, 0.07, 0.24), -0.1, 0.035, 0.05),
      colocar(new THREE.BoxGeometry(0.12, 0.07, 0.24), 0.1, 0.035, 0.05),
    ]),
    matPantalon,
  );
  const cabeza = new THREE.Mesh(R(new THREE.SphereGeometry(0.115, 14, 10)), matPiel);
  cabeza.position.y = 1.72;
  portero.add(torso, piernas, cabeza);
  const geoBrazo = R(new THREE.CylinderGeometry(0.05, 0.045, 0.6, 8));
  geoBrazo.translate(0, -0.3, 0);
  const geoGuante = R(new THREE.SphereGeometry(0.075, 10, 8));
  const brazos = [-1, 1].map((lado) => {
    const pivote = new THREE.Group();
    pivote.position.set(lado * 0.27, 1.48, 0);
    const manga = new THREE.Mesh(geoBrazo, matCamiseta);
    const guante = new THREE.Mesh(geoGuante, matGuante);
    guante.position.y = -0.64;
    pivote.add(manga, guante);
    portero.add(pivote);
    return { pivote, lado };
  });
  raiz.add(portero);

  // ─── Balón ─────────────────────────────────────────────────────────────
  // Cuero blanco con gajos azules y amarillos pintados
  const texBalon = R(ctx.texturaCanvas((g, tam, azar) => {
    g.fillStyle = '#f3eedc';
    g.fillRect(0, 0, tam, tam);
    const gajo = tam / 6;
    for (let k = 0; k < 6; k++) {
      g.fillStyle = k % 2 ? '#2c5fc4' : '#f2c230';
      g.fillRect(k * gajo + gajo * 0.18, 0, gajo * 0.64, tam);
    }
    for (let i = 0; i < 5000; i++) {
      g.fillStyle = `rgba(0,0,0,${azar() * 0.1})`;
      g.fillRect(azar() * tam, azar() * tam, 1.5, 1.5);
    }
    g.fillStyle = '#1a1a1a';
    for (let k = 0; k < 6; k++) g.fillRect(k * gajo - 1.5, 0, 3, tam);
  }, { tam: 512, semilla: 21 }));
  const balon = new THREE.Mesh(
    R(new THREE.SphereGeometry(RADIO_BALON, 28, 18)),
    R(new THREE.MeshStandardMaterial({ map: texBalon, roughness: 0.55, metalness: 0 })),
  );
  balon.visible = false;
  raiz.add(balon);

  // Soporte del balón (en VR, a la altura de la mano)
  const soporte = new THREE.Mesh(
    fusionar([
      colocar(new THREE.CylinderGeometry(0.065, 0.085, 0.06, 16), PUESTO_VR.x, PUESTO_VR.y - RADIO_BALON - 0.03, PUESTO_VR.z),
      colocar(new THREE.CylinderGeometry(0.012, 0.012, PUESTO_VR.y - 0.2, 6), PUESTO_VR.x, (PUESTO_VR.y - 0.2) / 2, PUESTO_VR.z),
      colocar(new THREE.CylinderGeometry(0.1, 0.1, 0.015, 16), PUESTO_VR.x, 0.0075, PUESTO_VR.z),
    ]),
    R(new THREE.MeshLambertMaterial({ color: 0x546e7a })),
  );
  raiz.add(soporte);

  const sombraBalon = ctx.crearSombra({ radio: 0.14, opacidad: 0.55 });
  const sombraPortero = ctx.crearSombra({ radio: 0.45, opacidad: 0.5 });
  raiz.add(sombraBalon, sombraPortero);

  // Manos visibles en VR
  const geoMano = R(new THREE.SphereGeometry(0.045, 12, 8));
  geoMano.scale(1, 0.6, 1.3);
  const matMano = R(new THREE.MeshLambertMaterial({ color: 0xffcc80 }));
  const manos = ctx.manos.map((mano) => {
    ctx.adjuntarAMano(mano, new THREE.Mesh(geoMano, matMano));
    return { mano, historial: [], apretonAntes: false };
  });

  // Barra de fuerza (ratón) y mira sobre la portería
  const barra = new THREE.Group();
  barra.position.set(0.32, 1.1, -0.5);
  const fondoBarra = new THREE.Mesh(R(new THREE.BoxGeometry(0.035, 0.4, 0.01)), R(new THREE.MeshBasicMaterial({ color: 0x222233 })));
  fondoBarra.position.y = 0.2;
  const geoRelleno = R(new THREE.BoxGeometry(0.025, 0.4, 0.012));
  geoRelleno.translate(0, 0.2, 0);
  const relleno = new THREE.Mesh(geoRelleno, R(new THREE.MeshBasicMaterial({ color: 0xff9800 })));
  const marca = new THREE.Mesh(R(new THREE.BoxGeometry(0.05, 0.012, 0.014)), R(new THREE.MeshBasicMaterial({ color: 0x00e676 })));
  marca.position.y = PODER_IDEAL * 0.4;
  barra.add(fondoBarra, relleno, marca);
  raiz.add(barra);
  const Z_MIRA = ZK + 0.2;
  const mira = new THREE.Mesh(
    R(new THREE.RingGeometry(0.11, 0.145, 24)),
    R(new THREE.MeshBasicMaterial({ color: 0xff6a3d, depthTest: false, transparent: true, opacity: 0.9 })),
  );
  mira.renderOrder = 4;
  mira.position.z = Z_MIRA;
  mira.visible = false;
  raiz.add(mira);

  // Marcador y fila de lanzamientos (verde = gol, rojo = fallo)
  const marcador = ctx.crearPanel({ ancho: 3.2, alto: 0.9 });
  marcador.mesh.position.set(0, 3.45, GZ - 0.5);
  raiz.add(marcador.mesh);
  const discos = new THREE.InstancedMesh(
    R(colocar(new THREE.CylinderGeometry(0.13, 0.13, 0.03, 14), 0, 0, 0, Math.PI / 2)),
    R(new THREE.MeshBasicMaterial({ toneMapped: false })),
    PENALTIS,
  );
  const colorTmp = new THREE.Color();
  const matDisco = new THREE.Matrix4();
  for (let i = 0; i < PENALTIS; i++) {
    discos.setMatrixAt(i, matDisco.makeTranslation((i - (PENALTIS - 1) / 2) * 0.34, 2.72, GZ - 0.5));
    discos.setColorAt(i, colorTmp.set(0x59607a));
  }
  raiz.add(discos);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro';        // 'intro' | 'jugando' | 'fin'
  let fase = 'listo';          // 'listo' | 'vuelo' | 'pausa'
  let reloj = 3.5;
  let n = 1;                   // penalti actual
  let puntos = 0;
  let goles = 0;
  let racha = 0;
  let record = ctx.leer('record', 0);
  let mensaje = '';
  let tiempoMensaje = 0;
  let tiempoPausa = 0;
  let silbato = 0;             // espera tras el silbato antes de poder coger el balón
  let estadoBalon = 'puesto';  // 'puesto' | 'mano' | 'vuelo' | 'oculto'
  let manoQueLleva = null;
  let cargando = false;
  let faseCarga = 0;
  const vel = new THREE.Vector3();
  let resuelto = false;
  let enRed = false;
  let vida = 0;
  // Portero: punto de las manos (kx, ky) y su movimiento hacia el objetivo
  let kx = 0;
  let ky = 1;
  let de = { x: 0, y: 1 };
  let a = { x: 0, y: 1 };
  let tk = 0;
  let retardo = 0;
  let duracion = 1;
  let meneoRed = 0;

  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const anterior = new THREE.Vector3();
  const puntoTexto = new THREE.Vector3();
  const puntoEfecto = new THREE.Vector3();

  function actualizarMarcador() {
    if (estado === 'intro') {
      marcador.escribir([
        { texto: ctx.t('titulo'), tam: 1.3, color: '#ffab40' },
        { texto: ctx.t(ctx.enVR() ? 'introVR' : ctx.tactil ? 'introTactil' : 'introRaton'), tam: 0.7 },
      ]);
    } else if (estado === 'fin') {
      marcador.escribir([
        { texto: ctx.t('fin', { n: puntos }), tam: 1.3, color: '#ffab40' },
        { texto: ctx.t('resumen', { goles, total: PENALTIS, record, n: Math.ceil(reloj) }), tam: 0.7 },
      ]);
    } else {
      marcador.escribir([
        { texto: ctx.t('marcador', { goles, puntos }), tam: 1.3 },
        tiempoMensaje > 0
          ? { texto: mensaje, tam: 0.8, color: '#fff59d' }
          : { texto: ctx.t('penalti', { n, total: PENALTIS }), tam: 0.7, color: '#ffab40' },
      ]);
    }
  }
  function avisar(texto) {
    mensaje = texto;
    tiempoMensaje = 1.8;
  }
  function pintarDisco(i, color) {
    discos.setColorAt(i, colorTmp.set(color));
    discos.instanceColor.needsUpdate = true;
  }

  // ─── Lanzamiento ───────────────────────────────────────────────────────
  // Velocidad para ir de «origen» a «objetivo» con una rapidez horizontal dada
  function velocidadHacia(origen, x, y, rapidez, salida) {
    const dz = GZ - origen.z;
    const t = Math.abs(dz) / rapidez;
    return salida.set((x - origen.x) / t, (y - origen.y) / t + 0.5 * G * t, dz / t);
  }

  // El portero decide cómo tirarse en cuanto sale el balón: a veces lee el tiro y a veces adivina
  function decidirPortero(origen, v) {
    const lectura = Math.min(0.7, 0.3 + 0.04 * (n - 1));
    let objX = 0;
    let objY = 1;
    const t = v.z < -1 ? (ZK - origen.z) / v.z : 0;
    if (t > 0 && Math.random() < lectura) {
      const py = origen.y + v.y * t - 0.5 * G * t * t;
      objX = THREE.MathUtils.clamp(origen.x + v.x * t + (Math.random() - 0.5) * 0.4, -1.5, 1.5);
      objY = THREE.MathUtils.clamp(py + (Math.random() - 0.5) * 0.4, 0.4, 1.75);
    } else {
      objX = [-1.1, 0, 1.1][Math.floor(Math.random() * 3)];
      objY = [0.55, 1, 1.5][Math.floor(Math.random() * 3)];
    }
    de = { x: kx, y: ky };
    a = { x: objX, y: objY };
    tk = 0;
    retardo = (0.13 + Math.random() * 0.06) / RAPIDEZ;
    duracion = (0.15 + 0.22 * Math.hypot(objX - kx, (objY - ky) / 1.3)) / RAPIDEZ;
  }

  function lanzar(origen, v) {
    estadoBalon = 'vuelo';
    fase = 'vuelo';
    vel.copy(v);
    resuelto = false;
    enRed = false;
    vida = 4;
    balon.position.copy(origen);
    decidirPortero(origen, v);
    ctx.sonido('patada');
  }

  // Corrige un poco un buen lanzamiento VR para que vaya a la portería (sin peso, lanzar es difícil)
  function ayudar(origen, v) {
    if (v.z > -2) return v;
    const t = (ZK - origen.z) / v.z;
    const px = origen.x + v.x * t;
    const py = origen.y + v.y * t - 0.5 * G * t * t;
    if (t < 0.15 || t > 1.4 || Math.abs(px) > 2.1 || py < -0.3 || py > 2.6) return v;
    const objX = THREE.MathUtils.clamp(px, -1.4, 1.4);
    const objY = THREE.MathUtils.clamp(py, 0.15, 1.85);
    const ideal = tmp2.set((objX - origen.x) / t, (objY - origen.y) / t + 0.5 * G * t, v.z);
    return v.lerp(ideal, AYUDA);
  }

  // ─── Resultado de cada lanzamiento ─────────────────────────────────────
  function resolver(tipo, x, y) {
    if (resuelto) return;
    resuelto = true;
    fase = 'pausa';
    tiempoPausa = 1.9;
    puntoEfecto.set(x, y, GZ);
    if (tipo === 'gol') {
      goles += 1;
      racha += 1;
      const escuadra = Math.abs(x) > 0.95 && y > 1.4;
      let valor = VALOR_GOL + (escuadra ? VALOR_ESCUADRA : 0);
      if (racha >= 3) valor *= 2;
      puntos += valor;
      meneoRed = 1;
      ctx.sonido('red');
      ctx.sonido('gol');
      for (const m of ctx.manos) ctx.vibrar(m, 0.4, 60);
      ctx.efectos.impacto(escuadra || racha >= 3 ? 'grande' : 'medio', { pos: puntoEfecto, color: racha >= 3 ? 0xffd54f : 0xff8a3d });
      puntoTexto.set(x, y + 0.35, GZ + 0.3);
      ctx.efectos.texto(puntoTexto, `+${valor}`, { color: racha >= 3 ? '#ffd54f' : '#ffffff', tam: 1 + valor * 0.03 });
      if (racha >= 3) avisar(ctx.t('racha', { n: racha, valor }));
      else if (escuadra) avisar(ctx.t('escuadra', { valor }));
      else avisar(ctx.t('gol', { valor }));
      pintarDisco(n - 1, 0x3ddc84);
      ctx.sonido('ovacion');
      ovacion = escuadra || racha >= 3 ? 1.6 : 1.2;
    } else {
      racha = 0;
      // Fallar se nota distinto: sin celebración, solo un sonido seco y una vibración corta
      ctx.sonido('fallo');
      for (const m of ctx.manos) ctx.vibrar(m, 0.25, 40);
      avisar(ctx.t(tipo));
      pintarDisco(n - 1, tipo === 'palo' || tipo === 'larguero' ? 0xffb74d : 0xe0453a);
    }
    // El portero vuelve al centro mientras tanto
    de = { x: kx, y: ky };
    a = { x: 0, y: 1 };
    tk = 0;
    retardo = 0.5;
    duracion = 0.7;
  }

  // ─── Física del balón ──────────────────────────────────────────────────
  function moverBalon(dt) {
    const pos = balon.position;
    const pasos = Math.max(1, Math.ceil((vel.length() * dt) / 0.04));
    const h = dt / pasos;
    for (let i = 0; i < pasos; i++) {
      anterior.copy(pos);
      vel.y -= G * h;
      pos.addScaledVector(vel, h);

      // Plano del portero: al cruzarlo, ¿lo toca?
      if (!resuelto && anterior.z > ZK && pos.z <= ZK) {
        const f = (anterior.z - ZK) / (anterior.z - pos.z);
        const x = anterior.x + (pos.x - anterior.x) * f;
        const y = anterior.y + (pos.y - anterior.y) * f;
        const dx = (x - kx) / ALCANCE_X;
        const dy = (y - ky) / ALCANCE_Y;
        if (dx * dx + dy * dy < 1) {
          pos.z = ZK + RADIO_BALON;
          vel.set((Math.random() - 0.5) * 4, 2 + Math.random() * 2, Math.abs(vel.z) * 0.3);
          puntoEfecto.set(x, y, ZK);
          ctx.efectos.impacto('pequeño', { pos: puntoEfecto, color: 0xff6a3d, sonido: 'golpe' });
          resolver('parada', x, y);
        }
      }
      // Línea de gol: gol, palo, larguero o fuera
      if (!resuelto && anterior.z > GZ && pos.z <= GZ) {
        const f = (anterior.z - GZ) / (anterior.z - pos.z);
        const x = anterior.x + (pos.x - anterior.x) * f;
        const y = anterior.y + (pos.y - anterior.y) * f;
        const ax = Math.abs(x);
        const margen = POSTE + RADIO_BALON * 0.9;
        const dentroX = ax < MITAD - margen;
        const dentroY = y < ALTO - margen;
        if (dentroX && dentroY) {
          enRed = true;
          resolver('gol', x, y);
        } else if (ax < MITAD + margen && y < ALTO + margen && !dentroX) {
          pos.z = GZ + RADIO_BALON;
          vel.z = Math.abs(vel.z) * 0.45;
          vel.x *= 0.6;
          ctx.sonido('golpe');
          resolver('palo', x, y);
        } else if (dentroX && y < ALTO + margen) {
          pos.z = GZ + RADIO_BALON;
          vel.z = Math.abs(vel.z) * 0.45;
          vel.y = -Math.abs(vel.y) * 0.5;
          ctx.sonido('golpe');
          resolver('larguero', x, y);
        } else {
          resolver('fuera', x, y);
        }
      }

      // Dentro de la red el balón se frena
      if (enRed) {
        if (pos.z < GZ - FONDO_RED + RADIO_BALON) {
          pos.z = GZ - FONDO_RED + RADIO_BALON;
          vel.z *= -0.12;
          vel.x *= 0.4;
          vel.y *= 0.4;
        }
        if (Math.abs(pos.x) > MITAD - RADIO_BALON) {
          pos.x = Math.sign(pos.x) * (MITAD - RADIO_BALON);
          vel.x *= -0.2;
        }
        if (pos.y > ALTO - RADIO_BALON) {
          pos.y = ALTO - RADIO_BALON;
          vel.y *= -0.2;
        }
      }
      // Pared del fondo
      if (pos.z < SALA_FONDO + 0.2 + RADIO_BALON) {
        pos.z = SALA_FONDO + 0.2 + RADIO_BALON;
        vel.z *= -0.4;
      }
      // Suelo
      if (pos.y < RADIO_BALON) {
        pos.y = RADIO_BALON;
        if (vel.y < 0) {
          if (vel.y < -1.2) ctx.sonido('bote');
          vel.y *= -0.55;
          vel.x *= 0.85;
          vel.z *= 0.85;
        }
      }
    }
    balon.rotation.x -= vel.z * dt * 3;
    balon.rotation.z += vel.x * dt * 3;
    vida -= dt;
    // Si se queda corto o se para sin llegar, cuenta como fallo
    if (!resuelto && (vida <= 0 || (pos.y <= RADIO_BALON + 0.01 && Math.abs(vel.z) < 0.6))) resolver('corto', pos.x, 0.1);
  }

  // ─── Portero animado ───────────────────────────────────────────────────
  function moverPortero(dt) {
    tk += dt;
    const s = suave(THREE.MathUtils.clamp((tk - retardo) / duracion, 0, 1));
    kx = de.x + (a.x - de.x) * s;
    ky = de.y + (a.y - de.y) * s;
    const esfuerzo = Math.min(1, Math.hypot(kx, (ky - 1) * 0.8) / 1.1);
    // El cuerpo se desplaza y se inclina hacia el lado del balón para que sus manos lleguen a (kx, ky)
    portero.position.x = kx * 0.5;
    portero.position.y = Math.max(0, (ky - 1) * 0.35);
    portero.rotation.z = -Math.asin(THREE.MathUtils.clamp(kx * 0.5, -0.85, 0.85));
    portero.scale.y = 1 - Math.max(0, 1 - ky) * 0.25;
    for (const b of brazos) {
      // De brazos algo abiertos a los brazos arriba, hacia el lado al que se tira
      const arriba = Math.min(1, 0.15 + esfuerzo * 0.9 + Math.max(0, ky - 1) * 0.5);
      b.pivote.rotation.z = b.lado * (0.5 + arriba * 2.1);
    }
    ctx.colocarSombra(sombraPortero, portero.position, 0);
  }

  // ─── Manos VR ──────────────────────────────────────────────────────────
  function velocidadMano(m) {
    // Media de los últimos ~80 ms para que el lanzamiento no dependa de un solo fotograma
    const h = m.historial;
    let tiempo = 0;
    let i = h.length - 1;
    while (i > 0 && tiempo < 0.08) {
      tiempo += h[i].dt;
      i--;
    }
    if (tiempo <= 0) return tmp.set(0, 0, 0);
    return tmp.copy(h[h.length - 1].pos).sub(h[i].pos).divideScalar(tiempo);
  }

  function manosVR(dt) {
    for (const m of manos) {
      const mano = m.mano;
      if (!mano.activa) {
        if (manoQueLleva === m) {
          manoQueLleva = null;
          estadoBalon = 'puesto';
        }
        m.historial.length = 0;
        continue;
      }
      if (m.historial.length >= 12) {
        const viejo = m.historial.shift();
        viejo.pos.copy(mano.posicion);
        viejo.dt = dt;
        m.historial.push(viejo);
      } else {
        m.historial.push({ pos: mano.posicion.clone(), dt });
      }

      const apretonPulsado = mano.apreton && !m.apretonAntes;
      m.apretonAntes = mano.apreton;

      if (estadoBalon === 'puesto' && silbato <= 0 && (mano.gatilloPulsado || apretonPulsado) &&
          balon.position.distanceTo(mano.posicion) < ALCANCE_AGARRE) {
        estadoBalon = 'mano';
        manoQueLleva = m;
        ctx.vibrar(mano, 0.3, 30);
      }

      if (estadoBalon === 'mano' && manoQueLleva === m) {
        mano.grip.localToWorld(balon.position.set(0, -0.02, -0.08));
        if (!mano.gatillo && !mano.apreton) {
          const v = velocidadMano(m).multiplyScalar(FUERZA_VR);
          manoQueLleva = null;
          const rapidez = v.length();
          if (rapidez >= 3.4 && rapidez < RAPIDEZ_MIN_VR) v.multiplyScalar(RAPIDEZ_MIN_VR / rapidez);
          if (rapidez < 3.4) {
            estadoBalon = 'puesto';      // suelta sin lanzar: vuelve al soporte
          } else {
            lanzar(balon.position, ayudar(balon.position, v));
          }
        }
      }
    }
  }

  // ─── Ratón ─────────────────────────────────────────────────────────────
  function raton(dt) {
    const r = ctx.raton;
    const listo = estado === 'jugando' && fase === 'listo' && estadoBalon === 'puesto' && silbato <= 0;
    // Punto de la portería a donde apunta el ratón (en el plano de la mira)
    const rayo = r.rayo.ray;
    const t = (Z_MIRA - rayo.origin.z) / (Math.abs(rayo.direction.z) > 1e-4 ? rayo.direction.z : -1e-4);
    const objX = THREE.MathUtils.clamp(rayo.origin.x + rayo.direction.x * t, -2.1, 2.1);
    const objY = THREE.MathUtils.clamp(rayo.origin.y + rayo.direction.y * t, 0.1, 2.6);
    mira.visible = listo || cargando;
    if (!cargando) mira.position.set(objX, objY, Z_MIRA);
    barra.visible = true;

    if (r.clic && listo) {
      cargando = true;
      faseCarga = 0;
    }
    let carga = 0;
    if (cargando) {
      faseCarga += dt * 0.95;
      carga = 1 - Math.abs((faseCarga % 2) - 1);
      mira.position.set(objX, objY, Z_MIRA);
      if (!r.pulsado) {
        cargando = false;
        // Fuerza mal medida = el balón se desvía en una dirección al azar
        const error = Math.abs(carga - PODER_IDEAL) * 2.4 * (0.4 + Math.random() * 0.6);
        const giro = Math.random() * Math.PI * 2;
        const x = objX + Math.cos(giro) * error;
        const y = objY + Math.sin(giro) * error;
        lanzar(PUESTO_RATON, velocidadHacia(PUESTO_RATON, x, y, (14 + carga * 8) * RAPIDEZ, tmp));
        carga = 0;
      }
    }
    relleno.scale.y = Math.max(0.001, carga);
  }

  // ─── Bucle ─────────────────────────────────────────────────────────────
  function empezar() {
    estado = 'jugando';
    fase = 'listo';
    n = 1;
    puntos = 0;
    goles = 0;
    racha = 0;
    estadoBalon = 'puesto';
    silbato = 0.8;
    for (let i = 0; i < PENALTIS; i++) pintarDisco(i, 0x59607a);
    ctx.sonido('silbato');
  }

  function actualizar(dt, t) {
    reloj -= dt;
    tiempoMensaje -= dt;
    silbato -= dt;

    if (estado === 'intro' && reloj <= 0) {
      empezar();
    } else if (estado === 'fin' && reloj <= 0) {
      empezar();
    } else if (estado === 'jugando' && fase === 'pausa') {
      tiempoPausa -= dt;
      if (tiempoPausa <= 0) {
        estadoBalon = 'oculto';
        if (n >= PENALTIS) {
          estado = 'fin';
          reloj = 6;
          ctx.puntuacion(puntos); // a la clasificación (juegos/marcadores.js)
          if (puntos > record) {
            record = puntos;
            ctx.guardar('record', record);
          }
          ctx.sonido('fin');
        } else {
          n += 1;
          fase = 'listo';
          estadoBalon = 'puesto';
          silbato = 0.8;
          ctx.sonido('silbato');
        }
      }
    }

    // El balón: en el soporte, en la mano o en el aire
    const enListo = estado === 'jugando' && fase === 'listo';
    if (estadoBalon === 'puesto') {
      balon.visible = enListo || estado === 'intro';
      balon.position.copy(ctx.enVR() ? PUESTO_VR : PUESTO_RATON);
      balon.rotation.set(0, 0, 0);
    } else {
      balon.visible = estadoBalon !== 'oculto';
    }
    soporte.visible = ctx.enVR();
    if (ctx.enVR()) {
      barra.visible = false;
      mira.visible = false;
      cargando = false;
      if (enListo || estadoBalon === 'mano') manosVR(dt);
    } else {
      raton(dt);
    }
    if (estadoBalon === 'vuelo') moverBalon(dt);

    ctx.bloquearCambio(estadoBalon === 'mano'); // con el balón cogido no se puede pasar de juego

    moverPortero(dt);
    moverPublico(dt, t);
    // La red se menea al entrar el balón
    meneoRed = Math.max(0, meneoRed - dt * 2.5);
    red.scale.set(1 + meneoRed * 0.05, 1 + Math.sin(t * 30) * meneoRed * 0.03, 1 + meneoRed * 0.05);

    sombraBalon.visible = balon.visible;
    if (balon.visible) ctx.colocarSombra(sombraBalon, balon.position, 0);
    actualizarMarcador();
  }

  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      estadoBalon = 'oculto';
    },
  };
}
