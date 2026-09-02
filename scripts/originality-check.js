import {
  existsSync, readdirSync, readFileSync, statSync, writeFileSync,
} from 'node:fs';
import { createHash } from 'node:crypto';
import { dirname, join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { stackAgents } from '../targets/agent-catalog.js';
import { allAgentNames } from '../targets/agents.js';
import { resolveCommands } from '../targets/commands.js';

const ROOT = join(dirname(fileURLToPath(import.meta.url)), '..');
const META_PATH = join(ROOT, 'schema', 'ecc-originality.json');
const DATA_PATH = join(ROOT, 'schema', 'ecc-originality.u64');
const NGRAM_SIZE = 8;
const EXEMPTION_CATEGORIES = new Set(['name', 'error', 'tool-command', 'language-term']);

export function normalizeTokens(text) {
  return String(text || '').normalize('NFKC').toLowerCase().match(/[\p{L}\p{N}_+.#/-]+/gu) || [];
}

function fingerprint(tokens, offset, size = NGRAM_SIZE) {
  return createHash('sha256').update(tokens.slice(offset, offset + size).join(' ')).digest('hex').slice(0, 16);
}

function fingerprintsOf(text, size = NGRAM_SIZE) {
  const tokens = normalizeTokens(text);
  const out = [];
  for (let offset = 0; offset <= tokens.length - size; offset += 1) {
    out.push({ fingerprint: fingerprint(tokens, offset, size), offset });
  }
  return out;
}

function walk(directory) {
  if (!existsSync(directory)) throw new Error(`originality: corpus directory missing: ${directory}`);
  return readdirSync(directory).sort().flatMap((name) => {
    const path = join(directory, name);
    return statSync(path).isDirectory() ? walk(path) : [path];
  });
}

function catalogDocuments() {
  const skillIds = readdirSync(join(ROOT, 'skills')).filter((id) => {
    try { return statSync(join(ROOT, 'skills', id, 'SKILL.md')).isFile(); } catch { return false; }
  });
  const commands = resolveCommands({
    target: 'cursor', skills: skillIds, agents: allAgentNames(), memoryMode: 'full',
  });
  return [
    ...stackAgents().map((agent) => ({ id: `agent:${agent.name}`, text: `${agent.desc}\n${agent.body}` })),
    ...commands.map((command) => ({ id: `command:${command.name}`, text: `${command.description}\n${command.body}` })),
  ];
}

export function fingerprintCorpus(metaPath = META_PATH, dataPath = DATA_PATH) {
  const metadata = JSON.parse(readFileSync(metaPath, 'utf8'));
  if (metadata.ngramSize !== NGRAM_SIZE) throw new Error(`originality: unsupported n-gram size ${metadata.ngramSize}`);
  for (const exemption of metadata.exemptions || []) {
    if (!EXEMPTION_CATEGORIES.has(exemption.category) || !/^[0-9a-f]{16}$/.test(exemption.fingerprint || '')) {
      throw new Error('originality: every exemption needs a valid fingerprint and closed category');
    }
  }
  const bytes = readFileSync(dataPath);
  if (bytes.length % 8 !== 0 || bytes.length / 8 !== metadata.fingerprintCount) {
    throw new Error('originality: fingerprint corpus length does not match its receipt');
  }
  const digest = createHash('sha256').update(bytes).digest('hex');
  if (digest !== metadata.dataSha256) throw new Error('originality: fingerprint corpus failed its integrity receipt');
  const fingerprints = new Set();
  for (let offset = 0; offset < bytes.length; offset += 8) fingerprints.add(bytes.subarray(offset, offset + 8).toString('hex'));
  return { metadata, fingerprints };
}

export function checkCatalogOriginality({ corpus = fingerprintCorpus(), documents = catalogDocuments() } = {}) {
  const exempt = new Set((corpus.metadata.exemptions || []).map((entry) => entry.fingerprint));
  const matches = [];
  for (const document of documents) {
    for (const candidate of fingerprintsOf(document.text, corpus.metadata.ngramSize)) {
      if (corpus.fingerprints.has(candidate.fingerprint) && !exempt.has(candidate.fingerprint)) {
        matches.push({ document: document.id, tokenOffset: candidate.offset, fingerprint: candidate.fingerprint });
      }
    }
  }
  return {
    ngramSize: corpus.metadata.ngramSize,
    corpusRevision: corpus.metadata.revision,
    documents: documents.length,
    exemptions: exempt.size,
    matches,
  };
}

function refresh(corpusRoot) {
  const files = ['agents', 'commands'].flatMap((directory) => walk(join(corpusRoot, directory)));
  const hashes = new Set();
  for (const path of files) {
    for (const candidate of fingerprintsOf(readFileSync(path, 'utf8'))) hashes.add(candidate.fingerprint);
  }
  const sorted = [...hashes].sort();
  const bytes = Buffer.alloc(sorted.length * 8);
  sorted.forEach((hash, index) => Buffer.from(hash, 'hex').copy(bytes, index * 8));
  writeFileSync(DATA_PATH, bytes);
  const revision = execFileSync('git', ['rev-parse', 'HEAD'], { cwd: corpusRoot, encoding: 'utf8' }).trim();
  const metadata = {
    schemaVersion: 1,
    source: 'https://github.com/affaan-m/everything-claude-code',
    revision,
    generatedAt: new Date().toISOString().slice(0, 10),
    included: ['agents/**', 'commands/**'],
    ngramSize: NGRAM_SIZE,
    normalization: 'NFKC lowercase; Unicode letters/numbers plus _+.#/-; whitespace joined',
    fingerprintFormat: 'first 64 bits of SHA-256, sorted big-endian; collisions fail closed',
    fingerprintCount: sorted.length,
    dataSha256: createHash('sha256').update(bytes).digest('hex'),
    exemptions: [],
  };
  writeFileSync(META_PATH, `${JSON.stringify(metadata, null, 2)}\n`);
  return metadata;
}

function main() {
  if (process.argv[2] === '--refresh') {
    if (!process.argv[3]) throw new Error('Usage: node scripts/originality-check.js --refresh <ecc-checkout>');
    const metadata = refresh(process.argv[3]);
    console.log(`originality corpus refreshed (${metadata.fingerprintCount} fingerprints at ${metadata.revision})`);
    return;
  }
  const result = checkCatalogOriginality();
  if (result.matches.length) {
    for (const match of result.matches) console.error(`${match.document}: shared ${result.ngramSize}-token fingerprint ${match.fingerprint} at token ${match.tokenOffset}`);
    process.exit(1);
  }
  console.log(`originality OK (${result.documents} documents vs ${fingerprintCorpus().metadata.fingerprintCount} corpus fingerprints; ${result.exemptions} exemptions)`);
}

if (import.meta.url === `file://${process.argv[1]}`) main();
