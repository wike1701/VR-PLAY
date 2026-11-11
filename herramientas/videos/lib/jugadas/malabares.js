// Jugada de Malabares.
// VR: coge con el gatillo las bolas que flotan delante, lanza cada una hacia la otra mano con la
// velocidad justa para una parábola de ~0,9 s (el juego mide la velocidad de la mano al soltar) y
// recoge las que llegan: predice dónde cruzará cada bola la altura de las manos, lleva la mano allí
// y cierra justo antes. Cascada: una mano lanza su bola cuando le va a llegar otra (al pasar esa
// por lo alto), así siempre tiene la mano libre al recibir. Si no hay ninguna en el aire, lanza la
// que lleva más rato cogida. La bola nueva del cañón la coge la mano que esté libre.
// Ratón: las manos se mueven solas; el aro que se cierra sobre la mano dice cuánto falta (crece
// 3,2 veces por segundo que falta) y se hace clic justo cuando llega.
(() => {
  const VUELO = 0.9;          // s de vuelo de cada lanzamiento
  const PREPARAR = 0.26;      // s desde que empieza el gesto de lanzar hasta soltar
  const RECTO = 0.13;         // s finales del gesto a velocidad constante (lo que mide el juego)
  const Y_MANOS = 1.0;
  const Z_MANOS = -0.36;
  const est = { t0: 0, bolas: new Map(), manos: null, ultima: 0 };

  const gravedad = (ahora) => 9.8 * (0.5 + 0.2 * Math.min(1, (ahora - est.t0) / 240000));
  const dentro = (V3, s) => new V3(s * 0.11, Y_MANOS, Z_MANOS);
  const fuera = (V3, s) => new V3(s * 0.32, Y_MANOS + 0.02, Z_MANOS);

  // Donde el juego pone la bola cogida: un Object3D del guante, en el mando
  function ancla(api, i) {
    const grip = api.fab.manos?.[i]?.grip;
    let a = null;
    grip?.traverse((o) => { if (!a && !o.isMesh && o.position.y === 0.058 && o.position.z === -0.04) a = o; });
    return a ? a.getWorldPosition(new api.V3()) : api.manos[i].punta.clone();
  }

  // Bolas visibles con su velocidad y lo que hacen: 'mano' (y cuál), 'espera' (flotando), 'vuelo', 'suelo'
  function leerBolas(api, ahora, dt, anclas) {
    const vistas = api.buscar((m) => m.isMesh && m.geometry?.type === 'SphereGeometry' && m.geometry.parameters.radius === 0.038);
    const g = gravedad(ahora);
    const lista = [];
    for (const { malla, p } of vistas) {
      let b = est.bolas.get(malla);
      if (!b) { b = { p: p.clone(), v: new api.V3(), estado: 'nueva', lanzadaPor: -1, desde: ahora }; est.bolas.set(malla, b); }
      else if (dt > 0) { b.v.copy(p).sub(b.p).divideScalar(dt); b.v.y -= g * dt * 0.5; b.p.copy(p); }
      const antes = b.estado;
      // Cogida: pegada al ancla (con margen si ya lo estaba: la mano se mueve deprisa)
      let enMano = anclas.findIndex((a) => a.distanceTo(p) < 0.03);
      if (enMano < 0 && antes === 'mano' && anclas[b.mano].distanceTo(p) < 0.1) enMano = b.mano;
      if (enMano >= 0) b.estado = 'mano', b.mano = enMano;
      else if (p.y < 0.2) b.estado = 'suelo';
      else if (b.v.length() < 0.5 && (antes !== 'vuelo' || b.lanzadaPor < 0)) b.estado = 'espera';
      else b.estado = 'vuelo';
      if (antes === 'mano' && b.estado !== 'mano') { b.lanzadaPor = b.mano; b.desde = ahora; }
      if (b.estado === 'mano' && antes !== 'mano') b.desde = ahora;
      if (b.estado === 'espera' || b.estado === 'suelo') b.lanzadaPor = -1;
      b.malla = malla;
      // Dónde y cuándo cruzará, bajando, la altura de las manos
      if (b.estado === 'vuelo' && b.lanzadaPor >= 0) {
        const disc = b.v.y * b.v.y + 2 * g * (b.p.y - Y_MANOS);
        const t = disc >= 0 ? (b.v.y + Math.sqrt(disc)) / g : 0;
        b.llega = ahora + t * 1000;
        b.donde = b.p.clone().addScaledVector(b.v, t);
        b.donde.y = Y_MANOS;
        b.para = b.donde.x < 0 ? 0 : 1;
      } else b.para = -1;
      lista.push(b);
    }
    return lista;
  }

  // Siguiente posición de un tramo de Hermite (de p0,v0 a p1,v1 en T s), evaluado a s = dt/T
  function hermite(p0, v0, p1, v1, T, dt) {
    const s = Math.min(1, dt / Math.max(T, 1e-3));
    const h00 = 2 * s ** 3 - 3 * s ** 2 + 1, h10 = s ** 3 - 2 * s ** 2 + s, h01 = -2 * s ** 3 + 3 * s ** 2, h11 = s ** 3 - s ** 2;
    return p0.clone().multiplyScalar(h00).addScaledVector(v0, h10 * T).addScaledVector(p1, h01).addScaledVector(v1, h11 * T);
  }
  // Pone la meta para que el muelle del bot lleve la punta justo a «siguiente» en este fotograma
  function seguir(mano, siguiente, dt) {
    const k = 500;
    const c = 2 * Math.sqrt(k) * 0.9;
    const vNueva = siguiente.clone().sub(mano.punta).divideScalar(dt);
    const acel = vNueva.sub(mano.vel).divideScalar(dt);
    mano.meta.copy(mano.punta).add(acel.addScaledVector(mano.vel, c).divideScalar(k));
    mano.rigidez = k;
  }

  window.__jugada = {
    vr(api, ahora, dt) {
      const V3 = api.V3;
      if (!est.manos) {
        est.t0 = ahora;
        est.manos = api.manos.map(() => ({ estado: 'libre', cerrada: 0, lanzar: null }));
      }
      api.cabeza.mira.set(0, 1.2, -0.7);
      if (dt <= 0) return;
      const anclas = [0, 1].map((i) => ancla(api, i));
      const bolas = leerBolas(api, ahora, dt, anclas);
      const g = gravedad(ahora);
      const enVuelo = bolas.filter((b) => b.estado === 'vuelo' && b.lanzadaPor >= 0);
      for (const mano of api.manos) {
        const i = mano.i;
        const s = mano.signo;
        const em = est.manos[i];
        const desfase = anclas[i].clone().sub(mano.punta); // de la punta del bot al ancla del guante
        const llevar = (punto, k) => { mano.meta.copy(punto).sub(desfase); mano.rigidez = k; };
        const mia = bolas.find((b) => b.estado === 'mano' && b.mano === i);
        const llegan = enVuelo.filter((b) => b.para === i).sort((a, b) => a.llega - b.llega);

        // ── Lanzando: gesto de abajo arriba que acaba a la velocidad del lanzamiento ──
        if (em.lanzar) {
          const L = em.lanzar;
          const falta = (L.suelta - ahora) / 1000;
          if (falta > RECTO) {
            const inicio = L.punto.clone().addScaledVector(L.vel, -RECTO).sub(desfase);
            seguir(mano, hermite(mano.punta, mano.vel, inicio, L.vel, falta - RECTO, dt), dt);
          } else if (falta > 0) {
            seguir(mano, L.punto.clone().addScaledVector(L.vel, -(falta - dt)).sub(desfase), dt);
          } else {
            mano.gatillo = 0;
            em.lanzar = null;
            em.cerrada = 0;
            est.ultima = ahora;
            api.bot.clics++;
            llevar(fuera(V3, s), 60);
          }
          continue;
        }

        if (mia) {
          mano.gatillo = 1;
          em.cerrada = 0;
          // ¿Lanzar? Si le llega otra bola pronto (cascada) o si no hay ninguna en el aire
          const sinVuelo = !enVuelo.length && ahora - est.ultima > 150;
          const masAntigua = bolas.filter((b) => b.estado === 'mano').sort((a, b) => a.desde - b.desde)[0] === mia;
          const ya = (llegan[0] && llegan[0].llega - ahora < (VUELO / 2 + PREPARAR) * 1000) || (sinVuelo && masAntigua && ahora - mia.desde > 250);
          if (ya && ahora - mia.desde > 120) {
            const punto = dentro(V3, s);
            const destino = fuera(V3, -s);
            const vel = destino.clone().sub(punto).divideScalar(VUELO);
            vel.y += 0.5 * g * VUELO;
            em.lanzar = { punto, vel, suelta: ahora + PREPARAR * 1000 };
            continue;
          }
          // Con la bola: espera por dentro, algo baja
          llevar(dentro(V3, s).add(new V3(s * 0.04, -0.08, 0.02)), 120);
          continue;
        }

        // ── Recibir: la mano va a donde cruzará la bola y se cierra justo antes ──
        const b = llegan[0];
        if (b) {
          const punto = b.donde.clone();
          punto.x = Math.max(-0.55, Math.min(0.55, punto.x));
          punto.z = Math.max(-0.65, Math.min(-0.15, punto.z));
          llevar(punto, 220);
          const cerca = b.p.distanceTo(anclas[i]) < 0.14 || b.llega - ahora < 90;
          if (cerca && b.v.y < 0 && ahora - b.desde > 300 && !em.cerrada) { mano.gatillo = 1; em.cerrada = ahora; }
        } else {
          // Libre: a por la bola que flota (las del principio o la del cañón) o a esperar por fuera
          const libre = bolas.filter((x) => x.estado === 'espera')
            .sort((a, c) => Math.abs(a.p.x - s * 0.2) - Math.abs(c.p.x - s * 0.2))[0];
          const otraVa = libre && est.manos[1 - i].va === libre.malla;
          if (libre && !otraVa && (libre.p.x * s > -0.05 || !bolas.some((x) => x.estado === 'espera' && x !== libre))) {
            em.va = libre.malla;
            llevar(libre.p, 140);
            if (libre.p.distanceTo(anclas[i]) < 0.07 && !em.cerrada) { mano.gatillo = 1; em.cerrada = ahora; }
          } else {
            em.va = null;
            llevar(fuera(V3, s), 90);
          }
        }
        // Cerrada sin bola: se abre para poder volver a cerrar (la ventana para coger dura 0,22 s)
        if (em.cerrada && ahora - em.cerrada > 240) { mano.gatillo = 0; em.cerrada = 0; }
      }
    },

    raton(api, ahora, dt) {
      est.aros ??= new Map();
      const aros = api.buscar((m) => m.isMesh && m.geometry?.parameters?.innerRadius === 0.07 && m.geometry.parameters.outerRadius === 0.085);
      let proximo = null;
      for (const { malla, p } of aros) {
        const s = malla.scale.x;
        let a = est.aros.get(malla);
        if (!a) est.aros.set(malla, (a = { llega: 0, hecho: 0 }));
        if (s > 1.003) a.llega = ahora + ((s - 1) / 3.2) * 1000;
        a.p = p;
        if (a.llega > a.hecho + 250 && (!proximo || a.llega < proximo.llega)) proximo = a;
      }
      if (proximo) {
        const s = api.aPantalla(proximo.p);
        api.mover(s.x, s.y, dt, 160);
        if (ahora >= proximo.llega - 25 && !api.p.pulsado) {
          api.clic();
          proximo.hecho = proximo.llega;
        }
      } else api.mover(api.W / 2, api.H * 0.55, dt, 20);
    },
  };
})();
