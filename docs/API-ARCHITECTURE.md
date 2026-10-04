**V0.8-A implementation note — 2026-10-04:** Management introduces read-only `GET /api/v1/management/projects/{projectId}/summary` and `GET /api/v1/management/portfolio` contracts. The Project summary composes aggregate-only canonical Scheduling/Site, Procurement, Inventory, V0.7 Cost Control and V0.6 Cash Flow services; it does not expose source rows merely because a caller holds Management permission. Portfolio filtering applies effective Project scope before aggregation. No Management mutation endpoint or duplicate KPI/financial ledger is introduced.

**V0.7-E implementation note — 2026-10-04:** The existing Project Cost Control read surface now carries the Stage-E RPT-009 report contract: server-authoritative Project/WBS/Cost Code filtering, parent-WBS descendant inclusion, explicit Unallocated allocation state, separate Budget/Committed/Actual/Paid/Forecast/Cost-to-Complete/Variance measures, Project-level revenue/profit where no canonical lower-dimensional allocation exists, and permission-sanitized source evidence. The Stage-E report UI consumes this read model; no second reporting ledger is introduced.

**V0.7-A implementation note — 2026-10-03:** Cost Control adds the read-only `GET /api/v1/projects/{projectId}/cost-control` surface with optional `wbsId` and `costCodeId` filters. It derives Original/Revised Budget, Procurement/Subcontract Committed Cost, Supplier/Subcontract Actual Cost and settlement-based Paid Cost from canonical source modules. Parent-WBS filters include descendants; header-level sources without canonical lower-dimensional allocation remain Unallocated and are excluded by WBS/Cost Code filters rather than synthetically prorated. The route requires explicit `cost.control.view` plus backend Company/Project scope. Detailed source records are returned only when the caller also holds the matching source-module view permission. No Cost Control mutation/source ledger is introduced in Stage A.

# Construction ERP — API Architecture

**Document Status:** API Architecture Baseline v0.1  
**Current Phase:** V0.8-B Project Engineer & Project Manager Dashboards — NEXT / NOT STARTED  
**Architecture Baseline:** v0.1  
**Requirements Baseline:** v0.1  
**Database Baseline:** v0.1  
**Roles & Permissions Baseline:** v0.1  
**Backend:** NestJS + TypeScript  
**Frontend:** React + TypeScript  
**API Style:** REST over HTTPS

**V0.6-D implementation note — 2026-10-03:** The active Finance/Subcontract integration now exposes read-only `GET /finance/retention-projects`, `GET /finance/projects/:projectId/retention`, and `GET /subcontracts/certifications/:certificationId/finance-reference` surfaces. Retention reads require `finance.retention.view`; Certification Payment-reference reads require both `subcontracts.certification.view` and `finance.payment.view`. The Documents target API reuses the canonical Project-owned Documents abstraction for Supplier Invoice, Client Invoice, Payment, Subcontract Agreement, Work Order, Claim, Certification and Variation; it revalidates Project access and the matching business-record view permission server-side. Subcontracts never mutates Finance Payments, and Stage D exposes no retention release/manual-adjustment endpoint. Runtime candidate `405aa627...` passed CI #2376; merge review remains pending.

---

# 1. Purpose

This document defines how the Construction ERP frontend and external clients communicate with the NestJS backend.

The API must:

- keep React independent from PostgreSQL
- keep business logic in the backend
- enforce authentication and authorization server-side
- expose consistent resource and action patterns
- validate all untrusted input
- preserve transaction and audit traceability
- support safe retries for sensitive operations
- support file upload and download without exposing filesystem paths
- remain compatible with the modular-monolith architecture
- remain free/open-source for the prototype

The API is the only supported application path between the React frontend and ERP business data.

React must never connect directly to PostgreSQL.

---

# 2. Runtime Communication Model

```text
Browser / React
      |
      | HTTPS / JSON
      v
NestJS REST API
      |
      | Prisma
      v
PostgreSQL

Document requests:
Browser
      |
      v
NestJS Documents API
      |
      v
Storage Abstraction
      |
      v
Local Filesystem (prototype)
```

Frappe Gantt consumes scheduling data through the same REST API.

It does not read PostgreSQL directly and does not own schedule calculations.

---

# 3. Base URL and Versioning

All business API routes use:

`/api/v1`

Examples:

`GET /api/v1/projects`

`POST /api/v1/purchase-orders`

`POST /api/v1/purchase-orders/{id}/submit`

The `v1` prefix represents the API contract version.

Breaking API changes require a new major API version such as:

`/api/v2`

Non-breaking additions may remain within v1.

The frontend must not depend on undocumented internal NestJS routes.

---

# 4. Transport and Content Types

Production traffic uses HTTPS.

Standard JSON requests use:

`Content-Type: application/json`

File upload uses:

`multipart/form-data`

File download returns the stored MIME type when safe and known.

Errors use:

`application/problem+json`

Dates and timestamps follow ISO 8601 conventions.

Date-only value:

`2026-10-05`

UTC timestamp:

`2026-10-05T08:30:00Z`

The frontend displays dates/times in the appropriate user/project timezone while the API stores timestamps consistently.

---

# 5. JSON Naming and Value Conventions

API JSON uses **camelCase**.

Database columns may use **snake_case**.

Example:

Database:

`planned_start_date`

API:

`plannedStartDate`

Internal UUIDs are represented as strings.

Money, quantities and other precise PostgreSQL numeric/decimal values are represented as **decimal strings** in JSON where precision matters.

Example:

```json
{
  "amount": "110000.00",
  "quantity": "5000.0000",
  "progressPercent": "35.00"
}
```

This avoids JavaScript floating-point precision becoming the accounting source of truth.

The backend performs authoritative decimal calculations.

---

# 6. Authentication Model

The prototype uses server-managed application sessions.

It does not require Auth0 or another paid hosted identity provider.

## 6.1 Login

`POST /api/v1/auth/login`

Example request:

```json
{
  "email": "engineer@example.com",
  "password": "********"
}
```

On successful authentication, NestJS creates a secure session and sends an opaque session token through an HTTP-only cookie.

The raw session token must not be stored in PostgreSQL.

Only a protected/hash representation is stored where session persistence requires it.

---

## 6.2 Session Cookie

Recommended cookie characteristics in production:

- HttpOnly
- Secure
- SameSite=Lax
- Path=/
- appropriate expiration / session lifetime

The exact cookie name is configuration-controlled.

Example:

`erp_session`

JavaScript cannot read the HTTP-only session cookie.

---

## 6.3 Current User

`GET /api/v1/auth/me`

Returns the authenticated user's non-sensitive profile, roles, effective permission summary and relevant application context.

The endpoint must never return:

- password hashes
- raw session tokens
- authentication secrets

---

## 6.4 Logout

`POST /api/v1/auth/logout`

Logout revokes the current server session and clears the browser session cookie.

---

## 6.5 Password Handling

Passwords are never returned through the API.

Password storage must use an approved password-hashing algorithm during implementation.

Password-hash details are never written to audit logs.

Password reset / recovery is not part of the approved V0.1 requirements baseline. If it becomes required, it must enter through Change Control and use approved open-source components.

---

# 7. CSRF Protection

Because browser authentication uses cookies, state-changing browser requests require CSRF protection.

The application uses a CSRF token strategy in addition to SameSite cookies.

A dedicated endpoint may provide the current CSRF token:

`GET /api/v1/auth/csrf`

State-changing requests include the token in a request header such as:

`X-CSRF-Token`

The backend validates CSRF protection for applicable:

- POST
- PUT
- PATCH
- DELETE

requests.

CSRF does not replace authentication or permission checks.

---

# 8. Authorization

Every protected backend route evaluates authorization according to Roles & Permissions Baseline v0.1.

Conceptually:

```text
Authenticated User
      |
      v
Required Permission
      |
      v
Project / Data Scope
      |
      v
Business-State Rules
      |
      v
Approval / Maker-Checker Rules
```

Frontend button visibility is not a security boundary.

The NestJS backend performs the final authorization decision.

---

## 8.1 Permission Enforcement

Example:

`POST /api/v1/purchase-orders/{id}/approve`

requires:

`procurement.po.approve`

and additionally verifies:

- Purchase Order is in an approvable state
- current approval step authorizes one of the user's Roles
- project/data scope is valid
- maker-checker restrictions pass

---

## 8.2 Project Scope

Project-scoped endpoints must enforce the approved project-access model.

A user may access a Project if:

- the user's linked Employee is an active Project Member

or:

- the user has `projects.access_all`

Having `projects.access_all` does not automatically grant edit or approval permission.

---

# 9. Resource Naming

REST resources use plural kebab-case nouns.

Examples:

- `/projects`
- `/wbs-nodes`
- `/cost-codes`
- `/activities`
- `/purchase-requests`
- `/purchase-orders`
- `/goods-receipts`
- `/supplier-invoices`
- `/client-invoices`
- `/payments`

URLs use internal UUIDs for entity identity.

Example:

`GET /api/v1/purchase-orders/0fb0f122-...`

Business numbers remain searchable/displayed but are not the canonical API identity.

---

# 10. Standard CRUD Patterns

Where applicable:

`GET /resource`

List resources.

`GET /resource/{id}`

Get one resource.

`POST /resource`

Create a resource.

`PATCH /resource/{id}`

Update allowed fields on an existing editable record.

`DELETE /resource/{id}`

is **not** the normal pattern for approved ERP transactions.

Approved transactions use explicit lifecycle actions.

Master/setup records generally use archive/deactivate actions rather than physical deletion once referenced.

---

# 11. Nested Resource Guidance

Avoid deeply nested routes.

Preferred:

`GET /api/v1/activities?projectId={projectId}&wbsId={wbsId}`

instead of:

`/projects/{projectId}/wbs/{wbsId}/activities/...`

Limited contextual nesting may be used when the child has no useful standalone meaning.

Example:

`GET /api/v1/projects/{projectId}/members`

The internal UUID of every persistent business entity remains addressable.

---

# 12. Business Action Endpoints

Business workflow transitions use explicit action endpoints rather than arbitrary status PATCHes.

Example Purchase Order lifecycle:

`POST /api/v1/purchase-orders/{id}/submit`

`POST /api/v1/purchase-orders/{id}/approve`

`POST /api/v1/purchase-orders/{id}/reject`

`POST /api/v1/purchase-orders/{id}/cancel`

`POST /api/v1/purchase-orders/{id}/revisions`

The frontend must not update:

`approvalState = "APPROVED"`

through a generic PATCH.

Only the backend workflow service may perform approval-state transitions.

---

# 13. Approval Endpoint Pattern

Approval-controlled resources use a consistent action pattern.

Examples:

```text
POST /purchase-requests/{id}/submit
POST /purchase-requests/{id}/approve
POST /purchase-requests/{id}/reject

POST /budgets/{id}/submit
POST /budgets/{id}/approve
POST /budgets/{id}/reject

POST /supplier-invoices/{id}/submit
POST /supplier-invoices/{id}/approve
POST /supplier-invoices/{id}/reject

POST /payments/{id}/submit
POST /payments/{id}/approve
POST /payments/{id}/reject
```

Action requests may contain an optional comment.

Example:

```json
{
  "comment": "Approved within current project budget."
}
```

The backend records approval actions in the approved approval-history model.

---

# 14. Operational Posting Endpoints

Operational transactions such as Inventory movements may use explicit posting actions.

Examples:

`POST /api/v1/goods-receipts/{id}/post`

`POST /api/v1/material-issues/{id}/post`

`POST /api/v1/material-returns/{id}/post`

`POST /api/v1/stock-transfers/{id}/post`

Posting creates authoritative stock-ledger effects.

Editing the draft header does not change stock until the relevant posting action succeeds.

---

# 15. Schedule API Pattern

Core scheduling resources include:

- activities
- activity-dependencies
- working-calendars
- schedule-baselines
- activity-progress

Examples:

`GET /api/v1/activities?projectId={id}`

`POST /api/v1/activities`

`PATCH /api/v1/activities/{id}`

`POST /api/v1/activity-dependencies`

`GET /api/v1/schedule/projects/{id}/analysis?mode=planned`

`GET /api/v1/schedule/projects/{id}/analysis?mode=forecast`

The schedule-analysis endpoint is the backend/domain read model for working-calendar-aware dates, Critical Path and Total Float. It returns calculated Activity dates, fractional work-day positions, Total Float and critical flags without making the Gantt component the source of truth.

`GET /api/v1/schedule/projects/{id}/gantt`

`GET /api/v1/schedule/projects/{id}/lookahead?asOf=YYYY-MM-DD&days=14`

`GET /api/v1/schedule/projects/{id}/lookahead?asOf=YYYY-MM-DD&days=28`

The Gantt endpoint is a read model optimized for schedule visualization. It presents the backend current forecast together with the current approved baseline, progress, dependency references, Activity status, Critical Path / Total Float indicators and baseline-delay classification.

The lookahead endpoint uses an inclusive calendar-day window selected by `asOf`: `days=14` for 2-week and `days=28` for 4-week. Activities are included when their current forecast span overlaps the window; completed Activities are not silently removed.

These endpoints do not create a second scheduling source of truth.

The backend remains responsible for:

- working-calendar calculations
- dependency validation
- baseline logic
- delay calculation
- Critical Path calculation
- float calculation

---

# 16. Cost-Control API Pattern

Cost Control primarily reads derived commercial data.

Examples:

`GET /api/v1/projects/{id}/cost-control`

`GET /api/v1/projects/{id}/cost-control?wbsId={id}`

`GET /api/v1/projects/{id}/cost-control?costCodeId={id}`

The response may include:

- Original Budget
- Revised Budget
- Committed Cost
- Actual Cost
- Paid Cost
- Forecast Cost
- Cost to Complete
- Variance
- Forecast Profit
- Actual Profit

The API must preserve distinct cost states.

Stage-E report responses also expose server-authoritative report dimensions/breakdown metadata, explicit Unallocated state and whether a parent-WBS filter includes descendants. Protected source records remain omitted unless the caller has the matching source-module detail permission.

A Purchase Order must not be exposed as Actual Cost merely because it is approved.

---

# 17. Request Validation

All request data is untrusted.

NestJS validates request:

- body
- path parameters
- query parameters
- uploaded file metadata

before business logic executes.

Validation includes, where applicable:

- required fields
- UUID format
- date format
- enum / controlled values
- maximum string length
- numeric precision/range
- positive/non-negative quantities
- percentage range 0–100
- business-number constraints
- line-item presence
- duplicate-line checks

Frontend validation improves user experience but does not replace backend validation.

---

# 18. Validation Error Response

Validation errors use the standard problem-details structure.

Example:

```json
{
  "type": "https://construction-erp.local/problems/validation-error",
  "title": "Validation failed",
  "status": 422,
  "code": "VALIDATION_ERROR",
  "detail": "One or more fields are invalid.",
  "instance": "/api/v1/purchase-orders",
  "correlationId": "0d7e...",
  "errors": [
    {
      "field": "items[0].quantity",
      "message": "Quantity must be greater than zero."
    }
  ]
}
```

---

# 19. Standard Error Format

API errors use an RFC Problem Details-style JSON structure.

Common fields:

- type
- title
- status
- code
- detail
- instance
- correlationId
- errors, when relevant

Internal stack traces, SQL errors, secrets and infrastructure details must not be returned to normal clients.

---

# 20. HTTP Status Baseline

| Status | Use |
| --- | --- |
| 200 | Successful read/update/action with response |
| 201 | Resource created |
| 204 | Successful action with no response body |
| 400 | Malformed request / invalid request structure |
| 401 | Authentication required / invalid session |
| 403 | Authenticated but not authorized |
| 404 | Resource not found within permitted scope |
| 409 | Business-state / concurrency / duplicate conflict |
| 413 | Upload/request too large |
| 415 | Unsupported media type |
| 422 | Field/business validation failure |
| 429 | Rate limit exceeded |
| 500 | Unexpected server error |

For scoped resources, the service may return 404 rather than reveal the existence of a record the user is not allowed to discover.

---

# 21. Success Response Pattern

Single-resource responses use:

