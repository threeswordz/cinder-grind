-- V0.5-C forward-only rejected-replacement evidence hardening.
-- A rejected Claim corrected through replacement must retain rejection history only;
-- withdrawal evidence belongs exclusively to the withdrawal correction path.
-- Previously executed Stage-C migrations remain byte-for-byte unchanged.

CREATE OR REPLACE FUNCTION check_v05c_claim_assessment_commit_consistency()
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
  ELSIF NEW."state" = 'REPLACED'
    AND assessment_state = 'REJECTED'
    AND (
      NEW."withdrawn_at" IS NOT NULL
      OR NEW."withdrawn_by_user_id" IS NOT NULL
      OR NEW."withdrawal_reason" IS NOT NULL
    )
  THEN
    RAISE EXCEPTION 'Rejected Claim replacement cannot carry withdrawal evidence';
  END IF;

  RETURN NEW;
END $$;
