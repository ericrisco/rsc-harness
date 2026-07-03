# 02 — Grafo de recommends, tags, detectores y manifest

> FASE 3. Generado 2026-07-03. Método: análisis programático completo del grafo (node sobre manifest.json + frontmatter fuente), frecuencias de tags, lectura de `scripts/detect-repo.js`, `scripts/audit.js`, `scripts/lib/manifest.js`.

## Lo que está BIEN (verificado, sin spec)

- **0 recommends colgantes** en los 232 SKILL.md fuente (verificado frontmatter vs manifest).
- **Ciclos**: 352 back-edges (p.ej. `analytics↔kpi-framework`, `webhooks↔stripe`) pero son **inofensivos por diseño**: la expansión de recommends es de 1 salto (`lib/recommend.js`) y la mutua recomendación entre hermanas es intencional. Sin spec.
- **Hubs**: `secure-coding` (52 in), `postgresdb` (37), `deployment` (30) — concentración razonable dado que la expansión capa el output a ≤6; no hay riesgo de avalancha de instalación.
- Cross-check dominios↔manifest limpio y forzado por `tests/domains.test.js`.

## Specs

## SPEC-014: `--validate` no detecta recommends colgantes (se descartan en silencio)
- **Área / Prioridad:** Grafo y manifest / P2-media
- **Problema:** `build-manifest.js` filtra los `recommends` que no existen sin avisar, así que un typo en un id desaparece del manifest sin que CI se entere. Hoy hay 0 colgantes, pero nada impide que entren.
- **Evidencia:** `scripts/build-manifest.js:30` (filtrado silencioso); `npm run validate` solo valida el schema Ajv del frontmatter (`:53`), que no cruza ids.
- **Propuesta:** En el modo `--validate` de `scripts/build-manifest.js`, tras cargar todos los frontmatter, comprobar `recommends ⊆ conjunto de ids` y salir 1 listando `skill -> id-inexistente` por cada violación.
- **Criterios de aceptación:** Añadir `recommends: [skill-inventada]` a un SKILL.md hace fallar `npm run validate` con mensaje que nombra la skill y el id roto; el repo actual pasa.
- **Esfuerzo:** S

## SPEC-015: 17 skills huérfanas — nadie las recomienda y no están en ningún profile
- **Área / Prioridad:** Grafo y manifest / P2-media
- **Problema:** 17 skills solo son alcanzables navegando dominios en el wizard o por `consult`; ninguna otra skill las recomienda ni pertenecen a un profile, así que el mecanismo insignia de auto-recomendación nunca las sugiere.
- **Evidencia:** Cálculo de in-degree sobre manifest.json (2026-07-03): `angular, astro, bash-scripting, chrome-extension, community, course-builder, cpp, csharp-dotnet, firebase, htmx, no-code-app, security-scan, skill-scout, solid-js, svelte, testing-go, vue-nuxt` — in-degree 0 y `profiles: []`.
- **Propuesta:** Añadir aristas desde el padre natural: `go → testing-go`; `secure-coding → security-scan`; `author-skill → skill-scout`; `course-storytelling → course-builder` (o viceversa según diseño); `marketing → community`; `flutter → firebase`; `design → no-code-app`. Para los frameworks (`angular, astro, svelte, vue-nuxt, solid-js, htmx, chrome-extension, cpp, csharp-dotnet, bash-scripting`), la vía correcta no es recommends forzado sino el detector (SPEC-018) — documentar en este spec que quedan cubiertas por señal de repo. Añadir invariante en tests (SPEC-020): toda skill debe tener in-degree ≥1, profile, o señal en detect-repo.
- **Criterios de aceptación:** Re-ejecutar el cálculo de huérfanas → 0 skills sin ninguna de las 3 vías (recommends entrante, profile, señal de detector); `npm run manifest && npm test` pasan.
- **Esfuerzo:** M

## SPEC-016: `profiles: [full]` es metadato muerto — el código trata `full` como "todas"
- **Área / Prioridad:** Grafo y manifest / P2-media
- **Problema:** 20 skills declaran `full` en su frontmatter, pero `skillsForProfile` devuelve TODAS las skills para `full` sin mirar el frontmatter. El metadato es engañoso para autores (parece que hay que optar) y desincroniza documentación y comportamiento.
- **Evidencia:** `scripts/lib/manifest.js:16` — `if (profile === 'full') return manifest.skills.map((s) => s.id);`. Recuento: minimal=4, core=19, full=20 skills con el flag en frontmatter.
- **Propuesta:** Quitar `full` del enum en `schema/frontmatter.schema.json` y de los 20 frontmatter que lo declaran (script sed + regenerar manifest); documentar en el header de `lib/manifest.js` que `full` es un alias computado. Alternativa si el autor prefiere lo contrario: hacer que `full` lea el frontmatter — pero entonces hay que etiquetar las 212 restantes, así que la opción recomendada es la primera.
- **Criterios de aceptación:** `jq '[.skills[] | select(.profiles | index("full"))] | length' manifest.json` → 0; `npm run validate` falla si un SKILL.md declara `profiles: [full]`; `rsc install --profile full` sigue instalando 232.
- **Esfuerzo:** S

