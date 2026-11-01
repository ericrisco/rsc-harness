# Program types: recognise the program, know what it allows, know who to ask

Option 2 starts here: the user has a program with no API, no MCP and no usable docs, and does not
know what kind of program it is. Their answers to the diagnosis questions place it in one of these
types. **They are a guide, not a closed list.** A program can sit between two types (a desktop
program with a cloud backup, a hosted program that also exports files). Say which type it looks
like, how sure you are, and what would confirm it.

## The diagnosis questions, and what each answer tells you

| Question (plain words) | If yes | If no |
|---|---|---|
| Do you log in with a username and password on a website? | Vendor web app. Docs exist more often than the user thinks: back to research | Installed somewhere |
| Does it keep working when the internet goes down? | The data is local: on this PC or an office server | Web app, or hosted by the distributor |
| Do several computers see the same data? | Client-server: a database on an office server or one shared PC | Single-PC desktop program |
| Do you open it through remote desktop, Citrix, or an icon that connects elsewhere? | **Hosted by the distributor**: the data is not in the office | Installed in the office |
| What extension do the files in its data folder have? | `.mdf` SQL Server · `.mdb`/`.accdb` Access · `.fdb`/`.gdb` Firebird · `.dbf` dBase · `.btr`/`.dat` Btrieve · `.db` Paradox or SQLite | (unknown: ask whoever installed it) |
| Who do you call when it breaks? | That person or company **holds the key** | Nobody: the owner decides alone, and support may be over |

Help the user answer: the data folder is usually under the program's install folder or a path in
its settings; *Help > About* gives the exact version; the vendor's invoice names the distributor.

## The types

### Vendor web app (SaaS)

- **Recognise it:** a website with a login, works from any computer, monthly subscription.
- **What it allows:** almost always an API, an official integration or an export. If research
  found nothing, search again with the vendor's other product names, and look for an
  "Integrations", "API" or "Developers" page inside the app's settings.
- **Who holds the key:** the account administrator. Sometimes that is the accounting firm or an
  agency, not the owner.
- **Ask:** an API key or integration user, read-only, in the name of an integration, not a person.

### Desktop program with a local database

- **Recognise it:** works offline, one PC, data folder on that PC. Common engines: SQL Server
  Express (`.\SQLEXPRESS`), Access, Firebird.
- **What it allows:** file exchange (exports and official imports), or a read-only copy of the
  database ([database bridge](database-bridge.md)).
- **Who holds the key:** the owner for the PC; the distributor for whether reading the database
  keeps support.
- **Ask:** the database engine, whether exports can be scheduled, and the support terms in writing.

### Client-server in the office

- **Recognise it:** several PCs see the same data; one machine (a server or "the main PC") must be
  on. The database is on that machine.
- **What it allows:** the same as a desktop program, with the copy and the reader on the server.
- **Who holds the key:** the IT person who looks after the server, and the distributor for support.
- **Ask:** a read-only user on a nightly copy, reached only privately; never a port open to the
  internet.

### Hosted by the distributor (remote desktop, Citrix)

- **Recognise it:** the user opens a remote desktop or a Citrix icon; nothing of the program is in
  the office; it may keep working from home.
- **What it allows:** **no database to copy and no folder the agent reaches.** The only door is the
  provider: an export they schedule to a folder the client can reach (SFTP, a shared drive), an
  integration module, or a read-only user on their side.
- **Who holds the key:** the distributor or hosting provider, always.
- **Ask:** whether they can drop a scheduled export somewhere the client can read; whether they
  offer an API or integration module; what it costs. Never try to reach their servers any other way.

### Old file database (dBase, Btrieve, Paradox)

- **Recognise it:** an old program, many small data files (`.dbf`, `.btr`, `.dat`), often a
  Windows program from the 1990s or 2000s, sometimes still running under compatibility mode.
- **What it allows:** reading **a copy** of the files with a library for that format (dBase reads
  easily; Btrieve needs its engine or the vendor's description of the records). The program's own
  export is safer when it exists.
- **Who holds the key:** often nobody: the vendor may no longer exist. The person who uses it daily
  knows its exports.
- **Ask:** what exports the program has; whether the vendor still supports it. This type is a
  strong candidate for [connect or migrate](connect-or-migrate.md).

### Linux server or AS/400 (IBM i)

- **Recognise it:** green-screen terminal, or a program the IT person describes as "the server".
  Common in larger or older companies, distribution and manufacturing.
- **What it allows:** a database that is usually queryable (Db2 for i on AS/400; PostgreSQL,
  MySQL or a proprietary engine on Linux) and scheduled exports, both set up by the IT person.
- **Who holds the key:** the IT person or the company that maintains the system.
- **Ask:** a read-only user on the views needed, or a scheduled export; how they reach it
  privately.

### Not a program: Excel or a shared folder

- **Recognise it:** "our ERP is an Excel".
- **What it allows:** move the file to OneDrive or Google Drive and connect that; or read a copy
  from a synced folder. No bridge needed.

## After placing it

Tell the user, in short sentences: the type it looks like, what can be tried, what they must
confirm, and who to ask. Then the closed questions for that person (SKILL.md, option 2, step 3),
and the case left open in `02-DOCS`.
