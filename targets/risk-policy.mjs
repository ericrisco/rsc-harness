// Versioned policy and repository selection shared by risk, ASDD and worktree cleanup.
// This module is copied beside the hooks; keep its imports limited to Node builtins.
import { existsSync, readFileSync, lstatSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
export const POLICY_FILE = '.rsc-risk.json';
export function git(root, ...args) {
  const r = spawnSync(
    'git',
    ['-C', root, '-c', 'core.quotePath=false', ...args],
    {
      encoding: 'utf8',
      windowsHide: true,
      timeout: 10000,
      maxBuffer: 64 * 1024 * 1024,
    },
  );
  return r.status === 0 ? r.stdout : null;
}
export function policyRoot(root) {
  let current =
    (git(root, 'rev-parse', '--show-toplevel') || '').trim() || resolve(root);
  for (let n = 0; n < 20; n++) {
    const parent = (
      git(current, 'rev-parse', '--show-superproject-working-tree') || ''
    ).trim();
    if (!parent || parent === current) break;
    current = parent;
  }
  return current;
}
export function chooseTrunk(root, cfg = null, head = 'HEAD') {
  const exists = (r) =>
    typeof r === 'string' &&
    !r.startsWith('-') &&
    git(root, 'rev-parse', '--verify', '--quiet', `${r}^{commit}`) !== null;
  const requested = [
    cfg?.trunk,
    ...(Array.isArray(cfg?.trunks) ? cfg.trunks : []),
  ]
    .filter((x) => typeof x === 'string' && x.length <= 1024)
    .slice(0, 16);
  const refs = [
    ...new Set(requested.flatMap((r) => [r, `origin/${r}`]).filter(exists)),
  ];
  if (refs.length) {
    const distance = (r) => {
      const n = git(root, 'rev-list', '--count', `${r}..${head}`);
      return n === null ? Infinity : Number(n);
    };
    return refs.reduce((best, r) => (distance(r) < distance(best) ? r : best));
  }
  const remote = (
    git(
      root,
      'symbolic-ref',
      '--quiet',
      '--short',
      'refs/remotes/origin/HEAD',
    ) || ''
  ).trim();
  return (
    [
      remote,
      'origin/main',
      'origin/master',
      'main',
      'master',
      'origin/develop',
      'develop',
    ].find(exists) || null
  );
}
const isObject = (value) =>
  value !== null && typeof value === 'object' && !Array.isArray(value);

function validateSettings(settings, location) {
  if (!isObject(settings)) throw new Error(`${location} must be an object`);
  if (settings.rules !== undefined && !Array.isArray(settings.rules))
    throw new Error(`${location}.rules must be an array`);
  if (settings.risk !== undefined && !isObject(settings.risk))
    throw new Error(`${location}.risk must be an object`);
  if (settings.risk?.rules !== undefined && !Array.isArray(settings.risk.rules))
    throw new Error(`${location}.risk.rules must be an array`);
  if (settings.trunk !== undefined && typeof settings.trunk !== 'string')
    throw new Error(`${location}.trunk must be a ref string`);
  if (
    settings.trunks !== undefined &&
    (!Array.isArray(settings.trunks) ||
      settings.trunks.length > 16 ||
      !settings.trunks.every((x) => typeof x === 'string'))
  )
    throw new Error(`${location}.trunks must be an array of at most 16 refs`);
  if (
    settings.testRepos !== undefined &&
    (!Array.isArray(settings.testRepos) ||
      !settings.testRepos.every((x) => typeof x === 'string'))
  )
    throw new Error(`${location}.testRepos must be an array of paths`);
  if (settings.asddGate !== undefined && !isObject(settings.asddGate))
    throw new Error(`${location}.asddGate must be an object`);
  if (
    settings.asddGate?.require !== undefined &&
    !['spec', 'panel'].includes(settings.asddGate.require)
  )
    throw new Error(`${location}.asddGate.require must be spec or panel`);
  if (
    settings.asddGate?.exemptBranches !== undefined &&
    (!Array.isArray(settings.asddGate.exemptBranches) ||
      !settings.asddGate.exemptBranches.every((x) => typeof x === 'string'))
  )
    throw new Error(
      `${location}.asddGate.exemptBranches must be an array of patterns`,
    );
  if (
    settings.asddGate?.cherryPickSuffix !== undefined &&
    typeof settings.asddGate.cherryPickSuffix !== 'string'
  )
    throw new Error(`${location}.asddGate.cherryPickSuffix must be a string`);
}

function parse(text) {
  if (Buffer.byteLength(text) > 1024 * 1024)
    throw new Error('policy exceeds 1 MiB');
  const p = JSON.parse(text);
  if (!isObject(p) || p.version !== 1)
    throw new Error('expected a version: 1 policy object');
  validateSettings(p, 'policy');
  if (p.repositories !== undefined) {
    if (!isObject(p.repositories))
      throw new Error(
        'repositories must be an object keyed by relative repository path',
      );
    for (const [name, settings] of Object.entries(p.repositories))
      validateSettings(settings, `repositories[${JSON.stringify(name)}]`);
  }
  return p;
}
/** Shipping uses the policy on the workspace trunk. A new policy only takes effect once landed. */
export function readPolicy(
  root,
  {
    workspace = policyRoot(root),
    preview = false,
    localConfig = null,
    tip = 'HEAD',
  } = {},
) {
  root =
    (git(root, 'rev-parse', '--show-toplevel') || '').trim() || resolve(root);
  workspace =
    (git(workspace, 'rev-parse', '--show-toplevel') || '').trim() ||
    resolve(workspace);
  if (!localConfig) {
    try {
      localConfig = JSON.parse(
        readFileSync(join(workspace, '.rsc', 'sello-config.json'), 'utf8'),
      );
    } catch {
      /* no local bootstrap */
    }
  }
  const rel = relative(workspace, root).split('\\').join('/') || '.';
  // Bootstrap from origin/HEAD or the historic names, not from the outgoing policy.
  let anchor = chooseTrunk(workspace, localConfig);
  let raw = preview
    ? null
    : anchor &&
      git(workspace, 'show', '--no-textconv', `${anchor}:${POLICY_FILE}`);
  let source = anchor || 'none';
  if (preview) {
    try {
      if (!lstatSync(join(workspace, POLICY_FILE)).isSymbolicLink())
        raw = readFileSync(join(workspace, POLICY_FILE), 'utf8');
    } catch {
      /* no proposed policy */
    }
    source = 'working-tree (preview)';
  }
  let policy = {};
  let error = null;
  if (raw !== null && raw !== undefined) {
    try {
      policy = parse(raw);
    } catch (e) {
      error = `${POLICY_FILE} at ${source}: ${e.message}. Recover: correct the versioned policy on the trunk.`;
    }
  } else if (!preview && existsSync(join(workspace, POLICY_FILE)))
    source += ' (policy absent; proposed policy inactive)';
  const repoCfg =
    policy.repositories && Object.hasOwn(policy.repositories, rel)
      ? policy.repositories[rel]
      : {};
  const config = {
    ...policy,
    ...repoCfg,
    risk: {
      ...(policy.risk || {}),
      ...(repoCfg.risk || {}),
      rules: [...(policy.rules || []), ...(repoCfg.rules || [])],
    },
    repo: rel,
    testRepo: (policy.testRepos || []).includes(rel),
    policySource: source,
    policyError: error,
  };
  try {
    policyRules(config);
  } catch (e) {
    error ||= `${POLICY_FILE} at ${source}: ${e.message}. Recover: correct the trunk policy.`;
    config.policyError = error;
  }
  return {
    workspace,
    source,
    config,
    error,
    active: raw !== null && raw !== undefined,
    trunk: chooseTrunk(root, { ...localConfig, ...config }, tip),
  };
}

export function mergePolicyConfig(local, policy) {
  return {
    ...(local || {}),
    ...policy.config,
    risk: {
      ...(local?.risk || {}),
      ...(policy.active ? policy.config.risk : {}),
    },
  };
}

// Policy regexes are intentionally a restricted subset: no lookarounds/backreferences or repeated
// groups. Bounded lines alone do not prevent catastrophic backtracking (even 2000 bytes is enough).
export function policyPattern(pattern) {
  if (
    typeof pattern !== 'string' ||
    pattern.length > 200 ||
    /\\[1-9]|\(\?[^:]|\)(?:[+*{])/.test(pattern)
  )
    throw new Error(
      'policy patterns must be <=200 characters without lookarounds, backreferences or repeated groups',
    );
  return new RegExp(pattern, 'i');
}
export function policyRules(cfg) {
  const rows = cfg?.risk?.rules || [];
  if (!Array.isArray(rows) || rows.length > 64)
    throw new Error('risk.rules must be an array of at most 64 rules');
  return rows.map((r) => {
    if (
      !r ||
      ![0, 1, 2].includes(r.tier) ||
      typeof r.class !== 'string' ||
      !r.class
    )
      throw new Error('each risk rule needs class and tier 0, 1 or 2');
    for (const key of ['path', 'added', 'removed', 'contains'])
      if (r[key] !== undefined) policyPattern(r[key]);
    for (const key of ['repos', 'jsonKeys'])
      if (
        r[key] !== undefined &&
        (!Array.isArray(r[key]) || !r[key].every((x) => typeof x === 'string'))
      )
        throw new Error(`${key} must be an array of strings`);
    return r;
  });
}
const linesMatch = (lines, p) =>
  (lines || []).some((l) => l.length <= 2000 && policyPattern(p).test(l));
export function ruleApplies(r, path, detail, cfg) {
  if (r.repos && !r.repos.includes(cfg?.repo || '.')) return false;
  if (r.productionOnly && cfg?.testRepo) return false;
  if (
    r.path &&
    ![path, detail.oldPath]
      .filter(Boolean)
      .some((p) => p.length <= 2000 && policyPattern(r.path).test(p))
  )
    return false;
  if (r.deleted && detail.status !== 'D') return false;
  if (
    r.contains &&
    !linesMatch(
      `${detail.before || ''}\n${detail.after || ''}`.split('\n'),
      r.contains,
    )
  )
    return false;
  if (r.added && !linesMatch(detail.added, r.added)) return false;
  if (r.removed && !linesMatch(detail.removed, r.removed)) return false;
  if (r.jsonKeys) {
    try {
      const a = JSON.parse(detail.before || '{}');
      const b = JSON.parse(detail.after || '{}');
      if (
        !r.jsonKeys.some(
          (k) => JSON.stringify(a?.[k]) !== JSON.stringify(b?.[k]),
        )
      )
        return false;
    } catch {
      return true;
    } // unreadable JSON can change the contract
  }
  return true;
}
/** Both paths of renames are reported by callers (--no-renames); deletions keep their old text. */
export function changeDetails(root, base, paths, tip = null) {
  const out = {};
  for (const path of paths) {
    let after = '';
    let exists = false;
    try {
      const st = lstatSync(join(root, path));
      if (st.isFile() && !st.isSymbolicLink() && st.size <= 1024 * 1024) {
        after = readFileSync(join(root, path), 'utf8');
        exists = true;
      }
    } catch {
      /* deletion */
    }
    if (tip) {
      const text = git(root, 'show', '--no-textconv', `${tip}:${path}`);
      exists = text !== null;
      after = text || '';
    }
    const before = base
      ? git(root, 'show', '--no-textconv', `${base}:${path}`)
      : null;
    const detail = {
      before: before || '',
      after,
      status: !exists ? 'D' : before === null ? 'A' : 'M',
      added: [],
      removed: [],
    };
    if (!base || before === null) detail.added = after.split('\n');
    else {
      const diff =
        git(
          root,
          'diff',
          '-w',
          '--no-ext-diff',
          '--no-textconv',
          '--no-renames',
          '--no-color',
          '-U0',
          base,
          ...(tip ? [tip] : []),
          '--',
          path,
        ) || '';
      let body = false;
      for (const line of diff.split('\n')) {
        if (line.startsWith('@@')) {
          body = true;
          continue;
        }
        if (!body) continue;
        if (line.startsWith('+')) detail.added.push(line.slice(1));
        if (line.startsWith('-')) detail.removed.push(line.slice(1));
      }
    }
    out[path] = detail;
  }
  return out;
}

/** User regexes run in a disposable process with a hard time limit, including polynomial cases
 * that a nested-group heuristic cannot reject. Timeout/oversize becomes tier 2, never a silent pass. */
export function matchPolicyRules(rows, paths, details, texts, cfg) {
  if (!rows.length) return {};
  const files = Object.fromEntries(
    paths.map((p) => [
      p,
      details[p] || { added: (texts[p] || '').split('\n') },
    ]),
  );
  const input = JSON.stringify({
    rows,
    files,
    repo: cfg?.repo,
    testRepo: cfg?.testRepo,
  });
  if (Buffer.byteLength(input) > 8 * 1024 * 1024)
    throw new Error('policy evaluation exceeds the bounded 8 MiB input');
  const r = spawnSync(
    process.execPath,
    [fileURLToPath(import.meta.url), '--match-rules'],
    {
      input,
      encoding: 'utf8',
      windowsHide: true,
      timeout: 1000,
      maxBuffer: 8 * 1024 * 1024,
    },
  );
  if (r.status !== 0)
    throw new Error('policy evaluation exceeded its bounded runtime or failed');
  return JSON.parse(r.stdout);
}
if (
  process.argv[1] === fileURLToPath(import.meta.url) &&
  process.argv[2] === '--match-rules'
) {
  try {
    const { rows, files, repo, testRepo } = JSON.parse(readFileSync(0, 'utf8'));
    const out = Object.fromEntries(
      Object.entries(files).map(([path, detail]) => [
        path,
        rows.flatMap((row, i) =>
          ruleApplies(row, path, detail, { repo, testRepo }) ? [i] : [],
        ),
      ]),
    );
    process.stdout.write(JSON.stringify(out));
  } catch {
    process.exitCode = 1;
  }
}
