-- V0.5-B: agreement decisions, retained versions and agreement-local Work Orders.
CREATE UNIQUE INDEX "wbs_elements_project_id_id_key" ON "wbs_elements"("project_id","id");
CREATE UNIQUE INDEX "cost_codes_company_id_id_key" ON "cost_codes"("company_id","id");
CREATE UNIQUE INDEX "subcontract_agreements_company_id_id_key" ON "subcontract_agreements"("company_id","id");
CREATE UNIQUE INDEX "subcontract_agreements_company_id_project_id_id_key" ON "subcontract_agreements"("company_id","project_id","id");

ALTER TABLE "subcontract_agreements"
  ADD COLUMN "first_approved_at" TIMESTAMPTZ(6),
  ADD COLUMN "cancelled_at" TIMESTAMPTZ(6),
  ADD COLUMN "cancelled_by_user_id" UUID,
  ADD COLUMN "cancellation_reason" TEXT,
  ADD CONSTRAINT "subcontract_agreements_cancel_user_fkey"
    FOREIGN KEY ("company_id","cancelled_by_user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "subcontract_agreements_cancel_evidence_check" CHECK (
    ("cancelled_at" IS NULL AND "cancelled_by_user_id" IS NULL AND "cancellation_reason" IS NULL)
    OR ("cancelled_at" IS NOT NULL AND "cancelled_by_user_id" IS NOT NULL
      AND length(btrim("cancellation_reason")) > 0 AND "approval_state" = 'CANCELLED')
  );

