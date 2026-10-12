# Perfiles de usuario: especificación

Estado: **aprobada** (2026-10-11). Las decisiones están en la última sección: todas siguen la propuesta.

**Hecho (2026-10-12):** entrar con Google o con enlace y código por correo, alias, año de nacimiento, sesiones, favoritos y «me gusta» en la cuenta, foro firmado con el alias, «Mi cuenta» (con descargar los datos y borrar la cuenta), la pestaña «Usuarios» de `admin.html`, el perfil público (sin récords ni insignias todavía), buscar jugadores con `@alias` en el buscador de la portada, seguir cuentas y la pestaña «Seguidos» de la portada. Publicado para todo el mundo el 2026-10-12 (`CUENTAS: "1"` en `wrangler.jsonc`). Cómo funciona: sección «Cuentas de usuario» del README. Lo que falta está en `LANZAMIENTO.md`.

Diferencias con esta especificación en lo ya hecho:

- **Gafas.** El correo trae, además del enlace, un código de 6 cifras que se escribe en `entrar.html`. Así se puede entrar en el navegador de las gafas leyendo el correo en el móvil. La vinculación desde el menú de pausa en VR (punto 4) queda para más adelante.
- **«Me gusta» con cuenta.** No hay columna `usuario_id` en `me_gusta` ni en `juegos_me_gusta`: el votante es el hash de `cuenta:<id>`, igual que el del navegador es el hash de su identificador. Al borrar la cuenta quedan anónimos sin hacer nada.
- **Ajustes de privacidad.** De momento solo está «Recibir avisos por correo». Los demás ajustes (favoritos públicos, clasificaciones, perfil público, listas de seguidores) se añadirán con el perfil público y las clasificaciones, que es donde tienen efecto.
- **Google** solo pide el correo (`openid email`), ni el nombre ni la foto.
- **Portada** (D9). Dos pestañas: «Para ti», que de momento es el catálogo completo con el buscador y los filtros (sin recomendaciones todavía), y «Seguidos». No hay pestaña «Juegos» aparte. «Seguidos» se calcula con consultas sobre `sugerencias`, `comentarios` y `seguidores`, sin tabla `actividad`.
- **Tu perfil.** El botón de la cuenta lleva a tu perfil público, y desde ahí se entra a los ajustes. En tu propio perfil ves también tus «me gusta» y tus guardados, pero nadie más los ve (D7).
- **«Sugerir un juego»** se llama ahora «¡Crea tu juego!» y es un botón destacado en la cabecera y en la portada.

## 1. Principios

1. **Se juega sin registrarse.** Todos los juegos, el catálogo, los favoritos, los «me gusta» y los récords funcionan sin cuenta, como ahora.
2. **La cuenta suma, no quita.** Registrarse sirve para tres cosas: tener tus datos en todos tus dispositivos, que se te reconozcan tus ideas y aparecer en las clasificaciones.
3. **Nunca se pide la cuenta en mitad de una partida** ni con una ventana que bloquee. Solo se sugiere en momentos naturales (ver el punto 4).
4. **Pocos datos.** Solo se pide lo imprescindible: un correo para entrar y un alias para mostrar.
5. **Nada que moderar que no se pueda moderar.** Sin fotos subidas, sin biografía libre y sin mensajes privados.

## 2. Qué puede hacer cada visitante

| | Sin cuenta | Con cuenta |
|---|---|---|
| Jugar a todos los juegos | ✔ | ✔ |
| Favoritos | ✔ solo en ese navegador | ✔ en todos sus dispositivos |
| «Me gusta» en juegos y sugerencias | ✔ uno por navegador | ✔ uno por cuenta |
| Récords | ✔ solo en ese navegador | ✔ en la cuenta |
| Salir en las clasificaciones | ✘ | ✔ |
| Sugerir juegos y comentar en el foro | *Decisión D1* | ✔ firmado con su alias |
| Crédito «Idea de @alias» en el juego | ✘ (sale el nombre que escribió, sin enlace) | ✔ con enlace a su perfil |
| Perfil público | ✘ | ✔ |
| Insignias | ✘ | ✔ |
| Feed «Para ti» | ✔ según lo que ha jugado y marcado en ese navegador | ✔ según su cuenta |
| Seguir perfiles y feed «Seguidos» | ✘ | ✔ |

