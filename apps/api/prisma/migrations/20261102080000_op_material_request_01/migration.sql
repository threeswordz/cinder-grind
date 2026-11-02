-- CreateTable
CREATE TABLE "material_requests" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "requester_employee_id" UUID NOT NULL,
    "request_date" DATE NOT NULL,
    "remarks" TEXT,
    "version" INTEGER NOT NULL DEFAULT 1,
    "created_by_user_id" UUID NOT NULL,
    "updated_by_user_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "material_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_request_lines" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "material_id" UUID NOT NULL,
    "uom_id" UUID NOT NULL,
    "requested_quantity" DECIMAL(18,4) NOT NULL,
    "wbs_id" UUID,
    "cost_code_id" UUID,
    "activity_id" UUID,
    "remarks" TEXT,

    CONSTRAINT "material_request_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_request_revisions" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "snapshot" JSONB NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_request_revisions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_request_issue_links" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "request_line_id" UUID NOT NULL,
    "material_issue_item_id" UUID NOT NULL,
    "linked_by_user_id" UUID NOT NULL,
    "linked_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_request_issue_links_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_request_receipts" (
    "id" UUID NOT NULL,
    "request_id" UUID NOT NULL,
    "issue_link_id" UUID NOT NULL,
    "recipient_employee_id" UUID NOT NULL,
    "issuer_employee_id" UUID NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL,
    "document_id" UUID NOT NULL,
    "evidence_checksum" VARCHAR(64) NOT NULL,
    "signed_evidence_confirmed" BOOLEAN NOT NULL,
    "supersedes_receipt_id" UUID,
    "reason" TEXT NOT NULL,
    "recorded_by_user_id" UUID NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_request_receipts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "material_request_operations" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "action" VARCHAR(20) NOT NULL,
    "request_key" VARCHAR(120) NOT NULL,
    "body_digest" VARCHAR(64) NOT NULL,
    "request_id" UUID NOT NULL,
    "revision_id" UUID NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "material_request_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "material_requests_company_id_project_id_created_at_idx" ON "material_requests"("company_id", "project_id", "created_at");

-- CreateIndex
CREATE UNIQUE INDEX "material_request_lines_request_id_line_no_key" ON "material_request_lines"("request_id", "line_no");

-- CreateIndex
CREATE UNIQUE INDEX "material_request_revisions_request_id_version_key" ON "material_request_revisions"("request_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "material_request_issue_links_material_issue_item_id_key" ON "material_request_issue_links"("material_issue_item_id");

-- CreateIndex
CREATE INDEX "material_request_issue_links_request_id_request_line_id_idx" ON "material_request_issue_links"("request_id", "request_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_request_receipts_supersedes_receipt_id_key" ON "material_request_receipts"("supersedes_receipt_id");

-- CreateIndex
CREATE INDEX "material_request_receipts_request_id_issue_link_id_recorded_idx" ON "material_request_receipts"("request_id", "issue_link_id", "recorded_at");

-- CreateIndex
CREATE UNIQUE INDEX "material_request_operations_revision_id_key" ON "material_request_operations"("revision_id");

-- CreateIndex
CREATE UNIQUE INDEX "material_request_operations_company_id_actor_user_id_action_key" ON "material_request_operations"("company_id", "actor_user_id", "action", "request_key");

-- AddForeignKey
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_project_id_fkey" FOREIGN KEY ("project_id") REFERENCES "projects"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_requester_employee_id_fkey" FOREIGN KEY ("requester_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_created_by_user_id_fkey" FOREIGN KEY ("created_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_requests" ADD CONSTRAINT "material_requests_updated_by_user_id_fkey" FOREIGN KEY ("updated_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_lines" ADD CONSTRAINT "material_request_lines_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "material_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_lines" ADD CONSTRAINT "material_request_lines_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_lines" ADD CONSTRAINT "material_request_lines_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_lines" ADD CONSTRAINT "material_request_lines_wbs_id_fkey" FOREIGN KEY ("wbs_id") REFERENCES "wbs_elements"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_lines" ADD CONSTRAINT "material_request_lines_cost_code_id_fkey" FOREIGN KEY ("cost_code_id") REFERENCES "cost_codes"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_lines" ADD CONSTRAINT "material_request_lines_activity_id_fkey" FOREIGN KEY ("activity_id") REFERENCES "activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_revisions" ADD CONSTRAINT "material_request_revisions_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "material_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_revisions" ADD CONSTRAINT "material_request_revisions_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_issue_links" ADD CONSTRAINT "material_request_issue_links_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "material_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_issue_links" ADD CONSTRAINT "material_request_issue_links_request_line_id_fkey" FOREIGN KEY ("request_line_id") REFERENCES "material_request_lines"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_issue_links" ADD CONSTRAINT "material_request_issue_links_material_issue_item_id_fkey" FOREIGN KEY ("material_issue_item_id") REFERENCES "material_issue_items"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_issue_links" ADD CONSTRAINT "material_request_issue_links_linked_by_user_id_fkey" FOREIGN KEY ("linked_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_receipts" ADD CONSTRAINT "material_request_receipts_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "material_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_receipts" ADD CONSTRAINT "material_request_receipts_issue_link_id_fkey" FOREIGN KEY ("issue_link_id") REFERENCES "material_request_issue_links"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_receipts" ADD CONSTRAINT "material_request_receipts_recipient_employee_id_fkey" FOREIGN KEY ("recipient_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_receipts" ADD CONSTRAINT "material_request_receipts_issuer_employee_id_fkey" FOREIGN KEY ("issuer_employee_id") REFERENCES "employees"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_receipts" ADD CONSTRAINT "material_request_receipts_document_id_fkey" FOREIGN KEY ("document_id") REFERENCES "documents"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_receipts" ADD CONSTRAINT "material_request_receipts_recorded_by_user_id_fkey" FOREIGN KEY ("recorded_by_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_receipts" ADD CONSTRAINT "material_request_receipts_supersedes_receipt_id_fkey" FOREIGN KEY ("supersedes_receipt_id") REFERENCES "material_request_receipts"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_operations" ADD CONSTRAINT "material_request_operations_company_id_fkey" FOREIGN KEY ("company_id") REFERENCES "companies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_operations" ADD CONSTRAINT "material_request_operations_actor_user_id_fkey" FOREIGN KEY ("actor_user_id") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_operations" ADD CONSTRAINT "material_request_operations_request_id_fkey" FOREIGN KEY ("request_id") REFERENCES "material_requests"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "material_request_operations" ADD CONSTRAINT "material_request_operations_revision_id_fkey" FOREIGN KEY ("revision_id") REFERENCES "material_request_revisions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;


-- DEC-043: request/receipt metadata never posts stock, reservations or Finance.
ALTER TABLE material_requests ADD CONSTRAINT mr_version CHECK (version > 0 AND isfinite(request_date));
ALTER TABLE material_request_lines ADD CONSTRAINT mr_line_values CHECK (
 line_no BETWEEN 1 AND 100 AND requested_quantity > 0 AND requested_quantity < 100000000000000
 AND requested_quantity <> 'NaN'::numeric);
ALTER TABLE material_request_revisions ADD CONSTRAINT mr_revision_values CHECK (
 version > 0 AND action IN ('CAPTURE','REVISE','LINK','ACKNOWLEDGE') AND length(btrim(reason)) BETWEEN 1 AND 4000);
ALTER TABLE material_request_operations ADD CONSTRAINT mr_operation_values CHECK (
 action IN ('CAPTURE','REVISE','LINK','ACKNOWLEDGE') AND length(btrim(request_key)) BETWEEN 1 AND 120
 AND body_digest ~ '^[0-9a-f]{64}$');
ALTER TABLE material_request_receipts ADD CONSTRAINT mr_receipt_values CHECK (
 signed_evidence_confirmed AND evidence_checksum ~ '^[0-9a-f]{64}$'
 AND isfinite(received_at) AND received_at <= recorded_at
 AND length(btrim(reason)) BETWEEN 1 AND 4000 AND supersedes_receipt_id IS DISTINCT FROM id);
CREATE UNIQUE INDEX mr_receipt_one_original ON material_request_receipts(issue_link_id) WHERE supersedes_receipt_id IS NULL;

CREATE FUNCTION erp_material_request_scope() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE r RECORD; l RECORD; src RECORD; d RECORD;
BEGIN
 IF TG_TABLE_NAME='material_requests' THEN
  IF NOT EXISTS (SELECT 1 FROM projects WHERE id=NEW.project_id AND company_id=NEW.company_id AND is_active)
   OR NOT EXISTS (SELECT 1 FROM warehouses WHERE id=NEW.warehouse_id AND company_id=NEW.company_id
    AND is_active AND (project_id IS NULL OR project_id=NEW.project_id))
   OR (TG_OP='INSERT' AND NOT EXISTS (SELECT 1 FROM employees e JOIN project_members m ON m.employee_id=e.id
    WHERE e.id=NEW.requester_employee_id AND e.company_id=NEW.company_id AND e.is_active
     AND m.project_id=NEW.project_id AND m.is_active))
   OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.created_by_user_id AND company_id=NEW.company_id)
   OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.updated_by_user_id AND company_id=NEW.company_id AND is_active)
  THEN RAISE EXCEPTION 'Material request ownership invalid'; END IF;
  RETURN NEW;
 END IF;
 SELECT * INTO STRICT r FROM material_requests WHERE id=NEW.request_id;
 IF TG_TABLE_NAME='material_request_lines' THEN
  IF NOT EXISTS (SELECT 1 FROM materials WHERE id=NEW.material_id AND company_id=r.company_id AND is_active)
   OR NOT EXISTS (SELECT 1 FROM units_of_measure WHERE id=NEW.uom_id AND company_id=r.company_id AND is_active)
   OR NOT EXISTS (SELECT 1 FROM materials WHERE id=NEW.material_id AND default_uom_id=NEW.uom_id
    UNION ALL SELECT 1 FROM stock_transactions WHERE company_id=r.company_id AND project_id=r.project_id
     AND warehouse_id=r.warehouse_id AND material_id=NEW.material_id AND uom_id=NEW.uom_id)
   OR (NEW.wbs_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM wbs_elements WHERE id=NEW.wbs_id AND project_id=r.project_id AND is_active))
   OR (NEW.cost_code_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM cost_codes WHERE id=NEW.cost_code_id AND company_id=r.company_id AND is_active))
   OR (NEW.activity_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM activities WHERE id=NEW.activity_id AND company_id=r.company_id
     AND project_id=r.project_id AND is_active AND (NEW.wbs_id IS NULL OR wbs_id=NEW.wbs_id)))
  THEN RAISE EXCEPTION 'Material request line scope invalid'; END IF;
 ELSIF TG_TABLE_NAME='material_request_issue_links' THEN
  SELECT * INTO STRICT l FROM material_request_lines WHERE id=NEW.request_line_id;
  SELECT i.*, x.company_id,x.project_id,x.warehouse_id,x.posted_at,x.reversed_at INTO src
    FROM material_issue_items i JOIN material_issues x ON x.id=i.material_issue_id WHERE i.id=NEW.material_issue_item_id FOR SHARE OF i,x;
  IF NOT FOUND OR l.request_id<>r.id OR src.company_id<>r.company_id OR src.project_id<>r.project_id
   OR src.warehouse_id<>r.warehouse_id OR src.material_id<>l.material_id OR src.uom_id<>l.uom_id
   OR src.wbs_id IS DISTINCT FROM l.wbs_id OR src.cost_code_id IS DISTINCT FROM l.cost_code_id
   OR src.activity_id IS DISTINCT FROM l.activity_id OR src.posted_at IS NULL OR src.reversed_at IS NOT NULL
   OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.linked_by_user_id AND company_id=r.company_id AND is_active)
  THEN RAISE EXCEPTION 'Material request issue link invalid'; END IF;
 ELSIF TG_TABLE_NAME='material_request_receipts' THEN
  SELECT k.*,x.issued_to_employee_id,x.posted_at,x.reversed_at INTO l FROM material_request_issue_links k
   JOIN material_issue_items i ON i.id=k.material_issue_item_id JOIN material_issues x ON x.id=i.material_issue_id
   WHERE k.id=NEW.issue_link_id FOR SHARE OF x;
  IF NOT FOUND OR l.request_id<>r.id OR l.posted_at IS NULL OR l.reversed_at IS NOT NULL
   OR (l.issued_to_employee_id IS NOT NULL AND l.issued_to_employee_id<>NEW.recipient_employee_id)
   OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.recorded_by_user_id AND company_id=r.company_id AND is_active)
   OR EXISTS (SELECT e.id FROM (VALUES (NEW.recipient_employee_id),(NEW.issuer_employee_id)) v(id)
    LEFT JOIN employees e ON e.id=v.id AND e.company_id=r.company_id AND e.is_active
    WHERE e.id IS NULL OR NOT EXISTS (SELECT 1 FROM project_members m WHERE m.employee_id=e.id AND m.project_id=r.project_id AND m.is_active))
  THEN RAISE EXCEPTION 'Material request receipt actor/source invalid'; END IF;
  SELECT * INTO d FROM documents WHERE id=NEW.document_id FOR SHARE;
  IF NOT FOUND OR d.company_id<>r.company_id OR NOT d.is_active OR d.checksum IS DISTINCT FROM NEW.evidence_checksum
   OR d.mime_type NOT IN ('application/pdf','image/jpeg','image/png')
   OR NOT EXISTS (SELECT 1 FROM document_links WHERE document_id=d.id AND entity_type='MATERIAL_REQUEST' AND entity_id=r.id)
   OR NOT EXISTS (SELECT 1 FROM document_links WHERE document_id=d.id AND entity_type='PROJECT' AND entity_id=r.project_id)
   OR EXISTS (SELECT 1 FROM document_links WHERE document_id=d.id AND upper(entity_type) LIKE 'HR\_%' ESCAPE '\')
  THEN RAISE EXCEPTION 'Material request signed evidence invalid'; END IF;
  IF NEW.supersedes_receipt_id IS NOT NULL AND NOT EXISTS (SELECT 1 FROM material_request_receipts prior_receipt
    WHERE prior_receipt.id=NEW.supersedes_receipt_id AND prior_receipt.request_id=r.id AND prior_receipt.issue_link_id=NEW.issue_link_id
     AND NOT EXISTS (SELECT 1 FROM material_request_receipts later WHERE later.supersedes_receipt_id=prior_receipt.id))
  THEN RAISE EXCEPTION 'Material request receipt correction is stale'; END IF;
 ELSIF TG_TABLE_NAME='material_request_revisions' THEN
  IF NEW.version<>r.version OR NEW.actor_user_id<>r.updated_by_user_id
   OR (NEW.version=1) IS DISTINCT FROM (NEW.action='CAPTURE')
   OR NOT EXISTS (SELECT 1 FROM users WHERE id=NEW.actor_user_id AND company_id=r.company_id AND is_active)
  THEN RAISE EXCEPTION 'Material request revision scope invalid'; END IF;
 ELSIF TG_TABLE_NAME='material_request_operations' THEN
  IF NEW.company_id<>r.company_id OR NOT EXISTS (SELECT 1 FROM material_request_revisions v
   WHERE v.id=NEW.revision_id AND v.request_id=r.id AND v.actor_user_id=NEW.actor_user_id AND v.action=NEW.action)
  THEN RAISE EXCEPTION 'Material request replay ownership invalid'; END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER mr_scope BEFORE INSERT OR UPDATE ON material_requests FOR EACH ROW EXECUTE FUNCTION erp_material_request_scope();
CREATE TRIGGER mr_line_scope BEFORE INSERT OR UPDATE ON material_request_lines FOR EACH ROW EXECUTE FUNCTION erp_material_request_scope();
CREATE TRIGGER mr_link_scope BEFORE INSERT ON material_request_issue_links FOR EACH ROW EXECUTE FUNCTION erp_material_request_scope();
CREATE TRIGGER mr_receipt_scope BEFORE INSERT ON material_request_receipts FOR EACH ROW EXECUTE FUNCTION erp_material_request_scope();
CREATE TRIGGER mr_revision_scope BEFORE INSERT ON material_request_revisions FOR EACH ROW EXECUTE FUNCTION erp_material_request_scope();
CREATE TRIGGER mr_operation_scope BEFORE INSERT ON material_request_operations FOR EACH ROW EXECUTE FUNCTION erp_material_request_scope();

CREATE FUNCTION erp_material_request_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'Material request history cannot be deleted'; END IF;
 IF TG_TABLE_NAME='material_requests' THEN
  IF (to_jsonb(NEW)-ARRAY['remarks','request_date','version','updated_at','updated_by_user_id']) IS DISTINCT FROM
     (to_jsonb(OLD)-ARRAY['remarks','request_date','version','updated_at','updated_by_user_id']) OR NEW.version<>OLD.version+1
  THEN RAISE EXCEPTION 'Material request context/version immutable'; END IF;
 ELSIF TG_TABLE_NAME='material_request_lines' THEN
  IF (to_jsonb(NEW)-ARRAY['requested_quantity','remarks']) IS DISTINCT FROM (to_jsonb(OLD)-ARRAY['requested_quantity','remarks'])
  THEN RAISE EXCEPTION 'Material request line identity immutable'; END IF;
 ELSE RAISE EXCEPTION 'Material request evidence/history is append-only'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER mr_history BEFORE UPDATE OR DELETE ON material_requests FOR EACH ROW EXECUTE FUNCTION erp_material_request_immutable();
CREATE TRIGGER mr_line_history BEFORE UPDATE OR DELETE ON material_request_lines FOR EACH ROW EXECUTE FUNCTION erp_material_request_immutable();
CREATE TRIGGER mr_link_history BEFORE UPDATE OR DELETE ON material_request_issue_links FOR EACH ROW EXECUTE FUNCTION erp_material_request_immutable();
CREATE TRIGGER mr_receipt_history BEFORE UPDATE OR DELETE ON material_request_receipts FOR EACH ROW EXECUTE FUNCTION erp_material_request_immutable();
CREATE TRIGGER mr_revision_history BEFORE UPDATE OR DELETE ON material_request_revisions FOR EACH ROW EXECUTE FUNCTION erp_material_request_immutable();
CREATE TRIGGER mr_operation_history BEFORE UPDATE OR DELETE ON material_request_operations FOR EACH ROW EXECUTE FUNCTION erp_material_request_immutable();

CREATE FUNCTION erp_material_request_snapshot(request_uuid uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('request',to_jsonb(r),'lines',COALESCE((SELECT jsonb_agg(to_jsonb(l)||jsonb_build_object('requested_quantity',l.requested_quantity::text) ORDER BY line_no) FROM material_request_lines l WHERE request_id=r.id),'[]'::jsonb),
 'links',COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY id) FROM material_request_issue_links l WHERE request_id=r.id),'[]'::jsonb),
 'receipts',COALESCE((SELECT jsonb_agg(to_jsonb(l) ORDER BY id) FROM material_request_receipts l WHERE request_id=r.id),'[]'::jsonb))
 FROM material_requests r WHERE r.id=request_uuid
