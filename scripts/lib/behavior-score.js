// behavior-score.js — pure scoring math for the behavioral skill gate.
// No I/O, no LLM, no randomness: every function is deterministic and unit-tested.
// The Workflow engine returns raw grader signals; this lib turns them into the /10.

export const ABS_MIN = 8.5;
export const LIFT_MIN = 1.0;
export const COVERAGE_WEIGHT = 0.6;
export const QUALITY_WEIGHT = 0.4;

export function round1(x) {
  return Math.round(x * 10) / 10;
}

// Compose one output's 0-10 from grader signals.
// signals: { mustInclude: [{satisfied:boolean}], quality: {completeness,actionability,correctness,grounding} }
export function composeOutputScore(signals) {
  const mi = Array.isArray(signals && signals.mustInclude) ? signals.mustInclude : [];
  const total = mi.length;
  const satisfied = mi.filter((m) => m && m.satisfied).length;
  const q = (signals && signals.quality) || {};
  const qVals = [q.completeness, q.actionability, q.correctness, q.grounding]
    .map((v) => (typeof v === 'number' ? v : 0));
  const quality = qVals.reduce((a, b) => a + b, 0) / qVals.length; // 0-10
  if (total === 0) return round1(quality); // no checklist -> quality only
  const coverage = (satisfied / total) * 10; // 0-10
  return round1(COVERAGE_WEIGHT * coverage + QUALITY_WEIGHT * quality);
}

// treatmentScore/baselineScore are composed 0-10 numbers.
export function deriveScenario(treatmentScore, baselineScore) {
  return { absolute: round1(treatmentScore), delta: round1(treatmentScore - baselineScore) };
}

// scenarios: array of {absolute, delta} | null
export function aggregate(scenarios) {
  const valid = scenarios.filter((s) => s && typeof s.absolute === 'number');
  const dropped = scenarios.length - valid.length;
  if (valid.length === 0) return { absoluteScore: null, lift: null, n: 0, dropped };
  const absoluteScore = round1(valid.reduce((a, s) => a + s.absolute, 0) / valid.length);
  const lift = round1(valid.reduce((a, s) => a + s.delta, 0) / valid.length);
  return { absoluteScore, lift, n: valid.length, dropped };
}

// integrity is OPTIONAL and absent means "not checked", never "clean" — callers that predate the
// integrity layer (holdoutGate, raw stdin scoring) keep their exact behaviour.
//
// A violated integrity is BLOCKED, not FAIL, and the distinction is the whole point: FAIL says "the
// skill does not clear the bar" and sends someone to edit the skill. When the control read the
// answer key, the only true statement is "this run measures nothing" — a different action entirely.
export function behavioralGate(agg, integrity) {
  if (integrity && integrity.ok === false) {
    const vs = Array.isArray(integrity.violations) ? integrity.violations : [];
    return {
      pass: false,
      blocked: true,
      reasons: [integrity.reason || 'integrity check failed'],
      mustFix: vs.length
        ? vs.map((v) => `${v.kind}: ${v.agent} touched ${v.pattern} (x${v.count}) — re-run with the arm isolated.`)
        : ['Re-run the eval with integrity verifiable; the scores from this run are not a measurement.'],
      violations: vs,
    };
  }
  const reasons = [];
  const mustFix = [];
  if (!agg || agg.n === 0) {
    reasons.push('No gradeable capability scenarios (none present or all dropped).');
    mustFix.push('Add at least one capability scenario with a must_include rubric, then re-run.');
    return { pass: false, reasons, mustFix };
  }
  let pass = true;
  if (agg.absoluteScore < ABS_MIN) {
    pass = false;
    reasons.push(`absolute_score ${agg.absoluteScore} < ${ABS_MIN}`);
    mustFix.push(`Raise produced-output quality: absolute ${agg.absoluteScore}, needs >= ${ABS_MIN}.`);
  }
  if (agg.lift < LIFT_MIN) {
    pass = false;
    reasons.push(`lift ${agg.lift} < ${LIFT_MIN}`);
    mustFix.push(`Skill barely beats no-skill (lift ${agg.lift}). Make the body add value a bare agent lacks.`);
  }
  return { pass, reasons, mustFix };
}

// The hold-out gate — does a fix TRANSFER, or was it memorized?
//
// The fix loop scores the edited skill against a FRESH scenario the fixer never saw. Because the
// eval engine always runs that scenario twice (with and without the skill), the hold-out already
// carries its own lift: no pre-fix baseline is needed.
//
// The bar is deliberately NOT the main gate's LIFT_MIN. One fresh scenario graded once is noisy, so
// only the unambiguous signal acts: the edited skill failing to beat the bare agent on unseen work.
// Anything positive transfers. Raising this to LIFT_MIN would reject good fixes on variance alone
// (see 02-DOCS/wiki/sdd/specs/generalization-gate.md).
export function holdoutGate(scored) {
  const agg = scored && scored.aggregate;
  if (!agg || agg.n === 0 || typeof agg.lift !== 'number') {
    return {
      verdict: 'block',
      kind: 'indeterminate',
      lift: null,
      reason: 'Hold-out could not be scored (no gradeable fresh scenario). Failing closed: an unverified edit is not a verified one.',
    };
  }
  if (agg.lift <= 0) {
    return {
      verdict: 'block',
      kind: 'regression',
      lift: agg.lift,
      reason: `Hold-out lift ${agg.lift} <= 0: on a scenario the fixer never saw, the edited skill does not beat no-skill. The edit did not transfer.`,
    };
  }
  return {
    verdict: 'pass',
    kind: 'transfer',
    lift: agg.lift,
    reason: `Hold-out lift ${agg.lift} > 0: the edit still helps on a scenario the fixer never saw.`,
  };
}

