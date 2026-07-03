# 09 — Roadmap (síntesis de la auditoría)

> FASE 10. Generado 2026-07-03. Sintetiza las 54 specs de las fases 2–9. Prioridades: P0-crítica (3), P1-alta (20), P2-media (19), P3-baja (12). Esfuerzo: S=horas, M=un día, L=varios días.

## Tabla completa de specs

| Spec | Título corto | Área | Prioridad | Esfuerzo |
|---|---|---|---|---|
| SPEC-001 | Descriptions >1024 chars (sdd, specify) + schema sin maxLength | Calidad skills | P1 | S |
| SPEC-002 | Cláusulas NOT cross-plataforma en 14 skills (youtube/shortform/linkedin/medium) | Calidad skills | P1 | M |
| SPEC-003 | Frases trigger duplicadas entre skills no hermanas | Calidad skills | P2 | S |
| SPEC-004 | `route_to` sin validar en eval-lint + 3 casos fuera de catálogo | Calidad skills | P2 | S |
| SPEC-005 | Solo ~1 escenario capability por skill (gate conductual n=1) | Calidad skills | P2 | L |
| SPEC-006 | Stats/versiones perecederas sin fuente datada (patrón transversal) | Calidad skills | P1 | L |
| SPEC-007 | Claims de alta especificidad probablemente fabricadas (3 skills) | Calidad skills | **P0** | S |
| SPEC-008 | Hedges obsoletos "sibling cannot link yet" | Calidad skills | P3 | S |
| SPEC-009 | `analyze`: evals enrutan a hermanas incorrectas | Calidad skills | P1 | S |
| SPEC-010 | `ads`: plazo vencido presentado como futuro | Calidad skills | P3 | S |
| SPEC-011 | Bloque "Project grounding" duplicado verbatim | Calidad skills | P3 | M |
| SPEC-012 | Bodies fuera de banda 120–400 líneas (orient/deployment/fastapi) | Calidad skills | P3 | M |
| SPEC-013 | `git-workflow` contradice la política de commits del harness | Calidad skills | P3 | S |
| SPEC-014 | `--validate` no detecta recommends colgantes | Grafo/manifest | P2 | S |
| SPEC-015 | 17 skills huérfanas (sin in-degree, profile ni detector) | Grafo/manifest | P2 | M |
| SPEC-016 | `profiles: [full]` es metadato muerto | Grafo/manifest | P2 | S |
| SPEC-017 | Tags duplicados singular/plural (12 pares) | Grafo/manifest | P3 | S |
| SPEC-018 | Detectores: 6 señales para ~34 skills de stack detectables | Grafo/manifest | P1 | M |
| SPEC-019 | Señales incorrectas: react→nextjs, cualquier-python→fastapi | Grafo/manifest | P1 | S |
| SPEC-020 | Invariantes del grafo sin test (huérfanas, triggers duplicados) | Grafo/manifest | P2 | S |
| SPEC-021 | Faltan skills terraform y kubernetes | Grafo/manifest | P3 | L |
| SPEC-022 | Model-ids obsoletos en `targets/agents.js` (TIER_MODEL, kiro) | Frescura | P1 | S |
| SPEC-023 | gpt-4o legacy / gpt-5.1 en ejemplos de código | Frescura | P1 | S |
| SPEC-024 | claude-sonnet-4-6 citado como vigente en 4 skills | Frescura | P1 | S |
| SPEC-025 | Skill `angular` una major por detrás (20/21 vs 22 GA) | Frescura | P1 | M |
| SPEC-026 | "Next.js 15" como stack actual en design/secure-coding | Frescura | P2 | S |
| SPEC-027 | Drift menor de pins + política de pin por serie | Frescura | P3 | S |
| SPEC-028 | Sin cadencia de re-verificación (foto única de jun-2026) | Frescura | P2 | M |
| SPEC-029 | `rsc add <id-inexistente>` → ENOENT crudo sin validación | CLI & DX | P1 | S |
| SPEC-030 | `uninstall --all --target X` purga TODOS los targets | CLI & DX | **P0** | M |
| SPEC-031 | `uninstall <id>` deja hooks zombis y huérfanos | CLI & DX | P1 | M |
| SPEC-032 | No existe `rsc update`; nudge apunta al comando equivocado | CLI & DX | P1 | M |
| SPEC-033 | `doctor` superficial (no detecta hooks rotos ni base vieja) | CLI & DX | P2 | M |
| SPEC-034 | Sin `help`; `add` mudo; errores sin traducir | CLI & DX | P2 | S |
| SPEC-035 | Ctrl+C en wizard deja estado parcial sin aviso | CLI & DX | P3 | S |
| SPEC-036 | Adoptar Agent Skills nativo (`.agents/skills/`) en tools que ya lo leen | Multi-target | P1 | L |
| SPEC-037 | Cursor .mdc destruye la description (reglas muertas) + refs rotas | Multi-target | **P0** | M |
| SPEC-038 | Targets AGENTS.md sin índice de skills ni paths válidos | Multi-target | P1 | M |
| SPEC-039 | Marcador roto → bloque congelado en silencio | Multi-target | P2 | S |
| SPEC-040 | Windsurf→Devin y Junie→AGENTS.md (ubicaciones legacy) | Multi-target | P2 | M |
| SPEC-041 | 25 hallazgos shellcheck (6 verify.sh con checks muertos) + sin CI | Seguridad/código | P2 | S |
| SPEC-042 | coolify/duckdb enseñan `curl \| bash` contra la doctrina propia | Seguridad/código | P2 | S |
| SPEC-043 | danger-guard: falsos positivos verificados en comandos read-only | Seguridad/código | P1 | M |
| SPEC-044 | Hooks con paths absolutos en settings.json | Seguridad/código | P2 | M |
| SPEC-045 | reviewer-guard.sh es un gate muerto | Seguridad/código | P3 | S |
| SPEC-046 | GitHub sin description/topics/website (comando exacto listo) | Distribución | P1 | S |
| SPEC-047 | README sin badges; repo sin social preview | Distribución | P2 | S |
| SPEC-048 | Catálogo solo en README → GitHub Pages + página por skill + llms.txt | Distribución | P1 | L |
| SPEC-049 | Envíos a 6 listas/directorios verificados (formato exacto) | Distribución | P1 | M |
| SPEC-050 | Plugin para claude-plugins-community (canal oficial) | Distribución | P2 | L |
| SPEC-051 | Contenido técnico: la historia del pipeline adversarial | Distribución | P2 | M |
| SPEC-052 | README: "231" vs 232 reales; asistentes suman 18 de 17 | Docs | P1 | S |
| SPEC-053 | Sin CONTRIBUTING.md ni ARCHITECTURE.md | Docs | P2 | M |
| SPEC-054 | Sin enlace al changelog desde README/npm | Docs | P3 | S |

