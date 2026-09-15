import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, rmSync, copyFileSync, symlinkSync, realpathSync, existsSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { wireHook, unwireHook } from '../targets/claude.js';
import { ignoreLocalState } from '../scripts/install-apply.js';
import { composeOffer } from '../targets/clone-bootstrap.mjs';

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

// ── the pin: AC#3 and AC#6 ───────────────────────────────────────────────────────────────────────
//
// `catalogVersion` is written into `.rsc.json` on every install and, measured across the whole repo,
// read by NOTHING. The README sells it as the thing that makes sharing mean something ("a teammate
// who clones in three months gets what you had, not what shipped since") and the decision log has it
// as a deliberate call. Today it is a number nothing acts on.
//
// This spec cannot fix every path that ignores it, but it owns the one path it creates: the sentence
// a person is about to run. `npx @ericrisco/rsc sync` resolves to the LATEST published package, so an
// offer phrased that way hands the clone whatever shipped since — the precise divergence the pin
// exists to prevent, introduced by the feature meant to honour it.

test('AC#6 — the offer tells you to install the PINNED version, never a floating one', () => {
  const offer = composeOffer({ state: 'declared', skills: ['orient'], own: [], catalogVersion: '1.3.6', targets: [] });
  assert.match(
    offer.text,
    /npx @ericrisco\/rsc@1\.3\.6 sync/,
    'the command a person runs must carry the pin; a bare `npx @ericrisco/rsc` resolves to latest',
  );
  assert.doesNotMatch(offer.text, /npx @ericrisco\/rsc@latest/, 'the offer must never send a clone to latest');
  assert.doesNotMatch(
    offer.text,
    /npx @ericrisco\/rsc sync/,
    'an unpinned command resolves to whatever shipped since, which is exactly the divergence the pin prevents',
  );
});

test('AC#6 — a newer release existing changes nothing about what the offer asks for', () => {
  const older = composeOffer({ state: 'declared', skills: ['orient'], own: [], catalogVersion: '1.2.2', targets: [] });
  assert.match(older.text, /@1\.2\.2/, 'the manifest decides, not the calendar');
  assert.doesNotMatch(older.text, /1\.3\.6|1\.4\.0/, 'no version the team did not choose may appear');
});

test('AC#3/#23 — with no pin recorded, the offer says so instead of inventing one', () => {
  const offer = composeOffer({ state: 'declared', skills: ['orient'], own: [], catalogVersion: null, targets: [] });
  assert.ok(!/@\d/.test(offer.text), 'a version must never be guessed when the manifest does not carry one');
  assert.match(offer.text, /no version pinned/i, 'the absence of a pin is itself worth saying');
});

test('AC#14 — the offer never promises to install what the team wrote by hand', () => {
  const offer = composeOffer({
    state: 'declared', skills: ['orient'], own: ['nuestra-skill'], catalogVersion: '1.3.6', targets: [],
  });
  assert.match(offer.text, /never overwritten/i, "own skills must be named as the one thing rsc will not touch");
});

// ── declining, and the difference between ignoring and declining ─────────────────────────────────
//
// Ignoring leaves the door open; declining shuts it, risk reminder included. The marker that
// remembers the "no" lives in the machine-local directory the three existing opt-outs already use
// (`.no-harness`, `.no-context7`, `.no-worktree-cleanup`), which is also why it cannot be committed:
// one person's "no" must never silence their whole team.

test('AC#4/#18 — a recorded "no" silences the offer completely', () => {
  const { root } = clonedWorkspace();
  mkdirSync(join(root, '.rsc'), { recursive: true });
  writeFileSync(join(root, '.rsc', '.no-harness'), '');
  const spoke = wiredCommands(root).filter(({ command }) => runWired(command, root).stdout.trim().length > 0);
  assert.deepEqual(spoke.map((s) => s.event), [], 'someone who declined must not be asked again');
});

test('AC#22 — the marker that remembers the "no" is machine-local, never committed', () => {
  // Asked of git itself rather than of the ignore pattern: reasoning about globs is how a rule ends
  // up believed and untrue. This repo ignores `.rsc/` wholesale, so the marker inside it cannot travel.
  const ignore = readFileSync(new URL('../.gitignore', import.meta.url), 'utf8');
  assert.match(ignore, /^\.rsc\/$/m, 'the opt-out lives under .rsc/, which must stay out of git');
});

