// repetition-report.js — the I/O half of the repetition detector.
//
// Kept apart from repetition.js on purpose: the deciding is pure and heavily tested, the reading of two
// files is not. Mixing them would make the interesting logic need fixtures on disk.

import { readFileSync, existsSync } from 'node:fs';
import { homedir } from 'node:os';
import { gapLogPath, globalGapLogPath, capabilities } from './capabilities.js';
import { parseGapLog, groupProcedures, decideOffer, mergeLogs, THRESHOLD } from './repetition.js';

/**
 * Read local + global logs, group, decide. FAILS CLOSED: an unreadable log yields `blocked`, never an
 * invented count. countGaps() already sets the precedent of not taking `doctor` down over a malformed
 * log; the difference here is that the degradation is announced instead of swallowed.
 */
export function repetitionReport({ cwd = process.cwd(), home = homedir(), target = 'claude' } = {}) {
  const read = (p, label) => {
    if (!existsSync(p)) return { entries: [], missing: true };
    try { return { entries: parseGapLog(readFileSync(p, 'utf8')), missing: false }; }
    catch (e) { return { error: `no se pudo leer el registro ${label} (${p}): ${e.message}` }; }
  };
  const local = read(gapLogPath(cwd), 'local');
  const global = read(globalGapLogPath(home), 'global');
  if (local.error || global.error) {
    return { blocked: true, reason: local.error || global.error, offer: null, uncertain: [], entries: 0 };
  }
  const merged = mergeLogs(local.entries, global.entries);
  if (!merged.length) {
    return { blocked: false, offer: null, reason: 'no hay entradas registradas todavía', uncertain: [], entries: 0 };
  }
  const { groups, uncertain } = groupProcedures(merged);

  // "Already covered" is answered by the command that reads the disk, never by memory — the decision
  // capabilities.js already made and for the right reason.
  let covered = false;
  try {
    const caps = capabilities({ target, cwd });
    const top = [...groups].sort((a, b) => b.entries.length - a.entries.length)[0];
    if (top) {
      const words = top.key.toLowerCase();
      covered = caps.installed.some((s) => words.includes(s.id)) || (caps.agents || []).some((a) => words.includes(a.id));
    }
  } catch { /* enumeration failing must not fabricate "covered" — leave it false */ }

  const { offer, reason } = decideOffer({ groups, threshold: THRESHOLD, covered });
  return { blocked: false, offer, reason, uncertain, entries: merged.length, groups: groups.length };
}
