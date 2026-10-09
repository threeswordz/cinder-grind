# Construction ERP — Master Requirements Register

**Document Status:** Requirements Baseline v0.1  
**Current Phase:** V1.0-C Security Hardening — UNDER VALIDATION / STABLE MERGE CANDIDATE  
**Architecture Baseline:** v0.1  
**Source:** ERP-MASTER-BLUEPRINT.md  
**Last Structural Review:** V0.8-E DEC-022 source-drilldown/live-state remediation — 2026-10-05

**Live delivery note:** V0.1–V0.8 are complete and accepted at their applicable release gates. V1.0 entry is complete under DEC-026; V1.0-A is COMPLETE; V1.0-B Backup / Restore / Recovery is COMPLETE after final exact-head CI #3836/#3837, clean DEC-022 review, PR #194 squash merge as `3d7e6e05cafe6ed0407ce8ec2c5aca89ea196c7e`, exact-main CI #3838 PASS and Issue #193 closure. V1.0-C Security Hardening is UNDER VALIDATION / STABLE MERGE CANDIDATE under Issue #196 / PR #198. Implementation is complete for AC-V10-017–026 on branch `v1.0-c-security-hardening`; merge remains blocked on exact-head push + PR CI and the required DEC-022 stable-head review because this stage changes security boundaries and includes a forward migration. Requirement approval/status remains governed by the approved baselines and Change Control; this live note does not rewrite historical requirement approval.

---

# 1. Purpose

This document is the authoritative register of functional, technical and control requirements for the Construction ERP.

Every material ERP capability must have a unique Requirement ID.

Requirements must be traceable through:

Architecture Blueprint  
→ Requirement ID  
→ GitHub Issue  
→ Database / API / Frontend Implementation  
→ Test Case  
→ UAT  
→ Release

No material ERP requirement should exist only in chat messages, meeting notes, email, verbal instructions or developer notes.

---

# 2. Requirement ID Standard

| Prefix | Module |
| --- | --- |
| FND | Foundation |
| MST | Master Data |
| PRJ | Projects |
| WBS | WBS & Cost Codes |
| SCH | Planning & Scheduling |
| BUD | BOQ & Budget |
| SITE | Site Execution |
| PROC | Procurement |
| INV | Inventory |
| EQP | Equipment |
| SUB | Subcontracts |
| FIN | Finance |
| COST | Cost Control |
| DOC | Documents |
| RPT | Reporting |
| ADM | Administration |
| SYS | Cross-Cutting System Controls |
| ARCH | Architecture & Technology |

Requirement IDs must never be reused.

---

# 3. Requirement Status

Allowed requirement statuses are:

- Draft
- Approved
- In Development
- Testing
- UAT
- Production
- Deferred
- Cancelled

New requirements extracted from the Architecture Baseline begin as **Draft** until reviewed and approved.

---

# 4. Priority

- **Must Have** — required for the relevant release to be considered complete.
- **Should Have** — important but may be deferred without preventing the release.
- **Could Have** — useful enhancement.
- **Future** — intentionally outside the current committed release scope.

---

# 5. Requirement Record Structure

Every requirement contains:

- Requirement ID
- Requirement Name
- Description
- Business Reason
- Priority
- Target Release
- Dependencies
- Acceptance Criteria
- Status

GitHub Issues will later reference the Requirement ID when implementation work is created.

---

# 6. Master Requirements

## Foundation

| ID | Requirement | Description | Business Reason | Priority | Target Release | Dependencies | Acceptance Criteria | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FND-001 | User Authentication | The ERP shall require authenticated access for protected application functions. | Prevent unauthorized access. | Must Have | V0.1 Foundation | None | Users can sign in with valid credentials; invalid credentials are rejected; protected routes require authentication. | Approved |
| FND-002 | Session Management | The ERP shall create, validate and terminate authenticated user sessions. | Maintain secure user access. | Must Have | V0.1 Foundation | FND-001 | Authenticated sessions persist according to configured rules; logout invalidates access; expired sessions cannot access protected functions. | Approved |
| FND-003 | Authorization Framework | The ERP shall enforce authorization on protected backend operations. | Prevent users from performing unauthorized actions. | Must Have | V0.1 Foundation | FND-001 | Unauthorized API actions are rejected even if a user attempts to bypass the frontend. | Approved |
| FND-004 | Role-Based Access Control | The ERP shall support roles and role-based permission assignment. | Provide manageable access control across ERP modules. | Must Have | V0.1 Foundation | FND-003 | Roles can be defined and permissions assigned; users inherit permissions from assigned roles. | Approved |
| FND-005 | Approval Workflow Framework | The ERP shall provide a reusable approval workflow framework for transactions that require approval. | Avoid building separate approval logic for every module. | Must Have | V0.1 Foundation | FND-003 | Supported records can move through Draft, Submitted, Approved, Rejected and Cancelled states where applicable. | Approved |
| FND-006 | Audit Framework | The ERP shall provide a reusable audit framework for material record changes and business actions. | Protect accountability and traceability. | Must Have | V0.1 Foundation | FND-001 | Auditable records capture actor, action and timestamp; ordinary users cannot edit audit history. | Approved |
| FND-007 | Validation Framework | The ERP shall validate required fields, data formats and business rules on the backend. | Protect data integrity. | Must Have | V0.1 Foundation | None | Invalid requests are rejected with understandable validation errors; frontend validation does not replace backend validation. | Approved |
| FND-008 | Error Handling Framework | The ERP shall provide consistent application and API error handling. | Make failures diagnosable and safe. | Must Have | V0.1 Foundation | None | Unexpected failures return controlled responses and are logged without exposing sensitive internal details. | Approved |
| FND-009 | Application Logging | The ERP shall maintain application logs sufficient for prototype troubleshooting. | Support debugging and operations. | Must Have | V0.1 Foundation | None | Backend errors and important system events can be reviewed from application logs. | Approved |
| FND-010 | REST API Foundation | The ERP shall expose backend business capabilities through a versionable REST API architecture. | Separate frontend and backend cleanly. | Must Have | V0.1 Foundation | None | React communicates with NestJS through documented REST endpoints; frontend does not directly access PostgreSQL. | Approved |
| FND-011 | Database Foundation | PostgreSQL shall be the system of record for ERP business data and Prisma shall manage application data access and migrations. | Provide a consistent relational data foundation. | Must Have | V0.1 Foundation | None | Application persists approved business data in PostgreSQL; schema changes are migration-controlled. | Approved |
| FND-012 | Open-Source Authentication | Authentication and authorization shall not require a paid hosted identity provider during the prototype. | Maintain the open-source-first constraint. | Must Have | V0.1 Foundation | FND-001 | A working prototype can authenticate and authorize users without a mandatory commercial identity service. | Approved |

## Master Data

| ID | Requirement | Description | Business Reason | Priority | Target Release | Dependencies | Acceptance Criteria | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| MST-001 | Customer Master | The ERP shall maintain a shared customer master used by Projects and relevant commercial modules. | Avoid duplicated customer records. | Must Have | V0.1 Foundation | FND-011 | Authorized users can create, view, update and deactivate customer records; Projects can reference a customer. | Approved |
| MST-002 | Supplier Master | The ERP shall maintain a shared supplier master used by Procurement and Finance. | Provide one supplier source of truth. | Must Have | V0.1 Foundation | FND-011 | Authorized users can maintain supplier records; Procurement can reference an active supplier. | Approved |
| MST-003 | Employee Master | The ERP shall maintain employee records needed for project teams, responsibility and administration. | Support assignment of people to ERP processes. | Must Have | V0.1 Foundation | FND-011 | Authorized users can maintain employee records and active employees can be referenced by relevant modules. | Approved |
| MST-004 | Material Master | The ERP shall maintain a shared material master for procurement, inventory and site usage. | Provide consistent material identification. | Must Have | V0.1 Foundation | FND-011 | Materials have stable identifiers and descriptions and can be referenced by procurement and later inventory transactions. | Approved |
| MST-005 | Unit of Measure Master | The ERP shall maintain Units of Measure used by BOQ, materials, procurement and inventory. | Ensure quantity consistency. | Must Have | V0.1 Foundation | FND-011 | Authorized users can maintain units and transactional quantities reference a valid unit where required. | Approved |

## Projects