// ── the 15 targets with no hooks ─────────────────────────────────────────────────────────────────
//
// Two mechanisms for one contract: the committed bootstrap covers the targets that inject hooks; the
// other fifteen read a markdown body instead, so for them the instruction has to live in the
// always-on surface — where it is paid for on EVERY turn, by everyone, including the overwhelming
// majority whose harness is fine. That is why it is three lines folded into the section that already
// recognises a broken harness, and not a section of its own, and why the ceiling below is a test
// rather than an intention. The repo's own scar is 207 KB paid per turn (P5).

test('AC#10 — the always-on surface tells the 15 hookless targets the same three things', () => {
  // Normalised: an assertion about prose must not depend on where a line happened to wrap.
  const body = readFileSync(new URL('../skills/suggest/SKILL.md', import.meta.url), 'utf8').replace(/\s+/g, ' ');
  assert.match(body, /catalogVersion in \.rsc\.json/, 'it must name the pin as the version to install');
  assert.match(body, /never.*@latest/i, 'it must forbid the floating version explicitly');
  assert.match(body, /keep working either way/i, 'it must say the offer does not hold up the turn');
  assert.match(body, /silence is not a no/i, 'ignoring and declining are different, and must be said');
});

test('AC#19 — the always-on body stays under its declared ceiling', () => {
  const bytes = readFileSync(new URL('../skills/suggest/SKILL.md', import.meta.url)).length;
  // The body measured 7183 B before this feature. The clone guidance cost 427 B raw; three genuinely
  // redundant passages paid back 359 of them (a symptom bullet the new one states better and acts on,
  // a closing line the bullets already said, and one of two examples making the same point). Net
  // +99 B, per turn, forever, and that is the honest number — the alternative was cutting prose that
  // carries weight to hit a round figure I picked myself, which is ceremony wearing P5's clothes.
  //
  // What matters more than the 99 B: before this, NOTHING measured this file at all. The ceiling is
  // the point. The next person who adds "just a couple of lines" to a surface everyone pays on every
  // turn now argues with a failing test instead of a habit.
  assert.ok(bytes <= 7282, `always-on body is ${bytes} B, over the 7282 B ceiling — it is paid every turn`);
});

// ── AC#25: the README has to describe what the product does, not what it meant to do ─────────────
//
// It carried a straight contradiction: the sharing section told a teammate to run
// `npx @ericrisco/rsc@latest sync`, and the very next paragraph promised "same skills, same version
// — .rsc.json pins the catalog". `@latest` is the opposite of a pin. One of the two had to go, and
// the code says which: measured across the repo, `catalogVersion` had no consumer at all.

test('AC#25 — the README does not send a clone to @latest while promising a pin', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  const sharing = readme.slice(readme.indexOf('Whoever clones'), readme.indexOf('**Own skills.**'));
  assert.ok(sharing.length > 0, 'the sharing section must still exist');
  assert.doesNotMatch(
    sharing,
    /@ericrisco\/rsc@latest sync/,
    'telling a teammate to sync at @latest contradicts the pin the same section promises',
  );
  assert.match(sharing, /catalogVersion/, 'the command must show where the version comes from');
});

test('AC#25 — the README describes the clone by symptom, and says the assistant announces it', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8').replace(/\s+/g, ' ');
  assert.match(readme, /tells you, in the first message/i, 'a clone no longer needs the symptom recognised by hand');
  assert.match(readme, /naming the pinned version/i, 'what it hands you must be the pinned command');
});

// ── the other half of the ask: "si no está actualizado que lo actualice" (AC#7, #14) ─────────────
//
// Until now the bootstrap knew two states, mounted and not, and a `git pull` that brings a changed
// manifest onto a mounted harness landed in "mounted" and went by in silence. That is half the
// feature missing: building a clone worked, converging a stale one did not.
//
// `.rsc/skills/<id>` is the canonical location and it is the same on every assistant — the per-target
// directories are links into it — so one rule covers all seventeen without teaching this file any
// target's layout.

