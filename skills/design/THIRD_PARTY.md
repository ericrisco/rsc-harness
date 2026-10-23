# Third-party work in this skill

## taste-skill: the engine

- **Source:** https://github.com/Leonxlnx/taste-skill (`skills/taste-skill`). The exact commit and
  version shipped are in `engine/UPSTREAM.json`.
- **Licence:** MIT, Copyright (c) 2026 Leonxlnx. Full text: `engine/LICENSE`.
- **What is here:** `engine/scripts/`, `engine/library/`, `engine/assets/` and
  `engine/references/`, copied unmodified. `engine/RUN.md` is the upstream `SKILL.md` with its YAML
  front matter removed so it is not discovered as a second skill; the text is unchanged.
- **Data inside:** `library/photos.json` lists Lorem Picsum IDs (photographs from Unsplash, under
  the Unsplash licence); `library/sites.json` describes studied sites from One Page Love and
  Awwwards and copies none of them; `library/type.json` links Fontshare and Google Fonts.
- **Updating:** `npm run design:upstream` reports a newer upstream version. Bringing it in means
  copying a reviewed checkout over `engine/` (`--sync`), never an automatic download.

## impeccable: modes, fresh review, the design record

- **Source:** https://github.com/pbakaus/impeccable by Paul Bakaus. Version in `engine/UPSTREAM.json`.
- **Licence:** Apache-2.0, Copyright 2025 Paul Bakaus. Full text: `IMPECCABLE-LICENSE.txt`.
- **What is here:** no code. `references/modes.md`, `references/finish-review.md` and
  `references/design-md.md` are adaptations of impeccable's `reference/mode-*.md`,
  `agents/impeccable-finish-reviewer.md` and `reference/document.md`. **Modified:** rewritten,
  shortened, and pointed at taste-skill's inspector and screenshots instead of impeccable's
  detector, comps and build phases.
- impeccable's NOTICE concerns its iOS and Android references, which are not used here.
