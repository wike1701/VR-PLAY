-- Base de datos del foro de sugerencias y de las cuentas de usuario (Cloudflare D1, que es SQLite).
-- Se ejecuta una vez al crear la base de datos (ver "Foro de sugerencias" en el README).
-- Las tablas de las cuentas y las columnas usuario_id las crea también el Worker solo (servidor/bd.js),
-- así que una base de datos que ya existía no necesita nada más.
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
  juego       TEXT NOT NULL DEFAULT '',          -- id del juego del catálogo; mientras no esté hecha, el juego queda en pruebas
  me_gusta    INTEGER NOT NULL DEFAULT 0,
  comentarios INTEGER NOT NULL DEFAULT 0,
  oculta      INTEGER NOT NULL DEFAULT 0,        -- moderación: 1 = no se muestra
  usuario_id  INTEGER,                           -- la cuenta que la envió (NULL: sin cuenta o cuenta borrada)
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
  usuario_id    INTEGER,                         -- la cuenta que lo escribió
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

-- Un "me gusta" por navegador y juego (desde el menú de pausa). El Worker la crea solo si falta.
CREATE TABLE IF NOT EXISTS juegos_me_gusta (
  juego         TEXT NOT NULL,                   -- id del juego del catálogo
  votante       TEXT NOT NULL,                   -- hash del identificador anónimo del navegador
  ip            TEXT NOT NULL DEFAULT '',
  creada        TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (juego, votante)
);
CREATE INDEX IF NOT EXISTS juegos_me_gusta_ip ON juegos_me_gusta (ip, creada);

-- ─── Cuentas de usuario (ver PERFILES.md) ─────────────────────────────────
-- Con cuenta, los "me gusta" se guardan en las mismas tablas, con votante = hash de "cuenta:<id>".

CREATE TABLE IF NOT EXISTS usuarios (
  id              INTEGER PRIMARY KEY AUTOINCREMENT,
  correo          TEXT NOT NULL UNIQUE,              -- en minúsculas; nunca se muestra
  google_id       TEXT UNIQUE,                       -- si ha entrado con Google
  alias           TEXT,                              -- público; NULL hasta que lo elige
  alias_clave     TEXT UNIQUE,                       -- el alias sin mayúsculas, tildes ni caracteres que se confunden
  alias_cambiado  TEXT,                              -- último cambio (se puede cambiar una vez cada 30 días)
  avatar          INTEGER NOT NULL DEFAULT 0,        -- semilla del avatar generado
  anio_nacimiento INTEGER,                           -- edad mínima: 14 años; nunca se muestra
  avisos_correo   INTEGER NOT NULL DEFAULT 1,
  suspendido      INTEGER NOT NULL DEFAULT 0,        -- puede jugar, pero no publicar en el foro
  creada          TEXT NOT NULL DEFAULT (datetime('now')),
  ultimo_acceso   TEXT NOT NULL DEFAULT (datetime('now'))
);

-- Sesiones abiertas (la cookie lleva un token; aquí solo su hash). Duran 90 días y se renuevan al usarlas.
CREATE TABLE IF NOT EXISTS sesiones (
  id          INTEGER PRIMARY KEY AUTOINCREMENT,
  usuario_id  INTEGER NOT NULL REFERENCES usuarios (id),
  token       TEXT NOT NULL UNIQUE,
  dispositivo TEXT NOT NULL DEFAULT '',              -- «Chrome · Windows», para la lista de «Mi cuenta»
  creada      TEXT NOT NULL DEFAULT (datetime('now')),
  usada       TEXT NOT NULL DEFAULT (datetime('now')),
  caduca      TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS sesiones_usuario ON sesiones (usuario_id);

-- Enlaces y códigos para entrar por correo (caducan en 15 minutos y se borran al usarse)
CREATE TABLE IF NOT EXISTS enlaces_acceso (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  correo    TEXT NOT NULL,
  token     TEXT NOT NULL UNIQUE,                    -- hash del token del enlace
  codigo    TEXT NOT NULL,                           -- hash del código de 6 cifras
  intentos  INTEGER NOT NULL DEFAULT 0,              -- códigos equivocados (como mucho 5)
  ip        TEXT NOT NULL DEFAULT '',
  creada    TEXT NOT NULL DEFAULT (datetime('now')),
  caduca    TEXT NOT NULL
);
CREATE INDEX IF NOT EXISTS enlaces_correo ON enlaces_acceso (correo, creada);
CREATE INDEX IF NOT EXISTS enlaces_ip ON enlaces_acceso (ip, creada);

-- Alias que nadie puede coger durante 30 días (después de cambiarlo o de borrar la cuenta)
CREATE TABLE IF NOT EXISTS alias_bloqueados (
  alias_clave TEXT PRIMARY KEY,
  hasta       TEXT NOT NULL
);

CREATE TABLE IF NOT EXISTS favoritos (
  usuario_id INTEGER NOT NULL REFERENCES usuarios (id),
  juego      TEXT NOT NULL,
  creada     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (usuario_id, juego)
);
