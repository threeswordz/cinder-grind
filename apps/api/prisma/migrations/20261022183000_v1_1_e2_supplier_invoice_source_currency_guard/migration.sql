-- V1.1-E2: reject newly written Supplier Invoice source links with unknown
-- or mismatched PO denomination. Historical PO, GR, invoice and audit rows are
-- never updated or re-labelled; no FX or Company default policy is introduced.
-- This is additive to the existing scope/state/lineage and draft guards.
CREATE FUNCTION erp_supplier_invoice_item_currency_guard()
RETURNS trigger AS $$
DECLARE
  invoice_currency VARCHAR(3);
  linked_po_currency VARCHAR(3);
BEGIN
  SELECT "currency_code" INTO invoice_currency
  FROM "supplier_invoices"
  WHERE "id" = NEW."supplier_invoice_id";

  IF invoice_currency IS NULL THEN
    RAISE EXCEPTION 'SUPPLIER_INVOICE_SOURCE_CURRENCY_MISMATCH';
  END IF;

  IF NEW."purchase_order_line_id" IS NOT NULL THEN
    SELECT po."currency_code" INTO linked_po_currency
    FROM "purchase_order_lines" pol
    JOIN "purchase_orders" po ON po."id" = pol."purchase_order_id"
    WHERE pol."id" = NEW."purchase_order_line_id";

    IF linked_po_currency IS NULL OR linked_po_currency <> invoice_currency THEN
      RAISE EXCEPTION 'SUPPLIER_INVOICE_SOURCE_CURRENCY_MISMATCH';
    END IF;
  END IF;

  IF NEW."goods_receipt_item_id" IS NOT NULL THEN
    SELECT po."currency_code" INTO linked_po_currency
    FROM "goods_receipt_items" gri
    JOIN "purchase_order_lines" pol ON pol."id" = gri."purchase_order_line_id"
    JOIN "purchase_orders" po ON po."id" = pol."purchase_order_id"
    WHERE gri."id" = NEW."goods_receipt_item_id";

    IF linked_po_currency IS NULL OR linked_po_currency <> invoice_currency THEN
      RAISE EXCEPTION 'SUPPLIER_INVOICE_SOURCE_CURRENCY_MISMATCH';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "supplier_invoice_item_currency_guard"
BEFORE INSERT OR UPDATE ON "supplier_invoice_items"
FOR EACH ROW EXECUTE FUNCTION erp_supplier_invoice_item_currency_guard();
