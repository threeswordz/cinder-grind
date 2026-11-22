# FM01 calendar-aware weekly workday preview — technical slice only

**Source authority:** [FM01](ROLE-REQUIREMENTS-2026-10-30/06-foreman.md) and [FM01-A](OP-SITE-REPORT-01-FM01A.md). No new Product Owner calendar assumptions, Production access, DB migration, approvals, grants, retained data, or Mac run.

## Exact implemented scope

- Existing authenticated Project-scoped `GET /site-execution/reports/weekly` now adds `workCalendarPreview` beside the immutable FM01-A day/report summary.
- Derive day types from a **currently active, explicitly default** Project WorkingCalendar (project-specific wins) or unambiguous Company-wide default. Use the existing Scheduling `weekdayNo=1 Monday..7 Sunday`, dated working exceptions and configured IANA timezone. Do not assume Thai holiday dates or Mon–Fri from unstated policy.
- Report view labels planned workdays, planned off-days, and unknown; planned missing days are flagged only as **current-configuration report expectations**. A reporting due date/time is the **next configured working day's local start**, not midnight or a guessed fixed business hour. Calendar without a configured shift start shows unknown time. A planned off-day does not require a no-work report by default.
- Missing, ambiguous, malformed and incomplete calendars fail closed with an unknown workday status and no invented deadline. Nonmatching, inactive, and cross-Project configurations do not grant scope.
- Source report submission, corrections, ActivityProgress, document custody, approval history, Inventory, BOQ, Finance and HR are unchanged. UI includes EN/TH/Traditional Chinese labels.
- **A current mutable calendar is NOT an immutable historical compliance schedule.** All `timeliness` values are `NOT_ASSESSED`. This preview never labels a report historically late or applies a hard submission block.

## Focused proof

[GitHub focused run #45029666209](https://github.com/threeswordz/cinder-grind/actions/runs/45029666209) ran seven pure calendar/exception/invalid-scope negative tests (7/7 PASS), generated the Prisma client and typechecked both API and web. No full CI, database migration, disposable PostgreSQL, browser, Mac or Production execution. Temporary CI workflow removed from reviewed tree.

## Still missing before FM01 business requirement can be closed

1. Canonical and reasoned **planned-workday no-work** declaration, with an append-only correction/actor history that distinguishes approved stoppage from ordinary off-day.
2. Persistent **Ben review acknowledgment** on weekly source snapshot (NO formal approval, no self-confirmation), Project/Company authorization and stale evidence checks.
3. An immutable version/effective-dated calendar decision at reporting time before an official **before-next-workday deadline/late** decision is enforceable. Current-calendar preview alone is NOT that proof.
4. Independent review, integrated guarded release CI and single integrated human prototype UAT under DEC-042. Do not claim FM01 or Milestone M4 closed on this partial slice.

Existing FM01-A weekly summary remains complete; avoid rebuilding it. This slice is useful separately but is **not** a waiver for unfinished FM01-B/C.

## Subsequent bounded FM01 operational implementation — review-only, not an approved release

**New source on the isolated FM01 branch; this section supersedes the preview-only
scope statement above for the added routes only.** It does not turn the original
read-only preview or a missing day into an overdue/approved report.

### Canonical business behavior

- A saved `DRAFT` Daily Site Report's **original preparer** must hold the
  `PROJECT_ENGINEER` role and `site.daily_report.edit` and
  `site.daily_report.submit` permissions before recording a planned no-work day.
  The authoritative active default Project calendar, or valid Company fallback,
  must identify that exact date as a **planned workday**, never an ordinary
  off-day or ambiguous calendar. Existing work, material, manpower, progress,
  equipment and inspection rows bar a no-work declaration.
- `POST /site-execution/reports/:id/no-work` appends a scoped, reasoned event
  to the existing Company-level `audit_logs` record, with immutable calendar
  ID, timezone, source date, next configured shift start and a complete
  calendar fingerprint. The report can then follow its existing submit path,
  while substantive work postings stay prohibited. No new table/migration.
- Once submitted, the original authorized Foreman may add a reason correction
  through `POST /site-execution/reports/:id/no-work/corrections`. It appends
  an event carrying the prior reason and actor/time, never overwrites the
  original declaration or prior report. Progress/equipment corrections are
  blocked on a no-work source; ordinary Daily Reports keep existing behavior.
- `GET /site-execution/reports/weekly` adds the current no-work evidence,
  a SHA256 fingerprint of the exact scoped seven-day report versions,
  corrections, work calendar and linked document identities, and any
  prior reviewer event. A changed source results in **STALE** review, not an
  invalidation/deletion or a carried-forward approval.
- A user holding both the `MANAGEMENT` role and
  `site.daily_report.view`, independently authorized for the Project
  and not the creator/corrector of that week's source reports, may call
  `POST /site-execution/reports/weekly/acknowledge` with the **current
  exact-source hash**. Append one read-only `REVIEW_ACK` audit event per
  source version. Never issue a source-work approval, Project progress
  confirmation, certificate, payment, BOQ or inventory adjustment from
  an acknowledgment. SYS_ADMIN is not an alternate Ben.
- All mutations require authenticated, CSRF-guarded API permissions; domain
  permission checks, active Employee/Project access and original-preparer or
  independent Management separation are enforced on the server. Source and
  event checks run in serializable transactions. Existing audit history is
  append-only.

### Boundaries before actual technical acceptance

- The current calendar is mutable and historical effective-dated calendar
  approval is not yet demonstrated. `historicTimeliness: NOT_ASSESSED`
  remains mandatory. The source captures the current schedule evidence,
  but **does not enforce or claim historical before-next-workday submission
  compliance**; that FM01-C exit remains open.
- The new operations have initially been tested through pure source/audit
  contracts, API/web typechecking and independent review. Actual isolated
  DB-level optimistic/serializable race and multi-role browser evidence remain
  required before declaring the FM01 operational package fully accepted.
  No retained grant, populated data, final human UAT, Production or 5/8
  milestone is accepted by this development branch.
- Keep Owner's CI emergency restriction from #384: use focused development
  checks; do not move a full-release PR to Ready or cause another expensive
  full suite without specific Owner approval. Original accepted FM01-A and
  Mac workflows are not rerun. This is a standalone non-Production technical
  implementation, not a new business policy.
