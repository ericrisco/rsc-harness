# Agent loops & harness — bounded, recoverable, observable

The loop is where agents earn or lose money. An unbounded loop is a runaway bill and
a wedged session; a bounded, idempotent, observable loop is a production system. Every
pattern here drives the `LLMProvider` from `provider-abstraction.md` — the loop never
names a vendor. Python 3.12+, Pydantic v2, async-first.

## The loop

`perceive → decide → act → observe`, repeated under hard caps: `max_steps`, a per-step
`asyncio.timeout`, and a wall-clock + dollar budget. State is a typed Pydantic object so
it can be logged, checkpointed, and replayed.

```python
from __future__ import annotations

import asyncio
import time
from typing import Literal

from pydantic import BaseModel, Field

from provider_abstraction import CompletionRequest, LLMProvider, Message, ToolSpec
from tools import dispatch, tool_specs  # your registry: see tools-and-rag.md


class AgentState(BaseModel):
    messages: list[Message]
    step: int = 0
    spent_usd: float = 0.0
    done: bool = False
    result: str | None = None
    stop_reason: Literal["done", "max_steps", "budget", "timeout", "error"] | None = None


async def run_agent(
    provider: LLMProvider,
    model: str,
    system: str,
    task: str,
    *,
    tools: list[ToolSpec] | None = None,
    max_steps: int = 12,
    step_timeout_s: float = 60.0,
    wall_clock_s: float = 300.0,
    budget_usd: float = 0.50,
) -> AgentState:
    tools = tools or tool_specs()
    st = AgentState(messages=[Message(role="system", content=system),
                              Message(role="user", content=task)])
    deadline = time.monotonic() + wall_clock_s
    for st.step in range(1, max_steps + 1):
        if time.monotonic() > deadline:
            st.stop_reason = "timeout"; break
        if st.spent_usd >= budget_usd:
            st.stop_reason = "budget"; break
        req = CompletionRequest(model=model, messages=st.messages, tools=tools)
        try:
            async with asyncio.timeout(step_timeout_s):       # decide
                resp = await provider.complete(req)
        except TimeoutError:
            st.stop_reason = "timeout"; break
        st.spent_usd += resp.usage.cost_usd
        st.messages.append(Message(role="assistant", content=resp.text))
        if not resp.tool_calls:                               # no action -> terminal
            st.done, st.result, st.stop_reason = True, resp.text, "done"; break
        for call in resp.tool_calls:                          # act + observe
            obs = await dispatch(call.name, call.arguments, idempotency_key=call.id)
            st.messages.append(Message(role="tool", tool_call_id=call.id,
                                       name=call.name, content=obs.model_dump_json()))
    else:
        st.stop_reason = "max_steps"
    return st
```

The `for/else` is deliberate: `else` runs only if the loop exhausts `max_steps` without
`break`, so an agent that never converges fails closed instead of looping forever.

## ReAct vs plan-execute

- **ReAct** (reason → act → observe, interleaved): the model decides the next tool from
  the latest observation. Best when the path is **uncertain** (debugging, research,
  exploration). The loop above *is* ReAct.
- **Plan-execute** (plan all steps, then run them): the model emits a typed plan once,
  the harness executes deterministically. Best when steps are **knowable** and you want
  fewer model calls and replayable execution.

```python
class Step(BaseModel):
    tool: str
    args: dict


class Plan(BaseModel):
    steps: list[Step]


async def plan_execute(provider: LLMProvider, model: str, system: str, task: str) -> list:
    from provider_abstraction import complete_structured  # picks strict schema per provider
    plan = await complete_structured(
        provider,
        CompletionRequest(model=model, messages=[Message(role="system", content=system),
                                                 Message(role="user", content=task)]),
        Plan,
    )
    observations = []
    for s in plan.steps:                       # deterministic execution; no model in the loop
        observations.append(await dispatch(s.tool, s.args, idempotency_key=f"{task}:{s.tool}"))
    return observations
```

**Recommended hybrid:** ReAct planning + typed tool execution. Let the model reason and
choose tools (ReAct), but force every action through the validated `dispatch` (typed
execution) — never let the model emit free-form shell or SQL.

## Observation design

The observation the agent reads back is the single biggest lever on recovery and context
cost. Return a typed envelope, never the raw API blob.

```python
class ToolResult(BaseModel):
    status: Literal["success", "warning", "error"]
    summary: str                                   # one line the model reads first
    data: dict | None = None                       # structured payload (small!)
    next_actions: list[str] = Field(default_factory=list)  # what the model can do next
    artifacts: list[str] = Field(default_factory=list)     # file paths / ids, not contents
```