```json
{
  "data": {
    "id": "...",
    "projectCode": "PJ26001",
    "projectName": "Factory Construction"
  }
}
```

List responses use:

```json
{
  "data": [],
  "meta": {
    "page": 1,
    "pageSize": 50,
    "totalItems": 0,
    "totalPages": 0
  }
}
```

Action responses may include the updated resource and action result.

---

# 22. Pagination

Standard business lists use page-based pagination for prototype usability.

Query parameters:

- `page`
- `pageSize`

Defaults:

- page = 1
- pageSize = 50

Maximum pageSize:

- 100 unless a specific endpoint documents otherwise

Example:

`GET /api/v1/purchase-orders?page=2&pageSize=50`

Large append-oriented feeds such as audit logs or stock transactions may use cursor-based pagination if required for performance.

Cursor pagination is endpoint-specific and must be documented.

---

# 23. Filtering

Filters are explicitly allowed per endpoint.

Example:

```text
GET /api/v1/purchase-orders
    ?projectId={uuid}
    &supplierId={uuid}
    &approvalState=APPROVED
    &fromDate=2026-10-01
    &toDate=2026-10-31
    &search=steel
```

The API must not expose unrestricted arbitrary database-column filtering.

Every supported filter is defined and validated by the endpoint.

Project-scope authorization is applied in addition to filters.

A user cannot filter their way into unauthorized Project data.

---

# 24. Sorting

Standard sorting parameter:

`sort`

Ascending:

`sort=poDate`

Descending:

`sort=-poDate`

Multiple sort fields may be supported where useful:

`sort=-poDate,poNumber`

Only endpoint-approved sort fields are accepted.

---

# 25. Search

List endpoints may support:

`search`

Search operates only on documented searchable fields.

Example Purchase Order search may include:

- PO number
- supplier name
- supplier reference

Search does not expose raw SQL or arbitrary full-database search.

---

# 26. Concurrency Control

The ERP must prevent silent overwrites of stale edits.

Mutable business resources expose:

- `updatedAt`

Update requests may include:

`expectedUpdatedAt`

Example:

```json
{
  "expectedUpdatedAt": "2026-10-05T08:30:00Z",
  "description": "Updated description"
}
```

If the stored record changed since that timestamp, the backend returns:

`409 Conflict`

with code:

`STALE_RECORD`

Sensitive approved transactions are changed through controlled revision/cancellation workflows rather than normal edit concurrency.

A future implementation may replace or supplement this convention with ETags without changing business semantics.

---

# 27. Idempotency

The API distinguishes ordinary editable requests from high-risk business actions.

## 27.1 Safe Reads

GET requests are naturally idempotent.

---

## 27.2 Standard Draft Updates

PATCH requests are designed so retrying the same payload does not create duplicate business records.

---

## 27.3 Sensitive Create / Post / Payment Actions

High-risk endpoints should accept:

`Idempotency-Key`

Examples include:

- payment creation/posting
- inventory posting actions
- other actions that may create financial/stock effects

The key is a client-generated unique value for one intended operation.

If the same valid Idempotency-Key is retried for the same user/company/endpoint and same operation payload, the backend should return the original operation result rather than create a duplicate effect.

If the same key is reused for a materially different payload, the backend returns a conflict.

---

## 27.4 Prototype Persistence Approach

Persistent generic idempotency storage is **not yet added as a mandatory Database Baseline table**.

During detailed V0.1 implementation, the team must choose one of:

1. persistent database-backed idempotency records, or
2. transaction-specific unique constraints/business keys where they provide equivalent duplicate protection.

If a general `idempotency_keys` table is required, it will be added through controlled database change before the affected sensitive endpoint reaches Production.

This is an implementation gate, not permission to omit duplicate-effect protection on Payments or posted Inventory transactions.

---

# 28. Database Transactions

A single API business operation that updates multiple related tables must use a database transaction where atomicity is required.

Examples:

- Create Purchase Order header + items
- Post Goods Receipt + stock ledger movements
- Post Material Issue + stock ledger movements
- Approve workflow action + business-state update
- Create Payment + allocation rows
- Save budget version + budget lines

If any required part fails, the atomic operation must roll back.

The React frontend never orchestrates database transaction boundaries.

NestJS application services own transaction boundaries.

---

# 29. Correlation IDs

Every incoming API request receives a correlation ID.

Preferred request header:

`X-Correlation-ID`

If the client does not supply one, the backend generates it.

The correlation ID is returned in:

`X-Correlation-ID`

and included in:

- application logs
- error responses
- audit events where useful
- background-job context where applicable later

Correlation IDs help trace one user action across logs and services.

They are not authentication tokens.

---

# 30. Audit Context

For auditable mutations, the backend provides audit context including:

- authenticated user ID
- company ID
- entity type
- entity ID
- action
- timestamp
- correlation ID
- material old/new values where appropriate

The frontend must not be allowed to impersonate:

- createdBy
- approvedBy
- actorUserId

The backend derives actor identity from the authenticated session.

---

# 31. File Upload Architecture

Actual files are stored through the Documents storage abstraction.

The browser never submits a trusted local filesystem path.

## 31.1 Upload

Prototype endpoint:

`POST /api/v1/documents`

Content type:

`multipart/form-data`

Request includes:

- file
- documentTypeId
- optional entityType
- optional entityId

The backend:

1. authenticates the user
2. checks upload/link permission
3. validates the document type
4. validates allowed size/type
5. generates a storage key
6. stores the file using the storage abstraction
7. writes document metadata to PostgreSQL
8. creates the optional document link
9. writes audit information

---

## 31.2 File Size

A default prototype upload-size limit must be configured.

The exact initial limit will be selected during V0.1 implementation.

Endpoints reject excessive uploads with:

`413 Payload Too Large`

Large construction-file use cases such as CAD/BIM files are not silently assumed to fit the initial prototype limit.

---

## 31.3 Download

`GET /api/v1/documents/{id}/content`

The backend:

1. authenticates the user
2. checks access to the linked record/document
3. resolves the storage provider/key
4. streams the content
5. sets safe response headers

The API does not expose a server filesystem path such as:

`/app-data/projects/PJ26001/...`

---

## 31.4 Document Metadata

`GET /api/v1/documents/{id}`

returns document metadata, not file bytes.

Metadata and content endpoints remain separate.

---

# 32. File Security

The Documents API must:

- reject unsafe filenames/path traversal
- generate server-controlled storage keys
- validate MIME type / extension according to policy
- prevent executable server-side path interpretation
- authorize download through the API
- avoid returning physical filesystem paths
- sanitize content-disposition filenames
- log upload/archive actions

Malware scanning is not an initial prototype requirement but may be introduced later.

---

# 33. API Module Boundaries

The NestJS modular-monolith API is divided by owning business module.

Conceptually:

```text
AppModule
 |
 +-- AuthModule
 +-- FoundationModule
 +-- MasterDataModule
 +-- ProjectsModule
 +-- WbsModule
 +-- SchedulingModule
 +-- BudgetModule
 +-- SiteExecutionModule
 +-- ProcurementModule
 +-- InventoryModule
 +-- EquipmentModule
 +-- SubcontractsModule
 +-- FinanceModule
 +-- CostControlModule
 +-- DocumentsModule
 +-- ReportingModule
 +-- AdministrationModule
```

Modules may call approved application services from other modules.

A module must not bypass another module's ownership by directly reimplementing its business rules.

---

# 34. Controller / Service / Repository Responsibilities

## Controller

Responsible for:

- route definition
- HTTP parsing
- authentication/permission guards
- DTO binding
- HTTP response mapping

Controllers should remain thin.

---

## Application / Domain Service

Responsible for:

- business rules
- workflow transitions
- project scope validation
- maker-checker rules
- transaction boundaries
- orchestration across owning modules

---

## Data Access

Prisma is used by controlled backend services/data-access components.

Raw database access from controllers is prohibited.

Raw SQL is used only when justified and reviewed, such as:

- PostgreSQL-specific constraints
- specialized reporting
- performance-critical query cases

Parameterized queries are mandatory.

---

# 35. API DTO Boundary

API request/response DTOs are not Prisma database models.

