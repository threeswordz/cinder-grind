-- FM02 focused, read-only catalog proof on a DISPOSABLE CI PostgreSQL database.
-- This script never mutates historical or user-owned data.
DO $fm02$
DECLARE trigger_count integer;
DECLARE function_count integer;
DECLARE constraint_count integer;
BEGIN
  IF to_regclass('public.project_progress_plans') IS NULL
     OR to_regclass('public.project_progress_plan_lines') IS NULL THEN
    RAISE EXCEPTION 'FM02_NATIVE_TABLES_MISSING';
  END IF;

  SELECT count(*) INTO trigger_count
    FROM pg_trigger
    WHERE tgname IN (
      'fm02_lines_immutable',
      'fm02_plan_confirm_only',
      'fm02_plan_create_guard',
      'fm02_line_create_guard'
    ) AND NOT tgisinternal;
  IF trigger_count <> 4 THEN
    RAISE EXCEPTION 'FM02_NATIVE_TRIGGERS_MISSING: %', trigger_count;
  END IF;

  SELECT count(*) INTO function_count
    FROM pg_proc
    WHERE proname IN (
      'erp_fm02_immutable_lines',
      'erp_fm02_confirm_only',
      'erp_fm02_plan_create_guard',
      'erp_fm02_plan_line_create_guard'
    );
  IF function_count <> 4 THEN
    RAISE EXCEPTION 'FM02_NATIVE_FUNCTIONS_MISSING: %', function_count;
  END IF;

  SELECT count(*) INTO constraint_count
    FROM pg_constraint
    WHERE conname IN (
      'activity_progress_quantity_source_consistency',
      'fm02_confirmation_pair',
      'fm02_separate_preparer',
      'fm02_quantity_source_pair'
    );
  IF constraint_count <> 4 THEN
    RAISE EXCEPTION 'FM02_NATIVE_CONSTRAINTS_MISSING: %', constraint_count;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='activity_progress'
      AND column_name='completed_quantity'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='activity_progress'
      AND column_name='source_budget_revision_line_id'
  ) OR NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema='public' AND table_name='activity_progress'
      AND column_name='source_uom_id'
  ) THEN
    RAISE EXCEPTION 'FM02_NATIVE_QUANTITY_SOURCE_COLUMNS_MISSING';
  END IF;
END;
$fm02$;
