CREATE TABLE "rfqs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "rfq_number" VARCHAR(120) NOT NULL,
  "rfq_date" DATE NOT NULL DEFAULT CURRENT_DATE,
  "closing_date" DATE,
  "remarks" TEXT,
  "created_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rfqs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rfqs_company_id_rfq_number_key" UNIQUE ("company_id","rfq_number"),
  CONSTRAINT "rfqs_dates_check" CHECK ("closing_date" IS NULL OR "closing_date" >= "rfq_date"),
  CONSTRAINT "rfqs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "rfqs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "rfqs_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "rfqs_company_id_project_id_created_at_idx" ON "rfqs"("company_id","project_id","created_at");

CREATE TABLE "rfq_lines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "rfq_id" UUID NOT NULL,
  "line_no" INTEGER NOT NULL,
  "purchase_request_line_id" UUID NOT NULL,
  "line_type" VARCHAR(20) NOT NULL,
  "material_code_snapshot" VARCHAR(80),
  "description" VARCHAR(500) NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "uom_id" UUID NOT NULL,
  "uom_code_snapshot" VARCHAR(30) NOT NULL,
  "required_on_site" DATE,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rfq_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rfq_lines_rfq_id_line_no_key" UNIQUE ("rfq_id","line_no"),
  CONSTRAINT "rfq_lines_rfq_id_purchase_request_line_id_key" UNIQUE ("rfq_id","purchase_request_line_id"),
  CONSTRAINT "rfq_lines_line_no_check" CHECK ("line_no" > 0),
  CONSTRAINT "rfq_lines_line_type_check" CHECK ("line_type" IN ('MATERIAL','SERVICE')),
  CONSTRAINT "rfq_lines_material_snapshot_check" CHECK (
    ("line_type" = 'MATERIAL' AND "material_code_snapshot" IS NOT NULL)
    OR ("line_type" = 'SERVICE' AND "material_code_snapshot" IS NULL)
  ),
  CONSTRAINT "rfq_lines_description_check" CHECK (length(trim("description")) > 0),
  CONSTRAINT "rfq_lines_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "rfq_lines_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "rfq_lines_purchase_request_line_id_fkey" FOREIGN KEY ("purchase_request_line_id") REFERENCES "purchase_request_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "rfq_lines_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "rfq_lines_purchase_request_line_id_idx" ON "rfq_lines"("purchase_request_line_id");
CREATE INDEX "rfq_lines_uom_id_idx" ON "rfq_lines"("uom_id");

CREATE TABLE "rfq_suppliers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "rfq_id" UUID NOT NULL,
  "supplier_id" UUID NOT NULL,
  "supplier_code_snapshot" VARCHAR(50) NOT NULL,
  "supplier_name_snapshot" VARCHAR(200) NOT NULL,
  "invited_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "rfq_suppliers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "rfq_suppliers_rfq_id_supplier_id_key" UNIQUE ("rfq_id","supplier_id"),
  CONSTRAINT "rfq_suppliers_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "rfq_suppliers_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "rfq_suppliers_supplier_id_idx" ON "rfq_suppliers"("supplier_id");

CREATE TABLE "supplier_quotations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "rfq_id" UUID NOT NULL,
  "supplier_id" UUID NOT NULL,
  "supplier_reference" VARCHAR(150),
  "quotation_date" DATE NOT NULL,
  "validity_date" DATE,
  "remarks" TEXT,
  "created_by_user_id" UUID NOT NULL,
  "updated_by_user_id" UUID NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supplier_quotations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "supplier_quotations_rfq_id_supplier_id_key" UNIQUE ("rfq_id","supplier_id"),
  CONSTRAINT "supplier_quotations_dates_check" CHECK ("validity_date" IS NULL OR "validity_date" >= "quotation_date"),
  CONSTRAINT "supplier_quotations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "supplier_quotations_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "supplier_quotations_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "supplier_quotations_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "supplier_quotations_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "supplier_quotations_company_id_rfq_id_idx" ON "supplier_quotations"("company_id","rfq_id");
CREATE INDEX "supplier_quotations_supplier_id_idx" ON "supplier_quotations"("supplier_id");

