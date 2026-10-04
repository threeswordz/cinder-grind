# Construction ERP — Master Blueprint

**Document Status:** Architecture Baseline v0.1
**Current Phase:** V0.8 Management — ACTIVE / V0.8-A COMPLETE / V0.8-B COMPLETE / V0.8-C COMPLETE / V0.8-D PRE-FLIGHT ACTIVE
**System:** Construction ERP
**Primary Platform:** Web Application
**Architecture Principle:** Open-Source First

**V0.8-C closure checkpoint — 2026-10-04:** Executive / Cross-Project Management Dashboard is technically COMPLETE. Final PR #173 head `cbc916e5a325555d1971b0ceec6ae63445cfcaff` passed push CI #2886 and PR CI #2887 including authenticated live acceptance. Eight genuine DEC-022 findings across two review rounds were fixed/resolved and the final exact-head review reported no major issues. PR #173 squash-merged as `a73d11024adc8b7b1373b4c962f924a34e354e20`; post-merge main CI #2888 passed; Issue #172 closed completed. Stage C remains a read-only derived management layer over canonical modules with effective Project authorization before aggregation and no duplicate operational/financial source of truth.

---

# 1. Purpose

The purpose of the Construction ERP is to provide one integrated system for managing construction projects from project setup through planning, budgeting, procurement, site execution, inventory, equipment, subcontracting, finance, cost control, documents and management reporting.

The ERP must provide one source of truth for:

* Project structure
* Project schedule
* Project progress
* BOQ and budget
* Procurement
* Materials
* Inventory
* Equipment
* Subcontracts
* Financial transactions
* Project cost
* Forecast cost
* Project profitability
* Documents
* Operational reporting
* Management reporting

The system will initially be developed as a working prototype using free and open-source technology.

---

# 2. Core Architecture

## 2.1 Project Structure

The canonical construction project hierarchy is:

Project
→ WBS
→ Activity

### Project

A Project represents the overall construction project or contract.

Example:

Factory Construction

### WBS

WBS means Work Breakdown Structure.

The WBS divides a project into manageable construction work packages, areas, disciplines or phases.

A WBS may contain multiple hierarchical levels.

Example:

Project: Factory Construction

WBS 01: Groundworks
WBS 01.01: Ground Floor Slab

### Activity

An Activity represents an individual scheduled item of construction work.

Example:

* Setting Out
* Excavation
* Compaction
* Blinding Concrete
* Reinforcement
* Concrete Pour

The database and API will use the term **Activity** consistently.

The word **Task** may still be used in normal user-facing language where appropriate, but Activity is the canonical system term.

---

## 2.2 Cost and Commercial Dimensions

Financial and cost transactions must be attributable, where applicable, to three independent dimensions:

Project

* WBS
* Cost Code

### Project

Identifies which construction project the transaction belongs to.

### WBS

Identifies where within the construction work breakdown structure the transaction belongs.

### Cost Code

Identifies the type or nature of the cost.

Example:

Project: Factory Construction
WBS: Ground Floor Slab
Cost Code: MAT-STEEL
Transaction: Purchase of 16mm reinforcement bars

WBS and Cost Code are separate dimensions.

Cost Code must not be treated as a child of WBS.

This allows reporting such as:

* Cost by Project
* Cost by WBS
* Cost by Cost Code
* Cost by Project + WBS
* Cost by Project + Cost Code
* Cost by Project + WBS + Cost Code

---

## 2.3 Transaction Traceability

Transactions must maintain traceability across the ERP.

Example:

Purchase Request
→ RFQ
→ Supplier Quotation
→ Quotation Comparison
→ Purchase Order
→ Goods Receipt
→ Supplier Invoice
→ Payment

Each transaction must retain references to the preceding transaction where applicable.

The ERP must allow a user to trace a transaction backward and forward through its business process.

---

# 3. Canonical ERP Modules

The following module names are the canonical module names used in:

* ERP documentation
* GitHub Projects
* Requirements
* Development tracking
* Future application navigation

