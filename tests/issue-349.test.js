import { test } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtempSync, mkdirSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join, dirname } from 'node:path';
import { execFileSync, spawnSync } from 'node:child_process';
import * as sello from '../targets/sello.mjs';
import { linkedSpecs, asddGate } from '../targets/asdd-gate.mjs';
import { specCompleteness } from '../targets/spec-completeness.mjs';
const git = (d, ...a) =>
  execFileSync('git', ['-C', d, ...a], {
    encoding: 'utf8',
    stdio: ['ignore', 'pipe', 'pipe'],
  }).trim();
const write = (d, p, s) => {
  mkdirSync(dirname(join(d, p)), { recursive: true });
  writeFileSync(join(d, p), s);
};
function repo(branch = 'develop') {
  const d = mkdtempSync(join(tmpdir(), 'rsc-349-'));
  git(d, 'init', '-qb', branch);
  git(d, 'config', 'user.email', 't@example.com');
  git(d, 'config', 'user.name', 'Test');
  write(d, 'a.txt', 'initial');
  git(d, 'add', '.');
  git(d, 'commit', '-qm', 'initial');
  return d;
}
const SPEC = `---\ntimestamp: 2026-11-11\nbranches: [feat/a, fix/b]\n---\n${['Problem & why', 'Cost of not building it', 'The cheapest alternative', 'Goals', 'Non-goals', 'Users & context', 'What the user can do', 'What result they get', 'What it must respect', 'How it proves it', 'Behaviour', 'Acceptance criteria', 'Points to clarify'].map((h) => `## ${h}\nFilled.\n`).join('')}`;
test('349 trunk uses remote HEAD and configured closest candidate', () => {
  const d = repo();
  git(d, 'update-ref', 'refs/remotes/origin/develop', 'HEAD');
  git(
    d,
    'symbolic-ref',
    'refs/remotes/origin/HEAD',
    'refs/remotes/origin/develop',
  );
  assert.equal(sello.trunkRef(d), 'origin/develop');
  assert.equal(
    sello.trunkRef(d, { trunks: ['missing', 'develop'] }),
    'develop',
  );
});
test('349 specs bind arrays and FTD references, with CRLF and BOM', () => {
  const d = repo();
  write(
    d,
    '02-DOCS/wiki/sdd/specs/shared.md',
    '\uFEFF' + SPEC.replaceAll('\n', '\r\n'),
  );
  assert.equal(linkedSpecs(d, 'fix/b', specCompleteness).length, 1);
  write(
    d,
    '02-DOCS/wiki/ftd/feature.md',
    '---\nbranch: feat/c\nspec: shared\n---\n',
  );
  assert.equal(linkedSpecs(d, 'feat/c', specCompleteness).length, 1);
  assert.equal(linkedSpecs(d, 'feat/shared-extra', specCompleteness).length, 0);
});
test('349 custom rules inspect removals, JSON keys, repo scopes and tier zero', () => {
  const cfg = {
    repo: '.',
    risk: {
      rules: [
        {
          class: 'schema',
          tier: 2,
          path: '\\.al$',
          removed: '^field\\(',
          because: 'Removing a field breaks schema.',
        },
        {
          class: 'editor',
          tier: 0,
          path: '^editor\\.json$',
          because: 'Editor only.',
        },
        {
          class: 'platform',
          tier: 2,
          path: '^app\\.json$',
          jsonKeys: ['runtime'],
          because: 'Runtime changes.',
        },
      ],
    },
  };
  assert.equal(
    sello.classifyChange(['x.al'], {}, cfg, {
      'x.al': {
        removed: ['field(1; X; Text)'],
        added: [],
        before: '',
        after: '',
      },
    }).tier,
    2,
  );
  assert.equal(sello.classifyChange(['editor.json'], {}, cfg).tier, 0);
  assert.equal(
    sello.classifyChange(['app.json'], {}, cfg, {
      'app.json': {
        before: '{"runtime":"1","version":"1"}',
        after: '{"runtime":"1","version":"2"}',
      },
    }).tier,
    1,
  );
  assert.equal(
    sello.classifyChange(['app.json'], {}, cfg, {
      'app.json': { before: '{"runtime":"1"}', after: '{"runtime":"2"}' },
    }).tier,
    2,
  );
  assert.equal(
    sello.classifyChange(
      ['.env'],
      {},
      { risk: { rules: [{ tier: 0, path: '.*', class: 'all' }] } },
    ).tier,
    2,
  );
});
test('349 versioned policy from trunk survives outgoing downgrade', () => {
  const d = repo('main');
  write(
    d,
    '.rsc-risk.json',
    JSON.stringify({
      version: 1,
      rules: [
        {
          path: '\\.al$',
          tier: 2,
          class: 'schema',
          because: 'Schema requires review.',
        },
      ],
    }),
  );
  git(d, 'add', '.');
  git(d, 'commit', '-qm', 'policy');
  git(d, 'switch', '-qc', 'feat/schema');
  write(d, '.rsc-risk.json', JSON.stringify({ version: 1, rules: [] }));
  write(d, 'x.al', 'table 1 X {}');
  const why = asddGate(d, 'git push', { sello, specCompleteness });
  assert.match(why || '', /risk tier 2/);
});
test('349 gate checks git -C target instead of workspace branch', () => {
  const d = repo('main');
  const child = join(d, 'Child repo');
  mkdirSync(child);
  git(child, 'init', '-qb', 'main');
  git(child, 'config', 'user.email', 't@example.com');
  git(child, 'config', 'user.name', 'Test');
  write(child, 'a.txt', 'a');
  git(child, 'add', '.');
  git(child, 'commit', '-qm', 'initial');
  git(child, 'switch', '-qc', 'feat/login');
  write(child, 'auth/login.js', 'changed');
  assert.match(
    asddGate(d, 'git -C "Child repo" push', { sello, specCompleteness }) || '',
    /feat\/login/,
  );
});
const CLI = new URL('../scripts/rsc.js', import.meta.url).pathname;
test('349 external CLI branch gate distinguishes denial, allow and environment error', () => {
  const d = repo('main');
  git(d, 'switch', '-qc', 'feat/login');
  write(d, 'auth/login.js', 'changed');
  const invoke = (root, args = []) =>
    spawnSync(
      process.execPath,
      [CLI, 'spec', 'gate', '--branch-check', '--repo', root, ...args],
      { cwd: d, encoding: 'utf8' },
    );
  assert.equal(invoke(d).status, 2);
  assert.equal(invoke(d, ['--branch', 'main']).status, 0);
  assert.equal(invoke(join(d, 'missing')).status, 1);
});
test('349 risk CLI uses trunk rules and reports source; preview is explicit', () => {
  const d = repo('main');
  write(
    d,
    '.rsc-risk.json',
    JSON.stringify({
      version: 1,
      rules: [
        { path: '\\.al$', tier: 2, class: 'al', because: 'AL is sensitive.' },
      ],
    }),
  );
  git(d, 'add', '.');
  git(d, 'commit', '-qm', 'policy');
  git(d, 'switch', '-qc', 'feat/al');
  write(d, 'x.al', 'x');
  write(d, '.rsc-risk.json', JSON.stringify({ version: 1, rules: [] }));
  const run = (extra = []) =>
    JSON.parse(
      spawnSync(process.execPath, [CLI, 'risk', 'x.al', '--json', ...extra], {
        cwd: d,
        encoding: 'utf8',
      }).stdout,
    );
  assert.equal(run().tier, 2);
  assert.match(run().policySource, /main/);
  assert.equal(run(['--policy-preview']).tier, 1);
});
test('349 sync preserves teammate opt-outs without changing existing local switches', async () => {
  const { applyInstall, syncInstalled } = await import(
    '../scripts/install-apply.js'
  );
  const { writeManifest, readManifest } = await import(
    '../scripts/lib/manifest-file.js'
  );
  const d = repo('main');
  await applyInstall({
    skillIds: ['orient'],
    target: 'claude',
    cwd: d,
    home: d,
  });
  writeManifest(d, { ...readManifest(d), optOuts: ['gitmoji'] });
  await syncInstalled({ target: 'claude', cwd: d, home: d });
  assert.deepEqual(readManifest(d).optOuts, ['gitmoji']);
});
test('349 rules distinguish production, containment, deletion and rename old path', () => {
  const cfg = {
    repo: 'Prod',
    risk: {
      rules: [
        {
          class: 'api',
          tier: 2,
          path: '\\.Page\\.al$',
          contains: 'PageType\\s*=\\s*API',
          removed: 'APIVersion',
          productionOnly: true,
          repos: ['Prod'],
        },
      ],
    },
  };
  const detail = {
    oldPath: 'Old.Page.al',
    before: 'PageType = API;\nAPIVersion = 1;',
    after: '',
    removed: ['APIVersion = 1;'],
    status: 'D',
  };
  assert.equal(
    sello.classifyChange(['New.al'], {}, cfg, { 'New.al': detail }).tier,
    2,
  );
  assert.equal(
    sello.classifyChange(
      ['New.al'],
      {},
      { ...cfg, testRepo: true },
      { 'New.al': { ...detail } },
    ).tier,
    1,
  );
  assert.equal(
    sello.classifyChange(
      ['New.al'],
      {},
      { ...cfg, repo: 'Other' },
      { 'New.al': { ...detail } },
    ).tier,
    1,
  );
  const bad = { risk: { rules: [{ class: 'bad', tier: 0, path: '(a+)+$' }] } };
  assert.equal(sello.classifyChange(['x'], {}, bad).tier, 2);
  assert.match(sello.classifyChange(['x'], {}, bad).configError, /Recover/);
});
test('349 branch override evaluates that branch, not the current working tree', () => {
  const d = repo('main');
  git(d, 'switch', '-qc', 'feat/login');
  write(d, 'auth/login.js', 'changed');
  git(d, 'add', '.');
  git(d, 'commit', '-qm', 'auth');
  git(d, 'switch', '-q', 'main');
  const r = spawnSync(
    process.execPath,
    [
      CLI,
      'spec',
      'gate',
      '--branch-check',
      '--repo',
      d,
      '--branch',
      'feat/login',
    ],
    { cwd: d, encoding: 'utf8' },
  );
  assert.equal(r.status, 2, r.stdout + r.stderr);
});
test('349 wrapped pushes preserve quoted directories and shell directory changes', async () => {
  const { reposWithPush } = await import('../targets/asdd-gate.mjs');
  const d = repo('main');
  const child = join(d, 'Child repo');
  mkdirSync(child);
  git(child, 'init', '-qb', 'main');
  const expected = git(child, 'rev-parse', '--show-toplevel');
  assert.deepEqual(reposWithPush('cd "Child repo" && bash -c "git push"', d), [
    expected,
  ]);
  assert.deepEqual(reposWithPush('echo "git push"', d), []);
  assert.deepEqual(reposWithPush('git -C "Child repo" push; git push', d), [
    expected,
    git(d, 'rev-parse', '--show-toplevel'),
  ]);
});
test('349 hostile adjacent quantifiers cannot hang the hook', () => {
  const url = new URL('../targets/sello.mjs', import.meta.url).href;
  const script = `import {classifyChange} from ${JSON.stringify(url)}; console.log(JSON.stringify(classifyChange(['x.al'],{}, {risk:{rules:[{class:'slow',tier:2,removed:'a+a+a+a+a+$'}]}},{'x.al':{removed:['a'.repeat(1999)+'!']}})));`;
  const r = spawnSync(process.execPath, ['--input-type=module', '-e', script], {
    encoding: 'utf8',
    timeout: 2500,
  });
  assert.equal(r.status, 0, 'classification must return, not hang');
  const result = JSON.parse(r.stdout);
  assert.equal(result.tier, 2);
  assert.match(result.configError, /bounded|time|Recover/);
});
test('349 develop is a safe conventional bootstrap without origin HEAD', () => {
  const d = repo('develop');
  write(
    d,
    '.rsc-risk.json',
    JSON.stringify({
      version: 1,
      trunks: ['develop'],
      rules: [{ path: '\\.al$', class: 'al', tier: 2 }],
    }),
  );
  git(d, 'add', '.');
  git(d, 'commit', '-qm', 'policy');
  git(d, 'switch', '-qc', 'feat/al');
  write(d, 'x.al', 'x');
  assert.match(
    asddGate(d, 'git push', { sello, specCompleteness }) || '',
    /risk tier 2/,
  );
});
test('349 real submodule inherits workspace policy while inspecting its own diff', () => {
  const d = repo('main');
  const source = repo('develop');
  git(
    d,
    '-c',
    'protocol.file.allow=always',
    'submodule',
    'add',
    '-q',
    source,
    'Catman',
  );
  write(
    d,
    '.rsc-risk.json',
    JSON.stringify({
      version: 1,
      repositories: { Catman: { trunks: ['develop'] } },
      rules: [
        {
          path: '\\.al$',
          removed: 'field\\(',
          repos: ['Catman'],
          class: 'schema',
          tier: 2,
          because: 'Removing a field.',
        },
      ],
    }),
  );
  git(d, 'add', '.');
  git(d, 'commit', '-qm', 'submodule and policy');
  const child = join(d, 'Catman');
  git(child, 'config', 'user.email', 't@example.com');
  git(child, 'config', 'user.name', 'Test');
  write(child, 'X.Table.al', 'field(1; X; Text)\n');
  git(child, 'add', '.');
  git(child, 'commit', '-qm', 'schema');
  git(child, 'switch', '-qc', 'feat/change');
  write(child, 'X.Table.al', 'table 1 X {}\n');
  const risk = spawnSync(process.execPath, [CLI, 'risk', '--json'], {
    cwd: child,
    encoding: 'utf8',
  });
  assert.equal(risk.status, 0, risk.stdout + risk.stderr);
  assert.equal(JSON.parse(risk.stdout).tier, 2);
  const check = spawnSync(
    process.execPath,
    [CLI, 'spec', 'gate', '--branch-check'],
    { cwd: child, encoding: 'utf8' },
  );
  assert.equal(check.status, 2, check.stdout + check.stderr);
  assert.match(check.stdout, /Removing a field/);
});
test('349 trusted spec-only policy passes a complete linked spec but outgoing exemption does not', () => {
  const d = repo('main');
  write(
    d,
    '.rsc-risk.json',
    JSON.stringify({ version: 1, asddGate: { require: 'spec' } }),
  );
  git(d, 'add', '.');
  git(d, 'commit', '-qm', 'policy');
  git(d, 'switch', '-qc', 'feat/a');
  write(d, 'auth/login.js', 'changed');
  write(d, '02-DOCS/wiki/sdd/specs/shared.md', SPEC);
  assert.equal(asddGate(d, 'git push', { sello, specCompleteness }), null);
  write(
    d,
    '02-DOCS/wiki/sdd/specs/shared.md',
    '---\nbranch: feat/a\n---\ninvalid',
  );
  write(
    d,
    '.rsc-risk.json',
    JSON.stringify({ version: 1, asddGate: { exemptBranches: ['.*'] } }),
  );
  assert.match(
    asddGate(d, 'git push', { sello, specCompleteness }) || '',
    /does not pass/,
  );
});
test('349 actual removed-line diff and renames retain old-path rules', () => {
  const d = repo('main');
  write(d, 'Old.Table.al', 'field(1; X; Text)\n');
  git(d, 'add', '.');
  git(d, 'commit', '-qm', 'schema');
  git(d, 'switch', '-qc', 'feat/rename');
  git(d, 'mv', 'Old.Table.al', 'New.al');
  const paths = ['Old.Table.al', 'New.al'];
  const details = sello.changeDetails(d, 'main', paths);
  const result = sello.classifyChange(
    paths,
    {},
    {
      risk: {
        rules: [
          {
            class: 'schema',
            tier: 2,
            path: '\\.Table\\.al$',
            removed: 'field\\(',
            because: 'Removing schema.',
          },
        ],
      },
    },
    details,
  );
  assert.equal(result.tier, 2);
  assert.ok(result.rules.some((r) => r.path === 'Old.Table.al'));
});
test('349 installed hook loads policy sibling and doctor reports missing trunk', async () => {
  const { applyInstall } = await import('../scripts/install-apply.js');
  const { doctor } = await import('../scripts/doctor.js');
  const d = repo('main');
  await applyInstall({
    skillIds: ['orient', 'suggest'],
    target: 'claude',
    cwd: d,
    home: d,
    policy: { codeHooks: true },
  });
  git(d, 'switch', '-qc', 'feat/login');
  write(d, 'auth/login.js', 'changed');
  const hook = spawnSync(
    process.execPath,
    [join(d, '.rsc', 'ship-guard.mjs'), d],
    {
      input: JSON.stringify({
        tool_name: 'Bash',
        tool_input: { command: 'git push' },
      }),
      encoding: 'utf8',
    },
  );
  assert.match(hook.stdout, /risk tier 2/, hook.stderr);
  const noTrunk = repo('unusual');
  await applyInstall({
    skillIds: ['orient', 'suggest'],
    target: 'claude',
    cwd: noTrunk,
    home: noTrunk,
    policy: { codeHooks: true },
  });
  assert.equal(
    doctor({ cwd: noTrunk, home: noTrunk, target: 'claude' }).asddGate.state,
    'no-trunk',
  );
});
test('349 policy file keeps harness floor and sello reads removed-line policy too', () => {
  assert.equal(
    sello.classifyChange(
      ['.rsc-risk.json'],
      {},
      { risk: { rules: [{ class: 'everything', tier: 0, path: '.*' }] } },
    ).tier,
    2,
  );
  const d = repo('main');
  write(d, 'X.Table.al', 'field(1; X; Text)\n');
  write(
    d,
    '.rsc-risk.json',
    JSON.stringify({
      version: 1,
      rules: [
        { class: 'schema', tier: 2, path: '\\.al$', removed: 'field\\(' },
      ],
    }),
  );
  git(d, 'add', '.');
  git(d, 'commit', '-qm', 'policy and schema');
  git(d, 'switch', '-qc', 'feat/change');
  write(d, 'X.Table.al', 'table 1 X {}\n');
  const candidate = sello.computeCandidate(d);
  assert.equal(sello.classifyCandidate(d, candidate).tier, 2);
});
test('349 explicit main lock retires its opt-out but preserves unrelated team opt-outs', async () => {
  const { applyInstall } = await import('../scripts/install-apply.js');
  const { readManifest, writeManifest } = await import(
    '../scripts/lib/manifest-file.js'
  );
  const d = repo('main');
  await applyInstall({
    skillIds: ['orient'],
    target: 'claude',
    cwd: d,
    home: d,
  });
  writeManifest(d, { ...readManifest(d), optOuts: ['trunk-guard', 'gitmoji'] });
  const run = spawnSync(
    process.execPath,
    [CLI, 'main', 'lock', '--target', 'claude'],
    { cwd: d, encoding: 'utf8' },
  );
  assert.equal(run.status, 0, run.stdout + run.stderr);
  assert.deepEqual(readManifest(d).optOuts, ['gitmoji', 'trunk-open']);
});
test('349 external --repo uses that repository policy from an unrelated cwd', () => {
  const d = repo('main');
  write(
    d,
    '.rsc-risk.json',
    JSON.stringify({
      version: 1,
      rules: [{ class: 'al', tier: 2, path: '\\.al$' }],
    }),
  );
  git(d, 'add', '.');
  git(d, 'commit', '-qm', 'policy');
  git(d, 'switch', '-qc', 'feat/al');
  write(d, 'X.al', 'code');
  const run = spawnSync(
    process.execPath,
    [CLI, 'spec', 'gate', '--branch-check', '--repo', d],
    { cwd: tmpdir(), encoding: 'utf8' },
  );
  assert.equal(run.status, 2, run.stdout + run.stderr);
});