## SPEC-017: Tags duplicados por singular/plural que fragmentan el matching de consult
- **Área / Prioridad:** Grafo y manifest / P3-baja
- **Problema:** El ranker de `consult` puntúa matches de tag; pares singular/plural del mismo concepto reparten los matches y hacen el scoring inconsistente entre skills equivalentes.
- **Evidencia:** 13 pares detectados programáticamente (2026-07-03): `deployment~deployments, database~databases, hook~hooks, connector~connectors, queue~queues, service~services, review~reviews, cta~ctas, document-post~document-posts, structured-output~structured-outputs, workflow~workflows, caption~captions` (+ `http~https`, que es par falso — no tocar). 1.140 tags únicos, 949 usados una sola vez.
- **Propuesta:** Normalizar al singular en los SKILL.md afectados (localizar con `grep -l "tags:.*deployments"` etc.), regenerar manifest. Añadir a `--validate` un check de pares plural/singular exactos que falle con la lista.
- **Criterios de aceptación:** Re-ejecutar la detección de pares → solo queda `http~https`; check en `npm run validate` activo; consult devuelve los mismos resultados o mejores para "deploy" (smoke test manual documentado en el PR).
- **Esfuerzo:** S

## SPEC-018: Detectores repo→skill — 6 señales cubren un catálogo con ~34 skills de stack detectables
- **Área / Prioridad:** Grafo y manifest / P1-alta
- **Problema:** `detect-repo.js` solo detecta 6 stacks. El catálogo tiene ~34 skills de stack cuyo repo es identificable por archivos/deps estándar; para un usuario con Angular, Rust o Laravel, `rsc` no sugiere nada (y esas skills son huérfanas también en el grafo — SPEC-015).
- **Evidencia:** `scripts/detect-repo.js:4-17` (tabla completa: next/react, pubspec, requirements/pyproject, go.mod, prisma/migrations/sql, Dockerfile/compose/.github). Skills existentes sin señal: `angular, astro, svelte, vue-nuxt, solid-js, htmx, nestjs, nodejs, electron, chrome-extension, expo, react-native, tauri, rust, java, spring-boot, php, laravel, rails, csharp-dotnet, cpp, django, mongodb, redis, mysql, supabase, firebase, drizzle-orm, wordpress, shopify…`
- **Propuesta:** Ampliar `detectRepo()` con esta tabla (archivo o dep en package.json): `angular.json`→angular; `astro.config.*`→astro; `svelte.config.*`|dep `svelte`→svelte; `nuxt.config.*`|dep `vue`→vue-nuxt; dep `solid-js`→solid-js; dep `htmx.org`→htmx; dep `@nestjs/core`→nestjs; dep `electron`→electron; dep `expo`|`react-native`→expo/react-native; dep `@tauri-apps/api`|`src-tauri/`→tauri; `Cargo.toml`→rust; `pom.xml`|`build.gradle*`→java (+spring-boot si aparece `org.springframework`); `composer.json`→php (+laravel si dep `laravel/framework`); `*.csproj`|`*.sln`→csharp-dotnet; `CMakeLists.txt`→cpp; `Gemfile`→rails; `firebase.json`→firebase; `supabase/`|dep `@supabase/supabase-js`→supabase; dep `mongoose`|`mongodb`→mongodb; dep `ioredis`|`redis`→redis; dep `mysql2`→mysql; `drizzle.config.*`→drizzle-orm. Actualizar `STACK_SIBLINGS` en `scripts/audit.js:37-44` con las nuevas claves y añadir casos en `tests/detect-repo.test.js` (un fixture por señal).
- **Criterios de aceptación:** Cada señal nueva tiene un test con fixture que pasa; un repo de fixture Angular devuelve `['angular','design']`; `npm test` verde; README/tabla de detectores actualizada si existe.
- **Esfuerzo:** M

