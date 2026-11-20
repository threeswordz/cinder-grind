-- Stage C canonical plan-issue authorization. Existing legacy source and
-- approval proofs remain; activated allocations store exact stock-unit overage
-- without rounding back to source cartons or relaxing the old numeric CHECK.
CREATE TABLE material_uom_plan_allocation_pins (
 allocation_id uuid PRIMARY KEY REFERENCES material_plan_issue_allocations(id) ON DELETE RESTRICT,
 company_id uuid NOT NULL, material_id uuid NOT NULL,
 source_uom_id uuid NOT NULL REFERENCES units_of_measure(id) ON DELETE RESTRICT,
 source_quantity numeric(18,4) NOT NULL,
 stock_uom_id uuid NOT NULL REFERENCES units_of_measure(id) ON DELETE RESTRICT,
 stock_quantity numeric(18,4) NOT NULL,
 plan_stock_quantity numeric(18,4) NOT NULL,
 stock_overage_quantity numeric(18,4) NOT NULL,
 business_date date NOT NULL, basis_version integer NOT NULL,
 revision_id uuid REFERENCES material_uom_revisions(id) ON DELETE RESTRICT,
 numerator varchar(38) NOT NULL, denominator varchar(38) NOT NULL,
 created_at timestamptz(6) NOT NULL DEFAULT now(),
 CONSTRAINT material_uom_plan_allocation_basis_fk FOREIGN KEY(company_id,material_id)
  REFERENCES material_uom_bases(company_id,material_id) ON DELETE RESTRICT,
 CONSTRAINT material_uom_plan_allocation_values CHECK(
 source_quantity>0 AND stock_quantity>0 AND plan_stock_quantity>0
 AND stock_overage_quantity>=0 AND stock_overage_quantity<=stock_quantity
 AND source_quantity<>'NaN'::numeric AND stock_quantity<>'NaN'::numeric
 AND stock_overage_quantity<>'NaN'::numeric AND plan_stock_quantity<>'NaN'::numeric
 AND basis_version>0 AND numerator~'^[1-9][0-9]{0,37}$'
 AND denominator~'^[1-9][0-9]{0,37}$'
 )
);
CREATE INDEX material_uom_plan_allocation_company_idx
 ON material_uom_plan_allocation_pins(company_id,material_id,business_date);

CREATE FUNCTION erp_uom_plan_allocation_pin_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE a RECORD; src RECORD; issue_row RECORD;
 b material_uom_bases%ROWTYPE; rev material_uom_revisions%ROWTYPE;
 su units_of_measure%ROWTYPE; cu units_of_measure%ROWTYPE;
