# Construction ERP — Project Governance

**Status:** APPROVED  
**Owner:** Product / Business Owner  
**Purpose:** Prevent architectural, scope, cost and business-rule drift across human and AI development sessions.

## 1. Governance principle

The repository is the durable project memory. Neither the Product / Business Owner nor any developer/AI should be required to remember every past decision from chat history.

A recommendation or implementation that conflicts with an approved higher-authority source must not proceed silently.

## 2. Authority order

Use this precedence when sources disagree:

1. Project Governance / hard constraints
2. Approved Decision Log
3. Approved Requirements
4. Approved release Scope + Acceptance Criteria
5. Development Roadmap
6. Active Stage Issue
7. Current State
8. Active PR / code / CI
9. developer or AI recommendation

A lower-authority item cannot silently override a higher-authority item.

Live GitHub Issues, PRs, commits and CI are authoritative for current implementation status.

The approved Chat / Work / GitHub operating model is defined in `docs/DEVELOPMENT-OPERATING-MODEL.md`. It controls tool/session responsibility but does not supersede this governance, the Decision Log, release gates or human UAT/business acceptance.

## 3. Hard constraints

### 3.1 Cost and licensing

- Open-source-first.
- Prefer zero-cost infrastructure and software.
- Mandatory paid runtime/cloud/service dependencies are prohibited unless explicitly approved by the Product / Business Owner.
- Existing owned hardware/resources should be considered before paid infrastructure when technically practical.
- Commercial components and recurring subscriptions require explicit approval and a Decision Log entry before adoption.
- Optional paid services may be discussed only as clearly labeled alternatives; they are not the default recommendation.

### 3.2 Architecture

- Modular monolith.
- PostgreSQL is the system of record; Prisma manages application data access/migrations.
- Project → WBS → Activity is the canonical hierarchy.
- Activity is the canonical technical term.
- WBS and Cost Code remain independent dimensions.
- Core business logic must not depend on replaceable UI components or hosting providers.
- Prototype/runtime design must remain portable and must not require a specific paid cloud.

### 3.3 Security and authority

- Backend authorization is mandatory; UI hiding is never the security boundary.
- Project scope is derived from persisted application relationships.
- `projects.access_all` does not imply edit, approval or other business authority.
- System Administrator is technical/admin and does not automatically gain business approval authority.
- Audit history and security controls must not be weakened for convenience.

### 3.4 Scope and business rules

- Do not implement future-release functionality early merely because it is technically convenient.
- Do not invent business policy where requirements are silent.
- Approved decisions remain active until explicitly superseded.
- Technical defects can be corrected without Product / Business Owner intervention when the correction preserves approved behavior.
- Any proposed change to business policy, architecture, release scope, recurring cost or a hard constraint requires explicit approval first.

## 4. Mandatory pre-flight

Before a material repository action, answer:

- What release and stage are active?
- Which Requirement IDs apply?
- Which acceptance criteria apply?
- What is explicitly out of scope?
- Does the change preserve approved architecture?
- Does it add/change a dependency?
- Is every mandatory dependency open source?
- Does it create a recurring or mandatory cost?
- Does it require paid infrastructure/service?
- Does it introduce or change a business rule?
- Does it conflict with a Decision Log entry?
- Does it affect project scope, permissions, audit or security?
- Is this a technical implementation decision or a Product / Business Owner decision?

A failed technical check means fix the technical approach.
A failed governance/business check means pause and request explicit approval.

## 5. Change-control rule

A chat message or implementation suggestion does not automatically change an approved hard constraint.

To change one, the Product / Business Owner must clearly state the intended policy change. Before implementation:

1. identify the affected governance/decision requirement,
2. record a new or superseding Decision Log entry,
3. update affected scope/acceptance documentation if necessary,
4. update the Stage Issue/PR,
5. implement and test the approved change.

## 6. Stage and release gates

A stage may merge only when its applicable completion gates pass.

The next stage must not begin until required predecessor gates are complete unless the approved roadmap explicitly permits parallel work.

Human UAT/business acceptance must not be marked complete by development or CI.

## 7. Development-session operating model

- Chat is the default Builder / Release Coordinator for day-to-day implementation, CI repair, focused review, PR/merge coordination and release checkpoint maintenance.
- GitHub is the durable source of truth for implementation state.
- CI/tests are the technical evidence layer.
- The Product / Business Owner remains the authority for approval-gated scope/business decisions and required human UAT.
- Work is the periodic independent auditor for broad repository-wide analysis and should be audit-first by default.
- Only one active implementation writer should normally modify a given stage branch at a time.
- A new implementation session must bootstrap itself from live GitHub state before material writes; conversational memory never overrides repository truth.
- Work findings normally become durable Issues/Change Control items and return to Chat for implementation through the normal CI/PR/merge gates.

See `docs/DEVELOPMENT-OPERATING-MODEL.md`.

## 8. Pull-request governance evidence

Every material PR must explicitly confirm:

- within current release/stage scope
- Requirement IDs / acceptance criteria identified
- no unapproved business rule introduced
- no mandatory paid dependency introduced
- open-source constraint preserved
- architecture decisions preserved
- security/project-scope model preserved
- Decision Log reviewed
- migrations/tests/security coverage updated where applicable
- documentation/current state updated before merge
- human gates remain human where required

## 9. If the Product / Business Owner forgets a rule

If a new request appears to conflict with this governance or an approved decision, do not silently follow the conflicting request.

State the specific conflict and ask whether the Product / Business Owner intends to change the approved rule. Only explicit approval followed by change control can supersede it.

## 10. If an AI/developer forgets a rule

The repository documents remain authoritative. A conflicting recommendation should be discarded or corrected before implementation.

This governance exists specifically so project continuity does not depend on conversational memory.