test('349 malformed nested repository rules cannot make the hook fail open', () => {
  const d = repo('main');
  write(
    d,
    '.rsc-risk.json',
    JSON.stringify({ version: 1, repositories: { '.': { rules: {} } } }),
  );
  git(d, 'add', '.');
  git(d, 'commit', '-qm', 'malformed nested policy');
  git(d, 'switch', '-qc', 'feat/login');
  write(d, 'auth/login.js', 'changed');
  const guard = new URL('../targets/ship-guard.mjs', import.meta.url).pathname;
  const result = spawnSync(process.execPath, [guard, d], {
    input: JSON.stringify({
      tool_name: 'Bash',
      tool_input: { command: 'git push' },
    }),
    encoding: 'utf8',
  });
  assert.equal(result.status, 0, result.stderr);
  assert.match(result.stdout, /"permissionDecision":"deny"/);
  assert.match(result.stdout, /policy|rules/);
});

test('349 gh PR options before create still evaluate the branch', () => {
  const d = repo('main');
  git(d, 'switch', '-qc', 'feat/login');
  write(d, 'auth/login.js', 'changed');
  assert.match(
    asddGate(d, 'gh pr --repo owner/repo create', {
      sello,
      specCompleteness,
    }) || '',
    /risk tier 2/,
  );
});

