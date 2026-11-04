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

## Still required before freeze and Production

- PR #325 Material Plan C clean independent DEC-022 review, guarded merge and post-main CI before claiming an integrated C build. Do not waive or substitute this preflight for that review.
- On an approved isolated non-retained host, collect *actual* running API/web/DB identities, authenticated role Company/Project and maker-checker denials, Chromium/browser and populated DB+Documents+external HR key recovery evidence, including byte equality.
- Feed independently inspected receipts into the existing private prototype-freeze preflight. Complete one integrated human UAT only **after** the prototype is frozen under DEC-042. Actual retained MKE/TCJ permissions, GL-07 branch enforcement, hosted GL-08 recovery, GL-09 onboarding, GL-10 go/no-go and Production deployment are separate decisions. Existing 3/10 verified Production gates are not changed.

The built-in tests use wholly synthetic paths and adapters; they do not run human UAT, touch real storage, or exercise the app. This adds no mandatory dependency or recurring cost.
