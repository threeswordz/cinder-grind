## Scope and evidence

- **Release / stage / issue:**
- **Requirement IDs / acceptance criteria** (or docs-only rationale):
- **What changed and what remains deferred:**
- **Tests / CI / review evidence:**

## Applicable governance checks

- [ ] Reviewed `AGENTS.md`, `docs/PROJECT-GOVERNANCE.md` and the approved Decision Log; no existing decision is silently overridden.
- [ ] Within the approved stage/scope; any business-rule, architecture, paid-dependency or governance change has explicit owner-approved Change Control.
- [ ] DEC-008 zero-cost/open-source-first and the approved modular-monolith, PostgreSQL/Prisma, Project → WBS → Activity and independent Cost Code architecture are preserved (or separately approved).
- [ ] Where impacted, backend Company/Project authorization, maker-checker, SYS_ADMIN business-authority separation, audit integrity and data isolation are verified.
- [ ] Secrets are not committed; any migrations are forward-only, with data-integrity checks appropriate to the change.
- [ ] Applicable exact-head CI and tests pass. Required DEC-022 independent review was completed (or its **execution** explicitly waived by the owner for this PR); all genuine review findings are **resolved**, never waived.
- [ ] Impacted source documents are updated; `docs/CURRENT-STATE.md` is updated **if the live status changed**, without duplicating dated status narratives elsewhere.
- [ ] Human UAT and business/release acceptance are recorded only with actual Product Owner evidence/approval; technical tests do not self-approve them.

**After merge:** verify required post-merge `main` CI before claiming stage/release closure or starting a gated successor. For untouched categories, explain “not applicable” instead of introducing imaginary work. Existing governance and release gates take precedence over this checklist.
