## Scope / Requirements

- Stage / Release:
- Requirement IDs:
- Acceptance Criteria:
- Related Issue:

## Architecture / Governance Check

- [ ] I reviewed `AGENTS.md` and `docs/PROJECT-GOVERNANCE.md`.
- [ ] Change is within the current approved release/stage scope.
- [ ] No unapproved business rule was introduced.
- [ ] No mandatory paid dependency, cloud service or recurring subscription was introduced without explicit approval.
- [ ] Open-source-first / zero-cost-first constraints are preserved.
- [ ] Modular-monolith and PostgreSQL/Prisma decisions are preserved.
- [ ] Project → WBS → Activity architecture is preserved.
- [ ] WBS and Cost Code remain independent dimensions.
- [ ] Project-scope authorization and System Administrator separation are preserved.
- [ ] Decision Log was reviewed and no approved decision is silently overridden.
- [ ] Future-release scope was not pulled forward without approval.

## Security / Data

- [ ] Backend authorization remains enforced.
- [ ] Company and Project isolation are preserved where applicable.
- [ ] Audit/security controls remain intact.
- [ ] Migrations/data integrity changes are source-controlled and tested where applicable.
- [ ] Secrets, credentials and physical server paths are not committed/exposed.

## Validation

- [ ] Applicable unit/integration/security/regression tests pass.
- [ ] CI is green on the exact merge head.
- [ ] Documentation / `CURRENT-STATE.md` is current before merge.
- [ ] Required human UAT/business approval has not been self-approved by development/automation.

## Change-control note

If any box cannot be checked because an approved project rule must change, do not merge under the existing decision. Record explicit Product / Business Owner approval and update the Decision Log/scope first.
