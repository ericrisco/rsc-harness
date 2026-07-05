# Effect recipes

Full per-engine detail behind SKILL.md's recipe table. Each recipe: the technique, then code.
Godot examples are `.gdshader` (4.x); Unity is URP HLSL/Shader Graph; Unreal is Material graph
described as node chains (drop to a Custom node only where noted).

---

## 1. Dissolve

**Technique.** Sample a noise texture, compare to an animated `threshold`; cut pixels below it;
add an emissive band in a thin range above the threshold so the edge glows as the object burns.

**Godot (spatial):**

```glsl
shader_type spatial;
render_mode cull_disabled;
uniform sampler2D noise : hint_default_white;
uniform float threshold : hint_range(0.0, 1.0) = 0.0;
uniform float edge = 0.05;
uniform vec3 edge_color : source_color = vec3(1.0, 0.4, 0.0);
void fragment() {
    float n = texture(noise, UV).r;
    if (n < threshold) discard;
    float e = smoothstep(threshold, threshold + edge, n);
    ALBEDO = vec3(0.6);
    EMISSION = edge_color * (1.0 - e) * 4.0;   // >1 for bloom
}
```

**Unity URP (fragment):** `float n = SAMPLE_TEXTURE2D(_Noise, s, uv).r; clip(n - _Threshold);`
then `emission = _EdgeColor * (1 - smoothstep(_Threshold, _Threshold + _Edge, n));`. In Shader
Graph: Sample Texture → Step/Smoothstep → Alpha Clip Threshold + Emission.

**Unreal:** Blend Mode = Masked. Noise Texture → Subtract Threshold parameter → **Opacity Mask**.
For the glow, `Smoothstep` around the threshold → multiply EdgeColor → **Emissive Color**. Animate
Threshold via a Dynamic Material Instance or a Curve.

---

## 2. Rim light & outline

**Rim (fresnel).** Brightens grazing angles: `rim = pow(1 - saturate(dot(N, V)), power)`. Cheap,
per-pixel, great for shields/highlights.

**Godot:**

```glsl
shader_type spatial;
uniform vec3 rim_color : source_color = vec3(0.4, 0.7, 1.0);
uniform float power : hint_range(0.5, 8.0) = 3.0;
void fragment() {
    float f = pow(1.0 - dot(normalize(NORMAL), normalize(VIEW)), power);
    EMISSION = rim_color * f;
}
```

**Unity:** Fresnel Effect node (Power input) → multiply color → Emission. **Unreal:** Fresnel node
→ multiply → Emissive Color.

**Outline** — two approaches:
- **Inverted hull** (mesh outline): a second pass that pushes vertices along their normals and
  renders only back faces in the outline color. Godot: a second material pass with
  `render_mode cull_front;` and `VERTEX += NORMAL * width;` in `vertex()`. Unity: an extra Pass
  with `Cull Front` offsetting `positionOS` along the normal. Unreal: post-process, or a second
  mesh scaled along normals.
- **Post-process edge detect** (screen outline): compare neighboring **depth** and **normal**
  samples; large deltas = an edge. Domain = Post Process (UE) / Full Screen (URP) / ColorRect
  reading `hint_depth_texture` (Godot). Best for uniform-width screen outlines regardless of mesh.

---

## 3. Toon / cel

**Technique.** Replace smooth diffuse `N·L` with quantized bands (a hard `step`, a few
`smoothstep` bands, or a 1D ramp texture lookup). Add a stepped specular and optional rim.

**Godot (custom lighting via `light()`):**

```glsl
shader_type spatial;
uniform sampler2D ramp : hint_default_white, filter_linear;
void light() {
    float ndl = clamp(dot(NORMAL, LIGHT), 0.0, 1.0);
    float band = texture(ramp, vec2(ndl, 0.5)).r;   // ramp = your toon gradient
    DIFFUSE_LIGHT += ATTENUATION * LIGHT_COLOR.rgb * band;
}
```

Cheaper hard cut without a ramp: `float band = step(0.5, ndl);` or two-step
`smoothstep(0.48, 0.5, ndl)`. **Unity:** compute `NdotL` in a lit HLSL pass and quantize, or a
Shader Graph with the main light direction + Step. **Unreal:** custom shading is limited without
engine mods — approximate with a Post Process banding of scene color, or `CustomLighting`-style
math in an Unlit material driven by a light vector parameter.

---

## 4. Water / flow

**Technique.** Two scrolling normal maps at different speeds/scales summed for waves; refract the
scene behind by offsetting the screen UV with the normal; add depth-based foam where scene depth
is close to the surface. A **flow map** (RG = 2D flow direction) advects UVs for rivers.

**Godot (spatial, refraction + normals):**

