-- V0.7-B Direct Cost approval-action concurrency hardening.
-- Forward-only correction for the DEC-022 P1 race identified on a93ed182d0.
-- Serialize ApprovalAction insertion with approval-instance step progression /
-- terminalization by locking the bound approval_instances row before accepting
-- Direct Cost approval evidence. Prior executed migrations remain untouched.

CREATE OR REPLACE FUNCTION erp_direct_cost_approval_action_history_guard()
RETURNS trigger AS $$
DECLARE
  bound_entity_type TEXT;
  bound_approval_state TEXT;
  bound_company_id UUID;
  bound_entity_id UUID;
  bound_workflow_id UUID;
  bound_current_step_no INT;
  bound_current_step_id UUID;
  posting_project_id UUID;
  maker_user_id UUID;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    SELECT ai."entity_type"
      INTO bound_entity_type
    FROM "approval_instances" ai
    WHERE ai."id" = OLD."approval_instance_id";

    IF bound_entity_type = 'DIRECT_COST_POSTING' THEN
      RAISE EXCEPTION 'DIRECT_COST_APPROVAL_ACTION_IMMUTABLE';
    END IF;

    IF TG_OP = 'DELETE' THEN
      RETURN OLD;
    END IF;
    RETURN NEW;
  END IF;

  SELECT
    ai."entity_type",
    ai."approval_state",
    ai."company_id",
    ai."entity_id",
    ai."approval_workflow_id",
    ai."current_step_no"
  INTO
    bound_entity_type,
    bound_approval_state,
    bound_company_id,
    bound_entity_id,
    bound_workflow_id,
    bound_current_step_no
  FROM "approval_instances" ai
  WHERE ai."id" = NEW."approval_instance_id"
  FOR UPDATE;

  IF bound_entity_type IS DISTINCT FROM 'DIRECT_COST_POSTING' THEN
    RETURN NEW;
  END IF;

  IF bound_approval_state <> 'SUBMITTED' THEN
    RAISE EXCEPTION 'DIRECT_COST_APPROVAL_ACTION_STATE_INVALID';
  END IF;

  SELECT s."id"
    INTO bound_current_step_id
  FROM "approval_steps" s
  WHERE s."approval_workflow_id" = bound_workflow_id
    AND s."step_no" = bound_current_step_no;

  IF bound_current_step_id IS NULL
     OR NEW."approval_step_id" <> bound_current_step_id THEN
    RAISE EXCEPTION 'DIRECT_COST_APPROVAL_ACTION_CURRENT_STEP_REQUIRED';
  END IF;

  IF NEW."action" NOT IN ('APPROVE','REJECT') THEN
    RAISE EXCEPTION 'DIRECT_COST_APPROVAL_ACTION_INVALID';
  END IF;

  SELECT dcp."project_id", dcp."created_by_user_id"
    INTO posting_project_id, maker_user_id
  FROM "direct_cost_postings" dcp
  WHERE dcp."id" = bound_entity_id
    AND dcp."company_id" = bound_company_id
    AND dcp."approval_instance_id" = NEW."approval_instance_id"
    AND dcp."state" = 'SUBMITTED';

  IF posting_project_id IS NULL OR maker_user_id IS NULL THEN
    RAISE EXCEPTION 'DIRECT_COST_APPROVAL_POSTING_BINDING_INVALID';
  END IF;

  IF NOT erp_direct_cost_actor_authorized(
    bound_company_id,
    posting_project_id,
    NEW."approval_step_id",
    maker_user_id,
    NEW."action_by_user_id"
  ) THEN
    RAISE EXCEPTION 'DIRECT_COST_APPROVAL_ACTION_UNAUTHORIZED';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
