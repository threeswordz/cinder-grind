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

## DEC-011 — V0.2-D Gantt / Lookahead presentation rules
**Status:** APPROVED — 2026-09-26

The V0.2-D Gantt / Lookahead stage uses the following approved presentation rules:

1. **Read-only schedule mutation through Gantt**
   - Frappe Gantt may provide pan/scroll, Day/Week/Month view switching, row selection and Activity detail presentation.
   - drag/resize interactions must not directly mutate Activity dates or dependencies in V0.2.
   - schedule mutations continue through ERP-controlled Activity/dependency APIs.

2. **Current schedule presentation**
   - primary current Gantt bars use backend current forecast dates.
   - explicit Activity forecast dates take precedence where present.
   - otherwise the Stage B calculated forecast is used.

3. **Baseline presentation**
   - the current approved baseline is the comparison reference.
   - historical baseline versions remain available through baseline history.
   - when no approved baseline exists, current schedule presentation remains available and baseline comparison is reported unavailable.

4. **Lookahead windows**
   - 2-week lookahead is 14 calendar days.
   - 4-week lookahead is 28 calendar days.
   - the selected As-of date and final window date are inclusive.
   - Activity working calendars continue to govern Activity schedule calculations; the lookahead window itself is calendar-day based.

5. **Lookahead inclusion**
   - include an Activity when its current forecast span overlaps the selected window.
   - include a milestone when its current forecast date falls inside the window.
   - 100%-complete Activities are not silently removed.

6. **Backend-derived indicators**
   - Critical comes from Stage B CPM / Total Float.
   - Delayed / On Time / Ahead comes from Stage C current-baseline comparison.
   - the Gantt/lookahead UI does not recalculate scheduling, criticality or delay.

Frappe Gantt remains a replaceable MIT/open-source visualization layer. Backend/domain scheduling ownership and DEC-008 remain unchanged.

## DEC-012 — V0.2-E Site Execution rules
**Status:** APPROVED — 2026-09-26

The V0.2-E Site Execution stage uses the following approved rules:

1. **Daily Report identity**
   - one canonical Daily Site Report exists per Project + reporting date in V0.2.
   - Project/date uniqueness is enforced.
   - linked Activities, WBS and Documents remain within the same authorized Project.

2. **Daily Report lifecycle**
   - lifecycle is `DRAFT → SUBMITTED`.
   - submission is an operational finalization action and does not use the Approval Matrix.
   - submitted report content is not silently overwritten; historical corrections are retained explicitly where applicable.

3. **Activity Progress**
   - Daily Report progress updates append to the existing immutable Activity Progress history using the report date.
   - Daily Reports never mutate Schedule Baseline rows.
   - corrections create later progress entries and do not edit/delete earlier history.

4. **Manpower**
   - manpower is recorded as aggregated trade/role/category + headcount + optional remarks.
   - individual attendance/payroll is outside V0.2-E.

5. **Material usage**
   - material-use lines reference valid Material master data, quantity/UOM and optional Activity/WBS context.
   - these are field observations only.
   - they do not post Inventory transactions or change Stock Balance.

6. **Equipment dependency**
   - V0.2-E does not create free-text Equipment or duplicate an Equipment master.
   - SITE-005 is completed against the canonical Equipment Register in V0.2-F.
   - Stage E may expose the integration boundary but Equipment usage becomes selectable only when Stage F exists.

7. **Weather / issues / delays / inspections**
   - weather is recorded locally; no external weather service is required.
   - site issues and delay observations may optionally reference an Activity.
   - delay observations provide explanatory context only and do not move schedule dates or override backend delay classification.
   - inspections are lightweight Daily Report records/references, not a full QA/QC workflow.

8. **Site photographs**
   - photographs/files use the existing Documents storage abstraction and generic document-link metadata.
   - file bytes remain outside PostgreSQL.
   - physical storage paths are never exposed to the browser.

Project-scope authorization, audit controls, DEC-008 and existing scheduling ownership remain unchanged.

## DEC-013 — V0.2-F Equipment rules
**Status:** APPROVED — 2026-09-26

The V0.2-F Equipment stage uses the following approved rules:

1. **Equipment identity / ownership**
   - Equipment is Company-owned master data.
   - Equipment has a Company-unique code, name, Equipment Type, operational status, optional description and active/inactive lifecycle.
   - deactivation does not delete assignment or usage history.

2. **Equipment Type**
   - Equipment Type is a configurable Company register with code, name and active/inactive lifecycle.
   - active Equipment must reference an active Equipment Type when creating/changing type.
   - historical Equipment remains readable if its Type is later deactivated.

3. **Operational status / derived availability**
   - operational status is `AVAILABLE` or `UNAVAILABLE`.
   - Project assignment is independent of operational status.
   - displayed availability is derived: inactive or operationally unavailable → `UNAVAILABLE`; otherwise effective open Project assignment → `ASSIGNED`; otherwise → `AVAILABLE`.
   - availability is a read model and is not persisted as a second source of truth.

4. **Project assignment history**
   - assignment records contain Equipment, Project, assigned-from date, optional assigned-to date and optional remarks.
   - at most one open assignment may exist for an Equipment item.
   - reassignment/release closes the previous assignment and retains history.
   - Projects must belong to the same Company.
   - changing operational status does not automatically close assignment history.

5. **Equipment Usage**
   - canonical usage contains Equipment, Project, usage date, optional operating hours and optional Activity/WBS/remarks context.
   - operating hours are optional; when supplied they must be > 0 and <= 24.
   - Activity/WBS references must belong to the same Project.

6. **Assignment requirement for usage**
   - usage requires an Equipment assignment to the same Project covering the usage date.
   - new usage cannot be recorded while Equipment is inactive or operationally unavailable.
   - later status changes do not erase historical usage.

7. **Daily Site Report integration**
   - Daily Site Report Equipment lines reference the canonical Equipment Register only; no free-text Equipment.
   - Equipment must be assigned to the report Project on the report date.
   - report submission materializes lines into canonical Equipment Usage with source traceability.
   - submitted Daily Site Report Equipment data follows the existing immutable/correction model.

8. **Usage history / corrections**
   - Equipment Usage history is retained chronologically.
   - manual usage may be audit-updated in V0.2 but is not physically deleted through ordinary APIs.
   - Daily Site Report-origin usage is immutable after submission; corrections append through the submitted-report correction path.

EQP-008 Maintenance Records remains Future. EQP-009 Equipment Cost Allocation remains V0.7 Cost Control. No fuel, meter/odometer, depreciation, ownership/lease accounting, asset accounting, Inventory posting, paid dependency or V0.3+ scope is introduced.
