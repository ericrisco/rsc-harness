---
name: e-signature
description: "Use when wiring an e-signature flow with DocuSign or Dropbox Sign — picking the SES/AES/QES legal tier, sending a PDF or template for signature, embedded signing, verifying signing webhooks, retrieving the signed PDF plus audit trail. NOT drafting contract text (that is `contracts`), NOT extracting fields from PDFs (that is `document-processing`)."
tags: [e-signature, docusign, dropbox-sign, esignature-api, webhooks, eidas, esign-act, audit-trail]
recommends: [contracts, document-processing, webhooks, api-connector-builder, gdpr-privacy, automation-flows]
origin: risco
---

# e-signature

You are wiring a third-party signing API (DocuSign eSignature or Dropbox Sign, ex-HelloSign) into someone's app or backend. You take a PDF or template, define signers and fields, send it for signature, track status, react to completion via a verified webhook, and retrieve the signed PDF plus its audit trail.

Contract language — clauses, indemnity, liability — goes to `../contracts/SKILL.md`; OCR, field extraction, or PDF splitting with no signing involved is `../document-processing/SKILL.md`.

## Decision: which legal tier do you need?

Pick the tier deliberately, **before you write code**: it decides which provider features you enable (ID Verification, SMS/access code, qualified signature), and getting it wrong leaves a signature that is hard to defend in court.

US law (ESIGN Act + UETA) has **no tiers** — e-signatures equal wet ink. The EU (eIDAS, and eIDAS 2.0 / Reg (EU) 2024/1183 in force since May 2024) defines three. A typed name (SES) is binding for most B2B in the US and EU, but a high-stakes EU document may need AES or QES. Map the document's stakes to a tier, then to a provider feature.

| Tier | What it is | When you need it | Provider feature to enable |
|------|-----------|------------------|----------------------------|
| **SES** (Simple) | Typed or drawn signature, basic intent + audit trail | Most B2B: offers, NDAs, quotes, US contracts generally | Default flow — just capture the signature + keep the audit trail |
| **AES** (Advanced) | Uniquely linked to signer, identity-verified, tamper-evident | Higher-value EU contracts, regulated sectors | ID Verification, SMS/access-code auth, signer authentication step |
| **QES** (Qualified) | EU handwritten-equivalent EU-wide; qualified cert via a QTSP | Where law mandates it (some real-estate, gov, regulated finance) | Qualified signature add-on through a Qualified Trust Service Provider |

If the document is genuinely high-stakes or you are unsure whether a tier is legally mandated, escalate to a lawyer and to `../contracts/SKILL.md` — you do not give legal advice. Detail and the court-admissibility checklist live in `references/legal-tiers.md`.

## Decision: which provider?

Either is fine. Pick one and stay on it so you keep **one** consistent audit trail.

| | DocuSign eSignature | Dropbox Sign (ex-HelloSign) |
|---|---|---|
| Auth | OAuth 2.0 **JWT Grant** (RSA keypair, impersonation, one-time consent) | API key (header bearer) |
| Core call | create **Envelope** | `signature_request/send` |
| Node SDK | `docusign-esign` (9.0.0) | `@dropbox/sign` (1.11.0) — replaces deprecated `hellosign-sdk` |
| Embedded | `clientUserId` on recipient + recipient view URL | `signature_request/create_embedded` |
| Pricing posture | seat/envelope, enterprise-leaning | API: Essentials ~$75/mo (50+ requests, embedded signing included), Standard ~$250/mo annual (adds bulk send + higher volume), free `test_mode` |
| EU / QES | mature QES + ID Verification | SES/AES focus; check current QES support |

## Auth & setup

Never commit keys. Read everything from env; the RSA private key lives in a secret store or a file path, never inline in source.

Point at the sandbox before prod, always — a live send is billable and emails a real human. DocuSign demo env is `https://demo.docusign.net`; Dropbox Sign uses `test_mode: 1`. Only non-test sends count against quota and reach signers.

