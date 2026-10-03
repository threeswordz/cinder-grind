-- V0.7-D Project Variation lifecycle evidence hardening.
-- Forward-only follow-up: the Stage-D foundation migration has already executed in CI.

CREATE OR REPLACE FUNCTION erp_project_variation_state_evidence_guard()
RETURNS trigger AS $$
DECLARE
  instance_company UUID;
  instance_entity_type TEXT;
  instance_entity_id UUID;
  instance_state TEXT;
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
    IF instance_state <> 'APPROVED'
       OR NEW."approved_by_user_id" IS NULL
       OR NEW."approved_at" IS NULL
       OR NEW."decided_at" IS NULL
       OR NEW."rejected_by_user_id" IS NOT NULL
       OR NEW."rejected_at" IS NOT NULL
       OR NEW."rejection_reason" IS NOT NULL THEN
      RAISE EXCEPTION 'PROJECT_VARIATION_APPROVAL_EVIDENCE_INVALID';
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."state" = 'REJECTED' THEN
    IF instance_state <> 'REJECTED'
       OR NEW."rejected_by_user_id" IS NULL
       OR NEW."rejected_at" IS NULL
       OR NEW."decided_at" IS NULL
       OR NEW."approved_by_user_id" IS NOT NULL
       OR NEW."approved_at" IS NOT NULL THEN
      RAISE EXCEPTION 'PROJECT_VARIATION_REJECTION_EVIDENCE_INVALID';
    END IF;
    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'PROJECT_VARIATION_STATE_EVIDENCE_INVALID';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "project_variation_state_evidence_guard"
BEFORE INSERT OR UPDATE ON "project_variations"
FOR EACH ROW EXECUTE FUNCTION erp_project_variation_state_evidence_guard();

CREATE OR REPLACE FUNCTION erp_project_variation_approval_action_immutability_guard()
RETURNS trigger AS $$
DECLARE
  bound_entity_type TEXT;
BEGIN
  SELECT ai."entity_type" INTO bound_entity_type
  FROM "approval_instances" ai
  WHERE ai."id" = COALESCE(NEW."approval_instance_id", OLD."approval_instance_id");

  IF bound_entity_type = 'PROJECT_VARIATION' THEN
    RAISE EXCEPTION 'PROJECT_VARIATION_APPROVAL_ACTION_IMMUTABLE';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "project_variation_approval_action_immutability_guard"
BEFORE UPDATE OR DELETE ON "approval_actions"
FOR EACH ROW EXECUTE FUNCTION erp_project_variation_approval_action_immutability_guard();
