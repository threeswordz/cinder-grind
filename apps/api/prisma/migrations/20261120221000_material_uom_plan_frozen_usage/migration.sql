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


-- Stage C frozen plan source: additive/empty on upgrade; never backfill.
CREATE TABLE material_uom_plan_line_pins (
 plan_line_id uuid PRIMARY KEY REFERENCES material_usage_plan_lines(id) ON DELETE RESTRICT,
 company_id uuid NOT NULL, material_id uuid NOT NULL,
 source_uom_id uuid NOT NULL REFERENCES units_of_measure(id) ON DELETE RESTRICT,
 source_quantity numeric(18,4) NOT NULL,
 stock_uom_id uuid NOT NULL REFERENCES units_of_measure(id) ON DELETE RESTRICT,
 stock_uom_code varchar(30) NOT NULL,
 stock_quantity numeric(18,4) NOT NULL,
 business_date date NOT NULL, basis_version integer NOT NULL,
 revision_id uuid REFERENCES material_uom_revisions(id) ON DELETE RESTRICT,
 numerator varchar(38) NOT NULL, denominator varchar(38) NOT NULL,
 created_at timestamptz(6) NOT NULL DEFAULT now(),
 CONSTRAINT uom_plan_basis_fk FOREIGN KEY (company_id,material_id)
 REFERENCES material_uom_bases(company_id,material_id) ON DELETE RESTRICT,
 CONSTRAINT uom_plan_exact_nonzero CHECK(
 source_quantity>0 AND source_quantity<>'NaN'::numeric
 AND stock_quantity>0 AND stock_quantity<>'NaN'::numeric AND basis_version>0
 AND numerator ~ '^[1-9][0-9]{0,37}$'
 AND denominator ~ '^[1-9][0-9]{0,37}$'
 )
);
CREATE INDEX material_uom_plan_line_pins_dimension_idx
 ON material_uom_plan_line_pins(company_id,material_id,business_date);

CREATE FUNCTION erp_uom_plan_pin_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source RECORD; basis material_uom_bases%ROWTYPE;
  su units_of_measure%ROWTYPE; cu units_of_measure%ROWTYPE;
  selected material_uom_revisions%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_PIN_IMMUTABLE'; END IF;
 PERFORM erp_material_uom_require_activation(NEW.company_id,NEW.material_id);
 SELECT pl.*,pr.valid_from,p.company_id INTO source
  FROM material_usage_plan_lines pl
  JOIN material_usage_plan_revisions pr ON pr.id=pl.revision_id
  JOIN material_usage_plans p ON p.id=pr.plan_id
  WHERE pl.id=NEW.plan_line_id FOR SHARE OF pl;
 IF NOT FOUND OR source.company_id IS DISTINCT FROM NEW.company_id
  OR source.material_id IS DISTINCT FROM NEW.material_id
  OR source.uom_id IS DISTINCT FROM NEW.source_uom_id
  OR source.quantity IS DISTINCT FROM NEW.source_quantity
  OR source.valid_from IS DISTINCT FROM NEW.business_date
 THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_PIN_SOURCE_MISMATCH'; END IF;
 SELECT * INTO basis FROM material_uom_bases
   WHERE company_id=NEW.company_id AND material_id=NEW.material_id;
 SELECT * INTO su FROM units_of_measure
   WHERE id=NEW.source_uom_id AND company_id=NEW.company_id AND is_active;
 SELECT * INTO cu FROM units_of_measure
   WHERE id=NEW.stock_uom_id AND company_id=NEW.company_id AND is_active;
 IF basis.material_id IS NULL OR su.id IS NULL OR cu.id IS NULL
  OR basis.stock_uom_id IS DISTINCT FROM NEW.stock_uom_id
  OR basis.stock_uom_code IS DISTINCT FROM NEW.stock_uom_code
  OR basis.version IS DISTINCT FROM NEW.basis_version
  OR cu.decimal_places IS DISTINCT FROM basis.stock_precision
  OR NEW.source_quantity*NEW.numerator::numeric IS DISTINCT FROM NEW.stock_quantity*NEW.denominator::numeric
  OR mod(NEW.source_quantity*power(10::numeric,su.decimal_places),1)<>0
  OR mod(NEW.stock_quantity*power(10::numeric,basis.stock_precision),1)<>0
 THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_PIN_INVALID'; END IF;
 IF NEW.source_uom_id=NEW.stock_uom_id THEN
  IF NEW.revision_id IS NOT NULL OR NEW.numerator<>'1' OR NEW.denominator<>'1'
   THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_IDENTITY_REQUIRED'; END IF;
 ELSE
  SELECT * INTO selected FROM material_uom_revisions
   WHERE company_id=NEW.company_id AND material_id=NEW.material_id
    AND source_uom_id=NEW.source_uom_id AND effective_from<=NEW.business_date
   ORDER BY effective_from DESC,revision_no DESC LIMIT 1;
  IF selected.id IS NULL OR selected.id IS DISTINCT FROM NEW.revision_id
   OR selected.numerator IS DISTINCT FROM NEW.numerator
   OR selected.denominator IS DISTINCT FROM NEW.denominator
   OR selected.source_precision IS DISTINCT FROM su.decimal_places
   OR selected.revision_no>NEW.basis_version
   THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_DEFINITION_CHANGED'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER material_uom_plan_pin_guard
 BEFORE INSERT OR UPDATE OR DELETE ON material_uom_plan_line_pins
 FOR EACH ROW EXECUTE FUNCTION erp_uom_plan_pin_guard();

