# Material UOM A — definition and exact-validation foundation

18 November 2026 SGT. **UNMERGED IMPLEMENTATION CANDIDATE.** Approved scope: [DEC-050 / UOM-D01](OP-MATERIAL-UOM-01-ENTRY.md), #354, SS03 / PUR13. Stage A's prepared definition APIs/editor and exact validation are implemented on the sole-writer candidate; complete CI, independent review and integration remain required. No full mixed-UOM, actual deployment or acceptance is claimed.

## Predecessor and bounded outcome

Approved entry #371 is integrated at `59d67d1f2e54e6bfde51e4c5be336ea97906bf52`, exact tree `c625b8b51c60173218f8a087d9b317f8edb7b46a`. [Required exact-main44302685891](https://github.com/threeswordz/cinder-grind/actions/runs/44302685891) completed SUCCESS before Stage A runtime/schema work began. No interim human UAT applies under DEC-042.

Stage A lets an explicitly authorized material maintainer prepare one pinned stock unit, append immutable material-specific direct ratio revisions with explicit effective dates, and preview an entered quantity exactly. It does not opt inventory sources into conversion or modify the existing posting, availability, reservation, plan or Finance owners. Stage B must integrate these prepared facts before operational activation is exposed. Preparing definitions is not SS03 completion.

## Persisted facts and immutable identity

- A Company/material stock-basis header pins its stock UOM and precision. This prepared identity has no active-inventory flag. It cannot be deleted, repointed, or inferred from a later material-default change.
- Each conversion revision identifies that header, a same-Company active source UOM and pinned precision, an explicit effective calendar date, exact positive integer numerator/denominator, reason and actor/session provenance. Reduce the ratio exactly. Ratios are direct source-to-stock; no floating-point factors, chained conversions or global pack sizes.
- Select the latest effective date on or before the explicit conversion business date, then the highest immutable header revision for that date. This permits an explicit corrective revision without editing the previous definition or introducing ambiguous selection. The stock unit has the identity ratio; a conflicting self-conversion is rejected.
- Every revision is append-only, including unused/future-effective definitions. Later source owners must freeze its identity and exact ratio rather than reinterpret old sources. Unit precision is protected once referenced by prepared facts; inactive references cannot be used for a new preview or revision.
- Header versions serialize competing revisions. Durable operation receipts bind Company, actor, action, request key, material, exact payload and outcome. Same-key response-loss retry returns the stored outcome only after current authority is revalidated; changed payload or stale competing version fails.

## Authorization and exact arithmetic

Read/preview requires `master.material.view`, a current persisted session and an active same-Company Employee. Preparation/revision additionally requires existing `master.material.manage` and the explicit new `master.material.conversion.manage` capability. Add only the capability catalog; no migration/bootstrap grants. Technical-administrator labels supply no conversion authority. Resolve all rights from active same-Company persisted role assignments at every action/retry, including direct service calls. Operational Project authority remains the responsibility of Stage B's existing source services.

Use integer arithmetic for source quantity × numerator ÷ denominator. Check entered-unit precision and exact stock-unit representability before presentation. Stock precision is at most four decimal places and stock quantities remain within DECIMAL(18,4). Reject zero/negative, noncanonical, malformed, nonrepresentable and overflow inputs atomically. Explicit YYYY-MM-DD validation rejects nonexistent calendar dates; there is no server-today fallback. Preview returns entered and stock facts, business date, selected immutable revision (or identity), ratio and header version. It is a preview, never a stock effect or authorization to post.

## User interface

Use existing scoped material/UOM choices in Master Data; no pasted database identifiers. Provide EN/TH/zh-TW labels for the prepared basis, effective revision, ratio, entered quantity/date, exact result and actionable errors. Keep read/maintain actions distinct. Show clearly that prepared definitions do not enable inventory conversion. Clear stale selections/results when material, identity, permissions or input changes. A response-loss retry retains the same payload/request identity.

## Required evidence before Stage B

1. Registered pure contract tests: exact ratio/date/quantity parsing, representability, maximum bounds and immutable historical preview examples.
2. Actual PostgreSQL/authenticated HTTP: current session/Employee/Company/role denials, explicit capability, CSRF, inactive references, immutable SQL facts/precision, scoped lookups, same-date corrective revisions and competing-version races, same-key retries and changed payloads, effective-date selection and unchanged stock/commercial owners.
3. Real built React browser: scoped pickers, create/read/revision/preview, three locales, narrow layout, denied actions and stale-result handling.
4. Exact forward-only migration and catalog contract; populated predecessor rows/grants remain unchanged. Existing prior schema/history/recovery contracts remain registered. Separate restored application must read the prepared definitions and deny unauthorized access without altering old business rows.
5. Applicable exact-head push/PR CI, stable independent DEC-022 review, governed integration/tree equality and required exact-main success. A green Stage A is not mixed-UOM stock, Mac deployment, final recovery milestone7, prototype freeze, human acceptance or Production.

## Existing source seams to preserve in B/C

