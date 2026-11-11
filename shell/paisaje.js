// ─────────────────────────────────────────────────────────────────────────
// KIT DE PAISAJE (ctx.fondo({ horizonte }) y ctx.arboles)
// Profundidad barata para los juegos al aire libre:
//   - Horizonte lejano: montes, colinas, ciudad, dunas o bosque en dos capas, con la
//     capa de atrás más clara (perspectiva atmosférica). UNA malla sin luces ni niebla.
//   - Árboles: todos los de un juego en tres InstancedMesh (troncos, copas y sombras),
//     con variaciones de tamaño, giro y color. Sustituyen a los conos sueltos.
// ─────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { obtenerTexturaSombra } from './graficos.js';

function aleatorio(semilla) {
  let s = semilla * 9301 + 49297;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// Perfil de cada tipo de horizonte: altura (en metros a 70 m) según el ángulo
const PERFILES = {
  montes: { capas: [[11, 0.55], [6, 0.3]], ruido: 1, picos: true },
  colinas: { capas: [[5, 0.6], [3, 0.35]], ruido: 0.45, picos: false },
  dunas: { capas: [[3.2, 0.6], [1.8, 0.32]], ruido: 0.3, picos: false },
  bosque: { capas: [[4.5, 0.55], [3, 0.3]], ruido: 0.35, picos: false, dientes: true },
  ciudad: { capas: [[9, 0.55], [5, 0.3]], ruido: 0, picos: false, bloques: true },
};

// Crea el horizonte. color: color de las siluetas; horizonte: color del cielo en el
// horizonte (hacia él se aclaran por la distancia). Devuelve una malla.
export function crearHorizonte({ tipo = 'colinas', color = 0x3d5a40, horizonte = 0xbfd8ea, radio = 70, semilla = 3 } = {}) {
  const perfil = PERFILES[tipo] || PERFILES.colinas;
  const azar = aleatorio(semilla);
  const N = 160;
  const posiciones = [];
  const colores = [];
  const indices = [];
  const cBase = new THREE.Color(color);
  const cHorizonte = new THREE.Color(horizonte);
  const c = new THREE.Color();

  perfil.capas.forEach(([altura, niebla], capa) => {
    const r = radio * (1 - capa * 0.12);
    // Ondas con fases al azar: cada juego tiene su propia silueta
    const ondas = [1, 2, 3, 5, 8, 13].map((f) => ({ f: f * (tipo === 'montes' ? 1.5 : 1), a: azar(), fase: azar() * 6.3 }));
    const alturas = [];
    let bloque = 0;
    let alturaBloque = 0;
    for (let i = 0; i <= N; i++) {
      const ang = (i / N) * Math.PI * 2;
      let h = 0;
      for (const o of ondas) h += Math.sin(ang * o.f + o.fase) * o.a / o.f;
      h = 0.5 + h * 0.5;
      if (perfil.picos) h = Math.pow(Math.max(0, h), 1.6) + azar() * 0.05 * perfil.ruido;
      if (perfil.dientes) h += (i % 2) * 0.12 + azar() * 0.08;
      if (perfil.bloques) {
        if (bloque <= 0) {
          bloque = 1 + Math.floor(azar() * 3);
          alturaBloque = 0.2 + azar() * 0.8 * (0.4 + h);
        }
        bloque--;
        h = alturaBloque;
      }
      alturas.push(Math.max(0.05, h) * altura * (radio / 70));
    }
    // Capa de atrás más clara; la base se funde con el horizonte
    const cArriba = c.copy(cBase).lerp(cHorizonte, niebla).clone();
    const cAbajo = c.copy(cBase).lerp(cHorizonte, Math.min(1, niebla + 0.3)).clone();
    const inicio = posiciones.length / 3;
    for (let i = 0; i <= N; i++) {
      const ang = (i / N) * Math.PI * 2;
      // En la ciudad, los edificios tienen paredes rectas: dos vértices por cambio de altura
      const x = Math.sin(ang) * r;
      const z = -Math.cos(ang) * r;
      posiciones.push(x, -4, z, x, alturas[i], z);
      colores.push(cAbajo.r, cAbajo.g, cAbajo.b, cArriba.r, cArriba.g, cArriba.b);
      if (i > 0) {
        const a = inicio + (i - 1) * 2;
        indices.push(a, a + 2, a + 1, a + 1, a + 2, a + 3);
      }
    }
  });

  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.Float32BufferAttribute(posiciones, 3));
  geo.setAttribute('color', new THREE.Float32BufferAttribute(colores, 3));
  geo.setIndex(indices);
  const mat = new THREE.MeshBasicMaterial({
    vertexColors: true,
    fog: false,
    toneMapped: false, // como el cielo, para que casen los colores
    side: THREE.DoubleSide,
  });
  const malla = new THREE.Mesh(geo, mat);
  malla.name = 'horizonte';
  malla.renderOrder = -999; // justo después del cielo
  malla.frustumCulled = false;
  return malla;
}

