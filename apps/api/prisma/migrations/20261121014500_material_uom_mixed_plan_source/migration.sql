-- DEC-050 C: distinct entered units share the original frozen stock allowance.
-- Approved BOQ source quantities/UOM and legacy same-UOM policy stay intact.

CREATE OR REPLACE FUNCTION erp_uom_plan_frozen_usage(
  plan_uuid uuid,
  source_uuid uuid,
  material_uuid uuid,
  entered_uom_uuid uuid,
  excluded_issue uuid DEFAULT NULL
) RETURNS numeric
LANGUAGE plpgsql STABLE AS $$
DECLARE
  linked RECORD;
  frozen RECORD;
  returns RECORD;
  total numeric := 0;
BEGIN
  -- Only current effective, posted, non-reversed linked issue items count.
  -- The plan/issue Company/Project/warehouse boundary is rechecked here rather
  -- than relying on caller-supplied ids or on a mutable balance.
  FOR linked IN
    SELECT h.company_id, h.id AS issue_id, i.id AS issue_item_id,
           i.uom_id, i.quantity AS entered_quantity
    FROM material_plan_issue_bindings b
    JOIN material_issues h ON h.id=b.issue_id
    JOIN material_plan_issue_allocations alloc ON alloc.authorization_id=b.authorization_id
    JOIN material_usage_plan_lines line ON line.id=alloc.plan_line_id
    JOIN material_usage_plans plan ON plan.id=alloc.plan_id
    JOIN material_issue_items i ON i.id=alloc.issue_item_id AND i.material_issue_id=h.id
    WHERE plan.id=plan_uuid AND line.budget_revision_line_id=source_uuid
      AND i.material_id=material_uuid AND line.material_id=material_uuid AND line.uom_id=entered_uom_uuid
      AND plan.company_id=h.company_id AND plan.project_id=h.project_id
      AND plan.warehouse_id=h.warehouse_id
      AND h.posted_at IS NOT NULL AND h.reversed_at IS NULL
      AND h.id IS DISTINCT FROM excluded_issue
  LOOP
    SELECT s.source_uom_id, s.source_quantity, s.stock_uom_id,
           s.stock_quantity, s.business_date, s.basis_version, s.revision_id
      INTO frozen
    FROM erp_material_uom_issue_effect(linked.issue_item_id) s
    WHERE s.company_id=linked.company_id
      AND s.material_id=material_uuid;
    IF NOT FOUND
       OR frozen.source_uom_id IS DISTINCT FROM linked.uom_id
       OR frozen.source_quantity IS DISTINCT FROM linked.entered_quantity
       OR NOT EXISTS (
        SELECT 1 FROM material_uom_activations a
         WHERE a.material_id=material_uuid AND a.company_id=linked.company_id
           AND a.stock_uom_id=frozen.stock_uom_id
       )
    THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_FROZEN_ISSUE_REQUIRED'; END IF;

    SELECT COUNT(DISTINCT item.id) AS item_count,
           COUNT(tx.id) AS movement_count,
           COUNT(effect.stock_transaction_id) AS pinned_count,
           COALESCE(SUM(effect.stock_quantity),0) AS stock_returned
      INTO returns
    FROM material_return_items item
    JOIN material_returns header ON header.id=item.material_return_id
    LEFT JOIN stock_transactions tx ON tx.material_return_item_id=item.id
      AND tx.movement_type='MATERIAL_RETURN'
      AND tx.company_id=linked.company_id AND tx.material_id=material_uuid
      AND tx.uom_id=frozen.stock_uom_id
    LEFT JOIN material_uom_effect_pins effect
      ON effect.stock_transaction_id=tx.id AND effect.company_id=linked.company_id
      AND effect.material_id=material_uuid AND effect.stock_uom_id=frozen.stock_uom_id
    WHERE item.material_issue_item_id=linked.issue_item_id
      AND header.company_id=linked.company_id
      AND header.posted_at IS NOT NULL AND header.reversed_at IS NULL;

    -- A partially posted or unpinned return cannot become a stock-basis credit.
    -- Multiple effects for one return item are rejected, not summed twice.
    IF returns.item_count <> returns.movement_count
       OR returns.item_count <> returns.pinned_count
       OR returns.stock_returned > frozen.stock_quantity
       OR returns.stock_returned < 0
    THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_FROZEN_RETURN_REQUIRED'; END IF;

    total := total + frozen.stock_quantity - returns.stock_returned;
  END LOOP;
  RETURN total;
