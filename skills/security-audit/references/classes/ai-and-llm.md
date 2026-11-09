# AI, LLM and agent classes

Load when: a language model takes part in anything with authority. Chatbots, assistants, RAG,
long-term agent memory, tool-calling loops, MCP servers or clients, code that builds prompts from
outside text, code that acts on model output. Verdict rules: [`../verification.md`](../verification.md).

The flow to follow is always the same: **untrusted text → model or memory → authority, capability
or sink**. The ordinary core classes still apply around the model (transport, access control,
queries, files, rendering). This file covers the delegation layer the model adds. On a large
target, split the hunt into retrieval, memory, tool dispatch, MCP and output.

## Ground rules

Put these in every prompt for a hunter working in this domain.

1. **Guardrail prompts are not a security boundary.** "Never reveal X", "only call tools the user
   asked for", a moderation model, a classifier, a system prompt in capitals: none of these count
   as a control. Only deterministic code counts: authorisation scoped to the resource, isolation,
   binding of an approval to the exact action, credentials narrowed to the task. If the only thing
   between attacker text and a harmful action is the model's obedience, the control is missing.
2. **Prompt injection by itself is not a finding.** The model being talked into saying something
   odd is expected behaviour of the technology. It becomes a finding only when it crosses a
   boundary in code:
   - it reaches **another principal's context** (a victim's session, another tenant);
   - it **triggers an action** with authority the attacker does not have, or one the victim did
     not ask for;
   - it **discloses data** the attacker cannot read directly (exfiltration through output, links,
     image URLs, tool calls);
   - it **drives a sink** the attacker cannot reach directly (shell, SQL, file, URL fetch, payment).
3. **Everything the model reads from outside is untrusted input.** Model output, retrieved
   documents, memory entries, tool results, tool descriptions, MCP responses and sub-agent
   results are attacker-reachable data. Point at the line of code that grants authority to that
   data, trusts it, writes it to durable state or passes it to a sink.
4. **Name the actors.** Attacker; affected principal; effective execution identity (whose
   credential the tool uses); resource; exact action; authority used; observable impact. A user
   who deliberately asks the agent to use the user's own permissions is not a delegation bug just
   because a model executed it.
5. **Authorisation and action binding are two different controls.** A request can pass
   authorisation and still be a finding: when attacker-controlled content makes the agent act
   under a victim's valid authority and the victim never intentionally requested or approved that
   exact action.

## Context, retrieval and memory

### `indirect-prompt-injection`

**What it is.** Someone who can write content (a RAG document, a web page that gets indexed, a
file, an email, a ticket or issue body, a tool response, metadata like filenames or alt text)
gets that content into a **different principal's** model context, where a capability is live.

**Where to look.** Ingestion jobs and connectors; retrieval queries and their filters; the code
that splices retrieved chunks into the prompt; which tools are enabled in the session that
consumes them. Map, per source: who can write it, how retrieval scopes it, whose session reads it.

**How to prove.** Three separate checks: is the source isolated from the victim's context; does the
tool re-check authorisation on the resource; is the resulting action bound to what the consuming
principal actually intended. The finding is the missing deterministic control. Persuasive text on
its own proves nothing.

**Only a note.** The attacker injects into their own session and only gets their own authority.

### `context-bleed`

**What it is.** Chat history, embeddings, retrieval hits or prompt caches are keyed too broadly,
so one session, user or tenant sees another's context.

**Where to look.** Vector-store queries without a tenant or ACL filter in the query itself; cache
keys built from prompt text only; conversation stores keyed by a guessable or shared id; batch and
reindex paths. A `tenant_id` column on the record is not enforcement if some query, cache or batch
job leaves it out.

**How to prove.** Show a write by principal A and a read path for principal B that returns it, with
the missing filter or key component cited.

### `memory-poisoning`

**What it is.** Attacker content, or a model summary of attacker content, is written into
persistent memory and later shapes another task, another user or a more privileged session.

**Where to look.** Every create, update, merge and delete path into memory. Check: who may write;
what provenance and tenant scope is stored; whether a low-trust observation can become a durable
"fact" or "instruction"; whether retrieval keeps user preferences apart from tool policy;
auto-summarisation and "remember this" tools that the model can call on its own.

