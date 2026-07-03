# 07 — Marketing y distribución

> FASE 8. Generado 2026-07-03. Método: verificación directa del estado de GitHub (`gh repo view`: description vacía, 0 topics, sin homepage, 11★, sin Pages) y npm (registry: 9 keywords, README 24KB renderizado, latest 0.1.35) + research web de canales activos con fechas de último push verificadas por API.

## Estado verificado (2026-07-03)

- GitHub `ericrisco/rsc-harness`: `description: ""`, `repositoryTopics: null`, `homepageUrl: ""`, 11 stars, sin GitHub Pages, releases automatizadas ✓.
- README: sin badges; el catálogo de 232 skills vive SOLO como tablas del README (430 filas).
- npm `@ericrisco/rsc`: description correcta, 9 keywords, README renderiza bien.
- SkillsMP (agregador con ~96k skills) **indexa automáticamente** repos públicos ≥2★ con topics correctos — hoy el repo no es descubrible por falta de topics.

## Specs

## SPEC-046: Metadata de GitHub vacía — description, topics y website exactos
- **Área / Prioridad:** Distribución / P1-alta
- **Problema:** El repo no tiene description, topics ni website: invisible en la búsqueda de GitHub, en los agregadores que indexan por topic (SkillsMP) y sin contexto en cualquier enlace compartido. Es la mejora de descubribilidad más barata que existe.
- **Evidencia:** `gh repo view ericrisco/rsc-harness --json description,repositoryTopics,homepageUrl` → `{"description":"","homepageUrl":"","repositoryTopics":null}` (2026-07-03).
- **Propuesta:** Ejecutar exactamente:
  ```bash
  gh repo edit ericrisco/rsc-harness \
    --description "232 quality-gated agent skills (open Agent Skills spec) + an npm CLI that installs them into 17 coding assistants — Claude Code, Cursor, Codex, Gemini CLI, Zed, Copilot & more" \
    --homepage "https://www.npmjs.com/package/@ericrisco/rsc" \
    --add-topic agent-skills --add-topic claude-code --add-topic claude-skills \
    --add-topic claude --add-topic cursor --add-topic codex --add-topic gemini-cli \
    --add-topic github-copilot --add-topic ai-agents --add-topic skills \
    --add-topic cli --add-topic developer-tools --add-topic llm \
    --add-topic agents-md --add-topic skill-md
  ```
  (15 topics; `claude-skills`/`agent-skills`/`skill-md` son los que indexa SkillsMP). En npm, añadir a `package.json.keywords`: `agent-skills-spec`, `skill-md`, `windsurf`, `zed`, `copilot` (siguiente release). Cambiar homepage a la página de SPEC-048 cuando exista.
- **Criterios de aceptación:** `gh repo view --json ...` devuelve description no vacía, homepage y ≥15 topics; el repo aparece en la búsqueda de GitHub por topic `agent-skills`; keywords npm ampliadas en la siguiente release.
- **Esfuerzo:** S

## SPEC-047: README sin badges y repo sin social preview
- **Área / Prioridad:** Distribución / P2-media
- **Problema:** Sin badges de npm/CI/licencia el README no comunica de un vistazo que es un paquete vivo, testeado y MIT; sin social preview, cada share en X/Slack/Reddit muestra una card genérica.
- **Evidencia:** `head -12 README.md` → arranca directo con ASCII art, 0 badges; `gh api repos/.../pages` → 404 (tampoco hay imagen social configurada — Settings → Social preview).
- **Propuesta:** (1) Bajo el ASCII art añadir: `[![npm](https://img.shields.io/npm/v/@ericrisco/rsc)](https://www.npmjs.com/package/@ericrisco/rsc) [![CI](https://github.com/ericrisco/rsc-harness/actions/workflows/ci.yml/badge.svg)](…/actions) [![license](https://img.shields.io/badge/license-MIT-green)](LICENSE) ![node](https://img.shields.io/node/v/@ericrisco/rsc)` + badge de downloads npm. (2) Generar imagen social 1280×640 (logo ASCII + "232 skills · 17 assistants · 8.5/10 quality gate") y subirla en Settings→Social preview.
- **Criterios de aceptación:** Los 4-5 badges renderizan en verde en GitHub y npm; la card de preview aparece al pegar el enlace del repo en X/Slack.
- **Esfuerzo:** S

