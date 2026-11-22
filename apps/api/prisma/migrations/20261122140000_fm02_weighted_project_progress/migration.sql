-- FM02: forward-only weighted Project progress definition and measured
-- quantities on the existing append-only ActivityProgress source. No data
-- backfill, grants, runtime activation, Cost/Client BOQ or approvals rewritten.
ALTER TABLE activity_progress
  ADD COLUMN completed_quantity NUMERIC(18,4),
  ADD COLUMN source_budget_revision_line_id UUID REFERENCES budget_revision_lines(id) ON DELETE RESTRICT,
  ADD COLUMN source_uom_id UUID REFERENCES units_of_measure(id) ON DELETE RESTRICT;
ALTER TABLE activity_progress
  ADD CONSTRAINT activity_progress_quantity_source_consistency CHECK (
    (completed_quantity IS NULL AND source_budget_revision_line_id IS NULL AND source_uom_id IS NULL AND source_type <> 'BOQ_QUANTITY')
    OR (completed_quantity IS NOT NULL AND completed_quantity >= 0 AND source_type = 'BOQ_QUANTITY'
      AND source_budget_revision_line_id IS NOT NULL AND source_uom_id IS NOT NULL)
  );

CREATE TABLE project_progress_plans (
 id UUID PRIMARY KEY,
 company_id UUID NOT NULL REFERENCES companies(id) ON DELETE RESTRICT,
 project_id UUID NOT NULL REFERENCES projects(id) ON DELETE RESTRICT,
 version_no INTEGER NOT NULL CHECK (version_no >= 1),
 reason TEXT NOT NULL CHECK (length(btrim(reason)) > 0),
 prepared_by_user_id UUID NOT NULL REFERENCES users(id) ON DELETE RESTRICT,
 prepared_at TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
 confirmed_by_user_id UUID REFERENCES users(id) ON DELETE RESTRICT,
 confirmed_at TIMESTAMPTZ(6),
 CONSTRAINT fm02_confirmation_pair CHECK ((confirmed_by_user_id IS NULL) = (confirmed_at IS NULL)),
 CONSTRAINT fm02_separate_preparer CHECK (confirmed_by_user_id IS DISTINCT FROM prepared_by_user_id),
 CONSTRAINT project_progress_plans_project_id_version_no_key UNIQUE(project_id,version_no)
);
CREATE INDEX project_progress_plans_company_id_project_id_version_no_idx
 ON project_progress_plans(company_id,project_id,version_no);

CREATE TABLE project_progress_plan_lines (
 id UUID PRIMARY KEY,
 plan_id UUID NOT NULL REFERENCES project_progress_plans(id) ON DELETE RESTRICT,
 activity_id UUID NOT NULL REFERENCES activities(id) ON DELETE RESTRICT,
 weight_percent NUMERIC(5,2) NOT NULL CHECK (weight_percent > 0 AND weight_percent <= 100),
 source_kind VARCHAR(12) NOT NULL CHECK (source_kind IN ('QUANTITY','MILESTONE')),
 approved_budget_revision_line_id UUID REFERENCES budget_revision_lines(id) ON DELETE RESTRICT,
 planned_quantity NUMERIC(18,4),
 uom_id UUID REFERENCES units_of_measure(id) ON DELETE RESTRICT,
 CONSTRAINT fm02_quantity_source_pair CHECK (
   (source_kind='MILESTONE' AND approved_budget_revision_line_id IS NULL AND planned_quantity IS NULL AND uom_id IS NULL)
   OR (source_kind='QUANTITY' AND approved_budget_revision_line_id IS NOT NULL
     AND planned_quantity IS NOT NULL AND planned_quantity > 0 AND uom_id IS NOT NULL)
 ),
 CONSTRAINT project_progress_plan_lines_plan_id_activity_id_key UNIQUE(plan_id,activity_id),
 CONSTRAINT project_progress_plan_lines_plan_id_approved_budget_revision_line_id_key
  UNIQUE(plan_id,approved_budget_revision_line_id)
);
CREATE INDEX project_progress_plan_lines_activity_id_idx ON project_progress_plan_lines(activity_id);

-- No updates/deletes to snapshots; revisions must create a new version.
CREATE FUNCTION erp_fm02_immutable_lines() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'FM02_IMMUTABLE_PLAN_LINE'; END; $$;
CREATE TRIGGER fm02_lines_immutable BEFORE UPDATE OR DELETE ON project_progress_plan_lines
  FOR EACH ROW EXECUTE FUNCTION erp_fm02_immutable_lines();

