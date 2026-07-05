# 03 — Frescura de fuentes y versiones

> FASE 4. Generado 2026-07-03. Método: sweep programático de fechas/versiones/URLs en los 232 SKILL.md + verificación web contra fuentes oficiales (GitHub releases, changelogs de Meta/Stripe/LinkedIn/YouTube/OpenAI/Google/Anthropic, PyPI/npm) realizada 2026-07-03 por dos agentes de research.

## Estado de referencia verificado (2026-07-03)

| Tecnología | Actual a 2026-07 | Lo que cita el catálogo | Veredicto |
|---|---|---|---|
| Next.js | **16.2.x GA** (16 GA desde oct-2025) | `nextjs` cubre 15/16 dual ✓; `design`+`secure-coding` citan "Next.js 15" como stack actual | Parcialmente obsoleto |
| Angular | **22.0.x** (GA 2026-06-03; 21 en LTS) | `angular` cita 20/21 | Obsoleto |
| FastAPI | 0.139.0 | 0.136 | Drift menor |
| Flutter | 3.44.4 | 3.44 | ✓ |
| React | 19.2.x | React 19 | ✓ |
| Python | 3.14.6 estable | 3.12 como baseline en varios | Drift menor |
| Remotion | 4.0.484 | 4.0.261 | Drift menor |
| WhisperX | 3.8.6 | 3.8.5 | Drift menor |
| pandas | 3.0.4 (3.0.0: 2026-01-21) | "3.0.0 shipped 2026-01-21" | ✓ exacto |
| Meta Graph API | **v25.0** (v26 no existe aún) | v25.0 (13 refs) | ✓ |
| Stripe API | 2026-06-24.dahlia | 2026-05-27.dahlia | Drift menor (pin válido) |
| LinkedIn API | Linkedin-Version 202606 | 202605/202605 | ✓ (válida ≥1 año) |
| YouTube Data API | v3, cuotas granulares jun-2026 | `youtube-api` ya las refleja con fuente datada | ✓ ejemplar |
| TikTok API | v2, cambios 2026 (fotos, webhooks) | v2 | ✓ |
| OpenAI | gpt-5.5/gpt-5.4-*; **gpt-4o legacy** (retirado de ChatGPT 2026-02) | gpt-4o en ejemplos de código; gpt-5.1 en 4 refs | Obsoleto |
| Anthropic | claude-fable-5 / claude-opus-4-8 / **claude-sonnet-5** / claude-haiku-4-5 | claude-sonnet-4-6 en 4 skills + CLI | Obsoleto |
| Google Gemini | gemini-3.5-flash estable | gemini-2.5-flash/pro solo en CLI (`targets/agents.js`) | Obsoleto (CLI) |
| Ollama | v0.30.x; MLX en Apple Silicon confirmado | claims MLX con fuente | ✓ |