CREATE TABLE "supplier_quotation_lines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "supplier_quotation_id" UUID NOT NULL,
  "rfq_line_id" UUID NOT NULL,
  "line_no" INTEGER NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "uom_id" UUID NOT NULL,
  "uom_code_snapshot" VARCHAR(30) NOT NULL,
  "unit_price" DECIMAL(18,4) NOT NULL,
  "amount" DECIMAL(38,8) NOT NULL,
  "remarks" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "supplier_quotation_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "supplier_quotation_lines_supplier_quotation_id_rfq_line_id_key" UNIQUE ("supplier_quotation_id","rfq_line_id"),
  CONSTRAINT "supplier_quotation_lines_supplier_quotation_id_line_no_key" UNIQUE ("supplier_quotation_id","line_no"),
  CONSTRAINT "supplier_quotation_lines_line_no_check" CHECK ("line_no" > 0),
  CONSTRAINT "supplier_quotation_lines_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "supplier_quotation_lines_unit_price_check" CHECK ("unit_price" >= 0),
  CONSTRAINT "supplier_quotation_lines_amount_check" CHECK ("amount" = "quantity" * "unit_price"),
  CONSTRAINT "supplier_quotation_lines_supplier_quotation_id_fkey" FOREIGN KEY ("supplier_quotation_id") REFERENCES "supplier_quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "supplier_quotation_lines_rfq_line_id_fkey" FOREIGN KEY ("rfq_line_id") REFERENCES "rfq_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "supplier_quotation_lines_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "supplier_quotation_lines_rfq_line_id_idx" ON "supplier_quotation_lines"("rfq_line_id");
CREATE INDEX "supplier_quotation_lines_uom_id_idx" ON "supplier_quotation_lines"("uom_id");

CREATE TABLE "quotation_awards" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "rfq_id" UUID NOT NULL,
  "rfq_line_id" UUID NOT NULL,
  "supplier_quotation_id" UUID NOT NULL,
  "supplier_quotation_line_id" UUID NOT NULL,
  "supplier_id" UUID NOT NULL,
  "supplier_code_snapshot" VARCHAR(50) NOT NULL,
  "supplier_name_snapshot" VARCHAR(200) NOT NULL,
  "supplier_reference_snapshot" VARCHAR(150),
  "quotation_date_snapshot" DATE NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "uom_id" UUID NOT NULL,
  "uom_code_snapshot" VARCHAR(30) NOT NULL,
  "unit_price" DECIMAL(18,4) NOT NULL,
  "amount" DECIMAL(38,8) NOT NULL,
  "decision_reason" TEXT,
  "selected_by_user_id" UUID NOT NULL,
  "selected_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "quotation_awards_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "quotation_awards_rfq_line_id_key" UNIQUE ("rfq_line_id"),
  CONSTRAINT "quotation_awards_supplier_quotation_line_id_key" UNIQUE ("supplier_quotation_line_id"),
  CONSTRAINT "quotation_awards_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "quotation_awards_unit_price_check" CHECK ("unit_price" >= 0),
  CONSTRAINT "quotation_awards_amount_check" CHECK ("amount" = "quantity" * "unit_price"),
  CONSTRAINT "quotation_awards_rfq_id_fkey" FOREIGN KEY ("rfq_id") REFERENCES "rfqs"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "quotation_awards_rfq_line_id_fkey" FOREIGN KEY ("rfq_line_id") REFERENCES "rfq_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "quotation_awards_supplier_quotation_id_fkey" FOREIGN KEY ("supplier_quotation_id") REFERENCES "supplier_quotations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "quotation_awards_supplier_quotation_line_id_fkey" FOREIGN KEY ("supplier_quotation_line_id") REFERENCES "supplier_quotation_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "quotation_awards_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "quotation_awards_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "quotation_awards_selected_by_user_id_fkey" FOREIGN KEY ("selected_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);
CREATE INDEX "quotation_awards_rfq_id_idx" ON "quotation_awards"("rfq_id");
CREATE INDEX "quotation_awards_supplier_quotation_id_idx" ON "quotation_awards"("supplier_quotation_id");
CREATE INDEX "quotation_awards_supplier_id_idx" ON "quotation_awards"("supplier_id");
CREATE INDEX "quotation_awards_selected_by_user_id_idx" ON "quotation_awards"("selected_by_user_id");

