// ESQUIVA FLECHAS
// Unas torres disparan flechas hacia tu cabeza. En VR te agachas o te apartas
// con el cuerpo; sin gafas mueves el ratón para desplazarte (abajo = agacharse).
// Tienes 3 vidas y la dificultad sube con el tiempo.
import * as THREE from 'three';

// Sin archivos externos: todo se genera con código (ver el comentario en Corta Fruta).
export async function precargar() {}

const VIDAS = 3;
const DISTANCIA_TORRES = 11;
const ANGULOS_TORRES = [-50, -25, 0, 25, 50];
const TIEMPO_CARGA = 0.8;     // aviso (bola roja) antes de cada disparo
const RADIO_CABEZA = 0.13;
const RADIO_TORSO = 0.16;
const CASI = 0.38;            // distancia a la cabeza que cuenta como "¡por los pelos!"
const INVULNERABLE = 1.2;     // segundos sin recibir daño tras un impacto
const LARGO_FLECHA = 0.75;
const GRAVEDAD = 1.2;          // las flechas caen un poco para que el vuelo parezca real

export function iniciar(ctx) {
  const { raiz } = ctx;
  const R = (recurso) => ctx.recurso(recurso);

  ctx.fondo(0x1d1626);

  // ─── Utilidades de geometría ───────────────────────────────────────────
  // Junta varias geometrías ya colocadas en una sola (una llamada de dibujo).
  function fusionar(geos, atributos = ['position', 'normal', 'uv']) {
    const partes = geos.map((g) => (g.index ? g.toNonIndexed() : g));
    const total = partes.reduce((n, g) => n + g.attributes.position.count, 0);
    const res = new THREE.BufferGeometry();
    for (const nombre of atributos) {
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
  function escalarUV(geo, su, sv) {
    const uv = geo.attributes.uv;
    for (let i = 0; i < uv.count; i++) uv.setXY(i, uv.getX(i) * su, uv.getY(i) * sv);
    return geo;
  }
  function colorear(geo, hex) {
    const g = geo.index ? geo.toNonIndexed() : geo;
    const c = new THREE.Color(hex);
    const datos = new Float32Array(g.attributes.position.count * 3);
    for (let i = 0; i < datos.length; i += 3) c.toArray(datos, i);
    g.setAttribute('color', new THREE.BufferAttribute(datos, 3));
    return g;
  }

  // ─── Suelo ─────────────────────────────────────────────────────────────
  ctx.sueloBase(false);
  const suelo = new THREE.Mesh(
    R(new THREE.CircleGeometry(20, 48).rotateX(-Math.PI / 2)),
    R(new THREE.MeshLambertMaterial({ map: R(ctx.texturas.cesped(0x4f6b3c, { tam: 512, repetir: [20, 20], semilla: 21 })) })),
  );
  raiz.add(suelo);

  // ─── Zona del jugador ──────────────────────────────────────────────────
  const zona = new THREE.Mesh(R(new THREE.RingGeometry(0.75, 0.82, 48)), R(new THREE.MeshBasicMaterial({ color: 0xffb74d })));
  zona.rotation.x = -Math.PI / 2;
  zona.position.y = 0.005;
  raiz.add(zona);

  // ─── Torres ────────────────────────────────────────────────────────────
  // Cada torre (fuste, cornisa y almenas) es una sola malla de piedra.
  const texPiedra = R(ctx.texturas.ladrillos(0x8a8190, 0x4a4450, { filas: 8, columnas: 4, semilla: 22 }));
  const piezasTorre = [
    escalarUV(new THREE.CylinderGeometry(0.45, 0.6, 2.4, 16, 1, true).translate(0, 1.2, 0), 3, 2.5),
    escalarUV(new THREE.CylinderGeometry(0.56, 0.5, 0.18, 16).translate(0, 2.4, 0), 3, 0.2),
  ];
  for (let i = 0; i < 6; i++) {
    const b = (i / 6) * Math.PI * 2;
    piezasTorre.push(escalarUV(new THREE.BoxGeometry(0.22, 0.25, 0.22).translate(Math.cos(b) * 0.4, 2.6, Math.sin(b) * 0.4), 1, 0.25));
  }
  const geoTorre = R(fusionar(piezasTorre));

  // El aviso: una bola roja intensa con un halo que se ve desde lejos
  const geoCarga = R(new THREE.SphereGeometry(0.14, 16, 12));
  const matCarga = R(new THREE.MeshBasicMaterial({ color: 0xff1a1a, toneMapped: false }));
  const texHalo = R(ctx.texturaCanvas((g, tam) => {
    const grad = g.createRadialGradient(tam / 2, tam / 2, 0, tam / 2, tam / 2, tam / 2);
    grad.addColorStop(0, 'rgba(255,90,70,1)');
    grad.addColorStop(0.25, 'rgba(255,30,20,0.6)');
    grad.addColorStop(1, 'rgba(255,0,0,0)');
    g.fillStyle = grad;
    g.fillRect(0, 0, tam, tam);
  }, { tam: 64 }));
  const matHalo = R(new THREE.SpriteMaterial({
    map: texHalo, blending: THREE.AdditiveBlending, depthWrite: false, toneMapped: false, fog: false,
  }));

  const torres = ANGULOS_TORRES.map((grados, i) => {
    const a = THREE.MathUtils.degToRad(grados);
    const x = Math.sin(a) * DISTANCIA_TORRES;
    const z = -Math.cos(a) * DISTANCIA_TORRES;
    // Material propio por torre para poder encenderla en rojo cuando va a disparar
    const material = R(new THREE.MeshLambertMaterial({ map: texPiedra, emissive: 0x000000 }));
    const torre = new THREE.Mesh(geoTorre, material);
    torre.position.set(x, 0, z);
    torre.rotation.y = i * 0.7;
    raiz.add(torre);
    // La flecha sale de un punto delante de la torre, hacia el jugador
    const salida = new THREE.Vector3(x, 0, z).multiplyScalar((DISTANCIA_TORRES - 0.8) / DISTANCIA_TORRES);
    const carga = new THREE.Mesh(geoCarga, matCarga);
    const halo = new THREE.Sprite(matHalo);
    halo.scale.setScalar(1.3);
    carga.add(halo);
    carga.visible = false;
    raiz.add(carga);
    return { salida, carga, material, cargando: false, t: 0, apuntaTorso: false };
  });

  // ─── Aviso en el borde de la pantalla ──────────────────────────────────
  // Sin gafas (sobre todo en el móvil en vertical) las torres de los lados quedan
  // fuera de la vista: una flecha roja en el borde avisa de que una de ellas va a disparar.
  const geoAvisoBorde = R(new THREE.CircleGeometry(0.03, 3)); // triángulo que apunta hacia +X
  const matAvisoBorde = R(new THREE.MeshBasicMaterial({
    color: 0xff1744, transparent: true, depthTest: false, depthWrite: false, toneMapped: false, fog: false,
  }));
  const avisosBorde = [-1, 1].map((lado) => {
    const m = new THREE.Mesh(geoAvisoBorde, matAvisoBorde);
    m.renderOrder = 990;
    m.visible = false;
    m.userData.lado = lado;
    raiz.add(m);
    return m;
  });
  const enPantalla = new THREE.Vector3();
  const delanteCamara = new THREE.Vector3();
  const derechaCamara = new THREE.Vector3();
  const giroAviso = new THREE.Quaternion();
  const EJE_Z = new THREE.Vector3(0, 0, 1);

  function actualizarAvisosBorde(t) {
    let izquierda = 0;
    let derecha = 0;
    if (!ctx.enVR()) {
      for (const torre of torres) {
        if (!torre.cargando) continue;
        enPantalla.copy(torre.salida).setY(1.5).project(ctx.camara);
        if (Math.abs(enPantalla.x) < 0.95 && enPantalla.z < 1) continue; // ya se ve
        const f = torre.t / TIEMPO_CARGA;
        if (enPantalla.x < 0) izquierda = Math.max(izquierda, f);
        else derecha = Math.max(derecha, f);
      }
    }
    const camara = ctx.camara;
    const distancia = 0.5;
    const medioAncho = distancia * Math.tan(THREE.MathUtils.degToRad(camara.fov / 2)) * camara.aspect;
    camara.getWorldDirection(delanteCamara);
    derechaCamara.setFromMatrixColumn(camara.matrixWorld, 0);
    for (const aviso of avisosBorde) {
      const lado = aviso.userData.lado;
      const fuerza = lado < 0 ? izquierda : derecha;
      aviso.visible = fuerza > 0;
      if (!aviso.visible) continue;
      const empuje = Math.sin(t * 18) * 0.008;
      aviso.position.copy(camara.position)
        .addScaledVector(delanteCamara, distancia)
        .addScaledVector(derechaCamara, lado * (medioAncho - 0.035 + empuje));
      // Mirando a la cámara y apuntando hacia fuera de la pantalla
      aviso.quaternion.copy(camara.quaternion).multiply(giroAviso.setFromAxisAngle(EJE_Z, lado < 0 ? Math.PI : 0));
      aviso.scale.setScalar(1 + fuerza * 0.8);
    }
    matAvisoBorde.opacity = 0.6 + 0.4 * Math.abs(Math.sin(t * 15));
  }

  function apagarTorre(torre) {
    torre.cargando = false;
    torre.carga.visible = false;
    torre.material.emissive.setRGB(0, 0, 0);
  }

  // Muralla baja al fondo, detrás de las torres
  const muralla = new THREE.Mesh(
    R(escalarUV(new THREE.CylinderGeometry(14, 14, 2.2, 40, 1, true, Math.PI * 0.5, Math.PI).translate(0, 1.1, 0), 36, 2.3)),
    R(new THREE.MeshLambertMaterial({ map: texPiedra, side: THREE.BackSide, color: 0xb0a8b8 })),
  );
  raiz.add(muralla);

  // ─── Flechas ───────────────────────────────────────────────────────────
  // Se construyen apuntando a +Z para poder orientarlas con lookAt. Asta, punta
  // y plumas van en una sola malla con colores por vértice (una llamada por flecha).
  const geoFlecha = R(fusionar([
    colorear(new THREE.CylinderGeometry(0.012, 0.012, LARGO_FLECHA, 6).rotateX(Math.PI / 2), 0xd7b98e),
    colorear(new THREE.ConeGeometry(0.035, 0.12, 8).rotateX(Math.PI / 2).translate(0, 0, LARGO_FLECHA / 2 + 0.05), 0xc9d3da),
    ...[0, Math.PI / 2].map((giro) => colorear(
      new THREE.PlaneGeometry(0.14, 0.07).rotateY(Math.PI / 2).rotateZ(giro).translate(0, 0, -LARGO_FLECHA / 2 + 0.06),
      0xff5a2c,
    )),
  ], ['position', 'normal', 'color']));
  const matFlecha = R(new THREE.MeshStandardMaterial({
    vertexColors: true, side: THREE.DoubleSide, roughness: 0.55, metalness: 0.25,
  }));

  function crearFlecha() {
    return new THREE.Mesh(geoFlecha, matFlecha);
  }

  // Sombras de mancha para las flechas en vuelo (ayudan a calcular por dónde vienen)
  const sombrasLibres = [];
  for (let i = 0; i < 8; i++) {
    const s = ctx.crearSombra({ radio: 0.1, opacidad: 0.55 });
    s.visible = false;
    raiz.add(s);
    sombrasLibres.push(s);
  }

  // ─── Marcador ──────────────────────────────────────────────────────────
  const marcador = ctx.crearPanel({ ancho: 1.6, alto: 0.42 });
  marcador.mesh.position.set(0, 3.1, -5);
  raiz.add(marcador.mesh);

  // ─── Estado ────────────────────────────────────────────────────────────
  const flechas = [];
  let puntos = 0;
  let vidas = VIDAS;
  let record = ctx.leer('record', 0);
  let estado = 'intro'; // 'intro' | 'jugando' | 'fin'
  let reloj = 3;
  let tiempoJuego = 0;
  let proximoDisparo = 0;
  let invulnerable = 0;
  let mensaje = '';
  let tiempoMensaje = 0;

  const cabeza = new THREE.Vector3(0, 1.55, 0);
  const torsoArriba = new THREE.Vector3();
  const torsoAbajo = new THREE.Vector3();
  const vistaPos = new THREE.Vector3(0, 1.55, 0);
  const vistaObjetivo = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const tmp2 = new THREE.Vector3();
  const segmento = new THREE.Line3();

  function actualizarMarcador() {
    if (estado === 'intro') {
      marcador.escribir([
        { texto: 'ESQUIVA FLECHAS', tam: 1.3, color: '#ffcc80' },
        { texto: 'Cuando una torre brille en rojo, ¡apártate o agáchate!', tam: 0.75 },
      ]);
    } else if (estado === 'fin') {
      marcador.escribir([
        { texto: `¡Te dieron! ${puntos} puntos`, tam: 1.3, color: '#ffcc80' },
        { texto: `Récord: ${record} · nueva ronda en ${Math.ceil(reloj)}`, tam: 0.75 },
      ]);
    } else {
      const corazones = '♥'.repeat(vidas) + '♡'.repeat(VIDAS - vidas);
      marcador.escribir([
        { texto: `Puntos: ${puntos}   ·   ${corazones}`, tam: 1.3 },
        tiempoMensaje > 0
          ? { texto: mensaje, tam: 0.75, color: '#fff59d' }
          : { texto: `Récord: ${record}   ·   ${Math.floor(tiempoJuego)} s`, tam: 0.75, color: '#ffcc80' },
      ]);
    }
  }

  function avisar(texto) {
    mensaje = texto;
    tiempoMensaje = 1.2;
  }

  // ─── Posición del jugador ──────────────────────────────────────────────
  function actualizarJugador(dt) {
    if (ctx.enVR()) {
      ctx.camara.getWorldPosition(cabeza);
    } else {
      // Ratón: izquierda/derecha para apartarse, abajo para agacharse
      const { ndc } = ctx.raton;
      const x = THREE.MathUtils.clamp(ndc.x, -1, 1) * 0.8;
      const y = 1.55 + THREE.MathUtils.clamp(ndc.y, -1, 1) * (ndc.y < 0 ? 0.6 : 0.25);
      vistaPos.lerp(tmp.set(x, y, 0), Math.min(1, dt * 12));
      vistaObjetivo.set(vistaPos.x * 0.3, 1.45, -6);
      ctx.vistaEscritorio(vistaPos, vistaObjetivo);
      cabeza.copy(vistaPos);
    }
    // Torso aproximado: un segmento vertical debajo de la cabeza
    torsoArriba.set(cabeza.x, cabeza.y - 0.28, cabeza.z + 0.03);
    torsoAbajo.set(cabeza.x, Math.max(0.35, cabeza.y - 0.85), cabeza.z + 0.03);
    segmento.set(torsoAbajo, torsoArriba);
  }

  // ─── Disparos ──────────────────────────────────────────────────────────
  function cargarTorre(progreso) {
    const libres = torres.filter((t) => !t.cargando);
    if (libres.length === 0) return;
    const torre = libres[Math.floor(Math.random() * libres.length)];
    torre.cargando = true;
    torre.t = 0;
    torre.apuntaTorso = Math.random() < 0.15 + progreso * 0.25;
    torre.salida.y = 0.9 + Math.random() * 1.4;
    torre.carga.position.copy(torre.salida);
    torre.carga.visible = true;
    ctx.sonido('tic');
  }

  function disparar(torre, progreso) {
    apagarTorre(torre);
    // Apunta a donde está el jugador ahora, con un poco de error
    const objetivo = tmp.copy(cabeza);
    if (torre.apuntaTorso) objetivo.y -= 0.45;
    objetivo.x += (Math.random() - 0.5) * 0.15;
    objetivo.y += (Math.random() - 0.5) * 0.1;
    const velocidad = 7 + progreso * 7 + Math.random() * 1.5;
    // Apunta un poco más alto para compensar la caída durante el vuelo
    const vuelo = objetivo.distanceTo(torre.salida) / velocidad;
    objetivo.y += 0.5 * GRAVEDAD * vuelo * vuelo;
    const dir = objetivo.sub(torre.salida).normalize();

    const malla = crearFlecha();
    malla.position.copy(torre.salida);
    malla.lookAt(tmp2.copy(torre.salida).add(dir));
    raiz.add(malla);
    flechas.push({
      malla,
      sombra: sombrasLibres.pop() || null,
      vel: dir.clone().multiplyScalar(velocidad),
      punta: torre.salida.clone().addScaledVector(dir, LARGO_FLECHA / 2 + 0.1),
      anterior: new THREE.Vector3(),
      minimo: Infinity,   // distancia mínima a la cabeza
      pasada: false,
      clavada: 0,         // > 0 mientras queda clavada en el suelo
    });
    ctx.sonido('corte');
  }

  function recibirImpacto(flecha) {
    flecha.pasada = true; // ya no puede dar puntos
    if (invulnerable > 0) return;
    vidas -= 1;
    invulnerable = INVULNERABLE;
    ctx.destello(0xff1744, 0.6);
    ctx.sonido('golpe');
    ctx.sonido('fallo');
    for (const mano of ctx.manos) ctx.vibrar(mano, 1, 200);
    flecha.clavada = 1.5;
    flecha.malla.visible = false;
    if (flecha.sombra) flecha.sombra.visible = false;
    if (vidas <= 0) terminar();
  }

  function terminar() {
    estado = 'fin';
    reloj = 5;
    for (const t of torres) apagarTorre(t);
    if (puntos > record) {
      record = puntos;
      ctx.guardar('record', record);
    }
    ctx.sonido('fin');
  }

  function empezar() {
    estado = 'jugando';
    puntos = 0;
    vidas = VIDAS;
    tiempoJuego = 0;
    proximoDisparo = 0.5;
    invulnerable = 0;
  }

  // ─── Movimiento y choques ──────────────────────────────────────────────
  function actualizarFlechas(dt) {
    for (let i = flechas.length - 1; i >= 0; i--) {
      const f = flechas[i];
      if (f.clavada > 0) {
        f.clavada -= dt;
        if (f.clavada <= 0) quitar(i);
        continue;
      }

      f.vel.y -= GRAVEDAD * dt;
      f.anterior.copy(f.punta);
      f.punta.addScaledVector(f.vel, dt);
      f.malla.position.addScaledVector(f.vel, dt);
      f.malla.lookAt(tmp.copy(f.malla.position).add(f.vel));
      if (f.sombra) {
        ctx.colocarSombra(f.sombra, f.malla.position, 0);
        f.sombra.scale.z *= 3.5; // alargada y girada como la flecha
        f.sombra.rotation.y = Math.atan2(f.vel.x, f.vel.z);
      }

      // Recorremos el tramo del fotograma en pasos cortos para no atravesar al jugador
      if (estado === 'jugando' && !f.pasada) {
        const pasos = Math.max(1, Math.ceil(f.anterior.distanceTo(f.punta) / 0.04));
        for (let p = 1; p <= pasos; p++) {
          tmp.lerpVectors(f.anterior, f.punta, p / pasos);
          const dCabeza = tmp.distanceTo(cabeza);
          f.minimo = Math.min(f.minimo, dCabeza);
          if (dCabeza < RADIO_CABEZA || segmento.closestPointToPoint(tmp, true, tmp2).distanceTo(tmp) < RADIO_TORSO) {
            recibirImpacto(f);
            break;
          }
        }
        // Ha pasado de largo: punto (y extra si fue por los pelos)
        if (!f.pasada && tmp.subVectors(f.punta, cabeza).dot(f.vel) > 0.3 * f.vel.length()) {
          f.pasada = true;
          puntos += 1;
          if (f.minimo < CASI) {
            puntos += 1;
            avisar('¡Por los pelos! +2');
            ctx.sonido('punto');
            for (const mano of ctx.manos) ctx.vibrar(mano, 0.3, 40);
          }
        }
      }

      // Se clava en el suelo o se pierde a lo lejos
      if (f.punta.y <= 0.01) {
        f.clavada = 2;
      } else if (f.malla.position.lengthSq() > 400) {
        quitar(i);
      }
    }
  }

  function quitar(i) {
    const { sombra } = flechas[i];
    if (sombra) {
      sombra.visible = false;
      sombrasLibres.push(sombra);
    }
    raiz.remove(flechas[i].malla);
    flechas.splice(i, 1);
  }

  // ─── Bucle del juego ───────────────────────────────────────────────────
  function actualizar(dt, t) {
    actualizarJugador(dt);
    reloj -= dt;
    invulnerable = Math.max(0, invulnerable - dt);
    tiempoMensaje -= dt;

    if (estado === 'intro' && reloj <= 0) {
      empezar();
    } else if (estado === 'jugando') {
      tiempoJuego += dt;
      const progreso = Math.min(1, tiempoJuego / 90);
      proximoDisparo -= dt;
      const maxCargando = 1 + Math.floor(progreso * 2.5);
      if (proximoDisparo <= 0 && torres.filter((x) => x.cargando).length < maxCargando) {
        cargarTorre(progreso);
        proximoDisparo = 1.6 - progreso * 1.0 + Math.random() * 0.4;
      }
      for (const torre of torres) {
        if (!torre.cargando) continue;
        torre.t += dt;
        const f = torre.t / TIEMPO_CARGA;
        const pulso = Math.sin(t * 30);
        torre.carga.scale.setScalar(0.4 + f * 1.0 + pulso * 0.1);
        // La torre entera se enciende en rojo, cada vez más fuerte
        torre.material.emissive.setRGB((0.25 + f * 0.75) * (0.8 + pulso * 0.2), 0.02, 0.01);
        if (f >= 1) disparar(torre, progreso);
      }
    } else if (estado === 'fin' && reloj <= 0) {
      empezar();
    }

    actualizarFlechas(dt);
    actualizarAvisosBorde(t);

    // La zona parpadea mientras eres invulnerable
    zona.visible = invulnerable <= 0 || Math.sin(t * 25) > 0;

    actualizarMarcador();
  }

  actualizarJugador(1);
  actualizarMarcador();

  return {
    actualizar,
    liberar() {
      flechas.length = 0;
    },
  };
}
