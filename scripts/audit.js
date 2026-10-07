// audit.js — inventory installed skills (project + machine), surface possible
// overlap and over-install (bloat). Advisory only: every finding is a "review
// this", never a hard error. Run on demand (`rsc audit`), at `init`, and nudged
// periodically by the SessionStart hook when the last run is stale.
//
// Signals it leans on, all already in the repo:
//   - manifest.json    → the catalog (id, description, tags) — what a skill is
//   - .rsc/skills/<id>  → the project's single source of truth for installed skills
//   - ~/.claude/skills  → machine/user-scope skills
//   - detectRepo()      → coarse stack signals, to judge "no footprint here"
//   - DOMAINS           → the catalog grouped by intent, to judge overlap/heaviness
import { existsSync, readdirSync, mkdirSync, writeFileSync } from 'node:fs';
import { join, dirname } from 'node:path';
import { homedir } from 'node:os';
import { fileURLToPath } from 'node:url';
import { loadManifest } from './lib/manifest.js';
import { detectRepo } from './detect-repo.js';
import { DOMAINS } from './lib/domains.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');

// The control plane + SDD pipeline always coexist by design — never flag them as
// overlap or bloat. A pipeline of phases is not "too many skills".
const FLOOR_DOMAINS = ['Core & control plane', 'Spec-Driven Development'];
// Domains whose skills imply a concrete stack in the repo. Only these get the
// "no footprint detected" check — content/business skills can't be judged from code.
const CODE_DOMAINS = [
  'Languages',
  'Frameworks & app stacks',
  'Databases & data layer',
  'Ship & operate — platforms',
];

// detectRepo() is coarse (a handful of stack tags). Expand each detected signal to
// the sibling skills it implies, so "Next.js detected" doesn't flag react/vercel as
// orphans. Anything outside the expanded set in a CODE_DOMAIN is advisory bloat.
const STACK_SIBLINGS = {
  nextjs: ['nextjs', 'react', 'typescript', 'nodejs', 'vercel', 'design', 'tailwind'],
  design: ['design', 'nextjs', 'react'],
  fastapi: ['fastapi', 'python', 'sql'],
  go: ['go'],
  postgresdb: ['postgresdb', 'sql', 'prisma-orm', 'drizzle-orm', 'db-migrations', 'supabase', 'neon'],
  deployment: ['deployment', 'docker', 'github-actions', 'vercel', 'netlify', 'railway', 'render', 'fly-io'],
};

const OVERLAP_SHARED_TAGS = 3; // pair in same domain sharing ≥ this many tags → "similar ground"
const HEAVY_DOMAIN_COUNT = 5;  // > this many installed in one (non-floor) domain → "heavy"
const STALE_DAYS = 14;         // periodic nudge cadence (used by the SessionStart hook)

function domainOf(id) {
  const d = DOMAINS.find((dom) => dom.ids.includes(id));
  return d ? d.title : 'Uncategorized';
}

function subdirs(dir) {
  try {
    return readdirSync(dir, { withFileTypes: true })
      .filter((e) => e.isDirectory() && !e.name.startsWith('.'))
      .map((e) => e.name);
  } catch { return []; }
}

// Installed in THIS project = whatever has a real base under .rsc/skills/<id>,
// intersected with the catalog (ignore stray dirs). This is target-agnostic: the
// shared base is the single source of truth regardless of which assistants link it.
export function installedProject(cwd, catalogIds) {
  const set = new Set(catalogIds);
  return subdirs(join(cwd, '.rsc', 'skills')).filter((id) => set.has(id)).sort();
}

// Installed on the MACHINE = user-scope Claude skills (~/.claude/skills/<id>),
// intersected with the catalog. Best-effort; other assistants' user scopes vary.
export function installedMachine(home, catalogIds) {
  const set = new Set(catalogIds);
  return subdirs(join(home, '.claude', 'skills')).filter((id) => set.has(id)).sort();
}

function findOverlaps(ids, tagsById) {
  const out = [];
  const content = ids.filter((id) => !FLOOR_DOMAINS.includes(domainOf(id)));
  for (let i = 0; i < content.length; i++) {
    for (let j = i + 1; j < content.length; j++) {
      const a = content[i];
      const b = content[j];
      if (domainOf(a) !== domainOf(b)) continue;
      const shared = (tagsById[a] || []).filter((t) => (tagsById[b] || []).includes(t));
      if (shared.length >= OVERLAP_SHARED_TAGS) {
        out.push({ a, b, domain: domainOf(a), sharedTags: shared });
      }
    }
  }
  return out;
}

function findHeavyDomains(ids) {
  const byDomain = {};
  for (const id of ids) {
    const d = domainOf(id);
    if (FLOOR_DOMAINS.includes(d)) continue;
    (byDomain[d] ||= []).push(id);
  }
  return Object.entries(byDomain)
    .filter(([, list]) => list.length > HEAVY_DOMAIN_COUNT)
    .map(([domain, list]) => ({ domain, count: list.length, ids: list.sort() }));
}

