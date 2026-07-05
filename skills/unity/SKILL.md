---
name: unity
description: "Use when writing, reviewing, or structuring Unity game code in C# for current Unity 6 LTS (6000.x) — GameObjects and Transform hierarchy, MonoBehaviour lifecycle, prefabs and prefab variants, ScriptableObjects for data, scenes and additive loading, the new Input System, coroutines vs async/await/Awaitable, Addressables, and build/player settings for 2D and 3D. Triggers: 'my Unity script', 'Awake vs Start', 'why is my physics jittery', MonoBehaviour .cs files, 'set up the new Input System', 'ScriptableObject config', 'load a scene additively', 'Instantiate a prefab', 'convert Input.GetAxis to the new system', 'build for Android/WebGL', 'por qué no se llama mi Start', 'com carrego una escena en additiu'. NOT Godot/GDScript (that is godot); NOT Unreal/Blueprint/C++ engine work (that is unreal); NOT the netcode wire protocol itself (that is gamedev-multiplayer)."
tags: [unity, csharp, game-dev, monobehaviour, input-system]
recommends: [gamedev-multiplayer, gamedev-physics, gamedev-shaders, gamedev-pathing, gamedev-shipping, godot, unreal]
profiles: [full]
origin: risco
---

# Unity + C# (Unity 6 LTS)

> Idiomatic C# for the current Unity engine — 2D and 3D. Owns engine-side patterns (components,
> lifecycle, prefabs, scenes, data, input, async, builds). Not Godot (`godot`) or Unreal (`unreal`);
> stops at the netcode wire (`gamedev-multiplayer`).

## Version contract — read first

**Target: Unity 6 LTS, versioned `6000.x`.** Current LTS at authoring is **Unity 6.3 LTS (`6000.3`)**
(supported to Dec 2027); **Unity 6.0 LTS (`6000.0`)** to Oct 2026. Unity 6 dropped the year-based names
(2020/2021/2022 LTS) for the `6000.x` scheme. Confirm the project version in
`ProjectSettings/ProjectVersion.txt` before assuming an API exists.

**Ban-list — never emit these; use the modern replacement:**

| Deprecated / removed | Use instead |
| --- | --- |
| `Input.GetAxis` / `GetKey` / `GetButton` (legacy Input Manager) | **new Input System** (`com.unity.inputsystem`): `InputActionAsset` / `InputAction` / `PlayerInput` — §6 |
| `UnityEngine.Networking` (UNet), `NetworkServer`/`NetworkClient`, its `NetworkBehaviour` | **removed** since 2022.2. → **Netcode for GameObjects** (`com.unity.netcode.gameobjects`) + `gamedev-multiplayer` |
| `Resources.Load(...)` for game content | **Addressables** (`com.unity.addressables`) — §8 |
| `FindObjectOfType<T>()` / `FindObjectsOfType<T>()` | `FindFirstObjectByType<T>()` / `FindAnyObjectByType<T>()` / `FindObjectsByType<T>(FindObjectsSortMode.None)` (old ones obsolete since 2023.1) |
| `WWW` | `UnityWebRequest` |
| `OnGUI` / IMGUI for runtime game UI | **UI Toolkit** (runtime) or uGUI; keep IMGUI for editor tools only |
| Setting `transform.position` on a `Rigidbody` in `Update` | `Rigidbody.MovePosition/MoveRotation` in `FixedUpdate` — §4 |
| `GameObject.Find`/`FindWithTag` by string in `Update` | cache the ref in `Awake`, or `[SerializeField]` it |

Prefer the new Input System even for single-player prototypes. Keep `Debug.Log` out of hot loops and
strip it from ships.

## 1. GameObject / Component model & Transform hierarchy

A **GameObject** is an empty container; behaviour comes from **Components** you attach
(`Transform`, `Rigidbody`, `MeshRenderer`, and your `MonoBehaviour` scripts). Every GameObject has
exactly one `Transform` (or `RectTransform` under a Canvas) giving position/rotation/scale.

- Get components: `TryGetComponent(out var rb)` (no-alloc, preferred), `GetComponent<T>()`,
  `GetComponentInChildren/InParent<T>()`. Cache in `Awake` — `GetComponent` in `Update` is a perf sink.
- Hierarchy: `transform.parent`, `transform.SetParent(newParent, worldPositionStays: true)`,
  `transform.childCount`, `foreach (Transform child in transform)`. Child world = parent × local.
