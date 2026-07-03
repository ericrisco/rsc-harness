# 04 — CLI & Developer Experience

> FASE 5. Generado 2026-07-03. Método: revisión de código de `scripts/rsc.js`, `install-apply.js`, `lib/*`, `targets/*` + **prueba del flujo real** en directorios temporales (install claude+codex, uninstall, doctor, consult, help). Los hallazgos marcados "verificado en vivo" se reprodujeron ejecutando el CLI.

## Lo que está BIEN (verificado, sin spec)

- Instalación real limpia (verificado en vivo): `add nextjs --target claude` crea base compartida `.rsc/skills/`, symlinks, hooks en settings.json, backup previo, y fuerza `orient`+`suggest`.
- `consult` multilingüe funciona notablemente bien en vivo: "vull fer una web per vendre formatges" (catalán coloquial) → nextjs/design/secure-coding/deployment con outcome-labels; "subir vídeos a youtube por api" → youtube-api. (Corrige la semilla de la FASE 1 que especulaba lo contrario.)
- Windows sin divergencia de base: `sync` → `linkOrCopy` re-copia incondicionalmente en win32 (`targets/index.js:22-24`); las copias no quedan viejas tras un sync.
- `purge` limpia correctamente `.mdc`, bloques markdown y entradas de settings.json preservando hooks del usuario (`targets/claude.js:22-38`, `targets/_md-block.js:33-42`).
- Los prompts TUI tienen fallback sin TTY (`ui.js:224-233`) y `add`/`install --profile` son utilizables en CI sin flags.

## Specs

## SPEC-029: `rsc add <id-inexistente>` revienta con ENOENT crudo — sin validación de ids contra el manifest
- **Área / Prioridad:** CLI & DX / P1-alta
- **Problema:** Ningún punto del camino de instalación valida el id; el error llega desde `cpSync` como ENOENT con path absoluto de la máquina del autor del paquete. Sin "skill 'x' no existe", sin sugerencia de ids parecidos.
- **Evidencia:** Verificado en vivo: `rsc add skill-que-no-existe` → `rsc error: ENOENT: no such file or directory, lstat '…/skills/skill-que-no-existe'` (exit 1). Código: `scripts/rsc.js:165-175` y `scripts/install-plan.js:6-8` no validan; el id llega a `ensureBase`→`cpSync` (`scripts/install-apply.js:46`).
- **Propuesta:** En el case `add` (y `install`), cargar el manifest y filtrar ids: los inexistentes se listan con error claro + sugerencia por distancia de edición (Levenshtein simple ≤2 o prefijo común) contra los 232 ids: `skill 'nextjss' no existe. ¿Quisiste decir 'nextjs'? Usa 'rsc catalog' para ver todas.` Salir 1 sin instalar nada si TODOS son inválidos; instalar los válidos avisando de los inválidos si hay mezcla.
- **Criterios de aceptación:** `rsc add no-existe` sale 1 con mensaje que incluye el id y una sugerencia; `rsc add nextjs no-existe` instala nextjs y avisa; test en `tests/rsc-cli.test.js`.
- **Esfuerzo:** S

## SPEC-030: `uninstall --all --target X` ignora el target y purga TODOS los targets (pérdida de datos cross-target)
- **Área / Prioridad:** CLI & DX / P0-crítica
- **Problema:** `uninstall --all` es alias silencioso de `purge` global: con claude y codex instalados, pedir `--all --target claude` borró el `.rsc/` compartido, el bloque de `AGENTS.md` de codex y `.claude/settings.json`. El usuario pidió limpiar UN target y perdió la instalación de todos. Solo un comentario en el código lo documenta.
- **Evidencia:** Verificado en vivo (2026-07-03): tras `add fastapi --target claude` + `add fastapi --target codex`, `uninstall --all --target claude` eliminó 13 paths incluyendo `.rsc/` entero y dejó `AGENTS.md` sin marcadores (instalación codex rota). Código: `scripts/rsc.js:278-279` — `// 'uninstall --all' is an alias for a full purge.` + `if (argv.includes('--all')) return void (await runPurge(...))` sin mirar `--target`.
- **Propuesta:** (1) Si se pasa `--target`, `--all` debe desinstalar todas las skills de ESE target (iterar ids del state del target + `unwireHook` de ese target), no purgar. (2) Sin `--target` explícito, mantener el alias purge pero pidiendo confirmación (o exigir `--force`) listando los targets afectados. (3) Actualizar la línea de uso y añadir tests: caso scoped y caso global.
- **Criterios de aceptación:** Reproducir el escenario del bug deja intactos `AGENTS.md` y las bases usadas por codex; `uninstall --all` sin target pide confirmación (o `--force`); tests nuevos en `tests/purge.test.js`/`rsc-cli.test.js` verdes.
- **Esfuerzo:** M