Fuentes primarias: [Next.js releases](https://github.com/vercel/next.js/releases) · [Angular releases](https://github.com/angular/angular/releases) · [Meta Graph API versions](https://developers.facebook.com/docs/graph-api/changelog/versions/) · [Stripe changelog](https://docs.stripe.com/changelog) · [LinkedIn versioning](https://learn.microsoft.com/en-us/linkedin/marketing/versioning) · [YouTube revision history](https://developers.google.com/youtube/v3/revision_history) · [OpenAI API changelog](https://developers.openai.com/api/docs/changelog) · [Gemini models](https://ai.google.dev/gemini-api/docs/models) · [Claude models overview](https://platform.claude.com/docs/en/about-claude/models/overview) · [resend en npm](https://www.npmjs.com/package/resend) · [Ollama releases](https://github.com/ollama/ollama/releases)

## Lo que está BIEN (verificado, sin spec)

- El ancla de frescura es real: 124 citas "accessed 2026-06" + 13 más "as of/verified 2026-06"; ninguna fecha de verificación anterior a 2026-05 en todo el catálogo.
- `youtube-api` refleja YA el cambio de cuotas granulares de 2026-06-01 con URL oficial y fecha — es el patrón a imitar.
- Meta v25.0 (13 refs), LinkedIn 202605, TikTok v2, Flutter 3.44, pandas 3.0, React 19, claims MLX de Ollama: todos correctos a 2026-07.
- El v22.0 de `instagram-api:174` es una fila de changelog histórico (rename plays→views), no una versión recomendada: correcto.

## Specs

## SPEC-022: Model-ids obsoletos que el CLI escribe en la config del usuario (`targets/agents.js`)
- **Área / Prioridad:** Frescura / P1-alta
- **Problema:** El subagente `developer` que instala el CLI escribe model-ids desfasados en los configs de los 8 targets con agentes: Sonnet 4.6 cuando existe `claude-sonnet-5`, Gemini 2.5 cuando la estable actual es 3.5-flash, GPT-5.1 cuando la familia actual es 5.4/5.5, y kiro hardcodea `claude-sonnet-4`/`claude-opus-4` (dos generaciones atrás).
- **Evidencia:** `targets/agents.js:13` `anthropic: { balanced: 'claude-sonnet-4-6', heavy: 'claude-opus-4-8' }`; `:14` `google: { balanced: 'gemini-2.5-flash', heavy: 'gemini-2.5-pro' }`; `:15` `openai: { balanced: 'gpt-5.1-mini', heavy: 'gpt-5.1' }`; `:29` kiro `'claude-opus-4' : 'claude-sonnet-4'`. Estado actual verificado 2026-07-03 (tabla de referencia arriba).
- **Propuesta:** Actualizar `TIER_MODEL`: anthropic `{balanced: 'claude-sonnet-5', heavy: 'claude-opus-4-8'}`; google `{balanced: 'gemini-3.5-flash', heavy: 'gemini-3.1-pro-preview'}` (o mantener `gemini-2.5-pro` en heavy si se exige estable sin sufijo preview — decidir y comentar en el código); openai `{balanced: 'gpt-5.4-mini', heavy: 'gpt-5.5'}`. kiro: `claude-sonnet-5`/`claude-opus-4-8` (verificar naming aceptado por Kiro en su doc antes de aplicar). Añadir comentario con fecha de verificación y URL para el próximo refresh. Actualizar asserts en `tests/agents.test.js`.
- **Criterios de aceptación:** `grep -n "sonnet-4-6\|gemini-2.5\|gpt-5.1" targets/agents.js` → 0 hits (salvo decisión documentada en heavy de google); `npm test` verde; una instalación fresh en dir temporal escribe los ids nuevos.
- **Esfuerzo:** S

## SPEC-023: Ejemplos de código con modelos OpenAI legacy (gpt-4o) o desfasados (gpt-5.1)
- **Área / Prioridad:** Frescura / P1-alta
- **Problema:** gpt-4o fue retirado de ChatGPT (2026-02-13) y es legacy en la API; los ejemplos que lo usan enseñan al agente a escribir código con un modelo no recomendado. gpt-5.1 quedó superado por 5.4/5.5.
- **Evidencia:** `skills/llm-pipeline/SKILL.md:50,51,60` (`model="gpt-4o"`); `skills/observability/SKILL.md:114,116` (`'chat gpt-4o'`, `gen_ai.request.model`); 4 refs a `gpt-5.1` (localizar con `grep -rn "gpt-5.1" skills/*/SKILL.md`). Estado actual: changelog oficial de OpenAI (verificado 2026-07-03).
- **Propuesta:** Sustituir gpt-4o por `gpt-5.4-mini` (o el placeholder de config que ya predica `building-agents`: "model resolved from config, never literal in logic" — preferir esta segunda opción donde el ejemplo lo permita) y gpt-5.1 por la familia vigente. Añadir "(as of 2026-07)" junto a cada id concreto que quede.
- **Criterios de aceptación:** `grep -rn "gpt-4o" skills/*/SKILL.md` → 0 hits en código de ejemplo (se permite mención histórica explícitamente marcada); ids restantes llevan fecha.
- **Esfuerzo:** S

## SPEC-024: `claude-sonnet-4-6` citado como modelo vigente en 4 skills
- **Área / Prioridad:** Frescura / P1-alta
- **Problema:** Existe `claude-sonnet-5`; los ejemplos que fijan Sonnet 4.6 como "balanced" actual quedaron una generación atrás — especialmente irónico en skills cuyo tema es construir agentes.
- **Evidencia:** `skills/building-agents/SKILL.md:98,189`; `skills/llm-pipeline/SKILL.md:80`; `skills/sdd-init/SKILL.md:129`; `skills/structured-extraction/SKILL.md` (localizar línea con grep). Referencia oficial de modelos Anthropic verificada 2026-07-03.
- **Propuesta:** Sustituir `claude-sonnet-4-6` → `claude-sonnet-5` en las 4 skills; donde el texto diga "e.g." mantener el espíritu de ejemplo añadiendo "(current as of 2026-07)". Coordinar con SPEC-022 (mismo id en `targets/agents.js` y en `.rsc/developer.json` si aplica — verificar con `grep -rn "sonnet-4-6" targets/ scripts/`).
- **Criterios de aceptación:** `grep -rn "sonnet-4-6" skills/ targets/ scripts/` → 0 hits; `npm test` verde.
- **Esfuerzo:** S

## SPEC-025: Skill `angular` desfasada una major (cita 20/21; Angular 22 es GA desde 2026-06-03)
- **Área / Prioridad:** Frescura / P1-alta
- **Problema:** La skill fija Angular 20/21 y features "since 21.0.0-next.2" (pre-release que ya es estable), sin ninguna fuente datada. Angular 22 salió GA un mes antes de esta auditoría; 21 pasó a LTS.
- **Evidencia:** `grep -n "Angular 2" skills/angular/SKILL.md` → 3× "Angular 21", 2× "Angular 20"; `:234` "Signal Forms… since Angular 21.0.0-next.2". Releases oficiales: Angular 22.0.5 (2026-07-01). La FASE 2 ya marcó esta skill como la más floja de la muestra (0 fuentes datadas, evals mínimas — SPEC-005/006).
- **Propuesta:** Re-investigar y actualizar el body a Angular 22 (mencionando 21 LTS hasta may-2027), estabilizar la referencia a Signal Forms con su estado real en 22, añadir fuentes con fecha de acceso (patrón `youtube-api`), y reforzar evals (2º escenario capability). Es la candidata ideal para el primer pase del workflow `skill-harden`.
- **Criterios de aceptación:** El body cita Angular 22 con ≥2 fuentes oficiales datadas; `grep -n "21.0.0-next" skills/angular/SKILL.md` → 0; evals con ≥2 capability; pasa `eval-lint.sh`.
- **Esfuerzo:** M

## SPEC-026: "Next.js 15" citado como stack actual en `design` y `secure-coding` (16 es GA desde oct-2025)
- **Área / Prioridad:** Frescura / P2-media
- **Problema:** La description de `design` (visible al agente en cada matching) vende "Tailwind v4 + Next.js 15 + React 19" y `secure-coding` fija su stack en "Next.js 15". La skill `nextjs` ya cubre 15/16 dual — las otras dos quedaron ancladas.
- **Evidencia:** `skills/design/SKILL.md:3` (description); `skills/secure-coding/SKILL.md:13,118,121`. Next.js 16 GA desde 2025-10; estable actual 16.2.x (verificado 2026-07-03).
- **Propuesta:** En `design`: description → "Next.js 16". En `secure-coding`: ":13" → "Next.js 15/16"; los comentarios de código `:118,121` ("params is a Promise — await it") siguen siendo válidos en 16, solo reetiquetar "Next.js 15/16". Regenerar manifest.
- **Criterios de aceptación:** `grep -rn "Next\.js 15" skills/design/ skills/secure-coding/` solo devuelve formas "15/16"; manifest regenerado.
- **Esfuerzo:** S

## SPEC-027: Drift menor de versiones pinadas — sweep + política de pin por serie
- **Área / Prioridad:** Frescura / P3-baja
- **Problema:** Varios pins exactos han quedado un patch/minor atrás. No son errores (las versiones citadas existieron) pero envejecen mal porque el catálogo pina parches exactos en vez de series.
- **Evidencia (verificado 2026-07-03):** FastAPI 0.136 → actual 0.139.0 (2 refs); resend 6.12.4 → 6.16.0 (`email-connector:21`); Remotion 4.0.261 → 4.0.484 (`shortform-editing:104`); WhisperX 3.8.5 → 3.8.6 (`shortform-editing:55`); Stripe `2026-05-27.dahlia` → `2026-06-24.dahlia` (2 refs en `stripe`, pin aún válido); `whatsapp-telegram:45` afirma "v24.0 is the lowest still supported" cuando la página oficial de Meta lista ~v21.0 como mínima vigente (verificar en la página de versiones al aplicar).
- **Propuesta:** (1) Corregir los 6 puntos citados. (2) Adoptar política de pin por serie donde el parche no sea load-bearing: "FastAPI 0.139+ (checked 2026-07-03)", "Remotion 4.x (4.0.484 at last check)". (3) Documentar la política en `scripts/skill-rubric.md` (dim. 4) para que el harden loop la aplique.
- **Criterios de aceptación:** Los 6 puntos actualizados con fecha de verificación; la rúbrica incluye la política de pin por serie; `whatsapp-telegram` cita la versión mínima real de la página oficial.
- **Esfuerzo:** S

## SPEC-028: Sin cadencia de re-verificación — la frescura es una foto de junio-2026 que caducará en bloque
- **Área / Prioridad:** Frescura / P2-media
- **Problema:** Solo 36/232 skills llevan fecha de verificación y casi todas las citas son "accessed 2026-06" — el catálogo se verificó una vez, en bloque. Sin proceso recurrente, dentro de 6 meses las 232 estarán igual de desfasadas y no habrá forma barata de saber cuáles.
- **Evidencia:** Sweep 2026-07-03: 124× "accessed 2026-06", 9× "as of 2026-06", 4× "verified 2026-06", 1× "as of 2026-05"; 36 archivos con alguna fecha. Los hallazgos de SPEC-022…027 existían pese a la verificación de hace 1 mes.
- **Propuesta:** (1) Convención: toda skill con claims perecederos lleva una línea `> Last verified: YYYY-MM-DD` bajo el H1 (las 36 actuales ya casi lo hacen; extender a las que citen versiones — lista del sweep de SPEC-006). (2) Nuevo workflow `scripts/freshness-check.workflow.js` (patrón scoreboard): para un dominio dado, extrae versiones/fechas citadas, las verifica con búsqueda web y devuelve la lista de drift — exactamente el procedimiento manual de esta fase, automatizado. (3) Cadencia trimestral documentada (puede dispararse con el nudge de 14 días del SessionStart hook ampliado a "freshness due").
- **Criterios de aceptación:** Convención documentada en la rúbrica; workflow existe y sobre `skills/angular` reproduce el hallazgo de SPEC-025; ≥1 ejecución registrada en `02-DOCS` o docs/wiki.
- **Esfuerzo:** M

## Hallazgos SIN spec (una línea cada uno)

- `nextjs` (dual 15/16), `youtube-api` (cuotas jun-2026), `instagram-api` (v25 + historial), `stripe` (pin dahlia válido), `tiktok-api` (v2), `flutter`, `ollama` (MLX), `data-cleaning` (pandas 3.0 exacto): frescura correcta — el problema es la cola, no la cabeza.
- Python 3.12 como baseline en 7 skills: válido como *mínimo soportado*; solo corregir donde se presente como "la versión actual" (revisar en el sweep de SPEC-027).
- Los 140 URLs únicos citados no se han verificado uno a uno (link-rot); el workflow de SPEC-028 debería incluir un check HTTP de estado como sub-tarea barata.
