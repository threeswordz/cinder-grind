CREATE TABLE "equipment_types" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "equipment_type_code" VARCHAR(80) NOT NULL,
  "equipment_type_name" VARCHAR(150) NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "equipment_types_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "equipment_types_company_id_equipment_type_code_key"
ON "equipment_types"("company_id","equipment_type_code");
CREATE INDEX "equipment_types_company_id_is_active_idx"
ON "equipment_types"("company_id","is_active");
ALTER TABLE "equipment_types"
  ADD CONSTRAINT "equipment_types_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "equipment" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "equipment_type_id" UUID NOT NULL,
  "equipment_code" VARCHAR(80) NOT NULL,
  "equipment_name" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "operational_status" VARCHAR(20) NOT NULL DEFAULT 'AVAILABLE',
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "equipment_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "equipment_operational_status_check"
    CHECK ("operational_status" IN ('AVAILABLE','UNAVAILABLE'))
);
CREATE UNIQUE INDEX "equipment_company_id_equipment_code_key"
ON "equipment"("company_id","equipment_code");
CREATE INDEX "equipment_company_id_is_active_operational_status_idx"
ON "equipment"("company_id","is_active","operational_status");
CREATE INDEX "equipment_equipment_type_id_idx"
ON "equipment"("equipment_type_id");
ALTER TABLE "equipment"
  ADD CONSTRAINT "equipment_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipment"
  ADD CONSTRAINT "equipment_equipment_type_id_fkey"
  FOREIGN KEY ("equipment_type_id") REFERENCES "equipment_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "equipment_assignments" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "equipment_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "assigned_from" DATE NOT NULL,
  "assigned_to" DATE,
  "remarks" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "equipment_assignments_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "equipment_assignments_date_check"
    CHECK ("assigned_to" IS NULL OR "assigned_to" >= "assigned_from")
);
CREATE UNIQUE INDEX "equipment_assignments_one_open_per_equipment_key"
ON "equipment_assignments"("equipment_id") WHERE "assigned_to" IS NULL;
CREATE INDEX "equipment_assignments_company_id_equipment_id_assigned_from_idx"
ON "equipment_assignments"("company_id","equipment_id","assigned_from");
CREATE INDEX "equipment_assignments_project_id_assigned_from_assigned_to_idx"
ON "equipment_assignments"("project_id","assigned_from","assigned_to");
ALTER TABLE "equipment_assignments"
  ADD CONSTRAINT "equipment_assignments_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipment_assignments"
  ADD CONSTRAINT "equipment_assignments_equipment_id_fkey"
  FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipment_assignments"
  ADD CONSTRAINT "equipment_assignments_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "equipment_usage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "equipment_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "usage_date" DATE NOT NULL,
  "operating_hours" DECIMAL(5,2),
  "activity_id" UUID,
  "wbs_id" UUID,
  "remarks" TEXT,
  "source_type" VARCHAR(50) NOT NULL DEFAULT 'MANUAL',
  "source_entity_id" UUID,
  "recorded_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "equipment_usage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "equipment_usage_hours_check"
    CHECK ("operating_hours" IS NULL OR ("operating_hours" > 0 AND "operating_hours" <= 24)),
  CONSTRAINT "equipment_usage_source_check"
    CHECK ("source_type" IN ('MANUAL','DAILY_SITE_REPORT','DAILY_SITE_REPORT_CORRECTION')),
  CONSTRAINT "equipment_usage_source_entity_check"
    CHECK (
      ("source_type" = 'MANUAL' AND "source_entity_id" IS NULL)
      OR
      ("source_type" <> 'MANUAL' AND "source_entity_id" IS NOT NULL)
    )
);
CREATE INDEX "equipment_usage_company_id_equipment_id_usage_date_idx"
ON "equipment_usage"("company_id","equipment_id","usage_date");
CREATE INDEX "equipment_usage_project_id_usage_date_idx"
ON "equipment_usage"("project_id","usage_date");
CREATE INDEX "equipment_usage_activity_id_idx" ON "equipment_usage"("activity_id");
CREATE INDEX "equipment_usage_wbs_id_idx" ON "equipment_usage"("wbs_id");
CREATE INDEX "equipment_usage_source_type_source_entity_id_idx"
ON "equipment_usage"("source_type","source_entity_id");
ALTER TABLE "equipment_usage"
  ADD CONSTRAINT "equipment_usage_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipment_usage"
  ADD CONSTRAINT "equipment_usage_equipment_id_fkey"
  FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipment_usage"
  ADD CONSTRAINT "equipment_usage_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipment_usage"
  ADD CONSTRAINT "equipment_usage_activity_id_fkey"
  FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipment_usage"
  ADD CONSTRAINT "equipment_usage_wbs_id_fkey"
  FOREIGN KEY ("wbs_id") REFERENCES "wbs_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "equipment_usage"
  ADD CONSTRAINT "equipment_usage_recorded_by_user_id_fkey"
  FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "daily_site_report_equipment_usage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "report_id" UUID NOT NULL,
  "equipment_id" UUID NOT NULL,
  "operating_hours" DECIMAL(5,2),
  "activity_id" UUID,
  "wbs_id" UUID,
  "remarks" TEXT,
  "equipment_usage_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "daily_site_report_equipment_usage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "daily_site_report_equipment_usage_hours_check"
    CHECK ("operating_hours" IS NULL OR ("operating_hours" > 0 AND "operating_hours" <= 24))
);
CREATE UNIQUE INDEX "daily_site_report_equipment_usage_equipment_usage_id_key"
ON "daily_site_report_equipment_usage"("equipment_usage_id");
CREATE INDEX "daily_site_report_equipment_usage_report_id_idx"
ON "daily_site_report_equipment_usage"("report_id");
CREATE INDEX "daily_site_report_equipment_usage_equipment_id_idx"
ON "daily_site_report_equipment_usage"("equipment_id");
CREATE INDEX "daily_site_report_equipment_usage_activity_id_idx"
ON "daily_site_report_equipment_usage"("activity_id");
CREATE INDEX "daily_site_report_equipment_usage_wbs_id_idx"
ON "daily_site_report_equipment_usage"("wbs_id");
ALTER TABLE "daily_site_report_equipment_usage"
  ADD CONSTRAINT "daily_site_report_equipment_usage_report_id_fkey"
  FOREIGN KEY ("report_id") REFERENCES "daily_site_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "daily_site_report_equipment_usage"
  ADD CONSTRAINT "daily_site_report_equipment_usage_equipment_id_fkey"
  FOREIGN KEY ("equipment_id") REFERENCES "equipment"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "daily_site_report_equipment_usage"
  ADD CONSTRAINT "daily_site_report_equipment_usage_activity_id_fkey"
  FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "daily_site_report_equipment_usage"
  ADD CONSTRAINT "daily_site_report_equipment_usage_wbs_id_fkey"
  FOREIGN KEY ("wbs_id") REFERENCES "wbs_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "daily_site_report_equipment_usage"
  ADD CONSTRAINT "daily_site_report_equipment_usage_equipment_usage_id_fkey"
  FOREIGN KEY ("equipment_usage_id") REFERENCES "equipment_usage"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION validate_equipment_master()
