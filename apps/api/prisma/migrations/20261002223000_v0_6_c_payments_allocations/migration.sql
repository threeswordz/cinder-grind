-- V0.6-C Payments / approvals / allocations.
-- Forward-only migration. Do not edit after execution.

CREATE TABLE "payments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "payment_number" VARCHAR(120) NOT NULL,
  "payment_direction" VARCHAR(20) NOT NULL,
  "payment_date" DATE NOT NULL,
  "supplier_id" UUID,
  "customer_id" UUID,
  "subcontractor_id" UUID,
  "amount" DECIMAL(18,2) NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL,
  "payment_method" VARCHAR(120),
  "reference" VARCHAR(200),
  "state" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  "approval_instance_id" UUID,
  "create_key" VARCHAR(120) NOT NULL,
  "create_payload_hash" VARCHAR(64) NOT NULL,
  "created_by_user_id" UUID NOT NULL,
  "submitted_by_user_id" UUID,
  "approved_by_user_id" UUID,
  "rejected_by_user_id" UUID,
  "cancelled_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_at" TIMESTAMPTZ(6),
  "decided_at" TIMESTAMPTZ(6),
  "approved_at" TIMESTAMPTZ(6),
  "rejected_at" TIMESTAMPTZ(6),
  "rejection_reason" TEXT,
  "cancelled_at" TIMESTAMPTZ(6),
  "cancellation_reason" TEXT,
  CONSTRAINT "payments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "payments_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "payments_direction_check"
    CHECK ("payment_direction" IN ('OUTBOUND','INBOUND')),
  CONSTRAINT "payments_state_check"
    CHECK ("state" IN ('DRAFT','SUBMITTED','APPROVED','REJECTED','CANCELLED')),
  CONSTRAINT "payments_counterparty_check" CHECK (
    (
      "payment_direction" = 'INBOUND'
      AND "customer_id" IS NOT NULL
      AND "supplier_id" IS NULL
      AND "subcontractor_id" IS NULL
    )
    OR
    (
      "payment_direction" = 'OUTBOUND'
      AND "customer_id" IS NULL
      AND (
        ("supplier_id" IS NOT NULL AND "subcontractor_id" IS NULL)
        OR
        ("supplier_id" IS NULL AND "subcontractor_id" IS NOT NULL)
      )
    )
  )
);

CREATE UNIQUE INDEX "payments_company_number_key"
  ON "payments"("company_id","payment_number");
CREATE UNIQUE INDEX "payments_creator_create_key_key"
  ON "payments"("company_id","created_by_user_id","create_key");
CREATE UNIQUE INDEX "payments_scope_key"
  ON "payments"("company_id","project_id","id");
CREATE UNIQUE INDEX "payments_approval_instance_id_key"
  ON "payments"("approval_instance_id");
CREATE INDEX "payments_company_project_state_idx"
  ON "payments"("company_id","project_id","state");
CREATE INDEX "payments_company_supplier_date_idx"
  ON "payments"("company_id","supplier_id","payment_date");
CREATE INDEX "payments_company_customer_date_idx"
  ON "payments"("company_id","customer_id","payment_date");
CREATE INDEX "payments_company_subcontractor_date_idx"
  ON "payments"("company_id","subcontractor_id","payment_date");

CREATE TABLE "supplier_payment_allocations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "payment_id" UUID NOT NULL,
  "supplier_invoice_id" UUID NOT NULL,
  "allocated_amount" DECIMAL(18,2) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supplier_payment_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "supplier_payment_allocations_amount_check"
    CHECK ("allocated_amount" > 0),
  CONSTRAINT "supplier_payment_allocations_payment_invoice_key"
    UNIQUE ("payment_id","supplier_invoice_id")
);
CREATE INDEX "supplier_payment_allocations_invoice_idx"
  ON "supplier_payment_allocations"("supplier_invoice_id");

