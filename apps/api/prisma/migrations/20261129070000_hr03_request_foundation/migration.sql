-- HR03 raw requests only. Canonical ApprovalInstance is the decision authority.
-- No configured workflow, entitlement, payroll, real grant or request data seeded.
CREATE TABLE hr_work_requests (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, employee_id uuid NOT NULL,
 kind varchar(10) NOT NULL CHECK(kind IN ('LEAVE','OVERTIME')),
 current_version integer NOT NULL DEFAULT 0 CHECK(current_version>=0),
 created_at timestamptz(6) NOT NULL DEFAULT now(),
 CONSTRAINT hr_work_requests_company_id_employee_id_fkey FOREIGN KEY(company_id,employee_id) REFERENCES employees(company_id,id) ON DELETE RESTRICT ON UPDATE RESTRICT
);
CREATE UNIQUE INDEX hr_work_requests_company_id_id_key ON hr_work_requests(company_id,id);
CREATE INDEX hr_work_requests_company_id_employee_id_idx ON hr_work_requests(company_id,employee_id);
CREATE TABLE hr_work_request_revisions (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, request_id uuid NOT NULL, version integer NOT NULL CHECK(version>0),
 operation varchar(12) NOT NULL CHECK(operation IN ('REQUEST','CORRECTION','CANCELLATION')),
 employment_revision_id uuid NOT NULL, project_id uuid, maker_user_id uuid NOT NULL, approval_instance_id uuid NOT NULL,
 leave_type varchar(50), reason varchar(1000) NOT NULL CHECK(length(btrim(reason))>0),
 created_at timestamptz(6) NOT NULL DEFAULT now(),
 CONSTRAINT hr_work_request_revisions_request_fkey FOREIGN KEY(company_id,request_id) REFERENCES hr_work_requests(company_id,id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT hr_work_request_revisions_employment_fkey FOREIGN KEY(employment_revision_id) REFERENCES hr_employment_revisions(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT hr_work_request_revisions_project_fkey FOREIGN KEY(company_id,project_id) REFERENCES projects(company_id,id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT hr_work_request_revisions_maker_fkey FOREIGN KEY(company_id,maker_user_id) REFERENCES users(company_id,id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CONSTRAINT hr_work_request_revisions_approval_instance_id_fkey FOREIGN KEY(approval_instance_id) REFERENCES approval_instances(id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CHECK(leave_type IS NULL OR length(btrim(leave_type))>0)
);
CREATE UNIQUE INDEX hr_work_request_revisions_approval_instance_id_key ON hr_work_request_revisions(approval_instance_id);
CREATE UNIQUE INDEX hr_work_request_revisions_request_id_version_key ON hr_work_request_revisions(request_id,version);
CREATE UNIQUE INDEX hr_work_request_revisions_company_id_id_key ON hr_work_request_revisions(company_id,id);
CREATE TABLE hr_work_request_days (
 id uuid PRIMARY KEY, company_id uuid NOT NULL, revision_id uuid NOT NULL,
 work_date date NOT NULL, leave_portion varchar(10), requested_overtime_minutes integer,
 CONSTRAINT hr_work_request_days_revision_fkey FOREIGN KEY(company_id,revision_id) REFERENCES hr_work_request_revisions(company_id,id) ON DELETE RESTRICT ON UPDATE RESTRICT,
 CHECK((leave_portion IS NOT NULL AND leave_portion IN ('FULL_DAY','HALF_AM','HALF_PM') AND requested_overtime_minutes IS NULL)
 OR (leave_portion IS NULL AND requested_overtime_minutes IS NOT NULL AND requested_overtime_minutes BETWEEN 1 AND 1440))
);
CREATE UNIQUE INDEX hr_work_request_days_revision_id_work_date_key ON hr_work_request_days(revision_id,work_date);

CREATE FUNCTION hr_work_request_revision_guard() RETURNS trigger LANGUAGE plpgsql AS $hr03$
DECLARE parent hr_work_requests%ROWTYPE; prior_state text; prior_operation text; 
BEGIN
 SELECT * INTO parent FROM hr_work_requests WHERE id=NEW.request_id AND company_id=NEW.company_id FOR UPDATE;
 IF NOT FOUND OR NEW.version<>parent.current_version+1 THEN RAISE EXCEPTION 'HR_REQUEST_VERSION' USING ERRCODE='23514'; END IF;
 IF (parent.kind='LEAVE' AND NEW.leave_type IS NULL) OR (parent.kind='OVERTIME' AND NEW.leave_type IS NOT NULL)
 THEN RAISE EXCEPTION 'HR_REQUEST_KIND' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM hr_employment_revisions er JOIN hr_employments e ON e.id=er.employment_id AND e.company_id=er.company_id
  WHERE er.id=NEW.employment_revision_id AND er.company_id=NEW.company_id AND e.employee_id=parent.employee_id
  AND ((er.site_kind='OFFICE' AND NEW.project_id IS NULL) OR (er.site_kind='SITE' AND NEW.project_id IS NOT NULL))
 ) THEN RAISE EXCEPTION 'HR_REQUEST_EMPLOYMENT_SCOPE' USING ERRCODE='23514'; END IF;
 IF NOT EXISTS(
  SELECT 1 FROM approval_instances ai JOIN approval_workflows aw ON aw.id=ai.approval_workflow_id
  WHERE ai.id=NEW.approval_instance_id AND ai.company_id=NEW.company_id AND aw.company_id=NEW.company_id
   AND ai.entity_type='HR_WORK_REQUEST_REVISION' AND aw.entity_type=ai.entity_type
   AND ai.entity_id=NEW.id AND ai.approval_state='SUBMITTED'
 ) THEN RAISE EXCEPTION 'HR_REQUEST_APPROVAL_BINDING' USING ERRCODE='23514'; END IF;
 IF parent.current_version=0 THEN
  IF NEW.operation<>'REQUEST' THEN RAISE EXCEPTION 'HR_REQUEST_OPERATION' USING ERRCODE='23514'; END IF;
 ELSE
  SELECT ai.approval_state, r.operation INTO prior_state,prior_operation
  FROM hr_work_request_revisions r JOIN approval_instances ai ON ai.id=r.approval_instance_id
  WHERE r.request_id=parent.id AND r.version=parent.current_version;
  IF NOT FOUND OR NEW.operation='REQUEST' OR prior_state NOT IN ('APPROVED','REJECTED','CANCELLED')
   OR (prior_state='APPROVED' AND prior_operation='CANCELLATION')
   OR (NEW.operation='CANCELLATION' AND prior_state<>'APPROVED')
  THEN RAISE EXCEPTION 'HR_REQUEST_OPERATION' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NEW;
END $hr03$;
CREATE TRIGGER hr_work_request_revision_guard BEFORE INSERT ON hr_work_request_revisions FOR EACH ROW EXECUTE FUNCTION hr_work_request_revision_guard();
CREATE TRIGGER hr_work_request_revision_immutable BEFORE UPDATE OR DELETE ON hr_work_request_revisions FOR EACH ROW EXECUTE FUNCTION hr_history_immutable();
CREATE TRIGGER hr_work_request_day_immutable BEFORE UPDATE OR DELETE ON hr_work_request_days FOR EACH ROW EXECUTE FUNCTION hr_history_immutable();

CREATE FUNCTION hr_work_request_day_guard() RETURNS trigger LANGUAGE plpgsql AS $hr03$
DECLARE v integer; rv integer; k text; start_day date; end_day date;
BEGIN
 SELECT p.current_version,r.version,p.kind,er.start_date,er.end_date INTO v,rv,k,start_day,end_day
 FROM hr_work_request_revisions r JOIN hr_work_requests p ON p.id=r.request_id
 JOIN hr_employment_revisions er ON er.id=r.employment_revision_id
 WHERE r.id=NEW.revision_id AND r.company_id=NEW.company_id FOR UPDATE OF p;
 IF NOT FOUND OR rv<>v+1 OR NEW.work_date<start_day OR (end_day IS NOT NULL AND NEW.work_date>end_day)
 OR (k='LEAVE' AND NEW.leave_portion IS NULL) OR (k='OVERTIME' AND NEW.requested_overtime_minutes IS NULL)
 THEN RAISE EXCEPTION 'HR_REQUEST_DAY_SCOPE' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $hr03$;
CREATE TRIGGER hr_work_request_day_guard BEFORE INSERT ON hr_work_request_days FOR EACH ROW EXECUTE FUNCTION hr_work_request_day_guard();

CREATE FUNCTION hr_work_request_guard() RETURNS trigger LANGUAGE plpgsql AS $hr03$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'HR_HISTORY_IMMUTABLE' USING ERRCODE='23514'; END IF;
 IF NEW.current_version<>OLD.current_version+1
 OR (to_jsonb(NEW)-'current_version') IS DISTINCT FROM (to_jsonb(OLD)-'current_version')
 OR NOT EXISTS(SELECT 1 FROM hr_work_request_revisions WHERE request_id=OLD.id AND version=NEW.current_version)
 THEN RAISE EXCEPTION 'HR_REQUEST_VERSION' USING ERRCODE='23514'; END IF;
 RETURN NEW;
END $hr03$;
CREATE TRIGGER hr_work_request_guard BEFORE UPDATE OR DELETE ON hr_work_requests FOR EACH ROW EXECUTE FUNCTION hr_work_request_guard();

CREATE FUNCTION hr_work_request_complete() RETURNS trigger LANGUAGE plpgsql AS $hr03$
DECLARE pid uuid; v integer; last_v integer; prev_id uuid;
BEGIN
 IF TG_TABLE_NAME='hr_work_requests' THEN pid:=NEW.id; ELSE pid:=NEW.request_id; END IF;
 SELECT current_version INTO v FROM hr_work_requests WHERE id=pid;
 SELECT coalesce(max(version),0) INTO last_v FROM hr_work_request_revisions WHERE request_id=pid;
 IF v<1 OR v<>last_v THEN RAISE EXCEPTION 'HR_REQUEST_INCOMPLETE' USING ERRCODE='23514'; END IF;
 IF TG_TABLE_NAME='hr_work_requests' THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM hr_work_request_days WHERE revision_id=NEW.id)
 THEN RAISE EXCEPTION 'HR_REQUEST_EMPTY' USING ERRCODE='23514'; END IF;
 IF NEW.operation='CANCELLATION' THEN
  SELECT id INTO prev_id FROM hr_work_request_revisions WHERE request_id=pid AND version=NEW.version-1;
  IF EXISTS(
    (SELECT work_date,leave_portion,requested_overtime_minutes FROM hr_work_request_days WHERE revision_id=NEW.id
     EXCEPT ALL SELECT work_date,leave_portion,requested_overtime_minutes FROM hr_work_request_days WHERE revision_id=prev_id)
    UNION ALL
    (SELECT work_date,leave_portion,requested_overtime_minutes FROM hr_work_request_days WHERE revision_id=prev_id
     EXCEPT ALL SELECT work_date,leave_portion,requested_overtime_minutes FROM hr_work_request_days WHERE revision_id=NEW.id)
  ) OR NOT EXISTS(SELECT 1 FROM hr_work_request_revisions p WHERE p.id=prev_id
    AND p.employment_revision_id=NEW.employment_revision_id AND p.project_id IS NOT DISTINCT FROM NEW.project_id
    AND p.leave_type IS NOT DISTINCT FROM NEW.leave_type)
  THEN RAISE EXCEPTION 'HR_REQUEST_CANCELLATION_CHANGED_FACTS' USING ERRCODE='23514'; END IF;
 END IF;
 RETURN NULL;
END $hr03$;
CREATE CONSTRAINT TRIGGER hr_work_request_complete AFTER INSERT OR UPDATE ON hr_work_requests DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hr_work_request_complete();
CREATE CONSTRAINT TRIGGER hr_work_request_revision_complete AFTER INSERT ON hr_work_request_revisions DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION hr_work_request_complete();
