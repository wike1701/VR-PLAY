import * as THREE from 'three';

// ─────────────────────────────────────────────────────────────────────────
// KIT DE EFECTOS (ctx.efectos): la "sensación de juego" común a todos los juegos.
// Un buen acierto no es un solo sonido: son varias respuestas pequeñas a la vez (vibración,
// partículas, un número que salta, una micro-pausa) que duran muy poco y vuelven al reposo.
// Todo sale de bolsas preparadas al arrancar: no se crea nada mientras se juega (en el Quest,
// crear objetos en cada acierto acaba dando tirones).
//
//   ctx.efectos.impacto(nivel, { pos, mano, color, sonido })   nivel: 'pequeño' | 'medio' | 'grande'
//   ctx.efectos.estallido(pos, { color, cantidad, fuerza, tam, vida, gravedad })
//   ctx.efectos.texto(pos, '+3', { color, tam, vida })
//
// En VR la cámara NUNCA se sacude (marea): allí la sacudida se cambia por vibración.
// Con el sistema en "reducir movimiento" no hay sacudida ni micro-pausa.
// ─────────────────────────────────────────────────────────────────────────

const MAX_PARTICULAS = 320;
const MAX_TEXTOS = 6;
const REDUCIR = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

// Cuánto de cada cosa da cada nivel de importancia (todos los juegos igual de proporcionados)
const NIVELES = {
  pequeño: { vibra: [0.25, 30], particulas: 7, fuerza: 1.4, sacudida: 0.12, pausa: 0 },
  medio: { vibra: [0.6, 60], particulas: 16, fuerza: 2.2, sacudida: 0.3, pausa: 0.035 },
  grande: { vibra: [1, 140], particulas: 34, fuerza: 3.2, sacudida: 0.6, pausa: 0.08 },
};
NIVELES.pequeno = NIVELES.pequeño;

