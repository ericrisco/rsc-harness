# gitmoji — the full set, and the tooling that has to accept it

The commit rule lives in `../SKILL.md`: **every commit opens with a gitmoji, then the
Conventional Commits header.** This file is the lookup table and the tooling escape hatches — read
it when you need the right glyph for an intention, or when a parser in the repo rejects the format.

```text
<gitmoji> type(scope)!: imperative subject
```

The gitmoji says *what kind of intention* this is at a glance in `git log --oneline`; the `type`
still drives the SemVer bump. They are two different jobs and neither replaces the other — a commit
with 💥 but no `!`/`BREAKING CHANGE:` footer still releases as a MINOR, because tooling reads the
type, not the picture.

## Picking one

Match the **intention**, not the file that changed. If two fit, take the more specific one (🚑️ over
🐛 for a production hotfix; 🩹 over 🐛 for a trivial non-critical fix). The `semver` column is
gitmoji's own hint, not a substitute for the type → bump table in `../SKILL.md`.

The everyday dozen, mapped to the conventional types:

| Type       | gitmoji | Type        | gitmoji |
|------------|---------|-------------|---------|
| `feat`     | ✨      | `perf`      | ⚡️      |
| `fix`      | 🐛      | `ci`        | 👷      |
| `docs`     | 📝      | `build`     | 📦️      |
| `refactor` | ♻️      | `style`     | 🎨      |
| `test`     | ✅      | `revert`    | ⏪️      |
| `chore`    | 🔧      | breaking    | 💥      |

## The full set

Canonical source: <https://gitmoji.dev> (machine-readable at `https://gitmoji.dev/api/gitmojis`).
The same 75 rows are enforced as data by the gitmoji guard, and a test compares this table against
it — if the two ever disagree, CI says so.

| Emoji | Code | SemVer | Intention |
|-------|------|--------|-----------|
| 🎨 | `:art:` | — | Improve structure / format of the code |
| ⚡️ | `:zap:` | patch | Improve performance |
| 🔥 | `:fire:` | — | Remove code or files |
| 🐛 | `:bug:` | patch | Fix a bug |
| 🚑️ | `:ambulance:` | patch | Critical hotfix |
| ✨ | `:sparkles:` | minor | Introduce new features |
| 📝 | `:memo:` | — | Add or update documentation |
| 🚀 | `:rocket:` | — | Deploy stuff |
| 💄 | `:lipstick:` | patch | Add or update the UI and style files |
| 🎉 | `:tada:` | — | Begin a project |
| ✅ | `:white_check_mark:` | — | Add, update, or pass tests |
| 🔒️ | `:lock:` | patch | Fix security or privacy issues |
| 🔐 | `:closed_lock_with_key:` | — | Add or update secrets |
| 🔖 | `:bookmark:` | — | Release / Version tags |
| 🚨 | `:rotating_light:` | — | Fix compiler / linter warnings |
| 🚧 | `:construction:` | — | Work in progress |
| 💚 | `:green_heart:` | — | Fix CI Build |
| ⬇️ | `:arrow_down:` | patch | Downgrade dependencies |
| ⬆️ | `:arrow_up:` | patch | Upgrade dependencies |
| 📌 | `:pushpin:` | patch | Pin dependencies to specific versions |
| 👷 | `:construction_worker:` | — | Add or update CI build system |
| 📈 | `:chart_with_upwards_trend:` | patch | Add or update analytics or track code |
| ♻️ | `:recycle:` | — | Refactor code |
| ➕ | `:heavy_plus_sign:` | patch | Add a dependency |
| ➖ | `:heavy_minus_sign:` | patch | Remove a dependency |
| 🔧 | `:wrench:` | patch | Add or update configuration files |
| 🔨 | `:hammer:` | — | Add or update development scripts |
| 🌐 | `:globe_with_meridians:` | patch | Internationalization and localization |
| ✏️ | `:pencil2:` | patch | Fix typos |
| 💩 | `:poop:` | — | Write bad code that needs to be improved |
| ⏪️ | `:rewind:` | patch | Revert changes |
| 🔀 | `:twisted_rightwards_arrows:` | — | Merge branches |
| 📦️ | `:package:` | patch | Add or update compiled files or packages |
| 👽️ | `:alien:` | patch | Update code due to external API changes |
| 🚚 | `:truck:` | — | Move or rename resources (e.g.: files, paths, routes) |
| 📄 | `:page_facing_up:` | — | Add or update license |
| 💥 | `:boom:` | major | Introduce breaking changes |
| 🍱 | `:bento:` | patch | Add or update assets |
| ♿️ | `:wheelchair:` | patch | Improve accessibility |
| 💡 | `:bulb:` | — | Add or update comments in source code |
| 🍻 | `:beers:` | — | Write code drunkenly |
| 💬 | `:speech_balloon:` | patch | Add or update text and literals |
| 🗃️ | `:card_file_box:` | patch | Perform database related changes |
| 🔊 | `:loud_sound:` | — | Add or update logs |
| 🔇 | `:mute:` | — | Remove logs |
| 👥 | `:busts_in_silhouette:` | — | Add or update contributor(s) |
| 🚸 | `:children_crossing:` | patch | Improve user experience / usability |
| 🏗️ | `:building_construction:` | — | Make architectural changes |
| 📱 | `:iphone:` | patch | Work on responsive design |
| 🤡 | `:clown_face:` | — | Mock things |
| 🥚 | `:egg:` | patch | Add or update an easter egg |
| 🙈 | `:see_no_evil:` | — | Add or update a .gitignore file |
| 📸 | `:camera_flash:` | — | Add or update snapshots |
| ⚗️ | `:alembic:` | patch | Perform experiments |
| 🔍️ | `:mag:` | patch | Improve SEO |
| 🏷️ | `:label:` | patch | Add or update types |
| 🌱 | `:seedling:` | — | Add or update seed files |
| 🚩 | `:triangular_flag_on_post:` | patch | Add, update, or remove feature flags |
| 🥅 | `:goal_net:` | patch | Catch errors |
| 💫 | `:dizzy:` | patch | Add or update animations and transitions |
| 🗑️ | `:wastebasket:` | patch | Deprecate code that needs to be cleaned up |
| 🛂 | `:passport_control:` | patch | Work on code related to authorization, roles and permissions |
| 🩹 | `:adhesive_bandage:` | patch | Simple fix for a non-critical issue |
| 🧐 | `:monocle_face:` | — | Data exploration/inspection |
| ⚰️ | `:coffin:` | — | Remove dead code |
| 🧪 | `:test_tube:` | — | Add a failing test |
| 👔 | `:necktie:` | patch | Add or update business logic |
| 🩺 | `:stethoscope:` | — | Add or update healthcheck |
| 🧱 | `:bricks:` | — | Infrastructure related changes |
| 🧑‍💻 | `:technologist:` | — | Improve developer experience |
| 💸 | `:money_with_wings:` | — | Add sponsorships or money related infrastructure |
| 🧵 | `:thread:` | — | Add or update code related to multithreading or concurrency |
| 🦺 | `:safety_vest:` | — | Add or update code related to validation |
| ✈️ | `:airplane:` | — | Improve offline support |
| 🦖 | `:t-rex:` | — | Code that adds backwards compatibility |
## Tooling that has to accept the format

