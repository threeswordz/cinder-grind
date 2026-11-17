-- An empty destination Warehouse can be reassigned before its first receipt.
-- Recheck its live Project binding at the canonical stock insertion boundary.
CREATE FUNCTION erp_transfer_live_warehouse_scope() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.movement_type IN ('STOCK_TRANSFER_OUT','STOCK_TRANSFER_IN')
  AND EXISTS(SELECT 1 FROM transfer_custodies WHERE transfer_id=NEW.stock_transfer_id)
  AND NOT EXISTS(SELECT 1 FROM warehouses w JOIN projects p ON p.id=NEW.project_id AND p.company_id=NEW.company_id AND p.is_active
   WHERE w.id=NEW.warehouse_id AND w.company_id=NEW.company_id AND w.is_active AND (w.project_id IS NULL OR w.project_id=NEW.project_id))
 THEN RAISE EXCEPTION 'TRANSFER_WAREHOUSE_SCOPE_CHANGED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER transfer_live_warehouse_scope BEFORE INSERT ON stock_transactions FOR EACH ROW EXECUTE FUNCTION erp_transfer_live_warehouse_scope();
