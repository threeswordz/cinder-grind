-- DEC-048 reuses the existing UOM precision within Decimal(18,4); no tolerance
-- or rounded quantity is introduced. Master-data writes share these row locks.
CREATE FUNCTION erp_physical_assert_unit_precision(p_claim uuid,p_observations jsonb) RETURNS void LANGUAGE plpgsql AS $$
DECLARE company uuid; unit_ids uuid[];
BEGIN
 SELECT company_id INTO STRICT company FROM subcontract_claims WHERE id=p_claim;
 SELECT array_agg(DISTINCT (o.value->>'uomId')::uuid) INTO unit_ids
 FROM jsonb_array_elements(p_observations) AS o(value) WHERE o.value->>'basis'='MEASURED';
 PERFORM u.id FROM units_of_measure u WHERE u.company_id=company AND u.id=ANY(unit_ids) ORDER BY u.id FOR SHARE;
 IF EXISTS (
   SELECT 1 FROM jsonb_array_elements(p_observations) AS o(value)
   LEFT JOIN units_of_measure u ON u.id=(o.value->>'uomId')::uuid AND u.company_id=company
   WHERE o.value->>'basis'='MEASURED' AND (u.id IS NULL OR NOT u.is_active OR
     (o.value->>'quantity')::numeric<>round((o.value->>'quantity')::numeric,least(4,u.decimal_places)))
 ) THEN RAISE EXCEPTION 'PHYSICAL_MEASUREMENT_INVALID'; END IF;
END $$;

CREATE FUNCTION erp_physical_revision_precision_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM erp_physical_assert_unit_precision(NEW.claim_id,NEW.observations);
 RETURN NEW;
END $$;
CREATE TRIGGER physical_revision_precision_guard BEFORE INSERT ON subcontract_physical_revisions
 FOR EACH ROW EXECUTE FUNCTION erp_physical_revision_precision_guard();

CREATE FUNCTION erp_physical_submission_basis_lock() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE observations jsonb;
BEGIN
 SELECT r.observations INTO STRICT observations FROM subcontract_physical_revisions r WHERE r.id=NEW.revision_id AND r.claim_id=NEW.claim_id;
 PERFORM erp_physical_assert_unit_precision(NEW.claim_id,observations);
 RETURN NEW;
END $$;
CREATE TRIGGER physical_submission_basis_lock BEFORE INSERT ON subcontract_physical_submissions
 FOR EACH ROW EXECUTE FUNCTION erp_physical_submission_basis_lock();

CREATE OR REPLACE FUNCTION erp_physical_commercial_source(p_claim uuid) RETURNS jsonb LANGUAGE plpgsql VOLATILE AS $$
DECLARE observations jsonb; result jsonb;
BEGIN
 SELECT r.observations INTO observations FROM subcontract_physical_revisions r JOIN subcontract_physical_claims pc
   ON pc.claim_id=r.claim_id AND pc.version=r.version WHERE r.claim_id=p_claim;
 IF observations IS NOT NULL THEN PERFORM erp_physical_assert_unit_precision(p_claim,observations); END IF;
 SELECT jsonb_build_object('claimId',c.id,'companyId',c.company_id,'projectId',c.project_id,'agreementId',c.agreement_id,
   'periodStart',c.period_start::text,'periodEnd',c.period_end::text,'currencyCode',c.currency_code,
   'lines',coalesce((SELECT jsonb_agg(jsonb_build_object('id',l.id,'amount',l.amount::text,'workOrderId',l.work_order_id) ORDER BY l.id)
     FROM subcontract_claim_lines l WHERE l.claim_id=c.id),'[]'::jsonb),
   'uoms',coalesce((SELECT jsonb_agg(jsonb_build_object('id',u.id,'uomCode',u.uom_code,'uomName',u.uom_name,
     'decimalPlaces',u.decimal_places,'isActive',u.is_active) ORDER BY u.id) FROM units_of_measure u
     WHERE u.company_id=c.company_id AND u.id IN (SELECT (o.value->>'uomId')::uuid
       FROM jsonb_array_elements(coalesce(observations,'[]'::jsonb)) AS o(value) WHERE o.value->>'basis'='MEASURED')),'[]'::jsonb))
   INTO result FROM subcontract_claims c WHERE c.id=p_claim;
 RETURN result;
END $$;

CREATE FUNCTION erp_physical_decision_precision_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS (
   SELECT 1 FROM subcontract_physical_submissions s JOIN subcontract_physical_revisions r ON r.id=s.revision_id
   JOIN subcontract_claims c ON c.id=s.claim_id CROSS JOIN LATERAL jsonb_array_elements(r.observations) AS o(value)
   CROSS JOIN LATERAL jsonb_array_elements(NEW.decisions) AS d(value)
   JOIN units_of_measure u ON u.id=(o.value->>'uomId')::uuid AND u.company_id=c.company_id
   WHERE s.claim_id=NEW.claim_id AND o.value->>'basis'='MEASURED' AND d.value->>'observationId'=o.value->>'id' AND (
     (d.value->>'acceptedQuantity')::numeric<>round((d.value->>'acceptedQuantity')::numeric,least(4,u.decimal_places)) OR
     (d.value->>'heldQuantity')::numeric<>round((d.value->>'heldQuantity')::numeric,least(4,u.decimal_places)))
 ) THEN RAISE EXCEPTION 'PHYSICAL_ACCEPTED_QUANTITY_INVALID'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER physical_decision_precision_guard BEFORE INSERT ON subcontract_physical_decisions
 FOR EACH ROW EXECUTE FUNCTION erp_physical_decision_precision_guard();