| ID | Requirement | Description | Business Reason | Priority | Target Release | Dependencies | Acceptance Criteria | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PRJ-001 | Project Record | The ERP shall allow authorized users to create and maintain a Project record. | Establish the primary construction entity. | Must Have | V0.1 Foundation | MST-001 | A project can be created, viewed and updated with a stable Project ID. | Approved |
| PRJ-002 | Project Code and Name | Each Project shall have a user-facing project code and project name. | Make projects identifiable to users. | Must Have | V0.1 Foundation | PRJ-001 | Project code and name are stored and displayed; project identity remains separate from the database ID. | Approved |
| PRJ-003 | Project Customer | A Project shall reference a Customer from the shared customer master. | Connect project delivery to the contracting customer. | Must Have | V0.1 Foundation | PRJ-001,MST-001 | An active customer can be selected for a project and the relationship persists. | Approved |
| PRJ-004 | Project Commercial Header | A Project shall store the original contract value and allow later commercial values to be derived by downstream modules. | Provide top-level commercial context. | Must Have | V0.1 Foundation | PRJ-001 | Contract value can be stored with the project and retrieved by authorized users. | Approved |
| PRJ-005 | Project Location and Description | A Project shall store its location and descriptive information. | Provide operational project context. | Must Have | V0.1 Foundation | PRJ-001 | Location and project description can be maintained. | Approved |
| PRJ-006 | Project Team and Contacts | A Project shall support association of project team members and project contacts. | Identify responsible people and contacts. | Must Have | V0.1 Foundation | PRJ-001,MST-003 | Authorized users can associate project team members and contacts with the project. | Approved |
| PRJ-007 | Project Planned Dates | A Project shall store planned start and planned completion dates. | Establish high-level programme boundaries. | Must Have | V0.1 Foundation | PRJ-001 | Planned start and completion dates can be stored and retrieved. | Approved |
| PRJ-008 | Project Actual Dates | A Project shall support actual start and actual completion dates. | Track actual project execution. | Should Have | V0.2 Project & Scheduling | PRJ-001 | Actual dates can be recorded independently of planned dates. | Approved |
| PRJ-009 | Project Status | A Project shall have a configurable status. | Support project lifecycle management. | Must Have | V0.1 Foundation | PRJ-001,ADM-006 | Project status can be selected from approved configured values. | Approved |

## WBS & Cost Codes

| ID | Requirement | Description | Business Reason | Priority | Target Release | Dependencies | Acceptance Criteria | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| WBS-001 | Hierarchical WBS | The ERP shall support a multi-level hierarchical Work Breakdown Structure within each Project. | Represent construction work packages and areas. | Must Have | V0.1 Foundation | PRJ-001 | Users can create parent and child WBS elements under a project. | Approved |
| WBS-002 | WBS Identification | Each WBS element shall have a WBS code, name and description. | Provide stable construction breakdown identification. | Must Have | V0.1 Foundation | WBS-001 | WBS code and name are displayed and parent-child relationships are preserved. | Approved |
| WBS-003 | WBS Status | WBS elements shall support active/inactive status without deleting historical references. | Protect historical data. | Must Have | V0.1 Foundation | WBS-001,SYS-002 | Inactive WBS elements remain queryable but cannot be selected for new transactions where prohibited. | Approved |
| WBS-004 | Cost Code Register | The ERP shall maintain Cost Codes that classify the nature of project costs. | Enable cost classification independent of project structure. | Must Have | V0.1 Foundation | FND-011 | Authorized users can create, view, update and deactivate Cost Codes. | Approved |
| WBS-005 | Independent WBS and Cost Code Dimensions | The ERP shall treat WBS and Cost Code as independent dimensions rather than a mandatory parent-child hierarchy. | Enable flexible construction cost reporting. | Must Have | V0.1 Foundation | WBS-001,WBS-004 | A transaction can reference both a WBS and Cost Code without one being the parent of the other. | Approved |
| WBS-006 | Project-WBS Association | Every WBS element shall belong to one Project. | Preserve project data integrity. | Must Have | V0.1 Foundation | PRJ-001,WBS-001 | The system prevents WBS records from existing without a valid Project. | Approved |

## Planning & Scheduling

| ID | Requirement | Description | Business Reason | Priority | Target Release | Dependencies | Acceptance Criteria | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SCH-001 | Activity Register | The ERP shall maintain Activities as the canonical scheduled work entity under the Project/WBS structure. | Provide the basis of project scheduling. | Must Have | V0.2 Project & Scheduling | WBS-001 | Authorized users can create, view and update Activities associated with valid Project/WBS context. | Approved |
| SCH-002 | Activity Identification | Each Activity shall support activity code, description, status, owner and responsible Project Engineer. | Identify and assign scheduled work. | Must Have | V0.2 Project & Scheduling | SCH-001,MST-003 | Activity identification and responsibility fields persist and display correctly. | Approved |
| SCH-003 | Summary Activities | The ERP shall support summary/grouping activities where required by the programme. | Allow meaningful programme hierarchy. | Should Have | V0.2 Project & Scheduling | SCH-001 | Summary activities can group detailed activities without losing WBS association. | Approved |
| SCH-004 | Planned Schedule Dates | Activities shall support planned duration, planned start and planned finish. | Define the approved work plan. | Must Have | V0.2 Project & Scheduling | SCH-001,SCH-011 | Planned dates and duration are stored and interpreted using the assigned working calendar. | Approved |
| SCH-005 | Actual Schedule Dates | Activities shall support actual start and actual finish independently from planned dates. | Record real execution. | Must Have | V0.2 Project & Scheduling | SCH-001 | Actual dates can be captured without overwriting planned or baseline dates. | Approved |
| SCH-006 | Forecast Schedule Dates | Activities shall support forecast start and forecast finish. | Track expected completion based on current conditions. | Must Have | V0.2 Project & Scheduling | SCH-001 | Forecast dates can differ from planned and actual dates and are available for reporting. | Approved |
| SCH-007 | Activity Progress | Activities shall support percentage-complete progress. | Measure execution progress. | Must Have | V0.2 Project & Scheduling | SCH-001 | Progress can be recorded within an allowed range and appears in schedule views. | Approved |
| SCH-008 | Activity Dependencies | The ERP shall support Finish-to-Start, Start-to-Start, Finish-to-Finish and Start-to-Finish dependencies. | Represent construction sequencing. | Must Have | V0.2 Project & Scheduling | SCH-001 | Users can link valid predecessor and successor activities using supported dependency types. | Approved |
| SCH-009 | Dependency Lag | Activity dependencies shall support lag where required. | Represent realistic sequencing gaps. | Should Have | V0.2 Project & Scheduling | SCH-008 | A dependency can include configured lag and schedule calculations preserve it. | Approved |
| SCH-010 | Milestones | The ERP shall support milestones in the project programme. | Represent zero-duration control points. | Must Have | V0.2 Project & Scheduling | SCH-001 | Milestones can be created, dated and displayed distinctly in schedule views. | Approved |
| SCH-011 | Working Calendars | The ERP shall support project working calendars defining working weekdays, non-working days, working hours and holidays. | Ensure durations mean working time rather than simple calendar time. | Must Have | V0.2 Project & Scheduling | ADM-009 | Activity date calculations follow the assigned project calendar. | Approved |
| SCH-012 | Baseline Schedule | The ERP shall preserve an approved baseline schedule separately from current forecast data. | Measure schedule variance. | Must Have | V0.2 Project & Scheduling | SCH-004 | Baseline dates can be captured and remain unchanged unless an authorized rebaseline occurs. | Approved |
| SCH-013 | Baseline Comparison | The ERP shall compare baseline and current/forecast dates. | Make slippage visible. | Must Have | V0.2 Project & Scheduling | SCH-006,SCH-012 | Users can see schedule variance between baseline and current forecast. | Approved |
| SCH-014 | Delay Tracking | The ERP shall identify and report delayed activities based on approved scheduling rules. | Surface schedule risk. | Must Have | V0.2 Project & Scheduling | SCH-006,SCH-012 | Delayed activities can be identified from schedule data and included in reporting. | Approved |
| SCH-015 | Critical Path | The ERP backend shall support Critical Path calculations independently of the Gantt UI component. | Identify activities controlling project finish. | Must Have | V0.2 Project & Scheduling | SCH-008,SCH-011 | Critical activities can be calculated from schedule logic without relying on Frappe Gantt as the source of truth. | Approved |
| SCH-016 | Total Float | The ERP backend shall support calculation and storage or derivation of total float. | Support schedule risk analysis. | Must Have | V0.2 Project & Scheduling | SCH-015 | Total float can be calculated for eligible activities and made available to reporting. | Approved |
| SCH-017 | Interactive Gantt | The ERP shall provide an interactive Gantt visualization using the approved open-source prototype component. | Give users a practical construction programme view. | Must Have | V0.2 Project & Scheduling | SCH-001,SCH-004,SCH-007,SCH-008 | Gantt displays WBS, activities, dates, duration, progress, dependencies, milestones, status, baseline and current forecast in supported views. | Approved |
| SCH-018 | Lookahead Schedules | The ERP shall provide 2-week and 4-week lookahead views based on current schedule data. | Support site planning meetings. | Must Have | V0.2 Project & Scheduling | SCH-006 | Users can view activities falling within 2-week and 4-week lookahead periods. | Approved |
| SCH-019 | Groundworks Programme Example | The scheduling model shall be capable of representing a 20-working-day groundworks summary programme and its detailed sub-activities. | Validate the system against a concrete construction use case. | Must Have | V0.2 Project & Scheduling | SCH-001,SCH-011,SCH-017 | A Ground Floor Slab Groundworks programme can contain Setting Out, Excavation, Compaction, Blinding, Formwork, Reinforcement, Inspection and Concrete Pour and show plan, actual, forecast and delay. | Approved |
| SCH-020 | Schedule Ownership Independence | Scheduling logic and schedule data shall remain independent of Frappe Gantt. | Avoid UI-library lock-in. | Must Have | V0.2 Project & Scheduling | ARCH-005 | Replacing the Gantt component does not require redesigning core schedule entities or calculations. | Approved |

