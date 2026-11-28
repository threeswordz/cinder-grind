-- SS16 independent review: bind source, request, workflow and approval;
-- freeze correction decisions/actions without rewriting earlier migrations.
CREATE FUNCTION ss16_validate_request_insert() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a RECORD; h RECORD; source_table text; original RECORD; plan RECORD; expected_id uuid; expected_type text; expected_entity uuid;
BEGIN
 SELECT ai.*,w.company_id AS workflow_company,w.entity_type AS workflow_type,w.workflow_code
 INTO a FROM approval_instances ai JOIN approval_workflows w ON w.id=ai.approval_workflow_id WHERE ai.id=NEW.approval_instance_id FOR UPDATE OF ai;
 IF NOT FOUND OR a.company_id<>NEW.company_id OR a.entity_type<>'MOVEMENT_CORRECTION' OR a.entity_id<>NEW.id
 OR a.workflow_company<>NEW.company_id OR a.workflow_type<>'MOVEMENT_CORRECTION' OR a.workflow_code<>'SS16_MOVEMENT_CORRECTION'
 OR a.approval_state<>'SUBMITTED' OR a.completed_at IS NOT NULL
 OR EXISTS(SELECT 1 FROM approval_actions WHERE approval_instance_id=NEW.approval_instance_id)
 THEN RAISE EXCEPTION 'SS16 reciprocal approval binding invalid' USING ERRCODE='23514'; END IF;
 source_table:=CASE NEW.source_kind WHEN 'GOODS_RECEIPT' THEN 'goods_receipts' WHEN 'MATERIAL_ISSUE' THEN 'material_issues'
 WHEN 'MATERIAL_RETURN' THEN 'material_returns' WHEN 'STOCK_TRANSFER' THEN 'stock_transfers' END;
 IF source_table IS NULL THEN RAISE EXCEPTION 'SS16 source pin invalid' USING ERRCODE='23514'; END IF;
 EXECUTE format('SELECT id,company_id,posted_at,reversed_at,submitted_at,approval_instance_id FROM %I WHERE id=$1 AND company_id=$2 FOR UPDATE',source_table)
 INTO h USING NEW.source_id,NEW.company_id;
 IF h.id IS NULL OR h.reversed_at IS NOT NULL OR h.posted_at IS DISTINCT FROM NEW.source_posted_at
 THEN RAISE EXCEPTION 'SS16 source pin invalid' USING ERRCODE='23514'; END IF;
 IF NEW.source_posted_at IS NULL THEN
   expected_id:=h.approval_instance_id;expected_type:=NEW.source_kind;expected_entity:=NEW.source_id;
   IF NEW.source_kind='MATERIAL_ISSUE' AND EXISTS(SELECT 1 FROM material_plan_issue_bindings WHERE issue_id=h.id) THEN
     SELECT m.id,m.approval_instance_id,m.mode INTO plan FROM material_plan_issue_authorizations m
      JOIN material_plan_issue_bindings b ON b.issue_id=m.issue_id AND b.authorization_id IS NULL
      JOIN material_plan_project_policies p ON p.id=b.policy_id AND p.company_id=NEW.company_id
      WHERE m.issue_id=h.id ORDER BY m.sequence DESC LIMIT 1;
     IF NOT FOUND OR plan.mode<>'OVERAGE' THEN RAISE EXCEPTION 'SS16 source pin invalid' USING ERRCODE='23514'; END IF;
     expected_id:=plan.approval_instance_id;expected_type:='MATERIAL_PLAN_OVERAGE';expected_entity:=plan.id;
   END IF;
   IF h.submitted_at IS NULL OR h.submitted_at IS DISTINCT FROM NEW.source_submitted_at OR expected_id IS NULL
      OR expected_id IS DISTINCT FROM NEW.source_approval_instance_id THEN RAISE EXCEPTION 'SS16 source pin invalid' USING ERRCODE='23514'; END IF;
   SELECT * INTO original FROM approval_instances WHERE id=expected_id FOR UPDATE;
   IF NOT FOUND OR original.company_id<>NEW.company_id OR original.entity_type<>expected_type OR original.entity_id<>expected_entity
    OR NOT(original.approval_state='SUBMITTED' OR (NEW.source_kind='STOCK_TRANSFER' AND original.approval_state='APPROVED'
      AND EXISTS(SELECT 1 FROM transfer_custodies WHERE transfer_id=h.id AND company_id=NEW.company_id)
      AND NOT EXISTS(SELECT 1 FROM transfer_dispatches WHERE transfer_id=h.id)))
    THEN RAISE EXCEPTION 'SS16 original approval pin invalid' USING ERRCODE='23514'; END IF;
 END IF;
 IF EXISTS(SELECT 1 FROM movement_correction_requests c JOIN approval_instances i ON i.id=c.approval_instance_id
  WHERE c.company_id=NEW.company_id AND c.source_kind=NEW.source_kind AND c.source_id=NEW.source_id AND i.approval_state='SUBMITTED')
 THEN RAISE EXCEPTION 'SS16 pending request already exists' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ss16_request_binding_guard BEFORE INSERT ON movement_correction_requests FOR EACH ROW EXECUTE FUNCTION ss16_validate_request_insert();