CREATE TABLE "subcontract_agreement_versions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "agreement_id" UUID NOT NULL,
  "version_no" INTEGER NOT NULL,
  "approval_state" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  "original_value" DECIMAL(18,2) NOT NULL,
  "scope_of_work" TEXT NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL,
  "operational_status_id" UUID,
  "reason" TEXT,
  "approval_instance_id" UUID UNIQUE,
  "created_by_user_id" UUID NOT NULL,
  "submitted_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_at" TIMESTAMPTZ(6),
  "decided_at" TIMESTAMPTZ(6),
  CONSTRAINT "agreement_versions_number_key" UNIQUE ("agreement_id","version_no"),
  CONSTRAINT "agreement_versions_version_check" CHECK ("version_no" > 0),
  CONSTRAINT "agreement_versions_state_check" CHECK ("approval_state" IN ('DRAFT','SUBMITTED','APPROVED','REJECTED')),
  CONSTRAINT "agreement_versions_scope_check" CHECK (length(btrim("scope_of_work")) > 0),
  CONSTRAINT "agreement_versions_value_check" CHECK ("original_value" >= 0),
  CONSTRAINT "agreement_versions_currency_check" CHECK ("currency_code" ~ '^[A-Z]{3}$'),
  CONSTRAINT "agreement_versions_reason_check" CHECK ("version_no" = 1 OR length(btrim("reason")) > 0),
  CONSTRAINT "agreement_versions_submission_check" CHECK (
    ("approval_state" = 'DRAFT' AND "approval_instance_id" IS NULL AND "submitted_at" IS NULL AND "submitted_by_user_id" IS NULL)
    OR ("approval_state" <> 'DRAFT' AND "approval_instance_id" IS NOT NULL AND "submitted_at" IS NOT NULL AND "submitted_by_user_id" IS NOT NULL)
  ),
  CONSTRAINT "agreement_versions_company_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT,
  CONSTRAINT "agreement_versions_project_fkey" FOREIGN KEY ("company_id","project_id") REFERENCES "projects"("company_id","id") ON DELETE RESTRICT,
  CONSTRAINT "agreement_versions_agreement_fkey" FOREIGN KEY ("company_id","project_id","agreement_id") REFERENCES "subcontract_agreements"("company_id","project_id","id") ON DELETE RESTRICT,
  CONSTRAINT "agreement_versions_status_fkey" FOREIGN KEY ("company_id","operational_status_id") REFERENCES "status_definitions"("company_id","id") ON DELETE RESTRICT,
  CONSTRAINT "agreement_versions_approval_fkey" FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE RESTRICT,
  CONSTRAINT "agreement_versions_creator_fkey" FOREIGN KEY ("company_id","created_by_user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT,
  CONSTRAINT "agreement_versions_submitter_fkey" FOREIGN KEY ("company_id","submitted_by_user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT
);
CREATE INDEX "agreement_versions_scope_idx" ON "subcontract_agreement_versions"("company_id","project_id","agreement_id");

CREATE TABLE "subcontract_work_orders" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "agreement_id" UUID NOT NULL,
  "sequence_no" INTEGER NOT NULL,
  "work_order_number" VARCHAR(30) NOT NULL,
  "scope_of_work" TEXT NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "wbs_element_id" UUID,
  "cost_code_id" UUID,
  "approval_state" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  "approval_instance_id" UUID UNIQUE,
  "created_by_user_id" UUID NOT NULL,
  "submitted_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_at" TIMESTAMPTZ(6),
  "decided_at" TIMESTAMPTZ(6),
  CONSTRAINT "work_orders_sequence_key" UNIQUE ("agreement_id","sequence_no"),
  CONSTRAINT "work_orders_number_key" UNIQUE ("agreement_id","work_order_number"),
  CONSTRAINT "work_orders_number_check" CHECK ("sequence_no" BETWEEN 1 AND 999 AND "work_order_number" = 'WO-' || lpad("sequence_no"::text, 3, '0')),
  CONSTRAINT "work_orders_scope_check" CHECK (length(btrim("scope_of_work")) > 0),
  CONSTRAINT "work_orders_amount_check" CHECK ("amount" > 0),
  CONSTRAINT "work_orders_state_check" CHECK ("approval_state" IN ('DRAFT','SUBMITTED','APPROVED','REJECTED')),
  CONSTRAINT "work_orders_submission_check" CHECK (
    ("approval_state" = 'DRAFT' AND "approval_instance_id" IS NULL AND "submitted_at" IS NULL AND "submitted_by_user_id" IS NULL)
    OR ("approval_state" <> 'DRAFT' AND "approval_instance_id" IS NOT NULL AND "submitted_at" IS NOT NULL AND "submitted_by_user_id" IS NOT NULL)
  ),
  CONSTRAINT "work_orders_company_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT,
  CONSTRAINT "work_orders_project_fkey" FOREIGN KEY ("company_id","project_id") REFERENCES "projects"("company_id","id") ON DELETE RESTRICT,
  CONSTRAINT "work_orders_agreement_fkey" FOREIGN KEY ("company_id","project_id","agreement_id") REFERENCES "subcontract_agreements"("company_id","project_id","id") ON DELETE RESTRICT,
  CONSTRAINT "work_orders_wbs_fkey" FOREIGN KEY ("project_id","wbs_element_id") REFERENCES "wbs_elements"("project_id","id") ON DELETE RESTRICT,
  CONSTRAINT "work_orders_cost_fkey" FOREIGN KEY ("company_id","cost_code_id") REFERENCES "cost_codes"("company_id","id") ON DELETE RESTRICT,
  CONSTRAINT "work_orders_approval_fkey" FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE RESTRICT,
  CONSTRAINT "work_orders_creator_fkey" FOREIGN KEY ("company_id","created_by_user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT,
  CONSTRAINT "work_orders_submitter_fkey" FOREIGN KEY ("company_id","submitted_by_user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT
);
CREATE INDEX "work_orders_scope_idx" ON "subcontract_work_orders"("company_id","project_id","agreement_id","approval_state");
CREATE INDEX "work_orders_wbs_idx" ON "subcontract_work_orders"("wbs_element_id");
CREATE INDEX "work_orders_cost_idx" ON "subcontract_work_orders"("cost_code_id");
CREATE TABLE "subcontract_action_replays" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid() PRIMARY KEY,
  "company_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "action_key" VARCHAR(120) NOT NULL,
  "action_type" VARCHAR(60) NOT NULL,
  "entity_type" VARCHAR(60) NOT NULL,
  "entity_id" UUID NOT NULL,
  "payload_hash" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subcontract_action_replays_actor_key" UNIQUE ("company_id","user_id","action_key"),
  CONSTRAINT "subcontract_action_replays_key_check" CHECK (length(btrim("action_key")) > 0),
  CONSTRAINT "subcontract_action_replays_action_check" CHECK (length(btrim("action_type")) > 0),
  CONSTRAINT "subcontract_action_replays_entity_check" CHECK (length(btrim("entity_type")) > 0),
  CONSTRAINT "subcontract_action_replays_hash_check" CHECK ("payload_hash" ~ '^[0-9a-f]{64}

CREATE FUNCTION protect_v05b_agreement() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Agreement history cannot be deleted'; END IF;
  IF OLD."approval_state" <> 'DRAFT' AND (
    NEW."original_value" <> OLD."original_value" OR NEW."scope_of_work" <> OLD."scope_of_work"
    OR NEW."currency_code" <> OLD."currency_code"
  ) THEN RAISE EXCEPTION 'Submitted agreement commercial fields are immutable'; END IF;
  IF OLD."first_approved_at" IS NOT NULL AND NEW."first_approved_at" IS DISTINCT FROM OLD."first_approved_at"
  THEN RAISE EXCEPTION 'First approval timestamp is immutable'; END IF;
  IF OLD."approval_state" = 'CANCELLED' AND NEW IS DISTINCT FROM OLD
  THEN RAISE EXCEPTION 'Cancelled agreement is immutable'; END IF;
  IF NEW."approval_state" <> OLD."approval_state" AND NOT (
    (OLD."approval_state" = 'DRAFT' AND NEW."approval_state" = 'SUBMITTED')
    OR (OLD."approval_state" = 'SUBMITTED' AND NEW."approval_state" IN ('APPROVED','REJECTED'))
    OR (OLD."approval_state" = 'APPROVED' AND NEW."approval_state" = 'CANCELLED')
  ) THEN RAISE EXCEPTION 'Invalid agreement lifecycle transition'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER subcontract_agreements_v05b_guard BEFORE UPDATE ON "subcontract_agreements"
FOR EACH ROW EXECUTE FUNCTION protect_v05b_agreement();

CREATE FUNCTION protect_v05b_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Agreement version history cannot be deleted'; END IF;
  IF NEW."id" <> OLD."id" OR NEW."company_id" <> OLD."company_id"
    OR NEW."project_id" <> OLD."project_id" OR NEW."agreement_id" <> OLD."agreement_id"
    OR NEW."version_no" <> OLD."version_no" OR NEW."created_by_user_id" <> OLD."created_by_user_id"
    OR NEW."created_at" <> OLD."created_at" OR NEW."original_value" <> OLD."original_value"
    OR NEW."scope_of_work" <> OLD."scope_of_work" OR NEW."currency_code" <> OLD."currency_code"
  THEN RAISE EXCEPTION 'Agreement version identity and commercial snapshot are immutable'; END IF;
  IF OLD."approval_state" <> 'DRAFT' AND (
    NEW."operational_status_id" IS DISTINCT FROM OLD."operational_status_id"
    OR NEW."reason" IS DISTINCT FROM OLD."reason"
    OR NEW."approval_instance_id" IS DISTINCT FROM OLD."approval_instance_id"
    OR NEW."submitted_at" IS DISTINCT FROM OLD."submitted_at"
    OR NEW."submitted_by_user_id" IS DISTINCT FROM OLD."submitted_by_user_id"
  ) THEN RAISE EXCEPTION 'Submitted agreement version is immutable'; END IF;
  IF OLD."approval_state" IN ('APPROVED','REJECTED') AND NEW IS DISTINCT FROM OLD
  THEN RAISE EXCEPTION 'Decided agreement version is immutable'; END IF;
  IF NEW."approval_state" <> OLD."approval_state" AND NOT (
    (OLD."approval_state" = 'DRAFT' AND NEW."approval_state" = 'SUBMITTED')
    OR (OLD."approval_state" = 'SUBMITTED' AND NEW."approval_state" IN ('APPROVED','REJECTED'))
  ) THEN RAISE EXCEPTION 'Invalid agreement version transition'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER agreement_versions_guard BEFORE UPDATE OR DELETE ON "subcontract_agreement_versions"
FOR EACH ROW EXECUTE FUNCTION protect_v05b_version();

CREATE FUNCTION protect_v05b_work_order() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Work Order history cannot be deleted'; END IF;
  IF NEW."id" <> OLD."id" OR NEW."company_id" <> OLD."company_id" OR NEW."project_id" <> OLD."project_id"
    OR NEW."agreement_id" <> OLD."agreement_id" OR NEW."sequence_no" <> OLD."sequence_no"
    OR NEW."work_order_number" <> OLD."work_order_number" OR NEW."created_by_user_id" <> OLD."created_by_user_id"
    OR NEW."created_at" <> OLD."created_at"
  THEN RAISE EXCEPTION 'Work Order identity is immutable'; END IF;
  IF OLD."approval_state" <> 'DRAFT' AND (
    NEW."scope_of_work" <> OLD."scope_of_work" OR NEW."amount" <> OLD."amount"
    OR NEW."wbs_element_id" IS DISTINCT FROM OLD."wbs_element_id"
    OR NEW."cost_code_id" IS DISTINCT FROM OLD."cost_code_id"
    OR NEW."approval_instance_id" IS DISTINCT FROM OLD."approval_instance_id"
    OR NEW."submitted_by_user_id" IS DISTINCT FROM OLD."submitted_by_user_id"
    OR NEW."submitted_at" IS DISTINCT FROM OLD."submitted_at"
  ) THEN RAISE EXCEPTION 'Submitted Work Order content is immutable'; END IF;
  IF OLD."approval_state" IN ('APPROVED','REJECTED') AND NEW IS DISTINCT FROM OLD
  THEN RAISE EXCEPTION 'Decided Work Order is immutable'; END IF;
  IF NEW."approval_state" <> OLD."approval_state" AND NOT (
    (OLD."approval_state" = 'DRAFT' AND NEW."approval_state" = 'SUBMITTED')
    OR (OLD."approval_state" = 'SUBMITTED' AND NEW."approval_state" IN ('APPROVED','REJECTED'))
  ) THEN RAISE EXCEPTION 'Invalid Work Order transition'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER work_orders_guard BEFORE UPDATE OR DELETE ON "subcontract_work_orders"
FOR EACH ROW EXECUTE FUNCTION protect_v05b_work_order();
),
  CONSTRAINT "subcontract_action_replays_company_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT,
  CONSTRAINT "subcontract_action_replays_user_fkey" FOREIGN KEY ("company_id","user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT
);
CREATE INDEX "subcontract_action_replays_entity_idx" ON "subcontract_action_replays"("company_id","entity_type","entity_id");


CREATE FUNCTION protect_v05b_agreement() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Agreement history cannot be deleted'; END IF;
  IF OLD."approval_state" <> 'DRAFT' AND (
    NEW."original_value" <> OLD."original_value" OR NEW."scope_of_work" <> OLD."scope_of_work"
    OR NEW."currency_code" <> OLD."currency_code"
  ) THEN RAISE EXCEPTION 'Submitted agreement commercial fields are immutable'; END IF;
  IF OLD."first_approved_at" IS NOT NULL AND NEW."first_approved_at" IS DISTINCT FROM OLD."first_approved_at"
  THEN RAISE EXCEPTION 'First approval timestamp is immutable'; END IF;
  IF OLD."approval_state" = 'CANCELLED' AND NEW IS DISTINCT FROM OLD
  THEN RAISE EXCEPTION 'Cancelled agreement is immutable'; END IF;
  IF NEW."approval_state" <> OLD."approval_state" AND NOT (
    (OLD."approval_state" = 'DRAFT' AND NEW."approval_state" = 'SUBMITTED')
    OR (OLD."approval_state" = 'SUBMITTED' AND NEW."approval_state" IN ('APPROVED','REJECTED'))
    OR (OLD."approval_state" = 'APPROVED' AND NEW."approval_state" = 'CANCELLED')
  ) THEN RAISE EXCEPTION 'Invalid agreement lifecycle transition'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER subcontract_agreements_v05b_guard BEFORE UPDATE ON "subcontract_agreements"
FOR EACH ROW EXECUTE FUNCTION protect_v05b_agreement();

CREATE FUNCTION protect_v05b_version() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Agreement version history cannot be deleted'; END IF;
  IF NEW."id" <> OLD."id" OR NEW."company_id" <> OLD."company_id"
    OR NEW."project_id" <> OLD."project_id" OR NEW."agreement_id" <> OLD."agreement_id"
    OR NEW."version_no" <> OLD."version_no" OR NEW."created_by_user_id" <> OLD."created_by_user_id"
    OR NEW."created_at" <> OLD."created_at" OR NEW."original_value" <> OLD."original_value"
    OR NEW."scope_of_work" <> OLD."scope_of_work" OR NEW."currency_code" <> OLD."currency_code"
  THEN RAISE EXCEPTION 'Agreement version identity and commercial snapshot are immutable'; END IF;
  IF OLD."approval_state" <> 'DRAFT' AND (
    NEW."operational_status_id" IS DISTINCT FROM OLD."operational_status_id"
    OR NEW."reason" IS DISTINCT FROM OLD."reason"
    OR NEW."approval_instance_id" IS DISTINCT FROM OLD."approval_instance_id"
    OR NEW."submitted_at" IS DISTINCT FROM OLD."submitted_at"
    OR NEW."submitted_by_user_id" IS DISTINCT FROM OLD."submitted_by_user_id"
  ) THEN RAISE EXCEPTION 'Submitted agreement version is immutable'; END IF;
  IF OLD."approval_state" IN ('APPROVED','REJECTED') AND NEW IS DISTINCT FROM OLD
  THEN RAISE EXCEPTION 'Decided agreement version is immutable'; END IF;
  IF NEW."approval_state" <> OLD."approval_state" AND NOT (
    (OLD."approval_state" = 'DRAFT' AND NEW."approval_state" = 'SUBMITTED')
    OR (OLD."approval_state" = 'SUBMITTED' AND NEW."approval_state" IN ('APPROVED','REJECTED'))
  ) THEN RAISE EXCEPTION 'Invalid agreement version transition'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER agreement_versions_guard BEFORE UPDATE OR DELETE ON "subcontract_agreement_versions"
FOR EACH ROW EXECUTE FUNCTION protect_v05b_version();

CREATE FUNCTION protect_v05b_work_order() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Work Order history cannot be deleted'; END IF;
  IF NEW."id" <> OLD."id" OR NEW."company_id" <> OLD."company_id" OR NEW."project_id" <> OLD."project_id"
    OR NEW."agreement_id" <> OLD."agreement_id" OR NEW."sequence_no" <> OLD."sequence_no"
    OR NEW."work_order_number" <> OLD."work_order_number" OR NEW."created_by_user_id" <> OLD."created_by_user_id"
    OR NEW."created_at" <> OLD."created_at"
  THEN RAISE EXCEPTION 'Work Order identity is immutable'; END IF;
  IF OLD."approval_state" <> 'DRAFT' AND (
    NEW."scope_of_work" <> OLD."scope_of_work" OR NEW."amount" <> OLD."amount"
    OR NEW."wbs_element_id" IS DISTINCT FROM OLD."wbs_element_id"
    OR NEW."cost_code_id" IS DISTINCT FROM OLD."cost_code_id"
    OR NEW."approval_instance_id" IS DISTINCT FROM OLD."approval_instance_id"
    OR NEW."submitted_by_user_id" IS DISTINCT FROM OLD."submitted_by_user_id"
    OR NEW."submitted_at" IS DISTINCT FROM OLD."submitted_at"
  ) THEN RAISE EXCEPTION 'Submitted Work Order content is immutable'; END IF;
  IF OLD."approval_state" IN ('APPROVED','REJECTED') AND NEW IS DISTINCT FROM OLD
  THEN RAISE EXCEPTION 'Decided Work Order is immutable'; END IF;
  IF NEW."approval_state" <> OLD."approval_state" AND NOT (
    (OLD."approval_state" = 'DRAFT' AND NEW."approval_state" = 'SUBMITTED')
    OR (OLD."approval_state" = 'SUBMITTED' AND NEW."approval_state" IN ('APPROVED','REJECTED'))
  ) THEN RAISE EXCEPTION 'Invalid Work Order transition'; END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER work_orders_guard BEFORE UPDATE OR DELETE ON "subcontract_work_orders"
FOR EACH ROW EXECUTE FUNCTION protect_v05b_work_order();


CREATE FUNCTION protect_v05b_action_replay() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Subcontract action retry evidence cannot be deleted';
  END IF;
  IF NEW IS DISTINCT FROM OLD THEN
    RAISE EXCEPTION 'Subcontract action retry evidence is immutable';
  END IF;
  RETURN NEW;
END $$;
CREATE TRIGGER subcontract_action_replays_guard
BEFORE UPDATE OR DELETE ON "subcontract_action_replays"
FOR EACH ROW EXECUTE FUNCTION protect_v05b_action_replay();
