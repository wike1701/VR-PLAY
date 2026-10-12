// ─────────────────────────────────────────────────────────────────────────
// SHELL DE VR PLAY
// Crea el renderizador y la sesión VR UNA sola vez. Los juegos son módulos
// que se montan y desmontan dentro de la misma escena, así que cambiar de
// juego nunca cierra la sesión VR.
//
// Contrato de cada juego (juegos/<id>/juego.js):
//   export async function precargar()   -> opcional: descarga recursos sin crear nada en la escena
//   export function iniciar(ctx)        -> monta el juego y devuelve { actualizar(dt, t), liberar() }
// ─────────────────────────────────────────────────────────────────────────
import * as THREE from 'three';
import { t } from '../idiomas/idiomas.js';
import { JUEGOS } from '../juegos/catalogo.js';
import { juegosEnPruebas } from '../juegos/en-pruebas.js';
import { BotonCambio } from './boton-cambio.js';
import { MenuPausa } from './menu-pausa.js';
import { esFavorito, alternarFavorito, leGusta, alternarMeGusta, totalesMeGusta } from './valoraciones.js';
import { crearPanel, liberarObjeto, liberarRecurso } from './utilidades.js';
import { activarAudio, sonido, sonidoContinuo } from './sonido.js';
import { iniciarPantallaCompleta } from './pantalla-completa.js';
import {
  crearCielo, coloresCielo, crearGeneradorEntorno, configurarTexturas,
  texturas, texturaCanvas, crearSombra, colocarSombra,
} from './graficos.js';

const COLOR_FONDO = 0x141826;
const FOV_ESCRITORIO = 70;
// Pantalla vertical (móvil): se abre el campo de visión vertical hasta FOV_MAX_VERTICAL
// para acercarse a este campo horizontal, y lo que falte se compensa alejando la cámara.
const FOV_HORIZONTAL_MIN = 80;
const FOV_MAX_VERTICAL = 100;
const RETROCESO_MAX = 0;    // alejar la cámara (proporción de la distancia al objetivo); 0 = solo abrir el campo de visión
// Pantalla táctil sin ratón: cambia los textos de ayuda ("toca" en vez de "haz clic")
const TACTIL = window.matchMedia('(pointer: coarse)').matches;
const VISTA_POR_DEFECTO = {
  posicion: new THREE.Vector3(0, 1.6, 0.4),
  objetivo: new THREE.Vector3(0, 1.3, -2),
};

// ─── Renderizador y escena base ──────────────────────────────────────────
const renderer = new THREE.WebGLRenderer({ antialias: true });
renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
renderer.setSize(window.innerWidth, window.innerHeight);
renderer.xr.enabled = true;
renderer.xr.setReferenceSpaceType('local-floor');
renderer.xr.setFoveation(1);
// Tone mapping: luces y brillos más naturales, sin colores "quemados". Coste nulo
// (se hace en el mismo sombreador de cada material, sin pasadas extra).
renderer.toneMapping = THREE.ACESFilmicToneMapping;
renderer.toneMappingExposure = 1.15;
document.getElementById('escena').appendChild(renderer.domElement);
configurarTexturas(renderer);

const escena = new THREE.Scene();
escena.fog = new THREE.Fog(COLOR_FONDO, 7, 16);

// Cielo con degradado y mapa de entorno a juego (para los reflejos)
const cielo = crearCielo();
escena.add(cielo.mesh);
const entorno = crearGeneradorEntorno(renderer);

const camara = new THREE.PerspectiveCamera(FOV_ESCRITORIO, window.innerWidth / window.innerHeight, 0.05, 100);
escena.add(camara);

const hemisferio = new THREE.HemisphereLight(0xdfe6ff, 0x30304a, 1.6);
escena.add(hemisferio);
const sol = new THREE.DirectionalLight(0xfff4e5, 1.8);
sol.position.set(2, 5, 2);
escena.add(sol);

// Cambia el cielo, la niebla y el color de las luces para que todo case.
function aplicarFondo(color, opciones = {}) {
  const colores = { ...coloresCielo(color), ...opciones };
  cielo.aplicar(colores);
  escena.fog.color.set(colores.horizonte);
  hemisferio.color.set(colores.dia ? 0xe6f0ff : 0xc8ccff).lerp(new THREE.Color(colores.cenit), 0.25);
  hemisferio.groundColor.set(colores.suelo).multiplyScalar(colores.dia ? 1 : 1.6);
  escena.environment = entorno.generar(colores);
}
aplicarFondo(COLOR_FONDO);

