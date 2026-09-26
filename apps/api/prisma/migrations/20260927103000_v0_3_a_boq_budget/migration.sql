CREATE TABLE "boqs" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "boq_name" VARCHAR(200) NOT NULL DEFAULT 'Project BOQ',
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "boqs_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "boqs_project_id_key" UNIQUE ("project_id"),
  CONSTRAINT "boqs_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "boqs_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "boqs_company_id_idx" ON "boqs"("company_id");

CREATE TABLE "boq_sections" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "boq_id" UUID NOT NULL,
  "section_code" VARCHAR(80) NOT NULL,
  "section_name" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "boq_sections_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "boq_sections_boq_id_section_code_key" UNIQUE ("boq_id","section_code"),
  CONSTRAINT "boq_sections_boq_id_fkey" FOREIGN KEY ("boq_id") REFERENCES "boqs"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "boq_sections_boq_id_is_active_sort_order_idx"
  ON "boq_sections"("boq_id","is_active","sort_order");

CREATE TABLE "boq_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "boq_id" UUID NOT NULL,
  "section_id" UUID NOT NULL,
  "item_code" VARCHAR(80) NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "uom_id" UUID NOT NULL,
  "rate" DECIMAL(18,4) NOT NULL,
  "amount" DECIMAL(20,4) NOT NULL,
  "wbs_id" UUID,
  "cost_code_id" UUID,
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  "is_active" BOOLEAN NOT NULL DEFAULT TRUE,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "boq_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "boq_items_boq_id_item_code_key" UNIQUE ("boq_id","item_code"),
  CONSTRAINT "boq_items_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "boq_items_rate_check" CHECK ("rate" >= 0),
  CONSTRAINT "boq_items_amount_check" CHECK ("amount" = ROUND("quantity" * "rate", 4)),
  CONSTRAINT "boq_items_boq_id_fkey" FOREIGN KEY ("boq_id") REFERENCES "boqs"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "boq_items_section_id_fkey" FOREIGN KEY ("section_id") REFERENCES "boq_sections"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "boq_items_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "boq_items_wbs_id_fkey" FOREIGN KEY ("wbs_id") REFERENCES "wbs_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "boq_items_cost_code_id_fkey" FOREIGN KEY ("cost_code_id") REFERENCES "cost_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "boq_items_boq_id_section_id_is_active_sort_order_idx"
  ON "boq_items"("boq_id","section_id","is_active","sort_order");
CREATE INDEX "boq_items_wbs_id_idx" ON "boq_items"("wbs_id");
CREATE INDEX "boq_items_cost_code_id_idx" ON "boq_items"("cost_code_id");
CREATE INDEX "boq_items_uom_id_idx" ON "boq_items"("uom_id");

CREATE TABLE "budget_revisions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "revision_no" INTEGER NOT NULL,
  "revision_number" VARCHAR(120) NOT NULL,
  "approval_instance_id" UUID,
  "submitted_by_user_id" UUID NOT NULL,
  "submitted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "revision_note" TEXT,
  CONSTRAINT "budget_revisions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "budget_revisions_approval_instance_id_key" UNIQUE ("approval_instance_id"),
  CONSTRAINT "budget_revisions_company_id_revision_number_key" UNIQUE ("company_id","revision_number"),
  CONSTRAINT "budget_revisions_project_id_revision_no_key" UNIQUE ("project_id","revision_no"),
  CONSTRAINT "budget_revisions_revision_no_check" CHECK ("revision_no" > 0),
  CONSTRAINT "budget_revisions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "budget_revisions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "budget_revisions_approval_instance_id_fkey" FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "budget_revisions_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "budget_revisions_company_id_project_id_submitted_at_idx"
  ON "budget_revisions"("company_id","project_id","submitted_at");

CREATE TABLE "budget_revision_lines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "budget_revision_id" UUID NOT NULL,
  "boq_item_id" UUID NOT NULL,
  "section_code" VARCHAR(80) NOT NULL,
  "section_name" VARCHAR(200) NOT NULL,
  "item_code" VARCHAR(80) NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "uom_id" UUID NOT NULL,
  "uom_code" VARCHAR(30) NOT NULL,
  "uom_name" VARCHAR(100) NOT NULL,
  "rate" DECIMAL(18,4) NOT NULL,
  "amount" DECIMAL(20,4) NOT NULL,
  "wbs_id" UUID,
  "wbs_code" VARCHAR(80),
  "wbs_name" VARCHAR(200),
  "cost_code_id" UUID,
  "cost_code" VARCHAR(80),
  "cost_name" VARCHAR(200),
  "sort_order" INTEGER NOT NULL DEFAULT 0,
  CONSTRAINT "budget_revision_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "budget_revision_lines_budget_revision_id_boq_item_id_key" UNIQUE ("budget_revision_id","boq_item_id"),
  CONSTRAINT "budget_revision_lines_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "budget_revision_lines_rate_check" CHECK ("rate" >= 0),
  CONSTRAINT "budget_revision_lines_amount_check" CHECK ("amount" = ROUND("quantity" * "rate", 4)),
  CONSTRAINT "budget_revision_lines_budget_revision_id_fkey" FOREIGN KEY ("budget_revision_id") REFERENCES "budget_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "budget_revision_lines_boq_item_id_fkey" FOREIGN KEY ("boq_item_id") REFERENCES "boq_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "budget_revision_lines_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "budget_revision_lines_wbs_id_fkey" FOREIGN KEY ("wbs_id") REFERENCES "wbs_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "budget_revision_lines_cost_code_id_fkey" FOREIGN KEY ("cost_code_id") REFERENCES "cost_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "budget_revision_lines_budget_revision_id_section_code_sort_order_idx"
  ON "budget_revision_lines"("budget_revision_id","section_code","sort_order");