## BOQ & Budget

| ID | Requirement | Description | Business Reason | Priority | Target Release | Dependencies | Acceptance Criteria | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| BUD-001 | BOQ Structure | The ERP shall support BOQs with sections and BOQ items. | Represent project quantities and commercial structure. | Must Have | V0.3 Procurement | PRJ-001 | Authorized users can create a BOQ and organize items into sections. | Approved |
| BUD-002 | BOQ Item Fields | BOQ items shall support description, quantity, unit, rate and amount. | Capture measurable construction work. | Must Have | V0.3 Procurement | BUD-001,MST-005 | BOQ item amount is supported from quantity/rate data and unit references are valid. | Approved |
| BUD-003 | Original Budget | The ERP shall store the first approved project budget as Original Budget. | Establish the initial commercial baseline. | Must Have | V0.3 Procurement | BUD-001 | The approved original budget is identifiable and preserved. | Approved |
| BUD-004 | Revised Budget | The ERP shall maintain a current approved Revised Budget after authorized changes. | Support controlled budget updates. | Must Have | V0.3 Procurement | BUD-003,FND-005 | Revised budget changes are approval-controlled and do not overwrite original budget history. | Approved |
| BUD-005 | Budget Revisions | The ERP shall retain budget revision history. | Provide auditability of budget changes. | Must Have | V0.3 Procurement | BUD-004,FND-006 | Authorized users can review previous approved budget revisions. | Approved |
| BUD-006 | Budget Approval | Budget approval shall use the ERP approval framework. | Ensure only approved budgets drive control reporting. | Must Have | V0.3 Procurement | BUD-003,FND-005 | Budget records can be submitted, approved or rejected according to configured authority. | Approved |
| BUD-007 | Budget by Project | Budget values shall be reportable by Project. | Support project-level budget control. | Must Have | V0.3 Procurement | PRJ-001,BUD-003 | Approved budget can be summarized at Project level. | Approved |
| BUD-008 | Budget by WBS | Budget values shall be allocatable and reportable by WBS. | Support work-package cost control. | Must Have | V0.3 Procurement | WBS-001,BUD-003 | Approved budget can be summarized by WBS. | Approved |
| BUD-009 | Budget by Cost Code | Budget values shall be allocatable and reportable by Cost Code. | Support cost-type control. | Must Have | V0.3 Procurement | WBS-004,BUD-003 | Approved budget can be summarized by Cost Code. | Approved |
| BUD-010 | Budget Availability to Other Modules | Approved BOQ and budget information shall be available to Procurement and Cost Control without duplicating ownership. | Connect commercial baseline to downstream modules. | Must Have | V0.3 Procurement | BUD-006 | Procurement and Cost Control can reference approved budget data while BOQ & Budget remains the owner. | Approved |

## Site Execution

| ID | Requirement | Description | Business Reason | Priority | Target Release | Dependencies | Acceptance Criteria | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SITE-001 | Daily Site Report | The ERP shall allow authorized site users to create Daily Site Reports for a Project/date. | Capture daily construction execution. | Must Have | V0.2 Project & Scheduling | PRJ-001 | A daily report can be created and retrieved for a project and reporting date. | Approved |
| SITE-002 | Activity Progress Update | Daily Site Reports shall be capable of updating linked Activity progress. | Connect field execution to schedule control. | Must Have | V0.2 Project & Scheduling | SITE-001,SCH-007 | A daily report can reference an Activity and update progress without overwriting baseline data. | Approved |
| SITE-003 | Manpower Recording | Daily Site Reports shall support recording manpower information. | Provide basic field resource visibility. | Must Have | V0.2 Project & Scheduling | SITE-001 | Authorized users can record manpower details in a daily report. | Approved |
| SITE-004 | Material Usage Recording | Daily Site Reports shall support recording material usage references. | Provide site consumption context. | Should Have | V0.2 Project & Scheduling | SITE-001,MST-004 | Material usage can be recorded against valid materials; formal stock movement remains owned by Inventory. | Approved |
| SITE-005 | Equipment Usage Recording | Daily Site Reports shall support recording equipment used. | Connect site work to equipment utilization. | Must Have | V0.2 Project & Scheduling | SITE-001,EQP-001 | Daily reports can reference valid equipment records without duplicating equipment master data. | Approved |
| SITE-006 | Weather Recording | Daily Site Reports shall support weather observations. | Provide context for progress and delays. | Should Have | V0.2 Project & Scheduling | SITE-001 | Weather information can be recorded with the report. | Approved |
| SITE-007 | Site Issues | Daily Site Reports shall support site issues and remarks. | Capture operational constraints. | Must Have | V0.2 Project & Scheduling | SITE-001 | Users can record site issues and remarks for later review. | Approved |
| SITE-008 | Delay Reasons | Daily Site Reports shall support delay reasons. | Provide schedule variance context. | Must Have | V0.2 Project & Scheduling | SITE-001,SCH-014 | Delay reasons can be associated with daily reports and linked activities where applicable. | Approved |
| SITE-009 | Inspection Recording | Daily Site Reports shall support inspection references or records. | Capture quality/control events related to site work. | Should Have | V0.2 Project & Scheduling | SITE-001 | Inspection information can be recorded or referenced from a daily report. | Approved |
| SITE-010 | Site Photographs | Daily Site Reports shall support site photographs through the Documents module. | Provide visual progress evidence. | Must Have | V0.2 Project & Scheduling | SITE-001,DOC-004 | Users can attach/refer to site photographs and files are stored through the document-storage abstraction. | Approved |
| SITE-011 | Daily Progress History | The ERP shall retain historical daily progress updates rather than only the latest percentage. | Support audit and trend analysis. | Must Have | V0.2 Project & Scheduling | SITE-002,FND-006 | Past progress submissions remain reviewable after later updates. | Approved |

## Procurement

