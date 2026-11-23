# M4 private integrated source candidate — 23 Nov 2026 SGT

**DRAFT, off main, no PR merge, no full CI or Production.** Base main SHA `3a441b1fa389a9a274e6ca82413740a3ffa2f51b`.

## Exact PR review sources
- PR #399: `c844897bed0cb945b72ce7bc85c2c179ae9f8999`
- PR #402: `8ed1660686707c6d50d319acfbf416b1cb2eac54`
- PR #403: `4350f1ed963dabf2bde8be9eb48de3e2893250c0`
- PR #404: `e8149d2bd594d03267accd93b956dc5e12194692`
- PR #405: `e4945ca8a8dd4aee748cca8db1040274bd091868`

## Source inclusion and sole collision
The 5 reviewed PR source manifests contain 12+10+6+6+6=40 path entries covering **38 unique paths**. Reviewed Git blob SHAs are referenced directly for **37 non-overlapping paths**; byte content of those files is unchanged. The sole shared `apps/api/src/inventory/inventory.module.ts` is regenerated from clean main to register **all three** new operational controller/service pairs (PM09, Nancy schedule, SS13), once each. That makes 38 source paths, plus this manifest.

No new permission grant, database schema, migration, action workflow file, stock ledger, financial effect, release CI waiver, Mac operator or Production deployment.

Each source PR has independent exact-head Codex review; SS13 [focused 10/10](https://github.com/threeswordz/cinder-grind/actions/runs/45090746454), PM09 [8/8](https://github.com/threeswordz/cinder-grind/actions/runs/45046846563), FM01 [focused success](https://github.com/threeswordz/cinder-grind/actions/runs/45045137226), BEN04 [15/15](https://github.com/threeswordz/cinder-grind/actions/runs/45042939215). Nancy's [6/6](https://github.com/threeswordz/cinder-grind/actions/runs/45048093847) applies to its predecessor source, while the final status-type fix was reviewed clean but not rerun.

**Integrated proof remains NOT RUN:** combined NestJS/Web typecheck, native PostgreSQL concurrency/session Company/Project actor/Document/role negatives, real browser, protected bytes, and formal M4 exit. Any future full release CI needs separate Owner authorization per #384; no merge to protected main, no Ready transition or Production without its normal gate.

**Owner #288:** Accounting and cross-module BEN02/BEN03 budget/expense packages remain deferred notwithstanding DEC-047 incident-specific Ben pre-spend policy. They are not secretly implemented by this operational integration. Human UAT is governed by DEC-042 and remains a separate Owner gate.
