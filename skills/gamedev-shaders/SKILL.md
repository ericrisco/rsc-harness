---
name: gamedev-shaders
description: "Use when authoring or debugging a shader, material, VFX, or full-screen post-process in a game engine — Godot 4.x `.gdshader`, Unity 6 URP/HDRP, Unreal 5.x Materials, effect recipes, shader performance. NOT gameplay or engine-API code (that is `godot`/`unity`/`unreal`), NOT physics (`gamedev-physics`), NOT build variant stripping (`gamedev-shipping`)."
tags: [shaders, vfx, materials, post-processing, shadergraph]
recommends: [godot, unity, unreal, gamedev-shipping]
profiles: [full]
origin: risco
---

# Shaders & VFX (game engines)

Author shaders, materials, and full-screen effects across Godot, Unity, and Unreal. One
mental model — the GPU pipeline — mapped onto each engine's authoring surface, plus recipes
for the effects people actually ask for.

## Version contract — read first

Target the current stable line of each engine and never emit its retired APIs. If unsure a
symbol is current, say so rather than guess.

| Engine | Target | Never emit → use instead |
| --- | --- | --- |
| **Godot** | 4.x (4.4/4.5 stable) | `SCREEN_TEXTURE`/`DEPTH_TEXTURE`/`NORMAL_TEXTURE` built-ins → declare a `uniform sampler2D … : hint_screen_texture` / `hint_depth_texture` / `hint_normal_roughness_texture`. `hint_color`/`hint_albedo` → `source_color`. `hint_white`/`hint_black` → `hint_default_white`/`hint_default_black`. GLES2-era guides. |
| **Unity** | 6 (6000.x LTS), URP/HDRP | Surface shaders (`#pragma surface`) — Built-in-RP only, they do **not** compile under URP/HDRP. `CGPROGRAM`+`UnityCG.cginc`, `UnityObjectToClipPos`, `mul(UNITY_MATRIX_MVP, v)` → `HLSLPROGRAM` + URP `Core.hlsl` and `TransformObjectToHClip(posOS)`. `OnRenderImage`/`Graphics.Blit` post FX → URP Renderer Feature / Fullscreen Shader Graph. |
| **Unreal** | 5.x (5.4+) | `SceneTexture:PostProcessInput0` outside a Post Process material; Opacity without a translucent blend mode; Opacity Mask without a Masked blend mode. Prefer graph nodes; drop to a Custom HLSL node only for logic nodes can't express. |

`shader_type` tokens in Godot 4 are exact: `spatial`, `canvas_item` (underscore), `particles`
(plural), `sky`, `fog`.

## Shader fundamentals (the pipeline)

Every engine compiles your material into the same GPU stages. Two you write:

- **Vertex stage** — runs **once per vertex**. Transforms position into clip space and passes
  interpolated data (UVs, normals, custom `varying`s) down. Cheap; scales with mesh vertex count.
- **Rasterizer** (fixed) turns triangles into fragments and *interpolates* the vertex outputs.
- **Fragment / pixel stage** — runs **once per covered pixel** (× overdraw). Samples textures,
  does lighting, writes the final color. Expensive; scales with screen coverage.

**Per-vertex vs per-pixel is the core performance lever:** compute anything that interpolates
linearly (position offsets, un-normalized directions, scalar masks) in the vertex stage and pass
it as a `varying`; keep only what must be exact per-pixel (normalizing interpolated normals,
texture sampling, lighting, fresnel) in the fragment stage.

**UVs** are per-vertex 2D texture coordinates (0–1), interpolated across the face — you sample
textures and drive scrolling/tiling/masks with them. **Normals** are surface directions used for
lighting and rim; interpolated normals must be re-normalized per pixel. **Normal maps** store
directions in **tangent space** (unpack with `×2−1`); respect handedness.

**Coordinate spaces** — know which space each value is in before you do math on it:

| Space | Meaning | Typical use |
| --- | --- | --- |
| Object / model | mesh-local, origin at the pivot | authoring positions/normals start here |
| World | scene-global | world-space effects, triplanar, lighting |
| View / camera | relative to the camera | Godot spatial `NORMAL`/`VIEW` live here |
| Clip / NDC | post-projection homogeneous coords | the vertex stage's required output |
| Tangent | per-fragment surface basis (T,B,N) | normal maps are decoded here |
| Screen / UV | 0–1 across the framebuffer | post-process sampling (`SCREEN_UV`) |

## Per-engine authoring

### Godot 4.x

Godot ships its own GLSL-like language (`.gdshader`). Pick a `shader_type`, declare `uniform`s
(exposed as material parameters), pass data with `varying`, write `vertex()`/`fragment()`
(+`light()`). A **ShaderMaterial** binds the shader to a node and holds uniform values; set them
from code with `material.set_shader_parameter("name", value)`. Uniform hints: `source_color`
(sRGB→linear color pickers), `hint_range(a,b)`, `hint_default_white`, `hint_screen_texture`,
plus texture filters/repeats (`filter_linear_mipmap`, `repeat_enable`).

Small **canvas_item** (2D) shader — scroll and tint a texture:

