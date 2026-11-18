-- Draft commercial editing may remove a line after its physical capture.
-- Both directions of the current line/observation mapping must hold at freeze.
CREATE FUNCTION erp_physical_submission_line_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (
   SELECT 1 FROM subcontract_physical_revisions r
   CROSS JOIN LATERAL jsonb_array_elements(r.observations) o
   WHERE r.id=NEW.revision_id AND r.claim_id=NEW.claim_id AND NOT EXISTS (
     SELECT 1 FROM subcontract_claim_lines l WHERE l.claim_id=NEW.claim_id AND l.id::text=o->>'claimLineId'
   )
 ) THEN RAISE EXCEPTION 'PHYSICAL_OBSERVATION_INVALID'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER physical_submission_line_guard BEFORE INSERT ON subcontract_physical_submissions
 FOR EACH ROW EXECUTE FUNCTION erp_physical_submission_line_guard();
