-- V0.5-E forward-only Variation consistency fix.
-- Do not edit the already-executed 20261001030000 foundation migration.
-- Qualify source columns and avoid a PL/pgSQL variable/column name collision.

CREATE OR REPLACE FUNCTION check_v05e_variation_consistency()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  agreement_state VARCHAR(30);
  agreement_cancelled_at TIMESTAMPTZ;
  agreement_currency VARCHAR(3);
  original_value NUMERIC(18,2);
  approval_instance_state VARCHAR(30);
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

  SELECT agreement."approval_state",
         agreement."cancelled_at",
         agreement."currency_code",
         agreement."original_value"
    INTO agreement_state,
         agreement_cancelled_at,
         agreement_currency,
         original_value
    FROM "subcontract_agreements" agreement
    WHERE agreement."id" = NEW."agreement_id"
      AND agreement."company_id" = NEW."company_id"
      AND agreement."project_id" = NEW."project_id";

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
    SELECT approval."approval_state",
           approval."entity_type",
           approval."entity_id"
      INTO approval_instance_state,
           approval_entity_type,
           approval_entity_id
      FROM "approval_instances" approval
      WHERE approval."id" = NEW."approval_instance_id"
        AND approval."company_id" = NEW."company_id";

    IF approval_instance_state IS NULL
      OR approval_entity_type <> 'SUBCONTRACT_VARIATION'
      OR approval_entity_id <> NEW."id"
    THEN
      RAISE EXCEPTION 'Variation approval instance does not match Variation';
    END IF;

    IF NEW."state" = 'SUBMITTED'
      AND approval_instance_state <> 'SUBMITTED'
    THEN
      RAISE EXCEPTION 'Submitted Variation requires submitted approval instance';
    ELSIF NEW."state" = 'REJECTED'
      AND approval_instance_state <> 'REJECTED'
    THEN
      RAISE EXCEPTION 'Rejected Variation requires rejected approval instance';
    ELSIF NEW."state" IN ('APPROVED','REVERSED')
      AND approval_instance_state <> 'APPROVED'
    THEN
      RAISE EXCEPTION 'Approved Variation requires approved approval instance';
    END IF;
  END IF;

  IF NEW."state" IN ('APPROVED','REVERSED') THEN
    SELECT COALESCE(SUM(variation."value_delta"),0)
      INTO variation_delta
      FROM "subcontract_variations" variation
      WHERE variation."company_id" = NEW."company_id"
        AND variation."agreement_id" = NEW."agreement_id"
        AND variation."state" = 'APPROVED';

    current_ceiling := original_value + variation_delta;

    SELECT COALESCE(SUM(work_order."amount"),0)
      INTO wo_floor
      FROM "subcontract_work_orders" work_order
      WHERE work_order."company_id" = NEW."company_id"
        AND work_order."agreement_id" = NEW."agreement_id"
        AND work_order."approval_state" = 'APPROVED';

    SELECT COALESCE(SUM(line."amount"),0)
      INTO claim_floor
      FROM "subcontract_claim_lines" line
      JOIN "subcontract_claims" claim ON claim."id" = line."claim_id"
      WHERE line."company_id" = NEW."company_id"
        AND line."agreement_id" = NEW."agreement_id"
        AND claim."state" IN ('SUBMITTED','ASSESSED');

    SELECT COALESCE(SUM(certification."certified_gross"),0)
      INTO cert_floor
      FROM "subcontract_certifications" certification
      WHERE certification."company_id" = NEW."company_id"
        AND certification."agreement_id" = NEW."agreement_id"
        AND certification."state" = 'APPROVED';

    protected_floor := GREATEST(0, wo_floor, claim_floor, cert_floor);
    IF current_ceiling < protected_floor THEN
      RAISE EXCEPTION 'Variation would reduce Agreement ceiling below protected downstream value';
    END IF;
  END IF;

  RETURN NEW;
END $$;
