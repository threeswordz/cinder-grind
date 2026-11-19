-- DEC-050 B: additive stock-effect provenance. No stock rewrite or automatic activation.
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
        frozen_sign integer;
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
 -- Fresh effects are bound to their original source, never caller-created rates.
 IF ledger.movement_type='GOODS_RECEIPT' THEN
   SELECT * INTO frozen FROM material_uom_receipt_source_pins WHERE receipt_item_id=ledger.goods_receipt_item_id;
   frozen_sign:=1;
 ELSIF ledger.movement_type='MATERIAL_ISSUE' THEN
   SELECT * INTO frozen FROM erp_material_uom_issue_effect(ledger.material_issue_item_id);
   frozen_sign:=-1;
 ELSIF ledger.movement_type='MATERIAL_RETURN' THEN
   SELECT * INTO frozen FROM erp_material_uom_return_effect(ledger.material_return_item_id);
   frozen_sign:=1;
 ELSIF ledger.movement_type IN ('STOCK_TRANSFER_OUT','STOCK_TRANSFER_IN') THEN
   SELECT * INTO frozen FROM erp_material_uom_transfer_effect(ledger.stock_transfer_item_id,ledger.transfer_receipt_line_id);
   frozen_sign:=CASE WHEN ledger.movement_type='STOCK_TRANSFER_OUT' THEN -1 ELSE 1 END;
 ELSE RAISE EXCEPTION 'MATERIAL_UOM_FRESH_SOURCE_REQUIRED'; END IF;
 IF NOT FOUND OR (NEW.company_id,NEW.material_id,NEW.source_uom_id,NEW.source_quantity,
      NEW.stock_uom_id,NEW.stock_quantity,NEW.business_date,NEW.basis_version,NEW.revision_id,NEW.numerator,NEW.denominator,NEW.effect_sign)
   IS DISTINCT FROM (frozen.company_id,frozen.material_id,frozen.source_uom_id,frozen.source_quantity,
      frozen.stock_uom_id,frozen.stock_quantity,frozen.business_date,frozen.basis_version,frozen.revision_id,frozen.numerator,frozen.denominator,frozen_sign)
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
        reserved record; free_quantity numeric;
        returned_pin material_uom_effect_pins%ROWTYPE; prior_returned numeric;
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
    SELECT h.company_id,h.warehouse_id,h.project_id,h.posted_at,h.reversed_at,
      i.material_id,i.uom_id,i.quantity AS item_quantity,i.wbs_id,i.cost_code_id,i.activity_id,i.reservation_id
    INTO source FROM material_issues h JOIN material_issue_items i ON i.material_issue_id=h.id
    WHERE h.id=NEW.material_issue_id AND i.id=NEW.material_issue_item_id;
    IF NOT FOUND OR source.posted_at IS NULL OR NEW.company_id IS DISTINCT FROM source.company_id
      OR NEW.warehouse_id IS DISTINCT FROM source.warehouse_id OR NEW.project_id IS DISTINCT FROM source.project_id
      OR NEW.material_id IS DISTINCT FROM source.material_id
      OR NEW.wbs_id IS DISTINCT FROM source.wbs_id OR NEW.cost_code_id IS DISTINCT FROM source.cost_code_id
      OR NEW.activity_id IS DISTINCT FROM source.activity_id
    THEN RAISE EXCEPTION 'Issue Stock movement source dimensions mismatch'; END IF;
    SELECT * INTO reserved FROM erp_material_uom_issue_effect(NEW.material_issue_item_id);
    IF reserved.issue_item_id IS NOT NULL THEN
      IF (reserved.company_id,reserved.project_id,reserved.warehouse_id,reserved.material_id,
          reserved.source_uom_id,reserved.source_quantity,reserved.stock_uom_id)
        IS DISTINCT FROM (NEW.company_id,NEW.project_id,NEW.warehouse_id,NEW.material_id,
          source.uom_id,source.item_quantity,NEW.uom_id)
      THEN RAISE EXCEPTION 'MATERIAL_UOM_ISSUE_RESERVATION_SOURCE_MISMATCH'; END IF;
    ELSIF NEW.uom_id IS DISTINCT FROM source.uom_id THEN
      RAISE EXCEPTION 'Issue Stock movement source dimensions mismatch';
    END IF;
    IF NEW.movement_type='MATERIAL_ISSUE' THEN
      IF source.reversed_at IS NOT NULL OR NEW.quantity<>-COALESCE(reserved.stock_quantity,source.item_quantity)
      THEN RAISE EXCEPTION 'Issue movement quantity/state mismatch'; END IF;
      IF reserved.issue_item_id IS NOT NULL THEN
        IF reserved.reservation_id IS NULL THEN PERFORM erp_material_uom_assert_issue_pin_current(NEW.material_issue_item_id); END IF;
        IF EXISTS(SELECT 1 FROM material_plan_issue_bindings WHERE issue_id=NEW.material_issue_id)
        THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_ISSUE_NOT_READY'; END IF;
        PERFORM pg_advisory_xact_lock(hashtext('inventory-stock:'||NEW.company_id::text||':'||NEW.warehouse_id::text||':'||NEW.material_id::text||':'||NEW.project_id::text||':'||NEW.uom_id::text));
        IF reserved.reservation_id IS NOT NULL THEN PERFORM pg_advisory_xact_lock(hashtext('inventory-reservation:'||reserved.reservation_id::text)); END IF;
        IF (reserved.reservation_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM material_reservations WHERE id=reserved.reservation_id AND status='ACTIVE'))
        OR NOT EXISTS(SELECT 1 FROM material_issues h JOIN approval_instances a ON a.id=h.approval_instance_id
          WHERE h.id=NEW.material_issue_id AND a.approval_state='APPROVED' AND h.posted_by_user_id=NEW.posted_by_user_id
            AND NEW.effect_key='material-issue:'||NEW.material_issue_item_id::text AND h.xmin=pg_current_xact_id()::xid)
        THEN RAISE EXCEPTION 'MATERIAL_UOM_ISSUE_APPROVED_POST_REQUIRED'; END IF;
        SELECT COALESCE((SELECT SUM(t.quantity) FROM stock_transactions t WHERE t.company_id=NEW.company_id
          AND t.project_id=NEW.project_id AND t.warehouse_id=NEW.warehouse_id AND t.material_id=NEW.material_id AND t.uom_id=NEW.uom_id),0)
          -COALESCE((SELECT SUM(COALESCE(p.stock_quantity,a.quantity)) FROM material_reservations a
           LEFT JOIN material_uom_reservation_pins p ON p.reservation_id=a.id WHERE a.company_id=NEW.company_id
           AND a.project_id=NEW.project_id AND a.warehouse_id=NEW.warehouse_id AND a.material_id=NEW.material_id
           AND COALESCE(p.stock_uom_id,a.uom_id)=NEW.uom_id AND a.status='ACTIVE' AND (reserved.reservation_id IS NULL OR a.id<>reserved.reservation_id)),0)
          INTO free_quantity;
        IF reserved.stock_quantity>free_quantity THEN RAISE EXCEPTION 'MATERIAL_ISSUE_INSUFFICIENT_AVAILABLE'; END IF;
      END IF;
    ELSIF NEW.movement_type='MATERIAL_ISSUE_REVERSAL' THEN
      SELECT * INTO original FROM stock_transactions WHERE id=NEW.reversal_of_id;
      IF NOT FOUND OR source.reversed_at IS NULL OR original.movement_type<>'MATERIAL_ISSUE'
        OR original.material_issue_item_id<>NEW.material_issue_item_id OR original.quantity<>-NEW.quantity
        OR original.uom_id IS DISTINCT FROM NEW.uom_id
      THEN RAISE EXCEPTION 'Issue reversal must exactly negate source'; END IF;
      IF reserved.issue_item_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM material_uom_effect_pins WHERE stock_transaction_id=original.id)
      THEN RAISE EXCEPTION 'MATERIAL_UOM_ORIGINAL_REVERSAL_PIN_REQUIRED'; END IF;
    ELSE RAISE EXCEPTION 'Issue source cannot use this movement type'; END IF;
  ELSIF NEW.material_return_item_id IS NOT NULL THEN
    SELECT h.company_id,h.warehouse_id,h.project_id,h.posted_at,h.reversed_at,
      i.material_id,i.uom_id,i.quantity AS item_quantity,i.material_issue_item_id,
      src.wbs_id,src.cost_code_id,src.activity_id,src.quantity AS issued_quantity
    INTO source
    FROM material_returns h
    JOIN material_return_items i ON i.material_return_id=h.id
    JOIN material_issue_items src ON src.id=i.material_issue_item_id
    WHERE h.id=NEW.material_return_id AND i.id=NEW.material_return_item_id;
    IF NOT FOUND OR source.posted_at IS NULL OR NEW.company_id IS DISTINCT FROM source.company_id
      OR NEW.warehouse_id IS DISTINCT FROM source.warehouse_id OR NEW.project_id IS DISTINCT FROM source.project_id
      OR NEW.material_id IS DISTINCT FROM source.material_id
      OR NEW.wbs_id IS DISTINCT FROM source.wbs_id OR NEW.cost_code_id IS DISTINCT FROM source.cost_code_id
      OR NEW.activity_id IS DISTINCT FROM source.activity_id
    THEN RAISE EXCEPTION 'Return Stock movement source dimensions mismatch'; END IF;
    SELECT * INTO returned_pin FROM erp_material_uom_return_effect(NEW.material_return_item_id);
    IF returned_pin.stock_transaction_id IS NOT NULL THEN
      IF NEW.uom_id IS DISTINCT FROM returned_pin.stock_uom_id
      THEN RAISE EXCEPTION 'MATERIAL_UOM_RETURN_SOURCE_MISMATCH'; END IF;
    ELSIF NEW.uom_id IS DISTINCT FROM source.uom_id THEN
      RAISE EXCEPTION 'Return Stock movement source dimensions mismatch';
    END IF;
    IF NEW.movement_type='MATERIAL_RETURN' THEN
      IF source.reversed_at IS NOT NULL OR NEW.quantity<>COALESCE(returned_pin.stock_quantity,source.item_quantity)
      THEN RAISE EXCEPTION 'Return movement quantity/state mismatch'; END IF;
      IF returned_pin.stock_transaction_id IS NOT NULL THEN
        PERFORM pg_advisory_xact_lock(hashtext('inventory-return-source:'||source.material_issue_item_id::text));
        PERFORM pg_advisory_xact_lock(hashtext('inventory-stock:'||NEW.company_id::text||':'||NEW.warehouse_id::text||':'||NEW.material_id::text||':'||NEW.project_id::text||':'||NEW.uom_id::text));
        IF NOT EXISTS(SELECT 1 FROM material_issue_items i JOIN material_issues h ON h.id=i.material_issue_id
            WHERE i.id=source.material_issue_item_id AND h.posted_at IS NOT NULL AND h.reversed_at IS NULL
             AND h.company_id=NEW.company_id AND h.project_id=NEW.project_id)
          OR NOT EXISTS(SELECT 1 FROM material_returns h JOIN approval_instances a ON a.id=h.approval_instance_id
            WHERE h.id=NEW.material_return_id AND a.approval_state='APPROVED'
              AND h.posted_by_user_id=NEW.posted_by_user_id AND NEW.effect_key='material-return:'||NEW.material_return_item_id::text
              AND h.xmin=pg_current_xact_id()::xid)
        THEN RAISE EXCEPTION 'MATERIAL_UOM_RETURN_APPROVED_POST_REQUIRED'; END IF;
        SELECT COALESCE(SUM(i.quantity),0) INTO prior_returned FROM material_return_items i
          JOIN material_returns h ON h.id=i.material_return_id
          WHERE i.material_issue_item_id=source.material_issue_item_id AND i.id<>NEW.material_return_item_id
            AND h.posted_at IS NOT NULL AND h.reversed_at IS NULL;
        IF prior_returned+source.item_quantity>source.issued_quantity
        THEN RAISE EXCEPTION 'MATERIAL_RETURN_EXCEEDS_ISSUED'; END IF;
      END IF;
    ELSIF NEW.movement_type='MATERIAL_RETURN_REVERSAL' THEN
      SELECT * INTO original FROM stock_transactions WHERE id=NEW.reversal_of_id;
      IF NOT FOUND OR source.reversed_at IS NULL OR original.movement_type<>'MATERIAL_RETURN'
        OR original.material_return_item_id<>NEW.material_return_item_id OR original.quantity<>-NEW.quantity
        OR original.uom_id IS DISTINCT FROM NEW.uom_id
      THEN RAISE EXCEPTION 'Return reversal must exactly negate source'; END IF;
      IF returned_pin.stock_transaction_id IS NOT NULL THEN
        IF NOT EXISTS(SELECT 1 FROM material_uom_effect_pins WHERE stock_transaction_id=original.id)
        THEN RAISE EXCEPTION 'MATERIAL_UOM_ORIGINAL_REVERSAL_PIN_REQUIRED'; END IF;
        PERFORM pg_advisory_xact_lock(hashtext('inventory-return-source:'||source.material_issue_item_id::text));
        PERFORM pg_advisory_xact_lock(hashtext('inventory-stock:'||NEW.company_id::text||':'||NEW.warehouse_id::text||':'||NEW.material_id::text||':'||NEW.project_id::text||':'||NEW.uom_id::text));
        SELECT COALESCE((SELECT SUM(t.quantity) FROM stock_transactions t WHERE t.company_id=NEW.company_id
          AND t.project_id=NEW.project_id AND t.warehouse_id=NEW.warehouse_id AND t.material_id=NEW.material_id AND t.uom_id=NEW.uom_id),0)
          -COALESCE((SELECT SUM(COALESCE(p.stock_quantity,a.quantity)) FROM material_reservations a
           LEFT JOIN material_uom_reservation_pins p ON p.reservation_id=a.id WHERE a.company_id=NEW.company_id
           AND a.project_id=NEW.project_id AND a.warehouse_id=NEW.warehouse_id AND a.material_id=NEW.material_id
           AND COALESCE(p.stock_uom_id,a.uom_id)=NEW.uom_id AND a.status='ACTIVE'),0) INTO free_quantity;
        IF -NEW.quantity>free_quantity THEN RAISE EXCEPTION 'MATERIAL_RETURN_REVERSAL_INSUFFICIENT_AVAILABLE'; END IF;
      END IF;
    ELSE RAISE EXCEPTION 'Return source cannot use this movement type'; END IF;
  ELSIF NEW.stock_transfer_item_id IS NOT NULL THEN
    IF NEW.movement_type IN ('STOCK_TRANSFER_OUT','STOCK_TRANSFER_IN') AND EXISTS(
      SELECT 1 FROM erp_material_uom_tracked_stock_basis(NEW.company_id,NEW.material_id) b
      WHERE b.stock_uom_id<>NEW.uom_id OR mod(NEW.quantity*power(10::numeric,b.stock_precision),1)<>0)
    THEN RAISE EXCEPTION 'MATERIAL_UOM_CANONICAL_STOCK_UNIT_REQUIRED'; END IF;
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
    IF EXISTS(SELECT 1 FROM erp_material_uom_tracked_stock_basis(NEW.company_id,NEW.material_id) b WHERE b.stock_uom_id<>NEW.uom_id OR mod(NEW.quantity*power(10::numeric,b.stock_precision),1)<>0)
    THEN RAISE EXCEPTION 'MATERIAL_UOM_CANONICAL_STOCK_UNIT_REQUIRED'; END IF;
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

