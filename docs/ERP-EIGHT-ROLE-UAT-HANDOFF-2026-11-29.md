# Consolidated eight-role UAT — frozen prototype handoff

Status: PREPARED, NOT EXECUTED. Frozen source d517b88c9eff001fd829599eb638214896164f0f, actual verified app 3e35105edac7151aeca800c1175af736a99f6009; [M8 freeze](https://github.com/threeswordz/cinder-grind/blob/ad0b1f36956c254438a85c6af709f11732abcb54/docs/M8-FINAL-TECHNICAL-AUDIT-2026-11-29.md). No active running instance assumed. DEC-042 permits comprehensive human UAT after freeze; actual human results only. Use isolated synthetic representative records in a separately authorized environment, not the sealed recovery targets, retained MKE/TCJ data or Production. Confirm launch/access setup and named actor assignments before sessions; no grant activation in this preparation.

## Role register
| Role | Deferred frozen-scope IDs | Future full-scope IDs | Focus |
|---|---:|---:|---|
| Ben | 10 | 2 | Approval, progress, closure, management |
| Nancy | 5 | 7 | Client BOQ, authorized approvals/HR and stock schedule |
| Khaimook | 14 | 4 | Internal BOQ, PR, receiving, site material/stock/subcontract |
| Jai | 14 | 1 | Purchasing, supplier lifecycle, operational assets |
| Store Site | 17 | 4 | Receipt, issue, return, transfer, physical count |
| Foreman | 5 | 1 | Reports, progress, issues, requests |
| Porn | 3 | 17 | Existing authorized subcontract/BOQ/HR read boundaries |
| Koh | 2 | 6 | Employee/private HR records |
| Total | 70 | 42 | 112 stable IDs |

[112-ID execution worksheet](./ERP-112-UAT-EXECUTION-2026-11-29.csv). Each row retains exact requirement title, prior evidence/limitations, phase, candidate journey set and blank actual outcome fields. Candidate journey sets are role-level routing, not a claim of case-level test completeness. Before each session review the actual role source and select the relevant journey/step and precise expected result per ID. Future 42 remain not available for acceptance on this frozen scope, and six Owner boundaries/two proposed configuration exits are explicitly limited. No completed human acceptance inferred.

## Cross-role journeys (synthetic, human-led)
| Case | Participants | Scenario / expected behavior |
|---|---|---|
| UAT-01 | Ben, Nancy, Khaimook, Jai, Porn | Cost BOQ preparation/approval and client BOQ separate approval; authorized cost read and client confidentiality; maker/checker, no self-approval, foreign Project denial. Use approved latest scope, do not activate grants to force a pass. |
| UAT-02 | Store, Khaimook, Jai, Ben | PR create/review, RFQ and supplier selection, PO approval/revision; cancel or hold using approved lifecycle; distinguish no substitute Ben approval and new policy exclusions. |
| UAT-03 | Jai, Store, Khaimook | Early delivery temporary custody, 48-hour link expectation, independent check, approved GR and available stock; damaged exclusion, partial receipt, UOM conversion, supplier replacement and canonical document history. |
| UAT-04 | Store, Khaimook, Foreman, Nancy | Within-plan issue and signed receipt, beyond-plan controlled approval, return, same-Company dispatch/receipt and physical count schedule/approval; no double posting; stock reconciliation and restricted cost access. |
| UAT-05 | Foreman, Khaimook, Store, Ben | Daily/weekly reports, approved weighted progress, issue/follow-up/escalation, signed closeout and scoped access; preserve historical versions. |
| UAT-06 | Ben, Khaimook, Porn | Agreement/work order, independent physical acceptance, held/accepted certification evidence and approved variation/closure readback; no new accounting or payable settlement. |
| UAT-07 | Koh, Nancy, Porn | Employee/private documents/history, authorized category access, deny unauthorized actor/Company, revoke access; salary/HR privacy. No later payroll or bank payment. |
| UAT-08 | All | Negative Company/Project/actor permissions, English/Thai/Traditional Chinese, browser usability and audit history; review prior recovery evidence rather than replay native M7. |

Record per-ID expected vs observed, actual actor, Company/Project alias, release, timestamp, severity and evidence reference. Do not place credentials, salary, identity documents or real personal data in GitHub. Fail or BLOCKED on absent fixture/configuration/authority; no invented pass. Route future requirements to successor work packages; no user acceptance of missing modules. Severity P1 data/security/financial corruption or workflow blocker; P2 material incorrect behavior; P3 minor usability (proposed triage, not waiver). Repair actual defects only, with focused checks and required reviewed release gate on changed source. Actual business sign-off from accountable humans and Owner; GL04/GL10 separate, no Production.

## Start dependency
Provide a safe isolated UAT copy and actual actor assignment plan, then schedule the eight roles. Existing frozen source/receipts remain untouched. No startup, deployment, real role grant or human testing performed by this preparation.
