-- Bind the same Document row locks used by metadata and link mutations.
-- A source cannot freeze a pre-archive snapshot while an archive is in flight.
CREATE FUNCTION erp_physical_submission_evidence_lock() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM d.id FROM documents d WHERE d.id IN (
   SELECT value::uuid FROM subcontract_physical_revisions r
   CROSS JOIN LATERAL jsonb_array_elements(r.observations) o
   CROSS JOIN LATERAL jsonb_array_elements_text(o->'documentIds') value
   WHERE r.id=NEW.revision_id AND r.claim_id=NEW.claim_id
 ) ORDER BY d.id FOR UPDATE;
 RETURN NEW;
END $$;
CREATE TRIGGER physical_submission_evidence_lock BEFORE INSERT ON subcontract_physical_submissions
 FOR EACH ROW EXECUTE FUNCTION erp_physical_submission_evidence_lock();

-- Re-read committed metadata after any row-lock wait, rather than the enclosing
-- INSERT's earlier statement snapshot. The function does not modify data.
ALTER FUNCTION erp_physical_evidence(uuid,uuid) VOLATILE;

CREATE OR REPLACE FUNCTION erp_physical_evidence_link_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE doc uuid; previous_doc uuid;
BEGIN
 doc:=CASE WHEN TG_OP='DELETE' THEN OLD.document_id ELSE NEW.document_id END;
 previous_doc:=CASE WHEN TG_OP='UPDATE' THEN OLD.document_id ELSE doc END;
 PERFORM d.id FROM documents d WHERE d.id=ANY(ARRAY[doc,previous_doc]) ORDER BY d.id FOR UPDATE;
 IF EXISTS(SELECT 1 FROM subcontract_physical_submissions s CROSS JOIN LATERAL jsonb_array_elements(s.evidence) e WHERE e->>'id'=doc::text) OR
   (TG_OP<>'DELETE' AND NEW.entity_type='SUBCONTRACT_CLAIM' AND EXISTS(SELECT 1 FROM subcontract_physical_submissions WHERE claim_id=NEW.entity_id)) OR
   (TG_OP='UPDATE' AND EXISTS(SELECT 1 FROM subcontract_physical_submissions s CROSS JOIN LATERAL jsonb_array_elements(s.evidence) e WHERE e->>'id'=OLD.document_id::text)) THEN
   RAISE EXCEPTION 'PHYSICAL_EVIDENCE_FROZEN';
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF; RETURN NEW;
END $$;
