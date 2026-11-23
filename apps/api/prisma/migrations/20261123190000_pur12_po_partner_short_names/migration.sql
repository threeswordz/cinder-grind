-- PUR12/DEC-049 forward-only. No UPDATE/backfill to existing partner/PO records.
-- NULL means historical/unknown, not an inferred supplier code or short name.
ALTER TABLE "customers" ADD COLUMN "short_name" VARCHAR(100);
ALTER TABLE "suppliers" ADD COLUMN "short_name" VARCHAR(100);
ALTER TABLE "purchase_orders" ADD COLUMN "po_display_number" VARCHAR(240);
ALTER TABLE "purchase_orders" ADD COLUMN "supplier_short_name_snapshot" VARCHAR(100);

ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "po_pur12_display_snapshot_paired"
  CHECK (
    ("po_display_number" IS NULL AND "supplier_short_name_snapshot" IS NULL)
    OR
    ("po_display_number" IS NOT NULL AND "supplier_short_name_snapshot" IS NOT NULL)
  );
