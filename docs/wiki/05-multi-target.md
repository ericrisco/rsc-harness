# 05 — Multi-target: los 17 adaptadores

> FASE 6. Generado 2026-07-03. Método: pruebas en vivo de los adaptadores (cursor, codex+amp compartiendo AGENTS.md, ediciones de usuario, marcadores rotos) + lectura de `targets/*` + research web de los formatos vigentes a julio 2026 (docs oficiales de cada herramienta).

## Contexto 2026 (verificado contra docs oficiales, 2026-07-03)

1. **AGENTS.md es estándar consolidado** — la spec la gobierna la Agentic AI Foundation (Linux Foundation); la leen nativamente Codex, Copilot, Cursor, Zed, **Junie (ahora su default)**, Roo, Amp, Windsurf/Devin, Jules, opencode, Aider.
2. **Agent Skills (SKILL.md) se abrió como spec** (dic-2025, agentskills.io) y la adoptaron **Cursor v2.4 (`.cursor/skills/`), Codex (`.agents/skills/`), Zed (reemplazó su Rules Library, retirada en v1.4.2 may-2026), Amp, Gemini CLI, Cline, Kiro**. El directorio neutro emergente es **`.agents/skills/`** (lo leen Codex y Cursor).
3. Cambios que afectan a adaptadores de 2025: **Windsurf → Devin Desktop** (jun-2026; `.devin/rules/` preferido, `.windsurf/rules/` fallback); **Junie migró de `.junie/guidelines.md` a AGENTS.md** (guidelines solo backward-compat); Zed sin Rules Library.

