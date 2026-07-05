# 08 — Docs y escritura

> FASE 9. Generado 2026-07-03. Método: lectura crítica del README (quickstart, Update, catálogo), verificación de recuentos contra manifest/targets, inventario de docs de contribución, y contraste con lo probado en vivo en la FASE 5.

## Lo que está BIEN (verificado, sin spec)

- **El quickstart funciona tal cual**: el flujo `npx @ericrisco/rsc` / `add` / `install --profile` está publicado (latest 0.1.35 en el registry) y el CLI se comportó como documenta el README en las pruebas en vivo de la FASE 5; el caveat "no lo ejecutes dentro del clone" está explicado con el workaround correcto.
- La sección **Update** documenta honestamente el flujo de 2 pasos (`npm i -g …@latest` + `rsc sync`) y el `upgrade --dry-run` — la mejora del flujo en sí es SPEC-032; la doc está bien escrita.
- Releases de GitHub con notas automáticas por versión (v0.1.33-35 verificadas) — hay changelog de facto.
- El inglés del README es claro, con voz consistente y explicaciones del "why" — no requiere spec de estilo.
- La consistencia de nombres es aceptable: `rsc` (comando, 74 usos), `@ericrisco/rsc` (paquete, 11), `rsc-harness` (repo, 2) — los tres roles están diferenciados y el quickstart explica la relación.

## Specs

## SPEC-052: El README anuncia 231 skills (el catálogo tiene 232) y la lista de asistentes suma 18 sobre un total de 17
- **Área / Prioridad:** Docs / P1-alta
- **Problema:** El titular H1 y una línea del CLI dicen "231" mientras otras 3 menciones dicen "232" (el número real); y la frase de asistentes nombra 7 + "and 11 more" = 18 sobre un catálogo de 17 targets. Errores pequeños pero en el titular del producto, y de un tipo que reincidirá con cada skill/target nuevo.
- **Evidencia:** `README.md:15` ("# `rsc` — 231 agent skills…"), `:180` ("all 231"); vs 3 menciones "232 skills"; `README.md:110` ("Claude Code, Codex, Copilot, Cursor, Gemini, Windsurf, Cline and 11 more"); targets reales: 17 (`Object.keys(SPEC).length`, verificado). Manifest: `counts.skills = 232`.
- **Propuesta:** (1) Corregir a 232 y "and 10 more". (2) Que no vuelva a pasar: añadir al gate de CI un check (script de 10 líneas en `scripts/` o step de ci.yml) que extraiga los números "N agent skills"/"all N" del README y los compare con `manifest.counts.skills`, y el "17" contra `Object.keys(SPEC).length` — falla si divergen. Alternativa mayor (opcional): generar esas cifras con placeholders en un README plantilla.
- **Criterios de aceptación:** `grep -c "231" README.md` → 0; la suma de asistentes nombrados+resto = nº real de targets; CI falla si el README y el manifest divergen en el recuento (probar bajando el número a mano).
- **Esfuerzo:** S

## SPEC-053: No existe CONTRIBUTING.md ni doc de arquitectura para contribuidores
- **Área / Prioridad:** Docs / P2-media
- **Problema:** El proyecto pide comunidad (FASE 8) pero no dice cómo contribuir: ni cómo se autora una skill (rúbrica, evals mínimas, gate conductual), ni cómo correr los tests/lints, ni cómo fluye el sistema (autoría→manifest→instalación). Un PR externo hoy llegaría sin pasar por el pipeline de calidad porque nadie se lo contó.
- **Evidencia:** `ls CONTRIBUTING.md` → no existe (2026-07-03); tampoco ARCHITECTURE.md ni docs/ trackeado (es scratch gitignorado); el único onboarding es el README orientado a usuarios.
- **Propuesta:** (1) `CONTRIBUTING.md` con: cómo proponer una skill (estructura `skills/<id>/`, frontmatter, mínimos de evals 5/4/1, `npm run validate && npm run manifest && bash scripts/eval-lint.sh && npm test`), el gate de calidad (rúbrica `scripts/skill-rubric.md`, umbral 8.5 + lift, workflows de eval/harden), convenciones de PR, y qué NO se acepta (skills sin evals, claims sin fuente datada — enlaza la política de SPEC-006/027). (2) `ARCHITECTURE.md` breve derivado del mapa de esta auditoría (`docs/wiki/00-mapa.md` ya contiene el 90%: flujo, adaptadores, hooks, CI) — mantenerlo como doc trackeado. (3) Enlazar ambos desde el README.
- **Criterios de aceptación:** Ambos archivos existen en la raíz, enlazados desde README; CONTRIBUTING lista los 4 comandos de verificación exactos; GitHub muestra el aviso "Contributing guidelines" al abrir PR/issue.
- **Esfuerzo:** M

## SPEC-054: Sin puntero al changelog desde README/npm
- **Área / Prioridad:** Docs / P3-baja
- **Problema:** Las release notes existen (GitHub Releases automatizadas) pero ni README ni la página de npm las enlazan; un usuario de npm no tiene forma obvia de saber qué cambió entre 0.1.x.
- **Evidencia:** `ls CHANGELOG*` → nada; README sin enlace a `/releases` (grep "releases" → 0 hits relevantes); releases v0.1.33-35 verificadas con notas.
- **Propuesta:** Añadir al README (sección Update) una línea "Full changelog: github.com/ericrisco/rsc-harness/releases" — y opcionalmente el campo no estándar pero convencional en el header del README de npm. No crear CHANGELOG.md manual (las releases automatizadas son la fuente; duplicar sería deuda).
- **Criterios de aceptación:** El enlace a releases visible en README renderizado en GitHub y npm.
- **Esfuerzo:** S

## Hallazgos SIN spec (una línea cada uno)

- No hay `rsc --version` (la línea de uso tampoco lo lista): añadirlo entra en el paquete de ergonomía de **SPEC-034** (help/version juntos); anotado allí como extensión natural.
- `docs/` está gitignorado como scratch local y `02-DOCS/` es privado por diseño — coherente con la política del repo; esta auditoría trackea `docs/wiki/` explícitamente con `git add -f` por mandato de la misión.
- El bloque OKF del README (línea 259) es denso pero funcional; si se aplica SPEC-048 (sitio estático), es candidato natural a moverse a una página.
- No hay CODE_OF_CONDUCT.md: opcional para un repo personal; añadirlo solo si SPEC-050 (marketplace oficial) lo exige en su validación.
