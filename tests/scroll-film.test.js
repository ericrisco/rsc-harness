import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from './helpers/scratch.js';
import { execFileSync, spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import vm from 'node:vm';

// scroll-film ships two artifacts a user copies as-is: the scrub engine and the chain checker.
// Prose cannot promise their behaviour, so the invariants the skill's body leans on are pinned
// here: seam frames never move, the stack never shows the page through it, the checker tells a
// frame-locked seam from a broken one and flags the encodes that ruin scrubbing.
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const SKILL_DIR = join(ROOT, 'skills', 'scroll-film');
const VERIFY = join(SKILL_DIR, 'scripts', 'verify.sh');

function loadEngine() {
  const sandbox = { module: { exports: {} } };
  vm.runInNewContext(readFileSync(join(SKILL_DIR, 'assets', 'scrub-engine.js'), 'utf8'), sandbox);
  return sandbox.module.exports;
}

test('every file the body points the user at exists', () => {
  const body = readFileSync(join(SKILL_DIR, 'SKILL.md'), 'utf8');
  for (const rel of ['assets/scrub-engine.js', 'assets/page-template.html', 'scripts/verify.sh',
    'references/chain.md', 'references/engine.md']) {
    assert.ok(body.includes(rel), `the body never mentions ${rel}`);
    assert.ok(existsSync(join(SKILL_DIR, rel)), `${rel} is missing`);
  }
});

test('the engine loads outside a browser and touches no DOM until mount', () => {
  const engine = loadEngine();
  for (const fn of ['mount', 'hold', 'planBands', 'shotOpacity']) assert.equal(typeof engine[fn], 'function', fn);
});

test('hold never moves the seam frames and never runs the camera backwards', () => {
  const { hold } = loadEngine();
  for (const strength of [0, 0.25, 0.5, 1]) {
    assert.equal(hold(0, strength), 0);
    assert.ok(Math.abs(hold(1, strength) - 1) < 1e-12, `f(1) at ${strength}`);
    let prev = -Infinity;
    for (let x = 0; x <= 1.00001; x += 0.01) {
      const y = hold(x, strength);
      assert.ok(y >= prev - 1e-12, `not monotone at x=${x}, strength=${strength}`);
      prev = y;
    }
  }
  // It slows the middle: the same scroll step moves less time there than at the edges.
  const mid = hold(0.51, 0.5) - hold(0.49, 0.5);
  const edge = hold(0.02, 0.5) - hold(0, 0.5);
  assert.ok(mid < edge);
});

test('bands sit end to end on the scroll axis', () => {
  const { planBands } = loadEngine();
  const bands = planBands([1.4, 0.9, 1.2], 800);
  assert.deepEqual(bands.map((b) => [b.start, b.end]), [[0, 1120], [1120, 1840], [1840, 2800]]);
});

test('at every scroll position some opaque shot covers the stack, and a seam dissolves', () => {
  const { planBands, shotOpacity } = loadEngine();
  const bands = planBands([1, 0.8, 1.2, 1], 1000);
  const fade = 100;
  for (let y = -200; y <= 4200; y += 5) {
    const ops = bands.map((_, i) => shotOpacity(i, y, bands, fade));
    // Later shots stack on top. Below the topmost visible shot, something must be fully opaque,
    // or the page background shows through mid-dissolve.
    const top = ops.map((o, i) => (o > 0 ? i : -1)).reduce((a, b) => Math.max(a, b));
    assert.ok(top >= 0, `nothing visible at y=${y}`);
    assert.ok(ops.slice(0, top + 1).some((o) => o === 1), `see-through at y=${y}: ${ops}`);
  }
  // Exactly on a seam the incoming shot is half in, the outgoing still fully under it.
  assert.equal(shotOpacity(0, 1000, bands, fade), 1);
  assert.equal(shotOpacity(1, 1000, bands, fade), 0.5);
  // Well past the seam the outgoing shot is gone.
  assert.equal(shotOpacity(0, 1200, bands, fade), 0);
});

const hasFfmpeg = ['ffmpeg', 'ffprobe'].every((t) => spawnSync(t, ['-version']).status === 0);

test('verify.sh passes a frame-locked chain and flags a broken seam and a bad encode', { skip: !hasFfmpeg && 'ffmpeg not installed' }, () => {
  const d = mkdtempSync(join(tmpdir(), 'scroll-film-'));
  const enc = ['-an', '-c:v', 'libx264', '-crf', '23', '-pix_fmt', 'yuv420p', '-g', '8', '-keyint_min', '8',
    '-sc_threshold', '0', '-movflags', '+faststart'];
  const ff = (...args) => execFileSync('ffmpeg', ['-v', 'error', '-y', ...args], { cwd: d });
  ff('-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=24:duration=1', ...enc, 'a.mp4');
  ff('-sseof', '-1', '-i', 'a.mp4', '-update', '1', 'a_last.png');
  // b starts on a's real last frame and pushes in slowly: a frame-locked handoff.
  ff('-loop', '1', '-framerate', '24', '-i', 'a_last.png', '-t', '1',
    '-vf', "zoompan=z='1+0.002*on':d=1:s=320x180:fps=24", ...enc, 'b.mp4');
  // c is another picture, with audio, no faststart and one keyframe for the whole clip.
  ff('-f', 'lavfi', '-i', 'testsrc2=size=320x180:rate=24:duration=1,hue=h=180', '-f', 'lavfi', '-i', 'sine=d=1',
    '-shortest', '-c:v', 'libx264', '-pix_fmt', 'yuv420p', '-c:a', 'aac', 'c.mp4');

  const run = (...args) => spawnSync('bash', [VERIFY, ...args], { cwd: d, encoding: 'utf8' });

  const good = run('a.mp4', 'b.mp4');
  assert.equal(good.status, 0, good.stdout + good.stderr);
  assert.match(good.stdout, /RESULT: PASS \(2 clip\(s\), 1 seam\(s\)\)/);

  const bad = run('a.mp4', 'b.mp4', 'c.mp4');
  assert.equal(bad.status, 0, 'warnings alone do not fail without --strict');
  assert.match(bad.stdout, /WARN {2}seam 2→3/);
  assert.match(bad.stdout, /c\.mp4: has an audio track/);
  assert.match(bad.stdout, /c\.mp4: index after the media/);
  assert.match(bad.stdout, /c\.mp4: \d+ frames between keyframes/);
  assert.doesNotMatch(bad.stdout, /WARN {2}seam 1→2/);

  assert.equal(run('--strict', 'a.mp4', 'c.mp4').status, 1);
  assert.equal(run().status, 2);
});
