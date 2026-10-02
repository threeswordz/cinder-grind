-- V0.6-B forward-only initial-state hardening: every persisted Client
-- Invoice must begin as a clean Draft. Workflow and decision history may only
-- be added through retained lifecycle transitions.

CREATE OR REPLACE FUNCTION erp_client_invoice_insert_guard()
RETURNS trigger AS $$
BEGIN
  IF NEW."state" IS DISTINCT FROM 'DRAFT'
    OR NEW."total_amount" IS DISTINCT FROM 0
    OR NEW."approval_instance_id" IS NOT NULL
    OR NEW."submitted_by_user_id" IS NOT NULL
    OR NEW."approved_by_user_id" IS NOT NULL
    OR NEW."rejected_by_user_id" IS NOT NULL
    OR NEW."submitted_at" IS NOT NULL
    OR NEW."decided_at" IS NOT NULL
    OR NEW."approved_at" IS NOT NULL
    OR NEW."rejected_at" IS NOT NULL
    OR NEW."rejection_reason" IS NOT NULL
  THEN
    RAISE EXCEPTION 'CLIENT_INVOICE_INITIAL_STATE_INVALID';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "client_invoice_insert_guard"
BEFORE INSERT ON "client_invoices"
FOR EACH ROW EXECUTE FUNCTION erp_client_invoice_insert_guard();
