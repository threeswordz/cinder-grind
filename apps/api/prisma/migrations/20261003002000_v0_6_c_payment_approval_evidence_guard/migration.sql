-- V0.6-C forward-only approval evidence hardening.
-- Retain Payment lifecycle authority at the database boundary without editing
-- already-executed Stage-C migrations.

CREATE SEQUENCE IF NOT EXISTS "payment_approval_action_order_seq";

ALTER TABLE "approval_actions"
  ADD COLUMN IF NOT EXISTS "payment_decision_order" BIGINT;

CREATE UNIQUE INDEX IF NOT EXISTS "approval_actions_payment_decision_order_key"
  ON "approval_actions"("payment_decision_order");

CREATE OR REPLACE FUNCTION erp_payment_insert_guard()
RETURNS trigger AS $$
DECLARE
  company_base_currency TEXT;
  project_active BOOLEAN;
  counterparty_active BOOLEAN;
  creator_active BOOLEAN;
  creator_has_permission BOOLEAN;
  creator_has_project_access BOOLEAN;
BEGIN
  IF NEW."state" IS DISTINCT FROM 'DRAFT'
    OR NEW."approval_instance_id" IS NOT NULL
    OR NEW."submitted_by_user_id" IS NOT NULL
    OR NEW."approved_by_user_id" IS NOT NULL
    OR NEW."rejected_by_user_id" IS NOT NULL
    OR NEW."cancelled_by_user_id" IS NOT NULL
    OR NEW."submitted_at" IS NOT NULL
    OR NEW."decided_at" IS NOT NULL
    OR NEW."approved_at" IS NOT NULL
    OR NEW."rejected_at" IS NOT NULL
    OR NEW."rejection_reason" IS NOT NULL
    OR NEW."cancelled_at" IS NOT NULL
    OR NEW."cancellation_reason" IS NOT NULL
  THEN
    RAISE EXCEPTION 'PAYMENT_INITIAL_STATE_INVALID';
  END IF;

  IF substring(NEW."payment_number" from 4 for 4)
       <> to_char(NEW."payment_date", 'YYMM')
  THEN
    RAISE EXCEPTION 'PAYMENT_NUMBER_PERIOD_MISMATCH';
  END IF;

  SELECT c."base_currency_code"
    INTO company_base_currency
  FROM "companies" c
  WHERE c."id" = NEW."company_id";

  IF company_base_currency IS NULL
    OR NEW."currency_code" IS DISTINCT FROM company_base_currency
  THEN
    RAISE EXCEPTION 'PAYMENT_BASE_CURRENCY_INVALID';
  END IF;

  SELECT p."is_active"
    INTO project_active
  FROM "projects" p
  WHERE p."id" = NEW."project_id"
    AND p."company_id" = NEW."company_id";

  IF project_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'PAYMENT_PROJECT_INVALID';
  END IF;

  IF NEW."payment_direction" = 'INBOUND' THEN
    SELECT c."is_active"
      INTO counterparty_active
    FROM "customers" c
    WHERE c."id" = NEW."customer_id"
      AND c."company_id" = NEW."company_id";
  ELSIF NEW."supplier_id" IS NOT NULL THEN
    SELECT s."is_active"
      INTO counterparty_active
    FROM "suppliers" s
    WHERE s."id" = NEW."supplier_id"
      AND s."company_id" = NEW."company_id";
  ELSE
    SELECT s."is_active"
      INTO counterparty_active
    FROM "subcontractors" s
    WHERE s."id" = NEW."subcontractor_id"
      AND s."company_id" = NEW."company_id";
  END IF;

  IF counterparty_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'PAYMENT_COUNTERPARTY_INVALID';
  END IF;

  SELECT u."is_active"
    INTO creator_active
  FROM "users" u
  WHERE u."id" = NEW."created_by_user_id"
    AND u."company_id" = NEW."company_id";

  IF creator_active IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'PAYMENT_CREATOR_INVALID';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM "user_roles" ur
    JOIN "roles" r
      ON r."id" = ur."role_id"
     AND r."company_id" = NEW."company_id"
     AND r."is_active" = TRUE
    JOIN "role_permissions" rp
      ON rp."role_id" = r."id"
    JOIN "permissions" p
      ON p."id" = rp."permission_id"
     AND p."permission_code" = 'finance.payment.create'
    WHERE ur."company_id" = NEW."company_id"
      AND ur."user_id" = NEW."created_by_user_id"
  )
  INTO creator_has_permission;

  IF creator_has_permission IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'PAYMENT_CREATE_PERMISSION_DENIED';
  END IF;

  SELECT (
    EXISTS (
      SELECT 1
      FROM "user_roles" ur
      JOIN "roles" r
        ON r."id" = ur."role_id"
       AND r."company_id" = NEW."company_id"
       AND r."is_active" = TRUE
      JOIN "role_permissions" rp
        ON rp."role_id" = r."id"
      JOIN "permissions" p
        ON p."id" = rp."permission_id"
       AND p."permission_code" = 'projects.access_all'
      WHERE ur."company_id" = NEW."company_id"
        AND ur."user_id" = NEW."created_by_user_id"
    )
    OR EXISTS (
      SELECT 1
      FROM "users" u
      JOIN "employees" e
        ON e."id" = u."employee_id"
       AND e."company_id" = NEW."company_id"
       AND e."is_active" = TRUE
      JOIN "project_members" pm
        ON pm."employee_id" = e."id"
       AND pm."project_id" = NEW."project_id"
       AND pm."is_active" = TRUE
      WHERE u."id" = NEW."created_by_user_id"
        AND u."company_id" = NEW."company_id"
        AND u."is_active" = TRUE
    )
  )
  INTO creator_has_project_access;

  IF creator_has_project_access IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'PAYMENT_CREATE_PROJECT_ACCESS_DENIED';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "payment_insert_guard"
