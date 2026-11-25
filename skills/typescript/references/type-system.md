# Type-system deep dives

Recipes the SKILL body points to. All target TypeScript 7. Read the relevant section, not
the whole file.

## Conditional types + `infer`

`infer` introduces a type variable inside the `extends` clause and binds it to whatever
matched. It is how you destructure types positionally.

```ts
type ElementOf<T> = T extends readonly (infer U)[] ? U : never;
type Unwrap<T> = T extends Promise<infer U> ? Unwrap<U> : T; // recursive unwrap of nesting
type FirstArg<F> = F extends (a: infer A, ...rest: any[]) => any ? A : never;
```

Distributive conditional types: when the checked type is a *naked* type parameter and the
input is a union, the conditional distributes over each member. Wrap both sides in a tuple to
turn it off.

```ts
type ToArray<T> = T extends any ? T[] : never;
type A = ToArray<string | number>;   // string[] | number[]  (distributed)
type NonDist<T> = [T] extends [any] ? T[] : never;
type B = NonDist<string | number>;   // (string | number)[]  (not distributed)
```

## Mapped types: key remapping, modifiers

```ts
// Remap keys with `as` + template literals; filter by mapping to never.
type Getters<T> = { [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K] };
type RemoveId<T> = { [K in keyof T as K extends "id" ? never : K]: T[K] };

// Modifiers: + / - add or strip readonly and optional.
type Mutable<T>  = { -readonly [K in keyof T]: T[K] };
type Concrete<T> = { [K in keyof T]-?: T[K] }; // strip optionality
```

## Template-literal types

```ts
type Route = `/${string}`;                       // any path-ish string
type Method = "GET" | "POST" | "PUT" | "DELETE";
type Endpoint = `${Method} ${Route}`;            // "GET /users", ...
type CSSVar = `--${string}`;
// Inference inside templates:
type ParseId<T> = T extends `user_${infer N}` ? N : never; // ParseId<"user_42"> = "42"
```

`infer` over a template literal consumes whole code points:

```ts
type HeadTail<S> = S extends `${infer H}${infer R}` ? [H, R] : never;
type T = HeadTail<"😀abc">; // ["😀", "abc"], not half a surrogate pair
```

Character-counting utility types therefore count code points, not UTF-16 units (`"😀".length` is still `2` at runtime).

## Recursive types (with care)

Recursion is allowed but the depth is bounded by the instantiation-depth limit; deep tuple
recursion (e.g. length-N tuples) hits it fast. Prefer tail-recursive accumulator patterns.

```ts
type DeepReadonly<T> = T extends (infer U)[]
  ? readonly DeepReadonly<U>[]
  : T extends object
    ? { readonly [K in keyof T]: DeepReadonly<T[K]> }
    : T;
```

## Variance: `in` / `out` annotations

TS infers variance structurally; you can annotate it on type parameters to make intent
explicit and speed up checking on large generic types.

- **Covariant** (`out T`): T appears only in output position (return types, readonly props).
- **Contravariant** (`in T`): T appears only in input position (parameters).
- **Invariant** (`in out T`): both.

```ts
interface Consumer<in T> { consume(value: T): void; }     // contravariant
interface Producer<out T> { produce(): T; }               // covariant
```

Method parameters are checked **bivariantly** by default for legacy reasons;
`strictFunctionTypes` makes standalone function-type parameters strictly contravariant, but
**method** shorthand stays bivariant — prefer the `prop: (x: T) => U` arrow form when you
want strict checking.

## Branded / nominal patterns

Structural typing means two aliases of `string` are interchangeable. Brand to forbid mixing:

```ts
declare const brand: unique symbol;
type Brand<T, B> = T & { readonly [brand]: B };

type UserId = Brand<string, "UserId">;
type Cents  = Brand<number, "Cents">;

const userId = (s: string): UserId => s as UserId; // brand only after validation
function charge(amount: Cents) {}
// charge(100);            // error: number is not Cents
// charge(userId("u1"));   // error: UserId is not Cents
```

The brand exists only at the type level (zero runtime cost). Apply the cast in exactly one
validated constructor, never sprinkle `as UserId` across the codebase.

## Declaration merging

Interfaces with the same name merge; this is how you augment third-party or global types.

```ts
// Augment a module's types without forking it.
declare module "express" {
  interface Request { userId?: string; }
}
// Augment globals.
declare global {
  interface Window { __APP_VERSION__: string; }
}
export {}; // make this file a module so `declare global` is allowed
```

`type` aliases do **not** merge — only `interface` and `namespace` do. Write internal
namespaces with the `namespace` keyword; `module Foo {}` is an error (TS1540), while
`declare module "pkg"` for module augmentation is unchanged.

## Function overloads

Provide multiple call signatures, one implementation signature (which is not callable). Order
overloads most-specific first.

```ts
function toArray(x: string): string[];
function toArray(x: number): number[];
function toArray(x: string | number): (string | number)[] {
  return [x];
}
```

Prefer a single generic or a union return over overloads when the relationship is
expressible — overloads don't compose and don't infer across each other.

## Type predicates & assertion functions

```ts
// Type predicate: narrows the argument when it returns true.
function isString(x: unknown): x is string { return typeof x === "string"; }

// Assertion function: narrows by throwing otherwise (note the `asserts` keyword).
function assertDefined<T>(x: T): asserts x is NonNullable<T> {
  if (x == null) throw new Error("expected a value");
}

const v: string | undefined = maybe();
assertDefined(v);
v.toUpperCase(); // v is string here
```

TypeScript infers type predicates for simple filter callbacks, so
`arr.filter((x) => x != null)` narrows to `T[]` without a hand-written predicate in many
cases — but an explicit predicate is still clearer for non-trivial checks.

## `const` type parameters & `NoInfer`

```ts
function widen<const T>(x: T): T { return x; }         // keeps literals, no `as const`
function build<T>(items: T[], fallback: NoInfer<T>) {} // fallback can't drive inference of T
```
