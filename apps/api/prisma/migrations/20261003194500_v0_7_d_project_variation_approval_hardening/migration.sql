-- V0.7-D Project Variation approval authorization/concurrency hardening.
-- Forward-only follow-up: do not modify earlier Stage-D migrations.

CREATE OR REPLACE FUNCTION erp_project_variation_actor_authorized(
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
      AND p."permission_code" = 'cost.variation.approve'
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

CREATE OR REPLACE FUNCTION erp_project_variation_approval_action_validation_guard()
RETURNS trigger AS $$
DECLARE
  bound_entity_type TEXT;
  bound_state TEXT;
  bound_company UUID;
  bound_entity UUID;
  bound_workflow UUID;
  bound_step_no INTEGER;
  bound_step_id UUID;
  variation_project UUID;
  maker_user UUID;
BEGIN
  SELECT ai."entity_type", ai."approval_state", ai."company_id",
         ai."entity_id", ai."approval_workflow_id", ai."current_step_no"
    INTO bound_entity_type, bound_state, bound_company,
         bound_entity, bound_workflow, bound_step_no
  FROM "approval_instances" ai
  WHERE ai."id" = NEW."approval_instance_id"
  FOR UPDATE;

  IF bound_entity_type IS DISTINCT FROM 'PROJECT_VARIATION' THEN
    RETURN NEW;
  END IF;

  IF bound_state <> 'SUBMITTED' THEN
    RAISE EXCEPTION 'PROJECT_VARIATION_APPROVAL_ACTION_STATE_INVALID';
  END IF;

  SELECT s."id" INTO bound_step_id
  FROM "approval_steps" s
  WHERE s."approval_workflow_id" = bound_workflow
    AND s."step_no" = bound_step_no;

  IF bound_step_id IS NULL
     OR NEW."approval_step_id" IS DISTINCT FROM bound_step_id THEN
    RAISE EXCEPTION 'PROJECT_VARIATION_APPROVAL_STEP_INVALID';
  END IF;

  SELECT pv."project_id", pv."created_by_user_id"
    INTO variation_project, maker_user
  FROM "project_variations" pv
  WHERE pv."id" = bound_entity
    AND pv."company_id" = bound_company
    AND pv."approval_instance_id" = NEW."approval_instance_id"
    AND pv."state" = 'SUBMITTED';

  IF variation_project IS NULL OR maker_user IS NULL THEN
    RAISE EXCEPTION 'PROJECT_VARIATION_APPROVAL_BINDING_INVALID';
  END IF;

  IF NOT erp_project_variation_actor_authorized(
    bound_company,
    variation_project,
    bound_step_id,
    maker_user,
    NEW."action_by_user_id"
  ) THEN
    RAISE EXCEPTION 'PROJECT_VARIATION_APPROVAL_ACTION_UNAUTHORIZED';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "project_variation_approval_action_validation_guard"
BEFORE INSERT ON "approval_actions"
FOR EACH ROW EXECUTE FUNCTION erp_project_variation_approval_action_validation_guard();

CREATE OR REPLACE FUNCTION erp_project_variation_approval_instance_guard()
RETURNS trigger AS $$
DECLARE
  variation_project UUID;
  maker_user UUID;
  current_step_id UUID;
  current_required INTEGER;
  next_step_no INTEGER;
  valid_approvals INTEGER;
  valid_rejections INTEGER;
BEGIN
  IF OLD."entity_type" IS DISTINCT FROM 'PROJECT_VARIATION'
     AND NEW."entity_type" IS DISTINCT FROM 'PROJECT_VARIATION' THEN
    RETURN NEW;
  END IF;

  IF OLD."approval_state" IN ('APPROVED','REJECTED') THEN
    RAISE EXCEPTION 'PROJECT_VARIATION_APPROVAL_HISTORY_IMMUTABLE';
  END IF;

  IF NEW."company_id" IS DISTINCT FROM OLD."company_id"
     OR NEW."approval_workflow_id" IS DISTINCT FROM OLD."approval_workflow_id"
     OR NEW."entity_type" IS DISTINCT FROM OLD."entity_type"
     OR NEW."entity_id" IS DISTINCT FROM OLD."entity_id"
     OR NEW."started_at" IS DISTINCT FROM OLD."started_at" THEN
    RAISE EXCEPTION 'PROJECT_VARIATION_APPROVAL_IDENTITY_IMMUTABLE';
  END IF;

  SELECT pv."project_id", pv."created_by_user_id"
    INTO variation_project, maker_user
  FROM "project_variations" pv
  WHERE pv."id" = OLD."entity_id"
    AND pv."company_id" = OLD."company_id"
    AND pv."approval_instance_id" = OLD."id"
    AND pv."state" = 'SUBMITTED';

  IF variation_project IS NULL OR maker_user IS NULL THEN
    RAISE EXCEPTION 'PROJECT_VARIATION_APPROVAL_BINDING_INVALID';
  END IF;

  SELECT s."id", s."required_approvals"
    INTO current_step_id, current_required
  FROM "approval_steps" s
  WHERE s."approval_workflow_id" = OLD."approval_workflow_id"
    AND s."step_no" = OLD."current_step_no";

  IF current_step_id IS NULL THEN
    RAISE EXCEPTION 'PROJECT_VARIATION_APPROVAL_STEP_INVALID';
  END IF;

  SELECT COUNT(DISTINCT aa."action_by_user_id")
    INTO valid_approvals
  FROM "approval_actions" aa
  WHERE aa."approval_instance_id" = OLD."id"
    AND aa."approval_step_id" = current_step_id
    AND aa."action" = 'APPROVE'
    AND aa."project_variation_decision_order" IS NOT NULL
    AND erp_project_variation_actor_authorized(
      OLD."company_id",
      variation_project,
      current_step_id,
      maker_user,
      aa."action_by_user_id"
    );

  SELECT COUNT(DISTINCT aa."action_by_user_id")
    INTO valid_rejections
  FROM "approval_actions" aa
  WHERE aa."approval_instance_id" = OLD."id"
    AND aa."approval_step_id" = current_step_id
    AND aa."action" = 'REJECT'
    AND aa."project_variation_decision_order" IS NOT NULL
    AND erp_project_variation_actor_authorized(
      OLD."company_id",
      variation_project,
      current_step_id,
      maker_user,
      aa."action_by_user_id"
    );

  IF NEW."approval_state" = 'SUBMITTED' THEN
    IF NEW."completed_at" IS NOT NULL THEN
      RAISE EXCEPTION 'PROJECT_VARIATION_APPROVAL_STATE_INVALID';
    END IF;
    IF NEW."current_step_no" = OLD."current_step_no" THEN
      RETURN NEW;
    END IF;

    SELECT MIN(s."step_no") INTO next_step_no
    FROM "approval_steps" s
    WHERE s."approval_workflow_id" = OLD."approval_workflow_id"
      AND s."step_no" > OLD."current_step_no";

    IF next_step_no IS NULL
       OR NEW."current_step_no" IS DISTINCT FROM next_step_no
       OR valid_approvals < current_required
       OR valid_rejections > 0 THEN
      RAISE EXCEPTION 'PROJECT_VARIATION_APPROVAL_EVIDENCE_INVALID';
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
      RAISE EXCEPTION 'PROJECT_VARIATION_APPROVAL_EVIDENCE_INVALID';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."approval_state" = 'REJECTED' THEN
    IF NEW."current_step_no" IS DISTINCT FROM OLD."current_step_no"
       OR NEW."completed_at" IS NULL
       OR valid_rejections < 1 THEN
      RAISE EXCEPTION 'PROJECT_VARIATION_APPROVAL_EVIDENCE_INVALID';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'PROJECT_VARIATION_APPROVAL_STATE_INVALID';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "project_variation_approval_instance_guard"
BEFORE UPDATE ON "approval_instances"
FOR EACH ROW EXECUTE FUNCTION erp_project_variation_approval_instance_guard();
