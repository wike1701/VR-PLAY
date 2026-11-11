// Jugada de Simón: mira qué tecla se hunde y brilla durante la muestra (la máquina la baja mientras
// suena su nota), se apunta la secuencia y, cuando se apagan todas, la repite en orden: con la
// baqueta de ese lado (VR, golpe de arriba abajo que se rearma al subir) o con un clic (ratón).
(() => {
  const DESDE = [90, 0, 180, 270]; // ángulo de inicio de cada tecla (verde, rojo, amarillo, azul)
  const R_MEDIO = 0.215;            // radio medio de las teclas en la consola
  const m = { vistas: [], cola: [], ronda: 1, ultimoBorde: 0, ignorarHasta: 0, encendida: [0, 0, 0, 0], estado: 'mirar', fase: 'ir', desde: 0, listo: 0 };

  const teclas = (api) => api.buscar((x) => x.isMesh && Number.isInteger(x.userData.tecla));
  // Un punto sobre la tecla i (y: altura sobre la cara de la consola, en su espacio)
  function puntoTecla(api, malla, y) {
    const a = ((DESDE[malla.userData.tecla] + 45) * Math.PI) / 180;
    return malla.parent.localToWorld(new api.V3(Math.cos(a) * R_MEDIO, y, -Math.sin(a) * R_MEDIO));
  }

  function observar(api, ahora) {
    const ts = teclas(api);
    if (ts.length < 4) return ts;
    // Todas brillando a la vez: es el parpadeo de fallo; la partida vuelve a empezar con un color
    if (ts.filter((t) => t.malla.material.emissiveIntensity > 0.5).length >= 3) {
      Object.assign(m, { vistas: [], cola: [], ronda: 1, estado: 'mirar', ignorarHasta: ahora + 500 });
      return ts;
    }
    let alguna = false;
    for (const t of ts) {
      const i = t.malla.userData.tecla;
      const on = t.malla.position.y < 0.002 && t.malla.material.emissiveIntensity > 0.9;
      if (on) alguna = true;
      if (on && !m.encendida[i] && m.estado === 'mirar' && ahora > m.ignorarHasta) {
        m.vistas.push(i);
        m.ultimoBorde = ahora;
      }
      m.encendida[i] = on;
    }
    // Fin de la muestra: ya salieron los de esta ronda (o hace rato que no sale ninguno) y se apagaron
    if (m.estado === 'mirar' && m.vistas.length && !alguna && ahora - m.ultimoBorde > 120 &&
      (m.vistas.length >= m.ronda || ahora - m.ultimoBorde > 1100)) {
      Object.assign(m, { cola: m.vistas, vistas: [], ronda: m.vistas.length + 1, estado: 'tocar', fase: 'ir', desde: ahora, listo: ahora + 120 });
    }
    return ts;
  }

  function terminarTurno(ahora) {
    Object.assign(m, { estado: 'mirar', ignorarHasta: ahora + 450 });
  }

  window.__jugada = {
    vr(api, ahora) {
      const ts = observar(api, ahora);
      const [izq, der] = api.manos;
      api.cabeza.mira.set(0, 0.92, -0.5);
      const consola = ts[0]?.malla.parent;
      if (!consola) return;
      const local = (v) => consola.worldToLocal(v.clone());
      // La que no toca espera encima de su lado de la consola
      const flotar = (mano) => {
        mano.meta.copy(consola.localToWorld(new api.V3(mano.signo * 0.2, 0.2, 0.14)));
        mano.rigidez = 40;
      };
      if (m.estado !== 'tocar' || !m.cola.length) {
        flotar(izq);
        flotar(der);
        return;
      }
      const t = ts.find((x) => x.malla.userData.tecla === m.cola[0]);
      const encima = puntoTecla(api, t.malla, 0.14);
      const abajo = puntoTecla(api, t.malla, 0.012);
      const mano = local(encima).x < 0 ? izq : der;
      flotar(mano === izq ? der : izq);
      if (m.fase === 'ir') {
        mano.meta.copy(encima);
        mano.rigidez = 260;
        if (mano.punta.distanceTo(encima) < 0.035 || ahora - m.desde > 450) Object.assign(m, { fase: 'bajar', desde: ahora });
      } else if (m.fase === 'bajar') {
        mano.meta.copy(abajo);
        mano.rigidez = 900;
        if (local(mano.punta).y < 0.04 || ahora - m.desde > 260) {
          api.bot.clics++;
          Object.assign(m, { fase: 'subir', desde: ahora });
        }
      } else {
        mano.meta.copy(encima);
        mano.rigidez = 500;
        if (local(mano.punta).y > 0.11 || ahora - m.desde > 300) {
          m.cola.shift();
          Object.assign(m, { fase: 'ir', desde: ahora });
          if (!m.cola.length) terminarTurno(ahora);
        }
      }
    },

    raton(api, ahora, dt) {
      const ts = observar(api, ahora);
      if (ts.length < 4) return;
      if (m.estado !== 'tocar' || !m.cola.length) {
        const c = api.aPantalla(ts[0].malla.parent.localToWorld(new api.V3(0, 0.05, 0.12)));
        api.mover(c.x, c.y, dt, 20);
        return;
      }
      const t = ts.find((x) => x.malla.userData.tecla === m.cola[0]);
      const s = api.aPantalla(puntoTecla(api, t.malla, 0.026));
      api.mover(s.x, s.y, dt, 220);
      const quieto = Math.hypot(api.p.vx, api.p.vy) < 250;
      if (Math.hypot(s.x - api.p.x, s.y - api.p.y) < 7 && quieto && ahora > m.listo && !api.p.pulsado) {
        api.clic();
        m.cola.shift();
        m.listo = ahora + 200;
        if (!m.cola.length) terminarTurno(ahora);
      }
    },
  };
})();
