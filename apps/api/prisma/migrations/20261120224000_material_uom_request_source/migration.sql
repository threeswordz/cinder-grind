-- DEC-050 Stage C: frozen material-request demand by source revision.
-- No automatic activation, no changes to historical rows, stock or Finance.
-- Each CAPTURE/REVISE source version gets one immutable conversion receipt.
CREATE TABLE material_uom_request_line_pins (
 request_line_id uuid NOT NULL REFERENCES material_request_lines(id) ON DELETE RESTRICT,
 request_version integer NOT NULL,
 company_id uuid NOT NULL,
 material_id uuid NOT NULL,
 source_uom_id uuid NOT NULL REFERENCES units_of_measure(id) ON DELETE RESTRICT,
 source_quantity numeric(18,4) NOT NULL,
 stock_uom_id uuid NOT NULL REFERENCES units_of_measure(id) ON DELETE RESTRICT,
 stock_uom_code varchar(30) NOT NULL,
 stock_quantity numeric(18,4) NOT NULL,
 business_date date NOT NULL,
 basis_version integer NOT NULL,
 revision_id uuid REFERENCES material_uom_revisions(id) ON DELETE RESTRICT,
 numerator varchar(38) NOT NULL,
 denominator varchar(38) NOT NULL,
 created_at timestamptz(6) NOT NULL DEFAULT now(),
 CONSTRAINT material_uom_request_pin_pk PRIMARY KEY(request_line_id,request_version),
 CONSTRAINT material_uom_request_pin_basis_fk FOREIGN KEY(company_id,material_id)
 REFERENCES material_uom_bases(company_id,material_id) ON DELETE RESTRICT,
 CONSTRAINT material_uom_request_pin_shape CHECK(
 request_version>0 AND basis_version>0
 AND source_quantity>0 AND stock_quantity>0
 AND source_quantity<>'NaN'::numeric AND stock_quantity<>'NaN'::numeric
 AND numerator ~ '^[1-9][0-9]{0,37}$'
 AND denominator ~ '^[1-9][0-9]{0,37}$'
 )
);
CREATE INDEX material_uom_request_pin_company_source_idx
 ON material_uom_request_line_pins(company_id,material_id,request_line_id,request_version);