BEGIN
 IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_ALLOCATION_IMMUTABLE'; END IF;
 PERFORM erp_material_uom_require_activation(NEW.company_id,NEW.material_id);
 SELECT alloc.*,item.material_id,item.uom_id,item.quantity AS issue_quantity,
  issue.id AS issue_id,issue.company_id,issue.issue_date INTO a
 FROM material_plan_issue_allocations alloc
 JOIN material_plan_issue_authorizations auth ON auth.id=alloc.authorization_id
 JOIN material_issue_items item ON item.id=alloc.issue_item_id
 JOIN material_issues issue ON issue.id=auth.issue_id AND item.material_issue_id=issue.id
 WHERE alloc.id=NEW.allocation_id FOR SHARE OF alloc;
 SELECT plan_pin.* INTO src FROM material_uom_plan_line_pins plan_pin
 WHERE plan_pin.plan_line_id=a.plan_line_id;
 IF a.id IS NULL OR src.plan_line_id IS NULL OR a.company_id IS DISTINCT FROM NEW.company_id
  OR a.material_id IS DISTINCT FROM NEW.material_id
  OR a.uom_id IS DISTINCT FROM NEW.source_uom_id
  OR a.issue_quantity IS DISTINCT FROM NEW.source_quantity
  OR a.issue_date IS DISTINCT FROM NEW.business_date
  OR a.overage_quantity<>0
  OR src.company_id IS DISTINCT FROM NEW.company_id OR src.material_id IS DISTINCT FROM NEW.material_id
  OR src.source_uom_id IS DISTINCT FROM NEW.source_uom_id
  OR src.stock_uom_id IS DISTINCT FROM NEW.stock_uom_id
  OR src.stock_quantity IS DISTINCT FROM NEW.plan_stock_quantity
 THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_ALLOCATION_SOURCE_MISMATCH'; END IF;
 SELECT * INTO b FROM material_uom_bases WHERE company_id=NEW.company_id AND material_id=NEW.material_id;
 SELECT * INTO su FROM units_of_measure WHERE id=NEW.source_uom_id AND company_id=NEW.company_id AND is_active;
 SELECT * INTO cu FROM units_of_measure WHERE id=NEW.stock_uom_id AND company_id=NEW.company_id AND is_active;
 IF b.material_id IS NULL OR su.id IS NULL OR cu.id IS NULL
  OR b.stock_uom_id<>NEW.stock_uom_id OR b.version<>NEW.basis_version
  OR cu.decimal_places<>b.stock_precision
  OR NEW.source_quantity*NEW.numerator::numeric IS DISTINCT FROM NEW.stock_quantity*NEW.denominator::numeric
  OR mod(NEW.source_quantity*power(10::numeric,su.decimal_places),1)<>0
  OR mod(NEW.stock_quantity*power(10::numeric,b.stock_precision),1)<>0
 THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_ALLOCATION_CONVERSION_INVALID'; END IF;
 IF NEW.source_uom_id=NEW.stock_uom_id THEN
  IF NEW.revision_id IS NOT NULL OR NEW.numerator<>'1' OR NEW.denominator<>'1'
  THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_ALLOCATION_IDENTITY_REQUIRED'; END IF;
 ELSE
  SELECT * INTO rev FROM material_uom_revisions
   WHERE company_id=NEW.company_id AND material_id=NEW.material_id
    AND source_uom_id=NEW.source_uom_id AND effective_from<=NEW.business_date
   ORDER BY effective_from DESC,revision_no DESC LIMIT 1;
  IF rev.id IS NULL OR rev.id IS DISTINCT FROM NEW.revision_id
   OR rev.numerator IS DISTINCT FROM NEW.numerator
   OR rev.denominator IS DISTINCT FROM NEW.denominator
   OR rev.source_precision IS DISTINCT FROM su.decimal_places
   OR rev.revision_no>NEW.basis_version
  THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_ALLOCATION_DEFINITION_STALE'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER material_uom_plan_allocation_pin_guard
 BEFORE INSERT OR UPDATE OR DELETE ON material_uom_plan_allocation_pins
 FOR EACH ROW EXECUTE FUNCTION erp_uom_plan_allocation_pin_guard();

-- Every active converted allocation must have its genuine immutable exact
-- stock quantity and overage in the same original authorization transaction.
CREATE FUNCTION erp_uom_plan_allocation_pin_required() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE cid uuid; mid uuid;
BEGIN
 SELECT plan.company_id,item.material_id INTO cid,mid
  FROM material_plan_issue_authorizations a
  JOIN material_usage_plans plan ON plan.id=NEW.plan_id
  JOIN material_issue_items item ON item.id=NEW.issue_item_id
  WHERE a.id=NEW.authorization_id;
 IF EXISTS(SELECT 1 FROM material_uom_activations WHERE company_id=cid AND material_id=mid)
 AND NOT EXISTS(SELECT 1 FROM material_uom_plan_allocation_pins p
   WHERE p.allocation_id=NEW.id AND p.company_id=cid AND p.material_id=mid)
 THEN RAISE EXCEPTION 'MATERIAL_UOM_PLAN_ALLOCATION_PIN_REQUIRED'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER material_uom_plan_allocation_pin_required
 AFTER INSERT ON material_plan_issue_allocations
 DEFERRABLE INITIALLY DEFERRED FOR EACH ROW
 EXECUTE FUNCTION erp_uom_plan_allocation_pin_required();
