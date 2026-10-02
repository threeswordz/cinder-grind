-- V0.6-B forward-only hardening: assign a deterministic serialization order
-- to Client Invoice approval actions after the Approval Instance lock is acquired.
-- This lets final invoice decision metadata bind to the action that actually
-- crosses the workflow threshold, independent of transaction-start timestamps.

CREATE SEQUENCE IF NOT EXISTS "client_invoice_approval_action_order_seq";

ALTER TABLE "approval_actions"
  ADD COLUMN IF NOT EXISTS "client_invoice_decision_order" BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS "approval_actions_client_invoice_decision_order_key"
  ON "approval_actions"("client_invoice_decision_order");

CREATE OR REPLACE FUNCTION erp_client_invoice_approval_action_guard()
RETURNS trigger AS $$
DECLARE
  old_instance_entity_type TEXT;
  instance_entity_type TEXT;
  instance_company_id UUID;
  instance_state TEXT;
  current_step_id UUID;
  maker_user_id UUID;
  invoice_project_id UUID;
  required_permission TEXT;
  actor_authorized BOOLEAN;
  actor_has_permission BOOLEAN;
  actor_has_project_access BOOLEAN;
BEGIN
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
    ci."created_by_user_id",
    ci."project_id"
  INTO
    instance_company_id,
    instance_state,
    current_step_id,
    maker_user_id,
    invoice_project_id
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
    OR invoice_project_id IS NULL
    OR instance_state IS DISTINCT FROM 'SUBMITTED'
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

  required_permission := CASE NEW."action"
    WHEN 'APPROVE' THEN 'finance.client_invoice.approve'
    WHEN 'REJECT' THEN 'finance.client_invoice.reject'
  END;

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
    JOIN "role_permissions" rp
      ON rp."role_id" = r."id"
    JOIN "permissions" p
      ON p."id" = rp."permission_id"
     AND p."permission_code" = required_permission
    WHERE u."id" = NEW."action_by_user_id"
      AND u."company_id" = instance_company_id
      AND u."is_active" = TRUE
  )
  INTO actor_has_permission;

  IF actor_has_permission IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'CLIENT_INVOICE_APPROVAL_PERMISSION_DENIED';
  END IF;

  SELECT (
    EXISTS (
      SELECT 1
      FROM "users" u
      JOIN "user_roles" ur
        ON ur."user_id" = u."id"
       AND ur."company_id" = instance_company_id
      JOIN "roles" r
        ON r."id" = ur."role_id"
       AND r."company_id" = instance_company_id
       AND r."is_active" = TRUE
      JOIN "role_permissions" rp
        ON rp."role_id" = r."id"
      JOIN "permissions" p
        ON p."id" = rp."permission_id"
       AND p."permission_code" = 'projects.access_all'
      WHERE u."id" = NEW."action_by_user_id"
        AND u."company_id" = instance_company_id
        AND u."is_active" = TRUE
    )
    OR EXISTS (
      SELECT 1
      FROM "users" u
      JOIN "employees" e
        ON e."id" = u."employee_id"
       AND e."company_id" = instance_company_id
       AND e."is_active" = TRUE
      JOIN "project_members" pm
        ON pm."employee_id" = e."id"
       AND pm."project_id" = invoice_project_id
       AND pm."is_active" = TRUE
      WHERE u."id" = NEW."action_by_user_id"
        AND u."company_id" = instance_company_id
        AND u."is_active" = TRUE
    )
  )
  INTO actor_has_project_access;

  IF actor_has_project_access IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'CLIENT_INVOICE_APPROVAL_PROJECT_ACCESS_DENIED';
  END IF;

  -- This value is assigned only after the parent Approval Instance lock is held.
  -- It therefore reflects the actual serialized decision order rather than the
  -- transaction start time represented by PostgreSQL now().
  NEW."client_invoice_decision_order" :=
    nextval('"client_invoice_approval_action_order_seq"');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

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
      AND aa."client_invoice_decision_order" IS NOT NULL
    ORDER BY aa."client_invoice_decision_order" DESC
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
