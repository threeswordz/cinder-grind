-- Stage C canonical plan-issue authorization. Existing legacy source and
-- approval proofs remain; activated allocations store exact stock-unit overage
-- without rounding back to source cartons or relaxing the old numeric CHECK.
CREATE TABLE material_uom_plan_allocation_pins (
 allocation_id uuid PRIMARY KEY REFERENCES material_plan_issue_allocations(id) ON DELETE RESTRICT,
 company_id uuid NOT NULL, material_id uuid NOT NULL,
 source_uom_id uuid NOT NULL REFERENCES units_of_measure(id) ON DELETE RESTRICT,
 source_quantity numeric(18,4) NOT NULL,
 stock_uom_id uuid NOT NULL REFERENCES units_of_measure(id) ON DELETE RESTRICT,
 stock_quantity numeric(18,4) NOT NULL,
 plan_stock_quantity numeric(18,4) NOT NULL,
 stock_overage_quantity numeric(18,4) NOT NULL,
 business_date date NOT NULL, basis_version integer NOT NULL,
 revision_id uuid REFERENCES material_uom_revisions(id) ON DELETE RESTRICT,
 numerator varchar(38) NOT NULL, denominator varchar(38) NOT NULL,
 created_at timestamptz(6) NOT NULL DEFAULT now(),
 CONSTRAINT material_uom_plan_allocation_basis_fk FOREIGN KEY(company_id,material_id)
  REFERENCES material_uom_bases(company_id,material_id) ON DELETE RESTRICT,
 CONSTRAINT material_uom_plan_allocation_values CHECK(
 source_quantity>0 AND stock_quantity>0 AND plan_stock_quantity>0
 AND stock_overage_quantity>=0 AND stock_overage_quantity<=stock_quantity
 AND source_quantity<>'NaN'::numeric AND stock_quantity<>'NaN'::numeric
 AND stock_overage_quantity<>'NaN'::numeric AND plan_stock_quantity<>'NaN'::numeric
 AND basis_version>0 AND numerator~'^[1-9][0-9]{0,37}$'
 AND denominator~'^[1-9][0-9]{0,37}$'
 )
);
CREATE INDEX material_uom_plan_allocation_company_idx
 ON material_uom_plan_allocation_pins(company_id,material_id,business_date);

CREATE FUNCTION erp_uom_plan_allocation_pin_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a RECORD; src RECORD; issue_row RECORD;
 b material_uom_bases%ROWTYPE; rev material_uom_revisions%ROWTYPE;
 su units_of_measure%ROWTYPE; cu units_of_measure%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_ALLOCATION_IMMUTABLE'; END IF;
 PERFORM erp_material_uom_require_activation(NEW.company_id,NEW.material_id);
 SELECT alloc.*,item.material_id,item.uom_id,item.quantity AS issue_quantity,
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
  OR a.issue_date IS DISTINCT FROM NEW.business_date
  OR a.overage_quantity<>0
  OR src.company_id IS DISTINCT FROM NEW.company_id OR src.material_id IS DISTINCT FROM NEW.material_id
  OR src.source_uom_id IS DISTINCT FROM NEW.source_uom_id
  OR src.stock_uom_id IS DISTINCT FROM NEW.stock_uom_id
  OR src.stock_quantity IS DISTINCT FROM NEW.plan_stock_quantity
 THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_ALLOCATION_SOURCE_MISMATCH'; END IF;
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
CREATE TRIGGER material_uom_plan_allocation_pin_guard
 BEFORE INSERT OR UPDATE OR DELETE ON material_uom_plan_allocation_pins
 FOR EACH ROW EXECUTE FUNCTION erp_uom_plan_allocation_pin_guard();

-- Every active converted allocation must have its genuine immutable exact
-- stock quantity and overage in the same original authorization transaction.
CREATE FUNCTION erp_uom_plan_allocation_pin_required() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cid uuid; mid uuid;
BEGIN
 SELECT plan.company_id,item.material_id INTO cid,mid
  FROM material_plan_issue_authorizations a
  JOIN material_usage_plans plan ON plan.id=NEW.plan_id
  JOIN material_issue_items item ON item.id=NEW.issue_item_id
  WHERE a.id=NEW.authorization_id;
 IF EXISTS(SELECT 1 FROM material_uom_activations WHERE company_id=cid AND material_id=mid)
 AND NOT EXISTS(SELECT 1 FROM material_uom_plan_allocation_pins p
   WHERE p.allocation_id=NEW.id AND p.company_id=cid AND p.material_id=mid)
 THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_ALLOCATION_PIN_REQUIRED'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER material_uom_plan_allocation_pin_required
 AFTER INSERT ON material_plan_issue_allocations
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 EXECUTE FUNCTION erp_uom_plan_allocation_pin_required();


