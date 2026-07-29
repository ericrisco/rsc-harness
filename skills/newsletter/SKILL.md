---
name: newsletter
description: "Use when running an email newsletter as a recurring publication — subject + preview pair, issues that turn opens into clicks, the welcome sequence, cadence and engagement tiering, growth loops, and a post-Apple-MPP click scorecard. NOT one-off launch or nurture sends (that is `marketing`), NOT SPF/DKIM/DMARC (that is `email-deliverability`)."
tags: [newsletter, email, growth, copywriting, retention-metrics]
recommends: [marketing, email-deliverability, brand-voice, landing-copy, ab-testing]
profiles: []
origin: risco
---

# newsletter

Run the newsletter as a **product you ship on a cadence**, not a one-off send. The job is the system around the recurring issue: the subject + preview that earns the open, the issue body that earns the click, the welcome sequence that activates a new subscriber, the cadence and segmentation that keep the list healthy, the growth loops that compound it, and a scorecard that still tells the truth after Apple broke open rates. Every send is one episode of an ongoing show — design the show, not the episode.

## When NOT to use — route instead

| The ask | Route to |
|---|---|
| One-off product launch announcement or campaign drip nurture | `../marketing/SKILL.md` |
| Mail lands in spam; set up SPF / DKIM / DMARC, tracking domain, reputation | `../email-deliverability/SKILL.md` |
| Write the subscribe / opt-in landing page copy | `../landing-copy/SKILL.md` |
| Define the house voice, tone, and vocabulary the newsletter speaks in | `../brand-voice/SKILL.md` |
| Win back / reactivate lapsed *paying customers* (lifecycle, not readers) | `../retention/SKILL.md` |
| Produce the underlying long-form articles the issue links out to | `../content-engine/SKILL.md` |
| Sample size / significance / MDE math for the test itself | `../ab-testing/SKILL.md` |
| Source or scrape new contacts; prospect an un-opted-in list | `../lead-gen/SKILL.md`, `../cold-outreach/SKILL.md` |
| Actually wire the send through an ESP / Gmail API and schedule it | `../email-connector/SKILL.md`, `../google-workspace/SKILL.md` |

You own the *recurring opted-in publication and its open/click/growth system*. The plumbing under every send and the page that captures the signup are someone else's.

## The metric truth after Apple MPP

Apple Mail Privacy Protection pre-fetches the tracking pixel, firing an "open" even when nobody read the email. It accounts for **~49% of all tracked opens** and inflates reported open rate by **~15–35%** on iOS-heavy lists — one beehiiv newsletter jumped from a 28% to a 55% open rate with zero behavior change. So **stop steering on open rate.** MPP does not touch link tracking, which is why the click is now the honest signal.

**Rule: make click rate and non-Apple CTOR the north star, because the click is the one event MPP cannot fake.** Leading 2025 programs removed open rate from decision-making entirely and anchor on clicks.

Calibration benchmarks (2025, cross-industry): average open rate ~42–43% (MPP-inflated, treat as noise), average click rate ~2.1% (range 0.83%–4.90%), click-to-open ~6.8%, conversion ~0.08% (top decile ~0.44%). Use the click figures to calibrate; ignore the open figure as a target.

The scorecard — track these, in this order:

| Metric | What it tells you | Trust |
|---|---|---|
| Net engaged readers (clicked in last N issues) | The list that actually exists | High — steer on this |
| Click rate (unique clicks / delivered) | Did the issue earn action | High |
| CTOR on the **non-Apple** segment | Did the body convert the open | High |
| Unsubscribe rate | Cadence / relevance pain | Medium |
| Spam-complaint rate | Inbox placement risk (gate, not vanity) | High — keep < 0.1% |
| Open rate | Almost nothing post-MPP | Low — do not target |

## Issue anatomy — one job per issue