## SPEC-031: `uninstall <id>` deja hooks zombis, subagente y bases huérfanas
- **Área / Prioridad:** CLI & DX / P1-alta
- **Problema:** Desinstalar skills nunca desconecta el hook: quitar la última skill (incluso `suggest`) deja las 5 entradas de `.claude/settings.json` apuntando a `.rsc/*.mjs`, el bloque `<!-- rsc-suggest -->` en AGENTS.md, el `.mdc` de cursor, el subagente `developer` y las bases en `.rsc/skills/`. Si `suggest` ya no existe, `session-start.mjs` falla silencioso: hook zombi.
- **Evidencia:** `scripts/install-apply.js:116-142` (uninstall no llama `unwireHook`); `targets/session-start.mjs:34` (try/catch que emite nada si falta el SKILL.md). El DX-review lo confirmó rastreando el flujo completo.
- **Propuesta:** En `uninstall`: (1) si tras la operación el state del target queda sin skills (o sin `suggest`), llamar `unwireHook(target, paths)` y borrar el subagente developer de ese target; (2) borrar la base `.rsc/skills/<id>` si ningún otro target la referencia (consultar los `.rsc-state.json` de todos los targets); (3) informar de lo limpiado.
- **Criterios de aceptación:** Desinstalar la única skill de claude deja `settings.json` sin entradas `.rsc/` y sin `developer.md`; con codex aún instalado la base compartida sobrevive; tests que cubren ambos casos.
- **Esfuerzo:** M

## SPEC-032: No existe `rsc update` — actualizar skills requiere 2 pasos y el nudge de sesión apunta al comando equivocado
- **Área / Prioridad:** CLI & DX / P1-alta
- **Problema:** Para recibir SKILL.md mejorados tras una release el usuario debe (1) actualizar el paquete y (2) `rsc sync` — dos pasos no encadenados. Peor: el nudge de update de SessionStart dice ejecutar `npx @ericrisco/rsc@latest`, que abre el **wizard** (re-selección manual), no un sync. `upgrade` imprime la guía correcta pero es otra ruta distinta.
- **Evidencia:** `scripts/lib/upgrade.js:11-18` (upgrade no ejecuta sync); `targets/session-start.mjs:158-165` (nudge → comando que lanza el wizard, `rsc.js:163-164`); `scripts/rsc.js:257-260` ("After upgrade: rsc sync"). Mecánica de staleness: `.rsc/.base-versions.json` vs `CLI_VERSION` (`install-apply.js:42`) — sync ya sabe re-copiar; solo falta encadenar.
- **Propuesta:** (1) Nuevo comando `rsc update`: ejecuta la actualización del paquete (o detecta que ya corre la última vía `npx @latest`) y encadena `syncInstalled` para todos los targets del state, informando qué skills cambiaron de versión de base. (2) Cambiar el nudge de `session-start.mjs` a `npx @ericrisco/rsc@latest update`. (3) `upgrade` queda como alias documentado o se fusiona.
- **Criterios de aceptación:** En un proyecto con base vieja (simular bajando `.rsc/.version`), `rsc update` deja `.base-versions.json` al día y los symlinks/copias renovados en un solo comando; el nudge imprime el comando nuevo; tests de `handoff` no rotos.
- **Esfuerzo:** M

