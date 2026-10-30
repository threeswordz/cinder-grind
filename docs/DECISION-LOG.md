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


## DEC-014 — V0.5 Subcontracts release entry baseline
**Status:** APPROVED — Product / Business Owner, 2026-09-29 (Singapore time)

In response to the request to review and explicitly approve or amend the V0.5 scope, AC-V05-001–030, BR-V05-01–20 / D05-01–11, data/API/test baselines, stages, estimates and deferrals, the Product / Business Owner stated: “proceed with next step , done on all these following” and listed those baseline items. No amendments were specified. Record this as approval of the exact proposal package merged through PR #100 and clarified through PR #101, without expanding its scope.

The approved authority is `docs/V0.5-SCOPE.md`, `docs/V0.5-ACCEPTANCE-CRITERIA.md` and `docs/V0.5-BUSINESS-RULES.md`. D05-01–11 are approved as written, including Company-owned Subcontractor identity, the numbering/lifecycle/ceiling/claim/certification/retention/Variation/reporting choices and the agreement currency with tax-exclusive amount basis. The approved data/API/test boundary, stages, 19–29 engineering-day planning estimate plus separate 1–2 business-day human acceptance window, and explicit deferrals are also accepted.

No SUB-011, DOC-009, retention release, Finance payment/accounting, tax/FX or cost recognition is authorized. Committed Cost, Actual Cost and Paid Cost remain separate. DEC-008 remains in force. This decision authorizes V0.5-A pre-flight only after its entry-gate PR passes exact-head CI/review, merges, post-merge `main` CI passes and Issue #98 closes. Every stage retains its own completion gates, and V0.5 Release Exit requires separate human UAT and explicit Product / Business Owner acceptance.

## DEC-015 — One-time V0.5-B Codex review waiver
**Status:** APPROVED — Product / Business Owner, 2026-09-30 (Singapore time)

The Product / Business Owner explicitly instructed: “proceed safely without codex review , do it” for V0.5-B PR #106 after the required Codex review bot could not execute because its code-review usage quota was exhausted.

This approval is a **one-time stage-gate waiver for PR #106 only**. It does not remove or weaken the repository's normal review expectations for later stages or releases, does not waive exact-head CI, PR CI, post-merge `main` CI, issue closure, or any human UAT/business acceptance gate, and does not alter DEC-008 or the approved V0.5 scope/deferrals.

The waiver is permitted only because:
- exact-head branch CI #1732 passed on `faafa48c5b50a037de37185e011b0da5b7e9c46f`;
- PR CI #1733 passed on the same head;
- PR #106 is mergeable/clean;
- there are no unresolved review threads or submitted review findings;
- the missing review is caused by external Codex review quota, not by a known application defect.

Before merge, this Decision Log entry and affected Stage-B status documentation must themselves pass exact-head CI/PR CI. PR #106 must still be squash-merged and post-merge `main` CI must pass before Issue #105 closes and V0.5-C begins.

## DEC-016 — Chat / Work / GitHub development operating model
**Status:** APPROVED — Product / Business Owner, 2026-09-30 (Singapore time)

The Product / Business Owner approved the repository operating model documented in `docs/DEVELOPMENT-OPERATING-MODEL.md`:

- **Chat = Builder / Release Coordinator** for live GitHub checks, stage implementation, CI fixes, merge-conflict resolution, focused review, PR/merge operations, acceptance-criteria verification and release checkpoint maintenance.
- **GitHub = durable source of truth** for implementation state, repository history, issues, branches, PRs, commits, decisions and CI evidence.
- **CI/tests = technical evidence** and do not replace human UAT/business acceptance.
- **Product / Business Owner = scope/business authority** for explicit approval-gated decisions, Change Control and required human UAT/business acceptance.
- **Work = periodic independent auditor** for repository-wide architecture, security/technical debt, cross-release documentation, final-system and production-readiness analysis.

One active implementation writer should normally modify a stage branch at a time. New implementation sessions must bootstrap from live GitHub before material writes. Work is audit-first by default; its findings should normally be recorded durably and implemented by Chat through the normal CI/PR/merge flow.

This decision changes delivery tooling/role allocation only. It does not alter release-stage sequencing, review requirements, exact-head/PR/post-merge CI gates, human UAT, DEC-008, approved scope/deferrals, Project security rules or Change Control. DEC-015 remains limited to PR #106 only.



## DEC-017 — V0.6 Finance release entry baseline
**Status:** APPROVED — Product / Business Owner, 2026-10-01 (Singapore time)

The Product / Business Owner approved the V0.6 Finance Release Entry Gate proposal in two explicit steps:

1. In response to the request to approve the proposal package at exact head `e71f64cd03f61ddeee7de4e034def0da0ca6907c`, the owner replied **“ok”**, approving the then-present V0.6 scope/exclusions, AC-V06 baseline, BR-V06-01–20, D06-01–13, data/API/security/audit/concurrency/testing/dependency baselines, V0.6-A–E stages, estimates and deferrals.
2. The final exact-head Codex review then identified three additional P1 Finance-handoff boundaries. After those were surfaced as D06-14–16 / AC-V06-022A–022C, the owner explicitly stated **“Approve D06-14, D06-15 and D06-16 as proposed”**.

The approved V0.6 entry baseline therefore includes D06-01–16 and the corresponding acceptance criteria, including:
- ordinary Subcontract Certification Payment allocations are capped at V0.5 `net_certified_amount`; withheld retention is not payable through that ordinary path;
- a V0.5 certification whose currency differs from Company base currency is rejected/deferred from Finance handoff with no conversion or numeric reinterpretation until approved FX/multi-currency Change Control exists;
- certification reversal is blocked while active Finance Payment allocations remain; after Finance cancellation clears those allocations, **if a linked Finance retention-withholding entry exists, the certification reversal must atomically create its linked compensating reversal**. That correction is mandatory when applicable and is not a retention release/payout.

This decision does **not** authorize implementation by itself. PR #116 must still pass exact-head CI and required review, the Codex findings must be resolved, the PR must merge, post-merge `main` CI must pass, and Issue #115 must close before V0.6-A implementation may start.

DEC-008 open-source/zero-cost-first, DEC-016 operating model, backend authorization, maker-checker separation, forward-only migrations, audit immutability, Change Control and required human UAT/business acceptance remain unchanged.


## DEC-018 — V0.6 Supplier Invoice Project boundary
**Status:** APPROVED — Product / Business Owner, 2026-10-01 (Singapore time)

A later exact-head Codex review of the V0.6 Finance entry package identified an ambiguity when one Supplier Invoice contains lines for multiple Projects: header-level Supplier Payment allocations cannot unambiguously attribute a partial settlement to each Project, and Project-scoped AP/invoice visibility could expose values belonging to another Project.

The Product / Business Owner explicitly stated: **“Approve D06-17 as proposed.”**

The approved V0.6 rule is therefore:
- exactly one Project per Supplier Invoice;
- every Supplier Invoice line and any linked PO/GR source must belong to that same Project;
- Supplier Payment allocations, AP visibility and Project cash-flow attribution for that invoice inherit the same Project;
- cross-Project Supplier Invoices are rejected/unsupported in the initial V0.6 baseline;
- because D06-01 keeps supplier reference unique per Company+Supplier, the same external supplier invoice must not be silently split into multiple internal invoices merely to bypass this rule;
- support for true multi-Project Supplier Invoices requires explicit Change Control defining line-level settlement/proration and Project-visibility behavior.

This decision supplements DEC-017 and does not reopen any previously approved V0.6 boundary. It does not authorize implementation by itself. PR #116 must still pass exact-head CI/review, merge, pass post-merge `main` CI and close Issue #115 before V0.6-A implementation begins.


## DEC-019 — V0.6 Payment Project boundary
**Status:** APPROVED — Product / Business Owner, 2026-10-01 (Singapore time)

A later exact-head Codex review of the V0.6 Finance entry package identified a Payment-level Project visibility ambiguity: one Payment could otherwise allocate to targets in multiple Projects even though the Payment header had no Project, creating cross-Project visibility and Project cash-flow attribution risk.

The Product / Business Owner explicitly stated: **“Approve D06-18 as proposed.”**

