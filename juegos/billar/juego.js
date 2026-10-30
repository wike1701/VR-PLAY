// BILLAR DE TRUCOS
// Un taller de juguetes mecánicos con una mesa de billar que cambia en cada nivel. Siempre tiras
// desde la misma marca, en tu lado de la mesa (nunca hay que rodearla): cada mesa es un reto con
// unos pocos tiros. Meter bolas de color (a veces en la tronera que brilla), pasar la blanca por
// aros de latón, saltar barreras con las rampas, aprovechar los rebotadores y no meter nunca las
// negras. La primera mesa es billar de toda la vida; luego llegan las mesas raras. Las mesas se
// generan solas y cada una se prueba antes de enseñarla (siempre tiene solución). Si gastas los
// tiros sin cumplir el reto, pierdes una de tus 3 vidas y la repites. Sin final fijo.
// En VR: el taco con las dos manos (la de delante apunta, la de atrás empuja). Sin gafas:
// apunta con el ratón o el dedo, arrastra hacia abajo para la fuerza y suelta.
import * as THREE from 'three';
import {
  R, MARCA, ABANICO, POTENCIA_MIN, POTENCIA_MAX, COLORES,
  paso, enReposo, frenar, velocidadTiro, generarMesa, mesaConSolucionPorPartes, devolverBlanca, PASOS_FRENADO,
} from './fisica.js';

// Sin archivos externos: todo se genera con código.
export async function precargar() {}