const suelo = new THREE.Mesh(
  new THREE.CircleGeometry(8, 48),
  new THREE.MeshLambertMaterial({ color: 0x252a3d }),
);
suelo.rotation.x = -Math.PI / 2;
escena.add(suelo);
const rejilla = new THREE.GridHelper(16, 32, 0x3b4266, 0x2e3450);
rejilla.position.y = 0.002;
escena.add(rejilla);

const vista = {
  posicion: VISTA_POR_DEFECTO.posicion.clone(),
  objetivo: VISTA_POR_DEFECTO.objetivo.clone(),
};
const direccionVista = new THREE.Vector3();
let retroceso = 0; // proporción de la distancia al objetivo que se aleja la cámara en vertical

function ajustarCampoVision() {
  const aspecto = window.innerWidth / window.innerHeight;
  const tanH = Math.tan(THREE.MathUtils.degToRad(FOV_HORIZONTAL_MIN / 2));
  let fov = FOV_ESCRITORIO;
  retroceso = 0;
  if (aspecto < 1) {
    // Campo vertical necesario para ver FOV_HORIZONTAL_MIN de ancho, con un tope
    const necesario = THREE.MathUtils.radToDeg(2 * Math.atan(tanH / aspecto));
    fov = THREE.MathUtils.clamp(necesario, FOV_ESCRITORIO, FOV_MAX_VERTICAL);
    const tanReal = Math.tan(THREE.MathUtils.degToRad(fov / 2)) * aspecto;
    retroceso = Math.min(RETROCESO_MAX, tanH / tanReal - 1);
  }
  camara.fov = fov;
  camara.zoom = 1;
  camara.aspect = aspecto;
  camara.updateProjectionMatrix();
}

function aplicarVista() {
  if (renderer.xr.isPresenting) return;
  // En vertical la cámara se aleja hacia atrás para que quepa lo importante a lo ancho
  direccionVista.subVectors(vista.objetivo, vista.posicion);
  camara.position.copy(vista.posicion).addScaledVector(direccionVista, -retroceso);
  camara.lookAt(vista.objetivo);
}
ajustarCampoVision();
aplicarVista();

// ─── Fundido a negro (y destellos de color) ──────────────────────────────
const materialFundido = new THREE.MeshBasicMaterial({
  color: 0x000000, transparent: true, opacity: 1,
  side: THREE.BackSide, depthTest: false, depthWrite: false, fog: false,
});
const esferaFundido = new THREE.Mesh(new THREE.SphereGeometry(0.4, 16, 12), materialFundido);
esferaFundido.renderOrder = 999;
camara.add(esferaFundido);

const panelCarga = crearPanel({ ancho: 0.32, alto: 0.08, resolucion: 384 });
panelCarga.mesh.position.set(0, 0, -0.3);
panelCarga.mesh.material.depthTest = false;
panelCarga.mesh.renderOrder = 1000;
panelCarga.mesh.visible = false;
camara.add(panelCarga.mesh);

const fundido = {
  opacidad: 1,
  objetivo: 1,
  velocidad: 3,
  resolver: null,
  a(objetivo, duracion = 0.3) {
    this.resolver?.();
    materialFundido.color.setHex(0x000000);
    this.objetivo = objetivo;
    this.velocidad = 1 / Math.max(duracion, 0.01);
    return new Promise((resolve) => { this.resolver = resolve; });
  },
  destello(color, fuerza = 0.5) {
    if (this.resolver) return; // no interferir con un cambio de juego
    materialFundido.color.setHex(color);
    this.opacidad = fuerza;
    this.objetivo = 0;
    this.velocidad = 1.5;
  },
  actualizar(dt) {
    const paso = this.velocidad * dt;
    if (Math.abs(this.objetivo - this.opacidad) <= paso) {
      this.opacidad = this.objetivo;
      if (this.resolver) {
        const r = this.resolver;
        this.resolver = null;
        r();
      }
    } else {
      this.opacidad += Math.sign(this.objetivo - this.opacidad) * paso;
    }
    materialFundido.opacity = this.opacidad;
    esferaFundido.visible = this.opacidad > 0.001;
  },
};

