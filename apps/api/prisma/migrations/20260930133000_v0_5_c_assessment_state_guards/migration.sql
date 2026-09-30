-- V0.5-C forward-only lifecycle hardening: Claim assessment states must
-- correspond to retained Assessment evidence. Preserve executed migrations.
--
-- The service creates/updates Assessment evidence before advancing Claim
-- state in the same transaction. Enforce that ordering for direct SQL and
-- future application paths as well.
CREATE FUNCTION require_v05c_claim_assessment_state() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE current_assessment_state VARCHAR(30);
BEGIN
  IF (OLD."state" = 'SUBMITTED' AND NEW."state" = 'ASSESSED')
    OR (OLD."state" = 'ASSESSED' AND NEW."state" = 'REJECTED')
  THEN
    SELECT "state" INTO current_assessment_state
      FROM "subcontract_claim_assessments"
      WHERE "claim_id" = NEW."id"
      FOR SHARE;

    IF (NEW."state" = 'ASSESSED' AND current_assessment_state IS DISTINCT FROM 'ASSESSED')
      OR (NEW."state" = 'REJECTED' AND current_assessment_state IS DISTINCT FROM 'REJECTED')
    THEN
      RAISE EXCEPTION 'Claim state transition requires matching Assessment evidence';
    END IF;
  END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER subcontract_claims_assessment_state_guard
BEFORE UPDATE OF "state" ON "subcontract_claims"
FOR EACH ROW EXECUTE FUNCTION require_v05c_claim_assessment_state();

-- Serialize direct Assessment mutations with Claim state transitions.
-- A deferred consistency check rejects standalone Assessment writes that
-- otherwise leave contradictory committed state after a valid Claim change.
CREATE FUNCTION lock_v05c_assessment_claim() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  PERFORM 1 FROM "subcontract_claims" WHERE "id" = NEW."claim_id" FOR UPDATE;
  IF NOT FOUND THEN RAISE EXCEPTION 'Assessment parent Claim does not exist'; END IF;
  RETURN NEW;
END $$;

CREATE TRIGGER subcontract_claim_assessment_parent_lock
BEFORE INSERT OR UPDATE OF "state" ON "subcontract_claim_assessments"
FOR EACH ROW EXECUTE FUNCTION lock_v05c_assessment_claim();

CREATE FUNCTION check_v05c_assessment_claim_consistency() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent_state VARCHAR(30);
DECLARE parent_withdrawn_at TIMESTAMPTZ;
BEGIN
  SELECT "state", "withdrawn_at" INTO parent_state, parent_withdrawn_at
    FROM "subcontract_claims" WHERE "id" = NEW."claim_id";
  IF NOT (
    (NEW."state" = 'ASSESSED' AND parent_state = 'ASSESSED')
    OR (NEW."state" = 'REJECTED' AND parent_state = 'REJECTED')
    OR (NEW."state" = 'REJECTED' AND parent_state = 'REPLACED'
        AND parent_withdrawn_at IS NULL)
  ) THEN
    RAISE EXCEPTION 'Assessment state requires matching committed Claim state';
  END IF;
  RETURN NEW;
END $$;

CREATE CONSTRAINT TRIGGER subcontract_assessment_claim_consistency
AFTER INSERT OR UPDATE OF "state" ON "subcontract_claim_assessments"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_v05c_assessment_claim_consistency();
