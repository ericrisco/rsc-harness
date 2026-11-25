# Build & monorepo config

Field-by-field tsconfig, project references, resolution matrix, running TypeScript 7 next to
JS-API tools, and declaration publishing. All targets TypeScript 7 (`typescript` 7.0.2,
binary `tsc`). Read the section you need.

## tsconfig fields that earn their place

| Field | Set to | Why |
| --- | --- | --- |
| `strict` | `true` | Turns on the whole family (`noImplicitAny`, `strictNullChecks`, `strictFunctionTypes`, …). Default in TS 7; write it anyway. |
| `noUncheckedIndexedAccess` | `true` | `arr[i]` / `rec[k]` become `T \| undefined` — the runtime truth. |
| `verbatimModuleSyntax` | `true` | Forces explicit `import type`; never emits a type-only import as a runtime `require`; blocks `export default` in CJS-emitted modules. |
| `isolatedModules` | `true` | Guarantees each file transpiles standalone, so esbuild/swc/babel are safe. |
| `skipLibCheck` | `true` | Skips type-checking `node_modules` `.d.ts` — large build-time win, negligible risk. |
| `resolveJsonModule` | `true` | Import `*.json` with inferred types. |
| `moduleDetection` | `force` | Treats every file as a module (no accidental global scripts). |
| `rootDir` | `"./src"` | Defaults to the tsconfig's folder; without it, `outDir` mirrors `src/` as `dist/src/`. |
| `types` | `["node", …]` | Defaults to `[]`: no `@types/*` global is visible until listed. `["*"]` loads them all (slower, rarely right). |
| `noUncheckedSideEffectImports` | `true` (default) | `import "./x.css"` must resolve; declare the module (`declare module "*.css";`) when a bundler handles it. |
| `erasableSyntaxOnly` | `true` (Node type stripping) | Rejects `enum`, `namespace`, parameter properties — syntax that cannot be erased. |
| `noEmit` | `true` (apps) | A bundler emits; `tsc` only type-checks. Libraries set it `false` to emit `.d.ts`. |
| `composite` | `true` (referenced pkgs) | Required for project references; enables incremental `.tsbuildinfo`. |

## bundler vs nodenext matrix

| | `moduleResolution: "bundler"` | `moduleResolution: "nodenext"` |
| --- | --- | --- |
| Pair `module` with | `"preserve"` (also `"esnext"`, `"commonjs"`) | `"nodenext"` |
| Who runs the output | a bundler (Vite, esbuild, webpack, Next) | Node directly |
| Relative import extension | omit (`import "./util"`) | required (`import "./util.js"`) |
| `package.json` `exports`/`imports` | resolved | resolved |
| Conditional exports honored | yes | yes (per CJS/ESM condition) |
| Path aliases | resolved at type-check; bundler must mirror them | resolved at type-check; Node needs `imports`/loader to mirror |
| Choose when | app/library bundled before it ships | library/script Node executes as-is |

Rule of thumb: if anything bundles the code before it runs, use `bundler`. If Node loads the
`.js` directly, use `nodenext` and write the `.js` extension on relative imports. Under
`nodenext`, `package.json` `"type": "module"` makes `.ts` files ESM; without it they are CJS.
`node10`/`node` and `classic` resolution do not exist in TypeScript 7.

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
    "composite": true,
    "types": ["node"]
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

- Build the whole graph in dependency order: `tsc -b`. It caches per package via
  `.tsbuildinfo` and only rebuilds what changed. TypeScript 7 builds independent projects
  concurrently (`--builders <n>`) and type-checks each with `--checkers <n>` (default 4);
  `--singleThreaded` turns both off. Lower them when CI runners are short on memory.
- Each referenced package needs `composite: true` and must emit declarations.
- A package may only import from packages it lists under `references`; TS enforces the boundary,
  which kills accidental cross-package coupling.

## Path aliases — and the reality check

```jsonc
{
  "compilerOptions": {
    "paths": { "@core/*": ["./packages/core/src/*"] }
  }
}
```

