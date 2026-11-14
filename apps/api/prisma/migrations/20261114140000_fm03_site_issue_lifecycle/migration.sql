-- CreateTable
CREATE TABLE "site_issue_routings" (
    "project_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "escalation_user_id" UUID NOT NULL,
    "updated_by_user_id" UUID NOT NULL,
    "version" INTEGER NOT NULL DEFAULT 1,
    "last_request_key" UUID NOT NULL,
    "last_body_digest" VARCHAR(64) NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "site_issue_routings_pkey" PRIMARY KEY ("project_id")
);

-- CreateTable
CREATE TABLE "site_issues" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "report_id" UUID,
    "activity_id" UUID,
    "reporter_user_id" UUID NOT NULL,
    "owner_user_id" UUID NOT NULL,
    "escalation_user_id" UUID NOT NULL,
    "description" TEXT NOT NULL,
    "category" VARCHAR(30) NOT NULL,
    "affects_cost_or_delivery" BOOLEAN NOT NULL,
    "work_stopped" BOOLEAN NOT NULL,
    "delivery_delay_risk" BOOLEAN NOT NULL,
    "status" VARCHAR(30) NOT NULL DEFAULT 'OPEN',
    "version" INTEGER NOT NULL DEFAULT 1,
    "asset_severity" VARCHAR(20),
    "escalated_at" TIMESTAMPTZ(6),
    "verified_at" TIMESTAMPTZ(6),
    "closed_at" TIMESTAMPTZ(6),
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "site_issues_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "site_issue_events" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "issue_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "request_key" UUID NOT NULL,
    "body_digest" VARCHAR(64) NOT NULL,
    "version" INTEGER NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "status" VARCHAR(30) NOT NULL,
    "note" TEXT NOT NULL,
    "facts" JSONB NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "site_issue_events_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "site_issue_routings_company_id_project_id_key" ON "site_issue_routings"("company_id", "project_id");

-- CreateIndex
CREATE INDEX "site_issues_company_id_project_id_status_id_idx" ON "site_issues"("company_id", "project_id", "status", "id");

-- CreateIndex
CREATE INDEX "site_issues_company_id_escalation_user_id_escalated_at_idx" ON "site_issues"("company_id", "escalation_user_id", "escalated_at");

-- CreateIndex
CREATE UNIQUE INDEX "site_issues_company_id_id_key" ON "site_issues"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "site_issue_events_company_id_actor_user_id_request_key_key" ON "site_issue_events"("company_id", "actor_user_id", "request_key");

