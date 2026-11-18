-- Forward-only scalar qualification; preserve both prior exercised checksums.
CREATE OR REPLACE FUNCTION erp_physical_evidence(p_claim uuid,p_revision uuid) RETURNS jsonb LANGUAGE plpgsql STABLE AS $$
DECLARE evidence_ids uuid[]; result jsonb; c subcontract_claims%ROWTYPE;
BEGIN
 SELECT * INTO STRICT c FROM subcontract_claims WHERE id=p_claim;
 SELECT array_agg(DISTINCT evidence_id.value::uuid) INTO evidence_ids FROM subcontract_physical_revisions r
   CROSS JOIN LATERAL jsonb_array_elements(r.observations) o
   CROSS JOIN LATERAL jsonb_array_elements_text(o->'documentIds') AS evidence_id(value) WHERE r.id=p_revision AND r.claim_id=p_claim;
 IF coalesce(array_length(evidence_ids,1),0)=0 OR EXISTS(
   SELECT 1 FROM unnest(evidence_ids) AS wanted(id) LEFT JOIN documents d ON d.id=wanted.id
   LEFT JOIN document_types t ON t.id=d.document_type_id
   WHERE d.id IS NULL OR d.company_id<>c.company_id OR NOT d.is_active OR d.checksum IS NULL OR d.checksum!~'^[a-f0-9]{64}$' OR t.document_type_code LIKE 'HR\_%' OR
     EXISTS(SELECT 1 FROM hr_document_attachments WHERE document_id=d.id) OR
     NOT EXISTS(SELECT 1 FROM document_links WHERE document_id=d.id AND entity_type='SUBCONTRACT_CLAIM' AND entity_id=c.id) OR
     NOT EXISTS(SELECT 1 FROM document_links WHERE document_id=d.id AND entity_type='PROJECT' AND entity_id=c.project_id)) THEN
   RAISE EXCEPTION 'PHYSICAL_EVIDENCE_REQUIRED';
 END IF;
 SELECT jsonb_agg(jsonb_build_object('id',d.id,'checksum',d.checksum,'size',d.file_size_bytes,'fileName',d.file_name,'mimeType',d.mime_type) ORDER BY d.id)
   INTO result FROM documents d WHERE d.id=ANY(evidence_ids);
 RETURN result;
END $$;

