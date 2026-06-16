// rsc developer agent — installed with the harness for every target that supports
// file-based subagents with a per-agent model. The agent runs at the `balanced` tier
// (never `light`/Haiku): Sonnet for Anthropic-backed tools, the provider's mid model
// elsewhere. The chosen tier (balanced default, or heavy) lives in `.rsc/developer.json`,
// written by `init` at onboarding and read here so re-syncs honor it.
import { readFileSync, writeFileSync, mkdirSync, rmSync, existsSync } from 'node:fs';
import { join, dirname } from 'node:path';

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

const NAME = 'developer';
const DESC = 'Implementation worker: turns an approved spec+plan into working, tested code under strict TDD (red->green->refactor), one task at a time. The rsc SDD fan-out/implementation hand.';
const BODY = `You are the **developer** subagent for this project — the hands of the rsc SDD chain. You execute a planned, approved task into working, tested code. You do NOT design features.

- Work **test-first**: smallest failing test (RED), least code to pass it (GREEN), then refactor on green. A test that never failed proves nothing.
- One task at a time; keep the diff to that task's scope — no "while I'm here".
- Follow the project's spec, plan and constitution under \`02-DOCS/wiki/sdd/\`, and borrow test mechanics from the stack skill (fastapi/go/nextjs/flutter/...).
- If there is no approved spec + plan for non-trivial feature work, STOP and route to \`specify\` — do not write feature code.
- Log non-obvious decisions to \`02-DOCS/wiki/sdd/decisions.md\`. Report your diff + test output at the end.

Full discipline lives in the \`implement\` skill.`;

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

function renderMd(spec, model) {
  const fm = ['---', `name: ${NAME}`, `description: "${DESC}"`, `model: ${model}`];
  if (spec.mode) fm.push(`mode: ${spec.mode}`);
  fm.push('---', '');
  return `${fm.join('\n')}${BODY}\n`;
}
const renderJson = (model) => `${JSON.stringify({ name: NAME, description: DESC, model, prompt: BODY }, null, 2)}\n`;
function renderToml(model) {
  const esc = (s) => s.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  // body as a TOML multiline LITERAL string ('''…''') — no escape processing.
  return `name = "${NAME}"\ndescription = "${esc(DESC)}"\nmodel = "${model}"\ndeveloper_instructions = '''\n${BODY}\n'''\n`;
}

export function developerAgentPath(target, cwd) {
  const spec = AGENT_TARGETS[target];
  return spec ? join(cwd, ...spec.dir.split('/'), `${NAME}${spec.ext}`) : null;
}

export function writeDeveloperAgent(target, cwd, tier = readDeveloperTier(cwd)) {
  const spec = AGENT_TARGETS[target];
  if (!spec) return [];
  const model = spec.model(tier);
  const content = spec.format === 'json' ? renderJson(model)
    : spec.format === 'toml' ? renderToml(model)
      : renderMd(spec, model);
  const path = developerAgentPath(target, cwd);
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, content);
  return [path];
}

export function removeDeveloperAgent(target, cwd) {
  const path = developerAgentPath(target, cwd);
  if (path && existsSync(path)) { rmSync(path, { force: true }); return [path]; }
  return [];
}