-- CreateIndex
CREATE UNIQUE INDEX "site_issue_events_issue_id_version_key" ON "site_issue_events"("issue_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "activities_company_id_project_id_id_key" ON "activities"("company_id", "project_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "daily_site_reports_company_id_project_id_id_key" ON "daily_site_reports"("company_id", "project_id", "id");

-- AddForeignKey
ALTER TABLE "site_issue_routings" ADD CONSTRAINT "site_issue_routings_company_id_project_id_fkey" FOREIGN KEY ("company_id", "project_id") REFERENCES "projects"("company_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "site_issue_routings" ADD CONSTRAINT "site_issue_routings_company_id_owner_user_id_fkey" FOREIGN KEY ("company_id", "owner_user_id") REFERENCES "users"("company_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "site_issue_routings" ADD CONSTRAINT "site_issue_routings_company_id_escalation_user_id_fkey" FOREIGN KEY ("company_id", "escalation_user_id") REFERENCES "users"("company_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "site_issue_routings" ADD CONSTRAINT "site_issue_routings_company_id_updated_by_user_id_fkey" FOREIGN KEY ("company_id", "updated_by_user_id") REFERENCES "users"("company_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "site_issues" ADD CONSTRAINT "site_issues_company_id_project_id_fkey" FOREIGN KEY ("company_id", "project_id") REFERENCES "projects"("company_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "site_issues" ADD CONSTRAINT "site_issues_company_id_project_id_report_id_fkey" FOREIGN KEY ("company_id", "project_id", "report_id") REFERENCES "daily_site_reports"("company_id", "project_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "site_issues" ADD CONSTRAINT "site_issues_company_id_project_id_activity_id_fkey" FOREIGN KEY ("company_id", "project_id", "activity_id") REFERENCES "activities"("company_id", "project_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "site_issues" ADD CONSTRAINT "site_issues_company_id_reporter_user_id_fkey" FOREIGN KEY ("company_id", "reporter_user_id") REFERENCES "users"("company_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "site_issues" ADD CONSTRAINT "site_issues_company_id_owner_user_id_fkey" FOREIGN KEY ("company_id", "owner_user_id") REFERENCES "users"("company_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "site_issues" ADD CONSTRAINT "site_issues_company_id_escalation_user_id_fkey" FOREIGN KEY ("company_id", "escalation_user_id") REFERENCES "users"("company_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "site_issue_events" ADD CONSTRAINT "site_issue_events_company_id_issue_id_fkey" FOREIGN KEY ("company_id", "issue_id") REFERENCES "site_issues"("company_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "site_issue_events" ADD CONSTRAINT "site_issue_events_company_id_actor_user_id_fkey" FOREIGN KEY ("company_id", "actor_user_id") REFERENCES "users"("company_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Catalogue only. No existing role, user, Project, approval or business row is changed.
INSERT INTO permissions (id, permission_code, module_code, description) VALUES
('d1141400-0000-4000-8000-000000000001','site.issue.view','SITE','View site issues within effective Project scope'),
('d1141400-0000-4000-8000-000000000002','site.issue.report','SITE','Report site issues within effective Project scope'),
('d1141400-0000-4000-8000-000000000003','site.issue.follow_up','SITE','Record assigned site issue follow-up and asset severity assessment'),
('d1141400-0000-4000-8000-000000000004','site.issue.verify','SITE','Verify resolution of own reported site issues'),
('d1141400-0000-4000-8000-000000000005','site.issue.close','SITE','Close assigned site issues after successful reporter verification'),
('d1141400-0000-4000-8000-000000000006','site.issue.escalation.view','SITE','Read site issue escalations addressed to the assigned recipient'),
('d1141400-0000-4000-8000-000000000007','site.issue.routing.manage','SITE','Configure explicit Project site issue owner and escalation recipient');

ALTER TABLE site_issue_routings ADD CONSTRAINT site_issue_routing_values CHECK (
  version > 0 AND owner_user_id <> escalation_user_id AND last_body_digest ~ '^[a-f0-9]{64}$'
);
ALTER TABLE site_issues ADD CONSTRAINT site_issue_values CHECK (
  version > 0 AND length(btrim(description)) BETWEEN 1 AND 10000
  AND category IN ('GENERAL','SAFETY','QUALITY','ASSET_LOSS_DAMAGE')
  AND status IN ('OPEN','AWAITING_VERIFICATION','VERIFIED','CLOSED')
  AND reporter_user_id <> owner_user_id AND reporter_user_id <> escalation_user_id AND owner_user_id <> escalation_user_id
  AND (asset_severity IS NULL OR (category='ASSET_LOSS_DAMAGE' AND asset_severity IN ('SEVERE','NOT_SEVERE')))
  AND (NOT (work_stopped OR delivery_delay_risk OR (category IN ('SAFETY','QUALITY') AND affects_cost_or_delivery))
    OR escalated_at IS NOT NULL)
  AND (asset_severity IS DISTINCT FROM 'SEVERE' OR escalated_at IS NOT NULL)
  AND (escalated_at IS NULL OR work_stopped OR delivery_delay_risk
    OR (category IN ('SAFETY','QUALITY') AND affects_cost_or_delivery) OR category='ASSET_LOSS_DAMAGE')
  AND ((status IN ('OPEN','AWAITING_VERIFICATION') AND verified_at IS NULL AND closed_at IS NULL)
    OR (status='VERIFIED' AND verified_at IS NOT NULL AND closed_at IS NULL)
    OR (status='CLOSED' AND verified_at IS NOT NULL AND closed_at IS NOT NULL AND closed_at >= verified_at))
);
ALTER TABLE site_issue_events ADD CONSTRAINT site_issue_event_values CHECK (
  version > 0 AND body_digest ~ '^[a-f0-9]{64}$' AND length(btrim(note)) BETWEEN 1 AND 10000
  AND action IN ('REPORT','FOLLOW_UP','VERIFY','CLOSE')
  AND status IN ('OPEN','AWAITING_VERIFICATION','VERIFIED','CLOSED')
  AND jsonb_typeof(facts)='object'
);

CREATE FUNCTION erp_site_issue_snapshot(issue_uuid uuid) RETURNS jsonb
LANGUAGE sql STABLE AS $$
  SELECT to_jsonb(i) FROM site_issues i WHERE i.id=issue_uuid;
$$;

CREATE FUNCTION erp_site_issue_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE mandatory_escalation boolean;
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Site issue history cannot be deleted' USING ERRCODE='23514'; END IF;
  mandatory_escalation := NEW.work_stopped OR NEW.delivery_delay_risk
    OR (NEW.category IN ('SAFETY','QUALITY') AND NEW.affects_cost_or_delivery);
  IF TG_OP='INSERT' THEN
    IF NEW.version<>1 OR NEW.status<>'OPEN' OR NEW.asset_severity IS NOT NULL
      OR (NEW.escalated_at IS NOT NULL)<>mandatory_escalation THEN
      RAISE EXCEPTION 'Invalid initial site issue state' USING ERRCODE='23514';
    END IF;
  ELSE
    IF OLD.status='CLOSED' OR NEW.version<>OLD.version+1
      OR (to_jsonb(NEW)-ARRAY['status','version','asset_severity','escalated_at','verified_at','closed_at','updated_at'])
        IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['status','version','asset_severity','escalated_at','verified_at','closed_at','updated_at'])
      OR NOT ((OLD.status='OPEN' AND NEW.status='AWAITING_VERIFICATION')
        OR (OLD.status='AWAITING_VERIFICATION' AND NEW.status IN ('OPEN','VERIFIED'))
        OR (OLD.status='VERIFIED' AND NEW.status='CLOSED')) THEN
      RAISE EXCEPTION 'Invalid site issue transition or immutable fact change' USING ERRCODE='23514';
    END IF;
    IF OLD.escalated_at IS NOT NULL AND NEW.escalated_at IS DISTINCT FROM OLD.escalated_at THEN
      RAISE EXCEPTION 'An escalation cannot be erased or replaced' USING ERRCODE='23514';
    END IF;
    IF OLD.status='OPEN' THEN
      IF NEW.category='ASSET_LOSS_DAMAGE' AND NEW.asset_severity IS NULL THEN
        RAISE EXCEPTION 'Asset severity assessment required with follow-up' USING ERRCODE='23514';
      END IF;
      IF OLD.escalated_at IS NULL AND NEW.escalated_at IS NOT NULL AND NEW.asset_severity IS DISTINCT FROM 'SEVERE' THEN
        RAISE EXCEPTION 'Unjustified follow-up escalation' USING ERRCODE='23514';
      END IF;
    ELSIF NEW.asset_severity IS DISTINCT FROM OLD.asset_severity OR NEW.escalated_at IS DISTINCT FROM OLD.escalated_at THEN
      RAISE EXCEPTION 'Severity changes belong to owner follow-up' USING ERRCODE='23514';
    END IF;
    IF OLD.status='VERIFIED' AND NEW.verified_at IS DISTINCT FROM OLD.verified_at THEN
      RAISE EXCEPTION 'Reporter verification cannot be replaced' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER site_issue_guard BEFORE INSERT OR UPDATE OR DELETE ON site_issues
FOR EACH ROW EXECUTE FUNCTION erp_site_issue_guard();

CREATE FUNCTION erp_site_issue_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE issue_row site_issues%ROWTYPE; previous_event site_issue_events%ROWTYPE;
BEGIN
  IF TG_OP<>'INSERT' THEN RAISE EXCEPTION 'Site issue events are immutable' USING ERRCODE='23514'; END IF;
  SELECT * INTO issue_row FROM site_issues WHERE id=NEW.issue_id AND company_id=NEW.company_id FOR UPDATE;
  IF NOT FOUND OR NEW.version<>issue_row.version OR NEW.status<>issue_row.status
    OR NEW.facts IS DISTINCT FROM erp_site_issue_snapshot(NEW.issue_id) THEN
    RAISE EXCEPTION 'Site issue event must exactly snapshot the current state' USING ERRCODE='23514';
  END IF;
  SELECT * INTO previous_event FROM site_issue_events WHERE issue_id=NEW.issue_id ORDER BY version DESC LIMIT 1;
  IF NEW.version=1 THEN
    IF FOUND OR NEW.action<>'REPORT' OR NEW.actor_user_id<>issue_row.reporter_user_id THEN
      RAISE EXCEPTION 'Initial site issue report actor invalid' USING ERRCODE='23514';
    END IF;
  ELSE
    IF NOT FOUND OR previous_event.version<>NEW.version-1 OR NOT (
      (NEW.action='FOLLOW_UP' AND NEW.actor_user_id=issue_row.owner_user_id
        AND previous_event.status='OPEN' AND NEW.status='AWAITING_VERIFICATION')
      OR (NEW.action='VERIFY' AND NEW.actor_user_id=issue_row.reporter_user_id
        AND previous_event.status='AWAITING_VERIFICATION' AND NEW.status IN ('OPEN','VERIFIED'))
      OR (NEW.action='CLOSE' AND NEW.actor_user_id=issue_row.owner_user_id
        AND previous_event.status='VERIFIED' AND NEW.status='CLOSED')) THEN
      RAISE EXCEPTION 'Site issue event actor or lifecycle sequence invalid' USING ERRCODE='23514';
    END IF;
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER site_issue_event_guard BEFORE INSERT OR UPDATE OR DELETE ON site_issue_events
FOR EACH ROW EXECUTE FUNCTION erp_site_issue_event_guard();

CREATE FUNCTION erp_site_issue_complete() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE issue_uuid uuid; current_row site_issues%ROWTYPE;
BEGIN
  IF TG_TABLE_NAME='site_issue_events' THEN issue_uuid:=NEW.issue_id; ELSE issue_uuid:=NEW.id; END IF;
  SELECT * INTO current_row FROM site_issues WHERE id=issue_uuid;
  IF NOT FOUND OR NOT EXISTS (SELECT 1 FROM site_issue_events e WHERE e.issue_id=issue_uuid
    AND e.version=current_row.version AND e.status=current_row.status AND e.facts=erp_site_issue_snapshot(issue_uuid)) THEN
    RAISE EXCEPTION 'Site issue state requires its immutable matching event' USING ERRCODE='23514';
  END IF;
  RETURN NULL;
END;
$$;
CREATE CONSTRAINT TRIGGER site_issue_complete AFTER INSERT OR UPDATE ON site_issues
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_site_issue_complete();
CREATE CONSTRAINT TRIGGER site_issue_event_complete AFTER INSERT ON site_issue_events
DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_site_issue_complete();

CREATE FUNCTION erp_site_issue_routing_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
  IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Site issue routing cannot be deleted' USING ERRCODE='23514'; END IF;
  IF TG_OP='INSERT' THEN
    IF NEW.version<>1 THEN RAISE EXCEPTION 'Initial routing version invalid' USING ERRCODE='23514'; END IF;
  ELSIF NEW.version<>OLD.version+1 OR NEW.last_request_key=OLD.last_request_key
    OR (NEW.company_id,NEW.project_id,NEW.created_at) IS DISTINCT FROM (OLD.company_id,OLD.project_id,OLD.created_at) THEN
    RAISE EXCEPTION 'Invalid routing revision' USING ERRCODE='23514';
  END IF;
  RETURN NEW;
END;
$$;
CREATE TRIGGER site_issue_routing_guard BEFORE INSERT OR UPDATE OR DELETE ON site_issue_routings
FOR EACH ROW EXECUTE FUNCTION erp_site_issue_routing_guard();
