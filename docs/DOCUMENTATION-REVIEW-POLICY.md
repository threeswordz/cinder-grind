# Risk-based Markdown documentation review

**Status:** APPROVED — Product / Business Owner, 2026-10-18 (DEC-029)  
**Applies to:** Every Markdown file in this repository; count is dynamic (151 at the approval checkpoint).  
**Authority:** `docs/PROJECT-GOVERNANCE.md` > approved `docs/DECISION-LOG.md` > the existing approved requirements/release documents. This page supplements but never supersedes that authority order.

## Purpose

Keep documentation accurate without spending independent Codex review on every historical file. An automated scan provides **inventory and mechanical checks**, **not** semantic verification or comprehensive document review.

## Review tiers

| Tier | Typical scope | Review approach |
| --- | --- | --- |
| P0 — critical | `AGENTS.md`, project governance, Decision Log, development operating model, current state and live-position standard | Substantively inspect when changed, when implicated by a finding or before material policy/release decisions; reconcile with live GitHub and authority order |
| P1 — active / cross-cutting | Active release (currently V1.1) scope, AC, BR, workflow/permission/UI/API/security/testing/role mappings and stage evidence | Focused change-impact review against approved requirements, code, API and tests; use Codex for genuine material/high-risk gates under DEC-022 |
| P2 — historical | Approved and accepted V0.1–V1.0 releases and their historical test/UAT/closure evidence | Preserve as historical checkpoints; inspect references and flagged discrepancies without rewriting accurate point-in-time statements |
| Other | README, operations, deployment, templates, remaining markdown | Review touched files and escalation findings by impact; raise tier if a file controls current production/security or release decisions |

These tiers guide reviewer attention; **they do not downgrade an authoritative source or relax any mandatory gate**. The auditor must raise any high-impact file to P0/P1 regardless of filename.

## All-file automated pass (every PR / main run)

Run:

```sh
node tools/audit-markdown.mjs
```

The dependency-free script walks all repository Markdown files, prints actual inventory/tier totals and reports candidate broken *inline local relative links*. It ignores common generated/vendor directories and external URLs. The repository CI calls it in **advisory mode**; findings are visible without imposing a newly invented gate on old documentation. To investigate locally with a non-zero exit for candidate broken links, run `node tools/audit-markdown.mjs --strict`.

**Limitations:** this is not a full Markdown parser. It does not establish accuracy of source requirements, business-rule consistency, release status, changed-file relevance, heading/anchor validity, reference-style link completeness, or actual runtime behavior. Apparent broken links may require review, not blanket mechanical replacement. Never represent the mechanical scan as a 151-file substantive review.

## Risk-triggered substantive review

1. Refresh live GitHub state before material changes; identify active release/stage/PR and approved authority.
2. Examine **changed files + their direct dependencies**; check P0 baseline and any P1 active specification implicated by the change.
3. Flag suspected contradictions by source path, quoted clauses, governing decision, severity and recommended disposition. Separate historical `as-of` statements from erroneous current-state claims.
4. Escalate high-risk code or permission/Finance/migration/audit/concurrency/data-integrity changes for required stable-candidate Codex review under DEC-022. A low-risk docs-only PR normally uses Chat + CI; do not request repeated Codex passes on unchanged historical material.
5. For broad periodic architecture, security, cross-release or production readiness audits, Work remains independent auditor under DEC-016; findings become durable Issues/Change Control candidates.
6. Correct only confirmed defects in the authorized scope. Preserve original historical evidence; add dated annotations/errata when needed instead of silently rewriting past acceptance.
7. Run exact-head PR / post-merge main CI and existing review gates. Product / Business Owner retains all mandatory UAT, scope and release decisions.

## Minimum audit report

- **Coverage:** actual Markdown files enumerated; scanned vs substantively reviewed counts; changed / high-risk documents and known blind spots.
- **Findings:** path and line, observed inconsistency, governing source, severity, action/owner, disposition (`fixed`, `accepted historical`, `tracked`, or `unverified`).
- **Gates:** CI head/status, required review evidence or explicit approved waiver; human UAT status stated separately.
- **Next action:** only the smallest governance-valid follow-up.

A finding is **not** release-blocking by default merely because an advisory link check reports it. Escalation to a mandatory gate requires an already-approved control or explicit Change Control. DEC-029 does not change V1.1-E2's local UAT prerequisites or authorize V1.1 release acceptance.