```glsl
shader_type canvas_item;
uniform sampler2D noise : repeat_enable;
uniform vec4 tint : source_color = vec4(1.0);
uniform float speed = 0.1;

void fragment() {
    vec2 uv = UV + vec2(TIME * speed, 0.0);   // UV is the node's texcoord
    COLOR = texture(noise, uv) * tint * COLOR; // in COLOR = vertex/modulate color
}
```

Small **spatial** (3D) shader — a fresnel rim glow (`NORMAL` and `VIEW` are **view-space** here):

```glsl
shader_type spatial;
render_mode blend_add, cull_back;
uniform vec3 rim_color : source_color = vec3(0.2, 0.6, 1.0);
uniform float power : hint_range(0.0, 8.0) = 3.0;

varying vec3 v_normal;
void vertex()   { v_normal = NORMAL; }        // pass to fragment via varying
void fragment() {
    float f = pow(1.0 - dot(normalize(v_normal), normalize(VIEW)), power);
    EMISSION = rim_color * f;
    ALPHA = f;
}
```

Deep dive (built-in variables per type, render_modes, particles/sky/fog, screen/depth reads) →
`references/godot-shading-language.md`.

### Unity 6

Two authoring paths, both on the Scriptable Render Pipeline (**URP** for most projects, **HDRP**
for high-end):

- **Shader Graph** — visual node graph feeding a *master stack* (Vertex + Fragment blocks).
  Artist-friendly, URP/HDRP only, compiles to HLSL. Default choice for surface looks and VFX.
- **Hand-written HLSL** — a `Shader "…" { … }` (ShaderLab) wrapping `Properties` and `Pass`
  blocks; the program goes in an `HLSLPROGRAM … ENDHLSL` block that `#include`s URP's `Core.hlsl`
  / `Lighting.hlsl`. Use for full control, custom lighting, or compute-driven effects.

Surface shaders are not an option under URP/HDRP (see the Version contract) — a lit look is an
HLSL pass or a Shader Graph. Set parameters at runtime through a `MaterialPropertyBlock` or
`Material.SetFloat/SetColor/SetTexture`. Full URP unlit + lit HLSL pass and a Shader Graph
mapping → `references/unity-and-unreal-shaders.md`.

### Unreal 5.x

A **Material** is a node graph the engine compiles to HLSL. You wire outputs on the main result
node — Base Color, Metallic, Roughness, Emissive Color, Normal, Opacity / Opacity Mask, World
Position Offset. Key knobs on the material:

- **Material Domain** — what the material drives: *Surface* (default meshes), *Deferred Decal*,
  *Light Function*, *Volume*, *Post Process* (full-screen), *User Interface*.
- **Blend Mode** (Opaque/Masked/Translucent/Additive…) and **Shading Model** (Default Lit,
  Unlit, Subsurface, …). Opacity needs Translucent; Opacity Mask needs Masked.
- **Material Instances** expose parameters (scalar/vector/texture/switch) for cheap variants and
  runtime tweaks via a Dynamic Material Instance (`SetScalarParameterValue`, …).
- **Custom node** — a raw HLSL escape hatch: set Output Type, add named Inputs, `return …;`.
  Reach for it only when the node set can't express the logic (loops, bitops). Reuse via Material
  Functions. UE5.5+ adds *Substrate* as an opt-in shading system; the standard material is still default.

Custom-node HLSL, domains, and a Godot↔Unreal recipe mapping → `references/unity-and-unreal-shaders.md`.

## Common effect recipes (concepts)

Each is a *technique*, engine-agnostic — the reference has full per-engine code.