$$;
CREATE FUNCTION erp_material_request_evidence() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE target uuid; r RECORD; v RECORD; n integer;
BEGIN
 IF TG_TABLE_NAME='material_requests' THEN target:=NEW.id; ELSE target:=NEW.request_id; END IF;
 SELECT * INTO STRICT r FROM material_requests WHERE id=target;
 SELECT * INTO v FROM material_request_revisions WHERE request_id=r.id AND version=r.version;
 SELECT count(*) INTO n FROM material_request_lines WHERE request_id=r.id;
 IF NOT FOUND OR n NOT BETWEEN 1 AND 100 OR v.snapshot IS DISTINCT FROM erp_material_request_snapshot(r.id)
  OR (SELECT count(*) FROM material_request_revisions WHERE request_id=r.id)<>r.version
  OR NOT EXISTS (SELECT 1 FROM material_request_operations WHERE revision_id=v.id)
 THEN RAISE EXCEPTION 'Material request mutation requires complete immutable revision/replay evidence'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER mr_evidence AFTER INSERT OR UPDATE ON material_requests DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_material_request_evidence();
CREATE CONSTRAINT TRIGGER mr_line_evidence AFTER INSERT OR UPDATE ON material_request_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_material_request_evidence();
CREATE CONSTRAINT TRIGGER mr_link_evidence AFTER INSERT ON material_request_issue_links DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_material_request_evidence();
CREATE CONSTRAINT TRIGGER mr_receipt_evidence AFTER INSERT ON material_request_receipts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_material_request_evidence();

