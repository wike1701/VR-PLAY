# Lanzamiento de VR Play: lista de comprobación

Marca cada punto con `[x]` cuando esté hecho. Los bloques van por orden de prioridad.

## 1. Legal (antes de anunciar la web)

- [x] Decidir el titular de la web y un correo de contacto: Rafael Ruiz Huertas y Miguel Ángel Hernicas Esquinas, `contact@vrplaygame.com` (Cloudflare Email Routing). Sin NIF ni domicilio mientras la web no tenga ingresos
- [ ] **Antes de poner anuncios o tener cualquier ingreso:** añadir a `legal.html` el NIF y un domicilio (puede ser una domiciliación), un banner de consentimiento de cookies y la red de anuncios en la política de privacidad
- [ ] Rellenar en `legal.html` el servicio de envío de correos cuando se elija
- [x] Página de **aviso legal** con los datos del titular (LSSI)
- [x] Página de **política de privacidad** (RGPD): qué se guarda (foro, huella de IP, almacenamiento del navegador), para qué, cuánto tiempo y cómo pedir que se borre
- [x] Página de **cookies**, o una nota que diga que no se usan, si sigue sin haberlas
- [x] Página de **contacto**
- [x] Enlazar las páginas legales en el pie de `index.html` y `foro.html` (todo está en `legal.html`)
- [ ] Servir las fuentes desde la propia web, en vez de cargarlas desde Google Fonts (envía la IP a Google)
- [x] Ocultar el hueco «Espacio publicitario» hasta que haya anuncios (en `index.html`, con `hidden`; al poner anuncios, quitarlo y añadir el banner de consentimiento)
- [ ] **Normas del foro** visibles junto al formulario
- [ ] Botón **«Denunciar»** en sugerencias y comentarios (con su tabla y una sección en `admin.html`)
- [ ] Edad mínima indicada (14 años en España para dar el consentimiento uno mismo)
- [ ] Aviso de seguridad en VR antes de jugar: espacio libre a tu alrededor y bajo tu responsabilidad (el texto ya está en `legal.html`; falta mostrarlo al entrar en VR)

## 2. Estabilidad (que no se rompa)

- [ ] La rutina diaria trabaja en una rama y abre un PR, en vez de subir directamente a `main`
- [ ] Guardar en el repositorio el test que simula partidas con un `ctx` falso (`herramientas/probar.mjs`)
- [ ] CI con GitHub Actions: `node --check` de todos los JS y una partida simulada de cada juego en cada PR
- [ ] Proteger `main`: solo se fusiona con la CI en verde
- [ ] Entorno de pruebas aparte (otro Worker con su propia base de datos) para probar antes de producción
- [ ] Servir three.js desde la propia web, sin depender de jsDelivr
- [ ] Versión en las URLs de los módulos (`juego.js?v=…`) o cabeceras de caché adecuadas, para que nadie se quede con una versión vieja
- [ ] Archivo `_headers` con CSP, `X-Content-Type-Options`, `Referrer-Policy` y `Permissions-Policy` (permitiendo `xr-spatial-tracking`)
- [ ] Que `README.md` y `docs/` no se publiquen (`.assetsignore`)
- [ ] Copia de seguridad periódica de D1 (`wrangler d1 export`) además del historial de 30 días
- [ ] Registro de errores del navegador: `window.onerror` y `unhandledrejection` que envíen a `/api/errores` (con límite por IP)
- [ ] Página de error 404 propia
- [ ] Probar los 19 juegos en Quest 2, Quest 3, Android, iPhone, Chrome, Firefox y Safari

## 3. Perfiles de usuario

La especificación completa está en `docs/PERFILES.md`.

- [x] Decidir el método de inicio de sesión (enlace por correo + Google, y código para las gafas)
- [x] Tablas `usuarios` y `sesiones` en `bd/esquema.sql` (las crea también el Worker solo)
- [x] Iniciar y cerrar sesión, cookie de sesión segura (`HttpOnly`, `Secure`, `SameSite=Lax`)
- [x] Entrar con Google y con enlace por correo (Resend), con un código de 6 cifras para entrar desde otro dispositivo
- [ ] Vincular las gafas desde el menú de pausa en VR con un código de 6 cifras (de momento, en las gafas se entra en `entrar.html` con el código del correo)
- [x] Elegir un alias único (con las mismas reglas de nombres reservados del foro)
- [x] Pasar los favoritos y «me gusta» del navegador a la cuenta al registrarse
- [x] Favoritos y «me gusta» guardados en la cuenta (se ven en todos los dispositivos)
- [x] Récords guardados en la cuenta y clasificaciones de siempre y del mes en los 21 juegos (`ctx.puntuacion(valor)` y `juegos/marcadores.js`)
- [x] Sugerencias y comentarios firmados por el usuario, y no solo con un nombre libre
- [x] Probar las cuentas en producción con `?perfiles=1` y publicarlas (`CUENTAS: "1"` en `wrangler.jsonc`, 2026-10-12)
- [ ] Probar entrar en el Quest con el código del correo
- [x] Página de perfil pública (`perfil.html#alias`) y buscar jugadores con `@alias` en la portada (faltan los récords y las insignias)
- [ ] «Idea de @alias» en la ficha del juego y en el menú de pausa
- [x] Ajustes de privacidad: ocultar a quién sigues y quién te sigue (los demás ajustes, con lo que controlan)
- [x] Borrar la cuenta y descargar mis datos (RGPD)
- [x] Moderación de alias y cuentas en `admin.html` (forzar alias, otro avatar, suspender)
- [x] Seguir perfiles (números públicos, listas que se pueden ocultar)
- [ ] Bloquear perfiles y avisos de nuevos seguidores
- [x] Pestañas en la portada: «Para ti» (el catálogo) y «Seguidos» (actividad de los que sigues)
- [ ] «Para ti» con recomendaciones según lo que juegas (ahora es el catálogo completo)
- [x] Actualizar la política de privacidad con los datos de la cuenta (Resend y la cookie de Google incluidos)

## 4. Producto (que la gente llegue y vuelva)

- [x] Dominio propio, con el Worker conectado (`vrplaygame.com`)
- [ ] Que `www.vrplaygame.com` y la dirección antigua `…workers.dev` lleven a `vrplaygame.com`
- [ ] `meta description` y Open Graph (imagen al compartir) en todas las páginas
- [ ] `sitemap.xml` y `robots.txt` (con `admin.html` excluido)
- [ ] Tutorial la primera vez que se entra en VR: cómo cambiar de juego y cómo pausar
- [ ] Ajustes: altura, mano dominante (zurdos), jugar sentado, volumen
- [x] Clasificaciones por juego (`clasificacion.html`, menú de pausa y perfil)
- [ ] Insignias (Podio, Explorador…)
- [ ] Inglés: textos de la web, catálogo y paneles 3D
- [ ] Service worker para que cargue rápido y la app instalada funcione sin conexión
- [ ] Publicar en Meta Horizon Store como PWA
- [ ] Decidir el modelo de negocio: anuncios, versión de pago, donaciones o gratis

## 5. Día del lanzamiento

- [ ] Captcha Turnstile activado en el foro
- [ ] Revisar los límites por IP del foro
- [ ] Revisar que `/api/config` responde `"activo":true` en el dominio final
- [ ] Vídeo corto jugando en Quest para redes
- [ ] Publicar en r/OculusQuest, r/WebXR y comunidades de VR en español

