-- CreateTable
CREATE TABLE "material_plan_project_policies" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "approval_workflow_id" UUID NOT NULL,
    "enabled_by_user_id" UUID NOT NULL,
    "synthetic_only" BOOLEAN NOT NULL DEFAULT true,
    "reason" VARCHAR(2000) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_plan_project_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_plan_issue_bindings" (
    "issue_id" UUID NOT NULL,
    "policy_id" UUID NOT NULL,
    "authorization_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_plan_issue_bindings_pkey" PRIMARY KEY ("issue_id")
);

-- CreateTable
CREATE TABLE "material_plan_issue_authorizations" (
    "id" UUID NOT NULL,
    "issue_id" UUID NOT NULL,
    "sequence" INTEGER NOT NULL,
    "mode" VARCHAR(20) NOT NULL,
    "body_digest" VARCHAR(64) NOT NULL,
    "approval_instance_id" UUID,
    "workflow_digest" VARCHAR(64),
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_plan_issue_authorizations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_plan_issue_allocations" (
    "id" UUID NOT NULL,
    "authorization_id" UUID NOT NULL,
    "issue_item_id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "plan_line_id" UUID NOT NULL,
    "plan_version" INTEGER NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "overage_quantity" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "material_plan_issue_allocations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_plan_issue_operations" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "request_key" UUID NOT NULL,
    "body_digest" VARCHAR(64) NOT NULL,
    "policy_id" UUID NOT NULL,
    "issue_id" UUID,
    "authorization_id" UUID,
    "snapshot" JSONB NOT NULL,
    "outcome" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_plan_issue_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "material_plan_project_policies_project_id_key" ON "material_plan_project_policies"("project_id");

-- CreateIndex
CREATE INDEX "material_plan_project_policies_company_id_project_id_idx" ON "material_plan_project_policies"("company_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_plan_issue_bindings_authorization_id_key" ON "material_plan_issue_bindings"("authorization_id");

-- CreateIndex
CREATE INDEX "material_plan_issue_bindings_policy_id_issue_id_idx" ON "material_plan_issue_bindings"("policy_id", "issue_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_plan_issue_authorizations_approval_instance_id_key" ON "material_plan_issue_authorizations"("approval_instance_id");

-- CreateIndex
CREATE INDEX "material_plan_issue_authorizations_issue_id_id_idx" ON "material_plan_issue_authorizations"("issue_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "material_plan_issue_authorizations_issue_id_sequence_key" ON "material_plan_issue_authorizations"("issue_id", "sequence");

-- CreateIndex
CREATE INDEX "material_plan_issue_allocations_plan_id_plan_line_id_idx" ON "material_plan_issue_allocations"("plan_id", "plan_line_id");

-- CreateIndex
CREATE INDEX "material_plan_issue_allocations_issue_item_id_idx" ON "material_plan_issue_allocations"("issue_item_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_plan_issue_allocations_authorization_id_issue_item_key" ON "material_plan_issue_allocations"("authorization_id", "issue_item_id");

-- CreateIndex
CREATE INDEX "material_plan_issue_operations_issue_id_id_idx" ON "material_plan_issue_operations"("issue_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "material_plan_issue_operations_company_id_actor_user_id_act_key" ON "material_plan_issue_operations"("company_id", "actor_user_id", "action", "request_key");

-- AddForeignKey
ALTER TABLE "material_plan_project_policies" ADD CONSTRAINT "material_plan_project_policies_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_plan_project_policies" ADD CONSTRAINT "material_plan_project_policies_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_plan_project_policies" ADD CONSTRAINT "material_plan_project_policies_approval_workflow_id_fkey" FOREIGN KEY ("approval_workflow_id") REFERENCES "approval_workflows"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_plan_project_policies" ADD CONSTRAINT "material_plan_project_policies_enabled_by_user_id_fkey" FOREIGN KEY ("enabled_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_plan_issue_bindings" ADD CONSTRAINT "material_plan_issue_bindings_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "material_issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_plan_issue_bindings" ADD CONSTRAINT "material_plan_issue_bindings_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "material_plan_project_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_plan_issue_bindings" ADD CONSTRAINT "material_plan_issue_bindings_authorization_id_fkey" FOREIGN KEY ("authorization_id") REFERENCES "material_plan_issue_authorizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_plan_issue_authorizations" ADD CONSTRAINT "material_plan_issue_authorizations_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "material_plan_issue_bindings"("issue_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_plan_issue_authorizations" ADD CONSTRAINT "material_plan_issue_authorizations_approval_instance_id_fkey" FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_plan_issue_authorizations" ADD CONSTRAINT "material_plan_issue_authorizations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_plan_issue_allocations" ADD CONSTRAINT "material_plan_issue_allocations_authorization_id_fkey" FOREIGN KEY ("authorization_id") REFERENCES "material_plan_issue_authorizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_plan_issue_allocations" ADD CONSTRAINT "material_plan_issue_allocations_issue_item_id_fkey" FOREIGN KEY ("issue_item_id") REFERENCES "material_issue_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_plan_issue_allocations" ADD CONSTRAINT "material_plan_issue_allocations_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "material_usage_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_plan_issue_allocations" ADD CONSTRAINT "material_plan_issue_allocations_plan_line_id_fkey" FOREIGN KEY ("plan_line_id") REFERENCES "material_usage_plan_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_plan_issue_operations" ADD CONSTRAINT "material_plan_issue_operations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_plan_issue_operations" ADD CONSTRAINT "material_plan_issue_operations_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_plan_issue_operations" ADD CONSTRAINT "material_plan_issue_operations_policy_id_fkey" FOREIGN KEY ("policy_id") REFERENCES "material_plan_project_policies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_plan_issue_operations" ADD CONSTRAINT "material_plan_issue_operations_issue_id_fkey" FOREIGN KEY ("issue_id") REFERENCES "material_plan_issue_bindings"("issue_id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_plan_issue_operations" ADD CONSTRAINT "material_plan_issue_operations_authorization_id_fkey" FOREIGN KEY ("authorization_id") REFERENCES "material_plan_issue_authorizations"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- DEC-044 B: definitions only. No retained policy, role grant or stock effect.
INSERT INTO permissions(id,permission_code,module_code,description) VALUES
 ('d1030800-0000-4000-8000-000000000001','inventory.material_plan.issue.post','INVENTORY','Record source-backed within-plan issues and request overage'),
 ('d1030800-0000-4000-8000-000000000002','inventory.material_plan.overage.review','INVENTORY','Independently review material plan overage'),
 ('d1030800-0000-4000-8000-000000000003','inventory.material_plan.overage.approve','INVENTORY','Independently approve reviewed material plan overage'),
 ('d1030800-0000-4000-8000-000000000004','inventory.material_plan.prototype.enable','INVENTORY','Explicitly enable isolated synthetic material plan policy')
ON CONFLICT(permission_code) DO NOTHING;
ALTER TABLE material_plan_project_policies ADD CHECK(synthetic_only AND length(btrim(reason)) BETWEEN 1 AND 2000);
ALTER TABLE material_plan_issue_authorizations ADD CHECK(sequence>0 AND body_digest ~ '^[a-f0-9]{64}$'),
 ADD CHECK((mode='DIRECT' AND approval_instance_id IS NULL AND workflow_digest IS NULL)
 OR (mode='OVERAGE' AND approval_instance_id IS NOT NULL AND workflow_digest ~ '^[a-f0-9]{64}$'));
ALTER TABLE material_plan_issue_allocations ADD CHECK(plan_version>0 AND quantity>0 AND quantity<>'NaN'::numeric AND overage_quantity>=0 AND overage_quantity<=quantity);
ALTER TABLE material_plan_issue_operations ADD CHECK(action IN ('ENABLE','DIRECT','SUBMIT','REVIEW','DECIDE') AND body_digest ~ '^[a-f0-9]{64}$');

CREATE FUNCTION erp_mpi_serializable() RETURNS void LANGUAGE plpgsql AS $$
BEGIN
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'Material plan issue serializable transaction required'; END IF;
END $$;
CREATE FUNCTION erp_mpi_scope(actor_uuid uuid,company_uuid uuid,project_uuid uuid,cap text) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT erp_mp_has_permission(actor_uuid,company_uuid,'inventory.material_plan.view')
 AND erp_mp_has_permission(actor_uuid,company_uuid,cap)
 AND (erp_mp_has_permission(actor_uuid,company_uuid,'budget.quantity.view') OR erp_mp_has_permission(actor_uuid,company_uuid,'budget.revision.view'))
 AND (cap='inventory.material_plan.prototype.enable' OR erp_mp_has_permission(actor_uuid,company_uuid,'inventory.issue.view'))
 AND EXISTS(SELECT 1 FROM projects p WHERE p.id=project_uuid AND p.company_id=company_uuid AND p.is_active)
 AND (erp_mp_has_permission(actor_uuid,company_uuid,'projects.access_all') OR EXISTS(
 SELECT 1 FROM users u JOIN employees e ON e.id=u.employee_id AND e.company_id=u.company_id AND e.is_active
 JOIN project_members m ON m.employee_id=e.id AND m.project_id=project_uuid AND m.is_active
 WHERE u.id=actor_uuid AND u.company_id=company_uuid AND u.is_active))
$$;
CREATE FUNCTION erp_mpi_step_role(actor_uuid uuid,step_uuid uuid,company_uuid uuid) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id AND r.company_id=ur.company_id AND r.is_active
 JOIN approval_step_roles sr ON sr.role_id=r.id AND sr.approval_step_id=step_uuid
 WHERE ur.user_id=actor_uuid AND ur.company_id=company_uuid)
$$;
CREATE FUNCTION erp_mpi_workflow_valid(workflow_uuid uuid,company_uuid uuid) RETURNS boolean LANGUAGE plpgsql STABLE AS $$
DECLARE s RECORD; n integer:=0; cap text;
BEGIN
 IF NOT EXISTS(SELECT 1 FROM approval_workflows WHERE id=workflow_uuid AND company_id=company_uuid AND entity_type='MATERIAL_PLAN_OVERAGE' AND is_active) THEN RETURN false; END IF;
 FOR s IN SELECT * FROM approval_steps WHERE approval_workflow_id=workflow_uuid ORDER BY step_no LOOP
  n:=n+1;cap:=CASE WHEN n=1 THEN 'inventory.material_plan.overage.review' ELSE 'inventory.material_plan.overage.approve' END;
  IF n>2 OR s.required_approvals<>1 OR NOT EXISTS(SELECT 1 FROM approval_step_roles WHERE approval_step_id=s.id)
  OR EXISTS(SELECT 1 FROM approval_step_roles sr JOIN roles r ON r.id=sr.role_id
   WHERE sr.approval_step_id=s.id AND (NOT r.is_active OR r.company_id<>company_uuid OR NOT EXISTS(
    SELECT 1 FROM role_permissions rp JOIN permissions p ON p.id=rp.permission_id WHERE rp.role_id=r.id AND p.permission_code=cap))) THEN RETURN false; END IF;
 END LOOP;
 RETURN n=2;
END $$;
CREATE FUNCTION erp_mpi_workflow_digest(workflow_uuid uuid) RETURNS text LANGUAGE sql STABLE AS $$
 SELECT encode(sha256(convert_to(coalesce(jsonb_agg(jsonb_build_object('id',s.id,'step',s.step_no,'required',s.required_approvals,
 'roles',(SELECT coalesce(jsonb_agg(sr.role_id ORDER BY sr.role_id),'[]'::jsonb) FROM approval_step_roles sr WHERE sr.approval_step_id=s.id)) ORDER BY s.step_no),'[]'::jsonb)::text,'UTF8')),'hex')
 FROM approval_steps s WHERE s.approval_workflow_id=workflow_uuid
$$;
CREATE FUNCTION erp_mpi_issue_digest(issue_uuid uuid) RETURNS text LANGUAGE sql STABLE AS $$
 SELECT encode(sha256(convert_to(jsonb_build_object('header',to_jsonb(h)-ARRAY['approval_instance_id','submitted_by_user_id','submitted_at','posted_at','posted_by_user_id','post_key','reversed_at','reversed_by_user_id','reversal_key','reversal_reason','updated_at'],
 'items',(SELECT coalesce(jsonb_agg(to_jsonb(i) ORDER BY i.line_no,i.id),'[]'::jsonb) FROM material_issue_items i WHERE i.material_issue_id=h.id))::text,'UTF8')),'hex')
 FROM material_issues h WHERE h.id=issue_uuid
$$;
-- Quantity is always derived from canonical effective sources, never a balance.
CREATE FUNCTION erp_mpi_usage(plan_uuid uuid,source_uuid uuid,material_uuid uuid,uom_uuid uuid,excluded_issue uuid DEFAULT NULL) RETURNS numeric LANGUAGE plpgsql STABLE AS $$
DECLARE used numeric; bad boolean;
BEGIN
 SELECT coalesce(sum(x.quantity-x.returned),0),coalesce(bool_or(x.returned>x.quantity),false) INTO used,bad FROM (
 SELECT i.quantity,coalesce((SELECT sum(ri.quantity) FROM material_return_items ri JOIN material_returns r ON r.id=ri.material_return_id
 WHERE ri.material_issue_item_id=i.id AND r.posted_at IS NOT NULL AND r.reversed_at IS NULL),0) AS returned
 FROM material_plan_issue_bindings b JOIN material_issues h ON h.id=b.issue_id AND h.posted_at IS NOT NULL AND h.reversed_at IS NULL
 JOIN material_plan_issue_allocations a ON a.authorization_id=b.authorization_id
 JOIN material_usage_plan_lines l ON l.id=a.plan_line_id JOIN material_issue_items i ON i.id=a.issue_item_id AND i.material_issue_id=h.id
 WHERE a.plan_id=plan_uuid AND l.budget_revision_line_id=source_uuid AND i.material_id=material_uuid AND i.uom_id=uom_uuid AND h.id IS DISTINCT FROM excluded_issue
 ) x;
 IF bad THEN RAISE EXCEPTION 'Material plan issue canonical return credit invalid'; END IF;
 RETURN used;
END $$;
CREATE FUNCTION erp_mpi_lock_sources(issue_uuids uuid[]) RETURNS void LANGUAGE plpgsql AS $$
DECLARE plan_uuid uuid;
BEGIN
 FOR plan_uuid IN SELECT DISTINCT a.plan_id FROM material_plan_issue_bindings b JOIN material_plan_issue_allocations a ON a.authorization_id=b.authorization_id
 WHERE b.issue_id=ANY(issue_uuids) ORDER BY a.plan_id LOOP
  PERFORM erp_mpi_serializable();PERFORM pg_advisory_xact_lock(hashtextextended('material-plan:'||plan_uuid::text,0));
 END LOOP;
END $$;
CREATE FUNCTION erp_mpi_validate_auth(auth_uuid uuid,posting boolean,poster uuid DEFAULT NULL) RETURNS void LANGUAGE plpgsql AS $$
DECLARE a RECORD; h RECORD; p RECORD; l RECORD; ai RECORD; first_step RECORD; final_step RECORD; reviewer uuid; approver uuid;
 used numeric; spent jsonb:='{}'; k text; prior numeric; excess numeric; n integer; expected integer;
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
  plan.company_id,plan.project_id,plan.warehouse_id,plan.budget_revision_id
 FROM material_plan_issue_allocations al JOIN material_issue_items i ON i.id=al.issue_item_id AND i.material_issue_id=h.id
 JOIN material_usage_plan_lines pl ON pl.id=al.plan_line_id AND pl.material_id=i.material_id AND pl.uom_id=i.uom_id
 JOIN material_usage_plan_revisions rev ON rev.id=pl.revision_id JOIN material_usage_plans plan ON plan.id=rev.plan_id
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
  prior:=coalesce((spent->>k)::numeric,0);used:=erp_mpi_usage(l.plan_id,l.budget_revision_line_id,l.material_id,l.uom_id,h.id);
  excess:=greatest(0,l.quantity-greatest(0,l.allowance-used-prior));
  IF (a.created_at=transaction_timestamp() AND NOT posting AND h.posted_at IS NULL AND excess<>l.overage_quantity) OR excess>l.overage_quantity
   OR (a.mode='DIRECT' AND (excess<>0 OR l.overage_quantity<>0)) THEN RAISE EXCEPTION 'Material plan issue allowance or approval stale'; END IF;
  spent:=jsonb_set(spent,ARRAY[k],to_jsonb(prior+l.quantity),true);
 END LOOP;
 -- Reject an allocation removed by any scope join above; counts alone cannot
 -- admit a mismatched item, UOM or plan parent.
 IF (SELECT count(*) FROM material_plan_issue_allocations al JOIN material_issue_items i ON i.id=al.issue_item_id AND i.material_issue_id=h.id
  JOIN material_usage_plan_lines pl ON pl.id=al.plan_line_id AND pl.material_id=i.material_id AND pl.uom_id=i.uom_id
  JOIN material_usage_plan_revisions r ON r.id=pl.revision_id AND r.plan_id=al.plan_id WHERE al.authorization_id=a.id)<>n THEN RAISE EXCEPTION 'Material plan issue complete batch required'; END IF;
 IF a.mode='DIRECT' THEN
  IF posting AND poster IS DISTINCT FROM a.created_by_user_id THEN RAISE EXCEPTION 'Material plan issue actor authority invalid'; END IF;
 ELSE
  IF NOT EXISTS(SELECT 1 FROM material_plan_issue_allocations WHERE authorization_id=a.id AND overage_quantity>0) THEN RAISE EXCEPTION 'Material plan issue allowance or approval stale'; END IF;
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

CREATE FUNCTION erp_mpi_snapshot(policy_uuid uuid,issue_uuid uuid,auth_uuid uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('policyId',p.id,'projectId',p.project_id,'issueId',issue_uuid,'authorizationId',auth_uuid,
 'mode',a.mode,'bodyDigest',a.body_digest,'approvalState',ai.approval_state,'currentStepNo',ai.current_step_no,
 'postedAt',h.posted_at,'postKey',h.post_key,'reversedAt',h.reversed_at,
 'lineCount',(SELECT count(*) FROM material_plan_issue_allocations WHERE authorization_id=auth_uuid))
 FROM material_plan_project_policies p LEFT JOIN material_plan_issue_authorizations a ON a.id=auth_uuid
 LEFT JOIN material_issues h ON h.id=issue_uuid LEFT JOIN approval_instances ai ON ai.id=a.approval_instance_id WHERE p.id=policy_uuid
$$;
CREATE FUNCTION erp_mpi_outcome(policy_uuid uuid,issue_uuid uuid,auth_uuid uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('policyId',policy_uuid,'issueId',issue_uuid,'authorizationId',auth_uuid,'status',CASE
 WHEN issue_uuid IS NULL THEN 'ENABLED'
 WHEN h.posted_at IS NOT NULL AND b.authorization_id=a.id THEN CASE WHEN h.reversed_at IS NULL THEN 'POSTED' ELSE 'REVERSED' END
 WHEN h.posted_at IS NOT NULL OR a.sequence<>(SELECT max(sequence) FROM material_plan_issue_authorizations WHERE issue_id=issue_uuid) THEN 'SUPERSEDED'
 WHEN ai.approval_state='REJECTED' THEN 'REJECTED' WHEN ai.approval_state='CANCELLED' THEN 'SUPERSEDED'
 WHEN a.mode='DIRECT' THEN 'EVALUATED'
 WHEN ai.current_step_no=(SELECT min(step_no) FROM approval_steps WHERE approval_workflow_id=ai.approval_workflow_id) THEN 'AWAITING_REVIEW' ELSE 'AWAITING_APPROVAL' END)
 FROM (SELECT 1) singleton LEFT JOIN material_issues h ON h.id=issue_uuid LEFT JOIN material_plan_issue_bindings b ON b.issue_id=issue_uuid
 LEFT JOIN material_plan_issue_authorizations a ON a.id=auth_uuid LEFT JOIN approval_instances ai ON ai.id=a.approval_instance_id
$$;

CREATE FUNCTION erp_mpi_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Material plan issue history immutable'; END $$;
CREATE TRIGGER mpi_policy_immutable BEFORE UPDATE OR DELETE ON material_plan_project_policies FOR EACH ROW EXECUTE FUNCTION erp_mpi_immutable();
CREATE TRIGGER mpi_auth_immutable BEFORE UPDATE OR DELETE ON material_plan_issue_authorizations FOR EACH ROW EXECUTE FUNCTION erp_mpi_immutable();
CREATE TRIGGER mpi_allocation_immutable BEFORE UPDATE OR DELETE ON material_plan_issue_allocations FOR EACH ROW EXECUTE FUNCTION erp_mpi_immutable();
CREATE TRIGGER mpi_operation_immutable BEFORE UPDATE OR DELETE ON material_plan_issue_operations FOR EACH ROW EXECUTE FUNCTION erp_mpi_immutable();

CREATE FUNCTION erp_mpi_insert_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p RECORD; a RECORD; h RECORD; cap text; seq integer;
BEGIN
 PERFORM erp_mpi_serializable();
 IF TG_TABLE_NAME='material_plan_project_policies' THEN
  NEW.created_at:=transaction_timestamp();
  IF NOT erp_mpi_scope(NEW.enabled_by_user_id,NEW.company_id,NEW.project_id,'inventory.material_plan.prototype.enable')
   OR NOT erp_mpi_workflow_valid(NEW.approval_workflow_id,NEW.company_id) OR NOT NEW.synthetic_only
  THEN RAISE EXCEPTION 'Material plan issue policy scope invalid'; END IF;
 ELSIF TG_TABLE_NAME='material_plan_issue_bindings' THEN
  SELECT * INTO STRICT h FROM material_issues WHERE id=NEW.issue_id;SELECT * INTO STRICT p FROM material_plan_project_policies WHERE id=NEW.policy_id;
  IF pg_trigger_depth()<2 OR NOT EXISTS(SELECT 1 FROM material_issues WHERE id=NEW.issue_id AND xmin::text=(txid_current()%4294967296)::text) OR h.company_id<>p.company_id OR h.project_id<>p.project_id OR NEW.authorization_id IS NOT NULL
  THEN RAISE EXCEPTION 'Material plan issue historical scope cannot change'; END IF;
  NEW.created_at:=transaction_timestamp();
 ELSIF TG_TABLE_NAME='material_plan_issue_authorizations' THEN
  NEW.created_at:=transaction_timestamp();
  SELECT * INTO STRICT h FROM material_issues WHERE id=NEW.issue_id;
  SELECT po.* INTO STRICT p FROM material_plan_issue_bindings b JOIN material_plan_project_policies po ON po.id=b.policy_id WHERE b.issue_id=h.id;
  SELECT coalesce(max(sequence),0)+1 INTO seq FROM material_plan_issue_authorizations WHERE issue_id=h.id;
  IF NEW.sequence<>seq OR h.posted_at IS NOT NULL OR h.reversed_at IS NOT NULL OR NEW.body_digest IS DISTINCT FROM erp_mpi_issue_digest(h.id)
   OR NOT erp_mpi_scope(NEW.created_by_user_id,p.company_id,p.project_id,'inventory.material_plan.issue.post') THEN RAISE EXCEPTION 'Material plan issue scope or payload changed'; END IF;
  IF NEW.mode='OVERAGE' AND NOT EXISTS(SELECT 1 FROM approval_instances ai WHERE ai.id=NEW.approval_instance_id AND ai.company_id=p.company_id
   AND ai.entity_type='MATERIAL_PLAN_OVERAGE' AND ai.entity_id=NEW.id AND ai.approval_workflow_id=p.approval_workflow_id AND ai.approval_state='SUBMITTED'
   AND ai.current_step_no=(SELECT min(step_no) FROM approval_steps WHERE approval_workflow_id=p.approval_workflow_id)) THEN RAISE EXCEPTION 'Material plan issue independent approval required'; END IF;
 ELSIF TG_TABLE_NAME='material_plan_issue_allocations' THEN
  SELECT * INTO STRICT a FROM material_plan_issue_authorizations WHERE id=NEW.authorization_id;
  IF a.created_at<>transaction_timestamp() OR NOT EXISTS(SELECT 1 FROM material_issue_items WHERE id=NEW.issue_item_id AND material_issue_id=a.issue_id AND quantity=NEW.quantity)
   OR NOT EXISTS(SELECT 1 FROM material_usage_plan_lines l JOIN material_usage_plan_revisions r ON r.id=l.revision_id JOIN material_usage_plans plan ON plan.id=r.plan_id
    WHERE l.id=NEW.plan_line_id AND r.plan_id=NEW.plan_id AND plan.version=NEW.plan_version) THEN RAISE EXCEPTION 'Material plan issue complete batch required'; END IF;
 ELSIF TG_TABLE_NAME='material_plan_issue_operations' THEN
  NEW.created_at:=transaction_timestamp();SELECT * INTO STRICT p FROM material_plan_project_policies WHERE id=NEW.policy_id;
  cap:=CASE NEW.action WHEN 'ENABLE' THEN 'prototype.enable' WHEN 'DIRECT' THEN 'issue.post' WHEN 'SUBMIT' THEN 'issue.post' WHEN 'REVIEW' THEN 'overage.review' WHEN 'DECIDE' THEN 'overage.approve' END;
  IF NEW.company_id<>p.company_id OR cap IS NULL OR NOT erp_mpi_scope(NEW.actor_user_id,p.company_id,p.project_id,'inventory.material_plan.'||cap)
   OR NEW.snapshot IS DISTINCT FROM erp_mpi_snapshot(p.id,NEW.issue_id,NEW.authorization_id)
   OR NEW.outcome IS DISTINCT FROM erp_mpi_outcome(p.id,NEW.issue_id,NEW.authorization_id)
  THEN RAISE EXCEPTION 'Material plan issue operation proof invalid'; END IF;
  IF NEW.action='ENABLE' THEN
   IF NEW.issue_id IS NOT NULL OR NEW.authorization_id IS NOT NULL OR p.enabled_by_user_id<>NEW.actor_user_id THEN RAISE EXCEPTION 'Material plan issue operation proof invalid'; END IF;
  ELSE
   SELECT * INTO STRICT a FROM material_plan_issue_authorizations WHERE id=NEW.authorization_id;
   IF a.issue_id IS DISTINCT FROM NEW.issue_id OR NOT EXISTS(SELECT 1 FROM material_plan_issue_bindings WHERE issue_id=NEW.issue_id AND policy_id=p.id)
    OR (NEW.action IN ('DIRECT','SUBMIT') AND (a.created_by_user_id<>NEW.actor_user_id OR a.created_at<>transaction_timestamp()))
    OR (NEW.action='DIRECT' AND a.mode<>'DIRECT') OR (NEW.action='SUBMIT' AND a.mode<>'OVERAGE')
   THEN RAISE EXCEPTION 'Material plan issue operation proof invalid'; END IF;
   IF NEW.action IN ('REVIEW','DECIDE') AND NOT EXISTS(SELECT 1 FROM approval_actions ac JOIN approval_steps st ON st.id=ac.approval_step_id
    WHERE ac.approval_instance_id=a.approval_instance_id AND ac.action_by_user_id=NEW.actor_user_id AND ac.action_at=transaction_timestamp() AND ac.action IN ('APPROVE','REJECT')
    AND st.step_no=(SELECT CASE WHEN NEW.action='REVIEW' THEN min(step_no) ELSE max(step_no) END FROM approval_steps WHERE approval_workflow_id=p.approval_workflow_id))
   THEN RAISE EXCEPTION 'Material plan issue operation proof invalid'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER mpi_policy_insert BEFORE INSERT ON material_plan_project_policies FOR EACH ROW EXECUTE FUNCTION erp_mpi_insert_guard();
CREATE TRIGGER mpi_binding_insert BEFORE INSERT ON material_plan_issue_bindings FOR EACH ROW EXECUTE FUNCTION erp_mpi_insert_guard();
CREATE TRIGGER mpi_auth_insert BEFORE INSERT ON material_plan_issue_authorizations FOR EACH ROW EXECUTE FUNCTION erp_mpi_insert_guard();
CREATE TRIGGER mpi_allocation_insert BEFORE INSERT ON material_plan_issue_allocations FOR EACH ROW EXECUTE FUNCTION erp_mpi_insert_guard();
CREATE TRIGGER mpi_operation_insert BEFORE INSERT ON material_plan_issue_operations FOR EACH ROW EXECUTE FUNCTION erp_mpi_insert_guard();

CREATE FUNCTION erp_mpi_capture_issue() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE policy_uuid uuid;
BEGIN
 SELECT id INTO policy_uuid FROM material_plan_project_policies WHERE project_id=NEW.project_id AND company_id=NEW.company_id;
 IF policy_uuid IS NOT NULL THEN INSERT INTO material_plan_issue_bindings(issue_id,policy_id) VALUES(NEW.id,policy_uuid); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER mpi_capture_issue AFTER INSERT ON material_issues FOR EACH ROW EXECUTE FUNCTION erp_mpi_capture_issue();
CREATE FUNCTION erp_mpi_binding_update() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM erp_mpi_serializable();
 IF TG_OP='DELETE' OR (to_jsonb(NEW)-'authorization_id') IS DISTINCT FROM (to_jsonb(OLD)-'authorization_id') OR OLD.authorization_id IS NOT NULL OR NEW.authorization_id IS NULL
 THEN RAISE EXCEPTION 'Material plan issue history immutable'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER mpi_binding_update BEFORE UPDATE OR DELETE ON material_plan_issue_bindings FOR EACH ROW EXECUTE FUNCTION erp_mpi_binding_update();
CREATE FUNCTION erp_mpi_issue_update() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE b RECORD; p RECORD;
BEGIN
 SELECT * INTO b FROM material_plan_issue_bindings WHERE issue_id=OLD.id;
 IF NOT FOUND THEN RETURN NEW; END IF;
 IF (NEW.id,NEW.company_id,NEW.project_id) IS DISTINCT FROM (OLD.id,OLD.company_id,OLD.project_id) OR NEW.approval_instance_id IS NOT NULL
 THEN RAISE EXCEPTION 'Material plan issue historical scope cannot change'; END IF;
 IF NEW.submitted_at IS NOT NULL AND OLD.submitted_at IS NULL AND
 (to_jsonb(NEW)-ARRAY['submitted_at','submitted_by_user_id','posted_at','posted_by_user_id','post_key','updated_at']) IS DISTINCT FROM
 (to_jsonb(OLD)-ARRAY['submitted_at','submitted_by_user_id','posted_at','posted_by_user_id','post_key','updated_at']) THEN RAISE EXCEPTION 'Material plan issue scope or payload changed'; END IF;
 IF NEW.posted_at IS NOT NULL AND OLD.posted_at IS NULL THEN
  PERFORM erp_mpi_serializable();PERFORM erp_mpi_lock_sources(ARRAY[OLD.id]);
  IF b.authorization_id IS NULL OR NEW.submitted_at IS NULL OR NEW.submitted_by_user_id IS NULL THEN RAISE EXCEPTION 'Material plan issue independent approval required'; END IF;
  PERFORM erp_mpi_validate_auth(b.authorization_id,true,NEW.posted_by_user_id);
 END IF;
 IF OLD.reversed_at IS NULL AND NEW.reversed_at IS NOT NULL THEN PERFORM erp_mpi_lock_sources(ARRAY[OLD.id]); END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER mpi_issue_update BEFORE UPDATE ON material_issues FOR EACH ROW EXECUTE FUNCTION erp_mpi_issue_update();
CREATE FUNCTION erp_mpi_return_update() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ids uuid[];
BEGIN
 IF (OLD.posted_at IS NULL AND NEW.posted_at IS NOT NULL) OR (OLD.reversed_at IS NULL AND NEW.reversed_at IS NOT NULL) THEN
  SELECT array_agg(DISTINCT i.material_issue_id) INTO ids FROM material_return_items r JOIN material_issue_items i ON i.id=r.material_issue_item_id WHERE r.material_return_id=OLD.id;
  PERFORM erp_mpi_lock_sources(coalesce(ids,ARRAY[]::uuid[]));
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER mpi_return_update BEFORE UPDATE ON material_returns FOR EACH ROW EXECUTE FUNCTION erp_mpi_return_update();
CREATE FUNCTION erp_mpi_approval_guard() RETURNS trigger LANGUAGE plpgsql AS $$
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
CREATE TRIGGER mpi_approval_guard BEFORE INSERT ON approval_actions FOR EACH ROW EXECUTE FUNCTION erp_mpi_approval_guard();

CREATE FUNCTION erp_mpi_assert_revision(revision_uuid uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE r RECORD; x RECORD; used numeric; allowance numeric;
BEGIN
 SELECT * INTO STRICT r FROM material_usage_plan_revisions WHERE id=revision_uuid;
 PERFORM pg_advisory_xact_lock(hashtextextended('material-plan:'||r.plan_id::text,0));
 FOR x IN SELECT DISTINCT l.budget_revision_line_id,l.material_id,l.uom_id FROM material_plan_issue_allocations a
 JOIN material_usage_plan_lines l ON l.id=a.plan_line_id WHERE a.plan_id=r.plan_id LOOP
  used:=erp_mpi_usage(r.plan_id,x.budget_revision_line_id,x.material_id,x.uom_id);
  SELECT quantity INTO allowance FROM material_usage_plan_lines WHERE revision_id=r.id AND budget_revision_line_id=x.budget_revision_line_id AND material_id=x.material_id AND uom_id=x.uom_id;
  IF used>coalesce(allowance,0) THEN RAISE EXCEPTION 'Material plan issue revision below effective consumption'; END IF;
 END LOOP;
END $$;
CREATE FUNCTION erp_mpi_revision_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='INSERT' OR NEW.status='APPROVED' THEN PERFORM erp_mpi_assert_revision(NEW.id); END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER mpi_revision_consumption AFTER INSERT OR UPDATE ON material_usage_plan_revisions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_mpi_revision_guard();

CREATE FUNCTION erp_mpi_receipt_guard() RETURNS trigger LANGUAGE plpgsql AS $$
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
    WHERE st.material_issue_item_id=i.id AND st.movement_type='MATERIAL_ISSUE' AND st.effect_key='material-issue:'||i.id::text AND st.quantity=-i.quantity)))
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
CREATE CONSTRAINT TRIGGER mpi_policy_receipt AFTER INSERT ON material_plan_project_policies DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_mpi_receipt_guard();
CREATE CONSTRAINT TRIGGER mpi_auth_receipt AFTER INSERT ON material_plan_issue_authorizations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_mpi_receipt_guard();
CREATE CONSTRAINT TRIGGER mpi_binding_receipt AFTER UPDATE ON material_plan_issue_bindings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_mpi_receipt_guard();
CREATE CONSTRAINT TRIGGER mpi_action_receipt AFTER INSERT ON approval_actions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_mpi_receipt_guard();
CREATE CONSTRAINT TRIGGER mpi_operation_receipt AFTER INSERT ON material_plan_issue_operations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_mpi_receipt_guard();

-- Approval history remains append-only after either rejection or posting.
CREATE FUNCTION erp_mpi_action_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM approval_instances WHERE id=OLD.approval_instance_id AND entity_type='MATERIAL_PLAN_OVERAGE')
 THEN RAISE EXCEPTION 'Material plan issue history immutable'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 IF EXISTS(SELECT 1 FROM approval_instances WHERE id=NEW.approval_instance_id AND entity_type='MATERIAL_PLAN_OVERAGE')
 THEN RAISE EXCEPTION 'Material plan issue history immutable'; END IF;RETURN NEW;
END $$;
CREATE TRIGGER mpi_action_immutable BEFORE UPDATE OR DELETE ON approval_actions FOR EACH ROW EXECUTE FUNCTION erp_mpi_action_immutable();
