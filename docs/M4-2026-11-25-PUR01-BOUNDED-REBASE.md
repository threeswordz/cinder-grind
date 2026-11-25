# PUR01 bounded replay — 25 Nov 2026

Exact PUR04 parent f9b4feadf1b0641621a489082c2ca2224df789cd; original #415 delta 2e4ea1f7eda3e3a6ca6952926153ca3be10a1619..1b06cd9881400af5dcb6046dddb6575da019108d. Nine nonoverlap source paths copied as exact prior blobs (base equality verified); PO service merged with newer PM02 demand/Project/supplier checks first, PUR01 whole-PO check before submit and within final approval. Final comparison audit from #442 carried forward; PUR12 sequence allocation deliberately separate. PM02 native fixture retains later actual supplier deactivation rollback and SQL lineage denial; adds explicit known commercial values and unknown-basis negative.

Not yet built or tested. No schema admission change, full CI, grants, Production or independent approval. Later audit-specific tests and other legacy procurement fixtures must be checked on this exact branch.
