-- V0.7-B terminal approval evidence hardening.
-- Forward-only: prior executed migrations remain immutable.
-- A DIRECT_COST_POSTING approval instance may only terminalize when its
-- retained actions independently prove maker-checker, permission, configured
-- step-role and effective Project scope.

CREATE OR REPLACE FUNCTION erp_direct_cost_actor_authorized(
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

  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "user_roles" ur
    JOIN "roles" r
      ON r."id" = ur."role_id"
     AND r."company_id" = p_company_id
     AND r."is_active" = TRUE
    JOIN "role_permissions" rp ON rp."role_id" = r."id"
    JOIN "permissions" p ON p."id" = rp."permission_id"
    WHERE ur."company_id" = p_company_id
      AND ur."user_id" = p_actor_user_id
      AND p."permission_code" = 'cost.direct_posting.approve'
  ) THEN
    RETURN FALSE;
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM "user_roles" ur
    JOIN "roles" r
      ON r."id" = ur."role_id"
     AND r."company_id" = p_company_id
     AND r."is_active" = TRUE
    JOIN "approval_step_roles" asr
      ON asr."role_id" = r."id"
     AND asr."approval_step_id" = p_approval_step_id
    WHERE ur."company_id" = p_company_id
      AND ur."user_id" = p_actor_user_id
  ) THEN
    RETURN FALSE;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "user_roles" ur
    JOIN "roles" r
      ON r."id" = ur."role_id"
     AND r."company_id" = p_company_id
     AND r."is_active" = TRUE
    JOIN "role_permissions" rp ON rp."role_id" = r."id"
    JOIN "permissions" p ON p."id" = rp."permission_id"
    WHERE ur."company_id" = p_company_id
      AND ur."user_id" = p_actor_user_id
      AND p."permission_code" = 'projects.access_all'
  ) THEN
    RETURN TRUE;
  END IF;

  IF actor_employee_id IS NULL THEN
    RETURN FALSE;
  END IF;

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

CREATE OR REPLACE FUNCTION erp_direct_cost_approval_instance_history_guard()
RETURNS trigger AS $$
DECLARE
  posting_project_id UUID;
  maker_user_id UUID;
  current_step_id UUID;
BEGIN
  IF OLD."entity_type" <> 'DIRECT_COST_POSTING' THEN
    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."approval_state" IN ('APPROVED','REJECTED') THEN
    RAISE EXCEPTION 'DIRECT_COST_APPROVAL_HISTORY_IMMUTABLE';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'DIRECT_COST_APPROVAL_HISTORY_IMMUTABLE';
  END IF;

  IF NEW."company_id" IS DISTINCT FROM OLD."company_id"
     OR NEW."approval_workflow_id" IS DISTINCT FROM OLD."approval_workflow_id"
     OR NEW."entity_type" IS DISTINCT FROM OLD."entity_type"
     OR NEW."entity_id" IS DISTINCT FROM OLD."entity_id"
     OR NEW."started_at" IS DISTINCT FROM OLD."started_at" THEN
    RAISE EXCEPTION 'DIRECT_COST_APPROVAL_IDENTITY_IMMUTABLE';
  END IF;

  IF OLD."approval_state" = 'SUBMITTED'
     AND NEW."approval_state" = 'SUBMITTED' THEN
    IF NEW."completed_at" IS NOT NULL THEN
      RAISE EXCEPTION 'DIRECT_COST_APPROVAL_COMPLETION_INVALID';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."approval_state" <> 'SUBMITTED'
     OR NEW."approval_state" NOT IN ('APPROVED','REJECTED')
     OR NEW."completed_at" IS NULL
     OR NEW."current_step_no" IS DISTINCT FROM OLD."current_step_no" THEN
    RAISE EXCEPTION 'DIRECT_COST_APPROVAL_STATE_TRANSITION_INVALID';
  END IF;

  SELECT dcp."project_id", dcp."created_by_user_id"
    INTO posting_project_id, maker_user_id
  FROM "direct_cost_postings" dcp
  WHERE dcp."id" = OLD."entity_id"
    AND dcp."company_id" = OLD."company_id"
    AND dcp."approval_instance_id" = OLD."id"
    AND dcp."state" = 'SUBMITTED';

  IF posting_project_id IS NULL OR maker_user_id IS NULL THEN
    RAISE EXCEPTION 'DIRECT_COST_APPROVAL_POSTING_BINDING_INVALID';
  END IF;

  SELECT s."id"
    INTO current_step_id
  FROM "approval_steps" s
  WHERE s."approval_workflow_id" = OLD."approval_workflow_id"
    AND s."step_no" = OLD."current_step_no";

  IF current_step_id IS NULL THEN
    RAISE EXCEPTION 'DIRECT_COST_APPROVAL_STEP_INVALID';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "approval_actions" aa
    JOIN "approval_steps" s ON s."id" = aa."approval_step_id"
    WHERE aa."approval_instance_id" = OLD."id"
      AND (
        s."approval_workflow_id" <> OLD."approval_workflow_id"
        OR aa."action" NOT IN ('APPROVE','REJECT')
        OR NOT erp_direct_cost_actor_authorized(
          OLD."company_id",
          posting_project_id,
          aa."approval_step_id",
          maker_user_id,
          aa."action_by_user_id"
        )
      )
  ) THEN
    RAISE EXCEPTION 'DIRECT_COST_APPROVAL_ACTION_UNAUTHORIZED';
  END IF;

  IF NEW."approval_state" = 'APPROVED' THEN
    IF EXISTS (
      SELECT 1
      FROM "approval_steps" s
      WHERE s."approval_workflow_id" = OLD."approval_workflow_id"
        AND s."step_no" > OLD."current_step_no"
    ) THEN
      RAISE EXCEPTION 'DIRECT_COST_APPROVAL_FINAL_STEP_REQUIRED';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "approval_actions" aa
      WHERE aa."approval_instance_id" = OLD."id"
        AND aa."action" = 'REJECT'
    ) THEN
      RAISE EXCEPTION 'DIRECT_COST_APPROVAL_REJECT_EVIDENCE_CONFLICT';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "approval_steps" s
      WHERE s."approval_workflow_id" = OLD."approval_workflow_id"
        AND (
          SELECT COUNT(*)
          FROM "approval_actions" aa
          WHERE aa."approval_instance_id" = OLD."id"
            AND aa."approval_step_id" = s."id"
            AND aa."action" = 'APPROVE'
        ) < s."required_approvals"
    ) THEN
      RAISE EXCEPTION 'DIRECT_COST_APPROVAL_THRESHOLD_NOT_MET';
    END IF;
  ELSE
    IF NOT EXISTS (
      SELECT 1
      FROM "approval_actions" aa
      WHERE aa."approval_instance_id" = OLD."id"
        AND aa."approval_step_id" = current_step_id
        AND aa."action" = 'REJECT'
    ) THEN
      RAISE EXCEPTION 'DIRECT_COST_REJECTION_ACTION_REQUIRED';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "approval_actions" aa
      JOIN "approval_steps" s ON s."id" = aa."approval_step_id"
      WHERE aa."approval_instance_id" = OLD."id"
        AND aa."action" = 'REJECT'
        AND s."step_no" <> OLD."current_step_no"
    ) THEN
      RAISE EXCEPTION 'DIRECT_COST_REJECTION_STEP_INVALID';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "approval_steps" s
      WHERE s."approval_workflow_id" = OLD."approval_workflow_id"
        AND s."step_no" < OLD."current_step_no"
        AND (
          SELECT COUNT(*)
          FROM "approval_actions" aa
          WHERE aa."approval_instance_id" = OLD."id"
            AND aa."approval_step_id" = s."id"
            AND aa."action" = 'APPROVE'
        ) < s."required_approvals"
    ) THEN
      RAISE EXCEPTION 'DIRECT_COST_PRIOR_APPROVAL_THRESHOLD_NOT_MET';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION erp_direct_cost_terminal_actor_guard()
