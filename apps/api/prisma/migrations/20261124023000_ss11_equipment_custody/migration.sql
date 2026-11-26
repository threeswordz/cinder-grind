-- SS11 / issue #428: employee custody loans, distinct from Project Equipment assignment.
-- Forward-only, no existing equipment/assets or historic records rewritten.
CREATE TABLE "equipment_custody_loans" (
  "id" UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  "company_id" UUID NOT NULL REFERENCES "companies"("id") ON DELETE RESTRICT,
  "equipment_id" UUID NOT NULL REFERENCES "equipment"("id") ON DELETE RESTRICT,
  "project_id" UUID NOT NULL REFERENCES "projects"("id") ON DELETE RESTRICT,
  "borrower_employee_id" UUID NOT NULL REFERENCES "employees"("id") ON DELETE RESTRICT,
  "site_label" VARCHAR(150) NOT NULL,
  "issued_on" DATE NOT NULL,
  "due_on" DATE NOT NULL,
  "condition_out" VARCHAR(300) NOT NULL,
  "issued_by_user_id" UUID NOT NULL REFERENCES "users"("id") ON DELETE RESTRICT,
  "returned_on" DATE,
  "condition_in" VARCHAR(300),
  "returned_by_user_id" UUID REFERENCES "users"("id") ON DELETE RESTRICT,
  "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updated_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  CONSTRAINT "equipment_custody_dates_check" CHECK ("due_on" >= "issued_on" AND
    ("returned_on" IS NULL OR "returned_on" >= "issued_on")),
  CONSTRAINT "equipment_custody_return_complete_check" CHECK (
    ("returned_on" IS NULL AND "condition_in" IS NULL AND "returned_by_user_id" IS NULL)
    OR ("returned_on" IS NOT NULL AND "condition_in" IS NOT NULL AND "returned_by_user_id" IS NOT NULL)),
  CONSTRAINT "equipment_custody_site_nonempty_check" CHECK (length(btrim("site_label")) > 0),
  CONSTRAINT "equipment_custody_condition_out_nonempty_check" CHECK (length(btrim("condition_out")) > 0),
  CONSTRAINT "equipment_custody_condition_in_nonempty_check" CHECK ("condition_in" IS NULL OR length(btrim("condition_in")) > 0)
);
CREATE UNIQUE INDEX "equipment_custody_one_open_per_equipment"
ON "equipment_custody_loans" ("equipment_id") WHERE "returned_on" IS NULL;
CREATE INDEX "equipment_custody_company_project_date"
ON "equipment_custody_loans" ("company_id","project_id","issued_on" DESC);
CREATE INDEX "equipment_custody_borrower_open"
ON "equipment_custody_loans" ("borrower_employee_id","returned_on");

CREATE OR REPLACE FUNCTION guard_equipment_custody_loan()
RETURNS trigger AS $$
DECLARE
  e RECORD;
  p_company UUID;
  b RECORD;
  actor_company UUID;
