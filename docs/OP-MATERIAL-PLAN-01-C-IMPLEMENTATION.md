# OP-MATERIAL-PLAN-01 C — integrated UI and technical closure (active, not accepted)

**Authority:** DEC-044 / #318 approved D1–D5 and MP-AC-14–16. **Predecessor satisfied:** Material Plan A #320 and B1 #323 were integrated and B2 #324 was guarded squash-merged as main `49a708838989773585c94631197ca674938fa3ff`; exact-main [CI41579615490](https://github.com/threeswordz/cinder-grind/actions/runs/41579615490) COMPLETED SUCCESS. The resulting B2 tree `38ce2e3dc27ae67aade0be10b23d092fd524302b` matches the final independently reviewed B2 tree. C is the next approved stage, with one designated Chat writer on `v1-material-plan-c-ui-20261103-chat` and [draft #325](https://github.com/threeswordz/cinder-grind/pull/325). No app change has merged from C.

## Current implementation on draft C branch (not yet proven in full CI)

- Source-owned `apps/web/src/api/material-plans.ts` and `material-plan-issues.ts` clients. All writes use existing authenticated CSRF-protected API; no client-side stock/approval ledger, fake checker, new backend authority or new dependencies.
- Permission-gated `InventoryWorkspace` Material Plans tab; responsive quantity-only plan draft/versions, source Cost BOQ choice, line allocation, submit, independent decision and read-only revision history. All new workflow strings have English, Thai and Traditional Chinese variants.
- `MaterialIssuesPanel` distinguishes an explicitly enabled synthetic Project plus a **captured** issue binding from a non-enabled or unbound legacy issue. An unknown or failed policy read blocks the new UI; the existing legacy backend remains authoritative for historical records. Issue UI provides complete line bindings to actual approved plan versions, explicit non-posting preview, direct within-plan canonical posting or independent overage review/final decision. Source request and signed-receipt workflows remain separate.
- Retry controls retain the **same requestKey and payload** after uncertain outcomes and prevent concurrent different actions; server rechecks Company/Project, current session/role, plan effective version, Cost BOQ quantities, physical stock, maker/checker, concurrency and immutable provenance. Interface never treats a preview, uploaded document or material request as posting.
- Registered source/locale/permission/legacy tests are preliminary defense-in-depth, **not** authenticated Chromium/UAT evidence. Native CI must compile and prove behavior; failures must be corrected before review or merge.

## Required remaining C execution

1. Resolve exact-head native web TypeScript/browser/API regression findings and strengthen the C integration tests to include authenticated source/no-cache/revocation and real browser flows. Preserve B2's six predecessor upgrades, populated paired PostgreSQL/Documents/external HR-key restore, and all previous suites.
2. Complete C criteria mapping: MP-AC-01–13 retain A+B predecessor evidence; MP-AC-14 requires actual EN/TH/zh-TW responsive authorized flows, backend-denied negative paths, stale/retry/history and new browser evidence; MP-AC-15 requires fresh migrations/upgrade/restore/CI/review/integration; MP-AC-16 human UAT is **DEFERRED TO FROZEN PRE-PRODUCTION PROTOTYPE** under DEC-042.
3. No C green/complete claim before exact-head push+PR native CI, genuinely independent final Codex review under DEC-022, clean thread disposition, guarded expected-head merge, and **separate** exact-main SUCCESS.
4. Then reconcile #304's 112 role-requirement IDs and GL-04/07/08/09 isolated prototype source/configuration/freeze evidence; real retained MKE/TCJ approvals, grants, data/host and Production remain separately gated.

### Exclusions
No BEN02 emergency bypass, financial write-off/valuation, cross-Company transfers, retained MKE/TCJ activation, additional Accounting/payroll or #245 multi-Project PO allocation, UAT, Production deployment or paid runtime service. Existing historical THB/BOQ Owner acceptance remains closed.