| ID | Requirement | Description | Business Reason | Priority | Target Release | Dependencies | Acceptance Criteria | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| PROC-001 | Purchase Request | The ERP shall support Purchase Requests as the initiating procurement transaction. | Formalize demand before purchasing. | Must Have | V0.3 Procurement | PRJ-001 | Authorized users can create and maintain a Purchase Request with stable business identity. | Approved |
| PROC-002 | Purchase Request Items | A Purchase Request shall contain one or more line items. | Capture requested materials/services at line level. | Must Have | V0.3 Procurement | PROC-001,MST-004 | Users can add item, quantity, unit and relevant allocation data to PR lines. | Approved |
| PROC-003 | Purchase Request Approval | Purchase Requests shall use the approval framework. | Control procurement authorization. | Must Have | V0.3 Procurement | PROC-001,FND-005 | PRs can be submitted, approved or rejected according to configured authority. | Approved |
| PROC-004 | RFQ | The ERP shall support Requests for Quotation created from approved procurement demand. | Obtain supplier pricing competitively. | Must Have | V0.3 Procurement | PROC-003 | Authorized users can create an RFQ that references relevant procurement requirements. | Approved |
| PROC-005 | RFQ Suppliers | An RFQ shall support distribution to multiple suppliers. | Enable competitive sourcing. | Must Have | V0.3 Procurement | PROC-004,MST-002 | Multiple active suppliers can be associated with the same RFQ. | Approved |
| PROC-006 | Supplier Quotations | The ERP shall record supplier quotations against an RFQ. | Capture supplier offers. | Must Have | V0.3 Procurement | PROC-004,PROC-005 | Quotation header and line data can be recorded against the correct supplier/RFQ. | Approved |
| PROC-007 | Quotation Comparison | The ERP shall compare supplier quotations for procurement evaluation. | Support transparent supplier selection. | Must Have | V0.3 Procurement | PROC-006 | Users can compare relevant quotation data across responding suppliers. | Approved |
| PROC-008 | Supplier Selection | The ERP shall record the selected supplier and procurement decision context. | Preserve sourcing traceability. | Must Have | V0.3 Procurement | PROC-007 | A selected supplier can be recorded and traced to the underlying quotations. | Approved |
| PROC-009 | Purchase Order | The ERP shall create Purchase Orders for approved procurement commitments. | Formalize supplier commitments. | Must Have | V0.3 Procurement | PROC-008 | Authorized users can create a Purchase Order referencing the selected supplier and source process where applicable. | Approved |
| PROC-010 | Purchase Order Items | Purchase Orders shall contain line items with material/service, quantity, unit, unit price and amount. | Capture committed cost at line level. | Must Have | V0.3 Procurement | PROC-009 | PO lines support required quantity and pricing fields and calculate/retain line amount. | Approved |
| PROC-011 | PO Project Allocation | PO items shall reference Project where applicable. | Attribute commitments to projects. | Must Have | V0.3 Procurement | PROC-010,PRJ-001 | A PO line can reference a valid Project. | Approved |
| PROC-012 | PO WBS Allocation | PO items shall reference WBS where applicable. | Attribute commitments to work packages. | Must Have | V0.3 Procurement | PROC-010,WBS-001 | A PO line can reference a WBS belonging to the selected Project. | Approved |
| PROC-013 | PO Cost Code Allocation | PO items shall reference Cost Code where applicable. | Classify commitment type. | Must Have | V0.3 Procurement | PROC-010,WBS-004 | A PO line can reference a valid Cost Code independently of the WBS hierarchy. | Approved |
| PROC-014 | Purchase Order Approval | Purchase Orders shall use the approval framework. | Control commercial commitments. | Must Have | V0.3 Procurement | PROC-009,FND-005 | POs can be submitted, approved, rejected and cancelled where applicable. | Approved |
| PROC-015 | Purchase Order Revision History | The ERP shall retain Purchase Order revision history. | Protect commitment auditability. | Must Have | V0.3 Procurement | PROC-014,FND-006 | Approved PO revisions are traceable and earlier approved values remain reviewable. | Approved |
| PROC-016 | Required-on-Site Date | Procurement lines shall support Required-on-Site dates where applicable. | Connect purchasing to construction need dates. | Must Have | V0.3 Procurement | SCH-001,PROC-010 | Required-on-Site dates can be captured and related to project work. | Approved |
| PROC-017 | Expected Delivery Date | Procurement shall maintain expected supplier delivery dates. | Monitor supply timing. | Must Have | V0.3 Procurement | PROC-009 | Expected delivery dates can be captured and updated without altering schedule-owned Activity dates. | Approved |
| PROC-018 | Procurement Schedule | The ERP shall provide visibility of procurement items and their key dates/status. | Support procurement planning. | Must Have | V0.3 Procurement | PROC-016,PROC-017 | Users can review procurement status alongside required and expected dates. | Approved |
| PROC-019 | Schedule Risk Integration | The ERP shall compare Required-on-Site dates with Expected Delivery dates and identify schedule risk. | Surface material-driven activity risk. | Must Have | V0.3 Procurement | PROC-016,PROC-017,SCH-001 | The system can flag cases where expected delivery threatens the required need date/activity. | Approved |
| PROC-020 | Procure-to-Pay Traceability | Procurement transactions shall remain traceable into Goods Receipt, Supplier Invoice and Payment. | Provide end-to-end commercial traceability. | Must Have | V0.6 Finance | PROC-009,INV-001,FIN-001,FIN-006 | Users can navigate or query the chain from procurement source documents through downstream receiving and finance records. | Approved |
| PROC-021 | Committed Cost Feed | Approved Purchase Orders shall feed committed cost information to Cost Control without being treated automatically as Actual Cost. | Preserve correct cost-state semantics. | Must Have | V0.7 Cost Control | PROC-014,COST-003 | Cost Control can derive PO commitment values separately from actual and paid cost. | Approved |

## Inventory

| ID | Requirement | Description | Business Reason | Priority | Target Release | Dependencies | Acceptance Criteria | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| INV-001 | Goods Receipt | The ERP shall support Goods Receipts for physical material receipt. | Record receipt of purchased goods. | Must Have | V0.4 Inventory | PROC-009 | Authorized users can create a Goods Receipt referencing a Purchase Order where applicable. | Approved |
| INV-002 | Goods Receipt Items | Goods Receipts shall contain line-level received quantities. | Maintain receipt traceability. | Must Have | V0.4 Inventory | INV-001 | Receipt lines can reference relevant PO lines/materials and received quantities. | Approved |
| INV-003 | Warehouse Register | The ERP shall maintain warehouses/storage locations. | Define where stock is held. | Must Have | V0.4 Inventory | FND-011 | Authorized users can maintain warehouse records and active warehouses can be selected for stock transactions. | Approved |
| INV-004 | Stock Transaction Ledger | All inventory movements shall create controlled stock transactions. | Provide auditable stock movement history. | Must Have | V0.4 Inventory | INV-003,MST-004 | Receipts, issues, returns and transfers generate traceable stock transactions. | Approved |
| INV-005 | Stock Balance | Stock balances shall be derived from controlled stock transactions rather than manually maintained balances. | Protect stock integrity. | Must Have | V0.4 Inventory | INV-004 | Current balance can be calculated by material/location from transaction history. | Approved |
| INV-006 | Project Stock | Inventory shall support stock attribution to Project where applicable. | Track project-owned materials. | Must Have | V0.4 Inventory | INV-004,PRJ-001 | Stock reports can identify project-associated inventory. | Approved |
| INV-007 | Site Stock | Inventory shall support stock held at site-specific locations. | Provide site material visibility. | Must Have | V0.4 Inventory | INV-003 | Site stock can be distinguished by warehouse/location. | Approved |
| INV-008 | Material Reservation | The ERP shall support material reservation where required. | Protect stock for planned work. | Should Have | V0.4 Inventory | INV-005,SCH-001 | Available stock can be reserved against valid project/work context without altering physical quantity on hand. | Approved |
| INV-009 | Material Issue | The ERP shall support issuing materials from stock. | Record site consumption/transfer out of storage. | Must Have | V0.4 Inventory | INV-004 | Material Issue reduces relevant stock through a controlled transaction. | Approved |
| INV-010 | Material Return | The ERP shall support returning previously issued materials. | Reverse unused site materials into stock. | Must Have | V0.4 Inventory | INV-004,INV-009 | Material Return creates a controlled increase in relevant stock with traceability. | Approved |
| INV-011 | Stock Transfer | The ERP shall support transfers between warehouses/locations. | Track physical movement between storage locations. | Must Have | V0.4 Inventory | INV-003,INV-004 | Transfer decreases source stock and increases destination stock through linked transactions. | Approved |
| INV-012 | Inventory Transaction History | Inventory movements shall remain historically traceable and auditable. | Support reconciliation and investigation. | Must Have | V0.4 Inventory | INV-004,FND-006 | Users with permission can review historical stock movements and source documents. | Approved |

