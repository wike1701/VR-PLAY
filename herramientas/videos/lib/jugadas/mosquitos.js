// Jugada de los mosquitos (VR): un matamoscas en cada mano. Los mosquitos revolotean a 1-2,6 m antes
// de atacar (juegos/mosquitos/juego.js, ZONA), fuera del alcance del brazo, así que el jugador da
// unos pasos hacia el más cercano (como haría uno de verdad) y le suelta un zarpazo: la paleta pasa
// por encima de él, de arriba abajo, a más de 0,9 m/s (VELOCIDAD_GOLPE_VR). Los que vienen a picar
// (alas rojas) van primero. La mano no va con un muelle libre: cada fotograma se le da la velocidad
// justa para llegar a donde toca (ver «hacia»), así el golpe pasa por el mosquito.
(() => {
  const ALCANCE = 0.95;          // del hombro al centro de la paleta, con el brazo estirado
  const DELANTE = 0.72;          // a qué distancia del hombro quiere tener al mosquito
  const PASO = 0.9;              // m/s al andar
  const LIMITES = { x: [-0.9, 0.9], z: [-1.3, 0.2] };
  const GOLPE = 4.5;             // m/s de la paleta en el golpe
  const ARRIBA = new Float32Array([0, 0.78, 0.62]); // de dónde viene el golpe (arriba y hacia el jugador)

  const cuerpo = { x: 0, z: 0, vx: 0, vz: 0 };
  const manos = [{}, {}].map(() => ({ fase: 'reposo', desde: 0, objetivo: null }));
  const previo = new WeakMap();

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

  // Los mosquitos vivos: { grupo, p, vel, ataca }
  function mosquitos(api) {
    const raiz = api.raiz();
    const lista = [];
    if (!raiz) return lista;
    for (const g of raiz.children) {
      if (!g.isGroup || !g.visible || g.children.length !== 2) continue;
      const alas = g.children[1];
      if (!alas.isMesh || !alas.material?.transparent || !alas.material.color) continue;
      if (alas.scale.x === 0.4) continue; // muerto (cae dando vueltas)
      const p = g.position.clone();
      const antes = previo.get(g);
      const vel = antes && antes.dt > 0 ? p.clone().sub(antes.p).divideScalar(antes.dt) : new api.V3();
      lista.push({ grupo: g, p, vel, ataca: alas.material.color.r > 0.9 && alas.material.color.g < 0.5 });
    }
    return lista;
  }

  window.__jugada = {
    vr(api, ahora, dt) {
      const { cabeza, V3 } = api;
      const lista = mosquitos(api);
      for (const o of lista) previo.set(o.grupo, { p: o.p.clone(), dt });
      // Los que no se mueven hacia atrás ni suben a toda prisa (los que huyen tras picar)
      const vivos = lista.filter((o) => o.vel.y < 0.9 && o.p.y > 0.5);

      // ─── Andar hacia el mosquito más urgente ─────────────────────────────
      const yo = new V3(cuerpo.x, 1.6, cuerpo.z);
      const urgencia = (o) => o.p.distanceTo(yo) - (o.ataca ? 1.5 : 0);
      vivos.sort((a, b) => urgencia(a) - urgencia(b));
      const blanco = vivos[0];
      let meta = { x: 0, z: -0.3 };
      if (blanco) {
        const h = new V3(blanco.p.x - cuerpo.x, 0, blanco.p.z - cuerpo.z);
        const d = h.length();
        if (d > DELANTE) {
          h.multiplyScalar((d - DELANTE) / d);
          meta = { x: cuerpo.x + h.x, z: cuerpo.z + h.z };
        } else meta = { x: cuerpo.x, z: cuerpo.z };
      }
      meta.x = Math.min(LIMITES.x[1], Math.max(LIMITES.x[0], meta.x));
      meta.z = Math.min(LIMITES.z[1], Math.max(LIMITES.z[0], meta.z));
      // Un muelle suave y con tope de velocidad: pasos, no saltos
      const k = 10;
      cuerpo.vx += (k * (meta.x - cuerpo.x) - 2 * Math.sqrt(k) * cuerpo.vx) * dt;
      cuerpo.vz += (k * (meta.z - cuerpo.z) - 2 * Math.sqrt(k) * cuerpo.vz) * dt;
      const vc = Math.hypot(cuerpo.vx, cuerpo.vz);
      if (vc > PASO) { cuerpo.vx *= PASO / vc; cuerpo.vz *= PASO / vc; }
      cuerpo.x += cuerpo.vx * dt;
      cuerpo.z += cuerpo.vz * dt;

      // La cabeza (ya colocada por bot-vr.js) se desplaza con el cuerpo y mira al mosquito
      cabeza.pos.x += cuerpo.x;
      cabeza.pos.z += cuerpo.z;
      if (blanco) cabeza.mira.lerp(blanco.p, Math.min(1, dt * 5));
      else cabeza.mira.lerp(new V3(cuerpo.x, 1.3, cuerpo.z - 1.2), Math.min(1, dt * 2));
      const dir = cabeza.mira.clone().sub(cabeza.pos).normalize();
      const q = new api.Quat().setFromEuler(new api.THREE.Euler(Math.asin(dir.y), Math.atan2(-dir.x, -dir.z), 0, 'YXZ'));
      window.__xr.position.set(cabeza.pos.x, cabeza.pos.y, cabeza.pos.z);
      window.__xr.quaternion.set(q.x, q.y, q.z, q.w);

      // ─── Manos: zarpazo al que esté a tiro ───────────────────────────────
      const arriba = new V3(ARRIBA[0], ARRIBA[1], ARRIBA[2]).normalize();
      api.manos.forEach((mano, i) => {
        const e = manos[i];
        const hombro = new V3(cabeza.pos.x + mano.signo * 0.18, cabeza.pos.y - 0.28, cabeza.pos.z);
        if (e.objetivo && !vivos.some((o) => o.grupo === e.objetivo.grupo)) {
          if (e.fase !== 'golpe') e.fase = 'volver';
          if (e.fase === 'volver') e.objetivo = null;
        }
        if (e.fase === 'reposo' || e.fase === 'volver') {
          const otro = manos[1 - i].objetivo?.grupo;
          const aTiro = vivos.filter((o) => o.grupo !== otro && o.p.distanceTo(hombro) < ALCANCE + 0.15
            && (o.p.x - cabeza.pos.x) * mano.signo > -0.25);
          aTiro.sort((a, b) => a.p.distanceTo(hombro) - b.p.distanceTo(hombro));
          if (aTiro[0] && ahora - e.desde > 120) Object.assign(e, { fase: 'preparar', desde: ahora, objetivo: aTiro[0] });
        }
        if (e.objetivo) e.objetivo = vivos.find((o) => o.grupo === e.objetivo.grupo) || e.objetivo;
        const o = e.objetivo;
        if (e.fase === 'preparar') {
          const p = o.p.clone().addScaledVector(o.vel, 0.1);
          const w = p.clone().addScaledVector(arriba, 0.2);
          hacia(mano, w, dt, 3.5);
          if (mano.punta.distanceTo(w) < 0.04 || ahora - e.desde > 450) Object.assign(e, { fase: 'golpe', desde: ahora });
        } else if (e.fase === 'golpe') {
          const p = o.p.clone().addScaledVector(o.vel, 0.03);
          const fin = p.clone().addScaledVector(arriba, -0.22);
          hacia(mano, fin, dt, GOLPE);
          if (mano.punta.distanceTo(fin) < 0.03 || ahora - e.desde > 260) {
            api.bot.clics++;
            Object.assign(e, { fase: 'volver', desde: ahora, objetivo: null });
          }
        } else {
          // En guardia, delante del pecho
          const guardia = hombro.clone().add(new V3(mano.signo * 0.05, 0.15, -0.4));
          mano.rigidez = e.fase === 'volver' ? 90 : 40;
          mano.meta.copy(guardia);
          if (e.fase === 'volver' && ahora - e.desde > 300) e.fase = 'reposo';
        }
      });
    },
  };
})();
