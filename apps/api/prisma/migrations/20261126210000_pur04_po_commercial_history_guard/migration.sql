-- PUR04/PUR01: forward-only defence in depth. No historical migration or row rewrite.
-- Preserve the original history trigger; freeze the additive fields on the
-- submission statement itself and every subsequent UPDATE, including NULL changes.
CREATE FUNCTION protect_po_commercial_history_v1() RETURNS trigger AS $$
BEGIN
  IF (OLD."approval_instance_id" IS NOT NULL OR OLD."submitted_at" IS NOT NULL
      OR NEW."approval_instance_id" IS NOT NULL OR NEW."submitted_at" IS NOT NULL)
     AND ROW(NEW."delivery_location", NEW."delivery_contact", NEW."delivery_terms",
             NEW."payment_terms", NEW."credit_terms", NEW."discount_amount",
             NEW."freight_amount", NEW."additional_charge_amount", NEW."vat_rate_percent",
             NEW."supplier_quote_exception_reason")
         IS DISTINCT FROM
         ROW(OLD."delivery_location", OLD."delivery_contact", OLD."delivery_terms",
             OLD."payment_terms", OLD."credit_terms", OLD."discount_amount",
             OLD."freight_amount", OLD."additional_charge_amount", OLD."vat_rate_percent",
             OLD."supplier_quote_exception_reason") THEN
    RAISE EXCEPTION 'PO_COMMERCIAL_HISTORY_IMMUTABLE';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER purchase_orders_commercial_history_guard
BEFORE UPDATE ON "purchase_orders"
FOR EACH ROW EXECUTE FUNCTION protect_po_commercial_history_v1();
