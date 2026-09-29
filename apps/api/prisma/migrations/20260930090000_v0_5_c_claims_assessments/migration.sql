-- V0.5-C: Progress Claims, retained Claim Lines and distinct Assessment history.
CREATE UNIQUE INDEX "subcontract_work_orders_company_project_agreement_id_key"
  ON "subcontract_work_orders"("company_id","project_id","agreement_id","id");

CREATE TABLE "subcontract_claims" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "agreement_id" UUID NOT NULL,
  "claim_number" VARCHAR(30) NOT NULL,
  "period_start" DATE NOT NULL,
  "period_end" DATE NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL,
  "state" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  "replacement_for_claim_id" UUID UNIQUE,
  "created_by_user_id" UUID NOT NULL,
  "submitted_by_user_id" UUID,
  "withdrawn_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_at" TIMESTAMPTZ(6),
  "withdrawn_at" TIMESTAMPTZ(6),
  "withdrawal_reason" TEXT,
  "replaced_at" TIMESTAMPTZ(6),
  CONSTRAINT "subcontract_claims_number_key" UNIQUE ("company_id","claim_number"),
  CONSTRAINT "subcontract_claims_scope_key" UNIQUE ("company_id","project_id","agreement_id","id"),
  CONSTRAINT "subcontract_claims_period_check" CHECK ("period_start" <= "period_end"),
  CONSTRAINT "subcontract_claims_currency_check" CHECK ("currency_code" ~ '^[A-Z]{3}$'),
  CONSTRAINT "subcontract_claims_state_check" CHECK ("state" IN ('DRAFT','SUBMITTED','ASSESSED','REJECTED','WITHDRAWN','REPLACED')),
  CONSTRAINT "subcontract_claims_submission_evidence_check" CHECK (
    ("state" = 'DRAFT' AND "submitted_by_user_id" IS NULL AND "submitted_at" IS NULL)
    OR ("state" <> 'DRAFT' AND "submitted_by_user_id" IS NOT NULL AND "submitted_at" IS NOT NULL)
  ),
  CONSTRAINT "subcontract_claims_withdrawal_evidence_check" CHECK (
    ("withdrawn_at" IS NULL AND "withdrawn_by_user_id" IS NULL AND "withdrawal_reason" IS NULL)
    OR (
      "withdrawn_at" IS NOT NULL AND "withdrawn_by_user_id" IS NOT NULL
      AND "withdrawal_reason" IS NOT NULL AND length(btrim("withdrawal_reason")) > 0
      AND "state" IN ('WITHDRAWN','REPLACED')
    )
  ),
  CONSTRAINT "subcontract_claims_replaced_evidence_check" CHECK (
    ("state" <> 'REPLACED' AND "replaced_at" IS NULL)
    OR ("state" = 'REPLACED' AND "replaced_at" IS NOT NULL)
  ),
  CONSTRAINT "subcontract_claims_company_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT,
  CONSTRAINT "subcontract_claims_project_fkey" FOREIGN KEY ("company_id","project_id") REFERENCES "projects"("company_id","id") ON DELETE RESTRICT,
  CONSTRAINT "subcontract_claims_agreement_fkey" FOREIGN KEY ("company_id","project_id","agreement_id") REFERENCES "subcontract_agreements"("company_id","project_id","id") ON DELETE RESTRICT,
  CONSTRAINT "subcontract_claims_replacement_fkey" FOREIGN KEY ("company_id","project_id","agreement_id","replacement_for_claim_id") REFERENCES "subcontract_claims"("company_id","project_id","agreement_id","id") ON DELETE RESTRICT,
  CONSTRAINT "subcontract_claims_creator_fkey" FOREIGN KEY ("company_id","created_by_user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT,
  CONSTRAINT "subcontract_claims_submitter_fkey" FOREIGN KEY ("company_id","submitted_by_user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT,
  CONSTRAINT "subcontract_claims_withdrawer_fkey" FOREIGN KEY ("company_id","withdrawn_by_user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT
);
CREATE INDEX "subcontract_claims_scope_idx"
  ON "subcontract_claims"("company_id","project_id","agreement_id","state");
CREATE INDEX "subcontract_claims_period_idx"
  ON "subcontract_claims"("agreement_id","period_start","period_end");
CREATE UNIQUE INDEX "subcontract_claims_active_period_key"
  ON "subcontract_claims"("agreement_id","period_start","period_end")
  WHERE "state" IN ('DRAFT','SUBMITTED','ASSESSED');

CREATE TABLE "subcontract_claim_lines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "agreement_id" UUID NOT NULL,
  "claim_id" UUID NOT NULL,
  "line_no" INTEGER NOT NULL,
  "work_order_id" UUID,
  "amount" DECIMAL(18,2) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subcontract_claim_lines_number_key" UNIQUE ("claim_id","line_no"),
  CONSTRAINT "subcontract_claim_lines_no_check" CHECK ("line_no" > 0),
  CONSTRAINT "subcontract_claim_lines_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "subcontract_claim_lines_company_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT,
  CONSTRAINT "subcontract_claim_lines_project_fkey" FOREIGN KEY ("company_id","project_id") REFERENCES "projects"("company_id","id") ON DELETE RESTRICT,
  CONSTRAINT "subcontract_claim_lines_agreement_fkey" FOREIGN KEY ("company_id","project_id","agreement_id") REFERENCES "subcontract_agreements"("company_id","project_id","id") ON DELETE RESTRICT,
  CONSTRAINT "subcontract_claim_lines_claim_fkey" FOREIGN KEY ("company_id","project_id","agreement_id","claim_id") REFERENCES "subcontract_claims"("company_id","project_id","agreement_id","id") ON DELETE RESTRICT,
  CONSTRAINT "subcontract_claim_lines_work_order_fkey" FOREIGN KEY ("company_id","project_id","agreement_id","work_order_id") REFERENCES "subcontract_work_orders"("company_id","project_id","agreement_id","id") ON DELETE RESTRICT
);
CREATE INDEX "subcontract_claim_lines_scope_idx"
  ON "subcontract_claim_lines"("company_id","project_id","agreement_id","claim_id");
CREATE INDEX "subcontract_claim_lines_work_order_idx"
  ON "subcontract_claim_lines"("work_order_id");

CREATE TABLE "subcontract_claim_assessments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "agreement_id" UUID NOT NULL,
  "claim_id" UUID NOT NULL UNIQUE,
  "assessed_amount" DECIMAL(18,2) NOT NULL,
  "reason" TEXT NOT NULL,
  "state" VARCHAR(30) NOT NULL DEFAULT 'ASSESSED',
  "assessed_by_user_id" UUID NOT NULL,
  "assessed_at" TIMESTAMPTZ(6) NOT NULL,
  "rejected_by_user_id" UUID,
  "rejected_at" TIMESTAMPTZ(6),
  "rejection_reason" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "claim_assessments_amount_check" CHECK ("assessed_amount" >= 0),
  CONSTRAINT "claim_assessments_reason_check" CHECK (length(btrim("reason")) > 0),
  CONSTRAINT "claim_assessments_state_check" CHECK ("state" IN ('ASSESSED','REJECTED')),
  CONSTRAINT "claim_assessments_rejection_evidence_check" CHECK (
    ("state" = 'ASSESSED' AND "rejected_by_user_id" IS NULL AND "rejected_at" IS NULL AND "rejection_reason" IS NULL)
    OR (
      "state" = 'REJECTED'
      AND "rejected_by_user_id" IS NOT NULL
      AND "rejected_at" IS NOT NULL
      AND "rejection_reason" IS NOT NULL
      AND length(btrim("rejection_reason")) > 0
    )
  ),
  CONSTRAINT "claim_assessments_company_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT,
  CONSTRAINT "claim_assessments_project_fkey" FOREIGN KEY ("company_id","project_id") REFERENCES "projects"("company_id","id") ON DELETE RESTRICT,
  CONSTRAINT "claim_assessments_agreement_fkey" FOREIGN KEY ("company_id","project_id","agreement_id") REFERENCES "subcontract_agreements"("company_id","project_id","id") ON DELETE RESTRICT,
  CONSTRAINT "claim_assessments_claim_fkey" FOREIGN KEY ("company_id","project_id","agreement_id","claim_id") REFERENCES "subcontract_claims"("company_id","project_id","agreement_id","id") ON DELETE RESTRICT,
  CONSTRAINT "claim_assessments_assessor_fkey" FOREIGN KEY ("company_id","assessed_by_user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT,
  CONSTRAINT "claim_assessments_rejector_fkey" FOREIGN KEY ("company_id","rejected_by_user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT
);
CREATE INDEX "claim_assessments_scope_idx"
  ON "subcontract_claim_assessments"("company_id","project_id","agreement_id","state");

CREATE FUNCTION protect_v05c_claim() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    IF OLD."state" <> 'DRAFT' THEN
      RAISE EXCEPTION 'Submitted Claim history cannot be deleted';
    END IF;
    RETURN OLD;
  END IF;

  IF NEW."id" <> OLD."id" OR NEW."company_id" <> OLD."company_id"
    OR NEW."project_id" <> OLD."project_id" OR NEW."agreement_id" <> OLD."agreement_id"
    OR NEW."claim_number" <> OLD."claim_number" OR NEW."currency_code" <> OLD."currency_code"
    OR NEW."replacement_for_claim_id" IS DISTINCT FROM OLD."replacement_for_claim_id"
    OR NEW."created_by_user_id" <> OLD."created_by_user_id" OR NEW."created_at" <> OLD."created_at"
  THEN RAISE EXCEPTION 'Claim identity and source lineage are immutable'; END IF;

  IF OLD."state" <> 'DRAFT' AND (
    NEW."period_start" <> OLD."period_start" OR NEW."period_end" <> OLD."period_end"
    OR NEW."submitted_by_user_id" IS DISTINCT FROM OLD."submitted_by_user_id"
    OR NEW."submitted_at" IS DISTINCT FROM OLD."submitted_at"
  ) THEN RAISE EXCEPTION 'Submitted Claim source fields are immutable'; END IF;

  IF OLD."state" IN ('REPLACED') AND NEW IS DISTINCT FROM OLD
  THEN RAISE EXCEPTION 'Replaced Claim is immutable'; END IF;

  IF NEW."state" <> OLD."state" AND NOT (
    (OLD."state" = 'DRAFT' AND NEW."state" = 'SUBMITTED')
    OR (OLD."state" = 'SUBMITTED' AND NEW."state" IN ('WITHDRAWN','ASSESSED'))
    OR (OLD."state" = 'ASSESSED' AND NEW."state" = 'REJECTED')
    OR (OLD."state" IN ('WITHDRAWN','REJECTED') AND NEW."state" = 'REPLACED')
  ) THEN RAISE EXCEPTION 'Invalid Claim lifecycle transition'; END IF;

  IF OLD."withdrawn_at" IS NOT NULL AND (
    NEW."withdrawn_at" IS DISTINCT FROM OLD."withdrawn_at"
    OR NEW."withdrawn_by_user_id" IS DISTINCT FROM OLD."withdrawn_by_user_id"
    OR NEW."withdrawal_reason" IS DISTINCT FROM OLD."withdrawal_reason"
  ) THEN RAISE EXCEPTION 'Claim withdrawal evidence is immutable'; END IF;

  IF OLD."replaced_at" IS NOT NULL AND NEW."replaced_at" IS DISTINCT FROM OLD."replaced_at"
  THEN RAISE EXCEPTION 'Claim replacement evidence is immutable'; END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER subcontract_claims_guard
BEFORE UPDATE OR DELETE ON "subcontract_claims"
FOR EACH ROW EXECUTE FUNCTION protect_v05c_claim();

CREATE FUNCTION protect_v05c_claim_line() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE claim_state VARCHAR(30);
BEGIN
  SELECT "state" INTO claim_state FROM "subcontract_claims" WHERE "id" = OLD."claim_id";

  IF claim_state IS DISTINCT FROM 'DRAFT' THEN
    RAISE EXCEPTION 'Submitted Claim lines are immutable';
  END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;

  IF NEW."id" <> OLD."id" OR NEW."company_id" <> OLD."company_id"
    OR NEW."project_id" <> OLD."project_id" OR NEW."agreement_id" <> OLD."agreement_id"
    OR NEW."claim_id" <> OLD."claim_id" OR NEW."line_no" <> OLD."line_no"
    OR NEW."created_at" <> OLD."created_at"
  THEN RAISE EXCEPTION 'Claim line identity is immutable'; END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER subcontract_claim_lines_guard
BEFORE UPDATE OR DELETE ON "subcontract_claim_lines"
FOR EACH ROW EXECUTE FUNCTION protect_v05c_claim_line();

CREATE FUNCTION protect_v05c_claim_assessment() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Claim Assessment history cannot be deleted';
  END IF;

  IF NEW."id" <> OLD."id" OR NEW."company_id" <> OLD."company_id"
    OR NEW."project_id" <> OLD."project_id" OR NEW."agreement_id" <> OLD."agreement_id"
    OR NEW."claim_id" <> OLD."claim_id" OR NEW."assessed_amount" <> OLD."assessed_amount"
    OR NEW."reason" <> OLD."reason" OR NEW."assessed_by_user_id" <> OLD."assessed_by_user_id"
    OR NEW."assessed_at" <> OLD."assessed_at" OR NEW."created_at" <> OLD."created_at"
  THEN RAISE EXCEPTION 'Claim Assessment source decision is immutable'; END IF;

  IF OLD."state" = 'REJECTED' AND NEW IS DISTINCT FROM OLD
  THEN RAISE EXCEPTION 'Rejected Claim Assessment is immutable'; END IF;

  IF NEW."state" <> OLD."state" AND NOT (OLD."state" = 'ASSESSED' AND NEW."state" = 'REJECTED')
  THEN RAISE EXCEPTION 'Invalid Claim Assessment transition'; END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER subcontract_claim_assessments_guard
BEFORE UPDATE OR DELETE ON "subcontract_claim_assessments"
FOR EACH ROW EXECUTE FUNCTION protect_v05c_claim_assessment();
