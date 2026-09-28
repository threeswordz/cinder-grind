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
