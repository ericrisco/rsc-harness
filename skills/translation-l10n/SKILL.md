---
name: translation-l10n
description: "Use when adding a second or Nth language to a web or app product — i18n plumbing (string extraction, ICU messages, locale routing), fixing broken plurals or date formats, and making a UI survive other languages through right-to-left layout and text expansion. NOT defining the brand's tone in one language (that is `brand-voice`)."
tags: [i18n, l10n, internationalization, localization, translation, rtl, icu-messageformat]
recommends: [brand-voice, nextjs, seo-geo, accessibility, content-engine]
origin: risco
---

# Translation & localization

You are making a product speak more than one language *correctly* — not word-for-word. The job splits in two, and confusing them is the root cause of "we translated everything but the dates are still American."

- **i18n (internationalization)** = engineering the code so it *can* hold any locale: no hardcoded strings, externalized catalogs, locale-aware formatting, locale routing. Done once.
- **l10n (localization)** = the per-locale *content* and cultural formatting: the actual translations, plural rules, date/number/currency conventions, RTL layout. Done per language, repeatedly.

Sequence matters: do i18n first. Teams that skip it end up retrofitting string extraction under a launch deadline, which is when concatenation and `count === 1` bugs ship.

## Route out fast

| If the task is really about… | Go to |
| --- | --- |
| Inventing the brand's tone/word bank in one language | `../brand-voice/SKILL.md` |
| App Router structure, RSC, data fetching (non-locale) | `../nextjs/SKILL.md` |
| hreflang strategy, per-country keyword research, geo ranking | `../seo-geo/SKILL.md` |
| Authoring net-new source copy (landing, article) | `../content-engine/SKILL.md` |
| General a11y semantics beyond `lang`/`dir`/bidi | `../accessibility/SKILL.md` |

This skill emits the `lang`/`dir`/alternate plumbing and only touches routing where it is locale-specific. It does not author source copy or invent voice — it moves an existing voice across languages.

## Decision: where are you?

| Symptom | Enter |
| --- | --- |
| Hardcoded strings live in JSX/components | Phase 1 — internationalize the code |
| Plurals/gender are wrong in some language | Phase 2 — ICU MessageFormat |
| Dates/numbers/currency look wrong per locale | Locale-aware formatting (`Intl.*`) |
| Layout breaks, text overflows, Arabic mirrored wrong | Phase 3 routing + RTL & bidi |
| "We have the strings, we need them translated" | Phase 4 — translation workflow |

## Phase 1 — internationalize the code

**Externalize every user-facing string to a catalog.** A string in JSX cannot be translated, pseudolocalized, or counted as missing. Move it to a message file keyed by a stable, namespaced ID.

**Key on intent, not on the English text.** `checkout.payButton` survives a copy change; `"Pay now"` as the key breaks every translation the moment marketing edits the English.

```json
{
  "checkout": {
    "payButton": "Pay now",
    "itemsInCart": "{count, plural, one {# item} other {# items}}"
  }
}
```

**Library choice — pick once:**

| Stack / need | Use | Why |
| --- | --- | --- |
| Next.js App Router | `next-intl` | Request-scoped `i18n/request.ts` + `defineRouting()`, RSC-native, `localePrefix` strategies |
| Cross-stack / existing i18next ecosystem | `next-i18next` / `i18next` | Shared catalogs across React Native, backend, plugins |
| Tiny app, few strings, no plural complexity | `Intl` only | No dependency; you still get correct formatting |

**Never concatenate translated fragments.** Word order is not universal — building a sentence from pieces produces garbage in languages that reorder subject/object/verb.

```tsx
// Bad — three fragments the translator can never reorder
<p>{t("youHave")} {count} {t("messages")}</p>

// Good — one message, named/numeric ICU argument
<p>{t("inbox.summary", { count })}</p>
// "inbox.summary": "{count, plural, one {You have # message} other {You have # messages}}"
```

**Configure a fallback locale.** A missing key in `de` should resolve to `en`, never render the raw key or blank. Set the default/source locale as the fallback at config time.

## Phase 2 — ICU MessageFormat correctly

