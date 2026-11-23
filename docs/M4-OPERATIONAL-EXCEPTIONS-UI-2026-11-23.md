# M4 — operational exception screens (PM09, Nancy count schedule, SS13)

**Draft-only continuation on [M4 integrated source #406](https://github.com/threeswordz/cinder-grind/pull/406), not on main.** Approval to develop the authorized operational workflows does not authorize Production, granting retained roles, merging a protected release, or rerunning the 50-step full CI suite.

## Routing and actor safeguards

The existing Inventory workspace adds an **Operational Exceptions** tab only to current users with the corresponding already-existing effective view permissions and business role codes; it passes authenticated `roleCodes` and `userId` from `AdminConsole`. Three subordinate tabs appear only where that role/permission qualifies. The UI performs no separate access checks in place of the API; every backend route still performs current live session, Employee, Company/Project scope and role checks, plus CSRF for writes.

The UI uses existing document upload/link/download APIs and the actual scoped Material Issue, Project and Site Warehouse query sources. Client caches are per authenticated identity/Company and are invalidated after mutations; unauthorized or stale Project selection disables source requests. Review decisions use **fresh server-returned immutable event IDs and fingerprints** rather than fabricated versions.

## PM09 urgent ISSUE document follow-up

* Select an existing **posted and not reversed** Material Issue in an authorized Project. Original Storekeeper maker registers the incomplete-document reason; record deadline is exactly **48 elapsed hours after canonical issue posting**, not from form submission.
* Upload an actual source-linked `MATERIAL_ISSUE` document through canonical Documents routes, select 1–100 active linked files, and submit with completion note. Khaimook checks the source/fingerprint and records CLOSE or RETURN using `expectedSubmissionEventId` and `expectedFingerprint`.
* The UI reports true overdue/late status and never claims that late uploads are compliant. Reviewer-uploaded evidence and maker self-review are rejected by the API. No new issue posting, bypass, or Finance effect.

## Nancy per-site material-category physical-count calendar

* Authorized users choose active Project/Site Warehouse and explicit as-of calendar date; the server displays existing category frequencies, first due dates, paused status and calculated next due dates.
* **Nancy/FINANCE_MANAGER only** configures/revises an exact material-master category (or explicit unclassified category), explicit first due date, repeat interval (1–3650 calendar days), ACTIVE/PAUSED, and reason. The UI supplies the **current** `expectedPreviousEventId` and visibly refreshes after a write; a stale revision must fail closed.
* No auto-generated global/default frequency, automatic physical count, Khaimook stock-count adjustment or financial write-off is implied. Entering an unknown category fails at the backend; manual exact category entry is a current usability limitation until a read-only category master picker is approved.

## SS13 Store loss/damage/waste

* Store chooses authorized Project/site, valid Material/UOM from existing physical Stock Count choices, positive physical quantity, LOSS/DAMAGE/WASTE, actual date/location/cause/finder, proposed REPAIR/RETURN/DISPOSAL and at least one **real linked Project Document**. Project Documents may be uploaded through existing Documents before filing.
* The API returns a **case UUID**; its owner shares that protected reference with the intended reviewer. The current API intentionally exposes **no cross-Project case search/list**. The UI permits reading only after explicit Project selection and case ID, then cross-checks the returned Project.
* Khaimook decides RETURN or NONDISPOSAL_REVIEW or FORWARD_DISPOSAL, with an explicit optional Ben severity acknowledgment. Ben approves *acknowledgment*, not spending. Nancy FINANCE_MANAGER approves or rejects a DISPOSAL **proposal**, not an executed stock transaction.
* Even the final `NANCY_APPROVED_PENDING_EXECUTION` case posts **zero** inventory movement and **zero** financial write-off. The actual disposal execution and accounting remain separately governed. The UI does not invent a seriousness threshold, price, VAT/freight budget basis, alternate approver or emergency spend cap.

## Exact acceptance boundary

The source screens are not proof of native PostgreSQL races, retained roles/grants, actual secured document byte readback, real browser journeys, human acceptance, or M4 5/8. Validate with **one focused web TypeScript/build check** and independent stable-head Codex review; then targeted native PostgreSQL+browser positive/negative cases in a disposable **non-Production** runtime. Reuse prior confirmed FM02/FM03/Receiving/Transfer/BOQ/UOM/Mac receipts, and never rerun source feature suites or full CI for routine development. A full release gate requires specific Owner authorization per #384; no Production deployment.

The cross-module financial BEN02/BEN03 work remains deferred by [Owner #288](https://github.com/threeswordz/cinder-grind/issues/288). DEC-047 captured per-incident cap policy but is **not** an emergency financial exception implementation or a grant to override the authorized launch scope.

### UI-probe matrix (NOT RUN)

| Persona | Positive journey | Critical negative |
|---|---|---|
| Store Site | PM09 issue upload/register/submit; SS13 case with real Project evidence | Cannot review own issue/case, read another Company/Project, or post financial disposal |
| Khaimook | PM09 close/return using current fingerprint; schedule view; SS13 severity and optional Ben escalation | Cannot accept stale/revoked documents or approve own case |
| Ben | SS13 escalated severity acknowledgment | Cannot act as Nancy or create an emergency over-budget exception |
| Nancy | Site/category schedule create/edit with optimistic event; SS13 independent disposal-proposal decision | Cannot perform Stock Count physical adjustment without canonical role or cause a Finance write-off |
| Foreman and technical SYS_ADMIN | No newly introduced exception edit/approval surface | No override for maker/checker/Project scope or protected evidence |
