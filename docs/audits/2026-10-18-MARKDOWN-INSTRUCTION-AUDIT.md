# Markdown instruction audit — 2026-10-18

**Purpose:** Record what was checked and correct misleading current-status labels without another audit framework.
**Audit-start main:** `7e668d08e4e563280e08b57bb96f50885585c82d`. **Authority:** `docs/PROJECT-GOVERNANCE.md`, DEC-016/022/028/029 and `docs/CURRENT-STATE.md`.

## Coverage and limitation

- Temporary prototype inventory: **152 Markdown files**, at commit `f8ae448f4ba5b36aff5251c5eeef70e4fed86fc8`; [CI #4736](https://github.com/threeswordz/cinder-grind/actions/runs/39141422061) passed.
- **Corrected physical lines: 28,872.** The prototype's **29,019** count was newline-split records, including **147 extra empty trailing records**, not physical lines. The inventory was mechanical, not a semantic line-by-line inspection.
- The prototype flagged 17 status leads: 11 historical snapshots, 3 proposals and 3 genuine V1.1-E/E2 pending statuses. No active contradiction was confirmed from these 17; separate misleading current-status labels were found manually.
- **No claim of exhaustive Codex review:** automated inventory cannot establish complete policy consistency, authority conflicts or factual accuracy. The prototype scanner/CI implementation was withdrawn.

## Narrow corrections in PR #242

- `docs/API-ARCHITECTURE.md` and `docs/ROLES-PERMISSIONS.md`: identify dated V1.0 summaries as historical and refer to live `CURRENT-STATE.md`.
- `docs/DEPENDENCY-LICENSE-REGISTER.md`: point live phase to V1.1-E2; retain V1.0 historical evidence.
- `docs/LIVE-POSITION-REPORTING-STANDARD.md`: distinguish V1.0 production-readiness milestone from active V1.1 successor while preserving the full V0.1–V0.8 roadmap and individual V0.6-A–E stages.

## Avoid duplicated work and preserve gates

Owner-approved DEC-029 is implemented **only** through [PR #243](https://github.com/threeswordz/cinder-grind/pull/243), merged `b8b12d944512db97efa1d81595aac49c5e88b248` with post-main CI #4748 PASS. Do not add a second scanner, standing policy or review gate here. Historical approvals remain intact.

This PR is documentation-only. It still requires its applicable PR and post-merge CI; V1.1-E2 local readiness, real-browser eight-persona UAT and owner AC-V11-029/030 remain **NOT COMPLETED**. See [Issue #233](https://github.com/threeswordz/cinder-grind/issues/233).