CREATE TABLE "client_receipt_allocations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "payment_id" UUID NOT NULL,
  "client_invoice_id" UUID NOT NULL,
  "allocated_amount" DECIMAL(18,2) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_receipt_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "client_receipt_allocations_amount_check"
    CHECK ("allocated_amount" > 0),
  CONSTRAINT "client_receipt_allocations_payment_invoice_key"
    UNIQUE ("payment_id","client_invoice_id")
);
CREATE INDEX "client_receipt_allocations_invoice_idx"
  ON "client_receipt_allocations"("client_invoice_id");

CREATE TABLE "subcontract_payment_allocations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "payment_id" UUID NOT NULL,
  "subcontract_certification_id" UUID NOT NULL,
  "allocated_amount" DECIMAL(18,2) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subcontract_payment_allocations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subcontract_payment_allocations_amount_check"
    CHECK ("allocated_amount" > 0),
  CONSTRAINT "subcontract_payment_allocations_payment_certification_key"
    UNIQUE ("payment_id","subcontract_certification_id")
);
CREATE INDEX "subcontract_payment_allocations_certification_idx"
  ON "subcontract_payment_allocations"("subcontract_certification_id");

ALTER TABLE "payments"
  ADD CONSTRAINT "payments_company_fkey"
    FOREIGN KEY ("company_id")
    REFERENCES "companies"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "payments_project_fkey"
    FOREIGN KEY ("company_id","project_id")
    REFERENCES "projects"("company_id","id") ON DELETE RESTRICT,
  ADD CONSTRAINT "payments_supplier_fkey"
    FOREIGN KEY ("company_id","supplier_id")
    REFERENCES "suppliers"("company_id","id") ON DELETE RESTRICT,
  ADD CONSTRAINT "payments_customer_fkey"
    FOREIGN KEY ("company_id","customer_id")
    REFERENCES "customers"("company_id","id") ON DELETE RESTRICT,
  ADD CONSTRAINT "payments_subcontractor_fkey"
    FOREIGN KEY ("company_id","subcontractor_id")
    REFERENCES "subcontractors"("company_id","id") ON DELETE RESTRICT,
  ADD CONSTRAINT "payments_approval_fkey"
    FOREIGN KEY ("approval_instance_id")
    REFERENCES "approval_instances"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "payments_creator_fkey"
    FOREIGN KEY ("company_id","created_by_user_id")
    REFERENCES "users"("company_id","id") ON DELETE RESTRICT,
  ADD CONSTRAINT "payments_submitter_fkey"
    FOREIGN KEY ("company_id","submitted_by_user_id")
    REFERENCES "users"("company_id","id") ON DELETE RESTRICT,
  ADD CONSTRAINT "payments_approver_fkey"
    FOREIGN KEY ("company_id","approved_by_user_id")
    REFERENCES "users"("company_id","id") ON DELETE RESTRICT,
  ADD CONSTRAINT "payments_rejector_fkey"
    FOREIGN KEY ("company_id","rejected_by_user_id")
    REFERENCES "users"("company_id","id") ON DELETE RESTRICT,
  ADD CONSTRAINT "payments_canceller_fkey"
    FOREIGN KEY ("company_id","cancelled_by_user_id")
    REFERENCES "users"("company_id","id") ON DELETE RESTRICT;

ALTER TABLE "supplier_payment_allocations"
  ADD CONSTRAINT "supplier_payment_allocations_payment_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "supplier_payment_allocations_invoice_fkey"
    FOREIGN KEY ("supplier_invoice_id")
    REFERENCES "supplier_invoices"("id") ON DELETE RESTRICT;

ALTER TABLE "client_receipt_allocations"
  ADD CONSTRAINT "client_receipt_allocations_payment_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "client_receipt_allocations_invoice_fkey"
    FOREIGN KEY ("client_invoice_id")
    REFERENCES "client_invoices"("id") ON DELETE RESTRICT;

