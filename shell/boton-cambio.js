import * as THREE from 'three';

// ─── Ajustes del botón de cambio de juego ───────────────────────────────
// Posición respecto a la cabeza, en metros, en el "cuerpo" del jugador:
// x = derecha, y = arriba, z = detrás (el jugador mira hacia -z).
// Un poco separado del hombro para que la mano que tensa un arco
// (que llega a la mejilla) no lo toque sin querer.
const DESPLAZAMIENTO = new THREE.Vector3(0.32, 0.14, 0.3);
const ESCALA = 2.2;           // tamaño del botón respecto al diseño original
const RADIO_ZONA = 0.3;       // a esta distancia la mano "toca" el botón
const RADIO_AVISO = 0.65;     // desde aquí el mando vibra para guiarte hasta el botón
const RADIO_GUIA = 0.9;       // con la mano a esta distancia aparece la flecha que señala el botón
const TIEMPO_AYUDA = 6;       // segundos que se ve la flecha al empezar cada juego
const DETRAS_GUIA = -0.05;    // la flecha solo sale con la mano a la altura de la cabeza o más atrás
const DETRAS_AVISO = 0.12;    // la guía solo suena con la mano por detrás de la cabeza (no al jugar)
const TIEMPO_PULSACION = 0.5; // segundos con la mano dentro para activarlo
const MARGEN_GIRO = 0.8;      // radianes que puede girar la cabeza sin arrastrar el botón
const ENFRIAMIENTO = 1.5;     // segundos sin poder volver a activarlo
const SEGMENTOS = 48;

const EJE_Y = new THREE.Vector3(0, 1, 0);
const DISTANCIA_GUIA = 0.6;   // la flecha flota a esta distancia delante de los ojos
const RADIO_FLECHA = 0.17;    // y a esta distancia del centro de la vista

// Material para lo que se dibuja encima de todo (flecha guía)
function materialEncima(color) {
  return new THREE.MeshBasicMaterial({
    color, transparent: true, opacity: 0, depthTest: false, depthWrite: false, toneMapped: false, fog: false,
  });
}

// Flecha plana que apunta hacia +X
function geometriaFlecha() {
  const f = new THREE.Shape();
  f.moveTo(0.05, 0);
  f.lineTo(0.005, 0.035);
  f.lineTo(0.005, 0.014);
  f.lineTo(-0.04, 0.014);
  f.lineTo(-0.04, -0.014);
  f.lineTo(0.005, -0.014);
  f.lineTo(0.005, -0.035);
  f.closePath();
  return new THREE.ShapeGeometry(f);
}

function normalizarAngulo(a) {
  while (a > Math.PI) a -= Math.PI * 2;
  while (a < -Math.PI) a += Math.PI * 2;
  return a;
}

// Botón virtual que flota detrás del hombro derecho del jugador.
// Se activa al dejar la mano dentro medio segundo o al apretar el gatillo tocándolo.
// Al acercar la mano, el mando vibra cada vez más rápido ("frío, caliente").
export class BotonCambio {
  constructor(crearPanel, camara) {
    this.grupo = new THREE.Group();
    this.grupo.name = 'boton-cambio';

    // Todo lo visible va en "visual" para poder escalarlo de una vez
    this.visual = new THREE.Group();
    this.visual.scale.setScalar(ESCALA);

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

    this.visual.add(base, this.tapa, this.anillo, this.etiqueta.mesh);

    // Burbuja translúcida que marca la zona activa (más visible al acercarse)
    this.zona = new THREE.Mesh(
      new THREE.SphereGeometry(RADIO_ZONA, 24, 16),
      new THREE.MeshBasicMaterial({ color: 0x8f6bff, transparent: true, opacity: 0.06, depthWrite: false }),
    );

    // Halo que late detrás del botón: se ve de reojo al girar la cabeza
    this.halo = new THREE.Mesh(
      new THREE.RingGeometry(0.11, 0.2, SEGMENTOS, 1),
      new THREE.MeshBasicMaterial({
        color: 0x9d82ff, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
        depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      }),
    );
    this.halo.position.z = -0.01;
    this.visual.add(this.halo);

    this.grupo.add(this.visual, this.zona);
    this.grupo.visible = false;

    // ─── Flecha guía en la vista ───────────────────────────────────────
    // Va pegada a la cámara y señala hacia el botón (detrás del hombro derecho).
    // Se ve unos segundos al empezar cada juego y cuando acercas la mano.
    this.indicador = new THREE.Group();
    this.indicador.position.z = -DISTANCIA_GUIA;
    this.indicador.renderOrder = 998;
    this.flecha = new THREE.Mesh(geometriaFlecha(), materialEncima(0xb9a8ff));
    this.flecha.renderOrder = 998;
    this.guiaTexto = crearPanel({ ancho: 0.17, alto: 0.05, resolucion: 320 });
    this.guiaTexto.escribir([
      { texto: 'SIGUIENTE JUEGO', tam: 1, color: '#b9a8ff' },
      { texto: 'detrás de tu hombro', tam: 0.8 },
    ]);
    const matTexto = this.guiaTexto.mesh.material;
    matTexto.depthTest = false;
    matTexto.opacity = 0;
    this.guiaTexto.mesh.renderOrder = 998;
    this.indicador.add(this.flecha, this.guiaTexto.mesh);
    this.indicador.visible = false;
    camara.add(this.indicador);
    this.camara = camara;
    this.ayuda = TIEMPO_AYUDA;
    this.opacidadGuia = 0;
    this.tiempo = 0;
    this._local = new THREE.Vector3();

    this.yawCuerpo = 0;
    this.progreso = 0;
    this.enfriamiento = 0;
    this.debeSalir = false;
    this.manoDentroAntes = false;
    this.colocado = false;
    this.esperaAviso = 0;
    this._objetivo = new THREE.Vector3();
    this._detras = new THREE.Vector3();
    this._relativa = new THREE.Vector3();
  }

