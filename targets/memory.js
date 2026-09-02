import {
  appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync,
} from 'node:fs';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export { handleLifecycle, contextFromNativeOutput } from './session-memory-adapter.mjs';

const HERE = dirname(fileURLToPath(import.meta.url));
const NEEDLE = '.rsc/session-memory-adapter.mjs';

export const MEMORY_TARGETS = Object.freeze({
  claude: 'full',
  codex: 'full',
  // Cursor documents sessionStart as fire-and-forget. Its best-effort hook is useful,
  // but only the always-on rule can make the read-before-action obligation explicit.
  cursor: 'assisted',
  gemini: 'full',
  opencode: 'full',
});

const CONFIG = Object.freeze({
  claude: '.claude/settings.local.json',
  codex: '.codex/hooks.json',
  cursor: '.cursor/hooks.json',
  gemini: '.gemini/settings.json',
  opencode: '.opencode/plugins/rsc-memory.js',
});

export const memoryModeFor = (target) => MEMORY_TARGETS[target] || 'unsupported';

function git(cwd, args) {
  try { return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; }
}

function rel(cwd, path) {
  return relative(cwd, path).split(sep).join('/');
}

function tracked(cwd, path) {
  const output = git(cwd, ['ls-files', '--', rel(cwd, path)]);
  return Boolean(output);
}

function exclude(cwd, path) {
  if (git(cwd, ['rev-parse', '--is-inside-work-tree']) !== 'true') return;
  const value = git(cwd, ['rev-parse', '--git-path', 'info/exclude']);
  if (!value) return;
  const file = isAbsolute(value) ? value : resolve(cwd, value);
  const pattern = `/${rel(cwd, path)}`;
  mkdirSync(dirname(file), { recursive: true });
  const body = existsSync(file) ? readFileSync(file, 'utf8') : '';
  if (!body.split('\n').includes(pattern)) appendFileSync(file, `${body && !body.endsWith('\n') ? '\n' : ''}${pattern}\n`);
}

