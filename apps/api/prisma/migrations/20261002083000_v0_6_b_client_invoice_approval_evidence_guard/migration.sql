-- V0.6-B forward-only approval evidence hardening:
-- 1) Client Invoice approval actions must belong to the current workflow step,
--    come from an active authorized role, and respect maker-checker.
-- 2) Client Invoice Approval Instances may only advance when retained approval
--    evidence supports the transition. Finalized evidence is immutable.

CREATE OR REPLACE FUNCTION erp_client_invoice_approval_action_guard()
RETURNS trigger AS $$
DECLARE
  instance_entity_type TEXT;
  instance_company_id UUID;
  instance_state TEXT;
  current_step_id UUID;
  maker_user_id UUID;
  actor_authorized BOOLEAN;
BEGIN
  IF TG_OP IN ('UPDATE','DELETE') THEN
    SELECT "entity_type"
      INTO instance_entity_type
    FROM "approval_instances"
    WHERE "id" = OLD."approval_instance_id";

    IF instance_entity_type = 'CLIENT_INVOICE' THEN
      RAISE EXCEPTION 'CLIENT_INVOICE_APPROVAL_ACTION_IMMUTABLE';
    END IF;

    RETURN CASE WHEN TG_OP = 'DELETE' THEN OLD ELSE NEW END;
  END IF;

  SELECT
    ai."entity_type",
    ai."company_id",
    ai."approval_state",
    aps."id",
    ci."created_by_user_id"
  INTO
    instance_entity_type,
    instance_company_id,
    instance_state,
    current_step_id,
    maker_user_id
  FROM "approval_instances" ai
  JOIN "client_invoices" ci
    ON ci."approval_instance_id" = ai."id"
   AND ci."id" = ai."entity_id"
   AND ci."company_id" = ai."company_id"
  JOIN "approval_steps" aps
    ON aps."approval_workflow_id" = ai."approval_workflow_id"
   AND aps."step_no" = ai."current_step_no"
  WHERE ai."id" = NEW."approval_instance_id";

  IF instance_entity_type IS DISTINCT FROM 'CLIENT_INVOICE' THEN
    RETURN NEW;
  END IF;

  IF instance_state IS DISTINCT FROM 'SUBMITTED'
    OR NEW."approval_step_id" IS DISTINCT FROM current_step_id
    OR NEW."action" NOT IN ('APPROVE','REJECT')
  THEN
    RAISE EXCEPTION 'CLIENT_INVOICE_APPROVAL_ACTION_INVALID';
  END IF;

  IF NEW."action_by_user_id" IS NOT DISTINCT FROM maker_user_id THEN
    RAISE EXCEPTION 'CLIENT_INVOICE_MAKER_CHECKER_VIOLATION';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "approval_actions" aa
    WHERE aa."approval_instance_id" = NEW."approval_instance_id"
      AND aa."approval_step_id" = NEW."approval_step_id"
      AND aa."action_by_user_id" = NEW."action_by_user_id"
  ) THEN
    RAISE EXCEPTION 'CLIENT_INVOICE_APPROVAL_ACTION_DUPLICATE';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM "users" u
    JOIN "user_roles" ur
      ON ur."user_id" = u."id"
     AND ur."company_id" = instance_company_id
    JOIN "roles" r
      ON r."id" = ur."role_id"
     AND r."company_id" = instance_company_id
     AND r."is_active" = TRUE
    JOIN "approval_step_roles" asr
      ON asr."role_id" = r."id"
     AND asr."approval_step_id" = current_step_id
    WHERE u."id" = NEW."action_by_user_id"
      AND u."company_id" = instance_company_id
      AND u."is_active" = TRUE
  )
  INTO actor_authorized;

  IF actor_authorized IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'CLIENT_INVOICE_APPROVAL_ROLE_DENIED';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "client_invoice_approval_action_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "approval_actions"
FOR EACH ROW EXECUTE FUNCTION erp_client_invoice_approval_action_guard();


CREATE OR REPLACE FUNCTION erp_client_invoice_approval_instance_guard()
RETURNS trigger AS $$
DECLARE
  linked_invoice_state TEXT;
  maker_user_id UUID;
  current_step_id UUID;
  current_required INTEGER;
  next_step_no INTEGER;
  valid_approvals INTEGER;
  valid_rejections INTEGER;