CREATE FUNCTION erp_material_request_document_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE doc_id uuid;
BEGIN
 doc_id:=OLD.id;
 IF TG_TABLE_NAME='document_links' THEN doc_id:=OLD.document_id; END IF;
 IF EXISTS (SELECT 1 FROM material_request_receipts WHERE document_id=doc_id) THEN
  IF TG_TABLE_NAME='document_links' OR TG_OP='DELETE' OR
    (to_jsonb(OLD)-ARRAY['is_active','updated_at']) IS DISTINCT FROM (to_jsonb(NEW)-ARRAY['is_active','updated_at'])
  THEN RAISE EXCEPTION 'Signed receipt Document identity/bytes/links are retained'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER mr_document_history BEFORE UPDATE OR DELETE ON documents FOR EACH ROW EXECUTE FUNCTION erp_material_request_document_history();
CREATE TRIGGER mr_document_link_history BEFORE UPDATE OR DELETE ON document_links FOR EACH ROW EXECUTE FUNCTION erp_material_request_document_history();

INSERT INTO permissions (id,permission_code,module_code,description) VALUES
 ('d1020000-0000-4000-8000-000000000001','inventory.material_request.view','INVENTORY','View scoped material requests and fulfillment'),
 ('d1020000-0000-4000-8000-000000000002','inventory.material_request.create','INVENTORY','Record Foreman material requests through Store'),
 ('d1020000-0000-4000-8000-000000000003','inventory.material_request.edit','INVENTORY','Append reasoned material request revisions'),
 ('d1020000-0000-4000-8000-000000000004','inventory.material_request.link','INVENTORY','Link posted canonical material issue lines'),
 ('d1020000-0000-4000-8000-000000000005','inventory.material_request.acknowledge','INVENTORY','Record explicit signed receipt evidence')
