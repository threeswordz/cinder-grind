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
