// CAZA DE PATOS (con arco)
// Los patos cruzan el cielo sobre el estanque. En VR sujetas el arco con una
// mano, agarras la cuerda con la otra (gatillo), tensas y sueltas. Sin gafas:
// mantén pulsado el ratón para tensar y suelta para disparar.
// Rondas de 60 segundos.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const DURACION = 60;
const GRAVEDAD = 4;           // más suave que la real para que sea divertido
const LARGO_FLECHA = 0.75;
const CUERDA_Z = 0.09;        // la cuerda en reposo, por detrás del puño del arco
const ALCANCE_AGARRE = 0.25;  // distancia a la cuerda para poder agarrarla
const TENSION_MAX = 0.6;      // metros de tensado para la potencia máxima
const RADIO_PATO = 0.38;
const LIMITE_X = 20;

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  ctx.fondo(0x8ec5e8);
  // Los patos vuelan lejos: alejamos la niebla mientras dura este juego
  const niebla = ctx.escena.fog;
  const nieblaOriginal = { near: niebla.near, far: niebla.far };
  niebla.near = 30;
  niebla.far = 70;

  const vistaPos = new THREE.Vector3(0, 1.6, 0.4);
  ctx.vistaEscritorio(vistaPos, new THREE.Vector3(0, 3, -12));

  // ─── Estanque y juncos ─────────────────────────────────────────────────
  ctx.sueloBase(false); // la orilla de césped sustituye al suelo de la shell
  const Y_AGUA = 0.012;
  const escalarUV = (geo, u, v = u) => {
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * u, uv.getY(i) * v);
    return geo;
  };
  const plano = (geo, mat, x, y, z) => {
    const m = new THREE.Mesh(geo, mat);
    m.rotation.x = -Math.PI / 2;
    m.position.set(x, y, z);
    raiz.add(m);
    return m;
  };

  // Prado alrededor del estanque (una sola malla grande con césped en mosaico de 3 m)
  const texPrado = R(ctx.texturas.cesped(0x5d9e45, { semilla: 4 }));
  plano(escalarUV(R(new THREE.PlaneGeometry(200, 200)), 200 / 3), R(new THREE.MeshLambertMaterial({ map: texPrado })), 0, 0, -30);
  // Orilla de barro, un poco mayor que el agua
  const texBarro = R(ctx.texturas.grano(0x5a5236, { cantidad: 1500, contraste: 0.16, semilla: 9 }));
  plano(escalarUV(R(new THREE.PlaneGeometry(61, 35)), 61 / 2, 35 / 2), R(new THREE.MeshLambertMaterial({ map: texBarro })), 0, 0.006, -21);

  // Agua: MeshStandard poco rugoso (refleja el cielo del mapa de entorno) con un
  // mapa de normales procedural de ondas que se desplaza poco a poco.
  const texOndas = R(ctx.texturaCanvas((g, tam) => {
    const datos = g.createImageData(tam, tam);
    // [frecuencia x, frecuencia y, amplitud, fase]: muchas direcciones para que no se note el mosaico
    const ondas = [[2, 1, 0.45, 0], [-1, 3, 0.4, 1.3], [4, -3, 0.22, 2.1], [-5, 2, 0.2, 0.4], [3, 6, 0.14, 3.3],
      [7, 1, 0.1, 5.1], [-6, -5, 0.08, 2.7], [1, -9, 0.07, 4.2], [11, 6, 0.05, 1.7], [-9, 10, 0.04, 0.9]];
    const k = (Math.PI * 2) / tam;
    for (let y = 0; y < tam; y++) {
      for (let x = 0; x < tam; x++) {
        // Derivadas de la altura (suma de senos con frecuencias enteras: mosaico perfecto)
        let dx = 0;
        let dy = 0;
        for (const [fx, fy, amp, fase] of ondas) {
          const c = Math.cos((fx * x + fy * y) * k + fase) * amp;
          dx += c * fx;
          dy += c * fy;
        }
        const nx = -dx * 0.09;
        const ny = -dy * 0.09;
        const l = Math.hypot(nx, ny, 1);
        const i = (y * tam + x) * 4;
        datos.data[i] = (nx / l * 0.5 + 0.5) * 255;
        datos.data[i + 1] = (ny / l * 0.5 + 0.5) * 255;
        datos.data[i + 2] = (1 / l * 0.5 + 0.5) * 255;
        datos.data[i + 3] = 255;
      }
    }
    g.putImageData(datos, 0, 0);
  }, { tam: 256, repetir: [60 / 7, 34 / 7], color: false }));
  const matAgua = R(new THREE.MeshStandardMaterial({
    color: 0x2a6f93, roughness: 0.12, metalness: 0.15,
    normalMap: texOndas, normalScale: new THREE.Vector2(0.3, 0.3),
  }));
  plano(R(new THREE.PlaneGeometry(60, 34)), matAgua, 0, Y_AGUA, -21);

  // Tarima de madera bajo el jugador
  const texTarima = R(ctx.texturas.tablas(0xa7794a, { tablas: 8, semilla: 2 }));
  texTarima.repeat.set(2.6 / 1.2, 2.4 / 1.2); // tablas de 15 cm
  const tarima = new THREE.Mesh(R(new THREE.BoxGeometry(2.6, 0.1, 2.4)), R(new THREE.MeshLambertMaterial({ map: texTarima })));
  tarima.position.set(0, -0.03, 0.2);
  raiz.add(tarima);

  // Juncos con espiga (InstancedMesh: dos llamadas para todos)
  const geoJunco = R(new THREE.CylinderGeometry(0.014, 0.028, 1, 5));
  geoJunco.translate(0, 0.5, 0);
  const geoEspiga = R(new THREE.CylinderGeometry(0.03, 0.03, 0.2, 6));
  geoEspiga.translate(0, 0.86, 0);
  const matJunco = R(new THREE.MeshLambertMaterial({ color: 0xffffff }));
  const matEspiga = R(new THREE.MeshLambertMaterial({ color: 0x5d4037 }));
  const JUNCOS = 150;
  const juncos = new THREE.InstancedMesh(geoJunco, matJunco, JUNCOS);
  const espigas = new THREE.InstancedMesh(geoEspiga, matEspiga, Math.ceil(JUNCOS / 3));
  const ficticio = new THREE.Object3D();
  const colorJunco = new THREE.Color();
  for (let i = 0; i < JUNCOS; i++) {
    if (i < 80) {
      // Orilla cercana, como antes
      ficticio.position.set((Math.random() - 0.5) * 30, 0, -4 - Math.random() * 1.2);
    } else {
      // Matas en las orillas laterales y del fondo
      const mata = Math.floor((i - 80) / 10);
      const cx = [-27, 27, -18, 12, 24, -6, -29][mata];
      const cz = [-12, -20, -37, -37.5, -36, -37, -30][mata];
      ficticio.position.set(cx + (Math.random() - 0.5) * 3, 0, cz + (Math.random() - 0.5) * 2);
    }
    ficticio.scale.set(1, 0.6 + Math.random() * 0.9, 1);
    ficticio.rotation.set((Math.random() - 0.5) * 0.25, Math.random() * 6, (Math.random() - 0.5) * 0.3);
    ficticio.updateMatrix();
    juncos.setMatrixAt(i, ficticio.matrix);
    // Espiga solo en uno de cada tres juncos
    if (i % 3 === 0) espigas.setMatrixAt(i / 3, ficticio.matrix);
    juncos.setColorAt(i, colorJunco.setHSL(0.22 + Math.random() * 0.06, 0.5, 0.17 + Math.random() * 0.09));
  }
  raiz.add(juncos, espigas);

  // Nenúfares sobre el agua (una llamada)
  const geoNenufar = R(new THREE.CircleGeometry(0.32, 12, 0.35, Math.PI * 2 - 0.35).rotateX(-Math.PI / 2));
  const NENUFARES = 36;
  const nenufares = new THREE.InstancedMesh(geoNenufar, R(new THREE.MeshLambertMaterial({ color: 0xffffff })), NENUFARES);
  for (let i = 0; i < NENUFARES; i++) {
    // En grupitos cerca de las orillas
    const grupo = i % 6;
    const cx = [-12, 9, -22, 20, -3, 15][grupo];
    const cz = [-7, -6.5, -16, -13, -28, -26][grupo];
    ficticio.position.set(cx + (Math.random() - 0.5) * 4, Y_AGUA + 0.006, cz + (Math.random() - 0.5) * 2.5);
    ficticio.rotation.set(0, Math.random() * 6.3, 0);
    ficticio.scale.setScalar(0.6 + Math.random() * 0.7);
    ficticio.updateMatrix();
    nenufares.setMatrixAt(i, ficticio.matrix);
    nenufares.setColorAt(i, colorJunco.setHSL(0.27 + Math.random() * 0.05, 0.55, 0.2 + Math.random() * 0.07));
  }
  raiz.add(nenufares);

  // Árboles alrededor del estanque: copas y troncos instanciados (dos llamadas)
  const geoCopa = R(new THREE.IcosahedronGeometry(1.8, 1));
  geoCopa.scale(1, 1.25, 1);
  geoCopa.translate(0, 4.2, 0);
  const geoTronco = R(new THREE.CylinderGeometry(0.18, 0.28, 3, 6));
  geoTronco.translate(0, 1.5, 0);
  const ARBOLES = 44;
  const copas = new THREE.InstancedMesh(geoCopa, R(new THREE.MeshLambertMaterial({ color: 0xffffff, flatShading: true })), ARBOLES);
  const troncos = new THREE.InstancedMesh(geoTronco, R(new THREE.MeshLambertMaterial({ color: 0x5d4037 })), ARBOLES);
  for (let i = 0; i < ARBOLES; i++) {
    if (i < 24) {
      ficticio.position.set(-46 + (i / 23) * 92 + (Math.random() - 0.5) * 3, 0, -42 - Math.random() * 6);
    } else {
      const lado = i % 2 ? 1 : -1;
      ficticio.position.set(lado * (34 + Math.random() * 6), 0, -6 - ((i - 24) / 20) * 34 - Math.random() * 2);
    }
    ficticio.rotation.set(0, Math.random() * 6.3, 0);
    ficticio.scale.setScalar(0.8 + Math.random() * 0.6);
    ficticio.updateMatrix();
    copas.setMatrixAt(i, ficticio.matrix);
    troncos.setMatrixAt(i, ficticio.matrix);
    copas.setColorAt(i, colorJunco.setHSL(0.25 + Math.random() * 0.08, 0.45, 0.24 + Math.random() * 0.1));
  }
  raiz.add(copas, troncos);

  // Sombras de los patos sobre el agua: se reservan al empezar y se reutilizan
  const sombrasLibres = [];
  for (let i = 0; i < 10; i++) {
    const sombra = ctx.crearSombra({ radio: 0.4, opacidad: 0.7 });
    sombra.visible = false;
    raiz.add(sombra);
    sombrasLibres.push(sombra);
  }

  // ─── Patos ─────────────────────────────────────────────────────────────
  // Se construyen mirando a +Z y se orientan con lookAt hacia donde vuelan.
  const geoCuerpo = R(new THREE.SphereGeometry(0.2, 14, 10));
  geoCuerpo.scale(0.85, 0.75, 1.3);
  const geoCabeza = R(new THREE.SphereGeometry(0.11, 12, 8));
  const geoPico = R(new THREE.ConeGeometry(0.04, 0.12, 8));
  geoPico.rotateX(Math.PI / 2);
  const geoOjo = R(new THREE.SphereGeometry(0.018, 6, 4));
  const geoAla = R(new THREE.BoxGeometry(0.34, 0.025, 0.2));
  geoAla.translate(0.17, 0, 0);
  const geoPluma = R(new THREE.PlaneGeometry(0.06, 0.03));

  const matPato = R(new THREE.MeshLambertMaterial({ color: 0x8d6e63 }));
  // El pato dorado es metálico de verdad (MeshStandard: brilla con el cielo)
  const matDorado = R(new THREE.MeshStandardMaterial({ color: 0xffc400, emissive: 0x3a2400, metalness: 0.75, roughness: 0.3 }));
  const matCuello = R(new THREE.MeshLambertMaterial({ color: 0x2e7d32 }));
  const matPico = R(new THREE.MeshLambertMaterial({ color: 0xffa000 }));
  const matOjo = R(new THREE.MeshBasicMaterial({ color: 0x111111 }));
  const matAla = R(new THREE.MeshLambertMaterial({ color: 0x6d4c41 }));
  const matPluma = R(new THREE.MeshBasicMaterial({ color: 0xfafafa, side: THREE.DoubleSide }));

  function crearPato(dorado) {
    const grupo = new THREE.Group();
    const material = dorado ? matDorado : matPato;
    grupo.add(new THREE.Mesh(geoCuerpo, material));
    const cabeza = new THREE.Mesh(geoCabeza, dorado ? matDorado : matCuello);
    cabeza.position.set(0, 0.14, 0.26);
    const pico = new THREE.Mesh(geoPico, matPico);
    pico.position.set(0, 0.12, 0.39);
    grupo.add(cabeza, pico);
    for (const lado of [-1, 1]) {
      const ojo = new THREE.Mesh(geoOjo, matOjo);
      ojo.position.set(lado * 0.07, 0.18, 0.32);
      grupo.add(ojo);
    }
    const alas = [-1, 1].map((lado) => {
      const ala = new THREE.Mesh(geoAla, dorado ? matDorado : matAla);
      ala.position.set(lado * 0.1, 0.06, 0);
      ala.scale.x = lado; // el ala izquierda es la derecha reflejada
      grupo.add(ala);
      return ala;
    });
    return { grupo, alas };
  }

  // ─── Arco ──────────────────────────────────────────────────────────────
  // En el espacio del mando: -Z hacia delante, las palas del arco arriba y abajo.
  const curvaArco = new THREE.CatmullRomCurve3([
    new THREE.Vector3(0, -0.5, CUERDA_Z),
    new THREE.Vector3(0, -0.28, -0.02),
    new THREE.Vector3(0, 0, -0.05),
    new THREE.Vector3(0, 0.28, -0.02),
    new THREE.Vector3(0, 0.5, CUERDA_Z),
  ]);
  const geoArco = R(new THREE.TubeGeometry(curvaArco, 48, 0.016, 8));
  const geoPuno = R(new THREE.CylinderGeometry(0.025, 0.025, 0.14, 14));
  // Madera barnizada con la veta a lo largo de las palas y puño de cuero
  const texArco = R(ctx.texturas.madera(0x8a5a32, { semilla: 6 }));
  texArco.repeat.set(3, 1);
  const matArco = R(new THREE.MeshStandardMaterial({ map: texArco, roughness: 0.4, metalness: 0 }));
  const matPuno = R(new THREE.MeshStandardMaterial({ color: 0x3e2723, roughness: 0.85, metalness: 0 }));
  const matCuerda = R(new THREE.LineBasicMaterial({ color: 0xf5f5f5 }));

  const geoAsta = R(new THREE.CylinderGeometry(0.01, 0.01, LARGO_FLECHA, 6));
  geoAsta.rotateX(Math.PI / 2);
  const geoPunta = R(new THREE.ConeGeometry(0.025, 0.1, 8));
  geoPunta.rotateX(Math.PI / 2);
  const geoTimon = R(new THREE.PlaneGeometry(0.12, 0.05));
  geoTimon.rotateY(Math.PI / 2);
  const matAsta = R(new THREE.MeshLambertMaterial({ color: 0xd7b98e }));
  const matPunta = R(new THREE.MeshStandardMaterial({ color: 0xb0bec5, metalness: 0.85, roughness: 0.3 }));
  const matTimon = R(new THREE.MeshBasicMaterial({ color: 0xe53935, side: THREE.DoubleSide }));

  // Flecha construida apuntando a +Z, centrada en su mitad
  function crearFlecha() {
    const g = new THREE.Group();
    const punta = new THREE.Mesh(geoPunta, matPunta);
    punta.position.z = LARGO_FLECHA / 2 + 0.04;
    g.add(new THREE.Mesh(geoAsta, matAsta), punta);
    for (const giro of [0, Math.PI / 2]) {
      const timon = new THREE.Mesh(geoTimon, matTimon);
      timon.rotation.z = giro;
      timon.position.z = -LARGO_FLECHA / 2 + 0.07;
      g.add(timon);
    }
    return g;
  }

  function crearArco() {
    const arco = new THREE.Group();
    arco.add(new THREE.Mesh(geoArco, matArco), new THREE.Mesh(geoPuno, matPuno));
    const puntos = new Float32Array([0, 0.5, CUERDA_Z, 0, 0, CUERDA_Z, 0, -0.5, CUERDA_Z]);
    const geoCuerda = new THREE.BufferGeometry();
    geoCuerda.setAttribute('position', new THREE.BufferAttribute(puntos, 3));
    const cuerda = new THREE.Line(geoCuerda, matCuerda);
    cuerda.frustumCulled = false;
    arco.add(cuerda);
    // Mueve el centro de la cuerda (coordenadas locales del arco)
    const tensar = (x, y, z) => {
      puntos[3] = x; puntos[4] = y; puntos[5] = z;
      geoCuerda.attributes.position.needsUpdate = true;
    };
    return { arco, tensar };
  }

  // Un arco en cada mano; solo se ve el de la mano que sujeta el arco
  const arcos = ctx.manos.map((mano) => {
    const a = crearArco();
    ctx.adjuntarAMano(mano, a.arco);
    return { ...a, mano };
  });
  let indiceArco = null;       // qué mano lleva el arco (se decide al conocer los mandos)
  let tensando = false;        // la otra mano tiene agarrada la cuerda
  let apretonAntes = false;
  let ultimaVibracion = 0;
  const flechaCargada = crearFlecha();
  flechaCargada.visible = false;
  raiz.add(flechaCargada);

  // Arco del modo escritorio, delante de la cámara
  const arcoRaton = crearArco();
  arcoRaton.arco.scale.setScalar(0.55);
  const flechaRaton = crearFlecha();
  flechaRaton.rotation.y = Math.PI; // dentro del arco, apuntando a -Z
  arcoRaton.arco.add(flechaRaton);
  const pivote = new THREE.Group();
  pivote.add(arcoRaton.arco);
  pivote.position.copy(vistaPos).add(new THREE.Vector3(0.05, -0.3, -0.7));
  raiz.add(pivote);
  let cargaRaton = 0;
  let tensandoRaton = false;

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.3, alto: 0.36 });
  marcador.mesh.position.set(0, 0.95, -2.6);
  marcador.mesh.rotation.x = -0.35;
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  const patos = [];
  const flechas = [];
  const particulas = [];
  let puntos = 0;
  let record = ctx.leer('record', 0);
  let estado = 'intro'; // 'intro' | 'jugando' | 'fin'
  let reloj = 3;
  let tiempoRestante = DURACION;
  let proximoPato = 0;
  let disparos = 0;
  let aciertos = 0;
  let mensaje = '';
  let tiempoMensaje = 0;

  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const tmp3 = new THREE.Vector3();
  const tramo = new THREE.Line3();

  function actualizarMarcador() {
    if (estado === 'intro') {
      marcador.escribir([
        { texto: 'CAZA DE PATOS', tam: 1.3, color: '#ffe082' },
        {
          texto: ctx.enVR() ? 'Agarra la cuerda con el gatillo, tensa y suelta' : 'Mantén pulsado para tensar y suelta para disparar',
          tam: 0.7,
        },
      ]);
    } else if (estado === 'fin') {
      const punteria = disparos ? Math.round((aciertos / disparos) * 100) : 0;
      marcador.escribir([
        { texto: `¡Tiempo! ${puntos} puntos`, tam: 1.3, color: '#ffe082' },
        { texto: `Puntería ${punteria}% · Récord: ${record} · otra en ${Math.ceil(reloj)}`, tam: 0.7 },
      ]);
    } else {
      marcador.escribir([
        { texto: `Puntos: ${puntos}   ·   ${Math.ceil(tiempoRestante)} s`, tam: 1.3 },
        tiempoMensaje > 0
          ? { texto: mensaje, tam: 0.7, color: '#fff59d' }
          : { texto: `Récord: ${record}   ·   dorados +5   ·   lejanos +1`, tam: 0.7, color: '#ffe082' },
      ]);
    }
  }

  function avisar(texto) {
    mensaje = texto;
    tiempoMensaje = 1.2;
  }

  // ─── Patos ─────────────────────────────────────────────────────────────
  function soltarPato(progreso) {
    const dorado = Math.random() < 0.1;
    const { grupo, alas } = crearPato(dorado);
    const sentido = Math.random() < 0.5 ? 1 : -1;
    const z = -8 - Math.random() * 12;
    grupo.position.set(-sentido * LIMITE_X, 2.5 + Math.random() * 4, z);
    const rapidez = (2.2 + progreso * 2.5 + Math.random() * 1.2) * (dorado ? 1.6 : 1);
    const vel = new THREE.Vector3(sentido * rapidez, 0, (Math.random() - 0.5) * 0.8);
    raiz.add(grupo);
    const sombra = sombrasLibres.pop() || null;
    patos.push({ grupo, alas, vel, dorado, cayendo: false, fase: Math.random() * 10, altura: grupo.position.y, sombra });
    if (Math.random() < 0.5) ctx.sonido('cuac');
  }

  function cazar(pato) {
    pato.cayendo = true;
    pato.vel.multiplyScalar(0.3);
    pato.vel.y = 1.5;
    aciertos += 1;
    const lejos = -pato.grupo.position.z > 15;
    const valor = pato.dorado ? 5 : 1 + (lejos ? 1 : 0);
    puntos += valor;
    if (pato.dorado) avisar('¡Pato dorado! +5');
    else if (lejos) avisar('¡Tiro lejano! +2');
    ctx.sonido('golpe');
    ctx.sonido('cuac');
    ctx.sonido('punto');
    for (let i = 0; i < 12; i++) {
      const p = new THREE.Mesh(geoPluma, matPluma);
      p.position.copy(pato.grupo.position);
      const vel = new THREE.Vector3(Math.random() - 0.5, Math.random() * 0.6, Math.random() - 0.5).multiplyScalar(3);
      raiz.add(p);
      particulas.push({ malla: p, vel, vida: 1.2, giro: (Math.random() - 0.5) * 12 });
    }
  }

  function actualizarPatos(dt, t) {
    for (let i = patos.length - 1; i >= 0; i--) {
      const p = patos[i];
      const g = p.grupo;
      if (p.sombra) ctx.colocarSombra(p.sombra, g.position, Y_AGUA);
      if (p.cayendo) {
        p.vel.y -= 9.8 * dt;
        g.position.addScaledVector(p.vel, dt);
        g.rotation.x += 6 * dt;
        g.rotation.z += 4 * dt;
        if (g.position.y < 0) quitarPato(i);
        continue;
      }
      g.position.addScaledVector(p.vel, dt);
      g.position.y = p.altura + Math.sin(t * 1.5 + p.fase) * 0.3;
      g.lookAt(tmp.copy(g.position).add(p.vel));
      const aleteo = Math.sin(t * 14 + p.fase) * 0.7;
      p.alas[0].rotation.z = -aleteo;
      p.alas[1].rotation.z = aleteo;
      if (Math.abs(g.position.x) > LIMITE_X + 1) quitarPato(i);
    }
  }

  function quitarPato(i) {
    const sombra = patos[i].sombra;
    if (sombra) {
      sombra.visible = false;
      sombrasLibres.push(sombra);
    }
    raiz.remove(patos[i].grupo);
    patos.splice(i, 1);
  }

  // ─── Flechas ───────────────────────────────────────────────────────────
  function lanzarFlecha(origen, direccion, rapidez) {
    disparos += 1;
    const malla = crearFlecha();
    malla.position.copy(origen).addScaledVector(direccion, LARGO_FLECHA / 2);
    malla.lookAt(tmp.copy(malla.position).add(direccion));
    raiz.add(malla);
    flechas.push({
      malla,
      vel: direccion.clone().multiplyScalar(rapidez),
      punta: malla.position.clone().addScaledVector(direccion, LARGO_FLECHA / 2 + 0.08),
      anterior: new THREE.Vector3(),
      clavada: 0,
    });
    ctx.sonido('arco');
  }

  function actualizarFlechas(dt) {
    for (let i = flechas.length - 1; i >= 0; i--) {
      const f = flechas[i];
      if (f.clavada > 0) {
        f.clavada -= dt;
        if (f.clavada <= 0) quitarFlecha(i);
        continue;
      }
      f.vel.y -= GRAVEDAD * dt;
      f.anterior.copy(f.punta);
      f.punta.addScaledVector(f.vel, dt);
      f.malla.position.addScaledVector(f.vel, dt);
      f.malla.lookAt(tmp.copy(f.malla.position).add(f.vel));

      // ¿Ha atravesado algún pato en este fotograma?
      tramo.set(f.anterior, f.punta);
      let acerto = false;
      for (const p of patos) {
        if (p.cayendo) continue;
        if (tramo.closestPointToPoint(p.grupo.position, true, tmp2).distanceTo(p.grupo.position) < RADIO_PATO) {
          if (estado === 'jugando') cazar(p);
          acerto = true;
          break;
        }
      }
      if (acerto) {
        quitarFlecha(i);
      } else if (f.punta.y <= 0.02) {
        f.clavada = 2; // se queda clavada en el suelo o en el agua
      } else if (f.malla.position.lengthSq() > 60 * 60) {
        quitarFlecha(i);
      }
    }
  }

  function quitarFlecha(i) {
    raiz.remove(flechas[i].malla);
    flechas.splice(i, 1);
  }

  // ─── Arco con los mandos VR ────────────────────────────────────────────
  function arcoVR(dt) {
    const activas = ctx.manos.filter((m) => m.activa);
    // Por defecto el arco va en la mano izquierda (o en la primera que aparezca)
    if (indiceArco === null || !ctx.manos[indiceArco].activa) {
      const izquierda = activas.find((m) => m.lado === 'left') || activas[0];
      if (izquierda) indiceArco = izquierda.indice;
    }
    const arco = indiceArco === null ? null : arcos.find((a) => a.mano.indice === indiceArco);
    for (const a of arcos) a.arco.visible = a === arco;
    if (!arco) {
      flechaCargada.visible = false;
      return;
    }
    const manoCuerda = ctx.manos.find((m) => m !== arco.mano && m.activa);

    // El botón de agarre de la mano libre cambia el arco de mano (para zurdos)
    const apreton = !!manoCuerda?.apreton;
    if (apreton && !apretonAntes && !tensando) {
      indiceArco = manoCuerda.indice;
      apretonAntes = apreton;
      return;
    }
    apretonAntes = apreton;

    const reposo = arco.arco.localToWorld(tmp.set(0, 0, CUERDA_Z));
    const reposoMundo = tmp3.copy(reposo);
    if (!tensando && manoCuerda?.gatilloPulsado && manoCuerda.posicion.distanceTo(reposoMundo) < ALCANCE_AGARRE) {
      tensando = true;
      ctx.sonido('tic');
    }

    if (tensando && manoCuerda) {
      const tension = Math.min(TENSION_MAX, manoCuerda.posicion.distanceTo(reposoMundo));
      const fuerza = tension / TENSION_MAX;
      // La cuerda va hasta la mano (en coordenadas del arco)
      const local = arco.arco.worldToLocal(tmp.copy(manoCuerda.posicion));
      arco.tensar(local.x, local.y, local.z);

      // La flecha va de la mano hacia el puño del arco
      const puno = arco.arco.localToWorld(tmp2.set(0, 0, 0));
      const direccion = puno.sub(manoCuerda.posicion).normalize();
      flechaCargada.visible = true;
      flechaCargada.position.copy(manoCuerda.posicion).addScaledVector(direccion, LARGO_FLECHA / 2);
      flechaCargada.lookAt(tmp.copy(flechaCargada.position).add(direccion));

      ultimaVibracion -= dt;
      if (ultimaVibracion <= 0) {
        ctx.vibrar(manoCuerda, 0.05 + fuerza * 0.3, 20);
        ultimaVibracion = 0.08;
      }

      if (!manoCuerda.gatillo) {
        tensando = false;
        flechaCargada.visible = false;
        arco.tensar(0, 0, CUERDA_Z);
        if (fuerza > 0.2) {
          lanzarFlecha(manoCuerda.posicion, direccion, 10 + fuerza * 30);
          ctx.vibrar(arco.mano, 0.8, 60);
        }
      }
    } else {
      tensando = false;
      flechaCargada.visible = false;
      arco.tensar(0, 0, CUERDA_Z);
    }
  }

  // ─── Arco con el ratón ─────────────────────────────────────────────────
  function arcoRatonActualizar(dt) {
    const raton = ctx.raton;
    pivote.visible = raton.dentro || tensandoRaton;
    const objetivo = raton.rayo.ray.at(20, tmp);
    pivote.lookAt(tmp2.copy(pivote.position).multiplyScalar(2).sub(objetivo));

    if (raton.clic) tensandoRaton = true;
    if (tensandoRaton) cargaRaton = Math.min(1, cargaRaton + dt / 0.7);

    if (tensandoRaton && !raton.pulsado) {
      if (cargaRaton > 0.15) {
        const direccion = raton.rayo.ray.direction.clone();
        lanzarFlecha(tmp3.copy(raton.rayo.ray.origin).addScaledVector(direccion, 0.4), direccion, 12 + cargaRaton * 26);
      }
      tensandoRaton = false;
      cargaRaton = 0;
    }

    // Cuerda y flecha según la carga (coordenadas locales del arco)
    const zCuerda = CUERDA_Z + cargaRaton * 0.35;
    arcoRaton.tensar(0, 0, zCuerda);
    flechaRaton.visible = tensandoRaton;
    flechaRaton.position.z = zCuerda - LARGO_FLECHA / 2;
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function empezar() {
    estado = 'jugando';
    puntos = 0;
    disparos = 0;
    aciertos = 0;
    tiempoRestante = DURACION;
    proximoPato = 0.3;
  }

  function actualizar(dt, t) {
    reloj -= dt;
    texOndas.offset.set(t * 0.012, t * 0.007);
    tiempoMensaje -= dt;

    if (estado === 'intro' && reloj <= 0) {
      empezar();
    } else if (estado === 'jugando') {
      tiempoRestante -= dt;
      const progreso = 1 - tiempoRestante / DURACION;
      proximoPato -= dt;
      const maxPatos = 2 + Math.floor(progreso * 3.5);
      if (proximoPato <= 0 && patos.filter((p) => !p.cayendo).length < maxPatos) {
        soltarPato(progreso);
        proximoPato = 1.5 - progreso * 0.8 + Math.random() * 0.5;
      }
      if (tiempoRestante <= 0) {
        estado = 'fin';
        reloj = 6;
        if (puntos > record) {
          record = puntos;
          ctx.guardar('record', record);
        }
        ctx.sonido('fin');
      }
    } else if (estado === 'fin' && reloj <= 0) {
      empezar();
    }

    actualizarPatos(dt, t);
    actualizarFlechas(dt);

    for (let i = particulas.length - 1; i >= 0; i--) {
      const p = particulas[i];
      p.vida -= dt;
      p.vel.y -= 2 * dt;
      p.vel.multiplyScalar(1 - dt * 1.5);
      p.malla.position.addScaledVector(p.vel, dt);
      p.malla.rotation.x += p.giro * dt;
      p.malla.rotation.y += p.giro * dt;
      if (p.vida <= 0) {
        raiz.remove(p.malla);
        particulas.splice(i, 1);
      }
    }

    if (ctx.enVR()) {
      pivote.visible = false;
      arcoVR(dt);
    } else {
      for (const a of arcos) a.arco.visible = false;
      flechaCargada.visible = false;
      tensando = false;
      arcoRatonActualizar(dt);
    }

    actualizarMarcador();
  }

  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      niebla.near = nieblaOriginal.near;
      niebla.far = nieblaOriginal.far;
      patos.length = 0;
      flechas.length = 0;
      particulas.length = 0;
    },
  };
}
