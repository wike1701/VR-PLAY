// ─────────────────────────────────────────────────────────────────────────
// IDIOMA DE LA PÁGINA (script clásico, va en el <head> de cada página)
// Decide el idioma antes de pintar nada y lo deja en <html lang="…">, para que
// idiomas/idiomas.js lo use. Si no es el español (el idioma original de las
// páginas), oculta la página hasta que esté traducida y así no se ve un
// instante en español. Si la traducción fallara, la página aparece igual a los 2,5 s.
//
// Orden: ?lang=xx en la dirección > idioma elegido antes > idioma del navegador > inglés.
// La lista de códigos tiene que coincidir con IDIOMAS de idiomas/idiomas.js
// (lo comprueba `node herramientas/idiomas.mjs`).
// ─────────────────────────────────────────────────────────────────────────
(function () {
  var CODIGOS = ['es', 'en', 'fr', 'de', 'it', 'pt', 'ja', 'ko', 'zh'];
  var CLAVE = 'vrplay:idioma';
  var elegido = null;

  function valido(codigo) {
    codigo = String(codigo || '').toLowerCase().split('-')[0];
    return CODIGOS.indexOf(codigo) >= 0 ? codigo : null;
  }

  try {
    var enLaUrl = valido(new URLSearchParams(location.search).get('lang'));
    if (enLaUrl) {
      elegido = enLaUrl;
      localStorage.setItem(CLAVE, enLaUrl); // un enlace con ?lang= cuenta como elección
    } else {
      elegido = valido(localStorage.getItem(CLAVE));
    }
  } catch (e) { /* sin almacenamiento */ }

  if (!elegido) {
    var delNavegador = navigator.languages && navigator.languages.length ? navigator.languages : [navigator.language];
    for (var i = 0; i < delNavegador.length && !elegido; i++) elegido = valido(delNavegador[i]);
  }
  elegido = elegido || 'en';

  var html = document.documentElement;
  html.lang = elegido;
  if (elegido !== 'es') {
    html.classList.add('traduciendo');
    var estilo = document.createElement('style');
    estilo.textContent = 'html.traduciendo body{visibility:hidden;animation:vrplay-mostrar 0s 2.5s forwards}'
      + '@keyframes vrplay-mostrar{to{visibility:visible}}';
    document.head.appendChild(estilo);
  }
})();
