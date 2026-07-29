---
name: domains-dns
description: "Use when pointing a domain at a host or fixing broken HTTPS — delegating nameservers, writing A/AAAA/CNAME/ALIAS/MX/TXT/CAA rows, apex vs www, standing up auto-renewing TLS, and cutting nameservers over without downtime. NOT inbox placement or warmup (that is `email-deliverability`), NOT what runs behind the name (that is `deployment`)."
tags: [dns, tls, ssl, domains, https, acme, certbot, dig, caa, nameservers]
recommends: [email-deliverability, deployment, monitoring, cloudflare, vercel]
origin: risco
---

# Domains & DNS

You set up a name end to end: register or delegate it, write the records, and serve valid HTTPS. Almost every "my domain doesn't work" report is one of a handful of recurring mistakes. This skill names them and gives you paste-ready records plus the commands to prove they took.

## Resolution order is debug order

A request resolves in one direction. Diagnose in the same direction, top-down, because the bug is almost always at the layer the user is *not* looking at.

1. **Name** — does the domain exist and is it registered/not expired? (`whois`)
2. **Delegation** — do the registrar's nameservers point at the DNS provider that actually holds the zone? (`dig NS`)
3. **Records** — does the authoritative zone return the right A/AAAA/CNAME/ALIAS/MX/TXT/CAA? (`dig @<authoritative-ns>`)
4. **TLS** — does the served chain validate and is it unexpired? (`openssl s_client`)

Rule: never debug TLS before you've confirmed the record resolves to the box you think it does — a cert error is often a record pointing at the wrong host. Query authoritative nameservers, not your laptop's cache, or you'll chase a stale answer for an hour.

## Where the DNS lives

Pick **one** authoritative provider and keep the whole zone there. Splitting a zone across two providers (some records at the registrar, some at Cloudflare) is the source of "it works for me but not for them" — resolvers see whichever NS set answered.

| Host the zone at | Choose when | Why |
| --- | --- | --- |
| Registrar DNS (GoDaddy, Namecheap, Porkbull) | Tiny static site, one or two records | One vendor, fewer logins; weak APIs and slow propagation |
| Dedicated DNS (Cloudflare, DNSimple) | Most cases; want CNAME flattening + fast edits | Apex flattening, low TTL edits, good API; see ../cloudflare/SKILL.md |
| Cloud DNS (Route 53, Cloud DNS) | Already all-in on AWS/GCP and want alias-to-LB | Native alias records to cloud load balancers |
| Host-managed (Vercel, Netlify) | The host *is* the only thing the domain serves | Auto-TLS + apex flattening handled for you; see ../vercel/SKILL.md |

## Apex vs www — the load-bearing trap

You **cannot put a CNAME at the zone apex** (the naked `example.com`). The spec forbids a CNAME coexisting with the SOA and NS records that must live there (RFC 1034 §3.6.2, RFC 2181). Registrars that let you save it produce a silently broken zone.

```text
# Bad — CNAME at the apex. Breaks SOA/NS; mail and other apex records vanish.
example.com.        CNAME   cname.vercel-dns.com.

# Good — flatten at the apex (ALIAS/ANAME or provider flattening), CNAME only on the subdomain.
example.com.        ALIAS   cname.vercel-dns.com.     # Cloudflare/Netlify/Route53/DNSimple equivalent
www.example.com.    CNAME   cname.vercel-dns.com.

# Good (no flattening available) — hard-code the host's published A/AAAA at the apex.
example.com.        A       76.76.21.21
www.example.com.    CNAME   cname.vercel-dns.com.
```

Then pick **one canonical host** and 301 the other to it (apex→www or www→apex — either, just be consistent). Two live origins split your SEO and your cookies. The redirect lives at the host/edge, not in DNS.

## Record cookbook (summary)

One example row per type. Edge cases — TXT 255-char chunking, MX priority math, the SPF 10-lookup limit, SRV format, NS/SOA, PTR, DNSSEC — live in `references/record-cookbook.md`.

| Type | Use for | Example (name → value) |
| --- | --- | --- |
| `A` | name → IPv4 | `app → 76.76.21.21` |
| `AAAA` | name → IPv6 | `app → 2606:4700::6810` |
| `CNAME` | subdomain → another name (never apex) | `www → cname.vercel-dns.com.` |
| `ALIAS`/`ANAME` | apex → another name (flattened to A/AAAA) | `@ → cname.netlify.app.` |
| `MX` | where mail is delivered (priority, lower = first) | `@ → 10 mail.example.com.` |
| `TXT` | SPF / DKIM / DMARC / domain-verification | `@ → "v=spf1 include:_spf.google.com ~all"` |
| `CAA` | which CA may issue certs | `@ → 0 issue "letsencrypt.org"` |
| `SRV` | service discovery (proto/port) | `_sip._tcp → 10 5 5060 sip.example.com.` |

The SPF/DKIM/DMARC/MX **rows** belong here. *Whether mail lands* — reputation, warmup, inbox placement — is ../email-deliverability/SKILL.md.

