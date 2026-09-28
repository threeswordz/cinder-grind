-- V0.4-D Material Reservation / Issue / Return foundation.
-- One immutable stock ledger remains canonical; no editable balance or second ledger is introduced.

CREATE TABLE "material_reservations" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "material_id" UUID NOT NULL,
  "uom_id" UUID NOT NULL,
  "wbs_id" UUID,
  "activity_id" UUID,
  "reservation_number" VARCHAR(120) NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "required_date" DATE,
  "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  "remarks" TEXT,
  "release_reason" TEXT,
  "cancellation_reason" TEXT,
  "created_by_user_id" UUID NOT NULL,
  "activated_by_user_id" UUID,
  "fulfilled_by_user_id" UUID,
  "released_by_user_id" UUID,
  "cancelled_by_user_id" UUID,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "activated_at" TIMESTAMPTZ(6),
  "fulfilled_at" TIMESTAMPTZ(6),
  "released_at" TIMESTAMPTZ(6),
  "cancelled_at" TIMESTAMPTZ(6),
  CONSTRAINT "material_reservations_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "material_reservations_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "material_reservations_status_check" CHECK ("status" IN ('DRAFT','ACTIVE','FULFILLED','RELEASED','CANCELLED')),
  CONSTRAINT "material_reservations_state_check" CHECK (
    ("status"='DRAFT' AND "activated_at" IS NULL AND "fulfilled_at" IS NULL AND "released_at" IS NULL AND "cancelled_at" IS NULL)
    OR ("status"='ACTIVE' AND "activated_at" IS NOT NULL AND "fulfilled_at" IS NULL AND "released_at" IS NULL AND "cancelled_at" IS NULL)
    OR ("status"='FULFILLED' AND "activated_at" IS NOT NULL AND "fulfilled_at" IS NOT NULL AND "released_at" IS NULL AND "cancelled_at" IS NULL)
    OR ("status"='RELEASED' AND "activated_at" IS NOT NULL AND "released_at" IS NOT NULL AND "fulfilled_at" IS NULL AND "cancelled_at" IS NULL)
    OR ("status"='CANCELLED' AND "cancelled_at" IS NOT NULL AND "fulfilled_at" IS NULL AND "released_at" IS NULL)
  )
);
CREATE UNIQUE INDEX "material_reservations_company_number_key" ON "material_reservations"("company_id","reservation_number");
CREATE INDEX "material_reservations_company_project_status_idx" ON "material_reservations"("company_id","project_id","status");
CREATE INDEX "material_reservations_dimensions_status_idx" ON "material_reservations"("warehouse_id","material_id","project_id","uom_id","status");

CREATE TABLE "material_issues" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "issue_number" VARCHAR(120) NOT NULL,
  "issue_date" DATE NOT NULL,
  "issued_to_employee_id" UUID,
  "approval_instance_id" UUID,
  "created_by_user_id" UUID NOT NULL,
  "submitted_by_user_id" UUID,
  "posted_by_user_id" UUID,
  "reversed_by_user_id" UUID,
  "post_key" VARCHAR(120),
  "reversal_key" VARCHAR(120),
  "remarks" TEXT,
  "reversal_reason" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_at" TIMESTAMPTZ(6),
  "posted_at" TIMESTAMPTZ(6),
  "reversed_at" TIMESTAMPTZ(6),
  CONSTRAINT "material_issues_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "material_issues_post_fields_check" CHECK
    (("posted_at" IS NULL AND "post_key" IS NULL AND "posted_by_user_id" IS NULL)
     OR ("posted_at" IS NOT NULL AND "post_key" IS NOT NULL AND "posted_by_user_id" IS NOT NULL)),
  CONSTRAINT "material_issues_reverse_fields_check" CHECK
    (("reversed_at" IS NULL AND "reversal_key" IS NULL AND "reversed_by_user_id" IS NULL)
     OR ("reversed_at" IS NOT NULL AND "posted_at" IS NOT NULL AND "reversal_key" IS NOT NULL
       AND "reversed_by_user_id" IS NOT NULL AND NULLIF(BTRIM("reversal_reason"),'') IS NOT NULL))
);
CREATE UNIQUE INDEX "material_issues_company_number_key" ON "material_issues"("company_id","issue_number");
CREATE UNIQUE INDEX "material_issues_approval_instance_key" ON "material_issues"("approval_instance_id");
CREATE UNIQUE INDEX "material_issues_post_key_key" ON "material_issues"("post_key");
CREATE UNIQUE INDEX "material_issues_reversal_key_key" ON "material_issues"("reversal_key");
CREATE INDEX "material_issues_company_project_created_idx" ON "material_issues"("company_id","project_id","created_at");
CREATE INDEX "material_issues_warehouse_idx" ON "material_issues"("warehouse_id");

