import { skillById } from './manifest.js';

const OUTCOMES = {
  suggest: 'An assistant that proposes what you need as you go',
  harness: 'A tidy workspace: connect and document your company',
  init: 'Guided project bootstrap',
  nextjs: 'Your website (fast, ready for Google)',
  flutter: 'Your mobile app',
  fastapi: 'Your API / Python backend',
  go: 'Your Go backend service',
  postgresdb: 'Store your data reliably',
  design: 'Make it look good and convert',
  marketing: 'Copy that sells',
  presentations: 'On-brand presentations',
  'course-storytelling': 'Teach so it actually lands',
  'building-agents': 'Your own AI agent',
  'secure-coding': 'Make it secure',
  deployment: 'Put it online',
  godot: 'Your game (Godot)',
  unity: 'Your game (Unity)',
  unreal: 'Your game (Unreal)',
  'game-design': "Design a game that's fun",
  'fable-operator': 'Reason it through, reliably',
};

export function hasOutcome(id) {
  return Object.prototype.hasOwnProperty.call(OUTCOMES, id);
}

export function expandRecommends(manifest, chosen) {
  const set = new Set();
  for (const id of chosen) {
    set.add(id);
    const s = skillById(manifest, id);
    for (const r of s?.recommends || []) set.add(r);
  }
  return [...set];
}

export function toOutcomes(ids) {
  return ids.map((id) => ({ id, label: OUTCOMES[id] || id }));
}
