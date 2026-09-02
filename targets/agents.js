// rsc agent registry — the agents installed with the harness for every target that supports
// file-based subagents with a per-agent model.
//
// This file shipped ONE agent with its name, description and body as module constants. Adding a
// second was therefore not "copy a block": it was turning the file into a registry without breaking
// the `developer` installs already deployed to users. The registry is the work; the refuters are its
// first client. See 02-DOCS/wiki/sdd/specs/refuter-agent.md. The agent runs at the `balanced` tier
// (never `light`/Haiku): Sonnet for Anthropic-backed tools, the provider's mid model
// elsewhere. The chosen tier (balanced default, or heavy) lives in `.rsc/developer.json`,
// written by `init` at onboarding and read here so re-syncs honor it.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';
import {
  stackAgents, stackAgentNames, stackAgentByName,
  resolveStackAgentNames, validateAgentCatalog,
} from './agent-catalog.js';

// Concrete model per provider per tier. June 2026 defaults — EDIT to your account's
// models; the TIER is the contract, the id is yours to change. `light` is deliberately
// absent: the developer floor is `balanced`.
const TIER_MODEL = {
  anthropic: { balanced: 'claude-sonnet-4-6', heavy: 'claude-opus-4-8' },
  google: { balanced: 'gemini-2.5-flash', heavy: 'gemini-2.5-pro' },
  openai: { balanced: 'gpt-5.1-mini', heavy: 'gpt-5.1' },
};

// Per-target agent capability: where the file goes, its format, and how the model value
// is written for that tool. Targets absent here have no installable file-based agents
// (Amp/Zed/Windsurf/Cline/Roo/Continue/Aider/Jules/Antigravity) — there the developer
// model is advisory (model-routing), not a file.
const AGENT_TARGETS = {
  claude: { dir: '.claude/agents', ext: '.md', format: 'md', model: (t) => (t === 'heavy' ? 'opus' : 'sonnet') },
  junie: { dir: '.junie/agents', ext: '.md', format: 'md', model: (t) => (t === 'heavy' ? 'opus' : 'sonnet') },
  cursor: { dir: '.cursor/agents', ext: '.md', format: 'md', model: (t) => TIER_MODEL.anthropic[t] },
  opencode: { dir: '.opencode/agents', ext: '.md', format: 'md', mode: 'subagent', model: (t) => `anthropic/${TIER_MODEL.anthropic[t]}` },
  gemini: { dir: '.gemini/agents', ext: '.md', format: 'md', model: (t) => TIER_MODEL.google[t] },
  copilot: { dir: '.github/agents', ext: '.agent.md', format: 'md', model: (t) => TIER_MODEL.anthropic[t] },
  kiro: { dir: '.kiro/agents', ext: '.json', format: 'json', model: (t) => (t === 'heavy' ? 'claude-opus-4' : 'claude-sonnet-4') },
  codex: { dir: '.codex/agents', ext: '.toml', format: 'toml', model: (t) => TIER_MODEL.openai[t] },
};

export const AGENT_TARGET_IDS = Object.keys(AGENT_TARGETS);
export function targetHasAgents(target) { return Boolean(AGENT_TARGETS[target]); }

// The contract every refuter shares, in ONE place. Three lens files each carry the lens inside them
// (decided in clarify 2026-08-18: a lens passed as a parameter reintroduces the
// does-anyone-remember dependency this whole spec exists to remove) — but P5 says length is a cost,
// so the contract they share is composed, not written three times.
export const REFUTER_FOUR_INPUTS = `**You get exactly four inputs, and nothing else:**
1. The task contract — the original request **plus every scope change a human explicitly approved since**. Without the approved changes, a legitimate scope revision reads as a spec gap and you will report a confident false positive.
2. The approved spec.
3. The exact source state (commit SHA, or a tree hash when git is absent). A verdict attaches to the state you saw, not to the project.
4. The entry point — the one command that reruns the checks.`;

const REFUTER_CONTRACT = `Your mandate is to **refute readiness**, not confirm it. A reviewer looking for confirmation finds confirmation; the asymmetry is the point.

${REFUTER_FOUR_INPUTS}

**You do NOT get** the builder's conversation, reasoning, defences, or draft verdict. If a claim needs the builder's justification to stand, it is not proven.

**Blind first, compare second.** Record what you attacked and what you found BEFORE you are shown the builder's conclusions. Only then may you compare and add findings; the blind record is append-only after that, never rewritten. Skip this and your fresh context is spent confirming their framing, which is the one thing it was bought to avoid.

**The attack list is the deliverable, not just the findings.** "Nothing found" without saying where you looked is indistinguishable from not having looked.

**Before reporting any finding, answer all four questions:**
1. Can you cite the **exact changed line**?
2. Can you state the **concrete input, state, and wrong result**? The concrete input and state must be explicit.
3. Did you inspect the relevant **caller, import, and relevant test**?
4. Can the severity survive the **existing guards** you verified?

If an answer is no, lower the severity or omit the finding. Every **HIGH or CRITICAL** needs the line and failure mode in the report. **Zero findings with an attack list is valid.**

**Common false positives to reject:** an equivalent mutant with no diverging input; a documented dummy value that never reaches a sink; a deliberate boundary already enforced by a caller; generated/vendor code outside the change; style preference presented as correctness; and a theoretical race with no shared state or overlapping lifetime.

**A finding blocks only if it is caused by this change, is severe, and carries evidence** — a repro or a concrete failure scenario. A suspicion without one is a question, and questions do not block. You fix nothing: findings return through the normal loop, and a SPEC gap goes to the human, never to the builder to self-amend.`;