ALTER TABLE "subcontract_payment_allocations"
  ADD CONSTRAINT "subcontract_payment_allocations_payment_fkey"
    FOREIGN KEY ("payment_id") REFERENCES "payments"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "subcontract_payment_allocations_certification_fkey"
    FOREIGN KEY ("subcontract_certification_id")
    REFERENCES "subcontract_certifications"("id") ON DELETE RESTRICT;

INSERT INTO "permissions"
  ("id","permission_code","module_code","description")
VALUES
  (gen_random_uuid(),'finance.payment.view','FINANCE','View authorized Payments and retained allocation history'),
  (gen_random_uuid(),'finance.payment.create','FINANCE','Create Payment drafts'),
  (gen_random_uuid(),'finance.payment.edit','FINANCE','Edit Payment drafts and Draft allocations'),
  (gen_random_uuid(),'finance.payment.submit','FINANCE','Submit Payments for approval'),
  (gen_random_uuid(),'finance.payment.approve','FINANCE','Approve Payments when also authorized by the Approval Matrix'),
  (gen_random_uuid(),'finance.payment.reject','FINANCE','Reject Payments when also authorized by the Approval Matrix'),
  (gen_random_uuid(),'finance.payment.cancel','FINANCE','Cancel approved Payments while retaining history')
ON CONFLICT ("permission_code") DO NOTHING;

INSERT INTO "number_sequences"
  ("id","company_id","entity_type","sequence_code","format_template","reset_rule","next_value")
SELECT
  gen_random_uuid(), c."id", 'PAYMENT', 'PAYMENT',
  'PAYYYMM-###', 'MONTHLY', 1
FROM "companies" c
ON CONFLICT ("company_id","sequence_code") DO NOTHING;

-- A pre-release unused administrator-created PAYMENT sequence can be
-- normalized. A used/incompatible row must fail explicitly rather than
-- silently corrupting the approved numbering policy.
UPDATE "number_sequences"
SET
  "entity_type" = 'PAYMENT',
  "format_template" = 'PAYYYMM-###',
  "reset_rule" = 'MONTHLY'
WHERE
  "sequence_code" = 'PAYMENT'
  AND "next_value" = 1
  AND "last_period_key" IS NULL;

DO $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM "number_sequences"
    WHERE
      "sequence_code" = 'PAYMENT'
      AND (
        "format_template" <> 'PAYYYMM-###'
        OR "reset_rule" <> 'MONTHLY'
      )
  ) THEN
    RAISE EXCEPTION 'PAYMENT_NUMBER_SEQUENCE_POLICY_MISMATCH';
  END IF;
END;
$$;

CREATE OR REPLACE FUNCTION erp_payment_total_allocated(p_payment UUID)
RETURNS DECIMAL(18,2) AS $$
DECLARE
  total DECIMAL(18,2);
BEGIN
  SELECT COALESCE(SUM(value), 0)
    INTO total
  FROM (
    SELECT "allocated_amount" AS value
      FROM "supplier_payment_allocations"
      WHERE "payment_id" = p_payment
    UNION ALL
    SELECT "allocated_amount"
      FROM "client_receipt_allocations"
      WHERE "payment_id" = p_payment
    UNION ALL
    SELECT "allocated_amount"
      FROM "subcontract_payment_allocations"
      WHERE "payment_id" = p_payment
  ) allocations;
  RETURN total;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION erp_payment_header_guard()
RETURNS trigger AS $$
DECLARE
  allocated DECIMAL(18,2);
