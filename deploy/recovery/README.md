# V1.0-B Backup / Restore / Recovery

This package implements the approved V1.0-B baseline under AC-V10-009–016, BR-V10-05–07/15 and D10-07.

## Recovery objectives

Initial approved operating targets:

- RPO: no worse than 24 hours;
- RTO: no worse than 8 hours.

These are operating targets, not contractual SLAs. Meeting the RPO requires scheduling verified recovery-set creation at least every 24 hours. RTO is measured through restore drills and operational evidence.

## Safety model

A recovery set is one logical business-record point containing:

- PostgreSQL custom-format dump;
- complete Documents storage archive;
- manifest with source release, database identity, storage deployment identity, versions, sizes and SHA-256 checksums;
- readiness marker.

The baseline recovery set is intentionally taken while the application is offline / traffic is drained. This avoids cross-store write races between PostgreSQL metadata and Documents bytes.

Recovery artifacts must be stored outside the repository and outside the live Documents root on access-controlled storage. Recovery-root containment is checked on canonical paths, including existing symlinks and `..` aliases, before any backup artifact is created. Scripts use restrictive umask/modes, but host encryption, replication and physical media controls remain operator responsibilities.

No script performs reverse migrations, `prisma migrate reset`, `db push`, database dropping or Production restore automatically.

## 1. Create a consistent recovery set

Prerequisites:

1. stop/drain Production traffic and the active API;
2. verify the intended Production Documents volume is mounted;
3. use the exact deployed release checkout;
4. install compatible `pg_dump`, `psql`, `tar`, Node.js and pnpm tooling;
5. choose an absolute recovery root outside Git and outside `STORAGE_ROOT`.

Example:

```bash
RECOVERY_ROOT=/srv/construction-erp-recovery \
RECOVERY_SITE_OFFLINE_CONFIRMED=YES \
PRODUCTION_ENV_FILE=/etc/construction-erp/production.env \
bash deploy/recovery/create-recovery-set.sh
```

The command fails closed unless the source Documents sentinel matches `STORAGE_DEPLOYMENT_ID`. Native PostgreSQL tooling receives a credential-free connection URL; password authentication is supplied through a temporary mode-`0600` `PGPASSFILE` that is removed on exit, so database passwords are not placed in `pg_dump` / `psql` / `pg_restore` process arguments. Database and Documents artifact SHA-256 values are computed with streaming reads so verification does not require loading large backup files into one Node.js buffer.

A completed set contains:

```text
<recovery-set>/
  database.dump
  documents.tar.gz
  manifest.json
  RECOVERY-SET.READY
```

Verify at any time:

```bash
bash deploy/recovery/verify-recovery-set.sh /srv/construction-erp-recovery/<recovery-set>
```

## 2. Isolated restore drill

Never point the drill at the source Production database or live Documents path. Database identity is resolved through live PostgreSQL connections using the connected server address, server port and `current_database()`, so hostname/DNS aliases and Prisma `?schema=` changes cannot disguise the source database. Native PostgreSQL tools receive a normalized, credential-free URL with Prisma-only query parameters removed; password authentication is provided only through the protected temporary `PGPASSFILE`. Before `pg_restore`, the target is also checked for database-wide emptiness rather than only the selected Prisma schema. `RESTORE_STORAGE_ROOT` is canonicalized before use and must be disjoint from live `STORAGE_ROOT` in both directions.

Create an empty non-Production PostgreSQL database first. The restore script must also know the Unix account that will actually run the API after restoration so restored Documents are owned and readable by that runtime account. Set `api_runtime_user` below to the existing host account used by your process supervisor. `RESTORE_RUNTIME_UID` and `RESTORE_RUNTIME_GID` are mandatory numeric IDs; if your supervisor uses numeric IDs directly, supply those numeric values instead.

Then run:

```bash
api_runtime_user=replace-with-api-runtime-account

RESTORE_ENVIRONMENT=drill \
RESTORE_DATABASE_URL='postgresql://.../construction_erp_restore?schema=public' \
RESTORE_STORAGE_ROOT=/srv/construction-erp-restore-drill/documents \
RESTORE_RUNTIME_UID="$(id -u "$api_runtime_user")" \
RESTORE_RUNTIME_GID="$(id -g "$api_runtime_user")" \
PRODUCTION_ENV_FILE=/etc/construction-erp/production.env \
bash deploy/recovery/restore-drill.sh /srv/construction-erp-recovery/<recovery-set>
```

Do not substitute the recovery operator's account merely to satisfy the gate. The UID/GID must identify the API runtime account that will read the restored Documents. When the drill is run as root, the script assigns that configured ownership without dereferencing links; when it is run unprivileged, the operator must already be the configured runtime UID/GID. The drill fails closed on an ownership mismatch.

The drill:

1. verifies manifest checksums and archive paths;
2. proves the target PostgreSQL database is empty at database scope, including rejection of other non-system schemas/user objects;
3. restores the database with `pg_restore`;
4. restores the matching Documents archive and enforces the configured API runtime UID/GID ownership;
5. verifies restored Documents ownership before the API is started;
6. runs Prisma migration status;
7. verifies every restored LOCAL Document metadata row against the restored byte size/checksum using streaming SHA-256 reads;
8. records restore duration/evidence.

After the script succeeds, start the API against the restored database/storage and run authenticated non-Production smoke/UAT. CI performs this automatically for the V1.0-B baseline.

## 3. Application-only rollback compatibility

Application-only rollback is deliberately conservative.

From the exact rollback release checkout:

```bash
ROLLBACK_RELEASE_COMMIT=<rollback-sha> \
CURRENT_RELEASE_COMMIT=<currently-deployed-sha> \
PRODUCTION_ENV_FILE=/etc/construction-erp/production.env \
bash deploy/recovery/verify-application-rollback.sh
```

The gate refuses application-only rollback if Prisma migration files differ between the two releases or if Prisma migration status does not report compatibility. If it fails, use the matching database + Documents recovery set instead. Do not write reverse SQL to force compatibility.

## 4. Production schema/data recovery

When schema/data recovery is required:

1. take the site offline;
2. select and verify the intended recovery set;
3. provision an empty recovery database and empty restore storage path;
4. restore database + matching Documents set together using the documented drill procedure adapted for the approved Production recovery window;
5. verify migration status, document metadata/bytes, authentication and safe read-only business smoke;
6. only then switch the application to the recovered logical set.

The baseline does not automate destructive replacement of an existing Production database/storage. That final cutover remains an explicit operator action so a wrong target cannot be silently overwritten.

## 5. Evidence

Record at minimum:

- recovery set ID and timestamp;
- source release commit;
- PostgreSQL / pg_dump versions;
- database and Documents checksums;
- restore environment;
- restore start/end/duration;
- migration status;
- restored document consistency;
- authenticated smoke result;
- operator conclusion / defects.

Use `deploy/recovery/RECOVERY-EVIDENCE-TEMPLATE.md`.

## 6. Open-source / zero-cost-first

The baseline uses PostgreSQL-native `pg_dump` / `pg_restore`, ordinary filesystem archives, Node.js and shell tooling. No managed backup service, cloud provider or paid storage product is required.