## SPEC-033: `rsc doctor` es superficial: no detecta hooks des-registrados, bases desactualizadas ni bloques rotos
- **Área / Prioridad:** CLI & DX / P2-media
- **Problema:** doctor solo mira: ids del state, ficheros missing, `existsSync(settings.json)` como "hookWired", nº de skills del manifest y backups — de UN solo target. No detecta: entradas de hook ausentes en settings.json aunque el archivo exista, `.rsc/*.mjs` borrados, base con versión distinta al CLI, bloque `<!-- rsc-suggest -->` roto/ausente en AGENTS.md, ni targets adicionales instalados. Además imprime JSON crudo.
- **Evidencia:** `scripts/doctor.js:14-29`; `hookWired` = `existsSync(paths.hookTarget)` (`:19`); salida `JSON.stringify` en `scripts/rsc.js:224`. Verificado en vivo: la salida es un blob JSON sin diagnóstico accionable.
- **Propuesta:** Ampliar doctor: (1) iterar todos los targets con state presente; (2) por target claude: parsear settings.json y verificar las 5 entradas de hook + existencia de los 4 `.mjs`; por targets md: verificar par de marcadores en el archivo de reglas; (3) comparar `.rsc/.version` y `.base-versions.json` con la versión del CLI → "run rsc sync"; (4) salida humana con ✅/⚠️ y sugerencia de comando por cada hallazgo, `--json` para la salida actual.
- **Criterios de aceptación:** Borrar a mano una entrada de hook de settings.json hace que doctor lo señale con el comando de reparación; base vieja → sugiere sync; `doctor --json` mantiene el shape actual (tests de regresión).
- **Esfuerzo:** M

## SPEC-034: Ergonomía básica: sin `help`, `add` mudo sobre lo que hizo, errores de sistema sin traducir
- **Área / Prioridad:** CLI & DX / P2-media
- **Problema:** (a) `--help`/`-h`/`help` caen en "unknown command" (aunque imprimen la línea de uso); (b) `rsc add` solo dice "✅ Installed" sin qué archivos escribió ni siguiente paso (`printNextSteps` solo se usa en el wizard); (c) el catch global muestra mensajes crudos de Node (EACCES, JSON.parse de manifest corrupto sin nombrar el archivo).
- **Evidencia:** Verificado en vivo: `rsc --help` → "rsc: unknown command '--help'". Código: `scripts/rsc.js:286-288` (default), `:174` (add), `:292-295` (catch global `e.message`); `scripts/lib/manifest.js:8` (JSON.parse sin contexto; contraste con el fallback de `lib/state.js:6`).
- **Propuesta:** (1) Case explícito `help|--help|-h` con salida agrupada por área (instalar/consultar/mantener) y exit 0. (2) `add` imprime resumen: skills instaladas, targets, nº de archivos, y 1 línea de next step ("abre tu asistente; la skill se auto-dispara"). (3) Envolver `loadManifest` con mensaje que nombre el path y sugiera `npm run manifest`; mapear EACCES → "sin permisos de escritura en X".
- **Criterios de aceptación:** `rsc help` sale 0 con ayuda; `rsc add nextjs` imprime resumen y next step; manifest corrupto da mensaje con path del archivo; tests CLI actualizados.
- **Esfuerzo:** S

## SPEC-035: Ctrl+C en el wizard deja instalación parcial sin aviso de recuperación
- **Área / Prioridad:** CLI & DX / P3-baja
- **Problema:** SIGINT durante el bucle multi-target hace `process.exit(130)` inmediato: unos targets quedan instalados y otros no, y el usuario no sabe que existe un backup previo restaurable.
- **Evidencia:** `scripts/lib/ui.js:180,217` (exit inmediato); bucle multi-target `scripts/rsc.js:145-148`; backup previo en `install-apply.js:83`.
- **Propuesta:** Handler de SIGINT durante la fase de aplicación: al abortar, imprimir qué targets quedaron completos/incompletos y el comando de recuperación (`rsc restore latest` o `rsc sync`). No hace falta rollback automático.
- **Criterios de aceptación:** Interrumpir el wizard entre targets imprime el estado parcial y el comando de recuperación (test manual documentado; unit test del handler si es factible).
- **Esfuerzo:** S

## Hallazgos SIN spec (una línea cada uno)

- `consult` etiqueta con outcome-label solo ~15 skills headline; el resto repite el id (cosmético, coherente con el diseño de `toOutcomes`).
- El danger-guard bloqueó un `rm -rf` legítimo sobre un directorio temporal de pruebas durante esta auditoría — funciona, pero su falso-positivo sobre paths de scratchpad se anota para la FASE 7 (superficie de hooks).
- No hay flag `--yes` para el wizard, pero la vía CI real son `add`/`install --profile` (no interactivos): suficiente, documentarlo en el README (FASE 9).