BEGIN
  IF NEW."payment_number" IS DISTINCT FROM OLD."payment_number" THEN
    RAISE EXCEPTION 'PAYMENT_NUMBER_IMMUTABLE';
  END IF;

  IF
       NEW."company_id" IS DISTINCT FROM OLD."company_id"
    OR NEW."project_id" IS DISTINCT FROM OLD."project_id"
    OR NEW."payment_direction" IS DISTINCT FROM OLD."payment_direction"
    OR NEW."supplier_id" IS DISTINCT FROM OLD."supplier_id"
    OR NEW."customer_id" IS DISTINCT FROM OLD."customer_id"
    OR NEW."subcontractor_id" IS DISTINCT FROM OLD."subcontractor_id"
    OR NEW."currency_code" IS DISTINCT FROM OLD."currency_code"
    OR NEW."create_key" IS DISTINCT FROM OLD."create_key"
    OR NEW."create_payload_hash" IS DISTINCT FROM OLD."create_payload_hash"
    OR NEW."created_by_user_id" IS DISTINCT FROM OLD."created_by_user_id"
  THEN
    RAISE EXCEPTION 'PAYMENT_IDENTITY_IMMUTABLE';
  END IF;

  IF OLD."state" <> 'DRAFT' AND (
       NEW."payment_date" IS DISTINCT FROM OLD."payment_date"
    OR NEW."amount" IS DISTINCT FROM OLD."amount"
    OR NEW."payment_method" IS DISTINCT FROM OLD."payment_method"
    OR NEW."reference" IS DISTINCT FROM OLD."reference"
    OR NEW."approval_instance_id" IS DISTINCT FROM OLD."approval_instance_id"
    OR NEW."submitted_by_user_id" IS DISTINCT FROM OLD."submitted_by_user_id"
    OR NEW."submitted_at" IS DISTINCT FROM OLD."submitted_at"
  ) THEN
    RAISE EXCEPTION 'PAYMENT_HISTORY_IMMUTABLE';
  END IF;

  IF substring(NEW."payment_number" from 4 for 4)
       <> to_char(NEW."payment_date", 'YYMM')
  THEN
    RAISE EXCEPTION 'PAYMENT_NUMBER_PERIOD_MISMATCH';
  END IF;

  allocated := erp_payment_total_allocated(OLD."id");
  IF NEW."amount" < allocated THEN
    RAISE EXCEPTION 'PAYMENT_AMOUNT_BELOW_ALLOCATIONS';
  END IF;

  IF OLD."state" = 'DRAFT'
     AND NEW."state" NOT IN ('DRAFT','SUBMITTED')
  THEN
    RAISE EXCEPTION 'PAYMENT_STATE_TRANSITION_INVALID';
  ELSIF OLD."state" = 'SUBMITTED'
     AND NEW."state" NOT IN ('SUBMITTED','APPROVED','REJECTED')
  THEN
    RAISE EXCEPTION 'PAYMENT_STATE_TRANSITION_INVALID';
  ELSIF OLD."state" = 'APPROVED'
     AND NEW."state" NOT IN ('APPROVED','CANCELLED')
  THEN
    RAISE EXCEPTION 'PAYMENT_STATE_TRANSITION_INVALID';
  ELSIF OLD."state" IN ('REJECTED','CANCELLED')
     AND NEW."state" <> OLD."state"
  THEN
    RAISE EXCEPTION 'PAYMENT_STATE_TRANSITION_INVALID';
  END IF;

  IF OLD."state" = 'DRAFT' AND NEW."state" = 'SUBMITTED'
     AND (
       NEW."approval_instance_id" IS NULL
       OR NEW."submitted_by_user_id" IS NULL
       OR NEW."submitted_at" IS NULL
     )
  THEN
    RAISE EXCEPTION 'PAYMENT_SUBMISSION_EVIDENCE_REQUIRED';
  END IF;

  IF OLD."state" = 'SUBMITTED' AND NEW."state" = 'APPROVED'
     AND (
       NEW."approved_by_user_id" IS NULL
       OR NEW."approved_at" IS NULL
       OR NEW."decided_at" IS NULL
     )
  THEN
    RAISE EXCEPTION 'PAYMENT_APPROVAL_EVIDENCE_REQUIRED';
  END IF;

  IF OLD."state" = 'SUBMITTED' AND NEW."state" = 'REJECTED'
     AND (
       NEW."rejected_by_user_id" IS NULL
       OR NEW."rejected_at" IS NULL
       OR NEW."decided_at" IS NULL
     )
  THEN
    RAISE EXCEPTION 'PAYMENT_REJECTION_EVIDENCE_REQUIRED';
  END IF;

  IF OLD."state" = 'APPROVED' AND NEW."state" = 'CANCELLED'
     AND (
       NEW."cancelled_by_user_id" IS NULL
       OR NEW."cancelled_at" IS NULL
       OR NEW."cancellation_reason" IS NULL
       OR btrim(NEW."cancellation_reason") = ''
     )
  THEN
    RAISE EXCEPTION 'PAYMENT_CANCELLATION_EVIDENCE_REQUIRED';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "payment_header_guard"
