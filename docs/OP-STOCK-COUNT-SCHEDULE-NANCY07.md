# NANCY-07 / SS12 / PM08 — per-site, per-material-category count schedules

**Source:** DEC-047 Owner confirmed 16 Nov 2026, `docs/ROLE-REQUIREMENTS-2026-10-30/15-owner-decisions-2026-11-16.md`.

## Authority and scope
Nancy (`FINANCE_MANAGER`) sets the physical stock-count schedule separately for each active site warehouse and its associated Project. This is distinct from the actual physical count and quantity adjustment (Store Site captures evidence; Khaimook approves via existing `StockCountService`) and distinct from any financial disposal/write-off. No schedule creates a count, reserves stock, adjusts a ledger, accepts a variance, approves a disposal, or calculates costs.

The schedule is defined by an **explicit** material category (exact active Material master category, or null for currently unclassified Materials), explicit first due **calendar date** (`YYYY-MM-DD`), explicit positive repeat interval in calendar days, ACTIVE/PAUSED and a reason. These are inputs, **not** a presumed 7/14/30-day business rule or global default. `asOfDate` for reading the next due date is also explicitly supplied. No time-of-day, cron, automatic reminder or automatic proof-of-count is implied. The engineering limit of 3650 days prevents unreasonable date arithmetic; it is not a business policy frequency.

## API (isolated Draft, not in main)
- `GET /inventory/stock-count-schedules/projects/:projectId/sites/:warehouseId?asOfDate=YYYY-MM-DD`: current schedules and next due dates by category, with paused categories visible but no due date. Store Site, Khaimook and Nancy may read only with current `inventory.stock_count.view`, active role + employee, Company/Project access.
- `POST /inventory/stock-count-schedules/projects/:projectId/sites/:warehouseId`: Nancy (`FINANCE_MANAGER` only) configures the category, firstDueDate, intervalDays, ACTIVE/PAUSED status and reason with `expectedPreviousEventId` (null for first configuration). Existing `inventory.stock_count.view` permission is required; **no `inventory.stock_count.approve` grant is added to Nancy**.

For every write, the server re-checks current session, live active employee, role grant, Project scope, active site Warehouse and material category. Changes append causal `STOCK_COUNT_SCHEDULE/SET` audit events bound to the actual Warehouse UUID, Company and Project. Each category increments an immutable version with an explicit previous event ID. The mutation obtains a per-category advisory lock inside Prisma Serializable, rejects stale expected IDs, missing history, a fork, altered scope and corrupted dates. No new database table, migration, role grant or generic SYS_ADMIN bypass.

## Evidence limitations / necessary verification
This is an **operational schedule configuration candidate**, not the financial disposal/write-off workflow. Exact code permissions must be independently reviewed; retained role configuration must be verified by a permitted operator. The current Stock Count route remains canonical for evidence, submit, physical variance and independent quantity adjustment; it is not reimplemented here. No automatic classification of completed StockCounts against due dates is claimed. Physical source counts are not used to prove schedule compliance.

Before M4 acceptance: focused calendar/audit tests and API typecheck; native Postgres concurrent schedule update/revoked-role/bad Project/site/category checks; simple browser Store/Nancy/Khaimook display; independent exact-head Codex; single governed stable M4 integration candidate. Do not rerun accepted stock count, FM02, receiving, transfer, FM03, BOQ, UOM or Mac journeys. Do not mark Ready, merge, deploy or start a full release suite without the Owner's specific authorization.

**Remaining SS13/C03:** Store loss/damage/waste record, Khaimook severity screen, Nancy approval of disposal and financial effect. The required financial valuation/posting still needs an explicit separate design under Accounting #288. Scheduling does not implicitly authorize financial postings.