## 3. Datos de la cuenta

| Dato | Obligatorio | Público | Notas |
|---|---|---|---|
| Correo | Sí | Nunca | Solo para entrar y para avisos de la cuenta |
| Alias | Sí | Sí | Ver reglas abajo |
| Avatar | Automático | Sí | Generado a partir del alias (color y forma). Se puede «tirar otra vez» |
| Fecha de alta | Automático | Sí | |
| Mano dominante | No | No | Preparado para cuando existan los ajustes de zurdos |
| Ajustes de privacidad | Automático | No | Ver el punto 6 |

**Reglas del alias**

- De 3 a 20 caracteres: letras, números, `_` y `.`, sin espacios.
- Único sin distinguir mayúsculas, minúsculas ni tildes (`Rafa` y `rafa` son el mismo).
- No vale si está reservado (VR Play, admin, moderador…), es ofensivo (lista de palabras) o imita a otro alias con caracteres parecidos.
- Se puede cambiar una vez cada 30 días. El alias antiguo queda bloqueado 30 días para que nadie se lo quede.
- El administrador puede forzar un cambio de alias (por ejemplo, si es ofensivo).

## 4. Registro e inicio de sesión

### Cuándo se sugiere crear una cuenta

Siempre con un aviso pequeño que se puede cerrar, y como mucho una vez por sesión:

- al batir tu récord: «Guarda tus récords y sal en la clasificación»;
- al marcar el tercer favorito;
- al enviar una sugerencia al foro: «Si te registras, el juego llevará tu nombre»;
- con un botón «Entrar» siempre visible en la cabecera del catálogo y del foro.

En VR se sugiere solo en el menú de pausa, nunca durante la partida.

### Métodos

Ver la *decisión D2*. La propuesta es:

1. **Enlace por correo**: escribes tu correo y te llega un enlace que caduca en 15 minutos. No hay contraseña.
2. **Google**: un botón. Se guarda el correo y el identificador de Google.
3. Las dos formas llevan a la misma cuenta si el correo coincide.

La primera vez, después de entrar, se elige el alias. Hasta entonces la cuenta no está activa.

### Entrar en las gafas

Escribir en VR es incómodo, así que en las gafas se usa un código:

1. En las gafas, el menú de pausa muestra «Vincular cuenta» y un código de 6 cifras, válido 10 minutos.
2. En el móvil o el ordenador, con la sesión iniciada, se entra en `vincular.html` y se escribe el código.
3. Las gafas quedan con la sesión iniciada.

Al revés también funciona: el navegador de las gafas permite usar el enlace por correo o Google como en cualquier web.

### Sesiones

- Duran 90 días y se renuevan al usarlas.
- Se guardan en una cookie `HttpOnly`, `Secure` y `SameSite=Lax`. En la base de datos solo se guarda el hash.
- En «Mi cuenta» se ven los dispositivos con la sesión abierta y se pueden cerrar.

## 5. Qué pasa con lo que ya tenías en el navegador

Al entrar por primera vez desde un navegador:

- **Favoritos:** se juntan los del navegador con los de la cuenta.
- **«Me gusta»:** se pasan a la cuenta. Si ese «me gusta» ya existía en la cuenta, no cuenta dos veces.
- **Récords:** se queda el mejor de cada juego. *Decisión D4*: los récords hechos antes de tener cuenta, ¿cuentan para la clasificación?
- **Sugerencias del foro:** se pueden reclamar las que se enviaron desde ese navegador. **Ojo:** ahora el servidor no guarda desde qué navegador se envía cada sugerencia, así que las antiguas no se pueden reclamar solas. Propuesta: empezar ya a guardar el hash del identificador del navegador al crear sugerencias y comentarios (un cambio pequeño), y que el administrador asigne a mano las anteriores a quien lo pida.

Al cerrar sesión, el navegador conserva una copia local y se sigue jugando como invitado.

## 6. Perfil público

Dirección: `perfil.html#alias`. Se enlaza desde el foro, desde las clasificaciones y desde «Idea de @alias».

**Contenido, en este orden:**