CREATE FUNCTION erp_uom_request_pin_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE l RECORD; basis material_uom_bases%ROWTYPE;
 source_unit units_of_measure%ROWTYPE; stock_unit units_of_measure%ROWTYPE;
 latest material_uom_revisions%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'MATERIAL_UOM_REQUEST_PIN_IMMUTABLE'; END IF;
 PERFORM erp_material_uom_require_activation(NEW.company_id,NEW.material_id);
 SELECT line.*,request.company_id,request.request_date,request.version
 INTO l FROM material_request_lines line JOIN material_requests request ON request.id=line.request_id
 WHERE line.id=NEW.request_line_id FOR SHARE OF line;
 IF NOT FOUND OR l.company_id IS DISTINCT FROM NEW.company_id
  OR l.material_id IS DISTINCT FROM NEW.material_id
  OR l.uom_id IS DISTINCT FROM NEW.source_uom_id
  OR l.requested_quantity IS DISTINCT FROM NEW.source_quantity
  OR l.request_date IS DISTINCT FROM NEW.business_date
  OR l.version IS DISTINCT FROM NEW.request_version
 THEN RAISE EXCEPTION 'MATERIAL_UOM_REQUEST_SOURCE_CHANGED'; END IF;
 SELECT * INTO basis FROM material_uom_bases
 WHERE company_id=NEW.company_id AND material_id=NEW.material_id;
 SELECT * INTO source_unit FROM units_of_measure
 WHERE id=NEW.source_uom_id AND company_id=NEW.company_id AND is_active;
 SELECT * INTO stock_unit FROM units_of_measure
 WHERE id=NEW.stock_uom_id AND company_id=NEW.company_id AND is_active;
 IF basis.material_id IS NULL OR source_unit.id IS NULL OR stock_unit.id IS NULL
  OR basis.stock_uom_id IS DISTINCT FROM NEW.stock_uom_id
  OR basis.stock_uom_code IS DISTINCT FROM NEW.stock_uom_code
  OR basis.version IS DISTINCT FROM NEW.basis_version
  OR stock_unit.decimal_places IS DISTINCT FROM basis.stock_precision
  OR NEW.source_quantity*NEW.numerator::numeric IS DISTINCT FROM NEW.stock_quantity*NEW.denominator::numeric
  OR mod(NEW.source_quantity*power(10::numeric,source_unit.decimal_places),1)<>0
  OR mod(NEW.stock_quantity*power(10::numeric,basis.stock_precision),1)<>0
 THEN RAISE EXCEPTION 'MATERIAL_UOM_REQUEST_PIN_INVALID'; END IF;
 IF NEW.source_uom_id=NEW.stock_uom_id THEN
  IF NEW.revision_id IS NOT NULL OR NEW.numerator<>'1' OR NEW.denominator<>'1'
   THEN RAISE EXCEPTION 'MATERIAL_UOM_REQUEST_IDENTITY_REQUIRED'; END IF;
 ELSE
  SELECT * INTO latest FROM material_uom_revisions
  WHERE company_id=NEW.company_id AND material_id=NEW.material_id
   AND source_uom_id=NEW.source_uom_id AND effective_from<=NEW.business_date
  ORDER BY effective_from DESC,revision_no DESC LIMIT 1;
  IF latest.id IS NULL OR latest.id IS DISTINCT FROM NEW.revision_id
   OR latest.numerator IS DISTINCT FROM NEW.numerator
   OR latest.denominator IS DISTINCT FROM NEW.denominator
   OR latest.source_precision IS DISTINCT FROM source_unit.decimal_places
   OR latest.revision_no>NEW.basis_version
  THEN RAISE EXCEPTION 'MATERIAL_UOM_REQUEST_DEFINITION_CHANGED'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER material_uom_request_pin_guard
 BEFORE INSERT OR UPDATE OR DELETE ON material_uom_request_line_pins
 FOR EACH ROW EXECUTE FUNCTION erp_uom_request_pin_guard();

-- Stage B activation already refuses any pre-existing request history.
-- Permit *new* activated sources only with deferred exact version/date/quantity
-- pins. Existing source/activation locks preserve the collision boundary.
CREATE OR REPLACE FUNCTION erp_material_uom_source_activation_lock()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cid uuid;
BEGIN
 SELECT company_id INTO cid FROM materials WHERE id=NEW.material_id;
 PERFORM pg_advisory_xact_lock(hashtextextended('material-uom:'||cid::text||':'||NEW.material_id::text,0));
 PERFORM 1 FROM material_uom_activations WHERE company_id=cid AND material_id=NEW.material_id;
 RETURN NEW;
END $$;

CREATE FUNCTION erp_uom_request_pin_required() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r RECORD;
BEGIN
 SELECT request.company_id,request.version,request.request_date INTO r
 FROM material_requests request WHERE request.id=NEW.request_id;
 IF EXISTS(SELECT 1 FROM material_uom_activations a
  WHERE a.company_id=r.company_id AND a.material_id=NEW.material_id)
 AND NOT EXISTS(SELECT 1 FROM material_uom_request_line_pins p
  WHERE p.request_line_id=NEW.id AND p.request_version=r.version
   AND p.material_id=NEW.material_id AND p.company_id=r.company_id
   AND p.source_uom_id=NEW.uom_id AND p.source_quantity=NEW.requested_quantity
   AND p.business_date=r.request_date)
 THEN RAISE EXCEPTION 'MATERIAL_UOM_REQUEST_PIN_REQUIRED'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER material_uom_request_pin_required
 AFTER INSERT OR UPDATE ON material_request_lines
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 EXECUTE FUNCTION erp_uom_request_pin_required();

