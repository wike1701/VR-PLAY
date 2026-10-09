-- Base de datos del foro de sugerencias (Cloudflare D1, que es SQLite).
-- Se ejecuta una vez al crear la base de datos (ver "Foro de sugerencias" en el README).
-- Las fechas se guardan en UTC con el formato de SQLite: 'AAAA-MM-DD HH:MM:SS'.

CREATE TABLE IF NOT EXISTS sugerencias (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  titulo      TEXT NOT NULL,
  descripcion TEXT NOT NULL,
  manos       TEXT NOT NULL DEFAULT '',          -- qué llevas en las manos (bate, pistola...)
  accion      TEXT NOT NULL DEFAULT '',          -- qué haces (golpear, lanzar, esquivar...)
  tipo        TEXT NOT NULL DEFAULT '',          -- género (Deportes, Disparos...)
  autor       TEXT NOT NULL DEFAULT 'Anónimo',
  estado      TEXT NOT NULL DEFAULT 'nueva',     -- nueva | estudio | desarrollo | hecha | existe | descartada
  juego       TEXT NOT NULL DEFAULT '',          -- id del juego del catálogo (si está hecha o ya existe)
  me_gusta    INTEGER NOT NULL DEFAULT 0,
  comentarios INTEGER NOT NULL DEFAULT 0,
  oculta      INTEGER NOT NULL DEFAULT 0,        -- moderación: 1 = no se muestra
  ip          TEXT NOT NULL DEFAULT '',          -- huella de la IP (hash), solo para limitar el spam
  creada      TEXT NOT NULL DEFAULT (datetime('now')),
  actividad   TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS sugerencias_votos ON sugerencias (oculta, me_gusta DESC);
CREATE INDEX IF NOT EXISTS sugerencias_ip ON sugerencias (ip, creada);

CREATE TABLE IF NOT EXISTS comentarios (
  id            INTEGER PRIMARY KEY AUTOINCREMENT,
  sugerencia_id INTEGER NOT NULL REFERENCES sugerencias (id),
  texto         TEXT NOT NULL,
  autor         TEXT NOT NULL DEFAULT 'Anónimo',
  oficial       INTEGER NOT NULL DEFAULT 0,      -- respuesta de VR Play
  anclado       INTEGER NOT NULL DEFAULT 0,      -- se muestra arriba del hilo (solo uno por hilo)
  oculto        INTEGER NOT NULL DEFAULT 0,
  ip            TEXT NOT NULL DEFAULT '',
  creada        TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS comentarios_hilo ON comentarios (sugerencia_id, creada);
CREATE INDEX IF NOT EXISTS comentarios_ip ON comentarios (ip, creada);

-- Un "me gusta" por navegador y sugerencia
CREATE TABLE IF NOT EXISTS me_gusta (
  sugerencia_id INTEGER NOT NULL REFERENCES sugerencias (id),
  votante       TEXT NOT NULL,                   -- hash del identificador anónimo del navegador
  ip            TEXT NOT NULL DEFAULT '',
  creada        TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (sugerencia_id, votante)
);
CREATE INDEX IF NOT EXISTS me_gusta_votante ON me_gusta (votante);
CREATE INDEX IF NOT EXISTS me_gusta_ip ON me_gusta (ip, creada);