function mountedWithSkills(installed, declared, own = []) {
  const root = mkdtempSync(join(tmpdir(), 'rsc-diverge-'));
  mkdirSync(join(root, '.rsc', 'skills'), { recursive: true });
  mkdirSync(join(root, '.claude'), { recursive: true });
  for (const id of installed) mkdirSync(join(root, '.rsc', 'skills', id), { recursive: true });
  writeFileSync(join(root, '.rsc', 'probe.mjs'), 'process.stdout.write("DELEGATE SPOKE\\n");');
  writeFileSync(join(root, '.rsc.json'), JSON.stringify({ version: 1, skills: declared, ownSkills: own, catalogVersion: '1.3.6' }));
  copyFileSync(new URL('../targets/clone-bootstrap.mjs', import.meta.url), join(root, '.claude', 'rsc-bootstrap.mjs'));
  return root;
}

test('AC#7 — a manifest that arrived by git pull and no longer matches is announced', () => {
  const root = mountedWithSkills(['orient'], ['orient', 'verify', 'ship']);
  const { stdout } = runBootstrap(root, 'announce', join(root, '.rsc', 'probe.mjs'));
  assert.match(stdout, /verify/, 'the skills that are declared and missing must be named');
  assert.match(stdout, /ship/, 'all of them, not just the first');
  assert.match(stdout, /@ericrisco\/rsc@1\.3\.6 sync/, 'converging uses the pinned version, like building does');
  assert.match(stdout, /DELEGATE SPOKE/, 'a harness that works must keep working while it is out of date');
});

test('AC#7 — a harness that matches its manifest still says nothing at all', () => {
  const root = mountedWithSkills(['orient', 'verify'], ['orient', 'verify']);
  const { stdout } = runBootstrap(root, 'announce', join(root, '.rsc', 'probe.mjs'));
  assert.equal(stdout, 'DELEGATE SPOKE\n', 'agreement is silence; anything else is noise everyone pays for');
});

test('AC#14 — a missing own skill is named as the team\'s, and never offered from the catalog', () => {
  const root = mountedWithSkills(['orient'], ['orient'], ['nuestra-skill']);
  const { stdout } = runBootstrap(root, 'announce', join(root, '.rsc', 'probe.mjs'));
  assert.match(stdout, /nuestra-skill/, 'it must be named');
  assert.match(stdout, /written by the team|git/i, 'and named as something git brings, not something rsc installs');
  // Position is not the claim. A mutant that moved the own skills above the command and said "and the
  // sync above brings them too" passed the positional check — so assert what the text CLAIMS instead:
  // that no command is presented as the thing that delivers them.
  const flat = stdout.replace(/\s+/g, ' ');
  assert.match(
    flat,
    /nuestra-skill[^.]*never installs or overwrites them/i,
    'the sentence that names them must be the same sentence that says rsc will not install them',
  );
  assert.doesNotMatch(
    flat,
    /brings them too|sync above brings/i,
    'nothing may claim a command delivers a skill whose version is the commit',
  );
});

test('AC#16/#17 — a protected action reminds once more, and only once more', () => {
  const { root } = clonedWorkspace();
  const target = join(root, '.rsc', 'danger-guard.mjs');
  const shellCall = JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git commit -m "x"' } });
  const call = () => spawnSync('node', [join(root, '.claude', 'rsc-bootstrap.mjs'), 'guard', root, target], {
    cwd: root, input: shellCall, encoding: 'utf8',
  }).stdout ?? '';

  const first = call();
  assert.match(first, /commit/i, 'the reminder must name the protection that is missing, not the harness in the abstract');
  assert.equal(call(), '', 'a second reminder would be nagging; two offers per session is the whole budget');
});

test('AC#16 — an ordinary shell call is never interrupted', () => {
  const { root } = clonedWorkspace();
  const target = join(root, '.rsc', 'danger-guard.mjs');
  const r = spawnSync('node', [join(root, '.claude', 'rsc-bootstrap.mjs'), 'guard', root, target], {
    cwd: root, input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'ls -la' } }), encoding: 'utf8',
  });
  assert.equal(r.stdout, '', 'listing a directory is not a protected action');
  assert.notEqual(r.status, 2, 'and nothing here may ever deny a tool call');
});

test('AC#24 — the offer tells an unattended agent not to install on its own', () => {
  const offer = composeOffer({ state: 'declared', skills: ['orient'], own: [], catalogVersion: '1.3.6', targets: [] });
  assert.match(offer.text, /nobody to ask/i, 'CI and unattended agents have no user to consent, and must not consent for them');
});

