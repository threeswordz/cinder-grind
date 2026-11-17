# Owner decisions — 17 November 2026 (Singapore time)

**OWNER-CONFIRMED REQUIREMENTS; PUBLICATION AUTHORIZED; IMPLEMENTATION SEPARATE.** The Owner compared the current repository at `97db9151b1059e5f134529deb25b78fc714fa683` against the latest HR, purchasing and data-template requirements and explicitly instructed: “I authorise publishing all 17 November HR and purchasing requirements and the three original files to GitHub. Proceed with the governed PR and continue the existing ERP development sequence.”

This English overlay supersedes only the specified pending answers or conflicting successor directions in [16 November decisions / DEC-047](15-owner-decisions-2026-11-16.md), [Thai HR source of 27 October](../HR-PAYROLL-REQUIREMENTS-TH-2026-10-27.md), [HR entry preparation](../HR-PAYROLL-ENTRY-PREPARATION.md) and PUR03/PUR07/PUR12. It preserves the original 112-row inventory and all earlier accepted/prototype history. HR PDF sections 10.2–10.4, 13–15 and 21–22 and the original spreadsheets are the source artifacts; the [artifact manifest and mapping](17-template-manifest-2026-11-17.md) records their exact identity and pending binary verification.

## 1. HR: monthly allowances, THB

| Eligible position | Telephone per month | Vehicle care per month |
| --- | ---: | ---: |
| Manager (ผู้จัดการ) | 2,000 | — |
| Head Foreman (หัวหน้าโฟร์แมน) | 1,000 | — |
| Foreman (โฟร์แมน) | 300 | — |
| Storekeeper (สโตร์) | 500 | — |
| Pickup driver (คนขับรถกระบะ) | 300 | 600 |
| Six-wheel driver (คนขับรถ 6 ล้อ) | 300 | 1,000 |
| Excavator operator (คนขับรถแมคโคร) | — | 1,000 |

Both allowances are paid once monthly on the 5th. A dash indicates no entitlement selected for that role in this answer; no additional rates or default eligibility. Record actual effective dates per employee; do not infer an effective date, proration, multiple-role stacking or calendar shift rule. Subsistence allowance (เบี้ยเลี้ยง) and attendance bonus (เบี้ยขยัน) are **PAUSED — conditions not established**: no default calculation, rate or entitlement. No other bonus/addition item was selected. Preserve confirmed existing position allowance and accommodation/food allowance (the prior 50% on 20th / 50% on 5th policy).

## 2. Leave (Owner-stated company policy, not a legal certification)

| Type | Stated policy | Evidence / notification |
| --- | --- | --- |
| Sick | Paid up to 30 days/year | Notify on first day absent; medical certificate every time |
| Maternity | Paid up to 98 days/year, as stated by Owner | Leave form; seven days' advance notice |
| Unpaid | No specified day limit | Leave form; short leave 1–2 days may be notified that day; longer leave requires seven days' advance notice |

Retrospective leave should not exceed two days from the first day absent, including holidays. Preserve the wording “should not exceed”; do not invent rejection, exception or inclusive-day boundary behavior beyond this stated counting basis. Existing reason/evidence, role-specific approval, approved-leave corrections, vacation/personal leave and unpaid excess arrangements remain. Record the amounts as stated, not a statutory floor/ceiling or an executable payroll formula. Before implementing or activating, verify the effective Thai labor-law requirements (including maternity entitlement/employer-paid duration, sick certificate and notice requirements), accountant review and Nancy approval with Koh configuration; resolve conflicts explicitly rather than applying an unlawful restriction. No law/configuration sign-off is claimed.

## 3. Historical balances and Employee Welfare Fund

- Accumulate from employment start, including pre-ERP balances. Enter aggregate opening balances per employee; do not recreate every historical payroll period. Track cutoff, source and completeness; separate employee and employer contributions. Unknown/blank is not zero; do not claim coverage back to employment start where the opening evidence is missing.
- Employee Welfare Fund (กองทุนสงเคราะห์ลูกจ้าง): track deductions and cumulative balances, employee contributions, employer contributions and total separately. HR may view cumulative values; slips show the three cumulative values under existing privacy rules. Remittance, arrears and refunds were **not selected**; do not add them.
- Actual rates, base, ceilings, effective dates and payroll/tax/OT formula review remain the external accountant → Koh compiles → Nancy approves → Koh configures path. No assumed statutory rates or payroll posting.
- Use the Thai seven-sheet employee data template for employee-specific input and verified aggregate opening balances. Do not publish filled personnel files, private data, keys or actual opening balances in this public repository.

These answers resolve queues 8/9/10/12/13 from the 16 November answer overlay except the explicitly paused subsistence/attendance topics. Self-service and offboarding already recorded on 16 November remain unchanged (office/Foremen/Store own selected records, HR-distributed payslips; no new payslip self-service).

## 4. Partner master and purchasing successor (PUR03/PUR07/PUR12)

- Supplier and Customer must each store **full name and short name as distinct fields**. Short name is not the existing supplier/customer code. Preserve existing Company-scoped IDs, codes, full names and approved master ownership. For a supplier/contractor used on a PO, use its applicable short name; do not create duplicate partner identity.
- New PO presentation format: `T/K-POYYMM-NNN ชื่อย่อผู้ขายหรือผู้รับเหมา` (TCJ = T; MKE = K; use one applicable prefix, not literal T/K). Example: `T-PO2610-001 ABC`. Preserve three-digit monthly numbering direction and existing immutable historical numbers and revision/source links. Current runtime creates unprefixed `POYYMM-###`; this is a successor requirement, not a runtime change. Entry design must settle persistent canonical number versus display/snapshot suffix, month/sequence timezone and collision behavior, missing short names/legacy compatibility and revisions without rewriting existing contracts or transactions.
- Approved PO PDF export required: filename example `T-PO2610-001 ABC.pdf`, using short name instead of PUR07's previous full-name filename. Keep full legal partner name in appropriate business fields; do not replace it globally. Ben's approval, Jai's manual external email/LINE dispatch and acknowledgment evidence stay; no external messaging integration approved. Define safe deterministic filenames, historical snapshots, scope enforcement and approved-version retrieval in implementation. No corresponding PO PDF export action was found in the inspected baseline.
- Separate, gated entry and stable independent review for schema/identity/numbering/auth changes; safe API/UI and forward-only upgrade, compatibility and actual PDF/download tests. No rename/backfill of historical POs, no permission broadening and no change to #245 allocation scope.

## 5. Expanded data collection and sequencing

The 20-sheet Thai master-data workbook covers Company, partners and contacts/banks/tax/credit/GL mapping, material categories/UOM/items, warehouse/location/stock opening, assets/tools, chart of accounts, company banks/chequebooks, credit terms, opening ledger/AP/AR, Projects and field guidance. [Mapping](17-template-manifest-2026-11-17.md) distinguishes currently available models from unsupported data. These are collection templates, not an import service or proof that all fields are implemented.

**Delivery boundary:** requirements and source templates only. No code, schema, migration, workflow/grant, retained records, operational configuration, deployment or milestone/GL score change. Preserve DEC-008, DEC-022, DEC-042, DEC-047/048, #288 Accounting deferral, #245, later HR entry approval and the presently active subcontract #365 lane. HR1-A employee/history/privacy/document foundation is integrated; attendance/leave/OT/payroll/fund/offboarding are later implementation. No live imports, production activation or business UAT authorization. The next approved technical outcome remains the subcontract lane, then remaining deployed operational journeys, populated recovery and technical freeze under existing gates.
