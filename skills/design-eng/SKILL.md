---
name: design-eng
description: "Umbrella for frontend craft: routes a UI request to the sibling that owns it — build motion, review it, audit it, find where it is missing, name an effect, gesture physics, prototype variants, pick a library. Use when an app works but feels cheap or unpolished, or when a frontend request could belong to several of them."
tags: [design, frontend, ui, routing, craft]
recommends: [design-loop, animate, review-animations, apple-design, design]
profiles: [core, full]
origin: emilkowalski (MIT, adapted)
---

# Design Engineering — the frontend craft umbrella

*Two jobs: route the request to the sibling that owns it, and carry the philosophy the siblings assume.*

> **SDD gate.** This skill routes; it does not outrank the chain. If the request is a **new,
> non-trivial feature or behaviour change** and there is no approved spec + plan under
> `02-DOCS/wiki/sdd/`, hand off to `../specify/SKILL.md` first — it runs brainstorm → spec → plan
> → tasks before any code, then routes back here. Route straight through only for a genuinely
> one-line / low-risk change, or a bug fix restoring intended behaviour. Method: `../sdd/SKILL.md`.

## Route first

Installed in every repo with a frontend, so it fires on requests that could belong to several
siblings. Name the sibling, hand over, and stop — do not do their work here.

| The request is… | Route to | Not to |
| --- | --- | --- |
| "animate this", "make it feel alive", build a transition | `../animate/SKILL.md` | not `design`, which sets intent and budget, not the implementation |
| the same, but React Native / Expo | `../animate-expo/SKILL.md` | not `animate` — no hover, two runtimes, gestures are the baseline |
| "review the motion in this diff / component" | `../review-animations/SKILL.md` | not `code-review`, which does not know the motion bar |
| "audit the animations across the app", "give me a roadmap" | `../improve-animations/SKILL.md` | not `review-animations`, whose object is one diff |
| "what could be animated here?", "make this feel more alive" | `../find-animation-opportunities/SKILL.md` | not `animate` — nothing has been chosen yet |
| "what's it called when…", naming an effect to prompt with | `../animation-vocabulary/SKILL.md` | — |
| gesture physics, springs, momentum, translucent materials, Apple-grade feel | `../apple-design/SKILL.md` | not `animate`, which owns curves and durations, not physics |
| "show me a few versions of this and let me pick" | `../prototype/SKILL.md` | — |
| "what should I use for toasts / drag and drop / a command menu?" | `../pick-ui-library/SKILL.md` | not hand-rolling the component |
| Sonner specifically — setup, styling, toasts misbehaving | `../ask-sonner/SKILL.md` | — |
| "make it as good as <site>", a named reference to beat, "it looks generic" | `../design-loop/SKILL.md` | not `design` — the bar and the critics are the method, not the visual system |
| "keep this style", "make more like this", output drifted from a look that once worked | `../design-dna/SKILL.md` | not `design-loop` — the winner already exists; this keeps it |
| visual system, brand grounding, landing composition, a whole page | `../design/SKILL.md` | not here — this skill owns craft and motion, not the visual system |
| the App Router / React build itself | `../nextjs/SKILL.md` | — |
| Swift language work (concurrency, generics) | `../write-swift/SKILL.md` | not `swift-ios`, which owns the platform |

Three rules for routing:

1. **Ambiguity resolves to the narrower object.** "Improve the animations" on a diff is
   `review-animations`; on a whole codebase it is `improve-animations`. Say which you chose and
   which you passed over — never run both.
2. **When nothing fits, say so.** A tangential hand-off is worse than none. Pure backend, data or
   infra work with no UI surface: decline, there is nothing to design.
3. **Route once, then get out of the way.** The sibling owns the work from there; this body is
   background, not a second opinion mid-task.

The rest of this file is the philosophy the siblings assume — read it when the work needs the
*why* behind a rule, not to re-derive a rule the sibling already states.

## The craft posture

You are a design engineer with the craft sensibility. You build interfaces where every detail compounds into something that feels right. You understand that in a world where everyone's software is good enough, taste is the differentiator.

## Why craft, at all

In a world where everyone's software is good enough, taste is the differentiator — and taste is a
trained instinct, not a preference. Most of the details that produce it are ones users never
consciously notice, which is the point: when something works exactly as someone assumed it would,
they never think about it. The full argument, with the Paul Graham line it rests on, moved to
`../animate/SKILL.md` along with the material it justifies.

## Where the craft itself lives

This skill decides **who answers**. It does not carry their material — that would make every install
pay for a manual it may never open, and it would duplicate the sibling that owns it.

| You need | It lives in |
|---|---|
| Should this animate at all — the frequency gate, purpose, easing, duration | `../animate/SKILL.md` |
| Springs, component principles, transforms, `clip-path`, gestures, performance, accessibility, stagger, debugging | `../animate/SKILL.md` |
| The required Before/After review format and the checklist of 11 defects | `../review-animations/SKILL.md` |

If the sibling you need is not installed, name it and offer to install it. A route to something
absent is not a route.

## Credit

Adapted for the rsc catalog from **[emilkowalski/skills](https://github.com/emilkowalski/skills)**
(MIT, commit `d23d7f8`) by Emil Kowalski — the design-engineering and animation philosophy behind
[Sonner](https://sonner.emilkowal.ski), [Vaul](https://vaul.emilkowal.ski) and
[animations.dev](https://animations.dev). The craft bar here is his; the routing, gates and evals
that make it an rsc skill are not. Nothing in this body is a substitute for his course.
