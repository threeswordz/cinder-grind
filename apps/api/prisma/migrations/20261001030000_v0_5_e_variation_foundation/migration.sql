-- V0.5-E Variation / reporting foundation.
-- Forward-only: all V0.5-A through V0.5-D migrations remain unchanged.

CREATE TABLE "subcontract_variations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "agreement_id" UUID NOT NULL,
  "variation_number" VARCHAR(30) NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL,
  "value_delta" DECIMAL(18,2) NOT NULL,
  "scope_change" TEXT NOT NULL,
  "reason" TEXT NOT NULL,
  "state" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  "approval_instance_id" UUID,
  "create_key" VARCHAR(120) NOT NULL,
  "create_payload_hash" VARCHAR(64) NOT NULL,
  "created_by_user_id" UUID NOT NULL,
  "submitted_by_user_id" UUID,
  "approved_by_user_id" UUID,
  "rejected_by_user_id" UUID,
  "reversed_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_at" TIMESTAMPTZ(6),
  "decided_at" TIMESTAMPTZ(6),
  "approved_at" TIMESTAMPTZ(6),
  "rejected_at" TIMESTAMPTZ(6),
  "rejection_reason" TEXT,
  "reversed_at" TIMESTAMPTZ(6),
  "reversal_reason" TEXT,
  CONSTRAINT "subcontract_variations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subcontract_variations_state_check"
    CHECK ("state" IN ('DRAFT','SUBMITTED','APPROVED','REJECTED','REVERSED')),
  CONSTRAINT "subcontract_variations_currency_check"
    CHECK ("currency_code" ~ '^[A-Z]{3}$'),
  CONSTRAINT "subcontract_variations_scope_change_check"
    CHECK (length(btrim("scope_change")) > 0),
  CONSTRAINT "subcontract_variations_reason_check"
    CHECK (length(btrim("reason")) > 0),
  CONSTRAINT "subcontract_variations_submission_evidence_check"
    CHECK (
      ("state" = 'DRAFT' AND "approval_instance_id" IS NULL AND "submitted_by_user_id" IS NULL AND "submitted_at" IS NULL)
      OR
      ("state" <> 'DRAFT' AND "approval_instance_id" IS NOT NULL AND "submitted_by_user_id" IS NOT NULL AND "submitted_at" IS NOT NULL)
    ),
  CONSTRAINT "subcontract_variations_approval_evidence_check"
    CHECK (
      ("state" NOT IN ('APPROVED','REVERSED') AND "approved_by_user_id" IS NULL AND "approved_at" IS NULL)
      OR
      ("state" IN ('APPROVED','REVERSED') AND "approved_by_user_id" IS NOT NULL AND "approved_at" IS NOT NULL AND "decided_at" IS NOT NULL)
    ),
  CONSTRAINT "subcontract_variations_rejection_evidence_check"
    CHECK (
      ("state" <> 'REJECTED' AND "rejected_by_user_id" IS NULL AND "rejected_at" IS NULL AND "rejection_reason" IS NULL)
      OR
      ("state" = 'REJECTED' AND "rejected_by_user_id" IS NOT NULL AND "rejected_at" IS NOT NULL AND "rejection_reason" IS NOT NULL AND length(btrim("rejection_reason")) > 0 AND "decided_at" IS NOT NULL)
    ),
  CONSTRAINT "subcontract_variations_reversal_evidence_check"
    CHECK (
      ("state" <> 'REVERSED' AND "reversed_by_user_id" IS NULL AND "reversed_at" IS NULL AND "reversal_reason" IS NULL)
      OR
      ("state" = 'REVERSED' AND "reversed_by_user_id" IS NOT NULL AND "reversed_at" IS NOT NULL AND "reversal_reason" IS NOT NULL AND length(btrim("reversal_reason")) > 0)
    )
);

CREATE UNIQUE INDEX "subcontract_variations_company_number_key"
  ON "subcontract_variations"("company_id","variation_number");
CREATE UNIQUE INDEX "subcontract_variations_creator_create_key_key"
  ON "subcontract_variations"("company_id","created_by_user_id","create_key");
CREATE UNIQUE INDEX "subcontract_variations_scope_key"
  ON "subcontract_variations"("company_id","project_id","agreement_id","id");
