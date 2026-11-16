-- AlterTable
ALTER TABLE "goods_receipts" ADD COLUMN     "delivery_id" UUID;

-- CreateTable
CREATE TABLE "receiving_project_policies" (
    "project_id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "enabled_by_user_id" UUID NOT NULL,
    "reason" TEXT NOT NULL,
    "synthetic_only" BOOLEAN NOT NULL DEFAULT true,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receiving_project_policies_pkey" PRIMARY KEY ("project_id")
);

-- CreateTable
CREATE TABLE "receiving_deliveries" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "warehouse_id" UUID NOT NULL,
    "supplier_id" UUID NOT NULL,
    "created_by_user_id" UUID NOT NULL,
    "received_at" TIMESTAMPTZ(6) NOT NULL,
    "po_link_due_at" TIMESTAMPTZ(6) NOT NULL,
    "receiver_name" VARCHAR(200) NOT NULL,
    "reason" TEXT NOT NULL,
    "quality_required" BOOLEAN NOT NULL,
    "purchase_order_id" UUID,
    "linked_at" TIMESTAMPTZ(6),
    "checked_by_user_id" UUID,
    "checked_at" TIMESTAMPTZ(6),
    "check_note" TEXT,
    "status" VARCHAR(20) NOT NULL DEFAULT 'HELD',
    "version" INTEGER NOT NULL DEFAULT 1,
    "supersedes_id" UUID,
    "void_reason" TEXT,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updated_at" TIMESTAMPTZ(6) NOT NULL,

    CONSTRAINT "receiving_deliveries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receiving_delivery_lines" (
    "id" UUID NOT NULL,
    "delivery_id" UUID NOT NULL,
    "line_no" INTEGER NOT NULL,
    "material_id" UUID NOT NULL,
    "uom_id" UUID NOT NULL,
    "observed_quantity" DECIMAL(18,4) NOT NULL,
    "good_quantity" DECIMAL(18,4) NOT NULL,
    "condition" VARCHAR(20) NOT NULL,
    "note" TEXT NOT NULL,
    "purchase_order_line_id" UUID,

    CONSTRAINT "receiving_delivery_lines_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receiving_delivery_evidence" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "delivery_id" UUID NOT NULL,
    "document_id" UUID NOT NULL,
    "purpose" VARCHAR(30) NOT NULL,
    "checksum" VARCHAR(64) NOT NULL,
    "signature_confirmed" BOOLEAN NOT NULL DEFAULT false,
    "recorded_by_user_id" UUID NOT NULL,
    "supersedes_id" UUID,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receiving_delivery_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receiving_delivery_events" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "delivery_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "action" VARCHAR(30) NOT NULL,
    "note" TEXT NOT NULL,
    "facts" JSONB NOT NULL,
    "recorded_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receiving_delivery_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "receiving_operations" (
    "id" UUID NOT NULL,
    "company_id" UUID NOT NULL,
    "project_id" UUID NOT NULL,
    "actor_user_id" UUID NOT NULL,
    "request_key" UUID NOT NULL,
    "action" VARCHAR(30) NOT NULL,
    "body_digest" VARCHAR(64) NOT NULL,
    "delivery_id" UUID,
    "outcome" JSONB NOT NULL,
    "created_at" TIMESTAMPTZ(6) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "receiving_operations_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "receiving_project_policies_company_id_project_id_key" ON "receiving_project_policies"("company_id", "project_id");

-- CreateIndex
CREATE UNIQUE INDEX "receiving_deliveries_supersedes_id_key" ON "receiving_deliveries"("supersedes_id");

-- CreateIndex
CREATE INDEX "receiving_deliveries_company_id_project_id_received_at_id_idx" ON "receiving_deliveries"("company_id", "project_id", "received_at", "id");

-- CreateIndex
CREATE INDEX "receiving_deliveries_company_id_project_id_po_link_due_at_idx" ON "receiving_deliveries"("company_id", "project_id", "po_link_due_at");

-- CreateIndex
CREATE UNIQUE INDEX "receiving_deliveries_company_id_id_key" ON "receiving_deliveries"("company_id", "id");

-- CreateIndex
CREATE UNIQUE INDEX "receiving_delivery_lines_delivery_id_line_no_key" ON "receiving_delivery_lines"("delivery_id", "line_no");

-- CreateIndex
CREATE UNIQUE INDEX "receiving_delivery_lines_delivery_id_purchase_order_line_id_key" ON "receiving_delivery_lines"("delivery_id", "purchase_order_line_id");

-- CreateIndex
CREATE UNIQUE INDEX "receiving_delivery_evidence_supersedes_id_key" ON "receiving_delivery_evidence"("supersedes_id");

-- CreateIndex
CREATE UNIQUE INDEX "receiving_delivery_evidence_delivery_id_document_id_purpose_key" ON "receiving_delivery_evidence"("delivery_id", "document_id", "purpose");

-- CreateIndex
CREATE UNIQUE INDEX "receiving_delivery_events_delivery_id_version_key" ON "receiving_delivery_events"("delivery_id", "version");

-- CreateIndex
CREATE UNIQUE INDEX "receiving_operations_company_id_actor_user_id_request_key_key" ON "receiving_operations"("company_id", "actor_user_id", "request_key");

-- CreateIndex
CREATE UNIQUE INDEX "goods_receipts_delivery_id_key" ON "goods_receipts"("delivery_id");

-- AddForeignKey
ALTER TABLE "goods_receipts" ADD CONSTRAINT "goods_receipts_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "receiving_deliveries"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "receiving_project_policies" ADD CONSTRAINT "receiving_project_policies_company_id_project_id_fkey" FOREIGN KEY ("company_id", "project_id") REFERENCES "projects"("company_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "receiving_project_policies" ADD CONSTRAINT "receiving_project_policies_company_id_enabled_by_user_id_fkey" FOREIGN KEY ("company_id", "enabled_by_user_id") REFERENCES "users"("company_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "receiving_deliveries" ADD CONSTRAINT "receiving_deliveries_company_id_project_id_fkey" FOREIGN KEY ("company_id", "project_id") REFERENCES "projects"("company_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "receiving_deliveries" ADD CONSTRAINT "receiving_deliveries_warehouse_id_fkey" FOREIGN KEY ("warehouse_id") REFERENCES "warehouses"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "receiving_deliveries" ADD CONSTRAINT "receiving_deliveries_supplier_id_fkey" FOREIGN KEY ("supplier_id") REFERENCES "suppliers"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "receiving_deliveries" ADD CONSTRAINT "receiving_deliveries_company_id_created_by_user_id_fkey" FOREIGN KEY ("company_id", "created_by_user_id") REFERENCES "users"("company_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "receiving_deliveries" ADD CONSTRAINT "receiving_deliveries_company_id_checked_by_user_id_fkey" FOREIGN KEY ("company_id", "checked_by_user_id") REFERENCES "users"("company_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "receiving_deliveries" ADD CONSTRAINT "receiving_deliveries_purchase_order_id_fkey" FOREIGN KEY ("purchase_order_id") REFERENCES "purchase_orders"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "receiving_deliveries" ADD CONSTRAINT "receiving_deliveries_supersedes_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "receiving_deliveries"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "receiving_delivery_lines" ADD CONSTRAINT "receiving_delivery_lines_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "receiving_deliveries"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "receiving_delivery_lines" ADD CONSTRAINT "receiving_delivery_lines_material_id_fkey" FOREIGN KEY ("material_id") REFERENCES "materials"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "receiving_delivery_lines" ADD CONSTRAINT "receiving_delivery_lines_uom_id_fkey" FOREIGN KEY ("uom_id") REFERENCES "units_of_measure"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "receiving_delivery_lines" ADD CONSTRAINT "receiving_delivery_lines_purchase_order_line_id_fkey" FOREIGN KEY ("purchase_order_line_id") REFERENCES "purchase_order_lines"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "receiving_delivery_evidence" ADD CONSTRAINT "receiving_delivery_evidence_supersedes_id_fkey" FOREIGN KEY ("supersedes_id") REFERENCES "receiving_delivery_evidence"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "receiving_delivery_evidence" ADD CONSTRAINT "receiving_delivery_evidence_company_id_delivery_id_fkey" FOREIGN KEY ("company_id", "delivery_id") REFERENCES "receiving_deliveries"("company_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "receiving_delivery_evidence" ADD CONSTRAINT "receiving_delivery_evidence_company_id_document_id_fkey" FOREIGN KEY ("company_id", "document_id") REFERENCES "documents"("company_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "receiving_delivery_evidence" ADD CONSTRAINT "receiving_delivery_evidence_company_id_recorded_by_user_id_fkey" FOREIGN KEY ("company_id", "recorded_by_user_id") REFERENCES "users"("company_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "receiving_delivery_events" ADD CONSTRAINT "receiving_delivery_events_company_id_delivery_id_fkey" FOREIGN KEY ("company_id", "delivery_id") REFERENCES "receiving_deliveries"("company_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "receiving_delivery_events" ADD CONSTRAINT "receiving_delivery_events_company_id_actor_user_id_fkey" FOREIGN KEY ("company_id", "actor_user_id") REFERENCES "users"("company_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "receiving_operations" ADD CONSTRAINT "receiving_operations_company_id_project_id_fkey" FOREIGN KEY ("company_id", "project_id") REFERENCES "projects"("company_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "receiving_operations" ADD CONSTRAINT "receiving_operations_company_id_actor_user_id_fkey" FOREIGN KEY ("company_id", "actor_user_id") REFERENCES "users"("company_id", "id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- AddForeignKey
ALTER TABLE "receiving_operations" ADD CONSTRAINT "receiving_operations_delivery_id_fkey" FOREIGN KEY ("delivery_id") REFERENCES "receiving_deliveries"("id") ON DELETE RESTRICT ON UPDATE RESTRICT;

-- Catalogue definitions only: no existing user/role/project receives a grant.
INSERT INTO permissions(id,permission_code,module_code,description) VALUES
('d1151300-0000-4000-8000-000000000001','inventory.receiving.view','INVENTORY','View scoped physical receiving custody and history'),
('d1151300-0000-4000-8000-000000000002','inventory.receiving.capture','INVENTORY','Capture physical delivery outside usable stock'),
('d1151300-0000-4000-8000-000000000003','inventory.receiving.edit','INVENTORY','Correct own unposted receiving custody and evidence with history'),
('d1151300-0000-4000-8000-000000000004','inventory.receiving.link_po','INVENTORY','Link receiving custody to a current approved PO'),
('d1151300-0000-4000-8000-000000000005','inventory.receiving.check','INVENTORY','Independently check physical receiving documents and quantities'),
('d1151300-0000-4000-8000-000000000006','inventory.receiving.configure','INVENTORY','Configure explicit synthetic Project receiving enforcement');

ALTER TABLE receiving_project_policies ADD CONSTRAINT receiving_policy_bounded CHECK(synthetic_only AND length(btrim(reason))>0);
ALTER TABLE receiving_deliveries ADD CONSTRAINT receiving_deadline CHECK(po_link_due_at=received_at+interval '48 hours' AND received_at<=created_at);
ALTER TABLE receiving_deliveries ADD CONSTRAINT receiving_state CHECK(
 version>0 AND status IN('HELD','CHECKED','VOID') AND length(btrim(receiver_name))>0 AND length(btrim(reason))>0
 AND ((purchase_order_id IS NULL AND linked_at IS NULL) OR (purchase_order_id IS NOT NULL AND linked_at IS NOT NULL))
 AND ((status='CHECKED' AND checked_by_user_id IS NOT NULL AND checked_at IS NOT NULL AND length(btrim(check_note))>0 AND checked_by_user_id<>created_by_user_id)
      OR(status<>'CHECKED' AND checked_by_user_id IS NULL AND checked_at IS NULL AND check_note IS NULL))
 AND ((status='VOID' AND length(btrim(void_reason))>0) OR(status<>'VOID' AND void_reason IS NULL)));
ALTER TABLE receiving_delivery_lines ADD CONSTRAINT receiving_line_quantity CHECK(line_no BETWEEN 1 AND 100 AND observed_quantity>0 AND good_quantity>=0 AND good_quantity<=observed_quantity
 AND condition IN('NORMAL','SHORT','EXCESS','WRONG','DAMAGED') AND length(btrim(note))>0 AND (condition<>'NORMAL' OR good_quantity=observed_quantity));
ALTER TABLE receiving_delivery_evidence ADD CONSTRAINT receiving_evidence_kind CHECK(purpose IN('DELIVERY_NOTE','RECEIVER_SIGNATURE','CONDITION_PHOTO','QUALITY_RESULT')
 AND checksum~'^[a-f0-9]{64}$' AND (purpose<>'RECEIVER_SIGNATURE' OR signature_confirmed));
ALTER TABLE receiving_delivery_events ADD CONSTRAINT receiving_event_shape CHECK(version>0 AND action IN('CAPTURE','REVISE','LINK_PO','ATTACH','CHECK','RETURN','VOID') AND length(btrim(note))>0 AND jsonb_typeof(facts)='object');
ALTER TABLE receiving_operations ADD CONSTRAINT receiving_operation_shape CHECK(action IN('ENABLE','CAPTURE','REVISE','LINK_PO','ATTACH','CHECK','RETURN','VOID','CREATE_GR') AND body_digest~'^[a-f0-9]{64}$' AND jsonb_typeof(outcome)='object'
 AND ((action='ENABLE' AND delivery_id IS NULL) OR(action<>'ENABLE' AND delivery_id IS NOT NULL)));

CREATE FUNCTION erp_receiving_actor(uid uuid,cid uuid,pid uuid,cap text) RETURNS boolean LANGUAGE sql STABLE AS $$
 SELECT EXISTS(SELECT 1 FROM users u JOIN companies c ON c.id=u.company_id JOIN employees e ON e.id=u.employee_id
 JOIN projects p ON p.id=pid AND p.company_id=cid
 WHERE u.id=uid AND u.company_id=cid AND u.is_active AND c.is_active AND e.is_active AND e.company_id=cid AND p.is_active
 AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions pm ON pm.id=rp.permission_id
  WHERE ur.user_id=u.id AND ur.company_id=cid AND r.company_id=cid AND r.is_active AND pm.permission_code=cap)
 AND EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions pm ON pm.id=rp.permission_id
  WHERE ur.user_id=u.id AND ur.company_id=cid AND r.company_id=cid AND r.is_active AND pm.permission_code='inventory.receiving.view')
 AND (EXISTS(SELECT 1 FROM project_members m WHERE m.project_id=pid AND m.employee_id=e.id AND m.is_active)
 OR EXISTS(SELECT 1 FROM user_roles ur JOIN roles r ON r.id=ur.role_id JOIN role_permissions rp ON rp.role_id=r.id JOIN permissions pm ON pm.id=rp.permission_id
  WHERE ur.user_id=u.id AND ur.company_id=cid AND r.company_id=cid AND r.is_active AND pm.permission_code='projects.access_all')))
$$;

CREATE FUNCTION erp_receiving_snapshot(did uuid) RETURNS jsonb LANGUAGE sql STABLE AS $$
 SELECT jsonb_build_object('delivery',to_jsonb(d),'lines',COALESCE((SELECT jsonb_agg((to_jsonb(l)-'observed_quantity'-'good_quantity')||jsonb_build_object('observed_quantity',l.observed_quantity::text,'good_quantity',l.good_quantity::text) ORDER BY l.line_no) FROM receiving_delivery_lines l WHERE l.delivery_id=did),'[]'::jsonb),
 'evidence',COALESCE((SELECT jsonb_agg(to_jsonb(e) ORDER BY e.id) FROM receiving_delivery_evidence e WHERE e.delivery_id=did),'[]'::jsonb)) FROM receiving_deliveries d WHERE d.id=did
$$;

CREATE FUNCTION erp_receiving_assert_lines(did uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE d receiving_deliveries; l receiving_delivery_lines; p purchase_order_lines; n integer;
BEGIN
 SELECT * INTO STRICT d FROM receiving_deliveries WHERE id=did;
 SELECT count(*) INTO n FROM receiving_delivery_lines WHERE delivery_id=did;
 IF n<1 OR n>100 THEN RAISE EXCEPTION 'RECEIVING_DIMENSION_INVALID'; END IF;
 IF NOT EXISTS(SELECT 1 FROM receiving_project_policies WHERE project_id=d.project_id AND company_id=d.company_id)
 OR NOT EXISTS(SELECT 1 FROM warehouses WHERE id=d.warehouse_id AND company_id=d.company_id AND (project_id IS NULL OR project_id=d.project_id))
 OR NOT EXISTS(SELECT 1 FROM suppliers WHERE id=d.supplier_id AND company_id=d.company_id)
 THEN RAISE EXCEPTION 'RECEIVING_DIMENSION_INVALID'; END IF;
 IF d.purchase_order_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM purchase_orders WHERE id=d.purchase_order_id AND company_id=d.company_id AND project_id=d.project_id AND supplier_id=d.supplier_id)
 THEN RAISE EXCEPTION 'RECEIVING_PO_INVALID'; END IF;
 FOR l IN SELECT * FROM receiving_delivery_lines WHERE delivery_id=did LOOP
  IF NOT EXISTS(SELECT 1 FROM materials WHERE id=l.material_id AND company_id=d.company_id) OR NOT EXISTS(SELECT 1 FROM units_of_measure WHERE id=l.uom_id AND company_id=d.company_id)
  THEN RAISE EXCEPTION 'RECEIVING_DIMENSION_INVALID'; END IF;
  IF l.purchase_order_line_id IS NOT NULL THEN
   SELECT * INTO p FROM purchase_order_lines WHERE id=l.purchase_order_line_id;
   IF NOT FOUND OR d.purchase_order_id IS NULL OR p.purchase_order_id<>d.purchase_order_id OR p.line_type<>'MATERIAL' OR p.material_id IS DISTINCT FROM l.material_id OR p.uom_id<>l.uom_id
   THEN RAISE EXCEPTION 'RECEIVING_PO_INVALID'; END IF;
  END IF;
  IF d.status='CHECKED' AND l.good_quantity>0 AND (l.purchase_order_line_id IS NULL OR l.good_quantity>p.quantity)
  THEN RAISE EXCEPTION 'RECEIVING_PO_INVALID'; END IF;
 END LOOP;
END $$;

CREATE FUNCTION erp_receiving_assert_ready(did uuid) RETURNS void LANGUAGE plpgsql AS $$
DECLARE d receiving_deliveries; e receiving_delivery_evidence; required text; p purchase_orders;
BEGIN
 SELECT * INTO STRICT d FROM receiving_deliveries WHERE id=did FOR SHARE;
 IF d.status<>'CHECKED' OR d.purchase_order_id IS NULL OR d.checked_by_user_id=d.created_by_user_id
 OR NOT erp_receiving_actor(d.checked_by_user_id,d.company_id,d.project_id,'inventory.receiving.check')
 OR NOT erp_receiving_actor(d.checked_by_user_id,d.company_id,d.project_id,'documents.document.view')
 THEN RAISE EXCEPTION 'RECEIVING_CHECK_REQUIRED'; END IF;
 IF NOT EXISTS(SELECT 1 FROM projects WHERE id=d.project_id AND company_id=d.company_id AND is_active)
 OR NOT EXISTS(SELECT 1 FROM warehouses WHERE id=d.warehouse_id AND company_id=d.company_id AND is_active AND (project_id IS NULL OR project_id=d.project_id))
 OR NOT EXISTS(SELECT 1 FROM suppliers WHERE id=d.supplier_id AND company_id=d.company_id AND is_active)
 OR EXISTS(SELECT 1 FROM receiving_delivery_lines l JOIN materials m ON m.id=l.material_id JOIN units_of_measure u ON u.id=l.uom_id WHERE l.delivery_id=did AND (NOT m.is_active OR NOT u.is_active))
 THEN RAISE EXCEPTION 'RECEIVING_DIMENSION_INVALID'; END IF;
 PERFORM erp_receiving_assert_lines(did);
 SELECT po.* INTO p FROM purchase_orders po JOIN approval_instances ai ON ai.id=po.approval_instance_id WHERE po.id=d.purchase_order_id AND ai.approval_state='APPROVED' AND po.cancelled_at IS NULL;
 IF NOT FOUND OR EXISTS(SELECT 1 FROM purchase_orders newer JOIN approval_instances ai ON ai.id=newer.approval_instance_id
 WHERE newer.company_id=p.company_id AND newer.po_number=p.po_number AND newer.revision_no>p.revision_no AND newer.cancelled_at IS NULL AND ai.approval_state='APPROVED')
 THEN RAISE EXCEPTION 'RECEIVING_PO_INVALID'; END IF;
 FOREACH required IN ARRAY ARRAY['DELIVERY_NOTE','RECEIVER_SIGNATURE','CONDITION_PHOTO']||(CASE WHEN d.quality_required THEN ARRAY['QUALITY_RESULT'] ELSE ARRAY[]::text[] END) LOOP
  IF NOT EXISTS(SELECT 1 FROM receiving_delivery_evidence x WHERE x.delivery_id=did AND x.purpose=required AND NOT EXISTS(SELECT 1 FROM receiving_delivery_evidence replacement WHERE replacement.supersedes_id=x.id))
  THEN RAISE EXCEPTION 'RECEIVING_EVIDENCE_INVALID'; END IF;
 END LOOP;
 FOR e IN SELECT x.* FROM receiving_delivery_evidence x WHERE x.delivery_id=did AND NOT EXISTS(SELECT 1 FROM receiving_delivery_evidence replacement WHERE replacement.supersedes_id=x.id) LOOP
  PERFORM id FROM documents WHERE id=e.document_id FOR SHARE;
  IF NOT EXISTS(SELECT 1 FROM documents doc WHERE doc.id=e.document_id AND doc.company_id=d.company_id AND doc.is_active AND doc.checksum=e.checksum AND doc.mime_type IN('application/pdf','image/png','image/jpeg')
   AND EXISTS(SELECT 1 FROM document_links dl WHERE dl.document_id=doc.id AND dl.entity_type='PROJECT' AND dl.entity_id=d.project_id)
   AND EXISTS(SELECT 1 FROM document_links dl WHERE dl.document_id=doc.id AND dl.entity_type='RECEIVING_DELIVERY' AND dl.entity_id=did)
   AND NOT EXISTS(SELECT 1 FROM document_links dl WHERE dl.document_id=doc.id AND left(upper(dl.entity_type),3)='HR_'))
  THEN RAISE EXCEPTION 'RECEIVING_EVIDENCE_INVALID'; END IF;
 END LOOP;
END $$;

CREATE FUNCTION erp_receiving_immutable() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN RAISE EXCEPTION 'RECEIVING_HISTORY_IMMUTABLE'; END $$;
CREATE TRIGGER receiving_policy_immutable BEFORE UPDATE OR DELETE ON receiving_project_policies FOR EACH ROW EXECUTE FUNCTION erp_receiving_immutable();
CREATE TRIGGER receiving_events_immutable BEFORE UPDATE OR DELETE ON receiving_delivery_events FOR EACH ROW EXECUTE FUNCTION erp_receiving_immutable();
CREATE TRIGGER receiving_operations_immutable BEFORE UPDATE OR DELETE ON receiving_operations FOR EACH ROW EXECUTE FUNCTION erp_receiving_immutable();
CREATE TRIGGER receiving_evidence_immutable BEFORE UPDATE OR DELETE ON receiving_delivery_evidence FOR EACH ROW EXECUTE FUNCTION erp_receiving_immutable();

CREATE FUNCTION erp_receiving_header_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF TG_OP='DELETE' THEN RAISE EXCEPTION 'RECEIVING_HISTORY_IMMUTABLE'; END IF;
 IF TG_OP='UPDATE' THEN
  IF (NEW.id,NEW.company_id,NEW.project_id,NEW.warehouse_id,NEW.supplier_id,NEW.created_by_user_id,NEW.received_at,NEW.po_link_due_at,NEW.supersedes_id,NEW.created_at)
    IS DISTINCT FROM (OLD.id,OLD.company_id,OLD.project_id,OLD.warehouse_id,OLD.supplier_id,OLD.created_by_user_id,OLD.received_at,OLD.po_link_due_at,OLD.supersedes_id,OLD.created_at)
  OR(OLD.linked_at IS NOT NULL AND NEW.linked_at IS DISTINCT FROM OLD.linked_at) THEN RAISE EXCEPTION 'RECEIVING_DEADLINE_IMMUTABLE'; END IF;
  IF NEW.status='VOID' AND EXISTS(SELECT 1 FROM goods_receipts g LEFT JOIN approval_instances a ON a.id=g.approval_instance_id WHERE g.delivery_id=OLD.id AND g.submitted_at IS NOT NULL AND a.approval_state IS DISTINCT FROM 'REJECTED') THEN RAISE EXCEPTION 'RECEIVING_SOURCE_FROZEN'; END IF;
  IF OLD.status='VOID' OR NEW.version<>OLD.version+1 THEN RAISE EXCEPTION 'RECEIVING_HISTORY_IMMUTABLE'; END IF;
  IF EXISTS(SELECT 1 FROM goods_receipts gr WHERE gr.delivery_id=OLD.id AND (gr.posted_at IS NOT NULL OR gr.reversed_at IS NOT NULL))
  THEN RAISE EXCEPTION 'RECEIVING_SOURCE_FROZEN'; END IF;
 END IF;
 IF NEW.supersedes_id IS NOT NULL AND NOT EXISTS(SELECT 1 FROM receiving_deliveries d WHERE d.id=NEW.supersedes_id AND d.status='VOID' AND d.company_id=NEW.company_id AND d.project_id=NEW.project_id AND d.warehouse_id=NEW.warehouse_id AND d.supplier_id=NEW.supplier_id AND d.created_by_user_id=NEW.created_by_user_id AND d.received_at=NEW.received_at AND d.po_link_due_at=NEW.po_link_due_at)
 THEN RAISE EXCEPTION 'RECEIVING_REPLACEMENT_INVALID'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER receiving_header_guard BEFORE INSERT OR UPDATE OR DELETE ON receiving_deliveries FOR EACH ROW EXECUTE FUNCTION erp_receiving_header_guard();

CREATE FUNCTION erp_receiving_line_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE did uuid;
BEGIN
 did:=CASE WHEN TG_OP='DELETE' THEN OLD.delivery_id ELSE NEW.delivery_id END;
 IF TG_OP='DELETE' OR (TG_OP='UPDATE' AND (NEW.id,NEW.delivery_id,NEW.line_no,NEW.material_id,NEW.uom_id) IS DISTINCT FROM (OLD.id,OLD.delivery_id,OLD.line_no,OLD.material_id,OLD.uom_id))
 THEN RAISE EXCEPTION 'RECEIVING_HISTORY_IMMUTABLE'; END IF;
 IF EXISTS(SELECT 1 FROM goods_receipts WHERE delivery_id=did) THEN RAISE EXCEPTION 'RECEIVING_SOURCE_FROZEN'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER receiving_line_guard BEFORE INSERT OR UPDATE OR DELETE ON receiving_delivery_lines FOR EACH ROW EXECUTE FUNCTION erp_receiving_line_guard();

CREATE FUNCTION erp_receiving_event_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d receiving_deliveries; cap text;
BEGIN
 SELECT * INTO STRICT d FROM receiving_deliveries WHERE id=NEW.delivery_id;
 cap:=CASE NEW.action WHEN 'CAPTURE' THEN 'capture' WHEN 'LINK_PO' THEN 'link_po' WHEN 'CHECK' THEN 'check' WHEN 'RETURN' THEN 'check' ELSE 'edit' END;
 IF NEW.version<>d.version OR NEW.company_id<>d.company_id OR NOT erp_receiving_actor(NEW.actor_user_id,d.company_id,d.project_id,'inventory.receiving.'||cap)
 OR(NEW.action IN('CAPTURE','REVISE','ATTACH','VOID') AND NEW.actor_user_id<>d.created_by_user_id)
 OR(NEW.action IN('CHECK','RETURN') AND NEW.actor_user_id=d.created_by_user_id)
 OR(NEW.action='CHECK' AND (d.status<>'CHECKED' OR d.checked_by_user_id<>NEW.actor_user_id))
 OR(NEW.action='VOID' AND d.status<>'VOID') OR(NEW.action='CAPTURE' AND d.version<>1)
 THEN RAISE EXCEPTION 'RECEIVING_VERSION_EVENT_REQUIRED'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER receiving_event_guard BEFORE INSERT ON receiving_delivery_events FOR EACH ROW EXECUTE FUNCTION erp_receiving_event_guard();

CREATE FUNCTION erp_receiving_history_proof() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE did uuid; d receiving_deliveries; n integer; last_facts jsonb;
BEGIN
 IF TG_TABLE_NAME='receiving_deliveries' THEN did:=NEW.id; ELSE did:=NEW.delivery_id; END IF;
 SELECT * INTO STRICT d FROM receiving_deliveries WHERE id=did;
 PERFORM erp_receiving_assert_lines(did);
 SELECT count(*) INTO n FROM receiving_delivery_events WHERE delivery_id=did;
 SELECT facts INTO last_facts FROM receiving_delivery_events WHERE delivery_id=did AND version=d.version;
 IF EXISTS(SELECT 1 FROM receiving_delivery_events e WHERE e.delivery_id=did AND NOT EXISTS(SELECT 1 FROM receiving_operations o WHERE o.delivery_id=did AND o.actor_user_id=e.actor_user_id AND o.action=e.action AND o.outcome->>'id'=did::text AND (o.outcome->>'version')::integer=e.version)) THEN RAISE EXCEPTION 'RECEIVING_VERSION_EVENT_REQUIRED'; END IF;
 IF n<>d.version OR last_facts IS DISTINCT FROM erp_receiving_snapshot(did) THEN RAISE EXCEPTION 'RECEIVING_VERSION_EVENT_REQUIRED'; END IF;
 IF d.status='CHECKED' THEN PERFORM erp_receiving_assert_ready(did); END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER receiving_header_proof AFTER INSERT OR UPDATE ON receiving_deliveries DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_receiving_history_proof();
CREATE CONSTRAINT TRIGGER receiving_lines_proof AFTER INSERT OR UPDATE ON receiving_delivery_lines DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_receiving_history_proof();
CREATE CONSTRAINT TRIGGER receiving_evidence_proof AFTER INSERT ON receiving_delivery_evidence DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_receiving_history_proof();

CREATE FUNCTION erp_receiving_gr_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d receiving_deliveries;
BEGIN
 IF TG_OP='UPDATE' AND NEW.delivery_id IS DISTINCT FROM OLD.delivery_id THEN RAISE EXCEPTION 'RECEIVING_SOURCE_FROZEN'; END IF;
 IF TG_OP='INSERT' AND NEW.delivery_id IS NULL AND EXISTS(SELECT 1 FROM receiving_project_policies WHERE project_id=NEW.project_id AND company_id=NEW.company_id)
 THEN RAISE EXCEPTION 'RECEIVING_CUSTODY_REQUIRED'; END IF;
 IF NEW.delivery_id IS NOT NULL THEN
  SELECT * INTO STRICT d FROM receiving_deliveries WHERE id=NEW.delivery_id FOR SHARE;
  IF (NEW.company_id,NEW.project_id,NEW.warehouse_id,NEW.supplier_id,NEW.purchase_order_id) IS DISTINCT FROM (d.company_id,d.project_id,d.warehouse_id,d.supplier_id,d.purchase_order_id)
  THEN RAISE EXCEPTION 'RECEIVING_GR_SOURCE_INVALID'; END IF;
  -- Reversal preserves the accepted historical source; it does not require a
  -- now-active checker/PO/evidence grant to undo existing canonical stock.
  IF TG_OP='INSERT' OR (NEW.submitted_at IS DISTINCT FROM OLD.submitted_at) OR (NEW.posted_at IS DISTINCT FROM OLD.posted_at) THEN PERFORM erp_receiving_assert_ready(d.id); END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER receiving_gr_guard BEFORE INSERT OR UPDATE ON goods_receipts FOR EACH ROW EXECUTE FUNCTION erp_receiving_gr_guard();

CREATE FUNCTION erp_receiving_gr_items_proof() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE gr goods_receipts; did uuid;
BEGIN
 IF TG_TABLE_NAME='goods_receipts' THEN SELECT * INTO STRICT gr FROM goods_receipts WHERE id=NEW.id; ELSE SELECT * INTO STRICT gr FROM goods_receipts WHERE id=NEW.goods_receipt_id; END IF;did:=gr.delivery_id;
 IF did IS NULL THEN RETURN NULL; END IF;
 IF NOT EXISTS(SELECT 1 FROM receiving_delivery_lines WHERE delivery_id=did AND good_quantity>0) OR EXISTS(SELECT 1 FROM goods_receipt_items i WHERE i.goods_receipt_id=gr.id AND NOT EXISTS(SELECT 1 FROM receiving_delivery_lines l WHERE l.delivery_id=did AND l.good_quantity>0 AND l.purchase_order_line_id=i.purchase_order_line_id AND l.material_id=i.material_id AND l.uom_id=i.uom_id AND l.good_quantity=i.quantity))
 OR EXISTS(SELECT 1 FROM receiving_delivery_lines l WHERE l.delivery_id=did AND l.good_quantity>0 AND NOT EXISTS(SELECT 1 FROM goods_receipt_items i WHERE i.goods_receipt_id=gr.id AND i.purchase_order_line_id=l.purchase_order_line_id AND i.quantity=l.good_quantity))
 THEN RAISE EXCEPTION 'RECEIVING_GR_SOURCE_INVALID'; END IF;
 RETURN NULL;
END $$;
CREATE CONSTRAINT TRIGGER receiving_gr_items_proof AFTER INSERT OR UPDATE ON goods_receipt_items DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_receiving_gr_items_proof();

CREATE FUNCTION erp_receiving_evidence_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d receiving_deliveries; e receiving_delivery_evidence;
BEGIN
 SELECT * INTO STRICT d FROM receiving_deliveries WHERE id=NEW.delivery_id;
 IF EXISTS(SELECT 1 FROM goods_receipts WHERE delivery_id=d.id) THEN RAISE EXCEPTION 'RECEIVING_SOURCE_FROZEN'; END IF;
 IF NEW.supersedes_id IS NOT NULL THEN SELECT * INTO e FROM receiving_delivery_evidence WHERE id=NEW.supersedes_id;
  IF NOT FOUND OR e.delivery_id<>NEW.delivery_id OR e.purpose<>NEW.purpose THEN RAISE EXCEPTION 'RECEIVING_EVIDENCE_INVALID'; END IF;
 END IF;
 IF NOT EXISTS(SELECT 1 FROM documents doc WHERE doc.id=NEW.document_id AND doc.company_id=d.company_id AND doc.is_active AND doc.checksum=NEW.checksum
  AND EXISTS(SELECT 1 FROM document_links dl WHERE dl.document_id=doc.id AND dl.entity_type='PROJECT' AND dl.entity_id=d.project_id)
  AND EXISTS(SELECT 1 FROM document_links dl WHERE dl.document_id=doc.id AND dl.entity_type='RECEIVING_DELIVERY' AND dl.entity_id=d.id)) THEN RAISE EXCEPTION 'RECEIVING_EVIDENCE_INVALID'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER receiving_evidence_guard BEFORE INSERT ON receiving_delivery_evidence FOR EACH ROW EXECUTE FUNCTION erp_receiving_evidence_guard();


CREATE CONSTRAINT TRIGGER receiving_gr_header_items_proof AFTER INSERT OR UPDATE ON goods_receipts DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION erp_receiving_gr_items_proof();

CREATE FUNCTION erp_receiving_bound_item_frozen() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 IF EXISTS(SELECT 1 FROM goods_receipts WHERE id=OLD.goods_receipt_id AND delivery_id IS NOT NULL) THEN RAISE EXCEPTION 'RECEIVING_SOURCE_FROZEN'; END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; ELSE RETURN NEW; END IF;
END $$;
CREATE TRIGGER receiving_bound_item_frozen BEFORE UPDATE OR DELETE ON goods_receipt_items FOR EACH ROW EXECUTE FUNCTION erp_receiving_bound_item_frozen();

CREATE FUNCTION erp_receiving_policy_guard() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
 PERFORM pg_advisory_xact_lock(hashtextextended('receiving-project:'||NEW.project_id::text,0));
 IF EXISTS(SELECT 1 FROM goods_receipts WHERE company_id=NEW.company_id AND project_id=NEW.project_id AND posted_at IS NULL AND reversed_at IS NULL) THEN RAISE EXCEPTION 'RECEIVING_SOURCE_FROZEN'; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER receiving_policy_guard BEFORE INSERT ON receiving_project_policies FOR EACH ROW EXECUTE FUNCTION erp_receiving_policy_guard();

CREATE FUNCTION erp_receiving_operation_guard() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE d receiving_deliveries;
BEGIN
 IF NEW.action='ENABLE' THEN
  IF NEW.outcome->>'projectId'<>NEW.project_id::text OR NOT EXISTS(SELECT 1 FROM receiving_project_policies WHERE project_id=NEW.project_id AND company_id=NEW.company_id AND enabled_by_user_id=NEW.actor_user_id)
  THEN RAISE EXCEPTION 'RECEIVING_VERSION_EVENT_REQUIRED'; END IF;
 ELSE
  SELECT * INTO STRICT d FROM receiving_deliveries WHERE id=NEW.delivery_id;
  IF d.company_id<>NEW.company_id OR d.project_id<>NEW.project_id THEN RAISE EXCEPTION 'RECEIVING_DIMENSION_INVALID'; END IF;
  IF NEW.action='CREATE_GR' THEN
   IF NOT EXISTS(SELECT 1 FROM goods_receipts WHERE id=(NEW.outcome->>'id')::uuid AND delivery_id=d.id AND company_id=d.company_id AND created_by_user_id=NEW.actor_user_id)
   THEN RAISE EXCEPTION 'RECEIVING_GR_SOURCE_INVALID'; END IF;
  ELSE
   IF NEW.outcome->>'id' IS DISTINCT FROM d.id::text OR (NEW.outcome->>'version')::integer IS DISTINCT FROM d.version
   OR NOT EXISTS(SELECT 1 FROM receiving_delivery_events WHERE delivery_id=d.id AND version=d.version AND action=NEW.action AND actor_user_id=NEW.actor_user_id)
   THEN RAISE EXCEPTION 'RECEIVING_VERSION_EVENT_REQUIRED'; END IF;
  END IF;
 END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER receiving_operation_guard BEFORE INSERT ON receiving_operations FOR EACH ROW EXECUTE FUNCTION erp_receiving_operation_guard();

-- Preserve the complete legacy/HR scope guard; add only the receiving source target.
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
  ELSIF NEW."entity_type" = 'RECEIVING_DELIVERY' THEN
    SELECT company_id,project_id INTO target_company,target_project
    FROM receiving_deliveries WHERE id=NEW."entity_id";
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

-- Bound physical evidence retains its identity and links even after archive or reversal.
CREATE FUNCTION erp_receiving_document_history() RETURNS trigger LANGUAGE plpgsql AS $$
DECLARE did uuid;
BEGIN
 IF TG_TABLE_NAME='document_links' THEN did:=OLD.document_id; ELSE did:=OLD.id; END IF;
 IF EXISTS (SELECT 1 FROM receiving_delivery_evidence WHERE document_id=did) THEN
  IF TG_TABLE_NAME='document_links' OR TG_OP='DELETE' OR
    (to_jsonb(OLD)-ARRAY['is_active','updated_at']) IS DISTINCT FROM (to_jsonb(NEW)-ARRAY['is_active','updated_at'])
  THEN RAISE EXCEPTION 'RECEIVING_EVIDENCE_HISTORY_IMMUTABLE'; END IF;
 END IF;
 IF TG_OP='DELETE' THEN RETURN OLD; END IF;
 RETURN NEW;
END $$;
CREATE TRIGGER receiving_document_history BEFORE UPDATE OR DELETE ON documents FOR EACH ROW EXECUTE FUNCTION erp_receiving_document_history();
CREATE TRIGGER receiving_document_link_history BEFORE UPDATE OR DELETE ON document_links FOR EACH ROW EXECUTE FUNCTION erp_receiving_document_history();