CREATE FUNCTION ss16_approval_identity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN
  IF OLD.entity_type='MOVEMENT_CORRECTION' OR EXISTS(SELECT 1 FROM movement_correction_requests WHERE approval_instance_id=OLD.id)
   THEN RAISE EXCEPTION 'SS16 approval history immutable' USING ERRCODE='23514'; END IF;
  RETURN OLD;
 END IF;
 IF EXISTS(SELECT 1 FROM movement_correction_requests WHERE source_approval_instance_id=OLD.id)
  AND ROW(NEW.id,NEW.company_id,NEW.entity_type,NEW.entity_id,NEW.approval_workflow_id,NEW.started_at)
      IS DISTINCT FROM ROW(OLD.id,OLD.company_id,OLD.entity_type,OLD.entity_id,OLD.approval_workflow_id,OLD.started_at)
  THEN RAISE EXCEPTION 'SS16 original approval identity immutable' USING ERRCODE='23514'; END IF;
 IF OLD.entity_type='MOVEMENT_CORRECTION' OR NEW.entity_type='MOVEMENT_CORRECTION'
 OR EXISTS(SELECT 1 FROM movement_correction_requests WHERE approval_instance_id=OLD.id OR approval_instance_id=NEW.id) THEN
  IF OLD.entity_type<>'MOVEMENT_CORRECTION' OR NEW.entity_type<>'MOVEMENT_CORRECTION'
    OR ROW(NEW.id,NEW.company_id,NEW.entity_type,NEW.entity_id,NEW.approval_workflow_id,NEW.current_step_no,NEW.started_at)
       IS DISTINCT FROM ROW(OLD.id,OLD.company_id,OLD.entity_type,OLD.entity_id,OLD.approval_workflow_id,OLD.current_step_no,OLD.started_at)
    OR OLD.approval_state<>'SUBMITTED' OR NEW.approval_state NOT IN ('APPROVED','REJECTED') OR NEW.completed_at IS NULL
    THEN RAISE EXCEPTION 'SS16 approval history immutable' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ss16_approval_identity_guard BEFORE UPDATE OR DELETE ON approval_instances FOR EACH ROW EXECUTE FUNCTION ss16_approval_identity_guard();

