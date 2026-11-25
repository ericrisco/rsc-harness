# DPAs & transfers (Article 28 + SCCs)

## Article 28 mandatory clauses — demand/offer table

A binding written DPA is required whenever a processor handles personal data on a controller's behalf. Check each clause is present. As **controller** you demand them; as **processor** you offer them. Missing any of these is a non-compliant DPA.

| Mandatory clause | As controller, demand | As processor, offer |
|---|---|---|
| Process only on documented instructions | Processor acts only on your written instructions; flags if an instruction breaches GDPR | Bind yourself to the controller's documented instructions |
| Confidentiality | Everyone handling the data is under a confidentiality duty | Confirm staff/contractors are bound to confidentiality |
| Art. 32 security | Specified technical & organizational measures, not "industry-standard" | List the actual measures you maintain |
| Sub-processor authorization + flow-down | Prior authorization (or general auth + change notice); same obligations flow down | Name current sub-processors; flow the same terms down |
| Sub-processor change notice | Right to object before a new sub-processor is engaged | Give advance notice + an objection window |
| Assist with data-subject rights | Processor helps you answer DSARs | Commit to assisting within a stated time |
| Assist with breach | Processor notifies you without undue delay so you can meet 72h | Commit to a fast internal notification window |
| Delete or return at end | Choice to delete or return all data on termination | Offer delete-or-return and certify completion |
| Audits | Right to audit / receive audit evidence | Provide audit reports / allow audits on reasonable notice |

The surrounding commercial paper (liability cap, indemnity, the MSA the DPA hangs off) is `../contracts/SKILL.md`, not this skill.

## 2021 SCC module picker

The Commission's modernised Standard Contractual Clauses (adopted 4 June 2021) come in four modules. Pick by the roles of the **exporter** (in the EEA) and the **importer** (outside it). The 2021 SCCs already incorporate Art. 28 terms, so a separate DPA for the transfer is not needed on top.

| Module | Exporter → Importer | Typical case |
|---|---|---|
| **Module 1 (C2C)** | Controller → Controller | EU company shares data with an independent third-party controller abroad |
| **Module 2 (C2P)** | Controller → Processor | EU company → a non-EEA vendor processing on its behalf (most common SaaS case) |
| **Module 3 (P2P)** | Processor → Sub-processor | An EEA processor engages a sub-processor outside the EEA |
| **Module 4 (P2C)** | Processor → Controller | A processor returns/sends data to a controller outside the EEA |

## Transfer Impact Assessment (TIA) skeleton

Post-*Schrems II*, SCCs alone may not be enough — assess whether the destination's laws undermine them.

```text
1. Transfer mapped: what data, to whom, to which country, under which module.
2. Local-law assessment: do the importer's country's surveillance/access laws
   conflict with the SCC guarantees? (e.g. government access powers)
3. Supplementary measures (if needed): encryption with EEA-held keys,
   pseudonymisation, contractual transparency commitments.
4. Conclusion: transfer can proceed / proceed with measures / cannot proceed.
5. Reviewer + date; revisit on legal change.
```

## EU-US Data Privacy Framework (DPF) note

For a US importer, the DPF is an alternative to SCCs **only if that specific importer is actively certified** under the framework. Verify the certification (and its scope) on the DPF list before relying on it — do not assume a US vendor is covered. If certification lapses, you fall back to SCCs + TIA.

## Sub-processor change-notice clause (drop-in text)

```text
The Processor maintains a current list of sub-processors at [URL/LOCATION].
The Processor shall give the Controller at least [N, e.g. 30] days' prior
written notice of any intended addition or replacement of a sub-processor.
The Controller may object on reasonable data-protection grounds within
[M, e.g. 14] days; absent agreed resolution, the Controller may terminate the
affected services.
```

---

**Before signing or relying on any of this:** have a qualified privacy counsel / your DPO review the DPA and the transfer basis. This is a drafting aid, not legal advice.
