# Construction ERP — API Architecture

**Document Status:** API Architecture Baseline v0.1  
**Current Phase:** Phase 0 — ERP Definition  
**Architecture Baseline:** v0.1  
**Requirements Baseline:** v0.1  
**Database Baseline:** v0.1  
**Roles & Permissions Baseline:** v0.1  
**Backend:** NestJS + TypeScript  
**Frontend:** React + TypeScript  
**API Style:** REST over HTTPS

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

`GET /api/v1/projects/{id}/gantt`

`GET /api/v1/projects/{id}/lookahead?weeks=2`

`GET /api/v1/projects/{id}/lookahead?weeks=4`

The Gantt endpoint is a read model optimized for schedule visualization.

It does not create a second scheduling source of truth.

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

GET    /api/v1/projects/{id}/gantt
GET    /api/v1/projects/{id}/lookahead?weeks=2
GET    /api/v1/projects/{id}/critical-path

POST   /api/v1/schedule-baselines
POST   /api/v1/schedule-baselines/{id}/approve
```

Deleting an unapproved dependency relationship is not equivalent to deleting an approved ERP transaction.

---

## 41.4 Purchase Requests

```text
GET    /api/v1/purchase-requests
POST   /api/v1/purchase-requests
GET    /api/v1/purchase-requests/{id}
PATCH  /api/v1/purchase-requests/{id}
POST   /api/v1/purchase-requests/{id}/submit
POST   /api/v1/purchase-requests/{id}/approve
POST   /api/v1/purchase-requests/{id}/reject
POST   /api/v1/purchase-requests/{id}/cancel
```

---

## 41.5 Purchase Orders

```text
GET    /api/v1/purchase-orders
POST   /api/v1/purchase-orders
GET    /api/v1/purchase-orders/{id}
PATCH  /api/v1/purchase-orders/{id}
POST   /api/v1/purchase-orders/{id}/submit
POST   /api/v1/purchase-orders/{id}/approve
POST   /api/v1/purchase-orders/{id}/reject
POST   /api/v1/purchase-orders/{id}/cancel
POST   /api/v1/purchase-orders/{id}/revisions
```

---

## 41.6 Inventory

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

## 41.7 Finance

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
