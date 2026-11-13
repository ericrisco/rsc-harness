import { test } from 'node:test';
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { applyInstall, syncInstalled, removeTargetInstall } from '../scripts/install-apply.js';
import { doctor } from '../scripts/doctor.js';
import { detectTarget, TARGET_IDS, TARGETS, resolveTargets, targetPaths } from '../targets/index.js';
import { targetHasAgents } from '../targets/agents.js';
import { memoryModeFor } from '../targets/memory.js';

const json = (file) => JSON.parse(readFileSync(file, 'utf8'));
const CLI = join(dirname(fileURLToPath(import.meta.url)), '..', 'scripts', 'rsc.js');
function project(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-pi-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  execFileSync('git', ['init', '-q', '-b', 'main', cwd]);
  return cwd;
}

test('Pi is selectable and its explicit project directory outranks generic instructions', (t) => {
  assert.ok(TARGET_IDS.includes('pi'));
  assert.ok(TARGETS.some(({ id, label }) => id === 'pi' && label === 'Pi'));
  const cwd = project(t);
  mkdirSync(join(cwd, '.pi'));
  writeFileSync(join(cwd, 'AGENTS.md'), '# Project instructions\n');
  assert.equal(detectTarget(cwd), 'pi');
  assert.deepEqual(resolveTargets({ cwd }).ids, ['pi']);
});

