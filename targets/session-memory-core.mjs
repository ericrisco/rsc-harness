import {
  appendFileSync, existsSync, mkdirSync, readFileSync, readdirSync, renameSync, rmSync, writeFileSync,
} from 'node:fs';
import { createHash, randomUUID } from 'node:crypto';
import { dirname, isAbsolute, join, relative, resolve, sep } from 'node:path';
import { execFileSync } from 'node:child_process';

export const SESSION_RECORD_FIELDS = Object.freeze([
  'schemaVersion', 'sessionId', 'target', 'event', 'branch', 'worktree', 'baselineHead', 'head',
  'files', 'commits', 'ledger', 'timestamps', 'toolCalls', 'cost', 'editCount', 'concurrent',
]);

export const DEFAULT_MEMORY_SETTINGS = Object.freeze({
  enabled: true,
  metrics: true,
  compactionHint: true,
  editThreshold: 20,
  retentionDays: 30,
  contextBytes: 4096,
  lessonThreshold: 0.7,
  lessonLimit: 5,
});

const SECRET_SHAPES = [
  /\bsk-[A-Za-z0-9_-]{12,}\b/u,
  /\b(?:AKIA|ASIA)[A-Z0-9]{16}\b/u,
  /\bgh[opusr]_[A-Za-z0-9]{20,}\b/u,
  /-----BEGIN (?:RSA |EC |OPENSSH )?PRIVATE KEY-----/u,
  /\b(?:password|passwd|api[_-]?key|access[_-]?token)\s*[:=]\s*\S+/iu,
];

function secretShaped(value) {
  return typeof value === 'string' && SECRET_SHAPES.some((pattern) => pattern.test(value));
}

function cleanString(value, max = 1024) {
  if (typeof value !== 'string' || secretShaped(value)) return null;
  const clean = value.replace(/[\u0000-\u001f\u007f]/gu, '').trim();
  return clean ? clean.slice(0, max) : null;
}

function cleanId(value, prefix = 'session') {
  const clean = cleanString(value, 120);
  if (clean && /^[A-Za-z0-9._-]+$/u.test(clean)) return clean;
  const hash = createHash('sha256').update(String(value ?? randomUUID())).digest('hex').slice(0, 20);
  return `${prefix}-${hash}`;
}

