---
name: agent-safety
description: "Use when bounding an LLM agent that already runs — scoping its task domain, gating tools to least privilege, defending against prompt injection in untrusted web/email/RAG text, requiring human approval on irreversible actions, capping runtime and cost, or triaging what it already did. NOT building the loop, tools, or RAG (that is `building-agents`)."
tags: [agent-security, guardrails, prompt-injection, least-privilege, owasp-agentic]
recommends: [building-agents, secure-coding, agent-eval]
origin: risco
---

# Agent safety

You are the security review for an agent's **agency**, not for its code. The loop works,
tools are wired, memory persists — your job is to make that autonomy *bounded*. If you
want to review ordinary endpoints, auth, or secrets handling, that is
`../secure-coding/SKILL.md` — this skill is the *Agentic* Top 10, the risks that exist only
because a model has tools and autonomy. If the loop or tools do not exist yet, that is
`../building-agents/SKILL.md`. You arrive *after* both.

`references/threat-model.md` carries the OWASP Agentic Top 10 2026 risks mapped to the
controls below, the pre-ship guardrail checklist, and the incident-triage flow for "the
agent did X" — open it when you are reviewing before ship or reconstructing an incident.

## The ownership split

Agent security splits into four layers — **Model · Harness · Tools · Environment**. The
model provider owns only the Model layer (alignment, refusals). Everything else is yours:
the Harness (loop, memory, context assembly), the Tools (what the agent can *do*), and the
Environment (creds, network, blast radius). Do not outsource a layer you own to "the model
is aligned."

Three excesses cause almost every agentic incident. Cut all three:

- **Excessive functionality** — tools the task never needs.
- **Excessive permissions** — broader scopes/creds than the tool needs.
- **Excessive autonomy** — acting without checking back when it should.

The operating principle is **least agency**: autonomy is earned per task, not defaulted.

## Scope limits

- **Declare the allowed task domain as a hard boundary in the system prompt.** Why: an
  undeclared scope is an infinite scope; "you are a refund assistant; you do not touch
  payroll" is a constraint a reviewer can check.
- **Deny by default — the agent starts with zero tools.** Each tool earns its place by a
  task justification. Why: an opt-out tool list grows; an opt-in list stays minimal.
- **Segregate the instruction channel from the data channel.** System/developer prompt =
  trusted instructions. Everything the agent reads at runtime = data, never instructions.
  Why: this single boundary is what stops indirect injection (LLM01).

## Tool gating / least agency

Give every tool a profile: **read / write / exec / send**, the exact resources it may
touch, and an **allowlist** (never a wildcard). Block destructive flags and secret paths
at the tool boundary, not in the prompt — the prompt is advisory, the boundary is enforced.

```python
# Bad: one wildcard tool = unbounded blast radius, runs anything the loop emits
def run_shell(cmd: str) -> str:
    return subprocess.run(cmd, shell=True, capture_output=True, text=True).stdout
```

```python
# Good: narrow tool, allowlisted root, denied patterns, no shell
ALLOWED_ROOT = pathlib.Path("/srv/agent/workspace").resolve()
DENY = ("*.key", "*.pem", "*secret*", "*.env", "id_rsa*")

def read_file(path: str) -> str:
    p = (ALLOWED_ROOT / path).resolve()
    if not p.is_relative_to(ALLOWED_ROOT):           # no traversal out of scope
        raise PermissionError("path outside workspace")
    if any(p.match(g) for g in DENY):                # never read secrets
        raise PermissionError("denied pattern")
    return p.read_text()
```

- **Issue task-scoped, short-lived tokens — not the session's broad creds.** A credential
  should be valid only for the specific tool and the duration of one task. Why: a hijacked
  loop cannot reuse a session-wide token it never held.
- **Prefer read-only by default; writes/sends/exec are separate, gated tools.** Why: most
  steps only need to read, so most steps should be unable to mutate anything.

## Injection defense

Treat **all** external data as untrusted: user messages, retrieved documents, API
responses, emails, web pages, other agents' output. Sanitize and delimit before it enters
context, and **never let external text reach a privileged tool unmediated.**

| Source                         | Trust level | Required mediation before it can act        |
| ------------------------------ | ----------- | ------------------------------------------- |
| System / developer prompt      | Trusted     | none (this is the only instruction channel) |
| End-user chat message          | Untrusted   | delimit; treat as data, not commands        |
| Retrieved RAG / KB document    | Untrusted   | delimit; strip instruction-like spans       |
| Fetched web page / API JSON    | Untrusted   | parse to schema; no raw text → tool args    |
| Inbound email / ticket body    | Untrusted   | delimit; HITL on any action it requests     |
| Another agent's message        | Untrusted   | same as external user input                 |