Do not expose Prisma objects blindly.

DTOs define the public API contract.

This allows:

- database column changes without accidental API breakage
- hiding sensitive/internal fields
- input validation
- response shaping
- API versioning

Examples of fields that must not be automatically exposed:

- passwordHash
- session token hash
- internal audit payloads
- storage filesystem paths
- sensitive configuration

---

# 36. API Documentation

The NestJS application will generate an OpenAPI specification from the implemented API.

During development, API documentation should expose:

- endpoint
- method
- required permission
- request schema
- response schema
- supported filters
- status codes
- example errors

OpenAPI documentation is a development aid.

It does not replace the permanent architecture and requirements documents.

Production exposure of interactive API documentation may be restricted.

---

# 37. CORS and Browser Deployment

Preferred production architecture is same-site/same-origin where practical:

Browser  
→ ERP Web Host  
→ /api/v1

This simplifies cookie and CSRF security.

For local development, CORS may allow only explicitly configured frontend development origins.

Wildcard credentialed CORS is prohibited.

Example allowed local origin:

`http://localhost:5173`

must be configuration-driven rather than hardcoded for production.

---

# 38. Rate Limiting

Authentication and other abuse-sensitive endpoints should support rate limiting.

At minimum:

- login attempts
- password recovery when implemented
- resource-intensive reports if needed later

Rate limiting is not a replacement for authentication/authorization.

The implementation must use an open-source-compatible approach.

---

# 39. API Security Baseline

The API must:

- validate all input
- parameterize database access
- enforce authorization server-side
- protect cookie-based state changes from CSRF
- hash/protect passwords and session tokens
- avoid secrets in logs
- avoid stack traces in user-facing errors
- enforce upload restrictions
- set appropriate security headers
- restrict CORS
- enforce sensible request-size limits
- audit sensitive business actions
- use HTTPS in production

No secret is committed to Git.

Runtime configuration is provided through environment/configuration mechanisms.

---

# 40. Environment Configuration

Typical configuration values include:

- DATABASE_URL
- application environment
- session secret / cryptographic configuration
- session lifetime
- CSRF configuration
- allowed frontend origin(s)
- local document storage root
- file-size limit
- log level

Secrets must not be stored in:

- README
- GitHub issues
- source code
- committed .env files

A safe example configuration file may document variable names without real secret values.

---

# 41. API Examples by Module

## 41.1 Projects

```text
GET    /api/v1/projects
POST   /api/v1/projects
GET    /api/v1/projects/{id}
PATCH  /api/v1/projects/{id}

GET    /api/v1/projects/{id}/members
POST   /api/v1/projects/{id}/members
```

---

## 41.2 WBS

```text
GET    /api/v1/wbs-nodes?projectId={id}
POST   /api/v1/wbs-nodes
PATCH  /api/v1/wbs-nodes/{id}
POST   /api/v1/wbs-nodes/{id}/archive
```

---

## 41.3 Activities / Schedule

```text
GET    /api/v1/activities?projectId={id}
POST   /api/v1/activities
PATCH  /api/v1/activities/{id}

POST   /api/v1/activity-dependencies
DELETE /api/v1/activity-dependencies/{id}

GET    /api/v1/schedule/projects/{id}/gantt
GET    /api/v1/schedule/projects/{id}/lookahead?asOf=YYYY-MM-DD&days=14
GET    /api/v1/schedule/projects/{id}/analysis?mode=planned
GET    /api/v1/schedule/projects/{id}/analysis?mode=forecast

GET    /api/v1/schedule-baselines?projectId={id}
GET    /api/v1/schedule-baselines/{id}
POST   /api/v1/schedule-baselines/submit
POST   /api/v1/schedule-baselines/{id}/approve
POST   /api/v1/schedule-baselines/{id}/reject

GET    /api/v1/activity-progress/{activityId}
POST   /api/v1/activity-progress/{activityId}

GET    /api/v1/schedule/projects/{id}/comparison
```

Schedule Baseline submission snapshots the current backend-calculated planned schedule and starts the configured `SCHEDULE_BASELINE` Approval Matrix workflow. Approved baseline snapshots and Activity Progress history are immutable/append-only records.

Project actual start/completion dates are additive fields on the existing Project PATCH contract and remain independent from planned dates.

Deleting an unapproved dependency relationship is not equivalent to deleting an approved ERP transaction.

---

## 41.4 Site Execution

```text
GET    /api/v1/site-execution/projects
GET    /api/v1/site-execution/projects/{projectId}/options
GET    /api/v1/site-execution/reports?projectId={id}
POST   /api/v1/site-execution/reports
GET    /api/v1/site-execution/reports/{id}
PATCH  /api/v1/site-execution/reports/{id}
POST   /api/v1/site-execution/reports/{id}/submit
POST   /api/v1/site-execution/reports/{id}/corrections

GET    /api/v1/site-execution/reports/{id}/documents
POST   /api/v1/site-execution/reports/{id}/photos
GET    /api/v1/site-execution/reports/{id}/documents/{documentId}/download
```

Daily Site Reports are unique by Project + reporting date and use the operational lifecycle `DRAFT → SUBMITTED`; they do not use the Approval Matrix.

Draft resource/observation rows include aggregated manpower, observational Material usage, canonical Equipment usage references, Activity progress, site issues, delay reasons and lightweight inspection references. On submission, each Daily Report progress line appends an authoritative row to the existing immutable `activity_progress` history with the report date and `DAILY_SITE_REPORT` source reference.

Material-use rows do not post Inventory or change Stock Balance. Delay observations do not move Activity schedule dates or replace backend schedule-delay classification. Photographs/files reuse the Documents storage abstraction and generic document-link metadata; storage keys remain server-only.

V0.2-F activates Equipment selection through the canonical Equipment Register. A Daily Site Report may reference only active, operationally available Equipment assigned to the report Project on the report date; free-text Equipment remains prohibited. Submission materializes each Equipment line into canonical Equipment Usage history, and submitted-report Equipment corrections append later history rather than rewriting the original usage.

Submitted Daily Site Report content is immutable. Corrections are append-only records and do not overwrite the submitted record. A correction may also append corrected Activity percentages to the immutable `activity_progress` history using the original report date and `DAILY_SITE_REPORT_CORRECTION` source traceability.

---

## 41.5 Equipment

```text
GET    /api/v1/equipment/projects

GET    /api/v1/equipment/types
POST   /api/v1/equipment/types
PATCH  /api/v1/equipment/types/{id}

GET    /api/v1/equipment/register?asOf=YYYY-MM-DD
POST   /api/v1/equipment/register
PATCH  /api/v1/equipment/register/{id}

GET    /api/v1/equipment/projects/{projectId}/available?asOf=YYYY-MM-DD
GET    /api/v1/equipment/register/{id}/assignments
POST   /api/v1/equipment/register/{id}/assignments
POST   /api/v1/equipment/assignments/{id}/release

GET    /api/v1/equipment/usage?projectId={id}&equipmentId={id}
POST   /api/v1/equipment/usage
PATCH  /api/v1/equipment/usage/{id}
```

Equipment Type and Equipment are Company-owned master/configuration data. Project assignment and usage enforce effective Project scope and Company isolation.

Operational status is persisted only as `AVAILABLE` / `UNAVAILABLE`. User-facing availability is derived at an as-of date: inactive or operationally unavailable Equipment → `UNAVAILABLE`; otherwise an effective Project assignment → `ASSIGNED`; otherwise → `AVAILABLE`.

Assignment history is retained. Reassignment closes the prior open assignment instead of deleting it. Canonical Equipment Usage requires an assignment covering the usage date; optional operating hours must be greater than 0 and no more than 24. Manual usage may be audit-updated, but ordinary APIs do not delete usage history. Daily Site Report-origin usage is immutable and is corrected through append-only submitted-report corrections.

Maintenance records remain Future and Equipment cost allocation remains owned by V0.7 Cost Control.

---

## 41.6 Documents / Operational Reporting

