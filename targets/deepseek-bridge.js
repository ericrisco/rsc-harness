// DeepSeek Harness (dsh) has no project-level hook or plugin config: plugins are per machine, and
// its Codex-hooks bridge reads one file named at boot. So the deepseek target needs one machine-level
// step besides the project files: put rsc's bridge in $DSH_HOME/rsc/ and add one insert to the
// home patch layer ($DSH_HOME/cordis.patch.yml, applied over every profile). Idempotent, and it only
// ever touches the block between its own markers. It is never removed on uninstall: other projects on
// the machine may use it, and with no `.dsh/hooks.json` in a project it does nothing at all.
import { copyFileSync, existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
const BEGIN = '# rsc-deepseek-bridge:begin';
const END = '# rsc-deepseek-bridge:end';
// The points rsc uses. PreToolUse is left out: nothing of rsc's runs there yet, and every tool call
// would pay a process spawn for nothing.
const EVENTS = ['SessionStart', 'UserPromptSubmit', 'PostToolUse', 'Stop'];

export function dshHome(env = process.env) {
  const value = (env.DSH_HOME || '').trim();
  return value || join(homedir(), '.dsh');
}

export function deepseekBridgePaths(env = process.env) {
  const home = dshHome(env);
  return {
    home,
    bridge: join(home, 'rsc', 'bridge.mjs'),
    hooks: join(home, 'rsc', 'hooks.json'),
    patch: join(home, 'cordis.patch.yml'),
  };
}

const quote = (value) => `'${String(value).replaceAll("'", "''")}'`;

function block(hooksPath) {
  return [
    `${BEGIN} — rsc hooks for DeepSeek Harness (delete this block to turn them off)`,
    '- insert:',
    '    - id: rsc-hooks',
    "      name: '@deepseek-ai/dsh-hooks-codex'",
    '      config:',
    `        configPath: ${quote(hooksPath)}`,
    END,
  ].join('\n');
}

/** Where the block goes, or null when the file is in a shape we must not guess at. */
export function patchWithBlock(body, hooksPath) {
  const ours = block(hooksPath);
  const start = body.indexOf(BEGIN);
  const stop = body.indexOf(END);
  if (start !== -1 && stop > start) return body.slice(0, start) + ours + body.slice(stop + END.length);
  const lines = body.split('\n');
  const content = lines.filter((line) => line.trim() && !line.trim().startsWith('#'));
  if (content.length === 1 && content[0].trim() === '[]') {
    const kept = lines.filter((line) => line.trim() !== '[]').join('\n').replace(/\n*$/, '');
    return `${kept ? `${kept}\n` : ''}${ours}\n`;
  }
  if (!content.length) return `${body.replace(/\n*$/, '')}${body.trim() ? '\n' : ''}${ours}\n`;
  if (content[0].startsWith('- ')) return `${body.replace(/\n*$/, '')}\n${ours}\n`;
  return null;
}

export function wireDeepseekBridge(env = process.env) {
  const paths = deepseekBridgePaths(env);
  mkdirSync(dirname(paths.bridge), { recursive: true });
  copyFileSync(join(HERE, 'deepseek-bridge.mjs'), paths.bridge);
  const hooks = {};
  for (const event of EVENTS) {
    hooks[event] = [{ hooks: [{ type: 'command', command: `node "${paths.bridge}" ${event}`, timeout: 30 }] }];
  }
  writeFileSync(paths.hooks, `${JSON.stringify({ hooks }, null, 2)}\n`);
  const body = existsSync(paths.patch) ? readFileSync(paths.patch, 'utf8') : '';
  const next = patchWithBlock(body, paths.hooks);
  if (next === null) return { mode: 'manual', reason: 'patch-shape-unknown', paths: [paths.bridge, paths.hooks] };
  if (next !== body) writeFileSync(paths.patch, next);
  return { mode: 'wired', paths: [paths.bridge, paths.hooks, paths.patch] };
}

export function inspectDeepseekBridge(env = process.env) {
  const paths = deepseekBridgePaths(env);
  const patched = existsSync(paths.patch) && readFileSync(paths.patch, 'utf8').includes(BEGIN);
  const ready = patched && existsSync(paths.bridge) && existsSync(paths.hooks);
  return { status: ready ? 'ready' : 'missing', ...paths };
}
