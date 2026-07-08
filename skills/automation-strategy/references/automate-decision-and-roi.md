# Automate decision & ROI — the numbers behind §1–§2

Depth for "should we automate this, and does it pay back?" Engine-agnostic. Once the answer is
yes, route the build to `../../automation-flows/SKILL.md` or the chosen platform skill.

## The decision scorecard

Score each factor honestly. None of these is a magic threshold — they're a forcing function to
stop you automating on vibes.

| Factor | Ask | Weak signal (lean NO) | Strong signal (lean YES) |
| --- | --- | --- | --- |
| **Frequency** | runs per week/month | a handful per quarter | dozens+ per week |
| **Time saved / run** | minutes of human toil removed | seconds, or "it's quick anyway" | many minutes, or a context-switch tax |
| **Manual error rate** | how often a human gets it wrong | near-zero, low stakes | frequent, or costly when wrong |
| **Stability** | how often steps/systems/rules change | changes most months | unchanged for many months |
| **Toil / morale** | is it soul-crushing repetitive work | mildly annoying | actively burning out a person |

**The gate:** automate when **frequent AND stable AND (meaningful time-per-run OR costly manual
error rate)**. Instability vetoes everything else — a high-value process that changes monthly will
cost more in rework than it saves. When in doubt, the tie-breaker is stability, then frequency.

### Why stability is the veto

Automation encodes *today's* process. Every change to the underlying process is now a change to
code/config someone has to make, test, and redeploy. On a stable process that's rare. On a churning
process it's a second job. If the process is still being figured out, keep it manual and cheap until
it stops moving.

## The unstable / broken-process trap

Automating a broken process gives you **automated brokenness at higher throughput**, plus a machine
that now obscures the brokenness from the humans who used to feel it.

Sequence to do it right:

1. **Write the process down** — the exact steps, inputs, decision rules, outputs.
2. **Standardize** — if three people do it three ways, pick one way. Remove the "it depends" branches
   or make them explicit rules.
3. **Run it manually against the written steps** a few times. Fix the doc where reality diverges.
4. **Only now automate** the standardized version.

Smell tests that you're not ready: the steps can't be written without "usually" or "it depends";
different people produce different outputs from the same input; the systems involved are mid-migration.

## Human-in-the-loop taxonomy

Keep these steps assisted, not autonomous. The automation stages the work; a human commits it.

| Step type | Example | Pattern |
| --- | --- | --- |
| **Judgment** | pricing exception, hiring, brand/legal-sensitive content | draft + route for approval |
| **Irreversible** | send money, delete data, terminate an account | prepare automatically, require a human click to commit |
| **High blast radius** | email the whole list, publish publicly, mass update | stage + preview + explicit go |
| **Low-freq / high-stakes** | quarterly filing, contract renewal | checklist-assist, human executes |

Rule of thumb: if a wrong autonomous run would be expensive *and* hard to undo, insert an approval
gate. It costs one click and buys you the day the automation is confidently wrong.

## Payback math (worked)

```text
build cost      = build hours × loaded hourly rate
gross saving/mo = runs/month × time saved per run (hrs) × loaded hourly rate
net saving/mo   = gross saving/mo − platform cost/mo − maintenance cost/mo
payback (months)= build cost / net saving/mo
```

**Loaded rate** = salary + overhead (benefits, tooling, management), not the bare wage — usually
1.3–2× the wage. Use it for both build cost and time saved so the comparison is fair.

### Example A — clear win

- Task runs 800×/month, saves 4 min each → 53.3 hrs/month saved.
- Loaded rate $60/hr → gross saving ≈ $3,200/month.
- Build = 20 hrs × $60 = $1,200. Platform ≈ $30/month. Maintenance ≈ 1 hr/month = $60.
- Net saving ≈ $3,200 − $90 = $3,110/month. **Payback ≈ 0.4 months.** Build it.

### Example B — a pet, not a tool

- Task runs 6×/month, saves 15 min each → 1.5 hrs/month.
- Gross saving ≈ $90/month. Build = 25 hrs × $60 = $1,500. Maintenance ≈ 1.5 hrs/month = $90.
- Net saving ≈ $90 − $90 = **~$0/month.** Payback = never. Don't automate; write a checklist.

### The two rules of thumb

- **Payback > ~12 months** → the process is probably too rare or too cheap. Reconsider.
- **Maintenance > ~30–50% of gross saving** → you've built something that eats its own ROI. The
  fragile-integration tax (auth expiry, API changes, edge cases) is real; if it's this high, either
  simplify the flow or question whether it should exist.

Maintenance is the line people omit and the reason ROI projections lie. Budget it explicitly.

## Build vs buy (platform vs custom code)

| Dimension | No/low-code platform | Custom code |
| --- | --- | --- |
| Time to first version | hours | days+ |
| Readable by non-engineers | yes | no |
| Complex/stateful/algorithmic logic | awkward, hits ceilings | natural |
| Testability, review, CI | weak | strong |
| Cost at high volume | per-run billing can dominate | marginal cost near zero |
| Vendor/connector coverage | huge | you build each integration |
| Portability / lock-in | often locked in | yours |

**Hybrid is normal and often best:** a platform orchestrates the glue and human-readable flow; a
small custom service or an `api-connector-builder` client does the one hard, high-volume, or
algorithmic part. Don't force either extreme.

## Total cost of ownership checklist

- Platform bill **at your real volume, in the platform's billing unit** (tasks vs credits vs
  executions vs seats — see the platform matrix; this is where the surprise lives).
- Build hours (loaded).
- Ongoing maintenance hours/month (loaded) — the honest number, not the hopeful one.
- Cost of a silent outage: what does one undetected failure cost, and how likely is it?
- Switching cost if you outgrow the platform (low portability = high later pain).
- The babysitting tax: a "free" flow a senior engineer nurses monthly is not free.
