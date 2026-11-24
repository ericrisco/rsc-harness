#!/usr/bin/env node
// `npm run prompt:audit` — the deterministic prompt-cruft gate over the published catalog.
// Scope: skills/** (minus verbatim upstream/ copies and evals/) and the generators and hook texts in
// targets/. Rules and their rationale: scripts/lib/prompt-audit.js. Exit 1 on any finding.
import { readFileSync, readdirSync, statSync } from 'node:fs';
import { dirname, join, relative } from 'node:path';
import { fileURLToPath } from 'node:url';
import { auditText } from './lib/prompt-audit.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const TEXT = /\.(md|mjs|js|py|sh|ya?ml|toml|json)$/;
const SKIP_DIRS = new Set(['upstream', 'evals', 'node_modules']);

function walk(dir) {
  const out = [];
  for (const name of readdirSync(dir)) {
    const p = join(dir, name);
    if (statSync(p).isDirectory()) { if (!SKIP_DIRS.has(name)) out.push(...walk(p)); }
    else if (TEXT.test(name)) out.push(p);
  }
  return out;
}

export function auditCatalog(root = ROOT) {
  const skillsDir = join(root, 'skills');
  const skillIds = new Set(readdirSync(skillsDir).filter((n) => statSync(join(skillsDir, n)).isDirectory()));
  const files = [...walk(skillsDir), ...walk(join(root, 'targets'))];
  const findings = [];
  for (const f of files) {
    for (const x of auditText(readFileSync(f, 'utf8'), { skillIds })) findings.push({ file: relative(root, f), ...x });
  }
  return { files: files.length, findings };
}

if (process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1]) {
  const { files, findings } = auditCatalog(process.argv[2] || ROOT);
  for (const f of findings) console.log(`${f.file}:${f.line}  [${f.rule}]  ${f.match}\n    fix: ${f.fix}`);
  if (findings.length) {
    console.log(`\nprompt:audit FAIL — ${findings.length} finding(s) in ${files} files. Fix each, or keep it with a reason on that line or the one above: \`prompt-audit: allow <rule> — <reason>\`.`);
    process.exit(1);
  }
  console.log(`prompt:audit OK (${files} files, 0 findings)`);
}
