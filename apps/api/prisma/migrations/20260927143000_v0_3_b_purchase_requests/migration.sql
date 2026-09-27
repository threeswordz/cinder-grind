CREATE TABLE "purchase_requests" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "pr_number" VARCHAR(120) NOT NULL,
  "remarks" TEXT,
  "source_request_id" UUID,
  "approval_instance_id" UUID,
  "created_by_user_id" UUID NOT NULL,
  "submitted_by_user_id" UUID,
  "cancelled_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_at" TIMESTAMPTZ(6),
  "cancelled_at" TIMESTAMPTZ(6),
  CONSTRAINT "purchase_requests_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_requests_approval_instance_id_key" UNIQUE ("approval_instance_id"),
  CONSTRAINT "purchase_requests_company_id_pr_number_key" UNIQUE ("company_id","pr_number"),
  CONSTRAINT "purchase_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_requests_source_request_id_fkey" FOREIGN KEY ("source_request_id") REFERENCES "purchase_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_requests_approval_instance_id_fkey" FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_requests_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_requests_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_requests_cancelled_by_user_id_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "purchase_requests_company_id_project_id_created_at_idx"
  ON "purchase_requests"("company_id","project_id","created_at");
CREATE INDEX "purchase_requests_submitted_by_user_id_idx"
  ON "purchase_requests"("submitted_by_user_id");
CREATE INDEX "purchase_requests_cancelled_by_user_id_idx"
  ON "purchase_requests"("cancelled_by_user_id");
CREATE INDEX "purchase_requests_source_request_id_idx"
  ON "purchase_requests"("source_request_id");

CREATE TABLE "purchase_request_lines" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "purchase_request_id" UUID NOT NULL,
  "line_no" INTEGER NOT NULL,
  "line_type" VARCHAR(20) NOT NULL,
  "material_id" UUID,
  "description" VARCHAR(500) NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "uom_id" UUID NOT NULL,
  "wbs_id" UUID,
  "cost_code_id" UUID,
  "activity_id" UUID,
  "required_on_site" DATE,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "purchase_request_lines_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "purchase_request_lines_purchase_request_id_line_no_key" UNIQUE ("purchase_request_id","line_no"),
  CONSTRAINT "purchase_request_lines_line_no_check" CHECK ("line_no" > 0),
  CONSTRAINT "purchase_request_lines_line_type_check" CHECK ("line_type" IN ('MATERIAL','SERVICE')),
  CONSTRAINT "purchase_request_lines_material_type_check" CHECK (
    ("line_type" = 'MATERIAL' AND "material_id" IS NOT NULL)
    OR ("line_type" = 'SERVICE' AND "material_id" IS NULL)
  ),
  CONSTRAINT "purchase_request_lines_description_check" CHECK (length(trim("description")) > 0),
  CONSTRAINT "purchase_request_lines_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "purchase_request_lines_purchase_request_id_fkey" FOREIGN KEY ("purchase_request_id") REFERENCES "purchase_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_request_lines_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_request_lines_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_request_lines_wbs_id_fkey" FOREIGN KEY ("wbs_id") REFERENCES "wbs_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_request_lines_cost_code_id_fkey" FOREIGN KEY ("cost_code_id") REFERENCES "cost_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "purchase_request_lines_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE INDEX "purchase_request_lines_material_id_idx" ON "purchase_request_lines"("material_id");
CREATE INDEX "purchase_request_lines_uom_id_idx" ON "purchase_request_lines"("uom_id");
CREATE INDEX "purchase_request_lines_wbs_id_idx" ON "purchase_request_lines"("wbs_id");
CREATE INDEX "purchase_request_lines_cost_code_id_idx" ON "purchase_request_lines"("cost_code_id");
CREATE INDEX "purchase_request_lines_activity_id_idx" ON "purchase_request_lines"("activity_id");
CREATE INDEX "purchase_request_lines_required_on_site_idx" ON "purchase_request_lines"("required_on_site");

CREATE OR REPLACE FUNCTION validate_purchase_request_scope()
RETURNS trigger AS $$
DECLARE
  project_company UUID;
  creator_company UUID;
  submitter_company UUID;
  canceller_company UUID;
  approval_company UUID;
  approval_entity_type VARCHAR(100);
  approval_entity_id UUID;
