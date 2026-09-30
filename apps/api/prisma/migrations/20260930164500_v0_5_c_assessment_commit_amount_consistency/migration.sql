-- V0.5-C forward-only Assessment commit-bound hardening.
-- Revalidate assessed_amount against the final retained Claim-line total in the
-- existing deferred reciprocal Assessment/Claim consistency function so a
-- direct transaction cannot lower Draft lines after Assessment insertion.
-- Previously executed migrations remain byte-for-byte unchanged.

CREATE OR REPLACE FUNCTION check_v05c_assessment_claim_consistency()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  parent_state VARCHAR(30);
  parent_withdrawn_at TIMESTAMPTZ;
  retained_claim_total NUMERIC(18,2);
BEGIN
  SELECT "state", "withdrawn_at"
    INTO parent_state, parent_withdrawn_at
    FROM "subcontract_claims"
    WHERE "id" = NEW."claim_id";

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

  IF NOT (
    (NEW."state" = 'ASSESSED' AND parent_state = 'ASSESSED')
    OR (NEW."state" = 'REJECTED' AND parent_state = 'REJECTED')
    OR (
      NEW."state" = 'REJECTED'
      AND parent_state = 'REPLACED'
      AND parent_withdrawn_at IS NULL
    )
  ) THEN
    RAISE EXCEPTION 'Assessment state requires matching committed Claim state';
  END IF;

  RETURN NEW;
END $$;
