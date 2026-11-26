# M6-03 / SS16 independent review handoff

Status: BUILDER PREPARATION — NOT DEC-022 INDEPENDENT APPROVAL.

## Immutable evidence anchors

- Protected main: 9417f07c609dbc091b5bbe2e09071c5e2c316459.
- Owner Mac exact native PASS: 8418bbdc1309dacfccc2a11ecbbbccbaa8b19624 (Event199, issue #414 comment 7202462859). All migrations applied; consolidated test 1/1, no failures. Earlier authority/build and posted GR proof retained; earlier six native groups, PUR14 and FM02 not replayed.
- Changed historical HTTP regression candidate: dfb79e44b4c92523dd4d805d915d590065304c80. Three integration specs and isolated regressions-only runner; NOT yet executed.
- Component browser test preparation: 136dd64ffc5b32b091d02269a0154d2c2a9f3e7b. Real Chromium with synthetic transport only; NOT run yet, NOT authenticated browser acceptance.
- No retained grant, Production release, full CI authorization or acceptance inferred.

## Source audit observations

1. Four legacy direct reverse HTTP endpoints are guarded and refuse execution, but the four canonical service reverse methods still accept calls without the SS16 request transaction. Existing direct-service regressions intentionally exercise the canonical stock primitive. Search the complete application tree for every caller, including scripts, internal service routes and generic ApprovalService.cancel/approve. Determine whether any reachable non-SS16 caller can create a new reversal or cancellation; distinguish isolated tests/historical tools from runtime paths. Do not remove historical records or simply grant new permissions.
2. MovementCorrectionRequest has immutable UPDATE/DELETE protection. This alone is not a universal INSERT/decision/stock-effect proof. Inspect reciprocal entity/Company binding, unique pending requests, same-transaction decision proof and raw SQL mutation boundaries for all four movement families, not only material-plan and custody-specific guards. Validate transaction isolation and concurrent original posting vs cancellation, stale approval/workflow, revoked grants and Project membership.
3. listForSource is scoped to own requests for Store and source-wide requests for PM; latest 100 bounded rows. Review role/capability checks, all transfer Projects, query/cache invalidation, decision comment/history visibility, and dual-role self-denial. Current component shows reason, requested timestamp and approval state but does not display decision comment/actor/time from the API list. This is an explicit unresolved SS16 history UX gap, not an acceptance claim.
4. The component stores uncertain request intent locally. A component unmount (record change, role switch, denied source) can lose the pending intent. Review safe persistence keyed by Company + actor + source and exact body; never replay under a different actor or unauthorized source. Same-mounted retry is tested by the new synthetic browser fixture only.
5. Retained workflow configuration is still missing evidence. Synthetic fixtures establish exact one-step PROJECT_MANAGER approval and explicit movement-specific grants. Confirm retained role configuration without silently broadening permissions; use read-only evidence first and request Owner authorization for any required retained grant/workflow mutation under governance.
6. Preserve existing receiving evidence and deadlines, transfer original APPROVED status before dispatch, material-plan latest authorization and immutable allocations, legacy posted history, canonical stock reversal and audit. Review partial outstanding transfer custody and dependent returned-issue constraints.

## Focused evidence sequence

1. Run the three changed historical HTTP specs with the regressions-only runner; retain prior native proof because this candidate changes test artifacts only. No full CI.
2. Run node deploy/uat/ss16-correction-browser.mjs in a pinned installed workspace with real Chromium. This is a component test using synthetic transport, not native browser or retained user acceptance. Expected M6_SS16_BROWSER_COMPONENT_PASS.
3. Independent Codex review on exact then-current head (not this packet's predecessor as an approval target). Report each finding with file/line, severity, reproduction, exact head, required fix and focused regression. Report no-finding areas explicitly. No self approval; do not invoke full CI automatically.
4. Batch verified fixes, run focused changed-scope evidence; authenticated Store/PM browser end-to-end proof and retained read-only configuration evidence still required. Only then follow #384 full CI and integration authorization, populated preservation and Owner acceptance as applicable.

## Review exit criteria

- No unaddressed reachable bypass or cross-Company/Project disclosure.
- Independently verified maker/checker, source/decision reciprocity, reason/history, no duplicate or unauthorized stock movement, transactional rollback and controlled lifecycle preservation.
- Real authenticated UI journey distinct from synthetic component test; legacy HTTP regressions preserved.
- No claimed formal closure until required evidence and independent review are complete.

No estimated-hour credit for this handoff or unexecuted browser test.