The modules are:

1. Foundation
2. Master Data
3. Projects
4. WBS & Cost Codes
5. Planning & Scheduling
6. BOQ & Budget
7. Site Execution
8. Procurement
9. Inventory
10. Equipment
11. Subcontracts
12. Finance
13. Cost Control
14. Documents
15. Reporting
16. Administration

Each business capability must have one primary owning module.

Other modules may reference the data, but ownership must remain clear.

---

# 4. Foundation

Foundation provides the technical and control capabilities required by all ERP modules.

It includes:

* Authentication
* Authorization
* Role-Based Access Control
* Session management
* Security framework
* Approval workflow framework
* Audit framework
* Error handling framework
* Validation framework
* Application logging
* API foundation
* Database foundation

Authentication is mandatory from V0.1.

The prototype must not require a paid hosted authentication provider.

---

# 5. Master Data

Master Data owns shared reference information used by multiple ERP modules.

Initial shared master data includes:

* Customers
* Suppliers
* Employees
* Materials
* Units of Measure

Domain-specific master data will remain within its owning module.

Examples:

* Cost Codes → WBS & Cost Codes
* Warehouses → Inventory
* Equipment → Equipment
* Subcontractors → Subcontracts
* Project Types → Administration
* Activity Types → Administration

This avoids maintaining the same master information in multiple modules.

---

# 6. Projects

The Projects module owns the main construction project record.

Project information includes:

* Project ID
* Project Code
* Project Name
* Customer
* Contract Value
* Project Location
* Project Description
* Project Team
* Project Contacts
* Planned Start Date
* Planned Completion Date
* Actual Start Date
* Actual Completion Date
* Project Status

Documents associated with a project are managed through the Documents module.

WBS structures are managed through the WBS & Cost Codes module.

Activities are managed through Planning & Scheduling.

---

# 7. WBS & Cost Codes

## 7.1 WBS

The ERP must support hierarchical Work Breakdown Structures.

WBS capabilities include:

* WBS Code
* WBS Name
* WBS Description
* Parent WBS
* Child WBS
* Work Package
* Active / Inactive Status
* Project Association

Example:

Project: Factory Construction

01 Groundworks
01.01 Ground Floor Slab
01.02 External Drainage

02 Structural Works
02.01 Columns
02.02 Beams
02.03 Upper Floor Slab

---

## 7.2 Cost Codes

Cost Codes classify the nature of construction costs.

Examples:

MAT-CONCRETE
MAT-STEEL
LAB-CARPENTRY
LAB-STEEL
EQP-EXCAVATOR
SUB-CONCRETE

Cost Codes are independent from the WBS hierarchy.

Transactions may reference both WBS and Cost Code.

There is no mandatory parent-child relationship between WBS and Cost Code.

---

# 8. Planning & Scheduling

Planning & Scheduling is a core ERP module.

It must manage the construction work programme.

Capabilities include:

* Project Master Programme
* Activities
* Activity Codes
* Activity Descriptions
* Summary Activities
* Planned Duration
* Planned Start
* Planned Finish
* Actual Start
* Actual Finish
* Forecast Start
* Forecast Finish
* Percentage Complete
* Activity Status
* Activity Owner
* Responsible Project Engineer
* Working Calendars
* Non-working Days
* Public Holidays
* Milestones
* Baseline Schedule
* Baseline vs Current Schedule
* Delay Tracking
* Critical Path
* Total Float
* 2-week Lookahead
* 4-week Lookahead
* Schedule Reports

---

## 8.1 Activity Dependencies

The scheduling engine must support activity relationships.

Dependency types should include:

* Finish-to-Start
* Start-to-Start
* Finish-to-Finish
* Start-to-Finish

Dependencies should support lag where required.

Example:

Excavation
→ Compaction
→ Blinding
→ Reinforcement
→ Inspection
→ Concrete Pour

---

## 8.2 Working Calendars

Project schedules must use working calendars rather than simple calendar-day calculations.

