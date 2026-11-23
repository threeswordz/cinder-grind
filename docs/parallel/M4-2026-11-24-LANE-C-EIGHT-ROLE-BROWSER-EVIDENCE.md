# M4 Lane C — eight-role authenticated browser evidence (24 November 2026)

**Status:** SOURCE PREPARED; new live disposable browser proof **BLOCKED_CONFIGURATION**; retained MKE/TCJ user acceptance **BLOCKED_AUTHORIZATION**. Not formal M4 acceptance.

## Source and branch scope

- Issue: https://github.com/threeswordz/cinder-grind/issues/428, assigned Lane C.
- Exact verified starting branch HEAD and integrated Draft PR #427 source: 680bca5767652522ef08f72d4df97b6df2732fca.
- Branch: test-m4-eight-role-journeys-20261124. Changes are restricted to new unique UAT/evidence files. No edits to central 112-ID CSV, application modules, migrations, master grants, main, PR #427 or Production.
- Canonical acceptance matrix: docs/M4-2026-11-24-EIGHT-ROLE-UAT-AND-EXIT.md. DEC-054's **Cost BOQ-only audited Ben self-approval** supersedes the previous Cost BOQ checker direction; Client BOQ remains Ben maker / Nancy independent approver.

## New operator source and guarded execution

Files:
- deploy/uat/m4-eight-role-journeys-20261124.mjs
- deploy/uat/m4-eight-role-journeys-20261124.test.mjs
- docs/parallel/M4-2026-11-24-LANE-C-EIGHT-ROLE-BROWSER-EVIDENCE.md

The operator reuses the existing actual Chromium CDP transport, React/MUI LoginScreen, RoleWorkspaceShell/AdminConsole, session/cookie and real NestJS API, **not mocked API responses**. It never creates users, changes Roles/permissions, restores/resets data, posts business operations or enables Production. An interception boundary rejects outbound browser requests and business writes; only local GET/HEAD/OPTIONS and login/logout POST are permitted.

After an **independently established disposable** PostgreSQL 17.11 + API + Vite fixture is available, it attempts one real browser context for each of the eight roles: Login UI; auth/me identity, Company, exact role codes and relevant permission; visible authorized module; assigned Project; second Project in same Company; foreign Company/Project denial; HR/private denial; optional Client BOQ CSV (including authorized positive control), foreign/same-company document bytes, HR document bytes; real UI sign-out and invalidation of session. A separately seeded disabled synthetic account can be checked for real login denial.

Eight real roles must be distinct with no SYS_ADMIN substitute. Store Site, Foreman, Porn and Koh cannot silently receive projects.access_all for the scoped test. A role legitimately carrying projects.access_all may view other Projects within its own Company; Company membership alone is never treated as universal Project permission.

**Only disposable fixture allowed.** Its private 0600 JSON must be outside the repo and owned by the runner, with exactly eight distinct synthetic user credentials, actual required role codes, assigned and same-company-other and foreign Company/Project UUIDs, a source employee, and these exact identifiers: purpose M4_LANE_C_DISPOSABLE_SYNTHETIC_ONLY; sourceSha 680bca5767652522ef08f72d4df97b6df2732fca; databaseName erp_m4_lane_c_20261124; apiBase http://127.0.0.1:31375/api/v1; webOrigin http://127.0.0.1:44375. The name field alone does **not** attest the connected DB: verify actual running DB, storage and process identity separately before execution. This lane does not authorize connecting the original Mac or retained target even if localhost.

The preferred fixture includes **real seeded and independently confirmed** clientBoqVersionId, foreignDocumentId, otherProjectDocumentId and hrAttachmentId, plus a disabledActor synthetic login. Missing any yields PARTIAL_BLOCKED_FIXTURE, nonzero exit: a 404 on a nonexistent object is not adequate confidential-byte proof. Existence of foreign seeded documents additionally needs an independent authorized positive-control readback, since these eight Company A accounts cannot establish foreign Company B's object existence.

**Suggested commands, NOT run against any target by this Lane C session:**

~~~sh
node --check deploy/uat/m4-eight-role-journeys-20261124.mjs
node --test deploy/uat/m4-eight-role-journeys-20261124.test.mjs

# only after independent disposable runtime and artifact proof:
GITHUB_ACTIONS=true M4_LANE_C_DISPOSABLE_VERIFIED=YES \
  node deploy/uat/m4-eight-role-journeys-20261124.mjs \
  --disposable-readback /absolute/private/0600/disposable-lanec-fixture.json
~~~

Linux CI, actual Chromium, exact source/target and explicit disposable authority are required. Sanitized output excludes credentials, user IDs, Company/Project IDs, cookies, source record contents and protected downloaded bytes.

