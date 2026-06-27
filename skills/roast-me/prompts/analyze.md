# Prompt Quality Analysis

You are analysing user prompts extracted from AI assistant session logs. Your job is to find the prompts that — due to how they were written — caused measurable negative outcomes. You are NOT here to polish good prompts. You are here to find the ones that genuinely cost the user time or effort.

## Input

You will receive a JSON array of prompt records. Each record has:

- `prompt_text` — the user's message (may be truncated)
- `prompt_length` — full length before truncation
- `prompt_position` — 1-based index in the conversation (1 = opening prompt)
- `total_prompts_in_session` — how many user prompts were in this session
- `has_xml_tags` — whether the prompt uses XML structural tags
- `has_file_paths` — whether explicit file paths are mentioned
- `has_code_blocks` — whether code blocks appear in the prompt
- `followed_by_error` — a tool error occurred after this prompt
- `error_was_recovered` — the agent recovered from the error without user help
- `followed_by_correction` — the user had to correct the agent's next action
- `correction_text` — what the correction said
- `error_tool` — which tool produced the error
- `error_text` — the error message
- `context_before` — the preceding assistant message (for context)

## The Golden Rule: Impact First

**Only flag issues where the writing of the prompt was a meaningful cause of a bad outcome.** The user is a productive senior developer. Most short prompts, most exploration errors, and most terse follow-ups are completely normal and correct.

### Do NOT flag (be generous):

- Short continuations: "yes", "ok", "commit", "looks good", "go ahead" — these are normal turn-taking, not bad prompts
- Deep-in-session brevity (high `prompt_position`) — context is established; terseness is appropriate
- Any prompt where `followed_by_error = true` AND `error_was_recovered = true` — the agent handled it; the prompt did its job
- Simple, clear requests that worked cleanly (no error, no correction)
- System or slash-command messages (content like `<command-message>` wrapper tags)
- File-not-found during exploration — this is normal agent behaviour
- Errors caused by environment issues, not by prompt ambiguity

### DO flag (only these):

- Prompt was so vague that the agent went in a completely wrong direction and the user had to redirect
- Missing context (file, error message, expected behaviour) that **directly caused** an unrecovered error or wasted significant work (>10 tool calls)
- User had to correct the agent immediately after — meaning the prompt was genuinely misleading
- Multiple unrelated tasks in one prompt that caused one of them to fail
- Prompt that triggered a dangerous or irreversible action (mass deletion, dropping data, force-pushing to main)

## Issue Categories

| Code | When to apply |
|------|---------------|
| `VAGUE` | "fix it", "make it work", "clean this up" — zero specifics, agent had no signal to start correctly |
| `NO_CONTEXT` | Missing file path, error message, or expected vs actual behaviour — would have changed where the agent looked |
| `NEGATIVE` | Specifies only what NOT to do without saying what TO do — agent guessed wrong as a result |
| `NO_CRITERIA` | No way to know when the task is done — agent produced something, user rejected it, but the prompt gave no target |
| `WALL_OF_TEXT` | Long unstructured paragraph for a complex multi-step task that should use headings, lists, or XML sections |
| `SCOPE_CREEP` | Multiple unrelated tasks crammed together — one failed because the other consumed all the agent's attention |
| `SELF_CONTRADICT` | The user's next message corrected the direction — meaning the prompt was internally inconsistent or misleading |
| `NO_STRUCTURE` | Complex multi-step or multi-file task with no structure at all — agent had to guess the sequencing |
| `CAUSED_FAILURE` | Prompt wording directly caused a tool error or a wrong action (dangerous, irreversible, or significantly wasteful) |

## Severity Guide

- **high** — prompt directly caused wasted work (>20 tool calls), a dangerous action, or required significant correction effort
- **medium** — prompt caused moderate inefficiency (5–20 wasted tool calls) or noticeable misdirection
- **low** — minor improvement possible; the prompt mostly worked but a small change would have helped

## Output Format

Return a JSON array. Include one object per prompt that has real issues. Skip issue-free prompts — most records should produce no entry.

```json
[
  {
    "index": 0,
    "issues": ["VAGUE", "NO_CONTEXT"],
    "severity": "high",
    "impact": "Agent spent 28 tool calls scanning the wrong directory before the user provided the file path",
    "explanation": "Opening prompt says 'fix the login bug' with no file, error, or expected behaviour — agent had to guess everything",
    "technique": "The 3W Rule: What (the problem), Where (file/service), Why (expected vs actual). Front-load all three.",
    "rewrite_suggestion": "Fix the auth middleware in src/middleware/auth.ts — valid JWT tokens are returning 401. Expected: token verified and request passed through. Error: [paste stack trace]",
    "original_prompt_snippet": "first 200 chars of prompt_text"
  }
]
```

Field notes:
- `impact` — be specific: wasted tool calls, dangerous action, correction loops. Not "unclear".
- `technique` — a named, reusable pattern the user can consciously apply next time.
- `rewrite_suggestion` — a concrete rewrite of THIS prompt applying the technique.

Be constructive. The goal is a skill lesson attached to a real example, not a catalogue of imperfections.
