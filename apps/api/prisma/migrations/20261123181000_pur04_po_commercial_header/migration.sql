-- PUR04: additive, forward-only single-Project PO commercial/delivery draft fields.
-- Historical approved revisions and financial/stock data are never rewritten.
-- NULL on older POs means UNKNOWN, not zero or an accepted commercial quote basis.
ALTER TABLE "purchase_orders"
  ADD COLUMN "delivery_location" VARCHAR(500),
  ADD COLUMN "delivery_contact" VARCHAR(200),
  ADD COLUMN "delivery_terms" TEXT,
  ADD COLUMN "payment_terms" TEXT,
  ADD COLUMN "credit_terms" TEXT,
  ADD COLUMN "discount_amount" DECIMAL(18,2),
  ADD COLUMN "freight_amount" DECIMAL(18,2),
  ADD COLUMN "additional_charge_amount" DECIMAL(18,2),
  ADD COLUMN "vat_rate_percent" DECIMAL(5,2);

ALTER TABLE "purchase_orders"
  ADD CONSTRAINT "purchase_orders_commercial_nonnegative"
  CHECK (
    (discount_amount IS NULL OR discount_amount >= 0)
    AND (freight_amount IS NULL OR freight_amount >= 0)
    AND (additional_charge_amount IS NULL OR additional_charge_amount >= 0)
    AND (vat_rate_percent IS NULL OR (vat_rate_percent >= 0 AND vat_rate_percent <= 100))
  );
