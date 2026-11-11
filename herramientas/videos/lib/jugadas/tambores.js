// Jugada de Tambores: lee los aros de luz que llegan por cada carril (su color dice el tambor y su
// tamaño, cuánto les falta: crecen de 0,55 a 1 vez el radio del parche en 1,9 s) y golpea cada uno
// justo cuando llega. En VR, cada baqueta espera levantada sobre su próximo tambor y en el último
// cuarto de segundo baja con una curva suave que cruza el parche en el instante del aro; al tocar
// la piel rebota hacia arriba, como una baqueta de verdad (y así se rearma para el siguiente).
// Con ratón, el puntero va al tambor del próximo aro y hace clic en su momento.
(() => {
  const LLEGADA = 1.9;
  const R_PUNTA = 0.016;
  const TAMBORES = [
    { x: -0.47, y: 0.85, z: -0.4, r: 0.13, color: 0x2ee6d6 },
    { x: -0.17, y: 0.85, z: -0.4, r: 0.15, color: 0xffd23f },
    { x: 0.15, y: 0.85, z: -0.4, r: 0.15, color: 0xff6a3d },
    { x: 0.52, y: 0.85, z: -0.4, r: 0.2, color: 0xb36bff },
  ];
  const GIRO = 0.36;
  const NORMAL = [0, Math.cos(GIRO), Math.sin(GIRO)];
  const ADELANTO = 0.035; // s: el juego ve la baqueta un fotograma después de moverla
  const golpes = [];      // { tambor, t (ms), mano, hecho }

  // Los aros visibles: { tambor, t } (t, cuándo llega al parche, en ms del reloj de la página)
  function leerAros(api, ahora) {
    const r = [];
    for (const { malla } of api.buscar((m) => m.isMesh && m.geometry?.parameters?.tube === 0.12 && m.geometry.parameters.radius === 1)) {
      const tambor = TAMBORES.findIndex((d) => {
        const c = new api.THREE.Color(d.color);
        return Math.abs(c.r - malla.material.color.r) + Math.abs(c.g - malla.material.color.g) + Math.abs(c.b - malla.material.color.b) < 0.05;
      });
      if (tambor < 0) continue;
      const u = Math.min(1, Math.max(0, (malla.scale.x / TAMBORES[tambor].r - 0.55) / 0.45));
      r.push({ tambor, t: ahora + (1 - u) * LLEGADA * 1000 });
    }
    return r;
  }

  // Apunta los golpes que hay que dar (y afina su instante con cada fotograma)
  function planificar(api, ahora) {
    for (const a of leerAros(api, ahora)) {
      const g = golpes.find((x) => x.tambor === a.tambor && Math.abs(x.t - a.t) < 90);
      if (g) { if (!g.hecho && g.t - ahora > 40) g.t = g.t * 0.7 + a.t * 0.3; continue; }
      golpes.push({ tambor: a.tambor, t: a.t, mano: null, hecho: false });
    }
    for (let k = golpes.length - 1; k >= 0; k--) if (golpes[k].t < ahora - 1500) golpes.splice(k, 1);
    golpes.sort((a, b) => a.t - b.t);
    // Manos: el tambor de la izquierda, con la izquierda; el de la derecha, con la derecha; los del
    // centro, con la de su lado salvo que esa esté ocupada justo entonces y la otra no
    for (const g of golpes) {
      if (g.mano !== null) continue;
      const propia = g.tambor <= 1 ? 0 : 1;
      if (g.tambor === 0 || g.tambor === 3) { g.mano = propia; continue; }
      const cerca = (m) => golpes.some((x) => x !== g && x.mano === m && Math.abs(x.t - g.t) < 260);
      g.mano = cerca(propia) && !cerca(1 - propia) ? 1 - propia : propia;
    }
  }

  window.__jugada = {
    vr(api, ahora, dt) {
      planificar(api, ahora);
      const V3 = api.V3;
      const N = new V3(...NORMAL);
      api.cabeza.mira.set(0, 0.85, -0.9);
      for (const mano of api.manos) {
        const centro = (i) => new V3(TAMBORES[i].x, TAMBORES[i].y, TAMBORES[i].z);
        const altura = mano.punta.clone().sub(centro(0)).dot(N) - R_PUNTA; // todos los parches están en el mismo plano
        // Rebote en la piel: la baqueta sale hacia arriba con parte de su velocidad
        const vn = mano.vel.dot(N);
        if (altura < -0.004 && vn < 0) {
          mano.vel.addScaledVector(N, -vn * 1.55);
          mano.rebote = ahora + 70;
        }
        const sig = golpes.find((g) => g.mano === mano.i && !g.hecho && g.t > ahora - 10);
        for (const g of golpes) if (g.mano === mano.i && !g.hecho && g.t <= ahora - 10) { g.hecho = true; api.bot.clics++; }
        const casa = sig ? sig.tambor : mano.i === 0 ? 1 : 2;
        const encima = centro(casa).addScaledVector(N, R_PUNTA + 0.13);
        const falta = sig ? (sig.t - ahora) / 1000 - ADELANTO : 9;
        const T = 0.26;
        if (sig && falta < T && falta > dt * 0.5 && !(mano.rebote > ahora)) {
          // Curva de Hermite desde donde está la punta hasta 1 cm por debajo del punto de cruce,
          // bajando a 1,5 m/s; se sigue con el muelle del bot (dinámica inversa de un paso)
          const fin = centro(sig.tambor).addScaledVector(N, R_PUNTA - 0.012);
          const vFin = N.clone().multiplyScalar(-1.5);
          const s = Math.min(1, dt / falta);
          const h00 = 2 * s ** 3 - 3 * s ** 2 + 1, h10 = s ** 3 - 2 * s ** 2 + s, h01 = -2 * s ** 3 + 3 * s ** 2, h11 = s ** 3 - s ** 2;
          const siguiente = mano.punta.clone().multiplyScalar(h00).addScaledVector(mano.vel, h10 * falta)
            .addScaledVector(fin, h01).addScaledVector(vFin, h11 * falta);
          const k = 500;
          const c = 2 * Math.sqrt(k) * 0.9;
          const vNueva = siguiente.clone().sub(mano.punta).divideScalar(dt);
          const acel = vNueva.clone().sub(mano.vel).divideScalar(dt);
          mano.meta.copy(mano.punta).add(acel.addScaledVector(mano.vel, c).divideScalar(k));
          mano.rigidez = k;
        } else {
          mano.meta.copy(encima);
          mano.rigidez = mano.rebote > ahora ? 30 : sig && falta < 0.6 ? 260 : 90;
        }
      }
    },

    raton(api, ahora, dt) {
      planificar(api, ahora);
      const sig = golpes.find((g) => !g.hecho && g.t > ahora - 10);
      const tb = TAMBORES[sig ? sig.tambor : 1];
      const s = api.aPantalla(new api.V3(tb.x, tb.y, tb.z));
      api.mover(s.x, s.y, dt, sig && sig.t - ahora < 500 ? 450 : 120);
      if (sig && sig.t - ahora <= 20 && !api.p.pulsado) {
        api.clic();
        sig.hecho = true;
      }
      for (const g of golpes) if (!g.hecho && g.t <= ahora - 10) g.hecho = true;
    },
  };
})();