```python
# Bad: retrieved chunk flows straight into a privileged action
chunk = retriever.search(q)[0].text          # attacker-controlled doc
agent.call_tool("send_email", to=extract_to(chunk), body=chunk)
```

```python
# Good: external content is quarantined data; the action is schema-validated + gated
chunk = retriever.search(q)[0].text
ctx = f"<retrieved untrusted>\n{chunk}\n</retrieved untrusted>"   # delimited, labeled
proposal = agent.draft("send_email", context=ctx)                # model proposes
args = SendEmail.model_validate(proposal.args)                   # schema or reject
if args.to_domain not in ALLOWED_DOMAINS:                        # exfil guard
    raise PermissionError("recipient outside allowlist")
require_human_approval("send_email", args)                       # irreversible → HITL
```

- **Validate every tool-call argument against a strict schema before execution.** Why: a
  schema rejects the surprise field, encoded payload, or off-allowlist recipient injection
  produces.
- **Watch for exfiltration shapes** — unexpected outbound URLs, base64 blobs, recipients
  outside the allowlist. Why: data theft is the common payload of a successful injection.

## Human-in-the-loop by risk class

Do **not** approve every action — reported ~93% of permission prompts get approved without
being read, so blanket prompting trains a rubber stamp. Gate by **risk class**, keyed on
reversibility × blast radius. Bind each approval to the **exact parameters** with a
short-lived token so the approved action cannot be swapped after the click.

| Action type (examples)                          | Reversible? | Blast radius | Control            |
| ----------------------------------------------- | ----------- | ------------ | ------------------ |
| Read file, search KB, fetch page                | n/a         | none         | **auto**           |
| Write to scratch workspace, internal draft      | yes         | local        | **log-only**       |
| Mutate prod DB, deploy, change config            | hard        | system       | **approve (HITL)** |
| Send email/payment to external party, post live | no          | external     | **approve (HITL)** |
| Delete backups, rotate prod creds, mass-delete  | no          | catastrophic | **block** (or step-up auth) |

- **Step up for the top row** — high-value irreversible actions deserve fresh auth, not the
  ambient session. Why: a hijacked session should not also hold the keys to the worst action.

## Memory hygiene

- **Validate and sanitize content before it is stored.** Why: memory poisoning persists
  across sessions (OWASP Agentic T1) — unlike session-scoped injection, a poisoned memory
  re-attacks every future run until purged.
- **Isolate memory per user and per session; do not let one user's writes color another's
  reads.** Why: shared memory is a cross-tenant injection channel.
- **Expire entries and cap memory size; redact PII (SSN, cards, API keys) before persist.**
  Why: stale instructions and leaked secrets both age into liabilities.

## Runtime kill-switches

A looping or hijacked agent must hit a wall on its own. Set hard caps, fail closed:

- **Tool-call rate cap** (e.g. ~30 calls/min) — runaway loops trip it before they do damage.
- **Cost cap per session** (e.g. ~$10) — a wallet attack stops at a known ceiling.
- **Loop / step cap** — a fixed max iterations kills the infinite plan.
- **Wall-clock timeout** — a stuck agent is terminated, not left running.

Log every tool call (arguments redacted) and alert on repeated approval-bypass attempts.

## Anti-patterns

| Anti-pattern                                   | Why it bites                                                   | Do instead                                          |
| ---------------------------------------------- | ------------------------------------------------------------- | --------------------------------------------------- |
| Approve every action                           | ~93% rubber-stamped; the real risky one slips through         | Gate by risk class; HITL only on irreversible/external |
| One broad session token shared by all tools    | Hijacked loop reuses it everywhere                            | Task-scoped, short-lived per-tool tokens            |
| Trust RAG / fetched / email content            | Indirect injection (LLM01) becomes direct tool execution      | Delimit as untrusted data; mediate before any tool  |
| Wildcard `run_shell(cmd)` tool                 | Unbounded blast radius                                        | Narrow tools, allowlisted resources, denied patterns |
| Raw external text piped into tool args         | Attacker controls the action's parameters                     | Schema-validate args; allowlist recipients/domains  |
| Scope/limits stated only in the prompt         | Prompt is advisory; the model can be talked out of it         | Enforce at the tool/harness boundary                |
| No loop / cost / rate cap                       | A hijacked or looping agent runs until it runs out of money   | Hard fail-closed kill-switches                      |
| Redact PII only in the UI                       | The secret was already written to memory/logs                 | Redact before persistence, at the source            |
