# 01 — Calidad de skills y triggering

> FASE 2. Generado 2026-07-03. Método: análisis programático de las 232 descriptions/evals (jq/awk sobre `manifest.json` y `skills/*/evals/cases.yaml`) + muestra de 38 skills (2 por dominio) auditadas contra `scripts/skill-rubric.md` por 3 auditores independientes.

## Lo que está BIEN (verificado, sin spec)

- 232/232 skills con `evals/cases.yaml`; todas cumplen los mínimos (≥5 should_trigger, ≥4 should_not_trigger, ≥1 capability). Mínimo real observado: 9 prompts.
- 0 descriptions cortas (<100 chars); media 816 chars; solo `orient` sin frases trigger (justificado: always-on).
- Bodies dentro de banda: ninguno >501 líneas; la mayoría 100–300.
- `must_include` de capability específicos y load-bearing (no keywords triviales) en 36/38 de la muestra.
- `references/` con contenido real en todos los muestreados (34–319 líneas); ninguno de relleno.
- Alineación description↔body correcta en 37/38 (excepción: `analyze`, ver SPEC-009).
- Solapamiento de triggers casi nulo: solo 3 frases duplicadas reales entre 1.938 frases extraídas.

## Specs

## SPEC-001: Descriptions que superan el límite duro de 1024 chars de Claude Code + schema sin maxLength
- **Área / Prioridad:** Calidad skills & triggering / P1-alta
- **Problema:** Claude Code impone máx. 1024 caracteres en `description` ([doc oficial](https://code.claude.com/docs/en/skills)); 2 skills lo superan y serían truncadas/rechazadas. El schema no lo valida, así que CI no lo detecta.
- **Evidencia:** `jq -r '.skills[] | select((.description|length)>1024) | .id'` → `sdd` (1066), `specify` (1037). `schema/frontmatter.schema.json:7` solo tiene `minLength: 10`; sin `maxLength`. `name` tampoco tiene `maxLength: 64` (límite oficial).
- **Propuesta:** (1) Recortar las descriptions de `skills/sdd/SKILL.md` y `skills/specify/SKILL.md` a ≤1024 chars conservando triggers y cláusulas NOT (recortar ejemplos redundantes, no fronteras). (2) Añadir `"maxLength": 1024` a `description` y `"maxLength": 64` a `name` en `schema/frontmatter.schema.json`. (3) Regenerar manifest (`npm run manifest`).
- **Criterios de aceptación:** `npm run validate` pasa; `jq '[.skills[] | select((.description|length)>1024)] | length' manifest.json` → 0; un SKILL.md de prueba con description de 1100 chars hace fallar `npm run validate`.
- **Esfuerzo:** S

## SPEC-002: Cláusulas NOT cross-plataforma ausentes en los clusters youtube/shortform/linkedin/medium (14 skills)
- **Área / Prioridad:** Calidad skills & triggering / P1-alta
- **Problema:** Los clusters de plataforma tienen roles paralelos confundibles (`*-ideation`, `*-packaging`, `*-strategy`, `*-editing`) pero cero desambiguación cruzada: ningún `youtube-*` menciona `shortform-*` y viceversa, y ninguna de las 4 `*-strategy` menciona a las otras 3. Un prompt como "dame ideas de contenido" o "how often should I post" no tiene señal para elegir plataforma.
- **Evidencia:** Verificado programáticamente contra manifest.json (2026-07-03): las 5 `youtube-*` no contienen "shortform" en su description; las 4 `shortform-*` no contienen "youtube"; `linkedin-strategy`, `medium-strategy`, `shortform-strategy`, `youtube-strategy` no se mencionan entre sí. Frase trigger idéntica "how often should I post" en `linkedin-strategy` y `youtube-strategy`.
- **Propuesta:** Añadir a la description de cada una de estas 14 skills una cláusula NOT cross-plataforma con la condición de enrutado: `youtube-ideation`, `youtube-packaging`, `youtube-strategy`, `youtube-thumbnails`, `youtube-api`, `shortform-ideation`, `shortform-packaging`, `shortform-strategy`, `shortform-editing`, `linkedin-strategy`, `linkedin-content`, `medium-strategy`, `medium-writing`, `medium-publishing`. Patrón: "NOT short-form/TikTok/Reels ideation (that is shortform-ideation)" en youtube-ideation, y simétrico. En las 4 `*-strategy`, cualificar los triggers genéricos con la plataforma ("how often should I post **on LinkedIn**") y añadir "NOT <other platform> strategy (that is X-strategy)". Añadir 1 caso `should_not_trigger` con `route_to` a la hermana cross-plataforma en cada `cases.yaml`. Respetar el límite de 1024 chars (SPEC-001).
- **Criterios de aceptación:** Las 14 descriptions contienen ≥1 mención a su hermana cross-plataforma; ninguna frase trigger entrecomillada idéntica compartida entre 2 skills del grupo (re-ejecutar la extracción de frases duplicadas → 0 en este grupo); cada `cases.yaml` de las 14 tiene ≥1 `should_not_trigger` con `route_to` cross-plataforma; `npm run manifest && npm run validate` pasan.
- **Esfuerzo:** M

## SPEC-003: Frases trigger duplicadas entre skills no hermanas
- **Área / Prioridad:** Calidad skills & triggering / P2-media
- **Problema:** Dos pares de skills comparten frase trigger literal, con lo que el mismo prompt dispararía cualquiera de las dos; y `render` repite una frase dentro de su propia description (ruido).
- **Evidencia:** Extracción de las 1.938 frases entrecomilladas del manifest (2026-07-03): "write the landing copy" en `landing-copy` y `marketing`; "ship it" en `deployment` y `ship`; "no open ports detected" dos veces dentro de `render`.
- **Propuesta:** (1) Quitar "write the landing copy" de la description de `marketing` (la dueña natural es `landing-copy`; marketing ya la recomienda) o sustituirla por una frase de estrategia ("plan the launch messaging"). (2) En `deployment`, sustituir "ship it" por una frase de infra ("set up the deploy pipeline") — "ship it" pertenece a `ship` (flujo git). (3) Deduplicar la frase repetida en `render`.
- **Criterios de aceptación:** Re-ejecutar la extracción de duplicados → 0 frases compartidas entre skills distintas; manifest regenerado.
- **Esfuerzo:** S

## SPEC-004: `route_to` sin validar en eval-lint + 3 casos apuntando fuera del catálogo
- **Área / Prioridad:** Calidad skills & triggering / P2-media
- **Problema:** `eval-lint.sh` valida recuentos pero no que `route_to` apunte a una skill real; hay 3 casos que enrutan a skills inexistentes en el catálogo y un sentinel `none` (23 casos) sin contrato declarado.
- **Evidencia:** `route_to: claude-api` en `skills/building-agents/evals/cases.yaml`; `route_to: deep-research` y `route_to: review-content` en `skills/course-storytelling/evals/cases.yaml` (ids que no existen en manifest.json). `grep -c route_to scripts/eval-lint.sh` → 0.
- **Propuesta:** (1) En `scripts/eval-lint.sh`, validar que cada `route_to` ∈ ids del manifest ∪ {`none`} (cargar ids con `jq -r '.skills[].id' manifest.json`). (2) Corregir los 3 casos: `claude-api`→`building-agents` mantiene el caso pero enruta a una hermana real (p.ej. `chatbot` o eliminar el caso), `deep-research`→`market-research`, `review-content`→`course-builder` (o la hermana temática que el autor prefiera — debe existir). (3) Documentar el sentinel `none` en el header de eval-lint.
- **Criterios de aceptación:** `bash scripts/eval-lint.sh` pasa; introducir un `route_to: skill-inventada` en un fixture hace fallar el lint; 0 route_to fuera de catálogo (re-ejecutar el comm de auditoría).
- **Esfuerzo:** S

## SPEC-005: Un solo escenario de capability por skill debilita el gate conductual
- **Área / Prioridad:** Calidad skills & triggering / P2-media
- **Problema:** El gate conductual (baseline vs treatment, ABS_MIN=8.5, LIFT_MIN=1.0) se calcula sobre los escenarios de `capability`; con media 1,1 escenarios/skill, el veredicto pasa/falla depende de n=1 — máxima varianza justo en la métrica insignia del proyecto (el "8.5/10 adversarial").
- **Evidencia:** Recuento programático 2026-07-03: media 1,11 `- scenario:` por `cases.yaml`; la gran mayoría tiene exactamente 1. `scripts/eval-lint.sh:22-24` exige solo ≥1. `scripts/lib/behavior-score.js` promedia coverage sobre los escenarios disponibles.
- **Propuesta:** (1) Subir el mínimo de capability a ≥2 en `eval-lint.sh` de forma escalonada: primero warning, luego error tras la migración. (2) Añadir un 2º escenario de capability (con `must_include` igual de específicos) empezando por las skills de los perfiles `minimal`/`core` y las 15 headline de `recommend.js toOutcomes`. (3) El workflow `skill-harden` ya genera escenarios hold-out — reutilizar ese generador para proponer el 2º escenario y que el autor lo cure.
- **Criterios de aceptación:** `eval-lint.sh` exige ≥2 capability sin fallos en CI; skills de perfiles minimal+core con ≥2 escenarios; media de catálogo ≥1,5.
- **Esfuerzo:** L

## SPEC-006: Estadísticas y versiones perecederas sin fuente datada (patrón transversal, dim. 4 de la rúbrica)
- **Área / Prioridad:** Calidad skills & triggering / P1-alta
- **Problema:** El patrón de fallo más repetido en la muestra (11/38 ≈ 29%): porcentajes, precios y versiones afirmados como hecho sin fuente ni fecha de acceso. La dimensión 4 (Correctness/grounding/freshness) pesa 0.25 — la mayor de la rúbrica — y su anti-cheat la capa a 6 sin fuente citada.
- **Evidencia (por auditor, archivo:línea):** `logistics-ops` SKILL.md:108-176 (31 claims numéricos, 1 fuente); `investor-materials` :47,78,105 (14 claims, 0 fuentes); `ads` (reglas 30-100%/50x sin cita); `fal` :180-182 (precios por imagen/segundo sin fecha); `email-connector` :21 (stack de versiones "as of June 2026" sin URL); `embeddings-search` :35-42 (scores MTEB y precios sin cita); `shortform-editing` :55,104 (WhisperX v3.8.5, Remotion v4.0.261 sin fecha); `angular` :234 (0 fuentes datadas en todo el body); `backups` :44 ("~96% of attacks" sin fuente); `accessibility` :18-19 (split 57%/43% sin atribuir); `performance` :182,:57 ("50–70%", "62%" sin fuente nombrada). Contra-ejemplos que marcan el patrón correcto: `codebase-onboarding`, `market-research`, `api-connector-builder`, `compliance` (todas citan "accessed 2026-06-02" + URL).
- **Propuesta:** (1) Sweep programático de todo el catálogo: `grep -nE '[0-9]+(\.[0-9]+)?(%|x higher|x faster)|\$[0-9]' skills/*/SKILL.md` cruzado con presencia de "accessed 20" o URL en ±5 líneas, para obtener la lista completa de afectadas (la muestra sugiere ~60-70). (2) Para cada afectada: añadir fuente con URL + fecha de acceso (patrón de `codebase-onboarding`), o degradar la cifra a regla de pulgar explícita ("as a rough rule of thumb"), o eliminarla. (3) Añadir el check del sweep como script `scripts/freshness-lint.sh` en modo warning en CI.
- **Criterios de aceptación:** El sweep devuelve 0 claims numéricos perecederos sin fuente/fecha en las 11 skills listadas; `scripts/freshness-lint.sh` existe y corre en ci.yml (warning); las skills corregidas re-pasan `npm run validate`.
- **Esfuerzo:** L

## SPEC-007: Afirmaciones factuales de alta especificidad probablemente fabricadas
- **Área / Prioridad:** Calidad skills & triggering / P0-crítica
- **Problema:** Tres claims verificables de alta especificidad no se pueden corroborar y tienen aspecto de alucinación (nombres/CVEs/adquisiciones "inventadas hacia delante"). En un catálogo cuya propuesta de valor es "researched against live sources", un dato fabricado es el peor defecto posible.
- **Evidencia:** `agent-eval` SKILL.md:182 — "promptfoo (acquired by OpenAI 2026-03)", sin fuente. `embeddings-search` SKILL.md:140 — "Cohere `rerank-v4.0-pro`/`rerank-v4.0-fast` (rerank-3.5 deprecated)": la línea publicada de Cohere era rerank-3.5; naming sospechoso. `deployment` SKILL.md:259 — "March 2026 trivy-action supply-chain incident (GHSA-69fq-xp46-6x23 / CVE-2026-33634), 76 of 77 tags force-pushed" + SHA pineado "known-safe": calca el incidente real tj-actions/changed-files de marzo-2025 (CVE-2025-30066) con fechas/IDs distintos.
- **Propuesta:** Verificar cada claim contra fuentes vivas (GHSA/NVD para el CVE; blog/changelog de Cohere; prensa para la adquisición). Si se confirma → añadir URL + fecha de acceso. Si no → corregir al hecho real (tj-actions CVE-2025-30066 en deployment; rerank-3.5 en embeddings-search) o eliminar la frase (agent-eval). El consejo operativo (pinear a SHA) se conserva en todos los casos.
- **Criterios de aceptación:** Cada uno de los 3 claims tiene URL verificable + fecha de acceso, o ha sido corregido/eliminado; `grep -n "GHSA-69fq" skills/deployment/SKILL.md` no devuelve el ID no verificado sin cita.
- **Esfuerzo:** S

## SPEC-008: Hedges obsoletos "sibling cannot link yet" que afirman algo falso
- **Área / Prioridad:** Calidad skills & triggering / P3-baja
- **Problema:** Varios bodies advierten que skills hermanas nombradas "no existen aún / no se pueden enlazar", pero todas existen en el catálogo. El enrutado no se rompe, pero la prosa afirma algo falso y resta confianza.
- **Evidencia:** `agent-eval` SKILL.md:42 ("KNOWN ids you name but cannot link yet" para prompt-engineering/observability/agent-safety/cost-tracking — las 4 existen); mismo patrón en `data-cleaning` :40, `ollama` :34, `java` ("link only those present").
- **Propuesta:** Sweep: `grep -rn "cannot link yet\|link only those present\|not yet in the catalog" skills/*/SKILL.md`; en cada hit, comprobar contra manifest y borrar el hedge (o convertirlo en enlace directo a la hermana).
- **Criterios de aceptación:** El grep del sweep devuelve 0 hits que nombren skills existentes; manifest regenerado sin cambios de description rotos.
- **Esfuerzo:** S

## SPEC-009: `analyze` — evals enrutan a hermanas incorrectas contradiciendo su propia description
- **Área / Prioridad:** Calidad skills & triggering / P1-alta
- **Problema:** La description de `analyze` dice "NOT root-causing a bug (that is debug)" y "plan → write it first (plan)", pero sus `should_not_trigger` enrutan esos mismos casos a skills equivocadas. Pasa el gate determinista (son ids reales) pero enseña al grader el enrutado erróneo.
- **Evidencia:** `skills/analyze/evals/cases.yaml:173-175` "login test failing with a 500… root cause" → `route_to: secure-coding` (debe ser `debug`; `skills/orient/evals/cases.yaml:117` enruta el mismo caso a `debug`); `:185-187` "Review this pull request diff" → `route_to: secure-coding` (debe ser `review`); `:181-183` "Write the technical implementation plan" → `route_to: fastapi` (debe ser `plan`).
- **Propuesta:** Corregir los 3 `route_to` en `skills/analyze/evals/cases.yaml` a `debug`, `review` y `plan` respectivamente.
- **Criterios de aceptación:** Los 3 casos apuntan a debug/review/plan; `bash scripts/eval-lint.sh` pasa.
- **Esfuerzo:** S

## SPEC-010: `ads` — plazo regulatorio ya vencido presentado como acción futura
- **Área / Prioridad:** Calidad skills & triggering / P3-baja
- **Problema:** Un checklist instruye prepararse "before 2026-06-15"; hoy (2026-07) el plazo ya pasó, así que la instrucción es engañosa.
- **Evidencia:** `skills/ads/SKILL.md:139` — "Account updated for the unified `ad_storage` parameter **before 2026-06-15**".
- **Propuesta:** Reescribir en pasado/estado: "The unified ad_storage parameter became mandatory on 2026-06-15 — verify the account migrated; unmigrated accounts lose conversion modeling." (La FASE 4 hará el sweep general de fechas; este es el caso ya confirmado.)
- **Criterios de aceptación:** `grep -n "before 2026-06-15" skills/ads/SKILL.md` → 0 hits; la frase nueva refleja el plazo como pasado.
- **Esfuerzo:** S

## SPEC-011: Bloque "Project grounding (02-DOCS + CLAUDE.md)" duplicado casi verbatim entre skills
- **Área / Prioridad:** Calidad skills & triggering / P3-baja
- **Problema:** ~15 líneas de prosa idéntica no específica de la skill se repiten al final de (al menos) varias skills; coste recurrente de tokens al cargar la skill y deuda de mantenimiento (cambiar la convención = tocar N archivos).
- **Evidencia:** `skills/deployment/SKILL.md:408-422` y `skills/presentations/SKILL.md:272-288` son prácticamente palabra por palabra. Cuantificar con: `grep -l "Project grounding" skills/*/SKILL.md | wc -l`.
- **Propuesta:** (1) Ejecutar el grep para dimensionar. (2) Decidir: reducir el bloque a 2-3 líneas con puntero a una única fuente canónica (la skill `harness` o una reference compartida), y aplicar la reducción con un script sed sobre los afectados. No eliminar la funcionalidad, solo la duplicación de prosa.
- **Criterios de aceptación:** El bloque duplicado ocupa ≤3 líneas por skill; el contenido canónico vive en un solo archivo; `npm run manifest` sin cambios de frontmatter.
- **Esfuerzo:** M

## SPEC-012: Excepciones de banda de líneas de la rúbrica sin reconciliar (orient 54, deployment 437, fastapi 501)
- **Área / Prioridad:** Calidad skills & triggering / P3-baja
- **Problema:** La rúbrica fija banda 120–400 líneas para el body; 3 skills quedan fuera y no hay mecanismo de excepción documentado, así que cualquier auditoría futura vuelve a marcarlas.
- **Evidencia:** `wc -l`: `skills/orient/SKILL.md` 54 (justificable: always-on, cuerpo mínimo deliberado); `skills/deployment/SKILL.md` 437; `skills/fastapi/SKILL.md` 501.
- **Propuesta:** (1) Recortar `deployment` y `fastapi` a ≤400 moviendo material a `references/` (candidatos: tablas largas de proveedor, walkthroughs). (2) Para `orient`, documentar la excepción en `scripts/skill-rubric.md` (una línea: "always-on skills exentas del suelo de 120").
- **Criterios de aceptación:** `wc -l skills/*/SKILL.md | awk '$1>400'` → 0 hits (excluyendo total); la rúbrica menciona la exención always-on.
- **Esfuerzo:** M

## SPEC-013: `git-workflow` contradice la política de commits del propio harness
- **Área / Prioridad:** Calidad skills & triggering / P3-baja
- **Problema:** La skill ordena "Authorship is always Eric. Never add a Co-Authored-By: Claude trailer", mientras el entorno del harness (y este repo) usan el trailer Co-Authored-By. Dos instrucciones siempre-activas en conflicto directo cuando ambas están cargadas.
- **Evidencia:** `skills/git-workflow/SKILL.md:94-96`.
- **Propuesta:** Decidir una política única (es diseño del autor, `origin: risco`) y condicionar la otra: p.ej. "Never add the trailer **unless the repo's CLAUDE.md/harness policy requires it — repo policy wins**".
- **Criterios de aceptación:** La frase incluye la cláusula de precedencia de política de repo; ninguna otra skill contradice el trailer (grep "Co-Authored-By" en skills/).
- **Esfuerzo:** S

## Hallazgos SIN spec (una línea cada uno)

- Las 12 skills sin cláusula NOT (`nextjs`, `go`, `fastapi`, `flutter`, `postgresdb`, `design`, `building-agents`, `secure-coding`, `deployment`, `harness`, `orient`, `suggest`) son skills-suelo de stack/meta sin hermana confundible directa — ningún auditor encontró confusión real; no se genera spec.
- `gcp-essentials:200` usa `POSTGRES_16` cuando Cloud SQL ya ofrece 17/18 — se difiere al sweep de frescura (FASE 4).
- `angular` es la skill más floja de la muestra (evals al mínimo, 0 fuentes datadas) — cubierta por SPEC-005 y SPEC-006; candidata a primer harden.

## Fuentes

- [Claude Code — Extend Claude with skills](https://code.claude.com/docs/en/skills) (límite de 1024 chars en description, 64 en name)
- [Claude Platform — Skill authoring best practices](https://platform.claude.com/docs/en/agents-and-tools/agent-skills/best-practices)
