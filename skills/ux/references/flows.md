# Flows — the whole application, before any screen

Most apps that "feel broken" have good screens and missing steps: nobody designed the empty account,
the invited member, the failed payment or the way back after a week away. Map the journey first;
the screens fall out of it.

## 1. The flow map

One table per job. One row per step. Every row names its screen and the states that screen can be
in when the person arrives.

```
Person:    Office manager · weekly · average domain knowledge
Job:       Send this month's invoice to a client
Done when: The client has it and the manager can see "Sent" on the invoice
Risk:      Money and a client relationship — sending is not reversible
```

| # | Step (the person's words) | Screen | Primary action | States on arrival | Way back / out |
| --- | --- | --- | --- | --- | --- |
| 1 | Find the client | Clients list | Open client | empty, filtered to zero, many | — |
| 2 | Start the invoice | Client detail | New invoice | no invoices yet, has drafts | Back to list, filters kept |
| 3 | Fill the lines | Invoice form | Review invoice | draft restored, validation error | Save as draft |
| 4 | Check before sending | Review | Send invoice | missing client email, over plan limit | Edit |
| 5 | Know it worked | Invoice detail | — (status visible) | sending, sent, bounced | Back to client |

Rules for the map:

- **Steps in the person's words,** not the system's ("Find the client", not "Query CRM entity").
- **Every row has a way back.** A step with no way back is a defect, unless it is the irreversible
  action and it said so first.
- **Count the core loop.** Clicks and decisions from "I want to do this" to "done". Each one earns its
  place: can it be defaulted, inferred, remembered or skipped? The daily job gets the fewest steps.
- **No step depends on memory.** If step 4 needs something seen in step 1, step 4 shows it.

## 2. The lifecycle — rows people forget

Walk every one. A row with no answer is a gap in the design, not an edge case.

| Moment | What the person must see |
| --- | --- |
| Arrives with no account | What the product does for them, then a sign-up asking for the least it can. |
| Account just created, nothing exists | An empty state that names the first useful action and shows what it produces. Import or a sample, when that is faster than starting blank. |
| First value | Proof it worked, and the next most useful step. Not a celebration that blocks the screen. |
| Daily use | The shortest route to the core job: recent items, saved views, shortcuts, remembered filters. |
| Near or at a plan limit | A warning before the limit; at it, what is blocked, why, and the one action that unblocks it. Never a silent failure. |
| No permission | Who can do it and a way to ask them. Actions that this role can never use are hidden, not disabled. |
| Network lost | Work stays on screen, offline is visible, changes sync when back and say so. |
| Request fails | What failed, what is safe, input intact, retry in one click. |
| Long operation | Progress, what is happening, whether they can leave and come back. |
| Payment fails | What happens to their data and when, and the one action that fixes it. |
| Coming back after weeks | Things where they left them; what changed while away, if anything did. |
| Leaving | Export first, then delete; what is removed, what stays, and for how long it can be undone. |

## 3. The second role

Whoever set the account up is rarely whoever uses it most. Map the flow again for each role that
exists:

- **The invited member:** arrives from an email, has no context, did not choose the product. Their
  first screen is the thing they were invited to, not the generic dashboard.
- **The admin:** billing, members, roles, security, audit. Rare tasks, high stakes: clarity over
  speed, consequences written out.
- **The viewer or guest:** sees only what they can act on. No dead buttons.
- **Support acting as the user,** when the product allows it: clearly marked, never invisible.

## 4. Flows every SaaS needs

Check each exists and is mapped; most products ship without two or three of them.

| Flow | The part that is usually missing |
| --- | --- |
| Sign-up and sign-in | Password managers and paste working; magic link or SSO path; the expired-link screen. |
| Onboarding to first value | Skippable, resumable, disappears once done. See `../upstream/ux-designer/references/16-onboarding.md`. |
| Invite and join | The invited person's first screen; resending; an expired invitation. |
| Create, edit, delete the core object | Drafts, autosave or an unsaved-changes guard, undo after delete. |
| Find (search, filter, sort) | Zero results that suggest a way out; filters kept when coming back from detail. |
| Bulk work | How many items, what will change, undo or a summary of what failed. |
| Import and export | Preview and mapping before import; a report of what was skipped and why. |
| Notifications | Severity matches reality; per-channel preferences. See `../upstream/ux-designer/references/17-notifications.md`. |
| Settings | Grouped by subject; changes say when they take effect; dangerous ones apart, at the end. |
| Plan, billing, limits | Current plan and usage visible; upgrade from the point of need; downgrade explains what is lost. |
| Account and data deletion | Export offered first; the consequence spelled out; a grace period when the product can keep one. |

## 5. The state matrix

Fill it for every screen in the map. "N/A" is allowed; blank is not.

| Screen | Default | Loading | Empty (new) | Empty (filtered) | Partial | Error | Offline | No permission | Overflow | Pending item |
| --- | --- | --- | --- | --- | --- | --- | --- | --- | --- | --- |
| Clients list | | | | | | | | | | |

What each state needs:

- **Loading:** skeleton in the layout of what is coming, after about 300ms so fast loads do not
  flash; progress and cancel past ten seconds.
- **Empty (new):** why it is empty, the action that fills it, and what it will look like.
- **Empty (filtered):** the active filters, and a way to clear them. Never the "new account" message.
- **Partial:** what loaded, what did not, retry for the part that failed.
- **Error:** what happened in plain words, what is safe, retry; the request id when support needs it.
- **Offline:** cached data marked as possibly stale; what can still be done.
- **No permission:** who can grant it, a way to ask.
- **Overflow:** long names truncated with the full text reachable, many items paginated or
  virtualised with a count, huge numbers formatted.
- **Pending item:** the row or card marked as working, the rest of the screen usable.

## 6. Expert speed

The person who uses the product every day is the one who decides whether it is "productive". For
each daily job, decide:

- the keyboard shortcut and where it is shown (menus, a `?` overlay);
- whether a command search (Cmd/Ctrl+K) reaches it;
- which bulk action replaces doing it item by item;
- which view or filter should be saved or remembered;
- which field can default from the last time.

None of these replaces the visible route; they sit on top of it.

## 7. Walking the map

Before calling the flow done, walk it in a browser twice: once as the new person on an empty
account, once as the daily user with real-sized data. Keyboard only for one of the walks, phone width
for the other. Every pause, every "where is…", every re-typed value is a row to fix in the map.
