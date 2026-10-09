// GET /api/config → datos públicos que necesita foro.html
import { json } from './_comun.js';

export function onRequestGet({ env }) {
  return json({
    turnstile: env.TURNSTILE_SITEKEY || null,
    activo: !!env.DB,
  });
}
