# _STATUS — Auditoría rsc-harness (specs de mejora en docs/wiki/)

Regla: una fase por iteración. Al iniciar, coger LA PRIMERA fase PENDIENTE. Al terminar, actualizar esta tabla y commitear solo `docs/wiki/`.

Numeración de specs: global y única (SPEC-001, SPEC-002…), sin huecos. Próximo número libre: **SPEC-014**.

| # | Fase | Archivo | Estado | Fecha | Specs |
|---|------|---------|--------|-------|-------|
| 1 | Mapa del sistema | `00-mapa.md` | COMPLETA | 2026-07-03 | 0 (fase base, sin specs) |
| 2 | Calidad skills & triggering | `01-calidad-skills-triggering.md` | COMPLETA | 2026-07-03 | 13 (SPEC-001…013) |
| 3 | Grafo y manifest | `02-grafo-y-manifest.md` | PENDIENTE | — | — |
| 4 | Frescura de fuentes | `03-frescura-fuentes.md` | PENDIENTE | — | — |
| 5 | CLI & DX | `04-cli-dx.md` | PENDIENTE | — | — |
| 6 | Multi-target | `05-multi-target.md` | PENDIENTE | — | — |
| 7 | Seguridad y código | `06-seguridad-y-codigo.md` | PENDIENTE | — | — |
| 8 | Marketing y distribución | `07-marketing-distribucion.md` | PENDIENTE | — | — |
| 9 | Docs y escritura | `08-docs-escritura.md` | PENDIENTE | — | — |
| 10 | Roadmap (síntesis) | `09-roadmap.md` | PENDIENTE | — | — |

## Notas entre iteraciones

- Realidad verificada (2026-07-03): **232 skills, 19 dominios** (no 231/21). Cross-check dominios↔manifest limpio.
- Semillas para fases futuras (detalladas al final de `00-mapa.md`): recommends colgantes silenciosos (F3), `reviewer-guard.sh` apunta a dir inexistente (F7/F9), consult léxico devuelve vacío con intent natural (F5), cifras desfasadas en README (F9), fallback copia en Windows (F5/F6).

## Bloqueos

(ninguno)