CREATE TABLE "material_issue_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "material_issue_id" UUID NOT NULL,
  "line_no" INTEGER NOT NULL,
  "material_id" UUID NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "uom_id" UUID NOT NULL,
  "reservation_id" UUID,
  "wbs_id" UUID,
  "cost_code_id" UUID,
  "activity_id" UUID,
  "remarks" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "material_issue_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "material_issue_items_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "material_issue_items_line_check" CHECK ("line_no" > 0)
);
CREATE UNIQUE INDEX "material_issue_items_issue_line_key" ON "material_issue_items"("material_issue_id","line_no");
CREATE INDEX "material_issue_items_reservation_idx" ON "material_issue_items"("reservation_id");
CREATE INDEX "material_issue_items_material_uom_idx" ON "material_issue_items"("material_id","uom_id");

CREATE TABLE "material_returns" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "return_number" VARCHAR(120) NOT NULL,
  "return_date" DATE NOT NULL,
  "approval_instance_id" UUID,
  "created_by_user_id" UUID NOT NULL,
  "submitted_by_user_id" UUID,
  "posted_by_user_id" UUID,
  "reversed_by_user_id" UUID,
  "post_key" VARCHAR(120),
  "reversal_key" VARCHAR(120),
  "remarks" TEXT,
  "reversal_reason" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "submitted_at" TIMESTAMPTZ(6),
  "posted_at" TIMESTAMPTZ(6),
  "reversed_at" TIMESTAMPTZ(6),
  CONSTRAINT "material_returns_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "material_returns_post_fields_check" CHECK
    (("posted_at" IS NULL AND "post_key" IS NULL AND "posted_by_user_id" IS NULL)
     OR ("posted_at" IS NOT NULL AND "post_key" IS NOT NULL AND "posted_by_user_id" IS NOT NULL)),
  CONSTRAINT "material_returns_reverse_fields_check" CHECK
    (("reversed_at" IS NULL AND "reversal_key" IS NULL AND "reversed_by_user_id" IS NULL)
     OR ("reversed_at" IS NOT NULL AND "posted_at" IS NOT NULL AND "reversal_key" IS NOT NULL
       AND "reversed_by_user_id" IS NOT NULL AND NULLIF(BTRIM("reversal_reason"),'') IS NOT NULL))
);
CREATE UNIQUE INDEX "material_returns_company_number_key" ON "material_returns"("company_id","return_number");
CREATE UNIQUE INDEX "material_returns_approval_instance_key" ON "material_returns"("approval_instance_id");
CREATE UNIQUE INDEX "material_returns_post_key_key" ON "material_returns"("post_key");
CREATE UNIQUE INDEX "material_returns_reversal_key_key" ON "material_returns"("reversal_key");
CREATE INDEX "material_returns_company_project_created_idx" ON "material_returns"("company_id","project_id","created_at");
CREATE INDEX "material_returns_warehouse_idx" ON "material_returns"("warehouse_id");

CREATE TABLE "material_return_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "material_return_id" UUID NOT NULL,
  "line_no" INTEGER NOT NULL,
  "material_issue_item_id" UUID NOT NULL,
  "material_id" UUID NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "uom_id" UUID NOT NULL,
  "remarks" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "material_return_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "material_return_items_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "material_return_items_line_check" CHECK ("line_no" > 0)
);
CREATE UNIQUE INDEX "material_return_items_return_line_key" ON "material_return_items"("material_return_id","line_no");
CREATE INDEX "material_return_items_issue_item_idx" ON "material_return_items"("material_issue_item_id");