## TLS / certificates

**The 2026 reality:** the CA/Browser Forum cut the maximum public-TLS lifetime to **200 days** (from 398) on 2026-03-15, dropping to **100 days on 2027-03-15** and **47 days on 2029-03-15**; domain-validation reuse is capped the same way (200 → 100 → 10 days). Manual annual certs are dead. **Automate renewal or accept guaranteed outages.**

Decision: how does the CA prove you control the domain?

| Challenge | Use when | Cost |
| --- | --- | --- |
| **HTTP-01** | Single host, port 80 reachable, no wildcard | Simplest; needs inbound :80 |
| **DNS-01** | Wildcard cert, or port 80 closed, or cert issued off-box | Needs API access to write a `_acme-challenge` TXT |

Rules, each with the failure it prevents:

- **Add a CAA record that allows your CA *first*.** `0 issue "letsencrypt.org"`. Wildcards need the separate `issuewild` tag. A CAA that omits your CA makes ACME fail with a CAA error before any cert is issued (RFC 8659).
- **Serve the full chain, not the leaf.** A leaf-only config validates in browsers (they cache intermediates) but fails on `curl` and mobile — the classic "works on my machine" TLS bug. Serve `fullchain.pem`.
- **Use the ACME staging environment to test.** Let's Encrypt allows **50 certs per registered domain per rolling 7 days**; burning that on retries locks you out for a week. Renewals recognized via ARI (ACME Renewal Info) are exempt from the limit.
- **Prefer platform-managed certs when the host offers them.** Vercel/Netlify/Cloudflare provision and renew automatically once the record resolves — don't hand-roll certbot on top.

certbot/acme.sh recipes, wildcard via DNS-01, Cloudflare Full vs Full(strict), and the renewal-automation + ARI detail are in `references/tls-and-acme.md`.

## Verify it

Query the authoritative answer and the wire, never your local cache.

```bash
dig +short app.example.com                      # the resolved record, your resolver's view
dig +trace example.com                          # full delegation chain from the root — spot stale NS
dig @ns1.provider.net example.com A             # ask the authoritative NS directly
dig CAA example.com +short                       # confirm the CA you use is allowed
openssl s_client -connect example.com:443 -servername example.com </dev/null 2>/dev/null \
  | openssl x509 -noout -subject -issuer -dates  # served chain subject/issuer + validity window
curl -vI https://example.com 2>&1 | grep -Ei 'HTTP/|location|SSL certificate'  # status + redirect + cert verdict
```

Propagation is governed by **TTL, not a fixed 48 hours** (RFC 2181). To make a change land fast, lower the record's TTL (e.g. to 300s) *before* you change it, so resolvers re-query sooner. NS/registrar delegation changes can still lag because of registry/TLD TTLs.

`scripts/verify.sh <domain>` runs the whole done-check read-only: apex-CNAME check, CAA sanity, chain completeness + expiry, HTTPS reachability, www↔apex canonical. The full dig/openssl/curl playbook and an error → cause → fix table are in `references/verify-and-debug.md`.

## Nameserver cutover (no downtime)

Order matters; each step has a reason.

1. **24–48h ahead, lower the TTL** on every record at the current provider (300s). Resolvers will pick up the new zone quickly when you flip.
2. **Pre-stage every record at the new provider** — copy A/AAAA/CNAME/MX/TXT/CAA exactly. A missed MX row = lost mail the moment NS flips.
3. **Flip the NS records at the registrar** to the new provider's nameservers. This is the only switch; the zone is already correct on the other side.
4. **Verify authoritatively** with `dig +trace` and `dig @<new-ns>` until the new NS answer is global. Don't trust your browser.
5. **Once stable, raise TTLs back up** (3600–86400s) to cut query load.

## Anti-patterns

| Anti-pattern | Why it bites | Do instead |
| --- | --- | --- |
| CNAME at the apex | Illegal per spec; kills SOA/NS, MX, and other apex records | ALIAS/flattening or hard A/AAAA at apex |
| "Wait 48 hours" for propagation | Propagation is the TTL; you're just guessing | Lower TTL before change; verify with `dig +trace` |
| Confirming a change in your browser | Local/OS resolver cache lies for the old TTL | Query authoritative NS or `@1.1.1.1` |
| Manual yearly cert renewal | Max lifetime is 200d now, 47d by 2029 — it *will* expire | ACME auto-renew or platform-managed TLS |
| Issuing certs with no CAA / wrong CAA | ACME fails with a CAA error before issuance | `CAA 0 issue "<your-ca>"`; add `issuewild` for wildcards |
| Serving the leaf cert only | Browsers cache intermediates; curl/mobile break | Serve `fullchain.pem` |
| Splitting one zone across two providers | Resolvers answer from whichever NS won; records vanish intermittently | One authoritative provider per zone |
| TTL left at 86400 during migration | Old answer cached for a day after you flip | Drop to 300s a day ahead |
| Testing certs against ACME production | Burns the 50-cert/7-day limit; week-long lockout | Use the staging endpoint first |