1. Cabecera: avatar, alias, fecha de alta e insignias.
2. **Juegos creados a partir de sus ideas:** las sugerencias en estado `hecha`, con su miniatura y el botón «Jugar». Es lo más importante del perfil.
3. **Ideas en marcha:** sus sugerencias en estudio o en desarrollo, con su estado.
4. **Récords:** su mejor puntuación en cada juego y su puesto en la clasificación.
5. **Favoritos:** solo si los hace públicos.
6. Números: juegos jugados, «me gusta» recibidos en sus sugerencias y comentarios.

**No sale nunca:** el correo, las sugerencias ocultas o descartadas, ni los «me gusta» que ha dado.

**Ajustes de privacidad** (en «Mi cuenta»):

- Favoritos públicos: no por defecto.
- Salir en las clasificaciones: sí por defecto.
- Perfil público: sí por defecto. Si lo desactiva, su alias sigue saliendo en el foro, pero sin enlace.

## 7. «Mi cuenta» (privado)

- Cambiar alias y avatar
- Ajustes de privacidad
- Dispositivos con sesión abierta y «Cerrar sesión en todos»
- Vincular las gafas (escribir el código)
- **Descargar mis datos** (un JSON con todo lo que hay de su cuenta)
- **Borrar mi cuenta** (ver el punto 10)

## 8. Crédito en los juegos

- En la ficha del catálogo y en el menú de pausa: «Idea de @alias», con enlace al perfil.
- Si varias sugerencias dieron lugar al mismo juego, salen todos sus autores.
- Si la sugerencia se hizo sin cuenta: «Idea de Nombre», sin enlace.
- Cuando una sugerencia pasa a `hecha`, el autor ve un aviso la próxima vez que entra: «¡Tu idea ya es un juego!». *Decisión D6*: ¿también por correo?

## 9. Clasificaciones e insignias

### Clasificaciones

- Una por juego: los 100 mejores, de siempre y del mes.
- El jugador ve siempre su puesto, aunque no esté entre los 100.
- **Trampas.** Los récords los calcula el navegador, así que alguien con conocimientos puede enviar uno falso. Medidas:
  - cada juego declara su puntuación máxima posible y su duración mínima de partida, y el servidor rechaza lo que no cuadre;
  - una partida se abre en el servidor al empezar y se cierra al enviar la puntuación;
  - límite de envíos por cuenta y hora;
  - el administrador puede borrar récords y vetar a una cuenta de las clasificaciones.

  Esto no las hace imposibles, pero sí poco rentables. Para un juego así es lo razonable.

### Insignias

Lista inicial (se calculan solas):

| Insignia | Cómo se consigue |
|---|---|
| Primera idea | Una sugerencia aceptada (en desarrollo) |
| Creador | Una sugerencia convertida en juego |
| Creador ×3, ×10 | 3 o 10 juegos a partir de tus ideas |
| Popular | 50 «me gusta» en tus sugerencias |
| Explorador | Has jugado a todos los juegos del catálogo |
| Podio | Top 3 en la clasificación de algún juego |
| Fundador | Cuenta creada durante el primer mes |

## 10. Privacidad y RGPD

- **Edad mínima: 14 años** (en España, la edad para dar el consentimiento uno mismo). Se marca una casilla al crear la cuenta.
- **Borrar la cuenta:** se borran el correo, las sesiones, los favoritos, los récords y los ajustes. Las sugerencias y los comentarios se quedan, firmados como «Usuario eliminado», porque forman parte de hilos de otras personas. Los «me gusta» se mantienen como anónimos para no alterar los totales. *Decisión D5.*
- **Descargar mis datos:** un JSON con la cuenta, los favoritos, los récords, las sugerencias y los comentarios.
- Los enlaces por correo y los códigos de vinculación se borran al usarse o al caducar.
- Las sesiones caducadas se borran cada día.
- Hay que actualizar la política de privacidad antes de activar las cuentas.

## 11. Moderación

En `admin.html`, una pestaña «Usuarios»:

- buscar por alias;
- ver sus sugerencias, comentarios y récords;
- forzar un cambio de alias y regenerar el avatar;
- borrar récords y vetarle de las clasificaciones;
- **suspender:** puede seguir jugando, pero no publicar en el foro ni salir en las clasificaciones;
- asignar a una cuenta sugerencias hechas sin cuenta.

