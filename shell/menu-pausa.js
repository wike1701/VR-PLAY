import * as THREE from 'three';

// ─── Menú de pausa en VR ────────────────────────────────────────────────
// Se abre al dejar la mano IZQUIERDA sobre el hombro izquierdo un momento.
// El juego se congela y aparece un menú flotante delante de ti: se elige
// apuntando con cualquier mando y apretando el gatillo, o tocando el botón con la mano.

// Hombro izquierdo respecto a la cabeza: x = derecha, y = arriba, z = detrás
const HOMBRO = new THREE.Vector3(-0.17, -0.2, 0.03);
const RADIO_HOMBRO = 0.14;     // a esta distancia la mano "está" en el hombro
const TIEMPO_GESTO = 0.7;      // segundos con la mano ahí para abrir el menú
const ENFRIAMIENTO = 1.2;      // segundos sin poder repetir el gesto
const DISTANCIA_MENU = 0.75;   // metros delante de los ojos
const ANCHO_BOTON = 0.5;
const ALTO_BOTON = 0.085;
const SEPARACION = 0.105;
const RADIO_TOQUE = 0.07;      // tocar el botón con la mano también vale

const COLOR_NORMAL = new THREE.Color(0.78, 0.78, 0.86);
const COLOR_ENCIMA = new THREE.Color(1, 1, 1);

