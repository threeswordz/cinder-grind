-- V0.6-A Supplier Invoice foundation / one-Project source integrity / approval history

CREATE TABLE "supplier_invoices" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "supplier_id" UUID NOT NULL,
  "supplier_invoice_number" VARCHAR(120) NOT NULL,
  "supplier_reference" VARCHAR(200) NOT NULL,
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
  CONSTRAINT "supplier_invoices_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "supplier_invoices_amount_check" CHECK ("total_amount" >= 0),
  CONSTRAINT "supplier_invoices_state_check" CHECK ("state" IN ('DRAFT','SUBMITTED','APPROVED','REJECTED'))
);

CREATE UNIQUE INDEX "supplier_invoices_company_number_key"
  ON "supplier_invoices"("company_id","supplier_invoice_number");
CREATE UNIQUE INDEX "supplier_invoices_supplier_reference_key"
  ON "supplier_invoices"("company_id","supplier_id","supplier_reference");
CREATE UNIQUE INDEX "supplier_invoices_creator_create_key_key"
  ON "supplier_invoices"("company_id","created_by_user_id","create_key");
CREATE UNIQUE INDEX "supplier_invoices_scope_key"
  ON "supplier_invoices"("company_id","project_id","id");
CREATE UNIQUE INDEX "supplier_invoices_approval_instance_id_key"
  ON "supplier_invoices"("approval_instance_id");
CREATE INDEX "supplier_invoices_company_project_state_idx"
  ON "supplier_invoices"("company_id","project_id","state");
CREATE INDEX "supplier_invoices_company_supplier_date_idx"
  ON "supplier_invoices"("company_id","supplier_id","invoice_date");

CREATE TABLE "supplier_invoice_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "supplier_invoice_id" UUID NOT NULL,
  "line_no" INTEGER NOT NULL,
  "purchase_order_line_id" UUID,
  "goods_receipt_item_id" UUID,
  "wbs_id" UUID,
  "cost_code_id" UUID,
  "description" VARCHAR(500) NOT NULL,
  "amount" DECIMAL(18,2) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supplier_invoice_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "supplier_invoice_items_amount_check" CHECK ("amount" > 0)
);

CREATE UNIQUE INDEX "supplier_invoice_items_invoice_line_key"
  ON "supplier_invoice_items"("supplier_invoice_id","line_no");
CREATE INDEX "supplier_invoice_items_project_wbs_idx"
  ON "supplier_invoice_items"("company_id","project_id","wbs_id");
CREATE INDEX "supplier_invoice_items_cost_code_idx"
  ON "supplier_invoice_items"("company_id","cost_code_id");
CREATE INDEX "supplier_invoice_items_po_line_idx"
  ON "supplier_invoice_items"("purchase_order_line_id");
CREATE INDEX "supplier_invoice_items_gr_item_idx"
  ON "supplier_invoice_items"("goods_receipt_item_id");

CREATE TABLE "finance_action_replays" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "user_id" UUID NOT NULL,
  "action_key" VARCHAR(120) NOT NULL,
  "action_type" VARCHAR(80) NOT NULL,
  "entity_type" VARCHAR(100) NOT NULL,
  "entity_id" UUID NOT NULL,
  "payload_hash" VARCHAR(64) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "finance_action_replays_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "finance_action_replays_company_user_key"
  ON "finance_action_replays"("company_id","user_id","action_key");
CREATE INDEX "finance_action_replays_entity_idx"
  ON "finance_action_replays"("company_id","entity_type","entity_id");