// ─── Mandos VR ───────────────────────────────────────────────────────────
const manos = [0, 1].map((indice) => {
  const grip = renderer.xr.getControllerGrip(indice);
  escena.add(grip);
  const mano = {
    indice, grip,
    fuente: null, lado: null, conectado: false, activa: false,
    gatillo: false, gatilloPulsado: false, apreton: false,
    posicion: new THREE.Vector3(),
  };
  grip.addEventListener('connected', (e) => {
    mano.fuente = e.data;
    mano.lado = e.data.handedness;
    mano.conectado = !!e.data.gamepad;
  });
  grip.addEventListener('disconnected', () => {
    mano.fuente = null;
    mano.conectado = false;
  });
  return mano;
});

function actualizarManos() {
  const enVR = renderer.xr.isPresenting;
  for (const m of manos) {
    const botones = m.fuente?.gamepad?.buttons;
    const antes = m.gatillo;
    m.gatillo = !!botones?.[0]?.pressed;
    m.apreton = !!botones?.[1]?.pressed;
    m.gatilloPulsado = m.gatillo && !antes;
    m.activa = enVR && m.conectado && m.grip.visible;
    m.grip.getWorldPosition(m.posicion);
  }
}

function vibrar(mano, intensidad = 0.5, ms = 50) {
  try {
    mano?.fuente?.gamepad?.hapticActuators?.[0]?.pulse(intensidad, ms);
  } catch (e) { /* algunos mandos no vibran */ }
}

// ─── Ratón / táctil (modo escritorio) ────────────────────────────────────
const lienzo = renderer.domElement;
const raton = {
  ndc: new THREE.Vector2(),
  ndcAnterior: new THREE.Vector2(),
  rayo: new THREE.Raycaster(),
  mov: new THREE.Vector2(),
  velocidadPx: 0,
  clic: false,
  pulsado: false,
  dentro: false,
};
let movX = 0;
let movY = 0;
let ultimoX = null;
let ultimoY = null;
let clicPendiente = false;

function posicionRaton(e) {
  raton.ndc.set((e.clientX / window.innerWidth) * 2 - 1, -(e.clientY / window.innerHeight) * 2 + 1);
  if (ultimoX !== null) {
    movX += e.clientX - ultimoX;
    movY += e.clientY - ultimoY;
  }
  ultimoX = e.clientX;
  ultimoY = e.clientY;
  raton.dentro = true;
}
lienzo.addEventListener('pointermove', posicionRaton);
lienzo.addEventListener('pointerdown', (e) => {
  activarAudio();
  // Con el dedo no hay movimiento entre un toque y el siguiente: no contar el salto
  if (e.pointerType !== 'mouse') ultimoX = ultimoY = null;
  posicionRaton(e);
  clicPendiente = true;
  raton.pulsado = true;
});
window.addEventListener('pointerup', () => { raton.pulsado = false; });
lienzo.addEventListener('pointerleave', (e) => {
  // Al levantar el dedo el puntero "sale", pero el bate, los guantes... deben seguir visibles
  if (e.pointerType === 'mouse') raton.dentro = false;
  ultimoX = ultimoY = null;
});

function actualizarRaton(dt) {
  raton.mov.set(movX, movY);
  raton.velocidadPx = Math.hypot(movX, movY) / Math.max(dt, 1e-3);
  movX = movY = 0;
  raton.clic = clicPendiente;
  clicPendiente = false;
  raton.rayo.setFromCamera(raton.ndc, camara);
}
function guardarRatonAnterior() {
  raton.ndcAnterior.copy(raton.ndc);
}

// ─── Carga, montaje y desmontaje de juegos ───────────────────────────────
const modulos = new Map(); // índice -> Promise<módulo>
let actual = null;         // { indice, instancia, raiz, adjuntos, recursos }
// El juego inicial llega en la URL: play.html#topos (o play.html?juego=topos)
const idInicial = location.hash.slice(1) || new URLSearchParams(location.search).get('juego');
let indiceActual = Math.max(0, JUEGOS.findIndex((j) => j.id === idInicial));
let cambiando = false;
let errorJuego = false;

