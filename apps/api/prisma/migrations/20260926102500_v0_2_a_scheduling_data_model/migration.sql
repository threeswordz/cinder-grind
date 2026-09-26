CREATE TABLE "activity_types" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "activity_type_code" VARCHAR(80) NOT NULL,
  "activity_type_name" VARCHAR(150) NOT NULL,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activity_types_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "activity_types_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "activity_types_company_id_activity_type_code_key"
  ON "activity_types"("company_id", "activity_type_code");
CREATE INDEX "activity_types_company_id_is_active_idx"
  ON "activity_types"("company_id", "is_active");

CREATE TABLE "working_calendars" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "project_id" UUID,
  "calendar_name" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "timezone_name" VARCHAR(100) NOT NULL,
  "is_default" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "working_calendars_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "working_calendars_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "working_calendars_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "working_calendars_company_id_is_active_idx"
  ON "working_calendars"("company_id", "is_active");
CREATE INDEX "working_calendars_project_id_is_active_idx"
  ON "working_calendars"("project_id", "is_active");

CREATE TABLE "working_calendar_weekdays" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "working_calendar_id" UUID NOT NULL,
  "weekday_no" INTEGER NOT NULL,
  "is_working" BOOLEAN NOT NULL,
  "start_time" TIME(0),
  "end_time" TIME(0),
  CONSTRAINT "working_calendar_weekdays_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "working_calendar_weekdays_working_calendar_id_fkey" FOREIGN KEY ("working_calendar_id") REFERENCES "working_calendars"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "working_calendar_weekday_no_check" CHECK ("weekday_no" BETWEEN 1 AND 7),
  CONSTRAINT "working_calendar_weekday_time_pair_check" CHECK (
    ("start_time" IS NULL AND "end_time" IS NULL)
    OR ("start_time" IS NOT NULL AND "end_time" IS NOT NULL AND "start_time" < "end_time")
  )
);

CREATE UNIQUE INDEX "working_calendar_weekdays_working_calendar_id_weekday_no_key"
  ON "working_calendar_weekdays"("working_calendar_id", "weekday_no");

CREATE TABLE "working_calendar_exceptions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "working_calendar_id" UUID NOT NULL,
  "exception_date" DATE NOT NULL,
  "is_working_override" BOOLEAN NOT NULL,
  "start_time" TIME(0),
  "end_time" TIME(0),
  "reason" VARCHAR(500),
  CONSTRAINT "working_calendar_exceptions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "working_calendar_exceptions_working_calendar_id_fkey" FOREIGN KEY ("working_calendar_id") REFERENCES "working_calendars"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "working_calendar_exception_time_pair_check" CHECK (
    ("start_time" IS NULL AND "end_time" IS NULL)
    OR ("start_time" IS NOT NULL AND "end_time" IS NOT NULL AND "start_time" < "end_time")
  )
);

CREATE UNIQUE INDEX "working_calendar_exceptions_working_calendar_id_exception_date_key"
  ON "working_calendar_exceptions"("working_calendar_id", "exception_date");

