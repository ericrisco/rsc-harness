# 06 — Seguridad y calidad de código

> FASE 7. Generado 2026-07-03. Método: shellcheck sobre los 192 `.sh`, `npm audit`, escaneo de secretos (working tree + historial git), revisión de patrones peligrosos (eval, curl|bash, inyección), inspección del cableado real de hooks en un install de prueba, y comportamiento del paquete npm en instalación.

## Lo que está BIEN (verificado, sin spec)

- **`npm audit`: 0 vulnerabilidades** (3 deps runtime: ajv, sql.js, @iarna/toml).
- **Sin `postinstall`** ni lifecycle scripts no estándar en package.json (solo manifest/validate/test/version/prepublishOnly) — el paquete no ejecuta nada al instalarse.
- **Sin secretos** en el working tree (único hit: mención documental "xoxb-…" en `providers.yaml`, no es un token) ni archivos de credenciales reales en el historial (los `CREDENTIALS.md` históricos son plantillas `_TEMPLATE/` con placeholders `<TOOL>_API_KEY`).
- **Shell muy limpio**: 192 scripts → solo 25 avisos shellcheck (warning+error) en 14 archivos; ningún uso real de `eval` (los hits son lógica de *detección* de eval en verify.sh de wordpress/redis).
- El cableado de hooks **preserva los hooks no-rsc** del usuario al instalar y desinstalar (`targets/claude.js:60-65,87-95`).

## Specs

## SPEC-041: 25 hallazgos shellcheck — 6 verify.sh con ramas `case` duplicadas (checks que nunca se ejecutan) — y sin gate en CI
- **Área / Prioridad:** Seguridad y código / P2-media
- **Problema:** Los avisos dominantes son SC2221/SC2222 (patrón de `case` duplicado: la segunda rama es código muerto) en 6 scripts de verificación — es decir, checks de skills que **no verifican lo que creen verificar**. Además hay 2 errores SC1087 (expansión de array sin llaves) en `community` y varios SC2034/SC2046. No hay shellcheck en CI, así que esto regresará.
- **Evidencia:** Ejecución 2026-07-03 (`shellcheck -S warning` sobre 192 archivos): SC2221/2222 en `skills/{instagram-api,neon,postgresdb,redis,structured-extraction,supabase}/scripts/verify.sh`; SC1087 en `skills/community/scripts/verify.sh:53,67`; total 25 issues / 14 archivos (listado completo reproducible con el mismo comando). El SC2296 de `skills/harness/assets/_TEMPLATE/test_connection.sh:23` es un placeholder intencional de plantilla (`${<TOOL>_API_KEY}`), no un bug.
- **Propuesta:** (1) Corregir los 6 `case` duplicados (fusionar patrones o eliminar la rama muerta) y los 2 SC1087; revisar los SC2034/SC2046 restantes. (2) Añadir step de shellcheck a `ci.yml` (`shellcheck -S warning $(git ls-files '*.sh')`), con `# shellcheck disable=SC2296` inline en la plantilla y cualquier excepción justificada.
- **Criterios de aceptación:** `shellcheck -S warning` sobre el repo sale 0; CI tiene el step y falla si se introduce un aviso nuevo.
- **Esfuerzo:** S

## SPEC-042: Dos skills enseñan `curl | bash` contradiciendo la doctrina A08 de `secure-coding`
- **Área / Prioridad:** Seguridad y código / P2-media
- **Problema:** `secure-coding` prescribe "No `curl … | bash`: download, `sha256sum -c`, then run" (A08), pero `coolify` y `duckdb` enseñan exactamente el pipe directo. Un agente con ambas cargadas recibe instrucciones contradictorias, y el catálogo modela la práctica que su propia skill de seguridad prohíbe.
- **Evidencia:** `skills/coolify/SKILL.md:53` y `skills/coolify/references/install-and-proxy.md:18` (`curl -fsSL https://cdn.coollabs.io/coolify/install.sh | bash`); `skills/duckdb/SKILL.md:48` (`curl https://install.duckdb.org | sh`); doctrina en `skills/secure-coding/SKILL.md:92` y `references/owasp-by-stack.md:400`.
- **Propuesta:** En ambas skills, sustituir por el patrón descarga→verificación→ejecución (coolify publica el script descargable; duckdb tiene `brew install duckdb` ya citado como alternativa — promoverla a primaria) o, si el vendor no publica checksums, mantener el one-liner con un aviso explícito de una línea ("official installer pipes to shell; download and inspect first if policy requires — see secure-coding A08").
- **Criterios de aceptación:** `grep -rnE 'c[u]rl [^|]*\| *(ba)?sh' skills/` solo devuelve hits con el aviso adyacente o en contexto de "no hagas esto"; las dos skills regeneradas pasan validate.
- **Esfuerzo:** S

