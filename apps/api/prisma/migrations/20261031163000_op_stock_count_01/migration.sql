-- OP-STOCK-COUNT-01: Project-site physical count with quantity-only reconciliation.
-- No Finance/Accounting/valuation effects and no automatic retained business-role grants.

CREATE TABLE "stock_counts" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "warehouse_id" UUID NOT NULL,
  "material_id" UUID NOT NULL,
  "uom_id" UUID NOT NULL,
  "counted_at" TIMESTAMPTZ(6) NOT NULL,
  "expected_on_hand" DECIMAL(18,4) NOT NULL,
  "expected_reserved" DECIMAL(18,4) NOT NULL,
  "actual_quantity" DECIMAL(18,4) NOT NULL,
  "variance_quantity" DECIMAL(18,4) NOT NULL,
  "evidence_reference" TEXT,
  "status" VARCHAR(20) NOT NULL DEFAULT 'DRAFT',
  "version" INTEGER NOT NULL DEFAULT 1,
  "created_by_user_id" UUID NOT NULL,
  "submitted_by_user_id" UUID,
  "decided_by_user_id" UUID,
  "decision_comment" TEXT,
  "post_key" VARCHAR(120),
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  "submitted_at" TIMESTAMPTZ(6),
  "decided_at" TIMESTAMPTZ(6),
  CONSTRAINT "stock_counts_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "stock_counts_values_check" CHECK (
    "expected_on_hand" >= 0 AND "expected_reserved" >= 0 AND "actual_quantity" >= 0
    AND "variance_quantity" = "actual_quantity" - "expected_on_hand"
    AND "version" > 0
    AND "status" IN ('DRAFT','SUBMITTED','APPROVED','REJECTED')
  ),
  CONSTRAINT "stock_counts_state_check" CHECK (
    ("status"='DRAFT' AND "submitted_by_user_id" IS NULL AND "submitted_at" IS NULL
      AND "decided_by_user_id" IS NULL AND "decided_at" IS NULL AND "decision_comment" IS NULL AND "post_key" IS NULL)
    OR
    ("status"='SUBMITTED' AND "submitted_by_user_id" IS NOT NULL AND "submitted_at" IS NOT NULL
      AND "decided_by_user_id" IS NULL AND "decided_at" IS NULL AND "decision_comment" IS NULL AND "post_key" IS NULL
      AND ("variance_quantity"=0 OR NULLIF(BTRIM("evidence_reference"),'') IS NOT NULL))
    OR
    ("status"='APPROVED' AND "submitted_by_user_id" IS NOT NULL AND "submitted_at" IS NOT NULL
      AND "decided_by_user_id" IS NOT NULL AND "decided_at" IS NOT NULL
      AND NULLIF(BTRIM("post_key"),'') IS NOT NULL
      AND ("variance_quantity"=0 OR NULLIF(BTRIM("evidence_reference"),'') IS NOT NULL)
      AND "decided_by_user_id" <> "created_by_user_id"
      AND "decided_by_user_id" <> "submitted_by_user_id")
    OR
    ("status"='REJECTED' AND "submitted_by_user_id" IS NOT NULL AND "submitted_at" IS NOT NULL
      AND "decided_by_user_id" IS NOT NULL AND "decided_at" IS NOT NULL AND "post_key" IS NULL
      AND ("variance_quantity"=0 OR NULLIF(BTRIM("evidence_reference"),'') IS NOT NULL)
      AND "decided_by_user_id" <> "created_by_user_id"
      AND "decided_by_user_id" <> "submitted_by_user_id")
  )
);

CREATE UNIQUE INDEX "stock_counts_post_key_key" ON "stock_counts"("post_key");
CREATE INDEX "stock_counts_company_project_status_created_idx"
  ON "stock_counts"("company_id","project_id","status","created_at");
CREATE INDEX "stock_counts_dimension_status_idx"
  ON "stock_counts"("warehouse_id","material_id","project_id","uom_id","status");

ALTER TABLE "stock_counts"
  ADD CONSTRAINT "stock_counts_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "stock_counts_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "stock_counts_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "stock_counts_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "stock_counts_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "stock_counts_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "stock_counts_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  ADD CONSTRAINT "stock_counts_decided_by_user_id_fkey" FOREIGN KEY ("decided_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION enforce_stock_count_scope()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE wh RECORD;
