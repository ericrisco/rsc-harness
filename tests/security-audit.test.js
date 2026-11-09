// security-audit: the deterministic half of the skill. `validate-findings.mjs` refuses a findings.json
// that the files on disk do not support; `render-report.mjs` turns a valid one into the same report
// every time. Each negative below names the exact error it must produce, so a check that silently
// stops checking turns a test red instead of passing.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync, readFileSync, symlinkSync, statSync, rmSync, existsSync, cpSync, linkSync } from 'node:fs';
import { join, resolve, dirname } from 'node:path';
import { tmpdir } from 'node:os';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

import { validate, secretKinds } from '../skills/security-audit/scripts/validate-findings.mjs';
import { render, writeReport } from '../skills/security-audit/scripts/render-report.mjs';

const ROOT = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const VALIDATE = join(ROOT, 'skills/security-audit/scripts/validate-findings.mjs');
const RENDER = join(ROOT, 'skills/security-audit/scripts/render-report.mjs');
const SCHEMA = join(ROOT, 'skills/security-audit/schema/findings.schema.json');
const SKILL_DIR = join(ROOT, 'skills/security-audit');

// Secrets are assembled at runtime so this file never holds a literal that a scanner would flag.
const GH_TOKEN = 'gh' + 'p_' + 'a1B2c3D4e5F6g7H8i9J0k1L2m3N4o5P6q7R8';
const AWS_KEY = 'AK' + 'IA' + 'ABCDEFGHIJKLMNOP';

// A project with one source file and an audit dir holding a fully valid findings.json.
function fixture() {
  const base = mkdtempSync(join(tmpdir(), 'rsc-secaudit-'));
  const project = join(base, 'project');
  mkdirSync(join(project, 'src'), { recursive: true });
  mkdirSync(join(project, '01-TOOLS', 'security', 'github'), { recursive: true });
  writeFileSync(join(project, '01-TOOLS', 'security', 'github', 'README.md'), '# github checks\n');
  writeFileSync(join(project, '01-TOOLS', 'security', 'github', 'check.sh'), '#!/bin/sh\n');
  writeFileSync(join(project, 'src', 'app.js'), Array.from({ length: 20 }, (_, i) => `line ${i + 1}`).join('\n') + '\n');
  const audit = join(project, '02-DOCS', 'security', 'audit-2026-11-09');
  mkdirSync(join(audit, 'evidence'), { recursive: true });
  writeFileSync(join(audit, 'evidence', 'idor.txt'), 'HTTP/1.1 200 OK\n{"owner":"other-user"}\n');
  writeFileSync(join(audit, 'evidence', 'recheck.txt'), 'HTTP/1.1 403 Forbidden\n');
  writeFileSync(join(audit, 'evidence', 'branch.json'), '{"protected":false}\n');
  const doc = {
    run: {
      id: 'audit-2026-11-09',
      started_at: '2026-11-09T10:00:00Z',
      project_root: project,
      scope: { code: ['src/'], platforms: ['github'] },
      profile: 'standard',
      status: 'complete',
    },
    findings: [
      {
        id: 'F-001',
        title: 'Any user can read another user invoice',
        verdict: 'confirmed',
        severity: 'high',
        surface: 'code',
        class: 'idor',
        principal: 'any logged-in user',
        boundary: 'tenant isolation',
        impact: 'reads invoices of other customers',
        locations: [{ path: 'src/app.js', line_start: 3, line_end: 7 }],
        evidence: [{ kind: 'command_output', path: 'evidence/idor.txt', summary: 'GET /invoices/2 as user 1 returns 200' }],
        fix: {
          proposal: 'Filter by owner id',
          status: 'applied',
          rollback: 'git revert <sha>',
          recheck: { command: 'curl -i /invoices/2', result: 'pass', artifact: 'evidence/recheck.txt' },
        },
        manual_steps: [],
      },
      {
        id: 'F-002',
        title: 'Rate limit may be missing on login',
        verdict: 'needs_validation',
        surface: 'code',
        class: 'brute-force',
        principal: 'anonymous internet user',
        boundary: 'authentication',
        impact: 'password guessing',
        locations: [{ path: 'src/app.js', line_start: 10, line_end: 10 }],
        evidence: [{ kind: 'source', path: 'evidence/idor.txt', summary: 'no limiter middleware seen' }],
        missing_evidence: 'whether the reverse proxy enforces a limit',
        fix: { proposal: 'Add a limiter', status: 'proposed', recheck: { command: 'hydra ...', result: 'not_run' } },
        manual_steps: ['Check the proxy config in the hosting panel'],
      },
      {
        id: 'F-003',
        title: 'Main branch is not protected',
        verdict: 'confirmed',
        severity: 'medium',
        surface: 'platform',
        platform: 'github',
        class: 'supply-chain',
        principal: 'any collaborator with write access',
        boundary: 'code review',
        impact: 'unreviewed code reaches production',
        evidence: [{ kind: 'artifact', path: 'evidence/branch.json', summary: 'branch protection API says protected=false' }],
        fix: { proposal: 'Enable branch protection', status: 'manual', recheck: { command: 'gh api ...', result: 'not_run' } },
        manual_steps: ['Settings > Branches > Add rule for main'],
      },
      {
        id: 'F-004',
        title: 'SQL injection in search',
        verdict: 'rejected',
        surface: 'code',
        class: 'sqli',
        principal: 'anonymous',
        boundary: 'database',
        impact: 'none',
        rejection_reason: 'query is parameterised',
      },
    ],
    coverage: {
      units: [
        { id: 'U-1', surface: 'code', area: 'invoices API', boundary: 'tenant isolation', class: 'idor', status: 'done', findings: ['F-001'] },
        { id: 'U-2', surface: 'code', area: 'login', boundary: 'authentication', class: 'brute-force', status: 'done', findings: ['F-002', 'F-004'] },
        { id: 'U-3', surface: 'platform', area: 'github repo', boundary: 'code review', class: 'supply-chain', status: 'done', findings: ['F-003'] },
      ],
    },
    platforms: [
      { name: 'github', detected_by: '.github/workflows', access: 'read_only', status: 'reviewed', tool_path: '01-TOOLS/security/github' },
    ],
    user_actions: [{ title: 'Rotate the deploy key', steps: ['Open the repo settings', 'Delete the old key'] }],
  };
  return { base, project, audit, doc };
}

