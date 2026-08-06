import { buildTextCorpus, rankText } from './lib/text-rank.js';

// Stopwords (es + en + common EU words) — these match everywhere via LIKE and drown the signal.
const STOP = new Set([
  'una', 'un', 'unos', 'unas', 'con', 'de', 'del', 'la', 'el', 'los', 'las', 'para',
  'que', 'porque', 'en', 'mi', 'mis', 'me', 'quiero', 'tener', 'hacer', 'al', 'lo',
  'su', 'sus', 'este', 'esta', 'esto', 'como', 'mas', 'más', 'algo', 'cosa', 'cosas',
  'vull', 'vols', 'amb', 'segons', 'usuari', 'usuaris', 'aquesta', 'aquest',
  'aixo', 'això', 'per', 'els', 'les', 'dels', 'segun', 'según', 'usuario',
  'usuarios', 'tarea', 'tareas',
  'the', 'and', 'or', 'to', 'of', 'in', 'for', 'with', 'my', 'want', 'build', 'it',
  'need', 'have', 'make', 'create', 'add', 'new',
  'le', 'des', 'du', 'pour', 'cette', 'cet', 'ce', 'mon', 'ma', 'mes',
  'il', 'gli', 'questo', 'questa', 'mio', 'mia',
  'o', 'a', 'os', 'as', 'essa', 'esse', 'minha', 'meu',
  'der', 'die', 'das', 'den', 'dem', 'des', 'fur', 'fuer', 'für', 'diese', 'dieser',
  'dit', 'deze', 'het', 'een', 'voor', 'mijn',
]);

