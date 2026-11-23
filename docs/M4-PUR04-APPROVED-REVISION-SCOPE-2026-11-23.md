# PUR04 approved PO revision and Company/Project denial — new isolated PostgreSQL evidence

Development-only test `apps/api/src/procurement/purchase-order.pur04-revision.integration.spec.ts`, built atop successful PUR01 real UI Draft #420.

Proves with real disposable PostgreSQL 17.11 and application PurchaseOrderService: an original independent Ben-approved THB single-supplier PO with delivery/payment/discount/freight/VAT fields can produce a real revision, copying all nullable commercial terms, PO line award and Purchase Request provenance, original Company/Project/supplier/poNumber and revision linkage. The revision must start Draft with no automatic approval.

Two denied outsiders: separate Company user sees PO not found and same Company employee assigned only to a different Project is forbidden. These attempts must leave the PO revision count unchanged. Previously approved PO cannot be edited, the new Draft may change without rewriting historic commercial snapshot, the same approved original cannot create a duplicate next revision, and a cross-Project employee cannot edit the new Draft. Exactly one CREATE_REVISION audit is asserted.

Test setup uses real Store PR, Khaimook PR approval, Jai RFQ/THB quotation/award/PO and Ben PO approval. This is fixture setup only, not a replay of previously successful PUR01 quote count or PUR01 actual Chrome.

No new product code, schema or permissions. New test is **UNEXECUTED** until a distinct focused one-shot run. Other passing CI/browser/Mac suites remain closed. Disposable actors are NOT actual retained named MKE/TCJ assignments; actual human UAT, DEC-022 independent release review, Owner acceptance, final CI and Production remain unauthorized/unverified.

Before successful focused run, official prototype 4/8, GL3/10, M4 technical 20/32, accepted hours 0/1900. This new proof contributes partial D evidence to M4-05, not full acceptance.
