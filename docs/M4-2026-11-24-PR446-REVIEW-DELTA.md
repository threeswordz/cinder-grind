# PR446 review delta — canonical CG asset register

Builder handoff only, not DEC-022 independent review or formal acceptance.

- Protected main `3a441b1fa389a9a274e6ca82413740a3ffa2f51b`.
- Previous [Draft #445](https://github.com/threeswordz/cinder-grind/pull/445) `2e2831eea4badeac84d1b59e3f1b0b5e00d37bc5`.
- Current [Draft #446](https://github.com/threeswordz/cinder-grind/pull/446) `57cf3c7e61b3699d56ea71dd0c5fd452f5b4f1f0`.
- Full protected-main compare 342 ahead, 0 behind, 189 paths (152 added, 37 modified). Review earlier full inventory and [PR445 delta](M4-2026-11-24-PR445-REVIEW-DELTA.md) plus actual complete diff.
- Initial [45413683447](https://github.com/threeswordz/cinder-grind/actions/runs/45413683447) FAILED compile (malformed nested Prisma select), native test skipped. Corrected only actor select syntax and [45414048568](https://github.com/threeswordz/cinder-grind/actions/runs/45414048568) OVERALL SUCCESS, exact workflow-only child `226243d403f6c361697568ffbcd3d6da1c24c93c`; fresh PG17.11 migrations, API compile, React typecheck, actual HTTP/PG proof marker JAI_ASSET_NATIVE_CG_ACQUISITION_IMMUTABLE_HISTORY_CUSTODY_SCOPE_PASS.

| Overlay path | Blob |
|---|---|
| apps/api/prisma/migrations/20261124221500_jai_asset_register/migration.sql | `8d730d5aebf75d98b9e47fd502a69242e951e56e` |
| apps/api/src/equipment/equipment-asset-register.service.ts | `6f053f3dd0237085835fd2a7d39214109c04f96d` |
| apps/api/src/equipment/equipment-asset-register.controller.ts | `79525e3704cd738a540725770617e0880cabc1f4` |
| apps/api/src/equipment/equipment.module.ts | `e31c0afc0eaddb82b87126cca415531f2a637db6` |
| apps/api/src/equipment/equipment-asset-register.native.integration.spec.ts | `d3e50fa04eae59b02cd1b2829e5876997d45d3e9` |
| apps/web/src/equipment/EquipmentAssetRegisterPanel.tsx | `79d32e190341d9e1f70e2855b0f2e76e8f41958e` |
| apps/web/src/equipment/EquipmentPanel.tsx | `f812ec38e5ce50a5e2dda67cc09c116701d928f7` |
| apps/web/src/AdminConsole.tsx | `a96e0216be98e1f339b4dc6bcaae245807fd846c` |

JAI-ASSET-01: reuse canonical CG Equipment ID with separate forward-only immutable acquisition version rows. Date/value THB explicit nullable for unknown; documentary reference and reason, base location, previous version. Existing current assignment and permitted open employee custody derived, no duplicate asset/borrower master. SQL Company/actor/identity/version guard, updates/deletes refused; CG code cannot change once acquisition or custody history exists. No historic rewrites, no new retained roles, no depreciation, invoice validation, AP/payment, stock posting or financial valuation. Generic audit contains version ID, not purchase value or evidence text.

Live active Employee/session/roles, existing equipment.equipment.view and procurement officer + manage for edits; finance manager read only. Require Project access for all current/historical assignment locations; no assignment requires existing projects.access_all. Custody read requires existing custody view. This is conservative chosen scope, not a new retained grant. Current assignment is source location, base location is operator record not physical verification. 100 version and 100 historical Project caps. Subcontract borrower identity/liability still policy-blocked. Need retained role grants, actual MKE/TCJ browser UAT, populated migration/restore and independent review. Native test verified unassigned denial, foreign and same-Company unauthorized Project denial, Store value denial, Nancy read/no write, nulls, stale save, immutable SQL history and CG code, custody link/return, permission and Project revocation, no stock/AP. No scale or concurrent write test.

PUR15 next: #288 explicitly defers new Accounting; operational PO/GR/evidence read packet may be separated from supplier invoice, tax, mismatch, credit/payment changes. Do not infer authority to build cross-role Accounting handoff or change Porn rights. Existing operational source-only packet can be proposed within purchasing scope; actual finance workflow remains GL06. 