BEGIN
  IF OLD."entity_type" IS DISTINCT FROM 'CLIENT_INVOICE'
    AND NEW."entity_type" IS DISTINCT FROM 'CLIENT_INVOICE'
  THEN
    RETURN NEW;
  END IF;

  IF NEW."company_id" IS DISTINCT FROM OLD."company_id"
    OR NEW."approval_workflow_id" IS DISTINCT FROM OLD."approval_workflow_id"
    OR NEW."entity_type" IS DISTINCT FROM OLD."entity_type"
    OR NEW."entity_id" IS DISTINCT FROM OLD."entity_id"
    OR NEW."started_at" IS DISTINCT FROM OLD."started_at"
  THEN
    RAISE EXCEPTION 'CLIENT_INVOICE_APPROVAL_INSTANCE_IDENTITY_IMMUTABLE';
  END IF;

  SELECT
    ci."state",
    ci."created_by_user_id"
  INTO
    linked_invoice_state,
    maker_user_id
  FROM "client_invoices" ci
  WHERE ci."approval_instance_id" = OLD."id"
    AND ci."id" = OLD."entity_id"
    AND ci."company_id" = OLD."company_id";

  IF linked_invoice_state IS NULL THEN
    RAISE EXCEPTION 'CLIENT_INVOICE_APPROVAL_LINK_INVALID';
  END IF;

  IF OLD."approval_state" IN ('APPROVED','REJECTED','CANCELLED') THEN
    IF NEW."approval_state" IS DISTINCT FROM OLD."approval_state"
      OR NEW."current_step_no" IS DISTINCT FROM OLD."current_step_no"
      OR NEW."completed_at" IS DISTINCT FROM OLD."completed_at"
    THEN
      RAISE EXCEPTION 'CLIENT_INVOICE_APPROVAL_INSTANCE_IMMUTABLE';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."approval_state" IS DISTINCT FROM 'SUBMITTED' THEN
    RAISE EXCEPTION 'CLIENT_INVOICE_APPROVAL_STATE_INVALID';
  END IF;

  SELECT aps."id", aps."required_approvals"
    INTO current_step_id, current_required
  FROM "approval_steps" aps
  WHERE aps."approval_workflow_id" = OLD."approval_workflow_id"
    AND aps."step_no" = OLD."current_step_no";

  IF current_step_id IS NULL THEN
    RAISE EXCEPTION 'CLIENT_INVOICE_APPROVAL_STEP_INVALID';
  END IF;

  SELECT COUNT(DISTINCT aa."action_by_user_id")
    INTO valid_approvals
  FROM "approval_actions" aa
  JOIN "users" u
    ON u."id" = aa."action_by_user_id"
   AND u."company_id" = OLD."company_id"
   AND u."is_active" = TRUE
  JOIN "user_roles" ur
    ON ur."user_id" = u."id"
   AND ur."company_id" = OLD."company_id"
  JOIN "roles" r
    ON r."id" = ur."role_id"
   AND r."company_id" = OLD."company_id"
   AND r."is_active" = TRUE
  JOIN "approval_step_roles" asr
    ON asr."role_id" = r."id"
   AND asr."approval_step_id" = current_step_id
  WHERE aa."approval_instance_id" = OLD."id"
    AND aa."approval_step_id" = current_step_id
    AND aa."action" = 'APPROVE'
    AND aa."action_by_user_id" IS DISTINCT FROM maker_user_id;

  SELECT COUNT(DISTINCT aa."action_by_user_id")
    INTO valid_rejections
  FROM "approval_actions" aa
  JOIN "users" u
    ON u."id" = aa."action_by_user_id"
   AND u."company_id" = OLD."company_id"
   AND u."is_active" = TRUE
  JOIN "user_roles" ur
    ON ur."user_id" = u."id"
   AND ur."company_id" = OLD."company_id"
  JOIN "roles" r
    ON r."id" = ur."role_id"
   AND r."company_id" = OLD."company_id"
   AND r."is_active" = TRUE
  JOIN "approval_step_roles" asr
    ON asr."role_id" = r."id"
   AND asr."approval_step_id" = current_step_id
  WHERE aa."approval_instance_id" = OLD."id"
    AND aa."approval_step_id" = current_step_id
    AND aa."action" = 'REJECT'
    AND aa."action_by_user_id" IS DISTINCT FROM maker_user_id;

  IF NEW."approval_state" = 'SUBMITTED' THEN
    IF NEW."completed_at" IS NOT NULL THEN
      RAISE EXCEPTION 'CLIENT_INVOICE_APPROVAL_STATE_INVALID';
    END IF;

    IF NEW."current_step_no" = OLD."current_step_no" THEN
      RETURN NEW;
    END IF;

    SELECT MIN(aps."step_no")
      INTO next_step_no
    FROM "approval_steps" aps
    WHERE aps."approval_workflow_id" = OLD."approval_workflow_id"
      AND aps."step_no" > OLD."current_step_no";

    IF next_step_no IS NULL
      OR NEW."current_step_no" IS DISTINCT FROM next_step_no
      OR valid_approvals < current_required
      OR valid_rejections > 0
    THEN
      RAISE EXCEPTION 'CLIENT_INVOICE_APPROVAL_EVIDENCE_INVALID';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW."approval_state" = 'APPROVED' THEN
    SELECT MIN(aps."step_no")
      INTO next_step_no
    FROM "approval_steps" aps
    WHERE aps."approval_workflow_id" = OLD."approval_workflow_id"
      AND aps."step_no" > OLD."current_step_no";

    IF NEW."current_step_no" IS DISTINCT FROM OLD."current_step_no"
      OR NEW."completed_at" IS NULL
      OR next_step_no IS NOT NULL
      OR valid_approvals < current_required
      OR valid_rejections > 0
    THEN
      RAISE EXCEPTION 'CLIENT_INVOICE_APPROVAL_EVIDENCE_INVALID';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW."approval_state" = 'REJECTED' THEN
    IF NEW."current_step_no" IS DISTINCT FROM OLD."current_step_no"
      OR NEW."completed_at" IS NULL
      OR valid_rejections < 1
    THEN
      RAISE EXCEPTION 'CLIENT_INVOICE_APPROVAL_EVIDENCE_INVALID';
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'CLIENT_INVOICE_APPROVAL_STATE_INVALID';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "client_invoice_approval_instance_guard"
BEFORE UPDATE ON "approval_instances"
FOR EACH ROW EXECUTE FUNCTION erp_client_invoice_approval_instance_guard();
