---
name: vsl-script
description: "Use when writing or revising a spoken sales video with timed narration, visual cues, supported claims and one next action. NOT writing the surrounding page (that is `landing-copy`) or rendering the video (that is `remotion-video`)."
tags: [vsl, sales-video, script, storyboard, narration, conversion]
recommends: [customer-research, offer-design, sales-funnel, landing-copy, remotion-video]
origin: risco
---

# VSL script — make the offer understandable on camera

Write the words a person will say and the visible evidence that makes them credible. A VSL is a
video sales letter: it helps a specific viewer understand an offer and take one next action.
Its deliverable is a production-ready script, not rendered video or a conversion guarantee.

## Load the offer and the viewing situation

Read existing brand voice and campaign artifacts. Default to
`02-DOCS/wiki/marketing/<campaign>/research.md`, `offer.md` and `funnel.md`; reuse an established
location instead of duplicating them. Identify the authoritative offer ID/revision and retain its
evidence IDs in the script. Ask only for missing facts that affect the argument: buyer, entry source,
what they already know, desired action, duration and delivery constraints.

The same offer governs price, inclusions, trial conditions, refund terms and CTA destination in the
page and video. If these disagree, name the stale artifact and correct its handoff; do not choose
whichever promise sounds stronger. If authority is unresolved, mark the disputed text as draft and
continue with verified material. Missing testimonials need not block a useful demonstration.

Choose the opening for the viewing situation. A viewer arriving from an explanatory email may
need a concrete demonstration immediately. Someone who does not recognize the problem may need
context first. Use research-supported objections rather than a compulsory sequence of emotions.
One action can be buying, booking, trying or installing; a free product needs no invented price.

## Build an argument that can be shown

Write a short argument map before the full script: **viewer question → answer → visible support →
next question**. Spend time on the decision that is hardest to believe. Offer an outline alone only
when requested, or when a consequential unknown prevents the complete draft.

For each claim, retain its source ID, what it actually supports and whether publication is permitted.
Distinguish a demonstrated function from a measured customer outcome. Keep research-only quotes,
unapproved names and unsupported numbers outside publishable narration. Rewrite around missing
proof and list the gap separately; placeholders must not look like actual endorsements.

Explain why the product works using its actual behavior or method. Route an unresolved offer or
differentiation question to `offer-design`; coining a method name is not evidence. Use deadlines,
capacity limits and guarantees only when they belong to the authoritative offer. A strong reason
to act can be the demonstrated fit, without manufactured urgency.

## Budget speech and screen time together

Establish a planning speech rate from the presenter or an explicit assumption. It is a production
estimate, not an audience benchmark. Reserve silent demonstrations, pauses and title/end cards
before allocating speech. Overlapping narration and visuals share elapsed time; silent intervals
cannot also be counted as narration time.

`spoken-word budget = (total seconds − silent seconds) × words per minute / 60`

Draft within that budget, then **count the actual spoken words**. Exclude headings, source notes,
on-screen text and stage directions. Use one stated counting convention consistently (for example,
whitespace-delimited words). Calculate the resulting speech duration and reconcile scene timings.
If it overflows, cut repetition or propose more runtime; do not label an impossible script with
optimistic timestamps. Leave headroom for breathing where the requested timing allows it.

Give each scene a start/end time, narration, on-screen text or action, and evidence/asset notes.
The timeline must cover the intended runtime without unexplained gaps or overlap. Write for a
single listener, with pronounceable prices and ordinary spoken sentences. Place source IDs in a
production column, not in the presenter's mouth. Use the same primary action when repeated.

## Hand off a filmable draft

Deliver the full script with a brief stating buyer, entry source, offer revision, action, runtime,
spoken count and timing assumption. Include concrete demonstration/capture instructions, asset
requirements and a separate list of unsupported claims removed or awaiting evidence/permission.
For a scene-by-scene production handoff, read [references/storyboard-handoff.md](references/storyboard-handoff.md).

Give `landing-copy` a continuity note containing the exact offer terms, action and evidence IDs;
do not write the surrounding page unless requested. Give production to `remotion-video` or the
user's chosen editor, with accessibility and playback needs noted. The script may be approved
while footage, consent or rendering remains pending; report those states separately.

When saving is requested or part of the campaign task, write `vsl.md` in the campaign folder and
link it from `02-DOCS/wiki/index.md`. An explanation-only request writes nothing. After a real
release, use observed viewing drop-offs and actions as revision evidence; separate hypotheses
about why people left from the measurements themselves. Experiments belong to `ab-testing`.

## Failure patterns

| Pattern | Repair |
| --- | --- |
| Narration describes every pixel while the demo races ahead | Let the demonstration carry its evidence; reserve silent viewing time. |
| A feature screenshot is cited for a savings promise | Narrow the promise to the behavior shown, or obtain outcome evidence. |
| The spoken price differs from the page | Reconcile both against the identified offer revision before recording. |

## Orientación (siempre)

Habla con la voz de `orient`: frases cortas, una idea por frase, y cada respuesta se entiende sola. Registro técnico o con analogías según `technical_level` en `02-DOCS/wiki/harness/user-profile.md`. Cierra cada turno con el **bloque-brújula** (📍 dónde estás · ➡️ siguiente, terminando en pregunta; ✅ y 🧭 cuando hay algo hecho o decidido). **Nunca termines en seco.** Protocolo completo: skill `orient` → `skills/orient/references/orientation-contract.md`. (Defiere a `suggest` el "¿instalo la skill que falta?".)
