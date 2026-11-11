// MALABARES
// En la pista de un circo al atardecer, con bolas de colores. Se empieza con 2 y, cada 12 recepciones
// seguidas, el cañón del circo lanza otra (hasta 5). Si una bola toca el suelo se rompe la cadena;
// a las 3 caídas se acaba la partida. Cuanto más juegas, más difícil: menos ayuda, más peso y más ritmo.
// Lo que cuenta para la clasificación es la cadena de recepciones seguidas más larga.
//
// En VR: cierra la mano (gatillo o botón lateral) cuando la bola esté cerca para cogerla y ábrela para
// lanzarla; la velocidad de la mano al soltar da la trayectoria. La gravedad es algo menor que la real y
// hay una pequeña ayuda que corrige el lanzamiento hacia la mano más cercana a donde iba a caer (solo si
// ya iba bien encaminado). Una bola por mano. La bola nueva del cañón se queda flotando delante unos
// segundos para cogerla cuando haya una mano libre; si no se coge a tiempo, cae.
// Con ratón o en el móvil: las manos se mueven solas a ritmo fijo (una cascada) y hay que hacer clic o
// tocar la pantalla justo cuando la bola llega a la mano. El aro que se cierra marca el momento.
import * as THREE from 'three';

// Todo se genera con código: no hay nada que descargar.
export async function precargar() {}

const MAX_BOLAS = 5;
const BOLAS_INICIALES = 2;
const CADA = 12;                  // recepciones seguidas para que llegue otra bola
const VIDAS = 3;
const RADIO = 0.038;              // bolas de malabares de unos 7,5 cm
const DIFICULTAD_MAX = 240;       // segundos de juego hasta la dificultad máxima
const VUELO_MINIMO = 0.3;         // segundos en el aire para que cuente como recepción (VR)
const VENTANA_CIERRE = 0.22;      // segundos tras cerrar la mano en los que aún puede coger una bola (VR)
const RASTRO = 10;                // puntos de la estela de cada bola
const HISTORIAL = 8;              // posiciones de la mano para medir su velocidad al soltar
const COLORES = [0xe53935, 0xfdd835, 0x1e88e5, 0x43a047, 0x8e24aa];
const ESLABONES = 24;             // eslabones de la cadena que se ven sobre la pista
const FLOTA = 4;                  // segundos que espera flotando la bola nueva en VR antes de caer

// Manos automáticas (ratón y móvil): izquierda (0) y derecha (1)
const MANO_Y = 1.0;
const MANO_Z = -0.36;
const MANO_DENTRO = 0.11;         // desde donde se lanza
const MANO_FUERA = 0.34;          // donde se recibe (cascada: se lanza por dentro y se recibe por fuera)

const azar = (a, b) => a + Math.random() * (b - a);
const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
const suave = (x) => x * x * (3 - 2 * x);

// Junta varias geometrías en una (menos llamadas de dibujo). Con «colores», añade un color por pieza.
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

// Cápsula de a a b (para los dedos de los guantes)
function capsulaEntre(a, b, radio) {
  const dir = new THREE.Vector3().subVectors(b, a);
  const largo = dir.length();
  const g = new THREE.CapsuleGeometry(radio, Math.max(0.001, largo), 3, 8);
  g.applyQuaternion(new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, 1, 0), dir.normalize()));
  g.translate((a.x + b.x) / 2, (a.y + b.y) / 2, (a.z + b.z) / 2);
  return g;
}

