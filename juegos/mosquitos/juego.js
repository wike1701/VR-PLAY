// MATAMOSQUITOS
// Noche de verano en el porche. Los mosquitos revolotean un rato y, de repente, van a por ti:
// aplástalos con el matamoscas antes de que te piquen. Cada picadura quita una vida y la partida
// dura hasta perder las tres. Cuanto más aguantas, más mosquitos hay, más rápido vuelan y antes atacan.
// En VR: un matamoscas en cada mano (hay que darles con un golpe rápido). Con ratón o en el móvil:
// clic o toque sobre el mosquito.
//
// Seguridad: los mosquitos pican al llegar a un punto un palmo por delante de la cara, así que nunca
// hace falta darse un golpe en la cabeza o el cuerpo para aplastarlos.
import * as THREE from 'three';

// Todo se genera con código: no hay nada que descargar.
export async function precargar() {}

const VIDAS = 3;
const MAX_MOSQUITOS = 16;          // los que puede haber a la vez como mucho (se reutilizan)
const DIFICULTAD_MAX = 180;        // segundos hasta llegar a la dificultad máxima
const NIVEL_SEGUNDOS = 30;         // cada 30 s, aviso de que vienen más
const VELOCIDAD_GOLPE_VR = 0.9;    // m/s mínimos de la paleta para aplastar
const RADIO_PALETA = 0.09;         // alcance alrededor del centro de la paleta
const LARGO_MANGO = 0.36;          // el mango va del puño a -0,345 m; la paleta, de -0,34 a -0,48 m
const CENTRO_PALETA = -0.41;
const DELANTE_CARA = 0.3;          // pican al llegar a este punto por delante de la cara
const DISTANCIA_PICADURA = 0.07;
const ESCALA = 1.6;                // mosquitos de unos 8 cm: grandes para que se vean de noche y en VR
const Y_SUELO = 0;

