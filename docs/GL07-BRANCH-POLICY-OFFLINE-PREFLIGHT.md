# GL-07 GitHub branch policy — offline readback evaluator

**Purpose:** safe technical preparation for [#305](https://github.com/threeswordz/cinder-grind/issues/305), not a GitHub settings mutation or go-live authorization. Uses Node standard library only, no network, dependencies, credentials or business data.

## Operator workflow (only when permitted to read GitHub settings)

1. Read current repository branch/ruleset settings from the authenticated GitHub UI/API in the authorized context. Do not write or change repository settings merely to make this pass.
2. Create a sanitized JSON file with `repository.full_name`, `repository.default_branch`, `branch.name`, `branch.protected`, and `rulesets` exactly as returned by authorized GitHub readbacks. Exclude access tokens, cookies, private user or employee data.
3. Run:

    node deploy/uat/gl07-branch-policy-preflight.mjs --plan

    node deploy/uat/gl07-branch-policy-preflight.mjs --evaluate /private/sanitized-github-readback.json

    node --test deploy/release-candidate/gl07-branch-policy-preflight.test.mjs

The CI-registered synthetic tests execute through the existing `node --test deploy/release-candidate/*.test.mjs` step. No CI workflow edit, no access to GitHub admin endpoints and no Production connection are introduced.

## Policy proposal tested (not applied)

- Branch protection reports `main.protected=true`.
- An active branch ruleset targets default branch with no exclusion.
- The active applicable rules collectively require the exact check context `validate`, at least one PR approving review, block force pushes (`non_fast_forward`) and block branch deletion (`deletion`).
- Any bypass actors or missing bypass metadata are flagged for security/admin inspection instead of automatically whitelisted.

The tool checks these source/readback attributes, **not actual enforcement in a representative blocked merge**. Even a perfect proposal returns `PROPOSED_POLICY_MATCHES_READBACK_ADMIN_ENFORCEMENT_TEST_PENDING`, never a verified GL-07 gate. Actual administrative permissions and available GitHub policy enforcement must be checked before changing settings, and an Owner-authorized admin must still test that an unreviewed/unvalidated PR cannot merge.

**Current independently observed position, 31 Oct 2026 SGT:** `main.protected=false`, repository rulesets `[]`, detailed protection API inaccessible to connector (403). This is a known outstanding gap. Passing exact-head CI alone does not make main protected.

The provided input is untrusted operational evidence. No cryptographic attestation or verified timestamp is performed, and the script intentionally prints only summarized status/gaps, not raw private settings. Output includes `changesApplied=false`, `productionGateClosed=false`, `productionAuthorized=false` and `mainProtectionIndependentlyConfirmed=false` even for a matching proposed configuration. No Accounting, HR, stock, MKE/TCJ or Production changes.
