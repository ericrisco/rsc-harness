# Decision Prompts — UX Usability Foundations

Use these only when context materially changes the best recommendation. Do not ask users to decide routine best practices.

### Decision: Primary task and success condition

When to ask:
- The screen or flow could optimize for different user goals.
- The request lacks the task.

Do not ask when:
- The task is obvious from the UI or request.

Recommended default:
- Optimize the most common successful task first; demote secondary tasks.

Reason:
- Usability decisions depend on what the user is trying to accomplish.

Question tool pattern:
```js
question({
  question: "What is the primary task this interface must help users complete?",
  recommended_default: "Optimize for the most common successful task first, then make secondary actions available but visually quieter.",
  options: [
    "Complete one focused task",
    "Compare or monitor multiple items",
    "Explore and choose among options",
    "Other / custom"
  ]
})
```

### Decision: User experience level

When to ask:
- The interface could serve novices, occasional users, frequent intermediates, or expert operators differently.

Do not ask when:
- It is a public or consumer-facing flow; default to discoverable clarity with optional accelerators.

Recommended default:
- Optimize for frequent intermediates while keeping basics discoverable.

Reason:
- Most users are neither permanent beginners nor experts in every feature.

Question tool pattern:
```js
question({
  question: "Which user experience level should the main interface optimize for?",
  recommended_default: "Optimize for frequent intermediates, with visible basics and optional expert accelerators.",
  options: [
    "First-time or infrequent users",
    "Frequent intermediates",
    "Trained experts/operators",
    "Other / custom"
  ]
})
```

### Decision: Platform and input constraints

When to ask:
- Pattern choice depends on desktop, mobile, touch, keyboard, screen reader, kiosk, embedded, or constrained device behavior.

Do not ask when:
- The provided UI/code makes platform constraints clear.

Recommended default:
- Follow platform conventions and support pointer, touch, keyboard, and assistive technology where relevant.

Reason:
- Conventions and input affordances strongly affect discoverability and operability.

Question tool pattern:
```js
question({
  question: "Which platforms and input methods must this support?",
  recommended_default: "Use platform conventions and support pointer, touch, keyboard, and screen-reader basics unless the product context is narrower.",
  options: [
    "Responsive web",
    "Mobile app",
    "Desktop/productivity app",
    "Other / custom"
  ]
})
```

### Decision: Guided flow versus free navigation

When to ask:
- A task may require step-by-step completion, but users may need flexibility or backtracking.

Do not ask when:
- The task is a simple single-screen action or known linear flow.

Recommended default:
- Allow orientation and safe backtracking; constrain only where sequence prevents mistakes.

Reason:
- Users need control, but some tasks require ordered steps for safety or completeness.

Question tool pattern:
```js
question({
  question: "Should users move freely, or should this task keep them in a guided sequence?",
  recommended_default: "Allow free orientation and safe backtracking unless sequence is needed to prevent errors or satisfy requirements.",
  options: [
    "Free navigation",
    "Guided sequence",
    "Hybrid: free within completed steps",
    "Other / custom"
  ]
})
```

### Decision: Density versus clarity

When to ask:
- The UI could be spacious/guided or dense/comparative.

Do not ask when:
- The screen has one primary action or the density need is obvious.

Recommended default:
- Use clarity and progressive disclosure for task completion; use density only for comparison, monitoring, or expert scanning.

Reason:
- Density can increase power but also scanning effort and error rate.

Question tool pattern:
```js
question({
  question: "Do users need a focused task path or dense comparison/monitoring?",
  recommended_default: "Use a focused, scannable layout unless simultaneous comparison or monitoring is essential.",
  options: [
    "Focused task completion",
    "Dense comparison",
    "Real-time monitoring",
    "Other / custom"
  ]
})
```

### Decision: Destructive action recovery

When to ask:
- The UI includes delete, cancel, overwrite, remove access, publish, send, pay, or other consequential actions.

Do not ask when:
- The action is clearly reversible and low-risk.

Recommended default:
- Use undo for reversible actions and confirmation/review for irreversible or high-risk actions.

Reason:
- Confirmations create friction and can become automatic; irreversible harm needs deliberate review.

Question tool pattern:
```js
question({
  question: "Is this action reversible, and what harm occurs if it is triggered accidentally?",
  recommended_default: "Use undo for reversible actions; use confirmation or review for irreversible, costly, or legally meaningful actions.",
  options: [
    "Fully reversible",
    "Reversible for a limited time",
    "Irreversible or costly",
    "Other / custom"
  ]
})
```

