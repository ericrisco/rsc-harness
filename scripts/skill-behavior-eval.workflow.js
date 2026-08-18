export const meta = {
  name: 'skill-behavior-eval',
  description: 'Behaviorally score one rsc skill: run each capability scenario with and without the skill, blind-grade both, emit raw signals',
  phases: [
    { title: 'Load' },
    { title: 'Execute & Grade' },
  ],
}

const skillId = (typeof args === 'string' ? args : (args && args.skillId)) || ''
if (!skillId) throw new Error('skill-behavior-eval: pass the skill id as args, e.g. "grants"')

const GRADE_OUTPUT = {
  type: 'object',
  properties: {
    mustInclude: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          item: { type: 'string' },
          satisfied: { type: 'boolean' },
          evidence: { type: 'string' },
        },
        required: ['item', 'satisfied', 'evidence'],
      },
    },
    quality: {
      type: 'object',
      properties: {
        completeness: { type: 'number' },
        actionability: { type: 'number' },
        correctness: { type: 'number' },
        grounding: { type: 'number' },
      },
      required: ['completeness', 'actionability', 'correctness', 'grounding'],
    },
  },
  required: ['mustInclude', 'quality'],
}

const LOAD_SCHEMA = {
  type: 'object',
  properties: {
    skillId: { type: 'string' },
    skillBody: { type: 'string' },
    scenarios: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          scenario: { type: 'string' },
          mustInclude: { type: 'array', items: { type: 'string' } },
        },
        required: ['scenario', 'mustInclude'],
      },
    },
  },
  required: ['skillId', 'skillBody', 'scenarios'],
}

const GRADE_SCHEMA = {
  type: 'object',
  properties: { gradeX: GRADE_OUTPUT, gradeY: GRADE_OUTPUT },
  required: ['gradeX', 'gradeY'],
}

phase('Load')
const injected = (typeof args === 'object' && args && Array.isArray(args.scenarios)) ? args.scenarios : null

const loaded = injected
  ? await (async () => {
      const body = await agent(
        `Read skills/${skillId}/SKILL.md and return its full text as "skillBody". ` +
        `Return {skillId: "${skillId}", skillBody, scenarios: []}.`,
        { label: `load-body:${skillId}`, phase: 'Load', schema: LOAD_SCHEMA, agentType: 'Explore' },
      )
      return { skillId, skillBody: (body && body.skillBody) || '', scenarios: injected }
    })()
  : await agent(
      `Read two files and return structured data — do not summarize, return content verbatim where asked.\n` +
      `1. skills/${skillId}/SKILL.md — return its full text as "skillBody".\n` +
      `2. skills/${skillId}/evals/cases.yaml — under the "capability:" key is a list. For each entry return ` +
      `{scenario: <the "scenario" string verbatim>, mustInclude: [<each string under that entry's "must_include">]}.\n` +
      `Return {skillId: "${skillId}", skillBody, scenarios}. If either file is missing, return skillBody "" and scenarios [].`,
      { label: `load:${skillId}`, phase: 'Load', schema: LOAD_SCHEMA, agentType: 'Explore' },
    )

if (!loaded || !Array.isArray(loaded.scenarios) || loaded.scenarios.length === 0) {
  return { skillId, scenarios: [], error: 'no-capability-scenarios' }
}

// A distinct write zone per (scenario, arm). Under .rsc/, which is already gitignored, so an eval
// write can neither dirty the tracked tree nor show up later as an abandoned diff.
const sandbox = (index, arm) => `.rsc/eval-sandbox/${skillId}/${arm}-${index}/`

