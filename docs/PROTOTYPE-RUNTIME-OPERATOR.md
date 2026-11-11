# Authorized fresh Mac prototype runtime operator

Owner runtime authorization: [#305 receipt6797969134](https://github.com/threeswordz/cinder-grind/issues/305#issuecomment-6797969134), accepting the [concrete plan6797754260](https://github.com/threeswordz/cinder-grind/issues/305#issuecomment-6797754260). No further approval of that same synthetic startup scope is required. Owner remains local Mac operator; this Work workspace cannot execute on the Mac.

## Current application and operator identities

The already-prepared application checkout and private target manifest stay pinned to reviewed, green application commit `6fe8c4c22b002f66f00593975d381a284581f058`, exact-main CI43028941941 SUCCESS39/39. Do not delete/reclone/reset the successfully prepared target.

`deploy/uat/prototype-runtime-operator.mjs` is a separate operational coordinator using the existing application build, forward migration, bootstrap, API and web commands. It adds no app/schema/business-policy/dependency/workflow change. Before workstation writes it requires its own bytes to match the subsequently reviewed and green live main file (Git blob SHA), plus exact-main push CI for that operator main. The GitHub comparison from the pinned app commit may include **only** the operator, its tests, this guide and Current State. Any app/schema/policy/workflow or other change blocks for reconciliation. The deployed application source SHA and operator main SHA remain separately reported; no claim of a later application deployment is fabricated.

This source candidate must complete exact-head CI, independent stable-head security review, governed merge and exact-main CI before local recommendation. Existing tests run automatically under the release-candidate glob. Do not run an unreviewed branch copy on the Mac.

## Local use after the operator package is merged and green

Obtain a byte-for-byte copy of the green-main script as `~/Downloads/ERP-Prototype-Start.mjs`. The same Node24.21.0/pnpm12.6.0 used by the prepared target is required. Do not modify the downloaded script; its content hash must match green main.

```bash
node "$HOME/Downloads/ERP-Prototype-Start.mjs" --start
```

Optional `--plan` performs the same read-only target/GitHub/Podman inspections and temporary port checks without target writes or startup. Actual local `--start` is already Owner-authorized, not another human UAT request.

## Concrete behavior and stop conditions

1. Require the canonical prepared private dirs and original manifest, clean pinned app checkout, local rootless `podman-machine-default`, exact private paths and unused loopback33071/44171/55471. Refuse nonempty db/documents/hrkeys, existing private provisioning files, preexisting new container name, modified `.env`, symlinks, wrong source or unsafe defaults. No automatic reset, cleanup, overwrite or partial-start retry.
2. Create only private0700/0600 logs/config/upload/receipt/key files within the authorized runtime. Generate independent random DB/admin credentials and external HR keyring; never print credentials or pass passwords on command lines. Child environments discard inherited DB/PG/HR/bootstrap/container/Git/preload/registry-token overrides.
3. Install only the frozen dependency graph; generate/validate Prisma; build the reviewed app with the chosen API origin. No general integration-test suite against this candidate. Existing source stays clean.
4. Pull approved PostgreSQL17.11-alpine, pin its observed image ID, create only `construction-erp-proto-6fe8c4c2-postgres` with synthetic labels, explicit nonroot keep-id70:70 mapping, no extra capabilities or auto-restart, a single bind mount of the prepared db dir and only127.0.0.1:55471. Inspect ID/image/labels/mount/binding before starting; check database name/version/empty public tables before forward migrations.
5. Apply existing forward migrations, check status and bootstrap only PROTO_A / `proto-admin@example.invalid` technical SYS_ADMIN. Start direct owned Node API/web children with private logs and PID/source receipts. Verify their own PIDs hold the loopback listeners, API readiness/DB/Documents, web index, technical-admin login/me/no approval grants and logout. All secrets remain private; return only sanitized status.

Success is `SYNTHETIC_RUNTIME_STARTED`. This proves only the observed initial runtime/technical-admin checks; it is **not** a full role matrix, actual authenticated multi-role Chromium journey, populated recovery, prototype freeze, human UAT, GL closure or Production readiness. Next work remains the approved synthetic actors/journeys, #304 gap disposition, populated separate recovery and audit/freeze. Human UAT stays deferred DEC-042.

Failure is `RUNTIME_BLOCKED` with a stable code. Return that JSON only. Private `logs` and `runtime-private.json` may contain secrets; do not upload them or raw Podman inspect/environment output. The tool deliberately retains newly created resources on failure for identity inspection and refuses rerun after a partial start. It never starts/stops/removes the historical UAT containers, mounts retained resources, switches rootful/helper/default connections, imports real data, enables production material-plan policy or grants real users.

## Validation limits

Local focused regressions use synthetic identity/manifest fixtures and prove failure boundaries, environment isolation and source-digest handling. Native CI preserves existing application/database/browser/upgrade/recovery regressions. Neither runs this Mac operational flow or proves Podman bind-mount UID behavior on this workstation. Actual owner output is required; a mount/permission/process failure stops without a misleading success receipt. The initial Mac scaffold and temporary bindability were previously Owner-reported PASS, not independently accessed by Work.
