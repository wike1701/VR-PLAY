// Cuentas de usuario (ver PERFILES.md). Todas las rutas empiezan por /api/cuenta:
//   GET    /api/cuenta                      → { visibles, google, usuario|null }
//   DELETE /api/cuenta { confirmar }         → borra la cuenta (confirmar = el alias, o el correo si aún no tiene)
//   POST   /api/cuenta/enlace { correo, idioma, volver } → envía el correo con el enlace y el código
//   POST   /api/cuenta/confirmar { token } o { correo, codigo } → inicia la sesión
//   GET    /api/cuenta/google                → entrar con Google (ver google.js)
//   POST   /api/cuenta/alias { alias, anio, acepto } → elige el alias (la primera vez, con el año de nacimiento)
//   POST   /api/cuenta/avatar                → otro avatar al azar
//   PATCH  /api/cuenta/ajustes { avisosCorreo, listasOcultas }
//   POST   /api/cuenta/salir                 → cierra esta sesión
//   POST   /api/cuenta/salir-todo            → cierra la sesión en todos los dispositivos
//   GET    /api/cuenta/sesiones              → dispositivos con la sesión abierta
//   DELETE /api/cuenta/sesiones/:id          → cierra una
//   GET    /api/cuenta/datos                 → descarga de todos sus datos (JSON)
//   POST   /api/cuenta/fusionar { votante, favoritos } → pasa a la cuenta lo de este navegador
//   POST   /api/cuenta/favoritos { juego, favorito }
import { json, error, leerJson, huellaIp, huellaVotante, sha256, idValido } from './comun.js';
import {
  usuarioActual, borrarCookieSesion, aleatorio, hashToken, votanteCuenta,
  problemaAlias, claveAlias, aliasLibre, semillaAvatar, entrarConCorreo, volverValido,
} from './sesion.js';
import { enviarEnlace, idiomaValido } from './correo.js';
import { entrarConGoogle } from './google.js';
import { listasOcultas } from './perfiles.js';

const EDAD_MINIMA = 14;
const MINUTOS_ENLACE = 15;
const INTENTOS_CODIGO = 5;
const LIMITE_ENLACES = { ip: 6, correo: 3 }; // por hora
const DIAS_CAMBIO_ALIAS = 30;
const idJuego = (valor) => (typeof valor === 'string' && /^[a-z0-9_-]{1,40}$/.test(valor) ? valor : null);

// Respuesta JSON con cookies
function conCookies(respuesta, ...cookies) {
  for (const c of cookies) respuesta.headers.append('set-cookie', c);
  return respuesta;
}

export function correoValido(valor) {
  if (typeof valor !== 'string') return null;
  const correo = valor.trim().toLowerCase();
  return correo.length <= 254 && /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(correo) ? correo : null;
}

// Lo que ve el propio usuario de su cuenta
async function datosCuenta(env, u) {
  const votante = await votanteCuenta(u, env);
  const [favoritos, meGusta] = await env.DB.batch([
    env.DB.prepare('SELECT juego FROM favoritos WHERE usuario_id = ? ORDER BY creada').bind(u.id),
    env.DB.prepare('SELECT juego FROM juegos_me_gusta WHERE votante = ?').bind(votante),
  ]);
  let aliasCambiable = null;
  if (u.alias_cambiado) {
    const cuando = Date.parse(u.alias_cambiado.replace(' ', 'T') + 'Z') + DIAS_CAMBIO_ALIAS * 86400000;
    if (cuando > Date.now()) aliasCambiable = new Date(cuando).toISOString();
  }
  return {
    id: u.id,
    alias: u.alias,
    avatar: u.avatar,
    correo: u.correo,
    google: !!u.google_id,
    creada: u.creada,
    avisosCorreo: !!u.avisos_correo,
    listasOcultas: listasOcultas(u),
    suspendido: !!u.suspendido,
    aliasCambiable,
    favoritos: favoritos.results.map((f) => f.juego),
    meGusta: meGusta.results.map((f) => f.juego),
  };
}

