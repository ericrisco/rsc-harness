---
name: email-deliverability
description: "Use when mail already sent lands in spam, is rejected, or fails the Gmail/Yahoo bulk-sender checks and the fix is authentication and reputation, not the sending code: SPF/DKIM/DMARC alignment, domain warmup, spam-complaint rate, one-click unsubscribe, BIMI. NOT putting mail on the wire through a provider API (that is `email-connector`)."
tags: [email, deliverability, spf, dkim, dmarc, bimi, sender-reputation, bulk-sender]
recommends: [email-connector, newsletter, cold-outreach, gdpr-privacy, data-policy]
origin: risco
---

# email-deliverability — make mail authenticate and land in the inbox

This skill owns one layer: **why mail you already send gets filtered, deferred,
or rejected, and the DNS + reputation work that fixes it.** It starts where the
send technically succeeds but the message never reaches the inbox.

The lever is almost never the sending code. It is three DNS records that must
*align*, a complaint rate you must hold down, and a reputation you build slowly
and lose fast. Treat this as ops on a domain, not a code change.

## Not this skill

- **Sending the mail at all** — provider SDK, `sendEmail()` seam, templates,
  retries, batch caps, bounce/complaint webhooks → `../email-connector/SKILL.md`.
  That skill feeds the suppression list; this one explains the reputation it
  protects.
- **Subject lines, open/click optimization, list growth** → `newsletter`.
- **Outbound prospecting sequences, lead lists** → `cold-outreach` (deliverability
  is a *constraint* on it, not the same job).
- **Consent, lawful basis, retention of the address list** → `gdpr-privacy` and
  `data-policy`. Unsubscribe *mechanics* live here; consent *law* does not.
- **Handling the DKIM private key and provider API secrets** →
  `../secure-coding/SKILL.md`.

## The three records that must align

SPF, DKIM, and DMARC are not three ways to do the same thing. DMARC is the
policy; it *passes* only when SPF or DKIM both authenticate **and align** with
the visible `From:` domain. Most "SPF is set but DMARC fails" tickets are an
alignment miss, not a missing record.

| Record | What it asserts | Common break |
|---|---|---|
| SPF (TXT) | This IP/host is allowed to send for the domain | Lists the provider but the `Return-Path` is a different domain → no alignment |
| DKIM (TXT) | This message body+headers are signed by a key the domain published | Provider signs with `provider.net`, not your domain → no alignment; or a deprecated 1024-bit key (publish 2048-bit, rotate periodically) |
| DMARC (TXT at `_dmarc`) | What to do when neither aligns, plus where to send reports | Policy left at `p=none` forever; never tightened |

```dns
; DMARC — start at none to collect reports, then tighten to quarantine/reject.
_dmarc.acme.com.  IN TXT  "v=DMARC1; p=none; rua=mailto:dmarc@acme.com; fo=1"
```

Alignment rule, stated once: the domain in `From:` must match the domain SPF
authenticated (the `Return-Path`/envelope domain) **or** the domain in the DKIM
`d=` tag. Use a custom Return-Path and a domain-keyed DKIM selector through your
provider so at least one aligns. Verifying SPF alone passing is the classic
false comfort.

## Gmail / Yahoo bulk-sender rules

If you send **more than ~5,000 messages/day** to Gmail or Yahoo accounts, these
are enforced, not advisory. Enforcement ramped from late 2025; failures now draw
temporary and permanent rejections, not silent spam-foldering.

1. **SPF + DKIM both set, and DMARC present** at minimum `p=none`. At least one
   of SPF/DKIM must align with `From:`.
2. **One-click unsubscribe** (`List-Unsubscribe` + `List-Unsubscribe-Post`) on
   marketing/promotional mail, honored within **2 days**. Transactional mail
   (password reset, receipt, shipping) is exempt.
3. **Spam-complaint rate** kept low. The hard threshold where filtering kicks in
   is **0.3%** (Postmaster Tools); Google's reliable-inbox target is **below
   0.1%**. Treat 0.3% as the cliff, 0.1% as the speed limit.

```text
List-Unsubscribe: <https://acme.com/u/abc123>, <mailto:unsub@acme.com?subject=unsub>
List-Unsubscribe-Post: List-Unsubscribe=One-Click
```

## BIMI — the verified logo, last

BIMI shows your brand logo (and on Gmail a blue verified checkmark) next to the
message. It is the **last** step, never a fix for placement: it requires you have
*already* passed DMARC at enforcement, and it changes how a delivered message
looks, not whether it gets delivered.

