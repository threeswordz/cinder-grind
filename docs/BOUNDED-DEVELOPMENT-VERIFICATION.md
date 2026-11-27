# Bounded development and independent verification — DEC-055

**Owner approved 27 November 2026 SGT.** The Owner approved immediate adoption of the preceding recommendation in Chat: “lets proceed with this immediately, but should we wait for the latest codex run first?” This records conversation authority, not a fabricated GitHub approval. Effective immediately as the Builder's development discipline; protected-main publication and actual release admission remain governed by DEC-051–053 and #384. Applies to the remaining prototype and subsequent ERP work.

## Responsibility and tool selection

| Tool | Responsibility |
| --- | --- |
| Chat | Default sole Builder and Release Coordinator; implement, debug, inspect, coordinate and reconcile evidence. |
| Mac | Focused execution for affected build/schema/native/API/browser/retained boundaries using exact pinned candidates and existing safe operators. |
| GitHub Codex | Independent review through the existing PR review integration; inspect actual bot response, reviewed SHA and findings. |
| GitHub Actions | Applicable focused feedback and authorized complete release validation; no duplicate full execution. |
| Work | Audit-first for broad analysis; implementation only if separately assigned under the existing single-writer rule. |
| Standalone Codex app / cloud environment | Outside this workflow; do not suggest, request or create unless explicitly requested by the Owner. |

Do not invoke Codex from an Issue comment: the supported workflow is PR-based. An Issue-level environment prompt is not a PR review blocker. In the unlikely event the actual PR integration is unavailable, state the observed blocker; continue unrelated authorized work. Do not redirect the Owner to a standalone app or environment.

## Review checkpoints

Use the first applicable trigger, not a quota. Count substantial source files and estimated work **since the previous independently reviewed boundary**, not cumulative historical PR diff or elapsed waiting time. Declare the boundary and exact base/head before implementation. Split a large package at independently verifiable contract seams.

| Change | Trigger |
| --- | --- |
| Authorization, permissions, Company/Project isolation, finance, payments, inventory/stock, audit/history, concurrency, privacy, schema/data integrity | Earliest coherent stable contract or migration batch, after affected focused checks pass; do not accumulate unrelated high-risk functionality. |
| Ordinary business functionality | One coherent outcome, normally 5–10 estimated development hours. |
| UI | One coherent functional journey, with appropriate focused validation. |
| Substantial source diff | Mandatory checkpoint when exceeding 15 substantially changed source files since the previous review; split sooner where practical. |
| Low-risk documentation/roadmap only | No routine Codex review; explicit governance/release gates still apply. |
| Final stable release candidate | Applicable full exact-head PR validation and independent DEC-022 review; preserve release admission identity and actual full-main requirements. |

The numerical thresholds are provisional planning triggers, not claims of actual labor, hard caps on correctness, new scope, or reasons to request reviews of unstable code. Existing high-risk requirements take precedence.

## Cycle and evidence

1. Chat declares a bounded outcome, dependencies, requirement IDs, exact base, anticipated changed paths and acceptance/denial cases.
2. Before freezing, inspect the entire defect category and adjacent callers: Company/Project/role checks, source identity, database invariants and direct-write bypasses, transaction/rollback/locking, retries/idempotency, history immutability, downstream consumers and relevant regression tests. Add failing regression cases where practical; resolve known findings.
3. Validate affected contracts once with existing focused checks on the exact head. Use Mac only when executable/native/target evidence is necessary. Preserve prior passing evidence for unchanged boundaries. Do not substitute fixture or read-only evidence for native/deployed evidence.
4. Freeze the candidate; request one GitHub Codex review on that boundary, or observe the existing automatic trigger. Early development reviews may use a draft review-only PR with an exact previously reviewed base and non-release branch names, after inspecting workflow routing. Never merge or mark such a PR ready, treat it as a release gate, or alter workflows/protection to suppress CI. Use the ordinary governed release PR when final full validation is due. No duplicate request for the same materially unchanged head. Record the actual request, review SHA, bot receipt and unresolved threads. Do not infer independent clearance.
5. Batch genuine findings and inspect all adjacent instances of the same failure class. If two successive reviews report related defects, perform a category-wide invariant and caller audit before any next Mac run or review. Preserve normal denial, valid lifecycle, atomicity and adverse raw-write regressions. Re-review material changes once as a coherent batch; genuine residual blockers may require further passes.
6. Record evidence, blockers, next action and the reconciled remaining-hours estimate. No credit for mere commits, retesting already-credited behavior or hypothetical future results. Only close the bounded technical package where its actual applicable gates pass.

