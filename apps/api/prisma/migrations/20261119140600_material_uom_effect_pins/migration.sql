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
-- non-activating; the owning posting services create pins atomically.
CREATE FUNCTION erp_material_uom_effect_pin_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE ledger stock_transactions%ROWTYPE;
        basis material_uom_bases%ROWTYPE;
        source_unit units_of_measure%ROWTYPE;
        stock_unit units_of_measure%ROWTYPE;
        selected_revision material_uom_revisions%ROWTYPE;
        original_pin material_uom_effect_pins%ROWTYPE;
        frozen record;
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
 -- A saved source freeze is required for mixed-unit forward posting.
 -- Other stock owners retain their existing strict source-unit/quantity guards.
 IF NOT EXISTS (
    SELECT 1 FROM stock_transactions t WHERE t.id=NEW.stock_transaction_id
      AND t.xmin=pg_current_xact_id()::xid
 ) THEN RAISE EXCEPTION 'MATERIAL_UOM_PIN_REQUIRES_NEW_LEDGER_EFFECT'; END IF;
 -- At this draft boundary only a fully frozen receipt source may create a
 -- fresh pin. Later owners must add their own equally exact source binding.
 IF ledger.movement_type<>'GOODS_RECEIPT' THEN RAISE EXCEPTION 'MATERIAL_UOM_FRESH_SOURCE_REQUIRED'; END IF;
 SELECT * INTO frozen FROM material_uom_receipt_source_pins WHERE receipt_item_id=ledger.goods_receipt_item_id;
 IF NOT FOUND OR (NEW.company_id,NEW.material_id,NEW.source_uom_id,NEW.source_quantity,
      NEW.stock_uom_id,NEW.stock_quantity,NEW.business_date,NEW.basis_version,NEW.revision_id,NEW.numerator,NEW.denominator,NEW.effect_sign)
   IS DISTINCT FROM (frozen.company_id,frozen.material_id,frozen.source_uom_id,frozen.source_quantity,
      frozen.stock_uom_id,frozen.stock_quantity,frozen.business_date,frozen.basis_version,frozen.revision_id,frozen.numerator,frozen.denominator,1)
 THEN RAISE EXCEPTION 'MATERIAL_UOM_FRESH_SOURCE_REQUIRED'; END IF;
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