ALTER TABLE "material_reservations"
  ADD CONSTRAINT "material_reservations_company_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_reservations_project_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_reservations_warehouse_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_reservations_material_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_reservations_uom_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_reservations_wbs_fkey" FOREIGN KEY ("wbs_id") REFERENCES "wbs_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_reservations_activity_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_reservations_creator_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_reservations_activator_fkey" FOREIGN KEY ("activated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_reservations_fulfiller_fkey" FOREIGN KEY ("fulfilled_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_reservations_releaser_fkey" FOREIGN KEY ("released_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_reservations_canceller_fkey" FOREIGN KEY ("cancelled_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "material_issues"
  ADD CONSTRAINT "material_issues_company_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_issues_project_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_issues_warehouse_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_issues_employee_fkey" FOREIGN KEY ("issued_to_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_issues_approval_fkey" FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_issues_creator_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_issues_submitter_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_issues_poster_fkey" FOREIGN KEY ("posted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_issues_reverser_fkey" FOREIGN KEY ("reversed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "material_issue_items"
  ADD CONSTRAINT "material_issue_items_issue_fkey" FOREIGN KEY ("material_issue_id") REFERENCES "material_issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_issue_items_material_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_issue_items_uom_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_issue_items_reservation_fkey" FOREIGN KEY ("reservation_id") REFERENCES "material_reservations"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_issue_items_wbs_fkey" FOREIGN KEY ("wbs_id") REFERENCES "wbs_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_issue_items_cost_code_fkey" FOREIGN KEY ("cost_code_id") REFERENCES "cost_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_issue_items_activity_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "material_returns"
  ADD CONSTRAINT "material_returns_company_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_returns_project_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_returns_warehouse_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_returns_approval_fkey" FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_returns_creator_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_returns_submitter_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_returns_poster_fkey" FOREIGN KEY ("posted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_returns_reverser_fkey" FOREIGN KEY ("reversed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "material_return_items"
  ADD CONSTRAINT "material_return_items_return_fkey" FOREIGN KEY ("material_return_id") REFERENCES "material_returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_return_items_issue_item_fkey" FOREIGN KEY ("material_issue_item_id") REFERENCES "material_issue_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_return_items_material_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "material_return_items_uom_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Generalize the one immutable Stock Transaction Ledger to new source families.
ALTER TABLE "stock_transactions" DROP CONSTRAINT "stock_transactions_effect_check";
DROP INDEX "stock_transactions_receipt_item_movement_key";
ALTER TABLE "stock_transactions"
  ALTER COLUMN "goods_receipt_id" DROP NOT NULL,
  ALTER COLUMN "goods_receipt_item_id" DROP NOT NULL,
  ADD COLUMN "material_issue_id" UUID,
  ADD COLUMN "material_issue_item_id" UUID,
  ADD COLUMN "material_return_id" UUID,
  ADD COLUMN "material_return_item_id" UUID,
  ADD COLUMN "wbs_id" UUID,
  ADD COLUMN "cost_code_id" UUID,
  ADD COLUMN "activity_id" UUID,
  ADD CONSTRAINT "stock_transactions_source_family_check" CHECK (
    num_nonnulls("goods_receipt_item_id","material_issue_item_id","material_return_item_id") = 1
    AND ("goods_receipt_id" IS NULL) = ("goods_receipt_item_id" IS NULL)
    AND ("material_issue_id" IS NULL) = ("material_issue_item_id" IS NULL)
    AND ("material_return_id" IS NULL) = ("material_return_item_id" IS NULL)
  ),
  ADD CONSTRAINT "stock_transactions_effect_check" CHECK (
    ("movement_type"='GOODS_RECEIPT' AND "quantity">0 AND "reversal_of_id" IS NULL)
    OR ("movement_type"='GOODS_RECEIPT_REVERSAL' AND "quantity"<0 AND "reversal_of_id" IS NOT NULL)
    OR ("movement_type"='MATERIAL_ISSUE' AND "quantity"<0 AND "reversal_of_id" IS NULL)
    OR ("movement_type"='MATERIAL_ISSUE_REVERSAL' AND "quantity">0 AND "reversal_of_id" IS NOT NULL)
    OR ("movement_type"='MATERIAL_RETURN' AND "quantity">0 AND "reversal_of_id" IS NULL)
    OR ("movement_type"='MATERIAL_RETURN_REVERSAL' AND "quantity"<0 AND "reversal_of_id" IS NOT NULL)
  );

CREATE UNIQUE INDEX "stock_transactions_receipt_item_movement_key" ON "stock_transactions"("goods_receipt_item_id","movement_type");
CREATE UNIQUE INDEX "stock_transactions_issue_item_movement_key" ON "stock_transactions"("material_issue_item_id","movement_type");
CREATE UNIQUE INDEX "stock_transactions_return_item_movement_key" ON "stock_transactions"("material_return_item_id","movement_type");
CREATE INDEX "stock_transactions_material_issue_id_idx" ON "stock_transactions"("material_issue_id");
CREATE INDEX "stock_transactions_material_return_id_idx" ON "stock_transactions"("material_return_id");

ALTER TABLE "stock_transactions"
  ADD CONSTRAINT "stock_transactions_material_issue_fkey" FOREIGN KEY ("material_issue_id") REFERENCES "material_issues"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "stock_transactions_material_issue_item_fkey" FOREIGN KEY ("material_issue_item_id") REFERENCES "material_issue_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "stock_transactions_material_return_fkey" FOREIGN KEY ("material_return_id") REFERENCES "material_returns"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "stock_transactions_material_return_item_fkey" FOREIGN KEY ("material_return_item_id") REFERENCES "material_return_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "stock_transactions_wbs_fkey" FOREIGN KEY ("wbs_id") REFERENCES "wbs_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "stock_transactions_cost_code_fkey" FOREIGN KEY ("cost_code_id") REFERENCES "cost_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "stock_transactions_activity_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION enforce_material_reservation_scope()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE wh RECORD;
BEGIN
  SELECT company_id, project_id, is_active INTO wh FROM warehouses WHERE id=NEW.warehouse_id;
  IF NOT FOUND OR wh.company_id IS DISTINCT FROM NEW.company_id OR NOT wh.is_active
    OR (wh.project_id IS NOT NULL AND wh.project_id IS DISTINCT FROM NEW.project_id)
    OR NOT EXISTS (SELECT 1 FROM projects WHERE id=NEW.project_id AND company_id=NEW.company_id)
    OR NOT EXISTS (SELECT 1 FROM materials WHERE id=NEW.material_id AND company_id=NEW.company_id)
    OR NOT EXISTS (SELECT 1 FROM units_of_measure WHERE id=NEW.uom_id AND company_id=NEW.company_id)
    OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.created_by_user_id AND company_id=NEW.company_id)
    OR (NEW.wbs_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM wbs_elements WHERE id=NEW.wbs_id AND project_id=NEW.project_id))
    OR (NEW.activity_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM activities WHERE id=NEW.activity_id AND project_id=NEW.project_id))
  THEN RAISE EXCEPTION 'Reservation dimensions must match Company and Project'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER material_reservation_scope_guard BEFORE INSERT OR UPDATE OF
  company_id,project_id,warehouse_id,material_id,uom_id,wbs_id,activity_id
ON material_reservations FOR EACH ROW EXECUTE FUNCTION enforce_material_reservation_scope();

CREATE OR REPLACE FUNCTION protect_material_reservation_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Material Reservation history cannot be deleted'; END IF;
  IF OLD.status <> 'DRAFT' AND
    (NEW.company_id,NEW.project_id,NEW.warehouse_id,NEW.material_id,NEW.uom_id,NEW.wbs_id,NEW.activity_id,
     NEW.reservation_number,NEW.quantity,NEW.required_date,NEW.created_by_user_id,NEW.created_at)
    IS DISTINCT FROM
    (OLD.company_id,OLD.project_id,OLD.warehouse_id,OLD.material_id,OLD.uom_id,OLD.wbs_id,OLD.activity_id,
     OLD.reservation_number,OLD.quantity,OLD.required_date,OLD.created_by_user_id,OLD.created_at)
  THEN RAISE EXCEPTION 'Activated Material Reservation dimensions are immutable'; END IF;
  IF OLD.status IN ('FULFILLED','RELEASED','CANCELLED') AND NEW IS DISTINCT FROM OLD
  THEN RAISE EXCEPTION 'Terminal Material Reservation history is immutable'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER material_reservation_history_guard BEFORE UPDATE OR DELETE ON material_reservations
FOR EACH ROW EXECUTE FUNCTION protect_material_reservation_history();

CREATE OR REPLACE FUNCTION enforce_material_issue_scope()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE wh RECORD;
BEGIN
  SELECT company_id,project_id,is_active INTO wh FROM warehouses WHERE id=NEW.warehouse_id;
  IF NOT FOUND OR wh.company_id IS DISTINCT FROM NEW.company_id OR NOT wh.is_active
    OR (wh.project_id IS NOT NULL AND wh.project_id IS DISTINCT FROM NEW.project_id)
    OR NOT EXISTS (SELECT 1 FROM projects WHERE id=NEW.project_id AND company_id=NEW.company_id)
    OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.created_by_user_id AND company_id=NEW.company_id)
    OR (NEW.issued_to_employee_id IS NOT NULL AND NOT EXISTS
      (SELECT 1 FROM employees WHERE id=NEW.issued_to_employee_id AND company_id=NEW.company_id AND is_active))
  THEN RAISE EXCEPTION 'Material Issue dimensions must match Company and Project'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER material_issue_scope_guard BEFORE INSERT OR UPDATE OF
  company_id,project_id,warehouse_id,issued_to_employee_id
ON material_issues FOR EACH ROW EXECUTE FUNCTION enforce_material_issue_scope();

CREATE OR REPLACE FUNCTION enforce_material_issue_item_source()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent RECORD; r RECORD;
BEGIN
  SELECT company_id,project_id,warehouse_id,submitted_at INTO parent FROM material_issues WHERE id=NEW.material_issue_id;
  IF NOT FOUND OR parent.submitted_at IS NOT NULL
    OR NOT EXISTS (SELECT 1 FROM materials WHERE id=NEW.material_id AND company_id=parent.company_id)
    OR NOT EXISTS (SELECT 1 FROM units_of_measure WHERE id=NEW.uom_id AND company_id=parent.company_id)
    OR (NEW.wbs_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM wbs_elements WHERE id=NEW.wbs_id AND project_id=parent.project_id))
    OR (NEW.cost_code_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM cost_codes WHERE id=NEW.cost_code_id AND company_id=parent.company_id))
    OR (NEW.activity_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM activities WHERE id=NEW.activity_id AND project_id=parent.project_id))
  THEN RAISE EXCEPTION 'Material Issue item dimensions are invalid or Issue is not Draft'; END IF;
  IF NEW.reservation_id IS NOT NULL THEN
    SELECT company_id,project_id,warehouse_id,material_id,uom_id,quantity,status INTO r
    FROM material_reservations WHERE id=NEW.reservation_id;
    IF NOT FOUND OR r.company_id IS DISTINCT FROM parent.company_id OR r.project_id IS DISTINCT FROM parent.project_id
      OR r.warehouse_id IS DISTINCT FROM parent.warehouse_id OR r.material_id IS DISTINCT FROM NEW.material_id
      OR r.uom_id IS DISTINCT FROM NEW.uom_id OR r.quantity IS DISTINCT FROM NEW.quantity OR r.status <> 'ACTIVE'
    THEN RAISE EXCEPTION 'Linked Reservation must be Active and exactly match the Issue line'; END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER material_issue_item_source_guard BEFORE INSERT OR UPDATE ON material_issue_items
