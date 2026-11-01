# GL-07 through GL-10 — Production evidence and cutover preparation

**Status:** READ-ONLY PREPARATION / ZERO PRODUCTION ACCESS. **Authority:** #278, [Production gate register](PRODUCTION-GO-LIVE-READINESS.md), [operational runbook](OPERATIONS-RUNBOOK.md), DEC-008/016/022, [deployment reference](../deploy/production/README.md), and [paired recovery reference](../deploy/recovery/README.md). All executable Production actions need a separately approved host, safe target and explicit Product / Business Owner Production authorization. Evidence examples are templates, **not** observed runtime results.

**Dated GitHub checkpoint, 2026-10-31 SGT:** main `cb6abf378e903aa5c5a60be3a3d3db54e8c430d3` / CI `41176827462` SUCCESS; branch protection `false`, rulesets `[]`. No verified real Production TLS/host/offsite backup/restore, retained MKE/TCJ role activation or cutover. GL-01/02/03 verified; GL-04–10 open. Never convert these into assumed deployment evidence.

## GL-07 — GitHub governance and business/security hardening (P0)

**Immediate Chat-only tasks:** prepare proposed `main` protection/ruleset settings; enumerate current CI-required check contexts/workflow; compare effective Company/Project permissions, session revocation and restricted commercial/HR reads against accepted source; draft protected secrets and TLS validation checklists. Do not flip settings or invent current Production identities.

**Proposed admin approval checklist (not an applied rule):** default-branch protection, no history rewriting/force pushes, required passing exact-head checks, pull-request review gate and required independent Codex review where DEC-022 applies, no bypass by implementation writer, minimum necessary admin access, signed/documented exceptional maintenance path, branch deletion policy and audit trail. Exact GitHub rule IDs, repository plan/available enforceability and emergency break-glass behavior must be confirmed before activation. Existing fact: `main` is currently **unprotected**, and the ruleset API returned **no rulesets**.

**Closure evidence:** GitHub ruleset/branch JSON with actual active enforcement, independent PR check status after enforcement (not only green pre-enforcement CI), restricted roles/grants and maker/checker proof, current TLS/secret-storage/security results with operator and timestamp. A policy Markdown file alone does not close GL-07. Human/admin changes require the proper authorizations.

## GL-08 — Real hosted environment and paired recoverability (P0)

Existing engineering is complete as GL-02; **do not rebuild it**. Apply only when the Owner has approved a real non-Production staging target or separate Production work.

| Required operating evidence | Existing baseline reused | Proof still missing in live register |
|---|---|---|
| Approved host, OS updates, isolated runtime account, public DNS, HTTPS origin | `deploy/production/README.md`, `deploy/production/Caddyfile.example` | Actual host/issuer/certificate/HTTPS negative and success smoke |
| Exact immutable release, safe fresh/upgrade controls, service supervisor | `deploy/production/prepare-release.sh`, `run-api.sh`, `smoke.sh` | Signed deployed SHA and service/bootstrap evidence, no use of an unapproved checkout |
| PostgreSQL 17 and persistent Documents mount identity | Production env + sentinel contract | Actual identity/mount/perms and PostgreSQL+Documents readiness |
| Protected environment secrets, HR encryption keys, separation from Git | Production env parsing and HR crypto contracts | Authorized key provenance/rotation policy, absence of plaintext leaks |
| Scheduled off-host **paired** PostgreSQL + Documents backups | `deploy/recovery/create-recovery-set.sh`, `verify-recovery-set.sh` | Scheduler evidence, copied off-host encrypted recovery set, real timestamps/retention |
| Independent **populated** isolated restore and exact-release startup | `deploy/recovery/restore-drill.sh`, `verify-application-rollback.sh` | Byte-equal Documents, correct external keys if HR enabled, restored authorized read-only app, measured RPO/RTO |
| Monitoring, bounded logs and incident responsibility | `docs/OPERATIONS-RUNBOOK.md`; health/live, health/ready | Alerts tested, on-call roster, logs without secret content, evidence retention |