## Equipment

| ID | Requirement | Description | Business Reason | Priority | Target Release | Dependencies | Acceptance Criteria | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| EQP-001 | Equipment Register | The ERP shall maintain a construction equipment register. | Provide one source of truth for equipment. | Must Have | V0.2 Project & Scheduling | FND-011 | Authorized users can create, view, update and deactivate equipment records. | Approved |
| EQP-002 | Equipment Type | Equipment records shall support equipment type/category. | Enable grouping and filtering. | Should Have | V0.2 Project & Scheduling | EQP-001 | Equipment can be categorized using configured values. | Approved |
| EQP-003 | Equipment Status | Equipment shall have a status indicating operational availability/state. | Support assignment decisions. | Must Have | V0.2 Project & Scheduling | EQP-001 | Equipment status can be maintained and shown in availability views. | Approved |
| EQP-004 | Project Assignment | Equipment shall support assignment to Projects. | Track equipment deployment. | Must Have | V0.2 Project & Scheduling | EQP-001,PRJ-001 | Equipment can be assigned to a valid project with history retained. | Approved |
| EQP-005 | Equipment Availability | The ERP shall provide equipment availability information from status/assignment data. | Support planning. | Should Have | V0.2 Project & Scheduling | EQP-003,EQP-004 | Users can identify equipment that is available versus assigned/unavailable. | Approved |
| EQP-006 | Equipment Usage | The ERP shall record equipment usage. | Support operational and cost visibility. | Must Have | V0.2 Project & Scheduling | EQP-001 | Usage records can reference equipment, project/date and relevant site context. | Approved |
| EQP-007 | Equipment Usage History | Equipment usage history shall be retained. | Support utilization review. | Must Have | V0.2 Project & Scheduling | EQP-006 | Past equipment usage can be reviewed chronologically. | Approved |
| EQP-008 | Maintenance Records | The ERP shall support maintenance records for equipment. | Support equipment reliability. | Should Have | Future | EQP-001 | Maintenance events can be recorded and historically reviewed. | Approved |
| EQP-009 | Equipment Cost Allocation | The ERP shall support allocating equipment cost to project/WBS/Cost Code where applicable. | Integrate equipment usage into cost control. | Should Have | V0.7 Cost Control | EQP-006,WBS-005 | Eligible equipment cost can be attributed using Project + WBS + Cost Code dimensions. | Approved |

## Subcontracts

| ID | Requirement | Description | Business Reason | Priority | Target Release | Dependencies | Acceptance Criteria | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SUB-001 | Subcontractor Register | The ERP shall maintain subcontractor records owned by the Subcontracts module. | Provide a subcontract-specific source of truth. | Must Have | V0.5 Subcontracts | FND-011 | Authorized users can maintain subcontractor records and active subcontractors can be selected in subcontract transactions. | Approved |
| SUB-002 | Subcontract Agreement | The ERP shall record subcontract agreements and values. | Formalize subcontract commercial commitments. | Must Have | V0.5 Subcontracts | SUB-001,PRJ-001 | An agreement can be created against a project/subcontractor with a stable identity and value. | Approved |
| SUB-003 | Work Order | The ERP shall support Work Orders under subcontract arrangements where applicable. | Issue defined scopes of work. | Must Have | V0.5 Subcontracts | SUB-002 | Authorized users can create Work Orders with scope and commercial references. | Approved |
| SUB-004 | Scope of Work | Subcontract agreements/work orders shall record Scope of Work. | Clarify subcontract deliverables. | Must Have | V0.5 Subcontracts | SUB-002 | Scope text/details are stored and reviewable. | Approved |
| SUB-005 | Progress Claim | The ERP shall support subcontractor Progress Claims. | Capture claimed work value. | Must Have | V0.5 Subcontracts | SUB-002 | Progress Claims can be submitted against valid subcontract arrangements. | Approved |
| SUB-006 | Progress Claim Assessment | The ERP shall support assessment of submitted subcontract claims. | Control payable value. | Must Have | V0.5 Subcontracts | SUB-005 | Authorized users can record assessed/certified values distinct from claimed values. | Approved |
| SUB-007 | Payment Certification | The ERP shall support payment certification for subcontract claims. | Provide an approved basis for Finance payment. | Must Have | V0.5 Subcontracts | SUB-006,FND-005 | A certified amount can be approved and referenced by Finance. | Approved |
| SUB-008 | Retention Calculation | The ERP shall support retention on subcontract claims. | Track withheld commercial amounts. | Must Have | V0.5 Subcontracts | SUB-007 | Retention amount can be calculated/recorded according to configured commercial rules. | Approved |
| SUB-009 | Variation Orders | The ERP shall support subcontract Variation Orders. | Manage approved changes in subcontract value/scope. | Must Have | V0.5 Subcontracts | SUB-002,FND-005 | Variations can be recorded, approved and traced to the subcontract. | Approved |
| SUB-010 | Subcontract Status | Subcontracts shall have lifecycle status. | Support operational control. | Must Have | V0.5 Subcontracts | SUB-002,ADM-006 | Subcontract status uses configured approved values. | Approved |
| SUB-011 | Finance Payment Reference | Subcontracts shall display Finance payment status/reference for certified amounts while Finance remains the payment owner. | Provide visibility without duplicating payment data. | Must Have | V0.6 Finance | SUB-007,FIN-006 | Users can trace a certified claim to related Finance payment information. | Approved |

## Finance

| ID | Requirement | Description | Business Reason | Priority | Target Release | Dependencies | Acceptance Criteria | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| FIN-001 | Supplier Invoice | The ERP shall record Supplier Invoices. | Capture supplier liabilities. | Must Have | V0.6 Finance | MST-002 | Authorized users can create and maintain supplier invoice records with stable identity. | Approved |
| FIN-002 | Supplier Invoice Items | Supplier Invoices shall support line items. | Provide line-level financial traceability. | Must Have | V0.6 Finance | FIN-001 | Invoice lines can be captured with amounts and source references where applicable. | Approved |
| FIN-003 | PO and Goods Receipt Reference | Supplier invoices shall reference Purchase Orders and Goods Receipts where applicable. | Support three-way commercial traceability. | Must Have | V0.6 Finance | FIN-001,PROC-009,INV-001 | Users can identify the related PO/GRN for supplier invoices where relevant. | Approved |
| FIN-004 | Client Invoice | The ERP shall support client/customer invoices. | Record project receivables. | Must Have | V0.6 Finance | PRJ-001,MST-001 | Authorized users can create client invoices related to valid projects/customers. | Approved |
| FIN-005 | Accounts Payable and Receivable Views | The ERP shall provide AP and AR visibility from invoice/payment records. | Support outstanding financial management. | Must Have | V0.6 Finance | FIN-001,FIN-004,FIN-006 | Users can identify outstanding supplier and client balances. | Approved |
| FIN-006 | Payment | The ERP shall record payment transactions. | Capture actual cash settlement. | Must Have | V0.6 Finance | FND-011 | Authorized users can record payments with amount, date and relevant counterparty/source references. | Approved |
| FIN-007 | Payment Allocation | Payments shall be allocatable to invoices or certified claims where applicable. | Maintain settlement traceability. | Must Have | V0.6 Finance | FIN-006 | Payment allocations identify which liability/receivable was settled and by how much. | Approved |
| FIN-008 | Retention Accounting | Finance shall support retention accounting for relevant transactions. | Track withheld/payable retention amounts. | Must Have | V0.6 Finance | SUB-008 | Retention balances can be represented in finance records where applicable. | Approved |
| FIN-009 | Subcontract Claim Payment Reference | Payments for subcontract work shall reference certified subcontract claims where applicable. | Connect Finance to certified commercial value. | Must Have | V0.6 Finance | FIN-006,SUB-007 | Finance payment records can reference the underlying certified claim. | Approved |
| FIN-010 | Project Cash Flow | The ERP shall provide project cash-flow visibility from relevant finance transactions. | Support project financial planning/monitoring. | Must Have | V0.6 Finance | FIN-001,FIN-004,FIN-006 | Cash inflows/outflows can be summarized by Project over time. | Approved |
| FIN-011 | Paid Cost Feed | Finance payment transactions shall feed Paid Cost information to Cost Control without replacing Actual Cost. | Maintain correct cost-state semantics. | Must Have | V0.7 Cost Control | FIN-006,COST-005 | Cost Control can report paid amounts separately from actual recognized cost. | Approved |
| FIN-012 | Supplier Invoice Approval | Supplier Invoices shall use the approval framework before becoming eligible for approved financial/cost recognition workflows. | Prevent unapproved supplier liabilities from being treated as authorized cost. | Must Have | V0.6 Finance | FIN-001,FND-005 | Supplier Invoices can be submitted, approved or rejected; only approved invoices are eligible for downstream approved-cost processing. | Approved |
| FIN-013 | Client Invoice Approval | Client Invoices shall use the approval framework before being treated as approved receivables. | Control customer billing authorization. | Must Have | V0.6 Finance | FIN-004,FND-005 | Client Invoices can be submitted, approved or rejected and approval status is retained. | Approved |
| FIN-014 | Payment Approval | Payment transactions shall use the approval framework before being treated as approved/posted payments. | Prevent unauthorized cash settlement. | Must Have | V0.6 Finance | FIN-006,FND-005 | Payments can be submitted, approved or rejected; only approved payments feed Paid Cost and settlement reporting. | Approved |

