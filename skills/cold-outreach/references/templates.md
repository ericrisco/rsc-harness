# Templates — first-touch + bump skeletons

Fill **every** `{{slot}}` with a real value before sending. An unfilled slot is a defect. The slots:

- `{{signal}}` — the one true, public, business-relevant trigger (a hiring post, a launch, a number from their site, a role change).
- `{{outcome}}` — one concrete result you delivered for a comparable team (with a number when you have one).
- `{{proof}}` — a named comparable, a mini case study, or a metric.
- `{{ask}}` — the binary yes/no CTA.
- `{{name}}` / `{{company}}` — recipient + their company.

## Email — first touch (≤ ~80 words)

```text
Subject: {{signal}}   ← ≤6 plain words, no clickbait

Hi {{name}} — {{signal, stated plainly}}. Usually that means {{the pain it
implies}}.

We {{outcome}} for {{a comparable team}}.

{{ask}} — yes or no?

— {{your name}}, {{your company}}
{{compliant footer: see references/compliance-footer.md}}
```

## Email — 5-step sequence (same thread, reply to your own send)

```text
STEP 1 — Day 0   (the first touch above)

STEP 2 — Day +3   (angle: proof)
Hi {{name}} — following the note below, here's the concrete version:
{{proof}}. {{ask}} — yes or no?

STEP 3 — Day +7   (angle: different pain, lower-friction ask)
One more angle: teams like {{company}} also hit {{second pain}}. I wrote a
2-page teardown on it — want me to send it? (no call required)

STEP 4 — Day +12  (angle: social proof)
{{peer company}} cut {{metric}} after {{change}} — similar setup to yours.
{{ask}} — yes or no?

STEP 5 — Day +18 (the breakup)
Hi {{name}} — I'll stop here so I'm not cluttering your inbox. Should I
close the file, or is {{the value}} worth 15 minutes later this quarter?
```

The breakup is the highest-converting follow-up after step 1 — never skip it. Extend to step 6-7 only if a genuinely new `{{signal}}` appears.

## LinkedIn — connection note (≤ ~300 chars, NO pitch)

```text
Hi {{name}} — {{signal, e.g. "your post on cutting on-call toil"}} resonated.
Working on the same problem for infra teams; would value connecting.
```

No ask, no product name in the note. Earn the connection on a real signal.

## LinkedIn — DM bump (after they accept, ~3-4 sentences)

```text
DM 1 — Day 0 (after accept)
Thanks for connecting, {{name}}. {{signal}} is exactly what we work on — we
{{outcome}} for {{comparable team}}. Open to a quick look, or not the right
time?

DM 2 — Day +4
No worries if the timing's off. If on-call noise is on your radar this
quarter, happy to share the {{proof}} we used — say the word.

DM 3 — Day +9 (breakup)
I'll leave it here, {{name}}. If {{the value}} ever moves up your list, my
door's open. Either way, glad to be connected.
```

## Spanish — secuencia de cold email (primer toque, ≤ ~80 palabras)

```text
Asunto: {{signal}}

Hola {{name}} — {{signal}}. Normalmente eso implica {{el dolor}}.

Logramos {{outcome}} para {{un equipo comparable}}.

{{ask}} — ¿sí o no?

— {{tu nombre}}, {{tu empresa}}
{{pie de página conforme: ver references/compliance-footer.md}}
```

Keep the same rules in any language: one true signal, one binary ask, ≤ ~80 words, a compliant footer. The breakup step is mandatory in every sequence.
