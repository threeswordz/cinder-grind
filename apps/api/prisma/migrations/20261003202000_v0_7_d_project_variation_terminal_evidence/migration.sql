-- V0.7-D bind Project Variation terminal metadata to retained approval action evidence.
-- Forward-only: replaces the trigger function created by earlier Stage-D migrations.

CREATE OR REPLACE FUNCTION erp_project_variation_state_evidence_guard()
RETURNS trigger AS $$
DECLARE
  instance_company UUID;
  instance_entity_type TEXT;
  instance_entity_id UUID;
  instance_state TEXT;
  decision_actor UUID;
  decision_at TIMESTAMPTZ;
  decision_comment TEXT;
BEGIN
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
      RAISE EXCEPTION 'PROJECT_VARIATION_DRAFT_EVIDENCE_INVALID';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."approval_instance_id" IS NULL
     OR NEW."submitted_by_user_id" IS NULL
     OR NEW."submitted_at" IS NULL THEN
    RAISE EXCEPTION 'PROJECT_VARIATION_SUBMISSION_EVIDENCE_REQUIRED';
  END IF;

  SELECT ai."company_id", ai."entity_type", ai."entity_id", ai."approval_state"
    INTO instance_company, instance_entity_type, instance_entity_id, instance_state
  FROM "approval_instances" ai
  WHERE ai."id" = NEW."approval_instance_id";

  IF instance_company IS NULL
     OR instance_company <> NEW."company_id"
     OR instance_entity_type <> 'PROJECT_VARIATION'
     OR instance_entity_id <> NEW."id" THEN
    RAISE EXCEPTION 'PROJECT_VARIATION_APPROVAL_BINDING_INVALID';
  END IF;

  IF NEW."state" = 'SUBMITTED' THEN
    IF instance_state <> 'SUBMITTED'
       OR NEW."decided_at" IS NOT NULL
       OR NEW."approved_by_user_id" IS NOT NULL
       OR NEW."approved_at" IS NOT NULL
       OR NEW."rejected_by_user_id" IS NOT NULL
       OR NEW."rejected_at" IS NOT NULL
       OR NEW."rejection_reason" IS NOT NULL THEN
      RAISE EXCEPTION 'PROJECT_VARIATION_SUBMITTED_EVIDENCE_INVALID';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."state" = 'APPROVED' THEN
    SELECT aa."action_by_user_id", aa."action_at", aa."comment"
      INTO decision_actor, decision_at, decision_comment
    FROM "approval_actions" aa
    WHERE aa."approval_instance_id" = NEW."approval_instance_id"
      AND aa."action" = 'APPROVE'
      AND aa."project_variation_decision_order" IS NOT NULL
    ORDER BY aa."project_variation_decision_order" DESC
    LIMIT 1;

    IF instance_state <> 'APPROVED'
       OR decision_actor IS NULL
       OR decision_at IS NULL
       OR NEW."approved_by_user_id" IS DISTINCT FROM decision_actor
       OR NEW."approved_at" IS DISTINCT FROM decision_at
       OR NEW."decided_at" IS DISTINCT FROM decision_at
       OR NEW."rejected_by_user_id" IS NOT NULL
       OR NEW."rejected_at" IS NOT NULL
       OR NEW."rejection_reason" IS NOT NULL THEN
      RAISE EXCEPTION 'PROJECT_VARIATION_APPROVAL_EVIDENCE_INVALID';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."state" = 'REJECTED' THEN
    SELECT aa."action_by_user_id", aa."action_at", aa."comment"
      INTO decision_actor, decision_at, decision_comment
    FROM "approval_actions" aa
    WHERE aa."approval_instance_id" = NEW."approval_instance_id"
      AND aa."action" = 'REJECT'
      AND aa."project_variation_decision_order" IS NOT NULL
    ORDER BY aa."project_variation_decision_order" DESC
    LIMIT 1;

    IF instance_state <> 'REJECTED'
       OR decision_actor IS NULL
       OR decision_at IS NULL
       OR NEW."rejected_by_user_id" IS DISTINCT FROM decision_actor
       OR NEW."rejected_at" IS DISTINCT FROM decision_at
       OR NEW."decided_at" IS DISTINCT FROM decision_at
       OR NEW."rejection_reason" IS DISTINCT FROM decision_comment
       OR NEW."approved_by_user_id" IS NOT NULL
       OR NEW."approved_at" IS NOT NULL THEN
      RAISE EXCEPTION 'PROJECT_VARIATION_REJECTION_EVIDENCE_INVALID';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'PROJECT_VARIATION_STATE_EVIDENCE_INVALID';
END;
$$ LANGUAGE plpgsql;