## Cost Control

| ID | Requirement | Description | Business Reason | Priority | Target Release | Dependencies | Acceptance Criteria | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| COST-001 | Original Budget Consumption | Cost Control shall consume the approved Original Budget from BOQ & Budget rather than recreating it. | Maintain single ownership of budget data. | Must Have | V0.7 Cost Control | BUD-003 | Original budget values are available to Cost Control from the approved budget source. | Approved |
| COST-002 | Revised Budget Consumption | Cost Control shall consume the current approved Revised Budget. | Provide current control baseline. | Must Have | V0.7 Cost Control | BUD-004 | Current approved revised budget is available without duplicating budget ownership. | Approved |
| COST-003 | Committed Cost | Cost Control shall calculate/report Committed Cost separately from Actual Cost. | Distinguish commercial commitment from recognized cost. | Must Have | V0.7 Cost Control | PROC-021,SUB-002,SUB-003 | Approved commitments can be summarized without being classified automatically as Actual Cost. | Approved |
| COST-004 | Actual Cost | Cost Control shall report Actual Cost according to an approved cost-recognition policy. | Provide reliable project cost reporting. | Must Have | V0.7 Cost Control | FIN-012,SUB-007 | Recognized approved supplier/subcontract/direct costs can be reported as Actual Cost according to documented rules. | Approved |
| COST-005 | Paid Cost | Cost Control shall report Paid Cost separately from Actual and Committed Cost. | Distinguish cash payment from cost recognition. | Must Have | V0.7 Cost Control | FIN-011 | Paid amounts are derived from Finance payments and displayed separately. | Approved |
| COST-006 | Forecast Cost | The ERP shall support Forecast Cost representing expected final cost. | Support forward-looking project control. | Must Have | V0.7 Cost Control | COST-004,COST-003 | Forecast Cost can incorporate actual cost, remaining commitments and forecast cost to complete. | Approved |
| COST-007 | Cost to Complete | The ERP shall support Cost to Complete for Project/WBS. | Estimate remaining spend. | Must Have | V0.7 Cost Control | COST-006 | Expected remaining cost can be maintained or calculated for eligible scope. | Approved |
| COST-008 | Cost Variance | The ERP shall support variance such as Revised Budget minus Forecast Cost. | Identify overruns/savings. | Must Have | V0.7 Cost Control | COST-002,COST-006 | Variance is calculable and reportable at supported dimensions. | Approved |
| COST-009 | Contract Value | Cost Control shall expose Original Contract Value and support revised commercial value from approved variations where available. | Provide revenue baseline for profitability. | Must Have | V0.7 Cost Control | PRJ-004 | Original contract value is available and revised value can be derived when variation functionality exists. | Approved |
| COST-010 | Project Revenue | Cost Control shall support project revenue measures including approved variation value, revised contract value, billing and cash received when available. | Support profitability analysis. | Must Have | V0.7 Cost Control | FIN-004,FIN-006,COST-009 | Revenue measures can be reported without duplicating Finance source transactions. | Approved |
| COST-011 | Forecast Profit | The ERP shall support Forecast Profit based on current forecast revenue/cost assumptions. | Provide management forecast visibility. | Must Have | V0.7 Cost Control | COST-006,COST-010 | Forecast Profit is calculated consistently from approved revenue/cost measures. | Approved |
| COST-012 | Actual Profit | The ERP shall support Actual Profit based on recognized actual revenue/cost policy. | Provide realized project performance visibility. | Must Have | V0.7 Cost Control | COST-004,COST-010 | Actual Profit can be derived consistently from recognized values. | Approved |
| COST-013 | Cost Reporting Dimensions | All eligible cost measures shall be reportable by Project, WBS, Cost Code and supported combinations. | Enable construction cost analysis. | Must Have | V0.7 Cost Control | WBS-005 | Budget, committed, actual, paid and forecast measures can be summarized using the approved dimensions. | Approved |
| COST-014 | Cost Recognition Policy Documentation | The exact accounting/cost recognition rules shall be documented before Finance/Cost Control production use. | Avoid ambiguous Actual Cost treatment. | Must Have | V0.6 Finance | FIN-001 | A reviewed policy defines when supplier, subcontract and direct costs become Actual Cost before V0.7 calculations are relied upon. | Approved |

## Documents

| ID | Requirement | Description | Business Reason | Priority | Target Release | Dependencies | Acceptance Criteria | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| DOC-001 | Document Metadata | The ERP shall store document metadata in PostgreSQL. | Enable searchable, relational document references. | Must Have | V0.1 Foundation | FND-011 | Document metadata includes stable ID, filename/path, MIME type, uploader and upload timestamp. | Approved |
| DOC-002 | Local Prototype File Storage | Actual prototype files shall be stored on the local filesystem rather than inside PostgreSQL. | Keep prototype infrastructure free and simple. | Must Have | V0.1 Foundation | ARCH-006 | Users can upload/retrieve files using local storage without requiring paid object storage. | Approved |
| DOC-003 | Storage Abstraction | Business modules shall access files through a storage abstraction rather than direct provider-specific logic. | Allow later storage migration. | Must Have | V0.1 Foundation | DOC-002 | Core business modules do not need redesign if local storage is replaced by object storage. | Approved |
| DOC-004 | Entity Association | Documents shall support association to a Related Entity and Related Entity ID. | Allow files to be attached across ERP modules. | Must Have | V0.1 Foundation | DOC-001 | A document can be linked to a supported business record while retaining one document metadata source. | Approved |
| DOC-005 | Project Documents | Documents shall support association with Projects. | Manage core project files. | Must Have | V0.1 Foundation | DOC-004,PRJ-001 | Project users can view documents associated with the selected Project. | Approved |
| DOC-006 | WBS and Activity Documents | Documents shall support association with WBS and Activities. | Manage work-package and site-execution files. | Must Have | V0.2 Project & Scheduling | DOC-004,WBS-001,SCH-001 | Documents can be linked to valid WBS/Activity records. | Approved |
| DOC-007 | Procurement Documents | Documents shall support association with procurement transactions. | Retain quotations, PO attachments and supporting files. | Should Have | V0.3 Procurement | DOC-004,PROC-001 | Documents can be linked to relevant procurement records. | Approved |
| DOC-008 | Inventory and Equipment Documents | Documents shall support association with inventory transactions and equipment records. | Retain receiving/equipment supporting evidence. | Should Have | V0.4 Inventory | DOC-004 | Documents can be linked to inventory/equipment records as applicable. | Approved |
| DOC-009 | Subcontract and Finance Documents | Documents shall support association with subcontract and finance transactions. | Retain commercial and financial supporting documents. | Should Have | V0.6 Finance | DOC-004 | Documents can be linked to supported subcontract/finance records. | Approved |
| DOC-010 | Document Categories | The ERP shall support document categories/types such as contracts, drawings, BOQ files, RFIs, method statements, site instructions, inspections, photographs, reports and handover documents. | Support organized retrieval. | Should Have | V0.2 Project & Scheduling | DOC-001 | Documents can be categorized using approved document-type values. | Approved |

## Reporting

