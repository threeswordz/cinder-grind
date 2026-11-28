-- HR-02 additive site-period snapshots. No new role grants, payroll or Finance posting.
CREATE TABLE hr_attendance_batches (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, project_id uuid NOT NULL,
 period_start date NOT NULL, current_version integer NOT NULL DEFAULT 0,
 created_at timestamptz(6) NOT NULL DEFAULT now(),
 CONSTRAINT hr_attendance_batches_period CHECK (extract(day from period_start) IN (1,16)),
 CONSTRAINT hr_attendance_batches_version CHECK (current_version >= 0),
 CONSTRAINT hr_attendance_batches_company_id_project_id_fkey FOREIGN KEY (company_id,project_id) REFERENCES projects(company_id,id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX hr_attendance_batches_company_id_project_id_period_start_key ON hr_attendance_batches(company_id,project_id,period_start);
CREATE UNIQUE INDEX hr_attendance_batches_company_id_id_key ON hr_attendance_batches(company_id,id);
CREATE TABLE hr_attendance_revisions (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, batch_id uuid NOT NULL, version integer NOT NULL,
 state varchar(12) NOT NULL, action varchar(12) NOT NULL, actor_user_id uuid NOT NULL,
 reason varchar(1000), created_at timestamptz(6) NOT NULL DEFAULT now(),
 CONSTRAINT hr_attendance_revisions_batch_fkey FOREIGN KEY(company_id,batch_id) REFERENCES hr_attendance_batches(company_id,id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT hr_attendance_revisions_actor_fkey FOREIGN KEY(actor_user_id) REFERENCES users(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT hr_attendance_revisions_values CHECK (version>0 AND state IN ('DRAFT','SUBMITTED','RETURNED')
 AND action IN ('CREATE','EDIT','SUBMIT','RETURN','RESUBMIT')
 AND (reason IS NULL OR length(btrim(reason))>0)
 AND (action NOT IN ('EDIT','RETURN') OR reason IS NOT NULL))
);
CREATE UNIQUE INDEX hr_attendance_revisions_batch_id_version_key ON hr_attendance_revisions(batch_id,version);
CREATE UNIQUE INDEX hr_attendance_revisions_company_id_id_key ON hr_attendance_revisions(company_id,id);
CREATE TABLE hr_attendance_lines (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, revision_id uuid NOT NULL, employee_id uuid NOT NULL,
 employment_revision_id uuid NOT NULL, work_date date NOT NULL, start_minute integer NOT NULL, end_minute integer NOT NULL,
 work_type varchar(100) NOT NULL,
 CONSTRAINT hr_attendance_lines_revision_fkey FOREIGN KEY(company_id,revision_id) REFERENCES hr_attendance_revisions(company_id,id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT hr_attendance_lines_employee_fkey FOREIGN KEY(company_id,employee_id) REFERENCES employees(company_id,id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT hr_attendance_lines_employment_fkey FOREIGN KEY(employment_revision_id) REFERENCES hr_employment_revisions(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT hr_attendance_lines_values CHECK (start_minute>=0 AND end_minute<=1440 AND start_minute<end_minute AND length(btrim(work_type))>0)
);
CREATE UNIQUE INDEX hr_attendance_lines_interval_key ON hr_attendance_lines(revision_id,employee_id,work_date,start_minute,end_minute);
CREATE INDEX hr_attendance_lines_company_id_employee_id_work_date_idx ON hr_attendance_lines(company_id,employee_id,work_date);

CREATE FUNCTION hr_attendance_revision_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v integer; prev_state text;
BEGIN
 SELECT current_version INTO v FROM hr_attendance_batches WHERE id=NEW.batch_id AND company_id=NEW.company_id FOR UPDATE;
 IF NOT FOUND OR NEW.version<>v+1 THEN RAISE EXCEPTION 'HR_ATTENDANCE_VERSION' USING ERRCODE='23514'; END IF;
 IF v=0 THEN
  IF NEW.action<>'CREATE' OR NEW.state<>'DRAFT' THEN RAISE EXCEPTION 'HR_ATTENDANCE_TRANSITION' USING ERRCODE='23514'; END IF;
 ELSE
  SELECT state INTO prev_state FROM hr_attendance_revisions WHERE batch_id=NEW.batch_id AND version=v;
  IF NOT FOUND OR NOT (
    (prev_state IN ('DRAFT','RETURNED') AND NEW.action='EDIT' AND NEW.state=prev_state)
    OR (prev_state='DRAFT' AND NEW.action='SUBMIT' AND NEW.state='SUBMITTED')
    OR (prev_state='SUBMITTED' AND NEW.action='RETURN' AND NEW.state='RETURNED')
    OR (prev_state='RETURNED' AND NEW.action='RESUBMIT' AND NEW.state='SUBMITTED')
  ) THEN RAISE EXCEPTION 'HR_ATTENDANCE_TRANSITION' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER hr_attendance_revision_guard BEFORE INSERT ON hr_attendance_revisions FOR EACH ROW EXECUTE FUNCTION hr_attendance_revision_guard();
CREATE TRIGGER hr_attendance_revision_immutable BEFORE UPDATE OR DELETE ON hr_attendance_revisions FOR EACH ROW EXECUTE FUNCTION hr_history_immutable();
CREATE TRIGGER hr_attendance_line_immutable BEFORE UPDATE OR DELETE ON hr_attendance_lines FOR EACH ROW EXECUTE FUNCTION hr_history_immutable();

CREATE FUNCTION hr_attendance_line_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE v integer; rv integer; first_day date; last_day date;
BEGIN
 SELECT b.current_version,r.version,b.period_start INTO v,rv,first_day
 FROM hr_attendance_revisions r JOIN hr_attendance_batches b ON b.id=r.batch_id
 WHERE r.id=NEW.revision_id AND r.company_id=NEW.company_id FOR UPDATE OF b;
 IF NOT FOUND OR rv<>v+1 THEN RAISE EXCEPTION 'HR_ATTENDANCE_SNAPSHOT_SEALED' USING ERRCODE='23514'; END IF;
 last_day:=CASE WHEN extract(day from first_day)=1 THEN first_day+14 ELSE (date_trunc('month',first_day)+interval '1 month -1 day')::date END;
 IF NEW.work_date NOT BETWEEN first_day AND last_day OR NOT EXISTS (
 SELECT 1 FROM hr_employment_revisions er JOIN hr_employments e ON e.id=er.employment_id AND e.company_id=er.company_id
 WHERE er.id=NEW.employment_revision_id AND er.company_id=NEW.company_id AND e.employee_id=NEW.employee_id
 AND NEW.work_date>=er.start_date AND (er.end_date IS NULL OR NEW.work_date<=er.end_date)
 ) THEN RAISE EXCEPTION 'HR_ATTENDANCE_EMPLOYMENT_PERIOD' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER hr_attendance_line_guard BEFORE INSERT ON hr_attendance_lines FOR EACH ROW EXECUTE FUNCTION hr_attendance_line_guard();

CREATE FUNCTION hr_attendance_batch_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'HR_HISTORY_IMMUTABLE' USING ERRCODE='23514'; END IF;
 IF NEW.id IS DISTINCT FROM OLD.id OR NEW.company_id IS DISTINCT FROM OLD.company_id OR NEW.project_id IS DISTINCT FROM OLD.project_id
 OR NEW.period_start IS DISTINCT FROM OLD.period_start OR NEW.created_at IS DISTINCT FROM OLD.created_at
 OR NEW.current_version<>OLD.current_version+1 OR NOT EXISTS (
 SELECT 1 FROM hr_attendance_revisions WHERE batch_id=OLD.id AND version=NEW.current_version
 ) THEN RAISE EXCEPTION 'HR_ATTENDANCE_VERSION' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER hr_attendance_batch_guard BEFORE UPDATE OR DELETE ON hr_attendance_batches FOR EACH ROW EXECUTE FUNCTION hr_attendance_batch_guard();

-- Check both parent and revision insertions at commit, including a dangling revision without a pointer update.
CREATE FUNCTION hr_attendance_complete_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE bid uuid; v integer; last_v integer; rid uuid; prev_id uuid; act text;
BEGIN
 IF TG_TABLE_NAME='hr_attendance_batches' THEN bid:=NEW.id; ELSE bid:=NEW.batch_id; END IF;
 SELECT current_version INTO v FROM hr_attendance_batches WHERE id=bid;
 SELECT coalesce(max(version),0) INTO last_v FROM hr_attendance_revisions WHERE batch_id=bid;
 IF v<1 OR v<>last_v THEN RAISE EXCEPTION 'HR_ATTENDANCE_INCOMPLETE' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='hr_attendance_batches' THEN RETURN NULL; END IF;
 rid:=NEW.id; act:=NEW.action;
 IF act IN ('SUBMIT','RETURN','RESUBMIT') THEN
  SELECT id INTO prev_id FROM hr_attendance_revisions WHERE batch_id=bid AND version=NEW.version-1;
  IF EXISTS (
   (SELECT employee_id,employment_revision_id,work_date,start_minute,end_minute,work_type FROM hr_attendance_lines WHERE revision_id=rid
    EXCEPT ALL SELECT employee_id,employment_revision_id,work_date,start_minute,end_minute,work_type FROM hr_attendance_lines WHERE revision_id=prev_id)
   UNION ALL
   (SELECT employee_id,employment_revision_id,work_date,start_minute,end_minute,work_type FROM hr_attendance_lines WHERE revision_id=prev_id
    EXCEPT ALL SELECT employee_id,employment_revision_id,work_date,start_minute,end_minute,work_type FROM hr_attendance_lines WHERE revision_id=rid)
  ) THEN RAISE EXCEPTION 'HR_ATTENDANCE_TRANSITION_CHANGED_LINES' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER hr_attendance_batch_complete AFTER INSERT OR UPDATE ON hr_attendance_batches DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hr_attendance_complete_guard();
CREATE CONSTRAINT TRIGGER hr_attendance_revision_complete AFTER INSERT ON hr_attendance_revisions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hr_attendance_complete_guard();

-- Definitions only: no role_permissions, HR Company access or live grants.
INSERT INTO permissions(id,permission_code,module_code,description)
SELECT ('b0295000-0000-4000-8000-' || lpad(n::text,12,'0'))::uuid, code, 'HR', description
FROM (VALUES
 (1,'hr.attendance.site.view','Read attendance within assigned site scope'),
 (2,'hr.attendance.site.manage','Capture and submit attendance within assigned site scope'),
 (3,'hr.attendance.review','Review or return attendance within explicitly authorized HR Company scope')
) AS capability(n,code,description) ON CONFLICT(permission_code) DO NOTHING;