BEGIN
  SELECT "company_id" INTO project_company FROM "projects" WHERE "id" = NEW."project_id";
  SELECT "company_id" INTO creator_company FROM "users" WHERE "id" = NEW."created_by_user_id";

  IF project_company IS NULL OR project_company <> NEW."company_id" THEN
    RAISE EXCEPTION 'Purchase Request Company must match Project Company';
  END IF;
  IF creator_company IS NULL OR creator_company <> NEW."company_id" THEN
    RAISE EXCEPTION 'Purchase Request creator must belong to the same Company';
  END IF;

  IF NEW."submitted_by_user_id" IS NOT NULL THEN
    SELECT "company_id" INTO submitter_company FROM "users" WHERE "id" = NEW."submitted_by_user_id";
    IF submitter_company IS NULL OR submitter_company <> NEW."company_id" THEN
      RAISE EXCEPTION 'Purchase Request submitter must belong to the same Company';
    END IF;
  END IF;

  IF NEW."cancelled_by_user_id" IS NOT NULL THEN
    SELECT "company_id" INTO canceller_company FROM "users" WHERE "id" = NEW."cancelled_by_user_id";
    IF canceller_company IS NULL OR canceller_company <> NEW."company_id" THEN
      RAISE EXCEPTION 'Purchase Request canceller must belong to the same Company';
    END IF;
  END IF;

  IF NEW."approval_instance_id" IS NOT NULL THEN
    SELECT "company_id","entity_type","entity_id"
      INTO approval_company,approval_entity_type,approval_entity_id
    FROM "approval_instances"
    WHERE "id" = NEW."approval_instance_id";

    IF approval_company IS NULL
       OR approval_company <> NEW."company_id"
       OR approval_entity_type <> 'PURCHASE_REQUEST'
       OR approval_entity_id <> NEW."id" THEN
      RAISE EXCEPTION 'Purchase Request approval instance is inconsistent';
    END IF;
  END IF;

  IF (NEW."cancelled_at" IS NULL) <> (NEW."cancelled_by_user_id" IS NULL) THEN
    RAISE EXCEPTION 'Purchase Request cancellation actor and timestamp must be recorded together';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER purchase_requests_scope_guard
BEFORE INSERT OR UPDATE ON "purchase_requests"
FOR EACH ROW EXECUTE FUNCTION validate_purchase_request_scope();

CREATE OR REPLACE FUNCTION protect_purchase_request_history()
RETURNS trigger AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Purchase Requests are retained history and cannot be deleted';
  END IF;

  IF NEW."company_id" <> OLD."company_id"
     OR NEW."project_id" <> OLD."project_id"
     OR NEW."pr_number" <> OLD."pr_number"
     OR NEW."created_by_user_id" <> OLD."created_by_user_id"
     OR NEW."source_request_id" IS DISTINCT FROM OLD."source_request_id"
     OR NEW."created_at" <> OLD."created_at" THEN
    RAISE EXCEPTION 'Purchase Request identity is immutable';
  END IF;

  IF OLD."cancelled_at" IS NOT NULL THEN
    RAISE EXCEPTION 'Cancelled Purchase Request is immutable';
  END IF;

  IF OLD."approval_instance_id" IS NOT NULL OR OLD."submitted_at" IS NOT NULL THEN
    IF NEW."remarks" IS DISTINCT FROM OLD."remarks"
       OR NEW."approval_instance_id" IS DISTINCT FROM OLD."approval_instance_id"
       OR NEW."submitted_by_user_id" IS DISTINCT FROM OLD."submitted_by_user_id"
       OR NEW."submitted_at" IS DISTINCT FROM OLD."submitted_at" THEN
      RAISE EXCEPTION 'Submitted Purchase Request is immutable';
    END IF;
  END IF;

  IF OLD."cancelled_at" IS NULL AND NEW."cancelled_at" IS NOT NULL THEN
    IF NEW."cancelled_by_user_id" IS NULL THEN
      RAISE EXCEPTION 'Purchase Request cancellation actor is required';
    END IF;
  ELSIF NEW."cancelled_at" IS DISTINCT FROM OLD."cancelled_at"
     OR NEW."cancelled_by_user_id" IS DISTINCT FROM OLD."cancelled_by_user_id" THEN
    RAISE EXCEPTION 'Purchase Request cancellation metadata is immutable';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER purchase_requests_history_guard
BEFORE UPDATE OR DELETE ON "purchase_requests"
FOR EACH ROW EXECUTE FUNCTION protect_purchase_request_history();