| ID | Requirement | Description | Business Reason | Priority | Target Release | Dependencies | Acceptance Criteria | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| RPT-001 | Basic Operational Reporting | Each module shall introduce basic operational reporting with the module rather than waiting until V0.8. | Make releases usable operationally. | Must Have | V0.2 Project & Scheduling | FND-010 | Relevant module records can be filtered/viewed in basic operational reports. | Approved |
| RPT-002 | Project Engineer Dashboard | The ERP shall provide a Project Engineer view covering today's work, activities in progress, planned/actual progress, upcoming work, delays, material risks and site issues. | Support daily site management. | Must Have | V0.2 Project & Scheduling | SCH-001,SITE-001 | The dashboard presents current project execution information from source modules. | Approved |
| RPT-003 | Project Manager Dashboard | The ERP shall provide Project Manager visibility including Gantt, progress, delayed activities, critical path, lookaheads, procurement risks, budget vs actual and major site issues as data becomes available. | Support project control. | Must Have | V0.8 Management | SCH-017,PROC-019,COST-013 | Dashboard consolidates relevant project-control measures without duplicating source records. | Approved |
| RPT-004 | Management Dashboard | The ERP shall provide management visibility of project health, progress, schedule, cost, procurement, cash flow, profitability and major risks. | Support executive oversight. | Must Have | V0.8 Management | RPT-003 | Management can review consolidated cross-module indicators by Project. | Approved |
| RPT-005 | Procurement Reporting | The ERP shall provide basic procurement status reporting. | Support purchasing management. | Must Have | V0.3 Procurement | PROC-018 | Users can filter/view PR/RFQ/quotation/PO status and key dates. | Approved |
| RPT-006 | Inventory Reporting | The ERP shall provide inventory balance and movement reporting. | Support material control. | Must Have | V0.4 Inventory | INV-005,INV-012 | Users can report stock balances and transaction history by relevant filters. | Approved |
| RPT-007 | Subcontract Reporting | The ERP shall provide subcontract commitment, claim, certification and retention reporting. | Support subcontract commercial control. | Must Have | V0.5 Subcontracts | SUB-002,SUB-007,SUB-008 | Users can report key subcontract commercial states. | Approved |
| RPT-008 | Finance Reporting | The ERP shall provide basic AP, AR, payment and cash-flow reporting. | Support financial operations. | Must Have | V0.6 Finance | FIN-005,FIN-010 | Users can view outstanding balances, payments and project cash-flow information. | Approved |
| RPT-009 | Cost Reporting | The ERP shall report budget, committed, actual, paid, forecast and variance measures using Project/WBS/Cost Code dimensions. | Support integrated project cost control. | Must Have | V0.7 Cost Control | COST-013 | Cost reports expose the approved cost states without conflating them. | Approved |
| RPT-010 | Cross-Module Management Reporting | V0.8 shall consolidate cross-module dashboards and analytics using existing source-module data. | Provide one management view of ERP performance. | Must Have | V0.8 Management | RPT-002,RPT-005,RPT-006,RPT-008,RPT-009 | Cross-module reporting can combine data while preserving source-module ownership. | Approved |
| RPT-011 | Report Filtering and Export | Reports shall support filtering and export where appropriate using open-source-compatible tooling. | Make reports practical for operations. | Should Have | V0.8 Management | RPT-010,ARCH-001 | Supported reports can be filtered and exported without requiring a mandatory paid reporting library. | Approved |

## Administration

| ID | Requirement | Description | Business Reason | Priority | Target Release | Dependencies | Acceptance Criteria | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ADM-001 | Company Settings | The ERP shall provide configurable company settings. | Centralize organization-level configuration. | Must Have | V0.1 Foundation | FND-011 | Authorized administrators can maintain approved company settings. | Approved |
| ADM-002 | User Management | Administration shall provide user-account management while authentication remains owned by Foundation. | Separate configuration from security engine implementation. | Must Have | V0.1 Foundation | FND-001 | Authorized administrators can create/manage application users within approved controls. | Approved |
| ADM-003 | Role Configuration | Administration shall allow authorized configuration of roles. | Make RBAC manageable. | Must Have | V0.1 Foundation | FND-004 | Authorized administrators can create/update roles. | Approved |
| ADM-004 | Permission Configuration | Administration shall allow authorized assignment of permissions to roles. | Control access without code changes for every assignment. | Must Have | V0.1 Foundation | FND-004,ADM-003 | Role-permission assignments can be maintained and enforced by Foundation. | Approved |
| ADM-005 | Approval Matrix Configuration | Administration shall configure approval authority by role/business process. | Support controlled transaction approvals. | Must Have | V0.1 Foundation | FND-005,ADM-003 | Approval rules can be configured for supported processes and enforced by the approval framework. | Approved |
| ADM-006 | Status Configuration | Administration shall maintain configurable status values for supported business entities. | Avoid hardcoded status lists where configuration is appropriate. | Must Have | V0.1 Foundation | FND-011 | Authorized administrators can maintain allowed statuses used by supported modules. | Approved |
| ADM-007 | Number Sequence Configuration | Administration shall configure user-facing business-number sequences independently from internal database IDs. | Support controlled document numbering. | Must Have | V0.1 Foundation | SYS-003 | Configured sequences generate business numbers without changing stable internal identity. | Approved |
| ADM-008 | Project and Activity Types | Administration shall maintain Project Types and Activity Types. | Support configurable classification. | Should Have | V0.2 Project & Scheduling | FND-011 | Authorized administrators can maintain type values used by Projects/Scheduling. | Approved |
| ADM-009 | Default Calendar Configuration | Administration shall configure default working calendar settings consumed by Scheduling. | Centralize calendar configuration. | Must Have | V0.2 Project & Scheduling | SCH-011 | Authorized administrators can configure default working/non-working rules used to create/assign calendars. | Approved |
| ADM-010 | Audit Configuration | Administration shall provide approved audit configuration while the audit engine remains owned by Foundation. | Keep audit behavior governable. | Should Have | V0.1 Foundation | FND-006 | Authorized administrators can manage allowed audit settings without being able to rewrite audit history. | Approved |
| ADM-011 | System Configuration | Administration shall provide a controlled area for general system configuration. | Centralize configurable system behavior. | Must Have | V0.1 Foundation | FND-011 | Only authorized administrators can change system configuration values. | Approved |

## Cross-Cutting System Controls

| ID | Requirement | Description | Business Reason | Priority | Target Release | Dependencies | Acceptance Criteria | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| SYS-001 | Audit Metadata | Important transactions shall record relevant created, updated, submitted, approved, rejected and cancelled actor/timestamp fields. | Maintain accountability across modules. | Must Have | V0.1 Foundation | FND-006 | Applicable business records expose the required audit metadata and material changes are logged. | Approved |
| SYS-002 | No Hard Delete for Approved Transactions | Approved or posted business transactions shall not normally be physically deleted. | Protect historical reporting and auditability. | Must Have | V0.1 Foundation | FND-006 | Approved transactions use cancel/void/archive/inactive behavior where appropriate and remain historically traceable. | Approved |
| SYS-003 | Internal IDs Separate from Business Numbers | Stable database identity shall be separate from user-facing business/document numbers. | Allow number-format changes without breaking relationships. | Must Have | V0.1 Foundation | FND-011 | Changing a business number format does not alter database primary identity or relationships. | Approved |
| SYS-004 | Approval Lifecycle | Supported approval-controlled records shall use Draft, Submitted, Approved, Rejected and Cancelled states where applicable. | Provide consistent transaction control. | Must Have | V0.1 Foundation | FND-005 | Applicable modules can enforce the approved lifecycle consistently. | Approved |
| SYS-005 | Configurable Approval Authority | Approval authority shall be configurable by role and business process. | Support different approval responsibilities. | Must Have | V0.1 Foundation | ADM-005 | Approval permissions are derived from configured authority rather than hardcoded individual users. | Approved |
| SYS-006 | Single Data Owner | Each business record shall have one primary owning module and other modules shall reference rather than duplicate the source record. | Maintain one source of truth. | Must Have | V0.1 Foundation | None | Architecture and implementation do not create competing masters for the same business entity. | Approved |
| SYS-007 | Forward and Backward Transaction Traceability | Where business processes chain transactions, users shall be able to trace predecessor and successor records. | Support audit and investigation. | Must Have | V0.3 Procurement | FND-011 | Relevant transaction screens/APIs expose source and downstream references. | Approved |
| SYS-008 | Inactive Master Data | Master data shall generally be deactivated/archived instead of deleted when historically referenced. | Preserve referential integrity. | Must Have | V0.1 Foundation | SYS-002 | Inactive master records remain historically visible but are not selectable for new transactions when prohibited. | Approved |

