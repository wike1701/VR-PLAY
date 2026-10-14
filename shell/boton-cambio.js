import * as THREE from 'three';
import { t } from '../idiomas/idiomas.js';

// ─── Ajustes del botón de cambio de juego ───────────────────────────────
// Posición respecto a la cabeza, en metros, en el "cuerpo" del jugador:
// x = derecha, y = arriba, z = detrás (el jugador mira hacia -z).
// Es la del botón derecho; el de pausa usa la misma con x en negativo.
// Un poco separado del hombro para que la mano que tensa un arco
// (que llega a la mejilla) no lo toque sin querer.
const DESPLAZAMIENTO = new THREE.Vector3(0.32, 0.14, 0.3);
const ESCALA = 2.2;           // tamaño del botón respecto al diseño original
const RADIO_ZONA = 0.3;       // a esta distancia la mano "toca" el botón
const RADIO_AVISO = 0.65;     // desde aquí el mando vibra para guiarte hasta el botón
const TIEMPO_AYUDA = 6;       // segundos que se ve la flecha al empezar cada juego (solo entonces)
const DETRAS_AVISO = 0.12;    // la guía solo suena con la mano por detrás de la cabeza (no al jugar)
const TIEMPO_CARGA = 1;       // segundos exactos con la mano dentro (con la rueda de carga) para activarlo
const MARGEN_GIRO = 0.8;      // radianes que puede girar la cabeza sin arrastrar el botón
const ENFRIAMIENTO = 1.5;     // segundos sin poder volver a activarlo
const SEGMENTOS = 48;

const EJE_Y = new THREE.Vector3(0, 1, 0);
const DISTANCIA_GUIA = 0.6;   // la flecha flota a esta distancia delante de los ojos
const RADIO_FLECHA = 0.17;    // y a esta distancia del centro de la vista
const DISTANCIA_RUEDA = 0.55; // la rueda de carga, delante de los ojos y un poco por debajo
const PUNTOS_RUEDA = 10;

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

// Aspecto de cada botón: el de cambio de juego (hombro derecho) y el de pausa
// (hombro izquierdo) funcionan igual, solo cambian el lado, el icono y el color.
const ESTILOS = {
  siguiente: {
    lado: 1, nombre: 'boton-cambio', tapa: 0x7c5cff, brillo: 0x2a1a70, brilloEncima: 0x6a50ff,
    halo: 0x9d82ff, zona: 0x8f6bff, guia: 0xb9a8ff, textoGuia: '#b9a8ff', tituloGuia: 'jugar.vr.siguienteJuego',
  },
  pausa: {
    lado: -1, nombre: 'boton-pausa', tapa: 0x00a896, brillo: 0x003d36, brilloEncima: 0x00bfa5,
    halo: 0x4dd0c4, zona: 0x26c6b5, guia: 0x80e8dc, textoGuia: '#80e8dc', tituloGuia: 'jugar.vr.pausaYMenu',
  },
};

// Botón virtual que flota detrás de un hombro del jugador (el derecho para cambiar
// de juego, el izquierdo para pausar). Solo responde a la mano de ese lado.
// Se activa al dejar la mano dentro exactamente un segundo: mientras tanto, delante de
// los ojos gira una rueda de carga que se completa (el botón está detrás y no se ve).
// Al acercar la mano, el mando vibra cada vez más rápido ("frío, caliente").
export class BotonCambio {
  constructor(crearPanel, camara, tipo = 'siguiente') {
    const estilo = ESTILOS[tipo];
    this.estilo = estilo;
    this.lado = estilo.lado;
    this.desplazamiento = DESPLAZAMIENTO.clone();
    this.desplazamiento.x *= estilo.lado;
    this.grupo = new THREE.Group();
    this.grupo.name = estilo.nombre;

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
      new THREE.MeshLambertMaterial({ color: estilo.tapa, emissive: estilo.brillo }),
    );
    this.tapa.rotation.x = Math.PI / 2;
    this.tapa.position.z = 0.02;

