---
name: angular
description: "Use when building, refactoring, or debugging Angular (v20/21+): standalone components, signals, zoneless change detection, @if/@for/@defer control flow, inject() DI, resource()/httpResource(), RxJS interop, NgRx SignalStore, ng CLI. NOT React (that is react), NOT Next.js (that is nextjs), NOT a TypeScript language question (that is typescript)."
tags: [angular, frontend, web, signals, typescript, spa]
recommends: [typescript, testing-web, secure-coding]
origin: risco
---

# Angular — Standalone, Signals, Zoneless (Angular 20/21+)

> Build Angular the way it ships in 2026: standalone components, signals as the reactivity model, zoneless change detection, built-in control flow, and `inject()` DI. Treat NgModules, `*ngFor`, and `@Input()` decorators as legacy you only touch to migrate.

## Not this skill

**AngularJS (1.x)** is out of scope entirely — this skill is Angular 2+ only and the APIs do not map.
Route elsewhere for **React** → `../react/SKILL.md`; **Next.js App Router** → `../nextjs/SKILL.md`;
**Vue/Nuxt, Svelte, SolidJS, Astro** → `../vue-nuxt/SKILL.md`, `../svelte/SKILL.md`,
`../solid-js/SKILL.md`, `../astro/SKILL.md`; a **pure TypeScript language question** (generics,
narrowing, tsconfig) with no Angular dimension → `../typescript/SKILL.md`; a **standalone NestJS
API** → `../nestjs/SKILL.md`; a generic Node service → `../nodejs/SKILL.md`; **cross-framework
Playwright e2e strategy** → `../testing-web/SKILL.md` / `../e2e-testing/SKILL.md`. Angular Universal
SSR and Angular's own `ng test` (Vitest) setup stay here.

## Decide first

| Situation | Do this | Why |
|-----------|---------|-----|
| Greenfield app / new feature | Zoneless + signals + standalone by default. `ng new` (Angular 21) already excludes Zone.js. | The defaults shipped stable in v20-v21; fight them and you write more code that the framework now does for you. |
| Brownfield NgModule + decorator app | Migrate incrementally with the schematics in `references/migration.md` (NgModule→standalone, control flow, decorator→signal inputs, Zone.js→zoneless, Karma→Vitest); do not rewrite. Keep Zone.js until you flip it on purpose. | A working app that uses `*ngIf` is not a bug. Churn introduces risk for no user value. |
| "View not updating" complaint | Jump to the change-detection section: signal not read in template, `OnPush` without a signal, or stale Zone.js assumption. | Zoneless means a mutation that no signal observes will never repaint — the fix is structural, not a `detectChanges()` call. |

## The modern baseline

No NgModules. Bootstrap a standalone root component and configure providers in `app.config.ts`.

```typescript
// main.ts
import { bootstrapApplication } from '@angular/platform-browser';
import { App } from './app/app';
import { appConfig } from './app/app.config';

bootstrapApplication(App, appConfig);
```

```typescript
// app/app.config.ts
import { ApplicationConfig, provideZonelessChangeDetection } from '@angular/core';
import { provideRouter } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { routes } from './app.routes';

export const appConfig: ApplicationConfig = {
  providers: [
    provideZonelessChangeDetection(), // no Zone.js; CD driven by signals + events
    provideRouter(routes),
    provideHttpClient(withFetch()),
  ],
};
```

- Rule: one `bootstrapApplication` call, providers in `app.config.ts`. Why: NgModule bootstrap (`platformBrowserDynamic().bootstrapModule(AppModule)`) is the legacy path — more files, slower to reason about.
- Rule: components are `standalone` by default (the `standalone` flag is implied in v20+; do not write `standalone: true` in new code, and never write `standalone: false`). Why: standalone is the framework default now; the flag is noise.

**Bad → Good**

```typescript
// Bad — NgModule wiring for a single component
@NgModule({ declarations: [UserCard], imports: [CommonModule], exports: [UserCard] })
export class UserCardModule {}

// Good — standalone component imports only what it uses
@Component({
  selector: 'app-user-card',
  imports: [DatePipe],
  template: `<p>{{ joined() | date }}</p>`,
})
export class UserCard {
  joined = input.required<Date>();
}
```

## Signals as the reactivity model

`signal()` holds state, `computed()` derives it, `effect()` runs side effects, `linkedSignal()` resets writable state when a source changes.