// ─── Estado ─────────────────────────────────────────────────────────────
async function estado({ request, env }) {
  const u = await usuarioActual(request, env);
  return json({
    // Mientras se prueba, el botón «Entrar» solo sale con ?perfiles=1 (ver shell/cuenta.js)
    visibles: env.CUENTAS === '1',
    google: !!(env.GOOGLE_CLIENT_ID && env.GOOGLE_CLIENT_SECRET),
    usuario: u ? await datosCuenta(env, u) : null,
  });
}

// ─── Enlace por correo ──────────────────────────────────────────────────
async function pedirEnlace({ request, env }) {
  const datos = await leerJson(request);
  const correo = correoValido(datos?.correo);
  if (!correo) return error('Escribe un correo válido.', 400, 'correo');
  const idioma = idiomaValido(datos.idioma);
  const volver = volverValido(datos.volver);

  const ip = await huellaIp(request, env);
  const [porIp, porCorreo] = await env.DB.batch([
    env.DB.prepare("SELECT COUNT(*) AS n FROM enlaces_acceso WHERE ip = ? AND creada > datetime('now', '-1 hour')").bind(ip),
    env.DB.prepare("SELECT COUNT(*) AS n FROM enlaces_acceso WHERE correo = ? AND creada > datetime('now', '-1 hour')").bind(correo),
  ]);
  if (porIp.results[0].n >= LIMITE_ENLACES.ip || porCorreo.results[0].n >= LIMITE_ENLACES.correo) {
    return error('Has pedido muchos enlaces seguidos. Prueba dentro de un rato.', 429, 'limite_enlaces');
  }

  const token = aleatorio();
  const codigo = String(crypto.getRandomValues(new Uint32Array(1))[0] % 1000000).padStart(6, '0');
  const fila = await env.DB.prepare(
    `INSERT INTO enlaces_acceso (correo, token, codigo, ip, caduca) VALUES (?, ?, '', ?, datetime('now', '+${MINUTOS_ENLACE} minutes')) RETURNING id`,
  ).bind(correo, await hashToken(token, env), ip).first();
  await env.DB.prepare('UPDATE enlaces_acceso SET codigo = ? WHERE id = ?').bind(await hashCodigo(env, fila.id, codigo), fila.id).run();

  const origen = new URL(request.url).origin;
  const enlace = `${origen}/entrar.html?volver=${encodeURIComponent(volver)}#acceso=${token}`;
  try {
    await enviarEnlace(env, { correo, enlace, codigo, idioma });
  } catch (e) {
    console.error('No se pudo enviar el correo', e);
    await env.DB.prepare('DELETE FROM enlaces_acceso WHERE id = ?').bind(fila.id).run();
    return error('No se ha podido enviar el correo. Prueba más tarde.', 502, 'correo_envio');
  }
  // Nunca se dice si el correo tenía cuenta o no
  return json({ ok: true });
}

const hashCodigo = (env, id, codigo) => sha256(`${env.SAL || 'vrplay'}:codigo:${id}:${codigo}`);

async function confirmar({ request, env }) {
  const datos = await leerJson(request);
  if (!datos) return error('Datos no válidos.', 400, 'datos');
  let correo;

  if (typeof datos.token === 'string' && datos.token.length >= 20 && datos.token.length <= 100) {
    const enlace = await env.DB.prepare("SELECT id, correo FROM enlaces_acceso WHERE token = ? AND caduca > datetime('now')")
      .bind(await hashToken(datos.token, env)).first();
    if (!enlace) return error('El enlace ha caducado o ya se ha usado. Pide otro.', 400, 'enlace_caducado');
    await env.DB.prepare('DELETE FROM enlaces_acceso WHERE id = ?').bind(enlace.id).run();
    correo = enlace.correo;
  } else {
    correo = correoValido(datos.correo);
    const codigo = typeof datos.codigo === 'string' ? datos.codigo.replace(/\D/g, '') : '';
    if (!correo || codigo.length !== 6) return error('Escribe el código de 6 cifras del correo.', 400, 'codigo_formato');
    // Solo vale el último enlace que se pidió para ese correo
    const enlace = await env.DB.prepare(
      "SELECT id, codigo, intentos FROM enlaces_acceso WHERE correo = ? AND caduca > datetime('now') ORDER BY id DESC LIMIT 1",
    ).bind(correo).first();
    if (!enlace) return error('El código ha caducado. Pide otro correo.', 400, 'codigo_caducado');
    if (enlace.intentos >= INTENTOS_CODIGO) return error('Demasiados intentos. Pide otro correo.', 429, 'codigo_intentos');
    if ((await hashCodigo(env, enlace.id, codigo)) !== enlace.codigo) {
      await env.DB.prepare('UPDATE enlaces_acceso SET intentos = intentos + 1 WHERE id = ?').bind(enlace.id).run();
      return error('El código no es correcto.', 400, 'codigo_incorrecto');
    }
    await env.DB.prepare('DELETE FROM enlaces_acceso WHERE id = ?').bind(enlace.id).run();
  }

  const { usuario, cookie } = await entrarConCorreo(env, request, correo);
  return conCookies(json({ usuario: await datosCuenta(env, usuario) }), cookie);
}