This is a source map, not authority to begin B before A's gates. Existing `InventoryQuantityService` locks/sums by Company/warehouse/material/Project/UOM; conversion must resolve the same pinned base before acquiring that lock, not sum unlike dimensions afterward.

| Canonical owner | Required integration boundary |
|---|---|
| GoodsReceiptService | Keep copied PO/GR entered UOM and cumulative commercial receipt checks; add exact base provenance to its existing approved stock effect. Reverse the original posted base fact. |
| MaterialReservationService | Capture explicit business date when absent; freeze normalized reservation quantity at activation and use that base for availability/fulfillment. |
| MaterialIssueService | Preserve source/request/plan/approval and reservation eligibility; compare and post on one base while retaining the authorized entered source. |
| MaterialReturnService | Reuse the source issue's stored conversion and remaining entered quantity; never select today's master factor. |
| StockTransferService / TransferCustodyService | Keep original/destination scope, no effect on approval, origin deduction on dispatch and only actual accepted destination credit. Preserve original conversion across partial receipts and reversals. |
| StockCountService | Count and compare the explicitly pinned stock UOM; preserve snapshot/ABA/concurrency and independent adjustment approval. |
| MaterialPlanService / MaterialPlanIssueService | Preserve approved budget-source quantities and mapping; freeze approved base limits so a later pack-size change cannot increase permitted consumption. |
| MaterialRequestService / inventory reports | Preserve request fulfillment/signed evidence and commercial labels; display base and entered facts without relabeling historical mixed dimensions or automatically converting subcontract measured work. |

## Actual-target boundary

The last observed Mac is transfer-continuation/App `0c3182e1`; the subcontract launcher remains pending. This cloud stage neither runs nor replaces it. Later deployment must consume the actual predecessor receipt, preserve source Documents/uploads/external HR keys/history and prove the populated upgraded copy before source migration. No retained MKE/TCJ definitions, rates, role grants, stock normalization, Accounting/payroll/#245 or Production activation is authorized here.

## Candidate implementation and observed evidence

- `MaterialUomBasis`, `MaterialUomRevision` and `MaterialUomOperation` are the only new Prisma models. Three exact forward migrations add prepared facts, the single ungranted capability, deferred source/receipt binding, immutable SQL/version guards and declarative Company/unit-precision reference pins. Existing Material, UOM and inventory/commercial models/rows are unchanged. Supporting SQL indexes do not rewrite historical data.
- Definitions use canonical integer strings and exact BigInt arithmetic; SQL checks canonical reduced ratios without numeric-factor rounding. Selection orders explicit effective date then immutable revision number. Original unit codes/names and precision are pinned. Source/receipt inserts use the exact PostgreSQL transaction clock; a reproduced JS-millisecond mismatch was corrected without relaxing the guard. Serialization retries classify native SQLSTATE40001/40P01 as well as Prisma P2034.
- Local Node24.21.0 / pnpm12.6.0 / PostgreSQL17.11: **13/13** focused contract/authenticated-HTTP checks pass, including same-key concurrent retries, one-winner competing revisions, active Employee/current role/Company/session/CSRF boundaries, immutable SQL history/receipt binding, original-date previews, nonrepresentable/overflow denials and unchanged stock/reservation/PO/payment counts. Web typecheck passes.
- A genuine populated pre-UOM dump captured from the unchanged entry main was restored to a separate owned database, then upgraded. Every original SQL row, migration checksum and grant was compared exactly, admitting only the single exact new catalog row, three migration records and three empty definition tables. After creating versioned definitions, a second separate dump/restore started the restored application: authorized history and exact40-piece preview matched, foreign/technical/anonymous accesses were denied and the definition rows remained exact. This is bounded Stage A disposable evidence, not final milestone7 or Mac evidence.
- Registered real-browser coverage uses the built React UI, real login/CSRF/API and a unique disposable database: scoped unit choices, basis/revision, response-loss retry with the original request identity, future/original-date previews, stale-result clearing, three locales,390px and read-only/technical-admin denials. Local Chromium stops before launch because this workspace prohibits its Unix socket. Actual registered GitHub browser execution passed on push44322695815 and PR44322705513 at candidate `efc4405f28446789b723f7e6f8b1bf600345f933`. These browser passes do not replace the full CI gate.
- Existing historical schema, catalog, snapshot and restored-HR/receiving/FM03 contracts explicitly peel/verify the new exact definition group. Prior proof remains registered and strict; the new UOM predecessor/recovery and browser checks add coverage. Full exact-head push/PR CI, stable independent DEC-022 review, guarded integration/tree equality and exact-main remain outstanding at candidate publication. Stage B cannot begin before those exits.

- The first push CI failed at the exact-entry predecessor rollback smoke: its technical admin correctly had no Employee link, but the rehearsal omitted the existing project-maker reader credentials. The successor passes one ephemeral credential pair into the unchanged predecessor API fixture and restored-runtime verifier. It creates the authorized actor before backup and retains the technical-admin scope denial; no verifier, authorization or historical-data requirement is relaxed. Full successor CI remains required.