The approved initial V0.6 rule is therefore:
- exactly one Project per Payment;
- the Payment records that Project explicitly;
- every Supplier Invoice, Client Invoice or Subcontract Certification allocation from that Payment must belong to the same Project, in addition to the approved Company/direction/counterparty/base-currency rules;
- multi-target allocations remain allowed only within that one Project;
- cross-Project and Company-level/non-project Payments are rejected/unsupported in initial V0.6;
- support for cross-Project or Company-level/non-project Payments requires explicit Change Control defining scoped/redacted Payment representation, allocation visibility and Project cash-flow behavior.

This decision supplements DEC-017 and DEC-018 and does not reopen any previously approved V0.6 boundary. It does not authorize implementation by itself. PR #116 must still pass exact-head CI/review, merge, pass post-merge `main` CI and close Issue #115 before V0.6-A implementation begins.


## DEC-020 — V0.6 Payment Project cash-flow attribution
**Status:** APPROVED — Product / Business Owner, 2026-10-01 (Singapore time)

A later exact-head Codex review identified a contradiction between approved D06-18 / DEC-019 Payment Project ownership and the older rule that unallocated Payment amounts were not Project-attributed.

The Product / Business Owner explicitly stated: **“Approve D06-19 as proposed.”**

The approved V0.6 rule is therefore:
- every final approved, non-cancelled Payment contributes its full amount to Project Cash Flow against its required `payments.project_id` on the Payment date;
- OUTBOUND Payments are Project cash outflows and INBOUND Payments are Project cash inflows;
- the rule applies even when a Payment is partially or wholly unallocated;
- Payment allocation rows govern Supplier/Client/Subcontract settlement, AP/AR linkage and traceability, and must not duplicate or reduce the Payment's Project cash-flow amount;
- any unallocated balance remains visible as an unallocated settlement state within the same Project;
- Draft, submitted, rejected and cancelled Payments do not contribute to Project Cash Flow.

This decision supplements DEC-017, DEC-018 and DEC-019. It does not authorize implementation by itself. PR #116 must still pass exact-head CI/review, merge, pass post-merge `main` CI and close Issue #115 before V0.6-A implementation begins.


## DEC-021 — PR #116 one-time Codex review waiver
**Status:** APPROVED — Product / Business Owner, 2026-10-01 (Singapore time)

After all surfaced PR #116 Codex findings had been addressed and all review threads resolved, a final exact-head Codex review was requested on `0863366e6c6245744131478a87f7cbeec7bf4c0b`. Codex returned a usage-limit message instead of a review verdict.

The Product / Business Owner explicitly stated:

**“I approve a one-time Codex review waiver for PR #116 only and authorize merge based on the completed CI, resolved review threads and documented review evidence.”**

Evidence at the waived merge gate:
- exact-head push CI #2076 passed;
- exact-head PR CI #2077 passed;
- unresolved review threads were zero;
- PR #116 was mergeable;
- all V0.6 owner decisions D06-01–19 were approved and recorded through DEC-020;
- PR #116 changed documentation/baseline files only and introduced no application implementation, migration, UI code or runtime dependency;
- prior Codex findings were individually addressed and resolved.

PR #116 then squash-merged as `7d2ebc95fbc8eaacb6843bfe2cff277f69d73e89`, and post-merge `main` CI #2078 passed. Issue #115 closed completed.

This waiver:
- applies **only** to PR #116;
- does not reuse or extend DEC-015;
- is not a standing precedent or reusable waiver for later PRs;
- does not weaken DEC-008, DEC-016, Change Control, forward-only migration rules, security/project-scope rules, or CI requirements;
- does not waive any later mandatory human UAT or Product / Business Owner release acceptance gate.

## DEC-022 — Codex review economy / stable-merge-candidate policy
**Status:** APPROVED — Product / Business Owner, 2026-10-02 (Singapore time)

The Product / Business Owner explicitly approved making the recommended Codex-efficiency approach permanent and instructed that GitHub be documented after checking the live project position.

The approved policy is:
- Chat and CI/tests remain the continuous development, focused-review and defect-fixing loop while a branch is actively changing.
- Codex is a scarce independent review gate and should not be repeatedly triggered on unstable intermediate heads or after each individual fix.
- The normal first Codex review occurs only when the PR/stage is a stable merge candidate with applicable CI green and known Chat findings resolved.
- Genuine Codex findings are batched, fixed with regression coverage where applicable, and validated by CI before a further review request.
- A batched final re-review is required when those fixes materially change reviewed runtime behavior or touch authorization, permissions, Finance/payment/accounting, migrations, audit/history immutability, concurrency or data-integrity surfaces. Additional review passes occur only when a later review finds a distinct genuine blocker or a subsequent material change invalidates prior evidence.
- A clean Codex review is not invalidated merely because later commits change documentation/evidence only and do not alter reviewed runtime behavior, schema, security boundaries or business rules.
- Low-risk documentation-only PRs normally require Chat review + CI, not Codex, unless another approved stage/release gate explicitly requires it.
- High-risk implementation PRs still require Codex at the stable merge candidate unless the Product / Business Owner grants an explicit PR-specific waiver that is recorded durably.
- Work remains the periodic independent broad auditor; this policy does not transfer implementation ownership to Work.
- Human UAT/business acceptance, Change Control, DEC-008, forward-only migrations, one-active-writer guidance, predecessor-stage sequencing and exact-head/PR/post-merge CI requirements remain unchanged.

### Application to V0.6-B at approval time

Live GitHub was checked before this decision was recorded. PR #122 (`V0.6-B Client Invoice and derived AP-AR`) was open and mergeable at head `10e0b7257bf803d7e368bb10311c1e070cde92a5`. CI #2326 passed on that head, all 29 review threads were resolved, and the Codex timeline recorded: “Codex Review: Didn't find any major issues.” for reviewed commit `10e0b7257b`.

Therefore the V0.6-B Codex gate is satisfied at that exact reviewed head. This separate governance/documentation change does not modify PR #122 and does not invalidate that clean review. If PR #122 later receives a material code/schema/security/business-behavior change, DEC-022 requires the appropriate stable-head re-review before merge.


## DEC-023 — V0.6 one-time human-UAT execution waiver
**Status:** APPROVED — Product / Business Owner, 2026-10-03 (Singapore time)

At the V0.6 Finance Release Exit Gate, after V0.6-A through V0.6-E were technically complete, PR #132 was merged, Issue #130 was closed, and merged-main technical/runtime evidence was green, the Product / Business Owner explicitly instructed:

**“make exception , review on my behalf and let me know the result”**

This is a **one-time V0.6 Release Exit exception only**. For AC-V06-037, the Product / Business Owner waives the requirement to personally execute the prepared hands-on human walkthrough and authorizes Chat, acting as Builder / Release Coordinator, to perform a proxy evidence review against the prepared V0.6 UAT criteria and merged-main runtime/CI evidence.

This exception does **not** claim that the Product / Business Owner personally performed human UAT. AC-V06-037 may be recorded only as **WAIVED BY OWNER / PROXY EVIDENCE REVIEW PASS** if the proxy review finds no blocking business defect.

Proxy review result:
- Supplier Invoice → approval → PO/GR source traceability: PASS;
- Client Invoice → approval → derived AR: PASS;
- Payment → allocation → AP/AR → controlled cancellation/history: PASS;
- Subcontract Certification → Finance reference / payable-retention visibility: PASS;
- Finance Reports → derived Project Cash Flow, allocation independence and Payment-date filtering: PASS;
- Project/Finance permission boundaries and technical SYS_ADMIN separation: PASS;
- V0.6 cost/accounting exclusions and V0.7 boundary: PASS;
- blocking business defects found: **NONE**.

Supporting evidence includes merged-main CI #2401 with 55 authenticated current-release checks, release-exit main CI #2405 PASS, clean migration/status and Prisma validation, production dependency audit, API/web typecheck/test/build, prior-release regression, final Stage-E Codex review closure and the prepared `docs/V0.6-UAT-EVIDENCE.md`.

