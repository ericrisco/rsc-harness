// OpenCode 2.x loads a plugin only from a default export with an id and a setup(ctx) (issue #289:
// the V1-only files rsc generated failed with «Plugin must export a default definition with an id
// and an effect or setup function»). These tests drive each generated file through a stand-in for the
// V2 context — hooks registered on ctx.session / ctx.tool, events from ctx.event.subscribe, shaped as
// OpenCode 2.0.23 emits them (probed 2026-10-05) — and check the V1 entry points are still there.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { tmpdir } from './helpers/scratch.js';
import { join } from 'node:path';
import { pathToFileURL } from 'node:url';

const git = (cwd, ...args) => execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'] }).trim();
const load = (file) => import(`${pathToFileURL(file).href}?t=${Date.now()}-${Math.random()}`);

/** The parts of the V2 plugin context rsc uses, recording what was registered. */
function v2Context(directory) {
  const hooks = { session: {}, tool: {} };
  const queue = [];
  let wake = null;
  let stopped = false;
  const ctx = {
    location: { directory, project: { directory } },
    session: { hook: async (name, fn) => { hooks.session[name] = fn; return { dispose: async () => {} }; } },
    tool: { hook: async (name, fn) => { hooks.tool[name] = fn; return { dispose: async () => {} }; } },
    event: {
      subscribe: ({ signal }) => ({
        async *[Symbol.asyncIterator]() {
          signal?.addEventListener('abort', () => { stopped = true; wake?.(); });
          while (!stopped) {
            if (queue.length) yield queue.shift();
            else await new Promise((r) => { wake = r; });
          }
        },
      }),
    },
  };
  const emit = async (type, data) => { queue.push({ type, data }); wake?.(); await new Promise((r) => setTimeout(r, 30)); };
  return { ctx, hooks, emit };
}

function shape(module, id) {
  assert.equal(typeof module.default, 'object', 'V2 needs a default export');
  assert.equal(module.default.id, id);
  assert.equal(typeof module.default.setup, 'function', 'V2 needs setup(ctx)');
  assert.equal(typeof module.default.server, 'function', 'V1 (1.18.29+) object form needs server()');
}

test('ocv2-01 · update: the notice reaches a V2 session as a text part, and V1 still works', async () => {
  const { wireUpdate } = await import('../targets/update-wiring.js');
  const root = mkdtempSync(join(tmpdir(), 'rsc-ocv2-u-'));
  mkdirSync(join(root, '.rsc'), { recursive: true });
  writeFileSync(join(root, '.rsc', '.version'), '2.1.0\n');
  writeFileSync(join(root, '.rsc.json'), JSON.stringify({ version: 1, targets: ['opencode'], skills: [] }));
  writeFileSync(join(root, '.rsc', '.no-auto-update'), '');
  wireUpdate('opencode', root);
  const saved = { ...process.env };
  Object.assign(process.env, { RSC_NO_UPDATE_CHECK: '', RSC_LATEST_JSON: '', RSC_LATEST: '2.1.1' });
  try {
    const module = await load(join(root, '.opencode', 'plugins', 'rsc-update.js'));
    shape(module, 'rsc.update');
    assert.equal(typeof module.RscUpdatePlugin, 'function', 'V1 before 1.18.29 calls the named export');
    const { ctx, hooks } = v2Context(root);
    await module.default.setup(ctx);
    const event = { sessionID: 'ses_1', system: [{ type: 'text', text: 'base' }] };
    await hooks.session.context(event);
    assert.equal(event.system.length, 2);
    assert.equal(event.system[1].type, 'text');
    assert.match(event.system[1].text, /update available/);
    assert.match(event.system[1].text, /only in your first reply/);
  } finally {
    process.env = saved;
  }
});