```python
# BAD — dumps a 40 KB JSON blob into context; the model can't tell success from failure.
return {"raw": api_response.json()}

# GOOD — model-readable status + a recovery hint; large output is referenced, not inlined.
return ToolResult(
    status="warning",
    summary="Wrote 1,203 rows; 4 skipped (duplicate keys).",
    data={"written": 1203, "skipped": 4},
    next_actions=["inspect skipped rows via get_skipped(batch_id)"],
    artifacts=["s3://imports/batch_8123.csv"],
)
```

Why: `status` lets the model branch without parsing; `summary` keeps context cheap;
`next_actions` turns a dead end into a recovery path; `artifacts` keeps big payloads out
of the window (the model fetches them only if needed).

## Error-recovery contract

Every error path returns three things the model can act on: a root-cause hint, a safe
next instruction, and an explicit stop condition. Classify before deciding to retry.

```python
import random


def classify_error(e: Exception) -> Literal["transient", "permanent"]:
    code = getattr(e, "status_code", None)
    if code in (408, 409, 429) or (code is not None and code >= 500):
        return "transient"
    if isinstance(e, (TimeoutError, ConnectionError)):
        return "transient"
    return "permanent"  # 400/401/403/404/422 — retrying wastes budget


async def with_backoff(fn, *, max_attempts: int = 4, base: float = 0.5):
    for attempt in range(max_attempts):
        try:
            return await fn()
        except Exception as e:
            if classify_error(e) == "permanent" or attempt == max_attempts - 1:
                raise
            await asyncio.sleep(base * 2**attempt + random.uniform(0, base))  # jitter
```

```python
class CircuitBreaker:
    """Trip after N identical failures so the agent stops re-trying a doomed action."""

    def __init__(self, threshold: int = 3) -> None:
        self.threshold, self._fails = threshold, {}

    def record(self, signature: str) -> None:
        self._fails[signature] = self._fails.get(signature, 0) + 1

    def is_open(self, signature: str) -> bool:
        return self._fails.get(signature, 0) >= self.threshold
```

When the breaker is open for a tool+args signature, return a terminal
`ToolResult(status="error", next_actions=["change approach; this action keeps failing"])`
instead of calling the tool again.

## Determinism & idempotency

Evals and replays need determinism; side effects need idempotency.

```python
import hashlib


def call_signature(name: str, args: dict) -> str:
    # Content-addressed dedup: identical (tool, args) -> identical key.
    payload = name + "|" + json.dumps(args, sort_keys=True, ensure_ascii=False)
    return hashlib.sha256(payload.encode()).hexdigest()[:16]
```

- For evals, pin `temperature=0.0` and a fixed seed where the model accepts them, so transcripts
  are reproducible. Current Claude models reject sampling params: there, fix the prompt, the tool
  results and the model id, and compare runs by grade rather than by exact text.
- For side-effecting tools, pass an **idempotency key** (`call.id` or `call_signature`)
  so a retried step does not double-charge or double-insert (see `tools-and-rag.md`).
- Persist the full message transcript; a replayable transcript is the cheapest debugger
  you will ever have.

## Retries, timeouts, guardrails

Three independent budgets bound a run: **step count**, **wall-clock**, **dollars** (all
enforced in the loop above). Add **input/output guardrails** as a decorator so every tool
gets them for free.

```python
import functools
import re

_PII = re.compile(r"\b\d{3}-\d{2}-\d{4}\b|\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b")
_INJECTION = re.compile(r"ignore (all|previous) instructions|system prompt", re.I)


def guardrail(fn):
    @functools.wraps(fn)
    async def wrapper(args: BaseModel) -> ToolResult:
        blob = args.model_dump_json()
        if _INJECTION.search(blob):
            return ToolResult(status="error", summary="blocked: prompt-injection heuristic",
                              next_actions=["rephrase without meta-instructions"])
        result = await fn(args)
        if result.data and _PII.search(json.dumps(result.data)):
            result.data = {"redacted": True}        # never leak PII back into context
            result.summary += " (PII redacted)"
        return result
    return wrapper
```

Output guardrails also include schema validation (already enforced by the `ToolResult`
type) and an allowlist check on any returned URLs or paths.

## Multi-agent

Reach for multi-agent only when a single loop genuinely can't hold the task. Each extra
agent multiplies cost and latency and adds coordination failure modes.