CREATE INDEX "budget_revision_lines_wbs_id_idx" ON "budget_revision_lines"("wbs_id");
CREATE INDEX "budget_revision_lines_cost_code_id_idx" ON "budget_revision_lines"("cost_code_id");

CREATE OR REPLACE FUNCTION validate_boq_company_project()
RETURNS trigger AS $$
DECLARE
  project_company UUID;
BEGIN
  SELECT "company_id" INTO project_company
  FROM "projects" WHERE "id" = NEW."project_id";
  IF project_company IS NULL OR project_company <> NEW."company_id" THEN
    RAISE EXCEPTION 'BOQ Company must match Project Company';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER boqs_company_project_guard
BEFORE INSERT OR UPDATE ON "boqs"
FOR EACH ROW EXECUTE FUNCTION validate_boq_company_project();

CREATE OR REPLACE FUNCTION validate_boq_item_scope()
RETURNS trigger AS $$
DECLARE
  boq_company UUID;
  boq_project UUID;
  section_boq UUID;
  uom_company UUID;
  wbs_project UUID;
  cost_company UUID;
BEGIN
  SELECT b."company_id", b."project_id"
    INTO boq_company, boq_project
  FROM "boqs" b WHERE b."id" = NEW."boq_id";

  SELECT "boq_id" INTO section_boq
  FROM "boq_sections" WHERE "id" = NEW."section_id";

  IF section_boq IS NULL OR section_boq <> NEW."boq_id" THEN
    RAISE EXCEPTION 'BOQ Item Section must belong to the same BOQ';
  END IF;

  SELECT "company_id" INTO uom_company
  FROM "units_of_measure" WHERE "id" = NEW."uom_id";
  IF uom_company IS NULL OR uom_company <> boq_company THEN
    RAISE EXCEPTION 'BOQ Item UOM must belong to the same Company';
  END IF;

  IF NEW."wbs_id" IS NOT NULL THEN
    SELECT "project_id" INTO wbs_project
    FROM "wbs_elements" WHERE "id" = NEW."wbs_id";
    IF wbs_project IS NULL OR wbs_project <> boq_project THEN
      RAISE EXCEPTION 'BOQ Item WBS must belong to the same Project';
    END IF;
  END IF;

  IF NEW."cost_code_id" IS NOT NULL THEN
    SELECT "company_id" INTO cost_company
    FROM "cost_codes" WHERE "id" = NEW."cost_code_id";
    IF cost_company IS NULL OR cost_company <> boq_company THEN
      RAISE EXCEPTION 'BOQ Item Cost Code must belong to the same Company';
    END IF;
  END IF;

  NEW."amount" := ROUND(NEW."quantity" * NEW."rate", 4);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER boq_items_scope_guard
BEFORE INSERT OR UPDATE ON "boq_items"
FOR EACH ROW EXECUTE FUNCTION validate_boq_item_scope();

CREATE OR REPLACE FUNCTION validate_budget_revision_scope()
RETURNS trigger AS $$
DECLARE
  project_company UUID;
  submitter_company UUID;
  approval_company UUID;
  approval_entity_type VARCHAR(100);
  approval_entity_id UUID;
BEGIN
  SELECT "company_id" INTO project_company
  FROM "projects" WHERE "id" = NEW."project_id";
  SELECT "company_id" INTO submitter_company
  FROM "users" WHERE "id" = NEW."submitted_by_user_id";

  IF project_company IS NULL OR project_company <> NEW."company_id" THEN
    RAISE EXCEPTION 'Budget Revision Company must match Project Company';
  END IF;
  IF submitter_company IS NULL OR submitter_company <> NEW."company_id" THEN
    RAISE EXCEPTION 'Budget Revision submitter must belong to the same Company';
  END IF;

  IF NEW."approval_instance_id" IS NOT NULL THEN
    SELECT "company_id","entity_type","entity_id"
      INTO approval_company,approval_entity_type,approval_entity_id
    FROM "approval_instances"
    WHERE "id" = NEW."approval_instance_id";

    IF approval_company IS NULL
       OR approval_company <> NEW."company_id"
       OR approval_entity_type <> 'BUDGET_REVISION'
       OR approval_entity_id <> NEW."id" THEN
      RAISE EXCEPTION 'Budget Revision approval instance is inconsistent';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER budget_revisions_scope_guard