// ─── Árboles ─────────────────────────────────────────────────────────────
// Une varias geometrías en una (sin índices), para dibujar cada árbol en una llamada.
function fusionar(geos) {
  const partes = geos.map((g) => (g.index ? g.toNonIndexed() : g));
  let total = 0;
  for (const g of partes) total += g.attributes.position.count;
  const pos = new Float32Array(total * 3);
  const nor = new Float32Array(total * 3);
  const uv = new Float32Array(total * 2);
  let o = 0;
  for (const g of partes) {
    pos.set(g.attributes.position.array, o * 3);
    nor.set(g.attributes.normal.array, o * 3);
    if (g.attributes.uv) uv.set(g.attributes.uv.array, o * 2);
    o += g.attributes.position.count;
  }
  for (const g of geos) g.dispose();
  for (const g of partes) g.dispose();
  const r = new THREE.BufferGeometry();
  r.setAttribute('position', new THREE.BufferAttribute(pos, 3));
  r.setAttribute('normal', new THREE.BufferAttribute(nor, 3));
  r.setAttribute('uv', new THREE.BufferAttribute(uv, 2));
  return r;
}

const TIPOS_ARBOL = {
  // Pino: tres pisos de copa, un poco girados entre sí
  pino: {
    copa: () => fusionar([
      new THREE.ConeGeometry(0.95, 1.5, 7).translate(0, 1.55, 0),
      new THREE.ConeGeometry(0.75, 1.3, 7).rotateY(0.4).translate(0, 2.25, 0),
      new THREE.ConeGeometry(0.5, 1.1, 7).rotateY(0.9).translate(0, 2.9, 0),
    ]),
    tronco: () => new THREE.CylinderGeometry(0.1, 0.16, 1.2, 6).translate(0, 0.6, 0),
    hojas: 0x2f6b3a, madera: 0x5b3b26, sombra: 1.1,
  },
  // Frondoso: tres bolas facetadas
  frondoso: {
    copa: () => fusionar([
      new THREE.IcosahedronGeometry(0.95, 0).translate(0, 2.1, 0),
      new THREE.IcosahedronGeometry(0.7, 0).rotateY(1).translate(0.55, 1.75, 0.2),
      new THREE.IcosahedronGeometry(0.65, 0).rotateX(1).translate(-0.45, 1.85, -0.25),
    ]),
    tronco: () => new THREE.CylinderGeometry(0.11, 0.18, 1.6, 6).translate(0, 0.8, 0),
    hojas: 0x4e8a3a, madera: 0x6b4a30, sombra: 1.3,
  },
  // Palmera: tronco inclinado y hojas en estrella
  palmera: {
    copa: () => {
      const hojas = [];
      for (let i = 0; i < 7; i++) {
        hojas.push(new THREE.ConeGeometry(0.22, 1.7, 3).rotateZ(Math.PI / 2 + 0.35).translate(0.85, 0, 0).rotateY((i / 7) * Math.PI * 2).translate(0.35, 3.15, 0));
      }
      hojas.push(new THREE.IcosahedronGeometry(0.2, 0).translate(0.35, 3.1, 0));
      return fusionar(hojas);
    },
    tronco: () => new THREE.CylinderGeometry(0.09, 0.15, 3.2, 6).translate(0, 1.6, 0).rotateZ(-0.11),
    hojas: 0x3f8f3a, madera: 0x8a6a45, sombra: 1.2,
  },
};

