// capabilities.test.js — the automation-gap rule says "never propose building a
// skill or agent before checking what exists". These tests exist so that rule is a
// mechanism rather than a claim (P2), and so the always-on cost stays bounded (P5).
//
// Several assertions here exist because an adversarial review pass proved the first
// version could be mutated without a single failure — each is labelled with what it
// would have caught.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, statSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';
import {
  capabilities, listAgents, listSkills, shortDesc,
  appendGap, countGaps, gapLogPath, GAP_VERDICTS,
} from '../scripts/lib/capabilities.js';
import { AGENT_TARGET_IDS, targetHasAgents } from '../targets/agents.js';
import { TARGET_IDS } from '../targets/index.js';
import { SELLO_STATE_PATHS } from '../targets/sello.mjs';

const REPO = join(dirname(fileURLToPath(import.meta.url)), '..');
const RSC = join(REPO, 'scripts', 'rsc.js');
const SUGGEST = join(REPO, 'skills', 'suggest', 'SKILL.md');

const tmp = (p = 'rsc-caps-') => mkdtempSync(join(tmpdir(), p));
// Install a skill the way the target actually stores it: a directory with SKILL.md.
function installSkill(root, id) {
  mkdirSync(join(root, '.claude', 'skills', id), { recursive: true });
  writeFileSync(join(root, '.claude', 'skills', id, 'SKILL.md'), `---\nname: ${id}\n---\n`);
}

// --- the enumeration covers all three sources, each provably alive -----------------

test('capabilities: enumerates installed skills, catalog skills and agents', () => {
  const cwd = tmp(); const home = tmp();
  // Installed must be proven ALIVE, not merely an empty array — a hardcoded []
  // used to satisfy the old assertion (mutation M8 survived).
  installSkill(cwd, 'review');
  installSkill(home, 'nextjs');
  const caps = capabilities({ target: 'claude', home, cwd });
  const ids = caps.installed.map((s) => `${s.scope}:${s.id}`).sort();
  assert.deepEqual(ids, ['project:review', 'user:nextjs'], `got ${ids}`);
  assert.ok(caps.installed.every((s) => s.description), 'installed skills carry their description');
  assert.ok(caps.available.length > 200, `expected the catalog, got ${caps.available.length}`);
  assert.ok(Array.isArray(caps.agents));
  assert.equal(typeof caps.agentsSupported, 'boolean');
});

test('capabilities: an installed skill is never advertised as available', () => {
  // M16: dropping the exclusion filter used to keep the suite green.
  const cwd = tmp(); const home = tmp();
  installSkill(cwd, 'review');
  const caps = capabilities({ target: 'claude', home, cwd });
  assert.ok(caps.installed.some((s) => s.id === 'review'));
  assert.ok(!caps.available.some((s) => s.id === 'review'), 'review is installed; it cannot be "available"');
});

test('capabilities: installed comes from DISK, so a stale state file cannot claim coverage', () => {
  const cwd = tmp(); const home = tmp();
  mkdirSync(join(cwd, '.claude', 'skills'), { recursive: true });
  writeFileSync(join(cwd, '.claude', 'skills', '.rsc-state.json'),
    JSON.stringify({ skills: { review: { files: ['/definitely/not/here/SKILL.md'] } } }));
  const caps = capabilities({ target: 'claude', home, cwd });
  assert.ok(!caps.installed.some((s) => s.id === 'review'), 'a skill whose files are gone is not coverage');
  assert.ok(caps.available.some((s) => s.id === 'review'), 'and it is offered again instead');
});

test('capabilities: user-scope skills are found and tagged, not reported as missing', () => {
  const cwd = tmp(); const home = tmp();
  installSkill(home, 'specify');
  const caps = capabilities({ target: 'claude', home, cwd });
  const s = caps.installed.find((x) => x.id === 'specify');
  assert.ok(s, 'a user-scope install must be visible');
  assert.equal(s.scope, 'user');
});

