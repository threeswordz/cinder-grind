# M4 evidence reuse and exact-source gap reconciliation — 24 Nov 2026

Builder evidence triage only; not independent DEC-022 review or retained human UAT. This is a supplement to the 112-ID disposition and exact main-to-candidate review inventory. It supersedes any older summary that treats all historical cited runs as passing or as proof of the current entire candidate.

## Source identity and method

- Protected main: `3a441b1fa389a9a274e6ca82413740a3ffa2f51b`.
- Prior Draft #439: `e8c0b7775e7bde66679db70fb0af992a00ecf91a`.
- Builder follow-up source: `f1af4265c071b5c0988d87ef87be6ee2c810eaac`. The five follow-up paths are confined to supplier custody service, proof, tests and UI guidance; the old-run shared paths below are unaffected by that overlay.
- Queried actual Actions terminal results for ten distinct historical runs, and compared untruncated recursive Git trees at each run's exact head with the candidate. Compared auth, authorization, approval, project-access, Prisma schema, lockfile, and relevant procurement or site/projects API/UI and named browser proof paths. Counts are existing historical paths with identical blobs, not whole-program equivalence. New candidate paths and dependencies require independent review. No full CI or replay initiated for this reconciliation.

## Historical proof matrix

| Requirement / run | Exact tested SHA | Terminal result | Identical / changed / absent historical scoped paths | Disposition |
|---|---|---|---|---|
| PM02 [45127724396](https://github.com/threeswordz/cinder-grind/actions/runs/45127724396) | `94c57e0ab2901cbdc79fd44cf78a20da030da0d2` | SUCCESS | 44 / 8 / 0 | Prior native approved PO path; PO service, sourcing and schema changed |
| PM02 [45147124712](https://github.com/threeswordz/cinder-grind/actions/runs/45147124712) | `def391e855e43442174b7b91554191a9c0e004f3` | SUCCESS | 50 / 7 / 0 | Same browser script and PR surfaces; PO service/controller/UI/schema changed |
| PM02 [45181742276](https://github.com/threeswordz/cinder-grind/actions/runs/45181742276) | `06d2c707ddcfefe0fe2fd411f52ab3d1ddf6f060` | SUCCESS | 46 / 7 / 0 | Native forged-source test identical; PO and sourcing services/schema changed |
| FM01/BEN04/PM16 [45103782289](https://github.com/threeswordz/cinder-grind/actions/runs/45103782289) | `53e1bd2bca4b25fd8a3a658bd88020c6e4793c4f` | SUCCESS | 62 / 1 / 1 | Historical native test file absent from candidate; site and closeout services identical; schema changed |
| FM01/BEN04/PM16 [45176454339](https://github.com/threeswordz/cinder-grind/actions/runs/45176454339) | `4800827b7af88778d655a7882a00acbc8d31523a` | SUCCESS | 63 / 1 / 0 | Same site/closeout API/UI and Chrome script; schema changed, no whole-candidate proof |
| PUR01 [45142678279](https://github.com/threeswordz/cinder-grind/actions/runs/45142678279) | `c619b1e5bc253c02cfea116c483b7075b8ddcf86` | SUCCESS | 49 / 7 / 0 | Quote policy and its test identical; PO service/controller/UI/schema changed |
| PUR01 [45185452075](https://github.com/threeswordz/cinder-grind/actions/runs/45185452075) | `438ac2695e1fccc1345e6ce02566c3ca67f66f75` | SUCCESS | 50 / 7 / 0 | Same quote policy and Chrome script; PO service/controller/UI/schema changed |
| PUR04 [45187304506](https://github.com/threeswordz/cinder-grind/actions/runs/45187304506) | `e1a468fae1254587144f52c5ab491160514f5907` | SUCCESS | 50 / 8 / 0 | Prior native revision proof; revision test and PO service/controller/UI/schema changed |
| PUR12 [45149778502](https://github.com/threeswordz/cinder-grind/actions/runs/45149778502) | `da5711e0b2213d4051c01b2bd0c450485ce11b8e` | **FAILURE** | 51 / 7 / 0 | Pure identity, migration, build and web typecheck steps passed; static SQL guard existence step failed. Do not count overall run as PASS. |
| PUR12 [45150538123](https://github.com/threeswordz/cinder-grind/actions/runs/45150538123) | `53280039d123b2e3f18fc10b7a7c92128dd112b5` | SUCCESS | 52 / 7 / 0 | Actual MKE/TCJ PO creation/revision, missing-name and SQL mutation denial native test; identity helper and native test identical. PO service/controller/UI/schema changed. |

**9/10 successful historical runs; 1 failed overall.** The later successful PUR12 native run actually exercised the immutable identity SQL guard and Company separation. This is stronger bounded evidence than the failed earlier static grep, not a reason to mark that earlier run green or rerun it.

## Narrow remaining review agenda, no repeat by default

- M4-02 PM02: retain historical PR and browser evidence. Inspect the changed PO create/submit/approval/source-guard methods and sourcing delta before deciding whether a single integrated boundary test is necessary. Retained Store/Khaimook/Jai/Ben human access remains pending.
- M4-03 FM01/BEN04/PM16: 63 identical scoped blobs in successful browser source. Review the schema and new migrations, shared application composition and role/target configuration. The earlier native file `apps/api/src/projects/m4-fm01-closeout-native.integration.spec.ts` is absent; preserve its historical run, do not assume current native test exists. Determine whether it was intentionally omitted before restoration. Do not replay the successful Chrome journey merely for reassurance.
- M4-04 PUR01: quote policy and test unchanged; inspect PO submit/approve and new guards. Existing supplier thresholds and Ben exception rule are not new implementation work.
- M4-05 PUR04: changed revision test, PO service/controller/UI and schema need source-delta review; prior native proof remains historical, not exact final acceptance.
- M4-07 PUR12: retain actual native run 45150538123; correct failed-run reference. Check current identity snapshot creation and revision-copy methods and immutable migration. No new identity behavior invented.
- Shared boundaries: retained MKE/TCJ named actors, Project assignments, revocation, private documents, actual human UAT and independent exact-head review remain unverified. All seven IDs PM02/FM01/BEN04/PM16/PUR01/PUR04/PUR12 remain formally unaccepted. No source behavior or Owner decision changed by this document.

## Reviewer instructions

Use the latest exact candidate, not an older PR head. Compare against protected main, review changed shared dependencies and any actual defects; request only new focused proof where old evidence cannot support the changed behavior. Never convert this Builder triage to an independent signoff. No Ready transition, full CI, protected-main merge, retained-role grant or Production without required authorization.
