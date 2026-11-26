# M4 current-source bounded evidence addendum — 25 November 2026

Source candidate: `da65349825426f9501f2e4b52440f6d326f20b68`. Historical effective gate projection and approved six boundaries are unchanged. This addendum maps all 12 SOURCE_EVIDENCE_PENDING IDs to observed runtime witnesses or explicit missing evidence; it grants no acceptance and no new policy. The earlier successful full FM01 run [45603992458](https://github.com/threeswordz/cinder-grind/actions/runs/45603992458/job/139186012299) tested `c83f2498ce46a2bba52f565fd6af8c1257784907`; the exact paired recovery [45613742239](https://github.com/threeswordz/cinder-grind/actions/runs/45613742239/job/139203659500) tested `36ff707c95d819491074fa40b38ca4df5cf83996`. The successor is ahead of that recovery source, 0 behind, with 12 changed paths in renderer, FM01, procurement fixtures and docs. Historical evidence is scoped to tested source, not an assertion that the new full candidate has been executed or approved.

| Immutable ID | Requirement | Actual bounded evidence / gap | Remaining gate |
|---|---|---|---|
| BEN01 | No delegate approver | No specific current no-delegation decision witness found; general approval engine subtree identical to FM01. | No delegate mapping and substitute denial on retained configured workflow. |
| BEN-BASE-01 | PO approval/revised commitments | 45613742239: V0.3-D PO approval/revision and PUR04 native distinct Ben action; 45616141518: real Jai revision/submission passed, Ben stage stopped; corrected run 45616676458 pending. | Complete latest independent Ben approval; retained MKE/TCJ role/scope. |
| BEN-BASE-02 | Subcontract agreement and WO approval | 45613742239: V0.5-B and V0.5-E actual configured maker-checker and project scope; subcontract API subtree byte-identical to FM01. | Actual Ben retained grant and assigned project; do not infer from generic checker. |
| BEN-BASE-05 | Project VO and budget revision | 45613742239: V0.3-A original/revised budget and V0.7-D actual signed VO maker-checker/reversal. Budget and cost-control API subtrees identical to FM01. | Retained Nancy/Ben exact maker-checker configuration; no altered approval authority. |
| BEN-BASE-07 | Management source-derived dashboard | 45613742239: V0.8-A through E source aggregates, permissions, scoped selector, reporting CSV parity. Reporting API and web subtrees byte-identical to FM01. | Actual retained Management grant and foreign Company denial. |
| PM01 | PR and usage-plan review | 45603992458: MATERIAL_RUN_NATIVE_PASS and UOM_CONVERTED_PLAN_ISSUE_NATIVE_PASS; 45613742239: V0.3-B actual PR approval. | Retained Store and Khaimook plan and PR approval independently; no DEC-054 runtime waiver. |
| PM05 | Disclosure and warehouse scope | 45603992458: MATERIAL_PLAN_RESTORED_WAREHOUSE_SCOPE_PASS and MATERIAL_PLAN_RESTORED_HTTP_HISTORY_QUANTITY_AND_SCOPE_PASS. Scope of specific quantity-only CSRF/export proof not established. | Exact quantity-only CSRF/export/foreign scope plus retained warehouse grants. |
| SS02 | Request new material codes | 45571855671: SS02_NATIVE_PG_CANONICAL_MATERIAL_HANDOFF_AND_AUDIT_PASS; already in historical row, not new credit. | Retained React journey; generic master creation boundary remains. |
| SS03 | Material-specific UOM | 45603992458: UOM_CONVERTED_RECEIVING_NATIVE_PASS, UOM_CONVERTED_RESERVATION_NATIVE_PASS, UOM_CONVERTED_OPERATIONAL_BROWSER_NATIVE_PASS, MATERIAL_UOM_BROWSER_NATIVE_PASS. | Retained specific material conversion and scope; no M7 completion. |
| SS07 | Foreman requests and receiver signs | 45603992458: MATERIAL_RUN_NATIVE_PASS, MATERIAL_UI_NATIVE_PASS, MATERIAL_REQUEST_RESTORED_HTTP_HISTORY_SIGNED_BYTES_AND_SCOPE_PASS. | Retained requester/receiver identity and signed receipt, no assumed human acceptance. |
| SS09 | Return unused good material | 45603992458: UOM_CONVERTED_PLAN_ISSUE_NATIVE_PASS and actual browser registers; 45613742239 V0.4-D return ceiling and restoration. | Retained Store role, original issue reference, scope and no Finance leakage. |
| SS-PLAN-01 | Material usage plan and issue limits | 45603992458: MATERIAL_RUN_NATIVE_PASS, UOM_CONVERTED_PLAN_ISSUE_NATIVE_PASS, MATERIAL_PLAN_ISSUE_RESTORED_HISTORY_APPROVAL_SIGNED_BYTES_AND_SCOPE_PASS. | Retained within-plan/overage authorization and explicit DEC-054 policy; no Mac or Production. |

## Exact source reuse inventory

Complete recursive trees (not truncated) compared 1424 vs 1576 entries. 76/79 selected material-plan/request/UOM/issue/return/reservation source and test files identical by Git blob; changed files explicitly listed below. This selection is not a complete dependency closure: inventory and web inventory directory trees differ, integrated schema/migrations and application wiring differ, no transfer of full CI verdict.

- apps/api/src/approval: identical `0790691f1ef391baff1a1fae8775b61fe04c5514`
- apps/api/src/budget: identical `903c687926c0a3cd560be38affdb315009e755f1`
- apps/api/src/cost-control: identical `e1cfb5aff786955e4ac95b52db518a8dc147e84a`
- apps/api/src/subcontracts: identical `d842d73afc9844f4868f885bce30a9b0c324ac08`
- apps/api/src/reporting: identical `bff16457f5a17a33e8458768eb2f5e2a27dc3841`
- apps/web/src/reporting: identical `533335568cd119df24a1e7b35ce6d0eb28898147`

Changed material-path blobs:
- apps/api/src/inventory/urgent-material-issue-contract.ts: FM01 `absent`; candidate `0621be1a6b235f990cc7f9b756dec819c7c88375`
- apps/api/src/inventory/urgent-material-issue-documents.controller.ts: FM01 `absent`; candidate `7c353ae8940acb4548e2cd82202cecf7382139c2`
- apps/api/src/inventory/urgent-material-issue-documents.service.ts: FM01 `absent`; candidate `e51e3bcca4336f8031267947035158d966b253f7`

## Validation links

- [FM01 full real material/UOM and predecessor recovery](https://github.com/threeswordz/cinder-grind/actions/runs/45603992458/job/139186012299)
- [Integrated paired recovery and canonical runtime acceptance](https://github.com/threeswordz/cinder-grind/actions/runs/45613742239/job/139203659500)
- [SS02 native handoff](https://github.com/threeswordz/cinder-grind/actions/runs/45571855671/job/139060175886)
- [Purchasing browser discrete Jai subproofs; overall failed](https://github.com/threeswordz/cinder-grind/actions/runs/45616141518/job/139211908561)
- [Corrected purchasing run](https://github.com/threeswordz/cinder-grind/actions/runs/45616676458)

All 12 original source-evidence gates remain pending for their exact retained acceptance or missing witness; all 112 IDs, six Owner boundaries and 42 future rows preserved. BEN01 is not asserted implemented by the general approval engine. No additional full CI, no retained role grants, no Production.