// ─── Alias, avatar y ajustes ────────────────────────────────────────────
async function elegirAlias({ request, env }, u) {
  const datos = await leerJson(request);
  if (!datos) return error('Datos no válidos.', 400, 'datos');
  const alias = typeof datos.alias === 'string' ? datos.alias.trim().normalize('NFC') : '';
  const primeraVez = !u.alias;
  let anio = null;

  if (primeraVez) {
    anio = Number(datos.anio);
    const este = new Date().getUTCFullYear();
    if (!Number.isInteger(anio) || anio < este - 120 || anio > este) return error('Escribe tu año de nacimiento.', 400, 'anio');
    if (datos.acepto !== true) return error('Tienes que aceptar las condiciones y la política de privacidad.', 400, 'acepto');
    if (este - anio < EDAD_MINIMA) {
      // No se guarda nada de quien no tiene la edad mínima: se borra la cuenta recién creada
      await borrarTodo(env, u);
      return conCookies(error('Para crear una cuenta hay que tener 14 años o más.', 403, 'edad'), borrarCookieSesion());
    }
  } else if (u.alias_cambiado) {
    const cuando = Date.parse(u.alias_cambiado.replace(' ', 'T') + 'Z') + DIAS_CAMBIO_ALIAS * 86400000;
    if (cuando > Date.now()) return error('Solo se puede cambiar el alias una vez cada 30 días.', 400, 'alias_espera', { fecha: new Date(cuando).toISOString() });
  }

  const problema = problemaAlias(alias);
  if (problema) return error('Ese alias no vale.', 400, problema);
  const clave = claveAlias(alias);
  const mismoAlias = clave === u.alias_clave; // solo cambia mayúsculas o tildes
  if (!mismoAlias && !(await aliasLibre(env, clave, u.id))) return error('Ese alias ya lo tiene otra persona.', 409, 'alias_ocupado');

  const consultas = [
    env.DB.prepare(`UPDATE usuarios SET alias = ?, alias_clave = ?${primeraVez ? ', anio_nacimiento = ?' : ''}${!primeraVez && !mismoAlias ? ", alias_cambiado = datetime('now')" : ''} WHERE id = ?`)
      .bind(...[alias, clave, ...(primeraVez ? [anio] : []), u.id]),
    // Lo que ya ha publicado en el foro se firma con el alias nuevo
    env.DB.prepare('UPDATE sugerencias SET autor = ? WHERE usuario_id = ?').bind(alias, u.id),
    env.DB.prepare('UPDATE comentarios SET autor = ? WHERE usuario_id = ?').bind(alias, u.id),
  ];
  // El alias anterior queda bloqueado 30 días para que nadie se lo quede
  if (!primeraVez && !mismoAlias) {
    consultas.push(env.DB.prepare(`INSERT OR REPLACE INTO alias_bloqueados (alias_clave, hasta) VALUES (?, datetime('now', '+${DIAS_CAMBIO_ALIAS} days'))`).bind(u.alias_clave));
  }
  try {
    await env.DB.batch(consultas);
  } catch (e) {
    if (/UNIQUE/i.test(String(e?.message))) return error('Ese alias ya lo tiene otra persona.', 409, 'alias_ocupado');
    throw e;
  }
  const nuevo = await env.DB.prepare('SELECT * FROM usuarios WHERE id = ?').bind(u.id).first();
  return json({ usuario: await datosCuenta(env, nuevo) });
}

