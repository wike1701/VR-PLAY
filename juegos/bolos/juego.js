// BOLOS
// Partida de 10 marcos con la puntuación oficial (plenos, semiplenos y el
// décimo marco con tiros extra). En VR coges la bola del soporte y la lanzas
// con el brazo; con ratón o con el dedo apuntas y haces clic/tocas para tirar.
// Los bolos chocan entre sí, así que hay reacciones en cadena.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const G = 9.8;
const ANCHO = 1.06;            // pista reglamentaria
const CANAL = 0.13;            // ancho de cada canal
const Z_FALTA = -0.5;          // línea de falta, justo delante del jugador
const Z_BOLO1 = -13.5;         // bolo de cabeza (en una bolera real está a 18,3 m)
const Z_FIN = -14.9;           // final de la pista: foso
const R_BOLA = 0.11;
const MASA_BOLA = 6;
const R_BOLO = 0.06;
const R_BOLO_CAIDO = 0.1;      // un bolo tumbado ocupa más
const ALTO_BOLO = 0.38;
const MASA_BOLO = 1.5;
const SEPARACION = 0.305;
const VELOCIDAD_CAIDA = 0.3;   // velocidad a la que un bolo empujado se cae
const FUERZA_VR = 1.2;
const ALCANCE_AGARRE = 0.26;
const SOPORTE = new THREE.Vector3(0.6, 0.85, 0.05);
const VELOCIDAD_RATON = 8;

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  ctx.fondo(0x231a3a);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.45, 1.1), new THREE.Vector3(0, 0.1, Z_BOLO1));

  // ─── Bolera ────────────────────────────────────────────────────────────
  ctx.sueloBase(false);
  const escalarUV = (geo, u, v = u) => {
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
    return geo;
  };
  const largo = Z_FALTA - Z_FIN;
  // Madera de la pista: tablas a lo largo (la textura se gira 90°)
  const texPista = R(ctx.texturas.tablas(0xd9a066, { tablas: 10, semilla: 21 }));
  texPista.center.set(0.5, 0.5);
  texPista.rotation = Math.PI / 2;
  const matPista = R(new THREE.MeshLambertMaterial({ map: texPista }));
  const geoPista = escalarUV(R(new THREE.PlaneGeometry(ANCHO, largo).rotateX(-Math.PI / 2)), 1, largo / 1.5);
  // Pista propia y dos vecinas (decorado) con la misma geometría: una malla instanciada
  const pistas = new THREE.InstancedMesh(geoPista, matPista, 3);
  [-1, 0, 1].forEach((k, i) => pistas.setMatrixAt(i, new THREE.Matrix4().setPosition(k * (ANCHO + 2 * CANAL + 0.5), 0, (Z_FALTA + Z_FIN) / 2)));
  raiz.add(pistas);
  // Canales y separadores
  const matCanal = R(new THREE.MeshLambertMaterial({ color: 0x2b2b33 }));
  const geoCanal = R(new THREE.BoxGeometry(CANAL, 0.02, largo));
  const geoSeparador = R(new THREE.BoxGeometry(0.5, 0.06, largo));
  const canales = new THREE.InstancedMesh(geoCanal, matCanal, 6);
  const separadores = new THREE.InstancedMesh(geoSeparador, R(new THREE.MeshLambertMaterial({ color: 0x3a2f55 })), 4);
  let ic = 0;
  let is = 0;
  for (const k of [-1, 0, 1]) {
    const cx = k * (ANCHO + 2 * CANAL + 0.5);
    for (const s of [-1, 1]) canales.setMatrixAt(ic++, new THREE.Matrix4().setPosition(cx + s * (ANCHO / 2 + CANAL / 2), -0.05, (Z_FALTA + Z_FIN) / 2));
  }
  for (const x of [-1.5, -0.5, 0.5, 1.5]) separadores.setMatrixAt(is++, new THREE.Matrix4().setPosition(x * (ANCHO + 2 * CANAL + 0.5), 0.03, (Z_FALTA + Z_FIN) / 2));
  raiz.add(canales, separadores);
  // Zona de lanzamiento (moqueta) y línea de falta
  const zona = new THREE.Mesh(escalarUV(R(new THREE.PlaneGeometry(6, 3).rotateX(-Math.PI / 2)), 3, 1.5), R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tela(0x3b2d63, { semilla: 4 })) })));
  zona.position.set(0, -0.001, Z_FALTA + 1.5);
  raiz.add(zona);
  const falta = new THREE.Mesh(R(new THREE.PlaneGeometry(ANCHO, 0.03).rotateX(-Math.PI / 2)), R(new THREE.MeshBasicMaterial({ color: 0xe53935 })));
  falta.position.set(0, 0.002, Z_FALTA);
  raiz.add(falta);
  // Flechas de puntería pintadas en la pista
  const geoFlecha = R(new THREE.CircleGeometry(0.035, 3).rotateX(-Math.PI / 2).rotateY(Math.PI / 2));
  const flechas = new THREE.InstancedMesh(geoFlecha, R(new THREE.MeshBasicMaterial({ color: 0x5d2a12 })), 7);
  for (let i = 0; i < 7; i++) {
    const x = (i - 3) * (ANCHO / 8);
    flechas.setMatrixAt(i, new THREE.Matrix4().setPosition(x, 0.002, Z_FALTA - 4.6 + Math.abs(i - 3) * 0.3));
  }
  raiz.add(flechas);
  // Fondo: foso oscuro y la "cortina" con luces encima de los bolos
  const foso = new THREE.Mesh(R(new THREE.BoxGeometry(8, 2.5, 0.2)), R(new THREE.MeshLambertMaterial({ color: 0x0d0b14 })));
  foso.position.set(0, 1.25, Z_FIN - 0.6);
  const cortina = new THREE.Mesh(R(new THREE.BoxGeometry(8, 0.6, 0.4)), R(new THREE.MeshBasicMaterial({ color: 0x7c5cff })));
  cortina.position.set(0, 1.6, Z_BOLO1 + 0.6);
  raiz.add(foso, cortina);
  // Soporte de bolas (VR)
  const soporte = new THREE.Mesh(R(new THREE.CylinderGeometry(0.16, 0.2, 0.75, 16)), R(new THREE.MeshLambertMaterial({ color: 0x546e7a })));
  soporte.position.set(SOPORTE.x, (SOPORTE.y - R_BOLA) / 2, SOPORTE.z);
  raiz.add(soporte);

  // ─── Bolos ─────────────────────────────────────────────────────────────
  // Perfil del bolo (radio, altura) girado alrededor del eje: base en y = 0
  const perfil = [[0, 0], [0.026, 0], [0.04, 0.03], [0.06, 0.12], [0.055, 0.2], [0.032, 0.26], [0.022, 0.29], [0.032, 0.33], [0.03, 0.37], [0, ALTO_BOLO]]
    .map(([r, y]) => new THREE.Vector2(r, y));
  const geoBolo = R(new THREE.LatheGeometry(perfil, 18));
  // Dos franjas rojas en el cuello (la v de la textura va de la base a la punta)
  const texBolo = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#fafafa';
    g.fillRect(0, 0, tam, tam);
    g.fillStyle = '#d32f2f';
    for (const v of [0.6, 0.67]) g.fillRect(0, (1 - v - 0.03) * tam, tam, 0.03 * tam);
  }, { tam: 64 }));
  const matBolo = R(new THREE.MeshStandardMaterial({ map: texBolo, roughness: 0.35, metalness: 0 }));
  const bolos = [];
  for (let fila = 0; fila < 4; fila++) {
    for (let k = 0; k <= fila; k++) {
      const casa = new THREE.Vector2((k - fila / 2) * SEPARACION, Z_BOLO1 - fila * SEPARACION * 0.866);
      const malla = new THREE.Mesh(geoBolo, matBolo);
      raiz.add(malla);
      const sombra = ctx.crearSombra({ radio: 0.08, opacidad: 0.5 });
      raiz.add(sombra);
      bolos.push({ malla, sombra, casa, pos: new THREE.Vector2(), vel: new THREE.Vector2(), caido: false, inclinacion: 0, eje: new THREE.Vector3(), fuera: false, enPie: true });
    }
  }
  const quat = new THREE.Quaternion();

  function colocarBolos(todos) {
    for (const b of bolos) {
      if (todos) b.enPie = true;
      b.caido = false;
      b.fuera = !b.enPie;
      b.inclinacion = 0;
      b.vel.set(0, 0);
      b.pos.copy(b.casa);
      b.malla.visible = b.enPie;
      b.sombra.visible = b.enPie;
      b.malla.quaternion.identity();
      b.malla.position.set(b.pos.x, 0, b.pos.y);
      ctx.colocarSombra(b.sombra, b.malla.position, 0);
    }
  }

  // ─── Bola ──────────────────────────────────────────────────────────────
  const bola = new THREE.Mesh(R(new THREE.SphereGeometry(R_BOLA, 28, 20)), R(new THREE.MeshStandardMaterial({ color: 0x1e5bd8, roughness: 0.18, metalness: 0.1 })));
  const geoAgujero = R(new THREE.CircleGeometry(0.012, 10));
  const matAgujero = R(new THREE.MeshBasicMaterial({ color: 0x050505 }));
  for (const [x, y] of [[-0.022, 0.03], [0.022, 0.03], [0, -0.02]]) {
    const a = new THREE.Mesh(geoAgujero, matAgujero);
    a.position.set(x, y, R_BOLA * 0.995);
    bola.add(a);
  }
  raiz.add(bola);
  const sombraBola = ctx.crearSombra({ radio: 0.13, opacidad: 0.55 });
  raiz.add(sombraBola);
  const vel = new THREE.Vector3();
  // 'soporte' | 'mano' | 'aire' | 'pista' | 'canal' | 'fuera'
  let estadoBola = 'soporte';

  // Línea de puntería (ratón)
  const geoMira = R(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(), new THREE.Vector3()]));
  const mira = new THREE.Line(geoMira, R(new THREE.LineBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.6 })));
  mira.frustumCulled = false;
  raiz.add(mira);
  const planoPista = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);

  // Manos (VR)
  const geoMano = R(new THREE.SphereGeometry(0.045, 12, 8));
  geoMano.scale(1, 0.6, 1.3);
  const matMano = R(new THREE.MeshLambertMaterial({ color: 0xffcc80 }));
  const manos = ctx.manos.map((mano) => {
    ctx.adjuntarAMano(mano, new THREE.Mesh(geoMano, matMano));
    return { mano, historial: [], apretonAntes: false };
  });
  let manoConBola = null;

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 3.2, alto: 0.8 });
  marcador.mesh.position.set(0, 2.5, -7);
  raiz.add(marcador.mesh);

  // ─── Partida ───────────────────────────────────────────────────────────
  let marcos = [];          // tiradas de cada marco: [[7, 3], [10], ...]
  let marco = 0;
  let estado = 'intro';     // 'intro' | 'listo' | 'rodando' | 'recuento' | 'fin'
  let reloj = 3;
  let tiempoTirada = 0;
  let quietos = 0;
  let enPieAntes = 10;
  let mensaje = '';
  let record = ctx.leer('record', 0);

  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const n2 = new THREE.Vector2();

  // Puntuación oficial a partir de todas las tiradas
  function puntuacion() {
    const t = marcos.flat();
    let total = 0;
    let i = 0;
    for (let f = 0; f < 10 && i < t.length; f++) {
      if (t[i] === 10) {
        total += 10 + (t[i + 1] ?? 0) + (t[i + 2] ?? 0);
        i += 1;
      } else if (t[i] + (t[i + 1] ?? 0) === 10) {
        total += 10 + (t[i + 2] ?? 0);
        i += 2;
      } else {
        total += t[i] + (t[i + 1] ?? 0);
        i += 2;
      }
    }
    return total;
  }

  // Símbolos de cada marco: X pleno, / semipleno, - cero
  function simbolos() {
    const num = (n) => (n === 10 ? 'X' : n === 0 ? '-' : String(n));
    return Array.from({ length: 10 }, (_, f) => {
      const m = marcos[f] || [];
      if (m.length === 0) return '·';
      // Cada tirada es semipleno si completa los 10 con la anterior de su "tanda" de bolos
      let s = '';
      let tanda = null; // bolos de la primera tirada con los bolos recién puestos (null = recién puestos)
      for (let k = 0; k < m.length; k++) {
        if (tanda !== null && tanda + m[k] === 10) {
          s += '/';
          tanda = null;
        } else {
          s += num(m[k]);
          tanda = m[k] === 10 || tanda !== null ? null : m[k];
        }
      }
      return s;
    }).join(' ');
  }

  function actualizarMarcador() {
    const lineas = [];
    if (estado === 'intro') {
      lineas.push({ texto: 'BOLOS', tam: 1.3, color: '#b39dff' });
      lineas.push({
        texto: ctx.enVR() ? 'Coge la bola del soporte de tu derecha y lánzala rodando'
          : ctx.tactil ? 'Toca la pista donde quieres apuntar' : 'Haz clic en la pista donde quieres apuntar',
        tam: 0.7,
      });
    } else {
      lineas.push({ texto: estado === 'fin' ? `¡Partida terminada! ${puntuacion()} puntos` : `Marco ${marco + 1}  ·  ${puntuacion()} puntos`, tam: 1.2 });
      lineas.push({ texto: mensaje || ' ', tam: 0.75, color: '#fff59d' });
    }
    lineas.push({ texto: simbolos(), tam: 0.7, color: '#d1c4ff' });
    lineas.push({ texto: `Récord: ${record}`, tam: 0.55, color: '#b39dff' });
    marcador.escribir(lineas);
  }

  function prepararTirada() {
    estado = 'listo';
    estadoBola = 'soporte';
    manoConBola = null;
    vel.set(0, 0, 0);
    bola.position.copy(SOPORTE);
    bola.visible = true;
    enPieAntes = bolos.filter((b) => b.enPie).length;
  }

  function lanzar(velocidad) {
    vel.copy(velocidad);
    estadoBola = 'aire';
    estado = 'rodando';
    tiempoTirada = 0;
    quietos = 0;
    mensaje = '';
  }

  // Al terminar la tirada: contar, anotar y decidir qué pasa con los bolos
  function recontar() {
    for (const b of bolos) if (b.caido || b.fuera) b.enPie = false;
    const enPie = bolos.filter((b) => b.enPie).length;
    const derribados = enPieAntes - enPie;
    if (!marcos[marco]) marcos[marco] = [];
    const m = marcos[marco];
    m.push(derribados);

    let reponer = false;
    let siguienteMarco = false;
    if (marco < 9) {
      if (m.length === 1 && derribados === 10) { mensaje = '¡PLENO!'; siguienteMarco = true; }
      else if (m.length === 2) { mensaje = m[0] + m[1] === 10 ? '¡Semipleno!' : `${derribados} bolos`; siguienteMarco = true; }
      else mensaje = `${derribados} bolo${derribados === 1 ? '' : 's'}`;
      reponer = siguienteMarco;
    } else {
      // Décimo marco: con pleno o semipleno hay tiros extra
      if (enPie === 0) {
        mensaje = derribados === 10 ? '¡PLENO!' : '¡Semipleno!';
        reponer = true;
      } else {
        mensaje = `${derribados} bolo${derribados === 1 ? '' : 's'}`;
      }
      const terminado = m.length === 3 || (m.length === 2 && m[0] + m[1] < 10);
      if (terminado) siguienteMarco = true;
    }
    if (mensaje.startsWith('¡PLENO')) {
      ctx.sonido('ovacion');
      ctx.destello(0x7c5cff, 0.35);
      for (const mano of ctx.manos) ctx.vibrar(mano, 0.8, 200);
    } else if (mensaje.startsWith('¡Semi')) {
      ctx.sonido('punto');
    }

    if (siguienteMarco) {
      marco += 1;
      reponer = true;
    }
    estado = 'recuento';
    reloj = 2;
    return { reponer, fin: marco >= 10 };
  }

  let trasRecuento = null;

  // ─── Física ────────────────────────────────────────────────────────────
  function choque(posA, velA, masaA, posB, velB, masaB, distancia, rebote) {
    n2.subVectors(posB, posA);
    const d = n2.length();
    if (d >= distancia || d < 1e-6) return 0;
    n2.divideScalar(d);
    const solape = distancia - d;
    posA.addScaledVector(n2, -solape * masaB / (masaA + masaB));
    posB.addScaledVector(n2, solape * masaA / (masaA + masaB));
    const relativa = (velB.x - velA.x) * n2.x + (velB.y - velA.y) * n2.y;
    if (relativa >= 0) return 0;
    const impulso = -(1 + rebote) * relativa / (1 / masaA + 1 / masaB);
    velA.addScaledVector(n2, -impulso / masaA);
    velB.addScaledVector(n2, impulso / masaB);
    return -relativa;
  }

  const posBola2 = new THREE.Vector2();
  const velBola2 = new THREE.Vector2();

  function simular(dt) {
    const pasos = 4;
    const h = dt / pasos;
    for (let paso = 0; paso < pasos; paso++) {
      // Bola
      const p = bola.position;
      if (estadoBola === 'aire') {
        vel.y -= G * h;
        p.addScaledVector(vel, h);
        if (p.y <= R_BOLA) {
          p.y = R_BOLA;
          if (vel.y < -1.2) ctx.sonido('bote');
          vel.y = 0;
          estadoBola = Math.abs(p.x) > ANCHO / 2 ? 'canal' : 'pista';
        }
      } else if (estadoBola === 'pista' || estadoBola === 'canal') {
        const frenado = 0.08 * h;
        const s = Math.hypot(vel.x, vel.z);
        if (s > frenado) { vel.x *= (s - frenado) / s; vel.z *= (s - frenado) / s; } else { vel.x = 0; vel.z = 0; }
        p.x += vel.x * h;
        p.z += vel.z * h;
        if (estadoBola === 'pista' && Math.abs(p.x) > ANCHO / 2 + R_BOLA * 0.3) {
          estadoBola = 'canal';
          ctx.sonido('grava');
        }
        if (estadoBola === 'canal') {
          // En el canal la bola sigue recta y no toca los bolos
          p.x = Math.sign(p.x) * (ANCHO / 2 + CANAL / 2);
          p.y = R_BOLA - 0.06;
          vel.x = 0;
        }
        bola.rotation.x -= (vel.z * h) / R_BOLA;
        if (p.z < Z_FIN) {
          estadoBola = 'fuera';
          bola.visible = false;
        }
      }

      // Bola contra bolos
      if (estadoBola === 'pista') {
        posBola2.set(p.x, p.z);
        velBola2.set(vel.x, vel.z);
        for (const b of bolos) {
          if (b.fuera || !b.enPie) continue;
          const fuerza = choque(posBola2, velBola2, MASA_BOLA, b.pos, b.vel, MASA_BOLO, R_BOLA + (b.caido ? R_BOLO_CAIDO : R_BOLO), 0.5);
          if (fuerza > 0) {
            ctx.sonido('golpe');
            if (fuerza > VELOCIDAD_CAIDA) b.caido = true;
          }
        }
        p.x = posBola2.x;
        p.z = posBola2.y;
        vel.x = velBola2.x;
        vel.z = velBola2.y;
      }

      // Bolos entre sí
      for (let i = 0; i < bolos.length; i++) {
        const a = bolos[i];
        if (a.fuera || !a.enPie) continue;
        for (let j = i + 1; j < bolos.length; j++) {
          const b = bolos[j];
          if (b.fuera || !b.enPie) continue;
          if (!a.caido && !b.caido && a.vel.lengthSq() + b.vel.lengthSq() < 1e-6) continue;
          const distancia = (a.caido ? R_BOLO_CAIDO : R_BOLO) + (b.caido ? R_BOLO_CAIDO : R_BOLO);
          const fuerza = choque(a.pos, a.vel, MASA_BOLO, b.pos, b.vel, MASA_BOLO, distancia, 0.4);
          if (fuerza > 0) {
            if (fuerza > 0.5) ctx.sonido('toc');
            if (fuerza > VELOCIDAD_CAIDA * 0.8) { a.caido = true; b.caido = true; }
          }
        }
      }

      // Movimiento de los bolos
      for (const b of bolos) {
        if (b.fuera || !b.enPie) continue;
        if (!b.caido) {
          // Un empujón flojo no lo tira: se queda donde está
          b.vel.set(0, 0);
          continue;
        }
        const s = b.vel.length();
        const frenado = 2.5 * h;
        if (s > frenado) b.vel.multiplyScalar((s - frenado) / s);
        else b.vel.set(0, 0);
        b.pos.addScaledVector(b.vel, h);
        if (s > 0.05) b.eje.set(b.vel.y, 0, -b.vel.x).normalize(); // gira hacia donde se mueve
        if (b.eje.lengthSq() === 0) b.eje.set(1, 0, 0);
        b.inclinacion = Math.min(Math.PI / 2, b.inclinacion + h * 9);
        if (b.pos.y < Z_FIN || Math.abs(b.pos.x) > ANCHO / 2 + CANAL) {
          b.fuera = true;
        }
      }
    }

    for (const b of bolos) {
      if (!b.enPie) continue;
      const hundido = b.fuera && b.pos.y < Z_FIN ? -0.3 : Math.abs(b.pos.x) > ANCHO / 2 ? -0.05 : 0;
      b.malla.position.set(b.pos.x, hundido, b.pos.y);
      b.malla.quaternion.copy(quat.setFromAxisAngle(b.eje.lengthSq() ? b.eje : tmp.set(1, 0, 0), b.inclinacion));
      ctx.colocarSombra(b.sombra, b.malla.position, 0);
      b.sombra.visible = b.malla.position.y >= 0;
    }
  }

  function todoQuieto() {
    return bolos.every((b) => !b.enPie || b.vel.lengthSq() < 1e-4);
  }

  // ─── VR ────────────────────────────────────────────────────────────────
  function velocidadMano(m) {
    const h = m.historial;
    let tiempo = 0;
    let i = h.length - 1;
    while (i > 0 && tiempo < 0.08) {
      tiempo += h[i].dt;
      i--;
    }
    if (tiempo <= 0) return new THREE.Vector3();
    return h[h.length - 1].pos.clone().sub(h[i].pos).divideScalar(tiempo);
  }

  function manosVR(dt) {
    for (const m of manos) {
      const mano = m.mano;
      if (!mano.activa) {
        m.historial.length = 0;
        if (manoConBola === m) {
          manoConBola = null;
          estadoBola = 'soporte';
          bola.position.copy(SOPORTE);
        }
        continue;
      }
      m.historial.push({ pos: mano.posicion.clone(), dt });
      if (m.historial.length > 12) m.historial.shift();
      const apretonPulsado = mano.apreton && !m.apretonAntes;
      m.apretonAntes = mano.apreton;

      if (estado === 'listo' && estadoBola === 'soporte' && (mano.gatilloPulsado || apretonPulsado) &&
          mano.posicion.distanceTo(bola.position) < ALCANCE_AGARRE) {
        manoConBola = m;
        estadoBola = 'mano';
        ctx.vibrar(mano, 0.4, 40);
      }
      if (manoConBola === m) {
        mano.grip.localToWorld(bola.position.set(0, -0.05, -0.06));
        if (!mano.gatillo && !mano.apreton) {
          manoConBola = null;
          const v = velocidadMano(m).multiplyScalar(FUERZA_VR);
          // Un poco de ayuda: la dirección no se abre más de 10° respecto a la pista
          const angulo = THREE.MathUtils.clamp(Math.atan2(v.x, -v.z), -0.17, 0.17);
          const horizontal = Math.max(1.5, Math.hypot(v.x, v.z));
          lanzar(tmp.set(Math.sin(angulo) * horizontal, Math.min(v.y, 1), -Math.cos(angulo) * horizontal));
        }
      }
    }
  }

  // ─── Ratón / dedo ──────────────────────────────────────────────────────
  const ORIGEN_RATON = new THREE.Vector3(0, R_BOLA, Z_FALTA - 0.2);
  function raton() {
    const r = ctx.raton;
    let apunta = false;
    if (estado === 'listo' && r.rayo.ray.intersectPlane(planoPista, tmp) && tmp.z < Z_FALTA - 1) {
      apunta = true;
      tmp.x = THREE.MathUtils.clamp(tmp.x, -ANCHO / 2, ANCHO / 2);
      const pos = geoMira.attributes.position;
      pos.setXYZ(0, ORIGEN_RATON.x, 0.01, ORIGEN_RATON.z);
      pos.setXYZ(1, tmp.x, 0.01, tmp.z);
      pos.needsUpdate = true;
      if (r.clic) {
        bola.position.copy(ORIGEN_RATON);
        const dir = tmp2.subVectors(tmp, ORIGEN_RATON).setY(0).normalize();
        dir.applyAxisAngle(THREE.Object3D.DEFAULT_UP, (Math.random() - 0.5) * 0.02); // un pelín de error
        lanzar(dir.multiplyScalar(VELOCIDAD_RATON));
        estadoBola = 'pista';
      }
    }
    mira.visible = apunta && (r.dentro || ctx.tactil);
    if (estado === 'listo' && estadoBola === 'soporte') bola.position.copy(ORIGEN_RATON);
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function empezarPartida() {
    marcos = [];
    marco = 0;
    mensaje = '';
    colocarBolos(true);
    prepararTirada();
  }

  function actualizar(dt) {
    reloj -= dt;
    const vr = ctx.enVR();
    soporte.visible = vr;

    switch (estado) {
      case 'intro':
        if (reloj <= 0) empezarPartida();
        break;
      case 'rodando':
        tiempoTirada += dt;
        simular(dt);
        quietos = (estadoBola === 'fuera' || (estadoBola !== 'aire' && Math.hypot(vel.x, vel.z) < 0.05)) && todoQuieto() ? quietos + dt : 0;
        if (quietos > 1.2 || tiempoTirada > 12) trasRecuento = recontar();
        break;
      case 'recuento':
        if (reloj <= 0) {
          if (trasRecuento.fin) {
            estado = 'fin';
            reloj = 8;
            const total = puntuacion();
            if (total > record) {
              record = total;
              ctx.guardar('record', record);
              mensaje = '¡Nuevo récord!';
            } else {
              mensaje = 'Nueva partida en unos segundos';
            }
            ctx.sonido('fin');
          } else {
            colocarBolos(trasRecuento.reponer);
            prepararTirada();
          }
        }
        break;
      case 'fin':
        if (reloj <= 0) empezarPartida();
        break;
    }

    if (vr) {
      mira.visible = false;
      if (estado === 'listo' && estadoBola === 'soporte') bola.position.copy(SOPORTE);
      manosVR(dt);
    } else {
      if (manoConBola) {
        manoConBola = null;
        estadoBola = 'soporte';
      }
      raton();
    }

    ctx.colocarSombra(sombraBola, bola.position, 0);
    sombraBola.visible = bola.visible && estadoBola !== 'mano' && estadoBola !== 'canal';
    actualizarMarcador();
  }

  colocarBolos(true);
  bola.position.copy(SOPORTE);
  actualizarMarcador();

  return {
    actualizar,
    liberar() {},
  };
}
