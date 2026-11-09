#!/usr/bin/env node
// Validates an audit directory written by the `security-audit` skill:
//
//   node validate-findings.mjs <audit-dir>
//
// The audit dir holds `findings.json` plus the evidence files it cites. This is the deterministic half
// of the skill: the model writes findings.json, and this script refuses any claim the files on disk do
// not support — a confirmed finding citing a file that is not there, a line past the end of it, an
// evidence path that escapes the audit dir, a run called complete while a platform was never looked
// at, a live secret pasted into the report. The contract is documented in
// ../schema/findings.schema.json; this file does not read that schema (no ajv, node: built-ins only),
// it enforces the same rules by hand plus the disk checks no schema can express.
//
// Every error is `<json path>: <message>`. Messages never echo a value that could be a secret: the
// JSON path says where to look.
import { lstatSync, readdirSync, readFileSync, realpathSync, statSync } from 'node:fs';
import { isAbsolute, join, resolve, sep } from 'node:path';
import { fileURLToPath } from 'node:url';

export const MAX_BYTES = 5 * 1024 * 1024;
// Every other file in the audit dir is scanned for secrets; above this it is refused, not scanned.
export const MAX_SCAN_BYTES = 2 * 1024 * 1024;
const MAX_SCAN_FILES = 5000;
export const MAX_DEPTH = 32;

const VERDICTS = ['confirmed', 'needs_validation', 'rejected'];
const SEVERITIES = ['critical', 'high', 'medium', 'low'];
const SURFACES = ['code', 'platform'];
const PROFILES = ['quick', 'standard', 'deep'];
const RUN_STATUS = ['complete', 'partial'];
const EVIDENCE_KINDS = ['artifact', 'command_output', 'source'];
const FIX_STATUS = ['proposed', 'approved', 'applied', 'declined', 'rolled_back', 'manual'];
const RECHECK_RESULTS = ['pass', 'fail', 'not_run'];
const UNIT_STATUS = ['done', 'blocked', 'not_reviewed'];
const ACCESS = ['read_only', 'write_for_fix', 'none'];
const PLATFORM_STATUS = ['reviewed', 'not_reviewed'];
const TOOL_PATH = /^01-TOOLS\/security\/[a-z0-9][a-z0-9._-]{0,63}\/?$/;