AC-V06-038 explicit release acceptance is supported by the Product / Business Owner's earlier statement **“i approve”** at Issue #133 and this explicit one-time exception instruction. V0.6 release closure is authorized only after this Decision Log / acceptance-evidence change itself passes exact-head branch CI, PR CI, merges to `main`, post-merge `main` CI passes and Issue #133 is closed.

This waiver:
- applies only to V0.6 AC-V06-037;
- is not a standing precedent for V0.7, V0.8, V1.0 or later releases;
- does not change DEC-008;
- does not transfer Product / Business Owner authority to Chat generally;
- does not weaken technical CI, security, review, forward-only migration or Change Control requirements;
- does not permit a future human-UAT gate to be auto-completed without a new explicit Product / Business Owner exception.


## DEC-024 — V0.7 Cost Control release entry baseline
**Status:** APPROVED — Product / Business Owner, 2026-10-03 (Singapore time)

Live GitHub was refreshed before this decision was recorded. V0.6 Finance was complete and accepted; main was `b0e8fbf2fc0338c652a76b95a4a1418d2a5e7907`; post-merge main CI #2413 passed; open PRs/issues were zero; no V0.7 branch or implementation existed.

After a repository-wide analysis of V0.3 Budget/Procurement, V0.4 Inventory, V0.5 Subcontracts, V0.6 Finance, COST-014/D06-08, source ownership, security, precision, concurrency and reporting boundaries, the complete proposed V0.7 package was presented to the Product / Business Owner. It included:

- V0.7 Scope and explicit deferrals;
- AC-V07-001–052;
- BR-V07-01–16;
- D07-01–11;
- canonical cost/revenue definitions and source mapping;
- data/API/security/test baselines;
- V0.7-A through V0.7-E decomposition;
- 24–37 engineering-day planning estimate plus a separate human UAT/acceptance window.

The Product / Business Owner explicitly replied: **“go ahead i trust u”**. No amendment was specified. Record this as approval of that immediately preceding V0.7 proposal exactly as presented.

Key approved decisions are:
- D07-01 current PO + Subcontract commercial-ceiling commitment semantics, with no Work Order double count;
- D07-02 Paid Cost from approved non-cancelled outbound settlement allocations, separate from Payment-level Project Cash Flow;
- D07-03 Uncommitted ETC + Remaining Commitment forecast model;
- D07-04 Client Invoice Actual Revenue, Payment cash received and revised-contract Forecast Revenue separation;
- D07-05 controlled client Project Variations;
- D07-06 no synthetic WBS/Cost Code proration;
- D07-07 controlled Direct Cost Posting;
- D07-08 deterministic recognition dates;
- D07-09 base-currency-only and Decimal financial authority;
- D07-10 aggregate Cost Control visibility does not bypass source-module permissions;
- D07-11 automated Equipment Cost Allocation deferred until a canonical rate/valuation rule is approved.

Committed Cost, Actual Cost and Paid Cost remain separate. No second editable cost ledger is authorized. DEC-008, DEC-016 and DEC-022 remain mandatory. DEC-023 remains a one-time V0.6 release-exit exception and does not waive V0.7 human UAT/business acceptance.

This approval authorizes the V0.7 entry-gate documentation/closure sequence only. **V0.7-A implementation must not begin until the entry-gate PR merges, post-merge main CI passes and Issue #137 closes completed.**

## DEC-025 — V0.8 Management release entry baseline
**Status:** APPROVED — Product / Business Owner, 2026-10-04 (Singapore time)

Live GitHub was refreshed before this decision was recorded. V0.7 Cost Control was complete and accepted; the V0.1–V0.7 integrity reconciliation had merged as `49d50b5c8a8e032a0590b851fbe7612612d0d031`; post-merge main CI #2714 passed; open PRs were zero; Issue #160 was the only open issue and existed solely for V0.8 entry approval.

The complete V0.8 Management proposal was presented as:

- V0.8 Scope and explicit exclusions/deferrals;
- AC-V08-001–040;
- BR-V08-01–16;
- D08-01–12;
- data/API/security/test baseline;
- V0.8-A through V0.8-E stage decomposition;
- 18–30 engineering-day planning estimate plus a separate Product / Business Owner UAT/acceptance window.

The Product / Business Owner explicitly stated:

**“I approve the complete V0.8 Management entry package as proposed, including Scope, AC-V08-001–040, BR-V08-01–16, D08-01–12, data/API/security/test baseline, V0.8-A–E stages, planning estimate and deferrals, and authorize V0.8 entry-gate closure”**

No amendment was specified. Record the full package exactly as proposed as the approved V0.8 Management entry baseline.

Key approved decisions include:

- D08-01 — Management uses derived read models over canonical modules; no persistent editable KPI/management ledger.
- D08-02 — current derived data is the default; only non-authoritative permission-safe invalidatable cache is allowed if needed.
- D08-03 — Project dashboards require effective Project access plus Management permission; portfolio views require separate explicit portfolio permission.
- D08-04 — Management aggregate visibility does not grant protected source detail; source-module view permissions remain required.
- D08-05 — Project health/risk is deterministic from approved source signals; no manually authoritative overall-health override in initial V0.8.
- D08-06 — reuse existing Scheduling/Site semantics; no second schedule engine.
- D08-07 — reuse PROC-019 Required-on-Site versus Expected Delivery risk; no second procurement risk engine.
- D08-08 — consume V0.6/V0.7 approved Cost/Finance/Revenue/Profit measures exactly and keep them distinct.
- D08-09 — initial Management financial consolidation is Company base-currency-only; no FX conversion; server/database Decimal remains authoritative.
- D08-10 — controlled CSV and browser-printable views are the initial export baseline; advanced PDF/XLSX designer and scheduled distribution are deferred.
- D08-11 — descriptive/diagnostic analytics only; predictive/ML forecasting and AI recommendations are deferred.
- D08-12 — use canonical transaction/version history; dedicated warehouse/OLAP/persistent daily KPI snapshots are deferred.

V0.8 remains a read-only derived management/reporting layer. Source modules remain canonical owners. DEC-008 open-source/zero-cost-first, DEC-016 operating model and DEC-022 stable-candidate review policy remain mandatory.

This owner approval does not by itself start implementation. V0.8-A may begin only after the approved entry-gate branch passes exact-head CI, applicable PR/review gates pass, the entry-gate PR merges, post-merge `main` CI passes and Issue #160 closes completed. V0.8 Release Exit will still require separate Product / Business Owner human UAT and explicit release acceptance.


## DEC-026 — V1.0 Production Readiness release entry baseline
**Status:** APPROVED — Product / Business Owner, 2026-10-06 (Singapore time)

Live GitHub was refreshed before this decision was recorded. V0.8 Management was complete and accepted; main was `452677c931cd0d7592f1135c6d9894f16113314a`; post-merge main CI #3423 passed; Issue #187 and draft PR #188 held the complete V1.0 entry proposal. The refined proposal exact head `c9f0ba865ed25d6451782f4fe57a75632a8ec416` passed push CI #3456 and PR CI #3457, including authenticated live acceptance.

The complete V1.0 Production Readiness package presented immediately before approval included:

- V1.0 Scope and explicit exclusions/deferrals;
- AC-V10-001–040;
- BR-V10-01–16;
- D10-01–12;
- data/API/security/test baseline;
- V1.0 pre-flight gap assessment;
- V1.0-A through V1.0-E stage decomposition;
- 15–25 engineering-day planning estimate plus a separate Product / Business Owner readiness/UAT/go-no-go window.

The Product / Business Owner then explicitly replied: **“approve”**. In the immediate context, that reply approves the complete V1.0 entry package as presented, with no amendment specified.

Key approved decisions include:

- D10-01 — V1.0 is Production readiness/hardening over V0.1–V0.8, not a new business-feature release.
- D10-02 — deployment remains provider-neutral; final hosting/provider/cost commitment is a separate owner decision.
- D10-03 — DEC-008 remains mandatory; owned/self-hosted/open-source options are the default baseline.
- D10-04 — preserve the modular monolith; no Kubernetes/microservices requirement.
- D10-05 — environment/host-managed secrets are sufficient baseline; no hosted secret manager is mandatory.
- D10-06 — HTTPS is mandatory for authenticated Production traffic; same-origin/same-site is preferred where practical.
- D10-07 — initial operating targets are RPO <=24 hours and RTO <=8 hours.
- D10-08 — local/self-hosted structured logs + health/readiness + correlation IDs are sufficient baseline; no mandatory external APM/SIEM.
- D10-09 — controlled repeatable deployment is required; continuous Production deployment is not required initially.
- D10-10 — harden existing local/session identity; SSO/MFA/external IdP expansion remains deferred unless separately approved.
- D10-11 — record representative performance/capacity evidence without inventing a contractual SLA.
- D10-12 — Product / Business Owner retains final V1.0 readiness acceptance and Production go/no-go authority.

The approved security baseline also requires Production authentication rate limiting to use trusted client attribution behind any reverse proxy and remain effective across ordinary application restarts, or explicitly delegate that protection to the approved reverse-proxy boundary.

DEC-008, DEC-016 and DEC-022 remain mandatory. V1.0 remains a production-hardening release; no new ERP business-function scope is implicitly authorized.

This owner approval authorizes the V1.0 entry-gate closure sequence only. **V1.0-A implementation may begin only after PR #188 passes its exact-head closure gates, merges to `main`, post-merge exact-main CI passes and Issue #187 closes completed.** V1.0 Release Exit will still require separate Product / Business Owner readiness/UAT evidence acceptance and explicit go/no-go under AC-V10-039/040.


## DEC-027 — V1.0 Production Readiness release-exit acceptance
**Status:** APPROVED — Product / Business Owner, 2026-10-13 (Singapore time)

After V1.0-A through V1.0-E technical acceptance was complete through AC-V10-038, PR #207 had merged as `28637e075b62314add6f14d2333380a0ddd2322f`, exact-main CI #4211 had passed, technical closure reconciliation PR #208 had merged as `98af737b9002602657914a23d807c90711524df9`, and exact-main CI #4214 had passed, the Product / Business Owner explicitly stated:

> “I explicitly accept the V1.0 production-readiness/UAT evidence under AC-V10-039, accept V1.0 under AC-V10-040, and authorize V1.0 release closure / Production go-no-go.”

Record this as explicit completion of the human-only release-exit authority gates:

- **AC-V10-039 — ACCEPTED:** the Product / Business Owner explicitly accepts the V1.0 production-readiness/UAT evidence.
- **AC-V10-040 — ACCEPTED / PRODUCTION GO-NO-GO AUTHORIZED:** V1.0 is explicitly accepted and V1.0 release closure / Production go-no-go is authorized.

This decision does not claim that a Production deployment has already occurred. It does not expand V1.0 scope, change architecture, add a dependency, waive CI, or authorize a successor release without its own approved entry package. The acceptance-record branch passed exact-head push CI #4231 and PR CI #4232; PR #209 squash-merged as `8f5d4f56b38a373ef6d7233b46bcdb218345bf62`; exact-main CI #4233 PASS; Issue #205 CLOSED / COMPLETED. **V1.0 Production Readiness is COMPLETE + ACCEPTED.**


## DEC-028 — Bounded V1.1 Business Workflow & Role UI release-entry approval
**Status:** APPROVED — Product / Business Owner, 2026-10-17 (Singapore time)

At the V1.1 planning checkpoint, accepted V1.0 main was `8d00f7f096fe42514a3aa2d90352a6bc609dd670` with exact-main CI #4252 PASS. Planning Issue #211 and draft PR #212 contained the V1.1 Scope, AC-V11-001–030, BR-V11-01–18, Data/API/Security/Test Baseline, 54-item workflow mapping, eight-persona role/permission source-code inventory, UI blueprint, living mockup design direction, owner decision packet and a separate optional User Support & Diagnostics concept. The reviewed draft head `58f1529bb9edd13e25c85fbfb9f7cffd54681df1` passed exact-head push CI #4313 and PR CI #4314.

The Product / Business Owner explicitly stated:

> “you have my explicit approval of the bounded V1.1 release-entry package”

**Approved V1.1 interpretation (D11-01–13):**

- **D11-01 — Bounded scope:** V1.1 covers an incremental, modular role-first UI and integration of **existing already-approved source transactions and workflows**, no backend rewrite or shadow financial/stock/approval ledgers.
- **D11-02 — Identity/roles:** the signed-in user automatically receives their administrator-assigned effective Role(s)/permissions through `/auth/me`; **NO Switch Role, View-As or impersonation**. Actual staff grants/approval steps require UAT verification, never inferred from names.
- **D11-08/09 — UX/language/workbench:** grouped responsive navigation, Home/My Work, user/Company/Project-context from authorized APIs, incremental reusable layouts, and approved screen chrome/locales English/Thai/Traditional Chinese. Existing stored status, currency/THB semantics, authorization, source state and history remain unchanged. New aggregate endpoints require scoped review.
- **D11-03/04/05/06/07/11/12 — DEFERRED business policy:** new K/T/H series, construction-start BOQ rules, GR maker/checker/partial receipt changes, Nancy/Ben self-approval exceptions, changing existing SC-vs-Variation policy, stock-transfer receiving transactions and new unlimited payment limits are **NOT APPROVED**. AC-V11-017–022 test existing approved business behavior as **non-regression**, not permission to implement these policy changes.
- **D11-10 — DEFERRED broader modules:** customer Quotation AR, advanced progress billing, non-Project cash, petty cash, VAT/WHT/GL, HR/attendance/payroll, fixed assets, cheque handling, FX and the other 54-workflow gaps outside already delivered source capabilities require separate scope/Change Control.
- **D11-13 — User Support & Diagnostics:** owner previously welcomed the idea, but **implementation is expressly excluded from the bounded V1.1 entry package**. No new `admin.user_diagnostics.view`, cross-user diagnostic API, impersonation or new protected-record access is authorized. Separate owner security/API/audit/retention decision required before inclusion in any release; proposed AC-V11-031–036 are not accepted obligations for this release.
- **Stage sequence:** V1.1-A entry/baselines, V1.1-B modular shell, V1.1-C canonical end-to-end journeys, V1.1-D usability/accessibility/security/non-regression hardening without new rules, V1.1-E technical tests and real eight-persona UAT/release exit.
- **Planning:** the 23–39 engineering-day estimate plus separate 2–4 business-day UAT range is a nonbinding approved planning basis for the bounded UX-only scope, not a deadline, resource commitment or assurance of production deployment.

**Required gates:** This approval authorizes the **V1.1 entry-gate documentation/CI/review/merge closure**, not immediate application code, mutation of current Production data, unreviewed runtime permission grants, or V1.1 human UAT/release acceptance. Keep DEC-008, DEC-016, DEC-022 and one-writer governance. Final entry exact-head push/PR CI and applicable review must pass; merge PR #212 only after evidence, verify post-merge exact-main CI and close Issue #211 completed. Only then authorize V1.1-B; each B–E stage retains its own technical review/CI/merge and human owner AC-V11-029/030 exit.

**Approval baselines:** `docs/V1.1-SCOPE.md`, `docs/V1.1-ACCEPTANCE-CRITERIA.md`, `docs/V1.1-BUSINESS-RULES.md`, `docs/V1.1-DATA-API-SECURITY-TEST-BASELINE.md` and the supporting source traceability/role/UX drafts in PR #212. No predecessor release history or already executed migration is amended.

**DEC-028 technical entry-evidence checkpoint (2026-10-17):** PR #212 exact head `ecde63858d0b37a84fbce4e21cefec3f4cdb6739` passed push/PR CI #4319/#4320. Codex review raised two P2 documentation consistency findings (D11-08/09 inclusion, approved nonbinding planning range); both were corrected with thread replies/resolutions before merge. PR #212 squash-merged to `main` as `cd5b0c77e576ba140210d284ea1cbad4149bb0fd`, and post-merge exact-main CI #4321 PASS. Issue #211 and final docs reconciliation remain the administrative closure tracker; no V1.1 runtime implementation, Production deployment or human UAT acceptance is claimed.


