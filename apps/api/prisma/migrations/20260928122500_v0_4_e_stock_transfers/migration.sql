-- V0.4-E Stock Transfer foundation.
-- Extends the one immutable Stock Transaction Ledger; no second ledger or in-transit store.

CREATE TABLE "stock_transfers" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "source_warehouse_id" UUID NOT NULL,
  "destination_warehouse_id" UUID NOT NULL,
  "transfer_number" VARCHAR(120) NOT NULL,
  "transfer_date" DATE NOT NULL,
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
  CONSTRAINT "stock_transfers_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_transfers_warehouses_check" CHECK ("source_warehouse_id" <> "destination_warehouse_id"),
  CONSTRAINT "stock_transfers_post_fields_check" CHECK (
    ("posted_at" IS NULL AND "post_key" IS NULL AND "posted_by_user_id" IS NULL)
    OR ("posted_at" IS NOT NULL AND "post_key" IS NOT NULL AND "posted_by_user_id" IS NOT NULL)
  ),
  CONSTRAINT "stock_transfers_reverse_fields_check" CHECK (
    ("reversed_at" IS NULL AND "reversal_key" IS NULL AND "reversed_by_user_id" IS NULL)
    OR ("reversed_at" IS NOT NULL AND "posted_at" IS NOT NULL AND "reversal_key" IS NOT NULL
      AND "reversed_by_user_id" IS NOT NULL AND NULLIF(BTRIM("reversal_reason"),'') IS NOT NULL)
  )
);
CREATE UNIQUE INDEX "stock_transfers_company_number_key" ON "stock_transfers"("company_id","transfer_number");
CREATE UNIQUE INDEX "stock_transfers_approval_instance_key" ON "stock_transfers"("approval_instance_id");
CREATE UNIQUE INDEX "stock_transfers_post_key_key" ON "stock_transfers"("post_key");
CREATE UNIQUE INDEX "stock_transfers_reversal_key_key" ON "stock_transfers"("reversal_key");
CREATE INDEX "stock_transfers_company_created_idx" ON "stock_transfers"("company_id","created_at");
CREATE INDEX "stock_transfers_source_warehouse_idx" ON "stock_transfers"("source_warehouse_id");
CREATE INDEX "stock_transfers_destination_warehouse_idx" ON "stock_transfers"("destination_warehouse_id");

CREATE TABLE "stock_transfer_items" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "stock_transfer_id" UUID NOT NULL,
  "line_no" INTEGER NOT NULL,
  "material_id" UUID NOT NULL,
  "quantity" DECIMAL(18,4) NOT NULL,
  "uom_id" UUID NOT NULL,
  "source_project_id" UUID NOT NULL,
  "destination_project_id" UUID NOT NULL,
  "remarks" TEXT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "stock_transfer_items_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_transfer_items_quantity_check" CHECK ("quantity" > 0),
  CONSTRAINT "stock_transfer_items_line_check" CHECK ("line_no" > 0)
);
CREATE UNIQUE INDEX "stock_transfer_items_transfer_line_key" ON "stock_transfer_items"("stock_transfer_id","line_no");
CREATE INDEX "stock_transfer_items_material_uom_idx" ON "stock_transfer_items"("material_id","uom_id");
CREATE INDEX "stock_transfer_items_source_project_idx" ON "stock_transfer_items"("source_project_id");
CREATE INDEX "stock_transfer_items_destination_project_idx" ON "stock_transfer_items"("destination_project_id");