ALTER TABLE "supplier_invoices"
  ADD CONSTRAINT "supplier_invoices_company_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "supplier_invoices_project_fkey"
  FOREIGN KEY ("company_id","project_id") REFERENCES "projects"("company_id","id") ON DELETE RESTRICT,
  ADD CONSTRAINT "supplier_invoices_supplier_fkey"
  FOREIGN KEY ("company_id","supplier_id") REFERENCES "suppliers"("company_id","id") ON DELETE RESTRICT,
  ADD CONSTRAINT "supplier_invoices_approval_fkey"
  FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "supplier_invoices_creator_fkey"
  FOREIGN KEY ("company_id","created_by_user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT,
  ADD CONSTRAINT "supplier_invoices_submitter_fkey"
  FOREIGN KEY ("company_id","submitted_by_user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT,
  ADD CONSTRAINT "supplier_invoices_approver_fkey"
  FOREIGN KEY ("company_id","approved_by_user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT,
  ADD CONSTRAINT "supplier_invoices_rejector_fkey"
  FOREIGN KEY ("company_id","rejected_by_user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT;

ALTER TABLE "supplier_invoice_items"
  ADD CONSTRAINT "supplier_invoice_items_invoice_fkey"
  FOREIGN KEY ("company_id","project_id","supplier_invoice_id")
  REFERENCES "supplier_invoices"("company_id","project_id","id") ON DELETE RESTRICT,
  ADD CONSTRAINT "supplier_invoice_items_po_line_fkey"
  FOREIGN KEY ("purchase_order_line_id") REFERENCES "purchase_order_lines"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "supplier_invoice_items_gr_item_fkey"
  FOREIGN KEY ("goods_receipt_item_id") REFERENCES "goods_receipt_items"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "supplier_invoice_items_wbs_fkey"
  FOREIGN KEY ("project_id","wbs_id") REFERENCES "wbs_elements"("project_id","id") ON DELETE RESTRICT,
  ADD CONSTRAINT "supplier_invoice_items_cost_code_fkey"
  FOREIGN KEY ("company_id","cost_code_id") REFERENCES "cost_codes"("company_id","id") ON DELETE RESTRICT;

ALTER TABLE "finance_action_replays"
  ADD CONSTRAINT "finance_action_replays_company_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT,
  ADD CONSTRAINT "finance_action_replays_user_fkey"
  FOREIGN KEY ("company_id","user_id") REFERENCES "users"("company_id","id") ON DELETE RESTRICT;

INSERT INTO "permissions" ("id","permission_code","module_code","description")
VALUES
  (gen_random_uuid(),'finance.supplier_invoice.view','FINANCE','View authorized Supplier Invoices'),
  (gen_random_uuid(),'finance.supplier_invoice.create','FINANCE','Create Supplier Invoice drafts'),
  (gen_random_uuid(),'finance.supplier_invoice.edit','FINANCE','Edit Supplier Invoice drafts'),
  (gen_random_uuid(),'finance.supplier_invoice.submit','FINANCE','Submit Supplier Invoices for approval'),
  (gen_random_uuid(),'finance.supplier_invoice.approve','FINANCE','Approve Supplier Invoices when also authorized by the Approval Matrix'),
  (gen_random_uuid(),'finance.supplier_invoice.reject','FINANCE','Reject Supplier Invoices when also authorized by the Approval Matrix')
ON CONFLICT ("permission_code") DO NOTHING;

INSERT INTO "number_sequences"
  ("id","company_id","entity_type","sequence_code","format_template","reset_rule","next_value")
SELECT gen_random_uuid(), c."id", 'SUPPLIER_INVOICE', 'SUPPLIER_INVOICE', 'SIYYMM-###', 'MONTHLY', 1
FROM "companies" c
ON CONFLICT ("company_id","sequence_code") DO NOTHING;

CREATE OR REPLACE FUNCTION erp_supplier_invoice_item_scope_guard()
RETURNS trigger AS $$
DECLARE
  inv_company UUID;
  inv_project UUID;
  inv_supplier UUID;
  po_company UUID;
  po_project UUID;
  po_supplier UUID;
  po_state TEXT;
  po_cancelled TIMESTAMPTZ;
  po_next UUID;
  gr_company UUID;
  gr_project UUID;
  gr_supplier UUID;
  gr_posted TIMESTAMPTZ;
  gr_reversed TIMESTAMPTZ;
  gr_po_line UUID;
BEGIN
  SELECT "company_id","project_id","supplier_id"
    INTO inv_company,inv_project,inv_supplier
  FROM "supplier_invoices"
  WHERE "id" = NEW."supplier_invoice_id";

  IF inv_company IS NULL OR NEW."company_id" <> inv_company OR NEW."project_id" <> inv_project THEN
    RAISE EXCEPTION 'SUPPLIER_INVOICE_SCOPE_MISMATCH';
  END IF;

  IF NEW."purchase_order_line_id" IS NOT NULL THEN
    SELECT po."company_id",po."project_id",po."supplier_id",
           ai."approval_state",po."cancelled_at",next_po."id"
      INTO po_company,po_project,po_supplier,po_state,po_cancelled,po_next
    FROM "purchase_order_lines" pol
    JOIN "purchase_orders" po ON po."id" = pol."purchase_order_id"
    LEFT JOIN "approval_instances" ai ON ai."id" = po."approval_instance_id"
    LEFT JOIN "purchase_orders" next_po ON next_po."previous_revision_id" = po."id"
    WHERE pol."id" = NEW."purchase_order_line_id";

    IF po_company IS NULL OR po_company <> inv_company OR po_project <> inv_project OR po_supplier <> inv_supplier THEN
      RAISE EXCEPTION 'SUPPLIER_INVOICE_PO_SCOPE_MISMATCH';
    END IF;
    IF po_state IS DISTINCT FROM 'APPROVED' OR po_cancelled IS NOT NULL OR po_next IS NOT NULL THEN
      RAISE EXCEPTION 'SUPPLIER_INVOICE_PO_NOT_APPROVED_CURRENT';
    END IF;
  END IF;

  IF NEW."goods_receipt_item_id" IS NOT NULL THEN
    SELECT gr."company_id",gr."project_id",gr."supplier_id",
           gr."posted_at",gr."reversed_at",gri."purchase_order_line_id"
      INTO gr_company,gr_project,gr_supplier,gr_posted,gr_reversed,gr_po_line
    FROM "goods_receipt_items" gri
    JOIN "goods_receipts" gr ON gr."id" = gri."goods_receipt_id"
    WHERE gri."id" = NEW."goods_receipt_item_id";

    IF gr_company IS NULL OR gr_company <> inv_company OR gr_project <> inv_project OR gr_supplier <> inv_supplier THEN
      RAISE EXCEPTION 'SUPPLIER_INVOICE_GR_SCOPE_MISMATCH';
    END IF;
    IF gr_posted IS NULL OR gr_reversed IS NOT NULL THEN
      RAISE EXCEPTION 'SUPPLIER_INVOICE_GR_NOT_POSTED_ACTIVE';
    END IF;
    IF NEW."purchase_order_line_id" IS NOT NULL AND gr_po_line <> NEW."purchase_order_line_id" THEN
      RAISE EXCEPTION 'SUPPLIER_INVOICE_PO_GR_LINEAGE_MISMATCH';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "supplier_invoice_item_scope_guard"
BEFORE INSERT OR UPDATE ON "supplier_invoice_items"
FOR EACH ROW EXECUTE FUNCTION erp_supplier_invoice_item_scope_guard();

CREATE OR REPLACE FUNCTION erp_supplier_invoice_item_draft_guard()
RETURNS trigger AS $$
DECLARE
  invoice_state TEXT;
  target_id UUID;
BEGIN
  target_id := COALESCE(NEW."supplier_invoice_id", OLD."supplier_invoice_id");
  SELECT "state" INTO invoice_state FROM "supplier_invoices" WHERE "id" = target_id;
  IF invoice_state IS DISTINCT FROM 'DRAFT' THEN
    RAISE EXCEPTION 'SUPPLIER_INVOICE_HISTORY_IMMUTABLE';
  END IF;
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "supplier_invoice_item_draft_guard"
BEFORE INSERT OR UPDATE OR DELETE ON "supplier_invoice_items"
FOR EACH ROW EXECUTE FUNCTION erp_supplier_invoice_item_draft_guard();

CREATE OR REPLACE FUNCTION erp_supplier_invoice_recalculate_total()
RETURNS trigger AS $$
DECLARE
  target_id UUID;
BEGIN
  target_id := COALESCE(NEW."supplier_invoice_id", OLD."supplier_invoice_id");
  UPDATE "supplier_invoices"
  SET "total_amount" = COALESCE((
    SELECT SUM("amount") FROM "supplier_invoice_items"
    WHERE "supplier_invoice_id" = target_id
  ), 0),
  "updated_at" = CURRENT_TIMESTAMP
  WHERE "id" = target_id AND "state" = 'DRAFT';
  RETURN COALESCE(NEW, OLD);
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "supplier_invoice_item_total_recalc"
AFTER INSERT OR UPDATE OR DELETE ON "supplier_invoice_items"
FOR EACH ROW EXECUTE FUNCTION erp_supplier_invoice_recalculate_total();

CREATE OR REPLACE FUNCTION erp_supplier_invoice_header_guard()
RETURNS trigger AS $$
DECLARE
  line_total DECIMAL(18,2);
  line_count INTEGER;
BEGIN
  IF NEW."supplier_invoice_number" IS DISTINCT FROM OLD."supplier_invoice_number" THEN
    RAISE EXCEPTION 'SUPPLIER_INVOICE_NUMBER_IMMUTABLE';
  END IF;

  IF OLD."state" <> 'DRAFT' AND (
       NEW."company_id" IS DISTINCT FROM OLD."company_id"
    OR NEW."project_id" IS DISTINCT FROM OLD."project_id"
    OR NEW."supplier_id" IS DISTINCT FROM OLD."supplier_id"
    OR NEW."supplier_reference" IS DISTINCT FROM OLD."supplier_reference"
    OR NEW."invoice_date" IS DISTINCT FROM OLD."invoice_date"
    OR NEW."due_date" IS DISTINCT FROM OLD."due_date"
    OR NEW."currency_code" IS DISTINCT FROM OLD."currency_code"
    OR NEW."total_amount" IS DISTINCT FROM OLD."total_amount"
    OR NEW."create_key" IS DISTINCT FROM OLD."create_key"
    OR NEW."create_payload_hash" IS DISTINCT FROM OLD."create_payload_hash"
    OR NEW."created_by_user_id" IS DISTINCT FROM OLD."created_by_user_id"
  ) THEN
    RAISE EXCEPTION 'SUPPLIER_INVOICE_HISTORY_IMMUTABLE';
  END IF;

  IF OLD."state" = 'DRAFT' AND NEW."state" NOT IN ('DRAFT','SUBMITTED') THEN
    RAISE EXCEPTION 'SUPPLIER_INVOICE_STATE_TRANSITION_INVALID';
  ELSIF OLD."state" = 'SUBMITTED' AND NEW."state" NOT IN ('SUBMITTED','APPROVED','REJECTED') THEN
    RAISE EXCEPTION 'SUPPLIER_INVOICE_STATE_TRANSITION_INVALID';
  ELSIF OLD."state" IN ('APPROVED','REJECTED') AND NEW."state" <> OLD."state" THEN
    RAISE EXCEPTION 'SUPPLIER_INVOICE_STATE_TRANSITION_INVALID';
  END IF;

  IF OLD."state" = 'DRAFT' AND NEW."state" = 'SUBMITTED' THEN
    SELECT COUNT(*), COALESCE(SUM("amount"),0)
      INTO line_count,line_total
    FROM "supplier_invoice_items"
    WHERE "supplier_invoice_id" = OLD."id";
    IF line_count = 0 OR line_total <> NEW."total_amount" THEN
      RAISE EXCEPTION 'SUPPLIER_INVOICE_TOTAL_MISMATCH';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER "supplier_invoice_header_guard"
BEFORE UPDATE ON "supplier_invoices"
FOR EACH ROW EXECUTE FUNCTION erp_supplier_invoice_header_guard();