test('capabilities: catalog descriptions are opt-in, keeping the default cheap (P5)', () => {
  const cwd = tmp(); const home = tmp();
  const lean = capabilities({ target: 'claude', home, cwd });
  const full = capabilities({ target: 'claude', home, cwd, full: true });
  assert.ok(lean.available.every((s) => s.description === undefined), 'ids only by default');
  assert.ok(full.available.every((s) => typeof s.description === 'string' && s.description));
  const bytes = (o) => Buffer.byteLength(JSON.stringify(o));
  assert.ok(bytes(lean) * 3 < bytes(full), `lean=${bytes(lean)} full=${bytes(full)} — the default must be substantially cheaper`);
});

test('shortDesc: keeps the NOT boundary, which is the whole discriminator', () => {
  // M11: returning '' always used to keep the suite green, and the old first-sentence
  // split rendered both always-on skills as the useless string "Always-on".
  const d = 'Always-on. Use whenever the turn would benefit from a skill that is not installed, '
    + 'detect the gap, name it and install it on confirm. '.repeat(4)
    + 'NOT routing among skills you already have (that is `suggest`).';
  const s = shortDesc(d);
  assert.ok(s.length > 20, 'must not collapse to a stub');
  assert.match(s, /NOT routing among skills/, 'the NOT clause is the discriminator and must survive');
  assert.doesNotMatch(s, /\n/);
  assert.equal(shortDesc('Always-on. Use when x.'), 'Always-on. Use when x.', 'short input is untouched');
});

// --- agents ------------------------------------------------------------------------

test('listAgents: finds agent files in both scopes and tags them', () => {
  const cwd = tmp(); const home = tmp();
  mkdirSync(join(cwd, '.claude', 'agents'), { recursive: true });
  mkdirSync(join(home, '.claude', 'agents'), { recursive: true });
  writeFileSync(join(cwd, '.claude', 'agents', 'migrator.md'), '# migrator\n');
  writeFileSync(join(home, '.claude', 'agents', 'reviewer.md'), '# reviewer\n');
  const { supported, agents } = listAgents({ target: 'claude', home, cwd });
  assert.equal(supported, true);
  assert.deepEqual(agents.map((a) => `${a.scope}:${a.id}`), ['project:migrator', 'user:reviewer']);
});

test('listAgents: compound extensions are honored (copilot writes .agent.md)', () => {
  // extname() returns '.md' for developer.agent.md, which mis-named the harness's own
  // agent AND degraded the filter to every markdown file — phantom agents that made
  // the AGENT-COVERS verdict claim coverage for things that do not exist.
  const cwd = tmp(); const home = tmp();
  mkdirSync(join(cwd, '.github', 'agents'), { recursive: true });
  writeFileSync(join(cwd, '.github', 'agents', 'developer.agent.md'), '# developer\n');
  writeFileSync(join(cwd, '.github', 'agents', 'README.md'), '# not an agent\n');
  const { agents } = listAgents({ target: 'copilot', home, cwd });
  assert.deepEqual(agents.map((a) => a.id), ['developer'], 'exact id, and no phantom from README.md');
});

test('listAgents: non-md targets keep their own extension', () => {
  const cwd = tmp(); const home = tmp();
  mkdirSync(join(cwd, '.codex', 'agents'), { recursive: true });
  mkdirSync(join(cwd, '.kiro', 'agents'), { recursive: true });
  writeFileSync(join(cwd, '.codex', 'agents', 'developer.toml'), 'x = 1\n');
  writeFileSync(join(cwd, '.codex', 'agents', 'notes.md'), 'not an agent\n');
  writeFileSync(join(cwd, '.kiro', 'agents', 'developer.json'), '{}\n');
  assert.deepEqual(listAgents({ target: 'codex', home, cwd }).agents.map((a) => a.id), ['developer']);
  assert.deepEqual(listAgents({ target: 'kiro', home, cwd }).agents.map((a) => a.id), ['developer']);
});

