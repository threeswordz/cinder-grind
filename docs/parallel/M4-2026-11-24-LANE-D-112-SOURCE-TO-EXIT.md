# Lane D — exact 112-ID source-to-exit reconciliation (24 Nov 2026, SGT)

**Status:** documentation-only candidate for independent examination. **NO business UAT, CI, retained-role activation, DEC-022 review, milestone acceptance or Production action claimed.** Owns only `docs/parallel/M4-2026-11-24-*`; the shared disposition CSV remains unchanged.

## Source identity and reconciliation method

- [Sprint #428](https://github.com/threeswordz/cinder-grind/issues/428); verified branch `docs-m4-112-exit-review-20261124` at pre-Lane-D new-work head `271575b0477b49a8ec7a1b62f031ea07171aa464`, descendant by one documentation commit from exact integrated [#427](https://github.com/threeswordz/cinder-grind/pull/427) application tree `680bca5767652522ef08f72d4df97b6df2732fca`. This report's evidence and code inspection are **pinned to 680bca5767652522ef08f72d4df97b6df2732fca**, not an unseen eventual final merge.
- Canonical 30 October source: `docs/ROLE-REQUIREMENTS-2026-10-30/data/requirements-execution.json`, exactly **112 records / 112 unique IDs**; 24 November ledger `docs/M4-2026-11-24-112-DISPOSITION.csv`, **112 rows / 112 unique IDs**. Exact set difference: **0 omitted, 0 added**; all rows `full_m4_acceptance_verified=NO`.
- Six **mutually exclusive** current technical dispositions: **32 B** bounded evidenced, **12 S** source/pending target proof, **14 R** role/current-source proof due, **6 G** known gap, **6 O** Owner/mixed policy, **42 F** deferred. Check: `32+12+14+6+6+42=112`. These are **not** user story implementation percent, pass counts or actual roles accepted.
- Historic **59 operational / role / scope** review rows (45+6+3+5) are a separate, overlapping operational queue; **59 does not mean 59 missing functions**, and it must not be summed with the new six-bucket partition.
- Preserve **prototype 4/8, GL 3/10, M4 checkpoint 20/32, formally accepted M4 packages 0/8, 0/1900 accepted forecast-hour credit** until governed evidence and Owner signoff exist.

## Pinned four-ID source-to-exit authority

| ID / current classification | Exact inspected source at `680bca576765` | What source does and does NOT show | Actor and Company/Project proof still required | Exit / dependency |
|---|---|---|---|---|
| **SS11 — G** | `apps/api/src/equipment/equipment.service.ts` (`assign`, `release`, `usage`, `listEquipment`); `equipment.controller.ts`; `apps/api/prisma/schema.prisma` (`Equipment`, `EquipmentAssignment`, `EquipmentUsage`) | Project equipment assignment and usage exist; **borrower identity, personal issue/due/return condition and loan audit are not evidenced**. `listEquipment` may return company-level equipment with `restrictedProject`; confirm role contract before alleging a data leak. | Store Site may operate **only assigned site/Project** and active Company/session; reject cross-Company, wrong-Project, double-checkout/return replay, inactive borrower, inappropriate retained roles. Existing Jai asset-register master and Nancy GL06 depreciation stay distinct. | Lane A `work-m4-ss11-equipment-custody-20261124` must deliver scoped personal custody and focused DB/HTTP negative/alias test; independent review and actor/browser/Owner check remain. Due penalties/depreciation policy is **BLOCKED_POLICY** if demanded, not defaulted. |
| **SS14 — G** | `apps/api/src/inventory/stock-minimum.service.ts` (`liveActor`, `site`, `read`, `planStarts`); `stock-minimum.controller.ts`, `stock-minimum-contract.ts`; `apps/web/src/inventory/StockMinimumsPanel.tsx` | Advisory per-site minimum uses **available = onHand - reserved**, fails closed for stale stock UOM. Thailand 14/7/0 reminder uses approved material-plan **`validFrom`**, **NOT day-level demand or supplier due date**. Response explicitly sets `dayByDayDemandScheduleIncluded=false`, `supplierDueOrLateIndicatorsIncluded=false`, `stockEffect=false`, `financeEffect=false`. | Store Site Project/site-specific read; only PM can set policy; active Company/Employee/session, cross-Project and TCJ denial; 14/7 boundaries and stale-UOM with no stock/Finance effect. | Lane B `work-m4-ss14-pm15-supplier-alerts-20261124`: derive source-linked PO-line required-on-site/expected-delivery **only if** authoritative, correct approved revision, partial GR and source scope established. Unknown dates remain unknown; supplier messages/threshold recipients Owner-gated. |
| **PM15 — G** | Same stock-minimum API; `apps/api/src/procurement/purchase-order.service.ts` (`LineUpdate.requiredOnSite/expectedDelivery`) and `schema.prisma` (`PurchaseOrderLine.requiredOnSite`/`expectedDelivery`) | Existing per-Project/site stock minimum and 14/7/0 **approved-plan-start** indicators are not complete supplier/daily-demand reporting. PO dates are candidate attributes, **not** proof of confirmed supplier delivery commitment; canceled/part-received lines cannot become available inventory. | Khaimook PM+Storekeeper sees only authorized active Company/Project(s) and permitted central warehouse; cross-Company never allowed; no role or Finance expansion. | Lane B supplies read-only due/late/partial/rescheduled indicators with focused foreign Company/Project and inactive-actor negatives; owner channel/recipients, true demand dates and #245 expansion remain OPEN. |
| **SS02 — S** | `apps/api/src/inventory/material-code-request.controller.ts`, `material-code-request.service.ts`, `material-code-request-contract.ts`, `material-code-request.native.integration.spec.ts`; `apps/web/src/inventory/MaterialCodeRequestsPanel.tsx`; `docs/M4-SS02-MATERIAL-CODE-REQUEST-2026-11-24.md` | Store request → **independent PM** review → existing-authorized Jai/Nancy canonical Material creation/link. Service checks live actor, project, audit history, stale review and source evidence. Exact focused contract/mock **11/11 PASS** [#45229748671](https://github.com/threeswordz/cinder-grind/actions/runs/45229748671) and PostgreSQL 17 **1/1 PASS** [#45230927000](https://github.com/threeswordz/cinder-grind/actions/runs/45230927000). **Not** authenticated retained browser proof; general `master.material.manage` create outside SS02 remains allowed. | Store Site maker limited assigned Company/Project; Khaimook independent checker; Jai/Nancy existing creator permission, no maker self-review, forged canonical-create/wrong Project/Company/revoked actor denial; verify API plus React with retained MKE/TCJ only after explicit permission. | Lane C real authenticated disposable role journeys, later retained-role access only on separate authority; Owner must decide if all master create must require SS02; **do not silently impose** universal gate. |

**Commercial invariants:** Owner-confirmed **DEC-054** permits *narrow audited Ben Cost-BOQ self-approval only*. Khaimook gets quantity-only access without monetary leaks in **API, UI, export or document bytes**; Ben prepares Client BOQ and Nancy independently approves. Preserve approved historical versions and Company/Project limits. Never reintroduce the older general Ben→Khaimook Cost BOQ approver rule.

## All 112 original IDs — no deletion, acceptance promotion or fake status upgrade

Codes: **B** bounded evidenced (32), **S** source / target proof due (12), **R** role/scope source proof due (14), **G** workflow gap (6), **O** Owner/mixed (6), **F** deferred (42). Evidence/exit text is deliberately abbreviated from **the unchanged canonical ledger**, not a new test assertion. Consult that CSV for full actor, risk, and exact scope.

| Immutable ID | Persona | Bucket | Scope | Existing evidence OR required next action (abbrev.) | Owner gate | Full M4 accepted |
|---|---|---|---|---|---|---|
| `BEN01` | ben | S | M4_SOURCE_PLUS_GL04_ROLE | Source behavior exists or historical source evidence; current exact candidate actor/negative evidence no… | NONE_PREAPPROVED | NO |
| `BEN02` | ben | O | XP_OR_APPROVED_EXCEPTION | emergency cap/actor and budget category require Owner decision before implementation | EXPLICIT_OWNER_POLICY_REQUIRED | NO |
| `BEN03` | ben | F | XP_245_OR_LATER | budget/overcommitment and expense controls future Owner/#245 gate | SCOPE_OWNER_AUTHORIZATION | NO |
| `BEN04` | ben | B | M4_BOUNDED_PLUS_GL04_RETAINED | runs 45103782289;45176454339 | NONE_PREAPPROVED | NO |
| `BEN-BASE-01` | ben | S | M4_SOURCE_PLUS_GL04_ROLE | Source behavior exists or historical source evidence; current exact candidate actor/negative evidence no… | NONE_PREAPPROVED | NO |
| `BEN-BASE-02` | ben | S | M4_SOURCE_PLUS_GL04_ROLE | Source behavior exists or historical source evidence; current exact candidate actor/negative evidence no… | NONE_PREAPPROVED | NO |
| `BEN-BASE-03` | ben | B | M4_BOUNDED_PLUS_GL04_RETAINED | #353 subcontract physical acceptance | NONE_PREAPPROVED | NO |
| `BEN-BASE-04` | ben | B | M4_BOUNDED_PLUS_GL04_RETAINED | #395 DEC-054 and V1.3 BOQ | NONE_PREAPPROVED | NO |
| `BEN-BASE-05` | ben | S | M4_SOURCE_PLUS_GL04_ROLE | Source behavior exists or historical source evidence; current exact candidate actor/negative evidence no… | NONE_PREAPPROVED | NO |
| `BEN-BASE-06` | ben | O | M4_OPERATIONAL_AND_FUTURE_SPLIT | Current operational slice must be separated from future Finance/HR/cross-Project feature | OWNER_SCOPE_SPLIT_REQUIRED | NO |
| `BEN-BASE-07` | ben | S | M4_SOURCE_PLUS_GL04_ROLE | Source behavior exists or historical source evidence; current exact candidate actor/negative evidence no… | NONE_PREAPPROVED | NO |
| `BEN-HR-01` | ben | F | GL05_HR | Time/OT/leave/payroll later staged, no M4 activation | HR_PAYROLL_ENTRY_POLICY | NO |
| `NANCY-01` | nancy | B | M4_BOUNDED_PLUS_GL04_RETAINED | #395 DEC-054 and V1.3 BOQ | NONE_PREAPPROVED | NO |
| `NANCY-02` | nancy | F | GL06_ACCOUNTING_288 | No NEW Accounting/AP/payment claims in M4; existing safe read/approval controls preserved | EXISTING_288_ACCOUNTING_DEFERRAL | NO |
| `NANCY-03` | nancy | F | GL06_ACCOUNTING_288 | No NEW Accounting/AP/payment claims in M4; existing safe read/approval controls preserved | EXISTING_288_ACCOUNTING_DEFERRAL | NO |
| `NANCY-04` | nancy | R | M4_ROLE_SCOPE_RECONCILIATION | Inspect current exact feature source and active role/Company/Project readback before declaring gap or PA… | NONE_PREAPPROVED | NO |
| `NANCY-05` | nancy | R | M4_ROLE_SCOPE_RECONCILIATION | Inspect current exact feature source and active role/Company/Project readback before declaring gap or PA… | NONE_PREAPPROVED | NO |
| `NANCY-06` | nancy | F | GL06_ACCOUNTING_288 | No NEW Accounting/AP/payment claims in M4; existing safe read/approval controls preserved | EXISTING_288_ACCOUNTING_DEFERRAL | NO |
| `NANCY-07` | nancy | B | M4_BOUNDED_PLUS_GL04_RETAINED | runs 45101879795;45132932414 | NONE_PREAPPROVED | NO |
| `NANCY-08` | nancy | F | GL06_ACCOUNTING_288 | No NEW Accounting/AP/payment claims in M4; existing safe read/approval controls preserved | EXISTING_288_ACCOUNTING_DEFERRAL | NO |
| `NANCY-09` | nancy | F | GL06_ACCOUNTING_288 | No NEW Accounting/AP/payment claims in M4; existing safe read/approval controls preserved | EXISTING_288_ACCOUNTING_DEFERRAL | NO |
| `NANCY-10` | nancy | F | GL05_HR | Time/OT/leave/payroll later staged, no M4 activation | HR_PAYROLL_ENTRY_POLICY | NO |
| `NANCY-11` | nancy | F | GL05_HR | Time/OT/leave/payroll later staged, no M4 activation | HR_PAYROLL_ENTRY_POLICY | NO |
| `NANCY-12` | nancy | B | M4_BOUNDED_PLUS_GL04_RETAINED | #283 HR1-A restricted | NONE_PREAPPROVED | NO |
| `PM01` | khaimook | S | M4_SOURCE_PLUS_GL04_ROLE | Do not confuse approved usage Material Plan with PM02 Procurement PR | NONE_PREAPPROVED | NO |
| `PM02` | khaimook | B | M4_BOUNDED_PLUS_GL04_RETAINED | runs 45127724396;45147124712;45181742276 | NONE_PREAPPROVED | NO |
| `PM03` | khaimook | F | XP_245_OR_LATER | cross-project excess-demand/budget revision separately gated | SCOPE_OWNER_AUTHORIZATION | NO |
| `PM04` | khaimook | B | M4_BOUNDED_PLUS_GL04_RETAINED | #395 DEC-054 and V1.3 BOQ | NONE_PREAPPROVED | NO |
| `PM05` | khaimook | S | M4_SOURCE_PLUS_GL04_ROLE | Source behavior exists or historical source evidence; current exact candidate actor/negative evidence no… | NONE_PREAPPROVED | NO |
| `PM06` | khaimook | B | M4_BOUNDED_PLUS_GL04_RETAINED | #347 receiving bounded actual Mac lifecycle | NONE_PREAPPROVED | NO |
| `PM07` | khaimook | O | M4_OPERATIONAL_AND_FUTURE_SPLIT | Owner split: same-Company transfer PASS bounded; beyond-plan authority and intercompany/Finance separate… | OWNER_SCOPE_SPLIT_REQUIRED | NO |
| `PM08` | khaimook | B | M4_BOUNDED_PLUS_GL04_RETAINED | #300 quantity-only stock count | NONE_PREAPPROVED | NO |
| `PM09` | khaimook | B | M4_BOUNDED_PLUS_GL04_RETAINED | runs 45101879795;45132932414 | NONE_PREAPPROVED | NO |
| `PM10` | khaimook | R | M4_ROLE_SCOPE_RECONCILIATION | Inspect current exact feature source and active role/Company/Project readback before declaring gap or PA… | NONE_PREAPPROVED | NO |
| `PM11` | khaimook | R | M4_ROLE_SCOPE_RECONCILIATION | Inspect current exact feature source and active role/Company/Project readback before declaring gap or PA… | NONE_PREAPPROVED | NO |
| `PM12` | khaimook | B | M4_BOUNDED_PLUS_GL04_RETAINED | #353 subcontract physical acceptance | NONE_PREAPPROVED | NO |
| `PM13` | khaimook | R | M4_ROLE_SCOPE_RECONCILIATION | Inspect current exact feature source and active role/Company/Project readback before declaring gap or PA… | NONE_PREAPPROVED | NO |
| `PM14` | khaimook | F | GL05_HR | Time/OT/leave/payroll later staged, no M4 activation | HR_PAYROLL_ENTRY_POLICY | NO |
| `PM15` | khaimook | G | M4_GAP_OR_EXPLICIT_OWNER_DEFERRAL | PR #427 integrated PM site minimum alerts plus read-only latest approved plan validFrom start reminders … | OWNER_IF_SCOPE_OR_EXCEPTION_CHANGES | NO |
| `PM16` | khaimook | B | M4_BOUNDED_PLUS_GL04_RETAINED | runs 45103782289;45176454339 | NONE_PREAPPROVED | NO |
| `PM-HR-01` | khaimook | F | GL05_HR | Time/OT/leave/payroll later staged, no M4 activation | HR_PAYROLL_ENTRY_POLICY | NO |
| `PM-CASH-01` | khaimook | F | GL06_ACCOUNTING_288 | No NEW Accounting/AP/payment claims in M4; existing safe read/approval controls preserved | EXISTING_288_ACCOUNTING_DEFERRAL | NO |
| `PUR01` | jai | B | M4_BOUNDED_PLUS_GL04_RETAINED | runs 45142678279;45185452075 | NONE_PREAPPROVED | NO |
| `PUR03` | jai | R | M4_ROLE_SCOPE_RECONCILIATION | Inspect current exact feature source and active role/Company/Project readback before declaring gap or PA… | NONE_PREAPPROVED | NO |
| `PUR04` | jai | B | M4_BOUNDED_PLUS_GL04_RETAINED | runs 45185452075;45187304506 | NONE_PREAPPROVED | NO |
| `PUR05` | jai | B | M4_BOUNDED_PLUS_GL04_RETAINED | run 45192292763 | NONE_PREAPPROVED | NO |
| `PUR06` | jai | F | XP_245_OR_LATER | #245 multi-Project PO and Finance attribution: explicit later authorized scope; no silent downgrade | SCOPE_OWNER_AUTHORIZATION | NO |
| `PUR07` | jai | B | M4_BOUNDED_PLUS_GL04_RETAINED | runs 45155841629;45162334613;45195364823;45196516424 | NONE_PREAPPROVED | NO |
| `PUR08` | jai | G | M4_GAP_OR_EXPLICIT_OWNER_DEFERRAL | supplier acknowledgment, in-transit, partial/outstanding and reschedule timeline not proved by #425 or #… | OWNER_IF_SCOPE_OR_EXCEPTION_CHANGES | NO |
| `PUR09` | jai | B | M4_BOUNDED_PLUS_GL04_RETAINED | #347 receiving bounded actual Mac lifecycle | NONE_PREAPPROVED | NO |
| `PUR10` | jai | G | M4_GAP_OR_EXPLICIT_OWNER_DEFERRAL | #425 lacks Jai→Khaimook→Ben cancellation; Builder1 exact branch contains audit/service/UI and guarded at… | OWNER_CONFLICT_POLICY_ON_DEPOSIT_OR_… | NO |
| `PUR12` | jai | B | M4_BOUNDED_PLUS_GL04_RETAINED | runs 45149778502;45150538123 | NONE_PREAPPROVED | NO |
| `PUR13` | jai | R | M4_ROLE_SCOPE_RECONCILIATION | Inspect current exact feature source and active role/Company/Project readback before declaring gap or PA… | NONE_PREAPPROVED | NO |
| `PUR14` | jai | G | M4_GAP_OR_EXPLICIT_OWNER_DEFERRAL | supplier discrepancy/return/replacement not satisfied by internal posted-issue material return or receiv… | OWNER_IF_SCOPE_OR_EXCEPTION_CHANGES | NO |
| `PUR15` | jai | O | M4_OPERATIONAL_AND_FUTURE_SPLIT | PO/GR operational handover packet vs new AP/payment processing #288; split before M4 disposition | OWNER_SCOPE_SPLIT_REQUIRED | NO |
| `JAI-ASSET-01` | jai | R | M4_ROLE_SCOPE_RECONCILIATION | Inspect current exact feature source and active role/Company/Project readback before declaring gap or PA… | NONE_PREAPPROVED | NO |
| `JAI-SCOPE-01` | jai | R | M4_ROLE_SCOPE_RECONCILIATION | Inspect current exact feature source and active role/Company/Project readback before declaring gap or PA… | NONE_PREAPPROVED | NO |
| `SS01` | store | R | M4_ROLE_SCOPE_RECONCILIATION | Inspect current exact feature source and active role/Company/Project readback before declaring gap or PA… | NONE_PREAPPROVED | NO |
| `SS02` | store | S | M4_BOUNDED_PLUS_GL04_RETAINED | 11/11 scoped contract/mock source PASS run 45229748671 plus PostgreSQL17 native 1/1 PASS run 45230927000… | OWNER_IF_SCOPE_OR_EXCEPTION_CHANGES | NO |
| `SS03` | store | S | M4_SOURCE_PLUS_GL04_ROLE | material-specific UOM prior staged source; verify selected material conversions and live values rather t… | NONE_PREAPPROVED | NO |
| `SS04` | store | B | M4_BOUNDED_PLUS_GL04_RETAINED | #347 receiving bounded actual Mac lifecycle | NONE_PREAPPROVED | NO |
| `SS05` | store | B | M4_BOUNDED_PLUS_GL04_RETAINED | #347 receiving bounded actual Mac lifecycle | NONE_PREAPPROVED | NO |
| `SS06` | store | B | M4_BOUNDED_PLUS_GL04_RETAINED | #347 receiving bounded actual Mac lifecycle | NONE_PREAPPROVED | NO |
| `SS07` | store | S | M4_SOURCE_PLUS_GL04_ROLE | existing #315 signed material issue acknowledgment evidence; source/readback needed, not a new functiona… | NONE_PREAPPROVED | NO |
| `SS08` | store | R | M4_ROLE_SCOPE_RECONCILIATION | Inspect current exact feature source and active role/Company/Project readback before declaring gap or PA… | NONE_PREAPPROVED | NO |
| `SS09` | store | S | M4_SOURCE_PLUS_GL04_ROLE | Source behavior exists or historical source evidence; current exact candidate actor/negative evidence no… | NONE_PREAPPROVED | NO |
| `SS10` | store | O | M4_OPERATIONAL_AND_FUTURE_SPLIT | Current operational slice must be separated from future Finance/HR/cross-Project feature | OWNER_SCOPE_SPLIT_REQUIRED | NO |
| `SS11` | store | G | M4_GAP_OR_EXPLICIT_OWNER_DEFERRAL | CG##### asset/tool custody loan and return not demonstrated by stock movement source | OWNER_IF_SCOPE_OR_EXCEPTION_CHANGES | NO |
| `SS12` | store | B | M4_BOUNDED_PLUS_GL04_RETAINED | #300 quantity-only stock count | NONE_PREAPPROVED | NO |
| `SS13` | store | F | XP_245_OR_LATER | Later financial/budget, cross-Project or policy gate | SCOPE_OWNER_AUTHORIZATION | NO |
| `SS14` | store | G | M4_GAP_OR_EXPLICIT_OWNER_DEFERRAL | PR #427 integrated PM site minimum alerts plus read-only latest approved plan validFrom start reminders … | OWNER_IF_SCOPE_OR_EXCEPTION_CHANGES | NO |
| `SS15` | store | F | GL06_ACCOUNTING_288 | No NEW Accounting/AP/payment claims in M4; existing safe read/approval controls preserved | EXISTING_288_ACCOUNTING_DEFERRAL | NO |
| `SS16` | store | R | M4_ROLE_SCOPE_RECONCILIATION | Inspect current exact feature source and active role/Company/Project readback before declaring gap or PA… | NONE_PREAPPROVED | NO |
| `SS17` | store | R | M4_ROLE_SCOPE_RECONCILIATION | Inspect current exact feature source and active role/Company/Project readback before declaring gap or PA… | NONE_PREAPPROVED | NO |
| `SS18` | store | B | M4_BOUNDED_PLUS_GL04_RETAINED | #352 transfer bounded receipt | NONE_PREAPPROVED | NO |
| `SS-PLAN-01` | store | S | M4_SOURCE_PLUS_GL04_ROLE | material-plan-issue controller has within-plan and overage routes; integration source exists but exact c… | NONE_PREAPPROVED | NO |
| `SS-HR-01` | store | F | GL05_HR | Time/OT/leave/payroll later staged, no M4 activation | HR_PAYROLL_ENTRY_POLICY | NO |
| `SS-HR-02` | store | F | GL05_HR | Time/OT/leave/payroll later staged, no M4 activation | HR_PAYROLL_ENTRY_POLICY | NO |
| `FM01` | foreman | B | M4_BOUNDED_PLUS_GL04_RETAINED | runs 45103782289;45176454339 | NONE_PREAPPROVED | NO |
| `FM02` | foreman | B | M4_BOUNDED_PLUS_GL04_RETAINED | #396 main merged/versioned progress | NONE_PREAPPROVED | NO |
| `FM03` | foreman | B | M4_BOUNDED_PLUS_GL04_RETAINED | #344 Mac actual deployed FM03 | NONE_PREAPPROVED | NO |
| `FM04` | foreman | R | M4_ROLE_SCOPE_RECONCILIATION | Inspect current exact feature source and active role/Company/Project readback before declaring gap or PA… | NONE_PREAPPROVED | NO |
| `FM05` | foreman | B | M4_BOUNDED_PLUS_GL04_RETAINED | #300 quantity-only stock count | NONE_PREAPPROVED | NO |
| `FM-HR-01` | foreman | F | GL05_HR | Time/OT/leave/payroll later staged, no M4 activation | HR_PAYROLL_ENTRY_POLICY | NO |
| `ACC01` | porn | F | GL06_ACCOUNTING_288 | No NEW Accounting/AP/payment claims in M4; existing safe read/approval controls preserved | EXISTING_288_ACCOUNTING_DEFERRAL | NO |
| `ACC02` | porn | F | GL06_ACCOUNTING_288 | No NEW Accounting/AP/payment claims in M4; existing safe read/approval controls preserved | EXISTING_288_ACCOUNTING_DEFERRAL | NO |
| `ACC03` | porn | F | GL06_ACCOUNTING_288 | No NEW Accounting/AP/payment claims in M4; existing safe read/approval controls preserved | EXISTING_288_ACCOUNTING_DEFERRAL | NO |
| `ACC04` | porn | F | GL06_ACCOUNTING_288 | No NEW Accounting/AP/payment claims in M4; existing safe read/approval controls preserved | EXISTING_288_ACCOUNTING_DEFERRAL | NO |
| `ACC05` | porn | F | GL06_ACCOUNTING_288 | No NEW Accounting/AP/payment claims in M4; existing safe read/approval controls preserved | EXISTING_288_ACCOUNTING_DEFERRAL | NO |
| `ACC06` | porn | F | GL06_ACCOUNTING_288 | No NEW Accounting/AP/payment claims in M4; existing safe read/approval controls preserved | EXISTING_288_ACCOUNTING_DEFERRAL | NO |
| `ACC07` | porn | F | GL06_ACCOUNTING_288 | No NEW Accounting/AP/payment claims in M4; existing safe read/approval controls preserved | EXISTING_288_ACCOUNTING_DEFERRAL | NO |
| `ACC08` | porn | F | GL06_ACCOUNTING_288 | No NEW Accounting/AP/payment claims in M4; existing safe read/approval controls preserved | EXISTING_288_ACCOUNTING_DEFERRAL | NO |
| `ACC09` | porn | F | GL06_ACCOUNTING_288 | No NEW Accounting/AP/payment claims in M4; existing safe read/approval controls preserved | EXISTING_288_ACCOUNTING_DEFERRAL | NO |
| `ACC10` | porn | F | GL06_ACCOUNTING_288 | No NEW Accounting/AP/payment claims in M4; existing safe read/approval controls preserved | EXISTING_288_ACCOUNTING_DEFERRAL | NO |
| `ACC11` | porn | F | GL06_ACCOUNTING_288 | No NEW Accounting/AP/payment claims in M4; existing safe read/approval controls preserved | EXISTING_288_ACCOUNTING_DEFERRAL | NO |
| `ACC12` | porn | F | GL06_ACCOUNTING_288 | No NEW Accounting/AP/payment claims in M4; existing safe read/approval controls preserved | EXISTING_288_ACCOUNTING_DEFERRAL | NO |
| `ACC13` | porn | F | GL06_ACCOUNTING_288 | No NEW Accounting/AP/payment claims in M4; existing safe read/approval controls preserved | EXISTING_288_ACCOUNTING_DEFERRAL | NO |
| `ACC14` | porn | F | GL06_ACCOUNTING_288 | No NEW Accounting/AP/payment claims in M4; existing safe read/approval controls preserved | EXISTING_288_ACCOUNTING_DEFERRAL | NO |
| `ACC15` | porn | F | GL06_ACCOUNTING_288 | No NEW Accounting/AP/payment claims in M4; existing safe read/approval controls preserved | EXISTING_288_ACCOUNTING_DEFERRAL | NO |
| `ACC16` | porn | F | GL06_ACCOUNTING_288 | No NEW Accounting/AP/payment claims in M4; existing safe read/approval controls preserved | EXISTING_288_ACCOUNTING_DEFERRAL | NO |
| `ACC17` | porn | F | GL06_ACCOUNTING_288 | No NEW Accounting/AP/payment claims in M4; existing safe read/approval controls preserved | EXISTING_288_ACCOUNTING_DEFERRAL | NO |
| `PORN-SUB-01` | porn | B | M4_BOUNDED_PLUS_GL04_RETAINED | #353 subcontract physical acceptance | NONE_PREAPPROVED | NO |
| `PORN-BOQ-01` | porn | B | M4_BOUNDED_PLUS_GL04_RETAINED | #395 DEC-054 and V1.3 BOQ | NONE_PREAPPROVED | NO |
| `PORN-HR-01` | porn | O | M4_OPERATIONAL_AND_FUTURE_SPLIT | Current operational slice must be separated from future Finance/HR/cross-Project feature | OWNER_SCOPE_SPLIT_REQUIRED | NO |
| `KOH-01` | koh | B | M4_BOUNDED_PLUS_GL04_RETAINED | #283 HR1-A restricted | NONE_PREAPPROVED | NO |
| `KOH-02` | koh | B | M4_BOUNDED_PLUS_GL04_RETAINED | #283 HR1-A restricted | NONE_PREAPPROVED | NO |
| `KOH-03` | koh | F | GL05_HR | Time/OT/leave/payroll later staged, no M4 activation | HR_PAYROLL_ENTRY_POLICY | NO |
| `KOH-04` | koh | F | GL05_HR | Time/OT/leave/payroll later staged, no M4 activation | HR_PAYROLL_ENTRY_POLICY | NO |
| `KOH-05` | koh | F | GL05_HR | Time/OT/leave/payroll later staged, no M4 activation | HR_PAYROLL_ENTRY_POLICY | NO |
| `KOH-06` | koh | F | GL05_HR | Time/OT/leave/payroll later staged, no M4 activation | HR_PAYROLL_ENTRY_POLICY | NO |
| `KOH-07` | koh | F | GL05_HR | Time/OT/leave/payroll later staged, no M4 activation | HR_PAYROLL_ENTRY_POLICY | NO |
| `KOH-08` | koh | F | GL05_HR | Time/OT/leave/payroll later staged, no M4 activation | HR_PAYROLL_ENTRY_POLICY | NO |

## Nonpromotion, coordination and evidence capture

1. Branches A/B/C are **unverified until their respective exact SHA and tests are received**; even a pushed source change cannot set any `full_m4_acceptance_verified` to YES. Coordinator alone owns integration and shared CSV updates after a single-owner handoff.
2. For each current M4 ID, prove source SHA, actor/role and live effective permission, authenticated UI and API behavior, wrong Project in same Company, foreign Company, revoked actor/session, independent maker/checker, audit, export/bytes, and source-specific bounded native evidence; write **BLOCKED_CONFIGURATION** when retained credentials/authority are missing.
3. **Future F** IDs retain explicit GL05 HR / GL06 Accounting / #245 boundaries; **O** IDs retain scoped Owner decision. Neither can be counted as M4 technical failures or quietly included in a release. 
4. No new tests or full CI were executed by this docs-only lane. Required final independent DEC-022 review and Owner-specific #384 CI/Ready/merge authority remain gates.
