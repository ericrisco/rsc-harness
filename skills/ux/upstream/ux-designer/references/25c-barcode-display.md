# Displaying Barcodes & QR Codes

This file covers codes that *your* UI shows for someone else to scan: tickets, boarding
passes, loyalty cards, wallet passes, QR login and pairing, payment QR, kiosk and slide
codes, and printed labels and receipts. Most failures here are physical. The module is
too small, the quiet zone is clipped, the theme inverts the code, or the scanner at the
gate is a laser. The UX work is making the code big, clean, bright, and instantly
retrievable, plus a fallback for when it still won't scan.

> Scanning codes with the phone camera: [25a-barcode-camera-scanning.md](25a-barcode-camera-scanning.md).
> Hardware scanners and scan-driven apps, plus the symbology/GS1 primer:
> [25b-barcode-scanner-workflows.md](25b-barcode-scanner-workflows.md).
> Short version of the primer: QR/DataMatrix/Aztec are 2D and read by camera imagers;
> PDF417 is stacked-linear; EAN/UPC/Code 128 are 1D and the only kind a laser can read.

---

## Contents

- Choosing the Symbology & Payload
- Sizing: Modules, Quiet Zone, Distance
- Error Correction, Contrast & Polarity
- Presenting the Code on a Screen
- Brightness & Wake Lock
- Dark Mode & Forced Inversion
- Fast Retrieval & Offline Access
- Wallet Passes
- Security: Rotating Codes & Screenshots
- QR Login & Device Pairing
- Payment QR (EMVCo)
- Human-Readable Fallback
- Codes on Kiosks, Slides & Signage
- Print: Labels, Receipts, Boarding Passes
- Quick Checklist
- Common Mistakes
- Sources

---

## Choosing the Symbology & Payload

| Use | Symbology | Why |
|---|---|---|
| Phone screen, general | QR | Universal camera support, square, fits portrait screens |
| Boarding pass (mobile) | Aztec, QR or DataMatrix | IATA BCBP (Res. 792) allows all three with no preference; readers should support all three |
| Boarding pass (paper) | PDF417 (default) | IATA; 2D matrix allowed since BCBP v7 |
| Retail product, 2D | GS1 DataMatrix or QR with GS1 Digital Link | GS1 2D-in-retail |
| Must be read by legacy laser scanners | 1D (Code 128, EAN) **on paper** | Lasers can't read 2D and can't reliably read screens |
| Apple Watch | QR (square) | Rectangular codes get rotated; Code 128 is not shown on watchOS |

- **Encode an ID, not the data.** A short payload means a lower QR version, which means
  bigger modules at the same physical size. Apple notes that the most common use of a
  pass barcode is a unique ID that points to server records.
- For Wallet passes, send a **fallback array** of formats. The first one the OS supports is
  shown (e.g. EAN-13 on iOS 27+, QR on older versions).
- Use `iso-8859-1` message encoding for pass barcodes. Scanners handle Unicode poorly.

## Sizing: Modules, Quiet Zone, Distance

Size is set by the **module** (the smallest square or bar), not by the image. A bigger
image with a denser code doesn't help.

| Rule | Value | Source |
|---|---|---|
| QR quiet zone | **4 modules** on all sides | ISO/IEC 18004, DENSO WAVE, GS1 |
| Micro QR quiet zone | 2 modules | DENSO WAVE |
| DataMatrix quiet zone | 1 module | GS1 |
| Aztec quiet zone | none (central finder) | IATA BCBP guide |
| EAN-13 / EAN-8 / ITF-14 & GS1-128 quiet zone | 11X left + 7X right / 7X / 10X | GS1 |
| Module on a screen | **≥ 0.25 mm physical** | IATA BCBP guide |
| Module in print, standard scanners | ≥ 0.25 mm, ≥ 4 printer dots | DENSO WAVE |
| GS1 retail 2D X-dimension | min 0.396 / target 0.495 / max 0.990 mm | GS1 |
| Minimum printed QR | 2 × 2 cm | NN/g (heuristic) |
| Distance | +1 cm of code per 10 cm of scan distance (~10:1) | NN/g (heuristic, not in ISO) |

- **Screens:** high-density displays can make a code physically tiny. Size it in physical
  units (mm/pt), not device pixels. Render with an **integer number of device pixels per
  module** and no smoothing (`image-rendering: pixelated` when upscaling a bitmap; SVG
  with `shape-rendering: crispEdges`). Fractional scaling blurs module edges. No
  standard gives a minimum pixel count; the "≥150 px" figures online come from vendor blogs.
