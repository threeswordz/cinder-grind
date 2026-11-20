-- DEC-050 Stage C: read-only canonical issue/return consumption projection.
-- This function does NOT replace erp_mpi_usage, change an approval, activate a
-- material, backfill a historical source or authorize any stock posting.
-- Existing same-UOM business rules remain authoritative until the complete
-- frozen-plan/request write boundary and SQL admission are reviewed together.
CREATE FUNCTION erp_uom_plan_frozen_usage(
  plan_uuid uuid,
  source_uuid uuid,
  material_uuid uuid,
  entered_uom_uuid uuid,
  excluded_issue uuid DEFAULT NULL
) RETURNS numeric
LANGUAGE plpgsql STABLE AS $$
DECLARE
  linked RECORD;
  frozen RECORD;
  returns RECORD;
  total numeric := 0;
BEGIN
  -- Only current effective, posted, non-reversed linked issue items count.
  -- The plan/issue Company/Project/warehouse boundary is rechecked here rather
  -- than relying on caller-supplied ids or on a mutable balance.
  FOR linked IN
    SELECT h.company_id, h.id AS issue_id, i.id AS issue_item_id,
           i.uom_id, i.quantity AS entered_quantity
    FROM material_plan_issue_bindings b
    JOIN material_issues h ON h.id=b.issue_id
    JOIN material_plan_issue_allocations alloc ON alloc.authorization_id=b.authorization_id
    JOIN material_usage_plan_lines line ON line.id=alloc.plan_line_id
    JOIN material_usage_plans plan ON plan.id=alloc.plan_id
    JOIN material_issue_items i ON i.id=alloc.issue_item_id AND i.material_issue_id=h.id
    WHERE plan.id=plan_uuid AND line.budget_revision_line_id=source_uuid
      AND i.material_id=material_uuid AND i.uom_id=entered_uom_uuid
      AND plan.company_id=h.company_id AND plan.project_id=h.project_id
      AND plan.warehouse_id=h.warehouse_id
      AND h.posted_at IS NOT NULL AND h.reversed_at IS NULL
      AND h.id IS DISTINCT FROM excluded_issue
  LOOP
    SELECT s.source_uom_id, s.source_quantity, s.stock_uom_id,
           s.stock_quantity, s.business_date, s.basis_version, s.revision_id
      INTO frozen
    FROM material_uom_issue_source_pins s
    WHERE s.issue_item_id=linked.issue_item_id AND s.company_id=linked.company_id
      AND s.material_id=material_uuid;
    IF NOT FOUND
       OR frozen.source_uom_id IS DISTINCT FROM linked.uom_id
       OR frozen.source_quantity IS DISTINCT FROM linked.entered_quantity
       OR NOT EXISTS (
        SELECT 1 FROM material_uom_activations a
         WHERE a.material_id=material_uuid AND a.company_id=linked.company_id
           AND a.stock_uom_id=frozen.stock_uom_id
       )
    THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_FROZEN_ISSUE_REQUIRED'; END IF;

    SELECT COUNT(DISTINCT item.id) AS item_count,
           COUNT(tx.id) AS movement_count,
           COUNT(effect.stock_transaction_id) AS pinned_count,
           COALESCE(SUM(effect.stock_quantity),0) AS stock_returned
      INTO returns
    FROM material_return_items item
    JOIN material_returns header ON header.id=item.material_return_id
    LEFT JOIN stock_transactions tx ON tx.material_return_item_id=item.id
      AND tx.movement_type='MATERIAL_RETURN'
      AND tx.company_id=linked.company_id AND tx.material_id=material_uuid
      AND tx.uom_id=frozen.stock_uom_id
    LEFT JOIN material_uom_effect_pins effect
      ON effect.stock_transaction_id=tx.id AND effect.company_id=linked.company_id
      AND effect.material_id=material_uuid AND effect.stock_uom_id=frozen.stock_uom_id
    WHERE item.material_issue_item_id=linked.issue_item_id
      AND header.company_id=linked.company_id
      AND header.posted_at IS NOT NULL AND header.reversed_at IS NULL;

    -- A partially posted or unpinned return cannot become a stock-basis credit.
    -- Multiple effects for one return item are rejected, not summed twice.
    IF returns.item_count <> returns.movement_count
       OR returns.item_count <> returns.pinned_count
       OR returns.stock_returned > frozen.stock_quantity
       OR returns.stock_returned < 0
    THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_FROZEN_RETURN_REQUIRED'; END IF;

    total := total + frozen.stock_quantity - returns.stock_returned;
  END LOOP;
  RETURN total;
END $$;

COMMENT ON FUNCTION erp_uom_plan_frozen_usage(uuid,uuid,uuid,uuid,uuid) IS
  'Stage C fail-closed read-only canonical linked issue less immutable return provenance; not a posting/approval gate.';