**How to prove.** Cite both ends: where the attacker writes, and where a different principal (or a privileged decision) later reads it back. A shared record with no reachable consumer is not enough.

**Only a note.** A user deliberately saves a memory and it only affects that same user's own
allowed requests.

### `prompt-provenance-confusion`

**What it is.** Prompt assembly lets untrusted text pass as a system message, an earlier turn, a
tool result, a policy or a memory record.

**Where to look.** String concatenation of roles; untyped history arrays; a `role` field the caller
can set; serialise-then-parse round trips that drop source labels; delimiters that user text can
close (`</tool_result>`, `### System`).

**How to prove.** Show that the forged label changes a deterministic trust decision in code (for
example, the dispatcher only allows a tool when the "system" turn mentions it) or unlocks a real
capability. A model that merely "believes" the fake label is rule 2.

## Tools and actions

### `tool-argument-injection`

**What it is.** Arguments produced by the model flow into SQL, shell, file paths, URL fetches or
privileged APIs with no validation in the handler.

**Where to look.** Treat the tool schema as an input parser. Follow each field from the decoded
call to its sink: `subprocess` with model strings, `open(args.path)`, `fetch(args.url)` (also
`ssrf`), raw query builders, `eval` on model code.

**How to prove.** Trace field to sink, show the missing handler-side check. A JSON schema or
structured output constrains shape only. It does not make a path safe, a URL internal-only, a
query parameterised or a caller authorised.

### `excessive-agency`

**What it is.** Confused deputy. The agent runs tools under a service account or broad
credential, and the handler never re-checks whether the **requesting** principal may do this
operation on this resource.

**Where to look.** Tool handlers that read a global client or admin token; handlers that take
`user_id` or `tenant_id` from tool arguments instead of the authenticated session; tools that
reach internal APIs the product UI never exposes.

**How to prove.** Show that the handler skips any check tying the requester to the resource, and that the normal product would refuse the attacker this same operation.

**Only a note.** A shared credential where every query is still scoped to the requesting user.

### `action-binding`

**What it is.** The approval or intent does not bind to what actually executes. Two shapes:

- The user approves one described action, and execution runs with changed arguments, another
  resource, another principal, or on a later model turn.
- Text planted by the attacker makes the agent produce a side effect using the victim's legitimate permissions, and the victim never meant to ask for it or approve it. Passing a generic permission check does not clear this.

**Where to look.** Confirmation dialogs that show a model-written summary instead of the real
call; approvals stored as "yes" without the call object; approval tokens without expiry; batch
approvals; retries and resumed sessions that replay an approval. The approved object should pin:
normalised tool name, the full argument object, requester, target, amount, expiry, batch
membership. The strongest gate belongs at the point where the arguments can no longer change, ahead of each side effect.

**How to prove.** Establish the intentional request or the approved normalised object (if any).
Compare it field by field with the object the handler executes. Show, in a local fixture, an
unrequested action, a mutated or duplicate side effect, or an authority change. Stop there; do not
carry the test into a harmful execution.

### `tool-schema-mismatch`

**What it is.** Schema and dispatcher disagree: aliases, extra fields, duplicate keys, type
coercion, nested free-form objects, out-of-range values that the validator accepts and the
handler reads differently.

**Where to look.** Schema validation, canonicalisation, generated bindings, handler defaults.
Re-validate wherever a value becomes a resource selector or a security option.

**How to prove.** Diff the object the validator approved (after normalisation) against the one the handler consumes, and show a difference that matters for security.

### `unbounded-agent-loop`

**What it is.** A single bounded request can queue repeated spend, sends, mutations or external API
calls with no per-request budget, per-action authorisation, cancellation or idempotency key.

**Where to look.** Agent loops without max-steps or cost caps; tools that send email, post,
charge, or call paid APIs; retry wrappers around side-effecting tools.

**How to prove.** Show damage to other users, durable state, quotas or money the operator pays, by reading the budget logic in code and running a loop capped locally. Never exhaust a real service to prove it.

