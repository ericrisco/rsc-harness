# Dialogue tools — the four primitives, a pick-one guide, and one conversation in three formats

Deep dive for the SKILL's "Dialogue systems" section. **Engine-agnostic:** author dialogue in a portable format here; the engine skill (`godot`/`unity`/`unreal`) wires the runner, presenter, save/serialize, and any plugin. Do not write engine binding code in this skill.

## Every tool reduces to four primitives

Design against these, then map them onto whichever tool the project uses:

| Primitive | What it is | Ink | Yarn Spinner | Twine (Twee) | articy:draft X |
| --- | --- | --- | --- | --- | --- |
| **Node** | addressable unit of content | knot `=== name ===` / stitch `= name` | node with `title:` + `===` end | passage `:: Name` | flow / dialogue fragment |
| **Condition** | boolean over state gating content | `{ cond: ... }`, `{ cond: a \| b }` | `<<if $x>> ... <<endif>>` | `(if: $x)[...]` (Harlowe) / `<<if $x>>` (SugarCube) | condition node / expression on a pin |
| **Variable** | the story state read/written | `VAR x = 0`, `~ x = 1` | `<<set $x to 1>>` | `(set: $x to 1)` / `<<set $x = 1>>` | global variable in the variable set |
| **Effect** | side effect a node fires | `~ func()`, tags `#`, external funcs | `<<command>>`, functions, `<<set>>` | macros, `<<run>>` (SugarCube) | instruction node / script pin |

If you can express a conversation in these four primitives, it ports to any of the tools below.

## The tools (pointers, current as of 2026)

### Ink — inkle's narrative scripting language
- **Shape:** a writer-first *language* (not a visual editor). Text is the default; logic is woven in. Prose-heavy, highly expressive.
- **Core syntax:** knots `=== name ===`, stitches `= name`, diverts `-> name`, once-only choices `*`, sticky choices `+`, gathers `-`, weave (nested choices/gathers), `VAR`, `CONST`, `LIST` (state machines / multi-value), conditionals `{ }`, tunnels `-> x ->`, threads `<- x`, functions, tags `#`, glue `<>`.
- **Runtime:** compiles to JSON; run with **inkjs** (web/JS) or engine integrations (Unity's `ink-unity-integration`; community Godot integrations). **Inky** is the authoring editor with live preview.
- **Best for:** branching prose, interactive fiction, dialogue with lots of state and reincorporation. Weakest as a visual overview for non-writers.

### Yarn Spinner — the friendly dialogue tool (v3.x current)
- **Shape:** node-based, screenplay-ish; friendlier to designers and non-programmers than raw Ink. Nodes edit well in a graph or plain text.
- **Core syntax:** node = header (`title: Name`) + `---` + body + `===`; options with `->`; `<<set $x to 1>>`, `<<if>>/<<elseif>>/<<else>>/<<endif>>`, `<<jump Node>>`, `<<declare>>`, custom `<<commands>>`, functions, and inline markup `[b]...[/b]`.
- **Runtime & engines:** first-class **Unity** support; **Godot** via official C# (beta) and GDScript (alpha) integrations; **Unreal** integration in progress for 2026. String tables export for localization are built in.
- **Best for:** game dialogue with a designer-writer split, VO line management, and Unity projects.

### Twine — visual hypertext editor
- **Shape:** a **visual node editor** that publishes a self-contained HTML file. Lowest barrier to entry; excellent for prototyping and interactive fiction shipped as a web page.
- **Story formats matter:** scripting depends on the chosen format — **Harlowe** (default, macro-based `(set:)/(if:)`), **SugarCube** (`<<set>>/<<if>>`, save system, richer for games), **Snowman** (JS-forward), **Chapbook** (prose-forward). Pick the format for the job.
- **Twee** is Twine's plain-text form (`:: Passage` headers) — version-controllable and a good neutral interchange for design even if the game engine isn't Twine.
- **Best for:** prototyping branches fast, web-delivered IF, and design-time storyboarding. Not a drop-in engine dialogue runtime for a AAA build.

### articy:draft X — visual narrative database (commercial)
- **Shape:** a heavyweight **narrative DB + flow editor**. Models flow fragments, dialogue fragments, hubs, conditions, instructions, plus a full entity/location/variable database and templates. Built for large teams and large scripts.
- **Pipeline:** free **Unity** and **Unreal** importers pull dialogues, entities, variables, and localization in cleanly; a **Generic Engine Export** produces JSON (+ optional assets) for any custom engine. Runs on Windows and macOS.
- **Best for:** big branching RPGs, teams that need a shared narrative database, template-driven content, and translation at scale. Overkill for a small project.

## Pick one — a fast decision guide

| If… | Reach for |
| --- | --- |
| Prose-heavy IF, lots of state, writer-driven | **Ink** |
| Game dialogue, designer/writer split, Unity, VO + loc built in | **Yarn Spinner** |
| Rapid prototype, web-delivered, or teaching branching visually | **Twine** (SugarCube for game-like saves) |
| Large team, huge script, shared entity/variable DB, Unity/Unreal | **articy:draft X** |
| You just need a portable design artifact, engine undecided | **Twee** or an Ink file (both are plain text, diff-able) |

When the engine is fixed, let the **engine skill** confirm the best-supported integration; when it isn't, author in plain-text (Ink/Twee) so nothing locks you in.

## The same conversation, three formats

A guard who lets you pass only if `has_pass` is true; otherwise you can bribe (needs `gold >= 10`) or leave.

**Ink**
```ink
VAR has_pass = false
VAR gold = 0

=== gate ===
The guard blocks the door.
{ has_pass:
    "Pass, citizen." -> town
}
* [Offer a bribe] { gold >= 10:
        ~ gold = gold - 10
        The guard pockets it. -> town
    - else:
        "You're ten short." -> gate
    }
* [Leave] -> street
```

**Yarn Spinner**
```yarn
title: Gate
---
The guard blocks the door.
<<if $has_pass>>
    Guard: Pass, citizen.
    <<jump Town>>
<<endif>>
-> Offer a bribe <<if $gold >= 10>>
    <<set $gold = $gold - 10>>
    The guard pockets it.
    <<jump Town>>
-> Leave
    <<jump Street>>
===
```

**Twee (SugarCube)**
```twee
:: Gate
The guard blocks the door.
<<if $has_pass>>Guard: "Pass, citizen." [[Town]]<<else>>\
[[Offer a bribe->Bribe]]
[[Leave->Street]]
<</if>>

:: Bribe
<<if $gold gte 10>><<set $gold to $gold - 10>>The guard pockets it. [[Town]]\
<<else>>"You're ten short." [[Gate]]<</if>>
```

Same four primitives (node / condition / variable / effect), three syntaxes. Design once; the engine skill binds it.

## Delivery notes (design-side)

- **Barks vs. conversations** — short, interruptible one-liners (barks) need a priority + cooldown model so they don't stack or repeat; full conversations need focus/turn-taking. Design them as different node types.
- **Line IDs & loc** — every player-facing line carries a stable id and lives in a string table (see the SKILL's localization notes). Ink tags, Yarn's string-table export, and articy's loc columns all support this; use them.
- **Never concatenate** sentence fragments across variables for grammar (gender/plural/word order) — author full templated lines with named placeholders.
- **Presentation is the engine's job** — typewriter effect, portraits, camera, choice-timer UI, skip/auto — hand these to the engine skill; keep the dialogue content pure.