| Effect | Core idea |
| --- | --- |
| **Dissolve** | Threshold a noise texture against an animated cutoff; `discard`/clip below it; add an emissive band at the edge. |
| **Rim / outline** | Rim = fresnel `pow(1 − N·V, p)`. Outline = inverted-hull pass (scale along normals, flip culling) **or** a post-process depth/normal edge detect. |
| **Toon / cel** | Quantize diffuse `N·L` into bands (`step`/`smoothstep` or a ramp texture); hard-stepped specular. |
| **Water / flow** | Scroll two normal maps at different speeds (or advect a flow-map's RG); refract the screen texture; depth-difference foam at shorelines. |
| **Force field** | Fresnel + scrolling hex/pattern texture + intersection glow from a scene-depth difference; additive. |
| **Hologram** | Scanlines `sin(worldY·f + TIME)` + fresnel + flicker + slight RGB channel offset; additive/translucent. |

**Worked example — dissolve (Godot spatial):**

```glsl
shader_type spatial;
render_mode cull_disabled;
uniform sampler2D dissolve_noise : hint_default_white;
uniform float threshold : hint_range(0.0, 1.0) = 0.0;   // animate 0 → 1
uniform float edge = 0.05;
uniform vec3 edge_color : source_color = vec3(1.0, 0.4, 0.0);

void fragment() {
    float n = texture(dissolve_noise, UV).r;
    if (n < threshold) discard;                      // cut the hole
    float e = smoothstep(threshold, threshold + edge, n);
    EMISSION = edge_color * (1.0 - e);               // glowing burn ring
    ALBEDO = vec3(0.6);
}
```

Drive `threshold` from an `AnimationPlayer` or `set_shader_parameter`. The same math ports to
Unity (`clip(n - threshold)`) and Unreal (Opacity Mask + a threshold parameter). All six recipes,
per engine → `references/effect-recipes.md`.

## Post-processing / full-screen effects

- **Godot** — a `canvas_item` shader on a full-rect `ColorRect` reading `hint_screen_texture`, or
  a spatial unshaded full-screen quad reading `hint_screen_texture`/`hint_depth_texture`; or a
  `CompositorEffect` (4.3+) for a custom render pass. Environment already covers glow/tonemap/SSAO.
- **Unity (URP)** — a **Full Screen Pass Renderer Feature** driving a *Fullscreen* Shader Graph
  (or a Blit pass). HDRP uses Custom Pass / Fullscreen. Legacy `OnRenderImage` is Built-in-RP only.
- **Unreal** — a **Post Process Material** (Material Domain = Post Process) on a Post Process
  Volume; read the frame with **SceneTexture** nodes (SceneColor, SceneDepth, custom stencil).
  Blendable Location orders it against tonemapping.

## Performance

- **Overdraw** is the top cost: transparent/additive layers each re-shade the same pixels. Prefer
  opaque, sort and minimize overlap, keep particle fill low. `discard`/`clip` **disables early-Z**
  — don't use it as a cheap "invisible".
- **Texture sampling** = a memory fetch + filter each call; *dependent* reads (UV derived from a
  prior sample) stall the pipeline. Pack masks into channels, atlas, and cache samples in locals.
- **Branching**: a divergent `if` across a GPU warp can execute *both* sides. Prefer
  `step`/`mix`/`clamp`; branches on a **uniform** (same value for all pixels) are cheap; static
  branches compile out.
- **LOD & precision**: use mipmaps, shader LOD variants, and `mediump`/half precision on mobile;
  full `float` only where banding shows. Move linear work to the vertex stage.
- **Mobile / tile GPUs**: bandwidth-bound — keep render targets small, avoid mid-pass framebuffer
  reads, and note that `discard` and large full-screen passes break tile hidden-surface removal.

## Anti-patterns

| Anti-pattern | Do instead |
| --- | --- |
| Porting a tutorial verbatim from Godot 3, Built-in RP, or pre-5.0 UE | Translate it through the Version contract table first — retired symbols still compile in old guides, not in your project. |
| Reading a texture or writing a color without minding linear vs sRGB | Author color uniforms as `source_color` (Godot) / sRGB-marked properties and check the space at every read and output — the #1 "looks washed out / too dark" bug. |
| Using interpolated normals raw, or a normal map straight from the sample | Re-normalize per pixel; unpack with `×2−1` and mind tangent handedness. |
| Writing the shader before choosing the target surface | Pick `shader_type` / render pipeline / material domain first (2D vs 3D, URP vs HDRP, Surface vs Post Process) — it decides which built-ins and blend modes exist. |
| Fresnel, normalization, or lighting math in the vertex stage | Only linearly-interpolating work goes per-vertex; exact math stays per-pixel. |
| `discard`/`clip` as a cheap "make it invisible" | Cull it or scale to zero — `discard` disables early-Z and breaks tile hidden-surface removal on mobile. |
| Stacking additive/translucent layers until the look works | Count the overdraw: each layer re-shades the same pixels. Prefer opaque, minimize overlap, keep particle fill low. |
| Full-screen effects via `OnRenderImage`/`Graphics.Blit`, or `SceneTexture` outside the Post Process domain | Use the engine's supported path — URP Renderer Feature / Fullscreen Shader Graph, UE Post Process material, Godot `ColorRect` + `hint_screen_texture` or `CompositorEffect`. |

## Related skills

- [`godot`](../godot/SKILL.md) / [`unity`](../unity/SKILL.md) / [`unreal`](../unreal/SKILL.md) — gameplay
  code, nodes/components, input, scene wiring; this skill owns the *shading*, not the C#/GDScript/Blueprint around it.
- [`gamedev-physics`](../gamedev-physics/SKILL.md) — simulation, collision, rigid bodies, character
  controllers (a shader that *fakes* refraction is here; simulating fluid dynamics is not).
- [`gamedev-shipping`](../gamedev-shipping/SKILL.md) — platform export and shader-variant stripping in
  the build (this skill keeps the per-shader performance work).

## Checklist

- [ ] Correct engine + version idiom (no banned API from the Version contract table).
- [ ] Right `shader_type` / render pipeline / material domain for the target (2D vs 3D, URP vs HDRP, Surface vs Post Process).
- [ ] Work placed in the right stage: linear math per-vertex via `varying`, exact math per-pixel.
- [ ] Colors authored in the correct space (`source_color` / sRGB handling); normals normalized and unpacked.
- [ ] Uniforms/parameters exposed and driven from code or an animation track — not hard-coded.
- [ ] Performance sanity: overdraw, sample count, and branching considered; mobile precision set if targeted.
- [ ] Post-process uses the engine's supported full-screen path (not a retired Built-in-RP mechanism).
