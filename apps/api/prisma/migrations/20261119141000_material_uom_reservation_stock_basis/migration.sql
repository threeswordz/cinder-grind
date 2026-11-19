-- DEC-050 B: optional canonical reservation dimension, not a second stock ledger.
-- Historical reservations retain NULL projection and their original quantity/uom.
ALTER TABLE material_reservations
 ADD COLUMN stock_uom_id UUID,
 ADD COLUMN stock_quantity DECIMAL(18,4),
 ADD COLUMN conversion_business_date DATE,
 ADD COLUMN conversion_revision_id UUID,
 ADD COLUMN conversion_basis_version INTEGER,
 ADD COLUMN conversion_numerator VARCHAR(38),
 ADD COLUMN conversion_denominator VARCHAR(38);

ALTER TABLE material_reservations
 ADD CONSTRAINT reservation_conversion_group_check CHECK (
   (stock_uom_id IS NULL AND stock_quantity IS NULL
    AND conversion_business_date IS NULL AND conversion_revision_id IS NULL
    AND conversion_basis_version IS NULL AND conversion_numerator IS NULL
    AND conversion_denominator IS NULL)
   OR
   (stock_uom_id IS NOT NULL AND stock_quantity IS NOT NULL
    AND conversion_business_date IS NOT NULL AND conversion_basis_version IS NOT NULL
    AND conversion_numerator IS NOT NULL AND conversion_denominator IS NOT NULL)
 ),
 ADD CONSTRAINT reservation_conversion_revision_fk FOREIGN KEY (conversion_revision_id)
   REFERENCES material_uom_revisions(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 ADD CONSTRAINT reservation_conversion_unit_fk FOREIGN KEY (stock_uom_id)
   REFERENCES units_of_measure(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 ADD CONSTRAINT reservation_conversion_version_check CHECK (
   conversion_basis_version IS NULL OR conversion_basis_version BETWEEN 1 AND 2147483646
 ),
 ADD CONSTRAINT reservation_conversion_ratio_check CHECK (
   conversion_numerator IS NULL OR (
     conversion_numerator ~ '^[1-9][0-9]{0,37}$'
     AND conversion_denominator ~ '^[1-9][0-9]{0,37}$'
   )
 );

-- The existing material reservation scope/history guards stay unchanged.
-- Additional canonically projected reservations must be exactly consistent
-- with the stock basis, their source precision and the chosen effective
-- definition at the original frozen basis version. No activation is implied.
CREATE FUNCTION erp_material_uom_reservation_stock_guard()
RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE basis material_uom_bases%ROWTYPE;
 revision material_uom_revisions%ROWTYPE;
 selected uuid;
 source_precision integer;
BEGIN
 -- Once the source is no longer DRAFT, its exact pinned conversion provenance
 -- cannot be changed, cleared, repointed or recomputed at a later factor.
 IF TG_OP='UPDATE' AND OLD.status <> 'DRAFT' AND
    ROW(NEW.stock_uom_id,NEW.stock_quantity,NEW.conversion_business_date,
        NEW.conversion_revision_id,NEW.conversion_basis_version,
        NEW.conversion_numerator,NEW.conversion_denominator)
    IS DISTINCT FROM
    ROW(OLD.stock_uom_id,OLD.stock_quantity,OLD.conversion_business_date,
        OLD.conversion_revision_id,OLD.conversion_basis_version,
        OLD.conversion_numerator,OLD.conversion_denominator)
 THEN RAISE EXCEPTION 'MATERIAL_UOM_RESERVATION_PROVENANCE_IMMUTABLE'; END IF;
 IF NEW.stock_quantity IS NULL THEN RETURN NEW; END IF;
 SELECT * INTO basis FROM material_uom_bases
   WHERE material_id=NEW.material_id AND company_id=NEW.company_id;
 IF NOT FOUND OR basis.stock_uom_id IS DISTINCT FROM NEW.stock_uom_id
    OR NEW.conversion_basis_version NOT BETWEEN 1 AND basis.version
 THEN RAISE EXCEPTION 'MATERIAL_UOM_RESERVATION_STOCK_BASIS_INVALID'; END IF;
 IF NOT EXISTS(SELECT 1 FROM units_of_measure
   WHERE id=NEW.stock_uom_id AND company_id=NEW.company_id
     AND is_active AND decimal_places=basis.stock_precision)
 OR NOT EXISTS(SELECT 1 FROM units_of_measure
   WHERE id=NEW.uom_id AND company_id=NEW.company_id AND is_active)
 THEN RAISE EXCEPTION 'MATERIAL_UOM_RESERVATION_UNIT_INVALID'; END IF;
 IF NEW.conversion_revision_id IS NULL THEN
   IF NEW.uom_id IS DISTINCT FROM basis.stock_uom_id
      OR NEW.conversion_numerator <> '1'
      OR NEW.conversion_denominator <> '1'
   THEN RAISE EXCEPTION 'MATERIAL_UOM_RESERVATION_IDENTITY_INVALID'; END IF;
   source_precision=basis.stock_precision;
 ELSE
   SELECT * INTO revision FROM material_uom_revisions
     WHERE id=NEW.conversion_revision_id;
   IF NOT FOUND OR revision.company_id IS DISTINCT FROM NEW.company_id
      OR revision.material_id IS DISTINCT FROM NEW.material_id
      OR revision.source_uom_id IS DISTINCT FROM NEW.uom_id
      OR revision.effective_from > NEW.conversion_business_date
      OR revision.revision_no > NEW.conversion_basis_version
      OR revision.numerator IS DISTINCT FROM NEW.conversion_numerator
      OR revision.denominator IS DISTINCT FROM NEW.conversion_denominator
   THEN RAISE EXCEPTION 'MATERIAL_UOM_RESERVATION_REVISION_INVALID'; END IF;
   SELECT id INTO selected FROM material_uom_revisions
     WHERE company_id=NEW.company_id AND material_id=NEW.material_id
      AND source_uom_id=NEW.uom_id
      AND revision_no<=NEW.conversion_basis_version
      AND effective_from<=NEW.conversion_business_date
     ORDER BY effective_from DESC,revision_no DESC LIMIT 1;
   IF selected IS DISTINCT FROM NEW.conversion_revision_id
   THEN RAISE EXCEPTION 'MATERIAL_UOM_RESERVATION_REVISION_DRIFT'; END IF;
   source_precision=revision.source_precision;
 END IF;
 IF NOT erp_material_uom_exact_stock_fact(
   NEW.quantity,NEW.stock_quantity,
   NEW.conversion_numerator::numeric,NEW.conversion_denominator::numeric,
   source_precision,basis.stock_precision)
 THEN RAISE EXCEPTION 'MATERIAL_UOM_RESERVATION_EXACTNESS_INVALID'; END IF;
 RETURN NEW;
END $$;

CREATE TRIGGER material_uom_reservation_stock_guard
 BEFORE INSERT OR UPDATE OF stock_uom_id,stock_quantity,conversion_business_date,
   conversion_revision_id,conversion_basis_version,conversion_numerator,conversion_denominator
 ON material_reservations FOR EACH ROW
 EXECUTE FUNCTION erp_material_uom_reservation_stock_guard();