**DEC-028 V1.1-B technical checkpoint (2026-10-17; evidence, not a new business decision):** V1.1-A final documentation PR #213 merged to `dae72ecec3492b62d3fd2f626a624fe801fda411`, exact-main CI #4327 PASS and Issue #211 CLOSED. Stage V1.1-B under Issue #214 delivered responsive authenticated permission-derived grouped navigation, Home/My Work and source PR draft/rejected read slice with en/th/zh-TW; no new backend approvals, business policy, schema/migrations, diagnostics API or recurring cost. PR #215 final head `e04cdeaaff1c5013f5b5315b389283750c12aee3` passed exact-head push/PR CI #4333/#4334, one automatic Codex P2 localization finding remediated and thread resolved. PR #215 squash-merged as `acf943392e81d4fb70f499304c5ce2bd677ea434`, exact-main CI #4335 PASS. Final documentation reconciliation and Issue #214 administrative closure remain separately gated. Product Owner V1.1 human UAT/release acceptance and actual Production deployment are not asserted.

## DEC-029 — Lean, risk-based Markdown review
**Status:** APPROVED — Product / Business Owner, 2026-10-18 (Singapore time)

The owner approved a lightweight alternative to deep-reviewing all 151 Markdown files, then explicitly requested simplification rather than additional documentation policy.

- Run the dependency-free `node tools/audit-markdown.mjs` in existing CI to inventory **all current Markdown files** and flag candidate missing relative inline links. Link findings are advisory by default. An automated scan **does not** prove line-by-line coverage, correct release status, or absence of conflicting instructions.
- Substantively review **changed or implicated** governance/current-state and active-release specifications, escalating genuine conflicts by impact. Preserve accepted historical release documents as point-in-time evidence rather than rewriting them solely because the project advanced.
- Follow **DEC-022** for mandatory stable-head, high-risk Codex review; do not routinely request a deep Codex pass on every historical Markdown file. **DEC-016** continues to govern periodic broad Work audits.
- This decision adds **no separate policy file, new mandatory release gate, paid service, or change to approval, security, exact-head/PR/post-main CI, human UAT, or V1.1-E2 release acceptance**. Do not self-approve V1.1 human gates.

## DEC-030 — Lean PR and status-documentation maintenance
**Status:** APPROVED — Product / Business Owner, 2026-10-19 (Singapore time)

At the owner's explicit request to fix unnecessary process overhead:

- Prefer **one coherent PR** containing implementation, applicable tests and affected documentation/closure evidence **when existing approved entry, review, sequencing and release gates permit**. Do not mandate separate preflight or docs-reconciliation PRs for administrative convenience; use separate PRs where predecessor gates, review independence or risk actually require them.
- Fresh **live GitHub** (main, Issues, PRs and CI) remains authoritative for actual implementation status; among Markdown documents, `docs/CURRENT-STATE.md` is the canonical **documented checkpoint** to reconcile against live GitHub. Other impacted docs should normally link to it instead of copying long current-status narratives. Preserve historical dated checkpoints and audit evidence; update factual source requirements only where affected.
- Use the concise PR checklist while keeping all applicable security, open-source/zero-cost, schema/migration, CI, Codex and human-acceptance controls. CI routing itself is **unchanged**: full validation and exact-head/PR/post-merge evidence continue to apply. Revisit lighter docs-only CI only with tested, fail-closed classification and explicit Change Control.

No new release or UAT gate, runtime scope, architecture, business behavior or authorization change is approved. DEC-008, DEC-016, DEC-022, DEC-028 and DEC-029 remain in force; V1.1-E2 remains open.


## DEC-031 — Owner-directed THB operating currency and local J2 fixture authorization
**Status:** APPROVED REQUIREMENT — Product / Business Owner, 2026-10-23 (Singapore time); implementation and release gates remain open.

In the active UAT conversation the owner stated “entire ERP system should be in Thai baht”, approved adding `subcontracts.subcontractor.view` and `subcontracts.subcontractor.manage` to Jai's isolated local UAT role, and then instructed “fix it for me automatically”.

- The operating requirement is THB for new ERP business operations. Preserve retained currency, amounts, approvals and audit history of historical SGD/NULL records; no FX, relabel, trigger bypass or executed-migration rewrite.
- The first correction changes new Agreement/reset and initial Company Settings UI defaults to THB. This is a bounded correction, **not evidence of complete API/database THB-only enforcement**. Remaining policy enforcement and schema-default changes stay tracked under Issue #246 and require regression/forward-only migration/DEC-022 gates before deployment.
- Authorized local UAT configuration: add only the two named register permissions to `UAT_E2_JAI_J2_PREPARER`, restricted to the existing verified Jai account; create at most one clearly labelled `UAT-E2-SC-001` test subcontractor through Jai's authenticated API. No broad role changes, business approvals or Approval Matrix changes.
- The separate Budget Revision workflow proposal has not been approved by this instruction; preserve the two existing instances and all Original Budget history.
- No V1.1 owner UAT/release acceptance, Production deployment or review waiver is granted.

## DEC-032 — Local V1.1-E2 recovery evidence exception
**Status:** APPROVED — Product / Business Owner, 2026-10-24 (Singapore time). **Local E2 recovery evidence only; no V1.1 UAT/release acceptance.**