A calendar may define:

* Working weekdays
* Non-working weekdays
* Working hours
* Project holidays
* Public holidays
* Project-specific non-working days

Example:

20 working days must mean 20 days according to the assigned project calendar.

---

## 8.3 Gantt Schedule

The ERP must provide an interactive Gantt schedule.

The Gantt must display:

* WBS hierarchy
* Activities
* Start Date
* Finish Date
* Duration
* Progress
* Dependencies
* Milestones
* Status
* Baseline
* Current Forecast

The Gantt should support practical views such as:

* Day
* Week
* Month

Additional views may be introduced when required.

---

## 8.4 Groundworks Example

Example:

Project: Factory Construction

WBS: Groundworks
WBS: Ground Floor Slab

Summary programme:

Ground Floor Slab Groundworks — 20 working days

Activities may include:

* Setting Out
* Excavation
* Compaction
* Blinding Concrete
* Formwork
* Reinforcement
* Inspection
* Concrete Pour

The ERP must show:

* Original plan
* Current progress
* Actual dates
* Forecast completion
* Delay against baseline

---

## 8.5 Scheduling Architecture Rule

Frappe Gantt is the prototype Gantt visualization and interaction component.

Frappe Gantt must not own the ERP scheduling logic.

The ERP backend and database will own:

* Activities
* Dependencies
* Dependency Types
* Working Calendars
* Planned Dates
* Baseline Dates
* Actual Dates
* Forecast Dates
* Progress
* Milestones
* Delay Calculations
* Critical Path Calculations
* Float Calculations

This allows Frappe Gantt to be replaced later without redesigning the core scheduling architecture.

---

# 9. BOQ & Budget

The BOQ & Budget module owns construction quantities and approved project budgets.

Capabilities include:

* BOQ
* BOQ Sections
* BOQ Items
* Item Description
* Quantity
* Unit
* Rate
* Amount
* Original Budget
* Revised Budget
* Budget Revisions
* Budget Approval
* Budget by Project
* Budget by WBS
* Budget by Cost Code
* Budget Quantity
* Budget Rate
* Budget Amount

BOQ and budget information must be available to Procurement and Cost Control.

Cost Control consumes approved budget information but does not own creation of the BOQ.

---

# 10. Site Execution

The Site Execution module manages daily construction operations.

Capabilities include:

* Daily Site Report
* Activity Progress
* Manpower
* Material Usage
* Equipment Usage
* Weather
* Site Issues
* Delay Reasons
* Inspections
* Remarks
* Site Photographs
* Daily Progress Updates

Daily Site Reports must be capable of updating Activity progress.

Site photographs will use the Documents module for file storage.

Equipment records remain owned by the Equipment module.

Material inventory movements remain owned by the Inventory module.

---

# 11. Procurement

Procurement owns purchasing activities up to issuance and management of the Purchase Order.

Procurement capabilities include:

* Purchase Request
* Purchase Request Items
* Purchase Request Approval
* RFQ
* RFQ Suppliers
* Supplier Quotations
* Quotation Items
* Quotation Comparison
* Supplier Selection
* Purchase Order
* Purchase Order Items
* Purchase Order Approval
* Purchase Order Revisions
* Procurement Status
* Required-on-Site Date
* Expected Delivery Date
* Procurement Schedule

---

## 11.1 Purchase Order Cost Allocation

Where applicable, Purchase Order items must contain:

* Project
* WBS
* Cost Code
* Material
* Quantity
* Unit
* Unit Price
* Amount

This allows procurement commitments to flow into Cost Control.

---

## 11.2 Procure-to-Pay Workflow

The complete Procure-to-Pay workflow is:

Purchase Request
→ RFQ
→ Supplier Quotation
→ Quotation Comparison
→ Purchase Order
→ Goods Receipt
→ Supplier Invoice
→ Payment

Ownership is divided as follows:

### Procurement

Purchase Request
→ RFQ
→ Supplier Quotation
→ Quotation Comparison
→ Purchase Order

