// repetition.js — has this procedure been done before, and does it deserve to stop being manual?
//
// The always-on rule already asks "did you just deliver a repeatable PROCEDURE?" — a judgment about ONE
// episode, made by the same agent that just performed it, at the moment it is most convinced its work
// was special. Grepping the always-on layer for repeat|repetit|twice|recurr returns nothing: nothing
// looks backwards.
//
// The registry that would allow it already exists. `rsc capabilities gap-log` writes one line per
// observed procedure, and the only thing that consumes it is countGaps(), which returns a TOTAL for
// `doctor` to display. The ledger is written and nobody interrogates it — the passive form of the same
// P2 defect.
//
// The evidence is the session that wrote this: four manual mutation runs (8, 17, 12, 6 mutants) and
// five identical score-then-rescore passes, none of which ever triggered the rule, because each episode
// looked like one-off work on its own.
//
// Two decisions from clarify (2026-08-18): the count is GLOBAL with a per-repo breakdown (a procedure
// repeated across projects is stronger signal, not weaker), and the threshold is THREE — a reasoned
// bet, not a measurement, and it says so.

import { tokenize } from './text-rank.js';

export const THRESHOLD = 3;

// Numerals and structural filler carry no information about WHICH procedure this is — "eight mutants"
// and "twelve mutants" are the same work. Dropping them is what made the margin measurable at all.
const FILLER = /^(uno|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|trece|catorce|quince|dieciseis|diecisiet|dieciocho|diecinuev|veint|cada|por|sobr|un|una|one|two|three|four|five|six|seven|eight|nine|ten|each)$/;

// CALIBRATED, NOT GUESSED. Three metrics were measured on real descriptions from the session that
// motivated this (3 same-procedure pairs, 12 different-procedure pairs):
//
//   metric    same            different   margin
//   jaccard   0.17–0.30       ≤0.09       0.08
//   overlap   0.29–0.50       ≤0.20       0.09
//   dice      0.29–0.46       ≤0.17       0.12   ← widest, so this is the one
//
// The first version used Jaccard at 0.6 and grouped nothing: the real case came out as four groups of
// one. Guessing a threshold for a similarity metric is how you ship a detector that never fires.
//
// HONEST LIMIT: n=15 pairs from one session. This is calibration, not validation. If it groups wrongly
// in practice the number moves, and the measurement above is the record of how it was chosen.
export const GROUP_AT = 0.25;
// The band where the answer is "maybe": it does NOT group, and it records what it refused to assume.
// Grouping wrongly inflates the count and fires an offer about something that never repeated — the more
// expensive of the two mistakes (P7: a system that nags in the harmless 80% gets switched off).
export const UNCERTAIN_AT = 0.17;

const LOG_LINE = /^- (\d{4}-\d{2}-\d{2}) · (.+?) · \*\*([a-z-]+)\*\*\s*$/;
const REPO_TAG = /\s*·?\s*\[repo:([^\]]+)\]\s*$/;

/** Parse a gap log. Malformed lines are skipped, not guessed at; the caller decides what silence means. */
export function parseGapLog(text) {
  const out = [];
  const lines = String(text || '').split('\n');
  for (let i = 0; i < lines.length; i++) {
    const m = LOG_LINE.exec(lines[i]);
    if (!m) continue;
    let procedure = m[2];
    let repo = null;
    const tag = REPO_TAG.exec(procedure);
    if (tag) { repo = tag[1]; procedure = procedure.slice(0, tag.index).trim(); }
    out.push({ date: m[1], procedure, verdict: m[3], repo, line: i + 1 });
  }
  return out;
}

/** Significant tokens: text-rank's (accent-folded, stopworded, stemmed) minus numerals and filler. */
export function terms(text) {
  return new Set(tokenize(String(text || '')).filter((tk) => !FILLER.test(tk)));
}

/**
 * Dice coefficient over significant tokens: 2|A∩B| / (|A|+|B|). Not cosine — that weights by IDF over a
 * corpus and here there are just two sentences. Not Jaccard — measured narrower on real data (see the
 * table above).
 */