RETURNS trigger AS $$
DECLARE
  type_company UUID;
  type_active BOOLEAN;
BEGIN
  SELECT "company_id","is_active" INTO type_company,type_active
  FROM "equipment_types" WHERE "id" = NEW."equipment_type_id";

  IF type_company IS NULL OR type_company <> NEW."company_id" THEN
    RAISE EXCEPTION 'Equipment Type must belong to the same Company';
  END IF;

  IF NEW."is_active"
     AND (
       TG_OP = 'INSERT'
       OR NEW."equipment_type_id" IS DISTINCT FROM OLD."equipment_type_id"
       OR NEW."is_active" IS DISTINCT FROM OLD."is_active"
     )
     AND NOT type_active THEN
    RAISE EXCEPTION 'Active Equipment must reference an active Equipment Type';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER equipment_master_guard
BEFORE INSERT OR UPDATE ON "equipment"
FOR EACH ROW EXECUTE FUNCTION validate_equipment_master();

CREATE OR REPLACE FUNCTION validate_equipment_assignment()
RETURNS trigger AS $$
DECLARE
  equipment_company UUID;
  project_company UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Equipment assignment history cannot be deleted';
  END IF;

  SELECT "company_id" INTO equipment_company
  FROM "equipment" WHERE "id" = NEW."equipment_id";
  SELECT "company_id" INTO project_company
  FROM "projects" WHERE "id" = NEW."project_id";

  IF equipment_company IS NULL OR equipment_company <> NEW."company_id" THEN
    RAISE EXCEPTION 'Equipment assignment Equipment must belong to the same Company';
  END IF;
  IF project_company IS NULL OR project_company <> NEW."company_id" THEN
    RAISE EXCEPTION 'Equipment assignment Project must belong to the same Company';
  END IF;

  IF TG_OP = 'UPDATE' AND (
    NEW."company_id" IS DISTINCT FROM OLD."company_id"
    OR NEW."equipment_id" IS DISTINCT FROM OLD."equipment_id"
    OR NEW."project_id" IS DISTINCT FROM OLD."project_id"
    OR NEW."assigned_from" IS DISTINCT FROM OLD."assigned_from"
  ) THEN
    RAISE EXCEPTION 'Equipment assignment identity/history cannot be rewritten';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER equipment_assignment_guard