-- Frozen receipt source is authoritative; a superseded effective revision invalidates
-- an unposted approval instead of changing its quantity. Future-only revisions
-- cannot alter the selected effective revision.
CREATE FUNCTION erp_material_uom_assert_receipt_pin_current(item_id uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE p material_uom_receipt_source_pins%ROWTYPE; current_revision uuid;
BEGIN
 SELECT * INTO STRICT p FROM material_uom_receipt_source_pins WHERE receipt_item_id=item_id;
 PERFORM pg_advisory_xact_lock(hashtextextended('material-uom:'||p.company_id::text||':'||p.material_id::text,0));
 IF NOT EXISTS(SELECT 1 FROM material_uom_bases b JOIN materials m ON m.id=b.material_id
    JOIN units_of_measure su ON su.id=p.source_uom_id JOIN units_of_measure cu ON cu.id=p.stock_uom_id
    WHERE b.company_id=p.company_id AND b.material_id=p.material_id AND b.stock_uom_id=p.stock_uom_id
      AND m.company_id=p.company_id AND m.is_active AND su.company_id=p.company_id AND su.is_active
      AND cu.company_id=p.company_id AND cu.is_active AND cu.decimal_places=b.stock_precision)
 THEN RAISE EXCEPTION 'MATERIAL_UOM_RECEIPT_DEFINITION_CHANGED'; END IF;
 IF p.source_uom_id<>p.stock_uom_id THEN
   SELECT id INTO current_revision FROM material_uom_revisions
     WHERE company_id=p.company_id AND material_id=p.material_id AND source_uom_id=p.source_uom_id
       AND effective_from<=p.business_date ORDER BY effective_from DESC,revision_no DESC LIMIT 1;
   IF current_revision IS DISTINCT FROM p.revision_id
   THEN RAISE EXCEPTION 'MATERIAL_UOM_RECEIPT_DEFINITION_CHANGED'; END IF;
 END IF;
END $$;

CREATE OR REPLACE FUNCTION enforce_stock_transaction_source()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE source RECORD; original RECORD; frozen material_uom_receipt_source_pins%ROWTYPE;
BEGIN
  IF NEW.goods_receipt_item_id IS NOT NULL THEN
    SELECT r.company_id,r.warehouse_id,r.project_id,r.posted_at,r.reversed_at,
      i.material_id,i.uom_id,i.quantity AS item_quantity
    INTO source FROM goods_receipts r JOIN goods_receipt_items i ON i.goods_receipt_id=r.id
    WHERE r.id=NEW.goods_receipt_id AND i.id=NEW.goods_receipt_item_id;
    IF NOT FOUND OR source.posted_at IS NULL OR NEW.company_id IS DISTINCT FROM source.company_id
      OR NEW.warehouse_id IS DISTINCT FROM source.warehouse_id OR NEW.project_id IS DISTINCT FROM source.project_id
      OR NEW.material_id IS DISTINCT FROM source.material_id
      OR NEW.wbs_id IS NOT NULL OR NEW.cost_code_id IS NOT NULL OR NEW.activity_id IS NOT NULL
    THEN RAISE EXCEPTION 'Receipt Stock movement source dimensions mismatch'; END IF;
    SELECT * INTO frozen FROM material_uom_receipt_source_pins WHERE receipt_item_id=NEW.goods_receipt_item_id;
    IF frozen.receipt_item_id IS NOT NULL THEN
      IF frozen.receipt_id IS DISTINCT FROM NEW.goods_receipt_id OR frozen.company_id IS DISTINCT FROM NEW.company_id
        OR frozen.project_id IS DISTINCT FROM NEW.project_id OR frozen.material_id IS DISTINCT FROM NEW.material_id
        OR frozen.source_uom_id IS DISTINCT FROM source.uom_id OR frozen.source_quantity IS DISTINCT FROM source.item_quantity
        OR NEW.uom_id IS DISTINCT FROM frozen.stock_uom_id
      THEN RAISE EXCEPTION 'MATERIAL_UOM_RECEIPT_LEDGER_SOURCE_MISMATCH'; END IF;
    ELSIF NEW.uom_id IS DISTINCT FROM source.uom_id THEN
      RAISE EXCEPTION 'Receipt Stock movement source dimensions mismatch';
    END IF;
    IF NEW.movement_type='GOODS_RECEIPT' THEN
      IF source.reversed_at IS NOT NULL OR NEW.quantity<>COALESCE(frozen.stock_quantity,source.item_quantity)
      THEN RAISE EXCEPTION 'Receipt movement quantity/state mismatch'; END IF;
      IF frozen.receipt_item_id IS NOT NULL THEN
        PERFORM erp_material_uom_assert_receipt_pin_current(frozen.receipt_item_id);
        IF NOT EXISTS(SELECT 1 FROM goods_receipts g JOIN approval_instances a ON a.id=g.approval_instance_id
          WHERE g.id=NEW.goods_receipt_id AND a.approval_state='APPROVED'
            AND g.posted_by_user_id=NEW.posted_by_user_id AND NEW.effect_key='receipt:'||frozen.receipt_item_id::text
            AND g.xmin=pg_current_xact_id()::xid)
        THEN RAISE EXCEPTION 'MATERIAL_UOM_RECEIPT_APPROVED_POST_REQUIRED'; END IF;
      END IF;
    ELSIF NEW.movement_type='GOODS_RECEIPT_REVERSAL' THEN
      SELECT * INTO original FROM stock_transactions WHERE id=NEW.reversal_of_id;
      IF NOT FOUND OR source.reversed_at IS NULL OR original.movement_type<>'GOODS_RECEIPT'
        OR original.goods_receipt_item_id<>NEW.goods_receipt_item_id OR original.quantity<>-NEW.quantity
        OR original.uom_id IS DISTINCT FROM NEW.uom_id
      THEN RAISE EXCEPTION 'Receipt reversal must exactly negate source'; END IF;
      IF frozen.receipt_item_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM material_uom_effect_pins WHERE stock_transaction_id=original.id)
        THEN RAISE EXCEPTION 'MATERIAL_UOM_ORIGINAL_REVERSAL_PIN_REQUIRED'; END IF;
    ELSE RAISE EXCEPTION 'Receipt source cannot use this movement type'; END IF;
  ELSIF NEW.material_issue_item_id IS NOT NULL THEN
    IF NEW.movement_type='MATERIAL_ISSUE' AND EXISTS (
      SELECT 1 FROM material_issue_items i JOIN material_uom_reservation_pins p ON p.reservation_id=i.reservation_id
      WHERE i.id=NEW.material_issue_item_id
    ) THEN RAISE EXCEPTION 'MATERIAL_UOM_ISSUE_POSTING_NOT_READY'; END IF;
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
    IF EXISTS(SELECT 1 FROM transfer_custodies WHERE transfer_id=NEW.stock_transfer_id) THEN
      PERFORM erp_transfer_validate_movement(NEW); RETURN NEW;
    END IF;
    IF NEW.transfer_receipt_line_id IS NOT NULL THEN RAISE EXCEPTION 'TRANSFER_LEGACY_RECEIPT_PROVENANCE_INVALID'; END IF;
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

