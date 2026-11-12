// ASDD escalation gate — the deterministic half of "tier 2 in FTD means ASDD".
//
// A real 4.0.2 run took a login (auth → tier 2) down the small-change lane: `rsc risk` said tier 2,
// the ftd skill said "escalate to asdd", and the agent decided not to — with no spec, so the user
// registration it added was never recorded as an assumption anyone would review. A rule that bends
// under time pressure is prose (P2). This makes it a mechanism at the one moment that matters: before
// a tier-2 branch leaves the machine (`git push`, `gh pr create|merge`), a spec linked to the branch
// must exist and pass the spec gate.
//
// A spec is linked to the branch when its frontmatter says `branch: <branch>`, or when its file name
// (the slug) IS the branch's last segment (`feat/login` ↔ `specs/login.md`; `_` and `-` alike). Exact,
// never a substring: `api.md` must not vouch for `feat/rapid-login`.
// A branch whose tier-2 paths are all harness configuration (an rsc install or upgrade, CLAUDE.md) is
// not feature work and needs no spec — it still needs a human, as every tier 2 does.
// Fail-open on any environment problem; opt out per project with `.rsc/.no-asdd-gate`.
import { existsSync, readFileSync, readdirSync, realpathSync } from 'node:fs';
import { join, resolve, relative } from 'node:path';
import { spawnSync } from 'node:child_process';
import {
  expand,
  segments,
  words,
  unwrap,
  withoutHeredocs,
} from './shell-unwrap.mjs';
import {
  readPolicy,
  mergePolicyConfig,
  changeDetails,
  matchPolicyRules,
  policyPattern,
} from './risk-policy.mjs';

// Options that take a value must swallow it, or `gh -R owner/repo pr create` reads `owner/repo` as
// the subcommand and slips past.
const OPTS = String.raw`(?:(?:-[CcR]\s+\S+|--(?:repo|git-dir|work-tree)\s+\S+|--?\S+)\s+)*`;
const PUSH_OR_PR = new RegExp(
  String.raw`\bgit\s+${OPTS}push(?![\w-])|\bgh\s+${OPTS}pr\s+${OPTS}(?:create|merge)(?![\w-])`,
);
export const SPECS_DIR = join('02-DOCS', 'wiki', 'sdd', 'specs');