ICU MessageFormat is the cross-library standard for plurals and `select`, powered by CLDR plural categories. Use it for **plurals and gender only** — keep date/number formatting out (next section).

**CLDR defines up to six plural categories. English uses two; you cannot assume singular/plural is enough.**

| Category | Example languages |
| --- | --- |
| `one`, `other` | English, German, Spanish |
| `one`, `few`, `many`, `other` | Russian, Polish, Czech |
| `zero`, `one`, `two`, `few`, `many`, `other` | Arabic (all six) |
| `other` only | Chinese, Japanese, Korean |

```tsx
// Bad — correct only for English-like 2-form languages
const label = count === 1 ? "item" : "items";

// Good — ICU resolves the right CLDR category per locale
// "cart.items": "{count, plural, one {# item} other {# items}}"
// Russian catalog supplies one/few/many/other; the call site never changes.
```

**Every `plural`, `selectordinal`, and `select` block REQUIRES an `other` clause** — it is the mandatory fallback; without it the message is invalid and the formatter throws.

```icu
{gender, select, female {She replied} male {He replied} other {They replied}}
{place, selectordinal, one {#st} two {#nd} few {#rd} other {#th}} place
```

**Wrap the formatter in try/catch and fall back to the key.** A malformed ICU string from a translator throws at runtime — returning the key keeps the UI alive while you log the error.

```ts
function format(key: string, args?: Record<string, unknown>) {
  try {
    return formatter.format(messages[key], args);
  } catch (err) {
    console.error(`ICU format failed for "${key}"`, err);
    return key; // visible, non-crashing fallback
  }
}
```

See `references/icu-cookbook.md` for nested plural+select, escaping `'` and `{`, and per-language plural-category tables.

## Locale-aware formatting

Dates, numbers, and currency belong to `Intl.*`, **not** inside ICU messages and never string-concatenated. These read CLDR data, so `de-DE` renders `1.000,50` while `en-US` renders `1,000.50` — for free.

```ts
new Intl.NumberFormat("de-DE", { style: "currency", currency: "EUR" }).format(1000.5);
// "1.000,50 €"

new Intl.DateTimeFormat("ja-JP", { dateStyle: "long" }).format(new Date());
// "2026年6月2日"

new Intl.RelativeTimeFormat("es", { numeric: "auto" }).format(-1, "day");
// "ayer"

new Intl.ListFormat("en", { type: "conjunction" }).format(["a", "b", "c"]);
// "a, b, and c"

new Intl.PluralRules("ar").select(3); // "few"  — drives non-ICU plural logic
```

Rule: if you typed a `/`, `,`, `.`, `$`, or `%` into a translated string, you have a bug. Format with `Intl`.

## Phase 3 — locale routing & rendering

For Next.js App Router with `next-intl`, route locale through a `[locale]` segment. Defer all non-locale framework detail to `../nextjs/SKILL.md`.

```ts
// routing.ts
import { defineRouting } from "next-intl/routing";

export const routing = defineRouting({
  locales: ["en", "es", "ar"],
  defaultLocale: "en",
  localePrefix: "as-needed", // 'always' | 'as-needed' | 'never'
});
```

`localePrefix`: `always` (`/en/...`, `/es/...`), `as-needed` (default locale unprefixed), or `never` (locale via cookie/header only). Pick based on your SEO needs — defer the ranking call to `../seo-geo/SKILL.md`.

**Add `generateStaticParams` on the `[locale]` segment** so each locale renders statically. Set `lang` *and* `dir` on `<html>` — `dir` is what flips the layout.

```tsx
export function generateStaticParams() {
  return routing.locales.map((locale) => ({ locale }));
}

export default function RootLayout({ children, params: { locale } }) {
  const dir = locale === "ar" || locale === "he" ? "rtl" : "ltr";
  return <html lang={locale} dir={dir}>{children}</html>;
}
```

## RTL & bidi

**Set direction with the HTML `dir` attribute on the root, not the CSS `direction` property.** `dir` carries semantic meaning the browser and assistive tech use for bidi; CSS `direction` does not. Then write layout with **CSS logical properties** so one stylesheet serves both directions.

