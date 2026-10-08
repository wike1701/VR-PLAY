import * as THREE from 'three';

// ─── Ajustes del botón de cambio de juego ───────────────────────────────
// Posición respecto a la cabeza, en metros, en el "cuerpo" del jugador:
// x = derecha, y = arriba, z = detrás (el jugador mira hacia -z).
const DESPLAZAMIENTO = new THREE.Vector3(0.28, 0.1, 0.24);
const RADIO_ZONA = 0.16;      // a esta distancia la mano "toca" el botón
const TIEMPO_PULSACION = 0.5; // segundos con la mano dentro para activarlo
const MARGEN_GIRO = 0.8;      // radianes que puede girar la cabeza sin arrastrar el botón
const ENFRIAMIENTO = 1.5;     // segundos sin poder volver a activarlo
const SEGMENTOS = 48;

const EJE_Y = new THREE.Vector3(0, 1, 0);

function normalizarAngulo(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Botón virtual que flota detrás del hombro derecho del jugador.
// Se activa al dejar la mano dentro medio segundo o al apretar el gatillo tocándolo.
export class BotonCambio {
  constructor(crearPanel) {
    this.grupo = new THREE.Group();
    this.grupo.name = 'boton-cambio';

    const base = new THREE.Mesh(
      new THREE.CylinderGeometry(0.095, 0.1, 0.03, 32),
      new THREE.MeshLambertMaterial({ color: 0x23233a }),
    );
    base.rotation.x = Math.PI / 2;

    this.tapa = new THREE.Mesh(
      new THREE.CylinderGeometry(0.07, 0.07, 0.03, 32),
      new THREE.MeshLambertMaterial({ color: 0x7c5cff, emissive: 0x2a1a70 }),
    );
    this.tapa.rotation.x = Math.PI / 2;
    this.tapa.position.z = 0.02;

    // Flecha "siguiente" dibujada sobre la tapa
    const flecha = new THREE.Mesh(
      new THREE.CircleGeometry(0.035, 3),
      new THREE.MeshBasicMaterial({ color: 0xffffff }),
    );
    // La tapa está girada: su eje +Y local apunta hacia el jugador
    flecha.rotation.x = -Math.PI / 2;
    flecha.position.y = 0.016;
    this.tapa.add(flecha);

    // Anillo que se rellena mientras mantienes la mano dentro
    this.anillo = new THREE.Mesh(
      new THREE.RingGeometry(0.105, 0.125, SEGMENTOS, 1),
      new THREE.MeshBasicMaterial({ color: 0x00e5ff, side: THREE.DoubleSide }),
    );
    this.anillo.position.z = 0.025;
    this.anillo.geometry.setDrawRange(0, 0);

    this.etiqueta = crearPanel({ ancho: 0.34, alto: 0.11, resolucion: 384 });
    this.etiqueta.mesh.position.set(0, 0.18, 0);

    this.grupo.add(base, this.tapa, this.anillo, this.etiqueta.mesh);
    this.grupo.visible = false;

    this.yawCuerpo = 0;
    this.progreso = 0;
    this.enfriamiento = 0;
    this.debeSalir = false;
    this.manoDentroAntes = false;
    this.colocado = false;
    this._objetivo = new THREE.Vector3();
  }

  setSiguiente(titulo) {
    this.etiqueta.escribir([
      { texto: 'SIGUIENTE JUEGO', tam: 0.8, color: '#b9a8ff' },
      { texto: titulo, tam: 1.2 },
    ]);
  }

  // Al entrar en VR: recalcular la orientación del cuerpo desde cero.
  reiniciar() {
    this.colocado = false;
    this.progreso = 0;
    this.debeSalir = false;
  }

  /**
   * @param {number} dt
   * @param {THREE.Vector3} cabezaPos posición de la cabeza en el mundo
   * @param {THREE.Vector3} cabezaDir dirección en la que mira
   * @param {Array<{posicion: THREE.Vector3, gatilloPulsado: boolean}>} manos manos activas
   * @returns {{activado: boolean, entro: object|null, mano: object|null}}
   */
  actualizar(dt, cabezaPos, cabezaDir, manos) {
    const yawCabeza = Math.atan2(-cabezaDir.x, -cabezaDir.z);

    // El "cuerpo" solo gira cuando la cabeza se aleja más de MARGEN_GIRO.
    // Así el botón no se mueve al mirar un poco a los lados.
    if (!this.colocado) this.yawCuerpo = yawCabeza;
    const diferencia = normalizarAngulo(yawCabeza - this.yawCuerpo);
    if (diferencia > MARGEN_GIRO) this.yawCuerpo += diferencia - MARGEN_GIRO;
    else if (diferencia < -MARGEN_GIRO) this.yawCuerpo += diferencia + MARGEN_GIRO;

    this._objetivo.copy(DESPLAZAMIENTO).applyAxisAngle(EJE_Y, this.yawCuerpo).add(cabezaPos);
    if (!this.colocado) {
      this.grupo.position.copy(this._objetivo);
      this.colocado = true;
    } else {
      this.grupo.position.lerp(this._objetivo, 1 - Math.exp(-dt * 10));
    }
    this.grupo.lookAt(cabezaPos);

    // ¿Alguna mano lo está tocando?
    this.enfriamiento = Math.max(0, this.enfriamiento - dt);
    let manoDentro = null;
    for (const m of manos) {
      if (m.posicion.distanceTo(this.grupo.position) < RADIO_ZONA) {
        manoDentro = m;
        break;
      }
    }

    const resultado = { activado: false, entro: null, mano: manoDentro };
    if (manoDentro && !this.manoDentroAntes) resultado.entro = manoDentro;
    this.manoDentroAntes = !!manoDentro;

    if (!manoDentro) {
      // Hay que sacar la mano antes de poder volver a activarlo
      this.debeSalir = false;
      this.progreso = Math.max(0, this.progreso - dt * 3);
    } else if (!this.debeSalir && this.enfriamiento === 0) {
      this.progreso += dt / TIEMPO_PULSACION;
      if (manoDentro.gatilloPulsado || this.progreso >= 1) {
        resultado.activado = true;
        this.progreso = 0;
        this.debeSalir = true;
        this.enfriamiento = ENFRIAMIENTO;
      }
    }

    // Aspecto
    const segmentos = Math.floor(Math.min(1, this.progreso) * SEGMENTOS);
    this.anillo.geometry.setDrawRange(0, segmentos * 6);
    this.tapa.material.emissive.setHex(manoDentro ? 0x6a50ff : 0x2a1a70);
    this.tapa.position.z = manoDentro ? 0.008 : 0.02;

    return resultado;
  }
}
