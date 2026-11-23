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

-- A created PO identity is a historical document snapshot: never change it
-- through regular DML, even if the partner short name or Company code changes.
CREATE FUNCTION "pur12_po_identity_immutable"()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF OLD."po_display_number" IS DISTINCT FROM NEW."po_display_number"
     OR OLD."supplier_short_name_snapshot" IS DISTINCT FROM NEW."supplier_short_name_snapshot" THEN
    RAISE EXCEPTION 'PO_DOCUMENT_IDENTITY_IMMUTABLE' USING ERRCODE = '23514';
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER "trg_pur12_po_identity_immutable"
BEFORE UPDATE OF "po_display_number", "supplier_short_name_snapshot"
ON "purchase_orders"
FOR EACH ROW EXECUTE FUNCTION "pur12_po_identity_immutable"();
