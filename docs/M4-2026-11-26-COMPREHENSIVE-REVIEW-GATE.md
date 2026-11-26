# M4 comprehensive independent review and single full-CI release gate

Owner-approved 26 Nov 2026 SGT. This is a review plan, **not a completed independent review or authorization to run full CI**. No change to DEC-008/022/053 or issue #384. Preserve 112 requirement IDs, 70 bounded / 42 future, six approved boundaries, eight roles, non-Production-only release.

## Exact inventory
Protected base `040395bc7b0dedd40207f91f743bc2efc1584622`. Draft PR455 `024b30c3d03bba3a3ecb513ef59a4099b9ab2cf2`. Isolated proposed batch `2468adefd0f6a8a14c981a7386dd9b0d91d1b53c`, 137 commits ahead/0 behind; 238 changed files: API 93 (29 service/controller files), schema/migrations 10, web 32, deployment/validation 89, CI 1, documentation 12, other 1. GitHub compare patch content incomplete for many web/deployment/docs paths. Inspect actual exact-head blobs, not only compare excerpts. Workflow-only child 6fd69b9f is NOT application source.

## Review batch and independent coverage
| Lane | Mandatory risk review | Builder evidence status |
|---|---|---|
| A | Live Company/Project, active employee/session, role revocation, read/write authorization, alternate document aliases, protected BOQ/Finance/HR disclosure | Targeted document-family scan performed, PUR07/PUR14 confirmed P2s; PM09/SS13 use canonical full-link checks; not an exhaustive security audit |
| B | PUR01/04/07/10/12/14 purchasing and supplier lifecycle: source binding, immutable audit, stale revision, receiving and cancellation concurrency, no unauthorized stock/AP effects; renderer/escaping | Existing exact targeted receipts plus new batch queued; independent whole-lane review outstanding |
| C | PM/Store/Foreman/Ben/Nancy, asset and stock-count, urgent issue, loss case, closeout and approval separation; negative role/UI/API checks and no postings | Independent whole-lane review outstanding |
| D | Schema, forward migrations, populated predecessor recovery, historical row/document preservation, failure and rollback, CI admission/reuse and actual logs | Independent whole-lane review outstanding; earlier full receipts historical only |
| E | Web/API contract, protected views, document readback, approved PDF/manual communications, runtime and evidence integrity, 112-row scope mapping | Independent whole-lane review outstanding; no inferred acceptance |

Request DEC-022 independent Codex review of complete exact base-to-candidate diff, not just most recent commit; explicitly ask for all findings in one pass, risk-lane coverage and unreviewed areas. Do not infer full coverage from generic clean response. Keep all threads open until independently reconciled, and batch confirmed defects before promoting next candidate. If review capacity/coverage unavailable record blocker, don't fabricate independent signoff or launch full.

## Release order
1. Validate isolated batch on actual disposable PostgreSQL and narrow unit specs; run45822516895. Inspect exact SHA, real results and terminal proof.
2. Guarded nonforced forward update of Draft455 after focused pass; one comprehensive independent request on exact head. Reconcile all findings; focused-only validation for corrections. No redundant full triggers.
3. After stable complete review and focused evidence, seek exact Owner authorization for ONE failed-jobs rerun of draft admission run while PR remains Draft. Confirm no duplicate. Full success and identity before latest Ready is required by DEC-053.
4. Separately authorized Ready once, verify fresh genuine bot review, no later conflicts, all threads resolved. If new finding, batch it with any other findings and do not reuse previous full proof on changed source. Verify eligible exact tree/source/base before asking for guarded squash authorization.
5. Verify main integration reuse receipt, separately authorize Mac non-Production upgrade/retained readback, preserve data and reconcile actual bounded rows. Close only with appropriate acceptance; no Production. No arbitrary hour credits; forecast estimates are not elapsed hours.
