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
import { join, dirname, relative, sep } from 'node:path';
import { createHash } from 'node:crypto';
import { readManifest } from '../scripts/lib/manifest-file.js';
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
  // #298 — OpenCode is the one tool people point at a local model or another provider per session, so
  // its agents INHERIT the session model by default (`model: null` → no `model:` line) and only carry
  // one when the project pins it (`agentModels.opencode` in .rsc.json). And its `tools` map is
  // restrict-only: rsc never grants a tool there, it can only take away what a role never declared,
  // so a stricter project permission policy is never loosened by an rsc agent.
  opencode: { dir: '.opencode/agents', ext: '.md', format: 'md', mode: 'subagent', toolsFormat: 'restrict', model: () => null, legacyModel: (t) => `anthropic/${TIER_MODEL.anthropic[t]}` },
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

If an answer is no, lower the severity or omit the finding. Every **blocker or should-fix** needs the line and failure mode in the report. **Zero findings with an attack list is valid.**

**Report findings in one shape, so the panel can be consolidated** — a fenced ${'`json findings`'} block holding an array (empty when you found nothing):

${'```'}json findings
[{ "lens": "<your lens>", "severity": "blocker|should-fix|nit|question", "file": "path/from/repo/root", "line": 42, "claim": "one sentence: what is wrong", "failure_scenario": "concrete input + state -> wrong result", "evidence": "the exact changed line, quoted" }]
${'```'}

${'`rsc review consolidate`'} merges what several lenses reported about the same place and sends each unique blocker or should-fix to ${'`finding-verifier`'}, whose job is to prove it false. A blocker or should-fix with no ${'`file`'}, ${'`line`'} or ${'`failure_scenario`'} is downgraded to a question there, mechanically.

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
  // The second half of ECC's orch-review, adapted: after `rsc review consolidate` collapses the panel's
  // duplicates, every unique blocker/should-fix gets ONE more fresh context whose default is that the
  // finding is false. A refuter attacks the diff; the verifier attacks the finding. Same asymmetry,
  // pointed the other way — which is what stops an exaggerated lens from reaching the author as a blocker.
  {
    name: 'finding-verifier',
    desc: 'Adversarial verifier of review findings: takes ONE consolidated finding and tries to prove it false against the code. Default stance: the finding is false; only a reproduced or traced failure is CONFIRMED. Fresh context, edits nothing.',
    body: `You are the **finding verifier** for this project. ${'`review`'} hands you **one** finding that survived ${'`rsc review consolidate`'} — a blocker or should-fix some refuter lens reported against a diff. Your job is to **prove it false**. Your starting position is that it is false; the finding has to beat you.

**Your inputs:** the finding (location, claim, failure scenario, evidence) plus the same four the lenses had —

${REFUTER_FOUR_INPUTS}

**You do NOT get** the refuter's reasoning or the builder's defence. Judge the claim against the code, not against either story.

**How to try to kill it:**
1. Read the cited line **and** its callers, guards and tests — the check that makes it impossible often lives two functions up, or in a caller that never passes that input.
2. Try the failure scenario for real when you can: run the test, execute the command, or write a throwaway check in a temp directory outside the repo. An observed failure outranks any argument.
3. Ask whether the change **caused** it. A defect that was already there is real but does not block this delivery.

**Verdict — exactly one, with its proof:**
- **CONFIRMED** — you reproduced it, or traced a reachable path from a concrete input to the wrong result. Quote the output or the path. Only this verdict may block.
- **REFUTED** — you found what makes it impossible (the guard, the caller, the type, the test). Cite it with file and line.
- **UNPROVEN** — neither: it becomes a question for the human, and questions never block.

Also state whether the severity holds. A CONFIRMED finding whose blast radius is narrow is a should-fix, not a blocker — say so. You fix nothing and edit no file: your output is the verdict, the proof, and the commands you ran.`,
  },
];


export const BASE_AGENT_NAMES = Object.freeze(AGENTS.map((agent) => agent.name));
export { stackAgents, stackAgentNames, validateAgentCatalog };
export const allAgentNames = () => [...BASE_AGENT_NAMES, ...stackAgentNames()];
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

// OpenCode V1 tool names a declared capability maps to. `read`/`search` need nothing: what the agent
// may read is the project's policy to decide, and saying `read: true` would be a grant.
const RESTRICT_TOOLS = { edit: ['edit', 'write', 'patch'], shell: ['bash'] };
function restrictedTools(tools) {
  if (!tools) return [];
  return Object.entries(RESTRICT_TOOLS).filter(([cap]) => !tools.includes(cap)).flatMap(([, names]) => names);
}

