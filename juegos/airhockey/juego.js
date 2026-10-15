// AIR HOCKEY
// Un salón recreativo con luces de neón y una mesa de air hockey delante, a la altura de la cintura.
// Partido a 7 goles contra la máquina, que empieza tranquila y va subiendo de nivel poco a poco
// (con el tiempo de partido y con los partidos que le ganas): defiende, ataca y a veces falla.
// La mesa es pequeña a propósito: tu mitad cabe al alcance de los brazos sin moverte.
//
// En VR: la maza sigue a la mano dominante (la derecha; el gatillo de la otra mano la cambia de mano),
// proyectada sobre la mesa y sin salir de tu mitad. La velocidad de la mano pasa al disco.
// Con ratón o en el móvil: la maza sigue al puntero o al dedo sobre la mesa.
//
// Física en 2D sobre el plano de la mesa (x, z), con pasos pequeños para que el disco no atraviese
// las mazas a velocidad alta.
import * as THREE from 'three';

// Todo se genera con código: no hay nada que descargar.
export async function precargar() {}

const GOLES = 7;
const MESA_Y = 0.8;            // altura de la superficie
const Z_CERCA = -0.12;         // fondo de tu lado (tu portería)
const Z_LEJOS = -1.32;         // fondo de la máquina
const Z_CENTRO = (Z_CERCA + Z_LEJOS) / 2;
const ANCHO = 0.32;            // media anchura de la mesa
const PORTERIA = 0.11;         // media anchura de las porterías
const R_DISCO = 0.03;
const R_MAZA = 0.042;
const VEL_MAX = 3.4;           // velocidad máxima del disco (m/s)
const VEL_MAX_MAZA = 5;        // la maza no transmite más que esto
const REBOTE_BANDA = 0.86;
const REBOTE_MAZA = 0.9;
const ROZAMIENTO = 0.22;       // poco: el colchón de aire casi no frena
const MAX_PASO = 0.006;        // metros que puede avanzar el disco en cada paso de la simulación

const azar = (a, b) => a + Math.random() * (b - a);
const limitar = (v, a, b) => Math.min(b, Math.max(a, v));

// Junta varias geometrías en una (menos llamadas de dibujo). Con «colores», un color por pieza.
function fusionar(geometrias, colores = null) {
  const partes = geometrias.map((g) => (g.index ? g.toNonIndexed() : g));
  const total = partes.reduce((n, g) => n + g.attributes.position.count, 0);
  const resultado = new THREE.BufferGeometry();
  for (const nombre of colores ? ['position', 'normal'] : ['position', 'normal', 'uv']) {
    const tam = partes[0].attributes[nombre].itemSize;
    const datos = new Float32Array(total * tam);
    let o = 0;
    for (const g of partes) {
      datos.set(g.attributes[nombre].array, o);
      o += g.attributes[nombre].array.length;
    }
    resultado.setAttribute(nombre, new THREE.BufferAttribute(datos, tam));
  }
  if (colores) {
    const datos = new Float32Array(total * 3);
    const c = new THREE.Color();
    let o = 0;
    partes.forEach((g, i) => {
      c.set(colores[i]);
      for (let v = 0; v < g.attributes.position.count; v++, o += 3) datos.set([c.r, c.g, c.b], o);
    });
    resultado.setAttribute('color', new THREE.BufferAttribute(datos, 3));
  }
  for (const g of new Set([...geometrias, ...partes])) g.dispose();
  return resultado;
}

