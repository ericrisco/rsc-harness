// What a session start does for team-safe-default (rsc 3.0), beyond saying hello:
//
//   rescueTrunkCommits    — commits sitting on a CLOSED default branch that never reached the remote
//                           (left there by an agent before 3.0) move to a `rescue/…` branch, and the
//                           default branch goes back to what the remote has. Spec clarify P4.
//   relocateOldWorktrees  — worktrees older versions made OUTSIDE the project (sibling folders) move
//                           into `.worktrees/`. Only the ones rsc made, never one a session is working
//                           in, and a failure leaves it where it was. Spec clarify P6.
//   teamSafeAnnouncement  — once per project and machine, what changed in 3.0 and how to turn each
//                           part off. Spec, global criterion.
//
// Each returns the text to say, or ''. None throws: a session start is never worth breaking.
// Standalone siblings under `.rsc/`: trunk-policy.mjs, worktree-reaper.mjs, session-memory-core.mjs.
import { execFileSync } from 'node:child_process';
import { existsSync, mkdirSync, readFileSync, realpathSync, writeFileSync } from 'node:fs';
import { basename, join, sep } from 'node:path';

const git = (root, args) => {
  try { return execFileSync('git', args, { windowsHide: true, cwd: root, encoding: 'utf8', stdio: ['ignore', 'pipe', 'pipe'], timeout: 8000 }).trim(); }
  catch { return null; }
};
const ok = (root, args) => git(root, args) !== null;
const real = (p) => { try { return realpathSync(p); } catch { return p; } };
const stamp = () => new Date().toISOString().slice(0, 16).replace(/[-:T]/g, '').replace(/^(\d{8})(\d{4})$/, '$1-$2');

const RESCUE_MARK = '.team-safe-3-rescue';

/** Once per project and machine, the first session with 3.0 (spec P4): after that, commits on the
 *  default branch are the person's own business (P3), never moved again (review M1). */
export async function rescueTrunkCommits(root) {
  try {
    const mark = join(root, '.rsc', RESCUE_MARK);
    if (existsSync(mark)) return '';
    mkdirSync(join(root, '.rsc'), { recursive: true });
    writeFileSync(mark, `${new Date().toISOString()}\n`);
    const { trunkPolicy, defaultBranchName } = await import(new URL('./trunk-policy.mjs', import.meta.url));
    const branch = git(root, ['symbolic-ref', '--quiet', '--short', 'HEAD']);
    const trunk = defaultBranchName(root);
    if (!branch || !trunk || branch !== trunk || !trunkPolicy(root).closed) return '';
    const remote = `refs/remotes/origin/${trunk}`;
    if (!git(root, ['rev-parse', '--verify', '--quiet', remote])) return '';
    const ahead = Number(git(root, ['rev-list', '--count', `${remote}..HEAD`]) || 0);
    if (!ahead) return '';
    const name = `rescue/${trunk}-${stamp()}`;
    if (!ok(root, ['branch', name, 'HEAD'])) return '';
    // --keep refuses instead of losing anything: a change in progress that the reset would touch.
    if (!ok(root, ['reset', '--quiet', '--keep', remote])) {
      return `rsc · ${ahead} commit(s) en «${trunk}» que no están en el remoto, y este proyecto tiene «${trunk}» cerrada para el agente. ` +
        `Los he copiado a la rama «${name}», pero no he podido dejar «${trunk}» como en el remoto porque hay cambios sin guardar que se verían afectados. ` +
        `Díselo a la persona en una línea; cuando esos cambios estén a salvo: \`git reset --keep origin/${trunk}\`.`;
    }
    return `rsc · Había ${ahead} commit(s) en «${trunk}» que nunca llegaron al remoto, y en este proyecto «${trunk}» está cerrada para el agente. ` +
      `Los he movido a la rama «${name}» y «${trunk}» vuelve a estar igual que en el remoto. Díselo a la persona en una línea.`;
  } catch { return ''; }
}

export async function relocateOldWorktrees(root) {
  try {
    const W = await import(new URL('./worktree-reaper.mjs', import.meta.url));
    // Moving a folder is destructive, so this fails closed: without the memory nobody can be seen
    // working, and then nothing is moved. A session in an old sibling keeps its journal in the
    // sibling's own store (it has its own .rsc.json), so both stores are asked (review H3).
    let M;
    try { M = await import(new URL('./session-memory-core.mjs', import.meta.url)); } catch { return ''; }
    const others = (path) => [
      ...M.otherActiveSessions({ cwd: root, worktreeCwd: path }),
      ...M.otherActiveSessions({ cwd: path, worktreeCwd: path }),
    ];
    const home = real(root);
    const moved = [];
    const left = [];
    for (const wt of W.listWorktrees(root)) {
      const path = real(wt.path);
      if (path === home || path.startsWith(home + sep)) continue; // already inside
      if (W.provenanceOf(root, { ...wt, path }) !== 'rsc') continue;
      if (others(path).length) { left.push(`${path} (una sesión trabaja en él)`); continue; }
      const name = basename(path);
      const dest = join(home, '.worktrees', name.startsWith(`${basename(home)}-`) ? name.slice(basename(home).length + 1) : name);
      if (existsSync(dest)) { left.push(`${path} (ya existe ${dest})`); continue; }
      mkdirSync(join(home, '.worktrees'), { recursive: true });
      if (ok(root, ['worktree', 'move', path, dest])) moved.push(`${path} → .worktrees/${basename(dest)}`);
      else left.push(`${path} (git no ha podido moverlo)`);
    }
    if (!moved.length && !left.length) return '';
    return [
      moved.length ? `rsc · Worktrees de versiones antiguas movidos dentro del proyecto: ${moved.join('; ')}.` : '',
      left.length ? `rsc · Sin mover, se reintenta en otra sesión: ${left.join('; ')}.` : '',
      'Díselo a la persona en una línea.',
    ].filter(Boolean).join(' ');
  } catch { return ''; }
}