## SPEC-043: El danger-guard bloquea comandos legítimos de solo lectura (falsos positivos verificados)
- **Área / Prioridad:** Seguridad y código / P1-alta
- **Problema:** El guard hace matching de subcadenas sobre el comando crudo, así que bloquea: (a) un `grep` cuyo PATRÓN de búsqueda contiene "curl|bash" (auditoría de seguridad legítima), y (b) `rm -rf` sobre un directorio temporal de pruebas fuera del proyecto. Para un usuario técnico esto convierte el guard en ruido que acaba desactivado (`.rsc/.no-danger-guard`), perdiendo la protección donde sí vale.
- **Evidencia:** Dos bloqueos reales durante esta auditoría (2026-07-03): `grep -rn "curl.*|.*bash" …` → "BLOCKED … pipes a downloaded script straight into a shell"; `rm -rf $SP/test2` (scratchpad de sesión) → "BLOCKED … deletes whole files/folders irreversibly". Código: `targets/danger-guard.mjs` (matching por regex sobre la cadena completa; default-on sin user-profile).
- **Propuesta:** (1) Antes del matching, extraer las cadenas entrecomilladas del comando (los patrones de grep/sed van citados) y evaluar las reglas de pipe/descarga solo sobre la estructura restante. (2) Para `rm -rf`, permitir prefijos seguros conocidos (`$TMPDIR`, `/tmp/`, `/private/tmp/`) cuando el path esté fuera del proyecto. (3) Considerar default-off cuando no exista `user-profile.md` con nivel no-técnico (hoy es default-on universal). (4) Tests unitarios de los 2 falsos positivos + los verdaderos positivos existentes.
- **Criterios de aceptación:** Los 2 comandos bloqueados de esta auditoría pasan; `rm -rf /` y `curl X | bash` reales siguen bloqueados; tests de ambos lados verdes.
- **Esfuerzo:** M

## SPEC-044: Hooks registrados con paths absolutos de la máquina en `.claude/settings.json`
- **Área / Prioridad:** Seguridad y código / P2-media
- **Problema:** Las 6 entradas de hook embeben el path absoluto del proyecto (`node "/Users/…/proyecto/.rsc/session-start.mjs" …`). Consecuencias: (a) mover/renombrar el proyecto rompe los 6 hooks en silencio; (b) si el usuario commitea `.claude/settings.json` (práctica común para compartir config de equipo), publica su ruta local y los hooks no funcionan para nadie más; (c) doctor no lo detecta (SPEC-033).
- **Evidencia:** Verificado en vivo 2026-07-03 en un install de prueba: `"command": "node \"/private/tmp/.../test-mt/.rsc/session-start.mjs\" ..."`. Generación: `targets/claude.js:54,74,90,104,120` (interpolación de `scriptDest`/`paths.projectRoot` absolutos).
- **Propuesta:** Usar la variable soportada por Claude Code para el dir del proyecto en comandos de hook (`$CLAUDE_PROJECT_DIR`): `node "$CLAUDE_PROJECT_DIR/.rsc/session-start.mjs" …`, eliminando también el argumento projectRoot absoluto (los .mjs pueden derivar el root de esa misma variable o de cwd). Migración: `wireHook` ya reescribe entradas rsc existentes — regenerará las viejas. Documentar en README si `.claude/settings.json` + `.rsc/` son commiteables (recomendación: sí, con paths relativos ya es portable entre máquinas del equipo).
- **Criterios de aceptación:** settings.json generado no contiene paths absolutos (grep `"/Users\|/private\|/home` → 0); los 5 hooks funcionan tras mover el proyecto de directorio (test manual documentado); re-install migra entradas viejas.
- **Esfuerzo:** M

## SPEC-045: `reviewer-guard.sh` es un gate muerto — apunta a un directorio que no existe y no está en CI
- **Área / Prioridad:** Seguridad y código / P3-baja
- **Problema:** El script protege la doctrina de los agentes de `plugins/rsc-review/`, directorio que fue retirado del repo; hoy sale con error siempre y ningún workflow lo invoca. Código muerto que confunde ("¿tenemos gate de reviewers o no?").
- **Evidencia:** `scripts/reviewer-guard.sh` referencia `plugins/rsc-review/agents/*.md`; `ls plugins/` → no existe; `grep -rn reviewer-guard .github/workflows/` → 0 hits. (Coincide con el gate anti-fingerprints del plugin-marketplace retirado en ci.yml, que sí está activo.)
- **Propuesta:** Eliminar `scripts/reviewer-guard.sh` (git conserva la historia). Si la doctrina de confidence-filtering sigue viva en otro artefacto (p.ej. rúbricas de `scripts/`), mover el assert a un test que apunte al archivo real.
- **Criterios de aceptación:** El archivo no existe en `scripts/` o apunta a un path existente y corre en CI; `npm test` verde.
- **Esfuerzo:** S

## Hallazgos SIN spec (una línea cada uno)

- La cadena de suministro npm es mínima y sana: 3 deps runtime, lockfile presente, `--provenance` en el publish de release.yml.
- El modelo de confianza de hooks project-local (`.rsc/*.mjs` auto-ejecutables) es el estándar de Claude Code — el riesgo "repo ajeno trae hooks" es inherente a la plataforma, no a rsc; con SPEC-044 los paths además dejan de ser máquina-específicos.
- `ship-guard` y `userprompt-gate` son fail-open con opt-outs documentados (`.rsc/.no-*`) — diseño razonable, sin hallazgos.
- El escaneo de historial no encontró blobs con nombres de secretos reales; la purga histórica de `02-DOCS` (memoria del proyecto) se mantiene efectiva.
