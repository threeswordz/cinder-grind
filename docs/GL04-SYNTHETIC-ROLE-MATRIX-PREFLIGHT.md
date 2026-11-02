# GL-04 — synthetic role × Company × Project authorization preflight

**Status:** preparation only, not actual configuration verification, business UAT, or GL04 closure. **Authority:** existing [GL04 #304](https://github.com/threeswordz/cinder-grind/issues/304), [GL07–10 #305](https://github.com/threeswordz/cinder-grind/issues/305), [112-ID role source](ROLE-REQUIREMENTS-2026-10-30/13-execution-disposition.md), and DEC-042.

## Why this exists

The source auditor `deploy/uat/gl04-gl07-source-assurance.mjs` checks the 112-ID frozen source census and controller decorator wiring, but **does not prove effective role grants in a running runtime**. `deploy/release-candidate/gl04-synthetic-role-matrix-preflight.mjs` adds a fail-closed **offline evidence declaration** for an eventual isolated non-production prototype. It never logs in, reads confidential records, changes permissions, accesses MKE/TCJ, or performs human UAT.

There are 24 hard-coded expected positive/negative scenarios across Ben, Nancy, Khaimook, Jai, Store Site, Foreman, Koh, Porn and a **separate technical SYS_ADMIN** negative probe. The actions cover PR/PO/GR, physical count, Foreman daily and weekly reporting, Material Request/signed receipt authority, HR employment and encrypted-document visibility, customer BOQ, Company/Project denial and maker/checker independence. These are targeted GL04 probes, **not a claim that all 112 requirements are implemented or that Material Plan B/C have been integrated**.

## CLI after a synthetic prototype exists

```sh
node deploy/release-candidate/gl04-synthetic-role-matrix-preflight.mjs --template > /private/gl04-prototype-matrix.json
node deploy/release-candidate/gl04-synthetic-role-matrix-preflight.mjs --evaluate /private/gl04-prototype-matrix.json EXACT_VERIFIED_MAIN_SHA
```

1. On a properly authorized **isolated synthetic** environment only, collect the exact API/web/main SHA, `PROTO_A` and negative `PROTO_B`, `SITE_A` and `SITE_B` assignments, synthetic business actors, actual authenticated HTTP outcome codes and separate private immutable evidence/audit IDs. Do not run the matrix against retained MKE/TCJ users.
2. Populate each 24-row template field. Keep the `expectedOutcome`/actor/Company/Project/permission values unchanged; use no actual employee names, passwords, bank or HR values. For each approval, record synthetic maker/actor tokens (`ACTOR_XX`) and immutable decision evidence. Same-actor rejection requires equal tokens; successful independent approval requires unequal tokens.
3. CLI returns **0 only for declared structural consistency**, 1 for incomplete or mismatched scenarios, 2 for invalid arguments or unreadable packet. Every result says independent proof pending. The evaluator cannot authenticate evidence IDs or assert actual HTTP requests happened.
4. Independently inspect the cited runtime receipts, configured roles, Company/Project boundaries, nonempty fixtures, source schema and negative response bodies. Only then can the GL04 evidence become part of the full prototype freeze packet, subject to additional requirements and Owner acceptance later. A structurally consistent packet is never an automatic gate PASS.

### Status classification

- For `ALLOW`, accepted HTTP codes are **200/201/204**; for `DENY_AUTH`, **401/403/404**; for `DENY_POLICY`, **403/409**. A server error, HTTP 409 used to disguise an authorization failure, or a missing scenario blocks structural consistency.
- Each of the 24 rows must match its source-declared actor, synthetic Company/Project, permission and individual UTC observation timestamp no more than two hours before the packet capture time, and provide opaque references (placeholders and URLs are rejected). The source and runtime SHAs must equal the externally supplied exact main SHA. A strict UTC captured timestamp must be no older than 48 hours (or more than 5 minutes in the future).
- Unknown top-level/fixture/scenario fields reject, and output reports **only stable gap codes and scenario IDs**. This is deliberate: never surface private user info or content through GitHub checks.
- The role assertions are temporary synthetic targets. They are not hard-coded runtime grants or authorization for real MKE/TCJ actor changes. The separate dedicated HR1-A loopback role-assurance runner remains available for deeper authenticated privacy checks.

## CI and stage sequencing

The script's `.test.mjs` tests are automatically picked up by the existing `node --test deploy/release-candidate/*.test.mjs` CI command (no workflow file edit, new package or runtime path). The suite includes hard failures for missing/duplicate scenarios, stale captures, mismatched SHA, same-actor business approval, unauthorized Foreman stock count or PR, cross-Company/Project attempts, HR confidentiality, placeholders and unwanted input fields.

**No material-plan branch overlap:** This preparation may be reviewed/merged independently on its own stable head, but does not unblock [Material Plan A PR #320](https://github.com/threeswordz/cinder-grind/pull/320), whose mandatory independent Codex review/guarded merge/main CI must occur first before increment B. Separate freeze checker [PR #321](https://github.com/threeswordz/cinder-grind/pull/321) is also still a draft. The current new code changes no application API, database, stock ledger, production settings, user grants or approved business rules.

Human business UAT stays **DEFERRED UNTIL THE FROZEN INTEGRATED PROTOTYPE** (DEC-042). Real GL04, GL07–10, Production and MKE/TCJ onboarding remain unauthorized/unverified as applicable.
