# PR441 exact candidate review delta

Builder preparation, not independent review or human acceptance.

- Protected main: `3a441b1fa389a9a274e6ca82413740a3ffa2f51b`
- Previous integrated draft #440: `f1af4265c071b5c0988d87ef87be6ee2c810eaac`
- Current integrated [Draft #441](https://github.com/threeswordz/cinder-grind/pull/441): `e22bfddf18ada568f90d1ec04096164f8f2bd23f`
- Exact GitHub compare: 313 commits ahead, 0 behind, 180 paths (143 added, 37 modified). All paths in [PR440 full inventory](M4-2026-11-24-PR440-EXACT-MAIN-DEC022-HANDOFF.md) remain the same; three paths below have new blobs. Review the entire current main-to-head diff, not just the overlay.
- [Focused run #45398081733](https://github.com/threeswordz/cinder-grind/actions/runs/45398081733) uses workflow-only child `778721521ff47c395c9123e8f72ecdea9c4e34c0`; **OVERALL SUCCESS** verified. Fresh PG17.11 migrations, API build, scoped submit/final approval seam and actual native rollback/legitimate original and revised PO. Logs: `M4_PM02_NATIVE_FINAL_APPROVAL_SUPPLIER_CHANGE_ROLLBACK_PASS`, `M4_PUR05_NEW_REVISION_REQUIRES_NEW_APPROVAL_AND_DISTINCT_BEN_ACTION_PASS`, `M4_PUR04_ACTUAL_POSTGRES17_REVISION_COMPANY_PROJECT_SCOPED_PASS`. No full CI or browser replay.

| Changed path | Current Git blob | Review focus |
|---|---|---|
| `apps/api/src/procurement/purchase-order.service.ts` | `f1418886f51248840583fc67df2169e255a3ad80` | Shared scoped active-demand helper; final approval callback transaction; supplier and Project recheck; existing approval instance/maker identity |
| `apps/api/src/procurement/purchase-order.pm02-source-guard.spec.ts` | `ffa342a0d522a6a83be9ad56b779a6447a128359` | Scoped submit and 10 final-approval denial scenarios, mock seam only |
| `apps/api/src/procurement/purchase-order.pur04-revision.integration.spec.ts` | `b515a270a867947af300962eb4340e47f8941787` | Actual disposable PG rollback on supplier deactivation after preflight; legitimate original and revision approval |

The existing [prior evidence matrix](M4-2026-11-24-PRIOR-EVIDENCE-REUSE-AND-GAPS.md) remains historical; the three new blobs supersede its relevant source comparisons. No schema or UI change. The final callback runs in the existing ApprovalService serializable transaction. A service seam is not a live HTTP revocation proof; retained named-role UAT and independent exact-head review are still required. The Project access recheck uses existing live employee and assignment checks, not a new generic role/session revalidation mechanism. No role grants, Ready transition, main merge, Production, or policy change.
