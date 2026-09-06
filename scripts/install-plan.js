import { targetPaths } from '../targets/index.js';

export function planInstall({ skillIds, target, home, cwd, hooks = true }) {
  const t = targetPaths(target, home, cwd);
  const plan = [];
  for (const id of skillIds) {
    plan.push({ kind: 'skill', id, from: `skills/${id}`, to: t.skillDir(id) });
  }
  if (hooks && skillIds.includes('suggest')) {
    plan.push({ kind: 'hook', target, to: t.hookTarget });
  }
  return plan;
}
