# Estructura del proyecto

Mapa de carpetas y normas para saber **dónde va cada cosa** en VR Play. El `README.md` explica cómo funciona
cada parte (la API `ctx`, idiomas, clasificaciones, cuentas…); este documento dice dónde está y dónde se pone
lo nuevo. Se comprueba con `node herramientas/estructura.mjs`.

## 1. Visión general

VR Play son dos programas en un mismo repositorio, desplegados juntos en un Worker de Cloudflare
(`wrangler.jsonc`):

- **La web**: archivos estáticos (HTML y módulos JavaScript), sin paso de compilación. Lo que hay en el
  repositorio es exactamente lo que se publica, menos lo que excluye `.assetsignore`. three.js se carga
  desde la CDN de jsDelivr (versión fija 0.160.0) con el `importmap` de cada página.
- **El servidor** (`servidor/`): solo atiende `/api/*`. Guarda los datos en Cloudflare D1.

La organización es **por capas**, y dentro de los juegos, **por funcionalidad** (una carpeta por juego):

```
páginas (raíz)  ──►  shell/  ──►  juegos/<id>/
     │                 │              │
     └────────►  idiomas/  ◄──────────┘
                      ▲
servidor/  ───────────┴──►  juegos/marcadores.js, idiomas/es.js
```

- Las **páginas** usan la **shell** (el código común del navegador) y los **idiomas**.
- Los **juegos** solo hablan con la shell a través de `ctx` (nunca importan nada de `shell/` ni de otro juego).
- El **servidor** comparte con el navegador solo datos: los marcadores (`juegos/marcadores.js`) y los textos
  originales (`idiomas/es.js`, para saber qué juegos existen).

## 2. Árbol de carpetas

```
VR-PLAY/
├── *.html                  Páginas públicas (su dirección no se cambia: ver §4)
├── favicon.svg, manifest.webmanifest
├── iconos/                 Iconos PNG de la app instalada
├── estilos/                Hojas de estilo compartidas entre páginas
├── shell/                  Código común del navegador (VR, juegos, cuenta, idiomas en uso…)
├── juegos/
│   ├── catalogo.js         Lista de juegos y su género
│   ├── marcadores.js       Cómo puntúa cada juego (lo usan navegador y servidor)
│   └── <id>/               Un juego: juego.js + miniatura.svg (y nada más)
├── idiomas/
│   ├── detectar.js, idiomas.js   Elegir idioma y traducir
│   ├── <código>.js         Todos los textos de un idioma (es.js es el original)
│   └── legal/<código>.html Texto legal traducido (se inserta en legal.html)
├── servidor/               API del Worker (/api/*), index.js reparte las rutas
├── bd/esquema.sql          Tablas de la base de datos (D1)
├── herramientas/           Scripts de terminal (Node) y la guía de la rutina diaria
├── docs/                   Documentos de diseño y planificación (no se publican)
├── .claude/skills/         Skills de Claude Code del proyecto (no se publican)
├── README.md, CLAUDE.md    Documentación principal e instrucciones para Claude
├── wrangler.jsonc          Configuración de Cloudflare
└── .assetsignore, .gitignore
```

## 3. Cada carpeta

