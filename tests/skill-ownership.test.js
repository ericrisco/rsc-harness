import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, existsSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';

// The boundary between "the catalog's" and "the user's" decides what an install is allowed to
// destroy, so every case here runs the REAL CLI against a REAL project directory. A double would
// have to encode the very assumption under test — and the first version of this spec got that
// assumption wrong in two of three claims, which is exactly why these run end to end.
//
// Reported by a user, reproduced here on 2026-09-17: a skill added after onboarding disappears on
// the next sync, because `add` updates one list of governed skills and `sync` reads another.
const HERE = dirname(fileURLToPath(import.meta.url));
const CLI = join(HERE, '..', 'scripts', 'rsc.js');
const TMP = [];

function rsc(cwd, ...args) {
  return spawnSync('node', [CLI, ...args], { cwd, encoding: 'utf8' });
}

// A project that has been through onboarding, which is the precondition for the bug: without an
// accepted plan there is no governed list, and without a governed list there is nothing to desync.
function onboarded() {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-own-'));
  TMP.push(cwd);
  const base = ['onboard', '--technical-level', 'mixed', '--accompaniment', 'L2',
    '--project-kind', 'operations', '--goal', 'x', '--target', 'claude'];
  const offer = rsc(cwd, ...base);
  const accept = /--accept-plan ([a-f0-9]+)/.exec(offer.stdout + offer.stderr);
  assert.ok(accept, 'the onboarding offer must name the plan to accept');
  const goalB64 = /--goal-base64 (\S+)/.exec(offer.stdout + offer.stderr)[1];
  rsc(cwd, 'onboard', '--technical-level', 'mixed', '--accompaniment', 'L2',
    '--project-kind', 'operations', '--goal-base64', goalB64, '--target', 'claude',
    '--accept-plan', accept[1]);
  assert.ok(existsSync(join(cwd, '.rsc.json')), 'onboarding must have left a manifest');
  return cwd;
}

const manifest = (cwd) => JSON.parse(readFileSync(join(cwd, '.rsc.json'), 'utf8'));
const skillDir = (cwd, id) => join(cwd, '.claude', 'skills', id);

function writeOwnSkill(cwd, id, body = 'CONTENIDO PROPIO') {
  mkdirSync(skillDir(cwd, id), { recursive: true });
  writeFileSync(join(skillDir(cwd, id), 'SKILL.md'),
    `---\nname: ${id}\ndescription: Skill propia del equipo.\norigin: equipo-interno\n---\n# ${id}\n${body}\n`);
}

test.after(() => {
  for (const d of TMP) { try { rmSync(d, { recursive: true, force: true }); } catch { /* best effort */ } }
});

// ── 1-2. the reported bug ────────────────────────────────────────────────────────────────────

test('1 · a skill added after onboarding survives the next sync', () => {
  const cwd = onboarded();
  rsc(cwd, 'add', 'sdd', '--target', 'claude');
  assert.equal(existsSync(skillDir(cwd, 'sdd')), true, 'precondition: add installed it');

  rsc(cwd, 'sync');

  assert.equal(existsSync(skillDir(cwd, 'sdd')), true,
    'this is the reported data loss: sync removed what add had just installed');
});

test('2 · add leaves the two governed lists describing the same set', () => {
  const cwd = onboarded();
  rsc(cwd, 'add', 'sdd', '--target', 'claude');
  const m = manifest(cwd);

  assert.ok(m.skills.includes('sdd'), 'the declared skills must include it');
  assert.ok(m.onboarding.plan.policy.skills.includes('sdd'),
    'and so must the governed list sync actually reads — the desync IS the bug');
});

// ── 3-4. the protection that already exists, now asserted instead of assumed ──────────────────

test('3 · a hand-written skill survives sync, byte for byte', () => {
  const cwd = onboarded();
  writeOwnSkill(cwd, 'bitacora-equipo');
  const before = readFileSync(join(skillDir(cwd, 'bitacora-equipo'), 'SKILL.md'), 'utf8');

  rsc(cwd, 'sync');
  rsc(cwd, 'sync');

  assert.equal(existsSync(skillDir(cwd, 'bitacora-equipo')), true);
  assert.equal(readFileSync(join(skillDir(cwd, 'bitacora-equipo'), 'SKILL.md'), 'utf8'), before);
});

test('4 · installing a catalog skill refuses to overwrite a hand-written one of the same name', () => {
  const cwd = onboarded();
  writeOwnSkill(cwd, 'debug');
  const before = readFileSync(join(skillDir(cwd, 'debug'), 'SKILL.md'), 'utf8');

  const out = rsc(cwd, 'add', 'debug', '--target', 'claude');

  assert.equal(readFileSync(join(skillDir(cwd, 'debug'), 'SKILL.md'), 'utf8'), before,
    "the README promises the user's version is the commit; it must not be replaced");
  assert.match(out.stdout + out.stderr, /refusing to overwrite|--force/,
    'and a refusal must name the way out (P6)');
});

// ── 5-6. own skills stop being a list nobody fills ───────────────────────────────────────────

test('5 · doctor derives the own skills from the files, not from a list someone had to maintain', () => {
  const cwd = onboarded();
  writeOwnSkill(cwd, 'bitacora-equipo');
  writeOwnSkill(cwd, 'registro-horario');

  const report = JSON.parse(rsc(cwd, 'doctor', '--json').stdout);

  assert.deepEqual(report.ownSkills.present.sort(), ['bitacora-equipo', 'registro-horario'],
    'the manifest list is empty and always will be; the files are the ledger (P3)');
});

test('6 · and it notices when a declared own skill has gone', () => {
  const cwd = onboarded();
  writeOwnSkill(cwd, 'bitacora-equipo');
  rsc(cwd, 'doctor', '--json');
  rmSync(skillDir(cwd, 'bitacora-equipo'), { recursive: true, force: true });

  const m = manifest(cwd);
  m.ownSkills = ['bitacora-equipo'];
  writeFileSync(join(cwd, '.rsc.json'), JSON.stringify(m, null, 2));

  const report = JSON.parse(rsc(cwd, 'doctor', '--json').stdout);
  assert.deepEqual(report.ownSkills.missing, ['bitacora-equipo']);
});
