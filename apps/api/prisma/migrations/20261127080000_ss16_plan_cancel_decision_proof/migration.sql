-- Forward-only repair: SS16 independent cancellation must not require the PM
-- to hold the Store posting capability or fabricate a DIRECT/SUBMIT operation.
-- Preserve the legacy maker reauthorization path and all UOM posting proofs.
CREATE FUNCTION erp_ss16_mpi_cancel_proof(original_id uuid, actor_id uuid, original_step uuid)
RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(
  SELECT 1 FROM movement_correction_requests c
  JOIN material_issues i ON i.id=c.source_id AND i.company_id=c.company_id
    AND i.submitted_at=c.source_submitted_at AND i.posted_at IS NULL AND i.reversed_at IS NULL
  JOIN material_plan_issue_bindings b ON b.issue_id=i.id AND b.authorization_id IS NULL
  JOIN material_plan_project_policies p ON p.id=b.policy_id AND p.company_id=c.company_id AND p.project_id=i.project_id
  JOIN material_plan_issue_authorizations m ON m.issue_id=i.id AND m.mode='OVERAGE'
    AND m.approval_instance_id=original_id
    AND m.sequence=(SELECT max(z.sequence) FROM material_plan_issue_authorizations z WHERE z.issue_id=i.id)
  JOIN approval_instances o ON o.id=m.approval_instance_id AND o.company_id=c.company_id
    AND o.entity_type='MATERIAL_PLAN_OVERAGE' AND o.entity_id=m.id
    AND o.approval_state IN ('SUBMITTED','CANCELLED')
  JOIN approval_steps os ON os.id=original_step AND os.approval_workflow_id=o.approval_workflow_id AND os.step_no=o.current_step_no
  JOIN approval_instances a ON a.id=c.approval_instance_id AND a.company_id=c.company_id
    AND a.entity_type='MOVEMENT_CORRECTION' AND a.entity_id=c.id AND a.approval_state='APPROVED'
    AND a.xmin=pg_current_xact_id()::xid
  JOIN approval_workflows w ON w.id=a.approval_workflow_id AND w.company_id=c.company_id AND w.is_active
    AND w.entity_type='MOVEMENT_CORRECTION' AND w.workflow_code='SS16_MOVEMENT_CORRECTION'
  JOIN approval_actions d ON d.approval_instance_id=a.id AND d.action='APPROVE' AND d.action_by_user_id=actor_id
    AND d.xmin=pg_current_xact_id()::xid
  JOIN approval_steps st ON st.id=d.approval_step_id AND st.approval_workflow_id=w.id AND st.required_approvals=1
  JOIN approval_step_roles sr ON sr.approval_step_id=st.id
  JOIN roles r ON r.id=sr.role_id AND r.company_id=c.company_id AND r.is_active AND r.role_code='PROJECT_MANAGER'
  JOIN user_roles ur ON ur.role_id=r.id AND ur.company_id=c.company_id AND ur.user_id=actor_id
  JOIN users u ON u.id=actor_id AND u.company_id=c.company_id AND u.is_active
  JOIN companies co ON co.id=c.company_id AND co.is_active
  JOIN employees e ON e.id=u.employee_id AND e.company_id=c.company_id AND e.is_active
  JOIN project_members pm ON pm.employee_id=e.id AND pm.project_id=i.project_id AND pm.is_active
  JOIN projects pr ON pr.id=i.project_id AND pr.company_id=c.company_id AND pr.is_active
  WHERE c.source_kind='MATERIAL_ISSUE' AND c.source_posted_at IS NULL
    AND c.source_approval_instance_id=original_id AND c.requested_by_user_id<>actor_id
    AND (SELECT count(*) FROM approval_steps WHERE approval_workflow_id=w.id)=1
    AND (SELECT count(*) FROM approval_step_roles WHERE approval_step_id=st.id)=1
    AND (SELECT count(DISTINCT pe.permission_code) FROM role_permissions rp JOIN permissions pe ON pe.id=rp.permission_id
      WHERE rp.role_id=r.id AND pe.permission_code IN ('inventory.issue.view','inventory.issue.approve','inventory.issue.reverse'))=3
    AND NOT EXISTS(SELECT 1 FROM stock_transactions WHERE material_issue_id=i.id)
 );
$$;

