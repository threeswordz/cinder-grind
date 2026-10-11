# Construction ERP — Operations Runbook

**Scope:** V1.0-D operations / observability / performance-readiness baseline  
**Governance:** DEC-008, DEC-016, DEC-022, BR-V10-12–16, D10-07/08/11/12  
**Production authority:** Technical green status does not authorize Production; AC-V10-039/040 remain Product / Business Owner gates.

## 1. Canonical procedures

Use these documents rather than duplicating or improvising their procedures:

- Production deployment, startup/restart/shutdown and deployment failure: `deploy/production/README.md`
- Backup, restore, recovery drill and rollback compatibility: `deploy/recovery/README.md`
- Current delivery state: `docs/CURRENT-STATE.md`
- V1.0-D scope and exclusions: `docs/V1.0-D-PREFLIGHT.md`

Never use `prisma migrate reset`, ordinary `db push`, destructive reverse SQL or an unreviewed rollback to recover Production.

## 2. Health / readiness interpretation

The API exposes non-sensitive operational endpoints under the normal API prefix:

- `GET /api/v1/health/live` — process liveness only. It must not depend on PostgreSQL or Documents storage.
- `GET /api/v1/health/ready` — safe-service readiness. It verifies PostgreSQL plus required Documents storage availability/identity.
- `GET /api/v1/health` — compatibility alias for readiness.

Expected ready payload contains only status markers and a timestamp. It must not disclose database connection details, storage paths, credentials or business data.

Operational interpretation:

- liveness fails → process/runtime problem; inspect process supervisor and startup logs.
- liveness passes but readiness fails → required dependency unavailable or invalid; do not route new traffic until resolved.
- readiness passes but a business request fails → investigate the request correlation ID, authorization/business error and owning module.

## 3. Correlation IDs

Every request receives a server-generated `X-Correlation-ID`. Client-supplied correlation IDs are not authoritative.

For incident investigation:

1. capture the correlation ID from the response/problem payload or `X-Correlation-ID` header;
2. search local/self-hosted logs for the exact correlation ID;
3. correlate request completion, authentication outcome and any server error event;
4. preserve relevant log lines and timestamps in the incident evidence record.

Do not put credentials, session cookies, CSRF tokens, passwords, query strings containing sensitive material or raw internal storage paths into tickets or chat.

## 4. Structured operational logs

Runtime operational messages are emitted to stdout/stderr as JSON message bodies suitable for native/open-source collection.

Baseline event families:

- `service.start` / `service.start.failed`
- `http.request`
- `auth.login` with `outcome=success|failure`
- `http.unhandled_error`
- `migration.start` / `migration.complete`

Common low-cardinality fields include timestamp, event, method, sanitized path, HTTP status, duration, server-controlled correlation ID and non-secret release/deployment metadata.

Secrets, credentials, tokens, request bodies, query strings, database URLs and raw storage paths are excluded by design.

## 5. Log retention and rotation

The application does not create an unbounded application-owned log file. Capture stdout/stderr with the chosen host/container supervisor and configure bounded retention using native/open-source facilities.

Minimum baseline:

- retain enough recent logs to investigate deployment/startup/auth/request failures and meet the organization’s operational evidence needs;
- cap disk usage by size and/or time;
- compress rotated files where supported;
- protect log access to authorized operators;
- never copy secrets into log filenames or rotation configuration.

Provider-neutral examples:

- **systemd/journald:** configure `SystemMaxUse`, `RuntimeMaxUse`, `MaxRetentionSec` and normal journal vacuuming appropriate to host capacity;
- **logrotate:** daily rotation, finite `rotate` count, `compress`, `missingok`, `notifempty`, restrictive ownership/mode;
- **container runtime:** configure its native local/json log size and file-count limits.

No SaaS logger, APM or SIEM is mandatory. Any paid observability dependency requires Change Control under DEC-008.

## 6. Startup / restart / deployment failure

Follow `deploy/production/README.md`.

Before an upgrade:

1. verify the exact approved release commit;
2. verify the matching recovery point;
3. place traffic in the documented maintenance/offline state;
4. run the production preparation gate;
5. apply forward-only migrations only;
6. start the exact prepared release;
7. verify readiness and HTTPS smoke before restoring traffic.

If startup or deployment fails, stop the rollout, preserve logs/evidence and use the documented recovery/compatibility path. Do not improvise schema changes.

## 7. Backup / restore / recovery

Follow `deploy/recovery/README.md`.

The PostgreSQL database plus Documents storage are one logical recovery set. RPO no worse than 24 hours and RTO no worse than 8 hours are approved initial operating targets, not contractual SLAs.

Use isolated restore drills. Never aim a drill at live Production database/storage.

## 8. Initial incident triage

1. establish impact and affected environment;
2. check process liveness;
3. check readiness and identify whether PostgreSQL or Documents storage is unavailable;
4. inspect structured startup/request/error/auth logs;
5. use correlation IDs for request-level investigation;
6. determine whether the event is availability, authentication/authorization, data-integrity, deployment/migration, storage or recovery related;
7. contain risk: stop rollout, drain traffic or disable the affected operational path when appropriate;
8. preserve exact release SHA, timestamps, relevant correlation IDs, commands run and observed errors;
9. escalate security/data-integrity/Finance/approval/migration incidents through the owning technical and Product / Business Owner channels;
10. do not self-authorize Production re-entry solely because automated checks become green.

## 9. Performance / capacity evidence

Use `apps/api/scripts/v1-0-d-benchmark.mjs` only in a confirmed non-Production environment. Evidence format and limitations are recorded in `docs/V1.0-D-PERFORMANCE-EVIDENCE.md`.

The benchmark is representative evidence for the tested environment only. It is not a contractual SLA or universal capacity commitment.

## 10. Concurrency / idempotency evidence

`docs/V1.0-D-CONCURRENCY-EVIDENCE.md` maps AC-V10-033 to the existing stock/payment/approval/subcontract regression suite. Those existing business semantics remain authoritative; V1.0-D does not invent a second implementation path.