-- Preserve original independent maker/checker and operation receipts while
-- replacing only the entered-unit allowance proof with activated stock truth.
CREATE OR REPLACE FUNCTION erp_mpi_validate_auth(auth_uuid uuid,posting boolean,poster uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
DECLARE a RECORD; h RECORD; p RECORD; l RECORD; ai RECORD; first_step RECORD; final_step RECORD; reviewer uuid; approver uuid;
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
 FOR l IN SELECT al.*,i.line_no,i.material_id,i.uom_id,i.quantity AS actual_quantity,pl.quantity AS allowance,pl.budget_revision_line_id,
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
 JOIN material_usage_plan_lines pl ON pl.id=al.plan_line_id AND pl.material_id=i.material_id AND pl.uom_id=i.uom_id
 JOIN material_usage_plan_revisions rev ON rev.id=pl.revision_id JOIN material_usage_plans plan ON plan.id=rev.plan_id
 LEFT JOIN material_uom_plan_line_pins frozen ON frozen.plan_line_id=pl.id
 LEFT JOIN material_uom_plan_allocation_pins converted ON converted.allocation_id=al.id
 WHERE al.authorization_id=a.id ORDER BY i.line_no,i.id LOOP
  IF l.plan_id<>l.revision_plan OR l.quantity<>l.actual_quantity OR l.company_id<>h.company_id OR l.project_id<>h.project_id OR l.warehouse_id<>h.warehouse_id
  OR l.status<>'APPROVED' OR l.revision_no<>(SELECT max(revision_no) FROM material_usage_plan_revisions WHERE plan_id=l.plan_id AND status='APPROVED')
  OR h.issue_date NOT BETWEEN l.valid_from AND l.valid_to
  OR NOT EXISTS(SELECT 1 FROM budget_revision_lines bl JOIN budget_revisions br ON br.id=bl.budget_revision_id
   JOIN approval_instances ba ON ba.id=br.approval_instance_id AND ba.approval_state='APPROVED'
   JOIN materials m ON m.id=l.material_id AND m.company_id=h.company_id AND m.is_active AND m.default_uom_id=l.uom_id
   JOIN units_of_measure u ON u.id=l.uom_id AND u.company_id=h.company_id AND u.is_active
   WHERE bl.id=l.budget_revision_line_id AND br.id=l.budget_revision_id AND br.project_id=h.project_id AND br.company_id=h.company_id AND bl.uom_id=l.uom_id AND bl.quantity>=l.allowance)
  THEN RAISE EXCEPTION 'Material plan issue source or effective version invalid'; END IF;
  k:=l.plan_id::text||':'||l.budget_revision_line_id::text||':'||l.material_id::text||':'||l.uom_id::text;
  prior:=coalesce((spent->>k)::numeric,0);
  IF l.activated THEN
   -- Exactly one authoritative source-to-stock basis, not an assumed unit
   -- mapping or today's factor. The original Cost BOQ cap still holds above.
   IF l.frozen_company_id IS DISTINCT FROM h.company_id
    OR l.frozen_material_id IS DISTINCT FROM l.material_id
    OR l.frozen_source_uom_id IS DISTINCT FROM l.uom_id
    OR l.frozen_source_quantity IS DISTINCT FROM l.allowance
    OR l.auth_company_id IS DISTINCT FROM h.company_id
    OR l.auth_material_id IS DISTINCT FROM l.material_id
    OR l.auth_source_uom_id IS DISTINCT FROM l.uom_id
    OR l.auth_source_quantity IS DISTINCT FROM l.quantity
    OR l.auth_stock_uom_id IS DISTINCT FROM l.frozen_stock_uom_id
    OR l.auth_plan_stock_quantity IS DISTINCT FROM l.frozen_stock_quantity
    OR l.auth_business_date IS DISTINCT FROM h.issue_date
    OR l.overage_quantity<>0
    OR l.auth_stock_quantity IS NULL OR l.auth_stock_quantity<=0
    OR l.auth_stock_overage IS NULL OR l.auth_stock_overage<0
    OR l.auth_stock_overage>l.auth_stock_quantity
    OR l.auth_source_quantity*l.auth_numerator::numeric
       IS DISTINCT FROM l.auth_stock_quantity*l.auth_denominator::numeric
    OR NOT EXISTS(SELECT 1 FROM material_uom_bases b
       WHERE b.company_id=h.company_id AND b.material_id=l.material_id
       AND b.stock_uom_id=l.auth_stock_uom_id AND b.version=l.auth_basis_version)
   THEN RAISE EXCEPTION 'Material plan issue canonical source or conversion invalid'; END IF;
   IF (l.auth_source_uom_id=l.auth_stock_uom_id AND
       (l.auth_revision_id IS NOT NULL OR l.auth_numerator<>'1' OR l.auth_denominator<>'1'))
    OR (l.auth_source_uom_id<>l.auth_stock_uom_id AND
       l.auth_revision_id IS DISTINCT FROM (
        SELECT revision.id FROM material_uom_revisions revision
        WHERE revision.company_id=h.company_id AND revision.material_id=l.material_id
          AND revision.source_uom_id=l.auth_source_uom_id AND revision.effective_from<=h.issue_date
        ORDER BY revision.effective_from DESC,revision.revision_no DESC LIMIT 1))
   THEN RAISE EXCEPTION 'Material plan issue canonical definition stale'; END IF;
   -- Missing/improper historical return evidence raises, never grants credit.
   used:=erp_uom_plan_frozen_usage(l.plan_id,l.budget_revision_line_id,l.material_id,l.uom_id,h.id);
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
  JOIN material_usage_plan_lines pl ON pl.id=al.plan_line_id AND pl.material_id=i.material_id AND pl.uom_id=i.uom_id
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

CREATE OR REPLACE FUNCTION erp_mpi_assert_revision(revision_uuid uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r RECORD; x RECORD; used numeric; allowance numeric;
BEGIN
 SELECT * INTO STRICT r FROM material_usage_plan_revisions WHERE id=revision_uuid;
 PERFORM pg_advisory_xact_lock(hashtextextended('material-plan:'||r.plan_id::text,0));
 FOR x IN SELECT DISTINCT l.budget_revision_line_id,l.material_id,l.uom_id FROM material_plan_issue_allocations a
 JOIN material_usage_plan_lines l ON l.id=a.plan_line_id WHERE a.plan_id=r.plan_id LOOP
  IF EXISTS(SELECT 1 FROM material_uom_activations act
    JOIN material_usage_plans plan ON plan.id=r.plan_id
    WHERE act.company_id=plan.company_id AND act.material_id=x.material_id) THEN
   used:=erp_uom_plan_frozen_usage(r.plan_id,x.budget_revision_line_id,x.material_id,x.uom_id);
   SELECT pin.stock_quantity INTO allowance FROM material_usage_plan_lines pl
     JOIN material_uom_plan_line_pins pin ON pin.plan_line_id=pl.id
     WHERE pl.revision_id=r.id AND pl.budget_revision_line_id=x.budget_revision_line_id
       AND pl.material_id=x.material_id AND pl.uom_id=x.uom_id;
   IF allowance IS NULL THEN RAISE EXCEPTION 'Material plan issue frozen revision source required'; END IF;
  ELSE
   used:=erp_mpi_usage(r.plan_id,x.budget_revision_line_id,x.material_id,x.uom_id);
   SELECT quantity INTO allowance FROM material_usage_plan_lines
    WHERE revision_id=r.id AND budget_revision_line_id=x.budget_revision_line_id
      AND material_id=x.material_id AND uom_id=x.uom_id;
  END IF;
  IF used>coalesce(allowance,0) THEN RAISE EXCEPTION 'Material plan issue revision below effective consumption'; END IF;
 END LOOP;
END $$;

CREATE OR REPLACE FUNCTION erp_mpi_receipt_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p uuid; issue_uuid uuid; auth_uuid uuid; actor_uuid uuid; actions text[]; a RECORD; h RECORD; b RECORD; proof RECORD;
BEGIN
 IF TG_TABLE_NAME='material_plan_project_policies' THEN p:=NEW.id;actor_uuid:=NEW.enabled_by_user_id;actions:=ARRAY['ENABLE'];
 ELSIF TG_TABLE_NAME='material_plan_issue_authorizations' THEN
  auth_uuid:=NEW.id;issue_uuid:=NEW.issue_id;actor_uuid:=NEW.created_by_user_id;actions:=ARRAY[CASE WHEN NEW.mode='DIRECT' THEN 'DIRECT' ELSE 'SUBMIT' END];
  SELECT policy_id INTO p FROM material_plan_issue_bindings WHERE issue_id=issue_uuid;
  SELECT * INTO h FROM material_issues WHERE id=issue_uuid;
  PERFORM erp_mpi_validate_auth(auth_uuid,h.posted_at IS NOT NULL,h.posted_by_user_id);
 ELSIF TG_TABLE_NAME='material_plan_issue_bindings' THEN
  IF TG_OP='INSERT' THEN RETURN NULL; END IF;
  p:=NEW.policy_id;issue_uuid:=NEW.issue_id;auth_uuid:=NEW.authorization_id;actions:=ARRAY['DIRECT','DECIDE'];
  SELECT * INTO STRICT h FROM material_issues WHERE id=issue_uuid;
  IF h.posted_at IS NULL OR (SELECT count(*) FROM stock_transactions WHERE material_issue_id=issue_uuid AND movement_type='MATERIAL_ISSUE')<>(SELECT count(*) FROM material_issue_items WHERE material_issue_id=issue_uuid)
  THEN RAISE EXCEPTION 'Material plan issue canonical posting incomplete'; END IF;
  IF EXISTS(SELECT 1 FROM material_issue_items i WHERE i.material_issue_id=issue_uuid AND
   ((SELECT count(*) FROM stock_transactions st WHERE st.material_issue_item_id=i.id AND st.movement_type='MATERIAL_ISSUE')<>1 OR NOT EXISTS(SELECT 1 FROM stock_transactions st
    LEFT JOIN material_uom_issue_source_pins sp ON sp.issue_item_id=i.id
    LEFT JOIN material_uom_effect_pins ep ON ep.stock_transaction_id=st.id
     AND ep.company_id=st.company_id AND ep.material_id=st.material_id
    WHERE st.material_issue_item_id=i.id AND st.movement_type='MATERIAL_ISSUE'
     AND st.effect_key='material-issue:'||i.id::text
     AND st.quantity=-coalesce(sp.stock_quantity,i.quantity)
     AND st.uom_id=coalesce(sp.stock_uom_id,i.uom_id)
     AND (sp.issue_item_id IS NULL OR
       (ep.stock_transaction_id=st.id AND ep.stock_uom_id=sp.stock_uom_id
        AND ep.source_uom_id=sp.source_uom_id
        AND ep.stock_quantity=sp.stock_quantity
        AND ep.source_quantity=sp.source_quantity AND ep.effect_sign=-1)))))
  THEN RAISE EXCEPTION 'Material plan issue canonical posting incomplete'; END IF;
 ELSIF TG_TABLE_NAME='approval_actions' THEN
  SELECT * INTO a FROM material_plan_issue_authorizations WHERE approval_instance_id=NEW.approval_instance_id;
  IF NOT FOUND THEN RETURN NULL; END IF;
  issue_uuid:=a.issue_id;SELECT policy_id INTO p FROM material_plan_issue_bindings WHERE issue_id=issue_uuid;actor_uuid:=NEW.action_by_user_id;
  IF NEW.action='CANCEL' THEN actions:=ARRAY['DIRECT','SUBMIT']; ELSE auth_uuid:=a.id;actions:=ARRAY['REVIEW','DECIDE']; END IF;
 ELSE
  IF NEW.snapshot IS DISTINCT FROM erp_mpi_snapshot(NEW.policy_id,NEW.issue_id,NEW.authorization_id) OR NEW.outcome IS DISTINCT FROM erp_mpi_outcome(NEW.policy_id,NEW.issue_id,NEW.authorization_id)
  THEN RAISE EXCEPTION 'Material plan issue operation proof invalid'; END IF;
  RETURN NULL;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM material_plan_issue_operations o WHERE o.policy_id=p AND o.created_at=transaction_timestamp() AND o.action=ANY(actions)
  AND (issue_uuid IS NULL OR o.issue_id=issue_uuid) AND (auth_uuid IS NULL OR o.authorization_id=auth_uuid) AND (actor_uuid IS NULL OR o.actor_user_id=actor_uuid))
 THEN RAISE EXCEPTION 'Material plan issue operation proof required'; END IF;
 RETURN NULL;
END $$;


-- Plan-specific frozen converted sources are permitted only once the SQL
-- authority and exact immutable stock-overage/allocation proof are attached.
-- The legacy independent approval+same-transaction source guard remains.
CREATE OR REPLACE FUNCTION erp_material_uom_issue_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE header material_issues%ROWTYPE;
        item material_issue_items%ROWTYPE;
        basis material_uom_bases%ROWTYPE;
        source_unit units_of_measure%ROWTYPE;
        stock_unit units_of_measure%ROWTYPE;
        selected_revision material_uom_revisions%ROWTYPE;
        plan_authorized boolean:=false;
BEGIN
 IF TG_OP='INSERT' THEN PERFORM erp_material_uom_require_activation(NEW.company_id,NEW.material_id); END IF;
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'MATERIAL_UOM_ISSUE_SOURCE_IMMUTABLE'; END IF;
 SELECT * INTO header FROM material_issues WHERE id=NEW.issue_id FOR UPDATE;
 SELECT EXISTS(
  SELECT 1 FROM material_plan_issue_bindings binding
  JOIN material_plan_issue_authorizations authz
   ON authz.id=binding.authorization_id AND authz.issue_id=binding.issue_id
  JOIN material_plan_issue_allocations allocation
   ON allocation.authorization_id=authz.id AND allocation.issue_item_id=NEW.issue_item_id
  JOIN material_uom_plan_allocation_pins proof ON proof.allocation_id=allocation.id
  JOIN material_uom_plan_line_pins plan_source ON plan_source.plan_line_id=allocation.plan_line_id
  WHERE binding.issue_id=NEW.issue_id
   AND proof.company_id=NEW.company_id AND proof.material_id=NEW.material_id
   AND proof.source_uom_id=NEW.source_uom_id AND proof.source_quantity=NEW.source_quantity
   AND proof.stock_uom_id=NEW.stock_uom_id AND proof.stock_quantity=NEW.stock_quantity
   AND proof.business_date=NEW.business_date AND proof.basis_version=NEW.basis_version
   AND proof.revision_id IS NOT DISTINCT FROM NEW.revision_id
   AND proof.numerator=NEW.numerator AND proof.denominator=NEW.denominator
   AND plan_source.stock_uom_id=proof.stock_uom_id
   AND plan_source.stock_quantity=proof.plan_stock_quantity
   AND authz.mode IN ('DIRECT','OVERAGE')
 ) INTO plan_authorized;
 IF NOT FOUND OR header.company_id IS DISTINCT FROM NEW.company_id
   OR header.project_id IS DISTINCT FROM NEW.project_id
   OR header.warehouse_id IS DISTINCT FROM NEW.warehouse_id OR header.issue_date IS DISTINCT FROM NEW.business_date
   OR header.submitted_at IS NULL
   OR header.posted_at IS NOT NULL OR header.reversed_at IS NOT NULL
   OR (NOT plan_authorized AND (
       EXISTS(SELECT 1 FROM material_plan_issue_bindings WHERE issue_id=NEW.issue_id)
       OR header.approval_instance_id IS NULL
       OR NOT EXISTS(SELECT 1 FROM material_issues WHERE id=NEW.issue_id AND xmin=pg_current_xact_id()::xid)))
   OR (plan_authorized AND header.approval_instance_id IS NOT NULL)
 THEN RAISE EXCEPTION 'MATERIAL_UOM_ISSUE_SUBMISSION_REQUIRED'; END IF;
 SELECT * INTO item FROM material_issue_items WHERE id=NEW.issue_item_id AND material_issue_id=NEW.issue_id FOR UPDATE;
 IF NOT FOUND OR item.reservation_id IS NOT NULL OR item.material_id IS DISTINCT FROM NEW.material_id OR item.uom_id IS DISTINCT FROM NEW.source_uom_id
   OR item.quantity IS DISTINCT FROM NEW.source_quantity
 THEN RAISE EXCEPTION 'MATERIAL_UOM_ISSUE_SOURCE_MISMATCH'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('material-uom:'||NEW.company_id::text||':'||NEW.material_id::text,0));
 SELECT * INTO basis FROM material_uom_bases WHERE company_id=NEW.company_id AND material_id=NEW.material_id;
 IF NOT FOUND OR basis.stock_uom_id<>NEW.stock_uom_id OR basis.version<>NEW.basis_version
 THEN RAISE EXCEPTION 'MATERIAL_UOM_BASIS_MISMATCH'; END IF;
 SELECT * INTO source_unit FROM units_of_measure WHERE id=NEW.source_uom_id AND company_id=NEW.company_id AND is_active;
 SELECT * INTO stock_unit FROM units_of_measure WHERE id=NEW.stock_uom_id AND company_id=NEW.company_id AND is_active;
 IF source_unit.id IS NULL OR stock_unit.id IS NULL OR stock_unit.decimal_places<>basis.stock_precision
   OR NEW.source_quantity*NEW.numerator::numeric<>NEW.stock_quantity*NEW.denominator::numeric
   OR mod(NEW.source_quantity*power(10::numeric,source_unit.decimal_places),1)<>0
   OR mod(NEW.stock_quantity*power(10::numeric,basis.stock_precision),1)<>0
 THEN RAISE EXCEPTION 'MATERIAL_UOM_ISSUE_SOURCE_INVALID'; END IF;
 IF NEW.source_uom_id=NEW.stock_uom_id THEN
   IF NEW.revision_id IS NOT NULL OR NEW.numerator<>'1' OR NEW.denominator<>'1'
   THEN RAISE EXCEPTION 'MATERIAL_UOM_EFFECT_PIN_IDENTITY_REQUIRED'; END IF;
 ELSE
   SELECT * INTO selected_revision FROM material_uom_revisions WHERE company_id=NEW.company_id
     AND material_id=NEW.material_id AND source_uom_id=NEW.source_uom_id AND effective_from<=NEW.business_date
     ORDER BY effective_from DESC,revision_no DESC LIMIT 1;
   IF selected_revision.id IS NULL OR selected_revision.id IS DISTINCT FROM NEW.revision_id
     OR selected_revision.numerator<>NEW.numerator OR selected_revision.denominator<>NEW.denominator
     OR selected_revision.revision_no>NEW.basis_version OR selected_revision.source_precision<>source_unit.decimal_places
   THEN RAISE EXCEPTION 'MATERIAL_UOM_EFFECT_PIN_REVISION_MISMATCH'; END IF;
 END IF;
 RETURN NEW;
