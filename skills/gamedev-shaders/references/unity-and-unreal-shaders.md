# Unity 6 & Unreal 5.x shaders

Depth behind SKILL.md's Unity and Unreal sections.

---

## Unity 6 (URP / HDRP)

Unity 6 (6000.x LTS) ships the Scriptable Render Pipeline as the norm: **URP** (Universal) for
most projects, **HDRP** (High Definition) for high-end PC/console. The retired Built-in RP still
exists but do not author new shaders for it.

### Choosing the authoring path

| Path | When | Notes |
| --- | --- | --- |
| **Shader Graph** | Surface looks, VFX, artist iteration | Visual master stack (Vertex + Fragment blocks); URP/HDRP; compiles to HLSL. |
| **Hand-written HLSL** | Custom lighting, tight control, compute-driven | ShaderLab wrapper + `HLSLPROGRAM` block including URP libraries. |

**Surface shaders (`#pragma surface`) do NOT compile under URP/HDRP** — they are a Built-in-RP
feature. Under SRP write a lit HLSL pass or use Shader Graph.

### Minimal URP unlit HLSL shader

```hlsl
Shader "Custom/URPUnlitScroll" {
    Properties {
        _BaseMap ("Texture", 2D) = "white" {}
        _Tint ("Tint", Color) = (1,1,1,1)
        _Speed ("Scroll Speed", Float) = 0.1
    }
    SubShader {
        Tags { "RenderPipeline"="UniversalPipeline" "RenderType"="Opaque" }
        Pass {
            HLSLPROGRAM
            #pragma vertex vert
            #pragma fragment frag
            #include "Packages/com.unity.render-pipelines.universal/ShaderLibrary/Core.hlsl"

            struct Attributes { float4 positionOS : POSITION; float2 uv : TEXCOORD0; };
            struct Varyings   { float4 positionHCS : SV_POSITION; float2 uv : TEXCOORD0; };

            TEXTURE2D(_BaseMap); SAMPLER(sampler_BaseMap);
            CBUFFER_START(UnityPerMaterial)
                float4 _BaseMap_ST; float4 _Tint; float _Speed;
            CBUFFER_END

            Varyings vert (Attributes IN) {
                Varyings o;
                o.positionHCS = TransformObjectToHClip(IN.positionOS.xyz);   // NOT UnityObjectToClipPos
                o.uv = TRANSFORM_TEX(IN.uv, _BaseMap);
                return o;
            }
            half4 frag (Varyings IN) : SV_Target {
                float2 uv = IN.uv + float2(_Time.y * _Speed, 0);
                return SAMPLE_TEXTURE2D(_BaseMap, sampler_BaseMap, uv) * _Tint;
            }
            ENDHLSL
        }
    }
}
```

For a **lit** pass add `#include ".../Lighting.hlsl"`, compute normals in world space, and call
`UniversalFragmentPBR` / light loops. `mul(UNITY_MATRIX_MVP, v)` and `UnityObjectToClipPos` are
Built-in-RP idioms — never emit them for URP.

### Shader Graph mapping (concepts)

- **Master stack** = Vertex block (Position/Normal/Tangent) + Fragment block (Base Color, Metallic,
  Smoothness, Emission, Alpha, Normal (Tangent Space)).
- Time node → scrolling; Fresnel Effect node → rim; Sample Texture 2D → maps; Step/Smoothstep →
  toon banding; Scene Color / Scene Depth nodes need the URP opaque texture / depth toggles on.