- **Scanner side:** camera decoders need the smallest module to cover about 2 camera
  pixels or more (ML Kit). That's why a code that's fine up close fails from a distance.
- **Quiet zone** is part of the code. Anything that intrudes on it (a border, rounded
  screen corner, notch, toast, cookie bar, home indicator) can break decoding.

## Error Correction, Contrast & Polarity

- **QR error correction:** L 7%, M 15%, Q 25%, H 30% of codewords recoverable.
  **Default to M** (DENSO: the most commonly chosen level). Use Q/H only for dirty or damaged
  environments or a centre logo. Higher levels make the symbol denser.
- **Logos** use up error-correction capacity (GS1). If you add one, raise the level and test.
- **Contrast:** dark modules on a light background, two colours only. **Don't use red for
  dark modules**, because scanners and verifiers use red light (GS1). Don't reshape modules
  (dots, hearts) or warp the grid.
- **Inverted (light-on-dark):** ISO 18004 allows it and GS1 requires POS imagers to read
  it, but many camera decoders don't (ZXing needs `TryInverted`, and ML Kit has open
  issues). **Always render dark-on-light**, even in a dark UI.

## Presenting the Code on a Screen

- Give the code a **dedicated screen or sheet**: the code as large as fits the width, the
  holder's name and seat/gate/date above it, and nothing animated over it.
- In a dark theme, put the code on its **own white card that includes the quiet zone**.
- Keep the code clear of notches, rounded corners, sticky headers, toasts, and banners.
- Prefer portrait for QR/Aztec. A long 1D code may need a rotate-to-landscape option or
  a 2D alternative.
- Several tickets: one per page with a pager ("2 of 4") and swipe, so staff can scan them
  in sequence. Don't show them in a scrolling list of small codes.
