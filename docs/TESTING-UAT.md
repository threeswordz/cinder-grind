# Construction ERP — Testing & UAT Approach

**Document Status:** Testing & UAT Baseline v0.1  
**Current Phase:** Phase 0 — ERP Definition  
**Architecture Baseline:** v0.1  
**Requirements Baseline:** v0.1  
**Database Baseline:** v0.1  
**Roles & Permissions Baseline:** v0.1  
**API Architecture Baseline:** v0.1

---

# 1. Purpose

This document defines the testing and User Acceptance Testing approach for the Construction ERP.

The goal is to ensure that every production feature is validated against:

- approved business requirements
- database integrity
- API behavior
- authorization rules
- approval workflows
- construction process logic
- financial and stock effects
- user-facing behavior
- regression risk
- UAT acceptance criteria

A feature is not complete because its screen renders correctly.

A feature is complete only after the applicable testing and acceptance gates are satisfied.

---

# 2. Quality Principles

The project follows these quality principles:

1. Test the business rule, not only the screen.
2. Critical logic must be tested below the UI.
3. Backend authorization must be tested independently from frontend visibility.
4. Financial and inventory effects must be transactionally tested.
5. Every approved requirement must be traceable to one or more tests where testable.
6. Sensitive workflows require negative tests as well as happy-path tests.
7. Production data must not be used casually as development/test data.
8. Regression testing is required before release.
9. UAT validates business fitness; it does not replace automated technical testing.
10. Testing tools used by the prototype must comply with the Open-Source First Policy.

---

# 3. Test Levels

The ERP uses multiple test levels.

```text
                  UAT
                   |
             End-to-End
                   |
          API / Integration
                   |
             Unit Tests
```

The system should contain more lower-level automated tests than slow end-to-end tests.

---

# 4. Unit Testing

Unit tests validate isolated business logic.

Typical unit-test targets include:

- schedule duration calculations
- working-calendar calculations
- dependency validation
- Critical Path calculation
- float calculation
- cost calculations
- budget variance calculation
- committed / actual / paid cost classification
- document-number formatting logic
- permission evaluation helpers
- approval-state transition rules
- maker-checker rules
- validation rules
- data transformation / DTO mapping
- inventory quantity calculations

Unit tests should avoid requiring a real browser or full database unless the behavior cannot be meaningfully isolated.

---

# 5. Backend Integration Testing

Integration tests validate cooperation between backend services and PostgreSQL.

They should use a dedicated test database or disposable database environment.

Integration testing covers:

- Prisma persistence
- database transactions
- foreign-key behavior
- unique constraints
- service-to-service interaction
- approval persistence
- audit logging
- stock-ledger generation
- payment allocations
- schedule baseline persistence
- transaction rollback on failure
- document metadata persistence

The test database must never be the Production database.

---

# 6. API Testing

REST API tests validate the public backend contract.

API tests must cover:

- route
- HTTP method
- authentication requirement
- permission requirement
- request validation
- expected response
- error response
- project/data scope
- business-state rules
- concurrency behavior where applicable
- idempotency behavior where applicable

Examples:

```text
POST /api/v1/purchase-orders/{id}/approve
POST /api/v1/goods-receipts/{id}/post
POST /api/v1/payments/{id}/approve
GET  /api/v1/projects/{id}/gantt
```

API testing must not assume that hidden frontend buttons provide security.

---

# 7. Frontend Component Testing

Frontend tests validate user-interface behavior that can be tested independently.

Examples:

- required-field feedback
- form state
- line-item calculations displayed to the user
- permitted/forbidden action visibility
- loading states
- empty states
- error displays
- table filtering
- responsive component behavior
- Gantt data rendering inputs

Frontend tests do not replace backend validation, permission tests or database tests.

---

# 8. End-to-End Testing

End-to-end tests validate complete user workflows across:

React  
→ NestJS  
→ PostgreSQL

Use end-to-end automation selectively for high-value business flows.

Priority automated E2E scenarios include:

- login and logout
- project creation
- Project → WBS → Activity setup
- schedule baseline creation
- Purchase Request → approval
- RFQ → Supplier Quotation → Award
- Purchase Order → approval
- Goods Receipt → stock increase
- Material Issue → stock decrease
- Supplier Invoice → approval
- Payment → approval / allocation
- Subcontract claim → certification
- document upload / download authorization

Large numbers of minor UI variations should not be duplicated as E2E tests when lower-level tests can cover them faster and more reliably.

