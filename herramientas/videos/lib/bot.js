// Jugador automático de VR Play. Se ejecuta DENTRO de la página (Playwright lo carga con
// addInitScript) y juega en modo ratón mandando al lienzo los mismos eventos que un ratón de verdad
// (pointermove / pointerdown / pointerup). Ve el juego con window.__fabrica (la escena y la cámara
// que expone lib/servidor.mjs): cada fotograma proyecta a la pantalla los objetos pequeños que se
// mueven o acaban de moverse, y según el modo de lib/estrategias.mjs los persigue y hace clic,
// los sigue, los atraviesa o pulsa y suelta. Se mueve con un muelle amortiguado (como una mano,
// nunca a saltos) y deja en __bot.rastro la posición del puntero para dibujar el toque en el vídeo.
window.__iniciarBot = function iniciarBot(cfg) {
  const fab = window.__fabrica;
  const lienzo = document.querySelector('canvas');
  const W = innerWidth;
  const H = innerHeight;
  const Vector3 = fab.camara.position.constructor;
  const v = new Vector3();
  const escala = new Vector3();
  const rastro = [];
  const bot = (window.__bot = { rastro, clics: 0, objetivos: 0 });

  const p = { x: W * (cfg.reposo?.[0] ?? 0.5), y: H * (cfg.reposo?.[1] ?? 0.55), vx: 0, vy: 0, pulsado: false };
  const info = new WeakMap(); // por malla: posición en pantalla, velocidad, cuándo se movió
  let objetivo = null;
  let objetivoDesde = 0;
  let enfriar = 0;
  let ultimoClicLibre = 0;
  let barrido = null;
  let fase = { estado: 'espera', hasta: 0 };
  let tAnterior = performance.now();
  const t0 = performance.now();
  const golpeados = new WeakMap();

  const evento = (tipo, destino = lienzo) =>
    destino.dispatchEvent(new PointerEvent(tipo, {
      clientX: p.x, clientY: p.y, pointerType: 'mouse', pointerId: 1, isPrimary: true,
      button: 0, buttons: p.pulsado ? 1 : 0, bubbles: true,
    }));
  const pulsar = () => {
    p.pulsado = true;
    evento('pointerdown');
    bot.clics++;
    fab.eventos.push({ tipo: 'clic', x: p.x / W, y: p.y / H, t: performance.now() });
  };
  const soltar = () => {
    p.pulsado = false;
    evento('pointerup', window);
  };
  const clic = () => {
    pulsar();
    setTimeout(soltar, 70);
  };

  const oscuro = (m) => m.isMesh && m.material?.color && 0.3 * m.material.color.r + 0.59 * m.material.color.g + 0.11 * m.material.color.b < 0.12;
  let peligros = [];
  // ¿Pasa el segmento a→b a menos de «margen» de algún peligro?
  const cruzaPeligro = (ax, ay, bx, by, margen) => peligros.some((q) => {
    const lx = bx - ax, ly = by - ay;
    const u = Math.max(0, Math.min(1, ((q.x - ax) * lx + (q.y - ay) * ly) / (lx * lx + ly * ly || 1)));
    return Math.hypot(ax + lx * u - q.x, ay + ly * u - q.y) < q.r + margen;
  });

  // Los objetos candidatos de este fotograma: { malla, x, y, r, vel, movido }
  function candidatos(ahora, dt) {
    const raiz = fab.escena.children.find((c) => c.name?.startsWith('juego-'));
    const lista = [];
    peligros = [];
    if (!raiz) return lista;
    const camara = fab.camara;
    const tanMedio = Math.tan((camara.fov * Math.PI) / 360);
    raiz.traverseVisible((m) => {
      if (!m.isMesh || !m.geometry) return;
      if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
      const esfera = m.geometry.boundingSphere;
      if (!esfera || !Number.isFinite(esfera.radius)) return;
      v.copy(esfera.center).applyMatrix4(m.matrixWorld);
      const mundo = v.clone();
      m.getWorldScale(escala);
      const distancia = mundo.distanceTo(camara.position);
      v.project(camara);
      if (v.z > 1 || v.z < -1) return;
      const x = (v.x * 0.5 + 0.5) * W;
      const y = (-v.y * 0.5 + 0.5) * H;
      const radioMundo = esfera.radius * Math.max(escala.x || 1, escala.y || 1, escala.z || 1);
      const r = (radioMundo / (distancia * tanMedio)) * (H / 2);
      let d = info.get(m);
      if (!d) {
        d = { x, y, vx: 0, vy: 0, mundo: mundo.clone(), velMundo: 0, movido: -1e9, visto: ahora, herramienta: 0 };
        info.set(m, d);
      } else if (dt > 0) {
        const vx = (x - d.x) / dt;
        const vy = (y - d.y) / dt;
        d.vx += (vx - d.vx) * 0.4;
        d.vy += (vy - d.vy) * 0.4;
        d.velMundo += (mundo.distanceTo(d.mundo) / dt - d.velMundo) * 0.4;
        d.x = x;
        d.y = y;
        d.mundo.copy(mundo);
        // Lo que se mueve igual que el puntero es la herramienta del jugador (martillo, pala…)
        const velP = Math.hypot(p.vx, p.vy);
        if (velP > 80 && Math.hypot(d.vx - p.vx, d.vy - p.vy) < velP * 0.35) d.herramienta = Math.min(d.herramienta + 1, 60);
        else if (d.herramienta > 0 && velP > 80) d.herramienta -= 0.25;
      }
      const vel = Math.hypot(d.vx, d.vy);
      if (vel > (cfg.velMin ?? 40) || d.velMundo > (cfg.velMundoMin ?? 0.2)) d.movido = ahora;
      if (d.herramienta > 6) return;
      if (r < (cfg.minPx ?? 5) || r > H * (cfg.maxFraccion ?? 0.2)) return;
      if (x < 20 || x > W - 20 || y < H * (cfg.arriba ?? 0.06) || y > H * (cfg.abajo ?? 0.97)) return;
      if (cfg.soloAbajoDe && y < H * cfg.soloAbajoDe) return;
      if (ahora - d.movido > (cfg.memoria ?? 1.2) * 1000) return;
      if (ahora - t0 < 1500 && ahora - d.visto < 1500 && vel < 1) return; // lo que ya estaba quieto al empezar
      // Lo casi negro (bombas), con lo que cuelga de su mismo grupo (mecha, chispa), es un peligro
      // (lo que cuelga de otra malla es un adorno de esa malla: semillas, rabitos…)
      if (cfg.evitarOscuros && !m.parent?.isMesh && (oscuro(m) || (m.parent !== raiz && m.parent?.children.some(oscuro)))) {
        peligros.push({ x, y, r });
        return;
      }
      if (cfg.evitarOscuros && m.parent?.isMesh) return;
      lista.push({ malla: m, x, y, r, vx: d.vx, vy: d.vy, vel });
    });
    return lista;
  }

  function moverHacia(gx, gy, dt, rigidez) {
    const k = rigidez;
    const c = 2 * Math.sqrt(k) * 0.9; // casi crítico: llega rápido, sin oscilar apenas
    const ax = k * (gx - p.x) - c * p.vx;
    const ay = k * (gy - p.y) - c * p.vy;
    p.vx += ax * dt;
    p.vy += ay * dt;
    p.x = Math.min(W - 2, Math.max(2, p.x + p.vx * dt));
    p.y = Math.min(H - 2, Math.max(2, p.y + p.vy * dt));
  }

  function paso() {
    const ahora = performance.now();
    const dt = Math.min(0.05, (ahora - tAnterior) / 1000);
    tAnterior = ahora;
    enfriar -= dt;
    const lista = candidatos(ahora, dt);
    bot.objetivos = Math.max(bot.objetivos, lista.length);
    bot.lista = lista;
    const modo = cfg.modo;
    const reposo = [W * (cfg.reposo?.[0] ?? 0.5), H * (cfg.reposo?.[1] ?? 0.55)];

    if (modo === 'clic') {
      const libres = lista.filter((o) => !(golpeados.get(o.malla) > ahora));
      if (objetivo && (!lista.includes(objetivo) || ahora - objetivoDesde > 1600)) objetivo = null;
      const actual = objetivo && lista.find((o) => o.malla === objetivo.malla);
      objetivo = actual || libres.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y))[0] || null;
      if (objetivo && !actual) objetivoDesde = ahora;
      if (objetivo) {
        const adelanto = cfg.adelanto ?? 0.08;
        const gx = objetivo.x + objetivo.vx * adelanto;
        const gy = objetivo.y + objetivo.vy * adelanto + (cfg.desfaseY ?? 0) * H;
        moverHacia(gx, gy, dt, cfg.rigidez ?? 160);
        const cerca = Math.hypot(gx - p.x, gy - p.y) < Math.max(10, objetivo.r * 0.5);
        if (cerca && enfriar <= 0 && !p.pulsado) {
          clic();
          enfriar = cfg.cadencia ?? 0.28;
          golpeados.set(objetivo.malla, ahora + (cfg.olvidar ?? 0.7) * 1000);
          objetivo = null;
        }
      } else moverHacia(reposo[0], reposo[1], dt, 20);
    } else if (modo === 'seguir') {
      const bola = lista.sort((a, b) => b.vel - a.vel)[0];
      if (bola) moverHacia(bola.x + (cfg.desfaseX ?? 0) * W, Math.max(H * (cfg.yMin ?? 0), bola.y + (cfg.desfaseY ?? 0) * H), dt, cfg.rigidez ?? 120);
      else moverHacia(reposo[0], reposo[1], dt, 25);
    } else if (modo === 'barrer') {
      // Un tajo rápido desde donde está el puntero, a través del objeto y más allá, siguiéndolo
      if (!barrido && enfriar <= 0) {
        const largo = cfg.largo ?? 220;
        const fruta = lista.sort((a, b) => Math.hypot(a.x - p.x, a.y - p.y) - Math.hypot(b.x - p.x, b.y - p.y)).find((o) => {
          const d = Math.hypot(o.x - p.x, o.y - p.y) || 1;
          return !cruzaPeligro(p.x, p.y, o.x + ((o.x - p.x) / d) * largo, o.y + ((o.y - p.y) / d) * largo, 50);
        });
        if (fruta) {
          let dx = fruta.x - p.x;
          let dy = fruta.y - p.y;
          const d = Math.hypot(dx, dy);
          if (d < 1) [dx, dy] = [1, 0];
          barrido = { malla: fruta.malla, dx: dx / (d || 1), dy: dy / (d || 1), x: fruta.x, y: fruta.y, vx: fruta.vx, vy: fruta.vy, desde: ahora };
        }
      }
      if (barrido) {
        const sigue = lista.find((o) => o.malla === barrido.malla);
        if (sigue) Object.assign(barrido, { x: sigue.x, y: sigue.y, vx: sigue.vx, vy: sigue.vy });
        const largo = cfg.largo ?? 220;
        const fx = barrido.x + barrido.vx * 0.05;
        const fy = barrido.y + barrido.vy * 0.05;
        moverHacia(fx + barrido.dx * largo, fy + barrido.dy * largo, dt, cfg.rigidez ?? 700);
        const pasado = (p.x - fx) * barrido.dx + (p.y - fy) * barrido.dy;
        const peligro = cruzaPeligro(p.x, p.y, fx + barrido.dx * largo, fy + barrido.dy * largo, 30);
        if (peligro) { p.vx *= 0.2; p.vy *= 0.2; } // frenar en seco antes de tocar la bomba
        if (peligro || pasado > largo * 0.6 || ahora - barrido.desde > 700) {
          barrido = null;
          enfriar = cfg.cadencia ?? 0.1;
        }
      } else moverHacia(reposo[0], reposo[1], dt, 15);
    } else if (modo === 'mantener') {
      const punto = cfg.punto || [0.5, 0.45];
      const objetivoMantener = cfg.apuntarObjetivo && lista[0];
      const gx = objetivoMantener ? objetivoMantener.x : punto[0] * W;
      const gy = objetivoMantener ? objetivoMantener.y : punto[1] * H;
      moverHacia(gx + Math.sin(ahora / 700) * (cfg.balanceo ?? 0) * W, gy, dt, 60);
      if (ahora >= fase.hasta) {
        const [pMin, pMax] = cfg.pulsar || [0.6, 1.2];
        const [eMin, eMax] = cfg.esperar || [1.2, 2];
        if (fase.estado === 'espera') {
          pulsar();
          fase = { estado: 'pulsado', hasta: ahora + (pMin + Math.random() * (pMax - pMin)) * 1000 };
        } else {
          soltar();
          fase = { estado: 'espera', hasta: ahora + (eMin + Math.random() * (eMax - eMin)) * 1000 };
        }
      }
    }

    // Un clic de vez en cuando sin objetivo: muchos juegos empiezan o reinician con un clic
    if (cfg.clicLibre && modo !== 'mantener' && ahora - ultimoClicLibre > cfg.clicLibre * 1000 && !p.pulsado) {
      ultimoClicLibre = ahora;
      clic();
    }

    evento('pointermove');
    rastro.push([Math.round(ahora - t0), +(p.x / W).toFixed(4), +(p.y / H).toFixed(4), p.pulsado ? 1 : 0]);
    requestAnimationFrame(paso);
  }
  evento('pointermove');
  requestAnimationFrame(paso);
  return true;
};