## TOP 10 por impacto/esfuerzo

1. **SPEC-046** (P1/S) — Metadata de GitHub: un comando `gh repo edit` ya redactado desbloquea búsqueda de GitHub + indexado automático en SkillsMP. El mayor retorno por minuto de toda la auditoría.
2. **SPEC-007** (P0/S) — Claims fabricadas (promptfoo/OpenAI, Cohere rerank-v4.0, CVE-2026-33634): tres frases que pueden hundir la propuesta de valor "researched against live sources" si alguien las verifica públicamente.
3. **SPEC-037** (P0/M) — Cursor: hoy TODAS las skills instaladas en Cursor son reglas muertas sin señal de disparo; arreglar la description del .mdc revive un target entero.
4. **SPEC-030** (P0/M) — `uninstall --all --target X` destruye las instalaciones de otros targets: pérdida de datos real verificada en vivo.
5. **SPEC-001** (P1/S) — `sdd` y `specify` (el corazón del flujo SDD) superan el límite de 1024 chars de Claude Code: sus descriptions no funcionan como deben en el target principal.
6. **SPEC-022+023+024** (P1/S×3, ejecutables como un solo sweep de modelos) — el CLI escribe model-ids obsoletos en la config de cada usuario nuevo, y las skills de IA citan modelos legacy: mal escaparate para un catálogo de skills de IA.
7. **SPEC-052** (P1/S) — El titular del README anuncia un número de skills que no es el real; con check de CI para que no vuelva a pasar.
8. **SPEC-018+019** (P1/M+S) — Detectores: pasar de 6 a ~28 señales convierte el "self-recommending" en real para Angular/Rust/Laravel/Django/RN…; además corrige los dos enrutados erróneos actuales.
9. **SPEC-049** (P1/M) — Los envíos a VoltAgent/ComposioHQ/hesreallyhim/codex#16329: distribución inmediata en listas con 27k–67k estrellas, con el pitch ya redactado (depende de SPEC-046).
10. **SPEC-036** (P1/L) — Estratégica: instalar SKILL.md nativo en `.agents/skills/` para las 7 herramientas que ya leen la spec elimina de raíz las conversiones con pérdida (y absorbe SPEC-037/038 a medio plazo).

## 3 quick wins (<1 hora cada uno)

1. **SPEC-046 — metadata de GitHub (~10 min).** Copiar/pegar el comando `gh repo edit` del spec (description + homepage + 15 topics). Efecto inmediato en descubribilidad e indexación de SkillsMP.
2. **SPEC-052 (solo el fix, ~15 min).** `README.md:15` y `:180`: "231"→"232"; `:110`: "and 11 more"→"and 10 more". (El check de CI del spec puede ir en un PR posterior.)
3. **SPEC-009 — route_to de `analyze` (~15 min).** En `skills/analyze/evals/cases.yaml`: líneas 173-175 → `route_to: debug`; 181-183 → `route_to: plan`; 185-187 → `route_to: review`. Tres líneas que alinean las evals con la propia description de la skill.

## Secuencia sugerida (por olas)

- **Ola 1 — credibilidad y seguridad (1-2 días):** SPEC-046, 052, 007, 009, 001, 030, 022-024.
- **Ola 2 — el producto en los 17 targets (1 semana):** SPEC-037, 038, 029, 031, 032, 043, 019, 018.
- **Ola 3 — calidad del catálogo (1-2 semanas, paralelizable con workflows):** SPEC-002, 006, 025, 026, 004, 014, 020, 041, 042.
- **Ola 4 — distribución (cuando Ola 1 esté hecha):** SPEC-049, 047, 048, 051, 050, 053.
- **Ola 5 — estratégicas/fondo:** SPEC-036, 028, 005, 015, 016, 033, 034, 040, 044 y los P3.
