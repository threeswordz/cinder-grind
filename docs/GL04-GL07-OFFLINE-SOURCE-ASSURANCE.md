# GL-04 / GL-07 offline source assurance

**Scope:** P0 read-only source verification for #304 and #305 under Production tracker #278. This stage does not grant business roles, alter app state, or authorize real MKE/TCJ/Production access.

## Run with Node (standard library only)

    node deploy/uat/gl04-gl07-source-assurance.mjs --plan
    node --test deploy/uat/gl04-gl07-source-assurance.test.mjs
    node deploy/uat/gl04-gl07-source-assurance.mjs --check

The command reads local repository files only. It checks 112 unique historical role requirement IDs and the approved baseline counts; matches selected existing controller routes to their own method, permission and Auth/PermissionGuard decorators; and checks that GitHub Actions source names the validate job with PR/push triggers and read-only contents scope. Negative tests cover duplicate ID, source status drift, adjacent decorators, missing guards and altered CI job.

**Interpretation:** SOURCE_CHECKS_PASS_RUNTIME_UNVERIFIED means source checks passed, not that MKE/TCJ users, Project assignments, effective grants, approval steps, branch protection, hosted backups, actual restore or Owner UAT were checked. Runner output must retain NOT_RUN/UNVERIFIED. No CI result can close GL-04/GL-07 or claim Production go-live. A mismatch requires investigation, not an automatic allegation of an exploit.

Physical stock-count PR #300, Foreman weekly report PR #302 and HR #297–299 are not on main and are not counted as active. Other agreed launch plans are in draft PR #303 and Issues #304/#305. No new Accounting development, repeated accepted THB/BOQ UAT, retained grants, merge or Production deployment.
