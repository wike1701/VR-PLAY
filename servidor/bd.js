// Tablas de las cuentas de usuario y de las estadísticas de los juegos. El Worker las crea solas la primera vez (también están en
// bd/esquema.sql), así no hay que ejecutar nada a mano al desplegar. Los cambios solo añaden:
// nunca se borra ni se renombra nada, para que una versión anterior de la web siga funcionando.

const TABLAS = [
  `CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    correo TEXT NOT NULL UNIQUE, google_id TEXT UNIQUE,
    alias TEXT, alias_clave TEXT UNIQUE, alias_cambiado TEXT,
    avatar INTEGER NOT NULL DEFAULT 0, anio_nacimiento INTEGER,
    avisos_correo INTEGER NOT NULL DEFAULT 1, suspendido INTEGER NOT NULL DEFAULT 0, listas_ocultas INTEGER,
    en_clasificaciones INTEGER, vetado_clasificaciones INTEGER,
    creada TEXT NOT NULL DEFAULT (datetime('now')), ultimo_acceso TEXT NOT NULL DEFAULT (datetime('now')))`,
  `CREATE TABLE IF NOT EXISTS sesiones (
    id INTEGER PRIMARY KEY AUTOINCREMENT, usuario_id INTEGER NOT NULL REFERENCES usuarios (id),
    token TEXT NOT NULL UNIQUE, dispositivo TEXT NOT NULL DEFAULT '',
    creada TEXT NOT NULL DEFAULT (datetime('now')), usada TEXT NOT NULL DEFAULT (datetime('now')), caduca TEXT NOT NULL)`,
  'CREATE INDEX IF NOT EXISTS sesiones_usuario ON sesiones (usuario_id)',
  `CREATE TABLE IF NOT EXISTS enlaces_acceso (
    id INTEGER PRIMARY KEY AUTOINCREMENT, correo TEXT NOT NULL,
    token TEXT NOT NULL UNIQUE, codigo TEXT NOT NULL, intentos INTEGER NOT NULL DEFAULT 0,
    ip TEXT NOT NULL DEFAULT '', creada TEXT NOT NULL DEFAULT (datetime('now')), caduca TEXT NOT NULL)`,
  'CREATE INDEX IF NOT EXISTS enlaces_correo ON enlaces_acceso (correo, creada)',
  'CREATE INDEX IF NOT EXISTS enlaces_ip ON enlaces_acceso (ip, creada)',
  `CREATE TABLE IF NOT EXISTS alias_bloqueados (
    alias_clave TEXT PRIMARY KEY, hasta TEXT NOT NULL)`,
  `CREATE TABLE IF NOT EXISTS favoritos (
    usuario_id INTEGER NOT NULL REFERENCES usuarios (id), juego TEXT NOT NULL,
    creada TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (usuario_id, juego))`,
  // Quién sigue a quién (en un solo sentido, sin tener que aceptar)
  `CREATE TABLE IF NOT EXISTS seguidores (
    seguidor_id INTEGER NOT NULL REFERENCES usuarios (id), seguido_id INTEGER NOT NULL REFERENCES usuarios (id),
    creada TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (seguidor_id, seguido_id))`,
  'CREATE INDEX IF NOT EXISTS seguidores_seguido ON seguidores (seguido_id)',
  // Clasificaciones: el mejor resultado de cada cuenta en cada juego, de siempre y de cada mes
  `CREATE TABLE IF NOT EXISTS records (
    usuario_id INTEGER NOT NULL REFERENCES usuarios (id), juego TEXT NOT NULL, valor REAL NOT NULL,
    fecha TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (usuario_id, juego))`,
  'CREATE INDEX IF NOT EXISTS records_juego ON records (juego, valor)',
  `CREATE TABLE IF NOT EXISTS records_mes (
    usuario_id INTEGER NOT NULL REFERENCES usuarios (id), juego TEXT NOT NULL, mes TEXT NOT NULL, valor REAL NOT NULL,
    fecha TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (usuario_id, juego, mes))`,
  'CREATE INDEX IF NOT EXISTS records_mes_juego ON records_mes (juego, mes, valor)',
  // Partidas abiertas: el servidor solo acepta una puntuación de una partida que abrió él (contra trampas)
  `CREATE TABLE IF NOT EXISTS partidas_abiertas (
    token TEXT PRIMARY KEY, usuario_id INTEGER NOT NULL, juego TEXT NOT NULL, creada TEXT NOT NULL DEFAULT (datetime('now')))`,
  'CREATE INDEX IF NOT EXISTS partidas_abiertas_usuario ON partidas_abiertas (usuario_id, creada)',
  // «Me gusta» de los juegos (uno por navegador o cuenta)
  `CREATE TABLE IF NOT EXISTS juegos_me_gusta (
    juego TEXT NOT NULL, votante TEXT NOT NULL, ip TEXT NOT NULL DEFAULT '',
    creada TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (juego, votante))`,
  'CREATE INDEX IF NOT EXISTS juegos_me_gusta_ip ON juegos_me_gusta (ip, creada)',
  `CREATE TABLE IF NOT EXISTS juegos_estadisticas (
    juego TEXT PRIMARY KEY, me_gusta INTEGER NOT NULL DEFAULT 0, partidas INTEGER NOT NULL DEFAULT 0)`,
  // Para no contar dos veces la misma partida (se borran a las 2 horas)
  `CREATE TABLE IF NOT EXISTS partidas_recientes (
    ip TEXT NOT NULL, juego TEXT NOT NULL, creada TEXT NOT NULL DEFAULT (datetime('now')))`,
  'CREATE INDEX IF NOT EXISTS partidas_recientes_ip ON partidas_recientes (ip, juego, creada)',
];

