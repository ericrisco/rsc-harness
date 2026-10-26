# Scanner-Driven Workflows

Warehouse, logistics, retail POS, field service, and healthcare apps where the **scan is
the primary input**. The devices are rugged handhelds, ring scanners, keyboard-wedge USB or
Bluetooth scanners, and fixed-mount or presentation scanners. The worker's eyes are on the
shelf, the parcel, or the patient, and their hands are busy, often gloved. Throughput is
high: GS1 targets 40–70 items per minute at POS. An unclear failure turns into a
workaround, and in healthcare workarounds hurt people.

This file also holds the **symbology and GS1 primer** that the other barcode files link to.

> Consumer camera scanning: [25a-barcode-camera-scanning.md](25a-barcode-camera-scanning.md).
> Showing codes for others to scan: [25c-barcode-display.md](25c-barcode-display.md).
> Offline and sync UI in general: [12b-conflict-resolution-sync.md](12b-conflict-resolution-sync.md).

---

## Contents

- Devices & What They Mean for UX
- Scan-First Design
- Input Capture: Wedge vs. Intent/SDK
- Scan Routing
- Eyes-Free Feedback
- Error Recovery
- Verification Patterns & Healthcare (BCMA)
- Batch, Counters & Undo
- Manual Entry Fallback & Audit
- Screen Design for the Floor
- Offline, Retries & Idempotency
- Training & Multilingual Crews
- Symbology & GS1 Primer
- Quick Checklist
- Common Mistakes
- Sources

---

## Devices & What They Mean for UX

| Device | How scans arrive | UX consequence |
|---|---|---|
| Rugged Android handheld (Zebra, Honeywell) | Vendor service: Zebra DataWedge, Honeywell Scan Wedge / Intent API / SDK | Prefer intent/SDK delivery; hardware trigger works on every screen |
| Ring / wearable scanner (Zebra RS5100, ProGlove) | Bluetooth to a host device | Eyes aren't on the host screen. Route feedback to the wearable (haptic, LED) |
| USB/BT keyboard-wedge scanner | Keystrokes, like a keyboard | Needs a focused field; the browser can't tell it from typing; keyboard-layout issues |
| Fixed-mount / POS presentation | Continuous or presentation mode | Dedupe the same code staying in view; dual-marked items |
| Phone camera inside an ops app | Camera SDK | Fallback only. Turn it off when the device has a scanner (D365 "Scan with camera") |

**NFC/RFID** complement barcodes rather than replacing them. HF/NFC suits a deliberate tap
(badges, patient or asset tags). UHF RFID reads many tags without line of sight. DataWedge
reports `source=rfid` through the same intent, so one handler can accept both.

## Scan-First Design

- **The scan is the navigation.** Each step asks for one thing, the scan answers it, and
  the app moves on. Tapping is the exception.
- **Name the expected scan** in a large step prompt: "Scan location", "Scan item",
  "Scan pallet LP". Not a generic "Scan or enter here". Microsoft replaced that
  placeholder in the D365 warehouse app.
- **One scan, many fields.** A GS1 code carries GTIN, batch, expiry, and quantity together.
  Parse it and fill every field it covers, and show the screen only when the worker needs
  to act (D365 multi-field GS1 policy with auto-submit).
- Show the **current task context** (order, location, remaining qty) at a size readable
  at arm's length. The worker glances at it; they don't read it.

## Input Capture: Wedge vs. Intent/SDK

| | Keyboard wedge (keystroke output) | Intent / SDK |
|---|---|---|
| Setup | None; works in any text field | App integration per vendor |
| Needs focus in a field | **Yes** | No; works over dialogs and on any screen |
| Symbology known | Only via a configured AIM prefix | Yes (`label_type`, `aimId`) |
| Control chars (GS 0x1D) | Often lost, especially in web apps | Raw bytes available (`decode_data`) |
| Keyboard-layout bugs | Yes | No |

**Prefer intent/SDK** on dedicated devices. Use a wedge when you must: web apps, desktop
POS, BYO scanners.

**Wedge rules:**
- **Suppress the soft keyboard** on scan fields with `inputmode="none"`. Don't use
  `readonly`, because a readonly field ignores the scanner's keystrokes too.
- **Configure a suffix** (Enter or Tab) to end the scan. Microsoft recommends letting the
  *device* send Enter instead of auto-submitting in the app, because vendors differ: the
  same app auto-submits on Zebra but waits for confirmation on Honeywell.