// Quoted text is blanked so a mention is not a push; and the segments a shell really runs
// (`bash -c "git push"`, `eval …`) are judged too — the same unwrapping the sello uses.
export function isPushOrPr(command) {
  if (typeof command !== 'string' || !command) return false;
  const runs = (c) =>
    PUSH_OR_PR.test(c.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""'));
  return runs(command) || expand(command).some(runs);
}

function git(root, ...args) {
  const r = spawnSync(
    'git',
    ['-C', root, '-c', 'core.quotePath=false', ...args],
    { windowsHide: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 },
  );
  return r.status === 0 ? r.stdout || '' : null;
}

const normalize = (text) => text.replace(/^\uFEFF/, '').replace(/\r\n?/g, '\n');
function values(text, key) {
  const fm = /^---\n([\s\S]*?)\n---/.exec(normalize(text))?.[1] || '';
  const match = new RegExp(`^${key}:[ \t]*(.*)$`, 'm').exec(fm);
  if (!match) return [];
  const clean = (v) => v.trim().replace(/^["']|["']$/g, '');
  if (match[1].trim().startsWith('['))
    return match[1].trim().slice(1, -1).split(',').map(clean).filter(Boolean);
  if (match[1].trim()) return [clean(match[1])];
  const tail = fm.slice(match.index + match[0].length).replace(/^\n/, '');
  return (tail.match(/^(?:[ \t]*-[ \t]+[^\n]+\n?)+/)?.[0] || '')
    .split('\n')
    .map((l) => clean(l.replace(/^[ \t]*-[ \t]+/, '')))
    .filter(Boolean);
}
function documents(root, directory) {
  try {
    return readdirSync(join(root, directory))
      .filter((f) => f.endsWith('.md'))
      .map((f) => ({
        path: join(directory, f),
        text: readFileSync(join(root, directory, f), 'utf8'),
      }));
  } catch {
    return [];
  }
}
/** Exact branch, branch list or a branch's FTD `spec:` reference. */
export function linkedSpecs(root, branch, specCompleteness, cfg = {}) {
  const norm = (x) => x.toLowerCase().replace(/_/g, '-');
  const suffix = cfg.asddGate?.cherryPickSuffix;
  const branches = [
    branch,
    ...(typeof suffix === 'string' && suffix && branch.endsWith(suffix)
      ? [branch.slice(0, -suffix.length)]
      : []),
  ];
  const ftds = documents(root, join('02-DOCS', 'wiki', 'ftd'));
  return documents(root, SPECS_DIR)
    .filter((f) => !f.path.endsWith('.plan.md'))
    .flatMap((f) => {
      const slug = f.path.split(/[\\/]/).pop().slice(0, -3);
      const linked = branches.some(
        (b) =>
          [...values(f.text, 'branch'), ...values(f.text, 'branches')].includes(
            b,
          ) ||
          norm(slug) === norm(b.split('/').pop()) ||
          ftds.some(
            (d) =>
              [
                ...values(d.text, 'branch'),
                ...values(d.text, 'branches'),
              ].includes(b) && values(d.text, 'spec').includes(slug),
          ),
      );
      if (!linked) return [];
      const r = specCompleteness(normalize(f.text));
      return [
        {
          path: f.path.split('\\').join('/'),
          ok: r.ok,
          missing: r.missing,
          empty: r.empty,
        },
      ];
    });
}

// --show-toplevel alone is insufficient with --git-dir: Git may report the invocation cwd
// while HEAD and the pushed refs belong to another repository. Check the Git directory identity.
function resolvePushRepository(dir, options) {
  const canonical = (path) => {
    try {
      return realpathSync(path);
    } catch {
      return resolve(path);
    }
  };
  const gitDir = (
    git(dir, ...options, 'rev-parse', '--absolute-git-dir') || ''
  ).trim();
  if (!gitDir) return { repo: null }; // invalid command/environment: no resolvable push
  const identity = canonical(gitDir);
  const matches = (path) => {
    const candidate = (
      git(path, 'rev-parse', '--absolute-git-dir') || ''
    ).trim();
    return (
      candidate &&
      canonical(candidate) === identity &&
      (git(path, 'rev-parse', '--is-bare-repository') || '').trim() === 'false'
    );
  };
  const top = (
    git(dir, ...options, 'rev-parse', '--show-toplevel') || ''
  ).trim();
  if (top && matches(top)) return { repo: top };
  const listed = (
    git(dir, ...options, 'worktree', 'list', '--porcelain', '-z') || ''
  ).split('\0');
  for (const field of listed) {
    if (!field.startsWith('worktree ')) continue;
    const path = field.slice('worktree '.length);
    if (matches(path)) return { repo: path };
  }
  return {
    repo: null,
    error: `Cannot inspect the worktree for Git directory "${gitDir}". Recover: check out this repository and run \`rsc spec gate --branch-check --repo <checkout>\` before pushing from that checkout.`,
  };
}

// Resolve only commands we understand. Shell aliases/functions and arbitrary scripts cannot be
// inferred; callers can use the explicit branch-check CLI for those integrations.
export function reposWithPush(command, cwd, { onUnresolved = () => {} } = {}) {
  const found = new Set();
  function scan(text, start, depth = 0) {
    if (depth > 8) return;
    let dir = start;
    const stack = [];
    for (const segment of segments(withoutHeredocs(text))) {
      const unwrapped = unwrap(
        segment.trim().replace(/^(?:then|do|\{)\s+/, ''),
      );
      if (!unwrapped) continue;
      if (unwrapped.inner) {
        scan(unwrapped.inner, dir, depth + 1);
        continue;
      }
      const tokens = words(unwrapped.rest).map((w) => w.text);
      const name = (tokens[0] || '').replace(/^.*[\\/]/, '').toLowerCase();
      if (/^(cd|pushd|set-location|sl)$/.test(name)) {
        const path = tokens.filter(
          (t) => !/^-(?:literalpath|path)$/i.test(t),
        )[1];
        if (path && !/[${}`]/.test(path)) {
          if (name === 'pushd') stack.push(dir);
          dir = resolve(dir, path);
        }
        continue;
      }
      if (name === 'popd') {
        dir = stack.pop() || dir;
        continue;
      }
      if (/^(cmd|cmd.exe)$/.test(name) && /^\/c$/i.test(tokens[1] || '')) {
        scan(tokens.slice(2).join(' '), dir, depth + 1);
        continue;
      }
      if (!/^(git|git.exe|gh|gh.exe)$/.test(name)) continue;
      const isGit = name.startsWith('git');
      const valued = isGit
        ? new Set([
            '-C',
            '-c',
            '--git-dir',
            '--work-tree',
            '--namespace',
            '--config-env',
            '--super-prefix',
          ])
        : new Set(['-R', '--repo', '--hostname']);
      const skipOptions = (start) => {
        let index = start;
        while (tokens[index]?.startsWith('-')) {
          const option = tokens[index++];
          if (valued.has(option)) index++;
        }
        return index;
      };
      const commandIndex = skipOptions(1);
      if (isGit && tokens[commandIndex] === 'push') {
        // Let Git resolve all supported global selectors, in their actual order. Reconstructing
        // only -C would silently ignore --git-dir/--work-tree and inspect the parent repository.
        const options = tokens.slice(1, commandIndex);
        const { repo, error } = resolvePushRepository(dir, options);
        if (repo) found.add(repo);
        else if (error) onUnresolved(error);
      } else if (!isGit && tokens[commandIndex] === 'pr') {
        const action = tokens[skipOptions(commandIndex + 1)];
        if (['create', 'merge'].includes(action)) {
          const repo = (git(dir, 'rev-parse', '--show-toplevel') || '').trim();
          if (repo) found.add(repo);
        }
      }
    }
  }
  scan(command, cwd);
  return [...found];
}

// A panel still covers HEAD when its commit is an ancestor of HEAD and this branch's own commits since
// changed no code. Not code, by the same rules the gate applies above: documentation, the harness's
// own state (.rsc/ journals, nested worktrees) and harness configuration. Commits that came from the
// trunk (a merge of main into the branch) are not this branch's work and are not counted.
function reviewedStill(root, sha, trunk, sello, cfg, tip = 'HEAD') {
  if (!sha) return false;
  if (
    spawnSync('git', ['-C', root, 'merge-base', '--is-ancestor', sha, tip], {
      windowsHide: true,
    }).status !== 0
  )
    return false;
  const since = [
    ...new Set(
      (
        git(
          root,
          'log',
          '--no-merges',
          '--no-renames',
          '--format=',
          '--name-only',
          `${sha}..${tip}`,
          `^${trunk}`,
        ) || ''
      )
        .split('\n')
        .map((l) => l.trim())
        .filter(Boolean),
    ),
  ].filter(
    (n) =>
      !sello.SELLO_STATE_PATHS.includes(n) && !sello.NESTED_WORKTREES.test(n),
  );
  const { classes } = sello.classifyRisk(since, cfg);
  return Object.values(classes).every((c) => c === 'docs' || c === 'harness');
}

// Largest panel recorded in the review ledger for a task of any of these specs (`<slug>/<task>`) that
// still covers HEAD.
function panelSize(root, slugs, stillValid = () => true) {
  let text = '';
  try {
    text = readFileSync(join(root, '.rsc', 'review-ledger.jsonl'), 'utf8');
  } catch {
    return 0;
  }
  let best = 0;
  for (const line of text.split('\n')) {
    let e;
    try {
      e = JSON.parse(line);
    } catch {
      continue;
    }
    if (
      e?.type !== 'panel' ||
      typeof e.task !== 'string' ||
      !Array.isArray(e.lenses)
    )
      continue;
    if (
      !slugs.some((s) =>
        e.task
          .toLowerCase()
          .replace(/_/g, '-')
          .startsWith(`${s.toLowerCase().replace(/_/g, '-')}/`),
      )
    )
      continue;
    if (!stillValid(e.sha)) continue;
    best = Math.max(
      best,
      new Set(e.lenses.map((l) => String(l).toLowerCase())).size,
    );
  }
  return best;
}

/**
 * null when the command may go ahead; the denial text (with its way out, P6) when it may not.
 * `lib` carries the sibling modules so tests and the hook load them the same way.
 */
export function branchCheck(
  root,
  repo,
  { sello, specCompleteness },
  options = {},
) {
  if (existsSync(join(root, '.rsc', '.no-asdd-gate'))) return null;
  const current = (git(repo, 'rev-parse', '--abbrev-ref', 'HEAD') || '').trim();
  const branch = options.branch || current;
  const tip =
    options.branch && options.branch !== current ? options.branch : null;
  if (!branch || branch === 'HEAD' || branch === 'main' || branch === 'master')
    return null;
  const local = sello.readEffectiveConfig(root);
  const policy = readPolicy(repo, {
    workspace: root,
    localConfig: local,
    tip: tip || 'HEAD',
  });
  const cfg = mergePolicyConfig(local, policy);
  if (policy.error) return policy.error;
  const trunk = policy.trunk;
  if (!trunk) {
    if (options.strict)
      throw new Error(
        'No trunk found. Recover: set origin/HEAD or configure trunk in .rsc/sello-config.json.',
      );
    return null;
  }
  if (branch === trunk.replace(/^origin\//, '')) return null;
  try {
    const exemptions = (cfg.asddGate?.exemptBranches || []).map((path) => {
      policyPattern(path);
      return { path, class: 'exempt', tier: 0 };
    });
    if (exemptions.length > 64)
      throw new Error('at most 64 exemptions are supported');
    if (matchPolicyRules(exemptions, [branch], {}, {}, {})[branch]?.length)
      return null;
  } catch (e) {
    return `Invalid branch exemption: ${e.message}. Recover: correct the trunk policy.`;
  }
  const base = (git(repo, 'merge-base', tip || 'HEAD', trunk) || '').trim();
  if (!base) {
    if (options.strict)
      throw new Error(
        'No common ancestor with the trunk. Recover: pass a branch with shared history.',
      );
    return null;
  }
  const paths = [
    ...new Set(
      [
        ...(
          git(
            repo,
            'diff',
            '--name-only',
            '--no-renames',
            '-z',
            base,
            ...(tip ? [tip] : []),
          ) || ''
        ).split('\0'),
        ...(tip
          ? []
          : (
              git(repo, 'ls-files', '--others', '--exclude-standard', '-z') ||
              ''
            )
              .split('\0')
              .filter((n) => !sello.NESTED_WORKTREES.test(n))),
      ].filter(Boolean),
    ),
  ].filter((n) => !sello.SELLO_STATE_PATHS.includes(n));
  const details = changeDetails(repo, base, paths, tip);
  const texts = tip
    ? Object.fromEntries(
        Object.entries(details).map(([p, d]) => [p, d.added.join('\n')]),
      )
    : sello.changeText(repo, base, paths);
  const { tier, classes, rules, configError } = sello.classifyChange(
    paths,
    texts,
    cfg,
    details,
  );
  if (configError) return configError;
  if (tier < 2) return null;
  const tierTwo = [...new Set(Object.values(classes))].filter(
    (c) => c !== 'default' && c !== 'docs',
  );
  if (tierTwo.length && tierTwo.every((c) => c === 'harness')) return null;
  const specs = linkedSpecs(root, branch, specCompleteness, cfg);
  const passing = specs.filter((s) => s.ok);
  if (passing.length) {
    if (cfg.asddGate?.require === 'spec') return null;
    // The spec exists; now the review it requires. A tier-2 change gets the full panel (three lenses
    // by default), recorded against one of its linked specs in the review ledger.
    const required = sello.lensesRequired(2, cfg);
    const slugs = passing.map((s) => s.path.split('/').pop().slice(0, -3));
    const best = panelSize(root, slugs, (sha) =>
      reviewedStill(repo, sha, trunk, sello, cfg, tip || 'HEAD'),
    );
    if (best >= required) return null;
    return (
      `Branch "${branch}" is risk tier 2 and its spec passes, but no review panel of ${required} lens(es) is recorded for it` +
      `${best ? ` (largest still valid: ${best})` : ''}. Tier 2 is reviewed by the full panel, not by one reviewer, and a panel covers ` +
      'the commit it was recorded on: code committed after it needs the panel again (the record is self-attested, like the sello). ' +
      `Recover: run the ${required} fresh-context refuters (correctness, security, tests) on the branch, then record it — ` +
      `\`npx @ericrisco/rsc review ledger panel ${slugs[0]}/closing --lenses correctness,security,tests\` — and push again. ` +
      'To turn this gate off for the project: create `.rsc/.no-asdd-gate`.'
    );
  }
  const why = [
    ...new Set([
      ...Object.values(classes).filter((c) => c !== 'default' && c !== 'docs'),
      ...(rules || []).map((r) => r.because),
    ]),
  ].join(', ');
  const found = specs.length
    ? `The linked spec does not pass the gate: ${specs.map((s) => `${s.path} (missing: ${[...s.missing, ...s.empty].join(', ') || '—'})`).join('; ')}. `
    : `No spec in ${SPECS_DIR.split('\\').join('/')}/ is linked to "${branch}". `;
  return (
    `Branch "${branch}" is risk tier 2 (${why || 'tier 2'}): tier 2 is ASDD work, and it does not leave this machine without an approved spec. ` +
    found +
    'Recover: write the spec with the `specify` skill (the four questions: what the user can do, what result they get, what it must respect, how it proves it; ' +
    `plus out of scope), put \`branch: ${branch}\` in its frontmatter, check it with \`npx @ericrisco/rsc spec gate <spec>\`, and push again. ` +
    'Anything decided without the person goes to the decision queue as review-after. To turn this gate off for the project: create `.rsc/.no-asdd-gate`.'
  );
}

/** One judgement per actual repository, with workspace specs and trusted policy. */
export function asddGate(root, command, lib, cwd = root) {
  root = (git(root, 'rev-parse', '--show-toplevel') || '').trim() || root;
  if (existsSync(join(root, '.rsc', '.no-asdd-gate'))) return null;
  const unresolved = [];
  const denials = reposWithPush(command, cwd, {
    onUnresolved: (reason) => unresolved.push(reason),
  })
    .map((repo) => {
      const why = branchCheck(root, repo, lib);
      return (
        why && `${repo === root ? '' : `[${relative(root, repo)}] `}${why}`
      );
    })
    .filter(Boolean);
  const reasons = [...unresolved, ...denials];
  return reasons.length ? reasons.join('\n\n') : null;
}
