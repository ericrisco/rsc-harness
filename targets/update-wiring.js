// Wiring for the update check (`auto-update.mjs`). Every assistant gets the module in `.rsc/`; the
// ones with a session-start event also get a hook that runs it, in the same project-local config
// files the session memory uses, under a needle of its own so either can be wired or removed
// without touching the other.
//
// Kept apart from `memory.js` on purpose: the memory promises it makes no network request, and a
// test holds every file it wires to that. The update check exists to ask npm.
//
// Claude Code is not in CONFIG: its `session-start.mjs` already imports the module. An assistant
// with no hook at all is told by the always-on body to run the module on its first turn.
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const NEEDLE = '.rsc/auto-update.mjs';
const PLUGIN_MARKER = 'rsc-update:managed';

const CONFIG = Object.freeze({
  codex: '.codex/hooks.json',
  deepseek: '.dsh/hooks.json',
  cursor: '.cursor/hooks.json',
  gemini: '.gemini/settings.json',
  opencode: '.opencode/plugins/rsc-update.js',
});

const EVENT = Object.freeze({ codex: 'SessionStart', deepseek: 'SessionStart', gemini: 'SessionStart', cursor: 'sessionStart' });

/** Assistants where the update runs on its own. Every other one depends on the agent running it. */
export const UPDATE_HOOK_TARGETS = Object.freeze(['claude', ...Object.keys(CONFIG)].sort());

const git = (cwd, args) => {
  try { return execFileSync('git', args, { windowsHide: true, cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; }
};
const rel = (cwd, path) => relative(cwd, path).split(sep).join('/');
const tracked = (cwd, path) => Boolean(git(cwd, ['ls-files', '--', rel(cwd, path)]));

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

const validHookConfig = (c) => Boolean(c) && typeof c === 'object' && !Array.isArray(c)
  && (!Object.hasOwn(c, 'hooks') || (c.hooks && typeof c.hooks === 'object' && !Array.isArray(c.hooks) && Object.values(c.hooks).every(Array.isArray)));

function handler(target) {
  const script = target === 'codex'
    ? '"$(git rev-parse --show-toplevel)/.rsc/auto-update.mjs"'
    : '".rsc/auto-update.mjs"';
  const value = { type: 'command', command: `node ${script} hook ${target}`, timeout: target === 'gemini' ? 10000 : 10 };
  if (target === 'codex') value.commandWindows = `node "$((git rev-parse --show-toplevel).Trim())/.rsc/auto-update.mjs" hook ${target}`;
  if (target === 'gemini') value.name = 'rsc-update';
  return value;
}

function strip(config) {
  if (!validHookConfig(config) || !config.hooks) return config;
  for (const event of Object.keys(config.hooks)) {
    config.hooks[event] = config.hooks[event].filter((e) => !JSON.stringify(e).replaceAll('\\\\', '/').includes(NEEDLE));
    if (!config.hooks[event].length) delete config.hooks[event];
  }
  if (!Object.keys(config.hooks).length) delete config.hooks;
  return config;
}

const PLUGIN = `// ${PLUGIN_MARKER}
// rsc update check for OpenCode: checked once per OpenCode run, and the notice goes to the model to be
// relayed. It rides on EVERY system prompt of the run, not just the first: OpenCode's first call is
// its title generator, which would swallow a once-only notice before the agent ever sees it.
// One file for both plugin APIs (issue #289): V1 calls the named export or server(); V2 reads id + setup.
// Turn auto-update off with .rsc/.no-auto-update.
import { updateNotice } from '../../.rsc/auto-update.mjs';

const NOTE = '\\nMention this only in your first reply of the session.';
const check = (cwd) => (process.env.RSC_NO_UPDATE_CHECK ? Promise.resolve('') : updateNotice(cwd).catch(() => ''));

export const RscUpdatePlugin = async ({ directory, worktree }) => {
  const pending = check(worktree || directory);
  return {
    'experimental.chat.system.transform': async (_input, output) => {
      const said = (await pending).trim();
      if (said && Array.isArray(output?.system)) output.system.push(said + NOTE);
    },
  };
};

export default {
  id: 'rsc.update',
  server: RscUpdatePlugin,
  async setup(ctx) {
    const pending = check(ctx.location?.project?.directory || ctx.location?.directory || process.cwd());
    await ctx.session.hook('context', async (event) => {
      const said = (await pending).trim();
      if (said && Array.isArray(event?.system)) event.system.push({ type: 'text', text: said + NOTE });
    });
  },
};
`;

export function updateManagedPaths(target, cwd = process.cwd()) {
  const module = join(cwd, '.rsc', 'auto-update.mjs');
  return CONFIG[target] ? [module, join(cwd, ...CONFIG[target].split('/'))] : [module];
}

/** Wire it. Always: being off is the runtime's `.no-auto-update`, and the check itself stays on. */
export function wireUpdate(target, cwd = process.cwd()) {
  const module = join(cwd, '.rsc', 'auto-update.mjs');
  mkdirSync(dirname(module), { recursive: true });
  copyFileSync(join(HERE, 'auto-update.mjs'), module);
  if (!CONFIG[target]) {
    return { mode: target === 'claude' ? 'hook' : 'agent', paths: [module] };
  }
  const configPath = join(cwd, ...CONFIG[target].split('/'));
  if (tracked(cwd, configPath)) return { mode: 'agent', reason: 'config-tracked', paths: [module] };
  if (target === 'opencode' && existsSync(configPath) && !readFileSync(configPath, 'utf8').includes(PLUGIN_MARKER)) {
    return { mode: 'agent', reason: 'plugin-collision', paths: [module] };
  }
  const config = target === 'opencode' ? null : readConfig(configPath);
  if (target !== 'opencode' && !validHookConfig(config)) return { mode: 'agent', reason: 'config-invalid', paths: [module] };

  mkdirSync(dirname(configPath), { recursive: true });
  if (target === 'opencode') writeFileSync(configPath, PLUGIN);
  else {
    strip(config);
    config.hooks ||= {};
    const event = EVENT[target];
    config.hooks[event] ||= [];
    const h = handler(target);
    if (target === 'cursor') { config.version ||= 1; delete h.type; delete h.timeout; config.hooks[event].push(h); }
    else config.hooks[event].push({ hooks: [h] });
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  }
  const paths = updateManagedPaths(target, cwd);
  for (const path of paths) exclude(cwd, path);
  return { mode: 'hook', paths };
}

export function unwireUpdate(target, cwd = process.cwd()) {
  if (!CONFIG[target]) return [];
  const path = join(cwd, ...CONFIG[target].split('/'));
  const touched = [];
  if (target === 'opencode') {
    if (existsSync(path) && readFileSync(path, 'utf8').includes(PLUGIN_MARKER)) { rmSync(path, { force: true }); touched.push(path); }
  } else if (existsSync(path) && readFileSync(path, 'utf8').replaceAll('\\\\', '/').includes(NEEDLE)) {
    const config = readConfig(path);
    if (config) { strip(config); writeFileSync(path, `${JSON.stringify(config, null, 2)}\n`); touched.push(path); }
  }
  return touched;
}

export function updateArtifactsPresent(target, cwd = process.cwd()) {
  if (!CONFIG[target]) return [];
  const path = join(cwd, ...CONFIG[target].split('/'));
  if (!existsSync(path)) return [];
  const body = readFileSync(path, 'utf8').replaceAll('\\\\', '/');
  return body.includes(NEEDLE) || body.includes(PLUGIN_MARKER) ? [path] : [];
}
