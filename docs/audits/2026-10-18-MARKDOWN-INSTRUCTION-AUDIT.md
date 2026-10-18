# Repository-wide Markdown instruction consistency audit

**Status:** INITIAL MECHANICAL COVERAGE VERIFIED; targeted status-drift corrections staged; final exact-head CI and independent full-scope Codex semantic review PENDING.  
**Owner authorization:** Product / Business Owner explicitly requested an intentional, exhaustive Codex audit rather than relying on PR-only review.  
**Initial authoritative source:** `main` commit `7e668d08e4e563280e08b57bb96f50885585c82d`, 2026-10-18 SGT.  
**Initial inventory:** 151 tracked Markdown files. The audit PR adds this report, so CI checks the entire candidate checkout, not just that initial inventory.

## 1. Why this exists

PR #241 introduced PStack-inspired engineering-quality guidance and invited Codex to inspect all 151 Markdown files. The resulting Codex PR review identified three P2 findings, all corrected and subsequently verified. It did **not** provide file-by-file evidence of an exhaustive semantic review. A passing PR review cannot be restated as proof that every Markdown document was read and reconciled.

## 2. Audit method and reproducibility

The existing GitHub validation workflow runs `node scripts/audit-markdown-instructions.mjs --full` on the **exact candidate commit** and records a complete tracked-Markdown manifest, SHA256 digest per file, physical line count, inline relative-link check, instructions detected outside fenced code blocks, repeated-current-instruction candidates, and status/authority triage leads. The full JSON manifest is preserved in the Actions job log; the Actions step summary supplies total coverage and an inventory digest. A synthetic-repository test checks that the scanner includes every tracked Markdown file and line and catches a broken relative link. No additional runtime, service, package, or third-party GitHub Action is introduced.

**Mechanical coverage is NOT semantic sign-off.** A regex scan cannot determine whether two clauses genuinely conflict, whether repeated descriptions create duplicate work, or whether a historical claim is properly qualified.

## 3. Authority and source classification

Read and reconcile active instructions in descending authority:

1. `docs/PROJECT-GOVERNANCE.md` / hard constraints.
2. `docs/DECISION-LOG.md` (approved decisions, including DEC-008, DEC-016, DEC-022, DEC-028).
3. `docs/REQUIREMENTS.md`; approved release scope and acceptance criteria.
4. `docs/DEVELOPMENT-ROADMAP.md`, active GitHub stage Issue, `docs/CURRENT-STATE.md`, and current PR/CI for implementation status.
5. `AGENTS.md`, operating model, technical and testing runbooks, stage evidence, examples, drafts and archived checkpoints in their applicable scope.

A lower-authority document cannot silently redefine a business rule, review gate, approval authority, release status, or cost constraint. However, an old dated checkpoint is not a contradiction merely because the project subsequently advanced.

## 4. Semantic review checklist — Codex independent investigation

Inspect **every Markdown file in the audit manifest**, not only the PR diff. Per file, record at least the path, reviewed revision (or inventory digest), disposition (`CURRENT_AUTHORITY`, `CURRENT_SUPPORTING`, `HISTORICAL`, `PROPOSAL/DEFERRED`, `TEMPLATE`), and whether it contains an actionable conflict, work duplication, stale active claim, broken critical navigation link, or no finding. Provide a coverage subtotal for each category; the subtotals must add to the manifest count.

Cross-document questions to verify with exact path/line citations:

- Are current release/gate declarations compatible with DEC-027, DEC-028, V1.1-E2 Issue #233 and the active current-state baseline? Does any file incorrectly self-approve human UAT?
- Are PStack-inspired advice, Chat/Work responsibilities, the single-writer rule, Codex review economy and irreversible-action permissions mutually compatible?
- Do authorization, SYS_ADMIN, project scope, payment/finance, migration, security, role inheritance, no impersonation, and no mandatory paid dependency rules agree?
- Are multiple documents giving different instructions for the *same* action, or simply pointing to one canonical rule?
- Are obsolete proposals and historical evidence being mistaken for active accepted scope?
- Do repeated CI/review/UAT tasks arise from two independently authoritative checklists, rather than legitimate layered tests?

**Reporting:** Each confirmed conflict must identify both instructions, the higher governing authority, severity, impact and minimum correction. Report clean files too; never imply complete coverage just because Codex found no additional findings. Record uninspected files explicitly. The reviewer should avoid unnecessary edits and costly repeat passes.