| Carpeta | Qué hay | Normas |
|---|---|---|
| **raíz** | Las 9 páginas: `index` (portada), `play` (la shell VR), `foro`, `clasificacion`, `perfil`, `entrar`, `cuenta`, `legal` y `admin` | Solo páginas, configuración y documentos principales. Cada página lleva su CSS propio dentro; si es compartido, va en `estilos/`. |
| **`shell/`** | `shell.js` (motor VR y cambio de juego), `boton-cambio.js`, `menu-pausa.js`, `graficos.js`, `efectos.js`, `sonido.js`, `utilidades.js`, `pantalla-completa.js`, y los módulos que usan también las páginas: `cuenta.js`, `valoraciones.js`, `clasificacion.js`, `en-pruebas.js` | Código del navegador que comparten varias páginas o juegos. Un archivo por responsabilidad. |
| **`juegos/<id>/`** | `juego.js` (exporta `precargar` e `iniciar(ctx)`) y `miniatura.svg` | Todo el juego en su carpeta. Sin textos escritos a mano (van en `idiomas/`) y sin imports de `shell/`. |
| **`juegos/`** (sueltos) | `catalogo.js` y `marcadores.js` | Solo datos de los juegos. El código va en `shell/`. |
| **`idiomas/`** | Un archivo por idioma con **las mismas claves** que `es.js`; `legal/` con el texto legal traducido | Cualquier texto visible nuevo se añade aquí, en los 9 idiomas. |
| **`estilos/`** | `base.css` (el sistema de diseño: colores, fuentes y logo de toda la web) y `cuenta.css` (entrar, cuenta, perfil y clasificación) | CSS que usa más de una página. Los colores y las fuentes **solo** se definen en `base.css`: las páginas usan sus variables (`var(--accent)`, `var(--font-body)`…) y no escriben colores a mano. |
| **`servidor/`** | `index.js` (rutas), `comun.js` y `bd.js` (utilidades y tablas), y un archivo por recurso de la API | Un archivo por ruta o grupo de rutas, que exporta `onRequestGet`, `onRequestPost`… |
| **`bd/`** | `esquema.sql` | Todas las tablas. `servidor/bd.js` crea las nuevas solo, la primera vez. |
| **`herramientas/`** | `foro.mjs`, `idiomas.mjs`, `marcadores.mjs`, `estructura.mjs`, `calidad.mjs`, `foro.json`, `rutina-foro.md` | Scripts que se ejecutan con `node herramientas/<x>.mjs`. No se publican. **No muevas `rutina-foro.md`**: la rutina diaria de la nube lo tiene escrito en sus instrucciones. |
| **`docs/`** | `ESTRUCTURA.md` (este), `CALIDAD.md` (estándar de calidad y rendimiento de los juegos), `PERFILES.md` (especificación de cuentas), `LANZAMIENTO.md` (lista de lanzamiento) | Documentos de diseño, especificaciones y planes. No se publican. |
| **`.claude/skills/`** | Skills de terceros con su licencia y un `README.md` | Ver ese README antes de añadir una. |

### El servidor por grupos

Todos los archivos están en `servidor/`, sin subcarpetas. Por grupos:

- **Base**: `index.js` (reparte las rutas), `comun.js` (respuestas, límites, huellas), `bd.js` (tablas), `config.js` (`/api/config`).
- **Foro**: `sugerencias.js`, `sugerencia.js`, `comentarios.js`, `comentario.js`, `me-gusta.js`, `juegos-en-pruebas.js`.
- **Juegos**: `juegos-me-gusta.js` (me gusta, partidas y estadísticas), `clasificacion.js`.
- **Cuentas**: `cuenta.js`, `sesion.js`, `google.js`, `correo.js`, `perfiles.js` (perfiles, seguir y feed), `admin-usuarios.js`.

## 4. Dónde va cada cosa nueva

| Quiero añadir… | Va en… | Y además… |
|---|---|---|
| Un **juego** | `juegos/<id>/juego.js` y `juegos/<id>/miniatura.svg` | Su línea en `juegos/catalogo.js` y `juegos/marcadores.js`, sus textos en **todos** los `idiomas/*.js` (`juegos.<id>`), su línea en el README. Ver «Añadir un juego nuevo» del README y `CLAUDE.md`. |
| Una **página** | `<nombre>.html` en la raíz | Con `idiomas/detectar.js` en el `<head>`, sus textos en `idiomas/`, y su `hreflang` si es pública. Su nombre **no se cambia después**: es su dirección pública. |
| **CSS compartido** | `estilos/<nombre>.css` | Enlazado con `href="estilos/<nombre>.css"`. |
| Código del navegador **para varias páginas o juegos** | `shell/<nombre>.js` | Si es para los juegos, que llegue a través de `ctx` (en `shell/shell.js`). |
| Un **sonido** | `shell/sonido.js` (sintetizado) | Sin archivos de audio. |
| Un **texto visible** | `idiomas/es.js` y los otros 8 | Pedirlo con `t('clave')` o `ctx.t('clave')`. |
| Una **ruta de la API** | `servidor/<recurso>.js` | Registrarla en `RUTAS` de `servidor/index.js`. |
| Una **tabla** | `bd/esquema.sql` | Y en `servidor/bd.js`, para que se cree sola. |
| Un **script de terminal** | `herramientas/<nombre>.mjs` | Su uso en el README. |
| Un **documento** de diseño o plan | `docs/<NOMBRE>.md` | En mayúsculas, como los demás. |
| Un **secreto** | Nunca en el repositorio | En Cloudflare (*Variables and Secrets*) o en `.dev.vars` para probar en local (está en `.gitignore`). |

## 5. Nombres

