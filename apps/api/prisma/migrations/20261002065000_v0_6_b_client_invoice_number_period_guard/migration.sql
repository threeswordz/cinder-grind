-- V0.6-B Codex hardening: keep the immutable CIYYMM number aligned with invoice_date.

CREATE OR REPLACE FUNCTION erp_client_invoice_number_period_guard()
RETURNS trigger AS $$
BEGIN
  IF NEW."client_invoice_number" !~ '^CI[0-9]{4}-[0-9]+$'
    OR substring(NEW."client_invoice_number" FROM 3 FOR 4) <> to_char(NEW."invoice_date", 'YYMM')
  THEN
    RAISE EXCEPTION 'CLIENT_INVOICE_NUMBER_PERIOD_MISMATCH';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "client_invoice_number_period_guard"
BEFORE INSERT OR UPDATE OF "client_invoice_number","invoice_date" ON "client_invoices"
FOR EACH ROW EXECUTE FUNCTION erp_client_invoice_number_period_guard();