CREATE OR REPLACE FUNCTION validate_rfq_scope()
RETURNS trigger AS $$
DECLARE
  project_company UUID;
  creator_company UUID;
BEGIN
  SELECT "company_id" INTO project_company FROM "projects" WHERE "id" = NEW."project_id";
  SELECT "company_id" INTO creator_company FROM "users" WHERE "id" = NEW."created_by_user_id";
  IF project_company IS NULL OR project_company <> NEW."company_id" THEN
    RAISE EXCEPTION 'RFQ Company must match Project Company';
  END IF;
  IF creator_company IS NULL OR creator_company <> NEW."company_id" THEN
    RAISE EXCEPTION 'RFQ creator must belong to the same Company';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rfqs_scope_guard
BEFORE INSERT OR UPDATE ON "rfqs"
FOR EACH ROW EXECUTE FUNCTION validate_rfq_scope();

CREATE OR REPLACE FUNCTION protect_rfq_identity()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'RFQs are retained history and cannot be deleted';
  END IF;
  IF NEW."company_id" <> OLD."company_id"
     OR NEW."project_id" <> OLD."project_id"
     OR NEW."rfq_number" <> OLD."rfq_number"
     OR NEW."rfq_date" <> OLD."rfq_date"
     OR NEW."created_by_user_id" <> OLD."created_by_user_id"
     OR NEW."created_at" <> OLD."created_at" THEN
    RAISE EXCEPTION 'RFQ business identity is immutable';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rfqs_history_guard
BEFORE UPDATE OR DELETE ON "rfqs"
FOR EACH ROW EXECUTE FUNCTION protect_rfq_identity();

CREATE OR REPLACE FUNCTION validate_rfq_line_source()
RETURNS trigger AS $$
DECLARE
  rfq_company UUID;
  rfq_project UUID;
  pr_company UUID;
  pr_project UUID;
  pr_approval_state VARCHAR(30);
  pr_cancelled TIMESTAMPTZ;
  pr_line_type VARCHAR(20);
  pr_material_code VARCHAR(80);
  pr_description VARCHAR(500);
  pr_quantity DECIMAL(18,4);
  pr_uom UUID;
  pr_uom_code VARCHAR(30);
  pr_required DATE;
BEGIN
  SELECT "company_id","project_id" INTO rfq_company,rfq_project
  FROM "rfqs" WHERE "id" = NEW."rfq_id";

  SELECT pr."company_id",pr."project_id",ai."approval_state",pr."cancelled_at",
         prl."line_type",prl."material_code_snapshot",prl."description",
         prl."quantity",prl."uom_id",u."uom_code",prl."required_on_site"
    INTO pr_company,pr_project,pr_approval_state,pr_cancelled,
         pr_line_type,pr_material_code,pr_description,pr_quantity,pr_uom,
         pr_uom_code,pr_required
  FROM "purchase_request_lines" prl
  JOIN "purchase_requests" pr ON pr."id" = prl."purchase_request_id"
  LEFT JOIN "approval_instances" ai ON ai."id" = pr."approval_instance_id"
  JOIN "units_of_measure" u ON u."id" = prl."uom_id"
  WHERE prl."id" = NEW."purchase_request_line_id";

  IF rfq_company IS NULL OR pr_company IS NULL THEN
    RAISE EXCEPTION 'RFQ or Purchase Request source line not found';
  END IF;
  IF pr_company <> rfq_company OR pr_project <> rfq_project THEN
    RAISE EXCEPTION 'RFQ source Purchase Request line must belong to the same Company and Project';
  END IF;
  IF pr_approval_state <> 'APPROVED' OR pr_cancelled IS NOT NULL THEN
    RAISE EXCEPTION 'RFQ source must be an active approved Purchase Request line';
  END IF;
  IF NEW."quantity" > pr_quantity THEN
    RAISE EXCEPTION 'RFQ line quantity cannot exceed approved Purchase Request demand';
  END IF;
  IF NEW."line_type" <> pr_line_type
     OR NEW."description" <> pr_description
     OR NEW."uom_id" <> pr_uom
     OR NEW."uom_code_snapshot" <> pr_uom_code
     OR NEW."material_code_snapshot" IS DISTINCT FROM pr_material_code
     OR NEW."required_on_site" IS DISTINCT FROM pr_required THEN
    RAISE EXCEPTION 'RFQ source snapshots must match the approved Purchase Request line';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rfq_lines_source_guard
