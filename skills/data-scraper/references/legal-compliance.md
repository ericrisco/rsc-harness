# Legal & compliance reference

Depth behind the legal gate in `../SKILL.md`. You are not a lawyer and you never claim to be — you document the basis and flag where a human must sign off.

## robots.txt and ai.txt

Fetch both before queuing URLs. `robots.txt` states crawler preferences by user-agent and path; `ai.txt` (and the `noai` / `noimageai` signals some sites publish) is the emerging objection channel for AI training use specifically.

**Neither is law.** robots.txt is a voluntary convention from 1994 with no statutory force — no jurisdiction makes a `Disallow` binding by itself, and courts treat it as evidence of the parties' expectations, not as the thing you violated. So it is input to your decision, never a hard stop. What *is* binding sits in the sections below: an accepted ToS, data-protection law, and anti-circumvention.

```python
import urllib.robotparser, urllib.parse

def allowed(url: str, ua: str = "my-crawler") -> bool:
    base = "{0.scheme}://{0.netloc}".format(urllib.parse.urlparse(url))
    rp = urllib.robotparser.RobotFileParser()
    rp.set_url(base + "/robots.txt")
    rp.read()                      # network call; cache per host
    return rp.can_fetch(ua, url)   # False -> do not queue this URL
```

Rules:

Working defaults — deviate consciously, not by accident:

- A `Disallow` for your path is the host's stated preference. Honoring it is the default and costs you little; overriding it is a judgment call you record, not a rule you break. Scraping your own property, a site you have written permission for, or public pages for research and archiving are all ordinary reasons to override.
- Respect `Crawl-delay` if present — it is the host telling you its tolerance, and the cheapest way to not get banned.
- An `ai.txt` / `noai` objection means the site objects to AI-training use. Honoring it is the cleanest evidence of good faith and matters most where the use is exactly what was objected to.
- Whatever you decide, log it with the scrape. "We read robots, disallowed `/search`, proceeded anyway because X" is a defensible record; silence is not.

## ToS red flags

Read the terms before scraping. The presence of any of these moves you toward **narrow** or **stop**:

- An explicit "no automated access / no scraping / no crawling" clause.
- Acceptance gated by **login** — accepting at sign-in is the contract hook that made *Meta v. Bright Data* a breach-of-contract case rather than a CFAA one.
- A clause assigning IP/database rights over the listings themselves (common on directories and aggregators).
- An API offered under separate commercial terms — using it routes you to `../api-connector-builder/SKILL.md` and scraping around it looks like circumvention.

## GDPR lawful-basis decision flow

Personal data = names, emails, photos, reviews, IP addresses, anything identifying a natural person. If the scrape touches any:

1. **New purpose check.** Is your purpose the same as why the data was published? Reusing public personal data for aggregation, resale, or AI training is a *new* purpose and a severe breach risk — fines reach tens of millions of EUR.
2. **Lawful basis.** Usually **legitimate interest** for public-data scraping — but it requires a balancing test (your interest vs. the person's reasonable expectations). Document it. See `../gdpr-privacy/SKILL.md` for the LIA.
3. **Minimization.** Collect only the fields the purpose needs. Drop everything else at extraction, not later.
4. **Special categories.** Health, politics, religion, sexual orientation, biometrics (Art. 9) — filter these out at the source. Do not collect them speculatively.
5. **Objection signals.** Honor robots.txt / ai.txt objections as evidence of respecting data-subject expectations.

## Minimization & retention checklist

- [ ] Field list maps 1:1 to the stated purpose — no "just in case" columns.
- [ ] Special categories filtered at extraction.
- [ ] Retention period set, with a deletion trigger (not "keep forever").
- [ ] Source URL + scrape timestamp recorded per record for provenance.
- [ ] A human owner signed off on the basis if any personal data is involved.

## Case summaries (2024-2025)

- **hiQ v. LinkedIn** — scraping *public* data is not automatically a CFAA violation. The floor, not a license; everything else (auth, contract, GDPR) still applies.
- **Meta v. Bright Data (2024)** — the exposure is **breach of contract** when you accepted ToS, typically by logging in. Logged-out public scraping weakens the contract claim. Lesson: stay logged-out, never bypass auth.
- **Reddit v. Perplexity AI (2025)** — centers on whether **rate limits and anti-bot measures were circumvented**, distinct from the public-vs-private axis. Bypassing a control you were shown (CAPTCHA, hard block, enforced limit) is materially worse than pacing public pages. Lesson: pace, do not circumvent.

Sources: groupbwt.com "Web Scraping Legal Issues: 2025 Enterprise Compliance Guide"; sociavault.com court-case roundup; promptcloud.com 2026 compliance guide; medium.com/deep-tech-insights "The €20 Million GDPR Mistake" (2025); zyte.com AI personal-data scraping guidance. All accessed 2026-06-02.
