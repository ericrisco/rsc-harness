// `rsc ingest <file>`: a document the person hands to the harness ends up in 02-DOCS/raw/ and leaves
// the place it was dropped.
//
// The harness skill already said loose root files MOVE into raw/. The text injected at every session
// start said "originals are copied, never moved", and an agent obeys what it reads every session: the
// root kept every file it had already documented. A move that deletes is the kind of step an agent
// should not improvise, so it lives here, with one rule that makes it safe: the original is removed
// only after the copy in raw/ is proven byte-identical by its hash. The agent then compiles the wiki
// from that copy, so nothing it learned depends on the file that was removed.
import { createHash } from 'node:crypto';
import { copyFileSync, existsSync, lstatSync, mkdirSync, readFileSync, renameSync, unlinkSync, writeFileSync } from 'node:fs';
import { basename, extname, isAbsolute, join, relative, resolve, sep } from 'node:path';

// Never moved: the project's own files, secrets, code, and the harness. Moving any of these would
// break the project, leak a secret into the docs, or eat the documentation itself.
const PROTECTED_DIRS = new Set(['02-DOCS', '01-TOOLS', '.git', '.rsc', '.claude', '.worktrees', 'node_modules', '.github', '.codex', '.cursor', '.gemini', '.opencode']);
const PROTECTED_NAMES = /^(?:package(?:-lock)?\.json|yarn\.lock|pnpm-lock\.yaml|bun\.lockb?|readme(?:\.\w+)?|license(?:\.\w+)?|licence(?:\.\w+)?|changelog(?:\.\w+)?|claude\.md|agents\.md|gemini\.md|\.rsc\.json|\.rscignore|\.gitignore|\.gitattributes|\.npmrc|\.nvmrc|makefile|dockerfile|docker-compose\.ya?ml|compose\.ya?ml|tsconfig(?:\.\w+)?\.json|jsconfig\.json|pyproject\.toml|requirements(?:[-.\w]*)?\.txt|setup\.(?:py|cfg)|go\.(?:mod|sum)|cargo\.(?:toml|lock)|composer\.(?:json|lock)|gemfile(?:\.lock)?|pubspec\.(?:yaml|lock)|.*\.config\.\w+)$/i;
const SECRET = /^\.env(?:\..*)?$|\.(?:pem|key|p12|pfx|keystore|jks)$|^id_(?:rsa|ed25519|ecdsa)/i;
const CODE = new Set(['.js', '.mjs', '.cjs', '.ts', '.tsx', '.jsx', '.py', '.go', '.rs', '.java', '.kt', '.kts', '.swift', '.rb', '.php', '.cs', '.c', '.cc', '.cpp', '.h', '.hpp', '.m', '.dart', '.vue', '.svelte', '.sh', '.bash', '.zsh', '.ps1', '.bat', '.lua', '.scala', '.ex', '.exs', '.erl']);

const sha256 = (path) => `sha256:${createHash('sha256').update(readFileSync(path)).digest('hex')}`;
const posix = (p) => p.split(sep).join('/');
const today = (now) => now.toISOString().slice(0, 10);

function refusal(root, rel) {
  const parts = rel.split('/');
  if (PROTECTED_DIRS.has(parts[0])) return `${parts[0]}/ belongs to the harness or the project; it is never moved`;
  const name = basename(rel);
  if (SECRET.test(name)) return 'it looks like a secret; secrets never go into the documentation';
  if (PROTECTED_NAMES.test(name)) return 'it is a project file the code or the assistant relies on';
  if (CODE.has(extname(name).toLowerCase())) return 'it is source code; document it without moving it (use --keep)';
  return null;
}

/** A free name in raw/ for this content: the same name, or the same content already there, or a dated variant. */
function rawTarget(rawDir, name, hash, now) {
  const first = join(rawDir, name);
  if (!existsSync(first) || sha256(first) === hash) return first;
  const ext = extname(name), stem = basename(name, ext);
  const stamp = now.toISOString().replace(/[-:]/g, '').slice(0, 15);
  for (let i = 0; i < 1000; i++) {
    const candidate = join(rawDir, `${stem}-${stamp}${i ? `-${i}` : ''}${ext}`);
    if (!existsSync(candidate) || sha256(candidate) === hash) return candidate;
  }
  return null;
}

function recordInLedger(root, key, entry) {
  const path = join(root, '02-DOCS', 'wiki', '.ingested.json');
  let ledger = {};
  try { ledger = JSON.parse(readFileSync(path, 'utf8')); } catch { /* new or unreadable: start fresh */ }
  if (!ledger || typeof ledger !== 'object' || Array.isArray(ledger)) ledger = {};
  ledger[key] = { ...(ledger[key] || {}), ...entry };
  const tmp = `${path}.${process.pid}.tmp`;
  writeFileSync(tmp, JSON.stringify(ledger, null, 2) + '\n');
  renameSync(tmp, path);
}

/**
 * Move (or with keep, copy) one file into 02-DOCS/raw/.
 * Returns { file, status: 'moved'|'copied'|'refused'|'missing', raw?, hash?, reason? }.
 */
export function ingestFile(root, input, { keep = false, topic = '', now = new Date() } = {}) {
  const projectRoot = resolve(root);
  const abs = resolve(projectRoot, input);
  const rel = posix(relative(projectRoot, abs));
  const out = { file: isAbsolute(input) ? input : posix(input) };
  if (!rel || rel.startsWith('..') || isAbsolute(rel)) return { ...out, status: 'refused', reason: 'it is outside this project' };
  if (!existsSync(join(projectRoot, '02-DOCS'))) return { ...out, status: 'refused', reason: 'this project has no 02-DOCS/ yet; set up the harness first' };
  let st;
  try { st = lstatSync(abs); } catch { return { ...out, status: 'missing', reason: 'no such file' }; }
  if (st.isSymbolicLink()) return { ...out, status: 'refused', reason: 'it is a link; ingest the file it points to' };
  if (st.isDirectory()) return { ...out, status: 'refused', reason: 'it is a folder; name the files inside it' };
  if (!st.isFile()) return { ...out, status: 'refused', reason: 'it is not a regular file' };
  const why = refusal(projectRoot, rel);
  if (why) return { ...out, status: 'refused', reason: why };

  const hash = sha256(abs);
  // raw/<topic>/ is where the wiki convention files a source; choosing it here means the copy is never
  // moved afterwards, which would leave the ledger pointing at a path that no longer exists.
  const slug = String(topic || '').trim().toLowerCase().normalize('NFD').replace(/\p{M}/gu, '').replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
  if (topic && !slug) return { ...out, status: 'refused', reason: `'${topic}' is not a usable topic name` };
  const rawDir = slug ? join(projectRoot, '02-DOCS', 'raw', slug) : join(projectRoot, '02-DOCS', 'raw');
  mkdirSync(rawDir, { recursive: true });
  const target = rawTarget(rawDir, basename(rel), hash, now);
  if (!target) return { ...out, status: 'refused', reason: 'no free name in 02-DOCS/raw/' };
  if (!existsSync(target)) copyFileSync(abs, target);
  // The only rule that makes the delete safe: the copy is proven identical before the original goes.
  if (sha256(target) !== hash) return { ...out, status: 'refused', reason: 'the copy in raw/ did not verify; the original was left in place' };
  const rawRel = posix(relative(projectRoot, target));
  recordInLedger(projectRoot, rel, { hash, ingested: today(now), raw: rawRel });
  if (keep) return { ...out, status: 'copied', raw: rawRel, hash };
  unlinkSync(abs);
  return { ...out, status: 'moved', raw: rawRel, hash };
}
