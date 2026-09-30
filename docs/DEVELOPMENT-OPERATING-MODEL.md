# Development Operating Model — Chat / Work / GitHub

**Status:** APPROVED — Product / Business Owner, 2026-09-30 (Singapore time)

## 1. Purpose

This document defines how day-to-day ERP delivery is divided between Chat, GitHub, CI/tests, the Product / Business Owner and Work.

The goal is to keep implementation fast and recoverable while preserving repository governance, release gates, source-of-truth discipline and human business acceptance.

## 2. Role model

| Role | Primary responsibility |
| --- | --- |
| Chat | Builder and Release Coordinator |
| GitHub | Durable source of truth for repository state, issues, branches, PRs, commits, decisions and CI evidence |
| CI / tests | Technical proof that implementation and regressions pass |
| Product / Business Owner | Scope/business authority, explicit change-control decisions and required human UAT/business acceptance |
| Work | Periodic independent auditor for broad repository-wide analysis |

## 3. Chat responsibilities

Chat is the default day-to-day implementation surface for:

- checking the live GitHub position;
- inspecting Issues, PRs, branches and CI;
- implementing approved V0.x stages;
- fixing code/test/CI failures;
- resolving merge conflicts;
- performing focused code review and validation;
- creating and merging PRs after applicable gates pass;
- verifying acceptance criteria and release evidence;
- maintaining release/current-state checkpoints;
- deciding the next technical implementation step within approved scope.

Chat may act autonomously on technical defects that preserve approved requirements and governance.

Chat must pause for Product / Business Owner approval when a requested action changes business policy, architecture, release scope, recurring cost, a hard constraint or another approval-gated item.

## 4. Work responsibilities

Work is reserved primarily for periodic, broad-scope analysis where repository-wide context is more valuable than day-to-day implementation speed, including:

- large repository-wide architecture analysis;
- full security / technical-debt audits;
- cross-release documentation reconciliation;
- large final-system review;
- production-readiness assessment.

Work is **audit-first by default**, not a competing implementation writer.

Findings from Work should normally flow back through the repository as an Issue, explicit Change Control item or other durable finding, then Chat performs the implementation and normal CI/PR/merge sequence.

## 5. Single-writer rule

Only one active implementation session should normally write to a given stage branch at a time.

Multiple Chat sessions may be used for:
- read-only inspection;
- research;
- analysis of completed stages;
- documentation review;
- unrelated branches.

They must not independently modify the same active stage branch at the same time.

Work should not modify the active implementation branch unless the Product / Business Owner explicitly assigns it that responsibility and the current writer is stopped/reconciled first.

## 6. New-session bootstrap rule

Every new implementation Chat must re-establish live state from GitHub before making a material write.

At minimum, reconcile:

1. default branch / `main`;
2. active release branch;
3. active Stage Issue;
4. open PRs;
5. latest exact-head CI;
6. `AGENTS.md`;
7. `docs/PROJECT-GOVERNANCE.md`;
8. `docs/DECISION-LOG.md`;
9. applicable release scope / acceptance criteria / business rules;
10. `docs/CURRENT-STATE.md`.

Conversation memory is supporting context only. When conversation context and repository state disagree, the repository governs implementation status and approved repository documents govern policy/constraints.

## 7. Evidence and release flow

The normal delivery flow remains:

**Product / Business Owner approves scope → Chat builds stage → GitHub records implementation → CI/tests validate → Chat fixes defects → PR/review → merge → post-merge CI → next stage**

Periodic audit flow:

**Work audits accumulated system → findings become durable repository items → Chat implements approved fixes → CI/tests prove → PR/merge**

Work does not replace technical CI and does not replace Product / Business Owner UAT/business acceptance.

## 8. Recommended audit checkpoints

Work should be used periodically rather than continuously. Suitable checkpoints include:

- after V0.5 completion: architecture/security audit;
- after V0.6 completion: cross-release technical-debt audit;
- after V0.7/V0.8 completion: integration and data-flow audit;
- before Production / V1.0: full production-readiness review.

These checkpoints are planning guidance, not additional release gates unless the Product / Business Owner explicitly promotes one into governance.

## 9. Governance preservation

This operating model does **not** change:

- predecessor-stage completion rules;
- exact-head CI / PR / post-merge CI requirements;
- human UAT/business acceptance ownership;
- Project-scope/security rules;
- open-source / zero-cost-first DEC-008;
- approved release scope or deferrals;
- change-control requirements;
- existing review requirements or any explicit one-time waiver such as DEC-015.

GitHub remains the durable source of truth; Chat remains the normal implementation coordinator; Work remains the periodic independent auditor.