// Likely live secrets. Each pattern is deliberately narrow: a validator that cries wolf on every
// base64 blob gets switched off. Redacted forms (`sk_live_****`, `[REDACTED]`) do not match because
// the character classes exclude `*`, `[` and `]`.
//
// Every pattern is linear: it starts with a literal, every quantifier has an upper bound, and no two
// optional parts can match the same text. On top of that, text is scanned in bounded chunks
// (scanText), so even a pathological line costs at most CHUNK × bound per chunk.
const SECRET_PATTERNS = [
  ['PEM private key', /-----BEGIN [A-Z0-9 ]{0,40}PRIVATE KEY-----/],
  ['AWS access key id', /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/],
  ['GitHub token', /\b(?:gh[posu]_[A-Za-z0-9]{20,255}|github_pat_[A-Za-z0-9_]{20,255})/],
  ['Slack token', /\bxox[abpr]-[A-Za-z0-9-]{10,255}/],
  ['Stripe key', /\b(?:sk|rk)_(?:live|test)_[A-Za-z0-9]{8,255}/],
  ['Stripe webhook secret', /\bwhsec_[A-Za-z0-9+/=]{16,255}/],
  ['Supabase secret key', /\bsb_secret_[A-Za-z0-9_-]{16,255}/],
  ['Anthropic key', /\bsk-ant-[A-Za-z0-9_-]{20,255}/],
  ['OpenAI key', /\bsk-(?:proj|svcacct|admin)-[A-Za-z0-9_-]{20,255}|\bsk-[A-Za-z0-9]{40,255}/],
  ['Google API key', /\bAIza[0-9A-Za-z_-]{35}/],
  ['Bearer token', /\bBearer[ \t]{1,8}[A-Za-z0-9\-._~+/]{24,1024}/],
  ['Basic credentials', /\bAuthorization["']?[ \t]{0,4}[:=][ \t]{0,4}["']?Basic[ \t]{1,8}[A-Za-z0-9+/]{8,1024}/i],
  // A JWT is recognised by its start: header and payload both begin `eyJ` (base64 of `{"`), so a plain
  // `a.b.c` hostname never matches. Matching only the start keeps the match short (well inside the
  // chunk overlap) however long the payload is: tokens with group claims run to several KB.
  ['JWT', /\beyJ[A-Za-z0-9_-]{8,512}\.eyJ[A-Za-z0-9_-]{8}/],
];
// A credential NAME ends in the keyword: `password`, `client_secret`, `GITHUB_TOKEN`, `accessToken`.
// `token_endpoint`, `tokenUrl`, `tokenizer` or `passwordResetLink` only start with it and are not names
// of a credential.
const KEYWORD = '(?<![A-Za-z0-9])(?:[A-Za-z0-9]{1,32}[_-]?)?(?:password|passwd|secret|token|api[_-]?key)s?(?![A-Za-z0-9_-])';
// `scheme://user:pass@host`. The password is tested separately so `:<password>@`, `:****@` pass.
const URL_CREDENTIALS = /\b[A-Za-z][A-Za-z0-9+.-]{0,19}:\/\/[^\s:/@'"<>]{1,128}:([^\s/@'"]{1,256})@[A-Za-z0-9[]/g;
// A quoted literal assigned to a credential name: `password: "…"`, `"api_key": "…"`, `token = '…'`.
const QUOTED_ASSIGNMENT = new RegExp(`${KEYWORD}["']?[ \\t]{0,8}[:=][ \\t]{0,8}(["'\`])([A-Za-z0-9+/=_.~!@#$%^&*:-]{16,256})\\1`, 'gi');
// An unquoted `.env`-style line: `NAME=value` at the start of the line, the whole rest of the line
// being one token with no call, no member access, no space.
const ENV_ASSIGNMENT = /^[ \t]{0,8}(?:export[ \t]{1,4})?([A-Za-z_][A-Za-z0-9_]{0,63})=([A-Za-z0-9+/=_.~!@#$%^&*:-]{16,256})[ \t]{0,8}\r?$/;
const ENV_NAME = /(?:password|passwd|secret|token|api[_-]?key)s?$/i;
const REDACTED_VALUE = /\*{3,}|redacted|^<.*>$|^\$\{|^\$[A-Z_]|^(?:process\.env|os\.environ|env\.|getenv)|^x{6,}$/i;
const PLACEHOLDER_PASSWORD = /^(?:pass(?:word)?|pwd|secret|changeme|\*+|x+|\.{3}|<[^>]*>|\$\{[^}]*\}|\$[A-Za-z_][A-Za-z0-9_]*|\[[^\]]*\]|%[A-Za-z0-9_]+%?)$/i;
// `a.b.c`: a member access, not a value.
const MEMBER_ACCESS = /^[A-Za-z_$][\w$]{0,63}(?:\.[A-Za-z_$][\w$]{0,63}){1,8}$/;
// A random-looking literal has a digit or mixes upper and lower case; `my-app-name` does not.
const looksRandom = (v) => /[0-9]/.test(v) || (/[a-z]/.test(v) && /[A-Z]/.test(v));

export const CHUNK = 4096;
const OVERLAP = 1100; // longer than any single pattern can match, so a secret across a chunk edge is still seen

function chunkKinds(text, kinds) {
  for (const [kind, re] of SECRET_PATTERNS) if (!kinds.has(kind) && re.test(text)) kinds.add(kind);
  if (!kinds.has('URL credentials')) {
    for (const m of text.matchAll(URL_CREDENTIALS)) {
      if (!PLACEHOLDER_PASSWORD.test(m[1]) && !REDACTED_VALUE.test(m[1])) { kinds.add('URL credentials'); break; }
    }
  }
  if (!kinds.has('credential assignment')) {
    for (const m of text.matchAll(QUOTED_ASSIGNMENT)) {
      if (!REDACTED_VALUE.test(m[2]) && !m[2].includes('://') && looksRandom(m[2])) { kinds.add('credential assignment'); break; }
    }
  }
}

/** Returns the kinds of likely live secret found in `text` (never the values). */
export function secretKinds(text) {
  const kinds = new Set();
  let start = 0;
  for (const line of String(text).split('\n')) {
    // The `.env` rule only looks at the start of a line.
    const m = ENV_ASSIGNMENT.exec(line.length > 512 ? line.slice(0, 512) : line);
    if (m && ENV_NAME.test(m[1]) && !REDACTED_VALUE.test(m[2]) && !MEMBER_ACCESS.test(m[2])) kinds.add('credential assignment');
    for (start = 0; start < line.length; start += CHUNK - OVERLAP) {
      chunkKinds(line.slice(start, start + CHUNK), kinds);
      if (start + CHUNK >= line.length) break;
    }
  }
  return [...kinds];
}

// Shows a value in an error only when it is short, boring and secret-free (ids, enum values).
function show(v) {
  return typeof v === 'string' && /^[A-Za-z0-9_.:/-]{1,64}$/.test(v) && secretKinds(v).length === 0
    ? JSON.stringify(v) : '(value not shown)';
}

const isObj = (v) => v !== null && typeof v === 'object' && !Array.isArray(v);
const isStr = (v) => typeof v === 'string' && v.trim() !== '';

// Nesting depth of raw JSON text, counted before parsing so a hostile file never reaches a recursive
// walk. Brackets inside strings do not count.
function rawDepth(text) {
  let depth = 0;
  let max = 0;
  let inStr = false;
  for (let i = 0; i < text.length; i++) {
    const c = text[i];
    if (inStr) {
      if (c === '\\') i++;
      else if (c === '"') inStr = false;
    } else if (c === '"') inStr = true;
    else if (c === '{' || c === '[') { if (++depth > max) max = depth; }
    else if (c === '}' || c === ']') depth--;
  }
  return max;
}

// Resolves `rel` inside `baseReal` (an already-realpath'd directory) under the escape rules shared by
// code locations and evidence: relative only, no `..`, no symlink anywhere on the way, a regular file
// at the end, and its realpath still inside the base. Returns { abs, size } or { error }.
function resolveInside(baseReal, rel, baseName, { dir = false } = {}) {
  if (!isStr(rel)) return { error: 'must be a non-empty relative path' };
  if (rel.includes('\0') || isAbsolute(rel) || /^[A-Za-z]:/.test(rel) || rel.startsWith('\\')) {
    return { error: `absolute paths escape ${baseName}; use a path relative to it` };
  }
  const segments = rel.split(/[\\/]+/).filter((s) => s !== '' && s !== '.');
  if (segments.includes('..')) return { error: `path would escape ${baseName}: ".." segments are refused` };
  let cur = baseReal;
  for (let i = 0; i < segments.length; i++) {
    cur = join(cur, segments[i]);
    let st;
    try { st = lstatSync(cur); } catch { return { error: `does not exist under ${baseName}` }; }
    if (st.isSymbolicLink()) return { error: `goes through a symlink; symlinks are refused (they can escape ${baseName})` };
    const last = i === segments.length - 1;
    if (last && !dir && !st.isFile()) return { error: 'is not a regular file' };
    if (last && dir && !st.isDirectory()) return { error: 'is not a directory' };
    if (!last && !st.isDirectory()) return { error: `does not exist under ${baseName}` };
  }
  if (segments.length === 0) return { error: dir ? 'must name a directory' : 'must name a file' };
  let real;
  try { real = realpathSync(cur); } catch { return { error: `does not exist under ${baseName}` }; }
  if (!real.startsWith(baseReal + sep)) return { error: `path would escape ${baseName}` };
  return { abs: real, size: statSync(real).size, rel: real.slice(baseReal.length + 1) };
}

function lineCount(text) {
  if (text.length === 0) return 0;
  const n = text.split('\n').length;
  return text.endsWith('\n') ? n - 1 : n;
}

/**
 * Validates `<auditDir>/findings.json` against the contract and the disk.
 * @returns {{ok: boolean, errors: string[], data: object|null}}
 */
export function validate(auditDir) {
  const errors = [];
  const err = (path, msg) => errors.push(`${path}: ${msg}`);
  const done = (data = null) => ({ ok: errors.length === 0, errors, data });

  // ---- the file itself: hardening before anything is parsed ----
  let auditReal;
  try {
    if (!lstatSync(auditDir).isDirectory()) throw new Error();
    auditReal = realpathSync(auditDir);
  } catch {
    err('audit-dir', 'must be an existing directory (not a symlink)');
    return done();
  }
  const file = join(auditReal, 'findings.json');
  let st;
  try { st = lstatSync(file); } catch { err('findings.json', 'does not exist in the audit dir'); return done(); }
  if (!st.isFile()) { err('findings.json', 'must be a regular file (not a directory or symlink)'); return done(); }
  if (st.size > MAX_BYTES) { err('findings.json', `is ${st.size} bytes; larger than 5 MB is refused`); return done(); }
  const text = readFileSync(file, 'utf8');
  if (rawDepth(text) > MAX_DEPTH) { err('findings.json', `nesting deeper than ${MAX_DEPTH} levels is refused`); return done(); }
  let doc;
  // The parser's own message can quote file content (a secret, even), so it is not repeated.
  try { doc = JSON.parse(text); } catch { err('findings.json', 'is not valid JSON'); return done(); }
  if (!isObj(doc)) { err('findings.json', 'top level must be an object'); return done(); }

  // ---- small shape helpers; each records `<path>: <why>` ----
  const reqStr = (o, k, p) => { if (!isStr(o[k])) err(`${p}.${k}`, 'is required (non-empty string)'); };
  const optStr = (o, k, p) => { if (k in o && typeof o[k] !== 'string') err(`${p}.${k}`, 'must be a string'); };
  const oneOf = (o, k, p, values) => {
    if (!(k in o)) err(`${p}.${k}`, `is required; must be one of ${values.join(', ')}`);
    else if (!values.includes(o[k])) err(`${p}.${k}`, `must be one of ${values.join(', ')}`);
  };
  const reqArr = (o, k, p) => {
    if (!Array.isArray(o[k])) { err(`${p}.${k}`, 'is required (array)'); return []; }
    return o[k];
  };
  const optArr = (o, k, p) => {
    if (!(k in o)) return [];
    if (!Array.isArray(o[k])) { err(`${p}.${k}`, 'must be an array'); return []; }
    return o[k];
  };
  const strList = (o, k, p) => optArr(o, k, p).forEach((s, i) => { if (!isStr(s)) err(`${p}.${k}[${i}]`, 'must be a non-empty string'); });

  // ---- run ----
  const run = isObj(doc.run) ? doc.run : (err('run', 'is required (object)'), {});
  reqStr(run, 'id', 'run');
  if (!isStr(run.started_at) || !/^\d{4}-\d{2}-\d{2}T/.test(run.started_at) || Number.isNaN(Date.parse(run.started_at))) {
    err('run.started_at', 'is required (ISO 8601 date-time)');
  }
  let projectReal = null;
  if (!isStr(run.project_root) || !isAbsolute(run.project_root)) err('run.project_root', 'is required (absolute path)');
  else {
    try {
      if (!statSync(run.project_root).isDirectory()) throw new Error();
      projectReal = realpathSync(run.project_root);
    } catch { err('run.project_root', 'is not an existing directory'); }
  }
  if (!isObj(run.scope)) err('run.scope', 'is required (object)');
  oneOf(run, 'profile', 'run', PROFILES);
  oneOf(run, 'status', 'run', RUN_STATUS);
  if (run.status === 'partial') reqStr(run, 'partial_reason', 'run');

  // Evidence files are checked once each, then scanned for secrets once each.
  const evidenceSeen = new Map(); // abs path -> json path of the first reference
  const checkEvidencePath = (rel, p) => {
    const r = resolveInside(auditReal, rel, 'the audit dir');
    if (r.error) { err(p, r.error); return; }
    const top = r.rel.split(sep);
    if (top.length < 2 || (top[0] !== 'evidence' && top[0] !== 'fixes')) {
      err(p, 'must be under evidence/ or fixes/ of the audit dir; the audit records cannot be their own evidence');
      return;
    }
    if (r.size === 0) { err(p, 'is empty; evidence must hold the observed output'); return; }
    if (!evidenceSeen.has(r.abs)) evidenceSeen.set(r.abs, p);
  };

  // ---- findings ----
  const findings = reqArr(doc, 'findings', 'findings');
  const ids = new Map(); // id -> index
  findings.forEach((f, i) => {
    const p = `findings[${i}]`;
    if (!isObj(f)) { err(p, 'must be an object'); return; }
    if (!isStr(f.id) || !/^F-\d{3,}$/.test(f.id)) err(`${p}.id`, 'is required, in the form F-001');
    else if (ids.has(f.id)) err(`${p}.id`, `duplicate id ${show(f.id)} (also findings[${ids.get(f.id)}])`);
    else ids.set(f.id, i);
    reqStr(f, 'title', p);
    oneOf(f, 'verdict', p, VERDICTS);
    oneOf(f, 'surface', p, SURFACES);
    reqStr(f, 'class', p);
    const open = f.verdict === 'confirmed' || f.verdict === 'needs_validation';
    // Who, across what, to what end: the three facts that make a finding a finding. A rejected
    // finding may leave them out — its rejection_reason is the point.
    for (const k of ['principal', 'boundary', 'impact']) open ? reqStr(f, k, p) : optStr(f, k, p);

    if (f.verdict === 'confirmed') {
      if (!('severity' in f)) err(`${p}.severity`, 'is required when verdict is confirmed');
      else if (!SEVERITIES.includes(f.severity)) err(`${p}.severity`, `must be one of ${SEVERITIES.join(', ')}`);
    } else if ('severity' in f) {
      err(`${p}.severity`, 'is only allowed when verdict is confirmed; an unproven finding has no severity');
    }
    if (f.surface === 'platform') reqStr(f, 'platform', p);
    if (f.verdict === 'needs_validation') reqStr(f, 'missing_evidence', p);
    if (f.verdict === 'rejected') reqStr(f, 'rejection_reason', p);

    // Locations: relative to project_root, real files, real lines.
    const locations = optArr(f, 'locations', p);
    if (f.surface === 'code' && open && locations.length === 0) {
      err(`${p}.locations`, `a ${f.verdict} code finding needs at least one location`);
    }
    locations.forEach((loc, j) => {
      const lp = `${p}.locations[${j}]`;
      if (!isObj(loc)) { err(lp, 'must be an object'); return; }
      // A platform finding lives in a setting, not in the repo: it names the resource it was read from.
      if (f.surface === 'platform') { reqStr(loc, 'resource', lp); return; }
      const okStart = Number.isInteger(loc.line_start) && loc.line_start >= 1;
      const okEnd = Number.isInteger(loc.line_end) && loc.line_end >= 1;
      if (!okStart) err(`${lp}.line_start`, 'is required (integer >= 1)');
      if (!okEnd) err(`${lp}.line_end`, 'is required (integer >= 1)');
      if (okStart && okEnd && loc.line_start > loc.line_end) err(`${lp}.line_start`, 'is after line_end');
      if (!projectReal) return; // already reported on run.project_root
      const r = resolveInside(projectReal, loc.path, 'project_root');
      if (r.error) { err(`${lp}.path`, r.error); return; }
      if (r.size > MAX_BYTES) { err(`${lp}.path`, `is ${r.size} bytes; a cited file larger than 5 MB is refused`); return; }
      const lines = lineCount(readFileSync(r.abs, 'utf8'));
      if (okEnd && loc.line_end > lines) err(`${lp}.line_end`, `${loc.line_end} is beyond the end of the file (${lines} lines)`);
      else if (okStart && loc.line_start > lines) err(`${lp}.line_start`, `${loc.line_start} is beyond the end of the file (${lines} lines)`);
    });

    // Evidence: files inside the audit dir. Confirmed means something was observed, not just read.
    const evidence = optArr(f, 'evidence', p);
    evidence.forEach((ev, j) => {
      const ep = `${p}.evidence[${j}]`;
      if (!isObj(ev)) { err(ep, 'must be an object'); return; }
      oneOf(ev, 'kind', ep, EVIDENCE_KINDS);
      reqStr(ev, 'summary', ep);
      checkEvidencePath(ev.path, `${ep}.path`);
    });
    if (f.verdict === 'confirmed' && !evidence.some((ev) => isObj(ev) && (ev.kind === 'artifact' || ev.kind === 'command_output'))) {
      err(`${p}.evidence`, 'a confirmed finding needs at least one evidence item of kind artifact or command_output');
    }

    // Fix and its recheck.
    if ('fix' in f) {
      const fp = `${p}.fix`;
      if (!isObj(f.fix)) err(fp, 'must be an object');
      else {
        reqStr(f.fix, 'proposal', fp);
        oneOf(f.fix, 'status', fp, FIX_STATUS);
        if (f.fix.status === 'applied' || f.fix.status === 'rolled_back') {
          if (!isStr(f.fix.rollback)) err(`${fp}.rollback`, `is required when fix status is ${f.fix.status}`);
        } else optStr(f.fix, 'rollback', fp);
        if ('recheck' in f.fix) {
          const rp = `${fp}.recheck`;
          const rc = f.fix.recheck;
          if (!isObj(rc)) err(rp, 'must be an object');
          else {
            reqStr(rc, 'command', rp);
            oneOf(rc, 'result', rp, RECHECK_RESULTS);
            if (rc.result === 'pass' || rc.result === 'fail') {
              if (!('artifact' in rc)) err(`${rp}.artifact`, `is required when the recheck result is ${rc.result}`);
              else checkEvidencePath(rc.artifact, `${rp}.artifact`);
            } else if ('artifact' in rc) checkEvidencePath(rc.artifact, `${rp}.artifact`);
          }
        }
      }
    }
    strList(f, 'manual_steps', p);
  });

  // ---- coverage ----
  const coverage = isObj(doc.coverage) ? doc.coverage : (err('coverage', 'is required (object)'), {});
  const units = reqArr(coverage, 'units', 'coverage');
  const unitIds = new Set();
  const referenced = new Set();
  units.forEach((u, i) => {
    const p = `coverage.units[${i}]`;
    if (!isObj(u)) { err(p, 'must be an object'); return; }
    if (!isStr(u.id)) err(`${p}.id`, 'is required (non-empty string)');
    else if (unitIds.has(u.id)) err(`${p}.id`, `duplicate id ${show(u.id)}`);
    else unitIds.add(u.id);
    oneOf(u, 'surface', p, SURFACES);
    for (const k of ['area', 'boundary', 'class']) reqStr(u, k, p);
    oneOf(u, 'status', p, UNIT_STATUS);
    if (u.status !== 'done') reqStr(u, 'reason', p);
    reqArr(u, 'findings', p).forEach((id, j) => {
      if (!ids.has(id)) err(`${p}.findings[${j}]`, `unknown finding ${show(id)}`);
      else referenced.add(id);
    });
  });
  findings.forEach((f, i) => {
    if (isObj(f) && (f.verdict === 'confirmed' || f.verdict === 'needs_validation') && ids.get(f.id) === i && !referenced.has(f.id)) {
      err(`findings[${i}]`, `${f.verdict} finding ${show(f.id)} is not referenced by any coverage unit`);
    }
  });

  // ---- platforms ----
  const platforms = reqArr(doc, 'platforms', 'platforms');
  platforms.forEach((pl, i) => {
    const p = `platforms[${i}]`;
    if (!isObj(pl)) { err(p, 'must be an object'); return; }
    reqStr(pl, 'name', p);
    reqStr(pl, 'detected_by', p);
    oneOf(pl, 'access', p, ACCESS);
    oneOf(pl, 'status', p, PLATFORM_STATUS);
    if (pl.status === 'not_reviewed') reqStr(pl, 'reason', p);
    if (pl.status === 'reviewed') {
      // A platform is only "reviewed" through a tool the user can rerun: it must exist in 01-TOOLS/.
      if (!isStr(pl.tool_path)) err(`${p}.tool_path`, 'is required when status is reviewed');
      else if (!TOOL_PATH.test(pl.tool_path)) err(`${p}.tool_path`, 'must be 01-TOOLS/security/<platform>/ (one lowercase platform slug, relative to project_root)');
      else if (projectReal) {
        const r = resolveInside(projectReal, pl.tool_path, 'project_root', { dir: true });
        if (r.error) err(`${p}.tool_path`, r.error);
        else {
          const entries = readdirSync(r.abs, { withFileTypes: true });
          const readme = entries.some((e) => e.name === 'README.md' && e.isFile());
          const other = entries.some((e) => e.name !== 'README.md' && e.isFile());
          if (!readme) err(`${p}.tool_path`, 'has no README.md; the tool must say what it checks and how to rerun it');
          else if (!other) err(`${p}.tool_path`, 'holds only a README.md; it needs the check itself (at least one other file)');
        }
      }
    }
  });

  // ---- complete means complete ----
  if (run.status === 'complete') {
    if (units.length === 0 && platforms.length === 0) err('run.status', 'complete is refused: nothing was reviewed (no coverage units and no platforms)');
    units.forEach((u, i) => {
      if (isObj(u) && u.status !== 'done') err('run.status', `complete is refused while coverage.units[${i}] is ${show(u.status)}; set status to partial with a partial_reason`);
    });
    platforms.forEach((pl, i) => {
      if (isObj(pl) && pl.status !== 'reviewed') err('run.status', `complete is refused while platforms[${i}] is ${show(pl.status)}; set status to partial with a partial_reason`);
    });
  }

  // ---- user actions ----
  optArr(doc, 'user_actions', 'user_actions').forEach((a, i) => {
    const p = `user_actions[${i}]`;
    if (!isObj(a)) { err(p, 'must be an object'); return; }
    reqStr(a, 'title', p);
    reqArr(a, 'steps', p);
    strList(a, 'steps', p);
  });

  // ---- secrets: every key and string in findings.json, then every other file in the audit dir ----
  // A key is shown in a path only when it is a short plain identifier with no secret shape; anything
  // else is `[key#N]` (its position), so an error path can never carry the secret it reports.
  const walk = (v, p) => {
    if (typeof v === 'string') {
      const kinds = secretKinds(v);
      if (kinds.length) err(p || '(root)', `contains a likely live secret (${kinds.join(', ')}); redact it (e.g. sk_live_****) — value not shown`);
    } else if (Array.isArray(v)) v.forEach((x, i) => walk(x, `${p}[${i}]`));
    else if (isObj(v)) {
      Object.entries(v).forEach(([k, x], n) => {
        const keyKinds = secretKinds(k);
        const plain = keyKinds.length === 0 && /^[A-Za-z_][A-Za-z0-9_]{0,63}$/.test(k);
        const kp = plain ? (p ? `${p}.${k}` : k) : `${p}[key#${n}]`;
        if (keyKinds.length) err(kp, `key contains a likely live secret (${keyKinds.join(', ')}); redact it — value not shown`);
        walk(x, kp);
      });
    }
  };
  walk(doc, '');

  // Every regular file in the audit dir except findings.json (walked above), report.html (rendered
  // from validated data) and scratch/ (hunters' raw working files, deleted at the end of the run).
  // A symlink could point anywhere, so it is refused rather than followed or skipped.
  const files = [];
  const scanDir = (dirAbs, relDir, depth) => {
    if (depth > MAX_DEPTH) { err('audit-dir', `${show(relDir)} is nested deeper than ${MAX_DEPTH} levels`); return; }
    let entries;
    try { entries = readdirSync(dirAbs, { withFileTypes: true }); } catch { err('audit-dir', `${show(relDir)} cannot be read`); return; }
    entries.sort((x, y) => (x.name < y.name ? -1 : x.name > y.name ? 1 : 0));
    for (const e of entries) {
      const rel = relDir ? `${relDir}/${e.name}` : e.name;
      if (!relDir && (e.name === 'findings.json' || e.name === 'report.html' || e.name === 'scratch')) continue;
      // A name can carry a secret too (`evidence/ghp_….txt`); report it without echoing the name.
      const nameKinds = secretKinds(e.name);
      if (nameKinds.length) err('audit-dir', `a file or directory name under ${show(relDir || '.')} contains a likely live secret (${nameKinds.join(', ')})`);
      if (e.isSymbolicLink()) err('audit-dir', `${show(rel)} is a symlink; symlinks inside the audit dir are refused`);
      else if (e.isDirectory()) scanDir(join(dirAbs, e.name), rel, depth + 1);
      else if (e.isFile()) {
        if (files.length >= MAX_SCAN_FILES) { err('audit-dir', `more than ${MAX_SCAN_FILES} files; not all were scanned`); return; }
        files.push([join(dirAbs, e.name), rel]);
      } else err('audit-dir', `${show(rel)} is not a regular file or directory`);
    }
  };
  scanDir(auditReal, '', 0);
  for (const [abs, rel] of files) {
    const p = evidenceSeen.get(abs) ?? 'audit-dir';
    const size = statSync(abs).size;
    if (size > MAX_SCAN_BYTES) { err(p, `${show(rel)} is ${size} bytes: too large to scan; redact or trim it below 2 MB`); continue; }
    const lines = readFileSync(abs, 'utf8').split('\n');
    let reported = 0;
    for (let n = 0; n < lines.length; n++) {
      const kinds = secretKinds(lines[n]);
      if (!kinds.length) continue;
      if (++reported > 20) { err(p, `${show(rel)}: more lines with likely secrets not listed`); break; }
      err(p, `${show(rel)} line ${n + 1} contains a likely live secret (${kinds.join(', ')}); redact the file — value not shown`);
    }
  }

  return done(doc);
}

// ---- CLI ----
function main(argv) {
  const dir = argv[0];
  if (!dir || dir === '-h' || dir === '--help') {
    console.error('usage: validate-findings.mjs <audit-dir>');
    return 2;
  }
  const r = validate(resolve(dir));
  if (!r.ok) {
    console.error(`FAIL ${r.errors.length} error(s) in ${resolve(dir)}/findings.json`);
    for (const e of r.errors) console.error(`  ${e}`);
    return 1;
  }
  const f = r.data.findings;
  const count = (v) => f.filter((x) => x.verdict === v).length;
  console.log(`OK ${f.length} finding(s): ${count('confirmed')} confirmed, ${count('needs_validation')} needs_validation, ${count('rejected')} rejected; ${r.data.coverage.units.length} coverage unit(s); ${r.data.platforms.length} platform(s); run ${r.data.run.status}`);
  return 0;
}

const self = realpathSync(fileURLToPath(import.meta.url));
let invoked = '';
try { invoked = realpathSync(process.argv[1] || ''); } catch { /* imported, not run */ }
if (invoked === self) process.exitCode = main(process.argv.slice(2));
