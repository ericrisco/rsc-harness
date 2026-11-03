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
// (the slug) appears in the branch name (`feat/login` ↔ `specs/login.md`).
// Fail-open on any environment problem; opt out per project with `.rsc/.no-asdd-gate`.
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { spawnSync } from 'node:child_process';

const OPTS = String.raw`(?:(?:-[Cc]\s+\S+|--?\S+)\s+)*`;
const PUSH_OR_PR = new RegExp(String.raw`\bgit\s+${OPTS}push(?![\w-])|\bgh\s+${OPTS}pr\s+${OPTS}(?:create|merge)(?![\w-])`);
export const SPECS_DIR = join('02-DOCS', 'wiki', 'sdd', 'specs');

export function isPushOrPr(command) {
  if (typeof command !== 'string') return false;
  return PUSH_OR_PR.test(command.replace(/'[^']*'/g, "''").replace(/"[^"]*"/g, '""'));
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
  const lower = branch.toLowerCase();
  return files.flatMap((f) => {
    const text = readFileSync(join(root, SPECS_DIR, f), 'utf8');
    const slug = f.slice(0, -3).toLowerCase();
    if (branchOf(text) !== branch && !lower.split(/[/_.-]+/).join('-').includes(slug)) return [];
    const r = specCompleteness(text);
    return [{ path: join(SPECS_DIR, f).split('\\').join('/'), ok: r.ok, missing: r.missing, empty: r.empty }];
  });
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
  const { tier, classes } = sello.classifyRisk(paths, cfg);
  if (tier < 2) return null;
  const specs = linkedSpecs(root, branch, specCompleteness);
  if (specs.some((s) => s.ok)) return null;
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