// Spanish / colloquial terms → catalog tags. Lets non-programmers describe
// outcomes in their words and still hit the right (English-tagged) skill.
const SYNONYMS = {
  web: ['web', 'frontend', 'nextjs'], pagina: ['web', 'nextjs'], 'página': ['web', 'nextjs'],
  website: ['web', 'nextjs'], site: ['web', 'nextjs'], landing: ['landing', 'web', 'nextjs'],
  tienda: ['web', 'frontend'], ecommerce: ['web'], pagos: ['security', 'auth'], pago: ['security'],
  datos: ['database', 'sql'], base: ['database'], guardar: ['database'], almacenar: ['database'],
  publicar: ['deploy', 'docker'], publicarla: ['deploy'], publicarlo: ['deploy'], online: ['deploy'],
  desplegar: ['deploy'], deploy: ['deploy'], servidor: ['backend', 'deploy'],
  montar: ['bootstrap', 'start', 'setup', 'new'], monta: ['bootstrap', 'start', 'setup', 'new'],
  montando: ['bootstrap', 'start', 'setup', 'new'], arrancar: ['bootstrap', 'start', 'setup', 'new'],
  arranca: ['bootstrap', 'start', 'setup', 'new'], empezar: ['bootstrap', 'start', 'setup', 'new'],
  empieza: ['bootstrap', 'start', 'setup', 'new'], iniciar: ['bootstrap', 'start', 'setup', 'new'],
  inicia: ['bootstrap', 'start', 'setup', 'new'], start: ['bootstrap', 'start', 'setup', 'new'],
  bootstrap: ['bootstrap', 'start', 'setup', 'new'], setup: ['bootstrap', 'start', 'setup', 'new'],
  empresa: ['company', 'harness'], negocio: ['company', 'harness'], documentar: ['docs', 'wiki', 'harness'],
  documenta: ['docs', 'harness'], documentacion: ['docs', 'harness'], 'documentación': ['docs', 'harness'],
  conectar: ['connect', 'harness'], conecta: ['connect', 'harness'], herramientas: ['tools', 'harness'],
  procesos: ['ops', 'harness'], ops: ['ops', 'harness'], conocimiento: ['knowledge', 'wiki', 'harness'],
  app: ['mobile', 'app'], aplicacion: ['app'], 'aplicación': ['app'], movil: ['mobile'], 'móvil': ['mobile'],
  api: ['api', 'backend'], backend: ['backend'], rest: ['api'],
  seguro: ['security'], seguridad: ['security'], login: ['auth', 'security'], auth: ['auth'],
  agente: ['agents', 'ai'], agentes: ['agents'], ia: ['ai', 'agents'], llm: ['llm', 'agents'],
  presentacion: ['presentations'], 'presentación': ['presentations'], diapositivas: ['slides'],
  curso: ['course', 'teaching'], 'enseñar': ['teaching'], ensenar: ['teaching'],
  marketing: ['marketing'], copy: ['copywriting'], texto: ['copywriting'], textos: ['copywriting'],
  human: ['bro', 'human-writing', 'natural-language', 'plain-language'],
  humano: ['bro', 'human-writing', 'natural-language', 'plain-language'],
  humana: ['bro', 'human-writing', 'natural-language', 'plain-language'],
  huma: ['bro', 'human-writing', 'natural-language', 'plain-language'],
  natural: ['bro', 'human-writing', 'natural-language', 'plain-language'],
  robotico: ['bro', 'human-writing'], robotica: ['bro', 'human-writing'],
  robotic: ['bro', 'human-writing'], roboticamente: ['bro', 'human-writing'],
  jerga: ['bro', 'plain-language', 'no-jargon'], jargon: ['bro', 'plain-language', 'no-jargon'],
  // Cross-cutting workflow vocabulary. These map multilingual/colloquial
  // wording to the exact compound tags used by the catalog.
  challenge: ['adversarial-review', 'decision-quality', 'preflight'], challenged: ['adversarial-review'],
  cuestiona: ['adversarial-review', 'decision-quality', 'preflight'], cuestionar: ['adversarial-review'],
  'qüestiona': ['adversarial-review', 'decision-quality', 'preflight'],
  supuestos: ['assumptions', 'adversarial-review'], suposiciones: ['assumptions'],
  afirmaciones: ['assumptions', 'adversarial-review'], claims: ['assumptions', 'adversarial-review'],
  stress: ['adversarial-review', 'preflight'],
  retire: ['deprecation', 'removal', 'consumer-migration'], retired: ['deprecation', 'removal'],
  deprecated: ['deprecation', 'removal'], deprecada: ['deprecation', 'removal'],
  retirar: ['deprecation', 'removal'], retirada: ['deprecation', 'removal', 'consumer-migration'],
  legado: ['deprecation', 'compatibility'], legacy: ['deprecation', 'compatibility'],
  simplifica: ['code-simplification', 'refactoring', 'readability'],
  simplificar: ['code-simplification', 'refactoring', 'readability'],
  simplify: ['code-simplification', 'refactoring', 'readability'],
  simplified: ['code-simplification', 'readability'], clarity: ['readability', 'complexity'],
  enginyos: ['readability', 'complexity'], caracterizacion: ['behavior-preservation'],
  'caracterización': ['behavior-preservation'], caracteritzacio: ['behavior-preservation'],
  'caracterització': ['behavior-preservation'], wrappers: ['code-simplification'],
  official: ['official-docs', 'primary-sources'], oficiales: ['official-docs', 'primary-sources'],
  oficial: ['official-docs', 'primary-sources'], documentacion: ['official-docs'],
  'documentación': ['official-docs'], fonts: ['primary-sources'], fuentes: ['primary-sources'],
  sources: ['primary-sources'], lockfile: ['version-detection'],
  specification: ['primary-sources'], specifications: ['primary-sources'],
  version: ['version-detection'], versions: ['version-detection'], versioned: ['version-detection'],
  'versión': ['version-detection'], versio: ['version-detection'], 'versió': ['version-detection'],
  cite: ['primary-sources'], cited: ['primary-sources'], citations: ['primary-sources'],
  concepts: ['idea-refinement', 'ideation'], conceptos: ['idea-refinement', 'ideation'],
  conceptes: ['idea-refinement', 'ideation'], premortem: ['idea-refinement', 'ideation'],
};

const SKILL_ROUTING_TERMS = ['suggest', 'detect', 'install', 'meta'];

const SKILL_NOUNS = new Set([
  'skill', 'skills', 'habilidad', 'habilidades', 'habilitat', 'habilitats',
  'competencia', 'competencias', 'competence', 'competences', 'competenza',
  'competenze', 'habilidade', 'habilidades', 'fertigkeit', 'fertigkeiten',
  'vaardigheid', 'vaardigheden',
]);

