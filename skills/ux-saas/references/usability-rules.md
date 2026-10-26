# Usability rules — the ones that decide whether it is easy

These rules apply to every screen. When a screen breaks one, fix the screen, not the person using it.

## 1. Obvious next action

- One primary action per view, visually strongest, named with a verb and the object: "Save changes",
  "Send invoice", "Invite teammate".
- Never label a primary action "Submit", "OK" or "Continue" when a specific verb exists.
- Secondary actions stay visible and quieter. Do not hide them behind an icon that has no label.
- The destructive action is never the primary button, and it lives in a visually separated place.

## 2. Affordances

- Clickable things look clickable and behave like their look. A link is a link; a button is a button.
- Read-only values do not look like inputs. Editable values do not look like text.
- A disabled control states why, next to it or on hover and focus. Silent disabling is a defect.
- Anything reachable only by gesture, hover or long press also has a visible route.

## 3. Feedback

- Within 100ms, acknowledge the action: pressed state, spinner on the button, or a row marked as
  pending.
- Over one second, show progress. Over ten seconds, show what is happening and allow cancelling when
  the operation is safe to cancel.
- On completion, show the result where the person is looking, not only in a corner toast.
- Show the state of the thing being edited: saved, saving, unsaved changes, syncing, offline.
- Avoid noise. A routine success does not need a celebration; a failure needs an explanation.

## 4. Undo before confirmation

- Reversible actions (archive, move, edit, delete to trash) happen immediately, with an undo that lasts
  long enough to use (usually 5–10 seconds, longer for consequential ones).
- Confirmation is reserved for what cannot be undone: permanent deletion, payments, sending to people
  outside the account, revoking access that others depend on.
- A confirmation names the thing and the consequence: "Delete 14 invoices? This cannot be undone."
  Never a bare "Are you sure?"

## 5. Labels and language

- Use the vocabulary the person uses in their job. Ask before using internal terms, legal terms or a
  clever product name for a core action.
- The same concept has the same name everywhere. "Project" in the sidebar and "Workspace" on the
  settings page is a bug.
- Empty, error and success messages say what happened, why it matters and what to do next.

## 6. Progressive disclosure

- Show the common path first. Put advanced options one click away, near where they apply.
- Ask for information only when the decision needs it. Defer the rest until the person reaches the
  point where it matters.
- Defaults should be the safe and likely choice. A person who accepts every default should get a
  working result.

## 7. Recognition over recall

- Keep the current filter, the current selection and the current context visible.
- A search, a recent list or a saved view beats making someone reconstruct their last query.
- Do not make people remember a code, a name or a hidden step from another screen. Show it.

## 8. Shortcuts for the expert

- Expert speed is a feature. Repeated jobs get keyboard shortcuts, command search, and bulk operations.
- Shortcuts are discoverable: shown in menus and in a help overlay. Never the only way to act.
- Every shortcut has a mouse or touch equivalent for everyone else.

## 9. Consistency

- Same action, same place, same name, across screens. A "Delete" that sits in the header on one page and
  in the footer on another costs people time every time.
- Same component for the same job. Two date pickers in one product is one too many.

## 10. Quick checks

Before shipping a screen, answer these in writing. If one answer is "I don't know", the screen is not
done.

- What is the one thing this screen is for?
- What is the primary action, and is it obvious without reading the body text?
- What does the person see first, and is it the thing they came for?
- What happens after the primary action, and where does the person end up?
- What happens if it fails halfway?