function write(fx, doc = fx.doc) {
  writeFileSync(join(fx.audit, 'findings.json'), JSON.stringify(doc, null, 2));
  return fx.audit;
}

// Applies `mutate` to a fresh valid fixture and returns the validation result.
function check(mutate) {
  const fx = fixture();
  mutate(fx.doc, fx);
  write(fx);
  return validate(fx.audit);
}

function expectError(result, re) {
  assert.equal(result.ok, false, 'expected validation to fail');
  assert.ok(result.errors.some((e) => re.test(e)), `no error matched ${re}; got:\n${result.errors.join('\n')}`);
}

// ---------- positives ----------

test('a valid full fixture passes', () => {
  const r = check(() => {});
  assert.deepEqual(r.errors, []);
  assert.equal(r.ok, true);
});

test('redacted secrets pass', () => {
  const r = check((d) => {
    d.findings[0].evidence[0].summary = 'key sk_live_**** and token [REDACTED] and password = [REDACTED]';
  });
  assert.deepEqual(r.errors, []);
});

test('CLI prints OK and exits 0 on a valid dir', () => {
  const fx = fixture();
  write(fx);
  const p = spawnSync(process.execPath, [VALIDATE, fx.audit], { encoding: 'utf8' });
  assert.equal(p.status, 0, p.stderr);
  assert.match(p.stdout, /^OK/);
});

test('schema file is valid JSON and documents the contract', () => {
  const s = JSON.parse(readFileSync(SCHEMA, 'utf8'));
  assert.equal(s.$schema, 'https://json-schema.org/draft/2020-12/schema');
  assert.ok(s.properties.run && s.properties.findings && s.properties.coverage && s.properties.platforms);
});

// ---------- negatives: disk ----------

test('confirmed citing a missing file fails', () => {
  expectError(check((d) => { d.findings[0].locations[0].path = 'src/nope.js'; }), /findings\[0\]\.locations\[0\]\.path: .*does not exist/);
});

test('line out of range fails', () => {
  expectError(check((d) => { d.findings[0].locations[0].line_end = 99; }), /findings\[0\]\.locations\[0\]\.line_end: .*beyond/);
});

test('location escaping via .. fails', () => {
  expectError(check((d) => { d.findings[0].locations[0].path = '../outside.js'; }), /findings\[0\]\.locations\[0\]\.path: .*escape/);
});