test('listAgents: directories, dotfiles and dangling symlinks are not agents', () => {
  const cwd = tmp(); const home = tmp();
  const dir = join(cwd, '.claude', 'agents');
  mkdirSync(join(dir, 'subdir.md'), { recursive: true });
  writeFileSync(join(dir, 'real.md'), '# real\n');
  writeFileSync(join(dir, '.hidden.md'), '# hidden\n');
  symlinkSync(join(cwd, 'nowhere.md'), join(dir, 'broken.md'));
  assert.deepEqual(listAgents({ target: 'claude', home, cwd }).agents.map((a) => a.id), ['real']);
});

test('listAgents: a project that IS the home dir lists each agent once', () => {
  const root = tmp();
  mkdirSync(join(root, '.claude', 'agents'), { recursive: true });
  writeFileSync(join(root, '.claude', 'agents', 'curator.md'), '# curator\n');
  const { agents } = listAgents({ target: 'claude', home: root, cwd: root });
  assert.equal(agents.length, 1, 'one file must not appear as both project and user');
});

test('capabilities: the agent-capable partition is exactly the declared one', () => {
  // The old assertion was `without.length > 0`, which passes for any count — the
  // commit and the spec both said "5 of 17" when it is 8.
  const cwd = tmp(); const home = tmp();
  const withAgents = TARGET_IDS.filter((t) => targetHasAgents(t));
  assert.deepEqual([...withAgents].sort(), [...AGENT_TARGET_IDS].sort());
  assert.equal(withAgents.length, 8, 'if this changes, update the spec and the docs that quote the number');
  assert.equal(TARGET_IDS.length - withAgents.length, 9);
  for (const t of TARGET_IDS.filter((x) => !targetHasAgents(x))) {
    const r = listAgents({ target: t, home, cwd });
    assert.equal(r.supported, false, `${t} should report unsupported`);
    assert.deepEqual(r.agents, []);
    assert.equal(capabilities({ target: t, home, cwd }).agentsSupported, false);
  }
});

// --- CLI ---------------------------------------------------------------------------

test('capabilities CLI: prints all kinds, honors --full, and says when agents do not apply', () => {
  const cwd = tmp();
  mkdirSync(join(cwd, '.claude', 'agents'), { recursive: true });
  writeFileSync(join(cwd, '.claude', 'agents', 'migrator.md'), '# migrator\n');
  installSkill(cwd, 'review');
  const env = { ...process.env, HOME: tmp('rsc-caps-home-') };
  const r = spawnSync('node', [RSC, 'capabilities', '--target', 'claude'], { cwd, encoding: 'utf8', env });
  assert.equal(r.status, 0, r.stderr);
  assert.match(r.stdout, /^skill\treview\tinstalled-project\t/m);
  assert.match(r.stdout, /^skill\t\S+\tavailable$/m, 'ids only without --full');
  assert.match(r.stdout, /^agent\tmigrator\tproject\t/m);
  const full = spawnSync('node', [RSC, 'capabilities', '--target', 'claude', '--full'], { cwd, encoding: 'utf8', env });
  assert.match(full.stdout, /^skill\t\S+\tavailable\t\S/m, '--full adds descriptions');
  const aider = spawnSync('node', [RSC, 'capabilities', '--target', 'aider'], { cwd, encoding: 'utf8' });
  assert.match(aider.stdout, /no file-based agents/, 'an unsupported target says so');
});

