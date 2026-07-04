# Input System (new) — setup, patterns, migration

Package: `com.unity.inputsystem`. Enabled by default in Unity 6. Device-agnostic, event-driven,
supports rebinding, composites, local multiplayer, and touch. Reference: Unity Input System package
manual.

## Project mode

`Edit → Project Settings → Player → Active Input Handling`:
- **Input System Package (New)** — legacy `Input.*` calls throw. Recommended for new projects.
- **Both** — new + legacy coexist (migration only; avoid mixing per-feature).
- **Input Manager (Old)** — legacy only. Do not target for new work.

Unity 6 also has **Project-wide Actions** (`Edit → Project Settings → Input System Package`): a default
`InputActionAsset` shared across the whole project, reachable via `InputSystem.actions`.

## Anatomy

- **Input Action Asset** (`.inputactions`): the container. Enable "Generate C# Class" in its importer to
  get a strongly-typed wrapper (e.g. `InputSystem_Actions`).
- **Action Map**: a group of actions active together — e.g. "Player", "UI", "Vehicle". Enable/disable
  maps to switch context (`_controls.Player.Disable(); _controls.UI.Enable();`).
- **Action**: a named input with a **type**:
  - *Value* (continuous, e.g. `Vector2` Move) — `performed` fires on change, `ReadValue<T>()`.
  - *Button* (Jump, Fire) — `started` / `performed` / `canceled` phases.
  - *Pass-Through* (raw device, every event).
- **Binding**: the physical control → action. **Composite** bindings combine controls, e.g. a "2D Vector"
  composite maps W/A/S/D to a single `Vector2`. **Control schemes** group bindings per device set
  (Keyboard&Mouse, Gamepad).

## Three ways to consume input

### 1. Generated C# class (recommended for a single player)

```csharp
using UnityEngine.InputSystem;

public sealed class PlayerController : MonoBehaviour
{
    InputSystem_Actions _controls;
    Vector2 _move;

    void Awake() => _controls = new InputSystem_Actions();
    void OnEnable()
    {
        _controls.Player.Enable();
        _controls.Player.Move.performed += OnMove;
        _controls.Player.Move.canceled  += OnMove;
        _controls.Player.Jump.performed += _ => Jump();
    }
    void OnDisable()
    {
        _controls.Player.Move.performed -= OnMove;
        _controls.Player.Move.canceled  -= OnMove;
        _controls.Player.Disable();
    }
    void OnDestroy() => _controls.Dispose();   // it owns native resources
    void OnMove(InputAction.CallbackContext ctx) => _move = ctx.ReadValue<Vector2>();
}
```

### 2. Polling (when event-driven feels heavy)

```csharp
Vector2 move = _controls.Player.Move.ReadValue<Vector2>();
bool jumped  = _controls.Player.Jump.WasPressedThisFrame();   // edge-triggered, read in Update
```

### 3. `PlayerInput` component (fastest wiring, local multiplayer)

Attach `PlayerInput`, assign the action asset, pick a **Behavior**:
- *Send Messages* / *Broadcast Messages* — calls `OnMove(InputValue)` etc. by name.
- *Invoke Unity Events* — wire in the Inspector.
- *Invoke C# Events* — subscribe in code.

For local co-op, `PlayerInputManager` spawns a `PlayerInput` per joined device, isolating each player's
action instance and pairing devices automatically.

## Rebinding at runtime

```csharp
var rebind = _controls.Player.Jump.PerformInteractiveRebinding()
    .WithControlsExcluding("Mouse")
    .OnComplete(op => { op.Dispose(); SaveBindings(); })
    .Start();
// Persist: string json = _controls.asset.SaveBindingOverridesAsJson();
// Restore: _controls.asset.LoadBindingOverridesFromJson(json);
```

## Migration from legacy

| Legacy | New Input System |
| --- | --- |
| `Input.GetAxis("Horizontal")` | Move action (Value/`Vector2`) → `ReadValue<Vector2>().x` |
| `Input.GetButtonDown("Jump")` | Jump action (Button) → `WasPressedThisFrame()` or `performed` |
| `Input.GetKey(KeyCode.E)` | action bound to `<Keyboard>/e` → `IsPressed()` |
| `Input.mousePosition` | `Mouse.current.position.ReadValue()` |
| `Input.GetMouseButtonDown(0)` | `Mouse.current.leftButton.wasPressedThisFrame` |
| `Input.touchCount` / `Input.GetTouch` | `Touchscreen.current` / Enhanced Touch API |

Do not leave `Input.*` polling alongside new-system actions — in "New" mode the legacy calls throw, and
in "Both" mode you double-handle the same physical input.