function git(cwd, args) {
  try {
    return { ok: true, out: execFileSync('git', args, { cwd, encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'], maxBuffer: 2 * 1024 * 1024 }).trim() };
  } catch {
    return { ok: false, out: '' };
  }
}

function relativeSlash(cwd, path) {
  return relative(cwd, path).split(sep).join('/');
}

function ensureExcluded(cwd, root) {
  const rel = relativeSlash(cwd, root);
  if (!rel || rel.startsWith('../')) return false;
  const tracked = git(cwd, ['ls-files', '--', rel]).out;
  if (tracked) return false;
  const gitPath = git(cwd, ['rev-parse', '--git-path', 'info/exclude']);
  if (!gitPath.ok || !gitPath.out) return false;
  const exclude = isAbsolute(gitPath.out) ? gitPath.out : resolve(cwd, gitPath.out);
  mkdirSync(dirname(exclude), { recursive: true });
  const pattern = `/${rel.replace(/\/$/u, '')}/`;
  const current = existsSync(exclude) ? readFileSync(exclude, 'utf8') : '';
  if (!current.split('\n').includes(pattern)) {
    const prefix = current && !current.endsWith('\n') ? '\n' : '';
    appendFileSync(exclude, `${prefix}${pattern}\n`);
  }
  return git(cwd, ['check-ignore', '-q', '--no-index', `${rel}/.rsc-probe`]).ok;
}

export function chooseMemoryRoot(cwd = process.cwd()) {
  const project = resolve(cwd);
  const inGit = git(project, ['rev-parse', '--is-inside-work-tree']).out === 'true';
  if (!inGit) {
    return { root: join(project, '.rsc', 'memory'), kind: 'local-state', reason: 'without-git', git: false };
  }

  const worklog = join(project, '02-DOCS', 'raw', 'worklog');
  if (existsSync(worklog)) {
    const tracked = git(project, ['ls-files', '--', '02-DOCS/raw/worklog']).out;
    if (!tracked) {
      const candidate = join(worklog, '.rsc-memory');
      if (ensureExcluded(project, candidate)) {
        return { root: candidate, kind: 'wiki-worklog', reason: 'untracked-worklog', git: true };
      }
    }
  }

  const local = join(project, '.rsc', 'memory');
  if (ensureExcluded(project, local)) {
    const trackedWorklog = existsSync(worklog) && Boolean(git(project, ['ls-files', '--', '02-DOCS/raw/worklog']).out);
    return { root: local, kind: 'local-state', reason: trackedWorklog ? 'tracked-worklog' : 'no-wiki', git: true };
  }

  const gitRoot = git(project, ['rev-parse', '--git-path', 'rsc-memory']).out;
  return {
    root: isAbsolute(gitRoot) ? gitRoot : resolve(project, gitRoot || '.git/rsc-memory'),
    kind: 'git-private-state', reason: 'local-state-tracked', git: true,
  };
}

function ensureStore(root) {
  for (const dir of ['sessions', 'anchors', 'lessons']) mkdirSync(join(root, dir), { recursive: true });
}

function atomicJson(path, value) {
  mkdirSync(dirname(path), { recursive: true });
  const temporary = `${path}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporary, `${JSON.stringify(value, null, 2)}\n`, { mode: 0o600 });
  renameSync(temporary, path);
}

function readJson(path) {
  try { return JSON.parse(readFileSync(path, 'utf8')); } catch { return null; }
}

function iso(value) {
  const parsed = new Date(value ?? Date.now());
  return Number.isNaN(parsed.getTime()) ? new Date().toISOString() : parsed.toISOString();
}

function settings(input = {}) {
  const merged = { ...DEFAULT_MEMORY_SETTINGS };
  for (const key of Object.keys(DEFAULT_MEMORY_SETTINGS)) {
    if (Object.hasOwn(input, key)) merged[key] = input[key];
  }
  merged.retentionDays = Math.max(1, Number(merged.retentionDays) || DEFAULT_MEMORY_SETTINGS.retentionDays);
  merged.contextBytes = Math.max(64, Number(merged.contextBytes) || DEFAULT_MEMORY_SETTINGS.contextBytes);
  merged.lessonLimit = Math.max(0, Math.floor(Number(merged.lessonLimit) || 0));
  merged.lessonThreshold = Math.min(1, Math.max(0, Number(merged.lessonThreshold) || 0));
  merged.editThreshold = Math.max(1, Math.floor(Number(merged.editThreshold) || DEFAULT_MEMORY_SETTINGS.editThreshold));
  return merged;
}

function parseStatus(output) {
  const entries = output.split('\0').filter(Boolean);
  const files = [];
  for (let index = 0; index < entries.length; index += 1) {
    const entry = entries[index];
    // `git()` trims command output, so a leading space in porcelain's XY column may be
    // absent only for the first entry. Locate the separator instead of dropping a fixed
    // three bytes; filenames must remain byte-for-byte identifiers, never content.
    const separator = entry.indexOf(' ');
    const status = separator === 1 ? entry.slice(0, 1) : entry.slice(0, 2);
    let path = entry.slice(separator + 1).replace(/^ +/u, '');
    if (/[RC]/u.test(status) && entries[index + 1]) path = entries[++index];
    const clean = cleanString(path, 1000);
    if (clean) files.push(clean);
  }
  return files;
}

function snapshot(cwd, baselineHead = null) {
  const top = git(cwd, ['rev-parse', '--show-toplevel']);
  if (!top.ok) return { git: false, branch: null, worktree: resolve(cwd), head: null, files: [], commits: [] };
  const worktree = resolve(top.out);
  const branch = cleanString(git(cwd, ['symbolic-ref', '--quiet', '--short', 'HEAD']).out, 255);
  const head = cleanString(git(cwd, ['rev-parse', '--verify', 'HEAD']).out, 64);
  const dirty = parseStatus(git(cwd, ['status', '--porcelain=v1', '-z', '--untracked-files=all']).out);
  let committed = [];
  let commits = [];
  if (baselineHead && head && git(cwd, ['cat-file', '-e', `${baselineHead}^{commit}`]).ok) {
    committed = git(cwd, ['diff', '--name-only', '-z', `${baselineHead}..${head}`]).out.split('\0').map((item) => cleanString(item, 1000)).filter(Boolean);
    commits = git(cwd, ['log', '--format=%H', `${baselineHead}..${head}`]).out.split('\n').map((item) => cleanString(item, 64)).filter(Boolean);
  }
  return { git: true, branch, worktree, head, files: [...new Set([...dirty, ...committed])].sort(), commits };
}

function ledgerSnapshot(cwd) {
  const roots = [
    ['spec', join(cwd, '02-DOCS', 'wiki', 'sdd', 'specs')],
    ['plan', join(cwd, '02-DOCS', 'wiki', 'sdd', 'plans')],
    ['progress', join(cwd, '02-DOCS', 'wiki', 'sdd', 'progress')],
  ];
  const out = [];
  for (const [type, root] of roots) {
    if (!existsSync(root)) continue;
    for (const name of readdirSync(root).filter((item) => item.endsWith('.md')).sort()) {
      const path = join(root, name);
      let body = '';
      try { body = readFileSync(path, 'utf8'); } catch { continue; }
      const rel = cleanString(relativeSlash(cwd, path), 1000);
      if (!rel) continue;
      const status = cleanString(body.match(/^status:\s*([a-z-]+)/imu)?.[1]?.toLowerCase(), 40) || 'unknown';
      const openItems = (body.match(/^- \[ \]/gmu) || []).length;
      out.push({ path: rel, type, status, openItems });
    }
  }
  return out;
}

function sessionFiles(root) {
  const dir = join(root, 'sessions');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => name.endsWith('.json')).map((name) => join(dir, name));
}

function lessonFiles(root) {
  const dir = join(root, 'lessons');
  if (!existsSync(dir)) return [];
  return readdirSync(dir).filter((name) => name.endsWith('.json')).map((name) => join(dir, name));
}

function prune(root, now, config) {
  const cutoff = new Date(now).getTime() - config.retentionDays * 86400000;
  for (const path of [...sessionFiles(root), ...readdirSync(join(root, 'anchors')).filter((name) => name.endsWith('.json')).map((name) => join(root, 'anchors', name))]) {
    const value = readJson(path);
    const updated = value?.timestamps?.updatedAt || value?.startedAt;
    if (!updated || new Date(updated).getTime() < cutoff) rmSync(path, { force: true });
  }
}

function noticeText(info) {
  if (info.reason === 'tracked-worklog') return 'rsc memory: tracked worklog detected; using ignored local state instead.';
  if (info.reason === 'untracked-worklog') return 'rsc memory: using the ignored wiki worklog store.';
  if (info.reason === 'without-git') return 'rsc memory: running without git; branch and commit metadata are unavailable.';
  if (info.reason === 'local-state-tracked') return 'rsc memory: .rsc memory was tracked; using git-private local state.';
  return 'rsc memory: no wiki worklog found; using ignored local state.';
}

function consumeNotice(info) {
  const marker = join(info.root, `.notice-${info.reason}`);
  if (existsSync(marker)) return null;
  writeFileSync(marker, `${iso()}\n`, { mode: 0o600 });
  return noticeText(info);
}

function finiteOrNull(value, integer = false) {
  if (value === null || value === undefined || value === '') return null;
  const number = Number(value);
  if (!Number.isFinite(number) || number < 0 || (integer && !Number.isInteger(number))) return null;
  return number;
}

function activeConcurrent(records, sessionId, worktree, now) {
  const recent = new Date(now).getTime() - 2 * 60 * 60 * 1000;
  return records.some((record) => record?.sessionId !== sessionId && record?.worktree === worktree
    && !record?.timestamps?.completedAt && new Date(record?.timestamps?.updatedAt || 0).getTime() >= recent);
}

export function validateSessionRecord(record) {
  const errors = [];
  if (!record || typeof record !== 'object' || Array.isArray(record)) return ['record: object required'];
  for (const field of Object.keys(record)) if (!SESSION_RECORD_FIELDS.includes(field)) errors.push(`${field}: unknown field`);
  for (const field of SESSION_RECORD_FIELDS) if (!Object.hasOwn(record, field)) errors.push(`${field}: required`);
  if (record.schemaVersion !== 1) errors.push('schemaVersion: must be 1');
  if (!Array.isArray(record.files) || !Array.isArray(record.commits) || !Array.isArray(record.ledger)) errors.push('files/commits/ledger: arrays required');
  if (!record.timestamps || Object.keys(record.timestamps).some((key) => !['startedAt', 'updatedAt', 'completedAt'].includes(key))) errors.push('timestamps: closed schema required');
  for (const item of record.ledger || []) {
    if (!item || Object.keys(item).some((key) => !['path', 'type', 'status', 'openItems'].includes(key))) errors.push('ledger: closed schema required');
  }
  const walk = (value) => {
    if (secretShaped(value)) errors.push('secret-shaped string rejected');
    else if (Array.isArray(value)) value.forEach(walk);
    else if (value && typeof value === 'object') Object.values(value).forEach(walk);
  };
  walk(record);
  return errors;
}

function readRecords(root) {
  return sessionFiles(root).map(readJson).filter((record) => record && validateSessionRecord(record).length === 0);
}

export function capture(input = {}) {
  const cwd = resolve(input.cwd || process.cwd());
  const config = settings(input.settings);
  if (!config.enabled) return { record: null, path: null, notice: null, compactionHint: false };
  const store = chooseMemoryRoot(cwd);
  ensureStore(store.root);
  const now = iso(input.now);
  prune(store.root, now, config);
  const sessionId = cleanId(input.sessionId, 'session');
  const target = cleanId(input.target || 'unknown', 'target');
  // Providers own their session-id namespaces. Prefixing the storage key prevents
  // an identical id from two local assistants overwriting the other journal.
  const storageId = `${target}--${sessionId}`;
  const anchorPath = join(store.root, 'anchors', `${storageId}.json`);
  const recordPath = join(store.root, 'sessions', `${storageId}.json`);
  let anchor = readJson(anchorPath);
  let existing = readJson(recordPath);
  const firstSnapshot = snapshot(cwd, null);
  if (!anchor) {
    anchor = { sessionId, startedAt: now, baselineHead: cleanString(input.baselineHead, 64) || firstSnapshot.head };
    atomicJson(anchorPath, anchor);
  }
  if (input.event === 'start' && !existing) return { record: null, path: null, notice: null, compactionHint: false };

  const repo = snapshot(cwd, anchor.baselineHead);
  const editCount = Math.max(0, (existing?.editCount || 0) + (finiteOrNull(input.editDelta, true) || 0));
  const hasWork = Boolean(input.force === true || existing || editCount || repo.files.length || repo.commits.length);
  if (!hasWork) return { record: null, path: null, notice: null, compactionHint: false };

  const records = readRecords(store.root);
  const completed = ['end', 'sessionEnd', 'stop'].includes(input.event) ? now : (existing?.timestamps?.completedAt || null);
  const cost = config.metrics
    ? (Object.hasOwn(input, 'cost') ? finiteOrNull(input.cost) : (existing?.cost ?? null))
    : null;
  const toolCalls = config.metrics
    ? (Object.hasOwn(input, 'toolCalls') ? finiteOrNull(input.toolCalls, true) : (existing?.toolCalls ?? null))
    : null;
  const record = {
    schemaVersion: 1,
    sessionId,
    target: cleanString(input.target, 40) || existing?.target || 'unknown',
    event: cleanString(input.event, 40) || 'capture',
    branch: cleanString(repo.branch, 255),
    worktree: cleanString(repo.worktree, 1000),
    baselineHead: cleanString(anchor.baselineHead, 64),
    head: cleanString(repo.head, 64),
    files: repo.files.filter((item) => !secretShaped(item)),
    commits: repo.commits.filter((item) => !secretShaped(item)),
    ledger: ledgerSnapshot(cwd),
    timestamps: { startedAt: anchor.startedAt, updatedAt: now, completedAt: completed },
    toolCalls,
    cost,
    editCount,
    concurrent: activeConcurrent(records, sessionId, repo.worktree, now),
  };
  const errors = validateSessionRecord(record);
  if (errors.length) return { record: null, path: null, notice: null, compactionHint: false, errors };
  atomicJson(recordPath, record);
  existing = record;
  return {
    record,
    path: recordPath,
    notice: consumeNotice(store),
    compactionHint: Boolean(config.compactionHint && editCount >= config.editThreshold),
  };
}

function validAnchor(cwd, record) {
  if (!record?.head) return true;
  return git(cwd, ['cat-file', '-e', `${record.head}^{commit}`]).ok;
}

function selectedLessons(root, config) {
  return lessonFiles(root).map(readJson).filter((lesson) => lesson?.approvedAt && lesson.confidence >= config.lessonThreshold
    && !secretShaped(lesson.text) && !secretShaped(lesson.evidence))
    .sort((a, b) => b.confidence - a.confidence || b.approvedAt.localeCompare(a.approvedAt))
    .slice(0, config.lessonLimit);
}

function truncateUtf8(text, maxBytes) {
  if (Buffer.byteLength(text) <= maxBytes) return text;
  let output = '';
  for (const character of text) {
    if (Buffer.byteLength(output + character) > maxBytes) break;
    output += character;
  }
  return output;
}

function renderContext(record, match, lessons, config) {
  if (!record && !lessons.length) return '';
  const lines = record ? [
    `[rsc local ${match} continuation]`,
    `source: ${record.target}/${record.sessionId}`,
    `branch: ${record.branch || 'unavailable'}`,
    `worktree: ${record.worktree || 'unavailable'}`,
    `head: ${record.head || 'unavailable'}`,
    `files: ${record.files.join(', ') || 'none'}`,
    `commits: ${record.commits.join(', ') || 'none'}`,
  ] : ['[rsc local approved lessons]'];
  if (record?.ledger.length) lines.push(`ledger: ${record.ledger.map((item) => `${item.path}=${item.status}/${item.openItems}`).join(', ')}`);
  if (record) lines.push(`metrics: cost=${record.cost ?? 'unknown'} toolCalls=${record.toolCalls ?? 'unknown'}`);
  if (record?.concurrent) lines.push('parallel sessions detected; this record was not merged with them.');
  for (const lesson of lessons) lines.push(`approved lesson (${lesson.confidence}): ${lesson.text}`);
  return truncateUtf8(`${lines.join('\n')}\n`, config.contextBytes);
}

export function resume(input = {}) {
  const cwd = resolve(input.cwd || process.cwd());
  const config = settings(input.settings);
  if (!config.enabled) return { match: 'none', record: null, lessons: [], context: '' };
  const store = chooseMemoryRoot(cwd);
  ensureStore(store.root);
  const now = iso(input.now);
  prune(store.root, now, config);
  const current = snapshot(cwd, null);
  const records = readRecords(store.root).filter((record) => validAnchor(cwd, record))
    .sort((a, b) => b.timestamps.updatedAt.localeCompare(a.timestamps.updatedAt));
  let record = records.find((candidate) => candidate.branch === current.branch && candidate.worktree === current.worktree) || null;
  let match = record ? 'exact' : 'none';
  if (!record) {
    record = records.find((candidate) => candidate.worktree === current.worktree) || records[0] || null;
    if (record) match = 'nearby';
  }
  const lessons = selectedLessons(store.root, config);
  return { match, record, lessons, context: renderContext(record, match, lessons, config) };
}

export function learn(input = {}) {
  if (input.approved !== true) return { saved: false, reason: 'individual explicit approval required' };
  const text = cleanString(input.text, 1000);
  const evidence = cleanString(input.evidence, 1000);
  if (!text || !evidence || secretShaped(input.text) || secretShaped(input.evidence)) return { saved: false, reason: 'secret-shaped or invalid lesson' };
  if (!['project', 'global'].includes(input.scope)) return { saved: false, reason: 'scope must be project or global' };
  const confidence = finiteOrNull(input.confidence);
  if (confidence === null || confidence > 1) return { saved: false, reason: 'confidence must be between 0 and 1' };
  const cwd = resolve(input.cwd || process.cwd());
  const store = chooseMemoryRoot(cwd);
  ensureStore(store.root);
  const approvedAt = iso(input.now);
  const id = createHash('sha256').update(`${input.scope}\0${text}\0${evidence}`).digest('hex').slice(0, 20);
  const lesson = { schemaVersion: 1, id, text, evidence, scope: input.scope, confidence, approvedAt };
  const path = join(store.root, 'lessons', `${id}.json`);
  atomicJson(path, lesson);
  return { saved: true, lesson, path, notice: consumeNotice(store) };
}

export function metricsSummary(input = {}) {
  const cwd = resolve(input.cwd || process.cwd());
  const config = settings(input.settings);
  const store = chooseMemoryRoot(cwd);
  ensureStore(store.root);
  prune(store.root, iso(input.now), config);
  const sessions = readRecords(store.root).map(({ sessionId, target, cost, toolCalls, timestamps }) => ({ sessionId, target, cost, toolCalls, timestamps }));
  const unknown = {
    cost: sessions.filter((row) => row.cost === null).length,
    toolCalls: sessions.filter((row) => row.toolCalls === null).length,
  };
  const knownTotal = {
    cost: sessions.reduce((sum, row) => sum + (row.cost ?? 0), 0),
    toolCalls: sessions.reduce((sum, row) => sum + (row.toolCalls ?? 0), 0),
  };
  const total = {
    cost: !sessions.length || unknown.cost ? null : knownTotal.cost,
    toolCalls: !sessions.length || unknown.toolCalls ? null : knownTotal.toolCalls,
  };
  return { sessions, total, knownTotal, unknown };
}

export function memoryStatus(input = {}) {
  const cwd = resolve(input.cwd || process.cwd());
  const store = chooseMemoryRoot(cwd);
  ensureStore(store.root);
  return {
    enabled: settings(input.settings).enabled,
    root: store.root,
    kind: store.kind,
    reason: store.reason,
    sessions: readRecords(store.root).length,
    lessons: lessonFiles(store.root).map(readJson).filter(Boolean).length,
  };
}