// ─── Orden aleatorio sin repetir ─────────────────────────────────────────
// Cada vuelta pasa por todos los juegos en orden aleatorio. Cuando se acaban,
// se baraja una vuelta nueva (sin empezar por el juego que acabas de jugar).
// La primera vuelta incluye el juego inicial, así que solo baraja los demás.
let cola = barajar(JUEGOS.map((_, i) => i).filter((i) => i !== indiceActual));

// Los juegos en pruebas no entran en la rotación (sí se pueden abrir con su
// enlace). La lista llega del servidor al poco de arrancar.
let enPruebas = new Set();
juegosEnPruebas().then((ids) => {
  enPruebas = ids;
  if (!ids.size) return;
  cola = cola.filter((i) => !ids.has(JUEGOS[i].id));
  if (actual && !cambiando) anunciarSiguiente();
});
const indicesPublicos = () => {
  const lista = JUEGOS.map((_, i) => i).filter((i) => !enPruebas.has(JUEGOS[i].id));
  return lista.length ? lista : JUEGOS.map((_, i) => i);
};

function barajar(lista) {
  for (let i = lista.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [lista[i], lista[j]] = [lista[j], lista[i]];
  }
  return lista;
}

// Devuelve el próximo juego sin sacarlo de la cola (para precargarlo y anunciarlo).
function siguienteIndice() {
  if (cola.length === 0) {
    cola = barajar(indicesPublicos());
    if (cola.length > 1 && cola[0] === indiceActual) cola.push(cola.shift());
  }
  return cola[0];
}

// Descarga el módulo (y sus recursos) sin montarlo en la escena.
function precargar(indice) {
  if (!modulos.has(indice)) {
    const url = new URL('../' + JUEGOS[indice].modulo, import.meta.url).href;
    const promesa = import(url).then(async (modulo) => {
      if (modulo.precargar) await modulo.precargar();
      return modulo;
    });
    promesa.catch(() => modulos.delete(indice)); // permitir reintentarlo
    modulos.set(indice, promesa);
  }
  return modulos.get(indice);
}

function montar(indice, modulo) {
  const raiz = new THREE.Group();
  raiz.name = 'juego-' + JUEGOS[indice].id;
  escena.add(raiz);
  const adjuntos = [];
  const recursos = [];
  const continuos = []; // sonidos continuos (motores...) que hay que parar al salir
  const prefijo = `vrplay:${JUEGOS[indice].id}:`;
  const espacio = `juegos.${JUEGOS[indice].id}.juego.`;

  // Todo lo que un juego necesita de la shell pasa por aquí.
  const ctx = {
    raiz, escena, camara, renderer, manos, raton,
    enVR: () => renderer.xr.isPresenting,
    tactil: TACTIL, // pantalla táctil (móvil o tableta): para los textos de ayuda
    // Textos en el idioma del jugador (idiomas/<código>.js): ctx.t('fin', { n: puntos }) busca
    // juegos.<id>.juego.fin; las claves 'partida.…' son las compartidas por todos los juegos.
    t: (clave, vars) => t(clave.startsWith('partida.') ? clave : espacio + clave, vars),
    // Para objetos que van en la mano (espadas, martillos...). Se retiran al cambiar de juego.
    adjuntarAMano(mano, objeto) {
      mano.grip.add(objeto);
      adjuntos.push(objeto);
      return objeto;
    },
    // Registra geometrías, materiales o texturas compartidas para liberarlas al salir.
    recurso(r) {
      recursos.push(r);
      return r;
    },
    crearPanel,
    sonido,
    // Sonido que dura (por ejemplo 'motor'): devuelve { ajustar(valor 0-1, volumen), parar() }.
    // La shell lo para sola al cambiar de juego.
    sonidoContinuo(nombre) {
      const s = sonidoContinuo(nombre);
      continuos.push(s);
      return s;
    },
    vibrar,
    destello: (color, fuerza) => fundido.destello(color, fuerza),
    // Cielo con degradado a partir de un color. opciones: { cenit, horizonte, suelo, dia }
    fondo(color, opciones) {
      aplicarFondo(color, opciones);
    },
    // Kit gráfico: texturas procedurales y sombras de mancha (ver shell/graficos.js).
    // Las texturas que crea un juego hay que registrarlas con ctx.recurso().
    texturas,
    texturaCanvas,
    // Oculta el suelo y la rejilla de la shell cuando el juego trae su propio suelo.
    sueloBase(visible) {
      suelo.visible = rejilla.visible = visible;
    },
    crearSombra,
    colocarSombra,
    vistaEscritorio(posicion, objetivo) {
      vista.posicion.copy(posicion);
      vista.objetivo.copy(objetivo);
      aplicarVista();
    },
    guardar(clave, valor) {
      try { localStorage.setItem(prefijo + clave, JSON.stringify(valor)); } catch (e) { /* sin almacenamiento */ }
    },
    leer(clave, porDefecto) {
      try {
        const v = localStorage.getItem(prefijo + clave);
        return v === null ? porDefecto : JSON.parse(v);
      } catch (e) {
        return porDefecto;
      }
    },
  };

  const instancia = modulo.iniciar(ctx);
  actual = { indice, instancia, raiz, adjuntos, recursos, continuos };
  errorJuego = false;
}