- **Configure a prefix** (AIM symbology ID or a custom one). It identifies scans far more
  reliably than timing, and it tells GS1 data apart from plain data.
- **Keyboard layout:** the scanner maps characters using its *own* keyboard-country
  setting (US by default). On a German host, Y and Z swap and punctuation breaks. If
  a scan fails format validation, say "Scanner keyboard layout may not match" instead
  of "Item not found".
- Scanner keystrokes can trigger browser shortcuts. Capture and consume them during a scan burst.
- **Honeywell** opens URL barcodes in the browser by default (`DATA_PROCESSOR_LAUNCH_BROWSER`
  = true), so no read event reaches your app. Turn it off for GS1 Digital Link or URL codes.
- **Zebra** keystroke output doesn't deliver control characters as key events to web
  apps by default. GS1 separators vanish (see the primer).

**Telling a wedge scan from typing** (use only when you can't use a prefix or intent).
The thresholds are defaults from the widely used onScan.js library, not a standard.
Calibrate them per device. Timing breaks with configured inter-character delays (DataWedge allows
up to 1000 ms), slow Bluetooth HID, and remote-desktop sessions.

```js
// Timing heuristic: humans type ~100-200 ms/char, scanners burst in a few ms/char.
const MAX_GAP = 30, MIN_LEN = 6;            // onScan.js defaults; calibrate per device
let buf = '', last = 0;
addEventListener('keydown', e => {
  if (e.timeStamp - last > MAX_GAP * 3) buf = '';   // long gap -> new burst
  last = e.timeStamp;
  if (e.key === 'Enter' || e.key === 'Tab') {
    if (buf.length >= MIN_LEN) { e.preventDefault(); onScan(buf); }
    buf = ''; return;
  }
  if (e.key.length === 1) buf += e.key;     // printable only; GS (0x1D) may not arrive
}, true);                                   // capture phase: independent of focus
```

This doesn't stop the characters from also landing in a focused input. Route the scan
explicitly, or clear the field on detection.

## Scan Routing

- **Route by content, not only by focus.** Check the symbology or prefix, parse the payload,
  then decide: SSCC → pallet, GTIN → item, location-label pattern → location. The focused
  field is a hint, not the only rule.
- **Global listener.** A scan must work while an error, confirmation, or options dialog is
  open. D365 added a dedicated global listener after dialogs were swallowing scans.
- **Transient UI never steals focus.** A success toast on iOS once left the D365 scanner
  stuck in a non-ready state.
- **Unexpected type at this step** (e.g. a location scanned when the step wants an item):
  say what was scanned and what's expected ("That's location A-12-03. Scan the item.").
  If the intent is clear, offer the jump.
- **Unknown GS1 AIs:** skip the element rather than rejecting the whole scan (Microsoft's
  recommended setting). Log it.
- Keep the scan button for scanning only. OCR, RFID, and other capture methods get their own
  controls (SAP Fiori).

## Eyes-Free Feedback

Every scan produces **sound + haptic + visual** feedback, distinct for each outcome, and
readable without looking closely at the screen.

| Outcome | Sound | Haptic | Visual |
|---|---|---|---|
| Accepted | Short, high beep | Short single pulse | Full-screen green flash ~1 s + ✓ + value |
| Warning (accepted, check something) | Distinct mid tone | Two short pulses | Amber banner + text |
| Rejected / mismatch | Low, long, or repeated tones | Long or double pulse | Red full-screen state + ✕ + reason; stays until acknowledged or rescanned |

- The conventions come from Zebra's classic beeper codes (short high = good decode; long
  low = error), D365/ProGlove wearable haptics (single crisp pulse = OK; double pulse =
  "stop and check the screen"), and the DataWedge decode screen notification (green overlay,
  1000 ms default, adjustable 500–1500 ms).
- **Never colour alone** (WCAG 1.4.1). Pair colour with an icon, text, and a sound and
  haptic pattern that differ per outcome.
- **Too fast:** if the system can't keep up, say so with a distinct alert and "rescan"
  (D365 added exactly this).
- Give **per-user volume and vibration settings** (D365: vibration 0–5, sound 0–10, separate
  success/failure/warning sounds). Floors are loud, and hospital wards are quiet at night.
- **Meaningless beeps get muted.** In Koppel's BCMA study, staff disabling audio alarms was a
  workaround, and confusing alert beeps and noise were listed as causes. Keep the sound
  vocabulary small and distinct.
