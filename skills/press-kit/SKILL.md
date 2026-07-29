---
name: press-kit
description: "Use when writing a press release or assembling a media kit a journalist can lift from — launches, funding, exec hires, partnerships, milestones, awards, or an online newsroom. Symptoms include a release that reads like an ad, a buried lede, no quotable line, or a missing dateline, boilerplate or asset. NOT finding the reporter list (that is `lead-gen`), NOT the multi-touch pitch cadence (that is `cold-outreach`), NOT the brand tone-of-voice spec (that is `brand-voice`), NOT the owned launch campaign (that is `marketing`)."
tags: [press-release, media-kit, pr, public-relations, boilerplate, embargo, newsroom, journalist-outreach]
recommends: [cold-outreach, lead-gen, brand-voice, brand-identity, case-studies, article-writing, marketing, social-publisher, email-connector]
origin: risco
---

# press-kit

You write **the document a journalist receives and the kit they pull from** — one
formatted press release plus the assembled media kit (boilerplate, fact sheet,
bios, asset manifest, contact block) laid out so a busy reporter can lift the
story without a second email.

The leverage is form, not enthusiasm. **72% of journalists call the press release
the single most useful resource a PR team offers, and 79% use releases to generate
story ideas** (Cision 2025 State of the Media, 3,000+ journalists / 19 markets).
The release is not dead — it just gets skipped when it ignores newsroom convention:
no dateline, no end marker, a 900-word company history where a 5-W lede should be,
no quotable line, no attached asset. Your job is to make the artifact match the
form reporters scan, so the story survives the inbox.

You produce: a `.md`/`.txt` press release with a header line and `###` marker, a
≤100-word boilerplate, a fact sheet, a multimedia manifest with usage notes, exec
bios, a press-contact block, and the short pitch email that carries it. You do
**not** source the reporter list, write the brand-voice spec, or wire the send.

## Is this news, and which type?

First gate: **is this news or an ad?** A release earns the form only if a reporter
who does not work for you would care. "We updated our pricing page" is not news.
"We raised $12M to do X" is. If the answer is no, route the user to
`../marketing/SKILL.md` for an owned-channel launch post instead — do not dress an
ad up as a release.

Then pick the type. The type decides what the lede leads with:

| Release type   | The lede leads with                                  |
|----------------|------------------------------------------------------|
| Product launch | What it does + who it is for + availability date     |
| Funding round  | Amount + round + lead investor + what it funds        |
| Exec hire      | Name + role + the credential that makes it news       |
| Partnership    | The two parties + what the joint offering enables     |
| Product update | The capability that is new + the user problem it ends  |
| Milestone      | The number + why it is a category signal, not a brag  |
| Award          | The award + the independent body + what it validates   |
| Event          | What + when/where + why a reporter should attend       |

Per-type lede angles, must-include facts, and a worked lede for each (plus crisis)
live in `references/release-types.md`. Read it before drafting an unfamiliar type.

## The release skeleton

One page, ~300–500 words, inverted pyramid, 2–4-sentence paragraphs, at least one
stakeholder quote. Reporters scan for the markers below; missing them signals an
amateur and gets the release skipped.

```text
FOR IMMEDIATE RELEASE          ← header line; or EMBARGOED UNTIL [date time TZ]

Headline That States the News in One Line
Subhead carrying the second-most-important fact

SAN FRANCISCO, CA, June 2, 2026 — [5-W lede: who did what, when, where, why,    ← dateline + lede
in ~40 words. The story must stand alone if the reporter reads only this.]

[Body ¶: the next-most-important detail. Inverted pyramid — most newsworthy
first, background last, so an editor can cut from the bottom.]

"[A quote a reporter can paste verbatim — a claim or insight, not filler],"
said [Name, Title, Company].

[Body ¶: supporting detail, one data point, availability/pricing if relevant.]

About [Company]                ← boilerplate, ≤100 words, evergreen
[One paragraph: what the company does, for whom, the one credibility fact, URL.]

Media Contact                  ← contact block; a real name + email + phone
[Name] · [email] · [phone] · [newsroom URL]

###                            ← end marker (or -30-); signals "release ends here"
```

Each marker is load-bearing (OhioState/eCampusOntario StratCommWriting). The full
fill-in-the-blanks template is in `references/templates.md`.

## Lede + headline

The lede answers the five W's in the first paragraph, ~40 words, so the story is
intact if the reporter reads nothing else (Prowly; ereleases). The headline states
the news in one line; the subhead carries the second fact. No clever wordplay that
hides what happened.

```text
Bad:  Acme Corp, a leader in workflow innovation, is proud to share an exciting
      development that reflects its ongoing commitment to its valued customers.
Good: Acme Corp today launched Relay, a tool that cuts invoice approval from days
      to minutes, available now for teams of any size at acme.com/relay.
```

The Bad version makes a reporter hunt for the news and find none. The Good version
hands them the 5 W's and a verb. Write the Good version first; everything else is body.

## The quote that survives

A quote exists to be pasted into the article. Make it a soundbite — a claim, a
stake, or an insight — attributed to a real person with a title. **Ban "thrilled
to announce" / "excited to announce" / "world-class" / "game-changer"**: they carry
zero information and signal PR boilerplate, so reporters cut them.

```text
Bad:  "We are thrilled to announce this game-changing milestone in our journey,"
      said the CEO.
Good: "Approval used to be the slowest step in getting paid. Relay removes it
      entirely — that is the difference between waiting a week and waiting an
      hour," said Dana Ruiz, CEO of Acme Corp.
```

The Good quote says something only this person would say about this thing. If a
quote would work verbatim for any company, delete it and rewrite.

## Boilerplate + fact sheet