// Zona del porche por la que revolotean (delante del jugador, que está en el origen)
const ZONA = { x: [-1.3, 1.3], y: [0.9, 2.1], z: [-2.6, -1.0] };
const azar = (a, b) => a + Math.random() * (b - a);

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

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  ctx.fondo(0x101a3a);
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.6, 0.3), new THREE.Vector3(0, 1.45, -2));

  // ─── Decorado: porche de madera en una noche de verano ─────────────────
  ctx.sueloBase(false);
  const suelo = new THREE.Mesh(
    R(new THREE.PlaneGeometry(10, 10).rotateX(-Math.PI / 2)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tablas(0x8a6440, { tablas: 10, tam: 512, repetir: [8, 8], semilla: 81 })) })),
  );
  suelo.position.z = -1.5;
  raiz.add(suelo);

  // Fachada de la casa: madera pintada, con la ventana y la puerta iluminadas (una sola malla)
  const texFachada = R(ctx.texturaCanvas((g, tam, azarTex) => {
    g.fillStyle = '#4f6a78';
    g.fillRect(0, 0, tam, tam);
    // Listones horizontales
    for (let y = 0; y < tam; y += tam / 16) {
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(0, y, tam, 2);
      g.fillStyle = 'rgba(255,255,255,0.06)';
      g.fillRect(0, y + 2, tam, 2);
    }
    for (let i = 0; i < 400; i++) {
      g.fillStyle = `rgba(20,30,40,${azarTex() * 0.12})`;
      g.fillRect(azarTex() * tam, azarTex() * tam, 4 + azarTex() * 20, 1);
    }
    // Ventana con luz cálida y cortina
    const ventana = (x, y, w, h) => {
      g.fillStyle = '#2a1d14';
      g.fillRect(x - 6, y - 6, w + 12, h + 12);
      const luz = g.createLinearGradient(0, y, 0, y + h);
      luz.addColorStop(0, '#ffe2a0');
      luz.addColorStop(1, '#ffb862');
      g.fillStyle = luz;
      g.fillRect(x, y, w, h);
      g.fillStyle = 'rgba(190,80,60,0.55)';
      g.fillRect(x, y, w * 0.28, h);
      g.fillRect(x + w * 0.72, y, w * 0.28, h);
      g.fillStyle = '#2a1d14';
      g.fillRect(x + w / 2 - 3, y, 6, h);
      g.fillRect(x, y + h / 2 - 3, w, 6);
    };
    ventana(tam * 0.12, tam * 0.3, tam * 0.3, tam * 0.3);
    // Puerta con mosquitera
    g.fillStyle = '#2a1d14';
    g.fillRect(tam * 0.6 - 6, tam * 0.28 - 6, tam * 0.24 + 12, tam * 0.72 + 6);
    g.fillStyle = '#ffc878';
    g.fillRect(tam * 0.6, tam * 0.28, tam * 0.24, tam * 0.72);
    g.strokeStyle = 'rgba(40,30,20,0.35)';
    g.lineWidth = 1;
    for (let x = tam * 0.6; x < tam * 0.84; x += 4) { g.beginPath(); g.moveTo(x, tam * 0.28); g.lineTo(x, tam); g.stroke(); }
    for (let y = tam * 0.28; y < tam; y += 4) { g.beginPath(); g.moveTo(tam * 0.6, y); g.lineTo(tam * 0.84, y); g.stroke(); }
  }, { tam: 512, semilla: 82 }));
  // Lo iluminado brilla por sí solo
  const texBrillo = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#000';
    g.fillRect(0, 0, tam, tam);
    g.fillStyle = '#ffd08a';
    g.fillRect(tam * 0.12, tam * 0.3, tam * 0.3, tam * 0.3);
    g.fillRect(tam * 0.6, tam * 0.28, tam * 0.24, tam * 0.72);
  }, { tam: 256, semilla: 83 }));
  const fachada = new THREE.Mesh(
    R(new THREE.PlaneGeometry(6.4, 3.2)),
    R(new THREE.MeshLambertMaterial({ map: texFachada, emissive: 0xffffff, emissiveMap: texBrillo, emissiveIntensity: 0.9 })),
  );
  fachada.position.set(0, 1.6, -3.3);
  raiz.add(fachada);

  // Barandilla a los lados y pilares del porche (una sola malla)
  const piezas = [];
  for (const x of [-2.4, 2.4]) {
    piezas.push(new THREE.BoxGeometry(0.06, 0.06, 4.6).translate(x, 0.95, -1.0));
    piezas.push(new THREE.BoxGeometry(0.06, 0.06, 4.6).translate(x, 0.12, -1.0));
    for (let z = -3.2; z <= 1.2; z += 0.25) piezas.push(new THREE.BoxGeometry(0.03, 0.83, 0.03).translate(x, 0.535, z));
    piezas.push(new THREE.BoxGeometry(0.16, 3.2, 0.16).translate(x, 1.6, -3.15));
  }
  piezas.push(new THREE.BoxGeometry(5.0, 0.18, 0.18).translate(0, 3.1, -3.1));
  const barandilla = new THREE.Mesh(R(fusionar(piezas)), R(new THREE.MeshLambertMaterial({ color: 0xe8e0d0 })));
  raiz.add(barandilla);

  // Bombilla del porche (atrae a los mosquitos) con su halo
  const bombilla = new THREE.Mesh(R(new THREE.SphereGeometry(0.06, 14, 10)), R(new THREE.MeshBasicMaterial({ color: 0xfff2c4 })));
  bombilla.position.set(1.15, 2.55, -3.1);
  raiz.add(bombilla);
  const texHalo = R(ctx.texturaCanvas((g, tam) => {
    const grad = g.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
    grad.addColorStop(0, 'rgba(255,230,160,0.9)');
    grad.addColorStop(0.25, 'rgba(255,200,110,0.35)');
    grad.addColorStop(1, 'rgba(255,180,80,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, tam, tam);
  }, { tam: 128, semilla: 84 }));
  const halo = new THREE.Mesh(
    R(new THREE.PlaneGeometry(1.1, 1.1)),
    R(new THREE.MeshBasicMaterial({ map: texHalo, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending })),
  );
  halo.position.copy(bombilla.position).add(new THREE.Vector3(0, 0, 0.05));
  raiz.add(halo);

  // Macetas con plantas a los lados (dos mallas)
  const macetas = [];
  const hojas = [];
  for (const [x, z, alto] of [[-2.0, -2.6, 0.45], [2.0, -2.4, 0.38], [-2.05, -0.2, 0.32]]) {
    macetas.push(new THREE.CylinderGeometry(0.17, 0.12, alto, 12).translate(x, alto / 2, z));
    for (let i = 0; i < 6; i++) {
      const a = (i / 6) * Math.PI * 2;
      hojas.push(new THREE.SphereGeometry(0.14 + (i % 2) * 0.04, 8, 6).scale(1, 1.4, 1)
        .translate(x + Math.cos(a) * 0.12, alto + 0.18 + (i % 3) * 0.07, z + Math.sin(a) * 0.12));
    }
  }
  raiz.add(new THREE.Mesh(R(fusionar(macetas)), R(new THREE.MeshLambertMaterial({ color: 0xb8643c }))));
  raiz.add(new THREE.Mesh(R(fusionar(hojas)), R(new THREE.MeshLambertMaterial({ color: 0x2f6b34 }))));

  // Estrellas
  const posEstrellas = new Float32Array(240 * 3);
  for (let i = 0; i < 240; i++) {
    const a = Math.random() * Math.PI * 2;
    const alt = 0.15 + Math.random() * 1.2;
    posEstrellas.set([Math.cos(a) * Math.cos(alt) * 40, Math.sin(alt) * 40, Math.sin(a) * Math.cos(alt) * 40], i * 3);
  }
  const geoEstrellas = R(new THREE.BufferGeometry());
  geoEstrellas.setAttribute('position', new THREE.BufferAttribute(posEstrellas, 3));
  raiz.add(new THREE.Points(geoEstrellas, R(new THREE.PointsMaterial({ color: 0xdfe6ff, size: 0.12, sizeAttenuation: true }))));

  // ─── Mosquitos ─────────────────────────────────────────────────────────
  // Cuerpo (tórax, cabeza, trompa, abdomen y seis patas) en una malla mirando hacia +Z, y las alas
  // en otra. Rayado como el mosquito tigre: la textura da los anillos del abdomen y de las patas.
  const texRayas = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#1b1b20';
    g.fillRect(0, 0, tam, tam);
    g.fillStyle = '#f0f0f4';
    for (let i = 0; i < 9; i++) g.fillRect(0, (i / 9) * tam, tam, tam / 22);
  }, { tam: 64, semilla: 85 }));
  const partesCuerpo = [
    new THREE.SphereGeometry(0.007, 10, 8).scale(1, 0.9, 1.2),                                     // tórax
    new THREE.SphereGeometry(0.0045, 8, 6).translate(0, 0.001, 0.0115),                            // cabeza
    new THREE.CylinderGeometry(0.0006, 0.0009, 0.013, 4).rotateX(Math.PI / 2 + 0.25).translate(0, -0.0015, 0.021), // trompa
    new THREE.SphereGeometry(0.0048, 10, 8).rotateX(Math.PI / 2).scale(1, 1, 2.7).rotateX(-0.18).translate(0, 0.002, -0.018), // abdomen
  ];
  // Patas largas: tres a cada lado, de dos tramos
  for (const lado of [-1, 1]) {
    for (const [z, abre] of [[0.004, 0.5], [0, 0], [-0.004, -0.6]]) {
      const muslo = new THREE.CylinderGeometry(0.0005, 0.0006, 0.018, 3).translate(0, -0.009, 0);
      muslo.rotateZ(lado * 1.05).rotateY(abre * lado).translate(0, -0.003, z);
      const pierna = new THREE.CylinderGeometry(0.0003, 0.0005, 0.024, 3).translate(0, -0.012, 0);
      pierna.rotateZ(lado * 0.25).rotateY(abre * lado).translate(lado * 0.0155, -0.012, z + abre * 0.006);
      partesCuerpo.push(muslo, pierna);
    }
  }
  const geoCuerpo = R(fusionar(partesCuerpo).scale(ESCALA, ESCALA, ESCALA));
  // Un poco de brillo propio para que no se pierdan en la oscuridad del porche
  const matCuerpo = R(new THREE.MeshLambertMaterial({ map: texRayas, emissive: 0x30303c }));
  const geoAlas = R(fusionar([
    new THREE.CircleGeometry(1, 12).scale(0.004, 0.014, 1).rotateX(-Math.PI / 2).rotateY(0.45).translate(0.006, 0.006, -0.01),
    new THREE.CircleGeometry(1, 12).scale(0.004, 0.014, 1).rotateX(-Math.PI / 2).rotateY(-0.45).translate(-0.006, 0.006, -0.01),
  ]).scale(ESCALA, ESCALA, ESCALA));
  const opcionesAlas = { transparent: true, opacity: 0.6, side: THREE.DoubleSide, depthWrite: false };
  const matAlas = R(new THREE.MeshBasicMaterial({ color: 0xe8f0ff, ...opcionesAlas }));
  const matAlasAtaque = R(new THREE.MeshBasicMaterial({ color: 0xff5a5a, ...opcionesAlas, opacity: 0.7 })); // van a por ti

  const mosquitos = [];
  for (let i = 0; i < MAX_MOSQUITOS; i++) {
    const grupo = new THREE.Group();
    const alas = new THREE.Mesh(geoAlas, matAlas);
    grupo.add(new THREE.Mesh(geoCuerpo, matCuerpo), alas);
    grupo.visible = false;
    raiz.add(grupo);
    const sombra = ctx.crearSombra({ radio: 0.03, opacidad: 0.35 });
    sombra.visible = false;
    raiz.add(sombra);
    mosquitos.push({
      grupo, alas, sombra,
      estado: 'libre', // 'libre' | 'vuelo' | 'ataque' | 'muerto' | 'huye'
      vel: new THREE.Vector3(),
      destino: new THREE.Vector3(),
      desvio: new THREE.Vector3(),
      cambio: 0, tiempo: 0, fase: 0, velocidad: 0, velocidadAtaque: 0, giro: 0,
    });
  }

  // ─── Restos al aplastar uno (se reutilizan) ────────────────────────────
  const geoMota = R(new THREE.SphereGeometry(0.005, 5, 4));
  const matMota = R(new THREE.MeshBasicMaterial({ color: 0x1b1b20 }));
  const matSangre = R(new THREE.MeshBasicMaterial({ color: 0xc62828 }));
  const motas = [];
  for (let i = 0; i < 40; i++) {
    const malla = new THREE.Mesh(geoMota, i % 3 ? matMota : matSangre);
    malla.visible = false;
    raiz.add(malla);
    motas.push({ malla, vel: new THREE.Vector3(), vida: 0 });
  }

  // ─── Matamoscas ────────────────────────────────────────────────────────
  // Mango de plástico y paleta de rejilla. En VR, uno en cada mano; con el ratón, uno que sigue al cursor.
  const texRejilla = R(ctx.texturaCanvas((g, tam) => {
    g.clearRect(0, 0, tam, tam);
    g.fillStyle = 'rgba(255,255,255,0.95)';
    const borde = tam * 0.07;
    g.fillRect(0, 0, tam, borde);
    g.fillRect(0, tam - borde, tam, borde);
    g.fillRect(0, 0, borde, tam);
    g.fillRect(tam - borde, 0, borde, tam);
    for (let i = 1; i < 12; i++) {
      g.fillRect((i / 12) * tam - 1.5, 0, 3, tam);
      g.fillRect(0, (i / 12) * tam - 1.5, tam, 3);
    }
  }, { tam: 128, semilla: 86 }));
  function crearMatamoscas(color) {
    const objeto = new THREE.Group();
    const matPlastico = new THREE.MeshStandardMaterial({ color, roughness: 0.45 });
    const mango = new THREE.Mesh(new THREE.CylinderGeometry(0.008, 0.011, LARGO_MANGO, 8).rotateX(Math.PI / 2), matPlastico);
    mango.position.z = -LARGO_MANGO / 2 + 0.015;
    const paleta = new THREE.Mesh(
      new THREE.PlaneGeometry(0.115, 0.135).rotateX(-Math.PI / 2),
      new THREE.MeshStandardMaterial({ color, map: texRejilla, alphaTest: 0.5, side: THREE.DoubleSide, roughness: 0.5 }),
    );
    paleta.position.z = CENTRO_PALETA;
    objeto.add(mango, paleta);
    return objeto;
  }
  const palas = ctx.manos.map((mano, i) => ({
    mano,
    objeto: ctx.adjuntarAMano(mano, crearMatamoscas(i === 0 ? 0x29b6f6 : 0xffca28)),
    centro: new THREE.Vector3(),
    anterior: new THREE.Vector3(),
    lista: false,
  }));

  // El del ratón: la paleta, de cara, bajo el cursor y el mango hacia abajo; da un golpe al hacer clic
  const palaRaton = crearMatamoscas(0xffca28);
  palaRaton.traverse((o) => { if (o.isMesh) { ctx.recurso(o.geometry); ctx.recurso(o.material); } });
  raiz.add(palaRaton);
  let golpeRaton = 0; // segundos que quedan de la animación del golpe

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.3, alto: 0.32 });
  marcador.mesh.position.set(-0.3, 2.45, -2.6);
  marcador.mesh.rotation.x = 0.15;
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  const zumbido = ctx.sonidoContinuo('mosquito');
  let puntos = 0;
  let vidas = VIDAS;
  let record = ctx.leer('record', 0);
  let estado = 'intro'; // 'intro' | 'jugando' | 'fin'
  let reloj = 3;
  let tiempoJugado = 0;
  let proximo = 0;
  let aviso = null;     // { texto, color, tiempo }

  const cabeza = new THREE.Vector3();
  const delante = new THREE.Vector3();
  const objetivo = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const segmento = new THREE.Line3();

  // 0 al empezar, 1 a los DIFICULTAD_MAX segundos
  const dificultad = () => Math.min(1, tiempoJugado / DIFICULTAD_MAX);
  const nivel = () => 1 + Math.floor(tiempoJugado / NIVEL_SEGUNDOS);
  const activos = () => mosquitos.filter((m) => m.estado === 'vuelo' || m.estado === 'ataque');

  function actualizarMarcador() {
    const lineas = estado === 'intro'
      ? [{ texto: ctx.t('titulo'), tam: 1.3, color: '#ffe082' }, { texto: ctx.t('intro'), tam: 0.8 }]
      : estado === 'fin'
        ? [{ texto: ctx.t('fin', { n: puntos }), tam: 1.3, color: '#ffe082' }, { texto: ctx.t('partida.recordNuevaPartida', { record, n: Math.ceil(reloj) }), tam: 0.8 }]
        : [{ texto: ctx.t('marcador', { n: puntos }), tam: 1.3 },
          aviso ? { texto: aviso.texto, tam: 0.8, color: aviso.color }
            : { texto: ctx.t('vidas', { vidas: '♥'.repeat(vidas) + '♡'.repeat(VIDAS - vidas), record }), tam: 0.8, color: '#ffcdd2' }];
    marcador.escribir(lineas);
  }
  const avisar = (texto, color, tiempo = 1.4) => { aviso = { texto, color, tiempo }; };

  function colocarCabeza() {
    ctx.camara.getWorldPosition(cabeza);
    ctx.camara.getWorldDirection(delante);
    delante.y = 0;
    if (delante.lengthSq() < 1e-6) delante.set(0, 0, -1);
    delante.normalize();
  }

  function nuevoDestino(m) {
    m.destino.set(azar(...ZONA.x), azar(...ZONA.y), azar(...ZONA.z));
    m.cambio = azar(0.7, 1.8);
  }

  // Sale un mosquito por delante, a 2,5-3,4 m, y revolotea antes de atacar
  function soltarMosquito() {
    const m = mosquitos.find((x) => x.estado === 'libre');
    if (!m) return;
    const d = dificultad();
    const angulo = azar(-1.35, 1.35);
    const distancia = azar(2.5, 3.4);
    m.grupo.position.set(Math.sin(angulo) * distancia, azar(1.0, 2.3), -Math.cos(angulo) * distancia);
    m.vel.set(0, 0, 0);
    m.estado = 'vuelo';
    m.tiempo = azar(4.5, 7.5) * (1 - d * 0.6);        // revolotea menos cuanto más difícil
    m.velocidad = azar(0.35, 0.5) * (1 + d * 1.1);
    m.velocidadAtaque = azar(0.45, 0.6) * (1 + d * 1.3);
    m.fase = Math.random() * 100;
    // Pica en la cara, el cuello o el pecho (siempre un palmo por delante)
    m.desvio.set(azar(-0.15, 0.15), azar(-0.4, 0.05), 0);
    m.alas.material = matAlas;
    m.grupo.visible = true;
    m.grupo.scale.setScalar(1);
    m.grupo.rotation.set(0, 0, 0);
    m.sombra.visible = true;
    nuevoDestino(m);
  }

  function retirar(m) {
    m.estado = 'libre';
    m.grupo.visible = false;
    m.sombra.visible = false;
  }

  // Vuelo con quiebros: se dirige al destino con giros rápidos y pequeñas sacudidas
  function volar(m, destino, velocidad, firmeza, dt) {
    tmp.subVectors(destino, m.grupo.position);
    const distancia = tmp.length();
    tmp.normalize().multiplyScalar(velocidad);
    m.vel.lerp(tmp, 1 - Math.exp(-dt * firmeza));
    m.fase += dt;
    const temblor = 0.6 * velocidad;
    m.vel.x += Math.sin(m.fase * 11.3) * temblor * dt * 6;
    m.vel.y += Math.sin(m.fase * 9.1 + 1.3) * temblor * dt * 6;
    m.vel.z += Math.cos(m.fase * 7.7) * temblor * dt * 4;
    m.grupo.position.addScaledVector(m.vel, dt);
    m.grupo.position.y = Math.max(0.15, m.grupo.position.y);
    // Mira hacia donde va
    if (m.vel.lengthSq() > 1e-4) m.grupo.lookAt(tmp2.copy(m.grupo.position).add(m.vel));
    return distancia;
  }

  function aplastar(m, mano) {
    if (m.estado !== 'vuelo' && m.estado !== 'ataque') return;
    const atacando = m.estado === 'ataque';
    m.estado = 'muerto';
    m.tiempo = 0.9;
    m.vel.set(azar(-0.3, 0.3), 0.4, azar(-0.3, 0.3));
    m.giro = azar(8, 14);
    m.alas.material = matAlas;
    if (estado === 'jugando') puntos++;
    ctx.sonido('plaf');
    if (mano) ctx.vibrar(mano, 0.8, 60);
    if (atacando && estado === 'jugando') avisar(ctx.t('porLosPelos'), '#b9f6ca', 1);
    // Restos
    let n = 0;
    for (const mota of motas) {
      if (mota.vida > 0) continue;
      mota.malla.position.copy(m.grupo.position);
      mota.malla.visible = true;
      mota.vel.set(azar(-1, 1), azar(-0.2, 1), azar(-1, 1)).normalize().multiplyScalar(azar(0.4, 1.2));
      mota.vida = azar(0.4, 0.7);
      if (++n >= 6) break;
    }
  }

  function picar(m) {
    m.estado = 'huye';
    m.tiempo = 1.2;
    m.vel.set(azar(-0.6, 0.6), 1.1, azar(0.2, 0.6));
    if (estado !== 'jugando') return;
    vidas--;
    ctx.sonido('picadura');
    ctx.destello(0xff1744, 0.45);
    for (const mano of ctx.manos) ctx.vibrar(mano, 1, 180);
    if (vidas <= 0) {
      terminar();
    } else {
      avisar(ctx.t('picadura'), '#ff8a80');
    }
  }

  function terminar() {
    estado = 'fin';
    reloj = 6;
    ctx.puntuacion(puntos); // a la clasificación (juegos/marcadores.js)
    if (puntos > record) {
      record = puntos;
      ctx.guardar('record', record);
    }
    ctx.sonido('fin');
    // Los que quedan se van volando
    for (const m of mosquitos) {
      if (m.estado === 'vuelo' || m.estado === 'ataque') {
        m.estado = 'huye';
        m.tiempo = 1.5;
        m.vel.set(azar(-0.5, 0.5), 1, -0.5);
      }
    }
  }

  function empezar() {
    estado = 'jugando';
    puntos = 0;
    vidas = VIDAS;
    tiempoJugado = 0;
    proximo = 0.8;
    aviso = null;
  }

  // ─── Golpes con los mandos ─────────────────────────────────────────────
  function golpesVR(dt) {
    for (const pala of palas) {
      if (!pala.mano.activa) {
        pala.lista = false;
        continue;
      }
      pala.mano.grip.localToWorld(pala.centro.set(0, 0, CENTRO_PALETA));
      if (pala.lista && pala.centro.distanceTo(pala.anterior) / dt > VELOCIDAD_GOLPE_VR) {
        // Todo el recorrido de la paleta en este fotograma, para no "atravesar" mosquitos en golpes rápidos
        segmento.set(pala.anterior, pala.centro);
        for (const m of mosquitos) {
          if (m.estado !== 'vuelo' && m.estado !== 'ataque') continue;
          segmento.closestPointToPoint(m.grupo.position, true, tmp);
          if (tmp.distanceTo(m.grupo.position) < RADIO_PALETA) aplastar(m, pala.mano);
        }
      }
      pala.anterior.copy(pala.centro);
      pala.lista = true;
    }
  }

  // ─── Golpes con el ratón o el dedo ─────────────────────────────────────
  // La paleta del cursor está a 0,8 m: tapa lo que está detrás, así que acierta si el mosquito
  // queda dentro de lo que tapa la paleta en la pantalla (más margen cuanto más lejos).
  function golpesRaton(dt) {
    const raton = ctx.raton;
    palaRaton.visible = raton.dentro || ctx.tactil;
    const rayo = raton.rayo.ray;
    rayo.at(0.8, palaRaton.position);
    // El mango hacia abajo y hacia ti; la paleta, hacia el cursor
    // +Z del grupo hacia la cámara; girado 90° en X, la paleta mira a la cámara y el mango baja
    palaRaton.lookAt(tmp.copy(palaRaton.position).sub(rayo.direction));
    palaRaton.rotateX(Math.PI / 2);
    palaRaton.translateZ(-CENTRO_PALETA);
    golpeRaton = Math.max(0, golpeRaton - dt);
    // Inclinada hacia atrás; al golpear, da un latigazo hacia delante
    palaRaton.rotateX(0.3 - (golpeRaton > 0 ? Math.sin((golpeRaton / 0.15) * Math.PI) * 0.6 : 0));
    if (!raton.clic) return;
    golpeRaton = 0.15;
    ctx.sonido('zas');
    for (const m of mosquitos) {
      if (m.estado !== 'vuelo' && m.estado !== 'ataque') continue;
      const profundidad = tmp.subVectors(m.grupo.position, rayo.origin).dot(rayo.direction);
      if (profundidad <= 0) continue;
      if (rayo.distanceToPoint(m.grupo.position) < 0.075 * profundidad + 0.025) aplastar(m, null);
    }
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function actualizar(dt) {
    reloj -= dt;
    colocarCabeza();
    if (estado === 'intro' && reloj <= 0) empezar();
    else if (estado === 'fin' && reloj <= 0) empezar();

    if (estado === 'jugando') {
      const nivelAntes = nivel();
      tiempoJugado += dt;
      if (nivel() > nivelAntes) {
        avisar(ctx.t('masMosquitos'), '#ffe082', 2);
        ctx.sonido('punto');
      }
      // Cada vez salen más seguidos y caben más a la vez
      const d = dificultad();
      proximo -= dt;
      if (proximo <= 0 && activos().length < Math.round(3 + d * 11)) {
        soltarMosquito();
        if (Math.random() < d * 0.4) soltarMosquito(); // a veces, de dos en dos
        proximo = (2.6 - d * 1.9) * azar(0.75, 1.25);
      }
    }
    if (aviso && (aviso.tiempo -= dt) <= 0) aviso = null;

    // Mosquitos
    let cercania = 0;
    for (const m of mosquitos) {
      if (m.estado === 'libre') continue;
      const p = m.grupo.position;
      if (m.estado === 'vuelo') {
        m.cambio -= dt;
        if (m.cambio <= 0) nuevoDestino(m);
        volar(m, m.destino, m.velocidad, 2.5, dt);
        m.tiempo -= dt;
        if (m.tiempo <= 0 && estado === 'jugando') {
          m.estado = 'ataque';
          m.alas.material = matAlasAtaque;
        }
      } else if (m.estado === 'ataque') {
        objetivo.copy(cabeza).addScaledVector(delante, DELANTE_CARA).add(m.desvio);
        const distancia = volar(m, objetivo, m.velocidadAtaque, 4, dt);
        if (distancia < DISTANCIA_PICADURA) picar(m);
      } else if (m.estado === 'muerto') {
        // Cae dando vueltas
        m.vel.y -= 6 * dt;
        p.addScaledVector(m.vel, dt);
        m.grupo.rotation.z += m.giro * dt;
        m.grupo.rotation.x += m.giro * 0.6 * dt;
        m.tiempo -= dt;
        if (m.tiempo <= 0 || p.y < Y_SUELO + 0.02) retirar(m);
      } else if (m.estado === 'huye') {
        p.addScaledVector(m.vel, dt);
        m.tiempo -= dt;
        if (m.tiempo <= 0) retirar(m);
      }
      if (m.estado === 'libre') continue;
      // Alas: aleteo muy rápido (se ve como un borrón)
      m.alas.scale.x = m.estado === 'muerto' ? 0.4 : 0.35 + Math.abs(Math.sin(performance.now() * 0.09 + m.fase * 7)) * 0.65;
      ctx.colocarSombra(m.sombra, p, Y_SUELO + 0.003);
      if (m.estado === 'vuelo' || m.estado === 'ataque') {
        cercania = Math.max(cercania, 1 - Math.min(1, p.distanceTo(cabeza) / 2.6));
      }
    }
    // El zumbido sube cuando hay uno cerca de la oreja
    zumbido.ajustar(cercania, cercania > 0 ? 0.03 + cercania * cercania * 0.22 : 0);

    // Restos
    for (const mota of motas) {
      if (mota.vida <= 0) continue;
      mota.vida -= dt;
      mota.vel.y -= 5 * dt;
      mota.malla.position.addScaledVector(mota.vel, dt);
      if (mota.vida <= 0 || mota.malla.position.y < Y_SUELO) {
        mota.vida = 0;
        mota.malla.visible = false;
      }
    }

    if (ctx.enVR()) {
      palaRaton.visible = false;
      golpesVR(dt);
    } else {
      golpesRaton(dt);
    }
    actualizarMarcador();
  }

  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      // La shell retira lo que hay en la escena y en las manos, los recursos registrados y el zumbido.
      // Los materiales de los matamoscas de las manos se liberan con ellos.
      mosquitos.length = 0;
      motas.length = 0;
    },
  };
}