CREATE UNIQUE INDEX "subcontract_variations_approval_instance_id_key"
  ON "subcontract_variations"("approval_instance_id");
CREATE INDEX "subcontract_variations_scope_state_idx"
  ON "subcontract_variations"("company_id","project_id","agreement_id","state");

ALTER TABLE "subcontract_variations"
  ADD CONSTRAINT "subcontract_variations_agreement_fkey"
  FOREIGN KEY ("company_id","project_id","agreement_id")
  REFERENCES "subcontract_agreements"("company_id","project_id","id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "subcontract_variations_approval_instance_fkey"
  FOREIGN KEY ("approval_instance_id")
  REFERENCES "approval_instances"("id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "subcontract_variations_creator_fkey"
  FOREIGN KEY ("company_id","created_by_user_id")
  REFERENCES "users"("company_id","id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "subcontract_variations_submitter_fkey"
  FOREIGN KEY ("company_id","submitted_by_user_id")
  REFERENCES "users"("company_id","id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "subcontract_variations_approver_fkey"
  FOREIGN KEY ("company_id","approved_by_user_id")
  REFERENCES "users"("company_id","id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "subcontract_variations_rejector_fkey"
  FOREIGN KEY ("company_id","rejected_by_user_id")
  REFERENCES "users"("company_id","id")
  ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "subcontract_variations_reverser_fkey"
  FOREIGN KEY ("company_id","reversed_by_user_id")
  REFERENCES "users"("company_id","id")
  ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "permissions" ("id","permission_code","module_code","description")
VALUES
  (gen_random_uuid(),'subcontracts.variation.view','SUBCONTRACTS','View Variation Orders in authorized Projects'),
  (gen_random_uuid(),'subcontracts.variation.create','SUBCONTRACTS','Create Variation Order Drafts'),
  (gen_random_uuid(),'subcontracts.variation.edit','SUBCONTRACTS','Edit Variation Order Drafts'),
  (gen_random_uuid(),'subcontracts.variation.submit','SUBCONTRACTS','Submit Variation Orders for configured approval'),
  (gen_random_uuid(),'subcontracts.variation.approve','SUBCONTRACTS','Approve Variation Orders through configured maker-checker'),
  (gen_random_uuid(),'subcontracts.variation.reject','SUBCONTRACTS','Reject submitted Variation Orders through configured maker-checker'),
  (gen_random_uuid(),'subcontracts.variation.reverse','SUBCONTRACTS','Reverse approved Variation Orders with retained reason and history'),
  (gen_random_uuid(),'subcontracts.report.view','SUBCONTRACTS','View Project-scoped source-derived Subcontracts reports')
ON CONFLICT ("permission_code") DO NOTHING;

CREATE FUNCTION protect_v05e_variation()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."state" <> 'DRAFT' THEN
      RAISE EXCEPTION 'Variation must be created as Draft';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Variation history cannot be deleted';
  END IF;

  IF NEW."id" <> OLD."id"
    OR NEW."company_id" <> OLD."company_id"
    OR NEW."project_id" <> OLD."project_id"
    OR NEW."agreement_id" <> OLD."agreement_id"
    OR NEW."variation_number" <> OLD."variation_number"
    OR NEW."currency_code" <> OLD."currency_code"
    OR NEW."create_key" <> OLD."create_key"
    OR NEW."create_payload_hash" <> OLD."create_payload_hash"
    OR NEW."created_by_user_id" <> OLD."created_by_user_id"
    OR NEW."created_at" <> OLD."created_at"
  THEN
    RAISE EXCEPTION 'Variation identity and source references are immutable';
  END IF;

  IF OLD."state" <> 'DRAFT' AND (
    NEW."value_delta" <> OLD."value_delta"
    OR NEW."scope_change" <> OLD."scope_change"
    OR NEW."reason" <> OLD."reason"
    OR NEW."approval_instance_id" IS DISTINCT FROM OLD."approval_instance_id"
    OR NEW."submitted_by_user_id" IS DISTINCT FROM OLD."submitted_by_user_id"
    OR NEW."submitted_at" IS DISTINCT FROM OLD."submitted_at"
  ) THEN
    RAISE EXCEPTION 'Submitted Variation source fields are immutable';
  END IF;

  IF OLD."state" IN ('REJECTED','REVERSED') AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Decided Variation history is immutable';
  END IF;

  IF OLD."approved_at" IS NOT NULL AND (
    NEW."approved_by_user_id" IS DISTINCT FROM OLD."approved_by_user_id"
    OR NEW."approved_at" IS DISTINCT FROM OLD."approved_at"
    OR NEW."decided_at" IS DISTINCT FROM OLD."decided_at"
  ) THEN
    RAISE EXCEPTION 'Approved Variation decision evidence is immutable';
  END IF;

  IF NEW."state" <> OLD."state" AND NOT (
    (OLD."state" = 'DRAFT' AND NEW."state" = 'SUBMITTED')
    OR (OLD."state" = 'SUBMITTED' AND NEW."state" IN ('APPROVED','REJECTED'))
    OR (OLD."state" = 'APPROVED' AND NEW."state" = 'REVERSED')
  ) THEN
    RAISE EXCEPTION 'Invalid Variation lifecycle transition';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER subcontract_variations_guard
BEFORE INSERT OR UPDATE OR DELETE ON "subcontract_variations"
FOR EACH ROW EXECUTE FUNCTION protect_v05e_variation();

CREATE FUNCTION check_v05e_variation_consistency()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  agreement_state VARCHAR(30);
  agreement_cancelled_at TIMESTAMPTZ;
  agreement_currency VARCHAR(3);
  original_value NUMERIC(18,2);
  approval_state VARCHAR(30);
  approval_entity_type VARCHAR(100);
  approval_entity_id UUID;
  variation_delta NUMERIC(18,2);
  current_ceiling NUMERIC(18,2);
  wo_floor NUMERIC(18,2);
  claim_floor NUMERIC(18,2);
  cert_floor NUMERIC(18,2);
  protected_floor NUMERIC(18,2);
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('v05e-variation-company:' || NEW."company_id"::text),
    hashtext('v05e-variation-agreement:' || NEW."agreement_id"::text)
  );

  SELECT "approval_state","cancelled_at","currency_code","original_value"
    INTO agreement_state, agreement_cancelled_at, agreement_currency, original_value
    FROM "subcontract_agreements"
    WHERE "id" = NEW."agreement_id"
      AND "company_id" = NEW."company_id"
      AND "project_id" = NEW."project_id";

  IF agreement_state IS NULL THEN
    RAISE EXCEPTION 'Variation requires same-scope Agreement';
  END IF;
  IF NEW."currency_code" <> agreement_currency THEN
    RAISE EXCEPTION 'Variation currency must inherit Agreement currency';
  END IF;
  IF NEW."state" IN ('DRAFT','SUBMITTED','APPROVED') AND (
    agreement_state <> 'APPROVED' OR agreement_cancelled_at IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Active Variation requires approved non-cancelled Agreement';
  END IF;

  IF NEW."state" <> 'DRAFT' THEN
    SELECT "approval_state","entity_type","entity_id"
      INTO approval_state, approval_entity_type, approval_entity_id
      FROM "approval_instances"
      WHERE "id" = NEW."approval_instance_id"
        AND "company_id" = NEW."company_id";

    IF approval_state IS NULL
      OR approval_entity_type <> 'SUBCONTRACT_VARIATION'
      OR approval_entity_id <> NEW."id"
    THEN
      RAISE EXCEPTION 'Variation approval instance does not match Variation';
    END IF;

    IF NEW."state" = 'SUBMITTED' AND approval_state <> 'SUBMITTED' THEN
      RAISE EXCEPTION 'Submitted Variation requires submitted approval instance';
    ELSIF NEW."state" = 'REJECTED' AND approval_state <> 'REJECTED' THEN
      RAISE EXCEPTION 'Rejected Variation requires rejected approval instance';
    ELSIF NEW."state" IN ('APPROVED','REVERSED') AND approval_state <> 'APPROVED' THEN
      RAISE EXCEPTION 'Approved Variation requires approved approval instance';
    END IF;
  END IF;

  IF NEW."state" IN ('APPROVED','REVERSED') THEN
    SELECT COALESCE(SUM("value_delta"),0)
      INTO variation_delta
      FROM "subcontract_variations"
      WHERE "company_id" = NEW."company_id"
        AND "agreement_id" = NEW."agreement_id"
        AND "state" = 'APPROVED';

    current_ceiling := original_value + variation_delta;

    SELECT COALESCE(SUM("amount"),0)
      INTO wo_floor
      FROM "subcontract_work_orders"
      WHERE "company_id" = NEW."company_id"
        AND "agreement_id" = NEW."agreement_id"
        AND "approval_state" = 'APPROVED';

    SELECT COALESCE(SUM(line."amount"),0)
      INTO claim_floor
      FROM "subcontract_claim_lines" line
      JOIN "subcontract_claims" claim ON claim."id" = line."claim_id"
      WHERE line."company_id" = NEW."company_id"
        AND line."agreement_id" = NEW."agreement_id"
        AND claim."state" IN ('SUBMITTED','ASSESSED');

    SELECT COALESCE(SUM("certified_gross"),0)
      INTO cert_floor
      FROM "subcontract_certifications"
      WHERE "company_id" = NEW."company_id"
        AND "agreement_id" = NEW."agreement_id"
        AND "state" = 'APPROVED';

    protected_floor := GREATEST(0, wo_floor, claim_floor, cert_floor);
    IF current_ceiling < protected_floor THEN
      RAISE EXCEPTION 'Variation would reduce Agreement ceiling below protected downstream value';
    END IF;
  END IF;

  RETURN NEW;
END $$;

CREATE CONSTRAINT TRIGGER subcontract_variation_consistency
AFTER INSERT OR UPDATE ON "subcontract_variations"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_v05e_variation_consistency();

CREATE OR REPLACE FUNCTION check_v05e_variation_approval_instance_consistency()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  variation_state VARCHAR(30);
BEGIN
  IF TG_OP = 'UPDATE'
    AND OLD."entity_type" = 'SUBCONTRACT_VARIATION'
    AND (
      NEW."entity_type" IS DISTINCT FROM OLD."entity_type"
      OR NEW."entity_id" IS DISTINCT FROM OLD."entity_id"
      OR NEW."company_id" IS DISTINCT FROM OLD."company_id"
    )
  THEN
    RAISE EXCEPTION 'Variation approval instance identity is immutable';
  END IF;

  IF NEW."entity_type" <> 'SUBCONTRACT_VARIATION' THEN
    RETURN NEW;
  END IF;

  SELECT v."state" INTO variation_state
    FROM "subcontract_variations" v
    WHERE v."approval_instance_id" = NEW."id"
      AND v."id" = NEW."entity_id"
      AND v."company_id" = NEW."company_id";

  IF variation_state IS NULL THEN
    RAISE EXCEPTION 'Variation approval instance requires reciprocal Variation link';
  END IF;
  IF NEW."approval_state" = 'SUBMITTED' AND variation_state <> 'SUBMITTED' THEN
    RAISE EXCEPTION 'Submitted approval instance requires submitted Variation';
  ELSIF NEW."approval_state" = 'REJECTED' AND variation_state <> 'REJECTED' THEN
    RAISE EXCEPTION 'Rejected approval instance requires rejected Variation';
  ELSIF NEW."approval_state" = 'APPROVED' AND variation_state NOT IN ('APPROVED','REVERSED') THEN
    RAISE EXCEPTION 'Approved approval instance requires approved or reversed Variation';
  ELSIF NEW."approval_state" = 'CANCELLED' THEN
    RAISE EXCEPTION 'Variation approval instances cannot be cancelled independently';
  END IF;
  RETURN NEW;
END $$;

CREATE CONSTRAINT TRIGGER v05e_variation_approval_instance_consistency
AFTER INSERT OR UPDATE ON "approval_instances"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_v05e_variation_approval_instance_consistency();

CREATE FUNCTION check_v05e_agreement_variation_cancel()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW."approval_state" = 'CANCELLED'
    AND OLD."approval_state" IS DISTINCT FROM 'CANCELLED'
    AND EXISTS (
      SELECT 1 FROM "subcontract_variations"
      WHERE "agreement_id" = NEW."id" AND "state" = 'SUBMITTED'
    )
  THEN
    RAISE EXCEPTION 'Agreement with submitted Variation cannot be cancelled';
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER v05e_agreement_variation_cancel
BEFORE UPDATE OF "approval_state" ON "subcontract_agreements"
FOR EACH ROW EXECUTE FUNCTION check_v05e_agreement_variation_cancel();