const AGENTS = [
  {
    name: 'developer',
    desc: 'Implementation worker: turns an approved spec+plan into working, tested code under strict TDD (red->green->refactor), one task at a time. The rsc SDD fan-out/implementation hand.',
    body: `You are the **developer** subagent for this project — the hands of the rsc SDD chain. You execute a planned, approved task into working, tested code. You do NOT design features.

- Work **test-first**: smallest failing test (RED), least code to pass it (GREEN), then refactor on green. A test that never failed proves nothing.
- One task at a time; keep the diff to that task's scope — no "while I'm here".
- Follow the project's spec, plan and constitution under \`02-DOCS/wiki/sdd/\`, and borrow test mechanics from the stack skill (fastapi/go/nextjs/flutter/...).
- If there is no approved spec + plan for non-trivial feature work, STOP and route to \`specify\` — do not write feature code.
- Log non-obvious decisions to \`02-DOCS/wiki/sdd/decisions.md\`. Report your diff + test output at the end.

Full discipline lives in the \`implement\` skill.`,
  },
  {
    name: 'refuter-correctness',
    desc: 'Adversarial reviewer, correctness lens: attacks a green diff for boundary and error-path defects, and demands that any home-grown gate prove it can both fail and pass. Fresh context, mandate to refute.',
    body: `You are the **correctness** refuter for this project — one of three adversarial lenses ${'`review`'} dispatches at tier 2. What matters is not the number of lenses but their **diversity**: the worst defect this panel ever found was found by the privacy lens, which was not looking for it.

${REFUTER_CONTRACT}

**Your lens — correctness on the boundaries, not the happy path:** off-by-one, null/empty/zero, error paths swallowed, races, the wrong operator, a value that is correct in one function and unchecked in its twin.

**And the lens this panel was missing:** when the change adds or touches a **gate, checker or guard**, ask it in BOTH directions.
- Can it fail? Feed it a known-bad input and watch it fail. A gate nobody has seen fail is not a gate.
- **Can it pass?** Feed it a known-good input and watch it pass. Over-blocking is not the safe side — a gate that fires on correct work gets muted, worked around, or wedges the pipeline that depends on it, and it is *harder* to notice because it arrives dressed as diligence.
- Watch for a check that matches **text** where it should match **structure**: "the path appears in the string" is not "the write targets that location". That exact mistake shipped twice in one day here.`,
  },
  {
    name: 'refuter-security',
    desc: 'Adversarial reviewer, security and privacy lens: hunts untrusted input reaching a sink, authz gaps, leaked secrets and data escaping where it should not. Fresh context, mandate to refute.',
    body: `You are the **security and privacy** refuter for this project — one of three adversarial lenses ${'`review`'} dispatches at tier 2. Your value is that you are not looking where the others look: the worst defect this panel ever found was found by this lens, chasing something else entirely.

${REFUTER_CONTRACT}

**Your lens:** untrusted input reaching a sink (injection, SSRF, path traversal), authorization gaps (authenticated is not authorized), secrets in the diff or in config, and **data leaving where it should not** — a log line, an error message, a file written outside its zone, a payload sent to a third party.

**Follow the trail rather than the checklist.** When something looks merely untidy — a file in an odd place, a path that repeats — ask who else cares about that location before dismissing it. That is how this lens found the worst one.`,
  },
  {
    name: 'refuter-tests',
    desc: 'Adversarial reviewer, tests-as-evidence lens: tries to make the suite pass wrongly, invents mutants the builder did not choose, and checks the spec-to-test mapping in both directions. Fresh context, mandate to refute.',
    body: `You are the **tests-as-evidence** refuter for this project — one of three adversarial lenses ${'`review`'} dispatches at tier 2.

${REFUTER_CONTRACT}

**Your lens — try to make the suite pass wrongly:** implementation keyed to test inputs, mocks swallowing the logic under test, assertions that cannot fail, coverage that touches lines without asserting anything.

**Invent mutants the builder did not choose.** Their mutant list encodes their blind spots. Watch for tests that pin less than they claim — a boundary pinned in one function and not in its twin, a magnitude left free while its boundary is fixed, an assertion satisfied by a caller that never arrived. **Before reporting a surviving mutant, prove it diverges:** construct a concrete input where mutant and original disagree. A survivor you cannot make disagree is an equivalent mutant, and reporting it sends someone to write a test that asserts non-behaviour.

**Check the mapping both ways:** every acceptance criterion needs a falsification procedure that can be made to fail, and every test should trace to something someone asked for.`,
  },
];

