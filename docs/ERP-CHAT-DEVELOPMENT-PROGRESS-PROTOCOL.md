# Mandatory progress handoff after EVERY Construction ERP Chat development action

**Owner decision: 24 November 2026, deadline 31 December 2026, full 112-requirement and eight-real-role Production ERP.** No smaller pilot substituted. The aim is to report remaining work falling toward **0h**, without conflating evidence, actual time, formal acceptance and optimistic planning targets.

**Canonical index:** [GitHub issue #414](https://github.com/threeswordz/cinder-grind/issues/414).  
**Live numerical state:** [ERP-ACTIVE-REMAINING-HOURS.json](ERP-ACTIVE-REMAINING-HOURS.json) (60 original packages, immutable 1,847h current forecast start + append-only evidence-linked events).  
**Readable view:** [ERP-ACTIVE-PROGRESS.md](ERP-ACTIVE-PROGRESS.md).  
**Validator / dashboard renderer:** `node tools/erp-progress-report.mjs --write` when checked out. This is read-only validation plus writing the local Markdown output; it does not launch a GitHub workflow or alter Production.

## Execution rule

At the end of **every authorized Chat implementation or development handoff**, the executing Chat should:
1. **Read GitHub live source**, the updated branch SHA, #414 and this rolling ledger. Verify what is genuinely newly built, integrated or proven (and identify prior passing evidence to reuse). Do not assume commit count or CI runtime equals productive hours.
2. Assign the change to **one or more specific work package IDs** from the 60 existing rows, or an explicit **unpriced scope gap** if the work is not covered. Do not consume M4-08 integration hours to hide unrelated PUR08/PUR14 implementation.
3. Provide a fresh *remaining work estimate* for each affected package: **old remaining → revised remaining**. A 20-hour task should become 15, 8, 3, then **0h only with accepted final exit** when evidence supports those estimates. The size of an estimate reduction is a reviewed planning judgment about how much verified remaining work was eliminated, **not hours spent by Chat**. If no quantitative evidence is yet available, record a source/proof event with **0 hours credited**; do not invent velocity.
4. Record new work using an append-only event in `ERP-ACTIVE-REMAINING-HOURS.json`, retaining original `baselineRemainingHours` unchanged. Each event must include a unique ID, date, package ID, **beforeHours**, **afterHours**, difference, exact source SHA/evidence URLs, rationale, blocker, and whether formal acceptance actually occurred. Defects/scope discovery can make afterHours greater than beforeHours (negative reduction). A zero requires independent or human Owner acceptance evidence as dictated by the package.
5. **Recalculate all 12 stages and 60 package balances**, regenerate the dashboard using the existing dependency-free script if a checkout exists, validate 1847h initial census and the arithmetic/event chain. Never double-count the earlier 53h reduction from historical 1900 to provisional 1847; do not adopt 1500h optimization target as achieved work.
6. **Publish a #414 development/progress comment in the same Chat session** with package old→new, stage old→new, full ERP old→new, exact SHA, tests/evidence and remaining dependencies. Show the updated 0h countdown in the user-facing answer.
7. Continue authorized source work until a real access/Owner/independent-review gate, rather than ask for progress-only confirmation. Do not grant retained permissions, self-approve, trigger redundant full CI, alter protected main or deploy Production in order to move the graph.

## Multi-Chat coordination

Each Chat may commit only to its isolated branch and may post an evidence handoff comment to #414. **Only one designated Release Coordinator updates the shared active JSON and dashboard** to avoid simultaneous stale writes; every update must first refetch the current blob SHA and rebuild state from current GitHub. If another Chat cannot directly update the shared ledger, it MUST post its evidence/hours proposal to #414 and clearly say **"progress reconciliation pending"** rather than claiming an uncommitted overall total.

This is a GitHub collaboration protocol, **not automatic cross-conversation synchronization or a background job**. Chat sessions that have not read #414 do not become aware automatically. For other Chat development sessions, explicitly include this instruction in the task or ensure they read issue #414 before handoff.

## Required progress comment template

```text
ERP DEVELOPMENT PROGRESS EVENT — <date SGT>
Work package: <e.g. M4-01>
Source branch + exact commit SHA: <...>
Implemented and verified: <bounded functionality>
Focused evidence: <run URL / source URL / review URL>
Package forecast remaining: <old>h -> <new>h (delta <n>h)
Stage forecast remaining: <old>h -> <new>h
Full-ERP forecast remaining: <old>h -> <new>h (goal 0h)
Actual logged worker hours: UNKNOWN (unless measured)
Formal acceptance: NO / YES (with independent/Owner evidence URL)
Outstanding to reach 0h: <exact tasks, blockers, Owner/reviewer gates>
No credit for duplicate tests; no Production authorization inferred.
```

## Current initialized state and warnings

- 23 Nov provisional 60-package starting forecast: **1,847h**.
- Evidence-backed **provisional 2h remaining-work estimate reduction** for M4-01's current 112-ID candidate triage: **32h → 30h**. This is not an actual two-hour worker log, not an accepted package and may be revised after source/defect review.
- Initial active rolling forecast: **1,845h**. This is a working estimate, not a validated complete delivery forecast.
- The 24 Nov PUR08/PUR14 pure source transition contract is recorded as code progress but **unpriced** for persistence/API/MUI and true supplier/GR flow, so **0h credited** for that source step. It is not yet a working authenticated ERP feature.
- 1,500h remains an unvalidated stretch optimization target; no 347h automatically credited.
- Full zero will require **all 60 package exits, prototype 8/8, GL 10/10, no unpriced mandatory gaps, independent review and actual authorized full Production use**. The 31 December deadline remains RED with no additional software engineers.

**Governance:** Preserve DEC-008/022/042/053/054 and exact Company/Project rights; full CI, Ready, protected-main merge, retained-user grants and Production remain Owner/independent gates.
