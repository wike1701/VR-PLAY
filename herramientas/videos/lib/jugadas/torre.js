// Jugada de la torre: suelta el bloque justo cuando pasa por encima de la cima.
// Lee la escena del juego: el bloque que se desliza (malla suelta con la geometría de la torre y
// material estándar) y la cima (la última instancia de la torre). Aprende sola el retraso entre
// apretar y que el juego lo vea: con el sitio en el que queda el bloque cortado sabe cuántos
// fotogramas ha llegado tarde.
(() => {
  let torre = null;
  let movil = null;
  let antes = null;          // posición del bloque en el fotograma anterior
  let espera = 0;            // ms hasta poder volver a soltar
  let soltarHasta = 0;       // ms con el gatillo apretado
  let pendiente = null;      // { cuenta, cima, delta, paso, eje } del último bloque soltado
  let retraso = 0;           // fotogramas de retraso medidos
  const m4 = { e: null };

  function encontrar(api) {
    if (torre?.parent && movil?.parent) return true;
    torre = movil = null;
    const raiz = api.raiz();
    if (!raiz) return false;
    const instancias = [];
    const sueltas = [];
    raiz.traverse((m) => {
      if (m.isInstancedMesh) instancias.push(m);
      else if (m.isMesh && m.material?.isMeshStandardMaterial) sueltas.push(m);
    });
    for (const i of instancias) {
      const s = sueltas.find((m) => m.geometry === i.geometry);
      if (s) { torre = i; movil = s; break; }
    }
    if (torre) m4.e = new api.THREE.Matrix4();
    return !!torre;
  }

  function cima(api) {
    if (!torre.count) return null;
    torre.getMatrixAt(torre.count - 1, m4.e);
    return new api.THREE.Vector3().setFromMatrixPosition(m4.e);
  }

  // ¿Toca soltar en este fotograma? Devuelve true una vez por bloque
  function decidir(api, ahora) {
    if (!encontrar(api) || !movil.visible) { antes = null; return false; }
    const p = movil.position.clone();
    const c = cima(api);
    if (!c) return false;
    // Aprender el retraso con el bloque que acaba de quedar en la torre
    if (pendiente && torre.count === pendiente.cuenta + 1) {
      const real = 2 * (c[pendiente.eje] - pendiente.cima[pendiente.eje]);
      if (Math.abs(real) > 0.009 && Math.abs(pendiente.paso) > 0.004) {
        const k = Math.round((real - pendiente.delta) / pendiente.paso);
        if (k >= 0 && k <= 3) retraso = k;
      }
      pendiente = null;
    }
    const v = antes ? p.clone().sub(antes) : null;
    antes = p;
    if (!v || v.length() > 0.15 || ahora < espera) return false;
    const eje = Math.abs(v.x) >= Math.abs(v.z) ? 'x' : 'z';
    const paso = v[eje];
    if (Math.abs(paso) < 1e-4) return false;
    const delta = p[eje] - c[eje];
    const previsto = delta + paso * retraso;
    // Suelta en el fotograma que deja el bloque más cerca de la cima (el siguiente quedaría peor)
    if (Math.abs(previsto) <= Math.abs(previsto + paso) && Math.abs(previsto) < Math.abs(paso) * 0.75 + 0.002) {
      pendiente = { cuenta: torre.count, cima: c, delta, paso, eje };
      espera = ahora + 350;
      return true;
    }
    return false;
  }

  window.__jugada = {
    vr(api, ahora) {
      const [izq, der] = api.manos;
      const s = ahora / 1000;
      // El mando de la grúa delante del pecho, con un ligero vaivén
      der.meta.set(0.16 + Math.sin(s * 0.8) * 0.01, 1.12 + Math.sin(s * 1.1) * 0.008, -0.34);
      der.rigidez = 60;
      izq.meta.copy(izq.reposo);
      izq.rigidez = 20;
      if (decidir(api, ahora)) { soltarHasta = ahora + 90; api.bot.clics++; }
      der.gatillo = ahora < soltarHasta ? 1 : 0;
      // Un pequeño golpe de pulgar al apretar
      if (der.gatillo) der.meta.y -= 0.012;
    },
    raton(api, ahora, dt) {
      api.mover(api.W * 0.5, api.H * 0.6, dt, 30);
      if (decidir(api, ahora)) api.clic();
    },
  };
})();
