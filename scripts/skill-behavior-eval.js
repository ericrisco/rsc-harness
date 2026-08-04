#!/usr/bin/env node
// skill-behavior-eval.js — turn the behavior workflow's raw JSON into a scorecard.
// Usage:
//   node scripts/skill-behavior-eval.js --score   <raw.json>   (or pipe raw JSON on stdin with -)
//   node scripts/skill-behavior-eval.js --holdout <raw.json>   (fresh-scenario transfer gate)
// Exits 0 if the gate passes, 1 if it fails/blocks, 2 on usage/parse error.
//
// --holdout exists so the fix loop's blocking decision is a comparison of numbers an agent reports,
// never a judgement an agent makes (constitution P1).

import { readFileSync } from 'node:fs';
import { scoreFromRaw, formatScorecard, holdoutGate, formatHoldoutVerdict } from './lib/behavior-score.js';

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
    raw = JSON.parse(readInput(args[1]));
  } catch (e) {
    process.stderr.write(`parse error: ${e.message}\n`);
    process.exit(2);
  }
  const scored = scoreFromRaw(raw);
  if (mode === '--holdout') {
    const gate = holdoutGate(scored);
    process.stdout.write(formatHoldoutVerdict(scored, gate) + '\n');
    process.exit(gate.verdict === 'pass' ? 0 : 1);
  }
  process.stdout.write(formatScorecard(scored) + '\n');
  process.exit(scored.gate.pass ? 0 : 1);
}

main();