## Architecture & Technology

| ID | Requirement | Description | Business Reason | Priority | Target Release | Dependencies | Acceptance Criteria | Status |
| --- | --- | --- | --- | --- | --- | --- | --- | --- |
| ARCH-001 | Open-Source Runtime | The prototype shall remain fully functional without mandatory paid software licenses or paid runtime services. | Meet the project's prototype cost constraint. | Must Have | V0.1 Foundation | None | A developer can run the prototype using the approved open-source stack without purchasing a runtime license. | Approved |
| ARCH-002 | Approved License Preference | New major runtime dependencies should prefer MIT, Apache-2.0, BSD-style or PostgreSQL-style licenses; GPL/AGPL dependencies require review. | Reduce licensing risk. | Must Have | V0.1 Foundation | ARCH-001 | Every major dependency has a recorded license and reviewed exceptions are documented. | Approved |
| ARCH-003 | Dependency License Register | Significant dependencies shall be recorded with package/product, purpose, version, license, source, prototype cost, runtime dependency, replaceability and review notes. | Prevent untracked licensing decisions. | Must Have | V0.1 Foundation | ARCH-001 | A dependency register exists and is updated before introducing significant dependencies. | Approved |
| ARCH-004 | Modular Monolith | The prototype backend shall use a modular monolith rather than microservices. | Reduce prototype complexity while preserving module boundaries. | Must Have | V0.1 Foundation | None | NestJS remains one deployable backend with clearly separated business modules. | Approved |
| ARCH-005 | UI Independence | Core business data and logic shall remain independent of replaceable UI libraries such as Frappe Gantt. | Avoid library lock-in. | Must Have | V0.1 Foundation | ARCH-004 | Replacing a frontend visualization library does not require redesigning core database/business rules. | Approved |
| ARCH-006 | Local Prototype Storage | The prototype shall use local filesystem document storage through an abstraction layer. | Avoid paid cloud storage while preserving future migration. | Must Have | V0.1 Foundation | ARCH-001 | Prototype file operations work locally and storage provider logic is isolated from business modules. | Approved |
| ARCH-007 | Approved Frontend Stack | The prototype frontend shall use React, TypeScript, Vite, MUI Core, TanStack Query, React Hook Form and Zod unless formally changed. | Keep implementation consistent with the architecture baseline. | Must Have | V0.1 Foundation | ARCH-001 | Frontend dependencies match the approved baseline; paid MUI X Pro/Premium is not required. | Approved |
| ARCH-008 | Approved Backend Stack | The prototype backend shall use NestJS and TypeScript with REST APIs unless formally changed. | Keep backend implementation consistent. | Must Have | V0.1 Foundation | ARCH-004 | Backend implementation uses the approved stack and exposes controlled REST APIs. | Approved |
| ARCH-009 | Approved Database Stack | The prototype shall use PostgreSQL with Prisma ORM. | Maintain the approved relational architecture. | Must Have | V0.1 Foundation | ARCH-001 | Application persistence uses PostgreSQL and schema evolution uses Prisma migrations. | Approved |
| ARCH-010 | Approved Gantt Component | Frappe Gantt shall be the prototype Gantt UI unless formally changed, without owning scheduling logic. | Provide free schedule visualization without lock-in. | Must Have | V0.2 Project & Scheduling | ARCH-005 | Gantt visualization functions without embedding core schedule calculations in the UI library. | Approved |
| ARCH-011 | Background Jobs Deferred | Background-job infrastructure shall not be introduced until required; pg-boss is the preferred prototype option if needed. | Avoid unnecessary infrastructure. | Should Have | Future | ARCH-009 | No Redis/background service is required initially; any later queue introduction is justified and reviewed. | Approved |
| ARCH-012 | Podman Development Environment | Podman shall be the preferred prototype container environment. | Provide a reproducible free local environment. | Should Have | V0.1 Foundation | ARCH-001 | Local development can run the approved application/database components in a reproducible environment. | Approved |
| ARCH-013 | Git Portability | Source control shall remain standard Git and the ERP runtime shall not depend on GitHub. | Avoid development-platform lock-in. | Must Have | V0.1 Foundation | None | Repository can be migrated to another Git host and application runtime continues without GitHub. | Approved |
| ARCH-014 | Responsive Web Application | The prototype shall support desktop, laptop, tablet and mobile browser layouts. | Support office and site usage. | Must Have | V0.2 Project & Scheduling | ARCH-007 | Core V0.2 workflows are usable on supported responsive viewport classes. | Approved |
| ARCH-015 | Offline Sync Deferred | Offline synchronization is not an initial prototype requirement but architecture should not unnecessarily prevent later introduction. | Control prototype scope. | Future | Future | ARCH-014 | No V0.1/V0.2 feature depends on offline sync; future addition remains feasible without replacing the core data model. | Approved |
| ARCH-016 | Technology Selection Review | New significant technology shall be evaluated for business need, license, free alternative, replaceability, complexity and recurring cost before adoption. | Prevent uncontrolled dependency growth. | Must Have | V0.1 Foundation | ARCH-003 | Significant dependency additions have a documented review before adoption. | Approved |

---

# 7. Requirement Change Control

Once a requirement is approved:

- Its Requirement ID must not change.
- Material requirement changes must be recorded.
- Changes affecting an approved release must follow Change Control.
- Removed requirements should be marked **Cancelled** or **Deferred** rather than deleted.
- GitHub Issues must reference the corresponding Requirement ID.
- New requirements introduced after Architecture Baseline v0.1 must identify whether they require an architecture decision or blueprint change.

---

# 8. Traceability Rule

The required traceability model is:

Architecture Blueprint  
→ Requirement ID  
→ GitHub Issue  
→ Database / API / Frontend Implementation  
→ Test Case  
→ UAT  
→ Release

A feature must not be considered complete solely because a frontend screen exists.

---

# 9. Release Mapping Rule

The Target Release in this register reflects the earliest intended release from Architecture Baseline v0.1.

Canonical release values are:

- V0.1 Foundation
- V0.2 Project & Scheduling
- V0.3 Procurement
- V0.4 Inventory
- V0.5 Subcontracts
- V0.6 Finance
- V0.7 Cost Control
- V0.8 Management
- Future

If a requirement is moved between releases after approval, the change must be recorded through Change Control.

---

# 10. Requirements Audit

This register has been populated from **ERP-MASTER-BLUEPRINT.md — Architecture Baseline v0.1**.

The v0.1 requirements audit checks:

- Duplicate Requirement IDs
- Duplicate Requirement Names
- Broken Dependency References
- Requirements Depending on Later Releases
- Canonical Release Values
- Canonical Priority Values
- Module Ownership Conflicts
- Architecture / Requirement Terminology Consistency
- Finance approval completeness required by Cost Control

Audit result:

- Duplicate Requirement IDs: none
- Duplicate Requirement Names: none
- Broken Dependency References: none
- Later-release dependency conflicts: none
- Canonical release values: consistent
- Major module ownership conflicts: none identified
- Finance approval gap: corrected with FIN-012, FIN-013 and FIN-014

---

# 11. Open Business Rules for Later Detailed Design

The following areas are intentionally **not yet approved requirements** because they were not defined in Architecture Baseline v0.1.

They must be reviewed before the relevant module reaches implementation:

- Tax / VAT treatment
- Single-currency versus multi-currency operation
- Supplier invoice matching tolerances
- Partial receipt and over-receipt rules
- Retention release rules
- Notification delivery rules
- Detailed accounting posting / accrual policy
- Detailed client billing / progress-claim methodology

These items are recorded here so they are not forgotten, but they must not be treated as approved scope until a business decision is made and the resulting requirement is formally added.

---

# 12. Current Review State

Current status:

- Architecture baseline: established
- Requirements extraction: complete
- Requirements audit: complete
- Requirement approval review: complete
- Requirements baseline: approved as v0.1
- GitHub implementation issues: not yet created for individual requirements
- Application development: not started

Next Phase 0 activity after approval of this register:

**Database ERD**
