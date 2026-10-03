-- V0.7-B Direct Cost scope guard correction.
-- Forward-only: prior migrations are immutable after execution.
-- The original guard used a PL/pgSQL variable named approval_state, which
-- collided with approval_instances.approval_state during live submission.

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
     OR project_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'DIRECT_COST_PROJECT_SCOPE_INVALID';
  END IF;

  SELECT "base_currency_code" INTO base_currency
  FROM "companies" WHERE "id" = NEW."company_id";
  IF base_currency IS NULL OR NEW."currency_code" <> base_currency THEN
    RAISE EXCEPTION 'DIRECT_COST_CURRENCY_INVALID';
  END IF;

  SELECT "company_id","is_active"
    INTO cost_company,cost_active
  FROM "cost_codes" WHERE "id" = NEW."cost_code_id";
  IF cost_company IS NULL
     OR cost_company <> NEW."company_id"
     OR cost_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'DIRECT_COST_COST_CODE_SCOPE_INVALID';
  END IF;

  IF NEW."wbs_id" IS NOT NULL THEN
    SELECT "project_id","is_active" INTO wbs_project,wbs_active
    FROM "wbs_elements" WHERE "id" = NEW."wbs_id";
    IF wbs_project IS NULL
       OR wbs_project <> NEW."project_id"
       OR wbs_active IS DISTINCT FROM TRUE THEN
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
       OR NEW."rejected_at" IS NOT NULL THEN
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
    IF NEW."state" = 'SUBMITTED' AND approval_instance_state <> 'SUBMITTED' THEN
      RAISE EXCEPTION 'DIRECT_COST_APPROVAL_STATE_INVALID';
    ELSIF NEW."state" = 'APPROVED' AND (
      approval_instance_state <> 'APPROVED'
      OR NEW."approved_by_user_id" IS NULL
      OR NEW."approved_at" IS NULL
      OR NEW."decided_at" IS NULL
    ) THEN
      RAISE EXCEPTION 'DIRECT_COST_APPROVAL_EVIDENCE_INVALID';
    ELSIF NEW."state" = 'REJECTED' AND (
      approval_instance_state <> 'REJECTED'
      OR NEW."rejected_by_user_id" IS NULL
      OR NEW."rejected_at" IS NULL
      OR NEW."decided_at" IS NULL
    ) THEN
      RAISE EXCEPTION 'DIRECT_COST_REJECTION_EVIDENCE_INVALID';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