CREATE FUNCTION ss16_approval_action_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a RECORD; c RECORD;
BEGIN
 IF TG_OP<>'INSERT' THEN
  IF EXISTS(SELECT 1 FROM approval_instances WHERE id=OLD.approval_instance_id AND entity_type='MOVEMENT_CORRECTION')
  
   THEN RAISE EXCEPTION 'SS16 approval action immutable' USING ERRCODE='23514'; END IF;
  IF TG_OP='DELETE' THEN RETURN OLD; END IF;
  IF EXISTS(SELECT 1 FROM approval_instances WHERE id=NEW.approval_instance_id AND entity_type='MOVEMENT_CORRECTION')
   THEN RAISE EXCEPTION 'SS16 approval action immutable' USING ERRCODE='23514'; END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO a FROM approval_instances WHERE id=NEW.approval_instance_id AND entity_type='MOVEMENT_CORRECTION' FOR UPDATE;
 IF NOT FOUND THEN RETURN NEW; END IF;
 SELECT * INTO c FROM movement_correction_requests WHERE approval_instance_id=a.id;
 IF NOT FOUND OR a.approval_state<>'SUBMITTED' OR a.entity_id<>c.id OR a.company_id<>c.company_id
  OR NEW.action NOT IN ('APPROVE','REJECT') OR NEW.action_by_user_id=c.requested_by_user_id
  OR NEW.comment IS NULL OR length(btrim(NEW.comment)) NOT BETWEEN 1 AND 1000
  OR EXISTS(SELECT 1 FROM approval_actions WHERE approval_instance_id=a.id)
  OR NOT EXISTS(SELECT 1 FROM approval_steps s JOIN approval_step_roles sr ON sr.approval_step_id=s.id
    JOIN roles r ON r.id=sr.role_id AND r.company_id=c.company_id AND r.role_code='PROJECT_MANAGER' AND r.is_active
    JOIN user_roles ur ON ur.role_id=r.id AND ur.company_id=c.company_id AND ur.user_id=NEW.action_by_user_id
    JOIN users u ON u.id=ur.user_id AND u.company_id=c.company_id AND u.is_active
    WHERE s.id=NEW.approval_step_id AND s.approval_workflow_id=a.approval_workflow_id AND s.step_no=a.current_step_no AND s.required_approvals=1)
 THEN RAISE EXCEPTION 'SS16 correction decision action invalid' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ss16_approval_action_guard BEFORE INSERT OR UPDATE OR DELETE ON approval_actions FOR EACH ROW EXECUTE FUNCTION ss16_approval_action_guard();

-- Deferred: ApprovalService inserts the action and sets state before the
-- canonical stock/cancellation callback. Validate the committed outcome, not
-- an intermediate step. Also deny orphan correction approvals/actions.
CREATE FUNCTION ss16_check_committed_decision() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE aid uuid; a RECORD; c RECORD; d RECORD; h RECORD; source_table text; n integer;
BEGIN
 IF TG_TABLE_NAME='approval_instances' THEN aid:=NEW.id;
 ELSIF TG_TABLE_NAME='approval_actions' THEN aid:=NEW.approval_instance_id;
 ELSE aid:=NEW.approval_instance_id; END IF;
 SELECT * INTO a FROM approval_instances WHERE id=aid;
 IF NOT FOUND OR a.entity_type<>'MOVEMENT_CORRECTION' THEN RETURN NULL; END IF;
 SELECT * INTO c FROM movement_correction_requests WHERE approval_instance_id=aid;
 IF NOT FOUND OR c.id<>a.entity_id OR c.company_id<>a.company_id
  OR NOT EXISTS(SELECT 1 FROM approval_workflows w WHERE w.id=a.approval_workflow_id AND w.company_id=c.company_id
    AND w.entity_type='MOVEMENT_CORRECTION' AND w.workflow_code='SS16_MOVEMENT_CORRECTION')
 THEN RAISE EXCEPTION 'SS16 reciprocal approval binding invalid' USING ERRCODE='23514'; END IF;
 SELECT count(*) INTO n FROM approval_actions WHERE approval_instance_id=aid;
 IF a.approval_state='SUBMITTED' AND a.completed_at IS NULL AND n=0 THEN RETURN NULL; END IF;
 IF a.approval_state NOT IN ('APPROVED','REJECTED') OR a.completed_at IS NULL OR n<>1
 THEN RAISE EXCEPTION 'SS16 completed decision invalid' USING ERRCODE='23514'; END IF;
 SELECT * INTO d FROM approval_actions WHERE approval_instance_id=aid;
 IF d.action<>(CASE a.approval_state WHEN 'APPROVED' THEN 'APPROVE' ELSE 'REJECT' END)
 OR d.action_by_user_id=c.requested_by_user_id THEN RAISE EXCEPTION 'SS16 completed decision invalid' USING ERRCODE='23514'; END IF;
 IF a.approval_state='REJECTED' THEN RETURN NULL; END IF;
 source_table:=CASE c.source_kind WHEN 'GOODS_RECEIPT' THEN 'goods_receipts' WHEN 'MATERIAL_ISSUE' THEN 'material_issues'
 WHEN 'MATERIAL_RETURN' THEN 'material_returns' WHEN 'STOCK_TRANSFER' THEN 'stock_transfers' END;
 EXECUTE format('SELECT id,posted_at,reversed_at,reversal_key,reversed_by_user_id,reversal_reason FROM %I WHERE id=$1 AND company_id=$2',source_table)
 INTO h USING c.source_id,c.company_id;
 IF h.id IS NULL THEN RAISE EXCEPTION 'SS16 approved source missing' USING ERRCODE='23514'; END IF;
 IF c.source_posted_at IS NOT NULL THEN
  IF h.posted_at IS DISTINCT FROM c.source_posted_at OR h.reversed_at IS NULL OR h.reversal_key IS DISTINCT FROM 'ss16:'||c.id::text
   OR h.reversed_by_user_id IS DISTINCT FROM d.action_by_user_id OR h.reversal_reason IS DISTINCT FROM c.reason
  THEN RAISE EXCEPTION 'SS16 approved reversal outcome missing' USING ERRCODE='23514'; END IF;
 ELSE
  IF h.posted_at IS NOT NULL OR h.reversed_at IS NOT NULL THEN RAISE EXCEPTION 'SS16 approved cancellation outcome invalid' USING ERRCODE='23514'; END IF;
  IF c.source_kind='STOCK_TRANSFER' AND EXISTS(SELECT 1 FROM transfer_custodies WHERE transfer_id=c.source_id) THEN
   IF NOT EXISTS(SELECT 1 FROM transfer_custody_events WHERE transfer_id=c.source_id AND action='CANCEL' AND actor_user_id=d.action_by_user_id)
    OR NOT EXISTS(SELECT 1 FROM approval_instances WHERE id=c.source_approval_instance_id AND approval_state IN ('CANCELLED','APPROVED'))
    THEN RAISE EXCEPTION 'SS16 approved transfer cancellation missing' USING ERRCODE='23514'; END IF;
  ELSIF NOT EXISTS(SELECT 1 FROM approval_instances o JOIN approval_actions oa ON oa.approval_instance_id=o.id
    WHERE o.id=c.source_approval_instance_id AND o.approval_state='CANCELLED' AND oa.action='CANCEL' AND oa.action_by_user_id=d.action_by_user_id)
  THEN RAISE EXCEPTION 'SS16 approved cancellation outcome missing' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER ss16_committed_approval AFTER INSERT OR UPDATE ON approval_instances DEFERRABLE INITIALLY DEFERRED FOR EACH ROW WHEN (NEW.entity_type='MOVEMENT_CORRECTION') EXECUTE FUNCTION ss16_check_committed_decision();