FOR EACH ROW EXECUTE FUNCTION enforce_material_issue_item_source();

CREATE OR REPLACE FUNCTION protect_material_issue_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Material Issue history cannot be deleted'; END IF;
  IF OLD.submitted_at IS NOT NULL AND
    (NEW.company_id,NEW.project_id,NEW.warehouse_id,NEW.issue_number,NEW.issue_date,NEW.issued_to_employee_id,
     NEW.approval_instance_id,NEW.created_by_user_id,NEW.submitted_by_user_id,NEW.remarks,NEW.created_at,NEW.submitted_at)
    IS DISTINCT FROM
    (OLD.company_id,OLD.project_id,OLD.warehouse_id,OLD.issue_number,OLD.issue_date,OLD.issued_to_employee_id,
     OLD.approval_instance_id,OLD.created_by_user_id,OLD.submitted_by_user_id,OLD.remarks,OLD.created_at,OLD.submitted_at)
  THEN RAISE EXCEPTION 'Submitted Material Issue is immutable'; END IF;
  IF OLD.posted_at IS NOT NULL AND
    (NEW.posted_at,NEW.post_key,NEW.posted_by_user_id)
    IS DISTINCT FROM
    (OLD.posted_at,OLD.post_key,OLD.posted_by_user_id)
  THEN RAISE EXCEPTION 'Posted Material Issue posting identity is immutable'; END IF;
  IF OLD.reversed_at IS NOT NULL AND NEW IS DISTINCT FROM OLD
  THEN RAISE EXCEPTION 'Reversed Material Issue history is immutable'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER material_issue_history_guard BEFORE UPDATE OR DELETE ON material_issues
