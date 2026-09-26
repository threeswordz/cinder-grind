ALTER TABLE "projects"
  ADD COLUMN "actual_start_date" DATE,
  ADD COLUMN "actual_completion_date" DATE,
  ADD CONSTRAINT "projects_actual_dates_check"
    CHECK (
      "actual_start_date" IS NULL
      OR "actual_completion_date" IS NULL
      OR "actual_start_date" <= "actual_completion_date"
    );

CREATE TABLE "schedule_baselines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "version_no" INTEGER NOT NULL,
  "approval_instance_id" UUID,
  "submitted_by_user_id" UUID NOT NULL,
  "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "schedule_baselines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "schedule_baselines_version_positive_check" CHECK ("version_no" > 0),
  CONSTRAINT "schedule_baselines_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "schedule_baselines_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "schedule_baselines_approval_instance_id_fkey"
    FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "schedule_baselines_submitted_by_user_id_fkey"
    FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "schedule_baselines_project_id_version_no_key"
  ON "schedule_baselines"("project_id", "version_no");
CREATE UNIQUE INDEX "schedule_baselines_approval_instance_id_key"
  ON "schedule_baselines"("approval_instance_id");
CREATE INDEX "schedule_baselines_company_id_project_id_version_no_idx"
  ON "schedule_baselines"("company_id", "project_id", "version_no");
CREATE INDEX "schedule_baselines_submitted_by_user_id_submitted_at_idx"
  ON "schedule_baselines"("submitted_by_user_id", "submitted_at");

CREATE TABLE "schedule_baseline_activities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "schedule_baseline_id" UUID NOT NULL,
  "activity_id" UUID NOT NULL,
  "wbs_id" UUID NOT NULL,
  "activity_code" VARCHAR(80) NOT NULL,
  "activity_name" VARCHAR(200) NOT NULL,
  "wbs_code" VARCHAR(80) NOT NULL,
  "wbs_name" VARCHAR(200) NOT NULL,
  "is_summary" BOOLEAN NOT NULL,
  "is_milestone" BOOLEAN NOT NULL,
  "planned_duration_work_days" DECIMAL(8,2) NOT NULL,
  "planned_start_date" DATE NOT NULL,
  "planned_finish_date" DATE NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "schedule_baseline_activities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "schedule_baseline_activities_duration_check"
    CHECK ("planned_duration_work_days" >= 0),
  CONSTRAINT "schedule_baseline_activities_dates_check"
    CHECK ("planned_start_date" <= "planned_finish_date"),
  CONSTRAINT "schedule_baseline_activities_baseline_id_fkey"
    FOREIGN KEY ("schedule_baseline_id") REFERENCES "schedule_baselines"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "schedule_baseline_activities_activity_id_fkey"
    FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "schedule_baseline_activities_wbs_id_fkey"
    FOREIGN KEY ("wbs_id") REFERENCES "wbs_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "schedule_baseline_activities_schedule_baseline_id_activity_id_key"
  ON "schedule_baseline_activities"("schedule_baseline_id", "activity_id");
CREATE INDEX "schedule_baseline_activities_activity_id_idx"
  ON "schedule_baseline_activities"("activity_id");
CREATE INDEX "schedule_baseline_activities_wbs_id_idx"
  ON "schedule_baseline_activities"("wbs_id");

CREATE TABLE "activity_progress" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "activity_id" UUID NOT NULL,
  "progress_date" DATE NOT NULL,
  "percent_complete" DECIMAL(5,2) NOT NULL,
  "note" TEXT,
  "source_type" VARCHAR(30) NOT NULL DEFAULT 'MANUAL',
  "source_entity_id" UUID,
  "recorded_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activity_progress_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "activity_progress_percent_check"
    CHECK ("percent_complete" >= 0 AND "percent_complete" <= 100),
  CONSTRAINT "activity_progress_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activity_progress_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activity_progress_activity_id_fkey"
    FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activity_progress_recorded_by_user_id_fkey"
    FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "activity_progress_company_id_project_id_progress_date_idx"
  ON "activity_progress"("company_id", "project_id", "progress_date");
CREATE INDEX "activity_progress_activity_id_progress_date_created_at_idx"
  ON "activity_progress"("activity_id", "progress_date", "created_at");
CREATE INDEX "activity_progress_recorded_by_user_id_created_at_idx"
  ON "activity_progress"("recorded_by_user_id", "created_at");

