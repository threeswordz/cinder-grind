-- SS11 forward-only correction: the existing INSERT guard must use the
-- same Thai business calendar as the API, independent of PostgreSQL TimeZone.
-- No historical rows or existing migration files are modified.
CREATE FUNCTION equipment_custody_thailand_day(at_time timestamptz)
RETURNS date LANGUAGE sql IMMUTABLE STRICT AS $$
  SELECT (at_time AT TIME ZONE 'Asia/Bangkok')::date;
$$;

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
  IF NEW."issued_on" > equipment_custody_thailand_day(statement_timestamp()) OR
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
