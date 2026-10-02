-- V0.6-B Client Invoice foundation / generic Project-Customer billing / approval history

ALTER TABLE "customers" ADD CONSTRAINT "customers_company_id_id_key" UNIQUE ("company_id","id");

CREATE TABLE "client_invoices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "customer_id" UUID NOT NULL,
  "client_invoice_number" VARCHAR(120) NOT NULL,
  "invoice_date" DATE NOT NULL,
  "due_date" DATE,
  "currency_code" VARCHAR(3) NOT NULL,
  "total_amount" DECIMAL(18,2) NOT NULL DEFAULT 0,
  "state" VARCHAR(30) NOT NULL DEFAULT 'DRAFT',
  "approval_instance_id" UUID,
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
  CONSTRAINT "client_invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "client_invoices_amount_check" CHECK ("total_amount" >= 0),
  CONSTRAINT "client_invoices_state_check" CHECK ("state" IN ('DRAFT','SUBMITTED','APPROVED','REJECTED'))
);
CREATE UNIQUE INDEX "client_invoices_company_number_key" ON "client_invoices"("company_id","client_invoice_number");
CREATE UNIQUE INDEX "client_invoices_creator_create_key_key" ON "client_invoices"("company_id","created_by_user_id","create_key");
CREATE UNIQUE INDEX "client_invoices_scope_key" ON "client_invoices"("company_id","project_id","id");
CREATE UNIQUE INDEX "client_invoices_approval_instance_id_key" ON "client_invoices"("approval_instance_id");
CREATE INDEX "client_invoices_company_project_state_idx" ON "client_invoices"("company_id","project_id","state");
CREATE INDEX "client_invoices_company_customer_date_idx" ON "client_invoices"("company_id","customer_id","invoice_date");

CREATE TABLE "client_invoice_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "client_invoice_id" UUID NOT NULL,
  "line_no" INTEGER NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "client_invoice_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "client_invoice_items_amount_check" CHECK ("amount" > 0)
);
CREATE UNIQUE INDEX "client_invoice_items_invoice_line_key" ON "client_invoice_items"("client_invoice_id","line_no");
CREATE INDEX "client_invoice_items_company_project_idx" ON "client_invoice_items"("company_id","project_id");

