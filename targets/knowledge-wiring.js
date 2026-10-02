// Wiring for knowledge sync (`knowledge-sync.mjs`): two lifecycle events per assistant — the person
// sends a message, the agent finishes — in the same project-local config files the session memory
// uses, under a needle of its own so either can be wired or removed without touching the other.
//
// Kept apart from `memory.js` on purpose. The memory's promise is that it makes no network request,
// and a test holds every file it wires to that; knowledge sync exists to talk to `origin`. Riding
// inside the memory would have broken the promise and tied the two switches together.
import { appendFileSync, copyFileSync, existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { execFileSync } from 'node:child_process';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const NEEDLE = '.rsc/knowledge-sync.mjs';
const PLUGIN_MARKER = 'rsc-knowledge:managed';

/** Same files as the memory: project-local, untracked, the assistant's own hook config. */
const CONFIG = Object.freeze({
  claude: '.claude/settings.local.json',
  codex: '.codex/hooks.json',
  cursor: '.cursor/hooks.json',
  gemini: '.gemini/settings.json',
  opencode: '.opencode/plugins/rsc-knowledge.js',
});

const EVENTS = Object.freeze({
  claude: [['UserPromptSubmit', 'request'], ['Stop', 'turn']],
  codex: [['UserPromptSubmit', 'request'], ['Stop', 'turn']],
  gemini: [['BeforeAgent', 'request'], ['AfterAgent', 'turn']],
  cursor: [['beforeSubmitPrompt', 'request'], ['afterAgentResponse', 'turn']],
});

export const KNOWLEDGE_TARGETS = Object.freeze(Object.keys(CONFIG));

const git = (cwd, args) => {
  try { return execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] }).trim(); } catch { return null; }
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

function handler(target, event) {
  const script = target === 'claude'
    ? '"${CLAUDE_PROJECT_DIR}/.rsc/knowledge-sync.mjs"'
    : target === 'codex'
      ? '"$(git rev-parse --show-toplevel)/.rsc/knowledge-sync.mjs"'
      : '".rsc/knowledge-sync.mjs"';
  const value = { type: 'command', command: `node ${script} hook ${target} ${event}`, timeout: target === 'gemini' ? 10000 : 10 };
  if (target === 'codex') value.commandWindows = `node "$((git rev-parse --show-toplevel).Trim())/.rsc/knowledge-sync.mjs" hook ${target} ${event}`;
  if (target === 'gemini') value.name = `rsc-knowledge-${event}`;
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
// rsc knowledge sync for OpenCode. OpenCode has no prompt event and no channel to the person, so what
// sync has to say goes to the model, to be relayed. Cheap on every call: the fetch is throttled and
// every notice is said once. Turn it off with \`rsc knowledge-sync off\`.
import { onRequest, onTurn } from '../../.rsc/knowledge-sync.mjs';

export const RscKnowledgePlugin = async ({ directory, worktree }) => {
  const cwd = worktree || directory;
  const local = () => process.env.RSC_REMOTE_AGENT !== '1' && process.env.OPENCODE_REMOTE !== '1';
  return {
    'experimental.chat.system.transform': async (_input, output) => {
      if (!local()) return;
      try {
        const said = onRequest(cwd);
        if (said && Array.isArray(output?.system)) output.system.push(\`Cuéntale esto al usuario en una línea:\\n\${said}\`);
      } catch { /* fail open */ }
    },
    event: async ({ event }) => {
      if (event?.type === 'session.idle' && local()) { try { onTurn(cwd); } catch { /* fail open */ } }
    },
  };
};
`;

export function knowledgeManagedPaths(target, cwd = process.cwd()) {
  if (!CONFIG[target]) return [];
  return [join(cwd, '.rsc', 'knowledge-sync.mjs'), join(cwd, ...CONFIG[target].split('/'))];
}

/** Wire it. Always, when the assistant supports it: being off is the runtime's `.no-knowledge-sync`. */
export function wireKnowledge(target, cwd = process.cwd()) {
  if (!CONFIG[target]) return { mode: 'unsupported', paths: [] };
  const configPath = join(cwd, ...CONFIG[target].split('/'));
  if (tracked(cwd, configPath)) return { mode: 'degraded', reason: 'config-tracked', paths: [] };
  if (target === 'opencode' && existsSync(configPath) && !readFileSync(configPath, 'utf8').includes(PLUGIN_MARKER)) {
    return { mode: 'degraded', reason: 'plugin-collision', paths: [] };
  }
  const config = target === 'opencode' ? null : readConfig(configPath);
  if (target !== 'opencode' && !validHookConfig(config)) return { mode: 'degraded', reason: 'config-invalid', paths: [] };

  const script = join(cwd, '.rsc', 'knowledge-sync.mjs');
  mkdirSync(dirname(script), { recursive: true });
  copyFileSync(join(HERE, 'knowledge-sync.mjs'), script);
  mkdirSync(dirname(configPath), { recursive: true });
  if (target === 'opencode') writeFileSync(configPath, PLUGIN);
  else {
    strip(config);
    config.hooks ||= {};
    if (target === 'cursor') config.version ||= 1;
    for (const [event, op] of EVENTS[target]) {
      config.hooks[event] ||= [];
      const h = handler(target, op);
      if (target === 'cursor') { delete h.type; delete h.timeout; config.hooks[event].push(h); }
      else config.hooks[event].push({ hooks: [h] });
    }
    writeFileSync(configPath, `${JSON.stringify(config, null, 2)}\n`);
  }
  const paths = knowledgeManagedPaths(target, cwd);
  for (const path of paths) exclude(cwd, path);
  return { mode: 'wired', paths };
}

export function unwireKnowledge(target, cwd = process.cwd()) {
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

export function knowledgeArtifactsPresent(target, cwd = process.cwd()) {
  if (!CONFIG[target]) return [];
  const out = [join(cwd, '.rsc', 'knowledge-sync.mjs')].filter(existsSync);
  const path = join(cwd, ...CONFIG[target].split('/'));
  if (existsSync(path)) {
    const body = readFileSync(path, 'utf8').replaceAll('\\\\', '/');
    if (body.includes(NEEDLE) || body.includes(PLUGIN_MARKER)) out.push(path);
  }
  return out;
}