CREATE OR REPLACE FUNCTION erp_mpi_approval_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ai RECORD; a RECORD; h RECORD; p RECORD; first_step RECORD; final_step RECORD; cap text;
BEGIN
 SELECT * INTO ai FROM approval_instances WHERE id=NEW.approval_instance_id;
 IF ai.entity_type<>'MATERIAL_PLAN_OVERAGE' THEN RETURN NEW; END IF;
 PERFORM erp_mpi_serializable();SELECT * INTO STRICT a FROM material_plan_issue_authorizations WHERE id=ai.entity_id AND approval_instance_id=ai.id;
 SELECT * INTO STRICT h FROM material_issues WHERE id=a.issue_id;
 SELECT po.* INTO STRICT p FROM material_plan_issue_bindings b JOIN material_plan_project_policies po ON po.id=b.policy_id WHERE b.issue_id=h.id;
 IF ai.approval_state<>'SUBMITTED' OR h.posted_at IS NOT NULL OR h.reversed_at IS NOT NULL OR a.sequence<>(SELECT max(sequence) FROM material_plan_issue_authorizations WHERE issue_id=h.id)
  OR (NEW.action<>'CANCEL' AND (NOT erp_mpi_workflow_valid(p.approval_workflow_id,p.company_id) OR a.workflow_digest IS DISTINCT FROM erp_mpi_workflow_digest(p.approval_workflow_id)))
 THEN RAISE EXCEPTION 'Material plan issue approval configuration stale'; END IF;
 IF NEW.action='CANCEL' THEN
  -- An independent SS16 cancellation is not an issue-post operation. Its
  -- narrowly scoped proof must be present in this transaction, not historical.
  IF erp_ss16_mpi_cancel_proof(ai.id,NEW.action_by_user_id,NEW.approval_step_id) THEN
   NEW.action_at:=transaction_timestamp();RETURN NEW;
  END IF;
  cap:='inventory.material_plan.issue.post';
 ELSE
  SELECT * INTO STRICT first_step FROM approval_steps WHERE approval_workflow_id=p.approval_workflow_id ORDER BY step_no LIMIT 1;
  SELECT * INTO STRICT final_step FROM approval_steps WHERE approval_workflow_id=p.approval_workflow_id ORDER BY step_no DESC LIMIT 1;
  cap:=CASE WHEN NEW.approval_step_id=first_step.id THEN 'inventory.material_plan.overage.review' WHEN NEW.approval_step_id=final_step.id THEN 'inventory.material_plan.overage.approve' END;
  IF NEW.action NOT IN ('APPROVE','REJECT') OR cap IS NULL OR NEW.action_by_user_id=ANY(ARRAY[h.created_by_user_id,h.submitted_by_user_id,a.created_by_user_id])
   OR NEW.approval_step_id<>(SELECT id FROM approval_steps WHERE approval_workflow_id=p.approval_workflow_id AND step_no=ai.current_step_no)
   OR NOT erp_mpi_step_role(NEW.action_by_user_id,NEW.approval_step_id,p.company_id)
   OR EXISTS(SELECT 1 FROM approval_actions WHERE approval_instance_id=ai.id AND action='APPROVE' AND action_by_user_id=NEW.action_by_user_id)
   OR (NEW.approval_step_id=final_step.id AND NOT EXISTS(SELECT 1 FROM approval_actions WHERE approval_instance_id=ai.id AND approval_step_id=first_step.id AND action='APPROVE'))
  THEN RAISE EXCEPTION 'Material plan issue independent approval required'; END IF;
  PERFORM erp_mpi_validate_auth(a.id,false);
 END IF;
 IF NOT erp_mpi_scope(NEW.action_by_user_id,p.company_id,p.project_id,cap) THEN RAISE EXCEPTION 'Material plan issue actor authority invalid'; END IF;
 NEW.action_at:=transaction_timestamp();RETURN NEW;
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
    LEFT JOIN LATERAL erp_material_uom_issue_effect(i.id) sp ON true
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
  IF NEW.action='CANCEL' THEN
   IF erp_ss16_mpi_cancel_proof(NEW.approval_instance_id,NEW.action_by_user_id,NEW.approval_step_id)
     AND EXISTS(SELECT 1 FROM approval_instances ai WHERE ai.id=NEW.approval_instance_id AND ai.approval_state='CANCELLED'
       AND ai.xmin=pg_current_xact_id()::xid)
     AND erp_ss16_terminal_plan_issue(issue_uuid) THEN RETURN NULL; END IF;
   actions:=ARRAY['DIRECT','SUBMIT'];
  ELSE auth_uuid:=a.id;actions:=ARRAY['REVIEW','DECIDE']; END IF;
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
