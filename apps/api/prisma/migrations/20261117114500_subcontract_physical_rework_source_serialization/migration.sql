-- Keep direct/future source correction and held-work reservation under the
-- same Agreement lock, and recheck the original submitted source on reuse.
CREATE FUNCTION erp_physical_assert_snapshot(p_claim uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE s subcontract_physical_submissions%ROWTYPE; r subcontract_physical_revisions%ROWTYPE; v integer;
BEGIN
 SELECT * INTO STRICT s FROM subcontract_physical_submissions WHERE claim_id=p_claim;
 SELECT * INTO STRICT r FROM subcontract_physical_revisions WHERE id=s.revision_id AND claim_id=p_claim;
 SELECT version INTO STRICT v FROM subcontract_physical_claims WHERE claim_id=p_claim;
 IF r.version<>v OR s.commercial_source IS DISTINCT FROM erp_physical_commercial_source(p_claim) OR
    s.evidence IS DISTINCT FROM erp_physical_evidence(p_claim,r.id) THEN RAISE EXCEPTION 'PHYSICAL_SOURCE_CHANGED'; END IF;
END $$;

CREATE OR REPLACE FUNCTION erp_physical_assert_source(p_claim uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE observations jsonb;
BEGIN
 PERFORM erp_physical_assert_snapshot(p_claim);
 SELECT r.observations INTO STRICT observations FROM subcontract_physical_submissions s
   JOIN subcontract_physical_revisions r ON r.id=s.revision_id WHERE s.claim_id=p_claim;
 PERFORM erp_physical_assert_rework(p_claim,observations);
END $$;

CREATE OR REPLACE FUNCTION erp_physical_assert_rework(p_claim uuid,p_observations jsonb) RETURNS void LANGUAGE plpgsql AS $$
DECLARE c subcontract_claims%ROWTYPE; o jsonb; original jsonb; original_decision jsonb; source_claim uuid; source_state text;
  reserved numeric; requested numeric; source_held numeric;
BEGIN
 SELECT * INTO STRICT c FROM subcontract_claims WHERE id=p_claim;
 PERFORM id FROM subcontract_agreements WHERE id=c.agreement_id FOR UPDATE;
 FOR o IN SELECT * FROM jsonb_array_elements(p_observations) WHERE value->>'heldSourceId' IS NOT NULL LOOP
   SELECT x,d,s.claim_id,sc.state INTO original,original_decision,source_claim,source_state
   FROM subcontract_physical_submissions s JOIN subcontract_physical_revisions r ON r.id=s.revision_id
   JOIN subcontract_physical_decisions pd ON pd.claim_id=s.claim_id JOIN subcontract_claims sc ON sc.id=s.claim_id
   CROSS JOIN LATERAL jsonb_array_elements(r.observations) x
   CROSS JOIN LATERAL jsonb_array_elements(pd.decisions) d
   WHERE x->>'id'=o->>'heldSourceId' AND d->>'observationId'=x->>'id' AND sc.agreement_id=c.agreement_id AND sc.id<>c.id;
   IF original IS NULL OR (source_state<>'ASSESSED' AND NOT EXISTS(
      WITH RECURSIVE ancestors(id) AS (
        SELECT replacement_for_claim_id FROM subcontract_claims WHERE id=c.id
        UNION SELECT sc.replacement_for_claim_id FROM subcontract_claims sc JOIN ancestors a ON sc.id=a.id WHERE sc.replacement_for_claim_id IS NOT NULL)
      SELECT 1 FROM ancestors WHERE id=source_claim)) OR
      (o->>'basis',o->>'item',o->>'location',o->>'basisDescription',o->>'uomId') IS DISTINCT FROM
      (original->>'basis',original->>'item',original->>'location',original->>'basisDescription',original->>'uomId') THEN
     RAISE EXCEPTION 'PHYSICAL_HELD_SOURCE_INVALID';
   END IF;
   PERFORM erp_physical_assert_snapshot(source_claim);
   IF o->>'basis'='MEASURED' THEN
     source_held:=(original_decision->>'heldQuantity')::numeric;
     SELECT coalesce(sum((x->>'quantity')::numeric),0) INTO reserved
       FROM subcontract_physical_submissions s JOIN subcontract_physical_revisions r ON r.id=s.revision_id
       JOIN subcontract_claims sc ON sc.id=s.claim_id CROSS JOIN LATERAL jsonb_array_elements(r.observations) x
       WHERE sc.agreement_id=c.agreement_id AND sc.id<>c.id AND sc.state IN('SUBMITTED','ASSESSED') AND x->>'heldSourceId'=o->>'heldSourceId';
     SELECT coalesce(sum((x->>'quantity')::numeric),0) INTO requested FROM jsonb_array_elements(p_observations) x WHERE x->>'heldSourceId'=o->>'heldSourceId';
     IF source_held IS NULL OR source_held<=0 OR reserved+requested>source_held THEN RAISE EXCEPTION 'PHYSICAL_HELD_QUANTITY_ALREADY_ASSIGNED'; END IF;
   ELSE
     SELECT count(*) INTO reserved
       FROM subcontract_physical_submissions s JOIN subcontract_physical_revisions r ON r.id=s.revision_id
       JOIN subcontract_claims sc ON sc.id=s.claim_id CROSS JOIN LATERAL jsonb_array_elements(r.observations) x
       WHERE sc.agreement_id=c.agreement_id AND sc.id<>c.id AND sc.state IN('SUBMITTED','ASSESSED') AND x->>'heldSourceId'=o->>'heldSourceId';
     SELECT count(*) INTO requested FROM jsonb_array_elements(p_observations) x WHERE x->>'heldSourceId'=o->>'heldSourceId';
     IF (original_decision->>'accepted')::boolean OR reserved+requested>1 THEN RAISE EXCEPTION 'PHYSICAL_HELD_BASIS_ALREADY_ASSIGNED'; END IF;
   END IF;
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION erp_physical_rework_correction_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF OLD.state IN('SUBMITTED','ASSESSED') AND NEW.state IN('REPLACED','REJECTED','WITHDRAWN') AND
    EXISTS(SELECT 1 FROM subcontract_physical_submissions WHERE claim_id=OLD.id) THEN
   PERFORM id FROM subcontract_agreements WHERE id=OLD.agreement_id FOR UPDATE;
   IF EXISTS(
     SELECT 1 FROM subcontract_physical_submissions original JOIN subcontract_physical_revisions original_r ON original_r.id=original.revision_id
     CROSS JOIN LATERAL jsonb_array_elements(original_r.observations) original_o
     JOIN subcontract_physical_revisions child_r ON child_r.claim_id<>OLD.id
     JOIN subcontract_physical_submissions child_s ON child_s.revision_id=child_r.id
     JOIN subcontract_claims child_c ON child_c.id=child_r.claim_id AND child_c.state IN('SUBMITTED','ASSESSED')
     CROSS JOIN LATERAL jsonb_array_elements(child_r.observations) child_o
     WHERE original.claim_id=OLD.id AND child_o->>'heldSourceId'=original_o->>'id') THEN
     RAISE EXCEPTION 'PHYSICAL_ACTIVE_REWORK_SOURCE_REQUIRES_CORRECTION';
   END IF;
 END IF;
 RETURN NEW;
END $$;

-- The existing global observation-identity check must also hold when distinct
-- Agreements capture the same requested UUID concurrently through direct SQL.
CREATE FUNCTION erp_physical_revision_identity_lock() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE observation_id text;
BEGIN
 FOR observation_id IN SELECT x.value->>'id' FROM jsonb_array_elements(NEW.observations) AS x(value) ORDER BY 1 LOOP
   IF observation_id IS DISTINCT FROM (observation_id::uuid)::text THEN RAISE EXCEPTION 'PHYSICAL_OBSERVATION_INVALID'; END IF;
   PERFORM pg_advisory_xact_lock(hashtextextended('physical-observation:'||observation_id,0));
 END LOOP;
 RETURN NEW;
END $$;
CREATE TRIGGER physical_revision_identity_lock BEFORE INSERT ON subcontract_physical_revisions
 FOR EACH ROW EXECUTE FUNCTION erp_physical_revision_identity_lock();