```text
GET    /api/v1/documents/projects/{projectId}/targets/options
GET    /api/v1/documents/projects/{projectId}/targets/{WBS|ACTIVITY|PURCHASE_REQUEST|RFQ|SUPPLIER_QUOTATION|PURCHASE_ORDER}/{entityId}
POST   /api/v1/documents/projects/{projectId}/targets/{WBS|ACTIVITY|PURCHASE_REQUEST|RFQ|SUPPLIER_QUOTATION|PURCHASE_ORDER}/{entityId}
GET    /api/v1/documents/projects/{projectId}/targets/{WBS|ACTIVITY|PURCHASE_REQUEST|RFQ|SUPPLIER_QUOTATION|PURCHASE_ORDER}/{entityId}/{documentId}/download
POST   /api/v1/documents/projects/{projectId}/targets/{WBS|ACTIVITY|PURCHASE_REQUEST|RFQ|SUPPLIER_QUOTATION|PURCHASE_ORDER}/{entityId}/{documentId}/archive
POST   /api/v1/documents/projects/{projectId}/targets/{WBS|ACTIVITY|PURCHASE_REQUEST|RFQ|SUPPLIER_QUOTATION|PURCHASE_ORDER}/{entityId}/{documentId}/reactivate

GET    /api/v1/reporting/projects
GET    /api/v1/reporting/projects/{projectId}/project-engineer?asOf=YYYY-MM-DD&days=14|28
```

WBS and Activity documents reuse the existing secure Documents owner/storage model. Upload first creates the canonical Project link and then the validated WBS/Activity target link. The database requires the document, linker and target to share Company scope and requires every non-Project target link to have the matching Project link.

Operational reporting is a derived read model, not a new transaction ledger. The Project Engineer dashboard requires `reporting.operational.view` plus effective Project scope and composes current Scheduling/Gantt, approved 14/28-day lookahead, recent Daily Site Reports and effective operational Equipment assignments from their owning modules.

---

## 41.7 BOQ & Budget

```text
GET    /api/v1/budget/projects
GET    /api/v1/budget/revision-projects
GET    /api/v1/budget/projects/{projectId}/options

GET    /api/v1/budget/projects/{projectId}/boq
POST   /api/v1/budget/projects/{projectId}/boq
PATCH  /api/v1/budget/projects/{projectId}/boq
POST   /api/v1/budget/boqs/{boqId}/sections
PATCH  /api/v1/budget/sections/{sectionId}
POST   /api/v1/budget/boqs/{boqId}/items
PATCH  /api/v1/budget/items/{itemId}

GET    /api/v1/budget/revision-workflow-options
GET    /api/v1/budget/projects/{projectId}/revisions
GET    /api/v1/budget/revisions/{revisionId}
POST   /api/v1/budget/projects/{projectId}/revisions
POST   /api/v1/budget/revisions/{revisionId}/submit
POST   /api/v1/budget/revisions/{revisionId}/approve
POST   /api/v1/budget/revisions/{revisionId}/reject

GET    /api/v1/budget/projects/{projectId}/summary
GET    /api/v1/budget/projects/{projectId}/approved
```

V0.3-A has one canonical working BOQ per Project. BOQ Sections and BOQ Items retain stable identities and use soft active/inactive state rather than ordinary physical deletion. Item quantity must be greater than zero, rate must be non-negative, and amount is backend/database-derived as quantity × rate with four-decimal commercial precision.

Project is inherited from the BOQ. WBS and Cost Code are independent optional allocation dimensions: a WBS must belong to the BOQ Project while a Cost Code must belong to the same Company. UOM must be an active same-Company master record.

A Budget Revision is an immutable snapshot of the active BOQ at Draft creation. It receives its immutable business number from the configured Company Number Sequence code `BUDGET_REVISION`; V0.3-A deliberately does not hardcode the human-readable template because BR-V03-17 defers that format decision until before V0.3-B.

Draft creation does not start approval. Submission is a distinct Draft → Submitted transition that attaches the reusable `BUDGET_REVISION` Approval Matrix workflow and records the submitter/time. Maker-checker remains backend-enforced. Snapshot lines are immutable from creation; submitted/approved/rejected revision history is never physically deleted through ordinary application flows.

The revision whose approval completion event occurs first is the immutable Original Budget, even if a lower revision number is approved later. The highest/latest APPROVED revision number is the Current Revised Budget. Rejected revisions remain history and never become current. The summary endpoint derives Project totals plus independent WBS and Cost Code totals, including explicit unallocated buckets. The approved endpoint exposes the latest approved immutable source data for later Procurement without transferring BOQ/Budget ownership.

V0.3-A creates no Inventory movement, Supplier Invoice, Payment, Actual Cost, tax/VAT, FX accounting or V0.7 committed-cost ledger.

---

## 41.8 Purchase Requests

```text
GET    /api/v1/procurement/projects
GET    /api/v1/procurement/projects/{projectId}/options
GET    /api/v1/procurement/pr-workflow-options

GET    /api/v1/procurement/projects/{projectId}/purchase-requests
POST   /api/v1/procurement/projects/{projectId}/purchase-requests
GET    /api/v1/procurement/purchase-requests/{requestId}
PATCH  /api/v1/procurement/purchase-requests/{requestId}
POST   /api/v1/procurement/purchase-requests/{requestId}/copy-rejected

POST   /api/v1/procurement/purchase-requests/{requestId}/lines
PATCH  /api/v1/procurement/purchase-request-lines/{lineId}
DELETE /api/v1/procurement/purchase-request-lines/{lineId}

POST   /api/v1/procurement/purchase-requests/{requestId}/submit
POST   /api/v1/procurement/purchase-requests/{requestId}/approve
POST   /api/v1/procurement/purchase-requests/{requestId}/reject
POST   /api/v1/procurement/purchase-requests/{requestId}/cancel
```

V0.3-B assigns the immutable Company-scoped PR number at creation from sequence code `PURCHASE_REQUEST`, which must use the approved `PRYYMM-###` template with MONTHLY reset. Only Draft PRs are directly editable.

A PR belongs to one Project. Each line is exactly MATERIAL or SERVICE, requires positive quantity and an active same-Company UOM, and may independently reference same-Project WBS, same-Company Cost Code, same-Project Activity and a line-level Required-on-Site date. MATERIAL lines reference an active Material master; SERVICE lines use their own controlled description and do not create a fake Material.

Submission attaches the reusable `PURCHASE_REQUEST` Approval Matrix and records submitter/time. Maker-checker is backend enforced. Approved/rejected/cancelled PRs remain retained history. A rejected PR may be copied into a new independently numbered Draft through the dedicated copy action; the rejected record itself is never rewritten. Required-on-Site and optional Activity references are procurement-owned planning context and never mutate Scheduling dates.

V0.3-B creates no RFQ, quotation, supplier award, PO, Inventory movement, Supplier Invoice, Payment, Actual Cost or committed-cost ledger semantics.
---

## 41.8A RFQ / Supplier Quotations

```text
GET    /api/v1/procurement/rfq-projects
GET    /api/v1/procurement/quotation-projects
GET    /api/v1/procurement/projects/{projectId}/approved-demand
GET    /api/v1/procurement/projects/{projectId}/supplier-options

GET    /api/v1/procurement/projects/{projectId}/rfqs
GET    /api/v1/procurement/projects/{projectId}/quotation-rfqs
POST   /api/v1/procurement/projects/{projectId}/rfqs
GET    /api/v1/procurement/rfqs/{rfqId}
GET    /api/v1/procurement/quotation-rfqs/{rfqId}
POST   /api/v1/procurement/rfqs/{rfqId}/suppliers

POST   /api/v1/procurement/rfqs/{rfqId}/quotations
PATCH  /api/v1/procurement/quotations/{quotationId}
PUT    /api/v1/procurement/quotations/{quotationId}/lines/{rfqLineId}

GET    /api/v1/procurement/rfqs/{rfqId}/comparison
POST   /api/v1/procurement/rfq-lines/{rfqLineId}/award
```

V0.3-C assigns the immutable Company-scoped RFQ number at creation from sequence code `RFQ`, which must use the approved `RFQYYMM-###` template with MONTHLY reset.

RFQs are Project-owned and may source only active APPROVED Purchase Request lines from that same Project. RFQ lines retain the exact source PR-line identifier and immutable commercial/demand snapshots. Multiple RFQs may reference the same approved PR demand, while aggregate active Supplier Awards are guarded against exceeding that approved demand.