test('349 git-dir and work-tree options select the repository being pushed', () => {
  const d = repo('main');
  const child = join(d, 'Child');
  mkdirSync(child);
  git(child, 'init', '-qb', 'main');
  git(child, 'config', 'user.email', 't@example.com');
  git(child, 'config', 'user.name', 'Test');
  write(child, 'a.txt', 'initial');
  git(child, 'add', '.');
  git(child, 'commit', '-qm', 'initial');
  git(child, 'switch', '-qc', 'feat/login');
  write(child, 'auth/login.js', 'changed');
  assert.equal(
    git(
      d,
      '--git-dir',
      'Child/.git',
      '--work-tree',
      'Child',
      'rev-parse',
      '--show-toplevel',
    ),
    git(child, 'rev-parse', '--show-toplevel'),
  );
  assert.equal(
    git(
      d,
      '--git-dir=Child/.git',
      '--work-tree=Child',
      'rev-parse',
      '--show-toplevel',
    ),
    git(child, 'rev-parse', '--show-toplevel'),
  );
  for (const command of [
    'git --git-dir Child/.git --work-tree Child push',
    'git --git-dir=Child/.git --work-tree=Child push',
  ]) {
    assert.match(
      asddGate(d, command, { sello, specCompleteness }) || '',
      /feat\/login/,
      command,
    );
  }
});