- Decorative motion (Ticketmaster's sweeping line) is a visual anti-screenshot cue only.
  The security comes from the rotating code underneath.

## Brightness & Wake Lock

| Platform | Mechanism | Behaviour |
|---|---|---|
| iOS | `UIScreen.main.brightness = 1.0` | Persists **until device lock, even after the app closes**. Save the old value and restore it when the code screen closes or backgrounds |
| Android | `WindowManager.LayoutParams.screenBrightness = BRIGHTNESS_OVERRIDE_FULL` | Per window; reverts automatically when the window leaves the front |
| Web | **none** | The Screen Brightness API is only a WICG proposal. Ask the user: "Turn up brightness for faster scanning" |
| Web | `navigator.wakeLock.request('screen')` | Keeps the screen from dimming or locking (Baseline 2025, HTTPS). Released when the page is hidden; re-request on `visibilitychange`. Doesn't change brightness |

- Boost brightness **only while the code is visible**, and restore it on exit.
- Apple Wallet maxes brightness with no opt-out, and light-sensitive users complain
  about it (community reports; not documented by Apple). Offer an in-app toggle if your
  audience includes photosensitive users.

## Dark Mode & Forced Inversion

- Chrome Auto Dark Theme, Vivaldi, and some email clients (Outlook for Windows) recolor
  pages and can **invert QR codes**. Forced dark broke WhatsApp Web's login QR.
- Opt the code out with `color-scheme: only light` on its container (or
  `<meta name="color-scheme" content="only light">` for the whole page).
- CSS, SVG, or canvas-drawn codes are more at risk than `<img>`. In email, bake a white
  quiet zone into the image and preview it in dark mode.

## Fast Retrieval & Offline Access

The code gets used at a turnstile, with a queue behind the user and bad signal.

- **Save for offline on first view** and say so ("Available offline"). Never make the
  code depend on a network fetch at the gate.
- Offer **Add to Apple Wallet / Google Wallet**. Wallet passes can surface on the lock
  screen near the right time or place.
- Put the next upcoming ticket **one tap from app launch** (home card or widget), not
  behind Orders → Order → Ticket.
- Email is the weakest channel. IATA notes you have little control over how the code
  renders there. Link from the email to the app, wallet, or a mobile-optimized page.
- Give a fallback path on the ticket screen: order number, and "show ID at the desk".

## Wallet Passes

- Put the barcode through the pass APIs, **never baked into a pass image** (Apple HIG).
- **Apple:** `barcodes` array (QR, PDF417, Aztec, Code 128; iOS 27 adds Code 39, Codabar,
  EAN-13, ITF). `altText` shows under the code, but **not on watchOS**. Lock-screen
  relevance comes from `relevantDate` and up to 10 `locations`/`beacons`.
- **Google:** `BarcodeType` covers the common 1D and 2D types; `alternateText` is the
  human-readable fallback. Rotating barcodes (below) exist for PDF417 and QR only.
- A signed payload lets a gate verify offline, but it can't carry changing state such
  as balances or single-use coupons.

## Security: Rotating Codes & Screenshots

- **Rotating codes are the real control.** Google Wallet rotating barcodes use TOTP
  (RFC 6238), typically rotating every minute. Ticketmaster SafeTix rotates every 15 s
  (vendor claim). The scanner accepts only the current value, plus a server-side
  single-use check.
- **Screenshot blocking isn't security.** Someone can photograph the screen with another
  phone. iOS has no public API to block screenshots; it can only detect them after the
  fact (`userDidTakeScreenshotNotification`) or detect recording (`UIScreen.isCaptured`).
  Android `FLAG_SECURE` blanks screenshots but is unreliable on older versions. The
  Android 14 screenshot-detection API shows a system toast, so explain it in context.
- Don't block screenshots of codes users legitimately need to keep, such as boarding
  passes and static loyalty cards. Blocking them breaks offline access and helps no one.
- If a static fallback exists for rotating codes, it undoes most of the protection (Google).

## QR Login & Device Pairing

A QR that signs in or links a device is a phishing target: QRLJacking (OWASP),
"free Nitro" Discord QR scams, and device-code phishing (Microsoft's Storm-2372, 2024–26).

**Displaying device (TV, desktop, new device):**
- Say what the code does and which app scans it: "Scan with the *App* app on your phone
  to sign in on this TV."
- Show the **short URL and a typed code** next to the QR. RFC 8628 requires the
  `user_code` to be shown and recommends the text URL. Use a confusable-free alphabet in
  dash-separated groups (e.g. `WDJB-MJHT`).
- Short lifetime, auto-refresh, and a visible countdown. Warn "Never scan a sign-in code
  someone sent you."

**Approving device (the phone that scans):**
- Show what's being authorized: device type, app, approximate location or IP, and time.
- Require explicit confirmation plus re-authentication (WhatsApp asks for biometrics or
  a passcode before linking a device).
- Make "This wasn't me" as prominent as "Approve".

## Payment QR (EMVCo)

- **Merchant-presented (MPM):** the merchant shows the code and the payer's *payment app*
  scans it. The OS camera usually can't handle it, so signage should name the accepted apps.
  Static codes (`11`, a counter sticker) vs dynamic (`12`, per transaction with the amount).
- **Consumer-presented (CPM):** the payer's phone shows the code and the merchant's scanner
  reads it. The display rules in this file apply: brightness, offline-generated if possible,
  a short validity window.
- The payer app shows the **merchant name and amount before confirmation**.
- Payload ≤ 512 characters. EMVCo sets no size or error-correction rules of its own, so
  use ISO 18004 and DENSO guidance.

## Human-Readable Fallback

- Always pair the code with a **human-readable value** that staff can key in: Apple
  `altText`, Google `alternateText`, a printed number under the code.
- Retail items with **only** a 2D code must print the 14-digit GTIN as HRI (GS1). GS1
  logistics labels use HRI ≥ 3 mm high, in a legible font such as OCR-B.
- For marketing and login codes, show a short, typeable URL as well (NN/g).

## Codes on Kiosks, Slides & Signage

- QR codes carry no information scent, so **label where the code goes and why to scan it**
  (NN/g).
- Leave a slide or screen code up for **≥ 15 s** so people can find their phone (NN/g).
- Size for the farthest viewer with the 10:1 heuristic, and mount signage at a height
  that doesn't force a steep camera angle.
- Kiosk printers and screens: test with the actual scanners and paper stock before launch.

## Print: Labels, Receipts, Boarding Passes

- Print quality grades: ISO/IEC 15416 (1D) and 15415 (2D), A–F. The overall grade is the
  worst parameter. GS1 retail 2D minimum is **1.5/12/660**; many distributors require B.
- Thermal printers: 200 dpi → 0.5–0.75 mm modules; 300 dpi → 0.33–0.5 mm (4–6 dots per module).
- Don't truncate 1D bar height (GS1 EAN-13 minimum height is 18.28 mm).
- Boarding pass PDF417: narrow element ≥ 0.25 mm, height ≥ 6.35 mm. Place it near the
  page edge so a mounted scanner's foot doesn't cover it (IATA).
- During the retail 2D transition, keep the 1D and 2D codes within 50 mm of each other (GS1).

---

## Quick Checklist

- [ ] Payload is a short ID/URL; symbology fits the scanner and screen (QR default)
- [ ] Quiet zone intact (QR 4 modules) and clear of UI chrome, notches, and overlays
- [ ] Module ≥ 0.25 mm physical; integer device pixels per module; no smoothing
- [ ] Dark-on-light, two colours, not red; opted out of forced dark (`color-scheme: only light`)
- [ ] Error correction M by default; H only with a logo or harsh conditions, then tested
- [ ] Brightness boosted only while the code is shown and restored on exit (iOS!); wake lock on web
- [ ] Available offline, one tap from launch, Add to Wallet offered
- [ ] Human-readable value and a staff fallback (order number / ID) visible
- [ ] Anti-fraud uses rotating codes + server checks, not screenshot blocking
- [ ] Login/pairing QR: says what it does, has a typed code, expires; the approver sees device details and re-auths
- [ ] Printed codes verified to grade (GS1 ≥ 1.5, target B) with the real printer and stock

## Common Mistakes

- Inverting the code with a dark theme, or letting the browser force-dark it
- Showing a dense code at a fixed pixel size that comes out physically tiny on a high-DPI phone
- Cropping the quiet zone with a card border or rounded corner
- Code only reachable online, or buried several screens deep
- Leaving the screen at full brightness after the user leaves (iOS persists it until lock)
- Expecting laser scanners to read a code from a phone screen
- Relying on screenshot blocking instead of rotating codes
- A login QR with no explanation, no typed alternative, and an approver screen that doesn't say what it's approving
- Stylized QR codes (coloured, rounded dots, big logos) shipped without testing on several decoders

---

## Sources

- [DENSO WAVE — QR Code quiet zone, module size, error correction](https://www.qrcode.com/en/howto/code.html) · [cell size](https://www.qrcode.com/en/howto/cell.html) · [error correction](https://www.qrcode.com/en/about/error_correction.html)
- [ISO/IEC 18004:2024 preview](https://cdn.standards.iteh.ai/samples/83389/dee29007cb62437f9767323e6af02f90/ISO-IEC-18004-2024.pdf)
- [GS1 — 2D barcodes in retail](https://ref.gs1.org/guidelines/2d-in-retail/) · [Solution provider 2D readiness](https://ref.gs1.org/sme-guidance/solution-provider-2d-readiness/) · [GS1 Sweden size guide](https://gs1.se/en/guides/how-to-guides/size-guide/)
- [IATA BCBP Implementation Guide v7](https://www.iata.org/contentassets/1dccc9ed041b4f3bbdcf8ee8682e75c4/2021_03_02-bcbp-implementation-guide-version-7-.pdf)
- [Apple HIG — Wallet](https://developer.apple.com/design/human-interface-guidelines/wallet) · [Wallet pass barcodes](https://developer.apple.com/documentation/walletpasses/pass/barcodes-data.dictionary) · [PassKit Programming Guide](https://developer.apple.com/library/archive/documentation/UserExperience/Conceptual/PassKit_PG/Creating.html) · [UIScreen.brightness](https://developer.apple.com/documentation/uikit/uiscreen/brightness)
- [Google Wallet — rotating barcodes](https://developers.google.com/wallet/tickets/events/resources/rotating-barcodes) · [BarcodeType](https://developers.google.com/wallet/reference/rest/v1/BarcodeType)
- [Android WindowManager.LayoutParams](https://developer.android.com/reference/android/view/WindowManager.LayoutParams) · [FLAG_SECURE guidance](https://developer.android.com/security/fraud-prevention/activities) · [Screenshot detection](https://developer.android.com/about/versions/14/features/screenshot-detection)
- [MDN — Screen Wake Lock API](https://developer.mozilla.org/en-US/docs/Web/API/Screen_Wake_Lock_API) · [WICG Screen Brightness proposal](https://github.com/WICG/proposals/issues/17) · [Chrome Auto Dark Theme](https://developer.chrome.com/blog/auto-dark-theme)
- [RFC 8628 — OAuth Device Authorization Grant](https://www.rfc-editor.org/rfc/rfc8628.html) · [OWASP QRLJacking](https://owasp.org/www-community/attacks/Qrljacking) · [Microsoft — Storm-2372 device code phishing](https://www.microsoft.com/en-us/security/blog/2025/02/13/storm-2372-conducts-device-code-phishing-campaign/)
- [EMVCo QR Codes](https://www.emvco.com/emv-technologies/qr-codes/) · [What, why and how of EMV QR](https://www.emvco.com/knowledge-hub/the-what-why-and-how-of-emv-qr-codes/)
- [NN/g — QR code guidelines](https://www.nngroup.com/articles/qr-code-guidelines/)
- [ML Kit barcode scanning — input image guidelines](https://developers.google.com/ml-kit/vision/barcode-scanning/android)