-- A converted reservation may only be fulfilled by its exact same-transaction
-- approved issue effect. Direct status changes without a ledger effect fail.
CREATE FUNCTION erp_material_uom_reservation_fulfillment_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p material_uom_reservation_pins%ROWTYPE;
BEGIN
 SELECT * INTO p FROM material_uom_reservation_pins WHERE reservation_id=OLD.id;
 IF FOUND AND OLD.status IS DISTINCT FROM NEW.status THEN
   PERFORM pg_advisory_xact_lock(hashtext('inventory-stock:'||p.company_id::text||':'||p.warehouse_id::text||':'||p.material_id::text||':'||p.project_id::text||':'||p.stock_uom_id::text));
   PERFORM pg_advisory_xact_lock(hashtext('inventory-reservation:'||p.reservation_id::text));
   IF OLD.status<>'ACTIVE' OR NEW.status NOT IN ('FULFILLED','RELEASED','CANCELLED')
   THEN RAISE EXCEPTION 'MATERIAL_UOM_RESERVATION_STATE_IMMUTABLE'; END IF;
 END IF;
 IF NEW.status='FULFILLED' AND OLD.status IS DISTINCT FROM NEW.status
 AND p.reservation_id IS NOT NULL
 AND NOT EXISTS(SELECT 1 FROM material_issue_items i JOIN material_issues h ON h.id=i.material_issue_id
   JOIN stock_transactions st ON st.material_issue_item_id=i.id AND st.movement_type='MATERIAL_ISSUE'
   JOIN material_uom_effect_pins e ON e.stock_transaction_id=st.id
   JOIN material_uom_reservation_pins rp ON rp.reservation_id=i.reservation_id
   WHERE i.reservation_id=OLD.id AND e.stock_quantity=rp.stock_quantity AND e.revision_id IS NOT DISTINCT FROM rp.revision_id
   AND h.posted_by_user_id=NEW.fulfilled_by_user_id AND st.xmin=pg_current_xact_id()::xid)
 THEN RAISE EXCEPTION 'MATERIAL_UOM_ISSUE_FULFILLMENT_PROOF_REQUIRED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER material_uom_reservation_fulfillment_guard BEFORE UPDATE ON material_reservations
 FOR EACH ROW EXECUTE FUNCTION erp_material_uom_reservation_fulfillment_guard();

