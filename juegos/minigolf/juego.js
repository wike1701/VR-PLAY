// MINIGOLF
// 9 hoyos generados al azar en cada ronda: recorridos con curvas, postes, estrechamientos y
// molinos que giran. En VR el palo va en la mano y su cabeza se apoya sola en el suelo (no hace
// falta agacharse); con ratón o con el dedo se hace clic donde quieres que llegue la bola.
// El jugador no se desplaza: tras cada golpe, un parpadeo recoloca el campo para que la bola
// quede a tus pies mirando hacia donde sigue el recorrido.
//
// Coordenadas: el campo vive en su propio grupo (x, z en metros, el suelo en y = 0). La física
// de la bola es en 2D, en coordenadas del campo. Para recolocar, solo se mueve y gira el grupo.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const HOYOS = 9;
const GOLPES_EXTRA = 3;          // máximo de golpes por hoyo: par + 3 (al pasarlo, cuenta uno más)
const LADO = 1.5;                // tamaño de cada casilla del recorrido
const BOLA = 0.03;               // radio de la bola (algo mayor que la real, para verla bien)
const RADIO_HOYO = 0.065;
const VEL_EMBOCAR = 1.4;         // más rápido que esto, la bola se sale del hoyo
const FRENADO = 0.55;            // m/s² de rozamiento fijo…
const FRENADO_VEL = 0.35;        // …más uno proporcional a la velocidad
const REBOTE = 0.72;
const VEL_MAXIMA = 6;
const ALTO_PARED = 0.08;
const GROSOR_PARED = 0.06;
const POS_BOLA = new THREE.Vector3(0, 0, -0.45); // dónde queda la bola respecto al jugador
// Palo
const LARGO_MIN = 0.4;
const LARGO_MAX = 1.3;
const RADIO_CABEZA = 0.06;       // tamaño de la cabeza del palo para el choque

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);
  const azar = (a, b) => a + Math.random() * (b - a);

  ctx.fondo(0x8ecbf2);
  ctx.sueloBase(false);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.75, 1.4), new THREE.Vector3(0, 0, -3.5));

  // ─── Materiales ────────────────────────────────────────────────────────
  const matCalle = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.cesped(0x43b04a, { semilla: 3 })) }));
  const matPrado = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.cesped(0x2f7d38, { semilla: 8 })) }));
  const matPared = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.madera(0xa0703f, { semilla: 6 })) }));
  const matSalida = R(new THREE.MeshLambertMaterial({ color: 0x1b5e20 }));
  const matNegro = R(new THREE.MeshBasicMaterial({ color: 0x111111 }));
  const matBlanco = R(new THREE.MeshLambertMaterial({ color: 0xffffff }));
  const matBandera = R(new THREE.MeshLambertMaterial({ color: 0xe53935, side: THREE.DoubleSide }));
  const matPoste = R(new THREE.MeshStandardMaterial({ color: 0xffb300, metalness: 0.3, roughness: 0.5 }));
  const matMolino = R(new THREE.MeshStandardMaterial({ color: 0x5c6bc0, metalness: 0.2, roughness: 0.5 }));
  const matTronco = R(new THREE.MeshLambertMaterial({ color: 0x6d4c41 }));
  const matCopa = R(new THREE.MeshLambertMaterial({ color: 0x2e7d32 }));

  // Fusiona geometrías estáticas (cada una con su matriz) en una sola: una llamada de dibujo
  function fusionar(piezas) {
    const datos = { position: [], normal: [], uv: [] };
    for (const [geo, matriz] of piezas) {
      const g = geo.index ? geo.toNonIndexed() : geo.clone();
      g.applyMatrix4(matriz);
      for (const nombre in datos) datos[nombre].push(...g.attributes[nombre].array);
      g.dispose();
    }
    const resultado = new THREE.BufferGeometry();
    resultado.setAttribute('position', new THREE.Float32BufferAttribute(datos.position, 3));
    resultado.setAttribute('normal', new THREE.Float32BufferAttribute(datos.normal, 3));
    resultado.setAttribute('uv', new THREE.Float32BufferAttribute(datos.uv, 2));
    return resultado;
  }

  // ─── Campo (se mueve y gira entero para recolocar) ────────────────────
  const campo = new THREE.Group();
  raiz.add(campo);
  const hoyoGrupo = new THREE.Group(); // lo de este hoyo (se rehace en cada uno)
  campo.add(hoyoGrupo);

  const bola = new THREE.Mesh(R(new THREE.SphereGeometry(BOLA, 20, 14)), R(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35 })));
  campo.add(bola);
  const sombraBola = ctx.crearSombra({ radio: BOLA * 1.3, opacidad: 0.5 });
  campo.add(sombraBola);

  // Bandera
  const bandera = new THREE.Group();
  const mastil = new THREE.Mesh(R(new THREE.CylinderGeometry(0.008, 0.008, 1.2, 8).translate(0, 0.6, 0)), matBlanco);
  const geoTela = R(new THREE.BufferGeometry().setFromPoints([
    new THREE.Vector3(0, 1.2, 0), new THREE.Vector3(0.32, 1.1, 0), new THREE.Vector3(0, 1.0, 0),
  ]));
  geoTela.computeVertexNormals();
  const tela = new THREE.Mesh(geoTela, matBandera);
  const agujero = new THREE.Mesh(R(new THREE.CircleGeometry(RADIO_HOYO, 24).rotateX(-Math.PI / 2)), matNegro);
  agujero.position.y = 0.003;
  const borde = new THREE.Mesh(R(new THREE.RingGeometry(RADIO_HOYO, RADIO_HOYO + 0.012, 24).rotateX(-Math.PI / 2)), matBlanco);
  borde.position.y = 0.003;
  bandera.add(mastil, tela);
  campo.add(bandera, agujero, borde);

  // Molino (como mucho uno por hoyo)
  const molino = new THREE.Group();
  const aspa = new THREE.Mesh(R(new THREE.BoxGeometry(1.1, 0.06, 0.05)), matMolino);
  aspa.position.y = 0.06;
  molino.add(aspa, new THREE.Mesh(R(new THREE.CylinderGeometry(0.06, 0.07, 0.14, 12).translate(0, 0.07, 0)), matMolino));
  campo.add(molino);

  // ─── Palo (VR): la cabeza se apoya donde la línea del mando toca el suelo ─
  const palo = new THREE.Group();
  const varaPalo = new THREE.Mesh(R(new THREE.CylinderGeometry(0.008, 0.008, 1, 8).translate(0, 0.5, 0)), R(new THREE.MeshStandardMaterial({ color: 0xb0bec5, metalness: 0.8, roughness: 0.3 })));
  const cabezaPalo = new THREE.Mesh(R(new THREE.BoxGeometry(0.11, 0.035, 0.04)), R(new THREE.MeshStandardMaterial({ color: 0x37474f, metalness: 0.7, roughness: 0.35 })));
  const empunadura = new THREE.Mesh(R(new THREE.CylinderGeometry(0.016, 0.014, 0.18, 10).translate(0, -0.09, 0)), R(new THREE.MeshStandardMaterial({ color: 0x212121, roughness: 0.9 })));
  palo.add(varaPalo, empunadura);
  raiz.add(palo, cabezaPalo);
  let ladoPalo = 'right';

  // Ratón: línea de tiro y marca de destino
  const matApunte = R(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.75 }));
  const lineaApunte = new THREE.Mesh(R(new THREE.BoxGeometry(0.02, 0.004, 1).translate(0, 0, -0.5)), matApunte);
  const marcaApunte = new THREE.Mesh(R(new THREE.RingGeometry(0.06, 0.09, 24).rotateX(-Math.PI / 2)), matApunte);
  campo.add(lineaApunte, marcaApunte);

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.7, alto: 0.46 });
  marcador.mesh.position.set(0, 1.95, -3.2);
  marcador.mesh.rotation.x = 0.15;
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'apuntando' | 'rodando' | 'embocada' | 'fin'
  let reloj = 3;
  let hoyo = 0;
  let golpes = 0;
  let tarjeta = [];     // golpes de cada hoyo
  let pares = [];
  let record = ctx.leer('record', null); // el mejor total (menos es mejor)
  let mensaje = '';
  let colorMensaje = '#ffffff';
  let quieta = 0;       // tiempo que lleva la bola casi parada
  let hundiendo = 0;    // animación de la bola cayendo al hoyo
  let ultimoToc = 0;
  let tiempo = 0;

  // Recorrido del hoyo actual
  let casillas = [];    // [{ i, j, x, z }] en orden, de la salida al hoyo
  let paredes = [];     // segmentos { ax, az, bx, bz }
  let postes = [];      // { x, z, r }
  let molinoDatos = null; // { x, z, angulo, vel, medio }
  const hoyoPos = new THREE.Vector2();
  const posBola = new THREE.Vector2();   // en el campo
  const velBola = new THREE.Vector2();
  const ultimaQuieta = new THREE.Vector2();

  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const inversa = new THREE.Matrix4();
  const planoSuelo = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // ─── Generación de hoyos ───────────────────────────────────────────────
  // Camino de casillas sobre una cuadrícula: sin cruzarse y sin tocarse salvo con la anterior
  // (si dos casillas no consecutivas se tocaran, habría un atajo sin pared).
  function generarCamino(n) {
    for (let intento = 0; intento < 300; intento++) {
      const camino = [[0, 0], [0, 1]]; // la salida y una recta para empezar
      const ocupado = new Set(['0,0', '0,1']);
      let dir = [0, 1];
      let bien = true;
      for (let k = 2; k < n; k++) {
        const [i, j] = camino[k - 1];
        const derecha = [dir[1], -dir[0]];
        const izquierda = [-dir[1], dir[0]];
        const recto = Math.random() < 0.5;
        const opciones = recto ? [dir, ...(Math.random() < 0.5 ? [derecha, izquierda] : [izquierda, derecha])]
          : [...(Math.random() < 0.5 ? [derecha, izquierda] : [izquierda, derecha]), dir];
        let elegido = null;
        for (const d of opciones) {
          const ni = i + d[0];
          const nj = j + d[1];
          const clave = `${ni},${nj}`;
          if (nj < 0 || ocupado.has(clave)) continue;
          const tocaOtra = [[1, 0], [-1, 0], [0, 1], [0, -1]].some(([a, b]) => {
            const v = `${ni + a},${nj + b}`;
            return v !== `${i},${j}` && ocupado.has(v);
          });
          if (tocaOtra) continue;
          elegido = d;
          break;
        }
        if (!elegido) {
          bien = false;
          break;
        }
        dir = elegido;
        camino.push([i + dir[0], j + dir[1]]);
        ocupado.add(`${i + dir[0]},${j + dir[1]}`);
      }
      if (bien) return camino;
    }
    return Array.from({ length: n }, (_, k) => [0, k]); // recto, por si acaso
  }

  function limpiarHoyo() {
    for (const hijo of [...hoyoGrupo.children]) {
      hoyoGrupo.remove(hijo);
      hijo.geometry?.dispose();
    }
  }

  function generarHoyo(numero) {
    limpiarHoyo();
    const n = 4 + Math.floor(numero / 2) + Math.floor(Math.random() * 3);
    const camino = generarCamino(n);
    casillas = camino.map(([i, j]) => ({ i, j, x: i * LADO, z: -j * LADO }));
    const ocupado = new Set(camino.map(([i, j]) => `${i},${j}`));

    // Paredes: cada lado de casilla que no da a otra casilla del camino
    paredes = [];
    const m = LADO / 2;
    for (const c of casillas) {
      const lados = [
        [1, 0, c.x + m, c.z - m, c.x + m, c.z + m],
        [-1, 0, c.x - m, c.z - m, c.x - m, c.z + m],
        [0, 1, c.x - m, c.z - m, c.x + m, c.z - m],
        [0, -1, c.x - m, c.z + m, c.x + m, c.z + m],
      ];
      for (const [di, dj, ax, az, bx, bz] of lados) {
        if (!ocupado.has(`${c.i + di},${c.j + dj}`)) paredes.push({ ax, az, bx, bz });
      }
    }

    // Obstáculos en las casillas intermedias, más cuantos más hoyos llevas
    postes = [];
    molinoDatos = null;
    let estrechos = 0;
    const d = numero / (HOYOS - 1);
    for (let k = 2; k < casillas.length - 1; k++) {
      const c = casillas[k];
      const r = Math.random();
      if (!molinoDatos && numero >= 3 && r < 0.18 + d * 0.15) {
        molinoDatos = { x: c.x, z: c.z, angulo: azar(0, Math.PI), vel: azar(1.1, 1.7) * (Math.random() < 0.5 ? -1 : 1), medio: 0.55 };
      } else if (numero >= 2 && r < 0.45 + d * 0.15) {
        // Estrechamiento: una pared de lado a lado con un hueco, a 0,4 m de la entrada
        const p = casillas[k - 1];
        const ex = Math.sign(c.x - p.x);
        const ez = Math.sign(c.z - p.z);
        const px = -ez; // perpendicular
        const pz = ex;
        const cx = c.x - ex * (m - 0.4);
        const cz = c.z - ez * (m - 0.4);
        estrechos++;
        const hueco = 0.42 - d * 0.08;
        const centro = azar(-0.35, 0.35);
        paredes.push({ ax: cx - px * m, az: cz - pz * m, bx: cx + px * (centro - hueco / 2), bz: cz + pz * (centro - hueco / 2) });
        paredes.push({ ax: cx + px * (centro + hueco / 2), az: cz + pz * (centro + hueco / 2), bx: cx + px * m, bz: cz + pz * m });
      } else if (r < 0.7) {
        // Postes a un lado del camino (nunca en el centro: siempre queda un pasillo libre)
        const p = casillas[k - 1];
        const ex = Math.sign(c.x - p.x);
        const ez = Math.sign(c.z - p.z);
        const cuantos = d > 0.6 && Math.random() < 0.3 ? 2 : 1;
        const lado = Math.random() < 0.5 ? -1 : 1;
        for (let q = 0; q < cuantos; q++) {
          const a = azar(-0.4, 0.4);                        // a lo largo del camino
          const b = (q ? -lado : lado) * azar(0.22, 0.45);  // a un lado (el segundo, al otro)
          postes.push({ x: c.x + ex * a - ez * b, z: c.z + ez * a + ex * b, r: 0.08 });
        }
      }
    }

    // Hoyo y salida
    const ultima = casillas[casillas.length - 1];
    hoyoPos.set(ultima.x + azar(-0.3, 0.3), ultima.z + azar(-0.3, 0.3));
    const salida = casillas[0];
    posBola.set(salida.x, salida.z + 0.35);
    velBola.set(0, 0);
    ultimaQuieta.copy(posBola);
    // Par: por lo largo que es, más uno si hay molino y otro si hay dos o más estrechamientos
    pares[numero] = THREE.MathUtils.clamp(2 + Math.floor((n - 1) / 3) + (molinoDatos ? 1 : 0) + (estrechos >= 2 ? 1 : 0), 2, 6);

    // ─── Mallas del hoyo ───
    const geoCasilla = new THREE.PlaneGeometry(LADO, LADO).rotateX(-Math.PI / 2);
    const calle = new THREE.Mesh(fusionar(casillas.map((c) => [geoCasilla, new THREE.Matrix4().makeTranslation(c.x, 0.002, c.z)])), matCalle);
    geoCasilla.dispose();
    const geoMuro = new THREE.BoxGeometry(1, ALTO_PARED, GROSOR_PARED);
    const muros = new THREE.Mesh(fusionar(paredes.map((p) => {
      const largo = Math.hypot(p.bx - p.ax, p.bz - p.az) + GROSOR_PARED;
      const giro = Math.atan2(-(p.bz - p.az), p.bx - p.ax);
      return [geoMuro, new THREE.Matrix4().compose(
        new THREE.Vector3((p.ax + p.bx) / 2, ALTO_PARED / 2, (p.az + p.bz) / 2),
        new THREE.Quaternion().setFromAxisAngle(new THREE.Vector3(0, 1, 0), giro),
        new THREE.Vector3(largo, 1, 1),
      )];
    })), matPared);
    geoMuro.dispose();
    const tee = new THREE.Mesh(new THREE.PlaneGeometry(0.5, 0.35).rotateX(-Math.PI / 2), matSalida);
    tee.position.set(salida.x, 0.004, salida.z + 0.35);
    hoyoGrupo.add(calle, muros, tee);
    for (const p of postes) {
      const poste = new THREE.Mesh(new THREE.CylinderGeometry(p.r, p.r, 0.16, 14).translate(0, 0.08, 0), matPoste);
      poste.position.set(p.x, 0, p.z);
      hoyoGrupo.add(poste);
    }
    // Prado alrededor y unos árboles (fuera del recorrido)
    let minX = Infinity; let maxX = -Infinity; let minZ = Infinity; let maxZ = -Infinity;
    for (const c of casillas) {
      minX = Math.min(minX, c.x); maxX = Math.max(maxX, c.x);
      minZ = Math.min(minZ, c.z); maxZ = Math.max(maxZ, c.z);
    }
    const cx = (minX + maxX) / 2;
    const cz = (minZ + maxZ) / 2;
    const prado = new THREE.Mesh(new THREE.PlaneGeometry(70, 70).rotateX(-Math.PI / 2), matPrado);
    prado.geometry.attributes.uv.array.forEach((v, i, a) => { a[i] = v * 18; });
    prado.position.set(cx, -0.002, cz);
    const troncos = [];
    const copas = [];
    const geoTronco = new THREE.CylinderGeometry(0.12, 0.16, 1.2, 8).translate(0, 0.6, 0);
    const geoCopa = new THREE.ConeGeometry(0.9, 2.2, 9).translate(0, 2.1, 0);
    for (let k = 0; k < 14; k++) {
      const a = (k / 14) * Math.PI * 2 + azar(-0.2, 0.2);
      const dist = Math.max(maxX - minX, maxZ - minZ) / 2 + azar(4, 9);
      const x = cx + Math.cos(a) * dist;
      const z = cz + Math.sin(a) * dist;
      const s = azar(0.8, 1.4);
      const mat = new THREE.Matrix4().compose(new THREE.Vector3(x, 0, z), new THREE.Quaternion(), new THREE.Vector3(s, s, s));
      troncos.push([geoTronco, mat]);
      copas.push([geoCopa, mat]);
    }
    hoyoGrupo.add(prado, new THREE.Mesh(fusionar(troncos), matTronco), new THREE.Mesh(fusionar(copas), matCopa));
    geoTronco.dispose();
    geoCopa.dispose();

    bandera.position.set(hoyoPos.x, 0, hoyoPos.y);
    agujero.position.set(hoyoPos.x, 0.003, hoyoPos.y);
    borde.position.set(hoyoPos.x, 0.0035, hoyoPos.y);
    molino.visible = !!molinoDatos;
    if (molinoDatos) molino.position.set(molinoDatos.x, 0, molinoDatos.z);
  }

  // ─── Recolocar el campo bajo el jugador ────────────────────────────────
  // La bola queda en POS_BOLA y el recorrido sigue hacia delante (-Z).
  function casillaDe(x, z) {
    return casillas.findIndex((c) => Math.abs(x - c.x) <= LADO / 2 + 0.01 && Math.abs(z - c.z) <= LADO / 2 + 0.01);
  }
  // ¿Se ve de (ax, az) a (bx, bz) sin paredes ni postes en medio? (con el grosor de la bola)
  function seVe(ax, az, bx, bz) {
    const cruza = (p, q, r, t) => {
      const d = (q.x - p.x) * (t.z - r.z) - (q.z - p.z) * (t.x - r.x);
      if (Math.abs(d) < 1e-9) return false;
      const u = ((r.x - p.x) * (t.z - r.z) - (r.z - p.z) * (t.x - r.x)) / d;
      const v = ((r.x - p.x) * (q.z - p.z) - (r.z - p.z) * (q.x - p.x)) / d;
      return u > 0 && u < 1 && v >= 0 && v <= 1;
    };
    const a = { x: ax, z: az };
    const b = { x: bx, z: bz };
    for (const w of paredes) if (cruza(a, b, { x: w.ax, z: w.az }, { x: w.bx, z: w.bz })) return false;
    const largo2 = (bx - ax) ** 2 + (bz - az) ** 2;
    for (const s of postes) {
      const t = THREE.MathUtils.clamp(((s.x - ax) * (bx - ax) + (s.z - az) * (bz - az)) / largo2, 0, 1);
      if (Math.hypot(ax + (bx - ax) * t - s.x, az + (bz - az) * t - s.z) < s.r + BOLA) return false;
    }
    return true;
  }

  // La bola queda en POS_BOLA, mirando al hoyo si se ve o, si no, a la casilla más lejana
  // del recorrido que se ve desde ella
  function recolocar(conParpadeo = true) {
    let dx = hoyoPos.x - posBola.x;
    let dz = hoyoPos.y - posBola.y;
    if (!seVe(posBola.x, posBola.y, hoyoPos.x, hoyoPos.y)) {
      const k = Math.max(0, casillaDe(posBola.x, posBola.y));
      for (let j = casillas.length - 1; j > k; j--) {
        if (seVe(posBola.x, posBola.y, casillas[j].x, casillas[j].z) || j === k + 1) {
          dx = casillas[j].x - posBola.x;
          dz = casillas[j].z - posBola.y;
          break;
        }
      }
    }
    if (Math.hypot(dx, dz) < 1e-3) dz = -1;
    const giro = Math.atan2(dx, -dz);
    campo.rotation.y = giro;
    // posición = POS_BOLA − giro(bola)
    tmp.set(posBola.x, 0, posBola.y).applyAxisAngle(new THREE.Vector3(0, 1, 0), giro);
    campo.position.set(POS_BOLA.x - tmp.x, 0, POS_BOLA.z - tmp.z);
    campo.updateMatrixWorld(true);
    if (conParpadeo) ctx.destello(0x000000, 1);
  }

  // ─── Física de la bola ─────────────────────────────────────────────────
  // Choque con un segmento (que puede moverse: velocidad del punto de contacto vx, vz)
  const n2 = new THREE.Vector2();
  function chocarSegmento(ax, az, bx, bz, vx = 0, vz = 0, extra = 0) {
    const abx = bx - ax;
    const abz = bz - az;
    const largo2 = abx * abx + abz * abz;
    let t = largo2 > 0 ? ((posBola.x - ax) * abx + (posBola.y - az) * abz) / largo2 : 0;
    t = Math.max(0, Math.min(1, t));
    const qx = ax + abx * t;
    const qz = az + abz * t;
    n2.set(posBola.x - qx, posBola.y - qz);
    const d = n2.length();
    const radio = BOLA + extra;
    if (d >= radio || d < 1e-6) return;
    n2.divideScalar(d);
    posBola.set(qx + n2.x * radio, qz + n2.y * radio);
    const relativa = (velBola.x - vx) * n2.x + (velBola.y - vz) * n2.y;
    if (relativa < 0) {
      velBola.x -= (1 + REBOTE) * relativa * n2.x;
      velBola.y -= (1 + REBOTE) * relativa * n2.y;
      if (-relativa > 0.25 && tiempo - ultimoToc > 0.08) {
        ctx.sonido('toc');
        ultimoToc = tiempo;
      }
    }
  }

  function moverBola(dt) {
    const pasos = Math.max(1, Math.ceil((velBola.length() * dt) / 0.01));
    const h = dt / pasos;
    for (let p = 0; p < pasos; p++) {
      // Rozamiento
      const v = velBola.length();
      if (v > 0) {
        const nueva = Math.max(0, v - (FRENADO + FRENADO_VEL * v) * h);
        velBola.multiplyScalar(nueva / v);
      }
      posBola.addScaledVector(velBola, h);
      for (const w of paredes) chocarSegmento(w.ax, w.az, w.bx, w.bz);
      for (const s of postes) {
        n2.set(posBola.x - s.x, posBola.y - s.z);
        const d = n2.length();
        if (d < BOLA + s.r && d > 1e-6) {
          n2.divideScalar(d);
          posBola.set(s.x + n2.x * (BOLA + s.r), s.z + n2.y * (BOLA + s.r));
          const vn = velBola.dot(n2);
          if (vn < 0) velBola.addScaledVector(n2, -(1 + REBOTE) * vn);
          if (-vn > 0.25 && tiempo - ultimoToc > 0.08) { ctx.sonido('toc'); ultimoToc = tiempo; }
        }
      }
      if (molinoDatos) {
        const { x, z, angulo, vel, medio } = molinoDatos;
        const ux = Math.cos(angulo);
        const uz = -Math.sin(angulo);
        // Velocidad del aspa en el punto más cercano (ω × r)
        const rx = posBola.x - x;
        const rz = posBola.y - z;
        const largo = THREE.MathUtils.clamp(rx * ux + rz * uz, -medio, medio);
        chocarSegmento(x - ux * medio, z - uz * medio, x + ux * medio, z + uz * medio, vel * uz * largo, -vel * ux * largo, 0.03);
      }
      // ¿Al hoyo?
      const dh = Math.hypot(posBola.x - hoyoPos.x, posBola.y - hoyoPos.y);
      if (dh < RADIO_HOYO) {
        if (velBola.length() < VEL_EMBOCAR) {
          embocar();
          return;
        }
        // Demasiado rápida: roza el borde y sigue (se frena y se desvía un poco)
        velBola.multiplyScalar(0.75).rotateAround(new THREE.Vector2(), azar(-0.25, 0.25));
      }
    }
    if (velBola.length() > VEL_MAXIMA) velBola.setLength(VEL_MAXIMA);
    // Seguridad: si por lo que sea se sale del recorrido, vuelve a donde estaba
    if (casillaDe(posBola.x, posBola.y) < 0) {
      posBola.copy(ultimaQuieta);
      velBola.set(0, 0);
    }
  }

  // ─── Golpes ────────────────────────────────────────────────────────────
  function golpear(vx, vz, mano) {
    velBola.set(vx, vz);
    if (velBola.length() > VEL_MAXIMA) velBola.setLength(VEL_MAXIMA);
    golpes++;
    estado = 'rodando';
    quieta = 0;
    ctx.sonido('putt');
    if (mano) ctx.vibrar(mano, Math.min(1, 0.25 + velBola.length() * 0.15), 60);
  }

  function embocar() {
    velBola.set(0, 0);
    posBola.copy(hoyoPos);
    hundiendo = 0.001;
    tarjeta[hoyo] = golpes;
    estado = 'embocada';
    reloj = 2.8;
    const diferencia = golpes - pares[hoyo];
    const nombres = { '-3': '¡Albatros!', '-2': '¡Eagle!', '-1': '¡Birdie!', 0: 'Par', 1: 'Bogey', 2: 'Doble bogey' };
    mensaje = golpes === 1 ? '¡Hoyo en uno!' : (nombres[diferencia] || `+${diferencia}`);
    colorMensaje = diferencia < 0 ? '#ffe082' : diferencia === 0 ? '#b9f6ca' : '#ffffff';
    ctx.sonido('hoyo');
    if (diferencia < 0) ctx.destello(0xffd740, 0.25);
    for (const m of ctx.manos) if (m.activa) ctx.vibrar(m, 0.5, 120);
  }

  // Distancia que recorre la bola si sale a velocidad v (con el rozamiento de arriba)
  const distancia = (v) => v / FRENADO_VEL - (FRENADO / FRENADO_VEL ** 2) * Math.log(1 + (FRENADO_VEL * v) / FRENADO);
  function velocidadPara(d) {
    let a = 0;
    let b = VEL_MAXIMA;
    for (let i = 0; i < 30; i++) {
      const c = (a + b) / 2;
      if (distancia(c) < d) a = c;
      else b = c;
    }
    return (a + b) / 2;
  }

  // ─── Palo en VR ────────────────────────────────────────────────────────
  const cabezaLocal = new THREE.Vector3();      // cabeza del palo en el campo (este fotograma)
  const cabezaAnterior = new THREE.Vector3();
  let cabezaLista = false;
  let manoPalo = null;
  const direccion = new THREE.Vector3();
  const derechaMando = new THREE.Vector3();

  function actualizarPalo(dt) {
    const activas = ctx.manos.filter((m) => m.activa);
    for (const m of activas) {
      if (m.gatilloPulsado && (m.lado === 'left' || m.lado === 'right') && m.lado !== ladoPalo) {
        ladoPalo = m.lado;
        ctx.sonido('tic');
      }
    }
    const mano = activas.find((m) => m.lado === ladoPalo) || activas[0] || null;
    palo.visible = cabezaPalo.visible = !!mano;
    if (!mano) {
      cabezaLista = false;
      return;
    }
    if (mano !== manoPalo) cabezaLista = false;
    manoPalo = mano;
    // La vara sigue la dirección del mando; la cabeza, donde esa línea toca el suelo
    direccion.set(0, 0, -1).transformDirection(mano.grip.matrixWorld);
    derechaMando.set(1, 0, 0).transformDirection(mano.grip.matrixWorld);
    let largo = LARGO_MAX;
    if (direccion.y < -0.15) largo = THREE.MathUtils.clamp(mano.posicion.y / -direccion.y, LARGO_MIN, LARGO_MAX);
    tmp.copy(mano.posicion).addScaledVector(direccion, largo);
    if (tmp.y < 0.018) tmp.y = 0.018;
    cabezaPalo.position.copy(tmp);
    // Cabeza horizontal, con la cara mirando hacia delante del golpe
    cabezaPalo.rotation.set(0, Math.atan2(-derechaMando.z, derechaMando.x), 0);
    palo.position.copy(mano.posicion);
    tmp2.subVectors(tmp, mano.posicion);
    varaPalo.scale.y = tmp2.length();
    palo.quaternion.setFromUnitVectors(new THREE.Vector3(0, 1, 0), tmp2.normalize());

    // Choque con la bola (en coordenadas del campo, por subpasos)
    inversa.copy(campo.matrixWorld).invert();
    cabezaLocal.copy(cabezaPalo.position).applyMatrix4(inversa);
    if (!cabezaLista) {
      cabezaAnterior.copy(cabezaLocal);
      cabezaLista = true;
      return;
    }
    if (estado === 'apuntando' && cabezaPalo.position.y < 0.12) {
      const vx = (cabezaLocal.x - cabezaAnterior.x) / dt;
      const vz = (cabezaLocal.z - cabezaAnterior.z) / dt;
      const rapidez = Math.hypot(vx, vz);
      for (let p = 1; p <= 4 && rapidez > 0.15; p++) {
        const f = p / 4;
        const x = cabezaAnterior.x + (cabezaLocal.x - cabezaAnterior.x) * f;
        const z = cabezaAnterior.z + (cabezaLocal.z - cabezaAnterior.z) * f;
        const dx = posBola.x - x;
        const dz = posBola.y - z;
        // Cerca de la bola y yendo hacia ella
        if (Math.hypot(dx, dz) < BOLA + RADIO_CABEZA && dx * vx + dz * vz > 0) {
          golpear(vx * 1.15, vz * 1.15, mano);
          break;
        }
      }
    }
    cabezaAnterior.copy(cabezaLocal);
  }

  // ─── Ratón o dedo: clic donde quieres que llegue la bola ──────────────
  function apuntarRaton() {
    const raton = ctx.raton;
    const visible = estado === 'apuntando' && raton.dentro && raton.rayo.ray.intersectPlane(planoSuelo, tmp);
    lineaApunte.visible = marcaApunte.visible = !!visible;
    if (!visible) return;
    inversa.copy(campo.matrixWorld).invert();
    tmp.applyMatrix4(inversa);
    let dx = tmp.x - posBola.x;
    let dz = tmp.z - posBola.y;
    let d = Math.hypot(dx, dz);
    if (d < 0.05) return;
    const maxima = distancia(VEL_MAXIMA);
    if (d > maxima) {
      dx *= maxima / d;
      dz *= maxima / d;
      d = maxima;
    }
    lineaApunte.position.set(posBola.x, 0.006, posBola.y);
    lineaApunte.rotation.y = Math.atan2(-dx, -dz);
    lineaApunte.scale.z = d;
    marcaApunte.position.set(posBola.x + dx, 0.006, posBola.y + dz);
    if (raton.clic) {
      const v = velocidadPara(d);
      golpear((dx / d) * v, (dz / d) * v, null);
      lineaApunte.visible = marcaApunte.visible = false;
    }
  }

  // ─── Marcador ──────────────────────────────────────────────────────────
  const total = () => tarjeta.reduce((s, g) => s + (g || 0), 0);
  const parJugado = () => tarjeta.reduce((s, g, i) => s + (g ? pares[i] : 0), 0);
  const conSigno = (n) => (n > 0 ? `+${n}` : n === 0 ? 'par' : `${n}`);
  function actualizarMarcador() {
    const fila = Array.from({ length: HOYOS }, (_, i) => (tarjeta[i] ? String(tarjeta[i]) : '·')).join(' ');
    const pie = { texto: `${fila}   ·   Total ${total()} (${conSigno(total() - parJugado())})${record !== null ? `   ·   Récord ${record}` : ''}`, tam: 0.7, color: '#ffe082' };
    if (estado === 'intro') {
      marcador.escribir([
        { texto: 'MINIGOLF', tam: 1.2, color: '#b9f6ca' },
        { texto: ctx.enVR() ? 'El palo va en tu mano y llega solo al suelo: golpea la bola con suavidad' : (ctx.tactil ? 'Toca donde quieres que llegue la bola' : 'Haz clic donde quieres que llegue la bola: más lejos, más fuerte'), tam: 0.7 },
        { texto: `${HOYOS} hoyos nuevos en cada ronda · máximo: par + ${GOLPES_EXTRA} golpes`, tam: 0.7, color: '#ffe082' },
      ]);
    } else if (estado === 'fin') {
      marcador.escribir([
        { texto: `¡Ronda terminada! ${total()} golpes (${conSigno(total() - parJugado())})`, tam: 1.2, color: '#b9f6ca' },
        { texto: `Récord: ${record} · nueva ronda en ${Math.ceil(reloj)}`, tam: 0.7 },
        pie,
      ]);
    } else if (estado === 'embocada') {
      marcador.escribir([
        { texto: `${mensaje}`, tam: 1.2, color: colorMensaje },
        { texto: `Hoyo ${hoyo + 1} en ${golpes} ${golpes === 1 ? 'golpe' : 'golpes'} · par ${pares[hoyo]}`, tam: 0.7 },
        pie,
      ]);
    } else {
      marcador.escribir([
        { texto: `Hoyo ${hoyo + 1} de ${HOYOS} · Par ${pares[hoyo]}`, tam: 1.2 },
        { texto: golpes ? `Golpe ${golpes + (estado === 'apuntando' ? 1 : 0)}${golpes >= pares[hoyo] + GOLPES_EXTRA - 1 ? ' · ¡último!' : ''}` : (ctx.enVR() ? 'Golpe 1 · el gatillo de la otra mano cambia el palo de mano' : 'Golpe 1'), tam: 0.7 },
        pie,
      ]);
    }
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function empezarHoyo(numero) {
    hoyo = numero;
    golpes = 0;
    generarHoyo(numero);
    recolocar(numero > 0 || estado !== 'intro');
    estado = 'apuntando';
  }

  function actualizar(dt, t) {
    reloj -= dt;
    tiempo = t;

    if (molinoDatos) {
      molinoDatos.angulo += molinoDatos.vel * dt;
      molino.rotation.y = molinoDatos.angulo;
    }

    switch (estado) {
      case 'intro':
        if (reloj <= 0) {
          tarjeta = [];
          empezarHoyo(0);
        }
        break;
      case 'rodando':
        moverBola(dt);
        if (estado !== 'rodando') break;
        quieta = velBola.length() < 0.02 ? quieta + dt : 0;
        if (quieta > 0.3) {
          velBola.set(0, 0);
          ultimaQuieta.copy(posBola);
          if (golpes >= pares[hoyo] + GOLPES_EXTRA) {
            // Máximo de golpes: cuenta uno más y al siguiente
            golpes = pares[hoyo] + GOLPES_EXTRA + 1;
            tarjeta[hoyo] = golpes;
            mensaje = `Máximo de golpes · ${golpes}`;
            colorMensaje = '#ff8a80';
            estado = 'embocada';
            reloj = 2.5;
            ctx.sonido('fallo');
          } else {
            recolocar();
            estado = 'apuntando';
          }
        }
        break;
      case 'embocada':
        if (reloj <= 0) {
          if (hoyo + 1 < HOYOS) {
            empezarHoyo(hoyo + 1);
          } else {
            estado = 'fin';
            reloj = 9;
            if (record === null || total() < record) {
              record = total();
              ctx.guardar('record', record);
            }
            ctx.sonido('fin');
          }
        }
        break;
      case 'fin':
        if (reloj <= 0) {
          tarjeta = [];
          empezarHoyo(0);
        }
        break;
    }

    // Bola (y su caída al hoyo)
    let y = BOLA;
    if (hundiendo > 0) {
      hundiendo += dt;
      y = BOLA - Math.min(1, hundiendo / 0.25) * BOLA * 2.2;
      if (estado !== 'embocada') hundiendo = 0;
    }
    bola.position.set(posBola.x, y, posBola.y);
    bola.visible = y > -BOLA;
    if (velBola.lengthSq() > 0) bola.rotation.x -= (velBola.length() / BOLA) * dt;
    ctx.colocarSombra(sombraBola, bola.position, 0);
    sombraBola.visible = hundiendo === 0;

    if (ctx.enVR()) {
      lineaApunte.visible = marcaApunte.visible = false;
      actualizarPalo(dt);
    } else {
      palo.visible = cabezaPalo.visible = false;
      apuntarRaton();
    }
    actualizarMarcador();
  }

  // El primer hoyo ya se ve durante la presentación
  generarHoyo(0);
  recolocar(false);
  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      limpiarHoyo();
    },
  };
}
