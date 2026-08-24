// Does this harness have a design identity, and can we tell?
//
// `design` has declared for a long time that without a brand study it STOPS and does not design.
// Nothing checked it: `grep -rln "wiki/brand" scripts/` returned nothing before this file existed.
// That is P2 — a rule declared binding with no mechanism is a decorative gate. Spec:
// 02-DOCS/wiki/sdd/specs/design-area-cleanup.md
//
// Three states, and the third is the whole point. A checker that cannot look must never report
// green: that exact defect was found and fixed in the design-dna style checker two days earlier,
// where regex probes ran against empty text and returned vacuous passes. Absence of evidence is
// reported as absence of evidence.
//
// Read-only. It never writes: 02-DOCS is untracked (P9) and there is no undo there.
import { existsSync, lstatSync, readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';

// Where the harness keeps durable design knowledge, and the section in the root instructions file
// that points at it. Both are the `design`/`harness` convention, not invented here.
export const BRAND_DIR = join('02-DOCS', 'wiki', 'brand');
export const BRAND_SECTION = '## Brand & voice';

/**
 * @returns {{state: 'present'|'missing'|'inconclusive', linked: boolean, articles: string[],
 *            reason: string, fix?: string}}
 *   `present`      — articles exist under the brand dir. `linked` says whether the root
 *                    instructions file points at them, which is how other skills find it.
 *   `missing`      — looked, found nothing. Carries the fix (P6: a denial carries its way out).
 *   `inconclusive` — could not look. Never conflated with `missing`, and never with green.
 */
export function designIdentity(root = process.cwd()) {
  const dir = join(root, BRAND_DIR);

  let articles;
  try {
    if (!existsSync(dir)) {
      // existsSync FOLLOWS symlinks, so a dangling one reports false and would be filed as "no
      // identity here". It is not absence, it is unreadability — the same conflation this whole
      // area was cleaning up. lstat sees the link itself and tells the two apart.
      let danglingLink = false;
      try { danglingLink = lstatSync(dir).isSymbolicLink(); } catch { /* genuinely absent */ }
      if (danglingLink) {
        return {
          state: 'inconclusive',
          linked: false,
          articles: [],
          reason: `${BRAND_DIR} is a symlink that does not resolve`,
        };
      }
      return {
        state: 'missing',
        linked: false,
        articles: [],
        reason: `no ${BRAND_DIR}/ in this harness`,
        fix: 'run `design-loop` to converge on a winner, then `design-dna` to write its record here',
      };
    }
    // Not statSync: it follows symlinks, so a symlink here could report on a directory outside the
    // declared zone. Same reason drift-check.js:167 uses dirents.
    if (!statSync(dir).isDirectory()) {
      return {
        state: 'inconclusive',
        linked: false,
        articles: [],
        reason: `${BRAND_DIR} exists but is not a directory`,
      };
    }
    articles = readdirSync(dir).filter((f) => f.endsWith('.md') && f !== 'index.md');
  } catch (e) {
    // Unreadable for any reason (permissions, dangling symlink, ELOOP). We did not look, so we
    // cannot say. Reporting `missing` here would invent a finding; reporting green would hide one.
    return {
      state: 'inconclusive',
      linked: false,
      articles: [],
      reason: `cannot read ${BRAND_DIR}: ${e.code || e.message}`,
    };
  }

  // The link matters on its own: five skills reach the identity through the root instructions file,
  // so an unlinked identity is one they will not find.
  let linked = false;
  const claudeMd = join(root, 'CLAUDE.md');
  if (existsSync(claudeMd)) {
    try {
      linked = readFileSync(claudeMd, 'utf8').includes(BRAND_SECTION);
    } catch {
      // The articles are what we were asked about and we did read them. A CLAUDE.md we could not
      // read makes `linked` unknown, not the whole answer unknown — report it in the reason.
      return {
        state: articles.length ? 'present' : 'missing',
        linked: false,
        articles,
        reason: `${articles.length} article(s), but CLAUDE.md could not be read to confirm the link`,
      };
    }
  }

  if (!articles.length) {
    return {
      state: 'missing',
      linked,
      articles: [],
      reason: `${BRAND_DIR}/ exists but holds no identity article`,
      fix: 'run `design-loop` to converge on a winner, then `design-dna` to write its record here',
    };
  }

  return {
    state: 'present',
    linked,
    articles,
    reason: linked
      ? `${articles.length} article(s), linked from CLAUDE.md`
      : `${articles.length} article(s), but no "${BRAND_SECTION}" section in CLAUDE.md points at them`,
    ...(linked ? {} : { fix: `add a "${BRAND_SECTION}" section to CLAUDE.md linking ${BRAND_DIR}/` }),
  };
}