FOR EACH ROW EXECUTE FUNCTION protect_material_issue_history();

CREATE OR REPLACE FUNCTION protect_material_issue_items()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM material_issues WHERE id=COALESCE(NEW.material_issue_id,OLD.material_issue_id) AND submitted_at IS NOT NULL)
  THEN RAISE EXCEPTION 'Submitted Material Issue items are immutable'; END IF;
  RETURN COALESCE(NEW,OLD);
END; $$;
CREATE TRIGGER material_issue_items_history_guard BEFORE UPDATE OR DELETE ON material_issue_items
FOR EACH ROW EXECUTE FUNCTION protect_material_issue_items();

CREATE OR REPLACE FUNCTION enforce_material_return_scope()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE wh RECORD;
BEGIN
  SELECT company_id,project_id,is_active INTO wh FROM warehouses WHERE id=NEW.warehouse_id;
  IF NOT FOUND OR wh.company_id IS DISTINCT FROM NEW.company_id OR NOT wh.is_active
    OR (wh.project_id IS NOT NULL AND wh.project_id IS DISTINCT FROM NEW.project_id)
    OR NOT EXISTS (SELECT 1 FROM projects WHERE id=NEW.project_id AND company_id=NEW.company_id)
    OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.created_by_user_id AND company_id=NEW.company_id)
  THEN RAISE EXCEPTION 'Material Return dimensions must match Company and Project'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER material_return_scope_guard BEFORE INSERT OR UPDATE OF
  company_id,project_id,warehouse_id
