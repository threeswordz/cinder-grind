# PM02 recovery evidence and FM01 release handoff — 25 November 2026 SGT

**Full ERP estimated remaining work: 1,818h → 0h.**

| Forecast reconciliation | Hours |
|---|---:|
| Previous reported forecast | 1,818h |
| Newly identified scope | +0h |
| Verified completed work credited this update | −0h |
| **Revised remaining forecast** | **1,818h** |

Estimated future work is separate from actual engineering hours (unknown) and formal acceptance.

## PM02 existing recovery proof — observed SUCCESS

| Binding | Exact value |
|---|---|
| Predecessor main | `040395bc7b0dedd40207f91f743bc2efc1584622` |
| PM02 source branch | `work-m4-pm02-bounded-prep-20261125` |
| Source commit | `e04b1cac5343f5b57bad51d52349990357c7168a` |
| Workflow-only child | `181eb11647d77ce398d8efcb57c1c0238995e25d` |
| Run / attempt | [45525270417 / 1](https://github.com/threeswordz/cinder-grind/actions/runs/45525270417) |
| Job | [138906928664](https://github.com/threeswordz/cinder-grind/actions/runs/45525270417/job/138906928664) |
| Outcome | SUCCESS, all 14 listed job steps successful |
| Completed | 25 Nov 2026, 09:24:05 SGT |
| Environment | Disposable PostgreSQL 17.11; database-only |

[Compare](https://github.com/threeswordz/cinder-grind/compare/e04b1cac5343f5b57bad51d52349990357c7168a...181eb11647d77ce398d8efcb57c1c0238995e25d) confirms only `.github/workflows/m4-pm02-paired-restore.yml` differs. The workflow checks its exact parent, one-path delta and local disposable database before execution.

Observed logs:

```text
3 schema/migration contract tests passed
PM02_POPULATED_PREDECESSOR_ROWS_PRESERVED_PASS tables=169 PR_LINES=7
PM02_PAIRED_PREDECESSOR_RESTORE_PASS tables=169 PR_LINES=7
PM02_POPULATED_PREDECESSOR_ROWS_PRESERVED_PASS tables=169 PR_LINES=7
```

Real predecessor approved/rejected PR, approval/action, PO and stock fixture history is populated before only the two PM02 forward migrations. All 169 table row counts/digests and prior migration checksums are preserved. Five metadata columns stay nullable without historical backfill; the decision CHECK and unique correction-source index are validated.

A custom-format dump is taken before upgrade and its checksum verified afterward. It is restored to the distinct `erp_m4_pm02_predecessor_restore` database. Restored predecessor rows and migration checksums match, and the upgraded target is checked again.

Only the observed equivalent PostgreSQL17 typed-array deparse spelling on `stock_transactions.material_uom_copy_transfer_pin` is normalized. Trigger relation, name, enabled state and all other definitions remain exact. This corrects a comparison fixture, without changing business behavior.

The dump/manifest were temporary runner resources; no durable backup artifact was published. This proves database-only disposable recovery, not paired Documents/external-HR-key recovery, restored authenticated application access, a retained-target restore, M7 completion or full release validation.

## Remaining PM02 release dependencies

| Dependency | Next action |
|---|---|
| Bounded source guard / native mixed review | Reuse [45521482092](https://github.com/threeswordz/cinder-grind/actions/runs/45521482092), including actual approval rollback after supplier deactivation |
| Populated forward preservation | Reuse [45523796231](https://github.com/threeswordz/cinder-grind/actions/runs/45523796231) and later combined recovery above |
| Global schema admission / historical rehearsal consumers | Still unwired; standalone preparation is not global admission |
| Paired Documents / external HR keys / restored app | Outstanding; database-only proof cannot substitute |
| Stable full CI / DEC-022 / governed integration | Outstanding; any new full trigger requires specific Owner authorization under [#384](https://github.com/threeswordz/cinder-grind/issues/384) |
| Retained roles / human acceptance | Unverified; human UAT deferred to frozen pre-production prototype |

M4-02 remains **5h → 5h**, M4 **88h → 88h**. No extra forecast credit for completing corrective proof.

## FM01 PR452 — exact next authorization gate

[PR452](https://github.com/threeswordz/cinder-grind/pull/452) remains Draft at `4aab761d8477cfb63ea978af1444865b720d42d5`, base main `040395bc7b0dedd40207f91f743bc2efc1584622`.

Authorized [45463404517 attempt3](https://github.com/threeswordz/cinder-grind/actions/runs/45463404517/attempts/3) failed at the legacy weekly-browser fixture after 33 successful steps. The [subsequent one-file correction](https://github.com/threeswordz/cinder-grind/compare/1b4be1427fea3d729d07a1717f0bfcd6ce232a20...4aab761d8477cfb63ea978af1444865b720d42d5) supplies current acknowledgment/calendar fields and explicitly asserts review status in three languages. It retains source navigation, authorization-cache revocation and Project isolation assertions.

| Evidence | Result |
|---|---|
| [Exact-head focused 45524960275](https://github.com/threeswordz/cinder-grind/actions/runs/45524960275) | SUCCESS, 18/18 listed steps |
| [Targeted Chromium 45525025034](https://github.com/threeswordz/cinder-grind/actions/runs/45525025034) | SUCCESS, 11/11 listed steps; EN/TH/zh-TW and source/cache checks |
| [Full admission 45524967848](https://github.com/threeswordz/cinder-grind/actions/runs/45524967848) | Attempt1 intentionally blocked at Draft admission; expensive suite unexecuted for this head |

The missing evidence is a complete successful full PR execution at the corrected exact head. Prior full attempts failed. Focused/targeted successes cannot supply that full receipt.

**Proposed single action requiring Owner authorization:** re-run failed jobs once on `45524967848`, PR452 head `4aab761d8477cfb63ea978af1444865b720d42d5`, after rechecking unchanged source/base and Draft state. No additional alias/push/dispatch.

After full PASS and exact source/PR/base/attempt identity, mark unchanged PR Ready once for independent DEC-022 review, then integrate only after all applicable gates. Any failure requires scoped diagnosis; it does not authorize another retry.

No full trigger, Ready transition, review request, merge, retained grant, Production or human acceptance occurred in this handoff. Official prototype **4/8**, GL **3/10**, accepted baseline packages **0/60**.

## Progress arithmetic repair

The existing validator failed before publication because cumulative supplier gross51h was used as the original historical chain baseline50h. It now starts from the original priced event and separately verifies all later discovered hours against cumulative gross. Historical events and estimates are preserved. Canonical report generation now passes for all 60 packages / 12 stages: 1,847h − 38h + 9h = 1,818h; M4 88h. Three focused tamper checks reject inconsistent gross scope, a broken interior scope event and an incorrect final balance. No forecast credit is assigned.
