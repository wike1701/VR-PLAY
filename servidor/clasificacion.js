// Clasificaciones de los juegos (ver «Clasificaciones» en el README y juegos/marcadores.js).
//   GET  /api/clasificacion/:juego?periodo=siempre|mes&limite=100
//        → { juego, periodo, mes, total, top: [{ puesto, alias, avatar, valor }], tu: { puesto, valor } | null }
//   POST /api/clasificacion/:juego/empezar          → { partida } (abre una partida; con la sesión iniciada)
//   POST /api/clasificacion/:juego { partida, valor } → guarda el resultado si es su mejor
//        → { guardada, mejor, nuevoRecord, puesto, mejorMes, puestoMes }
// Solo cuentan las cuentas con la sesión iniciada. Contra trampas: la puntuación tiene que venir de una
// partida que abrió el servidor, haber durado lo mínimo del juego y estar dentro de sus valores posibles.
// No se puede impedir del todo (el juego corre en el navegador), pero sí hacerlo poco rentable; el
// administrador puede además borrar récords y sacar a una cuenta de las clasificaciones.
import { MARCADORES, mejorQue } from '../juegos/marcadores.js';
import { json, error, leerJson, sha256 } from './comun.js';
import { usuarioActual, aleatorio } from './sesion.js';

const PARTIDAS_POR_HORA = 300;
const HORAS_PARTIDA = 3; // una partida abierta caduca a las 3 horas

// Cuentas que salen en las clasificaciones
export const VISIBLE = 'u.alias IS NOT NULL AND u.suspendido = 0 AND COALESCE(u.en_clasificaciones, 1) = 1 AND COALESCE(u.vetado_clasificaciones, 0) = 0';
const mesActual = () => new Date().toISOString().slice(0, 7);
const hashToken = (token, env) => sha256(`${env.SAL || 'vrplay'}:partida:${token}`);

// Puesto de un valor en un juego: 1 + cuántos lo superan (los empates comparten puesto)
export function consultaPuesto(env, juego, valor, mes = null) {
  const m = MARCADORES[juego];
  const tabla = mes ? 'records_mes' : 'records';
  return env.DB.prepare(
    `SELECT COUNT(*) + 1 AS puesto FROM ${tabla} r JOIN usuarios u ON u.id = r.usuario_id
     WHERE r.juego = ? ${mes ? 'AND r.mes = ?' : ''} AND r.valor ${m.orden === 'menor' ? '<' : '>'} ? AND ${VISIBLE}`,
  ).bind(...[juego, ...(mes ? [mes] : []), valor]);
}

export async function atender({ request, env, params }) {
  if (!env.DB) return error('Las clasificaciones no están disponibles ahora mismo.', 503, 'no_disponible');
  const juego = params.id;
  if (!Object.hasOwn(MARCADORES, juego || '')) return error('Juego no encontrado.', 404, 'juego_no_encontrado');
  if (request.method === 'GET' && !params.sub) return lista(request, env, juego);
  if (request.method === 'POST' && params.sub === 'empezar') return empezar(request, env, juego);
  if (request.method === 'POST' && !params.sub) return puntuar(request, env, juego);
  return error('Método no permitido.', 405);
}

async function lista(request, env, juego) {
  const url = new URL(request.url);
  const mes = url.searchParams.get('periodo') === 'mes' ? mesActual() : null;
  const limite = Math.min(100, Math.max(1, Number(url.searchParams.get('limite')) || 100));
  const m = MARCADORES[juego];
  const tabla = mes ? 'records_mes' : 'records';
  const filtroMes = mes ? 'AND r.mes = ?' : '';
  const valores = [juego, ...(mes ? [mes] : [])];
  const yo = await usuarioActual(request, env);

  const [top, total, mio] = await env.DB.batch([
    env.DB.prepare(
      `SELECT u.alias, u.avatar, r.valor FROM ${tabla} r JOIN usuarios u ON u.id = r.usuario_id
       WHERE r.juego = ? ${filtroMes} AND ${VISIBLE}
       ORDER BY r.valor ${m.orden === 'menor' ? 'ASC' : 'DESC'}, r.fecha ASC, r.usuario_id ASC LIMIT ${limite}`,
    ).bind(...valores),
    env.DB.prepare(`SELECT COUNT(*) AS n FROM ${tabla} r JOIN usuarios u ON u.id = r.usuario_id WHERE r.juego = ? ${filtroMes} AND ${VISIBLE}`).bind(...valores),
    env.DB.prepare(`SELECT r.valor FROM ${tabla} r WHERE r.juego = ? ${filtroMes} AND r.usuario_id = ?`).bind(...valores, yo?.id || 0),
  ]);

  // Puestos con empates: el mismo valor, el mismo puesto
  let puesto = 0;
  let anterior = null;
  const filas = top.results.map((f, i) => {
    if (f.valor !== anterior) puesto = i + 1;
    anterior = f.valor;
    return { puesto, alias: f.alias, avatar: f.avatar, valor: f.valor };
  });
  let tu = null;
  if (yo && mio.results.length) {
    const valor = mio.results[0].valor;
    const { results } = await consultaPuesto(env, juego, valor, mes).all();
    tu = { puesto: results[0].puesto, valor, visible: !!yo.alias && !yo.suspendido && yo.en_clasificaciones !== 0 && !yo.vetado_clasificaciones };
  }
  return json({ juego, periodo: mes ? 'mes' : 'siempre', mes: mesActual(), orden: m.orden, unidad: m.unidad, total: total.results[0].n, top: filas, tu });
}

