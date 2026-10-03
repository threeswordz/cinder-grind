-- V0.7-C Forecast / ETC / Variance foundation.
-- Forward-only migration. Establishes canonical Forecast persistence,
-- concurrency-safe version numbering and DB-authoritative approval evidence.

CREATE SEQUENCE IF NOT EXISTS "cost_forecast_approval_action_order_seq";

ALTER TABLE "approval_actions"
  ADD COLUMN IF NOT EXISTS "forecast_decision_order" BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS "approval_actions_forecast_decision_order_key"
  ON "approval_actions"("forecast_decision_order");

CREATE TABLE "cost_forecasts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "forecast_date" DATE NOT NULL,
  "version_no" INTEGER NOT NULL DEFAULT 0,
  "description" TEXT,
  "currency_code" VARCHAR(3) NOT NULL,
  "state" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  "approval_instance_id" UUID,
  "create_key" VARCHAR(120) NOT NULL,
  "create_payload_hash" VARCHAR(64) NOT NULL,
  "created_by_user_id" UUID NOT NULL,
  "submitted_by_user_id" UUID,
  "approved_by_user_id" UUID,
  "rejected_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_at" TIMESTAMPTZ(6),
  "decided_at" TIMESTAMPTZ(6),
  "approved_at" TIMESTAMPTZ(6),
  "rejected_at" TIMESTAMPTZ(6),
  "rejection_reason" TEXT,
  CONSTRAINT "cost_forecasts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cost_forecasts_version_positive" CHECK ("version_no" > 0),
  CONSTRAINT "cost_forecasts_state_check" CHECK ("state" IN ('DRAFT','SUBMITTED','APPROVED','REJECTED')),
  CONSTRAINT "cost_forecasts_company_fkey" FOREIGN KEY ("company_id")
    REFERENCES "companies"("id") ON DELETE RESTRICT,
  CONSTRAINT "cost_forecasts_project_fkey" FOREIGN KEY ("company_id","project_id")
    REFERENCES "projects"("company_id","id") ON DELETE RESTRICT,
  CONSTRAINT "cost_forecasts_approval_instance_fkey" FOREIGN KEY ("approval_instance_id")
    REFERENCES "approval_instances"("id") ON DELETE RESTRICT,
  CONSTRAINT "cost_forecasts_creator_fkey" FOREIGN KEY ("company_id","created_by_user_id")
    REFERENCES "users"("company_id","id") ON DELETE RESTRICT,
  CONSTRAINT "cost_forecasts_submitter_fkey" FOREIGN KEY ("company_id","submitted_by_user_id")
    REFERENCES "users"("company_id","id") ON DELETE RESTRICT,
  CONSTRAINT "cost_forecasts_approver_fkey" FOREIGN KEY ("company_id","approved_by_user_id")
    REFERENCES "users"("company_id","id") ON DELETE RESTRICT,
  CONSTRAINT "cost_forecasts_rejector_fkey" FOREIGN KEY ("company_id","rejected_by_user_id")
    REFERENCES "users"("company_id","id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "cost_forecasts_approval_instance_id_key"
  ON "cost_forecasts"("approval_instance_id");
CREATE UNIQUE INDEX "cost_forecasts_project_version_key"
  ON "cost_forecasts"("company_id","project_id","version_no");
CREATE UNIQUE INDEX "cost_forecasts_creator_create_key_key"
  ON "cost_forecasts"("company_id","created_by_user_id","create_key");
CREATE UNIQUE INDEX "cost_forecasts_scope_key"
  ON "cost_forecasts"("company_id","project_id","id");
CREATE INDEX "cost_forecasts_company_project_state_version_idx"
  ON "cost_forecasts"("company_id","project_id","state","version_no");
CREATE INDEX "cost_forecasts_company_project_forecast_date_idx"
  ON "cost_forecasts"("company_id","project_id","forecast_date");

CREATE TABLE "cost_forecast_lines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "forecast_id" UUID NOT NULL,
  "line_no" INTEGER NOT NULL,
  "wbs_id" UUID,
  "cost_code_id" UUID,
  "uncommitted_etc_amount" DECIMAL(18,2) NOT NULL,
  "remarks" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cost_forecast_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cost_forecast_lines_line_positive" CHECK ("line_no" > 0),
  CONSTRAINT "cost_forecast_lines_etc_nonnegative" CHECK ("uncommitted_etc_amount" >= 0),
  CONSTRAINT "cost_forecast_lines_forecast_fkey" FOREIGN KEY ("company_id","project_id","forecast_id")
    REFERENCES "cost_forecasts"("company_id","project_id","id") ON DELETE RESTRICT,
  CONSTRAINT "cost_forecast_lines_wbs_fkey" FOREIGN KEY ("project_id","wbs_id")
    REFERENCES "wbs_elements"("project_id","id") ON DELETE RESTRICT,
  CONSTRAINT "cost_forecast_lines_cost_code_fkey" FOREIGN KEY ("company_id","cost_code_id")
    REFERENCES "cost_codes"("company_id","id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "cost_forecast_lines_forecast_line_key"
  ON "cost_forecast_lines"("forecast_id","line_no");
CREATE INDEX "cost_forecast_lines_company_project_wbs_idx"
  ON "cost_forecast_lines"("company_id","project_id","wbs_id");
CREATE INDEX "cost_forecast_lines_company_cost_code_idx"
  ON "cost_forecast_lines"("company_id","cost_code_id");

CREATE OR REPLACE FUNCTION erp_cost_forecast_actor_authorized(
  p_company_id UUID,
  p_project_id UUID,
  p_approval_step_id UUID,
  p_maker_user_id UUID,
  p_actor_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  actor_employee_id UUID;
BEGIN
  IF p_actor_user_id IS NULL OR p_actor_user_id = p_maker_user_id THEN
    RETURN FALSE;
  END IF;

  SELECT u."employee_id"
    INTO actor_employee_id
  FROM "users" u
  WHERE u."id" = p_actor_user_id
    AND u."company_id" = p_company_id
    AND u."is_active" = TRUE;

  IF NOT FOUND THEN RETURN FALSE; END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "user_roles" ur
    JOIN "roles" r ON r."id" = ur."role_id"
      AND r."company_id" = p_company_id AND r."is_active" = TRUE
    JOIN "role_permissions" rp ON rp."role_id" = r."id"
    JOIN "permissions" p ON p."id" = rp."permission_id"
    WHERE ur."company_id" = p_company_id
      AND ur."user_id" = p_actor_user_id
      AND p."permission_code" = 'cost.forecast.approve'
  ) THEN RETURN FALSE; END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "user_roles" ur
    JOIN "roles" r ON r."id" = ur."role_id"
      AND r."company_id" = p_company_id AND r."is_active" = TRUE
    JOIN "approval_step_roles" asr
      ON asr."role_id" = r."id"
     AND asr."approval_step_id" = p_approval_step_id
    WHERE ur."company_id" = p_company_id
      AND ur."user_id" = p_actor_user_id
  ) THEN RETURN FALSE; END IF;

  IF EXISTS (
    SELECT 1
    FROM "user_roles" ur
    JOIN "roles" r ON r."id" = ur."role_id"
      AND r."company_id" = p_company_id AND r."is_active" = TRUE
    JOIN "role_permissions" rp ON rp."role_id" = r."id"
    JOIN "permissions" p ON p."id" = rp."permission_id"
    WHERE ur."company_id" = p_company_id
      AND ur."user_id" = p_actor_user_id
      AND p."permission_code" = 'projects.access_all'
  ) THEN RETURN TRUE; END IF;

  IF actor_employee_id IS NULL THEN RETURN FALSE; END IF;

  RETURN EXISTS (
    SELECT 1
    FROM "employees" e
    JOIN "project_members" pm
      ON pm."employee_id" = e."id"
     AND pm."project_id" = p_project_id
     AND pm."is_active" = TRUE
    WHERE e."id" = actor_employee_id
      AND e."company_id" = p_company_id
      AND e."is_active" = TRUE
  );
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION erp_cost_forecast_manage_authorized(
  p_company_id UUID,
  p_project_id UUID,
  p_actor_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  actor_employee_id UUID;
BEGIN
  SELECT u."employee_id"
    INTO actor_employee_id
  FROM "users" u
  WHERE u."id" = p_actor_user_id
    AND u."company_id" = p_company_id
    AND u."is_active" = TRUE;
  IF NOT FOUND THEN RETURN FALSE; END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "user_roles" ur
    JOIN "roles" r ON r."id" = ur."role_id"
      AND r."company_id" = p_company_id AND r."is_active" = TRUE
    JOIN "role_permissions" rp ON rp."role_id" = r."id"
    JOIN "permissions" p ON p."id" = rp."permission_id"
    WHERE ur."company_id" = p_company_id
      AND ur."user_id" = p_actor_user_id
      AND p."permission_code" = 'cost.forecast.manage'
  ) THEN RETURN FALSE; END IF;

  IF EXISTS (
    SELECT 1
    FROM "user_roles" ur
    JOIN "roles" r ON r."id" = ur."role_id"
      AND r."company_id" = p_company_id AND r."is_active" = TRUE
    JOIN "role_permissions" rp ON rp."role_id" = r."id"
    JOIN "permissions" p ON p."id" = rp."permission_id"
    WHERE ur."company_id" = p_company_id
      AND ur."user_id" = p_actor_user_id
      AND p."permission_code" = 'projects.access_all'
  ) THEN RETURN TRUE; END IF;

  IF actor_employee_id IS NULL THEN RETURN FALSE; END IF;
  RETURN EXISTS (
    SELECT 1
    FROM "employees" e
    JOIN "project_members" pm
      ON pm."employee_id" = e."id"
     AND pm."project_id" = p_project_id
     AND pm."is_active" = TRUE
    WHERE e."id" = actor_employee_id
      AND e."company_id" = p_company_id
      AND e."is_active" = TRUE
  );
END;
$$ LANGUAGE plpgsql STABLE;

CREATE OR REPLACE FUNCTION erp_cost_forecast_insert_guard()
RETURNS trigger AS $$
DECLARE
  company_base_currency TEXT;
  next_version INTEGER;
  project_active BOOLEAN;
BEGIN
  SELECT p."is_active", c."base_currency_code"
    INTO project_active, company_base_currency
  FROM "projects" p
  JOIN "companies" c ON c."id" = p."company_id"
  WHERE p."id" = NEW."project_id"
    AND p."company_id" = NEW."company_id"
  FOR UPDATE OF p;

  IF project_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'COST_FORECAST_PROJECT_INVALID';
  END IF;
  IF company_base_currency IS NULL
     OR NEW."currency_code" IS DISTINCT FROM company_base_currency THEN
    RAISE EXCEPTION 'COST_FORECAST_BASE_CURRENCY_INVALID';
  END IF;
  IF NEW."state" IS DISTINCT FROM 'DRAFT'
     OR NEW."approval_instance_id" IS NOT NULL
     OR NEW."submitted_by_user_id" IS NOT NULL
     OR NEW."approved_by_user_id" IS NOT NULL
     OR NEW."rejected_by_user_id" IS NOT NULL
     OR NEW."submitted_at" IS NOT NULL
     OR NEW."decided_at" IS NOT NULL
     OR NEW."approved_at" IS NOT NULL
     OR NEW."rejected_at" IS NOT NULL
     OR NEW."rejection_reason" IS NOT NULL THEN
    RAISE EXCEPTION 'COST_FORECAST_INITIAL_STATE_INVALID';
  END IF;
  IF NOT erp_cost_forecast_manage_authorized(
    NEW."company_id", NEW."project_id", NEW."created_by_user_id"
  ) THEN
    RAISE EXCEPTION 'COST_FORECAST_MANAGE_UNAUTHORIZED';
  END IF;

  SELECT COALESCE(MAX(cf."version_no"), 0) + 1
    INTO next_version
  FROM "cost_forecasts" cf
  WHERE cf."company_id" = NEW."company_id"
    AND cf."project_id" = NEW."project_id";

  NEW."version_no" := next_version;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "cost_forecast_insert_guard"
BEFORE INSERT ON "cost_forecasts"
FOR EACH ROW EXECUTE FUNCTION erp_cost_forecast_insert_guard();

CREATE OR REPLACE FUNCTION erp_cost_forecast_line_guard()
RETURNS trigger AS $$
DECLARE
  parent_state TEXT;
  parent_company UUID;
  parent_project UUID;
BEGIN
  SELECT cf."state", cf."company_id", cf."project_id"
    INTO parent_state, parent_company, parent_project
  FROM "cost_forecasts" cf
  WHERE cf."id" = COALESCE(NEW."forecast_id", OLD."forecast_id")
  FOR UPDATE;

  IF parent_state IS NULL THEN RAISE EXCEPTION 'COST_FORECAST_LINE_PARENT_INVALID'; END IF;
  IF parent_state <> 'DRAFT' THEN RAISE EXCEPTION 'COST_FORECAST_LINES_IMMUTABLE'; END IF;

  IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;

  IF NEW."company_id" IS DISTINCT FROM parent_company
     OR NEW."project_id" IS DISTINCT FROM parent_project THEN
    RAISE EXCEPTION 'COST_FORECAST_LINE_SCOPE_INVALID';
  END IF;
  IF NEW."uncommitted_etc_amount" < 0 THEN
    RAISE EXCEPTION 'COST_FORECAST_ETC_NEGATIVE';
  END IF;
  IF NEW."wbs_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "wbs_elements" w
    WHERE w."id" = NEW."wbs_id"
      AND w."project_id" = parent_project
      AND w."is_active" = TRUE
  ) THEN RAISE EXCEPTION 'COST_FORECAST_WBS_INVALID'; END IF;
  IF NEW."cost_code_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "cost_codes" cc
    WHERE cc."id" = NEW."cost_code_id"
      AND cc."company_id" = parent_company
      AND cc."is_active" = TRUE
  ) THEN RAISE EXCEPTION 'COST_FORECAST_COST_CODE_INVALID'; END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "cost_forecast_line_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "cost_forecast_lines"
