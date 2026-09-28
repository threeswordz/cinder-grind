CREATE TABLE "goods_receipts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "supplier_id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "purchase_order_id" UUID NOT NULL,
  "receipt_number" VARCHAR(120) NOT NULL,
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
  CONSTRAINT "goods_receipts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "goods_receipts_post_fields_check" CHECK
    (("posted_at" IS NULL AND "post_key" IS NULL AND "posted_by_user_id" IS NULL)
      OR ("posted_at" IS NOT NULL AND "post_key" IS NOT NULL AND "posted_by_user_id" IS NOT NULL)),
  CONSTRAINT "goods_receipts_reverse_fields_check" CHECK
    (("reversed_at" IS NULL AND "reversal_key" IS NULL AND "reversed_by_user_id" IS NULL)
      OR ("reversed_at" IS NOT NULL AND "posted_at" IS NOT NULL
        AND "reversal_key" IS NOT NULL AND "reversed_by_user_id" IS NOT NULL
        AND NULLIF(BTRIM("reversal_reason"), '') IS NOT NULL))
);
CREATE UNIQUE INDEX "goods_receipts_company_id_receipt_number_key" ON "goods_receipts"("company_id","receipt_number");
CREATE UNIQUE INDEX "goods_receipts_approval_instance_id_key" ON "goods_receipts"("approval_instance_id");
CREATE UNIQUE INDEX "goods_receipts_post_key_key" ON "goods_receipts"("post_key");
CREATE UNIQUE INDEX "goods_receipts_reversal_key_key" ON "goods_receipts"("reversal_key");
CREATE INDEX "goods_receipts_company_id_project_id_created_at_idx" ON "goods_receipts"("company_id","project_id","created_at");
CREATE INDEX "goods_receipts_purchase_order_id_idx" ON "goods_receipts"("purchase_order_id");
CREATE INDEX "goods_receipts_warehouse_id_idx" ON "goods_receipts"("warehouse_id");

ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_approval_instance_id_fkey" FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_posted_by_user_id_fkey" FOREIGN KEY ("posted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_reversed_by_user_id_fkey" FOREIGN KEY ("reversed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "goods_receipt_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "goods_receipt_id" UUID NOT NULL,
  "line_no" INTEGER NOT NULL,
  "purchase_order_line_id" UUID NOT NULL,
  "quotation_award_id" UUID NOT NULL,
  "material_id" UUID NOT NULL,
  "material_code_snapshot" VARCHAR(80) NOT NULL,
  "description" VARCHAR(500) NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "uom_id" UUID NOT NULL,
  "uom_code_snapshot" VARCHAR(30) NOT NULL,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "goods_receipt_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "goods_receipt_items_positive_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "goods_receipt_items_line_no_check" CHECK ("line_no" > 0)
);
CREATE UNIQUE INDEX "goods_receipt_items_goods_receipt_id_line_no_key" ON "goods_receipt_items"("goods_receipt_id","line_no");
CREATE UNIQUE INDEX "goods_receipt_items_goods_receipt_id_purchase_order_line_id_key" ON "goods_receipt_items"("goods_receipt_id","purchase_order_line_id");
CREATE INDEX "goods_receipt_items_quotation_award_id_idx" ON "goods_receipt_items"("quotation_award_id");
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_purchase_order_line_id_fkey" FOREIGN KEY ("purchase_order_line_id") REFERENCES "purchase_order_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "goods_receipt_items" ADD CONSTRAINT "goods_receipt_items_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE TABLE "stock_transactions" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "material_id" UUID NOT NULL,
  "project_id" UUID,
  "uom_id" UUID NOT NULL,
  "goods_receipt_id" UUID NOT NULL,
  "goods_receipt_item_id" UUID NOT NULL,
  "movement_type" VARCHAR(40) NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "effect_key" VARCHAR(180) NOT NULL,
  "reversal_of_id" UUID,
  "posted_by_user_id" UUID NOT NULL,
  "posted_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_transactions_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_transactions_effect_check" CHECK
    (("movement_type" = 'GOODS_RECEIPT' AND "quantity" > 0 AND "reversal_of_id" IS NULL)
      OR ("movement_type" = 'GOODS_RECEIPT_REVERSAL' AND "quantity" < 0 AND "reversal_of_id" IS NOT NULL))
);
CREATE UNIQUE INDEX "stock_transactions_effect_key_key" ON "stock_transactions"("effect_key");
CREATE UNIQUE INDEX "stock_transactions_reversal_of_id_key" ON "stock_transactions"("reversal_of_id");
CREATE UNIQUE INDEX "stock_transactions_receipt_item_movement_key" ON "stock_transactions"("goods_receipt_item_id","movement_type");
CREATE INDEX "stock_transactions_company_id_warehouse_id_material_id_project_id_idx" ON "stock_transactions"("company_id","warehouse_id","material_id","project_id");
CREATE INDEX "stock_transactions_goods_receipt_id_idx" ON "stock_transactions"("goods_receipt_id");
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_goods_receipt_id_fkey" FOREIGN KEY ("goods_receipt_id") REFERENCES "goods_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_goods_receipt_item_id_fkey" FOREIGN KEY ("goods_receipt_item_id") REFERENCES "goods_receipt_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_posted_by_user_id_fkey" FOREIGN KEY ("posted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
ALTER TABLE "stock_transactions" ADD CONSTRAINT "stock_transactions_reversal_of_id_fkey" FOREIGN KEY ("reversal_of_id") REFERENCES "stock_transactions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- Cross-table scope and source identity are enforced even when a caller bypasses
-- the NestJS service. Workflow eligibility and concurrency are also checked by
-- the Stage B posting service under serializable transactions.
CREATE OR REPLACE FUNCTION enforce_goods_receipt_scope()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  po RECORD;
  store RECORD;