---

# 9. Test Automation Policy

## 9.1 Must Be Automated

Where feasible, the following should be automated before Production:

- core calculation logic
- backend validation
- API authentication
- API authorization
- project-scope enforcement
- maker-checker rules
- approval transitions
- stock-posting logic
- financial allocation logic
- database transactions / rollback
- critical API happy paths
- critical API negative paths
- schedule calculations
- regression tests for confirmed defects

---

## 9.2 May Be Manual Initially

The following may begin as manual tests where automation adds little prototype value:

- visual polish
- copy / wording review
- complex print-layout review
- exploratory usability
- browser visual differences
- rare configuration combinations
- management dashboard aesthetics

Manual tests must still have documented acceptance steps where they are part of release acceptance.

---

# 10. Preferred Open-Source Test Tooling

The implementation may use free/open-source testing tools such as:

- backend/unit test runner compatible with NestJS
- React component testing tooling
- HTTP/API test tooling
- browser E2E automation such as Playwright
- PostgreSQL test databases / disposable containers
- static analysis / linting tools

Exact packages and versions are not approved by this document alone.

Each significant testing dependency must be reviewed in the Dependency License Register before adoption.

No paid test platform is required for the prototype.

---

# 11. Test Environments

The baseline uses three logical environments.

## Development

Purpose:

- developer implementation
- fast local testing
- unit tests
- integration tests

Data:

synthetic / test data only.

---

## Staging / UAT

Purpose:

- release-candidate validation
- integration testing
- UAT
- regression testing
- permission testing

Data:

representative but non-production test data.

---

## Production

Purpose:

real company usage.

Production must not be used as a general testing environment.

---

# 12. Test Database Strategy

Tests requiring PostgreSQL use a database isolated from Production.

Preferred patterns include:

- disposable PostgreSQL container
- isolated test database/schema
- dedicated hosted test database during later development

The schema is created from the same controlled migrations used by the application.

Tests must be repeatable.

Where practical:

1. create/reset test database
2. apply migrations
3. seed controlled test data
4. execute tests
5. clean/reset environment

---

# 13. Test Data

Test data must represent realistic construction scenarios without using confidential live data unnecessarily.

Baseline test dataset should eventually include:

- one company
- multiple users / roles
- at least two Projects
- Project Members with different access
- Customer
- multiple Suppliers
- Materials
- Units of Measure
- WBS structure
- Cost Codes
- Activities
- working calendar
- BOQ / Budget
- Purchase Requests
- Quotations
- Purchase Order
- Warehouse
- stock transactions
- Equipment
- Subcontract
- Supplier Invoice
- Client Invoice
- Payments
- Documents

Having at least two Projects is important for project-scope authorization testing.

---

# 14. Requirement-to-Test Traceability

Approved requirements must be traceable to tests.

Test Case IDs follow:

`TC-<Requirement ID>-<sequence>`

Examples:

`TC-PROC-014-001`

tests Purchase Order Approval.

`TC-SCH-011-001`

tests Working Calendar behavior.

`TC-FIN-014-002`

may test that the Payment creator cannot approve the same Payment.

A requirement may have:

- zero tests only if it is demonstrably non-testable/documentary
- one test
- many tests

Requirements without test coverage must be reviewed before the associated feature is marked Production.

---

# 15. Test Case Structure

A formal test case should contain:

- Test Case ID
- Requirement ID
- Test Name
- Test Level
- Preconditions
- Test Data
- Steps / Input
- Expected Result
- Actual Result
- Pass / Fail
- Automated / Manual
- Evidence / Link
- Defect Reference, if failed

Automated tests may encode some of these fields through test names, fixtures and CI output.

---

# 16. Authentication Tests

Authentication testing must include:

- valid login succeeds
- invalid password fails
- inactive user cannot authenticate
- protected endpoint without session returns 401
- expired/revoked session is rejected
- logout invalidates current session
- password/session secrets are not returned
- authentication secrets are not written to ordinary logs
- CSRF token is required for applicable cookie-authenticated mutations
- invalid CSRF token is rejected

---

# 17. Authorization and Project-Scope Tests

Authorization tests must include:

- user with correct permission can perform action
- user without permission receives denial
- project-scoped user can access assigned Project
- project-scoped user cannot access unassigned Project
- `projects.access_all` broadens scope but does not grant edit rights
- Report endpoints respect project scope
- Documents respect linked-record access
- System Administrator does not automatically gain business approval rights
- direct API calls cannot bypass frontend-hidden actions

