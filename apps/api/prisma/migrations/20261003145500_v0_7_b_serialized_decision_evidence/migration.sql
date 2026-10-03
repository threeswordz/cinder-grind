-- V0.7-B serialized Direct Cost decision-evidence hardening.
-- Forward-only correction for the DEC-022 P2 found on b3fd8ae76b.
-- Mirrors the established V0.6 Payment evidence pattern: every accepted
-- Direct Cost approval action receives database-authoritative post-lock order
-- and time, and terminal posting metadata must match the last retained action.

CREATE SEQUENCE IF NOT EXISTS "direct_cost_approval_action_order_seq";

ALTER TABLE "approval_actions"
  ADD COLUMN IF NOT EXISTS "direct_cost_decision_order" BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS "approval_actions_direct_cost_decision_order_key"
  ON "approval_actions"("direct_cost_decision_order");

WITH ranked AS (
  SELECT
    aa."id",
    ROW_NUMBER() OVER (ORDER BY aa."action_at", aa."id")::BIGINT AS decision_order
  FROM "approval_actions" aa
  JOIN "approval_instances" ai
    ON ai."id" = aa."approval_instance_id"
  WHERE ai."entity_type" = 'DIRECT_COST_POSTING'
    AND aa."direct_cost_decision_order" IS NULL
)
UPDATE "approval_actions" aa
SET "direct_cost_decision_order" = ranked.decision_order
FROM ranked
WHERE aa."id" = ranked."id";

SELECT setval(
  '"direct_cost_approval_action_order_seq"',
  COALESCE((SELECT MAX("direct_cost_decision_order") FROM "approval_actions"), 0) + 1,
  false
);

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

  NEW."action_at" := date_trunc('milliseconds', clock_timestamp());
  NEW."direct_cost_decision_order" :=
    nextval('"direct_cost_approval_action_order_seq"');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE OR REPLACE FUNCTION erp_direct_cost_terminal_actor_guard()
RETURNS trigger AS $$
DECLARE
  bound_current_step_no INT;
  bound_workflow_id UUID;
  bound_step_id UUID;
  retained_actor_user_id UUID;
  retained_action_at TIMESTAMPTZ;
  retained_action_comment TEXT;
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

  SELECT aa."action_by_user_id", aa."action_at", aa."comment"
    INTO retained_actor_user_id, retained_action_at, retained_action_comment
  FROM "approval_actions" aa
  WHERE aa."approval_instance_id" = NEW."approval_instance_id"
    AND aa."approval_step_id" = bound_step_id
    AND aa."action" = CASE NEW."state"
      WHEN 'APPROVED' THEN 'APPROVE'
      ELSE 'REJECT'
    END
    AND aa."direct_cost_decision_order" IS NOT NULL
  ORDER BY aa."direct_cost_decision_order" DESC
  LIMIT 1;

  IF retained_actor_user_id IS NULL OR retained_action_at IS NULL THEN
    RAISE EXCEPTION 'DIRECT_COST_DECISION_EVIDENCE_MISSING';
  END IF;

  IF NEW."state" = 'APPROVED' THEN
    IF NEW."approved_by_user_id" IS DISTINCT FROM retained_actor_user_id
       OR NEW."approved_at" IS DISTINCT FROM retained_action_at
       OR NEW."decided_at" IS DISTINCT FROM retained_action_at THEN
      RAISE EXCEPTION 'DIRECT_COST_APPROVAL_METADATA_EVIDENCE_MISMATCH';
    END IF;
  ELSE
    IF NEW."rejected_by_user_id" IS DISTINCT FROM retained_actor_user_id
       OR NEW."rejected_at" IS DISTINCT FROM retained_action_at
       OR NEW."decided_at" IS DISTINCT FROM retained_action_at
       OR NEW."rejection_reason" IS DISTINCT FROM retained_action_comment THEN
      RAISE EXCEPTION 'DIRECT_COST_REJECTION_METADATA_EVIDENCE_MISMATCH';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
