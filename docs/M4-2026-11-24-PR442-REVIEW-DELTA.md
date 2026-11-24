# PR442 exact candidate review delta

Builder preparation, not independent review or retained human acceptance.

- Protected main: `3a441b1fa389a9a274e6ca82413740a3ffa2f51b`
- Previous integrated draft #441: `e22bfddf18ada568f90d1ec04096164f8f2bd23f`
- Current [Draft #442](https://github.com/threeswordz/cinder-grind/pull/442): `1f8c8cdb34ccb8ae6f4e47897bfd59e303de9929`
- GitHub compare: 316 commits ahead, 0 behind, 180 paths (143 added, 37 modified). Three overlay paths, already present in full [180-path inventory](M4-2026-11-24-PR440-EXACT-MAIN-DEC022-HANDOFF.md) and [PR441 review delta](M4-2026-11-24-PR441-REVIEW-DELTA.md). Review full main-to-current-head diff.
- [Focused run #45398941022](https://github.com/threeswordz/cinder-grind/actions/runs/45398941022) uses verified workflow-only child `2597dae599a917894ec2437830ac5d0fd6365e22`. Terminal verification pending at preparation. No full CI or browser replay.

| Path | New Git blob | Review focus |
|---|---|---|
| apps/api/src/procurement/purchase-order.service.ts | `f0926941fed22d4c83ac2e46fc3373054c3bdfef` | final quote policy audit within final serializable approval, Company identity and canonical allocator within creation transaction |
| apps/api/src/procurement/purchase-order.pur01.integration.spec.ts | `fe53e5fe2afaa2399d107f82e5ea401d2d18ae33` | exact final quote-count audit and independent actor, denied attempt absence |
| apps/api/src/procurement/purchase-order.pur12.integration.spec.ts | `ad1f60908f1c3ef1e52b7001105bb233c13a9b20` | MKE and TCJ failed-draft sequence rollback, duplicate award rejection and retry |

Review serializable conflict behavior when concurrent POs share the same Company numbering row: a transaction may fail and require retry, not duplicate or silently consume a number. Do not assume parallel success has been proved. Check that new final-policy audit rolls back on failed approval and that no actor/approval rule is changed. Keep Owner-confirmed THB thresholds, existing UTC monthly reset, frozen historical identity and Company/Project boundaries. No new permission, schema migration, legacy backfill, external dispatch, retained UAT, protected-main merge or Production. Prior test evidence remains historical where affected blobs changed. No formal acceptance or independent signoff.