export function formatHoldoutVerdict(scored, gate) {
  const agg = (scored && scored.aggregate) || {};
  const lines = [];
  lines.push(`# Hold-out verdict — ${(scored && scored.skillId) || '(unknown skill)'}`);
  lines.push('');
  lines.push(`**${gate.verdict === 'pass' ? 'PASS ✅' : 'BLOCK ❌'}** · ${gate.kind} · lift ${gate.lift == null ? 'n/a' : gate.lift} · absolute ${agg.absoluteScore == null ? 'n/a' : agg.absoluteScore} · n=${agg.n || 0}${agg.dropped ? ` (${agg.dropped} dropped)` : ''}`);
  lines.push('');
  lines.push(gate.reason);
  // The fresh scenario is generated by the same model that fixes. Echoing it here is the only way to
  // audit by hand whether the generator went easy on itself — a risk the spec accepts, not solves.
  if (scored && scored.holdoutScenario) {
    lines.push('');
    lines.push('**Fresh scenario used:**');
    lines.push(`> ${String(scored.holdoutScenario).replace(/\n/g, '\n> ')}`);
  }
  return lines.join('\n');
}

// raw: { skillId, scenarios: [{index, xIsTreatment, gradeX, gradeY, error?}] }
export function scoreFromRaw(raw, integrity) {
  const scenarios = (raw && Array.isArray(raw.scenarios) ? raw.scenarios : []).map((s) => {
    if (!s || s.error || !s.gradeX || !s.gradeY) {
      return { index: s ? s.index : null, error: (s && s.error) || 'missing-grade', absolute: null, delta: null };
    }
    const treatment = s.xIsTreatment ? s.gradeX : s.gradeY;
    const baseline = s.xIsTreatment ? s.gradeY : s.gradeX;
    const t = composeOutputScore(treatment);
    const b = composeOutputScore(baseline);
    const d = deriveScenario(t, b);
    return { index: s.index, treatment: t, baseline: b, absolute: d.absolute, delta: d.delta };
  });
  const agg = aggregate(scenarios);
  const gate = behavioralGate(agg, integrity);
  const out = { skillId: (raw && raw.skillId) || null, scenarios, aggregate: agg, gate };
  if (integrity) out.integrity = integrity;
  // Carried through untouched so the hold-out verdict can echo the fresh scenario for hand-audit.
  if (raw && raw.holdoutScenario) out.holdoutScenario = raw.holdoutScenario;
  return out;
}

export function formatScorecard(scored) {
  const { skillId, scenarios, aggregate: agg, gate } = scored;
  const lines = [];
  lines.push(`# Behavioral scorecard — ${skillId || '(unknown skill)'}`);
  lines.push('');
  if (gate.blocked) {
    // Deliberately NO absolute and NO lift here. Printing them beside a block invites reading them
    // anyway, and they are not measurements — that is exactly what the block is saying.
    lines.push(`**Verdict:** BLOCKED ⛔  ·  ${gate.reasons[0]}`);
    lines.push('');
    lines.push('The scores from this run are withheld: they are not a measurement of this skill.');
    lines.push('');
    lines.push('**Integrity violations:**');
    for (const f of gate.mustFix) lines.push(`- ${f}`);
    return lines.join('\n');
  }
  lines.push(`**Verdict:** ${gate.pass ? 'PASS ✅' : 'FAIL ❌'}  ·  absolute ${agg.absoluteScore == null ? 'n/a' : agg.absoluteScore}/10 (gate >= ${ABS_MIN})  ·  lift ${agg.lift == null ? 'n/a' : agg.lift} (gate >= ${LIFT_MIN})  ·  n=${agg.n}${agg.dropped ? ` (${agg.dropped} dropped)` : ''}${scored.integrity ? '  ·  integrity verified' : '  ·  integrity NOT CHECKED (pass --transcripts)'}`);
  lines.push('');
  lines.push('| Scenario | Treatment | Baseline | Delta |');
  lines.push('|---|---|---|---|');
  for (const s of scenarios) {
    if (s.error) { lines.push(`| ${s.index} | — | — | dropped (${s.error}) |`); continue; }
    lines.push(`| ${s.index} | ${s.treatment} | ${s.baseline} | ${s.delta >= 0 ? '+' : ''}${s.delta} |`);
  }
  if (!gate.pass) {
    lines.push('');
    lines.push('**Must fix:**');
    for (const f of gate.mustFix) lines.push(`- ${f}`);
  }
  return lines.join('\n');
}
