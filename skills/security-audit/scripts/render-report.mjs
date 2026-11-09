#!/usr/bin/env node
// Renders an audit directory written by the `security-audit` skill into one self-contained page:
//
//   node render-report.mjs <audit-dir> [--lang en|es]
//
// It validates first (validate-findings.mjs) and refuses to render anything the validator rejects, so
// the report can never show a claim the disk does not back. Output: `<audit-dir>/report.html`, mode
// 0600 — the page lists unfixed vulnerabilities, so it is readable by its owner only. The page makes no
// external request: inline CSS, no scripts, light/dark from the reader's system, phone-width safe.
//
// The fixed text (headings, explanations, enum labels) is translated; what the auditor wrote
// (titles, impacts, steps) is shown exactly as written, HTML-escaped.
import { closeSync, constants, fchmodSync, lstatSync, openSync, writeSync } from 'node:fs';
import { join, relative, resolve, sep } from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { realpathSync } from 'node:fs';
import { validate } from './validate-findings.mjs';

const T = {
  en: {
    title: 'Security audit report',
    howTitle: 'How to read this report',
    how: [
      '<strong>Confirmed</strong> means the problem was proven: the evidence files listed with it show it happening. Only confirmed findings carry a severity.',
      '<strong>Needs validation</strong> means the problem is plausible but one specific fact is still missing; that fact is written next to it. Treat it as open until someone checks it.',
      '<strong>Rejected</strong> means it was investigated and ruled out; the reason is recorded so nobody re-checks it for nothing.',
      'Severity: <strong>critical</strong> — fix now, an attacker can do serious damage with little effort; <strong>high</strong> — fix this week; <strong>medium</strong> — plan the fix; <strong>low</strong> — fix when convenient.',
      '<strong>Not reviewed</strong> or <strong>blocked</strong> means nobody looked there. Having no findings in that area tells you nothing about it being safe.',
    ],
    warning: 'This file contains unfixed vulnerabilities. It must not be shared or committed: keep it on this machine, and delete it once the fixes are in.',
    summary: 'Summary', findings: 'Findings', platforms: 'Platforms', coverage: 'Coverage', steps: 'Your steps',
    runStatus: 'Run status', profile: 'Profile', started: 'Started', projectRoot: 'Project', scope: 'Scope',
    partialReason: 'Why it is partial', bySeverity: 'Confirmed by severity', byVerdict: 'Findings by verdict',
    confirmedH: 'Confirmed', nvH: 'Needs validation', rejectedH: 'Rejected', rejectedSummary: (n) => `${n} rejected finding(s) — click to expand`,
    none: 'None.', who: 'Who can trigger it', boundary: 'Boundary crossed', impact: 'Impact', class: 'Attack class',
    surface: 'Surface', platform: 'Platform', locations: 'Where', evidence: 'Evidence', missing: 'Still missing',
    rejection: 'Why it was rejected', fix: 'Proposed fix', fixStatus: 'Fix status', rollback: 'How to undo the fix',
    recheck: 'Recheck', recheckArtifact: 'recheck output', manualSteps: 'Manual steps',
    platformCols: ['Platform', 'Detected by', 'Access', 'Status', 'Tool or reason'],
    unitCols: ['Unit', 'Surface', 'Area', 'Boundary', 'Class', 'Status', 'Reason', 'Findings'],
    unitsDone: (d, n) => `${d} of ${n} units reviewed.`,
    nothingToDo: 'Nothing for you to do.', fromFinding: 'From finding',
    labels: {
      confirmed: 'Confirmed', needs_validation: 'Needs validation', rejected: 'Rejected',
      critical: 'Critical', high: 'High', medium: 'Medium', low: 'Low',
      complete: 'Complete', partial: 'Partial', quick: 'Quick', standard: 'Standard', deep: 'Deep',
      code: 'Code', platform: 'Platform', artifact: 'artifact', command_output: 'command output', source: 'source',
      proposed: 'Proposed', approved: 'Approved', applied: 'Applied', declined: 'Declined', rolled_back: 'Rolled back', manual: 'Manual (you do it)',
      pass: 'pass', fail: 'fail', not_run: 'not run',
      done: 'Done', blocked: 'Blocked', not_reviewed: 'Not reviewed', reviewed: 'Reviewed',
      read_only: 'Read only', write_for_fix: 'Write (for fixes)', none: 'None',
    },
  },
  es: {
    title: 'Informe de auditoría de seguridad',
    howTitle: 'Cómo leer este informe',
    how: [
      '<strong>Confirmado</strong> significa que el problema está probado: los ficheros de evidencia que lo acompañan lo muestran ocurriendo. Solo los confirmados llevan gravedad.',
      '<strong>Por validar</strong> significa que el problema es verosímil pero falta un dato concreto; ese dato está escrito al lado. Trátalo como abierto hasta que alguien lo compruebe.',
      '<strong>Descartado</strong> significa que se investigó y se descartó; el motivo queda escrito para que nadie lo vuelva a revisar en balde.',
      'Gravedad: <strong>crítica</strong> — arréglalo ya, un atacante puede hacer mucho daño con poco esfuerzo; <strong>alta</strong> — esta semana; <strong>media</strong> — planifica el arreglo; <strong>baja</strong> — cuando te venga bien.',
      '<strong>No revisado</strong> o <strong>bloqueado</strong> significa que nadie miró ahí. Que no haya hallazgos en esa zona no dice nada de que sea segura.',
    ],
    warning: 'Este fichero contiene vulnerabilidades sin arreglar. No debe compartirse ni subirse al repositorio: guárdalo en este equipo y bórralo cuando estén los arreglos.',
    summary: 'Resumen', findings: 'Hallazgos', platforms: 'Plataformas', coverage: 'Cobertura', steps: 'Tus pasos',
    runStatus: 'Estado de la auditoría', profile: 'Perfil', started: 'Inicio', projectRoot: 'Proyecto', scope: 'Alcance',
    partialReason: 'Por qué es parcial', bySeverity: 'Confirmados por gravedad', byVerdict: 'Hallazgos por veredicto',
    confirmedH: 'Confirmados', nvH: 'Por validar', rejectedH: 'Descartados', rejectedSummary: (n) => `${n} hallazgo(s) descartado(s) — pulsa para ver`,
    none: 'Ninguno.', who: 'Quién puede provocarlo', boundary: 'Frontera que cruza', impact: 'Impacto', class: 'Tipo de ataque',
    surface: 'Superficie', platform: 'Plataforma', locations: 'Dónde', evidence: 'Evidencia', missing: 'Falta comprobar',
    rejection: 'Por qué se descartó', fix: 'Arreglo propuesto', fixStatus: 'Estado del arreglo', rollback: 'Cómo deshacer el arreglo',
    recheck: 'Recomprobación', recheckArtifact: 'salida de la recomprobación', manualSteps: 'Pasos manuales',
    platformCols: ['Plataforma', 'Detectada por', 'Acceso', 'Estado', 'Herramienta o motivo'],
    unitCols: ['Unidad', 'Superficie', 'Zona', 'Frontera', 'Tipo', 'Estado', 'Motivo', 'Hallazgos'],
    unitsDone: (d, n) => `${d} de ${n} unidades revisadas.`,
    nothingToDo: 'No tienes nada que hacer.', fromFinding: 'Del hallazgo',
    labels: {
      confirmed: 'Confirmado', needs_validation: 'Por validar', rejected: 'Descartado',
      critical: 'Crítica', high: 'Alta', medium: 'Media', low: 'Baja',
      complete: 'Completa', partial: 'Parcial', quick: 'Rápido', standard: 'Estándar', deep: 'Profundo',
      code: 'Código', platform: 'Plataforma', artifact: 'artefacto', command_output: 'salida de comando', source: 'código fuente',
      proposed: 'Propuesto', approved: 'Aprobado', applied: 'Aplicado', declined: 'Rechazado', rolled_back: 'Revertido', manual: 'Manual (lo haces tú)',
      pass: 'pasa', fail: 'falla', not_run: 'sin ejecutar',
      done: 'Hecha', blocked: 'Bloqueada', not_reviewed: 'No revisada', reviewed: 'Revisada',
      read_only: 'Solo lectura', write_for_fix: 'Escritura (para arreglos)', none: 'Ninguno',
    },
  },
};