END $$;

CREATE OR REPLACE FUNCTION erp_uom_plan_allocation_pin_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a RECORD; src RECORD; issue_row RECORD; reserved material_uom_reservation_pins%ROWTYPE;
 b material_uom_bases%ROWTYPE; rev material_uom_revisions%ROWTYPE;
 su units_of_measure%ROWTYPE; cu units_of_measure%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_ALLOCATION_IMMUTABLE'; END IF;
 PERFORM erp_material_uom_require_activation(NEW.company_id,NEW.material_id);
 SELECT alloc.*,item.material_id,item.uom_id,item.reservation_id,item.quantity AS issue_quantity,
  issue.project_id,issue.warehouse_id,
  issue.id AS issue_id,issue.company_id,issue.issue_date,issue.posted_at AS issue_posted_at,
  auth.created_at AS authorization_created_at INTO a
 FROM material_plan_issue_allocations alloc
 JOIN material_plan_issue_authorizations auth ON auth.id=alloc.authorization_id
 JOIN material_issue_items item ON item.id=alloc.issue_item_id
 JOIN material_issues issue ON issue.id=auth.issue_id AND item.material_issue_id=issue.id
 WHERE alloc.id=NEW.allocation_id FOR SHARE OF alloc;
 SELECT plan_pin.* INTO src FROM material_uom_plan_line_pins plan_pin
 WHERE plan_pin.plan_line_id=a.plan_line_id;
 IF a.id IS NULL OR src.plan_line_id IS NULL
  OR a.authorization_created_at IS DISTINCT FROM transaction_timestamp()
  OR a.issue_posted_at IS NOT NULL
  OR a.company_id IS DISTINCT FROM NEW.company_id
  OR a.material_id IS DISTINCT FROM NEW.material_id
  OR a.uom_id IS DISTINCT FROM NEW.source_uom_id
  OR a.issue_quantity IS DISTINCT FROM NEW.source_quantity
  OR (a.reservation_id IS NULL AND a.issue_date IS DISTINCT FROM NEW.business_date)
  OR a.overage_quantity<>0
  OR src.company_id IS DISTINCT FROM NEW.company_id OR src.material_id IS DISTINCT FROM NEW.material_id
  OR src.stock_uom_id IS DISTINCT FROM NEW.stock_uom_id
  OR src.stock_quantity IS DISTINCT FROM NEW.plan_stock_quantity
 THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_ALLOCATION_SOURCE_MISMATCH'; END IF;
 IF a.reservation_id IS NOT NULL THEN
  SELECT * INTO reserved FROM material_uom_reservation_pins WHERE reservation_id=a.reservation_id;
  IF reserved.reservation_id IS NULL
   OR (reserved.company_id,reserved.project_id,reserved.warehouse_id,reserved.material_id,
       reserved.source_uom_id,reserved.source_quantity,reserved.stock_uom_id,reserved.stock_quantity,
       reserved.business_date,reserved.basis_version,reserved.revision_id,reserved.numerator,reserved.denominator)
    IS DISTINCT FROM (NEW.company_id,a.project_id,a.warehouse_id,NEW.material_id,
       NEW.source_uom_id,NEW.source_quantity,NEW.stock_uom_id,NEW.stock_quantity,
       NEW.business_date,NEW.basis_version,NEW.revision_id,NEW.numerator,NEW.denominator)
   OR NOT EXISTS(SELECT 1 FROM material_reservations r WHERE r.id=a.reservation_id AND r.status='ACTIVE')
  THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_RESERVED_SOURCE_MISMATCH'; END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO b FROM material_uom_bases WHERE company_id=NEW.company_id AND material_id=NEW.material_id;
 SELECT * INTO su FROM units_of_measure WHERE id=NEW.source_uom_id AND company_id=NEW.company_id AND is_active;
 SELECT * INTO cu FROM units_of_measure WHERE id=NEW.stock_uom_id AND company_id=NEW.company_id AND is_active;
 IF b.material_id IS NULL OR su.id IS NULL OR cu.id IS NULL
  OR b.stock_uom_id<>NEW.stock_uom_id OR b.version<>NEW.basis_version
  OR cu.decimal_places<>b.stock_precision
  OR NEW.source_quantity*NEW.numerator::numeric IS DISTINCT FROM NEW.stock_quantity*NEW.denominator::numeric
  OR mod(NEW.source_quantity*power(10::numeric,su.decimal_places),1)<>0
  OR mod(NEW.stock_quantity*power(10::numeric,b.stock_precision),1)<>0
 THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_ALLOCATION_CONVERSION_INVALID'; END IF;
 IF NEW.source_uom_id=NEW.stock_uom_id THEN
  IF NEW.revision_id IS NOT NULL OR NEW.numerator<>'1' OR NEW.denominator<>'1'
  THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_ALLOCATION_IDENTITY_REQUIRED'; END IF;
 ELSE
  SELECT * INTO rev FROM material_uom_revisions
   WHERE company_id=NEW.company_id AND material_id=NEW.material_id
    AND source_uom_id=NEW.source_uom_id AND effective_from<=NEW.business_date
   ORDER BY effective_from DESC,revision_no DESC LIMIT 1;
  IF rev.id IS NULL OR rev.id IS DISTINCT FROM NEW.revision_id
   OR rev.numerator IS DISTINCT FROM NEW.numerator
   OR rev.denominator IS DISTINCT FROM NEW.denominator
   OR rev.source_precision IS DISTINCT FROM su.decimal_places
   OR rev.revision_no>NEW.basis_version
  THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_ALLOCATION_DEFINITION_STALE'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE OR REPLACE FUNCTION erp_mpi_validate_auth(auth_uuid uuid,posting boolean,poster uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