BEGIN
  SELECT company_id, project_id, supplier_id INTO po
  FROM purchase_orders WHERE id = NEW.purchase_order_id;
  SELECT company_id, project_id, is_active INTO store
  FROM warehouses WHERE id = NEW.warehouse_id;
  IF NOT FOUND OR po.company_id IS DISTINCT FROM NEW.company_id
    OR po.project_id IS DISTINCT FROM NEW.project_id
    OR po.supplier_id IS DISTINCT FROM NEW.supplier_id
    OR store.company_id IS DISTINCT FROM NEW.company_id
    OR (store.project_id IS NOT NULL AND store.project_id <> NEW.project_id)
    OR NOT store.is_active
    OR NOT EXISTS (SELECT 1 FROM projects WHERE id = NEW.project_id AND company_id = NEW.company_id)
    OR NOT EXISTS (SELECT 1 FROM suppliers WHERE id = NEW.supplier_id AND company_id = NEW.company_id)
    OR NOT EXISTS (SELECT 1 FROM users WHERE id = NEW.created_by_user_id AND company_id = NEW.company_id)
  THEN
    RAISE EXCEPTION 'Goods Receipt source and Warehouse must match Company and Project';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER goods_receipt_scope_guard BEFORE INSERT OR UPDATE OF
  company_id, project_id, supplier_id, warehouse_id, purchase_order_id
ON goods_receipts FOR EACH ROW EXECUTE FUNCTION enforce_goods_receipt_scope();

CREATE OR REPLACE FUNCTION enforce_goods_receipt_item_source()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  source RECORD;
  parent_id UUID;
  parent_submitted TIMESTAMPTZ;
BEGIN
  SELECT purchase_order_id, submitted_at INTO parent_id, parent_submitted
  FROM goods_receipts WHERE id = NEW.goods_receipt_id;
  SELECT purchase_order_id, quotation_award_id, material_id, uom_id,
    material_code_snapshot, uom_code_snapshot, line_type INTO source
  FROM purchase_order_lines WHERE id = NEW.purchase_order_line_id;
  IF parent_id IS NULL OR parent_submitted IS NOT NULL
    OR source.purchase_order_id IS DISTINCT FROM parent_id
    OR source.line_type <> 'MATERIAL'
    OR source.material_id IS DISTINCT FROM NEW.material_id
    OR source.uom_id IS DISTINCT FROM NEW.uom_id
    OR source.quotation_award_id IS DISTINCT FROM NEW.quotation_award_id
    OR source.material_code_snapshot IS DISTINCT FROM NEW.material_code_snapshot
    OR source.uom_code_snapshot IS DISTINCT FROM NEW.uom_code_snapshot
  THEN
    RAISE EXCEPTION 'Goods Receipt item must match its Draft approved-PO material source';
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER goods_receipt_item_source_guard BEFORE INSERT OR UPDATE ON goods_receipt_items
FOR EACH ROW EXECUTE FUNCTION enforce_goods_receipt_item_source();