-- One pin per canonical forward goods receipt movement, generated from the frozen
-- source, never from caller-supplied conversion data.
CREATE FUNCTION erp_material_uom_copy_receipt_pin() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO material_uom_effect_pins(stock_transaction_id,company_id,material_id,
    source_uom_id,source_quantity,stock_uom_id,stock_quantity,effect_sign,business_date,
    basis_version,revision_id,numerator,denominator)
 SELECT NEW.id,p.company_id,p.material_id,p.source_uom_id,p.source_quantity,p.stock_uom_id,
    p.stock_quantity,1,p.business_date,p.basis_version,p.revision_id,p.numerator,p.denominator
 FROM material_uom_receipt_source_pins p WHERE p.receipt_item_id=NEW.goods_receipt_item_id;
 RETURN NEW;
END $$;
CREATE TRIGGER material_uom_copy_receipt_pin AFTER INSERT ON stock_transactions
 FOR EACH ROW WHEN (NEW.movement_type='GOODS_RECEIPT' AND NEW.goods_receipt_item_id IS NOT NULL)
 EXECUTE FUNCTION erp_material_uom_copy_receipt_pin();

-- Enforce completeness at transaction commit, including raw-SQL posting attempts.
CREATE FUNCTION erp_material_uom_receipt_post_proof() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE rid uuid;
BEGIN
 rid:=NEW.id;
 IF EXISTS(SELECT 1 FROM goods_receipts WHERE id=rid AND posted_at IS NOT NULL)
 AND EXISTS(SELECT 1 FROM material_uom_receipt_source_pins WHERE receipt_id=rid)
 AND EXISTS(SELECT 1 FROM goods_receipt_items i WHERE i.goods_receipt_id=rid AND NOT EXISTS(
   SELECT 1 FROM material_uom_receipt_source_pins p
   JOIN stock_transactions t ON t.goods_receipt_item_id=p.receipt_item_id AND t.movement_type='GOODS_RECEIPT'
   JOIN material_uom_effect_pins e ON e.stock_transaction_id=t.id
   WHERE p.receipt_item_id=i.id AND e.source_quantity=p.source_quantity
     AND e.stock_quantity=p.stock_quantity AND e.revision_id IS NOT DISTINCT FROM p.revision_id))
 THEN RAISE EXCEPTION 'MATERIAL_UOM_RECEIPT_POST_PROOF_REQUIRED'; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER material_uom_receipt_post_proof AFTER UPDATE ON goods_receipts
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_material_uom_receipt_post_proof();

