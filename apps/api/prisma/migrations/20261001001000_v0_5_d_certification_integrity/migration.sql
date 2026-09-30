-- V0.5-D forward-only Certification / retention integrity hardening.
-- Previously executed V0.5-A/B/C/D migrations remain byte-for-byte unchanged.

ALTER TABLE "subcontract_certifications"
  ADD CONSTRAINT "subcontract_certifications_currency_check"
    CHECK ("currency_code" ~ '^[A-Z]{3}$'),
  ADD CONSTRAINT "subcontract_certifications_submission_evidence_check"
    CHECK (
      ("state" = 'DRAFT'
        AND "approval_instance_id" IS NULL
        AND "submitted_by_user_id" IS NULL
        AND "submitted_at" IS NULL)
      OR
      ("state" <> 'DRAFT'
        AND "approval_instance_id" IS NOT NULL
        AND "submitted_by_user_id" IS NOT NULL
        AND "submitted_at" IS NOT NULL)
    ),
  ADD CONSTRAINT "subcontract_certifications_approval_evidence_check"
    CHECK (
      ("state" NOT IN ('APPROVED','REVERSED')
        AND "approved_by_user_id" IS NULL
        AND "approved_at" IS NULL)
      OR
      ("state" IN ('APPROVED','REVERSED')
        AND "approved_by_user_id" IS NOT NULL
        AND "approved_at" IS NOT NULL
        AND "decided_at" IS NOT NULL)
    ),
  ADD CONSTRAINT "subcontract_certifications_rejection_evidence_check"
    CHECK (
      ("state" <> 'REJECTED'
        AND "rejected_by_user_id" IS NULL
        AND "rejected_at" IS NULL
        AND "rejection_reason" IS NULL)
      OR
      ("state" = 'REJECTED'
        AND "rejected_by_user_id" IS NOT NULL
        AND "rejected_at" IS NOT NULL
        AND "rejection_reason" IS NOT NULL
        AND length(btrim("rejection_reason")) > 0
        AND "decided_at" IS NOT NULL)
    );