CREATE TABLE "activities" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "wbs_id" UUID NOT NULL,
  "parent_activity_id" UUID,
  "activity_type_id" UUID,
  "working_calendar_id" UUID NOT NULL,
  "status_definition_id" UUID,
  "activity_code" VARCHAR(80) NOT NULL,
  "activity_name" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "is_summary" BOOLEAN NOT NULL DEFAULT false,
  "is_milestone" BOOLEAN NOT NULL DEFAULT false,
  "planned_duration_work_days" DECIMAL(8,2) NOT NULL,
  "planned_start_date" DATE NOT NULL,
  "planned_finish_date" DATE NOT NULL,
  "actual_start_date" DATE,
  "actual_finish_date" DATE,
  "forecast_start_date" DATE,
  "forecast_finish_date" DATE,
  "responsible_employee_id" UUID,
  "owner_user_id" UUID,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activities_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "activities_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activities_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activities_wbs_id_fkey" FOREIGN KEY ("wbs_id") REFERENCES "wbs_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activities_parent_activity_id_fkey" FOREIGN KEY ("parent_activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activities_activity_type_id_fkey" FOREIGN KEY ("activity_type_id") REFERENCES "activity_types"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activities_working_calendar_id_fkey" FOREIGN KEY ("working_calendar_id") REFERENCES "working_calendars"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activities_status_definition_id_fkey" FOREIGN KEY ("status_definition_id") REFERENCES "status_definitions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activities_responsible_employee_id_fkey" FOREIGN KEY ("responsible_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activities_owner_user_id_fkey" FOREIGN KEY ("owner_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activities_duration_nonnegative_check" CHECK ("planned_duration_work_days" >= 0),
  CONSTRAINT "activities_planned_dates_check" CHECK ("planned_start_date" <= "planned_finish_date"),
  CONSTRAINT "activities_actual_dates_check" CHECK ("actual_start_date" IS NULL OR "actual_finish_date" IS NULL OR "actual_start_date" <= "actual_finish_date"),
  CONSTRAINT "activities_forecast_dates_check" CHECK ("forecast_start_date" IS NULL OR "forecast_finish_date" IS NULL OR "forecast_start_date" <= "forecast_finish_date"),
  CONSTRAINT "activities_not_own_parent_check" CHECK ("parent_activity_id" IS NULL OR "parent_activity_id" <> "id")
);

CREATE UNIQUE INDEX "activities_project_id_activity_code_key"
  ON "activities"("project_id", "activity_code");
CREATE INDEX "activities_company_id_project_id_is_active_idx"
  ON "activities"("company_id", "project_id", "is_active");
CREATE INDEX "activities_project_id_wbs_id_idx"
  ON "activities"("project_id", "wbs_id");
CREATE INDEX "activities_project_id_parent_activity_id_idx"
  ON "activities"("project_id", "parent_activity_id");
CREATE INDEX "activities_working_calendar_id_idx"
  ON "activities"("working_calendar_id");
CREATE INDEX "activities_planned_start_date_planned_finish_date_idx"
  ON "activities"("planned_start_date", "planned_finish_date");

CREATE TABLE "activity_dependencies" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "project_id" UUID NOT NULL,
  "predecessor_activity_id" UUID NOT NULL,
  "successor_activity_id" UUID NOT NULL,
  "dependency_type" VARCHAR(2) NOT NULL,
  "lag_work_days" DECIMAL(8,2) NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "activity_dependencies_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "activity_dependencies_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activity_dependencies_predecessor_activity_id_fkey" FOREIGN KEY ("predecessor_activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activity_dependencies_successor_activity_id_fkey" FOREIGN KEY ("successor_activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "activity_dependencies_type_check" CHECK ("dependency_type" IN ('FS', 'SS', 'FF', 'SF')),
  CONSTRAINT "activity_dependencies_self_check" CHECK ("predecessor_activity_id" <> "successor_activity_id")
);

CREATE UNIQUE INDEX "activity_dependencies_predecessor_activity_id_successor_activity_id_dependency_type_key"
  ON "activity_dependencies"("predecessor_activity_id", "successor_activity_id", "dependency_type");
CREATE INDEX "activity_dependencies_project_id_is_active_idx"
  ON "activity_dependencies"("project_id", "is_active");
CREATE INDEX "activity_dependencies_successor_activity_id_idx"
  ON "activity_dependencies"("successor_activity_id");

CREATE OR REPLACE FUNCTION enforce_working_calendar_scope()
RETURNS trigger AS $$
BEGIN
  IF NEW.project_id IS NOT NULL AND NOT EXISTS (
    SELECT 1
    FROM projects p
    WHERE p.id = NEW.project_id
      AND p.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'Working Calendar Project must belong to the same Company';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER working_calendar_scope
BEFORE INSERT OR UPDATE OF company_id, project_id ON working_calendars
FOR EACH ROW EXECUTE FUNCTION enforce_working_calendar_scope();

CREATE OR REPLACE FUNCTION enforce_activity_scope_and_hierarchy()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM projects p
    WHERE p.id = NEW.project_id AND p.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'Activity Project must belong to the same Company';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM wbs_elements w
    WHERE w.id = NEW.wbs_id AND w.project_id = NEW.project_id
  ) THEN
    RAISE EXCEPTION 'Activity WBS must belong to the same Project';
  END IF;

  IF NEW.parent_activity_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM activities p
    WHERE p.id = NEW.parent_activity_id AND p.project_id = NEW.project_id
  ) THEN
    RAISE EXCEPTION 'Parent Activity must belong to the same Project';
  END IF;

  IF NEW.activity_type_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM activity_types t
    WHERE t.id = NEW.activity_type_id AND t.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'Activity Type must belong to the same Company';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM working_calendars c
    WHERE c.id = NEW.working_calendar_id
      AND c.company_id = NEW.company_id
      AND (c.project_id IS NULL OR c.project_id = NEW.project_id)
  ) THEN
    RAISE EXCEPTION 'Working Calendar is not valid for this Activity Project';
  END IF;

  IF NEW.status_definition_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM status_definitions s
    WHERE s.id = NEW.status_definition_id AND s.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'Activity Status must belong to the same Company';
  END IF;

  IF NEW.responsible_employee_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM employees e
    WHERE e.id = NEW.responsible_employee_id AND e.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'Responsible Employee must belong to the same Company';
  END IF;

  IF NEW.owner_user_id IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM users u
    WHERE u.id = NEW.owner_user_id AND u.company_id = NEW.company_id
  ) THEN
    RAISE EXCEPTION 'Activity Owner must belong to the same Company';
  END IF;

  IF NEW.parent_activity_id IS NOT NULL AND EXISTS (
    WITH RECURSIVE ancestors AS (
      SELECT a.id, a.parent_activity_id
      FROM activities a
      WHERE a.id = NEW.parent_activity_id
      UNION ALL
      SELECT a.id, a.parent_activity_id
      FROM activities a
      JOIN ancestors x ON a.id = x.parent_activity_id
    )
    SELECT 1 FROM ancestors WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'Activity hierarchy cannot contain a cycle';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER activity_scope_and_hierarchy
BEFORE INSERT OR UPDATE OF
  company_id, project_id, wbs_id, parent_activity_id, activity_type_id,
  working_calendar_id, status_definition_id, responsible_employee_id, owner_user_id
ON activities
FOR EACH ROW EXECUTE FUNCTION enforce_activity_scope_and_hierarchy();

CREATE OR REPLACE FUNCTION enforce_activity_dependency_scope()
RETURNS trigger AS $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM activities a
    WHERE a.id = NEW.predecessor_activity_id
      AND a.project_id = NEW.project_id
  ) THEN
    RAISE EXCEPTION 'Dependency predecessor must belong to the same Project';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM activities a
    WHERE a.id = NEW.successor_activity_id
      AND a.project_id = NEW.project_id
  ) THEN
    RAISE EXCEPTION 'Dependency successor must belong to the same Project';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER activity_dependency_scope
BEFORE INSERT OR UPDATE OF project_id, predecessor_activity_id, successor_activity_id
ON activity_dependencies
FOR EACH ROW EXECUTE FUNCTION enforce_activity_dependency_scope();