BEFORE INSERT OR UPDATE ON "budget_revisions"
FOR EACH ROW EXECUTE FUNCTION validate_budget_revision_scope();

CREATE OR REPLACE FUNCTION validate_budget_revision_line_scope()
RETURNS trigger AS $$
DECLARE
  revision_company UUID;
  revision_project UUID;
  approval_id UUID;
  item_boq UUID;
  item_project UUID;
  item_company UUID;
  uom_company UUID;
  wbs_project UUID;
  cost_company UUID;
BEGIN
  SELECT "company_id","project_id","approval_instance_id"
    INTO revision_company,revision_project,approval_id
  FROM "budget_revisions"
  WHERE "id" = NEW."budget_revision_id";

  IF approval_id IS NOT NULL THEN
    RAISE EXCEPTION 'Budget Revision snapshot is immutable after submission';
  END IF;

  SELECT i."boq_id", b."project_id", b."company_id"
    INTO item_boq,item_project,item_company
  FROM "boq_items" i
  JOIN "boqs" b ON b."id" = i."boq_id"
  WHERE i."id" = NEW."boq_item_id";

  IF item_boq IS NULL
     OR item_project <> revision_project
     OR item_company <> revision_company THEN
    RAISE EXCEPTION 'Budget Revision line BOQ Item must belong to the same Project and Company';
  END IF;

  SELECT "company_id" INTO uom_company
  FROM "units_of_measure" WHERE "id" = NEW."uom_id";
  IF uom_company IS NULL OR uom_company <> revision_company THEN
    RAISE EXCEPTION 'Budget Revision line UOM must belong to the same Company';
  END IF;

  IF NEW."wbs_id" IS NOT NULL THEN
    SELECT "project_id" INTO wbs_project
    FROM "wbs_elements" WHERE "id" = NEW."wbs_id";
    IF wbs_project IS NULL OR wbs_project <> revision_project THEN
      RAISE EXCEPTION 'Budget Revision line WBS must belong to the same Project';
    END IF;
  END IF;

  IF NEW."cost_code_id" IS NOT NULL THEN
    SELECT "company_id" INTO cost_company
    FROM "cost_codes" WHERE "id" = NEW."cost_code_id";
    IF cost_company IS NULL OR cost_company <> revision_company THEN
      RAISE EXCEPTION 'Budget Revision line Cost Code must belong to the same Company';
    END IF;
  END IF;

  NEW."amount" := ROUND(NEW."quantity" * NEW."rate", 4);
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER budget_revision_lines_scope_guard
BEFORE INSERT ON "budget_revision_lines"
FOR EACH ROW EXECUTE FUNCTION validate_budget_revision_line_scope();

CREATE OR REPLACE FUNCTION prevent_budget_revision_line_mutation()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Budget Revision snapshot lines are immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER budget_revision_lines_no_update
BEFORE UPDATE ON "budget_revision_lines"
FOR EACH ROW EXECUTE FUNCTION prevent_budget_revision_line_mutation();

CREATE TRIGGER budget_revision_lines_no_delete
BEFORE DELETE ON "budget_revision_lines"
FOR EACH ROW EXECUTE FUNCTION prevent_budget_revision_line_mutation();

CREATE OR REPLACE FUNCTION prevent_budget_revision_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'Budget Revision history cannot be deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER budget_revisions_no_delete
BEFORE DELETE ON "budget_revisions"
FOR EACH ROW EXECUTE FUNCTION prevent_budget_revision_delete();

CREATE OR REPLACE FUNCTION guard_budget_revision_update()
RETURNS trigger AS $$
BEGIN
  IF OLD."approval_instance_id" IS NULL
     AND NEW."approval_instance_id" IS NOT NULL
     AND OLD."company_id" = NEW."company_id"
     AND OLD."project_id" = NEW."project_id"
     AND OLD."revision_no" = NEW."revision_no"
     AND OLD."revision_number" = NEW."revision_number"
     AND OLD."submitted_by_user_id" = NEW."submitted_by_user_id"
     AND OLD."submitted_at" = NEW."submitted_at"
     AND OLD."revision_note" IS NOT DISTINCT FROM NEW."revision_note" THEN
    RETURN NEW;
  END IF;
  RAISE EXCEPTION 'Submitted Budget Revision header is immutable';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER budget_revisions_update_guard
BEFORE UPDATE ON "budget_revisions"
FOR EACH ROW EXECUTE FUNCTION guard_budget_revision_update();

CREATE OR REPLACE FUNCTION prevent_boq_history_delete()
RETURNS trigger AS $$
BEGIN
  RAISE EXCEPTION 'BOQ stable identities cannot be physically deleted';
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER boq_sections_no_delete
BEFORE DELETE ON "boq_sections"
FOR EACH ROW EXECUTE FUNCTION prevent_boq_history_delete();

CREATE TRIGGER boq_items_no_delete
BEFORE DELETE ON "boq_items"
FOR EACH ROW EXECUTE FUNCTION prevent_boq_history_delete();