ON material_returns FOR EACH ROW EXECUTE FUNCTION enforce_material_return_scope();

CREATE OR REPLACE FUNCTION enforce_material_return_item_source()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent RECORD; source RECORD;
BEGIN
  SELECT company_id,project_id,submitted_at INTO parent FROM material_returns WHERE id=NEW.material_return_id;
  SELECT i.material_id,i.uom_id,h.company_id,h.project_id,h.posted_at,h.reversed_at
  INTO source FROM material_issue_items i JOIN material_issues h ON h.id=i.material_issue_id
  WHERE i.id=NEW.material_issue_item_id;
  IF parent.submitted_at IS NOT NULL OR NOT FOUND OR source.posted_at IS NULL OR source.reversed_at IS NOT NULL
    OR source.company_id IS DISTINCT FROM parent.company_id OR source.project_id IS DISTINCT FROM parent.project_id
    OR source.material_id IS DISTINCT FROM NEW.material_id OR source.uom_id IS DISTINCT FROM NEW.uom_id
  THEN RAISE EXCEPTION 'Material Return item must reference a posted Issue line in the same Project'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER material_return_item_source_guard BEFORE INSERT OR UPDATE ON material_return_items
FOR EACH ROW EXECUTE FUNCTION enforce_material_return_item_source();

CREATE OR REPLACE FUNCTION protect_material_return_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Material Return history cannot be deleted'; END IF;
  IF OLD.submitted_at IS NOT NULL AND
    (NEW.company_id,NEW.project_id,NEW.warehouse_id,NEW.return_number,NEW.return_date,
     NEW.approval_instance_id,NEW.created_by_user_id,NEW.submitted_by_user_id,NEW.remarks,NEW.created_at,NEW.submitted_at)
    IS DISTINCT FROM
    (OLD.company_id,OLD.project_id,OLD.warehouse_id,OLD.return_number,OLD.return_date,
     OLD.approval_instance_id,OLD.created_by_user_id,OLD.submitted_by_user_id,OLD.remarks,OLD.created_at,OLD.submitted_at)
  THEN RAISE EXCEPTION 'Submitted Material Return is immutable'; END IF;
  IF OLD.posted_at IS NOT NULL AND
    (NEW.posted_at,NEW.post_key,NEW.posted_by_user_id)
    IS DISTINCT FROM
    (OLD.posted_at,OLD.post_key,OLD.posted_by_user_id)
  THEN RAISE EXCEPTION 'Posted Material Return posting identity is immutable'; END IF;
  IF OLD.reversed_at IS NOT NULL AND NEW IS DISTINCT FROM OLD
  THEN RAISE EXCEPTION 'Reversed Material Return history is immutable'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER material_return_history_guard BEFORE UPDATE OR DELETE ON material_returns
