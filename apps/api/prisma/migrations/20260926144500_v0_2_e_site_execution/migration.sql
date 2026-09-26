CREATE TABLE "daily_site_reports" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "report_date" DATE NOT NULL,
  "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  "weather_observation" TEXT,
  "general_remarks" TEXT,
  "created_by_user_id" UUID NOT NULL,
  "submitted_by_user_id" UUID,
  "submitted_at" TIMESTAMPTZ(6),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "daily_site_reports_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "daily_site_reports_status_check"
    CHECK ("status" IN ('DRAFT', 'SUBMITTED')),
  CONSTRAINT "daily_site_reports_submission_check"
    CHECK (
      ("status" = 'DRAFT' AND "submitted_by_user_id" IS NULL AND "submitted_at" IS NULL)
      OR
      ("status" = 'SUBMITTED' AND "submitted_by_user_id" IS NOT NULL AND "submitted_at" IS NOT NULL)
    )
);

CREATE UNIQUE INDEX "daily_site_reports_project_id_report_date_key"
ON "daily_site_reports"("project_id", "report_date");
CREATE INDEX "daily_site_reports_company_id_project_id_report_date_idx"
ON "daily_site_reports"("company_id", "project_id", "report_date");
CREATE INDEX "daily_site_reports_project_id_status_report_date_idx"
ON "daily_site_reports"("project_id", "status", "report_date");

ALTER TABLE "daily_site_reports"
  ADD CONSTRAINT "daily_site_reports_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "daily_site_reports"
  ADD CONSTRAINT "daily_site_reports_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "daily_site_reports"
  ADD CONSTRAINT "daily_site_reports_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "daily_site_reports"
  ADD CONSTRAINT "daily_site_reports_submitted_by_user_id_fkey"
  FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "daily_site_report_manpower" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "report_id" UUID NOT NULL,
  "trade_role" VARCHAR(150) NOT NULL,
  "headcount" INTEGER NOT NULL,
  "remarks" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "daily_site_report_manpower_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "daily_site_report_manpower_headcount_check" CHECK ("headcount" > 0)
);
CREATE INDEX "daily_site_report_manpower_report_id_idx"
ON "daily_site_report_manpower"("report_id");
ALTER TABLE "daily_site_report_manpower"
  ADD CONSTRAINT "daily_site_report_manpower_report_id_fkey"
  FOREIGN KEY ("report_id") REFERENCES "daily_site_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "daily_site_report_material_usage" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "report_id" UUID NOT NULL,
  "material_id" UUID NOT NULL,
  "uom_id" UUID NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "activity_id" UUID,
  "wbs_id" UUID,
  "remarks" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "daily_site_report_material_usage_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "daily_site_report_material_usage_quantity_check" CHECK ("quantity" > 0)
);
CREATE INDEX "daily_site_report_material_usage_report_id_idx"
ON "daily_site_report_material_usage"("report_id");
CREATE INDEX "daily_site_report_material_usage_material_id_idx"
ON "daily_site_report_material_usage"("material_id");
CREATE INDEX "daily_site_report_material_usage_activity_id_idx"
ON "daily_site_report_material_usage"("activity_id");
CREATE INDEX "daily_site_report_material_usage_wbs_id_idx"
ON "daily_site_report_material_usage"("wbs_id");
ALTER TABLE "daily_site_report_material_usage"
  ADD CONSTRAINT "daily_site_report_material_usage_report_id_fkey"
  FOREIGN KEY ("report_id") REFERENCES "daily_site_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "daily_site_report_material_usage"
  ADD CONSTRAINT "daily_site_report_material_usage_material_id_fkey"
  FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "daily_site_report_material_usage"
  ADD CONSTRAINT "daily_site_report_material_usage_uom_id_fkey"
  FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "daily_site_report_material_usage"
  ADD CONSTRAINT "daily_site_report_material_usage_activity_id_fkey"
  FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "daily_site_report_material_usage"
  ADD CONSTRAINT "daily_site_report_material_usage_wbs_id_fkey"
  FOREIGN KEY ("wbs_id") REFERENCES "wbs_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "daily_site_report_progress_lines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "report_id" UUID NOT NULL,
  "activity_id" UUID NOT NULL,
  "percent_complete" DECIMAL(5,2) NOT NULL,
  "note" TEXT,
  "activity_progress_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "daily_site_report_progress_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "daily_site_report_progress_lines_percent_check"
    CHECK ("percent_complete" >= 0 AND "percent_complete" <= 100)
);
CREATE UNIQUE INDEX "daily_site_report_progress_lines_report_id_activity_id_key"
ON "daily_site_report_progress_lines"("report_id", "activity_id");
CREATE UNIQUE INDEX "daily_site_report_progress_lines_activity_progress_id_key"
ON "daily_site_report_progress_lines"("activity_progress_id");
CREATE INDEX "daily_site_report_progress_lines_activity_id_idx"
ON "daily_site_report_progress_lines"("activity_id");
ALTER TABLE "daily_site_report_progress_lines"
  ADD CONSTRAINT "daily_site_report_progress_lines_report_id_fkey"
  FOREIGN KEY ("report_id") REFERENCES "daily_site_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "daily_site_report_progress_lines"
  ADD CONSTRAINT "daily_site_report_progress_lines_activity_id_fkey"
  FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "daily_site_report_progress_lines"
  ADD CONSTRAINT "daily_site_report_progress_lines_activity_progress_id_fkey"
  FOREIGN KEY ("activity_progress_id") REFERENCES "activity_progress"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "daily_site_report_issues" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "report_id" UUID NOT NULL,
  "activity_id" UUID,
  "issue_text" TEXT NOT NULL,
  "remarks" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "daily_site_report_issues_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "daily_site_report_issues_report_id_idx"
