-- V0.7-B Direct Cost Posting.
-- Forward-only: do not modify prior executed migrations.

CREATE TABLE "direct_cost_postings" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "wbs_id" UUID,
  "cost_code_id" UUID NOT NULL,
  "posting_date" DATE NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "reference" VARCHAR(200),
  "amount" DECIMAL(18,2) NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL,
  "state" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  "approval_instance_id" UUID,
  "reverses_posting_id" UUID,
  "reversal_reason" TEXT,
  "create_key" VARCHAR(120) NOT NULL,
  "create_payload_hash" VARCHAR(64) NOT NULL,
  "created_by_user_id" UUID NOT NULL,
  "submitted_by_user_id" UUID,
  "approved_by_user_id" UUID,
  "rejected_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_at" TIMESTAMPTZ(6),
  "decided_at" TIMESTAMPTZ(6),
  "approved_at" TIMESTAMPTZ(6),
  "rejected_at" TIMESTAMPTZ(6),
  "rejection_reason" TEXT,
  CONSTRAINT "direct_cost_postings_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "direct_cost_postings_amount_nonzero" CHECK ("amount" <> 0),
  CONSTRAINT "direct_cost_postings_state_check" CHECK ("state" IN ('DRAFT','SUBMITTED','APPROVED','REJECTED'))
);

CREATE UNIQUE INDEX "direct_cost_postings_approval_instance_id_key"
  ON "direct_cost_postings"("approval_instance_id");
CREATE UNIQUE INDEX "direct_cost_postings_creator_create_key_key"
  ON "direct_cost_postings"("company_id","created_by_user_id","create_key");
CREATE INDEX "direct_cost_postings_company_project_state_date_idx"
  ON "direct_cost_postings"("company_id","project_id","state","posting_date");
CREATE INDEX "direct_cost_postings_company_project_dimension_idx"
  ON "direct_cost_postings"("company_id","project_id","wbs_id","cost_code_id");
CREATE INDEX "direct_cost_postings_reverses_posting_idx"
  ON "direct_cost_postings"("reverses_posting_id");
CREATE UNIQUE INDEX "direct_cost_postings_active_reversal_key"
  ON "direct_cost_postings"("reverses_posting_id")
  WHERE "reverses_posting_id" IS NOT NULL
    AND "state" IN ('DRAFT','SUBMITTED','APPROVED');

CREATE TABLE "cost_action_replays" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "action_key" VARCHAR(120) NOT NULL,
  "action_type" VARCHAR(80) NOT NULL,
  "entity_type" VARCHAR(100) NOT NULL,
  "entity_id" UUID NOT NULL,
  "payload_hash" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "cost_action_replays_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "cost_action_replays_company_user_key"
  ON "cost_action_replays"("company_id","user_id","action_key");
CREATE INDEX "cost_action_replays_entity_idx"
  ON "cost_action_replays"("company_id","entity_type","entity_id");