async function otroAvatar({ env }, u) {
  await env.DB.prepare('UPDATE usuarios SET avatar = ? WHERE id = ?').bind(semillaAvatar(), u.id).run();
  const nuevo = await env.DB.prepare('SELECT * FROM usuarios WHERE id = ?').bind(u.id).first();
  return json({ usuario: await datosCuenta(env, nuevo) });
}

async function ajustes({ request, env }, u) {
  const datos = await leerJson(request);
  const consultas = [];
  if (typeof datos?.avisosCorreo === 'boolean') {
    consultas.push(env.DB.prepare('UPDATE usuarios SET avisos_correo = ? WHERE id = ?').bind(datos.avisosCorreo ? 1 : 0, u.id));
  }
  if (typeof datos?.listasOcultas === 'boolean') {
    consultas.push(env.DB.prepare('UPDATE usuarios SET listas_ocultas = ? WHERE id = ?').bind(datos.listasOcultas ? 1 : 0, u.id));
  }
  if (!consultas.length) return error('Datos no válidos.', 400, 'datos');
  await env.DB.batch(consultas);
  return json({ ok: true });
}

// ─── Sesiones ───────────────────────────────────────────────────────────
async function salir({ request, env }) {
  const u = await usuarioActual(request, env);
  if (u) await env.DB.prepare('DELETE FROM sesiones WHERE id = ?').bind(u.sesion_id).run();
  return conCookies(json({ ok: true }), borrarCookieSesion());
}

async function salirTodo({ env }, u) {
  await env.DB.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(u.id).run();
  return conCookies(json({ ok: true }), borrarCookieSesion());
}

async function sesiones({ env }, u) {
  const { results } = await env.DB.prepare(
    "SELECT id, dispositivo, creada, usada FROM sesiones WHERE usuario_id = ? AND caduca > datetime('now') ORDER BY usada DESC",
  ).bind(u.id).all();
  return json({ sesiones: results.map((s) => ({ ...s, actual: s.id === u.sesion_id })) });
}

async function cerrarSesion({ env, params }, u) {
  const id = idValido(params.id);
  if (!id) return error('No encontrada.', 404, 'no_encontrado');
  await env.DB.prepare('DELETE FROM sesiones WHERE id = ? AND usuario_id = ?').bind(id, u.id).run();
  const respuesta = json({ ok: true });
  return id === u.sesion_id ? conCookies(respuesta, borrarCookieSesion()) : respuesta;
}