export class MenuPausa {
  constructor(crearPanel, renderer, escena) {
    this.grupo = new THREE.Group();
    this.grupo.name = 'menu-pausa';
    this.grupo.visible = false;
    this.abierto = false;
    this.tiempoGesto = 0;
    this.enfriamiento = 0;

    this.titulo = crearPanel({ ancho: ANCHO_BOTON, alto: 0.12 });
    this.titulo.mesh.position.y = SEPARACION * 1.6;
    this.grupo.add(this.titulo.mesh);

    // Botones: id de la acción y panel
    this.botones = ['continuar', 'megusta', 'favorito', 'catalogo'].map((accion, i) => {
      const panel = crearPanel({ ancho: ANCHO_BOTON, alto: ALTO_BOTON, resolucion: 384 });
      panel.mesh.position.y = -i * SEPARACION + SEPARACION * 0.4;
      panel.mesh.material.color.copy(COLOR_NORMAL);
      panel.mesh.userData.accion = accion;
      this.grupo.add(panel.mesh);
      return { accion, panel };
    });
    // Que se vea por encima del juego aunque haya algo delante
    this.grupo.traverse((o) => {
      if (o.material) {
        o.material.depthTest = false;
        o.renderOrder = 990;
      }
    });
    escena.add(this.grupo);

    // Punteros láser: salen del "rayo" de cada mando (no del agarre)
    const geoLaser = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, 0, 0), new THREE.Vector3(0, 0, -1)]);
    const matLaser = new THREE.LineBasicMaterial({ color: 0xb9a8ff, transparent: true, opacity: 0.8, depthTest: false });
    this.punteros = [0, 1].map((i) => {
      const controlador = renderer.xr.getController(i);
      escena.add(controlador);
      const laser = new THREE.Line(geoLaser, matLaser);
      laser.renderOrder = 991;
      laser.visible = false;
      controlador.add(laser);
      return { controlador, laser };
    });

    this.rayo = new THREE.Raycaster();
    this.matrizGiro = new THREE.Matrix4();
    this.tmp = new THREE.Vector3();
    this.delante = new THREE.Vector3();
    this.derecha = new THREE.Vector3();
    this.mallas = this.botones.map((b) => b.panel.mesh);
  }

  // Textos: { titulo, meGusta: bool, total: número|null, favorito: bool }
  escribir({ titulo, meGusta, total, favorito }) {
    this.titulo.escribir([
      { texto: 'PAUSA', tam: 1, color: '#b9a8ff' },
      { texto: titulo, tam: 0.75 },
    ]);
    const textos = {
      continuar: { texto: '▶  Continuar', color: '#ffffff' },
      megusta: { texto: `${meGusta ? '♥  Te gusta' : '♡  Me gusta'}${total ? `  ·  ${total}` : ''}`, color: meGusta ? '#ff7aa2' : '#ffffff' },
      favorito: { texto: favorito ? '★  En favoritos' : '☆  Guardar en favoritos', color: favorito ? '#ffd54f' : '#ffffff' },
      catalogo: { texto: '←  Volver al catálogo', color: '#ffffff' },
    };
    for (const b of this.botones) b.panel.escribir([{ ...textos[b.accion], tam: 1 }]);
  }

  // Base horizontal de la cabeza (solo el giro, sin inclinar)
  base(cabezaDir) {
    this.delante.set(cabezaDir.x, 0, cabezaDir.z);
    if (this.delante.lengthSq() < 1e-6) this.delante.set(0, 0, -1);
    this.delante.normalize();
    this.derecha.set(-this.delante.z, 0, this.delante.x);
  }

  // Gesto de la mano izquierda en el hombro izquierdo. Devuelve:
  //   { abrir: true } al completarlo, { cargando: 0..1, mano } mientras se mantiene
  gesto(dt, cabezaPos, cabezaDir, manos) {
    this.enfriamiento = Math.max(0, this.enfriamiento - dt);
    const izquierda = manos.find((m) => m.activa && (m.lado ? m.lado === 'left' : m.indice === 0));
    if (!izquierda || this.enfriamiento > 0) {
      this.tiempoGesto = 0;
      return {};
    }
    this.base(cabezaDir);
    const hombro = this.tmp.copy(cabezaPos)
      .addScaledVector(this.derecha, HOMBRO.x)
      .addScaledVector(this.delante, -HOMBRO.z);
    hombro.y += HOMBRO.y;
    if (izquierda.posicion.distanceTo(hombro) > RADIO_HOMBRO) {
      this.tiempoGesto = 0;
      return {};
    }
    this.tiempoGesto += dt;
    if (this.tiempoGesto >= TIEMPO_GESTO) {
      this.tiempoGesto = 0;
      this.enfriamiento = ENFRIAMIENTO;
      return { abrir: true, mano: izquierda };
    }
    return { cargando: this.tiempoGesto / TIEMPO_GESTO, mano: izquierda };
  }

  abrir(cabezaPos, cabezaDir) {
    this.base(cabezaDir);
    this.grupo.position.copy(cabezaPos).addScaledVector(this.delante, DISTANCIA_MENU);
    this.grupo.position.y = cabezaPos.y - 0.12;
    this.grupo.lookAt(cabezaPos.x, this.grupo.position.y, cabezaPos.z);
    this.grupo.visible = true;
    this.abierto = true;
    for (const p of this.punteros) p.laser.visible = true;
  }

  cerrar() {
    this.grupo.visible = false;
    this.abierto = false;
    this.enfriamiento = ENFRIAMIENTO;
    for (const p of this.punteros) p.laser.visible = false;
  }

  // Con el menú abierto: resalta el botón apuntado y devuelve la acción elegida (o null)
  actualizar(manos) {
    if (!this.abierto) return null;
    let elegido = null;
    const encima = new Set();
    manos.forEach((m, i) => {
      const { controlador, laser } = this.punteros[i];
      laser.visible = m.activa;
      if (!m.activa) return;
      // Apuntar con el láser
      this.matrizGiro.identity().extractRotation(controlador.matrixWorld);
      this.rayo.ray.origin.setFromMatrixPosition(controlador.matrixWorld);
      this.rayo.ray.direction.set(0, 0, -1).applyMatrix4(this.matrizGiro);
      const choque = this.rayo.intersectObjects(this.mallas, false)[0];
      laser.scale.z = choque ? choque.distance : 1.5;
      if (choque) {
        encima.add(choque.object);
        if (m.gatilloPulsado) elegido = choque.object.userData.accion;
      }
      // O tocar el botón con la mano
      for (const malla of this.mallas) {
        malla.worldToLocal(this.tmp.copy(m.posicion));
        if (Math.abs(this.tmp.z) < RADIO_TOQUE && Math.abs(this.tmp.x) < ANCHO_BOTON / 2 && Math.abs(this.tmp.y) < ALTO_BOTON / 2) {
          encima.add(malla);
          if (!elegido && !this.tocando) elegido = malla.userData.accion;
          this.tocandoAhora = true;
        }
      }
    });
    // El toque cuenta una vez: hay que sacar la mano antes de volver a tocar
    this.tocando = !!this.tocandoAhora;
    this.tocandoAhora = false;
    for (const malla of this.mallas) {
      const activo = encima.has(malla);
      malla.material.color.copy(activo ? COLOR_ENCIMA : COLOR_NORMAL);
      malla.scale.setScalar(activo ? 1.05 : 1);
    }
    return elegido;
  }
}
