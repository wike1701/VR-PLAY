// PARA PENALTIS
// Eres el portero. Un jugador chuta 10 penaltis por tanda: páralos con los
// guantes (o con el cuerpo) en VR, o moviendo los guantes con el ratón.
// La portería es más pequeña que la real para que llegues sin tirarte al suelo.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const PENALTIS = 10;
const G = 9.8;
const ANCHO = 3.2;            // portería reducida (la real mide 7,32 × 2,44)
const ALTO = 2.0;
const LINEA_GOL = 0.5;        // la línea de gol queda medio metro detrás del jugador
const FONDO_RED = 1.6;
const PUNTO_PENALTI = new THREE.Vector3(0, 0.11, -11);
const RADIO_BALON = 0.11;
const RADIO_GUANTE = 0.12;
const RADIO_CABEZA = 0.13;
const RADIO_TORSO = 0.18;
const PLANO_RATON = -0.3;     // en modo escritorio los guantes se mueven en este plano
const VELOCIDAD_RATON = 7;    // m/s máximos de los guantes con ratón (si no, sería demasiado fácil)

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  ctx.fondo(0x86b8e0);
  // El lanzador está lejos: alejamos la niebla mientras dura este juego
  const niebla = ctx.escena.fog;
  const nieblaOriginal = { near: niebla.near, far: niebla.far };
  niebla.near = 25;
  niebla.far = 60;
  const vistaPos = new THREE.Vector3(0, 1.25, 1.1);
  ctx.vistaEscritorio(vistaPos, new THREE.Vector3(0, 0.9, -11));

  // ─── Utilidades de geometría ───────────────────────────────────────────
  // Coloca una geometría en su sitio (rotación y posición "horneadas").
  const matrizTmp = new THREE.Matrix4();
  const eulerTmp = new THREE.Euler();
  function colocar(geo, x, y, z, rx = 0, ry = 0, rz = 0) {
    matrizTmp.makeRotationFromEuler(eulerTmp.set(rx, ry, rz)).setPosition(x, y, z);
    return geo.applyMatrix4(matrizTmp);
  }
  // Multiplica las UV de una geometría (para repetir la textura según su tamaño).
  function escalarUV(geo, su, sv, dv = 0) {
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, dv + uv.getY(i) * sv);
    return geo;
  }
  // Fusiona varias geometrías (position/normal/uv) en una: una sola llamada de dibujo.
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

  // ─── Campo y portería ──────────────────────────────────────────────────
  ctx.sueloBase(false);
  // Césped con franjas de corte paralelas a la línea de gol (cada franja, 2,5 m)
  const FRANJA = 2.5;
  const texCesped = R(ctx.texturas.cesped(0x4ca84a, { tam: 512, semilla: 4 }));
  {
    const g = texCesped.image.getContext('2d');
    const tam = texCesped.image.width;
    g.fillStyle = 'rgba(255,255,225,0.09)';
    g.fillRect(0, 0, tam, tam / 2);
    g.fillStyle = 'rgba(0,40,0,0.10)';
    g.fillRect(0, tam / 2, tam, tam / 2);
    texCesped.needsUpdate = true;
  }
  const CAMPO_ANCHO = 60;
  const CAMPO_LARGO = 44;
  const geoCesped = escalarUV(new THREE.PlaneGeometry(CAMPO_ANCHO, CAMPO_LARGO), CAMPO_ANCHO / (FRANJA * 2), CAMPO_LARGO / (FRANJA * 2));
  const cesped = new THREE.Mesh(R(geoCesped), R(new THREE.MeshLambertMaterial({ map: texCesped })));
  cesped.rotation.x = -Math.PI / 2;
  // Colocado para que el borde de una franja caiga justo en la línea de gol
  cesped.position.set(0, 0.003, LINEA_GOL - CAMPO_LARGO / 2 + 10);
  raiz.add(cesped);

  // Líneas de cal y punto de penalti: una sola malla
  const matCal = R(new THREE.MeshBasicMaterial({ color: 0xf4f4f4 }));
  const lineas = [
    [ANCHO + 6, 0.08, 0, LINEA_GOL],      // línea de gol
    [ANCHO + 6, 0.08, 0, -5.5],           // área
    [0.08, 6, -(ANCHO / 2 + 3), -2.5],
    [0.08, 6, ANCHO / 2 + 3, -2.5],
  ].map(([ancho, largo, x, z]) => colocar(new THREE.PlaneGeometry(ancho, largo), x, 0.006, z, -Math.PI / 2));
  lineas.push(colocar(new THREE.CircleGeometry(0.12, 16), PUNTO_PENALTI.x, 0.006, PUNTO_PENALTI.z, -Math.PI / 2));
  raiz.add(new THREE.Mesh(fusionar(lineas), matCal));

  // Postes y larguero (una malla)
  const porteria = new THREE.Mesh(
    fusionar([
      colocar(new THREE.CylinderGeometry(0.05, 0.05, ALTO, 16), -ANCHO / 2, ALTO / 2, LINEA_GOL),
      colocar(new THREE.CylinderGeometry(0.05, 0.05, ALTO, 16), ANCHO / 2, ALTO / 2, LINEA_GOL),
      colocar(new THREE.CylinderGeometry(0.05, 0.05, ANCHO + 0.1, 16), 0, ALTO, LINEA_GOL, 0, 0, Math.PI / 2),
      // Barras traseras que sujetan la red, a ras de suelo
      colocar(new THREE.CylinderGeometry(0.02, 0.02, ANCHO, 6), 0, 0.02, LINEA_GOL + FONDO_RED, 0, 0, Math.PI / 2),
      colocar(new THREE.CylinderGeometry(0.02, 0.02, FONDO_RED, 6), -ANCHO / 2, 0.02, LINEA_GOL + FONDO_RED / 2, Math.PI / 2),
      colocar(new THREE.CylinderGeometry(0.02, 0.02, FONDO_RED, 6), ANCHO / 2, 0.02, LINEA_GOL + FONDO_RED / 2, Math.PI / 2),
    ]),
    R(new THREE.MeshStandardMaterial({ color: 0xffffff, roughness: 0.35, metalness: 0.1 })),
  );
  raiz.add(porteria);
  const sombraPorteria = ctx.crearSombra({ radio: 1, opacidad: 0.25 });
  sombraPorteria.scale.set(ANCHO + 0.6, 1, FONDO_RED + 0.6);
  sombraPorteria.position.set(0, 0.007, LINEA_GOL + FONDO_RED / 2);
  raiz.add(sombraPorteria);
  // Red: las cuatro caras en una sola malla de alambre
  const matRed = R(new THREE.MeshBasicMaterial({ color: 0xffffff, wireframe: true, transparent: true, opacity: 0.4 }));
  const red = new THREE.Mesh(
    fusionar([
      colocar(new THREE.PlaneGeometry(ANCHO, ALTO, 16, 10), 0, ALTO / 2, LINEA_GOL + FONDO_RED),
      colocar(new THREE.PlaneGeometry(ANCHO, FONDO_RED, 16, 8), 0, ALTO, LINEA_GOL + FONDO_RED / 2, Math.PI / 2),
      colocar(new THREE.PlaneGeometry(FONDO_RED, ALTO, 8, 10), -ANCHO / 2, ALTO / 2, LINEA_GOL + FONDO_RED / 2, 0, Math.PI / 2),
      colocar(new THREE.PlaneGeometry(FONDO_RED, ALTO, 8, 10), ANCHO / 2, ALTO / 2, LINEA_GOL + FONDO_RED / 2, 0, Math.PI / 2),
    ]),
    matRed,
  );
  raiz.add(red);

  // ─── Estadio: vallas publicitarias y grada ─────────────────────────────
  // Vallas: cada repetición de la textura son 4 m con dos anuncios.
  const VALLA_ALTO = 0.9;
  const texVallas = R(ctx.texturaCanvas((g, tam) => {
    const altoVirtual = tam * (VALLA_ALTO / 4);
    g.save();
    g.scale(1, tam / altoVirtual); // dibujamos en proporción real 4 m × 0,9 m
    const anuncios = [
      ['#5b2bd6', '#ffffff', 'VR PLAY'],
      ['#f5f5f5', '#d32f2f', '¡PARA ESTE!'],
    ];
    anuncios.forEach(([fondo, color, texto], i) => {
      const x = (i * tam) / 2;
      g.fillStyle = fondo;
      g.fillRect(x, 0, tam / 2, altoVirtual);
      g.fillStyle = color;
      g.font = `900 ${Math.round(altoVirtual * 0.5)}px system-ui, sans-serif`;
      g.textAlign = 'center';
      g.textBaseline = 'middle';
      g.fillText(texto, x + tam / 4, altoVirtual * 0.54, tam * 0.44);
      g.fillStyle = 'rgba(0,0,0,0.5)';
      g.fillRect(x, 0, 2, altoVirtual);
    });
    g.restore();
  }, { tam: 512 }));
  const valla = (largo, x, z, ry) =>
    colocar(escalarUV(new THREE.PlaneGeometry(largo, VALLA_ALTO), largo / 4, 1), x, VALLA_ALTO / 2, z, 0, ry);
  const FONDO_ESTADIO = -20;
  const vallas = new THREE.Mesh(
    fusionar([
      valla(40, 0, FONDO_ESTADIO, 0),                   // fondo, detrás del lanzador
      valla(20, -16, -10, Math.PI / 2),                 // laterales
      valla(20, 16, -10, -Math.PI / 2),
      valla(16, 0, LINEA_GOL + FONDO_RED + 2, Math.PI), // detrás de la portería
    ]),
    R(new THREE.MeshBasicMaterial({ map: texVallas })),
  );
  raiz.add(vallas);

  // Grada con público: arriba de la textura, gente vista desde arriba; abajo, de frente.
  const texGrada = R(ctx.texturaCanvas((g, tam, azar) => {
    g.fillStyle = '#626a78';
    g.fillRect(0, 0, tam, tam);
    const colores = ['#d32f2f', '#f5f5f5', '#1e88e5', '#fdd835', '#43a047', '#212121', '#ff7043', '#8e24aa'];
    const personas = 12;
    const ancho = tam / personas;
    for (const [y0, alto] of [[0, tam / 2], [tam / 2, tam / 2]]) {
      for (let k = 0; k < personas; k++) {
        if (azar() < 0.12) continue; // algún asiento vacío
        const x = k * ancho + (azar() - 0.5) * ancho * 0.2;
        const piel = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524'][Math.floor(azar() * 4)];
        g.fillStyle = colores[Math.floor(azar() * colores.length)];
        g.fillRect(x + ancho * 0.12, y0 + alto * 0.42, ancho * 0.76, alto * 0.58);   // cuerpo
        g.fillStyle = piel;
        g.beginPath();
        g.arc(x + ancho / 2, y0 + alto * 0.3, ancho * 0.26, 0, Math.PI * 2);         // cabeza
        g.fill();
      }
    }
  }, { tam: 256, semilla: 9 }));
  function filasGrada(largo, filas, fondoFila, altoFila, z) {
    const piezas = [];
    for (let i = 0; i < filas; i++) {
      const piso = escalarUV(new THREE.PlaneGeometry(largo, fondoFila), largo / 4, 0.5, 0.5);
      const contra = escalarUV(new THREE.PlaneGeometry(largo, altoFila), largo / 4, 0.5, 0);
      piezas.push(
        colocar(piso, 0, (i + 1) * altoFila, z - (i + 0.5) * fondoFila, -Math.PI / 2),
        colocar(contra, 0, (i + 0.5) * altoFila, z - i * fondoFila),
      );
    }
    return piezas;
  }
  const grada = new THREE.Mesh(fusionar(filasGrada(50, 9, 0.8, 0.55, FONDO_ESTADIO - 1.5)), R(new THREE.MeshLambertMaterial({ map: texGrada })));
  raiz.add(grada);

  // ─── Balón ─────────────────────────────────────────────────────────────
  // Balón clásico de pentágonos y hexágonos pintado en la textura: cada píxel toma el
  // color del centro de cara más cercano de un icosaedro truncado.
  const centrosBalon = [];
  {
    const ico = new THREE.IcosahedronGeometry(1, 0);
    const p = ico.attributes.position;
    for (let i = 0; i < p.count; i++) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i).normalize();
      if (!centrosBalon.some((c) => c.pentagono && c.v.distanceTo(v) < 1e-3)) centrosBalon.push({ v, pentagono: true });
    }
    for (let i = 0; i < p.count; i += 3) {
      const v = new THREE.Vector3().fromBufferAttribute(p, i)
        .add(new THREE.Vector3().fromBufferAttribute(p, i + 1))
        .add(new THREE.Vector3().fromBufferAttribute(p, i + 2))
        .normalize();
      centrosBalon.push({ v, pentagono: false });
    }
    ico.dispose();
  }
  const texBalon = R(ctx.texturaCanvas((g, tam) => {
    const imagen = g.createImageData(tam, tam);
    const d = imagen.data;
    const PESO_PENTAGONO = 0.075; // los pentágonos son algo más pequeños que los hexágonos
    for (let py = 0; py < tam; py++) {
      const theta = ((py + 0.5) / tam) * Math.PI;
      const st = Math.sin(theta);
      const y = Math.cos(theta);
      for (let px = 0; px < tam; px++) {
        const phi = ((px + 0.5) / tam) * Math.PI * 2;
        const x = -Math.cos(phi) * st;
        const z = Math.sin(phi) * st;
        let mejor = 9;
        let segundo = 9;
        let pent = false;
        for (const c of centrosBalon) {
          const a = Math.acos(Math.min(1, c.v.x * x + c.v.y * y + c.v.z * z)) + (c.pentagono ? PESO_PENTAGONO : 0);
          if (a < mejor) {
            segundo = mejor;
            mejor = a;
            pent = c.pentagono;
          } else if (a < segundo) {
            segundo = a;
          }
        }
        const k = (py * tam + px) * 4;
        const costura = segundo - mejor < 0.035;
        const valor = costura ? 120 : pent ? 28 : 246;
        d[k] = d[k + 1] = d[k + 2] = valor;
        d[k + 3] = 255;
      }
    }
    g.putImageData(imagen, 0, 0);
  }, { tam: 512 }));
  const balon = new THREE.Mesh(R(new THREE.SphereGeometry(RADIO_BALON, 28, 18)), R(new THREE.MeshStandardMaterial({ map: texBalon, roughness: 0.45 })));
  raiz.add(balon);
  const sombraBalon = ctx.crearSombra({ radio: 0.13, opacidad: 0.55 });
  raiz.add(sombraBalon);

  // ─── Lanzador ──────────────────────────────────────────────────────────
  // Construido mirando a +Z (hacia el portero)
  const lanzador = new THREE.Group();
  const matCamiseta = R(new THREE.MeshLambertMaterial({ color: 0xd32f2f }));
  const matPantalon = R(new THREE.MeshLambertMaterial({ color: 0xffffff }));
  const matPiel = R(new THREE.MeshLambertMaterial({ color: 0xffcc80 }));
  const geoPierna = R(new THREE.BoxGeometry(0.13, 0.85, 0.13));
  geoPierna.translate(0, -0.425, 0);
  // Camiseta con mangas cortas, y cabeza con brazos (una malla por material)
  const torso = new THREE.Mesh(
    fusionar([
      colocar(new THREE.BoxGeometry(0.42, 0.6, 0.24), 0, 1.2, 0),
      colocar(new THREE.BoxGeometry(0.12, 0.18, 0.13), -0.27, 1.4, 0, 0, 0, -0.12),
      colocar(new THREE.BoxGeometry(0.12, 0.18, 0.13), 0.27, 1.4, 0, 0, 0, 0.12),
    ]),
    matCamiseta,
  );
  const cabeza = new THREE.Mesh(
    fusionar([
      colocar(new THREE.SphereGeometry(0.12, 16, 12), 0, 1.65, 0),
      colocar(new THREE.CylinderGeometry(0.05, 0.05, 0.08, 8), 0, 1.52, 0),           // cuello
      colocar(new THREE.BoxGeometry(0.08, 0.42, 0.08), -0.29, 1.12, 0, 0, 0, -0.12),  // brazos
      colocar(new THREE.BoxGeometry(0.08, 0.42, 0.08), 0.29, 1.12, 0, 0, 0, 0.12),
    ]),
    matPiel,
  );
  lanzador.add(torso, cabeza);
  const piernas = [-1, 1].map((lado) => {
    const pierna = new THREE.Mesh(geoPierna, matPantalon);
    pierna.position.set(lado * 0.11, 0.88, 0);
    lanzador.add(pierna);
    return pierna;
  });
  raiz.add(lanzador);
  const sombraLanzador = ctx.crearSombra({ radio: 0.4, opacidad: 0.45 });
  raiz.add(sombraLanzador);
  const SALIDA_LANZADOR = new THREE.Vector3(-1.3, 0, -13.4);
  const LLEGADA_LANZADOR = new THREE.Vector3(-0.32, 0, -11.45);

  // ─── Guantes ───────────────────────────────────────────────────────────
  // Palma y pulgar fusionados (una geometría para cada mano)
  const geoGuante = {};
  for (const lado of [-1, 1]) {
    geoGuante[lado] = fusionar([
      colocar(new THREE.BoxGeometry(0.13, 0.16, 0.05), 0, 0.03, -0.06),
      colocar(new THREE.BoxGeometry(0.04, 0.08, 0.04), -lado * 0.08, 0, -0.06, 0, 0, lado * 0.5),
    ]);
  }
  const matGuante = R(new THREE.MeshStandardMaterial({ color: 0x76ff03, roughness: 0.7 }));
  const matPuno = R(new THREE.MeshLambertMaterial({ color: 0x212121 }));
  const geoPuno = R(new THREE.CylinderGeometry(0.045, 0.045, 0.06, 12));

  function crearGuante(lado) {
    const g = new THREE.Group();
    // Palma mirando hacia delante (-Z), dedos hacia arriba
    const mano = new THREE.Mesh(geoGuante[lado], matGuante);
    const puno = new THREE.Mesh(geoPuno, matPuno);
    puno.position.set(0, -0.07, -0.06);
    g.add(mano, puno);
    return g;
  }

  const guantesVR = ctx.manos.map((mano, i) => {
    // Si aún no se sabe qué mando es cuál, el primero es el izquierdo
    const lado = mano.lado ? (mano.lado === 'left' ? -1 : 1) : (i === 0 ? -1 : 1);
    return { mano, objeto: ctx.adjuntarAMano(mano, crearGuante(lado)), pos: new THREE.Vector3() };
  });

  // Guantes del modo escritorio (siguen al ratón)
  const parRaton = new THREE.Group();
  for (const lado of [-1, 1]) {
    const g = crearGuante(lado);
    g.position.x = lado * 0.11;
    g.position.z = 0.06;
    parRaton.add(g);
  }
  parRaton.position.set(0, 1, PLANO_RATON);
  raiz.add(parRaton);
  const planoRaton = new THREE.Plane(new THREE.Vector3(0, 0, 1), -PLANO_RATON);
  const destinoRaton = new THREE.Vector3(0, 1, PLANO_RATON);

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 3.4, alto: 0.92 });
  marcador.mesh.position.set(0, 3.4, -13);
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'espera' | 'carrera' | 'vuelo' | 'resultado' | 'fin'
  let reloj = 3.5;
  let tiro = 0;                 // penalti actual (0..9)
  let resultados = [];          // 'parada' | 'gol' | 'fuera'
  let record = ctx.leer('record', 0);
  let mensaje = '';
  let colorMensaje = '#ffffff';
  const vel = new THREE.Vector3();
  const efecto = new THREE.Vector3(); // aceleración lateral (balón con efecto)
  let resuelto = null;          // resultado del tiro en curso
  let vidaBalon = 0;

  const cabezaJugador = new THREE.Vector3();
  const torso1 = new THREE.Vector3();
  const torso2 = new THREE.Vector3();
  const segmentoTorso = new THREE.Line3();
  const anterior = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();

  const paradas = () => resultados.filter((r) => r === 'parada').length;

  function actualizarMarcador() {
    const fila = Array.from({ length: PENALTIS }, (_, i) =>
      i < resultados.length ? { gol: '✘', parada: '✔', fuera: '○' }[resultados[i]] : '·').join(' ');
    if (estado === 'intro') {
      marcador.escribir([
        { texto: 'PARA PENALTIS', tam: 1.3, color: '#b9f6ca' },
        { texto: ctx.enVR() ? 'Para el balón con los guantes o con el cuerpo' : 'Mueve los guantes con el ratón', tam: 0.7 },
        { texto: `${PENALTIS} penaltis por tanda · Récord: ${record} paradas`, tam: 0.7, color: '#b9f6ca' },
      ]);
    } else if (estado === 'fin') {
      marcador.escribir([
        { texto: `${paradas()} paradas de ${PENALTIS}`, tam: 1.3, color: '#b9f6ca' },
        { texto: fila, tam: 0.8 },
        { texto: `Récord: ${record} · otra tanda en ${Math.ceil(reloj)}`, tam: 0.7 },
      ]);
    } else {
      marcador.escribir([
        estado === 'resultado'
          ? { texto: mensaje, tam: 1.3, color: colorMensaje }
          : { texto: `Penalti ${tiro + 1} de ${PENALTIS}`, tam: 1.3 },
        { texto: fila, tam: 0.8 },
        { texto: `Paradas: ${paradas()}   ·   Récord: ${record}`, tam: 0.7, color: '#b9f6ca' },
      ]);
    }
  }

  // ─── Penaltis ──────────────────────────────────────────────────────────
  function prepararTiro() {
    estado = 'espera';
    reloj = 1.4;
    balon.position.copy(PUNTO_PENALTI);
    balon.rotation.set(0, 0, 0);
    vel.set(0, 0, 0);
    lanzador.position.copy(SALIDA_LANZADOR);
    lanzador.lookAt(PUNTO_PENALTI.x, 0, PUNTO_PENALTI.z);
    for (const p of piernas) p.rotation.x = 0;
    resuelto = null;
  }

  function chutar() {
    const progreso = tiro / (PENALTIS - 1);
    // A dónde va: cada vez más a las esquinas, y alguno se va fuera
    let x;
    let y;
    if (Math.random() < 0.08) {
      x = (Math.random() < 0.5 ? -1 : 1) * (ANCHO / 2 + 0.3 + Math.random() * 0.4);
      y = 0.3 + Math.random() * 1.6;
    } else {
      const lado = Math.random() < 0.5 ? -1 : 1;
      const esquina = Math.min(1, 0.3 + progreso * 0.7);
      x = lado * (Math.random() * (1 - esquina) + esquina) * (ANCHO / 2 - 0.25);
      y = 0.2 + Math.random() * (ALTO - 0.45);
    }
    const objetivo = tmp.set(x, y, LINEA_GOL);
    const rapidez = 10 + progreso * 7 + Math.random() * 2;
    const t = objetivo.distanceTo(PUNTO_PENALTI) / rapidez;
    // Efecto lateral a partir del cuarto penalti
    efecto.set(tiro >= 3 && Math.random() < 0.5 ? (Math.random() - 0.5) * 8 : 0, -G, 0);
    // p = p0 + v·t + ½·a·t²  →  v = (p − p0 − ½·a·t²) / t
    vel.copy(objetivo).sub(PUNTO_PENALTI).addScaledVector(efecto, -0.5 * t * t).divideScalar(t);
    estado = 'vuelo';
    vidaBalon = 3;
    ctx.sonido('patada');
  }

  function terminarTiro(resultado, texto, color) {
    resuelto = resultado;
    resultados.push(resultado);
    mensaje = texto;
    colorMensaje = color;
    estado = 'resultado';
    reloj = 1.6;
    if (resultado === 'gol') {
      ctx.sonido('fallo');
      ctx.destello(0xff1744, 0.35);
    } else if (resultado === 'parada') {
      ctx.sonido('punto');
    }
  }

  // ─── Posición del cuerpo y de los guantes ──────────────────────────────
  function actualizarPortero(dt) {
    if (ctx.enVR()) {
      parRaton.visible = false;
      ctx.camara.getWorldPosition(cabezaJugador);
      torso1.set(cabezaJugador.x, cabezaJugador.y - 0.28, cabezaJugador.z + 0.03);
      torso2.set(cabezaJugador.x, Math.max(0.35, cabezaJugador.y - 0.85), cabezaJugador.z + 0.03);
      segmentoTorso.set(torso2, torso1);
      for (const g of guantesVR) g.mano.grip.localToWorld(g.pos.set(0, 0.03, -0.06));
    } else {
      parRaton.visible = ctx.raton.dentro;
      if (ctx.raton.rayo.ray.intersectPlane(planoRaton, tmp)) {
        destinoRaton.set(THREE.MathUtils.clamp(tmp.x, -ANCHO / 2 - 0.3, ANCHO / 2 + 0.3), THREE.MathUtils.clamp(tmp.y, 0.1, ALTO + 0.2), PLANO_RATON);
      }
      // Los guantes van hacia el ratón con velocidad limitada
      const paso = tmp2.subVectors(destinoRaton, parRaton.position);
      const maximo = VELOCIDAD_RATON * dt;
      if (paso.length() > maximo) paso.setLength(maximo);
      parRaton.position.add(paso);
    }
  }

  // ¿Toca el balón algo del portero en este punto? Devuelve la normal del rebote o null.
  function contacto(punto) {
    if (ctx.enVR()) {
      for (const g of guantesVR) {
        if (g.mano.activa && punto.distanceTo(g.pos) < RADIO_GUANTE + RADIO_BALON) {
          ctx.vibrar(g.mano, 1, 150);
          return { normal: tmp2.subVectors(punto, g.pos).normalize(), texto: '¡PARADÓN!' };
        }
      }
      if (punto.distanceTo(cabezaJugador) < RADIO_CABEZA + RADIO_BALON) {
        return { normal: tmp2.subVectors(punto, cabezaJugador).normalize(), texto: '¡De cabeza!' };
      }
      const cercano = segmentoTorso.closestPointToPoint(punto, true, tmp2);
      if (cercano.distanceTo(punto) < RADIO_TORSO + RADIO_BALON) {
        for (const g of guantesVR) ctx.vibrar(g.mano, 0.6, 120);
        return { normal: tmp2.subVectors(punto, cercano).normalize(), texto: '¡Con el cuerpo!' };
      }
      return null;
    }
    // Con ratón el par de guantes es algo más grande: se mueve en un plano y no hay cuerpo
    if (parRaton.visible && punto.distanceTo(parRaton.position) < RADIO_GUANTE * 1.6 + RADIO_BALON) {
      return { normal: tmp2.subVectors(punto, parRaton.position).normalize(), texto: '¡PARADÓN!' };
    }
    return null;
  }

  function moverBalon(dt) {
    const pos = balon.position;
    const pasos = Math.max(1, Math.ceil((vel.length() * dt) / 0.04));
    const h = dt / pasos;
    for (let i = 0; i < pasos; i++) {
      anterior.copy(pos);
      vel.addScaledVector(efecto, h);
      pos.addScaledVector(vel, h);

      if (!resuelto) {
        const toque = contacto(pos);
        if (toque) {
          const vn = vel.dot(toque.normal);
          if (vn < 0) vel.addScaledVector(toque.normal, -1.5 * vn);
          vel.multiplyScalar(0.55);
          vel.z = Math.min(vel.z, -2); // despejado hacia el campo
          efecto.set(0, -G, 0);
          terminarTiro('parada', toque.texto, '#b9f6ca');
        } else if (anterior.z < LINEA_GOL && pos.z >= LINEA_GOL) {
          const dentro = Math.abs(pos.x) < ANCHO / 2 - RADIO_BALON && pos.y < ALTO - RADIO_BALON;
          if (dentro) terminarTiro('gol', '¡GOL!', '#ff8a80');
          else terminarTiro('fuera', '¡Fuera!', '#fff59d');
          efecto.set(0, -G, 0);
        }
      }

      // La red frena el balón
      if (resuelto === 'gol' && pos.z > LINEA_GOL + FONDO_RED - RADIO_BALON) {
        pos.z = LINEA_GOL + FONDO_RED - RADIO_BALON;
        vel.z *= -0.15;
        vel.x *= 0.3;
      }
      // Suelo
      if (pos.y < RADIO_BALON) {
        pos.y = RADIO_BALON;
        if (vel.y < 0) vel.y *= -0.5;
        vel.x *= 0.98;
        vel.z *= 0.98;
      }
    }
    balon.rotation.x += vel.z * dt * 5;
    balon.rotation.z -= vel.x * dt * 5;
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function empezarTanda() {
    tiro = 0;
    resultados = [];
    prepararTiro();
  }

  function actualizar(dt, t) {
    reloj -= dt;
    actualizarPortero(dt);

    switch (estado) {
      case 'intro':
        if (reloj <= 0) empezarTanda();
        break;
      case 'espera':
        if (reloj <= 0) {
          estado = 'carrera';
          reloj = 1.1;
          ctx.sonido('silbato');
        }
        break;
      case 'carrera': {
        // Carrerilla hacia el balón y patada
        const f = 1 - Math.max(0, reloj) / 1.1;
        lanzador.position.lerpVectors(SALIDA_LANZADOR, LLEGADA_LANZADOR, Math.min(1, f / 0.85));
        if (f < 0.85) {
          piernas[0].rotation.x = Math.sin(t * 14) * 0.7;
          piernas[1].rotation.x = -Math.sin(t * 14) * 0.7;
        } else {
          piernas[0].rotation.x = 0;
          piernas[1].rotation.x = -1.2 * ((f - 0.85) / 0.15); // la pierna derecha chuta
        }
        if (reloj <= 0) chutar();
        break;
      }
      case 'vuelo':
        vidaBalon -= dt;
        if (vidaBalon <= 0 && !resuelto) terminarTiro('fuera', '¡Fuera!', '#fff59d');
        break;
      case 'resultado':
        if (reloj <= 0) {
          tiro += 1;
          if (tiro >= PENALTIS) {
            estado = 'fin';
            reloj = 7;
            if (paradas() > record) {
              record = paradas();
              ctx.guardar('record', record);
            }
            ctx.sonido('fin');
          } else {
            prepararTiro();
          }
        }
        break;
      case 'fin':
        if (reloj <= 0) empezarTanda();
        break;
    }

    if (estado === 'vuelo' || estado === 'resultado') moverBalon(dt);
    if (estado === 'resultado' && piernas[1].rotation.x < 0) piernas[1].rotation.x = Math.min(0, piernas[1].rotation.x + dt * 3);

    // Sombras de mancha del balón y del lanzador
    ctx.colocarSombra(sombraBalon, balon.position, 0);
    ctx.colocarSombra(sombraLanzador, lanzador.position, 0);

    actualizarMarcador();
  }

  prepararTiro();
  estado = 'intro';
  reloj = 3.5;
  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      niebla.near = nieblaOriginal.near;
      niebla.far = nieblaOriginal.far;
    },
  };
}