FOR EACH ROW EXECUTE FUNCTION protect_material_return_history();

CREATE OR REPLACE FUNCTION protect_material_return_items()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (SELECT 1 FROM material_returns WHERE id=COALESCE(NEW.material_return_id,OLD.material_return_id) AND submitted_at IS NOT NULL)
  THEN RAISE EXCEPTION 'Submitted Material Return items are immutable'; END IF;
  RETURN COALESCE(NEW,OLD);
END; $$;
CREATE TRIGGER material_return_items_history_guard BEFORE UPDATE OR DELETE ON material_return_items
FOR EACH ROW EXECUTE FUNCTION protect_material_return_items();

-- Replace Stage B source validation with a source-family aware validator.
CREATE OR REPLACE FUNCTION enforce_stock_transaction_source()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source RECORD; original RECORD;
BEGIN
  IF NEW.goods_receipt_item_id IS NOT NULL THEN
    SELECT r.company_id,r.warehouse_id,r.project_id,r.posted_at,r.reversed_at,
      i.material_id,i.uom_id,i.quantity AS item_quantity
    INTO source FROM goods_receipts r JOIN goods_receipt_items i ON i.goods_receipt_id=r.id
    WHERE r.id=NEW.goods_receipt_id AND i.id=NEW.goods_receipt_item_id;
    IF NOT FOUND OR source.posted_at IS NULL OR NEW.company_id IS DISTINCT FROM source.company_id
      OR NEW.warehouse_id IS DISTINCT FROM source.warehouse_id OR NEW.project_id IS DISTINCT FROM source.project_id
      OR NEW.material_id IS DISTINCT FROM source.material_id OR NEW.uom_id IS DISTINCT FROM source.uom_id
      OR NEW.wbs_id IS NOT NULL OR NEW.cost_code_id IS NOT NULL OR NEW.activity_id IS NOT NULL
    THEN RAISE EXCEPTION 'Receipt Stock movement source dimensions mismatch'; END IF;
    IF NEW.movement_type='GOODS_RECEIPT' THEN
      IF source.reversed_at IS NOT NULL OR NEW.quantity<>source.item_quantity
      THEN RAISE EXCEPTION 'Receipt movement quantity/state mismatch'; END IF;
    ELSIF NEW.movement_type='GOODS_RECEIPT_REVERSAL' THEN
      SELECT * INTO original FROM stock_transactions WHERE id=NEW.reversal_of_id;
      IF NOT FOUND OR source.reversed_at IS NULL OR original.movement_type<>'GOODS_RECEIPT'
        OR original.goods_receipt_item_id<>NEW.goods_receipt_item_id OR original.quantity<>-NEW.quantity
      THEN RAISE EXCEPTION 'Receipt reversal must exactly negate source'; END IF;
    ELSE RAISE EXCEPTION 'Receipt source cannot use this movement type'; END IF;
  ELSIF NEW.material_issue_item_id IS NOT NULL THEN
    SELECT h.company_id,h.warehouse_id,h.project_id,h.posted_at,h.reversed_at,
      i.material_id,i.uom_id,i.quantity AS item_quantity,i.wbs_id,i.cost_code_id,i.activity_id
    INTO source FROM material_issues h JOIN material_issue_items i ON i.material_issue_id=h.id
    WHERE h.id=NEW.material_issue_id AND i.id=NEW.material_issue_item_id;
    IF NOT FOUND OR source.posted_at IS NULL OR NEW.company_id IS DISTINCT FROM source.company_id
      OR NEW.warehouse_id IS DISTINCT FROM source.warehouse_id OR NEW.project_id IS DISTINCT FROM source.project_id
      OR NEW.material_id IS DISTINCT FROM source.material_id OR NEW.uom_id IS DISTINCT FROM source.uom_id
      OR NEW.wbs_id IS DISTINCT FROM source.wbs_id OR NEW.cost_code_id IS DISTINCT FROM source.cost_code_id
      OR NEW.activity_id IS DISTINCT FROM source.activity_id
    THEN RAISE EXCEPTION 'Issue Stock movement source dimensions mismatch'; END IF;
    IF NEW.movement_type='MATERIAL_ISSUE' THEN
      IF source.reversed_at IS NOT NULL OR NEW.quantity<>-source.item_quantity
      THEN RAISE EXCEPTION 'Issue movement quantity/state mismatch'; END IF;
    ELSIF NEW.movement_type='MATERIAL_ISSUE_REVERSAL' THEN
      SELECT * INTO original FROM stock_transactions WHERE id=NEW.reversal_of_id;
      IF NOT FOUND OR source.reversed_at IS NULL OR original.movement_type<>'MATERIAL_ISSUE'
        OR original.material_issue_item_id<>NEW.material_issue_item_id OR original.quantity<>-NEW.quantity
      THEN RAISE EXCEPTION 'Issue reversal must exactly negate source'; END IF;
    ELSE RAISE EXCEPTION 'Issue source cannot use this movement type'; END IF;
  ELSE
    SELECT h.company_id,h.warehouse_id,h.project_id,h.posted_at,h.reversed_at,
      i.material_id,i.uom_id,i.quantity AS item_quantity,
      src.wbs_id,src.cost_code_id,src.activity_id
    INTO source
    FROM material_returns h
    JOIN material_return_items i ON i.material_return_id=h.id
    JOIN material_issue_items src ON src.id=i.material_issue_item_id
    WHERE h.id=NEW.material_return_id AND i.id=NEW.material_return_item_id;
    IF NOT FOUND OR source.posted_at IS NULL OR NEW.company_id IS DISTINCT FROM source.company_id
      OR NEW.warehouse_id IS DISTINCT FROM source.warehouse_id OR NEW.project_id IS DISTINCT FROM source.project_id
      OR NEW.material_id IS DISTINCT FROM source.material_id OR NEW.uom_id IS DISTINCT FROM source.uom_id
      OR NEW.wbs_id IS DISTINCT FROM source.wbs_id OR NEW.cost_code_id IS DISTINCT FROM source.cost_code_id
      OR NEW.activity_id IS DISTINCT FROM source.activity_id
    THEN RAISE EXCEPTION 'Return Stock movement source dimensions mismatch'; END IF;
    IF NEW.movement_type='MATERIAL_RETURN' THEN
      IF source.reversed_at IS NOT NULL OR NEW.quantity<>source.item_quantity
      THEN RAISE EXCEPTION 'Return movement quantity/state mismatch'; END IF;
    ELSIF NEW.movement_type='MATERIAL_RETURN_REVERSAL' THEN
      SELECT * INTO original FROM stock_transactions WHERE id=NEW.reversal_of_id;
      IF NOT FOUND OR source.reversed_at IS NULL OR original.movement_type<>'MATERIAL_RETURN'
        OR original.material_return_item_id<>NEW.material_return_item_id OR original.quantity<>-NEW.quantity
      THEN RAISE EXCEPTION 'Return reversal must exactly negate source'; END IF;
    ELSE RAISE EXCEPTION 'Return source cannot use this movement type'; END IF;
  END IF;
  RETURN NEW;