const MARK = '.team-safe-3';

// Which language to say it in. The profile's `language:` frontmatter field when there is one, then the
// locale the assistant runs under, and English when neither says: this banner reached English-speaking
// users in Spanish. The other always-on texts are English and ask the agent to relay them in the
// person's language; this one keeps a Spanish version because it was written for Spanish users first.
export function announcementLanguage(root, env = process.env) {
  try {
    const profile = readFileSync(join(root, '02-DOCS', 'wiki', 'harness', 'user-profile.md'), 'utf8');
    const front = /^---\r?\n([\s\S]*?)\r?\n---/.exec(profile)?.[1] || '';
    const declared = /^(?:language|lang|idioma)\s*:\s*["']?([^"'\r\n]+)/mi.exec(front)?.[1]?.trim().toLowerCase();
    if (declared) return /^(es|spa|español|espanol|castellano|spanish)\b/.test(declared) ? 'es' : 'en';
  } catch { /* no profile: fall through to the locale */ }
  const locale = String(env.LC_ALL || env.LC_MESSAGES || env.LANG || '').toLowerCase();
  return /^es([_.-]|$)/.test(locale) ? 'es' : 'en';
}

const ANNOUNCEMENT = {
  es: `
===== rsc 3.0 · equipo seguro por defecto =====
ACTION: díselo a la persona en pocas líneas, una vez, antes de su petición:
1. Si la rama principal está abierta (proyectos sencillos), el agente trabaja en ella sin preguntar.
   Si está cerrada (código a largo plazo, CI o equipo), pregunta antes de cada cambio: ¿esta rama,
   una nueva, o desbloquear? Nunca abre una rama por su cuenta. Cambiarlo: «desbloquea main» o «bloquea main».
2. Si otra sesión de un asistente está trabajando en esta misma carpeta, el trabajo nuevo va a un
   worktree en .worktrees/<rama>/. Para no hacerlo: «no uses worktrees».
3. El agente elige solo entre FTD (lo sencillo) y SDD (lo grande o complejo) y lo dice; se puede
   pedir el otro.
4. 01-TOOLS/ y 02-DOCS/ viajan al equipo por la rama rsc/knowledge y llegan a la principal dentro de
   las PRs. Para apagarlo: rsc knowledge-sync off.
==============================================
`,
  en: `
===== rsc 3.0 · team-safe by default =====
ACTION: tell the person in a few lines, once, before their request, in their language:
1. If the default branch is open (simple projects), the agent works on it without asking.
   If it is closed (long-lived code, CI or a team), it asks before each change: this branch,
   a new one, or unlock? It never opens a branch on its own. To change it: "unlock main" or
   "lock main" (rsc main unlock | lock).
2. If another assistant session is working in this same folder, new work goes to a worktree in
   .worktrees/<branch>/. To turn that off: "don't use worktrees" (rsc isolation off).
3. The agent picks between FTD (simple work) and SDD (large or complex work) and says which; you
   can ask for the other.
4. 01-TOOLS/ and 02-DOCS/ travel to the team on the rsc/knowledge branch and reach the default
   branch inside pull requests. To turn it off: rsc knowledge-sync off.
==========================================
`,
};

export function teamSafeAnnouncement(root, env = process.env) {
  try {
    const mark = join(root, '.rsc', MARK);
    if (existsSync(mark)) return '';
    mkdirSync(join(root, '.rsc'), { recursive: true });
    writeFileSync(mark, `${new Date().toISOString()}\n`);
    return ANNOUNCEMENT[announcementLanguage(root, env)];
  } catch { return ''; }
}

/**
 * The harness only reaches a teammate through what is committed: `.rsc.json` (the decision), the
 * Claude settings that wire the guards and hooks, the bootstrap a clone runs. Field tests 3.0.7 and
 * 3.0.8: five sessions each, and none of those files was ever committed — «team-safe by default»
 * that never left the machine. Said at session start while `.rsc.json` is untracked in a repo with a
 * remote; at most once a week, so it informs without nagging (P7). The agent proposes, never commits
 * on its own.
 */
const HARNESS_FILES = ['.rsc.json', '.claude/settings.json', '.claude/rsc-bootstrap.mjs', '.gitignore'];
const COMMIT_MARK = '.harness-commit-offered';
const WEEK_MS = 7 * 24 * 3600 * 1000;

export function harnessCommitNotice(root, now = Date.now()) {
  try {
    const run = (args) => execFileSync('git', args, { cwd: root, encoding: 'utf8', windowsHide: true, stdio: ['ignore', 'pipe', 'ignore'] }).trim();
    if (!existsSync(join(root, '.rsc.json'))) return '';
    if (!run(['remote'])) return '';
    if (run(['ls-files', '--', '.rsc.json'])) return '';
    const mark = join(root, '.rsc', COMMIT_MARK);
    if (existsSync(mark) && now - Date.parse(readFileSync(mark, 'utf8').trim()) < WEEK_MS) return '';
    mkdirSync(join(root, '.rsc'), { recursive: true });
    writeFileSync(mark, `${new Date(now).toISOString()}\n`);
    const files = HARNESS_FILES.filter((f) => existsSync(join(root, f)));
    return '===== rsc · harness not committed =====\n' +
      `The harness files (${files.join(', ')}) are not in git, so teammates and new clones get no guards, ` +
      'hooks or decisions. ACTION: tell the person in one line, in their language, and offer to commit ' +
      'them with their next change (on the branch this project uses). Do not commit them on your own.\n' +
      '=======================================\n';
  } catch { return ''; }
}

