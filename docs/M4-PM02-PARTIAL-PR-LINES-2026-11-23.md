# PM02 — partial Procurement Purchase Request line review (draft source candidate)

## Confirmed purpose and identity
This implements the bounded Khaimook requirement PM02: approve correct Procurement Purchase Request lines (A) and return incorrect ones (B) without blocking A. It does **not** change the separate Inventory Material Request, does not authorize Accounting/BEN02/BEN03 or multi-Project PO #245, and is not yet business/UAT/release acceptance.

Private base: integrated reviewed M4 UI #407 at `62d2ce23810938784caa66aab6e427e49030d7fe`. This draft has no Production, retained grant, main merge, Mac operator or full CI authority.

## Source behavior staged (NOT TESTED)
- POST /api/v1/procurement/purchase-requests/:requestId/decide-lines requires live auth, CSRF, existing procurement.pr.approve capability, PROJECT_MANAGER, original-maker denial, configured ApprovalService step and Project scope.
- Requires one configured single-reviewer workflow step, the exact approval-instance UUID and an exhaustive set of submitted line UUIDs with APPROVED or RETURNED; every RETURNED line has a reason. Multi-step workflows fail closed rather than inventing reviewer consensus. Generic prior whole-PR approve/reject remains intact.
- ApprovalService and all line dispositions are in one Serializable transaction. All decisions and reasons persist and are independently audited. Returned lines are excluded from approved demand, RFQ creation, supplier award and Purchase Order available awards/create/approve/revise. Legacy NULL reviewDecision with an APPROVED parent remains fully eligible without rewriting historical rows.
- Original PR maker only uses copy-returned to make a new Draft containing only returned lines (stable source-line UUID pointer, corrected quantity/description etc. editable through existing Draft routes), retains immutable prior approval/return. Unique source correction prevents double reissue; a returned-again correction can be copied in its own next cycle. **Cancellation of a linked correction draft and deletion of its source-linked lines are denied** until a governed replacement mechanism exists, avoiding permanently stranded returned demand.
- No new permission code or automatic retained role grant. Existing approved PRs, RFQs, POs and historical stock/Finance state are unchanged. SQL migration only adds nullable columns, a SQL-three-valued-logic-safe consistency CHECK (`IS TRUE`) and unique correction lineage.

## Mandatory focused acceptance before this may be considered complete
1. Disposable native PG17.11 migration and API TS build; exact 2-line A/B, PM not maker, configured step. A RFQ/award/PO succeeds, B rejected by approvedDemand, RFQ create, supplier award and PO create/approve/revise; parent approval remains immutable.
2. A past fully approved parent with NULL line decisions still sources all old lines. Existing rejected-PR copy behavior and whole approval remain unchanged.
3. Original Store maker's correction draft contains only B, independently editable/re-submittable; another Store/PM maker cannot copy the source. Duplicate copy, stale instance, missing/duplicate/foreign line UUID, wrong Project/Company, maker/submitter self decision, wrong role/step, stale action, and concurrent review all fail without partial writes.
4. Ensure no stock transaction, inventory reservation, DirectCostPosting or AP/Finance effect. Verify audit and approvalAction history, source parent/correction pointer.
5. Actual React/MUI Store and Khaimook partial disposition/correction UI, real browser and retained assigned grants still needed for full PM02 acceptance. This API-only draft must not be called complete.
6. Independent exact-head Codex P1/P2 review, **focused tests only during development**, no previous successful suite reruns. Full release CI only after fresh Owner authorization under #384. No self-approval or Production.

## Scope limits
The bounded API initially rejects multi-step or multi-reviewer workflows rather than silently splitting approved demand across steps. Business authority for such a workflow would need a separately confirmed contract. Supply no fabricated threshold, bypass, emergency spend or new Accounting behavior.
