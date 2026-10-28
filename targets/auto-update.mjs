#!/usr/bin/env node
// rsc update check, shared by every assistant that can run it. Standalone (Node built-ins only),
// copied to `.rsc/auto-update.mjs` at install, like the other hooks.
//
// Three ways in, one rule:
//   - Claude Code: `session-start.mjs` imports `updateNotice` and prints it with the always-on body.
//   - Codex, Gemini CLI, Cursor: a session-start hook runs `node .rsc/auto-update.mjs hook <target>`
//     and gets the notice back in that assistant's own output shape.
//   - OpenCode: its plugin imports `updateNotice` and hands the notice to the model.
//   - Any other assistant has no hook. The always-on body asks the agent to run
//     `node .rsc/auto-update.mjs` on its first turn, and to relay what it prints.
import { readFileSync, existsSync, writeFileSync, openSync } from 'node:fs';
import { spawn } from 'node:child_process';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

// Update check: compare the installed version (.rsc/.version, written at install)
// against the latest published on npm, and nudge the agent to offer an update.
// Fail-silent (offline / missing baseline / parse error → nothing). Disable with
// RSC_NO_UPDATE_CHECK=1. RSC_LATEST overrides the npm lookup (tests / mirrors).
function isNewer(a, b) {
  const pa = String(a).split('.').map(Number);
  const pb = String(b).split('.').map(Number);
  for (let i = 0; i < 3; i++) {
    if ((pa[i] || 0) > (pb[i] || 0)) return true;
    if ((pa[i] || 0) < (pb[i] || 0)) return false;
  }
  return false;
}

// "rsc X is out" was being ignored — the maintainer's own workspace sat on 2.0.4 for days with this
// notice on every session, and two people in two days reported bugs that were already fixed. A
// version number names nothing anyone recognises. A symptom does: someone who sees a red error after
// every turn updates the moment they are told that is what the update fixes (`suggest` §3: say what
// is wrong as a symptom, not as a cause).
//
// The symptoms travel for free: the registry's `/latest` document is the published package.json, so
// its `rscFixes` field — `{ fixedIn, symptom }` — arrives in the response this check already makes.
// It is text a model will read, so every entry is reduced to one short plain line or dropped.
const SEMVER_ONLY = /^\d+\.\d+\.\d+$/;
function fixesSince(list, installed, latest) {
  if (!Array.isArray(list)) return [];
  const out = [];
  for (const item of list) {
    if (!item || typeof item !== 'object' || typeof item.symptom !== 'string') continue;
    if (!SEMVER_ONLY.test(String(item.fixedIn))) continue;
    if (!isNewer(item.fixedIn, installed) || isNewer(item.fixedIn, latest)) continue;
    const symptom = item.symptom.replace(/[\u0000-\u001f\u007f]+/g, ' ').replace(/\s+/g, ' ').trim().slice(0, 200);
    if (symptom) out.push({ fixedIn: item.fixedIn, symptom });
  }
  return out.slice(0, 8);
}

// Auto-update. Asking was not enough: the notice depended on an agent relaying it, and people kept
// running bugs that were already fixed. So a release in the SAME major installs itself; a new major
// can change how the harness works, and still asks. On by default; `.rsc/.no-auto-update` (a project
// decision, travels in `optOuts`) brings back the question for every release.
//
// It runs in the background because `npx` can take longer than a hook may, and it changes nothing in
// this session anyway: the skills are already loaded. The version is the exact one seen here, never
// `@latest` — what is published in between does not slip in. One attempt per version: a failure falls
// back to asking, and is retried at most once a day.
const stateFile = (root) => join(root, '.rsc', 'auto-update.json');
const logFile = (root) => join(root, '.rsc', 'auto-update.log');
const AUTO_RUNNING_MS = 15 * 60 * 1000;
const AUTO_RETRY_MS = 24 * 60 * 60 * 1000;
const majorOf = (v) => Number(String(v).split('.')[0]) || 0;

function readAutoState(root) {
  try { return JSON.parse(readFileSync(stateFile(root), 'utf8')); } catch { return null; }
}
function writeAutoState(root, state) {
  try { writeFileSync(stateFile(root), `${JSON.stringify(state, null, 2)}\n`); } catch { /* best effort */ }
}
function declaredTargets(root) {
  try {
    const list = JSON.parse(readFileSync(join(root, '.rsc.json'), 'utf8')).targets;
    return Array.isArray(list) ? list.filter((t) => typeof t === 'string' && /^[a-z0-9-]+$/.test(t)) : [];
  } catch { return []; }
}
function launchUpdate(root, version, env) {
  // RSC_AUTO_UPDATE_CMD (a JSON argv) replaces npx in tests; the arguments after it are the real ones.
  const base = env.RSC_AUTO_UPDATE_CMD
    ? JSON.parse(env.RSC_AUTO_UPDATE_CMD)
    : ['npx', '-y', `@ericrisco/rsc@${version}`];
  const targets = declaredTargets(root);
  const args = [...base.slice(1), 'sync', ...(targets.length ? ['--target', targets.join(',')] : [])];
  const log = openSync(logFile(root), 'w');
  // #293 — on Windows npx is npx.cmd, which Node only starts through a shell, and a shell is one more
  // console that can flash. So npx runs as what it is, a script of the npm that ships with Node,
  // started by node itself. Only when that script cannot be found (a runtime that is not Node, e.g.
  // OpenCode's Bun) does it fall back to the shell — still hidden.
  const npxCli = !env.RSC_AUTO_UPDATE_CMD && process.platform === 'win32' && !process.versions.bun
    ? [join(dirname(process.execPath), 'node_modules', 'npm', 'bin', 'npx-cli.js')].find((p) => existsSync(p))
    : null;
  const [command, argv] = npxCli ? [process.execPath, [npxCli, ...args]] : [base[0], args];
  const viaShell = !npxCli && process.platform === 'win32';
  const child = spawn(command, argv, {
    cwd: root,
    detached: true,
    stdio: ['ignore', log, log],
    windowsHide: true,
    shell: viaShell, // fallback only (see above); every argument was validated above
    env: { ...env, RSC_NO_UPDATE_CHECK: '1', RSC_AUTO_UPDATE_TO: version },
  });
  child.on('error', () => {});
  child.unref();
}

