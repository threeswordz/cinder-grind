-- V0.5-C forward-only correction-lineage and Assessment amount hardening.
-- Reject unrelated active Claims for an exact period that already has retained
-- terminal Claim history, and enforce the retained Claim-total Assessment bound
-- below the service layer. Previously executed migrations remain unchanged.

CREATE OR REPLACE FUNCTION check_v05c_claim_replacement_consistency()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  predecessor_state VARCHAR(30);
  predecessor_period_start DATE;
  predecessor_period_end DATE;
  successor_id UUID;
  successor_state VARCHAR(30);
BEGIN
  IF EXISTS (
    SELECT 1
      FROM "subcontract_claims" AS current_claim
      JOIN "subcontract_claims" AS terminal_claim
        ON terminal_claim."company_id" = current_claim."company_id"
       AND terminal_claim."project_id" = current_claim."project_id"
       AND terminal_claim."agreement_id" = current_claim."agreement_id"
       AND terminal_claim."period_start" = current_claim."period_start"
       AND terminal_claim."period_end" = current_claim."period_end"
       AND terminal_claim."id" <> current_claim."id"
       AND terminal_claim."state" IN ('WITHDRAWN','REJECTED','REPLACED')
      WHERE current_claim."id" = NEW."id"
        AND current_claim."state" IN ('DRAFT','SUBMITTED','ASSESSED')
        AND current_claim."replacement_for_claim_id" IS NULL
  ) THEN
    RAISE EXCEPTION 'Active Claim for retained terminal period requires linked replacement';
  END IF;

  IF NEW."replacement_for_claim_id" IS NOT NULL THEN
    SELECT "state", "period_start", "period_end"
      INTO predecessor_state, predecessor_period_start, predecessor_period_end
      FROM "subcontract_claims"
      WHERE "id" = NEW."replacement_for_claim_id";

    IF NEW."period_start" IS DISTINCT FROM predecessor_period_start
      OR NEW."period_end" IS DISTINCT FROM predecessor_period_end
    THEN
      RAISE EXCEPTION 'Linked replacement must retain predecessor period';
    END IF;

    IF NEW."state" = 'DRAFT'
      AND predecessor_state NOT IN ('WITHDRAWN','REJECTED')
    THEN
      RAISE EXCEPTION 'Draft replacement requires withdrawn or rejected predecessor';
    ELSIF NEW."state" <> 'DRAFT' AND predecessor_state IS DISTINCT FROM 'REPLACED' THEN
      RAISE EXCEPTION 'Submitted replacement requires predecessor to be REPLACED';
    END IF;
  END IF;

  SELECT "id", "state" INTO successor_id, successor_state
    FROM "subcontract_claims"
    WHERE "replacement_for_claim_id" = NEW."id";

  IF NEW."state" = 'REPLACED' THEN
    IF successor_id IS NULL OR successor_state = 'DRAFT' THEN
      RAISE EXCEPTION 'REPLACED Claim requires a submitted linked replacement';
    END IF;
  ELSIF successor_id IS NOT NULL THEN
    IF successor_state <> 'DRAFT' THEN
      RAISE EXCEPTION 'Non-REPLACED Claim cannot have a submitted linked replacement';
    ELSIF NEW."state" NOT IN ('WITHDRAWN','REJECTED') THEN
      RAISE EXCEPTION 'Draft replacement requires terminal predecessor';
    END IF;
  END IF;

  RETURN NEW;
END $$;

CREATE FUNCTION check_v05c_assessment_amount_bound()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  retained_claim_total NUMERIC(18,2);
BEGIN
  PERFORM 1
    FROM "subcontract_claims"
    WHERE "id" = NEW."claim_id"
    FOR UPDATE;
  IF NOT FOUND THEN
    RAISE EXCEPTION 'Assessment parent Claim does not exist';
  END IF;

  SELECT COALESCE(SUM("amount"), 0)
    INTO retained_claim_total
    FROM "subcontract_claim_lines"
    WHERE "company_id" = NEW."company_id"
      AND "project_id" = NEW."project_id"
      AND "agreement_id" = NEW."agreement_id"
      AND "claim_id" = NEW."claim_id";

  IF NEW."assessed_amount" > retained_claim_total THEN
    RAISE EXCEPTION 'Assessment amount cannot exceed retained Claim total';
  END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER subcontract_claim_assessment_amount_guard
BEFORE INSERT OR UPDATE OF "assessed_amount", "claim_id"
ON "subcontract_claim_assessments"
FOR EACH ROW EXECUTE FUNCTION check_v05c_assessment_amount_bound();