DECLARE a RECORD; h RECORD; p RECORD; l RECORD; reserved material_uom_reservation_pins%ROWTYPE; ai RECORD; first_step RECORD; final_step RECORD; reviewer uuid; approver uuid;
 used numeric; spent jsonb:='{}'; k text; prior numeric; excess numeric; n integer; expected integer; qty numeric; allowance_stock numeric; active_overage boolean:=false;
BEGIN
 SELECT * INTO STRICT a FROM material_plan_issue_authorizations WHERE id=auth_uuid;
 SELECT * INTO STRICT h FROM material_issues WHERE id=a.issue_id;
 SELECT po.* INTO STRICT p FROM material_plan_issue_bindings b JOIN material_plan_project_policies po ON po.id=b.policy_id WHERE b.issue_id=h.id;
 IF h.company_id<>p.company_id OR h.project_id<>p.project_id OR a.body_digest IS DISTINCT FROM erp_mpi_issue_digest(h.id)
 OR (h.posted_at IS NOT NULL AND NOT EXISTS(SELECT 1 FROM material_plan_issue_bindings WHERE issue_id=h.id AND authorization_id=a.id))
 THEN RAISE EXCEPTION 'Material plan issue scope or payload changed'; END IF;
 IF NOT erp_mpi_scope(a.created_by_user_id,p.company_id,p.project_id,'inventory.material_plan.issue.post') THEN RAISE EXCEPTION 'Material plan issue actor authority invalid'; END IF;
 SELECT count(*) INTO n FROM material_plan_issue_allocations WHERE authorization_id=a.id;
 SELECT count(*) INTO expected FROM material_issue_items WHERE material_issue_id=h.id;
 IF n<>expected OR n NOT BETWEEN 1 AND 200 THEN RAISE EXCEPTION 'Material plan issue complete batch required'; END IF;
 FOR l IN SELECT al.*,i.line_no,i.material_id,i.uom_id,i.reservation_id AS source_reservation_id,i.quantity AS actual_quantity,pl.quantity AS allowance,pl.uom_id AS plan_source_uom_id,pl.budget_revision_line_id,
  rev.id AS revision_id,rev.plan_id AS revision_plan,rev.status,rev.revision_no,rev.valid_from,rev.valid_to,
  plan.company_id,plan.project_id,plan.warehouse_id,plan.budget_revision_id,
  EXISTS(SELECT 1 FROM material_uom_activations activation
    WHERE activation.company_id=plan.company_id AND activation.material_id=i.material_id) AS activated,
  frozen.company_id AS frozen_company_id, frozen.material_id AS frozen_material_id,
  frozen.source_uom_id AS frozen_source_uom_id, frozen.source_quantity AS frozen_source_quantity,
  frozen.stock_uom_id AS frozen_stock_uom_id, frozen.stock_quantity AS frozen_stock_quantity,
  converted.company_id AS auth_company_id, converted.material_id AS auth_material_id,
  converted.source_uom_id AS auth_source_uom_id, converted.source_quantity AS auth_source_quantity,
  converted.stock_uom_id AS auth_stock_uom_id, converted.stock_quantity AS auth_stock_quantity,
  converted.plan_stock_quantity AS auth_plan_stock_quantity,
  converted.stock_overage_quantity AS auth_stock_overage,
  converted.business_date AS auth_business_date,converted.basis_version AS auth_basis_version,
  converted.revision_id AS auth_revision_id,converted.numerator AS auth_numerator,
  converted.denominator AS auth_denominator
 FROM material_plan_issue_allocations al JOIN material_issue_items i ON i.id=al.issue_item_id AND i.material_issue_id=h.id
 JOIN material_usage_plan_lines pl ON pl.id=al.plan_line_id AND pl.material_id=i.material_id
  AND (pl.uom_id=i.uom_id OR EXISTS(SELECT 1 FROM material_uom_plan_line_pins pin WHERE pin.plan_line_id=pl.id))
 JOIN material_usage_plan_revisions rev ON rev.id=pl.revision_id JOIN material_usage_plans plan ON plan.id=rev.plan_id
 LEFT JOIN material_uom_plan_line_pins frozen ON frozen.plan_line_id=pl.id
 LEFT JOIN material_uom_plan_allocation_pins converted ON converted.allocation_id=al.id
 WHERE al.authorization_id=a.id ORDER BY i.line_no,i.id LOOP
  IF l.plan_id<>l.revision_plan OR l.quantity<>l.actual_quantity OR l.company_id<>h.company_id OR l.project_id<>h.project_id OR l.warehouse_id<>h.warehouse_id
  OR l.status<>'APPROVED' OR l.revision_no<>(SELECT max(revision_no) FROM material_usage_plan_revisions WHERE plan_id=l.plan_id AND status='APPROVED')
  OR h.issue_date NOT BETWEEN l.valid_from AND l.valid_to
  OR NOT EXISTS(SELECT 1 FROM budget_revision_lines bl JOIN budget_revisions br ON br.id=bl.budget_revision_id
   JOIN approval_instances ba ON ba.id=br.approval_instance_id AND ba.approval_state='APPROVED'
   JOIN materials m ON m.id=l.material_id AND m.company_id=h.company_id AND m.is_active AND m.default_uom_id=l.plan_source_uom_id
   JOIN units_of_measure u ON u.id=l.plan_source_uom_id AND u.company_id=h.company_id AND u.is_active
   WHERE bl.id=l.budget_revision_line_id AND br.id=l.budget_revision_id AND br.project_id=h.project_id AND br.company_id=h.company_id AND bl.uom_id=l.plan_source_uom_id AND bl.quantity>=l.allowance)
  THEN RAISE EXCEPTION 'Material plan issue source or effective version invalid'; END IF;
  k:=l.plan_id::text||':'||l.budget_revision_line_id::text||':'||l.material_id::text||':'||l.plan_source_uom_id::text;
  prior:=coalesce((spent->>k)::numeric,0);
  IF l.activated THEN
   SELECT * INTO reserved FROM material_uom_reservation_pins WHERE reservation_id=l.source_reservation_id;
   IF l.source_reservation_id IS NOT NULL AND
    (reserved.reservation_id IS NULL OR
     (reserved.company_id,reserved.project_id,reserved.warehouse_id,reserved.material_id,
      reserved.source_uom_id,reserved.source_quantity,reserved.stock_uom_id,reserved.stock_quantity,
      reserved.business_date,reserved.basis_version,reserved.revision_id,reserved.numerator,reserved.denominator)
     IS DISTINCT FROM (h.company_id,h.project_id,h.warehouse_id,l.material_id,
      l.auth_source_uom_id,l.auth_source_quantity,l.auth_stock_uom_id,l.auth_stock_quantity,
      l.auth_business_date,l.auth_basis_version,l.auth_revision_id,l.auth_numerator,l.auth_denominator))
   THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_RESERVED_SOURCE_MISMATCH'; END IF;
   -- Exactly one authoritative source-to-stock basis, not an assumed unit
   -- mapping or today's factor. The original Cost BOQ cap still holds above.
   IF l.frozen_company_id IS DISTINCT FROM h.company_id
    OR l.frozen_material_id IS DISTINCT FROM l.material_id
    OR l.frozen_source_uom_id IS DISTINCT FROM l.plan_source_uom_id
    OR l.frozen_source_quantity IS DISTINCT FROM l.allowance
    OR l.auth_company_id IS DISTINCT FROM h.company_id
    OR l.auth_material_id IS DISTINCT FROM l.material_id
    OR l.auth_source_uom_id IS DISTINCT FROM l.uom_id
    OR l.auth_source_quantity IS DISTINCT FROM l.quantity
    OR l.auth_stock_uom_id IS DISTINCT FROM l.frozen_stock_uom_id
    OR l.auth_plan_stock_quantity IS DISTINCT FROM l.frozen_stock_quantity
    OR l.auth_business_date IS DISTINCT FROM coalesce(reserved.business_date,h.issue_date)
    OR l.overage_quantity<>0
    OR l.auth_stock_quantity IS NULL OR l.auth_stock_quantity<=0
    OR l.auth_stock_overage IS NULL OR l.auth_stock_overage<0
    OR l.auth_stock_overage>l.auth_stock_quantity
    OR l.auth_source_quantity*l.auth_numerator::numeric
       IS DISTINCT FROM l.auth_stock_quantity*l.auth_denominator::numeric
    OR NOT EXISTS(SELECT 1 FROM material_uom_bases b
       WHERE b.company_id=h.company_id AND b.material_id=l.material_id
       AND b.stock_uom_id=l.auth_stock_uom_id
       AND ((l.source_reservation_id IS NULL AND b.version=l.auth_basis_version)
        OR (l.source_reservation_id IS NOT NULL AND b.version>=l.auth_basis_version)))
   THEN RAISE EXCEPTION 'Material plan issue canonical source or conversion invalid'; END IF;
   IF (l.auth_source_uom_id=l.auth_stock_uom_id AND
       (l.auth_revision_id IS NOT NULL OR l.auth_numerator<>'1' OR l.auth_denominator<>'1'))
    OR (l.source_reservation_id IS NULL AND l.auth_source_uom_id<>l.auth_stock_uom_id AND
       l.auth_revision_id IS DISTINCT FROM (
        SELECT revision.id FROM material_uom_revisions revision
        WHERE revision.company_id=h.company_id AND revision.material_id=l.material_id
          AND revision.source_uom_id=l.auth_source_uom_id AND revision.effective_from<=h.issue_date
        ORDER BY revision.effective_from DESC,revision.revision_no DESC LIMIT 1))
   THEN RAISE EXCEPTION 'Material plan issue canonical definition stale'; END IF;
   -- Missing/improper historical return evidence raises, never grants credit.
   used:=erp_uom_plan_frozen_usage(l.plan_id,l.budget_revision_line_id,l.material_id,l.plan_source_uom_id,h.id);
   qty:=l.auth_stock_quantity;
   allowance_stock:=l.frozen_stock_quantity;
   excess:=greatest(0,qty-greatest(0,allowance_stock-used-prior));
   IF (a.created_at=transaction_timestamp() AND NOT posting AND h.posted_at IS NULL
       AND excess<>l.auth_stock_overage)
     OR excess>l.auth_stock_overage
     OR (a.mode='DIRECT' AND (excess<>0 OR l.auth_stock_overage<>0))
   THEN RAISE EXCEPTION 'Material plan issue canonical allowance or approval stale'; END IF;
   IF l.auth_stock_overage>0 THEN active_overage:=true; END IF;
  ELSE
   -- Original same-UOM source and role policy remains byte-for-byte equivalent.
   IF l.auth_company_id IS NOT NULL OR l.frozen_company_id IS NOT NULL
   THEN RAISE EXCEPTION 'Material plan issue legacy source must remain unpinned'; END IF;
   used:=erp_mpi_usage(l.plan_id,l.budget_revision_line_id,l.material_id,l.uom_id,h.id);
   qty:=l.quantity;
   allowance_stock:=l.allowance;
   excess:=greatest(0,qty-greatest(0,allowance_stock-used-prior));
   IF (a.created_at=transaction_timestamp() AND NOT posting AND h.posted_at IS NULL
       AND excess<>l.overage_quantity) OR excess>l.overage_quantity
     OR (a.mode='DIRECT' AND (excess<>0 OR l.overage_quantity<>0))
   THEN RAISE EXCEPTION 'Material plan issue allowance or approval stale'; END IF;
  END IF;
  spent:=jsonb_set(spent,ARRAY[k],to_jsonb(prior+qty),true);
 END LOOP;
 -- Reject an allocation removed by any scope join above; counts alone cannot
 -- admit a mismatched item, UOM or plan parent.
 IF (SELECT count(*) FROM material_plan_issue_allocations al JOIN material_issue_items i ON i.id=al.issue_item_id AND i.material_issue_id=h.id
  JOIN material_usage_plan_lines pl ON pl.id=al.plan_line_id AND pl.material_id=i.material_id
  AND (pl.uom_id=i.uom_id OR EXISTS(SELECT 1 FROM material_uom_plan_line_pins pin WHERE pin.plan_line_id=pl.id))
  JOIN material_usage_plan_revisions r ON r.id=pl.revision_id AND r.plan_id=al.plan_id WHERE al.authorization_id=a.id)<>n THEN RAISE EXCEPTION 'Material plan issue complete batch required'; END IF;
 IF a.mode='DIRECT' THEN
  IF posting AND poster IS DISTINCT FROM a.created_by_user_id THEN RAISE EXCEPTION 'Material plan issue actor authority invalid'; END IF;
 ELSE
  IF NOT active_overage AND NOT EXISTS(SELECT 1 FROM material_plan_issue_allocations
     WHERE authorization_id=a.id AND overage_quantity>0)
 THEN RAISE EXCEPTION 'Material plan issue allowance or approval stale'; END IF;
  SELECT * INTO STRICT ai FROM approval_instances WHERE id=a.approval_instance_id;
  IF NOT erp_mpi_workflow_valid(p.approval_workflow_id,p.company_id) OR a.workflow_digest IS DISTINCT FROM erp_mpi_workflow_digest(p.approval_workflow_id)
   OR ai.company_id<>p.company_id OR ai.approval_workflow_id<>p.approval_workflow_id OR ai.entity_type<>'MATERIAL_PLAN_OVERAGE' OR ai.entity_id<>a.id
  THEN RAISE EXCEPTION 'Material plan issue approval configuration stale'; END IF;
  IF posting THEN
   SELECT * INTO STRICT first_step FROM approval_steps WHERE approval_workflow_id=p.approval_workflow_id ORDER BY step_no LIMIT 1;
   SELECT * INTO STRICT final_step FROM approval_steps WHERE approval_workflow_id=p.approval_workflow_id ORDER BY step_no DESC LIMIT 1;
   SELECT action_by_user_id INTO reviewer FROM approval_actions WHERE approval_instance_id=ai.id AND approval_step_id=first_step.id AND action='APPROVE';
   SELECT action_by_user_id INTO approver FROM approval_actions WHERE approval_instance_id=ai.id AND approval_step_id=final_step.id AND action='APPROVE';
   IF ai.approval_state<>'APPROVED' OR reviewer IS NULL OR approver IS NULL OR reviewer=approver OR approver IS DISTINCT FROM poster
    OR reviewer=ANY(ARRAY[h.created_by_user_id,h.submitted_by_user_id,a.created_by_user_id]) OR approver=ANY(ARRAY[h.created_by_user_id,h.submitted_by_user_id,a.created_by_user_id])
    OR NOT erp_mpi_scope(reviewer,p.company_id,p.project_id,'inventory.material_plan.overage.review')
    OR NOT erp_mpi_scope(approver,p.company_id,p.project_id,'inventory.material_plan.overage.approve')
    OR NOT erp_mpi_step_role(reviewer,first_step.id,p.company_id) OR NOT erp_mpi_step_role(approver,final_step.id,p.company_id)
   THEN RAISE EXCEPTION 'Material plan issue independent approval required'; END IF;
  END IF;
 END IF;
END $$;
