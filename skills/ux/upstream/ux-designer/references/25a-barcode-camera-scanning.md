# Camera Barcode & QR Scanning

Scanning with a phone or laptop camera in consumer and prosumer apps: product lookup,
adding items, filling a form from a code, joining Wi-Fi, following a QR link, redeeming
a voucher. The camera is an **accelerator for typing, never the only path**. Most scanner
UX failures come from the states around the decode: permissions, aiming, feedback, and
what happens after a hit. The decode itself is rarely the problem.

> Dedicated scanner hardware and scan-driven work apps: [25b-barcode-scanner-workflows.md](25b-barcode-scanner-workflows.md).
> Showing a code for someone else to scan: [25c-barcode-display.md](25c-barcode-display.md).
> Symbology primer (in 25b), short version: enable only the formats you expect (QR for links,
> EAN/UPC for retail products, DataMatrix for pharma/GS1). Fewer formats scan faster and
> misread less. GS1 barcodes need parsing, and the app must verify check digits.

---

## Contents

- When to Offer Scanning
- Entry Points & System Scanners
- Camera Permission
- The Viewfinder
- Live States & Guidance
- Hard Conditions: Light, Focus, Zoom
- Multiple Codes & Continuous Scanning
- Feedback: Visual, Haptic, Sound
- After the Scan: Auto-Act vs. Confirm
- QR Safety (Quishing)
- Scanning from an Image
- Accessibility
- Web Specifics
- Platform Notes
- Quick Checklist
- Common Mistakes
- Sources

---

## When to Offer Scanning

- Offer scanning where it replaces typing a long or error-prone value: product lookup, a
  form field, event details, Wi-Fi, a contact (Material "Barcode scanning" pattern).
- **Always pair it with manual entry.** Scanning disappears when permission is denied, the
  device has no camera (desktop web), the code is damaged, Google Play services are
  missing, or the browser lacks support. Android's permission guidance says to promote
  alternatives when a feature is unavailable.
- **Hide scan entry points on devices that can't scan** (iOS `DataScannerViewController.isSupported`
  requires an A12 chip or later, and a desktop may have no camera).
- Don't ask people to scan a code shown **on the same phone**. Give them a link instead, or
  scan-from-image (NN/g).

## Entry Points & System Scanners

- Put the entry point **where the value is needed**: a scan icon inside a search field, a
  "Scan" button beside a form field. A dedicated tab only makes sense for scan-centric apps.
  This also puts the permission request in context.
- **Where results go** (Material):

  | Task | After a hit |
  |---|---|
  | Browse products in a store | Stay in the scanner, result in a bottom sheet over the camera |
  | Add a contact / save something | Stay until saved, via a bottom sheet or full-screen dialog |
  | Complete a form | Return to the form with the fields filled in |

- **You may not need a scanner at all.** The iOS Camera app, the Control Center "Scan Code"
  control, the Android camera, the Quick Settings "Scan QR code" tile, and Google Lens all read
  QR codes. If your codes are HTTPS URLs set up as Universal Links / App Links, the system
  scanner opens your app directly.
- NCSC (UK) and the FBI advise consumers to use the phone's built-in scanner and not download
  scanner apps. Don't make "download our app to scan" a prerequisite for a generic QR.
- First run: a one-screen animated hint showing how to hold the device, plus a Help entry
  (angle, distance, light). Not a multi-step tour.

## Camera Permission