CREATE OR REPLACE FUNCTION protect_goods_receipt_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Goods Receipt history cannot be deleted'; END IF;
  IF OLD.posted_at IS NOT NULL AND
    (NEW.company_id, NEW.project_id, NEW.supplier_id, NEW.warehouse_id,
     NEW.purchase_order_id, NEW.receipt_number, NEW.approval_instance_id,
     NEW.created_by_user_id, NEW.submitted_by_user_id, NEW.posted_by_user_id,
     NEW.post_key, NEW.remarks, NEW.created_at, NEW.submitted_at, NEW.posted_at)
    IS DISTINCT FROM
    (OLD.company_id, OLD.project_id, OLD.supplier_id, OLD.warehouse_id,
     OLD.purchase_order_id, OLD.receipt_number, OLD.approval_instance_id,
     OLD.created_by_user_id, OLD.submitted_by_user_id, OLD.posted_by_user_id,
     OLD.post_key, OLD.remarks, OLD.created_at, OLD.submitted_at, OLD.posted_at)
  THEN RAISE EXCEPTION 'Posted Goods Receipt is immutable'; END IF;
  IF OLD.reversed_at IS NOT NULL AND
    (NEW.reversed_at, NEW.reversal_key, NEW.reversal_reason, NEW.reversed_by_user_id)
    IS DISTINCT FROM
    (OLD.reversed_at, OLD.reversal_key, OLD.reversal_reason, OLD.reversed_by_user_id)
  THEN RAISE EXCEPTION 'Goods Receipt reversal is immutable'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER goods_receipt_history_guard BEFORE UPDATE OR DELETE ON goods_receipts
FOR EACH ROW EXECUTE FUNCTION protect_goods_receipt_history();

CREATE OR REPLACE FUNCTION protect_goods_receipt_items()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP = 'DELETE' AND EXISTS
    (SELECT 1 FROM goods_receipts WHERE id = OLD.goods_receipt_id AND submitted_at IS NOT NULL)
  THEN RAISE EXCEPTION 'Submitted Goods Receipt items are immutable'; END IF;
  IF TG_OP = 'UPDATE' AND EXISTS
    (SELECT 1 FROM goods_receipts WHERE id = OLD.goods_receipt_id AND submitted_at IS NOT NULL)
  THEN RAISE EXCEPTION 'Submitted Goods Receipt items are immutable'; END IF;
  RETURN COALESCE(NEW, OLD);
END; $$;
CREATE TRIGGER goods_receipt_items_history_guard BEFORE UPDATE OR DELETE ON goods_receipt_items
FOR EACH ROW EXECUTE FUNCTION protect_goods_receipt_items();

CREATE OR REPLACE FUNCTION protect_stock_transactions()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  RAISE EXCEPTION 'Stock Transactions are append-only';
END; $$;
CREATE TRIGGER stock_transactions_immutable BEFORE UPDATE OR DELETE ON stock_transactions
FOR EACH ROW EXECUTE FUNCTION protect_stock_transactions();

CREATE OR REPLACE FUNCTION enforce_stock_transaction_source()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE
  source RECORD;
  original RECORD;
BEGIN
  SELECT r.company_id, r.warehouse_id, r.project_id, r.posted_at, r.reversed_at,
    i.material_id, i.uom_id, i.quantity AS item_quantity
  INTO source FROM goods_receipts r
  JOIN goods_receipt_items i ON i.goods_receipt_id = r.id
  WHERE r.id = NEW.goods_receipt_id AND i.id = NEW.goods_receipt_item_id;
  IF NOT FOUND OR source.posted_at IS NULL
    OR NEW.company_id IS DISTINCT FROM source.company_id
    OR NEW.warehouse_id IS DISTINCT FROM source.warehouse_id
    OR NEW.project_id IS DISTINCT FROM source.project_id
    OR NEW.material_id IS DISTINCT FROM source.material_id
    OR NEW.uom_id IS DISTINCT FROM source.uom_id
  THEN RAISE EXCEPTION 'Stock movement source dimensions do not match posted Goods Receipt'; END IF;

  IF NEW.movement_type = 'GOODS_RECEIPT' THEN
    IF source.reversed_at IS NOT NULL OR NEW.quantity <> source.item_quantity
    THEN RAISE EXCEPTION 'Receipt movement quantity/state mismatch'; END IF;
  ELSIF NEW.movement_type = 'GOODS_RECEIPT_REVERSAL' THEN
    SELECT * INTO original FROM stock_transactions WHERE id = NEW.reversal_of_id;
    IF NOT FOUND OR source.reversed_at IS NULL
      OR original.movement_type <> 'GOODS_RECEIPT'
      OR original.goods_receipt_item_id <> NEW.goods_receipt_item_id
      OR original.quantity <> -NEW.quantity
    THEN RAISE EXCEPTION 'Reversal must exactly negate its source movement'; END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER stock_transactions_source_guard BEFORE INSERT ON stock_transactions