## Eight actual role journeys: remaining write/actions gate

| Role | Browser readback / module | Positive functional journey to execute separately with genuine actors | Denial / separation to witness |
|---|---|---|---|
| Nancy / FINANCE_MANAGER | BOQ & Budget | Ben Client BOQ/VO revision independently approved by Nancy; site count-category schedules | Maker self-approval, cross-scope confidential CSV/bytes, historical edits, unwanted Finance writes |
| Ben / MANAGEMENT | Purchase Orders | Jai PO & revision approval; audited Cost BOQ-only DEC-054 exception; PUR10 final | No blanket maker self-approval, no BEN01 delegate, cannot finalize PUR10 without Jai/Khaimook |
| Khaimook / PROJECT_MANAGER + STOREKEEPER | Inventory | Store PR review, Jai co-check/GR good-only approval, transfer and urgent issue | Quantity-only Cost BOQ, no Client monetary access, no before-GR stock usage |
| Jai / PROCUREMENT_OFFICER | Purchase Orders | PUR01 sourcing, PO amendment, independent receiving check, PUR10 initiation | No Ben final approval/self-check, no foreign Project/Company |
| Store Site / STOREKEEPER | Purchase Requests | PR maker, pre-PO temporary custody, SS02 material suggestion, issue/count | No PO approver, no unapproved stock or cross-Project access |
| Foreman / PROJECT_ENGINEER | Site Execution | Daily/weekly no-work, edit history, Ben acknowledgement | No PR maker, stock count approval, HR private or foreign scope |
| Porn / FINANCE_OFFICER | Finance | AP invoice and customer billing as maker, Nancy separate AP approval | No Nancy self-approval or Client BOQ confidential prices |
| Koh / UAT_HR_STAFF | HR / Employees | Employee master, permitted private HR categories | No Finance/Procurement authority; disabled account/session, other Company denial |

**Important coverage distinction:** The new operator provides a **read-only live browser/API boundary** once a disposable runner is supplied. It does **not** execute the positive mutating maker/checker lifecycle listed above, verify in-session Role deactivation, or replace any DEC-042 frozen human UAT. Those actions remain separately pending; logout revocation alone does not prove in-session Role revocation.

## Evidence and status discipline

Reuse source-bounded prior evidence without duplicate tests: receiving PR #347, transfer PR #352, stock count PR #300, DEC-054 BOQ PR #395; PUR10 run 45222979381; previous BOQ 11/11, SS14 8/8, SS02 11/11 and real PostgreSQL 1/1 (runs 45229748671, 45230927000). The integrated UAT manifest and Issue #428 explain each receipt's limits. None is a new Lane C browser PASS or authorizes target credentials.

New Lane C evidence: **9/9 focused fixture/policy assertions passed against exact committed source/test text under a V8 source-evaluation harness**: loopback/source/DB guard, eight distinct actor roles/IDs, non-SYS_ADMIN, cross-project model, protected CSV and download-denial plan, fake HTTP PASS prevention, optional seeded evidence and disabled-account input. **Not** a Node --test run, NestJS/API, actual Chromium, PostgreSQL, retained-user grant readback, human UAT, or 50-step CI receipt.

## Coordinator integration and blockers

1. Review only the three new files, exact new commit vs the verified 680bca57 integrated starting source, with no module/migration/role conflict. Do not merge changing branches blindly.
2. Get an independent disposable PostgreSQL 17.11 + API + Vite and Chromium runner with safe synthetic actual role accounts, distinct Company/Project memberships, seeded protected CSV/documents and source existence proof. Run syntax, focused Node tests and **one** new bounded live browser proof if justified; capture result and exact tested SHA. Never infer native/browser pass from the V8 assertions.
3. Record real maker/checker UI actions separately (Store→Khaimook, Jai→Ben, Jai→Khaimook→Ben PUR10, Ben→Nancy Client BOQ, Porn→Nancy AP), Company/Project negatives, protected API/CSV/attachment bytes, real disabled-role/session evidence and distinct event IDs. A fake/synthetic fixture is not retained-role acceptance.
4. Retained MKE/TCJ grants/identities or original Mac access, DEC-042 human UAT, DEC-022 independent signoff, #384 full mandatory release CI, Ready/main merge, M4 package acceptance and all Production changes remain **BLOCKED_AUTHORIZATION**, not silently granted.

**Official counters unchanged:** prototype 4/8, GL 3/10, M4 technical 20/32, accepted M4 packages 0/8, forecast hours formally retired 0/1,900. Branch commits/tests do not increment formal milestone/clock.