- **Custom Function node** embeds an `.hlsl` snippet inside the graph (the Shader Graph analog of
  UE's Custom node).

### Runtime parameters

`Material.SetFloat/SetColor/SetTexture`, or a `MaterialPropertyBlock` on the renderer for
per-instance values without new material instances. Enable keyword variants with `#pragma
multi_compile` / `shader_feature` and `Material.EnableKeyword`.

### Full-screen / post-process (URP)

Add a **Full Screen Pass Renderer Feature** to the URP Renderer and point it at a *Fullscreen*
Shader Graph (Fullscreen master) or a Blit material. HDRP uses a Custom Pass Volume / Fullscreen
Custom Pass. `OnRenderImage`/`Graphics.Blit` image effects are Built-in-RP only.

---

## Unreal 5.x

A **Material** is a node graph compiled to HLSL. Targets UE 5.4+.

### Result-node outputs

Base Color, Metallic, Specular, Roughness, Anisotropy, Emissive Color, Opacity, Opacity Mask,
Normal, World Position Offset, Ambient Occlusion, Refraction, Pixel Depth Offset. Which are active
depends on the Blend Mode and Shading Model.

### Material Domain — pick what it drives

| Domain | Use |
| --- | --- |
| **Surface** | Standard meshes (default). |
| **Deferred Decal** | Projected decals onto the g-buffer. |
| **Light Function** | Modulates a light's contribution. |
| **Volume** | Volumetric fog/clouds. |
| **Post Process** | Full-screen effect on a Post Process Volume (see below). |
| **User Interface** | UMG widget materials. |

**Blend Mode**: Opaque / Masked (uses Opacity Mask + a mask clip value) / Translucent (uses
Opacity) / Additive / Modulate. **Shading Model**: Default Lit / Unlit / Subsurface / Clear Coat /
Two Sided Foliage / Hair / Eye / Cloth / Single Layer Water.

Match the pin to the mode: Opacity needs Translucent/Additive; Opacity Mask needs Masked; feeding
the wrong one is a silent no-op.

### Custom HLSL node

The escape hatch when the node set can't express the logic (loops, bitwise, custom math). Set the
node's **Output Type**, add named **Inputs** (they become HLSL variables), write HLSL, `return`:

```hlsl
// Inputs: Time (Scalar), UV (Vector2), Freq (Scalar). Output Type: CMOT Float3.
float scan = 0.5 + 0.5 * sin(UV.y * Freq + Time * 6.2831);
float rim  = pow(1.0 - saturate(dot(normalize(V), normalize(N))), 3.0); // wire V,N as inputs
return float3(scan, scan, scan) * rim;
```

Prefer graph nodes for anything nodes *can* express — Custom nodes block constant-folding and
some cross-platform optimizations. Reuse shared logic via **Material Functions**.

### Material Instances

Mark parameters (right-click a constant → *Convert to Parameter*): Scalar, Vector, Texture,
StaticSwitch. A **Material Instance Constant** is an authored variant; a **Dynamic Material
Instance** (`CreateDynamicMaterialInstance`) is set at runtime:

```cpp
UMaterialInstanceDynamic* MID = Mesh->CreateDynamicMaterialInstance(0, BaseMat);
MID->SetScalarParameterValue("Dissolve", 0.7f);
MID->SetVectorParameterValue("EdgeColor", FLinearColor(1, 0.4f, 0));
```

Static switches compile out branches into variants; use them for feature toggles rather than a
runtime `if`.

### Post-process material

Set Material Domain = **Post Process**, add it to a **Post Process Volume** (or camera). Read the
frame with **SceneTexture** nodes — `PostProcessInput0` (scene color), `SceneDepth`, world normal,
custom-depth/custom-stencil for masking specific actors. **Blendable Location** (Before/After
Tonemapping, etc.) sets ordering; SceneTexture nodes only work in this domain.

---

## Godot ↔ Unity ↔ Unreal quick map

| Concept | Godot 4 | Unity URP | Unreal 5 |
| --- | --- | --- | --- |
| Color output | `ALBEDO` / `EMISSION` | Base Color / Emission block | Base Color / Emissive Color |
| Alpha cutout | `discard` / `ALPHA_SCISSOR_THRESHOLD` | `clip()` / Alpha Clip Threshold | Opacity Mask (Masked) |
| Fresnel/rim | `1 - dot(NORMAL, VIEW)` | Fresnel Effect node | Fresnel node |
| Screen color | `hint_screen_texture` | Scene Color node / opaque texture | SceneTexture: PostProcessInput0 |
| Scene depth | `hint_depth_texture` | Scene Depth node | SceneTexture: SceneDepth |
| Time | `TIME` | Time node / `_Time.y` | Time node |
| Runtime param | `set_shader_parameter` | `Material.SetFloat` | `SetScalarParameterValue` (MID) |
| Full-screen FX | ColorRect + `hint_screen_texture` / CompositorEffect | Full Screen Pass Renderer Feature | Post Process material + volume |
