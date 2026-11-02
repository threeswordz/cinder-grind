-- Preserve the original A migration. Bind a plan to the warehouse's persisted
-- Company/Project identity, including concurrent plan INSERT vs scope UPDATE.
-- A composite FK uses PostgreSQL's referential-integrity locks; a check-only
-- trigger could miss an uncommitted plan under a competing MVCC snapshot.
CREATE UNIQUE INDEX warehouses_material_plan_scope_key
  ON warehouses(id, company_id, project_id);

ALTER TABLE material_usage_plans
  ADD CONSTRAINT material_usage_plans_warehouse_scope_fkey
  FOREIGN KEY (warehouse_id, company_id, project_id)
  REFERENCES warehouses(id, company_id, project_id)
  ON UPDATE RESTRICT ON DELETE RESTRICT;
