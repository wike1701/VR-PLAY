// Jugada de bolos (VR): coge la bola del soporte de la derecha, la sube al pecho, balancea el brazo
// atrás y la suelta abajo, rodando hacia la «bolsa» (entre el bolo 1 y el 3, x = 0,08 a la altura del
// bolo 1). Con la física del juego (juegos/bolos/juego.js) esa línea es pleno casi siempre, sea cual
// sea la velocidad. La bola sale con la velocidad media de la mano en ~80 ms × FUERZA_VR: cada
// fotograma se le da a la mano la velocidad exacta (ver «conVelocidad») y, tras cada tirada, mira por
// dónde rueda la bola y corrige la siguiente.
(() => {
  const SOPORTE = [0.6, 0.85, 0.05];
  const BOLSA = { x: 0.08, z: -10 };
  const FUERZA_VR = 1.5;
  const RAPIDEZ = 4.6;        // m/s de la mano al soltar (la bola sale a ~7 m/s)
  const K = 300;

  function conVelocidad(mano, v, dt) {
    mano.rigidez = K;
    const c = 2 * Math.sqrt(K) * 0.9;
    mano.meta.copy(v).sub(mano.vel).divideScalar(dt).addScaledVector(mano.vel, c).divideScalar(K).add(mano.punta);
  }
  function hacia(mano, p, dt, vmax = 6) {
    const v = p.clone().sub(mano.punta).divideScalar(dt);
    if (v.length() > vmax) v.setLength(vmax);
    conVelocidad(mano, v, dt);
  }
  const suave = (s) => (s <= 0 ? 0 : s >= 1 ? 1 : s * s * (3 - 2 * s));
  // Curva de Hermite: de a (velocidad va) a b (velocidad vb) en T segundos; s de 0 a 1
  function hermite(a, va, b, vb, T, s) {
    const s2 = s * s, s3 = s2 * s;
    return a.clone().multiplyScalar(2 * s3 - 3 * s2 + 1)
      .addScaledVector(va, T * (s3 - 2 * s2 + s))
      .addScaledVector(b, -2 * s3 + 3 * s2)
      .addScaledVector(vb, T * (s3 - s2));
  }

  let fase = 'esperar';
  let desde = 0;
  let inicio = null;
  let bola = null;
  let vTiro = null;
  let fotograma = 0;
  let rodando = [];
  const ajuste = { x: 0 };

  const buscarBola = (api) => api.buscar((m) => m.isMesh && m.geometry?.type === 'SphereGeometry' &&
    Math.abs((m.geometry.parameters?.radius ?? 0) - 0.12) < 1e-3 && m.geometry.parameters.widthSegments === 28)[0];

  window.__jugada = {
    vr(api, ahora, dt) {
      const { manos, V3 } = api;
      const mano = manos[1];
      const otra = manos[0];
      const t = (ahora - desde) / 1000;
      const soporte = new V3(...SOPORTE);
      const pecho = new V3(0.16, 1.15, -0.28);
      const atras = new V3(0.24, 0.72, 0.32);
      const suelta = new V3(0.2, 0.52, -0.55);  // dónde suelta la mano (abajo y delante)
      otra.gatillo = 0;
      otra.rigidez = 25;
      otra.meta.copy(otra.reposo);
      if (fase !== 'tirar' && fase !== 'acompanar') otra.meta.set(-0.3, 1.05, -0.2); // el brazo izquierdo, algo abierto

      // La bola rodando: su línea dice cuánto corregir la siguiente
      if (bola && (fase === 'acompanar' || fase === 'esperar')) {
        const p = bola.getWorldPosition(new V3());
        if (bola.visible && p.y < 0.13 && p.z < -2 && rodando.length < 2) rodando.push({ x: p.x, z: p.z });
        if (rodando.length === 2) {
          const [a, b] = rodando;
          if (b.z < a.z - 0.05) {
            const x = b.x + (b.x - a.x) * (BOLSA.z - b.z) / (b.z - a.z);
            const e = x - BOLSA.x;
            if (Math.abs(e) < 0.6) ajuste.x -= e;
          }
          rodando.push(null);
        }
      }

      if (fase === 'esperar') {
        mano.gatillo = 0;
        hacia(mano, mano.punta.clone().lerp(new V3(0.3, 1.05, -0.2), 0.08), dt, 2);
        const b = buscarBola(api);
        if (b && b.p.distanceTo(soporte) < 0.02 && t > 0.3) {
          bola = b.malla;
          fase = 'ir';
          desde = ahora;
          inicio = mano.punta.clone();
        }
      } else if (fase === 'ir') {
        const meta = soporte.clone().add(new V3(-0.02, 0.09, -0.02));
        hacia(mano, inicio.clone().lerp(meta, suave(t / 0.5)), dt);
        if (t > 0.55) { fase = 'coger'; desde = ahora; }
      } else if (fase === 'coger') {
        hacia(mano, soporte.clone().add(new V3(-0.02, 0.09, -0.02)), dt);
        mano.gatillo = 1;
        if (t > 0.15) {
          const p = bola.getWorldPosition(new V3());
          if (p.distanceTo(soporte) > 0.03) {
            fase = 'subir';
            inicio = mano.punta.clone();
          } else {
            mano.gatillo = 0;
            fase = 'esperar';
          }
          desde = ahora;
        }
      } else if (fase === 'subir') {
        mano.gatillo = 1;
        hacia(mano, inicio.clone().lerp(pecho, suave(t / 0.5)), dt);
        if (t > 0.65) { fase = 'atras'; desde = ahora; inicio = mano.punta.clone(); }
      } else if (fase === 'atras') {
        // Balanceo hacia atrás, como un péndulo
        mano.gatillo = 1;
        const u = suave(t / 0.5);
        const p = inicio.clone().lerp(atras, u);
        p.y -= Math.sin(u * Math.PI) * 0.12;
        hacia(mano, p, dt);
        if (t > 0.55) {
          fase = 'tirar';
          desde = ahora;
          inicio = mano.punta.clone();
          fotograma = 0;
          // Dirección: desde donde soltará la bola hacia la bolsa (con lo aprendido)
          const o = bola.getWorldPosition(new V3()).sub(mano.punta).add(suelta);
          const dir = new V3(BOLSA.x + ajuste.x - o.x, 0, BOLSA.z - o.z).normalize();
          vTiro = dir.multiplyScalar(RAPIDEZ).setY(0.25);
        }
      } else if (fase === 'tirar') {
        // Péndulo hacia delante (curva suave) y 4 fotogramas rectos a velocidad fija; suelta al final
        mano.gatillo = 1;
        const T = 0.4;
        const recto = 4 * dt;
        const entrada = suelta.clone().addScaledVector(vTiro, -recto);
        if (t < T) {
          hacia(mano, hermite(inicio, new V3(), entrada, vTiro, T, Math.min(1, (t + dt) / T)), dt, 9);
        } else {
          conVelocidad(mano, vTiro, dt);
          fotograma++;
          if (fotograma >= 4) {
            mano.gatillo = 0;
            api.bot.clics++;
            rodando = [];
            fase = 'acompanar';
            desde = ahora;
            inicio = mano.punta.clone();
          }
        }
      } else if (fase === 'acompanar') {
        // El brazo sigue hacia delante y arriba
        mano.gatillo = 0;
        const fin = new V3(0.16, 1.25, -0.6);
        hacia(mano, hermite(inicio, vTiro, fin, new V3(), 0.5, Math.min(1, (t + dt) / 0.5)), dt, 9);
        if (t > 0.9) { fase = 'esperar'; desde = ahora; }
      }
    },
  };
})();
