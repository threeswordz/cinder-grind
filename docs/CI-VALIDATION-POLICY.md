# CI validation policy — DEC-051 / DEC-052

## Latest approved change — DEC-053, verified main integration

**Owner approved20 November2026 SGT; implementation/activation tracked in [#384](https://github.com/threeswordz/cinder-grind/issues/384).** [Explicit conversation approval](https://github.com/threeswordz/cinder-grind/issues/382#issuecomment-7035133824) adopts [the concrete replacement](https://github.com/threeswordz/cinder-grind/issues/382#issuecomment-7035108009). This prospectively supersedes the unconditional full-main requirement below **after the governed rollout gates**, not any required full PR, review, final release or deployment proof. Until activation evidence is recorded, preserve the current full route. #383 is a separate elapsed-time experiment, not this route's activation.

| Event / evidence | DEC-053 route after activation |
|---|---|
| Ordinary branch development / draft PR | Existing focused feedback and blocking attempt1 remain. |
| Stable exact PR candidate | Complete full `validate` execution; final source/PR/base/attempt identity; applicable independent DEC-022 review; all genuine findings resolved before guarded merge. |
| Eligible ordinary main squash push | Short `integration-check` only after authoritative same-repository full-PR run/job/log identity, frozen reviewed head, trusted Codex clean reaction after ready, all review threads resolved, base ancestry and entire source/integrated tree equality. Emit `MAIN_INTEGRATION_REUSES_FULL_PR`, explicitly `fullSuiteExecutedOnMain:false`. |
| Direct/forced/non-squash/ambiguous merge, changed CI/admission/governance/deployment-consumer paths, stale/missing/failed evidence or API errors | Full validation. No guess, cached pass, user-supplied review assertion or silent success. |
| Short-check failure | No verified output; full `validate` executes as fallback. Any remaining routing/identity failure keeps the workflow blocked. PRs and non-main events always require full execution regardless of planner output. |
| Explicit `vfull-*` push | Complete full execution, unchanged. |
| Final frozen candidate / release / deployment requires actual full main proof | Re-run the existing main run's `integration-plan` job and dependents: main attempt2+ always routes full. Alternatively dispatch `validate.yml` on current **main**, without inputs or arbitrary SHA. Run the entire full job; recheck live main at start/finish. Neither route substitutes for full PR admission. |

The previous main must already have completed its actual full or separately verified integration gate; an unproven/in-progress rollout cannot bootstrap reuse. The short main job performs frozen install, pinned Node24.21.0/pnpm12.6.0 build, fresh production dependency audit, exact migration inventory, fresh disposable PostgreSQL migration/status and owned Production-mode API readiness/storage checks. It re-reads authoritative identity/review/full-job proof before and after artifact preservation. Failed, partial or cancelled work cannot supply verified output. The skipped `validate` job on an eligible main is **not a full pass**: the separately named integration job and its explicit receipt carry development integration evidence.

Full-run verification binds the trusted workflow/run/attempt, actual unskipped `validate` steps, recovery/consolidated/final identity, and the final job log's exact tested SHA + PR + base + attempt. Read-only Actions/contents/pull-request permissions only; signed log redirects never receive the GitHub token. Closed PRs have empty run association arrays, so a head-only success is insufficient. Unknown/legacy proof without the exact PR/base binding uses full main.

Every prototype launcher that formerly accepted a green workflow now additionally requires an actual complete successful full `validate` job, including recovery and consolidated evidence. It accepts explicit full-main dispatch as well as full push, never a reused integration check. Immutable old published launchers stay pinned to their historical sources; no replay is requested. The structural freeze packet requires `mainCi.validationKind=FULL_EXECUTION` and remains an evidence-structure checker, not an authenticator or human acceptance.

**Rollout:** one coherent source/negative-tests/documentation PR; focused feedback, own full exact-head explicit-push and full PR proofs, independent stable DEC-022 review, guarded tested/reviewed/integrated tree equality and actual full main for this routing/admission change. Protected-path changes deliberately force full rather than exempting the mechanism from its own validation. Record observed integration/fallback receipts before claiming the faster route proven; no retrospective waiver or cancellation of #376 main44706627082. Missing rollout proof keeps the old full obligation. No change to retained grants/data, human UAT, GL/milestone closure or separate Production authority.

---

**Owner-approved direction, 19 November 2026 SGT; prospective activation only after #373's full transition gates.** [Change Control #373](https://github.com/threeswordz/cinder-grind/issues/373) records conversation approval. Stage A #372 has completed the previous gates: main `e71a350e134d98b7a0ef8abe57bdce4ab986b820`, reviewed tree `eb4097b5a276d5b5936487b0da25a8a5e5c57452`, [exact-main44336708390](https://github.com/threeswordz/cinder-grind/actions/runs/44336708390) SUCCESS48/48. No retrospective reclassification.

## First increment: remove duplicate ordinary branch-push full suites

| Event | Required evidence |
|---|---|
| Ordinary `v*` branch push excluding `vfull-*` | Distinct Focused Construction ERP Branch workflow: exact SHA, frozen install, Prisma generation/schema validation, workspace typecheck, role UI tests, Markdown audit and routing contract. Focused feedback only. |
| PR to main or v1.2-c-uat-coverage | Existing Validate Construction ERP / validate full job; unchanged suite including real browser/upgrade/recovery. Exact-head SUCCESS mandatory. |
| Main push | Same full validation; exact-main SUCCESS mandatory for every integration in this increment. |
| Explicit `vfull-*` branch push | Same full validation, including rollout itself, explicit nonredundant push evidence and escalation. No focused workflow on this lane. |

Full job name and workflow filename remain stable; no path ignores, risk labels or job-level skips on full PR/main. Focused has a distinct check identity and does not substitute for a full gate. Missing, cancelled, skipped, partial or stale runs are not passes. Branches outside registered push patterns supply no implied evidence. Check current base ancestry, guarded expected-head merge and exact integrated Git tree equality with the tested/reviewed candidate. Require full exact-main before any dependent stage/handoff. On changes, repeat applicable checks. Existing launch/release/freeze evidence consumers remain intact.

Prospectively including DEC-050 B/C, after activation ordinary separate full push is no longer mandatory if focused branch evidence and full exact-head PR SUCCESS exist. Any distinct required full-push proof uses the explicit full lane. Preserve older evidence, and on uncertain or unavailable focused evidence fall back to the previous full pattern or explicit full lane. No change to protection/rulesets or removal/replacement of a required check.

## Second increment: explicit stable draft candidate — DEC-052

**Owner approved under [#378](https://github.com/threeswordz/cinder-grind/issues/378); activation pending its own complete rollout gates.** This section supersedes the first increment's automatic full execution on every ordinary draft update, prospectively after activation. It does not replace the full PR merge gate or any full main validation.

| Event / action | Result |
|---|---|
| Same-repository ordinary `v*` draft PR opened/updated/reopened, attempt 1 | `validate` deliberately fails admission with `DRAFT_FOCUSED_ONLY`. No install/browser/upgrade/recovery execution. Separate focused branch feedback remains required. A red full check while developing is expected; it blocks merge. |
| Builder freezes the draft head and selects **Re-run failed jobs** on its PR run | Attempt 2+ executes the entire existing full job at the original exact head. Live open PR head/base and current base ancestry must match before and after execution. Stale reruns fail. |
| Fully validated unchanged draft is marked ready | No new validation event; the actual full PR SUCCESS is retained. Observe the single automatic independent Codex review. Ready status is not a substitute for that full pass. |
| Ready PR opened/updated/reopened | Full job automatically, including a changed head; old-head proof cannot certify it. Return to draft for another development cycle if needed. |
| Main or `vfull-*` push; `vfull-*` draft PR; fork/unregistered branch PR | Full job. Missing/malformed/ambiguous identity blocks; it never becomes focused success. |

The Builder owns the full-run request; no Mac command or Owner click is required. Request it only when the candidate is coherent and affected local checks pass. Check the run's event, exact source SHA, base SHA, attempt, complete steps and full-success summary before ready/merge. An intentional attempt-1 failure, focused success, cancelled run or missing final identity check is not a pass. A rerun is PR-bound and keeps GitHub's original event SHA/ref; no dispatch-only check or copied artifact substitutes for execution.

The required `Validate Construction ERP / validate` identity, default PR opened/synchronize/reopened events and all existing full test commands remain. Do not add `ready_for_review` (duplicate suite/early review), job-level skip-success, path ignores, labels, write-token status synthesis or protection changes. Admission uses read-only GitHub API identity checks and fixed, validated identifiers. Final admission is the last step after consolidated evidence. Current base must remain an ancestor of the tested source; if it moves, reconcile the candidate and validate it again.

**Rollout acceptance:** full exact-head vfull push plus full PR rerun; focused ordinary push; observed attempt-1 draft block before install; unchanged ready causes no extra validate run; negative tests for changed head/base, closed PR, absent identity/API errors and unknown lane fallback; independent DEC-022; guarded merge and tested/reviewed tree equality; full exact-main. Record live receipts in #378 before claiming activation. The rollout uses an ordinary source branch plus a vfull alias at the same SHA, preserving its own full-push obligation. Existing branches must forward-reconcile the new workflow before relying on it; changing main alone does not rewrite their workflow source. Roll back by restoring the prior full route through normal forward commits if routing proof is uncertain.

Ten draft updates plus one merge previously start eleven full suites; one stable candidate plus main would start two if both pass first time (82% fewer full starts in that example). This is not an elapsed-time or billing guarantee. The measured reference main run was 25m08s, including 17m58s of eight historical upgrade rehearsals. All eight remain. Caching, parallel rehearsal isolation and strict editorial-main reuse remain unimplemented follow-ups.

## Activation, risk and review

- High-risk includes runtime, migrations, security, identity/privacy, Finance, inventory, approval, history/audit, concurrency, dependency, deployment/recovery and CI/governance. Mixed/unknown defaults high risk. Full PR/main and applicable stable independent DEC-022 review remain.
- Rollout itself changes validation routing: full exact-head push on vfull-*, full PR, independent DEC-022 review, guarded merge/tree equality and full exact-main. Before relying on the route, observe an actual ordinary branch push at the exact candidate, focused SUCCESS, and no full-push workflow for that event; record in #373. No self-exemption. Repair or fall back on any uncertainty.
- Stable green draft: mark ready once, use observed automatic Codex review as the independent trigger; manual only if auto did not actually trigger or DEC-022 requires batched re-review. No duplicate initial request, self-approval or waiver.
- Conditional exact-main for strictly editorial/evidence-only changes is approved for exploration, **not implemented/active**. Before use, independently review a fail-closed mechanism proving exact full PR success, current base, reviewed/integrated tree equality and strictly editorial diff, with all named release/launcher/freeze and security evidence consumers preserved. Missing/uncertain evidence or high risk uses full main. Until this mechanism is implemented, reviewed, integrated and observed, every main push remains full.
- No assertion weakening, paid runtime, automatic merges, retained-data activation, human UAT/GL/milestone closure or Production authority. DEC-042, final comprehensive human UAT, actual deployed journeys, populated recovery and separate Owner approval remain unchanged.
