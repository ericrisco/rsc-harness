import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, existsSync, readFileSync } from 'node:fs';
import { tmpdir } from './helpers/scratch.js';
import { join } from 'node:path';
import { audit, renderAuditMarkdown, writeAuditReport, installedProject, installedMachine } from '../scripts/audit.js';

// Build a fake project: real skill bases under .rsc/skills/<id> are the install truth.
function project(ids, { pkg } = {}) {
  const cwd = mkdtempSync(join(tmpdir(), 'rsc-audit-'));
  for (const id of ids) mkdirSync(join(cwd, '.rsc', 'skills', id), { recursive: true });
  if (pkg) writeFileSync(join(cwd, 'package.json'), JSON.stringify(pkg));
  return cwd;
}
function machine(ids) {
  const home = mkdtempSync(join(tmpdir(), 'rsc-home-'));
  for (const id of ids) mkdirSync(join(home, '.claude', 'skills', id), { recursive: true });
  return home;
}
const emptyHome = () => mkdtempSync(join(tmpdir(), 'rsc-home-'));

test('installedProject reads .rsc/skills intersected with the catalog (ignores stray dirs)', () => {
  const cwd = project(['go', 'fastapi', 'not-a-real-skill']);
  const ids = installedProject(cwd, ['go', 'fastapi', 'react']);
  assert.deepEqual(ids, ['fastapi', 'go']); // sorted, stray dir dropped
});

test('installedMachine reads ~/.claude/skills intersected with the catalog', () => {
  const home = machine(['go', 'react', 'junk']);
  assert.deepEqual(installedMachine(home, ['go', 'react']), ['go', 'react']);
});

test('no-footprint flags unrelated frameworks but respects detected-stack siblings', () => {
  // repo looks like Next.js → react is a sibling (kept), rails/django are orphans (flagged)
  const cwd = project(['orient', 'suggest', 'nextjs', 'react', 'rails', 'django'], { pkg: { dependencies: { next: '14' } } });
  const r = audit({ cwd, home: emptyHome(), date: '2026-06-05' });
  const flagged = r.noFootprint.map((n) => n.id).sort();
  assert.deepEqual(flagged, ['django', 'rails']);
  assert.ok(r.detectedStacks.includes('nextjs'));
});

test('no-footprint stays silent on a non-code / undetectable repo', () => {
  const cwd = project(['rails', 'django']); // no package.json, nothing to detect
  const r = audit({ cwd, home: emptyHome() });
  assert.equal(r.noFootprint.length, 0, 'cannot judge footprint without stack signals');
});

test('overlap fires for two skills in the same domain sharing >= 3 tags (prisma vs drizzle)', () => {
  const cwd = project(['prisma-orm', 'drizzle-orm']);
  const r = audit({ cwd, home: emptyHome() });
  assert.equal(r.overlaps.length, 1);
  assert.deepEqual([r.overlaps[0].a, r.overlaps[0].b].sort(), ['drizzle-orm', 'prisma-orm']);
  assert.ok(r.overlaps[0].sharedTags.length >= 3);
});

test('floor/SDD skills never count as overlap (a pipeline is not redundancy)', () => {
  const cwd = project(['specify', 'clarify', 'plan', 'tasks', 'implement', 'verify', 'review', 'ship']);
  const r = audit({ cwd, home: emptyHome() });
  assert.equal(r.overlaps.length, 0);
  assert.equal(r.heavyDomains.length, 0, 'SDD domain is excluded from heaviness');
});

test('heavy domain fires when one non-floor domain has more than the threshold', () => {
  const biz = ['finance-ops', 'invoicing', 'bookkeeping', 'pricing', 'sales-pipeline', 'lead-gen']; // 6 > 5
  const r = audit({ cwd: project(biz), home: emptyHome() });
  const heavy = r.heavyDomains.find((h) => h.domain.startsWith('Run a business'));
  assert.ok(heavy, 'business domain flagged heavy');
  assert.equal(heavy.count, 6);
});

test('clean report when only the floor is installed', () => {
  const r = audit({ cwd: project(['orient', 'suggest', 'harness', 'init']), home: emptyHome() });
  assert.equal(r.summary.clean, true);
  assert.match(r.summary.headline, /nothing to flag/i);
});

test('renderAuditMarkdown includes the headline and a re-run hint', () => {
  const md = renderAuditMarkdown(audit({ cwd: project(['prisma-orm', 'drizzle-orm']), home: emptyHome(), date: '2026-06-05' }));
  assert.match(md, /# Skill audit — 2026-06-05/);
  assert.match(md, /Possible overlap/);
  assert.match(md, /rsc audit/);
});

test('writeAuditReport writes the wiki file when a harness wiki exists, and always stamps audit.json', () => {
  const cwd = project(['prisma-orm', 'drizzle-orm']);
  mkdirSync(join(cwd, '02-DOCS', 'wiki'), { recursive: true });
  const r = audit({ cwd, home: emptyHome(), date: '2026-06-05' });
  const written = writeAuditReport(r, cwd);
  assert.ok(written.length === 1 && written[0].endsWith('skill-audit-2026-06-05.md'));
  assert.ok(existsSync(written[0]), 'wiki report written');
  const stamp = JSON.parse(readFileSync(join(cwd, '.rsc', 'audit.json'), 'utf8'));
  assert.ok(stamp.lastRun, 'audit.json stamped for the SessionStart throttle');
});

test('writeAuditReport only stamps (no wiki file) when there is no harness wiki', () => {
  const cwd = project(['go']);
  const r = audit({ cwd, home: emptyHome(), date: '2026-06-05' });
  const written = writeAuditReport(r, cwd);
  assert.equal(written.length, 0, 'no wiki → no report file');
  assert.ok(existsSync(join(cwd, '.rsc', 'audit.json')), 'still stamps for the throttle');
});
