-- V0.6-C hardening: retain immutable Payment decision evidence.
-- Forward-only migration. The original V0.6-C migration has already executed.

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

  -- Once decision evidence exists, later lifecycle steps may not rewrite it.
  -- Approved evidence remains immutable during cancellation; rejected and
  -- cancelled evidence remains immutable in their terminal states.
  IF OLD."state" = 'APPROVED' AND (
       NEW."approved_by_user_id" IS DISTINCT FROM OLD."approved_by_user_id"
    OR NEW."approved_at" IS DISTINCT FROM OLD."approved_at"
    OR NEW."decided_at" IS DISTINCT FROM OLD."decided_at"
  ) THEN
    RAISE EXCEPTION 'PAYMENT_APPROVAL_HISTORY_IMMUTABLE';
  END IF;

  IF OLD."state" = 'REJECTED' AND (
       NEW."rejected_by_user_id" IS DISTINCT FROM OLD."rejected_by_user_id"
    OR NEW."rejected_at" IS DISTINCT FROM OLD."rejected_at"
    OR NEW."rejection_reason" IS DISTINCT FROM OLD."rejection_reason"
    OR NEW."decided_at" IS DISTINCT FROM OLD."decided_at"
  ) THEN
    RAISE EXCEPTION 'PAYMENT_REJECTION_HISTORY_IMMUTABLE';
  END IF;

  IF OLD."state" = 'CANCELLED' AND (
       NEW."cancelled_by_user_id" IS DISTINCT FROM OLD."cancelled_by_user_id"
    OR NEW."cancelled_at" IS DISTINCT FROM OLD."cancelled_at"
    OR NEW."cancellation_reason" IS DISTINCT FROM OLD."cancellation_reason"
  ) THEN
    RAISE EXCEPTION 'PAYMENT_CANCELLATION_HISTORY_IMMUTABLE';
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