ALTER TABLE "stock_transfers"
  ADD CONSTRAINT "stock_transfers_company_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "stock_transfers_source_warehouse_fkey" FOREIGN KEY ("source_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "stock_transfers_destination_warehouse_fkey" FOREIGN KEY ("destination_warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "stock_transfers_approval_fkey" FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "stock_transfers_creator_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "stock_transfers_submitter_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "stock_transfers_poster_fkey" FOREIGN KEY ("posted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "stock_transfers_reverser_fkey" FOREIGN KEY ("reversed_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "stock_transfer_items"
  ADD CONSTRAINT "stock_transfer_items_transfer_fkey" FOREIGN KEY ("stock_transfer_id") REFERENCES "stock_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "stock_transfer_items_material_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "stock_transfer_items_uom_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "stock_transfer_items_source_project_fkey" FOREIGN KEY ("source_project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "stock_transfer_items_destination_project_fkey" FOREIGN KEY ("destination_project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

INSERT INTO "number_sequences"
  ("id","company_id","entity_type","sequence_code","format_template","reset_rule","last_period_key","next_value")
SELECT gen_random_uuid(), c."id", 'STOCK_TRANSFER', 'STOCK_TRANSFER', 'STYYMM-###', 'MONTHLY', NULL, 1
FROM "companies" c
ON CONFLICT ("company_id","sequence_code") DO NOTHING;

CREATE OR REPLACE FUNCTION enforce_stock_transfer_scope()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE src RECORD; dst RECORD;
BEGIN
  SELECT company_id,project_id,is_active INTO src FROM warehouses WHERE id=NEW.source_warehouse_id;
  SELECT company_id,project_id,is_active INTO dst FROM warehouses WHERE id=NEW.destination_warehouse_id;
  IF NEW.source_warehouse_id=NEW.destination_warehouse_id
    OR src.company_id IS DISTINCT FROM NEW.company_id OR dst.company_id IS DISTINCT FROM NEW.company_id
    OR NOT COALESCE(src.is_active,FALSE) OR NOT COALESCE(dst.is_active,FALSE)
    OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.created_by_user_id AND company_id=NEW.company_id)
  THEN RAISE EXCEPTION 'Stock Transfer Warehouses and creator must match Company and active scope'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER stock_transfer_scope_guard BEFORE INSERT OR UPDATE OF
  company_id,source_warehouse_id,destination_warehouse_id,created_by_user_id
ON stock_transfers FOR EACH ROW EXECUTE FUNCTION enforce_stock_transfer_scope();

CREATE OR REPLACE FUNCTION enforce_stock_transfer_item_scope()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE parent RECORD; src_wh RECORD; dst_wh RECORD;
BEGIN
  SELECT company_id,source_warehouse_id,destination_warehouse_id,submitted_at
  INTO parent FROM stock_transfers WHERE id=NEW.stock_transfer_id;
  SELECT project_id INTO src_wh FROM warehouses WHERE id=parent.source_warehouse_id;
  SELECT project_id INTO dst_wh FROM warehouses WHERE id=parent.destination_warehouse_id;
  IF NOT FOUND OR parent.submitted_at IS NOT NULL
    OR NOT EXISTS (SELECT 1 FROM materials WHERE id=NEW.material_id AND company_id=parent.company_id)
    OR NOT EXISTS (SELECT 1 FROM units_of_measure WHERE id=NEW.uom_id AND company_id=parent.company_id)
    OR NOT EXISTS (SELECT 1 FROM projects WHERE id=NEW.source_project_id AND company_id=parent.company_id)
    OR NOT EXISTS (SELECT 1 FROM projects WHERE id=NEW.destination_project_id AND company_id=parent.company_id)
    OR (src_wh.project_id IS NOT NULL AND src_wh.project_id IS DISTINCT FROM NEW.source_project_id)
    OR (dst_wh.project_id IS NOT NULL AND dst_wh.project_id IS DISTINCT FROM NEW.destination_project_id)
  THEN RAISE EXCEPTION 'Stock Transfer item dimensions must match Company and Warehouse Project scope'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER stock_transfer_item_scope_guard BEFORE INSERT OR UPDATE ON stock_transfer_items
FOR EACH ROW EXECUTE FUNCTION enforce_stock_transfer_item_scope();

CREATE OR REPLACE FUNCTION protect_stock_transfer_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Stock Transfer history cannot be deleted'; END IF;
  IF OLD.submitted_at IS NOT NULL AND
    (NEW.company_id,NEW.source_warehouse_id,NEW.destination_warehouse_id,NEW.transfer_number,
     NEW.transfer_date,NEW.approval_instance_id,NEW.created_by_user_id,NEW.submitted_by_user_id,
     NEW.remarks,NEW.created_at,NEW.submitted_at)
    IS DISTINCT FROM
    (OLD.company_id,OLD.source_warehouse_id,OLD.destination_warehouse_id,OLD.transfer_number,
     OLD.transfer_date,OLD.approval_instance_id,OLD.created_by_user_id,OLD.submitted_by_user_id,
     OLD.remarks,OLD.created_at,OLD.submitted_at)
  THEN RAISE EXCEPTION 'Submitted Stock Transfer is immutable'; END IF;
  IF OLD.posted_at IS NOT NULL AND
    (NEW.posted_at,NEW.post_key,NEW.posted_by_user_id)
    IS DISTINCT FROM
    (OLD.posted_at,OLD.post_key,OLD.posted_by_user_id)
  THEN RAISE EXCEPTION 'Posted Stock Transfer posting identity is immutable'; END IF;
  IF OLD.reversed_at IS NOT NULL AND NEW IS DISTINCT FROM OLD
  THEN RAISE EXCEPTION 'Reversed Stock Transfer history is immutable'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER stock_transfer_history_guard BEFORE UPDATE OR DELETE ON stock_transfers
FOR EACH ROW EXECUTE FUNCTION protect_stock_transfer_history();

CREATE OR REPLACE FUNCTION protect_stock_transfer_items()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM stock_transfers
    WHERE id=COALESCE(NEW.stock_transfer_id,OLD.stock_transfer_id)
      AND submitted_at IS NOT NULL
  )
  THEN RAISE EXCEPTION 'Submitted Stock Transfer items are immutable'; END IF;
  RETURN COALESCE(NEW,OLD);
END; $$;
CREATE TRIGGER stock_transfer_items_history_guard BEFORE UPDATE OR DELETE ON stock_transfer_items
FOR EACH ROW EXECUTE FUNCTION protect_stock_transfer_items();

ALTER TABLE "stock_transactions"
  DROP CONSTRAINT "stock_transactions_source_family_check",
  DROP CONSTRAINT "stock_transactions_effect_check",
  ADD COLUMN "stock_transfer_id" UUID,
  ADD COLUMN "stock_transfer_item_id" UUID,
  ADD CONSTRAINT "stock_transactions_source_family_check" CHECK (
    num_nonnulls("goods_receipt_item_id","material_issue_item_id","material_return_item_id","stock_transfer_item_id") = 1
    AND ("goods_receipt_id" IS NULL) = ("goods_receipt_item_id" IS NULL)
    AND ("material_issue_id" IS NULL) = ("material_issue_item_id" IS NULL)
    AND ("material_return_id" IS NULL) = ("material_return_item_id" IS NULL)
    AND ("stock_transfer_id" IS NULL) = ("stock_transfer_item_id" IS NULL)
  ),
  ADD CONSTRAINT "stock_transactions_effect_check" CHECK (
    ("movement_type"='GOODS_RECEIPT' AND "quantity">0 AND "reversal_of_id" IS NULL)
    OR ("movement_type"='GOODS_RECEIPT_REVERSAL' AND "quantity"<0 AND "reversal_of_id" IS NOT NULL)
    OR ("movement_type"='MATERIAL_ISSUE' AND "quantity"<0 AND "reversal_of_id" IS NULL)
    OR ("movement_type"='MATERIAL_ISSUE_REVERSAL' AND "quantity">0 AND "reversal_of_id" IS NOT NULL)
    OR ("movement_type"='MATERIAL_RETURN' AND "quantity">0 AND "reversal_of_id" IS NULL)
    OR ("movement_type"='MATERIAL_RETURN_REVERSAL' AND "quantity"<0 AND "reversal_of_id" IS NOT NULL)
    OR ("movement_type"='STOCK_TRANSFER_OUT' AND "quantity"<0 AND "reversal_of_id" IS NULL)
    OR ("movement_type"='STOCK_TRANSFER_IN' AND "quantity">0 AND "reversal_of_id" IS NULL)
    OR ("movement_type"='STOCK_TRANSFER_OUT_REVERSAL' AND "quantity">0 AND "reversal_of_id" IS NOT NULL)
    OR ("movement_type"='STOCK_TRANSFER_IN_REVERSAL' AND "quantity"<0 AND "reversal_of_id" IS NOT NULL)
  );

CREATE UNIQUE INDEX "stock_transactions_transfer_item_movement_key"
ON "stock_transactions"("stock_transfer_item_id","movement_type");
CREATE INDEX "stock_transactions_stock_transfer_id_idx"
ON "stock_transactions"("stock_transfer_id");

ALTER TABLE "stock_transactions"
  ADD CONSTRAINT "stock_transactions_stock_transfer_fkey" FOREIGN KEY ("stock_transfer_id") REFERENCES "stock_transfers"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "stock_transactions_stock_transfer_item_fkey" FOREIGN KEY ("stock_transfer_item_id") REFERENCES "stock_transfer_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
  ELSIF NEW.material_return_item_id IS NOT NULL THEN
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
  ELSIF NEW.stock_transfer_item_id IS NOT NULL THEN
    SELECT h.company_id,h.source_warehouse_id,h.destination_warehouse_id,h.posted_at,h.reversed_at,
      i.material_id,i.uom_id,i.quantity AS item_quantity,i.source_project_id,i.destination_project_id
    INTO source
    FROM stock_transfers h JOIN stock_transfer_items i ON i.stock_transfer_id=h.id
    WHERE h.id=NEW.stock_transfer_id AND i.id=NEW.stock_transfer_item_id;
    IF NOT FOUND OR source.posted_at IS NULL OR NEW.company_id IS DISTINCT FROM source.company_id
      OR NEW.material_id IS DISTINCT FROM source.material_id OR NEW.uom_id IS DISTINCT FROM source.uom_id
      OR NEW.wbs_id IS NOT NULL OR NEW.cost_code_id IS NOT NULL OR NEW.activity_id IS NOT NULL
    THEN RAISE EXCEPTION 'Transfer Stock movement source dimensions mismatch'; END IF;
    IF NEW.movement_type='STOCK_TRANSFER_OUT' THEN
      IF source.reversed_at IS NOT NULL OR NEW.warehouse_id IS DISTINCT FROM source.source_warehouse_id
        OR NEW.project_id IS DISTINCT FROM source.source_project_id OR NEW.quantity<>-source.item_quantity
      THEN RAISE EXCEPTION 'Transfer OUT movement quantity/state mismatch'; END IF;
    ELSIF NEW.movement_type='STOCK_TRANSFER_IN' THEN
      IF source.reversed_at IS NOT NULL OR NEW.warehouse_id IS DISTINCT FROM source.destination_warehouse_id
        OR NEW.project_id IS DISTINCT FROM source.destination_project_id OR NEW.quantity<>source.item_quantity
      THEN RAISE EXCEPTION 'Transfer IN movement quantity/state mismatch'; END IF;
    ELSIF NEW.movement_type='STOCK_TRANSFER_OUT_REVERSAL' THEN
      SELECT * INTO original FROM stock_transactions WHERE id=NEW.reversal_of_id;
      IF NOT FOUND OR source.reversed_at IS NULL OR original.movement_type<>'STOCK_TRANSFER_OUT'
        OR original.stock_transfer_item_id<>NEW.stock_transfer_item_id OR original.quantity<>-NEW.quantity
      THEN RAISE EXCEPTION 'Transfer OUT reversal must exactly negate source'; END IF;
    ELSIF NEW.movement_type='STOCK_TRANSFER_IN_REVERSAL' THEN
      SELECT * INTO original FROM stock_transactions WHERE id=NEW.reversal_of_id;
      IF NOT FOUND OR source.reversed_at IS NULL OR original.movement_type<>'STOCK_TRANSFER_IN'
        OR original.stock_transfer_item_id<>NEW.stock_transfer_item_id OR original.quantity<>-NEW.quantity
      THEN RAISE EXCEPTION 'Transfer IN reversal must exactly negate source'; END IF;
    ELSE RAISE EXCEPTION 'Transfer source cannot use this movement type'; END IF;
  ELSE
    RAISE EXCEPTION 'Stock Transaction requires a supported source family';
  END IF;
  RETURN NEW;
END; $$;
