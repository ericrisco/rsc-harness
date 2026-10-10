# The explain ladder

Text → diagram → HTML page → video. Climb one step per clear sign that the person does not follow,
or go straight to the step they ask for. Each step replaces the last one; it does not add to it.

## Step 1 — text

The four rules of `../SKILL.md`: their language, STE, stands alone, short. Most answers stop here.

## Step 2 — one diagram in the chat

Pick the **smallest** form that carries the point. One form per answer. Two lines of prose beside it,
then stop.

| The question is about | Draw |
|---|---|
| Logic, an algorithm, a decision | pseudocode |
| What calls what at runtime | call tree |
| UI structure | component tree, with state and module boundaries |
| Which file does what | shallow file tree, one comment per entry |
| Flow between pieces over time | Mermaid sequence or flow diagram |
| Steps that branch | ASCII flow with boxes and arrows |
| What changes in a shape that exists | `diff`, in the shape of the topic |
| Nothing with a shape | prose — say so, no decorative diagram |

Rules:

- **Only the parts that answer the question.** Drop the rest of the system.
- **Real names.** Real paths, functions, state values. `ServiceA → ServiceB` explains nothing.
- **A diff in the shape of the topic.** A layout change is a file-tree diff; a control-flow change is
  a pseudocode diff. Show the whole block instead when most of it is new.

```text
on(save)
  if content is unchanged
    return cached result
  write new content
  return fresh result
```

```diff
 src/
 ├── commands/
 ├── sessions/
-└── transport.ts
+└── transport/
+    ├── client.ts
+    └── stream.ts
```

## Step 3 — one HTML page

For layout, visual state, a dense comparison, or someone who knows **nothing** about the topic.

- One self-contained file. Big pictures first, words second. Inline SVG or plain HTML boxes; no chart
  library. Readable on a phone.
- The picture carries the idea; the words label it. If the page still makes sense with the text
  removed, it works. A caption per picture, not a paragraph.
- From zero: everyday objects only, no term before it is shown, and one line at the end on what the
  simplification left out.
- Inside a product, borrow its colours, type and spacing. Never invent an identity.

Shape of a from-zero page:

```text
one sentence  : what this thing is, in words a stranger would use
big picture 1 : the thing, drawn
big picture 2 : the thing doing its job, step by step
one line      : the part people get wrong
one line      : what this left out (only if it left something out)
```

Write it, then open it (`open path/to/explain-<topic>.html`).

## Step 4 — video, only on request

An animated explainer (3Blue1Brown style) for something that moves: a process over time, a
transformation, an algorithm running. It costs time and often an API key (narration, e.g.
ElevenLabs) or local compute. So:

- Offer it in one line. Never build it unasked.
- On yes, use the catalog's video skill (`remotion-video`). If it is not installed, `suggest` offers it.

## Anti-patterns

| Anti-pattern | Do this instead |
|---|---|
| Four forms because each adds a little | One form, the smallest that answers |
| The whole system when asked about one path | Draw the path, drop the rest |
| A diagram to look thorough | Answer in prose, say there is nothing to draw |
| Defining a term with two more terms | Show the thing, then name it |
| Simplifying until it is wrong | Keep it true; name what you dropped |
| Jumping to the HTML page on the first question | Climb one step per sign |
