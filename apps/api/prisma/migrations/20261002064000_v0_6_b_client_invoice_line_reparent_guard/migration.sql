-- V0.6-B Codex hardening: prevent retained Client Invoice lines from being reparented.

CREATE OR REPLACE FUNCTION erp_client_invoice_item_draft_guard()
RETURNS trigger AS $$
DECLARE
  invoice_state TEXT;
  target_id UUID;
BEGIN
  IF TG_OP = 'UPDATE' AND (
       NEW."client_invoice_id" IS DISTINCT FROM OLD."client_invoice_id"
    OR NEW."company_id" IS DISTINCT FROM OLD."company_id"
    OR NEW."project_id" IS DISTINCT FROM OLD."project_id"
  ) THEN
    RAISE EXCEPTION 'CLIENT_INVOICE_HISTORY_IMMUTABLE';
  END IF;

  IF TG_OP = 'DELETE' THEN
    target_id := OLD."client_invoice_id";
  ELSE
    target_id := NEW."client_invoice_id";
  END IF;

  SELECT "state" INTO invoice_state
  FROM "client_invoices"
  WHERE "id" = target_id;

  IF invoice_state IS DISTINCT FROM 'DRAFT' THEN
    RAISE EXCEPTION 'CLIENT_INVOICE_HISTORY_IMMUTABLE';
  END IF;

  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;
