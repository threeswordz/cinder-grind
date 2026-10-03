-- V0.7-C forward-only hardening:
-- Forecast lines must never be reparented or moved across scope. On UPDATE,
-- validate/lock the OLD parent so terminal Forecast history cannot be detached
-- by pointing the line at a different DRAFT Forecast.

CREATE OR REPLACE FUNCTION erp_cost_forecast_line_guard()
RETURNS trigger AS $$
DECLARE
  parent_state TEXT;
  parent_company UUID;
  parent_project UUID;
  parent_forecast_id UUID;
BEGIN
  IF TG_OP = 'INSERT' THEN
    parent_forecast_id := NEW."forecast_id";
  ELSE
    parent_forecast_id := OLD."forecast_id";
  END IF;

  SELECT cf."state", cf."company_id", cf."project_id"
    INTO parent_state, parent_company, parent_project
  FROM "cost_forecasts" cf
  WHERE cf."id" = parent_forecast_id
  FOR UPDATE;

  IF parent_state IS NULL THEN
    RAISE EXCEPTION 'COST_FORECAST_LINE_PARENT_INVALID';
  END IF;
  IF parent_state <> 'DRAFT' THEN
    RAISE EXCEPTION 'COST_FORECAST_LINES_IMMUTABLE';
  END IF;

  IF TG_OP = 'UPDATE'
     AND (
       NEW."forecast_id" IS DISTINCT FROM OLD."forecast_id"
       OR NEW."company_id" IS DISTINCT FROM OLD."company_id"
       OR NEW."project_id" IS DISTINCT FROM OLD."project_id"
     ) THEN
    RAISE EXCEPTION 'COST_FORECAST_LINE_SCOPE_IMMUTABLE';
  END IF;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  END IF;

  IF NEW."company_id" IS DISTINCT FROM parent_company
     OR NEW."project_id" IS DISTINCT FROM parent_project THEN
    RAISE EXCEPTION 'COST_FORECAST_LINE_SCOPE_INVALID';
  END IF;
  IF NEW."uncommitted_etc_amount" < 0 THEN
    RAISE EXCEPTION 'COST_FORECAST_ETC_NEGATIVE';
  END IF;
  IF NEW."wbs_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "wbs_elements" w
    WHERE w."id" = NEW."wbs_id"
      AND w."project_id" = parent_project
      AND w."is_active" = TRUE
  ) THEN
    RAISE EXCEPTION 'COST_FORECAST_WBS_INVALID';
  END IF;
  IF NEW."cost_code_id" IS NOT NULL AND NOT EXISTS (
    SELECT 1 FROM "cost_codes" cc
    WHERE cc."id" = NEW."cost_code_id"
      AND cc."company_id" = parent_company
      AND cc."is_active" = TRUE
  ) THEN
    RAISE EXCEPTION 'COST_FORECAST_COST_CODE_INVALID';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