BEFORE INSERT ON "payments"
FOR EACH ROW EXECUTE FUNCTION erp_payment_insert_guard();


CREATE OR REPLACE FUNCTION erp_payment_approval_action_guard()
RETURNS trigger AS $$
DECLARE
  old_instance_entity_type TEXT;
  instance_entity_type TEXT;
  instance_company_id UUID;
  instance_state TEXT;
  current_step_id UUID;
  maker_user_id UUID;
  payment_project_id UUID;
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

    IF old_instance_entity_type = 'PAYMENT' THEN
      RAISE EXCEPTION 'PAYMENT_APPROVAL_ACTION_IMMUTABLE';
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

    IF old_instance_entity_type = 'PAYMENT'
      OR instance_entity_type = 'PAYMENT'
    THEN
      RAISE EXCEPTION 'PAYMENT_APPROVAL_ACTION_IMMUTABLE';
    END IF;

    RETURN NEW;
  END IF;

  SELECT "entity_type"
    INTO instance_entity_type
  FROM "approval_instances"
  WHERE "id" = NEW."approval_instance_id"
  FOR UPDATE;

  IF instance_entity_type IS DISTINCT FROM 'PAYMENT' THEN
    RETURN NEW;
  END IF;

  SELECT
    ai."company_id",
    ai."approval_state",
    aps."id",
    p."created_by_user_id",
    p."project_id"
  INTO
    instance_company_id,
    instance_state,
    current_step_id,
    maker_user_id,
    payment_project_id
  FROM "approval_instances" ai
  JOIN "payments" p
    ON p."approval_instance_id" = ai."id"
   AND p."id" = ai."entity_id"
   AND p."company_id" = ai."company_id"
  JOIN "approval_steps" aps
    ON aps."approval_workflow_id" = ai."approval_workflow_id"
   AND aps."step_no" = ai."current_step_no"
  WHERE ai."id" = NEW."approval_instance_id";

  IF instance_company_id IS NULL
    OR payment_project_id IS NULL
    OR instance_state IS DISTINCT FROM 'SUBMITTED'
    OR NEW."approval_step_id" IS DISTINCT FROM current_step_id
    OR NEW."action" NOT IN ('APPROVE','REJECT')
  THEN
    RAISE EXCEPTION 'PAYMENT_APPROVAL_ACTION_INVALID';
  END IF;

  IF NEW."action_by_user_id" IS NOT DISTINCT FROM maker_user_id THEN
    RAISE EXCEPTION 'PAYMENT_MAKER_CHECKER_VIOLATION';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "approval_actions" aa
    WHERE aa."approval_instance_id" = NEW."approval_instance_id"
      AND aa."approval_step_id" = NEW."approval_step_id"
      AND aa."action_by_user_id" = NEW."action_by_user_id"
  ) THEN
    RAISE EXCEPTION 'PAYMENT_APPROVAL_ACTION_DUPLICATE';
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
    RAISE EXCEPTION 'PAYMENT_APPROVAL_ROLE_DENIED';
  END IF;

  required_permission := CASE NEW."action"
    WHEN 'APPROVE' THEN 'finance.payment.approve'
    WHEN 'REJECT' THEN 'finance.payment.reject'
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
    RAISE EXCEPTION 'PAYMENT_APPROVAL_PERMISSION_DENIED';
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
       AND pm."project_id" = payment_project_id
       AND pm."is_active" = TRUE
      WHERE u."id" = NEW."action_by_user_id"
        AND u."company_id" = instance_company_id
        AND u."is_active" = TRUE
    )
  )
  INTO actor_has_project_access;

  IF actor_has_project_access IS DISTINCT FROM TRUE THEN
    RAISE EXCEPTION 'PAYMENT_APPROVAL_PROJECT_ACCESS_DENIED';
  END IF;

  NEW."action_at" := date_trunc('milliseconds', clock_timestamp());
  NEW."payment_decision_order" :=
    nextval('"payment_approval_action_order_seq"');

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "payment_approval_action_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "approval_actions"
FOR EACH ROW EXECUTE FUNCTION erp_payment_approval_action_guard();


