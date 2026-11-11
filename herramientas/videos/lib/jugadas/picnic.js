// Jugada del picnic (VR): un matamoscas en cada mano. Las moscas son una malla instanciada
// (juegos/picnic/juego.js, moscasCuerpo), así que el modo general no las ve: aquí se leen sus
// posiciones de la matriz de cada instancia (escala 0 = libre, aplastada = escala desigual).
// Cada mano espera en guardia sobre la mesa y, en cuanto una mosca queda a tiro, le da un golpe de
// arriba abajo que pasa por ella a más de 0,9 m/s (VELOCIDAD_GOLPE_VR). Las que aún vuelan valen el
// doble: se les da en el aire en cuanto llegan, antes de que se posen. La mano va con la velocidad
// justa en cada fotograma (ver «hacia»), así el golpe pasa por la mosca.
(() => {
  const ALCANCE = 1.0;           // del hombro al centro de la paleta, con el brazo estirado
  const SUPERFICIE = 0.78;       // el mantel: la paleta no lo atraviesa
  const GOLPE = 4.2;             // m/s de la paleta en el golpe

  const manos = [{}, {}].map(() => ({ fase: 'reposo', desde: 0, objetivo: null }));
  let anteriores = null;         // posiciones de cada mosca en el fotograma anterior

  function conVelocidad(mano, v, dt, K = 300) {
    mano.rigidez = K;
    const c = 2 * Math.sqrt(K) * 0.9;
    mano.meta.copy(v).sub(mano.vel).divideScalar(dt).addScaledVector(mano.vel, c).divideScalar(K).add(mano.punta);
  }
  function hacia(mano, p, dt, vmax) {
    const v = p.clone().sub(mano.punta).divideScalar(dt);
    if (v.length() > vmax) v.setLength(vmax);
    conVelocidad(mano, v, dt);
  }

  // Las moscas vivas: { i, p, vel }
  function moscas(api, dt) {
    const raiz = api.raiz();
    let malla = null;
    raiz?.traverse((m) => {
      if (!malla && m.isInstancedMesh && m.count === 12 && m.instanceColor && m.material?.vertexColors) malla = m;
    });
    if (!malla) return [];
    const { V3 } = api;
    const M = new api.THREE.Matrix4();
    const p = new V3();
    const q = new api.Quat();
    const s = new V3();
    const lista = [];
    const ahora = [];
    for (let i = 0; i < malla.count; i++) {
      malla.getMatrixAt(i, M);
      M.premultiply(malla.matrixWorld).decompose(p, q, s);
      ahora[i] = p.clone();
      const viva = s.x > 0.5 && Math.abs(s.y - s.x) < 0.05 * s.x;
      if (!viva) continue;
      const antes = anteriores?.[i];
      const vel = antes && dt > 0 ? p.clone().sub(antes).divideScalar(dt) : new V3();
      if (vel.length() > 6) vel.set(0, 0, 0); // acaba de aparecer en otro sitio
      lista.push({ i, p: p.clone(), vel });
    }
    anteriores = ahora;
    return lista;
  }

  window.__jugada = {
    vr(api, ahora, dt) {
      const { cabeza, V3 } = api;
      // Las que huyen (suben deprisa) ya no puntúan
      const vivas = moscas(api, dt).filter((o) => o.vel.y < 0.8);
      const abajo = new V3(0, -1, 0);
      api.manos.forEach((mano, i) => {
        const e = manos[i];
        const hombro = new V3(cabeza.pos.x + mano.signo * 0.18, cabeza.pos.y - 0.28, cabeza.pos.z);
        if (e.objetivo) {
          const sigue = vivas.find((o) => o.i === e.objetivo.i);
          if (sigue) e.objetivo = sigue;
          else if (e.fase === 'preparar') Object.assign(e, { fase: 'volver', desde: ahora, objetivo: null });
        }
        if (e.fase === 'reposo' || (e.fase === 'volver' && ahora - e.desde > 100)) {
          const otro = manos[1 - i].objetivo?.i;
          const aTiro = vivas.filter((o) => o.i !== otro && o.p.distanceTo(hombro) < ALCANCE
            && (o.p.x - cabeza.pos.x) * mano.signo > -0.2 && o.p.z < 0);
          aTiro.sort((a, b) => a.p.distanceTo(hombro) - b.p.distanceTo(hombro));
          if (aTiro[0]) Object.assign(e, { fase: 'preparar', desde: ahora, objetivo: aTiro[0] });
        }
        const o = e.objetivo;
        if (e.fase === 'preparar') {
          // Encima de la mosca (algo hacia el jugador), adelantada a dónde estará
          const p = o.p.clone().addScaledVector(o.vel, 0.12);
          const w = p.clone().add(new V3(0, 0.2, 0.06));
          hacia(mano, w, dt, 3.5);
          if (mano.punta.distanceTo(w) < 0.04 || ahora - e.desde > 450) Object.assign(e, { fase: 'golpe', desde: ahora });
        } else if (e.fase === 'golpe') {
          const p = o.p.clone().addScaledVector(o.vel, 0.03);
          const fin = p.clone().addScaledVector(abajo, 0.07);
          fin.y = Math.max(fin.y, SUPERFICIE + 0.01);
          fin.z -= 0.03;
          hacia(mano, fin, dt, GOLPE);
          if (mano.punta.distanceTo(fin) < 0.03 || ahora - e.desde > 260) {
            api.bot.clics++;
            Object.assign(e, { fase: 'volver', desde: ahora, objetivo: null });
          }
        } else {
          // En guardia sobre su mitad de la mesa
          const guardia = new V3(cabeza.pos.x + mano.signo * 0.24, 1.08, -0.5);
          mano.rigidez = e.fase === 'volver' ? 110 : 40;
          mano.meta.copy(guardia);
          if (e.fase === 'volver' && ahora - e.desde > 350) e.fase = 'reposo';
        }
      });
      // La cabeza sigue a las moscas que van a por la comida
      const cerca = vivas.filter((o) => o.p.z > -1.6 && Math.abs(o.p.x) < 1.2);
      const mira = cerca.length ? cerca.reduce((s, o) => s.add(o.p), new V3()).divideScalar(cerca.length) : new V3(0, 0.85, -0.6);
      mira.lerp(new V3(0, 0.85, -0.6), 0.5);
      cabeza.mira.lerp(mira, Math.min(1, dt * 3));
    },
  };
})();
