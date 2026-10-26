# Screen patterns — which shape fits which job

Pick the pattern from the job, not from what looks modern. Each pattern below says what it is for and
what it is not for.

## Decision table

| The job is… | Use | Not |
| --- | --- | --- |
| Find and act on one of many similar records | List or table with search and filters | Cards for dense data |
| Look at, edit or act on one record | Detail page with a clear header and sections | A modal that needs scrolling |
| Enter or change a few related fields | Form, inline or on a page | A wizard for three fields |
| Enter many fields in steps that depend on each other | Wizard with a visible step list | One long form with no sense of progress |
| Confirm a yes/no or a single field | Small dialog | A full page |
| Keep context visible while editing a record in a list | Side panel | A modal that hides the list |
| Monitor numbers and what needs attention now | Dashboard: summary first, detail on demand | A wall of equal charts |
| Change how the product behaves for me or my team | Settings, grouped by subject, with search for long lists | Settings scattered across the product |
| Find something when I know roughly what it is | Search with suggestions and filters | Navigating folders |
| Be told something happened elsewhere | Notification center plus, only when urgent, an in-context banner | A toast for something they must act on |

## Lists and tables

- Show the columns people use to decide. Hide the rest behind a column picker that remembers choice.
- The first column is the record's name and the link to it. Everything else supports that name.
- Sorting and filtering stay visible while scrolling. Show the active filters as removable chips.
- Show the count of results and the count of total records, so the person knows whether they are
  looking at everything.
- Bulk actions appear when something is selected, and show how many items they will touch.
- Keep the position when returning from a detail page: filters, sort, page and scroll.
- Infinite scroll needs a visible position and a footer. For long sets, paginate and let people jump.

## Detail pages

- The header names the object and its status, and holds the one primary action.
- Sections in the order people read them, with the most-used section first.
- Edits that save as they go say so. Edits that need saving show an unsaved indicator and a save button
  that is disabled only with a reason stated next to it.
- The history of changes lives on the page, not three menus away.

## Forms

- Labels above fields, never placeholder-only.
- Group related fields. Mark the minority: required fields if most are optional, optional if most are
  required.
- Use the right input type for the content, so mobile keyboards help.
- Full detail on form errors in `forms-and-errors.md`.

## Wizards

- Show the full list of steps and where the person is in it.
- Each step validates before moving on, and the person can return to any finished step.
- Save progress. A person who closes the tab should be able to come back to the same step.
- The last step shows a summary of what will happen, in plain words, before the final action.

## Settings

- Group by subject: account, team, billing, notifications. Not by how the code is organised.
- Settings take effect immediately where possible. When they do not, say when they will.
- Destructive settings (delete workspace, revoke all keys) sit at the bottom, separated, with the
  consequence written out.

## Dashboards

- The top row answers "what needs me right now?" Numbers that change action, not numbers that
  decorate.
- Every chart answers a question written in its title. A chart without a question is removed.
- Each number links to the list that explains it.
- Time range and filters are visible at the top, and they apply to the whole page.
- Empty dashboards teach: they show what will appear and how to get there.

## Overlays — modal, panel, full page

- A modal is for a short, self-contained decision. It traps focus, it closes with Escape, and it
  returns focus to what opened it.
- A side panel keeps the underlying list in view. Use it for quick edits and previews.
- A full page is for work that needs room and a stable URL.
- Never stack modals. If a modal needs another modal, the flow should be a page.

## Navigation shell

- Show the product's main areas in one place that does not move. Five to seven items on desktop;
  three to five in a mobile bottom bar, with the rest in a "More" group.
- Do not hide the primary navigation behind a menu icon on desktop.
- Show where the person is: the active area, and a breadcrumb for deep objects.
- A workspace or account switcher, when present, sits where people expect it and shows the current one.
- Search is a single, always-reachable entry point.