CREATE OR REPLACE FUNCTION protect_v05b_agreement()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Agreement history cannot be deleted';
  END IF;

  IF OLD."approval_state" <> 'DRAFT' AND (
    NEW."original_value" <> OLD."original_value"
    OR NEW."scope_of_work" <> OLD."scope_of_work"
    OR NEW."currency_code" <> OLD."currency_code"
    OR NEW."retention_rate" <> OLD."retention_rate"
    OR NEW."retention_cap" IS DISTINCT FROM OLD."retention_cap"
  ) THEN
    RAISE EXCEPTION 'Submitted agreement commercial fields are immutable';
  END IF;

  IF OLD."first_approved_at" IS NOT NULL
    AND NEW."first_approved_at" IS DISTINCT FROM OLD."first_approved_at"
  THEN
    RAISE EXCEPTION 'First approval timestamp is immutable';
  END IF;

  IF OLD."approval_state" = 'CANCELLED' AND NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Cancelled agreement is immutable';
  END IF;

  IF NEW."approval_state" <> OLD."approval_state" AND NOT (
    (OLD."approval_state" = 'DRAFT' AND NEW."approval_state" = 'SUBMITTED')
    OR (
      OLD."approval_state" = 'SUBMITTED'
      AND NEW."approval_state" IN ('APPROVED','REJECTED')
    )
    OR (
      OLD."approval_state" = 'APPROVED'
      AND NEW."approval_state" = 'CANCELLED'
    )
  ) THEN
    RAISE EXCEPTION 'Invalid agreement lifecycle transition';
  END IF;

  IF NEW."approval_state" = 'CANCELLED'
    AND EXISTS (
      SELECT 1
      FROM "subcontract_certifications"
      WHERE "agreement_id" = NEW."id"
        AND "state" = 'APPROVED'
    )
  THEN
    RAISE EXCEPTION 'Agreement with approved Certification cannot be cancelled';
  END IF;

  RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION protect_v05b_version()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Agreement version history cannot be deleted';
  END IF;

  IF NEW."id" <> OLD."id"
    OR NEW."company_id" <> OLD."company_id"
    OR NEW."project_id" <> OLD."project_id"
    OR NEW."agreement_id" <> OLD."agreement_id"
    OR NEW."version_no" <> OLD."version_no"
    OR NEW."created_by_user_id" <> OLD."created_by_user_id"
    OR NEW."created_at" <> OLD."created_at"
    OR NEW."original_value" <> OLD."original_value"
    OR NEW."scope_of_work" <> OLD."scope_of_work"
    OR NEW."currency_code" <> OLD."currency_code"
    OR NEW."retention_rate" <> OLD."retention_rate"
    OR NEW."retention_cap" IS DISTINCT FROM OLD."retention_cap"
  THEN
    RAISE EXCEPTION 'Agreement version identity and commercial snapshot are immutable';
  END IF;

  IF OLD."approval_state" <> 'DRAFT' AND (
    NEW."operational_status_id" IS DISTINCT FROM OLD."operational_status_id"
    OR NEW."reason" IS DISTINCT FROM OLD."reason"
    OR NEW."approval_instance_id" IS DISTINCT FROM OLD."approval_instance_id"
    OR NEW."submitted_at" IS DISTINCT FROM OLD."submitted_at"
    OR NEW."submitted_by_user_id" IS DISTINCT FROM OLD."submitted_by_user_id"
  ) THEN
    RAISE EXCEPTION 'Submitted agreement version is immutable';
  END IF;

  IF OLD."approval_state" IN ('APPROVED','REJECTED')
    AND NEW IS DISTINCT FROM OLD
  THEN
    RAISE EXCEPTION 'Decided agreement version is immutable';
  END IF;

  IF NEW."approval_state" <> OLD."approval_state" AND NOT (
    (OLD."approval_state" = 'DRAFT' AND NEW."approval_state" = 'SUBMITTED')
    OR (
      OLD."approval_state" = 'SUBMITTED'
      AND NEW."approval_state" IN ('APPROVED','REJECTED')
    )
  ) THEN
    RAISE EXCEPTION 'Invalid agreement version transition';
  END IF;

  RETURN NEW;
END $$;

