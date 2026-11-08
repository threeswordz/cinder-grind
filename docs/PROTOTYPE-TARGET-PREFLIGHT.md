# GL-08 — isolated prototype target safety preflight

**Scope:** approved #305 preparation, non-Production only. This new *read-only* local check reduces the chance of accidentally pointing the future pre-production prototype at an existing retained workstation service. It is distinct from `deploy/uat/validate-isolated.mjs` (disposable PostgreSQL tests), `gl04-synthetic-role-matrix-preflight.mjs` (caller-supplied authorization evidence), and `prototype-freeze-preflight.mjs` (evidence packet structure).

**This does not launch a prototype, connect to the ERP/database, inspect user permissions, validate sample fixture contents, verify actual network reachability or conclude any GL gate.** All declarations, including `retainedDataUsed:false`, remain unverified. A successful result is `LOCAL_SAFETY_PREREQUISITES_OBSERVED`, *not* a deployment/freeze/Production PASS. There are zero application runtime/schema/grants/configuration changes.

## Use after a separate safe-target decision

1. First choose and separately authorize a **non-retained isolated target**. Do not run against MKE, TCJ, V1.1/V1.2/V1.3 retained data, or a Production host. This check cannot prove your chosen directories and ports are free of unknown retained processes; independently inspect the machine before any writes. A clean checkout of the **exact** green integrated main, a separate private staging root, and distinct database/Documents/HR-key subdirectories must exist *before* executing the check.
2. Create a private JSON manifest with the exact keys below. The example uses invented paths/ports: replace them with reviewed **currently unused** loopback bindings and private directories. It contains no passwords, tokens, URLs with credentials, real employee data or secret material. Store it outside Git with file permissions `0600`. Directories under `isolationRoot` must exist, be real (not symlinks), belong to the current OS user, and have no group/other permissions. Every storage subdirectory must be a **direct child** of `isolationRoot`; checkout and isolation root cannot contain one another.
3. Run the checker from the exact main checkout. It only inspects local directory metadata and calls `git` read-only to verify head/clean status; it never executes application code or initiates network/database requests.

```json
{
  "schemaVersion": 1,
  "purpose": "ISOLATED_PROTOTYPE_TARGET_PREFLIGHT",
  "mode": "isolated-synthetic",
  "expectedMainSha": "REPLACE_WITH_40_HEX_MAIN_SHA",
  "companyCodes": ["PROTO_A", "PROTO_B"],
  "projectCount": 2,
  "personas": ["Ben", "Nancy", "Khaimook", "Jai", "Store Site", "Foreman", "Koh", "Porn"],
  "productionConnected": false,
  "retainedDataUsed": false,
  "realCompanyGrantsModified": false,
  "runtime": {
    "checkoutRoot": "/private/reviewed-erp-checkout",
    "isolationRoot": "/private/erp-proto-candidate",
    "databaseRoot": "/private/erp-proto-candidate/db",
    "documentsRoot": "/private/erp-proto-candidate/documents",
    "hrKeysRoot": "/private/erp-proto-candidate/hrkeys",
    "apiOrigin": "http://127.0.0.1:33071",
    "webOrigin": "http://127.0.0.1:44171",
    "postgresHost": "127.0.0.1",
    "postgresPort": 55471,
    "postgresDbName": "proto_a_01"
  }
}
```

```sh
node deploy/uat/prototype-target-preflight.mjs /private/prototype-target.json EXACT_MAIN_40_HEX_SHA
```

- **Exit 0:** local directory, name, endpoint and exact-clean-checkout prerequisites observed. No runtime deployment or independent proof is claimed.
- **Exit 1:** coded gaps; fix the underlying safe setup and inspect the actual target before rerunning. No path, credential or private input value is printed.
- **Exit 2:** invalid/unreadable/private-file-permission input. No material action is taken.