BEGIN
  IF TG_OP = 'DELETE' THEN
    RAISE EXCEPTION 'Equipment custody history cannot be deleted';
  END IF;
  IF TG_OP = 'UPDATE' THEN
    IF OLD."returned_on" IS NOT NULL
       OR (to_jsonb(NEW) - 'returned_on' - 'condition_in' - 'returned_by_user_id' - 'updated_at')
          IS DISTINCT FROM
          (to_jsonb(OLD) - 'returned_on' - 'condition_in' - 'returned_by_user_id' - 'updated_at')
       OR NEW."returned_on" IS NULL THEN
      RAISE EXCEPTION 'Equipment custody identity/return history is immutable';
    END IF;
    SELECT "company_id" INTO actor_company FROM "users"
      WHERE "id" = NEW."returned_by_user_id" AND "is_active";
    IF actor_company IS NULL OR actor_company <> NEW."company_id" THEN
      RAISE EXCEPTION 'Custody return actor must be active in the same Company';
    END IF;
    RETURN NEW;
  END IF;

  -- All writers lock the asset row before testing an open loan.
  SELECT "company_id", "equipment_code", "is_active", "operational_status"
    INTO e FROM "equipment" WHERE "id" = NEW."equipment_id" FOR UPDATE;
  SELECT "company_id" INTO p_company FROM "projects" WHERE "id" = NEW."project_id";
  SELECT "company_id", "is_active" INTO b FROM "employees"
    WHERE "id" = NEW."borrower_employee_id";
  SELECT "company_id" INTO actor_company FROM "users"
    WHERE "id" = NEW."issued_by_user_id" AND "is_active";

  IF e."company_id" IS NULL OR e."company_id" <> NEW."company_id"
     OR p_company IS NULL OR p_company <> NEW."company_id"
     OR b."company_id" IS NULL OR b."company_id" <> NEW."company_id"
     OR actor_company IS NULL OR actor_company <> NEW."company_id" THEN
    RAISE EXCEPTION 'Custody Company/Project/borrower/actor scope mismatch';
  END IF;
  IF NOT e."is_active" OR e."operational_status" <> 'AVAILABLE'
     OR e."equipment_code" !~ '^CG[0-9]{5}$' THEN
    RAISE EXCEPTION 'Custody requires an active, available CG##### Equipment record';
  END IF;
  IF NOT b."is_active"
    OR NOT EXISTS (
      SELECT 1 FROM "project_members" m
      WHERE m."project_id" = NEW."project_id"
        AND m."employee_id" = NEW."borrower_employee_id"
        AND m."is_active"
        AND (m."start_date" IS NULL OR m."start_date" <= NEW."issued_on")
        AND (m."end_date" IS NULL OR m."end_date" >= NEW."issued_on")
    ) THEN
    RAISE EXCEPTION 'Custody borrower must be active and assigned to the Project on issue date';
  END IF;
  IF NEW."issued_on" > CURRENT_DATE OR
    NOT EXISTS (
      SELECT 1 FROM "equipment_assignments" a
      WHERE a."equipment_id" = NEW."equipment_id"
        AND a."company_id" = NEW."company_id"
        AND a."project_id" = NEW."project_id"
        AND a."assigned_to" IS NULL
        AND a."assigned_from" <= NEW."issued_on"
    ) THEN
    RAISE EXCEPTION 'Custody requires a current open Equipment assignment to this Project';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER equipment_custody_loan_guard
BEFORE INSERT OR UPDATE OR DELETE ON "equipment_custody_loans"
FOR EACH ROW EXECUTE FUNCTION guard_equipment_custody_loan();

-- An open individual loan cannot silently move/release the Project assignment.
CREATE OR REPLACE FUNCTION protect_assigned_equipment_with_open_custody()
RETURNS trigger AS $$
DECLARE
  locked_id UUID;
BEGIN
  SELECT "id" INTO locked_id FROM "equipment" WHERE "id" = NEW."equipment_id" FOR UPDATE;
  IF EXISTS (SELECT 1 FROM "equipment_custody_loans" l
     WHERE l."equipment_id" = NEW."equipment_id" AND l."returned_on" IS NULL) THEN
    RAISE EXCEPTION 'Return the active custody loan before reassigning/releasing Equipment';
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
CREATE TRIGGER equipment_assignment_open_custody_guard
BEFORE INSERT OR UPDATE OF "assigned_to", "project_id", "equipment_id" ON "equipment_assignments"
FOR EACH ROW EXECUTE FUNCTION protect_assigned_equipment_with_open_custody();

-- Deliberately do NOT grant retained production roles. Coordinator owns role activation.
INSERT INTO "permissions" ("id","permission_code","module_code","description")
VALUES
  (gen_random_uuid(),'equipment.custody.view','EQUIPMENT','View scoped person-level Equipment custody'),
  (gen_random_uuid(),'equipment.custody.manage','EQUIPMENT','Issue and return scoped employee Equipment custody')
ON CONFLICT ("permission_code") DO NOTHING;
