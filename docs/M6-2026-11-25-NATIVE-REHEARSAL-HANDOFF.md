# M6 — exact-source isolated native rehearsal handoff

Status: **BLOCKED_ON_NATIVE_RUNTIME**, not a release instruction or deployment approval.

- Candidate: `b2f4e1d9582b5d260b9a76ed2ecb572149ae32f3` (isolated work-m6-03-procurement-inventory-20261125).
- Populated UOM application predecessor: `9fa0506e9a50fd556f1c4404e4db2e3d88093b85`.
- GitHub comparison: 138 commits ahead, 0 behind; 11 added migration SQL paths, no modified/deleted migration SQL in the returned comparison. No claim of native migration success.
- Frozen M4 PR #455: `280760321e5958035443721eb208dc090e614d93`; protected main: `040395bc7b0dedd40207f91f743bc2efc1584622`.
- Latest recorded combined synthetic contract: 8/8 local tests at predecessor c8ff9c92; new candidate has prior 11/11 HR final-preservation local tests; this is not a PostgreSQL dump, real Prisma schema, or authenticated HR custody proof.
- This session checked actual local executables: Node v22.16.0 present; psql/postgres/pg_ctl/Podman/Docker absent; no cached PostgreSQL packages, apt repository DNS resolution failed. No native run, no dispatch, no changes to application code or release gates.

## Pinned migration delta

These are Git object blob identities, not Prisma SHA-256 ledger checksums. Verify both sets independently in the real exact-source checkout.

| Migration directory | Git blob SHA |
|---|---|
| 20261121170000_dec054_cost_boq_self_approval_permission | `f89a6eb79597205849d6b8ead5984432dab8d201` |
| 20261122140000_fm02_weighted_project_progress | `337a096c498bd77364d8ae013e39f003fdac0c2c` |
| 20261123143000_pm02_partial_pr_line_review | `c7e904fea47fab743cb6af684fc55cb0363a4c85` |
| 20261123163500_pm02_review_trigger_scope | `160d8c0debca75269b4a0f0497c8fdfc74378773` |
| 20261123181000_pur04_po_commercial_header | `072293acec77a8a9c911dc78d1b0a39175820412` |
| 20261123185000_pur01_quote_exception_reason | `7825f4546a427a1bbe2afc793daac258ae5de08c` |
| 20261123190000_pur12_po_partner_short_names | `2342d5f965adaefa97fc72c3ee862c92c696f041` |
| 20261123201500_pur07_po_manual_dispatch_events | `82faa9d33f3573c6a332dec4b20047bfb5b42502` |
| 20261124023000_ss11_equipment_custody | `ce16f51eae3d597de431d5b890b70fc17fc63944` |
| 20261124221500_jai_asset_register | `8d730d5aebf75d98b9e47fd502a69242e951e56e` |
| 20261125103100_ss11_thailand_custody_db_date | `738aa01e59d883ae4a6165bedc08e221ce340cc1` |

## Single next native execution

1. In an authorized disposable environment with PostgreSQL 17.11, Node 24.21.0 and pnpm 12.6.0, obtain a clean exact candidate checkout. Verify the above ancestor and migration pins and all unchanged predecessor migration file checksums. If M4 changes, reconcile and re-pin the candidate before claiming release evidence. M4 independent review has priority on Codex recovery.
2. Identify an existing authorized populated synthetic UOM predecessor backup or a previously prepared disposable fixture from the preserved predecessor lineage. Verify its source SHA, database identity, synthetic-only companies/actors, lack of active sessions, matching Documents/uploads/external HR keys, and migration ledger. If no qualified fixture exists, report the missing fixture instead of substituting empty tables, real data or replaying completed original-Mac journeys.
3. Use a newly allocated isolated database and private storage paths; make a custom-format pg_dump and matching private file inventory from the disposable predecessor, restore to a separate fresh database, and verify the pre-migration snapshot and exact SQL row bytes, migration ledger and protected file/key bytes. Never use the original Mac source database, retained company data or a production connection for this rehearsal.
4. Apply only the pinned successor migrations with the repository's normal Prisma deploy command on the isolated restored database. Verify the migration ledger and the exact historical SQL byte guard, existing site/material, procurement and subcontract guards; compare actual Documents links, bytes and hashes, and recheck immutable recovery copies. Do not claim the original-Mac adapter was executed if the run invokes the guard functions directly.
5. Record actual tool versions, exact source and tree, predecessor provenance, database separation, applied migration SHA-256 values, table/row counts, file/key checks, all test conclusions and failure codes. Redact secrets, key material, contents and real credentials. Stop on any failed assertion; preserve diagnostic evidence, no automatic retry, no broadened grants, no full CI or merge.
6. Only after the evidence passes, re-estimate remaining M6 work. Native rehearsal is not original-Mac one-shot execution, independent DEC-022 review, retained UAT or M6 acceptance. Final source execution still depends on M4 and approved release/custody gates.

## Evidence and countdown

26 November: HR guard integrated; 0.5h provisional reduction once for verified HR source/test scope. M6 112.5h, M4 12h, M7 50h, M8 65h, combined 239.5h, full ERP 1,734.5h. Native rehearsal not executed.

26 November update: guarded integration succeeded; only three UAT paths changed, no migration files changed relative to c8ff9c92. Require historical HR preservation at final sealing after the single synthetic attachment. Do not claim the original Mac runtime has executed.