function desmontar() {
  if (!actual) return;
  try {
    actual.instancia?.liberar?.();
  } catch (e) {
    console.error('Error al liberar el juego', e);
  }
  for (const objeto of actual.adjuntos) {
    objeto.removeFromParent();
    liberarObjeto(objeto);
  }
  actual.raiz.removeFromParent();
  liberarObjeto(actual.raiz);
  for (const r of actual.recursos) liberarRecurso(r);
  for (const s of actual.continuos) s.parar();
  actual = null;

  // Volver al estado base de la shell
  aplicarFondo(COLOR_FONDO);
  suelo.visible = rejilla.visible = true;
  vista.posicion.copy(VISTA_POR_DEFECTO.posicion);
  vista.objetivo.copy(VISTA_POR_DEFECTO.objetivo);
}

async function cambiarA(indice) {
  if (cambiando) return;
  cambiando = true;
  ocultarAviso();
  reanudar();
  try {
    if (actual) await fundido.a(1, 0.3);
    desmontar();
    indiceActual = indice;
    cola = cola.filter((i) => i !== indice); // ya jugado en esta vuelta
    actualizarInterfaz();

    // Si el juego ya estaba precargado esto es inmediato; si no, mostramos "Cargando…"
    const temporizador = setTimeout(() => {
      panelCarga.escribir([t('jugar.cargandoJuego', { juego: JUEGOS[indice].titulo })]);
      panelCarga.mesh.visible = true;
      $carga.hidden = false;
    }, 120);
    let modulo;
    try {
      modulo = await precargar(indice);
    } finally {
      clearTimeout(temporizador);
      panelCarga.mesh.visible = false;
      $carga.hidden = true;
    }

    montar(indice, modulo);
    history.replaceState(null, '', `#${JUEGOS[indice].id}`);
    aplicarVista();
  } catch (e) {
    console.error(`No se pudo cargar "${JUEGOS[indice].titulo}"`, e);
    desmontar();
    mostrarAviso([
      { texto: t('jugar.errorCarga'), color: '#ff8a80' },
      { texto: t('jugar.errorCargaAyuda'), tam: 0.7 },
    ], 6);
  }
  await fundido.a(0, 0.35);
  cambiando = false;
  anunciarSiguiente();
}

// Precarga en segundo plano el siguiente juego para que el cambio sea instantáneo
function anunciarSiguiente() {
  const siguiente = siguienteIndice();
  boton.setSiguiente(JUEGOS[siguiente].titulo);
  botonPausa.ayuda = boton.ayuda; // las dos flechas guía salen al empezar cada juego
  actualizarInterfaz();
  if (!actual) $titulo.textContent = t('jugar.tituloSinCargar', { juego: JUEGOS[indiceActual].titulo });
  precargar(siguiente).then(
    () => { if (siguiente === siguienteIndice()) $estado.textContent = t('jugar.siguienteListo', { juego: JUEGOS[siguiente].titulo }); },
    () => { $estado.textContent = t('jugar.siguienteError', { juego: JUEGOS[siguiente].titulo }); },
  );
}

function siguienteJuego() {
  if (cambiando) return;
  sonido('boton');
  cambiarA(siguienteIndice());
}