Supplier invitations use active same-Company Supplier master records and retain invitation-time Supplier code/name snapshots. Each invited Supplier may have one current quotation per RFQ. Supplier quotations do not receive a system-generated business number in V0.3-C; Supplier reference, quotation date, validity, remarks and quotation lines are the canonical source data.

Quotation line quantity and unit price are canonical inputs. Amount is server-derived as quantity × unit price and database-guarded. Corrections are audited before award; an awarded quotation line is frozen. Comparison is a derived read model from RFQ + invitation + quotation data and has no independent editable comparison ledger.

Supplier Award is line-level. It retains the exact source quotation line, invitation-time Supplier identity, commercial snapshots, decision reason, actor and timestamp. Different RFQ lines may be awarded to different Suppliers. Award records are immutable; V0.3-C defines no ordinary reversal/re-award endpoint.

All endpoints remain Company/Project-scoped. Stage C business permissions are assigned explicitly through business Roles; the technical `SYS_ADMIN` role is not implicitly granted RFQ/quotation/award business authority.

V0.3-C does not create Purchase Orders, Expected Delivery, procurement schedule-risk, committed-cost, Inventory or Finance semantics.

---

## 41.9 Purchase Orders

```text
GET    /api/v1/procurement/po-projects
GET    /api/v1/procurement/po-create-projects
GET    /api/v1/procurement/po-workflow-options
GET    /api/v1/procurement/projects/{projectId}/po-options
GET    /api/v1/procurement/projects/{projectId}/po-awards

GET    /api/v1/procurement/projects/{projectId}/purchase-orders
POST   /api/v1/procurement/projects/{projectId}/purchase-orders
GET    /api/v1/procurement/purchase-orders/{orderId}
PATCH  /api/v1/procurement/purchase-orders/{orderId}
GET    /api/v1/procurement/purchase-orders/{orderId}/revisions

PATCH  /api/v1/procurement/purchase-order-lines/{lineId}
DELETE /api/v1/procurement/purchase-order-lines/{lineId}

POST   /api/v1/procurement/purchase-orders/{orderId}/submit
POST   /api/v1/procurement/purchase-orders/{orderId}/approve
POST   /api/v1/procurement/purchase-orders/{orderId}/reject
POST   /api/v1/procurement/purchase-orders/{orderId}/cancel
POST   /api/v1/procurement/purchase-orders/{orderId}/revise
```

V0.3-D creates Purchase Orders only from unused line-level Supplier Awards. One PO revision belongs to one Company, one Project and one Supplier. Initial lines copy the exact PR → RFQ → Supplier Quotation → Supplier Award source identifiers and commercial snapshots; a selected award cannot be assigned to a different PO identity.

PO identity uses the approved Company-scoped sequence code `PURCHASE_ORDER` with `POYYMM-###` and MONTHLY reset. The PO number remains stable across revisions and `revisionNo` is the immutable version discriminator. A new revision can originate from the latest active APPROVED revision or from the latest retained REJECTED revision to provide a corrective retry path; it retains the prior revision link. Rejected revisions remain immutable history and never become the current commitment.

Draft revisions may edit controlled commercial/allocation fields. Quantity remains positive and cannot exceed the selected Supplier Award quantity; amount is server-derived as quantity × unit price. WBS remains same-Project, Cost Code remains same-Company, and Required-on-Site / Expected Delivery are procurement-owned line dates. These dates never mutate Scheduling-owned Activity dates.

Submission attaches a configured `PURCHASE_ORDER` Approval Matrix. Maker-checker and Project scope are backend enforced. Submitted, approved and rejected revisions are immutable commercial history. A rejected revision may be copied forward into the next corrective Draft under the same PO identity; it does not replace the latest approved commitment. Cancellation records actor/time/reason, and a later approved revision never rewrites an earlier approved revision.

Stage D business permissions are `procurement.po.view/create/edit/submit/approve/reject/cancel/revise`. They are explicit business authorities and are not implicitly granted to technical `SYS_ADMIN`.

V0.3-D retains approved PO values and source traceability only. It does not post Goods Receipt/Inventory, Supplier Invoice/Finance, Actual Cost, a V0.7 Committed Cost ledger, tax/VAT, FX, or Stage E procurement schedule-risk classification.

---

## 41.9A Procurement Schedule / Risk / Reporting

```text
GET /api/v1/reporting/projects/{projectId}/procurement
```

V0.3-E exposes a Project-scoped, read-only procurement schedule/read model derived from existing Purchase Request, RFQ, Supplier Quotation, Supplier Award and Purchase Order sources. Reporting owns no duplicate procurement ledger.

Each procurement line exposes Required-on-Site, the currently relevant active PO Expected Delivery where available, source transaction status and stable forward/backward identifiers. Backend risk classification follows BR-V03-13 exactly:

- Expected Delivery > Required-on-Site → `AT_RISK`
- Expected Delivery <= Required-on-Site → `ON_TIME`
- either date missing → `UNAVAILABLE`

The comparison uses calendar dates and never changes Scheduling-owned Activity dates.

Operational reporting omits quotation and PO unit-price/amount fields so `reporting.operational.view` does not become an alternate commercial-data authorization path. Project scope remains backend-enforced through the same ProjectAccessService used by transaction modules.

DOC-007 reuses the existing secure Documents storage/authorization architecture. Canonical Project-owned documents may additionally link to validated `PURCHASE_REQUEST`, `RFQ`, `SUPPLIER_QUOTATION` and `PURCHASE_ORDER` targets; no procurement-specific file store is introduced.

---

## 41.10 Inventory

```text
POST   /api/v1/goods-receipts
POST   /api/v1/goods-receipts/{id}/post

GET    /api/v1/stock-transactions
GET    /api/v1/stock-balances

POST   /api/v1/material-issues
POST   /api/v1/material-issues/{id}/post

POST   /api/v1/material-returns
POST   /api/v1/material-returns/{id}/post

POST   /api/v1/stock-transfers
POST   /api/v1/stock-transfers/{id}/post
```

---

## 41.11 Finance

```text
POST   /api/v1/supplier-invoices
POST   /api/v1/supplier-invoices/{id}/submit
POST   /api/v1/supplier-invoices/{id}/approve

POST   /api/v1/client-invoices
POST   /api/v1/client-invoices/{id}/submit
POST   /api/v1/client-invoices/{id}/approve

POST   /api/v1/payments
POST   /api/v1/payments/{id}/submit
POST   /api/v1/payments/{id}/approve
```

Payment approval requires:

`finance.payment.approve`

and the configured approval-step authorization / maker-checker checks.

V0.6 Finance Project-scoping rules:
- Supplier Invoice create/edit includes required `projectId` under D06-17 / DEC-018; every line and linked PO/GR source must match that Project.
- Payment create/edit includes required `projectId` under D06-18 / DEC-019.
- Payment list/detail/action/allocation endpoints enforce the Payment Project as part of backend Project scope.
- Supplier Invoice, Client Invoice and Subcontract Certification allocation targets must match the Payment Project in addition to Company/direction/counterparty/base-currency constraints.
- Multi-target Payment allocation is allowed only within one Project.
- Cross-Project and Company-level/non-project Payments are rejected in initial V0.6.
- `projects.access_all` may bypass assignment filtering but does not bypass the same-Project transaction-integrity rule or grant Finance action/approval authority.

---

# 42. Data Export

Export is an authorized action.

Endpoints may use patterns such as:

`GET /api/v1/reports/project-cost/export?projectId={id}&format=csv`

or asynchronous report generation later if the report becomes too expensive for a normal HTTP request.

Export:

- respects project/data scope
- requires the appropriate export/report permission
- must not bypass normal data visibility rules

CSV is preferred for simple structured prototype exports.

PDF generation may be added when a specific business requirement requires it.

---

# 43. Background Jobs

Background processing is not required initially.

Normal CRUD, approval and small reports execute synchronously.

If longer-running tasks appear later, the API may:

1. accept a job request
2. create a background job using the approved queue solution
3. return `202 Accepted`
4. expose job status
5. notify or allow polling for completion

