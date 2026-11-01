import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync, mkdtempSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { DEFAULT_SKILL_FLOOR } from '../scripts/lib/default-skill-floor.js';
import { syncInstalled } from '../scripts/install-apply.js';
import { writeManifest } from '../scripts/lib/manifest-file.js';

// Issue #303: a small business asks "connect my Holded / my Sage", and rsc had two walls. The
// `harness` rule created a tool ONLY from evidence in code (a business has none), and the only other
// way was copying a template by hand. rsc ships no ready-made connections on purpose, so the answer
// is a method that is always installed, not a list of vendors.
// FTD: 02-DOCS/wiki/ftd/connect-tool.md
const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const read = (p) => readFileSync(join(ROOT, p), 'utf8');
const skill = read('skills/connect-tool/SKILL.md');

test('connect-tool is part of the floor every installation equips', () => {
  assert.ok(DEFAULT_SKILL_FLOOR.includes('connect-tool'));
});

test('a harness declared before 3.0.13 gains connect-tool on sync, on disk and not just named', async () => {
  const d = mkdtempSync(join(tmpdir(), 'ct-sync-'));
  execFileSync('git', ['init', '-q'], { cwd: d });
  writeManifest(d, { targets: ['claude'], skills: ['orient', 'suggest', 'unslop', 'ftd'], ownSkills: [], catalogVersion: '3.0.12', tier: null, optOuts: [] });
  const r = await syncInstalled({ target: 'claude', home: d, cwd: d });
  assert.ok(r.synced.includes('connect-tool'));
  assert.ok(existsSync(join(d, '.claude', 'skills', 'connect-tool', 'SKILL.md')));
  // #337: the references and the bridge kit travel with the skill, or its links lead nowhere.
  for (const p of ['THIRD_PARTY.md', 'references/messages.md', 'references/spain.md', 'bridge-kit/LICENSE', 'bridge-kit/sqlserver/03-prueba-solo-lectura.sql']) {
    assert.ok(existsSync(join(d, '.claude', 'skills', 'connect-tool', p)), `${p} installed`);
  }
});

test('harness now accepts a tool the user names, and hands that job to connect-tool', () => {
  const harness = read('skills/harness/SKILL.md');
  assert.match(harness, /or the user asked for it by name \(then `\.\.\/connect-tool\/SKILL\.md` builds it\)/);
  assert.doesNotMatch(harness, /if and only if the detector found evidence/, 'the code-only rule is the wall #303 hit');
  assert.doesNotMatch(harness, /the user does `cp -r 01-TOOLS\/_TEMPLATE/, 'nobody should be told to copy the template by hand');
});

test('the method: docs before memory, read-only first, never write into a desktop program database', () => {
  for (const rule of [
    /the docs decide, never memory/i,
    /If you find\s+nothing reliable, say so/,
    /\*\*Read first\.\*\*/,
    /Never write directly into a desktop program's database/,
    /Work on a copy, never the live database/,
    /Never open the\s+database port to the internet/,
  ]) assert.match(skill, rule);
});

test('the read-only proof tells a permission error apart from any other failure', () => {
  // A probe that prints "writes refused" on ANY error passes a wrong password as proof. Each one must
  // grep for the permission error specifically, and fail on everything else.
  const probes = [...skill.matchAll(/```bash\n([\s\S]*?)```/g)].map((m) => m[1]).filter((b) => /writes refused/.test(b));
  assert.equal(probes.length, 2, 'PostgreSQL and SQL Server probes');
  for (const p of probes) {
    assert.match(p, /FAIL — this user can write/, 'a successful write fails the test');
    assert.match(p, /grep -q/, 'success requires the specific permission error');
    assert.match(p, /FAIL — unexpected error/, 'any other error fails, never passes as refused');
  }
});

// Issue #337: with no documentation the skill stopped at "a question for the vendor", and the owner
// was left not knowing what program they had, who to ask, or what to ask for. Eric's order: the docs
// first, always; the diagnosis is option 2, only when there is no API, no MCP and no documentation.

test('documentation first; option 2 only when research came back empty, and it keeps going (#337)', () => {
  const docs = skill.indexOf('## 1. Research');
  const option2 = skill.indexOf('## 3. Option 2');
  assert.ok(docs > 0 && option2 > docs, 'research comes before option 2');
  assert.match(skill, /Only after section 1 came back empty/);
  assert.doesNotMatch(skill, /stop at a question for the vendor/, 'no documentation is no longer the end');
  const section = skill.slice(option2, skill.indexOf('## 4.', option2));
  for (const step of [/Diagnose in conversation/, /who holds the key/i, /hosted by the distributor/i, /Leave the case open/]) {
    assert.match(section, step);
  }
});

test('screen automation and scraping are not routes, only an anti-pattern (#337)', () => {
  const routes = skill.slice(skill.indexOf('## 2. Choose the route'), skill.indexOf('## 3. Option 2'));
  assert.doesNotMatch(routes, /^\| Screen automation|^\| .*RPA.*\| Nothing else exists/m);
  assert.match(routes, /\(RPA\) and scraping are \*\*not routes\*\*/);
  assert.match(skill, /^\| Automate the screen \(RPA\) or scrape the web app \|/m);
  assert.match(skill, /^\| File exchange \|/m, 'file exchange is a route of its own');
});

test('ready-to-send messages live in their own section, reached from option 2 only (#337)', () => {
  // 3.0.15 took the messages out of the skill; #337 brings them back as a section, not the method.
  assert.doesNotMatch(skill, /Hi <name>/, 'no message text in SKILL.md itself');
  assert.match(skill, /\[references\/messages\.md\]\(references\/messages\.md\)/);
  assert.match(read('skills/connect-tool/references/messages.md'), /read-only[\s\S]*dedicated user[\s\S]*nothing open to the internet[\s\S]*cost question/);
  assert.match(skill, /Check the support terms/);
});

test('every reference the skill links to exists, and the bridge kit ships unmodified with its licence (#337)', () => {
  const dir = 'skills/connect-tool';
  const links = [...skill.matchAll(/\]\(((?:references|bridge-kit)\/[^)#]+)\)/g)].map((m) => m[1]);
  for (const file of ['program-types', 'what-to-find-out', 'messages', 'database-bridge', 'file-exchange', 'connect-or-migrate', 'spain']) {
    assert.ok(links.includes(`references/${file}.md`), `SKILL.md links ${file}.md`);
  }
  for (const link of links) assert.ok(existsSync(join(ROOT, dir, link)), `${link} exists`);
  const upstream = JSON.parse(read(`${dir}/bridge-kit/UPSTREAM.json`));
  assert.equal(upstream.modified, false);
  assert.match(upstream.commit, /^[0-9a-f]{40}$/);
  assert.match(read(`${dir}/bridge-kit/LICENSE`), /^MIT License/);
  assert.match(read(`${dir}/THIRD_PARTY.md`), /CC BY 4\.0/, 'the adapted guides carry their attribution');
});

test('the bridge reference warns that the kit acceptance test can pass on a wrong table name (#337)', () => {
  const bridge = read('skills/connect-tool/references/database-bridge.md');
  assert.match(bridge, /invalid object name/);
  assert.match(bridge, /Msg 229/);
});