END $$;


CREATE OR REPLACE FUNCTION enforce_stock_transaction_source()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source RECORD; original RECORD; frozen material_uom_receipt_source_pins%ROWTYPE;
        reserved record; free_quantity numeric;
        returned_pin material_uom_effect_pins%ROWTYPE; prior_returned numeric;
        plan_bound boolean:=false; plan_auth uuid;
BEGIN
  IF NEW.goods_receipt_item_id IS NOT NULL THEN
    SELECT r.company_id,r.warehouse_id,r.project_id,r.posted_at,r.reversed_at,
      i.material_id,i.uom_id,i.quantity AS item_quantity
    INTO source FROM goods_receipts r JOIN goods_receipt_items i ON i.goods_receipt_id=r.id
    WHERE r.id=NEW.goods_receipt_id AND i.id=NEW.goods_receipt_item_id;
    IF NOT FOUND OR source.posted_at IS NULL OR NEW.company_id IS DISTINCT FROM source.company_id
      OR NEW.warehouse_id IS DISTINCT FROM source.warehouse_id OR NEW.project_id IS DISTINCT FROM source.project_id
      OR NEW.material_id IS DISTINCT FROM source.material_id
      OR NEW.wbs_id IS NOT NULL OR NEW.cost_code_id IS NOT NULL OR NEW.activity_id IS NOT NULL
    THEN RAISE EXCEPTION 'Receipt Stock movement source dimensions mismatch'; END IF;
    SELECT * INTO frozen FROM material_uom_receipt_source_pins WHERE receipt_item_id=NEW.goods_receipt_item_id;
    IF frozen.receipt_item_id IS NOT NULL THEN
      IF frozen.receipt_id IS DISTINCT FROM NEW.goods_receipt_id OR frozen.company_id IS DISTINCT FROM NEW.company_id
        OR frozen.project_id IS DISTINCT FROM NEW.project_id OR frozen.material_id IS DISTINCT FROM NEW.material_id
        OR frozen.source_uom_id IS DISTINCT FROM source.uom_id OR frozen.source_quantity IS DISTINCT FROM source.item_quantity
        OR NEW.uom_id IS DISTINCT FROM frozen.stock_uom_id
      THEN RAISE EXCEPTION 'MATERIAL_UOM_RECEIPT_LEDGER_SOURCE_MISMATCH'; END IF;
    ELSIF NEW.uom_id IS DISTINCT FROM source.uom_id THEN
      RAISE EXCEPTION 'Receipt Stock movement source dimensions mismatch';
    END IF;
    IF NEW.movement_type='GOODS_RECEIPT' THEN
      IF source.reversed_at IS NOT NULL OR NEW.quantity<>COALESCE(frozen.stock_quantity,source.item_quantity)
      THEN RAISE EXCEPTION 'Receipt movement quantity/state mismatch'; END IF;
      IF frozen.receipt_item_id IS NOT NULL THEN
        PERFORM erp_material_uom_assert_receipt_pin_current(frozen.receipt_item_id);
        IF NOT EXISTS(SELECT 1 FROM goods_receipts g JOIN approval_instances a ON a.id=g.approval_instance_id
          WHERE g.id=NEW.goods_receipt_id AND a.approval_state='APPROVED'
            AND g.posted_by_user_id=NEW.posted_by_user_id AND NEW.effect_key='receipt:'||frozen.receipt_item_id::text
            AND g.xmin=pg_current_xact_id()::xid)
        THEN RAISE EXCEPTION 'MATERIAL_UOM_RECEIPT_APPROVED_POST_REQUIRED'; END IF;
      END IF;
    ELSIF NEW.movement_type='GOODS_RECEIPT_REVERSAL' THEN
      SELECT * INTO original FROM stock_transactions WHERE id=NEW.reversal_of_id;
      IF NOT FOUND OR source.reversed_at IS NULL OR original.movement_type<>'GOODS_RECEIPT'
        OR original.goods_receipt_item_id<>NEW.goods_receipt_item_id OR original.quantity<>-NEW.quantity
        OR original.uom_id IS DISTINCT FROM NEW.uom_id
      THEN RAISE EXCEPTION 'Receipt reversal must exactly negate source'; END IF;
      IF frozen.receipt_item_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM material_uom_effect_pins WHERE stock_transaction_id=original.id)
        THEN RAISE EXCEPTION 'MATERIAL_UOM_ORIGINAL_REVERSAL_PIN_REQUIRED'; END IF;
    ELSE RAISE EXCEPTION 'Receipt source cannot use this movement type'; END IF;
  ELSIF NEW.material_issue_item_id IS NOT NULL THEN
    SELECT h.company_id,h.warehouse_id,h.project_id,h.posted_at,h.reversed_at,
      i.material_id,i.uom_id,i.quantity AS item_quantity,i.wbs_id,i.cost_code_id,i.activity_id,i.reservation_id
    INTO source FROM material_issues h JOIN material_issue_items i ON i.material_issue_id=h.id
    WHERE h.id=NEW.material_issue_id AND i.id=NEW.material_issue_item_id;
    IF NOT FOUND OR source.posted_at IS NULL OR NEW.company_id IS DISTINCT FROM source.company_id
      OR NEW.warehouse_id IS DISTINCT FROM source.warehouse_id OR NEW.project_id IS DISTINCT FROM source.project_id
      OR NEW.material_id IS DISTINCT FROM source.material_id
      OR NEW.wbs_id IS DISTINCT FROM source.wbs_id OR NEW.cost_code_id IS DISTINCT FROM source.cost_code_id
      OR NEW.activity_id IS DISTINCT FROM source.activity_id
    THEN RAISE EXCEPTION 'Issue Stock movement source dimensions mismatch'; END IF;
    SELECT * INTO reserved FROM erp_material_uom_issue_effect(NEW.material_issue_item_id);
    IF reserved.issue_item_id IS NOT NULL THEN
      IF (reserved.company_id,reserved.project_id,reserved.warehouse_id,reserved.material_id,
          reserved.source_uom_id,reserved.source_quantity,reserved.stock_uom_id)
        IS DISTINCT FROM (NEW.company_id,NEW.project_id,NEW.warehouse_id,NEW.material_id,
          source.uom_id,source.item_quantity,NEW.uom_id)
      THEN RAISE EXCEPTION 'MATERIAL_UOM_ISSUE_RESERVATION_SOURCE_MISMATCH'; END IF;
    ELSIF NEW.uom_id IS DISTINCT FROM source.uom_id THEN
      RAISE EXCEPTION 'Issue Stock movement source dimensions mismatch';
    END IF;
    IF NEW.movement_type='MATERIAL_ISSUE' THEN
      IF source.reversed_at IS NOT NULL OR NEW.quantity<>-COALESCE(reserved.stock_quantity,source.item_quantity)
      THEN RAISE EXCEPTION 'Issue movement quantity/state mismatch'; END IF;
      IF reserved.issue_item_id IS NOT NULL THEN
        IF reserved.reservation_id IS NULL THEN PERFORM erp_material_uom_assert_issue_pin_current(NEW.material_issue_item_id); END IF;
        SELECT EXISTS(SELECT 1 FROM material_plan_issue_bindings WHERE issue_id=NEW.material_issue_id)
           INTO plan_bound;
        IF plan_bound THEN
          IF reserved.reservation_id IS NOT NULL
           THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_RESERVATION_RECONCILIATION_REQUIRED'; END IF;
          SELECT authorization_id INTO plan_auth FROM material_plan_issue_bindings
           WHERE issue_id=NEW.material_issue_id;
          IF plan_auth IS NULL THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_AUTHORIZATION_REQUIRED'; END IF;
          PERFORM erp_mpi_validate_auth(plan_auth,true,NEW.posted_by_user_id);
          IF NOT EXISTS(
            SELECT 1 FROM material_plan_issue_allocations allocation
            JOIN material_uom_plan_allocation_pins proof ON proof.allocation_id=allocation.id
            WHERE allocation.authorization_id=plan_auth
              AND allocation.issue_item_id=NEW.material_issue_item_id
              AND proof.company_id=NEW.company_id AND proof.material_id=NEW.material_id
              AND proof.source_uom_id=source.uom_id AND proof.source_quantity=source.item_quantity
              AND proof.stock_uom_id=NEW.uom_id AND proof.stock_quantity=-NEW.quantity
              AND proof.business_date=(SELECT issue_date FROM material_issues
                WHERE id=NEW.material_issue_id)
          ) THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_STOCK_EFFECT_UNAUTHORIZED'; END IF;
        END IF;
        PERFORM pg_advisory_xact_lock(hashtext('inventory-stock:'||NEW.company_id::text||':'||NEW.warehouse_id::text||':'||NEW.material_id::text||':'||NEW.project_id::text||':'||NEW.uom_id::text));
        IF reserved.reservation_id IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtext('inventory-reservation:'||reserved.reservation_id::text)); END IF;
        IF (reserved.reservation_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM material_reservations WHERE id=reserved.reservation_id AND status='ACTIVE'))
        OR NOT EXISTS(SELECT 1 FROM material_issues h
          WHERE h.id=NEW.material_issue_id AND h.posted_by_user_id=NEW.posted_by_user_id
            AND NEW.effect_key='material-issue:'||NEW.material_issue_item_id::text
            AND h.xmin=pg_current_xact_id()::xid
            AND (plan_bound OR EXISTS(SELECT 1 FROM approval_instances a
              WHERE a.id=h.approval_instance_id AND a.approval_state='APPROVED')))
        THEN RAISE EXCEPTION 'MATERIAL_UOM_ISSUE_APPROVED_POST_REQUIRED'; END IF;
        SELECT COALESCE((SELECT SUM(t.quantity) FROM stock_transactions t WHERE t.company_id=NEW.company_id
          AND t.project_id=NEW.project_id AND t.warehouse_id=NEW.warehouse_id AND t.material_id=NEW.material_id AND t.uom_id=NEW.uom_id),0)
          -COALESCE((SELECT SUM(COALESCE(p.stock_quantity,a.quantity)) FROM material_reservations a
           LEFT JOIN material_uom_reservation_pins p ON p.reservation_id=a.id WHERE a.company_id=NEW.company_id
           AND a.project_id=NEW.project_id AND a.warehouse_id=NEW.warehouse_id AND a.material_id=NEW.material_id
           AND COALESCE(p.stock_uom_id,a.uom_id)=NEW.uom_id AND a.status='ACTIVE' AND (reserved.reservation_id IS NULL OR a.id<>reserved.reservation_id)),0)
          INTO free_quantity;
        IF reserved.stock_quantity>free_quantity THEN RAISE EXCEPTION 'MATERIAL_ISSUE_INSUFFICIENT_AVAILABLE'; END IF;
      END IF;
    ELSIF NEW.movement_type='MATERIAL_ISSUE_REVERSAL' THEN
      SELECT * INTO original FROM stock_transactions WHERE id=NEW.reversal_of_id;
      IF NOT FOUND OR source.reversed_at IS NULL OR original.movement_type<>'MATERIAL_ISSUE'
        OR original.material_issue_item_id<>NEW.material_issue_item_id OR original.quantity<>-NEW.quantity
        OR original.uom_id IS DISTINCT FROM NEW.uom_id
      THEN RAISE EXCEPTION 'Issue reversal must exactly negate source'; END IF;
      IF reserved.issue_item_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM material_uom_effect_pins WHERE stock_transaction_id=original.id)
      THEN RAISE EXCEPTION 'MATERIAL_UOM_ORIGINAL_REVERSAL_PIN_REQUIRED'; END IF;
    ELSE RAISE EXCEPTION 'Issue source cannot use this movement type'; END IF;
  ELSIF NEW.material_return_item_id IS NOT NULL THEN
    SELECT h.company_id,h.warehouse_id,h.project_id,h.posted_at,h.reversed_at,
      i.material_id,i.uom_id,i.quantity AS item_quantity,i.material_issue_item_id,
      src.wbs_id,src.cost_code_id,src.activity_id,src.quantity AS issued_quantity
    INTO source
    FROM material_returns h
    JOIN material_return_items i ON i.material_return_id=h.id
    JOIN material_issue_items src ON src.id=i.material_issue_item_id
    WHERE h.id=NEW.material_return_id AND i.id=NEW.material_return_item_id;
    IF NOT FOUND OR source.posted_at IS NULL OR NEW.company_id IS DISTINCT FROM source.company_id
      OR NEW.warehouse_id IS DISTINCT FROM source.warehouse_id OR NEW.project_id IS DISTINCT FROM source.project_id
      OR NEW.material_id IS DISTINCT FROM source.material_id
      OR NEW.wbs_id IS DISTINCT FROM source.wbs_id OR NEW.cost_code_id IS DISTINCT FROM source.cost_code_id
      OR NEW.activity_id IS DISTINCT FROM source.activity_id
    THEN RAISE EXCEPTION 'Return Stock movement source dimensions mismatch'; END IF;
    SELECT * INTO returned_pin FROM erp_material_uom_return_effect(NEW.material_return_item_id);
    IF returned_pin.stock_transaction_id IS NOT NULL THEN
      IF NEW.uom_id IS DISTINCT FROM returned_pin.stock_uom_id
      THEN RAISE EXCEPTION 'MATERIAL_UOM_RETURN_SOURCE_MISMATCH'; END IF;
    ELSIF NEW.uom_id IS DISTINCT FROM source.uom_id THEN
      RAISE EXCEPTION 'Return Stock movement source dimensions mismatch';
    END IF;
    IF NEW.movement_type='MATERIAL_RETURN' THEN
      IF source.reversed_at IS NOT NULL OR NEW.quantity<>COALESCE(returned_pin.stock_quantity,source.item_quantity)
      THEN RAISE EXCEPTION 'Return movement quantity/state mismatch'; END IF;
      IF returned_pin.stock_transaction_id IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtext('inventory-return-source:'||source.material_issue_item_id::text));
        PERFORM pg_advisory_xact_lock(hashtext('inventory-stock:'||NEW.company_id::text||':'||NEW.warehouse_id::text||':'||NEW.material_id::text||':'||NEW.project_id::text||':'||NEW.uom_id::text));
        IF NOT EXISTS(SELECT 1 FROM material_issue_items i JOIN material_issues h ON h.id=i.material_issue_id
            WHERE i.id=source.material_issue_item_id AND h.posted_at IS NOT NULL AND h.reversed_at IS NULL
             AND h.company_id=NEW.company_id AND h.project_id=NEW.project_id)
          OR NOT EXISTS(SELECT 1 FROM material_returns h JOIN approval_instances a ON a.id=h.approval_instance_id
            WHERE h.id=NEW.material_return_id AND a.approval_state='APPROVED'
              AND h.posted_by_user_id=NEW.posted_by_user_id AND NEW.effect_key='material-return:'||NEW.material_return_item_id::text
              AND h.xmin=pg_current_xact_id()::xid)
        THEN RAISE EXCEPTION 'MATERIAL_UOM_RETURN_APPROVED_POST_REQUIRED'; END IF;
        SELECT COALESCE(SUM(i.quantity),0) INTO prior_returned FROM material_return_items i
          JOIN material_returns h ON h.id=i.material_return_id
          WHERE i.material_issue_item_id=source.material_issue_item_id AND i.id<>NEW.material_return_item_id
            AND h.posted_at IS NOT NULL AND h.reversed_at IS NULL;
        IF prior_returned+source.item_quantity>source.issued_quantity
        THEN RAISE EXCEPTION 'MATERIAL_RETURN_EXCEEDS_ISSUED'; END IF;
      END IF;
    ELSIF NEW.movement_type='MATERIAL_RETURN_REVERSAL' THEN
      SELECT * INTO original FROM stock_transactions WHERE id=NEW.reversal_of_id;
      IF NOT FOUND OR source.reversed_at IS NULL OR original.movement_type<>'MATERIAL_RETURN'
        OR original.material_return_item_id<>NEW.material_return_item_id OR original.quantity<>-NEW.quantity
        OR original.uom_id IS DISTINCT FROM NEW.uom_id
      THEN RAISE EXCEPTION 'Return reversal must exactly negate source'; END IF;
      IF returned_pin.stock_transaction_id IS NOT NULL THEN
        IF NOT EXISTS(SELECT 1 FROM material_uom_effect_pins WHERE stock_transaction_id=original.id)
        THEN RAISE EXCEPTION 'MATERIAL_UOM_ORIGINAL_REVERSAL_PIN_REQUIRED'; END IF;
        PERFORM pg_advisory_xact_lock(hashtext('inventory-return-source:'||source.material_issue_item_id::text));
        PERFORM pg_advisory_xact_lock(hashtext('inventory-stock:'||NEW.company_id::text||':'||NEW.warehouse_id::text||':'||NEW.material_id::text||':'||NEW.project_id::text||':'||NEW.uom_id::text));
        SELECT COALESCE((SELECT SUM(t.quantity) FROM stock_transactions t WHERE t.company_id=NEW.company_id
          AND t.project_id=NEW.project_id AND t.warehouse_id=NEW.warehouse_id AND t.material_id=NEW.material_id AND t.uom_id=NEW.uom_id),0)
          -COALESCE((SELECT SUM(COALESCE(p.stock_quantity,a.quantity)) FROM material_reservations a
           LEFT JOIN material_uom_reservation_pins p ON p.reservation_id=a.id WHERE a.company_id=NEW.company_id
           AND a.project_id=NEW.project_id AND a.warehouse_id=NEW.warehouse_id AND a.material_id=NEW.material_id
           AND COALESCE(p.stock_uom_id,a.uom_id)=NEW.uom_id AND a.status='ACTIVE'),0) INTO free_quantity;
        IF -NEW.quantity>free_quantity THEN RAISE EXCEPTION 'MATERIAL_RETURN_REVERSAL_INSUFFICIENT_AVAILABLE'; END IF;
      END IF;
    ELSE RAISE EXCEPTION 'Return source cannot use this movement type'; END IF;
  ELSIF NEW.stock_transfer_item_id IS NOT NULL THEN
    IF NEW.movement_type IN ('STOCK_TRANSFER_OUT','STOCK_TRANSFER_IN') AND EXISTS(
      SELECT 1 FROM erp_material_uom_tracked_stock_basis(NEW.company_id,NEW.material_id) b
      WHERE b.stock_uom_id<>NEW.uom_id OR mod(NEW.quantity*power(10::numeric,b.stock_precision),1)<>0)
    THEN RAISE EXCEPTION 'MATERIAL_UOM_CANONICAL_STOCK_UNIT_REQUIRED'; END IF;
    IF EXISTS(SELECT 1 FROM transfer_custodies WHERE transfer_id=NEW.stock_transfer_id) THEN
      PERFORM erp_transfer_validate_movement(NEW); RETURN NEW;
    END IF;
    IF NEW.transfer_receipt_line_id IS NOT NULL THEN RAISE EXCEPTION 'TRANSFER_LEGACY_RECEIPT_PROVENANCE_INVALID'; END IF;
    SELECT h.company_id,h.source_warehouse_id,h.destination_warehouse_id,h.posted_at,h.reversed_at,
      i.material_id,i.uom_id,i.quantity AS item_quantity,i.source_project_id,i.destination_project_id
    INTO source
    FROM stock_transfers h JOIN stock_transfer_items i ON i.stock_transfer_id=h.id
    WHERE h.id=NEW.stock_transfer_id AND i.id=NEW.stock_transfer_item_id;
    IF NOT FOUND OR source.posted_at IS NULL OR NEW.company_id IS DISTINCT FROM source.company_id
      OR NEW.material_id IS DISTINCT FROM source.material_id OR NEW.uom_id IS DISTINCT FROM source.uom_id
      OR NEW.wbs_id IS NOT NULL OR NEW.cost_code_id IS NOT NULL OR NEW.activity_id IS NOT NULL
    THEN RAISE EXCEPTION 'Transfer Stock movement source dimensions mismatch'; END IF;
    IF NEW.movement_type='STOCK_TRANSFER_OUT' THEN
      IF source.reversed_at IS NOT NULL OR NEW.warehouse_id IS DISTINCT FROM source.source_warehouse_id
        OR NEW.project_id IS DISTINCT FROM source.source_project_id OR NEW.quantity<>-source.item_quantity
      THEN RAISE EXCEPTION 'Transfer OUT movement quantity/state mismatch'; END IF;
    ELSIF NEW.movement_type='STOCK_TRANSFER_IN' THEN
      IF source.reversed_at IS NOT NULL OR NEW.warehouse_id IS DISTINCT FROM source.destination_warehouse_id
        OR NEW.project_id IS DISTINCT FROM source.destination_project_id OR NEW.quantity<>source.item_quantity
      THEN RAISE EXCEPTION 'Transfer IN movement quantity/state mismatch'; END IF;
    ELSIF NEW.movement_type='STOCK_TRANSFER_OUT_REVERSAL' THEN
      SELECT * INTO original FROM stock_transactions WHERE id=NEW.reversal_of_id;
      IF NOT FOUND OR source.reversed_at IS NULL OR original.movement_type<>'STOCK_TRANSFER_OUT'
        OR original.stock_transfer_item_id<>NEW.stock_transfer_item_id OR original.quantity<>-NEW.quantity
      THEN RAISE EXCEPTION 'Transfer OUT reversal must exactly negate source'; END IF;
    ELSIF NEW.movement_type='STOCK_TRANSFER_IN_REVERSAL' THEN
      SELECT * INTO original FROM stock_transactions WHERE id=NEW.reversal_of_id;
      IF NOT FOUND OR source.reversed_at IS NULL OR original.movement_type<>'STOCK_TRANSFER_IN'
        OR original.stock_transfer_item_id<>NEW.stock_transfer_item_id OR original.quantity<>-NEW.quantity
      THEN RAISE EXCEPTION 'Transfer IN reversal must exactly negate source'; END IF;
    ELSE RAISE EXCEPTION 'Transfer source cannot use this movement type'; END IF;
  ELSIF NEW.stock_count_id IS NOT NULL THEN
    SELECT c.company_id,c.project_id,c.warehouse_id,c.material_id,c.uom_id,c.status,
      c.variance_quantity,c.decided_by_user_id,c.post_key
    INTO source FROM stock_counts c WHERE c.id=NEW.stock_count_id;
    IF NOT FOUND OR source.status<>'APPROVED'
      OR NEW.company_id IS DISTINCT FROM source.company_id
      OR NEW.project_id IS DISTINCT FROM source.project_id
      OR NEW.warehouse_id IS DISTINCT FROM source.warehouse_id
      OR NEW.material_id IS DISTINCT FROM source.material_id
      OR NEW.uom_id IS DISTINCT FROM source.uom_id
      OR NEW.wbs_id IS NOT NULL OR NEW.cost_code_id IS NOT NULL OR NEW.activity_id IS NOT NULL
      OR NEW.posted_by_user_id IS DISTINCT FROM source.decided_by_user_id
      OR NEW.effect_key IS DISTINCT FROM ('stock-count:' || NEW.stock_count_id::text || ':' || source.post_key)
    THEN RAISE EXCEPTION 'Stock count movement source dimensions mismatch'; END IF;
    IF EXISTS(SELECT 1 FROM erp_material_uom_tracked_stock_basis(NEW.company_id,NEW.material_id) b WHERE b.stock_uom_id<>NEW.uom_id OR mod(NEW.quantity*power(10::numeric,b.stock_precision),1)<>0)
    THEN RAISE EXCEPTION 'MATERIAL_UOM_CANONICAL_STOCK_UNIT_REQUIRED'; END IF;
    IF NEW.movement_type<>'STOCK_COUNT_ADJUSTMENT'
      OR NEW.quantity<>source.variance_quantity OR NEW.quantity=0
    THEN RAISE EXCEPTION 'Stock count movement quantity/state mismatch'; END IF;
  ELSE
    RAISE EXCEPTION 'Stock Transaction requires a supported source family';
  END IF;
  RETURN NEW;
END; $$;

-- Converted stock authority replaces only the earlier Stage C temporary
-- all-converted allocation blocker. Immutable allocation pin, deferred proof,
-- canonical revalidation, full original maker/checker and source/effect
-- receipt guards are now active. Never change the legacy CHECK on overage.
DROP TRIGGER material_uom_plan_block_unreconciled_issue ON material_plan_issue_allocations;