BEFORE UPDATE ON "payments"
FOR EACH ROW EXECUTE FUNCTION erp_payment_header_guard();

CREATE OR REPLACE FUNCTION erp_payment_no_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'PAYMENT_HISTORY_DELETE_FORBIDDEN';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "payment_no_delete"
BEFORE DELETE ON "payments"
FOR EACH ROW EXECUTE FUNCTION erp_payment_no_delete();

CREATE OR REPLACE FUNCTION erp_supplier_payment_allocation_insert_guard()
RETURNS trigger AS $$
DECLARE
  payment_row "payments"%ROWTYPE;
  invoice_row "supplier_invoices"%ROWTYPE;
  payment_total DECIMAL(18,2);
  target_total DECIMAL(18,2);
BEGIN
  SELECT * INTO payment_row
  FROM "payments"
  WHERE "id" = NEW."payment_id"
  FOR UPDATE;

  IF payment_row."id" IS NULL OR payment_row."state" <> 'DRAFT' THEN
    RAISE EXCEPTION 'PAYMENT_ALLOCATION_HISTORY_IMMUTABLE';
  END IF;

  SELECT * INTO invoice_row
  FROM "supplier_invoices"
  WHERE "id" = NEW."supplier_invoice_id"
  FOR UPDATE;

  IF
       invoice_row."id" IS NULL
    OR invoice_row."company_id" <> payment_row."company_id"
    OR invoice_row."project_id" <> payment_row."project_id"
    OR invoice_row."state" <> 'APPROVED'
    OR invoice_row."currency_code" <> payment_row."currency_code"
    OR payment_row."payment_direction" <> 'OUTBOUND'
    OR payment_row."supplier_id" IS NULL
    OR invoice_row."supplier_id" <> payment_row."supplier_id"
  THEN
    RAISE EXCEPTION 'PAYMENT_SUPPLIER_TARGET_INVALID';
  END IF;

  payment_total := erp_payment_total_allocated(payment_row."id");
  IF payment_total + NEW."allocated_amount" > payment_row."amount" THEN
    RAISE EXCEPTION 'PAYMENT_ALLOCATION_EXCEEDS_PAYMENT';
  END IF;

  SELECT COALESCE(SUM(a."allocated_amount"), 0)
    INTO target_total
  FROM "supplier_payment_allocations" a
  JOIN "payments" p ON p."id" = a."payment_id"
  WHERE
    a."supplier_invoice_id" = NEW."supplier_invoice_id"
    AND p."state" IN ('DRAFT','SUBMITTED','APPROVED');

  IF target_total + NEW."allocated_amount" > invoice_row."total_amount" THEN
    RAISE EXCEPTION 'PAYMENT_TARGET_OUTSTANDING_EXCEEDED';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "supplier_payment_allocation_insert_guard"
BEFORE INSERT ON "supplier_payment_allocations"
FOR EACH ROW EXECUTE FUNCTION erp_supplier_payment_allocation_insert_guard();