Emoji-first is what gitmoji itself prescribes and what `gitmoji -c` writes, but a **strict
Conventional Commits parser anchors the type at position 0** and will reject the header. Two honest
ways out, in order of preference:

**1. Teach the parser about the prefix.** commitlint, with the emoji allowed before the type:

```js
// commitlint.config.js
export default {
  extends: ['@commitlint/config-conventional'],
  parserPreset: {
    parserOpts: {
      // <emoji> type(scope)!: subject
      headerPattern: /^(?:\S+\s)?(\w+)(?:\(([^)]*)\))?(!)?: (.+)$/,
      headerCorrespondence: ['type', 'scope', 'breaking', 'subject'],
    },
  },
};
```

semantic-release / conventional-changelog take the same `parserOpts` under
`@semantic-release/commit-analyzer` and `@semantic-release/release-notes-generator`. Set it in
**both** or the bump and the changelog disagree about the same commit.

**2. Put the emoji after the header** — `feat(api): ✨ add cursor paging`. Every conventional parser
accepts it unmodified, and the guard accepts it too. Prefer this in a repo whose release pipeline
you do not own.

What **not** to do: drop the type and commit `✨ add cursor paging` (gitmoji's own minimal form).
It is valid gitmoji and useless for releases — nothing can derive the bump, so the version has to be
hand-picked, which `../SKILL.md` forbids for a reason.

## Related

- `gitmoji-cli` (`npm i -g gitmoji-cli`, then `gitmoji -c`) prompts for the emoji and writes the
  commit. Optional — the convention is the rule, the CLI is one way to type it.
- On Claude Code, rsc wires a `gitmoji-guard` PreToolUse hook that denies a `git commit` whose
  message has no gitmoji, with the corrected message in the refusal. It only judges messages it can
  actually read (`-m`, heredoc) and never blocks an editor commit, a `-F` file, or `--amend
  --no-edit`. Opt out per project with `.rsc/.no-gitmoji`.