BEGIN
  SELECT company_id,project_id,is_site_warehouse,is_active INTO wh FROM warehouses WHERE id=NEW.warehouse_id;
  IF NOT FOUND OR wh.company_id IS DISTINCT FROM NEW.company_id
    OR wh.project_id IS DISTINCT FROM NEW.project_id OR NOT wh.is_site_warehouse OR NOT wh.is_active
    OR NOT EXISTS (SELECT 1 FROM projects WHERE id=NEW.project_id AND company_id=NEW.company_id AND is_active)
    OR NOT EXISTS (SELECT 1 FROM materials WHERE id=NEW.material_id AND company_id=NEW.company_id AND is_active)
    OR NOT EXISTS (SELECT 1 FROM units_of_measure WHERE id=NEW.uom_id AND company_id=NEW.company_id AND is_active)
    OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.created_by_user_id AND company_id=NEW.company_id AND is_active)
    OR (NEW.submitted_by_user_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM users WHERE id=NEW.submitted_by_user_id AND company_id=NEW.company_id AND is_active))
    OR (NEW.decided_by_user_id IS NOT NULL AND NOT EXISTS (
      SELECT 1 FROM users WHERE id=NEW.decided_by_user_id AND company_id=NEW.company_id AND is_active))
  THEN RAISE EXCEPTION 'STOCK_COUNT_SCOPE_INVALID' USING ERRCODE='23514'; END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER stock_count_scope_guard BEFORE INSERT OR UPDATE OF
 company_id,project_id,warehouse_id,material_id,uom_id,created_by_user_id,submitted_by_user_id,decided_by_user_id
ON stock_counts FOR EACH ROW EXECUTE FUNCTION enforce_stock_count_scope();

CREATE OR REPLACE FUNCTION protect_stock_count_history()
RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'STOCK_COUNT_HISTORY_IMMUTABLE' USING ERRCODE='23514'; END IF;
  IF OLD.status IN ('APPROVED','REJECTED') THEN
    RAISE EXCEPTION 'STOCK_COUNT_HISTORY_IMMUTABLE' USING ERRCODE='23514';
  END IF;
  IF NEW.version <> OLD.version + 1
    OR (NEW.id,NEW.company_id,NEW.project_id,NEW.warehouse_id,NEW.material_id,NEW.uom_id,
        NEW.expected_on_hand,NEW.expected_reserved,NEW.created_by_user_id,NEW.created_at)
       IS DISTINCT FROM
       (OLD.id,OLD.company_id,OLD.project_id,OLD.warehouse_id,OLD.material_id,OLD.uom_id,
        OLD.expected_on_hand,OLD.expected_reserved,OLD.created_by_user_id,OLD.created_at)
  THEN RAISE EXCEPTION 'STOCK_COUNT_VERSION_CONFLICT' USING ERRCODE='23514'; END IF;

  IF OLD.status='DRAFT' THEN
    IF NEW.status NOT IN ('DRAFT','SUBMITTED') THEN
      RAISE EXCEPTION 'STOCK_COUNT_STATE_INVALID' USING ERRCODE='23514';
    END IF;
    IF NEW.status='DRAFT' AND
      (NEW.submitted_by_user_id IS NOT NULL OR NEW.submitted_at IS NOT NULL
       OR NEW.decided_by_user_id IS NOT NULL OR NEW.decided_at IS NOT NULL
       OR NEW.decision_comment IS NOT NULL OR NEW.post_key IS NOT NULL)
    THEN RAISE EXCEPTION 'STOCK_COUNT_STATE_INVALID' USING ERRCODE='23514'; END IF;
    IF NEW.status='SUBMITTED' AND
      (NEW.counted_at,NEW.actual_quantity,NEW.variance_quantity,NEW.evidence_reference)
       IS DISTINCT FROM
      (OLD.counted_at,OLD.actual_quantity,OLD.variance_quantity,OLD.evidence_reference)
    THEN RAISE EXCEPTION 'STOCK_COUNT_SUBMISSION_MUTATION_DENIED' USING ERRCODE='23514'; END IF;
  ELSIF OLD.status='SUBMITTED' THEN
    IF NEW.status NOT IN ('APPROVED','REJECTED')
      OR (NEW.counted_at,NEW.actual_quantity,NEW.variance_quantity,NEW.evidence_reference,
          NEW.submitted_by_user_id,NEW.submitted_at)
         IS DISTINCT FROM
         (OLD.counted_at,OLD.actual_quantity,OLD.variance_quantity,OLD.evidence_reference,
          OLD.submitted_by_user_id,OLD.submitted_at)
    THEN RAISE EXCEPTION 'STOCK_COUNT_SUBMITTED_IMMUTABLE' USING ERRCODE='23514'; END IF;
  END IF;
  RETURN NEW;
END; $$;
CREATE TRIGGER stock_count_history_guard BEFORE UPDATE OR DELETE ON stock_counts
FOR EACH ROW EXECUTE FUNCTION protect_stock_count_history();

