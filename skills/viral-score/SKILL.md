---
name: viral-score
description: "Use to judge whether a short-form clip is worth publishing — scores a reel, short or podcast excerpt 0-100 on ten weighted criteria with automatic penalties, then ranks a batch and says where the cut-off falls. Run it on transcript candidates before rendering. NOT writing the hook or caption (that is `shortform-packaging`), NOT inventing the idea (that is `shortform-ideation`), NOT executing the edit (that is `shortform-editing`)."
tags: [viral, score, rubric, shortform, reels, shorts, tiktok, ranking, evaluation, retention]
recommends: [shortform-packaging, shortform-ideation, shortform-editing, shortform-strategy, video-shorts]
profiles: []
origin: risco
---

# viral-score — is this clip worth publishing?

A fixed rubric for scoring a vertical clip's chance of travelling. Its value is that it is
**fixed**: the same clip scores the same on Monday and Friday, and two clips are comparable
because they were measured with the same instrument.

So **do not substitute your own judgment for the rubric and do not adjust the weights.** If a clip
has a quality the rubric does not capture, say so in the reasons — but score it with this.

Score candidates **before rendering** whenever you can. Judging a transcript excerpt costs seconds;
editing a clip that gets discarded costs an afternoon.

## The ten criteria

Each is scored **0-10**.

| # | Criterion | Weight | What earns the points |
|---|---|---|---|
| 1 | **Opening hook** | 20 % | Do the first 3 seconds stop the scroll? Curiosity, surprise, emotion, a strong claim, a striking open |
| 2 | **Expected retention** | 20 % | Is there a reason to reach the end? Sustained curiosity, pace, resolution, no dead air |
| 3 | **Emotional impact** | 15 % | Intensity: inspiration, awe, fear, anger, joy, nostalgia, humour, surprise. **Indifference scores very low** |
| 4 | **Shareability** | 10 % | Would someone send this to a friend? |
| 5 | **Comment-worthiness** | 10 % | Does it invite debate or a reply? |
| 6 | **Message clarity** | 5 % | Does the idea fit in one sentence? |
| 7 | **Value density** | 5 % | Does every second earn its place? |
| 8 | **Originality** | 5 % | Is it different or unexpected? |
| 9 | **Context independence** | 5 % | Does it land without having heard the rest of the episode? |
| 10 | **Storytelling** | 5 % | Is there a story, a lesson, or a transformation? |

## The calculation

```text
Viral Score = ( Hook×0.20 + Retention×0.20 + Emotion×0.15 + Shareability×0.10
              + Comments×0.10 + Clarity×0.05 + Density×0.05
              + Originality×0.05 + Context×0.05 + Storytelling×0.05 ) × 10
```

## Automatic penalties

Subtracted **after** the formula, and they stack.

| Penalty | Points |
|---|---|
| Weak hook | −10 |
| Slow intro | −8 |
| Needs too much context | −10 |
| Long pauses | −5 |
| Idea too generic | −8 |
| Provokes no emotion | −10 |
| Unsatisfying ending | −5 |

Clamp the final result to **[0, 100]**.

## Reading the score

| Range | Verdict |
|---|---|
| 95-100 | Exceptional. Publish immediately |
| 90-94 | Very likely to perform |
| 80-89 | Good candidate. Worth editing and publishing |
| 70-79 | Acceptable, but there are better clips |
| 60-69 | Weak. Publish only if there is no alternative |
| 0-59 | Discard |

## Required output, per clip

- **Start** and **end timestamp**
- **Viral Score** (0-100)
- A **table** with all ten criterion scores
- **Reasons** behind the scoring
- **Main strengths**
- **Main weaknesses**
- **Verdict**: Publish / Review / Discard

Scoring several clips adds two things: a **ranking from highest to lowest**, and **where the
cut-off falls** — the point below which publishing stops being worth it.

## Applying it well

**Score the clip, not the topic.** A fascinating episode routinely yields a clip that scores 45.

**Judge the hook on the actual first three seconds**, not on the idea in the abstract. A clip that
opens with a filler word or halfway through a sentence has a weak hook: −10. That is also why the
excerpt should start on a sentence boundary — where you cut decides the hook.

**Be strict about context independence.** If the viewer needs to know who the guest is, or what the
previous question was, that is −10.

**Do not inflate the mean.** If twenty clips all come out above 80, the rubric is not being applied.
A healthy batch spreads widely, with few above 85.

**Justify every low score with what happens in the clip**, at a timestamp — not with a generality.

## Anti-patterns

| Anti-pattern | Do instead |
|---|---|
| Scoring how interesting the subject is | Score this clip's execution; the topic is not the artifact |
| Grading the hook from the full idea | Read only the first three seconds as the viewer receives them |
| Compressing a batch into 78-85 | Use the range; a flat distribution means the instrument is not being used |
| "Weak hook" with no evidence | Quote the opening words and the timestamp |
| Adjusting weights for a clip you like | The weights are the instrument. Argue in the reasons, score with the rubric |
| Rendering first, scoring after | Score transcript candidates, then edit only what survives |
| Skipping the penalties because the total looks low | They are automatic and they stack; a 72 with three penalties is a 49 |

## See Also

- `../shortform-packaging/SKILL.md` — the hook line, caption, hashtags and cover for a clip that
  passed this bar.
- `../shortform-ideation/SKILL.md` — inventing the angle, upstream of anything scoreable.
- `../shortform-editing/SKILL.md` — executing the edit once a clip is chosen.
- `../shortform-strategy/SKILL.md` — what the channel should publish over time, which this feeds
  with per-clip evidence.