-- Canonical negative issue effects inherit the active reservation's immutable
-- conversion, including its original effective business date. The issue's own
-- business date remains unchanged on its submitted source header.
CREATE FUNCTION erp_material_uom_copy_issue_pin() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 INSERT INTO material_uom_effect_pins(stock_transaction_id,company_id,material_id,
 source_uom_id,source_quantity,stock_uom_id,stock_quantity,effect_sign,business_date,basis_version,
 revision_id,numerator,denominator)
 SELECT NEW.id,p.company_id,p.material_id,p.source_uom_id,p.source_quantity,p.stock_uom_id,
 p.stock_quantity,-1,p.business_date,p.basis_version,p.revision_id,p.numerator,p.denominator
 FROM erp_material_uom_issue_effect(NEW.material_issue_item_id) p;
 RETURN NEW;
END $$;
CREATE TRIGGER material_uom_copy_issue_pin AFTER INSERT ON stock_transactions
 FOR EACH ROW WHEN (NEW.movement_type='MATERIAL_ISSUE' AND NEW.material_issue_item_id IS NOT NULL)
 EXECUTE FUNCTION erp_material_uom_copy_issue_pin();

CREATE FUNCTION erp_material_uom_issue_post_proof() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM material_issues h WHERE h.id=NEW.id AND h.posted_at IS NOT NULL)
 AND EXISTS(SELECT 1 FROM material_issue_items i CROSS JOIN LATERAL erp_material_uom_issue_effect(i.id) p
   WHERE i.material_issue_id=NEW.id AND NOT EXISTS(
     SELECT 1 FROM stock_transactions st JOIN material_uom_effect_pins e ON e.stock_transaction_id=st.id
       LEFT JOIN material_reservations r ON r.id=p.reservation_id
     WHERE st.material_issue_item_id=i.id AND st.movement_type='MATERIAL_ISSUE'
       AND (p.reservation_id IS NULL OR r.status='FULFILLED') AND st.quantity=-p.stock_quantity AND e.effect_sign=-1 AND e.revision_id IS NOT DISTINCT FROM p.revision_id))
 THEN RAISE EXCEPTION 'MATERIAL_UOM_ISSUE_POST_PROOF_REQUIRED'; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER material_uom_issue_post_proof AFTER UPDATE ON material_issues
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_material_uom_issue_post_proof();

-- Derive partial returns from the original issue's immutable conversion,
-- including its definition date and precision. No current-rate lookup.
CREATE FUNCTION erp_material_uom_return_effect(return_item uuid) RETURNS material_uom_effect_pins LANGUAGE plpgsql AS $$
DECLARE p material_uom_effect_pins%ROWTYPE; item material_return_items%ROWTYPE;
 b material_uom_bases%ROWTYPE; rev material_uom_revisions%ROWTYPE; source_precision integer; stock numeric;
BEGIN
 SELECT * INTO STRICT item FROM material_return_items WHERE id=return_item;
 SELECT e.* INTO p FROM stock_transactions t JOIN material_uom_effect_pins e ON e.stock_transaction_id=t.id
 WHERE t.material_issue_item_id=item.material_issue_item_id AND t.movement_type='MATERIAL_ISSUE';
 IF NOT FOUND THEN RETURN NULL; END IF;
 SELECT * INTO STRICT b FROM material_uom_bases WHERE material_id=p.material_id AND company_id=p.company_id;
 IF p.revision_id IS NULL THEN source_precision:=b.stock_precision;
 ELSE
   SELECT * INTO STRICT rev FROM material_uom_revisions WHERE id=p.revision_id;
   source_precision:=rev.source_precision;
 END IF;
 stock:=item.quantity*p.numerator::numeric/p.denominator::numeric;
 IF p.effect_sign<>-1 OR item.material_id<>p.material_id OR item.uom_id<>p.source_uom_id
 OR item.quantity<=0 OR item.quantity>p.source_quantity OR stock<=0 OR stock>p.stock_quantity
 OR stock*p.denominator::numeric<>item.quantity*p.numerator::numeric
 OR mod(item.quantity*power(10::numeric,source_precision),1)<>0
 OR mod(stock*power(10::numeric,b.stock_precision),1)<>0
 THEN RAISE EXCEPTION 'MATERIAL_UOM_RETURN_ORIGINAL_PRECISION_OR_QUANTITY'; END IF;
 p.source_quantity:=item.quantity; p.stock_quantity:=stock; p.effect_sign:=1;
 RETURN p;
END $$;

CREATE FUNCTION erp_material_uom_copy_return_pin() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p material_uom_effect_pins%ROWTYPE;
BEGIN
 SELECT * INTO p FROM erp_material_uom_return_effect(NEW.material_return_item_id);
 IF p.stock_transaction_id IS NOT NULL THEN
  INSERT INTO material_uom_effect_pins(stock_transaction_id,company_id,material_id,
   source_uom_id,source_quantity,stock_uom_id,stock_quantity,effect_sign,business_date,basis_version,
   revision_id,numerator,denominator)
  VALUES(NEW.id,p.company_id,p.material_id,p.source_uom_id,p.source_quantity,p.stock_uom_id,p.stock_quantity,1,
    p.business_date,p.basis_version,p.revision_id,p.numerator,p.denominator);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER material_uom_copy_return_pin AFTER INSERT ON stock_transactions
 FOR EACH ROW WHEN (NEW.movement_type='MATERIAL_RETURN' AND NEW.material_return_item_id IS NOT NULL)
 EXECUTE FUNCTION erp_material_uom_copy_return_pin();

CREATE FUNCTION erp_material_uom_return_post_proof() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM material_returns h WHERE h.id=NEW.id AND h.posted_at IS NOT NULL)
 AND EXISTS(SELECT 1 FROM material_return_items i
 JOIN stock_transactions st ON st.material_issue_item_id=i.material_issue_item_id AND st.movement_type='MATERIAL_ISSUE'
 JOIN material_uom_effect_pins p ON p.stock_transaction_id=st.id
 WHERE i.material_return_id=NEW.id AND NOT EXISTS(
  SELECT 1 FROM stock_transactions rt JOIN material_uom_effect_pins e ON e.stock_transaction_id=rt.id
  WHERE rt.material_return_item_id=i.id AND rt.movement_type='MATERIAL_RETURN' AND e.effect_sign=1
    AND e.source_quantity=i.quantity AND e.revision_id IS NOT DISTINCT FROM p.revision_id))
 THEN RAISE EXCEPTION 'MATERIAL_UOM_RETURN_POST_PROOF_REQUIRED'; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER material_uom_return_post_proof AFTER UPDATE ON material_returns
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_material_uom_return_post_proof();

-- Unreserved issue freezes use the explicitly submitted issue date.
CREATE TABLE material_uom_issue_source_pins (
  issue_item_id uuid PRIMARY KEY REFERENCES material_issue_items(id) ON DELETE RESTRICT,
  company_id uuid NOT NULL,
  project_id uuid NOT NULL,
  warehouse_id uuid NOT NULL,
  issue_id uuid NOT NULL REFERENCES material_issues(id) ON DELETE RESTRICT,
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
  CONSTRAINT material_uom_issue_source_basis_fk FOREIGN KEY(company_id,material_id)
    REFERENCES material_uom_bases(company_id,material_id) ON DELETE RESTRICT,
  CONSTRAINT material_uom_issue_source_shape CHECK (
    source_quantity>0 AND stock_quantity>0 AND basis_version>=1
    AND business_date BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'
    AND numerator ~ '^[1-9][0-9]{0,37}$' AND denominator ~ '^[1-9][0-9]{0,37}$'
  )
);
CREATE INDEX material_uom_issue_source_pins_issue_id_idx ON material_uom_issue_source_pins(issue_id);

CREATE FUNCTION erp_material_uom_issue_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE header material_issues%ROWTYPE;
        item material_issue_items%ROWTYPE;
        basis material_uom_bases%ROWTYPE;
        source_unit units_of_measure%ROWTYPE;
        stock_unit units_of_measure%ROWTYPE;
        selected_revision material_uom_revisions%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'MATERIAL_UOM_ISSUE_SOURCE_IMMUTABLE'; END IF;
 SELECT * INTO header FROM material_issues WHERE id=NEW.issue_id FOR UPDATE;
 IF NOT FOUND OR header.company_id IS DISTINCT FROM NEW.company_id
   OR header.project_id IS DISTINCT FROM NEW.project_id
   OR header.warehouse_id IS DISTINCT FROM NEW.warehouse_id OR header.issue_date IS DISTINCT FROM NEW.business_date
   OR EXISTS(SELECT 1 FROM material_plan_issue_bindings WHERE issue_id=NEW.issue_id)
   OR header.submitted_at IS NULL OR header.approval_instance_id IS NULL
   OR header.posted_at IS NOT NULL OR header.reversed_at IS NOT NULL
   OR NOT EXISTS(SELECT 1 FROM material_issues WHERE id=NEW.issue_id AND xmin=pg_current_xact_id()::xid)
 THEN RAISE EXCEPTION 'MATERIAL_UOM_ISSUE_SUBMISSION_REQUIRED'; END IF;
 SELECT * INTO item FROM material_issue_items WHERE id=NEW.issue_item_id AND material_issue_id=NEW.issue_id FOR UPDATE;
 IF NOT FOUND OR item.reservation_id IS NOT NULL OR item.material_id IS DISTINCT FROM NEW.material_id OR item.uom_id IS DISTINCT FROM NEW.source_uom_id
   OR item.quantity IS DISTINCT FROM NEW.source_quantity
 THEN RAISE EXCEPTION 'MATERIAL_UOM_ISSUE_SOURCE_MISMATCH'; END IF;
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
 THEN RAISE EXCEPTION 'MATERIAL_UOM_ISSUE_SOURCE_INVALID'; END IF;
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
CREATE TRIGGER material_uom_issue_source_guard
 BEFORE INSERT OR UPDATE OR DELETE ON material_uom_issue_source_pins
 FOR EACH ROW EXECUTE FUNCTION erp_material_uom_issue_source_guard();

