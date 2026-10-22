// BOLAS DE NIEVE
// Una guerra de bolas de nieve contra una pandilla de pingüinos, en un valle nevado entre
// pinos. Los pingüinos asoman detrás de sus muros de nieve, cogen impulso y te tiran una
// bola. Dales antes de que tiren (15 puntos; 10 si ya han tirado) o rompe su bola en el
// aire (15). Si te dan tres bolas, se acaba. Cada vez asoman más y más rápido.
// En VR, aprieta el gatillo para coger una bola y lánzala soltándolo; puedes esquivar las
// suyas moviendo la cabeza. Sin gafas, haz clic (o toca) donde quieras tirar.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código.
export async function precargar() {}

const VIDAS = 3;
const R_BOLA = 0.06;
const G = 9.8;
// Muros de nieve de los pingüinos: x, z y altura del muro
const FUERTES = [
  { x: -4.2, z: -7.5, alto: 0.75 },
  { x: -1.4, z: -10, alto: 0.8 },
  { x: 1.8, z: -8.5, alto: 0.75 },
  { x: 4.6, z: -11, alto: 0.85 },
  { x: 0.2, z: -13, alto: 0.9 },
];
const N_MIAS = 5;
const N_SUYAS = 6;
const R_PINGUINO = 0.3;
const VUELO_SUYA = 1.35;             // segundos que tarda su bola en llegar
const MANO_RATON = new THREE.Vector3(0.25, 1.35, -0.2);

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (r) => ctx.recurso(r);

  ctx.fondo(0xcfe3f2, {
    cenit: 0x7fa8d0, horizonte: 0xf2f6fa, nubes: 0.6, sol: [0.3, 0.45, -0.8], niebla: [18, 70],
    paisaje: { tipo: 'montes', color: 0xe6eef6, radio: 70 },
  });
  ctx.sueloBase(false);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.6, 0.4), new THREE.Vector3(0, 0.9, -9));

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

  // ─── El valle nevado ───────────────────────────────────────────────────
  const matNieve = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.grano(0xf4f8fc, { repetir: [20, 20], semilla: 601 })) }));
  const suelo = new THREE.Mesh(R(new THREE.PlaneGeometry(120, 120)), matNieve);
  suelo.rotation.x = -Math.PI / 2;
  raiz.add(suelo);
  const pinos = [];
  for (let i = 0; i < 14; i++) {
    const lado = i % 2 ? 1 : -1;
    pinos.push({ x: lado * (8 + (i % 3) * 2.5), z: -3 - i * 1.6, escala: 1.1 + (i % 4) * 0.2 });
  }
  for (let i = 0; i < 9; i++) pinos.push({ x: -14 + i * 3.5, z: -18 - (i % 3) * 2, escala: 1.4 });
  raiz.add(ctx.arboles(pinos, { tipo: 'pino', hojas: 0x2f5a46, semilla: 61 }));
  // Muros de nieve: el tuyo y los de los pingüinos (bloques redondeados)
  const geosMuro = [];
  const bloque = () => new THREE.SphereGeometry(0.5, 12, 8);
  for (let i = 0; i < 5; i++) geosMuro.push(colocar(bloque().scale(0.7, 0.9, 0.55), -1.1 + i * 0.55, 0.38, -0.85));
  for (const f of FUERTES) {
    for (let i = 0; i < 4; i++) geosMuro.push(colocar(bloque().scale(0.75, f.alto * 1.25, 0.6), f.x - 0.75 + i * 0.5, f.alto * 0.45, f.z, 0, (i - 1.5) * 0.1));
  }
  const muros = new THREE.Mesh(fusionar(geosMuro), matNieve);
  raiz.add(muros);
  for (const f of FUERTES) {
    const s = ctx.crearSombra({ radio: 1.2, opacidad: 0.25 });
    s.scale.set(2.2, 1, 0.9);
    s.position.set(f.x, 0.005, f.z + 0.2);
    raiz.add(s);
  }
  // Montón de bolas sobre tu muro
  const geoBola = R(new THREE.IcosahedronGeometry(R_BOLA, 2));
  const matBola = R(new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true }));
  const monton = new THREE.InstancedMesh(geoBola, matBola, 7);
  [[0.35, 0.86, -0.75], [0.47, 0.86, -0.76], [0.41, 0.86, -0.66], [0.53, 0.86, -0.67], [0.41, 0.95, -0.72], [0.5, 0.95, -0.71], [0.46, 1.03, -0.71]].forEach(([x, y, z], i) => {
    monton.setMatrixAt(i, matrizTmp.makeTranslation(x, y, z));
  });
  raiz.add(monton);

  // ─── Pingüinos ─────────────────────────────────────────────────────────
  const matNegro = R(new THREE.MeshLambertMaterial({ color: 0x1e2430 }));
  const matBlanco = R(new THREE.MeshLambertMaterial({ color: 0xf6f6f2 }));
  const matNaranja = R(new THREE.MeshLambertMaterial({ color: 0xff8a2a }));
  const matGorro = R(new THREE.MeshLambertMaterial({ color: 0xd6283a }));
  const geoCuerpo = fusionar([
    colocar(new THREE.SphereGeometry(0.3, 16, 12).scale(1, 1.35, 0.9), 0, 0, 0),
    colocar(new THREE.SphereGeometry(0.2, 14, 10), 0, 0.47, 0),
  ]);
  const geoPecho = fusionar([
    colocar(new THREE.SphereGeometry(0.24, 14, 10).scale(1, 1.3, 0.6), 0, -0.04, 0.14),
    colocar(new THREE.SphereGeometry(0.045, 8, 6), -0.075, 0.52, 0.16),
    colocar(new THREE.SphereGeometry(0.045, 8, 6), 0.075, 0.52, 0.16),
  ]);
  const geoPico = fusionar([colocar(new THREE.ConeGeometry(0.05, 0.13, 8), 0, 0.45, 0.22, Math.PI / 2)]);
  // Gorro de lana con pompón
  const geoGorro = fusionar([
    colocar(new THREE.SphereGeometry(0.17, 12, 8, 0, Math.PI * 2, 0, Math.PI / 2), 0, 0.56, 0),
    colocar(new THREE.SphereGeometry(0.05, 8, 6), 0, 0.74, 0),
  ]);
  const geoAleta = R(new THREE.SphereGeometry(0.09, 10, 8).scale(0.45, 1.6, 0.8).translate(0, -0.12, 0));
  const geoOjo = R(new THREE.SphereGeometry(0.022, 6, 4));
  const pinguinos = FUERTES.map((f, i) => {
    const grupo = new THREE.Group();
    const cuerpo = new THREE.Mesh(geoCuerpo, matNegro);
    const pecho = new THREE.Mesh(geoPecho, matBlanco);
    const pico = new THREE.Mesh(geoPico, matNaranja);
    const gorro = new THREE.Mesh(geoGorro, i % 2 ? matGorro : matNaranja);
    const ojos = new THREE.Group();
    for (const x of [-0.075, 0.075]) {
      const o = new THREE.Mesh(geoOjo, matNegro);
      o.position.set(x, 0.53, 0.2);
      ojos.add(o);
    }
    const aleta = new THREE.Mesh(geoAleta, matNegro);
    aleta.position.set(0.3, 0.12, 0);
    const aletaIzq = new THREE.Mesh(geoAleta, matNegro);
    aletaIzq.position.set(-0.3, 0.12, 0);
    aletaIzq.rotation.z = -0.3;
    const bolaMano = new THREE.Mesh(geoBola, matBola);
    bolaMano.position.set(0, -0.3, 0);
    aleta.add(bolaMano);
    grupo.add(cuerpo, pecho, pico, gorro, ojos, aleta, aletaIzq);
    grupo.visible = false;
    raiz.add(grupo);
    return {
      f, grupo, aleta, bolaMano,
      estado: 'escondido', // 'escondido' | 'subiendo' | 'apuntando' | 'tirado' | 'bajando' | 'golpeado'
      t: 0, alto: 0, carga: 1.2, espera: 1 + i * 0.7,
      centro: new THREE.Vector3(),
    };
  });

  // ─── Bolas: las tuyas y las suyas ──────────────────────────────────────
  function crearBola() {
    const m = new THREE.Mesh(geoBola, matBola);
    m.visible = false;
    raiz.add(m);
    const s = ctx.crearSombra({ radio: 0.07, opacidad: 0.35 });
    s.visible = false;
    raiz.add(s);
    return { malla: m, sombra: s, estado: 'libre', vel: new THREE.Vector3(), mano: null, vida: 0, tiempo: 0 };
  }
  const mias = Array.from({ length: N_MIAS }, crearBola);
  const suyas = Array.from({ length: N_SUYAS }, crearBola);
  // Historial de posiciones de cada mano para la velocidad del lanzamiento
  const historiales = ctx.manos.map(() => ({ pos: Array.from({ length: 8 }, () => new THREE.Vector3()), dt: new Array(8).fill(0.016), n: 0 }));

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.1, alto: 0.32 });
  marcador.mesh.position.set(-1.3, 1.75, -2.2);
  marcador.mesh.rotation.y = 0.3;
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'juego' | 'fin'
  let reloj = 3;
  let jugado = 0;
  let puntos = 0;
  let record = ctx.leer('record', 0);
  let vidas = VIDAS;
  let aviso = '';
  let tiempoAviso = 0;
  let racha = 0;
  const cabeza = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();

  function empezarPartida() {
    estado = 'juego';
    jugado = 0;
    puntos = 0;
    vidas = VIDAS;
    racha = 0;
    pinguinos.forEach((p, i) => {
      p.estado = 'escondido';
      p.espera = 1 + i * 0.9 + Math.random();
      p.grupo.visible = false;
    });
    for (const b of suyas) soltar(b);
    for (const b of mias) soltar(b);
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
    for (const p of pinguinos) if (p.estado !== 'escondido') p.estado = 'bajando';
  }

  function soltar(b) {
    b.estado = 'libre';
    b.mano = null;
    b.malla.visible = false;
    b.sombra.visible = false;
  }

  // Dificultad: cuántos pingüinos asoman a la vez y cuánto tardan en tirar
  function maxFuera() {
    return Math.min(4, 1 + Math.floor(jugado / 20));
  }
  function tiempoCarga() {
    return Math.max(0.75, 1.6 - jugado * 0.012);
  }

  function lanzarSuya(p) {
    const b = suyas.find((x) => x.estado === 'libre');
    if (!b) return;
    // Apunta a donde está tu cabeza ahora, con un poco de error
    ctx.camara.getWorldPosition(cabeza);
    b.malla.position.copy(p.bolaMano.getWorldPosition(tmp));
    tmp2.copy(cabeza);
    tmp2.x += (Math.random() - 0.5) * 0.25;
    tmp2.y += (Math.random() - 0.5) * 0.15;
    const t = VUELO_SUYA;
    b.vel.copy(tmp2).sub(b.malla.position).divideScalar(t);
    b.vel.y += 0.5 * G * t;
    b.estado = 'suya';
    b.tiempo = 0;
    b.malla.visible = true;
    b.sombra.visible = true;
    ctx.sonido('zas');
  }

  function lanzarMia(b, vel) {
    b.estado = 'mia';
    b.mano = null;
    b.vel.copy(vel);
    b.vida = 3;
    b.malla.visible = true;
    b.sombra.visible = true;
    ctx.sonido('zas');
  }

  // ─── Pingüinos: asomar, apuntar, tirar y esconderse ────────────────────
  function moverPinguinos(dt, t) {
    let fuera = 0;
    for (const p of pinguinos) if (p.estado !== 'escondido') fuera++;
    for (const p of pinguinos) {
      p.t += dt;
      if (p.estado === 'escondido') {
        p.espera -= dt;
        if (estado === 'juego' && p.espera <= 0 && fuera < maxFuera()) {
          p.estado = 'subiendo';
          p.t = 0;
          p.carga = tiempoCarga() * (0.85 + Math.random() * 0.3);
          p.grupo.visible = true;
          p.bolaMano.visible = true;
          fuera++;
        }
      } else if (p.estado === 'subiendo') {
        p.alto = Math.min(1, p.alto + dt * 4);
        if (p.alto >= 1) {
          p.estado = 'apuntando';
          p.t = 0;
        }
      } else if (p.estado === 'apuntando') {
        // Echa la aleta hacia atrás y tira
        p.aleta.rotation.x = -Math.min(1, p.t / p.carga) * 2.4;
        p.aleta.rotation.z = 0.2;
        if (p.t >= p.carga) {
          p.aleta.rotation.x = 0.8;
          p.bolaMano.visible = false;
          lanzarSuya(p);
          p.estado = 'tirado';
          p.t = 0;
        }
      } else if (p.estado === 'tirado') {
        if (p.t > 0.7) {
          p.estado = 'bajando';
          p.t = 0;
        }
      } else if (p.estado === 'golpeado') {
        // Se cae hacia atrás
        p.grupo.rotation.x = -Math.min(1.3, p.t * 5);
        if (p.t > 0.5) {
          p.estado = 'bajando';
          p.t = 0;
        }
      }
      if (p.estado === 'bajando') {
        p.alto = Math.max(0, p.alto - dt * 3);
        if (p.alto <= 0) {
          p.estado = 'escondido';
          p.grupo.visible = false;
          p.grupo.rotation.x = 0;
          p.aleta.rotation.set(0, 0, 0);
          p.espera = 0.6 + Math.random() * Math.max(0.6, 2.2 - jugado * 0.02);
        }
      }
      // De detrás del muro hacia arriba, con un balanceo
      const y = p.f.alto - 0.55 + p.alto * 0.75;
      p.grupo.position.set(p.f.x + Math.sin(t * 1.3 + p.f.x) * 0.15, y, p.f.z - 0.3);
      p.grupo.rotation.z = Math.sin(t * 6 + p.f.z) * 0.06 * p.alto;
      // Siempre mirando hacia ti
      p.grupo.rotation.y = Math.atan2(-p.grupo.position.x, -p.grupo.position.z) * 0.6;
      p.centro.copy(p.grupo.position);
      p.centro.y += 0.15;
    }
  }

  function golpearPinguino(p, pos) {
    const antes = p.estado === 'subiendo' || p.estado === 'apuntando';
    const gana = antes ? 15 : 10;
    puntos += gana;
    racha += 1;
    p.estado = 'golpeado';
    p.t = 0;
    p.bolaMano.visible = false;
    ctx.efectos.impacto(antes ? 'medio' : 'pequeño', { pos, color: 0xffffff, sonido: 'nieve' });
    ctx.efectos.estallido(pos, { color: 0xffffff, cantidad: 14 });
    tmp.copy(pos);
    tmp.y += 0.5;
    ctx.efectos.texto(tmp, `+${gana}`, { color: antes ? '#ff6a3d' : '#ffe08a', tam: antes ? 1.6 : 1.3 });
    ctx.sonido('cuac');
    if (racha > 0 && racha % 5 === 0) {
      aviso = ctx.t('racha', { n: racha });
      tiempoAviso = 1.5;
    }
  }

  // ─── Entrada ───────────────────────────────────────────────────────────
  function entradaVR(dt) {
    ctx.manos.forEach((mano, k) => {
      const h = historiales[k];
      h.n = (h.n + 1) % 8;
      h.pos[h.n].copy(mano.posicion);
      h.dt[h.n] = dt;
      if (!mano.activa) return;
      const cogida = mias.find((b) => b.mano === mano);
      if (cogida) {
        mano.grip.localToWorld(cogida.malla.position.set(0, -0.01, -0.06));
        if (!mano.gatillo) {
          const atras = (h.n + 8 - 4) % 8;
          let tiempo = 0;
          for (let j = 0; j < 4; j++) tiempo += h.dt[(h.n + 8 - j) % 8];
          tmp.copy(h.pos[h.n]).sub(h.pos[atras]).divideScalar(Math.max(tiempo, 1e-3)).multiplyScalar(1.5);
          if (tmp.length() < 1.5) {
            soltar(cogida); // la suelta sin lanzarla
          } else {
            lanzarMia(cogida, tmp);
            ctx.vibrar(mano, 0.3, 30);
          }
        }
        return;
      }
      if (mano.gatilloPulsado && estado === 'juego') {
        const b = mias.find((x) => x.estado === 'libre');
        if (!b) return;
        b.estado = 'mano';
        b.mano = mano;
        b.malla.visible = true;
        mano.grip.localToWorld(b.malla.position.set(0, -0.01, -0.06));
        ctx.vibrar(mano, 0.2, 20);
        ctx.sonido('grava');
      }
    });
  }

  function entradaRaton() {
    if (!ctx.raton.clic || estado !== 'juego') return;
    const b = mias.find((x) => x.estado === 'libre');
    if (!b) return;
    const rayo = ctx.raton.rayo.ray;
    // ¿A qué apunta? Una bola suya o un pingüino; si no, un punto lejano
    let mejor = 30;
    let blanco = null;
    tmp2.copy(rayo.direction).multiplyScalar(12).add(rayo.origin);
    for (const s of suyas) {
      if (s.estado !== 'suya') continue;
      if (rayo.distanceSqToPoint(s.malla.position) < 0.3 * 0.3) {
        const d = s.malla.position.distanceTo(rayo.origin);
        if (d < mejor) {
          mejor = d;
          blanco = s;
        }
      }
    }
    if (blanco) {
      // Apunta a donde estará la bola cuando llegue la tuya
      const te = blanco.malla.position.distanceTo(MANO_RATON) / 16;
      tmp2.copy(blanco.malla.position).addScaledVector(blanco.vel, te);
      tmp2.y -= 0.5 * G * te * te;
    }
    if (mejor === 30) {
      for (const p of pinguinos) {
        if (p.estado === 'escondido' || p.estado === 'bajando') continue;
        if (rayo.distanceSqToPoint(p.centro) < 0.42 * 0.42) {
          const d = p.centro.distanceTo(rayo.origin);
          if (d < mejor) {
            mejor = d;
            tmp2.copy(p.centro);
          }
        }
      }
    }
    // Tiro parabólico rápido hacia el punto (las bolas suyas se adelantan un poco)
    b.malla.position.copy(MANO_RATON);
    const dist = tmp2.distanceTo(MANO_RATON);
    const t = Math.max(0.12, dist / 16);
    tmp.copy(tmp2).sub(MANO_RATON).divideScalar(t);
    tmp.y += 0.5 * G * t;
    lanzarMia(b, tmp);
  }

  // ─── Física de las bolas ───────────────────────────────────────────────
  function moverBolas(dt) {
    for (const b of mias) {
      if (b.estado !== 'mia') continue;
      b.vida -= dt;
      b.vel.y -= G * dt;
      b.malla.position.addScaledVector(b.vel, dt);
      const p = b.malla.position;
      ctx.colocarSombra(b.sombra, p, 0.005);
      // ¿Rompe una bola suya en el aire?
      let fuera = false;
      for (const s of suyas) {
        if (s.estado !== 'suya') continue;
        if (s.malla.position.distanceTo(p) < R_BOLA * 2 + 0.12) {
          puntos += 15;
          racha += 1;
          ctx.efectos.impacto('medio', { pos: p, color: 0xffffff, sonido: 'nieve' });
          ctx.efectos.estallido(p, { color: 0xbfe6ff, cantidad: 16 });
          tmp.copy(p);
          tmp.y += 0.3;
          ctx.efectos.texto(tmp, '+15', { color: '#ff6a3d', tam: 1.4 });
          aviso = ctx.t('enElAire');
          tiempoAviso = 1.2;
          soltar(s);
          fuera = true;
          break;
        }
      }
      // ¿Le da a un pingüino?
      if (!fuera) {
        for (const pg of pinguinos) {
          if (pg.estado === 'escondido' || pg.estado === 'golpeado' || pg.alto < 0.4) continue;
          if (pg.centro.distanceTo(p) < R_PINGUINO + R_BOLA + 0.04) {
            golpearPinguino(pg, p);
            fuera = true;
            break;
          }
        }
      }
      // Muros y suelo
      if (!fuera && p.y < 0.05) {
        ctx.efectos.estallido(p, { color: 0xffffff, cantidad: 5 });
        fuera = true;
      }
      if (!fuera) {
        for (const f of FUERTES) {
          if (Math.abs(p.z - f.z) < 0.3 && Math.abs(p.x - f.x) < 1.1 && p.y < f.alto + 0.05) {
            ctx.efectos.estallido(p, { color: 0xffffff, cantidad: 6 });
            ctx.sonido('plof');
            racha = 0;
            fuera = true;
            break;
          }
        }
      }
      if (fuera || b.vida <= 0 || p.z < -25) soltar(b);
    }
    ctx.camara.getWorldPosition(cabeza);
    for (const s of suyas) {
      if (s.estado !== 'suya') continue;
      s.tiempo += dt;
      s.vel.y -= G * dt;
      s.malla.position.addScaledVector(s.vel, dt);
      const p = s.malla.position;
      ctx.colocarSombra(s.sombra, p, 0.005);
      // ¿Te da?
      if (p.distanceTo(cabeza) < 0.32) {
        soltar(s);
        recibir();
        continue;
      }
      // Choca con tu muro o pasa de largo
      if ((Math.abs(p.z + 0.85) < 0.3 && Math.abs(p.x + 0) < 1.5 && p.y < 0.85) || p.y < 0.03) {
        ctx.efectos.estallido(p, { color: 0xffffff, cantidad: 8 });
        ctx.sonido('plof');
        soltar(s);
        continue;
      }
      if (p.z > 2 || s.tiempo > 3) {
        soltar(s);
        aviso = ctx.t('esquivada');
        tiempoAviso = 1;
      }
    }
  }

  function recibir() {
    vidas -= 1;
    racha = 0;
    ctx.destello(0xffffff, 0.85);
    ctx.efectos.impacto('grande', { color: 0xffffff, sonido: 'nieve' });
    ctx.sonido('fallo');
    for (const m of ctx.manos) ctx.vibrar(m, 0.6, 120);
    aviso = ctx.t('teDan', { n: vidas });
    tiempoAviso = 1.6;
    if (vidas <= 0) terminar();
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
        { texto: ctx.t('partida.finPuntos', { n: puntos }), tam: 1.3, color: '#ff8a65' },
        { texto: ctx.t('partida.recordNuevaPartida', { record, n: Math.max(1, Math.ceil(reloj)) }), tam: 0.72 },
      ]);
    } else {
      marcador.escribir([
        { texto: ctx.t('marcador', { puntos, vidas: '❄'.repeat(vidas) + '·'.repeat(VIDAS - vidas) }), tam: 1.15 },
        { texto: tiempoAviso > 0 ? aviso : ctx.t('consejo'), tam: 0.78, color: tiempoAviso > 0 ? '#ffe08a' : '#cfd8dc' },
      ]);
    }
  }

  // ─── Bucle ─────────────────────────────────────────────────────────────
  function actualizar(dt, t) {
    reloj -= dt;
    tiempoAviso -= dt;
    if ((estado === 'intro' || estado === 'fin') && reloj <= 0) empezarPartida();
    if (estado === 'juego') jugado += dt;

    if (ctx.enVR()) entradaVR(dt);
    else entradaRaton();
    moverPinguinos(dt, t);
    moverBolas(dt);
    for (const b of mias) {
      if (b.estado === 'mano') {
        b.malla.rotation.y += dt;
        b.sombra.visible = false;
      }
    }
    actualizarMarcador();
  }

  actualizarMarcador();

  return {
    actualizar,
    liberar() {},
  };
}
