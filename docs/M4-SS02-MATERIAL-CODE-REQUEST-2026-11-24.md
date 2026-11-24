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

## Verified source and real-database evidence, 24 Nov 2026

- Exact source-focused [Actions #45229748671](https://github.com/threeswordz/cinder-grind/actions/runs/45229748671) **COMPLETED SUCCESS**: `11/11` new audit/role contract and mock-service tests, Prisma generation+validation, full workspace TypeScript, API build. Runner SHA `3039b90fe7dd280fd5ec9140f67f92fef56ab141` differs from initial source `375501aca492cf747ae745e6fb93a56044f1edc4` **only by a one-off workflow YAML**.
- New actual PostgreSQL 17.11 [Actions #45230927000](https://github.com/threeswordz/cinder-grind/actions/runs/45230927000) **COMPLETED SUCCESS 1/1 native integration test, zero failures** on disposable ordered-migrations DB. Actual session/Employee/RolePermission/ProjectMember records, Store submit, PM independent approval, authorized Jai material master creation with canonical CREATE audit, replay and creator session revocation/reauthentication, foreign Project/Company denials. No SYS_ADMIN bypass, retained grants, extra stock transactions or unauthorised master insertion. Native-tested head `c9b6acb66b4eda440c93ea2d6935e6ba5dadac7e`; compared to native source `30cbd2185589147ee20f704e06768611ddc9afd6` **only the one-off workflow YAML differs**.
- Native test was joined to PR #427 with **non-force two-parent Draft merge** `8f6587a7f5cd74f7e9ae720455ab1a03fc876700`. Combined application/test source has no untested changes beyond documentation updates.
- M4 acceptance remains **NO** for SS02 until authenticated React/MUI and retained MKE/TCJ role/Company/Project proof plus a business determination whether generic authorized master creation must always require an SS02 case. This test does not resolve that Owner scope or change existing master-data grants.
