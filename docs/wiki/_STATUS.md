# _STATUS — Auditoría rsc-harness (specs de mejora en docs/wiki/)

Regla: una fase por iteración. Al iniciar, coger LA PRIMERA fase PENDIENTE. Al terminar, actualizar esta tabla y commitear solo `docs/wiki/`.

Numeración de specs: global y única (SPEC-001, SPEC-002…), sin huecos. Próximo número libre: **SPEC-036**.

| # | Fase | Archivo | Estado | Fecha | Specs |
|---|------|---------|--------|-------|-------|
| 1 | Mapa del sistema | `00-mapa.md` | COMPLETA | 2026-07-03 | 0 (fase base, sin specs) |
| 2 | Calidad skills & triggering | `01-calidad-skills-triggering.md` | COMPLETA | 2026-07-03 | 13 (SPEC-001…013) |
| 3 | Grafo y manifest | `02-grafo-y-manifest.md` | COMPLETA | 2026-07-03 | 8 (SPEC-014…021) |
| 4 | Frescura de fuentes | `03-frescura-fuentes.md` | COMPLETA | 2026-07-03 | 7 (SPEC-022…028) |
| 5 | CLI & DX | `04-cli-dx.md` | COMPLETA | 2026-07-03 | 7 (SPEC-029…035) |
| 6 | Multi-target | `05-multi-target.md` | PENDIENTE | — | — |
| 7 | Seguridad y código | `06-seguridad-y-codigo.md` | PENDIENTE | — | — |
| 8 | Marketing y distribución | `07-marketing-distribucion.md` | PENDIENTE | — | — |
| 9 | Docs y escritura | `08-docs-escritura.md` | PENDIENTE | — | — |
| 10 | Roadmap (síntesis) | `09-roadmap.md` | PENDIENTE | — | — |

## Notas entre iteraciones

- Realidad verificada (2026-07-03): **232 skills, 19 dominios** (no 231/21). Cross-check dominios↔manifest limpio.
- Semillas para fases futuras (detalladas al final de `00-mapa.md`): recommends colgantes silenciosos (F3 ✓ SPEC-014), `reviewer-guard.sh` apunta a dir inexistente (F7/F9), cifras desfasadas en README (F9), fallback copia en Windows (F5 ✓ verificado sin divergencia, F6).
- CORRECCIÓN a semilla de F1: `consult` multilingüe funciona bien en pruebas reales (catalán coloquial incluido) — la especulación de que devolvía vacío era errónea; verificado en vivo en F5.
- Hallazgo F5 para F7: el danger-guard bloqueó un `rm -rf` sobre scratchpad temporal (falso positivo a examinar como superficie de hooks).

## Bloqueos

(ninguno)