// Tubo de neón por una lista de puntos [x, y] (en un plano vertical, centrado en el origen)
function tuboNeon(puntos, { cerrado = false, grosor = 0.025, escala = 1 } = {}) {
  const curva = new THREE.CatmullRomCurve3(puntos.map(([x, y]) => new THREE.Vector3(x * escala, y * escala, 0)), cerrado, 'catmullrom', 0.05);
  return new THREE.TubeGeometry(curva, puntos.length * 8, grosor, 6, cerrado);
}

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  // ─── Salón recreativo ──────────────────────────────────────────────────
  ctx.fondo(0x140e22, { cenit: 0x0c0816, horizonte: 0x1d1430, suelo: 0x0e0a18, niebla: [7, 16] });
  ctx.sueloBase(false);

  // Moqueta de salón recreativo: azul noche con garabatos de colores
  const texMoqueta = R(ctx.texturaCanvas((g, tam, azarTex) => {
    g.fillStyle = '#141032';
    g.fillRect(0, 0, tam, tam);
    const colores = ['#ff4fd8', '#33e1ff', '#ffe14d', '#7cff6b', '#ff7a3d'];
    g.lineWidth = tam / 90;
    g.lineCap = 'round';
    for (let i = 0; i < 70; i++) {
      g.strokeStyle = colores[i % colores.length];
      g.fillStyle = colores[(i + 2) % colores.length];
      const x = azarTex() * tam;
      const y = azarTex() * tam;
      const tipo = i % 4;
      g.beginPath();
      if (tipo === 0) {
        // garabato
        g.moveTo(x, y);
        for (let k = 1; k < 5; k++) g.lineTo(x + k * tam * 0.02, y + (k % 2 ? -1 : 1) * tam * 0.015);
        g.stroke();
      } else if (tipo === 1) {
        g.arc(x, y, tam * 0.012, 0, Math.PI * 2);
        g.fill();
      } else if (tipo === 2) {
        g.moveTo(x, y);
        g.lineTo(x + tam * 0.03, y + tam * 0.01);
        g.lineTo(x + tam * 0.008, y + tam * 0.03);
        g.closePath();
        g.stroke();
      } else {
        g.arc(x, y, tam * 0.02, 0, Math.PI);
        g.stroke();
      }
    }
  }, { tam: 512, repetir: [5, 5], semilla: 171 }));
  const suelo = new THREE.Mesh(R(new THREE.PlaneGeometry(9, 9).rotateX(-Math.PI / 2)), R(new THREE.MeshLambertMaterial({ map: texMoqueta })));
  suelo.position.z = -1;
  raiz.add(suelo);

  // Paredes de ladrillo oscuro y techo (dos mallas)
  const texPared = R(ctx.texturas.ladrillos(0x3a2a4a, 0x181220, { tam: 512, repetir: [5, 2], semilla: 172 }));
  raiz.add(new THREE.Mesh(R(fusionar([
    new THREE.PlaneGeometry(9, 3.4).translate(0, 1.7, -4.2),
    new THREE.PlaneGeometry(9, 3.4).rotateY(Math.PI / 2).translate(-3.6, 1.7, -0.5),
    new THREE.PlaneGeometry(9, 3.4).rotateY(-Math.PI / 2).translate(3.6, 1.7, -0.5),
    new THREE.PlaneGeometry(9, 3.4).rotateY(Math.PI).translate(0, 1.7, 3.2),
  ])), R(new THREE.MeshLambertMaterial({ map: texPared }))));
  raiz.add(new THREE.Mesh(R(new THREE.PlaneGeometry(9, 9).rotateX(Math.PI / 2).translate(0, 3.4, -0.5)), R(new THREE.MeshLambertMaterial({ color: 0x120e1c }))));

  // Máquinas recreativas a los lados: mueble, pantalla y cartel luminoso (tres mallas)
  const texPantalla = R(ctx.texturaCanvas((g, tam, azarTex) => {
    g.fillStyle = '#05060f';
    g.fillRect(0, 0, tam, tam);
    // Un «matamarcianos» de píxeles
    const colores = ['#33e1ff', '#ff4fd8', '#7cff6b', '#ffe14d'];
    const p = tam / 32;
    for (let fila = 0; fila < 4; fila++) {
      for (let col = 0; col < 6; col++) {
        g.fillStyle = colores[fila];
        const x = (4 + col * 4.4) * p;
        const y = (4 + fila * 3.6) * p;
        g.fillRect(x, y, 2.6 * p, 1.4 * p);
        g.fillRect(x - 0.6 * p, y + 1.4 * p, 0.8 * p, 0.8 * p);
        g.fillRect(x + 2.4 * p, y + 1.4 * p, 0.8 * p, 0.8 * p);
      }
    }
    g.fillStyle = '#7cff6b';
    g.fillRect(14 * p, 27 * p, 4 * p, 2 * p);
    for (let i = 0; i < 40; i++) {
      g.fillStyle = `rgba(255,255,255,${azarTex() * 0.6})`;
      g.fillRect(azarTex() * tam, azarTex() * tam, 2, 2);
    }
    for (let y = 0; y < tam; y += 4) {
      g.fillStyle = 'rgba(0,0,0,0.25)';
      g.fillRect(0, y, tam, 2);
    }
  }, { tam: 256, semilla: 173 }));
  const texCartel = R(ctx.texturaCanvas((g, tam) => {
    const grad = g.createLinearGradient(0, 0, tam, 0);
    grad.addColorStop(0, '#ff4fd8');
    grad.addColorStop(0.5, '#ffe14d');
    grad.addColorStop(1, '#33e1ff');
    g.fillStyle = grad;
    g.fillRect(0, 0, tam, tam);
    g.fillStyle = 'rgba(20,10,40,0.55)';
    for (let i = 0; i < 6; i++) g.fillRect((i / 6) * tam + tam * 0.04, tam * 0.3, tam * 0.1, tam * 0.4);
  }, { tam: 128, semilla: 174 }));
  const muebles = [];
  const pantallas = [];
  const carteles = [];
  for (const lado of [-1, 1]) {
    for (let i = 0; i < 3; i++) {
      const z = -2.9 + i * 1.0;
      const giro = -lado * Math.PI / 2;
      const colocar = (g) => g.rotateY(giro).translate(lado * 3.15, 0, z);
      muebles.push(colocar(new THREE.BoxGeometry(0.72, 1.85, 0.7).translate(0, 0.925, 0)));
      muebles.push(colocar(new THREE.BoxGeometry(0.72, 0.12, 0.34).rotateX(-0.35).translate(0, 1.0, 0.36)));
      pantallas.push(colocar(new THREE.PlaneGeometry(0.56, 0.48).rotateX(-0.12).translate(0, 1.38, 0.355)));
      carteles.push(colocar(new THREE.PlaneGeometry(0.66, 0.2).translate(0, 1.72, 0.356)));
    }
  }
  raiz.add(new THREE.Mesh(R(fusionar(muebles)), R(new THREE.MeshLambertMaterial({ color: 0x2b1c4a }))));
  raiz.add(new THREE.Mesh(R(fusionar(pantallas)), R(new THREE.MeshBasicMaterial({ map: texPantalla }))));
  raiz.add(new THREE.Mesh(R(fusionar(carteles)), R(new THREE.MeshBasicMaterial({ map: texCartel }))));

  // Neones: materiales que brillan por sí solos (sin luces). Rayo, estrella y aro en la pared del
  // fondo, tiras onduladas en las laterales y el contorno de la mesa. Una malla con colores.
  const neones = [];
  const coloresNeon = [];
  const halos = [];
  const coloresHalo = [];
  const neon = (geo, color, halo = null) => {
    neones.push(geo);
    coloresNeon.push(color);
    if (halo) {
      halos.push(new THREE.PlaneGeometry(halo[2], halo[2]).translate(halo[0], halo[1], -4.17));
      coloresHalo.push(color);
    }
  };
  neon(tuboNeon([[-0.2, 0.5], [0.15, 0.08], [-0.05, 0.05], [0.2, -0.5], [-0.15, -0.05], [0.05, -0.02], [-0.2, 0.5]], { escala: 1.4 }).translate(-1.9, 2.1, -4.15), 0xffe14d, [-1.9, 2.1, 2.2]);
  const estrella = [];
  for (let i = 0; i <= 10; i++) {
    const a = (i / 10) * Math.PI * 2 + Math.PI / 2;
    const r = i % 2 ? 0.2 : 0.48;
    estrella.push([Math.cos(a) * r, Math.sin(a) * r]);
  }
  neon(tuboNeon(estrella).translate(1.9, 2.15, -4.15), 0x33e1ff, [1.9, 2.15, 2.2]);
  neon(new THREE.TorusGeometry(0.5, 0.028, 6, 48).translate(0, 2.55, -4.15), 0xff4fd8, [0, 2.55, 2.2]);
  neon(new THREE.TorusGeometry(0.22, 0.026, 6, 32).translate(0, 2.55, -4.15), 0x7cff6b);
  for (const lado of [-1, 1]) {
    const onda = [];
    for (let i = 0; i <= 24; i++) onda.push([-4.2 + i * 0.32, Math.sin(i * 0.9) * 0.1]);
    neon(tuboNeon(onda, { grosor: 0.02 }).rotateY(lado * Math.PI / 2).translate(lado * 3.57, 2.55, -0.5), lado < 0 ? 0xff4fd8 : 0x33e1ff);
  }
  // Contorno de la mesa, por debajo del canto
  neon(new THREE.BoxGeometry(ANCHO * 2 + 0.14, 0.012, 0.012).translate(0, MESA_Y - 0.075, Z_CERCA + 0.065), 0x33e1ff);
  neon(new THREE.BoxGeometry(ANCHO * 2 + 0.14, 0.012, 0.012).translate(0, MESA_Y - 0.075, Z_LEJOS - 0.065), 0x33e1ff);
  for (const lado of [-1, 1]) neon(new THREE.BoxGeometry(0.012, 0.012, Z_CERCA - Z_LEJOS + 0.14).translate(lado * (ANCHO + 0.07), MESA_Y - 0.075, Z_CENTRO), 0xff4fd8);
  raiz.add(new THREE.Mesh(R(fusionar(neones, coloresNeon)), R(new THREE.MeshBasicMaterial({ vertexColors: true, toneMapped: false }))));
  const texHalo = R(ctx.texturaCanvas((g, tam) => {
    const grad = g.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
    grad.addColorStop(0, 'rgba(255,255,255,0.55)');
    grad.addColorStop(0.45, 'rgba(255,255,255,0.18)');
    grad.addColorStop(1, 'rgba(255,255,255,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, tam, tam);
  }, { tam: 128, semilla: 175 }));
  raiz.add(new THREE.Mesh(R(fusionar(halos, coloresHalo)), R(new THREE.MeshBasicMaterial({
    map: texHalo, vertexColors: true, transparent: true, depthWrite: false, blending: THREE.AdditiveBlending,
  }))));

  // ─── La mesa ───────────────────────────────────────────────────────────
  const largo = Z_CERCA - Z_LEJOS;
  // Superficie: blanca, con las rayas, el círculo central, las áreas y los agujeros del aire
  const texMesa = R(ctx.texturaCanvas((g, tam) => {
    // tam × tam corresponde a la mesa entera (ancho × largo); se estira al aplicarla
    g.fillStyle = '#eef6ff';
    g.fillRect(0, 0, tam, tam);
    g.fillStyle = 'rgba(70,90,130,0.35)';
    for (let y = tam / 40; y < tam; y += tam / 20) {
      for (let x = tam / 24; x < tam; x += tam / 12) {
        g.beginPath();
        g.arc(x, y, tam * 0.004, 0, Math.PI * 2);
        g.fill();
      }
    }
    g.lineWidth = tam * 0.012;
    g.strokeStyle = '#e53935';
    g.beginPath();
    g.moveTo(0, tam / 2);
    g.lineTo(tam, tam / 2);
    g.stroke();
    g.beginPath();
    g.ellipse(tam / 2, tam / 2, tam * 0.2, tam * 0.2 * (ANCHO * 2) / largo, 0, 0, Math.PI * 2);
    g.stroke();
    g.strokeStyle = '#1e88e5';
    for (const [y, inicio, fin] of [[0, 0, Math.PI], [tam, Math.PI, Math.PI * 2]]) {
      g.beginPath();
      g.ellipse(tam / 2, y, tam * 0.3, tam * 0.3 * (ANCHO * 2) / largo, 0, inicio, fin);
      g.stroke();
    }
    g.lineWidth = tam * 0.008;
    for (const y of [tam * 0.25, tam * 0.75]) {
      g.beginPath();
      g.moveTo(0, y);
      g.lineTo(tam, y);
      g.stroke();
    }
  }, { tam: 512, semilla: 176 }));
  const superficie = new THREE.Mesh(
    R(new THREE.PlaneGeometry(ANCHO * 2, largo).rotateX(-Math.PI / 2).translate(0, MESA_Y, Z_CENTRO)),
    R(new THREE.MeshLambertMaterial({ map: texMesa })),
  );
  raiz.add(superficie);
  // Cuerpo, patas y bandas (las bandas tienen el hueco de las porterías)
  const alto = 0.045;
  const grosor = 0.05;
  const bandas = [];
  for (const lado of [-1, 1]) bandas.push(new THREE.BoxGeometry(grosor, alto, largo + grosor * 2).translate(lado * (ANCHO + grosor / 2), MESA_Y + alto / 2, Z_CENTRO));
  const trozo = ANCHO - PORTERIA;
  for (const z of [Z_CERCA + grosor / 2, Z_LEJOS - grosor / 2]) {
    for (const lado of [-1, 1]) bandas.push(new THREE.BoxGeometry(trozo, alto, grosor).translate(lado * (PORTERIA + trozo / 2), MESA_Y + alto / 2, z));
  }
  raiz.add(new THREE.Mesh(R(fusionar(bandas)), R(new THREE.MeshLambertMaterial({ color: 0x23233a }))));
  const cuerpo = [
    new THREE.BoxGeometry(ANCHO * 2 + grosor * 2, 0.135, largo + grosor * 2).translate(0, MESA_Y - 0.0725, Z_CENTRO),
    new THREE.BoxGeometry(ANCHO * 2 - 0.1, 0.5, largo - 0.2).translate(0, 0.42, Z_CENTRO),
  ];
  for (const x of [-1, 1]) for (const z of [Z_CERCA - 0.08, Z_LEJOS + 0.08]) cuerpo.push(new THREE.BoxGeometry(0.07, MESA_Y - 0.14, 0.07).translate(x * (ANCHO - 0.02), (MESA_Y - 0.14) / 2, z));
  // Ranuras de las porterías (por donde cae el disco)
  for (const z of [Z_CERCA + 0.03, Z_LEJOS - 0.03]) cuerpo.push(new THREE.BoxGeometry(PORTERIA * 2, 0.005, 0.05).translate(0, MESA_Y + 0.001, z));
  const texCuerpo = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#1f2a6b';
    g.fillRect(0, 0, tam, tam);
    g.fillStyle = '#e53935';
    g.fillRect(0, tam * 0.42, tam, tam * 0.16);
    g.fillStyle = '#ffffff';
    g.fillRect(0, tam * 0.47, tam, tam * 0.06);
  }, { tam: 128, semilla: 177 }));
  raiz.add(new THREE.Mesh(R(fusionar(cuerpo)), R(new THREE.MeshLambertMaterial({ map: texCuerpo }))));

  // ─── Disco y mazas ─────────────────────────────────────────────────────
  // Disco con el borde levantado y una cara amarilla
  const perfilDisco = [[0.001, 0], [R_DISCO, 0], [R_DISCO, 0.0095], [R_DISCO * 0.84, 0.0095], [R_DISCO * 0.78, 0.007], [0.001, 0.007]].map(([x, y]) => new THREE.Vector2(x, y));
  const disco = new THREE.Mesh(R(new THREE.LatheGeometry(perfilDisco, 28)), R(new THREE.MeshLambertMaterial({ color: 0xffc400, emissive: 0x3a2a00 })));
  const bordeDisco = new THREE.Mesh(R(new THREE.TorusGeometry(R_DISCO * 0.92, 0.0022, 5, 28).rotateX(Math.PI / 2).translate(0, 0.0095, 0)), R(new THREE.MeshBasicMaterial({ color: 0xff6a3d })));
  disco.add(bordeDisco);
  raiz.add(disco);
  const sombraDisco = ctx.crearSombra({ radio: 0.04, opacidad: 0.35 });
  raiz.add(sombraDisco);

  // Maza: base ancha con borde, cuello y pomo
  const perfilMaza = [
    [0.001, 0], [R_MAZA, 0], [R_MAZA, 0.012], [R_MAZA * 0.86, 0.016], [R_MAZA * 0.55, 0.02], [0.014, 0.034],
    [0.012, 0.06], [0.018, 0.068], [0.02, 0.08], [0.014, 0.092], [0.001, 0.095],
  ].map(([x, y]) => new THREE.Vector2(x, y));
  const geoMaza = R(new THREE.LatheGeometry(perfilMaza, 28));
  function crearMaza(color) {
    const m = new THREE.Mesh(geoMaza, R(new THREE.MeshLambertMaterial({ color, emissive: new THREE.Color(color).multiplyScalar(0.18) })));
    raiz.add(m);
    const sombra = ctx.crearSombra({ radio: 0.055, opacidad: 0.35 });
    raiz.add(sombra);
    // x, z: donde está (después de los choques); ex, ez: donde la lleva la mano o el puntero
    return { malla: m, sombra, x: 0, z: 0, xAntes: 0, zAntes: 0, vx: 0, vz: 0, ex: 0, ez: 0, espera: 0 };
  }
  const jugador = crearMaza(0xff3b30);
  const maquina = crearMaza(0x2979ff);
  const MAZAS = [jugador, maquina];

  // En VR: una bolita de luz en cada mano y una línea de la mano a la maza
  const matManos = R(new THREE.MeshBasicMaterial({ color: 0xffb199 }));
  const geoBolita = R(new THREE.SphereGeometry(0.014, 10, 8));
  for (const mano of ctx.manos) ctx.adjuntarAMano(mano, new THREE.Mesh(geoBolita, matManos));
  const posLinea = new Float32Array(6);
  const geoLinea = R(new THREE.BufferGeometry());
  geoLinea.setAttribute('position', new THREE.BufferAttribute(posLinea, 3).setUsage(THREE.DynamicDrawUsage));
  const linea = new THREE.Line(geoLinea, R(new THREE.LineBasicMaterial({ color: 0xff8a80, transparent: true, opacity: 0.45 })));
  linea.frustumCulled = false;
  linea.visible = false;
  raiz.add(linea);

  // ─── Marcador colgado sobre la mesa ────────────────────────────────────
  const Z_MARCADOR = Z_LEJOS - 0.3;
  const Y_MARCADOR = 1.5;
  raiz.add(new THREE.Mesh(R(fusionar([
    new THREE.BoxGeometry(0.98, 0.46, 0.12).translate(0, Y_MARCADOR, Z_MARCADOR),
    new THREE.CylinderGeometry(0.006, 0.006, 3.4 - Y_MARCADOR - 0.23, 5).translate(-0.4, (3.4 + Y_MARCADOR + 0.23) / 2, Z_MARCADOR),
    new THREE.CylinderGeometry(0.006, 0.006, 3.4 - Y_MARCADOR - 0.23, 5).translate(0.4, (3.4 + Y_MARCADOR + 0.23) / 2, Z_MARCADOR),
  ])), R(new THREE.MeshLambertMaterial({ color: 0x1a1a26 }))));
  const panel = ctx.crearPanel({ ancho: 0.86, alto: 0.34 });
  panel.mesh.position.set(0, Y_MARCADOR, Z_MARCADOR + 0.062);
  raiz.add(panel.mesh);
  // Bombillas alrededor: pares e impares por separado para hacer el baile de luces del gol
  const bombillas = [[], []];
  let n = 0;
  for (let i = 0; i <= 12; i++) {
    for (const y of [Y_MARCADOR + 0.215, Y_MARCADOR - 0.215]) bombillas[n++ % 2].push(new THREE.SphereGeometry(0.012, 8, 6).translate(-0.47 + i * (0.94 / 12), y, Z_MARCADOR + 0.064));
  }
  for (let i = 1; i < 4; i++) {
    for (const x of [-0.47, 0.47]) bombillas[n++ % 2].push(new THREE.SphereGeometry(0.012, 8, 6).translate(x, Y_MARCADOR - 0.215 + i * (0.43 / 4), Z_MARCADOR + 0.064));
  }
  const luces = bombillas.map((lista) => {
    const malla = new THREE.Mesh(R(fusionar(lista)), R(new THREE.MeshBasicMaterial({ color: 0xffd28a, toneMapped: false })));
    raiz.add(malla);
    return malla;
  });

  // ─── Estado ────────────────────────────────────────────────────────────
  const tanteo = { jugador: 0, maquina: 0 };
  let ganadas = ctx.leer('ganadas', 0);
  let estado = 'intro'; // 'intro' | 'juego' | 'gol' | 'fin'
  let reloj = 3;
  let tiempoPartido = 0;
  let fiesta = 0;            // segundos del baile de luces del marcador
  let aviso = null;          // { texto, color, tiempo }
  let ultimoGol = '';        // quién marcó el último gol
  let indiceMano = null;     // mano que lleva la maza en VR
  let ruidoBanda = 0;
  let quieto = 0;            // segundos que el disco lleva casi parado
  const d = { x: 0, z: 0, vx: 0, vz: 0, visible: true };
  const ia = { plan: 0, objX: 0, objZ: Z_LEJOS + 0.15, rapidez: 1, error: 0, jugada: false, tx: 0, banda: false, dx: 0, dz: 1, viene: false };
  const tmp = new THREE.Vector3();
  const plano = new THREE.Plane(new THREE.Vector3(0, 1, 0), -MESA_Y);

  // 0 al principio, 1 a la dificultad máxima: con el tiempo de partido y con los partidos ganados
  const dificultad = () => Math.min(1, 0.12 + tiempoPartido / 220 + ganadas * 0.08);

  function avisar(texto, color, tiempo = 1.6) { aviso = { texto, color, tiempo }; }

  function escribirMarcador() {
    const lineas = [{ texto: ctx.t('partida.tanteo', tanteo), tam: 1.25, color: '#ffffff' }];
    if (estado === 'intro') {
      lineas[0] = { texto: ctx.t('titulo'), tam: 1.3, color: '#ffe14d' };
      lineas.push({ texto: ctx.t(ctx.enVR() ? 'introVR' : ctx.tactil ? 'introTactil' : 'introRaton'), tam: 0.62, color: '#b3e5fc' });
    } else if (aviso) {
      lineas.push({ texto: aviso.texto, tam: 0.75, color: aviso.color });
    } else if (estado === 'fin') {
      lineas.push({ texto: ctx.t('nuevoPartido', { n: Math.ceil(reloj) }), tam: 0.7, color: '#ffe14d' });
    } else {
      lineas.push({ texto: ctx.t('partida.aPuntos', { set: GOLES, ganadas }), tam: 0.62, color: '#ffcc80' });
    }
    panel.escribir(lineas);
  }

  // Disco parado en el centro de la mitad de quien ha encajado el gol
  function sacar(paraJugador) {
    d.x = 0;
    d.z = paraJugador ? (Z_CERCA + Z_CENTRO) / 2 : (Z_LEJOS + Z_CENTRO) / 2;
    d.vx = 0;
    d.vz = 0;
    d.visible = true;
    disco.scale.setScalar(1);
    quieto = 0;
    ctx.efectos.estallido(tmp.set(d.x, MESA_Y + 0.02, d.z), { color: 0xffc400, cantidad: 8, fuerza: 0.5, gravedad: 2 });
  }

  function empezarPartido() {
    tanteo.jugador = 0;
    tanteo.maquina = 0;
    tiempoPartido = 0;
    estado = 'juego';
    aviso = null;
    sacar(true);
    avisar(ctx.t('tuSaque'), '#b3e5fc', 2);
  }

  function gol(paraJugador) {
    d.visible = false;
    estado = 'gol';
    reloj = 1.6;
    ultimoGol = paraJugador ? 'jugador' : 'maquina';
    const manoJugador = indiceMano !== null && ctx.enVR() ? ctx.manos[indiceMano] : null;
    if (paraJugador) {
      tanteo.jugador++;
      tmp.set(0, MESA_Y + 0.12, Z_LEJOS + 0.05);
      ctx.efectos.impacto('grande', { pos: tmp, mano: manoJugador, color: 0xffe14d, sonido: 'gol' });
      ctx.efectos.texto(tmp.set(0, MESA_Y + 0.3, Z_LEJOS + 0.1), ctx.t('gol'), { color: '#ffe14d', tam: 2.4, vida: 1.3 });
      ctx.destello(0xffe14d, 0.18);
      fiesta = 1.8;
      avisar(ctx.t('gol'), '#ffe14d', 1.5);
    } else {
      // En contra: sacudida suave y sonido grave, sin celebración
      tanteo.maquina++;
      ctx.efectos.impacto('pequeño', { mano: manoJugador });
      ctx.sonido('zumbador');
      ctx.efectos.texto(tmp.set(0, MESA_Y + 0.2, Z_CERCA - 0.12), ctx.t('golMaquina'), { color: '#ff8a80', tam: 1.2, vida: 1.1 });
      avisar(ctx.t('golMaquina'), '#ff8a80', 1.5);
    }
    if (tanteo.jugador >= GOLES || tanteo.maquina >= GOLES) {
      estado = 'fin';
      reloj = 7;
      if (tanteo.jugador > tanteo.maquina) {
        ctx.puntuacion(tanteo.jugador - tanteo.maquina); // diferencia al ganar (juegos/marcadores.js)
        ganadas++;
        ctx.guardar('ganadas', ganadas);
        avisar(ctx.t('partida.hasGanado'), '#b9f6ca', 4);
        ctx.sonido('ovacion');
        fiesta = 4;
      } else {
        avisar(ctx.t('partida.ganaMaquina'), '#ff8a80', 4);
      }
      ctx.sonido('fin');
    }
  }

  // ─── Mazas ─────────────────────────────────────────────────────────────
  function limitarJugador(m) {
    m.x = limitar(m.x, -ANCHO + R_MAZA, ANCHO - R_MAZA);
    m.z = limitar(m.z, Z_CENTRO + R_MAZA, Z_CERCA - R_MAZA);
  }
  function limitarMaquina(m) {
    m.x = limitar(m.x, -ANCHO + R_MAZA, ANCHO - R_MAZA);
    m.z = limitar(m.z, Z_LEJOS + R_MAZA, Z_CENTRO - R_MAZA);
  }

  function moverJugador(dt) {
    jugador.xAntes = jugador.x;
    jugador.zAntes = jugador.z;
    const exAntes = jugador.ex;
    const ezAntes = jugador.ez;
    linea.visible = false;
    if (ctx.enVR()) {
      const activas = ctx.manos.filter((m) => m.activa);
      if (indiceMano === null || !ctx.manos[indiceMano].activa) {
        const derecha = activas.find((m) => m.lado === 'right') || activas[0];
        indiceMano = derecha ? ctx.manos.indexOf(derecha) : null;
      }
      // El gatillo de la otra mano cambia la maza de mano (zurdos)
      const libre = activas.find((m) => ctx.manos.indexOf(m) !== indiceMano);
      if (libre && libre.gatilloPulsado) {
        indiceMano = ctx.manos.indexOf(libre);
        ctx.vibrar(libre, 0.3, 40);
      }
      if (indiceMano === null) return;
      const mano = ctx.manos[indiceMano];
      jugador.x = mano.posicion.x;
      jugador.z = mano.posicion.z;
      limitarJugador(jugador);
      jugador.ex = jugador.x;
      jugador.ez = jugador.z;
      // Si la mano va por encima de la mesa, una línea la une con la maza
      if (mano.posicion.y > MESA_Y + 0.12) {
        linea.visible = true;
        posLinea.set([mano.posicion.x, mano.posicion.y, mano.posicion.z, jugador.x, MESA_Y + 0.095, jugador.z]);
        geoLinea.attributes.position.needsUpdate = true;
      }
    } else {
      const r = ctx.raton;
      if ((r.dentro || ctx.tactil) && r.rayo.ray.intersectPlane(plano, tmp)) {
        // Sigue al puntero muy de cerca, sin pasar de una velocidad razonable
        const dx = tmp.x - jugador.ex;
        const dz = tmp.z - jugador.ez;
        const dist = Math.hypot(dx, dz);
        const paso = Math.min(dist, VEL_MAX_MAZA * dt, dist * Math.min(1, dt * 30));
        jugador.x = jugador.ex;
        jugador.z = jugador.ez;
        if (dist > 1e-6) {
          jugador.x += (dx / dist) * paso;
          jugador.z += (dz / dist) * paso;
        }
        limitarJugador(jugador);
        jugador.ex = jugador.x;
        jugador.ez = jugador.z;
      }
    }
    // La velocidad que pasa al disco es la de la mano (no la de los empujones del disco a la maza)
    jugador.vx = (jugador.ex - exAntes) / Math.max(dt, 1e-3);
    jugador.vz = (jugador.ez - ezAntes) / Math.max(dt, 1e-3);
  }

  // ¿Está el disco tocando una banda o una esquina?
  const pegado = () => Math.abs(d.x) > ANCHO - R_DISCO - 0.015 || d.z < Z_LEJOS + R_DISCO + 0.015 || d.z > Z_CERCA - R_DISCO - 0.015;

  // Dónde cruzará el disco la línea z (con los rebotes en las bandas)
  function prediccionX(z) {
    if (Math.abs(d.vz) < 1e-3) return d.x;
    const t = (z - d.z) / d.vz;
    if (t < 0) return d.x;
    const minimo = -ANCHO + R_DISCO;
    const ancho = 2 * (ANCHO - R_DISCO);
    let x = d.x + d.vx * t - minimo;
    x = ((x % (2 * ancho)) + 2 * ancho) % (2 * ancho);
    return minimo + (x > ancho ? 2 * ancho - x : x);
  }

  // Dirección del tiro de la máquina (en ia.dx, ia.dz): a tu portería, de rebote en la banda o, si no
  // hay sitio detrás del disco para ninguno de esos, hacia el centro. false si no cabe ninguno.
  function direccionTiro() {
    const directo = ia.tx;
    const banda = (ia.tx >= 0 ? -1 : 1) * (2 * ANCHO - R_DISCO) - ia.tx;
    const opciones = ia.banda ? [banda, directo, null] : [directo, banda, null];
    for (const tx of opciones) {
      let dx = tx === null ? -d.x : tx - d.x;
      let dz = tx === null ? Z_CENTRO + 0.2 - d.z : Z_CERCA - d.z;
      const dist = Math.hypot(dx, dz) || 1;
      dx /= dist;
      dz /= dist;
      const bx = d.x - dx * (R_DISCO + R_MAZA + 0.01);
      const bz = d.z - dz * (R_DISCO + R_MAZA + 0.01);
      if (Math.abs(bx) <= ANCHO - R_MAZA + 0.004 && bz >= Z_LEJOS + R_MAZA - 0.004) {
        ia.dx = dx;
        ia.dz = dz;
        return true;
      }
    }
    return false;
  }

  // La máquina piensa cada poco (cuanto más nivel, más a menudo y con menos error)
  function planificar() {
    const dif = dificultad();
    ia.plan = 0.24 - 0.15 * dif + azar(0, 0.05);
    // Ataca si el disco está en su mitad, salvo que vaya rápido hacia su portería (entonces se tapa)
    const enSuMitad = d.z < Z_CENTRO && d.vz > -0.6;
    // A veces calcula mal un tiro, como una persona (un error por tiro, no a cada momento)
    const viene = d.vz < -0.1;
    if (viene && !ia.viene) ia.error = Math.random() < 0.3 * (1 - dif) + 0.05 ? azar(-1, 1) * (0.06 + 0.08 * (1 - dif)) : 0;
    ia.viene = viene;
    if (enSuMitad && d.visible && pegado() && quieto > 0.4) {
      // Parado contra una banda o en una esquina: se aparta para que el aire lo despegue
      const dx = -d.x;
      const dz = Z_CENTRO - d.z;
      const n = Math.hypot(dx, dz) || 1;
      ia.objX = d.x + (dx / n) * 0.17;
      ia.objZ = d.z + (dz / n) * 0.17;
      ia.rapidez = 1;
    } else if (enSuMitad && d.visible) {
      // Atacar: elige a dónde tirar (una vez por jugada) y se pone detrás del disco para golpearlo
      if (!ia.jugada) {
        ia.jugada = true;
        ia.tx = azar(-PORTERIA, PORTERIA) * (1.1 - 0.3 * dif);
        ia.banda = Math.random() < 0.15 + 0.25 * dif; // a veces, de rebote en la banda
      }
      if (!direccionTiro()) {
        // Sin sitio para golpearlo (en una esquina): se aparta y espera
        ia.objX = d.x * 0.5;
        ia.objZ = d.z + 0.17;
        ia.rapidez = 1;
        return;
      }
      const dx = ia.dx;
      const dz = ia.dz;
      // ¿Está la maza detrás del disco (del lado de su portería)?
      const rx = maquina.x - d.x;
      const rz = maquina.z - d.z;
      const detras = rx * dx + rz * dz < -(R_DISCO + R_MAZA) * 0.6;
      if (detras) {
        ia.objX = d.x + dx * 0.12;
        ia.objZ = d.z + dz * 0.12;
        ia.rapidez = 1.5 + 1.6 * dif;
      } else {
        // Rodearlo por un lado para ponerse detrás
        const lado = rx * -dz + rz * dx > 0 ? 1 : -1;
        ia.objX = d.x - dx * (R_DISCO + R_MAZA + 0.03) + -dz * lado * 0.05;
        ia.objZ = d.z - dz * (R_DISCO + R_MAZA + 0.03) + dx * lado * 0.05;
        ia.rapidez = 1.1 + 1.2 * dif;
      }
    } else {
      ia.jugada = false;
      // Defender: delante de su portería, donde va a llegar el disco
      const zDef = Z_LEJOS + 0.1;
      ia.objX = (d.vz < -0.1 ? limitar(prediccionX(zDef), -PORTERIA - 0.04, PORTERIA + 0.04) : d.x * 0.45) + ia.error;
      ia.objZ = zDef + (d.vz < -0.1 ? 0 : 0.06);
      ia.rapidez = 1.0 + 1.4 * dif;
    }
  }

  function moverMaquina(dt) {
    maquina.xAntes = maquina.x;
    maquina.zAntes = maquina.z;
    ia.plan -= dt;
    if (ia.plan <= 0) planificar();
    const dif = dificultad();
    const dx = ia.objX - maquina.x;
    const dz = ia.objZ - maquina.z;
    const dist = Math.hypot(dx, dz);
    // Velocidad deseada hacia el objetivo, con aceleración limitada
    const vel = Math.min(ia.rapidez, dist * 9);
    const deseadaX = dist > 1e-4 ? (dx / dist) * vel : 0;
    const deseadaZ = dist > 1e-4 ? (dz / dist) * vel : 0;
    const acel = (9 + 12 * dif) * dt;
    const cx = deseadaX - maquina.vx;
    const cz = deseadaZ - maquina.vz;
    const c = Math.hypot(cx, cz);
    const f = c > acel ? acel / c : 1;
    maquina.vx += cx * f;
    maquina.vz += cz * f;
    maquina.x += maquina.vx * dt;
    maquina.z += maquina.vz * dt;
    limitarMaquina(maquina);
    maquina.vx = (maquina.x - maquina.xAntes) / Math.max(dt, 1e-3);
    maquina.vz = (maquina.z - maquina.zAntes) / Math.max(dt, 1e-3);
  }

  // ─── Disco ─────────────────────────────────────────────────────────────
  function choqueMaza(m, f, quien) {
    const mx = m.xAntes + (m.x - m.xAntes) * f;
    const mz = m.zAntes + (m.z - m.zAntes) * f;
    let nx = d.x - mx;
    let nz = d.z - mz;
    const dist = Math.hypot(nx, nz);
    const minimo = R_DISCO + R_MAZA;
    if (dist >= minimo) return;
    if (dist < 1e-6) {
      nx = 0;
      nz = quien === 'jugador' ? -1 : 1;
    } else {
      nx /= dist;
      nz /= dist;
    }
    // Fuera del alcance de la maza y rebote con su velocidad
    d.x = mx + nx * minimo;
    d.z = mz + nz * minimo;
    // Si las bandas no le dejan sitio al disco (en una esquina, contra la banda), se aparta la maza:
    // si no, se quedarían montados el uno encima del otro
    const x = limitar(d.x, -ANCHO + R_DISCO, ANCHO - R_DISCO);
    const enHueco = Math.abs(x) < PORTERIA - R_DISCO * 0.4;
    const z = enHueco ? d.z : limitar(d.z, Z_LEJOS + R_DISCO, Z_CERCA - R_DISCO);
    const contraX = Math.sign(d.x - x); // banda que lo frena (0 si ninguna)
    const contraZ = Math.sign(d.z - z);
    if (contraX || contraZ) {
      d.x = x;
      d.z = z;
      m.x = d.x - nx * minimo;
      m.z = d.z - nz * minimo;
      if (quien === 'jugador') limitarJugador(m);
      else limitarMaquina(m);
    }
    const mvx = limitar(m.vx, -VEL_MAX_MAZA, VEL_MAX_MAZA);
    const mvz = limitar(m.vz, -VEL_MAX_MAZA, VEL_MAX_MAZA);
    const vn = (d.vx - mvx) * nx + (d.vz - mvz) * nz;
    if (vn >= 0) return;
    d.vx -= (1 + REBOTE_MAZA) * vn * nx;
    d.vz -= (1 + REBOTE_MAZA) * vn * nz;
    // Apretado contra la banda: no puede ir hacia ella, pero sí salir a lo largo de ella
    if (contraX && Math.sign(d.vx) === contraX) d.vx = 0;
    if (contraZ && Math.sign(d.vz) === contraZ) d.vz = 0;
    const v = Math.hypot(d.vx, d.vz);
    if (v > VEL_MAX) {
      d.vx *= VEL_MAX / v;
      d.vz *= VEL_MAX / v;
    }
    if (m.espera > 0) return;
    m.espera = 0.1;
    const fuerza = -vn;
    tmp.set(d.x, MESA_Y + 0.02, d.z);
    if (quien === 'jugador') {
      const mano = indiceMano !== null && ctx.enVR() ? ctx.manos[indiceMano] : null;
      // Respuesta proporcional a lo fuerte que ha sido el golpe
      if (fuerza > 2.4) ctx.efectos.impacto('grande', { pos: tmp, mano, color: 0xff6a3d, sonido: 'clac' });
      else if (fuerza > 1.5) ctx.efectos.impacto('medio', { pos: tmp, mano, color: 0xff6a3d, sonido: 'clac' });
      else if (fuerza > 0.8) ctx.efectos.impacto('pequeño', { pos: tmp, mano, color: 0xffc400, sonido: 'clac' });
      else {
        ctx.sonido('toc');
        if (mano) ctx.vibrar(mano, 0.2, 20);
      }
    } else {
      ctx.sonido(fuerza > 0.8 ? 'clac' : 'toc');
    }
  }

  function moverDisco(dt) {
    if (!d.visible) return;
    const velocidad = Math.hypot(d.vx, d.vz);
    const movMazas = Math.hypot(jugador.x - jugador.xAntes, jugador.z - jugador.zAntes) + Math.hypot(maquina.x - maquina.xAntes, maquina.z - maquina.zAntes);
    const pasos = Math.min(30, Math.max(1, Math.ceil((velocidad * dt + movMazas) / MAX_PASO)));
    const h = dt / pasos;
    const frena = Math.exp(-ROZAMIENTO * h);
    for (let i = 0; i < pasos; i++) {
      d.vx *= frena;
      d.vz *= frena;
      d.x += d.vx * h;
      d.z += d.vz * h;
      // Bandas laterales
      if (d.x < -ANCHO + R_DISCO) {
        d.x = -ANCHO + R_DISCO;
        if (d.vx < 0) {
          d.vx = -d.vx * REBOTE_BANDA;
          banda(d.vx);
        }
      } else if (d.x > ANCHO - R_DISCO) {
        d.x = ANCHO - R_DISCO;
        if (d.vx > 0) {
          d.vx = -d.vx * REBOTE_BANDA;
          banda(d.vx);
        }
      }
      // Fondos: gol si entra por el hueco de la portería
      const enHueco = Math.abs(d.x) < PORTERIA - R_DISCO * 0.4;
      if (d.z > Z_CERCA - R_DISCO) {
        if (enHueco) {
          if (d.z > Z_CERCA + R_DISCO) {
            gol(false);
            return;
          }
        } else {
          d.z = Z_CERCA - R_DISCO;
          if (d.vz > 0) {
            d.vz = -d.vz * REBOTE_BANDA;
            banda(d.vz);
          }
        }
      } else if (d.z < Z_LEJOS + R_DISCO) {
        if (enHueco) {
          if (d.z < Z_LEJOS - R_DISCO) {
            gol(true);
            return;
          }
        } else {
          d.z = Z_LEJOS + R_DISCO;
          if (d.vz < 0) {
            d.vz = -d.vz * REBOTE_BANDA;
            banda(d.vz);
          }
        }
      }
      const f = (i + 1) / pasos;
      choqueMaza(jugador, f, 'jugador');
      choqueMaza(maquina, f, 'maquina');
      // Que ninguna maza lo empuje fuera de la mesa
      if (!enHueco || (d.z > Z_LEJOS + R_DISCO && d.z < Z_CERCA - R_DISCO)) d.z = limitar(d.z, Z_LEJOS + R_DISCO, Z_CERCA - R_DISCO);
      d.x = limitar(d.x, -ANCHO + R_DISCO, ANCHO - R_DISCO);
    }
  }

  function banda(v) {
    if (Math.abs(v) > 0.35 && ruidoBanda <= 0) {
      ctx.sonido('banda');
      ruidoBanda = 0.06;
    }
  }

  // ─── Dibujo ────────────────────────────────────────────────────────────
  function colocar() {
    disco.visible = d.visible;
    disco.position.set(d.x, MESA_Y, d.z);
    sombraDisco.visible = d.visible;
    if (d.visible) ctx.colocarSombra(sombraDisco, disco.position, MESA_Y + 0.001);
    for (const m of MAZAS) {
      m.malla.position.set(m.x, MESA_Y + 0.001, m.z);
      ctx.colocarSombra(m.sombra, m.malla.position, MESA_Y + 0.002);
    }
  }

  function lucesMarcador(dt, t) {
    fiesta = Math.max(0, fiesta - dt);
    if (fiesta > 0) {
      // Las bombillas pares e impares se alternan cambiando de color
      const fase = Math.floor(t * 10) % 2;
      luces[0].material.color.setHSL((t * 0.8) % 1, 1, fase ? 0.65 : 0.2);
      luces[1].material.color.setHSL((t * 0.8 + 0.5) % 1, 1, fase ? 0.2 : 0.65);
    } else {
      luces[0].material.color.setHex(0xffd28a);
      luces[1].material.color.setHex(0xffd28a);
    }
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  let tiempo = 0;
  function actualizar(dt) {
    tiempo += dt;
    reloj -= dt;
    ruidoBanda -= dt;
    jugador.espera = Math.max(0, jugador.espera - dt);
    maquina.espera = Math.max(0, maquina.espera - dt);
    if (estado === 'intro' && reloj <= 0) empezarPartido();
    else if (estado === 'fin' && reloj <= 0) empezarPartido();
    else if (estado === 'gol' && reloj <= 0) {
      estado = 'juego';
      sacar(ultimoGol === 'maquina'); // saca quien ha encajado
      if (ultimoGol === 'jugador') avisar(ctx.t('partida.sacaMaquina'), '#ffab91', 1.2);
    }
    if (estado === 'juego') tiempoPartido += dt;
    if (aviso && (aviso.tiempo -= dt) <= 0) aviso = null;

    moverJugador(dt);
    moverMaquina(dt);
    if (estado === 'juego') moverDisco(dt);
    // ¿Parado? La máquina va a por él sin rodeos y, si sigue atascado (en una esquina, contra una banda),
    // el aire de la mesa lo empuja hacia el centro
    quieto = estado === 'juego' && Math.hypot(d.vx, d.vz) < 0.15 ? quieto + dt : 0;
    if (quieto > (pegado() ? 1.5 : d.z < Z_CENTRO ? 4 : 8)) {
      const dx = -d.x;
      const dz = Z_CENTRO + (d.z < Z_CENTRO ? -0.12 : 0.12) - d.z;
      const n = Math.hypot(dx, dz) || 1;
      d.vx = (dx / n) * 0.6;
      d.vz = (dz / n) * 0.6;
      quieto = 0;
    }
    colocar();
    lucesMarcador(dt, tiempo);
    escribirMarcador();
  }

  // Vista con ratón: desde tu lado de la mesa, un poco por encima
  ctx.vistaEscritorio(new THREE.Vector3(0, 1.5, 0.55), new THREE.Vector3(0, 0.85, -0.85));
  jugador.x = jugador.ex = 0;
  jugador.z = jugador.ez = Z_CERCA - 0.12;
  maquina.x = 0;
  maquina.z = Z_LEJOS + 0.1;
  sacar(true);
  colocar();
  escribirMarcador();

  return {
    actualizar,
    liberar() {
      // La shell retira lo que hay en la escena y en las manos y los recursos registrados.
    },
  };
}