ON CONFLICT (permission_code) DO NOTHING;

-- Preserve the complete prior scope guard and add only this owned target.
CREATE OR REPLACE FUNCTION validate_document_link_scope()
RETURNS trigger AS $$
DECLARE
  document_company UUID;
  linker_company UUID;
  target_company UUID;
  target_project UUID;
BEGIN
  SELECT "company_id" INTO document_company
  FROM "documents" WHERE "id" = NEW."document_id";

  SELECT "company_id" INTO linker_company
  FROM "users" WHERE "id" = NEW."linked_by_user_id";

  IF document_company IS NULL OR linker_company IS NULL THEN
    RAISE EXCEPTION 'Document or linking user does not exist';
  END IF;

  IF NEW."entity_type" = 'HR_ATTACHMENT' THEN
    -- This is the ONLY exception to the generic same-Company linker rule:
    -- explicit native role capability plus live target-Company HR entitlement.
    -- An authorized cross-Company HR user remains the real audit actor.
    IF NOT hr_has_document_authority(NEW."linked_by_user_id", document_company) THEN
      RAISE EXCEPTION 'HR_ATTACHMENT_LINK_ACCESS_DENIED' USING ERRCODE='23514';
    END IF;
    -- No Project association: a canonical private file belongs to precisely
    -- the target-Company Employee. Native uploader Company may differ.
    IF NOT EXISTS (
      SELECT 1 FROM employees WHERE id = NEW."entity_id"
        AND company_id = document_company
    ) OR NOT EXISTS (
      SELECT 1 FROM documents WHERE id = NEW."document_id"
        AND company_id = document_company AND file_name = 'hr-private.enc'
        AND mime_type = 'application/octet-stream'
        AND storage_provider = 'LOCAL' AND file_size_bytes > 0
        AND checksum ~ '^[0-9a-f]{64}$'
        AND EXISTS (SELECT 1 FROM document_types dt
          WHERE dt.id=documents.document_type_id AND dt.company_id=document_company
            AND dt.is_active)
    ) THEN
      RAISE EXCEPTION 'HR_ATTACHMENT_LINK_SCOPE_INVALID' USING ERRCODE='23514';
    END IF;
    IF EXISTS (
      SELECT 1 FROM document_links
      WHERE document_id = NEW."document_id"
        AND (entity_type <> 'HR_ATTACHMENT' OR entity_id <> NEW."entity_id")
    ) THEN
      RAISE EXCEPTION 'HR_ATTACHMENT_LINK_PRIVATE' USING ERRCODE='23514';
    END IF;
    RETURN NEW;
  END IF;

  -- Every legacy Project/WBS/Finance/Stock/BOQ source keeps its original,
  -- strict same-Company linker requirement. No cross-Company generic path.
  IF document_company <> linker_company THEN
    RAISE EXCEPTION 'Document and linker must belong to the same Company';
  END IF;

  IF NEW."entity_type" = 'PROJECT' THEN
    SELECT "company_id","id"
      INTO target_company,target_project
    FROM "projects"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'BOQ' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "boqs"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'BUDGET_REVISION' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "budget_revisions"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'CUSTOMER_BOQ' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "customer_boq_versions"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'WBS' THEN
    SELECT project."company_id", wbs."project_id"
      INTO target_company,target_project
    FROM "wbs_elements" wbs
    JOIN "projects" project ON project."id" = wbs."project_id"
    WHERE wbs."id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'ACTIVITY' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "activities"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'DAILY_SITE_REPORT' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "daily_site_reports"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'PURCHASE_REQUEST' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "purchase_requests"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'RFQ' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "rfqs"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'SUPPLIER_QUOTATION' THEN
    SELECT quotation."company_id", rfq."project_id"
      INTO target_company,target_project
    FROM "supplier_quotations" quotation
    JOIN "rfqs" rfq ON rfq."id" = quotation."rfq_id"
    WHERE quotation."id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'PURCHASE_ORDER' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "purchase_orders"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'GOODS_RECEIPT' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "goods_receipts"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'MATERIAL_RESERVATION' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "material_reservations"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'MATERIAL_ISSUE' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "material_issues"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'MATERIAL_RETURN' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "material_returns"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'STOCK_TRANSFER' THEN
    SELECT transfer."company_id", project_link."entity_id"
      INTO target_company,target_project
    FROM "stock_transfers" transfer
    JOIN "stock_transfer_items" item
      ON item."stock_transfer_id" = transfer."id"
    JOIN "document_links" project_link
      ON project_link."document_id" = NEW."document_id"
     AND project_link."entity_type" = 'PROJECT'
     AND (
       project_link."entity_id" = item."source_project_id"
       OR project_link."entity_id" = item."destination_project_id"
     )
    WHERE transfer."id" = NEW."entity_id"
    LIMIT 1;
  ELSIF NEW."entity_type" = 'SUPPLIER_INVOICE' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "supplier_invoices"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'CLIENT_INVOICE' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "client_invoices"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'PAYMENT' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "payments"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'SUBCONTRACT_AGREEMENT' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "subcontract_agreements"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'SUBCONTRACT_WORK_ORDER' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "subcontract_work_orders"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'SUBCONTRACT_CLAIM' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "subcontract_claims"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'SUBCONTRACT_CERTIFICATION' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "subcontract_certifications"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'SUBCONTRACT_VARIATION' THEN
    SELECT "company_id","project_id"
      INTO target_company,target_project
    FROM "subcontract_variations"
    WHERE "id" = NEW."entity_id";
  ELSIF NEW."entity_type" = 'MATERIAL_REQUEST' THEN
    SELECT company_id,project_id INTO target_company,target_project
    FROM material_requests WHERE id=NEW."entity_id";
  ELSE
    RAISE EXCEPTION 'Unsupported Document Link entity type';
  END IF;

  IF target_company IS NULL OR target_project IS NULL THEN
    RAISE EXCEPTION 'Document Link target does not exist or is outside its Project link';
  END IF;

  IF target_company <> document_company THEN
    RAISE EXCEPTION 'Document Link target must belong to the same Company';
  END IF;

  IF NEW."entity_type" <> 'PROJECT'
     AND NOT EXISTS (
       SELECT 1
       FROM "document_links" project_link
       WHERE project_link."document_id" = NEW."document_id"
         AND project_link."entity_type" = 'PROJECT'
         AND project_link."entity_id" = target_project
     ) THEN
    RAISE EXCEPTION 'Document target link requires a matching Project link';
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;
