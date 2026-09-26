CREATE TABLE "wbs_elements" (
  "id" UUID NOT NULL,
  "project_id" UUID NOT NULL,
  "parent_id" UUID,
  "wbs_code" VARCHAR(80) NOT NULL,
  "wbs_name" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "wbs_elements_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "wbs_elements_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE,
  CONSTRAINT "wbs_elements_parent_id_fkey" FOREIGN KEY ("parent_id") REFERENCES "wbs_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "wbs_elements_project_id_wbs_code_key" ON "wbs_elements"("project_id", "wbs_code");
CREATE INDEX "wbs_elements_project_id_parent_id_is_active_idx" ON "wbs_elements"("project_id", "parent_id", "is_active");

CREATE TABLE "cost_codes" (
  "id" UUID NOT NULL,
  "company_id" UUID NOT NULL,
  "cost_code" VARCHAR(80) NOT NULL,
  "cost_name" VARCHAR(200) NOT NULL,
  "description" TEXT,
  "is_active" BOOLEAN NOT NULL DEFAULT true,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL,
  CONSTRAINT "cost_codes_pkey" PRIMARY KEY ("id"),
  CONSTRAINT "cost_codes_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE
);

CREATE UNIQUE INDEX "cost_codes_company_id_cost_code_key" ON "cost_codes"("company_id", "cost_code");
CREATE INDEX "cost_codes_company_id_is_active_idx" ON "cost_codes"("company_id", "is_active");

-- WBS hierarchy integrity: parent and child must share a Project and the hierarchy must remain acyclic.
CREATE OR REPLACE FUNCTION enforce_wbs_hierarchy()
RETURNS trigger AS $$
BEGIN
  IF NEW.parent_id IS NULL THEN
    RETURN NEW;
  END IF;

  IF NEW.parent_id = NEW.id THEN
    RAISE EXCEPTION 'WBS hierarchy cannot contain a self-parent';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM wbs_elements parent
    WHERE parent.id = NEW.parent_id AND parent.project_id = NEW.project_id
  ) THEN
    RAISE EXCEPTION 'WBS parent must belong to the same Project';
  END IF;

  IF EXISTS (
    WITH RECURSIVE ancestors AS (
      SELECT id, parent_id
      FROM wbs_elements
      WHERE id = NEW.parent_id
      UNION ALL
      SELECT parent.id, parent.parent_id
      FROM wbs_elements parent
      JOIN ancestors child ON parent.id = child.parent_id
    )
    SELECT 1 FROM ancestors WHERE id = NEW.id
  ) THEN
    RAISE EXCEPTION 'WBS hierarchy cannot contain a cycle';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER wbs_hierarchy_integrity
BEFORE INSERT OR UPDATE OF project_id, parent_id ON "wbs_elements"
FOR EACH ROW EXECUTE FUNCTION enforce_wbs_hierarchy();