  setSiguiente(titulo) {
    this.ayuda = TIEMPO_AYUDA; // se llama al empezar cada juego: volver a enseñar la flecha
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
    this.ayuda = TIEMPO_AYUDA;
  }

  // Oculta la flecha guía (fuera de VR)
  ocultarGuia() {
    this.indicador.visible = false;
    this.opacidadGuia = 0;
  }

  /**
   * @param {number} dt
   * @param {THREE.Vector3} cabezaPos posición de la cabeza en el mundo
   * @param {THREE.Vector3} cabezaDir dirección en la que mira
   * @param {Array<{posicion: THREE.Vector3, gatilloPulsado: boolean}>} manos manos activas
   * @returns {{activado: boolean, entro: object|null, mano: object|null, aviso: {mano: object, fuerza: number}|null}}
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

    // ¿Qué mano está más cerca? ¿Lo está tocando?
    this.enfriamiento = Math.max(0, this.enfriamiento - dt);
    let masCercana = null;
    let distancia = Infinity;
    for (const m of manos) {
      const d = m.posicion.distanceTo(this.grupo.position);
      if (d < distancia) {
        distancia = d;
        masCercana = m;
      }
    }
    const manoDentro = distancia < RADIO_ZONA ? masCercana : null;
    // 0 lejos, 1 justo en el borde de la zona activa
    const cerca = manoDentro ? 1 : THREE.MathUtils.clamp(1 - (distancia - RADIO_ZONA) / (RADIO_AVISO - RADIO_ZONA), 0, 1);

    const resultado = { activado: false, entro: null, mano: manoDentro, aviso: null };
    if (manoDentro && !this.manoDentroAntes) resultado.entro = manoDentro;
    this.manoDentroAntes = !!manoDentro;

    // Guía por vibración: pulsos cada vez más seguidos al acercarse
    const detras = this._detras.set(0, 0, 1).applyAxisAngle(EJE_Y, this.yawCuerpo);
    const atras = masCercana ? this._relativa.subVectors(masCercana.posicion, cabezaPos).dot(detras) : -Infinity;
    const manoDetras = atras > DETRAS_AVISO;
    this.esperaAviso -= dt;
    if (!manoDentro && cerca > 0 && manoDetras && this.enfriamiento === 0 && this.esperaAviso <= 0) {
      resultado.aviso = { mano: masCercana, fuerza: 0.05 + cerca * 0.2 };
      this.esperaAviso = 0.35 - cerca * 0.25;
    }

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

    // Aspecto: crece un poco y brilla al acercar la mano
    const segmentos = Math.floor(Math.min(1, this.progreso) * SEGMENTOS);
    this.anillo.geometry.setDrawRange(0, segmentos * 6);
    this.tapa.material.emissive.setHex(manoDentro ? 0x6a50ff : 0x2a1a70);
    this.tapa.position.z = manoDentro ? 0.008 : 0.02;
    this.visual.scale.setScalar(ESCALA * (1 + cerca * 0.15));
    this.zona.material.opacity = 0.06 + cerca * 0.14;
    this.tiempo += dt;
    const latido = 0.5 + 0.5 * Math.sin(this.tiempo * 4);
    this.halo.material.opacity = manoDentro ? 0.9 : 0.3 + latido * 0.35;
    this.halo.scale.setScalar(1 + latido * 0.12);

    this.actualizarGuia(dt, atras > DETRAS_GUIA ? distancia : Infinity, manoDentro);

    return resultado;
  }

  actualizarGuia(dt, distancia, manoDentro) {
    this.ayuda = Math.max(0, this.ayuda - dt);
    const cercaGuia = THREE.MathUtils.clamp(1 - (distancia - RADIO_ZONA) / (RADIO_GUIA - RADIO_ZONA), 0, 1);

    // ¿Dónde está el botón respecto a la vista? Si ya se ve, la flecha sobra.
    this.camara.updateMatrixWorld();
    const local = this.camara.worldToLocal(this._local.copy(this.grupo.position));
    const enVista = local.z < 0 && Math.hypot(local.x, local.y) < -local.z * 0.45;

    const objetivo = !enVista && !manoDentro && (this.ayuda > 0 || cercaGuia > 0) ? 1 : 0;
    this.opacidadGuia += (objetivo - this.opacidadGuia) * Math.min(1, dt * 6);
    this.indicador.visible = this.opacidadGuia > 0.02;
    if (!this.indicador.visible) return;

    // Dirección del botón proyectada en la vista (está detrás: casi siempre a la derecha)
    let dx = local.x;
    let dy = local.y;
    const largo = Math.hypot(dx, dy);
    if (largo < 0.05) {
      dx = 1;
      dy = 0.3;
    } else {
      dx /= largo;
      dy /= largo;
    }
    const empuje = Math.sin(this.tiempo * 6) * 0.012; // la flecha "empuja" hacia el botón
    this.flecha.position.set(dx * (RADIO_FLECHA + empuje), dy * (RADIO_FLECHA + empuje), 0);
    this.flecha.rotation.z = Math.atan2(dy, dx);
    this.guiaTexto.mesh.position.set(dx * (RADIO_FLECHA - 0.11), dy * (RADIO_FLECHA - 0.11) - 0.035, 0);
    const o = this.opacidadGuia * (0.75 + 0.25 * Math.sin(this.tiempo * 6));
    this.flecha.material.opacity = o;
    this.guiaTexto.mesh.material.opacity = this.opacidadGuia;
  }
}
