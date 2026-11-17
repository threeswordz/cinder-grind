-- Qualify the text expansion independently of the observation's JSON value.
CREATE OR REPLACE FUNCTION erp_physical_submission_evidence_lock() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM d.id FROM documents d WHERE d.id IN (
   SELECT evidence_id.value::uuid FROM subcontract_physical_revisions r
   CROSS JOIN LATERAL jsonb_array_elements(r.observations) o
   CROSS JOIN LATERAL jsonb_array_elements_text(o->'documentIds') AS evidence_id(value)
   WHERE r.id=NEW.revision_id AND r.claim_id=NEW.claim_id
 ) ORDER BY d.id FOR UPDATE;
 RETURN NEW;
END $$;