async function empezar(request, env, juego) {
  const yo = await usuarioActual(request, env);
  if (!yo?.alias) return error('Tienes que entrar en tu cuenta.', 401, 'sin_sesion');
  const fila = await env.DB.prepare("SELECT COUNT(*) AS n FROM partidas_abiertas WHERE usuario_id = ? AND creada > datetime('now', '-1 hour')").bind(yo.id).first();
  if (fila.n >= PARTIDAS_POR_HORA) return error('Demasiadas partidas seguidas.', 429, 'limite_partidas');
  const token = aleatorio(18);
  const consultas = [
    env.DB.prepare('INSERT INTO partidas_abiertas (token, usuario_id, juego) VALUES (?, ?, ?)').bind(await hashToken(token, env), yo.id, juego),
  ];
  if (Math.random() < 0.05) consultas.push(env.DB.prepare(`DELETE FROM partidas_abiertas WHERE creada < datetime('now', '-${HORAS_PARTIDA} hours')`));
  await env.DB.batch(consultas);
  return json({ partida: token });
}

async function puntuar(request, env, juego) {
  const yo = await usuarioActual(request, env);
  if (!yo?.alias) return error('Tienes que entrar en tu cuenta.', 401, 'sin_sesion');
  const datos = await leerJson(request);
  const valor = Number(datos?.valor);
  if (typeof datos?.partida !== 'string' || datos.partida.length > 64 || !Number.isFinite(valor)) return error('Datos no válidos.', 400, 'datos');
  const m = MARCADORES[juego];

  // La partida tiene que ser suya, de este juego y estar abierta. Se gasta al usarla.
  const hash = await hashToken(datos.partida, env);
  const partida = await env.DB.prepare(
    `SELECT (julianday('now') - julianday(creada)) * 86400 AS segundos FROM partidas_abiertas
     WHERE token = ? AND usuario_id = ? AND juego = ? AND creada > datetime('now', '-${HORAS_PARTIDA} hours')`,
  ).bind(hash, yo.id, juego).first();
  if (!partida) return error('Partida no válida.', 400, 'partida_no_valida');
  await env.DB.prepare('DELETE FROM partidas_abiertas WHERE token = ?').bind(hash).run();

  const duracion = partida.segundos;
  const valida = valor >= m.min && valor <= m.max
    && duracion >= m.minSegundos
    && (!m.maxPorSegundo || valor <= m.maxPorSegundo * duracion + 10)
    && (m.unidad !== 'tiempo' || valor <= duracion + 1)
    && (m.unidad === 'tiempo' || Number.isInteger(valor));
  if (!valida) {
    console.warn(`Puntuación rechazada: ${juego} ${valor} en ${duracion.toFixed(1)} s (cuenta ${yo.id})`);
    return json({ guardada: false });
  }
  const redondeado = m.unidad === 'tiempo' ? Math.round(valor * 100) / 100 : valor;

  // El mejor de siempre y el del mes: solo se cambia si mejora
  const mes = mesActual();
  const mejor = m.orden === 'menor' ? '<' : '>';
  const anterior = await env.DB.prepare('SELECT valor FROM records WHERE usuario_id = ? AND juego = ?').bind(yo.id, juego).first();
  const [, , siempre, delMes] = await env.DB.batch([
    env.DB.prepare(`INSERT INTO records (usuario_id, juego, valor) VALUES (?, ?, ?)
      ON CONFLICT (usuario_id, juego) DO UPDATE SET valor = excluded.valor, fecha = datetime('now') WHERE excluded.valor ${mejor} records.valor`)
      .bind(yo.id, juego, redondeado),
    env.DB.prepare(`INSERT INTO records_mes (usuario_id, juego, mes, valor) VALUES (?, ?, ?, ?)
      ON CONFLICT (usuario_id, juego, mes) DO UPDATE SET valor = excluded.valor, fecha = datetime('now') WHERE excluded.valor ${mejor} records_mes.valor`)
      .bind(yo.id, juego, mes, redondeado),
    env.DB.prepare('SELECT valor FROM records WHERE usuario_id = ? AND juego = ?').bind(yo.id, juego),
    env.DB.prepare('SELECT valor FROM records_mes WHERE usuario_id = ? AND juego = ? AND mes = ?').bind(yo.id, juego, mes),
  ]);
  const mejorValor = siempre.results[0].valor;
  const mejorMes = delMes.results[0].valor;
  const [puesto, puestoMes] = await env.DB.batch([consultaPuesto(env, juego, mejorValor), consultaPuesto(env, juego, mejorMes, mes)]);
  return json({
    guardada: true,
    mejor: mejorValor,
    nuevoRecord: !anterior || mejorQue(m, redondeado, anterior.valor),
    puesto: puesto.results[0].puesto,
    mejorMes,
    puestoMes: puestoMes.results[0].puesto,
  });
}