Y un botón «Denunciar perfil» en el perfil público.

## 12. Seguridad

- Las peticiones que cambian algo comprueban el origen (`Origin`) además de la cookie.
- Límites por IP y por cuenta en el registro, los enlaces por correo, los códigos de vinculación y el envío de récords.
- Nunca se dice si un correo tiene cuenta o no. Siempre sale: «Si el correo es correcto, te llegará un enlace».
- La clave de administrador sigue siendo `ADMIN_TOKEN`: los perfiles no dan permisos de moderación.

## 13. Seguir perfiles y feed

### Seguir

- **Se sigue en un solo sentido**, como en Twitter o Instagram: no hace falta aceptar. Seguir a alguien no da acceso a nada privado, solo trae su actividad pública a tu feed.
- El botón «Seguir» está en el perfil público y junto al alias en el foro y en las clasificaciones.
- El perfil muestra cuántos seguidores tiene y a cuántos sigue. Las listas se pueden abrir. *Decisión D11*: ¿se pueden ocultar esas listas?
- **Bloquear:** la persona bloqueada no puede seguirte, deja de seguirte si ya lo hacía y no ve tu actividad en su feed. No se le avisa.
- Avisos dentro de la web (no por correo): «@alias ha empezado a seguirte». Si te siguen muchas personas a la vez, se agrupan.
- Límites contra el spam: como mucho 50 perfiles seguidos por día y 1.000 en total.
- Si te suspenden, tus «seguir» siguen existiendo, pero tu actividad no sale en ningún feed.

### Qué es el feed

Una lista de **tarjetas**. Cada tarjeta es un juego o algo que ha pasado en la comunidad.

| Tarjeta | Ejemplo |
|---|---|
| Juego nuevo | «Nuevo: Pincha Globos, idea de @rafa» con el botón «Jugar» |
| Juego actualizado | «Actualizado: Bolos (más pistas)» |
| Idea aceptada | «La idea de @ana pasa a desarrollo: Tiro con Honda» |
| Sugerencia nueva | La sugerencia con sus ♥ y comentarios, y un botón para darle ♥ |
| Récord | «@leo ha hecho 12.400 puntos en Piloto Estelar (puesto 3)», con «Intenta superarlo» |
| Insignia | «@ana ha conseguido Creador ×3» |
| Comentario | Solo en «Seguidos»: «@leo ha comentado en Tiro con Honda» |

Las tarjetas de otras personas solo muestran **actividad pública**. Nunca salen sus favoritos (salvo que sean públicos), los «me gusta» que ha dado ni lo que juega.

### Las dos pestañas

**Para ti** (la de por defecto; también funciona sin cuenta)

Mezcla, con un orden sencillo (sin inteligencia artificial):

- **juegos recomendados:** los que tienen etiquetas parecidas a los que te gustan, has marcado o has jugado más, y que aún no has jugado;
- juegos nuevos y actualizados;
- las sugerencias y los récords con más actividad de la semana;
- **ideas parecidas a tus gustos:** sugerencias cuyo tipo y cuyas manos coinciden con tus juegos favoritos.

Sin cuenta usa lo que hay en ese navegador. Si no hay nada (la primera visita), muestra lo más popular.

**Seguidos** (solo con cuenta)

- Toda la actividad pública de los perfiles que sigues, por orden de fecha, de la más reciente a la más antigua.
- Sin cuenta, la pestaña muestra un aviso: «Entra para seguir a otros jugadores».
- Si aún no sigues a nadie, propone perfiles: los autores de tus juegos favoritos y los primeros de las clasificaciones de los juegos que más juegas.

### Dónde está el feed

*Decisión D9.* Propuesta: la portada de la web (`index.html`) tiene tres pestañas arriba:

- **Para ti** (la de por defecto)
- **Seguidos**
- **Juegos**: el catálogo de ahora, con el buscador y los filtros

El foro se queda como está, para enviar sugerencias y leer los hilos completos. Las tarjetas del feed llevan a él.

**En VR** el feed no se muestra: en las gafas solo hace falta el catálogo y la rotación de juegos. *Decisión D10*: ¿que el botón «siguiente juego» tenga en cuenta tus gustos (como «Para ti») en vez de ser totalmente aleatorio?

## 14. Fuera de esta versión

