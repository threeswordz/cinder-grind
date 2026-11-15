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

### Owner enforcement — outcome and usage discipline (14 November 2026)

The Owner explicitly required responsibility for building and rolling out the ERP and requested this correction be recorded after repeated preparation/checking turns advanced no prototype milestone. See the prominent [Owner directive in #305](https://github.com/threeswordz/cinder-grind/issues/305) and its [#338 execution application](https://github.com/threeswordz/cinder-grind/issues/338). This enforces DEC-016/022/030/042; it creates no release waiver or new business scope.

1. **Own delivery.** The designated sole Builder / Release Coordinator owns technical implementation, integration, applicable independent-review coordination, deployment preparation, recovery evidence and truthful readiness reporting. Continue authorized technical work without making the Owner repeatedly say "continue". Escalate only a concrete business/scope/approval decision or actual external review/access/execution blocker. Identify the exact blocked action and continue unrelated authorized work; do not imply that business decisions or unavailable target access can be self-approved.
2. **Choose the next missing outcome.** Use live #305's existing eight-milestone board and approved scope. Keep its IDs unchanged; at this directive, 1/2/3/5 were complete and 4/6/7/8 remained open. Per-ID requirement reports, PRs, helper counts and local/disposable proof alone do not close required gap delivery, actual deployed journeys, populated separate recovery or technical audit/freeze.
3. **Reuse completed proof.** Keep completed startup, actors and initial-browser execution closed. Reopen a scenario only for an affected code/configuration change, observed failure or an existing required release/deployment gate, with that reason recorded. Before adding a guard, helper, test or prerequisite, identify the concrete missing boundary it closes and reuse an existing implementation where sufficient. Do not reimplement canonical business behavior.
4. **Finish coherent packages.** Integrate necessary configuration/operator/journey work into the next declared executable outcome where predecessor gates permit. Avoid repeated inspection-only increments while the same executable journey remains outstanding. If a prerequisite truly prevents delivery, state the specific blocker, evidence and remaining action; do not present another preflight or higher test count as milestone completion. This does not weaken required target, permission, financial, data-integrity or private-file safeguards.
5. **Use validation economically.** During changing code, use focused checks appropriate to the affected behavior. Batch full applicable CI and independent DEC-022 review at stable candidates after known findings are resolved. Repeat/broaden checks only for relevant changes, failures, unresolved concerns or existing required gates. Preserve exact-head push/PR/post-main evidence and required independent review; do not change CI routing, add a skip, invent a waiver or relax assertions by implication.
6. **Avoid polling as a deliverable.** Do not keep a turn active solely to repeatedly poll unchanged CI or narrate the same waiting step. Check results when needed for the next dependent action; use waiting time for independent authorized implementation where practical. Report changed results, failures or blockers, and do not claim unobserved background monitoring.
7. **Report outcomes honestly.** Lead with functionality delivered, observed milestone exits, actual blockers and next executable action. Counts of tests, commits or PRs are supporting evidence, not feature growth or an effort/time percentage. Preserve distinction between prepared code, native/disposable proof, actual target/API/UI execution, populated recovery, freeze and human acceptance.
8. **Keep Owner authority explicit.** The Owner decides unresolved business/scope questions, comprehensive human UAT acceptance and separate Production authorization. Human UAT follows the frozen prototype under DEC-042. Mandatory independent review cannot be replaced by the Builder's own checks.

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

**Testing/UAT cadence — DEC-042 (supersedes DEC-041):** Continue approved feature coding, full applicable automated CI, high-risk stable-candidate review, guarded integration and exact-main CI **without interim manual/human/module/role/Owner UAT**. Any outstanding human-UAT criteria are explicitly DEFERRED, not accepted, until the integrated pre-Production prototype is frozen, technically validated and ready for one comprehensive cross-module human UAT. Such deferred UAT is not a blocker to the next authorized technical development stage after non-UAT gates pass. All separate Owner scope/policy/retained-access/Production approvals, GL gates and security requirements remain in force. See [Testing & UAT](TESTING-UAT.md) and DEC-042.

To avoid repeated administrative PRs under **DEC-030**, prefer one coherent implementation/test/documentation/closure PR **if the existing predecessor and release gates allow it**. A separate preflight or docs-only closure PR is appropriate only where a required gate must be completed before implementation starts, the diff/review risk warrants isolation, or evidence cannot responsibly be included in the same PR. This does **not** allow implementation before an entry gate closes.

Maintain the **documented current-stage checkpoint** in `docs/CURRENT-STATE.md`, always verifying it against fresh GitHub Issues/PRs/CI; update scope, acceptance, testing, and other affected source documents for actual changes, and link to Current State instead of repeatedly copying long status histories. Preserve dated historical evidence. The concise PR template is a prompt to check **applicable** controls, not a waiver of CI, Codex, security, cost, Change Control, or Product Owner UAT.

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
10. **Human acceptance remains human; timing changed under DEC-042.** No prospective interim manual UAT is required during development; defer its acceptance to the integrated prototype. CI, Chat, Codex and Work cannot self-approve final business UAT.

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
3. show the full V0.1 → V0.8 roadmap, V1.0 Production Readiness and any approved active successor from live GitHub;
4. show V0.6-A through V0.6-E individually;
5. use the standard status vocabulary; and
6. state the current exact position, current blocker and immediate next action.

This is a presentation/continuity rule only. It does not alter release sequencing, review/CI gates, human UAT/business acceptance, DEC-008, approved scope/deferrals, security requirements or Change Control.
