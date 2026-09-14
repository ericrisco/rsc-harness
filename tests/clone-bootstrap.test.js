import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, copyFileSync, symlinkSync, realpathSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { wireHook } from '../targets/claude.js';

// What a clone actually is, measured rather than imagined: `git clone` of an equipped repo brings
// `.rsc.json` and the committed wiring, and brings NOTHING the wiring invokes — `.rsc/` is ignored
// by design, because its contents are machine-shaped (symlinks here, real copies on Windows).
//
// So the first session in a clone runs six wired hooks against six files that do not exist. What
// the person sees is not a warning, it is the module loader's stack trace — and because three of
// the six are PreToolUse guards on the shell tool, they see it again on every shell call for the
// whole session. That is worse than having no harness: "no harness" reads as not set up, this reads
// as broken and noisy, which is what makes people uninstall instead of finish installing.
//
// These tests build that state on purpose: wire a real harness, then delete exactly what git does
// not carry. They must be able to FAIL here, and today they do — every one of the six dumps.

const SUGGEST_BODY = '# suggest\n\nalways-on body.\n';

/** An equipped project, then stripped to exactly what `git clone` would hand you. */
function clonedWorkspace() {
  const root = mkdtempSync(join(tmpdir(), 'rsc-clone-'));
  mkdirSync(join(root, '.claude', 'skills', 'suggest'), { recursive: true });
  writeFileSync(join(root, '.claude', 'skills', 'suggest', 'SKILL.md'), SUGGEST_BODY);
  writeFileSync(join(root, '.claude', 'settings.json'), '{}\n');
  writeFileSync(
    join(root, '.rsc.json'),
    JSON.stringify({ version: 1, targets: ['claude'], skills: ['orient'], catalogVersion: '1.3.6' }, null, 2),
  );

  const paths = {
    projectRoot: root,
    hookTarget: join(root, '.claude', 'settings.json'),
    skillDir: (id) => join(root, '.claude', 'skills', id),
  };
  wireHook(paths, join(root, '.claude', 'skills', 'suggest', 'SKILL.md'));

  // The clone: git carries the committed wiring, never the machine-shaped directory it points into.
  rmSync(join(root, '.rsc'), { recursive: true, force: true });
  return { root, paths };
}

/** Every command the committed wiring tells the client to run, with the client's own variable resolved. */
function wiredCommands(root) {
  const settings = JSON.parse(readFileSync(join(root, '.claude', 'settings.json'), 'utf8'));
  const out = [];
  for (const [event, entries] of Object.entries(settings.hooks ?? {})) {
    for (const entry of entries) {
      for (const hook of entry.hooks ?? []) {
        if (typeof hook.command === 'string') out.push({ event, command: hook.command });
      }
    }
  }
  return out.map(({ event, command }) => ({
    event,
    command: command.replaceAll('${CLAUDE_PROJECT_DIR}', root),
  }));
}

/** Run one wired command the way the client would, and report what the user would actually see. */
function runWired(command, root) {
  const r = spawnSync(command, { shell: true, cwd: root, input: '{}', encoding: 'utf8' });
  return { stdout: r.stdout ?? '', stderr: r.stderr ?? '', status: r.status };
}

// A stack trace has a shape, and naming the shape is what keeps this test honest: it must not pass
// merely because a message changed wording.
const DUMP_MARKERS = [
  'Cannot find module',
  'node:internal/modules',
  'at Module._resolveFilename',
  'throw err;',
  'ERR_MODULE_NOT_FOUND',
];

function dumpFoundIn(text) {
  return DUMP_MARKERS.filter((m) => text.includes(m));
}

test('a clone carries the wiring and not what it invokes — the state under test is real', () => {
  const { root } = clonedWorkspace();
  const commands = wiredCommands(root);
  assert.ok(commands.length >= 6, `expected the six wired hooks, got ${commands.length}`);
  for (const { command } of commands) {
    assert.ok(
      command.includes('.rsc/') || command.includes('.rsc\\'),
      `a wired command points somewhere git does not carry: ${command}`,
    );
  }
});

