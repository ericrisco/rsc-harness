# Flows — mapping a whole SaaS journey

A flow is the path a person takes to finish one job, including the detours and the moments they
arrive confused. Design the path before the screens. Most usability failures are missing steps, not
ugly ones.

## 1. Write the flow as a sentence per step

For each job, write:

```
Person:   <who, and how often they come back>
Job:      <what they are trying to finish, in their words>
Done when: <the observable outcome>
Path:     entry → first value → core loop → finish → return
```

Example: *Office manager, weekly* — "Send the monthly invoice to a client." Done when the client has the
invoice and the manager can see it was sent. Path: open client → create invoice → review → send →
confirmation with status → later, check whether it was paid.

## 2. The lifecycle checklist

Walk each of these and decide what the person sees. A missing answer is a gap in the design.

| Moment | What to design |
| --- | --- |
| Arrives with no account | Sign-up that asks for the least it can, and says what happens next. |
| Account just created, nothing exists | The empty state. It names the first useful action and shows what it produces. |
| First value reached | A moment that confirms it worked, and points to the next most useful step. |
| Normal daily use | The fastest path to the core task. Recent items, saved views, keyboard shortcuts if the job is repetitive. |
| Account near or past a limit | A warning before the limit, and a clear explanation at it. Never a silent block. |
| Permission denied for an action | Say who can do it, and let the person ask them. Hide actions that can never be used by this role. |
| Network lost mid-task | Keep the work in the form or on the screen. Show offline state. Sync when back, and say so. |
| Request fails | The error explains what failed and what is safe. Input survives. A retry is one click. |
| Long operation running | Progress, what is being done, and whether the person can leave. |
| Leaving or deleting | Export first, then delete. Say what is removed and what stays. Reversible if possible. |
| Coming back after weeks | The state they left is intact. Recent context is visible. Nothing has silently changed. |

## 3. Keep the core loop short

Count the clicks and decisions between "I want to do the job" and "it is done." Each one should earn
its place. The common case gets the fewest steps; rare cases get more steps, placed where the person
will look for them.

Ask at every step:

- Does this step ask for something the system could infer or default?
- Is the person retyping something they already entered somewhere?
- Is there a decision here they cannot make yet, because the information lives on a screen they have
  not seen?

If yes to any, fix that step before adding anything else.

## 4. Decide where the flow may leave

Some flows are guided on purpose (onboarding, a setup wizard, a payment). Others must let the person
move freely. For guided flows, say how to go back, what is saved, and how to leave. For free flows,
make sure the current place is always visible, so nobody has to ask "how did I get here?"

## 5. First run and onboarding

Aim for the first real result, not a tour of features.

- Start from the job, not the menu: "Import your clients" beats "Welcome to the platform".
- Each setup step should produce something visible. A checklist works when each item changes the
  product.
- Make every step skippable and resumable. Show progress, not a countdown.
- When it is finished, the guidance disappears. Do not keep reminding someone who already succeeded.
- The empty state keeps teaching after onboarding ends: it names the next useful action on every
  screen that is empty.

## 6. Flow review — what to look for

- A step with no way back.
- A step where the person must wait with no indication of progress.
- A decision that needs information from another screen that the person has to remember.
- A flow that works for the admin and fails for the member who was invited.
- A happy path that works, and an error path that drops the person at a blank page.
- An action that exists in one place and not in the place where people expect it.

Walk each flow once with the keyboard only and once on a phone-width screen. Record every pause.