-- Explicit dated reservation activation records the original demand and the
-- locked quantity in the single stock basis, without changing legacy rows.
CREATE TABLE material_uom_reservation_pins (
 reservation_id uuid PRIMARY KEY REFERENCES material_reservations(id) ON DELETE RESTRICT,
 company_id uuid NOT NULL, project_id uuid NOT NULL, warehouse_id uuid NOT NULL,
 material_id uuid NOT NULL,
 source_uom_id uuid NOT NULL REFERENCES units_of_measure(id) ON DELETE RESTRICT,
 source_quantity numeric(18,4) NOT NULL,
 stock_uom_id uuid NOT NULL REFERENCES units_of_measure(id) ON DELETE RESTRICT,
 stock_quantity numeric(18,4) NOT NULL,
 business_date date NOT NULL,
 basis_version integer NOT NULL,
 revision_id uuid REFERENCES material_uom_revisions(id) ON DELETE RESTRICT,
 numerator varchar(38) NOT NULL, denominator varchar(38) NOT NULL,
 created_at timestamptz(6) NOT NULL DEFAULT transaction_timestamp(),
 FOREIGN KEY(company_id,material_id) REFERENCES material_uom_bases(company_id,material_id) ON DELETE RESTRICT,
 CHECK(source_quantity>0 AND stock_quantity>0 AND basis_version>=1
 AND business_date BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'
 AND numerator ~ '^[1-9][0-9]{0,37}$' AND denominator ~ '^[1-9][0-9]{0,37}$')
);
CREATE INDEX material_uom_reservation_pins_dimension_idx ON material_uom_reservation_pins(company_id,project_id,warehouse_id,material_id,stock_uom_id);