## MCP and sub-agents

### `delegation-trust-inheritance`

**What it is.** A sub-agent or MCP call receives the whole session, credentials, memory or tool set
instead of the least authority the task needs, or its result is trusted on the way back.

**Where to look.** The principal and tenant passed into each delegated call; whether capabilities
are narrowed; the audience of forwarded credentials; how returned results are labelled before
they re-enter the parent context (they are untrusted input, rule 3).

### `mcp-identity-confusion`

**What it is.** Calls or results are routed by names an attacker can influence (server name, tool
name, request id, resource URI, model-chosen alias) instead of by the authenticated connection
and the outstanding request.

**Where to look.** Tool registries keyed by bare tool name; two servers allowed to register the
same tool or resource name; reconnect logic that rebinds names; response handlers that match only
on request id across connections; namespacing that the model can pick.

**How to prove.** Verify authenticated connection, request correlation, tool namespace and the
credential each call actually uses. If it depends on external server identity or deployed routing,
the verdict is `needs_validation`.

### `mcp-metadata-as-policy`

**What it is.** Schemas, prompt templates, descriptions of tools, completion suggestions or resource metadata that an MCP peer sends are treated as policy or authorisation. Peer metadata can steer the model; it can
never grant a capability.

**Where to look.** Code that enables tools because the description says "safe" or "read-only";
annotations used as permission flags; schemas from the peer used without a local allowlist.

**How to prove.** Look for the controls that must win when the metadata says otherwise: a fixed local allowlist, a check of which server is actually speaking, and authorisation inside the handler. If none exists and a capability follows, it is a finding.

## Output and disclosure

### `insecure-model-output-rendering`

**What it is.** Model text lands in a sink that interprets it (HTML, Markdown, URL, template, command line) with no encoding or policy fitted to that sink. Includes exfiltration through auto-loaded Markdown images or
links that carry context data in the URL.

**Where to look.** `innerHTML`/`dangerouslySetInnerHTML` with model text; Markdown renderers with
raw HTML on; image auto-loading of model-chosen URLs; model text passed to a shell or `eval`. For
browser renderers, check CSP and sanitisation with the `client-side.md` classes.

**How to prove.** Source to sink in code. If the renderer lives outside the repository, the verdict
is `needs_validation`.

### `context-secret-extraction`

**What it is.** The prompt the code assembles includes secrets, records that belong to someone else, private code, or policy values that grant access on their own, and output the user can steer reveals them.

**Where to look.** Prompt assembly and the data fetched into it: API keys pasted into system
prompts, other users' records pulled by broad retrieval, internal URLs with tokens.

**Only a note.** Leaking the generic system prompt or describing behaviour, when nothing in it
crosses a data boundary.

## Moves that work across all of the above

- Make four lists before hunting: whose identity each tool runs as, which tools exist, which context and memory sources someone can write, and where output goes. A finding is a path from the first list to the authority in the second. - Begin with tools that change things and walk upstream: dispatcher, schema, confirmation step, model context, retrieval, ingestion. For durable memory, begin at each read and list every writer.
- Compare direct, queued, retried, resumed, batched and delegated paths to the same action.

## Proof checklist before reporting

1. Name the boundary and the outcome: who attacks, whose data or shared resource is hit, which identity executes, on what target, and which action or disclosure was neither authorised nor requested.
2. Confused deputy (`excessive-agency`): show the tool lacks requester-and-resource authorisation
   and the attacker has no normal route to the same result. Action binding: show instead that planted content made the agent act with the victim's permissions on something the victim never deliberately asked for or approved.
3. Memory and retrieval: both the attacker's write and the later read by another principal or by a privileged decision.
4. Schema mismatch: diff what the validator approved, after normalisation, against what the handler really used.
5. MCP identity: verify connection, correlation, namespace and credential; otherwise
   `needs_validation`.
6. `confirmed` needs a full source trace and a meaningful result. `needs_validation` names the one
   unresolved fact (provider, deployment, model, renderer, identity) and the bounded check that
   settles it. See [`../verification.md`](../verification.md).
