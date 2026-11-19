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
        original_pin material_uom_effect_pins%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'MATERIAL_UOM_EFFECT_PIN_IMMUTABLE'; END IF;
 SELECT * INTO ledger FROM stock_transactions WHERE id=NEW.stock_transaction_id;
 IF NOT FOUND OR ledger.company_id<>NEW.company_id OR ledger.material_id<>NEW.material_id
    OR ledger.uom_id<>NEW.stock_uom_id OR ledger.quantity<>NEW.stock_quantity*NEW.effect_sign
 THEN RAISE EXCEPTION 'MATERIAL_UOM_LEDGER_PIN_MISMATCH'; END IF;
 -- A reversal compensates an already-authorized stock effect. It must not
 -- reselect today's definition, require a currently active old unit, or
 -- manufacture conversion provenance for a historical unpinned movement.
 IF ledger.reversal_of_id IS NOT NULL THEN
    SELECT * INTO original_pin FROM material_uom_effect_pins WHERE stock_transaction_id=ledger.reversal_of_id;
    IF NOT FOUND OR (
      NEW.company_id,NEW.material_id,NEW.source_uom_id,NEW.source_quantity,
      NEW.stock_uom_id,NEW.stock_quantity,NEW.business_date,NEW.basis_version,
      NEW.revision_id,NEW.numerator,NEW.denominator,NEW.effect_sign
    ) IS DISTINCT FROM (
      original_pin.company_id,original_pin.material_id,original_pin.source_uom_id,original_pin.source_quantity,
      original_pin.stock_uom_id,original_pin.stock_quantity,original_pin.business_date,original_pin.basis_version,
      original_pin.revision_id,original_pin.numerator,original_pin.denominator,-original_pin.effect_sign
    ) THEN RAISE EXCEPTION 'MATERIAL_UOM_ORIGINAL_REVERSAL_PIN_REQUIRED'; END IF;
    RETURN NEW;
 END IF;
 -- Fresh pins are coupled to a newly posted effect, not retroactive edits.
 -- A saved source freeze will be required for mixed-unit forward posting
 -- when its owning source guard is integrated. Until then the existing
 -- strict source-unit/quantity guards remain authoritative.
 IF NOT EXISTS (
    SELECT 1 FROM stock_transactions t WHERE t.id=NEW.stock_transaction_id
      AND t.xmin=pg_current_xact_id()::xid
 ) THEN RAISE EXCEPTION 'MATERIAL_UOM_PIN_REQUIRES_NEW_LEDGER_EFFECT'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('material-uom:'||NEW.company_id::text||':'||NEW.material_id::text,0));
 SELECT * INTO basis FROM material_uom_bases WHERE company_id=NEW.company_id AND material_id=NEW.material_id;
 IF NOT FOUND OR basis.stock_uom_id<>NEW.stock_uom_id OR basis.version<>NEW.basis_version
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

-- Full reversals already run through the existing source, approval, availability,
-- immutability and idempotency guards. Preserve the conversion as part of the
-- same stock insert, including when called by any existing stock owner or SQL.
-- This is NOT a partial-return/transfer-receipt algorithm or activation grant.
CREATE FUNCTION erp_material_uom_copy_reversal_pin() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO material_uom_effect_pins (
   stock_transaction_id,company_id,material_id,source_uom_id,source_quantity,
   stock_uom_id,stock_quantity,effect_sign,business_date,basis_version,
   revision_id,numerator,denominator
 )
 SELECT NEW.id,p.company_id,p.material_id,p.source_uom_id,p.source_quantity,
   p.stock_uom_id,p.stock_quantity,-p.effect_sign,p.business_date,p.basis_version,
   p.revision_id,p.numerator,p.denominator
 FROM material_uom_effect_pins p WHERE p.stock_transaction_id=NEW.reversal_of_id;
 RETURN NEW;
