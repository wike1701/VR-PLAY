# Lanzamiento de VR Play: lista de comprobación

Marca cada punto con `[x]` cuando esté hecho. Los bloques van por orden de prioridad.

## 1. Legal (antes de anunciar la web)

- [ ] Decidir el titular de la web (persona o empresa) y un correo de contacto, y rellenar los huecos de `legal.html` (titular, NIF, domicilio, correo y servicio de correo)
- [x] Página de **aviso legal** con los datos del titular (LSSI)
- [x] Página de **política de privacidad** (RGPD): qué se guarda (foro, huella de IP, almacenamiento del navegador), para qué, cuánto tiempo y cómo pedir que se borre
- [x] Página de **cookies**, o una nota que diga que no se usan, si sigue sin haberlas
- [x] Página de **contacto**
- [x] Enlazar las páginas legales en el pie de `index.html` y `foro.html` (todo está en `legal.html`)
- [ ] Servir las fuentes desde la propia web, en vez de cargarlas desde Google Fonts (envía la IP a Google)
- [ ] Quitar el hueco «Espacio publicitario» o decidir el sistema de anuncios (en ese caso, banner de consentimiento)
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
- [ ] Que `README.md` y `LANZAMIENTO.md` no se publiquen (`.assetsignore`)
- [ ] Copia de seguridad periódica de D1 (`wrangler d1 export`) además del historial de 30 días
- [ ] Registro de errores del navegador: `window.onerror` y `unhandledrejection` que envíen a `/api/errores` (con límite por IP)
- [ ] Página de error 404 propia
- [ ] Probar los 19 juegos en Quest 2, Quest 3, Android, iPhone, Chrome, Firefox y Safari

## 3. Perfiles de usuario

La especificación completa está en `PERFILES.md`.

- [ ] Decidir el método de inicio de sesión
- [ ] Tablas `usuarios` y `sesiones` en `bd/esquema.sql`
- [ ] Iniciar y cerrar sesión, cookie de sesión segura (`HttpOnly`, `Secure`, `SameSite=Lax`)
- [ ] Vincular las gafas con un código de 6 cifras (para no escribir el correo o la contraseña en VR)
- [ ] Elegir un alias único (con las mismas reglas de nombres reservados del foro)
- [ ] Pasar los favoritos y «me gusta» del navegador a la cuenta al registrarse
- [ ] Favoritos y «me gusta» guardados en la cuenta (se ven en todos los dispositivos)
- [ ] Récords guardados en la cuenta
- [ ] Sugerencias y comentarios firmados por el usuario, y no solo con un nombre libre
- [ ] Página de perfil pública (`perfil.html#alias`)
- [ ] «Idea de @alias» en la ficha del juego y en el menú de pausa
- [ ] Ajustes de privacidad: qué se ve del perfil
- [ ] Borrar la cuenta y descargar mis datos (RGPD)
- [ ] Moderación de alias y perfiles en `admin.html`
- [ ] Seguir y bloquear perfiles, avisos de nuevos seguidores
- [ ] Feed en la portada: pestañas «Para ti», «Seguidos» y «Juegos»
- [ ] Actualizar la política de privacidad con los datos de la cuenta

## 4. Producto (que la gente llegue y vuelva)

- [ ] Dominio propio, con el Worker conectado
- [ ] `meta description` y Open Graph (imagen al compartir) en todas las páginas
- [ ] `sitemap.xml` y `robots.txt` (con `admin.html` excluido)
- [ ] Tutorial la primera vez que se entra en VR: cómo cambiar de juego y cómo pausar
- [ ] Ajustes: altura, mano dominante (zurdos), jugar sentado, volumen
- [ ] Clasificaciones por juego (necesita los perfiles)
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

