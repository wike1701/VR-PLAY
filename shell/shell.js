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
import { JUEGOS } from '../juegos/catalogo.js';
import { BotonCambio } from './boton-cambio.js';
import { crearPanel, liberarObjeto, liberarRecurso } from './utilidades.js';
import { activarAudio, sonido } from './sonido.js';

const COLOR_FONDO = 0x141826;
const FOV_ESCRITORIO = 70;
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
document.getElementById('escena').appendChild(renderer.domElement);

const escena = new THREE.Scene();
escena.background = new THREE.Color(COLOR_FONDO);
escena.fog = new THREE.Fog(COLOR_FONDO, 7, 16);

const camara = new THREE.PerspectiveCamera(FOV_ESCRITORIO, window.innerWidth / window.innerHeight, 0.05, 100);
escena.add(camara);

escena.add(new THREE.HemisphereLight(0xdfe6ff, 0x30304a, 1.6));
const sol = new THREE.DirectionalLight(0xffffff, 1.8);
sol.position.set(2, 5, 2);
escena.add(sol);

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
function aplicarVista() {
  if (renderer.xr.isPresenting) return;
  camara.position.copy(vista.posicion);
  camara.lookAt(vista.objetivo);
}
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
  posicionRaton(e);
  clicPendiente = true;
  raton.pulsado = true;
});
window.addEventListener('pointerup', () => { raton.pulsado = false; });
lienzo.addEventListener('pointerleave', () => {
  raton.dentro = false;
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
    cola = barajar(JUEGOS.map((_, i) => i));
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
  const prefijo = `vrplay:${JUEGOS[indice].id}:`;

  // Todo lo que un juego necesita de la shell pasa por aquí.
  const ctx = {
    raiz, escena, camara, renderer, manos, raton,
    enVR: () => renderer.xr.isPresenting,
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
    vibrar,
    destello: (color, fuerza) => fundido.destello(color, fuerza),
    fondo(color) {
      escena.background.setHex(color);
      escena.fog.color.setHex(color);
    },
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
  actual = { indice, instancia, raiz, adjuntos, recursos };
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
  actual = null;

  // Volver al estado base de la shell
  escena.background.setHex(COLOR_FONDO);
  escena.fog.color.setHex(COLOR_FONDO);
  vista.posicion.copy(VISTA_POR_DEFECTO.posicion);
  vista.objetivo.copy(VISTA_POR_DEFECTO.objetivo);
}

async function cambiarA(indice) {
  if (cambiando) return;
  cambiando = true;
  ocultarAviso();
  try {
    if (actual) await fundido.a(1, 0.3);
    desmontar();
    indiceActual = indice;
    cola = cola.filter((i) => i !== indice); // ya jugado en esta vuelta
    actualizarInterfaz();

    // Si el juego ya estaba precargado esto es inmediato; si no, mostramos "Cargando…"
    const temporizador = setTimeout(() => {
      panelCarga.escribir([`Cargando ${JUEGOS[indice].titulo}…`]);
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
      { texto: 'No se pudo cargar el juego', color: '#ff8a80' },
      { texto: 'Pulsa el botón para pasar al siguiente', tam: 0.7 },
    ], 6);
  }
  await fundido.a(0, 0.35);
  cambiando = false;

  // Precarga en segundo plano el siguiente juego para que el cambio sea instantáneo
  const siguiente = siguienteIndice();
  boton.setSiguiente(JUEGOS[siguiente].titulo);
  actualizarInterfaz();
  if (!actual) $titulo.textContent = `${JUEGOS[indiceActual].titulo} (no se pudo cargar)`;
  precargar(siguiente).then(
    () => { if (siguiente === siguienteIndice()) $estado.textContent = `Siguiente: ${JUEGOS[siguiente].titulo} (listo)`; },
    () => { $estado.textContent = `Siguiente: ${JUEGOS[siguiente].titulo} (no se pudo precargar)`; },
  );
}

function siguienteJuego() {
  if (cambiando) return;
  sonido('boton');
  cambiarA(siguienteIndice());
}

// ─── Botón de cambio detrás del hombro derecho ───────────────────────────
const boton = new BotonCambio(crearPanel);
escena.add(boton.grupo);
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
  $controles.textContent = `Con ratón: ${juego.controlesEscritorio}  ·  En VR: ${juego.controlesVR}`;
  $btnSiguiente.title = `Pasar a ${siguiente.titulo}`;
  $estado.textContent = `Siguiente: ${siguiente.titulo} (precargando…)`;
}

$btnSiguiente.addEventListener('click', () => {
  activarAudio();
  siguienteJuego();
});
window.addEventListener('keydown', (e) => {
  if (e.repeat) return;
  if (e.key === 'n' || e.key === 'N') {
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
  $btnVR.textContent = disponible ? 'Entrar en VR' : 'VR no disponible';
  if (!disponible) {
    $btnVR.title = window.isSecureContext
      ? 'Abre esta página en el navegador de unas gafas VR (por ejemplo, Meta Quest).'
      : 'La VR solo funciona en páginas con HTTPS.';
  }
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
    $estado.textContent = 'No se pudo iniciar la VR en este navegador.';
  }
});

function alEntrarVR() {
  document.body.classList.add('en-vr');
  boton.reiniciar();
  mostrarAviso([
    { texto: 'Para cambiar de juego', tam: 1.1, color: '#b9a8ff' },
    { texto: 'lleva la mano por encima de tu hombro derecho, hacia atrás,', tam: 0.75 },
    { texto: 'y déjala medio segundo en el botón (o aprieta el gatillo)', tam: 0.75 },
  ], 9);
}

function alSalirVR() {
  document.body.classList.remove('en-vr');
  // Al salir de VR la cámara conserva el campo de visión de las gafas: lo restauramos.
  camara.fov = FOV_ESCRITORIO;
  camara.zoom = 1;
  alRedimensionar();
  aplicarVista();
}

function alRedimensionar() {
  if (renderer.xr.isPresenting) return;
  camara.aspect = window.innerWidth / window.innerHeight;
  camara.updateProjectionMatrix();
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
  if (actual && !errorJuego) {
    try {
      actual.instancia.actualizar?.(dt, tiempo);
    } catch (e) {
      errorJuego = true;
      console.error(`Error en "${JUEGOS[actual.indice].titulo}"`, e);
      mostrarAviso([{ texto: 'El juego ha fallado', color: '#ff8a80' }, { texto: 'Pulsa el botón para cambiar', tam: 0.7 }], 6);
    }
  }
  guardarRatonAnterior();

  boton.grupo.visible = enVR;
  if (enVR) {
    const r = boton.actualizar(dt, cabezaPos, cabezaDir, manos.filter((m) => m.activa));
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
  get juego() { return JUEGOS[indiceActual].id; },
  get cambiando() { return cambiando; },
};

comprobarVR();
cambiarA(indiceActual);
