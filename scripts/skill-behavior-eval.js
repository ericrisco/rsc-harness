#!/usr/bin/env node
// skill-behavior-eval.js — turn the behavior workflow's raw JSON into a scorecard.
// Usage:
//   node scripts/skill-behavior-eval.js --score   <raw.json> [--transcripts <dir>]
//   node scripts/skill-behavior-eval.js --holdout <raw.json>   (fresh-scenario transfer gate)
// Exits 0 if the gate passes, 1 if it fails/blocks, 2 on usage/parse error.
//
// --transcripts runs the integrity check (scripts/lib/eval-integrity.js) over the workflow's agent
// transcripts: did the "without the skill" arm read the skill, or its grading rubric, or write into
// 02-DOCS? Any of those and the verdict is BLOCKED and the numbers are withheld, because a lift
// measured against a contaminated control is not a measurement.
//
// Without --transcripts the scorecard says "integrity NOT CHECKED" on the verdict line. That is
// deliberate: the flag is optional so existing callers keep working, so silence must not read as
// clean.
//
// --holdout exists so the fix loop's blocking decision is a comparison of numbers an agent reports,
// never a judgement an agent makes (constitution P1).

import { readFileSync } from 'node:fs';
import { scoreFromRaw, formatScorecard, holdoutGate, formatHoldoutVerdict } from './lib/behavior-score.js';
import { checkIntegrity } from './lib/eval-integrity.js';

function readInput(argPath) {
  if (argPath && argPath !== '-') return readFileSync(argPath, 'utf8');
  return readFileSync(0, 'utf8'); // stdin
}

function main() {
  const args = process.argv.slice(2);
  const mode = args[0];
  if (mode !== '--score' && mode !== '--holdout') {
    process.stderr.write('usage: skill-behavior-eval.js --score|--holdout <raw.json|->\n');
    process.exit(2);
  }
  let raw;
  try {
    raw = JSON.parse(readInput(args[1] && args[1] !== '--transcripts' ? args[1] : '-'));
  } catch (e) {
    process.stderr.write(`parse error: ${e.message}\n`);
    process.exit(2);
  }
  const ti = args.indexOf('--transcripts');
  const transcriptsDir = ti !== -1 ? args[ti + 1] : null;
  if (ti !== -1 && !transcriptsDir) {
    process.stderr.write('--transcripts needs a directory\n');
    process.exit(2);
  }
  const integrity = transcriptsDir
    ? checkIntegrity({ skillId: (raw && raw.skillId) || '', transcriptsDir })
    : undefined;
  const scored = scoreFromRaw(raw, integrity);
  if (mode === '--holdout') {
    const gate = holdoutGate(scored);
    process.stdout.write(formatHoldoutVerdict(scored, gate) + '\n');
    process.exit(gate.verdict === 'pass' ? 0 : 1);
  }
  process.stdout.write(formatScorecard(scored) + '\n');
  process.exit(scored.gate.pass ? 0 : 1);
}

main();
