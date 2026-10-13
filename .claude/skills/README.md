# Skills del proyecto

Skills de Claude Code que se cargan solas al abrir este proyecto (también en la rutina diaria de la nube).
Son de terceros: se revisaron antes de añadirlas (solo instrucciones y, en `design-taste-frontend`,
scripts que abren Chrome sin ventana para hacer capturas y descargan fotos libres; no envían datos fuera).
Si una de ellas choca con el `README.md` o con `CLAUDE.md`, mandan los del proyecto.

| Skill | Origen | Licencia | Para qué |
|---|---|---|---|
| `find-skills` | [vercel-labs/skills](https://github.com/vercel-labs/skills) | MIT | Buscar e instalar más skills |
| `game-feel` | [gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) | Apache-2.0 | Sensación de juego: impacto, sacudidas, rebotes, sonido y vibración |
| `game-ui-ux` | [gamedev-skills/awesome-gamedev-agent-skills](https://github.com/gamedev-skills/awesome-gamedev-agent-skills) | Apache-2.0 | Marcadores, menús y pantallas de juego |
| `design-taste-frontend` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | MIT | Dirección de arte para páginas web |
| `redesign-existing-projects` | [Leonxlnx/taste-skill](https://github.com/Leonxlnx/taste-skill) | MIT | Mejorar el diseño de páginas que ya existen |

Las skills de three.js de [CloudAI-X/threejs-skills](https://github.com/CloudAI-X/threejs-skills)
(`threejs-fundamentals`, `threejs-interaction`, `threejs-lighting`, `threejs-materials`) **no están aquí** porque
ese repositorio no tiene licencia y no se pueden redistribuir. Cada uno puede instalarlas en su ordenador con:

```
npx skills add CloudAI-X/threejs-skills@threejs-fundamentals -g
```
