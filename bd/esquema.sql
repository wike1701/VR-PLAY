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
CREATE INDEX IF NOT EXISTS sugerencias_usuario ON sugerencias (usuario_id);

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
CREATE INDEX IF NOT EXISTS comentarios_usuario ON comentarios (usuario_id);

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

-- Totales de cada juego ya contados, para no recorrer todos los «me gusta» en cada visita a la portada.
-- Una partida cuenta a los 15 segundos de juego (shell/shell.js).
CREATE TABLE IF NOT EXISTS juegos_estadisticas (
  juego     TEXT PRIMARY KEY,
  me_gusta  INTEGER NOT NULL DEFAULT 0,
  partidas  INTEGER NOT NULL DEFAULT 0
);

-- Para no contar dos veces la misma partida: una por conexión y juego cada 10 minutos (se borran a las 2 horas)
CREATE TABLE IF NOT EXISTS partidas_recientes (
  ip     TEXT NOT NULL,
  juego  TEXT NOT NULL,
  creada TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS partidas_recientes_ip ON partidas_recientes (ip, juego, creada);

-- ─── Cuentas de usuario (ver docs/PERFILES.md) ─────────────────────────────────
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
  listas_ocultas  INTEGER,                           -- ocultar a quién sigue y quién le sigue (NULL: sí si es menor de 18)
  en_clasificaciones     INTEGER,                    -- 0: no sale en las clasificaciones (ajuste de privacidad)
  vetado_clasificaciones INTEGER,                    -- 1: el administrador lo ha sacado de las clasificaciones
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

-- Quién sigue a quién (en un solo sentido, sin tener que aceptar). Los números son públicos.
CREATE TABLE IF NOT EXISTS seguidores (
  seguidor_id INTEGER NOT NULL REFERENCES usuarios (id),
  seguido_id  INTEGER NOT NULL REFERENCES usuarios (id),
  creada      TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (seguidor_id, seguido_id)
);
CREATE INDEX IF NOT EXISTS seguidores_seguido ON seguidores (seguido_id);

-- Clasificaciones (ver juegos/marcadores.js): el mejor resultado de cada cuenta en cada juego, de siempre y del mes
CREATE TABLE IF NOT EXISTS records (
  usuario_id INTEGER NOT NULL REFERENCES usuarios (id),
  juego      TEXT NOT NULL,
  valor      REAL NOT NULL,                          -- puntos, segundos, golpes o diferencia, según el juego
  fecha      TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (usuario_id, juego)
);
CREATE INDEX IF NOT EXISTS records_juego ON records (juego, valor);

CREATE TABLE IF NOT EXISTS records_mes (
  usuario_id INTEGER NOT NULL REFERENCES usuarios (id),
  juego      TEXT NOT NULL,
  mes        TEXT NOT NULL,                          -- 'AAAA-MM'
  valor      REAL NOT NULL,
  fecha      TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (usuario_id, juego, mes)
);
CREATE INDEX IF NOT EXISTS records_mes_juego ON records_mes (juego, mes, valor);

-- Partidas abiertas por el servidor: solo se acepta un resultado de una de ellas (contra trampas)
CREATE TABLE IF NOT EXISTS partidas_abiertas (
  token      TEXT PRIMARY KEY,                       -- hash del token que tiene el navegador
  usuario_id INTEGER NOT NULL,
  juego      TEXT NOT NULL,
  creada     TEXT NOT NULL DEFAULT (datetime('now'))
);
CREATE INDEX IF NOT EXISTS partidas_abiertas_usuario ON partidas_abiertas (usuario_id, creada);

CREATE TABLE IF NOT EXISTS favoritos (
  usuario_id INTEGER NOT NULL REFERENCES usuarios (id),
  juego      TEXT NOT NULL,
  creada     TEXT NOT NULL DEFAULT (datetime('now')),
  PRIMARY KEY (usuario_id, juego)
);

-- Denuncias de sugerencias y comentarios (botón «Denunciar» del foro). Una por conexión y contenido.
-- El administrador las revisa en admin.html: oculta el contenido o la da por revisada. El Worker la crea solo si falta.
CREATE TABLE IF NOT EXISTS denuncias (
  id        INTEGER PRIMARY KEY AUTOINCREMENT,
  tipo      TEXT NOT NULL,                       -- sugerencia | comentario
  objeto_id INTEGER NOT NULL,                    -- id de la sugerencia o del comentario
  motivo    TEXT NOT NULL,                       -- spam | ofensivo | datos_personales | ilegal | otro
  detalle   TEXT NOT NULL DEFAULT '',            -- explicación opcional (hasta 500 caracteres)
  ip        TEXT NOT NULL DEFAULT '',            -- huella de la IP (hash), contra el abuso
  revisada  INTEGER NOT NULL DEFAULT 0,
  creada    TEXT NOT NULL DEFAULT (datetime('now')),
  UNIQUE (tipo, objeto_id, ip)
);
CREATE INDEX IF NOT EXISTS denuncias_pendientes ON denuncias (revisada, tipo, objeto_id);
CREATE INDEX IF NOT EXISTS denuncias_ip ON denuncias (ip, creada);
