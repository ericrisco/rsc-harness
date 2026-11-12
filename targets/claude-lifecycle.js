// Local lifecycle settings can be inherited by a worktree whose ignored runtime is
// absent. Use the same portable bootstrap as Claude's committed hook settings.
import { copyFileSync, mkdirSync, existsSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = dirname(fileURLToPath(import.meta.url));
export const claudeBootstrapPath = (cwd) => join(cwd, '.claude', 'rsc-bootstrap.mjs');

export function ensureClaudeBootstrap(cwd) {
  const dest = claudeBootstrapPath(cwd);
  mkdirSync(dirname(dest), { recursive: true });
  copyFileSync(join(HERE, 'clone-bootstrap.mjs'), dest);
}

// script and args are internal lifecycle identifiers, never caller-provided shell text.
export function claudeLifecycleCommand(script, ...args) {
  return `node "\${CLAUDE_PROJECT_DIR}/.claude/rsc-bootstrap.mjs" "quiet" "\${CLAUDE_PROJECT_DIR}" "\${CLAUDE_PROJECT_DIR}/.rsc/${script}" ${args.join(' ')}`;
}

// The committed hooks and the local lifecycle hooks share this file. Retire it
// only after both settings surfaces stop referencing it; unreadable settings retain it.
export function pruneClaudeBootstrap(cwd) {
  for (const name of ['settings.json', 'settings.local.json']) {
    const file = join(cwd, '.claude', name);
    if (!existsSync(file)) continue;
    try {
      const config = JSON.parse(readFileSync(file, 'utf8'));
      if (!config || typeof config !== 'object' || Array.isArray(config)) return;
      if (JSON.stringify(config.hooks || {}).replace(/\\\\/g, '/').includes('.claude/rsc-bootstrap.mjs')) return;
    } catch { return; }
  }
  try { rmSync(claudeBootstrapPath(cwd), { force: true }); } catch { /* cleanup must not break uninstall */ }
}
