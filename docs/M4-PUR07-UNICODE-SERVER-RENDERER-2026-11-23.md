# PUR07 — Thai/Unicode approved PO automated backend PDF candidate

**Draft source, not released.** Base: PUR07 #418; new implementation adds no npm PDF dependencies. It reuses the existing approved-only source/Company/Project guard, supplier legal snapshot and approved-order PDF filename.

New path: `apps/api/src/procurement/purchase-order-unicode-pdf.ts`. Existing deterministic ASCII PDF is preserved for compatible documents. On unsupported Unicode characters, the service renders a real PDF using a **local** sandboxed Chromium process on `about:blank` with in-memory escaped HTML and a restrictive CSP; no file URL or external asset fetch. It retains the original contract: exact approved PO/version, downloadable bytes, SHA256, supplier shortName filename and persisted long-form legal supplier name.

Deployment prerequisites: Chromium or Google Chrome executable and a legally installed distributable Thai font (e.g. OS Noto Sans Thai) on the **protected host**, fontconfig for Linux, non-root sandboxed Chrome process, bounded workload and audit/review of local process permissions. The implementation deliberately never carries or shares font files with users. Production-host readiness and font embedding/license signoff are **not** evidenced by tests on GitHub runners. CI may use `--no-sandbox` only when GITHUB_ACTIONS=true and M4_NON_PRODUCTION_CONFIRMED=YES; non-CI root execution fails closed.

Fails closed with `PO_PDF_UNICODE_RENDERER_UNAVAILABLE` when local renderer cannot produce the full PDF. No silent Latin substitutions, fabricated zero totals, or implied third-party email/LINE transmission. External dispatch still requires actual Jai-reported thread and optional scoped Project Document evidence; ERP does not send email or LINE.

Only **new focused test** `apps/api/src/procurement/purchase-order-unicode-pdf.spec.ts`: (1) deny unsafe HTML, bidi and missing lines; (2) create new server actual Thai-Chromium PDF, check `%PDF-`, searchable Thai via pdftotext, exact figures and A4 page count; (3) call the existing `approvedPdf` service on a synthetic approved immutable PO snapshot and verify actual PDF bytes, filename and sha256. Service contract stub is NOT a new PostgreSQL proof of authorization; prior #45155841629 real PG source/role/dispatch proof and #45162334613 standalone Thai Chrome PDF are preserved without repeats.

**Still required after focused test:** host font and sandbox review, actual retained Jai/Ben MKE/TCJ roles and human UAT, independent DEC-022 exact-head review, consolidated release and specific Owner authorization #384 for final mandatory full CI; no protected main merge, no Production authorization and no claims a real email was sent.

Canonical counters are not updated by source creation: M4-06 3/4, total 20/32, prototype 4/8, GL 3/10, 0/1900 accepted planning hours retired; productive hours unmeasured.