## 5. Known evidence and review leads

| Item | Disposition | Evidence |
| --- | --- | --- |
| Three prior Codex P2s involving `AGENTS.md` authority wording and `docs/V1.0-SCOPE.md` stale exit status | **CLOSED**, not new work | PR #241 clean exact-head review, merge `7e668d0`, post-main CI #4735 |
| `docs/LIVE-POSITION-REPORTING-STANDARD.md` contains an example of the old V1.0 entry position and a former “current roadmap destination” description | **TRIAGE:** historical illustrative example vs stale active statement | Read sections 4 and 7 against current V1.1; preserve required full-roadmap format |
| `docs/V1.1-E2-UAT-EXECUTION.md` and Issue #233 require actual local eight-persona/three-journey UAT and human owner AC-V11-029/030 | **AUTHORITATIVE OPEN GATE** | Do not mark accepted from GitHub CI, mockups, or Codex |
| Prior release descriptions, proposals and dated UAT evidence repeat status details | **NOT AUTOMATICALLY DUPLICATE WORK** | Preserve immutable historical checkpoints; fix only unqualified *active* contradictions |

## 6. Exit criteria

- [ ] Candidate GitHub CI mechanically inventories **100%** of tracked Markdown files and lines, with SHA256 file manifest and clean scanner self-test.
- [ ] All machine-generated critical candidates are triaged, with accepted limitations and false positives recorded.
- [ ] Codex independent review provides a usable *file-level or equally auditable scope attestation* that reconciles to the inventory; missing coverage is explicitly disclosed.
- [ ] Genuine instruction conflicts/duplicate implementation obligations are fixed in the proper owner docs, or escalated through explicit Change Control if they alter approved policy.
- [ ] Final stable head passes applicable exact-head/PR CI and required Codex review, with material findings resolved.
- [ ] After merge, exact-main CI and audit closure evidence are recorded.

**Boundary:** This is a documentation/governance audit, not V1.1 UAT acceptance, scope expansion, Production deployment or authority to rewrite executed migrations. Issue #233 remains the V1.1 release-exit source of truth.

## 7. First mechanical evidence and triage (candidate `f8ae448f4ba5b36aff5251c5eeef70e4fed86fc8`)

- GitHub PR validation **#4736 SUCCESS**, including the scanner self-test and full workspace/regression checks: https://github.com/threeswordz/cinder-grind/actions/runs/39141422061.
- Initial audit checkout: `f8ae448f4ba5b36aff5251c5eeef70e4fed86fc8`.
- **152/152 tracked Markdown documents**, **29,019 physical lines** and **2,796 potential directive lines** scanned. Inventory digest SHA256: `0682f3f4276f1ed8753ff43700844609090f6febe815ffd8e1bd9c4616d85305`.
- 17 status heuristic leads manually classified: **11 explicitly historical preflight snapshots**, **3 clearly marked unapproved V1.1 proposal drafts**, and **3 truthful outstanding V1.1-E/E2 UAT or technical-evidence statuses**. None of these 17 alone is an active normative contradiction. There were no missing relative inline links and no exact repeated-current-instruction matches under the scanner's narrow normalization rules.
- The scanner did **not** detect the stale V1.0 “current” labels in several shared technical documents. This is a known limitation of automated heuristics and is why full semantic reconciliation remains required.

**Targeted factual corrections already staged on this audit branch:** `docs/LIVE-POSITION-REPORTING-STANDARD.md` now labels the dated V1.0 entry progress block as an *illustration* and acknowledges approved V1.1 as the active successor without changing the user-required full-roadmap format. `docs/DEPENDENCY-LICENSE-REGISTER.md` now directs readers to the canonical live current state and correctly identifies V1.1-E2 as active. `docs/API-ARCHITECTURE.md` and `docs/ROLES-PERMISSIONS.md` label their detailed 2026-10-13 V1.0 banners as historical rather than claiming they are the latest release position. All underlying technical and release history remains intact.

**Caveats:** These results were measured on the earlier `f8ae448f` head; the current amended head must receive its own exact-head CI and fresh inventory digest. The complete **semantic 152-file Codex coverage attestation has not yet been received**; do not treat the 152-file mechanical inventory as proof of semantic review.