CREATE FUNCTION protect_v05d_certification()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'INSERT' THEN
    IF NEW."state" <> 'DRAFT' THEN
      RAISE EXCEPTION 'Certification must be created as Draft';
    END IF;
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Certification history cannot be deleted';
  END IF;

  IF NEW."id" <> OLD."id"
    OR NEW."company_id" <> OLD."company_id"
    OR NEW."project_id" <> OLD."project_id"
    OR NEW."agreement_id" <> OLD."agreement_id"
    OR NEW."claim_id" <> OLD."claim_id"
    OR NEW."assessment_id" <> OLD."assessment_id"
    OR NEW."certification_number" <> OLD."certification_number"
    OR NEW."currency_code" <> OLD."currency_code"
    OR NEW."created_by_user_id" <> OLD."created_by_user_id"
    OR NEW."created_at" <> OLD."created_at"
  THEN
    RAISE EXCEPTION 'Certification identity and source references are immutable';
  END IF;

  IF OLD."state" <> 'DRAFT' AND (
    NEW."certified_gross" <> OLD."certified_gross"
    OR NEW."approval_instance_id" IS DISTINCT FROM OLD."approval_instance_id"
    OR NEW."submitted_by_user_id" IS DISTINCT FROM OLD."submitted_by_user_id"
    OR NEW."submitted_at" IS DISTINCT FROM OLD."submitted_at"
  ) THEN
    RAISE EXCEPTION 'Submitted Certification source fields are immutable';
  END IF;

  IF OLD."approved_at" IS NOT NULL AND (
    NEW."assessed_amount_snapshot" IS DISTINCT FROM OLD."assessed_amount_snapshot"
    OR NEW."retention_rate_snapshot" IS DISTINCT FROM OLD."retention_rate_snapshot"
    OR NEW."retention_cap_snapshot" IS DISTINCT FROM OLD."retention_cap_snapshot"
    OR NEW."retained_before_snapshot" IS DISTINCT FROM OLD."retained_before_snapshot"
    OR NEW."retained_amount" IS DISTINCT FROM OLD."retained_amount"
    OR NEW."net_certified_amount" IS DISTINCT FROM OLD."net_certified_amount"
    OR NEW."approved_by_user_id" IS DISTINCT FROM OLD."approved_by_user_id"
    OR NEW."approved_at" IS DISTINCT FROM OLD."approved_at"
    OR NEW."decided_at" IS DISTINCT FROM OLD."decided_at"
  ) THEN
    RAISE EXCEPTION 'Approved Certification decision snapshot is immutable';
  END IF;

  IF OLD."state" IN ('REJECTED','REVERSED')
    AND NEW IS DISTINCT FROM OLD
  THEN
    RAISE EXCEPTION 'Decided Certification history is immutable';
  END IF;

  IF OLD."rejected_at" IS NOT NULL AND (
    NEW."rejected_by_user_id" IS DISTINCT FROM OLD."rejected_by_user_id"
    OR NEW."rejected_at" IS DISTINCT FROM OLD."rejected_at"
    OR NEW."rejection_reason" IS DISTINCT FROM OLD."rejection_reason"
  ) THEN
    RAISE EXCEPTION 'Certification rejection evidence is immutable';
  END IF;

  IF OLD."reversed_at" IS NOT NULL AND (
    NEW."reversed_by_user_id" IS DISTINCT FROM OLD."reversed_by_user_id"
    OR NEW."reversed_at" IS DISTINCT FROM OLD."reversed_at"
    OR NEW."reversal_reason" IS DISTINCT FROM OLD."reversal_reason"
  ) THEN
    RAISE EXCEPTION 'Certification reversal evidence is immutable';
  END IF;

  IF NEW."state" <> OLD."state" AND NOT (
    (OLD."state" = 'DRAFT' AND NEW."state" = 'SUBMITTED')
    OR (
      OLD."state" = 'SUBMITTED'
      AND NEW."state" IN ('APPROVED','REJECTED')
    )
    OR (OLD."state" = 'APPROVED' AND NEW."state" = 'REVERSED')
  ) THEN
    RAISE EXCEPTION 'Invalid Certification lifecycle transition';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER subcontract_certifications_guard
BEFORE INSERT OR UPDATE OR DELETE ON "subcontract_certifications"
FOR EACH ROW EXECUTE FUNCTION protect_v05d_certification();

CREATE FUNCTION check_v05d_certification_consistency()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  agreement_state VARCHAR(30);
  agreement_cancelled_at TIMESTAMPTZ;
  agreement_currency VARCHAR(3);
  agreement_ceiling NUMERIC(18,2);
  agreement_rate NUMERIC(5,2);
  agreement_cap NUMERIC(18,2);
  claim_state VARCHAR(30);
  claim_currency VARCHAR(3);
  assessment_state VARCHAR(30);
  assessment_amount NUMERIC(18,2);
  approval_state VARCHAR(30);
  approval_entity_type VARCHAR(100);
  approval_entity_id UUID;
  prior_decision_exists BOOLEAN;
  prior_gross NUMERIC(18,2);
  prior_retention NUMERIC(18,2);
  raw_retention NUMERIC(18,2);
  expected_retention NUMERIC(18,2);
  remaining_cap NUMERIC(18,2);