const SEVERITY_RANK = { critical: 0, high: 1, medium: 2, low: 3 };

/** Escapes text for HTML element content and quoted attributes. */
export function esc(v) {
  return String(v ?? '').replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' })[c]);
}

// A relative href: each path segment percent-encoded, then the whole thing attribute-escaped.
const href = (rel) => esc(rel.split('/').map(encodeURIComponent).join('/'));

// A finding is closed only when its fix is applied AND a recheck proved it; anything else is open.
const isOpen = (f) => f.verdict !== 'rejected' && !(f.fix?.status === 'applied' && f.fix?.recheck?.result === 'pass');

const CSS = `
:root{--bg:#fbfaf7;--fg:#1c1b19;--muted:#5f5b53;--line:#dedad1;--card:#fff;--warn-bg:#fff4e0;--warn-fg:#6b3d00;
--critical:#b3141b;--high:#c2410c;--medium:#a16207;--low:#3f6212;--nv:#4338ca;--rej:#6b7280;--ok:#15803d}
@media (prefers-color-scheme:dark){:root{--bg:#141412;--fg:#ecebe6;--muted:#a8a49a;--line:#34322d;--card:#1d1c1a;--warn-bg:#3a2a10;--warn-fg:#ffd9a0;
--critical:#ff6b6b;--high:#fb923c;--medium:#facc15;--low:#a3e635;--nv:#a5b4fc;--rej:#9ca3af;--ok:#4ade80}}
*{box-sizing:border-box}
body{margin:0;background:var(--bg);color:var(--fg);font:16px/1.55 system-ui,-apple-system,"Segoe UI",sans-serif}
main{max-width:920px;margin:0 auto;padding:24px 16px 64px}
h1{font-size:1.6rem;margin:0 0 4px}h2{font-size:1.25rem;margin:40px 0 12px;padding-top:8px;border-top:1px solid var(--line)}
h3{font-size:1.05rem;margin:0 0 8px}h4{font-size:.95rem;margin:16px 0 6px}
.muted{color:var(--muted)}code,pre{font:13px/1.45 ui-monospace,SFMono-Regular,Menlo,monospace}
pre{white-space:pre-wrap;word-break:break-word;background:var(--card);border:1px solid var(--line);border-radius:6px;padding:8px 10px;margin:0}
.warn{background:var(--warn-bg);color:var(--warn-fg);border-radius:8px;padding:12px 14px;font-weight:600}
.card{background:var(--card);border:1px solid var(--line);border-left:5px solid var(--rej);border-radius:8px;padding:14px 16px;margin:12px 0;overflow-wrap:anywhere}
.sev-critical{border-left-color:var(--critical)}.sev-high{border-left-color:var(--high)}.sev-medium{border-left-color:var(--medium)}.sev-low{border-left-color:var(--low)}.nv{border-left-color:var(--nv)}
.badge{display:inline-block;font-size:.75rem;font-weight:700;padding:1px 8px;border-radius:99px;border:1px solid currentColor;margin-right:6px;vertical-align:middle}
.b-critical{color:var(--critical)}.b-high{color:var(--high)}.b-medium{color:var(--medium)}.b-low{color:var(--low)}.b-nv{color:var(--nv)}.b-rej{color:var(--rej)}
.b-pass{color:var(--ok)}.b-fail{color:var(--critical)}
dl{display:grid;grid-template-columns:minmax(120px,max-content) 1fr;gap:4px 14px;margin:0}dt{color:var(--muted)}dd{margin:0}
@media (max-width:560px){dl{grid-template-columns:1fr}dd{margin-bottom:6px}}
ul,ol{margin:4px 0;padding-left:22px}
.tbl{overflow-x:auto}table{border-collapse:collapse;width:100%;font-size:.9rem}th,td{text-align:left;padding:6px 8px;border-bottom:1px solid var(--line);vertical-align:top}
tr.open td{background:var(--warn-bg);color:var(--warn-fg)}
.counts{display:flex;flex-wrap:wrap;gap:8px;margin:8px 0}.count{background:var(--card);border:1px solid var(--line);border-radius:8px;padding:8px 12px;min-width:110px}
.count b{display:block;font-size:1.4rem}
details>summary{cursor:pointer;font-weight:600;padding:6px 0}
a{color:inherit}
`;