BEFORE INSERT ON "rfq_lines"
FOR EACH ROW EXECUTE FUNCTION validate_rfq_line_source();

CREATE OR REPLACE FUNCTION protect_rfq_line_history()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'RFQ source lines are immutable retained history';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rfq_lines_history_guard
BEFORE UPDATE OR DELETE ON "rfq_lines"
FOR EACH ROW EXECUTE FUNCTION protect_rfq_line_history();

CREATE OR REPLACE FUNCTION validate_rfq_supplier()
RETURNS trigger AS $$
DECLARE
  rfq_company UUID;
  supplier_company UUID;
  supplier_active BOOLEAN;
  supplier_code VARCHAR(50);
  supplier_name VARCHAR(200);
BEGIN
  SELECT "company_id" INTO rfq_company FROM "rfqs" WHERE "id" = NEW."rfq_id";
  SELECT "company_id","is_active","supplier_code","supplier_name"
    INTO supplier_company,supplier_active,supplier_code,supplier_name
  FROM "suppliers" WHERE "id" = NEW."supplier_id";
  IF rfq_company IS NULL OR supplier_company IS NULL
     OR supplier_company <> rfq_company OR NOT supplier_active THEN
    RAISE EXCEPTION 'RFQ Supplier must be active and belong to the same Company';
  END IF;
  IF NEW."supplier_code_snapshot" <> supplier_code
     OR NEW."supplier_name_snapshot" <> supplier_name THEN
    RAISE EXCEPTION 'RFQ Supplier snapshots must match the invited Supplier';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rfq_suppliers_scope_guard
BEFORE INSERT ON "rfq_suppliers"
FOR EACH ROW EXECUTE FUNCTION validate_rfq_supplier();

CREATE OR REPLACE FUNCTION protect_rfq_supplier_history()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'RFQ Supplier invitations are retained history';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER rfq_suppliers_history_guard
BEFORE UPDATE OR DELETE ON "rfq_suppliers"
FOR EACH ROW EXECUTE FUNCTION protect_rfq_supplier_history();

CREATE OR REPLACE FUNCTION validate_supplier_quotation()
RETURNS trigger AS $$
DECLARE
  rfq_company UUID;
  creator_company UUID;
  updater_company UUID;
BEGIN
  SELECT "company_id" INTO rfq_company FROM "rfqs" WHERE "id" = NEW."rfq_id";
  SELECT "company_id" INTO creator_company FROM "users" WHERE "id" = NEW."created_by_user_id";
  SELECT "company_id" INTO updater_company FROM "users" WHERE "id" = NEW."updated_by_user_id";
  IF rfq_company IS NULL OR rfq_company <> NEW."company_id" THEN
    RAISE EXCEPTION 'Supplier Quotation Company must match RFQ Company';
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM "rfq_suppliers"
    WHERE "rfq_id" = NEW."rfq_id" AND "supplier_id" = NEW."supplier_id"
  ) THEN
    RAISE EXCEPTION 'Supplier must be invited to the RFQ before quotation capture';
  END IF;
  IF creator_company IS NULL OR creator_company <> NEW."company_id"
     OR updater_company IS NULL OR updater_company <> NEW."company_id" THEN
    RAISE EXCEPTION 'Supplier Quotation users must belong to the same Company';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER supplier_quotations_scope_guard
BEFORE INSERT OR UPDATE ON "supplier_quotations"
FOR EACH ROW EXECUTE FUNCTION validate_supplier_quotation();