- **Todo en español**: carpetas, archivos, funciones, variables, comentarios y commits (`juegos/`, `herramientas/`, `crearPanel`, `moverBalon`).
- **Archivos y carpetas**: minúsculas, sin tildes, con guiones si hacen falta (`menu-pausa.js`, `juegos-me-gusta.js`, `boton-cambio.js`).
- **Juegos**: carpeta = `id` del catálogo, una palabra corta en minúsculas (`topos`, `pingpong`, `tirapichon`). El archivo siempre se llama `juego.js` y la miniatura `miniatura.svg`.
- **Idiomas**: código de dos letras (`es.js`, `en.js`, `legal/fr.html`).
- **Páginas**: un sustantivo o verbo corto (`foro`, `perfil`, `entrar`, `clasificacion`).
- **Documentos**: en mayúsculas (`README.md`, `CLAUDE.md`, `docs/PERFILES.md`).
- **Código**: funciones y variables en camelCase, constantes de ajuste en MAYÚSCULAS al principio del archivo (`VELOCIDAD_MAX`, `TIEMPO_AYUDA`).
- **Rutas de la API**: `/api/<recurso>` en minúsculas y en español (`/api/sugerencias`, `/api/clasificacion/:juego`).

## 6. Para orientarse

- **Empezar por**: `README.md` → `juegos/catalogo.js` → `shell/shell.js` (cómo se monta un juego) → un juego sencillo, como `juegos/topos/juego.js`.
- **La web publicada** empieza en `index.html`; el juego, en `play.html`, que carga `shell/shell.js`.
- **El servidor** empieza en `servidor/index.js`, que reparte cada `/api/…` a su archivo.
- **Medir un juego**: `vrPlay.dibujado()` en la consola del navegador.

### Tamaño aproximado (octubre de 2026)

| Parte | Líneas |
|---|---|
| `juegos/` (22 juegos) | ~16.000 |
| `idiomas/` (9 idiomas) | ~10.000 |
| Páginas de la raíz | ~3.400 |
| `shell/` | ~2.700 |
| `servidor/` | ~1.800 |

## 7. Publicación

- **Sin compilación**: al subir a `main`, Cloudflare ejecuta `npx wrangler deploy`, que publica los archivos de la raíz como web y `servidor/index.js` como API.
- **Lo que no se publica** está en `.assetsignore`: `servidor/`, `bd/`, `herramientas/`, `docs/`, `.claude/`, los `.md` principales y la configuración. Si añades una carpeta que no debe verse en la web, añádela ahí.
- **En local**: `npx wrangler dev` (web + API) o cualquier servidor de archivos (solo la web; el foro y las cuentas dirán que no están disponibles).

## 8. Cómo se mantiene ordenado

Antes de subir cambios, pasa las comprobaciones:

```
node herramientas/estructura.mjs    # juegos completos, raíz limpia y ninguna ruta rota
node herramientas/idiomas.mjs       # los 9 idiomas con los mismos textos
node herramientas/marcadores.mjs    # todos los juegos con clasificación
node herramientas/calidad.mjs       # estándar de calidad y rendimiento de los juegos
```

`estructura.mjs` falla si un juego del catálogo no tiene carpeta, `juego.js` o miniatura, si sobra una carpeta
en `juegos/`, si aparece un archivo inesperado en la raíz o si un `import`, `src` o `href` local apunta a un
archivo que no existe. Al mover un archivo, es lo que avisa de los enlaces que quedan rotos.

## 9. Mejoras pendientes

- **Subcarpetas en `servidor/`** (`foro/`, `cuentas/`, `juegos/`), siguiendo los grupos de §3. Se deja para cuando
  no haya trabajo en marcha en el servidor: mover sus archivos haría chocar los cambios de quien lo esté tocando.
- **Estilos comunes**: los colores y las fuentes ya están en `estilos/base.css`. Falta sacar ahí también lo que repiten las páginas (cabecera, botones, selector de idioma).


## 10. Historial de este documento

- **2026-10-13**: primera versión. Se crean `docs/` (con `LANZAMIENTO.md` y `PERFILES.md`, que estaban en la raíz) y
  `estilos/` (con `cuenta.css`), `en-pruebas.js` pasa de `juegos/` a `shell/` (es código del navegador, no un juego)
  y se añade `herramientas/estructura.mjs`.

Si cambias la organización, actualiza este documento y `herramientas/estructura.mjs` en el mismo commit.