CREATE OR REPLACE FUNCTION enforce_schedule_baseline_scope()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1
    FROM projects p
    WHERE p.id = NEW.project_id
      AND p.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'Schedule Baseline Project must belong to the same Company';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM users u
    WHERE u.id = NEW.submitted_by_user_id
      AND u.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'Schedule Baseline submitter must belong to the same Company';
  END IF;

  IF NEW.approval_instance_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM approval_instances ai
    WHERE ai.id = NEW.approval_instance_id
      AND ai.company_id = NEW.company_id
      AND ai.entity_type = 'SCHEDULE_BASELINE'
      AND ai.entity_id = NEW.id
  ) THEN
    RAISE EXCEPTION 'Schedule Baseline approval instance is invalid';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER schedule_baseline_scope
BEFORE INSERT OR UPDATE OF company_id, project_id, submitted_by_user_id, approval_instance_id
ON schedule_baselines
FOR EACH ROW EXECUTE FUNCTION enforce_schedule_baseline_scope();

CREATE OR REPLACE FUNCTION enforce_schedule_baseline_snapshot_scope()
RETURNS trigger AS $$
DECLARE
  baseline_project UUID;
BEGIN
  SELECT project_id INTO baseline_project
  FROM schedule_baselines
  WHERE id = NEW.schedule_baseline_id;

  IF baseline_project IS NULL THEN
    RAISE EXCEPTION 'Schedule Baseline does not exist';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM activities a
    WHERE a.id = NEW.activity_id
      AND a.project_id = baseline_project
  ) THEN
    RAISE EXCEPTION 'Baseline Activity must belong to the Baseline Project';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM wbs_elements w
    WHERE w.id = NEW.wbs_id
      AND w.project_id = baseline_project
  ) THEN
    RAISE EXCEPTION 'Baseline WBS must belong to the Baseline Project';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER schedule_baseline_snapshot_scope
BEFORE INSERT ON schedule_baseline_activities
FOR EACH ROW EXECUTE FUNCTION enforce_schedule_baseline_snapshot_scope();

CREATE OR REPLACE FUNCTION prevent_schedule_baseline_mutation()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Schedule Baselines cannot be deleted';
  END IF;

  IF OLD.approval_instance_id IS NOT NULL THEN
    RAISE EXCEPTION 'Submitted Schedule Baselines are immutable';
  END IF;

  IF NEW.approval_instance_id IS NULL THEN
    RAISE EXCEPTION 'Schedule Baseline update may only attach its approval instance';
  END IF;

  IF ROW(
    NEW.id,
    NEW.company_id,
    NEW.project_id,
    NEW.version_no,
    NEW.submitted_by_user_id,
    NEW.submitted_at,
    NEW.created_at
  ) IS DISTINCT FROM ROW(
    OLD.id,
    OLD.company_id,
    OLD.project_id,
    OLD.version_no,
    OLD.submitted_by_user_id,
    OLD.submitted_at,
    OLD.created_at
  ) THEN
    RAISE EXCEPTION 'Schedule Baseline snapshot metadata is immutable';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER schedule_baseline_immutable
BEFORE UPDATE OR DELETE ON schedule_baselines
FOR EACH ROW EXECUTE FUNCTION prevent_schedule_baseline_mutation();

CREATE OR REPLACE FUNCTION prevent_schedule_baseline_activity_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Schedule Baseline Activity snapshots are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER schedule_baseline_activity_immutable
BEFORE UPDATE OR DELETE ON schedule_baseline_activities
FOR EACH ROW EXECUTE FUNCTION prevent_schedule_baseline_activity_mutation();

CREATE OR REPLACE FUNCTION enforce_activity_progress_scope()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = NEW.project_id
      AND p.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'Activity Progress Project must belong to the same Company';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM activities a
    WHERE a.id = NEW.activity_id
      AND a.project_id = NEW.project_id
      AND a.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'Activity Progress Activity must belong to the same Project and Company';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = NEW.recorded_by_user_id
      AND u.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'Activity Progress recorder must belong to the same Company';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER activity_progress_scope
BEFORE INSERT ON activity_progress
FOR EACH ROW EXECUTE FUNCTION enforce_activity_progress_scope();

CREATE OR REPLACE FUNCTION prevent_activity_progress_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Activity Progress history is append-only';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER activity_progress_append_only
BEFORE UPDATE OR DELETE ON activity_progress
FOR EACH ROW EXECUTE FUNCTION prevent_activity_progress_mutation();
