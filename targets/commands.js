import { existsSync, mkdirSync, writeFileSync, rmSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { agentByName, allAgentNames } from './agents.js';

const COMMAND_TARGETS = Object.freeze({
  claude: { dir: '.claude/commands', ext: '.md', format: 'claude', skillsAreCommands: true },
  cursor: { dir: '.cursor/commands', ext: '.md', format: 'plain' },
  gemini: { dir: '.gemini/commands', ext: '.toml', format: 'gemini' },
  opencode: { dir: '.opencode/commands', ext: '.md', format: 'opencode' },
  copilot: { dir: '.github/prompts', ext: '.prompt.md', format: 'copilot' },
  windsurf: { dir: '.windsurf/workflows', ext: '.md', format: 'windsurf' },
  cline: { dir: '.clinerules/workflows', ext: '.md', format: 'plain', invocationSuffix: '.md' },
  roo: { dir: '.roo/commands', ext: '.md', format: 'roo' },
});

export const COMMAND_TARGET_IDS = Object.freeze(Object.keys(COMMAND_TARGETS));
export const targetHasCommands = (target) => Boolean(COMMAND_TARGETS[target]);

const delegate = (kind, backing) => `Delegate this request to the ${backing} ${kind}. Pass the invocation arguments unchanged: {{ARGS}}\nDo not reproduce that ${kind}'s method here; load it and follow its own stopping and verification rules.`;

const skillCommand = (name, backing = name) => ({
  name,
  kind: 'skill',
  backing,
  description: `Run the ${backing} skill through a short, non-duplicating entry point.`,
  body: delegate('skill', backing),
});

const FIXED_COMMANDS = Object.freeze([
  ...['specify', 'clarify', 'plan', 'tasks', 'analyze', 'implement', 'verify', 'review', 'ship', 'debug'].map((name) => skillCommand(name)),
  {
    name: 'build-fix', kind: 'resolver-selector', backing: 'build-resolver',
    description: 'Route a build failure to the installed stack resolver without guessing.',
    body: `Use an installed build-resolver for this failure: {{ARGS}}\nChoose from diagnostic text and affected paths. If more than one remains plausible, list the candidates and ask the user; never dispatch at random.`,
  },
  skillCommand('refactor-clean', 'simplify-code'),
  {
    name: 'test-coverage', kind: 'testing-skill', backing: 'testing-*',
    description: 'Delegate coverage work to the installed stack testing skill.',
    body: delegate('skill', 'testing-*'),
  },
  skillCommand('update-docs', 'knowledge-ops'),
  {
    name: 'checkpoint', kind: 'capability', backing: 'sello',
    description: 'Freeze the current candidate for review and seal it only after the required lenses approve.',
    body: `Use the sello backing for this checkpoint: {{ARGS}}\nRun \`npx @ericrisco/rsc sello freeze\`, complete the required review, then run \`sello approve\` only with the observed lenses. Do not treat freeze as approval.`,
  },
  skillCommand('harness-audit', 'harness'),
  skillCommand('security-scan', 'security-scan'),
  {
    name: 'learn', kind: 'memory', backing: 'memory:learn',
    description: 'Propose one local lesson; saving still requires individual explicit approval.',
    body: `Invoke memory:learn for exactly one proposed lesson: {{ARGS}}\nAfter individual explicit approval, run \`npx @ericrisco/rsc memory learn\` with its text, evidence, scope, confidence and \`--approve\`. Without that approval, write nothing.`,
  },
  {
    name: 'save-session', kind: 'memory', backing: 'memory:save',
    description: 'Force a local deterministic session checkpoint.',
    body: `Invoke memory:save with the current local session identifiers: {{ARGS}}\nRun \`npx @ericrisco/rsc memory save --session <id>\`. Persist only allowed git and SDD ledger metadata; never include conversation or file content.`,
  },
  {
    name: 'resume-session', kind: 'memory', backing: 'memory:resume',
    description: 'Read the bounded local continuation record for this branch and worktree.',
    body: `Invoke memory:resume for the current branch and worktree: {{ARGS}}\nRun \`npx @ericrisco/rsc memory resume\`. Label a nearby branch result as nearby; never merge it silently into the exact continuation.`,
  },
]);

export const fixedCommands = () => FIXED_COMMANDS.map((command) => ({ ...command }));
export const fixedCommandNames = () => FIXED_COMMANDS.map((command) => command.name);

function withBacking(command, backing, body) {
  return { ...command, backing, body: body || command.body.replace(command.backing, backing) };
}

function fixedFor({ target, skills, agents, memoryMode }) {
  const spec = COMMAND_TARGETS[target];
  if (!spec) return [];
  const skillSet = new Set(skills);
  const resolverIds = agents.filter((id) => agentByName(id)?.role === 'build-resolver');
  const testing = skills.filter((id) => id.startsWith('testing-')).sort();
  const out = [];
  for (const command of FIXED_COMMANDS) {
    if (command.kind === 'skill') {
      if (!skillSet.has(command.backing) || spec.skillsAreCommands) continue;
      out.push({ ...command });
    } else if (command.kind === 'testing-skill') {
      if (!testing.length || spec.skillsAreCommands) continue;
      out.push(withBacking(command, testing[0]));
    } else if (command.kind === 'resolver-selector') {
      if (!resolverIds.length) continue;
      const backing = resolverIds.length === 1 ? resolverIds[0] : 'build-resolver';
      const candidates = resolverIds.join(', ');
      out.push(withBacking(command, backing,
        `Choose the matching installed build-resolver from: ${candidates}. Pass the failure and invocation arguments unchanged: {{ARGS}}\nUse diagnostics and affected paths. If the choice is ambiguous, list candidates and ask; never dispatch at random.`));
    } else if (command.kind === 'memory') {
      if (!['full', 'assisted'].includes(memoryMode)) continue;
      out.push({ ...command });
    } else {
      out.push({ ...command });
    }
  }
  return out;
}

function stackAliases({ skills, agents }) {
  const skillSet = new Set(skills);
  const out = [];
  for (const id of agents) {
    const agent = agentByName(id);
    if (!agent || !['reviewer', 'build-resolver'].includes(agent.role) || !agent.skills?.length) continue;
    const installedAliases = agent.skills.filter((skill) => skillSet.has(skill));
    const aliases = installedAliases.length ? installedAliases : [agent.skills[0]];
    const suffix = agent.role === 'reviewer' ? 'review' : 'build';
    for (const skill of aliases) {
      out.push({
        name: `${skill}-${suffix}`,
        kind: 'agent',
        backing: id,
        description: `Delegate ${skill} ${suffix} work to the installed ${id} agent.`,
        body: delegate('agent', id),
      });
    }
  }
  return out;
}

export function resolveCommands({ target, skills = [], agents = [], memoryMode = 'unsupported' }) {
  if (!targetHasCommands(target)) return [];
  const byName = new Map();
  for (const command of [...fixedFor({ target, skills, agents, memoryMode }), ...stackAliases({ skills, agents })]) {
    byName.set(command.name, command);
  }
  return [...byName.values()].sort((a, b) => a.name.localeCompare(b.name));
}

export function validateCommandCatalog(definitions = FIXED_COMMANDS) {
  const errors = [];
  const seen = new Set();
  for (const command of definitions) {
    const prefix = command?.name || '<unnamed>';
    if (!command?.name || seen.has(command.name)) errors.push(`${prefix}: unique name required`);
    seen.add(command?.name);
    if (!command?.backing || !command?.body?.includes(command.backing)) errors.push(`${prefix}: body must name its exact backing`);
    if ((command?.body || '').split('\n').length > 40) errors.push(`${prefix}: body exceeds 40 lines`);
    if (/everything[- ]claude|affaan|worldflow/iu.test(`${command?.description || ''}\n${command?.body || ''}`)) errors.push(`${prefix}: foreign project vocabulary`);
  }
  return errors;
}

export function commandPath(target, cwd, name) {
  const spec = COMMAND_TARGETS[target];
  return spec ? join(cwd, ...spec.dir.split('/'), `${name}${spec.ext}`) : null;
}

function renderArgs(target, body) {
  const placeholder = target === 'claude' || target === 'opencode' ? '$ARGUMENTS'
    : target === 'gemini' ? '{{args}}'
      : 'any text following the slash command';
  return body.replaceAll('{{ARGS}}', placeholder);
}

function markdown(command, target) {
  const body = renderArgs(target, command.body);
  if (target === 'cursor' || target === 'cline') return `# /${command.name}\n\n${command.description}\n\n${body}\n`;
  if (target === 'windsurf') return `# /${command.name}\n\n${command.description}\n\n1. ${body.replaceAll('\n', '\n2. ')}\n`;
  const fm = ['---', `description: "${command.description.replaceAll('"', '\\"')}"`, 'argument-hint: "[arguments]"'];
  if (target === 'copilot') fm.push('mode: agent');
  if (target === 'opencode' && command.kind === 'agent') fm.push(`agent: ${command.backing}`);
  fm.push('---', '');
  return `${fm.join('\n')}${body}\n`;
}

function render(command, target) {
  if (target !== 'gemini') return markdown(command, target);
  const body = renderArgs(target, command.body);
  return `description = ${JSON.stringify(command.description)}\nprompt = ${JSON.stringify(body)}\n`;
}

export function reconcileCommands(target, cwd, previousNames = [], desiredCommands = []) {
  if (!targetHasCommands(target)) return { written: [], removed: [], collisions: [], names: [] };
  const previous = new Set(previousNames);
  const desiredNames = new Set(desiredCommands.map((command) => command.name));
  const removed = [];
  for (const name of previous) {
    if (desiredNames.has(name)) continue;
    const path = commandPath(target, cwd, name);
    if (path && existsSync(path)) { rmSync(path, { force: true }); removed.push(path); }
  }
  const written = [];
  const collisions = [];
  const names = [];
  for (const command of desiredCommands) {
    const path = commandPath(target, cwd, command.name);
    if (existsSync(path) && !previous.has(command.name)) {
      collisions.push(path);
      continue;
    }
    mkdirSync(dirname(path), { recursive: true });
    writeFileSync(path, render(command, target));
    written.push(path);
    names.push(command.name);
  }
  return { written, removed, collisions, names };
}

export function allPotentialCommandNames() {
  const names = new Set(fixedCommandNames());
  // Every stack alias follows directly from catalog metadata; no second mapping.
  const agents = allAgentNames();
  const skills = [...new Set(agents.flatMap((id) => agentByName(id)?.skills || []))];
  for (const command of stackAliases({ skills, agents })) names.add(command.name);
  return [...names];
}