export function similarity(a, b) {
  const A = terms(a);
  const B = terms(b);
  if (!A.size || !B.size) return 0;
  let inter = 0;
  for (const tk of A) if (B.has(tk)) inter++;
  return (2 * inter) / (A.size + B.size);
}

/**
 * Group entries describing the same procedure. Deterministic: first entry of a group is its key, and a
 * candidate joins only if it clears GROUP_AT against that key. Anything in the uncertain band is left
 * ungrouped and recorded, so a human can see what the detector refused to assume.
 */
export function groupProcedures(entries, threshold = GROUP_AT) {
  const groups = [];
  const uncertain = [];
  for (const e of entries) {
    let best = null;
    let bestScore = 0;
    for (const g of groups) {
      const s = similarity(e.procedure, g.key);
      if (s > bestScore) { bestScore = s; best = g; }
    }
    if (best && bestScore >= threshold) {
      best.entries.push(e);
      if (e.repo) best.repos.set(e.repo, (best.repos.get(e.repo) || 0) + 1);
      continue;
    }
    if (best && bestScore >= UNCERTAIN_AT) {
      uncertain.push({ procedure: e.procedure, nearest: best.key, score: Number(bestScore.toFixed(2)) });
    }
    groups.push({
      key: e.procedure,
      entries: [e],
      repos: new Map(e.repo ? [[e.repo, 1]] : []),
    });
  }
  return { groups, uncertain };
}

const CAPABILITY_VERBS = /\b(plantar|plant|correr|ejecutar|run|contar|count|restaurar|restore|medir|measure|extraer|extract|puntuar|score|comparar|compare|generar|generate)\b/i;
const AGENT_VERBS = /\b(revisar|review|refutar|refute|auditar|audit|verificar|verify|juzgar|judge|a ciegas|blind)\b/i;

/**
 * Which shape does this procedure want? Order matters: the first match wins, and capability comes
 * first because it is the majority case observed and the one with no verdict until now. Writing a
 * paragraph for something that needs a script is the failure the generalization gate already named.
 */
export function recommendKind(procedure) {
  const p = String(procedure || '');
  if (CAPABILITY_VERBS.test(p)) {
    return {
      kind: 'capability',
      why: 'describe algo que hay que ejecutar y comparar; una skill escribiría un párrafo donde hace falta un script o un hook',
    };
  }
  if (AGENT_VERBS.test(p)) {
    return {
      kind: 'agent',
      why: 'describe mirar o juzgar sin arrastrar el contexto de quien lo pide, que es para lo que sirve un contexto fresco',
    };
  }
  return { kind: 'skill', why: 'describe guía y disciplina sobre lo que ya se está haciendo en la conversación' };
}

const DECLINED = 'proposed-declined';

/**
 * Should anything be said? Silence is the default and the common case.
 *
 * Never offers when: below threshold, already covered, or previously declined. A "no" that has to be
 * repeated every week is what makes someone switch the whole harness off.
 */
export function decideOffer({ groups, threshold = THRESHOLD, covered = false }) {
  if (covered) return { offer: null, reason: 'ya cubierto por una skill o agente instalado' };
  const ranked = [...groups].sort((a, b) => b.entries.length - a.entries.length);
  for (const g of ranked) {
    if (g.entries.length < threshold) continue;
    // A decline anywhere in the group retires it permanently.
    if (g.entries.some((e) => e.verdict === DECLINED)) continue;
    const rec = recommendKind(g.key);
    return {
      offer: {
        procedure: g.key,
        seen: g.entries.length,
        dates: g.entries.map((e) => e.date),
        repos: [...g.repos.entries()].map(([repo, n]) => ({ repo, n })),
        kind: rec.kind,
        why: rec.why,
        threshold,
      },
      reason: null,
    };
  }
  return { offer: null, reason: `ningún procedimiento alcanza el umbral de ${threshold}` };
}

/** Merge local + global entries, de-duplicated by date+procedure+verdict, so double-writing cannot double-count. */
export function mergeLogs(localEntries, globalEntries) {
  const seen = new Set();
  const out = [];
  for (const e of [...localEntries, ...globalEntries]) {
    const k = `${e.date}|${e.procedure}|${e.verdict}`;
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(e);
  }
  return out;
}
