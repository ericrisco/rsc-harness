#!/usr/bin/env node
import { existsSync, readFileSync } from 'node:fs';
import { resolve, join } from 'node:path';
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
    const project = resolve(cwd || native.cwd || process.env.RSC_PROJECT_CWD || process.cwd());
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

if (import.meta.url === `file://${process.argv[1]}`) {
  const result = handleLifecycle({ target: process.argv[2], event: process.argv[3], native: stdinJson() });
  process.stdout.write(`${JSON.stringify(result.output)}\n`);
}
