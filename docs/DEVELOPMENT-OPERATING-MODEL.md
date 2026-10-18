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

## Codex review economy policy — DEC-022

Codex is a scarce independent review gate, not the continuous development reviewer. The default delivery pattern is:

**Chat review + tests/CI while the branch is changing → stable merge candidate → Codex review → batch-fix genuine findings → CI → one batched final re-review when materially warranted → merge.**

Rules:

1. **Chat + CI are continuous.** During active implementation, Chat performs focused review and defect fixing and CI/tests provide the technical evidence loop.
2. **Do not spend Codex on unstable intermediate heads.** Do not request Codex after every commit, every individual fix, or while the PR is still expected to change materially.
3. **First Codex pass is on a stable merge candidate.** Request Codex only after applicable tests/CI are green and known Chat findings are resolved.
4. **Batch Codex findings.** When Codex reports multiple genuine defects, resolve them together where practical, add/adjust regression coverage, and rerun CI before asking for another review.
5. **Re-review is risk-based, not commit-count-based.** A batched final re-review is required when the fixes materially change reviewed runtime behavior or touch a high-risk surface. Additional passes are used only when a later review finds a distinct genuine blocker or a subsequent material change invalidates the prior review.
6. **Non-semantic head movement does not automatically burn another review.** A clean Codex review remains valid across later documentation/evidence-only edits that do not change the reviewed runtime behavior, schema, security boundary or business rule.
7. **High-risk surfaces still require independent review.** Authorization, permissions, Finance/payment/accounting behavior, migrations, audit/history immutability, concurrency and data-integrity changes require Codex at the stable merge candidate unless the Product / Business Owner grants an explicit PR-specific waiver recorded in the Decision Log.
8. **Low-risk documentation-only changes normally use Chat + CI.** Codex is not a default requirement for documentation/reporting-only PRs unless an approved stage/release gate explicitly says otherwise.
9. **Release-level audit remains separate.** Work remains the periodic broad auditor for architecture, security, technical debt, cross-release integration and production readiness; Codex should be concentrated on stable code boundaries rather than repeated intermediate commits.
10. **Human gates are unchanged.** CI, Chat, Codex and Work do not self-approve required Product / Business Owner UAT/business acceptance.

For an already-reviewed PR, a new Codex pass is required only if a later change materially affects code/schema/security/business behavior covered by that review, or if an explicit approved gate requires a new confirmation.

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
- approved review requirements, including the Codex review economy policy in DEC-022, and any explicit one-time waiver such as DEC-015 or DEC-021.

GitHub remains the durable source of truth; Chat remains the normal implementation coordinator; Work remains the periodic independent auditor.


## 10. Live-position reporting standard

When the Product / Business Owner asks for the Construction ERP `live position`, `current position`, `where are we`, or equivalent project-status wording, Chat must:

1. re-fetch live GitHub state before reporting;
2. follow `docs/LIVE-POSITION-REPORTING-STANDARD.md`;
3. show the full V0.1 → V0.8 roadmap plus the V1.0 Production destination;
4. show V0.6-A through V0.6-E individually;
5. use the standard status vocabulary; and
6. state the current exact position, current blocker and immediate next action.

This is a presentation/continuity rule only. It does not alter release sequencing, review/CI gates, human UAT/business acceptance, DEC-008, approved scope/deferrals, security requirements or Change Control.