function renderMd(spec, model, agent, toolsFormat = spec.toolsFormat) {
  const fm = ['---', `name: ${agent.name}`, `description: "${agent.desc}"`];
  if (model) fm.push(`model: ${model}`);
  if (spec.mode) fm.push(`mode: ${spec.mode}`);
  if (agent.tools) {
    if (toolsFormat === 'restrict') {
      const denied = restrictedTools(agent.tools);
      if (denied.length) {
        fm.push('tools:');
        for (const tool of denied) fm.push(`  ${tool}: false`);
      }
    } else if (toolsFormat === 'map') {
      fm.push('tools:');
      for (const tool of agent.tools) fm.push(`  ${tool}: true`);
    } else {
      fm.push(`tools: [${agent.tools.join(', ')}]`);
    }
  }
  fm.push('---', '');
  return `${fm.join('\n')}${agent.body}\n`;
}
const renderJson = (model, agent) => `${JSON.stringify({ name: agent.name, description: agent.desc, ...(model ? { model } : {}), ...(agent.tools ? { tools: agent.tools } : {}), prompt: agent.body }, null, 2)}\n`;
function renderToml(model, agent) {
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  // body as a TOML multiline LITERAL string ('''…''') — no escape processing.
  const tools = agent.tools ? `tools = [${agent.tools.map((tool) => `"${tool}"`).join(', ')}]\n` : '';
  return `name = "${agent.name}"\ndescription = "${esc(agent.desc)}"\n${model ? `model = "${model}"\n` : ''}${tools}developer_instructions = '''\n${agent.body}\n'''\n`;
}

// ── #298: the model, decided by the project. `agentModels` in .rsc.json maps a target to a model id
// or to `inherit`. Absent → the target's default (inherit on OpenCode, the tier model elsewhere). The
// value lands verbatim in YAML/TOML/JSON from a COMMITTED file, so anything outside a plain model-id
// alphabet is ignored rather than written: a pulled .rsc.json must not be able to inject frontmatter.
export const AGENT_MODEL_INHERIT = 'inherit';
export const isValidAgentModel = (value) => typeof value === 'string' && /^[A-Za-z0-9][A-Za-z0-9._:/@+-]{0,127}$/.test(value);
export function agentModelSetting(cwd, target) {
  let value;
  try { value = readManifest(cwd)?.agentModels?.[target]; } catch { value = undefined; }
  return isValidAgentModel(value) ? value : null;
}
export const targetInheritsByDefault = (target) => AGENT_TARGETS[target]?.model('balanced') === null;
function resolveModel(target, cwd, tier) {
  const setting = agentModelSetting(cwd, target);
  if (setting === AGENT_MODEL_INHERIT) return null;
  if (setting) return setting;
  return AGENT_TARGETS[target].model(tier);
}

export const effectiveAgentModel = (target, cwd, tier = readDeveloperTier(cwd)) => (AGENT_TARGETS[target] ? resolveModel(target, cwd, tier) : null);

function renderAgent(target, spec, model, agent, toolsFormat) {
  return spec.format === 'json' ? renderJson(model, agent)
    : spec.format === 'toml' ? renderToml(model, agent)
      : renderMd(spec, model, agent, toolsFormat);
}

// ── #298: what rsc wrote, per file, so a user edit is told apart from rsc's own file. Machine-local
// (.rsc/ is gitignored): a digest says "this machine's rsc wrote these bytes", which is not a team fact.
const sha = (text) => createHash('sha256').update(text).digest('hex');
const digestFile = (cwd) => join(cwd, '.rsc', 'agent-digests.json');
const relKey = (cwd, path) => relative(cwd, path).split(sep).join('/');
function readDigests(cwd) {
  try { const d = JSON.parse(readFileSync(digestFile(cwd), 'utf8')); return d && typeof d === 'object' ? d : {}; } catch { return {}; }
}
function writeDigests(cwd, digests) {
  mkdirSync(dirname(digestFile(cwd)), { recursive: true });
  const ordered = Object.fromEntries(Object.keys(digests).sort().map((k) => [k, digests[k]]));
  writeFileSync(digestFile(cwd), `${JSON.stringify(ordered, null, 2)}\n`);
}

// Every rendering rsc could have produced for this agent on this target: either tier, the current
// model setting, and — for OpenCode — the pre-#298 shape (pinned Anthropic model, `tool: true` map).
// A file with no digest that matches one of these is rsc's and may be replaced; anything else is the
// user's. Bodies from older releases are not reconstructed: such a file is kept and reported, the safe
// direction, and `rsc agents reset` is one command away.
function knownRenderings(target, cwd, agent) {
  const spec = AGENT_TARGETS[target];
  const out = new Set();
  for (const tier of ['balanced', 'heavy']) {
    out.add(renderAgent(target, spec, resolveModel(target, cwd, tier), agent));
    out.add(renderAgent(target, spec, spec.model(tier), agent));
    if (spec.legacyModel) out.add(renderAgent(target, spec, spec.legacyModel(tier), agent, 'map'));
  }
  return out;
}

