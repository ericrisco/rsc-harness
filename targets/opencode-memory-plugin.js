import { readFileSync } from 'node:fs';
import { join } from 'node:path';
import { capture, resume } from '../../.rsc/session-memory-core.mjs';

function memorySettings(cwd) {
  try {
    const value = JSON.parse(readFileSync(join(cwd, '.rsc.json'), 'utf8')).memory;
    if (value === false) return { enabled: false };
    return value && typeof value === 'object' ? value : {};
  } catch {
    return {};
  }
}

function sessionId(input) {
  return input?.sessionID || input?.session_id || input?.event?.properties?.info?.id
    || input?.event?.properties?.sessionID || null;
}

export const RscMemoryPlugin = async ({ directory, worktree }) => {
  const cwd = worktree || directory;
  const injected = new Set();
  const local = () => process.env.RSC_REMOTE_AGENT !== '1' && process.env.OPENCODE_REMOTE !== '1';
  const save = (id, event, editDelta = 0) => {
    if (!id || !local()) return;
    try { capture({ cwd, sessionId: id, target: 'opencode', event, editDelta, settings: memorySettings(cwd) }); } catch { /* fail open */ }
  };

  return {
    'experimental.chat.system.transform': async (input, output) => {
      const id = sessionId(input);
      if (!id || injected.has(id) || !local()) return;
      injected.add(id);
      try {
        const config = memorySettings(cwd);
        save(id, 'start');
        const result = resume({ cwd, target: 'opencode', settings: config });
        if (!result.context || !Array.isArray(output?.system)) return;
        if (output.system.length === 0) output.system.push(result.context);
        else output.system[0] = `${output.system[0]}\n\n${result.context}`;
      } catch { /* fail open */ }
    },
    'tool.execute.after': async (input) => {
      const tool = String(input?.tool || '').toLowerCase();
      save(sessionId(input), 'boundary', /write|edit|patch/u.test(tool) ? 1 : 0);
    },
    'experimental.session.compacting': async (input, output) => {
      const id = sessionId(input);
      save(id, 'compact');
      try {
        const result = resume({ cwd, target: 'opencode', settings: memorySettings(cwd) });
        if (result.context && Array.isArray(output?.context)) output.context.push(result.context);
      } catch { /* fail open */ }
    },
    event: async ({ event }) => {
      const id = sessionId({ event });
      if (event?.type === 'session.created') save(id, 'start');
      else if (event?.type === 'file.edited') save(id, 'edit', 1);
      else if (event?.type === 'session.compacted') save(id, 'compact');
      else if (event?.type === 'session.idle') save(id, 'turn');
      else if (event?.type === 'session.deleted') save(id, 'sessionEnd');
    },
  };
};
