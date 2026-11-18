-- Forward-only qualification of accepted allocation aggregates; all earlier checksums remain unchanged.
CREATE OR REPLACE FUNCTION erp_physical_decision_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE c subcontract_claims%ROWTYPE; s subcontract_physical_submissions%ROWTYPE; r subcontract_physical_revisions%ROWTYPE;
  a subcontract_claim_assessments%ROWTYPE; d jsonb; o jsonb; seen uuid[]:=ARRAY[]::uuid[]; accepted numeric; held numeric; amount numeric; total numeric:=0;
BEGIN
 SELECT * INTO STRICT c FROM subcontract_claims WHERE id=NEW.claim_id FOR UPDATE;
 SELECT * INTO STRICT s FROM subcontract_physical_submissions WHERE claim_id=c.id;
 SELECT * INTO STRICT r FROM subcontract_physical_revisions WHERE id=s.revision_id;
 SELECT * INTO STRICT a FROM subcontract_claim_assessments WHERE id=NEW.assessment_id AND claim_id=c.id;
 PERFORM erp_physical_assert_source(c.id);
 PERFORM erp_physical_assert_rework(c.id,r.observations);
 IF c.state<>'SUBMITTED' OR NEW.actor_user_id IN(c.created_by_user_id,c.submitted_by_user_id,s.actor_user_id,r.actor_user_id) OR
    a.assessed_by_user_id<>NEW.actor_user_id OR a.assessed_amount<>NEW.assessed_amount OR a.state<>'ASSESSED' OR
    NOT erp_physical_actor(NEW.actor_user_id,c.company_id,'subcontracts.physical.decide') OR
    NOT erp_physical_actor(NEW.actor_user_id,c.company_id,'subcontracts.assessment.assess') OR
    jsonb_array_length(NEW.decisions)<>jsonb_array_length(r.observations) THEN RAISE EXCEPTION 'PHYSICAL_INDEPENDENT_DECISION_REQUIRED'; END IF;
 FOR d IN SELECT * FROM jsonb_array_elements(NEW.decisions) LOOP
   SELECT value INTO o FROM jsonb_array_elements(r.observations) WHERE value->>'id'=d->>'observationId';
   IF o IS NULL OR (d->>'observationId')::uuid=ANY(seen) OR d->>'claimLineId' IS DISTINCT FROM o->>'claimLineId' OR
      jsonb_typeof(d->'acceptedAmount') IS DISTINCT FROM 'string' OR (d->>'acceptedAmount')!~'^(0|[1-9][0-9]{0,15})(\.[0-9]{1,2})?$' OR
      length(btrim(coalesce(d->>'reason',''))) NOT BETWEEN 1 AND 2000 THEN RAISE EXCEPTION 'PHYSICAL_DECISION_INVALID'; END IF;
   seen:=array_append(seen,(d->>'observationId')::uuid); amount:=(d->>'acceptedAmount')::numeric;
   IF o->>'basis'='MEASURED' THEN
     IF jsonb_typeof(d->'acceptedQuantity') IS DISTINCT FROM 'string' OR (d->>'acceptedQuantity')!~'^(0|[1-9][0-9]{0,13})(\.[0-9]{1,4})?$' THEN
       RAISE EXCEPTION 'PHYSICAL_ACCEPTED_QUANTITY_INVALID';
     END IF;
     accepted:=(d->>'acceptedQuantity')::numeric; held:=(o->>'quantity')::numeric-accepted;
     IF accepted<0 OR held<0 OR jsonb_typeof(d->'heldQuantity') IS DISTINCT FROM 'string' OR (d->>'heldQuantity')::numeric<>held OR
        jsonb_typeof(d->'accepted') IS DISTINCT FROM 'boolean' OR (d->>'accepted')::boolean IS DISTINCT FROM (accepted>0) THEN
       RAISE EXCEPTION 'PHYSICAL_ACCEPTED_QUANTITY_INVALID';
     END IF;
   ELSE
     IF jsonb_typeof(d->'accepted') IS DISTINCT FROM 'boolean' OR d->'acceptedQuantity' IS DISTINCT FROM 'null'::jsonb OR d->'heldQuantity' IS DISTINCT FROM 'null'::jsonb THEN
       RAISE EXCEPTION 'PHYSICAL_ACCEPTED_BASIS_INVALID';
     END IF;
     accepted:=CASE WHEN (d->>'accepted')::boolean THEN 1 ELSE 0 END; held:=1-accepted;
   END IF;
   IF (accepted=0 AND amount<>0) OR (held>0 AND coalesce(d->>'heldDisposition','') NOT IN('REWORK','REJECTED')) OR
      (held=0 AND d->'heldDisposition' IS DISTINCT FROM 'null'::jsonb) THEN RAISE EXCEPTION 'PHYSICAL_HELD_ALLOCATION_INVALID'; END IF;
   total:=total+amount;
 END LOOP;
 IF total<>NEW.assessed_amount OR EXISTS(
   SELECT 1 FROM (
     SELECT allocation.value->>'claimLineId' AS line_id, sum((allocation.value->>'acceptedAmount')::numeric) AS eligible_amount
     FROM jsonb_array_elements(NEW.decisions) AS allocation(value) GROUP BY allocation.value->>'claimLineId'
   ) amounts JOIN subcontract_claim_lines line ON line.id=amounts.line_id::uuid AND line.claim_id=c.id
   WHERE amounts.eligible_amount>line.amount) THEN
   RAISE EXCEPTION 'PHYSICAL_ACCEPTED_AMOUNT_INVALID';
 END IF;
 RETURN NEW;
END $$;