CREATE FUNCTION erp_material_uom_reservation_pin_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r material_reservations%ROWTYPE;
 b material_uom_bases%ROWTYPE; su units_of_measure%ROWTYPE; cu units_of_measure%ROWTYPE;
 rev material_uom_revisions%ROWTYPE; free_quantity numeric;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'MATERIAL_UOM_RESERVATION_PIN_IMMUTABLE'; END IF;
 SELECT * INTO r FROM material_reservations WHERE id=NEW.reservation_id FOR UPDATE;
 IF NOT FOUND OR r.status<>'ACTIVE' OR r.activated_by_user_id IS NULL
 OR (r.company_id,r.project_id,r.warehouse_id,r.material_id,r.uom_id,r.quantity)
 IS DISTINCT FROM (NEW.company_id,NEW.project_id,NEW.warehouse_id,NEW.material_id,NEW.source_uom_id,NEW.source_quantity)
 OR NOT EXISTS(SELECT 1 FROM material_reservations WHERE id=r.id AND xmin=pg_current_xact_id()::xid)
 THEN RAISE EXCEPTION 'MATERIAL_UOM_RESERVATION_SOURCE_MISMATCH'; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('material-uom:'||NEW.company_id::text||':'||NEW.material_id::text,0));
 SELECT * INTO b FROM material_uom_bases WHERE company_id=NEW.company_id AND material_id=NEW.material_id;
 IF NOT FOUND OR b.stock_uom_id<>NEW.stock_uom_id OR b.version<>NEW.basis_version
 THEN RAISE EXCEPTION 'MATERIAL_UOM_BASIS_MISMATCH'; END IF;
 SELECT * INTO su FROM units_of_measure WHERE id=NEW.source_uom_id AND company_id=NEW.company_id AND is_active;
 SELECT * INTO cu FROM units_of_measure WHERE id=NEW.stock_uom_id AND company_id=NEW.company_id AND is_active;
 IF su.id IS NULL OR cu.id IS NULL OR cu.decimal_places<>b.stock_precision
 OR NOT EXISTS(SELECT 1 FROM materials WHERE id=NEW.material_id AND company_id=NEW.company_id AND is_active)
 OR NEW.source_quantity*NEW.numerator::numeric<>NEW.stock_quantity*NEW.denominator::numeric
 OR mod(NEW.source_quantity*power(10::numeric,su.decimal_places),1)<>0
 OR mod(NEW.stock_quantity*power(10::numeric,b.stock_precision),1)<>0
 THEN RAISE EXCEPTION 'MATERIAL_UOM_RESERVATION_PIN_INVALID'; END IF;
 IF NEW.source_uom_id=NEW.stock_uom_id THEN
   IF NEW.revision_id IS NOT NULL OR NEW.numerator<>'1' OR NEW.denominator<>'1'
   THEN RAISE EXCEPTION 'MATERIAL_UOM_EFFECT_PIN_IDENTITY_REQUIRED'; END IF;
 ELSE
   SELECT * INTO rev FROM material_uom_revisions WHERE company_id=NEW.company_id
    AND material_id=NEW.material_id AND source_uom_id=NEW.source_uom_id AND effective_from<=NEW.business_date
    ORDER BY effective_from DESC,revision_no DESC LIMIT 1;
   IF rev.id IS NULL OR rev.id IS DISTINCT FROM NEW.revision_id OR rev.numerator<>NEW.numerator
    OR rev.denominator<>NEW.denominator OR rev.source_precision<>su.decimal_places OR rev.revision_no>NEW.basis_version
   THEN RAISE EXCEPTION 'MATERIAL_UOM_EFFECT_PIN_REVISION_MISMATCH'; END IF;
 END IF;
 PERFORM pg_advisory_xact_lock(hashtext('inventory-stock:'||NEW.company_id::text||':'||NEW.warehouse_id::text||':'||NEW.material_id::text||':'||NEW.project_id::text||':'||NEW.stock_uom_id::text));
 SELECT COALESCE((SELECT SUM(t.quantity) FROM stock_transactions t WHERE t.company_id=NEW.company_id
 AND t.project_id=NEW.project_id AND t.warehouse_id=NEW.warehouse_id AND t.material_id=NEW.material_id AND t.uom_id=NEW.stock_uom_id),0)
 - COALESCE((SELECT SUM(COALESCE(p.stock_quantity,a.quantity)) FROM material_reservations a LEFT JOIN material_uom_reservation_pins p ON p.reservation_id=a.id
 WHERE a.company_id=NEW.company_id AND a.project_id=NEW.project_id AND a.warehouse_id=NEW.warehouse_id
 AND a.material_id=NEW.material_id AND COALESCE(p.stock_uom_id,a.uom_id)=NEW.stock_uom_id AND a.status='ACTIVE' AND a.id<>NEW.reservation_id),0)
 INTO free_quantity;
 IF NEW.stock_quantity>free_quantity THEN RAISE EXCEPTION 'RESERVATION_INSUFFICIENT_AVAILABLE'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER material_uom_reservation_pin_guard BEFORE INSERT OR UPDATE OR DELETE ON material_uom_reservation_pins
 FOR EACH ROW EXECUTE FUNCTION erp_material_uom_reservation_pin_guard();

-- Until issue integration is complete, no legacy issue may consume a pinned
-- reservation, including a direct status write. Release/cancel are supported.
CREATE FUNCTION erp_material_uom_reservation_fulfillment_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.status='FULFILLED' AND OLD.status IS DISTINCT FROM NEW.status
 AND EXISTS(SELECT 1 FROM material_uom_reservation_pins WHERE reservation_id=OLD.id)
 THEN RAISE EXCEPTION 'MATERIAL_UOM_ISSUE_POSTING_NOT_READY'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER material_uom_reservation_fulfillment_guard BEFORE UPDATE ON material_reservations
 FOR EACH ROW EXECUTE FUNCTION erp_material_uom_reservation_fulfillment_guard();
