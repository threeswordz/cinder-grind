# Synthetic actors and initial authenticated HTTP journeys

Authority: [#305 runtime plan](https://github.com/threeswordz/cinder-grind/issues/305#issuecomment-6797754260), [Owner authorization6797969134](https://github.com/threeswordz/cinder-grind/issues/305#issuecomment-6797969134), [Mac startup receipt6824299437](https://github.com/threeswordz/cinder-grind/issues/305#issuecomment-6824299437). The current Builder is the sole writer of this bounded tooling increment. No new business policy or retained grant is approved by this document.

## Starting point and technical scope

The Owner reported `SYNTHETIC_RUNTIME_STARTED` on **12 November 2026, 20:57 SGT**. The existing app stays at `6fe8c4c22b002f66f00593975d381a284581f058`, with private runtime `~/Construction-ERP-Prototype-Runtime`, PostgreSQL `proto_a_01`/55471, API33071 and web44171. Keep the container, processes, source, schema, storage, credentials and external HR keyring intact. **Do not rerun startup, reset a database or run the general integration suite on this candidate.**

`deploy/uat/prototype-actors.mjs` adds a create-once local coordinator. After its exact-head push/PR CI, stable independent DEC-022 review, governed merge and exact-main CI pass, the Builder supplies a byte-verified immutable download command. Do not execute a branch copy. The operator validates its bytes against green main and permits only enumerated tooling/test/guide/current-state/workflow paths between the pinned app and operator. No application, schema, dependency or approval engine changes are included.

## Modes and stop conditions

- `--plan`: inspect source, successful startup receipts, private target/container/process/listener identities, exact applied migration checksums and the pristine technical-admin-only database. No local writes or login/session mutations. Database identity checks and SELECTs only.
- `--configure`: repeat those checks; exclusively create a protected setup marker and private random actor credentials; then one serializable, advisory-locked transaction rechecks the pristine baseline and creates synthetic fixtures. Existing actors/data, wrong identity or partial provisioning stop without overwriting, deletion or automatic retry.
- The entry guard resolves symlink paths before comparing the Node module URL, fixing the silent-entry behavior reproduced through macOS `/var` aliases. Source bytes remain verified before target writes.

The fixed database client URL is constructed only from the private previously generated `proto_runtime` password and exact loopback55471/`proto_a_01`; inherited database/key/container/Git/Node/Prisma overrides are not accepted as target selection. Child identity probes use an environment allowlist. Rootful/remote Podman connections, public bindings, extra mounts, changed images/PIDs, wrong source or schema checksums reject. There is no target override CLI.

The marker deliberately survives a failure. **Return only the sanitized status. Do not reset/delete/rerun after partial setup.** Credentials and detailed evidence remain0600 under the existing0700 private runtime. Never upload `runtime-private.json`, `actors-private.json`, keyring files, environment dumps or raw logs. No passwords appear in command-line arguments or audit records.

## Synthetic fixture and explicit capabilities

- Eight distinct synthetic actors: Ben, Nancy, Khaimook, Jai, Store Site, Foreman, Porn and Koh functions. Each has a separate canonical Employee, login password, `PROTO_*` Role and explicit action permissions. Existing technical SYS_ADMIN is unchanged and is a ninth negative probe. This is a bounded test matrix, **not a complete production default role definition**.
- `PROTO_A` has `SITE_A` and `SITE_B`; all actors are members of SITE_A. Only Ben/Nancy/Khaimook/Jai test roles have explicit all-Project view authority. Restricted actors must be denied SITE_B. `PROTO_B`/`SITE_FOREIGN` is a separate ungranted denial fixture; it receives no users or HR grants.
- Persisted HR categories mirror the already approved matrix: Koh/Nancy employment, identity, bank, documents; Ben employment; Porn employment/bank; operational functions and SYS_ADMIN receive no private HR categories. Category scope does not imply action capability, other-Company access or approval authority.
- Synthetic customer, UOM, material and site warehouse support an initial quantity-only count and material request. No opening stock ledger or Finance transaction is seeded. The Store-created count is independently approved by Khaimook through actual HTTP before its quantity is available.
- Each actor setup has an audit record containing only synthetic scope/permission/category metadata. The transaction creates no permission catalogue entries, changes no existing roles/grants and has no upsert/reset fallback. Random credentials are stored privately before committing account creation.

## Actual initial technical evidence

The same exported provisioning/journey core runs in **a fresh uniquely named native PostgreSQL CI database**, then against the authorized Mac candidate only after reviewed integration:

1. Real login, `/auth/me` identity and exact effective role/permission comparisons for all eight actors; assigned, unassigned and foreign Project outcomes. Separate SYS_ADMIN login must have no approval/HR authority.
2. Anonymous and Foreman count denial, Foreman PR denial, missing-CSRF denial; Store creates/submits a count; Store lacks approval permission; Khaimook independently approves; identical decision replay produces one canonical stock row. This is independent approval plus an action-denial probe, **not a self-approval-policy test with an eligible maker**.
3. Foreman cannot create a material request; Store captures the Foreman's request; repeated request key returns the same request; Foreman can read it. No additional stock row is posted by request capture.
4. Koh enrolls the existing synthetic Foreman Employee with encrypted employment history and writes dummy private identity/bank values through the actual HR API. Default reads must mask them. Explicit reveal must follow the approved category/action matrix, including Porn's bank-only boundary and other-Company denial. Native CI also verifies the stored ciphertext does not contain those dummy private values.
5. Foreman creates/submits a daily report; Ben reads its nonempty seven-calendar-day summary with `READ_ONLY_NO_APPROVAL` and cannot create the daily report. No approval operation is invented for weekly reporting.
6. All established sessions are explicitly logged out, including after a later probe fails. Private HTTP evidence records unique request/correlation IDs and expected/actual outcomes; output excludes response bodies, identities, credentials and cookies.

Success is `SYNTHETIC_ACTORS_INITIAL_HTTP_VERIFIED`. Failure is `SYNTHETIC_ACTORS_BLOCKED` with a stable code; unknown exceptions never print private details. Initial verification cannot certify the complete112-ID baseline, all business roles or a freeze.

## Remaining work and evidence boundaries

This increment does **not** establish actual authenticated browser journeys, complete PR/RFQ/PO/GR, Material Plan issue/overage, transfers, subcontract/physical acceptance, signed/HR document coverage, locale usability or populated restore. It does not enable a Material Plan policy. Those remain follow-up technical increments under their existing rules. The real operational gaps and open policy inputs in [#304](https://github.com/threeswordz/cinder-grind/issues/304#issuecomment-6724446015) remain unresolved by actor configuration.

After the remaining required technical scope/journeys and separate paired DB/Documents/external-key recovery pass, audit and freeze the prototype for **one full business UAT** under DEC-042. Historical THB/BOQ acceptance stays closed. Full-scope verified Production gates remain3/10. New Accounting/payroll/#245, emergency defaults, retained MKE/TCJ imports/grants, repo administrator changes and Production deployment remain excluded.

## CI registration and limitations

`deploy/release-candidate/prototype-actors.test.mjs` is picked up by the existing test glob. It covers wrong-target rejection, source-diff allowlist, container scope/binding, private-file permissions/links, symlink entry, pristine DB rejection, in-transaction refusal, capability separation and status/evidence sanitization. `.github/workflows/validate.yml` adds one native harness step after the existing workspace validation; all prior tests/browser/upgrade/recovery registrations are preserved.

`deploy/uat/prototype-actors-native.mjs` refuses non-Linux/non-GitHub-CI invocation and nonstandard CI base identity. It creates and drops only its own random `actor_proto_ci_*` database, uses a private temporary document directory, starts an owned loopback API child and always attempts bounded cleanup. It never targets the Mac prototype or changes the shared CI application database. Native CI proof is not actual Mac operator execution, a browser test, populated recovery, Owner UAT or GL completion.
