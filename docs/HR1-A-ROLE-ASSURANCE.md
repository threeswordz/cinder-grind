# HR1-A — reusable read-only role assurance (bounded implementation increment)

**Authority:** Owner-approved HR1-A #283 / DEC-039, HRA-AC-002–004/009–014. The Owner explicitly transferred exclusive implementation ownership to this Chat on 30 October 2026; actual receipt is on #283. Source base main `646b2877335097ee204d5ec0ccc043c2e1fce548` / exact-main CI41014768923 SUCCESS. This increment tests approved privacy/role boundaries only; it does not complete HR1-A.

## What is delivered

- `deploy/uat/hr1a-role-assurance.mjs`: read-only HTTP proof collector with a fixed HR route allowlist, fixed expected function matrix, exact bound synthetic/retained fixture IDs and a strict loopback-only target URL.
- `hr1a-role-assurance.test.mjs` and `hr1a-role-assurance-http.test.mjs`: registered negative tests for unsafe URL, invalid identities, absent fixtures, business method allowlist, unexpected private read, wrong actor identity, logout failure, safe report contents and no-acceptance claims.
- CI uses Node's existing standard library only; no added package, paid infrastructure, background process, Business/Finance write, role grant or migration.
- This is **not** a complete HR1-A user-facing feature. Protected canonical attachments, UI, locale/cache/browser assurance and full HR1-A evidence remain separate approved work.

## Approved function matrix used for read-only checks

| Function | Employment history | Masked identity | Masked bank | Project operational |
|---|---|---|---|---|
| KOH | allow | allow | allow | not evaluated |
| NANCY | allow | allow | allow | not evaluated |
| BEN | allow | deny | deny | not evaluated |
| PORN | not evaluated | deny | allow | not evaluated |
| KHAIMOOK, STORE_SITE, FOREMAN | deny | deny | deny | allow |
| JAI, SYS_ADMIN | deny | deny | deny | not evaluated |

PORN's narrow HR bank read is preserved, **not** Finance activation. This matrix records required confidentiality boundaries; a denied **positive** route is **BLOCKED_CONFIGURATION** until its existing role, Company/category entitlement and employee fixture are verified, not evidence that application code is broken. An unexpectedly successful **denied** route is a FAILURE. Non-applicable routes are not claimed as executed. No authorization bypass is inferred from UI role labels.

No private reveal, mutation, attachment download, grant, role edit or source document change is supported by the runner. Login and logout establish and revoke only temporary authentication sessions. It uses existing credentials; it does not create personas or backfill HR data. Wrong ID, wrong Company, invalid target, unexpected HTTP, absent private mask or unverified logout fail closed. No stored report contains source response data, names, credentials, cookie, CSRF, or masked value text.

## Private input format / evidence boundary (not a request for Owner to rerun UAT)

The operator may create a private **0600** JSON file OUTSIDE the Git working tree with:

```json
{
  "baseUrl": "http://127.0.0.1:3001/api/v1",
  "companyId": "11111111-1111-4111-8111-111111111111",
  "projectId": "22222222-2222-4222-8222-222222222222",
  "employeeId": "33333333-3333-4333-8333-333333333333",
  "expectedBuildSha": "646b2877335097ee204d5ec0ccc043c2e1fce548",
  "actors": {
    "KOH": {
      "email": "synthetic@example.invalid",
      "password": "synthetic-example-only",
      "userId": "44444444-4444-4444-8444-444444444444",
      "companyId": "11111111-1111-4111-8111-111111111111",
      "expectedRoleCodes": ["HR_TEST_ROLE"]
    }
  }
}
```

The input must bind each actor to its **exact expected persisted login role-code set**. If `/auth/me` differs, all HR probes for that actor stop and the result fails; this prevents relabeling an authorized identity as a different business persona. 

All IDs/identities above are **synthetic placeholders**, not verified users, records or authorization. Leave unconfigured functions absent; each is explicitly marked BLOCKED. `expectedBuildSha` is a **declaration only**; the existing API does not expose a trusted runtime build/DB identity. Therefore even all-positive reads produce `READ_ONLY_CHECKS_PASSED_ATTESTATION_PENDING`, never HR Owner acceptance. An independent verified deployment-to-commit and DB binding must accompany any retained evidence. No speculative release proof is recorded.

Commands for an authorized disposable operator, not repeated Owner commands:

```bash
node deploy/uat/hr1a-role-assurance.mjs --plan
HR1A_ROLE_INPUT=/private/approved-hr1a-fixture.json \
 HR1A_ROLE_OUTPUT_DIR=/private/erp-hr1a-evidence \
 node deploy/uat/hr1a-role-assurance.mjs --capture
```

The collector requires a strict localhost API URL (`127.0.0.1`, explicit port, exact `/api/v1`), private source file mode 0600 and evidence destination directory mode 0700 outside the repository. Reports are created exclusively with 0600 and random filenames. Passwords, cookies, raw payloads and private fields are never returned or written to reports. Redirects are rejected. Do not put fixture credentials into GitHub comments, PRs, CI, chat, logs or attachments. Do not run against Production or unapproved retained data.

## Honest evidence limits and next governed work

- This tooling checks *one explicitly identified employee and Project*, not all employees, whole-company grants or full access lists. Captured responses are sequential, not atomic.
- It cannot prove a real runtime/build/DB fingerprint. Results need a separately verified runtime binding; a declared commit is insufficient.
- It does not create data or validate actual UI/browser, document bytes, encryption, grant configuration, direct-link bypasses or paid hours.
- Its CI tests use synthetic HTTP mocks. No retained runtime execution or Owner human UAT is claimed.
- Later HRA-AC-014 consolidated evidence must distinguish `PASS`, `FAIL`, `BLOCKED`, `NOT_APPLICABLE`, `ALREADY_ACCEPTED` across technical, retained, business and recovery sources.

**Next active code after this bounded test increment:** canonical HR-private attachment encryption, storage and dedicated HR APIs, with full generic/direct/mixed-alias denials, cleanup/rollback, concurrency and nonempty restored file/key proof; then employment/private-history UI EN/TH/Traditional Chinese, cache lifecycle, real-browser tests and separate Owner HR acceptance. Follow stable-candidate independent review for all high-risk privacy/auth/schema/ledger changes, exact-head PR CI, normal merge and exact-main CI. No repeated BOQ/THB UAT, new Finance/attendance/payroll stage, or Production authorization.
