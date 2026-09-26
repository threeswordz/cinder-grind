ALTER TABLE "activities"
ADD CONSTRAINT "activities_milestone_schedule_check"
CHECK (
  NOT "is_milestone"
  OR (
    "planned_duration_work_days" = 0
    AND "planned_start_date" = "planned_finish_date"
  )
);

CREATE OR REPLACE FUNCTION enforce_activity_dependency_cycle()
RETURNS trigger AS $$
BEGIN
  IF NEW.is_active AND EXISTS (
    WITH RECURSIVE reachable(activity_id) AS (
      SELECT NEW.successor_activity_id
      UNION
      SELECT d.successor_activity_id
      FROM activity_dependencies d
      JOIN reachable r ON d.predecessor_activity_id = r.activity_id
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