ALTER TABLE "direct_cost_postings"
  ADD CONSTRAINT "direct_cost_postings_company_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "direct_cost_postings_project_fkey"
  FOREIGN KEY ("company_id","project_id") REFERENCES "projects"("company_id","id") ON DELETE RESTRICT,
  ADD CONSTRAINT "direct_cost_postings_wbs_fkey"
  FOREIGN KEY ("project_id","wbs_id") REFERENCES "wbs_elements"("project_id","id") ON DELETE RESTRICT,
  ADD CONSTRAINT "direct_cost_postings_cost_code_fkey"
  FOREIGN KEY ("company_id","cost_code_id") REFERENCES "cost_codes"("company_id","id") ON DELETE RESTRICT,
  ADD CONSTRAINT "direct_cost_postings_approval_fkey"
  FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "direct_cost_postings_reversal_fkey"
  FOREIGN KEY ("reverses_posting_id") REFERENCES "direct_cost_postings"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "direct_cost_postings_creator_fkey"
  FOREIGN KEY ("company_id","created_by_user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT,
  ADD CONSTRAINT "direct_cost_postings_submitter_fkey"
  FOREIGN KEY ("company_id","submitted_by_user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT,
  ADD CONSTRAINT "direct_cost_postings_approver_fkey"
  FOREIGN KEY ("company_id","approved_by_user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT,
  ADD CONSTRAINT "direct_cost_postings_rejector_fkey"
  FOREIGN KEY ("company_id","rejected_by_user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT;

ALTER TABLE "cost_action_replays"
  ADD CONSTRAINT "cost_action_replays_company_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "cost_action_replays_user_fkey"
  FOREIGN KEY ("company_id","user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT;

INSERT INTO "permissions" ("id","permission_code","module_code","description")
VALUES
  (gen_random_uuid(),'cost.direct_posting.create','COST_CONTROL','Create, maintain and initiate linked reversal Direct Cost Posting drafts within authorized Projects'),
  (gen_random_uuid(),'cost.direct_posting.submit','COST_CONTROL','Submit authorized Direct Cost Postings for configured approval'),
  (gen_random_uuid(),'cost.direct_posting.approve','COST_CONTROL','Approve or reject Direct Cost Postings when also authorized by the Approval Matrix')
ON CONFLICT ("permission_code") DO NOTHING;

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
  approval_state TEXT;
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
    SELECT "company_id","entity_type","entity_id","approval_state"
      INTO approval_company,approval_entity_type,approval_entity_id,approval_state
    FROM "approval_instances"
    WHERE "id" = NEW."approval_instance_id";
    IF approval_company IS NULL
       OR approval_company <> NEW."company_id"
       OR approval_entity_type <> 'DIRECT_COST_POSTING'
       OR approval_entity_id <> NEW."id" THEN
      RAISE EXCEPTION 'DIRECT_COST_APPROVAL_BINDING_INVALID';
    END IF;
    IF NEW."state" = 'SUBMITTED' AND approval_state <> 'SUBMITTED' THEN
      RAISE EXCEPTION 'DIRECT_COST_APPROVAL_STATE_INVALID';
    ELSIF NEW."state" = 'APPROVED' AND (
      approval_state <> 'APPROVED'
      OR NEW."approved_by_user_id" IS NULL
      OR NEW."approved_at" IS NULL
      OR NEW."decided_at" IS NULL
    ) THEN
      RAISE EXCEPTION 'DIRECT_COST_APPROVAL_EVIDENCE_INVALID';
    ELSIF NEW."state" = 'REJECTED' AND (
      approval_state <> 'REJECTED'
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

CREATE TRIGGER "direct_cost_scope_guard"
BEFORE INSERT OR UPDATE ON "direct_cost_postings"
FOR EACH ROW EXECUTE FUNCTION erp_direct_cost_scope_guard();

CREATE OR REPLACE FUNCTION erp_direct_cost_history_guard()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'DIRECT_COST_HISTORY_IMMUTABLE';
  END IF;

  IF NEW."company_id" IS DISTINCT FROM OLD."company_id"
     OR NEW."project_id" IS DISTINCT FROM OLD."project_id"
     OR NEW."created_by_user_id" IS DISTINCT FROM OLD."created_by_user_id"
     OR NEW."create_key" IS DISTINCT FROM OLD."create_key"
     OR NEW."create_payload_hash" IS DISTINCT FROM OLD."create_payload_hash"
     OR NEW."reverses_posting_id" IS DISTINCT FROM OLD."reverses_posting_id"
     OR NEW."reversal_reason" IS DISTINCT FROM OLD."reversal_reason" THEN
    RAISE EXCEPTION 'DIRECT_COST_IDENTITY_IMMUTABLE';
  END IF;

  IF OLD."state" <> 'DRAFT' AND (
       NEW."wbs_id" IS DISTINCT FROM OLD."wbs_id"
    OR NEW."cost_code_id" IS DISTINCT FROM OLD."cost_code_id"
    OR NEW."posting_date" IS DISTINCT FROM OLD."posting_date"
    OR NEW."description" IS DISTINCT FROM OLD."description"
    OR NEW."reference" IS DISTINCT FROM OLD."reference"
    OR NEW."amount" IS DISTINCT FROM OLD."amount"
    OR NEW."currency_code" IS DISTINCT FROM OLD."currency_code"
  ) THEN
    RAISE EXCEPTION 'DIRECT_COST_HISTORY_IMMUTABLE';
  END IF;

  IF OLD."state" = 'DRAFT' AND NEW."state" NOT IN ('DRAFT','SUBMITTED') THEN
    RAISE EXCEPTION 'DIRECT_COST_STATE_TRANSITION_INVALID';
  ELSIF OLD."state" = 'SUBMITTED' AND NEW."state" NOT IN ('SUBMITTED','APPROVED','REJECTED') THEN
    RAISE EXCEPTION 'DIRECT_COST_STATE_TRANSITION_INVALID';
  ELSIF OLD."state" IN ('APPROVED','REJECTED') AND NEW."state" <> OLD."state" THEN
    RAISE EXCEPTION 'DIRECT_COST_STATE_TRANSITION_INVALID';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "direct_cost_history_guard"
BEFORE UPDATE OR DELETE ON "direct_cost_postings"
FOR EACH ROW EXECUTE FUNCTION erp_direct_cost_history_guard();
