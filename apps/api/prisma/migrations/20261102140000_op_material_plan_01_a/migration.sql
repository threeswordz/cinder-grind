-- CreateTable
CREATE TABLE "material_usage_plans" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "budget_revision_id" UUID NOT NULL,
    "work_package_code" VARCHAR(80) NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_usage_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_usage_plan_revisions" (
    "id" UUID NOT NULL,
    "plan_id" UUID NOT NULL,
    "revision_no" INTEGER NOT NULL,
    "valid_from" DATE NOT NULL,
    "valid_to" DATE NOT NULL,
    "reason" VARCHAR(2000) NOT NULL,
    "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
    "created_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_by_user_id" UUID,
    "submitted_at" TIMESTAMPTZ(6),
    "decided_by_user_id" UUID,
    "decided_at" TIMESTAMPTZ(6),
    "decision_comment" VARCHAR(2000),

    CONSTRAINT "material_usage_plan_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_usage_plan_lines" (
    "id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "budget_revision_line_id" UUID NOT NULL,
    "material_id" UUID NOT NULL,
    "uom_id" UUID NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,

    CONSTRAINT "material_usage_plan_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_usage_plan_operations" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "request_key" UUID NOT NULL,
    "body_digest" VARCHAR(64) NOT NULL,
    "plan_id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "plan_version" INTEGER NOT NULL,
    "snapshot" JSONB NOT NULL,
    "outcome" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_usage_plan_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "material_usage_plans_company_id_project_id_id_idx" ON "material_usage_plans"("company_id", "project_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "material_usage_plans_company_id_project_id_warehouse_id_wor_key" ON "material_usage_plans"("company_id", "project_id", "warehouse_id", "work_package_code");

-- CreateIndex
CREATE INDEX "material_usage_plan_revisions_plan_id_status_revision_no_idx" ON "material_usage_plan_revisions"("plan_id", "status", "revision_no");

-- CreateIndex
CREATE UNIQUE INDEX "material_usage_plan_revisions_plan_id_revision_no_key" ON "material_usage_plan_revisions"("plan_id", "revision_no");

-- CreateIndex
CREATE INDEX "material_usage_plan_lines_budget_revision_line_id_idx" ON "material_usage_plan_lines"("budget_revision_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_usage_plan_lines_revision_id_budget_revision_line__key" ON "material_usage_plan_lines"("revision_id", "budget_revision_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_usage_plan_operations_company_id_actor_user_id_act_key" ON "material_usage_plan_operations"("company_id", "actor_user_id", "action", "request_key");

-- CreateIndex
CREATE UNIQUE INDEX "material_usage_plan_operations_plan_id_plan_version_key" ON "material_usage_plan_operations"("plan_id", "plan_version");

-- AddForeignKey
ALTER TABLE "material_usage_plans" ADD CONSTRAINT "material_usage_plans_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_usage_plans" ADD CONSTRAINT "material_usage_plans_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_usage_plans" ADD CONSTRAINT "material_usage_plans_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_usage_plans" ADD CONSTRAINT "material_usage_plans_budget_revision_id_fkey" FOREIGN KEY ("budget_revision_id") REFERENCES "budget_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_usage_plans" ADD CONSTRAINT "material_usage_plans_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_usage_plan_revisions" ADD CONSTRAINT "material_usage_plan_revisions_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "material_usage_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_usage_plan_revisions" ADD CONSTRAINT "material_usage_plan_revisions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_usage_plan_revisions" ADD CONSTRAINT "material_usage_plan_revisions_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_usage_plan_revisions" ADD CONSTRAINT "material_usage_plan_revisions_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_usage_plan_lines" ADD CONSTRAINT "material_usage_plan_lines_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "material_usage_plan_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_usage_plan_lines" ADD CONSTRAINT "material_usage_plan_lines_budget_revision_line_id_fkey" FOREIGN KEY ("budget_revision_line_id") REFERENCES "budget_revision_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_usage_plan_lines" ADD CONSTRAINT "material_usage_plan_lines_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_usage_plan_lines" ADD CONSTRAINT "material_usage_plan_lines_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_usage_plan_operations" ADD CONSTRAINT "material_usage_plan_operations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_usage_plan_operations" ADD CONSTRAINT "material_usage_plan_operations_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_usage_plan_operations" ADD CONSTRAINT "material_usage_plan_operations_plan_id_fkey" FOREIGN KEY ("plan_id") REFERENCES "material_usage_plans"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_usage_plan_operations" ADD CONSTRAINT "material_usage_plan_operations_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "material_usage_plan_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- DEC-044 foundation: definitions only, no real role grants or stock writes.
INSERT INTO permissions(id,permission_code,module_code,description) VALUES
 ('d1021400-0000-4000-8000-000000000001','inventory.material_plan.view','INVENTORY','View scoped material usage plans'),
 ('d1021400-0000-4000-8000-000000000002','inventory.material_plan.create','INVENTORY','Prepare scoped material usage plans'),
 ('d1021400-0000-4000-8000-000000000003','inventory.material_plan.revise','INVENTORY','Append material usage plan revisions'),
 ('d1021400-0000-4000-8000-000000000004','inventory.material_plan.submit','INVENTORY','Submit material usage plan revisions'),
 ('d1021400-0000-4000-8000-000000000005','inventory.material_plan.approve','INVENTORY','Independently decide material usage plans')
ON CONFLICT(permission_code) DO NOTHING;
ALTER TABLE material_usage_plans ADD CHECK(version>=1 AND length(btrim(work_package_code)) BETWEEN 1 AND 80);
ALTER TABLE material_usage_plan_revisions ADD CHECK(revision_no>=1 AND valid_from<=valid_to AND length(btrim(reason)) BETWEEN 1 AND 2000),
 ADD CHECK(status IN ('DRAFT','SUBMITTED','APPROVED','REJECTED')),
 ADD CHECK((status='DRAFT' AND submitted_by_user_id IS NULL AND submitted_at IS NULL AND decided_by_user_id IS NULL AND decided_at IS NULL AND decision_comment IS NULL)
 OR (status='SUBMITTED' AND submitted_by_user_id IS NOT NULL AND submitted_at IS NOT NULL AND decided_by_user_id IS NULL AND decided_at IS NULL AND decision_comment IS NULL)
 OR (status IN ('APPROVED','REJECTED') AND submitted_by_user_id IS NOT NULL AND submitted_at IS NOT NULL AND decided_by_user_id IS NOT NULL AND decided_at IS NOT NULL AND length(btrim(decision_comment)) BETWEEN 1 AND 2000));
ALTER TABLE material_usage_plan_lines ADD CHECK(quantity>0 AND quantity<>'NaN'::numeric);
ALTER TABLE material_usage_plan_operations ADD CHECK(plan_version>=1 AND body_digest ~ '^[a-f0-9]{64}$' AND action IN ('CREATE','REVISE','SUBMIT','APPROVE','REJECT'));

CREATE FUNCTION erp_mp_has_permission(actor_uuid uuid,company_uuid uuid,code text) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM users u JOIN user_roles ur ON ur.user_id=u.id AND ur.company_id=u.company_id
 JOIN roles r ON r.id=ur.role_id AND r.company_id=u.company_id AND r.is_active
 JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions perm ON perm.id=rp.permission_id
 JOIN companies c ON c.id=u.company_id AND c.is_active
 WHERE u.id=actor_uuid AND u.company_id=company_uuid AND u.is_active AND perm.permission_code=code)
$$;

CREATE FUNCTION erp_mp_assert_lines(revision_uuid uuid,approving boolean) RETURNS void LANGUAGE plpgsql AS $$
DECLARE p RECORD; rev RECORD; l RECORD; b RECORD; source_item uuid; allocated numeric; n integer;
BEGIN
 SELECT * INTO STRICT rev FROM material_usage_plan_revisions WHERE id=revision_uuid;
 SELECT * INTO STRICT p FROM material_usage_plans WHERE id=rev.plan_id;
 SELECT count(*) INTO n FROM material_usage_plan_lines WHERE revision_id=rev.id;
 IF n NOT BETWEEN 1 AND 100 THEN RAISE EXCEPTION 'Material plan requires one to one hundred lines'; END IF;
 -- Lock the canonical BOQ ITEM, not a revision-specific line. A newer approved
 -- Cost BOQ basis cannot silently multiply the same item's allowance.
 IF approving THEN
  FOR source_item IN SELECT DISTINCT bl.boq_item_id FROM material_usage_plan_lines ml
   JOIN budget_revision_lines bl ON bl.id=ml.budget_revision_line_id WHERE ml.revision_id=rev.id ORDER BY bl.boq_item_id LOOP
   PERFORM pg_advisory_xact_lock(hashtextextended('material-plan-source:'||source_item::text,0));
  END LOOP;
 END IF;
 FOR l IN SELECT * FROM material_usage_plan_lines WHERE revision_id=rev.id ORDER BY budget_revision_line_id LOOP
  SELECT bl.* INTO b FROM budget_revision_lines bl JOIN budget_revisions br ON br.id=bl.budget_revision_id
   JOIN approval_instances ai ON ai.id=br.approval_instance_id AND ai.approval_state='APPROVED'
   JOIN materials m ON m.id=l.material_id AND m.company_id=p.company_id AND m.is_active AND m.default_uom_id=l.uom_id
   JOIN units_of_measure u ON u.id=l.uom_id AND u.company_id=p.company_id AND u.is_active
   WHERE bl.id=l.budget_revision_line_id AND br.id=p.budget_revision_id AND br.company_id=p.company_id
    AND br.project_id=p.project_id AND bl.uom_id=l.uom_id AND bl.quantity>=l.quantity;
  IF NOT FOUND THEN RAISE EXCEPTION 'Material plan source or material scope invalid'; END IF;
  IF EXISTS(SELECT 1 FROM material_usage_plan_lines old_line JOIN material_usage_plan_revisions old_rev ON old_rev.id=old_line.revision_id
    WHERE old_rev.plan_id=p.id AND old_rev.status='APPROVED' AND old_line.budget_revision_line_id=l.budget_revision_line_id AND old_line.material_id<>l.material_id)
   THEN RAISE EXCEPTION 'Material plan approved mapping is immutable'; END IF;
  IF approving THEN
   IF EXISTS(SELECT 1 FROM material_usage_plan_lines ml
    JOIN material_usage_plan_revisions mr ON mr.id=ml.revision_id AND mr.status='APPROVED'
    JOIN material_usage_plans mp ON mp.id=mr.plan_id
    JOIN budget_revision_lines bl ON bl.id=ml.budget_revision_line_id
    WHERE mp.id<>p.id AND bl.boq_item_id=b.boq_item_id
     AND mr.revision_no=(SELECT max(x.revision_no) FROM material_usage_plan_revisions x WHERE x.plan_id=mp.id AND x.status='APPROVED')
     AND (mp.budget_revision_id<>p.budget_revision_id OR ml.material_id<>l.material_id OR ml.uom_id<>l.uom_id))
    THEN RAISE EXCEPTION 'Material plan approved source mapping or basis conflicts'; END IF;
   SELECT coalesce(sum(ml.quantity),0) INTO allocated FROM material_usage_plan_lines ml
    JOIN material_usage_plan_revisions mr ON mr.id=ml.revision_id AND mr.status='APPROVED'
    JOIN material_usage_plans mp ON mp.id=mr.plan_id
    JOIN budget_revision_lines bl ON bl.id=ml.budget_revision_line_id
    WHERE mp.id<>p.id AND bl.boq_item_id=b.boq_item_id
     AND mr.revision_no=(SELECT max(x.revision_no) FROM material_usage_plan_revisions x WHERE x.plan_id=mp.id AND x.status='APPROVED');
   IF allocated+l.quantity>b.quantity THEN RAISE EXCEPTION 'Material plan cumulative source allocation exceeded'; END IF;
  END IF;
 END LOOP;
END $$;

CREATE FUNCTION erp_mp_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p RECORD; rev RECORD; actor_company uuid; next_no integer; capability text; previous_op RECORD; previous_revision integer;
BEGIN
 IF TG_TABLE_NAME='material_usage_plans' THEN
  IF TG_OP='INSERT' THEN NEW.created_at:=transaction_timestamp(); END IF;
  IF TG_OP='INSERT' AND NOT EXISTS(SELECT 1 FROM projects pr JOIN companies c ON c.id=pr.company_id AND c.is_active
   JOIN warehouses w ON w.id=NEW.warehouse_id AND w.company_id=c.id AND w.project_id=pr.id AND w.is_active
   JOIN budget_revisions br ON br.id=NEW.budget_revision_id AND br.company_id=c.id AND br.project_id=pr.id
   JOIN approval_instances ai ON ai.id=br.approval_instance_id AND ai.approval_state='APPROVED'
   JOIN users u ON u.id=NEW.created_by_user_id AND u.company_id=c.id AND u.is_active
   WHERE pr.id=NEW.project_id AND pr.company_id=NEW.company_id AND pr.is_active)
   THEN RAISE EXCEPTION 'Material plan Company Project warehouse basis or maker invalid'; END IF;
  IF TG_OP='INSERT' AND NEW.version<>1 THEN RAISE EXCEPTION 'Material plan must start at version one'; END IF;
  IF TG_OP='UPDATE' AND ((to_jsonb(NEW)-'version') IS DISTINCT FROM (to_jsonb(OLD)-'version') OR NEW.version<>OLD.version+1)
   THEN RAISE EXCEPTION 'Material plan scope immutable and version sequential'; END IF;
 ELSIF TG_TABLE_NAME='material_usage_plan_revisions' THEN
  SELECT * INTO STRICT p FROM material_usage_plans WHERE id=NEW.plan_id;
  IF NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.created_by_user_id AND company_id=p.company_id AND (TG_OP<>'INSERT' OR is_active))
   THEN RAISE EXCEPTION 'Material plan revision actor scope invalid'; END IF;
  IF TG_OP='INSERT' THEN
   NEW.created_at:=transaction_timestamp();
   SELECT coalesce(max(revision_no),0)+1 INTO next_no FROM material_usage_plan_revisions WHERE plan_id=p.id;
   IF NEW.revision_no<>next_no OR NEW.status<>'DRAFT' OR EXISTS(SELECT 1 FROM material_usage_plan_revisions WHERE plan_id=p.id AND status='SUBMITTED')
    THEN RAISE EXCEPTION 'Material plan revision must be next Draft without pending submission'; END IF;
  ELSE
   IF (to_jsonb(NEW)-ARRAY['status','submitted_by_user_id','submitted_at','decided_by_user_id','decided_at','decision_comment'])
     IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','submitted_by_user_id','submitted_at','decided_by_user_id','decided_at','decision_comment'])
    OR NEW.revision_no<>(SELECT max(revision_no) FROM material_usage_plan_revisions WHERE plan_id=p.id)
    THEN RAISE EXCEPTION 'Material plan revision content and history immutable'; END IF;
   IF OLD.status='DRAFT' AND NEW.status='SUBMITTED' THEN
    NEW.submitted_at:=clock_timestamp();
    PERFORM erp_mp_assert_lines(NEW.id,false);
   ELSIF OLD.status='SUBMITTED' AND NEW.status IN ('APPROVED','REJECTED') THEN
    NEW.decided_at:=clock_timestamp();
    IF NEW.submitted_by_user_id IS DISTINCT FROM OLD.submitted_by_user_id OR NEW.submitted_at IS DISTINCT FROM OLD.submitted_at
     OR NEW.decided_by_user_id IN (p.created_by_user_id,NEW.created_by_user_id,NEW.submitted_by_user_id)
     OR NOT EXISTS(SELECT 1 FROM users WHERE id=NEW.decided_by_user_id AND company_id=p.company_id AND is_active)
     THEN RAISE EXCEPTION 'Material plan decision maker checker or submission invalid'; END IF;
    IF NEW.status='APPROVED' THEN PERFORM erp_mp_assert_lines(NEW.id,true); END IF;
   ELSE RAISE EXCEPTION 'Material plan invalid state transition'; END IF;
  END IF;
 ELSIF TG_TABLE_NAME='material_usage_plan_lines' THEN
  SELECT r.* INTO STRICT rev FROM material_usage_plan_revisions r WHERE r.id=NEW.revision_id;
  SELECT * INTO STRICT p FROM material_usage_plans WHERE id=rev.plan_id;
  IF rev.status<>'DRAFT' OR EXISTS(SELECT 1 FROM material_usage_plan_operations WHERE revision_id=rev.id)
   OR NOT EXISTS(SELECT 1 FROM budget_revision_lines bl JOIN materials m ON m.id=NEW.material_id
    JOIN units_of_measure u ON u.id=NEW.uom_id WHERE bl.id=NEW.budget_revision_line_id AND bl.budget_revision_id=p.budget_revision_id
    AND bl.uom_id=NEW.uom_id AND bl.quantity>=NEW.quantity AND m.company_id=p.company_id AND m.is_active
    AND m.default_uom_id=u.id AND u.company_id=p.company_id AND u.is_active)
   THEN RAISE EXCEPTION 'Material plan line scope invalid or original lines already sealed'; END IF;
 ELSE
  SELECT * INTO STRICT p FROM material_usage_plans WHERE id=NEW.plan_id;
  SELECT * INTO STRICT rev FROM material_usage_plan_revisions WHERE id=NEW.revision_id AND plan_id=p.id;
  capability:=CASE NEW.action WHEN 'CREATE' THEN 'create' WHEN 'REVISE' THEN 'revise' WHEN 'SUBMIT' THEN 'submit' ELSE 'approve' END;
  IF p.version>1 THEN
   SELECT o.* INTO STRICT previous_op FROM material_usage_plan_operations o WHERE o.plan_id=p.id AND o.plan_version=p.version-1;
   SELECT revision_no INTO STRICT previous_revision FROM material_usage_plan_revisions WHERE id=previous_op.revision_id;
   IF (NEW.action='REVISE' AND (rev.revision_no<>previous_revision+1 OR previous_op.action='SUBMIT'))
    OR (NEW.action='SUBMIT' AND (previous_op.revision_id<>rev.id OR previous_op.action NOT IN ('CREATE','REVISE')))
    OR (NEW.action IN ('APPROVE','REJECT') AND (previous_op.revision_id<>rev.id OR previous_op.action<>'SUBMIT'))
    THEN RAISE EXCEPTION 'Material plan operation sequence invalid'; END IF;
  END IF;

  NEW.created_at:=transaction_timestamp();
  IF (p.version=1 AND NEW.action<>'CREATE') OR NEW.company_id<>p.company_id OR NEW.plan_version<>p.version
   OR NOT erp_mp_has_permission(NEW.actor_user_id,p.company_id,'inventory.material_plan.view')
   OR NOT erp_mp_has_permission(NEW.actor_user_id,p.company_id,'inventory.material_plan.'||capability)
   OR NOT (erp_mp_has_permission(NEW.actor_user_id,p.company_id,'budget.quantity.view') OR erp_mp_has_permission(NEW.actor_user_id,p.company_id,'budget.revision.view'))
   OR (NEW.action IN ('CREATE','REVISE') AND (rev.status<>'DRAFT' OR rev.created_by_user_id<>NEW.actor_user_id))
   OR (NEW.action='CREATE' AND (rev.revision_no<>1 OR p.version<>1 OR p.created_by_user_id<>NEW.actor_user_id))
   OR (NEW.action='SUBMIT' AND (rev.status<>'SUBMITTED' OR rev.submitted_by_user_id<>NEW.actor_user_id))
   OR (NEW.action='APPROVE' AND (rev.status<>'APPROVED' OR rev.decided_by_user_id<>NEW.actor_user_id))
   OR (NEW.action='REJECT' AND (rev.status<>'REJECTED' OR rev.decided_by_user_id<>NEW.actor_user_id))
   OR NEW.outcome IS DISTINCT FROM jsonb_build_object('id',p.id,'projectId',p.project_id,'version',p.version,'revisionId',rev.id,'revisionNo',rev.revision_no,'status',rev.status)
   THEN RAISE EXCEPTION 'Material plan immutable operation actor outcome or scope invalid'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER mp_plan_scope BEFORE INSERT OR UPDATE ON material_usage_plans FOR EACH ROW EXECUTE FUNCTION erp_mp_scope();
CREATE TRIGGER mp_revision_scope BEFORE INSERT OR UPDATE ON material_usage_plan_revisions FOR EACH ROW EXECUTE FUNCTION erp_mp_scope();
CREATE TRIGGER mp_line_scope BEFORE INSERT ON material_usage_plan_lines FOR EACH ROW EXECUTE FUNCTION erp_mp_scope();
CREATE TRIGGER mp_operation_scope BEFORE INSERT ON material_usage_plan_operations FOR EACH ROW EXECUTE FUNCTION erp_mp_scope();
CREATE FUNCTION erp_mp_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'Material plan retained history cannot be changed or removed'; END $$;
CREATE TRIGGER mp_plan_delete BEFORE DELETE ON material_usage_plans FOR EACH ROW EXECUTE FUNCTION erp_mp_immutable();
CREATE TRIGGER mp_revision_delete BEFORE DELETE ON material_usage_plan_revisions FOR EACH ROW EXECUTE FUNCTION erp_mp_immutable();
CREATE TRIGGER mp_line_history BEFORE UPDATE OR DELETE ON material_usage_plan_lines FOR EACH ROW EXECUTE FUNCTION erp_mp_immutable();
CREATE TRIGGER mp_operation_history BEFORE UPDATE OR DELETE ON material_usage_plan_operations FOR EACH ROW EXECUTE FUNCTION erp_mp_immutable();

CREATE FUNCTION erp_material_usage_plan_snapshot(plan_uuid uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('plan',to_jsonb(p),'revision',to_jsonb(r),
 'lines',coalesce((SELECT jsonb_agg(to_jsonb(l)||jsonb_build_object('quantity',l.quantity::text) ORDER BY budget_revision_line_id)
 FROM material_usage_plan_lines l WHERE revision_id=r.id),'[]'::jsonb))
 FROM material_usage_plans p JOIN material_usage_plan_revisions r ON r.plan_id=p.id
 WHERE p.id=plan_uuid ORDER BY r.revision_no DESC LIMIT 1
$$;
CREATE FUNCTION erp_mp_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid; p RECORD; rev RECORD; op RECORD; n integer; count_revisions integer;
BEGIN
 IF TG_TABLE_NAME='material_usage_plans' THEN target:=NEW.id;
 ELSIF TG_TABLE_NAME='material_usage_plan_lines' THEN SELECT plan_id INTO target FROM material_usage_plan_revisions WHERE id=NEW.revision_id;
 ELSE target:=NEW.plan_id; END IF;
 SELECT * INTO STRICT p FROM material_usage_plans WHERE id=target;
 SELECT * INTO rev FROM material_usage_plan_revisions WHERE plan_id=target ORDER BY revision_no DESC LIMIT 1;
 SELECT * INTO op FROM material_usage_plan_operations WHERE plan_id=target AND plan_version=p.version;
 SELECT count(*) INTO n FROM material_usage_plan_operations WHERE plan_id=target;
 SELECT count(*) INTO count_revisions FROM material_usage_plan_revisions WHERE plan_id=target;
 IF rev.id IS NULL OR op.id IS NULL OR op.revision_id<>rev.id OR n<>p.version OR count_revisions<>rev.revision_no
  OR op.snapshot IS DISTINCT FROM erp_material_usage_plan_snapshot(target)
  OR (SELECT count(*) FROM material_usage_plan_lines WHERE revision_id=rev.id) NOT BETWEEN 1 AND 100
  THEN RAISE EXCEPTION 'Material plan mutation requires complete immutable revision and operation evidence'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER mp_plan_evidence AFTER INSERT OR UPDATE ON material_usage_plans DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_mp_evidence();
CREATE CONSTRAINT TRIGGER mp_revision_evidence AFTER INSERT OR UPDATE ON material_usage_plan_revisions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_mp_evidence();
CREATE CONSTRAINT TRIGGER mp_line_evidence AFTER INSERT ON material_usage_plan_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_mp_evidence();
CREATE CONSTRAINT TRIGGER mp_operation_evidence AFTER INSERT ON material_usage_plan_operations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_mp_evidence();
