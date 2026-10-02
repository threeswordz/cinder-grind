-- V0.6-B review hardening: Company base currency and retained Client Invoice decision history.

CREATE OR REPLACE FUNCTION erp_client_invoice_base_currency_guard()
RETURNS trigger AS $$
DECLARE
  company_currency VARCHAR(3);
BEGIN
  SELECT "base_currency_code"
    INTO company_currency
  FROM "companies"
  WHERE "id" = NEW."company_id";

  IF company_currency IS NULL OR NEW."currency_code" IS DISTINCT FROM company_currency THEN
    RAISE EXCEPTION 'CLIENT_INVOICE_BASE_CURRENCY_REQUIRED';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "client_invoice_base_currency_guard"
BEFORE INSERT OR UPDATE OF "company_id","currency_code" ON "client_invoices"
FOR EACH ROW EXECUTE FUNCTION erp_client_invoice_base_currency_guard();

CREATE OR REPLACE FUNCTION erp_client_invoice_header_guard()
RETURNS trigger AS $$
DECLARE
  line_total DECIMAL(18,2);
  line_count INTEGER;
BEGIN
  IF NEW."client_invoice_number" IS DISTINCT FROM OLD."client_invoice_number"
    OR NEW."company_id" IS DISTINCT FROM OLD."company_id"
    OR NEW."project_id" IS DISTINCT FROM OLD."project_id"
    OR NEW."customer_id" IS DISTINCT FROM OLD."customer_id"
    OR NEW."currency_code" IS DISTINCT FROM OLD."currency_code"
    OR NEW."create_key" IS DISTINCT FROM OLD."create_key"
    OR NEW."create_payload_hash" IS DISTINCT FROM OLD."create_payload_hash"
    OR NEW."created_by_user_id" IS DISTINCT FROM OLD."created_by_user_id"
  THEN
    RAISE EXCEPTION 'CLIENT_INVOICE_HISTORY_IMMUTABLE';
  END IF;

  IF OLD."state" = 'DRAFT' THEN
    IF NEW."state" NOT IN ('DRAFT','SUBMITTED') THEN
      RAISE EXCEPTION 'CLIENT_INVOICE_STATE_TRANSITION_INVALID';
    END IF;

    IF NEW."state" = 'DRAFT' THEN
      IF NEW."approval_instance_id" IS DISTINCT FROM OLD."approval_instance_id"
        OR NEW."submitted_by_user_id" IS DISTINCT FROM OLD."submitted_by_user_id"
        OR NEW."approved_by_user_id" IS DISTINCT FROM OLD."approved_by_user_id"
        OR NEW."rejected_by_user_id" IS DISTINCT FROM OLD."rejected_by_user_id"
        OR NEW."submitted_at" IS DISTINCT FROM OLD."submitted_at"
        OR NEW."decided_at" IS DISTINCT FROM OLD."decided_at"
        OR NEW."approved_at" IS DISTINCT FROM OLD."approved_at"
        OR NEW."rejected_at" IS DISTINCT FROM OLD."rejected_at"
        OR NEW."rejection_reason" IS DISTINCT FROM OLD."rejection_reason"
      THEN
        RAISE EXCEPTION 'CLIENT_INVOICE_HISTORY_IMMUTABLE';
      END IF;
    ELSE
      SELECT COUNT(*), COALESCE(SUM("amount"),0)
        INTO line_count,line_total
      FROM "client_invoice_items"
      WHERE "client_invoice_id" = OLD."id";

      IF line_count = 0 OR line_total <> NEW."total_amount" THEN
        RAISE EXCEPTION 'CLIENT_INVOICE_TOTAL_MISMATCH';
      END IF;

      IF NEW."approval_instance_id" IS NULL
        OR NEW."submitted_by_user_id" IS NULL
        OR NEW."submitted_at" IS NULL
        OR NEW."approved_by_user_id" IS NOT NULL
        OR NEW."rejected_by_user_id" IS NOT NULL
        OR NEW."decided_at" IS NOT NULL
        OR NEW."approved_at" IS NOT NULL
        OR NEW."rejected_at" IS NOT NULL
        OR NEW."rejection_reason" IS NOT NULL
      THEN
        RAISE EXCEPTION 'CLIENT_INVOICE_SUBMISSION_METADATA_INVALID';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF NEW."invoice_date" IS DISTINCT FROM OLD."invoice_date"
    OR NEW."due_date" IS DISTINCT FROM OLD."due_date"
    OR NEW."total_amount" IS DISTINCT FROM OLD."total_amount"
    OR NEW."approval_instance_id" IS DISTINCT FROM OLD."approval_instance_id"
    OR NEW."submitted_by_user_id" IS DISTINCT FROM OLD."submitted_by_user_id"
    OR NEW."submitted_at" IS DISTINCT FROM OLD."submitted_at"
  THEN
    RAISE EXCEPTION 'CLIENT_INVOICE_HISTORY_IMMUTABLE';
  END IF;

  IF OLD."state" = 'SUBMITTED' THEN
    IF NEW."state" NOT IN ('SUBMITTED','APPROVED','REJECTED') THEN
      RAISE EXCEPTION 'CLIENT_INVOICE_STATE_TRANSITION_INVALID';
    END IF;

    IF NEW."state" = 'SUBMITTED' THEN
      IF NEW."approved_by_user_id" IS DISTINCT FROM OLD."approved_by_user_id"
        OR NEW."rejected_by_user_id" IS DISTINCT FROM OLD."rejected_by_user_id"
        OR NEW."decided_at" IS DISTINCT FROM OLD."decided_at"
        OR NEW."approved_at" IS DISTINCT FROM OLD."approved_at"
        OR NEW."rejected_at" IS DISTINCT FROM OLD."rejected_at"
        OR NEW."rejection_reason" IS DISTINCT FROM OLD."rejection_reason"
      THEN
        RAISE EXCEPTION 'CLIENT_INVOICE_HISTORY_IMMUTABLE';
      END IF;
    ELSIF NEW."state" = 'APPROVED' THEN
      IF NEW."approved_by_user_id" IS NULL
        OR NEW."approved_at" IS NULL
        OR NEW."decided_at" IS NULL
        OR NEW."rejected_by_user_id" IS NOT NULL
        OR NEW."rejected_at" IS NOT NULL
        OR NEW."rejection_reason" IS NOT NULL
      THEN
        RAISE EXCEPTION 'CLIENT_INVOICE_APPROVAL_METADATA_INVALID';
      END IF;
    ELSE
      IF NEW."rejected_by_user_id" IS NULL
        OR NEW."rejected_at" IS NULL
        OR NEW."decided_at" IS NULL
        OR NEW."approved_by_user_id" IS NOT NULL
        OR NEW."approved_at" IS NOT NULL
      THEN
        RAISE EXCEPTION 'CLIENT_INVOICE_REJECTION_METADATA_INVALID';
      END IF;
    END IF;

    RETURN NEW;
  END IF;

  IF OLD."state" IN ('APPROVED','REJECTED') THEN
    IF NEW."state" <> OLD."state"
      OR NEW."approved_by_user_id" IS DISTINCT FROM OLD."approved_by_user_id"
      OR NEW."rejected_by_user_id" IS DISTINCT FROM OLD."rejected_by_user_id"
      OR NEW."decided_at" IS DISTINCT FROM OLD."decided_at"
      OR NEW."approved_at" IS DISTINCT FROM OLD."approved_at"
      OR NEW."rejected_at" IS DISTINCT FROM OLD."rejected_at"
      OR NEW."rejection_reason" IS DISTINCT FROM OLD."rejection_reason"
    THEN
      RAISE EXCEPTION 'CLIENT_INVOICE_HISTORY_IMMUTABLE';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'CLIENT_INVOICE_STATE_TRANSITION_INVALID';
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION erp_client_invoice_delete_guard()
RETURNS trigger AS $$
BEGIN
  IF OLD."state" <> 'DRAFT' THEN
    RAISE EXCEPTION 'CLIENT_INVOICE_HISTORY_IMMUTABLE';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "client_invoice_delete_guard"
BEFORE DELETE ON "client_invoices"
FOR EACH ROW EXECUTE FUNCTION erp_client_invoice_delete_guard();