test('349 git-dir alone preserves the repository identity of the pushed refs', () => {
  const d = repo('main');
  const child = join(d, 'Child');
  mkdirSync(child);
  git(child, 'init', '-qb', 'main');
  git(child, 'config', 'user.email', 't@example.com');
  git(child, 'config', 'user.name', 'Test');
  write(child, 'a.txt', 'initial');
  git(child, 'add', '.');
  git(child, 'commit', '-qm', 'initial');
  git(child, 'switch', '-qc', 'feat/login');
  write(child, 'auth/login.js', 'changed');
  git(child, 'add', '.');
  git(child, 'commit', '-qm', 'authentication change');
  for (const options of [
    ['--git-dir', 'Child/.git'],
    ['--git-dir=Child/.git'],
  ]) {
    assert.equal(
      git(d, ...options, 'rev-parse', '--abbrev-ref', 'HEAD'),
      'feat/login',
    );
    const command = `git ${options.join(' ')} push`;
    assert.match(
      asddGate(d, command, { sello, specCompleteness }) || '',
      /feat\/login/,
      command,
    );
  }
  git(child, 'switch', '-qc', 'feat/docs', 'main');
  write(child, 'README.md', 'Documentation only');
  git(child, 'add', '.');
  git(child, 'commit', '-qm', 'documentation');
  assert.equal(
    asddGate(d, 'git --git-dir Child/.git push', { sello, specCompleteness }),
    null,
  );
});