/**
 * Validates `auditDir` and returns the report HTML. Throws (with every validation error in the
 * message) when the audit dir does not validate.
 */
export function render(auditDir, { lang = 'en' } = {}) {
  const t = T[lang];
  if (!t) throw new Error(`unknown --lang ${lang}; use en or es`);
  const r = validate(auditDir);
  if (!r.ok) throw new Error(`refusing to render: findings.json does not validate\n${r.errors.map((e) => `  ${e}`).join('\n')}`);
  const doc = r.data;
  const L = (v) => esc(t.labels[v] ?? v);
  const auditReal = realpathSync(auditDir);
  // Code locations link to the source file relative to the report, so they open next to it.
  const toProject = relative(auditReal, realpathSync(doc.run.project_root)).split(sep).join('/');

  const findings = doc.findings;
  const confirmed = findings.filter((f) => f.verdict === 'confirmed')
    .sort((a, b) => SEVERITY_RANK[a.severity] - SEVERITY_RANK[b.severity] || a.id.localeCompare(b.id));
  const nv = findings.filter((f) => f.verdict === 'needs_validation').sort((a, b) => a.id.localeCompare(b.id));
  const rejected = findings.filter((f) => f.verdict === 'rejected').sort((a, b) => a.id.localeCompare(b.id));

  const row = (k, v) => (v === undefined || v === null || v === '' ? '' : `<dt>${esc(k)}</dt><dd>${v}</dd>`);

  const card = (f) => {
    const cls = f.verdict === 'confirmed' ? `sev-${f.severity}` : f.verdict === 'needs_validation' ? 'nv' : '';
    const badge = f.verdict === 'confirmed'
      ? `<span class="badge b-${esc(f.severity)}">${L(f.severity)}</span>`
      : `<span class="badge ${f.verdict === 'rejected' ? 'b-rej' : 'b-nv'}">${L(f.verdict)}</span>`;
    const locs = (f.locations ?? []).map((l) => {
      if (l.resource) return `<li><code>${esc(l.resource)}</code></li>`;
      const span = l.line_start === l.line_end ? `${l.line_start}` : `${l.line_start}-${l.line_end}`;
      const link = toProject ? `${toProject}/${l.path}` : l.path;
      return `<li><a href="${href(link)}"><code>${esc(l.path)}:${esc(span)}</code></a></li>`;
    });
    const ev = (f.evidence ?? []).map((e) =>
      `<li><a href="${href(e.path)}"><code>${esc(e.path)}</code></a> <span class="muted">(${L(e.kind)})</span> — ${esc(e.summary)}</li>`);
    let fix = '';
    if (f.fix) {
      const rc = f.fix.recheck;
      const rcHtml = rc
        ? `<code>${esc(rc.command)}</code> → <span class="badge b-${esc(rc.result)}">${L(rc.result)}</span>${rc.artifact ? ` <a href="${href(rc.artifact)}">${esc(t.recheckArtifact)}</a>` : ''}`
        : '';
      fix = row(t.fix, esc(f.fix.proposal)) + row(t.fixStatus, L(f.fix.status))
        + (f.fix.rollback ? row(t.rollback, esc(f.fix.rollback)) : '') + row(t.recheck, rcHtml);
    }
    const steps = (f.manual_steps ?? []).length ? row(t.manualSteps, `<ol>${f.manual_steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`) : '';
    return `<article class="card ${cls}" id="${esc(f.id)}">
<h3>${badge}<code>${esc(f.id)}</code> ${esc(f.title)}</h3>
<dl>${row(t.who, esc(f.principal))}${row(t.boundary, esc(f.boundary))}${row(t.impact, esc(f.impact))}${row(t.class, esc(f.class))}${row(t.surface, L(f.surface) + (f.platform ? ` · ${esc(f.platform)}` : ''))}${locs.length ? row(t.locations, `<ul>${locs.join('')}</ul>`) : ''}${ev.length ? row(t.evidence, `<ul>${ev.join('')}</ul>`) : ''}${row(t.missing, f.missing_evidence ? esc(f.missing_evidence) : '')}${row(t.rejection, f.rejection_reason ? esc(f.rejection_reason) : '')}${fix}${steps}</dl>
</article>`;
  };

  const list = (arr) => (arr.length ? arr.map(card).join('\n') : `<p class="muted">${esc(t.none)}</p>`);
  const count = (label, n, cls = '') => `<div class="count ${cls}"><b>${n}</b>${label}</div>`;
  const table = (cols, rows) => `<div class="tbl"><table><thead><tr>${cols.map((c) => `<th>${esc(c)}</th>`).join('')}</tr></thead><tbody>${rows.join('')}</tbody></table></div>`;

  // ---- sections, in the fixed order the contract names ----
  const how = `<section id="how-to-read"><h2>${esc(t.howTitle)}</h2>
<p class="warn">${esc(t.warning)}</p>
${t.how.map((p) => `<p>${p}</p>`).join('\n')}
</section>`;

  const run = doc.run;
  const summary = `<section id="summary"><h2>${esc(t.summary)}</h2>
<dl>${row(t.runStatus, `<strong>${L(run.status)}</strong>`)}${row(t.partialReason, run.partial_reason ? esc(run.partial_reason) : '')}${row(t.profile, L(run.profile))}${row(t.started, esc(run.started_at))}${row(t.projectRoot, `<code>${esc(run.project_root)}</code>`)}</dl>
<h4>${esc(t.byVerdict)}</h4>
<div class="counts">${count(L('confirmed'), confirmed.length)}${count(L('needs_validation'), nv.length)}${count(L('rejected'), rejected.length)}</div>
<h4>${esc(t.bySeverity)}</h4>
<div class="counts">${['critical', 'high', 'medium', 'low'].map((s) => count(`<span class="b-${s}">${L(s)}</span>`, confirmed.filter((f) => f.severity === s).length)).join('')}</div>
<h4>${esc(t.scope)}</h4>
<pre>${esc(JSON.stringify(run.scope, null, 2))}</pre>
</section>`;

  const findingsHtml = `<section id="findings"><h2>${esc(t.findings)}</h2>
<h3>${esc(t.confirmedH)}</h3>
${list(confirmed)}
<h3>${esc(t.nvH)}</h3>
${list(nv)}
<h3>${esc(t.rejectedH)}</h3>
${rejected.length ? `<details><summary>${esc(t.rejectedSummary(rejected.length))}</summary>\n${list(rejected)}\n</details>` : `<p class="muted">${esc(t.none)}</p>`}
</section>`;

  const platforms = `<section id="platforms"><h2>${esc(t.platforms)}</h2>
${doc.platforms.length ? table(t.platformCols, doc.platforms.map((p) =>
    `<tr class="${p.status === 'reviewed' ? '' : 'open'}"><td>${esc(p.name)}</td><td>${esc(p.detected_by)}</td><td>${L(p.access)}</td><td>${L(p.status)}</td><td>${p.status === 'reviewed' ? `<code>${esc(p.tool_path)}</code>` : esc(p.reason)}</td></tr>`)) : `<p class="muted">${esc(t.none)}</p>`}
</section>`;

  const units = doc.coverage.units;
  const coverage = `<section id="coverage"><h2>${esc(t.coverage)}</h2>
<p>${esc(t.unitsDone(units.filter((u) => u.status === 'done').length, units.length))}</p>
${units.length ? table(t.unitCols, units.map((u) =>
    `<tr class="${u.status === 'done' ? '' : 'open'}"><td><code>${esc(u.id)}</code></td><td>${L(u.surface)}</td><td>${esc(u.area)}</td><td>${esc(u.boundary)}</td><td>${esc(u.class)}</td><td>${L(u.status)}</td><td>${esc(u.reason ?? '')}</td><td>${u.findings.map((id) => `<a href="#${esc(id)}">${esc(id)}</a>`).join(' ')}</td></tr>`)) : `<p class="muted">${esc(t.none)}</p>`}
</section>`;

  const actions = (doc.user_actions ?? []).map((a) => `<h4>${esc(a.title)}</h4><ol>${a.steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`);
  const manual = findings.filter((f) => isOpen(f) && (f.manual_steps ?? []).length)
    .map((f) => `<h4>${esc(t.fromFinding)} <a href="#${esc(f.id)}"><code>${esc(f.id)}</code></a> — ${esc(f.title)}</h4><ol>${f.manual_steps.map((s) => `<li>${esc(s)}</li>`).join('')}</ol>`);
  const steps = `<section id="your-steps"><h2>${esc(t.steps)}</h2>
${actions.length + manual.length ? [...actions, ...manual].join('\n') : `<p class="muted">${esc(t.nothingToDo)}</p>`}
</section>`;

  return `<!doctype html>
<html lang="${lang}">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<meta name="color-scheme" content="light dark">
<meta name="robots" content="noindex">
<title>${esc(t.title)} — ${esc(run.id)}</title>
<style>${CSS}</style>
</head>
<body>
<main>
<h1>${esc(t.title)}</h1>
<p class="muted"><code>${esc(run.id)}</code> · ${esc(run.started_at)} · ${L(run.status)}</p>
${how}
${summary}
${findingsHtml}
${platforms}
${coverage}
${steps}
</main>
</body>
</html>
`;
}

