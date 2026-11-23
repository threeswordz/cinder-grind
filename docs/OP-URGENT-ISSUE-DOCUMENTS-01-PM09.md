# PM09 / SS-PLAN-01 — urgent material ISSUE documents, 48 elapsed hours

**Source:** DEC-047 / `docs/ROLE-REQUIREMENTS-2026-10-30/15-owner-decisions-2026-11-16.md`, 16 November 2026. Existing 112 requirement IDs are unchanged.

## Boundary
This feature tracks missing/late supporting documents for a **previously authorized and actually posted Material Issue**. It never authorizes an early issue, extra quantity, budget increase, over-plan material use, receipt-before-PO, stock ledger mutation, Finance or payment posting. The separately approved urgent RECEIPT pre-PO link is not this route.

The canonical start is `material_issues.posted_at`, not `issue_date`, a form timestamp, a local midnight, a working-calendar day or an operator's claim. The deadline is exactly `posted_at + 172800000 milliseconds` (48 elapsed hours, holidays/weekends included). Overdue evidence is retained as late, not silently waived. No automatic reminder or approval.

## Existing actors, roles and authority
- **Original Store Site preparer**, actively authenticated with current `STOREKEEPER`, `inventory.issue.create/view`, `documents.document.view` and assigned Project access, opens a reasoned tracking item after posting and submits a bounded set of canonical, already-uploaded project- and Material-Issue-linked documents. All bytes must be uploaded through the existing `documents/projects/:projectId/targets/MATERIAL_ISSUE/:issueId` route. The preparer explicitly states the evidence is complete; software cannot infer every required document type for an arbitrary incident.
- **Khaimook** acting as actively authorized `PROJECT_MANAGER` with current `inventory.issue.approve/view`, `documents.document.view` and Project scope independently checks the complete immutable source snapshot and CLOSEs or RETURNs it with a reason. The same preparer cannot review. A reviewer who uploaded the submitted evidence cannot approve their own evidence.
- The API uses existing least-privilege permissions only. This does not grant or activate business roles, make SYS_ADMIN a substitute reviewer, or modify existing stock approvals.

## API surface (isolated development candidate only)
- `GET /inventory/urgent-issue-documents/:id`: scoped read; shows source-post deadline, state, receipt history, stale evidence and overdue status
- `POST .../:id/register` with `{reason}`: original maker only, one register event bound to source posting
- `POST .../:id/submit` with `{documentIds, completionNote}`: exact canonical project + Material Issue document links, active files and stored SHA256, explicit event source digest
- `POST .../:id/decision` with `{decision:"CLOSE"|"RETURN",expectedSubmissionEventId,expectedFingerprint,note}`: independent PM and exact-current evidence checks; no stock/Finance effect

The record is an append-only `audit_logs` chain using `previousEventId`. Missing parents, branching, duplicate IDs, stale source digests, revoked actor authority or Project-wide grants, stale submission event IDs, missing/archived documents, Project mismatch and replay fail closed. If any selected linked document becomes inaccessible (including revocation of another owning-source permission), the GET endpoint denies the entire packet read rather than exposing its document IDs, count or source fingerprint as a stale status. Event ordering uses causal links, not random UUID/timestamp ties. The 48-hour outcome is checked against document upload timestamps **and** evidence submission time; a late packet can still be reviewed with a permanent `onTime:false` result.

## Evidence and acceptance limitations
The source uses existing `material_issues`, `documents`, `document_links`, `audit_logs`, stock posting and access services. No new schema, permission, grant, migration, upload service or ledger. It validates stored SHA256 identifiers and exact source links; **this source-only check is not cryptographic re-read of stored file bytes**. The final verification still needs original file bytes/checksum readback through the protected Documents routes, native PostgreSQL concurrent request/invalid-source tests, browser role/CSRF/Project negatives, exact stable-head independent DEC-022 review and Owner-authorized release gate. No UAT, retained configuration, Production or Milestone M4 exit is inferred.

**BEN02 is separate:** emergency spending has an individual incident-specific Ben limit before expenditure, followed by Ben work review and Nancy finance review. It is not implemented or authorized by PM09 and cannot be silently substituted with a generic numerical cap.

**Current M4 position:** 4/8, GL 3/10; do not mark this branch Ready or merge into main without separate reviewed integration/release authorization. Keep completed receiving/transfer/FM03/BOQ/UOM/Mac evidence closed and never replay old operators.
