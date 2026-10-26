# Third-party work in this skill

Both sources are copied unmodified. The exact commit of each, and the sha256 of every file shipped,
are in `upstream/UPSTREAM.json`; `tests/ux-upstream.test.js` fails if a shipped file drifts from it.

## ux-designer

- **Source:** https://github.com/szilu/ux-designer-skill
- **Licence:** MIT, Copyright (c) 2026 Szilárd Hajba. Full text: `upstream/ux-designer/LICENSE`.
- **What is here:** `upstream/ux-designer/references/` (29 files), copied unmodified.
  `upstream/ux-designer/GUIDE.md` is the upstream `SKILL.md` with its YAML front matter removed so it
  is not discovered as a second skill; the text is unchanged.

## ux-usability-foundations

- **Source:** https://github.com/hueyexe/frontend-agent-skills (`ux-usability-foundations`)
- **Licence:** MIT, Copyright (c) 2026 hueyexe. Full text: `upstream/ux-usability-foundations/LICENSE`
  (the repository licence).
- **What is here:** `upstream/ux-usability-foundations/references/` (4 files), copied unmodified.
  `upstream/ux-usability-foundations/GUIDE.md` is the upstream `SKILL.md` with its YAML front matter
  removed; the text is unchanged.

## Written for rsc

`SKILL.md` and `references/flows.md` are original to rsc. They route into the upstream material and
add what neither source covers in depth: mapping a whole application's flows, its lifecycle, its
roles and the state matrix per screen.

## Updating

Copy a reviewed checkout over `upstream/<name>/`, strip the front matter from its `SKILL.md` into
`GUIDE.md`, and regenerate the hashes and commit in `UPSTREAM.json`. Never an automatic download.
