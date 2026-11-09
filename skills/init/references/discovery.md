# Discovery — greenfield & brownfield questionnaires (software AND non-code harnesses)

Phase 2 detail. Establish two things: **the state of the ground** (greenfield vs brownfield) and **what the user wants to build or govern**. Record everything to `02-DOCS/wiki/harness/user-profile.md` as you learn it. Ask in short batches — never dump every question at once.

## First: greenfield vs brownfield (detect, then confirm)

Do a read-only walk of the workspace root, the way `harness` SCAN does. Ignore these directories entirely: `node_modules/`, `.venv/`, `.next/`, `.git/`, `dist/`, `build/`, `__pycache__/`, `.dart_tool/`.

**Brownfield signals** (any one is enough):

- A subproject manifest: `package.json`, `pyproject.toml`, `pubspec.yaml`, `go.mod`, `Cargo.toml`, `Gemfile`, `composer.json`.
- Source files, a `src/`, an `app/`.
- Legacy numbered folders matching `^[0-9]+-[A-Z_]+$` (`00-TOOLS`, `03-NOTES`…).
- An existing `01-TOOLS/`, `02-DOCS/`, `CLAUDE.md`, or `AGENTS.md`.

Read manifest contents to name the stack (Next.js, FastAPI, Flutter, Go, Express…). Capture `git status --short` per subproject if it's a repo; flag dirty trees rather than acting on them. Then **summarize what you found and confirm** with the user before treating it as ground truth — detection can be wrong.

**Greenfield** = none of the above; an empty or notes-only workspace. Then it is a brand-new idea and you interview from zero.

## Then: what do they want to build OR govern?

The single most important branch. Establish the **domain** before any stack questions.

> "¿Lo que quieres montar es **software** (una app, una web, un backend, un agente…) o más bien una forma de **organizar y gobernar algo** que no es código — llevar una empresa o unas operaciones, una investigación, tu conocimiento personal, una operación de contenido…? Las dos cosas se montan igual de bien aquí."

Record `domain: software | non-code-harness`. Both are first-class. A non-code harness uses the exact same `01-TOOLS` (connections to email, calendar, CRM, payments, docs) + `02-DOCS` (the wiki/second-brain) structure.

---

## Software — questionnaire

### Greenfield software

Ask in short batches, only what changes the plan.

1. **The idea in one sentence.** What does it do, for whom?
2. **Surfaces.** Which of these does it need? (This drives the skill recommendation.)
   - A **backend / API / database** → `fastapi` or `go`, `postgresdb`.
   - A **web or mobile UI** → `nextjs` or `flutter`, `design`.
   - **AI agents** (tools, RAG, autonomous loops) → `building-agents`.
   - **Marketing / landing / decks / teaching** around it → `marketing`, `presentations`, `course-storytelling`.
   - It will be **shipped / needs security** → `security-audit`, `deployment`.
3. **Audience & scale.** Who uses it? Roughly how many users, how many at once?
4. **Constraints.** Budget, timeline, data region / residency, compliance, must-use technologies.
5. **Existing tools/providers** already chosen or in play (auth, payments, email, hosting, analytics).

### Brownfield software

Lead with what you detected, then fill gaps:

1. **Confirm the stack** you found per subproject. Correct anything wrong.
2. **What's the goal of this session** — extend it, ship it, document it, add a surface?
3. **Providers in the code.** Which external services are already integrated (you'll have seen imports/env vars in SCAN)? These map to `01-TOOLS` folders that `harness` will scaffold.
4. **Pain points.** What's missing or messy (no docs, no ops, no tests, scattered config)?
5. **Constraints & scale** as in greenfield, but informed by current reality.

---

## Non-code harness — questionnaire

Same structure, different surfaces. The "stack" here is the set of **tools the harness connects to** and the **knowledge it governs**.

### Greenfield non-code harness

1. **What are you running or organizing?** A company, a department's ops, a research line, your personal knowledge, a content operation?
2. **What does "this worked" look like?** The outcome — e.g. "every client email lands in the right place and I never lose a document", "my research notes compile into a queryable wiki".
3. **Tools to connect** (`01-TOOLS` candidates). Which of these do you use, and would you want wired in?
   - Email (Gmail, Outlook), Calendar.
   - Documents / drive (Google Drive, Notion, Dropbox).
   - CRM / sales, support inbox.
   - Payments / billing (Stripe…), accounting.
   - Hosting / infra, if any automation runs somewhere.
4. **What knowledge piles up?** PDFs, contracts, notes, spreadsheets, emails — the raw material that should become a queryable wiki in `02-DOCS`.
5. **Constraints.** Budget, data residency / privacy (especially for client data), who else touches this, compliance.

### Brownfield non-code harness

The "brownfield" of a non-code harness is an existing pile of tools and documents with no structure:

1. **Inventory the tools** already in use and how they connect today (or don't).
2. **Where does knowledge live now** and why is it hard to find — that's the `02-DOCS` job.
3. **What's the recurring pain** — onboarding, handoffs, lost context, manual copying between tools?
4. **Confirm any integrations** you can detect (config files, exported credentials, `.env`-style files) — these become `01-TOOLS` folders.
5. **Constraints & ownership** as above.

---

## What to record

After discovery, `user-profile.md` should have, for both domains: a one-line description, the domain and its surfaces, goals, audience/scale, context (greenfield/brownfield + detected state + tools in play), and constraints (budget, timeline, region/residency, compliance, ops comfort). These are exactly the inputs Phase 3 needs to recommend skills and run the "siempre 3 opciones" pattern, and that the `harness` skill reads to scaffold. Anything still unknown goes under "Open questions" to revisit — do not invent answers.
