// Tablas de las cuentas de usuario. El Worker las crea solas la primera vez (también están en
// bd/esquema.sql), así no hay que ejecutar nada a mano al desplegar. Los cambios solo añaden:
// nunca se borra ni se renombra nada, para que una versión anterior de la web siga funcionando.

const TABLAS = [
  `CREATE TABLE IF NOT EXISTS usuarios (
    id INTEGER PRIMARY KEY AUTOINCREMENT,
    correo TEXT NOT NULL UNIQUE, google_id TEXT UNIQUE,
    alias TEXT, alias_clave TEXT UNIQUE, alias_cambiado TEXT,
    avatar INTEGER NOT NULL DEFAULT 0, anio_nacimiento INTEGER,
    avisos_correo INTEGER NOT NULL DEFAULT 1, suspendido INTEGER NOT NULL DEFAULT 0, listas_ocultas INTEGER,
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
  // La del foro que se crea sola (ver juegos-me-gusta.js): aquí también, porque al fusionar se usa
  `CREATE TABLE IF NOT EXISTS juegos_me_gusta (
    juego TEXT NOT NULL, votante TEXT NOT NULL, ip TEXT NOT NULL DEFAULT '',
    creada TEXT NOT NULL DEFAULT (datetime('now')), PRIMARY KEY (juego, votante))`,
];

// Columnas nuevas en tablas que ya existían: [tabla, columna, definición]
const COLUMNAS = [
  ['sugerencias', 'usuario_id', 'INTEGER'],
  ['comentarios', 'usuario_id', 'INTEGER'],
  ['usuarios', 'listas_ocultas', 'INTEGER'],
];

let lista = null;

async function preparar(env) {
  await env.DB.batch(TABLAS.map((sql) => env.DB.prepare(sql)));
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
}

// Se ejecuta una vez por instancia del Worker (antes de atender la primera petición a la API)
export function prepararBD(env) {
  lista ||= preparar(env).catch((e) => {
    lista = null;
    throw e;
  });
  return lista;
}
