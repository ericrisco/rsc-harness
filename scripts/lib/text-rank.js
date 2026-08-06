const STOP = new Set([
  'a', 'an', 'and', 'any', 'are', 'as', 'at', 'be', 'before', 'by', 'for', 'from',
  'in', 'into', 'is', 'it', 'its', 'my', 'need', 'needs', 'of', 'on', 'or', 'our',
  'so', 'that', 'the', 'them', 'this', 'to', 'use', 'want', 'we', 'when', 'with',
  'you', 'your', 'help', 'me', 'i',
  'un', 'una', 'unos', 'unas', 'con', 'de', 'del', 'la', 'el', 'los', 'las',
  'para', 'que', 'porque', 'en', 'mi', 'mis', 'quiero', 'hacer', 'como',
  'amb', 'aquest', 'aquesta', 'els', 'les', 'per', 'vull', 'vols',
]);

function fold(text) {
  return text.normalize('NFD').replace(/\p{M}/gu, '');
}

function stem(token) {
  // Deliberately light: enough to join "simplify/simplified" and
  // "conflicts/conflict" without pretending to be a language model.
  for (const suffix of ['ally', 'ing', 'ed', 'es', 'al']) {
    if (token.length > suffix.length + 3 && token.endsWith(suffix)) {
      token = token.slice(0, -suffix.length);
      break;
    }
  }
  if (token.length > 3 && token.endsWith('s') && !token.endsWith('ss')) token = token.slice(0, -1);
  if (token.length > 4 && token.endsWith('e')) token = token.slice(0, -1);
  if (
    token.length > 4
    && token[token.length - 1] === token[token.length - 2]
    && !'aeiou'.includes(token[token.length - 1])
  ) token = token.slice(0, -1);
  if (token.length > 3 && token.endsWith('y')) token = `${token.slice(0, -1)}i`;
  return token;
}

export function tokenize(text) {
  return fold(text.toLowerCase())
    .replace(/[^\p{L}\p{N}\s-]/gu, ' ')
    .split(/[\s-]+/)
    .filter((token) => token.length > 2 && !STOP.has(token))
    .map(stem);
}

function frequencies(tokens) {
  const result = new Map();
  for (const token of tokens) result.set(token, (result.get(token) || 0) + 1);
  return result;
}

function vector(frequency, idf) {
  const result = new Map();
  for (const [term, count] of frequency) result.set(term, count * idf(term));
  return result;
}

export function cosine(left, right) {
  let dot = 0;
  let leftNorm = 0;
  let rightNorm = 0;
  for (const [term, weight] of left) {
    leftNorm += weight * weight;
    const other = right.get(term);
    if (other) dot += weight * other;
  }
  for (const weight of right.values()) rightNorm += weight * weight;
  if (!leftNorm || !rightNorm) return 0;
  return dot / (Math.sqrt(leftNorm) * Math.sqrt(rightNorm));
}

export function buildTextCorpus(skills) {
  const frequenciesById = new Map();
  for (const skill of skills) {
    const idTokens = tokenize(skill.id.replace(/-/g, ' '));
    const tagTokens = tokenize((skill.tags || []).join(' '));
    frequenciesById.set(skill.id, frequencies([
      ...idTokens, ...idTokens, ...idTokens,
      ...tagTokens, ...tagTokens,
      ...tokenize(skill.description),
    ]));
  }

  const documentFrequency = new Map();
  for (const terms of frequenciesById.values()) {
    for (const term of terms.keys()) {
      documentFrequency.set(term, (documentFrequency.get(term) || 0) + 1);
    }
  }
  const size = frequenciesById.size;
  const idf = (term) => Math.log(1 + size / (1 + (documentFrequency.get(term) || 0)));
  const vectors = new Map();
  for (const [id, terms] of frequenciesById) vectors.set(id, vector(terms, idf));
  return { idf, vectors };
}

export function rankText(corpus, prompt) {
  const query = vector(frequencies(tokenize(prompt)), corpus.idf);
  return [...corpus.vectors]
    .map(([id, skillVector]) => ({ id, score: cosine(query, skillVector) }))
    .filter((row) => row.score > 0)
    .sort((a, b) => b.score - a.score || a.id.localeCompare(b.id));
}

export function descriptionCollisions(corpus, minimum = 0.5) {
  const rows = [...corpus.vectors];
  const collisions = [];
  for (let left = 0; left < rows.length; left += 1) {
    for (let right = left + 1; right < rows.length; right += 1) {
      const score = cosine(rows[left][1], rows[right][1]);
      if (score >= minimum) collisions.push({ left: rows[left][0], right: rows[right][0], score });
    }
  }
  return collisions.sort((a, b) => b.score - a.score || a.left.localeCompare(b.left));
}
