# GL-04 — Seven-role launch verification / source-to-runtime evidence plan

**Status:** PREPARATION ONLY — no retained-company inspection, role grants, new UAT or Production authorization. **Authority:** #278, #288, the [112-ID approved 2026-10-30 execution dispositions](ROLE-REQUIREMENTS-2026-10-30/13-execution-disposition.md), the actual seven-role files, AGENTS.md and DEC-022. **Snapshot:** main `cb6abf378e903aa5c5a60be3a3d3db54e8c430d3`, exact-main CI `41176827462` PASS. Re-verify at execution time.

## 1. Historical 112-ID source census — not current completion

| Frozen status | Number |
|---|---:|
| Implemented | 4 |
| Configuration-only | 10 |
| Partially implemented | 67 |
| Missing | 29 |
| Unverified | 2 |
| **Total** | **112** |

Execution lanes in that source: 51 `OPERATIONAL_REVIEW_ONLY`, 1 `POLICY_UNRESOLVED`, 4 `FUTURE_GATED`, 6 `EXISTING_CONTROLS`, 5 `MIXED_KEEP_BOUNDARY`, 14 `FUTURE_HR`, 24 `DEFER_ACCOUNTING`, 4 `COUNT_CANDIDATE`, 3 `APPROVED_HR1A`. These were assessed on 30 October **before** draft operational implementations. Do not claim that their business workflows are now merged/accepted because the draft code exists.

Eight source role families: Ben 12; Nancy 12; Khaimook 18; Jai 15; Store Site 21; Foreman 6; Porn 20; Koh 8. Operational reporting may focus on seven-role activation while retaining Porn's separate required Accounting/privacy boundary.

## 2. Verification stages, all with evidence provenance

| Stage | Permitted in Chat now? | Exit artifact | Important limit |
|---|---|---|---|
| A. Reconcile existing source implementation and accepted CI | **Yes** (read-only) | Per-requirement source path/PR/accepted evidence, code-on-main vs draft and missing behavior | No business grant/approval inferred from route decorations |
| B. Prepare synthetic positive/negative assertions | **Yes** under approved existing scope | Disposable actor/Project/Company tests, no retained data | Synthetic PASS is not retained Company configuration |
| C. Read effective MKE/TCJ roles and sessions | **Only after separately authorized scoped access** | Private, timestamped source-owned role/user/project/approval matrix | Never paste names, sessions, private HR fields, credentials into Issues or CI |
| D. Configure changed business grants/approval steps | **No, requires explicit Owner activation authority** | Before/after, expected actors, reviewer approval and rollback plan | No direct self-approval or blanket SYS_ADMIN escalation |
| E. Newly affected-path human UAT | **Only at the respective stage acceptance gate** | Signed business outcomes, exact SHA/company/role evidence and documented limitations | Do not repeat already accepted THB J1 or V1.3 BOQ tests |
| F. GL-04 exit assessment | After approved scope and evidence | Coverage/sign-off against named launch-critical operations, or explicit limited-pilot exclusion | Green CI alone does not close GL-04 |

For each row record: `requirement_id`, `actor_role`, `scope_company` (MKE or TCJ), `project_filter`, `source_on_main`, `candidate_pr`, `effective_role_grant`, `effective_approval_step`, `positive_probe`, `negative_probe`, `actor_business_acceptance`, `status`, `evidence_reference`, `known_limit`. Never invent a fixture or supply identifying personal/secret details in public evidence.

Status values: `PASS` (with linked observed evidence), `FAIL` (observed incorrect behavior), `BLOCKED_REVIEW`, `BLOCKED_CONFIGURATION`, `NOT_RUN`, `NOT_APPLICABLE_BY_APPROVED_PILOT_SCOPE`, `ALREADY_ACCEPTED_HISTORICAL`. An unknown grant is `BLOCKED_CONFIGURATION` or `NOT_RUN`, not `FAIL` or `PASS`.

## 3. Exact role-to-behavior probes before real launch