END $$;
CREATE TRIGGER material_uom_copy_reversal_pin
 AFTER INSERT ON stock_transactions
 FOR EACH ROW WHEN (NEW.reversal_of_id IS NOT NULL)
 EXECUTE FUNCTION erp_material_uom_copy_reversal_pin();

-- Receipt-source freeze, tied to the canonical goods receipt submission.
-- Still non-activating: no route or compatibility flag enables this path.
CREATE TABLE material_uom_receipt_source_pins (
  receipt_item_id uuid PRIMARY KEY REFERENCES goods_receipt_items(id) ON DELETE RESTRICT,
  company_id uuid NOT NULL,
  project_id uuid NOT NULL,
  receipt_id uuid NOT NULL REFERENCES goods_receipts(id) ON DELETE RESTRICT,
  material_id uuid NOT NULL,
  source_uom_id uuid NOT NULL REFERENCES units_of_measure(id) ON DELETE RESTRICT,
  source_quantity numeric(18,4) NOT NULL,
  stock_uom_id uuid NOT NULL REFERENCES units_of_measure(id) ON DELETE RESTRICT,
  stock_quantity numeric(18,4) NOT NULL,
  business_date date NOT NULL,
  basis_version integer NOT NULL,
  revision_id uuid REFERENCES material_uom_revisions(id) ON DELETE RESTRICT,
  numerator varchar(38) NOT NULL,
  denominator varchar(38) NOT NULL,
  created_at timestamptz(6) NOT NULL DEFAULT transaction_timestamp(),
  CONSTRAINT material_uom_receipt_source_basis_fk FOREIGN KEY(company_id,material_id)
    REFERENCES material_uom_bases(company_id,material_id) ON DELETE RESTRICT,
  CONSTRAINT material_uom_receipt_source_shape CHECK (
    source_quantity>0 AND stock_quantity>0 AND basis_version>=1
    AND business_date BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'
    AND numerator ~ '^[1-9][0-9]{0,37}$' AND denominator ~ '^[1-9][0-9]{0,37}$'
  )
);
CREATE INDEX material_uom_receipt_source_pins_receipt_id_idx ON material_uom_receipt_source_pins(receipt_id);