test('location escaping via symlink fails', () => {
  expectError(check((d, fx) => {
    writeFileSync(join(fx.base, 'secret.txt'), 'a\nb\nc\nd\ne\nf\ng\n');
    symlinkSync(join(fx.base, 'secret.txt'), join(fx.project, 'src', 'link.js'));
    d.findings[0].locations[0].path = 'src/link.js';
  }), /findings\[0\]\.locations\[0\]\.path: .*symlink/);
});

test('confirmed without artifact evidence fails', () => {
  expectError(check((d) => { d.findings[0].evidence[0].kind = 'source'; }), /findings\[0\]\.evidence: .*artifact or command_output/);
});

test('evidence file missing fails', () => {
  expectError(check((d) => { d.findings[0].evidence[0].path = 'evidence/gone.txt'; }), /findings\[0\]\.evidence\[0\]\.path: .*does not exist/);
});

test('evidence path escaping the audit dir fails', () => {
  expectError(check((d) => { d.findings[0].evidence[0].path = '../../../src/app.js'; }), /findings\[0\]\.evidence\[0\]\.path: .*escape/);
});

test('empty evidence file fails', () => {
  expectError(check((d, fx) => { writeFileSync(join(fx.audit, 'evidence', 'idor.txt'), ''); }), /findings\[0\]\.evidence\[0\]\.path: .*empty/);
});

// ---------- negatives: verdict rules ----------

test('needs_validation with severity fails', () => {
  expectError(check((d) => { d.findings[1].severity = 'low'; }), /findings\[1\]\.severity: .*only allowed .*confirmed/);
});

test('confirmed without severity fails', () => {
  expectError(check((d) => { delete d.findings[0].severity; }), /findings\[0\]\.severity: .*required/);
});

test('needs_validation without missing_evidence fails', () => {
  expectError(check((d) => { delete d.findings[1].missing_evidence; }), /findings\[1\]\.missing_evidence: .*required/);
});

test('rejected without rejection_reason fails', () => {
  expectError(check((d) => { delete d.findings[3].rejection_reason; }), /findings\[3\]\.rejection_reason: .*required/);
});

test('applied fix without rollback fails', () => {
  expectError(check((d) => { delete d.findings[0].fix.rollback; }), /findings\[0\]\.fix\.rollback: .*required/);
});

test('recheck pass without artifact fails', () => {
  expectError(check((d) => { delete d.findings[0].fix.recheck.artifact; }), /findings\[0\]\.fix\.recheck\.artifact: .*required/);
});

test('platform finding without platform name fails', () => {
  expectError(check((d) => { delete d.findings[2].platform; }), /findings\[2\]\.platform: .*required/);
});

test('platform locations name a resource, not a repo file', () => {
  const ok = check((d) => { d.findings[2].locations = [{ resource: 'hetzner:server/app-01/firewall' }]; });
  assert.equal(ok.ok, true, ok.errors.join('\n'));
  expectError(check((d) => { d.findings[2].locations = [{ path: 'no/such/file', line_start: 1, line_end: 1 }]; }),
    /findings\[2\]\.locations\[0\]\.resource: .*required/);
});

test('report shows a platform resource location', () => {
  const fx = fixture();
  fx.doc.findings[2].locations = [{ resource: 'hetzner:server/app-01/firewall' }];
  assert.match(render(write(fx)), /hetzner:server\/app-01\/firewall/);
});

test('bad enum fails', () => {
  expectError(check((d) => { d.findings[0].verdict = 'maybe'; }), /findings\[0\]\.verdict: .*one of/);
});

// ---------- negatives: cross-checks ----------

test('coverage referencing an unknown finding fails', () => {
  expectError(check((d) => { d.coverage.units[0].findings.push('F-999'); }), /coverage\.units\[0\]\.findings\[1\]: .*unknown finding "F-999"/);
});

test('confirmed finding referenced by no unit fails', () => {
  expectError(check((d) => { d.coverage.units[0].findings = []; }), /findings\[0\]: .*not referenced by any coverage unit/);
});

test('duplicate finding id fails', () => {
  expectError(check((d) => { d.findings[3].id = 'F-001'; }), /findings\[3\]\.id: .*duplicate/);
});

test('status complete with a not_reviewed platform fails', () => {
  expectError(check((d) => {
    d.platforms.push({ name: 'vercel', detected_by: 'vercel.json', access: 'none', status: 'not_reviewed', reason: 'no token' });
  }), /run\.status: .*complete.*platforms\[1\]/);
});

test('status complete with a blocked unit fails, partial without reason fails', () => {
  expectError(check((d) => { d.coverage.units[0].status = 'blocked'; d.coverage.units[0].reason = 'no access'; }), /run\.status: .*complete.*coverage\.units\[0\]/);
  expectError(check((d) => { d.run.status = 'partial'; }), /run\.partial_reason: .*required/);
});