export async function updateNotice(root, env = process.env) {
  let out = '';
  const say = (text) => { out += text; };
  try {
    const installed = readFileSync(join(root, '.rsc', '.version'), 'utf8').trim();
    // A background update that finished since the last session: say so once, then keep quiet.
    const prior = readAutoState(root);
    if (prior && !prior.reported && SEMVER_ONLY.test(String(prior.to)) && !isNewer(prior.to, installed)) {
      say(`
===== rsc updated =====
rsc updated itself in the background, from ${prior.from} to ${installed}. It is active in this session.
ACTION: tell the user in one line. Files of the harness may show as changed in git.
=======================
`);
      writeAutoState(root, { ...prior, reported: true });
    }
    let doc = null;
    if (env.RSC_LATEST_JSON) doc = JSON.parse(env.RSC_LATEST_JSON);
    else if (env.RSC_LATEST) doc = { version: env.RSC_LATEST };
    else {
      const ctrl = new AbortController();
      const timer = setTimeout(() => ctrl.abort(), 1500);
      const res = await fetch('https://registry.npmjs.org/@ericrisco%2frsc/latest', { signal: ctrl.signal });
      clearTimeout(timer);
      doc = await res.json();
    }
    const latest = doc?.version;
    if (installed && SEMVER_ONLY.test(String(latest)) && isNewer(latest, installed)) {
      const newMajor = majorOf(latest) !== majorOf(installed);
      const auto = !existsSync(join(root, '.rsc', '.no-auto-update')) && !newMajor;
      const now = Date.now();
      const since = prior && prior.to === latest ? now - new Date(prior.startedAt).getTime() : Infinity;
      if (auto && since >= AUTO_RETRY_MS) {
        launchUpdate(root, latest, env);
        writeAutoState(root, { from: installed, to: latest, startedAt: new Date(now).toISOString() });
        say(`
===== rsc updating =====
rsc ${latest} is out — you have ${installed}. It is installing itself in the background now and
takes effect in the next session. Nothing to do.
ACTION: tell the user in one line, then continue with the task.
========================
`);
      } else if (auto && since < AUTO_RUNNING_MS) {
        say(`
===== rsc updating =====
rsc ${latest} is still installing itself in the background. It takes effect in the next session.
========================
`);
      } else {
        // Asking: auto-update is off here, the release is a new major, or the background attempt failed.
        let why = '';
        if (auto) why = `The automatic update did not finish (log: .rsc/auto-update.log); it retries once a day.\n`;
        else if (newMajor) why = 'It is a new major version: it can change how the harness works, so it asks first.\n';
        let fixes = [];
        try { fixes = fixesSince(doc.rscFixes, installed, latest); } catch { fixes = []; }
        if (fixes.length) {
          say(`
===== rsc update available =====
rsc ${latest} is out — you have ${installed}. It fixes problems this install still has:
${fixes.map((f) => `  - ${f.symptom} (fixed in ${f.fixedIn})`).join('\n')}
${why}ACTION: before starting the task, tell the user in one line that the update fixes what they
may be seeing, and if they say yes, run it in this project:
  npx @ericrisco/rsc@latest
================================
`);
        } else {
          say(`
===== rsc update available =====
rsc ${latest} is out — you have ${installed}.
${why}ACTION: tell the user a new version is available and, if they say yes, run:
  npx @ericrisco/rsc@latest
(That reinstalls and refreshes the skill content to the latest.)
================================
`);
        }
      }
    }
  } catch { /* offline / no baseline / parse error → stay silent */ }
  return out;
}

// What each assistant's session-start hook accepts. Codex and Gemini take Claude's shape; Cursor has
// its own field names. Plain text for an agent that runs this by hand.
export function hookOutput(target, notice) {
  if (!notice) return target === 'agent' ? '' : '{}';
  if (target === 'agent') return notice;
  if (target === 'cursor') return JSON.stringify({ additional_context: notice });
  return JSON.stringify({ hookSpecificOutput: { hookEventName: 'SessionStart', additionalContext: notice } });
}

// Run as a script: `node auto-update.mjs [hook <target>] [root]`. Never fails a session.
if (process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const hook = process.argv[2] === 'hook';
  const target = hook ? String(process.argv[3] || 'agent') : 'agent';
  const root = (hook ? process.argv[4] : process.argv[2]) || process.cwd();
  let notice = '';
  try { if (!process.env.RSC_NO_UPDATE_CHECK) notice = (await updateNotice(root)).trim(); } catch { /* fail open */ }
  // Codex has no session-start.mjs: its one SessionStart hook is this one, so the MemSlop offer rides
  // here (macOS 14+ only, rsc projects only). A sibling loaded lazily; any failure → no offer.
  if (target === 'codex' && existsSync(join(root, '02-DOCS', 'wiki', 'harness', 'user-profile.md'))) {
    try {
      const said = (await import('./memslop-offer.mjs')).memslopNotice().trim();
      if (said) notice = notice ? `${notice}\n\n${said}` : said;
    } catch { /* no offer */ }
  }
  if (!hook && !notice) notice = 'rsc is up to date.';
  process.stdout.write(`${hookOutput(target, notice)}\n`);
}
