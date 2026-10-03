-- V0.7-D Project Variation persistence foundation.
-- Forward-only: approved revenue/profit totals remain derived and are not persisted.

CREATE SEQUENCE IF NOT EXISTS "project_variation_approval_action_order_seq";

ALTER TABLE "approval_actions"
  ADD COLUMN IF NOT EXISTS "project_variation_decision_order" BIGINT;
CREATE UNIQUE INDEX IF NOT EXISTS "approval_actions_project_variation_decision_order_key"
  ON "approval_actions"("project_variation_decision_order");

CREATE TABLE "project_variations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "variation_number" VARCHAR(120) NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "reason" TEXT,
  "value_delta" DECIMAL(18,2) NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL,
  "state" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  "approval_instance_id" UUID,
  "reverses_variation_id" UUID,
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
  CONSTRAINT "project_variations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "project_variations_value_nonzero" CHECK ("value_delta" <> 0),
  CONSTRAINT "project_variations_number_nonempty" CHECK (NULLIF(BTRIM("variation_number"), '') IS NOT NULL),
  CONSTRAINT "project_variations_description_nonempty" CHECK (NULLIF(BTRIM("description"), '') IS NOT NULL),
  CONSTRAINT "project_variations_state_check" CHECK ("state" IN ('DRAFT','SUBMITTED','APPROVED','REJECTED')),
  CONSTRAINT "project_variations_company_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT,
  CONSTRAINT "project_variations_project_fkey" FOREIGN KEY ("company_id","project_id") REFERENCES "projects"("company_id","id") ON DELETE RESTRICT,
  CONSTRAINT "project_variations_approval_fkey" FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE RESTRICT,
  CONSTRAINT "project_variations_reversal_fkey" FOREIGN KEY ("reverses_variation_id") REFERENCES "project_variations"("id") ON DELETE RESTRICT,
  CONSTRAINT "project_variations_creator_fkey" FOREIGN KEY ("company_id","created_by_user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT,
  CONSTRAINT "project_variations_submitter_fkey" FOREIGN KEY ("company_id","submitted_by_user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT,
  CONSTRAINT "project_variations_approver_fkey" FOREIGN KEY ("company_id","approved_by_user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT,
  CONSTRAINT "project_variations_rejector_fkey" FOREIGN KEY ("company_id","rejected_by_user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT
);

CREATE UNIQUE INDEX "project_variations_approval_instance_id_key" ON "project_variations"("approval_instance_id");
CREATE UNIQUE INDEX "project_variations_project_number_key" ON "project_variations"("company_id","project_id","variation_number");
CREATE UNIQUE INDEX "project_variations_creator_create_key_key" ON "project_variations"("company_id","created_by_user_id","create_key");
CREATE INDEX "project_variations_company_project_state_approved_idx" ON "project_variations"("company_id","project_id","state","approved_at");
CREATE INDEX "project_variations_reverses_variation_idx" ON "project_variations"("reverses_variation_id");
CREATE UNIQUE INDEX "project_variations_active_reversal_key"
  ON "project_variations"("reverses_variation_id")
  WHERE "reverses_variation_id" IS NOT NULL AND "state" IN ('DRAFT','SUBMITTED','APPROVED');

INSERT INTO "permissions" ("id","permission_code","module_code","description")
VALUES
  (gen_random_uuid(),'cost.variation.view','COST_CONTROL','View authorized Project Variation source records within effective Project scope'),
  (gen_random_uuid(),'cost.variation.create','COST_CONTROL','Create and maintain Project Variation drafts and linked compensating reversals within authorized Projects'),
  (gen_random_uuid(),'cost.variation.submit','COST_CONTROL','Submit authorized Project Variations for configured approval'),
  (gen_random_uuid(),'cost.variation.approve','COST_CONTROL','Approve or reject Project Variations when also authorized by the Approval Matrix')
ON CONFLICT ("permission_code") DO NOTHING;

CREATE OR REPLACE FUNCTION erp_project_variation_row_guard()
RETURNS trigger AS $$
DECLARE
  original_row project_variations%ROWTYPE;
  project_active BOOLEAN;
  base_currency TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'PROJECT_VARIATION_HISTORY_IMMUTABLE';
  END IF;

  IF TG_OP = 'INSERT' THEN
    SELECT p."is_active", c."base_currency_code"
      INTO project_active, base_currency
    FROM "projects" p JOIN "companies" c ON c."id" = p."company_id"
    WHERE p."id" = NEW."project_id" AND p."company_id" = NEW."company_id"
    FOR UPDATE OF p;
    IF project_active IS NULL THEN RAISE EXCEPTION 'PROJECT_VARIATION_PROJECT_INVALID'; END IF;
    IF NEW."state" <> 'DRAFT'
       OR NEW."approval_instance_id" IS NOT NULL
       OR NEW."submitted_by_user_id" IS NOT NULL
       OR NEW."approved_by_user_id" IS NOT NULL
       OR NEW."rejected_by_user_id" IS NOT NULL
       OR NEW."submitted_at" IS NOT NULL
       OR NEW."decided_at" IS NOT NULL
       OR NEW."approved_at" IS NOT NULL
       OR NEW."rejected_at" IS NOT NULL
       OR NEW."rejection_reason" IS NOT NULL THEN
      RAISE EXCEPTION 'PROJECT_VARIATION_INITIAL_STATE_INVALID';
    END IF;
    IF NEW."reverses_variation_id" IS NULL THEN
      IF project_active IS DISTINCT FROM TRUE OR NEW."currency_code" IS DISTINCT FROM base_currency THEN
        RAISE EXCEPTION 'PROJECT_VARIATION_SCOPE_INVALID';
      END IF;
      IF NEW."reversal_reason" IS NOT NULL THEN RAISE EXCEPTION 'PROJECT_VARIATION_REVERSAL_INVALID'; END IF;
    ELSE
      SELECT * INTO original_row FROM "project_variations"
      WHERE "id" = NEW."reverses_variation_id" FOR UPDATE;
      IF original_row."id" IS NULL
         OR original_row."company_id" <> NEW."company_id"
         OR original_row."project_id" <> NEW."project_id"
         OR original_row."state" <> 'APPROVED'
         OR original_row."reverses_variation_id" IS NOT NULL
         OR NEW."value_delta" <> -original_row."value_delta"
         OR NEW."currency_code" <> original_row."currency_code"
         OR NULLIF(BTRIM(NEW."reversal_reason"), '') IS NULL THEN
        RAISE EXCEPTION 'PROJECT_VARIATION_REVERSAL_INVALID';
      END IF;
    END IF;
    RETURN NEW;
  END IF;

  IF NEW."company_id" IS DISTINCT FROM OLD."company_id"
     OR NEW."project_id" IS DISTINCT FROM OLD."project_id"
     OR NEW."variation_number" IS DISTINCT FROM OLD."variation_number"
     OR NEW."currency_code" IS DISTINCT FROM OLD."currency_code"
     OR NEW."create_key" IS DISTINCT FROM OLD."create_key"
     OR NEW."create_payload_hash" IS DISTINCT FROM OLD."create_payload_hash"
     OR NEW."created_by_user_id" IS DISTINCT FROM OLD."created_by_user_id"
     OR NEW."created_at" IS DISTINCT FROM OLD."created_at"
     OR NEW."reverses_variation_id" IS DISTINCT FROM OLD."reverses_variation_id"
     OR NEW."reversal_reason" IS DISTINCT FROM OLD."reversal_reason" THEN
    RAISE EXCEPTION 'PROJECT_VARIATION_IDENTITY_IMMUTABLE';
  END IF;

  IF OLD."state" IN ('APPROVED','REJECTED') THEN
    IF NEW IS DISTINCT FROM OLD THEN RAISE EXCEPTION 'PROJECT_VARIATION_HISTORY_IMMUTABLE'; END IF;
    RETURN NEW;
  END IF;

  IF OLD."state" <> 'DRAFT' AND (
       NEW."description" IS DISTINCT FROM OLD."description"
    OR NEW."reason" IS DISTINCT FROM OLD."reason"
    OR NEW."value_delta" IS DISTINCT FROM OLD."value_delta"
    OR NEW."approval_instance_id" IS DISTINCT FROM OLD."approval_instance_id"
    OR NEW."submitted_by_user_id" IS DISTINCT FROM OLD."submitted_by_user_id"
    OR NEW."submitted_at" IS DISTINCT FROM OLD."submitted_at"
  ) THEN
    RAISE EXCEPTION 'PROJECT_VARIATION_SUBMITTED_HISTORY_IMMUTABLE';
  END IF;

  IF OLD."state" = 'DRAFT' AND NEW."state" NOT IN ('DRAFT','SUBMITTED') THEN
    RAISE EXCEPTION 'PROJECT_VARIATION_STATE_TRANSITION_INVALID';
  ELSIF OLD."state" = 'SUBMITTED' AND NEW."state" NOT IN ('SUBMITTED','APPROVED','REJECTED') THEN
    RAISE EXCEPTION 'PROJECT_VARIATION_STATE_TRANSITION_INVALID';
  ELSIF OLD."state" IN ('APPROVED','REJECTED') AND NEW."state" <> OLD."state" THEN
    RAISE EXCEPTION 'PROJECT_VARIATION_STATE_TRANSITION_INVALID';
  END IF;

  IF NEW."reverses_variation_id" IS NOT NULL THEN
    SELECT * INTO original_row FROM "project_variations"
    WHERE "id" = NEW."reverses_variation_id";
    IF original_row."id" IS NULL
       OR original_row."state" <> 'APPROVED'
       OR original_row."reverses_variation_id" IS NOT NULL
       OR NEW."value_delta" <> -original_row."value_delta"
       OR NEW."currency_code" <> original_row."currency_code"
       OR NULLIF(BTRIM(NEW."reversal_reason"), '') IS NULL THEN
      RAISE EXCEPTION 'PROJECT_VARIATION_REVERSAL_INVALID';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "project_variation_row_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "project_variations"
FOR EACH ROW EXECUTE FUNCTION erp_project_variation_row_guard();

CREATE OR REPLACE FUNCTION erp_project_variation_action_order_guard()
RETURNS trigger AS $$
DECLARE
  bound_entity_type TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN RETURN COALESCE(NEW, OLD); END IF;
  SELECT ai."entity_type" INTO bound_entity_type
  FROM "approval_instances" ai
  WHERE ai."id" = NEW."approval_instance_id"
  FOR UPDATE;
  IF bound_entity_type = 'PROJECT_VARIATION' THEN
    NEW."action_at" := date_trunc('milliseconds', clock_timestamp());
    NEW."project_variation_decision_order" := nextval('"project_variation_approval_action_order_seq"');
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "project_variation_action_order_guard"
BEFORE INSERT ON "approval_actions"
FOR EACH ROW EXECUTE FUNCTION erp_project_variation_action_order_guard();