| Env var | Provider | Holds |
|---------|----------|-------|
| `DOCUSIGN_INTEGRATION_KEY` | DocuSign | client/integration key (GUID) |
| `DOCUSIGN_USER_ID` | DocuSign | GUID of the user being impersonated |
| `DOCUSIGN_ACCOUNT_ID` | DocuSign | API account ID |
| `DOCUSIGN_PRIVATE_KEY` | DocuSign | RSA private key (PEM) — from secret store |
| `DOCUSIGN_BASE_PATH` | DocuSign | `https://demo.docusign.net/restapi` in sandbox |
| `DROPBOX_SIGN_API_KEY` | Dropbox Sign | API key |

**DocuSign JWT Grant — five steps** (full walk-through in `references/docusign.md`):

1. Create the integration key + RSA keypair in the DocuSign admin console.
2. Grant **one-time consent**: visit the consent URL once as the impersonated user (`.../oauth/auth?response_type=code&scope=signature%20impersonation&client_id=...&redirect_uri=...`).
3. Request a JWT user token (`scope: signature impersonation`), signed with the RSA private key.
4. Call `/oauth/userinfo` to discover the account's correct **base path** — do not hardcode the prod host while testing.
5. Use the returned access token + base path for all API calls; refresh before expiry.

Dropbox Sign needs only the API key as a bearer credential — see `references/dropbox-sign.md`.

```bash
# Bad: key in source, prod host while testing
const apiKey = "hs_live_abc123";          # committed secret
const base   = "https://www.docusign.net"; # prod during a test

# Good: from env, sandbox first
export DROPBOX_SIGN_API_KEY="$(op read op://vault/dropbox-sign/key)"
export DOCUSIGN_BASE_PATH="https://demo.docusign.net/restapi"
```

## Send flow — DocuSign

The core object is an **Envelope**. `status: "sent"` sends immediately; `status: "created"` saves a draft. Anchor strings let you place tabs by text in the PDF instead of fixed coordinates.

```javascript
import docusign from "docusign-esign";

const env = {
  emailSubject: "Please sign: Offer letter",
  documents: [{
    documentBase64: pdfBuffer.toString("base64"),
    name: "Offer.pdf", fileExtension: "pdf", documentId: "1",
  }],
  recipients: {
    signers: [{
      email: signer.email, name: signer.name,
      recipientId: "1", routingOrder: "1",
      tabs: { signHereTabs: [{ anchorString: "/sig1/", anchorYOffset: "-10" }] },
    }],
  },
  status: "sent", // "created" for a draft you send later
};

const api = new docusign.EnvelopesApi(apiClient); // apiClient configured with JWT token + base path
const result = await api.createEnvelope(accountId, { envelopeDefinition: env });
// store result.envelopeId — your handle for status, webhook correlation, and retrieval
```

For templates, send with `templateId` + `templateRoles` (prefilled tabs) instead of raw documents. Envelope/tabs anatomy and template send are in `references/docusign.md`.

## Send flow — Dropbox Sign

The core call is `signature_request/send` (or `signature_request/send_with_template`). Keep `testMode: true` until you intend to spend a real request.

```javascript
import * as DropboxSign from "@dropbox/sign";

const api = new DropboxSign.SignatureRequestApi();
api.username = process.env.DROPBOX_SIGN_API_KEY; // API key as username

const res = await api.signatureRequestSend({
  title: "Offer letter",
  subject: "Please sign",
  signers: [{ emailAddress: signer.email, name: signer.name, order: 0 }],
  files: [pdfBuffer], // or fileUrls
  testMode: true, // flip to false ONLY when going live
});
// store res.body.signatureRequest.signatureRequestId
```

`send_with_template` takes `templateIds` + `signers` mapped to template roles. Details and embedded creation are in `references/dropbox-sign.md`.

## Embedded vs remote signing

