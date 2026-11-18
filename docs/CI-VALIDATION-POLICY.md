# CI validation policy — DEC-051

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

## Activation, risk and review

- High-risk includes runtime, migrations, security, identity/privacy, Finance, inventory, approval, history/audit, concurrency, dependency, deployment/recovery and CI/governance. Mixed/unknown defaults high risk. Full PR/main and applicable stable independent DEC-022 review remain.
- Rollout itself changes validation routing: full exact-head push on vfull-*, full PR, independent DEC-022 review, guarded merge/tree equality and full exact-main. Before relying on the route, observe an actual ordinary branch push at the exact candidate, focused SUCCESS, and no full-push workflow for that event; record in #373. No self-exemption. Repair or fall back on any uncertainty.
- Stable green draft: mark ready once, use observed automatic Codex review as the independent trigger; manual only if auto did not actually trigger or DEC-022 requires batched re-review. No duplicate initial request, self-approval or waiver.
- Conditional exact-main for strictly editorial/evidence-only changes is approved for exploration, **not implemented/active**. Before use, independently review a fail-closed mechanism proving exact full PR success, current base, reviewed/integrated tree equality and strictly editorial diff, with all named release/launcher/freeze and security evidence consumers preserved. Missing/uncertain evidence or high risk uses full main. Until this mechanism is implemented, reviewed, integrated and observed, every main push remains full.
- No assertion weakening, paid runtime, automatic merges, retained-data activation, human UAT/GL/milestone closure or Production authority. DEC-042, final comprehensive human UAT, actual deployed journeys, populated recovery and separate Owner approval remain unchanged.
