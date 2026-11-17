import test from 'node:test';
import assert from 'node:assert/strict';
import { existsSync, mkdirSync, mkdtempSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from './helpers/scratch.js';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawnSync } from 'node:child_process';

const CLI = fileURLToPath(new URL('../scripts/rsc.js', import.meta.url));
const answers = ['onboard', '--technical-level', 'technical', '--project-kind', 'software',
  '--software-scope', 'small', '--workflow', 'main', '--goal', 'A calculator', '--target', 'claude'];
const run = (cwd, args) => spawnSync(process.execPath, [CLI, ...args], {
  cwd, encoding: 'utf8', env: { ...process.env, RSC_NO_UPDATE_CHECK: '1' },
});
function fixture(t) {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-emoji-onboarding-'));
  t.after(() => rmSync(cwd, { recursive: true, force: true }));
  return cwd;
}
function preview(cwd, emoji) {
  const args = [...answers, '--emoji', emoji];
  const result = run(cwd, args);
  assert.equal(result.status, 0, result.stdout + result.stderr);
  const id = result.stdout.match(/Plan id: ([a-f0-9]{64})/)?.[1];
  assert.ok(id, result.stdout);
  return { args, id, output: result.stdout };
}
function accept(cwd, emoji) {
  const { args, id } = preview(cwd, emoji);
  return run(cwd, [...args, '--accept-plan', id]);
}
// Run the emitted arguments through this checkout's CLI, not a published npm version.
// Generated commands encode the free-text goal as base64 and contain only space-separated tokens.
function printedArgs(text, prefix) {
  const line = text.split('\n').find((line) => line.includes(prefix));
  assert.ok(line, text);
  const command = line.slice(line.indexOf(prefix) + prefix.length);
  const args = command.trim().split(/\s+/);
  assert.equal(args[0], 'npx');
  assert.match(args[1], /^@ericrisco\/rsc@/);
  assert.equal(args[2], 'onboard');
  return args.slice(2);
}
function expectMode(cwd, emoji) {
  const result = run(cwd, ['emoji', 'status']);
  assert.equal(result.status, 0, result.stderr);
  assert.equal(result.stdout.trim(), `emoji: ${emoji}`);
  const manifest = JSON.parse(readFileSync(join(cwd, '.rsc.json'), 'utf8'));
  assert.equal(manifest.optOuts.includes('emoji'), emoji === 'off');
}

test('accepting the printed on plan overrides an existing emoji-off decision', (t) => {
  const cwd = fixture(t);
  const installed = accept(cwd, 'off');
  assert.equal(installed.status, 0, installed.stdout + installed.stderr);
  const { output } = preview(cwd, 'on');
  const result = run(cwd, printedArgs(output, 'Accept exactly this plan: '));
  assert.equal(result.status, 0, result.stdout + result.stderr);
  expectMode(cwd, 'on');
});

for (const initial of ['on', 'off']) {
  const next = initial === 'on' ? 'off' : 'on';
  test(`failed ${initial}-to-${next} onboarding restores the decision and its recovery command can be retried`, (t) => {
    const cwd = fixture(t);
    const installed = accept(cwd, initial);
    assert.equal(installed.status, 0, installed.stdout + installed.stderr);
    const marker = join(cwd, '.rsc', '.no-emoji');
    if (initial === 'off') writeFileSync(marker, 'Existing project decision\n');
    const beforeMarker = existsSync(marker) ? readFileSync(marker, 'utf8') : null;
    const beforeManifest = readFileSync(join(cwd, '.rsc.json'), 'utf8');

    // A real copy failure, after applyEmojiDecision has changed the marker.
    const runtime = join(cwd, '.rsc', 'emoji-policy.mjs');
    rmSync(runtime);
    mkdirSync(runtime);
    const failed = accept(cwd, next);
    assert.equal(failed.status, 4, failed.stdout + failed.stderr);
    assert.match(failed.stderr, /RSC_ONBOARDING_INCOMPLETE:.*EISDIR/);
    assert.equal(readFileSync(join(cwd, '.rsc.json'), 'utf8'), beforeManifest);
    assert.equal(existsSync(marker) ? readFileSync(marker, 'utf8') : null, beforeMarker);
    expectMode(cwd, initial);

    // Remove the obstruction, then retry exactly what the error instructed.
    rmSync(runtime, { recursive: true });
    const recovered = run(cwd, printedArgs(failed.stderr, 'Recover with: '));
    assert.equal(recovered.status, 0, recovered.stdout + recovered.stderr);
    expectMode(cwd, next);
  });
}
