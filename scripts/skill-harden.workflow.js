export const meta = {
  name: 'skill-harden',
  description: 'Detect AND fix one rsc skill: behaviorally score it, diagnose the failure, edit the right artifact with anti-gaming guards, re-verify, and commit on pass (max 2 rounds)',
  phases: [
    { title: 'Evaluate' },
    { title: 'Diagnose & Fix' },
    { title: 'Commit' },
  ],
}

// args may arrive as an object {skillId, noCommit} or as a string "debug" / "debug noCommit".
function parseArgs(a) {
  if (typeof a === 'object' && a) return { skillId: a.skillId || '', noCommit: a.noCommit === true }
  if (typeof a === 'string') {
    const toks = a.trim().split(/[\s,]+/).filter(Boolean)
    const id = toks.find((t) => !/^(no[-_]?commit|--no-commit)$/i.test(t)) || ''
    const nc = toks.some((t) => /^(no[-_]?commit|--no-commit)$/i.test(t))
    return { skillId: id, noCommit: nc }
  }
  return { skillId: '', noCommit: false }
}
const { skillId, noCommit } = parseArgs(args)
if (!skillId) throw new Error('skill-harden: pass the skill id as args, e.g. "debug" or "debug noCommit"')
const EVAL = { scriptPath: 'scripts/skill-behavior-eval.workflow.js' }

const MAX_ROUNDS = 2

const SCORE_SCHEMA = {
  type: 'object',
  properties: {
    pass: { type: 'boolean' },
    absolute: { type: 'number' },
    lift: { type: 'number' },
    mustFix: { type: 'array', items: { type: 'string' } },
  },
  required: ['pass', 'absolute', 'lift', 'mustFix'],
}

const FAULT_SCHEMA = {
  type: 'object',
  properties: {
    // 'capability' is the honest third exit: this loop can only ever write guidance (SKILL.md /
    // references), so a failure that needs an executable capability is out of its reach. Saying so
    // beats writing a paragraph that pretends to cover it.
    fault: { type: 'string', enum: ['skill', 'eval', 'capability'] },
    rationale: { type: 'string' },
    missingCapability: { type: 'string' },
    surface: { type: 'string' },
  },
  required: ['fault', 'rationale'],
}

const HOLDOUT_VERDICT_SCHEMA = {
  type: 'object',
  properties: {
    verdict: { type: 'string', enum: ['pass', 'block'] },
    kind: { type: 'string', enum: ['transfer', 'regression', 'indeterminate'] },
    lift: { type: 'number' },
    reason: { type: 'string' },
  },
  required: ['verdict', 'kind', 'reason'],
}

const GUARD_SCHEMA = {
  type: 'object',
  properties: {
    genuine: { type: 'boolean' },
    rationale: { type: 'string' },
  },
  required: ['genuine', 'rationale'],
}

const HOLDOUT_SCHEMA = {
  type: 'object',
  properties: {
    scenario: { type: 'string' },
    mustInclude: { type: 'array', items: { type: 'string' } },
  },
  required: ['scenario', 'mustInclude'],
}

// Score a raw eval result via the authoritative CLI (keeps math in behavior-score.js).
async function scoreRaw(raw, round) {
  return agent(
    `Write this JSON to /tmp/harden-${skillId}-r${round}.json exactly, then run ` +
    `\`node scripts/skill-behavior-eval.js --score /tmp/harden-${skillId}-r${round}.json\`. ` +
    `Read its markdown output and return {pass, absolute, lift, mustFix}: pass = the CLI exit code was 0 ` +
    `(scorecard says PASS), absolute and lift from the Verdict line, mustFix = the bullet list under "Must fix" ` +
    `(empty array if none).\n\nJSON:\n${JSON.stringify(raw)}`,
    { label: `score:r${round}`, phase: 'Evaluate', schema: SCORE_SCHEMA },
  )
}

// The hold-out gate: score the EDITED skill against a fresh scenario the fixer never saw, and let a
// deterministic CLI decide. The verdict is a comparison of numbers the agent reports, never a
// judgement the agent makes (constitution P1).
async function holdoutVerdict(raw, scenario, round) {
  const payload = JSON.stringify({ ...raw, holdoutScenario: scenario })
  return agent(
    `Write this JSON to /tmp/harden-${skillId}-holdout-r${round}.json exactly, then run ` +
    `\`node scripts/skill-behavior-eval.js --holdout /tmp/harden-${skillId}-holdout-r${round}.json\`. ` +
    `Read its markdown output and return {verdict, kind, lift, reason} verbatim from that output — ` +
    `verdict "pass" if the CLI exit code was 0, "block" if it was 1. Do NOT form your own opinion ` +
    `about whether the fix was good: report what the CLI decided.\n\nJSON:\n${payload}`,
    { label: `holdout:r${round}`, phase: 'Diagnose & Fix', schema: HOLDOUT_VERDICT_SCHEMA },
  )
}