CREATE CONSTRAINT TRIGGER ss16_committed_action AFTER INSERT ON approval_actions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ss16_check_committed_decision();
CREATE CONSTRAINT TRIGGER ss16_committed_request AFTER INSERT ON movement_correction_requests DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION ss16_check_committed_decision();
-- Existing historical rows are not rewritten. Stop migration if the prior
-- reciprocal identity is already corrupt; never silently repair it.
DO $$ BEGIN
 IF EXISTS(SELECT 1 FROM movement_correction_requests c LEFT JOIN approval_instances a ON a.id=c.approval_instance_id
  LEFT JOIN approval_workflows w ON w.id=a.approval_workflow_id
  WHERE a.id IS NULL OR a.company_id<>c.company_id OR a.entity_type<>'MOVEMENT_CORRECTION' OR a.entity_id<>c.id
   OR w.company_id<>c.company_id OR w.entity_type<>'MOVEMENT_CORRECTION' OR w.workflow_code<>'SS16_MOVEMENT_CORRECTION')
 OR EXISTS(SELECT 1 FROM approval_instances a WHERE a.entity_type='MOVEMENT_CORRECTION' AND NOT EXISTS(SELECT 1 FROM movement_correction_requests c WHERE c.approval_instance_id=a.id))
 THEN RAISE EXCEPTION 'SS16 existing reciprocal approval binding invalid' USING ERRCODE='23514'; END IF;
END $$;

CREATE FUNCTION ss16_workflow_identity_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF ROW(NEW.id,NEW.company_id,NEW.entity_type,NEW.workflow_code)
    IS DISTINCT FROM ROW(OLD.id,OLD.company_id,OLD.entity_type,OLD.workflow_code)
 AND EXISTS(SELECT 1 FROM approval_instances a WHERE a.approval_workflow_id=OLD.id AND a.entity_type='MOVEMENT_CORRECTION')
 THEN RAISE EXCEPTION 'SS16 workflow identity immutable' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER ss16_workflow_identity_guard BEFORE UPDATE ON approval_workflows FOR EACH ROW EXECUTE FUNCTION ss16_workflow_identity_guard();