BEGIN
  PERFORM pg_advisory_xact_lock(
    hashtext('v05d-cert-company:' || NEW."company_id"::text),
    hashtext('v05d-cert-agreement:' || NEW."agreement_id"::text)
  );

  SELECT "approval_state", "cancelled_at", "currency_code",
         "original_value", "retention_rate", "retention_cap"
    INTO agreement_state, agreement_cancelled_at, agreement_currency,
         agreement_ceiling, agreement_rate, agreement_cap
    FROM "subcontract_agreements"
    WHERE "id" = NEW."agreement_id"
      AND "company_id" = NEW."company_id"
      AND "project_id" = NEW."project_id";

  IF agreement_state IS NULL THEN
    RAISE EXCEPTION 'Certification requires same-scope Agreement';
  END IF;

  SELECT c."state", c."currency_code",
         a."state", a."assessed_amount"
    INTO claim_state, claim_currency, assessment_state, assessment_amount
    FROM "subcontract_claims" c
    JOIN "subcontract_claim_assessments" a
      ON a."company_id" = c."company_id"
     AND a."project_id" = c."project_id"
     AND a."agreement_id" = c."agreement_id"
     AND a."claim_id" = c."id"
    WHERE c."id" = NEW."claim_id"
      AND c."company_id" = NEW."company_id"
      AND c."project_id" = NEW."project_id"
      AND c."agreement_id" = NEW."agreement_id"
      AND a."id" = NEW."assessment_id";

  IF claim_state IS NULL THEN
    RAISE EXCEPTION 'Certification requires same-scope Claim and Assessment';
  END IF;

  IF NEW."currency_code" <> agreement_currency
    OR NEW."currency_code" <> claim_currency
  THEN
    RAISE EXCEPTION 'Certification currency must inherit Agreement currency';
  END IF;

  IF NEW."certified_gross" < 0
    OR NEW."certified_gross" > assessment_amount
  THEN
    RAISE EXCEPTION 'Certified gross must be within retained assessed amount';
  END IF;

  IF NEW."state" IN ('DRAFT','SUBMITTED','APPROVED') AND (
    agreement_state <> 'APPROVED'
    OR agreement_cancelled_at IS NOT NULL
    OR claim_state <> 'ASSESSED'
    OR assessment_state <> 'ASSESSED'
  ) THEN
    RAISE EXCEPTION 'Active Certification requires approved Agreement and active assessed Claim';
  END IF;

  IF NEW."state" = 'REVERSED' AND (
    assessment_state <> 'ASSESSED'
    OR claim_state NOT IN ('ASSESSED','REPLACED')
  ) THEN
    RAISE EXCEPTION 'Reversed Certification requires retained assessed source history';
  END IF;

  IF NEW."state" IN ('DRAFT','SUBMITTED','APPROVED') THEN
    SELECT EXISTS (
      SELECT 1
      FROM "subcontract_certifications" prior
      WHERE prior."company_id" = NEW."company_id"
        AND prior."claim_id" = NEW."claim_id"
        AND prior."id" <> NEW."id"
        AND prior."state" IN ('APPROVED','REVERSED')
    ) INTO prior_decision_exists;

    IF prior_decision_exists THEN
      RAISE EXCEPTION 'Certification correction requires linked replacement Claim';
    END IF;
  END IF;

  IF NEW."state" = 'DRAFT' THEN
    IF NEW."approval_instance_id" IS NOT NULL
      OR NEW."assessed_amount_snapshot" IS NOT NULL
      OR NEW."retention_rate_snapshot" IS NOT NULL
      OR NEW."retention_cap_snapshot" IS NOT NULL
      OR NEW."retained_before_snapshot" IS NOT NULL
      OR NEW."retained_amount" IS NOT NULL
      OR NEW."net_certified_amount" IS NOT NULL
      OR NEW."decided_at" IS NOT NULL
    THEN
      RAISE EXCEPTION 'Draft Certification cannot carry approval decision snapshots';
    END IF;
    RETURN NEW;
  END IF;

  SELECT "approval_state", "entity_type", "entity_id"
    INTO approval_state, approval_entity_type, approval_entity_id
    FROM "approval_instances"
    WHERE "id" = NEW."approval_instance_id"
      AND "company_id" = NEW."company_id";

  IF approval_state IS NULL
    OR approval_entity_type <> 'SUBCONTRACT_CERTIFICATION'
    OR approval_entity_id <> NEW."id"
  THEN
    RAISE EXCEPTION 'Certification approval instance does not match Certification';
  END IF;

  IF NEW."state" = 'SUBMITTED' AND approval_state <> 'SUBMITTED' THEN
    RAISE EXCEPTION 'Submitted Certification requires submitted approval instance';
  ELSIF NEW."state" = 'REJECTED' AND approval_state <> 'REJECTED' THEN
    RAISE EXCEPTION 'Rejected Certification requires rejected approval instance';
  ELSIF NEW."state" IN ('APPROVED','REVERSED')
    AND approval_state <> 'APPROVED'
  THEN
    RAISE EXCEPTION 'Approved Certification requires approved approval instance';
  END IF;

  IF NEW."state" IN ('SUBMITTED','REJECTED') AND (
    NEW."assessed_amount_snapshot" IS NOT NULL
    OR NEW."retention_rate_snapshot" IS NOT NULL
    OR NEW."retention_cap_snapshot" IS NOT NULL
    OR NEW."retained_before_snapshot" IS NOT NULL
    OR NEW."retained_amount" IS NOT NULL
    OR NEW."net_certified_amount" IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Certification snapshots are created only on final approval';
  END IF;

  IF NEW."state" = 'APPROVED'
    AND (TG_OP = 'INSERT' OR OLD."state" IS DISTINCT FROM 'APPROVED')
  THEN
    IF NEW."assessed_amount_snapshot" <> assessment_amount
      OR NEW."retention_rate_snapshot" <> agreement_rate
      OR NEW."retention_cap_snapshot" IS DISTINCT FROM agreement_cap
    THEN
      RAISE EXCEPTION 'Certification approval snapshots must match retained sources';
    END IF;

    SELECT COALESCE(SUM("certified_gross"), 0)
      INTO prior_gross
      FROM "subcontract_certifications"
      WHERE "company_id" = NEW."company_id"
        AND "agreement_id" = NEW."agreement_id"
        AND "state" = 'APPROVED'
        AND "id" <> NEW."id";

    IF prior_gross + NEW."certified_gross" > agreement_ceiling THEN
      RAISE EXCEPTION 'Approved Certification exceeds Agreement ceiling';
    END IF;

    SELECT COALESCE(SUM("retained_amount"), 0)
      INTO prior_retention
      FROM "subcontract_certifications"
      WHERE "company_id" = NEW."company_id"
        AND "agreement_id" = NEW."agreement_id"
        AND "state" = 'APPROVED'
        AND "id" <> NEW."id";

    IF NEW."retained_before_snapshot" <> prior_retention THEN
      RAISE EXCEPTION 'Certification retained-before snapshot is inconsistent';
    END IF;

    raw_retention :=
      round((NEW."certified_gross" * agreement_rate / 100)::numeric, 2);

    IF agreement_cap IS NULL THEN
      expected_retention := raw_retention;
    ELSE
      remaining_cap := GREATEST(agreement_cap - prior_retention, 0);
      expected_retention := LEAST(raw_retention, remaining_cap);
    END IF;

    expected_retention := LEAST(expected_retention, NEW."certified_gross");

    IF NEW."retained_amount" <> expected_retention
      OR NEW."net_certified_amount"
        <> NEW."certified_gross" - expected_retention
    THEN
      RAISE EXCEPTION 'Certification retention arithmetic is inconsistent';
    END IF;
  END IF;

  RETURN NEW;
END $$;

CREATE CONSTRAINT TRIGGER subcontract_certification_consistency
AFTER INSERT OR UPDATE ON "subcontract_certifications"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_v05d_certification_consistency();
