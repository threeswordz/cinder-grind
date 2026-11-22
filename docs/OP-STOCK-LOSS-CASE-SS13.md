# SS13 / PM08 / NANCY-07 — source-linked loss, damage and waste cases

**Source of authority:** Owner DEC-047 (16 Nov 2026) and stable 112-role requirements SS13, PM08, NANCY-07. This is a **nonposting operational case-review candidate**. The already accepted Stock Count physical quantity route and Accounting #288 deferral remain authoritative.

## Purpose and business actors
A Store Site keeper records damaged, lost or wasted goods, including canonical Company/Project, active site Warehouse, Material, UOM, positive four-decimal physical quantity, LOSS/DAMAGE/WASTE type, calendar date, location, cause, finder name, current authenticated reporter, proposed REPAIR/RETURN/DISPOSAL, and one or more real active Project Documents (checksum/source-authorized, not a typed filename).

Khaimook (PROJECT_MANAGER) independently screens the report for property severity and documents a decision: RETURN for correction, NONDISPOSAL_REVIEW for repair/return proposals, or FORWARD_DISPOSAL for disposal proposals. Khaimook explicitly selects `escalateToBen` true/false and provides reason. There is **no invented severity threshold or automatic escalation**.

Where flagged, Ben (MANAGEMENT) records an independent property-severity acknowledgment before the proposal can continue; this acknowledgment is **not** a purchasing limit or Finance approval.

For a proposed DISPOSAL that Khaimook forwarded and Ben acknowledged if necessary, Nancy (FINANCE_MANAGER) independently records `APPROVE_PROPOSAL` or `REJECT_PROPOSAL` with reason. The only 'approved' state is **NANCY_APPROVED_PENDING_EXECUTION**. It is not an executed inventory disposal, stock quantity adjustment, financial write-off, tax posting or cash flow. Monetary valuation, accounting posting, legal waste disposal and responsible actual physical disposal remain separately controlled.

## Security and history
The backend uses existing `AuditLog` as an immutable causal case journal and existing active site/Project/Company, Material, Unit of Measure, active UserSession/Employee, role and `inventory.stock.view` + `documents.document.view` permissions. It never grants those business permissions, allows SYS_ADMIN to bypass roles, creates an Inventory transaction, edits canonical StockCount, recognizes expenses, alters BOQ, or modifies Financial balances.

Documents are uploaded through existing canonical Project Document routes. The case pins a content identity digest of actual Project Document IDs, checksums, size and all link IDs; each source must remain visible under its own protected source permission. Missing/archived/foreign Project/changed source must block reads and subsequent decisions before IDs or remarks can leak. This source-only checksum check does not yet prove protected byte readback on every access.

Case event actions `OPEN`, `SCREEN`, `BEN_REVIEW`, `NANCY_DECIDE` are append-only. Each decision requires `expectedPreviousEventId`; the service uses PostgreSQL Serializable and per-case advisory lock, and replay checks explicit causal predecessor and version, actor separation, impossible stage transition, duplicate/fork/orphan and random UUID/same-clock ordering. Correction of returned cases is done by a new documented case, preserving the original; editing an existing approved case is not an allowed endpoint.

## Isolated draft API
- `POST /inventory/stock-loss-cases`: original scoped Store reporter; returns a new case ID
- `GET /inventory/stock-loss-cases/:id`: current scoped active business actor, fail closed on documents
- `POST /inventory/stock-loss-cases/:id/pm-screen`: Khaimook, explicit expected event ID, decision, escalate flag and note
- `POST /inventory/stock-loss-cases/:id/ben-review`: Ben, only if escalated
- `POST /inventory/stock-loss-cases/:id/nancy-decision`: Nancy, only after required prior stages

All mutation routes require CSRF and current role as well as standard stock/document view permissions. No listing/search, case file upload, source byte-reinspection, actual stock posting, automatic money, scheduled reminders, Human UAT or Production readiness is claimed in this development package.

## Acceptance gates remaining
Independent exact-head Codex P1/P2 review; focused TypeScript and state-machine tests; native PostgreSQL scope/multiple-company/revoked roles/concurrency and negative document source tests; browser Store→Khaimook→Ben-if-flagged→Nancy; retained role grants/configuration. Integrated M4 release validation is specifically Owner-gated and should not be repeated during development. Physical write-off/Finance ledger remains separately scoped and requires distinct explicit Owner and #288 approval.
