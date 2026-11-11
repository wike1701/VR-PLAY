// Jugada de pingpong: simula la bola con la física del juego (gravedad y bote en la mesa) para saber
// por dónde pasará al acabar la mesa, da un paso para jugarla de derecha y lleva allí la pala con la
// cara hacia la mesa rival; al llegar la bola, golpe hacia delante y acompañar. También saca.
(() => {
  // ─── Utilidades comunes de las jugadas de pelota ──────────────────────
  function utilidades(api) {
    const { V3, Quat, fab } = api;
    const Euler = fab.camara.rotation.constructor;
    const M4 = fab.camara.matrixWorld.constructor;
    const xr = window.__xr;
    // Posición, velocidad y aceleración de un objeto, medidas fotograma a fotograma
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
            else this.a.set(0, 0, 0); // un golpe: no es aceleración de vuelo
            this.v.copy(v);
            this.quieto = v.length() < 0.3 ? this.quieto + dt : 0;
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
    // Giro de la herramienta: bot-vr.js la orienta a lo largo del brazo; con mano.giro (el giro del
    // grip en el mundo) se gira el mando alrededor de la punta justo después de que lo coloque.
    const dq = [];
    function prepararGiro(mano) {
      if (dq[mano.i]) return true;
      const grip = fab.manos?.[mano.i]?.grip;
      if (!grip) return false;
      grip.updateMatrixWorld(true);
      const gq = new Quat();
      grip.matrixWorld.decompose(new V3(), gq, new V3());
      const c = mano.control.quaternion;
      dq[mano.i] = new Quat(c.x, c.y, c.z, c.w).invert().multiply(gq);
      const control = mano.control;
      const original = control.updateButtonValue.bind(control);
      control.updateButtonValue = (id, valor) => {
        original(id, valor);
        if (id === 'trigger' && mano.giro) girar(mano);
      };
      return true;
    }
    function girar(mano) {
      const c = mano.control;
      const qc = new Quat(c.quaternion.x, c.quaternion.y, c.quaternion.z, c.quaternion.w);
      const delta = mano.giro.clone().multiply(qc.clone().multiply(dq[mano.i]).invert());
      const pc = new V3(c.position.x, c.position.y, c.position.z).sub(mano.punta).applyQuaternion(delta).add(mano.punta);
      qc.premultiply(delta);
      c.position.set(pc.x, pc.y, pc.z);
      c.quaternion.set(qc.x, qc.y, qc.z, qc.w);
    }
    // Giro que lleva ejeLocal (del mango a la punta) hacia ejeMundo y caraLocal justo a caraMundo
    function giroDe(ejeLocal, caraLocal, ejeMundo, caraMundo) {
      const a1 = ejeLocal.clone().normalize();
      const a2 = caraLocal.clone().addScaledVector(a1, -caraLocal.dot(a1)).normalize();
      const a3 = a1.clone().cross(a2);
      const b2 = caraMundo.clone().normalize();
      const b1 = ejeMundo.clone().addScaledVector(b2, -ejeMundo.dot(b2));
      if (b1.lengthSq() < 1e-6) b1.set(1, 0, 0).addScaledVector(b2, -b2.x);
      b1.normalize();
      const b3 = b1.clone().cross(b2);
      const m = new M4().makeBasis(b1, b2, b3).multiply(new M4().makeBasis(a1, a2, a3).transpose());
      return new Quat().setFromRotationMatrix(m);
    }
    // Lleva mano.giro hacia un giro deseado sin saltos
    function orientar(mano, meta, dt, rapidez = 14) {
      if (!prepararGiro(mano)) return;
      if (!mano.giro) mano.giro = meta.clone();
      else mano.giro.slerp(meta, 1 - Math.exp(-dt * rapidez));
    }
    const hombro = (mano) => new V3(api.cabeza.pos.x + mano.signo * 0.18, api.cabeza.pos.y - 0.28, api.cabeza.pos.z);
    return { seguidor, muelle, cuerpo, moverCuerpo, giroDe, orientar, hombro };
  }

  // ─── Pingpong ─────────────────────────────────────────────────────────
  const G = 9.8;
  const MESA_Y = 0.76;
  const R_BOLA = 0.022;
  const Z_CERCA = -0.35;
  const Z_LEJOS = Z_CERCA - 2.74;
  const MEDIO_ANCHO = 1.525 / 2;
  const Z_GOLPE = -0.22;      // donde se le da a la bola (justo pasado el borde de la mesa)
  const ATRAS = 0.28;         // cuánto se echa atrás la pala antes de golpear
  const RAPIDEZ_GOLPE = 1.6;  // m/s hacia delante al golpear
  let u = null;
  let bola = null;
  let malla = null;
  let tras = 0;               // tiempo de acompañar el golpe
  let trayecto = [];

  const sobreMesa = (p) => Math.abs(p.x) <= MEDIO_ANCHO && p.z <= Z_CERCA && p.z >= Z_LEJOS;
  // Trayectoria de la bola desde ahora (puntos cada 10 ms) con la física del juego
  function simular(api, p0, v0) {
    const p = p0.clone();
    const v = v0.clone();
    const h = 0.01;
    const r = [];
    for (let i = 0; i < 160; i++) {
      v.y -= G * h;
      const antes = p.y;
      p.addScaledVector(v, h);
      if (v.y < 0 && p.y < MESA_Y + R_BOLA && antes >= MESA_Y + R_BOLA - 0.01 && sobreMesa(p)) {
        p.y = MESA_Y + R_BOLA;
        v.y *= -0.88;
        v.x *= 0.97;
        v.z *= 0.97;
      }
      r.push({ t: (i + 1) * h, p: p.clone() });
      if (p.y < MESA_Y - 0.3 || p.z > 0.6) break;
    }
    return r;
  }
  // Punto de la trayectoria a la profundidad z (y cuándo), o null
  function enZ(z) {
    for (let i = 1; i < trayecto.length; i++) {
      const a = trayecto[i - 1];
      const b = trayecto[i];
      if (a.p.z <= z && b.p.z > z) {
        const f = (z - a.p.z) / (b.p.z - a.p.z);
        return { t: a.t + (b.t - a.t) * f, p: a.p.clone().lerp(b.p, f) };
      }
    }
    return null;
  }

  window.__jugada = {
    vr(api, ahora, dt) {
      const { V3 } = api;
      if (!u) {
        u = utilidades(api);
        bola = u.seguidor();
        u.cuerpo.miraMeta.set(0, 0.85, -2.2);
        u.cuerpo.mira.copy(u.cuerpo.miraMeta);
      }
      const [izq, der] = api.manos;
      if (!malla?.parent) malla = api.buscar((m) => m.isMesh && !m.isInstancedMesh && m.geometry?.type === 'SphereGeometry' && Math.abs((m.geometry.parameters?.radius ?? 0) - R_BOLA) < 1e-4)[0]?.malla;
      if (malla) bola.poner(malla.getWorldPosition(new V3()), ahora);
      const p = bola.p;
      const v = bola.v;
      const k = 420;
      const adelantoMuelle = (2 * 0.9) / Math.sqrt(k); // lo que se retrasa el muelle por cada m/s

      const saque = malla && bola.quieto > 0.25 && p.z > -0.5 && p.z < 0 && Math.abs(p.y - (MESA_Y + 0.3)) < 0.08;
      const viene = malla && v.z > 0.6 && p.z < Z_GOLPE;
      let meta = null;
      let caraMundo = new V3(0, 0.22, -1);
      let x = 0.35;
      if (viene) {
        trayecto = simular(api, p, v);
        const cruce = enZ(Z_GOLPE);
        if (cruce) {
          // De derecha: el cuerpo se pone a la izquierda de donde llegará
          u.cuerpo.meta.set(Math.max(-0.7, Math.min(0.7, cruce.p.x - 0.36)), 0, 0);
          const zPala = Z_GOLPE + Math.min(ATRAS, Math.max(0, cruce.t) * RAPIDEZ_GOLPE);
          // La pala se pone en la trayectoria a la profundidad a la que va
          const enPala = enZ(Math.min(der.punta.z, Z_GOLPE + ATRAS)) || cruce;
          meta = new V3(enPala.p.x, enPala.p.y, zPala);
          if (cruce.t < ATRAS / RAPIDEZ_GOLPE) meta.z -= RAPIDEZ_GOLPE * adelantoMuelle;
          x = cruce.p.x;
          tras = 0.3;
        }
      } else if (saque) {
        // Saque: de detrás de la bola hacia delante, atravesándola
        u.cuerpo.meta.set(Math.max(-0.5, Math.min(0.5, p.x - 0.36)), 0, 0);
        if (bola.quieto < 0.9) meta = new V3(p.x, p.y, p.z + 0.2);
        else meta = new V3(p.x, p.y + 0.02, p.z - 0.3 - 1.5 * adelantoMuelle);
        x = p.x;
        tras = 0.25;
      }
      if (!meta && tras > 0) {
        // Acompañar el golpe hacia delante y arriba
        tras -= dt;
        meta = der.meta.clone();
        meta.z = Math.min(meta.z, Z_GOLPE - 0.12);
        meta.y += dt * 0.6;
      }
      if (!meta) {
        // Esperando: pala delante, a la derecha
        u.cuerpo.meta.set(api.cabeza.pos.x * 0.8, 0, 0);
        meta = new V3(api.cabeza.pos.x + 0.32, 1.0, -0.12);
        x = meta.x;
      }
      der.meta.copy(meta);
      der.rigidez = viene || saque || tras > 0 ? k : 90;
      der.gatillo = 0;
      // Revés si la bola viene muy a la izquierda del cuerpo
      const reves = x < api.cabeza.pos.x - 0.05;
      const ejeMundo = reves ? new V3(-1, 0.55, 0) : new V3(1, 0.6, 0);
      const ejeLocal = der.puntaLocal ? der.puntaLocal.clone() : new V3(0, 0, -1);
      u.orientar(der, u.giroDe(ejeLocal, new V3(1, 0, 0), ejeMundo, caraMundo), dt);
      // La otra mano, suelta delante del cuerpo (sin gatillo: cambiaría la pala de mano)
      izq.meta.set(api.cabeza.pos.x - 0.25, 1.05, -0.2);
      izq.rigidez = 30;
      izq.gatillo = 0;
      u.cuerpo.miraMeta.set(malla ? p.x * 0.6 : 0, 0.9, malla ? Math.min(-0.6, p.z) : -2.2);
      u.moverCuerpo(ahora, dt);
    },
  };
})();