// ─── Botón de cambio detrás del hombro derecho ───────────────────────────
const boton = new BotonCambio(crearPanel, camara);
escena.add(boton.grupo);
// Su gemelo detrás del hombro izquierdo: pausa y menú
const botonPausa = new BotonCambio(crearPanel, camara, 'pausa');
botonPausa.setEtiqueta([{ texto: t('jugar.vr.pausa'), tam: 1.2, color: '#80e8dc' }, { texto: t('jugar.vr.yMenu'), tam: 0.8 }]);
escena.add(botonPausa.grupo);
// Cada botón responde solo a la mano de su lado (si aún no se sabe, el mando 0 es el izquierdo)
const esIzquierda = (m) => (m.lado ? m.lado === 'left' : m.indice === 0);
const cabezaPos = new THREE.Vector3();
const cabezaDir = new THREE.Vector3();

// ─── Aviso flotante en VR ────────────────────────────────────────────────
const aviso = crearPanel({ ancho: 1.2, alto: 0.36 });
aviso.mesh.visible = false;
escena.add(aviso.mesh);
let tiempoAviso = 0;
let colocarAviso = false;

function mostrarAviso(lineas, segundos) {
  aviso.escribir(lineas);
  tiempoAviso = segundos;
  colocarAviso = true;
}
function ocultarAviso() {
  tiempoAviso = 0;
}
function actualizarAviso(dt) {
  if (tiempoAviso <= 0 || !renderer.xr.isPresenting) {
    aviso.mesh.visible = false;
    return;
  }
  tiempoAviso -= dt;
  if (colocarAviso) {
    // Delante de la cabeza, a 1,3 m
    const delante = cabezaDir.clone().setY(0).normalize().multiplyScalar(1.3);
    aviso.mesh.position.copy(cabezaPos).add(delante);
    aviso.mesh.position.y = cabezaPos.y - 0.05;
    aviso.mesh.lookAt(cabezaPos);
    colocarAviso = false;
  }
  aviso.mesh.visible = true;
}

// ─── Pausa: me gusta, favoritos y volver al catálogo ─────────────────────
// En VR se abre con el botón de pausa detrás del hombro izquierdo (menú flotante);
// con ratón o en el móvil, con el botón ⏸ o la tecla Esc (menú HTML). El juego
// no recibe actualizar() mientras está en pausa, así que se queda congelado.
const menuPausa = new MenuPausa(crearPanel, renderer, escena);
const $pausa = document.getElementById('pausa');
const $pausaTitulo = document.getElementById('pausa-titulo');
const $pausaMeGusta = $pausa.querySelector('[data-accion="megusta"]');
const $pausaFavorito = $pausa.querySelector('[data-accion="favorito"]');
let pausado = false;
let totalMeGusta = null;

function textosPausa() {
  const juego = JUEGOS[indiceActual];
  const datos = { titulo: juego.titulo, meGusta: leGusta(juego.id), total: totalMeGusta, favorito: esFavorito(juego.id) };
  menuPausa.escribir(datos);
  $pausaTitulo.textContent = datos.titulo;
  $pausaMeGusta.textContent = `${datos.meGusta ? `♥ ${t('pausa.teGusta')}` : `♡ ${t('pausa.meGusta')}`}${datos.total ? ` · ${datos.total}` : ''}`;
  $pausaMeGusta.classList.toggle('activo-megusta', datos.meGusta);
  $pausaFavorito.textContent = datos.favorito ? `★ ${t('pausa.enFavoritos')}` : `☆ ${t('pausa.guardarFavorito')}`;
  $pausaFavorito.classList.toggle('activo-favorito', datos.favorito);
}

function pausar() {
  if (pausado || cambiando || !actual) return;
  pausado = true;
  for (const s of actual.continuos) s.ajustar(0, 0); // silencia motores mientras tanto
  const id = JUEGOS[indiceActual].id;
  totalMeGusta = null;
  textosPausa();
  totalesMeGusta().then((totales) => {
    if (pausado && JUEGOS[indiceActual].id === id) {
      totalMeGusta = totales[id] ?? null;
      textosPausa();
    }
  });
  if (renderer.xr.isPresenting) menuPausa.abrir(cabezaPos, cabezaDir);
  else $pausa.hidden = false;
  sonido('tic');
}

