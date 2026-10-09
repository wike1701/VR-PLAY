// RUTA DE OBSTÁCULOS
// Carretera de 3 carriles sin final, cada vez más rápida. Esquiva conos, rocas,
// vallas y coches lentos, coge monedas y salta los muros por las rampas.
// 3 vidas. El coche acelera solo: tú solo diriges.
// En VR giras un volante "invisible" con las dos manos; con ratón o con el dedo,
// el coche va hacia donde lo pongas.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const VIDAS = 3;
const ANCHO_CARRIL = 3.2;
const LIMITE_X = ANCHO_CARRIL;      // el centro del coche va de un carril exterior al otro
const VELOCIDAD_INICIAL = 16;
const VELOCIDAD_MAX = 40;
const SUBIDA_VELOCIDAD = 0.35;      // m/s más cada segundo
const VELOCIDAD_LATERAL = 10;
const APARICION = -150;             // los obstáculos aparecen a esta distancia
const LARGO_CARRETERA = 320;
const IMPULSO_SALTO = 7.5;
const G = 9.8;
const INVULNERABLE = 1.5;
const OJOS = 1.15;
const GIRO_VOLANTE = 1.6;
const MEDIO_COCHE = 0.85;           // medio ancho de tu coche
const COCHE_DELANTE = -2.6;         // el morro de tu coche (z)
const COCHE_DETRAS = 0.6;
const CARRILES = [-ANCHO_CARRIL, 0, ANCHO_CARRIL];

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  ctx.fondo(0x9fd4f2);
  const niebla = ctx.escena.fog;
  const nieblaOriginal = { near: niebla.near, far: niebla.far };
  niebla.near = 40;
  niebla.far = 150;
  ctx.sueloBase(false);
  ctx.vistaEscritorio(new THREE.Vector3(0, OJOS, 0.1), new THREE.Vector3(0, 0.9, -10));

  const conjunto = new THREE.Group(); // se ajusta a la altura de tus ojos
  raiz.add(conjunto);
  const mundo = new THREE.Group();    // se desplaza al revés que el coche (a los lados y al saltar)
  conjunto.add(mundo);

  // ─── Carretera y campo (texturas que se desplazan) ─────────────────────
  const METROS_ASFALTO = 12;
  const anchoCarretera = ANCHO_CARRIL * 3 + 1.2;
  const texAsfalto = R(ctx.texturaCanvas((g, tam, azar) => {
    g.fillStyle = '#505359';
    g.fillRect(0, 0, tam, tam);
    for (let i = 0; i < 2500; i++) {
      g.fillStyle = azar() < 0.5 ? `rgba(255,255,255,${azar() * 0.07})` : `rgba(0,0,0,${azar() * 0.15})`;
      g.fillRect(azar() * tam, azar() * tam, 1.5, 1.5);
    }
    const porMetro = tam / anchoCarretera;
    const borde = 0.6 * porMetro;
    g.fillStyle = '#f5f5f5';
    g.fillRect(borde - 4, 0, 6, tam);
    g.fillRect(tam - borde - 2, 0, 6, tam);
    for (const k of [1, 2]) g.fillRect(borde + k * ANCHO_CARRIL * porMetro - 3, 0, 6, tam / 2);
  }, { tam: 256, repetir: [1, LARGO_CARRETERA / METROS_ASFALTO], semilla: 23 }));
  const carretera = new THREE.Mesh(R(new THREE.PlaneGeometry(anchoCarretera, LARGO_CARRETERA).rotateX(-Math.PI / 2)), R(new THREE.MeshLambertMaterial({ map: texAsfalto })));
  carretera.position.set(0, 0.01, 20 - LARGO_CARRETERA / 2);
  mundo.add(carretera);
  const METROS_CESPED = 8;
  const texCesped = R(ctx.texturas.cesped(0x6cb33f, { repetir: [120 / METROS_CESPED, LARGO_CARRETERA / METROS_CESPED], semilla: 5 }));
  const campo = new THREE.Mesh(R(new THREE.PlaneGeometry(120, LARGO_CARRETERA).rotateX(-Math.PI / 2)), R(new THREE.MeshLambertMaterial({ map: texCesped })));
  campo.position.set(0, 0, 20 - LARGO_CARRETERA / 2);
  mundo.add(campo);

  // Árboles y postes a los lados (instanciados, se reciclan al pasar)
  const geoCopa = R(new THREE.ConeGeometry(1.8, 5, 8).translate(0, 4.2, 0));
  const geoTronco = R(new THREE.CylinderGeometry(0.25, 0.35, 1.8, 6).translate(0, 0.9, 0));
  const NUM_ARBOLES = 40;
  const copas = new THREE.InstancedMesh(geoCopa, R(new THREE.MeshLambertMaterial({ color: 0x2f7a32 })), NUM_ARBOLES);
  const troncos = new THREE.InstancedMesh(geoTronco, R(new THREE.MeshLambertMaterial({ color: 0x6d4c41 })), NUM_ARBOLES);
  const arboles = Array.from({ length: NUM_ARBOLES }, (_, i) => ({
    x: (i % 2 ? 1 : -1) * (anchoCarretera / 2 + 4 + Math.random() * 14),
    z: APARICION + (i / NUM_ARBOLES) * (20 - APARICION),
    s: 0.7 + Math.random() * 0.7,
  }));
  mundo.add(copas, troncos);
  const m4 = new THREE.Matrix4();

  // ─── Obstáculos (se crean todos al principio y se reutilizan) ──────────
  const matCono = R(new THREE.MeshLambertMaterial({ color: 0xff6d00 }));
  const geoCono = R(new THREE.ConeGeometry(0.35, 0.9, 12).translate(0, 0.45, 0));
  const geoRoca = R(new THREE.DodecahedronGeometry(0.8).scale(1.2, 0.8, 1).translate(0, 0.45, 0));
  const matRoca = R(new THREE.MeshLambertMaterial({ color: 0x8a8580 }));
  const texValla = R(ctx.texturaCanvas((g, tam) => {
    const franjas = 8;
    for (let i = 0; i < franjas; i++) {
      g.fillStyle = i % 2 ? '#fafafa' : '#e53935';
      g.beginPath();
      const x = (i / franjas) * tam;
      g.moveTo(x, 0); g.lineTo(x + tam / franjas, 0); g.lineTo(x + tam / franjas - tam / 4, tam); g.lineTo(x - tam / 4, tam);
      g.fill();
    }
  }, { tam: 128, repetir: [2, 1] }));
  const geoValla = R(new THREE.BoxGeometry(ANCHO_CARRIL * 2 - 0.4, 1.1, 0.3).translate(0, 0.55, 0));
  const matValla = R(new THREE.MeshLambertMaterial({ map: texValla }));
  const geoMuro = R(new THREE.BoxGeometry(anchoCarretera, 1.5, 0.8).translate(0, 0.75, 0));
  const matMuro = R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.ladrillos(0x9c4b3a, 0x6b5a52, { repetir: [6, 1], semilla: 2 })) }));
  // Rampa: cuña de 6 m que sube hasta 0,9 m
  const geoRampa = R(new THREE.BufferGeometry());
  {
    const a = ANCHO_CARRIL / 2 - 0.1;
    const l = 3;
    const h = 0.9;
    const v = [
      -a, 0, l, a, 0, l, a, h, -l, -a, 0, l, a, h, -l, -a, h, -l, // pendiente
      -a, 0, -l, -a, h, -l, a, h, -l, -a, 0, -l, a, h, -l, a, 0, -l, // frente
      -a, 0, l, -a, h, -l, -a, 0, -l, a, 0, l, a, 0, -l, a, h, -l, // lados
    ];
    geoRampa.setAttribute('position', new THREE.Float32BufferAttribute(v, 3));
    geoRampa.computeVertexNormals();
  }
  const matRampa = R(new THREE.MeshLambertMaterial({ color: 0xffd600, side: THREE.DoubleSide }));
  const geoMoneda = R(new THREE.CylinderGeometry(0.4, 0.4, 0.08, 20).rotateX(Math.PI / 2).translate(0, 1.1, 0));
  const matMoneda = R(new THREE.MeshStandardMaterial({ color: 0xffc400, roughness: 0.25, metalness: 0.8, emissive: 0x3a2a00 }));
  const geoCoche = R(new THREE.BoxGeometry(1.8, 1.1, 4.2).translate(0, 0.6, 0));
  const matCoches = [0x1e88e5, 0x8e24aa, 0x43a047].map((c) => R(new THREE.MeshStandardMaterial({ color: c, roughness: 0.35, metalness: 0.3 })));

  const tipos = {
    cono: { geo: geoCono, mat: matCono, n: 12, ancho: 0.35, largo: 0.7, alto: 0.9 },
    roca: { geo: geoRoca, mat: matRoca, n: 8, ancho: 0.95, largo: 1.6, alto: 1.1 },
    valla: { geo: geoValla, mat: matValla, n: 6, ancho: ANCHO_CARRIL - 0.2, largo: 0.3, alto: 1.1 },
    muro: { geo: geoMuro, mat: matMuro, n: 3, ancho: anchoCarretera / 2, largo: 0.8, alto: 1.5 },
    rampa: { geo: geoRampa, mat: matRampa, n: 3, ancho: ANCHO_CARRIL / 2 - 0.1, largo: 6, alto: 0 },
    moneda: { geo: geoMoneda, mat: matMoneda, n: 25, ancho: 0.4, largo: 0.4, alto: 2 },
    coche: { geo: geoCoche, mat: matCoches[0], n: 4, ancho: 0.9, largo: 4.2, alto: 1.1 },
  };
  const obstaculos = [];
  for (const [nombre, t] of Object.entries(tipos)) {
    for (let i = 0; i < t.n; i++) {
      const malla = new THREE.Mesh(t.geo, nombre === 'coche' ? matCoches[i % matCoches.length] : t.mat);
      malla.visible = false;
      mundo.add(malla);
      obstaculos.push({ tipo: nombre, malla, activo: false, x: 0, z: 0, propia: 0, ...t });
    }
  }

  function activar(tipo, x, z, propia = 0) {
    const o = obstaculos.find((p) => p.tipo === tipo && !p.activo);
    if (!o) return;
    o.activo = true;
    o.x = x;
    o.z = z;
    o.propia = propia;
    o.malla.visible = true;
    o.malla.position.set(x, 0, z);
    o.malla.rotation.set(0, 0, 0);
  }

  // ─── Cabina ────────────────────────────────────────────────────────────
  const cabina = new THREE.Group();
  conjunto.add(cabina);
  const matCarroceria = R(new THREE.MeshLambertMaterial({ color: 0x1565c0 }));
  const matInterior = R(new THREE.MeshLambertMaterial({ color: 0x2b2b2b }));
  const capo = new THREE.Mesh(R(new THREE.BoxGeometry(1.7, 0.3, 1.9)), matCarroceria);
  capo.position.set(0, 0.62, -1.65);
  const salpicadero = new THREE.Mesh(R(new THREE.BoxGeometry(1.6, 0.25, 0.35)), matInterior);
  salpicadero.position.set(0, 0.82, -0.62);
  const lados = new THREE.InstancedMesh(R(new THREE.BoxGeometry(0.12, 0.45, 2.6)), matCarroceria, 2);
  [-1, 1].forEach((s, i) => lados.setMatrixAt(i, new THREE.Matrix4().setPosition(s * 0.82, 0.6, -0.2)));
  cabina.add(capo, salpicadero, lados); // descapotable: sin parabrisas que tape la vista
  const soporteVolante = new THREE.Group();
  soporteVolante.position.set(0, 0.92, -0.42);
  soporteVolante.rotation.x = -0.45;
  const volante = new THREE.Group();
  volante.add(
    new THREE.Mesh(R(new THREE.TorusGeometry(0.17, 0.018, 8, 32)), matInterior),
    new THREE.Mesh(R(new THREE.BoxGeometry(0.32, 0.03, 0.02)), matInterior),
    new THREE.Mesh(R(new THREE.CylinderGeometry(0.04, 0.04, 0.03, 12).rotateX(Math.PI / 2)), matCarroceria),
  );
  soporteVolante.add(volante);
  cabina.add(soporteVolante);
  const pantalla = ctx.crearPanel({ ancho: 0.46, alto: 0.15, resolucion: 384 });
  pantalla.mesh.position.set(0.5, 0.99, -0.62); // a la derecha del volante, para que no la tape
  pantalla.mesh.rotation.set(-0.5, -0.35, 0, 'YXZ');
  cabina.add(pantalla.mesh);
  const cartel = ctx.crearPanel({ ancho: 2.4, alto: 0.7 });
  cartel.mesh.position.set(0, 2.4, -7);
  cabina.add(cartel.mesh);
  const sombraCoche = ctx.crearSombra({ radio: 1.4, opacidad: 0.45 });
  sombraCoche.scale.set(2, 1, 4.2);
  conjunto.add(sombraCoche);

  // ─── Estado ────────────────────────────────────────────────────────────
  let estado = 'intro'; // 'intro' | 'jugando' | 'fin'
  let reloj = 3.5;
  let v = 0;
  let cocheX = 0;
  let altura = 0;
  let velY = 0;
  let distancia = 0;
  let monedas = 0;
  let vidas = VIDAS;
  let invulnerable = 0;
  let tiempo = 0;
  let proximaFila = 40;
  let giroVolante = 0;
  let alturaOjos = null;
  let mensaje = '';
  let tiempoMensaje = 0;
  let record = ctx.leer('record', 0);

  const tmp = new THREE.Vector3();
  const puntos = () => Math.floor(distancia) + monedas * 50;

  function avisar(texto) {
    mensaje = texto;
    tiempoMensaje = 1.5;
  }

  function actualizarPantallas() {
    pantalla.escribir([
      { texto: `${Math.round(v * 3.6)} km/h`, tam: 1.2 },
      { texto: `${'♥'.repeat(vidas)}${'♡'.repeat(VIDAS - vidas)} · ${puntos()} pts`, tam: 0.8, color: '#ffcc80' },
    ]);
    if (estado === 'intro') {
      cartel.escribir([
        { texto: 'RUTA DE OBSTÁCULOS', tam: 1.2, color: '#ffcc80' },
        { texto: ctx.enVR() ? 'Gira el volante con las dos manos · salta los muros por las rampas amarillas' : (ctx.tactil ? 'Mueve el dedo a los lados para dirigir · salta los muros por las rampas' : 'Mueve el ratón a los lados para dirigir · salta los muros por las rampas'), tam: 0.6 },
      ]);
      cartel.mesh.visible = true;
    } else if (estado === 'fin') {
      cartel.escribir([
        { texto: `¡Fin! ${puntos()} puntos`, tam: 1.3, color: '#ffcc80' },
        { texto: `${Math.floor(distancia)} m · ${monedas} monedas · récord ${record} · otra en ${Math.ceil(reloj)}`, tam: 0.6 },
      ]);
      cartel.mesh.visible = true;
    } else if (tiempoMensaje > 0) {
      cartel.escribir([{ texto: mensaje, tam: 1.2, color: '#fff59d' }, { texto: ' ', tam: 0.6 }]);
      cartel.mesh.visible = true;
    } else {
      cartel.mesh.visible = false;
    }
  }

  // ─── Generar obstáculos ────────────────────────────────────────────────
  function nuevaFila() {
    const z = APARICION;
    const r = Math.random();
    const carril = () => CARRILES[Math.floor(Math.random() * 3)];
    if (tiempo > 15 && r < 0.14) {
      // Rampa y, más adelante, un muro que ocupa toda la carretera
      // (más separados cuanto más rápido vas, para que el salto siempre lo supere)
      activar('rampa', carril(), z);
      activar('muro', 0, z - THREE.MathUtils.clamp(v * 0.9 - 6, 8, 30));
      return 70;
    }
    if (r < 0.4) {
      // Uno o dos obstáculos pequeños, siempre con un carril libre
      const libre = Math.floor(Math.random() * 3);
      for (let k = 0; k < 3; k++) {
        if (k === libre) continue;
        if (Math.random() < 0.6) activar(Math.random() < 0.5 ? 'cono' : 'roca', CARRILES[k] + (Math.random() - 0.5) * 0.8, z);
      }
      if (Math.random() < 0.5) activar('moneda', CARRILES[libre], z);
    } else if (r < 0.6) {
      // Valla que tapa dos carriles
      const izquierda = Math.random() < 0.5;
      activar('valla', izquierda ? -ANCHO_CARRIL / 2 : ANCHO_CARRIL / 2, z);
      const libre = izquierda ? CARRILES[2] : CARRILES[0];
      for (let k = 0; k < 3; k++) activar('moneda', libre, z + k * 4);
    } else if (r < 0.8) {
      // Coche más lento en un carril
      activar('coche', carril(), z, 0.45 * v);
    } else {
      // Fila de monedas
      const x = carril();
      for (let k = 0; k < 5; k++) activar('moneda', x, z - k * 4);
    }
    return Math.max(22, v * 1.5);
  }

  // ─── Choques ───────────────────────────────────────────────────────────
  function comprobar(o) {
    const solapaX = Math.abs(o.x - cocheX) < o.ancho + MEDIO_COCHE;
    const solapaZ = o.z + o.largo / 2 > COCHE_DELANTE && o.z - o.largo / 2 < COCHE_DETRAS;
    if (!solapaX || !solapaZ) return;
    if (o.tipo === 'moneda') {
      o.activo = false;
      o.malla.visible = false;
      monedas += 1;
      ctx.sonido('punto');
      return;
    }
    if (o.tipo === 'rampa') {
      if (altura <= 0.01 && velY <= 0) {
        velY = IMPULSO_SALTO;
        ctx.sonido('zas');
        avisar('¡Salto!');
      }
      return;
    }
    if (altura > o.alto) return; // pasa por encima
    if (invulnerable > 0) return;
    vidas -= 1;
    invulnerable = INVULNERABLE;
    v *= 0.6;
    o.activo = false;
    o.malla.visible = false;
    ctx.sonido('golpe');
    ctx.sonido('fallo');
    ctx.destello(0xff1744, 0.5);
    for (const m of ctx.manos) ctx.vibrar(m, 1, 250);
    if (vidas <= 0) {
      estado = 'fin';
      reloj = 7;
      if (puntos() > record) {
        record = puntos();
        ctx.guardar('record', record);
      }
      ctx.sonido('fin');
    } else {
      avisar(`¡Choque! Te quedan ${vidas}`);
    }
  }

  // ─── Dirección ─────────────────────────────────────────────────────────
  function dirigir(dt) {
    if (ctx.enVR()) {
      const activas = ctx.manos.filter((m) => m.activa);
      const izquierda = activas.find((m) => m.lado === 'left') || ctx.manos[0];
      const derecha = activas.find((m) => m.lado === 'right') || ctx.manos[1];
      if (izquierda.activa && derecha.activa) {
        const d = tmp.subVectors(derecha.posicion, izquierda.posicion);
        giroVolante = Math.atan2(d.y, Math.max(0.05, Math.hypot(d.x, d.z)));
      } else if (activas.length === 1) {
        giroVolante = -THREE.MathUtils.clamp(activas[0].posicion.x / 0.25, -1, 1) * GIRO_VOLANTE;
      }
      const direccion = THREE.MathUtils.clamp(-giroVolante / GIRO_VOLANTE, -1, 1);
      cocheX += direccion * VELOCIDAD_LATERAL * dt;
    } else {
      // Con ratón o dedo el coche va hacia donde apuntas
      const objetivo = THREE.MathUtils.clamp(ctx.raton.ndc.x * 1.3, -1, 1) * LIMITE_X;
      const paso = THREE.MathUtils.clamp(objetivo - cocheX, -VELOCIDAD_LATERAL * dt, VELOCIDAD_LATERAL * dt);
      cocheX += paso;
      giroVolante = -paso / (VELOCIDAD_LATERAL * dt || 1) * 0.6;
    }
    cocheX = THREE.MathUtils.clamp(cocheX, -LIMITE_X, LIMITE_X);
    volante.rotation.z = giroVolante;
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function empezar() {
    estado = 'jugando';
    v = VELOCIDAD_INICIAL;
    distancia = 0;
    monedas = 0;
    vidas = VIDAS;
    invulnerable = 0;
    tiempo = 0;
    proximaFila = 30;
    for (const o of obstaculos) {
      o.activo = false;
      o.malla.visible = false;
    }
  }

  function actualizar(dt, t) {
    reloj -= dt;
    tiempoMensaje -= dt;
    invulnerable = Math.max(0, invulnerable - dt);

    if (ctx.enVR()) {
      ctx.camara.getWorldPosition(tmp);
      alturaOjos = alturaOjos === null ? tmp.y : THREE.MathUtils.lerp(alturaOjos, tmp.y, Math.min(1, dt * 0.4));
      conjunto.position.y = alturaOjos - OJOS;
    } else {
      alturaOjos = null;
      conjunto.position.y = 0;
    }

    if (estado === 'intro') {
      v = Math.min(VELOCIDAD_INICIAL, v + 6 * dt);
      if (reloj <= 0) empezar();
    } else if (estado === 'jugando') {
      tiempo += dt;
      v = Math.min(VELOCIDAD_MAX, v + SUBIDA_VELOCIDAD * dt + (v < VELOCIDAD_INICIAL ? 4 * dt : 0));
      distancia += v * dt;
      proximaFila -= v * dt;
      if (proximaFila <= 0) proximaFila = nuevaFila();
    } else {
      v = Math.max(0, v - 12 * dt);
      if (reloj <= 0) empezar();
    }

    dirigir(dt);

    // Salto
    if (altura > 0 || velY > 0) {
      velY -= G * dt;
      altura += velY * dt;
      if (altura <= 0) {
        altura = 0;
        velY = 0;
        ctx.sonido('bote');
        for (const m of ctx.manos) ctx.vibrar(m, 0.6, 90);
      }
    }
    mundo.position.set(-cocheX, -altura, 0);
    // La sombra se queda en el suelo (que baja cuando saltas) y se aclara con la altura
    sombraCoche.position.set(0, 0.02 - altura, -1);
    sombraCoche.material.opacity = 0.45 / (1 + altura);

    // Avanzar el decorado
    texAsfalto.offset.y = (texAsfalto.offset.y + (v * dt) / METROS_ASFALTO) % 1;
    texCesped.offset.y = (texCesped.offset.y + (v * dt) / METROS_CESPED) % 1;
    arboles.forEach((a, i) => {
      a.z += v * dt;
      if (a.z > 20) a.z += APARICION - 20;
      m4.makeScale(a.s, a.s, a.s).setPosition(a.x, 0, a.z);
      copas.setMatrixAt(i, m4);
      troncos.setMatrixAt(i, m4);
    });
    copas.instanceMatrix.needsUpdate = true;
    troncos.instanceMatrix.needsUpdate = true;

    // Mover obstáculos y comprobar choques
    for (const o of obstaculos) {
      if (!o.activo) continue;
      o.z += (v - o.propia) * dt;
      o.malla.position.z = o.z;
      if (o.tipo === 'moneda') o.malla.rotation.y = t * 3;
      if (estado === 'jugando') comprobar(o);
      if (o.z - o.largo / 2 > 8) {
        o.activo = false;
        o.malla.visible = false;
      }
    }

    // Parpadeo mientras eres invulnerable y un poco de vibración del motor
    cabina.visible = invulnerable <= 0 || Math.sin(t * 30) > -0.6;
    cabina.position.y = Math.sin(t * 40) * 0.002 * (v / VELOCIDAD_MAX);
    actualizarPantallas();
  }

  actualizarPantallas();

  return {
    actualizar,
    liberar() {
      niebla.near = nieblaOriginal.near;
      niebla.far = nieblaOriginal.far;
    },
  };
}