| Actor / target Company | Existing and proposed affirmative checks | Essential negative, segregation and future-gap checks |
|---|---|---|
| Ben (GM) | PO/Agreement/Work Order approval at configured eligible step; approved Customer BOQ and management Project summaries; weekly source reads where `site.daily_report.view` granted | No self-approval/delegate (BEN01); no invented emergency authority (BEN02); no access to HR identity/bank or Customer BOQ from unrelated roles; weekly read **is not** FM01-B recorded acknowledgment |
| Nancy (Accounting Manager) | Separate Customer BOQ/Variation/Budget approvals; selected approved Finance actions with appropriate roles; explicit HR view only to approved privacy categories | No automatic stock quantity/valuation write-off, no universal all-business rights, no implicit HR private-document management. Bank reconciliation, new petty cash/GL remain deferred |
| Khaimook (PM/Store lead) | Cost BOQ check, PR/stock transfer workflows, existing Project-wide PM assignment; **draft #300 target** `inventory.stock_count.view/approve` only after governed merge/configuration | No count maker self-approval; no default alternate approver; no commercial Customer BOQ leakage; planned-issue limits PM07 / FM03 escalations not deemed implemented |
| Jai (Purchasing) | Existing RFQ/PO route and supplier/GR coordination, Project scope as configured | No unapproved PO self-approval; do not treat one supplier PO/multiple Projects #245 as implemented; no HR private access; supplier handoffs and PO amendments remain partial |
| Store Site | Existing PR maker/GR/issue/return route permissions tied to assigned site warehouse; **draft #300 target** count view/create/edit/submit | No count approval, cross-Project or Company stocks; no unrestricted beyond-plan issue; Foreman request/receiver signatures FM04/SS07 and loss/damage SS13 remain gaps |
| Foreman | Daily report create/edit/submit; **draft #302 weekly source view** with Project scope; original source-linked observation | No inventory stock-count capabilities and no PR maker; missing dates not violations without approved calendar; FM01-B/C, FM02/03/04 not marked delivered |
| Koh (HR) | Integrated employee-access backend, correct Company/category entitlement; **drafts #297/#298/#299** restricted UI and private document routes | No generic Docs/Project/Finance bypass, wrong Company or revoked grant, uncontrolled bank/identity access; no payroll/OT/leave capability inferred |
| Porn (preserved separate Accounting/HR boundary) | Existing AP/certification roles where configured; narrowly approved HR bank read when correctly entitled | Not general HR identity/document access or unapproved payroll/accounting expansion; deferred new Accounting remains off |

## 4. Reuse automated/authoritative evidence, never restart accepted business UAT

- Existing synthetic role assurance: `deploy/uat/hr1a-role-assurance.mjs`, `deploy/uat/hr1a-role-assurance.test.mjs`, `deploy/uat/hr1a-role-assurance-http.test.mjs`, and `docs/HR1-A-ROLE-ASSURANCE.md`. These run read-only checks with loopback-only, private fixtures; they are not automatically a full seven-role operational PASS.
- Source-based permission reference: `docs/V1.1-ROLE-PERMISSION-IMPLEMENTATION-MATRIX-PROPOSAL.md`. Its proposal is **not** the retained MKE/TCJ database.
- Existing security enforcement owners: `apps/api/src/authorization/`, `apps/api/src/projects/`, workflow-specific approval/business services, and `apps/api/src/site-execution/`.
- Verified new unmerged candidates: [physical stock-count #300](https://github.com/threeswordz/cinder-grind/pull/300) exact-head PR/push CI PASS, **mandatory Codex review blocked quota**; [weekly read-only #302](https://github.com/threeswordz/cinder-grind/pull/302) exact-head PR/push CI PASS, **new authenticated Project endpoint → independent Codex review before merge**. These cannot close GL-04 on their own.
- HR drafts [#297](https://github.com/threeswordz/cinder-grind/pull/297), [#298](https://github.com/threeswordz/cinder-grind/pull/298) and dependent [#299](https://github.com/threeswordz/cinder-grind/pull/299) remain unmerged and subject to independent privacy review/dependency integration, then separate Owner HR business acceptance.
- V1.1/V1.2/V1.3 historical Owner acceptances stay `ALREADY_ACCEPTED_HISTORICAL`; do not re-run THB J1/BOQ as if failed.

## 5. Exit and escalation

GL-04 remains `PENDING` until actual named-role grants/approval configuration and required launch-critical behaviors for an explicitly approved launch scope are evidenced and accepted. Any real cross-Company/Project leakage, unauthorized approval, salary/private HR exposure, or double ledger posting blocks launch. BEN02 emergency policy and other undecided scope choices are owner questions, **not** developer defaults. Owner authorization is required before retained actor readback, grant mutation, or Production access. A limited pilot must explicitly disable/exclude unsupported functions and document alternate controlled processes; it cannot call them completed.
