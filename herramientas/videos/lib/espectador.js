// Plano de espectador: un segundo lienzo que dibuja la misma escena del juego desde una cámara
// detrás y a un lado del jugador, con un avatar sencillo (cabeza con gafas, cuerpo y brazos hasta
// los mandos, que llevan la herramienta del propio juego). Se ejecuta DENTRO de la página, en modo
// VR; lib/grabar.mjs graba este lienzo a la vez que el de las gafas.
// El avatar va en la capa 5: la cámara de las gafas no lo ve (la 1 y la 2 son de los ojos en Three).
window.__iniciarEspectador = function iniciarEspectador(cfg = {}) {
  const fab = window.__fabrica;
  const THREE = fab.THREE;
  const ancho = cfg.ancho ?? 1080;
  const alto = cfg.alto ?? 1920;
  const lienzo = document.createElement('canvas');
  lienzo.width = ancho;
  lienzo.height = alto;
  // Fuera de la vista, pero en la página (si no, Chrome no le saca fotogramas)
  Object.assign(lienzo.style, { position: 'fixed', left: '-20000px', top: '0', width: ancho + 'px', height: alto + 'px' });
  document.body.appendChild(lienzo);
  const rend = new THREE.WebGLRenderer({ canvas: lienzo, antialias: true, preserveDrawingBuffer: true });
  rend.setPixelRatio(1);
  rend.setSize(ancho, alto, false);
  rend.outputColorSpace = fab.renderer.outputColorSpace;
  rend.toneMapping = fab.renderer.toneMapping;
  rend.toneMappingExposure = fab.renderer.toneMappingExposure;
  rend.shadowMap.enabled = fab.renderer.shadowMap.enabled;

  const camara = new THREE.PerspectiveCamera(cfg.fov ?? 50, ancho / alto, 0.05, 200);
  camara.layers.enable(5);
  const pos = new THREE.Vector3(...(cfg.pos || [0.95, 1.85, 1.3]));
  const mira = new THREE.Vector3(...(cfg.mira || [-0.15, 1.0, -0.6]));

  // ─── Avatar con primitivas ──────────────────────────────────────────
  const { Mesh, Group: Grupo } = THREE;
  const geos = THREE;
  const mat = (color, extra = {}) => new THREE.MeshStandardMaterial({ color, roughness: 0.55, metalness: 0.1, ...extra });
  const enCapa = (o) => { o.traverse((h) => { h.layers.set(5); h.frustumCulled = false; }); return o; };

  const piel = mat(cfg.piel ?? 0xc98d6b);
  const ropa = mat(cfg.ropa ?? 0x2b2f4a);
  const cabeza = new Grupo();
  const craneo = new Mesh(new geos.SphereGeometry(0.105, 24, 16), mat(0x2a1d17));
  craneo.scale.set(1, 1.08, 1.05);
  craneo.position.set(0, 0.02, 0.03);
  const cara = new Mesh(new geos.SphereGeometry(0.095, 20, 14), piel);
  cara.position.set(0, -0.03, -0.01);
  const gafas = new Mesh(new geos.BoxGeometry(0.19, 0.105, 0.11), mat(0xf4f4f6, { roughness: 0.35 }));
  gafas.position.set(0, 0.005, -0.1);
  const visor = new Mesh(new geos.BoxGeometry(0.175, 0.085, 0.01), mat(0x14141c, { roughness: 0.15, metalness: 0.4 }));
  visor.position.set(0, 0.005, -0.157);
  const correa = new Mesh(new geos.CylinderGeometry(0.112, 0.112, 0.03, 24, 1, true), mat(cfg.marca ?? 0x7c5cff));
  correa.position.set(0, 0.01, 0.02);
  cabeza.add(craneo, cara, gafas, visor, correa);

  const cuerpo = new Grupo();
  const torso = new Mesh(new geos.CapsuleGeometry(0.16, 0.36, 6, 16), ropa);
  torso.scale.set(1, 1, 0.62);
  torso.position.y = -0.24;
  const cuello = new Mesh(new geos.CylinderGeometry(0.045, 0.05, 0.1, 12), piel);
  cuello.position.y = 0.04;
  cuerpo.add(torso, cuello);

  const brazos = [0, 1].map(() => {
    const g = new Grupo();
    const b = new Mesh(new geos.CylinderGeometry(0.042, 0.036, 1, 12), ropa);
    b.position.y = 0.5;
    const mano = new Mesh(new geos.SphereGeometry(0.045, 14, 10), piel);
    mano.position.y = 1;
    g.add(b, mano);
    return { g, b, mano };
  });
  const avatar = new Grupo();
  avatar.add(cabeza, cuerpo, ...brazos.map((x) => x.g));
  fab.escena.add(enCapa(avatar));

  // Los botones de los hombros de la shell (cambiar de juego, pausa) quedan entre esta cámara y el
  // jugador: no se dibujan en este plano
  const ocultar = [];
  fab.escena.traverse((o) => { if (/^boton-(cambio|pausa)$/.test(o.name)) ocultar.push(o.parent?.isScene ? o : o.parent); });

  const cab = new THREE.Vector3();
  const delante = new THREE.Vector3();
  const hombro = new THREE.Vector3();
  const muneca = new THREE.Vector3();
  const arriba = new THREE.Vector3(0, 1, 0);
  function actualizarAvatar() {
    fab.camara.updateMatrixWorld();
    // En VR, Three copia la pose de las gafas en la cámara del juego
    const xrCam = fab.renderer.xr.isPresenting ? fab.renderer.xr.getCamera() : fab.camara;
    xrCam.matrixWorld.decompose(cab, cabeza.quaternion, delante);
    cabeza.position.copy(cab);
    delante.set(0, 0, -1).applyQuaternion(cabeza.quaternion).setY(0).normalize();
    // El cuerpo bajo la cabeza, un poco atrás, girado hacia donde mira (sin inclinarse)
    cuerpo.position.copy(cab).addScaledVector(delante, -0.06);
    cuerpo.position.y -= 0.2;
    cuerpo.rotation.set(0, Math.atan2(-delante.x, -delante.z), 0);
    brazos.forEach((br, i) => {
      const grip = fab.manos[i]?.grip;
      const visible = !!grip?.visible && fab.manos[i].conectado;
      br.g.visible = visible;
      if (!visible) return;
      const lado = new THREE.Vector3().crossVectors(delante, arriba).normalize();
      const signo = fab.manos[i].lado === 'left' ? -1 : 1;
      hombro.copy(cuerpo.position).addScaledVector(lado, signo * 0.19);
      hombro.y += -0.02;
      grip.updateMatrixWorld();
      muneca.setFromMatrixPosition(grip.matrixWorld);
      const dir = muneca.clone().sub(hombro);
      const largo = Math.max(0.05, dir.length());
      br.g.position.copy(hombro);
      br.g.quaternion.setFromUnitVectors(arriba, dir.normalize());
      br.b.scale.set(1, largo, 1);
      br.b.position.y = largo / 2;
      br.mano.position.y = largo;
    });
  }

  const esp = (window.__espectador = { lienzo, fotogramas: 0 });
  function paso() {
    actualizarAvatar();
    const s = performance.now() / 1000;
    // Un vaivén lento de cámara, como alguien grabando con el móvil
    camara.position.set(pos.x + Math.sin(s * 0.31) * 0.08, pos.y + Math.sin(s * 0.47) * 0.03, pos.z + Math.sin(s * 0.23) * 0.05);
    camara.lookAt(mira);
    const antes = ocultar.map((o) => o.visible);
    ocultar.forEach((o) => (o.visible = false));
    rend.render(fab.escena, camara);
    ocultar.forEach((o, i) => (o.visible = antes[i]));
    esp.fotogramas++;
    requestAnimationFrame(paso);
  }
  requestAnimationFrame(paso);
  return true;
};
