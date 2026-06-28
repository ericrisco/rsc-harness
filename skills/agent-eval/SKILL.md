---
name: agent-eval
description: "Use when you need to measure whether an LLM or agent system actually got better and gate merges on it — before/after a prompt or model change, building a golden set, fixing a noisy or inflated LLM-as-judge, scoring a RAG pipeline (faithfulness, contextual recall) or an agent trajectory (tool-correctness, task-completion), or choosing between DeepEval / Inspect AI / promptfoo / Braintrust. Triggers: 'is the new prompt actually better', 'build a golden set / regression suite', 'our judge gives everything a 9/10', 'fail the PR when answer quality drops', 'score the tool path not just the final answer', 'medir si el agente mejoró', 'tenim un eval que dona puntuacions inflades', 'montar un golden set'. NOT building the agent loop/tools/RAG plumbing (that is building-agents)."
tags: [evals, llm, agents, llm-as-judge, regression-gate, ai]
recommends: [building-agents, prompt-engineering, observability]
origin: risco
---

# Measure agent quality you can defend and gate on

Turn "the agent feels better" into a number you can put in a PR check. You own the eval dataset, the scorer mix, the LLM-as-judge calibration, and the block-on-regression CI gate — framework-neutral, provider-neutral.

## The one rule

> A score you do not trust is worse than no score. Calibrate the scorer against human labels and report the agreement **before** you gate anything on it. An uncalibrated judge gives false confidence, which is more dangerous than admitted ignorance.

> Build your own golden set. A public leaderboard number is not your number — identical model weights swing SWE-Bench Verified by 10–20 points just by changing the harness. Measure *your* task on *your* data.

## When to use / When NOT

**Use when:**
- "Is the new prompt/model actually better?" — before/after on a fixed dataset.
- "Build a golden set / regression suite for this agent."
- "Our judge gives everything 9/10 / the scores are inflated" — judge calibration.
- "Fail the PR when answer quality / faithfulness / tool-call accuracy drops" — CI gate.
- Scoring a RAG pipeline (faithfulness, answer relevancy, contextual recall/precision).
- Scoring an agent's *trajectory* — tool calls, task completion — not just the final string.
- Picking between DeepEval / Inspect AI / promptfoo / Braintrust.

**Do NOT use — route instead:**

| The ask | Route to | Why it is not this skill |
| --- | --- | --- |
| Build the agent loop, tools, RAG plumbing | `building-agents` | It builds the system; you score it. They cross-link. |
| "Make the answers shorter / rewrite the prompt" | `prompt-engineering` | Evals say it is worse; that skill changes the words. You never edit the prompt. |
| pytest/jest on deterministic functions | `testing-py` / `testing-web` | Assert-equals on pure code, not stochastic outputs scored by a judge. |
| Dashboards / tracing of live production traffic | `observability` | Online monitoring; you are offline + pre-merge. |
| Red-team, jailbreak, prompt injection | `agent-safety` | Adversarial coverage, not quality measurement. |
| Per-token cost budgets and accounting | `cost-tracking` | You report cost-per-task as one metric; the discipline lives there. |
| A/B stats on product/funnel metrics | `ab-testing` | Web experiments, not offline model comparison on a fixed set. |

(`building-agents`, `ab-testing`, `chatbot` are linkable siblings here; the rest are KNOWN ids you name but cannot link yet.)

## The eval anatomy

Every framework instantiates the same five-stage pipeline. Learn it once; the tool is a detail.

```text
dataset ──▶ runner ──▶ scorers ──▶ metrics ──▶ gate
(JSONL    (calls the   (det / judge  (aggregate +  (pass/fail
golden    system per   / human)      bootstrap CI) exit code)
set)      case)
```

DeepEval, Inspect AI, and promptfoo are all just opinionated wrappers around this. If you understand the stages you can switch tools without relearning the craft.

## Build the dataset first

The dataset is the asset. Everything else is replaceable. Rules:

- **50–200 hand-labeled cases per failure mode**, not per total. Coverage of how the system fails beats raw volume. 80 real failure cases > 1000 generic ones.
- **Never synthetic-only.** A set the model wrote will not surface the model's blind spots. Mine real traffic / tickets / transcripts and hand-label.
- **Version it in git as JSONL**, a first-class reviewed asset — same as code. Diffs are reviewable; relabels are auditable.
- **Decontaminate.** The eval set must not appear in training data or few-shot examples, or the score is a memorization artifact, not a capability.

Case schema — one JSON object per line:

```jsonl
{"id":"refund-001","input":"Where is my refund for order 4821?","expected":"States refunds take 5-7 business days and asks for nothing already on file","context":["policy: refunds 5-7 business days"],"meta":{"failure_mode":"hallucinated_policy","source":"ticket#4821"}}
{"id":"refund-002","input":"Cancel my subscription and refund this month","expected":"Cancels, refunds prorated amount, confirms no future charge","context":["policy: prorated refund on cancel"],"meta":{"failure_mode":"missed_tool_call","source":"ticket#5190"}}
```

`failure_mode` in `meta` is what lets you slice metrics by mode and find *which* kind of bug regressed — not just that the aggregate dropped.

> Bad: "generate 1000 test questions with GPT and use those." Good: "80 real failure-mode cases pulled from support tickets, hand-labeled, tagged by failure mode."

## Choose the scorer — the 60/30/10 mix

Reach for the cheapest scorer that correlates with human judgment. Default mix:

| Share | Scorer kind | Use for | Why |
| --- | --- | --- | --- |
| ~60% | Deterministic — exact match, regex, JSON-schema validation, latency threshold | Anything with a checkable shape: format, required fields, a known string, a budget | Free, instant, zero drift. Never spend a judge call on something a regex settles. |
| ~30% | LLM-as-judge — G-Eval, DAG, custom Python scorer | Meaning: is this answer faithful, relevant, helpful | Only where correctness is semantic. Costs money and can drift — so calibrate it. |
| ~10% | Human-in-the-loop | Genuinely ambiguous cases the judge disagrees on | The ground truth you calibrate the judge against. |

One `Scorer` protocol, two implementations behind it — deterministic and judge are interchangeable to the runner:

```python
from typing import Protocol

class Scorer(Protocol):
    name: str
    def score(self, case: dict, output: str) -> float: ...  # 0.0–1.0

class JsonSchemaScorer:
    name = "schema_valid"
    def score(self, case, output):  # deterministic, free, no drift
        import json
        try:
            json.loads(output)
            return 1.0
        except ValueError:
            return 0.0

class FaithfulnessJudge:
    name = "faithfulness"
    def __init__(self, judge_model): self.judge = judge_model
    def score(self, case, output):  # judge only where meaning matters
        return self.judge.rate(case["context"], output)  # see judge-design.md
```

## LLM-as-judge you can trust

A judge is a scorer, so the one rule applies hardest here. Each rule, with its why:

- **Judge model ≥ system under test.** A weaker judge cannot reliably rank a stronger system — it scores noise.
- **The rubric must force a written rationale before the score.** Rationale-first judging is what pushes judge–human agreement to ~85% — higher than two humans agree with each other. A bare number is a vibe with a decimal point.
- **Pairwise beats pointwise for stability.** "Is A or B better?" is more reproducible than "rate A from 1–10," which inflates and clusters at 8–9.
- **Swap positions and average.** Judges favor whichever answer came first; run A-then-B and B-then-A to cancel position bias.
- **Calibrate against human gold and report agreement** before you trust a single judge score.

> Bad judge prompt: "Rate this answer 1–10." → everything lands 8–9, useless.
> Good: "Compare answer A and answer B against the reference. First write one sentence on each per the rubric, then output the better label." → forces reasoning, gives a stable signal.

