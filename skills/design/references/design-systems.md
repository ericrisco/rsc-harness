# When the brief is a design system, not an aesthetic

This skill's default is Tailwind v4 + Next.js, and for most briefs that is right. But some
briefs correspond to a **maintained, official design system**, and there the correct answer is
to install it. Recreating its CSS by hand produces something that looks like it, fails its
accessibility work, and drifts on its next release.

The list is deliberately short: only the cases where using the official package is
**obligatory or strongly expected**, and where the default instinct would be to hand-roll it.
Free choices (Bootstrap, Material for a non-Google product, Radix Themes, shadcn/ui) are not
here — they are ordinary picks, and shadcn/ui in particular is already this skill's territory,
where the rule is simply never to ship it in its default state.

| The brief reads as | Install | Why it is not a choice |
| --- | --- | --- |
| A UK public-sector service | `govuk-frontend` | Expected by the Service Standard; deviating is a finding at assessment |
| A US federal or trust-first public service | `uswds` | Same, under the US Web Design System |
| A Shopify admin surface or embedded app | `@shopify/polaris` (or Polaris web components) | Required for admin UI to be accepted |
| IBM-flavoured enterprise or dense analytics | `@carbon/react` + `@carbon/styles` | Mature data-density patterns you will otherwise reinvent badly |
| An Atlassian / Jira-adjacent product surface | `@atlaskit/*` + `@atlaskit/tokens` | Official DS; token-driven theming |
| A GitHub-style devtool or community page | `@primer/css`, or `@primer/react-brand` for marketing | Official Primer; the Brand variant is the marketing half |
| A Microsoft / Fluent-flavoured product | `@fluentui/react-components` | Official Fluent, Microsoft tokens, accessibility already done |

## The three rules that come with them

1. **Do not recreate it.** If the brief names one of these, install the package. Importing its
   tokens and then overriding ninety percent of them is the same mistake with extra steps.
2. **One system per project.** No Fluent components inside a Carbon tree, no shadcn/ui
   dropped into a Material app. Mixing two systems produces a third, worse one.
3. **Name what is an approximation.** When the brief is an *aesthetic* rather than a system —
   glassmorphism, bento tiles, brutalism, editorial, aurora gradients, kinetic type — there is
   no official package, and saying so is part of the work. Apple's Liquid Glass is documented
   for Apple platforms only: there is no official web implementation, so a web version is a
   `backdrop-filter` approximation and must be labelled as one, in the code and to the user.

## What still applies

Everything in `../SKILL.md` that is not styling: the brand gate, the accessibility floor,
the Core Web Vitals budget, the 5-second value-prop test, and the tell registry in
`../scripts/verify.sh`. An official design system settles which components you use. It does
not settle whether the page says anything.