ON "daily_site_report_issues"("report_id");
CREATE INDEX "daily_site_report_issues_activity_id_idx"
ON "daily_site_report_issues"("activity_id");
ALTER TABLE "daily_site_report_issues"
  ADD CONSTRAINT "daily_site_report_issues_report_id_fkey"
  FOREIGN KEY ("report_id") REFERENCES "daily_site_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "daily_site_report_issues"
  ADD CONSTRAINT "daily_site_report_issues_activity_id_fkey"
  FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "daily_site_report_delays" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "report_id" UUID NOT NULL,
  "activity_id" UUID,
  "delay_reason" TEXT NOT NULL,
  "remarks" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "daily_site_report_delays_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "daily_site_report_delays_report_id_idx"
ON "daily_site_report_delays"("report_id");
CREATE INDEX "daily_site_report_delays_activity_id_idx"
ON "daily_site_report_delays"("activity_id");
ALTER TABLE "daily_site_report_delays"
  ADD CONSTRAINT "daily_site_report_delays_report_id_fkey"
  FOREIGN KEY ("report_id") REFERENCES "daily_site_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "daily_site_report_delays"
  ADD CONSTRAINT "daily_site_report_delays_activity_id_fkey"
  FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "daily_site_report_inspections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "report_id" UUID NOT NULL,
  "activity_id" UUID,
  "inspection_reference" VARCHAR(200),
  "remarks" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "daily_site_report_inspections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "daily_site_report_inspections_content_check"
    CHECK (
      NULLIF(BTRIM(COALESCE("inspection_reference", '')), '') IS NOT NULL
      OR NULLIF(BTRIM(COALESCE("remarks", '')), '') IS NOT NULL
    )
);
CREATE INDEX "daily_site_report_inspections_report_id_idx"
ON "daily_site_report_inspections"("report_id");
CREATE INDEX "daily_site_report_inspections_activity_id_idx"
ON "daily_site_report_inspections"("activity_id");
ALTER TABLE "daily_site_report_inspections"
  ADD CONSTRAINT "daily_site_report_inspections_report_id_fkey"
  FOREIGN KEY ("report_id") REFERENCES "daily_site_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "daily_site_report_inspections"
  ADD CONSTRAINT "daily_site_report_inspections_activity_id_fkey"
  FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "daily_site_report_corrections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "report_id" UUID NOT NULL,
  "correction_note" TEXT NOT NULL,
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "daily_site_report_corrections_pkey" PRIMARY KEY ("id")
);
CREATE INDEX "daily_site_report_corrections_report_id_created_at_idx"
ON "daily_site_report_corrections"("report_id", "created_at");
CREATE INDEX "daily_site_report_corrections_created_by_user_id_idx"
ON "daily_site_report_corrections"("created_by_user_id");
ALTER TABLE "daily_site_report_corrections"
  ADD CONSTRAINT "daily_site_report_corrections_report_id_fkey"
  FOREIGN KEY ("report_id") REFERENCES "daily_site_reports"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "daily_site_report_corrections"
  ADD CONSTRAINT "daily_site_report_corrections_created_by_user_id_fkey"
  FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION validate_daily_site_report_scope()
RETURNS trigger AS $$
DECLARE
  project_company UUID;
  creator_company UUID;
  submitter_company UUID;