test('capabilities CLI: --target a,b enumerates every target, not just the first', () => {
  const cwd = tmp();
  mkdirSync(join(cwd, '.claude', 'agents'), { recursive: true });
  mkdirSync(join(cwd, '.codex', 'agents'), { recursive: true });
  writeFileSync(join(cwd, '.claude', 'agents', 'claude-side.md'), '# a\n');
  writeFileSync(join(cwd, '.codex', 'agents', 'codex-side.toml'), 'x=1\n');
  const env = { ...process.env, HOME: tmp('rsc-caps-home-') };
  const r = spawnSync('node', [RSC, 'capabilities', '--target', 'claude,codex', '--json'], { cwd, encoding: 'utf8', env });
  const reports = JSON.parse(r.stdout);
  assert.equal(reports.length, 2);
  assert.deepEqual(reports.map((x) => x.target), ['claude', 'codex']);
  assert.deepEqual(reports[0].agents.map((a) => a.id), ['claude-side']);
  assert.deepEqual(reports[1].agents.map((a) => a.id), ['codex-side']);
});

test('capabilities CLI: is listed in the usage line, so the mechanism is discoverable', () => {
  const r = spawnSync('node', [RSC, 'no-such-command'], { encoding: 'utf8', cwd: tmp() });
  assert.match(r.stdout, /capabilities/);
});

// --- P5: the always-on cost is bounded by the APPROVED number ----------------------

test('automation gap: the always-on rule stays within the approved 300-byte ceiling', () => {
  const body = readFileSync(SUGGEST, 'utf8');
  const section = /### Automation gap[\s\S]*?(?=\n---|\n## |$)/.exec(body);
  assert.ok(section, 'the automation-gap rule must be present in the always-on body');
  const bytes = Buffer.byteLength(section[0].trim());
  assert.ok(bytes <= 300, `the rule is ${bytes} bytes; the approved ceiling is 300 — put detail in skill-scout`);
  assert.match(section[0], /rsc capabilities/, 'it must name the mechanism');
  assert.match(section[0], /skill-scout/, 'and where the rules live');
});