Full rubric templates (pointwise + pairwise), the position-swap harness, the calibration script (agreement / Cohen's kappa vs human gold), G-Eval vs DAG, and the judge bias catalog (length, position, self-preference) with mitigations live in **[references/judge-design.md](references/judge-design.md)**.

## Agent and RAG scorers

Score the path, not only the destination. Beyond exact/judge:

**RAG** (DeepEval / RAGAS names):
- **Faithfulness** — does the answer only claim what the retrieved context supports? Catches hallucination.
- **Answer relevancy** — does it actually address the question, or drift?
- **Contextual recall / precision** — did retrieval fetch the right chunks, and not bury them in noise? Separates a retrieval bug from a generation bug.

**Agent:**
- **Tool correctness** — right tool, right arguments, right order.
- **Task completion / goal accuracy** — did it finish the job, not just produce plausible text.
- **Trajectory scoring** — grade the sequence of steps. A correct final answer from a wrong path will fail differently next time; only trajectory scoring catches it.

The system side of these (how the loop and tools are built) is `../building-agents/SKILL.md`.

## The regression gate

> Gate policy: **block on regression vs a committed baseline, not on an absolute threshold.** An absolute threshold flaps CI on judge noise and gives no signal on drift; "did this PR make a tracked metric worse than `main`?" is the question that matters.

- Compute a **bootstrap confidence interval** on each metric so judge noise alone does not fail the build — only a drop beyond the CI counts.
- The runner writes `eval-report.json` (metrics, per-failure-mode slices, baseline, pass/fail) and **exits non-zero** on a real regression so the merge is blocked.

```python
import json, sys

def gate(current: dict, baseline: dict, margin: float = 0.0) -> int:
    regressed = []
    for metric, score in current.items():
        if metric in baseline and score < baseline[metric] - margin:
            regressed.append((metric, baseline[metric], score))
    report = {"metrics": current, "baseline": baseline, "regressed": regressed,
              "passed": not regressed}
    with open("eval-report.json", "w") as f:
        json.dump(report, f, indent=2)
    if regressed:
        for m, b, c in regressed:
            print(f"REGRESSION {m}: {b:.3f} -> {c:.3f}", file=sys.stderr)
        return 1
    return 0

sys.exit(gate(run_eval(), json.load(open("eval-baseline.json"))))
```

The complete provider-neutral runner (JSONL loader, scorer registry, bootstrap-CI metrics), the GitHub Actions workflow, and side-by-side DeepEval-pytest + Inspect-AI Task/Solver/Scorer versions of the same eval live in **[references/runner-and-gate.md](references/runner-and-gate.md)**.

## Framework cheat-sheet

Pick by where the eval runs and what it must do. Versions as of 2026-06 — re-verify, they rot.

| Tool | What it is | Reach for it when |
| --- | --- | --- |
| **DeepEval** v4.0.3 | pytest-native, 50+ metrics, Decision-Graph (DAG) logic | Your CI is Python/pytest and you want metrics that read like tests. |
| **Inspect AI** v0.3.225 (UK AISI) | dataset→Task→Solver→Scorer, bootstrap CIs, first-class tool-use & trajectory logging, 200+ pre-built evals | Multi-provider, safety-adjacent, or you need real trajectory scoring. |
| **promptfoo** (acquired by OpenAI 2026-03) | CLI + YAML, strong pre-deploy + red-team across 50+ vuln types | Config-driven pre-deploy checks; route the red-team half to `agent-safety`. |
| **Braintrust / LangSmith / Phoenix** v16.0.0 | platforms: annotation, regression tracking, dashboards | You need human annotation queues and historical regression tracking. |

> The two-tool pattern is normal, not over-engineering: a light CI gate (DeepEval / RAGAS / promptfoo) **plus** a platform (Braintrust / LangSmith / Arize) for annotation and history. They share data; different jobs.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
| --- | --- | --- |
| Vibes-gating ("feels better, merge it") | No artifact to defend or reproduce | Gate on a number from a committed dataset |
| Synthetic-only dataset | Model-written cases miss the model's blind spots | Hand-label real traffic by failure mode |
| Uncalibrated judge | Confident wrong scores; worse than none | Report agreement vs human gold first |
| Judge weaker than system | Cannot rank a stronger system; scores noise | Judge model ≥ system under test |
| Absolute-threshold gate | Flaps CI on judge noise, blind to drift | Block on regression vs baseline + bootstrap CI |
| Shipping on a leaderboard number | Harness effect = 10–20pt swing | Build your own golden set |
| Scoring only the final answer | A right answer from a wrong path regresses later | Score the trajectory too |
| Never relabeling drifted gold | Stale "truth" silently rots the gate | Review and relabel the golden set on a schedule |

## Project grounding

If the workspace has a `02-DOCS/` harness, record the eval policy in `02-DOCS/wiki/stack/evals.md`: dataset location, scorer mix, gate baseline file, judge model, and the failure modes covered. Write it as an OKF v0.1 wiki article per the harness [`wiki-article-template.md`](../harness/references/wiki-article-template.md): open with YAML frontmatter carrying a non-empty `type:` (use `type: stack`), `timestamp` in ISO 8601, and standard markdown links — never wikilinks. Index it in `02-DOCS/wiki/index.md` (the Knowledge map; root `CLAUDE.md` keeps only a short pointer). This is **recorded, not gated** — skip silently if there is no harness.

## verify.sh

`scripts/verify.sh` is read-only and tool-detecting. It validates that every `*.jsonl` golden set in the project parses and that each line carries the required `id`, `input`, `expected` keys; checks the shape of any `eval-report.json`; and runs `ruff` / `mypy` on example Python and `markdownlint` on docs when those tools are installed. Every missing tool prints a yellow WARN and is skipped — never a failure. An empty or clean target exits 0.

## See also

- `../building-agents/SKILL.md` — builds the agent/RAG/tool system you score here.
- `../chatbot/SKILL.md` — a common system-under-test for these evals.
- KNOWN siblings to route to (not yet linkable): `prompt-engineering`, `observability`, `agent-safety`, `cost-tracking`, `testing-py`, `ab-testing`.
- External (no link): RAGAS, DeepEval, Inspect AI, promptfoo, Braintrust.