CREATE OR REPLACE FUNCTION erp_client_receipt_allocation_insert_guard()
RETURNS trigger AS $$
DECLARE
  payment_row "payments"%ROWTYPE;
  invoice_row "client_invoices"%ROWTYPE;
  payment_total DECIMAL(18,2);
  target_total DECIMAL(18,2);
BEGIN
  SELECT * INTO payment_row
  FROM "payments"
  WHERE "id" = NEW."payment_id"
  FOR UPDATE;

  IF payment_row."id" IS NULL OR payment_row."state" <> 'DRAFT' THEN
    RAISE EXCEPTION 'PAYMENT_ALLOCATION_HISTORY_IMMUTABLE';
  END IF;

  SELECT * INTO invoice_row
  FROM "client_invoices"
  WHERE "id" = NEW."client_invoice_id"
  FOR UPDATE;

  IF
       invoice_row."id" IS NULL
    OR invoice_row."company_id" <> payment_row."company_id"
    OR invoice_row."project_id" <> payment_row."project_id"
    OR invoice_row."state" <> 'APPROVED'
    OR invoice_row."currency_code" <> payment_row."currency_code"
    OR payment_row."payment_direction" <> 'INBOUND'
    OR payment_row."customer_id" IS NULL
    OR invoice_row."customer_id" <> payment_row."customer_id"
  THEN
    RAISE EXCEPTION 'PAYMENT_CLIENT_TARGET_INVALID';
  END IF;

  payment_total := erp_payment_total_allocated(payment_row."id");
  IF payment_total + NEW."allocated_amount" > payment_row."amount" THEN
    RAISE EXCEPTION 'PAYMENT_ALLOCATION_EXCEEDS_PAYMENT';
  END IF;

  SELECT COALESCE(SUM(a."allocated_amount"), 0)
    INTO target_total
  FROM "client_receipt_allocations" a
  JOIN "payments" p ON p."id" = a."payment_id"
  WHERE
    a."client_invoice_id" = NEW."client_invoice_id"
    AND p."state" IN ('DRAFT','SUBMITTED','APPROVED');

  IF target_total + NEW."allocated_amount" > invoice_row."total_amount" THEN
    RAISE EXCEPTION 'PAYMENT_TARGET_OUTSTANDING_EXCEEDED';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "client_receipt_allocation_insert_guard"
BEFORE INSERT ON "client_receipt_allocations"
FOR EACH ROW EXECUTE FUNCTION erp_client_receipt_allocation_insert_guard();

CREATE OR REPLACE FUNCTION erp_subcontract_payment_allocation_insert_guard()
RETURNS trigger AS $$
DECLARE
  payment_row "payments"%ROWTYPE;
  certification_row "subcontract_certifications"%ROWTYPE;
  certification_subcontractor_id UUID;
  payment_total DECIMAL(18,2);
  target_total DECIMAL(18,2);
