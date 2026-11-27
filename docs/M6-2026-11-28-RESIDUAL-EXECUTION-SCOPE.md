# M6 residual execution scope — Event266, 28 Nov 2026 SGT

Status: proposed implementation boundary; NOT execution authority, NOT formal M6 acceptance.
Application: 70013b5139292ef33563447f8937c8f132feabd2.
Read-only admission operator: 840477f8c18665953ed3285635adc81f5091fadb.
Owner supplied native PASS: 129 historical session rows (112 correction baseline +17 subsequent authorized sessions), 28 prior batch sessions preserved; inventory and site receipts bound; retained database/files/recovery unchanged; rate bucket ready; zero sessions and business mutations.

## Exact observed configuration gaps
- Ben: MANAGEMENT absent; schedule.programme.view and schedule.work_plan.confirm absent.
- Khaimook: schedule.programme.view and schedule.work_plan.prepare absent.
- Foreman: schedule.programme.view and schedule.progress.record absent.
- Jai: PROCUREMENT_OFFICER absent; no missing effective permissions in the discovery's checked set.
- Store Site: no missing permissions in the discovery's checked set.
- SS08: existing signed receipt and BOQ allocation present; work dimensions, three-level WBS and activity type absent.
- FM02: zero plans, confirmed plans, eligible activity/BOQ pairs.
- Supplier: zero events on the exact bound approved PO.

## Proposed synthetic-only permission delta
Create exclusively assigned canonical MANAGEMENT role for Ben with schedule.work_plan.confirm and schedule.programme.view; exclusively assigned PROCUREMENT_OFFICER role for Jai carrying procurement.po.view (already effective; canonical role check requires role code). Add the two listed schedule permissions to each existing exclusive Khaimook/Foreman synthetic role. Total proposed 2 roles, 2 user-role edges, 7 permission edges (2+1+2+2). No broad grants, no real role/grant changes, no modification of historical source. Must verify exact catalog, ownership, company membership, active roles and actual needed supplier contract before authorization. If additional permissions or changes required, stop before mutation and disclose exact delta; no implicit authorization. No direct writes to approved historical BOQ, stock, workflow or audit records to manufacture success.

## Native execution preparation
1. Bind Event266 custody to exact isolated successor DB m6_successor_rehearsal and pinned app; verify no live sessions and current baseline under transaction. Do not replay completed inventory/HR/subcontract journeys. Reuse verified signed receipt/BOQ lineage as historical evidence. Preserve original DB proto_a_01, recovery copy, files, all existing audit rows and all 129 sessions by exact hash.
2. Prepare bounded synthetic WBS hierarchy Building/Floor/Work area, work type, quantity activity and independent milestone activity. Identify latest approved cost BOQ and quantity/UOM constraints; if no eligible line, create successor synthetic BOQ revision using existing canonical preparation/independent approval flow; never edit historical approved line. Resolve calendar/cost-code prerequisites and exact expected added rows before requesting authorization.
3. SS08: new representative dimension-bearing issue/request link and signed evidence as needed, canonical issue posting and readback, material plan version and approved BOQ lineage, signed issuer/recipient document scope/bytes and exact stock effects. Reuse existing receipt bytes only as historical evidence, never misrepresent old signature as new issue. Reuse m6-ss08-terminal-readback.mjs. Do not activate unrelated UOM or alter prior custody.
4. FM02: Khaimook prepares plan, Ben independently confirms, Foreman records quantity progress (half planned BOQ quantity) and reasoned milestone (25%). Synthetic weights 60/40 yield 40.00%; source-plan/version/BOQ/UOM binding and denial of stale/cross-project access. No actual business work-plan policy implied. Reuse m6-fm02-terminal-readback.mjs. API project-progress-plans/prepare, /:id/confirm, /activity/:activityId/quantity, /current; manual progress via existing scheduling-progress controller.
5. Supplier: Jai canonical role, exact approved PO, versioned acknowledgement/transit/delay/discrepancy/PM review/claim and return/replacement paths as applicable under PUR08/PUR14. Bind existing condition/evidence and actual checked return or replacement provenance; no invented policy or stock/financial posting via advisory events. Determine exact bounded lifecycle fixture and evidence deltas before authorization; do not bypass server gates. Verify unauthorized role/project denial and historical PO/GR/stock/finance preservation.
6. Combine canonical API actions and relevant browser readback into bounded session batch, prefer one login per distinct actor; Ben/Khaimook/Foreman/Jai/Store Site plus independently necessary BOQ approver only if required and explicitly included. Exact actor count and row/document/audit deltas must be set by implemented operator, with fail-closed pre-mutation checks, exclusive attempt receipt, no automatic replay, revocation verification. No full CI, Codex or Production without respective authority.
7. Reconcile terminal evidence and M6-01/04/05 technical acceptance under applicable independent review gates. No formal acceptance from readiness PASS.

Source contracts inspected: apps/api/src/scheduling/project-progress-plan.controller.ts and .service.ts; scheduling.controller.ts; wbs/wbs.controller.ts; inventory/material-request.controller.ts; procurement/supplier-delivery-case.controller.ts and .service.ts. Native mutation operator, exact fixtures, test evidence and final authority still pending. No new business policy; proposed synthetic configuration only.
