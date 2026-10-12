# V1.0-E Release Candidate Rehearsal

This directory implements the technical release-candidate evidence layer for AC-V10-035–038. It reuses the existing V1.0-A Production deployment pack, V1.0-B paired recovery controls, UAT authenticated acceptance suite and canonical Production smoke check.

The rehearsal is deliberately **non-Production only**. `RC_NON_PRODUCTION_CONFIRMED=YES` is mandatory, and AC-V10-039/040 remain human Product / Business Owner gates.

## What the rehearsal proves

- the workflow is running from one exact 40-character candidate SHA and a clean checkout;
- the approved previous release is present in Git history and is an ancestor of the candidate;
- V1.0-E has not silently changed Prisma migration history or the Prisma schema; a change fails closed and requires an explicitly reviewed migration-aware fixture;
- migration-from-zero completes in an isolated PostgreSQL database;
- a representative current-schema/data database is created, paired with Documents storage and captured as a verified pre-upgrade recovery set;
- the actual `deploy/production/prepare-release.sh` upgrade path completes against the isolated target;
- the exact candidate starts in Production mode and passes the full authenticated runtime acceptance suite;
- the canonical `deploy/production/smoke.sh` passes through a loopback HTTPS boundary;
- rollback readiness is recorded only when the prior and candidate migration/schema contracts are unchanged.

The normal CI then runs the existing paired database + Documents recovery set, isolated restore and restored-runtime authentication drill for the same exact candidate. `verify-evidence.mjs` consolidates both evidence streams and refuses to mark AC-V10-039/040 complete.

## CI invocation

CI provides the last exact green pre-flight main commit as `RC_PREVIOUS_RELEASE_COMMIT`, the exact workflow SHA as `RELEASE_COMMIT`, and the disposable PostgreSQL service URL as `RC_BASE_DATABASE_URL`.

No paid service, hosted CI extension, schema migration or new runtime dependency is introduced.