### Inventory

Goods Receipt

### Finance

Supplier Invoice
→ Payment

Traceability must remain continuous across all three modules.

---

## 11.3 Procurement and Schedule Integration

Procurement must interact with Planning & Scheduling.

The ERP must compare:

Required-on-Site Date

against:

Expected Delivery Date

Example:

Reinforcement Activity Start: 23 October
Material Required on Site: 22 October
Expected Supplier Delivery: 27 October

The ERP should identify the Activity as at risk.

The scheduling system must remain the owner of Activity dates.

Procurement remains the owner of supplier delivery information.

---

# 12. Inventory

Inventory owns physical material receipt and stock movement.

Capabilities include:

* Goods Receipt
* Goods Receipt Items
* Warehouse
* Stock Balance
* Stock Transactions
* Project Stock
* Site Stock
* Material Reservation
* Material Issue
* Material Return
* Stock Transfer

Goods Receipts should reference Purchase Orders where applicable.

Inventory movements must maintain transaction history.

Stock balances should be calculated from controlled inventory transactions rather than manually maintained values.

---

# 13. Equipment

Equipment owns construction equipment and equipment usage records.

Capabilities include:

* Equipment Register
* Equipment Type
* Equipment Status
* Project Assignment
* Equipment Availability
* Equipment Usage
* Equipment Usage History
* Maintenance Records
* Equipment Cost Allocation

Site Execution may record equipment used during a Daily Site Report.

The underlying equipment record remains owned by the Equipment module.

---

# 14. Subcontracts

Subcontracts owns subcontract commercial management.

Capabilities include:

* Subcontractor Register
* Subcontract Agreements
* Work Orders
* Scope of Work
* Subcontract Value
* Progress Claims
* Progress Claim Assessment
* Payment Certification
* Retention Calculation
* Variation Orders
* Subcontract Status

Finance owns the actual payment transaction.

The Subcontracts module must be able to display the Finance payment status and reference.

---

# 15. Finance

Finance owns financial invoices, receivables, payables and payment transactions.

Capabilities include:

* Supplier Invoices
* Supplier Invoice Items
* Client Invoices
* Accounts Payable
* Accounts Receivable
* Payments
* Payment Allocation
* Retention Accounting
* Project Cash Flow

Supplier invoices should reference:

* Purchase Order
* Goods Receipt

where applicable.

Subcontract payment transactions should reference certified subcontract claims where applicable.

---

# 16. Cost Control

Cost Control combines approved budgets with commercial and financial transactions.

The system must distinguish clearly between different cost states.

---

## 16.1 Original Budget

The first approved project budget.

---

## 16.2 Revised Budget

The current approved budget after authorized revisions.

---

## 16.3 Committed Cost

Cost that has been contractually or commercially committed but is not necessarily an Actual Cost yet.

Examples include:

* Approved Purchase Orders
* Approved Subcontracts
* Approved Work Orders

A Purchase Order must not automatically be treated as Actual Cost.

---

## 16.4 Actual Cost

Cost recognized according to the ERP's approved accounting/cost recognition rules.

Examples may include:

* Approved Supplier Invoice
* Certified Subcontract Claim
* Approved Direct Cost Posting

Goods Receipt may be used for accrual calculations later if required by the business.

The exact accounting recognition policy will be documented before Finance implementation.

---

## 16.5 Paid Cost

Money actually paid.

Paid Cost comes from Finance payment transactions.

Paid Cost is different from Actual Cost.

---

## 16.6 Forecast Cost

The expected final cost of completing the work.

Forecast Cost may incorporate:

* Actual Cost
* Remaining Commitments
* Forecast Cost to Complete

---

## 16.7 Cost to Complete

The expected remaining cost required to finish the project or selected WBS.

---

## 16.8 Variance

Cost variance must support comparison such as:

Revised Budget
minus
Forecast Cost

---

## 16.9 Revenue and Profitability

Cost Control should eventually support:

* Original Contract Value
* Approved Variation Value
* Revised Contract Value
* Client Billing to Date
* Cash Received
* Forecast Profit
* Actual Profit

---

## 16.10 Cost Reporting Dimensions

Cost transactions must be reportable using:

Project

* WBS
* Cost Code

WBS and Cost Code remain independent reporting dimensions.

---

# 17. Documents

Documents owns file metadata, categorization and storage integration.

Document types may include:

* Contracts
* Drawings
* BOQ Files
* Shop Drawings
* RFIs
* Method Statements
* Site Instructions
* Variation Orders
* Inspection Records
* Site Photographs
* Reports
* Handover Documents

Documents may be associated with:

* Project
* WBS
* Activity
* Procurement Transaction
* Inventory Transaction
* Equipment Record
* Subcontract
* Finance Transaction

---

## 17.1 Prototype File Storage

During the prototype, actual files will be stored on the local filesystem.

PostgreSQL will store document metadata such as:

* Document ID
* Related Entity
* Related Entity ID
* File Name
* File Path
* MIME Type
* Uploaded By
* Uploaded At

Files themselves will not normally be stored directly inside PostgreSQL.

---

## 17.2 Storage Abstraction

Application business modules must not directly depend on a specific storage provider.

A storage abstraction must allow:

Local Filesystem

to later become:

Object Storage

without redesigning core business modules or database relationships.

Paid object storage is not required during the prototype.

---

# 18. Reporting

Reporting owns operational reports, dashboards and management analytics.

Basic module reports should be introduced together with the relevant module.

V0.8 will consolidate cross-module management reporting and analytics.

---

## 18.1 Project Engineer Dashboard

The Project Engineer view should include:

* Today's Activities
* Activities in Progress
* Planned Progress
* Actual Progress
* Upcoming Work
* Delays
* Material Risks
* Site Issues

---

## 18.2 Project Manager Dashboard

The Project Manager view should include:

* Gantt Schedule
* Overall Progress
* Delayed Activities
* Critical Path
* 2-week Lookahead
* 4-week Lookahead
* Procurement Risks
* Budget vs Actual
* Major Site Issues

---

## 18.3 Management Dashboard

Management reporting should eventually include:

* Project Health
* Project Progress
* Schedule Performance
* Cost Performance
* Procurement Status
* Cash Flow
* Project Profitability
* Major Risks

---

## 18.4 Operational Reports

Reports should eventually cover:

* Projects
* Planning & Scheduling
* BOQ & Budget
* Site Execution
* Procurement
* Inventory
* Equipment
* Subcontracts
* Finance
* Cost Control

Reports should support filtering, viewing and export where appropriate.

Any reporting library introduced must comply with the Open-Source First Policy.

---

# 19. Administration

Administration owns configurable system settings.

Capabilities include:

* Company Settings
* User Management
* Role Configuration
* Permission Configuration
* Approval Matrix Configuration
* Number Sequence Configuration
* Status Configuration
* Project Types
* Activity Types
* Default Calendar Configuration
* System Configuration
* Audit Configuration

Administration configures these capabilities.

The underlying authentication, authorization, approval and audit engines remain part of Foundation.

---

# 20. Cross-Cutting System Controls

The following requirements apply across all ERP modules.

---

## 20.1 Audit Trail

Important transactions must record, where applicable:

* Created By
* Created At
* Updated By
* Updated At
* Submitted By
* Submitted At
* Approved By
* Approved At
* Rejected By
* Rejected At
* Cancelled By
* Cancelled At

Material changes must be recorded in the Audit Log.

Audit records must not be editable by ordinary users.

---

## 20.2 Record Deletion

Approved or posted business transactions should not normally be physically deleted.

Where appropriate, the system should use:

* Cancel
* Void
* Archive
* Inactive Status

rather than hard deletion.

Master data may be deactivated or archived when no longer in use.

This protects historical reporting and auditability.

---

## 20.3 Internal IDs and Business Numbers

Database identity must be separate from user-facing document numbers.

