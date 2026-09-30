-- V0.5-C forward-only replacement-period lineage hardening.
-- A linked replacement is a correction of the exact predecessor period and must
-- retain both predecessor period boundaries across direct SQL/future app paths.
-- Previously executed Stage-C migrations remain byte-for-byte unchanged.

CREATE OR REPLACE FUNCTION check_v05c_claim_replacement_consistency()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  predecessor_state VARCHAR(30);
  predecessor_period_start DATE;
  predecessor_period_end DATE;
  successor_id UUID;
  successor_state VARCHAR(30);
BEGIN
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
