// TIRAPICHÓN
// La caseta de feria de toda la vida: de una barra cuelgan palillos blancos y de
// cada palillo, con un hilo, un premio. Rompe el palillo de un balinazo y el
// premio cae. Cuanto más fino el palillo, mejor el premio y más puntos.
// No va de reflejos sino de puntería y pulso: 12 balines por partida, sin prisa.
// En VR la escopeta de balines no tiene láser: se apunta por la mira (alza y
// punto de mira). Con el botón lateral de la otra mano se sujeta el cañón para
// apuntar con las dos manos. Con ratón o con el dedo la mira tiembla como un
// pulso de verdad: mantén pulsado para aguantar la respiración y suelta para
// disparar, pero si aguantas demasiado empiezas a temblar.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const BALINES = 12;
const RECARGA = 0.75;          // segundos para partir el cañón y meter otro balín
const RADIO_BALIN = 0.0025;
const Z_BARRA = -2.6;
const Y_BARRA = 2.25;
const LARGO_PALILLO = 0.24;
const LARGO_HILO = 0.24;
const Z_FONDO = -2.95;
const HUECOS = [-1.2, -0.8, -0.4, 0, 0.4, 0.8, 1.2];
const MAX_MARCAS = 40;
// Tipos de palillo: radio, puntos, premio que sujeta y probabilidad de salir
const TIPOS = [
  { radio: 0.014, puntos: 1, premio: 'pelota', prob: 0.4 },
  { radio: 0.0095, puntos: 2, premio: 'caja', prob: 0.35 },
  { radio: 0.006, puntos: 3, premio: 'osito', prob: 0.25 },
];
// Pulso con ratón o dedo (radianes de temblor de la mira)
const PULSO_NORMAL = 0.010;
const PULSO_AGUANTANDO = 0.0012;
const PULSO_CANSADO = 0.022;
const T_CALMA = 0.7;           // lo que tarda en calmarse al aguantar la respiración
const T_AGUANTE = 2.8;         // a partir de aquí empieza a faltar el aire
const T_AHOGO = 5;
const DESVIO_TACTIL = 0.14;    // en el móvil la mira va un poco por encima del dedo

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  ctx.fondo(0x1b2230, { estrellas: 0.8 }); // feria de noche
  const vistaPos = new THREE.Vector3(0, 1.62, 0.3);
  ctx.vistaEscritorio(vistaPos, new THREE.Vector3(0, 1.85, Z_BARRA));

  // Junta varias geometrías ya colocadas en una sola (una llamada de dibujo).
  function fusionar(geos) {
    const partes = geos.map((g) => (g.index ? g.toNonIndexed() : g));
    const total = partes.reduce((n, g) => n + g.attributes.position.count, 0);
    const res = new THREE.BufferGeometry();
    for (const nombre of ['position', 'normal', 'uv']) {
      const tam = partes[0].attributes[nombre].itemSize;
      const datos = new Float32Array(total * tam);
      let o = 0;
      for (const g of partes) {
        datos.set(g.attributes[nombre].array, o);
        o += g.attributes[nombre].array.length;
      }
      res.setAttribute(nombre, new THREE.BufferAttribute(datos, tam));
    }
    for (const g of [...geos, ...partes]) g.dispose();
    return res;
  }

  // ─── Decorado: la caseta ───────────────────────────────────────────────
  ctx.sueloBase(false);
  const suelo = new THREE.Mesh(
    R(new THREE.PlaneGeometry(10, 8).rotateX(-Math.PI / 2)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.grano(0x5d4c3a, { tam: 512, repetir: [6, 5], cantidad: 5000, contraste: 0.22, semilla: 21 })) })),
  );
  suelo.position.set(0, 0, -1.5);
  raiz.add(suelo);

  // Fondo y laterales de tablas pintadas de azul (una malla)
  const ANCHO = 3.4;
  const ALTO = 3.1;
  const PROFUNDO = 1.5;
  const Z_FRENTE = Z_FONDO + PROFUNDO;
  const materialIluminado = (map, brillo) => R(new THREE.MeshLambertMaterial({ map, emissive: 0xffffff, emissiveMap: map, emissiveIntensity: brillo }));
  const fondoCaseta = new THREE.Mesh(
    R(fusionar([
      new THREE.PlaneGeometry(ANCHO, ALTO).translate(0, ALTO / 2, Z_FONDO),
      new THREE.PlaneGeometry(PROFUNDO, ALTO).rotateY(Math.PI / 2).translate(-ANCHO / 2, ALTO / 2, Z_FONDO + PROFUNDO / 2),
      new THREE.PlaneGeometry(PROFUNDO, ALTO).rotateY(-Math.PI / 2).translate(ANCHO / 2, ALTO / 2, Z_FONDO + PROFUNDO / 2),
    ])),
    // Un poco de brillo propio: la caseta está iluminada por dentro
    materialIluminado(R(ctx.texturas.tablas(0x3f78b0, { tablas: 10, repetir: [2, 1], semilla: 22 })), 0.18),
  );
  raiz.add(fondoCaseta);

  // Toldo a rayas por arriba (techo inclinado y faldón con picos)
  const texLona = R(ctx.texturaCanvas((g, tam, azar) => {
    for (let i = 0; i < 2; i++) {
      g.fillStyle = i ? '#f3e6c8' : '#c62828';
      g.fillRect((i * tam) / 2, 0, tam / 2, tam);
    }
    for (let x = 0; x < tam; x += 2) {
      g.fillStyle = `rgba(0,0,0,${0.1 * (0.5 + 0.5 * Math.cos((x / tam) * Math.PI * 2))})`;
      g.fillRect(x, 0, 2, tam);
    }
    for (let i = 0; i < 1200; i++) {
      g.fillStyle = azar() < 0.5 ? 'rgba(255,255,255,0.05)' : 'rgba(0,0,0,0.07)';
      g.fillRect(azar() * tam, azar() * tam, 1, 1 + azar() * 2);
    }
  }, { semilla: 23 }));
  const techo = new THREE.PlaneGeometry(ANCHO + 0.3, PROFUNDO + 0.2).rotateX(Math.PI / 2 + 0.25).translate(0, ALTO + 0.08, Z_FONDO + PROFUNDO / 2);
  const faldon = new THREE.PlaneGeometry(ANCHO + 0.3, 0.35).translate(0, ALTO - 0.22, Z_FRENTE + 0.05);
  for (const [g, ancho] of [[techo, ANCHO + 0.3], [faldon, ANCHO + 0.3]]) {
    const uv = g.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setX(i, uv.getX(i) * ancho / 0.5);
  }
  const matLona = materialIluminado(texLona, 0.35);
  matLona.side = THREE.DoubleSide;
  const toldo = new THREE.Mesh(R(fusionar([techo, faldon])), matLona);
  raiz.add(toldo);

  // Bombillas por el borde del toldo y los postes (una malla instanciada)
  const posBombillas = [];
  for (let x = -ANCHO / 2; x <= ANCHO / 2 + 0.01; x += 0.28) posBombillas.push([x, ALTO - 0.42, Z_FRENTE + 0.07]);
  for (const lado of [-1, 1]) {
    for (let y = 0.9; y < ALTO - 0.5; y += 0.3) posBombillas.push([lado * (ANCHO / 2 + 0.07), y, Z_FRENTE]);
  }
  const bombillas = new THREE.InstancedMesh(
    R(new THREE.SphereGeometry(0.04, 8, 6)),
    R(new THREE.MeshBasicMaterial({ color: 0xffffff, toneMapped: false })),
    posBombillas.length,
  );
  const coloresBombilla = [0xffd54f, 0xff7043, 0xfff3c4, 0x80deea, 0xff8a80];
  const auxObj = new THREE.Object3D();
  const auxColor = new THREE.Color();
  posBombillas.forEach(([x, y, z], i) => {
    auxObj.position.set(x, y, z);
    auxObj.updateMatrix();
    bombillas.setMatrixAt(i, auxObj.matrix);
    bombillas.setColorAt(i, auxColor.setHex(coloresBombilla[i % coloresBombilla.length]));
  });
  raiz.add(bombillas);

  // Mostrador de madera, postes del toldo y la barra de la que cuelgan los palillos
  const mostrador = new THREE.Mesh(
    R(fusionar([
      new THREE.BoxGeometry(ANCHO, 0.9, 0.4).translate(0, 0.45, -0.95),
      new THREE.BoxGeometry(ANCHO + 0.1, 0.06, 0.55).translate(0, 0.93, -0.92),
      new THREE.BoxGeometry(0.1, ALTO, 0.1).translate(-ANCHO / 2, ALTO / 2, Z_FRENTE),
      new THREE.BoxGeometry(0.1, ALTO, 0.1).translate(ANCHO / 2, ALTO / 2, Z_FRENTE),
      new THREE.BoxGeometry(ANCHO, 0.05, 0.4).translate(0, 0.78, Z_FONDO + 0.2),       // balda de peluches
      new THREE.BoxGeometry(ANCHO, 0.8, 0.04).translate(0, 0.4, Z_FONDO + 0.4),
    ])),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.tablas(0x8a5530, { tablas: 6, repetir: [2, 1], semilla: 24 })) })),
  );
  raiz.add(mostrador);

  const barra = new THREE.Mesh(
    R(fusionar([
      new THREE.CylinderGeometry(0.015, 0.015, ANCHO - 0.2, 12).rotateZ(Math.PI / 2).translate(0, Y_BARRA + 0.03, Z_BARRA),
      ...HUECOS.map((x) => new THREE.BoxGeometry(0.03, 0.04, 0.03).translate(x, Y_BARRA + 0.005, Z_BARRA)),
      new THREE.BoxGeometry(0.03, 0.4, 0.03).translate(-(ANCHO - 0.2) / 2, Y_BARRA + 0.23, Z_BARRA),
      new THREE.BoxGeometry(0.03, 0.4, 0.03).translate((ANCHO - 0.2) / 2, Y_BARRA + 0.23, Z_BARRA),
    ])),
    R(new THREE.MeshStandardMaterial({ color: 0x9aa3ab, metalness: 0.8, roughness: 0.35 })),
  );
  raiz.add(barra);

  // ─── Palillos y premios ────────────────────────────────────────────────
  // Cada hueco: un pivote en la pinza (para que se balancee), la mitad de arriba
  // del palillo, y un "colgante" con la mitad de abajo, el hilo y el premio,
  // que es lo que cae al romperse.
  const geosMitad = TIPOS.map((tipo) => R(new THREE.CylinderGeometry(tipo.radio, tipo.radio, LARGO_PALILLO / 2, 10).translate(0, -LARGO_PALILLO / 4, 0)));
  const matPalillo = R(new THREE.MeshStandardMaterial({ color: 0xf5f1e8, metalness: 0, roughness: 0.25 }));
  const geoHilo = R(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, -LARGO_HILO, 0)]));
  const matHilo = R(new THREE.LineBasicMaterial({ color: 0xeeeeee }));

  // Premios: el origen es el punto del que cuelgan (arriba)
  const esfera = (r, x, y, z) => new THREE.SphereGeometry(r, 12, 9).translate(x, y, z);
  const E = 1.35; // los premios de feria se ven de lejos
  const PREMIOS = {
    pelota: { geo: R(esfera(0.055, 0, -0.055, 0).scale(E, E, E)), centro: -0.055 * E, radio: 0.056 * E },
    caja: { geo: R(new THREE.BoxGeometry(0.12, 0.1, 0.12).translate(0, -0.05, 0).scale(E, E, E)), centro: -0.05 * E, radio: 0.075 * E },
    osito: {
      geo: R(fusionar([
        esfera(0.045, 0, -0.045, 0),                                   // cabeza
        esfera(0.016, -0.033, -0.012, 0), esfera(0.016, 0.033, -0.012, 0), // orejas
        esfera(0.019, 0, -0.055, 0.038),                               // hocico
        esfera(0.058, 0, -0.13, 0),                                    // cuerpo
        esfera(0.022, -0.06, -0.11, 0.01), esfera(0.022, 0.06, -0.11, 0.01), // brazos
        esfera(0.025, -0.035, -0.18, 0.025), esfera(0.025, 0.035, -0.18, 0.025), // patas
      ]).scale(E, E, E)),
      centro: -0.1 * E,
      radio: 0.09 * E,
    },
  };
  const texRegalo = R(ctx.texturaCanvas((g, tam) => {
    g.fillStyle = '#d81b60';
    g.fillRect(0, 0, tam, tam);
    g.fillStyle = 'rgba(255,255,255,0.18)';
    for (let i = 0; i < 6; i++) for (let j = 0; j < 6; j++) {
      g.beginPath();
      g.arc((i + 0.5) * tam / 6, (j + 0.5) * tam / 6, tam * 0.025, 0, Math.PI * 2);
      g.fill();
    }
    g.fillStyle = '#ffd54f';
    g.fillRect(tam * 0.44, 0, tam * 0.12, tam);
    g.fillRect(0, tam * 0.44, tam, tam * 0.12);
  }, { semilla: 25 }));
  const MATERIALES_PREMIO = {
    pelota: [0x1e88e5, 0xfdd835, 0x43a047, 0xe53935].map((c) => R(new THREE.MeshStandardMaterial({ color: c, metalness: 0, roughness: 0.35 }))),
    caja: [R(new THREE.MeshLambertMaterial({ map: texRegalo }))],
    osito: [0x8d6e63, 0xf48fb1, 0x90caf9, 0xffcc80].map((c) => R(new THREE.MeshLambertMaterial({ color: c }))),
  };

  // Peluches grandes de adorno en la balda del fondo (los premios gordos)
  [[-1.25, 0x8d6e63], [-0.6, 0xf48fb1], [0.05, 0x90caf9], [0.7, 0xffcc80], [1.3, 0xce93d8]].forEach(([x, color], i) => {
    const peluche = new THREE.Mesh(PREMIOS.osito.geo, i % 2 ? MATERIALES_PREMIO.osito[i % 4] : R(new THREE.MeshLambertMaterial({ color })));
    peluche.scale.setScalar(1.7);
    peluche.position.set(x, 0.805 + 0.2 * E * 1.7, Z_FONDO + 0.2);
    peluche.rotation.y = (Math.random() - 0.5) * 0.6;
    raiz.add(peluche);
  });

  const huecos = HUECOS.map((x, i) => {
    const pivote = new THREE.Group();
    pivote.position.set(x, Y_BARRA, Z_BARRA);
    raiz.add(pivote);
    const arriba = new THREE.Mesh(geosMitad[0], matPalillo);
    pivote.add(arriba);
    const colgante = new THREE.Group();
    colgante.position.y = -LARGO_PALILLO / 2;
    const abajo = new THREE.Mesh(geosMitad[0], matPalillo);
    const hilo = new THREE.Line(geoHilo, matHilo);
    hilo.position.y = -LARGO_PALILLO / 2;
    const premio = new THREE.Mesh(PREMIOS.pelota.geo, MATERIALES_PREMIO.pelota[0]);
    premio.position.y = -LARGO_PALILLO / 2 - LARGO_HILO;
    colgante.add(abajo, hilo, premio);
    pivote.add(colgante);
    const sombra = ctx.crearSombra({ radio: 0.08, opacidad: 0.35 });
    sombra.visible = false;
    raiz.add(sombra);
    return {
      i, x, pivote, arriba, colgante, abajo, premio, sombra,
      tipo: TIPOS[0], estado: 'colgado', t: 0,
      vaiven: 0, vaivenBase: 0, fase: Math.random() * Math.PI * 2,
      vel: new THREE.Vector3(), velGiro: new THREE.Vector3(),
    };
  });

  function elegirTipo() {
    let r = Math.random();
    for (const tipo of TIPOS) {
      if ((r -= tipo.prob) <= 0) return tipo;
    }
    return TIPOS[0];
  }

  // Cuelga un palillo nuevo con su premio (aparece creciendo)
  function reponer(h, conVaiven) {
    h.tipo = elegirTipo();
    const g = geosMitad[TIPOS.indexOf(h.tipo)];
    h.arriba.geometry = g;
    h.abajo.geometry = g;
    const premio = PREMIOS[h.tipo.premio];
    const mats = MATERIALES_PREMIO[h.tipo.premio];
    h.premio.geometry = premio.geo;
    h.premio.material = mats[Math.floor(Math.random() * mats.length)];
    if (h.colgante.parent !== h.pivote) {
      raiz.remove(h.colgante);
      h.pivote.add(h.colgante);
    }
    h.colgante.position.set(0, -LARGO_PALILLO / 2, 0);
    h.colgante.rotation.set(0, 0, 0);
    h.premio.rotation.set(0, Math.random() * Math.PI * 2, 0);
    h.arriba.visible = true;
    h.sombra.visible = false;
    h.vaivenBase = conVaiven ? 0.04 + Math.random() * 0.06 : 0;
    h.vaiven = h.vaivenBase;
    h.estado = 'apareciendo';
    h.t = 0;
  }

  // ─── Marcas de los balines en el fondo y trocitos de palillo ───────────
  const marcas = new THREE.InstancedMesh(
    R(new THREE.CircleGeometry(0.007, 10)),
    R(new THREE.MeshBasicMaterial({ color: 0x14100c })),
    MAX_MARCAS,
  );
  marcas.count = 0;
  raiz.add(marcas);
  let siguienteMarca = 0;
  function marcar(punto) {
    auxObj.position.set(punto.x, punto.y, Z_FONDO + 0.004);
    auxObj.rotation.set(0, 0, Math.random() * 6);
    auxObj.scale.setScalar(0.8 + Math.random() * 0.5);
    auxObj.updateMatrix();
    marcas.setMatrixAt(siguienteMarca, auxObj.matrix);
    siguienteMarca = (siguienteMarca + 1) % MAX_MARCAS;
    marcas.count = Math.min(MAX_MARCAS, marcas.count + 1);
    marcas.instanceMatrix.needsUpdate = true;
  }

  const geoTrozo = R(new THREE.TetrahedronGeometry(0.008));
  const matPolvo = R(new THREE.MeshBasicMaterial({ color: 0xbfa98a }));
  const particulas = [];
  function trozos(punto, material, n, fuerza) {
    for (let i = 0; i < n; i++) {
      const p = new THREE.Mesh(geoTrozo, material);
      p.position.copy(punto);
      const vel = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.8, Math.random() * 0.6).multiplyScalar(fuerza);
      raiz.add(p);
      particulas.push({ malla: p, vel, vida: 0.6 });
    }
  }

  // ─── Escopeta de balines ───────────────────────────────────────────────
  // Origen en la empuñadura; el cañón mira a -Z. La línea de mira (alza →
  // punto de mira) es paralela al eje y es por donde sale el balín.
  const Y_MIRA = 0.073;
  const geoMadera = R(fusionar([
    new THREE.BoxGeometry(0.038, 0.085, 0.34).translate(0, -0.015, 0.2),     // culata
    new THREE.BoxGeometry(0.042, 0.11, 0.05).translate(0, -0.03, 0.38),      // cantonera
    new THREE.BoxGeometry(0.032, 0.09, 0.05).rotateX(-0.3).translate(0, -0.035, 0.02), // empuñadura
    new THREE.BoxGeometry(0.04, 0.04, 0.24).translate(0, 0.018, -0.17),      // guardamanos
  ]));
  const geoCuerpo = R(fusionar([
    new THREE.CylinderGeometry(0.015, 0.015, 0.2, 12).rotateX(Math.PI / 2).translate(0, 0.045, -0.02),
    new THREE.BoxGeometry(0.004, 0.012, 0.012).translate(-0.006, Y_MIRA - 0.005, 0.03), // alza (dos orejas
    new THREE.BoxGeometry(0.004, 0.012, 0.012).translate(0.006, Y_MIRA - 0.005, 0.03),  // con la muesca)
    new THREE.BoxGeometry(0.012, 0.012, 0.012).translate(0, Y_MIRA - 0.012, 0.03),
    new THREE.TorusGeometry(0.02, 0.003, 6, 12, Math.PI).rotateY(Math.PI / 2).rotateX(Math.PI).translate(0, 0.0, 0.015), // guardamonte
  ]));
  const geoCanon = R(fusionar([
    new THREE.CylinderGeometry(0.009, 0.01, 0.46, 12).rotateX(Math.PI / 2).translate(0, 0, -0.23),
    new THREE.BoxGeometry(0.004, 0.02, 0.008).translate(0, 0.016, -0.44),
  ]));
  const geoPunto = R(new THREE.SphereGeometry(0.0035, 8, 6).translate(0, Y_MIRA - 0.045, -0.44));
  const matMadera = R(new THREE.MeshStandardMaterial({ color: 0x7a4a2a, metalness: 0, roughness: 0.55 }));
  const matMetal = R(new THREE.MeshStandardMaterial({ color: 0x30363c, metalness: 0.85, roughness: 0.3 }));
  const matPunto = R(new THREE.MeshBasicMaterial({ color: 0xff6d00, toneMapped: false }));
  const geoFogonazo = R(new THREE.SphereGeometry(0.02, 8, 6));
  const matFogonazo = R(new THREE.MeshBasicMaterial({ color: 0xfff3c4 }));

  function crearEscopeta() {
    const arma = new THREE.Group();
    const bisagra = new THREE.Group();
    bisagra.position.set(0, 0.045, -0.12);
    const canon = new THREE.Mesh(geoCanon, matMetal);
    const punto = new THREE.Mesh(geoPunto, matPunto);
    const fogonazo = new THREE.Mesh(geoFogonazo, matFogonazo);
    fogonazo.position.set(0, 0, -0.47);
    fogonazo.visible = false;
    bisagra.add(canon, punto, fogonazo);
    arma.add(new THREE.Mesh(geoMadera, matMadera), new THREE.Mesh(geoCuerpo, matMetal), bisagra);
    return { arma, bisagra, fogonazo };
  }

  // En VR la escopeta va en un soporte girado como la pistola de la Galería de
  // Tiro: con el mando recto, el cañón apunta al frente.
  const escopeta = crearEscopeta();
  const soporte = new THREE.Group();
  soporte.rotation.x = -Math.PI / 2;
  soporte.add(escopeta.arma);
  soporte.visible = false;
  let manoArma = null;
  let ladoArma = 'right';

  // Escopeta de la vista con ratón (con su mira en pantalla)
  const escopetaRaton = crearEscopeta();
  const pivoteRaton = new THREE.Group();
  pivoteRaton.add(escopetaRaton.arma);
  pivoteRaton.position.copy(vistaPos).add(new THREE.Vector3(0.16, -0.24, -0.32));
  raiz.add(pivoteRaton);
  const matMira = R(new THREE.MeshBasicMaterial({ color: 0xffffff, transparent: true, opacity: 0.9, depthTest: false, toneMapped: false }));
  const mira = new THREE.Mesh(
    R(fusionar([
      new THREE.RingGeometry(0.012, 0.0145, 24),
      new THREE.PlaneGeometry(0.0025, 0.0025),
      new THREE.PlaneGeometry(0.014, 0.0012).translate(-0.022, 0, 0),
      new THREE.PlaneGeometry(0.014, 0.0012).translate(0.022, 0, 0),
      new THREE.PlaneGeometry(0.0012, 0.014).translate(0, -0.022, 0),
    ])),
    matMira,
  );
  mira.renderOrder = 10;
  raiz.add(mira);

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.7, alto: 0.42 });
  marcador.mesh.position.set(0, 2.72, Z_FONDO + 0.05);
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  let puntos = 0;
  let premios = 0;
  let balines = BALINES;
  let record = ctx.leer('record', 0);
  let nuevoRecord = false;
  let estado = 'intro'; // 'intro' | 'jugando' | 'fin'
  let reloj = 4;
  let recarga = 0;
  let mensaje = '';
  let tiempoMensaje = 0;
  let colorMensaje = '#fff59d';
  // Ratón y dedo
  let pulsadoAntes = false;
  let tiempoAguante = 0;
  let avisoTemblor = false;
  const desvio = { x: 0, y: 0 };
  const ndc = new THREE.Vector2();
  const rayoRaton = new THREE.Raycaster();

  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const tmp3 = new THREE.Vector3();
  const origenTiro = new THREE.Vector3();
  const dirTiro = new THREE.Vector3();
  const qMundo = new THREE.Quaternion();
  const qMano = new THREE.Quaternion();
  const mAux = new THREE.Matrix4();
  const ARRIBA = new THREE.Vector3(0, 1, 0);
  const CERO = new THREE.Vector3();
  const Q_SOPORTE = new THREE.Quaternion().setFromEuler(new THREE.Euler(-Math.PI / 2, 0, 0));

  function avisar(texto, color = '#fff59d', duracion = 1.4) {
    mensaje = texto;
    colorMensaje = color;
    tiempoMensaje = duracion;
  }

  function actualizarMarcador() {
    if (estado === 'intro') {
      marcador.escribir([
        { texto: ctx.t('titulo'), tam: 1.3, color: '#ffcc80' },
        { texto: ctx.t(ctx.enVR() ? 'introVR' : ctx.tactil ? 'introTactil' : 'introRaton'), tam: 0.62 },
      ]);
    } else if (estado === 'fin') {
      marcador.escribir([
        { texto: nuevoRecord ? ctx.t('partida.nuevoRecord') : ctx.t('partida.finPuntos', { n: puntos }), tam: 1.3, color: '#ffcc80' },
        { texto: ctx.t('resumen', { n: premios, record, otra: Math.max(1, Math.ceil(reloj)) }), tam: 0.7 },
      ]);
    } else {
      marcador.escribir([
        { texto: ctx.t('marcador', { puntos, balines }), tam: 1.2 },
        tiempoMensaje > 0
          ? { texto: mensaje, tam: 0.75, color: colorMensaje }
          : { texto: ctx.t('reglas', { record }), tam: 0.75, color: '#ffcc80' },
      ]);
    }
  }

  function empezar() {
    estado = 'jugando';
    puntos = 0;
    premios = 0;
    balines = BALINES;
    nuevoRecord = false;
    recarga = 0;
    for (const h of huecos) reponer(h, Math.random() < 0.3);
  }

  // Distancia mínima entre el rayo del balín (dir unitaria) y el eje de un palillo (a-b).
  // Devuelve { d, t, punto } (t: distancia a lo largo del rayo) o null si queda detrás.
  function rayoContraSegmento(o, dir, a, b) {
    const u = new THREE.Vector3().subVectors(b, a);
    const w = new THREE.Vector3().subVectors(o, a);
    const uu = u.dot(u);
    const ud = u.dot(dir);
    const uw = u.dot(w);
    const dw = dir.dot(w);
    const den = uu - ud * ud;
    const s = Math.min(1, Math.max(0, den > 1e-9 ? (uw - dw * ud) / den : 0));
    const t = s * ud - dw;
    if (t <= 0) return null;
    const punto = a.clone().addScaledVector(u, s);
    const d = o.clone().addScaledVector(dir, t).distanceTo(punto);
    return { d, t, punto };
  }

  function disparar(origen, direccion, mano) {
    if (estado !== 'jugando' || balines <= 0 || recarga > 0) return;
    balines -= 1;
    recarga = RECARGA;
    ctx.sonido('disparo');
    if (mano) ctx.vibrar(mano, 0.7, 45);
    raiz.updateMatrixWorld();

    // ¿Qué es lo primero que toca el balín?
    let mejor = null;
    let casi = Infinity;
    const a = new THREE.Vector3();
    const b = new THREE.Vector3();
    for (const h of huecos) {
      if (h.estado !== 'colgado' && h.estado !== 'apareciendo') continue;
      h.pivote.localToWorld(a.set(0, 0, 0));
      h.pivote.localToWorld(b.set(0, -LARGO_PALILLO, 0));
      const r = rayoContraSegmento(origen, direccion, a, b);
      if (r) {
        const holgura = h.tipo.radio + RADIO_BALIN;
        if (r.d <= holgura && (!mejor || r.t < mejor.t)) mejor = { tipo: 'palillo', h, t: r.t, punto: r.punto };
        else casi = Math.min(casi, r.d - holgura);
      }
      // El premio, como una esfera
      const premio = PREMIOS[h.tipo.premio];
      const centro = h.premio.localToWorld(a.set(0, premio.centro, 0));
      const oc = tmp.copy(centro).sub(origen);
      const tc = oc.dot(direccion);
      if (tc > 0) {
        const d2 = oc.lengthSq() - tc * tc;
        const r2 = premio.radio * premio.radio;
        if (d2 < r2) {
          const t = tc - Math.sqrt(r2 - d2);
          if (!mejor || t < mejor.t) mejor = { tipo: 'premio', h, t, punto: origen.clone().addScaledVector(direccion, t) };
        }
      }
    }

    if (mejor?.tipo === 'palillo') {
      romper(mejor.h, mejor.punto, direccion);
    } else if (mejor?.tipo === 'premio') {
      // El balín rebota en el premio: se balancea, pero no cae
      mejor.h.vaiven = Math.min(0.2, mejor.h.vaiven + 0.08);
      ctx.sonido('toc');
      avisar(ctx.t('alPremio'), '#ffab91');
    } else {
      // Al fondo: deja la marca para corregir el siguiente tiro
      if (direccion.z < -1e-3) {
        const t = (Z_FONDO - origen.z) / direccion.z;
        const p = origen.clone().addScaledVector(direccion, t);
        if (Math.abs(p.x) < ANCHO / 2 && p.y > 0 && p.y < ALTO) {
          marcar(p);
          trozos(p, matPolvo, 4, 0.6);
          ctx.sonido('grava');
        }
      }
      if (casi < 0.012) avisar(ctx.t('rozando'), '#fff59d', 1);
    }
  }

  function romper(h, punto, direccion) {
    // El colgante pasa a la raíz en su posición actual y cae
    h.colgante.updateMatrixWorld();
    h.colgante.getWorldPosition(tmp);
    h.colgante.getWorldQuaternion(qMundo);
    h.pivote.remove(h.colgante);
    raiz.add(h.colgante);
    h.colgante.position.copy(tmp);
    h.colgante.quaternion.copy(qMundo);
    h.vel.set(direccion.x * 0.6, 0.3, direccion.z * 0.3);
    h.velGiro.set((Math.random() - 0.5) * 3, (Math.random() - 0.5) * 4, (Math.random() - 0.5) * 3);
    h.estado = 'cayendo';
    h.t = 0;
    h.sombra.visible = true;
    puntos += h.tipo.puntos;
    premios += 1;
    trozos(punto, matPalillo, 7, 1.2);
    ctx.sonido('clac');
    ctx.sonido('punto');
    ctx.efectos.impacto(h.tipo.puntos >= 3 ? 'grande' : 'medio', { pos: punto, color: 0xffd54f });
    ctx.efectos.texto(punto, `+${h.tipo.puntos}`, { color: '#b9f6ca', tam: 1.2 });
    avisar(ctx.t('premio', { n: h.tipo.puntos }), '#b9f6ca');
  }

  function actualizarHueco(h, dt, t) {
    h.t += dt;
    switch (h.estado) {
      case 'apareciendo': {
        const f = Math.min(1, h.t / 0.35);
        const e = 1 - (1 - f) * (1 - f);
        h.arriba.scale.setScalar(e);
        h.colgante.scale.setScalar(e);
        if (f >= 1) h.estado = 'colgado';
        break;
      }
      case 'cayendo': {
        const c = h.colgante;
        h.vel.y -= 9.8 * dt;
        c.position.addScaledVector(h.vel, dt);
        c.rotation.x += h.velGiro.x * dt;
        c.rotation.y += h.velGiro.y * dt;
        c.rotation.z += h.velGiro.z * dt;
        const suelo = 0.1;
        if (c.position.y < suelo) {
          c.position.y = suelo;
          if (Math.abs(h.vel.y) > 0.6) {
            h.vel.y *= -0.3;
            h.vel.x *= 0.5;
            h.vel.z *= 0.5;
            h.velGiro.multiplyScalar(0.4);
            ctx.sonido('bote');
          } else {
            h.vel.set(0, 0, 0);
            h.velGiro.set(0, 0, 0);
            h.estado = 'en suelo';
            h.t = 0;
          }
        }
        ctx.colocarSombra(h.sombra, c.position, 0.005);
        break;
      }
      case 'en suelo': {
        const f = Math.max(0, (h.t - 0.8) / 0.3);
        h.colgante.scale.setScalar(Math.max(0.001, 1 - f));
        h.sombra.visible = f < 1;
        if (f >= 1) reponer(h, Math.random() < 0.35 + (1 - balines / BALINES) * 0.4);
        break;
      }
      default:
        break;
    }
    // Vaivén suave en el pivote (péndulo de ~0,5 m); el golpe en el premio se va calmando
    h.vaiven = Math.max(h.vaivenBase, h.vaiven - dt * 0.03);
    h.pivote.rotation.z = Math.sin(t * 4.4 + h.fase) * h.vaiven;
    h.pivote.rotation.x = Math.sin(t * 3.1 + h.fase * 1.7) * h.vaiven * 0.4;
  }

  // ─── Disparo en VR ─────────────────────────────────────────────────────
  function apuntarVR() {
    const activas = ctx.manos.filter((m) => m.activa);
    // La escopeta va en la mano que aprieta el gatillo (sin estar sujetando el cañón)
    for (const m of activas) {
      if (m.gatilloPulsado && m.lado && m.lado !== ladoArma && !m.apreton) {
        ladoArma = m.lado;
        manoArma = null;
      }
    }
    const mano = activas.find((m) => m.lado === ladoArma) || activas[0] || null;
    if (mano !== manoArma) {
      if (soporte.parent) soporte.parent.remove(soporte);
      if (mano) ctx.adjuntarAMano(mano, soporte);
      manoArma = mano;
    }
    soporte.visible = !!mano;
    if (!mano) return;

    // Con la otra mano sujetando el cañón (botón lateral cerca del guardamanos),
    // la escopeta apunta de una mano a la otra, como una de verdad.
    const apoyo = activas.find((m) => m !== mano && m.apreton);
    soporte.updateMatrixWorld();
    let dosManos = false;
    if (apoyo) {
      const guardamanos = escopeta.arma.localToWorld(tmp.set(0, 0, -0.2));
      if (guardamanos.distanceTo(apoyo.posicion) < 0.3) {
        dosManos = true;
        const dir = tmp2.copy(apoyo.posicion).sub(mano.posicion).normalize();
        mAux.lookAt(CERO, dir, ARRIBA); // -Z del soporte hacia la otra mano
        qMundo.setFromRotationMatrix(mAux);
        mano.grip.getWorldQuaternion(qMano).invert();
        soporte.quaternion.copy(qMano.multiply(qMundo));
      }
    }
    if (!dosManos) soporte.quaternion.copy(Q_SOPORTE);
    soporte.updateMatrixWorld();

    if (mano.gatilloPulsado) {
      soporte.localToWorld(origenTiro.set(0, Y_MIRA, 0.03));
      dirTiro.set(0, 0, -1).transformDirection(soporte.matrixWorld);
      if (estado === 'jugando' && recarga <= 0 && balines > 0) {
        escopeta.fogonazo.visible = true;
        disparar(origenTiro, dirTiro, mano);
      } else if (balines <= 0 || recarga > 0) {
        ctx.sonido('tic');
      }
    }
  }

  // ─── Disparo con ratón o dedo ──────────────────────────────────────────
  // La mira tiembla con varias ondas mezcladas. Al mantener pulsado se aguanta
  // la respiración: el temblor baja casi a nada, pero si se aguanta demasiado
  // vuelve, y más fuerte.
  function pulsoActual() {
    if (!ctx.raton.pulsado) return PULSO_NORMAL;
    const tp = tiempoAguante;
    if (tp < T_CALMA) {
      const f = tp / T_CALMA;
      const e = f * f * (3 - 2 * f);
      return PULSO_NORMAL + (PULSO_AGUANTANDO - PULSO_NORMAL) * e;
    }
    if (tp < T_AGUANTE) return PULSO_AGUANTANDO;
    const f = Math.min(1, (tp - T_AGUANTE) / (T_AHOGO - T_AGUANTE));
    return PULSO_AGUANTANDO + (PULSO_CANSADO - PULSO_AGUANTANDO) * f;
  }

  function apuntarRaton(dt, t) {
    const raton = ctx.raton;
    const pulsado = raton.pulsado;
    if (pulsado) tiempoAguante += dt;

    const amp = pulsoActual();
    desvio.x = amp * (Math.sin(t * 1.3) * 0.6 + Math.sin(t * 3.7 + 1) * 0.3 + Math.sin(t * 8.9 + 2) * 0.1);
    desvio.y = amp * (Math.sin(t * 1.1 + 0.5) * 0.6 + Math.sin(t * 4.3 + 2.5) * 0.3 + Math.sin(t * 9.7) * 0.1);

    ndc.copy(raton.ndc);
    if (ctx.tactil) ndc.y += DESVIO_TACTIL;
    rayoRaton.setFromCamera(ndc, ctx.camara);
    const dir = dirTiro.copy(rayoRaton.ray.direction);
    // Gira la dirección un poco (horizontal y vertical) según el temblor
    const derecha = tmp.crossVectors(dir, ARRIBA).normalize();
    const arriba = tmp2.crossVectors(derecha, dir).normalize();
    dir.addScaledVector(derecha, desvio.x).addScaledVector(arriba, desvio.y).normalize();
    origenTiro.copy(rayoRaton.ray.origin);

    // Mira a 1,2 m en la línea de tiro; color según el pulso
    mira.position.copy(origenTiro).addScaledVector(dir, 1.2);
    mira.quaternion.copy(ctx.camara.quaternion);
    mira.visible = raton.dentro || ctx.tactil;
    const firme = pulsado && amp <= PULSO_AGUANTANDO * 1.6;
    const tiembla = pulsado && tiempoAguante > T_AGUANTE;
    matMira.color.setHex(tiembla ? 0xff5252 : firme ? 0x69f0ae : 0xffffff);
    if (tiembla && !avisoTemblor) {
      avisoTemblor = true;
      avisar(ctx.t('tiembla'), '#ff8a80', 1.2);
    }

    // La escopeta apunta adonde va la mira
    pivoteRaton.visible = mira.visible;
    const objetivo = tmp3.copy(origenTiro).addScaledVector(dir, 10);
    pivoteRaton.lookAt(tmp.copy(pivoteRaton.position).multiplyScalar(2).sub(objetivo));

    // Se dispara al soltar
    if (pulsadoAntes && !pulsado) {
      if (estado === 'jugando' && recarga <= 0 && balines > 0) {
        escopetaRaton.fogonazo.visible = true;
        disparar(origenTiro, dir.clone(), null);
      }
    }
    if (!pulsado) {
      tiempoAguante = 0;
      avisoTemblor = false;
    }
    pulsadoAntes = pulsado;
  }

  // Animación del cañón: retroceso, se parte para recargar y se cierra
  function animarEscopeta(e) {
    const f = recarga > 0 ? 1 - recarga / RECARGA : 1;
    // 0-0,15: retroceso · 0,25-0,75: abierto · 0,85: cierra con un clac
    const abierto = f < 0.2 ? 0 : f < 0.4 ? (f - 0.2) / 0.2 : f < 0.75 ? 1 : f < 0.9 ? 1 - (f - 0.75) / 0.15 : 0;
    e.bisagra.rotation.x = -abierto * 0.55;
    e.arma.rotation.x = f < 0.2 ? Math.sin((f / 0.2) * Math.PI) * 0.12 : 0;
    if (f > 0.08) e.fogonazo.visible = false;
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  for (const h of huecos) reponer(h, false);

  function actualizar(dt, t) {
    reloj -= dt;
    tiempoMensaje -= dt;
    const recargaAntes = recarga;
    recarga = Math.max(0, recarga - dt);
    if (recargaAntes > RECARGA * 0.12 && recarga <= RECARGA * 0.12 && balines > 0) ctx.sonido('clac');

    if (estado === 'intro' && reloj <= 0) {
      empezar();
    } else if (estado === 'jugando' && balines <= 0 && recarga <= 0 && !huecos.some((h) => h.estado === 'cayendo')) {
      estado = 'fin';
      reloj = 7;
      ctx.puntuacion(puntos); // a la clasificación (juegos/marcadores.js)
      if (puntos > record) {
        record = puntos;
        nuevoRecord = puntos > 0;
        ctx.guardar('record', record);
      }
      ctx.sonido('fin');
    } else if (estado === 'fin' && reloj <= 0) {
      empezar();
    }

    for (const h of huecos) actualizarHueco(h, dt, t);
    raiz.updateMatrixWorld();

    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      p.vida -= dt;
      p.vel.y -= 6 * dt;
      p.malla.position.addScaledVector(p.vel, dt);
      p.malla.scale.setScalar(Math.max(0.01, p.vida / 0.6));
      if (p.vida <= 0) {
        raiz.remove(p.malla);
        particulas.splice(i, 1);
      }
    }

    if (ctx.enVR()) {
      pivoteRaton.visible = false;
      mira.visible = false;
      apuntarVR();
      animarEscopeta(escopeta);
    } else {
      soporte.visible = false;
      apuntarRaton(dt, t);
      animarEscopeta(escopetaRaton);
    }

    actualizarMarcador();
  }

  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      particulas.length = 0;
      bombillas.dispose();
      marcas.dispose();
    },
  };
}
