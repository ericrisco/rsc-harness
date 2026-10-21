# Landing Anatomy & Conversion (CRO)

The CRO playbook. Every section earns its place by doing one job that moves a visitor toward conversion. Pair this with `copywriting-frameworks.md` for the words and `visual-system.md` for the tokens.

## Above the fold

The first viewport decides whether the visitor stays. It must pass the **5-second test**: a stranger reads it and can say what it is, who it's for, and why it's better.

- **F-pattern** for text-dense pages (docs, blogs): the eye sweeps the top line, drops, sweeps again. Put the value prop and primary CTA on the first horizontal sweep.
- **Z-pattern** for sparse hero layouts: top-left brand → top-right nav/CTA → diagonal to the headline → bottom-right primary action.
- **Must be visible without scrolling:** the value prop (headline + subhead), the primary CTA, one proof signal (logo strip or a hard metric), and the product itself (screenshot, terminal, or short loop) — not a stock gradient.

```text
Bad  — Centered headline over an atmospheric gradient; product hidden below fold.
Good — Headline + subhead + "Start free" CTA + a real product screenshot, all above the fold.
```

## Section-by-section anatomy

Each section has a job, a copy framework, an accessibility note, and the conversion principle it serves.

| Section | Job | Copy framework | Conversion principle |
| --- | --- | --- | --- |
| Hero | State the value prop; pass the 5s test | Outcome + timeframe headline | Clarity beats cleverness |
| Logo / social-proof strip | Borrow credibility instantly | "Trusted by N teams" | Social proof / authority |
| Problem / agitation | Name the pain in the reader's words | PAS (Problem-Agitate) | Loss aversion |
| Solution | Show the product doing the job | FAB (feature→benefit) | Concreteness over claims |
| Features → benefits (bento) | Translate capability into outcome | JTBD per cell | Self-relevance |
| How-it-works | Reduce perceived effort | 3-step sequence | Effort reduction |
| Testimonials / case studies | Prove it works for people like them | Quantified quote | Similarity + proof |
| Objection handling | Preempt the top "no" | "X without Y" | Risk reduction |
| Pricing | Make the choice easy | Value framing, anchored | Anchoring + decoy |
| FAQ | Answer real blockers | Question→direct answer | Friction removal |
| Final CTA | One clear action | Value-on-the-button | Single decision |
| Footer | Navigation, legal, trust | Scannable links | Trust + completeness |

Accessibility note for every section: give each `<section>` an accessible name via `aria-labelledby` (pointing at its heading) or `aria-label`, and keep the heading order linear (`h1` → `h2` → `h3`, no skips).

## Full landing skeleton

One complete, copy-pasteable Next.js 15 App Router page: semantic landmarks, exactly one `<h1>`, the Metadata API, and valid JSON-LD.

```tsx
// app/page.tsx — semantic landing skeleton (Next.js 15 App Router)
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Deploy in minutes — Acme",            // 50–60 chars
  description: "Ship a fix in 4 minutes with no YAML and no on-call page. Free to start.", // 120–160
};

export default function Page() {
  return (
    <main>
      <section aria-labelledby="hero-h">
        <h1 id="hero-h">Ship a fix in 4 minutes</h1>
        {/* subhead, primary CTA, product screenshot */}
      </section>
      <section aria-label="Trusted by">{/* logo strip */}</section>
      <section aria-labelledby="pricing-h">
        <h2 id="pricing-h">Pricing</h2>
        {/* 3-tier table */}
      </section>
      <section aria-labelledby="faq-h">
        <h2 id="faq-h">FAQ</h2>
        {/* question/answer list */}
      </section>
      <script
        type="application/ld+json"
        dangerouslySetInnerHTML={{ __html: JSON.stringify({
          "@context": "https://schema.org",
          "@type": "Organization",
          name: "Acme",
          url: "https://acme.example",
        }) }}
      />
    </main>
  );
}
```

## LCP-safe hero

The hero as a Server Component: one `<h1>`, value on the button, a 44px target, and the LCP image
on `next/image` with `priority` and explicit dimensions so nothing shifts.

```tsx
// app/page.tsx — Server Component, LCP-safe hero (Next.js 15 / React 19)
import Image from "next/image";

export default function Page() {
  return (
    <main>
      <section className="mx-auto max-w-5xl px-6 pt-24 text-center">
        <h1 className="text-balance text-5xl font-semibold tracking-tight md:text-6xl">
          Ship the change in an afternoon, not a sprint
        </h1>
        <p className="mx-auto mt-5 max-w-xl text-pretty text-lg text-fg/70">
          Concrete benefit, who it is for, and why now — no hype.
        </p>
        <a
          href="#start"
          className="mt-8 inline-flex min-h-11 items-center rounded-card bg-brand-500 px-6 font-medium text-white transition-colors hover:bg-brand-600"
        >
          Start free
        </a>
        <Image
          src="/hero.avif"
          alt="Product dashboard showing a one-click deploy"
          width={1200}
          height={720}
          priority
          className="mt-16 rounded-card shadow-card"
        />
      </section>
    </main>
  );
}
```

## CTA strategy

