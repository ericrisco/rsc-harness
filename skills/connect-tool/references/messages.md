# Messages: asking whoever holds the key

Used in option 2, when the connection depends on someone else. Write the message in the user's
language and register, change what is between `<…>`, remove what does not apply, and add no
requests that are not needed. Every message keeps four things: **read-only**, **a dedicated user**,
**nothing open to the internet**, and **the cost question**. If `unslop` is installed, pass the
message through it.

The person on the other side does not need to know what an "AI harness" is. Ask for concrete,
familiar things: a read-only credential, in the name of an integration, with the least access.

## Before writing: five facts

1. The exact name and version of the program ("Sage 200 2025", "ContaSOL 2026").
2. Where it is installed: the vendor's cloud, an office server, someone's PC, the distributor.
3. Who maintains it: own IT person, distributor, vendor, accounting firm.
4. Exactly which data: "issued and received invoices for the last 12 months", not "everything".
5. Read only, or also write. Start with read.

## A. Installed program → IT person or distributor

> Hi `<name>`. I want to automate `<sales and collections reports / entering invoices>` with an AI
> tool. It needs to read data from `<program and version>`. In order of preference:
>
> 1. Do you or the vendor have an **API or integration module** for this program, or a cloud
>    edition with an API? What does it cost?
> 2. If not, can the program **export automatically** every night `<invoices, customers, stock>`
>    to CSV or Excel in a folder?
> 3. If not, can you create a **read-only database user** limited to `<these views>`, reachable
>    only through a VPN?
>
> I do not need to write anything in the program. I do not want to open ports to the internet or
> use the administrator account. Which option do you see, and what would it cost?

## B. The vendor itself (no reply from the distributor, or no distributor)

> Subject: Integration enquiry for `<program>` version `<version>`
>
> Hello. We are licensed customers (`<licence number or tax ID>`). We want to connect `<program>`
> to an analysis tool of our own, **only to read data** (`<sales / invoices / customers / jobs>`).
>
> 1. Is there a module, API, web service or automatic export? For which version and licence?
> 2. If not, can we have a **read-only database user** on views without losing support? Please
>    confirm in writing.
> 3. Is there technical documentation? What does it cost (setup, fee, hours)?
> 4. Do you have a cloud edition with an API?
>
> Thank you. `<name, phone>`

Asking also leaves in writing whether support is kept.

## C. Program hosted by the distributor (remote desktop, Citrix)

> Hi `<name>`. We use `<program>` on your hosted service. We want an AI tool to read
> `<invoices, customers, stock>` for internal reports. Since the program runs on your side:
>
> 1. Can you schedule an **automatic export** of that data to a folder we can reach (SFTP or a
>    shared drive)? How often?
> 2. Do you offer an **API or integration module** for the hosted version?
> 3. Could you give us a **read-only user** on a copy of our data, on your side?
>
> We do not need to write anything. What does each option cost?

## D. Accounting firm (the program is theirs)

> Hi `<name>`. We are automating our internal reports. Could you leave in a shared folder, every
> `<week / month>`, `<the balance sheet, the customer and supplier ledgers, filed tax returns>` in
> Excel? If your program can give the company read-only access to its own data, that works too.

When the program belongs to the accounting firm, the owner asks the firm, not their own IT person.

## E. Web tool run by someone else (accounting firm, agency, partner)

> Hi `<name>`. Could you create in `<tool>` a **read-only API key or integration user** named
> "rsc-read"? It is for automatic reports. If the tool cannot limit permissions, tell me before and
> we discuss it.

## F. Google Workspace → administrator

> Hi `<name>`. I need to authorise an app with **read-only permissions**
> `<gmail.readonly / drive.file / spreadsheets.readonly / calendar.events.readonly>`. In API
> controls, keep it under "Specific Google data" and, if possible, limit it to `<this folder or
> sheet>` by sharing it with a service account without domain-wide delegation. Consent screen
> "Internal".

## G. Microsoft 365 → administrator

> Hi `<name>`. I need to register an app in **Entra ID** with read-only delegated permissions
> (`User.Read`, `Mail.Read`, `Files.Read`…) or, if it runs without a user, `Sites.Selected` with
> the "read" role on the site `<name>` only. It needs admin consent and "Assignment required" for
> my user only. No write permissions on the whole tenant.

If the company only authorises Copilot, do not force another AI: suggest Copilot Studio or Power
Automate, or ask for the exception in writing.

## H. WhatsApp Business → provider (BSP or Tech Provider)

> Hello. We want to register our number on the WhatsApp Business Platform in **coexistence**, so we
> keep using the app on the phone. Do you do that? What does it cost per month and per
> conversation? Do we get API and webhook access, or only your dashboard? We need a system user
> with access to our WABA only.

The WhatsApp Business *app* has no API. Unofficial tools that read WhatsApp Web get the number
blocked.

## When they say "that cannot be done"

Ask:

1. "Can it **export** to Excel or CSV, even by hand?" If yes, there is a starting point.
2. "Does the vendor have **partners or integrators** who connect it?"
3. "Is there a **cloud edition** of the program?" They usually come with an API.
4. "What would it take for it to be **read-only and with nothing open to the internet**?"

## What is not accepted

- The administrator's password, or another person's user.
- Opening the database or remote desktop port to the internet "so it works".
- A key that can do everything when a limited option exists.
- Credentials sent by email or WhatsApp. They are pasted directly into `01-TOOLS/<TOOL>/.env`.
