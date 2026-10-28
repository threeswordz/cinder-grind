-- CreateTable
CREATE TABLE "customer_boq_versions" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "version_no" INTEGER NOT NULL,
    "source_revision_id" UUID NOT NULL,
    "previous_version_id" UUID,
    "currency_code" VARCHAR(3) NOT NULL,
    "current_edit_no" INTEGER NOT NULL,
    "approval_instance_id" UUID,
    "created_by_user_id" UUID NOT NULL,
    "submitted_by_user_id" UUID,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submitted_at" TIMESTAMPTZ(6),

    CONSTRAINT "customer_boq_versions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_boq_edits" (
    "id" UUID NOT NULL,
    "version_id" UUID NOT NULL,
    "edit_no" INTEGER NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "total_amount" DECIMAL(20,2) NOT NULL,
    "source_coverage" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_boq_edits_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_boq_lines" (
    "id" UUID NOT NULL,
    "edit_id" UUID NOT NULL,
    "line_key" UUID NOT NULL,
    "sort_order" INTEGER NOT NULL,
    "description" VARCHAR(500) NOT NULL,
    "quantity" DECIMAL(18,4) NOT NULL,
    "uom_id" UUID NOT NULL,
    "uom_snapshot" JSONB NOT NULL,
    "rate" DECIMAL(18,4) NOT NULL,
    "amount" DECIMAL(20,2) NOT NULL,
    "pricing_snapshot" JSONB NOT NULL,

    CONSTRAINT "customer_boq_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_boq_mappings" (
    "id" UUID NOT NULL,
    "line_id" UUID NOT NULL,
    "source_line_id" UUID NOT NULL,
    "share_percent" DECIMAL(7,4) NOT NULL,
    "allocated_cost" DECIMAL(26,10) NOT NULL,
    "source_snapshot" JSONB NOT NULL,

    CONSTRAINT "customer_boq_mappings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "customer_boq_replays" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "payload_hash" VARCHAR(64) NOT NULL,
    "receipt" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "customer_boq_replays_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "customer_boq_versions_approval_instance_id_key" ON "customer_boq_versions"("approval_instance_id");

-- CreateIndex
CREATE INDEX "customer_boq_versions_company_id_project_id_idx" ON "customer_boq_versions"("company_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_boq_versions_project_id_version_no_key" ON "customer_boq_versions"("project_id", "version_no");

-- CreateIndex
CREATE UNIQUE INDEX "customer_boq_edits_version_id_edit_no_key" ON "customer_boq_edits"("version_id", "edit_no");

-- CreateIndex
CREATE UNIQUE INDEX "customer_boq_lines_edit_id_line_key_key" ON "customer_boq_lines"("edit_id", "line_key");

-- CreateIndex
CREATE UNIQUE INDEX "customer_boq_mappings_line_id_source_line_id_key" ON "customer_boq_mappings"("line_id", "source_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "customer_boq_replays_company_id_actor_user_id_request_id_key" ON "customer_boq_replays"("company_id", "actor_user_id", "request_id");

-- AddForeignKey
ALTER TABLE "customer_boq_versions" ADD CONSTRAINT "customer_boq_versions_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_boq_versions" ADD CONSTRAINT "customer_boq_versions_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_boq_versions" ADD CONSTRAINT "customer_boq_versions_source_revision_id_fkey" FOREIGN KEY ("source_revision_id") REFERENCES "budget_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_boq_versions" ADD CONSTRAINT "customer_boq_versions_previous_version_id_fkey" FOREIGN KEY ("previous_version_id") REFERENCES "customer_boq_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_boq_versions" ADD CONSTRAINT "customer_boq_versions_approval_instance_id_fkey" FOREIGN KEY ("approval_instance_id") REFERENCES "approval_instances"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_boq_versions" ADD CONSTRAINT "customer_boq_versions_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_boq_versions" ADD CONSTRAINT "customer_boq_versions_submitted_by_user_id_fkey" FOREIGN KEY ("submitted_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_boq_edits" ADD CONSTRAINT "customer_boq_edits_version_id_fkey" FOREIGN KEY ("version_id") REFERENCES "customer_boq_versions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_boq_edits" ADD CONSTRAINT "customer_boq_edits_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_boq_lines" ADD CONSTRAINT "customer_boq_lines_edit_id_fkey" FOREIGN KEY ("edit_id") REFERENCES "customer_boq_edits"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_boq_lines" ADD CONSTRAINT "customer_boq_lines_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_boq_mappings" ADD CONSTRAINT "customer_boq_mappings_line_id_fkey" FOREIGN KEY ("line_id") REFERENCES "customer_boq_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_boq_mappings" ADD CONSTRAINT "customer_boq_mappings_source_line_id_fkey" FOREIGN KEY ("source_line_id") REFERENCES "budget_revision_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_boq_replays" ADD CONSTRAINT "customer_boq_replays_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "customer_boq_replays" ADD CONSTRAINT "customer_boq_replays_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- No grants, historical updates, financial postings or existing-trigger changes.
ALTER TABLE customer_boq_versions ADD CONSTRAINT customer_boq_version_positive CHECK (version_no > 0 AND current_edit_no > 0 AND currency_code = 'THB');
ALTER TABLE customer_boq_edits ADD CONSTRAINT customer_boq_edit_positive CHECK (edit_no > 0 AND total_amount >= 0 AND length(trim(reason)) > 0);
ALTER TABLE customer_boq_lines ADD CONSTRAINT customer_boq_line_values CHECK (quantity > 0 AND rate >= 0 AND amount >= 0);
ALTER TABLE customer_boq_mappings ADD CONSTRAINT customer_boq_mapping_values CHECK (share_percent > 0 AND share_percent <= 100 AND allocated_cost >= 0);
ALTER TABLE customer_boq_versions ADD CONSTRAINT customer_boq_current_edit_fk FOREIGN KEY (id, current_edit_no) REFERENCES customer_boq_edits(version_id, edit_no) DEFERRABLE INITIALLY DEFERRED;

CREATE FUNCTION erp_customer_boq_version_guard() RETURNS trigger AS $$
DECLARE source RECORD; prior RECORD; instance RECORD; actor_company UUID; project_company UUID; state TEXT;
BEGIN
  IF TG_OP = 'DELETE' THEN RAISE EXCEPTION 'Customer BOQ history cannot be deleted'; END IF;
  IF TG_OP = 'UPDATE' THEN
    SELECT approval_state INTO state FROM approval_instances WHERE id = OLD.approval_instance_id FOR SHARE;
    IF state IN ('SUBMITTED','APPROVED') THEN RAISE EXCEPTION 'Submitted/approved Customer BOQ is immutable'; END IF;
    IF (to_jsonb(NEW) - ARRAY['current_edit_no','approval_instance_id','submitted_by_user_id','submitted_at']) IS DISTINCT FROM
       (to_jsonb(OLD) - ARRAY['current_edit_no','approval_instance_id','submitted_by_user_id','submitted_at']) THEN
      RAISE EXCEPTION 'Customer BOQ source and identity are immutable';
    END IF;
    IF NEW.current_edit_no NOT IN (OLD.current_edit_no, OLD.current_edit_no + 1) THEN RAISE EXCEPTION 'Customer BOQ edit must append'; END IF;
  END IF;
  PERFORM erp_thb_require_company(NEW.company_id);
  PERFORM erp_thb_assert_source('projects', NEW.project_id);
  SELECT company_id INTO project_company FROM projects WHERE id = NEW.project_id;
  SELECT company_id INTO actor_company FROM users WHERE id = NEW.created_by_user_id;
  IF project_company IS DISTINCT FROM NEW.company_id OR actor_company IS DISTINCT FROM NEW.company_id THEN RAISE EXCEPTION 'Customer BOQ scope mismatch'; END IF;
  SELECT b.company_id, b.project_id, b.currency_code, a.approval_state INTO source FROM budget_revisions b
    LEFT JOIN approval_instances a ON a.id = b.approval_instance_id WHERE b.id = NEW.source_revision_id FOR SHARE OF b;
  IF source.company_id IS DISTINCT FROM NEW.company_id OR source.project_id IS DISTINCT FROM NEW.project_id OR
     source.currency_code IS DISTINCT FROM 'THB' OR source.approval_state IS DISTINCT FROM 'APPROVED' THEN RAISE EXCEPTION 'Customer BOQ requires approved same-scope THB cost source'; END IF;
  IF NEW.previous_version_id IS NOT NULL THEN
    SELECT v.company_id, v.project_id, a.approval_state INTO prior FROM customer_boq_versions v
      LEFT JOIN approval_instances a ON a.id = v.approval_instance_id WHERE v.id = NEW.previous_version_id;
    IF prior.company_id IS DISTINCT FROM NEW.company_id OR prior.project_id IS DISTINCT FROM NEW.project_id OR prior.approval_state IS DISTINCT FROM 'APPROVED' THEN RAISE EXCEPTION 'Invalid Customer BOQ predecessor'; END IF;
  END IF;
  IF NEW.approval_instance_id IS NOT NULL THEN
    SELECT * INTO instance FROM approval_instances WHERE id = NEW.approval_instance_id;
    SELECT company_id INTO actor_company FROM users WHERE id = NEW.submitted_by_user_id;
    IF instance.company_id IS DISTINCT FROM NEW.company_id OR instance.entity_type IS DISTINCT FROM 'CUSTOMER_BOQ' OR instance.entity_id IS DISTINCT FROM NEW.id OR
       actor_company IS DISTINCT FROM NEW.company_id OR NEW.submitted_at IS NULL THEN RAISE EXCEPTION 'Invalid Customer BOQ approval handoff'; END IF;
  END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER customer_boq_version_guard BEFORE INSERT OR UPDATE OR DELETE ON customer_boq_versions FOR EACH ROW EXECUTE FUNCTION erp_customer_boq_version_guard();

CREATE FUNCTION erp_customer_boq_content_guard() RETURNS trigger AS $$
DECLARE v customer_boq_versions; e customer_boq_edits; source_revision UUID; scope_company UUID; state TEXT; edit_xmin TEXT;
BEGIN
  IF TG_OP <> 'INSERT' THEN RAISE EXCEPTION 'Customer BOQ content/replays are append-only'; END IF;
  IF TG_TABLE_NAME = 'customer_boq_replays' THEN
    SELECT company_id INTO scope_company FROM users WHERE id = NEW.actor_user_id;
    IF scope_company IS DISTINCT FROM NEW.company_id THEN RAISE EXCEPTION 'Customer BOQ replay scope mismatch'; END IF;
    RETURN NEW;
  END IF;
  IF TG_TABLE_NAME = 'customer_boq_edits' THEN
    SELECT * INTO v FROM customer_boq_versions WHERE id = NEW.version_id FOR UPDATE;
    SELECT company_id INTO scope_company FROM users WHERE id = NEW.actor_user_id;
    IF scope_company IS DISTINCT FROM v.company_id THEN RAISE EXCEPTION 'Customer BOQ editor scope mismatch'; END IF;
    IF NEW.edit_no NOT IN (v.current_edit_no, v.current_edit_no + 1) THEN RAISE EXCEPTION 'Customer BOQ edit must append'; END IF;
  ELSIF TG_TABLE_NAME = 'customer_boq_lines' THEN
    SELECT * INTO e FROM customer_boq_edits WHERE id = NEW.edit_id;
    SELECT xmin::text INTO edit_xmin FROM customer_boq_edits WHERE id = NEW.edit_id;
    SELECT * INTO v FROM customer_boq_versions WHERE id = e.version_id FOR UPDATE;
    SELECT company_id INTO scope_company FROM units_of_measure WHERE id = NEW.uom_id;
    IF scope_company IS DISTINCT FROM v.company_id THEN RAISE EXCEPTION 'Customer BOQ UOM scope mismatch'; END IF;
  ELSE
    SELECT e0.* INTO e FROM customer_boq_edits e0 JOIN customer_boq_lines l ON l.edit_id = e0.id WHERE l.id = NEW.line_id;
    SELECT e0.xmin::text INTO edit_xmin FROM customer_boq_edits e0 WHERE e0.id = e.id;
    SELECT * INTO v FROM customer_boq_versions WHERE id = e.version_id FOR UPDATE;
    SELECT budget_revision_id INTO source_revision FROM budget_revision_lines WHERE id = NEW.source_line_id;
    IF source_revision IS DISTINCT FROM v.source_revision_id THEN RAISE EXCEPTION 'Customer BOQ mapping source mismatch'; END IF;
  END IF;
  IF v.id IS NULL THEN RAISE EXCEPTION 'Customer BOQ version missing'; END IF;
  SELECT approval_state INTO state FROM approval_instances WHERE id = v.approval_instance_id FOR SHARE;
  IF state IN ('SUBMITTED','APPROVED') THEN RAISE EXCEPTION 'Submitted/approved Customer BOQ content is immutable'; END IF;
  -- Child rows can be added only while their new edit is assembled in this transaction.
  IF TG_TABLE_NAME <> 'customer_boq_edits' AND edit_xmin IS DISTINCT FROM (txid_current() % 4294967296)::text THEN RAISE EXCEPTION 'Cannot append into retained Customer BOQ edit'; END IF;
  RETURN NEW;
END; $$ LANGUAGE plpgsql;
CREATE TRIGGER customer_boq_edit_guard BEFORE INSERT OR UPDATE OR DELETE ON customer_boq_edits FOR EACH ROW EXECUTE FUNCTION erp_customer_boq_content_guard();
CREATE TRIGGER customer_boq_line_guard BEFORE INSERT OR UPDATE OR DELETE ON customer_boq_lines FOR EACH ROW EXECUTE FUNCTION erp_customer_boq_content_guard();
CREATE TRIGGER customer_boq_mapping_guard BEFORE INSERT OR UPDATE OR DELETE ON customer_boq_mappings FOR EACH ROW EXECUTE FUNCTION erp_customer_boq_content_guard();
CREATE TRIGGER customer_boq_replay_guard BEFORE INSERT OR UPDATE OR DELETE ON customer_boq_replays FOR EACH ROW EXECUTE FUNCTION erp_customer_boq_content_guard();

CREATE FUNCTION erp_customer_boq_edit_complete() RETURNS trigger AS $$
DECLARE target_version UUID; target_edit UUID; current_edit INTEGER; edit_number INTEGER; total NUMERIC; line_total NUMERIC; count_lines BIGINT;
BEGIN
  IF TG_TABLE_NAME = 'customer_boq_edits' THEN target_edit := NEW.id;
  ELSIF TG_TABLE_NAME = 'customer_boq_lines' THEN target_edit := NEW.edit_id;
  ELSE SELECT l.edit_id INTO target_edit FROM customer_boq_lines l WHERE l.id = NEW.line_id;
  END IF;
  SELECT e.version_id, e.edit_no, e.total_amount INTO target_version, edit_number, total FROM customer_boq_edits e WHERE e.id = target_edit;
  SELECT v.current_edit_no INTO current_edit FROM customer_boq_versions v WHERE v.id = target_version;
  IF edit_number > current_edit THEN RAISE EXCEPTION 'Customer BOQ edit was not adopted'; END IF;
  SELECT count(*), sum(l.amount) INTO count_lines, line_total FROM customer_boq_lines l WHERE l.edit_id = target_edit;
  IF count_lines = 0 OR total IS DISTINCT FROM line_total THEN RAISE EXCEPTION 'Customer BOQ total must sum nonempty stored lines'; END IF;
  IF EXISTS (SELECT 1 FROM customer_boq_lines l WHERE l.edit_id = target_edit AND NOT EXISTS (SELECT 1 FROM customer_boq_mappings m WHERE m.line_id = l.id)) THEN RAISE EXCEPTION 'Customer BOQ line requires source mappings'; END IF;
  IF EXISTS (SELECT m.source_line_id FROM customer_boq_mappings m JOIN customer_boq_lines l ON l.id = m.line_id WHERE l.edit_id = target_edit GROUP BY m.source_line_id HAVING sum(m.share_percent) > 100) THEN RAISE EXCEPTION 'Customer BOQ source coverage exceeds 100 percent'; END IF;
  RETURN NULL;
END; $$ LANGUAGE plpgsql;
CREATE CONSTRAINT TRIGGER customer_boq_edit_complete AFTER INSERT ON customer_boq_edits DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_customer_boq_edit_complete();
CREATE CONSTRAINT TRIGGER customer_boq_line_complete AFTER INSERT ON customer_boq_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_customer_boq_edit_complete();
CREATE CONSTRAINT TRIGGER customer_boq_mapping_complete AFTER INSERT ON customer_boq_mappings DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_customer_boq_edit_complete();