Fuentes: [Cursor rules](https://cursor.com/docs/context/rules) · [Cursor skills](https://cursor.com/docs/skills) · [Codex skills](https://developers.openai.com/codex/skills) · [Zed instructions](https://zed.dev/docs/ai/instructions) · [Devin memories](https://docs.devin.ai/desktop/cascade/memories) · [Junie guidelines](https://junie.jetbrains.com/docs/guidelines-and-memory.html) · [Amp skills](https://ampcode.com/news/agent-skills) · [Cline rules](https://docs.cline.bot/customization/cline-rules) · [Copilot custom instructions](https://docs.github.com/en/copilot/reference/custom-instructions-support) · [Kiro steering](https://kiro.dev/docs/steering/)

## Lo que está BIEN (verificado en vivo, sin spec)

- Bloque `<!-- rsc-suggest -->` compartido e idempotente entre herramientas AGENTS.md: codex+amp instalados → 1 solo bloque; re-instalar no duplica.
- Contenido del usuario FUERA del bloque sobrevive a reinstalaciones; ediciones DENTRO del bloque se revierten (el bloque es propiedad de rsc — correcto).
- `uninstall <ids> --target codex` con amp aún instalado conserva el bloque y la base compartida.
- Zed leyendo AGENTS.md raíz: el mapeo actual (`zed → AGENTS.md`) sigue siendo válido según su cadena de precedencia.

## Specs

## SPEC-036: Adoptar el estándar Agent Skills — instalar SKILL.md nativo (+`.agents/skills/`) en las herramientas que ya lo soportan
- **Área / Prioridad:** Multi-target / P1-alta
- **Problema:** El catálogo ES una colección de SKILL.md, pero el instalador los convierte a formatos con pérdida (`.mdc` sin description real, bloques md sin references/) para herramientas que desde finales de 2025 **ya leen SKILL.md nativo**. rsc está traduciendo a idiomas que el destinatario ya no necesita.
- **Evidencia:** Verificado 2026-07-03 contra docs oficiales: Cursor v2.4 (`.cursor/skills/<id>/SKILL.md` y `.agents/skills/`), Codex (`.agents/skills/`), Zed (skills reemplazan Rules Library), Amp, Gemini CLI, Cline, Kiro. El adaptador actual: `targets/cursor.js` (conversión .mdc), `targets/_md-block.js` (bloque texto), `targets/index.js:40-56` (SPEC por target).
- **Propuesta:** (1) Nueva clase de adaptador `skills-native`: `linkOrCopy` del dir completo de la skill (SKILL.md + references/ + scripts/) a `.agents/skills/<id>` — cubre codex y cursor de una vez — y/o al dir propio (`.cursor/skills/`) según doc de cada tool. (2) Migrar cursor, codex, zed, amp, gemini, cline, kiro a esa clase; mantener el bloque AGENTS.md/`.mdc` alwaysApply SOLO para el hook de suggest (la capa always-on). (3) El resto de targets md (jules, opencode, aider, copilot…) siguen como están hasta que adopten la spec. (4) Actualizar tests de apply por target.
- **Criterios de aceptación:** `rsc add ab-testing --target cursor` produce `.cursor/skills/ab-testing/SKILL.md` (o `.agents/skills/`) con description ÍNTEGRA y references/ presentes; los targets migrados no generan `.mdc` por skill; `npm test` verde con los tests actualizados.
- **Esfuerzo:** L

## SPEC-037: La conversión `.mdc` de Cursor destruye la description (el activo de triggering) y deja punteros muertos a references/
- **Área / Prioridad:** Multi-target / P0-crítica
- **Problema:** Cada `.mdc` generado lleva `description: rsc skill <id>` — Cursor usa ese campo para decidir cuándo aplicar una regla `alwaysApply:false`, así que TODAS las skills instaladas en Cursor pierden su señal de disparo: son reglas muertas salvo referencia manual. Además el body cita `references/*.md` que no se instalan para cursor.
- **Evidencia:** Verificado en vivo 2026-07-03: `.cursor/rules/ab-testing.mdc` → frontmatter `description: rsc skill ab-testing / alwaysApply: false`, sin `globs`; body con 3 referencias a `references/*.md` inexistentes en `.cursor/`. Generador: `targets/cursor.js`.
- **Propuesta:** Arreglo inmediato (independiente de SPEC-036, que lo supersede a medio plazo): (1) `targets/cursor.js` copia la `description` real del frontmatter de la skill al `.mdc` (truncada a lo que Cursor acepte si hay límite); (2) instalar `references/` y `scripts/` de la skill junto a las rules (p.ej. `.cursor/rules/rsc-refs/<id>/`) y reescribir los enlaces relativos, O eliminar los punteros en la conversión con una nota "full references via claude target"; (3) test que asserta que la description del .mdc == la del manifest.
- **Criterios de aceptación:** El `.mdc` generado contiene la description real (verificable con diff contra manifest); 0 enlaces `references/` rotos en `.mdc` instalados; test nuevo verde.
- **Esfuerzo:** M

## SPEC-038: En los targets AGENTS.md, el agente no tiene forma de saber dónde viven las skills instaladas (y los links relativos del bloque apuntan fuera del repo)
- **Área / Prioridad:** Multi-target / P1-alta
- **Problema:** Las skills se enlazan en `.<tool>/rsc/<id>` pero el bloque inyectado en AGENTS.md no menciona ese path en ninguna parte, y contiene enlaces relativos escritos para `.claude/skills/` (`../sdd/SKILL.md`) que desde AGENTS.md en la raíz resuelven FUERA del repo. Un agente Codex/Amp con 20 skills instaladas no tiene ni índice ni ruta para leerlas.
- **Evidencia:** Verificado en vivo 2026-07-03: `grep` del bloque en AGENTS.md → 0 menciones a `.codex/rsc`; 2 enlaces `../sdd/SKILL.md` (líneas 16 y 40 del bloque). Código: `targets/_md-block.js:17-29` (inyección verbatim, sin reescritura); raíces por target en `targets/index.js:44-56`.
- **Propuesta:** En `wireHook` del adaptador md: (1) tras el body de suggest, generar una sección `## Installed rsc skills` con una línea por skill instalada (`<id> — <primera frase de la description> → <root>/<id>/SKILL.md`), regenerada en cada install/uninstall (los datos están en el state); (2) reescribir los enlaces `../<id>/SKILL.md` del body al root del target (`.codex/rsc/<id>/SKILL.md`); (3) nota: si se aplica SPEC-036, el índice apunta a `.agents/skills/`.
- **Criterios de aceptación:** Tras `rsc add go --target codex`, AGENTS.md contiene el índice con `go` y el path real; 0 enlaces `../` que resuelvan fuera del repo dentro del bloque; desinstalar una skill la quita del índice; tests del adaptador md actualizados.
- **Esfuerzo:** M

## SPEC-039: Marcador de cierre roto → el bloque no se actualiza nunca más, en silencio
- **Área / Prioridad:** Multi-target / P2-media
- **Problema:** Si el usuario borra o corrompe `<!-- rsc-suggest:end -->`, `wireHook` detecta el start, intenta el replace con regex que exige el end, no matchea, y termina "bien" sin cambiar nada: el bloque queda congelado para siempre y cada reinstalación informa éxito.
- **Evidencia:** Verificado en vivo 2026-07-03: con el end borrado, `add mysql --target codex` → "✅ Installed", archivo intacto (mismas líneas, end: 0). Código: `targets/_md-block.js:21-25` — `doc.includes(MARK_START)` true, `replace` no-op.
- **Propuesta:** En `wireHook`: si hay start sin end (o end sin start), (1) eliminar la línea del marcador huérfano, (2) advertir por stdout ("bloque rsc dañado — regenerado; revisa contenido manual dentro del bloque"), (3) añadir el bloque limpio al final. Añadir el caso a `tests/agents.test.js` y un check de marcadores balanceados a `rsc doctor` (coordina con SPEC-033).
- **Criterios de aceptación:** Con end borrado, reinstalar deja exactamente 1 par start/end con el body actual y avisa; doctor señala marcadores desbalanceados; test verde.
- **Esfuerzo:** S

## SPEC-040: Adaptadores anclados a mecanismos renombrados/legacy: Windsurf→Devin Desktop y Junie→AGENTS.md
- **Área / Prioridad:** Multi-target / P2-media
- **Problema:** Dos targets escriben en ubicaciones que ya son backward-compat: Windsurf es ahora Devin Desktop y prefiere `.devin/rules/` (`.windsurf/rules/` es fallback), y Junie usa AGENTS.md por defecto (`.junie/guidelines.md` solo por compatibilidad). Funcionan hoy; son deuda que romperá sin aviso cuando los fallbacks caigan.
- **Evidencia:** `targets/index.js:53` (`windsurf: … hook: '.windsurf/rules/rsc-suggest.md'`) y la fila junie (guidelines). Docs oficiales verificadas 2026-07-03: docs.devin.ai/desktop/cascade/memories (`.devin/rules/` preferido, frontmatter `trigger:`); junie.jetbrains.com (AGENTS.md default, JUNIE-618).
- **Propuesta:** (1) `windsurf`: escribir en `.devin/rules/rsc-suggest.md` si `.devin/` existe, si no en `.windsurf/rules/` (detección), y añadir frontmatter `trigger: always_on`; considerar alias de target `devin`. (2) `junie`: cambiar el hook a AGENTS.md raíz (se une a la familia md compartida — gratis con el adaptador existente), manteniendo migración: si existe `.junie/guidelines.md` con bloque rsc, limpiarlo. (3) Actualizar `detectTarget` para `.devin/`.
- **Criterios de aceptación:** Install windsurf en repo con `.devin/` escribe ahí con el frontmatter `trigger`; install junie inyecta en AGENTS.md y no crea guidelines nuevos; migración limpia guidelines antiguos; tests por caso.
- **Esfuerzo:** M

## Hallazgos SIN spec (una línea cada uno)

- Copilot: `.github/copilot-instructions.md` sigue siendo válido y AGENTS.md también — el adaptador actual funciona; opcionalmente unificar a AGENTS.md cuando se aplique SPEC-036/038.
- Cline `.clinerules/`, Roo `.roo/rules/`, Continue `.continue/rules/`, Kiro `.kiro/steering/`, Aider `CONVENTIONS.md`: ubicaciones vigentes a 2026-07 — sin cambio requerido (Cline/Kiro además leen SKILL.md → candidatos a SPEC-036).
- El body de suggest habla de "injected into context at the start of every session" — literal solo en claude; en AGENTS.md es un archivo estático (cosmético; se puede parametrizar la frase en la inyección, no urge).
- Dos herramientas escribiendo el mismo AGENTS.md: sin conflicto observado — el bloque es único y compartido por diseño; el caso "dos instalaciones con versiones distintas del paquete" lo resuelve la última que escribe (aceptable).