BEFORE INSERT OR UPDATE OR DELETE ON "equipment_assignments"
FOR EACH ROW EXECUTE FUNCTION validate_equipment_assignment();

CREATE OR REPLACE FUNCTION validate_equipment_usage()
RETURNS trigger AS $$
DECLARE
  equipment_company UUID;
  equipment_active BOOLEAN;
  equipment_status VARCHAR(20);
  project_company UUID;
  user_company UUID;
  ref_project UUID;
  assignment_exists BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Equipment Usage history cannot be deleted';
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."source_type" <> 'MANUAL' THEN
    RAISE EXCEPTION 'Daily Site Report Equipment Usage is immutable';
  END IF;
  IF TG_OP = 'UPDATE' AND NEW."source_type" IS DISTINCT FROM OLD."source_type" THEN
    RAISE EXCEPTION 'Equipment Usage source type cannot be changed';
  END IF;

  SELECT "company_id","is_active","operational_status"
    INTO equipment_company,equipment_active,equipment_status
  FROM "equipment" WHERE "id" = NEW."equipment_id";

  SELECT "company_id" INTO project_company
  FROM "projects" WHERE "id" = NEW."project_id";

  SELECT "company_id" INTO user_company
  FROM "users" WHERE "id" = NEW."recorded_by_user_id";

  IF equipment_company IS NULL OR equipment_company <> NEW."company_id" THEN
    RAISE EXCEPTION 'Equipment Usage Equipment must belong to the same Company';
  END IF;
  IF project_company IS NULL OR project_company <> NEW."company_id" THEN
    RAISE EXCEPTION 'Equipment Usage Project must belong to the same Company';
  END IF;
  IF user_company IS NULL OR user_company <> NEW."company_id" THEN
    RAISE EXCEPTION 'Equipment Usage recorder must belong to the same Company';
  END IF;
  IF NOT equipment_active OR equipment_status <> 'AVAILABLE' THEN
    RAISE EXCEPTION 'New Equipment Usage requires active operationally available Equipment';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM "equipment_assignments" a
    WHERE a."equipment_id" = NEW."equipment_id"
      AND a."project_id" = NEW."project_id"
      AND a."assigned_from" <= NEW."usage_date"
      AND (a."assigned_to" IS NULL OR a."assigned_to" >= NEW."usage_date")
  ) INTO assignment_exists;
  IF NOT assignment_exists THEN
    RAISE EXCEPTION 'Equipment must be assigned to the Project on the usage date';
  END IF;

  IF NEW."activity_id" IS NOT NULL THEN
    SELECT "project_id" INTO ref_project FROM "activities" WHERE "id" = NEW."activity_id";
    IF ref_project IS NULL OR ref_project <> NEW."project_id" THEN
      RAISE EXCEPTION 'Equipment Usage Activity must belong to the same Project';
    END IF;
  END IF;

  IF NEW."wbs_id" IS NOT NULL THEN
    SELECT "project_id" INTO ref_project FROM "wbs_elements" WHERE "id" = NEW."wbs_id";
    IF ref_project IS NULL OR ref_project <> NEW."project_id" THEN
      RAISE EXCEPTION 'Equipment Usage WBS must belong to the same Project';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER equipment_usage_guard
BEFORE INSERT OR UPDATE OR DELETE ON "equipment_usage"
FOR EACH ROW EXECUTE FUNCTION validate_equipment_usage();

CREATE OR REPLACE FUNCTION validate_daily_site_report_equipment_usage()
RETURNS trigger AS $$
DECLARE
  target_report_id UUID;
  report_project UUID;
  report_company UUID;
  report_date DATE;
  report_status VARCHAR(20);
  equipment_company UUID;
  equipment_active BOOLEAN;
  equipment_status VARCHAR(20);
  ref_project UUID;
  assignment_exists BOOLEAN;