Para más adelante, si funciona:

- amigos (seguirse mutuamente con más permisos) y retos directos entre jugadores;
- mensajes privados;
- fotos de perfil y biografía libre;
- multijugador;
- cuenta de Meta para entrar.

## 15. Cambios técnicos (resumen)

- **Se programa en `main`** y cada parte sale visible en la web en cuanto se sube, sin interruptor para ocultarla. Si más adelante, con usuarios, hace falta publicar algo oculto mientras se termina, se puede añadir un interruptor (una variable en Cloudflare y `?perfiles=1` para probarlo).
- **Los cambios en la base de datos solo añaden**, nunca borran ni renombran. Así, la versión anterior (rama `version-1`) sigue funcionando con la base de datos nueva si hay que volver a ella.

- **Tablas nuevas:** `usuarios`, `sesiones`, `enlaces_acceso`, `codigos_vinculacion`, `favoritos`, `records`, `partidas`, `insignias`, `seguidores`, `bloqueos`, `actividad` (una fila por cada suceso que puede salir en un feed) y `avisos`.
- **El feed se calcula al leerlo**, con consultas sobre `actividad` (no se guarda un feed por usuario). Con los volúmenes previstos, D1 lo aguanta. Si crece mucho, se puede guardar en caché.
- Para que «Para ti» funcione sin cuenta, el navegador guarda también qué juegos se han jugado y cuántas veces.
- **Columnas nuevas:** `usuario_id` en `sugerencias`, `comentarios`, `me_gusta` y `juegos_me_gusta`. Además, `navegador` (hash) en `sugerencias` y `comentarios`.
- **Páginas nuevas:** `perfil.html`, `cuenta.html`, `entrar.html`, `vincular.html` y `clasificacion.html`, o una sección en la ficha del juego.
- **Shell:** `ctx.guardar`/`ctx.leer` siguen igual para los juegos. Una función nueva, `ctx.record(puntos)`, envía el récord si hay cuenta. Los juegos existentes hay que adaptarlos uno a uno para que la usen.
- **Servidor:** rutas `/api/cuenta/*`, `/api/perfiles/:alias`, `/api/records/*`.
- **Servicios externos:** envío de correo (Resend o Cloudflare) y, si se elige, Google.

## 16. Decisiones

| | Pregunta | Decisión |
|---|---|---|
| D1 | ¿Se puede sugerir y comentar en el foro sin cuenta? | Sí, como ahora, para no frenar las ideas. Pero solo con cuenta se lleva el crédito con enlace. |
| D2 | ¿Cómo se inicia sesión? | Enlace por correo + Google, y código para las gafas |
| D3 | ¿Clasificaciones en la primera versión? | Sí, porque son el principal motivo para registrarse |
| D4 | ¿Los récords hechos sin cuenta cuentan para la clasificación? | No: solo los conseguidos con la sesión iniciada |
| D5 | Al borrar la cuenta, ¿qué pasa con sus sugerencias y comentarios? | Se quedan como «Usuario eliminado» |
| D6 | ¿Se envían correos de aviso (idea aceptada, juego publicado)? | Sí, desactivables, y nada más (sin boletines) |
| D7 | ¿Favoritos públicos por defecto? | No |
| D8 | ¿Quién es el titular para la política de privacidad? | Rafael Ruiz Huertas y Miguel Ángel Hernicas Esquinas, como corresponsables, con el correo `contact@vrplaygame.com`. Sin NIF ni domicilio mientras no haya ingresos |
| D9 | ¿Dónde está el feed? | En la portada, con las pestañas Para ti / Seguidos / Juegos |
| D10 | ¿El botón «siguiente juego» usa tus gustos? | Sí, a medias: la mitad de las veces un juego de «Para ti» y la otra mitad, al azar, para que descubras otros |
| D11 | ¿Se pueden ocultar las listas de seguidores y seguidos? | Sí, en los ajustes de privacidad |
| D12 | ¿Las cuentas de menores (14-17) tienen limitaciones? Para saberlo habría que pedir el año de nacimiento, y no solo marcar «tengo 14 años o más» | Sí: se pide el año de nacimiento (no es público). Los menores no pueden recibir avisos de nuevos seguidores de desconocidos y sus listas están ocultas por defecto |