test('349 an identifiable Git directory without an inspectable checkout is denied explicitly', () => {
  const d = repo('main');
  const source = repo('main');
  git(d, 'clone', '--bare', source, 'Bare.git');
  const command = 'git --git-dir Bare.git push';
  assert.match(
    asddGate(d, command, { sello, specCompleteness }) || '',
    /Cannot inspect.*Recover:/,
  );
  write(d, '.rsc/.no-asdd-gate', '');
  assert.equal(asddGate(d, command, { sello, specCompleteness }), null);
});

for (const transition of [
  {
    command: 'main',
    disable: 'unlock',
    enable: 'lock',
    removed: 'trunk-guard',
    remaining: ['gitmoji', 'trunk-open'],
  },
  {
    command: 'main',
    disable: 'lock',
    enable: 'unlock',
    removed: 'trunk-open',
    remaining: ['gitmoji', 'trunk-guard'],
  },
  {
    command: 'isolation',
    disable: 'off',
    enable: 'on',
    removed: 'worktree-isolation',
    remaining: ['gitmoji'],
  },
  {
    command: 'knowledge-sync',
    disable: 'off',
    enable: 'on',
    removed: 'knowledge-sync',
    remaining: ['gitmoji'],
  },
]) {
  test(`349 explicit ${transition.command} ${transition.enable} persists through sync without erasing other decisions`, async () => {
    const { applyInstall, syncInstalled } = await import(
      '../scripts/install-apply.js'
    );
    const { readManifest, writeManifest } = await import(
      '../scripts/lib/manifest-file.js'
    );
    const { existsSync } = await import('node:fs');
    const d = repo('main');
    await applyInstall({
      skillIds: ['orient'],
      target: 'claude',
      cwd: d,
      home: d,
    });
    const run = (action) => {
      const result = spawnSync(
        process.execPath,
        [CLI, transition.command, action, '--target', 'claude'],
        { cwd: d, encoding: 'utf8' },
      );
      assert.equal(result.status, 0, result.stdout + result.stderr);
    };
    run(transition.disable);
    const before = readManifest(d);
    writeManifest(d, { ...before, optOuts: [...before.optOuts, 'gitmoji'] });
    run(transition.enable);
    assert.deepEqual(readManifest(d).optOuts, transition.remaining);
    assert.equal(
      existsSync(join(d, '.rsc', `.no-${transition.removed}`)),
      false,
    );
    await syncInstalled({ target: 'claude', cwd: d, home: d });
    assert.deepEqual(readManifest(d).optOuts, transition.remaining);
    assert.equal(
      existsSync(join(d, '.rsc', `.no-${transition.removed}`)),
      false,
    );
  });
}

for (const command of ['memory', 'git-permissions']) {
  test(`349 explicit ${command} field decisions preserve unrelated opt-outs`, async () => {
    const { applyInstall, syncInstalled } = await import(
      '../scripts/install-apply.js'
    );
    const { readManifest, writeManifest } = await import(
      '../scripts/lib/manifest-file.js'
    );
    const d = repo('main');
    await applyInstall({
      skillIds: ['orient'],
      target: 'claude',
      cwd: d,
      home: d,
    });
    const optOuts = ['gitmoji', 'knowledge-sync'];
    writeManifest(d, { ...readManifest(d), optOuts });
    for (const action of ['off', 'on']) {
      const result = spawnSync(
        process.execPath,
        [CLI, command, action, '--target', 'claude'],
        { cwd: d, encoding: 'utf8' },
      );
      assert.equal(result.status, 0, result.stdout + result.stderr);
      assert.deepEqual(readManifest(d).optOuts, optOuts);
    }
    await syncInstalled({ target: 'claude', cwd: d, home: d });
    assert.deepEqual(readManifest(d).optOuts, optOuts);
  });
}
