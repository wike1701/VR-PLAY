// Jugada de la galería de tiro (VR): una pistola en cada mano. Cada mano elige un muñeco malo que
// esté de pie (los inocentes restan, nunca se les apunta) y estira el brazo hacia su cabeza (3 puntos).
// juegos/tiro/juego.js dispara desde el soporte de la pistola, girado 90°: el cañón va por el -Y del
// grip. Por eso la «punta» de la mano se pone en ese eje (puntaLocal), y así bot-vr.js deja el cañón
// en la línea del hombro al blanco. Antes de apretar el gatillo se lanza el mismo rayo que el juego:
// solo se dispara si da a un muñeco malo.
(() => {
  const LARGO = 0.3;              // de la mano a la «punta» por el eje del cañón
  const BRAZO = 0.5;              // del hombro a la mano, con el brazo casi estirado
  const CANON = -0.2;             // la boca del cañón (como en el juego)
  const CADENCIA = 0.2;           // segundos entre disparos de una pistola (la del juego es 0,18)
  const ADELANTO = 0.08;          // cuánto se adelanta la mira a los muñecos que se mueven

  const estado = [{}, {}].map(() => ({ objetivo: null, gatillo: 0, espera: 0, apuntando: 0 }));
  const previo = new WeakMap();   // última posición de cada cabeza, para su velocidad
  let rayo = null;

  function hombroDe(api, mano) {
    const c = api.cabeza.pos;
    return new api.V3(c.x + mano.signo * 0.18, c.y - 0.28, c.z);
  }

  // Muñecos de pie (subiendo o arriba): su cabeza y su cuerpo
  function munecos(api) {
    const lista = [];
    const vistos = new Set();
    api.buscar((m) => m.isMesh && m.userData?.muneco).forEach(({ malla }) => {
      const mu = malla.userData.muneco;
      if (vistos.has(mu)) return;
      vistos.add(mu);
      if (mu.estado !== 'arriba' && mu.estado !== 'subiendo') return;
      const p = mu.cabeza.getWorldPosition(new api.V3());
      const antes = previo.get(mu);
      const vel = antes ? p.clone().sub(antes.p).divideScalar(Math.max(1e-3, (performance.now() - antes.t) / 1000)) : new api.V3();
      if (!antes || performance.now() - antes.t > 20) previo.set(mu, { p: p.clone(), t: performance.now() });
      lista.push({ mu, p, vel });
    });
    return lista;
  }

  // ¿A qué da ahora mismo la pistola de esta mano? (el mismo rayo que lanza el juego)
  function aQueDa(api, mano, activos) {
    const grip = api.fab.manos?.[mano.i]?.grip;
    if (!grip || !activos.length) return null;
    let laser = null;
    grip.traverse((o) => { if (o.isLine && !laser) laser = o; });
    const soporte = laser?.parent?.parent;
    if (!soporte) return null;
    soporte.updateMatrixWorld(true);
    rayo ??= new api.THREE.Raycaster();
    rayo.far = 25;
    const origen = soporte.localToWorld(new api.V3(0, 0.03, CANON));
    const dir = new api.V3(0, 0, -1).transformDirection(soporte.matrixWorld);
    rayo.set(origen, dir);
    const mallas = activos.flatMap((o) => [o.mu.cuerpo, o.mu.cabeza]);
    return rayo.intersectObjects(mallas, false)[0] || null;
  }

  window.__jugada = {
    vr(api, ahora, dt) {
      const todos = munecos(api);
      const malos = todos.filter((o) => !o.mu.inocente);
      const usados = new Set();
      api.manos.forEach((mano, i) => {
        const e = estado[i];
        mano.puntaLocal = new api.V3(0, -LARGO, 0);
        mano.rigidez = 140;
        e.espera -= dt;
        // El blanco: el que ya tenía si sigue de pie; si no, el malo de su lado más cercano a la mira
        if (e.objetivo && !malos.some((o) => o.mu === e.objetivo)) e.objetivo = null;
        if (!e.objetivo) {
          const otro = estado[1 - i].objetivo;
          const libres = malos.filter((o) => o.mu !== otro && !usados.has(o.mu));
          const delLado = libres.filter((o) => Math.sign(o.p.x || 1) === mano.signo);
          const lista = delLado.length ? delLado : libres;
          lista.sort((a, b) => a.p.distanceTo(mano.punta) - b.p.distanceTo(mano.punta));
          e.objetivo = lista[0]?.mu || null;
          e.apuntando = 0;
        }
        if (e.objetivo) usados.add(e.objetivo);
        const o = malos.find((x) => x.mu === e.objetivo);
        const hombro = hombroDe(api, mano);
        let blanco;
        if (o) {
          blanco = o.p.clone().addScaledVector(o.vel, ADELANTO);
          e.apuntando += dt;
        } else {
          // Sin blanco: el brazo baja un poco, apuntando al suelo de la galería
          blanco = new api.V3(mano.signo * 0.9, 0.6, -5);
        }
        const dir = blanco.sub(hombro).normalize();
        mano.meta.copy(hombro).addScaledVector(dir, BRAZO + LARGO);
        // Gatillo: se aprieta un instante cuando el rayo da a un malo y se suelta enseguida
        if (e.gatillo > 0) {
          e.gatillo -= dt;
          mano.gatillo = e.gatillo > 0 ? 1 : 0;
        } else {
          mano.gatillo = 0;
          if (o && e.espera <= 0 && e.apuntando > 0.12) {
            const choque = aQueDa(api, mano, todos);
            if (choque && !choque.object.userData.muneco.inocente) {
              e.gatillo = 0.07;
              e.espera = CADENCIA;
              mano.gatillo = 1;
              api.bot.clics++;
            }
          }
        }
      });
      // La cabeza mira hacia donde están los blancos
      const vivos = estado.map((e) => malos.find((o) => o.mu === e.objetivo)).filter(Boolean);
      const mira = vivos.length ? vivos.reduce((s, o) => s.add(o.p), new api.V3()).divideScalar(vivos.length) : new api.V3(0, 1.2, -6);
      api.cabeza.mira.lerp(mira, Math.min(1, dt * 4));
    },
  };
})();