test('AC#9 — no committed hook dumps a stack trace in a clone', () => {
  const { root } = clonedWorkspace();
  const offenders = [];
  for (const { event, command } of wiredCommands(root)) {
    const { stdout, stderr } = runWired(command, root);
    const hits = dumpFoundIn(stdout + stderr);
    if (hits.length) offenders.push(`${event}: ${hits.join(', ')}`);
  }
  assert.deepEqual(
    offenders,
    [],
    `these hooks dump a stack trace instead of saying something:\n  ${offenders.join('\n  ')}`,
  );
});

test('AC#9 — no committed hook blocks the turn in a clone', () => {
  const { root } = clonedWorkspace();
  const blocking = [];
  for (const { event, command } of wiredCommands(root)) {
    const { status } = runWired(command, root);
    // 2 is the deny code for a PreToolUse hook: a missing harness must never deny the user's tool.
    if (status === 2) blocking.push(`${event} denied the tool call (exit 2)`);
  }
  assert.deepEqual(blocking, [], blocking.join('\n'));
});

// ── the tests above assert ABSENCES, and absences are what an empty file satisfies best ──────────
//
// A refuter proved it: with `delegate()` stubbed to a no-op, with the whole entrypoint deleted, and
// with `composeOffer()` returning '', all three still passed. The suite would have gone green
// against an EMPTY clone-bootstrap.mjs. That is P2 pointed at my own work — a gate that cannot fail
// is worse than no gate, because it reports safety it never checked.
//
// What follows asserts PRESENCE: that the healthy path really delegates, that argv survives
// byte-for-byte, that the offer is really produced, and that a symlinked project path does not turn
// all seven hooks into silent no-ops.

const PROBE = [
  'import { writeFileSync } from "node:fs";',
  'import { pathToFileURL } from "node:url";',
  'import { realpathSync } from "node:fs";',
  // The delegate's own identity check, reproduced exactly as gitmoji-guard does it. If the bootstrap
  // hands over a raw path where the loader resolved one, this prints the failure instead of hiding it.
  'const isMain = import.meta.url === pathToFileURL(process.argv[1]).href;',
  'writeFileSync(process.env.PROBE_OUT, JSON.stringify({ argv: process.argv.slice(1), isMain }));',
  'process.stdout.write("DELEGATE SPOKE\\n");',
].join('\n');

/** An equipped project whose harness IS mounted, with a probe standing in for a real hook script. */
function mountedWorkspace({ symlinked = false } = {}) {
  const real = mkdtempSync(join(tmpdir(), 'rsc-mounted-'));
  mkdirSync(join(real, '.rsc'), { recursive: true });
  mkdirSync(join(real, '.claude'), { recursive: true });
  writeFileSync(join(real, '.rsc', 'probe.mjs'), PROBE);
  writeFileSync(join(real, '.rsc.json'), JSON.stringify({ version: 1, skills: ['orient'], catalogVersion: '1.3.6' }));
  copyFileSync(new URL('../targets/clone-bootstrap.mjs', import.meta.url), join(real, '.claude', 'rsc-bootstrap.mjs'));

  let root = real;
  if (symlinked) {
    // The ordinary layout that breaks a naive identity check: `~/code -> /Volumes/external/code`.
    const link = join(mkdtempSync(join(tmpdir(), 'rsc-link-')), 'proj');
    symlinkSync(real, link);
    root = link;
  }
  return { root, real };
}

function runBootstrap(root, mode, target, extra = [], env = {}) {
  const bootstrap = join(root, '.claude', 'rsc-bootstrap.mjs');
  const r = spawnSync('node', [bootstrap, mode, root, target, ...extra], {
    cwd: root, input: '{}', encoding: 'utf8', env: { ...process.env, ...env },
  });
  return { stdout: r.stdout ?? '', stderr: r.stderr ?? '', status: r.status };
}

