-- V0.5-C forward-only hardening: submitted Claim source lines must reject direct inserts
-- as well as updates/deletes so retained Claim totals cannot be rewritten below the API.
DROP TRIGGER IF EXISTS "subcontract_claim_lines_guard" ON "subcontract_claim_lines";

CREATE OR REPLACE FUNCTION protect_v05c_claim_line() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  claim_state VARCHAR(30);
  parent_claim_id UUID;
BEGIN
  parent_claim_id := CASE
    WHEN TG_OP = 'DELETE' THEN OLD."claim_id"
    ELSE NEW."claim_id"
  END;

  SELECT "state"
    INTO claim_state
    FROM "subcontract_claims"
    WHERE "id" = parent_claim_id;

  IF claim_state IS DISTINCT FROM 'DRAFT' THEN
    RAISE EXCEPTION 'Submitted Claim lines are immutable';
  END IF;

  IF TG_OP = 'INSERT' THEN
    RETURN NEW;
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF NEW."id" <> OLD."id" OR NEW."company_id" <> OLD."company_id"
    OR NEW."project_id" <> OLD."project_id" OR NEW."agreement_id" <> OLD."agreement_id"
    OR NEW."claim_id" <> OLD."claim_id" OR NEW."line_no" <> OLD."line_no"
    OR NEW."created_at" <> OLD."created_at"
  THEN RAISE EXCEPTION 'Claim line identity is immutable'; END IF;

  RETURN NEW;
END $$;

CREATE TRIGGER "subcontract_claim_lines_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "subcontract_claim_lines"
FOR EACH ROW EXECUTE FUNCTION protect_v05c_claim_line();