## SPEC-019: Señales de detección incorrectas — react→nextjs y cualquier-python→fastapi
- **Área / Prioridad:** Grafo y manifest / P1-alta
- **Problema:** Dos señales enrutan mal: (a) cualquier `react` en deps activa `nextjs` — un React Native/Expo o un SPA Vite recibe la skill de Next.js; (b) cualquier `requirements.txt`/`pyproject.toml` activa `fastapi` — un proyecto Django (skill que existe) o un script de datos recibe FastAPI.
- **Evidencia:** `scripts/detect-repo.js:10` (`if (deps.next || deps.react)`); `:13` (`requirements.txt || pyproject.toml → fastapi`). Skills `django`, `python`, `react-native`, `expo` existen en el catálogo.
- **Propuesta:** (a) `deps.next`→nextjs; `deps.react` sin next: si `react-native`/`expo` presentes→expo; si no→nextjs sigue siendo aceptable como default de React (documentarlo) o crear señal `react`→design solamente. (b) Python: inspeccionar contenido — `django` en deps→django; `fastapi`→fastapi; ninguno→`python`. Mantener compatibilidad en `STACK_SIBLINGS` y tests.
- **Criterios de aceptación:** Fixture con `react-native` NO devuelve nextjs; fixture con `django` en requirements devuelve django y no fastapi; fixture FastAPI intacto; `npm test` verde.
- **Esfuerzo:** S

## SPEC-020: Invariantes del grafo sin test — huérfanas y triggers duplicados pueden regresar
- **Área / Prioridad:** Grafo y manifest / P2-media
- **Problema:** Los hallazgos de esta fase (huérfanas, frases trigger duplicadas) se corrigen una vez pero nada impide que reaparezcan: no hay test de invariantes del grafo.
- **Evidencia:** `grep -ln "in-degree\|orphan\|duplicate" tests/*.test.js` solo devuelve `tests/audit.test.js:34`, y ese hit es "orphan" en sentido no-footprint (skill instalada sin stack detectado), no in-degree del grafo. Ningún test calcula in-degree ni duplicación de frases trigger.
- **Propuesta:** Nuevo `tests/graph-invariants.test.js` con 3 asserts sobre manifest.json + detect-repo: (1) toda skill tiene in-degree ≥1 O profile no vacío O señal en la tabla de detectores (exportar la tabla de detect-repo como constante para poder consultarla); (2) ninguna frase entrecomillada (≥6 chars) de una description aparece en la description de otra skill; (3) `recommends ⊆ ids` (cinturón además del gate de SPEC-014).
- **Criterios de aceptación:** `npm test` incluye el archivo y pasa tras aplicar SPEC-002/003/015; romper cualquiera de los 3 invariantes en un fixture/skill hace fallar el test.
- **Esfuerzo:** S

## SPEC-021: Vacíos de catálogo en infra declarativa — terraform y kubernetes no existen
- **Área / Prioridad:** Grafo y manifest / P3-baja
- **Problema:** El dominio "Ship & operate" no tiene skills de Terraform ni Kubernetes; varios `should_not_trigger` ya enrutan esos prompts a `none` por no tener destino. Son dos de los stacks de infra más consultados y detectables (`*.tf`, `k8s/`/`Chart.yaml`).
- **Evidencia:** `jq -r '.skills[].id' manifest.json | grep -iE "terra|kube|k8s|helm"` → vacío; casos `route_to: none` justificados por k8s/terraform en evals (auditoría FASE 2, lote 26-38).
- **Propuesta:** Autorar 2 skills nuevas (`terraform`, `kubernetes`) siguiendo el pipeline estándar (spec en `skill-build/`, rúbrica ≥8.5, evals completas), añadirlas al dominio "Ship & operate — devops", con recommends desde/hacia `deployment` y señal en detect-repo (`*.tf`→terraform; `Chart.yaml`|`k8s/`|`kustomization.yaml`→kubernetes). Alternativa mínima si no se quiere ampliar catálogo: documentar la exclusión en README.
- **Criterios de aceptación:** Ambas skills existen con evals que pasan `eval-lint.sh`, aparecen en manifest y dominio, y los `route_to: none` de k8s/terraform pasan a apuntarlas; o bien el README declara la exclusión explícitamente.
- **Esfuerzo:** L

## Hallazgos SIN spec (una línea cada uno)

- 8 skills tienen out-degree >6 (máx `huggingface` 11) mientras la expansión capa a 6 — los recommends sobrantes solo se ven en el SKILL.md; aceptable, sin spec.
- 128 skills incluyen su propio id como tag — redundante para consult (el id ya puntúa aparte) pero inocuo; sin spec.
- 949/1.140 tags son singleton — alta especificidad, útil para FTS; no es defecto.
