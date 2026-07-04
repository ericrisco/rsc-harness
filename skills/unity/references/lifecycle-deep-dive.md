# MonoBehaviour lifecycle — deep dive (Unity 6)

Full execution order for a `MonoBehaviour`, and the exact reason each callback exists. Reference:
Unity Manual "Order of execution for event functions".

## Initialization (once per object, in this order)

1. **`Awake`** — called when the script instance is loaded, **even if the component is disabled**, and
   before any `Start`. Cache `GetComponent`/`TryGetComponent`, allocate internal state. Do NOT reach
   into *other* objects here — their `Awake` may not have run yet.
2. **`OnEnable`** — every time the object/component becomes enabled (including re-enable). Subscribe to
   C# events, register with managers, enable input actions. Must be mirrored by `OnDisable`.
3. **`Start`** — once, just before the first `Update`, and **only if the component is active**. Safe
   place for cross-object wiring because every object's `Awake` has already run. If an object is created
   disabled and never enabled, `Start` never runs.

Across a scene: all `Awake`s run, then all `OnEnable`s, then all `Start`s — so `Start` is your
"everyone exists now" hook.

## Physics loop (`FixedUpdate`) — 0..n times per frame

- Runs on a fixed timestep (`Time.fixedDeltaTime`, default 0.02s = 50 Hz). May run zero times (high FPS)
  or several times (low FPS) per rendered frame.
- **All `Rigidbody` work goes here:** `AddForce`, `MovePosition`, `MoveRotation`, velocity changes.
  Setting `transform.position` directly on a physics body fights the solver → jitter/tunneling.
- Do NOT read edge-triggered input here (`WasPressedThisFrame`) — you'll miss events. Read in `Update`,
  store the intent, consume it in `FixedUpdate`.
- Collision/trigger callbacks (`OnCollisionEnter`, `OnTriggerEnter`, and their `Stay`/`Exit`, plus 2D
  variants) fire from the physics step.

## Game logic loop (per frame)

4. **`Update`** — once per rendered frame. Input, timers, non-physics movement, state machines.
   Frame-rate independent movement multiplies by `Time.deltaTime`.
5. **`LateUpdate`** — after every `Update` in the scene has run. Camera follow, look-at, IK, procedural
   bone adjustments — anything that must read the *final* positions of objects that moved this frame.

## Rendering-adjacent (advanced)

- `OnPreCull`, `OnBecameVisible`/`OnBecameInvisible`, `OnWillRenderObject`, `OnRenderImage` (Built-in RP;
  URP/HDRP use `RenderPipelineManager` callbacks / render features instead).
- `OnDrawGizmos` / `OnDrawGizmosSelected` — Editor scene-view debug drawing only.
- `OnGUI` — legacy IMGUI, called multiple times per frame; editor tooling only, never runtime gameplay.

## Teardown

6. **`OnDisable`** — when the object/component disables (and just before `OnDestroy`). Unsubscribe from
   everything subscribed in `OnEnable`, disable input actions, stop coroutines you own. A missing
   unsubscribe here is the #1 cause of leaks and "handler fired twice after re-enable".
7. **`OnDestroy`** — once, when the object is destroyed (or scene unloads / app quits). Release native
   handles, dispose `IDisposable`s (`NativeArray`, `InputActionAsset` you `new`ed), final cleanup.
8. **`OnApplicationQuit`** / `OnApplicationPause` / `OnApplicationFocus` — app-level lifecycle for
   save-on-quit and mobile pause handling.

## Coroutine yield timing (where a coroutine resumes)

| `yield return` | Resumes |
| --- | --- |
| `null` | next frame, after `Update` |
| `new WaitForSeconds(t)` | after `t` scaled seconds (affected by `Time.timeScale`) |
| `new WaitForSecondsRealtime(t)` | after `t` real seconds (ignores `timeScale`) |
| `new WaitForFixedUpdate()` | after the next physics step |
| `new WaitForEndOfFrame()` | after rendering, before present (good for screen capture) |
| `new WaitUntil(() => cond)` / `WaitWhile(...)` | when the predicate flips |
| another `IEnumerator` | when the nested coroutine completes |

Gotcha: `new WaitForSeconds(t)` allocates every call — cache the instance if you yield it in a loop, or
switch to `Awaitable.WaitForSecondsAsync`.

## Script execution order

If object A must initialize before object B, don't rely on scene order — set it in
`Project Settings → Script Execution Order`, or better, express the dependency explicitly (have B pull
what it needs in its own `Start`, or use an explicit init call). `[DefaultExecutionOrder(n)]` sets it
per-class in code.