function findNoFootprint(ids, tagsById, detected) {
  if (!detected.length) return []; // can't judge a non-code / empty repo — stay silent
  const covered = new Set(detected.flatMap((sig) => STACK_SIBLINGS[sig] || [sig]));
  const out = [];
  for (const id of ids) {
    const dom = domainOf(id);
    if (!CODE_DOMAINS.includes(dom)) continue;
    const tags = tagsById[id] || [];
    const hasFootprint = covered.has(id) || tags.some((t) => covered.has(t));
    if (!hasFootprint) {
      out.push({ id, domain: dom, reason: `no detected footprint (repo looks like: ${detected.join(', ')})` });
    }
  }
  return out;
}

export function audit({
  cwd = process.cwd(),
  home = homedir(),
  manifest = loadManifest(),
  date = new Date().toISOString().slice(0, 10),
} = {}) {
  const catalogIds = manifest.skills.map((s) => s.id);
  const tagsById = Object.fromEntries(manifest.skills.map((s) => [s.id, s.tags || []]));

  const project = installedProject(cwd, catalogIds);
  const machine = installedMachine(home, catalogIds);
  const detected = detectRepo(cwd);

  const overlaps = findOverlaps(project, tagsById);
  const heavyDomains = findHeavyDomains(project);
  const noFootprint = findNoFootprint(project, tagsById, detected);

  const byDomain = {};
  for (const id of project) (byDomain[domainOf(id)] ||= []).push(id);

  const findings = overlaps.length + heavyDomains.length + noFootprint.length;
  const headline = findings === 0
    ? `${project.length} skills installed — nothing to flag.`
    : `${project.length} installed · ${overlaps.length} possible overlap, ${heavyDomains.length} heavy domain(s), ${noFootprint.length} with no footprint.`;

  return {
    date,
    project: { root: cwd, installed: project, byDomain },
    machine: { root: join(home, '.claude', 'skills'), installed: machine },
    detectedStacks: detected,
    overlaps,
    heavyDomains,
    noFootprint,
    summary: {
      projectCount: project.length,
      machineCount: machine.length,
      overlapCount: overlaps.length,
      heavyCount: heavyDomains.length,
      noFootprintCount: noFootprint.length,
      clean: findings === 0,
      headline,
    },
  };
}

export function renderAuditMarkdown(report) {
  const L = [];
  L.push(`# Skill audit — ${report.date}`, '');
  L.push(report.summary.headline, '');
  L.push(`- Project skills: **${report.summary.projectCount}** (\`${report.project.root}\`)`);
  L.push(`- Machine skills: **${report.summary.machineCount}** (\`${report.machine.root}\`)`);
  L.push(`- Detected stacks: ${report.detectedStacks.length ? report.detectedStacks.join(', ') : '(none detected)'}`, '');

  if (report.overlaps.length) {
    L.push('## Possible overlap (review — not necessarily wrong)', '');
    for (const o of report.overlaps) {
      L.push(`- \`${o.a}\` ↔ \`${o.b}\` — same domain *${o.domain}*, share: ${o.sharedTags.join(', ')}`);
    }
    L.push('');
  }
  if (report.heavyDomains.length) {
    L.push('## Heavy domains (more than usual for one project)', '');
    for (const h of report.heavyDomains) {
      L.push(`- **${h.domain}** — ${h.count} installed: ${h.ids.map((i) => `\`${i}\``).join(', ')}`);
    }
    L.push('');
  }
  if (report.noFootprint.length) {
    L.push('## Installed but no footprint detected (verify)', '');
    for (const n of report.noFootprint) {
      L.push(`- \`${n.id}\` (${n.domain}) — ${n.reason}`);
    }
    L.push('');
  }
  if (report.summary.clean) L.push('Nothing to flag. The installed set fits the project.', '');

  L.push('---', `_Advisory only. Trim with \`npx @ericrisco/rsc uninstall <id>\`. Re-run with \`npx @ericrisco/rsc audit\`._`);
  return L.join('\n') + '\n';
}

// Persist a stamp the SessionStart hook reads to decide if a periodic audit is due.
export function stampAudit(cwd, date = new Date().toISOString()) {
  const dir = join(cwd, '.rsc');
  mkdirSync(dir, { recursive: true });
  writeFileSync(join(dir, 'audit.json'), JSON.stringify({ lastRun: date }, null, 2) + '\n');
}

// The start of the cadence for a harness that has never been audited: written by onboarding so the
// first audit falls due STALE_DAYS after install, not in the first session. `baseline` and not
// `lastRun`, because no audit ran — the SessionStart hook reads either. Leaves an existing file alone.
export function recordAuditBaseline(cwd, date = new Date().toISOString()) {
  const file = join(cwd, '.rsc', 'audit.json');
  if (existsSync(file)) return false;
  mkdirSync(join(cwd, '.rsc'), { recursive: true });
  writeFileSync(file, JSON.stringify({ baseline: date }, null, 2) + '\n');
  return true;
}

// Write the report into the harness wiki when one exists; always stamp .rsc/audit.json.
export function writeAuditReport(report, cwd = process.cwd()) {
  const written = [];
  const wikiHarness = join(cwd, '02-DOCS', 'wiki', 'harness');
  if (existsSync(join(cwd, '02-DOCS', 'wiki'))) {
    mkdirSync(wikiHarness, { recursive: true });
    const file = join(wikiHarness, `skill-audit-${report.date}.md`);
    writeFileSync(file, renderAuditMarkdown(report));
    written.push(file);
  }
  stampAudit(cwd, `${report.date}T00:00:00.000Z`);
  return written;
}

export { STALE_DAYS, ROOT };
