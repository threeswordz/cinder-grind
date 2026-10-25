# V1.0-E Release Candidate Rehearsal

This directory implements the technical release-candidate evidence layer for AC-V10-035–038. It reuses the existing V1.0-A Production deployment pack, V1.0-B paired recovery controls, UAT authenticated acceptance suite and canonical Production smoke check.

The rehearsal is deliberately **non-Production only**. `RC_NON_PRODUCTION_CONFIRMED=YES` is mandatory, and AC-V10-039/040 remain human Product / Business Owner gates.

## What the rehearsal proves

- the workflow is running from one exact 40-character candidate SHA and a clean checkout;
- durable rehearsal evidence records Git/Node/pnpm/PostgreSQL-client/OpenSSL versions and, when executed in GitHub Actions, the exact workflow/ref, run ID/number/attempt, job and repository identity;
- the approved previous release is present in Git history and is an ancestor of the candidate;
- V1.0-E has not silently changed Prisma migration history or the Prisma schema; a change fails closed and requires an explicitly reviewed migration-aware fixture;
- migration-from-zero completes in an isolated PostgreSQL database;
- a representative current-schema/data database is created, paired with Documents storage and captured as a verified pre-upgrade recovery set;
- the actual `deploy/production/prepare-release.sh` upgrade path completes against the isolated target;
- the exact candidate starts in Production mode and passes the full authenticated runtime acceptance suite;
- the canonical `deploy/production/smoke.sh` passes through a loopback HTTPS boundary;
- rollback readiness is recorded only when the prior and candidate migration/schema contracts are unchanged.

The normal CI then runs the existing paired database + Documents recovery set, isolated restore and restored-runtime authentication drill for the same exact candidate. `verify-evidence.mjs` validates the persisted runtime/tool provenance, requires the rehearsal CI identity to match the current GitHub Actions run, consolidates both evidence streams, and refuses to mark AC-V10-039/040 complete.

## CI invocation

CI provides the last exact green pre-flight main commit as `RC_PREVIOUS_RELEASE_COMMIT`, the exact workflow SHA as `RELEASE_COMMIT`, and the disposable PostgreSQL service URL as `RC_BASE_DATABASE_URL`.

## Bounded V1.2 schema mode (DEC-033)

Application-only and SQL-only modes remain distinct and fail closed. When the Prisma schema changes, `schema-contract.mjs` admits only the four approved nullable monetary-root provenance fields and the Company SGD→THB default transition; it rejects unrelated models, required/defaulted provenance and other schema changes. Migration history must remain additive.

The schema-aware path checks out the exact previous release in a detached temporary worktree, installs its pinned lockfile, generates its own Prisma client and builds its API. It creates genuine NULL PO/Budget history before the existing provenance migration, completes the untouched previous-release migrations, creates SGD sources and runs the actual previous authenticated acceptance fixture with real LOCAL Documents. It snapshots every business/approval/ledger/audit table and old migration checksums before paired backup. The candidate runs the actual preparation/upgrade; unchanged-history, database-column contract and immutable-NULL checks run immediately after upgrade. Candidate acceptance uses a fresh disposable Company in the upgraded database, preserving legacy Company configuration and sources instead of duplicating its unique numbering configuration or relabelling it for new activity. Paired restore goes to separate database/Documents resources; the matching previous client/application authenticates and downloads a checksum-verified restored document. Candidate migrations must be absent there. Version-4 evidence binds these extra gates to the exact previous runtime and current CI run. Application-only rollback remains prohibited across schema changes.

The first B dependency adds the four nullable fields and immutability only. It deliberately leaves legacy NULLs, Company defaults and application monetary behavior unchanged. Full new-business THB policy, truthful reporting/UI and targeted policy regressions remain dependent B work under #246; passing this rehearsal alone does not complete THB-01–09 or human THB-10. No private Mac data, paid service or new runtime dependency is used.