test('ocv2-02 · memory: V2 injects the continuation once and journals start and turn', async () => {
  const adapters = await import('../targets/memory.js');
  const { handleLifecycle } = await import('../targets/session-memory-adapter.mjs');
  const cwd = realpathSync(mkdtempSync(join(tmpdir(), 'rsc-ocv2-m-')));
  git(cwd, 'init', '-q', '-b', 'main');
  git(cwd, 'config', 'user.email', 'e@x'); git(cwd, 'config', 'user.name', 'E');
  writeFileSync(join(cwd, '.rsc.json'), JSON.stringify({ version: 1, targets: ['opencode'] }));
  writeFileSync(join(cwd, 'README.md'), 'x\n');
  git(cwd, 'add', '-A'); git(cwd, 'commit', '-q', '-m', 'init');
  const plugin = adapters.wireMemory('opencode', cwd).paths.find((p) => p.endsWith('.opencode/plugins/rsc-memory.js'));
  handleLifecycle({ target: 'claude', event: 'start', native: { session_id: 'seed', cwd }, cwd });
  writeFileSync(join(cwd, 'README.md'), 'changed\n');
  handleLifecycle({ target: 'claude', event: 'edit', native: { session_id: 'seed', cwd }, cwd });

  const module = await load(plugin);
  shape(module, 'rsc.memory');
  const { ctx, hooks, emit } = v2Context(cwd);
  const cleanup = await module.default.setup(ctx);
  assert.ok(hooks.session.context && hooks.session.compaction && hooks.tool['execute.after']);

  await emit('session.created', { sessionID: 'ses_v2' });
  const first = { sessionID: 'ses_v2', system: [{ type: 'text', text: 'base' }] };
  await hooks.session.context(first);
  assert.equal(first.system.length, 2);
  assert.match(first.system[1].text, /exact continuation/);
  const again = { sessionID: 'ses_v2', system: [{ type: 'text', text: 'base' }] };
  await hooks.session.context(again);
  assert.equal(again.system.length, 1, 'injected once per session');

  await hooks.tool['execute.after']({ tool: 'write', sessionID: 'ses_v2', status: 'completed' });
  await emit('session.execution.succeeded', { sessionID: 'ses_v2' });
  cleanup();
  const stores = [join(cwd, '.rsc', 'memory', 'sessions')].filter(existsSync);
  const record = stores.flatMap((d) => readdirSync(d).map((f) => join(d, f))).find((f) => f.includes('ses_v2'));
  assert.ok(record, 'the V2 session was journaled');
  const saved = JSON.parse(readFileSync(record, 'utf8'));
  assert.equal(saved.target, 'opencode');
  assert.ok(saved.timestamps?.updatedAt);
});

test('ocv2-03 · knowledge: a V2 turn end (session.execution.succeeded) sends the docs to rsc/knowledge', async () => {
  const { wireKnowledge } = await import('../targets/knowledge-wiring.js');
  const tmp = realpathSync(mkdtempSync(join(tmpdir(), 'rsc-ocv2-k-')));
  const remote = join(tmp, 'remote.git');
  git(tmp, 'init', '-q', '--bare', '-b', 'main', remote);
  const cwd = join(tmp, 'eric');
  git(tmp, 'clone', '-q', remote, cwd);
  git(cwd, 'config', 'user.email', 'e@x'); git(cwd, 'config', 'user.name', 'Eric');
  writeFileSync(join(cwd, '.gitignore'), '.rsc/\n.opencode/\n');
  writeFileSync(join(cwd, '.rsc.json'), JSON.stringify({ version: 1, targets: ['opencode'] }));
  mkdirSync(join(cwd, '02-DOCS', 'wiki'), { recursive: true });
  writeFileSync(join(cwd, '02-DOCS', 'wiki', 'index.md'), '# wiki\n');
  git(cwd, 'add', '-A'); git(cwd, 'commit', '-q', '-m', 'seed'); git(cwd, 'push', '-q', 'origin', 'main');
  git(remote, 'symbolic-ref', 'HEAD', 'refs/heads/main');
  wireKnowledge('opencode', cwd);

  const saved = process.env.RSC_KNOWLEDGE_SYNC_FOREGROUND;
  process.env.RSC_KNOWLEDGE_SYNC_FOREGROUND = '1';
  try {
    const module = await load(join(cwd, '.opencode', 'plugins', 'rsc-knowledge.js'));
    shape(module, 'rsc.knowledge');
    const { ctx, hooks, emit } = v2Context(cwd);
    const cleanup = await module.default.setup(ctx);
    const event = { sessionID: 'ses_k', system: [] };
    await hooks.session.context(event);
    assert.match(event.system[0]?.text || '', /rsc\/knowledge/, 'the one-time announcement reaches the model');
    writeFileSync(join(cwd, '02-DOCS', 'wiki', 'desde-opencode.md'), 'hola\n');
    await emit('session.execution.succeeded', { sessionID: 'ses_k' });
    cleanup();
    assert.equal(git(remote, 'show', 'rsc/knowledge:02-DOCS/wiki/desde-opencode.md'), 'hola');
  } finally {
    if (saved === undefined) delete process.env.RSC_KNOWLEDGE_SYNC_FOREGROUND; else process.env.RSC_KNOWLEDGE_SYNC_FOREGROUND = saved;
  }
});

test('ocv2-04 · doctor names a V1-only rsc plugin as a problem, and a freshly wired one as fine', async () => {
  const { opencodePluginsOutdated } = await import('../scripts/doctor.js');
  const { wireUpdate } = await import('../targets/update-wiring.js');
  const root = mkdtempSync(join(tmpdir(), 'rsc-ocv2-d-'));
  mkdirSync(join(root, '.opencode', 'plugins'), { recursive: true });
  writeFileSync(join(root, '.opencode', 'plugins', 'rsc-update.js'),
    '// rsc-update:managed\nexport const RscUpdatePlugin = async () => ({});\n');
  writeFileSync(join(root, '.opencode', 'plugins', 'rsc-memory.js'), 'export const Mine = async () => ({});\n'); // not ours
  const before = opencodePluginsOutdated(root);
  assert.deepEqual(before.map((p) => p.path.split('/').pop()), ['rsc-update.js']);
  assert.match(before[0].action, /sync/);
  wireUpdate('opencode', root);
  assert.deepEqual(opencodePluginsOutdated(root), []);
});
