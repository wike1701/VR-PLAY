// BOLOS
// Partida de 10 marcos con la puntuación oficial (plenos, semiplenos y el
// décimo marco con tiros extra). En VR coges la bola del soporte y la lanzas
// con el brazo; con ratón o con el dedo apuntas y haces clic/tocas para tirar.
// Los bolos chocan entre sí, así que hay reacciones en cadena.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const G = 9.8;
// Pista y bolos más grandes que los reglamentarios (1,06 m y 38 cm) para verlos
// bien y que sea más fácil: todo escalado a la vez
const ANCHO = 1.5;
const CANAL = 0.16;            // ancho de cada canal
const Z_FALTA = -0.5;          // línea de falta, justo delante del jugador
const Z_BOLO1 = -10;           // bolo de cabeza (en una bolera real está a 18,3 m)
const Z_FIN = -11.7;           // final de la pista: foso
const R_BOLA = 0.12;
const MASA_BOLA = 6;
const R_BOLO = 0.085;
const R_BOLO_CAIDO = 0.14;     // un bolo tumbado ocupa más
const ALTO_BOLO = 0.53;
const MASA_BOLO = 1.5;
const SEPARACION = 0.42;
const PASO_PISTAS = ANCHO + 2 * CANAL + 0.5; // de una pista a la de al lado
const QUIETOS_RECUENTO = 0.45; // segundos con todo quieto para contar (antes 1,2)
const VELOCIDAD_CAIDA = 0.3;   // velocidad a la que un bolo empujado se cae
const FUERZA_VR = 1.2;
const ALCANCE_AGARRE = 0.26;
const SOPORTE = new THREE.Vector3(0.6, 0.85, 0.05);
const VELOCIDAD_RATON = 8;

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  ctx.fondo(0x231a3a);
  // La niebla de la shell empieza a 7 m: aquí los bolos están a 11 m y se veían
  // apagados. Se aleja mientras dure el juego.
  const niebla = ctx.escena.fog;
  const nieblaOriginal = { near: niebla.near, far: niebla.far };
  niebla.near = 22;
  niebla.far = 45;
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.45, 1.1), new THREE.Vector3(0, 0.15, Z_BOLO1));

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
  // Pista propia y cuatro vecinas (decorado) con la misma geometría: una malla instanciada
  const VECINAS = [-2, -1, 0, 1, 2];
  const pistas = new THREE.InstancedMesh(geoPista, matPista, VECINAS.length);
  VECINAS.forEach((k, i) => pistas.setMatrixAt(i, new THREE.Matrix4().setPosition(k * PASO_PISTAS, 0, (Z_FALTA + Z_FIN) / 2)));
  raiz.add(pistas);
  // Zona de los bolos más clara (iluminada desde arriba): resalta los bolos
  const plataforma = new THREE.Mesh(R(new THREE.PlaneGeometry(ANCHO, Z_BOLO1 - Z_FIN + 0.5).rotateX(-Math.PI / 2)), R(new THREE.MeshBasicMaterial({ color: 0xf6deb0 })));
  plataforma.position.set(0, 0.001, (Z_BOLO1 + 0.5 + Z_FIN) / 2);
  raiz.add(plataforma);
  // Canales y separadores, con una tira de neón encima de cada separador
  const matCanal = R(new THREE.MeshLambertMaterial({ color: 0x2b2b33 }));
  const geoCanal = R(new THREE.BoxGeometry(CANAL, 0.02, largo));
  const geoSeparador = R(new THREE.BoxGeometry(0.5, 0.06, largo));
  const canales = new THREE.InstancedMesh(geoCanal, matCanal, VECINAS.length * 2);
  const separadores = new THREE.InstancedMesh(geoSeparador, R(new THREE.MeshLambertMaterial({ color: 0x3a2f55 })), VECINAS.length + 1);
  const neones = new THREE.InstancedMesh(R(new THREE.BoxGeometry(0.04, 0.012, largo)), R(new THREE.MeshBasicMaterial({ color: 0x00e5ff, toneMapped: false })), VECINAS.length + 1);
  let ic = 0;
  let is = 0;
  for (const k of VECINAS) {
    const cx = k * PASO_PISTAS;
    for (const s of [-1, 1]) canales.setMatrixAt(ic++, new THREE.Matrix4().setPosition(cx + s * (ANCHO / 2 + CANAL / 2), -0.05, (Z_FALTA + Z_FIN) / 2));
  }
  for (let i = 0; i <= VECINAS.length; i++) {
    const x = (i - VECINAS.length / 2) * PASO_PISTAS;
    separadores.setMatrixAt(is, new THREE.Matrix4().setPosition(x, 0.03, (Z_FALTA + Z_FIN) / 2));
    neones.setMatrixAt(is++, new THREE.Matrix4().setPosition(x, 0.066, (Z_FALTA + Z_FIN) / 2));
  }
  raiz.add(canales, separadores, neones);

  // ─── Ambiente de bolera ────────────────────────────────────────────────
  const anchoSala = (VECINAS.length / 2) * PASO_PISTAS + 0.6;
  // Paredes laterales oscuras con franjas de neón (la textura brilla sola)
  const texPared = R(ctx.texturaCanvas((g, tam, azar) => {
    g.fillStyle = '#1a1230';
    g.fillRect(0, 0, tam, tam);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(255,255,255,${azar() * 0.04})`;
      g.fillRect(azar() * tam, azar() * tam, azar() * 60, 2);
    }
    const franjas = [['#ff4fd8', 0.55], ['#00e5ff', 0.62], ['#ffd54f', 0.69]];
    for (const [color, y] of franjas) {
      g.fillStyle = color;
      g.fillRect(0, y * tam, tam, tam * 0.012);
    }
  }, { tam: 256, repetir: [4, 1] }));
  const matPared = R(new THREE.MeshLambertMaterial({ map: texPared, emissive: 0xffffff, emissiveMap: texPared, emissiveIntensity: 0.55 }));
  const geoPared = R(new THREE.PlaneGeometry(Math.abs(Z_FIN) + 4, 4));
  for (const s of [-1, 1]) {
    const pared = new THREE.Mesh(geoPared, matPared);
    pared.position.set(s * anchoSala, 2, (Z_FIN - 1 + 3) / 2);
    pared.rotation.y = -s * Math.PI / 2;
    raiz.add(pared);
  }
  // Techo con filas de focos
  const techo = new THREE.Mesh(R(new THREE.PlaneGeometry(anchoSala * 2, Math.abs(Z_FIN) + 4).rotateX(Math.PI / 2)), R(new THREE.MeshLambertMaterial({ color: 0x120c22 })));
  techo.position.set(0, 4, (Z_FIN - 1 + 3) / 2);
  raiz.add(techo);
  const focos = new THREE.InstancedMesh(R(new THREE.BoxGeometry(0.5, 0.04, 0.5)), R(new THREE.MeshBasicMaterial({ color: 0xfff4d6, toneMapped: false })), VECINAS.length * 4);
  let ifo = 0;
  for (const k of VECINAS) for (let j = 0; j < 4; j++) focos.setMatrixAt(ifo++, new THREE.Matrix4().setPosition(k * PASO_PISTAS, 3.97, -1.5 - j * 3));
  raiz.add(focos);
  // Bloque de máquinas encima de los bolos, con dibujo de colores y número de pista
  const texMaquinas = R(ctx.texturaCanvas((g, tam) => {
    const ancho = tam;
    const alto = tam / 4;
    g.fillStyle = '#2a1650';
    g.fillRect(0, 0, ancho, tam);
    for (let i = 0; i < VECINAS.length; i++) {
      const x0 = (i / VECINAS.length) * ancho;
      const w = ancho / VECINAS.length;
      const grad = g.createLinearGradient(x0, 0, x0 + w, alto);
      grad.addColorStop(0, '#7c5cff');
      grad.addColorStop(0.5, '#ff4fd8');
      grad.addColorStop(1, '#00e5ff');
      g.fillStyle = grad;
      g.beginPath();
      g.moveTo(x0, alto * 0.75);
      for (let k = 0; k <= 8; k++) g.lineTo(x0 + (k / 8) * w, alto * (0.75 - 0.35 * Math.abs(Math.sin(k * 0.9 + i))));
      g.lineTo(x0 + w, alto);
      g.lineTo(x0, alto);
      g.fill();
      g.fillStyle = '#ffffff';
      g.font = `bold ${alto * 0.32}px sans-serif`;
      g.textAlign = 'center';
      g.fillText(String(i + 1), x0 + w / 2, alto * 0.42);
    }
  }, { tam: 512 }));
  texMaquinas.repeat.set(1, 0.25);
  texMaquinas.offset.set(0, 0.75);
  const maquinas = new THREE.Mesh(R(new THREE.PlaneGeometry(anchoSala * 2, 1.3)), R(new THREE.MeshBasicMaterial({ map: texMaquinas })));
  maquinas.position.set(0, 1.95, Z_BOLO1 + 0.55);
  raiz.add(maquinas);
  // Retorno de bolas a la derecha, con bolas de colores esperando (una llamada)
  const geoRetorno = R(new THREE.BoxGeometry(0.42, 0.55, 1.4));
  const retorno = new THREE.Mesh(geoRetorno, R(new THREE.MeshLambertMaterial({ color: 0x37474f })));
  retorno.position.set(SOPORTE.x + 0.55, 0.275, SOPORTE.z + 0.3);
  raiz.add(retorno);
  const COLORES_BOLAS = [0xe53935, 0x43a047, 0xffb300, 0x8e24aa, 0x00acc1];
  const bolasRetorno = new THREE.InstancedMesh(R(new THREE.SphereGeometry(R_BOLA, 16, 12)), R(new THREE.MeshStandardMaterial({ roughness: 0.2 })), COLORES_BOLAS.length);
  COLORES_BOLAS.forEach((c, i) => {
    bolasRetorno.setMatrixAt(i, new THREE.Matrix4().setPosition(retorno.position.x, 0.55 + R_BOLA, retorno.position.z - 0.55 + i * 0.26));
    bolasRetorno.setColorAt(i, new THREE.Color(c));
  });
  raiz.add(bolasRetorno);
  // Sofás detrás del jugador (una malla fusionada)
  const sofa = new THREE.Mesh(R(new THREE.BoxGeometry(3, 0.45, 0.8)), R(new THREE.MeshLambertMaterial({ color: 0xff7043 })));
  sofa.position.set(0, 0.225, 2.6);
  const respaldo = new THREE.Mesh(R(new THREE.BoxGeometry(3, 0.6, 0.2)), sofa.material);
  respaldo.position.set(0, 0.6, 2.95);
  raiz.add(sofa, respaldo);
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
  foso.scale.x = anchoSala / 4;
  raiz.add(foso);
  // Soporte de bolas (VR)
  const soporte = new THREE.Mesh(R(new THREE.CylinderGeometry(0.16, 0.2, 0.75, 16)), R(new THREE.MeshLambertMaterial({ color: 0x546e7a })));
  soporte.position.set(SOPORTE.x, (SOPORTE.y - R_BOLA) / 2, SOPORTE.z);
  raiz.add(soporte);

  // ─── Bolos ─────────────────────────────────────────────────────────────
  // Perfil del bolo (radio, altura) girado alrededor del eje: base en y = 0
  // (perfil de un bolo de 38 cm, escalado al tamaño del juego)
  const escalaBolo = ALTO_BOLO / 0.38;
  const perfil = [[0, 0], [0.026, 0], [0.04, 0.03], [0.06, 0.12], [0.055, 0.2], [0.032, 0.26], [0.022, 0.29], [0.032, 0.33], [0.03, 0.37], [0, 0.38]]
    .map(([r, y]) => new THREE.Vector2(r * escalaBolo, y * escalaBolo));
  const geoBolo = R(new THREE.LatheGeometry(perfil, 20));
  // Dos franjas rojas en el cuello (la v de la textura va de la base a la punta)
  const texBolo = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#fafafa';
    g.fillRect(0, 0, tam, tam);
    g.fillStyle = '#d32f2f';
    for (const v of [0.6, 0.67]) g.fillRect(0, (1 - v - 0.03) * tam, tam, 0.03 * tam);
  }, { tam: 64 }));
  // Un poco de brillo propio: se ven blancos de lejos aunque la sala sea oscura
  const matBolo = R(new THREE.MeshStandardMaterial({ map: texBolo, roughness: 0.35, metalness: 0, emissive: 0xffffff, emissiveMap: texBolo, emissiveIntensity: 0.25 }));
  const bolos = [];
  for (let fila = 0; fila < 4; fila++) {
    for (let k = 0; k <= fila; k++) {
      const casa = new THREE.Vector2((k - fila / 2) * SEPARACION, Z_BOLO1 - fila * SEPARACION * 0.866);
      const malla = new THREE.Mesh(geoBolo, matBolo);
      raiz.add(malla);
      const sombra = ctx.crearSombra({ radio: 0.11, opacidad: 0.5 });
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
  marcador.mesh.position.set(0, 3.1, -6); // por encima de la pantalla de la bolera en la vista
  raiz.add(marcador.mesh);

  // ─── Pantalla de la bolera (encima de los bolos) ───────────────────────
  // A la izquierda, el mapa de los 10 bolos (en pie / tumbados); a la derecha,
  // la animación de cada tirada: ¡STRIKE!, ¡SEMIPLENO!, "7 bolos"...
  const lienzo = document.createElement('canvas');
  lienzo.width = 768;
  lienzo.height = 288;
  const g2 = lienzo.getContext('2d');
  const texPantalla = R(new THREE.CanvasTexture(lienzo));
  texPantalla.colorSpace = THREE.SRGBColorSpace;
  const pantalla = new THREE.Mesh(R(new THREE.PlaneGeometry(3.2, 1.2)), R(new THREE.MeshBasicMaterial({ map: texPantalla, toneMapped: false })));
  pantalla.position.set(0, 1.95, Z_BOLO1 + 0.62); // en el centro del bloque de máquinas, sobre tu pista
  raiz.add(pantalla);
  const anim = { tipo: null, texto: '', t: 0, duracion: 0 };

  function pintarPantalla() {
    const w = lienzo.width;
    const h = lienzo.height;
    g2.fillStyle = '#0d0820';
    g2.fillRect(0, 0, w, h);
    g2.strokeStyle = '#7c5cff';
    g2.lineWidth = 6;
    g2.strokeRect(3, 3, w - 6, h - 6);
    // Mapa de bolos: fila de atrás arriba (como se ven desde el jugador)
    const cx = 150;
    const cy = 60;
    const paso = 62;
    let i = 0;
    for (let fila = 0; fila < 4; fila++) {
      for (let k = 0; k <= fila; k++) {
        const b = bolos[i++];
        const x = cx + (k - fila / 2) * paso;
        const y = cy + (3 - fila) * paso * 0.866 + 10;
        const tumbado = !b.enPie || b.caido || b.fuera;
        g2.fillStyle = tumbado ? '#3a2a55' : '#ffffff';
        g2.beginPath();
        g2.arc(x, y, 22, 0, Math.PI * 2);
        g2.fill();
        if (!tumbado) {
          g2.fillStyle = '#d32f2f';
          g2.fillRect(x - 14, y - 4, 28, 6);
        }
      }
    }
    // Texto animado
    let texto = anim.texto;
    let escala = 1;
    let color = '#ffffff';
    if (anim.tipo) {
      const p = Math.min(1, anim.t / anim.duracion);
      escala = p < 0.18 ? 0.3 + (p / 0.18) * 1.0 : 1.3 - Math.min(1, (p - 0.18) / 0.2) * 0.3; // aparece de golpe y se asienta
      if (anim.tipo === 'pleno') color = `hsl(${(anim.t * 540) % 360}, 100%, 65%)`; // arcoíris
      else if (anim.tipo === 'semipleno') color = Math.floor(anim.t * 8) % 2 ? '#ffd54f' : '#ffffff';
      else color = '#b9f6ca';
    } else {
      texto = estado === 'fin' ? `${puntuacion()} PUNTOS` : `MARCO ${Math.min(10, marco + 1)}`;
      color = '#b39dff';
    }
    g2.save();
    g2.translate(520, h / 2);
    g2.scale(escala, escala);
    g2.fillStyle = color;
    g2.font = `bold ${texto.length > 9 ? 56 : 76}px sans-serif`;
    g2.textAlign = 'center';
    g2.textBaseline = 'middle';
    g2.shadowColor = color;
    g2.shadowBlur = anim.tipo ? 24 : 0;
    g2.fillText(texto, 0, 0);
    g2.restore();
    texPantalla.needsUpdate = true;
  }

  // Confeti para los plenos y semiplenos (una sola llamada de dibujo)
  const N_CONFETI = 90;
  const confeti = new THREE.InstancedMesh(R(new THREE.PlaneGeometry(0.06, 0.035)), R(new THREE.MeshBasicMaterial({ side: THREE.DoubleSide, toneMapped: false })), N_CONFETI);
  confeti.frustumCulled = false;
  confeti.visible = false;
  const COLORES_CONFETI = [0xff4fd8, 0x00e5ff, 0xffd54f, 0x69f0ae, 0xff7043, 0xb388ff];
  const trozos = Array.from({ length: N_CONFETI }, (_, i) => {
    confeti.setColorAt(i, new THREE.Color(COLORES_CONFETI[i % COLORES_CONFETI.length]));
    return { pos: new THREE.Vector3(), vel: new THREE.Vector3(), giro: new THREE.Euler(), velGiro: new THREE.Vector3() };
  });
  raiz.add(confeti);
  const mConfeti = new THREE.Matrix4();
  const qConfeti = new THREE.Quaternion();
  const unoConfeti = new THREE.Vector3(1, 1, 1);
  let vidaConfeti = 0;

  function lanzarConfeti() {
    vidaConfeti = 3;
    confeti.visible = true;
    for (const c of trozos) {
      c.pos.set((Math.random() - 0.5) * 3, 3 + Math.random() * 0.8, -2.5 - Math.random() * 3);
      c.vel.set((Math.random() - 0.5) * 1.5, Math.random() * 1.2, (Math.random() - 0.5) * 1.2);
      c.giro.set(Math.random() * 6, Math.random() * 6, Math.random() * 6);
      c.velGiro.set(Math.random() * 8, Math.random() * 8, Math.random() * 8);
    }
  }

  let clavePantalla = '';
  function actualizarAnimaciones(dt) {
    const animando = !!anim.tipo;
    if (anim.tipo) {
      anim.t += dt;
      if (anim.t >= anim.duracion) anim.tipo = null;
    }
    // Repintar (y subir la textura) solo si algo ha cambiado o hay animación
    const clave = `${estado}|${marco}|${bolos.map((b) => (b.enPie && !b.caido && !b.fuera ? 1 : 0)).join('')}`;
    if (animando || clave !== clavePantalla) {
      clavePantalla = clave;
      pintarPantalla();
    }
    if (vidaConfeti > 0) {
      vidaConfeti -= dt;
      for (let i = 0; i < N_CONFETI; i++) {
        const c = trozos[i];
        c.vel.y = Math.max(-0.9, c.vel.y - 3 * dt); // cae despacio, como papel
        c.vel.x *= 0.99;
        c.pos.addScaledVector(c.vel, dt);
        c.giro.x += c.velGiro.x * dt;
        c.giro.y += c.velGiro.y * dt;
        confeti.setMatrixAt(i, mConfeti.compose(c.pos, qConfeti.setFromEuler(c.giro), unoConfeti));
      }
      confeti.instanceMatrix.needsUpdate = true;
      if (vidaConfeti <= 0) confeti.visible = false;
    }
  }

  function animar(tipo, texto) {
    anim.tipo = tipo;
    anim.texto = texto;
    anim.t = 0;
    anim.duracion = tipo === 'normal' ? 1.2 : 1.9;
    if (tipo !== 'normal') lanzarConfeti();
  }

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
    // Animación de la pantalla, como en las boleras
    if (mensaje.startsWith('¡PLENO')) {
      ctx.sonido('ovacion');
      ctx.destello(0x7c5cff, 0.35);
      for (const mano of ctx.manos) ctx.vibrar(mano, 0.8, 200);
      animar('pleno', '¡STRIKE!');
    } else if (mensaje.startsWith('¡Semi')) {
      ctx.sonido('punto');
      ctx.sonido('ovacion');
      animar('semipleno', '¡SEMIPLENO!');
    } else {
      animar('normal', derribados === 0 ? '¡CERO!' : `${derribados} BOLO${derribados === 1 ? '' : 'S'}`);
    }

    if (siguienteMarco) {
      marco += 1;
      reponer = true;
    }
    estado = 'recuento';
    reloj = anim.tipo === 'normal' ? 1.1 : 1.7; // antes 2 s siempre
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
        if (quietos > QUIETOS_RECUENTO || tiempoTirada > 9) trasRecuento = recontar();
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
    actualizarAnimaciones(dt);
    actualizarMarcador();
  }

  colocarBolos(true);
  bola.position.copy(SOPORTE);
  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      niebla.near = nieblaOriginal.near;
      niebla.far = nieblaOriginal.far;
    },
  };
}
