// Worker de VR Play. La web (HTML, juegos, imágenes) son archivos estáticos que Cloudflare
// sirve solo; este programa únicamente atiende /api/* (el foro de sugerencias), porque
// wrangler.jsonc dice "run_worker_first": ["/api/*"]. Cada ruta exporta sus manejadores
// como onRequestGet / onRequestPost / onRequestPatch({ request, env, params }), o una función
// atender(contexto) que reparte ella misma (las cuentas).
import * as config from './config.js';
import * as sugerencias from './sugerencias.js';
import * as sugerencia from './sugerencia.js';
import * as comentarios from './comentarios.js';
import * as meGusta from './me-gusta.js';
import * as comentario from './comentario.js';
import * as juegosEnPruebas from './juegos-en-pruebas.js';
import * as juegosMeGusta from './juegos-me-gusta.js';
import * as cuenta from './cuenta.js';
import * as adminUsuarios from './admin-usuarios.js';
import * as perfiles from './perfiles.js';
import { error } from './comun.js';
import { prepararBD } from './bd.js';

const RUTAS = [
  [/^\/api\/config$/, config],
  [/^\/api\/sugerencias$/, sugerencias],
  [/^\/api\/sugerencias\/([^/]+)$/, sugerencia],
  [/^\/api\/sugerencias\/([^/]+)\/comentarios$/, comentarios],
  [/^\/api\/sugerencias\/([^/]+)\/me-gusta$/, meGusta],
  [/^\/api\/comentarios\/([^/]+)$/, comentario],
  [/^\/api\/juegos-en-pruebas$/, juegosEnPruebas],
  [/^\/api\/juegos\/me-gusta$/, { onRequestGet: juegosMeGusta.onRequestGet }],
  [/^\/api\/juegos\/([^/]+)\/me-gusta$/, { onRequestPost: juegosMeGusta.onRequestPost }],
  // /api/cuenta, /api/cuenta/alias, /api/cuenta/sesiones/12…
  [/^\/api\/cuenta(?:\/([a-z-]+))?(?:\/(\d+))?$/, cuenta, (c) => ({ accion: c[1], id: c[2] })],
  [/^\/api\/admin\/usuarios(?:\/(\d+))?$/, adminUsuarios],
  [/^\/api\/perfiles(?:\/([^/]+))?$/, perfiles],
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    // Las peticiones que cambian algo desde otra web se rechazan (protección contra CSRF)
    const origen = request.headers.get('origin');
    if (!['GET', 'HEAD', 'OPTIONS'].includes(request.method) && origen && origen !== url.origin) {
      return error('Petición no permitida.', 403, 'origen');
    }

    for (const [patron, modulo, parametros] of RUTAS) {
      const coincide = url.pathname.match(patron);
      if (!coincide) continue;
      const params = parametros ? parametros(coincide) : { id: coincide[1] };
      // GET → onRequestGet, POST → onRequestPost...
      const metodo = request.method.charAt(0) + request.method.slice(1).toLowerCase();
      const manejador = modulo.atender || modulo[`onRequest${metodo}`];
      if (!manejador) return error('Método no permitido.', 405);
      try {
        // Las tablas de las cuentas (y sus columnas en las del foro) se crean solas la primera vez
        if (env.DB) await prepararBD(env);
        return await manejador({ request, env, params });
      } catch (e) {
        console.error('Error en la API del foro', e);
        return error('Error del servidor. Prueba más tarde.', 500, 'servidor');
      }
    }
    return error('No encontrado.', 404, 'no_encontrado');
  },
};