// ─── Mis datos y borrar la cuenta (RGPD) ────────────────────────────────
async function misDatos({ env }, u) {
  const votante = await votanteCuenta(u, env);
  const [sesionesAbiertas, favoritos, juegosQueTeGustan, sugerenciasQueTeGustan, sugerencias, comentarios, sigues, teSiguen] = await env.DB.batch([
    env.DB.prepare('SELECT dispositivo, creada, usada, caduca FROM sesiones WHERE usuario_id = ?').bind(u.id),
    env.DB.prepare('SELECT juego, creada FROM favoritos WHERE usuario_id = ?').bind(u.id),
    env.DB.prepare('SELECT juego, creada FROM juegos_me_gusta WHERE votante = ?').bind(votante),
    env.DB.prepare('SELECT sugerencia_id, creada FROM me_gusta WHERE votante = ?').bind(votante),
    env.DB.prepare('SELECT id, titulo, descripcion, manos, accion, tipo, estado, juego, creada FROM sugerencias WHERE usuario_id = ?').bind(u.id),
    env.DB.prepare('SELECT id, sugerencia_id, texto, creada FROM comentarios WHERE usuario_id = ?').bind(u.id),
    env.DB.prepare('SELECT x.alias, f.creada FROM seguidores f JOIN usuarios x ON x.id = f.seguido_id WHERE f.seguidor_id = ?').bind(u.id),
    env.DB.prepare('SELECT x.alias, f.creada FROM seguidores f JOIN usuarios x ON x.id = f.seguidor_id WHERE f.seguido_id = ?').bind(u.id),
  ]);
  const datos = {
    exportado: new Date().toISOString(),
    web: 'https://vrplaygame.com',
    cuenta: {
      correo: u.correo, alias: u.alias, avatar: u.avatar, anio_nacimiento: u.anio_nacimiento,
      entrar_con_google: !!u.google_id, avisos_correo: !!u.avisos_correo, listas_ocultas: listasOcultas(u), suspendida: !!u.suspendido,
      creada: u.creada, ultimo_acceso: u.ultimo_acceso, alias_cambiado: u.alias_cambiado,
    },
    sesiones: sesionesAbiertas.results,
    favoritos: favoritos.results,
    juegos_que_te_gustan: juegosQueTeGustan.results,
    sugerencias_que_te_gustan: sugerenciasQueTeGustan.results,
    sugerencias: sugerencias.results,
    comentarios: comentarios.results,
    sigues_a: sigues.results,
    te_siguen: teSiguen.results,
  };
  return new Response(JSON.stringify(datos, null, 2), {
    headers: {
      'content-type': 'application/json; charset=utf-8',
      'content-disposition': 'attachment; filename="vrplay-mis-datos.json"',
      'cache-control': 'no-store',
    },
  });
}

// Borra la cuenta. Las sugerencias y los comentarios se quedan como «Usuario eliminado» (son parte
// de hilos de otras personas) y los «me gusta» quedan anónimos, para no alterar los totales.
export async function borrarTodo(env, u) {
  const consultas = [
    env.DB.prepare("UPDATE sugerencias SET autor = 'Usuario eliminado', usuario_id = NULL WHERE usuario_id = ?").bind(u.id),
    env.DB.prepare("UPDATE comentarios SET autor = 'Usuario eliminado', usuario_id = NULL WHERE usuario_id = ?").bind(u.id),
    env.DB.prepare('DELETE FROM favoritos WHERE usuario_id = ?').bind(u.id),
    env.DB.prepare('DELETE FROM seguidores WHERE seguidor_id = ? OR seguido_id = ?').bind(u.id, u.id),
    env.DB.prepare('DELETE FROM sesiones WHERE usuario_id = ?').bind(u.id),
    env.DB.prepare('DELETE FROM enlaces_acceso WHERE correo = ?').bind(u.correo),
    env.DB.prepare('DELETE FROM usuarios WHERE id = ?').bind(u.id),
  ];
  // Su alias queda bloqueado 30 días, para que nadie se haga pasar por esa persona
  if (u.alias_clave) {
    consultas.push(env.DB.prepare(`INSERT OR REPLACE INTO alias_bloqueados (alias_clave, hasta) VALUES (?, datetime('now', '+${DIAS_CAMBIO_ALIAS} days'))`).bind(u.alias_clave));
  }
  await env.DB.batch(consultas);
}

async function borrarCuenta({ request, env }, u) {
  const datos = await leerJson(request);
  const confirmar = typeof datos?.confirmar === 'string' ? datos.confirmar.trim().toLowerCase() : '';
  if (confirmar !== (u.alias || u.correo).toLowerCase()) return error('Escribe tu alias para confirmar.', 400, 'confirmar');
  await borrarTodo(env, u);
  return conCookies(json({ ok: true }), borrarCookieSesion());
}