CREATE FUNCTION erp_material_uom_issue_source_drift_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM material_uom_issue_source_pins WHERE issue_item_id=OLD.id)
 THEN RAISE EXCEPTION 'MATERIAL_UOM_ISSUE_SOURCE_IMMUTABLE'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER material_uom_issue_source_drift_guard BEFORE UPDATE OR DELETE ON material_issue_items
 FOR EACH ROW EXECUTE FUNCTION erp_material_uom_issue_source_drift_guard();

-- Frozen issue source is authoritative; a superseded effective revision invalidates
-- an unposted approval instead of changing its quantity. Future-only revisions
-- cannot alter the selected effective revision.
CREATE FUNCTION erp_material_uom_assert_issue_pin_current(item_id uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE p material_uom_issue_source_pins%ROWTYPE; current_revision uuid;
BEGIN
 SELECT * INTO STRICT p FROM material_uom_issue_source_pins WHERE issue_item_id=item_id;
 PERFORM pg_advisory_xact_lock(hashtextextended('material-uom:'||p.company_id::text||':'||p.material_id::text,0));
 IF NOT EXISTS(SELECT 1 FROM material_uom_bases b JOIN materials m ON m.id=b.material_id
    JOIN units_of_measure su ON su.id=p.source_uom_id JOIN units_of_measure cu ON cu.id=p.stock_uom_id
    WHERE b.company_id=p.company_id AND b.material_id=p.material_id AND b.stock_uom_id=p.stock_uom_id
      AND m.company_id=p.company_id AND m.is_active AND su.company_id=p.company_id AND su.is_active
      AND cu.company_id=p.company_id AND cu.is_active AND cu.decimal_places=b.stock_precision)
 THEN RAISE EXCEPTION 'MATERIAL_UOM_ISSUE_DEFINITION_CHANGED'; END IF;
 IF p.source_uom_id<>p.stock_uom_id THEN
   SELECT id INTO current_revision FROM material_uom_revisions
     WHERE company_id=p.company_id AND material_id=p.material_id AND source_uom_id=p.source_uom_id
       AND effective_from<=p.business_date ORDER BY effective_from DESC,revision_no DESC LIMIT 1;
   IF current_revision IS DISTINCT FROM p.revision_id
   THEN RAISE EXCEPTION 'MATERIAL_UOM_ISSUE_DEFINITION_CHANGED'; END IF;
 END IF;
END $$;


CREATE FUNCTION erp_material_uom_issue_effect(item_uuid uuid) RETURNS TABLE (
 reservation_id uuid, issue_item_id uuid, company_id uuid, project_id uuid, warehouse_id uuid,
 material_id uuid, source_uom_id uuid, source_quantity numeric, stock_uom_id uuid, stock_quantity numeric,
 business_date date, basis_version integer, revision_id uuid, numerator varchar, denominator varchar
) LANGUAGE sql STABLE AS $$
 SELECT p.reservation_id,i.id,p.company_id,p.project_id,p.warehouse_id,p.material_id,p.source_uom_id,
 p.source_quantity,p.stock_uom_id,p.stock_quantity,p.business_date,p.basis_version,p.revision_id,p.numerator,p.denominator
 FROM material_issue_items i JOIN material_uom_reservation_pins p ON p.reservation_id=i.reservation_id WHERE i.id=item_uuid
 UNION ALL
 SELECT NULL::uuid,p.issue_item_id,p.company_id,p.project_id,p.warehouse_id,p.material_id,p.source_uom_id,
 p.source_quantity,p.stock_uom_id,p.stock_quantity,p.business_date,p.basis_version,p.revision_id,p.numerator,p.denominator
 FROM material_uom_issue_source_pins p WHERE p.issue_item_id=item_uuid
$$;

-- Restrictive guard for materials with existing immutable conversion provenance.
-- This is not activation: merely preparing a definition does not affect legacy
-- choices or authorize a converted transaction. Explicit activation is separate.
CREATE FUNCTION erp_material_uom_stock_count_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE basis record; current_stock numeric; current_reserved numeric; ledger_events integer;
BEGIN
 -- Rejection is not a stock effect and must remain possible for stale drafts.
 IF NEW.status='REJECTED' THEN RETURN NEW; END IF;
 PERFORM pg_advisory_xact_lock(hashtextextended('material-uom:'||NEW.company_id::text||':'||NEW.material_id::text,0));
 SELECT * INTO basis FROM erp_material_uom_tracked_stock_basis(NEW.company_id,NEW.material_id);
 IF FOUND AND (NEW.uom_id<>basis.stock_uom_id OR mod(NEW.actual_quantity*power(10::numeric,basis.stock_precision),1)<>0
   OR mod(NEW.expected_on_hand*power(10::numeric,basis.stock_precision),1)<>0
   OR mod(NEW.expected_reserved*power(10::numeric,basis.stock_precision),1)<>0)
 THEN RAISE EXCEPTION 'MATERIAL_UOM_CANONICAL_STOCK_UNIT_REQUIRED'; END IF;
 IF basis.stock_uom_id IS NOT NULL AND (TG_OP='INSERT' OR OLD.status IS DISTINCT FROM NEW.status AND NEW.status IN ('SUBMITTED','APPROVED')) THEN
  PERFORM pg_advisory_xact_lock(hashtext('inventory-stock:'||NEW.company_id::text||':'||NEW.warehouse_id::text||':'||NEW.material_id::text||':'||NEW.project_id::text||':'||NEW.uom_id::text));
  SELECT COALESCE(SUM(t.quantity),0),count(*) INTO current_stock,ledger_events FROM stock_transactions t WHERE t.company_id=NEW.company_id AND t.warehouse_id=NEW.warehouse_id AND t.material_id=NEW.material_id AND t.project_id=NEW.project_id AND t.uom_id=NEW.uom_id;
  SELECT COALESCE(SUM(COALESCE(p.stock_quantity,r.quantity)),0) INTO current_reserved FROM material_reservations r LEFT JOIN material_uom_reservation_pins p ON p.reservation_id=r.id WHERE r.company_id=NEW.company_id AND r.warehouse_id=NEW.warehouse_id AND r.material_id=NEW.material_id AND r.project_id=NEW.project_id AND COALESCE(p.stock_uom_id,r.uom_id)=NEW.uom_id AND r.status='ACTIVE';
  IF (NEW.expected_on_hand,NEW.expected_reserved,NEW.expected_ledger_event_count) IS DISTINCT FROM (current_stock,current_reserved,ledger_events)
  THEN RAISE EXCEPTION 'STOCK_COUNT_SNAPSHOT_STALE'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER material_uom_stock_count_guard BEFORE INSERT OR UPDATE ON stock_counts
 FOR EACH ROW EXECUTE FUNCTION erp_material_uom_stock_count_guard();

-- Mixed-unit transfers are controlled custody only. Freeze every source line at submission.
CREATE TABLE material_uom_transfer_source_pins (
  transfer_item_id uuid PRIMARY KEY REFERENCES stock_transfer_items(id) ON DELETE RESTRICT,
  company_id uuid NOT NULL,
  source_project_id uuid NOT NULL,
  destination_project_id uuid NOT NULL,
  source_warehouse_id uuid NOT NULL,
  destination_warehouse_id uuid NOT NULL,
  transfer_id uuid NOT NULL REFERENCES stock_transfers(id) ON DELETE RESTRICT,
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
  CONSTRAINT material_uom_transfer_source_basis_fk FOREIGN KEY(company_id,material_id)
    REFERENCES material_uom_bases(company_id,material_id) ON DELETE RESTRICT,
  CONSTRAINT material_uom_transfer_source_shape CHECK (
    source_quantity>0 AND stock_quantity>0 AND basis_version>=1
    AND business_date BETWEEN DATE '0001-01-01' AND DATE '9999-12-31'
    AND numerator ~ '^[1-9][0-9]{0,37}$' AND denominator ~ '^[1-9][0-9]{0,37}$'
  )
);
CREATE INDEX material_uom_transfer_source_pins_transfer_id_idx ON material_uom_transfer_source_pins(transfer_id);

CREATE FUNCTION erp_material_uom_transfer_source_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE header stock_transfers%ROWTYPE;
        item stock_transfer_items%ROWTYPE;
        basis material_uom_bases%ROWTYPE;
        source_unit units_of_measure%ROWTYPE;
        stock_unit units_of_measure%ROWTYPE;
        selected_revision material_uom_revisions%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'MATERIAL_UOM_TRANSFER_SOURCE_IMMUTABLE'; END IF;
 SELECT * INTO header FROM stock_transfers WHERE id=NEW.transfer_id FOR UPDATE;
 IF NOT FOUND OR header.company_id IS DISTINCT FROM NEW.company_id
   OR header.source_warehouse_id IS DISTINCT FROM NEW.source_warehouse_id
   OR header.destination_warehouse_id IS DISTINCT FROM NEW.destination_warehouse_id OR header.transfer_date IS DISTINCT FROM NEW.business_date
   OR NOT EXISTS(SELECT 1 FROM transfer_custodies WHERE transfer_id=NEW.transfer_id AND company_id=NEW.company_id)
   OR header.submitted_at IS NULL OR header.approval_instance_id IS NULL
   OR header.posted_at IS NOT NULL OR header.reversed_at IS NOT NULL
   OR NOT EXISTS(SELECT 1 FROM stock_transfers WHERE id=NEW.transfer_id AND xmin=pg_current_xact_id()::xid)
 THEN RAISE EXCEPTION 'MATERIAL_UOM_TRANSFER_SUBMISSION_REQUIRED'; END IF;
 SELECT * INTO item FROM stock_transfer_items WHERE id=NEW.transfer_item_id AND stock_transfer_id=NEW.transfer_id FOR UPDATE;
 IF NOT FOUND OR item.source_project_id IS DISTINCT FROM NEW.source_project_id OR item.destination_project_id IS DISTINCT FROM NEW.destination_project_id OR item.material_id IS DISTINCT FROM NEW.material_id OR item.uom_id IS DISTINCT FROM NEW.source_uom_id
   OR item.quantity IS DISTINCT FROM NEW.source_quantity
 THEN RAISE EXCEPTION 'MATERIAL_UOM_TRANSFER_SOURCE_MISMATCH'; END IF;
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
 THEN RAISE EXCEPTION 'MATERIAL_UOM_TRANSFER_SOURCE_INVALID'; END IF;
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
CREATE TRIGGER material_uom_transfer_source_guard
 BEFORE INSERT OR UPDATE OR DELETE ON material_uom_transfer_source_pins
 FOR EACH ROW EXECUTE FUNCTION erp_material_uom_transfer_source_guard();

CREATE FUNCTION erp_material_uom_transfer_source_drift_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM material_uom_transfer_source_pins WHERE transfer_item_id=OLD.id)
 THEN RAISE EXCEPTION 'MATERIAL_UOM_TRANSFER_SOURCE_IMMUTABLE'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER material_uom_transfer_source_drift_guard BEFORE UPDATE OR DELETE ON stock_transfer_items
 FOR EACH ROW EXECUTE FUNCTION erp_material_uom_transfer_source_drift_guard();

