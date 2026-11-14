# Bounded Material Journey HTTP transport — #338 increment

**Authority:** [#338](https://github.com/threeswordz/cinder-grind/issues/338), existing synthetic authority under [#305](https://github.com/threeswordz/cinder-grind/issues/305), DEC-043/044. This increment implements the missing request boundary and read-only deployment planning around existing APIs. It does not rebuild a business scenario or provide a configuration/write-journey operator.

## Read-only Mac plan continuation

`deploy/uat/prototype-material-operator.mjs` accepts **only `--plan`**. It requires a non-root Mac and pinned Node; canonical private target paths; runtime, actor and completed 126-check browser receipts with their private bindings; clean original application checkout and origin; exact green live-main operator/module bytes; local rootless Podman connection, owned database/container/mount and loopback API/web processes; original web index hash; healthy API; and migration checksums. Original browser business fingerprint, actor grants, category grants, membership and dimensions must still match. The existing startup/actor/browser operators and their allowlists are unchanged. Prior material follow-up markers stop the plan. There is no browser launch/login, startup/provisioning replay, new private receipt, grant, configuration or business mutation.

This read-only wrapper **does not authorize a write journey**. The original startup receipt contains the web index hash but no API build hash; it reports `runtimeArtifactComparisonRequired: true` and `targetCustodyVerified: false`. Verification of the running compiled artifacts is still required before configuration/writes. Configuration and stock are separate read-only repeatable snapshots, not an atomic future-write readiness guarantee; a guarded follow-up must repeat all checks and exact before-state comparisons inside its locked transaction. No Mac command is handed off before CI, independent review, governed merge and exact-main gates.

`prototype-material-preconditions.mjs` checks the original independently approved 20-unit stock count, exact dimensions/maker/checker/posting key, single canonical count movement and absence of reservations, new issues/returns/transfers/counts. A net balance of 20 does not excuse offsetting movements or drafts. It uses exact four-decimal integer arithmetic, never floating-point stock calculations. Unexpected state stops; nothing is repaired or reset.

If the existing private `material-source-mapping-private.json` is present, it must explicitly contain only `budgetRevisionId`, `budgetRevisionLineId`, `materialId`, `uomId` and `quantity: "10.0000"`. The source must belong to the synthetic Company/Project, have Ben as maker/submitter and Khaimook as its independent recorded approver, and have the selected same-UOM 10-unit line with no extra WBS/Cost Code dimensions. The file is not created by this operator and is not an approval. With no selection, it reports source preparation or explicit mapping required; it never picks a line from counts, matching UOM, rates or amounts. Document-type selection, source preparation and minimal configuration are still outstanding.

The new precondition and operator tests exercise stock-history drift, compensating movements, reservations/drafts, explicit source/provenance denials, receipt mismatch, provenance allowlists and refusal of write modes/non-Mac targets. Native CI also inspects an explicitly disposable seeded count result with the same read-only core, proves unchanged business/grant fingerprints and enforced ledger immutability, then adds a persisted reservation and proves precondition refusal. The seed's count and effect are inserted atomically with full state facts; history is never updated/deleted or triggers disabled. Fixtures remain until the uniquely owned database is dropped in final cleanup. Seeded status is **test setup, not proof of approval execution**; source-provenance positive/negative checks are helper-level fixtures, not native source-workflow or Mac proof. The native check never replays the 123/126 initial scenarios.

## Implemented boundary

`deploy/uat/prototype-material-http.mjs` reuses the existing `httpClient` login/CSRF/JSON observation helper. Every request passes a literal method/path check before transport. Origins are the exact owned Mac loopback pair, or the existing fixed Linux GitHub Actions native pair; there is no general target URL override. The binding is copied at construction so later caller edits cannot retarget it.

The allowed surface is limited to the approved Material Plan/create/submit/decision, canonical Issue/create/read/reverse, plan-policy enable/preview/post/overage/review/decision, Request/create/read/link/receipt, scoped stock/report reads, source-linked signed Document upload/download and authentication. Generic Finance/HR/admin, stock-count provisioning, old business IDs, arbitrary origins, encoded/dot traversal, unrelated queries, PATCH/DELETE and redirects are refused.

Creation responses supply **pending read-only IDs**, including Material Request's small `id/version/revisionId` action receipt. A successful parent readback must match the bound Company, Project and warehouse before subsequent mutations are permitted. Issue/plan/request child identifiers are learned from matching scoped parent readbacks, authorizations from the owned issue's overage response, and Document identifiers from that run's source-linked multipart upload. No public registration method accepts arbitrary historical IDs. Source mappings/material/UOM/warehouse and recipient/issuer identities are bounded; numerical/state/approval rules remain with the canonical API.

The helper permits an in-scope wrong-role or missing-CSRF request so the actual API can prove a denial. A boundary refusal occurs before network traffic and is **not** an API denial or evidence of maker-checker policy. Missing-permission denial is not an eligible-maker self-approval test.

File upload uses real multipart FormData with a fixed synthetic PDF filename/type and bound Document type; download returns actual bytes for the operator's checksum assertion. Upload does not acknowledge a receipt, and the helper cannot certify a human signature/UAT. Transport exceptions expose constant safe codes. Observations contain probe code, HTTP status, expected status, time and the existing helper's request ID where available; no bodies, cookies, tokens or file bytes are printed.

## Technical evidence and its limits

The companion `prototype-material-configuration.mjs` supplies the **read-only configuration inspection core** used by the plan wrapper above. It reuses the original populated identity check, verifies the exact initial eight-actor/Company/Project/grant/category matrix and material/UOM/site warehouse, then reads capabilities, active workflow step/role cardinality, approved-source counts, Document types and the canonical Issue sequence inside a PostgreSQL `READ ONLY` repeatable snapshot. Its result contains missing capability candidates and resource counts, not private IDs/credentials, applied configuration, selected BOQ quantities or authority to write. Existing plan/policy follow-up state, drift, missing capability catalogue and incompatible Issue numbering stop for reconciliation. Conditional BOQ preparation capabilities appear only when no approved source exists; existing source counts still require an explicit approved mapping/provenance check, never UOM/price inference. Full compiled-artifact custody and private create-once configuration/journey markers remain required before writes.

- `deploy/release-candidate/prototype-material-http.test.mjs` exercises target/caller-mutation/path/method/old-ID/source binding, pending-to-scoped promotion, malformed scope responses, child identifiers, multipart/byte paths, missing-CSRF forwarding and safe errors. Its injected transport is **helper-level evidence only**, not a second business test suite or actual API/browser proof. Existing CI picks it up through the release-candidate test glob.
- `deploy/uat/prototype-material-http-native.mjs` is a **Linux GitHub Actions-only** actual API compatibility check. Before resources, it requires pinned Node 24.21.0 and the exact existing CI base DB identity. It creates a unique `material_http_ci_<uuid>` database, migrates/bootstrap-seeds it, and reuses the existing disposable material-plan fixture. Only that owned database and temporary files are dropped. It cannot run on the Mac prototype or a supplied persistent target.
- The native check uses existing fixture sessions with actual cookies/CSRF. It checks real Plan action/readback shapes, independent plan decision, draft Issue and Request readbacks, protected multipart upload/byte download and wrong-role/Project denials through the new helper. It does **not** claim new login proof, within/overage posting, full signed acknowledgment, stock reversal, real browser or populated recovery. Existing suites retain those business assertions; full #338 still needs its own deployed operator/native full-core evidence.
- Before the compatibility fixture, that same unique disposable DB uses the existing synthetic actor provisioner only as CI setup for the read-only core. It verifies unchanged records/grants with the existing fingerprint and proves PostgreSQL refuses a mutation under `READ ONLY`. It does not rerun initial123 HTTP/126 browser scenarios or provision anything on the Mac. The original14 HTTP compatibility checks remain separate bounded evidence.
- Local helper checks use the workspace Node version; exact pinned-node native/full CI results must be read from GitHub. No existing automated gate is removed or relaxed.

## Remaining work before any Mac handoff

1. Complete compiled-artifact custody and validate the read-only plan wrapper on the actual populated target after its review/integration gates. Never rerun startup, actors or completed initial browser verification. Native Linux/helper checks do not attest Mac execution.
2. Compare actual grants/workflows/approved Cost BOQ source/Document type/number sequence; reuse sufficient existing resources and apply only a guarded, audited, necessary synthetic configuration delta with exact before-state and private no-overwrite markers. No direct SQL approvals or broad role union.
3. Implement one representative authenticated API/UI write journey using this transport and the existing browser protocol with a separately narrow write boundary. Preserve initial receipts and unrelated records; revoke sessions and preserve partial evidence on failure. The completed read-only browser transport is unchanged.
4. Exercise the same operator core in the unique disposable native target; finish exact-head push/PR CI, independent stable-head DEC-022 review, guarded merge and exact-main CI before an immutable Mac command. No review is requested while the operator is still changing; no self-approval or quota waiver.
5. Reconcile [all 112 IDs](ROLE-REQUIREMENTS-2026-10-30/14-preproduction-reconciliation.md) and required residual delivery/dispositions, observe actual protected files/populated recovery, then audit/freeze and comprehensive human UAT.

The old operator `toolingOnly()` allowlists remain unchanged. This new module/report/native helper, #340's instrumentation and #339's test-only API-source delta must be reconciled by the new operator's provenance check rather than widening or rerunning an old operator.

**No milestone closure:** prototype remains 4/8, full Production GL 3/10. Retained MKE/TCJ changes, new Accounting/payroll/#245, Production deployment and human acceptance remain outside this increment.

## 14 November continuation — execute the missing boundary

Owner direction: stop repeating completed tests/checks and finish the eight
prototype milestones. Existing startup, actor provisioning and initial browser
receipts remain immutable. This continuation implements the missing deployed
API execution path; it does not add another business feature or certify the
whole workflow milestone.

- `prototype-material-artifacts.mjs` compares **every API and web emitted filename
  and byte** with fresh output from the unchanged pinned checkout. Both compilers
  write only to an invocation-owned temporary directory; no in-place rebuild,
  restart, migration or database access. Unexpected files, symlinks, writable or
  multiply linked files, source/output drift and loaded production dotenv files
  block. Exact compiler versions are required. This is file-byte evidence, not
  process-memory or renewed dependency-installation attestation.
- `prototype-material-configure.mjs` reuses the existing identity/grant/stock
  state rules **inside its serializable write transaction**, compares an exact
  before-state digest, adds missing synthetic capabilities only, reuses a unique
  compatible workflow/sequence or creates a missing one, and records a create-once
  audit marker. Conflicting workflows/sequences, ambiguous or private Document
  types, prior configuration and unexpected existing source drafts block. No
  business approval, policy enablement, source, issue or stock is created here.
- `prototype-material-source.mjs` creates a missing explicit ten-unit synthetic
  Cost BOQ using only bounded existing authenticated HTTP routes: Ben creates and
  submits; Khaimook approves. Existing approved source requires the private exact
  mapping/provenance; an existing unmapped BOQ is never rebuilt or guessed.
- `prototype-material-journey.mjs` / `prototype-material-run.mjs` compose the same
  existing APIs for Store plan → independent Khaimook approval → three-unit direct
  issue → protected receipt bytes/acknowledgment → four-unit overage with Khaimook
  review then Ben approval → both canonical reversals. Expected source-ledger
  arithmetic is 20→17→13→20 with retained signed history and no Finance changes.
  Actual authenticated API sessions are revoked on success/failure; partial
  observations remain private. No initial 123-HTTP/126-browser suite is replayed.
- The Mac coordinator has a reviewed-main-gated `--execute` branch. The initial
  receipts, original count and private credentials are read, never reprovisioned.
  It re-establishes custody in the executing invocation, creates no-overwrite
  private start/configuration/journey/session receipts and refuses any rerun
  after a partial start. A previous plan is never execution authority. Failed
  writes are reported as potentially applied, never falsely unchanged.

`--execute` is **not ready for Owner handoff** until this exact implementation's
native CI, independent DEC-022 review, governed integration and exact-main CI
finish. Current local verification covers changed helper rules only. The new
unique-DB native coordinator and pinned-source fresh-output native harness are
registered in the existing CI step; results must be inspected before claiming
native execution success. Previous-head green CI does not certify this change.

Actual React/MUI write interaction remains separate: this implementation must
report `actualUiJourneyVerified: false`. Actual Mac execution, other required
workflow mappings, ordinary/HR file-byte proof, populated separate recovery,
112-ID gap delivery/disposition and final audit/freeze remain open. No milestone
is closed by writing this code. Human UAT remains deferred to the frozen
prototype; Production and retained MKE/TCJ activation remain unauthorized.
