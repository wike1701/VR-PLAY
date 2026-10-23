// Jugador automático en VR. Se ejecuta DENTRO de la página, con unas gafas simuladas (IWER, que
// lib/grabar.mjs instala en window.__xr antes de que cargue la shell). Mueve la cabeza y los dos
// mandos de verdad (posición, giro y gatillo), así que el juego lo ve igual que unas Quest: cada
// juego pone su martillo, raqueta o espada en el mando y detecta los golpes con su propia física.
// Ve el juego con window.__fabrica: busca en el mundo 3D los objetos pequeños que se mueven o
// acaban de moverse, al alcance del brazo, y según el modo de lib/estrategias.mjs (campo vr):
//   golpear  martillazo de arriba abajo sobre el objeto (topos, latas, piñata…)
//   barrer   tajo rápido que lo atraviesa de lado a lado (fruta)
//   seguir   lleva la mano a la bola (porteros, palas)
//   lanzar   coge con el gatillo, echa el brazo atrás y suelta hacia delante (canastas, bolos…)
// Cada mano va con un muelle amortiguado, como un brazo: nunca a saltos.
window.__iniciarBotVR = function iniciarBotVR(cfg) {
  const fab = window.__fabrica;
  const xr = window.__xr;
  const V3 = fab.camara.position.constructor;
  const Quat = fab.camara.quaternion.constructor;
  const Euler = fab.camara.rotation.constructor;
  const bot = (window.__bot = { rastro: [], clics: 0, objetivos: 0 });
  const t0 = performance.now();
  let tAnterior = t0;

  const ALTURA = cfg.altura ?? 1.6;
  const cabeza = { pos: new V3(0, ALTURA, 0), mira: new V3(...(cfg.mirar || [0, 1.1, -1])), vel: new V3() };
  const LADOS = ['left', 'right'];
  const manos = LADOS.map((lado, i) => {
    const signo = i === 0 ? -1 : 1;
    const reposo = new V3(signo * 0.22, ALTURA - 0.45, -0.35);
    return {
      lado, signo, i, reposo,
      control: xr.controllers[lado],
      punta: reposo.clone(), vel: new V3(),
      puntaLocal: null, puntaRevisada: 0,
      estado: 'reposo', objetivo: null, meta: reposo.clone(), desde: 0, enfriar: 0, gatillo: 0,
    };
  });

  // ─── Objetos del juego ─────────────────────────────────────────────────
  const info = new WeakMap();
  const golpeados = new WeakMap();
  const tmp = new V3();
  const escala = new V3();
  const oscuro = (m) => m.isMesh && m.material?.color && 0.3 * m.material.color.r + 0.59 * m.material.color.g + 0.11 * m.material.color.b < 0.12;
  let peligros = [];

  function candidatos(ahora, dt) {
    const raiz = fab.escena.children.find((c) => c.name?.startsWith('juego-'));
    const lista = [];
    peligros = [];
    if (!raiz) return lista;
    const alcance = cfg.alcance ?? 1.15;
    raiz.traverseVisible((m) => {
      if (!m.isMesh || !m.geometry) return;
      if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
      const esfera = m.geometry.boundingSphere;
      if (!esfera || !Number.isFinite(esfera.radius)) return;
      const mundo = tmp.copy(esfera.center).applyMatrix4(m.matrixWorld);
      m.getWorldScale(escala);
      const r = esfera.radius * Math.max(escala.x || 1, escala.y || 1, escala.z || 1);
      let d = info.get(m);
      if (!d) {
        d = { mundo: mundo.clone(), vel: new V3(), rapidez: 0, movido: -1e9, visto: ahora };
        info.set(m, d);
      } else if (dt > 0) {
        const v = mundo.clone().sub(d.mundo).divideScalar(dt);
        d.vel.lerp(v, 0.4);
        d.rapidez = d.vel.length();
        d.mundo.copy(mundo);
      }
      if (d.rapidez > (cfg.velMin ?? 0.15)) d.movido = ahora;
      if (r < (cfg.radioMin ?? 0.02) || r > (cfg.radioMax ?? 0.35)) return;
      const horizontal = Math.hypot(d.mundo.x - cabeza.pos.x, d.mundo.z - cabeza.pos.z);
      if (horizontal > alcance || d.mundo.y < (cfg.yMin ?? 0.3) || d.mundo.y > (cfg.yMax ?? 2.3)) return;
      if (d.mundo.z > cabeza.pos.z + 0.1) return; // lo que queda detrás del jugador
      if (ahora - d.movido > (cfg.memoria ?? 1.2) * 1000) return;
      if (ahora - t0 < 1500 && ahora - d.visto < 1500 && d.rapidez < 0.01) return;
      if (cfg.evitarOscuros && !m.parent?.isMesh && (oscuro(m) || (m.parent !== raiz && m.parent?.children.some(oscuro)))) {
        peligros.push({ p: d.mundo.clone(), r });
        return;
      }
      if (cfg.evitarOscuros && m.parent?.isMesh) return;
      if (cfg.modo === 'golpear' && d.vel.y < -(cfg.bajando ?? 0.6)) return; // se está escondiendo: ya no llega
      lista.push({ malla: m, p: d.mundo.clone(), vel: d.vel.clone(), rapidez: d.rapidez, r });
    });
    // Las piezas de un mismo objeto (ojos, nariz…) cuentan como uno: el mayor
    lista.sort((a, b) => b.r - a.r);
    return lista.filter((o, i) => !lista.slice(0, i).some((x) => x.p.distanceTo(o.p) < (cfg.juntar ?? 0.1)));
  }

  // ─── Manos ─────────────────────────────────────────────────────────────
  // La «punta» es lo que golpea: el centro de la pieza del mando más alejada de la mano (la cabeza
  // del martillo, la hoja de la espada…). Sin herramienta, la propia mano.
  function revisarPunta(mano, ahora) {
    if (ahora - mano.puntaRevisada < 1000) return;
    mano.puntaRevisada = ahora;
    if (cfg.punta) { mano.puntaLocal = new V3(...cfg.punta); return; } // dada en lib/estrategias.mjs (en el espacio del mando)
    const grip = fab.manos?.[mano.i]?.grip;
    if (!grip) return;
    let mejor = null;
    let lejos = 0.06;
    grip.updateMatrixWorld(true);
    grip.traverseVisible((m) => {
      if (!m.isMesh || !m.geometry) return;
      if (!m.geometry.boundingSphere) m.geometry.computeBoundingSphere();
      const c = grip.worldToLocal(m.geometry.boundingSphere.center.clone().applyMatrix4(m.matrixWorld));
      // Una pieza larga (la hoja de una espada) corta mejor cerca de la punta que en el centro
      const r = m.geometry.boundingSphere.radius;
      if (r > 0.2 && c.length() > 0.01) c.addScaledVector(c.clone().normalize(), r * 0.6);
      // Más allá de 1 m no es la herramienta (estelas y efectos con la geometría en el mundo)
      if (c.length() > lejos && c.length() < 1) { lejos = c.length(); mejor = c; }
    });
    mano.puntaLocal = mejor;
  }

  // El grip que ve el juego no coincide con la pose que se le da al mando de IWER (va girado y algo
  // desplazado, como en unas Quest). Se mide ese desfase al empezar, con las manos quietas, y luego
  // se descuenta: así la herramienta queda justo donde el bot quiere.
  const desfase = manos.map(() => ({ q: new Quat(), p: new V3(), medido: false }));
  function medirDesfase(mano) {
    const grip = fab.manos?.[mano.i]?.grip;
    if (!grip) return;
    grip.updateMatrixWorld(true);
    const gp = new V3();
    const gq = new Quat();
    grip.matrixWorld.decompose(gp, gq, new V3());
    const cq = new Quat(mano.control.quaternion.x, mano.control.quaternion.y, mano.control.quaternion.z, mano.control.quaternion.w);
    const cp = new V3(mano.control.position.x, mano.control.position.y, mano.control.position.z);
    const inv = cq.clone().invert();
    const d = desfase[mano.i];
    d.q.copy(inv).multiply(gq);
    d.p.copy(gp).sub(cp).applyQuaternion(inv);
    d.medido = true;
  }

  const giro = new Quat();
  const eje = new V3();
  function colocarMando(mano) {
    // El brazo sale del hombro hacia la punta: la herramienta queda en esa línea
    const hombro = tmp.set(cabeza.pos.x + mano.signo * 0.18, cabeza.pos.y - 0.28, cabeza.pos.z);
    const dir = mano.punta.clone().sub(hombro);
    if (dir.lengthSq() < 1e-4) dir.set(0, -0.3, -1);
    dir.normalize();
    let pos;
    if (mano.puntaLocal) {
      giro.setFromUnitVectors(eje.copy(mano.puntaLocal).normalize(), dir);
      pos = mano.punta.clone().sub(mano.puntaLocal.clone().applyQuaternion(giro));
    } else {
      giro.setFromEuler(new Euler(Math.asin(Math.max(-1, Math.min(1, dir.y))) - 0.3, Math.atan2(-dir.x, -dir.z), 0, 'YXZ'));
      pos = mano.punta.clone();
    }
    // giro y pos son los del grip: se pasan a los del mando
    const d = desfase[mano.i];
    if (d.medido) {
      giro.multiply(d.q.clone().invert());
      pos.sub(d.p.clone().applyQuaternion(giro));
    }
    mano.control.position.set(pos.x, pos.y, pos.z);
    mano.control.quaternion.set(giro.x, giro.y, giro.z, giro.w);
    mano.control.updateButtonValue('trigger', mano.gatillo);
  }

  function mover(mano, dt, k) {
    const c = 2 * Math.sqrt(k) * 0.9;
    const a = mano.meta.clone().sub(mano.punta).multiplyScalar(k).sub(mano.vel.clone().multiplyScalar(c));
    mano.vel.addScaledVector(a, dt);
    const tope = cfg.velMax ?? 7;
    if (mano.vel.length() > tope) mano.vel.setLength(tope);
    mano.punta.addScaledVector(mano.vel, dt);
  }

  const cruzaPeligro = (a, b, margen) => peligros.some((q) => {
    const ab = b.clone().sub(a);
    const u = Math.max(0, Math.min(1, q.p.clone().sub(a).dot(ab) / (ab.lengthSq() || 1)));
    return a.clone().addScaledVector(ab, u).distanceTo(q.p) < q.r + margen;
  });

  function libre(lista, ahora, ocupados) {
    return lista.filter((o) => !(golpeados.get(o.malla) > ahora) && !ocupados.includes(o.malla));
  }
  // La mano de ese lado; si está ocupada, la otra
  function manoPara(o) {
    const propia = manos[o.p.x < cabeza.pos.x ? 0 : 1];
    if (propia.estado === 'reposo' && propia.enfriar <= 0) return propia;
    const otra = manos[1 - propia.i];
    return otra.estado === 'reposo' && otra.enfriar <= 0 ? otra : null;
  }

  function pasoGolpear(lista, ahora, dt) {
    const ocupados = manos.map((m) => m.objetivo?.malla).filter(Boolean);
    for (const o of libre(lista, ahora, ocupados).sort((a, b) => a.p.distanceTo(cabeza.pos) - b.p.distanceTo(cabeza.pos))) {
      const mano = manoPara(o);
      if (!mano) break;
      Object.assign(mano, { estado: 'ir', objetivo: o, desde: ahora });
    }
    for (const mano of manos) {
      mano.enfriar -= dt;
      const o = mano.objetivo && (lista.find((x) => x.malla === mano.objetivo.malla) || mano.objetivo);
      if (mano.estado === 'ir') {
        mano.objetivo = o;
        mano.meta.copy(o.p).addScaledVector(o.vel, 0.1).y += cfg.alto ?? 0.2;
        mover(mano, dt, cfg.rigidez ?? 300);
        if (mano.punta.distanceTo(mano.meta) < 0.05 || ahora - mano.desde > 600) Object.assign(mano, { estado: 'golpe', desde: ahora });
      } else if (mano.estado === 'golpe') {
        mano.meta.copy(o.p).y -= cfg.hondo ?? 0.1;
        mano.gatillo = cfg.gatillo ? 1 : 0;
        mover(mano, dt, cfg.rigidezGolpe ?? 1400);
        if (mano.punta.y < o.p.y - 0.03 || ahora - mano.desde > 300) {
          golpeados.set(o.malla, ahora + (cfg.olvidar ?? 0.8) * 1000);
          bot.clics++;
          Object.assign(mano, { estado: 'subir', desde: ahora, gatillo: 0 });
        }
      } else if (mano.estado === 'subir') {
        mano.meta.copy(mano.punta).y += 0.1;
        mover(mano, dt, 400);
        if (ahora - mano.desde > 120) Object.assign(mano, { estado: 'reposo', objetivo: null, enfriar: cfg.cadencia ?? 0.1 });
      } else {
        mano.meta.copy(mano.reposo);
        mover(mano, dt, 25);
      }
    }
  }

  // Tajo casi vertical, de arriba abajo y algo cruzado: la hoja (que apunta hacia delante) barre un
  // plano que cubre el fallo en altura y en profundidad; lo único que tiene que acertar es la x.
  // Las puntas del tajo van pegadas al objeto y adelantadas lo que se moverá mientras tanto.
  function pasoBarrer(lista, ahora, dt) {
    const ocupados = manos.map((m) => m.objetivo?.malla).filter(Boolean);
    for (const o of libre(lista, ahora, ocupados).sort((a, b) => a.p.y - b.p.y)) {
      const mano = manoPara(o);
      if (!mano) break;
      const dir = new V3(-mano.signo * (cfg.cruce ?? 0.3), -1, 0).normalize();
      const largo = cfg.largo ?? 0.6;
      const offIni = dir.clone().multiplyScalar(-largo * 0.45);
      const offFin = dir.clone().multiplyScalar(largo * 0.55);
      if (cruzaPeligro(o.p.clone().add(offIni), o.p.clone().add(offFin), 0.08)) continue;
      Object.assign(mano, { estado: 'ir', objetivo: o, desde: ahora, offIni, offFin, ini: new V3(), fin: new V3() });
    }
    for (const mano of manos) {
      mano.enfriar -= dt;
      if (mano.objetivo) {
        mano.objetivo = lista.find((x) => x.malla === mano.objetivo.malla) || mano.objetivo;
        const o = mano.objetivo;
        mano.ini.copy(o.p).add(mano.offIni).addScaledVector(o.vel, cfg.adelantoIr ?? 0.15);
        mano.fin.copy(o.p).add(mano.offFin).addScaledVector(o.vel, cfg.adelanto ?? 0.12);
      }
      if (mano.estado === 'ir') {
        mano.meta.copy(mano.ini);
        mover(mano, dt, cfg.rigidez ?? 300);
        if (mano.punta.distanceTo(mano.ini) < 0.07 || ahora - mano.desde > 450) Object.assign(mano, { estado: 'golpe', desde: ahora });
      } else if (mano.estado === 'golpe') {
        mano.meta.copy(mano.fin);
        mover(mano, dt, cfg.rigidezGolpe ?? 1600);
        if (cruzaPeligro(mano.punta, mano.fin, 0.05)) mano.vel.multiplyScalar(0.2);
        if (mano.punta.distanceTo(mano.fin) < 0.08 || ahora - mano.desde > 300) {
          golpeados.set(mano.objetivo.malla, ahora + 600);
          bot.clics++;
          Object.assign(mano, { estado: 'reposo', objetivo: null, enfriar: cfg.cadencia ?? 0.05 });
        }
      } else {
        mano.meta.copy(mano.reposo);
        mover(mano, dt, 20);
      }
    }
  }

  function pasoSeguir(lista, ahora, dt) {
    const bola = lista.sort((a, b) => b.rapidez - a.rapidez)[0];
    for (const mano of manos) {
      const mia = bola && (manos.length === 1 || (bola.p.x < cabeza.pos.x) === (mano.signo < 0));
      if (mia) mano.meta.copy(bola.p).addScaledVector(bola.vel, cfg.adelanto ?? 0.12);
      else mano.meta.copy(mano.reposo);
      mover(mano, dt, mia ? cfg.rigidez ?? 120 : 25);
    }
  }

  function pasoLanzar(lista, ahora, dt) {
    const mano = manos[1];
    const coger = new V3(...(cfg.coger || [0.2, 1.0, -0.45]));
    const diana = lista[0]?.p || new V3(...(cfg.diana || [0, 1.6, -3]));
    if (mano.estado === 'reposo') {
      mano.meta.copy(coger);
      mover(mano, dt, 60);
      if (mano.punta.distanceTo(coger) < 0.06 && ahora > mano.desde) Object.assign(mano, { estado: 'coger', desde: ahora, gatillo: 1 });
    } else if (mano.estado === 'coger') {
      mano.meta.copy(coger);
      mover(mano, dt, 60);
      if (ahora - mano.desde > 350) Object.assign(mano, { estado: 'atras', desde: ahora });
    } else if (mano.estado === 'atras') {
      mano.meta.set(mano.signo * 0.25, ALTURA - 0.1, 0.15);
      mover(mano, dt, 90);
      if (ahora - mano.desde > 600) Object.assign(mano, { estado: 'lanzar', desde: ahora });
    } else if (mano.estado === 'lanzar') {
      const dir = diana.clone().sub(cabeza.pos).normalize();
      mano.meta.copy(cabeza.pos).addScaledVector(dir, 0.7);
      mover(mano, dt, cfg.fuerza ?? 900);
      if (ahora - mano.desde > (cfg.soltarTras ?? 150)) {
        mano.gatillo = 0;
        bot.clics++;
        Object.assign(mano, { estado: 'reposo', desde: ahora + (cfg.esperar ?? 1.8) * 1000 });
      }
    }
    manos[0].meta.copy(manos[0].reposo);
    mover(manos[0], dt, 20);
  }

  // ─── Cabeza: mira hacia la acción, con un balanceo suave ──────────────
  const mirarBase = new V3(...(cfg.mirar || [0, 1.1, -1]));
  function moverCabeza(lista, ahora, dt) {
    const centro = mirarBase.clone();
    if (lista.length) {
      const media = lista.reduce((s, o) => s.add(o.p), new V3()).divideScalar(lista.length);
      centro.lerp(media, cfg.seguirMirada ?? 0.35);
    }
    const k = 6;
    const a = centro.sub(cabeza.mira).multiplyScalar(k).sub(cabeza.vel.clone().multiplyScalar(2 * Math.sqrt(k)));
    cabeza.vel.addScaledVector(a, dt);
    cabeza.mira.addScaledVector(cabeza.vel, dt);
    const s = ahora / 1000;
    cabeza.pos.set(Math.sin(s * 0.7) * 0.03, ALTURA + Math.sin(s * 1.3) * 0.01, Math.sin(s * 0.5) * 0.02);
    const dir = cabeza.mira.clone().sub(cabeza.pos).normalize();
    const q = new Quat().setFromEuler(new Euler(Math.asin(dir.y) + Math.sin(s * 0.9) * 0.015, Math.atan2(-dir.x, -dir.z), Math.sin(s * 0.6) * 0.02, 'YXZ'));
    xr.position.set(cabeza.pos.x, cabeza.pos.y, cabeza.pos.z);
    xr.quaternion.set(q.x, q.y, q.z, q.w);
  }

  const PASOS = { golpear: pasoGolpear, barrer: pasoBarrer, seguir: pasoSeguir, lanzar: pasoLanzar };
  let cuadros = 0;
  function paso() {
    const ahora = performance.now();
    const dt = Math.min(0.05, (ahora - tAnterior) / 1000);
    tAnterior = ahora;
    const lista = candidatos(ahora, dt);
    bot.objetivos = Math.max(bot.objetivos, lista.length);
    moverCabeza(lista, ahora, dt);
    for (const mano of manos) revisarPunta(mano, ahora);
    if (++cuadros < 20) {
      // Quietas al empezar, para medir el desfase del grip (ver medirDesfase)
      if (cuadros === 19) manos.forEach(medirDesfase);
    } else (PASOS[cfg.modo] || pasoGolpear)(lista, ahora, dt);
    for (const mano of manos) colocarMando(mano);
    requestAnimationFrame(paso);
  }
  bot.manos = manos; // para depurar desde fuera
  requestAnimationFrame(paso);
  return true;
};