RETURNS trigger AS $$
DECLARE
  approval_current_step_no INT;
  approval_workflow_id UUID;
  approval_step_id UUID;
BEGIN
  IF NEW."state" NOT IN ('APPROVED','REJECTED') THEN
    RETURN NEW;
  END IF;

  SELECT ai."current_step_no", ai."approval_workflow_id"
    INTO approval_current_step_no, approval_workflow_id
  FROM "approval_instances" ai
  WHERE ai."id" = NEW."approval_instance_id"
    AND ai."company_id" = NEW."company_id"
    AND ai."entity_type" = 'DIRECT_COST_POSTING'
    AND ai."entity_id" = NEW."id"
    AND ai."approval_state" = NEW."state";

  IF approval_current_step_no IS NULL OR approval_workflow_id IS NULL THEN
    RAISE EXCEPTION 'DIRECT_COST_TERMINAL_APPROVAL_EVIDENCE_INVALID';
  END IF;

  SELECT s."id"
    INTO approval_step_id
  FROM "approval_steps" s
  WHERE s."approval_workflow_id" = approval_workflow_id
    AND s."step_no" = approval_current_step_no;

  IF approval_step_id IS NULL THEN
    RAISE EXCEPTION 'DIRECT_COST_TERMINAL_APPROVAL_STEP_INVALID';
  END IF;

  IF NEW."state" = 'APPROVED' THEN
    IF NEW."approved_by_user_id" IS NULL
       OR NOT EXISTS (
         SELECT 1
         FROM "approval_actions" aa
         WHERE aa."approval_instance_id" = NEW."approval_instance_id"
           AND aa."approval_step_id" = approval_step_id
           AND aa."action" = 'APPROVE'
           AND aa."action_by_user_id" = NEW."approved_by_user_id"
       ) THEN
      RAISE EXCEPTION 'DIRECT_COST_APPROVER_EVIDENCE_INVALID';
    END IF;
  ELSE
    IF NEW."rejected_by_user_id" IS NULL
       OR NOT EXISTS (
         SELECT 1
         FROM "approval_actions" aa
         WHERE aa."approval_instance_id" = NEW."approval_instance_id"
           AND aa."approval_step_id" = approval_step_id
           AND aa."action" = 'REJECT'
           AND aa."action_by_user_id" = NEW."rejected_by_user_id"
       ) THEN
      RAISE EXCEPTION 'DIRECT_COST_REJECTOR_EVIDENCE_INVALID';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "direct_cost_terminal_actor_guard"
BEFORE INSERT OR UPDATE ON "direct_cost_postings"
FOR EACH ROW EXECUTE FUNCTION erp_direct_cost_terminal_actor_guard();
