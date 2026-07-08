# Zapier (MCP) vs n8n vs Make — when to reach for which

Zapier the *platform* is compared for flow-building in `automation-flows` and `automation-strategy`. This note is narrower: given the **programmatic / agent** angle this skill covers, when do you invoke Zapier MCP, and when do you route the user to n8n or Make instead? The deciding axis is almost always **"invoke an action" vs "manage a workflow by code."**

## The one axis that decides it

| You need to… | Reach for |
| --- | --- |
| Have an agent *perform an action* in a SaaS app by natural language | **Zapier MCP** — its whole design. |
| *Create / read / update / delete workflows* by API | **n8n** or **Make** — Zapier can't (see `programmatic-limits-and-partner-api.md`). |
| Reach an app nobody else integrates | **Zapier** — widest catalog (9,000+ apps). |
| Self-host, keep data on your infra, control cost at high volume | **n8n**. |
| A visual builder for a non-technical owner, no code, no server | **Zapier** or **Make** cloud. |

## Programmatic control: the hard differentiator

This is where the three genuinely diverge, and it is the reason to route away from Zapier for automation-of-the-automation:

| Capability | Zapier | n8n | Make |
| --- | --- | --- | --- |
| Agent invokes an app action (MCP) | **Yes — MCP** | via HTTP/nodes, no first-class hosted MCP-of-everything | limited |
| Public API to **create** a workflow | No (normal accounts) | **Yes** (REST API) | **Yes** (API) |
| Public API to **list / update / delete** workflows | No (normal accounts) | **Yes** | **Yes** |
| Export / import a portable workflow definition | No portable export | **Yes — workflow JSON** | Blueprint JSON (import within Make) |
| Self-host | No | **Yes** | No |

If the user's sentence contains "programmatically", "by API", "in CI", "spin up workflows from code", or "version-control my automations" — Zapier is the wrong tool and you should say so, then point at n8n (fullest CRUD + self-host + portable JSON) or Make.

## Cost shape (quote the vendor pages; figures move)

- **Zapier** bills per **task** — every action step counts, and **each successful MCP tool call = 2 tasks**. Chatty agents and many-step Zaps get expensive fast.
- **Make** bills per **credit** (one module action ≈ 1 credit; the unit became "credits" in 2025).
- **n8n** bills per **execution** — a whole run counts once regardless of step count; self-hosted is effectively free of per-run metering.

For high-volume or many-step automation, n8n's per-execution model routinely undercuts Zapier's per-task model by a wide margin. Re-check `zapier.com/pricing`, `make.com/en/pricing`, `n8n.io/pricing` before advising — these are the fast-moving numbers.

## Rule of thumb

- **Invoke → Zapier MCP.** One agent, acting in the long tail of apps, right now.
- **Manage → n8n / Make.** Code that builds, edits, versions, or tears down workflows.
- **Design → automation-flows.** What the flow *is*, before anyone operates it.
- **Choose → automation-strategy.** Which platform, by billing model and constraints, before building.

Don't force Zapier to be the programmatic-control layer it isn't. Invoking is its strength; managing workflows by API is n8n/Make's.
