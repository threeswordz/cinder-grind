-- Forward-only PUR01: preserve all existing PO header/history and add only
-- maker-entered exceptional supplier comparison reason; NULL = no exception.
ALTER TABLE "purchase_orders"
  ADD COLUMN "supplier_quote_exception_reason" VARCHAR(2000);
