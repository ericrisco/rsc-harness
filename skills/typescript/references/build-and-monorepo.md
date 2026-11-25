# Build & monorepo config

Field-by-field tsconfig, project references, resolution matrix, `tsgo`/TS7 adoption, and
declaration publishing. All targets TypeScript 5.9. Read the section you need.

## tsconfig fields that earn their place

| Field | Set to | Why |
| --- | --- | --- |
| `strict` | `true` | Turns on the whole family (`noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, …). Non-negotiable. |
| `noUncheckedIndexedAccess` | `true` | `arr[i]` / `rec[k]` become `T \| undefined` — the runtime truth. |
| `verbatimModuleSyntax` | `true` | Forces explicit `import type`; never emits a type-only import as a runtime `require`; blocks `export default` in CJS-emitted modules. |
| `isolatedModules` | `true` | Guarantees each file transpiles standalone, so esbuild/swc/babel are safe. |
| `skipLibCheck` | `true` | Skips type-checking `node_modules` `.d.ts` — large build-time win, negligible risk. |
| `resolveJsonModule` | `true` | Import `*.json` with inferred types. |
| `moduleDetection` | `force` | Treats every file as a module (no accidental global scripts). |
| `noEmit` | `true` (apps) | A bundler emits; `tsc` only type-checks. Libraries set it `false` to emit `.d.ts`. |
| `composite` | `true` (referenced pkgs) | Required for project references; enables incremental `.tsbuildinfo`. |

## bundler vs nodenext matrix

| | `moduleResolution: "bundler"` | `moduleResolution: "nodenext"` |
| --- | --- | --- |
| Pair `module` with | `"esnext"` or `"preserve"` | `"nodenext"` |
| Who runs the output | a bundler (Vite, esbuild, webpack, Next) | Node directly |
| Relative import extension | omit (`import "./util"`) | required (`import "./util.js"`) |
| `package.json` `exports`/`imports` | resolved | resolved |
| Conditional exports honored | yes | yes (per CJS/ESM condition) |
| Path aliases | resolved at type-check; bundler must mirror them | resolved at type-check; Node needs `imports`/loader to mirror |
| Choose when | app/library bundled before it ships | library/script Node executes as-is |

Rule of thumb: if anything bundles the code before it runs, use `bundler`. If Node loads the
`.js` directly, use `nodenext` and write the `.js` extension on relative imports.

## Project references (the monorepo backbone)

Layout: one `tsconfig.base.json` at the root with the strict flags, then per-package configs.

```jsonc
// tsconfig.base.json
{
  "compilerOptions": {
    "strict": true,
    "noUncheckedIndexedAccess": true,
    "verbatimModuleSyntax": true,
    "isolatedModules": true,
    "skipLibCheck": true,
    "target": "esnext",
    "module": "nodenext",
    "moduleResolution": "nodenext",
    "declaration": true,
    "declarationMap": true,
    "composite": true
  }
}
```

```jsonc
// packages/app/tsconfig.json
{
  "extends": "../../tsconfig.base.json",
  "compilerOptions": { "rootDir": "src", "outDir": "dist" },
  "references": [{ "path": "../core" }, { "path": "../ui" }]
}
```

- Build the whole graph in dependency order: `tsc -b` (or `tsgo -b`). It caches per package via
  `.tsbuildinfo` and only rebuilds what changed.
- Each referenced package needs `composite: true` and must emit declarations.
- A package may only import from packages it lists under `references`; TS enforces the boundary,
  which kills accidental cross-package coupling.

## Path aliases — and the reality check

```jsonc
{
  "compilerOptions": {
    "baseUrl": ".",
    "paths": { "@core/*": ["packages/core/src/*"] }
  }
}
```

`paths` only rewrites types for the **type-checker**. The runtime/bundler must mirror it:
Vite (`resolve.alias`), Node (`package.json` `imports` with the `#`-prefix subpath convention),
or a runtime resolver. Aliases that the bundler does not mirror compile fine and crash at
runtime — prefer `package.json` `imports` (`"#core/*"`) when Node runs the code, since Node
resolves those natively.

## tsgo / TypeScript 7 adoption

The native (Go) compiler is in preview as `@typescript/native-preview`, ships the `tsgo`
binary, and type-checks ~10x faster (Microsoft's VS Code repo, 1.5M LOC: 89s -> 8.74s, 10.2x).

```bash
npm i -D @typescript/native-preview
npx tsgo --noEmit          # same flags as tsc
npx tsgo -b                 # build a project-references graph
```

Adoption steps:
1. Add it as a dev dependency; keep `typescript` (`tsc`) installed as the stable fallback.
2. Run `tsgo --noEmit` in CI for the speed win; if a diagnostic differs, fall back to `tsc` for
   that check and report it — the preview does not yet cover 100% of `tsc` behavior.
3. On a project whose `typescript` is 7.x, `tsc` is already the native compiler and the preview
   package is unnecessary; check `npx tsc -v` before adding it.

## Declaration emit & publishing a library

```jsonc
{
  "compilerOptions": {
    "declaration": true,        // emit .d.ts
    "declarationMap": true,     // .d.ts.map so go-to-def lands on source
    "outDir": "dist",
    "rootDir": "src"
  }
}
```

```jsonc
// package.json — modern dual/ESM publish
{
  "type": "module",
  "exports": {
    ".": { "types": "./dist/index.d.ts", "import": "./dist/index.js" }
  },
  "files": ["dist"]
}
```

- `types`/`typesVersions` must point at the emitted `.d.ts`; put `types` **first** in each
  `exports` condition so resolvers find it.
- For libraries, do not set `noEmit`; let `tsc -b` (or your bundler with dts plugin) emit.
- Validate the published surface with a tool like `@arethetypeswrong/cli` before release.

## Running TS without a build

- `tsx file.ts` — fast esbuild-based runner for scripts and dev (replaces `ts-node`).
- Node `--experimental-strip-types` (Node 22+) runs `.ts` by erasing types; no type-checking.
- Both *execute*; neither *checks*. Always keep `tsc --noEmit` (or `tsgo --noEmit`) in CI.