// ── AC#13: the half-mounted harness ──────────────────────────────────────────────────────────────
//
// The dangerous outcome of an interrupted install is not failure, it is a directory that LOOKS
// finished. `sync` needs no network of its own — it copies from the package npx already fetched — so
// a lost connection means nothing was installed rather than half of it. What can still go wrong is
// an interruption partway, and the state that leaves has to be recognisable as incomplete the next
// time someone opens the project, not mistaken for health.

test('AC#13 — a half-finished mount is recognised as incomplete, never as healthy', () => {
  // Hooks landed, skills did not: exactly what an interrupted install leaves behind.
  const root = mountedWithSkills(['orient'], ['orient', 'verify', 'ship']);
  const { stdout } = runBootstrap(root, 'announce', join(root, '.rsc', 'probe.mjs'));
  assert.notEqual(stdout, 'DELEGATE SPOKE\n', 'a half-mounted harness must not pass as a healthy one');
  assert.match(stdout, /verify|ship/, 'and it must name what is still missing');
});

test('AC#13 — skills landed but the hooks did not is ALSO not healthy', () => {
  const root = mountedWithSkills(['orient'], ['orient']);
  rmSync(join(root, '.rsc', 'probe.mjs'), { force: true });
  const { stdout } = runBootstrap(root, 'announce', join(root, '.rsc', 'probe.mjs'));
  assert.match(stdout, /not built on this machine/i, 'the offer must come back rather than the turn passing in silence');
});

// ── C1: the over-blocking failure, caught by a refuter and not by any of the tests above ─────────
//
// Own skills are written by the team and live where that assistant keeps skills —
// `.claude/skills/<name>`, which is what this repo's own `divergence()` checks. They are NOT in
// `.rsc/skills/`: that directory is filled by `ensureBase`, which copies from the CATALOG, and an own
// skill is by definition not in the catalog. So looking for them there made `ownMissing` permanently
// non-empty, and a perfectly healthy project printed a "you are out of date" notice every single
// session, offering a `sync` that could never clear it.
//
// That is the whole over-blocking pattern in one bug: a gate that fires on correct work, prescribes a
// remedy that does nothing, and therefore gets muted — taking the real warnings with it.

function projectWithOwnSkill({ ownPresent }) {
  const root = mkdtempSync(join(tmpdir(), 'rsc-own-'));
  mkdirSync(join(root, '.rsc', 'skills', 'orient'), { recursive: true });
  mkdirSync(join(root, '.claude'), { recursive: true });
  if (ownPresent) {
    mkdirSync(join(root, '.claude', 'skills', 'nuestra'), { recursive: true });
    writeFileSync(join(root, '.claude', 'skills', 'nuestra', 'SKILL.md'), '# nuestra\n');
  }
  writeFileSync(join(root, '.rsc', 'probe.mjs'), 'process.stdout.write("DELEGATE SPOKE\\n");');
  writeFileSync(join(root, '.rsc.json'), JSON.stringify({
    version: 1, targets: ['claude'], skills: ['orient'], ownSkills: ['nuestra'], catalogVersion: '1.3.6',
  }));
  copyFileSync(new URL('../targets/clone-bootstrap.mjs', import.meta.url), join(root, '.claude', 'rsc-bootstrap.mjs'));
  return root;
}

test('C1 — a healthy project that declares an own skill says NOTHING', () => {
  const root = projectWithOwnSkill({ ownPresent: true });
  const { stdout } = runBootstrap(root, 'announce', join(root, '.rsc', 'probe.mjs'));
  assert.equal(
    stdout,
    'DELEGATE SPOKE\n',
    'an own skill that is present must not be reported as missing — it never lives in .rsc/skills/, ' +
      'so looking for it there nags every session about work that is already correct',
  );
});

test('C1 — an own skill that is genuinely absent is still named', () => {
  const root = projectWithOwnSkill({ ownPresent: false });
  const { stdout } = runBootstrap(root, 'announce', join(root, '.rsc', 'probe.mjs'));
  assert.match(stdout, /nuestra/, 'a real absence must still be reported, or the fix has just muted the check');
});