- Same object model for 2D and 3D: 2D uses `Rigidbody2D`/`Collider2D`/`SpriteRenderer`; 3D uses
  `Rigidbody`/`Collider`/`MeshRenderer`. Never mix 2D and 3D physics components on one body.

```csharp
[RequireComponent(typeof(Rigidbody))]
public sealed class Mover : MonoBehaviour
{
    Rigidbody _rb;
    void Awake() => _rb = GetComponent<Rigidbody>(); // cache once
}
```

## 2. Prefabs & prefab variants; instantiation

A **Prefab** is a reusable GameObject template (an asset). A **Prefab Variant** inherits from a base
prefab and overrides selected properties/children — like subclassing for assets (e.g. `Enemy` base →
`EnemyFast` variant). Edit the base and variants inherit the change unless they override that value.

- Spawn with `Instantiate(prefab, position, rotation, parent)`; it returns the concrete type
  (`var e = Instantiate(_enemyPrefab);` with `[SerializeField] Enemy _enemyPrefab;`). Store the
  serialized reference; do not `Resources.Load` it.
- Destroy with `Destroy(gameObject)` (end of frame) or `Destroy(obj, delay)`. Never `DestroyImmediate`
  at runtime. For frequently spawned objects (bullets, VFX) **pool** them (`UnityEngine.Pool.ObjectPool<T>`)
  instead of Instantiate/Destroy churn.
- Editor-only prefab authoring uses `PrefabUtility` (wrap in `#if UNITY_EDITOR`); absent in builds.

## 3. Scenes & scene management (additive loading)

A **Scene** holds a set of GameObjects. Register scenes in **Build Profiles → Scene List** (Unity 6;
formerly Build Settings) so they can load by index or name.

```csharp
using UnityEngine.SceneManagement;

// Additive: keep the current scene, layer another on top (e.g. UI, a level chunk).
var op = SceneManager.LoadSceneAsync("Level_02", LoadSceneMode.Additive);
op.completed += _ => Debug.Log("Level_02 loaded");
await op; // Unity 6: AsyncOperation is awaitable

// Unload just that scene later:
await SceneManager.UnloadSceneAsync("Level_02");
```

- `LoadSceneMode.Single` (default) unloads everything first; `Additive` composes scenes — the basis of
  streaming worlds, persistent manager scenes, and separate UI scenes.
- `SceneManager.MoveGameObjectToScene` moves an object between loaded scenes; `DontDestroyOnLoad` objects
  survive `Single` loads (use for a bootstrap/services scene). Prefer `LoadSceneAsync` to avoid a hitch.

## 4. MonoBehaviour lifecycle

Order per frame and where each concern belongs (full ordering in `references/lifecycle-deep-dive.md`):