    // Icono dibujado sobre la tapa: flecha "siguiente" o las dos barras de pausa.
    // La tapa está girada: su eje +Y local apunta hacia el jugador.
    const blanco = new THREE.MeshBasicMaterial({ color: 0xffffff });
    const iconos = tipo === 'pausa'
      ? [-1, 1].map((s) => {
        const barra = new THREE.Mesh(new THREE.PlaneGeometry(0.018, 0.055), blanco);
        barra.position.x = s * 0.017;
        return barra;
      })
      : [new THREE.Mesh(new THREE.CircleGeometry(0.035, 3), blanco)];
    for (const icono of iconos) {
      icono.rotation.x = -Math.PI / 2;
      icono.position.y = 0.016;
      this.tapa.add(icono);
    }

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
      new THREE.MeshBasicMaterial({ color: estilo.zona, transparent: true, opacity: 0.06, depthWrite: false }),
    );

    // Halo que late detrás del botón: se ve de reojo al girar la cabeza
    this.halo = new THREE.Mesh(
      new THREE.RingGeometry(0.11, 0.2, SEGMENTOS, 1),
      new THREE.MeshBasicMaterial({
        color: estilo.halo, transparent: true, opacity: 0.5, side: THREE.DoubleSide,
        depthWrite: false, blending: THREE.AdditiveBlending, toneMapped: false,
      }),
    );
    this.halo.position.z = -0.01;
    this.visual.add(this.halo);

    this.grupo.add(this.visual, this.zona);
    this.grupo.visible = false;

    // ─── Flecha guía en la vista ───────────────────────────────────────
    // Va pegada a la cámara y señala hacia el botón (detrás del hombro derecho).
    // Solo se ve unos segundos al empezar cada juego (si saliera al acercar la mano,
    // aparecería a cada rato mientras juegas).
    this.indicador = new THREE.Group();
    this.indicador.position.z = -DISTANCIA_GUIA;
    this.indicador.renderOrder = 998;
    this.flecha = new THREE.Mesh(geometriaFlecha(), materialEncima(estilo.guia));
    this.flecha.renderOrder = 998;
    this.guiaTexto = crearPanel({ ancho: 0.17, alto: 0.05, resolucion: 320 });
    this.guiaTexto.escribir([
      { texto: t(estilo.tituloGuia), tam: 1, color: estilo.textoGuia },
      { texto: t('jugar.vr.detrasHombro'), tam: 0.8 },
    ]);
    const matTexto = this.guiaTexto.mesh.material;
    matTexto.depthTest = false;
    matTexto.opacity = 0;
    this.guiaTexto.mesh.renderOrder = 998;
    this.indicador.add(this.flecha, this.guiaTexto.mesh);
    this.indicador.visible = false;
    camara.add(this.indicador);

    // ─── Rueda de carga en la vista ────────────────────────────────────
    // Puntos que giran (la típica rueda de carga), un arco que se completa en
    // TIEMPO_CARGA y el nombre de la acción debajo.
    this.rueda = new THREE.Group();
    this.rueda.position.set(0, -0.04, -DISTANCIA_RUEDA);
    this.rueda.scale.setScalar(1.4); // en las gafas el campo de visión es más amplio: un poco más grande
    this.rueda.visible = false;
    this.puntosRueda = new THREE.Group();
    const geoPunto = new THREE.CircleGeometry(0.0048, 12);
    for (let i = 0; i < PUNTOS_RUEDA; i++) {
      const a = (i / PUNTOS_RUEDA) * Math.PI * 2;
      const punto = new THREE.Mesh(geoPunto, materialEncima(0xffffff));
      punto.position.set(Math.sin(a) * 0.036, Math.cos(a) * 0.036, 0);
      punto.userData.cola = i / PUNTOS_RUEDA; // los de atrás, más apagados
      this.puntosRueda.add(punto);
    }
    this.fondoRueda = new THREE.Mesh(new THREE.RingGeometry(0.019, 0.025, SEGMENTOS, 1), materialEncima(0xffffff));
    // Arco de progreso: empieza arriba y avanza en el sentido de las agujas del reloj
    this.arcoRueda = new THREE.Mesh(new THREE.RingGeometry(0.019, 0.025, SEGMENTOS, 1, Math.PI / 2, Math.PI * 2), materialEncima(estilo.guia));
    this.arcoRueda.scale.x = -1;
    this.arcoRueda.material.side = THREE.DoubleSide; // al voltearlo se ve por detrás
    this.arcoRueda.geometry.setDrawRange(0, 0);
    this.textoRueda = crearPanel({ ancho: 0.16, alto: 0.04, resolucion: 320 });
    this.textoRueda.escribir([{ texto: t(estilo.tituloGuia), tam: 1, color: estilo.textoGuia }]);
    this.textoRueda.mesh.material.depthTest = false;
    this.textoRueda.mesh.position.y = -0.065;
    for (const o of [this.fondoRueda, this.arcoRueda, this.textoRueda.mesh, ...this.puntosRueda.children]) o.renderOrder = 999;
    this.rueda.add(this.puntosRueda, this.fondoRueda, this.arcoRueda, this.textoRueda.mesh);
    camara.add(this.rueda);
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
      { texto: t('jugar.vr.siguienteJuego'), tam: 0.8, color: '#b9a8ff' },
      { texto: titulo, tam: 1.2 },
    ]);
  }

  // Texto fijo encima del botón (el de pausa). Se llama al empezar cada juego.
  setEtiqueta(lineas) {
    this.ayuda = TIEMPO_AYUDA;
    this.etiqueta.escribir(lineas);
  }

  // Al entrar en VR: recalcular la orientación del cuerpo desde cero.
  reiniciar() {
    this.colocado = false;
    this.progreso = 0;
    this.debeSalir = false;
    this.ayuda = TIEMPO_AYUDA;
  }

  // Oculta la flecha guía y la rueda de carga (fuera de VR o en pausa)
  ocultarGuia() {
    this.indicador.visible = false;
    this.opacidadGuia = 0;
    this.rueda.visible = false;
    this.progreso = 0;
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

    this._objetivo.copy(this.desplazamiento).applyAxisAngle(EJE_Y, this.yawCuerpo).add(cabezaPos);
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
      // Hay que sacar la mano antes de poder volver a activarlo; al sacarla, la carga
      // vuelve a cero (así siempre dura exactamente TIEMPO_CARGA)
      this.debeSalir = false;
      this.progreso = 0;
    } else if (!this.debeSalir && this.enfriamiento === 0) {
      this.progreso += dt / TIEMPO_CARGA;
      if (this.progreso >= 1) {
        resultado.activado = true;
        this.progreso = 0;
        this.debeSalir = true;
        this.enfriamiento = ENFRIAMIENTO;
      }
    }
    this.actualizarRueda(dt);

    // Aspecto: crece un poco y brilla al acercar la mano
    const segmentos = Math.floor(Math.min(1, this.progreso) * SEGMENTOS);
    this.anillo.geometry.setDrawRange(0, segmentos * 6);
    this.tapa.material.emissive.setHex(manoDentro ? this.estilo.brilloEncima : this.estilo.brillo);
    this.tapa.position.z = manoDentro ? 0.008 : 0.02;
    this.visual.scale.setScalar(ESCALA * (1 + cerca * 0.15));
    this.zona.material.opacity = 0.06 + cerca * 0.14;
    this.tiempo += dt;
    const latido = 0.5 + 0.5 * Math.sin(this.tiempo * 4);
    this.halo.material.opacity = manoDentro ? 0.9 : 0.3 + latido * 0.35;
    this.halo.scale.setScalar(1 + latido * 0.12);

    this.actualizarGuia(dt, manoDentro);

    return resultado;
  }

  // La rueda se ve solo mientras carga: puntos girando y el arco que se completa
  actualizarRueda() {
    const cargando = this.progreso > 0;
    this.rueda.visible = cargando;
    if (!cargando) return;
    this.puntosRueda.rotation.z = -this.tiempo * Math.PI * 2; // una vuelta por segundo
    for (const punto of this.puntosRueda.children) punto.material.opacity = 0.15 + 0.85 * (1 - punto.userData.cola);
    this.fondoRueda.material.opacity = 0.18;
    this.arcoRueda.material.opacity = 1;
    this.arcoRueda.geometry.setDrawRange(0, Math.floor(Math.min(1, this.progreso) * SEGMENTOS) * 6);
  }

  actualizarGuia(dt, manoDentro) {
    this.ayuda = Math.max(0, this.ayuda - dt);

    // ¿Dónde está el botón respecto a la vista? Si ya se ve, la flecha sobra.
    this.camara.updateMatrixWorld();
    const local = this.camara.worldToLocal(this._local.copy(this.grupo.position));
    const enVista = local.z < 0 && Math.hypot(local.x, local.y) < -local.z * 0.45;

    const objetivo = !enVista && !manoDentro && this.ayuda > 0 ? 1 : 0;
    this.opacidadGuia += (objetivo - this.opacidadGuia) * Math.min(1, dt * 6);
    this.indicador.visible = this.opacidadGuia > 0.02;
    if (!this.indicador.visible) return;

    // Dirección del botón proyectada en la vista (está detrás: casi siempre a la derecha)
    let dx = local.x;
    let dy = local.y;
    const largo = Math.hypot(dx, dy);
    if (largo < 0.05) {
      dx = this.lado;
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
