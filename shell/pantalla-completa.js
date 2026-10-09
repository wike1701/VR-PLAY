// ─────────────────────────────────────────────────────────────────────────
// PANTALLA COMPLETA (sobre todo para el móvil)
// - Android y la mayoría de navegadores: API de pantalla completa. En pantallas
//   táctiles se activa sola con el primer toque en el juego.
// - iPhone: Safari no la permite en páginas web; la alternativa es añadir la web a
//   la pantalla de inicio (manifest.webmanifest), que se abre ya sin barras.
// En los dos casos se ocultan la barra y la ayuda: solo queda el juego y dos
// botones flotantes pequeños (siguiente juego y salir).
// ─────────────────────────────────────────────────────────────────────────

const documento = document.documentElement;
const pedir = documento.requestFullscreen || documento.webkitRequestFullscreen;
const salir = document.exitFullscreen || document.webkitExitFullscreen;
const SOPORTADA = !!pedir;
// Abierta desde la pantalla de inicio (app instalada): ya no hay barras del navegador
const INSTALADA = window.matchMedia('(display-mode: fullscreen), (display-mode: standalone)').matches
  || navigator.standalone === true;

function elementoCompleto() {
  return document.fullscreenElement || document.webkitFullscreenElement || null;
}

export function iniciarPantallaCompleta({ lienzo, tactil, siguienteJuego }) {
  const $boton = document.getElementById('btn-completa');
  const $flotantes = document.getElementById('flotantes');
  const $siguiente = document.getElementById('flotante-siguiente');
  const $salir = document.getElementById('flotante-salir');
  const $aviso = document.getElementById('aviso-completa');
  let rechazada = false; // si sales (con ✕ o con el gesto de atrás), no volver a entrar sola
  let tiempoAviso = null;
  let estaba = false;

  function actualizar() {
    const completa = !!elementoCompleto();
    if (estaba && !completa) rechazada = true;
    estaba = completa;
    const inmersivo = INSTALADA || completa;
    document.body.classList.toggle('inmersivo', inmersivo);
    $flotantes.hidden = !inmersivo;
    $salir.title = $salir.ariaLabel = completa ? 'Salir de pantalla completa' : 'Volver al catálogo';
    $boton.hidden = INSTALADA || (!SOPORTADA && !tactil);
  }

  async function entrar() {
    if (elementoCompleto()) return;
    try {
      await pedir.call(documento, { navigationUI: 'hide' });
    } catch (e) {
      // Algunos navegadores lo rechazan sin gesto del usuario: no pasa nada
    }
  }

  function mostrarAviso(texto) {
    $aviso.textContent = texto;
    $aviso.hidden = false;
    clearTimeout(tiempoAviso);
    tiempoAviso = setTimeout(() => { $aviso.hidden = true; }, 7000);
  }

  $boton.addEventListener('click', () => {
    if (SOPORTADA) {
      rechazada = false;
      entrar();
    } else {
      mostrarAviso('En iPhone: pulsa Compartir y luego «Añadir a pantalla de inicio». Desde ese icono se juega en pantalla completa.');
    }
  });

  // En el móvil, el primer toque en el juego ya pone la pantalla completa
  lienzo.addEventListener('pointerdown', (e) => {
    if (tactil && SOPORTADA && !rechazada && e.pointerType !== 'mouse') entrar();
  });

  $siguiente.addEventListener('click', siguienteJuego);
  $salir.addEventListener('click', () => {
    if (elementoCompleto()) {
      salir.call(document);
    } else {
      location.href = 'index.html'; // app instalada: volver al catálogo
    }
  });

  document.addEventListener('fullscreenchange', actualizar);
  document.addEventListener('webkitfullscreenchange', actualizar);
  actualizar();
}
