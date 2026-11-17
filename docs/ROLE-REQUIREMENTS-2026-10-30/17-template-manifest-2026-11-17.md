# 17 November 2026 — original source templates and provisional model mapping

Companion to [Owner decisions](16-owner-decisions-2026-11-17.md). **Binary publication pending until the exact three original files are present and verified on this PR branch.** The originals were recovered from the Owner's Library and their file bytes checked locally; both XLSX archives passed integrity testing. PDFs/Excel files are not silently regenerated. Expected repository directory: `docs/requirements-templates/2026-11-17/`. Use the exact filenames and SHA-256 hashes below. Do not merge this publication until all three paths exist with matching hashes and have undergone template/privacy review. Public repository: only unfilled/synthetic examples; real employee IDs, bank details, salaries, customer/vendor data, tax IDs, opening balances or private attachments must remain outside Git.

| Original filename | Bytes | SHA-256 |
| --- | ---: | --- |
| Requirements-HR-Payroll-TH-2026-11-17.pdf | 365611 | `8fb8f2d277f478a7fb516dcccf6c1f4b1bc176a23a5d9f4664069d0f45fa14a6` |
| employee-data-template-th.xlsx | 67211 | `86531093134befefb4a0add3185ec685558435537b113fd51678ad9ea82e142a` |
| Master-Data-Template-TH-2026-11-17.xlsx | 297119 | `7a5094d193fb6861fd6f9fe23a2a5f9a9e95ef21a1abc3ed0c5de659540a5428` |

## Master-data workbook (20 worksheets)

Schema inspected at `97db9151`; mapping is conceptual, not evidence of an end-to-end import or comprehensive field support. Company-qualified code/reference joins and validation are required; keep leading zeroes as text, dates in Gregorian ISO and THB. Unsupported fields must remain explicit, not stuffed into free text or automatically added to schema.

| Sheet | Current canonical target / limitation |
| --- | --- |
| 00 วิธีกรอก | Collection instructions; no application record |
| 01 บริษัท | Company: companyCode/companyName/baseCurrencyCode/isActive; extended legal/tax/address/bank fields require entry design |
| 02 คู่ค้า | Supplier/Customer/Subcontractor: scoped code, name, registrationNumber, contactName/email/phone/address; separate short name unsupported; preserve linked supplier/subcontractor identity |
| 03 ภาษีเครดิตบัญชีคู่ค้า | Registration fields partly available; tax/WHT/VAT, terms and AP/AR account mapping require Accounting scope; do not invent defaults |
| 04 ผู้ติดต่อคู่ค้า | Existing single contactName/email/phone; dedicated multi-contact detail/position/fax needs design |
| 05 บัญชีรับเงินคู่ค้า | Partner bank accounts and verification/history not implemented by HR private bank data |
| 06 หมวดวัสดุ | Material.materialCategory string; normalized category/code hierarchy, if needed, separately scoped |
| 07 หน่วยนับ | UnitOfMeasure: uomCode/uomName/decimalPlaces, scoped Company |
| 08 วัสดุ | Material: materialCode/materialName/description/defaultUomId/materialCategory/isActive |
| 09 คลังและจุดเก็บ | Warehouse: code/name/project/location/isSiteWarehouse, finer storage locations require design |
| 10 ยอดตั้งต้นวัสดุ | Canonical Warehouse/Material stock transaction workflow; opening import quantity/cost/date/source and approval not established, no direct balance mutation |
| 11 ทรัพย์สินและเครื่องมือ | Equipment, EquipmentType operational registry; accounting asset value/depreciation and asset-class fields separately scoped |
| 12 ผังบัญชี | Full GL/chart of accounts successor under #288, not existing |
| 13 ธนาคารบริษัท | Company bank master/account-type and controlled access require design |
| 14 สมุดเช็ค | Chequebook sequence/bank linkage and lifecycle require Accounting scope |
| 15 เครดิตเทอม | Credit terms master and linkage not implemented |
| 16 ยอดตั้งต้นบัญชี | GL opening balance workflow deferred; approval/cutoff/reconciliation required |
| 17 ยอดตั้งต้น AP AR | Existing SupplierInvoice/ClientInvoice/Payment allocation is operational lineage, not a generic opening-balance import; deferred Accounting design must prevent duplicates |
| 18 โครงการ | Project: companyId/projectCode/projectName/customerId/contractValue/currency/planned dates/location/status, extended fields separately map |
| 19 คำอธิบายช่อง | Field dictionary; import validation/design input |

## Employee workbook (7 worksheets)

| Sheet | Current canonical target / limitation |
| --- | --- |
| วิธีกรอกและเกณฑ์อ้างอิง | Instructions and confirmed reference rates |
| ทะเบียนพนักงาน | Employee/HrPerson/HrPersonLink/HrPrivateRevision/HrDocumentAttachment; private fields only through authorized HR services |
| การจ้างและค่าจ้าง | HrEmployment/HrEmploymentRevision plus encrypted private records where applicable; later payroll/effective rates separately scoped |
| เงินเพิ่มประจำ | Monthly allowance entitlement/effective-date successor; no current calculator |
| ยอดตั้งต้นกองทุน | Employee/employer aggregate verified opening values/cutoff; later welfare-fund ledger |
| ยอดตั้งต้นอื่น | Verified per-employee opening balances, category/cutoff/source; later HR/accountant-defined workflow |
| สิทธิ์และยอดลา | Later entitlement/usage/balance workflow; no synthetic creation of historical leave |

Before an actual import: approve field-level contract, required/optional values, Company scope, relationship resolution, duplicate handling, privacy/access, evidence, cutoff reconciliation, dry-run errors, audit and idempotency. Preserve canonical financial/stock/HR source history. Workbook completion is not authorization to import real MKE/TCJ data. No import runtime or new GL/payroll/Accounting scope authorized.
