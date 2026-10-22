// PIÑATA
// Una fiesta en un patio a media tarde, con banderines de papel picado. Una piñata de
// estrella cuelga de una cuerda y alguien la mueve: dale con el palo hasta romperla y
// saldrán los caramelos. Luego viene otra más dura que se mueve más. 60 segundos.
// Cada golpe da 1, 2 o 3 puntos según lo fuerte que sea; romper una piñata, 10 más 5
// por nivel.
// En VR llevas el palo en la mano: golpea fuerte. Sin gafas, haz clic (o toca) en la
// piñata; si la pillas moviéndose rápido, el golpe vale más.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código.
export async function precargar() {}

const DURACION = 60;
const PIVOTE = new THREE.Vector3(0, 3.1, -1.25);
const CUERDA = 1.55;
const R_PINATA = 0.3;
const R_GOLPE = 0.46;                // radio con los picos de la estrella
const LARGO_PALO = 0.85;
const N_CARAMELOS = 140;
const G = 9.8;
const COLORES = [0xe8457a, 0x2fb6d8, 0xf5c23a, 0x8a5ad6, 0x3fbf6a, 0xff6a3d];
const COLORES_CARAMELO = [0xff4f6d, 0xffd23f, 0x4fc3f7, 0x9ccc65, 0xba68c8, 0xffffff];

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (r) => ctx.recurso(r);

  ctx.fondo(0x9fd0f0, {
    cenit: 0x5aa0e0, horizonte: 0xffe2b8, nubes: 0.4, sol: [0.6, 0.4, -0.5], niebla: [20, 70],
    paisaje: { tipo: 'colinas', color: 0x7a9a5a, radio: 55 },
  });
  ctx.sueloBase(false);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.55, 0.6), new THREE.Vector3(0, 1.6, -1.25));

  const matrizTmp = new THREE.Matrix4();
  const eulerTmp = new THREE.Euler();
  function colocar(geo, x, y, z, rx = 0, ry = 0, rz = 0) {
    matrizTmp.makeRotationFromEuler(eulerTmp.set(rx, ry, rz)).setPosition(x, y, z);
    return geo.applyMatrix4(matrizTmp);
  }
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

  // ─── El patio ──────────────────────────────────────────────────────────
  const suelo = new THREE.Mesh(
    R(new THREE.PlaneGeometry(40, 40)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.ladrillos(0xc98a5a, 0x9a6448, { filas: 6, columnas: 6, repetir: [14, 14], semilla: 401 })) })),
  );
  suelo.rotation.x = -Math.PI / 2;
  raiz.add(suelo);
  // Tapia encalada al fondo y a los lados
  const matTapia = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.grano(0xf1e6d0, { repetir: [4, 1], semilla: 402 })) }));
  const tapia = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(12, 2.4, 0.3), 0, 1.2, -5.5),
    colocar(new THREE.BoxGeometry(0.3, 2.4, 9), -6, 1.2, -1),
    colocar(new THREE.BoxGeometry(0.3, 2.4, 9), 6, 1.2, -1),
  ]), matTapia);
  raiz.add(tapia);
  const remate = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(12.2, 0.12, 0.45), 0, 2.46, -5.5),
    colocar(new THREE.BoxGeometry(0.45, 0.12, 9.2), -6, 2.46, -1),
    colocar(new THREE.BoxGeometry(0.45, 0.12, 9.2), 6, 2.46, -1),
  ]), R(new THREE.MeshLambertMaterial({ color: 0xb5562e })));
  raiz.add(remate);
  raiz.add(ctx.arboles([{ x: -4.5, z: -4.2, escala: 1.2 }, { x: 4.6, z: -4.4 }, { x: -8, z: -8, escala: 1.4 }, { x: 8.5, z: -7, escala: 1.3 }], { tipo: 'frondoso', semilla: 41 }));
  // Viga de la que cuelga la cuerda
  const matMadera = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.madera(0x8a5a34, { semilla: 403 })) }));
  const viga = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(5.2, 0.16, 0.16), 0, PIVOTE.y + 0.3, PIVOTE.z),
    colocar(new THREE.BoxGeometry(0.16, PIVOTE.y + 0.3, 0.16), -2.5, (PIVOTE.y + 0.3) / 2, PIVOTE.z),
    colocar(new THREE.BoxGeometry(0.16, PIVOTE.y + 0.3, 0.16), 2.5, (PIVOTE.y + 0.3) / 2, PIVOTE.z),
  ]), matMadera);
  raiz.add(viga);
  const sombrasPostes = [-2.5, 2.5].map((x) => {
    const s = ctx.crearSombra({ radio: 0.3, opacidad: 0.4 });
    s.position.set(x, 0.005, PIVOTE.z);
    raiz.add(s);
    return s;
  });
  // Banderines de papel picado (una InstancedMesh con color por banderín)
  const N_BANDERINES = 48;
  const banderines = new THREE.InstancedMesh(R(new THREE.PlaneGeometry(0.22, 0.28).translate(0, -0.14, 0)), R(new THREE.MeshLambertMaterial({ side: THREE.DoubleSide })), N_BANDERINES);
  const colorTmp = new THREE.Color();
  const qTmp = new THREE.Quaternion();
  const escUno = new THREE.Vector3(1, 1, 1);
  const vTmp = new THREE.Vector3();
  for (let i = 0; i < N_BANDERINES; i++) {
    const tira = Math.floor(i / 16);
    const u = (i % 16) / 15;
    const x = -5.8 + u * 11.6;
    const z = -4.6 + tira * 1.7;
    const y = 2.9 - Math.sin(u * Math.PI) * 0.45;
    banderines.setMatrixAt(i, matrizTmp.compose(vTmp.set(x, y, z), qTmp.identity(), escUno));
    banderines.setColorAt(i, colorTmp.set(COLORES[(i * 5) % COLORES.length]));
  }
  raiz.add(banderines);
  // Mesa de la fiesta con un pastel
  const mesa = new THREE.Mesh(fusionar([
    colocar(new THREE.BoxGeometry(1.6, 0.05, 0.8), -3.4, 0.75, -2.6),
    colocar(new THREE.BoxGeometry(0.06, 0.75, 0.06), -4.1, 0.375, -2.9),
    colocar(new THREE.BoxGeometry(0.06, 0.75, 0.06), -2.7, 0.375, -2.9),
    colocar(new THREE.BoxGeometry(0.06, 0.75, 0.06), -4.1, 0.375, -2.3),
    colocar(new THREE.BoxGeometry(0.06, 0.75, 0.06), -2.7, 0.375, -2.3),
  ]), matMadera);
  raiz.add(mesa);
  const mantel = new THREE.Mesh(R(new THREE.BoxGeometry(1.7, 0.01, 0.9)), R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tela(0xd6283a, { repetir: [3, 2], semilla: 404 })) })));
  mantel.position.set(-3.4, 0.785, -2.6);
  raiz.add(mantel);
  const pastel = new THREE.Mesh(fusionar([
    colocar(new THREE.CylinderGeometry(0.22, 0.22, 0.16, 20), -3.4, 0.87, -2.6),
    colocar(new THREE.CylinderGeometry(0.15, 0.15, 0.12, 20), -3.4, 1.01, -2.6),
  ]), R(new THREE.MeshLambertMaterial({ color: 0xfbe3ea })));
  raiz.add(pastel);
  const sombraMesa = ctx.crearSombra({ radio: 0.9, opacidad: 0.4 });
  sombraMesa.position.set(-3.4, 0.005, -2.6);
  raiz.add(sombraMesa);

  // ─── La piñata de estrella ─────────────────────────────────────────────
  // Papel de seda en franjas con flecos
  const texPapel = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#ffffff';
    g.fillRect(0, 0, tam, tam);
    for (let i = 0; i < 10; i++) {
      g.fillStyle = i % 2 ? 'rgba(0,0,0,0.12)' : 'rgba(255,255,255,0.25)';
      g.fillRect(0, (i * tam) / 10, tam, tam / 20);
      g.strokeStyle = 'rgba(0,0,0,0.18)';
      g.lineWidth = 1;
      for (let x = 0; x < tam; x += 6) {
        g.beginPath();
        g.moveTo(x, (i * tam) / 10);
        g.lineTo(x + 3, (i * tam) / 10 + tam / 22);
        g.stroke();
      }
    }
  }, { tam: 128, repetir: [2, 2] }));
  const matPinata = R(new THREE.MeshStandardMaterial({ map: texPapel, roughness: 0.85, color: COLORES[0], emissive: 0x000000 }));
  const matPicos = R(new THREE.MeshStandardMaterial({ map: texPapel, roughness: 0.85, color: COLORES[1] }));
  const geoCuerpo = R(new THREE.SphereGeometry(R_PINATA, 20, 14));
  // Siete picos: seis alrededor y uno abajo
  const picos = [];
  for (let i = 0; i < 6; i++) {
    const a = (i / 6) * Math.PI * 2;
    picos.push({ dir: new THREE.Vector3(Math.cos(a), Math.sin(a) * 0.35, Math.sin(a)).normalize() });
  }
  picos.push({ dir: new THREE.Vector3(0, -1, 0) });
  picos.push({ dir: new THREE.Vector3(0, 1, 0) });
  const geoPico = R(new THREE.ConeGeometry(0.1, 0.32, 12).translate(0, R_PINATA + 0.12, 0));
  // Pompón de flecos en la punta
  const geoBorla = R(new THREE.IcosahedronGeometry(0.04, 1).translate(0, R_PINATA + 0.29, 0));
  const matBorla = R(new THREE.MeshLambertMaterial({ color: 0xffd23f, flatShading: true }));
  const pinata = new THREE.Group();
  const cuerpo = new THREE.Mesh(geoCuerpo, matPinata);
  pinata.add(cuerpo);
  const subeY = new THREE.Vector3(0, 1, 0);
  for (const p of picos) {
    p.malla = new THREE.Mesh(geoPico, matPicos);
    p.malla.quaternion.setFromUnitVectors(subeY, p.dir);
    p.borla = new THREE.Mesh(geoBorla, matBorla);
    p.borla.quaternion.copy(p.malla.quaternion);
    p.vel = new THREE.Vector3();
    p.giro = new THREE.Vector3();
    pinata.add(p.malla, p.borla);
  }
  // El pico de arriba no lleva borla (de ahí sale la cuerda)
  picos[7].borla.visible = false;
  raiz.add(pinata);
  const sombraPinata = ctx.crearSombra({ radio: 0.45, opacidad: 0.4 });
  raiz.add(sombraPinata);
  // Cuerda
  const posCuerda = new Float32Array(6);
  const geoCuerda = R(new THREE.BufferGeometry());
  geoCuerda.setAttribute('position', new THREE.BufferAttribute(posCuerda, 3));
  const cuerda = new THREE.Line(geoCuerda, R(new THREE.LineBasicMaterial({ color: 0xd8c8a0 })));
  cuerda.frustumCulled = false;
  raiz.add(cuerda);

  // ─── Caramelos (una InstancedMesh) ─────────────────────────────────────
  const caramelos = new THREE.InstancedMesh(
    R(new THREE.CapsuleGeometry(0.018, 0.03, 3, 8)),
    R(new THREE.MeshLambertMaterial()),
    N_CARAMELOS,
  );
  caramelos.frustumCulled = false;
  raiz.add(caramelos);
  const listaCaramelos = Array.from({ length: N_CARAMELOS }, (_, i) => {
    caramelos.setColorAt(i, colorTmp.set(COLORES_CARAMELO[i % COLORES_CARAMELO.length]));
    return { activo: false, pos: new THREE.Vector3(), vel: new THREE.Vector3(), giro: new THREE.Euler(), vida: 0 };
  });
  let siguienteCaramelo = 0;
  const ocultar = new THREE.Matrix4().makeScale(0, 0, 0);
  for (let i = 0; i < N_CARAMELOS; i++) caramelos.setMatrixAt(i, ocultar);

  // ─── El palo ───────────────────────────────────────────────────────────
  const texPalo = R(ctx.texturaCanvas((g, tam) => {
    for (let i = 0; i < 8; i++) {
      g.fillStyle = i % 2 ? '#f4efe6' : '#ff6a3d';
      g.fillRect(0, (i * tam) / 8, tam, tam / 8);
    }
  }, { tam: 64 }));
  const geoPalo = R(new THREE.CylinderGeometry(0.02, 0.018, LARGO_PALO, 10).rotateX(Math.PI / 2).translate(0, 0, -LARGO_PALO / 2 + 0.08));
  const matPalo = R(new THREE.MeshLambertMaterial({ map: texPalo }));
  const PUNTA = new THREE.Vector3(0, 0, -LARGO_PALO + 0.08);
  const MEDIO = new THREE.Vector3(0, 0, -LARGO_PALO * 0.45);
  const palosVR = ctx.manos.map((mano) => {
    const p = new THREE.Mesh(geoPalo, matPalo);
    p.visible = false;
    ctx.adjuntarAMano(mano, p);
    return { malla: p, punta: new THREE.Vector3(), puntaAntes: new THREE.Vector3(), base: new THREE.Vector3(), hay: false, espera: 0 };
  });
  // Sin gafas: el palo aparece abajo a la derecha y da un golpe al hacer clic
  const paloRaton = new THREE.Group();
  const mallaRaton = new THREE.Mesh(geoPalo, matPalo);
  paloRaton.add(mallaRaton);
  paloRaton.position.set(0.45, 1.0, 0.1);
  raiz.add(paloRaton);

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.1, alto: 0.32 });
  marcador.mesh.position.set(1.4, 2.2, -1.9);
  marcador.mesh.rotation.y = -0.35;
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'juego' | 'rota' | 'fin'
  let reloj = 3;
  let tiempo = 0;
  let puntos = 0;
  let record = ctx.leer('record', 0);
  let nivel = 0;
  let vida = 0;
  let vidaMax = 0;
  let rotas = 0;
  let aviso = '';
  let tiempoAviso = 0;
  let destello = 0;
  let empujon = 0;
  let golpeRaton = 0;
  let pivoteY = PIVOTE.y;
  // Péndulo: ángulos en x y en z y sus velocidades
  let ax = 0;
  let az = 0;
  let wx = 0;
  let wz = 0;
  let giro = 0;
  let wGiro = 0;
  const centro = new THREE.Vector3();
  const velPinata = new THREE.Vector3();
  const centroAntes = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const tmp3 = new THREE.Vector3();

  function montarPinata() {
    vidaMax = 6 + nivel * 3;
    vida = vidaMax;
    matPinata.color.set(COLORES[nivel % COLORES.length]);
    matPicos.color.set(COLORES[(nivel + 2) % COLORES.length]);
    for (const p of picos) {
      p.malla.position.set(0, 0, 0);
      p.borla.position.set(0, 0, 0);
      p.malla.quaternion.setFromUnitVectors(subeY, p.dir);
      p.borla.quaternion.copy(p.malla.quaternion);
      p.malla.visible = true;
      p.borla.visible = p !== picos[7];
    }
    cuerpo.visible = true;
    pinata.scale.setScalar(1);
    ax = (Math.random() - 0.5) * 0.3;
    az = 0;
    wx = wz = 0;
    estado = 'juego';
  }

  function empezarPartida() {
    tiempo = DURACION;
    puntos = 0;
    nivel = 0;
    rotas = 0;
    montarPinata();
  }

  function terminar() {
    estado = 'fin';
    reloj = 6;
    ctx.sonido('fin');
    ctx.puntuacion(puntos); // a la clasificación (juegos/marcadores.js)
    if (puntos > record) {
      record = puntos;
      ctx.guardar('record', record);
    }
  }

  function soltarCaramelos(n, desde, fuerza) {
    for (let k = 0; k < n; k++) {
      const c = listaCaramelos[siguienteCaramelo];
      siguienteCaramelo = (siguienteCaramelo + 1) % N_CARAMELOS;
      c.activo = true;
      c.vida = 4 + Math.random() * 2;
      c.pos.copy(desde);
      const a = Math.random() * Math.PI * 2;
      const v = (0.5 + Math.random()) * fuerza;
      c.vel.set(Math.cos(a) * v, Math.random() * fuerza * 1.2, Math.sin(a) * v);
      c.giro.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
    }
  }

  // Golpe a la piñata: fuerza 1-3, dirección horizontal del golpe
  function golpear(fuerza, dir, punto, mano) {
    vida -= fuerza;
    puntos += fuerza;
    destello = 0.15;
    // Empuja el péndulo y lo hace girar
    wx += (dir.x * (0.8 + fuerza * 0.6)) / CUERDA;
    wz += (dir.z * (0.8 + fuerza * 0.6)) / CUERDA;
    wGiro += (Math.random() - 0.5) * 4 * fuerza;
    const nivelEfecto = fuerza >= 3 ? 'grande' : fuerza === 2 ? 'medio' : 'pequeño';
    ctx.efectos.impacto(nivelEfecto, { pos: punto, mano, color: COLORES_CARAMELO[fuerza], sonido: 'carton' });
    tmp3.copy(punto);
    tmp3.y += 0.25;
    ctx.efectos.texto(tmp3, `+${fuerza}`, { color: fuerza >= 3 ? '#ff6a3d' : fuerza === 2 ? '#ffd23f' : '#ffffff', tam: 0.8 + fuerza * 0.25 });
    soltarCaramelos(fuerza, centro, 1.2);
    if (vida <= 0) romper(mano);
  }

  function romper(mano) {
    estado = 'rota';
    reloj = 1.4;
    rotas += 1;
    const extra = 10 + nivel * 5;
    puntos += extra;
    ctx.efectos.impacto('grande', { pos: centro, mano, color: 0xff6a3d, sonido: 'rasgar' });
    ctx.sonido('ovacion');
    ctx.efectos.estallido(centro, { color: COLORES[nivel % COLORES.length], cantidad: 40 });
    tmp3.copy(centro);
    tmp3.y += 0.45;
    ctx.efectos.texto(tmp3, `+${extra}`, { color: '#ff6a3d', tam: 1.8 });
    aviso = ctx.t('rota', { n: rotas });
    tiempoAviso = 1.6;
    soltarCaramelos(45, centro, 2.4);
    cuerpo.visible = false;
    for (const p of picos) {
      p.vel.copy(p.dir).multiplyScalar(2 + Math.random() * 1.5);
      p.vel.y += 1.5;
      p.giro.set((Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12, (Math.random() - 0.5) * 12);
    }
  }

  function fuerzaPorRapidez(v) {
    return v > 6 ? 3 : v > 3.6 ? 2 : 1;
  }

  // ─── Entrada ───────────────────────────────────────────────────────────
  function entradaVR(dt) {
    paloRaton.visible = false;
    ctx.manos.forEach((mano, k) => {
      const p = palosVR[k];
      p.malla.visible = mano.activa;
      p.espera -= dt;
      if (!mano.activa) {
        p.hay = false;
        return;
      }
      mano.grip.localToWorld(p.punta.copy(PUNTA));
      if (!p.hay) {
        p.puntaAntes.copy(p.punta);
        p.hay = true;
        return;
      }
      if (estado === 'juego' && p.espera <= 0) {
        // Distancia del centro de la piñata al palo (de la mitad a la punta)
        mano.grip.localToWorld(p.base.copy(MEDIO));
        tmp.copy(p.punta).sub(p.base);
        const largo = tmp.lengthSq();
        const u = Math.min(1, Math.max(0, tmp2.copy(centro).sub(p.base).dot(tmp) / largo));
        tmp2.copy(p.base).addScaledVector(tmp, u);
        if (tmp2.distanceTo(centro) < R_GOLPE + 0.02) {
          tmp.copy(p.punta).sub(p.puntaAntes).divideScalar(Math.max(dt, 1e-3)).sub(velPinata);
          const rapidez = tmp.length();
          if (rapidez > 1.6) {
            tmp.y = 0;
            if (tmp.lengthSq() < 1e-4) tmp.set(0, 0, -1);
            tmp.normalize();
            golpear(fuerzaPorRapidez(rapidez), tmp, tmp2, mano);
            p.espera = 0.3;
          }
        }
      }
      p.puntaAntes.copy(p.punta);
    });
  }

  function entradaRaton(dt) {
    for (const p of palosVR) {
      p.malla.visible = false;
      p.hay = false;
    }
    paloRaton.visible = true;
    golpeRaton = Math.max(0, golpeRaton - dt * 4);
    // Animación: el palo baja y vuelve
    paloRaton.rotation.set(0.5 - Math.sin(golpeRaton * Math.PI) * 1.3, 0.35, 0);
    if (!ctx.raton.clic || estado !== 'juego') return;
    golpeRaton = 1;
    ctx.sonido('zas');
    if (ctx.raton.rayo.ray.distanceSqToPoint(centro) > R_GOLPE * R_GOLPE) return;
    ctx.raton.rayo.ray.closestPointToPoint(centro, tmp2);
    tmp.copy(ctx.raton.rayo.ray.direction);
    tmp.y = 0;
    tmp.normalize();
    // Más fuerza si la piñata se mueve rápido
    const v = velPinata.length();
    golpear(v > 2.4 ? 3 : v > 1.1 ? 2 : 1, tmp, tmp2, null);
  }

  // ─── Física ────────────────────────────────────────────────────────────
  function moverPinata(dt, t) {
    // Quien sujeta la cuerda la sube, la baja y da tirones, más cuanto más nivel
    const n = Math.min(nivel, 6);
    pivoteY = PIVOTE.y + Math.sin(t * (0.9 + n * 0.15)) * (0.08 + n * 0.05);
    empujon -= dt;
    if (empujon <= 0 && estado === 'juego') {
      empujon = 2.4 - n * 0.22 + Math.random();
      const a = Math.random() * Math.PI * 2;
      wx += Math.cos(a) * (0.3 + n * 0.18);
      wz += Math.sin(a) * (0.2 + n * 0.1);
    }
    const k = G / CUERDA;
    wx += (-k * Math.sin(ax) - wx * 0.35) * dt;
    wz += (-k * Math.sin(az) - wz * 0.35) * dt;
    ax = Math.max(-1.1, Math.min(1.1, ax + wx * dt));
    az = Math.max(-0.9, Math.min(0.9, az + wz * dt));
    wGiro *= 1 - Math.min(1, dt * 0.8);
    giro += (wGiro + 0.3) * dt;
    const sx = Math.sin(ax);
    const sz = Math.sin(az);
    centroAntes.copy(centro);
    centro.set(PIVOTE.x + CUERDA * sx, pivoteY - CUERDA * Math.sqrt(Math.max(0.05, 1 - sx * sx - sz * sz)), PIVOTE.z + CUERDA * sz);
    velPinata.copy(centro).sub(centroAntes).divideScalar(Math.max(dt, 1e-3));
    pinata.position.copy(centro);
    pinata.rotation.set(az * 0.6, giro, -ax * 0.6);
    // Golpe: se encoge un momento y brilla
    destello -= dt;
    const golpe = Math.max(0, destello) / 0.15;
    pinata.scale.set(1 + golpe * 0.12, 1 - golpe * 0.1, 1 + golpe * 0.12);
    matPinata.emissive.setScalar(golpe * 0.35);
    // Cuerda del pivote al pico de arriba
    posCuerda[0] = PIVOTE.x;
    posCuerda[1] = pivoteY + 0.3;
    posCuerda[2] = PIVOTE.z;
    posCuerda[3] = centro.x;
    posCuerda[4] = centro.y + R_PINATA + 0.3;
    posCuerda[5] = centro.z;
    geoCuerda.attributes.position.needsUpdate = true;
    ctx.colocarSombra(sombraPinata, centro, 0);
  }

  // Los trozos de la piñata rota caen al suelo
  function moverTrozos(dt) {
    for (const p of picos) {
      p.vel.y -= G * dt;
      p.malla.position.addScaledVector(p.vel, dt);
      p.malla.rotation.x += p.giro.x * dt;
      p.malla.rotation.z += p.giro.z * dt;
      p.borla.position.copy(p.malla.position);
      p.borla.quaternion.copy(p.malla.quaternion);
    }
    pinata.scale.setScalar(Math.max(0.01, reloj / 1.4));
    sombraPinata.visible = false;
  }

  function moverCaramelos(dt) {
    for (let i = 0; i < N_CARAMELOS; i++) {
      const c = listaCaramelos[i];
      if (!c.activo) continue;
      c.vida -= dt;
      if (c.vida <= 0) {
        c.activo = false;
        caramelos.setMatrixAt(i, ocultar);
        continue;
      }
      c.vel.y -= G * dt;
      c.pos.addScaledVector(c.vel, dt);
      if (c.pos.y < 0.018) {
        c.pos.y = 0.018;
        c.vel.y *= -0.35;
        c.vel.x *= 0.6;
        c.vel.z *= 0.6;
      } else {
        c.giro.x += dt * 8;
        c.giro.z += dt * 5;
      }
      qTmp.setFromEuler(c.giro);
      const esc = Math.min(1, c.vida * 2);
      matrizTmp.compose(c.pos, qTmp, vTmp.set(esc, esc, esc));
      caramelos.setMatrixAt(i, matrizTmp);
    }
    caramelos.instanceMatrix.needsUpdate = true;
  }

  function actualizarMarcador() {
    if (estado === 'intro') {
      const intro = ctx.enVR() ? ctx.t('intro') : ctx.t(ctx.tactil ? 'introTactil' : 'introRaton');
      marcador.escribir([
        { texto: ctx.t('titulo'), tam: 1.3, color: '#ff8a65' },
        { texto: intro, tam: 0.72 },
      ]);
    } else if (estado === 'fin') {
      marcador.escribir([
        { texto: ctx.t('fin', { n: puntos, rotas }), tam: 1.1, color: '#ff8a65' },
        { texto: ctx.t('partida.recordNuevaPartida', { record, n: Math.max(1, Math.ceil(reloj)) }), tam: 0.72 },
      ]);
    } else {
      const llenas = Math.max(0, Math.ceil((vida / vidaMax) * 10));
      marcador.escribir([
        { texto: ctx.t('partida.puntosTiempo', { puntos, s: Math.max(0, Math.ceil(tiempo)) }), tam: 1.15 },
        { texto: tiempoAviso > 0 ? aviso : ctx.t('aguante', { barra: '▮'.repeat(llenas) + '▯'.repeat(10 - llenas) }), tam: 0.8, color: tiempoAviso > 0 ? '#ffe08a' : '#cfd8dc' },
      ]);
    }
  }

  // ─── Bucle ─────────────────────────────────────────────────────────────
  function actualizar(dt, t) {
    reloj -= dt;
    tiempoAviso -= dt;
    if ((estado === 'intro' || estado === 'fin') && reloj <= 0) empezarPartida();
    if (estado === 'juego' || estado === 'rota') {
      tiempo -= dt;
      if (tiempo <= 0) {
        tiempo = 0;
        terminar();
      }
    }

    moverPinata(dt, t);
    if (estado === 'rota') {
      moverTrozos(dt);
      if (reloj <= 0) {
        nivel += 1;
        montarPinata();
      }
    }
    if (ctx.enVR()) entradaVR(dt);
    else entradaRaton(dt);
    moverCaramelos(dt);
    actualizarMarcador();
  }

  centro.set(PIVOTE.x, PIVOTE.y - CUERDA, PIVOTE.z);
  montarPinata();
  estado = 'intro';
  reloj = 3;
  actualizarMarcador();

  return {
    actualizar,
    liberar() {},
  };
}
