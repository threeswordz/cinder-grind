# HR1-A — approved employee/employment and privacy entry contract

**Owner scope/identity/HR-only Company access/private-data matrix APPROVED, 29 October 2026 SGT**, [actual receipt](https://github.com/threeswordz/cinder-grind/issues/283#issuecomment-6495792364), DEC-039. This publication is the entry gate: runtime/schema/permission implementation begins only after its normal CI/review/merge/exact-main gates pass. It is not completed software, retained activation, business acceptance or Production authorization. Parent [#283](https://github.com/threeswordz/cinder-grind/issues/283) records actual publication and implementation receipts; one implementation writer only. Unrelated draft #279 remains untouched.

## Approved authority and predecessor

The Owner stated: “I approve the HR1-A scope, identity model, HR-only Company access and private-data matrix proposed in Issue #283, and authorize governed entry and implementation after the required entry gates.” This adopts the exact [proposal](https://github.com/threeswordz/cinder-grind/issues/283#issuecomment-6495672957), not the whole future HR programme. V1.3 is [COMPLETE + ACCEPTED](https://github.com/threeswordz/cinder-grind/issues/266#issuecomment-6495647534); source main eb9fb0c35cbe4b335caa71374e5d7ee1998cb6f7 / CI40866079211 SUCCESS31/31. No repeated BOQ/THB Owner UAT is required.

The [complete Thai HR requirements](HR-PAYROLL-REQUIREMENTS-TH-2026-10-27.md), version4, SHA256102d8023e8e8cbe65fd3ee6cb0e99cfd314f2307ba19ff1ed386b1a0786da0cf, remain unchanged. Source sections1–3/12/18/20 trace this slice. Preserve all100 answers, subsequent corrections and settled later-stage wage visibility; do not repeat the interview or invent statutory values.

## Deliverable and exclusions

Deliver a usable Company-scoped employee register, auditable employment history and protected personal/bank/supporting-document records, with operational salary-free views and reusable role UAT. Reuse canonical Employee/User/Project identity; workers need no ERP login. No second employee/time/Finance ledger.

Excluded: attendance/half-month submission (HR1-B/C), leave/OT, salary amounts and rate approval, payroll/statutory calculations, transfers/bank/accountant files, Nancy-as-HR self-approval exception, labour expense/cost allocation and Production rollout. Hiring approval stays with Ben for office staff and Khaimook for site workers; this slice captures a verified approval reference after hiring, not recruitment or a new approval bypass. All later requirements remain preserved, not cancelled.

## Identity and persisted ownership

- Existing Employee Company/ID/code and all User/Project/transaction relationships remain unchanged. For rehire/Company transfer create a new Company-owned Employee/code and employment episode; never move/relabel a referenced historical row. Codes remain Company-unique/configurable; no mandatory format is invented.
- Operational employment facts: employment type (monthly/daily metadata only), start/end/status, job/site references, verified hiring approval reference and reasoned correction provenance. Use explicit effective dates; do not manufacture prior employment coverage or infer individual worked time from DPR headcounts.
- An opaque protected person link may connect verified episodes after explicit authorized HR verification. No name-based automatic merge, exposed national-ID lookup, global person search or implicit rights from linking. Linking records from different Companies requires explicit identity/write scope for both targets within the transaction. Existing history is not overwritten.
- Private identity/contact/bank/attachment metadata belongs in separately protected HR records, not newly added public Employee scalar fields. Generic Employee/admin/Project-member DTOs must remain non-sensitive. Encrypt sensitive stored values and versioned correction payloads; general AuditLog stores pointers, actor/category/reason/version metadata, never raw private values.
- Minimum forward-only relational additions must enforce Company/Employee consistency with scoped foreign keys/constraints. Preserve Company+employeeCode uniqueness; narrowly block historical Company/code rewriting only once HR references exist, without changing legacy unreferenced Employee edit semantics.

## Approved private-data matrix

No authorization uses literal personal names. Map these business functions to explicit persisted capabilities and target-Company/category entitlements; permission definitions never create live grants.

| Function | Operational employee/employment | Identity/private supporting documents | Bank details |
|---|---|---|---|
| Koh HR | Record/correct with reasons, authorized Companies | Record/view | Record/correct |
| Nancy | Read, authorized Companies | Read | Read |
| Ben | Read, authorized HR scope | No full access in this slice | No full access in this slice |
| Porn | Minimal authorized accounting fields | No full access | Read, explicit target Company/category scope |
| Khaimook / Store Site / Foreman | Whitelisted fields, existing authorized Project scope | Denied | Denied |
| Technical administrator | Technical account administration | No implicit business read | No implicit business read |

The separately confirmed Koh/Nancy/Ben/Porn wage visibility for MKE/TCJ remains a later compensation/payroll requirement. Site views show no wages, bank/identity numbers, private documents or sensitive free text.

## Target-Company access and action contract

The current session's Company and fixed login roles do not change. Every HR request names its actual target Company or derives it from an already-authorized Project. For HR-only cross-Company reads/writes, require **both** current persisted action capability and an explicit persisted target-Company/data-category entitlement, rechecked inside transactional mutations. Choosing an authorized HR Company context is not a role switch, impersonation or broad Company access. It grants no Finance/BOQ/Project approval authority and does not change projects.access_all.

Separate employment basic, identity, bank and private-document categories; distinct view/manage capabilities, plus Project-operational view. Proposed technical identifiers: hr.employment.view/manage, hr.identity.view/manage, hr.bank.view/manage, hr.documents.view/manage, hr.operational.view. A separately bounded technical administration capability manages explicit target-owned HR entitlements, without revealing private business data or allowing self-escalation. An administrator cannot grant authority for an unrelated Company merely from SYS_ADMIN; Company owner/scoping, subject validity and audit must be enforced. Real retained grants/activation require their own explicit reviewed configuration plan.

Field projections are explicit allowlists. Mask sensitive values by default; any authorized full-value read must be explicit, scoped and auditable without copying private values into logs/audit. Private reads/downloads use no-store; lists/search/direct IDs/errors must not reveal record existence or other-Company private data. Additive role unions cannot bypass category/Company/Project boundaries.

## Canonical Documents, encryption and threat model

Use canonical Document identity/storage/audit and correct Company ownership. Private HR associations are not generic Project permission. Every generic/direct download/link/metadata/archive/target route must deny inappropriate HR-private access, including mixed or forged source links. Prefer dedicated HR routes for authorized decryption and masked metadata; do not expose unencrypted bytes or private original filenames through generic paths.

Use reviewed open-source/zero-cost runtime cryptography, authenticated encryption with unique nonces and authenticated Company/employee/category/version binding. Keys are externally supplied, versioned and validated, never committed or logged; no insecure default key. Private access fails closed when a required key is absent/invalid. Retain old key IDs for authorized historical decrypt/rotation and document backup/key custody. Wrong keys, ciphertext tampering or cross-scope substitution yield safe errors, not plaintext or cryptographic diagnostics.

The implementation threat model must cover actual file custody: no unencrypted sensitive document bytes in canonical storage, upload temp paths, errors or ordinary export, and no plaintext private history/audit. Maintain existing file size/type/storage-containment protections, cleanup/rollback and paired recovery semantics. Do not weaken the general upload policy merely to support ciphertext. No paid key vault/storage service is introduced.

## API, concurrency and UI contract

Register a dedicated HR module using existing AuthGuard/CSRF/PermissionGuard conventions. Validate unknown fields, UUIDs and dates; raw private values never appear in error detail or general access logs. Actions use database-derived Company/Employee relations and expected versions. Create/rehire/transfer/correction/link operations need durable request replay: identical key/body returns the same outcome, changed body conflicts; concurrent corrections cannot replace one another silently. Histories remain queryable and reasoned; no delete/overwrite of referenced historical facts. No HR1-A code writes Payment, DirectCostPosting, Budget/BOQ, stock, Payroll or DPR manpower.

Provide employee/employment screens, authorized HR Company selection, safe operational projections, reasoned history/private edit/reveal/download UX and English/Thai/Traditional Chinese labels. Capabilities determine screens/actions; role labels and UI hiding are not security boundaries. Clear decrypted data and cached results on identity/permission/Company context changes. No private bulk export in this slice.

## Acceptance / automation contract

| ID | Observable proof |
|---|---|
| HRA-AC-001 | Canonical Employee/User/Project/history references persist; rehire/transfer gets a new scoped code/record; no silent historical move/rename. |
| HRA-AC-002 | Fixed-session HR-only target-Company/category entitlements plus persisted capabilities govern every route; wrong/inactive/revoked/self-escalation cases deny. |
| HRA-AC-003 | Full approved function matrix, additive role unions and Project-operational projections pass positive/negative HTTP tests; SYS_ADMIN grants no business reads. |
| HRA-AC-004 | Identity/bank/document data, private names and payloads never leak through existing generic Employee/admin/Project/Document, search/error/audit/export/cache paths. |
| HRA-AC-005 | Private fields/history/files are encrypted at rest; scoped authenticated encryption, absent/wrong/retired keys and tamper/substitution negatives fail safely. |
| HRA-AC-006 | Canonical HR-private attachment metadata/bytes enforce category/Company authority; size/type/containment/rollback/cleanup and generic alias negatives pass. |
| HRA-AC-007 | Reasoned append-only correction/history and verified person links preserve prior facts; no guessed matching or fabricated opening history. |
| HRA-AC-008 | Replay/same-body, changed-body and concurrent writes produce one correct durable outcome; conflicts do not lose history or create duplicate people/episodes/files. |
| HRA-AC-009 | Existing unreferenced Employee edits still work; referenced-code/Company changes reject; existing non-HR consumers and new read projections stay compatible. |
| HRA-AC-010 | No attendance/payroll/Finance/stock/BOQ/DPR postings or business approval side effects; excluded policies are not guessed. |
| HRA-AC-011 | Real browser employee/private-history/context/cache behavior and EN/TH/zh-TW safe presentation are exercised; simulated dialog/printing is labelled honestly. |
| HRA-AC-012 | Minimum forward-only schema, strict separately bounded HR upgrade/recovery contract, actual previous-release preservation and protected nonempty file/key custody proof; existing THB/BOQ rehearsal modes remain strict. |
| HRA-AC-013 | Registered disposable tests, exact-head push/PR CI, stable-candidate independent review for privacy/auth/schema, governed merge and exact-main CI; no unchanged-code repeat Codex calls. |
| HRA-AC-014 | Consolidated evidence with explicit retained fixture/runtime limits and separate Owner HR business acceptance/rollout decisions; technical tests never self-approve. |

Add tests to the actual existing package/CI commands as implementation lands. Run full mutation/negative/concurrency scenarios on disposable synthetic CI data, not retained business records. Build a reusable explicit-target role UAT runner alongside implementation: secure one-time setup, real verified aliases/Company/Project identities, fail-closed runtime/DB/build binding, minimal read-only checks, no automatic grants/fixtures/approval actions, exact PASS/FAIL/BLOCKED/NOT_APPLICABLE/ALREADY_ACCEPTED provenance and one consolidated report. Preserve previously accepted results; absence of optional fixtures is not a failed execution. Where a real business-write UAT case becomes necessary, stop that case pending separately authorized disposable execution rather than silently creating business data.

## Entry and implementation sequencing

Normal entry publication CI/merge/exact-main gate precedes runtime/schema work. After it passes, this approval already authorizes the single writer to implement HR1-A without asking for the same scope again. Apply existing DEC-022 stable-candidate review and normal integration gates; actual retained activation and Owner business acceptance remain separate. HR1-B/C and later HR2/3 remain out of this entry. Production deployment remains NOT AUTHORIZED.