Approved initial targets **RPO ≤ 24 h and RTO ≤ 8 h** are targets until measured on actual hosted infrastructure; CI recovery tests and an empty Mac store drill do not prove hosted-target recovery. Restoration is destructive to its *isolated empty destination*; never aim at live retained storage.

## GL-09 — MKE / TCJ Company onboarding and safe cutover (P0)

Before any real data or grant change, obtain separate explicit authorization naming Company, environment, scope, approver, rollback and permitted source data. Prepare a private (non-Git/non-issue) evidence bundle with:
1. actual Company identifiers, warehouses and active Project assignments; assigned Ben/Nancy/Khaimook/Jai/Store Site/Foreman/Koh and preserved Porn functions; employee identity boundaries;
2. before/after effective permission and approval-role matrix, including specific purchase/receipt/subcontract/BOQ, count-maker versus Khaimook reviewer, Foreman denial, Koh private HR Company/category grants, no implicit SYS_ADMIN approval;
3. master suppliers/materials/UOM/WBS, approved project/cost/customer BOQ versions and opening balances where applicable, reconciled to independently verified sources; THB for new monetary transactions and immutable legacy currency provenance;
4. source-system migration mapping, document-file existence/bytes, rejected/duplicate/out-of-scope rows, tie-out counts and signed variance disposition;
5. role-specific training, one-page daily operation SOPs, named first-line support, escalation and business/technical Owners.

Do not generate fictitious source data or write public credentials/private employee data. A code-level permission catalog or demo UAT actor does not substitute for real MKE/TCJ configurations.

## GL-10 — Controlled pilot, rollback and Owner go/no-go (P0)

Predecessors: GL-07/08/09 evidence and scoped GL-04 business function fit; GL-05/06 only conditionally excluded if **explicit limited-pilot boundary with named external controlled HR/accounting reconciliations** is approved. Required launch packet:
- frozen and independently reviewed release SHA on `main`, exact-main CI, dependency/P1 findings closed;
- approved pilot Company/site/user/workflow list and disabled/unavailable functionality inventory (not a hidden omission);
- one comprehensive human multi-role/cross-module UAT on the frozen technically green pre-Production prototype under DEC-042, tracing deferred count/weekly/HR and other in-scope criteria; no interim development UAT and no replay of historical accepted THB/BOQ acceptance;
- staged backup and populated isolated restore, HTTPS/readiness and no-write business smoke, tested rollback and measured RPO/RTO;
- operating-day contacts, incident escalation, support/training, cutover and post-cutover reconciliation, signed go/no-go decision;
- **separately explicit Owner authorization before actual Production deployment**, then observed release identity and operational startup evidence.

**Fail-closed:** An unresolved independent security review, unauthorized Finance/HR exposure, broken maker/checker, unknown backup restore or unreviewed retained data prevents go-live; green GitHub CI is not a waiver. GL-07/08/09/10 must never be marked complete from documentation-only preparation.

## Action ownership and authority

| Task | Chat | Independent review/audit | Owner/operator authorization |
|---|---|---|---|
| Read-only role/source/CI audit, evidence templates | Yes | Work optional broad audit | None |
| Review/fix an approved branch's genuine defect; synthetic CI | Yes | Codex mandatory for high-risk stable candidate | No new policy |
| #300 stock-ledger and #302 authenticated weekly review | Technical integration complete at 1 November checkpoint | Final Codex reviews CLEAN; material later changes follow DEC-022 | Human acceptance deferred to integrated pre-Production prototype (DEC-042) |
| HR privacy #297–299 integration | Merged; verify final exact-main CI and criteria disposition | Preserve actual independent review receipts; new material changes follow DEC-022 | Human UAT deferred to integrated prototype (DEC-042) |
| Branch protection/ruleset activation | Chat proposal only | Work may independently assess | Authorized repository admin/Owner |
| Real MKE/TCJ roles/data, hosted infra, backups, cutover | Chat scripts and exact checklist only | Security/operational audit | Separate scoped Owner/authorized operator approval |
| Go-live | No deployment authority from this plan | Neither tool can approve human UAT | Explicit Product / Business Owner go/no-go |

**Progress at publication:** A full plan is prepared, **no new GL-07/08/09/10 is closed**.