- **One primary action per viewport.** A secondary action (ghost button, text link) may accompany it, but never two equal-weight primaries competing for the click.
- **Placement cadence:** above the fold + after the value is established + after pricing + a sticky bar on mobile. Visitors convert at different scroll depths; meet each one.
- **Value on the button:** "Start free", "Get my estimate", "See it live" — never "Submit" or "Click here".

```tsx
// components/sticky-cta.tsx — sticky mobile CTA, hidden on desktop (Client Component)
"use client";

export function StickyCta() {
  return (
    <div className="fixed inset-x-0 bottom-0 z-50 border-t border-fg/10 bg-bg/90 p-3 backdrop-blur md:hidden">
      <a
        href="#start"
        className="flex min-h-11 items-center justify-center rounded-card bg-brand-500 font-medium text-white"
      >
        Start free
      </a>
    </div>
  );
}
```

## Pricing psychology

- **Anchoring:** show the highest tier near the recommended one so the middle reads as reasonable.
- **3 tiers, highlighted middle:** the middle tier is the intended default; mark it with a ring and a "Most popular" badge.
- **Annual default:** show annual pricing first with the monthly equivalent ("$20/mo billed annually") — frames the lower number.
- **Value framing, not feature dumps:** lead each tier with the outcome the buyer gets, then list features.
- **Decoy effect:** a deliberately less attractive tier makes the target tier look better.
- **Risk reversal:** money-back guarantee, free trial, no credit card — lowers the cost of saying yes.

```html
<!-- 3-tier pricing, middle tier highlighted -->
<div class="mx-auto grid max-w-5xl grid-cols-1 gap-6 md:grid-cols-3">
  <article class="rounded-card border border-fg/10 p-6">
    <h3 class="font-semibold">Starter</h3>
    <p class="price mt-2 text-3xl font-semibold">$0</p>
  </article>
  <article class="rounded-card border border-brand-500 p-6 ring-2 ring-brand-500">
    <p class="text-xs font-medium text-brand-500">Most popular</p>
    <h3 class="font-semibold">Team</h3>
    <p class="price mt-2 text-3xl font-semibold">$20<span class="text-base text-fg/60">/mo</span></p>
  </article>
  <article class="rounded-card border border-fg/10 p-6">
    <h3 class="font-semibold">Enterprise</h3>
    <p class="mt-2 text-3xl font-semibold">Custom</p>
  </article>
</div>
```

## Social proof

Logos, quantified testimonials, metrics, and trust badges — each placed where it answers the visitor's current doubt. Logos near the hero borrow authority early; a quantified case study near pricing closes the deal.

```text
Bad  — "This tool is amazing, it changed everything for us!" — Happy Customer
Good — "Cut our deploy time from 22 min to 90 sec." — Priya R., Staff Eng, Northwind
```

Quantified, attributed, specific. A vague rave is worth less than one hard number.

## Objection handling + FAQ

Surface the real reasons a visitor hesitates (price, migration cost, lock-in, security) and answer them directly. Add `FAQPage` JSON-LD **only** when the on-page content matches the markup — fabricated FAQ structured data is a guidelines violation.

```json
{
  "@context": "https://schema.org",
  "@type": "FAQPage",
  "mainEntity": [
    {
      "@type": "Question",
      "name": "Do I need to change my CI pipeline?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "No. Driftway runs as a single CLI step inside your existing pipeline."
      }
    },
    {
      "@type": "Question",
      "name": "Is there a free tier?",
      "acceptedAnswer": {
        "@type": "Answer",
        "text": "Yes. Solo projects are free; paid tiers start at $20/mo billed annually."
      }
    }
  ]
}
```

## A/B mindset + instrumentation

- **One hypothesis at a time.** Change the headline OR the CTA color, not both — otherwise you cannot attribute the lift.
- **Measure:** conversion rate (primary), scroll depth (do they reach pricing?), and INP at the CTA (a janky button costs clicks).
- **Event-hook sketch:** fire a typed event on the primary action so the funnel is measurable.

```ts
// lib/track.ts — minimal typed conversion event
type Event = "cta_click" | "pricing_view" | "signup_start";
export function track(event: Event, props: Record<string, string | number> = {}) {
  // forward to your analytics provider
  window.dispatchEvent(new CustomEvent("analytics", { detail: { event, ...props } }));
}
```

## SEO-aware structure constraint

Enforce the structural constraints here; defer keyword research, GEO, and technical audits to the `../marketing/SKILL.md` sibling (it carries SEO/GEO + keyword intent).

- Exactly one `<h1>`; linear heading order.
- Semantic landmarks (`header`/`nav`/`main`/`section`/`footer`).
- Metadata API: title 50–60 chars, description 120–160 chars.
- JSON-LD presence appropriate to the page: `Organization` sitewide, `Product` on a product page, `BreadcrumbList` for nested routes, `Article` for content, `FAQPage` only when FAQ content matches.

## See Also

- `copywriting-frameworks.md` — the words for every section above.
- `../../marketing/SKILL.md` — deep SEO/GEO, keyword research, and SEO-aware copy structure.
- `../../nextjs/SKILL.md` — App Router Metadata API and rendering specifics.