function readConfig(path) {
  if (!existsSync(path)) return {};
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

function handler(target, event) {
  const unixScript = target === 'claude'
    ? '"${CLAUDE_PROJECT_DIR}/.rsc/session-memory-adapter.mjs"'
    : target === 'codex'
      ? '"$(git rev-parse --show-toplevel)/.rsc/session-memory-adapter.mjs"'
      : '".rsc/session-memory-adapter.mjs"';
  const value = {
    type: 'command',
    command: `node ${unixScript} ${target} ${event}`,
    timeout: target === 'gemini' ? 5000 : event === 'end' && target === 'codex' ? 3 : 5,
  };
  if (target === 'codex') {
    value.commandWindows = `node \"$((git rev-parse --show-toplevel).Trim())/.rsc/session-memory-adapter.mjs\" ${target} ${event}`;
    value.additionalContextLimit = 1400;
  }
  if (target === 'gemini') value.name = `rsc-memory-${event}`;
  return value;
}

const nestedEvents = {
  claude: [
    ['SessionStart', 'start'], ['UserPromptSubmit', 'request'], ['PostToolUse', 'edit', 'Edit|Write|NotebookEdit'],
    ['PostToolUse', 'boundary', 'Bash'], ['Stop', 'turn'], ['PreCompact', 'compact'], ['SessionEnd', 'end'],
  ],
  codex: [
    ['SessionStart', 'start', 'startup|resume|clear|compact'], ['UserPromptSubmit', 'request'],
    ['PostToolUse', 'edit', 'apply_patch|Edit|Write'], ['PostToolUse', 'boundary', 'Bash'],
    ['Stop', 'turn'], ['PreCompact', 'compact'], ['SessionEnd', 'end'],
  ],
  gemini: [
    ['SessionStart', 'start'], ['BeforeAgent', 'request'], ['AfterTool', 'edit', 'write_file|replace'],
    ['AfterTool', 'boundary', 'run_shell_command'], ['AfterAgent', 'turn'], ['PreCompress', 'compact'], ['SessionEnd', 'end'],
  ],
};

const cursorEvents = [
  ['sessionStart', 'start'], ['beforeSubmitPrompt', 'request'], ['afterFileEdit', 'edit'],
  ['afterShellExecution', 'boundary'], ['afterAgentResponse', 'turn'], ['preCompact', 'compact'], ['sessionEnd', 'end'],
];

function stripManaged(config) {
  if (!config?.hooks) return config;
  for (const event of Object.keys(config.hooks)) {
    config.hooks[event] = (config.hooks[event] || []).filter((entry) => !JSON.stringify(entry).replaceAll('\\\\', '/').includes(NEEDLE));
    if (!config.hooks[event].length) delete config.hooks[event];
  }
  if (!Object.keys(config.hooks).length) delete config.hooks;
  return config;
}

function writeJsonWiring(target, path, config) {
  stripManaged(config);
  config.hooks ||= {};
  if (target === 'cursor') {
    config.version ||= 1;
    for (const [event, operation] of cursorEvents) {
      config.hooks[event] ||= [];
      const entry = handler(target, operation);
      delete entry.type;
      delete entry.timeout;
      config.hooks[event].push(entry);
    }
  } else {
    for (const [event, operation, matcher] of nestedEvents[target]) {
      config.hooks[event] ||= [];
      config.hooks[event].push({ ...(matcher ? { matcher } : {}), hooks: [handler(target, operation)] });
    }
  }
  mkdirSync(dirname(path), { recursive: true });
  writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`);
}

function commonPaths(cwd) {
  return [
    join(cwd, '.rsc', 'session-memory-core.mjs'),
    join(cwd, '.rsc', 'session-memory-adapter.mjs'),
    join(cwd, '.rsc', 'session-memory.mjs'),
  ];
}

export function memoryManagedPaths(target, cwd = process.cwd()) {
  if (!MEMORY_TARGETS[target]) return [];
  const paths = [...commonPaths(cwd), join(cwd, ...CONFIG[target].split('/'))];
  if (target === 'cursor') paths.push(join(cwd, '.cursor', 'rules', 'rsc-memory.mdc'));
  return paths;
}

export function wireMemory(target, cwd = process.cwd()) {
  const mode = memoryModeFor(target);
  if (mode === 'unsupported') return { mode, reason: 'no-local-lifecycle', paths: [] };
  const configPath = join(cwd, ...CONFIG[target].split('/'));
  if (tracked(cwd, configPath)) return { mode: 'degraded', reason: 'config-tracked', paths: [] };
  if (target !== 'opencode' && readConfig(configPath) === null) return { mode: 'degraded', reason: 'config-invalid', paths: [] };
  if (target === 'opencode' && existsSync(configPath) && !readFileSync(configPath, 'utf8').includes('RscMemoryPlugin')) {
    return { mode: 'degraded', reason: 'plugin-collision', paths: [] };
  }
  const assistedRule = join(cwd, '.cursor', 'rules', 'rsc-memory.mdc');
  if (target === 'cursor' && tracked(cwd, assistedRule)) return { mode: 'degraded', reason: 'rule-tracked', paths: [] };

  const [core, adapter, cli] = commonPaths(cwd);
  mkdirSync(dirname(core), { recursive: true });
  copyFileSync(join(HERE, 'session-memory-core.mjs'), core);
  copyFileSync(join(HERE, 'session-memory-adapter.mjs'), adapter);
  copyFileSync(join(HERE, 'session-memory.mjs'), cli);
  if (target === 'opencode') {
    mkdirSync(dirname(configPath), { recursive: true });
    copyFileSync(join(HERE, 'opencode-memory-plugin.js'), configPath);
  } else {
    writeJsonWiring(target, configPath, readConfig(configPath) || {});
  }
  if (target === 'cursor') {
    mkdirSync(dirname(assistedRule), { recursive: true });
    writeFileSync(assistedRule, `---\ndescription: Read rsc local continuation before the first action in a new desktop session.\nalwaysApply: true\n---\nOn the first turn of a local desktop session, run \`node .rsc/session-memory.mjs resume\` and read its \`context\` field before acting. Skip this rule for background or cloud agents.\n`);
  }
  const paths = memoryManagedPaths(target, cwd);
  for (const path of paths) exclude(cwd, path);
  return {
    mode,
    reason: target === 'codex' ? 'hook-trust-required' : target === 'cursor' ? 'start-hook-fire-and-forget' : 'wired',
    paths,
  };
}

export function unwireMemory(target, cwd = process.cwd()) {
  if (!MEMORY_TARGETS[target]) return [];
  const path = join(cwd, ...CONFIG[target].split('/'));
  const touched = [];
  if (target === 'opencode') {
    if (existsSync(path) && readFileSync(path, 'utf8').includes('RscMemoryPlugin')) { rmSync(path, { force: true }); touched.push(path); }
  } else {
    const config = readConfig(path);
    if (config) { stripManaged(config); writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`); touched.push(path); }
  }
  if (target === 'cursor') {
    const rule = join(cwd, '.cursor', 'rules', 'rsc-memory.mdc');
    if (existsSync(rule)) { rmSync(rule, { force: true }); touched.push(rule); }
  }
  return touched;
}
