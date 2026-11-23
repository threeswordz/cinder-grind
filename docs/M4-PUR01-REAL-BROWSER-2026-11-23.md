# M4 PUR01 — real Jai/Ben browser proof (candidate only)

Status: test-only source is staged. No Chrome PASS, named retained-user UAT, full CI, merge, or Production is claimed.

Source: deploy/uat/m4-pur01-browser-native.mjs; based only on PUR01 Draft #415.

New distinct browser journeys to prove:
1. Disposable genuine PR > RFQ > THB quotation > approved supplier award > one-supplier PO above THB 50k. Real authenticated Jai clicks MUI Submit without a reason; HTTP 422 and no approval state plus actual UI error are mandatory.
2. Jai enters exact sole-supplier exception, PUR04 delivery and payment fields through MUI inputs and clicks Save PO Header; PostgreSQL verifies persisted fields.
3. Jai clicks actual Submit for Approval after the reason; independent Ben MANAGEMENT identity clicks actual Approve, one approval action and final APPROVED readback; Jai cannot see the Approve action; no stock/Finance posting.
4. Only disposable localhost PG17.11 exact database erp_m4_pur01_actual_chrome, ephemeral files and local-only Chrome, real Nest/React app, no mock HTTP responses.

Do not repeat passed native PUR01 #45142678279, passed PM02 Chrome #45147124712, the other successful suites, Mac or full CI.

Do not promote synthetic UI PASS to actual MKE/TCJ retained Jai/Ben grant/role acceptance. M4-04 last checkpoint D remains open absent named actor and independent release review. M4 stays 20/32 technical and hours 0/1900 accepted. Owner #384 retains explicit authority for final mandatory full release CI. No Production or protected main change.
