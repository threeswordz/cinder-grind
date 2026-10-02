-- V0.6-B forward-only hardening for approval-action reassignment and decision races.
-- This replaces only the Client Invoice approval-action guard introduced by the
-- prior forward migration; no executed migration is edited.

CREATE OR REPLACE FUNCTION erp_client_invoice_approval_action_guard()
RETURNS trigger AS $$
DECLARE
  old_instance_entity_type TEXT;
  instance_entity_type TEXT;
  instance_company_id UUID;
  instance_state TEXT;
  current_step_id UUID;
  maker_user_id UUID;
  actor_authorized BOOLEAN;
BEGIN
  -- Retained Client Invoice approval evidence is immutable. An UPDATE is
  -- rejected when either its source or destination belongs to a Client Invoice,
  -- preventing a non-Client-Invoice action from being re-parented into one.
  IF TG_OP = 'DELETE' THEN
    SELECT "entity_type"
      INTO old_instance_entity_type
    FROM "approval_instances"
    WHERE "id" = OLD."approval_instance_id";

    IF old_instance_entity_type = 'CLIENT_INVOICE' THEN
      RAISE EXCEPTION 'CLIENT_INVOICE_APPROVAL_ACTION_IMMUTABLE';
    END IF;

    RETURN OLD;
  END IF;

  IF TG_OP = 'UPDATE' THEN
    SELECT "entity_type"
      INTO old_instance_entity_type
    FROM "approval_instances"
    WHERE "id" = OLD."approval_instance_id";

    SELECT "entity_type"
      INTO instance_entity_type
    FROM "approval_instances"
    WHERE "id" = NEW."approval_instance_id";

    IF old_instance_entity_type = 'CLIENT_INVOICE'
      OR instance_entity_type = 'CLIENT_INVOICE'
    THEN
      RAISE EXCEPTION 'CLIENT_INVOICE_APPROVAL_ACTION_IMMUTABLE';
    END IF;

    RETURN NEW;
  END IF;

  -- Serialize all direct decisions for one Client Invoice Approval Instance.
  -- A waiter cannot pass the duplicate/evidence checks until the prior decision
  -- transaction commits or rolls back.
  SELECT "entity_type"
    INTO instance_entity_type
  FROM "approval_instances"
  WHERE "id" = NEW."approval_instance_id"
  FOR UPDATE;

  IF instance_entity_type IS DISTINCT FROM 'CLIENT_INVOICE' THEN
    RETURN NEW;
  END IF;

  SELECT
    ai."company_id",
    ai."approval_state",
    aps."id",
    ci."created_by_user_id"
  INTO
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

  IF instance_company_id IS NULL
    OR instance_state IS DISTINCT FROM 'SUBMITTED'
    OR NEW."approval_step_id" IS DISTINCT FROM current_step_id
    OR NEW."action" NOT IN ('APPROVE','REJECT')
  THEN
    RAISE EXCEPTION 'CLIENT_INVOICE_APPROVAL_ACTION_INVALID';
  END IF;

  IF NEW."action_by_user_id" IS NOT DISTINCT FROM maker_user_id THEN
    RAISE EXCEPTION 'CLIENT_INVOICE_MAKER_CHECKER_VIOLATION';
  END IF;

  -- Because the parent Approval Instance is locked above, this test is
  -- race-safe even when competing transactions use different action values.
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
