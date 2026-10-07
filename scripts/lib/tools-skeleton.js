import { existsSync, lstatSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

// The `01-TOOLS/` scaffolding rsc writes on onboarding, in ONE place: what `ensureHarnessSkeleton`
// copies is exactly what `purge` may take back, and it may take back only a file still identical to
// what was copied. `01-TOOLS/` is the layer the user edits when adding tools, so anything that
// differs from the template is theirs and stays.

const LIB_DIR = dirname(fileURLToPath(import.meta.url));
export const TEMPLATE_SOURCE = join(LIB_DIR, '..', '..', 'skills', 'harness', 'assets', '_TEMPLATE');

// Los ficheros que la plantilla trae hoy. Se lee del asset en vez de codificar una lista, para que
// añadir un fichero a la plantilla no deje el suelo comprobando de menos en silencio.
//
// Un error aquí NO se convierte en lista vacía. Comérselo dejaba el suelo permanentemente
// insatisfacible, con un mensaje que ofrecía una acción que leía ese mismo asset ausente y que por
// tanto no podía arreglarlo nunca — y sin nombrar jamás la causa real, que es un paquete roto.
export function templateAssets() {
  return readdirSync(TEMPLATE_SOURCE).sort();
}

// npm NUNCA empaqueta un fichero llamado `.gitignore`, así que el asset viaja sin punto y se copia
// con él. Sin esto, desde el paquete publicado se copiaban 4 de 5 ficheros y el que faltaba era el
// único que evita comitear el `.env` que el README —copiado por el propio instalador— manda crear.
const DOTTED = { gitignore: '.gitignore' };
export const targetName = (asset) => DOTTED[asset] ?? asset;

// La capa entera, no cada proveedor: el flujo documentado es copiar `_TEMPLATE/` a
// `01-TOOLS/<PROVEEDOR>/`, y depender de que cada copia se lleve su propia protección es depender
// de que nadie se salte un paso con credenciales de por medio.
export const LAYER_IGNORE = ['# Escrito por rsc: la capa de herramientas guarda credenciales.',
  '*/.env', '*/.env.*', '!*/.env.example', '*/keys/', '*/out/', ''].join('\n');

const sameBytes = (a, b) => {
  try { return readFileSync(a).equals(Buffer.isBuffer(b) ? b : readFileSync(b)); } catch { return false; }
};
const isPlainFile = (p) => { try { return lstatSync(p).isFile(); } catch { return false; } };

/**
 * Take back the scaffolding rsc wrote, file by file, only where it is still byte-identical to what
 * rsc wrote. Returns `{ removed, kept }` as paths relative to `cwd`, `kept` with a reason. Empty
 * directories left behind are removed by the caller's directory sweep.
 */
export function removeUnmodifiedSkeleton(cwd, { dryRun = false } = {}) {
  const removed = [];
  const kept = [];
  const templateDir = join(cwd, '01-TOOLS', '_TEMPLATE');
  if (existsSync(templateDir) && !lstatSync(templateDir).isSymbolicLink()) {
    for (const asset of templateAssets()) {
      const rel = `01-TOOLS/_TEMPLATE/${targetName(asset)}`;
      const file = join(cwd, rel);
      if (!existsSync(file)) continue;
      if (isPlainFile(file) && sameBytes(file, join(TEMPLATE_SOURCE, asset))) {
        if (!dryRun) rmSync(file, { force: true });
        removed.push(rel);
      } else kept.push({ path: rel, reason: 'changed since rsc wrote it — yours now' });
    }
  }
  const layer = join(cwd, '01-TOOLS', '.gitignore');
  if (existsSync(layer)) {
    if (isPlainFile(layer) && sameBytes(layer, Buffer.from(LAYER_IGNORE))) {
      if (!dryRun) rmSync(layer, { force: true });
      removed.push('01-TOOLS/.gitignore');
    } else kept.push({ path: '01-TOOLS/.gitignore', reason: 'changed since rsc wrote it — yours now' });
  }
  return { removed, kept };
}