Test both positive and negative authorization cases.

---

# 18. Maker-Checker Tests

Sensitive processes must verify segregation of duties.

Baseline maker-checker tests include:

- Payment creator cannot approve same Payment
- Purchase Order creator cannot approve same PO where maker-checker is enabled
- Supplier Invoice creator cannot approve same Supplier Invoice
- Client Invoice creator cannot approve same Client Invoice
- Budget creator/submission actor cannot self-approve where configured
- Project Variation creator cannot self-approve where configured

A user with technical System Administrator rights must not bypass maker-checker without separate business approval authority.

---

# 19. Approval Workflow Tests

For each approval-controlled transaction, test:

Draft  
→ Submitted  
→ Approved

and:

Submitted  
→ Rejected

and, where allowed:

Approved / eligible state  
→ Cancelled

Test:

- valid current step
- invalid step
- unauthorized role
- duplicate approval attempt
- approval after rejection
- edit after approval
- audit history
- approval actor/timestamp
- optional approval comment

---

# 20. Database Integrity Tests

Database tests must verify:

- UUID primary keys
- business numbers separate from internal IDs
- required foreign keys
- unique business-number constraints
- parent WBS belongs to same Project
- Activity WBS belongs to same Project
- no invalid cross-project schedule dependency
- no self dependency
- circular dependency validation
- historical master references remain valid after deactivation
- approved transactions cannot be casually hard-deleted
- document links point to valid allowed targets through service validation
- approval generic links reference valid business records through service validation

---

# 21. Database Transaction Tests

Atomic transactions must be tested using deliberate failure scenarios.

Examples:

Goods Receipt posting:

1. create Goods Receipt
2. attempt stock-ledger posting
3. simulate failure mid-operation
4. verify neither partial posting nor incorrect stock survives

Payment:

1. create Payment
2. create allocations
3. simulate failure
4. verify Payment/allocation result is rolled back consistently

Purchase Order:

1. create header
2. create line items
3. simulate invalid line
4. verify partial document is not incorrectly committed where operation is intended to be atomic

---

# 22. Scheduling Tests

Planning & Scheduling requires extensive calculation testing.

## 22.1 Working Calendar

Test:

- weekdays
- non-working weekdays
- public holidays
- project-specific exceptions
- 20 working days across weekends/holidays
- working-calendar overrides

---

## 22.2 Dependencies

Test:

- Finish-to-Start
- Start-to-Start
- Finish-to-Finish
- Start-to-Finish
- positive lag
- invalid self dependency
- circular dependency rejection

---

## 22.3 Baselines

Test:

- baseline creation
- approved baseline immutability
- current forecast changes without changing baseline
- baseline vs forecast variance

---

## 22.4 Critical Path and Float

Test known small networks with manually verifiable results.

The Critical Path calculation must be independently testable without Frappe Gantt.

---

## 22.5 Progress

Test:

- 0%
- partial progress
- 100%
- invalid values below 0 / above 100
- progress history
- latest current progress
- Daily Site Report updates Activity progress without overwriting baseline

---

## 22.6 Gantt

Test that Gantt displays API schedule data correctly.

Do not use the visual Gantt itself as proof that backend calculations are correct.

---

# 23. Groundworks Reference Scenario

The baseline construction scenario is:

Project:

Factory Construction

WBS:

Groundworks  
→ Ground Floor Slab

Summary duration:

20 working days

Activities:

- Setting Out
- Excavation
- Compaction
- Blinding Concrete
- Formwork
- Reinforcement
- Inspection
- Concrete Pour

Tests should verify:

- WBS / Activity hierarchy
- working-day calculation
- activity dependencies
- baseline
- progress
- forecast completion
- schedule delay
- Gantt rendering
- 2-week / 4-week lookahead inclusion

This scenario becomes one reusable UAT/reference dataset.

---

# 24. BOQ and Budget Tests

Test:

- BOQ creation
- sections / items
- quantity × rate values
- UOM references
- Original Budget approval
- Original Budget preservation
- Revised Budget creation
- Revised Budget approval
- prior revision history remains accessible
- Project rollup
- WBS rollup
- Cost Code rollup
- independent WBS and Cost Code dimensions
- unauthorized budget approval rejection

---

# 25. Procurement Workflow Tests

End-to-end procurement test:

```text
Purchase Request
→ Approval
→ RFQ
→ Multiple Suppliers
→ Supplier Quotations
→ Quotation Comparison
→ Supplier Award
→ Purchase Order
→ Approval
```

Verify:

- traceability between each stage
- Project allocation
- WBS allocation
- Cost Code allocation
- Required-on-Site Date
- Expected Delivery Date
- schedule-risk flag
- PO revision history
- approved PO becomes Committed Cost
- approved PO does not become Actual Cost merely from approval

---

# 26. Inventory Tests

Test:

- Goods Receipt against PO
- partial receipt
- multiple receipts against one PO line
- stock ledger increase
- Material Issue stock decrease
- Material Return stock increase
- Stock Transfer source decrease
- Stock Transfer destination increase
- stock balance derived from ledger
- reservation does not change physical stock
- historical stock transaction traceability
- posting is atomic
- unauthorized posting rejected

Over-receipt tolerance remains an open business rule and must not be invented in test expected results until approved.

---

# 27. Equipment Tests

Test:

- Equipment creation
- status
- project assignment
- usage
- usage history
- Daily Site Report equipment reference
- no duplication of Equipment master ownership
- cost allocation when later enabled

Maintenance tests become mandatory when the Future maintenance requirement is implemented.

---

# 28. Subcontract Tests

Test:

- Subcontract creation
- Work Order
- scope
- claim
- claim assessment
- certification
- retention calculation
- Variation Order
- certified amount available to Finance
- approved subcontract/work order becomes Committed Cost
- certified claim becomes Actual Cost only according to approved cost-recognition policy
- payment reference traceability

Retention release testing remains deferred until retention-release rules are approved.

---

# 29. Finance Tests

## 29.1 Supplier Invoice

Test:

- create invoice
- line items
- PO reference
- Goods Receipt reference
- submit
- approve
- reject
- unauthorized approval
- maker-checker
- approved invoice eligible for Actual Cost according to policy

Invoice matching tolerances remain open and are not assumed.

---

## 29.2 Client Invoice

Test:

- create invoice
- Project / Customer reference
- submit
- approve
- reject
- maker-checker
- AR visibility

Detailed progress-billing methodology remains deferred until approved.

---

## 29.3 Payments

Test:

- create outbound payment
- create inbound payment
- allocation to supplier invoice
- allocation to client invoice
- subcontract certification allocation
- submit
- approve
- maker-checker
- duplicate retry / idempotency
- Paid Cost only after approved Payment
- payment allocation cannot exceed allowed source balance according to implemented rules

---

# 30. Cost Control Tests

Test all cost states independently.

## Original Budget

Source:

approved Original Budget.

## Revised Budget

Source:

current approved Revised Budget.

## Committed Cost

Examples:

- approved PO
- approved subcontract
- approved work order

## Actual Cost

Examples according to approved policy:

- approved Supplier Invoice
- certified Subcontract Claim
- approved Direct Cost Posting

## Paid Cost

Source:

approved Finance Payment.

Test specifically that:

```text
Committed Cost != Actual Cost != Paid Cost
```

unless values happen to be numerically equal.

Also test:

- Forecast Cost
- Cost to Complete
- Variance
- Forecast Profit
- Actual Profit
- Project rollup
- WBS rollup
- Cost Code rollup
- combined WBS + Cost Code reporting

---

# 31. Document Tests

Test:

- upload
- metadata
- supported document type
- document link
- Project document authorization
- WBS document authorization
- Activity document authorization
- download
- archive
- unauthorized download rejection
- path traversal rejection
- unsafe filename handling
- server storage path not exposed
- file bytes remain outside PostgreSQL
- local storage abstraction works

Initial upload-size policy is selected during implementation and must have tests once configured.

---

# 32. API Contract Tests

API tests should cover representative cases for:

- 200
- 201
- 204
- 400
- 401
- 403
- 404
- 409
- 413
- 415
- 422
- 429

Verify:

- problem-details format
- correlationId
- validation errors
- no stack trace leakage
- no sensitive database error leakage
- decimal precision serialization
- camelCase JSON
- pagination metadata
- supported filters
- supported sort fields
- stale-record 409 behavior

---

# 33. Concurrency Tests

Test stale update behavior.

Scenario:

1. User A loads draft record.
2. User B updates same record.
3. User A submits update with old `expectedUpdatedAt`.
4. API returns 409 `STALE_RECORD`.
5. User A must refresh/reconcile.

Test at least representative editable resources such as:

- Project
- Activity
- draft Purchase Order

