#!/usr/bin/env node
import { fileURLToPath } from 'node:url';
import { existsSync, readFileSync, realpathSync } from 'node:fs';
import { resolve, join, dirname } from 'node:path';
import { capture, resume } from './session-memory-core.mjs';

const LOCAL_TARGETS = new Set(['claude', 'codex', 'cursor', 'gemini', 'opencode']);

function projectSettings(cwd) {
  try {
    const manifest = JSON.parse(readFileSync(join(cwd, '.rsc.json'), 'utf8'));
    if (manifest.memory === false) return { enabled: false };
    return manifest.memory && typeof manifest.memory === 'object' ? manifest.memory : {};
  } catch {
    return {};
  }
}

// The project is the nearest ancestor holding `.rsc.json` — the file that IS the harness's decision.
// The hook payload's `cwd` is only where the tool call happened to run; inside a container of child
// repos that is routinely a subdirectory with no harness of its own, and anchoring there scatters
// one session's journal across children. With no harness anywhere above, the cwd stays the project.
function nearestHarness(dir) {
  let current = dir;
  for (;;) {
    if (existsSync(join(current, '.rsc.json'))) return current;
    const parent = dirname(current);
    if (parent === current) return dir;
    current = parent;
  }
}

function sessionId(native, target) {
  return native?.session_id || native?.sessionId || native?.sessionID || native?.conversation_id
    || native?.thread_id || `${target}-${process.ppid}`;
}

function isRemote(target, native) {
  if (target === 'cursor' && (native?.is_background_agent === true || native?.isBackgroundAgent === true)) return true;
  return process.env.RSC_REMOTE_AGENT === '1'
    || process.env.CURSOR_CLOUD_AGENT === '1'
    || process.env.CODEX_CLOUD_AGENT === '1';
}

function hookEventName(target, event, native) {
  if (native?.hook_event_name) return native.hook_event_name;
  const names = {
    start: target === 'cursor' ? 'sessionStart' : 'SessionStart',
    request: target === 'gemini' ? 'BeforeAgent' : 'UserPromptSubmit',
    edit: target === 'cursor' ? 'afterFileEdit' : target === 'gemini' ? 'AfterTool' : 'PostToolUse',
    boundary: target === 'cursor' ? 'afterShellExecution' : target === 'gemini' ? 'AfterTool' : 'PostToolUse',
    turn: target === 'cursor' ? 'afterAgentResponse' : target === 'gemini' ? 'AfterAgent' : 'Stop',
    compact: target === 'cursor' ? 'preCompact' : target === 'gemini' ? 'PreCompress' : 'PreCompact',
    end: target === 'cursor' ? 'sessionEnd' : 'SessionEnd',
  };
  return names[event] || event;
}

function nativeOutput(target, eventName, context = '', notice = null, compactionHint = false) {
  const hint = compactionHint ? 'rsc memory: consider compacting at the next phase boundary; nothing was compacted automatically.' : '';
  const extra = [context, hint].filter(Boolean).join('\n');
  if (!extra && !notice) return {};
  if (target === 'cursor') return { ...(extra ? { additional_context: extra } : {}), ...(notice ? { user_message: notice } : {}) };
  if (target === 'opencode') return { context: extra, notice };
  return {
    ...(notice ? { systemMessage: notice } : {}),
    ...(extra ? { hookSpecificOutput: { hookEventName: eventName, additionalContext: extra } } : {}),
  };
}

export function contextFromNativeOutput(target, output = {}) {
  if (target === 'cursor') return output.additional_context || '';
  if (target === 'opencode') return output.context || '';
  return output.hookSpecificOutput?.additionalContext || '';
}

export function handleLifecycle({ target, event, native = {}, cwd, settings } = {}) {
  try {
    if (!LOCAL_TARGETS.has(target)) throw new Error(`unsupported memory target: ${target}`);
    if (isRemote(target, native)) return { output: {}, capture: null, remote: true, degraded: false };
    const project = nearestHarness(resolve(cwd || native.cwd || process.env.RSC_PROJECT_CWD || process.cwd()));
    if (!existsSync(project)) throw new Error('project directory unavailable');
    const config = settings || projectSettings(project);
    if (config.enabled === false) return { output: {}, capture: null, remote: false, degraded: false };
    const id = sessionId(native, target);
    const eventName = hookEventName(target, event, native);
    if (event === 'start') {
      const started = capture({ cwd: project, sessionId: id, target, event: 'start', settings: config });
      const resumed = resume({ cwd: project, target, settings: config });
      return {
        output: nativeOutput(target, eventName, resumed.context),
        capture: started,
        resume: resumed,
        remote: false,
        degraded: false,
      };
    }
    const captureInput = {
      cwd: project,
      sessionId: id,
      target,
      event: event === 'end' ? 'sessionEnd' : event,
      editDelta: event === 'edit' ? 1 : 0,
      settings: config,
    };
    if (typeof native.cost === 'number') captureInput.cost = native.cost;
    if (Number.isInteger(native.tool_calls)) captureInput.toolCalls = native.tool_calls;
    const captured = capture(captureInput);
    return {
      output: nativeOutput(target, eventName, '', captured.notice, captured.compactionHint),
      capture: captured,
      remote: false,
      degraded: false,
    };
  } catch (error) {
    return { output: {}, capture: null, remote: false, degraded: true, error: error instanceof Error ? error.message : String(error) };
  }
}

function stdinJson() {
  try {
    const raw = readFileSync(0, 'utf8');
    return raw.trim() ? JSON.parse(raw) : {};
  } catch {
    return {};
  }
}

/**
 * "Was this file run directly?" — the same question `clone-bootstrap.mjs` answers, and the same two
 * traps, so the same answer. Written out here rather than imported because hooks are materialized
 * file by file under `.rsc/`: an import would be a second file to copy for six lines.
 *
 *   `process.argv[1]` MAY NOT EXIST. Under `node -e`, `--input-type=module` or the REPL there is no
 *   script path, and `pathToFileURL(undefined)` throws — at module load, so merely IMPORTING this
 *   file takes the importer down with it. A module that cannot be imported is a module nobody can
 *   build a tool on top of, and people do exactly that with this package.
 *
 *   SYMLINKS MAKE THE TWO SIDES DISAGREE. `import.meta.url` is what the loader resolved (symlinks
 *   RESOLVED); `process.argv[1]` is the raw string the client passed (symlinks INTACT). One
 *   symlinked component — `/tmp` and `/var` on macOS, or an ordinary `~/code -> /Volumes/…` — and a
 *   string compare says "no", the main block never runs, node exits 0 having printed nothing, and
 *   the hook becomes a silent no-op that `doctor` still reports as wired.
 */
function isMainModule(metaUrl) {
  const invoked = process.argv[1];
  if (!invoked) return false;
  const self = fileURLToPath(metaUrl);
  try {
    return realpathSync(self) === realpathSync(invoked);
  } catch {
    return self === invoked;
  }
}

if (isMainModule(import.meta.url)) {
  const result = handleLifecycle({ target: process.argv[2], event: process.argv[3], native: stdinJson() });
  process.stdout.write(`${JSON.stringify(result.output)}\n`);
}
