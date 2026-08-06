#!/usr/bin/env node

import { existsSync, readdirSync, readFileSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRanker } from './consult.js';
import { loadManifest } from './lib/manifest.js';
import { buildTextCorpus, descriptionCollisions } from './lib/text-rank.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const FLOORS = {
  rank1: 44,
  top5: 70,
  routedTop5: 85,
  maxNegativeSelfRank1: 6,
  maxCollision: 0.80,
};

function unquote(value) {
  const trimmed = value.trim();
  if (trimmed.startsWith('"')) return JSON.parse(trimmed);
  return trimmed.replace(/^['"]|['"]$/g, '');
}

export function loadRoutingCases(root = ROOT) {
  const cases = [];
  const skillsRoot = join(root, 'skills');
  for (const skill of readdirSync(skillsRoot).sort()) {
    const file = join(skillsRoot, skill, 'evals', 'cases.yaml');
    if (!existsSync(file)) continue;
    const lines = readFileSync(file, 'utf8').split(/\r?\n/);
    let section = '';
    for (let index = 0; index < lines.length; index += 1) {
      const line = lines[index];
      if (/^should_trigger:/.test(line)) section = 'positive';
      else if (/^should_not_trigger:/.test(line)) section = 'negative';
      else if (/^capability:/.test(line)) section = '';
      const prompt = line.match(/^  - prompt:\s*(".*")$/);
      if (!prompt || !section) continue;

      let routeTo = null;
      if (section === 'negative') {
        for (let next = index + 1; next < Math.min(lines.length, index + 8); next += 1) {
          if (/^  - prompt:|^[A-Za-z_]+:/.test(lines[next])) break;
          const route = lines[next].match(/^\s+route_to:\s*(.+?)\s*$/);
          if (route) {
            routeTo = unquote(route[1]);
            break;
          }
        }
      }
      cases.push({ skill, section, prompt: unquote(prompt[1]), routeTo });
    }
  }
  return cases;
}

function percentage(value, total) {
  return total ? (100 * value) / total : 0;
}

function singleCatalogRoute(routeTo, ids) {
  if (!routeTo || routeTo === 'none' || routeTo.startsWith('external:')) return null;
  if (/[|,]/.test(routeTo) || routeTo.includes(' or ')) return null;
  return ids.has(routeTo) ? routeTo : null;
}

export async function auditRouting(manifest, cases) {
  const ids = new Set(manifest.skills.map(({ id }) => id));
  const ranker = await createRanker(manifest);
  const result = {
    positives: 0,
    rank1: 0,
    top3: 0,
    top5: 0,
    negatives: 0,
    negativeSelfRank1: 0,
    routed: 0,
    routedTop5: 0,
    routeBeatsOwner: 0,
    missedBySkill: new Map(),
  };

  try {
    for (const row of cases) {
      const ranked = ranker.rank(row.prompt).map(({ id }) => id);
      if (row.section === 'positive') {
        result.positives += 1;
        const position = ranked.indexOf(row.skill);
        if (position === 0) result.rank1 += 1;
        if (position >= 0 && position < 3) result.top3 += 1;
        if (position >= 0 && position < 5) result.top5 += 1;
        else result.missedBySkill.set(row.skill, (result.missedBySkill.get(row.skill) || 0) + 1);
        continue;
      }

      result.negatives += 1;
      if (ranked[0] === row.skill) result.negativeSelfRank1 += 1;
      const target = singleCatalogRoute(row.routeTo, ids);
      if (!target) continue;
      result.routed += 1;
      const targetPosition = ranked.indexOf(target);
      const ownerPosition = ranked.indexOf(row.skill);
      if (targetPosition >= 0 && targetPosition < 5) result.routedTop5 += 1;
      if (targetPosition >= 0 && (ownerPosition < 0 || targetPosition < ownerPosition)) {
        result.routeBeatsOwner += 1;
      }
    }
  } finally {
    ranker.close();
  }
  return result;
}

async function main() {
  const manifest = loadManifest();
  const cases = loadRoutingCases();
  const result = await auditRouting(manifest, cases);
  const collisions = descriptionCollisions(buildTextCorpus(manifest.skills), 0.45);
  const rates = {
    rank1: percentage(result.rank1, result.positives),
    top3: percentage(result.top3, result.positives),
    top5: percentage(result.top5, result.positives),
    negativeSelfRank1: percentage(result.negativeSelfRank1, result.negatives),
    routedTop5: percentage(result.routedTop5, result.routed),
    routeBeatsOwner: percentage(result.routeBeatsOwner, result.routed),
  };

  console.log(`routing-audit: ${manifest.skills.length} skills · ${cases.length} prompts`);
  console.log(
    `positive recall: rank-1 ${rates.rank1.toFixed(1)}% · top-3 ${rates.top3.toFixed(1)}% · top-5 ${rates.top5.toFixed(1)}%`,
  );
  console.log(
    `negative owner-at-1: ${rates.negativeSelfRank1.toFixed(1)}% · declared route top-5 ${rates.routedTop5.toFixed(1)}% · route beats owner ${rates.routeBeatsOwner.toFixed(1)}%`,
  );
  console.log('highest description overlaps:');
  for (const row of collisions.slice(0, 10)) {
    console.log(`  ${row.score.toFixed(2)}  ${row.left} ↔ ${row.right}`);
  }
  const misses = [...result.missedBySkill].sort((a, b) => b[1] - a[1] || a[0].localeCompare(b[0]));
  console.log(`largest top-5 gaps: ${misses.slice(0, 10).map(([id, count]) => `${id} (${count})`).join(', ')}`);

  const failures = [];
  if (rates.rank1 < FLOORS.rank1) failures.push(`rank-1 ${rates.rank1.toFixed(1)}% < ${FLOORS.rank1}%`);
  if (rates.top5 < FLOORS.top5) failures.push(`top-5 ${rates.top5.toFixed(1)}% < ${FLOORS.top5}%`);
  if (rates.routedTop5 < FLOORS.routedTop5) {
    failures.push(`declared-route top-5 ${rates.routedTop5.toFixed(1)}% < ${FLOORS.routedTop5}%`);
  }
  if (rates.negativeSelfRank1 > FLOORS.maxNegativeSelfRank1) {
    failures.push(`negative owner-at-1 ${rates.negativeSelfRank1.toFixed(1)}% > ${FLOORS.maxNegativeSelfRank1}%`);
  }
  if (collisions[0]?.score >= FLOORS.maxCollision) {
    failures.push(`description collision ${collisions[0].score.toFixed(2)} >= ${FLOORS.maxCollision}`);
  }

  if (failures.length) {
    console.error(`FAIL: ${failures.join('; ')}`);
    process.exit(1);
  }
  console.log('PASS');
}

if (import.meta.url === `file://${process.argv[1]}`) main();