CREATE OR REPLACE FUNCTION erp_payment_approval_instance_guard()
RETURNS trigger AS $$
DECLARE
  linked_payment_state TEXT;
  maker_user_id UUID;
  current_step_id UUID;
  current_required INTEGER;
  next_step_no INTEGER;
  valid_approvals INTEGER;
  valid_rejections INTEGER;
BEGIN
  IF OLD."entity_type" IS DISTINCT FROM 'PAYMENT'
    AND NEW."entity_type" IS DISTINCT FROM 'PAYMENT'
  THEN
    RETURN NEW;
  END IF;

  IF NEW."company_id" IS DISTINCT FROM OLD."company_id"
    OR NEW."approval_workflow_id" IS DISTINCT FROM OLD."approval_workflow_id"
    OR NEW."entity_type" IS DISTINCT FROM OLD."entity_type"
    OR NEW."entity_id" IS DISTINCT FROM OLD."entity_id"
    OR NEW."started_at" IS DISTINCT FROM OLD."started_at"
  THEN
    RAISE EXCEPTION 'PAYMENT_APPROVAL_INSTANCE_IDENTITY_IMMUTABLE';
  END IF;

  SELECT p."state", p."created_by_user_id"
    INTO linked_payment_state, maker_user_id
  FROM "payments" p
  WHERE p."approval_instance_id" = OLD."id"
    AND p."id" = OLD."entity_id"
    AND p."company_id" = OLD."company_id";

  IF linked_payment_state IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_APPROVAL_LINK_INVALID';
  END IF;

  IF OLD."approval_state" IN ('APPROVED','REJECTED','CANCELLED') THEN
    IF NEW."approval_state" IS DISTINCT FROM OLD."approval_state"
      OR NEW."current_step_no" IS DISTINCT FROM OLD."current_step_no"
      OR NEW."completed_at" IS DISTINCT FROM OLD."completed_at"
    THEN
      RAISE EXCEPTION 'PAYMENT_APPROVAL_INSTANCE_IMMUTABLE';
    END IF;
    RETURN NEW;
  END IF;

  IF OLD."approval_state" IS DISTINCT FROM 'SUBMITTED'
    OR linked_payment_state IS DISTINCT FROM 'SUBMITTED'
  THEN
    RAISE EXCEPTION 'PAYMENT_APPROVAL_STATE_INVALID';
  END IF;

  SELECT aps."id", aps."required_approvals"
    INTO current_step_id, current_required
  FROM "approval_steps" aps
  WHERE aps."approval_workflow_id" = OLD."approval_workflow_id"
    AND aps."step_no" = OLD."current_step_no";

  IF current_step_id IS NULL THEN
    RAISE EXCEPTION 'PAYMENT_APPROVAL_STEP_INVALID';
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
    AND aa."action_by_user_id" IS DISTINCT FROM maker_user_id
    AND aa."payment_decision_order" IS NOT NULL;

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
    AND aa."action_by_user_id" IS DISTINCT FROM maker_user_id
    AND aa."payment_decision_order" IS NOT NULL;

  IF NEW."approval_state" = 'SUBMITTED' THEN
    IF NEW."completed_at" IS NOT NULL THEN
      RAISE EXCEPTION 'PAYMENT_APPROVAL_STATE_INVALID';
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
      RAISE EXCEPTION 'PAYMENT_APPROVAL_EVIDENCE_INVALID';
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
      RAISE EXCEPTION 'PAYMENT_APPROVAL_EVIDENCE_INVALID';
    END IF;

    RETURN NEW;
  END IF;

  IF NEW."approval_state" = 'REJECTED' THEN
    IF NEW."current_step_no" IS DISTINCT FROM OLD."current_step_no"
      OR NEW."completed_at" IS NULL
      OR valid_rejections < 1
    THEN
      RAISE EXCEPTION 'PAYMENT_APPROVAL_EVIDENCE_INVALID';
    END IF;

    RETURN NEW;
  END IF;

  RAISE EXCEPTION 'PAYMENT_APPROVAL_STATE_INVALID';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "payment_approval_instance_guard"
