// Reloj virtual para grabar fotograma a fotograma (lib/grabar.mjs, --reloj virtual). Se ejecuta en la
// página antes que nada. Hasta que se activa, todo va con el reloj de verdad (cargar la web, entrar en
// VR, las esperas de Playwright). Una vez activado, el tiempo solo avanza con window.__reloj.paso(dt):
// performance.now, Date.now, requestAnimationFrame y setTimeout van con ese tiempo. Así cada
// fotograma sale perfecto aunque el ordenador tarde un segundo en dibujarlo (sin GPU, en la nube):
// el juego, el bot y el espectador ven siempre 1/30 s entre fotogramas.
(() => {
  const real = {
    ahora: performance.now.bind(performance),
    fecha: Date.now,
    raf: window.requestAnimationFrame.bind(window),
    caf: window.cancelAnimationFrame.bind(window),
    st: window.setTimeout.bind(window),
    ct: window.clearTimeout.bind(window),
  };
  let activo = false;
  let t = 0;
  let desfaseFecha = 0;
  let siguiente = 1;
  const cuadros = new Map();
  let temporizadores = [];

  performance.now = () => (activo ? t : real.ahora());
  Date.now = () => (activo ? Math.round(desfaseFecha + t) : real.fecha());
  window.requestAnimationFrame = (cb) => {
    if (!activo) return real.raf(cb);
    const id = -siguiente++;
    cuadros.set(id, cb);
    return id;
  };
  window.cancelAnimationFrame = (id) => (id < 0 ? cuadros.delete(id) : real.caf(id));
  window.setTimeout = (cb, ms = 0, ...extra) => {
    if (!activo || typeof cb !== 'function') return real.st(cb, ms, ...extra);
    const id = -siguiente++;
    temporizadores.push({ id, en: t + Math.max(0, ms), cb, extra });
    return id;
  };
  window.clearTimeout = (id) => {
    if (id < 0) temporizadores = temporizadores.filter((x) => x.id !== id);
    else real.ct(id);
  };

  window.__reloj = {
    activar() {
      t = real.ahora();
      desfaseFecha = real.fecha() - t;
      activo = true;
    },
    // Avanza dt segundos: primero los temporizadores que tocan y después un fotograma
    paso(dt) {
      t += dt * 1000;
      temporizadores.sort((a, b) => a.en - b.en);
      while (temporizadores.length && temporizadores[0].en <= t) {
        const x = temporizadores.shift();
        try { x.cb(...x.extra); } catch (e) { console.error(e); }
      }
      const lista = [...cuadros.values()];
      cuadros.clear();
      for (const cb of lista) {
        try { cb(t); } catch (e) { console.error(e); }
      }
    },
    get activo() { return activo; },
  };
})();
