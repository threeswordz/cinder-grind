-- V0.7-B final-review sequence and retained-currency hardening.
-- Forward-only: all prior executed migrations remain untouched.
-- Linked reversals preserve the immutable original currency even if Company
-- base currency later changes. Direct Cost approval actions are append-only,
-- current-step-only evidence, and step progression requires the configured
-- threshold before moving to the exact next workflow step.

CREATE OR REPLACE FUNCTION erp_direct_cost_scope_guard()
RETURNS trigger AS $$
DECLARE
  project_company UUID;
  project_active BOOLEAN;
  wbs_project UUID;
  wbs_active BOOLEAN;
  cost_company UUID;
  cost_active BOOLEAN;
  base_currency VARCHAR(3);
  original_row direct_cost_postings%ROWTYPE;
  approval_company UUID;
  approval_entity_type TEXT;
  approval_entity_id UUID;
  approval_instance_state TEXT;
BEGIN
  SELECT "company_id","is_active"
    INTO project_company,project_active
  FROM "projects" WHERE "id" = NEW."project_id";
  IF project_company IS NULL
     OR project_company <> NEW."company_id"
     OR (
       NEW."reverses_posting_id" IS NULL
       AND project_active IS DISTINCT FROM TRUE
     ) THEN
    RAISE EXCEPTION 'DIRECT_COST_PROJECT_SCOPE_INVALID';
  END IF;

  SELECT "base_currency_code" INTO base_currency
  FROM "companies" WHERE "id" = NEW."company_id";
  IF base_currency IS NULL THEN
    RAISE EXCEPTION 'DIRECT_COST_CURRENCY_INVALID';
  END IF;
  IF NEW."reverses_posting_id" IS NULL
     AND NEW."currency_code" <> base_currency THEN
    RAISE EXCEPTION 'DIRECT_COST_CURRENCY_INVALID';
  END IF;

  SELECT "company_id","is_active"
    INTO cost_company,cost_active
  FROM "cost_codes" WHERE "id" = NEW."cost_code_id";
  IF cost_company IS NULL
     OR cost_company <> NEW."company_id"
     OR (
       NEW."reverses_posting_id" IS NULL
       AND cost_active IS DISTINCT FROM TRUE
     ) THEN
    RAISE EXCEPTION 'DIRECT_COST_COST_CODE_SCOPE_INVALID';
  END IF;

  IF NEW."wbs_id" IS NOT NULL THEN
    SELECT "project_id","is_active" INTO wbs_project,wbs_active
    FROM "wbs_elements" WHERE "id" = NEW."wbs_id";
    IF wbs_project IS NULL
       OR wbs_project <> NEW."project_id"
       OR (
         NEW."reverses_posting_id" IS NULL
         AND wbs_active IS DISTINCT FROM TRUE
       ) THEN
      RAISE EXCEPTION 'DIRECT_COST_WBS_SCOPE_INVALID';
    END IF;
  END IF;

  IF NEW."reverses_posting_id" IS NULL THEN
    IF NEW."amount" <= 0 THEN
      RAISE EXCEPTION 'DIRECT_COST_AMOUNT_INVALID';
    END IF;
    IF NEW."reversal_reason" IS NOT NULL THEN
      RAISE EXCEPTION 'DIRECT_COST_REVERSAL_REASON_WITHOUT_SOURCE';
    END IF;
  ELSE
    SELECT * INTO original_row
    FROM "direct_cost_postings"
    WHERE "id" = NEW."reverses_posting_id";

    IF original_row."id" IS NULL
       OR original_row."company_id" <> NEW."company_id"
       OR original_row."project_id" <> NEW."project_id"
       OR original_row."state" <> 'APPROVED'
       OR original_row."reverses_posting_id" IS NOT NULL
       OR NEW."amount" <> -original_row."amount"
       OR NEW."currency_code" <> original_row."currency_code"
       OR NEW."wbs_id" IS DISTINCT FROM original_row."wbs_id"
       OR NEW."cost_code_id" <> original_row."cost_code_id"
       OR NULLIF(BTRIM(NEW."reversal_reason"), '') IS NULL THEN
      RAISE EXCEPTION 'DIRECT_COST_REVERSAL_INVALID';
    END IF;
  END IF;

  IF NEW."state" = 'DRAFT' THEN
    IF NEW."approval_instance_id" IS NOT NULL
       OR NEW."submitted_by_user_id" IS NOT NULL
       OR NEW."submitted_at" IS NOT NULL
       OR NEW."decided_at" IS NOT NULL
       OR NEW."approved_by_user_id" IS NOT NULL
       OR NEW."approved_at" IS NOT NULL
       OR NEW."rejected_by_user_id" IS NOT NULL
       OR NEW."rejected_at" IS NOT NULL
       OR NEW."rejection_reason" IS NOT NULL THEN
      RAISE EXCEPTION 'DIRECT_COST_DRAFT_EVIDENCE_INVALID';
    END IF;
  ELSE
    IF NEW."approval_instance_id" IS NULL
       OR NEW."submitted_by_user_id" IS NULL
       OR NEW."submitted_at" IS NULL THEN
      RAISE EXCEPTION 'DIRECT_COST_SUBMISSION_EVIDENCE_REQUIRED';
    END IF;

    SELECT ai."company_id",ai."entity_type",ai."entity_id",ai."approval_state"
      INTO approval_company,approval_entity_type,approval_entity_id,approval_instance_state
    FROM "approval_instances" ai
    WHERE ai."id" = NEW."approval_instance_id";

    IF approval_company IS NULL
       OR approval_company <> NEW."company_id"
       OR approval_entity_type <> 'DIRECT_COST_POSTING'
       OR approval_entity_id <> NEW."id" THEN
      RAISE EXCEPTION 'DIRECT_COST_APPROVAL_BINDING_INVALID';
    END IF;

    IF NEW."state" = 'SUBMITTED' THEN
      IF approval_instance_state <> 'SUBMITTED'
         OR NEW."decided_at" IS NOT NULL
         OR NEW."approved_by_user_id" IS NOT NULL
         OR NEW."approved_at" IS NOT NULL
         OR NEW."rejected_by_user_id" IS NOT NULL
         OR NEW."rejected_at" IS NOT NULL
         OR NEW."rejection_reason" IS NOT NULL THEN
        RAISE EXCEPTION 'DIRECT_COST_APPROVAL_STATE_INVALID';
      END IF;
    ELSIF NEW."state" = 'APPROVED' THEN
      IF approval_instance_state <> 'APPROVED'
         OR NEW."approved_by_user_id" IS NULL
         OR NEW."approved_at" IS NULL
         OR NEW."decided_at" IS NULL
         OR NEW."rejected_by_user_id" IS NOT NULL
         OR NEW."rejected_at" IS NOT NULL
         OR NEW."rejection_reason" IS NOT NULL THEN
        RAISE EXCEPTION 'DIRECT_COST_APPROVAL_EVIDENCE_INVALID';
      END IF;
    ELSIF NEW."state" = 'REJECTED' THEN
      IF approval_instance_state <> 'REJECTED'
         OR NEW."rejected_by_user_id" IS NULL
         OR NEW."rejected_at" IS NULL
         OR NEW."decided_at" IS NULL
         OR NEW."approved_by_user_id" IS NOT NULL
         OR NEW."approved_at" IS NOT NULL THEN
        RAISE EXCEPTION 'DIRECT_COST_REJECTION_EVIDENCE_INVALID';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
  WHERE ai."id" = NEW."approval_instance_id";

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