Example:

Internal ID:

A stable database identifier

Business Number:

PO2609-015

Changing a visible document-number format must not change the underlying database identity.

Numbering rules will be configured through Administration.

---

## 20.4 Approval Controls

Approval workflows must support:

* Draft
* Submitted
* Approved
* Rejected
* Cancelled

where applicable.

Approval authority must be configurable by role and business process.

More complex approval levels may be introduced later.

---

## 20.5 Data Ownership

Each business record must have one primary owning module.

Other modules may reference the record but should not duplicate the same source data.

This is intended to maintain one source of truth.

---

# 21. Open-Source First Policy

The prototype must remain fully functional without requiring paid software licenses or paid runtime services.

Core ERP functionality must use free and open-source software.

Preferred license categories include:

* MIT
* Apache-2.0
* BSD-style licenses
* PostgreSQL License

GPL or AGPL dependencies require review before adoption.

Commercial libraries must not become mandatory dependencies during the prototype.

A commercial component may only be considered after:

* The working prototype proves the requirement
* An open-source alternative has been evaluated
* The commercial component provides clear additional value
* Licensing implications are understood
* Recurring costs are understood
* The replacement does not compromise data portability

The architecture must avoid unnecessary vendor lock-in.

---

## 21.1 Dependency License Register

Every significant software dependency must be recorded before being introduced.

The register should contain:

* Package / Product
* Purpose
* Version
* License
* Repository / Source
* Free for Prototype
* Runtime Dependency
* Replaceable
* Review Notes

No developer should introduce a new commercial runtime dependency without explicit approval.

---

## 21.2 Development Services

Free hosted development services such as GitHub may be used.

They are not part of the ERP runtime architecture.

The ERP itself must continue to function without GitHub.

Source control must remain standard Git so that repositories can be migrated later if required.

---

# 22. Prototype Technology Architecture

## 22.1 Frontend

Approved prototype frontend stack:

* React
* TypeScript
* Vite
* MUI Core
* TanStack Query
* React Hook Form
* Zod

MUI X Pro and MUI X Premium must not be required by the prototype.

The application should be responsive for:

* Desktop
* Laptop
* Tablet
* Mobile Browser

The application should be designed so PWA capability may be introduced later.

Offline synchronization is not an initial prototype requirement.

---

## 22.2 Planning & Scheduling UI

Prototype scheduling visualization:

* Frappe Gantt

Frappe Gantt is a user-interface component only.

Scheduling business rules remain inside the ERP backend and database.

---

## 22.3 Backend

Approved prototype backend stack:

* NestJS
* TypeScript
* REST API

---

## 22.4 Database

Approved prototype database stack:

* PostgreSQL
* Prisma ORM

PostgreSQL is the system of record for ERP business data.

---

## 22.5 Background Processing

Background-job infrastructure will not be introduced initially.

If background processing becomes necessary, the preferred prototype option is:

* pg-boss

Possible future use cases include:

* Report Generation
* Notifications
* Scheduled Jobs
* Document Processing
* Long-running Calculations

Redis is not required for the initial prototype.

---

## 22.6 File Storage

Prototype:

* Local Filesystem

Future:

* Replaceable Object Storage

The application must use a storage abstraction.

---

## 22.7 Containerization

Prototype container environment:

* Podman

The local development environment should eventually support:

React Frontend
→ NestJS Backend
→ PostgreSQL

in a reproducible environment.

---

## 22.8 Source Control and Development Planning

Source Control:

* Git

Development Planning:

* GitHub Repository
* GitHub Projects
* GitHub Issues
* GitHub Pull Requests

GitHub is a development platform and is not part of the ERP runtime.

---

## 22.9 Technology Selection Rule

New technology must not be introduced only because it is convenient.

Before introducing a dependency, confirm:

* What business requirement does it solve?
* Is it open source?
* What license does it use?
* Is it free for the prototype?
* Is there a simpler open-source alternative?
* Does the ERP become dependent on it?
* Can it be replaced later?
* Does it create infrastructure complexity?
* Does it introduce recurring cost?

