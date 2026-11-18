# Material-specific UOM — approved entry proposal history

18 November 2026 SGT. **UOM-D01 APPROVED.** The Owner replied “approve, does this need codex?”; [approval record](https://github.com/threeswordz/cinder-grind/issues/354#issuecomment-6973859595) adopts the [original proposal](https://github.com/threeswordz/cinder-grind/issues/354#issuecomment-6973546760). The [approved entry](OP-MATERIAL-UOM-01-ENTRY.md) controls implementation. Pending/proposed wording in the preserved original below is historical. No runtime, grant, target or milestone completion is claimed by publication.

---

## Cloud-first material-UOM entry proposal — 18 November 2026 SGT
**PROPOSED, NOT APPROVED.** Prepared at main `bf3413caa26af4357bd57a38311f26dec86917c2` after the Owner asked to do other work before the Mac subcontract run. This is preparation only; no code, migration, permission, stock, Finance or target changes.

### Settled requirement and current gate

SS03 / PUR13 already confirms the principal requirement: one material may use the same or different purchase/receipt/issue units through an explicit fixed material-specific conversion. Do not ask that again. Actual retained factors are later configuration inputs, not prerequisites for generic code using clearly synthetic examples.

Subcontract implementation #365 and deployment tooling #370 are reviewed/integrated/main-green. Its actual Mac deployment remains pending under #353; the latest observed workstation is the completed transfer continuation. Cloud UOM work must not assume the unobserved subcontract result, replay completed journeys or activate anything on that Mac.

### One approval requested — UOM-D01

Approve the following bounded operational contract and cloud A→B→C implementation sequence after the ordinary entry publication gates. Actual target upgrades remain separately reviewed, state-checked and held until their real predecessor state is established. No interim human UAT; DEC-042 still applies.

| Control | Recommended entry contract | Observable consequence |
|---|---|---|
| Stock basis | Each explicitly enabled Company/material has one pinned stock UOM. All new controlled inventory effects and availability/reservation locks use that basis, while keeping original entered quantities/units. | Two cartons at20pieces/carton and five issued pieces reconcile to35pieces in the canonical ledger. A second inventory balance ledger is prohibited. |
| Exact definitions | Versioned direct source-UOM→stock-UOM ratios, scoped to this material and Company. Store an exact positive ratio; do not infer from labels or create chains/global pack sizes. Existing material-maintenance authority plus explicit conversion-definition permission is required; no automatic grants or new rate-approval workflow. | “1 carton =20 pieces” applies only to the selected material. Factor edits cannot alter already committed source facts. Actual MKE/TCJ maintainers and rates require their separate activation/configuration. |
| Effective date | Each definition revision has an explicit effective calendar date; deterministic selection uses a persisted conversion business date on the source. Reuse issueDate/transferDate where appropriate; require an explicit business date for controlled sources lacking one. No hidden server-today or timezone-derived fallback. Freeze the selected revision when the authorized source quantity is frozen/committed. | Backdated operations use their recorded applicable definition; later changes never reinterpret posted sources, existing approved plan quantities or reservations. Date/factor changes invalidate stale pending decisions where they change the source. |
| Precision | Exact arithmetic; reject a quantity if its normalized result cannot be represented within stock-UOM precision and existing DECIMAL(18,4) bounds. No automatic rounding, tolerance or residual balance. | A fractional result that cannot be stored exactly fails before any effect. A future rounding exception needs a separate concrete Owner decision. |
| Source ownership | PO/RFQ/GR commercial quantities, units, receipt ceilings, prices, currency and financial ownership remain canonical. Add normalized stock facts and pinned conversion provenance only to controlled inventory sources/effects. | Stock normalization cannot create overreceipt, reprice an invoice, convert money, or duplicate Actual/Paid Cost. |
| Returns/reversals | Reuse original stored source conversion and exact remaining source quantity; preserve current correction/approval/availability controls. Transfers preserve dispatch/actual-receipt timing and outstanding quantities. | Reversing an old one-carton issue at20pieces restores20, even if a future revision defines a new carton as24. |
| Counts and legacy activation | Controlled physical counts state and reconcile the pinned stock UOM. Preserve existing same-UOM behavior and every historical row. Mixed historical stock/source dimensions are not silently normalized; incompatible material activation fails pending a separately reviewed transition. | This first entry does not infer missing historical pack sizes or rewrite old balances. No bulk migration of real stock is authorized. |
| Plans/requests/reports | Normalize material-linked demand, approved plan quantities, reservations and fulfillment to the same basis with pinned source provenance; retain entered values and unit labels. Respect current overage/approval and request limits. No inferred BOQ work-to-material recipe. | A future larger carton cannot bypass a previously approved base-quantity limit. Subcontract measured-work UOMs, progress and commercial amounts are not automatically converted. |
| Scope/security/UI | Explicit opt-in and current active Employee, Company, Project and action rights; definition rights separate from operational rights. Backend and SQL enforce source binding, locks, versions and safe retries. EN/TH/zh-TW show entered and stock quantities, units and applicable definition. | No SYS_ADMIN business authority, role switcher, implicit substitute, cross-Company conversion or user-entered database identifiers. |

**Synthetic examples only:** receive2cartons at20pieces/carton=40; issue1carton=20remaining. A future24-piece revision leaves that balance unchanged; reversing the original issue restores20, not24. A new receipt under24 then adds24. Exact source limits and current correction/stock controls still apply. These are disposable test facts, not real material rates.

### Source change map and delivery exits

| Stage | Existing owners to extend | Required exit before dependent stage |
|---|---|---|
| A — Definitions and validation | Material/UOM master-data APIs/UI, explicit material stock basis and immutable definition revisions; existing master.material.manage and narrow conversion capability, no migration role grants | Company/material isolation, active/inactive references, exact ratios/date selection, immutable used definitions, precision/overflow, races/replays and additive historical preservation. A alone is not mixed-UOM stock delivery. |
| B — Canonical stock integration | InventoryQuantityService and StockTransaction source guards; GR/receiving, reservation, issue, return, count and same-Company transfer owners | Same canonical base dimension for availability/locks/effects; commercial GR ceilings, explicit dispatch/actual receipt, exact partial quantities and original-provenance correction/reversal remain correct. PostgreSQL/HTTP concurrency and bypass denials; no extra financial/stock ledger. |
| C — Plans, demand and complete UI/assurance | Material Plan/issue allocations, requests/fulfillment/signed evidence, approved material-compatible BOQ mapping, inventory/demand reports and trilingual screens | UOM-AC01–09 complete with real browser, limits/revocation/Document denials, historical same-UOM compatibility, separate populated restored-App proof and coherent preserved-data deployment preparation. No partial stage is labelled complete SS03. |

Current source evidence: Material has only defaultUomId; UOM has Company/code/name/decimalPlaces/activity. InventoryQuantityService keys sums and advisory locks by Company/Warehouse/Material/Project/UOM. GoodsReceiptService pins commercial source UOM and currently posts that UOM; MaterialPlanIssueService compares exact source UOM for eligibility/usage. New transfer, receiving and physical subcontract provenance must be preserved. Merely changing the default unit or adding a selector cannot meet this contract.

Cloud coding follows normal entry publication, exact-head CI, independent stable DEC-022 review, guarded integration and exact-main gates. Preserve the completed Mac transfer and the unexecuted subcontract handoff. If a later coherent deployment supersedes an unexecuted handoff, explicitly publish that disposition and prove the actual predecessor state first; never assume its receipt exists.

### Approval boundary

The decision requested is approval of this bounded stock-basis, version/date, exact-rejection and historical-activation contract and its cloud implementation sequence. The already confirmed fixed-rate principal requirement is not being reopened. No real conversion table, retained MKE/TCJ grants/data, Accounting/#288, #245/intercompany finance, valuation/write-off, payroll, mandatory paid dependency or Production is authorized. Prototype4/8 and GL3/10 remain until actual milestone exits; full human UAT follows technical freeze.

Repository governance (`AGENTS.md` §2) requires explicit Owner approval before new business/scope rules are implemented. Upon approval, record the decision and approved entry in the normal coherent publication PR; do not mark this proposal approved merely because it was prepared.