-- Changing requestDate is a source revision even when amounts are identical.
CREATE FUNCTION erp_uom_request_date_pin_required() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF NEW.request_date IS DISTINCT FROM OLD.request_date
 AND EXISTS(
  SELECT 1 FROM material_request_lines l JOIN material_uom_activations a
   ON a.material_id=l.material_id AND a.company_id=NEW.company_id
   WHERE l.request_id=NEW.id AND NOT EXISTS(
    SELECT 1 FROM material_uom_request_line_pins p
    WHERE p.request_line_id=l.id AND p.request_version=NEW.version
     AND p.business_date=NEW.request_date AND p.source_quantity=l.requested_quantity
   )
 ) THEN RAISE EXCEPTION 'MATERIAL_UOM_REQUEST_DATE_PIN_REQUIRED'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER material_uom_request_date_pin_required
 AFTER UPDATE ON material_requests
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 EXECUTE FUNCTION erp_uom_request_date_pin_required();

-- This guard complements the original Company/Project/warehouse/WBS and
-- same-source-UOM link guard. It cannot weaken any of those validations.
CREATE FUNCTION erp_uom_request_link_effect_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE req RECORD; line RECORD; frozen material_uom_request_line_pins%ROWTYPE;
 effect RECORD; cnt integer;
BEGIN
 SELECT * INTO req FROM material_requests WHERE id=NEW.request_id;
 SELECT * INTO line FROM material_request_lines WHERE id=NEW.request_line_id;
 IF req.id IS NULL OR line.request_id IS DISTINCT FROM req.id THEN
  RAISE EXCEPTION 'MATERIAL_UOM_REQUEST_LINK_SCOPE_INVALID'; END IF;
 IF NOT EXISTS(SELECT 1 FROM material_uom_activations
   WHERE company_id=req.company_id AND material_id=line.material_id)
 THEN RETURN NEW; END IF;
 SELECT * INTO frozen FROM material_uom_request_line_pins
 WHERE request_line_id=line.id AND request_version<=req.version
 ORDER BY request_version DESC LIMIT 1;
 IF NOT FOUND OR frozen.company_id<>req.company_id OR frozen.material_id<>line.material_id
  OR frozen.source_uom_id<>line.uom_id OR frozen.source_quantity<>line.requested_quantity
  OR frozen.business_date<>req.request_date
 THEN RAISE EXCEPTION 'MATERIAL_UOM_REQUEST_CURRENT_PIN_REQUIRED'; END IF;
 SELECT count(*),MAX(e.stock_uom_id::text) AS stock_uom_id,
  SUM(e.stock_quantity) AS stock_quantity
 INTO cnt,effect
 FROM stock_transactions t
 JOIN material_uom_effect_pins e ON e.stock_transaction_id=t.id
   AND e.company_id=t.company_id AND e.material_id=t.material_id
 WHERE t.material_issue_item_id=NEW.material_issue_item_id
  AND t.company_id=req.company_id AND t.project_id=req.project_id
  AND t.warehouse_id=req.warehouse_id AND t.material_id=line.material_id
  AND t.movement_type='MATERIAL_ISSUE' AND e.effect_sign=-1
  AND t.quantity=-e.stock_quantity;
 IF cnt<>1 OR effect.stock_uom_id IS DISTINCT FROM frozen.stock_uom_id::text
  OR effect.stock_quantity IS NULL OR effect.stock_quantity<=0
 THEN RAISE EXCEPTION 'MATERIAL_UOM_REQUEST_LINK_STOCK_SOURCE_REQUIRED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER material_uom_request_link_effect_guard
 BEFORE INSERT ON material_request_issue_links
 FOR EACH ROW EXECUTE FUNCTION erp_uom_request_link_effect_guard();