FOR EACH ROW EXECUTE FUNCTION erp_cost_forecast_line_guard();

CREATE OR REPLACE FUNCTION erp_cost_forecast_approval_action_guard()
RETURNS trigger AS $$
DECLARE
  bound_entity_type TEXT;
  bound_state TEXT;
  bound_company UUID;
  bound_entity UUID;
  bound_workflow UUID;
  bound_step_no INTEGER;
  bound_step_id UUID;
  forecast_project UUID;
  maker_user UUID;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    SELECT ai."entity_type" INTO bound_entity_type
    FROM "approval_instances" ai
    WHERE ai."id" = OLD."approval_instance_id";
    IF bound_entity_type = 'COST_FORECAST' THEN
      RAISE EXCEPTION 'COST_FORECAST_APPROVAL_ACTION_IMMUTABLE';
    END IF;
    IF TG_OP = 'DELETE' THEN RETURN OLD; END IF;
    RETURN NEW;
  END IF;

  SELECT ai."entity_type", ai."approval_state", ai."company_id",
         ai."entity_id", ai."approval_workflow_id", ai."current_step_no"
    INTO bound_entity_type, bound_state, bound_company,
         bound_entity, bound_workflow, bound_step_no
  FROM "approval_instances" ai
  WHERE ai."id" = NEW."approval_instance_id"
  FOR UPDATE;

  IF bound_entity_type IS DISTINCT FROM 'COST_FORECAST' THEN RETURN NEW; END IF;
  IF bound_state <> 'SUBMITTED' THEN RAISE EXCEPTION 'COST_FORECAST_APPROVAL_ACTION_STATE_INVALID'; END IF;

  SELECT s."id" INTO bound_step_id
  FROM "approval_steps" s
  WHERE s."approval_workflow_id" = bound_workflow
    AND s."step_no" = bound_step_no;

  IF bound_step_id IS NULL OR NEW."approval_step_id" <> bound_step_id THEN
    RAISE EXCEPTION 'COST_FORECAST_APPROVAL_CURRENT_STEP_REQUIRED';
  END IF;
  IF NEW."action" NOT IN ('APPROVE','REJECT') THEN
    RAISE EXCEPTION 'COST_FORECAST_APPROVAL_ACTION_INVALID';
  END IF;

  SELECT cf."project_id", cf."created_by_user_id"
    INTO forecast_project, maker_user
  FROM "cost_forecasts" cf
  WHERE cf."id" = bound_entity
    AND cf."company_id" = bound_company
    AND cf."approval_instance_id" = NEW."approval_instance_id"
    AND cf."state" = 'SUBMITTED';

  IF forecast_project IS NULL OR maker_user IS NULL THEN
    RAISE EXCEPTION 'COST_FORECAST_APPROVAL_BINDING_INVALID';
  END IF;

  IF NOT erp_cost_forecast_actor_authorized(
    bound_company, forecast_project, bound_step_id, maker_user, NEW."action_by_user_id"
  ) THEN
    RAISE EXCEPTION 'COST_FORECAST_APPROVAL_ACTION_UNAUTHORIZED';
  END IF;

  NEW."action_at" := date_trunc('milliseconds', clock_timestamp());
  NEW."forecast_decision_order" := nextval('"cost_forecast_approval_action_order_seq"');
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "cost_forecast_approval_action_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "approval_actions"
FOR EACH ROW EXECUTE FUNCTION erp_cost_forecast_approval_action_guard();