const history = []
const holdout = []          // one record per fix round: did the hold-out run, and what did it say
let lastFixHoldout = null   // verdict of the last round that left an edit on disk
let lastFault = null        // last diagnosis, so the report can name a capability we cannot write
let outcome = null
let round = 0
let committed = null

while (true) {
  phase('Evaluate')
  const raw = await workflow(EVAL, skillId)
  if (raw && raw.error === 'no-capability-scenarios') {
    return { skillId, error: 'no-capability-scenarios', history, committed: null }
  }
  const score = await scoreRaw(raw, round)
  history.push({ absolute: score.absolute, lift: score.lift, pass: score.pass })

  if (score.pass) break
  if (round >= MAX_ROUNDS) break

  phase('Diagnose & Fix')
  const evidence = JSON.stringify(raw.scenarios || [])
  const fault = await agent(
    `Follow scripts/skill-harden-rubric.md (Diagnosis). The skill "${skillId}" FAILED its behavioral gate. ` +
    `mustFix:\n- ${score.mustFix.join('\n- ')}\n\nGrader signals (both A/B outputs, per-item evidence):\n${evidence}\n\n` +
    `Decide fault = 'skill', 'eval' or 'capability' and give a rationale. Default to 'skill' when unsure.\n\n` +
    `Choose 'capability' ONLY when the gap cannot be closed by words in a skill body: it needs an ` +
    `executable capability — something that fires on a real execution event and returns to the agent ` +
    `information it cannot obtain on its own (a hook, a script, a tool, a sub-agent). Advice that only ` +
    `tells the agent to remember something is NOT a capability. If you choose 'capability' you MUST name ` +
    `it in missingCapability and name where it would live in surface; a verdict that cannot name the ` +
    `capability is an excuse, not a diagnosis — pick 'skill' instead.`,
    { label: `diagnose:r${round}`, phase: 'Diagnose & Fix', schema: FAULT_SCHEMA },
  )
  lastFault = fault

  if (fault.fault === 'eval') {
    const judged = await agent(
      `Follow scripts/skill-harden-rubric.md (Eval-fix guard). Proposed: edit skills/${skillId}/evals/cases.yaml to ` +
      `correct an eval bias (self-describing scenario, or a phantom-context must_include item). ` +
      `Rationale from diagnosis: ${fault.rationale}\n\n` +
      `Decide genuine=true ONLY if the change corrects a real bias WITHOUT lowering the bar. If genuine, APPLY the ` +
      `edit to cases.yaml now (Edit tool); if not, change nothing. Return {genuine, rationale}.`,
      { label: `eval-judge:r${round}`, phase: 'Diagnose & Fix', schema: GUARD_SCHEMA },
    )
    if (!judged.genuine) {
      // Eval blamed but not justified -> fall through to a skill fix this round.
      fault.fault = 'skill'
    }
  }

  if (fault.fault === 'capability') {
    // Out of this loop's reach: it can only write words. Stop honestly instead of producing guidance
    // that raises the score without the capability existing. Nothing is edited here on purpose.
    outcome = 'capability-out-of-reach'
    log(`${skillId}: needs a capability, not guidance — ${fault.missingCapability || '(unnamed)'} in ${fault.surface || '(unnamed surface)'}`)
    break
  }

  if (fault.fault === 'skill') {
    await agent(
      `Follow the author-skill discipline. The skill "${skillId}" must genuinely cover this mustFix without ` +
      `keyword-stuffing:\n- ${score.mustFix.join('\n- ')}\n\nEdit skills/${skillId}/SKILL.md (body) and/or files under ` +
      `skills/${skillId}/references/ to add the REAL missing capability (method, decision rules, concrete guidance). ` +
      `Do not touch evals/. Apply the edits now.\n\n` +
      `HARD CONSTRAINT — the Generalization gate (scripts/skill-harden-rubric.md defines it; it binds every ` +
      `line you write, and it binds BEFORE you write, not after):\n` +
      `Everything you add is global context that will apply to cases this skill has never seen. Write a ` +
      `reusable criterion that carries its own applicability condition — never the answer to the one ` +
      `scenario that failed. Banned outright: identifiers or titles from the eval scenario, names of its ` +
      `files/symbols/fixtures, rules that branch on its specific data, and reciting the finding as if it ` +
      `were a rule ("the last round showed X needs Y").\n` +
      `Litmus test before every line: "would this still help on a case in this domain I have never seen?" ` +
      `If no, rewrite it as a criterion or drop it. A fix that only lifts this scenario's score will be ` +
      `caught by the hold-out and reverted, and the round will be wasted.`,
      { label: `fix:r${round}`, phase: 'Diagnose & Fix' },
    )
    const diffJudge = await agent(
      `Follow scripts/skill-harden-rubric.md (Skill-fix guard 1). Run \`git diff -- skills/${skillId}/SKILL.md skills/${skillId}/references\` ` +
      `and judge BOTH: (a) does the diff add genuine capability, or just echo the mustFix wording to satisfy the ` +
      `grader? and (b) does every added line survive the Generalization gate — a reusable criterion with its ` +
      `applicability condition, not the answer to the observed scenario (no eval-specific names, no branching on ` +
      `its data, no recited findings)? Fail either check and it is not a fix. ` +
      `If it fails, run \`git checkout -- skills/${skillId}/SKILL.md skills/${skillId}/references\` to revert it. ` +
      `Return {genuine, rationale}.`,
      { label: `diff-judge:r${round}`, phase: 'Diagnose & Fix', schema: GUARD_SCHEMA },
    )

    if (!diffJudge.genuine) {
      holdout.push({ round, ran: false, why: 'edit reverted by the diff judge — nothing to validate' })
    } else {
      // Guard 2: hold-out. Score the EDITED skill on a fresh scenario the fixer never saw. The eval
      // engine runs every scenario with AND without the skill, so this already carries its own lift.
      const fresh = await agent(
        `Invent ONE fresh capability scenario for the "${skillId}" skill's domain that is NOT in its cases.yaml and ` +
        `does NOT enumerate its own requirements. Return {scenario, mustInclude:[3-6 outcome-level checks]}.`,
        { label: `holdout-gen:r${round}`, phase: 'Diagnose & Fix', schema: HOLDOUT_SCHEMA },
      )
      const holdoutRaw = await workflow(EVAL, { skillId, scenarios: [fresh] })
      const verdict = await holdoutVerdict(holdoutRaw, fresh.scenario, round)
      lastFixHoldout = verdict
      holdout.push({ round, ran: true, scenario: fresh.scenario, ...verdict })

      if (verdict.verdict === 'block') {
        // The edit lifted this skill's own cases.yaml but does not transfer to work the fixer never
        // saw. A memorized fix is not a fix: revert it. This is the guard the rubric always promised
        // and the code never enforced — see 02-DOCS/wiki/sdd/specs/generalization-gate.md.
        log(`${skillId}: hold-out ${verdict.kind} (lift ${verdict.lift}) — reverting round ${round}'s edit`)
        await agent(
          `Run exactly \`git checkout -- skills/${skillId}/SKILL.md skills/${skillId}/references\` and nothing else. ` +
          `The edit failed the hold-out gate (${verdict.kind}) so it must not survive. Return the command's output.`,
          { label: `holdout-revert:r${round}`, phase: 'Diagnose & Fix', effort: 'low' },
        )
      }
    }
  }

  round++
}

