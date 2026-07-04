# Web export — cross-origin isolation, headers, and hosts

Back to the entrypoint: `../SKILL.md`. This is the single deepest source of "my web build
works locally but breaks when hosted" bugs. Read it before you host a threaded WebAssembly game.

## Why the headers exist

Modern engines run the game loop on Web Workers and share memory between them with
**`SharedArrayBuffer`**. After Spectre/Meltdown, browsers only expose `SharedArrayBuffer` (and
high-resolution timers) to pages that are **cross-origin isolated**. A page becomes isolated only
when the server sends **both**:

```
Cross-Origin-Opener-Policy: same-origin
Cross-Origin-Embedder-Policy: require-corp
```

- **COOP: same-origin** severs the page from cross-origin windows/openers (its own browsing-context group).
- **COEP: require-corp** requires every subresource to explicitly opt in to being embedded (via CORP or CORS), so no untrusted cross-origin resource shares the isolated process.

With both present, `self.crossOriginIsolated === true` and `SharedArrayBuffer` is defined. Miss
either and you get one of: `SharedArrayBuffer is not defined`, a JS exception during engine init,
an infinite loading bar, or a blank canvas. The **files are correct** — the *response headers* are the bug.

Quick self-test in the browser console on the hosted page:

```js
console.log(self.crossOriginIsolated); // must be true for threaded builds
console.log(typeof SharedArrayBuffer);  // must be "function"
```

## Do you even need the headers?

| Situation | Headers needed? |
| --- | --- |
| Godot 4 web export with **Thread Support ON** | Yes — both. |
| Godot 4 web export with Thread Support OFF (single-thread) | No — but audio/perf are worse. |
| Unity WebGL with **multithreading** / threads enabled | Yes — both. |
| Unity WebGL single-threaded (default older setups) | No. |
| A build that only *uses* WASM but not threads/SAB | No. |

If you can host somewhere that sets headers, **keep threads on** — it's a real perf win. Only
disable threads when your host genuinely can't set headers and the shim below isn't viable.

## Setting the headers per host

**Netlify** — `public/_headers` (or the publish dir):

```
/*
  Cross-Origin-Opener-Policy: same-origin
  Cross-Origin-Embedder-Policy: require-corp
```

**Vercel** — `vercel.json`:

```json
{
  "headers": [{
    "source": "/(.*)",
    "headers": [
      { "key": "Cross-Origin-Opener-Policy", "value": "same-origin" },
      { "key": "Cross-Origin-Embedder-Policy", "value": "require-corp" }
    ]
  }]
}
```

**nginx**:

```nginx
location / {
    add_header Cross-Origin-Opener-Policy same-origin always;
    add_header Cross-Origin-Embedder-Policy require-corp always;
    # serve pre-compressed wasm/pck if present
    gzip_static on;
}
# correct MIME + long cache for the payload
types { application/wasm wasm; }
```

**Apache** — `.htaccess`:

```apache
Header set Cross-Origin-Opener-Policy "same-origin"
Header set Cross-Origin-Embedder-Policy "require-corp"
AddType application/wasm .wasm
```

**Cloudflare Pages** — a `_headers` file like Netlify's, or a Transform Rule adding both response headers.

**itch.io** — no file needed: in the upload settings tick **"This file will be played in the
browser"**, then check **"SharedArrayBuffer support"**. itch serves your build from a domain that
sends COOP/COEP for you. This is the fastest correct web host for a jam/demo.

**GitHub Pages / plain static CDN with no header control** — you **cannot** set response headers.
Two escapes:

1. Export **without** threads (single-threaded) — always works, no headers, some perf loss.
2. The **`coi-serviceworker`** shim: a small service worker (`coi-serviceworker.js`) you include
   from the page; on first load it registers, reloads once, and thereafter re-serves every
   response with COOP/COEP injected, faking cross-origin isolation client-side. Caveats: it needs
   HTTPS, adds a reload, and won't help resources it can't intercept. Good enough for GitHub Pages demos.

## COEP fallout — the second-order breakage

`COEP: require-corp` also applies to **every** subresource the page loads. Anything cross-origin
(web fonts, analytics scripts, remote images, iframes, a leaderboard API on another domain) is
**blocked** unless it sends `Cross-Origin-Resource-Policy: cross-origin` (or proper CORS). Symptoms:
fonts vanish, a third-party embed 404s in the network tab with a CORP error.

Fixes, in order of preference:
1. **Self-host** the asset (same origin ⇒ no CORP needed). Best for fonts and small scripts.
2. Ask the third party to send `Cross-Origin-Resource-Policy: cross-origin` (or use their CORS endpoint).
3. Switch that page to **`COEP: credentialless`** — a looser mode that loads cross-origin resources
   without credentials and still grants isolation in supporting browsers. Narrower support than `require-corp`; test.

## Engine specifics

**Godot 4 web**
- `Editor ▸ Manage Export Templates` must match the editor build; then a **Web** export preset.
- **Thread Support** toggle drives whether you need the headers. **Extensions Support** enables GDExtension on web.
- Output: `index.html` + `.js` + `.wasm` + `.pck` (+ worker/audio files). Serve `.wasm` as `application/wasm` and enable gzip/brotli — the `.wasm`/`.pck` are the bulk of the download.
- **C#/.NET edition has no web export in Godot 4.x** (planned for a later release with .NET 10). If the project is C#, either port the web-facing build to GDScript or drop web as a target. Do not promise a C# web build.
- Headless CI export: `godot --headless --export-release "Web" build/index.html`.

**Unity WebGL**
- `File ▸ Build Profiles ▸ Web`; Player Settings ▸ Publishing: enable/disable threads, set the
  **compression format** (Brotli/Gzip) and keep **Decompression Fallback** on if the host can't
  send `Content-Encoding` — otherwise the browser can't inflate the payload.
- Threaded WebGL ⇒ same COOP/COEP requirement.

## Checklist

- [ ] Decide threads on/off; if on, both headers are mandatory.
- [ ] Headers set at the **host** (or itch's SAB checkbox, or the shim on GitHub Pages).
- [ ] `self.crossOriginIsolated === true` verified in the console on the deployed URL.
- [ ] `.wasm` served with `application/wasm` MIME and gzip/brotli.
- [ ] No cross-origin subresource silently blocked by COEP (check the network tab).
- [ ] Godot + web ⇒ confirmed GDScript, not C#/.NET.