// Índices que necesitan las columnas nuevas (se crean después de añadirlas)
const INDICES = [
  'CREATE INDEX IF NOT EXISTS sugerencias_usuario ON sugerencias (usuario_id)',
  'CREATE INDEX IF NOT EXISTS comentarios_usuario ON comentarios (usuario_id)',
];

// Columnas nuevas en tablas que ya existían: [tabla, columna, definición]
const COLUMNAS = [
  ['sugerencias', 'usuario_id', 'INTEGER'],
  ['comentarios', 'usuario_id', 'INTEGER'],
  ['usuarios', 'listas_ocultas', 'INTEGER'],
  ['usuarios', 'en_clasificaciones', 'INTEGER'],    // NULL o 1: sale en las clasificaciones; 0: no (ajuste de privacidad)
  ['usuarios', 'vetado_clasificaciones', 'INTEGER'], // 1: el administrador lo ha sacado de las clasificaciones
];

let lista = null;

async function preparar(env) {
  // Totales de cada juego ya contados («me gusta» y partidas). La primera vez se rellena con los
  // «me gusta» que ya había; después los mantienen al día servidor/juegos-me-gusta.js y cuenta.js.
  const habiaEstadisticas = await env.DB.prepare("SELECT 1 FROM sqlite_master WHERE type = 'table' AND name = 'juegos_estadisticas'").first();
  await env.DB.batch(TABLAS.map((sql) => env.DB.prepare(sql)));
  if (!habiaEstadisticas) {
    await env.DB.prepare(`INSERT INTO juegos_estadisticas (juego, me_gusta) SELECT juego, COUNT(*) FROM juegos_me_gusta GROUP BY juego
      ON CONFLICT (juego) DO UPDATE SET me_gusta = excluded.me_gusta`).run();
  }
  for (const [tabla, columna, definicion] of COLUMNAS) {
    const { results } = await env.DB.prepare(`PRAGMA table_info(${tabla})`).all();
    if (!results.length || results.some((c) => c.name === columna)) continue;
    try {
      await env.DB.prepare(`ALTER TABLE ${tabla} ADD COLUMN ${columna} ${definicion}`).run();
    } catch (e) {
      // Otra petición la ha añadido a la vez
      if (!/duplicate column/i.test(String(e?.message))) throw e;
    }
  }
  const tablas = (await env.DB.prepare("SELECT name FROM sqlite_master WHERE type = 'table'").all()).results.map((f) => f.name);
  const indices = INDICES.filter((sql) => tablas.includes(sql.match(/ON (\w+)/)[1]));
  if (indices.length) await env.DB.batch(indices.map((sql) => env.DB.prepare(sql)));
}

// Se ejecuta una vez por instancia del Worker (antes de atender la primera petición a la API)
export function prepararBD(env) {
  lista ||= preparar(env).catch((e) => {
    lista = null;
    throw e;
  });
  return lista;
}
