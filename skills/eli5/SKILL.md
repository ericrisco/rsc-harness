---
name: eli5
description: "Use when a topic must be explained from zero to someone who knows nothing about it: one page, big pictures, very few words, everyday analogies, no jargon and nothing assumed. NOT the smallest in-conversation visual for someone already following (that is `show-me`), NOT a course with exercises (that is `course-builder`)."
tags: [eli5, explain, beginner, simple, analogy, no-jargon, explicame]
recommends: [show-me, technical-writing, course-builder]
profiles: [minimal, core, full]
origin: risco
---

# eli5 — explain it to someone who knows nothing

The topic is whatever the user named. With no topic named, it is the one the conversation is already
on. The audience is someone with **zero** background: no vocabulary, no context, no patience for a
definition that needs another definition.

## The contract

1. **A page, not a paragraph.** The output is one self-contained HTML page, big visuals first, words
   second. Open it when it is written.
2. **Picture carries the idea, words label it.** If the page still makes sense with the text removed,
   it is working. Aim for a caption per picture, not a paragraph per picture.
3. **Everyday objects only.** Compare to things a person has physically handled: boxes, keys, queues
   at a counter, post, a light switch. Never explain one unknown with another unknown.
4. **Zero jargon, and zero smuggled jargon.** No term appears without being shown first. "It caches"
   is jargon; "it keeps a copy nearby so it doesn't have to walk back" is the same fact.
5. **Simple, never false.** When the simplification would make something untrue, say what got left
   out, in one line, at the end. A comfortable lie is worse than a hard truth.
6. **No condescension.** Simple words, adult tone. The reader is new to the topic, not a child.

## The shape of the page

```text
one sentence: what this thing is, in words a stranger would use
big picture 1 : the thing, drawn
big picture 2 : the thing doing its job, step by step
one line      : the part people get wrong
one line      : what this explanation left out (only if it left something out)
```

Three to five visuals is the whole page. Inline SVG or plain HTML boxes beat any chart library here:
the drawing has to be readable on a phone, at a glance, with no legend to study.

```bash
open path/to/eli5-<topic>.html
```

## Anti-patterns

| Anti-pattern | Why it fails | Do this instead |
| --- | --- | --- |
| Define a term with two more terms | The reader loses the thread on line one | Show the thing, then name it |
| A wall of text with one decorative image | That is a blog post with a picture | Picture first, caption second |
| "Imagine you're a packet travelling…" | Cute framing, still abstract | Compare to an object the reader has held |
| Simplify until it is wrong | The reader now has to unlearn it | Keep it true and name what you dropped |
| Baby talk, emoji, exclamation marks | Talks down to the reader | Plain adult words, short sentences |
| Five diagrams of the same idea | Repetition reads as padding | One picture per genuinely new idea |

## Where this ends

- Someone already following the conversation who needs the shape of one mechanism: `show-me`.
- A structured curriculum with exercises, assessment and progression: `course-builder`.
- Documentation an informed reader will keep coming back to: `technical-writing`.
- Making an existing text sound human rather than simpler: `bro`.