export const BASE_AGENT_NAMES = Object.freeze(AGENTS.map((agent) => agent.name));
export { stackAgents, stackAgentNames, validateAgentCatalog };
export function resolveAgentNames(skillIds = [], explicitAgentIds = []) {
  return [...BASE_AGENT_NAMES, ...resolveStackAgentNames(skillIds, explicitAgentIds)];
}

// Back-compat: the tier file and its reader are named for `developer` because that is what they
// configure. The refuters run at the same tier — a deliberate, reversible default: nobody has measured
// whether a heavier model finds more here, and silently tripling tier-2 cost on an unmeasured hunch is
// the wrong way to find out.
const byName = (name) => AGENTS.find((a) => a.name === name) || stackAgentByName(name);
export const agentNames = () => AGENTS.map((a) => a.name);

// `.rsc/developer.json` — the chosen tier (balanced default; never light). `init` writes
// it on the onboarding answer; the installer reads it so every (re)install/sync matches.
const tierFile = (cwd) => join(cwd, '.rsc', 'developer.json');
export function readDeveloperTier(cwd) {
  try {
    return JSON.parse(readFileSync(tierFile(cwd), 'utf8')).tier === 'heavy' ? 'heavy' : 'balanced';
  } catch { return 'balanced'; }
}
export function writeDeveloperTier(cwd, tier) {
  const t = tier === 'heavy' ? 'heavy' : 'balanced';
  mkdirSync(dirname(tierFile(cwd)), { recursive: true });
  writeFileSync(tierFile(cwd), `${JSON.stringify({ tier: t }, null, 2)}\n`);
  return t;
}

function renderMd(spec, model, agent) {
  const fm = ['---', `name: ${agent.name}`, `description: "${agent.desc}"`, `model: ${model}`];
  if (spec.mode) fm.push(`mode: ${spec.mode}`);
  if (agent.tools) fm.push(`tools: [${agent.tools.join(', ')}]`);
  fm.push('---', '');
  return `${fm.join('\n')}${agent.body}\n`;
}
const renderJson = (model, agent) => `${JSON.stringify({ name: agent.name, description: agent.desc, model, ...(agent.tools ? { tools: agent.tools } : {}), prompt: agent.body }, null, 2)}\n`;
function renderToml(model, agent) {
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  // body as a TOML multiline LITERAL string ('''…''') — no escape processing.
  const tools = agent.tools ? `tools = [${agent.tools.map((tool) => `"${tool}"`).join(', ')}]\n` : '';
  return `name = "${agent.name}"\ndescription = "${esc(agent.desc)}"\nmodel = "${model}"\n${tools}developer_instructions = '''\n${agent.body}\n'''\n`;
}

export function agentPath(target, cwd, name = 'developer') {
  const spec = AGENT_TARGETS[target];
  return spec ? join(cwd, ...spec.dir.split('/'), `${name}${spec.ext}`) : null;
}

export function writeAgents(target, cwd, tier = readDeveloperTier(cwd), names = agentNames()) {
  const spec = AGENT_TARGETS[target];
  if (!spec) return [];
  const written = [];
  for (const name of names) {
    const agent = byName(name);
    if (!agent) continue;
    const effectiveTier = agent.tier === 'heavy' ? 'heavy' : tier;
    const model = spec.model(effectiveTier);
    const content = spec.format === 'json' ? renderJson(model, agent)
      : spec.format === 'toml' ? renderToml(model, agent)
        : renderMd(spec, model, agent);
    const path = agentPath(target, cwd, agent.name);
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    written.push(path);
  }
  return written;
}

/**
 * Remove only the agents this catalog ships. An uninstaller that takes an agent the user wrote by hand
 * is worse than one that leaves residue.
 */
export function removeAgents(target, cwd) {
  const removed = [];
  for (const agent of AGENTS) {
    const path = agentPath(target, cwd, agent.name);
    if (path && existsSync(path)) { rmSync(path, { force: true }); removed.push(path); }
  }
  return removed;
}

// ── back-compat aliases. Kept because `developer` is already installed in user repos and in
// capabilities.js's spec derivation; renaming their imports is not worth breaking a deployed install.
export const developerAgentPath = (target, cwd) => agentPath(target, cwd, 'developer');
export const writeDeveloperAgent = (target, cwd, tier = readDeveloperTier(cwd)) => writeAgents(target, cwd, tier);
export const removeDeveloperAgent = (target, cwd) => removeAgents(target, cwd);
export { byName as agentByName };