ALTER TABLE "client_invoices"
  ADD CONSTRAINT "client_invoices_company_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "client_invoices_project_fkey" FOREIGN KEY ("company_id","project_id") REFERENCES "projects"("company_id","id") ON DELETE RESTRICT,
  ADD CONSTRAINT "client_invoices_customer_fkey" FOREIGN KEY ("company_id","customer_id") REFERENCES "customers"("company_id","id") ON DELETE RESTRICT,
  ADD CONSTRAINT "client_invoices_approval_fkey" FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "client_invoices_creator_fkey" FOREIGN KEY ("company_id","created_by_user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT,
  ADD CONSTRAINT "client_invoices_submitter_fkey" FOREIGN KEY ("company_id","submitted_by_user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT,
  ADD CONSTRAINT "client_invoices_approver_fkey" FOREIGN KEY ("company_id","approved_by_user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT,
  ADD CONSTRAINT "client_invoices_rejector_fkey" FOREIGN KEY ("company_id","rejected_by_user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT;
ALTER TABLE "client_invoice_items"
  ADD CONSTRAINT "client_invoice_items_invoice_fkey" FOREIGN KEY ("company_id","project_id","client_invoice_id") REFERENCES "client_invoices"("company_id","project_id","id") ON DELETE RESTRICT;

INSERT INTO "permissions" ("id","permission_code","module_code","description") VALUES
 (gen_random_uuid(),'finance.client_invoice.view','FINANCE','View authorized Client Invoices'),
 (gen_random_uuid(),'finance.client_invoice.create','FINANCE','Create Client Invoice drafts'),
 (gen_random_uuid(),'finance.client_invoice.edit','FINANCE','Edit Client Invoice drafts'),
 (gen_random_uuid(),'finance.client_invoice.submit','FINANCE','Submit Client Invoices for approval'),
 (gen_random_uuid(),'finance.client_invoice.approve','FINANCE','Approve Client Invoices when also authorized by the Approval Matrix'),
 (gen_random_uuid(),'finance.client_invoice.reject','FINANCE','Reject Client Invoices when also authorized by the Approval Matrix'),
 (gen_random_uuid(),'finance.ap.view','FINANCE','View authorized derived Accounts Payable'),
 (gen_random_uuid(),'finance.ar.view','FINANCE','View authorized derived Accounts Receivable')
ON CONFLICT ("permission_code") DO NOTHING;

INSERT INTO "number_sequences" ("id","company_id","entity_type","sequence_code","format_template","reset_rule","next_value")
SELECT gen_random_uuid(), c."id", 'CLIENT_INVOICE', 'CLIENT_INVOICE', 'CIYYMM-###', 'MONTHLY', 1 FROM "companies" c
ON CONFLICT ("company_id","sequence_code") DO NOTHING;

CREATE OR REPLACE FUNCTION erp_client_invoice_item_draft_guard() RETURNS trigger AS $$
DECLARE invoice_state TEXT; target_id UUID;
BEGIN
 target_id := COALESCE(NEW."client_invoice_id", OLD."client_invoice_id");
 SELECT "state" INTO invoice_state FROM "client_invoices" WHERE "id"=target_id;
 IF invoice_state IS DISTINCT FROM 'DRAFT' THEN RAISE EXCEPTION 'CLIENT_INVOICE_HISTORY_IMMUTABLE'; END IF;
 RETURN COALESCE(NEW,OLD);
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "client_invoice_item_draft_guard" BEFORE INSERT OR UPDATE OR DELETE ON "client_invoice_items"
FOR EACH ROW EXECUTE FUNCTION erp_client_invoice_item_draft_guard();

CREATE OR REPLACE FUNCTION erp_client_invoice_recalculate_total() RETURNS trigger AS $$
DECLARE target_id UUID;
BEGIN
 target_id := COALESCE(NEW."client_invoice_id", OLD."client_invoice_id");
 UPDATE "client_invoices" SET "total_amount"=COALESCE((SELECT SUM("amount") FROM "client_invoice_items" WHERE "client_invoice_id"=target_id),0),
 "updated_at"=CURRENT_TIMESTAMP WHERE "id"=target_id AND "state"='DRAFT';
 RETURN COALESCE(NEW,OLD);
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "client_invoice_item_total_recalc" AFTER INSERT OR UPDATE OR DELETE ON "client_invoice_items"
FOR EACH ROW EXECUTE FUNCTION erp_client_invoice_recalculate_total();

CREATE OR REPLACE FUNCTION erp_client_invoice_header_guard() RETURNS trigger AS $$
DECLARE line_total DECIMAL(18,2); line_count INTEGER;
BEGIN
 IF NEW."client_invoice_number" IS DISTINCT FROM OLD."client_invoice_number" THEN RAISE EXCEPTION 'CLIENT_INVOICE_NUMBER_IMMUTABLE'; END IF;
 IF OLD."state"<>'DRAFT' AND (
   NEW."company_id" IS DISTINCT FROM OLD."company_id" OR NEW."project_id" IS DISTINCT FROM OLD."project_id" OR
   NEW."customer_id" IS DISTINCT FROM OLD."customer_id" OR NEW."invoice_date" IS DISTINCT FROM OLD."invoice_date" OR
   NEW."due_date" IS DISTINCT FROM OLD."due_date" OR NEW."currency_code" IS DISTINCT FROM OLD."currency_code" OR
   NEW."total_amount" IS DISTINCT FROM OLD."total_amount" OR NEW."create_key" IS DISTINCT FROM OLD."create_key" OR
   NEW."create_payload_hash" IS DISTINCT FROM OLD."create_payload_hash" OR NEW."created_by_user_id" IS DISTINCT FROM OLD."created_by_user_id"
 ) THEN RAISE EXCEPTION 'CLIENT_INVOICE_HISTORY_IMMUTABLE'; END IF;
 IF OLD."state"='DRAFT' AND NEW."state" NOT IN ('DRAFT','SUBMITTED') THEN RAISE EXCEPTION 'CLIENT_INVOICE_STATE_TRANSITION_INVALID';
 ELSIF OLD."state"='SUBMITTED' AND NEW."state" NOT IN ('SUBMITTED','APPROVED','REJECTED') THEN RAISE EXCEPTION 'CLIENT_INVOICE_STATE_TRANSITION_INVALID';
 ELSIF OLD."state" IN ('APPROVED','REJECTED') AND NEW."state"<>OLD."state" THEN RAISE EXCEPTION 'CLIENT_INVOICE_STATE_TRANSITION_INVALID'; END IF;
 IF OLD."state"='DRAFT' AND NEW."state"='SUBMITTED' THEN
   SELECT COUNT(*),COALESCE(SUM("amount"),0) INTO line_count,line_total FROM "client_invoice_items" WHERE "client_invoice_id"=OLD."id";
   IF line_count=0 OR line_total<>NEW."total_amount" THEN RAISE EXCEPTION 'CLIENT_INVOICE_TOTAL_MISMATCH'; END IF;
 END IF;
 RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER "client_invoice_header_guard" BEFORE UPDATE ON "client_invoices"
FOR EACH ROW EXECUTE FUNCTION erp_client_invoice_header_guard();