Hard prerequisite: DMARC at `p=quarantine` or `p=reject` with `pct=100`. A record
left at `p=none` does **not** qualify — that is why "add BIMI to escape the spam
folder" is backwards; you cannot publish it until the auth work is done.

Whether the logo (and checkmark) actually render depends on the certificate:

| Approach | Cost / proof | Where it shows |
|---|---|---|
| Self-asserted (no certificate) | Free; logo only | Yahoo, Fastmail — **not** Gmail |
| CMC (Common Mark Certificate) | Cheaper; ~12 months of public logo use, no registered trademark | Gmail + the rest, with checkmark |
| VMC (Verified Mark Certificate) | ~$749–$1,500/yr; needs a registered (or government-modified) trademark | Gmail + the rest, with checkmark |

Active mark-certificate issuers in 2026: DigiCert, GlobalSign, SSL.com (Sectigo
resells; Entrust exited mark certificates in 2025). The logo file must be **SVG
Tiny PS 1.2**, square, with no scripts or external references.

```dns
; BIMI — only valid once DMARC is at quarantine/reject with pct=100.
; a= is the VMC/CMC PEM; omit it for a self-asserted (non-Gmail) logo.
default._bimi.acme.com.  IN TXT  "v=BIMI1; l=https://acme.com/logo.svg; a=https://acme.com/vmc.pem"
```

Do BIMI only after weeks of clean, enforced DMARC. It amplifies a good
reputation; it does not create one.

## Warm a cold domain (decision flow)

A brand-new domain has zero reputation; blasting volume on day one looks exactly
like a spammer. Warm only if the domain genuinely has no history.

- **New domain, no send history** → warm: start ~20-50/day to *engaged*
  recipients, roughly double every few days over 4-6 weeks, watch Postmaster
  reputation before each step up. Send your most-opened content first.
- **Established domain, new provider/IP** → warm the *IP* path, not the domain;
  migrate a slice of volume and ramp.
- **Established domain, same IP, sudden spam folder** → do NOT warm; this is a
  reputation or auth regression. Read the rejection code and Postmaster trend
  first (see the error table).

Skipping warmup to "just send the campaign" is the most common self-inflicted
blacklisting. There is no fast path; reputation is earned by consistent,
low-complaint sending.

## Read the rejection, then act

| Signal | Likely cause | Fix |
|---|---|---|
| `550 5.7.26` | Message unauthenticated — SPF and DKIM both failed/missing | Publish SPF + DKIM through the provider; confirm at least one aligns |
| `dmarc=fail` in headers, SPF=pass | Alignment miss: `Return-Path` ≠ `From:` domain | Set a custom Return-Path on your domain, or align the DKIM `d=` |
| `421`/`451` deferral, then later delivery | Receiver throttling an unwarmed/spiky sender | Slow the ramp; spread volume; warm the domain |
| Postmaster "Bad" domain reputation | Sustained complaints / spam-trap hits | Cut volume, prune unengaged, fix consent, hold under 0.1% complaints |
| Lands in Promotions (not Spam) | Not a failure — bulk/marketing classification | Leave it; do not chase the Primary tab by faking transactional headers |

## Anti-patterns

| Anti-pattern | Why it breaks | Do instead |
|---|---|---|
| "SPF passes, so we're authenticated" | DMARC needs *alignment*; SPF on a mismatched Return-Path still fails DMARC | Verify DMARC result in headers, not SPF alone; align Return-Path or DKIM |
| Leaving DMARC at `p=none` forever | Publishes intent to enforce nothing; spoofers and filters both notice | Collect `rua` reports, then move to `quarantine` then `reject` |
| `p=reject` on day one with no report review | Silently drops your own legitimate sub-streams (CRM, support tools) | Stage `none` → `quarantine` → `reject`, reading reports at each step |
| Blasting full volume from a new domain | Looks like spam; gets throttled/blacklisted with no recovery for weeks | Warm: tiny start to engaged users, ramp over 4-6 weeks |
| Buying/scraping a list to hit volume | Spam traps + complaints spike past 0.3% → domain reputation tanks | Send only to opted-in, engaged recipients; prune the unengaged |
| Faking transactional headers to dodge Promotions | Violates bulk rules; risks rejection, not just foldering | Accept Promotions placement; earn Primary via engagement |
| Routing the unsubscribe to a form that takes a week | Breaks the 2-day one-click honor rule; raises complaints | Honor `List-Unsubscribe-Post` one-click within 2 days, automatically |
| Adding BIMI to fix spam-foldering | BIMI needs DMARC enforcement you do not have yet, and it changes logo display, not placement | Fix auth + reputation first; add BIMI last as a branding layer |
