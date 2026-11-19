-- DEC-050 B: additive stock-effect provenance. No stock rewrite, no activation.
-- Each material UOM effect pin belongs to exactly one canonical StockTransaction.
CREATE TABLE material_uom_effect_pins (
  stock_transaction_id uuid PRIMARY KEY REFERENCES stock_transactions(id) ON DELETE RESTRICT,
  company_id uuid NOT NULL,
  material_id uuid NOT NULL,
  source_uom_id uuid NOT NULL REFERENCES units_of_measure(id) ON DELETE RESTRICT,
  source_quantity numeric(18,4) NOT NULL,
  stock_uom_id uuid NOT NULL REFERENCES units_of_measure(id) ON DELETE RESTRICT,
  stock_quantity numeric(18,4) NOT NULL,
  effect_sign integer NOT NULL,
  business_date date NOT NULL,
  basis_version integer NOT NULL,
  revision_id uuid REFERENCES material_uom_revisions(id) ON DELETE RESTRICT,
  numerator varchar(38) NOT NULL,
  denominator varchar(38) NOT NULL,
  created_at timestamptz(6) NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT material_uom_effect_pin_basis_fk FOREIGN KEY (company_id,material_id)
    REFERENCES material_uom_bases(company_id,material_id) ON DELETE RESTRICT,
  CONSTRAINT material_uom_effect_pin_quantity_shape CHECK
    (source_quantity>0 AND stock_quantity>0 AND effect_sign IN (-1,1) AND basis_version>=1 AND business_date BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'
     AND numerator ~ '^[1-9][0-9]{0,37}$' AND denominator ~ '^[1-9][0-9]{0,37}$')
);
CREATE INDEX material_uom_effect_pins_company_material_date_idx
  ON material_uom_effect_pins(company_id,material_id,business_date);

-- Existing stock transactions are never modified. This is intentionally
-- non-activating; future owning posting services must create pins atomically.
CREATE FUNCTION erp_material_uom_effect_pin_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ledger stock_transactions%ROWTYPE;
        basis material_uom_bases%ROWTYPE;
        source_unit units_of_measure%ROWTYPE;
        stock_unit units_of_measure%ROWTYPE;
        selected_revision material_uom_revisions%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'MATERIAL_UOM_EFFECT_PIN_IMMUTABLE'; END IF;
 SELECT * INTO ledger FROM stock_transactions WHERE id=NEW.stock_transaction_id;
 IF NOT FOUND OR ledger.company_id<>NEW.company_id OR ledger.material_id<>NEW.material_id
    OR ledger.uom_id<>NEW.stock_uom_id OR ledger.quantity<>NEW.stock_quantity*NEW.effect_sign
 THEN RAISE EXCEPTION 'MATERIAL_UOM_LEDGER_PIN_MISMATCH'; END IF;
 SELECT * INTO basis FROM material_uom_bases WHERE company_id=NEW.company_id AND material_id=NEW.material_id;
 IF NOT FOUND OR basis.stock_uom_id<>NEW.stock_uom_id OR basis.version<NEW.basis_version
 THEN RAISE EXCEPTION 'MATERIAL_UOM_BASIS_MISMATCH'; END IF;
 SELECT * INTO source_unit FROM units_of_measure WHERE id=NEW.source_uom_id AND company_id=NEW.company_id AND is_active;
 SELECT * INTO stock_unit FROM units_of_measure WHERE id=NEW.stock_uom_id AND company_id=NEW.company_id AND is_active;
 IF source_unit.id IS NULL OR stock_unit.id IS NULL
    OR stock_unit.decimal_places<>basis.stock_precision
    OR NEW.source_quantity * NEW.numerator::numeric <> NEW.stock_quantity * NEW.denominator::numeric
    OR mod(NEW.source_quantity * power(10::numeric,source_unit.decimal_places),1)<>0
    OR mod(NEW.stock_quantity * power(10::numeric,basis.stock_precision),1)<>0
 THEN RAISE EXCEPTION 'MATERIAL_UOM_EFFECT_PIN_INVALID'; END IF;
 IF NEW.source_uom_id=NEW.stock_uom_id THEN
    IF NEW.revision_id IS NOT NULL OR NEW.numerator<>'1' OR NEW.denominator<>'1'
    THEN RAISE EXCEPTION 'MATERIAL_UOM_EFFECT_PIN_IDENTITY_REQUIRED'; END IF;
 ELSE
    IF NEW.revision_id IS NULL THEN RAISE EXCEPTION 'MATERIAL_UOM_EFFECT_PIN_REVISION_REQUIRED'; END IF;
    SELECT * INTO selected_revision FROM material_uom_revisions
      WHERE company_id=NEW.company_id AND material_id=NEW.material_id
       AND source_uom_id=NEW.source_uom_id AND effective_from<=NEW.business_date
      ORDER BY effective_from DESC, revision_no DESC LIMIT 1;
    IF selected_revision.id IS NULL OR selected_revision.id<>NEW.revision_id
       OR selected_revision.numerator<>NEW.numerator OR selected_revision.denominator<>NEW.denominator
       OR selected_revision.source_precision<>source_unit.decimal_places
       OR selected_revision.revision_no>NEW.basis_version
    THEN RAISE EXCEPTION 'MATERIAL_UOM_EFFECT_PIN_REVISION_MISMATCH'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER material_uom_effect_pin_guard
 BEFORE INSERT OR UPDATE OR DELETE ON material_uom_effect_pins
 FOR EACH ROW EXECUTE FUNCTION erp_material_uom_effect_pin_guard();