```python
class SubResult(BaseModel):
    agent: str
    summary: str
    state: AgentState


async def orchestrate(provider: LLMProvider, model: str, subtasks: dict[str, str],
                      *, max_parallel: int = 4) -> list[SubResult]:
    sem = asyncio.Semaphore(max_parallel)            # bound fan-out concurrency

    async def one(name: str, task: str) -> SubResult:
        async with sem:
            st = await run_agent(provider, model, system=f"You are the {name} worker.", task=task,
                                 max_steps=6, budget_usd=0.10)   # each worker gets its OWN budget
            return SubResult(agent=name, summary=st.result or "(no result)", state=st)

    return await asyncio.gather(*(one(n, t) for n, t in subtasks.items()))
```

Pick the shape by dependency structure:

- **Orchestrator-worker** (above): independent subtasks fan out in parallel; the
  orchestrator synthesizes. Use for research, multi-file analysis, batch generation.
- **Sequential pipeline**: stage N consumes stage N-1's output (extract → transform →
  validate). Use when each step depends on the last.
- **Single agent**: everything else. It is cheaper and easier to debug; default here.

## Subagents

A subagent is a constrained sub-loop: a narrowed tool set, its own budget, and a single
summarized observation returned to the parent (so the parent's context stays small).

```python
async def spawn_subagent(provider: LLMProvider, model: str, task: str,
                         allowed_tools: list[ToolSpec]) -> ToolResult:
    st = await run_agent(provider, model, system="Focused subagent. Use only the given tools.",
                         task=task, tools=allowed_tools, max_steps=5, budget_usd=0.05)
    return ToolResult(status="success" if st.done else "warning",
                      summary=st.result or f"stopped: {st.stop_reason}",
                      data={"steps": st.step, "spent_usd": round(st.spent_usd, 4)})
```

The parent sees one `ToolResult`, not the subagent's entire transcript — context economy.

## Human-in-the-loop

Gate high-risk tools (deploy, schema migration, spend over a threshold) behind explicit
approval. Pause, surface a diff, resume on sign-off.

```python
HIGH_RISK = {"deploy", "run_migration", "issue_refund"}


async def dispatch_with_approval(name: str, args: dict, *, approve) -> ToolResult:
    if name in HIGH_RISK:
        decision = await approve(name, args)         # await human (UI, Slack, CLI prompt)
        if not decision.approved:
            return ToolResult(status="error", summary=f"{name} rejected by human",
                              next_actions=[decision.reason or "operator declined"])
    return await dispatch(name, args, idempotency_key=call_signature(name, args))
```

Surface a unified diff (for code/config changes) or a structured before/after (for data
changes) so the human approves the *effect*, not just the tool name.

## Checkpoint / resume

Persist `AgentState` after each step so a crashed or paused run resumes from the last
good point. Postgres `jsonb` via SQLAlchemy 2.0 async:

```python
from sqlalchemy import String, select
from sqlalchemy.dialects.postgresql import JSONB
from sqlalchemy.ext.asyncio import AsyncSession
from sqlalchemy.orm import DeclarativeBase, Mapped, mapped_column


class Base(DeclarativeBase):
    pass


class Checkpoint(Base):
    __tablename__ = "agent_checkpoints"
    run_id: Mapped[str] = mapped_column(String, primary_key=True)
    state: Mapped[dict] = mapped_column(JSONB)


async def save_checkpoint(session: AsyncSession, run_id: str, st: AgentState) -> None:
    row = await session.get(Checkpoint, run_id)
    if row is None:
        session.add(Checkpoint(run_id=run_id, state=st.model_dump(mode="json")))
    else:
        row.state = st.model_dump(mode="json")       # idempotent overwrite
    await session.commit()


async def resume(session: AsyncSession, run_id: str) -> AgentState | None:
    row = (await session.execute(select(Checkpoint).where(Checkpoint.run_id == run_id))).scalar_one_or_none()
    return AgentState.model_validate(row.state) if row else None
```

On resume, replay is safe because every side-effecting tool is keyed by an idempotency
key — re-running a completed step is a no-op (see `tools-and-rag.md`).

## Anti-patterns

- **Unbounded loops** — no step/time/budget cap. The single most expensive bug.
- **Hidden global state** — mutable module globals make runs non-reproducible and
  un-parallelizable. Keep state in the typed `AgentState`.
- **Tool sprawl** — 30 overlapping tools confuse the model and blow the schema budget.
  Fewer, narrower, typed tools win.
- **Swallowing errors** — `except: pass` turns a recoverable failure into a silent wedge.
  Classify, hint, and return a `ToolResult(status="error", ...)`.
- **No budget** — "we'll watch the dashboard" is not a control. Enforce dollars in code.

## See also

- `provider-abstraction.md` — the `LLMProvider` this loop drives, plus `complete_structured`.
- `tools-and-rag.md` — the `dispatch`, idempotency keys, and sandboxing the loop relies on.