function reanudar() {
  if (!pausado) return;
  pausado = false;
  menuPausa.cerrar();
  $pausa.hidden = true;
}

async function accionPausa(accion) {
  const id = JUEGOS[indiceActual].id;
  if (accion === 'continuar') {
    sonido('boton');
    reanudar();
  } else if (accion === 'megusta') {
    const r = await alternarMeGusta(id);
    if (r.total !== null) totalMeGusta = r.total;
    sonido(r.meGusta ? 'punto' : 'tic');
    textosPausa();
  } else if (accion === 'favorito') {
    sonido(alternarFavorito(id) ? 'punto' : 'tic');
    textosPausa();
  } else if (accion === 'catalogo') {
    sonido('boton');
    const sesion = renderer.xr.getSession();
    if (sesion) sesion.end().catch(() => {}).finally(() => { location.href = 'index.html'; });
    else location.href = 'index.html';
  }
}

$pausa.addEventListener('click', (e) => {
  const accion = e.target.closest('[data-accion]')?.dataset.accion;
  if (accion) accionPausa(accion);
  else if (e.target === $pausa) reanudar(); // clic fuera del menú
});
for (const id of ['btn-pausa', 'flotante-pausa']) {
  document.getElementById(id).addEventListener('click', () => {
    activarAudio();
    pausar();
  });
}

// ─── Interfaz HTML (modo escritorio) ─────────────────────────────────────
const $titulo = document.getElementById('titulo');
const $controles = document.getElementById('controles');
const $estado = document.getElementById('estado');
const $carga = document.getElementById('carga');
const $btnVR = document.getElementById('btn-vr');
const $btnSiguiente = document.getElementById('btn-siguiente');

function actualizarInterfaz() {
  const juego = JUEGOS[indiceActual];
  const siguiente = JUEGOS[siguienteIndice()];
  document.title = `${juego.titulo} · VR Play`;
  $titulo.textContent = juego.titulo;
  $controles.textContent = TACTIL
    ? juego.controlesTactil || juego.controlesEscritorio
    : t('jugar.controles', { raton: juego.controlesEscritorio, vr: juego.controlesVR });
  $btnSiguiente.title = t('jugar.pasarA', { juego: siguiente.titulo });
  $estado.textContent = t('jugar.siguientePrecargando', { juego: siguiente.titulo });
}

$btnSiguiente.addEventListener('click', () => {
  activarAudio();
  siguienteJuego();
});
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.key === 'Escape' || e.key === 'p' || e.key === 'P') {
    activarAudio();
    if (pausado) reanudar();
    else pausar();
  } else if (e.key === 'n' || e.key === 'N') {
    activarAudio();
    siguienteJuego();
  }
});

async function comprobarVR() {
  let disponible = false;
  try {
    disponible = !!navigator.xr && (await navigator.xr.isSessionSupported('immersive-vr'));
  } catch (e) {
    disponible = false;
  }
  $btnVR.disabled = !disponible;
  document.body.classList.toggle('sin-vr', !disponible); // en el móvil el botón se oculta
  $btnVR.textContent = t(disponible ? 'jugar.entrarVR' : 'jugar.vrNoDisponible');
  if (!disponible) $btnVR.title = t(window.isSecureContext ? 'jugar.vrAyudaGafas' : 'jugar.vrAyudaHttps');
}

$btnVR.addEventListener('click', async () => {
  activarAudio();
  if (renderer.xr.isPresenting) {
    renderer.xr.getSession()?.end();
    return;
  }
  try {
    const sesion = await navigator.xr.requestSession('immersive-vr', {
      optionalFeatures: ['local-floor', 'bounded-floor'],
    });
    sesion.addEventListener('end', alSalirVR);
    await renderer.xr.setSession(sesion);
    alEntrarVR();
  } catch (e) {
    console.error('No se pudo iniciar la VR', e);
    $estado.textContent = t('jugar.vrError');
  }
});