test('Pi installation and sync expose native skills, preserve settings, and report limitations', async (t) => {
  assert.ok(TARGET_IDS.includes('pi'));
  const cwd = project(t);
  mkdirSync(join(cwd, '.pi'));
  const settings = '{"defaultModel":"my-model","extensions":["./mine.ts"]}\n';
  writeFileSync(join(cwd, '.pi/settings.json'), settings);
  writeFileSync(join(cwd, 'AGENTS.md'), '# My instructions\n');
  await applyInstall({ skillIds: ['suggest', 'orient'], agentIds: ['developer'], target: 'pi', cwd });
  const skill = join(cwd, '.pi/skills/suggest/SKILL.md');
  assert.match(readFileSync(skill, 'utf8'), /name: suggest/);
  assert.ok(existsSync(join(cwd, '.pi/skills/orient/references')));
  assert.match(readFileSync(join(cwd, 'AGENTS.md'), 'utf8'), /^# My instructions\n/);
  assert.deepEqual(json(join(cwd, '.rsc.json')).targets, ['pi']);
  assert.equal(targetHasAgents('pi'), false);
  assert.equal(memoryModeFor('pi'), 'unsupported');
  assert.ok(!existsSync(join(cwd, '.pi/agents')));
  assert.ok(!existsSync(join(cwd, '.pi/hooks.json')));
  const health = doctor({ target: 'pi', cwd });
  assert.equal(health.healthy, true, JSON.stringify(health));
  assert.equal(health.memory.mode, 'unsupported');
  assert.deepEqual(health.missingAgents, []);
  rmSync(join(cwd, '.pi/skills/suggest'), { recursive: true, force: true });
  assert.equal(doctor({ target: 'pi', cwd }).healthy, false, 'missing native skill must be diagnosed');
  await syncInstalled({ target: 'pi', cwd });
  assert.ok(existsSync(skill));
  assert.equal(doctor({ target: 'pi', cwd }).healthy, true);
  assert.equal(readFileSync(join(cwd, '.pi/settings.json'), 'utf8'), settings);
  assert.equal(readFileSync(join(cwd, 'AGENTS.md'), 'utf8').match(/<!-- rsc-suggest:start -->/g).length, 1);
});

test('removing Pi keeps user skills and another target sharing AGENTS.md', async (t) => {
  assert.ok(TARGET_IDS.includes('pi'));
  const cwd = project(t);
  mkdirSync(join(cwd, '.pi/skills/mine'), { recursive: true });
  writeFileSync(join(cwd, '.pi/skills/mine/SKILL.md'), '# Mine\n');
  await applyInstall({ skillIds: ['suggest'], target: 'pi', cwd });
  await applyInstall({ skillIds: ['suggest'], target: 'codex', cwd });
  removeTargetInstall({ target: 'pi', cwd });
  assert.ok(!existsSync(join(cwd, '.pi/skills/suggest')));
  assert.equal(readFileSync(join(cwd, '.pi/skills/mine/SKILL.md'), 'utf8'), '# Mine\n');
  assert.ok(existsSync(join(cwd, '.codex/rsc/suggest/SKILL.md')));
  assert.match(readFileSync(join(cwd, 'AGENTS.md'), 'utf8'), /rsc-suggest:start/);
  removeTargetInstall({ target: 'codex', cwd });
  assert.doesNotMatch(readFileSync(join(cwd, 'AGENTS.md'), 'utf8'), /rsc-suggest:start/);
});

test('Pi onboarding accepts its plan without requiring unsupported agents', { timeout: 120000 }, (t) => {
  assert.ok(TARGET_IDS.includes('pi'));
  const cwd = project(t);
  writeFileSync(join(cwd, 'app.py'), 'value = 1\n');
  const args = [CLI, 'onboard', '--technical-level', 'technical', '--project-kind', 'software',
    '--software-scope', 'growing', '--workflow', 'main', '--goal', 'Python backend', '--target', 'pi'];
  const run = (extra = []) => execFileSync(process.execPath, [...args, ...extra], {
    cwd, encoding: 'utf8', env: { ...process.env, RSC_NO_UPDATE_CHECK: '1' },
  });
  const id = /--accept-plan ([a-f0-9]{64})/.exec(run())?.[1];
  assert.ok(id);
  const output = run(['--accept-plan', id]);
  assert.doesNotMatch(output, /installed agents differ from accepted policy/);
  assert.deepEqual(json(join(cwd, '.rsc.json')).targets, ['pi']);
  assert.ok(existsSync(join(cwd, '.pi/skills/suggest/SKILL.md')));
  assert.deepEqual(json(join(cwd, '.pi/skills/.rsc-state.json')).agents, []);
});

for (const filename of ['AGENTS.override.md', 'AGENTS.MD', 'CLAUDE.md', 'CLAUDE.MD']) {
  test(`Pi writes the native context file ${filename} without shadowing user instructions`, async (t) => {
    const cwd = project(t);
    const original = '# My project instructions\n\nKeep the existing conventions.\n';
    writeFileSync(join(cwd, filename), original);
    if (filename === 'AGENTS.override.md') writeFileSync(join(cwd, 'AGENTS.md'), '# Separate AGENTS instructions\n');
    await applyInstall({ skillIds: ['suggest'], target: 'pi', cwd });
    assert.match(readFileSync(join(cwd, filename), 'utf8'), /rsc-suggest:start/);
    assert.ok(readFileSync(join(cwd, filename), 'utf8').startsWith(original));
    if (filename.startsWith('CLAUDE')) assert.ok(!existsSync(join(cwd, 'AGENTS.md')), 'do not create a higher-priority context file');
    if (filename === 'AGENTS.override.md') assert.equal(readFileSync(join(cwd, 'AGENTS.md'), 'utf8'), '# Separate AGENTS instructions\n');
    await syncInstalled({ target: 'pi', cwd });
    assert.equal(readFileSync(join(cwd, filename), 'utf8').match(/rsc-suggest:start/g).length, 1);
    assert.equal(doctor({ target: 'pi', cwd }).healthy, true);
    removeTargetInstall({ target: 'pi', cwd });
    assert.equal(readFileSync(join(cwd, filename), 'utf8'), original);
  });
}

test('Pi skips a directory named like a higher-priority context file', (t) => {
  const cwd = project(t);
  mkdirSync(join(cwd, 'AGENTS.override.md'));
  writeFileSync(join(cwd, 'CLAUDE.md'), '# Existing instructions\n');
  assert.equal(targetPaths('pi', undefined, cwd).hookTarget, join(cwd, 'CLAUDE.md'));
});

test('Pi context cleanup deduplicates filename aliases on the host filesystem', async (t) => {
  const cwd = project(t);
  writeFileSync(join(cwd, 'AGENTS.md'), '# User context\n');
  const aliases = existsSync(join(cwd, 'AGENTS.MD'));
  if (!aliases) writeFileSync(join(cwd, 'AGENTS.MD'), '# Separate uppercase context\n');
  const paths = targetPaths('pi', undefined, cwd);
  const identity = (file) => { const { dev, ino } = statSync(file); return `${dev}:${ino}`; };
  assert.equal(new Set(paths.contextFiles.map(identity)).size, paths.contextFiles.length);
  assert.equal(paths.contextFiles.length, aliases ? 1 : 2);
  await applyInstall({ skillIds: ['suggest'], target: 'codex', cwd });
  await applyInstall({ skillIds: ['suggest'], target: 'pi', cwd });
  await syncInstalled({ target: 'pi', cwd });
  removeTargetInstall({ target: 'pi', cwd });
  assert.match(readFileSync(join(cwd, 'AGENTS.md'), 'utf8'), /rsc-suggest:start/);
  if (!aliases) assert.equal(readFileSync(join(cwd, 'AGENTS.MD'), 'utf8'), '# Separate uppercase context\n');
});

test('Pi override removal leaves the separately installed Codex instructions intact', async (t) => {
  const cwd = project(t);
  const original = '# Override instructions\n';
  writeFileSync(join(cwd, 'AGENTS.override.md'), original);
  await applyInstall({ skillIds: ['suggest'], target: 'pi', cwd });
  await applyInstall({ skillIds: ['suggest'], target: 'codex', cwd });
  removeTargetInstall({ target: 'pi', cwd });
  assert.equal(readFileSync(join(cwd, 'AGENTS.override.md'), 'utf8'), original);
  assert.match(readFileSync(join(cwd, 'AGENTS.md'), 'utf8'), /rsc-suggest:start/);
});

test('doctor notices a new Pi override hiding the installed instructions, and sync repairs it', async (t) => {
  const cwd = project(t);
  await applyInstall({ skillIds: ['suggest'], target: 'pi', cwd });
  const previous = readFileSync(join(cwd, 'AGENTS.md'), 'utf8');
  writeFileSync(join(cwd, 'AGENTS.override.md'), '# Newly selected context\n');
  const hidden = doctor({ target: 'pi', cwd });
  assert.equal(hidden.healthy, false);
  assert.ok(hidden.contextFile, 'Pi diagnostics must name the selected file and recovery');
  assert.equal(hidden.contextFile.path, join(cwd, 'AGENTS.override.md'));
  assert.match(hidden.contextFile.action, /sync/);
  const result = await syncInstalled({ target: 'pi', cwd });
  assert.equal(readFileSync(join(cwd, '.rsc/backups', result.backup.id, 'files/AGENTS.md'), 'utf8'), previous);
  assert.match(readFileSync(join(cwd, 'AGENTS.override.md'), 'utf8'), /rsc-suggest:start/);
  assert.doesNotMatch(readFileSync(join(cwd, 'AGENTS.md'), 'utf8'), /rsc-suggest:start/);
  assert.equal(doctor({ target: 'pi', cwd }).healthy, true);
  removeTargetInstall({ target: 'pi', cwd });
  assert.doesNotMatch(readFileSync(join(cwd, 'AGENTS.md'), 'utf8'), /rsc-suggest:start/);
  assert.equal(readFileSync(join(cwd, 'AGENTS.override.md'), 'utf8'), '# Newly selected context\n');
});