- **Remote** (default): provider emails the signer a link. Nothing extra to build.
- **Embedded** (signer signs inside your own UI): DocuSign requires a `clientUserId` on the recipient, then you request a recipient view URL and iframe/redirect to it. Dropbox Sign uses `signature_request/create_embedded` + the embedded sign URL. Embedded signing is included from the Dropbox Sign Essentials API plan up (it is not a Standard-only feature) — but it still requires a paid API plan, not `test_mode` alone.

## Webhooks / completion

A send is not done when status is `sent` — it is done when the signer completes and you have pulled the signed document AND its evidence (DocuSign Certificate of Completion, Dropbox Sign audit-trail PDF), retrieved and stored. Fire-and-forget is the most common bug here.

**Verify the signature before you trust anything in the payload.** The body is attacker-controllable until you have verified it.

- **DocuSign Connect**: HMAC-signed; verify the `X-DocuSign-Signature-1` header against the raw request body using your Connect HMAC key.
- **Dropbox Sign event callbacks**: `event_hash` = HMAC-SHA256 of `event_time + event_type`, keyed by your **API key**.

```javascript
import crypto from "node:crypto";

// Dropbox Sign: verify event_hash before processing
function verifyDropboxSign(event, apiKey) {
  const expected = crypto
    .createHmac("sha256", apiKey)
    .update(event.event.event_time + event.event.event_type)
    .digest("hex");
  return crypto.timingSafeEqual(
    Buffer.from(expected), Buffer.from(event.event.event_hash));
}

// On a verified completion event: retrieve BOTH artifacts, idempotently
async function onCompleted(requestId) {
  if (await alreadyHandled(requestId)) return;     // idempotency guard
  const signedPdf  = await api.signatureRequestFiles(requestId, "pdf");
  const auditTrail = await api.signatureRequestFiles(requestId, "pdf", { fileType: "audit" });
  await store(requestId, signedPdf, auditTrail);   // store IDs + bytes, never log bytes
  await markHandled(requestId);
}
```

For DocuSign, on the `Completed` envelope event call `EnvelopesApi.getDocument` for the signed PDF and for `certificate` to get the **Certificate of Completion**. HMAC verification code and Connect setup are in `references/docusign.md`.

## Anti-patterns

| Anti-pattern | Why it is wrong | Do instead |
|--------------|-----------------|-----------|
| Processing a webhook payload without verifying the signature | Anyone can POST a fake `completed` event | Verify HMAC (`X-DocuSign-Signature-1` / `event_hash`) on the raw body first |
| Trusting `status` from the request body you sent | Status lives with the provider, not your hope | Read status from the verified webhook or a status fetch |
| Sending from prod while still testing | Bills you and emails real people with test docs | DocuSign `demo.docusign.net`; Dropbox Sign `testMode: true` |
| Logging full document/envelope bytes or signer PII | Leaks the very PII the signature protects | Log provider IDs only; store bytes in a secret-aware store |
| Storing the signed PDF but not the audit trail | SES is hard to defend in court without who/what/when/where | Always pull the Certificate of Completion / audit-trail PDF too |
| Reusing one envelope/request to "retry" a send | Duplicates, double-bills, corrupts status | New request per send; use an idempotency guard on completion |
| Hardcoding the API key / RSA private key in source | Secret leak on first push | Env vars + secret store; key file path, never inline |
| Skipping the legal-tier decision | Ship a signature that is not legally adequate | Pick SES/AES/QES first; escalate high-stakes to a lawyer + `../contracts/SKILL.md` |

## Verify

Run `scripts/verify.sh <path-to-integration>` against the code you produced. It greps the artifact (no live API call) for: webhook signature verification present and not a TODO, no hardcoded API key or `BEGIN PRIVATE KEY`, a sandbox/`test_mode` guard, and a completion path that retrieves the signed PDF + audit trail. It is read-only and exits 0 on a clean/empty target.

For data-protection touchpoints (consent, retention of signed docs + PII), flag them and route the policy writing to `../gdpr-privacy/SKILL.md`. For non-signing inbound webhook infrastructure, see `../webhooks/SKILL.md`.
