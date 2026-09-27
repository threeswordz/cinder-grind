CREATE TABLE "purchase_orders" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "supplier_id" UUID NOT NULL,
  "po_number" VARCHAR(120) NOT NULL,
  "revision_no" INTEGER NOT NULL DEFAULT 0,
  "previous_revision_id" UUID,
  "revision_reason" TEXT,
  "remarks" TEXT,
  "approval_instance_id" UUID,
  "created_by_user_id" UUID NOT NULL,
  "submitted_by_user_id" UUID,
  "cancelled_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_at" TIMESTAMPTZ(6),
  "cancelled_at" TIMESTAMPTZ(6),
  "cancellation_reason" TEXT,
  CONSTRAINT "purchase_orders_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_orders_previous_revision_id_key" UNIQUE ("previous_revision_id"),
  CONSTRAINT "purchase_orders_approval_instance_id_key" UNIQUE ("approval_instance_id"),
  CONSTRAINT "purchase_orders_company_id_po_number_revision_no_key"
    UNIQUE ("company_id","po_number","revision_no"),
  CONSTRAINT "purchase_orders_revision_no_check" CHECK ("revision_no" >= 0),
  CONSTRAINT "purchase_orders_cancellation_check" CHECK (
    (
      "cancelled_at" IS NULL
      AND "cancelled_by_user_id" IS NULL
      AND "cancellation_reason" IS NULL
    )
    OR (
      "cancelled_at" IS NOT NULL
      AND "cancelled_by_user_id" IS NOT NULL
      AND "cancellation_reason" IS NOT NULL
      AND length(trim("cancellation_reason")) > 0
    )
  ),
  CONSTRAINT "purchase_orders_submission_check" CHECK (
    ("submitted_at" IS NULL AND "submitted_by_user_id" IS NULL)
    OR ("submitted_at" IS NOT NULL AND "submitted_by_user_id" IS NOT NULL)
  ),
  CONSTRAINT "purchase_orders_company_id_fkey"
    FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_orders_project_id_fkey"
    FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_orders_supplier_id_fkey"
    FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_orders_previous_revision_id_fkey"
    FOREIGN KEY ("previous_revision_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_orders_approval_instance_id_fkey"
    FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_orders_created_by_user_id_fkey"
    FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_orders_submitted_by_user_id_fkey"
    FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_orders_cancelled_by_user_id_fkey"
    FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "purchase_orders_company_id_project_id_created_at_idx"
  ON "purchase_orders"("company_id","project_id","created_at");
CREATE INDEX "purchase_orders_supplier_id_idx" ON "purchase_orders"("supplier_id");
CREATE INDEX "purchase_orders_po_number_revision_no_idx" ON "purchase_orders"("po_number","revision_no");
CREATE INDEX "purchase_orders_submitted_by_user_id_idx" ON "purchase_orders"("submitted_by_user_id");
CREATE INDEX "purchase_orders_cancelled_by_user_id_idx" ON "purchase_orders"("cancelled_by_user_id");

CREATE TABLE "purchase_order_lines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "purchase_order_id" UUID NOT NULL,
  "line_no" INTEGER NOT NULL,
  "quotation_award_id" UUID NOT NULL,
  "purchase_request_line_id" UUID NOT NULL,
  "rfq_id" UUID NOT NULL,
  "rfq_line_id" UUID NOT NULL,
  "supplier_quotation_id" UUID NOT NULL,
  "supplier_quotation_line_id" UUID NOT NULL,
  "line_type" VARCHAR(20) NOT NULL,
  "material_id" UUID,
  "material_code_snapshot" VARCHAR(80),
  "description" VARCHAR(500) NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "uom_id" UUID NOT NULL,
  "uom_code_snapshot" VARCHAR(30) NOT NULL,
  "unit_price" DECIMAL(18,4) NOT NULL,
  "amount" DECIMAL(38,8) NOT NULL,
  "wbs_id" UUID,
  "cost_code_id" UUID,
  "required_on_site" DATE,
  "expected_delivery" DATE,
  "remarks" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_order_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_order_lines_purchase_order_id_line_no_key"
    UNIQUE ("purchase_order_id","line_no"),
  CONSTRAINT "purchase_order_lines_purchase_order_id_quotation_award_id_key"
    UNIQUE ("purchase_order_id","quotation_award_id"),
  CONSTRAINT "purchase_order_lines_line_no_check" CHECK ("line_no" > 0),
  CONSTRAINT "purchase_order_lines_line_type_check" CHECK ("line_type" IN ('MATERIAL','SERVICE')),
  CONSTRAINT "purchase_order_lines_material_type_check" CHECK (
    ("line_type" = 'MATERIAL' AND "material_id" IS NOT NULL AND "material_code_snapshot" IS NOT NULL)
    OR ("line_type" = 'SERVICE' AND "material_id" IS NULL AND "material_code_snapshot" IS NULL)
  ),
  CONSTRAINT "purchase_order_lines_description_check" CHECK (length(trim("description")) > 0),
  CONSTRAINT "purchase_order_lines_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "purchase_order_lines_unit_price_check" CHECK ("unit_price" >= 0),
  CONSTRAINT "purchase_order_lines_amount_check" CHECK ("amount" = "quantity" * "unit_price"),
  CONSTRAINT "purchase_order_lines_purchase_order_id_fkey"
    FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_order_lines_quotation_award_id_fkey"
    FOREIGN KEY ("quotation_award_id") REFERENCES "quotation_awards"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_order_lines_purchase_request_line_id_fkey"
    FOREIGN KEY ("purchase_request_line_id") REFERENCES "purchase_request_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_order_lines_rfq_id_fkey"
    FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_order_lines_rfq_line_id_fkey"
    FOREIGN KEY ("rfq_line_id") REFERENCES "rfq_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_order_lines_supplier_quotation_id_fkey"
    FOREIGN KEY ("supplier_quotation_id") REFERENCES "supplier_quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_order_lines_supplier_quotation_line_id_fkey"
    FOREIGN KEY ("supplier_quotation_line_id") REFERENCES "supplier_quotation_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_order_lines_material_id_fkey"
    FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_order_lines_uom_id_fkey"
    FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_order_lines_wbs_id_fkey"
    FOREIGN KEY ("wbs_id") REFERENCES "wbs_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_order_lines_cost_code_id_fkey"
    FOREIGN KEY ("cost_code_id") REFERENCES "cost_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "purchase_order_lines_quotation_award_id_idx" ON "purchase_order_lines"("quotation_award_id");
CREATE INDEX "purchase_order_lines_purchase_request_line_id_idx" ON "purchase_order_lines"("purchase_request_line_id");
CREATE INDEX "purchase_order_lines_rfq_id_idx" ON "purchase_order_lines"("rfq_id");
CREATE INDEX "purchase_order_lines_rfq_line_id_idx" ON "purchase_order_lines"("rfq_line_id");
CREATE INDEX "purchase_order_lines_supplier_quotation_id_idx" ON "purchase_order_lines"("supplier_quotation_id");
CREATE INDEX "purchase_order_lines_supplier_quotation_line_id_idx" ON "purchase_order_lines"("supplier_quotation_line_id");
CREATE INDEX "purchase_order_lines_material_id_idx" ON "purchase_order_lines"("material_id");
CREATE INDEX "purchase_order_lines_uom_id_idx" ON "purchase_order_lines"("uom_id");
CREATE INDEX "purchase_order_lines_wbs_id_idx" ON "purchase_order_lines"("wbs_id");
CREATE INDEX "purchase_order_lines_cost_code_id_idx" ON "purchase_order_lines"("cost_code_id");
CREATE INDEX "purchase_order_lines_required_on_site_idx" ON "purchase_order_lines"("required_on_site");
CREATE INDEX "purchase_order_lines_expected_delivery_idx" ON "purchase_order_lines"("expected_delivery");

CREATE OR REPLACE FUNCTION validate_purchase_order_scope()
RETURNS trigger AS $$
DECLARE
  project_company UUID;
  supplier_company UUID;
  creator_company UUID;
  submitter_company UUID;
  canceller_company UUID;
  approval_company UUID;
  approval_entity_type VARCHAR(100);
  approval_entity_id UUID;
  prev_company UUID;
  prev_project UUID;
  prev_supplier UUID;
  prev_number VARCHAR(120);
  prev_revision INTEGER;
  prev_cancelled TIMESTAMPTZ;
  prev_approval_state VARCHAR(30);
BEGIN
  SELECT "company_id" INTO project_company FROM "projects" WHERE "id" = NEW."project_id";
  SELECT "company_id" INTO supplier_company FROM "suppliers" WHERE "id" = NEW."supplier_id";
  SELECT "company_id" INTO creator_company FROM "users" WHERE "id" = NEW."created_by_user_id";

  IF project_company IS NULL OR project_company <> NEW."company_id" THEN
    RAISE EXCEPTION 'Purchase Order Company must match Project Company';
  END IF;
  IF supplier_company IS NULL OR supplier_company <> NEW."company_id" THEN
    RAISE EXCEPTION 'Purchase Order Supplier must belong to the same Company';
  END IF;
  IF creator_company IS NULL OR creator_company <> NEW."company_id" THEN
    RAISE EXCEPTION 'Purchase Order creator must belong to the same Company';
  END IF;

  IF NEW."submitted_by_user_id" IS NOT NULL THEN
    SELECT "company_id" INTO submitter_company FROM "users" WHERE "id" = NEW."submitted_by_user_id";
    IF submitter_company IS NULL OR submitter_company <> NEW."company_id" THEN
      RAISE EXCEPTION 'Purchase Order submitter must belong to the same Company';
    END IF;
  END IF;

  IF NEW."cancelled_by_user_id" IS NOT NULL THEN
    SELECT "company_id" INTO canceller_company FROM "users" WHERE "id" = NEW."cancelled_by_user_id";
    IF canceller_company IS NULL OR canceller_company <> NEW."company_id" THEN
      RAISE EXCEPTION 'Purchase Order canceller must belong to the same Company';
    END IF;
  END IF;

  IF NEW."approval_instance_id" IS NOT NULL THEN
    SELECT "company_id","entity_type","entity_id"
      INTO approval_company,approval_entity_type,approval_entity_id
    FROM "approval_instances"
    WHERE "id" = NEW."approval_instance_id";

    IF approval_company IS NULL
       OR approval_company <> NEW."company_id"
       OR approval_entity_type <> 'PURCHASE_ORDER'
       OR approval_entity_id <> NEW."id" THEN
      RAISE EXCEPTION 'Purchase Order approval instance is inconsistent';
    END IF;
  END IF;

  IF NEW."revision_no" = 0 THEN
    IF NEW."previous_revision_id" IS NOT NULL THEN
      RAISE EXCEPTION 'Initial Purchase Order revision cannot reference a previous revision';
    END IF;
  ELSE
    IF NEW."previous_revision_id" IS NULL THEN
      RAISE EXCEPTION 'Purchase Order revision must reference the previous approved revision';
    END IF;

    SELECT po."company_id",po."project_id",po."supplier_id",po."po_number",
           po."revision_no",po."cancelled_at",ai."approval_state"
      INTO prev_company,prev_project,prev_supplier,prev_number,
           prev_revision,prev_cancelled,prev_approval_state
    FROM "purchase_orders" po
    LEFT JOIN "approval_instances" ai ON ai."id" = po."approval_instance_id"
    WHERE po."id" = NEW."previous_revision_id";

    IF prev_company IS NULL
       OR prev_company <> NEW."company_id"
       OR prev_project <> NEW."project_id"
       OR prev_supplier <> NEW."supplier_id"
       OR prev_number <> NEW."po_number"
       OR NEW."revision_no" <> prev_revision + 1 THEN
      RAISE EXCEPTION 'Purchase Order revision chain is inconsistent';
    END IF;
    IF prev_approval_state NOT IN ('APPROVED','REJECTED')
       OR prev_cancelled IS NOT NULL THEN
      RAISE EXCEPTION 'Purchase Order revision must originate from an active approved or retained rejected revision';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER purchase_orders_scope_guard
BEFORE INSERT OR UPDATE ON "purchase_orders"
FOR EACH ROW EXECUTE FUNCTION validate_purchase_order_scope();

CREATE OR REPLACE FUNCTION protect_purchase_order_history()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Purchase Orders are retained history and cannot be deleted';
  END IF;

  IF NEW."company_id" <> OLD."company_id"
     OR NEW."project_id" <> OLD."project_id"
     OR NEW."supplier_id" <> OLD."supplier_id"
     OR NEW."po_number" <> OLD."po_number"
     OR NEW."revision_no" <> OLD."revision_no"
     OR NEW."previous_revision_id" IS DISTINCT FROM OLD."previous_revision_id"
     OR NEW."created_by_user_id" <> OLD."created_by_user_id"
     OR NEW."created_at" <> OLD."created_at" THEN
    RAISE EXCEPTION 'Purchase Order business identity is immutable';
  END IF;

  IF OLD."cancelled_at" IS NOT NULL THEN
    RAISE EXCEPTION 'Cancelled Purchase Order revision is immutable';
  END IF;

  IF OLD."approval_instance_id" IS NOT NULL OR OLD."submitted_at" IS NOT NULL THEN
    IF NEW."revision_reason" IS DISTINCT FROM OLD."revision_reason"
       OR NEW."remarks" IS DISTINCT FROM OLD."remarks"
       OR NEW."approval_instance_id" IS DISTINCT FROM OLD."approval_instance_id"
       OR NEW."submitted_by_user_id" IS DISTINCT FROM OLD."submitted_by_user_id"
       OR NEW."submitted_at" IS DISTINCT FROM OLD."submitted_at" THEN
      RAISE EXCEPTION 'Submitted Purchase Order revision is immutable';
    END IF;
  ELSIF NEW."approval_instance_id" IS NOT NULL OR NEW."submitted_at" IS NOT NULL THEN
    IF NEW."revision_reason" IS DISTINCT FROM OLD."revision_reason"
       OR NEW."remarks" IS DISTINCT FROM OLD."remarks" THEN
      RAISE EXCEPTION 'Purchase Order header cannot change during submission';
    END IF;
  END IF;

  IF OLD."cancelled_at" IS NULL AND NEW."cancelled_at" IS NOT NULL THEN
    IF NEW."cancelled_by_user_id" IS NULL
       OR NEW."cancellation_reason" IS NULL
       OR length(trim(NEW."cancellation_reason")) = 0 THEN
      RAISE EXCEPTION 'Purchase Order cancellation actor and reason are required';
    END IF;
  ELSIF NEW."cancelled_at" IS DISTINCT FROM OLD."cancelled_at"
     OR NEW."cancelled_by_user_id" IS DISTINCT FROM OLD."cancelled_by_user_id"
     OR NEW."cancellation_reason" IS DISTINCT FROM OLD."cancellation_reason" THEN
    RAISE EXCEPTION 'Purchase Order cancellation metadata is immutable';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER purchase_orders_history_guard
BEFORE UPDATE OR DELETE ON "purchase_orders"
FOR EACH ROW EXECUTE FUNCTION protect_purchase_order_history();

CREATE OR REPLACE FUNCTION validate_purchase_order_line()
RETURNS trigger AS $$
DECLARE
  po_company UUID;
  po_project UUID;
  po_supplier UUID;
  po_number_value VARCHAR(120);
  po_approval UUID;
  po_submitted TIMESTAMPTZ;
  po_cancelled TIMESTAMPTZ;
  award_rfq UUID;
  award_rfq_line UUID;
  award_quote UUID;
  award_quote_line UUID;
  award_supplier UUID;
  award_quantity DECIMAL(18,4);
  source_pr_line UUID;
  source_project UUID;
  source_company UUID;
  source_line_type VARCHAR(20);
  source_material UUID;
  source_material_code VARCHAR(80);
  source_description VARCHAR(500);
  source_uom UUID;
  source_uom_code VARCHAR(30);
  wbs_project UUID;
  cost_company UUID;
  material_company UUID;
  uom_company UUID;
BEGIN
  -- Serialize award-to-PO assignment even for direct database writers so two
  -- concurrent PO identities cannot both pass the historical-use check.
  PERFORM pg_advisory_xact_lock(
    hashtext('po-award:' || NEW."quotation_award_id"::text)
  );

  SELECT "company_id","project_id","supplier_id","po_number",
         "approval_instance_id","submitted_at","cancelled_at"
    INTO po_company,po_project,po_supplier,po_number_value,
         po_approval,po_submitted,po_cancelled
  FROM "purchase_orders"
  WHERE "id" = NEW."purchase_order_id";

  IF po_company IS NULL THEN
    RAISE EXCEPTION 'Purchase Order not found for line';
  END IF;
  IF po_approval IS NOT NULL OR po_submitted IS NOT NULL OR po_cancelled IS NOT NULL THEN
    RAISE EXCEPTION 'Only Draft Purchase Order lines are editable';
  END IF;

  SELECT qa."rfq_id",qa."rfq_line_id",qa."supplier_quotation_id",
         qa."supplier_quotation_line_id",qa."supplier_id",qa."quantity",
         rfl."purchase_request_line_id",r."project_id",r."company_id",
         prl."line_type",prl."material_id",prl."material_code_snapshot",
         prl."description",qa."uom_id",qa."uom_code_snapshot"
    INTO award_rfq,award_rfq_line,award_quote,award_quote_line,award_supplier,award_quantity,
         source_pr_line,source_project,source_company,
         source_line_type,source_material,source_material_code,
         source_description,source_uom,source_uom_code
  FROM "quotation_awards" qa
  JOIN "rfq_lines" rfl ON rfl."id" = qa."rfq_line_id"
  JOIN "rfqs" r ON r."id" = qa."rfq_id"
  JOIN "purchase_request_lines" prl ON prl."id" = rfl."purchase_request_line_id"
  WHERE qa."id" = NEW."quotation_award_id";

  IF award_rfq IS NULL THEN
    RAISE EXCEPTION 'Purchase Order source award not found';
  END IF;
  IF source_company <> po_company OR source_project <> po_project OR award_supplier <> po_supplier THEN
    RAISE EXCEPTION 'Purchase Order source award must match the PO Company, Project and Supplier';
  END IF;
  IF NEW."purchase_request_line_id" <> source_pr_line
     OR NEW."rfq_id" <> award_rfq
     OR NEW."rfq_line_id" <> award_rfq_line
     OR NEW."supplier_quotation_id" <> award_quote
     OR NEW."supplier_quotation_line_id" <> award_quote_line THEN
    RAISE EXCEPTION 'Purchase Order source traceability is inconsistent with the selected award';
  END IF;

  IF TG_OP = 'INSERT' THEN
    IF NEW."line_type" <> source_line_type
       OR NEW."material_id" IS DISTINCT FROM source_material
       OR NEW."material_code_snapshot" IS DISTINCT FROM source_material_code
       OR NEW."description" <> source_description
       OR NEW."uom_id" <> source_uom
       OR NEW."uom_code_snapshot" <> source_uom_code THEN
      RAISE EXCEPTION 'Initial Purchase Order line snapshots must match the awarded source';
    END IF;
  ELSE
    IF NEW."purchase_order_id" <> OLD."purchase_order_id"
       OR NEW."line_no" <> OLD."line_no"
       OR NEW."quotation_award_id" <> OLD."quotation_award_id"
       OR NEW."purchase_request_line_id" <> OLD."purchase_request_line_id"
       OR NEW."rfq_id" <> OLD."rfq_id"
       OR NEW."rfq_line_id" <> OLD."rfq_line_id"
       OR NEW."supplier_quotation_id" <> OLD."supplier_quotation_id"
       OR NEW."supplier_quotation_line_id" <> OLD."supplier_quotation_line_id"
       OR NEW."line_type" <> OLD."line_type"
       OR NEW."material_id" IS DISTINCT FROM OLD."material_id"
       OR NEW."material_code_snapshot" IS DISTINCT FROM OLD."material_code_snapshot"
       OR NEW."description" <> OLD."description"
       OR NEW."uom_id" <> OLD."uom_id"
       OR NEW."uom_code_snapshot" <> OLD."uom_code_snapshot" THEN
      RAISE EXCEPTION 'Purchase Order line source identity is immutable';
    END IF;
  END IF;

  IF EXISTS (
    SELECT 1
    FROM "purchase_order_lines" existing_line
    JOIN "purchase_orders" existing_po
      ON existing_po."id" = existing_line."purchase_order_id"
    WHERE existing_line."quotation_award_id" = NEW."quotation_award_id"
      AND existing_po."company_id" = po_company
      AND existing_po."po_number" <> po_number_value
  ) THEN
    RAISE EXCEPTION 'Quotation Award is already assigned to a different Purchase Order';
  END IF;

  IF NEW."wbs_id" IS NOT NULL THEN
    SELECT "project_id" INTO wbs_project FROM "wbs_elements" WHERE "id" = NEW."wbs_id";
    IF wbs_project IS NULL OR wbs_project <> po_project THEN
      RAISE EXCEPTION 'Purchase Order WBS must belong to the same Project';
    END IF;
  END IF;

  IF NEW."cost_code_id" IS NOT NULL THEN
    SELECT "company_id" INTO cost_company FROM "cost_codes" WHERE "id" = NEW."cost_code_id";
    IF cost_company IS NULL OR cost_company <> po_company THEN
      RAISE EXCEPTION 'Purchase Order Cost Code must belong to the same Company';
    END IF;
  END IF;

  IF NEW."material_id" IS NOT NULL THEN
    SELECT "company_id" INTO material_company FROM "materials" WHERE "id" = NEW."material_id";
    IF material_company IS NULL OR material_company <> po_company THEN
      RAISE EXCEPTION 'Purchase Order Material must belong to the same Company';
    END IF;
  END IF;

  SELECT "company_id" INTO uom_company FROM "units_of_measure" WHERE "id" = NEW."uom_id";
  IF uom_company IS NULL OR uom_company <> po_company THEN
    RAISE EXCEPTION 'Purchase Order UOM must belong to the same Company';
  END IF;

  IF NEW."quantity" > award_quantity THEN
    RAISE EXCEPTION 'Purchase Order quantity cannot exceed the selected Supplier Award quantity';
  END IF;

  IF NEW."amount" <> NEW."quantity" * NEW."unit_price" THEN
    RAISE EXCEPTION 'Purchase Order amount must equal quantity multiplied by unit price';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER purchase_order_lines_guard
BEFORE INSERT OR UPDATE ON "purchase_order_lines"
FOR EACH ROW EXECUTE FUNCTION validate_purchase_order_line();

CREATE OR REPLACE FUNCTION protect_purchase_order_line_delete()
RETURNS trigger AS $$
DECLARE
  po_approval UUID;
  po_submitted TIMESTAMPTZ;
  po_cancelled TIMESTAMPTZ;
BEGIN
  SELECT "approval_instance_id","submitted_at","cancelled_at"
    INTO po_approval,po_submitted,po_cancelled
  FROM "purchase_orders"
  WHERE "id" = OLD."purchase_order_id";

  IF po_approval IS NOT NULL OR po_submitted IS NOT NULL OR po_cancelled IS NOT NULL THEN
    RAISE EXCEPTION 'Submitted or Cancelled Purchase Order lines cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER purchase_order_lines_delete_guard
BEFORE DELETE ON "purchase_order_lines"
FOR EACH ROW EXECUTE FUNCTION protect_purchase_order_line_delete();