// ─── Lo del navegador pasa a la cuenta ──────────────────────────────────
async function fusionar({ request, env }, u) {
  const datos = await leerJson(request);
  if (!datos) return error('Datos no válidos.', 400, 'datos');
  const deCuenta = await votanteCuenta(u, env);
  const consultas = [];

  // «Me gusta» del navegador → de la cuenta. Si ya estaba en la cuenta, no cuenta dos veces.
  if (typeof datos.votante === 'string' && datos.votante.length >= 8 && datos.votante.length <= 64) {
    const delNavegador = await huellaVotante(datos.votante, env);
    if (delNavegador !== deCuenta) {
      consultas.push(
        env.DB.prepare('UPDATE OR IGNORE juegos_me_gusta SET votante = ? WHERE votante = ?').bind(deCuenta, delNavegador),
        env.DB.prepare('DELETE FROM juegos_me_gusta WHERE votante = ?').bind(delNavegador),
        env.DB.prepare('UPDATE OR IGNORE me_gusta SET votante = ? WHERE votante = ?').bind(deCuenta, delNavegador),
        env.DB.prepare('DELETE FROM me_gusta WHERE votante = ?').bind(delNavegador),
        env.DB.prepare('UPDATE sugerencias SET me_gusta = (SELECT COUNT(*) FROM me_gusta WHERE sugerencia_id = sugerencias.id) WHERE id IN (SELECT sugerencia_id FROM me_gusta WHERE votante = ?)').bind(deCuenta),
        env.DB.prepare('UPDATE juegos_estadisticas SET me_gusta = (SELECT COUNT(*) FROM juegos_me_gusta m WHERE m.juego = juegos_estadisticas.juego) WHERE juego IN (SELECT juego FROM juegos_me_gusta WHERE votante = ?)').bind(deCuenta),
      );
    }
  }
  // Favoritos: se juntan los del navegador con los de la cuenta
  if (Array.isArray(datos.favoritos)) {
    for (const juego of datos.favoritos.slice(0, 200).map(idJuego).filter(Boolean)) {
      consultas.push(env.DB.prepare('INSERT OR IGNORE INTO favoritos (usuario_id, juego) VALUES (?, ?)').bind(u.id, juego));
    }
  }
  if (consultas.length) await env.DB.batch(consultas);
  return json({ usuario: await datosCuenta(env, u) });
}

async function favorito({ request, env }, u) {
  const datos = await leerJson(request);
  const juego = idJuego(datos?.juego);
  if (!juego || typeof datos.favorito !== 'boolean') return error('Datos no válidos.', 400, 'datos');
  await env.DB.prepare(datos.favorito
    ? 'INSERT OR IGNORE INTO favoritos (usuario_id, juego) VALUES (?, ?)'
    : 'DELETE FROM favoritos WHERE usuario_id = ? AND juego = ?').bind(u.id, juego).run();
  return json({ ok: true });
}

// ─── Reparto ────────────────────────────────────────────────────────────
// [método, acción, manejador, ¿necesita sesión?]
const ACCIONES = [
  ['GET', '', estado, false],
  ['DELETE', '', borrarCuenta, true],
  ['POST', 'enlace', pedirEnlace, false],
  ['POST', 'confirmar', confirmar, false],
  ['GET', 'google', entrarConGoogle, false],
  ['POST', 'alias', elegirAlias, true],
  ['POST', 'avatar', otroAvatar, true],
  ['PATCH', 'ajustes', ajustes, true],
  ['POST', 'salir', salir, false],
  ['POST', 'salir-todo', salirTodo, true],
  ['GET', 'sesiones', sesiones, true],
  ['DELETE', 'sesiones', cerrarSesion, true],
  ['GET', 'datos', misDatos, true],
  ['POST', 'fusionar', fusionar, true],
  ['POST', 'favoritos', favorito, true],
];

export async function atender(contexto) {
  const { request, env, params } = contexto;
  if (!env.DB) return error('Las cuentas no están disponibles ahora mismo.', 503, 'no_disponible');
  const accion = params.accion || '';
  const encontradas = ACCIONES.filter(([, a]) => a === accion);
  if (!encontradas.length) return error('No encontrado.', 404, 'no_encontrado');
  const elegida = encontradas.find(([m]) => m === request.method);
  if (!elegida) return error('Método no permitido.', 405);
  const [, , manejador, conSesion] = elegida;
  if (!conSesion) return manejador(contexto);
  const u = await usuarioActual(request, env);
  if (!u) return error('Tienes que entrar en tu cuenta.', 401, 'sin_sesion');
  return manejador(contexto, u);
}
