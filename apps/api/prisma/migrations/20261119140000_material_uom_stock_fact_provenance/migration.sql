-- DEC-050 Stage B: one-ledger additive canonical-stock projection foundation.
-- NO activation, historical backfill, new grants, relaxed source effects or new ledger.
-- Every existing StockTransaction source/effect guard is intentionally preserved.
ALTER TABLE stock_transactions
  ADD COLUMN stock_uom_id UUID,
  ADD COLUMN stock_quantity DECIMAL(18,4),
  ADD COLUMN conversion_business_date DATE,
  ADD COLUMN conversion_revision_id UUID,
  ADD COLUMN conversion_basis_version INTEGER,
  ADD COLUMN conversion_numerator VARCHAR(38),
  ADD COLUMN conversion_denominator VARCHAR(38);

ALTER TABLE stock_transactions
  ADD CONSTRAINT stock_conversion_group_check CHECK (
    (stock_uom_id IS NULL AND stock_quantity IS NULL
     AND conversion_business_date IS NULL AND conversion_revision_id IS NULL
     AND conversion_basis_version IS NULL AND conversion_numerator IS NULL
     AND conversion_denominator IS NULL)
    OR
    (stock_uom_id IS NOT NULL AND stock_quantity IS NOT NULL
     AND conversion_business_date IS NOT NULL AND conversion_basis_version IS NOT NULL
     AND conversion_numerator IS NOT NULL AND conversion_denominator IS NOT NULL)
  ),
  ADD CONSTRAINT stock_conversion_revision_fk FOREIGN KEY (conversion_revision_id)
    REFERENCES material_uom_revisions(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
  ADD CONSTRAINT stock_conversion_basis_check CHECK (
    conversion_basis_version IS NULL OR conversion_basis_version BETWEEN 1 AND 2147483646
  ),
  ADD CONSTRAINT stock_conversion_ratio_check CHECK (
    conversion_numerator IS NULL OR (
      conversion_numerator ~ '^[1-9][0-9]{0,37}$'
      AND conversion_denominator ~ '^[1-9][0-9]{0,37}$'
    )
  ),
  ADD CONSTRAINT stock_conversion_unit_fk FOREIGN KEY (stock_uom_id)
    REFERENCES units_of_measure(id) ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Exact numeric equality by cross-multiplication, not finite-decimal division:
-- a 1/3 source factor must never silently turn 1 into 0.3333 stock.
CREATE FUNCTION erp_material_uom_exact_stock_fact(
  entered numeric, stock numeric, numerator numeric, denominator numeric,
  source_precision integer, stock_precision integer
) RETURNS boolean LANGUAGE sql IMMUTABLE STRICT AS $$
 SELECT numerator > 0 AND denominator > 0
  AND source_precision BETWEEN 0 AND 6 AND stock_precision BETWEEN 0 AND 4
  AND entered <> 0 AND stock <> 0
  AND abs(entered) < 100000000000000::numeric
  AND abs(stock) < 100000000000000::numeric
  AND entered * numerator = stock * denominator
  AND entered * power(10::numeric,source_precision) =
      trunc(entered * power(10::numeric,source_precision))
  AND stock * power(10::numeric,stock_precision) =
      trunc(stock * power(10::numeric,stock_precision));
$$;

-- Existing source guard still checks the original entered movement quantity/uom
-- against its owning GR/Issue/Return/Transfer/Count. This BEFORE INSERT guard
-- independently authenticates any *additional* canonical stock fact against
-- the pinned material basis and the exact effective conversion revision.
CREATE FUNCTION erp_material_uom_stock_fact_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE basis material_uom_bases%ROWTYPE;
  rev material_uom_revisions%ROWTYPE;
  source_precision integer;
  actual_revision uuid;
  original stock_transactions%ROWTYPE;
BEGIN
 IF NEW.stock_quantity IS NULL THEN
   IF NEW.reversal_of_id IS NOT NULL THEN
     SELECT * INTO original FROM stock_transactions WHERE id=NEW.reversal_of_id;
     IF FOUND AND original.stock_quantity IS NOT NULL THEN
       RAISE EXCEPTION 'MATERIAL_UOM_REVERSAL_PROVENANCE_REQUIRED';
     END IF;
   END IF;
   RETURN NEW;
 END IF;

 SELECT * INTO basis FROM material_uom_bases
  WHERE material_id=NEW.material_id AND company_id=NEW.company_id;
 IF NOT FOUND OR basis.stock_uom_id IS DISTINCT FROM NEW.stock_uom_id
   OR NEW.conversion_basis_version NOT BETWEEN 1 AND basis.version
 THEN RAISE EXCEPTION 'MATERIAL_UOM_STOCK_BASIS_INVALID'; END IF;

 IF NOT EXISTS (SELECT 1 FROM units_of_measure
    WHERE id=NEW.uom_id AND company_id=NEW.company_id AND is_active)
 OR NOT EXISTS (SELECT 1 FROM units_of_measure
    WHERE id=NEW.stock_uom_id AND company_id=NEW.company_id
      AND decimal_places=basis.stock_precision AND is_active)
 THEN RAISE EXCEPTION 'MATERIAL_UOM_STOCK_UNIT_INVALID'; END IF;

 IF NEW.conversion_revision_id IS NULL THEN
   IF NEW.uom_id IS DISTINCT FROM basis.stock_uom_id
     OR NEW.conversion_numerator<>'1' OR NEW.conversion_denominator<>'1'
   THEN RAISE EXCEPTION 'MATERIAL_UOM_STOCK_IDENTITY_INVALID'; END IF;
   source_precision=basis.stock_precision;
 ELSE
   SELECT * INTO rev FROM material_uom_revisions WHERE id=NEW.conversion_revision_id;
   IF NOT FOUND OR rev.company_id IS DISTINCT FROM NEW.company_id
     OR rev.material_id IS DISTINCT FROM NEW.material_id
     OR rev.source_uom_id IS DISTINCT FROM NEW.uom_id
     OR rev.effective_from > NEW.conversion_business_date
     OR NEW.conversion_numerator IS DISTINCT FROM rev.numerator
     OR NEW.conversion_denominator IS DISTINCT FROM rev.denominator
     OR NEW.conversion_basis_version < rev.revision_no
   THEN RAISE EXCEPTION 'MATERIAL_UOM_STOCK_REVISION_INVALID'; END IF;
   -- Check the pinned version's deterministically effective revision.
   -- Later revisions do not retroactively invalidate an earlier frozen source.
   SELECT id INTO actual_revision FROM material_uom_revisions
     WHERE company_id=NEW.company_id AND material_id=NEW.material_id
       AND source_uom_id=NEW.uom_id
       AND revision_no<=NEW.conversion_basis_version
       AND effective_from<=NEW.conversion_business_date
     ORDER BY effective_from DESC, revision_no DESC LIMIT 1;
   IF actual_revision IS DISTINCT FROM NEW.conversion_revision_id
   THEN RAISE EXCEPTION 'MATERIAL_UOM_STOCK_REVISION_DRIFT'; END IF;
   -- The authorizing source may have committed under an earlier definition
   -- version. Its frozen revision is immutable; later revisions do not
   -- re-normalize an existing StockTransaction or any reversal.
   source_precision=rev.source_precision;
 END IF;

 IF NOT erp_material_uom_exact_stock_fact(
   NEW.quantity,NEW.stock_quantity,
   NEW.conversion_numerator::numeric,NEW.conversion_denominator::numeric,
   source_precision,basis.stock_precision)
 THEN RAISE EXCEPTION 'MATERIAL_UOM_STOCK_EXACTNESS_INVALID'; END IF;

 IF NEW.reversal_of_id IS NOT NULL THEN
   SELECT * INTO original FROM stock_transactions WHERE id=NEW.reversal_of_id;
   IF NOT FOUND OR original.stock_quantity IS NULL
     OR NEW.stock_quantity IS DISTINCT FROM -original.stock_quantity
     OR NEW.stock_uom_id IS DISTINCT FROM original.stock_uom_id
     OR NEW.conversion_business_date IS DISTINCT FROM original.conversion_business_date
     OR NEW.conversion_revision_id IS DISTINCT FROM original.conversion_revision_id
     OR NEW.conversion_basis_version IS DISTINCT FROM original.conversion_basis_version
     OR NEW.conversion_numerator IS DISTINCT FROM original.conversion_numerator
     OR NEW.conversion_denominator IS DISTINCT FROM original.conversion_denominator
   THEN RAISE EXCEPTION 'MATERIAL_UOM_REVERSAL_PROVENANCE_CHANGED'; END IF;
 END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER material_uom_stock_fact_guard
  BEFORE INSERT ON stock_transactions FOR EACH ROW
  EXECUTE FUNCTION erp_material_uom_stock_fact_guard();