CREATE FUNCTION erp_material_uom_receipt_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE header goods_receipts%ROWTYPE;
        item goods_receipt_items%ROWTYPE;
        basis material_uom_bases%ROWTYPE;
        source_unit units_of_measure%ROWTYPE;
        stock_unit units_of_measure%ROWTYPE;
        selected_revision material_uom_revisions%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'MATERIAL_UOM_RECEIPT_SOURCE_IMMUTABLE'; END IF;
 SELECT * INTO header FROM goods_receipts WHERE id=NEW.receipt_id FOR UPDATE;
 IF NOT FOUND OR header.company_id IS DISTINCT FROM NEW.company_id
   OR header.project_id IS DISTINCT FROM NEW.project_id
   OR header.submitted_at IS NULL OR header.approval_instance_id IS NULL
   OR header.posted_at IS NOT NULL OR header.reversed_at IS NOT NULL
   OR NOT EXISTS(SELECT 1 FROM goods_receipts WHERE id=NEW.receipt_id AND xmin=pg_current_xact_id()::xid)
 THEN RAISE EXCEPTION 'MATERIAL_UOM_RECEIPT_SUBMISSION_REQUIRED'; END IF;
 SELECT * INTO item FROM goods_receipt_items WHERE id=NEW.receipt_item_id AND goods_receipt_id=NEW.receipt_id FOR UPDATE;
 IF NOT FOUND OR item.material_id IS DISTINCT FROM NEW.material_id OR item.uom_id IS DISTINCT FROM NEW.source_uom_id
   OR item.quantity IS DISTINCT FROM NEW.source_quantity
 THEN RAISE EXCEPTION 'MATERIAL_UOM_RECEIPT_SOURCE_MISMATCH'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('material-uom:'||NEW.company_id::text||':'||NEW.material_id::text,0));
 SELECT * INTO basis FROM material_uom_bases WHERE company_id=NEW.company_id AND material_id=NEW.material_id;
 IF NOT FOUND OR basis.stock_uom_id<>NEW.stock_uom_id OR basis.version<>NEW.basis_version
 THEN RAISE EXCEPTION 'MATERIAL_UOM_BASIS_MISMATCH'; END IF;
 SELECT * INTO source_unit FROM units_of_measure WHERE id=NEW.source_uom_id AND company_id=NEW.company_id AND is_active;
 SELECT * INTO stock_unit FROM units_of_measure WHERE id=NEW.stock_uom_id AND company_id=NEW.company_id AND is_active;
 IF source_unit.id IS NULL OR stock_unit.id IS NULL OR stock_unit.decimal_places<>basis.stock_precision
   OR NEW.source_quantity*NEW.numerator::numeric<>NEW.stock_quantity*NEW.denominator::numeric
   OR mod(NEW.source_quantity*power(10::numeric,source_unit.decimal_places),1)<>0
   OR mod(NEW.stock_quantity*power(10::numeric,basis.stock_precision),1)<>0
 THEN RAISE EXCEPTION 'MATERIAL_UOM_RECEIPT_SOURCE_INVALID'; END IF;
 IF NEW.source_uom_id=NEW.stock_uom_id THEN
   IF NEW.revision_id IS NOT NULL OR NEW.numerator<>'1' OR NEW.denominator<>'1'
   THEN RAISE EXCEPTION 'MATERIAL_UOM_EFFECT_PIN_IDENTITY_REQUIRED'; END IF;
 ELSE
   SELECT * INTO selected_revision FROM material_uom_revisions WHERE company_id=NEW.company_id
     AND material_id=NEW.material_id AND source_uom_id=NEW.source_uom_id AND effective_from<=NEW.business_date
     ORDER BY effective_from DESC,revision_no DESC LIMIT 1;
   IF selected_revision.id IS NULL OR selected_revision.id IS DISTINCT FROM NEW.revision_id
     OR selected_revision.numerator<>NEW.numerator OR selected_revision.denominator<>NEW.denominator
     OR selected_revision.revision_no>NEW.basis_version OR selected_revision.source_precision<>source_unit.decimal_places
   THEN RAISE EXCEPTION 'MATERIAL_UOM_EFFECT_PIN_REVISION_MISMATCH'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER material_uom_receipt_source_guard
 BEFORE INSERT OR UPDATE OR DELETE ON material_uom_receipt_source_pins
 FOR EACH ROW EXECUTE FUNCTION erp_material_uom_receipt_source_guard();

CREATE FUNCTION erp_material_uom_receipt_source_drift_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM material_uom_receipt_source_pins WHERE receipt_item_id=OLD.id)
 THEN RAISE EXCEPTION 'MATERIAL_UOM_RECEIPT_SOURCE_IMMUTABLE'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER material_uom_receipt_source_drift_guard BEFORE UPDATE OR DELETE ON goods_receipt_items
 FOR EACH ROW EXECUTE FUNCTION erp_material_uom_receipt_source_drift_guard();

-- A source freeze is not permission to post. Keep the canonical ledger
-- fail-closed until this draft integrates all mixed-unit stock owners.
CREATE FUNCTION erp_material_uom_receipt_post_pending_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.goods_receipt_item_id IS NOT NULL AND EXISTS(
   SELECT 1 FROM material_uom_receipt_source_pins WHERE receipt_item_id=NEW.goods_receipt_item_id
 ) THEN RAISE EXCEPTION 'MATERIAL_UOM_CANONICAL_POSTING_NOT_READY'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER material_uom_receipt_post_pending_guard BEFORE INSERT ON stock_transactions
 FOR EACH ROW EXECUTE FUNCTION erp_material_uom_receipt_post_pending_guard();