Each issue gets **exactly one job and exactly one primary CTA.** A second CTA halves the first. Put the hook on the first screen (subject's promise paid off before any scroll), keep the body scannable (short paragraphs, one idea per block, links that read as links), and end at a single button-grade action.

```text
Bad (rambling, no single job, CTA buried):
  Hey everyone! Lots going on this week — we shipped some updates, there's a
  webinar coming, I read a great book, and oh also our pricing changed, plus
  here are five links I liked. Anyway, check it all out when you get a chance!

Good (one promise, one payoff, one CTA):
  This week: the 3-line config change that cut our cold-start by 40%.
  • What it was   • Why the default is wrong   • The exact diff
  → Read the 4-minute breakdown   [single primary link]
```

Everything secondary becomes a one-line P.S. or a small "also" block, never a competing button.

## Subject + preview as a pair

The subject and the preview (preheader) ship together and are tested together — they share the inbox row.

- **Payload in the first ~33 characters**; keep the whole subject ~30–50 chars (≈7–9 words) so it survives mobile truncation.
- **The preview extends the subject, it never repeats it.** Its first ~35–50 chars are prime real estate; waste them on a duplicate and you've burned the line.
- **≤2 emojis, at the end, never an all-emoji subject** — an all-emoji subject is the one case that actually trips filters.
- **The "spam trigger words" list is a myth.** "Free", "guarantee", a normal emoji — these do not sink you; authentication and sender reputation dominate deliverability. Police reputation, not vocabulary; the reputation/auth layer lives in `../email-deliverability/SKILL.md`.

```text
Bad (payload past char 33, preview repeats subject):
  Subject:  We are very excited to finally share our big new feature today!!!
  Preview:  We are very excited to share our big new feature

Good (payload first, preview extends):
  Subject:  Cut cold-start 40% with 3 lines
  Preview:  The default config is wrong — here's the exact diff and why
```

## Cadence & segmentation

Cadence is not one number for the whole list — it branches on how engaged the reader is. This is the decision table:

| Engagement tier | Signal | Frequency | Track |
|---|---|---|---|
| Heavy | Clicked most recent 2–3 issues | Full / can increase | Primary issue + occasional bonus |
| Active | Opened-and-clicked within ~30 days | Full | Primary issue |
| Cooling | No click in ~30–60 days | Reduce | Best-of / slower nurture |
| Dormant | No click in ~90+ days | Pause | Re-permission ("still want this?") then **sunset** |

Sunset dormant addresses on purpose — **complaint rate, not list size, gates the inbox.** Mailing a decaying list harder is how a sender torches its reputation.

Send-time default: **Tuesday/Thursday mid-morning (~10am) or early afternoon (1–3pm)** is the cross-industry baseline — but treat it as a *hypothesis to test against your own list's click data*, not a law. Segmented sends earn roughly **100% higher click rates** than blast-to-everyone, so segment before you optimize send time. Tier definitions and the full sunset/re-permission flow live in `references/growth-loops.md`.

## The welcome sequence

A confirmed subscriber gets a **3–5 email sequence**, not silence until the next issue — this window is the highest engagement they'll ever have. One job per email:

1. **Deliver the promise (immediate)** — the thing they signed up for, instantly. Sets the expectation that you ship value.
2. **Set expectations + best-of (day 1–2)** — what arrives, how often, plus your best past issue so they see the ceiling.
3. **The referral ask (day 4–5)** — once they've gotten value, ask them to share (the theSkimm pattern: referral ask *inside* the welcome, not bolted on later).
4–5. Optional: segmentation/preference capture and a feedback prompt.

Full skeleton with timing, subject+preview per email, and the one-job rule: `references/welcome-sequence.md`.

## Growth loops

Three loops compound the list; depth and the dated numbers are in `references/growth-loops.md`.

- **Referral** — referral programs lift subscriber growth ~17% on average and can accelerate growth 20–200% (The Hustle's referral drives ~10%+ of its free-list growth). Put the ask inside the welcome sequence and at the issue footer, gated on tiered rewards.
- **Signup incentive / lead magnet** — a specific, immediately useful asset converts the subscribe far better than "join our newsletter". The asset is what gets shared.
- **Double opt-in** — confirm the address before it joins. It protects list quality and keeps the complaint rate down, which is what actually keeps you in the inbox. The subscribe *page* itself is `../landing-copy/SKILL.md`.

## Compliance baseline

A newsletter is the canonical bulk marketing message, so the Gmail/Yahoo bulk-sender rules (enforced since Nov 2025 for 5,000+/day senders) apply to every issue:

- **RFC 8058 one-click unsubscribe** (`List-Unsubscribe` + `List-Unsubscribe-Post` headers) on every send, plus a **visible footer unsubscribe link.** Both, always.
- **Keep the spam-complaint rate under 0.1%** and never let it reach 0.3%. This is why you sunset, not why you mail harder.

The DNS / authentication side of those rules — SPF, DKIM, DMARC, the sending domain — is **not this skill**; that is `../email-deliverability/SKILL.md`. This skill applies the rules to the issue and the cadence.

## A/B testing the right way

- **Test exactly one element at a time** — subject vs subject, or preview vs preview. Change two and the winner is uninterpretable.
- **Put preview text in the rotation**, not just the subject; it's half the inbox row and usually under-tested.
- The statistical design — sample size, significance, minimum detectable effect — is `../ab-testing/SKILL.md`. This skill tells you *what* to test; that one tells you whether the result is real.

## Anti-patterns

| Pattern | Why it fails | Fix |
|---|---|---|
| Steering on open rate post-MPP | ~49% of opens are bot-fired; the number is fiction | Steer on click rate + non-Apple CTOR |
| Two or more primary CTAs in one issue | They split attention; the main action loses | One job, one button per issue |
| Preview text repeats the subject | Burns half the inbox row on a duplicate | Preview extends the subject with new info |
| Mailing a decaying list harder | Complaints climb; reputation and inbox placement collapse | Sunset / re-permission the dormant tier |
| All-emoji subject line | The one emoji case that actually trips filters | ≤2 emojis, at the end, around real words |
| Policing "spam trigger words" | A myth; reputation/auth decide deliverability | Fix auth + reputation in `../email-deliverability/SKILL.md` |
| Buying a list / no double opt-in | Spam traps and complaints gate the whole sender | Double opt-in; grow with referral + lead magnet |
| Testing two variables at once | Winner is uninterpretable | One variable; preview in the rotation |
| Referral ask bolted on months later | Misses peak engagement | Put the ask inside the welcome sequence |
| Same cadence for the whole list | Heavy readers under-served, dormant ones complain | Tier the cadence by engagement |

## Verify

`scripts/verify.sh` is a read-only structural linter for a drafted issue file (`subject:` / `preview:` lines, body, footer). It checks subject length and payload position, that the preview exists and differs from the subject, emoji count, a single primary-CTA marker, and a present unsubscribe line. Run it on the draft before you ship — it never edits the file and exits 0 on an empty one.
