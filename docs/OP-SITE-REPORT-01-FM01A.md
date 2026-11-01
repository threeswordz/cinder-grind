# OP-SITE-REPORT-01 / FM01-A — read-only weekly site summary

**Scope:** #301, owner authorized 31 October 2026 SGT. Base: main `cb6abf378e903aa5c5a60be3a3d3db54e8c430d3`. Independent of stock count #300/HR PR #297–299; Accounting remains deferred.

## Delivered contract
- `GET /site-execution/reports/weekly?projectId=<uuid>&from=YYYY-MM-DD&to=YYYY-MM-DD` uses the existing `AuthGuard + PermissionGuard + site.daily_report.view` and canonical persisted Company/Project membership.
- Exactly seven inclusive UTC calendar dates; source daily reports keep persisted DRAFT/SUBMITTED identity with dates and actor. Missing dates are UNKNOWN_WORKDAY_OR_HOLIDAY, **never** marked noncompliant/overdue without a separately approved work calendar.
- Day-level manpower, original Progress observations by Activity, issue/delay/inspection totals and original correction counts; report ID opens the existing authorized detail route with full correction, photo/document access. Do not sum incompatible quantity UOMs, percentages or observations into invented weighted Project progress.
- UI consumes shared EN/TH/zh-TW locale context. Read-only viewing only; Ben can review but there is **no approval or review acknowledgment state**.
- No database schema/migration; no new roles, grant changes or retained data; no posting or changes to Inventory/BOQ/Finance/HR.
- Automated pure contract and existing Project-access integration tests run under standard API pipeline. Source detail and document permissions remain authoritative.

## Separate future gates
FM01-B persistent Ben acknowledgment; FM01-C approved workday calendar, holiday exceptions and before-next-workday deadline; FM02 weighted progress; FM03 issue closure/escalation; FM04 material request; stock-count review under #300. None are implemented by this package.

## Technical / human gates
Normal exact-head CI, focused Chat review, PR merge governance, exact-main CI, and changed-path Owner business acceptance remain separate. No old THB/BOQ UAT repetition, no self-approval, Production deployment or runtime role/data changes.
