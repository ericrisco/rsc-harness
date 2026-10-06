// rsc-deepseek-bridge:managed
// DeepSeek Harness runs Codex-format hooks only from ONE file named at boot, and a boot is per
// machine, not per project (`dsh web` serves every workspace from one process). So the machine gets
// one hooks file whose every entry calls this script, and this script runs the hooks of whichever
// project the session is in: the nearest ancestor of the session's cwd holding `.dsh/hooks.json`.
// No project there → nothing runs, nothing is printed.
//
// Output is folded back into the Codex shape the bridge reads. The bridge drops `systemMessage`
// (not surfaced yet), so a message for the person travels as model context with an instruction to
// relay it. Usage: node bridge.mjs <SessionStart|UserPromptSubmit|PostToolUse|Stop>  (payload on stdin)
import { existsSync, readFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const CONTEXT_EVENTS = new Set(['SessionStart', 'UserPromptSubmit', 'PostToolUse']);

export function projectOf(dir) {
  for (let current = resolve(dir); ; current = dirname(current)) {
    if (existsSync(join(current, '.dsh', 'hooks.json'))) return current;
    if (dirname(current) === current) return null;
  }
}

// The hooks rsc writes are plain argv (`node ".rsc/x.mjs" args`), so no shell is needed — and none is
// used, which also keeps Windows from flashing a console (#293). Quotes group, nothing else is special.
export function argv(command) {
  const out = [];
  for (const m of command.matchAll(/"([^"]*)"|'([^']*)'|(\S+)/g)) out.push(m[1] ?? m[2] ?? m[3]);
  if (out[0] === 'node') out[0] = process.execPath;
  return out;
}

function matches(matcher, subject) {
  if (!matcher) return true;
  try { return new RegExp(`^(?:${matcher})$`).test(subject); } catch { return false; }
}

export function runBridge(event, raw = '', env = process.env) {
  let payload = {};
  try { payload = raw.trim() ? JSON.parse(raw) : {}; } catch { payload = {}; }
  const root = projectOf(payload.cwd || process.cwd());
  if (!root) return {};
  let config;
  try { config = JSON.parse(readFileSync(join(root, '.dsh', 'hooks.json'), 'utf8')); } catch { return {}; }
  const groups = Array.isArray(config?.hooks?.[event]) ? config.hooks[event] : [];
  const context = [];
  let deny = null;
  for (const group of groups) {
    if (!matches(group?.matcher, String(payload.tool_name || ''))) continue;
    for (const hook of Array.isArray(group?.hooks) ? group.hooks : []) {
      if (typeof hook?.command !== 'string') continue;
      const seconds = typeof hook.timeout === 'number' ? hook.timeout : 10;
      const [file, ...args] = argv(hook.command);
      if (!file) continue;
      const result = spawnSync(file, args, {
        cwd: root, input: raw, encoding: 'utf8', timeout: seconds * 1000, windowsHide: true, env,
      });
      if (result.status === 2) { deny = (result.stderr || '').trim() || 'blocked by an rsc hook'; continue; }
      if (result.status !== 0) continue;
      const out = (result.stdout || '').trim();
      if (!out) continue;
      let parsed = null;
      try { parsed = JSON.parse(out); } catch { parsed = null; }
      if (!parsed || typeof parsed !== 'object') { context.push(out); continue; }
      const specific = parsed.hookSpecificOutput || {};
      if (parsed.decision === 'block' || parsed.decision === 'deny' || specific.permissionDecision === 'deny') {
        deny = parsed.reason || specific.permissionDecisionReason || 'blocked by an rsc hook';
      }
      if (typeof specific.additionalContext === 'string' && specific.additionalContext) context.push(specific.additionalContext);
      if (typeof parsed.systemMessage === 'string' && parsed.systemMessage) {
        context.push(`Tell the person this in one line, in their language:\n${parsed.systemMessage}`);
      }
    }
  }
  const out = {};
  if (deny) { out.decision = 'block'; out.reason = deny; }
  if (context.length && CONTEXT_EVENTS.has(event)) {
    out.hookSpecificOutput = { hookEventName: event, additionalContext: context.join('\n\n') };
  }
  return out;
}

if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  let raw = '';
  try { raw = readFileSync(0, 'utf8'); } catch { raw = ''; }
  let out = {};
  try { out = runBridge(String(process.argv[2] || ''), raw); } catch { out = {}; }
  if (Object.keys(out).length) process.stdout.write(`${JSON.stringify(out)}\n`);
}
