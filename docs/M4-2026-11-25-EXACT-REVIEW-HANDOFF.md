# Exact M4 independent-review handoff — 25 November 2026

Application candidate: `220b781aea8752e9b6762bf2d4e8cba06b44f2de`; protected base: `040395bc7b0dedd40207f91f743bc2efc1584622`. Complete tree comparison 205 files, 115 commits ahead / zero behind. This docs-only handoff is not an independent verdict or formal admission. Review the pinned source, not the documentation commit. A later source SHA requires a refreshed manifest.

## Review lanes

| Group | Changed files |
|---|---:|
| workflows | 1 |
| migrations | 9 |
| api | 93 |
| web | 29 |
| deploy | 61 |
| docs | 12 |

Nine migration files are added, no migration file modified/deleted; this is a tree fact, not a blanket guarantee of safe SQL. Reviewer must check migration behavior and the modified schema and validation workflow. Review protected workflow trigger boundaries under #384, cross-domain auth/role/company/project invariants, PO revision/cancel/supplier serializable collision, PUR07 bounded retry and fail-closed PDF, preserved stock/Finance, paired DB/doc/HR-key recovery, FM01 actual role binding, immutable 112 IDs and six Owner boundaries. Full file inventory and exact old/new blob IDs in companion JSON.

## Source-bound passing witnesses (not transferred full CI)

- **FM01 integrated** — [45615355077](https://github.com/threeswordz/cinder-grind/actions/runs/45615355077), source `4d6e56a13bd6f662336c364b36527ed3852e3036`; Synthetic actual Chrome/API/PG; not full current candidate.
- **PUR07 Thai PDF** — [45615060550](https://github.com/threeswordz/cinder-grind/actions/runs/45615060550), source `e6120e20aaa46ab245e3a08b00935d3bba4c7fb5`; Synthetic actual buyer/Ben PDF and reported external dispatch.
- **PUR01/04 commercial revision** — [45616676458](https://github.com/threeswordz/cinder-grind/actions/runs/45616676458), source `da65349825426f9501f2e4b52440f6d326f20b68`; Synthetic real browser and audit.
- **Paired recovery** — [45613742239](https://github.com/threeswordz/cinder-grind/actions/runs/45613742239), source `36ff707c95d819491074fa40b38ca4df5cf83996`; Earlier exact integrated source; successor changes not full revalidated.
- **PUR12/PUR14 actual native** — [45614092149](https://github.com/threeswordz/cinder-grind/actions/runs/45614092149), source `36ff707c95d819491074fa40b38ca4df5cf83996`; Actual native scope, no retained acceptance.
- **Supplier race native** — [45611459901](https://github.com/threeswordz/cinder-grind/actions/runs/45611459901), source `cd64404a92d172240bfac6efcf3d7df4643d79c8`; Exact earlier collision test.
- **BEN01** — [45617599765](https://github.com/threeswordz/cinder-grind/actions/runs/45617599765), source `d8fd736f05cdc88f745476467edd0ff9ab849fc2`; Configured synthetic role, not unique retained assignment.
- **PM05** — [45618076009](https://github.com/threeswordz/cinder-grind/actions/runs/45618076009), source `ab1d571f21ffb7295134135689d56d0532029b48`; Synthetic real BOQ HTTP export scope.
- **Master role** — [45618250092](https://github.com/threeswordz/cinder-grind/actions/runs/45618250092), source `cb8e4b70ff4eab45fcf839316ac718426cf49ce4`; Synthetic Nancy/Jai/Store configured roles.

## Outstanding gates

- **Supplier latest revision browser** — in_progress; [run 45619654984](https://github.com/threeswordz/cinder-grind/actions/runs/45619654984)
- **Operational exceptions browser** — BLOCKED_INDEPENDENT_SOURCE_REVIEW; deploy/uat/m4-operational-browser-native.mjs
- **DEC-022** — BLOCKED_INDEPENDENT_REVIEW_QUOTA_LAST_OBSERVED; 
- **Full release CI** — BLOCKED_SPECIFIC_OWNER_AUTHORIZATION_AFTER_REVIEW; 
- **Retained eight-persona acceptance** — BLOCKED_RETAINED_CONFIGURATION_AND_HUMAN_UAT; 

No retained grants, no owner waiver, no Production or new full CI. Do not promote, merge or self-approve. Prototype 4/8 and GL3/10 remain. Operational browser source explicitly requires independent review before execution. Request fresh specific Owner authority only after independent review and missing evidence are reconciled.