```glsl
shader_type spatial;
render_mode cull_disabled;
uniform sampler2D normal_map : hint_normal, repeat_enable;
uniform sampler2D screen_tex : hint_screen_texture, filter_linear_mipmap;
uniform sampler2D depth_tex  : hint_depth_texture;
uniform float speed = 0.03;
uniform float strength = 0.02;
void fragment() {
    vec2 uv1 = UV + vec2(TIME * speed, 0.0);
    vec2 uv2 = UV - vec2(0.0, TIME * speed * 0.7);
    vec3 n = normalize(texture(normal_map, uv1).xyz + texture(normal_map, uv2).xyz - 1.0);
    vec2 refr = SCREEN_UV + n.xy * strength;
    ALBEDO = texture(screen_tex, refr).rgb;
    NORMAL_MAP = n * 0.5 + 0.5;
}
```

Foam: compare linearized `depth_tex` at `SCREEN_UV` to the surface's own depth; where the
difference is small, `mix` toward white. **Unity:** two Sample Texture 2D (normal) with
Time-driven offsets → combine → Scene Color offset by normal; Scene Depth node difference for
foam. **Unreal:** Panner nodes on normal maps, Refraction pin, and `SceneDepth − PixelDepth` for a
foam mask; Single Layer Water shading model for oceans.

---

## 5. Force field / shield

**Technique.** Fresnel base + a scrolling hex/pattern texture, boosted where the mesh intersects
other geometry (scene-depth difference), additive/translucent. Optional hit ripples from a
world-space impact point parameter.

**Godot:**

```glsl
shader_type spatial;
render_mode blend_add, cull_disabled, unshaded, depth_draw_never;
uniform sampler2D pattern : repeat_enable;
uniform sampler2D depth_tex : hint_depth_texture;
uniform vec3 color : source_color = vec3(0.2, 0.7, 1.0);
uniform float power : hint_range(0.5, 8.0) = 2.0;
void fragment() {
    float fres = pow(1.0 - dot(normalize(NORMAL), normalize(VIEW)), power);
    float hex = texture(pattern, UV + TIME * 0.05).r;
    // intersection glow
    float scene = texture(depth_tex, SCREEN_UV).x;
    vec4 v = INV_PROJECTION_MATRIX * vec4(SCREEN_UV * 2.0 - 1.0, scene, 1.0);
    float edge = smoothstep(0.0, 1.0, abs(-v.z / v.w - (-VERTEX.z)));
    EMISSION = color * (fres + hex * 0.3 + (1.0 - edge));
    ALPHA = clamp(fres + hex * 0.3, 0.0, 1.0);
}
```

**Unity/Unreal:** Fresnel + Panner on a pattern texture, additive/translucent blend, and a Scene
Depth vs pixel-depth difference (Unity Scene Depth node; UE `SceneDepth − PixelDepth`) for the
intersection band.

---

## 6. Hologram

**Technique.** Scanlines from `sin(worldY * freq + TIME)`, fresnel edge glow, periodic flicker
(noise or `sin`), a small per-channel UV offset for chromatic fringing, additive or translucent.

**Godot:**

```glsl
shader_type spatial;
render_mode blend_add, cull_disabled, unshaded;
uniform vec3 color : source_color = vec3(0.3, 0.9, 1.0);
uniform float lines = 120.0;
uniform float speed = 2.0;
varying vec3 wpos;
void vertex() { wpos = (MODEL_MATRIX * vec4(VERTEX, 1.0)).xyz; }
void fragment() {
    float scan = 0.5 + 0.5 * sin(wpos.y * lines + TIME * speed);
    float fres = pow(1.0 - dot(normalize(NORMAL), normalize(VIEW)), 2.0);
    float flicker = 0.9 + 0.1 * sin(TIME * 30.0);
    EMISSION = color * (scan * 0.6 + fres) * flicker;
    ALPHA = (scan * 0.5 + fres) * flicker;
}
```

**Unity:** world-position Y into a Sine → scanlines; Fresnel node; Time-driven flicker; additive.
**Unreal:** `WorldPosition.B` (Z-up) → Sine → scanlines, Fresnel, Time flicker → Emissive; Blend
Mode Translucent/Additive, Unlit. Chromatic fringing: sample the effect at slightly offset UVs per
R/G/B channel.

---

## Cross-cutting notes

- **Additive/translucent** effects (shield, hologram, force field) stack overdraw — keep them
  small on screen and unshaded (`render_mode unshaded` / Unlit / Emissive-only).
- **Depth-based** recipes (foam, intersection glow, screen outline) need the engine's depth
  texture enabled: URP *Depth Texture* toggle; UE reads SceneDepth natively; Godot's
  `hint_depth_texture` is available in the forward+ / mobile renderers.
- Author tunables (speed, power, colors, thresholds) as **parameters/uniforms** and drive them
  from an animation track or code — never bake magic numbers you'll want to tweak live.
