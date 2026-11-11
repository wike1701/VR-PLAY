// Jugada de portero: predice por dónde cruzará el balón el plano de los guantes (con la gravedad y
// el efecto lateral medido en vuelo), da un paso hacia ese lado (y se agacha si va bajo) y lleva
// los dos guantes juntos a ese punto antes de que llegue, como una parada de verdad.
(() => {
  // ─── Utilidades comunes de las jugadas de pelota ──────────────────────
  function utilidades(api) {
    const { V3, Quat, fab } = api;
    const Euler = fab.camara.rotation.constructor;
    const xr = window.__xr;
    // Posición y velocidad de un objeto, medidas fotograma a fotograma
    function seguidor() {
      return {
        p: new V3(), v: new V3(), a: new V3(), ok: false, t: 0, quieto: 0,
        poner(p, ahora) {
          if (this.ok && ahora > this.t) {
            const dt = (ahora - this.t) / 1000;
            const v = p.clone().sub(this.p).divideScalar(dt);
            if (v.length() > 40) v.set(0, 0, 0); // se ha recolocado de golpe
            const a = v.clone().sub(this.v).divideScalar(dt);
            if (a.length() < 40) this.a.lerp(a, 0.3);
            else this.a.set(0, 0, 0); // un golpe o un chute: no es aceleración de vuelo
            this.v.copy(v);
            this.quieto = v.length() < 0.05 ? this.quieto + dt : 0;
          }
          this.p.copy(p);
          this.t = ahora;
          this.ok = true;
        },
      };
    }
    function muelle(x, v, meta, k, dt) {
      const a = meta.clone().sub(x).multiplyScalar(k).addScaledVector(v, -2 * Math.sqrt(k));
      v.addScaledVector(a, dt);
      x.addScaledVector(v, dt);
    }
    // El cuerpo: desplazamiento de la cabeza (dar un paso, agacharse) y a dónde mira
    const cuerpo = {
      off: new V3(), vel: new V3(), meta: new V3(), k: 40,
      mira: new V3(...(api.cfg.mirar || [0, 1.1, -1])), velMira: new V3(), miraMeta: new V3(...(api.cfg.mirar || [0, 1.1, -1])), kMira: 30,
    };
    function moverCuerpo(ahora, dt) {
      muelle(cuerpo.off, cuerpo.vel, cuerpo.meta, cuerpo.k, dt);
      muelle(cuerpo.mira, cuerpo.velMira, cuerpo.miraMeta, cuerpo.kMira, dt);
      const s = ahora / 1000;
      const c = api.cabeza;
      c.pos.set(cuerpo.off.x + Math.sin(s * 0.7) * 0.02, api.ALTURA + cuerpo.off.y + Math.sin(s * 1.3) * 0.01, cuerpo.off.z + Math.sin(s * 0.5) * 0.015);
      c.mira.copy(cuerpo.mira);
      const dir = c.mira.clone().sub(c.pos).normalize();
      const q = new Quat().setFromEuler(new Euler(Math.asin(dir.y), Math.atan2(-dir.x, -dir.z), Math.sin(s * 0.6) * 0.02, 'YXZ'));
      xr.position.set(c.pos.x, c.pos.y, c.pos.z);
      xr.quaternion.set(q.x, q.y, q.z, q.w);
    }
    const hombro = (mano) => new V3(api.cabeza.pos.x + mano.signo * 0.18, api.cabeza.pos.y - 0.28, api.cabeza.pos.z);
    return { seguidor, muelle, cuerpo, moverCuerpo, hombro };
  }

  // ─── Portero ──────────────────────────────────────────────────────────
  const R_BALON = 0.11;
  const Z_GUANTES = -0.42; // plano donde se para (delante del cuerpo)
  let u = null;
  let balon = null;
  let bola = null;
  let lateral = 0; // aceleración lateral (efecto) medida en vuelo
  let pred = null;

  function buscarBalon(api) {
    if (balon && balon.parent) return balon;
    balon = api.buscar((m) => m.isMesh && m.geometry?.type === 'SphereGeometry' && Math.abs((m.geometry.parameters?.radius ?? 0) - R_BALON) < 1e-4 && m.material?.map)[0]?.malla || null;
    return balon;
  }

  window.__jugada = {
    vr(api, ahora, dt) {
      if (!u) {
        u = utilidades(api);
        bola = u.seguidor();
        u.cuerpo.miraMeta.set(0, 0.7, -6);
        u.cuerpo.mira.copy(u.cuerpo.miraMeta);
      }
      const [izq, der] = api.manos;
      const m = buscarBalon(api);
      if (m) bola.poner(m.getWorldPosition(new api.V3()), ahora);
      const p = bola.p;
      const v = bola.v;
      const viene = m && bola.ok && v.z > 3 && p.z < Z_GUANTES;
      if (viene) {
        lateral += (bola.a.x - lateral) * 0.25;
        const t = (Z_GUANTES - p.z) / v.z;
        pred = new api.V3(p.x + v.x * t + 0.5 * lateral * t * t, p.y + v.y * t - 0.5 * 9.8 * t * t, Z_GUANTES);
        pred.y = Math.max(R_BALON, pred.y);
      } else if (!(m && v.z > 0 && p.z < 0.6)) {
        pred = null;
        lateral = 0;
      }

      if (pred) {
        // Paso hacia el lado del tiro y, si va bajo, agacharse
        u.cuerpo.meta.set(Math.max(-0.75, Math.min(0.75, pred.x * 0.6)), Math.max(-0.5, Math.min(0, (pred.y - 1.25) * 0.55)), 0);
        u.cuerpo.k = 70;
        // Los dos guantes juntos donde llegará el balón (un poco por fuera, para abarcar más)
        const juntos = Math.abs(pred.x - api.cabeza.pos.x) < 0.25 && pred.y > 0.9 ? 0.11 : 0.09;
        izq.meta.set(pred.x - juntos, pred.y + 0.02, pred.z);
        der.meta.set(pred.x + juntos, pred.y + 0.02, pred.z);
        izq.rigidez = der.rigidez = 320;
        u.cuerpo.miraMeta.copy(p).lerp(pred, 0.5);
      } else {
        // Esperando el tiro: guantes delante, abiertos, y la vista en el lanzador
        u.cuerpo.meta.set(0, -0.08, 0);
        u.cuerpo.k = 25;
        const s = ahora / 1000;
        izq.meta.set(api.cabeza.pos.x - 0.26, 1.18 + Math.sin(s * 2.1) * 0.02, -0.33);
        der.meta.set(api.cabeza.pos.x + 0.26, 1.18 + Math.sin(s * 2.1 + 1) * 0.02, -0.33);
        izq.rigidez = der.rigidez = 60;
        u.cuerpo.miraMeta.set(0, 0.7, -6);
        if (m && p.z > -9) u.cuerpo.miraMeta.copy(p);
      }
      u.moverCuerpo(ahora, dt);
    },
  };
})();
