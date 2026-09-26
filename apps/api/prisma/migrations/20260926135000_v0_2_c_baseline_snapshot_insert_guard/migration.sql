CREATE OR REPLACE FUNCTION prevent_submitted_baseline_activity_insert()
RETURNS trigger AS $$
BEGIN
  IF EXISTS (
    SELECT 1
    FROM schedule_baselines b
    WHERE b.id = NEW.schedule_baseline_id
      AND b.approval_instance_id IS NOT NULL
  ) THEN
    RAISE EXCEPTION 'Submitted Schedule Baseline Activity snapshots are immutable';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER schedule_baseline_activity_insert_guard
BEFORE INSERT ON schedule_baseline_activities
FOR EACH ROW EXECUTE FUNCTION prevent_submitted_baseline_activity_insert();
