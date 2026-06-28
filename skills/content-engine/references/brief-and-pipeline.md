# Reference — Brief, pipeline stages, and calendar slot schema

Offloaded detail for `content-engine`. The body states the rules; this is the full
template, the stage gates, and the CSV column docs you fill in.

## The canonical brief

Every slot carries one brief in the same shape. A slot cannot leave the `idea` stage
without it. Store briefs under `02-DOCS/wiki/content/briefs/<slug>.md`.

These briefs live in the `02-DOCS/wiki/` OKF v0.1 bundle, so each brief `.md` carries YAML
frontmatter with a non-empty `type: content-brief` (the OKF-recommended `title`/`description`/
`tags`/`timestamp` are added where meaningful). The domain brief fields below are kept as-is —
OKF allows any extra key. Cross-references in the body use **standard markdown links**, never
wikilinks (e.g. `[brand voice](../brand-voice.md)`). See
`../../harness/references/wiki-protocol.md` "## Conventions".

| Field | Required | What goes here |
|---|---|---|
| `objective` | yes | the one outcome (e.g. "drive activation-checklist signups") |
| `persona` | yes | which of the 2–4 personas |
| `pillar` / `cluster` | yes | position in the architecture |
| `angle` | yes | the specific take, not the topic ("the 3 setup steps most teams skip") |
| `format` | yes | flagship-guide / linkedin-post / video-short / newsletter-issue / x-thread / … |
| `owner` | yes | the human accountable |
| `target_keyword` | flagship/article | handed off from `seo-geo`, never invented here |
| `success_metric` | yes | how you'll know it worked (e.g. "100 checklist downloads in 30d") |
| `atomization_intent` | flagship | derivative count + target channels |
| `voice_ref` | yes | link to the `brand-voice` artifact the writer must follow |

### Filled example

```markdown
---
# OKF v0.1 standard surface — `type` is the only REQUIRED field (non-empty).
type: content-brief
title: "Onboarding activation guide — brief"
description: "Brief of record for the flagship activation-checklist guide."
tags: [content-brief, onboarding, flagship]
timestamp: 2026-07-01T00:00:00Z
# Domain brief fields (OKF allows any extra key; the pipeline + verify read these).
slug: onboarding-activation-guide
objective: drive activation-checklist signups from new-trial users
persona: hands-on-ops-lead
pillar: Onboarding
cluster: activation-checklist
angle: the 3 setup steps most teams skip in week one
format: flagship-guide
owner: ana
target_keyword: "saas user activation checklist"
success_metric: 100 checklist downloads in 30 days
atomization_intent: 10 derivatives — 3 LinkedIn, 1 X thread, 2 shorts, 1 newsletter, 3 carousels
voice_ref: ../brand-voice.md
---
```

## Pipeline stages — entry/exit gates and WIP

`idea → brief → draft → edit → atomize → publish-ready`

| Stage | Entry gate | Exit gate | Typical WIP |
|---|---|---|---|
| `idea` | slot exists in calendar, pillar+cluster assigned | brief complete, owner set | unbounded (backlog) |
| `brief` | brief written | target keyword present, voice_ref linked | small |
| `draft` | brief complete | a draft exists, hits format+angle | cap per team-size table |
| `edit` | draft exists | edited against brief + voice guide | cap per team-size table |
| `atomize` | flagship passed edit (non-flagships skip) | atomization plan filled (≥ count) | 1–2 |
| `publish-ready` | derivatives planned + routed | every asset has owner + destination | — |

**WIP rule:** finish before you pull. Caps come from the cadence-by-team-size table in
`../SKILL.md`. Exceeding the cap is how a calendar becomes a graveyard of half-done slots.

**Station ownership:** `content-engine` owns the slot and its stage. Drafting/editing
the words is routed out — long-form to `article-writing`, newsletter to `newsletter`,
video to `video-shorts`, landing copy to `marketing`. The act of publishing is
`social-publisher`. Automating the flow is `automation-flows`.

## Calendar slot schema (CSV)

One row per slot. This is the artifact `scripts/verify.sh` lints.

| Column | Meaning | Notes |
|---|---|---|
| `date` | publish/target date | `YYYY-MM-DD` |
| `pillar` | one of the 4–6 pillars | required |
| `cluster` | sub-topic under the pillar | required |
| `format` | the asset format | `flagship-*` rows trigger the brief+atomization checks |
| `owner` | accountable human | empty allowed only on `reactive-open` slots |
| `stage` | pipeline state | `idea\|brief\|draft\|edit\|atomize\|publish-ready` |
| `brief_link` | path to the brief | required non-empty for flagship rows |
| `atomization` | plan ref or `planned` | required non-empty for flagship rows |
| `mix` | allocation bucket | `evergreen\|timely\|experimental\|reactive-open` |

### Filled example

```csv
date,pillar,cluster,format,owner,stage,brief_link,atomization,mix
2026-07-07,Onboarding,activation-checklist,flagship-guide,ana,brief,02-DOCS/wiki/content/briefs/onboarding-activation-guide.md,planned,evergreen
2026-07-09,Onboarding,activation-checklist,linkedin-post,ana,idea,,,evergreen
2026-07-11,Onboarding,activation-checklist,x-thread,leo,idea,,,evergreen
2026-07-15,Trends,q3-benchmarks,reactive-open,,idea,,,reactive-open
2026-07-21,Proof,customer-results,case-study,leo,brief,02-DOCS/wiki/content/briefs/acme-results.md,planned,evergreen
2026-07-28,Seasonal,back-to-work,linkedin-post,ana,idea,,,timely
```
