-- V0.5-D forward-only fix for PostgreSQL PL/pgSQL name resolution.
-- The prior integrity migration remains unchanged; replace only the trigger
-- function implementation so local variables cannot shadow table columns.

CREATE OR REPLACE FUNCTION check_v05d_certification_consistency()
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
  approval_instance_state VARCHAR(30);
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

  SELECT agreement."approval_state", agreement."cancelled_at",
         agreement."currency_code", agreement."original_value",
         agreement."retention_rate", agreement."retention_cap"
    INTO agreement_state, agreement_cancelled_at, agreement_currency,
         agreement_ceiling, agreement_rate, agreement_cap
    FROM "subcontract_agreements" agreement
    WHERE agreement."id" = NEW."agreement_id"
      AND agreement."company_id" = NEW."company_id"
      AND agreement."project_id" = NEW."project_id";

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

  SELECT approval."approval_state", approval."entity_type", approval."entity_id"
    INTO approval_instance_state, approval_entity_type, approval_entity_id
    FROM "approval_instances" approval
    WHERE approval."id" = NEW."approval_instance_id"
      AND approval."company_id" = NEW."company_id";

  IF approval_instance_state IS NULL
    OR approval_entity_type <> 'SUBCONTRACT_CERTIFICATION'
    OR approval_entity_id <> NEW."id"
  THEN
    RAISE EXCEPTION 'Certification approval instance does not match Certification';
  END IF;

  IF NEW."state" = 'SUBMITTED' AND approval_instance_state <> 'SUBMITTED' THEN
    RAISE EXCEPTION 'Submitted Certification requires submitted approval instance';
  ELSIF NEW."state" = 'REJECTED' AND approval_instance_state <> 'REJECTED' THEN
    RAISE EXCEPTION 'Rejected Certification requires rejected approval instance';
  ELSIF NEW."state" IN ('APPROVED','REVERSED')
    AND approval_instance_state <> 'APPROVED'
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