CREATE OR REPLACE FUNCTION validate_purchase_request_line_scope()
RETURNS trigger AS $$
DECLARE
  pr_company UUID;
  pr_project UUID;
  pr_approval UUID;
  pr_submitted TIMESTAMPTZ;
  pr_cancelled TIMESTAMPTZ;
  material_company UUID;
  material_active BOOLEAN;
  uom_company UUID;
  uom_active BOOLEAN;
  wbs_project UUID;
  wbs_active BOOLEAN;
  cost_company UUID;
  cost_active BOOLEAN;
  activity_company UUID;
  activity_project UUID;
  activity_active BOOLEAN;
BEGIN
  SELECT "company_id","project_id","approval_instance_id","submitted_at","cancelled_at"
    INTO pr_company,pr_project,pr_approval,pr_submitted,pr_cancelled
  FROM "purchase_requests"
  WHERE "id" = NEW."purchase_request_id";

  IF pr_company IS NULL THEN
    RAISE EXCEPTION 'Purchase Request not found for line';
  END IF;
  IF pr_approval IS NOT NULL OR pr_submitted IS NOT NULL OR pr_cancelled IS NOT NULL THEN
    RAISE EXCEPTION 'Only Draft Purchase Request lines are editable';
  END IF;

  SELECT "company_id","is_active" INTO uom_company,uom_active
  FROM "units_of_measure" WHERE "id" = NEW."uom_id";
  IF uom_company IS NULL OR uom_company <> pr_company OR NOT uom_active THEN
    RAISE EXCEPTION 'Purchase Request line UOM must be active and belong to the same Company';
  END IF;

  IF NEW."line_type" = 'MATERIAL' THEN
    SELECT "company_id","is_active" INTO material_company,material_active
    FROM "materials" WHERE "id" = NEW."material_id";
    IF material_company IS NULL OR material_company <> pr_company OR NOT material_active THEN
      RAISE EXCEPTION 'Purchase Request Material must be active and belong to the same Company';
    END IF;
  ELSIF NEW."material_id" IS NOT NULL THEN
    RAISE EXCEPTION 'Service Purchase Request line cannot reference a Material';
  END IF;

  IF NEW."wbs_id" IS NOT NULL THEN
    SELECT "project_id","is_active" INTO wbs_project,wbs_active
    FROM "wbs_elements" WHERE "id" = NEW."wbs_id";
    IF wbs_project IS NULL OR wbs_project <> pr_project OR NOT wbs_active THEN
      RAISE EXCEPTION 'Purchase Request WBS must be active and belong to the same Project';
    END IF;
  END IF;

  IF NEW."cost_code_id" IS NOT NULL THEN
    SELECT "company_id","is_active" INTO cost_company,cost_active
    FROM "cost_codes" WHERE "id" = NEW."cost_code_id";
    IF cost_company IS NULL OR cost_company <> pr_company OR NOT cost_active THEN
      RAISE EXCEPTION 'Purchase Request Cost Code must be active and belong to the same Company';
    END IF;
  END IF;

  IF NEW."activity_id" IS NOT NULL THEN
    SELECT "company_id","project_id","is_active" INTO activity_company,activity_project,activity_active
    FROM "activities" WHERE "id" = NEW."activity_id";
    IF activity_company IS NULL
       OR activity_company <> pr_company
       OR activity_project <> pr_project
       OR NOT activity_active THEN
      RAISE EXCEPTION 'Purchase Request Activity must be active and belong to the same Project';
    END IF;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER purchase_request_lines_scope_guard
BEFORE INSERT OR UPDATE ON "purchase_request_lines"
FOR EACH ROW EXECUTE FUNCTION validate_purchase_request_line_scope();

CREATE OR REPLACE FUNCTION protect_purchase_request_line_delete()
RETURNS trigger AS $$
DECLARE
  pr_approval UUID;
  pr_submitted TIMESTAMPTZ;
  pr_cancelled TIMESTAMPTZ;
BEGIN
  SELECT "approval_instance_id","submitted_at","cancelled_at"
    INTO pr_approval,pr_submitted,pr_cancelled
  FROM "purchase_requests"
  WHERE "id" = OLD."purchase_request_id";

  IF pr_approval IS NOT NULL OR pr_submitted IS NOT NULL OR pr_cancelled IS NOT NULL THEN
    RAISE EXCEPTION 'Submitted or Cancelled Purchase Request lines cannot be deleted';
  END IF;
  RETURN OLD;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER purchase_request_lines_delete_guard
BEFORE DELETE ON "purchase_request_lines"
FOR EACH ROW EXECUTE FUNCTION protect_purchase_request_line_delete();
