# Construction ERP — Master Requirements Register

**Document Status:** Draft
**Current Phase:** Phase 0 — ERP Definition
**Architecture Baseline:** v0.1
**Source:** ERP-MASTER-BLUEPRINT.md

---

# 1. Purpose

This document is the authoritative register of functional, technical and control requirements for the Construction ERP.

Every material ERP capability must have a unique Requirement ID.

Requirements must be traceable to:

Requirement
→ GitHub Issue
→ Database Design
→ API
→ Frontend
→ Testing
→ UAT
→ Release

No material ERP requirement should exist only in chat messages, meeting notes, email or developer notes.

---

# 2. Requirement ID Standard

Requirement IDs use the following prefixes:

| Prefix | Module                        |
| ------ | ----------------------------- |
| FND    | Foundation                    |
| MST    | Master Data                   |
| PRJ    | Projects                      |
| WBS    | WBS & Cost Codes              |
| SCH    | Planning & Scheduling         |
| BUD    | BOQ & Budget                  |
| SITE   | Site Execution                |
| PROC   | Procurement                   |
| INV    | Inventory                     |
| EQP    | Equipment                     |
| SUB    | Subcontracts                  |
| FIN    | Finance                       |
| COST   | Cost Control                  |
| DOC    | Documents                     |
| RPT    | Reporting                     |
| ADM    | Administration                |
| SYS    | Cross-Cutting System Controls |
| ARCH   | Architecture / Technology     |

Examples:

FND-001
PRJ-001
SCH-001
PROC-001
COST-001

Requirement IDs must never be reused.

---

# 3. Requirement Status

Each requirement will use one of the following statuses:

Draft
Approved
In Development
Testing
UAT
Production
Deferred
Cancelled

---

# 4. Priority

Requirements use:

**Must Have** — required for the relevant release to be considered complete.

**Should Have** — important but may be deferred without preventing the release.

**Could Have** — useful enhancement.

**Future** — intentionally outside the current release roadmap.

---

# 5. Requirement Record Structure

Every requirement should contain:

* Requirement ID
* Requirement Name
* Module
* Description
* Business Reason
* Priority
* Target Release
* Dependencies
* Acceptance Criteria
* Status
* GitHub Issue
* Notes

---

# 6. Master Requirements

Requirements will be maintained under the following canonical modules.

## Foundation

To be populated from Architecture Baseline v0.1.

## Master Data

To be populated from Architecture Baseline v0.1.

## Projects

To be populated from Architecture Baseline v0.1.

## WBS & Cost Codes

To be populated from Architecture Baseline v0.1.

## Planning & Scheduling

To be populated from Architecture Baseline v0.1.

## BOQ & Budget

To be populated from Architecture Baseline v0.1.

## Site Execution

To be populated from Architecture Baseline v0.1.

## Procurement

To be populated from Architecture Baseline v0.1.

## Inventory

To be populated from Architecture Baseline v0.1.

## Equipment

To be populated from Architecture Baseline v0.1.

## Subcontracts

To be populated from Architecture Baseline v0.1.

## Finance

To be populated from Architecture Baseline v0.1.

## Cost Control

To be populated from Architecture Baseline v0.1.

## Documents

To be populated from Architecture Baseline v0.1.

## Reporting

To be populated from Architecture Baseline v0.1.

## Administration

To be populated from Architecture Baseline v0.1.

## Cross-Cutting System Controls

To be populated from Architecture Baseline v0.1.

## Architecture & Technology

To be populated from Architecture Baseline v0.1.

---

# 7. Requirement Change Control

Once a requirement has been approved:

* Its Requirement ID must not change.
* Material changes must be recorded.
* Changes affecting an approved release must follow Change Control.
* Removed requirements should be marked Cancelled or Deferred rather than deleted.
* GitHub Issues must reference the corresponding Requirement ID.

---

# 8. Traceability Rule

The eventual traceability model is:

Architecture Blueprint
→ Requirement ID
→ GitHub Issue
→ Database / API / Frontend Implementation
→ Test Case
→ UAT
→ Release

This traceability must be maintained throughout ERP development.