BEGIN
  SELECT "company_id" INTO project_company FROM "projects" WHERE "id" = NEW."project_id";
  SELECT "company_id" INTO creator_company FROM "users" WHERE "id" = NEW."created_by_user_id";
  IF NEW."submitted_by_user_id" IS NOT NULL THEN
    SELECT "company_id" INTO submitter_company FROM "users" WHERE "id" = NEW."submitted_by_user_id";
  END IF;

  IF project_company IS NULL OR project_company <> NEW."company_id" THEN
    RAISE EXCEPTION 'Daily Site Report Project must belong to the same Company';
  END IF;
  IF creator_company IS NULL OR creator_company <> NEW."company_id" THEN
    RAISE EXCEPTION 'Daily Site Report creator must belong to the same Company';
  END IF;
  IF NEW."submitted_by_user_id" IS NOT NULL
     AND (submitter_company IS NULL OR submitter_company <> NEW."company_id") THEN
    RAISE EXCEPTION 'Daily Site Report submitter must belong to the same Company';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER daily_site_reports_scope_guard
BEFORE INSERT OR UPDATE ON "daily_site_reports"
FOR EACH ROW EXECUTE FUNCTION validate_daily_site_report_scope();

CREATE OR REPLACE FUNCTION protect_submitted_daily_site_report()
RETURNS trigger AS $$
DECLARE
  invalid_progress_count INTEGER;
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
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER daily_site_reports_submitted_update_guard
BEFORE UPDATE ON "daily_site_reports"
FOR EACH ROW EXECUTE FUNCTION protect_submitted_daily_site_report();

CREATE OR REPLACE FUNCTION validate_daily_site_report_child()
RETURNS trigger AS $$
DECLARE
  report_project UUID;
  report_company UUID;
  report_status VARCHAR(20);
  ref_project UUID;
  ref_company UUID;
  target_report_id UUID;
BEGIN
  target_report_id :=
    CASE WHEN TG_OP = 'DELETE' THEN OLD."report_id" ELSE NEW."report_id" END;

  SELECT "project_id", "company_id", "status"
    INTO report_project, report_company, report_status
  FROM "daily_site_reports"
  WHERE "id" = target_report_id;

  IF report_project IS NULL THEN
    RAISE EXCEPTION 'Daily Site Report not found';
  END IF;

  IF report_status <> 'DRAFT' THEN
    RAISE EXCEPTION 'Submitted Daily Site Report content is immutable';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF TG_TABLE_NAME = 'daily_site_report_material_usage' THEN
    SELECT "company_id" INTO ref_company FROM "materials" WHERE "id" = NEW."material_id";
    IF ref_company IS NULL OR ref_company <> report_company THEN
      RAISE EXCEPTION 'Material must belong to the Daily Site Report Company';
    END IF;
    SELECT "company_id" INTO ref_company FROM "units_of_measure" WHERE "id" = NEW."uom_id";
    IF ref_company IS NULL OR ref_company <> report_company THEN
      RAISE EXCEPTION 'UOM must belong to the Daily Site Report Company';
    END IF;
    IF NEW."activity_id" IS NOT NULL THEN
      SELECT "project_id" INTO ref_project FROM "activities" WHERE "id" = NEW."activity_id";
      IF ref_project IS NULL OR ref_project <> report_project THEN
        RAISE EXCEPTION 'Material Activity must belong to the Daily Site Report Project';
      END IF;
    END IF;
    IF NEW."wbs_id" IS NOT NULL THEN
      SELECT "project_id" INTO ref_project FROM "wbs_elements" WHERE "id" = NEW."wbs_id";
      IF ref_project IS NULL OR ref_project <> report_project THEN
        RAISE EXCEPTION 'Material WBS must belong to the Daily Site Report Project';
      END IF;
    END IF;
  ELSIF TG_TABLE_NAME IN (
    'daily_site_report_progress_lines',
    'daily_site_report_issues',
    'daily_site_report_delays',
    'daily_site_report_inspections'
  ) THEN
    IF NEW."activity_id" IS NOT NULL THEN
      SELECT "project_id" INTO ref_project FROM "activities" WHERE "id" = NEW."activity_id";
      IF ref_project IS NULL OR ref_project <> report_project THEN
        RAISE EXCEPTION 'Referenced Activity must belong to the Daily Site Report Project';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER daily_site_report_manpower_guard
BEFORE INSERT OR UPDATE OR DELETE ON "daily_site_report_manpower"
FOR EACH ROW EXECUTE FUNCTION validate_daily_site_report_child();
CREATE TRIGGER daily_site_report_material_usage_guard
BEFORE INSERT OR UPDATE OR DELETE ON "daily_site_report_material_usage"
FOR EACH ROW EXECUTE FUNCTION validate_daily_site_report_child();
CREATE TRIGGER daily_site_report_progress_lines_guard
BEFORE INSERT OR UPDATE OR DELETE ON "daily_site_report_progress_lines"
FOR EACH ROW EXECUTE FUNCTION validate_daily_site_report_child();
CREATE TRIGGER daily_site_report_issues_guard
BEFORE INSERT OR UPDATE OR DELETE ON "daily_site_report_issues"
FOR EACH ROW EXECUTE FUNCTION validate_daily_site_report_child();
CREATE TRIGGER daily_site_report_delays_guard
BEFORE INSERT OR UPDATE OR DELETE ON "daily_site_report_delays"
FOR EACH ROW EXECUTE FUNCTION validate_daily_site_report_child();
CREATE TRIGGER daily_site_report_inspections_guard
BEFORE INSERT OR UPDATE OR DELETE ON "daily_site_report_inspections"
FOR EACH ROW EXECUTE FUNCTION validate_daily_site_report_child();