Approved transaction changes use revision/cancellation workflows rather than ordinary stale overwrite behavior.

---

# 34. Idempotency Tests

For sensitive endpoints once idempotency protection is implemented, test:

- first request succeeds
- same Idempotency-Key + same operation returns original result
- no duplicate stock / payment effect created
- same key + materially different payload returns conflict
- key scoping prevents inappropriate cross-user/cross-company reuse

Payments and stock postings must have duplicate-effect protection before Production.

---

# 35. Audit Tests

Verify:

- actor comes from authenticated user
- client cannot spoof actorUserId
- created / updated metadata
- submitted / approved metadata
- rejected / cancelled metadata where applicable
- correlation ID included where designed
- audit records not editable through ordinary ERP permissions
- sensitive values such as passwords/session secrets are not logged

---

# 36. Security Tests

Baseline application security tests include:

- unauthorized endpoint access
- project-scope isolation
- role escalation attempts
- direct approval endpoint without permission
- maker-checker bypass attempt
- CSRF rejection
- invalid/missing session
- request-size enforcement
- unsafe upload filename
- unsupported upload media type
- path traversal
- restricted CORS behavior
- no secret values returned by API
- no secrets committed to test fixtures

A later formal security review may expand this list.

---

# 37. Responsive / Browser Testing

Prototype user interfaces must be tested on representative:

- desktop
- laptop
- tablet
- mobile-browser viewport

Priority site workflows for responsive validation include:

- Activity progress
- Daily Site Report
- Site photographs
- Goods Receipt
- basic schedule / lookahead viewing

Full offline behavior is not tested because offline synchronization is not part of the prototype baseline.

---

# 38. Regression Testing

A regression suite protects previously working functionality.

Every confirmed defect should result in a regression test where technically practical.

Before release:

- automated regression suite passes
- critical manual regression checklist passes
- no unresolved blocking defects remain

Regression scope grows with each release.

---

# 39. Smoke Testing

After deployment to Staging and Production, run a small smoke suite.

Typical smoke checks:

- application loads
- login works
- authenticated API call works
- database connection works
- project list loads
- one create/read workflow works
- documents service is reachable
- critical configured business route responds

Production smoke tests must avoid destructive transactions unless explicitly designed as safe health checks.

---

# 40. User Acceptance Testing Purpose

UAT determines whether the ERP is usable and correct for the business process.

UAT is not intended to discover basic technical defects that automated testing should already have caught.

UAT uses realistic construction scenarios and approved acceptance criteria.

---

# 41. UAT Participants

Representative UAT participants should eventually include:

- Management / Director
- Project Manager
- Project Engineer / Site Engineer
- QS / Cost Controller
- Procurement
- Storekeeper / Warehouse
- Finance

Not every role needs to participate in every release.

UAT participants are selected according to release scope.

---

# 42. UAT Ownership

For each release:

**Product / Business Owner**

confirms UAT scope and final business acceptance.

**Module Representative**

executes relevant business scenarios.

**Development Team**

supports environment/setup and fixes defects.

A developer must not be the sole business approver of their own implementation.

---

# 43. UAT Entry Criteria

UAT may start only when:

- release scope is defined
- acceptance criteria exist
- code is deployed to Staging/UAT
- migrations are applied
- smoke tests pass
- automated critical tests pass
- test data is available
- known blocking technical defects are resolved
- UAT users have correct roles/permissions

---

# 44. UAT Exit Criteria

UAT may be considered complete when:

- all Must Have UAT scenarios are executed
- blocking/critical defects are resolved
- required retests pass
- accepted known limitations are documented
- module representatives provide acceptance
- Product / Business Owner signs off the release

A release with unresolved critical business defects cannot pass UAT.

---

# 45. UAT Scenario Format

Each UAT scenario contains:

- UAT Scenario ID
- Release
- Business Process
- Requirement IDs
- Business Role
- Preconditions
- Scenario Steps
- Expected Business Result
- Actual Result
- Pass / Fail
- Defect Reference
- Tester
- Test Date
- Sign-off

Example:

`UAT-V03-PROC-001`

Purchase Request → RFQ → Quotation → Award → PO Approval.

---

# 46. Reference UAT Scenarios

## UAT-PROJECT-001

Create:

Project  
→ WBS  
→ Activity

Expected:

Project structure is saved and can be viewed by assigned Project users.

---

## UAT-SCHEDULE-001

Create a 20-working-day Ground Floor Slab programme.