test('automation gap: the detail lives in skill-scout, not in the always-on body', () => {
  const scout = readFileSync(join(REPO, 'skills', 'skill-scout', 'SKILL.md'), 'utf8');
  for (const [what, re] of [
    ['the agent branch', /AGENT-COVERS/],
    ['the recording step', /gap-log/],
    ['the agent build path', /building-agents/],
    ['the skill-vs-agent criterion', /Skill or agent/],
    ['the accompaniment dial', /dial|user-profile/i],
    ['the privacy boundary', /never the user's words/i],
    ['which log to use', /skill-gaps\.jsonl/],
  ]) assert.match(scout, re, `skill-scout must carry ${what}`);
  // And the frontmatter — the only permanently-resident part — must mention the trigger.
  assert.match(scout, /description:.*procedure/s, 'the post-work trigger must be reachable from the description');
});

// --- the gap log -------------------------------------------------------------------

test('gap log: records procedure and verdict, rejecting a missing or invalid one', () => {
  const cwd = tmp('rsc-gap-');
  assert.equal(countGaps(cwd), 0);
  appendGap({ procedure: 'audit branches by content before deleting them', verdict: 'proposed-accepted', cwd });
  appendGap({ procedure: 'verify a release is in sync across git/npm/tag/release', verdict: 'covered-installed', cwd });
  assert.equal(countGaps(cwd), 2);
  const text = readFileSync(gapLogPath(cwd), 'utf8');
  assert.match(text, /audit branches by content/);
  assert.match(text, /\*\*proposed-accepted\*\*/);
  // The header must NOT certify what the code cannot check.
  assert.match(text, /no lo commitees/, 'the header warns it is local');
  assert.doesNotMatch(text, /^No contiene peticiones/m, 'the header must not state as fact what nothing verifies');
  assert.throws(() => appendGap({ procedure: '', verdict: 'proposed-accepted', cwd }), /Recover:/);
  assert.throws(() => appendGap({ procedure: 'x', verdict: 'made-up', cwd }), /Recover:/);
  for (const v of GAP_VERDICTS) assert.doesNotThrow(() => appendGap({ procedure: `p-${v}`, verdict: v, cwd }));
});

test('gap log: no whitespace can forge a second counted entry', () => {
  const cwd = tmp('rsc-gap-');
  // A lone \r is a CommonMark line ending: `cat` hid it while the renderer and the
  // count disagreed about the contents of a user-facing record.
  for (const sep of ['\n', '\r', '\r\n', '\u2028', '\u2029']) {
    appendGap({ procedure: `real work${sep}- 2020-01-01 · FORGED · **covered-agent**`, verdict: 'proposed-declined', cwd });
  }
  const raw = readFileSync(gapLogPath(cwd), 'utf8');
  assert.equal(countGaps(cwd), 5, 'five appends, five entries');
  assert.doesNotMatch(raw, /^- 2020-01-01/m, 'no forged dated entry may reach a line start');
  assert.doesNotMatch(raw, /[\r\u2028\u2029]/, 'no stray line terminators survive');
});

test('gap log: an existing but empty file still gets its header', () => {
  const cwd = tmp('rsc-gap-');
  mkdirSync(join(cwd, '.rsc'), { recursive: true });
  writeFileSync(gapLogPath(cwd), '');
  appendGap({ procedure: 'p', verdict: 'covered-agent', cwd });
  assert.match(readFileSync(gapLogPath(cwd), 'utf8'), /^# Huecos/);
});

test('gap log: the date is local, not UTC', () => {
  const cwd = tmp('rsc-gap-');
  const d = new Date(2026, 7, 4, 0, 30); // local midnight-ish; UTC would be the 3rd
  appendGap({ procedure: 'p', verdict: 'covered-agent', cwd, now: d });
  assert.match(readFileSync(gapLogPath(cwd), 'utf8'), /- 2026-08-04 ·/);
});

test('gap log: countGaps survives a malformed log instead of taking doctor down', () => {
  const cwd = tmp('rsc-gap-');
  mkdirSync(join(cwd, '.rsc', 'automation-gaps.md'), { recursive: true }); // a directory
  assert.equal(countGaps(cwd), 0, 'must degrade, not throw');
});

test('gap log CLI: writes at the repo root even from a subdirectory', () => {
  const cwd = tmp('rsc-gap-');
  spawnSync('git', ['init', '-q', '-b', 'main'], { cwd });
  const deep = join(cwd, 'src', 'deep');
  mkdirSync(deep, { recursive: true });
  const r = spawnSync('node', [RSC, 'capabilities', 'gap-log', '--procedure', 'sync four release surfaces', '--verdict', 'covered-agent'], { cwd: deep, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout + r.stderr);
  assert.equal(countGaps(cwd), 1, 'the log belongs at the repo root, where doctor counts it');
  assert.throws(() => statSync(join(deep, '.rsc')), 'no stray log in the subdirectory');
});

test('gap log CLI: rejects a bad verdict and never crashes on a valueless flag', () => {
  const cwd = tmp('rsc-gap-');
  const bad = spawnSync('node', [RSC, 'capabilities', 'gap-log', '--procedure', 'x', '--verdict', 'nope'], { cwd, encoding: 'utf8' });
  assert.equal(bad.status, 1);
  assert.match(bad.stdout, /Recover:/);
  // A flag must never be swallowed as the previous flag's value.
  const swallowed = spawnSync('node', [RSC, 'capabilities', 'gap-log', '--procedure', '--verdict', 'covered-agent'], { cwd, encoding: 'utf8' });
  assert.equal(swallowed.status, 1, 'recording "--verdict" as the procedure is not acceptable');
  assert.equal(countGaps(cwd), 0);
  const bare = spawnSync('node', [RSC, 'capabilities', 'gap-log', '--procedure'], { cwd, encoding: 'utf8' });
  assert.equal(bare.status, 1);
  assert.doesNotMatch(bare.stdout + bare.stderr, /TypeError|is not a function/);
});

test('gap log CLI: the subcommand is found wherever it sits in the argv', () => {
  const cwd = tmp('rsc-gap-');
  const r = spawnSync('node', [RSC, 'capabilities', '--target', 'claude', 'gap-log', '--procedure', 'p', '--verdict', 'covered-agent'], { cwd, encoding: 'utf8' });
  assert.equal(r.status, 0, r.stdout);
  assert.equal(countGaps(cwd), 1, 'a write command must never be a silent no-op');
});

// --- cross-feature: the log must not fight the sello -------------------------------

test('the gap log is excluded from the sello candidate', () => {
  // .rsc/ is a non-lowerable tier-2 risk class, and the log is appended after every
  // piece of work with no switch — so leaving it in the candidate escalated risk and
  // invalidated an approved seal on every write: a permanent delivery lockout whose
  // documented recovery looped.
  assert.ok(SELLO_STATE_PATHS.includes('.rsc/automation-gaps.md'),
    'every tool-written .rsc/ journal must be in SELLO_STATE_PATHS');
});

// --- local state must not be publishable ------------------------------------------

test('install: .rsc/ is gitignored, additively and idempotently', async () => {
  const { ignoreLocalState } = await import('../scripts/install-apply.js');
  // No repo → do nothing (never create a .gitignore where git is not in use).
  const bare = tmp('rsc-gi-');
  assert.equal(ignoreLocalState(bare), null);
  assert.throws(() => statSync(join(bare, '.gitignore')));

  // Fresh repo with an existing .gitignore: append, preserving what was there.
  const root = tmp('rsc-gi-');
  mkdirSync(join(root, '.git'), { recursive: true });
  writeFileSync(join(root, '.gitignore'), 'node_modules/\ndist/');
  assert.ok(ignoreLocalState(root), 'should write');
  let gi = readFileSync(join(root, '.gitignore'), 'utf8');
  assert.match(gi, /^node_modules\/$/m, 'existing entries survive');
  assert.match(gi, /^dist\/$/m);
  assert.match(gi, /^\.rsc\/$/m, '.rsc/ is ignored');

  // Idempotent: a second call changes nothing.
  assert.equal(ignoreLocalState(root), null, 'already present → no-op');
  assert.equal(readFileSync(join(root, '.gitignore'), 'utf8'), gi, 'byte-identical on re-run');

  // Recognizes the equivalent spellings a user may already have.
  for (const spelling of ['.rsc', '/.rsc', '.rsc/']) {
    const r = tmp('rsc-gi-');
    mkdirSync(join(r, '.git'), { recursive: true });
    writeFileSync(join(r, '.gitignore'), `${spelling}\n`);
    assert.equal(ignoreLocalState(r), null, `${spelling} already covers it`);
  }

  // And it works when there is no .gitignore at all.
  const empty = tmp('rsc-gi-');
  mkdirSync(join(empty, '.git'), { recursive: true });
  ignoreLocalState(empty);
  assert.match(readFileSync(join(empty, '.gitignore'), 'utf8'), /^\.rsc\/$/m);
});

test('install: the gap log cannot be committed after a real install', () => {
  const root = tmp('rsc-gi-');
  spawnSync('git', ['init', '-q', '-b', 'main'], { cwd: root });
  writeFileSync(join(root, '.gitignore'), 'node_modules/\n');
  const env = { ...process.env, HOME: tmp('rsc-caps-home-') };
  spawnSync('node', [RSC, 'add', 'suggest', '--target', 'claude'], { cwd: root, encoding: 'utf8', env });
  spawnSync('node', [RSC, 'capabilities', 'gap-log', '--procedure', 'rotate a client credential', '--verdict', 'proposed-accepted'], { cwd: root, encoding: 'utf8', env });
  const check = spawnSync('git', ['check-ignore', '.rsc/automation-gaps.md'], { cwd: root, encoding: 'utf8' });
  assert.equal(check.status, 0, 'the gap log must be ignored, or `git add -A` publishes it');
});
