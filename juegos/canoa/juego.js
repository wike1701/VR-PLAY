// CANOA
// Bajas un río en canoa, con un remo en cada mano. La corriente te lleva siempre hacia delante; remando
// con los dos brazos ganas velocidad, con uno solo giras hacia ese lado y, si dejas de remar, la canoa se
// endereza poco a poco con la corriente. El río no se acaba: rocas, troncos, rápidos, corrientes que
// empujan de lado, curvas y pasos estrechos, cada vez más rápido y más seguido. Los choques frenan, dañan
// el casco y quitan maniobra un momento; si el casco se rompe (o el golpe es muy fuerte) la canoa vuelca y
// pierdes una de las 3 vidas. Lo que cuenta para la clasificación son los metros recorridos.
//
// Justo: cada tramo del río tiene un hueco seguro de al menos 1,6 m que solo se desplaza lo que la canoa
// puede recorrer de lado a esa velocidad, y los obstáculos se ven a más de 60 m.
// Cómodo en VR: el mundo nunca gira alrededor del jugador (solo se desplaza) y la cámara no se sacude.
//
// En VR: un remo en cada mano; rema metiendo la pala en el agua y llevándola hacia atrás. Se tolera el
// gesto imperfecto: lo que hacen las dos manos en unas décimas de segundo cuenta como «a la vez».
// Con ratón o en el móvil: mantén pulsado a la izquierda, a la derecha o en el centro de la pantalla para
// remar con el brazo izquierdo, el derecho o los dos.
import * as THREE from 'three';

// Todo se genera con código: no hay nada que descargar.
export async function precargar() {}

const VIDAS = 3;
const AGUA_Y = 0.32;              // altura del agua
const TRAMO = 10;                 // metros de cada tramo del río
const NUDOS = 64;                 // nudos guardados del trazado (memoria circular)
const FILAS = 70;                 // filas de la malla del río
const DESDE = -16;                // metros por detrás del jugador donde empieza el río dibujado
const PASO_FILA = 1.6;            // metros entre filas (llega a ~94 m por delante)
const VISTA = 92;                 // hasta dónde se generan obstáculos por delante
const PROA = 2.1;                 // metros de la canoa por delante del jugador
const POPA = 1.1;                 // y por detrás
const MEDIA_CANOA = 0.36;         // media anchura de la canoa
const RUMBO_MAX = 0.6;            // radianes de giro máximo respecto a la corriente
const HUECO = 1.6;                // anchura mínima del paso seguro
const DIFICULTAD_MAX = 240;       // segundos hasta la dificultad máxima
const MAX_ROCAS = 48;
const MAX_TRONCOS = 10;
const MAX_ZONAS = 14;
const MAX_ESPUMA = 40;
const MAX_FLECHAS = 30;
const ARBOLES = 44;

const azar = (a, b) => a + Math.random() * (b - a);
const limitar = (v, a, b) => Math.min(b, Math.max(a, v));
const suave = (f) => (1 - Math.cos(Math.PI * f)) / 2;
// Número pseudoaleatorio fijo para cada entero (los árboles no cambian de sitio al pasar)
const hash = (n) => {
  const x = Math.sin(n * 127.1 + 311.7) * 43758.5453;
  return x - Math.floor(x);
};

// Junta varias geometrías en una (menos llamadas de dibujo)
function fusionar(geometrias) {
  const partes = geometrias.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = partes.reduce((n, g) => n + g.attributes.position.count, 0);
  const resultado = new THREE.BufferGeometry();
  for (const nombre of ['position', 'normal', 'uv']) {
    const tam = partes[0].attributes[nombre].itemSize;
    const datos = new Float32Array(total * tam);
    let o = 0;
    for (const g of partes) {
      datos.set(g.attributes[nombre].array, o);
      o += g.attributes[nombre].array.length;
    }
    resultado.setAttribute(nombre, new THREE.BufferAttribute(datos, tam));
  }
  for (const g of new Set([...geometrias, ...partes])) g.dispose();
  return resultado;
}

