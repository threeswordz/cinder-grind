# Construction ERP — Zero-Cost Self-Hosted UAT

This pack runs the current approved Construction ERP release candidate on one computer using only already-approved project components:

- Node.js / pnpm
- PostgreSQL 17.11 in Podman
- NestJS API
- compiled React/Vite web assets
- Node.js built-in HTTP server for local static-file serving
- local filesystem document storage

It adds **no paid service and no new npm runtime dependency**.

## Security boundary

This V0.1 pack is deliberately **localhost-only**:

- API: `127.0.0.1:3000`
- Web: `127.0.0.1:4173`
- PostgreSQL: `127.0.0.1:55432`

Do not change these hosts to `0.0.0.0` or expose them to a LAN/Internet as a shortcut. A network-accessible UAT deployment needs a separately reviewed HTTPS/TLS setup.

The local UAT environment uses `NODE_ENV=uat` so the browser can use the existing session cookie over loopback HTTP. Production remains unchanged and continues to require Secure cookies.

## Prerequisites

Install the approved project toolchain:

- Node.js 24.21.0
- pnpm 12.6.0
- Podman
- Git
- curl for the small process smoke script

No cloud account is required.

## 1. Check out the exact release-candidate branch/head

Use the active release/stage PR and `docs/CURRENT-STATE.md` as coordination references, with live GitHub as the source of truth. Confirm the exact release-candidate head and required CI gates in GitHub before UAT.

## 2. Create local UAT configuration

```bash
cp deploy/uat/.env.example deploy/uat/.env
```

Edit `deploy/uat/.env` and replace the database and bootstrap passwords. Never commit this file.

## 3. Prepare the release candidate

```bash
bash deploy/uat/prepare-release.sh
```

This:

1. starts PostgreSQL in Podman
2. installs the frozen dependency graph
3. generates/validates Prisma
4. runs the production dependency audit
5. applies all migrations
6. verifies migration status
7. executes the complete typecheck/test/build gate

## 4. Bootstrap the first UAT administrator

For a fresh UAT database only:

```bash
bash deploy/uat/bootstrap-admin.sh
```

The bootstrap intentionally refuses to run after application users already exist.

## 5. Start API and web

Terminal 1:

```bash
bash deploy/uat/run-api.sh
```

Terminal 2:

```bash
bash deploy/uat/run-web.sh
```

Open:

```text
http://127.0.0.1:4173
```

## 6. Run basic process smoke checks

Terminal 3:

```bash
bash deploy/uat/smoke.sh
```

Then execute the authenticated/business smoke checklist in:

- `docs/V0.1-DEPLOYMENT-ROLLBACK.md`
- the release-specific UAT evidence document (for V0.7: `docs/V0.7-UAT-EVIDENCE.md`; historical V0.1 evidence remains in `docs/V0.1-UAT.md`)

The scripts do not self-mark those human checks as passed.

## 7. Persistent data

PostgreSQL uses the named Podman volume configured by `UAT_DB_VOLUME`.

Project document bytes use:

```text
$HOME/.construction-erp-uat/documents
```

by default.

Stopping the container does not delete PostgreSQL data.

## 8. Stop

Stop the API/web foreground processes with Ctrl+C, then:

```bash
bash deploy/uat/stop.sh
```

Do not delete the Podman volume or document directory until UAT evidence/backups are no longer required.

## 9. Evidence to record

Before Product / Business Owner sign-off, record:

- exact Git commit
- machine/environment identifier
- migration status
- basic smoke result
- authenticated smoke results
- UAT scenario actual results
- defects/retests
- Product / Business Owner decision

V0.1 remains incomplete until the human gates in Issue #27 are explicitly recorded.


## 10. Credential mismatch recovery for a fresh UAT database

PostgreSQL initializes the database user's password only when the named data volume is first created. If `UAT_DB_PASSWORD` is changed in `deploy/uat/.env` after that first initialization, the application will receive an authentication failure even though the new password is valid text.

If the UAT database is still fresh and contains no business data/evidence that must be retained:

```bash
bash deploy/uat/reset-fresh-database.sh
```

Type `RESET-UAT-DB` when prompted, then rerun:

```bash
bash deploy/uat/prepare-release.sh
bash deploy/uat/bootstrap-admin.sh
```

Do not use this reset after UAT data/evidence must be retained. At that point use controlled password rotation/recovery instead of deleting the volume.
