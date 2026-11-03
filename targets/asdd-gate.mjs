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
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';
import { expand } from './shell-unwrap.mjs';

// Options that take a value must swallow it, or `gh -R owner/repo pr create` reads `owner/repo` as
// the subcommand and slips past.
const OPTS = String.raw`(?:(?:-[CcR]\s+\S+|--(?:repo|git-dir|work-tree)\s+\S+|--?\S+)\s+)*`;
const PUSH_OR_PR = new RegExp(String.raw`\bgit\s+${OPTS}push(?![\w-])|\bgh\s+${OPTS}pr\s+${OPTS}(?:create|merge)(?![\w-])`);
export const SPECS_DIR = join('02-DOCS', 'wiki', 'sdd', 'specs');

// Quoted text is blanked so a mention is not a push; and the segments a shell really runs
// (`bash -c "git push"`, `eval …`) are judged too — the same unwrapping the sello uses.
export function isPushOrPr(command) {
  if (typeof command !== 'string' || !command) return false;
  const runs = (c) => PUSH_OR_PR.test(c.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""'));
  return runs(command) || expand(command).some(runs);
}

function git(root, ...args) {
  const r = spawnSync('git', ['-C', root, '-c', 'core.quotePath=false', ...args], { windowsHide: true, encoding: 'utf8', maxBuffer: 64 * 1024 * 1024 });
  return r.status === 0 ? (r.stdout || '') : null;
}

const branchOf = (text) => (/^---\r?\n[\s\S]*?^branch:[ \t]*["']?([^"'\r\n]+?)["']?[ \t]*$[\s\S]*?^---/m.exec(text) || [])[1] || null;

/** The specs linked to `branch`: `{ path, ok, missing, empty }` each. */
export function linkedSpecs(root, branch, specCompleteness) {
  let files = [];
  try { files = readdirSync(join(root, SPECS_DIR)).filter((f) => f.endsWith('.md') && !f.endsWith('.plan.md')); } catch { return []; }
  const norm = (x) => x.toLowerCase().replace(/_/g, '-');
  const last = norm(branch.split('/').pop());
  return files.flatMap((f) => {
    const text = readFileSync(join(root, SPECS_DIR, f), 'utf8');
    if (branchOf(text) !== branch && norm(f.slice(0, -3)) !== last) return [];
    const r = specCompleteness(text);
    return [{ path: join(SPECS_DIR, f).split('\\').join('/'), ok: r.ok, missing: r.missing, empty: r.empty }];
  });
}

// A panel still covers HEAD when its commit is an ancestor of HEAD and this branch's own commits since
// changed no code. Not code, by the same rules the gate applies above: documentation, the harness's
// own state (.rsc/ journals, nested worktrees) and harness configuration. Commits that came from the
// trunk (a merge of main into the branch) are not this branch's work and are not counted.
function reviewedStill(root, sha, trunk, sello, cfg) {
  if (!sha) return false;
  if (spawnSync('git', ['-C', root, 'merge-base', '--is-ancestor', sha, 'HEAD'], { windowsHide: true }).status !== 0) return false;
  const since = [...new Set((git(root, 'log', '--no-merges', '--no-renames', '--format=', '--name-only', `${sha}..HEAD`, `^${trunk}`) || '')
    .split('\n').map((l) => l.trim()).filter(Boolean))]
    .filter((n) => !sello.SELLO_STATE_PATHS.includes(n) && !sello.NESTED_WORKTREES.test(n));
  const { classes } = sello.classifyRisk(since, cfg);
  return Object.values(classes).every((c) => c === 'docs' || c === 'harness');
}

// Largest panel recorded in the review ledger for a task of any of these specs (`<slug>/<task>`) that
// still covers HEAD.
function panelSize(root, slugs, stillValid = () => true) {
  let text = '';
  try { text = readFileSync(join(root, '.rsc', 'review-ledger.jsonl'), 'utf8'); } catch { return 0; }
  let best = 0;
  for (const line of text.split('\n')) {
    let e;
    try { e = JSON.parse(line); } catch { continue; }
    if (e?.type !== 'panel' || typeof e.task !== 'string' || !Array.isArray(e.lenses)) continue;
    if (!slugs.some((s) => e.task.toLowerCase().replace(/_/g, '-').startsWith(`${s.toLowerCase().replace(/_/g, '-')}/`))) continue;
    if (!stillValid(e.sha)) continue;
    best = Math.max(best, new Set(e.lenses.map((l) => String(l).toLowerCase())).size);
  }
  return best;
}

/**
 * null when the command may go ahead; the denial text (with its way out, P6) when it may not.
 * `lib` carries the sibling modules so tests and the hook load them the same way.
 */
export function asddGate(root, command, { sello, specCompleteness }) {
  if (!isPushOrPr(command)) return null;
  if (existsSync(join(root, '.rsc', '.no-asdd-gate'))) return null;
  const branch = (git(root, 'rev-parse', '--abbrev-ref', 'HEAD') || '').trim();
  if (!branch || branch === 'HEAD' || branch === 'main' || branch === 'master') return null;
  const cfg = sello.readEffectiveConfig(root);
  const trunk = sello.trunkRef(root, cfg);
  if (!trunk) return null;
  const base = (git(root, 'merge-base', 'HEAD', trunk) || '').trim();
  if (!base) return null;
  const paths = [...new Set([
    ...(git(root, 'diff', '--name-only', '--no-renames', '-z', base) || '').split('\0'),
    ...(git(root, 'ls-files', '--others', '--exclude-standard', '-z') || '').split('\0').filter((n) => !sello.NESTED_WORKTREES.test(n)),
  ].filter(Boolean))].filter((n) => !sello.SELLO_STATE_PATHS.includes(n));
  const { tier, classes } = sello.classifyChange(paths, sello.changeText(root, base, paths), cfg);
  if (tier < 2) return null;
  const tierTwo = [...new Set(Object.values(classes))].filter((c) => c !== 'default' && c !== 'docs');
  if (tierTwo.length && tierTwo.every((c) => c === 'harness')) return null;
  const specs = linkedSpecs(root, branch, specCompleteness);
  const passing = specs.filter((s) => s.ok);
  if (passing.length) {
    // The spec exists; now the review it requires. A tier-2 change gets the full panel (three lenses
    // by default), recorded against one of its linked specs in the review ledger.
    const required = sello.lensesRequired(2, cfg);
    const slugs = passing.map((s) => s.path.split('/').pop().slice(0, -3));
    const best = panelSize(root, slugs, (sha) => reviewedStill(root, sha, trunk, sello, cfg));
    if (best >= required) return null;
    return `Branch "${branch}" is risk tier 2 and its spec passes, but no review panel of ${required} lens(es) is recorded for it` +
      `${best ? ` (largest still valid: ${best})` : ''}. Tier 2 is reviewed by the full panel, not by one reviewer, and a panel covers ` +
      'the commit it was recorded on: code committed after it needs the panel again (the record is self-attested, like the sello). ' +
      `Recover: run the ${required} fresh-context refuters (correctness, security, tests) on the branch, then record it — ` +
      `\`npx @ericrisco/rsc review ledger panel ${slugs[0]}/closing --lenses correctness,security,tests\` — and push again. ` +
      'To turn this gate off for the project: create `.rsc/.no-asdd-gate`.';
  }
  const why = [...new Set(Object.values(classes).filter((c) => c !== 'default' && c !== 'docs'))].join(', ');
  const found = specs.length
    ? `The linked spec does not pass the gate: ${specs.map((s) => `${s.path} (missing: ${[...s.missing, ...s.empty].join(', ') || '—'})`).join('; ')}. `
    : `No spec in ${SPECS_DIR.split('\\').join('/')}/ is linked to "${branch}". `;
  return `Branch "${branch}" is risk tier 2 (${why || 'tier 2'}): tier 2 is ASDD work, and it does not leave this machine without an approved spec. ` +
    found +
    'Recover: write the spec with the `specify` skill (the four questions: what the user can do, what result they get, what it must respect, how it proves it; ' +
    `plus out of scope), put \`branch: ${branch}\` in its frontmatter, check it with \`npx @ericrisco/rsc spec gate <spec>\`, and push again. ` +
    'Anything decided without the person goes to the decision queue as review-after. To turn this gate off for the project: create `.rsc/.no-asdd-gate`.';
}
