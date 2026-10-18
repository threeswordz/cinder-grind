# Markdown consistency audit — 2026-10-18

**Status:** FINDINGS & TARGETED FACTUAL CORRECTIONS STAGED; final CI/Codex and policy reconciliation pending.  
**Owner request:** Do not mistake a generic Codex PR review for verified coverage of all 151 Markdown files.  
**Live source at audit start:** `main` `7e668d08e4e563280e08b57bb96f50885585c82d`.  
**Authority:** `docs/PROJECT-GOVERNANCE.md`, approved Decision Log (including DEC-008, DEC-016, DEC-022, DEC-028 and newly approved DEC-029), active scope/AC and `docs/CURRENT-STATE.md`.

## 1. Avoid a second auditing system

The designated writer delivered [PR #243](https://github.com/threeswordz/cinder-grind/pull/243), the canonical lean DEC-029 inventory in `tools/audit-markdown.mjs` and the existing CI. PR #243 squash-merged as `b8b12d944512db97efa1d81595aac49c5e88b248`, and exact-main post-merge CI **#4748 SUCCESS**. This audit report **does not introduce another scanner, approval gate, mandatory policy page, AI provider, dependency or implementation owner**. The overlapping scanner/tests/CI step originally prototyped in draft PR #242 were withdrawn with forward commits. Only distinct factual documentation reconciliation remains here.

**DEC-029 conflict corrected:** PR #243 initially included a separate `docs/DOCUMENTATION-REVIEW-POLICY.md`, contrary to the DEC-029 text that expressly forbade adding another policy file. [The independent finding](https://github.com/threeswordz/cinder-grind/pull/243#issuecomment-6251908747) was reported to the designated writer; the final merged PR changed only Decision Log DEC-029, its one scanner and one advisory CI step. The fence-indentation Codex P2 was resolved in that PR. Neither event establishes an all-file Codex semantic attestation.

## 2. What was actually verified

Before overlap was discovered, an independent **prototype** dependency-free scanner was run through exact-head GitHub CI on draft PR #242. That former candidate included the original 151 Markdown files plus this audit report.

| Evidence | Result |
| --- | --- |
| Exact prototype checkout | `f8ae448f4ba5b36aff5251c5eeef70e4fed86fc8` |
| CI | [#4736 SUCCESS](https://github.com/threeswordz/cinder-grind/actions/runs/39141422061) |
| Tracked Markdown inventory | **152/152** files, with per-file SHA256 values in CI logs |
| Physical lines enumerated | **29,019** |
| Potential directive lines counted | **2,796** |
| Inventory digest SHA256 | `0682f3f4276f1ed8753ff43700844609090f6febe815ffd8e1bd9c4616d85305` |
| Status heuristic candidates | **17** |
| Missing relative inline links / normalized repeated-current directives | **0 detected by prototype** |

The 17 status leads were manually classified as **11 explicitly historical preflight snapshots**, **3 unapproved/draft proposals**, and **3 legitimate V1.1-E/E2 not-yet-complete evidence statuses**. None of these 17 constitutes a confirmed active contradiction. Separately detected stale current-status labels were **not** flagged by the prototype; this is evidence that automated line counting is not a semantic audit.

**Limitations:** The prototype parser did not establish correct Markdown fence semantics or independently inspect all 29,019 lines for meaning; it has now been withdrawn in favor of the single DEC-029-approved scanner. The immutable CI evidence establishes the file/line **inventory** of that exact checkout only. It does not establish exhaustive Codex file-by-file semantic review or guarantee the absence of further conflicts.

## 3. Confirmed targeted documentation corrections staged in PR #242

- **`docs/LIVE-POSITION-REPORTING-STANDARD.md`**: labels the old V1.0 entry chart as a historical illustration, points current position to live source-controlled evidence, and acknowledges the V1.1 successor. The approved full-roadmap, V0.6-A–E and status-vocabulary requirements are preserved.
- **`docs/DEPENDENCY-LICENSE-REGISTER.md`**: updates its live phase pointer to V1.1-E2 and marks the prior lengthy V1.0 delivery statement as a dated historical checkpoint.
- **`docs/API-ARCHITECTURE.md` and `docs/ROLES-PERMISSIONS.md`**: mark repeated 2026-10-13 V1.0 delivery banners explicitly historical and point readers to `docs/CURRENT-STATE.md` for the current position.

These are **factual status/label corrections only**. No original requirement, business policy, source API, permission, finance transaction, test result, or historical acceptance was deleted or changed.

## 4. Independent semantic review boundary and next gate

The approved DEC-029 approach uses one all-file **mechanical inventory**, then risk-based substantive review of changed/current/high-authority/implicated Markdown, with Work as periodic broad auditor under DEC-016 and required stable-head Codex gates under DEC-022. This audit's original request for exhaustive Codex coverage remains separately stated, but neither an ordinary PR review nor the mechanical scan should be presented as proof of 152/152 semantic review.

Before marking this audit report closed, verify the factual current-status corrections against higher-authority files and obtain the applicable exact-head CI/Codex review of these changed documents; report each remaining conflict with exact path/line/owner and disposition. If a reviewer did **not** inspect every file, say so explicitly. Preserve dated historical evidence. Do not create duplicate work or a second documentation policy.

## 5. Release boundary

The V1.1-E2 gate is unchanged. Local readiness and genuine eight-persona/three-journey browser UAT, AC-V11-029 Product Owner human UAT and AC-V11-030 release acceptance remain OPEN in Issue #233. CI or Codex cannot self-approve them. This audit creates no new release, deployment, paid dependency or owner acceptance.