Historical reserved workstation ports (`3000`, `3001`, `3002`, `4173`, `4174`, `4175`, `5432`, `55434`) and non-loopback HTTP origins are refused to protect previously identified development environments. **This static list is not an exhaustive port-occupancy audit.** Actual bindability, service ownership, DB isolation, filesystem provenance and storage separation must still be independently inspected. No implicit Company/project/business grants are supplied by the JSON.

## Additional temporary loopback bindability check

**Integration boundary:** `deploy/uat/prototype-target-port-preflight.mjs` carries the existing three-file #305 preparation into a governed safety increment. Verify its actual PR/main integration and CI receipts in #305 before operational use, against an independently authorized non-retained target. Never copy and run an unreviewed branch script against a retained/Production workstation environment.

When it is merged into an exact, clean integrated main checkout, use the **same** owner-only `0600` private manifest and same exact SHA:

```sh
node deploy/uat/prototype-target-port-preflight.mjs /private/prototype-target.json EXACT_INTEGRATED_MAIN_40_HEX_SHA
```

The command calls the existing read-only target checker first. **Only if that succeeds**, it briefly attempts an exclusive bind of all three declared `127.0.0.1` ports (API, web and PostgreSQL). It does not connect to existing processes, authenticate, inspect a database, start ERP/PostgreSQL, reserve a port for later startup, modify configuration or create persistent files. It closes all successfully opened listeners, including on later failures. A cleanup error reports `PORT_RELEASE_UNVERIFIED` and `portsHeldAfterCheck: "UNKNOWN"` rather than a false cleanup success. Responses contain only stable gap codes, never manifest values, credentials or paths.

- `PORTS_TEMPORARILY_BINDABLE`: *observed at that moment only*. This is **not** a guarantee of future availability; another process can bind immediately afterward.
- `PORT_PREFLIGHT_BLOCKED`: existing target check failed, a declared port is occupied/unsafe, the local socket operation failed or release could not be verified.
- CLI exit `0` = temporary bindability; `1` = blocked; `2` = invalid input/read failure. **No exit state** establishes a running ERP, safe ownership of retained services, applied role grants, material-plan activation, HR recovery, GL-08 completion or authorization to deploy.
- The six focused regressions plus one combined real temporary-Git/directory/socket regression are registered through `deploy/release-candidate/prototype-target-port-preflight.test.mjs` and the existing `node --test deploy/release-candidate/*.test.mjs` glob. No workflow or existing gate is changed. The combined regression uses the actual target assessor, proves all ports released after success and a busy-database failure, and proves a dirty checkout prevents binding. Native CI receipts remain separate from local test results.

**Safety constraint:** The preflight has a time-of-check/time-of-use race and is not sufficient to activate a prototype; a separately authorized operator must independently check actual running services, port/process ownership, DB/database identity, persistent Documents and HR key isolation, and live authenticated browser/role tests before any future prototype freeze.

## Still required before freeze and Production

- Material Plan C #325 and test-only #327 have completed independent review, guarded integration and exact-main CI; [Current State](CURRENT-STATE.md) records exact evidence. Preserve those controls for any later material source change; this preflight never substitutes for required review.
- On an approved isolated non-retained host, collect *actual* running API/web/DB identities, authenticated role Company/Project and maker-checker denials, Chromium/browser and populated DB+Documents+external HR key recovery evidence, including byte equality.
- Feed independently inspected receipts into the existing private prototype-freeze preflight. Complete one integrated human UAT only **after** the prototype is frozen under DEC-042. Actual retained MKE/TCJ permissions, GL-07 branch enforcement, hosted GL-08 recovery, GL-09 onboarding, GL-10 go/no-go and Production deployment are separate decisions. Existing 3/10 verified Production gates are not changed.

The built-in tests use synthetic adapters plus one temporary local Git checkout and disposable OS directories (removed after each run); they do not run human UAT, touch retained data, or exercise the ERP application. This adds no mandatory dependency or recurring cost.