-- Frozen transfer source is authoritative; a superseded effective revision invalidates
-- an unposted approval instead of changing its quantity. Future-only revisions
-- cannot alter the selected effective revision.
CREATE FUNCTION erp_material_uom_assert_transfer_pin_current(item_id uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE p material_uom_transfer_source_pins%ROWTYPE; current_revision uuid;
BEGIN
 SELECT * INTO STRICT p FROM material_uom_transfer_source_pins WHERE transfer_item_id=item_id;
 PERFORM pg_advisory_xact_lock(hashtextextended('material-uom:'||p.company_id::text||':'||p.material_id::text,0));
 IF NOT EXISTS(SELECT 1 FROM material_uom_bases b JOIN materials m ON m.id=b.material_id
    JOIN units_of_measure su ON su.id=p.source_uom_id JOIN units_of_measure cu ON cu.id=p.stock_uom_id
    WHERE b.company_id=p.company_id AND b.material_id=p.material_id AND b.stock_uom_id=p.stock_uom_id
      AND m.company_id=p.company_id AND m.is_active AND su.company_id=p.company_id AND su.is_active
      AND cu.company_id=p.company_id AND cu.is_active AND cu.decimal_places=b.stock_precision)
 THEN RAISE EXCEPTION 'MATERIAL_UOM_TRANSFER_DEFINITION_CHANGED'; END IF;
 IF p.source_uom_id<>p.stock_uom_id THEN
   SELECT id INTO current_revision FROM material_uom_revisions
     WHERE company_id=p.company_id AND material_id=p.material_id AND source_uom_id=p.source_uom_id
       AND effective_from<=p.business_date ORDER BY effective_from DESC,revision_no DESC LIMIT 1;
   IF current_revision IS DISTINCT FROM p.revision_id
   THEN RAISE EXCEPTION 'MATERIAL_UOM_TRANSFER_DEFINITION_CHANGED'; END IF;
 END IF;
END $$;



CREATE FUNCTION erp_material_uom_transfer_effect(item_uuid uuid,receipt_uuid uuid)
RETURNS material_uom_effect_pins LANGUAGE plpgsql AS $$
DECLARE p material_uom_transfer_source_pins%ROWTYPE; result material_uom_effect_pins%ROWTYPE;
 original material_uom_effect_pins%ROWTYPE; l transfer_receipt_lines%ROWTYPE; b material_uom_bases%ROWTYPE;
 rev material_uom_revisions%ROWTYPE; source_precision integer; amount numeric;
BEGIN
 SELECT * INTO p FROM material_uom_transfer_source_pins WHERE transfer_item_id=item_uuid;
 IF NOT FOUND THEN RETURN NULL; END IF;
 result.company_id:=p.company_id;result.material_id:=p.material_id;result.source_uom_id:=p.source_uom_id;
 result.stock_uom_id:=p.stock_uom_id;result.source_quantity:=p.source_quantity;result.stock_quantity:=p.stock_quantity;
 result.business_date:=p.business_date;result.basis_version:=p.basis_version;result.revision_id:=p.revision_id;
 result.numerator:=p.numerator;result.denominator:=p.denominator;result.effect_sign:=-1;
 IF receipt_uuid IS NOT NULL THEN
  SELECT * INTO STRICT l FROM transfer_receipt_lines WHERE id=receipt_uuid AND transfer_item_id=item_uuid;
  SELECT e.* INTO original FROM stock_transactions t JOIN material_uom_effect_pins e ON e.stock_transaction_id=t.id
   WHERE t.stock_transfer_item_id=item_uuid AND t.movement_type='STOCK_TRANSFER_OUT';
  IF NOT FOUND OR original.effect_sign<>-1 OR original.stock_quantity<>p.stock_quantity OR original.revision_id IS DISTINCT FROM p.revision_id
  THEN RAISE EXCEPTION 'MATERIAL_UOM_TRANSFER_DISPATCH_PIN_REQUIRED'; END IF;
  SELECT * INTO STRICT b FROM material_uom_bases WHERE company_id=p.company_id AND material_id=p.material_id;
  IF p.revision_id IS NULL THEN source_precision:=b.stock_precision;
  ELSE SELECT * INTO STRICT rev FROM material_uom_revisions WHERE id=p.revision_id;source_precision:=rev.source_precision; END IF;
  amount:=l.quantity*p.numerator::numeric/p.denominator::numeric;
  IF l.quantity<=0 OR l.quantity>p.source_quantity OR amount<=0 OR amount>p.stock_quantity
    OR amount*p.denominator::numeric<>l.quantity*p.numerator::numeric
    OR mod(l.quantity*power(10::numeric,source_precision),1)<>0 OR mod(amount*power(10::numeric,b.stock_precision),1)<>0
  THEN RAISE EXCEPTION 'MATERIAL_UOM_TRANSFER_ORIGINAL_PRECISION_OR_QUANTITY'; END IF;
  result.source_quantity:=l.quantity;result.stock_quantity:=amount;result.effect_sign:=1;
 END IF;
 RETURN result;
END $$;

CREATE FUNCTION erp_material_uom_transfer_approval_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p record;
BEGIN
 IF NEW.entity_type='STOCK_TRANSFER' AND NEW.approval_state='APPROVED' AND OLD.approval_state IS DISTINCT FROM NEW.approval_state
 AND EXISTS(SELECT 1 FROM material_uom_transfer_source_pins WHERE transfer_id=NEW.entity_id) THEN
  IF EXISTS(SELECT 1 FROM stock_transfer_items i WHERE i.stock_transfer_id=NEW.entity_id
    AND NOT EXISTS(SELECT 1 FROM material_uom_transfer_source_pins WHERE transfer_item_id=i.id))
  THEN RAISE EXCEPTION 'MATERIAL_UOM_TRANSFER_SOURCE_INCOMPLETE'; END IF;
  FOR p IN SELECT transfer_item_id FROM material_uom_transfer_source_pins WHERE transfer_id=NEW.entity_id ORDER BY material_id,transfer_item_id LOOP
   PERFORM erp_material_uom_assert_transfer_pin_current(p.transfer_item_id);
  END LOOP;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER material_uom_transfer_approval_guard BEFORE UPDATE OF approval_state ON approval_instances
 FOR EACH ROW EXECUTE FUNCTION erp_material_uom_transfer_approval_guard();

CREATE FUNCTION erp_material_uom_copy_transfer_pin() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE p material_uom_effect_pins%ROWTYPE;
BEGIN
 SELECT * INTO p FROM erp_material_uom_transfer_effect(NEW.stock_transfer_item_id,NEW.transfer_receipt_line_id);
 IF p.stock_uom_id IS NOT NULL THEN
  INSERT INTO material_uom_effect_pins(stock_transaction_id,company_id,material_id,source_uom_id,source_quantity,stock_uom_id,stock_quantity,effect_sign,business_date,basis_version,revision_id,numerator,denominator)
  VALUES(NEW.id,p.company_id,p.material_id,p.source_uom_id,p.source_quantity,p.stock_uom_id,p.stock_quantity,p.effect_sign,p.business_date,p.basis_version,p.revision_id,p.numerator,p.denominator);
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER material_uom_copy_transfer_pin AFTER INSERT ON stock_transactions
 FOR EACH ROW WHEN (NEW.movement_type IN ('STOCK_TRANSFER_OUT','STOCK_TRANSFER_IN') AND NEW.stock_transfer_item_id IS NOT NULL)
 EXECUTE FUNCTION erp_material_uom_copy_transfer_pin();

CREATE FUNCTION erp_material_uom_tracked_stock_basis(cid uuid,mid uuid)
RETURNS TABLE(stock_uom_id uuid,stock_precision integer) LANGUAGE sql STABLE AS $$
 SELECT b.stock_uom_id,b.stock_precision FROM material_uom_bases b
 WHERE b.company_id=cid AND b.material_id=mid AND (
  EXISTS(SELECT 1 FROM material_uom_effect_pins e WHERE e.company_id=cid AND e.material_id=mid)
  OR EXISTS(SELECT 1 FROM material_uom_receipt_source_pins p WHERE p.company_id=cid AND p.material_id=mid)
  OR EXISTS(SELECT 1 FROM material_uom_reservation_pins p WHERE p.company_id=cid AND p.material_id=mid)
  OR EXISTS(SELECT 1 FROM material_uom_issue_source_pins p WHERE p.company_id=cid AND p.material_id=mid)
  OR EXISTS(SELECT 1 FROM material_uom_transfer_source_pins p WHERE p.company_id=cid AND p.material_id=mid))
$$;


CREATE OR REPLACE FUNCTION erp_transfer_validate_movement(m stock_transactions) RETURNS void LANGUAGE plpgsql AS $$
DECLARE t stock_transfers; i stock_transfer_items; d transfer_dispatches; r transfer_receipts; l transfer_receipt_lines; original stock_transactions; p material_uom_effect_pins%ROWTYPE; free_quantity numeric;
BEGIN
 SELECT * INTO t FROM stock_transfers WHERE id=m.stock_transfer_id;
 SELECT * INTO i FROM stock_transfer_items WHERE id=m.stock_transfer_item_id;
 SELECT * INTO d FROM transfer_dispatches WHERE transfer_id=t.id;
 SELECT * INTO p FROM erp_material_uom_transfer_effect(i.id,m.transfer_receipt_line_id);
 IF i.stock_transfer_id IS DISTINCT FROM t.id OR m.company_id IS DISTINCT FROM t.company_id OR m.material_id IS DISTINCT FROM i.material_id OR m.uom_id IS DISTINCT FROM COALESCE(p.stock_uom_id,i.uom_id)
  OR m.wbs_id IS NOT NULL OR m.cost_code_id IS NOT NULL OR m.activity_id IS NOT NULL OR t.posted_at IS NULL OR d.id IS NULL THEN RAISE EXCEPTION 'TRANSFER_STOCK_SOURCE_INVALID'; END IF;
 IF p.stock_uom_id IS NOT NULL AND m.movement_type IN ('STOCK_TRANSFER_OUT','STOCK_TRANSFER_IN') THEN
  IF NOT EXISTS(SELECT 1 FROM approval_instances a WHERE a.id=t.approval_instance_id AND a.approval_state='APPROVED')
    OR (m.movement_type='STOCK_TRANSFER_OUT' AND NOT EXISTS(SELECT 1 FROM transfer_dispatches WHERE id=d.id AND xmin=pg_current_xact_id()::xid))
  THEN RAISE EXCEPTION 'MATERIAL_UOM_TRANSFER_APPROVED_EFFECT_REQUIRED'; END IF;
  PERFORM pg_advisory_xact_lock(hashtext('inventory-stock:'||m.company_id::text||':'||m.warehouse_id::text||':'||m.material_id::text||':'||m.project_id::text||':'||m.uom_id::text));
  IF m.movement_type='STOCK_TRANSFER_OUT' THEN
   SELECT COALESCE((SELECT SUM(st.quantity) FROM stock_transactions st WHERE st.company_id=m.company_id AND st.warehouse_id=m.warehouse_id AND st.project_id=m.project_id AND st.material_id=m.material_id AND st.uom_id=m.uom_id),0)
     - COALESCE((SELECT SUM(COALESCE(rp.stock_quantity,reserved_row.quantity)) FROM material_reservations reserved_row LEFT JOIN material_uom_reservation_pins rp ON rp.reservation_id=reserved_row.id
       WHERE reserved_row.company_id=m.company_id AND reserved_row.warehouse_id=m.warehouse_id AND reserved_row.material_id=m.material_id AND reserved_row.project_id=m.project_id AND COALESCE(rp.stock_uom_id,reserved_row.uom_id)=m.uom_id AND reserved_row.status='ACTIVE'),0) INTO free_quantity;
   IF -m.quantity>free_quantity THEN RAISE EXCEPTION 'STOCK_TRANSFER_INSUFFICIENT_AVAILABLE'; END IF;
  END IF;
 END IF;
 IF m.movement_type='STOCK_TRANSFER_OUT' THEN
  IF t.reversed_at IS NOT NULL OR m.transfer_receipt_line_id IS NOT NULL OR m.project_id IS DISTINCT FROM i.source_project_id OR m.warehouse_id<>t.source_warehouse_id OR m.quantity<>-COALESCE(p.stock_quantity,i.quantity) OR m.posted_by_user_id<>d.actor_user_id OR m.effect_key<>'stock-transfer-out:'||i.id THEN RAISE EXCEPTION 'TRANSFER_DISPATCH_EFFECT_INVALID'; END IF;
 ELSIF m.movement_type='STOCK_TRANSFER_IN' THEN
  SELECT * INTO l FROM transfer_receipt_lines WHERE id=m.transfer_receipt_line_id;
  SELECT * INTO r FROM transfer_receipts WHERE id=l.receipt_id;
  IF t.reversed_at IS NOT NULL OR l.id IS NULL OR l.transfer_item_id<>i.id OR r.transfer_id<>t.id OR r.posted_at IS NULL OR r.project_id<>i.destination_project_id
   OR m.project_id IS DISTINCT FROM i.destination_project_id OR m.warehouse_id<>t.destination_warehouse_id OR m.quantity<>COALESCE(p.stock_quantity,l.quantity) OR m.posted_by_user_id<>r.created_by_user_id OR m.effect_key<>'transfer-receipt:'||l.id THEN RAISE EXCEPTION 'TRANSFER_RECEIPT_EFFECT_INVALID'; END IF;
 ELSIF m.movement_type IN ('STOCK_TRANSFER_OUT_REVERSAL','STOCK_TRANSFER_IN_REVERSAL') THEN
  SELECT * INTO original FROM stock_transactions WHERE id=m.reversal_of_id;
  IF t.reversed_at IS NULL OR original.id IS NULL OR original.stock_transfer_id IS DISTINCT FROM t.id OR original.stock_transfer_item_id IS DISTINCT FROM i.id
   OR m.transfer_receipt_line_id IS DISTINCT FROM original.transfer_receipt_line_id OR m.project_id IS DISTINCT FROM original.project_id OR m.warehouse_id<>original.warehouse_id OR m.quantity<>-original.quantity OR m.uom_id IS DISTINCT FROM original.uom_id
   OR (m.movement_type='STOCK_TRANSFER_OUT_REVERSAL' AND original.movement_type<>'STOCK_TRANSFER_OUT') OR (m.movement_type='STOCK_TRANSFER_IN_REVERSAL' AND original.movement_type<>'STOCK_TRANSFER_IN')
   OR m.posted_by_user_id IS DISTINCT FROM t.reversed_by_user_id OR m.effect_key<>'stock-transfer-reversal:'||original.id THEN RAISE EXCEPTION 'TRANSFER_REVERSAL_EFFECT_INVALID'; END IF;
  IF p.stock_uom_id IS NOT NULL THEN
   IF NOT EXISTS(SELECT 1 FROM material_uom_effect_pins e WHERE e.stock_transaction_id=original.id)
   THEN RAISE EXCEPTION 'MATERIAL_UOM_ORIGINAL_REVERSAL_PIN_REQUIRED'; END IF;
   IF m.movement_type='STOCK_TRANSFER_IN_REVERSAL' THEN
    PERFORM pg_advisory_xact_lock(hashtext('inventory-stock:'||m.company_id::text||':'||m.warehouse_id::text||':'||m.material_id::text||':'||m.project_id::text||':'||m.uom_id::text));
    SELECT COALESCE((SELECT SUM(st.quantity) FROM stock_transactions st WHERE st.company_id=m.company_id AND st.warehouse_id=m.warehouse_id AND st.project_id=m.project_id AND st.material_id=m.material_id AND st.uom_id=m.uom_id),0)
     - COALESCE((SELECT SUM(COALESCE(rp.stock_quantity,reserved_row.quantity)) FROM material_reservations reserved_row LEFT JOIN material_uom_reservation_pins rp ON rp.reservation_id=reserved_row.id WHERE reserved_row.company_id=m.company_id AND reserved_row.warehouse_id=m.warehouse_id AND reserved_row.project_id=m.project_id AND reserved_row.material_id=m.material_id AND COALESCE(rp.stock_uom_id,reserved_row.uom_id)=m.uom_id AND reserved_row.status='ACTIVE'),0) INTO free_quantity;
    IF -m.quantity>free_quantity THEN RAISE EXCEPTION 'STOCK_TRANSFER_REVERSAL_INSUFFICIENT_AVAILABLE'; END IF;
   END IF;
  END IF;
 ELSE RAISE EXCEPTION 'TRANSFER_MOVEMENT_INVALID'; END IF;
END $$;
CREATE OR REPLACE FUNCTION erp_transfer_proof() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE tid uuid; t stock_transfers; c transfer_custodies; r record; i record;
BEGIN
 IF TG_TABLE_NAME='transfer_custodies' THEN tid=NEW.transfer_id;
 ELSIF TG_TABLE_NAME='stock_transfers' THEN tid=NEW.id;
 ELSIF TG_TABLE_NAME='stock_transactions' THEN tid=NEW.stock_transfer_id;
 ELSIF TG_TABLE_NAME='transfer_receipt_lines' THEN SELECT transfer_id INTO tid FROM transfer_receipts WHERE id=NEW.receipt_id;
 ELSE tid=NEW.transfer_id; END IF;
 SELECT * INTO c FROM transfer_custodies WHERE transfer_id=tid;
 IF c.transfer_id IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO t FROM stock_transfers WHERE id=tid;
 IF NOT EXISTS(SELECT 1 FROM transfer_custody_events e WHERE e.transfer_id=tid AND e.version=c.version) THEN RAISE EXCEPTION 'TRANSFER_VERSION_EVENT_REQUIRED'; END IF;
 IF EXISTS(SELECT 1 FROM transfer_dispatches WHERE transfer_id=tid) THEN
  IF t.posted_at IS NULL THEN RAISE EXCEPTION 'TRANSFER_DISPATCH_EFFECT_REQUIRED'; END IF;
  FOR i IN SELECT * FROM stock_transfer_items WHERE stock_transfer_id=tid LOOP
   IF NOT EXISTS(SELECT 1 FROM stock_transactions m WHERE m.stock_transfer_item_id=i.id AND m.movement_type='STOCK_TRANSFER_OUT' AND m.quantity=-COALESCE((SELECT stock_quantity FROM material_uom_transfer_source_pins WHERE transfer_item_id=i.id),i.quantity)
    AND (NOT EXISTS(SELECT 1 FROM material_uom_transfer_source_pins WHERE transfer_item_id=i.id) OR EXISTS(SELECT 1 FROM material_uom_effect_pins e WHERE e.stock_transaction_id=m.id))) THEN RAISE EXCEPTION 'TRANSFER_DISPATCH_EFFECT_REQUIRED'; END IF;
  END LOOP;
 ELSIF t.posted_at IS NOT NULL THEN RAISE EXCEPTION 'TRANSFER_DISPATCH_REQUIRED'; END IF;
 FOR r IN SELECT * FROM transfer_receipts WHERE transfer_id=tid AND posted_at IS NOT NULL LOOP
  IF NOT EXISTS(SELECT 1 FROM transfer_receipt_lines WHERE receipt_id=r.id) THEN RAISE EXCEPTION 'TRANSFER_RECEIPT_LINES_REQUIRED'; END IF;
  FOR i IN SELECT * FROM transfer_receipt_lines WHERE receipt_id=r.id LOOP
   IF NOT EXISTS(SELECT 1 FROM stock_transactions m WHERE m.transfer_receipt_line_id=i.id AND m.movement_type='STOCK_TRANSFER_IN' AND m.quantity=COALESCE((erp_material_uom_transfer_effect(i.transfer_item_id,i.id)).stock_quantity,i.quantity)
    AND (NOT EXISTS(SELECT 1 FROM material_uom_transfer_source_pins WHERE transfer_item_id=i.transfer_item_id) OR EXISTS(SELECT 1 FROM material_uom_effect_pins e WHERE e.stock_transaction_id=m.id))) THEN RAISE EXCEPTION 'TRANSFER_RECEIPT_EFFECT_REQUIRED'; END IF;
  END LOOP;
 END LOOP;
 IF t.reversed_at IS NOT NULL THEN
  FOR i IN SELECT * FROM stock_transfer_items WHERE stock_transfer_id=tid LOOP
   IF COALESCE((SELECT stock_quantity FROM material_uom_transfer_source_pins WHERE transfer_item_id=i.id),i.quantity)<>(SELECT COALESCE(sum(quantity),0) FROM stock_transactions WHERE stock_transfer_item_id=i.id AND movement_type='STOCK_TRANSFER_IN') THEN RAISE EXCEPTION 'TRANSFER_OUTSTANDING_CUSTODY_NOT_REVERSIBLE'; END IF;
  END LOOP;
  IF EXISTS(SELECT 1 FROM stock_transactions m WHERE m.stock_transfer_id=tid AND m.movement_type IN ('STOCK_TRANSFER_IN','STOCK_TRANSFER_OUT') AND NOT EXISTS(SELECT 1 FROM stock_transactions rev WHERE rev.reversal_of_id=m.id)) THEN RAISE EXCEPTION 'TRANSFER_REVERSAL_EFFECT_REQUIRED'; END IF;
 END IF;
 RETURN NEW;
END $$;

-- DEC-050 B explicit opt-in: no rows are inserted by this migration.
CREATE TABLE material_uom_activations (
 material_id uuid PRIMARY KEY,
 company_id uuid NOT NULL,
 stock_uom_id uuid NOT NULL REFERENCES units_of_measure(id) ON DELETE RESTRICT,
 basis_version integer NOT NULL CHECK(basis_version>=1),
 actor_user_id uuid NOT NULL,
 session_id uuid NOT NULL REFERENCES user_sessions(id) ON DELETE RESTRICT,
 request_key uuid NOT NULL,
 reason varchar(2000) NOT NULL CHECK(length(btrim(reason)) BETWEEN 1 AND 2000 AND reason !~ '[[:cntrl:]]'),
 created_at timestamptz(6) NOT NULL DEFAULT transaction_timestamp(),
 FOREIGN KEY(company_id,material_id) REFERENCES material_uom_bases(company_id,material_id) ON DELETE RESTRICT,
 FOREIGN KEY(company_id,actor_user_id) REFERENCES users(company_id,id) ON DELETE RESTRICT,
 UNIQUE(company_id,actor_user_id,request_key)
);

-- Reject the history itself, including offsetting foreign-unit effects; never
-- use a zero net balance to infer an old conversion. Open sources cannot be
-- retroactively assigned a rate or a date by activation.
CREATE FUNCTION erp_material_uom_assert_activation_compatible(cid uuid,mid uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE basis material_uom_bases%ROWTYPE;
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('material-uom:'||cid::text||':'||mid::text,0));
 SELECT * INTO basis FROM material_uom_bases WHERE company_id=cid AND material_id=mid FOR UPDATE;
 IF NOT FOUND OR NOT EXISTS(SELECT 1 FROM materials WHERE id=mid AND company_id=cid AND is_active)
  OR NOT EXISTS(SELECT 1 FROM units_of_measure WHERE id=basis.stock_uom_id AND company_id=cid AND is_active AND decimal_places=basis.stock_precision)
 THEN RAISE EXCEPTION 'MATERIAL_UOM_STOCK_BASIS_INVALID'; END IF;
 IF EXISTS(SELECT 1 FROM stock_transactions WHERE company_id=cid AND material_id=mid AND uom_id<>basis.stock_uom_id)
 THEN RAISE EXCEPTION 'MATERIAL_UOM_HISTORICAL_UNIT_CONFLICT'; END IF;
 IF EXISTS(SELECT 1 FROM material_reservations WHERE company_id=cid AND material_id=mid AND status IN ('DRAFT','ACTIVE'))
 THEN RAISE EXCEPTION 'MATERIAL_UOM_OPEN_RESERVATION_CONFLICT'; END IF;
 IF EXISTS(SELECT 1 FROM goods_receipt_items gi JOIN goods_receipts gr ON gr.id=gi.goods_receipt_id WHERE gr.company_id=cid AND gi.material_id=mid AND gr.posted_at IS NULL)
 OR EXISTS(SELECT 1 FROM material_issue_items ii JOIN material_issues mi ON mi.id=ii.material_issue_id WHERE mi.company_id=cid AND ii.material_id=mid AND mi.posted_at IS NULL)
 OR EXISTS(SELECT 1 FROM material_return_items ri JOIN material_returns mr ON mr.id=ri.material_return_id WHERE mr.company_id=cid AND ri.material_id=mid AND mr.posted_at IS NULL)
 OR EXISTS(SELECT 1 FROM stock_transfer_items ti JOIN stock_transfers st ON st.id=ti.stock_transfer_id WHERE st.company_id=cid AND ti.material_id=mid AND (st.posted_at IS NULL OR (st.reversed_at IS NULL AND EXISTS(SELECT 1 FROM transfer_custodies WHERE transfer_id=st.id) AND ti.quantity>(SELECT COALESCE(SUM(rl.quantity),0) FROM transfer_receipt_lines rl JOIN transfer_receipts tr ON tr.id=rl.receipt_id WHERE rl.transfer_item_id=ti.id AND tr.posted_at IS NOT NULL))))
 OR EXISTS(SELECT 1 FROM stock_counts WHERE company_id=cid AND material_id=mid AND status IN ('DRAFT','SUBMITTED'))
 OR EXISTS(SELECT 1 FROM receiving_delivery_lines dl JOIN receiving_deliveries d ON d.id=dl.delivery_id WHERE d.company_id=cid AND dl.material_id=mid AND d.status<>'VOID' AND NOT EXISTS(SELECT 1 FROM goods_receipts gr WHERE gr.delivery_id=d.id AND gr.posted_at IS NOT NULL))
 THEN RAISE EXCEPTION 'MATERIAL_UOM_OPEN_SOURCE_CONFLICT'; END IF;
 -- Stage C must reconcile these demand/limit sources explicitly; no old plan
 -- or signed request is reinterpreted by this B activation boundary.
 IF EXISTS(SELECT 1 FROM material_usage_plan_lines pl JOIN material_usage_plan_revisions pr ON pr.id=pl.revision_id JOIN material_usage_plans p ON p.id=pr.plan_id WHERE p.company_id=cid AND pl.material_id=mid)
 OR EXISTS(SELECT 1 FROM material_request_lines rl JOIN material_requests r ON r.id=rl.request_id WHERE r.company_id=cid AND rl.material_id=mid)
 THEN RAISE EXCEPTION 'MATERIAL_UOM_DEMAND_RECONCILIATION_REQUIRED'; END IF;
END $$;

CREATE FUNCTION erp_material_uom_activation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE basis material_uom_bases%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'MATERIAL_UOM_ACTIVATION_IMMUTABLE'; END IF;
 IF current_setting('transaction_isolation')<>'serializable' THEN RAISE EXCEPTION 'MATERIAL_UOM_SERIALIZABLE_REQUIRED'; END IF;
 PERFORM erp_material_uom_assert_actor(NEW.company_id,NEW.actor_user_id,NEW.session_id);
 PERFORM erp_material_uom_assert_activation_compatible(NEW.company_id,NEW.material_id);
 SELECT * INTO basis FROM material_uom_bases WHERE company_id=NEW.company_id AND material_id=NEW.material_id;
 IF NEW.stock_uom_id IS DISTINCT FROM basis.stock_uom_id OR NEW.basis_version IS DISTINCT FROM basis.version
  OR NEW.created_at<>transaction_timestamp() THEN RAISE EXCEPTION 'MATERIAL_UOM_ACTIVATION_VERSION_CONFLICT'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER material_uom_activation_guard BEFORE INSERT OR UPDATE OR DELETE ON material_uom_activations FOR EACH ROW EXECUTE FUNCTION erp_material_uom_activation_guard();

-- Source writers and activation share a material lock and a serializable read
-- dependency. New rows racing an activation cannot escape the open-source
-- census. Existing immutable/source-specific guards remain in force.
CREATE FUNCTION erp_material_uom_source_activation_lock() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cid uuid;
BEGIN
 SELECT company_id INTO cid FROM materials WHERE id=NEW.material_id;
 PERFORM pg_advisory_xact_lock(hashtextextended('material-uom:'||cid::text||':'||NEW.material_id::text,0));
 PERFORM 1 FROM material_uom_activations WHERE company_id=cid AND material_id=NEW.material_id;
 IF FOUND AND TG_TABLE_NAME IN ('material_usage_plan_lines','material_request_lines')
 THEN RAISE EXCEPTION 'MATERIAL_UOM_DEMAND_RECONCILIATION_REQUIRED'; END IF;
 RETURN NEW;
END $$;
DO $$ DECLARE name text; BEGIN
 FOREACH name IN ARRAY ARRAY['goods_receipt_items','material_issue_items','material_return_items','stock_transfer_items','material_reservations','stock_counts','receiving_delivery_lines','material_usage_plan_lines','material_request_lines'] LOOP
  EXECUTE format('CREATE TRIGGER material_uom_source_activation_lock BEFORE INSERT OR UPDATE ON %I FOR EACH ROW EXECUTE FUNCTION erp_material_uom_source_activation_lock()',name);
 END LOOP;
END $$;

CREATE FUNCTION erp_material_uom_active_movement_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE active material_uom_activations%ROWTYPE;
BEGIN
 -- Source insertion/freeze owns the material lock; posting already owns its
 -- canonical inventory lock. Do not invert that order for original reversals.
 SELECT * INTO active FROM material_uom_activations WHERE company_id=NEW.company_id AND material_id=NEW.material_id;
 IF NOT FOUND THEN RETURN NEW; END IF;
 IF NEW.uom_id IS DISTINCT FROM active.stock_uom_id THEN RAISE EXCEPTION 'MATERIAL_UOM_CANONICAL_STOCK_UNIT_REQUIRED'; END IF;
 -- Original legacy same-basis corrections stay source exact. Never freeze a
 -- new source or invent a factor for an old unpinned reversal/return.
 IF NEW.reversal_of_id IS NOT NULL OR NEW.movement_type='MATERIAL_RETURN' OR NEW.stock_count_id IS NOT NULL THEN RETURN NEW; END IF;
 IF NEW.movement_type='GOODS_RECEIPT' AND EXISTS(SELECT 1 FROM material_uom_receipt_source_pins WHERE receipt_item_id=NEW.goods_receipt_item_id)
 OR NEW.movement_type='MATERIAL_ISSUE' AND (EXISTS(SELECT 1 FROM material_uom_issue_source_pins WHERE issue_item_id=NEW.material_issue_item_id) OR EXISTS(SELECT 1 FROM material_issue_items i JOIN material_uom_reservation_pins rp ON rp.reservation_id=i.reservation_id WHERE i.id=NEW.material_issue_item_id))
 OR NEW.movement_type IN ('STOCK_TRANSFER_IN','STOCK_TRANSFER_OUT') AND EXISTS(SELECT 1 FROM material_uom_transfer_source_pins WHERE transfer_item_id=NEW.stock_transfer_item_id)
 THEN RETURN NEW; END IF;
 RAISE EXCEPTION 'MATERIAL_UOM_ACTIVATED_SOURCE_PIN_REQUIRED';
END $$;
CREATE TRIGGER material_uom_active_movement_guard BEFORE INSERT ON stock_transactions FOR EACH ROW EXECUTE FUNCTION erp_material_uom_active_movement_guard();

CREATE FUNCTION erp_material_uom_active_reservation_proof() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM material_reservations r JOIN material_uom_activations a ON a.company_id=r.company_id AND a.material_id=r.material_id
  WHERE r.id=NEW.id AND r.status='ACTIVE' AND NOT EXISTS(SELECT 1 FROM material_uom_reservation_pins WHERE reservation_id=r.id))
 THEN RAISE EXCEPTION 'MATERIAL_UOM_ACTIVATED_SOURCE_PIN_REQUIRED'; END IF;
 RETURN NEW;