INSERT INTO "permissions" ("id","permission_code","module_code","description")
VALUES
 ('b0310000-0000-4000-8000-000000000001','inventory.stock_count.view','INVENTORY','View physical stock counts within effective Project scope'),
 ('b0310000-0000-4000-8000-000000000002','inventory.stock_count.create','INVENTORY','Record a physical stock count draft for a Project site warehouse'),
 ('b0310000-0000-4000-8000-000000000003','inventory.stock_count.edit','INVENTORY','Correct an unsigned physical stock count draft'),
 ('b0310000-0000-4000-8000-000000000004','inventory.stock_count.submit','INVENTORY','Submit a physical stock count for independent review'),
 ('b0310000-0000-4000-8000-000000000005','inventory.stock_count.approve','INVENTORY','Approve or reject physical stock counts and post quantity-only reconciliation')
ON CONFLICT ("permission_code") DO NOTHING;

-- No automatic role grants: Store Site/Khaimook mapping remains reviewed configuration.

ALTER TABLE "stock_transactions"
  DROP CONSTRAINT "stock_transactions_source_family_check",
  DROP CONSTRAINT "stock_transactions_effect_check",
  ADD COLUMN "stock_count_id" UUID,
  ADD CONSTRAINT "stock_transactions_source_family_check" CHECK (
    num_nonnulls("goods_receipt_item_id","material_issue_item_id","material_return_item_id","stock_transfer_item_id","stock_count_id") = 1
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
    OR ("movement_type"='STOCK_COUNT_ADJUSTMENT' AND "quantity"<>0 AND "reversal_of_id" IS NULL)
  );
CREATE UNIQUE INDEX "stock_transactions_stock_count_id_key" ON "stock_transactions"("stock_count_id");
ALTER TABLE "stock_transactions"
  ADD CONSTRAINT "stock_transactions_stock_count_id_fkey"
  FOREIGN KEY ("stock_count_id") REFERENCES "stock_counts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

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
  ELSIF NEW.stock_count_id IS NOT NULL THEN
    SELECT c.company_id,c.project_id,c.warehouse_id,c.material_id,c.uom_id,c.status,
      c.variance_quantity,c.decided_by_user_id,c.post_key
    INTO source FROM stock_counts c WHERE c.id=NEW.stock_count_id;
    IF NOT FOUND OR source.status<>'APPROVED'
      OR NEW.company_id IS DISTINCT FROM source.company_id
      OR NEW.project_id IS DISTINCT FROM source.project_id
      OR NEW.warehouse_id IS DISTINCT FROM source.warehouse_id
      OR NEW.material_id IS DISTINCT FROM source.material_id
      OR NEW.uom_id IS DISTINCT FROM source.uom_id
      OR NEW.wbs_id IS NOT NULL OR NEW.cost_code_id IS NOT NULL OR NEW.activity_id IS NOT NULL
      OR NEW.posted_by_user_id IS DISTINCT FROM source.decided_by_user_id
      OR NEW.effect_key IS DISTINCT FROM ('stock-count:' || NEW.stock_count_id::text || ':' || source.post_key)
    THEN RAISE EXCEPTION 'Stock count movement source dimensions mismatch'; END IF;
    IF NEW.movement_type<>'STOCK_COUNT_ADJUSTMENT'
      OR NEW.quantity<>source.variance_quantity OR NEW.quantity=0
    THEN RAISE EXCEPTION 'Stock count movement quantity/state mismatch'; END IF;
  ELSE
    RAISE EXCEPTION 'Stock Transaction requires a supported source family';
  END IF;
  RETURN NEW;
END; $$;

CREATE OR REPLACE FUNCTION enforce_stock_count_effect()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE effect_count integer; effect_quantity DECIMAL(18,4);
BEGIN
  SELECT COUNT(*),COALESCE(SUM(quantity),0)::DECIMAL(18,4)
  INTO effect_count,effect_quantity FROM stock_transactions WHERE stock_count_id=NEW.id;
  IF NEW.status='APPROVED' AND NEW.variance_quantity<>0 THEN
    IF effect_count<>1 OR effect_quantity<>NEW.variance_quantity
    THEN RAISE EXCEPTION 'STOCK_COUNT_EFFECT_MISSING' USING ERRCODE='23514'; END IF;
  ELSIF effect_count<>0 THEN
    RAISE EXCEPTION 'STOCK_COUNT_EFFECT_INVALID' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END; $$;
CREATE CONSTRAINT TRIGGER stock_count_effect_guard
AFTER INSERT OR UPDATE ON stock_counts
DEFERRABLE INITIALLY DEFERRED
FOR EACH ROW EXECUTE FUNCTION enforce_stock_count_effect();