CREATE OR REPLACE FUNCTION protect_daily_site_report_corrections()
RETURNS trigger AS $$
DECLARE
  report_status VARCHAR(20);
  report_company_id UUID;
  creator_company_id UUID;
BEGIN
  IF TG_OP IN ('UPDATE', 'DELETE') THEN
    RAISE EXCEPTION 'Daily Site Report corrections are append-only';
  END IF;

  SELECT "status", "company_id"
    INTO report_status, report_company_id
  FROM "daily_site_reports"
  WHERE "id" = NEW."report_id";

  IF report_status IS NULL THEN
    RAISE EXCEPTION 'Daily Site Report not found';
  END IF;
  IF report_status <> 'SUBMITTED' THEN
    RAISE EXCEPTION 'Corrections can only be appended to submitted Daily Site Reports';
  END IF;

  SELECT "company_id" INTO creator_company_id
  FROM "users"
  WHERE "id" = NEW."created_by_user_id";

  IF creator_company_id IS NULL OR creator_company_id <> report_company_id THEN
    RAISE EXCEPTION 'Daily Site Report correction creator must belong to the same Company';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER daily_site_report_corrections_guard
BEFORE INSERT OR UPDATE OR DELETE ON "daily_site_report_corrections"
FOR EACH ROW EXECUTE FUNCTION protect_daily_site_report_corrections();


CREATE OR REPLACE FUNCTION protect_daily_site_report_document_links()
RETURNS trigger AS $$
DECLARE
  target_entity_type VARCHAR(100);
  target_entity_id UUID;
  report_project_id UUID;
  report_company_id UUID;
  report_status VARCHAR(20);
  document_company_id UUID;
  linker_company_id UUID;
  has_project_link BOOLEAN;
BEGIN
  IF TG_OP = 'DELETE' THEN
    target_entity_type := OLD."entity_type";
    target_entity_id := OLD."entity_id";
  ELSE
    target_entity_type := NEW."entity_type";
    target_entity_id := NEW."entity_id";
  END IF;

  IF target_entity_type = 'DAILY_SITE_REPORT' THEN
    SELECT "project_id", "company_id", "status"
      INTO report_project_id, report_company_id, report_status
    FROM "daily_site_reports"
    WHERE "id" = target_entity_id;

    IF report_project_id IS NULL THEN
      RAISE EXCEPTION 'Daily Site Report document link target does not exist';
    END IF;
    IF report_status <> 'DRAFT' THEN
      RAISE EXCEPTION 'Submitted Daily Site Report document links are immutable';
    END IF;

    IF TG_OP <> 'DELETE' THEN
      SELECT "company_id" INTO document_company_id
      FROM "documents"
      WHERE "id" = NEW."document_id";

      SELECT "company_id" INTO linker_company_id
      FROM "users"
      WHERE "id" = NEW."linked_by_user_id";

      IF document_company_id IS NULL OR document_company_id <> report_company_id THEN
        RAISE EXCEPTION 'Daily Site Report document must belong to the same Company';
      END IF;
      IF linker_company_id IS NULL OR linker_company_id <> report_company_id THEN
        RAISE EXCEPTION 'Daily Site Report document linker must belong to the same Company';
      END IF;

      SELECT EXISTS (
        SELECT 1
        FROM "document_links" project_link
        WHERE project_link."document_id" = NEW."document_id"
          AND project_link."entity_type" = 'PROJECT'
          AND project_link."entity_id" = report_project_id
      )
      INTO has_project_link;

      IF NOT has_project_link THEN
        RAISE EXCEPTION 'Daily Site Report document must already be linked to the same Project';
      END IF;
    END IF;
  END IF;

  IF TG_OP = 'UPDATE' AND OLD."entity_type" = 'DAILY_SITE_REPORT' THEN
    SELECT "status"
      INTO report_status
    FROM "daily_site_reports"
    WHERE "id" = OLD."entity_id";

    IF report_status <> 'DRAFT' THEN
      RAISE EXCEPTION 'Submitted Daily Site Report document links are immutable';
    END IF;
  END IF;

  RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER daily_site_report_document_links_guard
BEFORE INSERT OR UPDATE OR DELETE ON "document_links"
FOR EACH ROW EXECUTE FUNCTION protect_daily_site_report_document_links();