CREATE OR REPLACE FUNCTION erp_cost_forecast_approval_instance_guard()
RETURNS trigger AS $$
DECLARE
  forecast_project UUID;
  maker_user UUID;
  current_step_id UUID;
  current_required INTEGER;
  next_step_no INTEGER;
  valid_approvals INTEGER;
  valid_rejections INTEGER;
BEGIN
  IF OLD."entity_type" IS DISTINCT FROM 'COST_FORECAST'
     AND NEW."entity_type" IS DISTINCT FROM 'COST_FORECAST' THEN
    RETURN NEW;
  END IF;

  IF OLD."approval_state" IN ('APPROVED','REJECTED') THEN
    RAISE EXCEPTION 'COST_FORECAST_APPROVAL_HISTORY_IMMUTABLE';
  END IF;

  IF NEW."company_id" IS DISTINCT FROM OLD."company_id"
     OR NEW."approval_workflow_id" IS DISTINCT FROM OLD."approval_workflow_id"
     OR NEW."entity_type" IS DISTINCT FROM OLD."entity_type"
     OR NEW."entity_id" IS DISTINCT FROM OLD."entity_id"
     OR NEW."started_at" IS DISTINCT FROM OLD."started_at" THEN
    RAISE EXCEPTION 'COST_FORECAST_APPROVAL_IDENTITY_IMMUTABLE';
  END IF;

  SELECT cf."project_id", cf."created_by_user_id"
    INTO forecast_project, maker_user
  FROM "cost_forecasts" cf
  WHERE cf."id" = OLD."entity_id"
    AND cf."company_id" = OLD."company_id"
    AND cf."approval_instance_id" = OLD."id"
    AND cf."state" = 'SUBMITTED';

  IF forecast_project IS NULL OR maker_user IS NULL THEN
    RAISE EXCEPTION 'COST_FORECAST_APPROVAL_BINDING_INVALID';
  END IF;

  SELECT s."id", s."required_approvals"
    INTO current_step_id, current_required
  FROM "approval_steps" s
  WHERE s."approval_workflow_id" = OLD."approval_workflow_id"
    AND s."step_no" = OLD."current_step_no";

  IF current_step_id IS NULL THEN RAISE EXCEPTION 'COST_FORECAST_APPROVAL_STEP_INVALID'; END IF;

  SELECT COUNT(DISTINCT aa."action_by_user_id")
    INTO valid_approvals
  FROM "approval_actions" aa
  WHERE aa."approval_instance_id" = OLD."id"
    AND aa."approval_step_id" = current_step_id
    AND aa."action" = 'APPROVE'
    AND aa."forecast_decision_order" IS NOT NULL
    AND erp_cost_forecast_actor_authorized(
      OLD."company_id", forecast_project, current_step_id, maker_user, aa."action_by_user_id"
    );

  SELECT COUNT(DISTINCT aa."action_by_user_id")
    INTO valid_rejections
  FROM "approval_actions" aa
  WHERE aa."approval_instance_id" = OLD."id"
    AND aa."approval_step_id" = current_step_id
    AND aa."action" = 'REJECT'
    AND aa."forecast_decision_order" IS NOT NULL
    AND erp_cost_forecast_actor_authorized(
      OLD."company_id", forecast_project, current_step_id, maker_user, aa."action_by_user_id"
    );

  IF NEW."approval_state" = 'SUBMITTED' THEN
    IF NEW."completed_at" IS NOT NULL THEN
      RAISE EXCEPTION 'COST_FORECAST_APPROVAL_STATE_INVALID';
    END IF;
    IF NEW."current_step_no" = OLD."current_step_no" THEN RETURN NEW; END IF;

    SELECT MIN(s."step_no") INTO next_step_no
    FROM "approval_steps" s
    WHERE s."approval_workflow_id" = OLD."approval_workflow_id"
      AND s."step_no" > OLD."current_step_no";

    IF next_step_no IS NULL
       OR NEW."current_step_no" IS DISTINCT FROM next_step_no
       OR valid_approvals < current_required
       OR valid_rejections > 0 THEN
      RAISE EXCEPTION 'COST_FORECAST_APPROVAL_EVIDENCE_INVALID';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."approval_state" = 'APPROVED' THEN
    SELECT MIN(s."step_no") INTO next_step_no
    FROM "approval_steps" s
    WHERE s."approval_workflow_id" = OLD."approval_workflow_id"
      AND s."step_no" > OLD."current_step_no";
    IF NEW."current_step_no" IS DISTINCT FROM OLD."current_step_no"
       OR NEW."completed_at" IS NULL
       OR next_step_no IS NOT NULL
       OR valid_approvals < current_required
       OR valid_rejections > 0 THEN
      RAISE EXCEPTION 'COST_FORECAST_APPROVAL_EVIDENCE_INVALID';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."approval_state" = 'REJECTED' THEN
    IF NEW."current_step_no" IS DISTINCT FROM OLD."current_step_no"
       OR NEW."completed_at" IS NULL
       OR valid_rejections < 1 THEN
      RAISE EXCEPTION 'COST_FORECAST_APPROVAL_EVIDENCE_INVALID';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'COST_FORECAST_APPROVAL_STATE_INVALID';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "cost_forecast_approval_instance_guard"