function alEntrarVR() {
  document.body.classList.add('en-vr');
  reanudar();
  boton.reiniciar();
  botonPausa.reiniciar();
  mostrarAviso([
    { texto: t('jugar.vr.botones'), tam: 1.1, color: '#b9a8ff' },
    { texto: t('jugar.vr.derecha'), tam: 0.75 },
    { texto: t('jugar.vr.izquierda'), tam: 0.75 },
    { texto: t('jugar.vr.dejala'), tam: 0.65 },
  ], 9);
}

function alSalirVR() {
  document.body.classList.remove('en-vr');
  // Si sales de VR con el juego en pausa, el menú pasa a la pantalla
  if (pausado) {
    menuPausa.cerrar();
    $pausa.hidden = false;
  }
  // Al salir de VR la cámara conserva el campo de visión de las gafas: lo restauramos.
  alRedimensionar();
  aplicarVista();
}

function alRedimensionar() {
  if (renderer.xr.isPresenting) return;
  ajustarCampoVision();
  aplicarVista();
  renderer.setSize(window.innerWidth, window.innerHeight);
}
window.addEventListener('resize', alRedimensionar);

// ─── Bucle principal ─────────────────────────────────────────────────────
const reloj = new THREE.Clock();
let tiempo = 0;

renderer.setAnimationLoop(() => {
  const dt = Math.min(reloj.getDelta(), 0.05);
  tiempo += dt;
  const enVR = renderer.xr.isPresenting;

  escena.updateMatrixWorld();
  actualizarManos();
  actualizarRaton(dt);
  camara.getWorldPosition(cabezaPos);
  camara.getWorldDirection(cabezaDir);

  // Un error dentro de un juego no debe bloquear la shell (ni el botón de cambio)
  if (actual && !errorJuego && !pausado) {
    try {
      actual.instancia.actualizar?.(dt, tiempo);
    } catch (e) {
      errorJuego = true;
      console.error(`Error en "${JUEGOS[actual.indice].titulo}"`, e);
      mostrarAviso([{ texto: t('jugar.errorJuego'), color: '#ff8a80' }, { texto: t('jugar.errorJuegoAyuda'), tam: 0.7 }], 6);
    }
  }
  guardarRatonAnterior();

  boton.grupo.visible = enVR && !pausado;
  if (!enVR || pausado) boton.ocultarGuia();
  botonPausa.grupo.visible = enVR && !pausado;
  if (!enVR || pausado) botonPausa.ocultarGuia();
  if (enVR && pausado) {
    const accion = menuPausa.actualizar(manos);
    if (accion) accionPausa(accion);
  } else if (enVR) {
    // Detrás del hombro izquierdo, con la mano izquierda: pausa y menú
    const p = botonPausa.actualizar(dt, cabezaPos, cabezaDir, manos.filter((m) => m.activa && esIzquierda(m)));
    if (p.aviso) vibrar(p.aviso.mano, p.aviso.fuerza, 25);
    if (p.entro) {
      vibrar(p.entro, 0.3, 30);
      sonido('tic');
    }
    if (p.activado) {
      vibrar(p.mano, 1, 120);
      pausar();
    }
    // Detrás del hombro derecho, con la mano derecha: siguiente juego
    const r = boton.actualizar(dt, cabezaPos, cabezaDir, manos.filter((m) => m.activa && !esIzquierda(m)));
    if (r.aviso) vibrar(r.aviso.mano, r.aviso.fuerza, 25); // guía para encontrar el botón
    if (r.entro) {
      vibrar(r.entro, 0.3, 30);
      sonido('tic');
    }
    if (r.activado) {
      vibrar(r.mano, 1, 120);
      siguienteJuego();
    }
  }

  fundido.actualizar(dt);
  actualizarAviso(dt);
  renderer.render(escena, camara);
});

// Ayuda para depurar desde la consola del navegador: vrPlay.siguienteJuego(), vrPlay.memoria()...
window.vrPlay = {
  siguienteJuego,
  cambiarA,
  memoria: () => ({ ...renderer.info.memory }),
  dibujado: () => ({ ...renderer.info.render }), // llamadas y triángulos del último fotograma
  get juego() { return JUEGOS[indiceActual].id; },
  get cambiando() { return cambiando; },
};

iniciarPantallaCompleta({
  lienzo,
  tactil: TACTIL,
  siguienteJuego() {
    activarAudio();
    siguienteJuego();
  },
});
comprobarVR();
cambiarA(indiceActual);
