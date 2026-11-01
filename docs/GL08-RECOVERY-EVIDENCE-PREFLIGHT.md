# GL-08 recovery evidence — offline consistency preflight

**Scope:** P0 safe technical evidence preparation for [#305](https://github.com/threeswordz/cinder-grind/issues/305) and [#278](https://github.com/threeswordz/cinder-grind/issues/278). Reuses the existing approved PostgreSQL custom-format dump + Documents archive + manifest + ready marker architecture. It does not create backups, open a database, access MKE/TCJ, download files or authorize Production.

## Run locally (Node standard library only)

    node deploy/recovery/gl08-evidence-preflight.mjs --plan

    node --test deploy/release-candidate/gl08-evidence-preflight.test.mjs

    node deploy/recovery/gl08-evidence-preflight.mjs --evaluate /secure/sanitized-gl08-evidence.json

The plan output gives a *blank* evidence template, NOT a claim of real activity. Only an explicitly authorized host/operator may fill actual receipts from source-backed evidence. Avoid putting hostnames, connection strings, personal records or credentials into GitHub. Do not supply private documents or backup bytes to this report.

Required evidence fields reference the existing `deploy/recovery/manifest.mjs` schema: manifest v1/recovery set ID/createdAt/release SHA/Document count/storage identity and paired `database.dump`/`documents.tar.gz` sizes+SHA256. The receipts separately attest that `verify-recovery-set.sh`/document archive checks succeeded, an **off-host independent encrypted** copy matches both checksums, and a **populated isolated** restore preserved database + Document bytes and started a matching compatible release with readiness checks. Restore provenance is the *source* storage identity; the isolated runtime may use its own different sentinel identity.

Time validation uses the runner's actual clock: supplied observation must be within 60 minutes and no more than five minutes future skew; the latest verified source backup must be no older than **24h (RPO target)**, and measured isolated restore duration must not exceed **8h (RTO target)**. Missing/future/stale or impossible ISO UTC timestamps fail closed; a documented empty-store drill is not enough.

The 24-hour backup limit is measured at evaluation time, not at the earlier observation timestamp. Reports retain `observedBackupAgeMinutes` and separately expose `evaluatedBackupAgeMinutes`, so observation freshness cannot extend the RPO. Storage deployment IDs must also match the canonical recovery manifest's existing constraint: 3–64 characters, beginning with a letter or digit and followed only by letters, digits, dots, underscores or hyphens. Failing-before regressions cover the stale-backup false match and invalid leading punctuation; no target or manifest format changes.

**Security/truth boundary:** This is a **caller-supplied, unauthenticated, off-line declaration consistency check**, not source-file hashing or authenticated runtime attestation. Even coherent inputs produce `RECEIPT_FIELDS_CONSISTENT_INDEPENDENT_VERIFICATION_PENDING` with `gatesClosed=0`, `verifiedByIndependentOperator=false`, `productionAuthorized=false`, `backupStarted=false`, `restoreStarted=false`. The operator must separately prove the hashes/bytes/actual off-host storage, record real host/scheduler operation, measure restored application startup, independently bind the environment to the release and obtain Owner go/no-go. Synthetic CI is not GL-08 closure.

Any eventual *real* backup, restore, scheduler configuration, real MKE/TCJ access or Production deployment requires separately authorized target, operator, environment and scope. This PR does none of those. No new Accounting or repeated accepted THB/BOQ UAT.