// 'rsc' when the file on disk is rsc's to overwrite or remove, 'user' when it carries the user's edit.
function ownership(target, cwd, agent, path, digests) {
  if (!existsSync(path)) return 'absent';
  const current = readFileSync(path, 'utf8');
  const key = relKey(cwd, path);
  if (digests[key]) return digests[key] === sha(current) ? 'rsc' : 'user';
  return knownRenderings(target, cwd, agent).has(current) ? 'rsc' : 'user';
}

const keptNotice = (name, path, cwd) => ({
  name,
  path,
  message: `kept your edited agent ${name} (${relKey(cwd, path)}; rsc's version differs; \`rsc agents reset ${name}\` to take it)`,
});

export function agentPath(target, cwd, name = 'developer') {
  const spec = AGENT_TARGETS[target];
  return spec ? join(cwd, ...spec.dir.split('/'), `${name}${spec.ext}`) : null;
}

/**
 * Write the agents, keeping any the user edited. Returns { written, kept }: `kept` names each agent
 * left as the user has it, with the message to show. `force` takes rsc's version regardless — only
 * `rsc agents reset` passes it, after backing the user's file up.
 */
export function writeAgentsDetailed(target, cwd, tier = readDeveloperTier(cwd), names = agentNames(), { force = false } = {}) {
  const spec = AGENT_TARGETS[target];
  if (!spec) return { written: [], kept: [] };
  const digests = readDigests(cwd);
  const written = [];
  const kept = [];
  for (const name of names) {
    const agent = byName(name);
    if (!agent) continue;
    const effectiveTier = agent.tier === 'heavy' ? 'heavy' : tier;
    const content = renderAgent(target, spec, resolveModel(target, cwd, effectiveTier), agent);
    const path = agentPath(target, cwd, agent.name);
    if (!force && ownership(target, cwd, agent, path, digests) === 'user') {
      // Unless it already IS what rsc would write — then there is nothing to protect, only to record.
      if (readFileSync(path, 'utf8') !== content) { kept.push(keptNotice(agent.name, path, cwd)); continue; }
    }
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, content);
    digests[relKey(cwd, path)] = sha(content);
    written.push(path);
  }
  writeDigests(cwd, digests);
  return { written, kept };
}

export function writeAgents(target, cwd, tier = readDeveloperTier(cwd), names = agentNames(), options) {
  return writeAgentsDetailed(target, cwd, tier, names, options).written;
}

export function reconcileAgents(target, cwd, tier, previousNames = [], desiredNames = []) {
  if (!targetHasAgents(target)) return { written: [], removed: [], collisions: [], names: [], kept: [] };
  const previous = new Set(previousNames);
  const desired = new Set(desiredNames);
  const kept = [];
  // An agent no longer wanted is removed only while it is still rsc's file. One the user edited is
  // theirs now: deleting it on an uninstall or a stack change is the same loss sync must not cause.
  const digests = readDigests(cwd);
  const stale = [];
  for (const name of [...previous].filter((n) => !desired.has(n))) {
    const agent = byName(name);
    const path = agentPath(target, cwd, name);
    if (agent && ownership(target, cwd, agent, path, digests) === 'user') {
      kept.push({ name, path, message: `kept your edited agent ${name} (${relKey(cwd, path)}); rsc no longer installs it, delete it yourself if you do not want it` });
    } else stale.push(name);
  }
  const removed = removeAgents(target, cwd, stale);
  if (removed.length) {
    for (const path of removed) delete digests[relKey(cwd, path)];
    writeDigests(cwd, digests);
  }
  const written = [];
  const collisions = [];
  const names = [];
  for (const name of desiredNames) {
    const path = agentPath(target, cwd, name);
    if (existsSync(path) && !previous.has(name)) {
      collisions.push(path);
      continue;
    }
    const result = writeAgentsDetailed(target, cwd, tier, [name]);
    written.push(...result.written);
    kept.push(...result.kept);
    if (existsSync(path)) names.push(name);
  }
  return { written, removed, collisions, names, kept };
}

/**
 * Remove only the agents this catalog ships. An uninstaller that takes an agent the user wrote by hand
 * is worse than one that leaves residue.
 */
export function removeAgents(target, cwd, names = allAgentNames()) {
  const removed = [];
  for (const name of names) {
    const path = agentPath(target, cwd, name);
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
