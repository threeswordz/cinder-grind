# M4 SS02 — audited new material code request and authorized creation handoff

**24 November 2026; isolated branch** `work-m4-ss02-material-code-handoff-20261124`, based on Draft M4 PR [#427](https://github.com/threeswordz/cinder-grind/pull/427) exact `b9dda86654c346610a72affd3367c6070401df67`. Not Owner accepted or Production-ready.

## Implemented bounded capability

1. **Store Site** with active Employee/Company/Project membership, live session and existing `inventory.material_request.view` permission submits a reasoned new material-name/code/UOM **suggestion**. Duplicate existing active Company material name is rejected. No privileged `master.material.manage` grant is added.
2. **Khaimook / Project Manager** with persisted `inventory.stock.view` and assigned Project rights independently forwards or returns the submitted request, with an append-only reason/event. The Store maker cannot approve even if also PM.
3. A **Jai / Procurement Officer or Nancy / Finance Manager** identity with **existing persisted `master.material.manage` permission** can create the material using the original `POST /master-data/materials` route, then link that exact active, same-Company, same-name canonical Material to the approved SS02 request. This service requires an actual `MATERIAL CREATE` audit event by the same creator **after Khaimook's forwarding** before completion. The creator must be different from Store maker and PM reviewer. The SS02 service does **not** call Material creation or modify the existing master-data authorization.
4. All steps are persisted as audit-backed, versioned, stage-validated SS02 events. Transaction advisory lock and expected version/event prevent double decisions. Results are scoped by Company and assigned Project. Invalid chains, foreign Company or project, unknown user/grants, and stale sessions fail closed.
5. New REST endpoints at `/inventory/material-code-requests`, Store/Khaimook Inventory tab, and authorized creator handoff beneath the existing Materials screen. No new migration, automatic purchasing/receiving/stock availability, Finance postings or external notifications.

## Important distinction / remaining release blockers

This is a bounded handoff workflow, **not** a globally mandatory material creation approval rule: the pre-existing `master.material.manage` route still permits authorized general Company master-data creation outside SS02. Blocking that would change current maker privileges and requires an explicit Owner scoping decision; do not break historical master-data operations based on assumptions.

This branch has not been proven in an authenticated real browser or retained MKE/TCJ users. Final Jai/Nancy role grants and Company/Project memberships must be read back; no grants activated. Duplicate pending requests for a proposed material may still occur; only the canonical Company material code/name is authoritative. The proposed code/UOM are suggestions and not constraints on the master record. The request is not a PO, PR or stock item until the separately authorized canonical create occurs.

SS11 tool loan and true SS14/PM15 per-day material/delivery notifications remain open. Independent DEC-022 source review, #384 authorization for release CI and formal M4 acceptance remain unchanged.

## Focused-only test scope

- Pure contract tests for state transitions, immutability, actors, Company/Project, audit history forks/gaps, and malformed fields.
- Mocked live DB access tests for Store → PM → creator positive case, stale review, maker/checker bypass, revoked Employee/session, cross-Project denial, canonical material creation evidence, and no material/stock write.
- Workspace TypeScript and Prisma validation. No historical full CI reruns and no Codex.
- **Do not claim PASS before an actual exact-source GitHub Actions receipt is obtained.**

**Official position until accepted:** prototype 4/8, GL 3/10, technical M4 20/32, 0/8 M4 packages formally accepted, 0/1900h formally retired. Latest provisional remaining effort forecast 1847h including 117h toward 5/8 (not yet re-estimated for this work).