phase('Execute & Grade')
const results = await pipeline(
  loaded.scenarios,
  // Stage 1: baseline (no skill) + treatment (skill injected), concurrently.
  (sc, _orig, index) => parallel([
    () => agent(
      `Complete this task fully and concretely. Produce the ACTUAL deliverable the task asks for, ` +
      `not a description of how you would do it.\n\n` +
      // The baseline IS the control. Reading the skill destroys the only thing this arm is for, so
      // the prohibition carries its reason — a rule without one gets rationalised away first. This
      // is guidance, not a barrier: the barrier is the post-hoc check in scripts/lib/eval-integrity.js,
      // which BLOCKS the run if this arm touched the skill or its rubric.
      `CONSTRAINTS — you are the control arm of a measurement:\n` +
      `- Do NOT read anything under skills/ . You are the "without the skill" arm; if you read the ` +
      `skill under test there is no control and the measurement is void.\n` +
      `- Do NOT read any evals/cases.yaml — that is the rubric you are being graded against.\n` +
      `- The repository is READ-ONLY. Never write to 02-DOCS/ or to any tracked file.\n` +
      `- Write every file you produce under ${sandbox(index, 'baseline')} .\n\n` +
      `TASK:\n${sc.scenario}`,
      { label: `baseline:${index}`, phase: 'Execute & Grade' },
    ),
    () => agent(
      `You have a skill loaded — follow it. Its reference files live under ` +
      `skills/${loaded.skillId}/references/; read them if the skill points you there.\n\n` +
      `=== SKILL: ${loaded.skillId} ===\n${loaded.skillBody}\n=== END SKILL ===\n\n` +
      `Complete this task fully and concretely. Produce the ACTUAL deliverable, not a description.\n\n` +
      // Both arms once wrote the same path (02-DOCS/wiki/sdd/specs/magic-link-login.md) and one
      // clobbered the other mid-run, so the grader scored a file that no longer existed. A distinct
      // sandbox per arm makes that collision impossible by construction rather than by luck.
      `CONSTRAINTS:\n` +
      `- The repository is READ-ONLY. Never write to 02-DOCS/ or to any tracked file: this is a ` +
      `measurement, and it must not mutate the project it runs inside.\n` +
      `- Write every file you produce under ${sandbox(index, 'treatment')} .\n\n` +
      `TASK:\n${sc.scenario}`,
      { label: `treatment:${index}`, phase: 'Execute & Grade' },
    ),
  ]).then(([baselineOut, treatmentOut]) => ({ sc, index, baselineOut, treatmentOut })),
  // Stage 2: blind grade. X/Y slot varied by index parity; mapping recorded for the scorer.
  (prev) => {
    if (!prev) return null
    const { sc, index, baselineOut, treatmentOut } = prev
    const xIsTreatment = index % 2 === 0
    const outX = (xIsTreatment ? treatmentOut : baselineOut) || '(empty)'
    const outY = (xIsTreatment ? baselineOut : treatmentOut) || '(empty)'
    const checklist = sc.mustInclude.map((m, i) => `  ${i + 1}. ${m}`).join('\n')
    return agent(
      `You are an adversarial, independent grader. Two AI outputs answer the same task. You do NOT ` +
      `know which (if any) used a helper skill — judge only what is on the page.\n\n` +
      `TASK:\n${sc.scenario}\n\n` +
      `REQUIRED ELEMENTS (must_include):\n${checklist}\n\n` +
      `For EACH output and EACH required element, set satisfied true/false and quote the exact line ` +
      `that satisfies it (empty string if unmet). Be skeptical: if unsure, mark unmet. Then rate four ` +
      `quality axes 0-10: completeness, actionability, correctness, grounding (no invented facts).\n\n` +
      `=== OUTPUT X ===\n${outX}\n=== OUTPUT Y ===\n${outY}\n`,
      { label: `grade:${index}`, phase: 'Execute & Grade', schema: GRADE_SCHEMA },
    )
      .then((g) => ({ index, xIsTreatment, gradeX: g.gradeX, gradeY: g.gradeY }))
      .catch(() => ({ index, xIsTreatment, error: 'grade-failed' }))
  },
)

return { skillId: loaded.skillId, scenarios: results.filter(Boolean) }
