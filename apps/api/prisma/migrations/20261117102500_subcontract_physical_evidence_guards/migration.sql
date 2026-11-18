-- Forward-only correction: qualify the evidence scalar; preserve the first exercised migration checksum.
CREATE OR REPLACE FUNCTION erp_physical_evidence(p_claim uuid,p_revision uuid) RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE evidence_ids uuid[]; result jsonb; c subcontract_claims%ROWTYPE;
BEGIN
 SELECT * INTO STRICT c FROM subcontract_claims WHERE id=p_claim;
 SELECT array_agg(DISTINCT evidence_id.value::uuid) INTO evidence_ids FROM subcontract_physical_revisions r
   CROSS JOIN LATERAL jsonb_array_elements(r.observations) o
   CROSS JOIN LATERAL jsonb_array_elements_text(o->'documentIds') AS evidence_id(value) WHERE r.id=p_revision AND r.claim_id=p_claim;
 IF coalesce(array_length(evidence_ids,1),0)=0 OR EXISTS(
   SELECT 1 FROM unnest(evidence_ids) id LEFT JOIN documents d ON d.id=id
   LEFT JOIN document_types t ON t.id=d.document_type_id
   WHERE d.id IS NULL OR d.company_id<>c.company_id OR NOT d.is_active OR d.checksum IS NULL OR d.checksum!~'^[a-f0-9]{64}$' OR t.document_type_code LIKE 'HR\_%' OR
     EXISTS(SELECT 1 FROM hr_document_attachments WHERE document_id=d.id) OR
     NOT EXISTS(SELECT 1 FROM document_links WHERE document_id=d.id AND entity_type='SUBCONTRACT_CLAIM' AND entity_id=c.id) OR
     NOT EXISTS(SELECT 1 FROM document_links WHERE document_id=d.id AND entity_type='PROJECT' AND entity_id=c.project_id)) THEN
   RAISE EXCEPTION 'PHYSICAL_EVIDENCE_REQUIRED';
 END IF;
 SELECT jsonb_agg(jsonb_build_object('id',id,'checksum',checksum,'size',file_size_bytes,'fileName',file_name,'mimeType',mime_type) ORDER BY id)
   INTO result FROM documents WHERE id=ANY(evidence_ids);
 RETURN result;
END $$;

CREATE FUNCTION erp_physical_revision_commit() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.version>1 AND NOT EXISTS(SELECT 1 FROM subcontract_physical_revisions WHERE claim_id=NEW.claim_id AND version=NEW.version) THEN
   RAISE EXCEPTION 'PHYSICAL_CURRENT_REVISION_REQUIRED';
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER physical_revision_commit AFTER INSERT OR UPDATE ON subcontract_physical_claims
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_physical_revision_commit();

CREATE FUNCTION erp_physical_operation_insert() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.action='ENABLE' THEN
   IF NEW.claim_id IS NOT NULL OR NOT erp_physical_actor(NEW.actor_user_id,NEW.company_id,'subcontracts.physical.configure') OR
      NEW.outcome->>'projectId' IS DISTINCT FROM NEW.project_id::text THEN RAISE EXCEPTION 'PHYSICAL_OPERATION_SCOPE_INVALID'; END IF;
 ELSE
   IF NOT erp_physical_actor(NEW.actor_user_id,NEW.company_id,'subcontracts.physical.edit') OR NOT EXISTS(
     SELECT 1 FROM subcontract_physical_claims WHERE claim_id=NEW.claim_id AND project_id=NEW.project_id AND company_id=NEW.company_id) OR
     NEW.outcome->>'claimId' IS DISTINCT FROM NEW.claim_id::text THEN RAISE EXCEPTION 'PHYSICAL_OPERATION_SCOPE_INVALID'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER physical_operation_insert BEFORE INSERT ON subcontract_physical_operations FOR EACH ROW EXECUTE FUNCTION erp_physical_operation_insert();

