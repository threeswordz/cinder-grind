-- V0.6-B forward-only approval hardening: a Client Invoice state transition
-- may only follow the matching retained Approval Instance and configured workflow.

CREATE OR REPLACE FUNCTION erp_client_invoice_approval_link_guard()
RETURNS trigger AS $$
DECLARE
  expected_state TEXT;
  instance_company_id UUID;
  instance_entity_type TEXT;
  instance_entity_id UUID;
  instance_state TEXT;
  workflow_company_id UUID;
  workflow_entity_type TEXT;
BEGIN
  IF OLD."state" = 'DRAFT' AND NEW."state" = 'SUBMITTED' THEN
    expected_state := 'SUBMITTED';
  ELSIF OLD."state" = 'SUBMITTED' AND NEW."state" = 'APPROVED' THEN
    expected_state := 'APPROVED';
  ELSIF OLD."state" = 'SUBMITTED' AND NEW."state" = 'REJECTED' THEN
    expected_state := 'REJECTED';
  ELSE
    RETURN NEW;
  END IF;

  SELECT
    ai."company_id",
    ai."entity_type",
    ai."entity_id",
    ai."approval_state",
    aw."company_id",
    aw."entity_type"
  INTO
    instance_company_id,
    instance_entity_type,
    instance_entity_id,
    instance_state,
    workflow_company_id,
    workflow_entity_type
  FROM "approval_instances" ai
  JOIN "approval_workflows" aw
    ON aw."id" = ai."approval_workflow_id"
  WHERE ai."id" = NEW."approval_instance_id";

  IF instance_company_id IS NULL
    OR instance_company_id IS DISTINCT FROM NEW."company_id"
    OR instance_entity_type IS DISTINCT FROM 'CLIENT_INVOICE'
    OR instance_entity_id IS DISTINCT FROM NEW."id"
    OR workflow_company_id IS DISTINCT FROM NEW."company_id"
    OR workflow_entity_type IS DISTINCT FROM 'CLIENT_INVOICE'
  THEN
    RAISE EXCEPTION 'CLIENT_INVOICE_APPROVAL_LINK_INVALID';
  END IF;

  IF instance_state IS DISTINCT FROM expected_state THEN
    RAISE EXCEPTION 'CLIENT_INVOICE_APPROVAL_STATE_MISMATCH';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "client_invoice_approval_link_guard"
BEFORE UPDATE OF "state","approval_instance_id" ON "client_invoices"
FOR EACH ROW EXECUTE FUNCTION erp_client_invoice_approval_link_guard();