### Decision: Error detail and recovery guidance

When to ask:
- Errors involve security, privacy, fraud, account access, compliance, or regulated data.

Do not ask when:
- The error is local and safe to explain, such as missing input or invalid format.

Recommended default:
- Provide specific, local, actionable recovery guidance while preserving user work.

Reason:
- Vague errors force users to guess; overly specific security errors can leak information.

Question tool pattern:
```js
question({
  question: "Can the error safely explain the exact problem, or must details be limited for security/compliance?",
  recommended_default: "Give specific recovery guidance unless revealing details creates risk.",
  options: [
    "Specific recovery guidance",
    "Limited details for security/privacy",
    "Support handoff required",
    "Other / custom"
  ]
})
```

### Decision: Standard convention versus custom interaction

When to ask:
- The user requests a custom component, hidden gesture, unusual navigation, or novel pattern.

Do not ask when:
- A standard control clearly fits.

Recommended default:
- Use the familiar convention unless the custom pattern improves task performance or comprehension.

Reason:
- Conventions reduce learning cost and align with user expectations.

Question tool pattern:
```js
question({
  question: "What user problem does the nonstandard pattern solve better than the familiar convention?",
  recommended_default: "Use the familiar convention unless the alternative is measurably clearer, safer, or faster for this task.",
  options: [
    "Use standard pattern",
    "Use custom pattern with visible guidance",
    "Prototype/test both",
    "Other / custom"
  ]
})
```

### Decision: Terminology and domain language

When to ask:
- Labels may need to be plain-language, domain-specific, legally required, or brand-specific.

Do not ask when:
- Clear user-language labels are obviously sufficient.

Recommended default:
- Use plain task language; include domain terms only where users know and expect them.

Reason:
- Unfamiliar labels create unnecessary cognitive load.

Question tool pattern:
```js
question({
  question: "Are there required domain, legal, or brand terms users must see?",
  recommended_default: "Use plain task language, with domain terms only where users already expect them or where they are required.",
  options: [
    "Plain language",
    "Domain-expert terminology",
    "Required legal/brand terms",
    "Other / custom"
  ]
})
```

### Decision: Form validation strictness

When to ask:
- The strategy depends on whether bad input is dangerous, inconvenient, or potentially valid edge-case data.

Do not ask when:
- The field has a standard constraint.

Recommended default:
- Accept flexible input, normalize when safe, and validate with actionable inline feedback.

Reason:
- Overly rigid validation rejects valid user intent; under-validation creates preventable errors.

Question tool pattern:
```js
question({
  question: "Should this input be tightly constrained for safety, or flexible enough to handle edge cases?",
  recommended_default: "Keep ordinary input flexible and correctable; tightly constrain only dangerous or invalid actions.",
  options: [
    "Flexible with validation",
    "Tightly constrained",
    "Expert override allowed",
    "Other / custom"
  ]
})
```

### Decision: Async operation behavior

When to ask:
- An operation may take more than a moment, run in the background, fail, or be retried.

Do not ask when:
- The action is instant and visibly updates the UI.

Recommended default:
- Show immediate receipt, progress/status for delays, safe continuation where possible, and recovery on failure.

Reason:
- Users need to know whether the system heard them and whether it is safe to continue.

Question tool pattern:
```js
question({
  question: "How long can this operation take, and what should users be able to do while it runs?",
  recommended_default: "Show immediate receipt, progress for delays, and allow safe continuation when possible.",
  options: [
    "Instant",
    "A few seconds",
    "Long-running/background",
    "Other / custom"
  ]
})
```

### Decision: Accessibility target

When to ask:
- The product is public sector, enterprise procurement, healthcare, education, finance, or compliance-sensitive.

Do not ask when:
- Basic accessibility can be applied without tradeoff.

Recommended default:
- Meet core WCAG AA-oriented basics unless a stricter target is required.

Reason:
- Accessibility is a baseline usability requirement and may also be contractual or legal.

Question tool pattern:
```js
question({
  question: "Does this product have a required accessibility standard or procurement target?",
  recommended_default: "Meet core WCAG AA-oriented basics by default; confirm stricter targets for regulated or procurement contexts.",
  options: [
    "WCAG AA target",
    "Stricter regulated/procurement target",
    "Internal baseline only",
    "Other / custom"
  ]
})
```