| Method | When | Put here |
| --- | --- | --- |
| `Awake` | once, on instantiation (even if disabled) | cache `GetComponent`, self-init, no cross-object refs |
| `OnEnable` | each time the object/component enables | subscribe to events, register callbacks |
| `Start` | once, before first `Update`, only if active | cross-object wiring (other objects' `Awake` has run) |
| `FixedUpdate` | fixed timestep (physics tick), 0..n / frame | **all physics** — `Rigidbody` forces/`MovePosition`, `ApplyForce` |
| `Update` | every frame | input reads, game logic, timers (scale by `Time.deltaTime`) |
| `LateUpdate` | every frame, after all `Update` | camera follow, look-at, anything tracking moved objects |
| `OnDisable` | each disable / before destroy | **unsubscribe** everything subscribed in `OnEnable` |
| `OnDestroy` | once, on destruction | release native/unmanaged resources, final cleanup |

Rules that bite:
- **Physics goes in `FixedUpdate`**, never `Update`. Reading input in `FixedUpdate` drops events —
  read input in `Update`, cache intent, apply forces in `FixedUpdate`.
- Frame-rate independence: multiply per-frame movement by `Time.deltaTime` (`Update`) — but
  `FixedUpdate` already runs at a fixed `Time.fixedDeltaTime`.
- `Awake` runs even on inactive objects; `Start` does not run until the object is active. Cross-object
  references belong in `Start`, not `Awake`.
- Every `OnEnable` subscription needs a matching `OnDisable` unsubscription or you leak and get
  double-fires after re-enable.

## 5. ScriptableObjects for data/config; serialization

A **ScriptableObject** is a data asset that lives outside any scene — ideal for config, tuning tables,
enemy/item definitions, and event channels. One asset is shared by reference (no per-instance copy),
so it saves memory and lets designers tweak values without touching code.

```csharp
[CreateAssetMenu(fileName = "WeaponDef", menuName = "Game/Weapon Definition")]
public sealed class WeaponDefinition : ScriptableObject
{
    [SerializeField] float _damage = 10f;
    [SerializeField] float _fireRate = 2f;
    public float Damage => _damage;      // expose read-only
    public float FireRate => _fireRate;
}
```

**`[SerializeField] private` vs `public`:** default to `[SerializeField] private` + a public
property/method. It shows in the Inspector and survives serialization *without* letting arbitrary code
mutate the field — encapsulation intact. Use bare `public` only for genuine data bags.

**Serialization rules (they trip everyone):**
- Unity serializes: `public` or `[SerializeField]` fields of supported types (primitives, `string`,
  Unity types, enums, arrays/`List<T>` of those, and `[Serializable]` plain classes/structs).
- Unity does **not** serialize: properties (use `[field: SerializeField] public float X { get; private set; }`),
  `static`, `readonly`, `const`, `Dictionary<,>` (use two lists or a serializable wrapper), or
  polymorphic references — for interface/abstract fields use `[SerializeReference]`.
- Do not hold runtime mutable state on a shared ScriptableObject expecting it to reset — it persists in
  the Editor between play sessions. Keep SOs for config; put mutable per-instance state on MonoBehaviours.

## 6. Input System (new) — with a legacy contrast

The new Input System (`com.unity.inputsystem`) is enabled by default in Unity 6 and is device-agnostic
and event-driven. Define an **Input Action Asset** with **Action Maps** (e.g. "Player", "UI") and
**Actions** (e.g. "Move" = Value/`Vector2`, "Jump" = Button). Generate a C# wrapper or use the
`PlayerInput` component. Full setup, `PlayerInput`, and rebinding in `references/input-system.md`.

```csharp
// New Input System — subscribe to the generated actions (no per-frame polling).
using UnityEngine.InputSystem;

public sealed class PlayerController : MonoBehaviour
{
    InputSystem_Actions _controls;   // generated C# class from the .inputactions asset
    Vector2 _move;

    void Awake() => _controls = new InputSystem_Actions();
    void OnEnable()
    {
        _controls.Player.Enable();
        _controls.Player.Move.performed += ctx => _move = ctx.ReadValue<Vector2>();
        _controls.Player.Move.canceled  += _  => _move = Vector2.zero;
        _controls.Player.Jump.performed += _  => Jump();
    }
    void OnDisable() => _controls.Player.Disable();
}
```

Legacy contrast (do not write this in new code):
```csharp
// LEGACY Input Manager — string axes, per-frame polling, device-blind. Avoid.
float x = Input.GetAxis("Horizontal");
if (Input.GetButtonDown("Jump")) Jump();
```
The new system also polls if you prefer: `_controls.Player.Move.ReadValue<Vector2>()` in `Update`.

## 7. Coroutines vs async/await vs Awaitable

| Use | Reach for | Why |
| --- | --- | --- |
| Frame-sequenced gameplay (timers, tweens, "wait then spawn") | **Coroutine** or **Awaitable** | frame-aware yields; auto-tie to object lifetime |
| Unity-native async in Unity 6 (default for new async gameplay) | **`Awaitable`** | main-thread, low-alloc (pooled), frame + thread awaits, cancels via `destroyCancellationToken` |
| True background CPU work / library `Task` APIs | **`async Task` + `await`** | thread pool; but marshal back — Unity APIs are main-thread only |

```csharp
// Coroutine — classic, MonoBehaviour-bound, stops when the object disables/destroys.
IEnumerator SpawnWave()
{
    yield return new WaitForSeconds(1f);
    Instantiate(_enemyPrefab);
}
void Start() => StartCoroutine(SpawnWave());

// Awaitable (Unity 6) — the modern replacement. Cancels automatically on destroy.
async Awaitable SpawnWaveAsync()
{
    await Awaitable.WaitForSecondsAsync(1f, destroyCancellationToken);
    await Awaitable.NextFrameAsync(destroyCancellationToken);
    Instantiate(_enemyPrefab);
}
```

Rules:
- **Coroutines** run only while the MonoBehaviour is enabled; they die silently on disable. No return
  value; exceptions across `yield` are awkward.
- **`Awaitable`**: never `await` the same instance twice (pooled → undefined behavior). Pass
  `destroyCancellationToken` so it stops when the object is destroyed. Switch threads with
  `Awaitable.BackgroundThreadAsync()` / `Awaitable.MainThreadAsync()`.
- **`Task`**: does *not* auto-cancel on destroy — thread a `CancellationToken` yourself, and never touch
  Unity API off the main thread (it throws). Prefer `Awaitable` in Unity 6 unless you need `Task`.

## 8. Addressables (intro) + the Resources anti-pattern

**Addressables** (`com.unity.addressables`) is the modern content-loading system: assets get string
addresses, load asynchronously, and can ship in the build or from a remote CDN with dependency tracking
and memory-managed release.

```csharp
using UnityEngine.AddressableAssets;

var handle = Addressables.InstantiateAsync("Prefabs/Boss");
GameObject boss = await handle.Task;      // or handle.Completed += ...
// when done: Addressables.ReleaseInstance(boss);  // release to free memory
```

**`Resources/` is an anti-pattern for game content:** everything under it is forced into the build,
loaded synchronously, bloats size/startup, and can't be patched or streamed. Reserve it for tiny
always-needed defaults; migrate real content to Addressables.

## 9. Build settings, platforms & player settings

- **Build Profiles** (Unity 6, `File → Build Profiles`) supersede the old Build Settings window: per-platform
  scene list, target platform, and overridable player settings.
- **Scripting backend:** **IL2CPP** (AOT — required for iOS/consoles/WebGL, faster, harder to reverse)
  vs **Mono** (JIT, Editor/desktop, faster iteration). Set per platform in Player Settings.
- **Player Settings:** product/company name, bundle identifier, icons, orientation, API compatibility
  level (`.NET Standard 2.1` default), managed stripping. **2D vs 3D** is a template choice, not a
  different build path.
- WebGL/mobile specifics and the shipping checklist: `references/build-and-platforms.md` + `gamedev-shipping`.

## Guardrails / gotchas

- `==`/`!= null` on a destroyed `UnityEngine.Object` works (overloaded), but `?.` and cached refs treat
  a destroyed object as non-null. Re-check with `if (obj)` after possible destruction.
- Don't mix input systems: with `PlayerInput`, don't also `Input.GetKey` — in "New" mode legacy calls throw.
- One `Rigidbody` per body (child colliders fine); non-uniform scale breaks physics bodies.
- Coroutines/`InvokeRepeating` stop on `SetActive(false)`; async `Task`s keep running unless cancelled.
- No allocation (`new`, LINQ, boxing) in `Update`/`FixedUpdate` hot paths.

## Related skills

- `gamedev-multiplayer` — networking/netcode (Netcode for GameObjects); this skill hands off the wire.
- `gamedev-physics` — deep physics tuning (joints, solver, determinism) beyond "put it in FixedUpdate".
- `gamedev-shaders` — Shader Graph / HLSL, URP/HDRP materials and rendering.
- `gamedev-pathing` — NavMesh, agents, steering, path solving.
- `gamedev-shipping` — store builds, signing, size budgets, platform certification.
- `godot` / `unreal` — the other engines; route Godot/GDScript and Unreal/Blueprint/C++ there.

## Checklist

- [ ] Confirmed the project's Unity version (`ProjectVersion.txt`); no year-based-LTS assumptions.
- [ ] No banned API emitted (`Input.GetAxis`, `UnityEngine.Networking`, `Resources.Load` for content,
      `FindObjectOfType`, `WWW`, runtime `OnGUI`).
- [ ] `GetComponent` results cached in `Awake`; no string `Find` in `Update`.
- [ ] Physics in `FixedUpdate`; input read in `Update`; camera/tracking in `LateUpdate`.
- [ ] Every `OnEnable` subscription has a matching `OnDisable` unsubscription.
- [ ] `[SerializeField] private` + property used instead of bare `public` where encapsulation matters.
- [ ] New Input System used (actions/maps), not legacy polling; systems not mixed.
- [ ] Async uses `Awaitable` (or coroutine) with `destroyCancellationToken`; no double-await.
- [ ] Content via Addressables, not `Resources/`.
- [ ] Scenes registered in Build Profiles; async/additive loading where it avoids a hitch.