BEFORE UPDATE ON "approval_instances"
FOR EACH ROW EXECUTE FUNCTION erp_cost_forecast_approval_instance_guard();

CREATE OR REPLACE FUNCTION erp_cost_forecast_header_guard()
RETURNS trigger AS $$
DECLARE
  base_currency TEXT;
  project_active BOOLEAN;
  instance_company UUID;
  instance_entity TEXT;
  instance_entity_id UUID;
  instance_state TEXT;
  retained_actor UUID;
  retained_at TIMESTAMPTZ;
  retained_comment TEXT;
BEGIN
  IF OLD."company_id" IS DISTINCT FROM NEW."company_id"
     OR OLD."project_id" IS DISTINCT FROM NEW."project_id"
     OR OLD."version_no" IS DISTINCT FROM NEW."version_no"
     OR OLD."currency_code" IS DISTINCT FROM NEW."currency_code"
     OR OLD."create_key" IS DISTINCT FROM NEW."create_key"
     OR OLD."create_payload_hash" IS DISTINCT FROM NEW."create_payload_hash"
     OR OLD."created_by_user_id" IS DISTINCT FROM NEW."created_by_user_id"
     OR OLD."created_at" IS DISTINCT FROM NEW."created_at" THEN
    RAISE EXCEPTION 'COST_FORECAST_IDENTITY_IMMUTABLE';
  END IF;

  IF OLD."state" IN ('APPROVED','REJECTED') THEN
    IF NEW IS DISTINCT FROM OLD THEN
      RAISE EXCEPTION 'COST_FORECAST_HISTORY_IMMUTABLE';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."state" = 'DRAFT' AND NEW."state" = 'DRAFT' THEN
    IF NEW."approval_instance_id" IS NOT NULL
       OR NEW."submitted_by_user_id" IS NOT NULL
       OR NEW."approved_by_user_id" IS NOT NULL
       OR NEW."rejected_by_user_id" IS NOT NULL
       OR NEW."submitted_at" IS NOT NULL
       OR NEW."decided_at" IS NOT NULL
       OR NEW."approved_at" IS NOT NULL
       OR NEW."rejected_at" IS NOT NULL
       OR NEW."rejection_reason" IS NOT NULL THEN
      RAISE EXCEPTION 'COST_FORECAST_DRAFT_EVIDENCE_INVALID';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."state" <> 'DRAFT'
     AND (NEW."forecast_date" IS DISTINCT FROM OLD."forecast_date"
       OR NEW."description" IS DISTINCT FROM OLD."description"
       OR NEW."approval_instance_id" IS DISTINCT FROM OLD."approval_instance_id"
       OR NEW."submitted_by_user_id" IS DISTINCT FROM OLD."submitted_by_user_id"
       OR NEW."submitted_at" IS DISTINCT FROM OLD."submitted_at") THEN
    RAISE EXCEPTION 'COST_FORECAST_SUBMITTED_HISTORY_IMMUTABLE';
  END IF;

  IF OLD."state" = 'DRAFT' AND NEW."state" = 'SUBMITTED' THEN
    IF NEW."approval_instance_id" IS NULL
       OR NEW."submitted_by_user_id" IS NULL
       OR NEW."submitted_at" IS NULL
       OR NOT erp_cost_forecast_manage_authorized(
         NEW."company_id", NEW."project_id", NEW."submitted_by_user_id"
       ) THEN
      RAISE EXCEPTION 'COST_FORECAST_SUBMISSION_EVIDENCE_INVALID';
    END IF;

    SELECT p."is_active", c."base_currency_code"
      INTO project_active, base_currency
    FROM "projects" p JOIN "companies" c ON c."id" = p."company_id"
    WHERE p."id" = NEW."project_id" AND p."company_id" = NEW."company_id";
    IF project_active IS DISTINCT FROM TRUE
       OR base_currency IS DISTINCT FROM NEW."currency_code" THEN
      RAISE EXCEPTION 'COST_FORECAST_SUBMISSION_SCOPE_INVALID';
    END IF;

    IF EXISTS (
      SELECT 1 FROM "cost_forecast_lines" l
      LEFT JOIN "wbs_elements" w
        ON w."id" = l."wbs_id" AND w."project_id" = NEW."project_id"
      LEFT JOIN "cost_codes" cc
        ON cc."id" = l."cost_code_id" AND cc."company_id" = NEW."company_id"
      WHERE l."forecast_id" = NEW."id"
        AND ((l."wbs_id" IS NOT NULL AND (w."id" IS NULL OR w."is_active" = FALSE))
          OR (l."cost_code_id" IS NOT NULL AND (cc."id" IS NULL OR cc."is_active" = FALSE)))
    ) THEN RAISE EXCEPTION 'COST_FORECAST_DIMENSION_INVALID'; END IF;

    SELECT ai."company_id", ai."entity_type", ai."entity_id", ai."approval_state"
      INTO instance_company, instance_entity, instance_entity_id, instance_state
    FROM "approval_instances" ai
    WHERE ai."id" = NEW."approval_instance_id";
    IF instance_company IS DISTINCT FROM NEW."company_id"
       OR instance_entity IS DISTINCT FROM 'COST_FORECAST'
       OR instance_entity_id IS DISTINCT FROM NEW."id"
       OR instance_state IS DISTINCT FROM 'SUBMITTED' THEN
      RAISE EXCEPTION 'COST_FORECAST_APPROVAL_LINK_INVALID';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."state" = 'SUBMITTED' AND NEW."state" IN ('APPROVED','REJECTED') THEN
    SELECT ai."company_id", ai."entity_type", ai."entity_id", ai."approval_state"
      INTO instance_company, instance_entity, instance_entity_id, instance_state
    FROM "approval_instances" ai
    WHERE ai."id" = NEW."approval_instance_id";

    IF instance_company IS DISTINCT FROM NEW."company_id"
       OR instance_entity IS DISTINCT FROM 'COST_FORECAST'
       OR instance_entity_id IS DISTINCT FROM NEW."id"
       OR instance_state IS DISTINCT FROM NEW."state" THEN
      RAISE EXCEPTION 'COST_FORECAST_APPROVAL_STATE_MISMATCH';
    END IF;

    SELECT aa."action_by_user_id", aa."action_at", aa."comment"
      INTO retained_actor, retained_at, retained_comment
    FROM "approval_actions" aa
    WHERE aa."approval_instance_id" = NEW."approval_instance_id"
      AND aa."action" = CASE NEW."state" WHEN 'APPROVED' THEN 'APPROVE' ELSE 'REJECT' END
      AND aa."forecast_decision_order" IS NOT NULL
    ORDER BY aa."forecast_decision_order" DESC
    LIMIT 1;

    IF retained_actor IS NULL OR retained_at IS NULL THEN
      RAISE EXCEPTION 'COST_FORECAST_DECISION_EVIDENCE_MISSING';
    END IF;

    IF NEW."state" = 'APPROVED' THEN
      IF NEW."approved_by_user_id" IS DISTINCT FROM retained_actor
         OR NEW."approved_at" IS DISTINCT FROM retained_at
         OR NEW."decided_at" IS DISTINCT FROM retained_at
         OR NEW."rejected_by_user_id" IS NOT NULL
         OR NEW."rejected_at" IS NOT NULL
         OR NEW."rejection_reason" IS NOT NULL THEN
        RAISE EXCEPTION 'COST_FORECAST_APPROVAL_METADATA_MISMATCH';
      END IF;
    ELSE
      IF NEW."rejected_by_user_id" IS DISTINCT FROM retained_actor
         OR NEW."rejected_at" IS DISTINCT FROM retained_at
         OR NEW."decided_at" IS DISTINCT FROM retained_at
         OR NEW."rejection_reason" IS DISTINCT FROM retained_comment
         OR NEW."approved_by_user_id" IS NOT NULL
         OR NEW."approved_at" IS NOT NULL THEN
        RAISE EXCEPTION 'COST_FORECAST_REJECTION_METADATA_MISMATCH';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'COST_FORECAST_STATE_TRANSITION_INVALID';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "cost_forecast_header_guard"
BEFORE UPDATE ON "cost_forecasts"
FOR EACH ROW EXECUTE FUNCTION erp_cost_forecast_header_guard();

CREATE OR REPLACE FUNCTION erp_cost_forecast_delete_guard()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'COST_FORECAST_DELETE_FORBIDDEN';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "cost_forecast_delete_guard"
BEFORE DELETE ON "cost_forecasts"
FOR EACH ROW EXECUTE FUNCTION erp_cost_forecast_delete_guard();
