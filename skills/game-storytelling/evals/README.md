# Eval harness — `game-storytelling`

Agent-run eval, not a shell script. A human or judge-agent drives a Claude Code
agent and scores its behaviour against `cases.yaml`. There is no automated grader.

`cases.yaml` has three blocks: `should_trigger` (7), `should_not_trigger` (5),
and `capability` (2 scenarios with `must_include` rubrics).

## A. Triggering accuracy

Assert the skill fires on real narrative-design work (premise/pillars, branching
and choice, dialogue-tool authoring, quests, environmental storytelling,
ludonarrative harmony) and stays quiet on near-misses that belong to `game-design`
(mechanics/balance), `level-design` (spatial layout), the engine skill (dialogue
runner + save wiring), `marketing` (store/trailer copy), or plain prose fiction.
Load only this skill, run each prompt in a fresh session for 3–5 trials, and score
`should_trigger` as fire / `should_not_trigger` as don't-fire (bonus: routes to the
named `route_to`). Pass bar: ≥90% correct decisions across all trials.

## B. Capability uplift

Run each `capability` scenario WITH vs WITHOUT the skill and score against its
`must_include` rubric. The branching scenario checks the containment kit (2^N
framing, foldback/reconvergence, gates, state-over-structure, real-vs-illusory
choice) and engine-agnostic hand-off; the dissonance scenario checks the verb/
reward audit and cheaper-piece fix. Pass bar: WITH the skill covers ≥80% of rubric
points and clearly beats the baseline (which typically skips the explosion math,
conflates fake stakes with real choice, and writes engine code instead of a graph).
