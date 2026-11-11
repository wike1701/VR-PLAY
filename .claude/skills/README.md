# Skills del proyecto

Skills de Claude Code que se cargan solas al abrir este proyecto (también en la rutina diaria de la nube).
Son de terceros: se revisaron antes de añadirlas (solo instrucciones y, en `design-taste-frontend`,
scripts que abren Chrome sin ventana para hacer capturas y descargan fotos libres, y en `create-game-assets`,
dos scripts de Python que solo leen imágenes locales; no envían datos fuera).
Si una de ellas choca con el `README.md` o con `CLAUDE.md`, mandan los del proyecto.

| Skill | Origen | Licencia | Para qué |
|---|---|---|---|
| `find-skills` | [vercel-labs/skills](https://github.com/vercel-labs/skills) | MIT | Buscar e instalar más skills |
| `game-feel` | [gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) | Apache-2.0 | Sensación de juego: impacto, sacudidas, rebotes, sonido y vibración |
| `game-ui-ux` | [gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) | Apache-2.0 | Marcadores, menús y pantallas de juego |
| `design-taste-frontend` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | MIT | Dirección de arte para páginas web |
| `redesign-existing-projects` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | MIT | Mejorar el diseño de páginas que ya existen |
| `folder-structure-blueprint-generator` | [github/awesome-copilot](https://github.com/github/awesome-copilot) | MIT | Analizar y documentar las carpetas, rutas y convenciones del proyecto |
| `improve-codebase-architecture` | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT | Revisar la organización del código y proponer mejoras (solo a mano: `/improve-codebase-architecture`) |
| `codebase-design` | [mattpocock/skills](https://github.com/mattpocock/skills) | MIT | Vocabulario y principios para módulos bien separados (la usa la anterior) |
| `threejs-aaa-graphics-builder` | [majidmanzarpour/threejs-game-skills](https://github.com/majidmanzarpour/threejs-game-skills) | MIT | Calidad gráfica de los juegos: formas, materiales, luz, efectos y la hoja para puntuarlos (aquí sin servicios externos de pago: todo se hace con código, ver `docs/CALIDAD.md`) |
| `create-game-assets` | [gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) | Apache-2.0 | Dirección de arte y familias coherentes de imágenes: las portadas de los juegos (`docs/PORTADAS.md`) |
| `remotion-markup` | [remotion-dev/skills](https://github.com/remotion-dev/skills) (v4.0.542, sin la parte de mapas) | [Remotion License](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md) (gratis para personas y equipos de hasta 3) | Buenas prácticas de Remotion (animación, transiciones, texto, audio, fuentes): los vídeos de `herramientas/videos/remotion/` |
| `remotion-captions` | [remotion-dev/skills](https://github.com/remotion-dev/skills) (v4.0.542) | [Remotion License](https://github.com/remotion-dev/remotion/blob/main/LICENSE.md) | Subtítulos palabra a palabra en Remotion |
| `videos-vrplay` | Propia | — | Cómo hacer, revisar y publicar los vídeos de VR Play con la fábrica (`herramientas/videos/`) |

Las skills de three.js de [CloudAI-X/threejs-skills](https://github.com/CloudAI-X/threejs-skills)
(`threejs-fundamentals`, `threejs-interaction`, `threejs-lighting`, `threejs-materials`) **no están aquí** porque
ese repositorio no tiene licencia y no se pueden redistribuir. Cada uno puede instalarlas en su ordenador con:

```
npx skills add CloudAI-X/threejs-skills@threejs-fundamentals -g
```
