# Search algorithms & world representations

Depth for the "Search algorithms" and "Choosing a representation" sections of SKILL.md. Read this when
you are hand-rolling a search (a grid game, a custom graph, or a debugging session where the engine's
navmesh isn't enough).

## Representations in detail

### Uniform grid

Cells are nodes; neighbours are the adjacent cells. **4-connected** (N/E/S/W) gives Manhattan movement;
**8-connected** adds diagonals. On 8-connected grids, forbid *corner-cutting*: only allow a diagonal move
if both orthogonal neighbours are also walkable, or agents clip wall corners.

- Pros: trivial to build/edit, supports destructible/procedural terrain, weighted cells (mud=cost 3).
- Cons: node count explodes with resolution; raw paths look blocky and hug walls — smooth them (funnel).

### Waypoint graph

Hand- or tool-placed nodes with explicit edges. Agents path node-to-node, then steer between.

- Pros: tiny node count, full designer control (patrol loops, cover-to-cover, racing lines).
- Cons: movement is confined to edges; anything off-graph is invisible. Poor for large open spaces —
  an agent can't cut across a room the graph didn't anticipate.

### Navmesh

A set of convex polygons covering the walkable surface. Search runs over the polygon adjacency graph
(few, large nodes), then the **funnel algorithm** pulls a straight path through the polygon corridor.

- Pros: compact, natural any-angle paths, handles 3D height/slopes, one representation for a whole level.
- Cons: needs a bake step; representing fine dynamic change means re-baking or carving.

## A* — the workhorse

```text
function A*(start, goal, h):
    open   = min-heap keyed by f;  push start with g=0, f=h(start,goal)
    gScore = { start: 0 }
    came   = {}
    while open not empty:
        current = open.pop()                  # lowest f
        if current == goal: return reconstruct(came, current)
        for (nbr, stepCost) in neighbours(current):
            tentative = gScore[current] + stepCost
            if tentative < gScore.get(nbr, +inf):
                came[nbr]   = current
                gScore[nbr] = tentative
                f = tentative + h(nbr, goal)
                open.push_or_decrease(nbr, f)
    return NO_PATH                              # goal unreachable
```

`f(n) = g(n) + h(n)`: `g` is known cost from start, `h` is the estimated cost to goal.

- Use a **binary heap** (or pairing heap) for the open set — a linear scan is the classic "A* is slow" bug.
- Track a closed/visited set (or the `gScore` map above) so nodes aren't re-expanded needlessly.
- `neighbours` returns `(node, stepCost)`; diagonal step cost is `√2` (~1.414), not 1.

### Heuristics & admissibility

- **Admissible**: `h(n)` never *over*-estimates the true remaining cost ⇒ A* returns the optimal path.
- **Consistent (monotone)**: `h(n) ≤ stepCost(n,m) + h(m)` for every edge ⇒ no node is ever re-opened
  (strictly stronger than admissible). Standard grid/navmesh heuristics below are both.
- Match `h` to the movement:
  - 4-connected grid → **Manhattan** `|dx|+|dy|`.
  - 8-connected grid → **octile** `max(dx,dy) + (√2−1)·min(dx,dy)`.
  - any-angle / navmesh → **Euclidean** `√(dx²+dy²)`.
- **Tie-breaking**: many nodes share the same `f`, giving ugly wandering paths. Break ties toward lower
  `h`, or nudge `h` up by a tiny factor (`h *= 1.0 + ε`) so the search leans goalward. This trades strict
  optimality for straighter, faster searches — usually worth it.

### Weighted / greedy A*

`f = g + w·h` with `w > 1` inflates the heuristic: fewer expansions, path at most `w×` optimal. Good when
frame budget beats perfection. `w → ∞` degenerates to **greedy best-first** (fast, often ugly, not optimal).

## Dijkstra

A* with `h = 0`: expands uniformly outward by cost. Reach for it when:

- There is **no single target** — find the nearest of several exits/items in one search.
- You need the **whole cost field** from a source (the basis of flow fields — see steering reference).

Slower than A* to one goal because it explores in all directions. **BFS** is the unweighted special case
(all step costs equal) — fine for simple grids, but Dijkstra/A* generalize to terrain costs.

## JPS (Jump Point Search)

An A* accelerator for **uniform-cost grids only** (every walkable cell same cost). It exploits grid
symmetry: instead of expanding every cell, it "jumps" in a straight line until it hits a *jump point* (a
cell with a forced neighbour caused by an obstacle). Often 10×+ fewer node expansions with the **same
optimal** result, and it stores fewer nodes.

- Requires a uniform-cost, 8-connected grid; **not** applicable to weighted terrain or navmeshes.
- Pairs well with JPS+ / precomputed jump distances for static maps.

## Hierarchical / HPA*

For very large maps where a single flat A* misses the frame budget:

1. Partition the map into **clusters** (e.g. 10×10 tiles).
2. Precompute **entrances** between adjacent clusters and intra-cluster distances (an abstract graph).
3. Search the small abstract graph cluster-to-cluster, then refine each segment with a local A* only
   when/where the agent actually reaches it.

Trades a little path optimality for a large speedup and enables **path caching** and streaming. Reach for
it at thousands-of-tiles scale, or when many agents share long routes.

## Any-angle paths (Theta*)

Grid A* paths bend only at 45°/90°. **Theta\*** relaxes this: when expanding, if the parent has
line-of-sight to the neighbour, it links directly to the parent instead of the current cell — yielding
straight, any-angle paths without a separate smoothing pass. Cheaper alternative: run grid A* then smooth.

## Path smoothing — the funnel (string-pulling)

Raw grid/navmesh paths waste motion. Two fixes:

- **Line-of-sight smoothing** (grids): walk the path; if node `i` has clear LoS to node `i+2`, drop `i+1`.
  Repeat. Removes staircase kinks cheaply.
- **Funnel algorithm** (navmesh): given the polygon corridor, pull a taut string through the shared
  edges (portals), advancing left/right apexes — produces the shortest path inside the corridor. This is
  what quality navmesh systems run after the polygon search; emulate it if you build your own.

## Choosing quickly

| Situation | Pick |
| --- | --- |
| Free-roaming characters, 3D or open 2D | Navmesh + A* over polys + funnel |
| Tile-locked / destructible / RTS grid | Grid + A* (or JPS if uniform cost) |
| Constrained routes, patrols, rails | Waypoint graph + A* |
| Nearest of many goals / cost field | Dijkstra |
| Thousands of tiles, long shared routes | HPA* / hierarchical |
| Many agents → one goal | Flow field (steering reference) |
