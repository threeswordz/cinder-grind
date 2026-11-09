# Construction ERP — fresh isolated Mac prototype operator handoff

**Status:** staged operator preparation only; does **not** authorize host activation, Production, retained access, migration, or business UAT. Source tracked under GL-08 [#305](https://github.com/threeswordz/cinder-grind/issues/305). Exact-main/CI and an eligible Owner/operator decision must precede use. This handoff does not prove the Owner's Mac was contacted or that a prototype runs.

## 1. Required authority and preconditions

The Product / Business Owner must explicitly authorize a **new synthetic-only prototype** on an available Mac and designate the local operator. This approval is separate from existing V1.1/V1.2/V1.3 retained datasets, real MKE/TCJ users and Production. **Do not run any Mac preparation from a generic Work/cloud shell that cannot inspect local Podman and existing workstation resources.** The user must inspect the proposed path and ports before any creation.

- Target checkout: `~/Construction-ERP-Prototype-Checkout` — a **new** separate clean Git checkout on the current green independently reviewed `main`.
- Target runtime: `~/Construction-ERP-Prototype-Runtime` — must **not exist**; the tool creates it and its `db`, `documents`, `hrkeys` children as private `0700` directories.
- Manifest: `~/Construction-ERP-Prototype-Runtime/prototype-target.json` — new private `0600`, zero credentials, not committed to Git.
- Proposed loopback-only ports: API `33071`, Web `44171`, PostgreSQL `55471`, database `proto_a_01`. Never bind to `0.0.0.0` or assume these are unused. Historical V1.1/V1.2/V1.3 ports are excluded by the existing target checker.
- Eight synthetic functional personas: Ben, Nancy, Khaimook, Jai, Store Site, Foreman, Koh, Porn; isolated `PROTO_A` and denial `PROTO_B` Companies, `SITE_A/SITE_B`, technical SYS_ADMIN with no implicit business approvals.
- Required pinned toolchain Node `24.21.0`, pnpm `12.6.0`, Git, Podman/Postgres 17.11 for later runtime (this scaffold does not invoke Podman).

## 2. Operator procedure — only after the explicit target decision

First check the latest **full 40-character** GitHub `main` SHA, exact-main CI SUCCESS and no unreviewed new code. Do **not** reuse a historical SHA simply because it appears below. Inspect filesystem for collisions and existing services using read-only tools before these commands.

```bash
# Fill with the current exact-green main SHA, obtained directly from GitHub.
MAIN_SHA='<EXACT_VERIFIED_40_CHARACTER_MAIN_SHA>'
# Refuse pre-existing target paths (including symlinks) before cloning.
[ ! -e "$HOME/Construction-ERP-Prototype-Checkout" ] && \
[ ! -L "$HOME/Construction-ERP-Prototype-Checkout" ] && \
[ ! -e "$HOME/Construction-ERP-Prototype-Runtime" ] && \
[ ! -L "$HOME/Construction-ERP-Prototype-Runtime" ] || { echo 'TARGET_NOT_EMPTY_OR_COLLISION'; exit 1; }
# A fresh checkout; never reuse or modify earlier retained ERP checkouts.
git clone --no-checkout https://github.com/threeswordz/cinder-grind.git "$HOME/Construction-ERP-Prototype-Checkout"
git -C "$HOME/Construction-ERP-Prototype-Checkout" checkout --detach "$MAIN_SHA"
# Confirm the clone's exact SHA; never relax this check.
test "$(git -C "$HOME/Construction-ERP-Prototype-Checkout" rev-parse HEAD)" = "$MAIN_SHA" || exit 1
# The scaffold stays outside the clean Git checkout; use the local operator kit folder.
KIT_DIR='<ABSOLUTE_PATH_TO_UNPACKED_OPERATOR_KIT>'
node "$KIT_DIR/prototype-target-scaffold.mjs" --plan --sha "$MAIN_SHA"
```

Expected *plan-only* status: `OPERATOR_PLAN_READY`. Plan mode does **not** create files or bind ports. It refuses a dirty/wrong-origin/wrong-SHA checkout, mismatched Node, unsafe home or pre-existing runtime root. The command prints no tokens or private paths.

After the operator confirms no collisions and has explicit authority to create **only new empty synthetic resources**:

```bash
node "$KIT_DIR/prototype-target-scaffold.mjs" --prepare --sha "$MAIN_SHA" --confirm CREATE_FRESH_SYNTHETIC_ONLY
```

Expected status: `FRESH_PRIVATE_TARGET_PREPARED`. This means **private empty directories and a local manifest only**. It does not start Postgres, apply migrations, create users, activate policies, touch retained data, verify actual permissions, create a restore, or certify the prototype. It fails closed if the target already exists and deliberately never deletes anything on failure. Inspect any partial newly created root manually; do not use `rm -rf` or retry with an existing path.

From the verified clone, then execute the two **existing integrated source** checks on that brand-new prepared target:

```bash
cd "$HOME/Construction-ERP-Prototype-Checkout"
MANIFEST="$HOME/Construction-ERP-Prototype-Runtime/prototype-target.json"
node deploy/uat/prototype-target-preflight.mjs "$MANIFEST" "$MAIN_SHA"
node deploy/uat/prototype-target-port-preflight.mjs "$MANIFEST" "$MAIN_SHA"
```

`LOCAL_SAFETY_PREREQUISITES_OBSERVED` checks directory/SHA/manifest declarations; `PORTS_TEMPORARILY_BINDABLE` observes momentary bindability and releases listeners. Neither identifies existing Podman containers/process ownership, reserves ports, authenticates roles, proves the manifest's assertions, or authorizes later runtime writes.

## 3. Stop / handoff after safe scaffolding

**Stop before starting Podman/DB/API/Web.** A separate operator-safe provisioning execution plan must verify unused container/volume identifiers and actual process/storage ownership, then authorize new synthetic fixture creation, credentials, effective scoped grants, migrations and paired backup/restore in these fresh resources. Existing V1.1/V1.2/V1.3 resources must never be reused, reset, upgraded or mounted by this operator flow. No real MKE/TCJ user/account/document should enter these folders.

The eventual prototype freeze requires **actual** authenticated API + Chromium business journeys for eight personas, Company/Project denied access, maker/checker segregation, Store plan→Khaimook→Ben overage, request→actual issue→signed receipt, Count and HR privacy, and independent *populated* DB/Documents/external HR-key restore with byte equality and history. Source tests, synthetic browser transport and this scaffold are not those receipts.

After a genuinely green freeze candidate is recorded, DEC-042 permits the one comprehensive human cross-role UAT. Real Production GL07 branch protection remains absent unless an administrator has separately enforced it. Production deployment remains unauthorized.

## 4. CI and risk boundary

- The standalone scaffold uses built-in Node and Git; no new package, paid service or network call occurs *inside* the script. It loads the existing verified target assessor from the exact clean checkout; never copy files into the checkout to run it.
- It **only creates brand-new private paths** after the exact clean `main` checkout exists, owner/operator opt-in is provided and preconditions pass. It never force-writes, removes, or rewrites an existing directory/manifest.
- Its synthetic regression tests create disposable Git repositories, check no-write failure modes and modes `0700`/`0600`, and are registered through the existing `node --test deploy/release-candidate/*.test.mjs` CI glob.
- This standalone operator-kit candidate is **not yet merged or independently Codex-reviewed**. It must be submitted into governed GitHub source control, pass exact-head PR and push CI and **independent Codex review under DEC-022** before being recommended for actual Mac execution. No manual human UAT is conducted by CI.