-- The single allowed plan UPDATE confirms a frozen version exactly once.
CREATE FUNCTION erp_fm02_confirm_only() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE total_weight numeric;
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'FM02_IMMUTABLE_PLAN'; END IF;
 IF OLD.confirmed_at IS NOT NULL OR OLD.confirmed_by_user_id IS NOT NULL
   OR NEW.id IS DISTINCT FROM OLD.id
   OR NEW.company_id IS DISTINCT FROM OLD.company_id
   OR NEW.project_id IS DISTINCT FROM OLD.project_id
   OR NEW.version_no IS DISTINCT FROM OLD.version_no
   OR NEW.reason IS DISTINCT FROM OLD.reason
   OR NEW.prepared_by_user_id IS DISTINCT FROM OLD.prepared_by_user_id
   OR NEW.prepared_at IS DISTINCT FROM OLD.prepared_at
   OR NEW.confirmed_at IS NULL OR NEW.confirmed_by_user_id IS NULL
 THEN RAISE EXCEPTION 'FM02_IMMUTABLE_PLAN'; END IF;
 SELECT SUM(weight_percent) INTO total_weight FROM project_progress_plan_lines WHERE plan_id=OLD.id;
 IF total_weight IS DISTINCT FROM 100 THEN RAISE EXCEPTION 'FM02_WEIGHTS_NOT_COMPLETE'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER fm02_plan_confirm_only BEFORE UPDATE OR DELETE ON project_progress_plans
  FOR EACH ROW EXECUTE FUNCTION erp_fm02_confirm_only();


-- No new plan can arrive already confirmed; confirmation is a distinct UPDATE.
CREATE FUNCTION erp_fm02_plan_create_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.confirmed_at IS NOT NULL OR NEW.confirmed_by_user_id IS NOT NULL
 THEN RAISE EXCEPTION 'FM02_PLAN_CONFIRMATION_MUST_BE_SEPARATE'; END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER fm02_plan_create_guard BEFORE INSERT ON project_progress_plans
 FOR EACH ROW EXECUTE FUNCTION erp_fm02_plan_create_guard();

-- Once confirmed, no new source row may be injected. Bind Company/Project,
-- Activity/WBS, approved BOQ source, UOM and quantity even for direct SQL.
CREATE FUNCTION erp_fm02_plan_line_create_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p record; a record; b record;
BEGIN
 SELECT company_id,project_id,confirmed_at INTO p
 FROM project_progress_plans WHERE id=NEW.plan_id FOR UPDATE;
 IF p.company_id IS NULL OR p.confirmed_at IS NOT NULL
 THEN RAISE EXCEPTION 'FM02_IMMUTABLE_CONFIRMED_LINE'; END IF;
 SELECT company_id,project_id,wbs_id,is_active,is_summary INTO a
 FROM activities WHERE id=NEW.activity_id;
 IF a.company_id IS DISTINCT FROM p.company_id OR a.project_id IS DISTINCT FROM p.project_id
    OR NOT a.is_active OR a.is_summary
 THEN RAISE EXCEPTION 'FM02_ACTIVITY_SCOPE_INVALID'; END IF;
 IF NEW.source_kind='QUANTITY' THEN
   SELECT br.company_id,br.project_id,bl.wbs_id,bl.quantity,bl.uom_id,ai.approval_state
   INTO b FROM budget_revision_lines bl
   JOIN budget_revisions br ON br.id=bl.budget_revision_id
   JOIN approval_instances ai ON ai.id=br.approval_instance_id
   WHERE bl.id=NEW.approved_budget_revision_line_id;
   IF b.company_id IS DISTINCT FROM p.company_id OR b.project_id IS DISTINCT FROM p.project_id
      OR b.wbs_id IS DISTINCT FROM a.wbs_id OR b.approval_state IS DISTINCT FROM 'APPROVED'
      OR b.quantity IS DISTINCT FROM NEW.planned_quantity OR b.uom_id IS DISTINCT FROM NEW.uom_id
   THEN RAISE EXCEPTION 'FM02_APPROVED_QUANTITY_SOURCE_INVALID'; END IF;
 END IF;
 RETURN NEW;
END; $$;
CREATE TRIGGER fm02_line_create_guard BEFORE INSERT ON project_progress_plan_lines
 FOR EACH ROW EXECUTE FUNCTION erp_fm02_plan_line_create_guard();

-- Capability catalog; no automatic role/user/SYS_ADMIN grants.
INSERT INTO permissions(id,permission_code,module_code,description)
VALUES ('f0020000-0000-4000-8000-000000000001','schedule.work_plan.prepare','SCHEDULING',
 'Prepare an immutable FM02 weighted Project work-plan version'),
 ('f0020000-0000-4000-8000-000000000002','schedule.work_plan.confirm','SCHEDULING',
 'Confirm FM02 weighted work plan as explicitly configured Ben role')
ON CONFLICT (permission_code) DO NOTHING;