| Physical (don't) | Logical (do) |
| --- | --- |
| `margin-left` | `margin-inline-start` |
| `padding-right` | `padding-inline-end` |
| `text-align: left` | `text-align: start` |
| `left: 0` | `inset-inline-start: 0` |
| `border-right` | `border-inline-end` |

These auto-flip with `dir`/`writing-mode`, so RTL needs no separate stylesheet. **Isolate interpolated user content** (names, IDs) with `<bdi>` or `unicode-bidi: isolate` so a Hebrew username doesn't scramble surrounding LTR text.

See `references/rtl-and-bidi.md` for the full mapping, which icons to mirror vs. not, and RTL testing.

## Phase 4 — translation workflow

The 2025–2026 pipeline is MT/TM pre-fill → LLM post-edit (MTPE) → human review, governed by a glossary and translation memory.

1. **Freeze the source.** Translating moving copy doubles the work. Lock strings, then hand off.
2. **Build a glossary/termbase.** Locks product terms ("Workspace", "Boost") to one approved translation per language — keeps terminology consistent and measurably cuts post-edit effort.
3. **Stand up translation memory (TM).** Reuses approved translations for repeat/near-repeat segments across the product, so you never re-translate or re-pay for the same string.
4. **MT pre-fill, then LLM post-edit, then human review.** MT/LLM gives a strong first pass; humans review for nuance. Upstream quality (clear source + glossary + style + TM) is what makes the post-edit cheap.
5. **Preserve placeholders/variables.** `{count}`, `%s`, `<b>…</b>` must survive untouched — validate after every MT/LLM pass.

**Never auto-translate unreviewed:** legal/contract copy (route to `../brand-voice/SKILL.md` and legal review for terms), and brand-voice-critical strings — those need the voice carried deliberately, not machine-flattened.

## Testing

- [ ] **Pseudolocalization first.** Transform source strings: accent the letters, pad +30–40% length, wrap in brackets — e.g. `[Ŝéttîñgś……]`. Surfaces hardcoded strings, truncation/overflow from text expansion, and broken concatenation **before** you hire a single translator.
- [ ] **Missing-key detection.** Fail CI when a locale lacks a key the source has.
- [ ] **Longest-language overflow check.** German/Finnish expand most; verify buttons and fixed-width UI survive.
- [ ] **Per-locale snapshot/visual diff**, including one RTL locale.
- [ ] **Fallback locale resolves**, never the raw key.

## Anti-patterns

| Anti-pattern | Why it breaks | Do instead |
| --- | --- | --- |
| Concatenating translated fragments | Word order differs per language | One ICU message with named args |
| `count === 1 ? x : y` | Wrong for ~most languages (Russian, Arabic…) | ICU `plural` with CLDR categories |
| Date/number formats baked into strings | `1,000.50` is wrong in de-DE | `Intl.NumberFormat`/`DateTimeFormat` |
| `margin-left` everywhere | Doesn't flip for RTL | CSS logical properties |
| Translating in raw spreadsheets, no TM | Drift, repeat work, lost terms | TM + glossary + a TMS |
| Machine-translating legal/brand copy unreviewed | Liability + flattened voice | Human/legal + `brand-voice` |
| No fallback locale | Missing key renders blank/raw | Configure source locale fallback |
| Using English text as the message key | Copy edit breaks all translations | Stable namespaced key |
| Missing `other` clause in ICU | Invalid message, formatter throws | Always include `other` |
| ICU formatting with no try/catch | One bad translation crashes the view | Catch → return key, log |
| Setting direction via CSS, not HTML `dir` | Loses bidi semantics | `dir` attribute on `<html>` |
| Assuming all languages expand equally | DE/FI overflow, ZH contracts | Pseudoloc + longest-language test |

## Handoff checklist

**i18n-ready:** no hardcoded user-facing strings · catalog with stable namespaced keys · fallback locale set · all plurals via ICU · all dates/numbers via `Intl` · CSS logical properties · `lang`+`dir` on `<html>` · pseudoloc passes.

**l10n-ready:** glossary/termbase signed off · TM populated · MT→LLM→human pipeline defined · legal/brand strings flagged for human review · per-locale CI checks (missing keys, overflow, RTL snapshot) green.
