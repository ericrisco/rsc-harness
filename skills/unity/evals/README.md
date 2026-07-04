# unity evals

These cases assert the skill fires on Unity/C# engine work (MonoBehaviour lifecycle, prefabs,
ScriptableObjects, scenes, the new Input System, coroutines/async/Awaitable, Addressables, builds) and
that it defers correctly: pathfinding→gamedev-pathing, shaders→gamedev-shaders, netcode→gamedev-multiplayer,
Godot→godot, Unreal→unreal. Capability cases check current Unity 6 patterns (physics in FixedUpdate with
Rigidbody.MovePosition, new Input System over Input.GetAxis, Awaitable + destroyCancellationToken, no
double-await) rather than deprecated APIs.
