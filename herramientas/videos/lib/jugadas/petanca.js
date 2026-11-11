// Jugada de petanca (VR): en su turno coge la bola del soporte, balancea el brazo atrás y la lanza por
// abajo, con un arco de 45°, para que se pare justo delante del boliche. La caída, el frenazo en la
// grava, el botecito y la rodadura se simulan aquí igual que en juegos/petanca/juego.js y se busca la
// velocidad que deja la bola donde hace falta. La bola sale con la velocidad media de la mano en ~80 ms
// × FUERZA_VR: cada fotograma se le da a la mano la velocidad exacta (ver «conVelocidad») y, tras
// cada tiro, mira cómo salió la bola y corrige el siguiente.
(() => {
  const G = 9.8;
  const R_BOLA = 0.045;
  const IMPACTO = 0.35;
  const ROZAMIENTO = 0.5;
  const FUERZA_VR = 1.1;
  const SOPORTE = [0.25, 0.95, -0.28];
  const ANGULO = Math.PI / 4;
  const ANTES = 0.08;         // se queda a 8 cm del boliche (sin empujarlo)
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
  function hermite(a, va, b, vb, T, s) {
    const s2 = s * s, s3 = s2 * s;
    return a.clone().multiplyScalar(2 * s3 - 3 * s2 + 1)
      .addScaledVector(va, T * (s3 - 2 * s2 + s))
      .addScaledVector(b, -2 * s3 + 3 * s2)
      .addScaledVector(vb, T * (s3 - s2));
  }

  // Dónde se para una bola que sale de o con velocidad v (sin choques), como simular() del juego
  function parada(o, v0) {
    const p = o.clone();
    const v = v0.clone();
    const h = 1 / 30 / 6;
    for (let n = 0; n < 30 * 6 * 10; n++) {
      if (!(p.y <= R_BOLA + 0.001 && v.y <= 0)) v.y -= G * h;
      p.addScaledVector(v, h);
      if (p.y < R_BOLA) {
        p.y = R_BOLA;
        if (v.y < -1.5) { v.x *= IMPACTO; v.z *= IMPACTO; v.y *= -0.15; } else v.y = 0;
      }
      if (p.y <= R_BOLA + 0.001 && v.y <= 0) {
        const s = Math.hypot(v.x, v.z);
        const nueva = Math.max(0, s - ROZAMIENTO * G * h);
        if (s > 0) { v.x *= nueva / s; v.z *= nueva / s; }
        if (nueva === 0) break;
      }
    }
    return p;
  }
  // Velocidad de la bola (arco de 45°) para que se pare en «destino» saliendo de o
  function velocidadPara(api, o, destino) {
    const dir = new api.V3(destino.x - o.x, 0, destino.z - o.z);
    const d = dir.length();
    dir.normalize();
    const con = (s) => dir.clone().multiplyScalar(s * Math.cos(ANGULO)).setY(s * Math.sin(ANGULO));
    let lo = 1, hi = 14;
    for (let i = 0; i < 30; i++) {
      const s = (lo + hi) / 2;
      const p = parada(o, con(s));
      const recorrido = (p.x - o.x) * dir.x + (p.z - o.z) * dir.z;
      if (recorrido < d) lo = s; else hi = s;
    }
    return con((lo + hi) / 2);
  }

  let fase = 'esperar';
  let desde = 0;
  let inicio = null;
  let bola = null;
  let vTiro = null;
  let objetivo = null;
  let fotograma = 0;
  let vuelo = [];
  const ajuste = { lado: 0, largo: 0 };

  const bolas = (api) => api.buscar((m) => m.isMesh && m.geometry?.type === 'SphereGeometry' && Math.abs((m.geometry.parameters?.radius ?? 0) - R_BOLA) < 1e-3);
  const boliche = (api) => api.buscar((m) => m.isMesh && m.geometry?.type === 'SphereGeometry' && Math.abs((m.geometry.parameters?.radius ?? 0) - 0.03) < 1e-3)[0];

  // Con la bola ya en el aire (dos posiciones), ¿dónde se parará? Corrige el siguiente tiro
  function corregir(api) {
    const [a, b] = [vuelo[1], vuelo[2]];
    const dt = (b.t - a.t) / 1000;
    if (!objetivo || dt <= 0) return;
    const v = b.p.clone().sub(a.p).divideScalar(dt);
    v.y -= 0.5 * G * dt;
    const p = parada(b.p, v);
    const dir = new api.V3(objetivo.x - b.p.x, 0, objetivo.z - b.p.z).normalize();
    const ex = p.x - objetivo.x;
    const ez = p.z - objetivo.z;
    const largo = ex * dir.x + ez * dir.z;
    const lado = ex * -dir.z + ez * dir.x;
    if (Math.abs(largo) > 3 || Math.abs(lado) > 2) return;
    ajuste.largo -= largo * 0.9;
    ajuste.lado -= lado * 0.9;
  }

  window.__jugada = {
    vr(api, ahora, dt) {
      const { manos, V3 } = api;
      const mano = manos[1];
      const otra = manos[0];
      const t = (ahora - desde) / 1000;
      const soporte = new V3(...SOPORTE);
      const atras = new V3(0.26, 0.82, 0.22);
      const suelta = new V3(0.22, 1.02, -0.42);
      otra.gatillo = 0;
      otra.rigidez = 25;
      otra.meta.set(-0.3, 1.0, -0.25);

      if (bola && vuelo.length < 3 && (fase === 'acompanar' || fase === 'volver')) {
        vuelo.push({ p: bola.getWorldPosition(new V3()), t: ahora });
        if (vuelo.length === 3) corregir(api);
      }

      if (fase === 'esperar') {
        mano.gatillo = 0;
        hacia(mano, mano.punta.clone().lerp(new V3(0.28, 1.08, -0.2), 0.06), dt, 2);
        const b = bolas(api).find((x) => x.p.distanceTo(soporte) < 0.02);
        if (b && t > 0.4) {
          bola = b.malla;
          fase = 'ir';
          desde = ahora;
          inicio = mano.punta.clone();
        }
      } else if (fase === 'ir') {
        const meta = soporte.clone().add(new V3(0, 0.07, 0.03));
        hacia(mano, inicio.clone().lerp(meta, suave(t / 0.45)), dt);
        if (t > 0.5) { fase = 'coger'; desde = ahora; }
      } else if (fase === 'coger') {
        hacia(mano, soporte.clone().add(new V3(0, 0.07, 0.03)), dt);
        mano.gatillo = 1;
        if (t > 0.15) {
          if (bola.getWorldPosition(new V3()).distanceTo(soporte) > 0.03) {
            fase = 'atras';
            inicio = mano.punta.clone();
          } else {
            mano.gatillo = 0;
            fase = 'esperar';
          }
          desde = ahora;
        }
      } else if (fase === 'atras') {
        // Mira al boliche, apunta y balancea el brazo hacia atrás
        mano.gatillo = 1;
        const u = suave(t / 0.6);
        const p = inicio.clone().lerp(atras, u);
        p.y -= Math.sin(u * Math.PI) * 0.1;
        hacia(mano, p, dt);
        if (t > 0.7) {
          const j = boliche(api);
          if (!j) return;
          const o = bola.getWorldPosition(new V3()).sub(mano.punta).add(suelta);
          const dir = new V3(j.p.x - o.x, 0, j.p.z - o.z).normalize();
          objetivo = j.p.clone().addScaledVector(dir, -ANTES);
          objetivo.y = R_BOLA;
          // Lo aprendido: un poco más largo o corto y a un lado
          const apunta = objetivo.clone().addScaledVector(dir, ajuste.largo).add(new V3(-dir.z, 0, dir.x).multiplyScalar(ajuste.lado));
          vTiro = velocidadPara(api, o, apunta).divideScalar(FUERZA_VR);
          fase = 'tirar';
          desde = ahora;
          inicio = mano.punta.clone();
          fotograma = 0;
        }
      } else if (fase === 'tirar') {
        mano.gatillo = 1;
        const T = 0.42;
        const entrada = suelta.clone().addScaledVector(vTiro, -4 * dt);
        if (t < T) {
          hacia(mano, hermite(inicio, new V3(), entrada, vTiro, T, Math.min(1, (t + dt) / T)), dt, 11);
        } else {
          conVelocidad(mano, vTiro, dt);
          fotograma++;
          if (fotograma >= 4) {
            mano.gatillo = 0;
            api.bot.clics++;
            vuelo = [];
            fase = 'acompanar';
            desde = ahora;
            inicio = mano.punta.clone();
          }
        }
      } else if (fase === 'acompanar') {
        mano.gatillo = 0;
        const fin = new V3(0.2, 1.45, -0.55);
        hacia(mano, hermite(inicio, vTiro, fin, new V3(), 0.45, Math.min(1, (t + dt) / 0.45)), dt, 11);
        if (t > 0.5) { fase = 'volver'; desde = ahora; inicio = mano.punta.clone(); }
      } else if (fase === 'volver') {
        mano.gatillo = 0;
        hacia(mano, inicio.clone().lerp(new V3(0.28, 1.08, -0.2), suave(t / 0.6)), dt);
        if (t > 0.6) { fase = 'esperar'; desde = ahora; }
      }
    },
  };
})();
