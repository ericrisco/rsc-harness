# Godot 4.x shading language

Depth behind SKILL.md's Godot section. Targets Godot 4.4/4.5. Godot ships its own GLSL-like
language in `.gdshader` files; a `ShaderMaterial` binds a shader to a node and stores uniform values.

## The five shader types

Every `.gdshader` starts with exactly one `shader_type`:

| `shader_type` | Drives | Key entry points |
| --- | --- | --- |
| `spatial` | 3D materials on `MeshInstance3D` etc. | `vertex()`, `fragment()`, `light()` |
| `canvas_item` | 2D (`Sprite2D`, `TextureRect`, `Control`, …) | `vertex()`, `fragment()`, `light()` |
| `particles` | GPU particle process (`GPUParticles2D/3D`) | `start()`, `process()` |
| `sky` | `Sky` resource in an `Environment` | `sky()` |
| `fog` | `FogVolume` local volumetric fog | `fog()` |

Tokens are exact: `canvas_item` has an underscore, `particles` is plural.

## Uniforms and hints

`uniform`s become material parameters (editable in the inspector, settable from code). Hints tell
the engine how to treat them:

```glsl
uniform vec4  albedo      : source_color = vec4(1.0);        // sRGB→linear color picker
uniform float amount      : hint_range(0.0, 1.0, 0.01) = 0.5;// slider min,max,step
uniform sampler2D tex      : source_color, filter_linear_mipmap, repeat_enable;
uniform sampler2D mask     : hint_default_white;             // default when unbound (also _black, _transparent)
uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D depth_tex  : hint_depth_texture;
uniform sampler2D nr_tex     : hint_normal_roughness_texture;
global uniform float game_time;                              // shared project-wide global
instance uniform vec4 tint : source_color;                   // per-instance override
```

Migration from Godot 3 (never emit the left side): `hint_color`/`hint_albedo` → `source_color`;
`hint_white`/`hint_black` → `hint_default_white`/`hint_default_black`; the `SCREEN_TEXTURE`,
`DEPTH_TEXTURE`, `NORMAL_TEXTURE` **built-ins** → `hint_screen_texture` / `hint_depth_texture` /
`hint_normal_roughness_texture` **uniforms**.

Texture filter/repeat qualifiers: `filter_nearest`, `filter_linear`, `filter_nearest_mipmap`,
`filter_linear_mipmap`, `filter_linear_mipmap_anisotropic`; `repeat_enable`, `repeat_disable`.

## varying — vertex → fragment

Declare at file scope, write in `vertex()`, read (interpolated) in `fragment()`:

```glsl
varying vec3 world_pos;
void vertex()   { world_pos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() { /* use world_pos */ }
```

Add an interpolation qualifier when needed: `varying flat int id;` (no interpolation),
`varying smooth vec3 n;` (default).

## render_mode

Comma-separated flags right after `shader_type`. Common spatial modes:

```glsl
render_mode blend_add, cull_disabled, unshaded, depth_draw_opaque, depth_test_disabled, shadows_disabled;
```

`blend_mix|add|sub|mul`; `cull_back|front|disabled`; `unshaded` (skip lighting); `depth_draw_*`;
`fog_disabled`. canvas_item supports `blend_*`, `unshaded`, `light_only`, etc.

## Built-ins by type (most-used)

**spatial `fragment()` — inputs:** `UV`, `UV2`, `NORMAL` (view space), `VIEW` (view space, toward
camera), `VERTEX` (view-space position), `COLOR` (vertex color), `SCREEN_UV`, `TIME`,
`FRAGCOORD`, matrices `MODEL_MATRIX`, `VIEW_MATRIX`, `INV_VIEW_MATRIX`, `PROJECTION_MATRIX`,
`INV_PROJECTION_MATRIX`. **outputs:** `ALBEDO`, `ALPHA`, `METALLIC`, `ROUGHNESS`, `SPECULAR`,
`EMISSION`, `NORMAL_MAP` (tangent-space, expects 0–1), `NORMAL_MAP_DEPTH`, `AO`, `RIM`,
`CLEARCOAT`, `ALPHA_SCISSOR_THRESHOLD`.

**spatial `vertex()`:** read/write `VERTEX`, `NORMAL`, `TANGENT`, `UV`, `COLOR`; write `POSITION`
directly (in clip space) to bypass the standard transform — used for full-screen quads:
`POSITION = vec4(VERTEX.xy, 1.0, 1.0);`.

**canvas_item `fragment()`:** inputs `UV`, `COLOR` (vertex×modulate), `SCREEN_UV`, `TEXTURE`
(the node's texture), `TEXTURE_PIXEL_SIZE`, `TIME`; output `COLOR`. `MODULATE` exposes the
CanvasItem modulate separately.

**particles `process()`:** `TRANSFORM`, `VELOCITY`, `COLOR`, `CUSTOM`, `LIFETIME`, `DELTA`,
`RESTART`, `EMISSION_TRANSFORM`, `ATTRACTOR_FORCE`.

## Screen and depth reads

`SCREEN_TEXTURE` is gone — declare a uniform:

```glsl
shader_type canvas_item;
uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap;
void fragment() { COLOR = texture(screen_tex, SCREEN_UV); }  // what's behind this node
```

Depth to view/world position in a spatial full-screen pass:

```glsl
uniform sampler2D depth_tex : hint_depth_texture;
void fragment() {
    float d = texture(depth_tex, SCREEN_UV).x;
    vec4 ndc = vec4(SCREEN_UV * 2.0 - 1.0, d, 1.0);
    vec4 view = INV_PROJECTION_MATRIX * ndc; view.xyz /= view.w;   // view-space position
    float linear_depth = -view.z;
}
```

## ShaderMaterial from code (GDScript)

```gdscript
var mat := ShaderMaterial.new()
mat.shader = preload("res://dissolve.gdshader")
mesh.material_override = mat
mat.set_shader_parameter("threshold", 0.7)
mat.set_shader_parameter("edge_color", Color(1, 0.4, 0))
# animate a uniform each frame
func _process(delta): mat.set_shader_parameter("threshold", t)
```

C# parity: `mat.SetShaderParameter("threshold", 0.7f);`. Prefer an `AnimationPlayer` track on the
material's `shader_parameter/<name>` for authored animations.

## Common gotchas

- `NORMAL` and `VIEW` in a spatial `fragment()` are **view space**, not world — transform with
  `INV_VIEW_MATRIX` if you need world space (e.g. triplanar, world-space fresnel toward a point).
- Re-`normalize()` interpolated normals per pixel.
- `discard` (and `ALPHA_SCISSOR_THRESHOLD`) disables early depth — costs overdraw; use only for cutouts.
- Set `render_mode unshaded` on pure-emissive/effect materials to skip the lighting cost.
- Precompute in `vertex()` and pass a `varying` whenever the quantity interpolates linearly.
