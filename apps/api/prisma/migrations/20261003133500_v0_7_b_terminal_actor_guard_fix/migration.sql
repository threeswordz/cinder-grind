-- V0.7-B terminal actor guard PL/pgSQL name-collision correction.
-- Forward-only: the previously executed 20261003131500 migration is untouched.

CREATE OR REPLACE FUNCTION erp_direct_cost_terminal_actor_guard()
RETURNS trigger AS $$
DECLARE
  bound_current_step_no INT;
  bound_workflow_id UUID;
  bound_step_id UUID;
BEGIN
  IF NEW."state" NOT IN ('APPROVED','REJECTED') THEN
    RETURN NEW;
  END IF;

  SELECT ai."current_step_no", ai."approval_workflow_id"
    INTO bound_current_step_no, bound_workflow_id
  FROM "approval_instances" ai
  WHERE ai."id" = NEW."approval_instance_id"
    AND ai."company_id" = NEW."company_id"
    AND ai."entity_type" = 'DIRECT_COST_POSTING'
    AND ai."entity_id" = NEW."id"
    AND ai."approval_state" = NEW."state";

  IF bound_current_step_no IS NULL OR bound_workflow_id IS NULL THEN
    RAISE EXCEPTION 'DIRECT_COST_TERMINAL_APPROVAL_EVIDENCE_INVALID';
  END IF;

  SELECT s."id"
    INTO bound_step_id
  FROM "approval_steps" s
  WHERE s."approval_workflow_id" = bound_workflow_id
    AND s."step_no" = bound_current_step_no;

  IF bound_step_id IS NULL THEN
    RAISE EXCEPTION 'DIRECT_COST_TERMINAL_APPROVAL_STEP_INVALID';
  END IF;

  IF NEW."state" = 'APPROVED' THEN
    IF NEW."approved_by_user_id" IS NULL
       OR NOT EXISTS (
         SELECT 1
         FROM "approval_actions" aa
         WHERE aa."approval_instance_id" = NEW."approval_instance_id"
           AND aa."approval_step_id" = bound_step_id
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
           AND aa."approval_step_id" = bound_step_id
           AND aa."action" = 'REJECT'
           AND aa."action_by_user_id" = NEW."rejected_by_user_id"
       ) THEN
      RAISE EXCEPTION 'DIRECT_COST_REJECTOR_EVIDENCE_INVALID';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
