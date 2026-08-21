// domains.js — the catalog grouped by what the user is trying to do.
// Single source for the CLI's manual picker. Every skill id in the manifest
// MUST appear in exactly one domain (enforced by tests/domains.test.js) so the
// catalog grows deliberately, never silently.

export const DOMAINS = [
  { title: 'Core & control plane', ids: ['init', 'harness', 'orient', 'suggest', 'bro', 'author-skill', 'sdd-init'] },
  { title: 'Spec-Driven Development', ids: ['sdd', 'constitution', 'idea-refinement', 'specify', 'clarify', 'plan', 'tasks', 'analyze', 'decision-challenge', 'implement', 'source-grounded-development', 'verify', 'review', 'simplify-code', 'ship', 'debug', 'worktrees', 'parallel'] },
  { title: 'Run a business', ids: ['finance-ops', 'invoicing', 'bookkeeping', 'pricing', 'sales-pipeline', 'lead-gen', 'cold-outreach', 'proposals', 'contracts', 'customer-support', 'client-onboarding', 'retention', 'hiring', 'people-ops', 'inventory', 'logistics-ops', 'procurement', 'meeting-notes', 'sop-builder', 'project-ops'] },
  { title: 'Raise & model money', ids: ['pitch-deck', 'investor-materials', 'financial-model', 'fundraising', 'unit-economics', 'grants'] },
  { title: 'Legal, privacy & compliance', ids: ['gdpr-privacy', 'terms-conditions', 'compliance', 'data-policy', 'ip-trademark'] },
  { title: 'Market & brand', ids: ['marketing', 'seo-geo', 'content-engine', 'social-publisher', 'brand-voice', 'brand-identity', 'newsletter', 'landing-copy', 'ads', 'article-writing', 'case-studies', 'video-shorts', 'podcast', 'market-research', 'competitor-watch', 'press-kit', 'community', 'webinar', 'review-management'] },
  { title: 'Grow a channel (YouTube / TikTok / Reels / LinkedIn / Medium)', ids: ['youtube-api', 'youtube-strategy', 'youtube-ideation', 'youtube-thumbnails', 'youtube-packaging', 'remotion-video', 'tiktok-api', 'instagram-api', 'shortform-strategy', 'shortform-ideation', 'shortform-packaging', 'shortform-editing', 'viral-score', 'linkedin-api', 'linkedin-strategy', 'linkedin-content', 'linkedin-carousels', 'linkedin-outreach', 'medium-writing', 'medium-publishing', 'medium-strategy'] },
  { title: 'Connect & automate', ids: ['stripe', 'email-connector', 'google-workspace', 'notion-connector', 'whatsapp-telegram', 'automation-flows', 'api-connector-builder', 'webhooks', 'data-scraper', 'spreadsheet-ops', 'calendar-scheduling', 'document-processing', 'e-signature'] },
  { title: 'Automation platforms', ids: ['automation-strategy', 'n8n', 'make', 'zapier', 'power-automate'] },
  { title: 'Data & analytics', ids: ['analytics', 'dashboard', 'kpi-framework', 'reporting', 'ab-testing', 'forecasting', 'data-cleaning', 'business-intelligence'] },
  { title: 'AI — build it in', ids: ['building-agents', 'rag', 'embeddings-search', 'prompt-engineering', 'llm-pipeline', 'agent-eval', 'chatbot', 'ai-media', 'replicate-images', 'structured-extraction', 'agent-safety', 'cost-tracking'] },
  { title: 'AI — run it on', ids: ['replicate', 'runpod', 'modal', 'huggingface', 'ollama', 'together-fireworks', 'fal'] },
  { title: 'AI — train it', ids: ['machine-learning', 'deep-learning', 'nlp', 'finetuning', 'training-data', 'unsloth', 'open-weights', 'vllm'] },
  { title: 'Languages', ids: ['typescript', 'python', 'java', 'csharp-dotnet', 'php', 'ruby', 'cpp', 'elixir', 'bash-scripting', 'sql', 'go', 'write-swift'] },
  { title: 'Frameworks & app stacks', ids: ['fastapi', 'nextjs', 'react', 'react-native', 'vue-nuxt', 'angular', 'svelte', 'astro', 'solid-js', 'htmx', 'nodejs', 'nestjs', 'django', 'laravel', 'rails', 'spring-boot', 'phoenix', 'flutter', 'swift-ios', 'kotlin-android', 'compose-multiplatform', 'expo', 'tauri', 'electron', 'rust', 'wordpress', 'shopify', 'no-code-app', 'chrome-extension', 'api-design', 'pick-ui-library', 'ask-sonner'] },
  { title: 'Game development', ids: ['godot', 'unity', 'unreal', 'game-design', 'game-storytelling', 'level-design', 'gamedev-shaders', 'gamedev-multiplayer', 'gamedev-physics', 'gamedev-pathing', 'gamedev-shipping'] },
  { title: 'Databases & data layer', ids: ['postgresdb', 'mysql', 'mongodb', 'redis', 'supabase', 'neon', 'planetscale', 'sqlite-turso', 'prisma-orm', 'drizzle-orm', 'firebase', 'dynamodb', 'vector-db', 'clickhouse-analytics', 'duckdb', 'db-migrations', 'backups'] },
  { title: 'Ship & operate — platforms', ids: ['vercel', 'netlify', 'cloudflare', 'railway', 'render', 'fly-io', 'coolify', 'hetzner', 'digitalocean', 'aws-essentials', 'gcp-essentials'] },
  { title: 'Ship & operate — devops', ids: ['docker', 'github-actions', 'git-workflow', 'domains-dns', 'monitoring', 'email-deliverability', 'scaling', 'deployment', 'deprecation'] },
  { title: 'Ship & operate — quality & security', ids: ['code-review', 'security-scan', 'secure-coding', 'testing-py', 'testing-web', 'testing-go', 'e2e-testing', 'accessibility', 'performance', 'error-handling', 'observability'] },
  { title: 'Motion & interface craft', ids: ['design-eng', 'animate', 'animate-expo', 'review-animations', 'improve-animations', 'find-animation-opportunities', 'animation-vocabulary', 'apple-design', 'prototype'] },
  { title: 'Design & content craft', ids: ['design', 'presentations', 'course-storytelling', 'course-builder', 'technical-writing', 'translation-l10n'] },
  { title: 'Knowledge & meta', ids: ['knowledge-ops', 'codebase-onboarding', 'research-ops', 'decision-records', 'continuous-learning', 'skill-scout', 'context-budget', 'roast-me', 'fable-operator'] },
];

export function allDomainIds() {
  return DOMAINS.flatMap((d) => d.ids);
}
