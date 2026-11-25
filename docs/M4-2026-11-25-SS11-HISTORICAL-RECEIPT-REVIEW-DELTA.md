# M4 SS11 successor historical and receipt contract — 25 November 2026

Exact isolated source: `4ddca02ad99ece8f099ed73dbdc249c60f664bf0`. Protected main `040395bc7b0dedd40207f91f743bc2efc1584622` remains unchanged. Main → candidate: 75 commits ahead, 0 behind, 193 paths. This delta supplements the prior 190-path manifest and does not constitute independent DEC-022 review.

## Delta from a0ce9bf6

| Changed path | Change |
|---|---|
| `apps/api/prisma/migrations/20261125103100_ss11_thailand_custody_db_date/migration.sql` | added |
| `apps/api/src/equipment/equipment-custody.integration.spec.ts` | modified |
| `deploy/release-candidate/equipment-successor-historical.mjs` | added |
| `deploy/release-candidate/equipment-successor-historical.test.mjs` | added |
| `deploy/release-candidate/equipment-successor-populated.mjs` | modified |
| `deploy/release-candidate/equipment-successor-preflight.mjs` | modified |
| `deploy/release-candidate/equipment-successor-preflight.test.mjs` | modified |
| `deploy/release-candidate/historical-snapshot.mjs` | modified |
| `deploy/release-candidate/historical-snapshot.test.mjs` | modified |
| `deploy/release-candidate/hr-upgrade.mjs` | modified |
| `deploy/release-candidate/legacy-fixture.mjs` | modified |
| `deploy/release-candidate/verify-evidence.mjs` | modified |

## Verified this turn

- Exact local Node 22.16.0 tests: four test groups PASS, zero failures. Copied source and test blobs independently checked using git hash-object and GitHub readback: historical helper `62a95c391ef7f41923ef9f95e3cdb39297898e9f`, tests `2061ed1a356d82f094e480d9290ac5238ef59273`, preflight `ec76d5a28144b0b84daef27ac7ac532a9bdba3f0`.
- Only a verified new three-migration equipment increment can exclude the exact two new, ungranted permission definitions. Existing role grants stay in the historical digest; existing equipment installations are not excluded.
- Shared historical snapshot requires exactly two new empty equipment tables. Both legacy and HR consumers derive eligibility from actual recorded finished migration history and pinned SQL contents, not a user flag.
- Release verifier rejects partial equipment migration groups and receipts missing any of five equipment-specific proof fields. The current rehearsal producer does NOT yet emit these fields: the candidate is deliberately not admitted.

## Required before release

1. Implement and validate exact integrated rehearsal producer, with nonempty predecessor equipment data, paired recovery, installed SQL guard proof and external HR key/Document proof. Do not emit PASS merely because an earlier predecessor passed.
2. Execute full historical-consumer tests and targeted PostgreSQL migration/recovery evidence. The local helper tests did not execute the full checkout or real DB.
3. Independent exact-head DEC-022 review; preserve all 112 requirements and retained UAT, no stored grant, main merge or Production change.

Forecast: M4-08 4→3h, M4 43→42h, full ERP 1,773→1,772h. The provisional 1h reduction is for verified source-contract preparation, not actual runtime/release acceptance or timesheet credit.