Expected:

Working calendar, dependencies, Gantt, baseline and lookahead behave as approved.

---

## UAT-PROCURE-001

Run:

Purchase Request  
→ RFQ  
→ Multiple Supplier Quotations  
→ Award  
→ Purchase Order Approval

Expected:

Traceability is preserved through the approved PO. V0.3-D retains the approved PO commercial value as immutable source evidence for later Committed Cost derivation; it does not create the V0.7 Committed Cost ledger and does not classify the PO as Actual Cost.

---

## UAT-STOCK-001

Run:

PO  
→ Goods Receipt  
→ Material Issue  
→ Material Return

Expected:

Stock ledger/balance changes correctly and remains traceable.

---

## UAT-FINANCE-001

Run:

Supplier Invoice  
→ Approval  
→ Payment  
→ Allocation

Expected:

Actual Cost and Paid Cost remain distinct and correct.

---

## UAT-SECURITY-001

Project Engineer assigned to Project A attempts to access Project B.

Expected:

Access is denied unless the user has an authorized all-project role/permission.

---

# 47. Defect Severity

Defects use the following severity baseline.

## Severity 1 — Critical

Examples:

- data corruption
- security breach / unauthorized financial approval
- incorrect financial/stock posting with no safe workaround
- application unavailable for critical business use
- destructive cross-project data access

Release blocking.

---

## Severity 2 — High

Examples:

- major required workflow cannot complete
- incorrect calculation affecting important decisions
- approval workflow broken
- critical report materially wrong
- serious permission failure with limited exposure

Normally release blocking unless formally accepted with safe workaround.

---

## Severity 3 — Medium

Examples:

- important function partially impaired
- workaround exists
- non-critical validation problem
- moderate UI/function issue

May be accepted for release with documented plan.

---

## Severity 4 — Low

Examples:

- cosmetic defect
- wording issue
- minor alignment
- low-impact usability improvement

Not normally release blocking.

---

# 48. Defect Record

A defect should record:

- Defect ID
- Title
- Severity
- Environment
- Release
- Module
- Requirement / Test Case
- Steps to Reproduce
- Expected Result
- Actual Result
- Evidence
- Status
- Owner
- Fix Version

GitHub Issues may be used for defect tracking.

---

# 49. Defect Workflow

Suggested defect status:

Open  
→ Triaged  
→ In Development  
→ Ready for Retest  
→ Retesting  
→ Closed

or:

Open  
→ Accepted Known Limitation

Accepted known limitations must have documented business approval where material.

---

# 50. Test Evidence

Test evidence may include:

- automated test output
- CI run link
- API response
- screenshot
- video
- report
- database verification query
- UAT sign-off

Do not store secrets or sensitive credentials in test evidence.

---

# 51. Release Quality Gates

A release cannot move to Production solely because development is complete.

Minimum release gate:

1. Must Have requirements implemented for the release.
2. Applicable database migrations reviewed.
3. Unit tests pass.
4. Integration tests pass.
5. API tests pass.
6. Critical permission/security tests pass.
7. Critical end-to-end tests pass.
8. Regression suite passes.
9. UAT exit criteria satisfied.
10. No unresolved Severity 1 defects.
11. No unresolved Severity 2 defects unless explicitly accepted by authorized business owner with safe workaround.
12. Documentation updated.
13. Deployment / rollback plan ready.
14. Staging smoke test passes.

---

# 52. Production Release Verification

After Production deployment:

- apply migration using approved release procedure
- verify application health
- run safe smoke tests
- verify authentication
- verify one read-only business flow
- verify logs for deployment errors
- confirm no migration failure
- confirm file/document service connectivity

If release verification fails materially, use the approved rollback/recovery procedure.

Detailed deployment/rollback procedure will be created during implementation planning.

---

# 53. Test Coverage Philosophy

The project does not adopt a single arbitrary percentage as proof of quality.

Coverage metrics may be used to identify untested code, but quality is judged by:

- approved requirement coverage
- critical business-rule coverage
- risk coverage
- workflow coverage
- regression protection

100% line coverage does not prove the ERP is correct.

---

# 54. Release Test Scope by Version

## V0.1 Foundation

Priority testing:

- authentication
- sessions
- roles/permissions
- project scope
- users
- master data
- Project
- WBS
- Cost Code
- documents basics
- number sequences
- audit framework

---

## V0.2 Project & Scheduling

Priority testing:

- Activities
- dependencies
- working calendars
- baseline
- Critical Path
- float
- Gantt
- Daily Site Reports
- progress history
- Equipment
- responsive site use

---

## V0.3 Procurement

Priority testing:

- BOQ/Budget
- Purchase Request
- RFQ
- quotations
- award
- Purchase Order
- immutable PO numbering and revision history
- PR → RFQ → quotation → award → PO traceability
- Project/WBS/Cost Code allocation
- Required-on-Site and Expected Delivery retention without Scheduling-date mutation
- maker-checker approval, rejection and cancellation evidence
- approved PO commercial values as source evidence for later committed-cost derivation
- Procurement Schedule / Risk read model
- Required-on-Site versus Expected Delivery calendar-date classification
- forward/backward PR → RFQ → quotation → award → PO traceability
- procurement document targets through the secure Documents architecture
- Project-scope denial through reporting and document target APIs
- commercial-data redaction from operational procurement reporting

Stage D automated integration and live HTTP acceptance exercise award-backed PO creation, duplicate-award prevention, quantity not exceeding the selected award, Draft-only commercial editing, approval, immutable earlier revisions, Expected Delivery changes through controlled revision, cancellation evidence and Project-scope denial. Stage D does not create the V0.7 Committed Cost ledger/read model.

Stage E automated integration and live HTTP acceptance verify source-derived procurement status/key dates, BR-V03-13 risk classification, PR/RFQ/award/PO traceability, operational-report commercial redaction, procurement document targets, and Project-scope denial without introducing a duplicate reporting ledger.

---

## V0.4 Inventory

Priority testing:

- Goods Receipt
- stock ledger
- balance
- reservation
- issue
- return
- transfer
- posting atomicity

---

## V0.5 Subcontracts

Priority testing:

- subcontract
- Work Order
- claim
- assessment
- certification
- retention
- variations

---

## V0.6 Finance

Priority testing:

- Supplier Invoice
- Client Invoice
- AP/AR
- payments
- allocations
- maker-checker
- cash flow

---

## V0.7 Cost Control

Priority testing:

- budget
- committed
- actual
- paid
- forecast
- cost to complete
- variance
- profitability
- Project/WBS/Cost Code rollups

---

## V0.8 Management

Priority testing:

- dashboards
- cross-module reporting
- analytics consistency
- access scope
- exports

---

# 55. Definition of Test Complete for a Feature

A feature may be considered test-complete when applicable:

- requirement is Approved
- acceptance criteria are testable
- unit tests pass
- integration tests pass
- API tests pass
- permission/security tests pass
- relevant E2E scenario passes
- regression tests exist for fixed defects
- manual exploratory testing completed where appropriate
- UAT passes when required
- defects meet release quality gate

---

# 56. Traceability Example

Requirement:

`PROC-014 — Purchase Order Approval`

Implementation:

`POST /api/v1/purchase-orders/{id}/approve`

Permission:

`procurement.po.approve`

Tests:

- `TC-PROC-014-001` authorized approver succeeds
- `TC-PROC-014-002` unauthorized user rejected
- `TC-PROC-014-003` invalid PO state rejected
- `TC-PROC-014-004` maker-checker restriction
- `TC-PROC-014-005` audit action recorded

UAT:

`UAT-V03-PROC-001`

This traceability pattern is repeated across the ERP.

---

# 57. Baseline Decision

The Construction ERP quality flow is:

```text
Requirement
   |
   v
Implementation
   |
   +--> Unit Tests
   +--> Integration Tests
   +--> API / Permission Tests
   +--> End-to-End Tests
   |
   v
Staging
   |
   v
UAT
   |
   v
Release Quality Gate
   |
   v
Production
```

Testing is part of development, not a final activity performed after coding is finished.

**Status: Testing & UAT Baseline v0.1**

The next Phase 0 deliverable is:

**Development Roadmap — Issue #7**


### V0.4-A Warehouse foundation validation

Stage A adds clean migration/schema validation, Warehouse input validation, PostgreSQL Company/Project/site integrity, Company-unique code, assigned/unassigned Project-scope denial, archive/reactivate lifecycle, audit history, web typecheck/build and live HTTP create/read/update/archive/reactivate checks. The full V0.1–V0.3 regression remains mandatory. Stock posting, balance, reservations, issues, returns and transfers are not tested as implemented in Stage A.


## V0.4-B Goods Receipt automated evidence