END $$;
CREATE CONSTRAINT TRIGGER material_uom_active_reservation_proof AFTER INSERT OR UPDATE ON material_reservations DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_material_uom_active_reservation_proof();

CREATE OR REPLACE FUNCTION erp_material_uom_tracked_stock_basis(cid uuid,mid uuid)
RETURNS TABLE(stock_uom_id uuid,stock_precision integer) LANGUAGE sql STABLE AS $$
 SELECT b.stock_uom_id,b.stock_precision FROM material_uom_bases b
 WHERE b.company_id=cid AND b.material_id=mid AND (
  EXISTS(SELECT 1 FROM material_uom_activations a WHERE a.company_id=cid AND a.material_id=mid)
  OR EXISTS(SELECT 1 FROM material_uom_effect_pins e WHERE e.company_id=cid AND e.material_id=mid)
  OR EXISTS(SELECT 1 FROM material_uom_receipt_source_pins p WHERE p.company_id=cid AND p.material_id=mid)
  OR EXISTS(SELECT 1 FROM material_uom_reservation_pins p WHERE p.company_id=cid AND p.material_id=mid)
  OR EXISTS(SELECT 1 FROM material_uom_issue_source_pins p WHERE p.company_id=cid AND p.material_id=mid)
  OR EXISTS(SELECT 1 FROM material_uom_transfer_source_pins p WHERE p.company_id=cid AND p.material_id=mid))
$$;