## Mandatory zero-session preflight for authenticated native/Mac verification

**Owner direction, 28 November 2026 SGT:** [Event257](https://github.com/threeswordz/cinder-grind/issues/414#issuecomment-7226060530). Effective immediately for newly prepared authenticated native/Mac operators; not a new business rule or release-gate waiver.

- Share a single fail-closed admission implementation between an explicit read-only preflight mode and the authorized execution path. Check the exact application/operator identity, sealed source and receipt IDs (not ambiguous shared attributes), unique record cardinality, live actor roles and project/company scope, schema/table and historical session census, prior execution markers, and retained database/files/recovery custody before any login. Check canonical rate-bucket admission immediately before authenticated execution; report temporary rate blockers, never reset them.
- The explicit preflight runs without starting application/browser runtime, creating sessions, writing receipts, business/audit/grant changes, or changing rate buckets. Output only sanitized bounded status and failed assertion codes; no secrets or protected records. Regress ambiguous/multiple-source and wrong-receipt cases.
- A failed preflight stops before side effects. Correct the defect class, not merely the first assertion. An uncertain prior attempt requires explicit custody reconciliation, not automatic retry.
- Where exact-head mutation/session authority is already recorded and remains unused, run preflight and authorized execution in one invocation (recheck live admission immediately before login); do not require a second Owner approval or separate Mac command merely for preflight. If an exact operator changes, obtain only the applicable new authority. A standalone preflight does not authorize execution.
- Reuse existing valid evidence; do not retrofit and rerun already-passed journeys. A preflight PASS proves admission, not native/browser completion, independent review, UAT, or release acceptance.

First verified application: inventory operator `b0cdc10c88cce746a240c35fcbbaab95dd30464c` returned M6_INVENTORY_READ_ONLY_PREFLIGHT_PASS with zero sessions and all 25 earlier batch sessions, prior HR audit, subcontract evidence, retained database/files and recovery preserved. Event255 ambiguity was caught before runtime startup; no replay of that operator.

## Parallelism and waiting

Never modify a frozen head while a review is in progress. Use a separate isolated branch for an unrelated authorized package with an explicit dependency check and one writer per branch. Do not claim parallel progression of dependent stages whose gates are not met. Consolidate and reconcile verified changes before release; no force pushes, self-approval or unreviewed integration. Do not spend turns repeatedly polling unchanged review/CI state; check at the next dependent step or after useful independent work. If no independent work is feasible, report the concrete blocker without promising background execution. Owner need not repeat continuation instructions for authorized work.

## Existing gates preserved

This extends DEC-022 review timing to stable **development checkpoints**. It does not replace the mandatory final exact-head release review, full PR and verified main integration/final full-main evidence under DEC-051–053/#384. No changes to workflow routing, release scope, business policy, deployment, retained data, GL or milestone acceptance, human UAT timing under DEC-042 or separate Production authorization. No automatic merge, waiver or additional cost. Documentation-only publication follows governed integration, not direct main writes.

## First application: SS16

PR #456 review of `4f2d045190a13865fe5e8aaccea7bad28e717990` completed with two new P2 findings: reversal ledger completeness and terminal original approval cancellation proof. Three earlier findings remain formally unresolved. Keep prior Mac native evidence and frozen review receipt. Before the next validation, audit all four movement types, canonical reversing effects (including converted UOM and paired transfers), original approval identity/state/actions, normal approval/post paths, plan overage and custody cancellation, and direct-write/concurrency bypasses. Batch the two corrections in a new forward-only migration and targeted negative/positive regression coverage; no repeat of unchanged web/browser/PUR14/FM02/six groups. Then run one focused Mac batch and one exact-head GitHub PR re-review. Do not request a new review until a corrected head is ready. Full historical acceptance consumers remain for the governed release gate.