The normal API regression command includes the Purchase Order PostgreSQL integration scenario extended with Goods Receipt posting. It verifies current approved PO lineage, maker-checker, one positive ledger effect, idempotent retry, unauthorized Project denial, direct ledger UPDATE/DELETE rejection, Warehouse history reassignment/archive protection, PO cancellation denial while received, revision quantity/deletion denial, simultaneous competing posts against remaining PO quantity, full reversal and archive/cancellation eligibility after reversal.

The live HTTP runtime acceptance uses unique scenario records and the configured `GOODS_RECEIPT` workflow/sequence. It covers Draft quantity/remarks edit, partial and multiple receipts, approved posting, maker denial, duplicate retry, over-receipt denial, source and Project authorization, PO cancellation guard and exact negative reversal. Persistent UAT cleanup remains non-destructive under BR-V04-20.

Clean migration-from-zero/status, API/web typecheck/build, prior-release regression and production dependency audit remain required. Stage B completion needs exact-head branch/PR CI and resolved review. Later V0.4-C/D/E tests must add derived balance, reservation/negative-stock, return and transfer behavior; V0.4 human Product / Business Owner UAT remains a separate Release Exit Gate.


## V0.4-C Stock Balance automated evidence

The Purchase Order/Goods Receipt PostgreSQL integration path now instantiates the derived-balance service against real immutable ledger rows. It verifies exact DECIMAL(18,4) aggregation after posting, Project/Site dimensions, unassigned-Project denial, default hiding of net-zero historical groups and exact reversal-to-zero when requested. The normal test command executes this coverage.

Live HTTP acceptance grants the explicit stock-view permission to the scenario business Role, verifies the posted Project/Site balance, denies an unassigned Project user, reverses every receipt and verifies both default zero suppression and explicit zero-history visibility. Migration-from-zero/status, API/web typecheck/build, dependency audit and all V0.1–V0.4-B regression remain in the same CI gate.


## V0.4-D Reservation / Issue / Return automated evidence

The existing Purchase Order / Goods Receipt PostgreSQL integration scenario now extends through Stage D on the same immutable stock ledger. It verifies competing Reservation activation against a final quantity, derived on-hand/reserved/available values, linked Reservation full consumption, Material Issue maker-checker and one exact negative ledger effect, Return quantity ceilings and one exact positive ledger effect, blocked Issue reversal while a Return remains, Return-before-Issue reversal ordering, exact final balance restoration, and preservation of fulfilled Reservation history after Issue reversal.

The live HTTP acceptance scenario configures the Stage-D business permissions, `RSVYYMM-###`, `MIYYMM-###` and `MRTYYMM-###` numbering plus `MATERIAL_ISSUE` / `MATERIAL_RETURN` Approval Matrix workflows. It receives physical stock, proves unauthorized Project denial, activates a Reservation, proves derived availability, submits/approves an Issue, verifies atomic Reservation fulfillment and negative ledger/balance effect, submits/approves a Return, enforces the cumulative return ceiling, rejects invalid reversal ordering, reverses Return then Issue, verifies exact balance restoration and confirms that Issue reversal does not reopen the historical Reservation.

Implementation/test head `2a21d5bd3dd3748717ddea25a19b2dc8ee1394b9` passed branch CI #1442, including migration-from-zero/status, production dependency audit, API/web typecheck/build, all prior-release regression, PostgreSQL Stage-D integration/concurrency coverage and live HTTP acceptance. Human V0.4 Product / Business Owner UAT remains a separate Release Exit Gate and is not self-approved by this evidence.

## V0.5-A Subcontractor / Agreement Draft automated evidence

The normal API regression includes a PostgreSQL Stage-A scenario covering Company-owned Subcontractor creation, optional same-Company active Supplier linkage, cross-Company composite-FK denial, assigned/unassigned Project access, `projects.access_all`, immutable `SCYYMM-###` Draft identity, stable create-key replay, archive blocking new agreements, retained history, database hard-delete guards, audit records and the six explicit permissions.

The live authenticated HTTP scenario uses unique non-destructive data to create and read the Company register from a user without Project membership, link a Supplier, create and edit a scoped agreement Draft with configured operational status, replay the same create key without duplication, deny an unauthorized Project user, archive the Subcontractor, reject a new agreement and retain the existing Draft. Clean migration/status, production dependency audit, Prisma validation, API/web typecheck/build and the full V0.1–V0.4 regression remain in the same CI gate. Human V0.5 Product / Business Owner UAT remains the separate release exit gate.
