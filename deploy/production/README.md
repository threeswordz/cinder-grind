# Construction ERP — V1.0 Production Deployment Baseline

This directory implements the V1.0-A provider-neutral Production environment/deployment baseline under AC-V10-001–008.

It adds no mandatory paid service. The reference topology is:

```text
Browser
  |
HTTPS
  v
Open-source reverse proxy / static web server
  |                         |
  | /api/*                  | web assets
  v                         v
NestJS API              apps/web/dist
  |
  +--> PostgreSQL
  +--> configured Documents storage
```

The included Caddy file is an example open-source HTTPS boundary, not a hosting-provider commitment. An equivalent approved open-source reverse proxy may be used.

## 1. Production environment contract

Use `.env.example` only as a template. Real Production values, especially `DATABASE_URL`, must be supplied outside Git through a protected host/process-manager environment file or equivalent secret mechanism. The deployment scripts parse this as data with Node's `.env` parser; they do **not** shell-source or evaluate file contents, so credentials containing shell metacharacters are preserved as values.

Required critical Production inputs:

- `NODE_ENV=production`
- `RELEASE_COMMIT` — full approved 40-character Git SHA
- `DEPLOYMENT_MODE` — `fresh` or `upgrade`
- `UPGRADE_SITE_OFFLINE_CONFIRMED` — `YES` is mandatory for upgrades and may be set only after public traffic is in maintenance/offline and the active API is stopped; fresh deployments use `NO`
- `RECOVERY_POINT_VERIFIED=YES`
- `RECOVERY_POINT_REFERENCE` — non-secret evidence identifier for the verified pre-migration recovery point
- `API_HOST` / `API_PORT`
- `WEB_ORIGIN` — HTTPS public browser origin
- `VITE_API_BASE_URL` — `/api/v1` for the preferred same-origin topology
- `DATABASE_URL`
- absolute persistent `STORAGE_ROOT`

The API independently fails fast on unsafe/missing critical Production configuration.

## 2. Exact-release preparation

Check out the exact approved release commit and ensure the working tree is clean.

```bash
git checkout <approved-release-sha>
git rev-parse HEAD
```

Provide a protected environment file:

```bash
cp deploy/production/.env.example /secure/path/construction-erp-production.env
chmod 600 /secure/path/construction-erp-production.env
```

Set `RELEASE_COMMIT` in that file to the exact checked-out SHA. Create the persistent document directory with permissions for the application account.

Use an inactive versioned release checkout rather than building over the currently served release. The reference layout is:

```text
/srv/construction-erp/releases/<release-sha>/   # prepared immutable checkout
/srv/construction-erp/current -> releases/<activated-sha>
/srv/construction-erp/documents/                # persistent storage
```

The Caddy example serves web assets through `current`. For a **Production upgrade**, first place public traffic into an explicit maintenance/offline state and stop the active API. Only then set `DEPLOYMENT_MODE=upgrade` and `UPGRADE_SITE_OFFLINE_CONFIRMED=YES`. Do not set that confirmation merely to satisfy validation. Prepare the new versioned checkout while the site is offline. After all preparation gates pass, atomically switch the `current` pointer using the host's link/rename mechanism, start the new API, restore HTTPS traffic, and run the smoke check. This prevents a new browser bundle being served against the old API/schema during preparation.

Then run:

```bash
PRODUCTION_ENV_FILE=/secure/path/construction-erp-production.env \
  bash deploy/production/prepare-release.sh
```

The preparation gate validates the environment, verifies the exact commit, requires a clean working tree, verifies the persistent Documents storage sentinel, verifies the exact Node.js and pnpm versions declared by the repository, installs the frozen lockfile, generates/validates Prisma, audits Production dependencies, runs non-destructive typecheck/build, applies only forward Prisma migrations, and verifies migration status. **It deliberately does not run the repository integration test suite against the Production database.** Full tests must already be green in CI against isolated CI PostgreSQL for the exact release commit. Before `prisma migrate deploy`, the gate also requires `RECOVERY_POINT_VERIFIED=YES` and a non-secret `RECOVERY_POINT_REFERENCE`. For an upgrade this reference must identify the verified matching database + Documents recovery set; for a genuinely fresh empty deployment it documents the verified empty-state recovery point. V1.0-B supplies the full backup/restore/recovery procedure.

## 3. HTTPS / same-origin boundary

The preferred initial Production shape serves the web app and API under one HTTPS origin:

- web: `https://erp.example.com/`
- API: `https://erp.example.com/api/v1`

Build-time `VITE_API_BASE_URL=/api/v1` keeps browser API requests same-origin. An absolute HTTPS API base is accepted only when it uses the same origin as `WEB_ORIGIN`; cross-origin Production browser/API deployment is intentionally rejected while sessions use `SameSite=Lax` cookies. A future cross-site cookie model would require explicit security design and Change Control rather than being enabled implicitly.

`Caddyfile.example` shows an open-source reference. Configure DNS and TLS prerequisites for the chosen environment before exposure. Do not expose the NestJS API directly to the public Internet as a shortcut.

## 4. Start / restart / shutdown

Start the API under the chosen host process supervisor so it receives the protected environment. The provided foreground command is:

```bash
PRODUCTION_ENV_FILE=/secure/path/construction-erp-production.env \
  bash deploy/production/run-api.sh
```

For a service manager:

- **start:** launch the exact prepared release using the command above; API startup independently verifies the persistent storage sentinel and refuses to start if the configured storage volume/path identity is unavailable;
- **document I/O:** Production document reads/writes/removals re-check the storage sentinel so a volume disappearing after startup fails closed instead of silently writing to an underlying host directory;
- **restart:** stop the current API process gracefully, verify it exits, then launch the same approved release/environment;
- **shutdown:** send the process supervisor's normal termination signal and allow NestJS shutdown hooks to run;
- **failed start:** keep the reverse proxy from routing traffic to an unhealthy API, preserve logs, and do not improvise database changes.

The concrete service-manager unit may be systemd, OpenRC, a container supervisor, or equivalent. V1.0-A deliberately does not mandate a hosting provider or paid orchestration service.

## 5. Post-start smoke

After the HTTPS boundary is active:

```bash
PRODUCTION_ENV_FILE=/secure/path/construction-erp-production.env \
  bash deploy/production/smoke.sh
```

This checks only non-destructive web and health access through HTTPS. The web check requires both a 2xx response and stable Construction ERP application markers, so a default proxy/host page cannot pass. Business/UAT and final Production go/no-go remain later V1.0 gates.

## 6. Deployment failure

If environment validation, dependency installation, build, migration, or startup fails:

1. stop the rollout;
2. record the exact release SHA and failing command;
3. preserve logs;
4. do not use `prisma migrate reset`, ordinary `db push`, or ad-hoc destructive reverse SQL;
5. determine schema compatibility before any application rollback;
6. use V1.0-B backup/restore/recovery procedures when database/storage recovery is required;
7. retest in a non-Production environment before another Production attempt.

## 7. Evidence

Copy `DEPLOYMENT-EVIDENCE-TEMPLATE.md` into the release evidence record and fill it with the exact commit, runtime/tool versions, environment identifier, migration status, build result, HTTPS/reverse-proxy version, process supervisor, smoke result, defects and operator decision.

## 8. Provider-neutral boundary

This package does not select a cloud, VPS, managed database, object store, identity provider, WAF, CDN, monitoring SaaS, Kubernetes platform, or paid process manager. Such choices remain separate owner/Change Control decisions when they create cost or lock-in.