// ---------- negatives: secrets ----------

test('a GitHub token in a summary fails without echoing it', () => {
  const r = check((d) => { d.findings[0].evidence[0].summary = `leaked ${GH_TOKEN} in logs`; });
  expectError(r, /findings\[0\]\.evidence\[0\]\.summary: .*secret.*GitHub token/);
  assert.ok(!r.errors.join('\n').includes(GH_TOKEN), 'the secret value must never be printed');
});

test('an AWS key inside an evidence file fails without echoing it', () => {
  const r = check((d, fx) => { writeFileSync(join(fx.audit, 'evidence', 'idor.txt'), `aws_access_key_id=${AWS_KEY}\n`); });
  expectError(r, /evidence\/idor\.txt.*line 1.*secret.*AWS access key/);
  assert.ok(!r.errors.join('\n').includes(AWS_KEY));
});

test('other secret shapes are caught', () => {
  const pem = '-----BEGIN RSA ' + 'PRIVATE KEY-----';
  const jwt = 'eyJhbGciOiJIUzI1NiJ9' + '.eyJzdWIiOiIxMjM0NTY3ODkwIn0' + '.dozjgNryP4J3jVmNHl0w5N_XgL0n3I9PlFUP0THsR8U';
  const cases = [pem, 'xox' + 'b-1234567890-abcdef', 'sk_' + 'live_' + 'abcdefghijklmnop1234', 'Bearer ' + 'abcdefghijklmnopqrstuvwxyz012', jwt, 'api_key = "' + 'q8w7e6r5t4y3u2i1o0p9' + '"'];
  for (const s of cases) {
    const r = check((d) => { d.findings[0].title = s; });
    expectError(r, /findings\[0\]\.title: .*secret/);
  }
});

// ---------- negatives: hardening ----------

test('oversized, too deep, or non-regular findings.json is refused', () => {
  const fx = fixture();
  writeFileSync(join(fx.audit, 'findings.json'), '{"x":"' + 'a'.repeat(5 * 1024 * 1024 + 10) + '"}');
  expectError(validate(fx.audit), /findings\.json: .*5 MB/);

  let deep = 1;
  for (let i = 0; i < 40; i++) deep = { n: deep };
  writeFileSync(join(fx.audit, 'findings.json'), JSON.stringify({ ...fx.doc, extra: deep }));
  expectError(validate(fx.audit), /nesting/);

  rmSync(join(fx.audit, 'findings.json'));
  mkdirSync(join(fx.audit, 'findings.json'));
  expectError(validate(fx.audit), /findings\.json: .*regular file/);
});

test('CLI exits 1 and lists errors', () => {
  const fx = fixture();
  fx.doc.findings[0].locations[0].path = 'src/nope.js';
  write(fx);
  const p = spawnSync(process.execPath, [VALIDATE, fx.audit], { encoding: 'utf8' });
  assert.equal(p.status, 1);
  assert.match(p.stdout + p.stderr, /findings\[0\]\.locations\[0\]\.path/);
});

// ---------- report ----------

