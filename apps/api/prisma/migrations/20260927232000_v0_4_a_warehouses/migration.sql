CREATE TABLE "warehouses" (
  "id" UUID NOT NULL DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL,
  "warehouse_code" VARCHAR(80) NOT NULL,
  "warehouse_name" VARCHAR(200) NOT NULL,
  "project_id" UUID,
  "location" VARCHAR(500),
  "is_site_warehouse" BOOLEAN NOT NULL DEFAULT false,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "warehouses_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "warehouses_site_project_check"
    CHECK (NOT "is_site_warehouse" OR "project_id" IS NOT NULL)
);

CREATE UNIQUE INDEX "warehouses_company_id_warehouse_code_key"
ON "warehouses"("company_id","warehouse_code");

CREATE INDEX "warehouses_company_id_is_active_idx"
ON "warehouses"("company_id","is_active");

CREATE INDEX "warehouses_project_id_is_active_idx"
ON "warehouses"("project_id","is_active");

ALTER TABLE "warehouses"
  ADD CONSTRAINT "warehouses_company_id_fkey"
  FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

ALTER TABLE "warehouses"
  ADD CONSTRAINT "warehouses_project_id_fkey"
  FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

CREATE OR REPLACE FUNCTION enforce_warehouse_project_scope()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  project_company UUID;
BEGIN
  IF NEW.project_id IS NULL THEN
    IF NEW.is_site_warehouse THEN
      RAISE EXCEPTION 'Site Warehouse requires a Project';
    END IF;
    RETURN NEW;
  END IF;

  SELECT company_id INTO project_company
  FROM projects
  WHERE id = NEW.project_id;

  IF project_company IS NULL OR project_company <> NEW.company_id THEN
    RAISE EXCEPTION 'Warehouse Project must belong to the same Company';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER warehouses_project_scope_guard
BEFORE INSERT OR UPDATE OF company_id, project_id, is_site_warehouse
ON "warehouses"
FOR EACH ROW
EXECUTE FUNCTION enforce_warehouse_project_scope();

-- Warehouse identity cannot be changed or hard-deleted. Project reassignment
-- before transaction history is allowed only through authorized service rules;
-- later stages attach history-dependent guards when stock tables exist.
CREATE OR REPLACE FUNCTION protect_warehouse_identity()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Warehouse cannot be deleted; archive it instead';
  END IF;

  IF NEW.id <> OLD.id OR NEW.company_id <> OLD.company_id THEN
    RAISE EXCEPTION 'Warehouse identity and Company cannot be changed';
  END IF;

  RETURN NEW;
END;
$$;

CREATE TRIGGER warehouses_identity_guard
BEFORE UPDATE OR DELETE ON "warehouses"
FOR EACH ROW
EXECUTE FUNCTION protect_warehouse_identity();