END; $$;

-- A Warehouse with an Active Reservation cannot be archived even when physical on-hand is zero.
CREATE OR REPLACE FUNCTION enforce_warehouse_stock_history()
RETURNS trigger LANGUAGE plpgsql AS $warehouse$
BEGIN
  IF OLD.is_active AND NOT NEW.is_active THEN
    PERFORM pg_advisory_xact_lock(hashtext('inventory-warehouse:' || OLD.id::text));
  END IF;
  IF NEW.project_id IS DISTINCT FROM OLD.project_id
    AND EXISTS (SELECT 1 FROM stock_transactions WHERE warehouse_id=OLD.id)
  THEN RAISE EXCEPTION 'Warehouse with stock history cannot change Project'; END IF;
  IF OLD.is_active AND NOT NEW.is_active
    AND EXISTS (
      SELECT 1 FROM stock_transactions WHERE warehouse_id=OLD.id
      GROUP BY material_id,project_id,uom_id HAVING SUM(quantity)<>0
    )
  THEN RAISE EXCEPTION 'Warehouse with on-hand stock cannot be archived'; END IF;
  IF OLD.is_active AND NOT NEW.is_active
    AND EXISTS (SELECT 1 FROM material_reservations WHERE warehouse_id=OLD.id AND status='ACTIVE')
  THEN RAISE EXCEPTION 'Warehouse with Active Reservation cannot be archived'; END IF;
  RETURN NEW;
END; $warehouse$;