// Guante de payaso: la palma mira hacia +Y, los dedos hacia -Z y el puño hacia +Z.
// lado: 1 la derecha (pulgar hacia +X), -1 la izquierda. Cerrado, los dedos se curvan sobre la bola.
function geometriaGuante(lado, cerrado) {
  const v = (x, y, z) => new THREE.Vector3(x, y, z);
  const piezas = [];
  const colores = [];
  const blanco = 0xf7f5ef;
  piezas.push(new THREE.SphereGeometry(1, 14, 10).scale(0.044, 0.02, 0.05));
  colores.push(blanco);
  piezas.push(new THREE.CylinderGeometry(0.04, 0.047, 0.045, 14).rotateX(Math.PI / 2).translate(0, 0, 0.068));
  colores.push(0xe53935);
  piezas.push(new THREE.TorusGeometry(0.044, 0.006, 6, 16).translate(0, 0, 0.05));
  colores.push(0xffc928);
  const dedos = [[0.03, 0.042], [0.01, 0.047], [-0.01, 0.043], [-0.03, 0.035]];
  for (const [x, largo] of dedos) {
    const base = v(x * lado, 0.003, -0.04);
    if (cerrado) {
      const medio = v(x * lado, 0.024, -0.064);
      piezas.push(capsulaEntre(base, medio, 0.0095), capsulaEntre(medio, v(x * lado, 0.052 + largo * 0.15, -0.05), 0.009));
      colores.push(blanco, blanco);
    } else {
      piezas.push(capsulaEntre(base, v(x * lado * 1.15, 0.014, -0.04 - largo), 0.0095));
      colores.push(blanco);
    }
  }
  const basePulgar = v(0.036 * lado, 0, 0.004);
  if (cerrado) {
    const medio = v(0.052 * lado, 0.024, -0.018);
    piezas.push(capsulaEntre(basePulgar, medio, 0.0105), capsulaEntre(medio, v(0.034 * lado, 0.05, -0.034), 0.0095));
    colores.push(blanco, blanco);
  } else {
    piezas.push(capsulaEntre(basePulgar, v(0.078 * lado, 0.012, -0.028), 0.0105));
    colores.push(blanco);
  }
  return fusionar(piezas, colores);
}

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  // ─── Decorado: pista de circo al aire libre, al atardecer ──────────────
  ctx.fondo(0x6b4f86, { nubes: 0.3, estrellas: 0.25, sol: [-0.55, 0.1, -0.83], niebla: [18, 55], paisaje: { tipo: 'colinas', color: 0x3a3558 } });
  // Cerca de las manos; con la pantalla en vertical (móvil), más cerca todavía
  const VISTAS = {
    horizontal: [new THREE.Vector3(0, 1.32, 0.55), new THREE.Vector3(0, 1.32, -0.6)],
    vertical: [new THREE.Vector3(0, 1.3, 0.45), new THREE.Vector3(0, 1.26, -0.6)],
  };
  let vistaVertical = null;
  function colocarVista() {
    const vertical = ctx.camara.aspect < 1;
    if (vertical === vistaVertical) return;
    vistaVertical = vertical;
    ctx.vistaEscritorio(...VISTAS[vertical ? 'vertical' : 'horizontal']);
  }
  colocarVista();
  ctx.sueloBase(false);

  const suelo = new THREE.Mesh(
    R(new THREE.PlaneGeometry(44, 44).rotateX(-Math.PI / 2)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.cesped(0x4f7d3a, { tam: 512, repetir: [20, 20], semilla: 141 })) })),
  );
  raiz.add(suelo);
  // Serrín de la pista
  const serrin = new THREE.Mesh(
    R(new THREE.CircleGeometry(2.5, 48).rotateX(-Math.PI / 2).translate(0, 0.006, 0)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.grano(0xd8b07a, { tam: 256, repetir: [5, 5], semilla: 142 })) })),
  );
  raiz.add(serrin);

  // Lona a rayas rojas y blancas con un ribete dorado (para el bordillo, los tambores y las carpas)
  const texLona = R(ctx.texturaCanvas((g, tam, azarTex) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#f3ead8' : '#c62828';
      g.fillRect((i / 8) * tam, 0, tam / 8 + 1, tam);
    }
    g.fillStyle = '#e0a82e';
    g.fillRect(0, 0, tam, tam * 0.07);
    g.fillRect(0, tam * 0.93, tam, tam * 0.07);
    for (let i = 0; i < 500; i++) {
      g.fillStyle = `rgba(60,20,10,${azarTex() * 0.08})`;
      g.fillRect(azarTex() * tam, azarTex() * tam, 1 + azarTex() * 6, 1);
    }
  }, { tam: 256, semilla: 143 }));
  texLona.wrapS = THREE.RepeatWrapping;
  const matLona = R(new THREE.MeshLambertMaterial({ map: texLona, side: THREE.DoubleSide }));

  // Bordillo de la pista y dos tambores de circo (una sola malla)
  const perfilBordillo = [[2.5, 0], [2.5, 0.3], [2.54, 0.34], [2.68, 0.34], [2.72, 0.3], [2.72, 0]].map(([x, y]) => new THREE.Vector2(x, y));
  const bordillo = new THREE.LatheGeometry(perfilBordillo, 64);
  const uvB = bordillo.attributes.uv;
  for (let i = 0; i < uvB.count; i++) uvB.setX(i, uvB.getX(i) * 12);
  const tambores = [];
  for (const [x, z, alto] of [[-1.85, -1.35, 0.55], [1.9, -1.2, 0.45], [-2.05, 0.9, 0.38]]) {
    const tambor = new THREE.CylinderGeometry(0.3, 0.3, alto, 24);
    const uvT = tambor.attributes.uv;
    for (let i = 0; i < uvT.count; i++) uvT.setX(i, uvT.getX(i) * 3);
    tambores.push(tambor.translate(x, alto / 2, z));
  }
  raiz.add(new THREE.Mesh(R(fusionar([bordillo, ...tambores])), matLona));

  // Carpas al fondo: la grande detrás de la pista y dos pequeñas a los lados (una sola malla)
  const perfilCarpa = [[0.001, 7.4], [0.6, 6.9], [2.6, 4.6], [5, 3.2], [5, 0]].map(([x, y]) => new THREE.Vector2(x, y));
  const carpa = () => {
    const g = new THREE.LatheGeometry(perfilCarpa, 40);
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * 14);
    return g;
  };
  raiz.add(new THREE.Mesh(R(fusionar([
    carpa().translate(0, 0, -13),
    carpa().scale(0.55, 0.6, 0.55).translate(-10.5, 0, -8),
    carpa().scale(0.5, 0.55, 0.5).translate(10, 0, -9.5),
  ])), matLona));
  // Entrada de la carpa grande y banderines en lo alto de cada carpa (una malla con colores)
  const entrada = new THREE.Shape([new THREE.Vector2(-1.3, 0), new THREE.Vector2(1.3, 0), new THREE.Vector2(0, 2.6)]);
  const banderas = [];
  const coloresBanderas = [];
  banderas.push(new THREE.ShapeGeometry(entrada).translate(0, 0, -7.97));
  coloresBanderas.push(0x6a2c30);
  for (const [x, y, z] of [[0, 7.4, -13], [-10.5, 4.44, -8], [10, 4.07, -9.5]]) {
    banderas.push(new THREE.CylinderGeometry(0.03, 0.03, 1.1, 5).translate(x, y + 0.55, z));
    coloresBanderas.push(0x6d4c41);
    const bandera = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0.7, -0.2, 0), new THREE.Vector3(0, -0.4, 0)]);
    bandera.setAttribute('uv', new THREE.Float32BufferAttribute([0, 0, 1, 0, 0, 1], 2));
    bandera.computeVertexNormals();
    banderas.push(bandera.translate(x, y + 1.08, z));
    coloresBanderas.push(0xffc928);
  }
  raiz.add(new THREE.Mesh(R(fusionar(banderas, coloresBanderas)), R(new THREE.MeshLambertMaterial({ vertexColors: true, side: THREE.DoubleSide }))));

  // Guirnaldas de bombillas sobre la pista, entre seis postes (postes, cables y bombillas: 3 mallas)
  const postes = [];
  const puntosCable = [];
  const bombillas = [];
  const coloresBombillas = [];
  const tonos = [0xffe7a3, 0xffb74d, 0xff8a80, 0xfff3c4, 0x9ad1ff];
  const esquinas = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2 + Math.PI / 6;
    esquinas.push(new THREE.Vector3(Math.sin(a) * 3.5, 3.0, -Math.cos(a) * 3.5));
  }
  esquinas.forEach((p, i) => {
    postes.push(new THREE.CylinderGeometry(0.05, 0.07, 3.1, 8).translate(p.x, 1.55, p.z));
    const q = esquinas[(i + 1) % 6];
    const tramos = 12;
    let anterior = null;
    for (let j = 0; j <= tramos; j++) {
      const f = j / tramos;
      const punto = new THREE.Vector3().lerpVectors(p, q, f);
      punto.y -= Math.sin(f * Math.PI) * 0.45;
      if (anterior) puntosCable.push(anterior, punto);
      if (j > 0 && j < tramos) {
        bombillas.push(new THREE.SphereGeometry(0.035, 6, 4).translate(punto.x, punto.y - 0.05, punto.z));
        coloresBombillas.push(tonos[(i * 13 + j) % tonos.length]);
      }
      anterior = punto;
    }
  });
  raiz.add(new THREE.Mesh(R(fusionar(postes)), R(new THREE.MeshLambertMaterial({ color: 0x8d5a3b }))));
  raiz.add(new THREE.LineSegments(R(new THREE.BufferGeometry().setFromPoints(puntosCable)), R(new THREE.LineBasicMaterial({ color: 0x2b2222 }))));
  raiz.add(new THREE.Mesh(R(fusionar(bombillas, coloresBombillas)), R(new THREE.MeshBasicMaterial({ vertexColors: true }))));

  raiz.add(ctx.arboles([
    { x: -7, z: -14, escala: 1.4 }, { x: 6.5, z: -15, escala: 1.6 }, { x: -14, z: -4, escala: 1.3 },
    { x: 14, z: -3, escala: 1.5 }, { x: -12, z: 6, escala: 1.2 }, { x: 11, z: 8, escala: 1.4 },
    { x: 2, z: 12, escala: 1.5 }, { x: -5, z: 11, escala: 1.3 }, { x: 16, z: -12, escala: 1.7 },
  ], { tipo: 'frondoso', semilla: 14 }));

  // ─── Cañón de circo: lanza las bolas nuevas ────────────────────────────
  const canon = new THREE.Group();
  canon.position.set(1.5, 0, -2.3);
  canon.rotation.y = Math.atan2(-1.5, 2.3); // mirando al jugador
  const matCanonRojo = R(new THREE.MeshLambertMaterial({ color: 0x1e5aa8 }));
  const matCanonOro = R(new THREE.MeshLambertMaterial({ color: 0xe0a82e, emissive: 0x2a1a00 }));
  const tubo = new THREE.Group();
  tubo.position.set(0, 0.42, 0);
  tubo.rotation.x = -0.75; // apunta hacia el jugador y hacia arriba
  const cuerpoTubo = new THREE.Mesh(R(new THREE.CylinderGeometry(0.075, 0.11, 0.55, 16).rotateX(Math.PI / 2).translate(0, 0, 0.1)), matCanonRojo);
  const aros = new THREE.Mesh(R(fusionar([
    new THREE.TorusGeometry(0.08, 0.014, 6, 18).translate(0, 0, 0.37),
    new THREE.TorusGeometry(0.1, 0.014, 6, 18).translate(0, 0, 0.02),
    new THREE.TorusGeometry(0.115, 0.014, 6, 18).translate(0, 0, -0.16),
    new THREE.CylinderGeometry(0.03, 0.03, 0.34, 8).rotateZ(Math.PI / 2),
  ])), matCanonOro);
  tubo.add(cuerpoTubo, aros);
  const ruedas = new THREE.Mesh(R(fusionar([
    new THREE.CylinderGeometry(0.2, 0.2, 0.04, 18).rotateZ(Math.PI / 2).translate(-0.17, 0.2, 0),
    new THREE.CylinderGeometry(0.2, 0.2, 0.04, 18).rotateZ(Math.PI / 2).translate(0.17, 0.2, 0),
    new THREE.BoxGeometry(0.3, 0.06, 0.4).translate(0, 0.22, 0.05),
  ])), R(new THREE.MeshLambertMaterial({ color: 0xc62828 })));
  canon.add(tubo, ruedas);
  raiz.add(canon);
  const boca = new THREE.Object3D();
  boca.position.set(0, 0, 0.4);
  tubo.add(boca);
  let retroceso = 0;

  // ─── Bolas ─────────────────────────────────────────────────────────────
  // Tela de colores con dos franjas claras y las costuras de los gajos
  const hex = (c) => `#${c.toString(16).padStart(6, '0')}`;
  const geoBola = R(new THREE.SphereGeometry(RADIO, 20, 14));
  const texPunto = R(ctx.texturaCanvas((g, tam) => {
    const grad = g.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
    grad.addColorStop(0, 'rgba(255,255,255,1)');
    grad.addColorStop(0.4, 'rgba(255,255,255,0.5)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, tam, tam);
  }, { tam: 64, semilla: 144 }));
  const bolas = COLORES.map((color, i) => {
    const tex = R(ctx.texturaCanvas((g, tam, azarTex) => {
      g.fillStyle = hex(color);
      g.fillRect(0, 0, tam, tam);
      for (let k = 0; k < 300; k++) {
        g.fillStyle = `rgba(0,0,0,${azarTex() * 0.08})`;
        g.fillRect(azarTex() * tam, azarTex() * tam, 2, 2);
      }
      g.fillStyle = '#fbf7ee';
      g.fillRect(0, tam * 0.36, tam, tam * 0.07);
      g.fillRect(0, tam * 0.57, tam, tam * 0.07);
      g.strokeStyle = 'rgba(30,10,10,0.45)';
      g.lineWidth = 2;
      for (let k = 0; k < 3; k++) {
        g.beginPath();
        g.moveTo((k / 3) * tam + 1, 0);
        g.lineTo((k / 3) * tam + 1, tam);
        g.stroke();
      }
    }, { tam: 128, semilla: 150 + i }));
    const malla = new THREE.Mesh(geoBola, R(new THREE.MeshLambertMaterial({ map: tex })));
    malla.visible = false;
    raiz.add(malla);
    const sombra = ctx.crearSombra({ radio: 0.05, opacidad: 0.4 });
    sombra.visible = false;
    raiz.add(sombra);
    return {
      indice: i, malla, sombra, pos: malla.position, color: new THREE.Color(color),
      estado: 'libre', // 'libre' | 'espera' | 'mano' | 'vuelo' | 'cae' | 'suelo'
      vel: new THREE.Vector3(), anterior: new THREE.Vector3(), giro: new THREE.Vector3(),
      mano: -1, tVuelo: 0, deCanon: false, vida: 0, cayendo: false, gravedadPropia: 0, flota: false,
      // Modo automático: parábola de «desde» a «hasta»
      desde: new THREE.Vector3(), hasta: new THREE.Vector3(), t0: 0, F: 1, alto: 0.5, llegada: 0,
      manoDestino: 0, pulsoDestino: 0, atrapada: false, calidad: '',
      // Estela: posiciones de los últimos fotogramas
      rastro: new Float32Array(RASTRO * 3), brillo: 0,
    };
  });

  // Estela de las bolas rápidas: un solo objeto de puntos para todas
  const posRastro = new Float32Array(MAX_BOLAS * RASTRO * 3);
  const colRastro = new Float32Array(MAX_BOLAS * RASTRO * 3);
  const geoRastro = R(new THREE.BufferGeometry());
  geoRastro.setAttribute('position', new THREE.BufferAttribute(posRastro, 3).setUsage(THREE.DynamicDrawUsage));
  geoRastro.setAttribute('color', new THREE.BufferAttribute(colRastro, 3).setUsage(THREE.DynamicDrawUsage));
  const estela = new THREE.Points(geoRastro, R(new THREE.PointsMaterial({
    size: 0.055, map: texPunto, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  })));
  estela.frustumCulled = false;
  raiz.add(estela);

  // ─── Cadena de eslabones sobre la pista: crece con cada recepción y se rompe al caer una bola ───
  const eslabones = new THREE.InstancedMesh(
    R(new THREE.TorusGeometry(0.042, 0.011, 6, 14).scale(1.35, 1, 1)),
    R(new THREE.MeshLambertMaterial({ color: 0xffd34d, emissive: 0x4a3000 })),
    ESLABONES,
  );
  eslabones.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  eslabones.frustumCulled = false;
  eslabones.count = 0;
  raiz.add(eslabones);
  const piezasCadena = Array.from({ length: ESLABONES }, (_, i) => {
    const f = i / (ESLABONES - 1);
    return {
      base: new THREE.Vector3(-0.92 + f * 1.84, 2.24 - Math.sin(f * Math.PI) * 0.08, -2.6),
      pos: new THREE.Vector3(), vel: new THREE.Vector3(), giro: new THREE.Euler(i % 2 ? Math.PI / 2 : 0, 0, 0), velGiro: 0, aparece: 0,
    };
  });
  let cadenaRota = 0; // segundos que quedan de la animación de rotura
  const matrizE = new THREE.Matrix4();
  const quatE = new THREE.Quaternion();
  const escalaE = new THREE.Vector3();

  // ─── Guantes ───────────────────────────────────────────────────────────
  const matGuante = R(new THREE.MeshLambertMaterial({ vertexColors: true }));
  const geoGuantes = {
    '1': [R(geometriaGuante(1, false)), R(geometriaGuante(1, true))],
    '-1': [R(geometriaGuante(-1, false)), R(geometriaGuante(-1, true))],
  };
  function crearGuante(lado) {
    const grupo = new THREE.Group();
    const malla = new THREE.Mesh(geoGuantes[lado][0], matGuante);
    const ancla = new THREE.Object3D(); // donde va la bola cogida
    ancla.position.set(0, 0.058, -0.04);
    grupo.add(malla, ancla);
    return { grupo, malla, ancla };
  }

  // VR: un guante en cada mando, con la palma girada hacia dentro
  const manosVR = ctx.manos.map((mano, i) => {
    const guante = crearGuante(i === 0 ? -1 : 1);
    ctx.adjuntarAMano(mano, guante.grupo);
    return {
      mano, ...guante, lado: 0, punto: new THREE.Vector3(), bola: null, cerrada: false, ventana: 0, bloqueo: 0,
      posiciones: Array.from({ length: HISTORIAL }, () => new THREE.Vector3()), tiempos: new Float64Array(HISTORIAL).fill(-1), idx: 0,
    };
  });
  // Ratón y móvil: dos guantes que se mueven solos
  const manosAuto = [-1, 1].map((lado) => {
    const guante = crearGuante(lado);
    guante.grupo.rotation.z = lado * 0.25;
    raiz.add(guante.grupo);
    return { lado, ...guante, punto: new THREE.Vector3(), cerrada: 0 };
  });
  // Aro que se cierra sobre la mano cuando llega una bola (marca el momento del clic)
  const aros2 = manosAuto.map(() => {
    const aro = new THREE.Mesh(R(new THREE.RingGeometry(0.07, 0.085, 36)), R(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, depthWrite: false })));
    aro.visible = false;
    raiz.add(aro);
    return aro;
  });

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.4, alto: 0.34 });
  marcador.mesh.position.set(0, 2.5, -2.65);
  marcador.mesh.rotation.x = 0.14;
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'jugando' | 'pausa' | 'fin'
  let reloj = 3;
  let ahora = 0;
  let tiempoJugado = 0;
  let cadena = 0;
  let mejor = 0;
  let vidas = VIDAS;
  let record = ctx.leer('record', 0);
  let recordBatido = false;
  let enJuego = 0;          // bolas en juego (2 a 5)
  let otraBola = -1;        // segundos para que el cañón lance otra bola (-1: ninguna pendiente)
  let aviso = null;         // { texto, color, tiempo }
  let rojo = 0;             // segundos que el número de la cadena se ve en rojo
  let modoVR = null;
  // Ritmo del modo automático
  let pulso = 0;            // número del próximo pulso (lanza la mano pulso % 2)
  let tPulso = 0;           // cuándo es
  let bloqueoClic = 0;

  const cabeza = new THREE.Vector3();
  const delante = new THREE.Vector3();
  const lateral = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const velMano = new THREE.Vector3();
  const ARRIBA = new THREE.Vector3(0, 1, 0);

  const dificultad = () => Math.min(1, tiempoJugado / DIFICULTAD_MAX);
  const gravedad = () => 9.8 * (0.5 + 0.2 * dificultad());
  const radioCoger = () => 0.16 - 0.045 * dificultad();
  const ayuda = () => 0.6 - 0.35 * dificultad();
  // Modo automático: lanzamientos por segundo, pulso, tiempo con la bola en la mano y margen del clic
  const T = () => 1 / (1.6 + 0.9 * dificultad());
  const retencion = () => 0.5 * T();
  const ventana = () => Math.min(0.45 * T(), 0.16 - 0.045 * dificultad());
  // Cascada: con un número impar de bolas, todas; con uno par, la de una más con un hueco
  const patron = () => (enJuego % 2 ? enJuego : enJuego + 1);
  const altura = () => 0.25 + 0.09 * patron();

  function avisar(texto, color, tiempo = 1.4) { aviso = { texto, color, tiempo }; }

  function actualizarMarcador() {
    const vr = ctx.enVR();
    let lineas;
    if (estado === 'intro') {
      lineas = [{ texto: ctx.t('titulo'), tam: 1.3, color: '#ffd34d' },
        { texto: ctx.t(vr ? 'introVR' : ctx.tactil ? 'introTactil' : 'introRaton'), tam: 0.7 }];
    } else if (estado === 'fin') {
      lineas = [{ texto: ctx.t('fin', { n: mejor }), tam: 1.15, color: '#ffd34d' },
        { texto: ctx.t('partida.recordNuevaPartida', { record, n: Math.ceil(reloj) }), tam: 0.8 }];
    } else {
      const corazones = '♥'.repeat(vidas) + '♡'.repeat(VIDAS - vidas);
      const esperando = vr && bolas.some((b) => b.estado === 'espera');
      const nueva = esperando && bolas.some((b) => b.estado === 'espera' && b.deCanon);
      lineas = [{ texto: ctx.t('cadena', { n: cadena }), tam: 1.3, color: rojo > 0 ? '#ff6e6e' : '#ffffff' },
        aviso ? { texto: aviso.texto, tam: 0.8, color: aviso.color }
          : esperando ? { texto: ctx.t(nueva ? 'cogeNueva' : 'cogeBolas'), tam: 0.78, color: '#b3e5fc' }
            : { texto: ctx.t('estado', { mejor, vidas: corazones, record }), tam: 0.78, color: '#ffe9b0' }];
    }
    marcador.escribir(lineas);
  }

  function colocarCabeza() {
    ctx.camara.getWorldPosition(cabeza);
    ctx.camara.getWorldDirection(delante);
    delante.y = 0;
    if (delante.lengthSq() < 1e-6) delante.set(0, 0, -1);
    delante.normalize();
    lateral.crossVectors(delante, ARRIBA);
  }

  // ─── Bolas: aparecer, desaparecer y dibujar ────────────────────────────
  function mostrar(b, estadoNuevo) {
    b.estado = estadoNuevo;
    b.malla.visible = true;
    b.malla.scale.setScalar(1);
    b.sombra.visible = true;
    b.tVuelo = 0;
    b.mano = -1;
    b.deCanon = false;
    b.atrapada = false;
    b.cayendo = false;
    b.flota = false;
    b.giro.set(azar(-8, 8), azar(-8, 8), azar(-8, 8));
    for (let k = 0; k < RASTRO; k++) b.rastro.set([b.pos.x, b.pos.y, b.pos.z], k * 3);
    b.anterior.copy(b.pos);
  }

  function retirar(b, estallar = false) {
    if (estallar && b.malla.visible) ctx.efectos.estallido(b.pos, { color: b.color, cantidad: 10, fuerza: 1.2 });
    b.estado = 'libre';
    b.malla.visible = false;
    b.sombra.visible = false;
    b.mano = -1;
    b.brillo = 0;
  }

  function enMano(h) {
    for (const b of bolas) if (b.estado === 'mano' && b.mano === h) return b;
    return null;
  }

  // Coloca las bolas para empezar (o volver a empezar) la cadena
  function prepararBolas() {
    for (const b of bolas) retirar(b);
    for (const m of manosVR) m.bola = null;
    enJuego = BOLAS_INICIALES;
    otraBola = -1;
    if (ctx.enVR()) {
      // Flotando delante de cada mano, a la altura de la cintura
      colocarCabeza();
      for (let i = 0; i < BOLAS_INICIALES; i++) {
        const b = bolas[i];
        b.pos.copy(cabeza).addScaledVector(delante, 0.38).addScaledVector(lateral, i ? 0.2 : -0.2);
        b.pos.y = Math.max(0.7, cabeza.y - 0.5);
        b.desde.copy(b.pos);
        mostrar(b, 'espera');
        ctx.efectos.estallido(b.pos, { color: b.color, cantidad: 8, fuerza: 0.8 });
      }
    } else {
      // En las dos manos; empieza lanzando la izquierda
      pulso = 0;
      tPulso = ahora + 0.9;
      for (let h = 0; h < 2; h++) {
        const b = bolas[h];
        manosAuto[h].ancla.getWorldPosition(b.pos);
        mostrar(b, 'mano');
        b.mano = h;
      }
    }
  }

  // ─── Recepciones y caídas ──────────────────────────────────────────────
  function recepcion(b, pos, manoVR, calidad = '') {
    cadena++;
    if (cadena > mejor) mejor = cadena;
    const f = Math.min(1, cadena / 40);
    const hito = cadena % CADA === 0 && enJuego < MAX_BOLAS;
    const nivel = hito ? 'grande' : cadena % 10 === 0 ? 'medio' : 'pequeño';
    ctx.efectos.impacto(nivel, { pos, color: b.color, sonido: 'recepcion' });
    if (manoVR) ctx.vibrar(manoVR, 0.15 + 0.3 * f, 30 + Math.round(25 * f)); // vibración suave, más con la cadena
    const colorNumero = cadena >= 40 ? '#ffd34d' : cadena >= 20 ? '#ffe082' : cadena >= 10 ? '#fff3c4' : '#ffffff';
    ctx.efectos.texto(tmp.copy(pos).addScaledVector(ARRIBA, 0.12), String(cadena), { color: colorNumero, tam: 0.75 + 0.75 * f });
    if (calidad) {
      const color = calidad === 'perfecto' ? '#b9f6ca' : calidad === 'bien' ? '#e1f5fe' : '#ffe0b2';
      ctx.efectos.texto(tmp.copy(pos).addScaledVector(ARRIBA, -0.09), ctx.t(calidad), { color, tam: 0.6, vida: 0.6 });
    }
    // Un eslabón más en la cadena
    if (cadena <= ESLABONES) {
      const e = piezasCadena[cadena - 1];
      e.aparece = 0.25;
      eslabones.count = cadena;
    }
    if (!recordBatido && record > 0 && cadena > record) {
      recordBatido = true;
      avisar(ctx.t('partida.nuevoRecord'), '#ffd34d', 1.6);
      ctx.sonido('ovacion');
    }
    if (hito) {
      otraBola = 0.7;
      avisar(ctx.t('otraBola', { n: enJuego + 1 }), '#b3e5fc', 1.6);
      ctx.sonido('anillo');
    }
  }

  // Una bola ha tocado el suelo: se rompe la cadena
  function caida(b) {
    if (estado !== 'jugando') return;
    ctx.sonido('plof');
    ctx.sonido('cadenaRota');
    for (const m of manosVR) ctx.vibrar(m.mano, 0.5, 120);
    ctx.destello(0xff5252, 0.25);
    ctx.efectos.estallido(tmp.copy(b.pos).setY(0.05), { color: 0xd8b07a, cantidad: 12, fuerza: 1, gravedad: 4 });
    // Los eslabones se sueltan y caen
    for (let i = 0; i < eslabones.count; i++) {
      const e = piezasCadena[i];
      e.pos.copy(e.base);
      e.vel.set(azar(-0.8, 0.8), azar(0.2, 1.4), azar(-0.3, 0.6));
      e.velGiro = azar(-9, 9);
    }
    cadenaRota = eslabones.count ? 1.3 : 0;
    rojo = 1.3;
    vidas--;
    cadena = 0;
    if (vidas <= 0) {
      terminar();
      return;
    }
    avisar(ctx.t('cadenaRota'), '#ff8a80', 1.4);
    estado = 'pausa';
    reloj = 1.5;
  }

  function terminar() {
    estado = 'fin';
    reloj = 6;
    ctx.puntuacion(mejor); // a la clasificación (juegos/marcadores.js): la cadena más larga
    if (mejor > record) {
      record = mejor;
      ctx.guardar('record', record);
    }
    ctx.sonido('fin');
    for (const b of bolas) if (b.estado !== 'suelo' && b.estado !== 'libre') retirar(b, true);
    for (const m of manosVR) m.bola = null;
  }

  function empezar() {
    estado = 'jugando';
    cadena = 0;
    mejor = 0;
    vidas = VIDAS;
    tiempoJugado = 0;
    recordBatido = false;
    aviso = null;
    prepararBolas();
  }

  // ─── Cañón: otra bola más ──────────────────────────────────────────────
  function dispararCanon() {
    const b = bolas.find((x) => x.estado === 'libre');
    if (!b) return;
    boca.getWorldPosition(b.pos);
    retroceso = 0.25;
    ctx.sonido('canon');
    ctx.efectos.estallido(b.pos, { color: 0xeeeeee, cantidad: 12, fuerza: 1, gravedad: -0.5, vida: 0.7 });
    enJuego++;
    if (modoVR) {
      // Delante del pecho, entre las dos manos: allí se queda flotando hasta que la cojas
      tmp.copy(cabeza).addScaledVector(delante, 0.4);
      tmp.y = Math.max(0.8, cabeza.y - 0.4);
      const F = 1.1;
      mostrar(b, 'vuelo');
      b.deCanon = true;
      b.flota = true;
      b.F = F;
      b.vel.subVectors(tmp, b.pos).divideScalar(F);
      b.vel.y += 0.5 * gravedad() * F;
      return;
    }
    // Modo automático: llega a una mano justo en un hueco del patrón
    const m = patron();
    const t = T();
    for (let j = pulso + 1; j < pulso + 40; j++) {
      const h = j % 2;
      const tj = tPulso + (j - pulso) * t;
      if (tj - retencion() - ahora < 0.9) continue;
      if (pulsoOcupado(j, m)) continue;
      mostrar(b, 'vuelo');
      b.deCanon = true;
      b.desde.copy(b.pos);
      b.hasta.copy(puntoMano(h, 'fuera'));
      b.t0 = ahora;
      b.llegada = tj - retencion();
      b.F = b.llegada - ahora;
      b.alto = 0.55;
      b.manoDestino = h;
      b.pulsoDestino = j;
      return;
    }
    retirar(b);
    enJuego--;
  }

  // ¿Alguna bola le tocará lanzar a su mano en el pulso j?
  function pulsoOcupado(j, m) {
    for (const b of bolas) {
      let base = -1;
      if (b.estado === 'vuelo' && !b.cayendo) base = b.pulsoDestino;
      else if (b.estado === 'mano') base = proximoPulsoDe(b.mano);
      if (base >= 0 && j >= base && (j - base) % m === 0) return true;
    }
    return false;
  }
  const proximoPulsoDe = (h) => (pulso % 2 === h ? pulso : pulso + 1);

  // ─── Modo VR ───────────────────────────────────────────────────────────
  function soltarVR(mj) {
    const b = mj.bola;
    mj.bola = null;
    mj.bloqueo = 0.15;
    if (!b || b.estado !== 'mano') return;
    // Velocidad de la mano en los últimos ~70 ms
    const n = HISTORIAL;
    const actual = (mj.idx - 1 + n) % n;
    let j = actual;
    for (let i = 1; i < n; i++) {
      const k = (actual - i + n) % n;
      if (mj.tiempos[k] < 0) break;
      j = k;
      if (mj.tiempos[actual] - mj.tiempos[k] >= 0.07) break;
    }
    const dtv = mj.tiempos[actual] - mj.tiempos[j];
    if (dtv > 0) velMano.subVectors(mj.posiciones[actual], mj.posiciones[j]).divideScalar(dtv);
    else velMano.set(0, 0, 0);
    if (velMano.length() > 8) velMano.setLength(8);
    b.estado = 'vuelo';
    b.mano = -1;
    b.tVuelo = 0;
    b.deCanon = false;
    b.vel.copy(velMano);
    ayudarLanzamiento(b);
  }

  // Corrige un poco la trayectoria hacia la mano más cercana a donde iba a caer (si ya iba cerca)
  function ayudarLanzamiento(b) {
    const v = b.vel;
    if (v.y < 0.7) return; // no es un lanzamiento hacia arriba
    const g = gravedad();
    let mejorError = Infinity;
    let correccionX = 0;
    let correccionZ = 0;
    for (const mj of manosVR) {
      if (!mj.mano.activa) continue;
      const q = mj.punto;
      const disc = v.y * v.y + 2 * g * (b.pos.y - q.y);
      if (disc < 0) continue;
      const t = (v.y + Math.sqrt(disc)) / g;
      if (t < 0.25) continue;
      const ex = q.x - (b.pos.x + v.x * t);
      const ez = q.z - (b.pos.z + v.z * t);
      const error = Math.hypot(ex, ez);
      if (error < mejorError) {
        mejorError = error;
        correccionX = ex / t;
        correccionZ = ez / t;
      }
    }
    if (mejorError > 0.5) return; // demasiado desviado: sin ayuda
    const a = ayuda();
    tmp2.set(correccionX * a, 0, correccionZ * a);
    if (tmp2.length() > 0.9) tmp2.setLength(0.9);
    v.add(tmp2);
  }

  function actualizarVR(dt) {
    const real = performance.now() / 1000; // tiempo real: la micro-pausa de los efectos no infla la velocidad
    for (const mj of manosVR) {
      mj.lado = mj.mano.lado === 'left' ? -1 : mj.mano.lado === 'right' ? 1 : (mj === manosVR[0] ? -1 : 1);
      mj.grupo.rotation.z = mj.lado * 0.95; // la palma hacia dentro
      mj.bloqueo = Math.max(0, mj.bloqueo - dt);
      if (!mj.mano.activa) {
        if (mj.bola) soltarVR(mj);
        mj.cerrada = false;
        continue;
      }
      mj.ancla.getWorldPosition(mj.punto);
      mj.posiciones[mj.idx].copy(mj.punto);
      mj.tiempos[mj.idx] = real;
      mj.idx = (mj.idx + 1) % HISTORIAL;
      const cerrada = !!(mj.mano.gatillo || mj.mano.apreton);
      if (cerrada && !mj.cerrada) mj.ventana = VENTANA_CIERRE;
      if (!cerrada && mj.cerrada && mj.bola) soltarVR(mj);
      mj.cerrada = cerrada;
      mj.ventana = Math.max(0, mj.ventana - dt);
      mj.malla.geometry = geoGuantes[mj.lado][cerrada || mj.bola ? 1 : 0];
      // Coger: la mano se acaba de cerrar y hay una bola cerca
      if (cerrada && !mj.bola && mj.ventana > 0 && mj.bloqueo <= 0 && estado === 'jugando') {
        let elegida = null;
        let distancia = Infinity;
        for (const b of bolas) {
          if (b.estado !== 'vuelo' && b.estado !== 'espera') continue;
          const radio = b.estado === 'espera' ? 0.2 : radioCoger() * (b.deCanon ? 1.4 : 1);
          const d = b.pos.distanceTo(mj.punto);
          if (d < radio && d < distancia) {
            elegida = b;
            distancia = d;
          }
        }
        if (elegida) {
          const valida = elegida.estado === 'vuelo' && elegida.tVuelo >= VUELO_MINIMO;
          elegida.estado = 'mano';
          elegida.flota = false;
          elegida.malla.scale.setScalar(1);
          elegida.mano = manosVR.indexOf(mj);
          mj.bola = elegida;
          mj.ventana = 0;
          if (valida) recepcion(elegida, mj.punto, mj.mano);
          else {
            ctx.sonido('recepcion');
            ctx.vibrar(mj.mano, 0.2, 25);
          }
        }
      }
      if (mj.bola) mj.bola.pos.copy(mj.punto);
    }
  }

  // ─── Modo automático (ratón y móvil) ───────────────────────────────────
  // Punto de lanzamiento (dentro) o de recepción (fuera) de cada mano
  function puntoMano(h, donde) {
    const lado = h ? 1 : -1;
    return tmp2.set(lado * (donde === 'dentro' ? MANO_DENTRO : MANO_FUERA), MANO_Y, MANO_Z);
  }

  // Las manos van y vuelven a su ritmo: lanzan por dentro en su pulso y reciben por fuera justo antes del siguiente
  function moverManosAuto(dt) {
    const t = T();
    const D = retencion();
    for (let h = 0; h < 2; h++) {
      const ma = manosAuto[h];
      const lado = h ? 1 : -1;
      const proximo = tPulso + (proximoPulsoDe(h) - pulso) * t;
      const recibe = proximo - D;
      const anterior = proximo - 2 * t;
      let x;
      let y = MANO_Y;
      if (ahora < recibe) {
        // Tras lanzar: de dentro a fuera, subiendo un poco
        const f = suave(limitar((ahora - anterior) / Math.max(0.01, recibe - anterior), 0, 1));
        x = MANO_DENTRO + (MANO_FUERA - MANO_DENTRO) * f;
        y += Math.sin(f * Math.PI) * 0.03;
      } else {
        // Con la bola: de fuera a dentro, bajando (el «cazo» de los malabaristas)
        const f = limitar((ahora - recibe) / D, 0, 1);
        x = MANO_FUERA + (MANO_DENTRO - MANO_FUERA) * suave(f);
        y -= Math.sin(f * Math.PI) * 0.07;
      }
      ma.grupo.position.set(lado * x, y - 0.058, MANO_Z + 0.04);
      ma.cerrada = Math.max(0, ma.cerrada - dt);
      const conBola = !!enMano(h);
      ma.malla.geometry = geoGuantes[lado][conBola || ma.cerrada > 0 ? 1 : 0];
      ma.ancla.getWorldPosition(ma.punto);
    }
  }

  function lanzarAuto(b, h) {
    const m = patron();
    const t = T();
    b.estado = 'vuelo';
    b.mano = -1;
    b.t0 = ahora;
    b.F = m * t - retencion();
    b.llegada = ahora + b.F;
    b.desde.copy(b.pos);
    b.hasta.copy(puntoMano(1 - h, 'fuera'));
    b.alto = altura();
    b.manoDestino = 1 - h;
    b.pulsoDestino = pulso + m;
    b.atrapada = false;
    b.cayendo = false;
    b.deCanon = false;
  }

  function actualizarAuto(dt) {
    // Pulsos: cada mano lanza la bola que tiene en el suyo
    if (estado === 'jugando') {
      while (ahora >= tPulso) {
        const h = pulso % 2;
        const b = enMano(h);
        if (b) lanzarAuto(b, h);
        pulso++;
        tPulso += T();
      }
    }
    moverManosAuto(dt);
    const v = ventana();
    // Clic o toque: la bola que llega a una mano más cerca de ese momento
    bloqueoClic = Math.max(0, bloqueoClic - dt);
    if (ctx.raton.clic && estado === 'jugando' && bloqueoClic <= 0) {
      let elegida = null;
      let diferencia = Infinity;
      for (const b of bolas) {
        if (b.estado !== 'vuelo' || b.atrapada || b.cayendo) continue;
        const d = Math.abs(ahora - b.llegada);
        if (d <= v && d < diferencia) {
          elegida = b;
          diferencia = d;
        }
      }
      if (elegida) {
        elegida.atrapada = true;
        elegida.calidad = diferencia <= 0.05 ? 'perfecto' : diferencia <= 0.1 ? 'bien' : 'justo';
        manosAuto[elegida.manoDestino].cerrada = 0.2;
      } else {
        // A destiempo: la mano se cierra en vacío y tarda un poco en poder volver a coger
        bloqueoClic = 0.3;
        const h = proximoPulsoDe(0) === pulso ? 1 : 0;
        manosAuto[h].cerrada = 0.2;
        ctx.efectos.texto(tmp.copy(manosAuto[h].punto).addScaledVector(ARRIBA, 0.1), ctx.t('destiempo'), { color: '#b0bec5', tam: 0.55, vida: 0.5 });
        ctx.sonido('tic');
      }
    }
    for (const b of bolas) {
      if (b.estado !== 'vuelo' || b.cayendo) continue;
      const s = (ahora - b.t0) / b.F;
      b.pos.lerpVectors(b.desde, b.hasta, s);
      b.pos.y += b.alto * 4 * s * (1 - s);
      if (b.atrapada && ahora >= b.llegada) {
        // Ya en la mano
        b.estado = 'mano';
        b.mano = b.manoDestino;
        recepcion(b, manosAuto[b.mano].punto, null, b.calidad);
      } else if (!b.atrapada && ahora > b.llegada + v) {
        // Se ha escapado: sigue cayendo con la velocidad que llevaba
        b.cayendo = true;
        b.vel.subVectors(b.hasta, b.desde).divideScalar(b.F);
        b.vel.y += (b.alto * 4 * (1 - 2 * s)) / b.F;
        b.gravedadPropia = (8 * b.alto) / (b.F * b.F);
      }
    }
    for (const b of bolas) {
      if (b.estado === 'mano' && b.mano >= 0) b.pos.lerp(manosAuto[b.mano].punto, Math.min(1, dt * 30));
    }
    // Aros: se cierran sobre la mano a la que llega la próxima bola
    for (let h = 0; h < 2; h++) {
      const aro = aros2[h];
      let llegada = Infinity;
      for (const b of bolas) {
        if (b.estado === 'vuelo' && !b.atrapada && !b.cayendo && b.manoDestino === h && b.llegada < llegada) llegada = b.llegada;
      }
      const falta = llegada - ahora;
      if (estado !== 'jugando' || falta > 0.7 || falta < -v) {
        aro.visible = false;
        continue;
      }
      aro.visible = true;
      aro.position.copy(puntoMano(h, 'fuera'));
      aro.lookAt(ctx.camara.position);
      aro.scale.setScalar(1 + Math.max(0, falta) * 3.2);
      const dentro = Math.abs(falta) <= v;
      aro.material.color.setHex(dentro ? 0xff6a3d : 0xffffff);
      aro.material.opacity = dentro ? 0.95 : 0.35 + 0.5 * (1 - falta / 0.7);
    }
  }

  // ─── Física común: bolas sueltas y en el suelo ─────────────────────────
  function moverBolas(dt) {
    const g = gravedad();
    for (const b of bolas) {
      if (b.estado === 'libre') continue;
      if (b.estado === 'espera') {
        b.pos.y = b.desde.y + Math.sin(ahora * 2.4 + b.indice) * 0.015;
        if (b.deCanon) {
          // Late cada vez más deprisa y, si no la coges a tiempo, cae
          b.vida -= dt;
          b.malla.scale.setScalar(1 + 0.12 * Math.max(0, Math.sin(ahora * (6 + (FLOTA - b.vida) * 5))));
          if (b.vida <= 0 && estado === 'jugando') {
            b.estado = 'vuelo';
            b.vel.set(0, 0, 0);
            b.tVuelo = 0;
            b.malla.scale.setScalar(1);
          }
        }
      } else if ((b.estado === 'vuelo' && (modoVR || b.cayendo))) {
        b.tVuelo += dt;
        if (b.flota && b.tVuelo >= b.F) {
          b.flota = false;
          b.estado = 'espera';
          b.desde.copy(b.pos);
          b.vida = FLOTA;
          b.vel.set(0, 0, 0);
          ctx.efectos.estallido(b.pos, { color: b.color, cantidad: 8, fuerza: 0.6, gravedad: 0 });
          continue;
        }
        b.vel.y -= (b.cayendo ? b.gravedadPropia : g) * dt;
        b.pos.addScaledVector(b.vel, dt);
        if (b.pos.y <= RADIO) {
          b.pos.y = RADIO;
          b.estado = 'suelo';
          b.vida = 1.4;
          b.vel.set(b.vel.x * 0.4, Math.abs(b.vel.y) * 0.25, b.vel.z * 0.4);
          b.cayendo = false;
          caida(b);
        }
      } else if (b.estado === 'suelo') {
        // Bota un poco, rueda y desaparece
        b.vel.y -= 9.8 * dt;
        b.pos.addScaledVector(b.vel, dt);
        if (b.pos.y < RADIO) {
          b.pos.y = RADIO;
          b.vel.y = Math.abs(b.vel.y) * 0.3;
          b.vel.x *= 0.8;
          b.vel.z *= 0.8;
        }
        b.vida -= dt;
        b.malla.scale.setScalar(Math.min(1, b.vida / 0.3));
        if (b.vida <= 0) retirar(b);
      }
      if (b.estado === 'libre') continue;
      // Gira en el aire; quieta en la mano
      if (b.estado === 'vuelo' || b.estado === 'suelo') {
        b.malla.rotation.x += b.giro.x * dt;
        b.malla.rotation.y += b.giro.y * dt;
        b.malla.rotation.z += b.giro.z * dt;
      } else if (b.estado === 'espera') {
        b.malla.rotation.y += dt * 1.5;
      }
      ctx.colocarSombra(b.sombra, b.pos, 0.008);
    }
  }

  // Estela: más visible cuanto más rápida va la bola
  function actualizarEstela(dt) {
    for (const b of bolas) {
      const velocidad = b.pos.distanceTo(b.anterior) / Math.max(dt, 1e-3);
      b.anterior.copy(b.pos);
      const objetivo = b.malla.visible && (b.estado === 'vuelo') ? limitar((velocidad - 1.2) / 2.5, 0, 1) : 0;
      b.brillo += (objetivo - b.brillo) * Math.min(1, dt * 10);
      b.rastro.copyWithin(3, 0, (RASTRO - 1) * 3);
      b.rastro[0] = b.pos.x;
      b.rastro[1] = b.pos.y;
      b.rastro[2] = b.pos.z;
      const o = b.indice * RASTRO * 3;
      posRastro.set(b.rastro, o);
      for (let k = 0; k < RASTRO; k++) {
        const f = b.brillo * (1 - k / RASTRO) * 0.75;
        colRastro[o + k * 3] = (b.color.r * 0.6 + 0.4) * f;
        colRastro[o + k * 3 + 1] = (b.color.g * 0.6 + 0.4) * f;
        colRastro[o + k * 3 + 2] = (b.color.b * 0.6 + 0.4) * f;
      }
    }
    geoRastro.attributes.position.needsUpdate = true;
    geoRastro.attributes.color.needsUpdate = true;
  }

  function actualizarCadena(dt) {
    if (cadenaRota > 0) {
      cadenaRota -= dt;
      for (let i = 0; i < eslabones.count; i++) {
        const e = piezasCadena[i];
        e.vel.y -= 6 * dt;
        e.pos.addScaledVector(e.vel, dt);
        quatE.setFromEuler(e.giro);
        e.giro.z += e.velGiro * dt;
        eslabones.setMatrixAt(i, matrizE.compose(e.pos, quatE, escalaE.setScalar(Math.max(0.01, Math.min(1, cadenaRota / 0.4)))));
      }
      if (cadenaRota <= 0) {
        eslabones.count = 0;
        for (const e of piezasCadena) e.giro.z = 0;
      }
    } else {
      for (let i = 0; i < eslabones.count; i++) {
        const e = piezasCadena[i];
        e.aparece = Math.max(0, e.aparece - dt);
        quatE.setFromEuler(e.giro);
        eslabones.setMatrixAt(i, matrizE.compose(e.base, quatE, escalaE.setScalar(1 + e.aparece * 2.4)));
      }
    }
    eslabones.instanceMatrix.needsUpdate = true;
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function actualizar(dt) {
    ahora += dt;
    reloj -= dt;
    colocarCabeza();
    const vr = ctx.enVR();
    if (vr !== modoVR) {
      // Al entrar o salir de la realidad virtual se vuelve a empezar la cadena (sin perder vidas)
      modoVR = vr;
      for (const ma of manosAuto) ma.grupo.visible = !vr;
      for (const aro of aros2) aro.visible = false;
      if (estado === 'jugando') prepararBolas();
    }
    if (estado === 'intro' && reloj <= 0) empezar();
    else if (estado === 'fin' && reloj <= 0) empezar();
    else if (estado === 'pausa' && reloj <= 0) {
      estado = 'jugando';
      prepararBolas();
    }
    if (estado === 'jugando') {
      tiempoJugado += dt;
      if (otraBola >= 0 && (otraBola -= dt) < 0) dispararCanon();
    }
    if (estado === 'pausa' && reloj < 1.2) {
      // Las demás bolas desaparecen para volver a empezar
      for (const b of bolas) if (b.estado === 'vuelo' || b.estado === 'mano' || b.estado === 'espera') retirar(b, true);
      for (const m of manosVR) m.bola = null;
    }
    if (aviso && (aviso.tiempo -= dt) <= 0) aviso = null;
    rojo = Math.max(0, rojo - dt);

    if (vr) actualizarVR(dt);
    else {
      colocarVista();
      actualizarAuto(dt);
    }
    moverBolas(dt);
    actualizarEstela(dt);
    actualizarCadena(dt);

    // Retroceso del cañón
    retroceso = Math.max(0, retroceso - dt);
    tubo.position.z = -Math.sin((retroceso / 0.25) * Math.PI) * 0.06;
    actualizarMarcador();
  }

  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      // La shell retira lo que hay en la escena y en las manos y los recursos registrados.
      bolas.length = 0;
    },
  };
}
