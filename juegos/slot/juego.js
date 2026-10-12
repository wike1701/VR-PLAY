// CIRCUITO SLOT
// Una pista de coches de slot sobre una mesa, vista desde arriba como en casa:
// estás de pie al borde de la mesa con el mando en la mano. Los coches van
// guiados por la ranura, así que solo controlas la velocidad. Si entras en una
// curva demasiado rápido, el coche derrapa y sale volando de la pista; al rato
// vuelve a su carril, parado. Carrera de 5 vueltas contra un rival en el otro carril.
// En VR el gatillo es analógico, como el del mando de verdad: cuanto más aprietas,
// más corre. Con ratón o con el dedo: mantén pulsado para acelerar y suelta para frenar.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const VUELTAS = 5;
const Y_MESA = 0.8;
const Z_MESA = -1.25;          // centro de la mesa (el jugador está en z = 0)
const ANCHO_PISTA = 0.24;
const SEPARACION = 0.05;       // de la línea central a cada ranura
const N = 1200;                // puntos del trazado
// Trazado (x, z respecto al centro de la mesa): recta de meta delante del jugador,
// horquilla a la derecha, curvas enlazadas al fondo y curva larga a la izquierda.
const TRAZADO = [
  [-0.6, 0.52], [0.4, 0.52], [0.95, 0.48], [1.22, 0.12], [1.08, -0.33], [0.65, -0.5],
  [0.25, -0.3], [-0.15, -0.2], [-0.55, -0.45], [-1.0, -0.5], [-1.24, -0.1], [-1.05, 0.38],
];
// Física del coche (metros y segundos, a escala de la pista)
const VELOCIDAD_MAX = 2.9;
const ACELERACION = 7;
const FRENO_MOTOR = 6;         // al soltar el mando el motor frena
const AGARRE = 6;              // aceleración lateral que aguantan el imán y las ruedas
const LIMITE_DERRAPE = 0.35;
const TIEMPO_FUERA = 1.6;      // lo que tarda en volver a la pista
// Rival
const FRENO_PREVISTO = 4.5;

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  ctx.fondo(0x30384a);
  // Sin gafas, de pie junto a la mesa. Con la pantalla en vertical (móvil) la mesa no
  // cabe a lo ancho: entonces se ve más desde arriba, como asomado sobre la pista.
  let vistaVertical = null;
  function ajustarVista() {
    const vertical = ctx.camara.aspect < 1;
    if (vertical === vistaVertical) return;
    vistaVertical = vertical;
    ctx.vistaEscritorio(
      vertical ? new THREE.Vector3(0, 3.1, -0.3) : new THREE.Vector3(0, 1.75, 0.3),
      new THREE.Vector3(0, Y_MESA, Z_MESA + (vertical ? 0 : 0.05)),
    );
  }
  ajustarVista();

  // Junta varias geometrías ya colocadas en una sola (una llamada de dibujo).
  function fusionar(geos) {
    const partes = geos.map((g) => (g.index ? g.toNonIndexed() : g));
    const total = partes.reduce((n, g) => n + g.attributes.position.count, 0);
    const res = new THREE.BufferGeometry();
    for (const nombre of ['position', 'normal', 'uv']) {
      const tam = partes[0].attributes[nombre].itemSize;
      const datos = new Float32Array(total * tam);
      let o = 0;
      for (const g of partes) {
        datos.set(g.attributes[nombre].array, o);
        o += g.attributes[nombre].array.length;
      }
      res.setAttribute(nombre, new THREE.BufferAttribute(datos, tam));
    }
    for (const g of [...geos, ...partes]) g.dispose();
    return res;
  }

  // ─── Trazado y carriles ────────────────────────────────────────────────
  const curva = new THREE.CatmullRomCurve3(TRAZADO.map(([x, z]) => new THREE.Vector3(x, 0, z + Z_MESA)), true, 'centripetal');
  const centro = curva.getSpacedPoints(N).slice(0, N);
  const tangentes = centro.map((p, i) => centro[(i + 1) % N].clone().sub(centro[(i - 1 + N) % N]).normalize());
  // Normal hacia la izquierda de la marcha (en la recta de meta, hacia el jugador)
  const normales = tangentes.map((t) => new THREE.Vector3(-t.z, 0, t.x));

  function crearCarril(desvio) {
    const puntos = centro.map((p, i) => p.clone().addScaledVector(normales[i], desvio));
    const acumulado = new Float32Array(N + 1);
    for (let i = 0; i < N; i++) acumulado[i + 1] = acumulado[i] + puntos[i].distanceTo(puntos[(i + 1) % N]);
    const largo = acumulado[N];
    // Curvatura con signo (positiva si gira hacia la normal) y velocidad máxima en cada punto
    const curvatura = new Float32Array(N);
    const maxima = new Float32Array(N);
    for (let i = 0; i < N; i++) {
      const a = puntos[(i - 4 + N) % N];
      const b = puntos[i];
      const c = puntos[(i + 4) % N];
      const ab = b.clone().sub(a);
      const bc = c.clone().sub(b);
      const angulo = Math.atan2(ab.x * bc.z - ab.z * bc.x, ab.dot(bc));
      curvatura[i] = angulo / ((ab.length() + bc.length()) / 2);
      maxima[i] = Math.min(VELOCIDAD_MAX, Math.sqrt(AGARRE / Math.max(1e-4, Math.abs(curvatura[i]))));
    }
    // Perfil de velocidad para la máquina: frena a tiempo antes de cada curva
    const perfil = Float32Array.from(maxima);
    for (let vuelta = 0; vuelta < 2; vuelta++) {
      for (let i = N - 1; i >= 0; i--) {
        const j = (i + 1) % N;
        const ds = acumulado[i + 1] - acumulado[i];
        perfil[i] = Math.min(perfil[i], Math.sqrt(perfil[j] * perfil[j] + 2 * FRENO_PREVISTO * ds));
      }
    }
    return { desvio, puntos, acumulado, largo, curvatura, maxima, perfil };
  }
  const carriles = [crearCarril(SEPARACION), crearCarril(-SEPARACION)];

  // Índice del punto del carril a la distancia s (búsqueda binaria)
  function indice(carril, s) {
    const a = carril.acumulado;
    let lo = 0;
    let hi = N;
    while (hi - lo > 1) {
      const m = (lo + hi) >> 1;
      if (a[m] <= s) lo = m; else hi = m;
    }
    return lo;
  }
  function posicion(carril, s, destino, direccion) {
    s = ((s % carril.largo) + carril.largo) % carril.largo;
    const i = indice(carril, s);
    const j = (i + 1) % N;
    const f = (s - carril.acumulado[i]) / Math.max(1e-6, carril.acumulado[i + 1] - carril.acumulado[i]);
    destino.lerpVectors(carril.puntos[i], carril.puntos[j], f);
    if (direccion) direccion.subVectors(carril.puntos[j], carril.puntos[i]).normalize();
    return i;
  }

  // ─── Habitación y mesa ─────────────────────────────────────────────────
  ctx.sueloBase(false);
  const suelo = new THREE.Mesh(
    R(new THREE.PlaneGeometry(8, 8).rotateX(-Math.PI / 2)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tablas(0xa0714a, { tablas: 8, repetir: [4, 4], semilla: 31 })) })),
  );
  suelo.position.z = -1.5;
  raiz.add(suelo);

  const ANCHO_MESA = 2.95;
  const FONDO_MESA = 1.55;
  const mesa = new THREE.Mesh(
    R(fusionar([
      new THREE.BoxGeometry(ANCHO_MESA + 0.08, 0.05, FONDO_MESA + 0.08).translate(0, Y_MESA - 0.035, Z_MESA),
      ...[[-1, -1], [1, -1], [-1, 1], [1, 1]].map(([sx, sz]) => new THREE.BoxGeometry(0.07, Y_MESA - 0.06, 0.07)
        .translate(sx * (ANCHO_MESA / 2 - 0.08), (Y_MESA - 0.06) / 2, Z_MESA + sz * (FONDO_MESA / 2 - 0.08))),
    ])),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.madera(0x6d4426, { semilla: 32 })) })),
  );
  raiz.add(mesa);
  // Tablero verde (como el césped de las maquetas)
  const tablero = new THREE.Mesh(
    R(new THREE.PlaneGeometry(ANCHO_MESA, FONDO_MESA).rotateX(-Math.PI / 2)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.cesped(0x3f8f3a, { repetir: [3, 2], semilla: 33 })) })),
  );
  tablero.position.set(0, Y_MESA - 0.009, Z_MESA);
  raiz.add(tablero);

  // ─── Pista: cinta de asfalto con las dos ranuras y bordes a rayas ──────
  // Construye una cinta a lo largo del trazado entre dos desvíos de la línea central.
  function cinta(desde, hasta, y, metrosPorRepeticion) {
    const pos = [];
    const uv = [];
    let recorrido = 0;
    const p = (i) => centro[i % N];
    const n = (i) => normales[i % N];
    for (let i = 0; i < N; i++) {
      const largo = p(i).distanceTo(p(i + 1));
      const v0 = recorrido / metrosPorRepeticion;
      const v1 = (recorrido + largo) / metrosPorRepeticion;
      recorrido += largo;
      const a0 = p(i).clone().addScaledVector(n(i), desde);
      const b0 = p(i).clone().addScaledVector(n(i), hasta);
      const a1 = p(i + 1).clone().addScaledVector(n(i + 1), desde);
      const b1 = p(i + 1).clone().addScaledVector(n(i + 1), hasta);
      // Dos triángulos mirando hacia arriba
      for (const [q, u, v] of [[a0, 0, v0], [a1, 0, v1], [b0, 1, v0], [b0, 1, v0], [a1, 0, v1], [b1, 1, v1]]) {
        pos.push(q.x, y, q.z);
        uv.push(u, v);
      }
    }
    const g = new THREE.BufferGeometry();
    g.setAttribute('position', new THREE.Float32BufferAttribute(pos, 3));
    g.setAttribute('uv', new THREE.Float32BufferAttribute(uv, 2));
    g.computeVertexNormals();
    // Que todas las caras miren hacia arriba
    const nor = g.attributes.normal;
    for (let i = 0; i < nor.count; i++) nor.setXYZ(i, 0, 1, 0);
    return g;
  }

  const texPista = R(ctx.texturaCanvas((g, tam, azar) => {
    g.fillStyle = '#3b3e44';
    g.fillRect(0, 0, tam, tam);
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = azar() < 0.5 ? `rgba(255,255,255,${azar() * 0.06})` : `rgba(0,0,0,${azar() * 0.12})`;
      g.fillRect(azar() * tam, azar() * tam, 1 + azar() * 2, 1 + azar() * 2);
    }
    // Junta entre piezas de pista
    g.fillStyle = 'rgba(0,0,0,0.35)';
    g.fillRect(0, 0, tam, 2);
    // Las dos ranuras con sus raíles de metal
    for (const u of [0.5 - SEPARACION / ANCHO_PISTA, 0.5 + SEPARACION / ANCHO_PISTA]) {
      const x = u * tam;
      g.fillStyle = '#c9cdd2';
      g.fillRect(x - tam * 0.032, 0, tam * 0.016, tam);
      g.fillRect(x + tam * 0.016, 0, tam * 0.016, tam);
      g.fillStyle = '#0a0a0a';
      g.fillRect(x - tam * 0.016, 0, tam * 0.032, tam);
    }
    // Línea blanca en los bordes
    g.fillStyle = '#e8e8e8';
    g.fillRect(tam * 0.03, 0, tam * 0.025, tam);
    g.fillRect(tam * 0.945, 0, tam * 0.025, tam);
  }, { semilla: 34 }));
  texPista.wrapS = THREE.ClampToEdgeWrapping;
  texPista.wrapT = THREE.RepeatWrapping;
  const pista = new THREE.Mesh(
    R(cinta(ANCHO_PISTA / 2, -ANCHO_PISTA / 2, Y_MESA, 0.35)),
    R(new THREE.MeshLambertMaterial({ map: texPista })),
  );
  raiz.add(pista);

  const texBorde = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#e53935';
    g.fillRect(0, 0, tam, tam / 2);
    g.fillStyle = '#f5f5f5';
    g.fillRect(0, tam / 2, tam, tam / 2);
  }, { tam: 64, semilla: 35 }));
  texBorde.wrapT = THREE.RepeatWrapping;
  const geoBordes = fusionar([
    cinta(ANCHO_PISTA / 2 + 0.035, ANCHO_PISTA / 2, Y_MESA - 0.002, 0.1),
    cinta(-ANCHO_PISTA / 2, -ANCHO_PISTA / 2 - 0.035, Y_MESA - 0.002, 0.1),
  ]);
  const bordes = new THREE.Mesh(R(geoBordes), R(new THREE.MeshLambertMaterial({ map: texBorde })));
  raiz.add(bordes);

  // Línea de meta a cuadros en el punto 0
  const texMeta = R(ctx.texturaCanvas((g, tam) => {
    const c = tam / 8;
    for (let i = 0; i < 8; i++) for (let j = 0; j < 2; j++) {
      g.fillStyle = (i + j) % 2 ? '#111111' : '#f5f5f5';
      g.fillRect(i * c, j * (tam / 2), c, tam / 2);
    }
  }, { tam: 128, semilla: 36 }));
  const meta = new THREE.Mesh(R(new THREE.PlaneGeometry(ANCHO_PISTA, 0.035).rotateX(-Math.PI / 2)), R(new THREE.MeshLambertMaterial({ map: texMeta })));
  meta.position.copy(centro[0]).setY(Y_MESA + 0.001);
  meta.rotation.y = Math.atan2(-tangentes[0].x, -tangentes[0].z);
  raiz.add(meta);

  // Pórtico de salida con el semáforo (tres luces en una malla instanciada)
  const lado0 = normales[0];
  const portico = new THREE.Mesh(
    R(fusionar([
      new THREE.BoxGeometry(0.02, 0.22, 0.02).translate(0, 0.11, ANCHO_PISTA / 2 + 0.06),
      new THREE.BoxGeometry(0.02, 0.22, 0.02).translate(0, 0.11, -ANCHO_PISTA / 2 - 0.06),
      new THREE.BoxGeometry(0.03, 0.05, ANCHO_PISTA + 0.16).translate(0, 0.23, 0),
    ])),
    R(new THREE.MeshLambertMaterial({ color: 0x78909c })),
  );
  portico.position.copy(centro[0]).setY(Y_MESA);
  portico.rotation.y = Math.atan2(lado0.x, lado0.z); // su eje Z cruza la pista
  raiz.add(portico);
  const luces = new THREE.InstancedMesh(R(new THREE.SphereGeometry(0.014, 10, 8)), R(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })), 3);
  const auxObj = new THREE.Object3D();
  const auxColor = new THREE.Color();
  for (let i = 0; i < 3; i++) {
    auxObj.position.set(0.02, 0.23, (i - 1) * 0.045);
    auxObj.updateMatrix();
    luces.setMatrixAt(i, auxObj.matrix);
    luces.setColorAt(i, auxColor.setHex(0x331111));
  }
  portico.add(luces);
  function semaforo(encendidas, verde) {
    for (let i = 0; i < 3; i++) luces.setColorAt(i, auxColor.setHex(verde ? 0x00e676 : i < encendidas ? 0xff1744 : 0x331111));
    luces.instanceColor.needsUpdate = true;
  }

  // ─── Decorado de la maqueta: árboles, neumáticos y una grada ──────────
  // Se colocan solo en sitios del tablero lejos de la pista.
  function lejosDePista(x, z, margen) {
    for (let i = 0; i < N; i += 6) {
      const p = centro[i];
      if ((p.x - x) ** 2 + (p.z - z) ** 2 < (ANCHO_PISTA / 2 + 0.035 + margen) ** 2) return false;
    }
    return Math.abs(x) < ANCHO_MESA / 2 - margen && Math.abs(z - Z_MESA) < FONDO_MESA / 2 - margen;
  }
  let semilla = 7;
  const azar = () => ((semilla = (semilla * 16807) % 2147483647) / 2147483647);
  const sitiosArbol = [];
  for (let intento = 0; intento < 400 && sitiosArbol.length < 18; intento++) {
    const x = (azar() - 0.5) * ANCHO_MESA;
    const z = Z_MESA + (azar() - 0.5) * FONDO_MESA;
    // Más árboles al fondo para no tapar la pista al jugador
    if (z > Z_MESA + 0.2 && azar() < 0.7) continue;
    if (lejosDePista(x, z, 0.07) && sitiosArbol.every(([a, b]) => (a - x) ** 2 + (b - z) ** 2 > 0.025)) sitiosArbol.push([x, z, 0.7 + azar() * 0.6]);
  }
  const troncos = new THREE.InstancedMesh(R(new THREE.CylinderGeometry(0.008, 0.01, 0.06, 6).translate(0, 0.03, 0)), R(new THREE.MeshLambertMaterial({ color: 0x6d4c41 })), sitiosArbol.length);
  const copas = new THREE.InstancedMesh(R(new THREE.ConeGeometry(0.05, 0.13, 8).translate(0, 0.11, 0)), R(new THREE.MeshLambertMaterial({ color: 0x2e7d32 })), sitiosArbol.length);
  sitiosArbol.forEach(([x, z, e], i) => {
    auxObj.position.set(x, Y_MESA, z);
    auxObj.scale.setScalar(e);
    auxObj.updateMatrix();
    troncos.setMatrixAt(i, auxObj.matrix);
    copas.setMatrixAt(i, auxObj.matrix);
    copas.setColorAt(i, auxColor.setHex([0x2e7d32, 0x388e3c, 0x1b5e20, 0x558b2f][i % 4]));
  });
  raiz.add(troncos, copas);

  // Pilas de neumáticos por fuera de las curvas cerradas
  const sitiosNeumatico = [];
  for (let i = 0; i < N; i += 25) {
    const k = carriles[0].curvatura[i];
    if (Math.abs(k) < 3) continue;
    const fuera = normales[i].clone().multiplyScalar(-Math.sign(k) * (ANCHO_PISTA / 2 + 0.07));
    const p = centro[i].clone().add(fuera);
    if (lejosDePista(p.x, p.z, 0.02)) sitiosNeumatico.push(p);
  }
  const neumaticos = new THREE.InstancedMesh(R(new THREE.TorusGeometry(0.016, 0.008, 6, 10).rotateX(Math.PI / 2)), R(new THREE.MeshLambertMaterial({ color: 0x1c1c1c })), sitiosNeumatico.length * 2);
  sitiosNeumatico.forEach((p, i) => {
    for (let a = 0; a < 2; a++) {
      auxObj.position.set(p.x, Y_MESA + 0.008 + a * 0.016, p.z);
      auxObj.scale.setScalar(1);
      auxObj.updateMatrix();
      neumaticos.setMatrixAt(i * 2 + a, auxObj.matrix);
    }
  });
  raiz.add(neumaticos);

  // Grada con público al fondo de la mesa (gradas escalonadas en una malla)
  const texPublico = R(ctx.texturaCanvas((g, tam, az) => {
    g.fillStyle = '#9e9e9e';
    g.fillRect(0, 0, tam, tam);
    const colores = ['#e53935', '#1e88e5', '#fdd835', '#43a047', '#fb8c00', '#8e24aa', '#f5f5f5'];
    for (let i = 0; i < 260; i++) {
      g.fillStyle = colores[Math.floor(az() * colores.length)];
      g.beginPath();
      g.arc(az() * tam, az() * tam, tam * 0.018, 0, Math.PI * 2);
      g.fill();
    }
  }, { semilla: 37 }));
  const grada = new THREE.Mesh(
    R(fusionar([0, 1, 2].map((e) => new THREE.BoxGeometry(0.9, 0.035 * (e + 1), 0.06).translate(0, 0.0175 * (e + 1), -e * 0.06)))),
    R(new THREE.MeshLambertMaterial({ map: texPublico })),
  );
  grada.position.set(0.05, Y_MESA, Z_MESA - FONDO_MESA / 2 + 0.17);
  raiz.add(grada);

  // ─── Coches ────────────────────────────────────────────────────────────
  // Monoplaza a escala 1:32 (unos 16 cm). El morro mira a -Z.
  const geoCarroceria = R(fusionar([
    new THREE.BoxGeometry(0.036, 0.018, 0.13).translate(0, 0.022, 0),        // chasis
    new THREE.BoxGeometry(0.062, 0.015, 0.05).translate(0, 0.019, 0.012),    // pontones
    new THREE.BoxGeometry(0.022, 0.012, 0.045).translate(0, 0.018, -0.08),   // morro
    new THREE.BoxGeometry(0.072, 0.004, 0.018).translate(0, 0.01, -0.095),   // alerón delantero
    new THREE.BoxGeometry(0.062, 0.004, 0.02).translate(0, 0.05, 0.068),     // alerón trasero
    new THREE.BoxGeometry(0.004, 0.026, 0.012).translate(-0.02, 0.036, 0.068),
    new THREE.BoxGeometry(0.004, 0.026, 0.012).translate(0.02, 0.036, 0.068),
    new THREE.SphereGeometry(0.011, 10, 8).translate(0, 0.036, 0.0),         // casco
  ]));
  const geoRuedas = R(fusionar([
    ...[-1, 1].map((l) => new THREE.CylinderGeometry(0.013, 0.013, 0.014, 12).rotateZ(Math.PI / 2).translate(l * 0.036, 0.013, -0.052)),
    ...[-1, 1].map((l) => new THREE.CylinderGeometry(0.015, 0.015, 0.019, 12).rotateZ(Math.PI / 2).translate(l * 0.037, 0.015, 0.05)),
  ]));
  const matRuedas = R(new THREE.MeshStandardMaterial({ color: 0x1a1a1a, metalness: 0, roughness: 0.8 }));

  function crearCoche(color, carril) {
    const grupo = new THREE.Group();
    const cuerpo = new THREE.Mesh(geoCarroceria, R(new THREE.MeshStandardMaterial({ color, metalness: 0.3, roughness: 0.35 })));
    grupo.add(cuerpo, new THREE.Mesh(geoRuedas, matRuedas));
    raiz.add(grupo);
    const sombra = ctx.crearSombra({ radio: 0.07, opacidad: 0.4 });
    raiz.add(sombra);
    return {
      grupo, sombra, carril,
      s: 0, v: 0, acel: 0, vueltas: 0, derrape: 0, cola: 0,
      estado: 'pista', tFuera: 0, aparece: 1, acelRaton: 0,
      vel: new THREE.Vector3(), giro: 0, yFuera: Y_MESA,
      tiempoVuelta: 0, mejorVuelta: 0, tiempoFinal: 0,
      factor: 0.93, sonidoDerrape: 0,
    };
  }
  const jugador = crearCoche(0xe53935, carriles[0]);
  const rival = crearCoche(0x1e63d6, carriles[1]);
  const coches = [jugador, rival];

  // ─── Mando de slot (en la mano, en VR) ─────────────────────────────────
  const geoMando = R(fusionar([
    new THREE.BoxGeometry(0.034, 0.11, 0.04).translate(0, -0.045, 0.005),    // empuñadura
    new THREE.BoxGeometry(0.04, 0.035, 0.07).translate(0, 0.02, -0.005),     // cabeza
  ]));
  const matMando = R(new THREE.MeshStandardMaterial({ color: 0x37474f, metalness: 0.1, roughness: 0.5 }));
  const geoGatillo = R(new THREE.BoxGeometry(0.014, 0.05, 0.016).translate(0, -0.025, 0));
  const matGatillo = R(new THREE.MeshStandardMaterial({ color: 0xe53935, metalness: 0.1, roughness: 0.4 }));
  function crearMando() {
    const mando = new THREE.Group();
    const gatillo = new THREE.Mesh(geoGatillo, matGatillo);
    gatillo.position.set(0, 0.0, -0.035);
    mando.add(new THREE.Mesh(geoMando, matMando), gatillo);
    return { mando, gatillo };
  }
  const mandoVR = crearMando();
  const soporte = new THREE.Group();
  soporte.rotation.x = -Math.PI / 2;
  soporte.add(mandoVR.mando);
  soporte.visible = false;
  let manoMando = null;
  let ladoMando = 'right';
  // Cable del mando a la mesa
  const PUNTOS_CABLE = 10;
  const geoCable = R(new THREE.BufferGeometry());
  geoCable.setAttribute('position', new THREE.BufferAttribute(new Float32Array(PUNTOS_CABLE * 3), 3));
  const cable = new THREE.Line(geoCable, R(new THREE.LineBasicMaterial({ color: 0x111111 })));
  cable.frustumCulled = false;
  cable.visible = false;
  raiz.add(cable);
  const enchufe = new THREE.Vector3(0.35, Y_MESA, Z_MESA + FONDO_MESA / 2);


  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.3, alto: 0.4 });
  marcador.mesh.position.set(0, Y_MESA + 0.45, Z_MESA - FONDO_MESA / 2 - 0.05);
  marcador.mesh.rotation.x = -0.25;
  raiz.add(marcador.mesh);

  const motorJugador = ctx.sonidoContinuo('electrico');
  const motorRival = ctx.sonidoContinuo('electrico');

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'salida' | 'carrera' | 'fin'
  let reloj = 3;
  let tiempoCarrera = 0;
  let record = ctx.leer('record', 0);           // mejor tiempo total (0 = ninguno)
  let recordVuelta = ctx.leer('vuelta', 0);     // vuelta más rápida
  let ganada = false;
  let nuevoRecord = false;
  let mensaje = '';
  let tiempoMensaje = 0;
  let colorMensaje = '#fff59d';
  let cuentaAnterior = 0;
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const dir = new THREE.Vector3();
  const segundos = (s) => `${s.toFixed(2)} s`;

  function avisar(texto, color = '#fff59d', duracion = 1.5) {
    mensaje = texto;
    colorMensaje = color;
    tiempoMensaje = duracion;
  }

  function colocarEnSalida() {
    for (const c of coches) {
      c.s = 0;
      c.v = 0;
      c.acel = 0;
      c.vueltas = 0;
      c.derrape = 0;
      c.cola = 0;
      c.estado = 'pista';
      c.tiempoVuelta = 0;
      c.mejorVuelta = 0;
      c.tiempoFinal = 0;
      c.grupo.visible = true;
      c.grupo.scale.setScalar(1);
      c.aparece = 1;
    }
    rival.factor = nuevoFactorRival();
    tiempoCarrera = 0;
    ganada = false;
    nuevoRecord = false;
  }

  // La máquina va a un ritmo distinto en cada vuelta; a veces se pasa de frenada
  function nuevoFactorRival() {
    return Math.random() < 0.15 ? 1.2 : 0.74 + Math.random() * 0.1;
  }

  // ─── Física de un coche ────────────────────────────────────────────────
  function moverCoche(c, dt) {
    if (c.estado === 'fuera') {
      c.tFuera += dt;
      c.vel.multiplyScalar(Math.max(0, 1 - 2.2 * dt));
      const p = c.grupo.position;
      p.addScaledVector(c.vel, dt);
      // Fuera de la mesa, se cae al suelo
      const sobreMesa = Math.abs(p.x) < ANCHO_MESA / 2 + 0.04 && Math.abs(p.z - Z_MESA) < FONDO_MESA / 2 + 0.04;
      const suelo = sobreMesa && c.yFuera >= Y_MESA - 0.01 ? Y_MESA : 0;
      if (p.y > suelo) {
        c.yFuera = p.y;
        c.vel.y -= 9.8 * dt;
      } else {
        p.y = suelo;
        c.vel.y = 0;
      }
      c.yFuera = p.y;
      c.giro *= Math.max(0, 1 - 1.5 * dt);
      c.grupo.rotation.y += c.giro * dt;
      ctx.colocarSombra(c.sombra, p, suelo);
      if (c.tFuera > TIEMPO_FUERA) {
        // Vuelve a su carril, parado, en el mismo sitio
        c.estado = 'pista';
        c.v = 0;
        c.derrape = 0;
        c.cola = 0;
        c.aparece = 0;
      }
      return;
    }

    const a = ACELERACION * c.acel * (1 - c.v / VELOCIDAD_MAX) - FRENO_MOTOR * (1 - c.acel) * Math.min(1, c.v / 0.3) - 0.25 * c.v;
    c.v = Math.max(0, c.v + a * dt);
    c.s += c.v * dt;
    if (estado === 'carrera' || estado === 'fin') c.tiempoVuelta += dt;
    if (c.s >= c.carril.largo) {
      c.s -= c.carril.largo;
      c.vueltas += 1;
      completarVuelta(c);
    }

    const i = posicion(c.carril, c.s, c.grupo.position, dir);
    const k = c.carril.curvatura[i];
    const exceso = (c.v * c.v * Math.abs(k)) / AGARRE;
    if (exceso > 1) c.derrape += (exceso - 1) * dt * 5;
    else c.derrape = Math.max(0, c.derrape - dt * 2);
    // La cola se va hacia fuera al acercarse al límite
    const colaObjetivo = -Math.sign(k) * Math.min(0.55, Math.max(0, exceso - 0.75) * 0.9 + c.derrape);
    c.cola += (colaObjetivo - c.cola) * Math.min(1, dt * 12);

    c.grupo.position.y = Y_MESA;
    c.grupo.rotation.set(0, Math.atan2(-dir.x, -dir.z) + c.cola, 0);
    if (c.aparece < 1) {
      c.aparece = Math.min(1, c.aparece + dt * 4);
      c.grupo.scale.setScalar(0.4 + 0.6 * c.aparece);
    }
    ctx.colocarSombra(c.sombra, c.grupo.position, Y_MESA);

    c.sonidoDerrape -= dt;
    if (exceso > 0.92 && c.v > 0.5 && c.sonidoDerrape <= 0) {
      if (c === jugador) ctx.sonido('derrape');
      c.sonidoDerrape = 0.25;
    }

    if (c.derrape > LIMITE_DERRAPE) salirse(c, k, i);
  }

  function salirse(c, k, i) {
    c.estado = 'fuera';
    c.tFuera = 0;
    const fuera = normales[i].clone().multiplyScalar(-Math.sign(k));
    c.vel.copy(dir).multiplyScalar(c.v * 0.85).addScaledVector(fuera, c.v * 0.55);
    c.vel.y = 0.6 + c.v * 0.25;
    c.giro = -Math.sign(k) * (8 + Math.random() * 6);
    c.yFuera = Y_MESA;
    c.v = 0;
    if (c === jugador) {
      ctx.sonido('golpe');
      avisar(ctx.t('fuera'), '#ff8a80');
      for (const m of ctx.manos) if (m.activa) ctx.vibrar(m, 0.9, 120);
    } else {
      avisar(ctx.t('rivalFuera'), '#b9f6ca');
      rival.factor = 0.74 + Math.random() * 0.1;
    }
  }

  function completarVuelta(c) {
    const t = c.tiempoVuelta;
    c.tiempoVuelta = 0;
    if (!c.mejorVuelta || t < c.mejorVuelta) c.mejorVuelta = t;
    if (c === rival) {
      rival.factor = nuevoFactorRival();
      if (c.vueltas >= VUELTAS && !c.tiempoFinal) c.tiempoFinal = tiempoCarrera;
      return;
    }
    if (estado !== 'carrera') return;
    if (!recordVuelta || t < recordVuelta) {
      recordVuelta = t;
      ctx.guardar('vuelta', recordVuelta);
      avisar(ctx.t('vueltaRapida', { tiempo: segundos(t) }), '#b9f6ca');
      ctx.sonido('anillo');
    } else {
      ctx.sonido('punto');
    }
    if (c.vueltas >= VUELTAS) terminar();
  }

  function terminar() {
    estado = 'fin';
    reloj = 8;
    jugador.tiempoFinal = tiempoCarrera;
    ganada = !rival.tiempoFinal;
    ctx.puntuacion(tiempoCarrera); // tiempo de carrera: menos es mejor (juegos/marcadores.js)
    if (!record || tiempoCarrera < record) {
      record = tiempoCarrera;
      nuevoRecord = true;
      ctx.guardar('record', record);
    }
    ctx.sonido(ganada ? 'ovacion' : 'fin');
  }

  // ─── Mandos ────────────────────────────────────────────────────────────
  // Devuelve cuánto se aprieta el acelerador (0 a 1)
  function leerMando(dt) {
    if (ctx.enVR()) {
      const activas = ctx.manos.filter((m) => m.activa);
      const valor = (m) => {
        const b = m.fuente?.gamepad?.buttons?.[0];
        return b ? Math.max(b.value || 0, b.pressed ? 0.05 : 0) : 0;
      };
      // El mando va en la última mano que ha apretado el gatillo
      for (const m of activas) if (m.gatilloPulsado && m.lado && m.lado !== ladoMando) ladoMando = m.lado;
      const mano = activas.find((m) => m.lado === ladoMando) || activas[0] || null;
      if (mano !== manoMando) {
        if (soporte.parent) soporte.parent.remove(soporte);
        if (mano) ctx.adjuntarAMano(mano, soporte);
        manoMando = mano;
      }
      soporte.visible = !!mano;
      cable.visible = !!mano;
      if (!mano) return 0;
      const v = valor(mano);
      mandoVR.gatillo.position.z = -0.035 + v * 0.018;
      // Cable colgando entre el mando y la mesa
      soporte.updateMatrixWorld();
      const desde = mandoVR.mando.localToWorld(tmp.set(0, -0.1, 0.005));
      const pos = geoCable.attributes.position;
      for (let i = 0; i < PUNTOS_CABLE; i++) {
        const f = i / (PUNTOS_CABLE - 1);
        tmp2.lerpVectors(desde, enchufe, f);
        tmp2.y -= Math.sin(f * Math.PI) * 0.25;
        pos.setXYZ(i, tmp2.x, tmp2.y, tmp2.z);
      }
      pos.needsUpdate = true;
      if (v > 0.05 && jugador.estado === 'pista') ctx.vibrar(mano, 0.05 + jugador.v / VELOCIDAD_MAX * 0.12, 20);
      return v;
    }
    soporte.visible = false;
    cable.visible = false;
    // Ratón o dedo: pulsado acelera (sube y baja suave, como un gatillo)
    const objetivo = ctx.raton.pulsado ? 1 : 0;
    jugador.acelRaton += (objetivo - jugador.acelRaton) * Math.min(1, dt * 10);
    return jugador.acelRaton;
  }

  function pilotarRival() {
    if (rival.estado !== 'pista') return 0;
    const i = indice(rival.carril, rival.s);
    // Mira un poco por delante, como haría alguien que conoce la pista
    const j = (i + 12) % N;
    const objetivo = Math.min(rival.carril.perfil[i], rival.carril.perfil[j]) * rival.factor;
    return rival.v < objetivo ? 1 : 0;
  }

  // ─── Marcador ──────────────────────────────────────────────────────────
  function actualizarMarcador() {
    const recordTexto = ctx.t('reglas', { record: record ? segundos(record) : '—', vuelta: recordVuelta ? segundos(recordVuelta) : '—' });
    if (estado === 'intro') {
      marcador.escribir([
        { texto: ctx.t('titulo'), tam: 1.2, color: '#ffcc80' },
        { texto: ctx.t(ctx.enVR() ? 'introVR' : ctx.tactil ? 'introTactil' : 'introRaton'), tam: 0.62 },
        { texto: recordTexto, tam: 0.62, color: '#ffcc80' },
      ]);
    } else if (estado === 'salida') {
      const n = Math.ceil(reloj);
      marcador.escribir([
        { texto: String(n), tam: 1.5, color: '#ff5252' },
        { texto: ctx.t(ctx.enVR() ? 'introVR' : ctx.tactil ? 'introTactil' : 'introRaton'), tam: 0.62 },
        { texto: recordTexto, tam: 0.62, color: '#ffcc80' },
      ]);
    } else if (estado === 'carrera') {
      const progreso = (c) => c.vueltas + c.s / c.carril.largo;
      const delante = progreso(jugador) >= progreso(rival);
      marcador.escribir([
        { texto: ctx.t('pantalla', { vuelta: Math.min(VUELTAS, jugador.vueltas + 1), vueltas: VUELTAS, tiempo: segundos(tiempoCarrera) }), tam: 1.1 },
        tiempoMensaje > 0
          ? { texto: mensaje, tam: 0.75, color: colorMensaje }
          : tiempoCarrera < 1
            ? { texto: ctx.t('ya'), tam: 0.9, color: '#69f0ae' }
            : { texto: ctx.t(delante ? 'delante' : 'detras'), tam: 0.75, color: delante ? '#b9f6ca' : '#ffab91' },
        { texto: recordTexto, tam: 0.62, color: '#ffcc80' },
      ]);
    } else {
      marcador.escribir([
        { texto: ganada ? ctx.t('hasGanado') : ctx.t('hasPerdido'), tam: 1.2, color: ganada ? '#69f0ae' : '#ffcc80' },
        { texto: nuevoRecord ? ctx.t('partida.nuevoRecord') : ctx.t('resumen', { tiempo: segundos(jugador.tiempoFinal), vuelta: segundos(jugador.mejorVuelta || 0) }), tam: 0.7, color: nuevoRecord ? '#fff59d' : '#ffffff' },
        { texto: ctx.t('otra', { n: Math.max(1, Math.ceil(reloj)) }), tam: 0.62, color: '#ffcc80' },
      ]);
    }
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  colocarEnSalida();
  semaforo(0, false);

  function actualizar(dt) {
    if (!ctx.enVR()) ajustarVista();
    reloj -= dt;
    tiempoMensaje -= dt;
    let acelJugador = leerMando(dt);

    if (estado === 'intro' && reloj <= 0) {
      estado = 'salida';
      reloj = 3;
      cuentaAnterior = 4;
    } else if (estado === 'salida') {
      const n = Math.ceil(reloj);
      if (n !== cuentaAnterior && n > 0) {
        cuentaAnterior = n;
        semaforo(4 - n, false);
        ctx.sonido('tic');
      }
      if (reloj <= 0) {
        estado = 'carrera';
        semaforo(3, true);
        ctx.sonido('anillo');
      }
    } else if (estado === 'carrera') {
      tiempoCarrera += dt;
    } else if (estado === 'fin' && reloj <= 0) {
      colocarEnSalida();
      semaforo(0, false);
      estado = 'salida';
      reloj = 3;
      cuentaAnterior = 4;
    }

    // Antes de la salida y tras la meta los coches no corren (el rival acaba su vuelta)
    if (estado !== 'carrera') acelJugador = 0;
    jugador.acel = acelJugador;
    rival.acel = estado === 'carrera' || (estado === 'fin' && rival.vueltas < VUELTAS) ? pilotarRival() : 0;
    for (const c of coches) moverCoche(c, dt);

    motorJugador.ajustar(Math.min(1, jugador.v / VELOCIDAD_MAX * 0.8 + jugador.acel * 0.2), jugador.estado === 'pista' ? 0.1 + jugador.acel * 0.06 : 0);
    motorRival.ajustar(Math.min(1, rival.v / VELOCIDAD_MAX), rival.estado === 'pista' ? 0.04 + rival.v / VELOCIDAD_MAX * 0.04 : 0);

    actualizarMarcador();
  }

  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      luces.dispose();
      troncos.dispose();
      copas.dispose();
      neumaticos.dispose();
    },
  };
}
