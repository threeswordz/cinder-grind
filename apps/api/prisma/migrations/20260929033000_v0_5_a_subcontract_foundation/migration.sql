CREATE UNIQUE INDEX IF NOT EXISTS "suppliers_company_id_id_key"
ON "suppliers"("company_id","id");

CREATE UNIQUE INDEX IF NOT EXISTS "projects_company_id_id_key"
ON "projects"("company_id","id");

CREATE UNIQUE INDEX IF NOT EXISTS "status_definitions_company_id_id_key"
ON "status_definitions"("company_id","id");

CREATE TABLE "subcontractors" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "supplier_id" UUID,
  "subcontractor_code" VARCHAR(50) NOT NULL,
  "subcontractor_name" VARCHAR(200) NOT NULL,
  "registration_number" VARCHAR(100),
  "contact_name" VARCHAR(200),
  "email" VARCHAR(320),
  "phone" VARCHAR(50),
  "address" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subcontractors_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subcontractors_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "subcontractors_company_id_supplier_id_fkey"
    FOREIGN KEY ("company_id","supplier_id") REFERENCES "suppliers"("company_id","id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "subcontractors_company_id_subcontractor_code_key"
ON "subcontractors"("company_id","subcontractor_code");
CREATE UNIQUE INDEX "subcontractors_company_id_supplier_id_key"
ON "subcontractors"("company_id","supplier_id");
CREATE UNIQUE INDEX "subcontractors_company_id_id_key"
ON "subcontractors"("company_id","id");
CREATE INDEX "subcontractors_company_id_is_active_idx"
ON "subcontractors"("company_id","is_active");

CREATE TABLE "subcontract_agreements" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "subcontractor_id" UUID NOT NULL,
  "agreement_number" VARCHAR(120) NOT NULL,
  "original_value" DECIMAL(18,2) NOT NULL,
  "scope_of_work" TEXT NOT NULL,
  "currency_code" VARCHAR(3) NOT NULL,
  "approval_state" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  "operational_status_id" UUID,
  "create_key" VARCHAR(120),
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "subcontract_agreements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "subcontract_agreements_value_check" CHECK ("original_value" >= 0),
  CONSTRAINT "subcontract_agreements_scope_check" CHECK (length(btrim("scope_of_work")) > 0),
  CONSTRAINT "subcontract_agreements_currency_check" CHECK ("currency_code" ~ '^[A-Z]{3}$'),
  CONSTRAINT "subcontract_agreements_state_check" CHECK ("approval_state" IN ('DRAFT','SUBMITTED','APPROVED','REJECTED','CANCELLED')),
  CONSTRAINT "subcontract_agreements_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "subcontract_agreements_company_id_project_id_fkey"
    FOREIGN KEY ("company_id","project_id") REFERENCES "projects"("company_id","id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "subcontract_agreements_company_id_subcontractor_id_fkey"
    FOREIGN KEY ("company_id","subcontractor_id") REFERENCES "subcontractors"("company_id","id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "subcontract_agreements_company_id_operational_status_id_fkey"
    FOREIGN KEY ("company_id","operational_status_id") REFERENCES "status_definitions"("company_id","id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "subcontract_agreements_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "subcontract_agreements_company_id_agreement_number_key"
ON "subcontract_agreements"("company_id","agreement_number");
CREATE UNIQUE INDEX "subcontract_agreements_company_id_create_key_key"
ON "subcontract_agreements"("company_id","create_key");
CREATE INDEX "subcontract_agreements_company_id_project_id_approval_state_idx"
ON "subcontract_agreements"("company_id","project_id","approval_state");
CREATE INDEX "subcontract_agreements_company_id_subcontractor_id_idx"
ON "subcontract_agreements"("company_id","subcontractor_id");
CREATE INDEX "subcontract_agreements_operational_status_id_idx"
ON "subcontract_agreements"("operational_status_id");

CREATE OR REPLACE FUNCTION protect_v05a_identity_and_history()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION '% cannot be deleted; retain history and use lifecycle actions', TG_TABLE_NAME;
  END IF;
  IF NEW.id <> OLD.id OR NEW.company_id <> OLD.company_id THEN
    RAISE EXCEPTION '% identity and Company cannot be changed', TG_TABLE_NAME;
  END IF;
  RETURN NEW;
END;
$$;

CREATE TRIGGER subcontractors_identity_guard
BEFORE UPDATE OR DELETE ON "subcontractors"
FOR EACH ROW EXECUTE FUNCTION protect_v05a_identity_and_history();

CREATE TRIGGER subcontract_agreements_identity_guard
BEFORE UPDATE OR DELETE ON "subcontract_agreements"
FOR EACH ROW EXECUTE FUNCTION protect_v05a_identity_and_history();

INSERT INTO "number_sequences"
  ("id","company_id","entity_type","sequence_code","format_template","reset_rule","next_value")
SELECT gen_random_uuid(), c."id", 'SUBCONTRACT_AGREEMENT', 'SUBCONTRACT_AGREEMENT', 'SCYYMM-###', 'MONTHLY', 1
FROM "companies" c
ON CONFLICT ("company_id","sequence_code") DO NOTHING;
