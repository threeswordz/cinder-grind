-- Serialize controlled transfer posting with both Project reassignment and
-- archival, including the first movement into a previously empty Warehouse.
-- FOR KEY SHARE alone permits non-key activity updates. FOR SHARE conflicts
-- with both key and non-key Warehouse writers until this posting commits.
CREATE OR REPLACE FUNCTION erp_transfer_live_warehouse_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.movement_type IN ('STOCK_TRANSFER_OUT','STOCK_TRANSFER_IN')
  AND EXISTS(SELECT 1 FROM transfer_custodies WHERE transfer_id=NEW.stock_transfer_id)
 THEN
  PERFORM 1 FROM warehouses WHERE id=NEW.warehouse_id FOR SHARE;
  IF NOT EXISTS(SELECT 1 FROM warehouses w JOIN projects p ON p.id=NEW.project_id AND p.company_id=NEW.company_id AND p.is_active
   WHERE w.id=NEW.warehouse_id AND w.company_id=NEW.company_id AND w.is_active AND (w.project_id IS NULL OR w.project_id=NEW.project_id))
  THEN RAISE EXCEPTION 'TRANSFER_WAREHOUSE_SCOPE_CHANGED'; END IF;
 END IF;
 RETURN NEW;
END $$;
