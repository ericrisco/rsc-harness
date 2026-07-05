# Navmesh workflow — baking, links, dynamic obstacles, per-engine

Depth for the "Navmesh workflow" section of SKILL.md. A navmesh is the walkable surface expressed as
convex polygons; search runs over polygon adjacency, and movement follows the corridor via the funnel
algorithm (see `search-algorithms.md`).

## Bake parameters (the knobs that matter)

Every engine bakes by voxelizing collision geometry and reconstructing walkable polys (Recast under the
hood in Unity and Unreal; Godot has its own baker). The parameters map closely across engines:

| Parameter | What it does | Getting it wrong |
| --- | --- | --- |
| **Agent radius** | Shrinks the mesh away from walls by this radius | Too small → agents clip walls / stick in doorways; too large → valid gaps vanish |
| **Agent height** | Min vertical clearance a poly must have | Agents path under geometry they can't fit beneath |
| **Max step / climb** | Tallest ledge treated as walkable (stairs, curbs) | Stairs become walls, or agents "climb" impossible ledges |
| **Max slope** | Steepest walkable incline (degrees) | Ramps drop out, or agents walk up cliffs |
| **Cell size / voxel size** | Bake resolution | Coarse → missing thin walkways; fine → slow bake, huge data |
| **Min region area** | Discards tiny isolated islands | Noise polys, or losing small legit platforms |

**One bake per agent size.** A large enemy and a small one need different radius/height; share a mesh
only if their footprints truly match. Unity/Unreal support multiple **agent types/profiles**; Godot uses
separate `NavigationMesh` resources or navigation layers.

## Regions, areas & costs

Tag surfaces with an **area type** carrying a traversal **cost multiplier** so paths *prefer* or *avoid*
terrain instead of it being all-or-nothing:

- Road = 0.5, grass = 1, mud = 4, water = 8 → agents naturally favour roads, cross mud only if shorter.
- Set an area's cost to *very high* rather than deleting it when you want "avoid unless no alternative".
- **Navigation layers / area masks** let different agents see different areas (e.g. only amphibious units
  path through water) by filtering which polygons a query considers.

## Off-mesh / nav links

Explicit connections where an agent can move but no polygon adjacency exists: jump-downs, ladders,
teleporters, ziplines, doorways between disconnected meshes.

- **Directional**: define both directions if the agent can traverse both ways (a fall-down link is often
  one-way). Give it a cost so pathing weighs it against walking around.
- The link only tells pathfinding the two ends connect — you still play the **traversal animation/motion**
  yourself when the agent reaches the link (jump arc, climb, teleport).
- Godot `NavigationLink2D/3D` · Unity `NavMeshLink` · Unreal `NavLinkProxy` (with smart-link events).

## Dynamic obstacles: three different tools

Do not confuse these — each solves a different problem:

1. **Carving obstacle** — cuts a hole in the navmesh so *global* paths route around a placed object
   (a dropped crate, a closed gate). Global and correct, but re-carving on every move is costly → use for
   **stationary / rarely-moving** props. Unity `NavMeshObstacle` (Carve on) · Godot `NavigationObstacle`
   (with vertices) · Unreal `NavModifierComponent` / `NavModifierVolume`.
2. **Local avoidance (RVO/ORCA)** — agents steer around each other and moving obstacles *without*
   touching the mesh, every frame. For **other agents** and small moving things. See `steering-and-avoidance.md`.
3. **Re-bake** — regenerate the mesh (or affected tiles) when the level geometry itself changes
   (destruction, procedural build). Prefer **tile/partial** rebake over full.

Rule of thumb: **moving agents → RVO; placed static blockers → carving; geometry changed → rebake.**

## Re-baking strategy

- **Static levels**: bake once at author time; ship the baked data. No runtime cost.
- **Occasional changes**: rebake the affected **tiles/region** only, ideally async/off the main thread.
- **Constant small changes** (a patrolling door): a carving obstacle beats rebaking.
- Full-map rebake every frame is never the answer — it is the "navmesh not updating, so I rebake
  constantly" anti-pattern.

## Per-engine baking specifics

### Godot 4.x

- `NavigationRegion2D/3D` holds a `NavigationMesh` (3D) / `NavigationPolygon` (2D). Bake in-editor, or at
  runtime with `region.bake_navigation_mesh()`.
- Source geometry: configure the `NavigationMesh` geometry parsing (parsed geometry type, collision mask,
  source group) so the baker knows which nodes to voxelize.
- Advanced/procedural: build a `NavigationMeshSourceGeometryData3D` and call
  `NavigationServer3D.bake_from_source_geometry_data(...)`, then assign to the region.
- Query directly: `NavigationServer3D.map_get_path(map, from, to, optimize, navigation_layers)`.
- Debug: enable **Visible Navigation** (Debug menu) to draw the mesh in-game.

### Unity (AI Navigation package, `com.unity.ai.navigation`)

- The legacy Navigation window / `Navigation Static` flag is deprecated. Add a **`NavMeshSurface`**
  component to a root object; set its **Collect Objects** (All / Children / by layer) and **Agent Type**,
  then **Bake**.
- Runtime: `surface.BuildNavMesh()` rebakes; combine with a data source for large worlds.
- `NavMeshModifier` overrides area/inclusion per-object; `NavMeshModifierVolume` does it by volume.
- Multiple agent sizes = multiple Agent Types (Navigation → Agents) + one surface each.
- Query without moving: `NavMesh.CalculatePath(from, to, areaMask, NavMeshPath)`; sample the mesh with
  `NavMesh.SamplePosition` to snap a point onto it.

### Unreal (UE5, `RecastNavMesh`)

- A **`NavMeshBoundsVolume`** defines where navigation is generated; a `RecastNavMesh-Default` actor
  appears (tune agent radius/height/step/slope in Project Settings → Navigation System / its details).
- **Runtime Generation** modes: **Static** (fastest, no runtime change), **Dynamic Modifiers Only**
  (can only *remove* nav via modifiers at runtime), **Dynamic** (any change, rebuilds affected tiles).
- The mesh is **tiled**; runtime edits rebuild only overlapping tiles. Spawned geometry must have
  collision + **Can Ever Affect Navigation** to influence it.
- `NavModifierVolume` + `NavArea` subclasses set cost/exclusion. Debug with the **`P`** key (Show
  Navigation) in PIE.

## Common failure modes

- **Empty path**: start or end is off the mesh, or the two are on disconnected islands. Snap both to the
  nearest polygon and test reachability before trusting the result.
- **Agents hug walls / stick in doors**: agent radius in the bake ≠ real collider radius.
- **Spawned wall ignored**: static bake — carve it, add a link, or switch to a dynamic/rebake mode.
- **Path exists but agent won't take a jump**: missing or wrong-direction off-mesh link.
