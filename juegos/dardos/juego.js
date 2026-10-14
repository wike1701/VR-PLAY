// DARDOS
// Diana reglamentaria en la pared de una taberna, a 2,37 m de la línea de tiro.
// 5 rondas de 3 dardos: cada dardo suma lo que marca la diana (dobles, triples,
// 25 y 50 en el centro). En VR llevas un dardo en cada mano: aprieta el gatillo
// (o el botón lateral), echa el brazo atrás y suelta al lanzar. Sin gafas: la mira
// tiembla un poco como el pulso; haz clic o toca cuando esté donde quieres.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const RONDAS = 5;
const DARDOS_RONDA = 3;
const G = 6;                    // gravedad de los dardos: más suave que la real (se lanzan sin peso)
const FUERZA_VR = 1.5;          // los lanzamientos en VR se quedan cortos sin el peso del dardo
const AYUDA = 0.5;              // cuánto se corrige la caída de un buen lanzamiento en VR (no la dirección)
const VEL_MINIMA = 1.2;         // m/s de la mano para que soltar cuente como lanzamiento
const RECARGA_MANO = 0.35;      // segundos hasta que aparece el siguiente dardo en la mano
const DIANA = new THREE.Vector3(0, 1.73, -2.37); // centro de la cara de la diana (altura y distancia reglamentarias)
const Z_PARED = -2.47;
const X_PARED = 3;
const TECHO = 3;
const R_DIANA = 0.226;          // radio total, con el anillo de los números
// Radios reglamentarios (m)
const R_DOBLE_BULL = 0.00635;
const R_BULL = 0.0159;
const R_TRIPLE_IN = 0.099;
const R_TRIPLE_OUT = 0.107;
const R_DOBLE_IN = 0.162;
const R_DOBLE_OUT = 0.17;
// Orden de los sectores en el sentido de las agujas del reloj, empezando por el 20 de arriba
const SECTORES = [20, 1, 18, 4, 13, 6, 10, 15, 2, 17, 3, 19, 7, 16, 8, 11, 14, 9, 12, 5];
// Ratón: desde dónde sale el dardo, cuánto tarda y cuánto tiembla la mira
const MANO_RATON = new THREE.Vector3(0.11, 1.56, -1.62);
const T_VUELO_RATON = 0.3;
const PULSO = 0.022;
const RECARGA_RATON = 0.45;
const MENOS_Z = new THREE.Vector3(0, 0, -1);
const GIRO_DARDO = new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(1, 0, 0), -Math.PI / 2); // dardo en la mano: al frente

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  // Interior de taberna: cálido y en penumbra
  ctx.fondo(0x2a1d16, { cenit: 0x1a120d, horizonte: 0x3a2a1e, suelo: 0x22180f, niebla: [9, 20] });
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.66, -1.25), new THREE.Vector3(0, 1.52, DIANA.z));

  // ─── Utilidades de geometría (ver Pincha Globos) ───────────────────────
  const matrizTmp = new THREE.Matrix4();
  const eulerTmp = new THREE.Euler();
  function colocar(geo, x, y, z, rx = 0, ry = 0, rz = 0) {
    matrizTmp.makeRotationFromEuler(eulerTmp.set(rx, ry, rz)).setPosition(x, y, z);
    return geo.applyMatrix4(matrizTmp);
  }
  function pintar(geo, color) {
    const c = new THREE.Color(color);
    const n = geo.attributes.position.count;
    const col = new Float32Array(n * 3);
    for (let i = 0; i < n; i++) col.set([c.r, c.g, c.b], i * 3);
    geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    return geo;
  }
  function fusionar(geos) {
    const conColor = geos.every((g) => g.attributes.color);
    let nv = 0;
    let ni = 0;
    for (const g of geos) {
      nv += g.attributes.position.count;
      ni += g.index ? g.index.count : g.attributes.position.count;
    }
    const pos = new Float32Array(nv * 3);
    const nor = new Float32Array(nv * 3);
    const uv = new Float32Array(nv * 2);
    const col = conColor ? new Float32Array(nv * 3) : null;
    const indices = nv > 65535 ? new Uint32Array(ni) : new Uint16Array(ni);
    let ov = 0;
    let oi = 0;
    for (const g of geos) {
      const n = g.attributes.position.count;
      pos.set(g.attributes.position.array, ov * 3);
      nor.set(g.attributes.normal.array, ov * 3);
      uv.set(g.attributes.uv.array, ov * 2);
      if (col) col.set(g.attributes.color.array, ov * 3);
      if (g.index) for (let i = 0; i < g.index.count; i++) indices[oi++] = g.index.array[i] + ov;
      else for (let i = 0; i < n; i++) indices[oi++] = ov + i;
      ov += n;
      g.dispose();
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.BufferAttribute(pos, 3));
    geo.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
    geo.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
    if (col) geo.setAttribute('color', new THREE.BufferAttribute(col, 3));
    geo.setIndex(new THREE.BufferAttribute(indices, 1));
    return R(geo);
  }

  // ─── Taberna ───────────────────────────────────────────────────────────
  ctx.sueloBase(false);
  const suelo = new THREE.Mesh(
    R(new THREE.PlaneGeometry(X_PARED * 2, 6)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tablas(0x7a4a2a, { tablas: 8, repetir: [3, 3], tam: 512, semilla: 3 })) })),
  );
  suelo.rotation.x = -Math.PI / 2;
  suelo.position.z = Z_PARED + 3;
  raiz.add(suelo);
  // Paredes de ladrillo visto (fondo y laterales) con zócalo de madera
  const matLadrillo = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.ladrillos(0x8a4a34, 0x4a3a32, { filas: 10, columnas: 4, repetir: [4, 2], tam: 512, semilla: 5 })) }));
  const fondo = new THREE.Mesh(R(new THREE.PlaneGeometry(X_PARED * 2, TECHO)), matLadrillo);
  fondo.position.set(0, TECHO / 2, Z_PARED);
  raiz.add(fondo);
  const geoLateral = R(new THREE.PlaneGeometry(6, TECHO));
  for (const lado of [-1, 1]) {
    const lateral = new THREE.Mesh(geoLateral, matLadrillo);
    lateral.position.set(lado * X_PARED, TECHO / 2, Z_PARED + 3);
    lateral.rotation.y = -lado * Math.PI / 2;
    raiz.add(lateral);
  }
  const matZocalo = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tablas(0x4e2f1c, { tablas: 3, repetir: [4, 1], semilla: 7 })) }));
  const zocalo = new THREE.Mesh(
    fusionar([
      colocar(new THREE.BoxGeometry(X_PARED * 2, 0.95, 0.03), 0, 0.475, Z_PARED + 0.015),
      colocar(new THREE.BoxGeometry(0.03, 0.95, 6), -X_PARED + 0.015, 0.475, Z_PARED + 3),
      colocar(new THREE.BoxGeometry(0.03, 0.95, 6), X_PARED - 0.015, 0.475, Z_PARED + 3),
      colocar(new THREE.BoxGeometry(X_PARED * 2, 0.05, 0.06), 0, 0.97, Z_PARED + 0.03),
    ]),
    matZocalo,
  );
  raiz.add(zocalo);
  // Techo de madera con vigas
  const matVigas = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.madera(0x3e2616, { repetir: [3, 1], semilla: 9 })) }));
  const techo = new THREE.Mesh(R(new THREE.PlaneGeometry(X_PARED * 2, 6)), matVigas);
  techo.rotation.x = Math.PI / 2;
  techo.position.set(0, TECHO, Z_PARED + 3);
  const piezasVigas = [];
  for (let i = 0; i < 4; i++) piezasVigas.push(colocar(new THREE.BoxGeometry(X_PARED * 2, 0.18, 0.16), 0, TECHO - 0.09, Z_PARED + 0.6 + i * 1.5));
  const vigas = new THREE.Mesh(fusionar(piezasVigas), matVigas);
  raiz.add(techo, vigas);

  // Barra a la derecha: mostrador, estante con botellas y taburetes
  const matBarra = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tablas(0x6b3d22, { tablas: 6, repetir: [1, 2], semilla: 11 })) }));
  const barra = new THREE.Mesh(
    fusionar([
      colocar(new THREE.BoxGeometry(0.6, 1.05, 2.6), X_PARED - 0.75, 0.525, -0.6),
      colocar(new THREE.BoxGeometry(0.75, 0.06, 2.7), X_PARED - 0.78, 1.08, -0.6),
      colocar(new THREE.BoxGeometry(0.3, 0.04, 2.6), X_PARED - 0.15, 1.45, -0.6),
      colocar(new THREE.BoxGeometry(0.3, 0.04, 2.6), X_PARED - 0.15, 1.85, -0.6),
    ]),
    matBarra,
  );
  raiz.add(barra);
  // Botellas: una malla instanciada con el color de cada una
  const geoBotella = R(new THREE.LatheGeometry([
    new THREE.Vector2(0, 0), new THREE.Vector2(0.035, 0), new THREE.Vector2(0.037, 0.02), new THREE.Vector2(0.037, 0.17),
    new THREE.Vector2(0.03, 0.2), new THREE.Vector2(0.012, 0.24), new THREE.Vector2(0.012, 0.29), new THREE.Vector2(0, 0.29),
  ], 10));
  const botellas = new THREE.InstancedMesh(geoBotella, R(new THREE.MeshLambertMaterial({ emissive: 0x150a04 })), 24);
  const colorTmp = new THREE.Color();
  const COLORES_BOTELLA = [0x2e7d32, 0x6d4c41, 0xb28704, 0x1565c0, 0x8e2430, 0xdcdcdc];
  for (let i = 0; i < 24; i++) {
    const estante = i < 12 ? 1.47 : 1.87;
    matrizTmp.makeTranslation(X_PARED - 0.15 + ((i * 7) % 3 - 1) * 0.04, estante, -1.75 + (i % 12) * 0.2);
    botellas.setMatrixAt(i, matrizTmp);
    botellas.setColorAt(i, colorTmp.set(COLORES_BOTELLA[(i * 5) % COLORES_BOTELLA.length]));
  }
  raiz.add(botellas);
  const matTaburete = R(new THREE.MeshLambertMaterial({ color: 0x2b2b2b }));
  const piezasTaburetes = [];
  for (const z of [-1.5, -0.6, 0.3]) {
    piezasTaburetes.push(
      colocar(new THREE.CylinderGeometry(0.2, 0.2, 0.06, 16), X_PARED - 1.4, 0.75, z),
      colocar(new THREE.CylinderGeometry(0.03, 0.03, 0.72, 8), X_PARED - 1.4, 0.37, z),
      colocar(new THREE.CylinderGeometry(0.2, 0.22, 0.03, 16), X_PARED - 1.4, 0.015, z),
    );
  }
  const taburetes = new THREE.Mesh(fusionar(piezasTaburetes), matTaburete);
  raiz.add(taburetes);
  const sombrasTaburetes = [-1.5, -0.6, 0.3].map((z) => {
    const s = ctx.crearSombra({ radio: 0.3, opacidad: 0.4 });
    s.position.set(X_PARED - 1.4, 0.004, z);
    return s;
  });
  raiz.add(...sombrasTaburetes);

  // Cuadro de la pared izquierda: una diana antigua pintada
  const texCuadro = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#e8d9b5';
    g.fillRect(0, 0, tam, tam);
    for (let i = 6; i > 0; i--) {
      g.fillStyle = i % 2 ? '#8e2430' : '#e8d9b5';
      g.beginPath();
      g.arc(tam / 2, tam / 2, (tam * 0.42 * i) / 6, 0, Math.PI * 2);
      g.fill();
    }
    g.strokeStyle = '#5a3a1e';
    g.lineWidth = tam * 0.06;
    g.strokeRect(0, 0, tam, tam);
  }, { tam: 128, semilla: 2 }));
  const cuadro = new THREE.Mesh(R(new THREE.PlaneGeometry(0.6, 0.6)), R(new THREE.MeshLambertMaterial({ map: texCuadro })));
  cuadro.position.set(-X_PARED + 0.02, 1.7, -0.8);
  cuadro.rotation.y = Math.PI / 2;
  raiz.add(cuadro);

  // Línea de tiro (oche): una regleta metálica en el suelo
  const oche = new THREE.Mesh(R(new THREE.BoxGeometry(0.62, 0.012, 0.04)), R(new THREE.MeshLambertMaterial({ color: 0xc9a227, emissive: 0x2a1e00 })));
  oche.position.set(0, 0.006, 0.02);
  raiz.add(oche);
  // Alfombra de goma de la zona de tiro
  const alfombra = new THREE.Mesh(
    R(new THREE.PlaneGeometry(0.9, 2.6)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.grano(0x1f2a24, { repetir: [2, 4], semilla: 13, contraste: 0.12 })) })),
  );
  alfombra.rotation.x = -Math.PI / 2;
  alfombra.position.set(0, 0.003, -1.15);
  raiz.add(alfombra);

  // ─── Diana ─────────────────────────────────────────────────────────────
  // Cara: sectores negros y crema, dobles y triples rojos y verdes, alambres y números
  const texDiana = R(ctx.texturaCanvas((g, tam) => {
    const c = tam / 2;
    const s = c / R_DIANA; // píxeles por metro
    const sector = (Math.PI * 2) / 20;
    g.fillStyle = '#141414';
    g.beginPath();
    g.arc(c, c, c, 0, Math.PI * 2);
    g.fill();
    // Anillo: radio interior, exterior y los dos colores (sector par, impar)
    const anillos = [
      [R_BULL, R_TRIPLE_IN, '#16130f', '#efe2bf'],
      [R_TRIPLE_IN, R_TRIPLE_OUT, '#c8262f', '#1f8a3e'],
      [R_TRIPLE_OUT, R_DOBLE_IN, '#16130f', '#efe2bf'],
      [R_DOBLE_IN, R_DOBLE_OUT, '#c8262f', '#1f8a3e'],
    ];
    for (let i = 0; i < 20; i++) {
      // En el canvas el ángulo 0 es a la derecha y crece en el sentido del reloj; el 20 está arriba
      const a0 = i * sector - Math.PI / 2 - sector / 2;
      const a1 = a0 + sector;
      for (const [rIn, rOut, par, impar] of anillos) {
        g.fillStyle = i % 2 ? impar : par;
        g.beginPath();
        g.arc(c, c, rOut * s, a0, a1);
        g.arc(c, c, rIn * s, a1, a0, true);
        g.closePath();
        g.fill();
      }
    }
    g.fillStyle = '#1f8a3e';
    g.beginPath();
    g.arc(c, c, R_BULL * s, 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#c8262f';
    g.beginPath();
    g.arc(c, c, R_DOBLE_BULL * s, 0, Math.PI * 2);
    g.fill();
    // Alambres
    g.strokeStyle = 'rgba(220,225,230,0.85)';
    g.lineWidth = Math.max(1, tam / 400);
    for (const r of [R_BULL, R_TRIPLE_IN, R_TRIPLE_OUT, R_DOBLE_IN, R_DOBLE_OUT]) {
      g.beginPath();
      g.arc(c, c, r * s, 0, Math.PI * 2);
      g.stroke();
    }
    for (let i = 0; i < 20; i++) {
      const a = i * sector - Math.PI / 2 - sector / 2;
      g.beginPath();
      g.moveTo(c + Math.cos(a) * R_BULL * s, c + Math.sin(a) * R_BULL * s);
      g.lineTo(c + Math.cos(a) * R_DOBLE_OUT * s, c + Math.sin(a) * R_DOBLE_OUT * s);
      g.stroke();
    }
    // Números del anillo exterior (cifras: iguales en todos los idiomas)
    g.fillStyle = '#f4f1e8';
    g.font = `700 ${Math.round(0.03 * s)}px Geist, Arial, sans-serif`;
    g.textAlign = 'center';
    g.textBaseline = 'middle';
    for (let i = 0; i < 20; i++) {
      const a = i * sector - Math.PI / 2;
      const r = ((R_DOBLE_OUT + R_DIANA) / 2) * s;
      g.fillText(String(SECTORES[i]), c + Math.cos(a) * r, c + Math.sin(a) * r);
    }
  }, { tam: 512, semilla: 1 }));
  texDiana.wrapS = texDiana.wrapT = THREE.ClampToEdgeWrapping;
  const cara = new THREE.Mesh(R(new THREE.CircleGeometry(R_DIANA, 64)), R(new THREE.MeshLambertMaterial({ map: texDiana })));
  cara.position.copy(DIANA);
  // Canto de la diana (sisal prensado) y aro negro de protección alrededor
  const canto = new THREE.Mesh(
    fusionar([
      colocar(new THREE.CylinderGeometry(R_DIANA, R_DIANA, 0.04, 64, 1, true), DIANA.x, DIANA.y, DIANA.z - 0.02, Math.PI / 2),
      colocar(new THREE.RingGeometry(R_DIANA, 0.33, 64), DIANA.x, DIANA.y, DIANA.z - 0.035),
    ]),
    R(new THREE.MeshLambertMaterial({ color: 0x1a1a1a, side: THREE.DoubleSide })),
  );
  raiz.add(cara, canto);
  // Armario de madera con las puertas abiertas
  const matArmario = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.madera(0x5a321b, { repetir: [1, 1], semilla: 15 })) }));
  const piezasArmario = [
    colocar(new THREE.BoxGeometry(0.76, 0.76, 0.04), DIANA.x, DIANA.y, Z_PARED + 0.02),
    colocar(new THREE.BoxGeometry(0.76, 0.04, 0.14), DIANA.x, DIANA.y + 0.38, Z_PARED + 0.07),
    colocar(new THREE.BoxGeometry(0.76, 0.04, 0.14), DIANA.x, DIANA.y - 0.38, Z_PARED + 0.07),
    colocar(new THREE.BoxGeometry(0.04, 0.8, 0.14), DIANA.x - 0.38, DIANA.y, Z_PARED + 0.07),
    colocar(new THREE.BoxGeometry(0.04, 0.8, 0.14), DIANA.x + 0.38, DIANA.y, Z_PARED + 0.07),
  ];
  // Puertas abiertas casi contra la pared, con su bisagra en el borde del armario
  for (const lado of [-1, 1]) {
    const puerta = new THREE.BoxGeometry(0.38, 0.78, 0.025);
    puerta.translate(lado * 0.19, 0, 0);
    piezasArmario.push(colocar(puerta, DIANA.x + lado * 0.39, DIANA.y, Z_PARED + 0.14, 0, lado * -0.4, 0));
  }
  const armario = new THREE.Mesh(fusionar(piezasArmario), matArmario);
  raiz.add(armario);
  // Lámpara sobre la diana: brazo, pantalla metálica y bombilla que brilla
  const lampara = new THREE.Mesh(
    fusionar([
      colocar(new THREE.CylinderGeometry(0.012, 0.012, 0.36, 8), DIANA.x, DIANA.y + 0.66, Z_PARED + 0.18, Math.PI / 2),
      colocar(new THREE.CylinderGeometry(0.05, 0.16, 0.14, 20, 1, true), DIANA.x, DIANA.y + 0.62, Z_PARED + 0.36),
    ]),
    R(new THREE.MeshLambertMaterial({ color: 0x1f4a33, side: THREE.DoubleSide })),
  );
  const bombilla = new THREE.Mesh(R(new THREE.SphereGeometry(0.045, 12, 8)), R(new THREE.MeshBasicMaterial({ color: 0xffe7b0, toneMapped: false })));
  bombilla.position.set(DIANA.x, DIANA.y + 0.57, Z_PARED + 0.36);
  raiz.add(lampara, bombilla);
  // Halo de luz de la lámpara sobre la pared (una mancha clara, sin luces nuevas)
  const halo = new THREE.Mesh(
    R(new THREE.CircleGeometry(0.7, 32)),
    R(new THREE.MeshBasicMaterial({ map: R(ctx.texturaCanvas((g, tam) => {
      const d = g.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
      d.addColorStop(0, 'rgba(255,214,150,0.32)');
      d.addColorStop(1, 'rgba(255,214,150,0)');
      g.fillStyle = d;
      g.fillRect(0, 0, tam, tam);
    }, { tam: 128 })), transparent: true, depthWrite: false, toneMapped: false })),
  );
  halo.position.set(DIANA.x, DIANA.y + 0.1, Z_PARED + 0.005);
  raiz.add(halo);

  // ─── Pizarra (marcador) debajo de la diana: se ve también en el móvil en vertical ───
  const marcador = ctx.crearPanel({ ancho: 1.0, alto: 0.34 });
  marcador.mesh.position.set(0, 1.12, Z_PARED + 0.03);
  raiz.add(marcador.mesh);
  const marco = new THREE.Mesh(R(new THREE.BoxGeometry(1.06, 0.4, 0.02)), matArmario);
  marco.position.set(0, 1.12, Z_PARED + 0.012);
  raiz.add(marco);

  // ─── Dardos ────────────────────────────────────────────────────────────
  // El origen es la punta y el dardo se alarga hacia +Z: clavarlo es poner la punta en el impacto.
  // Punta de acero, cuerpo de tungsteno moleteado, varilla y aletas de color.
  function geoDardo(colorAletas) {
    const cuerpo = new THREE.LatheGeometry([
      new THREE.Vector2(0.0015, 0), new THREE.Vector2(0.0034, 0.004), new THREE.Vector2(0.0038, 0.012),
      new THREE.Vector2(0.0034, 0.016), new THREE.Vector2(0.0038, 0.02), new THREE.Vector2(0.0034, 0.024),
      new THREE.Vector2(0.0038, 0.028), new THREE.Vector2(0.0036, 0.042), new THREE.Vector2(0.0022, 0.05),
    ], 12);
    cuerpo.rotateX(Math.PI / 2).translate(0, 0, 0.028);
    const aleta = new THREE.ShapeGeometry(new THREE.Shape([
      new THREE.Vector2(0, 0), new THREE.Vector2(0.016, 0.012), new THREE.Vector2(0.017, 0.04),
      new THREE.Vector2(0, 0.046), new THREE.Vector2(-0.017, 0.04), new THREE.Vector2(-0.016, 0.012),
    ]));
    aleta.rotateX(Math.PI / 2).translate(0, 0, 0.098);
    const aleta2 = aleta.clone().rotateZ(Math.PI / 2);
    return fusionar([
      pintar(colocar(new THREE.ConeGeometry(0.0016, 0.03, 8), 0, 0, 0.015, -Math.PI / 2), 0xe6e9ec),
      pintar(cuerpo, 0x6f7479),
      pintar(colocar(new THREE.CylinderGeometry(0.0018, 0.0018, 0.03, 8), 0, 0, 0.093, Math.PI / 2), 0x1b1b1b),
      pintar(aleta, colorAletas),
      pintar(aleta2, colorAletas),
    ]);
  }
  const geoDardoJugador = geoDardo(0xff6a3d);
  const matDardo = R(new THREE.MeshStandardMaterial({ vertexColors: true, metalness: 0.6, roughness: 0.35, side: THREE.DoubleSide }));
  function crearDardo() {
    const malla = new THREE.Mesh(geoDardoJugador, matDardo);
    malla.visible = false;
    raiz.add(malla);
    return malla;
  }
  // Los 3 dardos de la ronda: vuelan, se clavan y se recogen al terminarla
  const dardos = Array.from({ length: DARDOS_RONDA }, () => ({
    malla: crearDardo(), vel: new THREE.Vector3(), estado: 'libre', vida: 0, sombra: null,
  }));
  for (const d of dardos) {
    d.sombra = ctx.crearSombra({ radio: 0.03, opacidad: 0.35 });
    d.sombra.visible = false;
    raiz.add(d.sombra);
  }

  // Un dardo en cada mano (VR)
  const manos = ctx.manos.map((mano) => {
    const malla = new THREE.Mesh(geoDardoJugador, matDardo);
    malla.visible = false;
    raiz.add(malla);
    return {
      mano, malla, agarrado: false, recarga: 0,
      historial: Array.from({ length: 12 }, () => ({ pos: new THREE.Vector3(), dt: 0 })), n: 0, i: 0,
    };
  });

  // Dardo preparado y mira (ratón y móvil)
  const dardoRaton = new THREE.Mesh(geoDardoJugador, matDardo);
  dardoRaton.position.copy(MANO_RATON);
  raiz.add(dardoRaton);
  const mira = new THREE.Mesh(
    R(new THREE.RingGeometry(0.008, 0.013, 24)),
    R(new THREE.MeshBasicMaterial({ color: 0xff6a3d, toneMapped: false, depthTest: false, transparent: true, opacity: 0.9 })),
  );
  mira.renderOrder = 2;
  raiz.add(mira);
  const planoDiana = new THREE.Plane(new THREE.Vector3(0, 0, 1), -DIANA.z);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'jugando' | 'recoger' | 'fin'
  let reloj = 3;
  let ronda = 1;
  let quedan = DARDOS_RONDA;   // dardos sin lanzar en la ronda
  let puntos = 0;
  let puntosRonda = 0;
  let record = ctx.leer('record', 0);
  let recargaRaton = 0;
  let aviso = '';
  let avisoTiempo = 0;
  let siguiente = 0;           // índice del próximo dardo de la ronda

  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const objetivo = new THREE.Vector3();
  const quatTmp = new THREE.Quaternion();

  function avisar(texto) {
    aviso = texto;
    avisoTiempo = 1.6;
  }

  function actualizarMarcador() {
    if (estado === 'intro') {
      const intro = ctx.enVR() ? ctx.t('intro') : ctx.t(ctx.tactil ? 'introTactil' : 'introRaton');
      marcador.escribir([
        { texto: ctx.t('titulo'), tam: 1.3, color: '#ffcc80' },
        { texto: intro, tam: 0.7 },
      ]);
    } else if (estado === 'fin') {
      marcador.escribir([
        { texto: ctx.t('partida.finPuntos', { n: puntos }), tam: 1.3, color: '#ffcc80' },
        { texto: ctx.t('partida.recordNuevaPartida', { record, n: Math.max(1, Math.ceil(reloj)) }), tam: 0.7 },
      ]);
    } else {
      const bolas = '●'.repeat(quedan) + '○'.repeat(DARDOS_RONDA - quedan);
      marcador.escribir([
        { texto: ctx.t('marcador', { puntos, ronda, total: RONDAS }), tam: 1.2 },
        avisoTiempo > 0
          ? { texto: aviso, tam: 0.8, color: '#ffcc80' }
          : { texto: ctx.t('ronda', { n: puntosRonda, dardos: bolas, record }), tam: 0.7, color: '#ffe0b2' },
      ]);
    }
  }

  // Puntos de un impacto en la cara de la diana (x, y relativos al centro)
  const resultado = { valor: 0, tipo: 'fuera', numero: 0 };
  function puntuar(x, y) {
    const r = Math.hypot(x, y);
    resultado.numero = 0;
    if (r <= R_DOBLE_BULL) return Object.assign(resultado, { valor: 50, tipo: 'diana' });
    if (r <= R_BULL) return Object.assign(resultado, { valor: 25, tipo: 'bull' });
    if (r > R_DOBLE_OUT) return Object.assign(resultado, { valor: 0, tipo: 'fuera' });
    // Ángulo desde arriba en el sentido del reloj
    let a = Math.atan2(x, y);
    if (a < 0) a += Math.PI * 2;
    const numero = SECTORES[Math.round(a / ((Math.PI * 2) / 20)) % 20];
    resultado.numero = numero;
    if (r >= R_DOBLE_IN) return Object.assign(resultado, { valor: numero * 2, tipo: 'doble' });
    if (r >= R_TRIPLE_IN && r <= R_TRIPLE_OUT) return Object.assign(resultado, { valor: numero * 3, tipo: 'triple' });
    return Object.assign(resultado, { valor: numero, tipo: 'simple' });
  }

  // ─── Vuelo ─────────────────────────────────────────────────────────────
  function lanzar(vel, desde, giro) {
    if (quedan <= 0) return;
    const d = dardos[siguiente % DARDOS_RONDA];
    siguiente += 1;
    quedan -= 1;
    d.estado = 'vuela';
    d.vida = 3;
    d.vel.copy(vel);
    d.malla.position.copy(desde);
    d.malla.quaternion.copy(giro);
    d.malla.visible = true;
    d.sombra.visible = true;
    ctx.sonido('zas');
  }

  function aterrizar(d, valor, pos, mano) {
    d.estado = 'clavado';
    puntos += valor;
    puntosRonda += valor;
    if (valor === 0) {
      ctx.sonido('fallo');
      ctx.vibrar(mano, 0.2, 40);
    }
    if (pos && valor > 0) {
      tmp2.copy(pos);
      tmp2.y += 0.05;
      tmp2.z += 0.05;
      const { tipo, numero } = resultado;
      const nivel = tipo === 'diana' ? 'grande' : tipo === 'triple' || tipo === 'doble' || tipo === 'bull' ? 'medio' : 'pequeño';
      ctx.efectos.impacto(nivel, { pos: tmp2, mano, color: tipo === 'diana' ? 0xffd54f : 0xff6a3d, sonido: 'dardo' });
      ctx.efectos.texto(tmp2, `+${valor}`, { color: nivel === 'pequeño' ? '#ffffff' : '#ffd54f', tam: nivel === 'grande' ? 1.4 : nivel === 'medio' ? 1.15 : 1 });
      if (tipo === 'diana') avisar(ctx.t('diana'));
      else if (tipo === 'bull') avisar(ctx.t('bull'));
      else if (tipo === 'triple') avisar(ctx.t('triple', { n: numero }));
      else if (tipo === 'doble') avisar(ctx.t('doble', { n: numero }));
    } else if (valor === 0) {
      avisar(ctx.t('fuera'));
    }
    // Los tres dardos al triple 20: ¡180!
    if (quedan === 0 && puntosRonda === 180) {
      ctx.sonido('ovacion');
      ctx.efectos.impacto('grande', { pos: DIANA, color: 0xffd54f });
      avisar(ctx.t('maximo'));
    }
  }

  function vueloDardo(d, dt, mano) {
    const pos = d.malla.position;
    const pasos = Math.max(1, Math.ceil((d.vel.length() * dt) / 0.03));
    const h = dt / pasos;
    for (let i = 0; i < pasos; i++) {
      const zAntes = pos.z;
      d.vel.y -= G * h;
      pos.addScaledVector(d.vel, h);
      dir.copy(d.vel).normalize();
      d.malla.quaternion.setFromUnitVectors(MENOS_Z, dir);
      // Cruza la cara de la diana
      if (zAntes > DIANA.z && pos.z <= DIANA.z) {
        const f = (zAntes - DIANA.z) / Math.max(1e-6, zAntes - pos.z);
        tmp.copy(pos).addScaledVector(d.vel, -h * (1 - f)); // punto exacto del cruce
        const x = tmp.x - DIANA.x;
        const y = tmp.y - DIANA.y;
        if (Math.hypot(x, y) < R_DIANA) {
          pos.copy(tmp).addScaledVector(dir, 0.012); // la punta queda hundida en el sisal
          puntuar(x, y);
          aterrizar(d, resultado.valor, tmp, mano);
          return;
        }
      }
      // Pared, armario, suelo o techo: se queda clavado y no puntúa
      if (pos.z <= Z_PARED + 0.04 || Math.abs(pos.x) >= X_PARED - 0.02 || pos.y >= TECHO - 0.02 || pos.y <= 0.01) {
        pos.z = Math.max(pos.z, Z_PARED + 0.04);
        pos.y = Math.max(pos.y, 0.01);
        resultado.tipo = 'fuera';
        ctx.sonido('dardo');
        aterrizar(d, 0, null, mano);
        return;
      }
    }
    d.vida -= dt;
    if (d.vida <= 0) aterrizar(d, 0, null, mano);
  }

  // Velocidad para pasar por "destino" desde "origen" en t segundos
  function velocidadHacia(origen, destino, t, salida) {
    return salida.subVectors(destino, origen).divideScalar(t).setY((destino.y - origen.y) / t + 0.5 * G * t);
  }

  // Un buen lanzamiento VR conserva su dirección, pero se le quita parte de la caída:
  // apunta adonde iría en línea recta y mezcla la velocidad con la que llegaría allí.
  function ayudar(origen, vel) {
    const rapidez = vel.length();
    if (rapidez < 2 || vel.z > -0.5) return vel;
    const t = (DIANA.z - origen.z) / vel.z;
    objetivo.copy(origen).addScaledVector(vel, t);
    if (Math.hypot(objetivo.x - DIANA.x, objetivo.y - DIANA.y) > 0.6) return vel;
    velocidadHacia(origen, objetivo, t, tmp2);
    return vel.lerp(tmp2, AYUDA);
  }

  // ─── Manos VR ──────────────────────────────────────────────────────────
  // Velocidad media de la mano en los últimos ~70 ms
  function velocidadMano(m, salida) {
    let tiempo = 0;
    let k = 0;
    const ultimo = m.historial[(m.i - 1 + 12) % 12];
    let viejo = ultimo;
    while (k < m.n - 1 && tiempo < 0.07) {
      const e = m.historial[(m.i - 1 - k + 24) % 12];
      tiempo += e.dt;
      k += 1;
      viejo = m.historial[(m.i - 1 - k + 24) % 12];
    }
    if (tiempo <= 0) return salida.set(0, 0, 0);
    return salida.subVectors(ultimo.pos, viejo.pos).divideScalar(tiempo);
  }

  function manosVR(dt) {
    const puede = estado === 'jugando' && quedan > 0;
    for (const m of manos) {
      const mano = m.mano;
      m.recarga -= dt;
      if (!mano.activa) {
        m.malla.visible = false;
        m.agarrado = false;
        m.n = 0;
        continue;
      }
      const e = m.historial[m.i];
      e.pos.copy(mano.posicion);
      e.dt = dt;
      m.i = (m.i + 1) % 12;
      m.n = Math.min(12, m.n + 1);

      const visible = puede && m.recarga <= 0;
      m.malla.visible = visible;
      if (!visible) {
        m.agarrado = false;
        continue;
      }
      // El dardo sale por delante de los dedos, con la punta al frente (ver Pincha Globos)
      mano.grip.localToWorld(m.malla.position.set(0, -0.1, -0.03));
      mano.grip.getWorldQuaternion(quatTmp);
      m.malla.quaternion.copy(quatTmp).multiply(GIRO_DARDO);
      const aprieta = mano.gatillo || mano.apreton;
      if (aprieta && !m.agarrado) {
        m.agarrado = true;
        ctx.vibrar(mano, 0.25, 25);
      } else if (!aprieta && m.agarrado) {
        m.agarrado = false;
        velocidadMano(m, tmp);
        if (tmp.length() >= VEL_MINIMA) {
          tmp.multiplyScalar(FUERZA_VR);
          lanzar(ayudar(m.malla.position, tmp), m.malla.position, m.malla.quaternion);
          m.recarga = RECARGA_MANO;
          m.malla.visible = false;
          for (const otra of manos) otra.recarga = Math.max(otra.recarga, 0.15);
        }
      }
    }
  }

  // ─── Ratón y pantalla táctil ───────────────────────────────────────────
  function raton(dt, t) {
    const r = ctx.raton;
    recargaRaton -= dt;
    const puede = estado === 'jugando' && quedan > 0;
    dardoRaton.visible = puede;
    dardoRaton.scale.setScalar(recargaRaton > 0 ? 1e-4 : Math.min(1, -recargaRaton * 6));
    // La mira sigue al ratón y tiembla como el pulso
    const apunta = r.rayo.ray.intersectPlane(planoDiana, objetivo);
    if (apunta) {
      objetivo.x += (Math.sin(t * 1.7) * 0.6 + Math.sin(t * 3.1 + 1.3) * 0.4) * PULSO;
      objetivo.y += (Math.sin(t * 2.3 + 0.7) * 0.6 + Math.sin(t * 3.7 + 2.1) * 0.4) * PULSO;
      objetivo.z = DIANA.z + 0.002;
    }
    mira.visible = puede && !!apunta && (r.dentro || ctx.tactil);
    if (!apunta) return;
    mira.position.copy(objetivo);
    dir.subVectors(objetivo, MANO_RATON).normalize();
    dardoRaton.quaternion.setFromUnitVectors(MENOS_Z, dir);
    if (r.clic && puede && recargaRaton <= 0) {
      objetivo.z = DIANA.z;
      lanzar(velocidadHacia(MANO_RATON, objetivo, T_VUELO_RATON, tmp2), MANO_RATON, dardoRaton.quaternion);
      recargaRaton = RECARGA_RATON;
    }
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function empezarRonda() {
    estado = 'jugando';
    quedan = DARDOS_RONDA;
    puntosRonda = 0;
    siguiente = 0;
    for (const d of dardos) {
      d.estado = 'libre';
      d.malla.visible = false;
      d.sombra.visible = false;
    }
  }

  function actualizar(dt, t) {
    reloj -= dt;
    avisoTiempo -= dt;
    if (estado === 'intro' && reloj <= 0) {
      puntos = 0;
      ronda = 1;
      empezarRonda();
    } else if (estado === 'jugando' && quedan === 0 && dardos.every((d) => d.estado !== 'vuela')) {
      estado = 'recoger';
      reloj = 1.4;
    } else if (estado === 'recoger' && reloj <= 0) {
      if (ronda < RONDAS) {
        ronda += 1;
        ctx.sonido('tic');
        empezarRonda();
      } else {
        estado = 'fin';
        reloj = 6;
        ctx.puntuacion(puntos); // a la clasificación (juegos/marcadores.js)
        if (puntos > record) {
          record = puntos;
          ctx.guardar('record', record);
        }
        ctx.sonido('fin');
        for (const d of dardos) {
          d.malla.visible = false;
          d.sombra.visible = false;
        }
      }
    } else if (estado === 'fin' && reloj <= 0) {
      puntos = 0;
      ronda = 1;
      empezarRonda();
    }

    const manoActiva = manos.find((m) => m.mano.activa)?.mano || null;
    for (const d of dardos) {
      if (d.estado === 'vuela') vueloDardo(d, dt, manoActiva);
      if (d.malla.visible) {
        d.sombra.position.set(d.malla.position.x, 0.004, d.malla.position.z);
        d.sombra.visible = d.estado === 'vuela';
      }
    }

    if (ctx.enVR()) {
      dardoRaton.visible = false;
      mira.visible = false;
      manosVR(dt);
    } else {
      for (const m of manos) m.malla.visible = false;
      raton(dt, t);
    }
    actualizarMarcador();
  }

  actualizarMarcador();

  return {
    actualizar,
    liberar() {},
  };
}