The boilerplate is the evergreen "About [Company]" paragraph that ends every
release — **≤100 words**, no adjectives doing the work of facts. Write it once,
reuse it. The fact sheet is the skimmable block a reporter copies from:

```markdown
**Fast facts**
- Founded: 2021 · HQ: San Francisco, CA
- Employees: 48 · Funding: $12M Series A (lead: Northwind Ventures)
- One metric: 4,200 teams; 1.1M invoices processed in 2025
- Site / newsroom: acme.com · acme.com/press
```

Templates for both are in `references/templates.md`.

## Embargo vs immediate

Default to `FOR IMMEDIATE RELEASE`. Use an embargo only when you are giving named
outlets early access to prepare coverage that drops at a set moment. **An embargo
is a request, not a contract** — it holds only when stated unambiguously and sent
to reporters who have a reason to honor it. Vague or mass-blasted embargoes get
broken (Dynamics of Writing 2024; ereleases).

- Immediate → news is live now, anyone can publish. Use this most of the time.
- Embargo → coordinated drop. Use the exact line, **always with a timezone**:

```text
EMBARGOED UNTIL 9:00 AM ET, June 9, 2026 — DO NOT PUBLISH BEFORE THIS TIME
```

Send embargoed releases 1:1 to reporters you have a relationship with, not to a
blast list. A list of strangers will break it.

## The media kit manifest

A complete media kit is ~9–11 components, **hosted as an online newsroom, not
emailed as a zip** (Prezly; Prowly; Agility PR). Assemble it as a checklist:

- [ ] Boilerplate (the ≤100-word "About")
- [ ] Fast-fact sheet
- [ ] Product/service description
- [ ] Leadership bios (2–4 sentences each — template in references)
- [ ] Company history / timeline
- [ ] High-res photo library
- [ ] Logos in multiple formats, **including SVG**, with usage guidelines
- [ ] Case studies / testimonials (the stories themselves are `../case-studies/SKILL.md`)
- [ ] Recent press releases
- [ ] Direct press-contact block

Attach assets — **a majority of journalists use a PR-supplied image, and releases
with multimedia get ~9.7× more views than text-only** (Cision; ereleases). Label
every asset so a reporter can use it without asking:

```text
acme-relay-hero.jpg   · 2400×1600 · Credit: Acme Corp · Free editorial use
acme-logo.svg         · vector    · Credit: Acme Corp · Do not recolor or crop
dana-ruiz-headshot.jpg · 1200×1200 · Credit: Photo by J. Lin · Editorial use only
```

Designing the logos/colors themselves is `../brand-identity/SKILL.md`, not this skill.

## The pitch email that carries it

The release rides in on a short email. **96% of journalists prefer email, ideal
length ~100–300 words (best under ~200), and you follow up once only** (Cision;
Muck Rack via prlab.co). And **86% reject a pitch that is off-beat** — so the email
names one reason this reporter, on this beat, would care (fact #2).

```text
Subject: [The news in 6–9 words, no "Press Release:" prefix]

Hi [First name],

You covered [specific recent piece] — so [the one-line reason this is your beat].
[1–2 sentences: the news, the number, the stakes.] Full release and high-res
assets below / at acme.com/press.

Happy to set up a call with [exec name] this week.

[Your name] · [email] · [phone]
```

Personal, beat-relevant, one bump after a few days if no reply — then stop. The
multi-touch cadence to many reporters is `../cold-outreach/SKILL.md`; sourcing the
reporter list is `lead-gen`'s job; wiring the actual send is `email-connector`'s.

## AI + fact-check discipline

**71% of journalists are open to AI-drafted releases, but 72% worry about factual
errors and only ~2% strongly favor AI-generated content** (Cision). Drafting with
AI is accepted — shipping unverified copy is not. Before send, run a human pass on
every **name, number, date, dollar figure, quote attribution, and embargo time**.
A wrong figure in a release is a correction request and a burned reporter.

## Anti-patterns

| Anti-pattern                          | Why it kills pickup                       | Do instead                                  |
|---------------------------------------|-------------------------------------------|---------------------------------------------|
| Release reads like an ad              | No news → reporter rejects on sight        | Run the news-or-ad gate; route ads to `marketing` |
| No `###` / `-30-` end marker          | Looks amateur; reporter can't tell it ended | Close the body with the end marker          |
| Buried lede / 5 W's in paragraph 4    | Editor cuts before reaching the news        | 5-W lede in ~40 words, paragraph one         |
| "Thrilled to announce" quote          | Zero-information filler; gets cut           | A pasteable soundbite only this person says  |
| Mass-blasted embargo                  | Strangers break it; news leaks early         | Embargo 1:1 to relationships, with timezone   |
| No assets attached / linked           | Forfeits the ~9.7× multimedia lift          | Manifest with labeled high-res + SVG logo     |
| Sent off-beat                         | 86% reject; instant delete                  | Name the reporter's beat in the pitch line    |
| Unverified name/number/date           | Correction request; reporter won't trust next | Human fact-check pass before send            |

## References + siblings

- `references/templates.md` — full annotated release, boilerplate, fact-sheet, bio,
  media-kit manifest, and ≤200-word pitch-email templates.
- `references/release-types.md` — per-type lede angle, must-include facts, worked lede.
- `scripts/verify.sh` — read-only structural check over a drafted release file
  (header line, dateline, boilerplate, `###`, contact, filler banlist, length).

Siblings: `../cold-outreach/SKILL.md` (pitch cadence) · `../brand-voice/SKILL.md`
(tone spec) · `../brand-identity/SKILL.md` (logos/colors) · `../case-studies/SKILL.md`
(customer stories) · `../marketing/SKILL.md` (owned launch) ·
`../social-publisher/SKILL.md` (posting to your own channels). The reporter list is
`lead-gen`'s and the actual send is `email-connector`'s.