The default principle is:

**Use the simplest open-source technology that satisfies the requirement.**

---

# 23. Development Architecture

The prototype will use a **modular monolith** architecture.

The initial backend will be one NestJS application divided into clearly separated business modules.

Example:

Foundation
Projects
Scheduling
Budget
Procurement
Inventory
Equipment
Subcontracts
Finance
Cost Control
Documents
Reporting
Administration

Microservices will not be introduced during the prototype unless a future requirement clearly justifies the additional complexity.

Frontend and backend will remain logically separated.

Communication between them will occur through agreed API contracts.

The core database must remain independent of specific user-interface libraries.

---

# 24. Release Roadmap

The GitHub Release field will use:

* V0.1 Foundation
* V0.2 Project & Scheduling
* V0.3 Procurement
* V0.4 Inventory
* V0.5 Subcontracts
* V0.6 Finance
* V0.7 Cost Control
* V0.8 Management
* Future

---

## V0.1 Foundation

Scope:

* Authentication
* Users
* Roles
* Permissions
* Approval Framework
* Audit Framework
* Company Settings
* Number Sequences
* Customers
* Suppliers
* Employees
* Materials
* Units of Measure
* Projects
* WBS
* Cost Codes
* Basic Document Storage
* Basic Administration

Objective:

Establish the secure core ERP platform and fundamental Project + WBS + Cost Code structure.

---

## V0.2 Project & Scheduling

Scope:

* Activities
* Activity Dependencies
* Working Calendars
* Gantt Schedule
* Baseline
* Milestones
* Actual Progress
* Forecast Dates
* Delay Tracking
* Critical Path
* Float
* Daily Site Reports
* Site Photographs
* 2-week Lookahead
* 4-week Lookahead
* Equipment Register
* Equipment Assignment
* Equipment Usage
* Basic Project Reporting

Objective:

Allow project teams to plan, schedule and record construction execution.

---

## V0.3 Procurement

Scope begins with the commercial baseline required by Procurement.

### BOQ & Budget

* BOQ
* BOQ Items
* Original Budget
* Revised Budget
* Budget Approval
* Project / WBS / Cost Code Budgeting

### Procurement

* Purchase Request
* RFQ
* Supplier Quotations
* Quotation Comparison
* Purchase Order
* Purchase Order Revisions
* Procurement Approval
* Required-on-Site Dates
* Procurement Schedule
* Schedule Risk Integration

Objective:

Establish approved project budgets and manage purchasing from request through approved Purchase Order.

---

## V0.4 Inventory

Scope:

* Goods Receipt
* Warehouses
* Stock Transactions
* Stock Balance
* Project Stock
* Site Stock
* Material Reservation
* Material Issue
* Material Return
* Stock Transfer
* Inventory Reporting

Objective:

Track physical materials from receipt through site usage.

---

## V0.5 Subcontracts

Scope:

* Subcontractor Register
* Subcontract Agreements
* Work Orders
* Progress Claims
* Payment Certification
* Retention
* Variation Orders
* Subcontract Reporting

Objective:

Manage subcontract commercial commitments and progress claims.

---

## V0.6 Finance

Scope:

* Supplier Invoices
* Client Invoices
* Accounts Payable
* Accounts Receivable
* Payments
* Payment Allocation
* Retention Accounting
* Project Cash Flow
* Finance Reporting

Objective:

Connect procurement, subcontract and client transactions to financial settlement.

---

## V0.7 Cost Control

Scope:

* Original Budget
* Revised Budget
* Committed Cost
* Actual Cost
* Paid Cost
* Forecast Cost
* Cost to Complete
* Variance
* Contract Value
* Project Revenue
* Forecast Profit
* Actual Profit
* Project / WBS / Cost Code Rollups
* Cost Reporting

Objective:

Provide integrated project commercial and cost control.

---

## V0.8 Management

Scope:

* Executive Dashboard
* Project Dashboard
* Procurement Dashboard
* Schedule Dashboard
* Inventory Dashboard
* Cost Dashboard
* Finance Dashboard
* Cross-module Reporting
* Analytics
* Management Reporting

Objective:

Provide consolidated management visibility across the ERP.

Basic operational reporting will already exist in earlier releases.

V0.8 focuses on consolidated and cross-module management reporting.

---

# 25. Development Workflow

Every development item must progress through:

Backlog
→ Ready
→ In Development
→ Code Review
→ Testing
→ UAT
→ Ready for Release
→ Production

GitHub Projects will track this workflow.

A feature must not skip Testing or UAT simply because the user interface appears complete.

---

# 26. Definition of Done

A feature is not complete simply because its screen has been developed.

Where applicable, completion requires:

* Approved Business Requirement
* Acceptance Criteria
* Database Design
* Database Migration
* Backend / API
* Frontend
* Validation
* Permissions
* Audit Trail
* Error Handling
* Automated Testing
* Integration Testing
* User Acceptance Testing
* Documentation
* Staging Validation
* Production Deployment

Only after applicable requirements are complete may the feature be marked Production.

---

# 27. Change Control

New features and material requirement changes must be recorded in the Master Requirements Register.

Major architectural or business-rule decisions must be recorded in the Decision Log.

Changes affecting an approved release must be tracked as Change Requests.

Important requirements must not exist only in:

* Chat Conversations
* Meeting Notes
* Developer Notes
* Email
* Verbal Instructions

Once agreed, important requirements must be transferred into the permanent GitHub documentation and development tracker.

---

# 28. Current Phase

Completed Release:

**V0.7 Cost Control — COMPLETE AND ACCEPTED**

Next Release:

**V0.8 Management**

Current Stage:

**V0.8-D Domain Dashboards — PRE-FLIGHT ACTIVE / IMPLEMENTATION NOT STARTED**

Live delivery position:

- V0.1 Foundation — complete
- V0.2 Project & Scheduling — complete
- V0.3 Procurement — complete
- V0.4 Inventory — complete
- V0.5 Subcontracts — complete and accepted
- V0.6 Finance — complete and accepted
- V0.7 Cost Control — complete and accepted
- V0.8 Management Release Entry Gate — complete under DEC-025
- V0.8-A Management Read Model / KPI Contracts — complete
- V0.8-B Project Engineer & Project Manager Dashboards — complete
- V0.8-C Executive / Cross-Project Management Dashboard — complete
- V0.8-D Domain Dashboards — pre-flight active / implementation not started
- V0.8-E Cross-Module Reporting / Export / Hardening / Release Evidence — future

V0.8-B final head `4230e6ffff3e1c5a3dc7ee3b7669f86061e704ba` passed push/PR CI #2796/#2797; final DEC-022 exact-head re-review reported no major issues after the AC-V08-003 P1 fix. PR #170 merged as `42444cc91912f323d672f63da050b68b8d777b62`; post-merge main CI #2798 passed; Issue #169 closed completed. The live GitHub repository and `docs/CURRENT-STATE.md` remain authoritative.


# 29. Current Architecture Summary

The construction hierarchy is:

Project
→ WBS
→ Activity

The cost allocation dimensions are:

Project

* WBS
* Cost Code

The Procure-to-Pay process is:

Purchase Request
→ RFQ
→ Supplier Quotation
→ Quotation Comparison
→ Purchase Order
→ Goods Receipt
→ Supplier Invoice
→ Payment

The prototype runtime architecture is:

User
→ React + TypeScript
→ REST API
→ NestJS
→ Prisma ORM
→ PostgreSQL

Supporting prototype components are:

* Frappe Gantt for Gantt visualization
* Local filesystem for documents
* Podman for local containerization
* Git for source control
* GitHub for development planning

The prototype must not require paid runtime software or paid cloud services.

The architecture must remain modular, auditable and replaceable so that commercial components may be evaluated later without redesigning the core ERP.
