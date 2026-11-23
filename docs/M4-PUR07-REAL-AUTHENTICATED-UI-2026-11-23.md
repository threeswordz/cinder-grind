# PUR07 — authenticated Jai/Ben browser PDF and reported send (new evidence only)

Source: deploy/uat/m4-pur07-jai-ben-browser-native.mjs, staged atop PUR07 draft PR #418. This test is **not executed** until a scoped exact-commit workflow is confirmed successful.

Scope uses a new disposable PostgreSQL 17.11 database with real NestJS, Vite/React/MUI, Chrome/CDP, and real synthetic Jira? NO: synthetic Jia/Jai and Ben identities with true HttpOnly browser sessions. No production data. The older successful standalone Thai PDF #45162334613 and native PUR07 evidence #45155841629 must NOT be rerun.

1. Seed a real source-backed approved THB PO with Thai legal supplier, Thai description, explicit satang financial inputs, independent Ben approval; no mocked browser API.
2. Jai views approved PO via actual React screen and clicks automated PDF Download. Existing ASCII-only server MUST return HTTP422/visible Thai Unicode fail-closed, never silently omit names. THIS DOES NOT FIX AUTOMATED SERVER UNICODE PDF.
3. Jai clicks actual Print/Save as PDF; CDP captures the newly opened real document, prints a real A4 PDF, pdftotext verifies searchable Thai supplier and exact 2000.00/137.90/2107.90 totals; source re-read is required.
4. Jai enters synthetic reported external email thread via actual form. Persistent DB must record exact one immutable `REPORTED` dispatch with no fabricated email sent/PDF hash.
5. Ben independently logs in and may view the report and Thai print option, but does NOT receive Jai-only recording controls. Inventory and Finance remain unchanged.

Still OUTSTANDING after synthetic proof: fully automatic Unicode-safe *server* PDF generation/download with licensed fonts, real named retained MKE/TCJ actor grant admission, human visual pagination/UAT, real third-party actual email/LINE send evidence, independent final DEC-022 review and Owner authorized final full release CI. No external send, no protected main merge, no Production. PUR07 M4-06 last D remains open, technical aggregate M4 20/32, 0/1900 hours credited.