pg-boss remains the preferred prototype queue if a queue becomes necessary.

Do not introduce Redis solely for API architecture convenience.

---

# 44. Health Endpoint

A minimal health endpoint may be provided:

`GET /api/v1/health`

It should expose only non-sensitive service-health information.

Detailed infrastructure diagnostics must not be publicly exposed.

---

# 45. API Change Rules

A change is potentially breaking if it:

- removes an endpoint
- renames/removes a response field
- changes field meaning
- changes an enum/value contract incompatibly
- makes an optional field required
- changes authorization semantics incompatibly
- changes resource identity

Breaking changes require:

- reviewed Change Request
- impact assessment
- migration plan
- API version decision

Additive optional fields/endpoints may remain within v1 when backward-compatible.

---

# 46. Traceability

Implementation work must remain traceable:

Requirement ID  
→ GitHub Issue  
→ API Endpoint / DTO / Service  
→ Test Case  
→ UAT

Example:

`PROC-014 Purchase Order Approval`

maps to:

`POST /api/v1/purchase-orders/{id}/approve`

and the corresponding permission:

`procurement.po.approve`

and approval-history persistence.

---

# 47. API Review Checklist

The API Architecture Baseline has defined:

- REST API base path and versioning
- HTTPS and content types
- JSON naming/precision rules
- session authentication
- CSRF protection
- backend authorization
- project scoping
- resource naming
- CRUD conventions
- explicit workflow action endpoints
- approval patterns
- inventory posting patterns
- scheduling read models
- request validation
- problem-details errors
- HTTP status conventions
- success response envelope
- pagination
- filtering
- sorting
- search
- concurrency control
- idempotency strategy
- database transactions
- correlation IDs
- audit context
- document upload/download
- module boundaries
- DTO boundary
- OpenAPI documentation
- CORS
- rate limiting
- security baseline
- configuration handling
- export pattern
- background-job boundary
- API change rules

---

# 48. Baseline Decision

The Construction ERP API architecture is:

```text
React
  |
  | HTTPS + REST /api/v1
  v
NestJS
  |
  +-- Authentication / Session
  +-- Authorization / Project Scope
  +-- Validation
  +-- Business Services
  +-- Approval / Audit
  +-- Documents Storage Abstraction
  |
  v
Prisma
  |
  v
PostgreSQL
```

The frontend does not access PostgreSQL directly.

The frontend does not control approval identity or audit identity.

Business workflow transitions occur through explicit backend commands.

**Status: API Architecture Baseline v0.1**

The next Phase 0 deliverable is:

**Testing & UAT Approach — Issue #6**


## V0.4-A Warehouse / Inventory Foundation

```text
GET    /api/v1/inventory/projects
GET    /api/v1/inventory/warehouses?includeInactive=true&projectId={id}&search={text}
GET    /api/v1/inventory/warehouses/{id}
POST   /api/v1/inventory/warehouses
PATCH  /api/v1/inventory/warehouses/{id}
POST   /api/v1/inventory/warehouses/{id}/archive
POST   /api/v1/inventory/warehouses/{id}/reactivate
```

Warehouses are Company-owned. A general Warehouse has no fixed Project; a Project/Site Warehouse has one same-Company Project. Site Warehouses require a Project. Scoped users see general Warehouses and Warehouses linked to their active Project membership; `projects.access_all` grants assignment-filter bypass but not action permission. Explicit `inventory.warehouse.*` permissions guard each operation. Create/update/archive/reactivate are audited. A Project reassignment requires `projects.access_all`. Inventory document posting and derived balances remain later-stage work.


## V0.4-B Goods Receipt / Stock Ledger API

Under `/api/v1/inventory` the Stage B resources are:

| Method | Route | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/receipt-projects` | `inventory.receipt.view` | Effective active Project choices |
| GET | `/projects/:projectId/receipt-warehouses` | `inventory.receipt.view` | Active general or matching Project Warehouses |
| GET | `/projects/:projectId/eligible-receipt-pos` | `inventory.receipt.view` | Current active approved PO material lines |
| GET | `/projects/:projectId/goods-receipts` | `inventory.receipt.view` | Scoped receipt register |
| GET | `/goods-receipts/:id` | `inventory.receipt.view` | Receipt, approval actions, items and immutable movement history |
| GET | `/receipt-workflows` | `inventory.receipt.submit` | Active configured `GOODS_RECEIPT` Approval Matrix options |
| POST | `/goods-receipts` | `inventory.receipt.create` | Create Draft from approved PO and positive material-line quantities |
| PATCH | `/goods-receipts/:id` | `inventory.receipt.edit` | Draft remarks only |
| PATCH | `/goods-receipt-items/:id` | `inventory.receipt.edit` | Draft quantity only |
| POST | `/goods-receipts/:id/submit` | `inventory.receipt.submit` | Submit to configured workflow |
| POST | `/goods-receipts/:id/approve` | `inventory.receipt.approve` | Approval Matrix action; final approval atomically posts with `postKey` |
| POST | `/goods-receipts/:id/reject` | `inventory.receipt.approve` | Retain rejection/action history |
| POST | `/goods-receipts/:id/reverse` | `inventory.receipt.reverse` | Full reversal with `reversalKey` and required reason |

Create body: `{projectId,purchaseOrderId,warehouseId,remarks?,lines:[{purchaseOrderLineId,quantity}]}`. Quantities are positive decimal strings or JSON numbers with at most four decimal places; no UOM conversion. Submit body: `{workflowCode}`. Approve body: `{postKey,comment?}`. Reverse body: `{reversalKey,reason}`. The source PO revision must remain the current active approved revision at final posting. Every endpoint enforces Company, Project and explicit permission scope on the server; mutating endpoints require CSRF. The creator cannot perform final approval. Final posting and reversal include audit and ledger effects in one serializable transaction. A retry with the same key returns the existing effect without duplicating stock.

Stage B exposes only Goods Receipt source and movement history through detail. Derived Stock Balance/report APIs belong to V0.4-C/E.


## V0.4-C Derived Stock Balance API

Stage C adds two read-only routes under `/api/v1/inventory`:

| Method | Route | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/stock-projects` | `inventory.stock.view` | Active effective-Project filter choices |
| GET | `/stock-balances` | `inventory.stock.view` | Derived Company/Project/Warehouse/Material/UOM on-hand quantities |

`/stock-balances` supports optional `projectId`, `warehouseId`, `materialId`, bounded `search`, `includeInactiveWarehouses` and `includeZero` filters. The server sums signed DECIMAL(18,4) `stock_transactions.quantity` rows and returns decimal strings. There is no balance identity, mutation route, editable/materialized balance table, cache or second ledger. Assigned users see only transaction rows attributed to active assigned Projects; nullable Project attribution requires `projects.access_all`. General Warehouse ownership never broadens Project access. Results are capped at 1,000 grouped rows; the Stage E reporting surface remains deferred.


## V0.4-D Material Reservation / Issue / Return API

Stage D keeps the one immutable Stock Transaction Ledger and adds the approved reservation, issue and return workflows under `/api/v1/inventory`.

| Resource | Key routes | Permission boundary |
| --- | --- | --- |
| Reservation | `GET /reservation-projects`, `GET /projects/:projectId/reservation-warehouses`, `GET /projects/:projectId/reservation-stock`, `GET /reservation-availability`, `GET /projects/:projectId/material-reservations`, `GET /material-reservations/:id`, `POST /material-reservations`, `PATCH /material-reservations/:id`, `POST /material-reservations/:id/activate|release|cancel` | `inventory.reservation.view/create/edit/activate/release` |
| Material Issue | `GET /issue-projects`, `GET /projects/:projectId/issue-warehouses`, `GET /projects/:projectId/issue-stock`, `GET /projects/:projectId/issue-reservations`, `GET /issue-workflows`, list/detail/create/edit, `submit`, `approve`, `reject`, `reverse` | `inventory.issue.view/create/edit/submit/approve/reverse` |
| Material Return | `GET /return-projects`, `GET /projects/:projectId/return-warehouses`, `GET /projects/:projectId/eligible-return-issue-lines`, `GET /return-workflows`, list/detail/create/edit, `submit`, `approve`, `reject`, `reverse` | `inventory.return.view/create/edit/submit/approve/reverse` |