const SKILL_ROUTING_VERBS = new Set([
  'recommend', 'recommended', 'recommending', 'recommendation', 'recommendations',
  'suggest', 'suggests', 'suggesting', 'advise', 'choose', 'select', 'find',
  'detect', 'detects', 'detecting', 'route', 'routing', 'match', 'matching',
  'install', 'installs', 'installing', 'add', 'use',
  'recomendar', 'recomienda', 'recomiendas', 'recomiendame', 'recomendacion',
  'recomendaciones', 'sugerir', 'sugiere', 'aconseja', 'elegir', 'elige',
  'detectar', 'detecta', 'instalar', 'instala', 'usar',
  'recomanar', 'recomana', 'recomanes', 'recomanen', 'recomanacio',
  'recomanacions', 'suggerir', 'tria', 'trobar', 'detecti', 'installar',
  'instal', 'afegir',
  'recommande', 'recommander', 'recommandation', 'conseiller', 'choisir',
  'trouver', 'detecter', 'installer', 'ajouter', 'utiliser',
  'consiglia', 'consigliare', 'raccomanda', 'scegliere', 'trovare', 'rilevare',
  'installare', 'aggiungi', 'usare',
  'recomenda', 'recomendacao', 'recomendacoes', 'sugerir', 'escolher',
  'encontrar', 'detectar', 'instalar', 'adicionar', 'usar',
  'empfiehl', 'empfehlen', 'empfehlung', 'waehlen', 'wahlen', 'finden',
  'erkennen', 'installiere', 'installieren', 'verwenden',
  'aanbevelen', 'aanbeveling', 'kiezen', 'vinden', 'detecteren',
  'installeer', 'installeren', 'gebruiken',
]);

const MIN_USEFUL_SCORE = 2;
const LEXICAL_WEIGHT = 100;
const LOW_SIGNAL_TAG_TERMS = new Set(['web', 'frontend']);

function fold(term) {
  return term.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function expandedTerms(query) {
  const raw = query.toLowerCase().replace(/[^\p{L}\p{N}\s]/gu, ' ').split(/\s+/)
    .filter((t) => t.length > 1);
  const tokens = [];
  for (const t of raw) {
    tokens.push(t);
    const folded = fold(t);
    if (folded !== t) tokens.push(folded);
  }

  const set = new Set();
  const hasSkillNoun = tokens.some((t) => SKILL_NOUNS.has(t));
  const hasSkillRoutingVerb = tokens.some((t) => SKILL_ROUTING_VERBS.has(t));

  for (const t of tokens) {
    if (STOP.has(t)) continue;
    set.add(t);
    // Do not read inherited Object.prototype values (for example a query
    // containing "constructor"). They are functions, not synonym arrays.
    const synonyms = Object.hasOwn(SYNONYMS, t) ? SYNONYMS[t] : [];
    for (const syn of synonyms) set.add(syn);
  }
  if (hasSkillNoun && hasSkillRoutingVerb) {
    for (const term of SKILL_ROUTING_TERMS) set.add(term);
  }
  return [...set];
}

export async function createRanker(manifest) {
  const corpus = buildTextCorpus(manifest.skills);

  return {
    rank(query) {
      const terms = expandedTerms(query);
      if (!terms.length) return [];
      const exact = scoreRows(manifest.skills, terms);
      const exactById = new Map(exact.map((row) => [row.id, row.score]));
      // Synonyms feed the statistical ranker as well as the exact scorer. This
      // preserves Spanish/Catalan intent mapping while TF-IDF handles lexical
      // variants and description-wide relevance.
      const lexical = rankText(corpus, `${query} ${terms.join(' ')}`);
      const lexicalById = new Map(lexical.map((row) => [row.id, row.score]));
      const maxExact = Math.max(0, ...exact.map((row) => row.score));
      const maxLexical = lexical[0]?.score || 0;
      if (maxExact < MIN_USEFUL_SCORE && maxLexical < 0.08) return [];

      const ids = new Set([...exactById.keys(), ...lexicalById.keys()]);
      return [...ids].map((id) => ({
        id,
        score: (exactById.get(id) || 0) + (lexicalById.get(id) || 0) * LEXICAL_WEIGHT,
      })).sort(byScore);
    },
    close() {},
  };
}

export async function rank(manifest, query) {
  const ranker = await createRanker(manifest);
  try {
    return ranker.rank(query);
  } finally {
    ranker.close();
  }
}

function scoreRows(skills, terms) {
  return skills.map((skill) => {
    const id = skill.id.toLowerCase();
    const tags = (skill.tags || []).map((t) => t.toLowerCase());
    const description = ` ${skill.description.toLowerCase()} `;
    let score = 0;
    for (const term of terms) {
      if (id === term) score += 20;
      else if (!LOW_SIGNAL_TAG_TERMS.has(term) && id.includes(term)) score += 8;
      if (tags.includes(term)) score += LOW_SIGNAL_TAG_TERMS.has(term) ? 3 : 10;
      if (description.includes(` ${term} `)) score += 1;
    }
    return { id: skill.id, score };
  }).filter((r) => r.score > 0);
}

function byScore(a, b) {
  return b.score - a.score || a.id.localeCompare(b.id);
}
