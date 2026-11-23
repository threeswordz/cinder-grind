# M4 PUR01 — next coherent supplier-quotation threshold source increment

Owner-confirmed rule (Jai PUR01): up to THB 10,000 require 1 supplier; above 10,000 and up to 50,000 require 2; above 50,000 require 3. Compute whole-PO net amount after discount and plus freight/other charges, excluding VAT. A reasoned exceptional supplier decision requires Ben's independent review.

This branch is an **unrun, unreviewed pure source/test preparation** on top of [Draft PUR04 #413](https://github.com/threeswordz/cinder-grind/pull/413). Pure functions cover decimal boundaries, UNKNOWN commercial fields and comparable quote completeness across all PO RFQ lines. The subsequent staged commit connects them to the PO submit and independent approval transactions, including an append-only supplier-count audit and maker-entered exception reason. The new combined source remains **UNRUN/UNREVIEWED**, and PUR01 is not accepted. No full CI, Mac/browser replay, production, main merge, retained grants or role changes. Next implement the transaction guard, immutable exception record, controlled UI and one focused Postgres actor proof. Prior native PM02 and Chrome receipts remain closed and must not be replayed.

## Current source-provenance correction

New THB-only supplier quotation creation now explicitly persists `currencyCode: 'THB'`, matching the accepted V1.2 monetary policy and PUR01's quote-source query. Previously created quotation rows with NULL currency remain **unknown**, unmodified and **do not qualify** for new PO compliance without a separately reviewed provenance correction. A PM02 native regression assertion checks new THB capture and explicit NULL header rejection; these new assertions remain UNRUN until the bounded exact-head proof.