/** Renders and writes `<auditDir>/report.html` (mode 0600). Returns its absolute path. */
export function writeReport(auditDir, opts) {
  const html = render(auditDir, opts);
  const out = join(realpathSync(auditDir), 'report.html');
  // Never follow a planted symlink or overwrite something that is not a plain file.
  let st = null;
  try { st = lstatSync(out); } catch { /* not there yet */ }
  if (st && !st.isFile()) throw new Error(`refusing to write ${out}: it exists and is not a regular file`);
  // A hard link would make the write land in another file too (anywhere on the same volume).
  if (st && st.nlink > 1) throw new Error(`refusing to write ${out}: it has another hard link; delete it and render again`);
  // O_NOFOLLOW closes the gap between the check above and the open: a symlink planted in between
  // makes the open fail instead of writing through it.
  const { O_WRONLY, O_CREAT, O_TRUNC, O_NOFOLLOW } = constants;
  const fd = openSync(out, O_WRONLY | O_CREAT | O_TRUNC | (O_NOFOLLOW ?? 0), 0o600);
  try {
    fchmodSync(fd, 0o600); // the mode argument only applies on creation; an older report keeps its old mode otherwise
    const buf = Buffer.from(html, 'utf8');
    for (let off = 0; off < buf.length;) off += writeSync(fd, buf, off, buf.length - off);
  } finally {
    closeSync(fd);
  }
  return out;
}

// ---- CLI ----
function main(argv) {
  let dir = null;
  let lang = 'en';
  for (let i = 0; i < argv.length; i++) {
    if (argv[i] === '--lang') lang = argv[++i];
    else if (argv[i].startsWith('--lang=')) lang = argv[i].slice(7);
    else if (argv[i] === '-h' || argv[i] === '--help') dir = null;
    else dir = argv[i];
  }
  if (!dir || !T[lang]) {
    console.error('usage: render-report.mjs <audit-dir> [--lang en|es]');
    return 2;
  }
  try {
    const out = writeReport(resolve(dir), { lang });
    console.log(out);
    console.log(pathToFileURL(out).href);
    return 0;
  } catch (e) {
    console.error(e.message);
    return 1;
  }
}

const self = realpathSync(fileURLToPath(import.meta.url));
let invoked = '';
try { invoked = realpathSync(process.argv[1] || ''); } catch { /* imported, not run */ }
if (invoked === self) process.exitCode = main(process.argv.slice(2));
