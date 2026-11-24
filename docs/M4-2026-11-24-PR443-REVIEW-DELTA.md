# PR443 exact candidate review delta

Builder preparation only; not DEC-022 review or formal acceptance.

- Protected main: `3a441b1fa389a9a274e6ca82413740a3ffa2f51b`
- Previous candidate #442: `1f8c8cdb34ccb8ae6f4e47897bfd59e303de9929`
- Current [Draft #443](https://github.com/threeswordz/cinder-grind/pull/443): `0143eaf7876f46aff9c81353ae4a0e0656d32622`
- Current full compare 320 commits ahead, 0 behind, 181 paths (144 added, 37 modified). Use previous [180-file inventory](M4-2026-11-24-PR440-EXACT-MAIN-DEC022-HANDOFF.md), [PR441 delta](M4-2026-11-24-PR441-REVIEW-DELTA.md), [PR442 delta](M4-2026-11-24-PR442-REVIEW-DELTA.md) and new overlay below. Review full current main-to-head diff.
- [Focused #45404273554](https://github.com/threeswordz/cinder-grind/actions/runs/45404273554) SUCCESS; exact workflow-only child `4dbe456f9134dc2b9e46edda611acd9e24c6b1a8`. Actual fresh PG17.11 migration, API build, React typecheck, authenticated HTTP stale first/revised/missing predecessor denial, immutable independent signoffs and no stock/DirectCost changes. Marker BEN04_NATIVE_STALE_PREPARATION_NULL_MISSING_OLD_HASH_DENIED_AND_INDEPENDENT_SIGNOFF_PASS.

| Path | Change |
|---|---|
| apps/api/src/projects/project-closeout.service.ts | Reject omitted, malformed or stale expectedFingerprint under existing Project lock, null only on first preparation |
| apps/web/src/api/projects.ts | Typed expectedFingerprint on preparation request |
| apps/web/src/projects/ProjectCloseoutPanel.tsx | Bind editor base to Project and predecessor fingerprint; disable stale editor submit |
| apps/api/src/projects/project-closeout-stale.native.integration.spec.ts | New guarded disposable HTTP/PG test with actual actor sessions and audit checks |

## Inventory evidence reuse and current 112-ID snapshot

[Current 112-row disposition](M4-2026-11-24-112-DISPOSITION-PR443.csv) preserves all IDs and all NO acceptance flags, updates eleven outdated evidence/limitation rows. Classes remain conservative 32 bounded evidenced, 12 target evidence due, 14 role/source evidence due, 6 residual functional gaps, 6 policy/mixed, 42 deferred. Do not treat partial delivery as full gap closure.

SS11 [45243740765](https://github.com/threeswordz/cinder-grind/actions/runs/45243740765) SUCCESS exact run head `03b899bc33f3d109292a2aea2f50b541d4c65a42`: five identical focused blobs (custody migration, controller, service, integration spec, EquipmentCustodyPanel). Earlier [45240678442](https://github.com/threeswordz/cinder-grind/actions/runs/45240678442) also SUCCESS; earlier 45238710744 failed, not counted as PASS. Employee custody source is integrated; asset-master mapping, subcontract person/liability and retained role grants remain open.

SS14/PM15 [45238716889](https://github.com/threeswordz/cinder-grind/actions/runs/45238716889) SUCCESS exact run head `7657197ae733d780c4caa0d2eedd620ca329894a`: ten identical focused blobs (stock minimum contract/spec, controller, service/spec, plan-start spec, supplier-indicators spec, supplier-commitment indicator/spec, StockMinimumsPanel). New-only focused unit/service test, not native receiving database proof. Reuse source evidence; no whole-candidate equivalence inferred. Actual daily need schedule, external supplier confirmation, structured destination and notification policy open.

No duplicated historical suite, full CI, production, retained grants, Ready transition, merge or independent signoff. New preparation API requires explicit predecessor; old consumers must update. Updated React typechecked, not a new browser test. Joint closure remains operational evidence only, not archive or financial settlement.