The owner replied **“approve”** to the [specific recovery disposition](https://github.com/threeswordz/cinder-grind/issues/233#issuecomment-6386237994), after being told that the full saved-snapshot Document check remains BLOCKED. The [approval receipt](https://github.com/threeswordz/cinder-grind/issues/233#issuecomment-6386260157) records the decision. This is the sole exception to the local recovery-evidence treatment in `V1.1-E-TECHNICAL-EVIDENCE.md` section 3; the original acceptance criteria and Production recovery controls otherwise remain unchanged.

- **Accepted evidence for this local V1.1-E2 exercise:** green CI paired recovery on reviewed runtime `c2df1a7e24848bdee52153bcc4eb531c3b4de3b9` (main CI #4824), plus the owner-reported isolated restore of the saved database, all 125 migration names/checksums, expected Company/Project and all **7/7 LOCAL Document records of UAT Company `475466ac-a6f1-4b57-bb75-b9f7ee132d2f`**. Temporary-resource cleanup also passed in the supplied first-drill JSON. Full restored API/browser operation was not exercised by this local copy drill.
- **Retained limitation:** strict whole-snapshot Document completeness is **BLOCKED**: 21 LOCAL records, 7 verified and 14 missing files. Do not relabel the original backup or runner verdict as a complete paired-recovery PASS. The eight foreign Company identities and 14 record IDs were corroborated by the owner's read-only inventory against exact repository fixture names; Company prefixes alone never authorize an exemption.
- **Exact snapshot:** `~/Construction-ERP-UAT-Backups/20261024T144153Z-pre-v11-finance-guard`, source checkout `9aedbf206080ab1bd8b1c8c235c43e7bef6f4918`. Restore evidence: `~/.construction-erp-uat/evidence/restore-drill/20261024T151255Z-b5fbd608de.json` and `20261024T152003Z-7edc45f44d.json`. Local paths identify owner-held evidence, not files independently inspected in GitHub.
- Preserve the backup, every fixture row/Company and all audit/history. **No deletion, archival, relabel, fabricated/reconstructed file, backup rewriting, trigger bypass, schema/migration change or permission grant is authorized.** The isolation correction in PR #254 prevents future full validation from targeting retained UAT; it does not repair these older missing fixture bytes.
- This decision applies only to the exact saved snapshot and the following 14 synthetic records. It is **not** a general filter, prefix-based rule, future-backup exemption, or permission to overlook another missing business/Company document. The strict verifier remains unchanged.

| Fixture Company | Document ID |
|---|---|
| DOC-791a2387 | `a0a42ddd-a83c-40ea-abf0-487beb9321fd` |
| DOC-c74bc5e9 | `eb2745f8-cc42-4eb3-9886-574b406a8aef` |
| DOC-c74bc5e9 | `e8f3a534-cd9c-497a-b773-fc1e094f6a35` |
| DOC-c74bc5e9 | `42ae0ef2-0da4-4292-b796-57e42e635516` |
| DOC-c74bc5e9 | `8c62e7e6-e484-4b6c-b5bc-2ce5fc522bbb` |
| DOC-63531d70 | `c40d59b9-4396-49c8-937b-ae69f94ef557` |
| DOC-63531d70 | `a5fda915-83d8-45ee-9f1f-a5cd675ee9f3` |
| DOC-63531d70 | `a5220919-26f6-4887-905b-f598e2021fe9` |
| DOC-63531d70 | `b7eb4bf0-41fd-43ab-89f2-1db4f04d819d` |
| V01-c72d465a | `9373cd98-4725-4297-af4d-eb80a43a9210` |
| V01-075d28eb | `526b2e84-81fe-450e-a300-03a047663d3f` |
| V01-fe599806 | `d4f138b3-5d4c-468d-ba55-9d9cc9adac8c` |
| SE-14a395a9 | `a9eca7b2-aa3a-4700-9c25-5f93169e4020` |
| SE-636f5c67 | `8d35c333-5f04-48cb-81ec-02fb6b587212` |

Production still requires its normal complete paired recovery/restore proof. Exact-head/PR/post-main CI, applicable DEC-022 review, source authorization/history protections and zero-cost constraints remain in force. **AC-V11-029 UAT acceptance, AC-V11-030 release acceptance and Production deployment are not approved by this decision.** Formal E2 criteria are not automatically checked by the owner's limited approval. See the [owner decision packet](V1.1-E2-OWNER-DECISION-PACKET.md) for the actual evidence and remaining review limits.

## DEC-033 — V1.2 THB-only monetary hardening entry and bounded schema-aware assurance

**Status:** APPROVED — Product / Business Owner, 2026-10-25 SGT. **Scope/entry and implementation sequence, not implemented behavior, UAT acceptance or Production authorization.**

After the concrete source assessment and proposal, the owner replied **approve** to: “Do you approve this THB-only successor scope, including these four rules and the bounded schema-aware rehearsal extension?” [Exact approval receipt](https://github.com/threeswordz/cinder-grind/issues/246#issuecomment-6394359755). Predecessor V1.1 is COMPLETE + ACCEPTED, #233 CLOSED; approved checkpoint main `71918288bdfc70ac72b2c3e0f936f16942c9ad40`, main CI #4851 SUCCESS. The successor coordination label is **V1.2 — THB-only Monetary Hardening**, tracked by existing Issue #246; [V1.2 scope](V1.2-THB-SCOPE.md) is the canonical bounded implementation/THB-01–10 baseline.

- **D12-01:** All new economic monetary business activity uses THB across the existing in-scope modules, enforced through API/database/UI and monetary handoffs; no new-business currency selector or ordinary admin override. New Company/bootstrap defaults are THB. Existing non-THB Companies/history are not bulk rewritten; new monetary writes remain blocked until deliberate audited THB configuration.
- **D12-02:** Already-supported exact source-linked historical reversals/compensations retain original denomination and existing permission/scope/maker-checker/reason/amount/idempotency controls. They only neutralize recorded history; no new foreign procurement, settlement or increased exposure. Audit/version/exact-replay evidence preserves original identity.
- **D12-03:** Existing foreign/unknown chains cannot gain new commercial value through unsafe create/revision/approval/handoff. Preserve every original amount, currency/NULL label, approval/stock/Finance/audit record and authorized read. No conversion, relabel, silent numeric copy or inferred legacy backfill. New monetary roots need immutable THB provenance or verified parent contracts. If the current Budget root cannot safely accommodate a new THB chain, leave that new monetary operation blocked pending separate approved resolution. No client-date/name-prefix/mutable-flag/admin grandfather bypass.
- **D12-04:** Only necessary additive provenance/default/schema changes and a bounded schema-bearing release rehearsal are approved. Prove the actual previous-release upgrade, paired database/Documents backup/recovery, isolated restoration and compatible restored runtime. Preserve existing application-only/SQL-only modes and forward-only history; do not merely remove the unchanged-schema guard or assert application-only rollback across incompatible schema.

This advances DEC-031's pending permanent-policy implementation only within the approved V1.2 scope. It does not rewrite earlier decisions or allow historical in-place changes. Preserve existing Decimal precision, canonical ownership, #248's currency-lineage guard and #249's default corrections. SYS-009–011 trace the requirements. Normal entry documentation PR/push/PR/merge/post-main gates must complete before runtime implementation; B implementation and C targeted UAT/exit remain separately evidenced. Stable-candidate high-risk review remains mandatory under DEC-022.

Excluded: BOQ redesign/costing/UOM/field-security grants, new approval actors, HR/payroll implementation or unconfirmed responsibilities, multi-Project PO/Invoice/Payment, FX/GL/tax, new dependencies/paid service, architectural expansion and Production deployment. #245 remains deferred. DEC-032 stays restricted to its named old local snapshot; it does not waive V1.2/Production recovery. DEC-008/016/022/029/030 and the single-writer model remain unchanged. Separate V1.2 human UAT and release-exit decisions are required; no human gate or review execution is waived.


## DEC-034 — Approved BOQ disclosure / linked Customer BOQ first package and entry preparation

**Status:** OWNER-APPROVED FUTURE SCOPE — 2026-10-25 SGT; entry preparation only, not active successor implementation or predecessor/human acceptance.

The owner replied **“proceed approved”** after the concrete *Construction-ERP-BOQ-Seven-Role-Gap-Assessment-2026-10-25.md* and its proposed first package were presented. [Exact recorded boundary](https://github.com/threeswordz/cinder-grind/issues/266). Source assessment: main `bebffb4a7e3edc019e8a6e88e989fffbcc75d53a`, V1.2-B exact-main CI 40190475484 SUCCESS. [BOQ-COMMERCIAL-SCOPE.md](BOQ-COMMERCIAL-SCOPE.md) is the canonical first-package boundary, role direction, open inputs and BQC-AC-001–014 baseline; BUD-011–016 trace it. No release number is assigned.

- Reuse the cost BOQ and immutable approved BudgetRevision/Original Budget. Add separately approved Customer BOQ versions with durable approved-cost-source links; no automatic resync of approved commercial history, second editable cost ledger or new Actual/Paid recognition.
- Full Cost / Quantity Only / No Access and separate customer-price disclosure cover relevant APIs, UI, history, summaries, exports/print, documents, drilldowns and caches. Action authority remains separately scoped. Ben functions prepare Internal/Customer BOQ; Khaimook function approves Internal, Nancy function approves Customer. Company/Project scope, maker/checker and SYS_ADMIN business separation remain; no literal name authorization or live grant/configuration change by this approval record.
- Explicit customer quantity/UOM and reviewed mappings only; undefined conversions/assembly assumptions remain blocked. New activity stays THB-only with existing Decimal precision, historical SGD/NULL and all approval/audit/ledger history preserved. Minimum forward-only successor schema requires its own reviewed bounded upgrade/recovery contract; preserve existing rehearsal modes/guards.
- The approval resolves the first-slice choice and adopts the concrete visibility direction. It does **not** invent answers to expressly undecided inputs: Nancy internal line-cost extent/safe Finance summary granularity, representative mappings and initial pricing/precision/revision rules remain pending. Resolve these inputs rather than requesting the same package/THB approval again.
- Detailed/Lump Sum/Hybrid component costing and automatic UOM/assembly formulas remain a separate P1 increment. HR/Attendance/Payroll stays P1 with policy preparation in parallel; no unconfirmed HR actor, calculation or expense-recognition policy is approved. The broader inventory/commercial/subcontract/warehouse/Company lifecycle differences, petty cash/assets/depreciation, #245, FX/GL/tax, paid infrastructure and Production remain outside the first slice.

**Sequencing:** V1.2 is still primary active release; A/B COMPLETE, C owner UAT and separate release exit PENDING under #246. Durable approval/scope preparation is permitted; successor feature coding and a claim of entry COMPLETE wait for required V1.2 closure, resolved entry inputs and existing applicable documentation/CI/review/merge/main gates. No predecessor waiver, automatic business acceptance or Production authority. DEC-008/016/022/029/030/033 and one-writer governance remain in force.

### DEC-034 dated reconciliation — 2026-10-28 SGT

The approval-time open-input and predecessor wording above is historical. [Owner selections](https://github.com/threeswordz/cinder-grind/issues/266#issuecomment-6398077094) subsequently resolved Nancy's full working/approved cost reads within authorized Projects, Porn's Project-only contract/billed/paid summary, manual/markup methods and the presented four-place rate/quantity/two-place half-up line/summed-line/revision baseline. These decisions are carried into [canonical BOQ scope](BOQ-COMMERCIAL-SCOPE.md); no extra grants or commercial rates are inferred.

V1.2 is COMPLETE + ACCEPTED under DEC-036, #246 CLOSED / COMPLETED. The owner then instructed “proceed building with your recommendation” after BOQ first, HR next in stages and HR documentation preparation during BOQ delivery were presented. This progresses the approved package; it does not answer previously unresolved source allocation, derived-rate rounding or zero/discount edges. [BOQ entry preparation](BOQ-ENTRY-PREPARATION.md) provides the source-verified technical surface map and concrete synthetic **PROPOSED** C1–C5/E1–E8 decision; necessary input and entry gates still precede runtime coding. HR documentation preparation remains separate; no private HR requirements, HR policy exception or HR release entry is published here. No review, human acceptance or Production gate is waived.

## DEC-035 — One-time V1.2-C integrated Codex review waiver / governed merge authorization

**Status:** APPROVED — Product / Business Owner, 2026-10-28 SGT; PR #272 only, under DEC-022.

After receiving the PR-specific risk assessment and exact waiver/merge wording, the owner instructed:

> check what's wrong with the codex review , when it s done then work on "I approve the recorded DEC-022 waiver for PR #272, accept the residual review risk, and authorize the Builder’s governed merge subject to successful CI."

The requested diagnosis is complete. The combined review at `45806c06af4b7d8a4d7ebfc2514a1e26d5df457d` failed because of [Codex code-review usage limits](https://github.com/threeswordz/cinder-grind/pull/272#issuecomment-6447192321); no later completed review or actual unresolved review finding was present. Current account allowance/reset time was not exposed by GitHub. No repeated quota-blocked trigger, paid credits or account-setting change is authorized or required. [Owner authority and diagnostic receipt](https://github.com/threeswordz/cinder-grind/pull/272#issuecomment-6461951202).

This records the owner's one-time waiver of the **missing combined independent Codex review**, not a clean review and not an auditor granting its own waiver. It covers PR #272's audited implementation at `45806c06af4b7d8a4d7ebfc2514a1e26d5df457d` plus only the decision/evidence documentation needed to record this authority. Any material runtime, schema, security or business-behavior change requires reassessment under DEC-022.

Supporting evidence: completed clean reviews on all four constituent heads (#268–271), [source-integrity assessment](https://github.com/threeswordz/cinder-grind/pull/272#issuecomment-6461331517), successful exact-code-head push CI40537920226 / PR CI40537927802 (31/31 steps each), and [independent Work audit](https://github.com/threeswordz/cinder-grind/pull/272#issuecomment-6461549770), which found no new blocking defect. Accepted residual risk is the absence of a completed combined independent Codex assessment, particularly cross-module/report/UI interactions and the shared recovery surface.

The Builder is authorized to record this decision and perform normal PR #272 integration **after successful exact-final-head push/PR CI**. Verify the documentation-only delta from the audited code candidate, use a head-SHA guard for normal merge, then verify successful exact-main CI before technical closure. Reconcile #268–271 as superseded only after integration; do not merge their changes again. Actual final-head/merge/main-CI receipts belong in PR #272 and #246; this decision does not predict their results.

This does not waive CI, historical integrity, security, DEC-008, approved scope, forward-only migrations, THB-10 human UAT acceptance or separate V1.2 release exit. Completed THB owner observations remain completed; optional missing Mac fixtures are NOT EXECUTED, NOT FAILED, with technical coverage in existing CI. Preserve Mac-empty versus CI-nonempty/restored-runtime provenance. No repeat UAT, new retained fixtures/grants, recovery/smoke repetition, Production deployment or successor implementation is authorized. **Owner UAT acceptance and separate release exit remain PENDING; Production NOT AUTHORIZED.**

## DEC-036 — V1.2 human UAT and separate release-exit acceptance / final documentation closure

**Status:** ACCEPTED — Product / Business Owner, 2026-10-28 SGT; V1.2 at runtime main `e122277d53a60347113f22314fe5aeab70658955`, within the documented scope and evidence limits. Production deployment remains NOT AUTHORIZED.

The owner made two separate explicit decisions in sequence:

1. **Human UAT acceptance:** “I accept V1.2 THB UAT based on the recorded owner results and CI evidence, with the documented limitations.” [Actual acceptance receipt](https://github.com/threeswordz/cinder-grind/issues/246#issuecomment-6465324652).
2. **Release-exit acceptance / closure authority:** “I approve V1.2 release exit and final documentation closure for main `e122277d53a60347113f22314fe5aeab70658955`, with the documented scope and limitations. Production deployment remains unauthorized”. [Actual separate approval receipt](https://github.com/threeswordz/cinder-grind/issues/246#issuecomment-6465466988).

These are the owner's actual THB-10 decisions, not self-approval by development, CI, Codex or Work. The [release-exit evidence record](V1.2-RELEASE-EXIT.md) links the accepted runtime, integration/CI, independent audit/review and bounded owner/CI provenance. DEC-035's pre-merge review waiver and the subsequent completed clean Codex Code Review remain distinct historical events; neither is rewritten as the other.

The approval authorizes one coherent final decision/evidence/status documentation change through applicable normal exact-head push/PR CI, merge and exact-main CI, then closure of #246. Verify actual publication results in the live tracker before declaring repository closure. No additional human acceptance is required merely for documentation-only publication with unchanged runtime/schema/security/business behavior; no repeated owner UAT or optional Mac fixtures are required.

Preserve every accepted observation and historical currency/amount/NULL, approval, audit, Original Budget and ledger. Eight optional Mac categories remain NOT EXECUTED, NOT FAILED; the Mac empty-store drill/smoke is not nonempty uploaded-byte or compatible restored-runtime proof, which remains separately evidenced by disposable CI. The changed Budget UI has automated browser/HTTP/CSV/print proof, not after-change owner-Mac observation. Other recorded historical limits remain intact.

This acceptance does not authorize Production deployment, successor feature coding, new grants/data, paid services, new business rules, FX/history relabel or a bypass of future review/CI/entry gates. #266 remains approved future BOQ scope/entry preparation; resolve its remaining inputs and close its own entry conditions before implementation. DEC-008/016/022/033 and the single-writer model remain in force.


## DEC-037 — V1.3 BOQ entry rules/examples and complete HR requirements publication

**Status:** OWNER APPROVED — 2026-10-28 SGT. [Actual approval receipt](https://github.com/threeswordz/cinder-grind/pull/274#issuecomment-6467656281).

The owner explicitly stated: “I approve BOQ rules C1–C5 and examples E1–E8 in PR #274.” The owner separately stated: “and approve to publish the complete HR requirements to this GitHub repository”. The approved packet was PR #274 head `2bd6b29d3be6dfe13681c6769b97df0194c06a16`.

- Adopt C1–C5 and E1–E8 exactly as presented in [BOQ entry baseline](BOQ-ENTRY-PREPARATION.md): one approved verified-THB cost revision per Customer version, explicit cost shares and rationale, rate-first four-place half-up derived rates/two-place line amounts, UOM-compatible positive quantities, explicit zero-price reasons, and reasoned manual discounts/new approved revisions. E5's 0.99 result from a 1.00 basis is deliberately adopted. Synthetic example numbers are not real customer rates or ERP PASS claims.
- V1.3 coordinates the already-approved BOQ Disclosure and Linked Customer BOQ Versions package under #266/BUD-011–016/BQC-AC-001–014. V1.3-A publishes this resolved entry baseline; V1.3-B implements the bounded package; V1.3-C consolidates assurance and separate human UAT/release-exit decisions. Runtime starts only after A's normal merge/exact-main gate. This decomposition changes coordination, not business scope.
- Publish the complete existing [2026-10-27 Thai HR compilation](HR-PAYROLL-REQUIREMENTS-TH-2026-10-27.md), version4, SHA-256 `102d8023e8e8cbe65fd3ee6cb0e99cfd314f2307ba19ff1ed386b1a0786da0cf`, without omissions or silent policy edits. The [HR handoff](HR-PAYROLL-ENTRY-PREPARATION.md) distinguishes recorded answers from remaining conflicts/design/configuration work. This explicit repository-destination authorization resolves the earlier automatic publication rejection.
- HR publication does not itself approve implementation, statutory correctness, new grants, a maker/checker exception, payroll use or rollout. BOQ remains first; HR follows in stages. No private BOQ workbook content is authorized by the HR publication decision.
- Preserve completed V1.2 owner/CI evidence and acceptance. No repeated THB UAT, new Mac fixtures, historical/recovery/smoke exercises, Production deployment, history relabel/backfill, paid service, architecture expansion or review waiver is authorized. DEC-008/016/022/033/034/036 and normal CI/review/merge/human gates remain.


## DEC-038 — V1.3 BOQ business/UAT acceptance and separate release exit / final documentation closure

**Status:** OWNER ACCEPTED / APPROVED — 2026-10-29 SGT, accepted runtime main `f496c3b082251367b81669f9464e7a601668a527` and documented scope/limitations. **Production deployment remains NOT AUTHORIZED.**

The Owner made two separate explicit decisions in sequence:

1. [Business/UAT acceptance](https://github.com/threeswordz/cinder-grind/issues/266#issuecomment-6495112867): “I accept V1.3 BOQ business/UAT acceptance for main `f496c3b082251367b81669f9464e7a601668a527` based on the final recorded evidence and documented scope/limitations.”
2. [Release exit / final documentation authority](https://github.com/threeswordz/cinder-grind/issues/266#issuecomment-6495211143): “I approve V1.3 release exit and final documentation closure for main `f496c3b082251367b81669f9464e7a601668a527`, with the documented scope and limitations. Production deployment remains unauthorized.”

[Technical B closure](https://github.com/threeswordz/cinder-grind/issues/275#issuecomment-6495043480) and the [final retained evidence](https://github.com/threeswordz/cinder-grind/issues/275#issuecomment-6494918207) precede those decisions:88 recorded PASS,0 FAIL,0 required technical blockers,13 historical technical criteria,31 explicit supplemental retained fixture limits supported by accepted CI. Offline reconciliation corrected3 recorded null-envelope interpretation failures with exact body fingerprints and preserved original execution timestamps/reports; it ran0 new tests. The generated report's2 then-pending human decisions are now accepted separately, not silently rewritten as technical executions. The [release-exit record](V1.3-RELEASE-EXIT.md) preserves the runtime/configuration/provenance, empty-versus-populated fixture and physical-print/human-observation boundaries.

The Owner authorizes one coherent final acceptance/decision/current-state documentation change through normal exact-head push/PR CI, governed merge and exact-main CI, then #266 closure. Verify actual publication results before claiming repository closure; keep runtime/source acceptance anchored to the SHA above. This documentation-only change does not invalidate completed unchanged application reviews under DEC-022 or authorize repeated UAT.

No Production deployment, HR implementation entry, new grants/business data, payroll setting, self-approval exception, paid dependency, historical relabel/backfill, policy change or review waiver is authorized. HR remains staged after BOQ, with existing requirements preserved and explicit bounded entry approval still required. DEC-008/016/022/029/030/034/037, data/approval history and normal successor gates remain unchanged.


## DEC-039 — HR1-A employee/employment/privacy entry and implementation authority

**Status:** OWNER APPROVED — 2026-10-29 SGT. [Actual approval](https://github.com/threeswordz/cinder-grind/issues/283#issuecomment-6495792364) adopts the exact [HR1-A proposal](https://github.com/threeswordz/cinder-grind/issues/283#issuecomment-6495672957).

The Owner stated: “I approve the HR1-A scope, identity model, HR-only Company access and private-data matrix proposed in Issue #283, and authorize governed entry and implementation after the required entry gates.” V1.3 is complete/accepted under DEC-038, #275/#266 CLOSED, main eb9fb0c35cbe4b335caa71374e5d7ee1998cb6f7 / exact-main CI40866079211 SUCCESS31/31.

Adopt [HR1-A-ENTRY-CONTRACT.md](HR1-A-ENTRY-CONTRACT.md), HR-001–008/HRA-AC-001–014: canonical Company-owned Employee identities/history preserved; new codes on rehire/transfer and verified protected person links; explicit persisted **HR-only** target-Company/category scope, fixed login roles and distinct action rights; approved Koh/Nancy/Ben/Porn/site/admin private-data matrix; separated encrypted private values/history/canonical Documents, masked default views and safe errors/audit; no implicit SYS_ADMIN or other-module Company/approval authority. Existing broader Company/Project security remains enforced; the explicit HR entitlement is not a generic bypass. The100-answer Thai HR source and settled later-stage wage visibility remain unchanged.

The approval authorizes one coherent entry scope/data/DTO/permission/test publication through normal CI/merge/exact-main gates, then governed HR1-A implementation with one active writer, disposable CI and reusable role UAT alongside the code. Do not ask for the same scope/identity/privacy decision again after entry. Authorization/privacy/schema implementation still requires stable-candidate independent review and normal exact-head/PR/main gates; no waiver is granted.

Excluded: attendance/submission, leave/OT, wages/rate approval/payroll/statutory formulas, self-approval substitution, bank/payment/accountant files, Finance/labour-cost posting and Production. Actual retained grants/data activation, HR business acceptance and rollout are not approved by entry. No paid service, historical backfill/overwrite, automatic person matching or interview restart is authorized. Later stage-specific undecided inputs remain explicit rather than blocking this approved employee/privacy slice.


## DEC-040 — PR #293-only separate push-CI evidence waiver (not a review or PR-CI waiver)

**Status:** APPROVED — Product / Business Owner, 2026-10-30 SGT. **Applies only to HR1-A private attachment foundation PR #293**, final reviewed **application code** head `ecd30ae07f8769c3d3d4801ad848c0f5f79673ad` and its documentation-only decision/evidence follow-up. [Durable Owner instruction receipt](https://github.com/threeswordz/cinder-grind/pull/293#issuecomment-6526578177).

The owner explicitly stated: “i approve the pr 293 only push CI evidence waiver thank you”.

This is a narrow exception to the requirement to **independently verify a distinct push-triggered CI run** for this single PR. The connected GitHub commit workflow lookup exposes PR-triggered runs only; no push-run completion is claimed, and absence of independently surfaced push evidence is neither a failed test nor proof a run occurred. The waiver does **not** exempt the exact final PR-head CI, unchanged-code independent security review, review-thread closure, normal non-forced expected-head guarded merge, and exact-main post-merge CI.

Evidence **before decision publication**:
- Reviewed application head `ecd30ae07f8769c3d3d4801ad848c0f5f79673ad` has [PR CI 41061344499](https://github.com/threeswordz/cinder-grind/actions/runs/41061344499) SUCCESS31/31 (including compiler, registered attachment crypto/alias regression, disposable browser/rehearsal/recovery gates).
- The [independent final Codex Code Review](https://github.com/threeswordz/cinder-grind/pull/293#issuecomment-6519959971) completed clean on precisely that application head: `has_any_findings=false` and `has_unresolved_findings=false`; both original P2 threads were resolved with source-backed fixes.
- The new Decision Log/public evidence change is **documentation only** and does not alter the audited application behavior, schema, encryption, permissions, business policy, dependency or migrations. Under DEC-022 it does not invalidate that clean independent runtime review. Fresh PR CI on the **final documentation-inclusive head** remains mandatory before merge.

**Limitations:** This exception is not reusable for #294, HR1-A successor #295, another release, or any future feature branch. Any subsequent material application/security/schema change requires reassessment, normal applicable review and CI. HR1-A full business/UAT acceptance, retained Company/user grants or data activation, Accounting/Finance deferred scope, and real Production deployment remain separately gated and **not authorized**. GitHub must record actual merge/main-CI evidence after execution; none is presumed by this decision.