`paths` entries resolve relative to the tsconfig that declares them; `baseUrl` does not exist
in TypeScript 7 (TS5102). A legacy catch-all `baseUrl: "./src"` becomes
`"paths": { "*": ["./src/*"] }`.

`paths` only rewrites types for the **type-checker**. The runtime/bundler must mirror it:
Vite (`resolve.alias`), Node (`package.json` `imports` with the `#`-prefix subpath convention),
or a runtime resolver. Aliases that the bundler does not mirror compile fine and crash at
runtime — prefer `package.json` `imports` (`"#core/*"`, or `"#/*": "./dist/*"`) when Node runs
the code, since Node resolves those natively and TypeScript follows them under `nodenext` and
`bundler`.

## TypeScript 7 in practice

`npm i -D typescript` installs the native compiler; the binary is `tsc` and it takes the same
flags as before. Platform binaries arrive as optional dependencies
(`@typescript/typescript-<os>-<arch>`), so a lockfile generated on one OS must keep those
optional entries for CI on another.

```bash
npm i -D typescript@^7
npx tsc -v                 # Version 7.x
npx tsc --noEmit           # check one project
npx tsc -b                 # build a project-references graph
npx tsc -b --builders 2 --checkers 2   # cap parallelism on a small runner
```

**What 7.0 does not have: a programmatic API.** Anything that does `require("typescript")` for
the compiler or language-service API keeps using 6.0. The compatibility package
`@typescript/typescript6` ships the 6.0 API and a `tsc6` binary. Two setups:

```jsonc
// A. Tools import "typescript" (typescript-eslint, template tooling): alias it to 6.0,
//    and install 7 under another name for the real `tsc`.
{
  "devDependencies": {
    "typescript": "npm:@typescript/typescript6@^6.0.2",
    "@typescript/native": "npm:typescript@^7.0.2"
  }
}
```

```jsonc
// B. Only the CLI matters: plain typescript 7, plus 6.0 for the one tool that needs it.
{
  "devDependencies": {
    "typescript": "^7.0.2",
    "@typescript/typescript6": "^6.0.2"
  }
}
```

Check after install which `tsc` the scripts resolve (`npx tsc -v`); in setup A, `npx tsc`
must print 7.x and `npx tsc6 -v` 6.0.x.

**Editors.** The language service runs over LSP. In VS Code, the TypeScript Native Preview
extension (`TypeScriptTeam.native-preview`) provides it, with commands to enable or disable the
TypeScript 7 language server per workspace. Embedded-language tooling (Vue, Svelte, Astro,
MDX, Angular templates) still drives 6.0; Angular projects check with `tsc` 7 on the CLI and
keep 6.0 in the editor.

**Migrating a 5.x project.** Upgrade to 6.0 first and clear every deprecation without
`ignoreDeprecations`; turn on `stableTypeOrdering` to surface the type-ordering differences
(it slows 6.0 checks by up to 25%, so use it for the migration only). Then switch to 7: a
clean 6.0 build compiles identically. `ignoreDeprecations: "6.0"` does not rescue removed
options on 7. The experimental `ts5to6` codemod rewrites `baseUrl` and `rootDir`. Field-level
replacements are in the SKILL body's "Coming from 5.x" table.

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
- TypeScript 7 orders types deterministically
  (`stableTypeOrdering` is always on), so emitted `.d.ts` stays stable across runs.
- Validate the published surface with a tool like `@arethetypeswrong/cli` before release.

## Running TS without a build

- `tsx file.ts` — fast esbuild-based runner for scripts and dev (replaces `ts-node`).
- Node's built-in type stripping runs `.ts` by erasing types (`node file.ts` on current Node;
  older lines need `--experimental-strip-types`); no type-checking. Pair it with
  `erasableSyntaxOnly: true` and `verbatimModuleSyntax: true` so only erasable syntax compiles.
- Both *execute*; neither *checks*. Always keep `tsc --noEmit` (or `tsc -b`) in CI.