test('AC#5/#19 — a mounted harness delegates, and the bootstrap itself says NOTHING', () => {
  const { root } = mountedWorkspace();
  const out = join(root, 'probe.json');
  const direct = spawnSync('node', [join(root, '.rsc', 'probe.mjs'), 'a', 'b'], {
    cwd: root, encoding: 'utf8', env: { ...process.env, PROBE_OUT: out },
  });
  const viaBoot = runBootstrap(root, 'quiet', join(root, '.rsc', 'probe.mjs'), ['a', 'b'], { PROBE_OUT: out });

  assert.equal(viaBoot.stdout, 'DELEGATE SPOKE\n', 'the delegate must run');
  assert.equal(
    viaBoot.stdout,
    direct.stdout,
    'the bootstrap added output of its own — the healthy case must cost zero bytes (P5)',
  );
});

test('the delegate receives byte-identical argv, and still believes it is the main module', () => {
  const { root, real } = mountedWorkspace();
  const target = join(root, '.rsc', 'probe.mjs');
  const out = join(root, 'probe.json');

  spawnSync('node', [target, 'first', 'second'], { cwd: root, encoding: 'utf8', env: { ...process.env, PROBE_OUT: out } });
  const wanted = JSON.parse(readFileSync(out, 'utf8'));

  runBootstrap(root, 'quiet', target, ['first', 'second'], { PROBE_OUT: out });
  const got = JSON.parse(readFileSync(out, 'utf8'));

  assert.deepEqual(got.argv.slice(1), wanted.argv.slice(1), 'the delegate lost or gained an argument');
  assert.ok(got.isMain, 'the delegate no longer recognises itself as the main module — its main block will not run');
  assert.ok(got.argv[0].startsWith(realpathSync(real)), 'argv[1] must be the resolved path, or the delegate cannot self-identify');
});

test('C-1 — a symlink in the project path must not turn every hook into a silent no-op', () => {
  const { root } = mountedWorkspace({ symlinked: true });
  const out = join(root, 'probe.json');
  const viaBoot = runBootstrap(root, 'quiet', join(root, '.rsc', 'probe.mjs'), [], { PROBE_OUT: out });
  assert.equal(
    viaBoot.stdout,
    'DELEGATE SPOKE\n',
    'reached through a symlinked path the bootstrap did nothing at all — every hook, including the danger guard, silently stopped firing',
  );
});

test('AC#1/#21 — an unmounted clone gets the offer, and it names the exact package and version', () => {
  const { root } = clonedWorkspace();
  const { stdout } = runWired(
    wiredCommands(root).find((c) => c.event === 'SessionStart').command,
    root,
  );
  assert.ok(stdout.includes('@ericrisco/rsc@1.3.6'), `the offer must name what would be installed; got:\n${stdout}`);
  assert.ok(/not built on this machine/i.test(stdout), 'the offer must name the symptom');
  assert.ok(stdout.includes('sync'), 'the offer must carry its own way out (P6)');
});

test('AC#2 — exactly one hook speaks, and none of them writes anything first', () => {
  const { root } = clonedWorkspace();
  const spoke = wiredCommands(root).filter(({ command }) => runWired(command, root).stdout.trim().length > 0);
  assert.equal(spoke.length, 1, `${spoke.length} hooks spoke; the person must be told once, not seven times`);
  assert.equal(spoke[0].event, 'SessionStart');
  assert.ok(!existsSync(join(root, '.rsc')), 'something was written before anyone consented');
});

test('AC#20 — an unreadable manifest is reported, and nothing is offered', () => {
  const { root } = clonedWorkspace();
  writeFileSync(join(root, '.rsc.json'), '{ this is not json');
  const { stdout } = runWired(wiredCommands(root).find((c) => c.event === 'SessionStart').command, root);
  assert.ok(/cannot be read/i.test(stdout), 'an unreadable manifest must be named, not guessed at');
  assert.ok(!stdout.includes('WOULD INSTALL'), 'nothing may be offered when the declaration cannot be read');
});

test('I-3 — a delegate that crashes is not swallowed in silence, and still does not block', () => {
  const { root } = mountedWorkspace();
  const broken = join(root, '.rsc', 'broken.mjs');
  writeFileSync(broken, 'throw new Error("guard is broken");');
  const { stderr, status } = runBootstrap(root, 'quiet', broken);
  assert.notEqual(status, 2, 'a crashing hook must never deny the user their tool');
  assert.match(stderr, /hook failed and was ignored/, 'a real crash inside a guard must not vanish — that is how a guard stops guarding unnoticed');
});