test('report has the six sections in order', () => {
  const fx = fixture();
  write(fx);
  const html = render(fx.audit);
  const ids = ['how-to-read', 'summary', 'findings', 'platforms', 'coverage', 'your-steps'];
  const at = ids.map((id) => html.indexOf(`id="${id}"`));
  for (let i = 0; i < ids.length; i++) assert.ok(at[i] > -1, `missing #${ids[i]}`);
  assert.deepEqual([...at].sort((a, b) => a - b), at, 'sections out of order');
  assert.match(html, /How to read this report/);
  assert.match(html, /must not be shared or committed/);
  assert.ok(!/<(script|link)[^>]+(src|href)=["']https?:/i.test(html), 'no external requests');
});

test('report escapes finding text', () => {
  const fx = fixture();
  fx.doc.findings[0].title = 'XSS <script>alert(1)</script> & "q"';
  write(fx);
  const html = render(fx.audit);
  assert.ok(!html.includes('<script>alert(1)</script>'));
  assert.ok(html.includes('&lt;script&gt;alert(1)&lt;/script&gt;'));
});

test('report lists confirmed by severity before needs_validation before rejected', () => {
  const fx = fixture();
  write(fx);
  const html = render(fx.audit);
  const pos = (t) => html.indexOf(t);
  assert.ok(pos('Any user can read another user invoice') < pos('Main branch is not protected'));
  assert.ok(pos('Main branch is not protected') < pos('Rate limit may be missing on login'));
  assert.ok(pos('Rate limit may be missing on login') < pos('SQL injection in search'));
  assert.match(html, /<details[^>]*>[\s\S]*SQL injection in search/);
});

test('CLI writes report.html with mode 0600 and prints path + file URL', () => {
  const fx = fixture();
  write(fx);
  const p = spawnSync(process.execPath, [RENDER, fx.audit], { encoding: 'utf8' });
  assert.equal(p.status, 0, p.stderr);
  const out = join(fx.audit, 'report.html');
  assert.ok(existsSync(out));
  assert.equal(statSync(out).mode & 0o777, 0o600);
  assert.ok(p.stdout.includes(out));
  assert.match(p.stdout, /file:\/\//);
});

test('--lang es shows Spanish headings', () => {
  const fx = fixture();
  write(fx);
  const p = spawnSync(process.execPath, [RENDER, fx.audit, '--lang', 'es'], { encoding: 'utf8' });
  assert.equal(p.status, 0, p.stderr);
  const html = readFileSync(join(fx.audit, 'report.html'), 'utf8');
  assert.match(html, /Cómo leer este informe/);
  assert.match(html, /lang="es"/);
});

test('render refuses an invalid dir', () => {
  const fx = fixture();
  delete fx.doc.findings[0].severity;
  write(fx);
  assert.throws(() => render(fx.audit), /severity/);
  const p = spawnSync(process.execPath, [RENDER, fx.audit], { encoding: 'utf8' });
  assert.equal(p.status, 1);
  assert.match(p.stdout + p.stderr, /findings\[0\]\.severity/);
  assert.ok(!existsSync(join(fx.audit, 'report.html')));
});

// ---------- round 1: portability ----------

test('both CLIs run from a copy of the skill inside a CommonJS project', () => {
  const fx = fixture();
  write(fx);
  writeFileSync(join(fx.project, 'package.json'), JSON.stringify({ name: 'app', type: 'commonjs' }));
  const copy = join(fx.project, '.claude', 'skills', 'security-audit');
  cpSync(SKILL_DIR, copy, { recursive: true });
  const v = spawnSync(process.execPath, [join(copy, 'scripts', 'validate-findings.mjs'), fx.audit], { encoding: 'utf8' });
  assert.equal(v.status, 0, v.stderr);
  assert.match(v.stdout, /^OK/);
  const r = spawnSync(process.execPath, [join(copy, 'scripts', 'render-report.mjs'), fx.audit], { encoding: 'utf8' });
  assert.equal(r.status, 0, r.stderr);
  assert.ok(existsSync(join(fx.audit, 'report.html')));
});

// ---------- round 1: secret scanner is linear and capped ----------

test('a 1 MB single-line hex evidence file validates in under 2 s', () => {
  const fx = fixture();
  writeFileSync(join(fx.audit, 'evidence', 'idor.txt'), 'HTTP/1.1 200 OK\n' + '0123456789abcdef'.repeat(65536) + '\n');
  write(fx);
  const t = Date.now();
  const r = validate(fx.audit);
  const ms = Date.now() - t;
  assert.deepEqual(r.errors, []);
  assert.ok(ms < 2000, `took ${ms} ms`);
});

test('adversarial lines scan in linear time', () => {
  const inputs = [
    'a'.repeat(300000),
    'password'.repeat(40000),
    'token='.repeat(50000),
    'eyJ'.repeat(100000),
    'x://'.repeat(80000) + 'a:',
    'Authorization: Basic '.repeat(15000),
    '_secret_'.repeat(40000) + '="',
  ];
  for (const s of inputs) {
    const t = Date.now();
    secretKinds(s);
    const ms = Date.now() - t;
    assert.ok(ms < 1000, `took ${ms} ms on ${s.slice(0, 12)}…`);
  }
});

test('a scanned file over 2 MB is refused', () => {
  const r = check((d, fx) => { writeFileSync(join(fx.audit, 'evidence', 'idor.txt'), 'x'.repeat(2 * 1024 * 1024 + 1)); });
  expectError(r, /too large to scan; redact or trim/);
});

// ---------- round 1: credential assignments: literals only ----------

test('code that merely names a credential is not flagged', () => {
  const lines = [
    'user.password = hashPassword(req.body.password);',
    'const token = jwt.sign(payload, key)',
    'api_key = request.headers.get("x-api-key")',
    'Reset link accepts token=req.query.reset_token without expiry',
    'csrf_token=generateCsrfToken()',
    'password = [REDACTED]',
    'API_KEY=${API_KEY}',
    'API_KEY=process.env.API_KEY_VALUE_FROM',
    'const secret = process.env.SESSION_SECRET_VALUE;',
  ];
  for (const l of lines) assert.deepEqual(secretKinds(l), [], l);
  const r = check((d) => { d.findings[0].title = lines[3]; d.findings[0].impact = lines[0]; });
  assert.deepEqual(r.errors, []);
});

test('literal credential values are flagged without echoing them', () => {
  const env = 'API_KEY=' + '9f8e7d6c5b4a3928' + '1706f5e4d3c2b1a0';
  const pw = 'Sup3rS3cret' + 'Passw0rd!';
  for (const [s, v] of [[env, env.slice(8)], ['password: "' + pw + '"', pw], ['  "client_secret": "' + pw + '"', pw]]) {
    assert.ok(secretKinds(s).includes('credential assignment'), s);
    const r = check((d, fx) => { writeFileSync(join(fx.audit, 'evidence', 'idor.txt'), s + '\n'); });
    expectError(r, /line 1 contains a likely live secret \(credential assignment\)/);
    assert.ok(!r.errors.join('\n').includes(v));
  }
});

// ---------- round 1: shapes the first version missed ----------

test('more secret shapes are caught and never printed', () => {
  const b64 = Buffer.from('admin:' + 'hunter2hunter2').toString('base64');
  const cases = {
    'URL credentials': 'postgres://app:' + 'Pr0dPassw0rd2026' + '@db.internal:5432/prod',
    'OpenAI key': 'sk-' + 'proj-' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6',
    'OpenAI key ': 'sk-' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6Q7r8S9t0U1v2W3x4',
    'Anthropic key': 'sk-' + 'ant-api03-' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4',
    'Google API key': 'AI' + 'za' + 'SyA1b2C3d4E5f6G7h8I9j0K1l2M3n4O5p6q',
    'Stripe webhook secret': 'wh' + 'sec_' + 'A1b2C3d4E5f6G7h8I9j0K1l2M3n4',
    'Stripe key': 'sk_' + 'test_' + 'A1b2C3d4E5f6G7h8I9j0',
    'Stripe key ': 'rk_' + 'test_' + 'A1b2C3d4E5f6G7h8I9j0',
    'Supabase secret key': 'sb_' + 'secret_' + 'A1b2C3d4E5f6G7h8I9j0K1l2',
    'Basic credentials': 'Authorization: Basic ' + b64,
  };
  for (const [kind, s] of Object.entries(cases)) {
    assert.ok(secretKinds(`see ${s} here`).includes(kind.trim()), `${kind}: got ${secretKinds(s)}`);
    const r = check((d) => { d.findings[0].impact = `leaked ${s} in logs`; });
    expectError(r, /findings\[0\]\.impact: .*secret/);
    assert.ok(!r.errors.join('\n').includes(s), `${kind} echoed`);
  }
});

test('redacted and placeholder forms of the new shapes pass', () => {
  const ok = [
    'postgres://app@db.internal:5432/prod',
    'postgres://app:<password>@db.internal/prod',
    'postgres://app:****@db.internal/prod',
    'https://example.com/a:b@c',
    'sk_test_****', 'whsec_[REDACTED]', 'sk-ant-****', 'Authorization: Basic ****',
    'Authorization: Basic [REDACTED:basic]',
  ];
  for (const s of ok) assert.deepEqual(secretKinds(s), [], s);
});

// ---------- round 1: object keys ----------

test('a secret used as an object key fails and the key is never echoed', () => {
  const r = check((d) => { d.run.scope = { [GH_TOKEN]: 'password=' + 'ZZZZZZZZZZZZZZZZZZZZ' }; });
  expectError(r, /run\.scope\[key#0\]: .*secret/);
  assert.ok(!r.errors.join('\n').includes(GH_TOKEN));
  const r2 = check((d) => { d.run.scope = { [AWS_KEY]: true }; });
  expectError(r2, /run\.scope\[key#0\]: .*key contains a likely live secret/);
  assert.ok(!r2.errors.join('\n').includes(AWS_KEY));
});

test('an odd evidence file name is never echoed, even past 20 secret lines', () => {
  const name = 'evidence/' + 'n'.repeat(80) + '.txt';
  const r = check((d, fx) => {
    writeFileSync(join(fx.audit, name), Array.from({ length: 25 }, () => `k=${AWS_KEY}`).join('\n') + '\n');
    d.findings[0].evidence[0].path = name;
  });
  expectError(r, /more lines with likely secrets not listed/);
  assert.ok(!r.errors.join('\n').includes('n'.repeat(80)));
});

// ---------- round 1: every file in the audit dir is scanned ----------

test('a secret anywhere in the audit dir fails, scratch/ and report.html excepted', () => {
  const r = check((d, fx) => {
    mkdirSync(join(fx.audit, 'fixes', 'F-001'), { recursive: true });
    writeFileSync(join(fx.audit, 'fixes', 'F-001', 'before.json'), `{"k":"${GH_TOKEN}"}\n`);
  });
  expectError(r, /fixes\/F-001\/before\.json.*line 1.*secret.*GitHub token/);
  assert.ok(!r.errors.join('\n').includes(GH_TOKEN));
  expectError(check((d, fx) => { writeFileSync(join(fx.audit, 'ledger.json'), `{"note":"${AWS_KEY}"}\n`); }), /ledger\.json.*line 1.*AWS access key/);
  expectError(check((d, fx) => { writeFileSync(join(fx.audit, 'architecture.md'), `token ${GH_TOKEN}\n`); }), /architecture\.md.*secret/);
  const ok = check((d, fx) => {
    mkdirSync(join(fx.audit, 'scratch', 'h1'), { recursive: true });
    writeFileSync(join(fx.audit, 'scratch', 'h1', 'raw.txt'), `${GH_TOKEN}\n`);
    writeFileSync(join(fx.audit, 'report.html'), `<p>${AWS_KEY}</p>\n`);
  });
  assert.deepEqual(ok.errors, []);
});

test('a symlink inside the audit dir fails', () => {
  const r = check((d, fx) => {
    writeFileSync(join(fx.base, 'outside.txt'), 'x\n');
    symlinkSync(join(fx.base, 'outside.txt'), join(fx.audit, 'evidence', 'link.txt'));
  });
  expectError(r, /audit-dir: .*symlink/);
});

// ---------- round 1: evidence must live under evidence/ or fixes/ ----------

test('evidence citing the audit records themselves fails', () => {
  expectError(check((d) => { d.findings[0].evidence[0].path = 'findings.json'; }), /findings\[0\]\.evidence\[0\]\.path: .*under evidence\/ or fixes\//);
  expectError(check((d, fx) => { writeFileSync(join(fx.audit, 'ledger.json'), '{}\n'); d.findings[0].fix.recheck.artifact = 'ledger.json'; }),
    /findings\[0\]\.fix\.recheck\.artifact: .*under evidence\/ or fixes\//);
  const ok = check((d, fx) => {
    mkdirSync(join(fx.audit, 'fixes', 'F-001'), { recursive: true });
    writeFileSync(join(fx.audit, 'fixes', 'F-001', 'recheck.txt'), 'HTTP/1.1 403\n');
    d.findings[0].fix.recheck.artifact = 'fixes/F-001/recheck.txt';
  });
  assert.deepEqual(ok.errors, []);
});

// ---------- round 1: tool_path ----------

test('tool_path must be a real 01-TOOLS/security/<platform>/ dir with a README and a check', () => {
  const tp = (v, prep = () => {}) => check((d, fx) => { prep(fx); d.platforms[0].tool_path = v; });
  for (const v of ['01-TOOLS/', '01-TOOLS/.', '01-TOOLS/security/', '01-TOOLS/security/github/../github', '01-TOOLS/security/a/b', '01-TOOLS/GITHUB']) {
    expectError(tp(v), /platforms\[0\]\.tool_path: .*01-TOOLS\/security\/<platform>/);
  }
  expectError(tp('01-TOOLS/security/link', (fx) => {
    mkdirSync(join(fx.base, 'elsewhere'));
    writeFileSync(join(fx.base, 'elsewhere', 'README.md'), 'x');
    writeFileSync(join(fx.base, 'elsewhere', 'check.sh'), 'x');
    symlinkSync(join(fx.base, 'elsewhere'), join(fx.project, '01-TOOLS', 'security', 'link'));
  }), /platforms\[0\]\.tool_path: .*symlink/);
  expectError(tp('01-TOOLS/security/empty', (fx) => mkdirSync(join(fx.project, '01-TOOLS', 'security', 'empty'))),
    /platforms\[0\]\.tool_path: .*README\.md/);
  expectError(tp('01-TOOLS/security/noreadme', (fx) => {
    mkdirSync(join(fx.project, '01-TOOLS', 'security', 'noreadme'));
    writeFileSync(join(fx.project, '01-TOOLS', 'security', 'noreadme', 'check.sh'), 'x');
  }), /platforms\[0\]\.tool_path: .*README\.md/);
  expectError(tp('01-TOOLS/security/onlyreadme', (fx) => {
    mkdirSync(join(fx.project, '01-TOOLS', 'security', 'onlyreadme'));
    writeFileSync(join(fx.project, '01-TOOLS', 'security', 'onlyreadme', 'README.md'), 'x');
  }), /platforms\[0\]\.tool_path: .*other file/);
  assert.deepEqual(tp('01-TOOLS/security/github/').errors, []);
});

// ---------- round 1: complete must cover something ----------

test('complete with no units and no platforms is refused', () => {
  expectError(check((d) => {
    d.findings = d.findings.filter((f) => f.verdict === 'rejected');
    d.coverage.units = [];
    d.platforms = [];
  }), /run\.status: .*nothing was reviewed/);
});

// ---------- round 1: report writing ----------

test('render refuses a hard-linked or symlinked report.html', () => {
  const fx = fixture();
  write(fx);
  const other = join(fx.base, 'victim.txt');
  writeFileSync(other, 'keep me\n');
  linkSync(other, join(fx.audit, 'report.html'));
  assert.throws(() => writeReport(fx.audit), /hard link/);
  assert.equal(readFileSync(other, 'utf8'), 'keep me\n');
  rmSync(join(fx.audit, 'report.html'));
  symlinkSync(other, join(fx.audit, 'report.html'));
  assert.throws(() => writeReport(fx.audit), /not a regular file/);
  assert.equal(readFileSync(other, 'utf8'), 'keep me\n');
});

test('an existing report.html is rewritten with mode 0600', () => {
  const fx = fixture();
  write(fx);
  writeFileSync(join(fx.audit, 'report.html'), 'old', { mode: 0o644 });
  const out = writeReport(fx.audit);
  assert.equal(statSync(out).mode & 0o777, 0o600);
  assert.match(readFileSync(out, 'utf8'), /Security audit report/);
});

test('a cited project file over 5 MB is an error, not a crash', () => {
  expectError(check((d, fx) => {
    writeFileSync(join(fx.project, 'src', 'big.js'), 'x'.repeat(5 * 1024 * 1024 + 1));
    d.findings[0].locations[0].path = 'src/big.js';
    d.findings[0].locations[0].line_start = 1;
    d.findings[0].locations[0].line_end = 1;
  }), /findings\[0\]\.locations\[0\]\.path: .*larger than 5 MB/);
});

// ---------- round 1: rules the first suite never exercised ----------

test('a unit that is not done needs a reason', () => {
  expectError(check((d) => { d.run.status = 'partial'; d.run.partial_reason = 'x'; d.coverage.units[0].status = 'blocked'; }), /coverage\.units\[0\]\.reason: .*required/);
  expectError(check((d) => { d.run.status = 'partial'; d.run.partial_reason = 'x'; d.coverage.units[0].status = 'not_reviewed'; }), /coverage\.units\[0\]\.reason: .*required/);
});

test('a not_reviewed platform needs a reason', () => {
  expectError(check((d) => {
    d.run.status = 'partial'; d.run.partial_reason = 'x';
    d.platforms.push({ name: 'vercel', detected_by: 'vercel.json', access: 'none', status: 'not_reviewed' });
  }), /platforms\[1\]\.reason: .*required/);
});

test('line_start after line_end fails', () => {
  expectError(check((d) => { d.findings[0].locations[0].line_start = 8; d.findings[0].locations[0].line_end = 4; }), /findings\[0\]\.locations\[0\]\.line_start: .*after line_end/);
});

test('duplicate coverage unit id fails', () => {
  expectError(check((d) => { d.coverage.units[1].id = 'U-1'; }), /coverage\.units\[1\]\.id: .*duplicate/);
});

test('a not_run recheck artifact is still checked', () => {
  expectError(check((d) => { d.findings[1].fix.recheck.artifact = 'evidence/gone.txt'; }), /findings\[1\]\.fix\.recheck\.artifact: .*does not exist/);
  expectError(check((d) => { d.findings[1].fix.recheck.artifact = '../../x'; }), /findings\[1\]\.fix\.recheck\.artifact: .*escape/);
});