CREATE OR REPLACE FUNCTION erp_direct_cost_approval_instance_history_guard()
RETURNS trigger AS $$
DECLARE
  posting_project_id UUID;
  maker_user_id UUID;
  current_step_id UUID;
  current_required_approvals INT;
  next_step_no INT;
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

  SELECT s."id", s."required_approvals"
    INTO current_step_id, current_required_approvals
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

  IF OLD."approval_state" = 'SUBMITTED'
     AND NEW."approval_state" = 'SUBMITTED' THEN
    IF NEW."completed_at" IS NOT NULL THEN
      RAISE EXCEPTION 'DIRECT_COST_APPROVAL_COMPLETION_INVALID';
    END IF;

    IF NEW."current_step_no" = OLD."current_step_no" THEN
      RETURN NEW;
    END IF;

    SELECT MIN(s."step_no")
      INTO next_step_no
    FROM "approval_steps" s
    WHERE s."approval_workflow_id" = OLD."approval_workflow_id"
      AND s."step_no" > OLD."current_step_no";

    IF next_step_no IS NULL OR NEW."current_step_no" <> next_step_no THEN
      RAISE EXCEPTION 'DIRECT_COST_APPROVAL_STEP_PROGRESSION_INVALID';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "approval_actions" aa
      JOIN "approval_steps" s ON s."id" = aa."approval_step_id"
      WHERE aa."approval_instance_id" = OLD."id"
        AND s."step_no" > OLD."current_step_no"
    ) THEN
      RAISE EXCEPTION 'DIRECT_COST_APPROVAL_FUTURE_ACTION_INVALID';
    END IF;

    IF EXISTS (
      SELECT 1
      FROM "approval_actions" aa
      WHERE aa."approval_instance_id" = OLD."id"
        AND aa."approval_step_id" = current_step_id
        AND aa."action" = 'REJECT'
    ) THEN
      RAISE EXCEPTION 'DIRECT_COST_APPROVAL_REJECT_EVIDENCE_CONFLICT';
    END IF;

    IF (
      SELECT COUNT(*)
      FROM "approval_actions" aa
      WHERE aa."approval_instance_id" = OLD."id"
        AND aa."approval_step_id" = current_step_id
        AND aa."action" = 'APPROVE'
    ) < current_required_approvals THEN
      RAISE EXCEPTION 'DIRECT_COST_APPROVAL_THRESHOLD_NOT_MET';
    END IF;

    RETURN NEW;
  END IF;

  IF OLD."approval_state" <> 'SUBMITTED'
     OR NEW."approval_state" NOT IN ('APPROVED','REJECTED')
     OR NEW."completed_at" IS NULL
     OR NEW."current_step_no" IS DISTINCT FROM OLD."current_step_no" THEN
    RAISE EXCEPTION 'DIRECT_COST_APPROVAL_STATE_TRANSITION_INVALID';
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