BEGIN
  SELECT * INTO payment_row
  FROM "payments"
  WHERE "id" = NEW."payment_id"
  FOR UPDATE;

  IF payment_row."id" IS NULL OR payment_row."state" <> 'DRAFT' THEN
    RAISE EXCEPTION 'PAYMENT_ALLOCATION_HISTORY_IMMUTABLE';
  END IF;

  SELECT c.*, a."subcontractor_id"
    INTO certification_row, certification_subcontractor_id
  FROM "subcontract_certifications" c
  JOIN "subcontract_agreements" a ON a."id" = c."agreement_id"
  WHERE c."id" = NEW."subcontract_certification_id"
  FOR UPDATE OF c;

  IF
       certification_row."id" IS NULL
    OR certification_row."company_id" <> payment_row."company_id"
    OR certification_row."project_id" <> payment_row."project_id"
    OR certification_row."state" <> 'APPROVED'
    OR certification_row."reversed_at" IS NOT NULL
    OR certification_row."net_certified_amount" IS NULL
    OR certification_row."currency_code" <> payment_row."currency_code"
    OR payment_row."payment_direction" <> 'OUTBOUND'
    OR payment_row."subcontractor_id" IS NULL
    OR certification_subcontractor_id <> payment_row."subcontractor_id"
  THEN
    RAISE EXCEPTION 'PAYMENT_SUBCONTRACT_TARGET_INVALID';
  END IF;

  payment_total := erp_payment_total_allocated(payment_row."id");
  IF payment_total + NEW."allocated_amount" > payment_row."amount" THEN
    RAISE EXCEPTION 'PAYMENT_ALLOCATION_EXCEEDS_PAYMENT';
  END IF;

  SELECT COALESCE(SUM(a."allocated_amount"), 0)
    INTO target_total
  FROM "subcontract_payment_allocations" a
  JOIN "payments" p ON p."id" = a."payment_id"
  WHERE
    a."subcontract_certification_id" = NEW."subcontract_certification_id"
    AND p."state" IN ('DRAFT','SUBMITTED','APPROVED');

  IF target_total + NEW."allocated_amount"
       > certification_row."net_certified_amount"
  THEN
    RAISE EXCEPTION 'PAYMENT_TARGET_OUTSTANDING_EXCEEDED';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "subcontract_payment_allocation_insert_guard"
BEFORE INSERT ON "subcontract_payment_allocations"
FOR EACH ROW EXECUTE FUNCTION erp_subcontract_payment_allocation_insert_guard();

CREATE OR REPLACE FUNCTION erp_payment_allocation_change_guard()
RETURNS trigger AS $$
DECLARE
  payment_state TEXT;
  payment_id UUID;
BEGIN
  payment_id := OLD."payment_id";
  SELECT "state" INTO payment_state
  FROM "payments"
  WHERE "id" = payment_id
  FOR UPDATE;

  IF payment_state IS DISTINCT FROM 'DRAFT' THEN
    RAISE EXCEPTION 'PAYMENT_ALLOCATION_HISTORY_IMMUTABLE';
  END IF;

  IF TG_OP = 'UPDATE' THEN
    RAISE EXCEPTION 'PAYMENT_ALLOCATION_UPDATE_FORBIDDEN';
  END IF;

  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "supplier_payment_allocation_change_guard"
BEFORE UPDATE OR DELETE ON "supplier_payment_allocations"
FOR EACH ROW EXECUTE FUNCTION erp_payment_allocation_change_guard();

CREATE TRIGGER "client_receipt_allocation_change_guard"
BEFORE UPDATE OR DELETE ON "client_receipt_allocations"
FOR EACH ROW EXECUTE FUNCTION erp_payment_allocation_change_guard();

CREATE TRIGGER "subcontract_payment_allocation_change_guard"
BEFORE UPDATE OR DELETE ON "subcontract_payment_allocations"
FOR EACH ROW EXECUTE FUNCTION erp_payment_allocation_change_guard();

CREATE OR REPLACE FUNCTION erp_v06c_certification_finance_reversal_guard()
RETURNS trigger AS $$
BEGIN
  IF
    OLD."reversed_at" IS NULL
    AND NEW."reversed_at" IS NOT NULL
    AND EXISTS (
      SELECT 1
      FROM "subcontract_payment_allocations" a
      JOIN "payments" p ON p."id" = a."payment_id"
      WHERE
        a."subcontract_certification_id" = OLD."id"
        AND p."state" IN ('DRAFT','SUBMITTED','APPROVED')
    )
  THEN
    RAISE EXCEPTION 'SUBCONTRACT_CERTIFICATION_ACTIVE_PAYMENT_ALLOCATION';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "v06c_certification_finance_reversal_guard"
BEFORE UPDATE ON "subcontract_certifications"
FOR EACH ROW EXECUTE FUNCTION erp_v06c_certification_finance_reversal_guard();