Reservation activation derives available quantity as immutable-ledger on-hand minus Active Reservation quantity on the identical Company/Warehouse/Material/Project/UOM dimensions. It does not create a physical stock movement. Material Issue final approval uses the configured `MATERIAL_ISSUE` Approval Matrix, maker-checker, deterministic stock/reservation locks, serializable transaction isolation, negative-stock prevention, and one exact negative ledger row per line. A linked Active Reservation must match exactly and is fulfilled atomically with posting.

Material Return references a posted, non-reversed Material Issue line in the same Project. Final approval uses the configured `MATERIAL_RETURN` Approval Matrix, locks the Issue lineage, enforces the cumulative non-reversed return ceiling, and appends one exact positive ledger row per line. Full Issue and Return reversals append exact opposite ledger effects; Issue reversal is blocked while a posted non-reversed Return exists. Return reversal revalidates available destination stock so it cannot create negative stock or consume another Active Reservation.

All mutation routes require CSRF, explicit business permission, Company/Project scope and retained audit history. `projects.access_all` only bypasses Project assignment. Technical `SYS_ADMIN` receives no Stage-D business action authority implicitly. No editable balance, reservation ledger, availability cache, second stock ledger, UOM conversion, costing or Finance posting is introduced.

## V0.5-A Subcontractor Register and Agreement Draft API

Stage A adds the permission-gated `/api/v1/subcontracts` resource family without introducing agreement approval or Work Orders.

| Method | Route | Permission | Purpose |
| --- | --- | --- | --- |
| GET/POST | `/subcontractors` | `subcontracts.subcontractor.view/manage` | Search/read or create Company-owned register entries |
| GET/PATCH | `/subcontractors/:id` | `subcontracts.subcontractor.view/manage` | Read or edit a retained register entry |
| POST | `/subcontractors/:id/archive`, `/reactivate` | `subcontracts.subcontractor.archive` | Change active selection state without deleting history |
| GET | `/suppliers` | `subcontracts.subcontractor.view` | Active same-Company Supplier choices for the optional link |
| GET | `/agreement-subcontractors` | `subcontracts.agreement.view` | Minimal active Company Subcontractor choices for agreement users; does not expose the full register |
| GET | `/projects`, `/agreement-statuses` | `subcontracts.agreement.view` | Effective Project and configured operational-status choices |
| GET/POST | `/agreements` | `subcontracts.agreement.view/create` | Scoped Draft list/search and idempotent Draft creation |
| GET/PATCH | `/agreements/:id` | `subcontracts.agreement.view/edit` | Scoped detail and Draft-only commercial-field edit |

All mutations require CSRF, explicit permission and audit history. Register authority is Company-scoped and does not require Project membership. Agreement reads/writes enforce database-derived Project access, active same-Company references and separate system `DRAFT` versus configured operational status. Creation allocates immutable Company-scoped `SCYYMM-###` identity and accepts a stable create key bound to an immutable creation-payload fingerprint for replay safety. Stage A has no submit, approve, reject, revise, cancel, Work Order, claim, certification, retention, Variation, Finance or cost-posting action.


## V0.6-A Supplier Invoice Finance API

V0.6-A adds the `/api/v1/finance` resource family. Every route is protected by explicit Finance permission and backend Company/Project authorization; UI visibility is not a security boundary.

| Method | Route | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/finance/projects` | `finance.supplier_invoice.view` | Effective active Project choices |
| GET | `/finance/supplier-invoice-workflow-options` | `finance.supplier_invoice.submit` | Active configured `SUPPLIER_INVOICE` Approval Matrix workflows |
| GET | `/finance/projects/:projectId/supplier-invoice-options` | `finance.supplier_invoice.view` | Base currency, active Suppliers, WBS, Cost Codes and eligible current PO/GR source choices |
| GET | `/finance/projects/:projectId/supplier-invoices` | `finance.supplier_invoice.view` | Project-scoped Supplier Invoice register |
| GET | `/finance/supplier-invoices/:invoiceId` | `finance.supplier_invoice.view` | Detail, retained lines and approval history |
| POST | `/finance/projects/:projectId/supplier-invoices` | `finance.supplier_invoice.create` | Idempotent Draft creation with one or more lines |
| PATCH | `/finance/supplier-invoices/:invoiceId` | `finance.supplier_invoice.edit` | Draft header edit |
| POST | `/finance/supplier-invoices/:invoiceId/items` | `finance.supplier_invoice.edit` | Add Draft line |
| PATCH/DELETE | `/finance/supplier-invoice-items/:itemId` | `finance.supplier_invoice.edit` | Edit/remove Draft line |
| POST | `/finance/supplier-invoices/:invoiceId/submit` | `finance.supplier_invoice.submit` | Submit to configured workflow with stable action key |
| POST | `/finance/supplier-invoices/:invoiceId/approve` | `finance.supplier_invoice.approve` | Configured-role approval with maker-checker |
| POST | `/finance/supplier-invoices/:invoiceId/reject` | `finance.supplier_invoice.reject` | Configured-role rejection with retained reason/history |
| GET | `/finance/purchase-order-lines/:lineId/supplier-invoices` | `finance.supplier_invoice.view` | Forward trace from an authorized PO source line to related Supplier Invoices |
| GET | `/finance/goods-receipt-items/:itemId/supplier-invoices` | `finance.supplier_invoice.view` | Forward trace from an authorized GR source item to related Supplier Invoices |

Supplier Invoice creation uses Company base currency only and the reserved `SIYYMM-###` Number Sequence. A line may reference neither source, a current approved PO line, a posted/non-reversed GR item, or both when they preserve the same PO-line lineage. Linked PO/GR sources must match the invoice Company, Supplier and single Project. V0.6-A performs source-reference integrity only: it does not implement quantity/value matching tolerances, tax/VAT, FX, GL posting, payments or cancellation/credit-note behavior.

Mutation routes require CSRF. Create and workflow actions use durable replay keys/payload fingerprints; approval/rejection transactions lock and serialize the invoice before the Approval Matrix action. Submitted/approved/rejected source history is retained, and approved/rejected invoices are not ordinarily editable.


## V0.6-E Project Cash Flow / Finance Reporting API

V0.6-E adds a derived Project cash-flow read model without creating an editable financial ledger. Existing AP, AR, Payment and payable-retention endpoints remain their own canonical/source-derived views and are composed by the permission-aware Finance Reports workspace.

| Method | Route | Permission | Purpose |
| --- | --- | --- | --- |
| GET | `/finance/cash-flow-projects` | `finance.payment.view` | Effective Project choices for Project Cash Flow |
| GET | `/finance/projects/:projectId/cash-flow?fromDate=YYYY-MM-DD&toDate=YYYY-MM-DD` | `finance.payment.view` | Derived Payment-level Project Cash Flow with optional inclusive Payment-date range |

Cash Flow includes only final `APPROVED`, non-cancelled Payments in the authenticated Company and authorized Project. Each Payment contributes its full amount exactly once on its Payment date: `INBOUND` is inflow and `OUTBOUND` is outflow. Allocation rows are returned only as settlement traceability and do not duplicate, reduce or defer the Payment-level cash-flow amount. The response separately exposes allocated/unallocated settlement amounts and status.

Date filters are optional, validated as `YYYY-MM-DD`, inclusive at both ends, and applied server-side before aggregation. If any included final approved/non-cancelled Payment retains a currency different from the Company's current base currency, the endpoint returns `422 CASH_FLOW_CURRENCY_UNSUPPORTED` rather than combining or mislabelling currencies. V0.6 performs no FX conversion. Backend Project authorization is mandatory even when frontend controls are bypassed. `projects.access_all` does not substitute for `finance.payment.view`, and technical SYS_ADMIN alone does not gain cash-flow authority.

The Finance Reports UI conditionally composes existing AP, AR, Payment, payable-retention and cash-flow reads according to each user's existing permissions. It does not create report-owned balances, Cost Control measures, GL/journals, tax/VAT, FX, retention release or any V0.7/V0.8 source of truth.