export function crearEfectos({ escena, camara, crearPanel, vibrar, sonido, enVR }) {
  // ─── Partículas: una sola malla instanciada (una llamada de dibujo para todas) ─────
  const geo = new THREE.IcosahedronGeometry(1, 0);
  const mat = new THREE.MeshBasicMaterial({ toneMapped: false });
  const malla = new THREE.InstancedMesh(geo, mat, MAX_PARTICULAS);
  malla.instanceMatrix.setUsage(THREE.DynamicDrawUsage);
  malla.setColorAt(0, new THREE.Color());
  malla.instanceColor.setUsage(THREE.DynamicDrawUsage);
  malla.frustumCulled = false;
  malla.count = 0;
  malla.renderOrder = 5;
  escena.add(malla);
  const particulas = Array.from({ length: MAX_PARTICULAS }, () => ({
    pos: new THREE.Vector3(), vel: new THREE.Vector3(), vida: 0, total: 1, tam: 0.02, gravedad: 6, color: new THREE.Color(),
  }));
  let siguiente = 0;

  // ─── Textos que saltan ("+3", "¡PLENO!"): paneles sin fondo, siempre de cara al jugador ───
  const textos = Array.from({ length: MAX_TEXTOS }, () => {
    const panel = crearPanel({ ancho: 0.6, alto: 0.2, resolucion: 384, fondo: null });
    panel.mesh.visible = false;
    panel.mesh.material.depthTest = false;
    panel.mesh.renderOrder = 900;
    escena.add(panel.mesh);
    return { panel, vida: 0, total: 1, base: new THREE.Vector3(), escala: 1 };
  });
  let siguienteTexto = 0;

  // ─── Sacudida de la cámara (solo con ratón) y micro-pausa de impacto ────────────────
  let trauma = 0;
  let tiempo = 0;
  let pausa = 0;
  const desplazado = new THREE.Vector3();
  const tmp = new THREE.Vector3();
  const matriz = new THREE.Matrix4();
  const giro = new THREE.Quaternion();
  const escalaV = new THREE.Vector3();
  const cabeza = new THREE.Vector3();

  function estallido(pos, { color = 0xffffff, cantidad = 14, fuerza = 2.2, tam = 0.022, vida = 0.55, gravedad = 6 } = {}) {
    for (let i = 0; i < cantidad; i++) {
      const p = particulas[siguiente];
      siguiente = (siguiente + 1) % MAX_PARTICULAS;
      p.pos.copy(pos);
      // Dirección al azar en una esfera, con algo más hacia arriba
      p.vel.set(Math.random() * 2 - 1, Math.random() * 1.6 - 0.4, Math.random() * 2 - 1).normalize()
        .multiplyScalar(fuerza * (0.45 + Math.random() * 0.75));
      p.total = p.vida = vida * (0.7 + Math.random() * 0.6);
      p.tam = tam * (0.6 + Math.random() * 0.8);
      p.gravedad = gravedad;
      p.color.set(color).offsetHSL(0, 0, (Math.random() - 0.5) * 0.2);
    }
  }

  function texto(pos, contenido, { color = '#ffffff', tam = 1, vida = 0.9 } = {}) {
    const t = textos[siguienteTexto];
    siguienteTexto = (siguienteTexto + 1) % MAX_TEXTOS;
    t.panel.escribir([{ texto: String(contenido), color, peso: 800 }]);
    t.base.copy(pos);
    t.total = t.vida = vida;
    t.escala = tam;
    t.panel.mesh.visible = true;
  }

  function impacto(nivel = 'medio', { pos = null, mano = null, color = 0xffffff, sonido: nombre = null } = {}) {
    const n = NIVELES[nivel] || NIVELES.medio;
    if (nombre) sonido(nombre);
    if (mano) vibrar(mano, n.vibra[0], n.vibra[1]);
    if (pos && n.particulas) estallido(pos, { color, cantidad: n.particulas, fuerza: n.fuerza });
    if (!REDUCIR) {
      if (!enVR()) trauma = Math.min(1, trauma + n.sacudida);
      pausa = Math.max(pausa, n.pausa);
    }
  }

  // Devuelve el dt que tiene que recibir el juego (casi parado durante la micro-pausa)
  function escalaTiempo(dt) {
    if (pausa <= 0) return dt;
    pausa -= dt;
    return dt * 0.08;
  }

  // Antes de que el juego mueva nada: quitar la sacudida del fotograma anterior
  function antes() {
    if (desplazado.lengthSq()) {
      camara.position.sub(desplazado);
      desplazado.set(0, 0, 0);
    }
  }

  function actualizar(dt) {
    tiempo += dt;
    // Partículas
    let n = 0;
    for (const p of particulas) {
      if (p.vida <= 0) continue;
      p.vida -= dt;
      if (p.vida <= 0) continue;
      p.vel.y -= p.gravedad * dt;
      p.vel.multiplyScalar(1 - 1.8 * dt); // el aire las frena
      p.pos.addScaledVector(p.vel, dt);
      const f = p.vida / p.total;
      escalaV.setScalar(p.tam * (0.3 + 0.7 * f));
      giro.setFromAxisAngle(tmp.set(0.3, 1, 0.2).normalize(), tiempo * 6 + n);
      malla.setMatrixAt(n, matriz.compose(p.pos, giro, escalaV));
      malla.setColorAt(n, p.color);
      n++;
    }
    malla.count = n;
    if (n) {
      malla.instanceMatrix.needsUpdate = true;
      malla.instanceColor.needsUpdate = true;
    }

    // Textos: suben, crecen con rebote al aparecer y se desvanecen al final
    camara.getWorldPosition(cabeza);
    for (const t of textos) {
      if (t.vida <= 0) continue;
      t.vida -= dt;
      const m = t.panel.mesh;
      if (t.vida <= 0) {
        m.visible = false;
        continue;
      }
      const edad = 1 - t.vida / t.total;
      const entrada = Math.min(1, edad / 0.18);
      const rebote = 1 + 0.35 * Math.sin(entrada * Math.PI) * (1 - entrada * 0.4); // "pop" con sobrepaso
      m.position.copy(t.base);
      m.position.y += 0.08 + edad * 0.28;
      m.scale.setScalar(t.escala * Math.max(0.01, entrada) * rebote);
      m.material.opacity = edad > 0.7 ? 1 - (edad - 0.7) / 0.3 : 1;
      m.lookAt(cabeza);
    }

    // Sacudida con "trauma" que decae: suave (senos, no ruido) y solo sin gafas
    if (trauma > 0) {
      trauma = Math.max(0, trauma - 1.6 * dt);
      if (!enVR()) {
        const s = trauma * trauma * 0.03;
        desplazado.set(Math.sin(tiempo * 47) * s, Math.sin(tiempo * 59 + 1.3) * s * 0.7, 0);
        camara.position.add(desplazado);
      }
    }
  }

  // Al cambiar de juego no queda nada a medias
  function limpiar() {
    for (const p of particulas) p.vida = 0;
    malla.count = 0;
    for (const t of textos) {
      t.vida = 0;
      t.panel.mesh.visible = false;
    }
    antes();
    trauma = 0;
    pausa = 0;
  }

  return { api: { impacto, estallido, texto }, escalaTiempo, antes, actualizar, limpiar };
}
