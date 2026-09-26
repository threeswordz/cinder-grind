ALTER TABLE "activities"
ADD CONSTRAINT "activities_milestone_schedule_check"
CHECK (
  NOT "is_milestone"
  OR (
    "planned_duration_work_days" = 0
    AND "planned_start_date" = "planned_finish_date"
  )
) NOT VALID;

COMMENT ON CONSTRAINT "activities_milestone_schedule_check" ON "activities"
IS 'Enforced for new/updated rows. NOT VALID preserves pre-V0.2-B milestone rows so upgrade does not rewrite business schedule data; legacy invalid rows must be corrected through an authorized Activity update before they can be edited or analysed.';

CREATE OR REPLACE FUNCTION enforce_activity_dependency_cycle()
RETURNS trigger AS $$
BEGIN
  -- Serialize dependency-graph mutations per Project. Without this lock,
  -- concurrent A->B and B->A inserts under READ COMMITTED could both
  -- pass reachability checks before either transaction commits.
  PERFORM pg_advisory_xact_lock(
    hashtextextended(NEW.project_id::text, 0)
  );

  IF NEW.is_active AND EXISTS (
    WITH RECURSIVE reachable(activity_id) AS (
      SELECT NEW.successor_activity_id
      UNION
      SELECT d.successor_activity_id
      FROM activity_dependencies d
      JOIN reachable r
        ON d.predecessor_activity_id = r.activity_id
      JOIN activities predecessor
        ON predecessor.id = d.predecessor_activity_id
       AND predecessor.is_active = true
      JOIN activities successor
        ON successor.id = d.successor_activity_id
       AND successor.is_active = true
      WHERE d.project_id = NEW.project_id
        AND d.is_active = true
        AND d.id <> NEW.id
    )
    SELECT 1
    FROM reachable
    WHERE activity_id = NEW.predecessor_activity_id
  ) THEN
    RAISE EXCEPTION 'Activity dependencies cannot contain a circular dependency';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER activity_dependency_cycle
BEFORE INSERT OR UPDATE OF
  project_id, predecessor_activity_id, successor_activity_id, is_active
ON activity_dependencies
FOR EACH ROW EXECUTE FUNCTION enforce_activity_dependency_cycle();