## SPEC-048: El catálogo solo es legible dentro del README — publicar página estática (GitHub Pages) con tabla indexable + llms.txt
- **Área / Prioridad:** Distribución (GEO) / P1-alta
- **Problema:** Las 232 skills viven en 430 filas de tabla de un README de 25KB: ni Google ni los LLM-crawlers tienen una URL por skill que citar, y cualquier búsqueda "skill para X en Claude Code" no puede aterrizar en el catálogo. La cita en ChatGPT/Perplexity la ganan páginas HTML estáticas indexables, no READMEs largos.
- **Evidencia:** `gh api repos/ericrisco/rsc-harness/pages` → 404; catálogo solo en README.md:244-…; manifest.json ya contiene todo lo necesario (id, description, tags, recommends) para generar el sitio. Research 2026: llms.txt tiene adopción ~10% y casi cero requests de crawlers (ppc.land/seranking), pero coste cero y SÍ lo consumen los coding assistants al fetchearlo; el valor real está en el HTML indexable + JSON-LD.
- **Propuesta:** (1) Script `scripts/build-site.js` que genere desde manifest.json un sitio estático en `site/` → GitHub Pages via workflow: index con la tabla completa filtrable por dominio + **una página por skill** (`/skills/<id>.html` con description completa, triggers, tags, recommends, comando de instalación `npx @ericrisco/rsc add <id>` y FAQPage JSON-LD "¿cómo instalo X?"). (2) `llms.txt` en la raíz del sitio: resumen del proyecto + enlace por dominio a las páginas (spec llmstxt.org). (3) sitemap.xml. (4) Apuntar el homepage del repo (SPEC-046) a la página.
- **Criterios de aceptación:** Pages activo sirviendo index + 232 páginas de skill generadas del manifest (regenerables con `node scripts/build-site.js`); `/llms.txt` responde 200; `site:` de Google indexa ≥1 página de skill a las 4 semanas (verificación diferida); el workflow de release regenera el sitio.
- **Esfuerzo:** L

## SPEC-049: Envíos a listas y directorios verificados (con formato exacto de cada uno)
- **Área / Prioridad:** Distribución / P1-alta
- **Problema:** El proyecto no está en ninguna de las listas/directorios donde su audiencia busca skills; todas las siguientes están activas (push jun-jul 2026, verificado por API) y aceptan envíos.
- **Evidencia:** Research 2026-07-03 con fechas de último push: VoltAgent/awesome-agent-skills (27.2k★, 30-06), ComposioHQ/awesome-claude-skills (66.7k★, 22-05), hesreallyhim/awesome-claude-code (47.9k★, 03-07, **solo issue-form, no PR**), RoggeOhta/awesome-codex-cli (11-04) + openai/codex discussion #16329, PatrickJS/awesome-cursorrules (40.2k★, 30-05), SkillsMP (indexado automático por topics). e2b-dev/awesome-ai-agents descartada (muerta desde feb-2025).
- **Propuesta:** Ejecutar en este orden: (1) **VoltAgent/awesome-agent-skills** — PR según su CONTRIBUTING con la línea: "rsc — 232 skills conforming to the Agent Skills spec, installable into 17 assistants (Claude Code, Cursor, Codex, Gemini, Zed…) with one npm command; every skill passes an adversarial 8.5/10 behavioral gate." (2) **ComposioHQ/awesome-claude-skills** — PR análogo en la categoría de colecciones. (3) **hesreallyhim/awesome-claude-code** — issue-form `recommend-resource.yml` con descripción neutra de 1 línea SIN adjetivos de marketing. (4) **openai/codex#16329** — comentario presentando los skill packs para Codex. (5) **awesome-cursorrules** — solo tras aplicar SPEC-036/037 (export digno a Cursor). (6) SkillsMP: nada que enviar — se resuelve con los topics de SPEC-046. Requisito previo para todas: SPEC-046 aplicada.
- **Criterios de aceptación:** ≥3 envíos realizados con URL de PR/issue registrada en `02-DOCS` o en este archivo; el repo aparece en SkillsMP (búsqueda por "rsc" o "ericrisco") tras la indexación.
- **Esfuerzo:** M

