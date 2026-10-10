// Worker de VR Play. La web (HTML, juegos, imágenes) son archivos estáticos que Cloudflare
// sirve solo; este programa únicamente atiende /api/* (el foro de sugerencias), porque
// wrangler.jsonc dice "run_worker_first": ["/api/*"]. Cada ruta exporta sus manejadores
// como onRequestGet / onRequestPost / onRequestPatch({ request, env, params }).
import * as config from './config.js';
import * as sugerencias from './sugerencias.js';
import * as sugerencia from './sugerencia.js';
import * as comentarios from './comentarios.js';
import * as meGusta from './me-gusta.js';
import * as comentario from './comentario.js';
import { error } from './comun.js';

const RUTAS = [
  [/^\/api\/config$/, config],
  [/^\/api\/sugerencias$/, sugerencias],
  [/^\/api\/sugerencias\/([^/]+)$/, sugerencia],
  [/^\/api\/sugerencias\/([^/]+)\/comentarios$/, comentarios],
  [/^\/api\/sugerencias\/([^/]+)\/me-gusta$/, meGusta],
  [/^\/api\/comentarios\/([^/]+)$/, comentario],
];

export default {
  async fetch(request, env) {
    const url = new URL(request.url);
    if (!url.pathname.startsWith('/api/')) return env.ASSETS.fetch(request);

    for (const [patron, modulo] of RUTAS) {
      const coincide = url.pathname.match(patron);
      if (!coincide) continue;
      // GET → onRequestGet, POST → onRequestPost...
      const metodo = request.method.charAt(0) + request.method.slice(1).toLowerCase();
      const manejador = modulo[`onRequest${metodo}`];
      if (!manejador) return error('Método no permitido.', 405);
      try {
        return await manejador({ request, env, params: { id: coincide[1] } });
      } catch (e) {
        console.error('Error en la API del foro', e);
        return error('Error del servidor. Prueba más tarde.', 500);
      }
    }
    return error('No encontrado.', 404);
  },
};