-- Stage B activation already serializes source rows. Permit only a *new plan
-- source* through this lock; its required immutable pin is enforced at commit.
-- Request lines continue to fail closed until their separate Stage C guard.
CREATE OR REPLACE FUNCTION erp_material_uom_source_activation_lock()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cid uuid;
BEGIN
 SELECT company_id INTO cid FROM materials WHERE id=NEW.material_id;
 PERFORM pg_advisory_xact_lock(hashtextextended('material-uom:'||cid::text||':'||NEW.material_id::text,0));
 PERFORM 1 FROM material_uom_activations
 WHERE company_id=cid AND material_id=NEW.material_id;
 IF FOUND AND TG_TABLE_NAME='material_request_lines'
  THEN RAISE EXCEPTION 'MATERIAL_UOM_DEMAND_RECONCILIATION_REQUIRED'; END IF;
 RETURN NEW;
END $$;

CREATE FUNCTION erp_uom_plan_pin_required() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cid uuid;
BEGIN
 SELECT p.company_id INTO cid FROM material_usage_plan_revisions r
 JOIN material_usage_plans p ON p.id=r.plan_id WHERE r.id=NEW.revision_id;
 IF EXISTS(SELECT 1 FROM material_uom_activations
           WHERE company_id=cid AND material_id=NEW.material_id)
 AND NOT EXISTS(SELECT 1 FROM material_uom_plan_line_pins
           WHERE plan_line_id=NEW.id)
 THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_PIN_REQUIRED'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER material_uom_plan_pin_required
 AFTER INSERT ON material_usage_plan_lines
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 EXECUTE FUNCTION erp_uom_plan_pin_required();

CREATE FUNCTION erp_uom_plan_pin_approval() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE l RECORD; frozen material_uom_plan_line_pins%ROWTYPE; chosen uuid;
BEGIN
 IF NEW.status='APPROVED' AND OLD.status IS DISTINCT FROM 'APPROVED' THEN
  FOR l IN SELECT ml.id,ml.material_id,p.company_id FROM material_usage_plan_lines ml
    JOIN material_usage_plans p ON p.id=NEW.plan_id
    WHERE ml.revision_id=NEW.id LOOP
   IF EXISTS(SELECT 1 FROM material_uom_activations
             WHERE company_id=l.company_id AND material_id=l.material_id) THEN
    SELECT * INTO frozen FROM material_uom_plan_line_pins WHERE plan_line_id=l.id;
    IF NOT FOUND THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_PIN_REQUIRED'; END IF;
    chosen:=NULL;
    IF frozen.source_uom_id<>frozen.stock_uom_id THEN
      SELECT id INTO chosen FROM material_uom_revisions
      WHERE company_id=l.company_id AND material_id=l.material_id
        AND source_uom_id=frozen.source_uom_id
        AND effective_from<=frozen.business_date
      ORDER BY effective_from DESC,revision_no DESC LIMIT 1;
    END IF;
    IF chosen IS DISTINCT FROM frozen.revision_id
     THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_DEFINITION_CHANGED'; END IF;
   END IF;
  END LOOP;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER material_uom_plan_pin_approval
 AFTER UPDATE ON material_usage_plan_revisions
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 EXECUTE FUNCTION erp_uom_plan_pin_approval();

-- No mixed-unit plan issue is admissible until the exact frozen-stock
-- consumption/overage calculation is enforced in BOTH API and PostgreSQL.
CREATE FUNCTION erp_uom_plan_block_unreconciled_issue() RETURNS trigger
LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM material_uom_plan_line_pins
   WHERE plan_line_id=NEW.plan_line_id)
 THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_CANONICAL_ISSUE_GATE_PENDING'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER material_uom_plan_block_unreconciled_issue
 BEFORE INSERT OR UPDATE ON material_plan_issue_allocations
 FOR EACH ROW EXECUTE FUNCTION erp_uom_plan_block_unreconciled_issue();