const passed = history.length > 0 && history[history.length - 1].pass === true
// A main-gate pass whose last surviving edit failed the hold-out is NOT a pass: it is a fix that
// only works on the cases it was tuned against. Conservative on purpose — a lost commit costs one
// re-run, a certified overfit costs the catalog.
const holdoutClean = !lastFixHoldout || lastFixHoldout.verdict === 'pass'
let notCommittedBecause = null

if (passed && holdoutClean && !noCommit) {
  phase('Commit')
  const commit = await agent(
    `The skill "${skillId}" now passes its behavioral gate. Commit ONLY its files: ` +
    `run \`git add skills/${skillId}\` then commit with a message describing the hardening. ` +
    `Author is Eric — do NOT add any Claude co-author or generated footer. Return the commit hash as plain text.`,
    { label: `commit:${skillId}`, phase: 'Commit' },
  )
  committed = (commit || '').trim()
} else if (outcome === 'capability-out-of-reach') {
  notCommittedBecause = `needs a capability this loop cannot write: ${lastFault.missingCapability || '(unnamed)'} in ${lastFault.surface || '(unnamed surface)'}. Route it through specify — guidance cannot close this gap.`
} else if (!passed) {
  notCommittedBecause = 'the behavioral gate still fails. Read the last scorecard and fix by hand, or deprecate the skill.'
} else if (!holdoutClean) {
  notCommittedBecause = `the last edit passed cases.yaml but failed the hold-out (${lastFixHoldout.kind}, lift ${lastFixHoldout.lift}) and was reverted. Re-run to try a different fix, or write the criterion by hand.`
} else if (noCommit) {
  notCommittedBecause = 'noCommit was requested.'
}

return {
  skillId,
  rounds: round + 1,
  history,
  holdout,
  outcome: outcome || (passed && holdoutClean ? 'passed' : 'gave-up'),
  missingCapability: lastFault && lastFault.fault === 'capability' ? { capability: lastFault.missingCapability, surface: lastFault.surface, rationale: lastFault.rationale } : null,
  committed,
  passed: passed && holdoutClean,
  notCommittedBecause,
}
