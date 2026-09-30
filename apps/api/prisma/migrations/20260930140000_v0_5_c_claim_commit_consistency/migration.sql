-- V0.5-C forward-only commit consistency hardening.
-- Validate reciprocal Claim/Assessment evidence for inserted Claim states and
-- reciprocal Claim replacement lineage for direct SQL/future application paths.
-- Previously executed Stage-C migrations remain byte-for-byte unchanged.

CREATE FUNCTION check_v05c_claim_assessment_commit_consistency()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  assessment_state VARCHAR(30);
BEGIN
  SELECT "state" INTO assessment_state
    FROM "subcontract_claim_assessments"
    WHERE "claim_id" = NEW."id";

  IF NEW."state" = 'ASSESSED' AND assessment_state IS DISTINCT FROM 'ASSESSED' THEN
    RAISE EXCEPTION 'ASSESSED Claim requires matching Assessment evidence';
  ELSIF NEW."state" = 'REJECTED' AND assessment_state IS DISTINCT FROM 'REJECTED' THEN
    RAISE EXCEPTION 'REJECTED Claim requires rejected Assessment evidence';
  ELSIF NEW."state" IN ('DRAFT','SUBMITTED','WITHDRAWN') AND assessment_state IS NOT NULL THEN
    RAISE EXCEPTION 'Claim state cannot retain Assessment evidence';
  ELSIF NEW."state" = 'REPLACED'
    AND assessment_state IS NOT NULL
    AND assessment_state <> 'REJECTED'
  THEN
    RAISE EXCEPTION 'Replaced assessed Claim requires rejected Assessment evidence';
  END IF;

  RETURN NEW;
END $$;

CREATE CONSTRAINT TRIGGER subcontract_claim_assessment_commit_consistency
AFTER INSERT OR UPDATE OF "state" ON "subcontract_claims"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_v05c_claim_assessment_commit_consistency();

CREATE FUNCTION check_v05c_claim_replacement_consistency()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  predecessor_state VARCHAR(30);
  successor_id UUID;
  successor_state VARCHAR(30);
BEGIN
  IF NEW."replacement_for_claim_id" IS NOT NULL THEN
    SELECT "state" INTO predecessor_state
      FROM "subcontract_claims"
      WHERE "id" = NEW."replacement_for_claim_id";

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

CREATE CONSTRAINT TRIGGER subcontract_claim_replacement_consistency
AFTER INSERT OR UPDATE OF "state" ON "subcontract_claims"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_v05c_claim_replacement_consistency();
