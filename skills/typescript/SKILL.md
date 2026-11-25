---
name: typescript
description: "Use when writing or fixing TypeScript type code (.ts/.tsx/.d.ts), modeling data with generics/unions/branded types, diagnosing narrowing failures, or configuring tsconfig and the build toolchain. NOT runtime code, fs/streams/http (that is `nodejs`); NOT component/route typing (that is `react`/`nextjs`); NOT ORM type-gen (that is `drizzle-orm`)."
tags: [typescript, types, generics, tsconfig, type-safety]
recommends: [nodejs, security-audit, drizzle-orm]
origin: risco
---

# Idiomatic TypeScript types

Express data and contracts precisely in the TypeScript type system, and configure the
compiler so the types actually hold.

Written against **TypeScript 7** (`typescript` 7.0.2 on npm, the stable line since
2026-07-08): the native compiler written in Go, shipped by the `typescript` package as the
`tsc` binary. Full builds are typically 8-12x faster than 6.0 (VS Code's repo: 125.7s ->
10.6s), with parallel checking (`--checkers`, default 4) and parallel project builds
(`--builders`). TypeScript 7 turns every option deprecated in 6.0 into a hard error and ships
no programmatic API yet (that is planned for 7.1). Read the project's version first
(`npx tsc -v`); on a 5.x project, follow "Coming from 5.x" below before changing anything else.

## Boundary: language vs runtime vs framework

Three layers, three owners. **Language + compiler config lives here** — generics, narrowing,
`.d.ts`, `tsconfig`, and the build toolchain (`tsc`, the `tsc6` compatibility package, `tsx`,
resolution mode).
**Runtime behavior** (how a stream backpressures, how the event loop schedules) is `nodejs`.
**Framework idioms** (component props, route maps, server-component typing) are
`react`/`nextjs`/`nestjs` — those *borrow* this skill's type mechanics but own their wiring.
A `tsconfig` question is here; a "stream backpressure" question is `nodejs`; a "type my
`useReducer` state" question is `react`. Also delegate: ORM schema-to-type generation ->
`drizzle-orm` / `prisma-orm`; REST/contract shape design -> `api-design`; test runner and E2E
setup -> `testing-web` / `e2e-testing`; injection/authz review -> `security-audit`; Python
typing -> `python`; Go -> `go`.

## Decision rules

Apply these on every TypeScript edit:

1. **Prefer inference; annotate boundaries.** Let TS infer locals and returns; annotate
   function parameters, public APIs, and `.d.ts`. Why: redundant annotations drift from
   reality and suppress the better inferred type.
2. **`import type` for type-only imports**, with `verbatimModuleSyntax: true`. Why: it
   prevents emitting type-only imports as runtime `require`s and lets esbuild/swc transpile
   each file alone.
3. **Narrow, don't cast.** Reach for type guards, `in`, `typeof`, discriminant checks before
   `as`; when `as` is unavoidable, only `as <narrower>` or `as unknown as T` at a true I/O
   boundary. Why: `as` asserts a claim the compiler cannot verify — it is a silenced error,
   and `as` to a *wider* or unrelated type is almost always a real bug hidden.

## The type-system toolbox

### Generics + constraints, and `const` type parameters

Constrain type parameters so callers get errors at the call site, and use a `const` type
parameter to preserve literal inference without `as const` everywhere:

```ts
// Bad: unconstrained T, and the literal "a"|"b" widens to string.
function pick<T>(obj: T, key: string) { return (obj as any)[key]; }

// Good: K is constrained to obj's keys; const T keeps the literal union.
function pick<const T, K extends keyof T>(obj: T, key: K): T[K] {
  return obj[key];
}
const r = pick({ a: 1, b: "x" } as const, "b"); // r: "x", not string
```

### `unknown` over `any` at every boundary

`any` disables checking and silently poisons every downstream type it touches; `unknown`
forces a narrow before use.

```ts
// Bad: any flows everywhere, no error ever fires downstream.
function parse(json: string): any { return JSON.parse(json); }

// Good: unknown forces a narrow before the value is trusted.
function parse(json: string): unknown { return JSON.parse(json); }
const data = parse(input);
if (typeof data === "object" && data && "id" in data) { /* now narrowed */ }
```

### `satisfies` for config validation without widening

```ts
type Route = { path: string; method: "GET" | "POST" };

// Bad: annotation widens — routes.home.method is "GET" | "POST", and a typo in
// a key would only surface far away.
const a: Record<string, Route> = { home: { path: "/", method: "GET" } };

// Good: satisfies validates each entry AND keeps literal types.
const routes = {
  home: { path: "/", method: "GET" },
} satisfies Record<string, Route>;
routes.home.method; // "GET" (narrow), and "GE" would error right here
```

### Discriminated unions + exhaustive `never`

Model state as a discriminated union, not an optional-field bag:
`{ data?: T; error?: E; loading?: boolean }` permits `loading && error`; a literal discriminant
makes illegal states unrepresentable. That discriminant must be a **literal** type (not
`string`), and you must check it **before** destructuring — destructuring first throws away
the narrowing.