// ── I1: a manifest that is valid JSON but the wrong shape ────────────────────────────────────────
//
// `readManifest` promised to turn a corrupt manifest into a state rather than a crash, and only ever
// delivered that for JSON syntax. A `skills: [{id:"orient"}]` parses fine and then throws inside
// `join()` — and because that happens BEFORE the delegate runs, the entire always-on layer (suggest,
// session memory, orientation) silently stopped on a mounted, healthy harness. That is the same
// failure the symlink fix was written to prevent, arriving through a different door.

for (const [label, skills] of [
  ['objects', [{ id: 'orient' }]],
  ['nulls', [null]],
  ['numbers', [7]],
  ['nested arrays', [['orient']]],
]) {
  test(`I1 — a manifest with ${label} instead of ids never stops the harness`, () => {
    const root = mountedWithSkills(['orient'], ['orient']);
    writeFileSync(join(root, '.rsc.json'), JSON.stringify({ version: 1, skills, catalogVersion: '1.3.6' }));
    const { stdout, stderr } = runBootstrap(root, 'announce', join(root, '.rsc', 'probe.mjs'));
    assert.match(stdout, /DELEGATE SPOKE/, 'the always-on layer must keep running whatever the manifest says');
    assert.doesNotMatch(stderr, /must be of type string|instance of Object/, 'and no raw runtime error may reach the user');
  });
}

// ── I2/I3/I4: the file travels, is accounted for, and speaks on a channel that is heard ──────────

test('I2 — the risk reminder uses the envelope PreToolUse actually surfaces', () => {
  const { root } = clonedWorkspace();
  const out = spawnSync('node', [join(root, '.claude', 'rsc-bootstrap.mjs'), 'guard', root, join(root, '.rsc', 'danger-guard.mjs')], {
    cwd: root, input: JSON.stringify({ tool_name: 'Bash', tool_input: { command: 'git commit -m x' } }), encoding: 'utf8',
  }).stdout;
  // Bare stdout from a PreToolUse hook is transcript-only; every sibling guard in this repo wraps its
  // message in this envelope, and a message nobody sees is the same as no message.
  const payload = JSON.parse(out);
  assert.equal(payload.hookSpecificOutput.hookEventName, 'PreToolUse');
  assert.match(payload.hookSpecificOutput.additionalContext, /about to commit/i);
  assert.ok(!('permissionDecision' in payload.hookSpecificOutput), 'informing is not denying');
});

test('I3 — the committed bootstrap is reported as written, and removed on unwire', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-registry-'));
  mkdirSync(join(root, '.claude', 'skills', 'suggest'), { recursive: true });
  writeFileSync(join(root, '.claude', 'skills', 'suggest', 'SKILL.md'), SUGGEST_BODY);
  writeFileSync(join(root, '.claude', 'settings.json'), '{}\n');
  const paths = {
    projectRoot: root, hookTarget: join(root, '.claude', 'settings.json'),
    skillDir: (id) => join(root, '.claude', 'skills', id),
  };
  const written = wireHook(paths, join(root, '.claude', 'skills', 'suggest', 'SKILL.md'));
  assert.ok(
    written.some((p) => p.includes('rsc-bootstrap')),
    'a file rsc writes but does not report is absent from the backup, so `restore` cannot bring it back',
  );
  unwireHook(paths);
  assert.ok(!existsSync(join(root, '.claude', 'rsc-bootstrap.mjs')), 'uninstall must not orphan an executable in a committed tree');
});

test('I4 — the gitignore rsc writes protects the one file the feature depends on', () => {
  const root = mkdtempSync(join(tmpdir(), 'rsc-ignore-'));
  mkdirSync(join(root, '.git'), { recursive: true });
  // A project that followed rsc's own example and ignored the assistant directory wholesale.
  writeFileSync(join(root, '.gitignore'), '.claude/\n');
  ignoreLocalState(root, 'claude');
  const gi = readFileSync(join(root, '.gitignore'), 'utf8');
  assert.match(
    gi,
    /^!\.claude\/rsc-bootstrap\.mjs$/m,
    'without a negation, a repo that ignores .claude/ drops the bootstrap and the whole feature dies silently there',
  );
});

test('I4 — the README names the bootstrap among the things to commit', () => {
  const readme = readFileSync(new URL('../README.md', import.meta.url), 'utf8');
  assert.match(readme, /rsc-bootstrap\.mjs/, 'the file the feature depends on must be named where sharing is documented');
});