// Remo: mango, empuñadura en T arriba y pala abajo. El origen es donde va la mano.
function geometriaRemo() {
  const abajo = new THREE.Vector3(0, -1, -0.32).normalize();
  const largo = 0.95;
  // El mango se construye hacia -Y y se gira para que apunte hacia abajo y un poco hacia delante
  const gira = new THREE.Quaternion().setFromUnitVectors(new THREE.Vector3(0, -1, 0), abajo);
  const mango = new THREE.CylinderGeometry(0.014, 0.016, largo + 0.12, 8).translate(0, -largo / 2 + 0.06, 0);
  const empunadura = new THREE.CylinderGeometry(0.014, 0.014, 0.11, 8).rotateZ(Math.PI / 2).translate(0, 0.12, 0);
  const pala = new THREE.SphereGeometry(1, 12, 8).scale(0.075, 0.2, 0.014).translate(0, -largo - 0.08, 0);
  return [fusionar([mango, empunadura]).applyQuaternion(gira), pala.applyQuaternion(gira), abajo.clone().multiplyScalar(largo + 0.08)];
}

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  // ─── Paisaje: un valle de montaña con el río ───────────────────────────
  ctx.fondo(0x9fd3f0, { nubes: 0.5, sol: [0.4, 0.5, -0.75], niebla: [35, 90], paisaje: { tipo: 'montes', color: 0x5d7f6a, radio: 140 } });
  ctx.sueloBase(false);
  // Desde detrás del asiento, un poco por encima
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.45, 1.15), new THREE.Vector3(0, 0.45, -8));

  // Agua: azul con reflejos; la textura avanza con la corriente
  const texAgua = R(ctx.texturaCanvas((g, tam, azarTex) => {
    const grad = g.createLinearGradient(0, 0, tam, 0);
    grad.addColorStop(0, '#2b6e8a');
    grad.addColorStop(0.5, '#3f8fb0');
    grad.addColorStop(1, '#2b6e8a');
    g.fillStyle = grad;
    g.fillRect(0, 0, tam, tam);
    for (let i = 0; i < 160; i++) {
      g.strokeStyle = `rgba(220,245,255,${0.08 + azarTex() * 0.22})`;
      g.lineWidth = 1 + azarTex() * 2;
      const x = azarTex() * tam;
      const y = azarTex() * tam;
      g.beginPath();
      g.moveTo(x, y);
      g.quadraticCurveTo(x + 6, y + 10, x + 2, y + 18 + azarTex() * 20);
      g.stroke();
    }
  }, { tam: 256, semilla: 211 }));
  const texOrilla = R(ctx.texturas.cesped(0x4f7d3a, { tam: 256, semilla: 212 }));

  // Mallas del río (agua y orillas) que se rehacen en cada fotograma sin crear nada nuevo
  const posAgua = new Float32Array(FILAS * 2 * 3);
  const uvAgua = new Float32Array(FILAS * 2 * 2);
  const geoAgua = R(new THREE.BufferGeometry());
  geoAgua.setAttribute('position', new THREE.BufferAttribute(posAgua, 3).setUsage(THREE.DynamicDrawUsage));
  geoAgua.setAttribute('uv', new THREE.BufferAttribute(uvAgua, 2).setUsage(THREE.DynamicDrawUsage));
  geoAgua.setAttribute('normal', new THREE.BufferAttribute(new Float32Array(FILAS * 2 * 3).map((_, i) => (i % 3 === 1 ? 1 : 0)), 3));
  const indAgua = [];
  for (let i = 0; i < FILAS - 1; i++) {
    const a = i * 2;
    indAgua.push(a, a + 1, a + 2, a + 1, a + 3, a + 2); // caras hacia arriba
  }
  geoAgua.setIndex(indAgua);
  const agua = new THREE.Mesh(geoAgua, R(new THREE.MeshLambertMaterial({ map: texAgua, emissive: 0x0c2a38 })));
  agua.frustumCulled = false;
  raiz.add(agua);

  // Orillas: tres puntos por fila y lado (borde del agua, talud y prado)
  const PUNTOS_ORILLA = 6;
  const posOrilla = new Float32Array(FILAS * PUNTOS_ORILLA * 3);
  const uvOrilla = new Float32Array(FILAS * PUNTOS_ORILLA * 2);
  const geoOrilla = R(new THREE.BufferGeometry());
  geoOrilla.setAttribute('position', new THREE.BufferAttribute(posOrilla, 3).setUsage(THREE.DynamicDrawUsage));
  geoOrilla.setAttribute('uv', new THREE.BufferAttribute(uvOrilla, 2).setUsage(THREE.DynamicDrawUsage));
  const indOrilla = [];
  for (let i = 0; i < FILAS - 1; i++) {
    const a = i * PUNTOS_ORILLA;
    const b = a + PUNTOS_ORILLA;
    // Izquierda: 0 (agua) → 1 (talud) → 2 (prado); derecha: 3 → 4 → 5
    // (caras hacia arriba: el orden de los vértices cambia en cada orilla)
    for (const [p, q] of [[0, 1], [1, 2]]) indOrilla.push(a + p, b + p, a + q, a + q, b + p, b + q);
    for (const [p, q] of [[3, 4], [4, 5]]) indOrilla.push(a + p, a + q, b + p, a + q, b + q, b + p);
  }
  geoOrilla.setIndex(indOrilla);
  // Normales fijas: el talud mira hacia el río y hacia arriba; el prado, casi hacia arriba
  const norOrilla = new Float32Array(FILAS * PUNTOS_ORILLA * 3);
  for (let i = 0; i < FILAS; i++) {
    norOrilla.set([0.55, 0.83, 0, 0.45, 0.89, 0, 0.12, 0.99, 0, -0.55, 0.83, 0, -0.45, 0.89, 0, -0.12, 0.99, 0], i * PUNTOS_ORILLA * 3);
  }
  geoOrilla.setAttribute('normal', new THREE.BufferAttribute(norOrilla, 3));
  const orilla = new THREE.Mesh(geoOrilla, R(new THREE.MeshLambertMaterial({ map: texOrilla })));
  orilla.frustumCulled = false;
  raiz.add(orilla);

  // Árboles en las orillas (instancias que se recolocan al avanzar)
  const arbol = ctx.geometriaArbol('pino');
  const copas = new THREE.InstancedMesh(R(arbol.copa), R(new THREE.MeshLambertMaterial({ color: arbol.hojas, flatShading: true })), ARBOLES);
  const troncosArbol = new THREE.InstancedMesh(R(arbol.tronco), R(new THREE.MeshLambertMaterial({ color: arbol.madera })), ARBOLES);
  for (const m of [copas, troncosArbol]) {
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    raiz.add(m);
  }

  // ─── Obstáculos (grupos fijos que se reutilizan) ───────────────────────
  // Roca: un icosaedro con los vértices movidos
  const geoRoca = new THREE.IcosahedronGeometry(1, 1);
  const pr = geoRoca.attributes.position;
  for (let i = 0; i < pr.count; i++) {
    const f = 0.88 + hash(i * 7.3) * 0.22;
    pr.setXYZ(i, pr.getX(i) * f, pr.getY(i) * f * 0.8, pr.getZ(i) * f);
  }
  geoRoca.computeVertexNormals();
  const texRoca = R(ctx.texturas.grano(0x6f6a60, { tam: 128, semilla: 213 }));
  const rocasMalla = new THREE.InstancedMesh(R(geoRoca), R(new THREE.MeshLambertMaterial({ map: texRoca, flatShading: true })), MAX_ROCAS);
  // Tronco flotante: cilindro tumbado (largo 1 en x) con las puntas claras
  const texCorteza = R(ctx.texturas.madera(0x6b4a2e, { tam: 128, semilla: 214 }));
  const troncosMalla = new THREE.InstancedMesh(
    R(new THREE.CylinderGeometry(1, 1, 1, 10).rotateZ(Math.PI / 2)),
    R(new THREE.MeshLambertMaterial({ map: texCorteza })),
    MAX_TRONCOS,
  );
  // Espuma de los rápidos y flechas de las corrientes (planos sobre el agua)
  const texEspuma = R(ctx.texturaCanvas((g, tam, azarTex) => {
    g.clearRect(0, 0, tam, tam);
    for (let i = 0; i < 90; i++) {
      const x = tam / 2 + (azarTex() - 0.5) * tam * 0.8;
      const y = tam / 2 + (azarTex() - 0.5) * tam * 0.8;
      const r = 4 + azarTex() * 14;
      const grad = g.createRadialGradient(x, y, 0, x, y, r);
      grad.addColorStop(0, 'rgba(255,255,255,0.85)');
      grad.addColorStop(1, 'rgba(255,255,255,0)');
      g.fillStyle = grad;
      g.fillRect(x - r, y - r, r * 2, r * 2);
    }
  }, { tam: 128, semilla: 215 }));
  const espumaMalla = new THREE.InstancedMesh(
    R(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2)),
    R(new THREE.MeshBasicMaterial({ map: texEspuma, transparent: true, depthWrite: false })),
    MAX_ESPUMA,
  );
  const texFlecha = R(ctx.texturaCanvas((g, tam) => {
    g.clearRect(0, 0, tam, tam);
    g.strokeStyle = 'rgba(255,255,255,0.75)';
    g.lineWidth = tam * 0.09;
    g.lineCap = 'round';
    g.lineJoin = 'round';
    for (const x of [0.2, 0.55]) {
      g.beginPath();
      g.moveTo(tam * x, tam * 0.2);
      g.lineTo(tam * (x + 0.25), tam * 0.5);
      g.lineTo(tam * x, tam * 0.8);
      g.stroke();
    }
  }, { tam: 64, semilla: 216 }));
  texFlecha.wrapS = THREE.RepeatWrapping;
  const flechasMalla = new THREE.InstancedMesh(
    R(new THREE.PlaneGeometry(0.9, 0.5).rotateX(-Math.PI / 2)),
    R(new THREE.MeshBasicMaterial({ map: texFlecha, transparent: true, depthWrite: false, color: 0xbff4ff })),
    MAX_FLECHAS,
  );
  for (const m of [rocasMalla, troncosMalla, espumaMalla, flechasMalla]) {
    m.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
    m.frustumCulled = false;
    m.count = 0;
    raiz.add(m);
  }
  const rocas = Array.from({ length: MAX_ROCAS }, () => ({ activa: false, s: 0, x: 0, r: 0.4, giro: new THREE.Quaternion(), pasada: false }));
  const troncos = Array.from({ length: MAX_TRONCOS }, () => ({ activa: false, s: 0, x: 0, largo: 1, radio: 0.16, angulo: 0, fase: 0, pasada: false }));
  // Zonas: rápidos (más velocidad y sacudidas) y corrientes laterales (empujan hacia un lado)
  const zonas = Array.from({ length: MAX_ZONAS }, () => ({ activa: false, tipo: 'rapidos', s0: 0, s1: 0, empuje: 0, avisada: false }));

  // ─── La canoa ──────────────────────────────────────────────────────────
  // El grupo gira sobre el jugador (que va sentado en ella) y se mece con el agua
  const canoa = new THREE.Group();
  raiz.add(canoa);
  const largoCanoa = PROA + POPA;
  const centroCanoa = (POPA - PROA) / 2;
  const texCasco = R(ctx.texturas.tablas(0xc0562f, { tam: 256, tablas: 6, semilla: 217 }));
  const casco = new THREE.Mesh(
    R(new THREE.SphereGeometry(1, 24, 10, 0, Math.PI * 2, Math.PI / 2, Math.PI / 2).scale(MEDIA_CANOA + 0.04, 0.3, largoCanoa / 2)),
    R(new THREE.MeshLambertMaterial({ map: texCasco, side: THREE.DoubleSide })),
  );
  casco.position.set(0, 0.33, centroCanoa); // flota: el fondo del casco queda justo sobre el agua y el interior, seco
  const borde = [];
  for (let i = 0; i <= 40; i++) {
    const a = (i / 40) * Math.PI * 2;
    borde.push(new THREE.Vector3(Math.cos(a) * (MEDIA_CANOA + 0.04), 0, Math.sin(a) * largoCanoa / 2));
  }
  const matMadera = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.madera(0xa77a4c, { tam: 128, semilla: 218 })) }));
  const regala = new THREE.Mesh(R(new THREE.TubeGeometry(new THREE.CatmullRomCurve3(borde, true), 60, 0.022, 6, true)), matMadera);
  regala.position.set(0, 0.33, centroCanoa);
  const bancos = new THREE.Mesh(R(fusionar([
    new THREE.BoxGeometry(MEDIA_CANOA * 1.9, 0.03, 0.22).translate(0, 0.22, 0.35),
    new THREE.BoxGeometry(MEDIA_CANOA * 1.7, 0.03, 0.2).translate(0, 0.24, -1.25),
  ])), matMadera);
  canoa.add(casco, regala, bancos);
  const sombraCanoa = ctx.crearSombra({ radio: 0.9, opacidad: 0.3 });
  sombraCanoa.scale.set(0.5, 1, 1.8);
  sombraCanoa.position.set(0, AGUA_Y + 0.004, centroCanoa);
  raiz.add(sombraCanoa);

  // ─── Remos ─────────────────────────────────────────────────────────────
  const [geoMango, geoPala, puntaPala] = geometriaRemo();
  R(geoMango);
  R(geoPala);
  const matPala = R(new THREE.MeshLambertMaterial({ color: 0xf2c14e }));
  function crearRemo() {
    const grupo = new THREE.Group();
    grupo.add(new THREE.Mesh(geoMango, matMadera), new THREE.Mesh(geoPala, matPala));
    const punta = new THREE.Object3D();
    punta.position.copy(puntaPala);
    grupo.add(punta);
    return { grupo, punta };
  }
  // VR: uno en cada mano
  const remosVR = ctx.manos.map((mano) => {
    const remo = crearRemo();
    ctx.adjuntarAMano(mano, remo.grupo);
    return { mano, ...remo, pos: new THREE.Vector3(), antes: new THREE.Vector3(), listo: false, dentro: false, fuerza: 0, tVibra: 0, tEstela: 0 };
  });
  // Ratón y móvil: los dos remos a los lados de la canoa, que se mueven solos al remar
  const remosRaton = [-1, 1].map((lado) => {
    const remo = crearRemo();
    remo.grupo.position.set(lado * 0.5, 0.8, 0.15);
    canoa.add(remo.grupo);
    return { lado, ...remo, fase: 0, pos: new THREE.Vector3(), tVibra: 0, tEstela: 0 };
  });

  // ─── Marcador, en la proa ──────────────────────────────────────────────
  const panel = ctx.crearPanel({ ancho: 0.95, alto: 0.3 });
  panel.mesh.position.set(0, 0.92, -PROA + 0.15);
  panel.mesh.rotation.x = -0.35;
  canoa.add(panel.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  const nudoX = new Float32Array(NUDOS);    // centro del río en cada nudo
  const nudoAncho = new Float32Array(NUDOS);
  const nudoHueco = new Float32Array(NUDOS); // dónde está el paso seguro (respecto al centro)
  let ultimoNudo = 0;
  let estado = 'intro';        // 'intro' | 'juego' | 'vuelco' | 'fin'
  let reloj = 3;
  let tiempo = 0;
  let tiempoJuego = 0;
  let s = 0;                   // metros recorridos río abajo
  let x = 0;                   // posición lateral de la canoa
  let rumbo = 0;               // ángulo respecto a la corriente (positivo: hacia la derecha)
  let impulso = 0;             // velocidad extra de remar
  let actividadIzq = 0;        // lo remado con cada brazo en las últimas décimas (0-1)
  let actividadDer = 0;
  let casco100 = 0;            // daño del casco (0-100)
  let vidas = VIDAS;
  let maniobra = 1;            // baja un momento tras un choque
  let invulnerable = 0;
  let sacudida = 0;
  let vuelco = 0;
  let distanciaInicio = 0;
  let siguienteHito = 100;
  let record = ctx.leer('record', 0);
  let aviso = null;
  let ultimoGolpe = 0;
  let chapoteo = 0;
  const rio = ctx.sonidoContinuo('rio');
  const palada = ctx.sonidoContinuo('palada'); // el agua arrastrada por la pala
  let tEspuma = 0;
  const matriz = new THREE.Matrix4();
  const quat = new THREE.Quaternion();
  const escala = new THREE.Vector3();
  const pos = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const EJE_Y = new THREE.Vector3(0, 1, 0);

  const dificultad = () => Math.min(1, tiempoJuego / DIFICULTAD_MAX);
  const corriente = () => 2.1 + 3.3 * dificultad();
  const distancia = () => Math.max(0, Math.round(s - distanciaInicio));
  function avisar(texto, color, duracion = 1.5) { aviso = { texto, color, tiempo: duracion }; }

  // ─── Trazado del río ───────────────────────────────────────────────────
  const nudo = (k) => ((k % NUDOS) + NUDOS) % NUDOS;
  // Centro, anchura y hueco seguro interpolados suavemente entre nudos
  function enRio(sv, campo) {
    const k = Math.floor(sv / TRAMO);
    const f = suave(sv / TRAMO - k);
    const a = campo[nudo(k)];
    return a + (campo[nudo(k + 1)] - a) * f;
  }
  const centro = (sv) => enRio(sv, nudoX);
  const ancho = (sv) => enRio(sv, nudoAncho);

  function libre(lista) {
    for (const o of lista) if (!o.activa) return o;
    return null;
  }

  function ponerRoca(sv, desplazamiento, r) {
    const o = libre(rocas);
    if (!o) return;
    o.activa = true;
    o.s = sv;
    o.x = centro(sv) + desplazamiento;
    o.r = r;
    o.pasada = false;
    o.giro.setFromAxisAngle(EJE_Y, Math.random() * Math.PI * 2);
  }

  // Genera el tramo que empieza en el nudo k (y fija el nudo k + 1)
  function generarTramo(k) {
    const d = dificultad();
    const inicio = tiempoJuego < 14 && estado !== 'fin';
    const a = nudo(k);
    const b = nudo(k + 1);
    // Curvas: más cerradas con la dificultad, pero siempre alcanzables (la canoa recorre de lado
    // unos 3 m cada 10 m a rumbo máximo)
    const curva = azar(-1, 1) * (inicio ? 0.4 : 0.5 + 2.1 * d);
    const anchoMin = 3.3 - 1.0 * d;
    let tipo = 'calma';
    if (!inicio) {
      const r = Math.random();
      const pesos = [['calma', 0.22 - 0.14 * d], ['rocas', 0.32], ['tronco', 0.12 + 0.06 * d], ['rapidos', 0.1 + 0.08 * d],
        ['corriente', 0.08 + 0.08 * d], ['estrecho', 0.06 + 0.08 * d]];
      const total = pesos.reduce((n, [, p]) => n + p, 0);
      let acum = 0;
      for (const [nombre, p] of pesos) {
        acum += p / total;
        if (r <= acum) {
          tipo = nombre;
          break;
        }
      }
    } else if (k % 2 === 1) {
      tipo = 'rocas';
    }
    nudoX[b] = nudoX[a] + (tipo === 'estrecho' ? curva * 0.5 : curva);
    nudoAncho[b] = tipo === 'estrecho' ? Math.max(2.15, anchoMin - 0.5) : azar(anchoMin, 3.8);
    const medio = nudoAncho[b] / 2;
    // El paso seguro se mueve poco de un tramo al siguiente
    nudoHueco[b] = limitar(nudoHueco[a] + azar(-1.1, 1.1), -medio + HUECO / 2 + 0.15, medio - HUECO / 2 - 0.15);
    const hueco = nudoHueco[b];
    const s0 = k * TRAMO;
    const fueraDelHueco = (desp, r) => Math.abs(desp - hueco) > HUECO / 2 + r;

    if (tipo === 'rocas') {
      const n = inicio ? 1 : 1 + Math.floor(Math.random() * (1.5 + 2.5 * d));
      for (let i = 0; i < n; i++) {
        const r = azar(0.3, 0.55);
        for (let intento = 0; intento < 8; intento++) {
          const desp = azar(-medio + r * 0.6, medio - r * 0.6);
          if (fueraDelHueco(desp, r)) {
            ponerRoca(s0 + azar(2, TRAMO - 1), desp, r);
            break;
          }
        }
      }
    } else if (tipo === 'tronco') {
      // Cruza el río desde una orilla hasta el borde del paso seguro
      const o = libre(troncos);
      if (o) {
        const lado = hueco > 0 ? -1 : 1; // la orilla contraria al hueco
        const desde = lado * (medio + 0.4);
        const hasta = hueco + lado * (HUECO / 2 + 0.25); // acaba en el borde del paso seguro
        o.activa = true;
        o.s = s0 + TRAMO / 2;
        o.x = centro(o.s) + (desde + hasta) / 2;
        o.largo = Math.abs(hasta - desde);
        o.radio = azar(0.13, 0.19);
        o.angulo = azar(-0.25, 0.25);
        o.fase = Math.random() * 10;
        o.pasada = false;
      }
    } else if (tipo === 'rapidos' || tipo === 'corriente') {
      const z = libre(zonas);
      if (z) {
        z.activa = true;
        z.tipo = tipo;
        z.s0 = s0;
        z.s1 = s0 + TRAMO;
        z.avisada = false;
        // La corriente empuja hacia el lado contrario al paso seguro: hay que remar contra ella
        z.empuje = tipo === 'corriente' ? (hueco > 0 ? -1 : 1) * (0.55 + 0.75 * d) : 0;
      }
      // En los rápidos, alguna roca suelta (lejos del paso)
      if (tipo === 'rapidos' && d > 0.3) {
        const r = azar(0.28, 0.4);
        const desp = hueco > 0 ? -medio + r : medio - r;
        if (fueraDelHueco(desp, r)) ponerRoca(s0 + azar(3, TRAMO - 2), desp, r);
      }
    }
  }

  // Genera tramos hasta tener el río trazado más allá de lo que se ve
  function generarHasta(sv) {
    while (ultimoNudo * TRAMO < sv) {
      generarTramo(ultimoNudo);
      ultimoNudo++;
    }
  }

  function reiniciarRio() {
    for (const o of rocas) o.activa = false;
    for (const o of troncos) o.activa = false;
    for (const z of zonas) z.activa = false;
    ultimoNudo = Math.floor(s / TRAMO) - 2;
    for (let k = ultimoNudo - 1; k <= ultimoNudo + 1; k++) {
      nudoX[nudo(k)] = x;
      nudoAncho[nudo(k)] = 3.6;
      nudoHueco[nudo(k)] = 0;
    }
    generarHasta(s + VISTA);
  }

  // ─── Choques ───────────────────────────────────────────────────────────
  // Punto de la canoa más cercano a (px, ps) y su distancia
  const eje = { x: 0, s: 0 };
  function distanciaACanoa(px, ps) {
    const dx = Math.sin(rumbo);
    const ds = Math.cos(rumbo);
    const t = limitar((px - x) * dx + (ps - s) * ds, -POPA, PROA);
    eje.x = x + dx * t;
    eje.s = s + ds * t;
    return Math.hypot(px - eje.x, ps - eje.s);
  }

  function golpe(fuerza, lateral, texto) {
    if (invulnerable > 0 || estado !== 'juego') return;
    const v = corriente() + impulso;
    invulnerable = 1.1;
    maniobra = 0.4;
    sacudida = 0.5;
    impulso = Math.min(impulso, 0) - v * 0.45 * fuerza; // frena (puede quedar por debajo de la corriente)
    x += lateral * 0.25;
    rumbo *= -0.4;
    casco100 += (16 + v * 6) * fuerza;
    ultimoGolpe = tiempo;
    const grave = fuerza >= 1 && v > 6.6;
    const mano = remosVR.find((r) => r.mano.activa)?.mano || null;
    tmp.set(0, AGUA_Y + 0.3, -PROA);
    ctx.efectos.impacto(grave || casco100 >= 100 ? 'grande' : 'medio', { pos: tmp, color: 0xd7ccc8, sonido: 'impacto' });
    for (const r of remosVR) ctx.vibrar(r.mano, 0.9, 200);
    ctx.efectos.estallido(tmp, { color: 0xe3f6ff, cantidad: 18, fuerza: 1.8, gravedad: 5 });
    if (grave || casco100 >= 100) {
      volcar();
      return;
    }
    avisar(texto, '#ffab91', 1.4);
    if (mano) ctx.vibrar(mano, 1, 250);
  }

  function volcar() {
    estado = 'vuelco';
    vuelco = 0;
    vidas--;
    casco100 = 100;
    ctx.sonido('caida');
    ctx.sonido('plof');
    ctx.destello(0x2b6e8a, 0.45);
    avisar(ctx.t('volcado'), '#ff8a80', 2);
  }

  function reaparecer() {
    if (vidas <= 0) {
      terminar();
      return;
    }
    estado = 'juego';
    casco100 = 0;
    rumbo = 0;
    impulso = 0;
    invulnerable = 2.5;
    maniobra = 1;
    canoa.rotation.z = 0;
    // Vuelve al paso seguro y se despejan los próximos metros
    x = centro(s + 3) + enRio(s + 3, nudoHueco);
    for (const o of rocas) if (o.activa && o.s > s - 2 && o.s < s + 14) o.activa = false;
    for (const o of troncos) if (o.activa && o.s > s - 2 && o.s < s + 14) o.activa = false;
    avisar(ctx.t('otraVez', { n: vidas }), '#b3e5fc', 1.6);
  }

  function comprobarChoques() {
    // Rocas y troncos
    for (const o of rocas) {
      if (!o.activa || Math.abs(o.s - s) > PROA + 2) continue;
      const dist = distanciaACanoa(o.x, o.s);
      if (dist < o.r + MEDIA_CANOA) {
        golpe(1, Math.sign(x - o.x) || 1, ctx.t('roca'));
        return;
      }
    }
    for (const o of troncos) {
      if (!o.activa || Math.abs(o.s - s) > PROA + o.largo) continue;
      // El tronco como una fila de círculos
      const pasos = Math.max(2, Math.ceil(o.largo / 0.25));
      for (let i = 0; i <= pasos; i++) {
        const u = (i / pasos - 0.5) * o.largo;
        const px = o.x + Math.cos(o.angulo) * u;
        const ps = o.s + Math.sin(o.angulo) * u;
        if (distanciaACanoa(px, ps) < o.radio + MEDIA_CANOA) {
          golpe(1, Math.sign(x - px) || 1, ctx.t('tronco'));
          return;
        }
      }
    }
    // Orillas: la proa y la popa no pueden salirse del agua
    for (const t of [PROA, -POPA * 0.6]) {
      const px = x + Math.sin(rumbo) * t;
      const ps = s + Math.cos(rumbo) * t;
      const desp = px - centro(ps);
      const limite = ancho(ps) / 2 - 0.12;
      if (Math.abs(desp) > limite) {
        const lado = Math.sign(desp);
        x -= lado * (Math.abs(desp) - limite + 0.05);
        rumbo = -lado * 0.15;
        if (invulnerable <= 0) golpe(0.6, -lado, ctx.t('orilla'));
        return;
      }
    }
  }

  // Al dejar atrás un obstáculo muy de cerca: «¡Por poco!»
  function comprobarPorPoco() {
    for (const o of rocas) {
      if (!o.activa || o.pasada || o.s > s) continue;
      o.pasada = true;
      if (tiempo - ultimoGolpe > 1 && Math.abs(o.x - x) < o.r + MEDIA_CANOA + 0.35) {
        tmp.set(o.x - x, AGUA_Y + 0.5, 0);
        ctx.efectos.texto(tmp, ctx.t('porPoco'), { color: '#b9f6ca', tam: 0.9, vida: 0.8 });
        ctx.efectos.impacto('pequeño', { color: 0xb9f6ca });
        ctx.sonido('zas');
      }
    }
  }

  // ─── Remar ─────────────────────────────────────────────────────────────
  // El agua «agarra» la pala: mientras está dentro y va hacia atrás, empuja de forma progresiva (no de
  // golpe), con una vibración suave y continua que se nota como resistencia, el sonido del agua
  // arrastrada y una estela detrás de la pala. La entrada en el agua es suave.
  function sentirPalada(r, mano, fuerza, dt, entra) {
    if (entra) {
      tmp.set(r.pos.x, AGUA_Y + 0.02, r.pos.z);
      ctx.efectos.estallido(tmp, { color: 0xe3f6ff, cantidad: 4, fuerza: 0.45, gravedad: 4, vida: 0.35, tam: 0.016 });
      ctx.sonido('remo');
    }
    r.tVibra -= dt;
    r.tEstela -= dt;
    if (fuerza > 0.05 && r.tVibra <= 0 && mano) {
      ctx.vibrar(mano, 0.08 + fuerza * 0.3, 45);
      r.tVibra = 0.05;
    }
    if (fuerza > 0.2 && r.tEstela <= 0) {
      // Remolino detrás de la pala, a ras de agua
      tmp.set(r.pos.x, AGUA_Y + 0.015, r.pos.z + 0.08);
      ctx.efectos.estallido(tmp, { color: 0xd8f1ff, cantidad: 2 + Math.round(fuerza * 3), fuerza: 0.25, gravedad: 0.5, vida: 0.5, tam: 0.014 });
      r.tEstela = 0.07;
    }
  }

  // VR: cuenta la pala dentro del agua yendo hacia atrás (cuanto más rápido, más fuerza)
  function remarVR(dt) {
    let izq = 0;
    let der = 0;
    for (const r of remosVR) {
      if (!r.mano.activa) {
        r.listo = false;
        r.fuerza = 0;
        continue;
      }
      r.punta.getWorldPosition(r.pos);
      if (!r.listo) {
        r.antes.copy(r.pos);
        r.listo = true;
      }
      const atras = (r.pos.z - r.antes.z) / Math.max(dt, 1e-3);
      const dentro = r.pos.y < AGUA_Y + 0.2;
      const entra = dentro && !r.dentro && chapoteo <= 0;
      if (entra) chapoteo = 0.12;
      r.dentro = dentro;
      // Fuerza progresiva: sube mientras tiras y baja al soltar (como el agua al apoyar la pala)
      const objetivo = dentro ? limitar((atras - 0.12) / 1.1, 0, 1) : 0;
      r.fuerza += (objetivo - r.fuerza) * Math.min(1, dt * (objetivo > r.fuerza ? 9 : 14));
      sentirPalada(r, r.mano, r.fuerza, dt, entra);
      if (r.mano.lado === 'left' || (!r.mano.lado && r === remosVR[0])) izq = Math.max(izq, r.fuerza);
      else der = Math.max(der, r.fuerza);
      r.antes.copy(r.pos);
    }
    palada.ajustar(Math.max(izq, der), Math.max(izq, der) * 0.22);
    return [izq, der];
  }

  // Ratón y móvil: pulsado a un lado, en el otro o en el centro, los remos reman solos a ritmo
  function remarRaton(dt) {
    const r = ctx.raton;
    let lado = 0; // -1 izquierda, 1 derecha, 2 los dos
    if (r.pulsado && estado === 'juego') lado = r.ndc.x < -0.3 ? -1 : r.ndc.x > 0.3 ? 1 : 2;
    let izq = 0;
    let der = 0;
    for (const remo of remosRaton) {
      const rema = lado === 2 || lado === remo.lado;
      const antes = remo.fase;
      if (rema || remo.fase % 1 > 0.02) remo.fase += dt / 0.8; // termina la palada empezada
      const f = remo.fase % 1;
      // Palada: la pala entra por delante, va hacia atrás dentro del agua y sale por el aire
      const enAgua = f < 0.6;
      const u = enAgua ? f / 0.6 : (f - 0.6) / 0.4;
      remo.grupo.rotation.x = enAgua ? 0.55 - suave(u) * 1.1 : -0.55 + suave(u) * 1.1;
      remo.grupo.rotation.z = remo.lado * (enAgua ? 0.35 : 0.6);
      remo.grupo.position.y = enAgua ? 0.8 : 0.95;
      // En el agua, la fuerza crece y decae a lo largo de la palada (más en el centro)
      const fuerza = enAgua && rema ? 0.25 + 0.7 * Math.sin(u * Math.PI) : 0;
      if (remo.lado < 0) izq = fuerza;
      else der = fuerza;
      remo.punta.getWorldPosition(remo.pos);
      const entra = rema && f < 0.6 && (Math.floor(antes) !== Math.floor(remo.fase) || antes % 1 >= 0.6);
      sentirPalada(remo, null, fuerza, dt, entra && chapoteo <= 0);
      if (entra) chapoteo = 0.1;
    }
    palada.ajustar(Math.max(izq, der), Math.max(izq, der) * 0.22);
    return [izq, der];
  }

  function moverCanoa(dt, izq, der) {
    // Lo remado en las últimas décimas: tolera que los dos brazos no vayan a la vez
    actividadIzq = Math.max(actividadIzq * Math.exp(-dt / 0.4), izq);
    actividadDer = Math.max(actividadDer * Math.exp(-dt / 0.4), der);
    const ambos = Math.min(actividadIzq, actividadDer);
    let giro = actividadIzq - actividadDer;
    if (Math.abs(giro) < 0.18) giro = 0; // casi iguales: recto
    // Velocidad: con los dos brazos se acumula palada a palada (hasta +3,6 m/s); con uno solo, poco.
    // Sin remar, se pierde despacio
    impulso += (ambos * 4.6 + (actividadIzq + actividadDer) * 0.3) * dt;
    impulso = Math.min(impulso, 3.6);
    impulso += (0 - impulso) * (1 - Math.exp(-dt * 0.32));
    // Giro: remar con la izquierda gira a la izquierda (rumbo negativo)
    rumbo += -giro * 1.5 * maniobra * dt;
    // Sin remar de un lado, la corriente endereza la canoa poco a poco
    if (giro === 0) rumbo *= Math.exp(-dt * (ambos > 0.1 ? 0.9 : 0.55));
    rumbo = limitar(rumbo, -RUMBO_MAX, RUMBO_MAX);
    maniobra = Math.min(1, maniobra + dt * 0.35);

    // Zonas: rápidos y corrientes laterales
    let extra = 0;
    let empuje = 0;
    let enRapidos = 0;
    for (const z of zonas) {
      if (!z.activa || s < z.s0 || s > z.s1) continue;
      if (z.tipo === 'rapidos') {
        extra += 1.2;
        enRapidos = 1;
        empuje += Math.sin(tiempo * 2.3 + z.s0) * 0.55 + Math.sin(tiempo * 5.1) * 0.25;
      } else {
        empuje += z.empuje;
      }
    }
    const v = Math.max(0.6, corriente() + impulso + extra);
    s += Math.cos(rumbo) * v * dt;
    x += (Math.sin(rumbo) * v + empuje) * dt;
    return { v, enRapidos };
  }

  // ─── Dibujo del río ────────────────────────────────────────────────────
  function dibujarRio() {
    for (let i = 0; i < FILAS; i++) {
      const d = DESDE + i * PASO_FILA;
      const sv = s + d;
      const c = centro(sv) - x;
      const m = ancho(sv) / 2;
      const z = -d;
      posAgua.set([c - m - 0.4, AGUA_Y, z, c + m + 0.4, AGUA_Y, z], i * 6);
      uvAgua.set([0, sv / 5, (m * 2 + 0.8) / 4, sv / 5], i * 4);
      // Orillas: borde del agua (algo hundido), talud y prado
      const o = i * PUNTOS_ORILLA * 3;
      posOrilla.set([
        c - m, AGUA_Y - 0.12, z, c - m - 1.1, AGUA_Y + 0.55, z, c - m - 9, AGUA_Y + 1.5, z,
        c + m, AGUA_Y - 0.12, z, c + m + 1.1, AGUA_Y + 0.55, z, c + m + 9, AGUA_Y + 1.5, z,
      ], o);
      const u = i * PUNTOS_ORILLA * 2;
      uvOrilla.set([0, sv / 3, 0.4, sv / 3, 3, sv / 3, 0, sv / 3, 0.4, sv / 3, 3, sv / 3], u);
    }
    geoAgua.attributes.position.needsUpdate = true;
    geoAgua.attributes.uv.needsUpdate = true;
    geoOrilla.attributes.position.needsUpdate = true;
    geoOrilla.attributes.uv.needsUpdate = true;
    texAgua.offset.y = -(tiempo * 0.15) % 1;

    // Árboles: cada 7 m por cada orilla, siempre en el mismo sitio del río
    const primero = Math.floor((s + DESDE) / 7);
    let n = 0;
    for (let j = 0; n < ARBOLES - 1 && j < 40; j++) {
      const k = primero + j;
      const sv = k * 7 + hash(k) * 4;
      if (sv > s + VISTA) break;
      for (const lado of [-1, 1]) {
        const h = hash(k * 2 + (lado > 0 ? 1 : 0));
        const ax = centro(sv) - x + lado * (ancho(sv) / 2 + 2 + h * 5);
        pos.set(ax, AGUA_Y + 0.7 + h * 0.4, -(sv - s));
        quat.setFromAxisAngle(EJE_Y, h * 6);
        escala.setScalar(1.6 + h * 1.4);
        matriz.compose(pos, quat, escala);
        copas.setMatrixAt(n, matriz);
        troncosArbol.setMatrixAt(n, matriz);
        n++;
      }
    }
    copas.count = troncosArbol.count = n;
    copas.instanceMatrix.needsUpdate = troncosArbol.instanceMatrix.needsUpdate = true;
  }

  function dibujarObstaculos() {
    let n = 0;
    for (const o of rocas) {
      if (!o.activa) continue;
      if (o.s < s - 12) {
        o.activa = false;
        continue;
      }
      pos.set(o.x - x, AGUA_Y - o.r * 0.25, -(o.s - s));
      escala.setScalar(o.r);
      rocasMalla.setMatrixAt(n++, matriz.compose(pos, o.giro, escala));
    }
    rocasMalla.count = n;
    n = 0;
    for (const o of troncos) {
      if (!o.activa) continue;
      if (o.s < s - 12) {
        o.activa = false;
        continue;
      }
      // Flota: se mece un poco
      pos.set(o.x - x, AGUA_Y + Math.sin(tiempo * 1.6 + o.fase) * 0.025, -(o.s - s));
      quat.setFromAxisAngle(EJE_Y, o.angulo);
      escala.set(o.largo, o.radio, o.radio);
      troncosMalla.setMatrixAt(n++, matriz.compose(pos, quat, escala));
    }
    troncosMalla.count = n;
    // Espuma de los rápidos y flechas de las corrientes
    let e = 0;
    let f = 0;
    for (const z of zonas) {
      if (!z.activa) continue;
      if (z.s1 < s - 12) {
        z.activa = false;
        continue;
      }
      for (let i = 0; i < 4; i++) {
        const sv = z.s0 + 1.2 + i * 2.6;
        const m = ancho(sv) / 2;
        if (z.tipo === 'rapidos') {
          for (let k = 0; k < 2 && e < MAX_ESPUMA; k++) {
            pos.set(centro(sv) - x + (k ? 0.5 : -0.5) * m, AGUA_Y + 0.02, -(sv - s));
            quat.setFromAxisAngle(EJE_Y, i * 1.3 + k);
            escala.set(m * 1.1, 1, 2.2);
            espumaMalla.setMatrixAt(e++, matriz.compose(pos, quat, escala));
          }
        } else if (f < MAX_FLECHAS) {
          for (let k = -1; k <= 1 && f < MAX_FLECHAS; k++) {
            pos.set(centro(sv) - x + k * m * 0.55, AGUA_Y + 0.025, -(sv - s));
            quat.setFromAxisAngle(EJE_Y, z.empuje > 0 ? 0 : Math.PI);
            escala.setScalar(1);
            flechasMalla.setMatrixAt(f++, matriz.compose(pos, quat, escala));
          }
        }
      }
    }
    espumaMalla.count = e;
    flechasMalla.count = f;
    texFlecha.offset.x = -(tiempo * 1.2) % 1;
    for (const m of [rocasMalla, troncosMalla, espumaMalla, flechasMalla]) m.instanceMatrix.needsUpdate = true;
  }

  // ─── Marcador ──────────────────────────────────────────────────────────
  function escribirMarcador() {
    let lineas;
    if (estado === 'intro') {
      lineas = [{ texto: ctx.t('titulo'), tam: 1.2, color: '#ffe082' },
        { texto: ctx.t(ctx.enVR() ? 'introVR' : ctx.tactil ? 'introTactil' : 'introRaton'), tam: 0.6, color: '#e1f5fe' }];
    } else if (estado === 'fin') {
      lineas = [{ texto: ctx.t('fin', { n: distancia() }), tam: 1.1, color: '#ffe082' },
        { texto: ctx.t('partida.recordNuevaPartida', { record, n: Math.ceil(reloj) }), tam: 0.66 }];
    } else {
      const corazones = '♥'.repeat(Math.max(0, vidas)) + '♡'.repeat(VIDAS - Math.max(0, vidas));
      const sano = Math.round((100 - Math.min(100, casco100)) / 20);
      const barra = '▮'.repeat(sano) + '▯'.repeat(5 - sano);
      lineas = [{ texto: ctx.t('marcador', { n: distancia(), vidas: corazones }), tam: 1.1, color: '#ffffff' },
        aviso ? { texto: aviso.texto, tam: 0.75, color: aviso.color }
          : { texto: ctx.t('casco', { barra, record }), tam: 0.66, color: casco100 > 60 ? '#ffab91' : '#c8e6c9' }];
    }
    panel.escribir(lineas);
  }

  function terminar() {
    estado = 'fin';
    reloj = 6;
    const metros = distancia();
    ctx.puntuacion(metros); // a la clasificación (juegos/marcadores.js): metros recorridos
    if (metros > record) {
      record = metros;
      ctx.guardar('record', record);
    }
    ctx.sonido('fin');
    canoa.rotation.z = 0;
  }

  function empezar() {
    estado = 'juego';
    tiempoJuego = 0;
    vidas = VIDAS;
    casco100 = 0;
    impulso = 0;
    rumbo = 0;
    maniobra = 1;
    invulnerable = 1;
    distanciaInicio = s;
    siguienteHito = 100;
    aviso = null;
    reiniciarRio();
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function actualizar(dt) {
    tiempo += dt;
    reloj -= dt;
    chapoteo -= dt;
    invulnerable = Math.max(0, invulnerable - dt);
    if (aviso && (aviso.tiempo -= dt) <= 0) aviso = null;
    if (estado === 'intro' && reloj <= 0) empezar();
    else if (estado === 'fin' && reloj <= 0) empezar();

    const [izq, der] = ctx.enVR() ? remarVR(dt) : remarRaton(dt);
    for (const r of remosRaton) r.grupo.visible = !ctx.enVR();

    let v = 0;
    let enRapidos = 0;
    if (estado === 'vuelco') {
      // La canoa da la vuelta y se hunde un poco; después, a seguir
      vuelco += dt;
      canoa.rotation.z = Math.min(Math.PI, vuelco * 3);
      s += corriente() * 0.3 * dt;
      if (vuelco > 1.6) reaparecer();
    } else {
      ({ v, enRapidos } = moverCanoa(dt, estado === 'juego' ? izq : 0, estado === 'juego' ? der : 0));
      if (estado === 'juego') {
        tiempoJuego += dt;
        comprobarChoques();
        comprobarPorPoco();
        // Cada 100 m, un aviso de lo lejos que has llegado
        if (distancia() >= siguienteHito) {
          tmp.set(0, AGUA_Y + 0.9, -PROA - 0.6);
          ctx.efectos.texto(tmp, ctx.t('hito', { n: siguienteHito }), { color: '#ffe082', tam: 1.3 });
          ctx.efectos.impacto(siguienteHito % 500 === 0 ? 'medio' : 'pequeño', { pos: tmp, color: 0xffe082, sonido: 'punto' });
          if (record > 0 && siguienteHito > record && siguienteHito - 100 <= record) avisar(ctx.t('partida.nuevoRecord'), '#ffe082', 2);
          siguienteHito += 100;
        }
        // Aviso de las zonas que llegan
        for (const z of zonas) {
          if (!z.activa || z.avisada || z.s0 - s > 22) continue;
          z.avisada = true;
          avisar(ctx.t(z.tipo === 'rapidos' ? 'rapidos' : 'corriente'), '#b3e5fc', 1.4);
        }
      }
    }
    generarHasta(s + VISTA);

    // La canoa: gira un poco hacia donde va (sin girar el mundo), se mece y tiembla al chocar
    sacudida = Math.max(0, sacudida - dt * 1.5);
    canoa.rotation.y = -rumbo * 0.6;
    canoa.position.y = AGUA_Y + Math.sin(tiempo * 1.7) * 0.012 + enRapidos * Math.sin(tiempo * 9) * 0.02;
    if (estado !== 'vuelco') canoa.rotation.z = Math.sin(tiempo * 1.3) * 0.02 + sacudida * Math.sin(tiempo * 40) * 0.08 + enRapidos * Math.sin(tiempo * 7) * 0.03;
    // Parpadea mientras es invulnerable tras volver a empezar
    casco.visible = !(estado === 'juego' && invulnerable > 1.2 && Math.floor(tiempo * 8) % 2 === 0);
    sombraCanoa.rotation.y = canoa.rotation.y;

    dibujarRio();
    dibujarObstaculos();
    rio.ajustar(Math.min(1, v / 8 + enRapidos * 0.4), 0.05 + Math.min(0.2, v * 0.015) + enRapidos * 0.12);
    // Con impulso de remar, la proa levanta espuma a los dos lados (más cuanto más rápido)
    tEspuma -= dt;
    if (estado === 'juego' && impulso > 0.6 && tEspuma <= 0) {
      for (const lado of [-1, 1]) {
        tmp.set(lado * 0.3 + Math.sin(rumbo * 0.6) * PROA, AGUA_Y + 0.03, -PROA * Math.cos(rumbo * 0.6) + 0.15);
        ctx.efectos.estallido(tmp, { color: 0xf2fbff, cantidad: 1 + Math.round(impulso), fuerza: 0.5 + impulso * 0.25, gravedad: 3, vida: 0.45, tam: 0.016 });
      }
      tEspuma = 0.08;
    }
    escribirMarcador();
  }

  // Río tranquilo al empezar
  reiniciarRio();
  dibujarRio();
  escribirMarcador();

  return {
    actualizar,
    liberar() {
      // La shell retira lo que hay en la escena y en las manos, los recursos registrados y el sonido del río.
      for (const m of [copas, troncosArbol, rocasMalla, troncosMalla, espumaMalla, flechasMalla]) m.dispose();
    },
  };
}