```typescript
import { signal, computed, effect, linkedSignal } from '@angular/core';

const qty = signal(1);
const price = signal(9.99);
const total = computed(() => qty() * price());        // derived — recomputes lazily
const draftQty = linkedSignal(() => qty());            // writable, resets when qty changes

effect(() => console.log('total changed:', total())); // side effect ONLY (logging, DOM, sync)
```

- Rule: derive with `computed()`, never with `effect()`. Why: an `effect()` that writes a signal to "compute" a value creates a hidden dependency graph that loops or fires extra times — `computed()` is pull-based and memoized.
- Rule: `effect()` is for side effects (logging, `localStorage`, imperative DOM, 3rd-party libs), not for keeping two signals in sync. Why: synced state belongs in `computed()` or `linkedSignal()`.

Component I/O is signal-based: `input()`, `input.required()`, `output()`, `model()` for two-way.

**Bad → Good**

```typescript
// Bad — decorator I/O, mutable, no type-safety on required
@Input() userId!: string;
@Output() saved = new EventEmitter<User>();

// Good — signal inputs/outputs
userId = input.required<string>();          // read as userId()
saved = output<User>();                     // emit with saved.emit(user)
name = model('');                           // two-way: [(name)]="..."
```

## Templates: built-in control flow

Use `@if` / `@for` / `@switch` / `@defer`. The legacy `*ngIf` / `*ngFor` / `*ngSwitch` structural directives are deprecated.

```html
@if (user(); as u) {
  <h1>{{ u.name }}</h1>
} @else {
  <app-spinner />
}

@for (item of items(); track item.id) {
  <li>{{ item.label }}</li>
} @empty {
  <li>No items</li>
}

@defer (on viewport) {
  <app-heavy-chart [data]="rows()" />
} @placeholder {
  <div class="skeleton"></div>
}
```