## SPEC-050: Empaquetar el catálogo como plugin para el marketplace oficial de Anthropic (claude-plugins-community)
- **Área / Prioridad:** Distribución / P2-media
- **Problema:** El canal de distribución oficial de Claude Code es `/plugin marketplace` alimentado por anthropics/claude-plugins-community (activo, push 03-07-2026); la barrera es técnica (validación automática + safety screening), no editorial. rsc no está.
- **Evidencia:** github.com/anthropics/claude-plugins-community + guía en code.claude.com/docs/en/discover-plugins (verificado 2026-07-03). Nota: el repo ya tuvo estructura de plugins (`plugins/rsc-core`, `plugins/rsc-review` en el historial) que fue retirada — hay aprendizaje previo que revisar antes de re-empaquetar.
- **Propuesta:** Crear plugin(s) Claude Code que empaqueten perfiles del catálogo (p.ej. `rsc-core` = profile minimal+core; opcionalmente por dominio), con manifest de plugin conforme a la guía, y enviar PR según "Submit your plugin". Revisar primero por qué se retiró la estructura de plugins anterior (git log de la purga) para no repetir el motivo.
- **Criterios de aceptación:** Plugin pasa la validación automática del repo community; PR enviado (URL registrada); instalable vía `/plugin marketplace` en una sesión limpia.
- **Esfuerzo:** L

## SPEC-051: Contenido técnico: la historia del pipeline adversarial (Show HN, dev.to, newsletters)
- **Área / Prioridad:** Distribución / P2-media
- **Problema:** Los dos ganchos diferenciales (gate conductual 8.5/10 con grader ciego baseline-vs-treatment; multi-target 17 asistentes) no están contados en ningún sitio enlazable; las comunidades 2026 están saturadas de catálogos de skills sin control de calidad ("AI-slop") y premian exactamente la contra-narrativa que este proyecto puede documentar con datos.
- **Evidencia:** Research 2026-07-03: prácticas Show HN (título neutro, mar–jue 9-12 ET, HN prohíbe comentarios generados por IA), TLDR AI acepta submissions por formulario, Latent Space por pitch directo con dato técnico; r/ClaudeAI y r/ClaudeCode con regla 1:10 de self-promo. El motor del pipeline existe y es citable: `scripts/skill-behavior-eval.workflow.js` (A/B ciego), `lib/behavior-score.js` (ABS_MIN 8.5, LIFT_MIN 1.0), `skill-harden.workflow.js` (anti-gaming).
- **Propuesta:** (1) Post técnico en dev.to/blog propio: "How we quality-gate 232 agent skills with a blind adversarial grader" — con datos reales del scoreboard (cuántas suspendieron el primer pase, ejemplos de fallo, el guard anti keyword-stuffing). (2) "Show HN: Adversarial QA pipeline for 232 agent skills (blind grader, 8.5/10 gate)" enlazando al post o al repo, martes–jueves 9-12 ET, autor respondiendo la primera hora. (3) Pitch de 3 líneas a Latent Space/TLDR AI con la metodología baseline-vs-treatment. Requisito previo: SPEC-046/047 (el tráfico aterriza en un repo presentable).
- **Criterios de aceptación:** Post publicado con ≥1 dato cuantitativo real del pipeline; envío HN realizado; ≥1 pitch a newsletter enviado (URLs registradas).
- **Esfuerzo:** M

## Hallazgos SIN spec (una línea cada uno)

- npm está razonablemente bien (description clara, 9 keywords, README renderizado); las keywords extra van en SPEC-046.
- agentskills.io no es un directorio sino la spec: el movimiento es citarse como "implementación conforme" en README/site y participar en sus Discussions — se cubre con SPEC-048/051.
- llms.txt: coste cero pero impacto real bajo en 2026 (97% de esos archivos reciben cero requests de crawlers); por eso va como sub-item de SPEC-048 y no como spec propia.
- El directorio oficial de skills de Anthropic en claude.com es solo-partners hoy; el camino abierto es claude-plugins-community (SPEC-050).