- Ask **when the user taps Scan**, never at launch (Apple HIG, Android).
- Purpose string: a specific, complete sentence ("Scan barcodes to add products to your
  list"), not "needed for a better experience".
- **Pre-permission screens differ by platform.** Apple's HIG says a single "Continue"
  button that leads to the system alert, with no cancel and no "Allow" label. Android says
  to include a "No thanks" that keeps the app usable. Don't unify them.
- **Denied state** (Android guidance, which applies everywhere):
  - Don't block the UI with a full-screen warning, and don't nag.
  - Explain the loss where results would appear, and offer manual entry and "Choose from photos".
  - After a permanent denial (Android: denied twice), deep-link to Settings.
- **Check before opening the camera:** iOS `isAvailable` is false when access is denied
  or restricted (Screen Time). On the web, `navigator.permissions.query({name:'camera'})`
  (Chrome, Safari 16+, Firefox 132+) lets you show recovery steps instead of failing.
- **Permission-free options:**

  | Platform | Option | Trade-off |
  |---|---|---|
  | Android | **Google Code Scanner** (ML Kit): no camera permission; Google Play services runs the camera | No custom UI; needs GMS (not Huawei or de-Googled devices); module may download on first use. Has `allowManualInput` and `enableAutoZoom` options |
  | Android / iOS | Photo Picker / PHPicker + still-image decode | Not live; no media permission |
  | iOS | System Camera / Control Center handoff | Only for URL codes; no in-app live scanner without permission |
  | Web | `<input type="file" accept="image/*" capture="environment">` | A still photo, not live; desktop shows a file picker |

## The Viewfinder

- **Full-bleed camera, controls on the edges.** Put exit, torch, and Help in a top bar with a
  scrim, keep overlays translucent, and leave the centre clear (Material).
- **Frame shaped for the expected code:** wide for 1D, square for QR. A single-code frame
  also tells the user that one code is read at a time.
- **Region of interest:** decode only inside the frame. A smaller region with fewer formats
  processes faster (vendor docs; iOS `regionOfInterest`).
- **Size the frame so the lens can focus.** On Pro iPhones a small code that fills a big
  frame pulls the phone inside the minimum focus distance (12–15 cm), and the image blurs.
  Apple's fix (WWDC21) is to apply zoom automatically (`minimumFocusDistance`) so people
  hold the phone farther away.
- Don't lock orientation. Decoders read codes at any rotation (ML Kit), and WCAG 1.3.4
  applies on the web.
- **Inline or mini scanners** (a small camera preview docked over a list, as in self-checkout
  or stock counting) keep the context visible. Full-screen suits one-off scans.

## Live States & Guidance

Material's pattern is **sense → recognize → communicate**:

| State | Frame | Text |
|---|---|---|
| Sensing | Pulsing border | "Point your camera at a barcode" |
| Too small / far | Partial border | "Move closer" (or "Move back", see focus above) |
| Detected | Border turns solid; **camera feed pauses** | — |
| Looking up | Progress indicator across the frame | "Searching…" |
| Error | Border turns dotted (not only red) | **Banner** with the reason and actions (Retry, Help) |

- **Pause the feed on detection** so the user doesn't scan a second code by accident.
- **Tooltips describe the state only.** No action verbs in non-actionable hints, and errors
  never go in a tooltip (Material).
- **Debounce 1D misreads:** act only after the same value has decoded several frames in a
  row (ML Kit).
- **Design the post-decode failures:** a code from an unrelated source ("not a product
  code"), no network during lookup, a product not in the database. Each needs manual
  search and a retry.
- **No-detection hint:** no primary source gives a timing. Show help ("Add light", "Hold
  steady", "Try manual entry") after roughly 5–10 s without a detection, as a heuristic.
- **Idle camera:** pausing after ~8–10 s of inactivity saves battery (vendor advice). Pause
  with a one-tap "Resume scanning" and never discard state (WCAG 2.2.1 on the web).

## Hard Conditions: Light, Focus, Zoom

- **Torch toggle** is always in the top bar when the camera supports it. Hide it otherwise
  (desktop webcams, Firefox): check `track.getCapabilities().torch`.
- **Help copy** (Google Pixel's wording): hold steady, add light, avoid glare, clean the lens,
  keep the whole code visible. For **glare on curved or shiny packaging**: tilt or rotate the
  item.
- **Tiny codes:** use a higher-accuracy mode (VisionKit `qualityLevel = .accurate`) and zoom.
  For small or dense codes, use camera input of 1280×720–1920×1080. ML Kit needs the
  smallest module to cover about 2 camera pixels or more, and an EAN-13 about 190 px wide.
- **Zoom:** VisionKit supports pinch-to-zoom by default, and Google Code Scanner and ML Kit
  offer auto-zoom for distant codes. If you implement pinch zoom yourself, add **zoom
  buttons or a slider** as the single-pointer alternative (WCAG 2.5.1).
- **Damaged codes** fall back to manual entry. Some vendor SDKs add OCR of the printed digits.

## Multiple Codes & Continuous Scanning

- **Single mode** (the default): pick the code nearest the centre, and let a **tap choose a
  different one** (VisionKit behaviour).
- **Multi mode:** highlight every detected code with overlays that track movement (keep
  high-frame-rate tracking on), and tap to act on one. ML Kit returns at most 10 codes
  per frame.
- **Continuous or batch** (scanning a shelf, a cart): keep the camera running, list results
  as they arrive, show a running count, and allow undo of the last item.
- **Duplicate suppression** has no standard. Vendor defaults range from 0.5 to 3 s, or "until
  the code leaves the frame". Single-scan flows should simply pause after a hit.

## Feedback: Visual, Haptic, Sound

- **Visual first:** the frame locks, the feed freezes, and the result appears. Use shape as
  well as colour for success and error.
- **Haptics:** iOS `UINotificationFeedbackGenerator` `.success` / `.error`. Android
  `HapticFeedbackConstants.CONFIRM` / `REJECT`. Don't reuse one pattern for opposite
  meanings, and prefer no haptics to buzzy ones (Android). Apple warns that haptics must not
  disrupt the camera, so fire them **after** the frame is captured.
- **Sound:** no platform guideline says on or off. Vendor SDKs default to on. A short beep is
  fine if it respects silent mode, is toggleable, and is never the only signal. On iOS,
  play it with the **`.ambient`** audio session. The default `soloAmbient` stops the
  user's music.
- **Web:** `navigator.vibrate` does nothing on iOS and Firefox Android, so never rely on it.
  Create or resume the `AudioContext` inside the "Start scanning" tap, so later beeps pass
  autoplay rules.

## After the Scan: Auto-Act vs. Confirm

| Code | Action |
|---|---|
| Your own app's payload or a known product ID | Auto-act: look it up and show the result sheet |
| Arbitrary URL | **Preview, then the user taps to open** (as the iOS and Android system scanners do) |
| Structured payload (Wi-Fi, contact, calendar, phone, SMS, geo) | Type-specific preview (SSID, name, number), then a confirm action |
| Login / "link a device" QR | Say exactly what happens ("Sign in on a new device: Chrome on Windows, Berlin") and require explicit confirmation |
| Payment QR | Show merchant name and amount before confirming ([25c](25c-barcode-display.md)) |

ML Kit and VisionKit already parse the common structured types. Use their typed results
rather than re-parsing strings.

## QR Safety (Quishing)

Attackers put stickers over real codes (parking, restaurants), send QR codes in email to
get past link scanners, and use "link a device" codes to hijack messaging accounts (CISA,
Nov 2025). Risk is highest for codes in email and in open public spaces (NCSC UK). The
"Gone Quishing" field study found 67% of participants handed over Google or Facebook
credentials after a QR pretext.

When your app opens scanned URLs:
- **Show a URL preview before opening.** Follow Chromium's URL display rules:
  - Highlight the **registrable domain** (eTLD+1).
  - Elide long hostnames **from the front** so the real domain stays visible.
  - Never show `user:pass@`.
  - Show punycode (`xn--`) for confusable internationalized domains.
- Flag link shorteners, non-HTTPS URLs, and domains that don't match the context (a
  "parking" code going to an unrelated domain).
- Don't auto-open app installs or payment pages from arbitrary QR codes. The FBI says to
  install apps from the store and type known payment URLs.
- For account linking or login by QR, see the table above and
  [25c](25c-barcode-display.md#qr-login--device-pairing).

## Scanning from an Image

Codes arrive in screenshots, PDFs, and emails, and a phone can't point its camera at its
own screen.
- Put **"Choose from photos"** in the scanner and in the permission-denied state.
- iOS: PHPicker (no library permission) + VisionKit `ImageAnalyzer`. Android: Photo Picker
  (no media permission) + ML Kit on a still image. Web: `BarcodeDetector.detect()` or the
  polyfill on an image or blob.
- "No code found in this image" offers a retry with another image and manual entry.

## Accessibility

- **Visual aiming excludes blind users.** Proven research patterns (Smith-Kettlewell BLaDE):
  - Audio cues where **volume = distance** and **tone continuity = centring**.
  - Feedback about **one code at a time**.
  - A target size of 60–80% of the frame for 1D codes.
  - Seeing AI and Google Lookout use beeps or spoken guidance and **auto-capture** with no
    shutter button.
- **Auto-capture** also helps users with motor impairments. Never require a tap while aiming.
- **Announce the result.** On iOS, post a `UIAccessibility` announcement. On Android,
  `announceForAccessibility` is **deprecated since API 36**: move focus to the result, or use
  a live region or pane title instead.
- Label the torch, zoom, exit, and manual-entry controls. Make the targets large and reachable
  one-handed.
- Success and error use shape and text, not just colour (Material switches the frame from a
  solid to a dotted stroke).
- Zoom has a single-pointer alternative (WCAG 2.5.1). No short camera timeouts without a
  resume option (2.2.1).

## Web Specifics

- **`BarcodeDetector` is not Baseline** (MDN compat data, Sept 2026):

  | Browser | Support |
  |---|---|
  | Chrome Android | Yes |
  | Chrome / Edge desktop | macOS and ChromeOS only, **not Windows or Linux** |
  | Safari (macOS, iOS) | Behind a flag only; broken on iOS 18+ (WebKit bug 281848) |
  | Firefox | No |

  All iOS browsers use WebKit, so there's effectively no native detector on iOS web.
- **Fallback:** the `barcode-detector` polyfill (on zxing-wasm / ZXing-C++). It only
  registers when native support is missing. Feature-detect `'BarcodeDetector' in window`
  **and** check `getSupportedFormats()` for your formats. Load the WASM **lazily** when the
  scanner opens, and self-host the `.wasm` for CSP or offline use. ZXing Java and
  `@zxing/library` are in maintenance mode.
- **HTTPS only.** `navigator.mediaDevices` is undefined on insecure origins. In iframes,
  add `allow="camera"`.
- **Camera constraints:** use `facingMode: 'environment'`, not `{exact: ...}`, which throws
  on laptops. Feature-detect `torch`, `zoom`, and `focusMode` through `getCapabilities()`.
  Torch works in iOS Safari only from about iOS 17, despite older claims.
- **Map `getUserMedia` errors to UI:**

  | Error | Meaning |
  |---|---|
  | `NotAllowedError` | Denied or policy-blocked. Show recovery steps |
  | `NotFoundError` | No camera. Hide scan, show manual entry |
  | `NotReadableError` | Camera in use by another app |
  | `OverconstrainedError` | Constraints too strict. Retry with looser ones |

- **Stop the tracks** (`track.stop()`) when the scanner closes or pauses, so the camera
  indicator goes off.
- **iOS Home Screen web apps** historically forget the camera decision and re-prompt. Since
  iOS 26, *every* site added to the Home Screen opens as a web app by default, so plan for
  repeated prompts with brief in-context priming each time.
- **Hybrid apps:** WKWebView needs `requestMediaCapturePermissionFor` (iOS 15+), or users see
  a web prompt on top of the native one. Android WebView needs `onPermissionRequest` plus
  the app's CAMERA permission. Many in-app browsers fail silently here.

## Platform Notes

- **iOS — VisionKit `DataScannerViewController`** (iOS 16+, A12+):
  - Built in: guidance labels ("Slow down"), tap-to-focus, pinch-to-zoom, tap-to-select, and
    optional highlighting.
  - Restrict `recognizedDataTypes` to the symbologies you need, and pick a `qualityLevel`.
  - For full control, use AVFoundation `AVCaptureMetadataOutput` (see the AVCamBarcode sample
    for focus-distance zoom).
- **Android — ML Kit** (on-device, offline): Codabar, Code 39/93/128, EAN, ITF, UPC, Aztec,
  DataMatrix, PDF417, QR. Use CameraX `STRATEGY_KEEP_ONLY_LATEST`, ≤ 2 MP input, and throttle
  the detector. **Google Code Scanner** gives a no-permission, no-custom-UI alternative.
- **Web:** native `BarcodeDetector` where available, the zxing-wasm polyfill elsewhere. See
  above.

---

## Quick Checklist

- [ ] Manual entry and "Choose from photos" beside every scan entry point
- [ ] Scan entry hidden when the device can't scan
- [ ] Permission asked on tap, with a specific purpose string; denied state is non-blocking and links to Settings
- [ ] Frame matches the code shape; torch, exit, and Help in the top bar
- [ ] Only the needed symbologies enabled; region of interest set
- [ ] Sensing → detected → lookup → error states designed; feed pauses on a hit
- [ ] Errors in a banner with a reason and actions, not a tooltip; not colour-only
- [ ] Focus-distance zoom on iOS; zoom buttons if custom pinch
- [ ] Haptic after capture; beep toggleable, respects silent mode (`.ambient` on iOS)
- [ ] Arbitrary URLs previewed (registrable domain highlighted) before opening
- [ ] Login and device-link codes state what they authorize and require confirmation
- [ ] Result announced to screen readers; auto-capture without a shutter tap
- [ ] Web: feature-detect `BarcodeDetector` + formats, lazy WASM fallback, HTTPS, tracks stopped on close

## Common Mistakes

- Scan as the only way to enter a code
- Asking for camera permission at app launch
- A permission-denied dead end with no manual path
- Auto-opening any URL a QR code contains
- Leaving the camera live after a hit, so a second code gets scanned by mistake
- "Move closer" hints on phones where closer means out of focus
- Errors shown as a red tint or a tooltip only
- A beep that stops the user's music
- Relying on `navigator.vibrate` or native `BarcodeDetector` on iOS
- Loading a large WASM decoder on page load instead of when the scanner opens
- Enabling every symbology "just in case"

---

## Sources

- [Material Design (M2) — Barcode scanning pattern](https://m2.material.io/design/machine-learning/barcode-scanning.html)
- [Apple VisionKit — DataScannerViewController](https://developer.apple.com/documentation/visionkit/datascannerviewcontroller) · [WWDC22 — Capture machine-readable codes and text with VisionKit](https://developer.apple.com/videos/play/wwdc2022/10025/) · [WWDC21 — What's new in camera capture](https://developer.apple.com/videos/play/wwdc2021/10047/) · [HIG — Privacy](https://developer.apple.com/design/human-interface-guidelines/privacy) · [HIG — Playing haptics](https://developer.apple.com/design/human-interface-guidelines/playing-haptics) · [AVAudioSession ambient](https://developer.apple.com/documentation/avfaudio/avaudiosession/category-swift.struct/ambient) · [iPhone — Scan a QR code](https://support.apple.com/guide/iphone/scan-a-qr-code-iphe8bda8762/ios)
- [ML Kit barcode scanning](https://developers.google.com/ml-kit/vision/barcode-scanning) · [Android guide](https://developers.google.com/ml-kit/vision/barcode-scanning/android) · [Google Code Scanner](https://developers.google.com/ml-kit/vision/barcode-scanning/code-scanner) · [Android — Request permissions](https://developer.android.com/training/permissions/requesting) · [HapticFeedbackConstants](https://developer.android.com/reference/android/view/HapticFeedbackConstants) · [Photo Picker](https://developer.android.com/training/data-storage/shared/photo-picker)
- [MDN — BarcodeDetector](https://developer.mozilla.org/en-US/docs/Web/API/BarcodeDetector) · [WICG Shape Detection API](https://wicg.github.io/shape-detection-api/) · [WebKit bug 281848](https://bugs.webkit.org/show_bug.cgi?id=281848) · [barcode-detector polyfill](https://github.com/Sec-ant/barcode-detector) · [MDN — getUserMedia](https://developer.mozilla.org/en-US/docs/Web/API/MediaDevices/getUserMedia) · [W3C MediaStream Image Capture](https://www.w3.org/TR/image-capture/) · [WebKit — Safari 26.0 features](https://webkit.org/blog/17333/webkit-features-in-safari-26-0/)
- [FTC — QR code scams](https://consumer.ftc.gov/consumer-alerts/2023/12/scammers-hide-harmful-links-qr-codes-steal-your-information) · [FBI IC3 PSA](https://www.ic3.gov/PSA/2022/PSA220118) · [NCSC UK — QR codes: what's the real risk?](https://www.ncsc.gov.uk/blog-post/qr-codes-whats-real-risk) · [NCSC Ireland — QR phishing](https://www.ncsc.gov.ie/pdfs/Quick_Guide_QR_Code_Phishing_Scams.pdf) · [CISA — messaging app targeting (Nov 2025)](https://www.cisa.gov/news-events/alerts/2025/11/24/spyware-allows-cyber-threat-actors-target-users-messaging-applications) · [Chromium URL display guidelines](https://chromium.googlesource.com/chromium/src/+/HEAD/docs/security/url_display_guidelines/url_display_guidelines.md) · ["Gone Quishing" (arXiv 2204.04086)](https://arxiv.org/abs/2204.04086)
- [Smith-Kettlewell BLaDE](https://www.ski.org/project/blade/) · [Google Lookout](https://support.google.com/accessibility/android/answer/9031274) · [NN/g — QR code guidelines](https://www.nngroup.com/articles/qr-code-guidelines/)
- [WCAG 2.2 — 1.3.4 Orientation](https://www.w3.org/WAI/WCAG22/Understanding/orientation.html) · [2.5.1 Pointer Gestures](https://www.w3.org/WAI/WCAG22/Understanding/pointer-gestures.html) · [2.2.1 Timing Adjustable](https://www.w3.org/WAI/WCAG22/Understanding/timing-adjustable.html)
