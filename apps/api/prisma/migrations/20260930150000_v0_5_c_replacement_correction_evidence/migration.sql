-- V0.5-C forward-only replacement correction-evidence hardening.
-- Every REPLACED Claim must retain exactly one approved correction path:
-- complete withdrawal evidence with no Assessment, or a rejected Assessment
-- with no withdrawal evidence. Preserve all already-executed migrations.

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
  ELSIF NEW."state" = 'REPLACED' THEN
    IF assessment_state = 'REJECTED' THEN
      IF NEW."withdrawn_at" IS NOT NULL
        OR NEW."withdrawn_by_user_id" IS NOT NULL
        OR NEW."withdrawal_reason" IS NOT NULL
      THEN
        RAISE EXCEPTION 'Rejected Claim replacement cannot carry withdrawal evidence';
      END IF;
    ELSIF assessment_state IS NULL THEN
      IF NEW."withdrawn_at" IS NULL
        OR NEW."withdrawn_by_user_id" IS NULL
        OR NEW."withdrawal_reason" IS NULL
        OR length(btrim(NEW."withdrawal_reason")) = 0
      THEN
        RAISE EXCEPTION 'REPLACED Claim requires withdrawal or rejected Assessment evidence';
      END IF;
    ELSE
      RAISE EXCEPTION 'Replaced assessed Claim requires rejected Assessment evidence';
    END IF;
  END IF;

  RETURN NEW;
END $$;