CREATE OR REPLACE FUNCTION protect_supplier_quotation_history()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Supplier Quotations are retained history and cannot be deleted';
  END IF;
  IF NEW."company_id" <> OLD."company_id"
     OR NEW."rfq_id" <> OLD."rfq_id"
     OR NEW."supplier_id" <> OLD."supplier_id"
     OR NEW."created_by_user_id" <> OLD."created_by_user_id"
     OR NEW."created_at" <> OLD."created_at" THEN
    RAISE EXCEPTION 'Supplier Quotation identity is immutable';
  END IF;
  IF EXISTS (
    SELECT 1 FROM "quotation_awards"
    WHERE "supplier_quotation_id" = OLD."id"
  ) AND (
    NEW."supplier_reference" IS DISTINCT FROM OLD."supplier_reference"
    OR NEW."quotation_date" IS DISTINCT FROM OLD."quotation_date"
    OR NEW."validity_date" IS DISTINCT FROM OLD."validity_date"
    OR NEW."remarks" IS DISTINCT FROM OLD."remarks"
  ) THEN
    RAISE EXCEPTION 'Awarded Supplier Quotation header is frozen';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER supplier_quotations_history_guard
BEFORE UPDATE OR DELETE ON "supplier_quotations"
FOR EACH ROW EXECUTE FUNCTION protect_supplier_quotation_history();

CREATE OR REPLACE FUNCTION validate_supplier_quotation_line()
RETURNS trigger AS $$
DECLARE
  quote_rfq UUID;
  line_rfq UUID;
  line_no_expected INTEGER;
  line_quantity DECIMAL(18,4);
  line_uom UUID;
  line_uom_code VARCHAR(30);
BEGIN
  SELECT "rfq_id" INTO quote_rfq
  FROM "supplier_quotations" WHERE "id" = NEW."supplier_quotation_id";
  SELECT "rfq_id","line_no","quantity","uom_id","uom_code_snapshot"
    INTO line_rfq,line_no_expected,line_quantity,line_uom,line_uom_code
  FROM "rfq_lines" WHERE "id" = NEW."rfq_line_id";

  IF quote_rfq IS NULL OR line_rfq IS NULL OR quote_rfq <> line_rfq THEN
    RAISE EXCEPTION 'Supplier Quotation line must reference an RFQ line from the same RFQ';
  END IF;
  IF NEW."line_no" <> line_no_expected THEN
    RAISE EXCEPTION 'Supplier Quotation line number must match the RFQ line';
  END IF;
  IF NEW."quantity" > line_quantity THEN
    RAISE EXCEPTION 'Supplier Quotation quantity cannot exceed the RFQ requested quantity';
  END IF;
  IF NEW."uom_id" <> line_uom OR NEW."uom_code_snapshot" <> line_uom_code THEN
    RAISE EXCEPTION 'Supplier Quotation UOM must match the RFQ line';
  END IF;
  IF NEW."amount" <> NEW."quantity" * NEW."unit_price" THEN
    RAISE EXCEPTION 'Supplier Quotation amount must equal quantity multiplied by unit price';
  END IF;
  IF TG_OP = 'UPDATE' AND EXISTS (
    SELECT 1 FROM "quotation_awards"
    WHERE "supplier_quotation_line_id" = OLD."id"
  ) THEN
    RAISE EXCEPTION 'Awarded Supplier Quotation line is frozen';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER supplier_quotation_lines_guard
BEFORE INSERT OR UPDATE ON "supplier_quotation_lines"
FOR EACH ROW EXECUTE FUNCTION validate_supplier_quotation_line();

CREATE OR REPLACE FUNCTION protect_supplier_quotation_line_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Supplier Quotation lines are retained history and cannot be deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER supplier_quotation_lines_delete_guard
BEFORE DELETE ON "supplier_quotation_lines"
FOR EACH ROW EXECUTE FUNCTION protect_supplier_quotation_line_delete();

CREATE OR REPLACE FUNCTION validate_quotation_award()
RETURNS trigger AS $$
DECLARE
  award_rfq UUID;
  quote_rfq UUID;
  quote_supplier UUID;
  quote_reference VARCHAR(150);
  quote_date DATE;
  ql_rfq_line UUID;
  ql_quantity DECIMAL(18,4);
  ql_uom UUID;
  ql_uom_code VARCHAR(30);
  ql_price DECIMAL(18,4);
  ql_amount DECIMAL(38,8);
  supplier_code VARCHAR(50);
  supplier_name VARCHAR(200);
  selector_company UUID;
  rfq_company UUID;
  source_pr_line UUID;
  source_pr_qty DECIMAL(18,4);
  source_pr_state VARCHAR(30);
  source_pr_cancelled TIMESTAMPTZ;
  already_awarded DECIMAL(38,4);
