# Construction ERP — Decision Log

This log records durable architecture and business-policy decisions. Live GitHub state remains authoritative for implementation status.

## DEC-001 — Modular Monolith
**Status:** APPROVED

Use a modular-monolith architecture. Do not introduce microservices without a genuine requirement and approved change control.

## DEC-002 — PostgreSQL + Prisma
**Status:** APPROVED

PostgreSQL is the canonical relational database and Prisma is the approved ORM/migration layer.

## DEC-003 — Activity terminology
**Status:** APPROVED

`Activity` is the canonical technical/database/API term. `Task` may be used only as a UI/business synonym. Do not create separate Activity and Task entities.

## DEC-004 — WBS and Cost Code are independent
**Status:** APPROVED

WBS identifies where work/cost occurs. Cost Code identifies the nature/type of cost. Cost Code is not a child of WBS.

## DEC-005 — Project scope authorization
**Status:** APPROVED

Project-scoped access is derived from User → optional active Employee link → active Project Member → Project. `projects.access_all` bypasses assignment filtering only and does not grant edit, approval, Finance, Procurement or other business authority.

## DEC-006 — Technical administrator separation
**Status:** APPROVED

System Administrator is a technical/admin role and must not automatically gain business approval authority. Business authority comes from explicit permissions/configured approval roles.

## DEC-007 — Project creation access policy
**Status:** APPROVED — Option A

A user who has `projects.project.create` but does not have `projects.access_all` must be linked to an active Employee. Project creation atomically includes that Employee in the initial Project Team as `Project Creator`, ensuring the creator retains project-scoped access. Users with `projects.access_all` do not require automatic creator membership. The `Project Creator` membership label grants no additional permission or business approval authority by itself.


## DEC-008 — Open-source / zero-cost-first runtime constraint
**Status:** APPROVED

The Construction ERP is open-source-first and zero-cost-first. Do not introduce a mandatory paid runtime, cloud service, hosted identity provider, database, storage service, commercial library or recurring subscription unless the Product / Business Owner explicitly approves changing this constraint and the change is recorded before implementation.

When technically practical, use existing owned hardware/resources before proposing paid infrastructure. Optional paid services may be discussed only as clearly labeled alternatives, never as the default architecture.

A casual request or implementation convenience does not silently supersede this decision. Conflicts must be surfaced and resolved through explicit change control.


## DEC-009 — V0.2 Scheduling calculation rules
**Status:** APPROVED — 2026-09-26

The V0.2 Scheduling Engine uses the following approved calculation conventions:

1. **Work-day duration:** `1.0` work day means one full working interval according to the Activity's assigned Working Calendar. Fractional durations consume the corresponding fraction of the applicable working interval.
2. **Dependency lag calendar:** dependency lag is evaluated using the successor Activity's Working Calendar.
3. **Negative lag / lead:** signed lag is allowed; a negative lag represents lead time.
4. **Milestones:** a milestone has `0` work-day duration and planned start equals planned finish.
5. **Critical Path / Total Float:** use a standard CPM forward/backward pass with working-calendar-aware Activity dates and dependency constraints. Activities with Total Float = 0 are critical. The Project finish anchor is the latest calculated eligible Activity finish.
6. **Calendar precedence:** each Activity's explicitly assigned Working Calendar governs calculations. A Project/company default calendar supplies a default selection when creating an Activity but does not override an explicitly assigned Activity calendar.

These rules are backend/domain scheduling rules. Frappe Gantt remains a replaceable visualization layer and does not own schedule calculations.


## DEC-010 — V0.2 Baselines / Progress rules
**Status:** APPROVED — 2026-09-26

The V0.2-C Baselines / Progress stage uses the following approved rules:

1. **Baseline approval uses the existing configurable Approval Matrix**
   - Schedule Baseline entity type is `SCHEDULE_BASELINE`.
   - approver Roles remain configurable, not hard-coded.
   - existing maker-checker control applies.
   - System Administrator is not an implicit business approver.

2. **Approved baselines are immutable and versioned**
   - initial baseline is Version 1.
   - an authorized rebaseline creates Version N+1.
   - the new version requires approval again.
   - previous approved versions remain immutable and retained for history.
   - one approved version is current for Project comparison.

3. **Baseline snapshot content**
   - snapshot every active Activity in the Project at submission.
   - capture Activity identity, WBS reference, milestone/summary flags, planned duration and Stage B calculated planned start/finish.
   - Activities added later have no row in older baseline versions.
   - actual and forecast values are not copied into baseline snapshots.

4. **Activity Progress history**
   - progress range is 0–100%.
   - progress entries are append-only history.
   - current percent complete is the latest entry.
   - decreases are allowed as explicit corrections; prior history is retained.
   - Stage E Daily Site Reports may add progress entries later using the same history.

5. **Actual dates remain explicit**
   - percentage complete does not automatically create or change actual start/finish.
   - Activity and Project actual dates remain separate from planned/baseline/forecast.
   - actual finish must not be earlier than actual start.

6. **Delay calculation**
   - compare current forecast finish against the current approved baseline finish.
   - explicit Activity forecast finish takes precedence when present; otherwise use Stage B calculated forecast finish.
   - delay is measured in working days using the Activity's assigned Working Calendar.
   - delay > 0 = delayed; 0 = on time; delay < 0 = ahead.
   - without a current approved baseline, delay classification is unavailable and delay work days is null.

These rules preserve the existing approval framework, Project-scope authorization and backend-owned scheduling architecture.
