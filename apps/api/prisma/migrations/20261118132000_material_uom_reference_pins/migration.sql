-- Declarative pins protect Company/precision even against concurrent master edits.
-- These supporting indexes do not modify any historical row or existing source owner.
CREATE UNIQUE INDEX material_uom_material_scope_key ON materials(id,company_id);
CREATE UNIQUE INDEX material_uom_unit_scope_precision_key ON units_of_measure(id,company_id,decimal_places);
ALTER TABLE material_uom_bases
 ADD CONSTRAINT material_uom_basis_material_scope_fk FOREIGN KEY(material_id,company_id) REFERENCES materials(id,company_id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 ADD CONSTRAINT material_uom_basis_precision_fk FOREIGN KEY(stock_uom_id,company_id,stock_precision) REFERENCES units_of_measure(id,company_id,decimal_places) ON DELETE RESTRICT ON UPDATE RESTRICT;
ALTER TABLE material_uom_revisions
 ADD CONSTRAINT material_uom_revision_precision_fk FOREIGN KEY(source_uom_id,company_id,source_precision) REFERENCES units_of_measure(id,company_id,decimal_places) ON DELETE RESTRICT ON UPDATE RESTRICT;