// lista: [{ x, z, escala?, y? }, ...] o [[x, z, escala?], ...]
// opciones: { tipo: 'pino' | 'frondoso' | 'palmera', hojas, madera, variacion, semilla, sombras }
// Devuelve un grupo para añadir a ctx.raiz (se libera solo al salir del juego).
export function crearArboles(lista, { tipo = 'pino', hojas, madera, variacion = 0.18, semilla = 5, sombras = true } = {}) {
  const def = TIPOS_ARBOL[tipo] || TIPOS_ARBOL.pino;
  const azar = aleatorio(semilla);
  const n = lista.length;
  const grupo = new THREE.Group();
  grupo.name = 'arboles';
  const matCopa = new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true });
  const matTronco = new THREE.MeshLambertMaterial({ color: madera ?? def.madera, flatShading: true });
  const copas = new THREE.InstancedMesh(def.copa(), matCopa, n);
  const troncos = new THREE.InstancedMesh(def.tronco(), matTronco, n);
  let manchas = null;
  if (sombras) {
    const matSombra = new THREE.MeshBasicMaterial({ map: obtenerTexturaSombra(), color: 0x000000, transparent: true, opacity: 0.35, depthWrite: false });
    manchas = new THREE.InstancedMesh(new THREE.PlaneGeometry(1, 1).rotateX(-Math.PI / 2), matSombra, n);
    manchas.renderOrder = -1;
  }
  const m = new THREE.Matrix4();
  const q = new THREE.Quaternion();
  const p = new THREE.Vector3();
  const e = new THREE.Vector3();
  const arriba = new THREE.Vector3(0, 1, 0);
  const base = new THREE.Color(hojas ?? def.hojas);
  const c = new THREE.Color();
  lista.forEach((a, i) => {
    const x = a.x ?? a[0];
    const z = a.z ?? a[1];
    const escala = (a.escala ?? a[2] ?? 1) * (1 - variacion / 2 + azar() * variacion);
    const y = a.y ?? 0;
    q.setFromAxisAngle(arriba, azar() * Math.PI * 2);
    m.compose(p.set(x, y, z), q, e.set(escala, escala * (0.9 + azar() * 0.25), escala));
    copas.setMatrixAt(i, m);
    troncos.setMatrixAt(i, m);
    // Cada copa con un tono un poco distinto (más clara, más amarilla o más oscura)
    const hsl = {};
    base.getHSL(hsl);
    c.setHSL(hsl.h + (azar() - 0.5) * 0.06, hsl.s * (0.85 + azar() * 0.3), hsl.l * (1 - variacion + azar() * variacion * 2));
    copas.setColorAt(i, c);
    if (manchas) {
      const r = def.sombra * escala * 2;
      m.compose(p.set(x, y + 0.01, z), q.identity(), e.set(r, 1, r));
      manchas.setMatrixAt(i, m);
    }
  });
  for (const malla of [copas, troncos, manchas]) {
    if (!malla) continue;
    malla.instanceMatrix.needsUpdate = true;
    malla.computeBoundingSphere();
    grupo.add(malla);
  }
  copas.instanceColor.needsUpdate = true;
  return grupo;
}

// Geometrías de un árbol del kit, para los juegos que colocan y mueven sus propias
// instancias (por ejemplo, árboles que pasan a los lados). El juego las libera.
// Devuelve { copa, tronco, hojas, madera } (los dos últimos, colores por defecto).
export function geometriaArbol(tipo = 'pino') {
  const def = TIPOS_ARBOL[tipo] || TIPOS_ARBOL.pino;
  return { copa: def.copa(), tronco: def.tronco(), hojas: def.hojas, madera: def.madera };
}
