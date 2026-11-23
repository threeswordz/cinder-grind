# M4 FM01 and BEN04 native PostgreSQL evidence — prepared, not yet executed

Source: reviewed application [#407](https://github.com/threeswordz/cinder-grind/pull/407) exact `62d2ce23810938784caa66aab6e427e49030d7fe`. This isolated test-only candidate adds NO application change, role grant outside its disposable fixture, database migration, new release workflow or Production action.

`apps/api/src/projects/m4-fm01-closeout-native.integration.spec.ts` uses real NestJS HTTP, AuthGuard and CSRF with fresh synthetic Company, unrelated same-Company Project, different-Company Project, actual Employee/Role/User/UserSession objects and company-scoped role permissions. Database is strictly localhost `erp_m4_weekly_closeout` with explicit `M4_NON_PRODUCTION_CONFIRMED=YES`; no destructive schema-reset SQL, retained actors/targets, Mac, protected real data or Production.

## Two targeted native journeys
- **BEN04/PM16:** original Khaimook PROJECT_MANAGER prepares 6 source-referenced categories, Ben MANAGEMENT and Nancy FINANCE_MANAGER sign the *same* version independently with exact source fingerprint; outsider Project and other Company read fail closed; PM self-sign and duplicate Ben sign denied; 2nd preparation supersedes prior signatures; old fingerprint rejected, new signoff works. Project remains active (no archive) and stock/DirectCost rows do not change.
- **FM01:** original Foreman PROJECT_ENGINEER creates zero-work report in explicitly configured Project working calendar, declares no-work before submit and corrects reason after submission; wrong actor and duplicate reason denied; full 7-date real weekly snapshot includes corrected source; Ben MANAGEMENT acknowledges exact fingerprint (NOT approval); Foreman cannot acknowledge; repeat denied and subsequent read shows CURRENT review. No ActivityProgress or stock/Finance ledger effects.

This proves only actual API/DB journeys with synthetic test role grants, **not** all eight retained roles, real browser UI, complete calendar time zone/holiday permutation, concurrency race stress, FM02/UOM/Receiving/Mac re-execution or overall 112-ID business UAT. The 3-workflow Nancy/PM09/SS13 native [#45101879795](https://github.com/threeswordz/cinder-grind/actions/runs/45101879795) already PASS and **must NOT rerun**; this is disjoint FM01/BEN04 source.

Next: independent Codex review then one bounded fresh Postgres 17.11 test-only workflow with parent-source-identity guard, Prisma forward-only migrations, one API build and only this compiled test. Failed fixture => diagnose/fix targeted without running full CI; successful evidence only after actual job result.

Owner #384 prohibits full CI without fresh specific approval; Owner #288 defers BEN02/BEN03 financial development; DEC-042 comprehensive human UAT deferred. M4 remains 4/8 GL3/10, no main merge/Production.