- Rule: every `@for` **must** declare `track`. Why: it is required syntax (the template won't compile without it) and it controls DOM reuse — `track item.id` over `track $index` when items have stable identity, or the DOM thrashes on reorder.
- Rule: reach for `@defer` to lazy-load heavy sub-trees and enable incremental hydration. Why: it ships less JS up front without manual `loadComponent` plumbing.

**Bad → Good**

```html
<!-- Bad — legacy structural directive, no tracking -->
<li *ngFor="let item of items">{{ item.label }}</li>

<!-- Good — built-in control flow with track -->
@for (item of items(); track item.id) { <li>{{ item.label }}</li> }
```

## Data fetching

Default to signal-based resources; reach for `HttpClient` + RxJS only when you need streams, cancellation, or operator composition.

```typescript
import { httpResource } from '@angular/common/http';
import { resource } from '@angular/core';

// httpResource — declarative GET wired to HttpClient; reactive to its URL signal
users = httpResource<User[]>(() => `/api/users?team=${this.team()}`);
// template: @if (users.isLoading()) {…} @else { @for (u of users.value(); track u.id) {…} }
// users.error()  -> error signal;  users.reload() -> refetch

// resource — any async loader (not just HTTP)
profile = resource({
  params: () => ({ id: this.userId() }),
  loader: ({ params }) => fetchProfile(params.id),
});
```

- Rule: `httpResource()`/`resource()` give you `value()`, `isLoading()`, `error()`, `reload()` for free — prefer them over a manual `subscribe` that you have to clean up. Why: less boilerplate, no leak, refetches automatically when its source signals change.
- Rule: when you genuinely need a stream (websocket, debounced search, retry/switchMap), keep `HttpClient` + RxJS and bridge to a signal with `toSignal()`. Why: signals are not streams; do not fake backpressure with effects. `references/signals-rxjs.md` has the signals-vs-RxJS decision matrix, `toSignal`/`toObservable` interop recipes, `effect` pitfalls (infinite loops, untracked reads), and `takeUntilDestroyed`.

## DI & services

```typescript
@Injectable({ providedIn: 'root' })
export class UserApi {
  private http = inject(HttpClient);          // field initializer — no constructor needed
  list = () => this.http.get<User[]>('/api/users');
}
```

- Rule: inject with `inject()`, not constructor parameters. Why: `inject()` works in field initializers and composes into plain functions (guards, factories); constructor DI is the legacy ergonomic.
- Rule: `providedIn: 'root'` for app-wide singletons. Why: tree-shakable — unused services drop from the bundle.
- Rule: HTTP cross-cutting concerns are functional interceptors: `provideHttpClient(withInterceptors([authInterceptor]))`. Why: class interceptors with `HTTP_INTERCEPTORS` are the older multi-provider pattern.

## Routing

```typescript
// app.routes.ts
export const routes: Routes = [
  { path: 'users', loadComponent: () => import('./users/users-list').then(m => m.UsersList) },
  { path: 'users/:id', loadComponent: () => import('./users/user-detail').then(m => m.UserDetail),
    canActivate: [authGuard] },
];

export const authGuard: CanActivateFn = () => inject(AuthService).isLoggedIn();
```

Enable route-bound signal inputs with `withComponentInputBinding()` in `provideRouter`, then read route params as signal inputs:

```typescript
provideRouter(routes, withComponentInputBinding());
// in UserDetail: id = input.required<string>();  // bound from the :id segment
```

- Rule: lazy-load routes with `loadComponent` (or `loadChildren` with a routes array). Why: smaller initial bundle, no NgModule needed.
- Rule: guards/resolvers are functions (`CanActivateFn`, `ResolveFn`) using `inject()`. Why: class-based guards are deprecated.

## State

- Local/feature state → a signal service (`@Injectable` holding `signal`/`computed`). Simple, no library.
- App-wide state → **NgRx SignalStore** (`signalStore`, `withState`, `withComputed`, `withMethods`, `withProps`) — signals-native, pairs cleanly with `resource()`.

```typescript
export const CartStore = signalStore(
  { providedIn: 'root' },
  withState({ items: [] as Item[] }),
  withComputed(({ items }) => ({ count: computed(() => items().length) })),
  withMethods((store) => ({ add: (i: Item) => patchState(store, s => ({ items: [...s.items, i] })) })),
);
```

- Note: **Signal Forms** is experimental (prototype since Angular 21.0.0-next.2). For production forms use reactive/typed forms (`FormGroup`/`FormControl` with typed values). Why: do not ship a prototype API to users.

## CLI workflow

```bash
ng new my-app                  # Angular 21: zoneless + standalone + Vitest by default
ng generate component user-card # standalone by default; no --standalone flag needed
ng generate service user-api
ng build                       # production build
ng test                        # Vitest (default runner in v21; Karma is deprecated)
ng update @angular/core @angular/cli  # version bumps + automated migrations
```

## Testing

Use Vitest + `TestBed`. Provide zoneless CD in tests and set signal inputs via `componentRef`.

```typescript
import { TestBed } from '@angular/core/testing';
import { provideZonelessChangeDetection } from '@angular/core';

it('renders the user name', async () => {
  TestBed.configureTestingModule({
    providers: [provideZonelessChangeDetection()],
  });
  const fixture = TestBed.createComponent(UserCard);
  fixture.componentRef.setInput('joined', new Date('2026-01-01'));
  await fixture.whenStable();                       // not detectChanges() — let CD settle
  expect(fixture.nativeElement.textContent).toContain('2026');
});
```

- Rule: set signal inputs with `fixture.componentRef.setInput('name', value)`, never by poking the instance field. Why: `setInput` flows through the input pipeline and marks the view dirty.
- Rule: prefer `await fixture.whenStable()` over manual `detectChanges()` loops under zoneless. Why: it waits for the scheduler to flush instead of forcing a single synchronous pass.

## Anti-patterns

| Bad | Why it's wrong | Good |
|-----|----------------|------|
| `@NgModule` in new code | Standalone is the default; modules add ceremony and slow analysis | Standalone component with an `imports: []` array |
| `*ngIf` / `*ngFor` / `*ngSwitch` | Legacy structural directives; deprecated | `@if` / `@for (… ; track id)` / `@switch` |
| `@Input()` / `@Output()` decorators | No required-input safety, not signal-reactive | `input()` / `input.required()` / `output()` / `model()` |
| `effect(() => this.total.set(a()*b()))` | Effect-to-derive-state loops and double-fires | `total = computed(() => a()*b())` |
| `@for` without `track` | Won't compile; if forced, DOM thrashes on reorder | `track item.id` (stable identity) |
| `subscribe()` in a component with no teardown | Memory leak; runs after the view is destroyed | `toSignal()` or `takeUntilDestroyed()` |
| `ChangeDetectorRef.detectChanges()` to "fix" a stale view | Masks the real cause under zoneless | Read the value through a signal so CD tracks it |
| Nested `subscribe()` inside `subscribe()` | Callback pyramid, lost cancellation | `switchMap`/`concatMap`, one subscription |
| Constructor DI only (`constructor(private x: X)`) | Legacy ergonomic; can't compose into functions | `private x = inject(X)` |

`scripts/verify.sh` is a heuristic copy-banlist lint — it greps your Angular sources for the banned patterns above. It is a hint, not a compiler.