```ts
type State =
  | { status: "loading" }
  | { status: "ok"; data: string }
  | { status: "error"; message: string };

// Bad: destructured before the check — `data`/`message` are typed as the union.
function render({ status, data, message }: State) { /* no narrowing */ }

// Good: switch on the literal discriminant, exhaustive never guard at the end.
function render(s: State): string {
  switch (s.status) {
    case "loading": return "...";
    case "ok": return s.data;
    case "error": return s.message;
    default: { const _exhaustive: never = s; return _exhaustive; }
  }
}
```

Add a `"deleted"` member to `State` and the `default` branch fails to compile — that is the
point.

### Branded (nominal) types

TS is structural, so a `UserId` and a raw `string` are interchangeable unless you brand them:

```ts
type UserId = string & { readonly __brand: "UserId" };
const asUserId = (s: string): UserId => s as UserId; // brand only at the validated boundary
function load(id: UserId) { /* a bare string is now a compile error */ }
```

### Utility types cheat row

`Partial<T>` `Required<T>` `Readonly<T>` `Pick<T,K>` `Omit<T,K>` `Record<K,V>`
`Exclude<U,M>` `Extract<U,M>` `NonNullable<T>` `ReturnType<F>` `Parameters<F>`
`Awaited<T>` `NoInfer<T>` (blocks a type param from inferring at one site).

### Mapped / conditional / template-literal one-liners

```ts
type Mutable<T> = { -readonly [K in keyof T]: T[K] };          // strip readonly
type Nullable<T> = { [K in keyof T]: T[K] | null };            // mapped transform
type Unwrap<T> = T extends Promise<infer U> ? U : T;           // conditional + infer
type EventName<T extends string> = `on${Capitalize<T>}`;       // template literal
```

Deep recipes (recursive types, declaration merging, variance/`in`-`out`, assertion functions,
overloads) live in [references/type-system.md](references/type-system.md).

## tsconfig: strict base

TypeScript 7 already defaults `strict: true`, `module: esnext`, `target` to the newest
finished ES edition, `noUncheckedSideEffectImports: true`, `types: []` and `rootDir` to the
tsconfig's folder. Write the important ones anyway: an explicit base survives `extends`
chains and tells the reader what the project relies on. Copy-paste base; every package
`extends` it and overrides only paths/references:

```jsonc
{
  "compilerOptions": {
    "strict": true,                    // default in TS 7; keep it explicit
    "noUncheckedIndexedAccess": true,  // arr[i] / rec[k] are T | undefined
    "verbatimModuleSyntax": true,      // explicit import type; safe single-file transpile
    "isolatedModules": true,           // each file transpilable alone (esbuild/swc/babel)
    "skipLibCheck": true,              // don't type-check node_modules .d.ts (speed)
    "resolveJsonModule": true,         // import data.json with types
    "target": "esnext",
    "module": "nodenext",              // or "preserve"/"esnext" + "moduleResolution": "bundler"
    "moduleResolution": "nodenext",
    "moduleDetection": "force",
    "rootDir": "./src",                // default is the tsconfig folder; name src explicitly
    "types": ["node"],                 // default is []: list every @types package you use
    "noEmit": true                     // a bundler/tsc -b emits; the base just checks
  },
  "include": ["src"]
}
```

`types` defaulting to `[]` means globals from `@types/*` (`process`, `describe`, `Buffer`)
are not visible until listed; the error says "Cannot find name 'process'". Under `nodenext`
the nearest `package.json` decides ESM vs CJS: without `"type": "module"`, `.ts` files are
CommonJS and `verbatimModuleSyntax` rejects their `export` statements (TS1287).

### moduleResolution: bundler vs nodenext

| Aspect | `bundler` | `nodenext` |
| --- | --- | --- |
| Use when | Vite / Next / Remix / esbuild build the code | Code runs directly in Node (no bundler) |
| Relative import extensions | omit (`./util`) | required (`./util.js`) |
| `package.json` `exports`/`imports` | resolved | resolved |
| `module` setting | `preserve` (or `esnext`/`commonjs`) | `nodenext` |
| Emits runnable JS itself | no (the bundler does) | yes |

Pick `bundler` when a bundler owns resolution; pick `nodenext` for libraries and scripts
that Node executes directly. These are the only two modes to use: `node10`/`node` and
`classic` are removed in TypeScript 7. Field-by-field reference and the full matrix are in
[references/build-and-monorepo.md](references/build-and-monorepo.md).

## Monorepo & build

Use **project references** so packages type-check independently and in dependency order. A
shared `tsconfig.base.json` holds the strict flags; each package extends it, sets
`composite: true`, `outDir`/`rootDir`, and lists upstream packages under `references`. Build
the graph with `tsc -b`; TypeScript 7 builds independent projects in parallel (`--builders`)
and checks each with several checkers (`--checkers`, default 4; lower it on memory-tight CI,
or use `--singleThreaded`).

