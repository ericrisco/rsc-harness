# Forms, errors and recovery

Forms are where people quit. The aim is that a person who makes a mistake fixes it in seconds and
loses nothing.

## Layout and labels

- One column. Labels above their fields. Two-column layouts only for short, paired fields such as
  first and last name.
- Every field has a visible label. A placeholder is an example, never a label.
- Hints sit under the label and stay visible while typing. Do not hide the rule until something fails.
- Group related fields under a heading or a fieldset with a legend.
- Mark required and optional according to the minority, and say which in the form's header.

## Inputs

- Use the input type that matches the content (email, tel, date, number, url), so the right keyboard
  appears and the browser can help.
- Accept equivalent formats: phone numbers with or without spaces, dates with separators or not. Format
  for the person, do not reject for style.
- Ask only for what the next step needs. Every extra field is a decision the person has to make.
- Use autocomplete attributes so browsers and password managers can fill known fields.
- Show the character limit for long text while it matters, not only when it is exceeded.

## When to validate

- Validate on blur for most fields. The person has finished a thought.
- Once a field has shown an error, re-validate on each change until it is fixed, so the error clears
  as soon as the problem does.
- Do not show an error on the first keystroke of an empty field.
- Check cross-field rules (end date after start date) when the second field is left, with the error
  placed on the field the person is most likely to change.
- Always validate again on submit, on the server too.

## Where errors appear

- Next to the field that has the problem, with text that says what is wrong and how to fix it.
- A summary at the top of long forms, listing each error and linking to its field. Move focus there on
  submit.
- The message is written for the person, not the system. "Use at least 8 characters" beats "Invalid
  password policy".
- Never blame the person: "This email is already registered. Sign in instead?" rather than "You
  already have an account."

## Keeping the work

- Preserve every entry across validation errors, a session expiry, a network failure and a page
  refresh where the product can.
- On session expiry, sign the person back in and return them to the same form with the input intact.
- If a save fails, keep the form open with the values, show the failure next to the button, and offer
  a retry.
- Prevent double submission: disable the submit button while the request is pending and show that it is
  working. The server should also treat a repeated request as the same request.

## Recovery from mistakes

- Undo is the first choice for anything that can be reversed.
- For a destructive action that cannot be undone, the confirmation names what will be lost and how many
  things it affects. The safe option is the default focus.
- Archive instead of delete wherever the product has a reason to keep data.
- Bulk changes show a preview of what will change before they run when the count is significant.

## Error states for the whole screen

- A failed load shows what failed, what the person can do (retry, check connection, contact support),
  and keeps any cached data visible with a note that it may be stale.
- A permission error says who can grant access and gives a route to ask them.
- A server error says that it is not the person's fault, that the team is notified if that is true, and
  offers a retry. Keep the request id if one exists, so support can find it.
- A not-found page offers the search and the main areas. It is never a blank screen.

## Accessibility of forms

- Every input has a programmatic label. Groups have legends.
- Errors are associated with their fields and announced to screen readers when they appear.
- Focus moves to the first error on submit.
- Error colour is always paired with text and an icon.
- Targets for checkboxes and radio buttons are large enough to tap, including their labels.