BEFORE UPDATE ON "approval_instances"
FOR EACH ROW EXECUTE FUNCTION erp_payment_approval_instance_guard();


CREATE OR REPLACE FUNCTION erp_payment_approval_link_guard()
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
  retained_action_comment TEXT;
  actor_user_id UUID;
  required_permission TEXT;
  actor_has_permission BOOLEAN;
  actor_has_project_access BOOLEAN;
BEGIN
  IF OLD."state" = 'DRAFT' AND NEW."state" = 'SUBMITTED' THEN
    expected_state := 'SUBMITTED';
    actor_user_id := NEW."submitted_by_user_id";
    required_permission := 'finance.payment.submit';
  ELSIF OLD."state" = 'SUBMITTED' AND NEW."state" = 'APPROVED' THEN
    expected_state := 'APPROVED';
  ELSIF OLD."state" = 'SUBMITTED' AND NEW."state" = 'REJECTED' THEN
    expected_state := 'REJECTED';
  ELSIF OLD."state" = 'APPROVED' AND NEW."state" = 'CANCELLED' THEN
    actor_user_id := NEW."cancelled_by_user_id";
    required_permission := 'finance.payment.cancel';
  ELSE
    RETURN NEW;
  END IF;

  IF expected_state IS NOT NULL THEN
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
      OR instance_entity_type IS DISTINCT FROM 'PAYMENT'
      OR instance_entity_id IS DISTINCT FROM NEW."id"
      OR workflow_company_id IS DISTINCT FROM NEW."company_id"
      OR workflow_entity_type IS DISTINCT FROM 'PAYMENT'
    THEN
      RAISE EXCEPTION 'PAYMENT_APPROVAL_LINK_INVALID';
    END IF;

    IF instance_state IS DISTINCT FROM expected_state THEN
      RAISE EXCEPTION 'PAYMENT_APPROVAL_STATE_MISMATCH';
    END IF;
  END IF;

  IF required_permission IS NOT NULL THEN
    IF actor_user_id IS NULL THEN
      RAISE EXCEPTION 'PAYMENT_ACTION_ACTOR_REQUIRED';
    END IF;

    SELECT EXISTS (
      SELECT 1
      FROM "users" u
      JOIN "user_roles" ur
        ON ur."user_id" = u."id"
       AND ur."company_id" = NEW."company_id"
      JOIN "roles" r
        ON r."id" = ur."role_id"
       AND r."company_id" = NEW."company_id"
       AND r."is_active" = TRUE
      JOIN "role_permissions" rp
        ON rp."role_id" = r."id"
      JOIN "permissions" p
        ON p."id" = rp."permission_id"
       AND p."permission_code" = required_permission
      WHERE u."id" = actor_user_id
        AND u."company_id" = NEW."company_id"
        AND u."is_active" = TRUE
    )
    INTO actor_has_permission;

    IF actor_has_permission IS DISTINCT FROM TRUE THEN
      IF required_permission = 'finance.payment.submit' THEN
        RAISE EXCEPTION 'PAYMENT_SUBMIT_PERMISSION_DENIED';
      ELSE
        RAISE EXCEPTION 'PAYMENT_CANCEL_PERMISSION_DENIED';
      END IF;
    END IF;

    SELECT (
      EXISTS (
        SELECT 1
        FROM "users" u
        JOIN "user_roles" ur
          ON ur."user_id" = u."id"
         AND ur."company_id" = NEW."company_id"
        JOIN "roles" r
          ON r."id" = ur."role_id"
         AND r."company_id" = NEW."company_id"
         AND r."is_active" = TRUE
        JOIN "role_permissions" rp
          ON rp."role_id" = r."id"
        JOIN "permissions" p
          ON p."id" = rp."permission_id"
         AND p."permission_code" = 'projects.access_all'
        WHERE u."id" = actor_user_id
          AND u."company_id" = NEW."company_id"
          AND u."is_active" = TRUE
      )
      OR EXISTS (
        SELECT 1
        FROM "users" u
        JOIN "employees" e
          ON e."id" = u."employee_id"
         AND e."company_id" = NEW."company_id"
         AND e."is_active" = TRUE
        JOIN "project_members" pm
          ON pm."employee_id" = e."id"
         AND pm."project_id" = NEW."project_id"
         AND pm."is_active" = TRUE
        WHERE u."id" = actor_user_id
          AND u."company_id" = NEW."company_id"
          AND u."is_active" = TRUE
      )
    )
    INTO actor_has_project_access;

    IF actor_has_project_access IS DISTINCT FROM TRUE THEN
      IF required_permission = 'finance.payment.submit' THEN
        RAISE EXCEPTION 'PAYMENT_SUBMIT_PROJECT_ACCESS_DENIED';
      ELSE
        RAISE EXCEPTION 'PAYMENT_CANCEL_PROJECT_ACCESS_DENIED';
      END IF;
    END IF;
  END IF;

  IF expected_state IN ('APPROVED','REJECTED') THEN
    SELECT aps."id"
      INTO expected_step_id
    FROM "approval_steps" aps
    WHERE aps."approval_workflow_id" = instance_workflow_id
      AND aps."step_no" = instance_current_step_no;

    IF expected_step_id IS NULL THEN
      RAISE EXCEPTION 'PAYMENT_APPROVAL_STEP_INVALID';
    END IF;

    SELECT aa."action_by_user_id", aa."action_at", aa."comment"
      INTO retained_actor_user_id, retained_action_at, retained_action_comment
    FROM "approval_actions" aa
    WHERE aa."approval_instance_id" = NEW."approval_instance_id"
      AND aa."approval_step_id" = expected_step_id
      AND aa."action" = CASE expected_state
        WHEN 'APPROVED' THEN 'APPROVE'
        ELSE 'REJECT'
      END
      AND aa."payment_decision_order" IS NOT NULL
    ORDER BY aa."payment_decision_order" DESC
    LIMIT 1;

    IF retained_actor_user_id IS NULL OR retained_action_at IS NULL THEN
      RAISE EXCEPTION 'PAYMENT_DECISION_EVIDENCE_MISSING';
    END IF;

    IF expected_state = 'APPROVED' THEN
      IF NEW."approved_by_user_id" IS DISTINCT FROM retained_actor_user_id
        OR NEW."approved_at" IS DISTINCT FROM retained_action_at
        OR NEW."decided_at" IS DISTINCT FROM retained_action_at
      THEN
        RAISE EXCEPTION 'PAYMENT_APPROVAL_METADATA_EVIDENCE_MISMATCH';
      END IF;
    ELSE
      IF NEW."rejected_by_user_id" IS DISTINCT FROM retained_actor_user_id
        OR NEW."rejected_at" IS DISTINCT FROM retained_action_at
        OR NEW."decided_at" IS DISTINCT FROM retained_action_at
        OR NEW."rejection_reason" IS DISTINCT FROM retained_action_comment
      THEN
        RAISE EXCEPTION 'PAYMENT_REJECTION_METADATA_EVIDENCE_MISMATCH';
      END IF;
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "payment_approval_link_guard"
BEFORE UPDATE ON "payments"
FOR EACH ROW EXECUTE FUNCTION erp_payment_approval_link_guard();