For declaration emit and publishing a library, set `declaration: true`,
`declarationMap: true`, and an `exports` map in `package.json`. Run scripts with `tsx` or
Node's type stripping instead of `ts-node`. Tools that import the `typescript` JS API
(typescript-eslint, Vue/Svelte/Astro/MDX/Angular template tooling, webpack loaders) need 6.0
alongside 7: install `@typescript/typescript6` (binary `tsc6`). Depth, build-order graph, path
aliases, and the side-by-side setup are in
[references/build-and-monorepo.md](references/build-and-monorepo.md).

## Coming from 5.x

TypeScript 6.0 is the bridge release: it deprecated what 7 removes. Code that compiles on 6.0
with no `ignoreDeprecations` and `stableTypeOrdering: true` compiles the same on 7. Migrate in
that order: 5.x -> 6.0 clean -> 7.

| In the old config | TypeScript 7 | Do instead |
| --- | --- | --- |
| `baseUrl` | removed (TS5102) | `paths` entries relative to the tsconfig (`"@core/*": ["./packages/core/src/*"]`) |
| `moduleResolution: node`/`node10`/`classic` | removed | `nodenext` (Node runs it) or `bundler` (a bundler runs it) |
| `module: amd`/`umd`/`system`/`none` | removed | `esnext`/`preserve`, or `nodenext` |
| `outFile` | removed | a bundler (esbuild, Rollup, Vite) |
| `target: es5`, `downlevelIteration` | removed | `target` es2015 or later; a bundler/Babel for older engines |
| `esModuleInterop`/`allowSyntheticDefaultImports: false` | cannot be `false` | delete the line; interop is always on |
| `alwaysStrict: false` | cannot be `false` | rename identifiers that strict mode reserves |
| `module Foo {}` namespace | error (TS1540) | `namespace Foo {}`; `declare module "pkg"` is fine |
| `import x from "./a.json" assert { type: "json" }` | error | `with { type: "json" }` |
| `tsc file.ts` beside a `tsconfig.json` | error (TS5112) | `tsc -p .`, or `--ignoreConfig` on purpose |
| relying on implicit `@types/*` globals | `types` defaults to `[]` | list them: `"types": ["node", "vitest/globals"]` |
| sources under `src/` with no `rootDir` | `rootDir` defaults to the tsconfig folder | `"rootDir": "./src"` |

`ignoreDeprecations: "6.0"` silences the deprecations on 6.0 only; TypeScript 7 still errors. The
experimental `ts5to6` codemod rewrites `baseUrl` and `rootDir`. In JS files checked via JSDoc,
TypeScript 7 drops Closure-era forms (`@enum`, `@class`, `function(string): void`, postfix
`!`, standalone `?`); write `typeof value` where a type is expected. Template-literal `infer`
splits strings by code point, so a string-length utility type built on UTF-16 halves changes.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
| --- | --- | --- |
| `any` as an escape hatch | disables all checking and spreads silently downstream | `unknown` + narrow, or a precise type / generic |
| `as` to silence "not assignable" | asserts a claim TS can't verify — hides the real bug | fix the type, or narrow with a guard/`in`/`typeof` |
| `enum` for a small fixed set | emits runtime code, awkward with `isolatedModules`, no literal subtyping | union of string literals (`"a" \| "b"`) + `as const` |
| Destructure before the discriminant check | narrowing is lost; fields become the full union | check `obj.kind` first, then read fields |
| Skipping `noUncheckedIndexedAccess` | `arr[i]`/`rec[k]` typed as `T` but are `undefined` at runtime | enable it; handle the `\| undefined` |
| `Function` / bare `object` / `{}` types | accept almost anything, no call-signature safety | a precise signature, or `Record<string, unknown>` |
| No exhaustive `never` guard on unions | a new union member compiles with a missing branch | `default: const _: never = x` in every switch |
| One giant `tsconfig` for a monorepo | can't express per-package targets; breaks references | `tsconfig.base.json` + per-package `extends` |
| `// @ts-ignore` | swallows the error even after the line is fixed, masking new ones | `// @ts-expect-error` (errors if the line later type-checks) |
| Default-importing in a CJS-emit file under `verbatimModuleSyntax` | blocked / wrong emit | use `export =`/named, or set the right `module` |
| `baseUrl`, `node10`, `outFile` or `ignoreDeprecations` in a TS 7 config | hard error, or a no-op that hides the real fix | the "Coming from 5.x" replacements |
| Forcing a JS-API tool onto `typescript` 7 | 7.0 ships no programmatic API, so the tool fails to load it | keep `@typescript/typescript6` for that tool, `tsc` 7 for checking |

## Project grounding

When working inside a real workspace, record this project's tsconfig and strictness choices
(resolution mode, which strict flags are on, the build tool) in the project wiki via
[../harness/SKILL.md](../harness/SKILL.md) — so the next session does not re-derive them.