FOR EACH ROW EXECUTE FUNCTION enforce_stock_transaction_source();

CREATE OR REPLACE FUNCTION enforce_warehouse_stock_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF NEW.project_id IS DISTINCT FROM OLD.project_id
    AND EXISTS (SELECT 1 FROM stock_transactions WHERE warehouse_id = OLD.id)
  THEN RAISE EXCEPTION 'Warehouse with stock history cannot change Project'; END IF;
  IF OLD.is_active AND NOT NEW.is_active
    AND EXISTS (
      SELECT 1 FROM stock_transactions WHERE warehouse_id = OLD.id
      GROUP BY material_id, project_id
      HAVING SUM(quantity) <> 0
    )
  THEN RAISE EXCEPTION 'Warehouse with on-hand stock cannot be archived'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER warehouses_stock_history_guard BEFORE UPDATE OF project_id, is_active ON warehouses
FOR EACH ROW EXECUTE FUNCTION enforce_warehouse_stock_history();

CREATE OR REPLACE FUNCTION enforce_po_receipt_history()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE outstanding DECIMAL(38,4);
BEGIN
  IF TG_TABLE_NAME = 'purchase_orders' THEN
    IF NEW.cancelled_at IS NOT NULL AND OLD.cancelled_at IS NULL AND
      EXISTS (
        SELECT 1 FROM goods_receipts r
        JOIN purchase_orders p ON p.id = r.purchase_order_id
        WHERE p.company_id = OLD.company_id AND p.po_number = OLD.po_number
          AND r.posted_at IS NOT NULL AND r.reversed_at IS NULL
      )
    THEN RAISE EXCEPTION 'PO with outstanding receipt cannot be cancelled'; END IF;
  ELSE
    SELECT COALESCE(SUM(i.quantity), 0) INTO outstanding
    FROM goods_receipt_items i JOIN goods_receipts r ON r.id = i.goods_receipt_id
    WHERE i.quotation_award_id = NEW.quotation_award_id
      AND r.posted_at IS NOT NULL AND r.reversed_at IS NULL;
    IF NEW.quantity < outstanding
    THEN RAISE EXCEPTION 'PO line quantity cannot fall below outstanding received quantity'; END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER purchase_orders_receipt_cancel_guard BEFORE UPDATE OF cancelled_at ON purchase_orders
FOR EACH ROW EXECUTE FUNCTION enforce_po_receipt_history();
CREATE TRIGGER purchase_order_lines_receipt_quantity_guard BEFORE INSERT OR UPDATE OF quantity ON purchase_order_lines
FOR EACH ROW EXECUTE FUNCTION enforce_po_receipt_history();

CREATE OR REPLACE FUNCTION protect_received_po_line_delete()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM goods_receipt_items i
    JOIN goods_receipts r ON r.id = i.goods_receipt_id
    JOIN purchase_orders source_po ON source_po.id = r.purchase_order_id
    JOIN purchase_orders current_po ON current_po.id = OLD.purchase_order_id
    WHERE i.quotation_award_id = OLD.quotation_award_id
      AND source_po.company_id = current_po.company_id
      AND source_po.po_number = current_po.po_number
      AND r.posted_at IS NOT NULL AND r.reversed_at IS NULL
  ) THEN
    RAISE EXCEPTION 'PO line with outstanding receipt cannot be deleted';
  END IF;
  RETURN OLD;
END; $$;
CREATE TRIGGER purchase_order_lines_received_delete_guard BEFORE DELETE ON purchase_order_lines
FOR EACH ROW EXECUTE FUNCTION protect_received_po_line_delete();