BEGIN
  SELECT "company_id" INTO rfq_company FROM "rfqs" WHERE "id" = NEW."rfq_id";
  SELECT "rfq_id","supplier_id","supplier_reference","quotation_date"
    INTO quote_rfq,quote_supplier,quote_reference,quote_date
  FROM "supplier_quotations" WHERE "id" = NEW."supplier_quotation_id";
  SELECT sqln."rfq_line_id",sqln."quantity",sqln."uom_id",sqln."uom_code_snapshot",
         sqln."unit_price",sqln."amount"
    INTO ql_rfq_line,ql_quantity,ql_uom,ql_uom_code,ql_price,ql_amount
  FROM "supplier_quotation_lines" sqln
  WHERE sqln."id" = NEW."supplier_quotation_line_id";
  SELECT "supplier_code","supplier_name" INTO supplier_code,supplier_name
  FROM "suppliers" WHERE "id" = NEW."supplier_id";
  SELECT "company_id" INTO selector_company
  FROM "users" WHERE "id" = NEW."selected_by_user_id";

  IF rfq_company IS NULL OR quote_rfq IS NULL OR ql_rfq_line IS NULL THEN
    RAISE EXCEPTION 'Quotation Award source not found';
  END IF;
  IF quote_rfq <> NEW."rfq_id"
     OR ql_rfq_line <> NEW."rfq_line_id"
     OR quote_supplier <> NEW."supplier_id" THEN
    RAISE EXCEPTION 'Quotation Award source references are inconsistent';
  END IF;
  IF selector_company IS NULL OR selector_company <> rfq_company THEN
    RAISE EXCEPTION 'Quotation Award selector must belong to the RFQ Company';
  END IF;
  IF NEW."supplier_code_snapshot" <> supplier_code
     OR NEW."supplier_name_snapshot" <> supplier_name
     OR NEW."supplier_reference_snapshot" IS DISTINCT FROM quote_reference
     OR NEW."quotation_date_snapshot" <> quote_date
     OR NEW."quantity" <> ql_quantity
     OR NEW."uom_id" <> ql_uom
     OR NEW."uom_code_snapshot" <> ql_uom_code
     OR NEW."unit_price" <> ql_price
     OR NEW."amount" <> ql_amount THEN
    RAISE EXCEPTION 'Quotation Award snapshots must match the selected quotation line';
  END IF;

  SELECT rfl."purchase_request_line_id",prl."quantity",ai."approval_state",pr."cancelled_at"
    INTO source_pr_line,source_pr_qty,source_pr_state,source_pr_cancelled
  FROM "rfq_lines" rfl
  JOIN "purchase_request_lines" prl ON prl."id" = rfl."purchase_request_line_id"
  JOIN "purchase_requests" pr ON pr."id" = prl."purchase_request_id"
  LEFT JOIN "approval_instances" ai ON ai."id" = pr."approval_instance_id"
  WHERE rfl."id" = NEW."rfq_line_id";

  IF source_pr_state <> 'APPROVED' OR source_pr_cancelled IS NOT NULL THEN
    RAISE EXCEPTION 'Quotation Award requires active approved Purchase Request demand';
  END IF;

  SELECT COALESCE(SUM(qa."quantity"),0)
    INTO already_awarded
  FROM "quotation_awards" qa
  JOIN "rfq_lines" existing_rfl ON existing_rfl."id" = qa."rfq_line_id"
  WHERE existing_rfl."purchase_request_line_id" = source_pr_line
    AND qa."id" <> NEW."id";

  IF already_awarded + NEW."quantity" > source_pr_qty THEN
    RAISE EXCEPTION 'Quotation Award would exceed approved Purchase Request demand';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quotation_awards_guard
BEFORE INSERT ON "quotation_awards"
FOR EACH ROW EXECUTE FUNCTION validate_quotation_award();

CREATE OR REPLACE FUNCTION protect_quotation_award_history()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Quotation Awards are immutable retained commercial history';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER quotation_awards_history_guard
BEFORE UPDATE OR DELETE ON "quotation_awards"
FOR EACH ROW EXECUTE FUNCTION protect_quotation_award_history();
