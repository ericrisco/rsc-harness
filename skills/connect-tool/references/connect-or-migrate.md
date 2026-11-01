# Connect, or migrate?

The agent is only as good as the data it reaches. If the main program lets nothing out (no API, no
export, no readable database), every automation goes through copy and paste. Sometimes the answer
is to **connect it with a bridge** (a nightly export, a read-only database user, the distributor's
module). Sometimes it is to **migrate** to something that connects out of the box. Rarely, it is to
**build** a replacement. Give one verdict, in one line:

- **Connect as is**: a route from SKILL.md section 2 exists and is good enough.
- **Connect with a bridge**: file exchange or a read-only copy ([database bridge](database-bridge.md)).
- **Consider migrating**: with the sum below.
- **Consider building**: only under the conditions below.

Whether a process deserves automating at all is `automation-strategy`'s question, not this one.

## Signals that the program holds you back (the more, the stronger the case to migrate)

1. **No way to get data out** without a person: no API, no automatic export, no readable database.
2. **Unsupported version**: the vendor no longer updates it, or it only runs on one office PC.
3. **The bridge costs more than the change**: an integrator, a module or consulting hours every year
   for what another program includes.
4. **Daily copy and paste** between this program and others. More than 3–4 hours a week is over 150
   hours a year.
5. **Regulation it does not cover**: in Spain, Veri\*factu and B2B e-invoicing ([Spain](spain.md)).
   If the vendor does not adapt it, or charges extra, the business has to move anyway.
6. **Only one person can use it**, or the data ends up in parallel spreadsheets.
7. **It does not grow**: more users, another site, mobile access.

## Signals not to migrate (yet)

1. **Sector software with unique functions**: construction measurement and BC3, legal health and
   safety obligations, installer software, a point of sale integrated with its hardware. Generic
   ERPs do not cover them the same way. **Connect with a bridge.**
2. **The accounting firm works with this program** and you exchange files. Changing alone breaks
   that flow. Decide together.
3. **Mid financial year.** Migrating accounting mid-year complicates the close. The good window is
   **1 January**, or the start of a quarter for invoicing only.
4. **The pain is small.** If a nightly export to Excel solves 80 % of what is wanted, do not migrate
   for the other 20 %.
5. **Nobody can lead the change** inside the company for one to three months.

## The sum, over two years

**Cost of staying** (per year): hours of copy and paste × the hourly cost; plus bridges, modules or
consulting to connect it; plus the regulatory risk (forced adaptation, penalties).

**Cost of migrating** (once, plus the difference in fees): first-year licences minus what stops
being paid; implementation and data migration; training and weeks of lower productivity; the risk
of data that does not move well or sector modules the target lacks.

**Rule of thumb:** if migrating pays for itself in **18–24 months** and there is a **window**
(start of the financial year, licence renewal, forced adaptation), recommend it, with one to three
targets that have a documented API and, ideally, an MCP. If not, **connect with a bridge** and redo
the sum at the next renewal.

## If migrating: seven steps not to lose anything

1. **Inventory**: which data (customers, items, invoices, accounting) and which processes depend on
   the program.
2. **Choose the target with the agent in mind**: a documented API and, if possible, an MCP.
3. **Export the history** and **keep the old system read-only**. Accounting and invoices must be
   kept for years: do not delete it.
4. **Start on a clean date**: start of the year or quarter. Opening balances rather than every
   movement, unless the target imports them well.
5. **One month in parallel** with a real process (invoicing, for instance) before switching off.
6. **Connect the target from day one** (`01-TOOLS/<TARGET>/` and its `test_connection`), so the
   value shows immediately.
7. **Train the team** and name who owns the new system.

## The third way: building it

Some businesses replace a program with their own, built with Claude Code: a custom CRM, a simple
ERP, a bakery's point of sale. Sometimes it is a very good idea; sometimes it is expensive to keep.

Worth it only if **all** of these hold:

- **Small, stable scope**: one function, not "the whole ERP".
- **Someone maintains it**: code in a repository, backups, security updates, and someone who
  understands it when the builder is away.
- **It starts by reading** the old system's data (export or bridge), and both coexist for a while.
- **It does not invoice.** A program that issues invoices must comply with the invoicing
  regulations itself ([Spain](spain.md)). Building invoicing almost never pays: connect it.

Not worth it when the program is sector software with legal obligations (health and safety,
payroll, official accounting), or when only one person understands it.

## Typical targets

| If you have… | Targets to consider | Why |
|---|---|---|
| A closed desktop ERP or accounting program, unsupported | Odoo, Holded, Business Central, Sage Active | Cloud with a documented API |
| Excel as the "ERP" | First Google Sheets or Excel on OneDrive (already connectable); an ERP when volume demands it | Moving the file to the cloud already makes it reachable, at no cost |
| The WhatsApp Business app for orders or bookings | WhatsApp Business Platform (Cloud API), directly with Meta or a provider | Not a change of tool: the edition with an API |
| Notion or Airtable as a CRM | A CRM with API and MCP when there are more than two or three salespeople | While small, Notion and Airtable connect well |

Check each target's current API, MCP and price before recommending it ([what to find out](what-to-find-out.md)).