- Wearables: send the result to the ring or glove (LED + haptic). The host screen may be in a
  pocket or on a cart.

## Error Recovery

| Situation | Handling |
|---|---|
| Wrong item for this pick | Block. Show expected vs scanned (name + image), error feedback, require a rescan. No "accept anyway" without a reasoned, audited override |
| Duplicate scan | Same code in view: same-symbol timeout. Same code via two channels (wedge + intent both on): dedupe (D365 duplicate-scan protection). Intentional repeat: count it and show the new total |
| Unknown code | Show the raw value and symbology, and offer manual lookup or "report label". Never add unknown barcodes to the master data on the spot (see ISMP below) |
| Over-scan (qty exceeded) | Stop at the limit, show "10 of 10 — this one is extra", and offer to put it back or report it |
| Invalid format / check digit | "Couldn't read that correctly — rescan", not "Not found". Possibly a short read or layout issue |
| Server error | Show the server's **specific** message. D365 had to fix a generic failure message that hid it |

- **No modal traps.** Error states clear with the next valid scan or a trigger press, not only
  by tapping a small OK button with gloves on.
- **Crowded labels:** enable picklist mode (decode only what's under the crosshair) or ask
  the user to cover the other codes.
- **Dual-marked retail items** (1D + 2D within 50 mm): count them once.

## Verification Patterns & Healthcare (BCMA)

**Warehouse:** location → item → quantity confirmation, where each scan verifies the
previous instruction. A confirmation scan (D365 "ProductConfirmation") is cheaper than
a mis-pick.

**Barcode medication administration** is the best-studied scanning workflow:
- **Poon et al., NEJM 2010** (14,041 administrations): with BCMA + eMAR, non-timing
  administration errors fell 41.4%, potential ADEs from them fell 50.8%, timing errors fell
  27.3%, and transcription errors were eliminated. Errors were reduced, not eliminated.
- **Koppel et al., JAMIA 2008:** 15 workaround types and 31 causes. Patient wristbands were
  taped to carts, doorjambs, or belt rings; a single package was scanned for several doses;
  documentation happened before administration; audio alarms were disabled. Causes included
  unreadable or crinkled labels, chewed wristbands, non-barcoded meds, dying batteries, poor
  Wi-Fi, and emergencies.
- **van der Veen et al., JAMIA 2018:** workarounds in 66% of administrations, with 3.06×
  the odds of error. The most common were not scanning at all, and no wristband.
- **ISMP:** hard-stop product scanning; overrides only for real emergencies; track compliance
  and override rates; fix the barriers behind workarounds. In an ISMP case, adding
  unscannable barcodes on the fly let a strength mismatch (15 mg vs 5 mg) get overridden.

**Design takeaways:**
- Make **compliance easier than the workaround**: bedside wristband reprint, a flow that
  works offline, and readable feedback in dim rooms.
- Scan the patient *and* the medication. A manual-key path must still run the same
  verification.
- Overrides are visible, need a selected reason, and are audited.
- US drug barcodes are changing: the FDA's 2026 final rule moves to a 12-digit NDC and allows
  2D barcodes (effective 2033, with a transition to 2036). Parsers must accept both NDC
  lengths and 2D symbols.

## Batch, Counters & Undo

- **Continuous scanning:** show a running count and the **last scanned value** prominently.
  Allow **one-tap undo of the last scan** in a non-modal way. (There's no published standard;
  this is the common pattern.)
- **Batch round trips.** Sending a server request per scan doesn't scale at many scans per
  second (Microsoft's multi-scan pages). Collect scans locally and submit them in one call
  with per-item results.
- **Multi-barcode capture** (Zebra NG SimulScan) reads several codes per trigger. Show
  which codes were read and which were missed on a visual of the label.
- **Quantity from the scan** can override the default ("PO for 10, scanned 5"), but only
  when configured, and the difference is shown.

## Manual Entry Fallback & Audit

- **Every scan step has a manual path.** Labels get crinkled, smudged, torn, missing, or
  printed on a curved surface (ISMP asked manufacturers to stop printing across round
  surfaces).
- **Validate typed and scanned values the same way:** check digit, field ranges (month
  01–12), length limits, numeric-only fields.
- Use a numeric keypad for numeric IDs (`inputmode="numeric"`), and support external numpads.
- **Record the input method** (scan vs manual vs override) with a reason. Track the manual
  and override rate per user, site, and product. A rising rate points to a bad label or a
  broken flow, not a bad worker.

## Screen Design for the Floor

- **Scalable UI.** D365 gives text scale 70–400% and button scale 50–200%, plus a
  high-contrast theme. Offer comparable ranges.
- **Handedness.** Let the user put the primary button bottom-right or bottom-left (D365
  "best button position").
- **Gloves.** Glove sensitivity is a *device* touch-panel mode (Zebra: glove, wet, finger).
  The app's part is larger targets. The bare-hand baseline is ~9 mm (48dp; Parhi et al.
  found 9.2–9.6 mm for one-handed thumb use). The "15–20 mm for gloves" figures are vendor
  blog heuristics, so test with the real gloves.
- **Sunlight and freezers.** Reflections collapse contrast. Use a high-contrast theme,
  heavy weights, no light-grey text, and never colour-only state.
- **Hardware trigger** scans from every screen, and a trigger press must never activate an
  on-screen button by accident (D365 fixed a trigger submitting a summary step).
- **Product photo** on pick steps allows visual confirmation alongside the scan.
- **Shared devices:** make the signed-in worker obvious (name plus a per-user colour theme, as in D365).
- Small truck-mount and vehicle screens (~640 px) need their own layout.

## Offline, Retries & Idempotency

- **Every scan transaction gets a client ID, and the server dedupes it.** D365 once resent
  a submitted page after a timeout without telling the worker, which could complete warehouse
  work twice.
- **Tell the worker about retries**, and never silently resubmit.
- **Keep in-progress state** when the network drops. Don't bounce the worker to sign-in and
  lose the task (another D365 fix).
- Wi-Fi dead zones cause workarounds (Koppel), so offline or degraded mode is a requirement.
  Queue scans locally with a visible pending count, sync with per-item results, and show
  conflicts (e.g. stock already moved) as a reviewable list. See
  [12b](12b-conflict-resolution-sync.md).

## Training & Multilingual Crews

There's little research here; these are heuristics:
- Scan-driven steps need less reading. Short verbs plus icons, and sound and haptics that
  carry meaning without language.
- **Language per user, not per device.** Shared devices change hands every shift.
- Step instructions that can be switched off once learned (D365 "Don't show again").
- Test RTL layouts for the crews you actually have.
- Inadequate training is a documented cause of workarounds (Koppel). Build a practice or
  sandbox mode.

---

## Symbology & GS1 Primer

### Symbologies

| Symbology | AIM ID | Typical use |
|---|---|---|
| EAN-13 / UPC-A / UPC-E | `]E0` | Retail item at POS |
| EAN-8 | `]E4` | Small retail items |
| ITF-14 | `]I1` (scanner checked the check digit) / `]I0` | Outer cartons |
| GS1-128 | `]C1` | Logistics labels: SSCC, batch, expiry |
| Code 128 (non-GS1) | `]C0` | Internal IDs |
| Code 39 | `]A0` | Legacy internal |
| GS1 DataBar | `]e0` | Fresh food, coupons |
| GS1 DataMatrix | `]d2` | Healthcare UDI, pharma |
| Data Matrix with GS1 Digital Link | `]d1` | Retail 2D |
| QR with GS1 Digital Link / GS1 QR | `]Q1` / `]Q3` | Retail 2D, consumer links |
| PDF417 | — | IDs, tickets, boarding passes |

- AIM identifiers are **generated by the decoder**, not stored in the symbol, and they're
  case-sensitive. Have the scanner prefix them so the app can tell `]C1` (GS1) from `]C0`
  (plain) without guessing.
- **Enable only the symbologies the screen needs.** Zebra recommends disabling every
  decoder the app doesn't need, to improve scanning performance. Honeywell likewise warns
  that enabling everything degrades decoding. Use per-screen profiles (DataWedge profiles
  bind to the app or activity).
- **Short reads:** ITF and Code 39 without a fixed length or check digit can decode a
  fragment as a valid shorter number. If you must enable them, restrict lengths.
- 1D laser scanners can't read 2D codes or (reliably) screens. See [25c](25c-barcode-display.md).

### GS1 element strings

- Element strings look like `(01)09521101530001(17)210119(10)AB-123`. The parentheses
  exist **only in the human-readable text**, never in the data.
- **FNC1 in the first position** marks a GS1 symbol. Variable-length fields are ended by a
  separator, which **decodes as `<GS>` (ASCII 29, 0x1D)**. GS1 warns that receiving systems
  often mangle it, and keyboard wedges often drop it. Configure the scanner to substitute a
  printable character (e.g. `~`), or use intent or raw-byte delivery.
- **Predefined-length AIs** are recognised by their first two digits only: 00, 01, 02, 11–17,
  20, 31–36, 41. Every other AI needs a separator unless it comes last, **even if its own
  definition says "fixed length"**.
- Common AIs:

  | AI | Meaning | Format |
  |---|---|---|
  | 00 | SSCC (logistic unit) | 18 digits |
  | 01 | GTIN | 14 digits |
  | 10 | Batch/lot | up to 20 alphanumeric |
  | 17 | Expiry date | YYMMDD |
  | 21 | Serial number | up to 20 alphanumeric |
  | 30 | Variable count | up to 8 digits |
  | 310n | Net weight, kg (n = decimals) | 6 digits |

- **Dates:** YYMMDD, with the century resolved within −49 to +50 years of today. **DD = 00
  means the last day of the month** (`160200` = 2016-02-29). Show the resolved date, never
  the raw "00".

### Check digits

- GS1 mod-10 algorithm for GTIN, GLN, and SSCC: weight the digits ×3, ×1 alternately,
  **starting with ×3 at the rightmost data digit**, sum them, and subtract the sum from the
  next multiple of 10. It catches all single-digit errors and most adjacent transpositions.
- **The scanner usually does not check it.** EAN/UPC readers verify the check digit, and
  ITF-14 does only when the AIM ID is `]I1`. For GS1-128, DataBar, DataMatrix, QR, and
  DotCode, the symbol's own error detection guarantees the *decode* but not the GTIN.
  GS1 says the application **shall** verify it. Validate typed entries the same way.

### GS1 Digital Link

- A URI form of GS1 data, e.g. `https://id.gs1.org/01/09520123456788/10/ABC123?17=180426`.
  The primary key (01 GTIN, 00 SSCC, 414 GLN) and its qualifiers (10, 21) go in the path,
  and attributes (17 expiry) go in the query. The GTIN is always zero-padded to 14 digits.
- **Any domain** may host it. Parse by path syntax, not by the `id.gs1.org` domain.
- The same code serves the shopper's phone (opens a web page) and the POS (reads the GTIN).
  The POS app must **not** open a browser (see the Honeywell default above).

### Sunrise 2027 (2D at retail POS)

- GS1's goal: retail POS globally able to read the GTIN from both linear and 2D codes by
  the **end of 2027**. Accepted 2D forms are GS1 DataMatrix, and Data Matrix or QR carrying
  GS1 Digital Link.
- It's a milestone, not a switch-off. Products keep the linear barcode until 90% of POS
  systems are 2D-capable, so POS must **dedupe dual-marked items**.
- The opportunity is the extra data at the till: block sales of expired items, flag recalled
  batches.

---

## Quick Checklist

- [ ] Each step names the expected scan; one GS1 scan fills every field it covers
- [ ] Intent/SDK delivery on dedicated devices; wedge fields use `inputmode="none"` and a suffix
- [ ] Scanner prefix (AIM ID) configured; scans routed by content and type, not only focus
- [ ] Scans work over dialogs; toasts and transient UI never steal focus
- [ ] Distinct success/warning/error sound + haptic + full-screen visual; not colour-only
- [ ] Wrong / duplicate / unknown / over-scan each have a specific message and a rescan path; no modal traps
- [ ] Only needed symbologies enabled, per screen; ITF/Code 39 length-restricted
- [ ] App verifies check digits; GS separator survives the input path; DD=00 dates resolved
- [ ] Manual entry on every step, validated like scans, logged with method and reason
- [ ] Overrides reasoned, audited, and rate-tracked
- [ ] Client transaction IDs + server dedupe; no silent resubmits; offline queue with pending count
- [ ] Text/button scaling, handedness, high contrast, large targets tested with gloves
- [ ] Per-user language and sound/vibration settings on shared devices

## Common Mistakes

- A generic "Scan or enter" prompt on every step
- Scans lost because focus left the input, or a dialog was open
- Soft keyboard popping up over the screen on every scan field
- One beep for everything, or silence. Workers mute feedback that means nothing
- A red flash as the only sign of an error
- An error dialog that needs a precise tap to dismiss before the next scan
- Enabling every symbology "to be safe", which is slower and risks short reads
- Trusting the scanner to validate the GTIN check digit
- Hard-coding `id.gs1.org` or stripping GS characters in a GS1 parser
- Letting staff register unknown barcodes on the spot (the ISMP strength-mismatch case)
- A manual-entry path that skips the verification the scan would have done
- Silent retry after a timeout, completing the work twice
- Treating a high override rate as a training problem instead of a label or flow problem

---

## Sources

- [GS1 General Specifications](https://www.gs1.org/standards/barcodes-epcrfid-id-keys/gs1-general-specifications) (§5.1.3 symbology IDs, §7.2.7 check digit verification, §7.8 separators, §7.9 check digit) · [GS1 Digital Link URI syntax](https://ref.gs1.org/standards/digital-link/uri-syntax/) · [GS1 2D in retail](https://ref.gs1.org/guidelines/2d-in-retail/) · [GS1 US Sunrise 2027](https://www.gs1us.org/industries-and-insights/by-topic/sunrise-2027)
- [Zebra DataWedge — intent output](https://techdocs.zebra.com/datawedge/latest/guide/output/intent/) · [keystroke output](https://techdocs.zebra.com/datawedge/latest/guide/output/keystroke/) · [barcode input & feedback](https://techdocs.zebra.com/datawedge/latest/guide/input/barcode/) · [profiles](https://techdocs.zebra.com/datawedge/latest/guide/profiles/)
- [Honeywell Mobility SDK](https://sps.honeywell.com/us/en/software/productivity/development-tools/mobility-sdk-android) · [Honeywell — keyboard layout](https://sps-support.honeywell.com/s/article/Scanner-does-not-support-my-keyboard-layout-wrong-characters-are-displayed)
- [Microsoft D365 Warehouse Management — GS1 barcodes](https://learn.microsoft.com/en-us/dynamics365/supply-chain/warehousing/gs1-barcodes) · [auto-submit behavior](https://learn.microsoft.com/en-us/dynamics365/supply-chain/warehousing/warehouse-app-autosubmit-behavior) · [haptic feedback](https://learn.microsoft.com/en-us/dynamics365/supply-chain/warehousing/warehouse-app-haptic-feedback) · [user settings](https://learn.microsoft.com/en-us/dynamics365/supply-chain/warehousing/warehouse-app-user-settings-themes) · [what's new](https://learn.microsoft.com/en-us/dynamics365/supply-chain/warehousing/warehouse-app-whats-new) · [multi-scan pages](https://www.microsoft.com/en-us/dynamics-365/blog/it-professional/2018/12/20/customizing-the-warehouse-mobile-app-multi-scan-pages/)
- [MDN — inputmode](https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Global_attributes/inputmode) · [onScan.js](https://github.com/axenox/onscan.js)
- [Poon et al., NEJM 2010 — BCMA and eMAR](https://www.nejm.org/doi/full/10.1056/NEJMsa0907115) · [Koppel et al., JAMIA 2008 — BCMA workarounds](https://pmc.ncbi.nlm.nih.gov/articles/PMC2442264) · [van der Veen et al., JAMIA 2018](https://academic.oup.com/jamia/article-abstract/25/4/385/4091349) · [ISMP workaround case (NABP)](https://nabp.pharmacy/news/blog/regulatory_news/ismp-common-workaround-contributes-to-override-of-barcode-alert/) · [ISMP — round surfaces](https://home.ecri.org/blogs/ismp-news/ismp-calls-for-manufacturers-to-stop-printing-medication-barcodes-across-round-surfaces)
- [FDA 2026 NDC format and barcode rule](https://www.federalregister.gov/documents/2026/03/05/2026-04368/revising-the-national-drug-code-format-and-drug-label-barcode-requirements) · [21 CFR 201.25](https://www.ecfr.gov/current/title-21/chapter-I/subchapter-C/part-201/subpart-A/section-201.25)
- [Parhi et al. 2006 — target size for one-handed thumb use](https://www.microsoft.com/en-us/research/wp-content/uploads/2006/01/parhi-mobileHCI06.pdf) · [Zebra touch panel modes](https://docs.zebra.com/us/en/mobile-computers/handheld/tc5-series/tc52-product-reference-guide/settings/display-settings/setting-touch-panel-mode.html)
- [RFID in healthcare scoping review](https://pmc.ncbi.nlm.nih.gov/articles/PMC9398041/)