BEGIN
  target_report_id := CASE WHEN TG_OP = 'DELETE' THEN OLD."report_id" ELSE NEW."report_id" END;

  SELECT "project_id","company_id","report_date","status"
    INTO report_project,report_company,report_date,report_status
  FROM "daily_site_reports" WHERE "id" = target_report_id;

  IF report_project IS NULL THEN
    RAISE EXCEPTION 'Daily Site Report not found';
  END IF;
  IF report_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Submitted Daily Site Report Equipment usage is immutable';
  END IF;
  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  SELECT "company_id","is_active","operational_status"
    INTO equipment_company,equipment_active,equipment_status
  FROM "equipment" WHERE "id" = NEW."equipment_id";

  IF equipment_company IS NULL OR equipment_company <> report_company THEN
    RAISE EXCEPTION 'Daily Site Report Equipment must belong to the same Company';
  END IF;
  IF NOT equipment_active OR equipment_status <> 'AVAILABLE' THEN
    RAISE EXCEPTION 'Daily Site Report Equipment must be active and operationally available';
  END IF;

  SELECT EXISTS (
    SELECT 1 FROM "equipment_assignments" a
    WHERE a."equipment_id" = NEW."equipment_id"
      AND a."project_id" = report_project
      AND a."assigned_from" <= report_date
      AND (a."assigned_to" IS NULL OR a."assigned_to" >= report_date)
  ) INTO assignment_exists;
  IF NOT assignment_exists THEN
    RAISE EXCEPTION 'Daily Site Report Equipment must be assigned to the Project on the report date';
  END IF;

  IF NEW."activity_id" IS NOT NULL THEN
    SELECT "project_id" INTO ref_project FROM "activities" WHERE "id" = NEW."activity_id";
    IF ref_project IS NULL OR ref_project <> report_project THEN
      RAISE EXCEPTION 'Daily Site Report Equipment Activity must belong to the same Project';
    END IF;
  END IF;
  IF NEW."wbs_id" IS NOT NULL THEN
    SELECT "project_id" INTO ref_project FROM "wbs_elements" WHERE "id" = NEW."wbs_id";
    IF ref_project IS NULL OR ref_project <> report_project THEN
      RAISE EXCEPTION 'Daily Site Report Equipment WBS must belong to the same Project';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER daily_site_report_equipment_usage_guard
BEFORE INSERT OR UPDATE OR DELETE ON "daily_site_report_equipment_usage"
FOR EACH ROW EXECUTE FUNCTION validate_daily_site_report_equipment_usage();

CREATE OR REPLACE FUNCTION protect_submitted_daily_site_report()
RETURNS trigger AS $$
DECLARE
  invalid_progress_count INTEGER;
  invalid_equipment_count INTEGER;
BEGIN
  IF OLD."status" = 'SUBMITTED' THEN
    RAISE EXCEPTION 'Submitted Daily Site Reports are immutable';
  END IF;

  IF NEW."status" = 'SUBMITTED' THEN
    SELECT COUNT(*)
      INTO invalid_progress_count
    FROM "daily_site_report_progress_lines" line
    LEFT JOIN "activity_progress" progress
      ON progress."id" = line."activity_progress_id"
    WHERE line."report_id" = NEW."id"
      AND (
        line."activity_progress_id" IS NULL
        OR progress."id" IS NULL
        OR progress."project_id" <> NEW."project_id"
        OR progress."activity_id" <> line."activity_id"
        OR progress."progress_date" <> NEW."report_date"
        OR progress."source_type" <> 'DAILY_SITE_REPORT'
        OR progress."source_entity_id" <> NEW."id"
        OR progress."percent_complete" <> line."percent_complete"
      );

    IF invalid_progress_count > 0 THEN
      RAISE EXCEPTION 'Daily Site Report progress must be appended to Activity Progress before submission';
    END IF;

    SELECT COUNT(*)
      INTO invalid_equipment_count
    FROM "daily_site_report_equipment_usage" line
    LEFT JOIN "equipment_usage" usage
      ON usage."id" = line."equipment_usage_id"
    WHERE line."report_id" = NEW."id"
      AND (
        line."equipment_usage_id" IS NULL
        OR usage."id" IS NULL
        OR usage."project_id" <> NEW."project_id"
        OR usage."equipment_id" <> line."equipment_id"
        OR usage."usage_date" <> NEW."report_date"
        OR usage."source_type" <> 'DAILY_SITE_REPORT'
        OR usage."source_entity_id" <> NEW."id"
        OR usage."operating_hours" IS DISTINCT FROM line."operating_hours"
        OR usage."activity_id" IS DISTINCT FROM line."activity_id"
        OR usage."wbs_id" IS DISTINCT FROM line."wbs_id"
        OR usage."remarks" IS DISTINCT FROM line."remarks"
      );

    IF invalid_equipment_count > 0 THEN
      RAISE EXCEPTION 'Daily Site Report Equipment lines must be appended to Equipment Usage before submission';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
