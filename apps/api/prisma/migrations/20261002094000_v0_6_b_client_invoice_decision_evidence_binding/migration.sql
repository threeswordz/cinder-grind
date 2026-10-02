-- V0.6-B forward-only hardening: final Client Invoice decision metadata
-- must be derived from the retained Approval Action that actually finalized
-- the linked Approval Instance. Prior executed migrations remain unchanged.

CREATE OR REPLACE FUNCTION erp_client_invoice_approval_link_guard()
RETURNS trigger AS $$
DECLARE
  expected_state TEXT;
  instance_company_id UUID;
  instance_entity_type TEXT;
  instance_entity_id UUID;
  instance_state TEXT;
  instance_workflow_id UUID;
  instance_current_step_no INTEGER;
  workflow_company_id UUID;
  workflow_entity_type TEXT;
  expected_step_id UUID;
  retained_actor_user_id UUID;
  retained_action_at TIMESTAMPTZ;
BEGIN
  IF OLD."state" = 'DRAFT' AND NEW."state" = 'SUBMITTED' THEN
    expected_state := 'SUBMITTED';
  ELSIF OLD."state" = 'SUBMITTED' AND NEW."state" = 'APPROVED' THEN
    expected_state := 'APPROVED';
  ELSIF OLD."state" = 'SUBMITTED' AND NEW."state" = 'REJECTED' THEN
    expected_state := 'REJECTED';
  ELSE
    RETURN NEW;
  END IF;

  SELECT
    ai."company_id",
    ai."entity_type",
    ai."entity_id",
    ai."approval_state",
    ai."approval_workflow_id",
    ai."current_step_no",
    aw."company_id",
    aw."entity_type"
  INTO
    instance_company_id,
    instance_entity_type,
    instance_entity_id,
    instance_state,
    instance_workflow_id,
    instance_current_step_no,
    workflow_company_id,
    workflow_entity_type
  FROM "approval_instances" ai
  JOIN "approval_workflows" aw
    ON aw."id" = ai."approval_workflow_id"
  WHERE ai."id" = NEW."approval_instance_id";

  IF instance_company_id IS NULL
    OR instance_company_id IS DISTINCT FROM NEW."company_id"
    OR instance_entity_type IS DISTINCT FROM 'CLIENT_INVOICE'
    OR instance_entity_id IS DISTINCT FROM NEW."id"
    OR workflow_company_id IS DISTINCT FROM NEW."company_id"
    OR workflow_entity_type IS DISTINCT FROM 'CLIENT_INVOICE'
  THEN
    RAISE EXCEPTION 'CLIENT_INVOICE_APPROVAL_LINK_INVALID';
  END IF;

  IF instance_state IS DISTINCT FROM expected_state THEN
    RAISE EXCEPTION 'CLIENT_INVOICE_APPROVAL_STATE_MISMATCH';
  END IF;

  IF expected_state IN ('APPROVED','REJECTED') THEN
    SELECT aps."id"
      INTO expected_step_id
    FROM "approval_steps" aps
    WHERE aps."approval_workflow_id" = instance_workflow_id
      AND aps."step_no" = instance_current_step_no;

    IF expected_step_id IS NULL THEN
      RAISE EXCEPTION 'CLIENT_INVOICE_APPROVAL_STEP_INVALID';
    END IF;

    SELECT aa."action_by_user_id", aa."action_at"
      INTO retained_actor_user_id, retained_action_at
    FROM "approval_actions" aa
    WHERE aa."approval_instance_id" = NEW."approval_instance_id"
      AND aa."approval_step_id" = expected_step_id
      AND aa."action" = CASE expected_state
        WHEN 'APPROVED' THEN 'APPROVE'
        ELSE 'REJECT'
      END
    ORDER BY aa."action_at" DESC, aa."id" DESC
    LIMIT 1;

    IF retained_actor_user_id IS NULL OR retained_action_at IS NULL THEN
      RAISE EXCEPTION 'CLIENT_INVOICE_DECISION_EVIDENCE_MISSING';
    END IF;

    IF expected_state = 'APPROVED' THEN
      IF NEW."approved_by_user_id" IS DISTINCT FROM retained_actor_user_id
        OR NEW."approved_at" IS DISTINCT FROM retained_action_at
        OR NEW."decided_at" IS DISTINCT FROM retained_action_at
      THEN
        RAISE EXCEPTION 'CLIENT_INVOICE_APPROVAL_METADATA_EVIDENCE_MISMATCH';
      END IF;
    ELSE
      IF NEW."rejected_by_user_id" IS DISTINCT FROM retained_actor_user_id
        OR NEW."rejected_at" IS DISTINCT FROM retained_action_at
        OR NEW."decided_at" IS DISTINCT FROM retained_action_at
      THEN
        RAISE EXCEPTION 'CLIENT_INVOICE_REJECTION_METADATA_EVIDENCE_MISMATCH';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