const MESA_Y = 0.8;          // altura del paño
const VIDAS = 3;
const PASO = 1 / 240;
const N_BOLAS = 8;
const LARGO_TACO = 1.45;
const PUNTA_DESDE_MANO = 1.0; // de la mano de atrás a la punta del taco
const PRESUPUESTO = 3;        // ms por fotograma para preparar la mesa siguiente
const CLAVE_MOTIVO = {
  negra: 'motivos.negra', troneraMala: 'motivos.troneraMala', perdida: 'motivos.perdida', truco: 'motivos.truco', sinTiros: 'motivos.sinTiros',
};
const CLAVE_COLOR = {
  roja: 'colores.roja', amarilla: 'colores.amarilla', azul: 'colores.azul',
  verde: 'colores.verde', morada: 'colores.morada', naranja: 'colores.naranja',
};

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R3 = (r) => ctx.recurso(r);

  ctx.fondo(0x2a1c14, { cenit: 0x140c08, horizonte: 0x3a2618, suelo: 0x1a120c, niebla: [9, 22] });
  ctx.sueloBase(false);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.6, 0.4), new THREE.Vector3(0, 0.72, -1.7));

  const matrizTmp = new THREE.Matrix4();
  const eulerTmp = new THREE.Euler();
  const colorTmp = new THREE.Color();
  const arriba = new THREE.Vector3(0, 1, 0);
  function colocar(geo, x, y, z, rx = 0, ry = 0, rz = 0) {
    matrizTmp.makeRotationFromEuler(eulerTmp.set(rx, ry, rz)).setPosition(x, y, z);
    return geo.applyMatrix4(matrizTmp);
  }
  // Une varias geometrías en una (una sola llamada de dibujo). Con «colores», una por pieza.
  function fusionar(geos, colores = null, registrar = true) {
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
    return registrar ? R3(geo) : geo;
  }
  const caja = (w, h, d, x, y, z, rx = 0, ry = 0, rz = 0) => colocar(new THREE.BoxGeometry(w, h, d), x, y, z, rx, ry, rz);

  // ─── Taller de juguetes ────────────────────────────────────────────────
  const suelo = new THREE.Mesh(R3(new THREE.PlaneGeometry(12, 12)), R3(new THREE.MeshLambertMaterial({ map: R3(ctx.texturas.tablas(0x6a4630, { tablas: 18, repetir: [3, 3], semilla: 221 })) })));
  suelo.rotation.x = -Math.PI / 2;
  suelo.position.z = -1.5;
  raiz.add(suelo);
  const matParedes = R3(new THREE.MeshLambertMaterial({ map: R3(ctx.texturas.tablas(0x8a5a3a, { tablas: 10, repetir: [4, 1], semilla: 222 })) }));
  raiz.add(new THREE.Mesh(fusionar([
    caja(9, 4, 0.1, 0, 2, -5.2),
    caja(0.1, 4, 9, -3.6, 2, -1.2),
    caja(0.1, 4, 9, 3.6, 2, -1.2),
  ]), matParedes));
  // Estanterías con juguetes de colores, un banco de trabajo y engranajes en la pared
  const piezasTaller = [];
  const coloresTaller = [];
  const pieza = (geo, color) => {
    piezasTaller.push(geo);
    coloresTaller.push(color);
  };
  for (const lado of [-1, 1]) {
    for (let k = 0; k < 3; k++) {
      pieza(caja(0.35, 0.04, 2.4, lado * 3.35, 0.9 + k * 0.6, -2.2), 0x5a3a24);
      for (let j = 0; j < 6; j++) {
        const z = -3.2 + j * 0.4;
        const tono = [0xd7263d, 0xf4c430, 0x1f5fd1, 0x1e9e5a, 0x7b3fbf, 0xf07a1a][(j + k * 2 + (lado > 0 ? 3 : 0)) % 6];
        if ((j + k) % 3 === 0) pieza(colocar(new THREE.CylinderGeometry(0.08, 0.1, 0.22, 12), lado * 3.33, 1.03 + k * 0.6, z), tono);
        else if ((j + k) % 3 === 1) pieza(caja(0.18, 0.16, 0.18, lado * 3.33, 1.0 + k * 0.6, z, 0, j, 0), tono);
        else pieza(colocar(new THREE.SphereGeometry(0.09, 12, 8), lado * 3.33, 1.01 + k * 0.6, z), tono);
      }
    }
  }
  pieza(caja(2.2, 0.08, 0.7, 0, 0.92, -4.75), 0x7a4e2e);
  pieza(caja(0.08, 0.88, 0.08, -1, 0.44, -4.5), 0x5a3a24);
  pieza(caja(0.08, 0.88, 0.08, 1, 0.44, -4.5), 0x5a3a24);
  for (const [x, c] of [[-0.6, 0xd7263d], [-0.2, 0x1f5fd1], [0.3, 0xf4c430], [0.7, 0x1e9e5a]]) pieza(colocar(new THREE.CylinderGeometry(0.06, 0.06, 0.25, 10), x, 1.08, -4.7), c);
  raiz.add(new THREE.Mesh(fusionar(piezasTaller, coloresTaller), R3(new THREE.MeshLambertMaterial({ vertexColors: true }))));
  // Engranajes de latón que giran despacio en la pared del fondo
  const matLaton = R3(new THREE.MeshStandardMaterial({ color: 0xd4a53a, roughness: 0.3, metalness: 1 }));
  const geoEngranaje = (radio, dientes) => {
    const piezas = [new THREE.TorusGeometry(radio * 0.8, radio * 0.18, 6, 24)];
    for (let i = 0; i < dientes; i++) {
      const a = (i / dientes) * Math.PI * 2;
      piezas.push(caja(radio * 0.25, radio * 0.3, radio * 0.2, Math.cos(a) * radio, Math.sin(a) * radio, 0, 0, 0, a));
    }
    piezas.push(new THREE.CylinderGeometry(radio * 0.18, radio * 0.18, radio * 0.25, 12).rotateX(Math.PI / 2));
    return fusionar(piezas);
  };
  const engranajes = [[-1.4, 2.6, 0.5, 12, 0.3], [-0.55, 2.15, 0.32, 8, -0.47], [1.3, 2.8, 0.42, 10, 0.36]].map(([x, y, r, d, v]) => {
    const m = new THREE.Mesh(geoEngranaje(r, d), matLaton);
    m.position.set(x, y, -5.1);
    m.userData.vel = v;
    raiz.add(m);
    return m;
  });
  // Lámparas colgadas sobre la mesa (la bombilla brilla, sin luces nuevas)
  const lamparas = new THREE.Mesh(fusionar([
    colocar(new THREE.ConeGeometry(0.28, 0.22, 20, 1, true), 0, 2.15, -1.2),
    colocar(new THREE.ConeGeometry(0.28, 0.22, 20, 1, true), 0, 2.15, -2.4),
    caja(0.01, 0.9, 0.01, 0, 2.7, -1.2), caja(0.01, 0.9, 0.01, 0, 2.7, -2.4),
  ]), R3(new THREE.MeshLambertMaterial({ color: 0x2f5a3a, side: THREE.DoubleSide })));
  raiz.add(lamparas);
  const bombillas = new THREE.Mesh(fusionar([
    colocar(new THREE.SphereGeometry(0.06, 12, 8), 0, 2.07, -1.2),
    colocar(new THREE.SphereGeometry(0.06, 12, 8), 0, 2.07, -2.4),
  ]), R3(new THREE.MeshBasicMaterial({ color: 0xfff0c8, toneMapped: false })));
  raiz.add(bombillas);

  // ─── Materiales y geometrías de la mesa (se reutilizan en todas) ───────
  const texTela = R3(ctx.texturas.tela(0xffffff, { tam: 256, repetir: [4, 4], semilla: 223 }));
  const COLORES_PAÑO = [0x1f7a4a, 0x16707e, 0x8a1f3e, 0x2340a0, 0x6a2f9a, 0xa8471a]; // verde, turquesa, granate, azul, morado, teja
  const matPano = R3(new THREE.MeshLambertMaterial({ map: texTela, color: COLORES_PAÑO[0] }));
  const matBanda = R3(new THREE.MeshLambertMaterial({ map: texTela, color: 0x145a36 }));
  const matMadera = R3(new THREE.MeshStandardMaterial({ map: R3(ctx.texturas.madera(0x7a4524, { tam: 256, semilla: 224 })), roughness: 0.35 }));
  const matNegro = R3(new THREE.MeshBasicMaterial({ color: 0x050403 }));
  const matRebotador = R3(new THREE.MeshLambertMaterial({ color: 0xd7263d, emissive: 0xff4a2a, emissiveIntensity: 0 }));
  const matMarca = R3(new THREE.MeshBasicMaterial({ color: 0xf2f2e8 }));
  const geoRebotador = R3(new THREE.CylinderGeometry(0.04, 0.042, 0.05, 20));
  geoRebotador.translate(0, 0.025, 0);
  const geoTapa = R3(new THREE.CylinderGeometry(0.03, 0.03, 0.012, 16));
  geoTapa.translate(0, 0.056, 0);
  const geoBombillaAro = R3(new THREE.SphereGeometry(0.014, 10, 8));

  const mesaGrupo = new THREE.Group();
  raiz.add(mesaGrupo);
  let recursosMesa = []; // geometrías y materiales de la mesa actual (se liberan al cambiar de mesa)
  const deMesa = (r) => {
    recursosMesa.push(r);
    return R3(r);
  };
  let rebotadores = [];   // { mesh, material, luz, poste }
  let aroBombillas = [];  // material de la bombilla de cada aro
  let troneraBrillo = null;
  let movil = null;       // { mesh, pared }

  // Polígono agrandado hacia fuera (para el marco de madera)
  function agrandar(pol, d) {
    const n = pol.length;
    const salida = [];
    for (let i = 0; i < n; i++) {
      const [px, pz] = pol[(i + n - 1) % n];
      const [cx, cz] = pol[i];
      const [nx, nz] = pol[(i + 1) % n];
      const n1 = normalFuera(px, pz, cx, cz);
      const n2 = normalFuera(cx, cz, nx, nz);
      const bx = n1[0] + n2[0];
      const bz = n1[1] + n2[1];
      const cos = (n1[0] * n2[0] + n1[1] * n2[1] + 1) / 2;
      const k = d / Math.sqrt(Math.max(0.2, cos));
      const l = Math.hypot(bx, bz) || 1;
      salida.push([cx + (bx / l) * k, cz + (bz / l) * k]);
    }
    return salida;
  }
  // Normal hacia fuera de un lado del polígono (antihorario visto desde arriba, con z hacia ti)
  function normalFuera(ax, az, bx, bz) {
    const l = Math.hypot(bx - ax, bz - az);
    return [-(bz - az) / l, (bx - ax) / l];
  }
  const forma = (pol) => {
    const s = new THREE.Shape();
    pol.forEach(([x, z], i) => (i ? s.lineTo(x, -z) : s.moveTo(x, -z)));
    s.closePath();
    return s;
  };

  function construirMesa(m) {
    // Libera la mesa anterior
    for (const r of recursosMesa) r.dispose();
    recursosMesa = [];
    while (mesaGrupo.children.length) mesaGrupo.remove(mesaGrupo.children[0]);
    rebotadores = [];
    aroBombillas = [];
    troneraBrillo = null;
    movil = null;
    const mesa = m.mesa;
    matPano.color.setHex(COLORES_PAÑO[(nivel - 1) % COLORES_PAÑO.length]);
    matBanda.color.copy(matPano.color).multiplyScalar(0.7);
    // Paño
    const geoPano = deMesa(new THREE.ShapeGeometry(forma(mesa.poligono)));
    geoPano.rotateX(-Math.PI / 2);
    const uv = geoPano.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * 1.5, uv.getY(i) * 1.5);
    const pano = new THREE.Mesh(geoPano, matPano);
    pano.position.y = MESA_Y;
    mesaGrupo.add(pano);
    // Marco de madera con su cuerpo y patas
    const fuera = agrandar(mesa.poligono, 0.11);
    const marco = forma(fuera);
    marco.holes.push(forma(mesa.poligono));
    const geoMarco = new THREE.ExtrudeGeometry(marco, { depth: 0.07, bevelEnabled: false });
    geoMarco.rotateX(-Math.PI / 2);
    geoMarco.translate(0, MESA_Y - 0.02, 0);
    const cuerpo = new THREE.ExtrudeGeometry(forma(agrandar(mesa.poligono, 0.06)), { depth: 0.16, bevelEnabled: false });
    cuerpo.rotateX(-Math.PI / 2);
    cuerpo.translate(0, MESA_Y - 0.18, 0);
    const patas = [];
    for (const [x, z] of fuera) patas.push(caja(0.12, MESA_Y - 0.18, 0.12, x * 0.85, (MESA_Y - 0.18) / 2, z * 0.92 + (MARCA.z - 0.2) * 0.08));
    mesaGrupo.add(new THREE.Mesh(deMesa(fusionar([geoMarco, cuerpo, ...patas], null, false)), matMadera));
    // Bandas (la goma de los lados) y muros
    const bandas = [];
    const muros = [];
    for (const p of mesa.paredes) {
      const l = Math.hypot(p.bx - p.ax, p.bz - p.az);
      const ang = Math.atan2(-(p.bz - p.az), p.bx - p.ax);
      if (p.tipo === 'banda') {
        const [nx, nz] = normalFuera(p.ax, p.az, p.bx, p.bz);
        bandas.push(caja(l, 0.045, 0.045, (p.ax + p.bx) / 2 + nx * 0.022, MESA_Y + 0.0225, (p.az + p.bz) / 2 + nz * 0.022, 0, ang, 0));
      } else if (p.tipo === 'movil') {
        const geo = deMesa(caja(l, p.alto, 0.03, 0, p.alto / 2, 0));
        const mesh = new THREE.Mesh(geo, matMadera);
        mesh.position.set((p.ax + p.bx) / 2, MESA_Y, (p.az + p.bz) / 2);
        mesh.rotation.y = ang;
        mesaGrupo.add(mesh);
        movil = { mesh, pared: p, x0: mesh.position.x, z0: mesh.position.z };
      } else {
        muros.push(caja(l, p.alto, p.tipo === 'barrera' ? 0.02 : 0.03, (p.ax + p.bx) / 2, MESA_Y + p.alto / 2, (p.az + p.bz) / 2, 0, ang, 0));
      }
    }
    mesaGrupo.add(new THREE.Mesh(deMesa(fusionar(bandas, null, false)), matBanda));
    if (muros.length) mesaGrupo.add(new THREE.Mesh(deMesa(fusionar(muros, null, false)), matMadera));
    // Troneras: agujero negro con aro de latón
    const agujeros = [];
    const aros = [];
    for (const t of mesa.troneras) {
      agujeros.push(colocar(new THREE.CircleGeometry(t.r + 0.008, 20).rotateX(-Math.PI / 2), t.x, MESA_Y + 0.002, t.z));
      aros.push(colocar(new THREE.TorusGeometry(t.r + 0.012, 0.008, 6, 24).rotateX(Math.PI / 2), t.x, MESA_Y + 0.006, t.z));
    }
    mesaGrupo.add(new THREE.Mesh(deMesa(fusionar(agujeros, null, false)), matNegro));
    mesaGrupo.add(new THREE.Mesh(deMesa(fusionar(aros, null, false)), matLaton));
    // La tronera que pide un reto, con un aro de luz de su color
    const reto = m.retos.find((r) => r.tipo === 'meter' && r.tronera >= 0);
    if (reto) {
      const t = mesa.troneras[reto.tronera];
      const mat = deMesa(new THREE.MeshBasicMaterial({ color: COLORES[m.bolas[reto.bola].color].color, toneMapped: false }));
      troneraBrillo = new THREE.Mesh(deMesa(new THREE.TorusGeometry(t.r + 0.03, 0.007, 6, 32).rotateX(Math.PI / 2)), mat);
      troneraBrillo.position.set(t.x, MESA_Y + 0.01, t.z);
      mesaGrupo.add(troneraBrillo);
    }
    // Postes de latón y rebotadores de goma
    const postes = [];
    for (const q of mesa.postes) {
      if (q.rebotador) {
        const material = deMesa(matRebotador.clone());
        const mesh = new THREE.Mesh(geoRebotador, material);
        mesh.add(new THREE.Mesh(geoTapa, matLaton));
        mesh.position.set(q.x, MESA_Y, q.z);
        mesaGrupo.add(mesh);
        rebotadores.push({ mesh, material, luz: 0, poste: q });
      } else {
        postes.push(colocar(new THREE.CylinderGeometry(q.r, q.r * 1.1, q.alto, 10), q.x, MESA_Y + q.alto / 2, q.z));
      }
    }
    if (postes.length) mesaGrupo.add(new THREE.Mesh(deMesa(fusionar(postes, null, false)), matLaton));
    // Aros: arco de latón entre los dos postes, con su bombilla que se enciende al cruzarlo
    for (const a of mesa.aros) {
      const media = Math.hypot(a.bx - a.ax, a.bz - a.az) / 2;
      const arco = new THREE.Mesh(deMesa(new THREE.TorusGeometry(media, 0.006, 6, 20, Math.PI)), matLaton);
      arco.position.set((a.ax + a.bx) / 2, MESA_Y + 0.1, (a.az + a.bz) / 2);
      arco.scale.y = 0.6;
      arco.rotation.y = Math.atan2(-(a.bz - a.az), a.bx - a.ax);
      mesaGrupo.add(arco);
      const mat = deMesa(new THREE.MeshBasicMaterial({ color: 0x6a5a40, toneMapped: false }));
      const bombilla = new THREE.Mesh(geoBombillaAro, mat);
      bombilla.position.set(arco.position.x, MESA_Y + 0.1 + media * 0.6 + 0.012, arco.position.z);
      mesaGrupo.add(bombilla);
      aroBombillas.push(mat);
    }
    // Rampas: una cuña de madera
    for (const r of mesa.rampas) {
      const perfil = new THREE.Shape();
      perfil.moveTo(-r.largo / 2, 0);
      perfil.lineTo(r.largo / 2, 0);
      perfil.lineTo(r.largo / 2, 0.025);
      perfil.closePath();
      const geo = new THREE.ExtrudeGeometry(perfil, { depth: r.ancho, bevelEnabled: false });
      geo.translate(0, 0, -r.ancho / 2);
      const mesh = new THREE.Mesh(deMesa(geo), matMadera);
      mesh.position.set(r.x, MESA_Y, r.z);
      mesh.rotation.y = Math.atan2(-r.dz, r.dx);
      mesaGrupo.add(mesh);
    }
    // La marca de salida: un punto de tiza
    const marca = new THREE.Mesh(deMesa(new THREE.RingGeometry(R * 1.2, R * 1.45, 24).rotateX(-Math.PI / 2)), matMarca);
    marca.position.set(MARCA.x, MESA_Y + 0.001, MARCA.z);
    mesaGrupo.add(marca);
  }

  // ─── Bolas ─────────────────────────────────────────────────────────────
  const geoBola = R3(new THREE.SphereGeometry(R, 24, 16));
  function texturaBola(fondo, numero, calavera = false) {
    return R3(ctx.texturaCanvas((g, tam) => {
      const ancho = tam;
      const alto = tam / 2;
      g.fillStyle = fondo;
      g.fillRect(0, 0, ancho, tam);
      // En la esfera, la textura se estira el doble a lo ancho: se dibuja todo a media anchura
      const cy = tam / 2;
      for (const cx of [ancho * 0.25, ancho * 0.75]) {
        g.save();
        g.translate(cx, cy);
        g.scale(0.5, 1);
        g.fillStyle = '#ffffff';
        g.beginPath();
        g.arc(0, 0, alto * 0.42, 0, Math.PI * 2);
        g.fill();
        g.fillStyle = '#111111';
        if (calavera) {
          g.beginPath();
          g.arc(-alto * 0.14, -alto * 0.06, alto * 0.1, 0, Math.PI * 2);
          g.arc(alto * 0.14, -alto * 0.06, alto * 0.1, 0, Math.PI * 2);
          g.fill();
          g.fillRect(-alto * 0.12, alto * 0.14, alto * 0.24, alto * 0.06);
        } else if (numero) {
          g.font = `bold ${Math.round(alto * 0.55)}px sans-serif`;
          g.textAlign = 'center';
          g.textBaseline = 'middle';
          g.fillText(String(numero), 0, 2);
        }
        g.restore();
      }
    }, { tam: 128 }));
  }
  const matsBola = {
    blanca: R3(new THREE.MeshStandardMaterial({ color: 0xf7f4ea, roughness: 0.15 })),
    negra: R3(new THREE.MeshStandardMaterial({ map: texturaBola('#141414', 0, true), roughness: 0.15 })),
  };
  const matsColor = COLORES.map((c, i) => R3(new THREE.MeshStandardMaterial({ map: texturaBola('#' + new THREE.Color(c.color).getHexString(), i + 1), roughness: 0.15 })));
  const bolasMalla = Array.from({ length: N_BOLAS }, () => {
    const mesh = new THREE.Mesh(geoBola, matsBola.blanca);
    mesh.visible = false;
    raiz.add(mesh);
    const sombra = ctx.crearSombra({ radio: R * 1.3, opacidad: 0.5 });
    raiz.add(sombra);
    return { mesh, sombra, cayendo: 0 };
  });

  // ─── Taco ──────────────────────────────────────────────────────────────
  // Perfil torneado de la punta (y = 0, azul de tiza) a la culata (y = LARGO_TACO)
  const perfilTaco = [
    [0.0001, 0], [0.0062, 0.001], [0.0064, 0.008], [0.0065, 0.03], [0.007, 0.2], [0.009, 0.7], [0.0115, 1.0], [0.0125, 1.05],
    [0.0135, 1.3], [0.014, LARGO_TACO - 0.01], [0.0001, LARGO_TACO],
  ].map(([r, y]) => new THREE.Vector2(r, y));
  const geoTaco = R3(new THREE.LatheGeometry(perfilTaco, 14));
  const texTaco = R3(ctx.texturaCanvas((g, tam) => {
    // A lo largo (v): punta azul, virola blanca, arce claro, anilla de latón y culata oscura
    const tramos = [[0, 0.006, '#3d6fd1'], [0.006, 0.02, '#f2f0e8'], [0.02, 0.69, '#e8cf9a'], [0.69, 0.72, '#d4a53a'], [0.72, 1, '#3a1f12']];
    for (const [a, b, c] of tramos) {
      g.fillStyle = c;
      g.fillRect(0, tam * (1 - b), tam, tam * (b - a) + 1);
    }
    g.fillStyle = 'rgba(255,255,255,0.08)';
    for (let i = 0; i < 30; i++) g.fillRect(0, tam * (0.3 + i * 0.012), tam, 1);
  }, { tam: 256 }));
  const matTaco = R3(new THREE.MeshStandardMaterial({ map: texTaco, roughness: 0.35 }));
  const taco = new THREE.Mesh(geoTaco, matTaco);
  raiz.add(taco);
  // Línea de guía y bola fantasma
  const guia = new THREE.Mesh(R3(new THREE.BoxGeometry(0.004, 0.002, 1).translate(0, 0, -0.5)), R3(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.55, depthWrite: false })));
  raiz.add(guia);
  const fantasma = new THREE.Mesh(R3(new THREE.TorusGeometry(R, 0.002, 6, 24).rotateX(Math.PI / 2)), R3(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.7 })));
  raiz.add(fantasma);
  const desvio = new THREE.Mesh(R3(new THREE.BoxGeometry(0.003, 0.002, 1).translate(0, 0, -0.5)), R3(new THREE.MeshBasicMaterial({ color: 0xffd23f, transparent: true, opacity: 0.6, depthWrite: false })));
  raiz.add(desvio);

  // ─── Paneles: marcador a la izquierda y retos a la derecha ─────────────
  const marcador = ctx.crearPanel({ ancho: 0.95, alto: 0.34 });
  marcador.mesh.position.set(-1.35, 1.6, -1.8);
  marcador.mesh.rotation.y = 0.55;
  raiz.add(marcador.mesh);
  const panelRetos = ctx.crearPanel({ ancho: 1.05, alto: 0.5, resolucion: 640 });
  panelRetos.mesh.position.set(1.4, 1.55, -1.85);
  panelRetos.mesh.rotation.y = -0.55;
  raiz.add(panelRetos.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'apuntando'; // 'apuntando' | 'rodando' | 'pausa' | 'preparando' | 'fin'
  let nivel = 1;
  let puntos = 0;
  let vidas = VIDAS;
  let tiros = 0;
  let record = ctx.leer('record', 0);
  let nuevoRecord = false;
  let primerTiro = true;
  let semillaPartida = Math.floor(Math.random() * 1e9);
  let actual = null;        // { mesa, bolas, retos, tiros, semilla }
  let hechos = [];          // reto cumplido (por índice)
  let siguiente = null;     // la mesa siguiente, ya preparada
  let preparando = null;    // generador de la mesa siguiente
  let tiempoFisica = 0;
  let acumulado = 0;
  let pasosTiro = 0;
  let reloj = 0;
  let tiempo = 0;
  let mensaje = '';
  let colorMensaje = '#ffffff';
  let tiempoMensaje = 0;
  let enEsteTiro = { aros: new Set(), entradas: [] };
  let fallida = '';         // por qué se ha perdido la mesa ('' si no)
  let tirosHechos = 0;
  let anguloRaton = 0;
  let potenciaRaton = 0;
  let pulsadoAntes = false;
  let yInicio = 0;
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const quatTmp = new THREE.Quaternion();
  const ejeTmp = new THREE.Vector3();
  const manoA = new THREE.Vector3();
  const manoB = new THREE.Vector3();
  const dirTaco = new THREE.Vector3();
  const punta = new THREE.Vector3();
  const puntaAntes = new THREE.Vector3();
  const bolaPos = new THREE.Vector3();
  let puntaLista = false;

  function decir(texto, color = '#ffffff', duracion = 1.6) {
    mensaje = texto;
    colorMensaje = color;
    tiempoMensaje = duracion;
  }

  function prepararSiguiente() {
    siguiente = null;
    preparando = mesaConSolucionPorPartes(nivel + 1, semillaPartida + (nivel + 1) * 104729);
  }

  function ponerMesa(m) {
    actual = { ...m, bolas: m.bolas.map((b) => ({ ...b })) };
    hechos = actual.retos.map(() => false);
    tiros = actual.tiros;
    tirosHechos = 0;
    fallida = '';
    tiempoFisica = 0;
    construirMesa(actual);
    colocarBolas(true);
    estado = 'apuntando';
  }

  function empezarPartida() {
    nivel = 1;
    puntos = 0;
    vidas = VIDAS;
    nuevoRecord = false;
    semillaPartida = Math.floor(Math.random() * 1e9);
    ponerMesa({ ...generarMesa(1, semillaPartida + 104729), semilla: semillaPartida + 104729 });
    prepararSiguiente();
  }

  // Las bolas de la física en las mallas
  function colocarBolas(reiniciar = false) {
    for (let i = 0; i < N_BOLAS; i++) {
      const bm = bolasMalla[i];
      const b = actual.bolas[i];
      if (!b) {
        bm.mesh.visible = false;
        bm.sombra.visible = false;
        continue;
      }
      if (reiniciar) {
        bm.mesh.material = b.tipo === 'blanca' ? matsBola.blanca : b.tipo === 'negra' ? matsBola.negra : matsColor[b.color];
        bm.mesh.quaternion.setFromEuler(eulerTmp.set(Math.random() * 6, Math.random() * 6, 0));
        bm.cayendo = 0;
      }
      if (b.activa) {
        bm.mesh.visible = true;
        bm.mesh.position.set(b.x, MESA_Y + R + b.y, b.z);
        ctx.colocarSombra(bm.sombra, bm.mesh.position, MESA_Y + 0.001);
      } else if (bm.cayendo > 0) {
        bm.mesh.position.y -= 0.004; // cae dentro de la tronera
      } else {
        bm.mesh.visible = false;
        bm.sombra.visible = false;
      }
    }
  }

  // ─── Eventos de la física ──────────────────────────────────────────────
  function evento(tipo, a, b, c) {
    const bola = actual.bolas[a];
    if (tipo === 'tronera') {
      enEsteTiro.entradas.push([a, b]);
      bolasMalla[a].cayendo = 0.3;
      tmp.set(bola.x, MESA_Y + 0.05, bola.z);
      ctx.sonido('embocada');
      if (bola.tipo === 'negra') {
        fallida = 'negra';
        ctx.efectos.impacto('medio', { pos: tmp, color: 0x222222 });
      } else if (bola.tipo === 'color') {
        // ¿Era un reto?
        let vale = false;
        actual.retos.forEach((r, k) => {
          if (r.tipo === 'meter' && r.bola === a && !hechos[k]) {
            if (r.tronera < 0 || r.tronera === b) {
              hechos[k] = true;
              vale = true;
              retoCumplido(tmp);
            } else {
              fallida = 'troneraMala';
            }
          }
        });
        if (!vale) ctx.efectos.impacto('pequeño', { pos: tmp, color: COLORES[bola.color].color });
      }
    } else if (tipo === 'aro') {
      if (a !== 0) return; // solo cuenta la blanca
      enEsteTiro.aros.add(b);
      aroBombillas[b]?.color.setHex(0xffe08a);
      actual.retos.forEach((r, k) => {
        if (r.tipo === 'aro' && r.aro === b && !hechos[k]) {
          hechos[k] = true;
          tmp.set(bola.x, MESA_Y + 0.08, bola.z);
          ctx.sonido('aro');
          retoCumplido(tmp);
        }
      });
    } else if (tipo === 'banda') {
      if (b > 0.4) ctx.sonido('banda');
    } else if (tipo === 'choque') {
      if (c > 0.15) ctx.sonido('clac');
    } else if (tipo === 'rebotador') {
      const r = rebotadores.find((k) => k.poste === actual.mesa.postes[b]);
      if (r) r.luz = 1;
      ctx.sonido('rebotador');
    } else if (tipo === 'salto') {
      ctx.sonido('bote');
    } else if (tipo === 'fuera') {
      if (bola.tipo === 'color' && actual.retos.some((r, k) => !hechos[k] && (r.bola === a))) fallida = 'perdida';
      tmp.set(bola.x, MESA_Y, bola.z);
      ctx.efectos.estallido(tmp, { color: 0xffffff, cantidad: 6 });
    }
  }

  function retoCumplido(pos) {
    puntos += 25;
    ctx.efectos.impacto('pequeño', { pos, color: 0xffd23f });
    ctx.efectos.texto(pos, '+25', { color: '#ffd23f', tam: 0.8 });
  }

  // ─── Tiro ──────────────────────────────────────────────────────────────
  function tirar(angulo, potencia, mano) {
    if (estado !== 'apuntando') return;
    const a = Math.max(-ABANICO, Math.min(ABANICO, angulo));
    const p = Math.max(POTENCIA_MIN, Math.min(POTENCIA_MAX, potencia));
    const v = velocidadTiro(a, p);
    const blanca = actual.bolas[0];
    blanca.vx = v.vx;
    blanca.vz = v.vz;
    tiros -= 1;
    tirosHechos += 1;
    primerTiro = false;
    enEsteTiro = { aros: new Set(), entradas: [] };
    estado = 'rodando';
    acumulado = 0;
    pasosTiro = 0;
    bolaPos.set(blanca.x, MESA_Y + R, blanca.z);
    ctx.efectos.impacto('pequeño', { pos: bolaPos, mano, color: 0xffffff, sonido: 'toc' });
  }

  // Al pararse todo: ¿mesa superada, perdida o seguimos?
  function finDelTiro() {
    // El truco: aro y bola en el mismo tiro
    actual.retos.forEach((r, k) => {
      if (r.tipo === 'truco' && !hechos[k] && enEsteTiro.aros.has(r.aro) && enEsteTiro.entradas.some(([b]) => b === r.bola)) {
        hechos[k] = true;
        tmp.set(0, MESA_Y + 0.2, -1.4);
        retoCumplido(tmp);
      }
      // Si la bola del truco ha entrado sin el aro, ya no se puede cumplir
      if (r.tipo === 'truco' && !hechos[k] && enEsteTiro.entradas.some(([b]) => b === r.bola)) fallida = 'truco';
    });
    if (hechos.every(Boolean) && fallida !== 'negra') return mesaSuperada();
    if (fallida || tiros <= 0) return mesaPerdida(fallida || 'sinTiros');
    // La blanca vuelve a la marca (y se apartan las que estén encima)
    devolverBlanca(actual.bolas);
    bolasMalla[0].cayendo = 0;
    if (tiros === 1) decir(ctx.t('ultimoTiro'), '#ffd23f', 1.4);
    estado = 'apuntando';
  }

  function mesaSuperada() {
    const sobran = tiros;
    let suma = 100 + sobran * 60;
    const perfecto = tirosHechos === 1 && actual.retos.length > 1;
    if (perfecto) suma += 150;
    puntos += suma;
    tmp.set(0, MESA_Y + 0.4, -1.4);
    ctx.efectos.impacto('grande', { pos: tmp, color: 0xffd23f, sonido: 'fin' });
    ctx.efectos.texto(tmp, `+${suma}`, { color: '#ffd23f', tam: 1.4, vida: 1.4 });
    decir(perfecto ? ctx.t('perfecto') : ctx.t('superada', { n: suma }), '#ffd23f', 2);
    estado = 'pausa';
    reloj = 1.8;
    nivel += 1;
  }

  function mesaPerdida(motivo) {
    vidas -= 1;
    decir(ctx.t(CLAVE_MOTIVO[motivo]), '#ff8a80', 2.2);
    ctx.sonido(motivo === 'negra' ? 'zumbador' : 'fallo');
    for (const m of ctx.manos) ctx.vibrar(m, 0.5, 120);
    if (vidas <= 0) {
      estado = 'fin';
      reloj = 7;
      ctx.puntuacion(puntos); // a la clasificación (juegos/marcadores.js)
      if (puntos > record) {
        record = puntos;
        nuevoRecord = puntos > 0;
        ctx.guardar('record', record);
      }
      if (nuevoRecord) {
        tmp.set(0, 1.2, -1.4);
        ctx.efectos.impacto('grande', { pos: tmp, color: 0xffd23f, sonido: 'ovacion' });
      }
      return;
    }
    estado = 'pausa';
    reloj = 2;
    actual.repetir = true;
  }

  // ─── VR: el taco con las dos manos ─────────────────────────────────────
  function tacoVR(dt) {
    const activas = ctx.manos.filter((m) => m.activa);
    taco.visible = activas.length > 0;
    if (!activas.length) return;
    const blanca = actual.bolas[0];
    bolaPos.set(blanca.x, MESA_Y + R, blanca.z);
    if (activas.length >= 2) {
      // La mano de atrás (la más lejos de la bola) empuja; la de delante marca la dirección
      activas[0].grip.getWorldPosition(manoA);
      activas[1].grip.getWorldPosition(manoB);
      const atras = manoA.distanceTo(bolaPos) > manoB.distanceTo(bolaPos);
      const detras = atras ? manoA : manoB;
      const delante = atras ? manoB : manoA;
      dirTaco.subVectors(delante, detras);
      if (dirTaco.lengthSq() < 0.0004) dirTaco.set(0, 0, -1);
      dirTaco.normalize();
      punta.copy(detras).addScaledVector(dirTaco, PUNTA_DESDE_MANO);
    } else {
      activas[0].grip.getWorldPosition(manoA);
      dirTaco.set(0, 0, -1).transformDirection(activas[0].grip.matrixWorld);
      punta.copy(manoA).addScaledVector(dirTaco, PUNTA_DESDE_MANO);
    }
    // El taco: de la punta hacia atrás
    taco.position.copy(punta);
    taco.quaternion.setFromUnitVectors(arriba, tmp.copy(dirTaco).negate());
    // Golpe: la punta pasa por la bola yendo hacia delante con algo de rapidez
    if (puntaLista && estado === 'apuntando') {
      const v = tmp2.subVectors(punta, puntaAntes);
      const avance = v.dot(dirTaco) / Math.max(dt, 1e-3);
      const l2 = v.lengthSq();
      let u = l2 > 1e-10 ? tmp.subVectors(bolaPos, puntaAntes).dot(v) / l2 : 0;
      u = Math.max(0, Math.min(1, u));
      tmp.copy(puntaAntes).addScaledVector(v, u);
      if (avance > 0.2 && tmp.distanceTo(bolaPos) < R + 0.015) {
        const angulo = Math.atan2(dirTaco.x, -dirTaco.z);
        tirar(angulo, avance * 2.2, activas[activas.length - 1]);
        for (const m of activas) ctx.vibrar(m, Math.min(1, 0.3 + avance * 0.2), 50);
      }
    }
    puntaAntes.copy(punta);
    puntaLista = true;
    // Guía: cuando la punta está cerca de la bola y apuntando hacia ella
    if (estado === 'apuntando' && punta.distanceTo(bolaPos) < 0.45) dibujarGuia(Math.atan2(dirTaco.x, -dirTaco.z));
    else ocultarGuia();
  }

  // ─── Ratón y pantalla táctil ───────────────────────────────────────────
  const planoMesa = new THREE.Plane(new THREE.Vector3(0, 1, 0), -MESA_Y);
  function tacoRaton() {
    const r = ctx.raton;
    const blanca = actual.bolas[0];
    bolaPos.set(blanca.x, MESA_Y + R, blanca.z);
    if (estado !== 'apuntando') {
      taco.visible = estado === 'rodando' && potenciaRaton > 0;
      ocultarGuia();
      pulsadoAntes = r.pulsado;
      return;
    }
    if (!r.pulsado) {
      if (r.rayo.ray.intersectPlane(planoMesa, tmp) && tmp.z < blanca.z - 0.05) anguloRaton = Math.max(-ABANICO, Math.min(ABANICO, Math.atan2(tmp.x - blanca.x, -(tmp.z - blanca.z))));
      if (pulsadoAntes && potenciaRaton > 0.04) {
        tirar(anguloRaton, POTENCIA_MIN + potenciaRaton * (POTENCIA_MAX - POTENCIA_MIN), null);
      }
      potenciaRaton = 0;
    } else {
      if (!pulsadoAntes) yInicio = r.ndc.y;
      potenciaRaton = Math.max(0, Math.min(1, (yInicio - r.ndc.y) * 1.6));
    }
    pulsadoAntes = r.pulsado;
    // El taco detrás de la bola, retrasado según la fuerza
    dirTaco.set(Math.sin(anguloRaton), -0.12, -Math.cos(anguloRaton)).normalize();
    punta.copy(bolaPos).addScaledVector(dirTaco, -(R + 0.01 + potenciaRaton * 0.25));
    taco.visible = true;
    taco.position.copy(punta);
    taco.quaternion.setFromUnitVectors(arriba, tmp.copy(dirTaco).negate());
    dibujarGuia(anguloRaton);
  }

  // ─── Guía: hasta el primer choque, con la bola fantasma ────────────────
  function dibujarGuia(angulo) {
    const a = Math.max(-ABANICO, Math.min(ABANICO, angulo));
    const dx = Math.sin(a);
    const dz = -Math.cos(a);
    const blanca = actual.bolas[0];
    const maximo = nivel <= 3 ? 3 : nivel <= 8 ? 2.5 : 0.6;
    let l = 0;
    let golpeada = -1;
    const mesa = actual.mesa;
    for (; l < maximo; l += 0.008) {
      const x = blanca.x + dx * l;
      const z = blanca.z + dz * l;
      let choca = false;
      for (let i = 1; i < actual.bolas.length && !choca; i++) {
        const b = actual.bolas[i];
        if (b.activa && (b.x - x) ** 2 + (b.z - z) ** 2 < 4 * R * R) {
          choca = true;
          golpeada = i;
        }
      }
      for (const q of mesa.postes) if (!choca && (q.x - x) ** 2 + (q.z - z) ** 2 < (q.r + R) ** 2) choca = true;
      for (const p of mesa.paredes) {
        if (choca || p.tipo === 'barrera' || p.movil) continue;
        const ex = p.bx - p.ax;
        const ez = p.bz - p.az;
        const u = Math.max(0, Math.min(1, ((x - p.ax) * ex + (z - p.az) * ez) / (ex * ex + ez * ez)));
        if ((x - p.ax - ex * u) ** 2 + (z - p.az - ez * u) ** 2 < R * R) choca = true;
      }
      if (choca) break;
    }
    guia.visible = true;
    guia.position.set(blanca.x, MESA_Y + 0.003, blanca.z);
    guia.rotation.set(0, -a, 0);
    guia.scale.z = Math.max(0.01, l);
    fantasma.visible = l < maximo;
    fantasma.position.set(blanca.x + dx * l, MESA_Y + R, blanca.z + dz * l);
    // Hacia dónde saldría la bola golpeada (solo en las primeras mesas)
    if (golpeada > 0 && nivel <= 8) {
      const b = actual.bolas[golpeada];
      const ang = Math.atan2(b.x - fantasma.position.x, b.z - fantasma.position.z);
      desvio.visible = true;
      desvio.position.set(b.x, MESA_Y + 0.003, b.z);
      desvio.rotation.set(0, ang + Math.PI, 0);
      desvio.scale.z = 0.3;
    } else desvio.visible = false;
  }
  function ocultarGuia() {
    guia.visible = false;
    fantasma.visible = false;
    desvio.visible = false;
  }

  // ─── Paneles ───────────────────────────────────────────────────────────
  function textoReto(r) {
    const color = (b) => ctx.t(CLAVE_COLOR[COLORES[actual.bolas[b].color].nombre]);
    if (r.tipo === 'aro') return ctx.t('retos.aro');
    if (r.tipo === 'truco') return ctx.t('retos.truco', { color: color(r.bola) });
    if (r.tronera >= 0) return ctx.t('retos.meterTronera', { color: color(r.bola) });
    return ctx.t('retos.meter', { color: color(r.bola) });
  }
  function actualizarPaneles() {
    const corazones = '♥'.repeat(Math.max(0, vidas)) + '♡'.repeat(VIDAS - Math.max(0, vidas));
    if (estado === 'fin') {
      marcador.escribir([
        { texto: ctx.t('partida.finPuntos', { n: puntos }), tam: 1.1, color: '#ffd23f' },
        { texto: ctx.t('resumen', { n: nivel - 1 }), tam: 0.62 },
        { texto: nuevoRecord ? ctx.t('partida.nuevoRecord') : ctx.t('partida.recordNuevaPartida', { record, n: Math.max(1, Math.ceil(reloj)) }), tam: 0.56, color: nuevoRecord ? '#ffd23f' : '#cfd8dc' },
      ]);
    } else if (primerTiro) {
      const intro = ctx.enVR() ? ctx.t('intro') : ctx.t(ctx.tactil ? 'introTactil' : 'introRaton');
      marcador.escribir([
        { texto: ctx.t('titulo'), tam: 1.15, color: '#ffd23f' },
        { texto: intro, tam: 0.58 },
        { texto: ctx.t('partida.record', { record }), tam: 0.54, color: '#cfd8dc' },
      ]);
    } else {
      marcador.escribir([
        { texto: ctx.t('marcador', { puntos }), tam: 1.15 },
        tiempoMensaje > 0
          ? { texto: mensaje, tam: 0.66, color: colorMensaje }
          : { texto: ctx.t('estado', { n: nivel, vidas: corazones }), tam: 0.7, color: '#cfd8dc' },
      ]);
    }
    if (estado === 'preparando') {
      panelRetos.escribir([{ texto: ctx.t('preparando'), tam: 0.8, color: '#cfd8dc' }]);
      return;
    }
    const lineas = [{ texto: ctx.t('mesa', { n: nivel }) + '   ' + '●'.repeat(Math.max(0, tiros)) + '○'.repeat(Math.max(0, actual.tiros - tiros)), tam: 0.95, color: '#ffd23f' }];
    actual.retos.forEach((r, k) => lineas.push({ texto: (hechos[k] ? '✓  ' : '○  ') + textoReto(r), tam: 0.6, color: hechos[k] ? '#b9f6ca' : '#ffffff' }));
    if (actual.bolas.some((b) => b.tipo === 'negra')) lineas.push({ texto: ctx.t('retos.negras'), tam: 0.56, color: '#ff8a80' });
    panelRetos.escribir(lineas);
  }

  // ─── Bucle ─────────────────────────────────────────────────────────────
  function actualizar(dt) {
    tiempo += dt;
    tiempoMensaje -= dt;
    reloj -= dt;
    // Preparar la mesa siguiente poco a poco (más deprisa si ya se está esperando)
    if (preparando) {
      const limite = performance.now() + (estado === 'preparando' ? PRESUPUESTO * 3 : PRESUPUESTO);
      while (performance.now() < limite) {
        const r = preparando.next();
        if (r.done) {
          siguiente = r.value;
          preparando = null;
          break;
        }
      }
    }
    if (estado === 'pausa' && reloj <= 0) {
      if (actual.repetir) ponerMesa({ ...generarMesa(nivel, actual.semilla), semilla: actual.semilla });
      else estado = 'preparando';
    }
    if (estado === 'preparando' && siguiente) {
      ponerMesa(siguiente);
      prepararSiguiente();
    }
    if (estado === 'fin' && reloj <= 0) empezarPartida();

    // Física: pasos fijos
    if (estado === 'rodando') {
      acumulado += Math.min(dt, 0.05);
      while (acumulado >= PASO && estado === 'rodando') {
        paso(actual.mesa, actual.bolas, tiempoFisica, PASO, evento);
        tiempoFisica += PASO;
        acumulado -= PASO;
        pasosTiro += 1;
        // Igual que en la comprobación de las mesas: frenar y mirar si está todo quieto cada 24 pasos
        if (pasosTiro % PASOS_FRENADO === 0) {
          frenar(actual.bolas);
          if (enReposo(actual.bolas)) finDelTiro();
        }
      }
    } else {
      tiempoFisica += dt; // las barreras móviles siguen moviéndose
    }
    if (ctx.enVR()) tacoVR(dt);
    else tacoRaton();
    animar(dt);
    actualizarPaneles();
  }

  function animar(dt) {
    // Bolas: posición, giro al rodar y caída en las troneras
    for (let i = 0; i < N_BOLAS; i++) {
      const bm = bolasMalla[i];
      const b = actual.bolas[i];
      if (!b) continue;
      bm.cayendo = Math.max(0, bm.cayendo - dt);
      if (b.activa && b.y === 0) {
        const v = Math.hypot(b.vx, b.vz);
        if (v > 0.001) {
          ejeTmp.set(-b.vz / v, 0, b.vx / v);
          quatTmp.setFromAxisAngle(ejeTmp.negate(), (v * dt) / R);
          bm.mesh.quaternion.premultiply(quatTmp);
        }
      }
    }
    colocarBolas();
    // Barrera móvil
    if (movil) {
      const p = movil.pared;
      const s = Math.sin(tiempoFisica * p.movil.vel + p.movil.fase) * p.movil.amp;
      movil.mesh.position.set(movil.x0 + p.movil.dx * s, MESA_Y, movil.z0 + p.movil.dz * s);
    }
    for (const r of rebotadores) {
      r.luz = Math.max(0, r.luz - dt * 4);
      r.material.emissiveIntensity = r.luz * 1.2;
      r.mesh.scale.setScalar(1 + r.luz * 0.12);
    }
    if (troneraBrillo) troneraBrillo.scale.setScalar(1 + Math.sin(tiempo * 4) * 0.08);
    for (const e of engranajes) e.rotation.z += e.userData.vel * dt;
  }

  empezarPartida();
  actualizarPaneles();

  return {
    actualizar,
    liberar() {
      for (const r of recursosMesa) r.dispose();
      recursosMesa = [];
    },
  };
}
