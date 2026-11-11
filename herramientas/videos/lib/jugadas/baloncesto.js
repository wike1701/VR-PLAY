// Jugada de baloncesto (VR): coge el balón del soporte, lo sube delante del hombro y lo lanza con la
// velocidad justa para que caiga dentro del aro (juegos/baloncesto/juego.js: el balón sale con la
// velocidad media de la mano en los últimos ~80 ms × FUERZA_VR). La mano no va con un muelle libre:
// cada fotograma se le da la velocidad exacta (ver «conVelocidad»), así el tiro sale como se calcula.
// Tras cada tiro mira por dónde iba el balón y corrige el siguiente. Alterna las dos manos.
(() => {
  const G = 9.8;
  const ARO = [0, 2.75, -3.4];
  const FUERZA_VR = 1.45;
  const PUESTOS = [[-0.28, 1.0, -0.35], [0.28, 1.0, -0.35]];
  const VUELO = 1.0;          // segundos de vuelo: un arco alto, que entra limpio
  const K = 300;              // rigidez del muelle de la mano (bot-vr.js), solo para el cálculo

  // Deja mano.meta donde hace falta para que el muelle de bot-vr.js dé a la mano la velocidad v
  function conVelocidad(mano, v, dt) {
    mano.rigidez = K;
    const c = 2 * Math.sqrt(K) * 0.9;
    mano.meta.copy(v).sub(mano.vel).divideScalar(dt).addScaledVector(mano.vel, c).divideScalar(K).add(mano.punta);
  }
  // Lleva la punta justo a «p» en este fotograma (sin pasar de vmax m/s)
  function hacia(mano, p, dt, vmax = 6) {
    const v = p.clone().sub(mano.punta).divideScalar(dt);
    if (v.length() > vmax) v.setLength(vmax);
    conVelocidad(mano, v, dt);
  }
  const suave = (s) => (s <= 0 ? 0 : s >= 1 ? 1 : s * s * (3 - 2 * s));

  let fase = 'empezar';
  let desde = 0;
  let lado = 1;               // la mano que tira (0 izquierda, 1 derecha)
  let inicio = null;          // dónde empezó el tramo
  let vTiro = null;           // velocidad de la mano al soltar
  let fotograma = 0;
  let balon = null;           // la malla del balón que lleva o acaba de tirar
  let vuelo = [];             // posiciones del balón tras soltarlo, para corregir el siguiente
  const ajuste = { x: 0, z: 0 };

  function balones(api) {
    return api.buscar((m) => m.isMesh && m.geometry?.type === 'SphereGeometry' && Math.abs((m.geometry.parameters?.radius ?? 0) - 0.12) < 1e-3);
  }

  // Velocidad del balón para ir de o al aro (con el ajuste aprendido) en VUELO segundos
  function velocidadBalon(api, o) {
    const d = new api.V3(ARO[0] + ajuste.x - o.x, ARO[1] - o.y, ARO[2] + ajuste.z - o.z);
    return new api.V3(d.x / VUELO, d.y / VUELO + 0.5 * G * VUELO, d.z / VUELO);
  }

  // Con dos posiciones del balón ya en el aire: ¿por dónde cruza la altura del aro al bajar?
  function corregir(api) {
    if (vuelo.length < 3) return;
    const [a, b] = [vuelo[1], vuelo[2]];
    const dt = (b.t - a.t) / 1000;
    if (dt <= 0) return;
    const v = b.p.clone().sub(a.p).divideScalar(dt);
    v.y -= 0.5 * G * dt; // la media entre dos fotogramas es la velocidad de medio paso antes
    const h = b.p.y - ARO[1];
    const disc = v.y * v.y + 2 * G * h;
    if (disc < 0) return;
    const t = (v.y + Math.sqrt(disc)) / G;
    const ex = b.p.x + v.x * t - ARO[0];
    const ez = b.p.z + v.z * t - ARO[2];
    if (Math.abs(ex) > 1.5 || Math.abs(ez) > 1.5) return;
    ajuste.x -= ex * 1.3;
    ajuste.z -= ez * 1.3;
  }

  window.__jugada = {
    vr(api, ahora, dt) {
      const { manos, V3 } = api;
      const mano = manos[lado];
      const otra = manos[1 - lado];
      const t = (ahora - desde) / 1000;
      const puesto = new V3(...PUESTOS[lado]);
      const s = lado ? 1 : -1;
      const cargado = new V3(s * 0.17, 1.42, -0.12);

      // La otra mano, tranquila junto a la cadera
      otra.gatillo = 0;
      otra.meta.copy(otra.reposo);
      otra.rigidez = 25;

      // El balón tirado: sus primeras posiciones en el aire dicen cuánto corregir
      if (balon && fase !== 'coger' && fase !== 'cargar' && fase !== 'tirar') {
        if (vuelo.length < 3) vuelo.push({ p: balon.getWorldPosition(new V3()), t: ahora });
        if (vuelo.length === 3) { corregir(api); vuelo.push(null); }
      }

      if (fase === 'empezar') {
        inicio = mano.punta.clone();
        fase = 'ir';
        desde = ahora;
      } else if (fase === 'ir') {
        // Hasta el balón del soporte, por encima de él
        const meta = puesto.clone().add(new V3(0, 0.07, 0.04));
        hacia(mano, inicio.clone().lerp(meta, suave(t / 0.5)), dt);
        mano.gatillo = 0;
        const hay = balones(api).some((b) => b.p.distanceTo(puesto) < 0.03);
        if (t > 0.5 && hay) {
          fase = 'coger';
          desde = ahora;
        }
      } else if (fase === 'coger') {
        hacia(mano, puesto.clone().add(new V3(0, 0.07, 0.04)), dt);
        mano.gatillo = t > 0.05 ? 1 : 0;
        if (t > 0.2) {
          // ¿Lo lleva? El balón va con la mano y ya no está en el soporte
          const cerca = balones(api).sort((a, b) => a.p.distanceTo(mano.punta) - b.p.distanceTo(mano.punta))[0];
          if (cerca && cerca.p.distanceTo(mano.punta) < 0.12 && cerca.p.distanceTo(puesto) > 0.02) {
            balon = cerca.malla;
            vuelo = [];
            inicio = mano.punta.clone();
            fase = 'cargar';
          } else {
            mano.gatillo = 0;
            fase = 'ir';
            inicio = mano.punta.clone();
          }
          desde = ahora;
        }
      } else if (fase === 'cargar') {
        // Sube el balón delante del hombro, con el codo flexionado
        mano.gatillo = 1;
        const u = suave(t / 0.5);
        const medio = inicio.clone().lerp(cargado, u);
        medio.z += Math.sin(u * Math.PI) * 0.08;
        hacia(mano, medio, dt);
        if (t > 0.6) {
          fase = 'tirar';
          desde = ahora;
          fotograma = 0;
          vTiro = null;
        }
      } else if (fase === 'tirar') {
        // Empuje hacia el aro: acelera en 3 fotogramas y mantiene la velocidad 4 más; suelta en el 6
        mano.gatillo = 1;
        const bp = balon.getWorldPosition(new V3());
        const quedan = Math.max(0, 6 - fotograma);
        for (let i = 0; i < 3; i++) {
          const v = vTiro || new V3(0, 3, -2);
          const o = bp.clone().addScaledVector(v, dt * (1 + quedan));
          vTiro = velocidadBalon(api, o).divideScalar(FUERZA_VR);
        }
        const f = Math.min(1, (fotograma + 1) / 3);
        conVelocidad(mano, vTiro.clone().multiplyScalar(f), dt);
        if (fotograma >= 6) {
          mano.gatillo = 0;
          api.bot.clics++;
          fase = 'acompanar';
          desde = ahora;
        }
        fotograma++;
      } else if (fase === 'acompanar') {
        // La mano sigue el tiro y se frena (la muñeca «cae»)
        mano.gatillo = 0;
        conVelocidad(mano, vTiro.clone().multiplyScalar(Math.max(0, 1 - t / 0.25)), dt);
        if (t > 0.35) {
          fase = 'volver';
          desde = ahora;
          inicio = mano.punta.clone();
        }
      } else if (fase === 'volver') {
        mano.gatillo = 0;
        hacia(mano, inicio.clone().lerp(mano.reposo, suave(t / 0.35)), dt);
        if (t > 0.35) {
          lado = 1 - lado;
          fase = 'empezar';
          desde = ahora;
        }
      }
    },
  };
})();
