-- V0.5-C forward-only replacement-lineage trigger coverage hardening.
-- The existing deferred replacement consistency function already validates exact
-- predecessor periods. Recreate its trigger so direct period/link edits invoke
-- that validation as well as inserts/state transitions.
-- Previously executed Stage-C migrations remain byte-for-byte unchanged.

DROP TRIGGER IF EXISTS subcontract_claim_replacement_consistency
  ON "subcontract_claims";

CREATE CONSTRAINT TRIGGER subcontract_claim_replacement_consistency
AFTER INSERT OR UPDATE OF
  "state",
  "period_start",
  "period_end",
  "replacement_for_claim_id"
ON "subcontract_claims"
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION check_v05c_claim_replacement_consistency();
